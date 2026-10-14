"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync, spawn } = require("node:child_process");
const { Outbox, verifyStagedReceipt } = require("../outbox.cjs");
const { Ledger, signed, hash } = require("../ledger.cjs");
const { createService } = require("../service.cjs");
const {
  deliverOnce,
  pollOnce,
  localOrigin,
  retryDelay,
} = require("../delivery.cjs");
function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-outbox-")),
    server = crypto.generateKeyPairSync("ed25519"),
    device = crypto.generateKeyPairSync("ed25519");
  let now = Date.now();
  const registration = {
    keyId: "device-1",
    organizationId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    streamEpoch: crypto.randomUUID(),
    policyId: crypto.randomUUID(),
    policyVersion: 1,
    revoked: false,
    publicKey: device.publicKey.export({ format: "pem", type: "spki" }),
  };
  const config = {
    directory: path.join(root, "outbox"),
    registration,
    devicePrivateKey: device.privateKey.export({
      format: "pem",
      type: "pkcs8",
    }),
    serverKeyId: "server-1",
    serverPublicKey: server.publicKey.export({ format: "pem", type: "spki" }),
    clock: () => now,
    ...options,
  };
  let outbox = new Outbox(config);
  const ledger = new Ledger({
    directory: path.join(root, "server"),
    registrations: [registration],
    serverKeyId: "server-1",
    serverPrivateKey: server.privateKey.export({
      format: "pem",
      type: "pkcs8",
    }),
    clock: () => now,
  });
  const interactionId = crypto.randomUUID();
  const event = (changes = {}) => ({
    interactionId,
    observedAt: new Date(now).toISOString(),
    kind: "CLICKED",
    outcome: null,
    attemptNumber: 0,
    extensionVersion: "1.21.0",
    urlMode: "domain_only",
    urlRedacted: "https://example.org",
    assessment: {
      localScore: null,
      modelVersion: null,
      providerVerdict: "UNKNOWN",
      provider: "none",
      observedAt: null,
      reasonCodes: [],
    },
    reason: null,
    ...changes,
  });
  return {
    root,
    config,
    registration,
    server,
    device,
    ledger,
    event,
    get now() {
      return now;
    },
    advance: (ms) => (now += ms),
    get outbox() {
      return outbox;
    },
    restart() {
      outbox.close();
      outbox = new Outbox(config);
      return outbox;
    },
    cleanup() {
      outbox.close();
      ledger.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
const response = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const origin = "http://127.0.0.1:8766";

test("queue and sequence commit together, recover exactly, and duplicate IDs are idempotent", () => {
  const f = fixture();
  try {
    const input = f.event({ eventId: crypto.randomUUID() }),
      first = f.outbox.enqueue(input);
    assert.equal(first.payload.sequence, 1);
    f.restart();
    assert.deepEqual(f.outbox.enqueue(input), first);
    const second = f.outbox.enqueue(f.event({ kind: "ASSESSMENT" }));
    assert.equal(second.payload.sequence, 2);
    assert.throws(
      () =>
        f.outbox.enqueue({ ...input, urlRedacted: "https://other.example" }),
      /OUTBOX_EVENT_ID_CONFLICT/,
    );
    assert.throws(
      () => f.outbox.enqueue({ ...input, sequence: 3 }),
      /BROKER_SEQUENCE_REQUIRED/,
    );
    assert.equal(f.outbox.status().retainedEvents, 2);
  } finally {
    f.cleanup();
  }
});

test("forged, wrong-scope, wrong-content and unsupported SEALED receipts cannot modify durable state", () => {
  const f = fixture();
  try {
    const envelope = f.outbox.enqueue(f.event()),
      receipt = f.ledger.accept(envelope).receipt;
    f.outbox.state(envelope.payload.eventId, "ATTEMPT");
    const before = fs.readFileSync(f.outbox.logPath, "utf8");
    const wrong = crypto.generateKeyPairSync("ed25519");
    const invalid = [
      signed(
        { ...receipt.payload, deviceId: crypto.randomUUID() },
        "server-1",
        f.server.privateKey,
      ),
      signed(
        { ...receipt.payload, payloadHash: "0".repeat(64) },
        "server-1",
        f.server.privateKey,
      ),
      signed(
        { ...receipt.payload, status: "SEALED" },
        "server-1",
        f.server.privateKey,
      ),
      signed(receipt.payload, "server-1", wrong.privateKey),
    ];
    for (const item of invalid)
      assert.throws(() =>
        f.outbox.state(envelope.payload.eventId, "STAGED", { receipt: item }),
      );
    assert.equal(fs.readFileSync(f.outbox.logPath, "utf8"), before);
    f.outbox.state(envelope.payload.eventId, "STAGED", { receipt });
    f.restart();
    assert.equal(f.outbox.status().counts.STAGED, 1);
    assert.equal(f.outbox.status().retirementSupported, false);
    assert.equal(f.outbox.items.size, 1);
    assert.deepEqual(
      f.outbox.items.get(envelope.payload.eventId).envelope,
      envelope,
    );
  } finally {
    f.cleanup();
  }
});

test("offline errors retain events and durable retry timers prevent premature resend", async () => {
  const f = fixture();
  try {
    f.outbox.enqueue(f.event());
    let calls = 0;
    const options = {
      serviceOrigin: origin,
      random: () => 0,
      fetchImpl: async () => {
        calls++;
        throw new Error("offline");
      },
    };
    await deliverOnce(f.outbox, options);
    assert.equal(calls, 1);
    assert.equal(f.outbox.status().counts.RETRY, 1);
    f.restart();
    await deliverOnce(f.outbox, options);
    assert.equal(calls, 1);
    f.advance(1000);
    await deliverOnce(f.outbox, options);
    assert.equal(calls, 2);
    assert.equal([...f.outbox.items.values()][0].attempts, 2);
  } finally {
    f.cleanup();
  }
});

test("lost batch response retries unchanged envelopes and gets the original server receipts", async () => {
  const f = fixture();
  try {
    const first = f.outbox.enqueue(f.event()),
      second = f.outbox.enqueue(
        f.event({ kind: "DECISION", outcome: "ABORTED", reason: "escape" }),
      );
    let lost = true;
    const transport = async (url, options) => {
      const batch = JSON.parse(options.body);
      const results = batch.events.map((envelope) => ({
        status: 200,
        ...f.ledger.accept(envelope),
      }));
      if (lost) {
        lost = false;
        throw new Error("response lost");
      }
      return response({ results });
    };
    await deliverOnce(f.outbox, {
      serviceOrigin: origin,
      fetchImpl: transport,
      random: () => 0,
    });
    assert.equal(f.ledger.records.length, 2);
    f.restart();
    f.advance(1000);
    const result = await deliverOnce(f.outbox, {
      serviceOrigin: origin,
      fetchImpl: transport,
      random: () => 0,
    });
    assert.equal(result.counts.STAGED, 2);
    assert.equal(f.ledger.records.length, 2);
    assert.deepEqual(
      f.outbox.items.get(first.payload.eventId).receipt,
      f.ledger.events.get(first.payload.eventId).receipt,
    );
    assert.deepEqual(
      f.outbox.items.get(second.payload.eventId).envelope,
      second,
    );
  } finally {
    f.cleanup();
  }
});

test("partial acceptance is retained and a permanent head failure blocks later stream events", async () => {
  const f = fixture();
  try {
    const first = f.outbox.enqueue(f.event()),
      second = f.outbox.enqueue(f.event({ kind: "ASSESSMENT" }));
    const result = await deliverOnce(f.outbox, {
      serviceOrigin: origin,
      random: () => 0,
      fetchImpl: async () =>
        response(
          {
            results: [
              { status: 200, ...f.ledger.accept(first) },
              { status: 409, error: "EVENT_ID_CONFLICT" },
            ],
          },
          409,
        ),
    });
    assert.equal(result.counts.STAGED, 1);
    assert.equal(result.counts.DEAD_LETTER, 1);
    assert.equal(result.deliveryBlocked, true);
    f.outbox.enqueue(f.event({ kind: "ASSESSMENT_UPDATED" }));
    let calls = 0;
    await deliverOnce(f.outbox, {
      serviceOrigin: origin,
      fetchImpl: async () => {
        calls++;
        throw new Error("unexpected");
      },
    });
    assert.equal(calls, 0);
    assert.equal(
      f.outbox.items.get(second.payload.eventId).status,
      "DEAD_LETTER",
    );
    f.restart();
    assert.equal(f.outbox.status().retainedEvents, 3);
  } finally {
    f.cleanup();
  }
});

test("rate limits honor Retry-After beyond ordinary exponential backoff", async () => {
  const f = fixture();
  try {
    const envelope = f.outbox.enqueue(f.event());
    await deliverOnce(f.outbox, {
      serviceOrigin: origin,
      random: () => 0,
      fetchImpl: async () =>
        response({ error: "RATE_LIMITED" }, 429, { "retry-after": "600" }),
    });
    assert.equal(
      f.outbox.items.get(envelope.payload.eventId).nextAttemptAt,
      f.now + 600000,
    );
    assert.equal(
      retryDelay(40, { random: () => 0.999, now: f.now }) <= 300000,
      true,
    );
    assert.equal(
      retryDelay(1, {
        random: () => 0,
        now: f.now,
        retryAfter: new Date(f.now + 60000).toUTCString(),
      }) >= 59000,
      true,
    );
  } finally {
    f.cleanup();
  }
});

test("retry exhaustion and expired items become visible dead letters without dropping payloads", async () => {
  const f = fixture({ maxAttempts: 2, maxAgeMs: 2000 });
  try {
    f.outbox.enqueue(f.event());
    const transport = {
      serviceOrigin: origin,
      random: () => 0,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    };
    await deliverOnce(f.outbox, transport);
    f.advance(1000);
    await deliverOnce(f.outbox, transport);
    assert.equal(f.outbox.status().counts.DEAD_LETTER, 1);
    assert.equal(f.outbox.status().errors[0].error, "RETRY_LIMIT_REACHED");
    assert.equal(f.outbox.status().retainedEvents, 1);
  } finally {
    f.cleanup();
  }
  const expired = fixture({ maxAgeMs: 1000 });
  try {
    expired.outbox.enqueue(expired.event());
    expired.advance(1001);
    assert.equal(expired.outbox.batch().length, 0);
    assert.equal(
      expired.outbox.status().errors[0].error,
      "OUTBOX_EVENT_EXPIRED",
    );
    assert.equal(expired.outbox.items.size, 1);
  } finally {
    expired.cleanup();
  }
});

test("queue capacity warns at 80 percent and never evicts pending or STAGED payloads", () => {
  const f = fixture({ maxEvents: 5 });
  try {
    f.outbox.enqueue(f.event());
    for (let i = 0; i < 3; i++)
      f.outbox.enqueue(f.event({ kind: "ASSESSMENT" }));
    assert.equal(f.outbox.status().capacityWarning, true);
    f.outbox.enqueue(f.event({ kind: "ASSESSMENT" }));
    assert.equal(f.outbox.status().capacityFull, true);
    assert.throws(
      () => f.outbox.enqueue(f.event({ kind: "ASSESSMENT" })),
      /OUTBOX_CAPACITY/,
    );
    f.restart();
    assert.equal(f.outbox.items.size, 5);
  } finally {
    f.cleanup();
  }
});

test("fsync failure yields no queued success and verified restart recovers the committed sequence", () => {
  let fail = false;
  const io = {
      ...fs,
      fsyncSync: (fd) => {
        if (fail) throw new Error("disk");
        fs.fsyncSync(fd);
      },
    },
    f = fixture({ io });
  try {
    const input = f.event({ eventId: crypto.randomUUID() });
    fail = true;
    assert.throws(() => f.outbox.enqueue(input), /OUTBOX_STORAGE_FAILED/);
    assert.throws(() => f.outbox.status(), /OUTBOX_UNAVAILABLE/);
    fail = false;
    f.restart();
    assert.equal(f.outbox.enqueue(input).payload.sequence, 1);
    assert.equal(f.outbox.items.size, 1);
  } finally {
    f.cleanup();
  }
});

test("exclusive writers, torn tails and tampered signed actions stop recovery", () => {
  const f = fixture();
  try {
    f.outbox.enqueue(f.event());
    assert.throws(() => new Outbox(f.config), /OUTBOX_LOCKED/);
    f.outbox.close();
    const source = fs.readFileSync(f.outbox.logPath, "utf8");
    fs.appendFileSync(f.outbox.logPath, "partial");
    assert.throws(() => new Outbox(f.config), /OUTBOX_LOG_INCOMPLETE/);
    const record = JSON.parse(source);
    record.payload.envelope.payload.urlRedacted = "https://changed.example";
    fs.writeFileSync(f.outbox.logPath, JSON.stringify(record) + "\n");
    assert.throws(() => new Outbox(f.config), /SIGNATURE_INVALID/);
  } finally {
    f.cleanup();
  }
});

test("invalid origins and redirects never turn the broker into an external sender", async () => {
  for (const value of [
    "https://example.com",
    "http://localhost:8766",
    "http://127.0.0.1:8766/path",
    "http://user:pass@127.0.0.1:8766",
    "http://127.0.0.1:8766?token=x",
    "http://127.0.0.1:80",
  ])
    assert.throws(() => localOrigin(value), /LOCAL_ORIGIN_REQUIRED/);
  const f = fixture();
  try {
    f.outbox.enqueue(f.event());
    let options;
    await deliverOnce(f.outbox, {
      serviceOrigin: origin,
      random: () => 0,
      fetchImpl: async (url, input) => {
        options = input;
        return response({}, 302, { location: "https://other.example" });
      },
    });
    assert.equal(options.redirect, "error");
    assert.equal(f.outbox.status().errors[0].error, "REDIRECT_DENIED");
    assert.equal(f.outbox.items.size, 1);
  } finally {
    f.cleanup();
  }
});

test("overlarge responses, result count mismatches and failed signatures retain events for retry", async () => {
  for (const transport of [
    async () => new Response("x".repeat(513 * 1024)),
    async () => response({ results: [] }),
    async () => response({ results: [{ status: 200, receipt: {} }] }),
  ]) {
    const f = fixture();
    try {
      f.outbox.enqueue(f.event());
      const result = await deliverOnce(f.outbox, {
        serviceOrigin: origin,
        random: () => 0,
        fetchImpl: transport,
      });
      assert.equal(result.counts.RETRY, 1);
      assert.equal(result.retainedEvents, 1);
    } finally {
      f.cleanup();
    }
  }
});

test("receipt polling verifies the pinned server and never retires STAGED data", async () => {
  const f = fixture();
  try {
    const envelope = f.outbox.enqueue(f.event()),
      receipt = f.ledger.accept(envelope).receipt;
    f.outbox.state(envelope.payload.eventId, "ATTEMPT");
    f.outbox.state(envelope.payload.eventId, "STAGED", { receipt });
    const result = await pollOnce(f.outbox, {
      serviceOrigin: origin,
      fetchImpl: async (url, input) => {
        const auth = JSON.parse(
          Buffer.from(input.headers.authorization.slice(17), "base64url"),
        );
        return response({
          receipt: f.ledger.readReceipt(envelope.payload.eventId, auth),
        });
      },
    });
    assert.equal(result.checked, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.retainedEvents, 1);
    f.advance(60000);
    const bad = await pollOnce(f.outbox, {
      serviceOrigin: origin,
      fetchImpl: async () =>
        response({
          receipt: signed(
            { ...receipt.payload, status: "SEALED" },
            "server-1",
            f.server.privateKey,
          ),
        }),
    });
    assert.equal(bad.failed, 1);
    assert.equal(bad.pollErrors[0].error, "RECEIPT_STATUS_UNSUPPORTED");
    f.restart();
    assert.equal(f.outbox.status().counts.STAGED, 1);
    assert.equal(f.outbox.items.size, 1);
  } finally {
    f.cleanup();
  }
});

test("real local HTTP service stages a broker batch and supports receipt polling after restart", async () => {
  const f = fixture(),
    server = createService(f.ledger);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const serviceOrigin = "http://127.0.0.1:" + server.address().port;
  try {
    f.outbox.enqueue(f.event());
    f.outbox.enqueue(f.event({ kind: "OPEN_INTENT", attemptNumber: 1 }));
    f.outbox.enqueue(
      f.event({ kind: "DECISION", outcome: "OPENED", attemptNumber: 1 }),
    );
    const result = await deliverOnce(f.outbox, {
      serviceOrigin,
      random: () => 0,
    });
    assert.equal(result.counts.STAGED, 3);
    f.restart();
    f.advance(60000);
    const polled = await pollOnce(f.outbox, { serviceOrigin });
    assert.equal(polled.failed, 0);
    assert.equal(polled.checked, 3);
    assert.equal(f.ledger.records.length, 3);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    f.cleanup();
  }
});

test("broker CLI persists synthetic events and displays status without starting network delivery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-broker-cli-")),
    directory = path.join(root, "data");
  const run = (file, args) =>
    spawnSync(process.execPath, [file, ...args], { encoding: "utf8" });
  try {
    assert.equal(
      run("enterprise/local.cjs", ["init", "--data-dir", directory]).status,
      0,
    );
    let result = run("enterprise/broker.cjs", [
      "demo",
      "--data-dir",
      directory,
    ]);
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).counts.PENDING, 6);
    result = run("enterprise/broker.cjs", ["status", "--data-dir", directory]);
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).retainedEvents, 6);
    assert.equal(fs.existsSync(path.join(directory, "events.jsonl")), false);
    assert.notEqual(
      run("enterprise/broker.cjs", [
        "deliver",
        "--data-dir",
        directory,
        "--origin",
        "https://evil.example",
      ]).status,
      0,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("operator retry after exhaustion is durably recorded and preserves envelope and total attempts", async () => {
  const f = fixture({ maxAttempts: 1 });
  try {
    const envelope = f.outbox.enqueue(f.event());
    await deliverOnce(f.outbox, {
      serviceOrigin: origin,
      random: () => 0,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    f.outbox.retry(envelope.payload.eventId);
    f.restart();
    assert.equal(f.outbox.status().deliveryBlocked, false);
    const result = await deliverOnce(f.outbox, {
      serviceOrigin: origin,
      random: () => 0,
      fetchImpl: async () =>
        response({ results: [{ status: 200, ...f.ledger.accept(envelope) }] }),
    });
    assert.equal(result.counts.STAGED, 1);
    assert.equal(f.outbox.items.get(envelope.payload.eventId).totalAttempts, 2);
    assert.deepEqual(
      f.outbox.items.get(envelope.payload.eventId).envelope,
      envelope,
    );
  } finally {
    f.cleanup();
  }
  const expired = fixture({ maxAgeMs: 1 });
  try {
    const envelope = expired.outbox.enqueue(expired.event());
    expired.advance(2);
    expired.outbox.batch();
    assert.throws(
      () => expired.outbox.retry(envelope.payload.eventId),
      /OUTBOX_RETRY_RESET_DENIED/,
    );
  } finally {
    expired.cleanup();
  }
});

test("24 hours offline and restart preserve the payload, sequence, and pending delivery", async () => {
  const f = fixture();
  try {
    const envelope = f.outbox.enqueue(f.event());
    f.advance(24 * 3600000);
    f.restart();
    assert.deepEqual(f.outbox.batch()[0], envelope);
    assert.equal(f.outbox.status().retainedEvents, 1);
    const result = await deliverOnce(f.outbox, {
      serviceOrigin: origin,
      random: () => 0,
      fetchImpl: async () =>
        response({ results: [{ status: 200, ...f.ledger.accept(envelope) }] }),
    });
    assert.equal(result.counts.STAGED, 1);
  } finally {
    f.cleanup();
  }
});

test("a crashed writer leaves a lock and preserves its queued event after operator recovery", () => {
  const f = fixture();
  try {
    f.outbox.close();
    const config = { ...f.config };
    delete config.clock;
    const script =
      "const fs=require('fs');const {Outbox}=require('./enterprise/outbox.cjs');const input=JSON.parse(fs.readFileSync(0,'utf8'));const outbox=new Outbox(input.config);console.log(JSON.stringify(outbox.enqueue(input.event)));process.exit(0);";
    const child = spawnSync(process.execPath, ["-e", script], {
      input: JSON.stringify({ config, event: f.event() }),
      encoding: "utf8",
    });
    assert.equal(child.status, 0);
    const envelope = JSON.parse(child.stdout);
    assert.throws(() => new Outbox(f.config), /OUTBOX_LOCKED/);
    fs.unlinkSync(f.outbox.lockPath);
    f.restart();
    assert.deepEqual(f.outbox.batch()[0], envelope);
  } finally {
    f.cleanup();
  }
});

test("bounded batches preserve ordering and concurrent delivery cannot run twice", async () => {
  const f = fixture();
  try {
    f.outbox.enqueue(f.event());
    for (let i = 0; i < 100; i++)
      f.outbox.enqueue(f.event({ kind: "ASSESSMENT" }));
    assert.equal(f.outbox.batch().length, 100);
    let resolve;
    const waiting = new Promise((done) => {
      resolve = done;
    });
    const active = deliverOnce(f.outbox, {
      serviceOrigin: origin,
      random: () => 0,
      fetchImpl: async () => {
        await waiting;
        throw new Error("offline");
      },
    });
    await assert.rejects(
      () => deliverOnce(f.outbox, { serviceOrigin: origin }),
      /OUTBOX_DELIVERY_BUSY/,
    );
    resolve();
    await active;
    assert.equal(f.outbox.status().counts.RETRY, 100);
    assert.equal(f.outbox.status().counts.PENDING, 1);
    assert.equal(f.outbox.batch().length, 0);
    f.advance(1000);
    assert.equal(f.outbox.batch().length, 100);
  } finally {
    f.cleanup();
  }
});

test("request deadline also aborts a stalled response body", async () => {
  const http = require("node:http"),
    server = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.write("{");
    });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const f = fixture();
  try {
    f.outbox.enqueue(f.event());
    const result = await deliverOnce(f.outbox, {
      serviceOrigin: "http://127.0.0.1:" + server.address().port,
      deadlineMs: 25,
      random: () => 0,
    });
    assert.equal(result.counts.RETRY, 1);
    assert.equal(result.retainedEvents, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    f.cleanup();
  }
});

test("CLI broker and separate service complete queue-to-review delivery while retaining all payloads", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-broker-e2e-")),
    directory = path.join(root, "data");
  const run = (file, args) =>
    spawnSync(process.execPath, [file, ...args], { encoding: "utf8" });
  const portServer = require("node:net").createServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  let child;
  try {
    assert.equal(
      run("enterprise/local.cjs", ["init", "--data-dir", directory]).status,
      0,
    );
    assert.equal(
      run("enterprise/broker.cjs", ["demo", "--data-dir", directory]).status,
      0,
    );
    child = spawn(
      process.execPath,
      [
        "enterprise/local.cjs",
        "serve",
        "--data-dir",
        directory,
        "--port",
        String(port),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("service readiness timeout")),
        5000,
      );
      child.stdout.on("data", (chunk) => {
        if (chunk.toString().includes("LOCAL_SERVICE_READY")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("service exited early"));
      });
    });
    const delivered = run("enterprise/broker.cjs", [
      "deliver",
      "--data-dir",
      directory,
      "--origin",
      "http://127.0.0.1:" + port,
    ]);
    assert.equal(delivered.status, 0);
    assert.equal(JSON.parse(delivered.stdout).counts.STAGED, 6);
    const exit = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await exit;
    const reviewed = run("enterprise/local.cjs", [
      "review",
      "--data-dir",
      directory,
      "--lang",
      "de",
      "--out",
      path.join(root, "review.html"),
    ]);
    assert.equal(reviewed.status, 0);
    assert.ok(
      fs
        .readFileSync(path.join(root, "review.html"), "utf8")
        .includes("scoreAtDecision"),
    );
    const status = run("enterprise/broker.cjs", [
      "status",
      "--data-dir",
      directory,
    ]);
    assert.equal(JSON.parse(status.stdout).retainedEvents, 6);
  } finally {
    if (child && child.exitCode === null) child.kill("SIGKILL");
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("outbox refuses shared directory permissions and symlinked journals", () => {
  const f = fixture();
  try {
    f.outbox.close();
    fs.chmodSync(f.config.directory, 0o755);
    assert.throws(() => new Outbox(f.config), /PRIVATE_DIRECTORY_REQUIRED/);
    fs.chmodSync(f.config.directory, 0o700);
    const original = path.join(f.config.directory, "original.jsonl");
    fs.renameSync(f.outbox.logPath, original);
    fs.symlinkSync(original, f.outbox.logPath);
    assert.throws(() => new Outbox(f.config), /OUTBOX_LOG_INVALID/);
  } finally {
    f.cleanup();
  }
});
