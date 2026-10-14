"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { JSDOM } = require("jsdom");
const { Ledger, signed, verifyEnvelope, hash } = require("../ledger.cjs");
const { createService } = require("../service.cjs");
const { project, reviewHtml, labels } = require("../review.cjs");
function fixture(options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-ledger-")),
    server = crypto.generateKeyPairSync("ed25519"),
    device = crypto.generateKeyPairSync("ed25519");
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
    directory,
    registrations: [registration],
    serverKeyId: "server-1",
    serverPrivateKey: server.privateKey.export({
      format: "pem",
      type: "pkcs8",
    }),
    ...options,
  };
  let ledger = new Ledger(config),
    sequence = 0;
  const interactionId = crypto.randomUUID();
  const event = (changes = {}) => ({
    schemaVersion: 2,
    eventId: crypto.randomUUID(),
    interactionId,
    deviceId: registration.deviceId,
    streamEpoch: registration.streamEpoch,
    sequence: ++sequence,
    observedAt: "2026-10-14T09:00:00Z",
    kind: "CLICKED",
    outcome: null,
    attemptNumber: 0,
    policyId: registration.policyId,
    policyVersion: 1,
    extensionVersion: "1.21.0",
    urlMode: "domain_only",
    urlRedacted: "https://example.org",
    assessment: {
      localScore: 80,
      modelVersion: "test-v1",
      providerVerdict: "UNKNOWN",
      provider: "none",
      observedAt: "2026-10-14T09:00:00Z",
      reasonCodes: [],
    },
    reason: null,
    ...changes,
  });
  return {
    directory,
    registration,
    server,
    device,
    config,
    event,
    sign: (e) => signed(e, registration.keyId, device.privateKey),
    get ledger() {
      return ledger;
    },
    restart() {
      ledger.close();
      ledger = new Ledger(config);
      return ledger;
    },
    cleanup() {
      ledger.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("durable restart and 10000 retries return exactly the original STAGED receipt", () => {
  const f = fixture();
  try {
    const envelope = f.sign(f.event()),
      first = f.ledger.accept(envelope);
    verifyEnvelope(first.receipt, f.server.publicKey);
    assert.equal(first.receipt.payload.status, "STAGED");
    f.restart();
    for (let i = 0; i < 10000; i++) {
      const retry = f.ledger.accept(envelope);
      assert.equal(retry.duplicate, true);
      assert.deepEqual(retry.receipt, first.receipt);
    }
    assert.equal(f.ledger.records.length, 1);
  } finally {
    f.cleanup();
  }
});

test("device signatures, scope, revocation and event-ID conflicts reject forged evidence", () => {
  const f = fixture();
  try {
    const event = f.event(),
      envelope = f.sign(event);
    f.ledger.accept(envelope);
    assert.throws(
      () =>
        f.ledger.accept(
          f.sign({ ...event, urlRedacted: "https://other.example" }),
        ),
      /EVENT_ID_CONFLICT/,
    );
    assert.throws(
      () =>
        f.ledger.accept({ ...envelope, payload: { ...event, sequence: 2 } }),
      /SIGNATURE_INVALID/,
    );
    assert.throws(
      () =>
        f.ledger.accept(
          f.sign({
            ...event,
            eventId: crypto.randomUUID(),
            sequence: 2,
            deviceId: crypto.randomUUID(),
          }),
        ),
      /EVENT_SCOPE_DENIED/,
    );
    assert.throws(
      () =>
        f.ledger.accept(
          f.sign({
            ...event,
            eventId: crypto.randomUUID(),
            sequence: 2,
            urlRedacted: "https://example.org/?token=secret",
          }),
        ),
      /EVENT_SCHEMA_INVALID/,
    );
    f.config.registrations[0] = { ...f.registration, revoked: true };
    f.restart();
    assert.equal(f.ledger.records.length, 1);
    assert.throws(() => f.ledger.accept(envelope), /DEVICE_UNTRUSTED/);
  } finally {
    f.cleanup();
  }
});

test("stream gaps and premature OPENED never advance committed state", () => {
  const f = fixture();
  try {
    f.ledger.accept(f.sign(f.event()));
    assert.throws(
      () =>
        f.ledger.accept(
          f.sign(
            f.event({ sequence: 3, kind: "OPEN_INTENT", attemptNumber: 1 }),
          ),
        ),
      /SEQUENCE_GAP_OR_REPLAY/,
    );
    assert.throws(
      () =>
        f.ledger.accept(
          f.sign(
            f.event({
              sequence: 2,
              kind: "DECISION",
              outcome: "OPENED",
              attemptNumber: 1,
            }),
          ),
        ),
      /DECISION_INVALID/,
    );
    assert.equal(f.ledger.records.length, 1);
    f.ledger.accept(
      f.sign(f.event({ sequence: 2, kind: "OPEN_INTENT", attemptNumber: 1 })),
    );
    f.ledger.accept(
      f.sign(
        f.event({
          sequence: 3,
          kind: "DECISION",
          outcome: "OPENED",
          attemptNumber: 1,
        }),
      ),
    );
    assert.throws(
      () =>
        f.ledger.accept(
          f.sign(
            f.event({ sequence: 4, kind: "OPEN_INTENT", attemptNumber: 2 }),
          ),
        ),
      /OPEN_INTENT_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});

test("failed opening can retry; later scores preserve the final decision snapshot", () => {
  const f = fixture();
  try {
    f.ledger.accept(f.sign(f.event()));
    f.ledger.accept(f.sign(f.event({ kind: "OPEN_INTENT", attemptNumber: 1 })));
    f.ledger.accept(
      f.sign(
        f.event({
          kind: "DECISION",
          outcome: "OPEN_ERROR",
          attemptNumber: 1,
          reason: "browser_error",
        }),
      ),
    );
    f.ledger.accept(f.sign(f.event({ kind: "OPEN_INTENT", attemptNumber: 2 })));
    f.ledger.accept(
      f.sign(
        f.event({ kind: "DECISION", outcome: "OPENED", attemptNumber: 2 }),
      ),
    );
    f.ledger.accept(
      f.sign(
        f.event({
          kind: "ASSESSMENT_UPDATED",
          attemptNumber: 2,
          assessment: {
            localScore: 5,
            modelVersion: "test-v1",
            providerVerdict: "CLEAN",
            provider: "urlscan",
            observedAt: "2026-10-14T09:00:00Z",
            reasonCodes: [],
          },
        }),
      ),
    );
    const item = project(f.ledger.exportRecords())[0];
    assert.equal(item.scoreAtDecision, 80);
    assert.equal(item.latestScore, 5);
    assert.equal(item.outcome, "OPENED");
    assert.equal(item.eventCount, 6);
    f.restart();
    assert.equal(project(f.ledger.exportRecords())[0].scoreAtDecision, 80);
  } finally {
    f.cleanup();
  }
});

test("cancellation from a pending check stays cancelled after a late assessment", () => {
  const f = fixture();
  try {
    f.ledger.accept(f.sign(f.event()));
    f.ledger.accept(
      f.sign(
        f.event({ kind: "DECISION", outcome: "ABORTED", reason: "escape" }),
      ),
    );
    f.ledger.accept(f.sign(f.event({ kind: "ASSESSMENT_UPDATED" })));
    assert.equal(project(f.ledger.records)[0].outcome, "ABORTED");
    assert.throws(
      () =>
        f.ledger.accept(
          f.sign(
            f.event({ kind: "DECISION", outcome: "ABORTED", reason: "cancel" }),
          ),
        ),
      /DECISION_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});

test("exclusive writer lock prevents concurrent processes from accepting events", () => {
  const f = fixture();
  try {
    assert.throws(() => new Ledger(f.config), /WRITER_LOCKED/);
    f.ledger.accept(f.sign(f.event()));
    f.restart();
    assert.equal(f.ledger.records.length, 1);
  } finally {
    f.cleanup();
  }
});

test("full capacity refuses new events but still permits retry of committed records", () => {
  const f = fixture({ maxEvents: 1 });
  try {
    const envelope = f.sign(f.event());
    f.ledger.accept(envelope);
    assert.throws(
      () => f.ledger.accept(f.sign(f.event({ kind: "ASSESSMENT" }))),
      /JOURNAL_CAPACITY/,
    );
    assert.equal(f.ledger.accept(envelope).duplicate, true);
    assert.equal(f.ledger.records.length, 1);
  } finally {
    f.cleanup();
  }
});

test("fsync failure yields no receipt and poisons the writer until verified restart", () => {
  let fail = false;
  const io = {
    ...fs,
    fsyncSync: (fd) => {
      if (fail) throw new Error("disk unavailable");
      fs.fsyncSync(fd);
    },
  };
  const f = fixture({ io });
  try {
    const envelope = f.sign(f.event());
    fail = true;
    assert.throws(() => f.ledger.accept(envelope), /STORAGE_UNAVAILABLE/);
    assert.equal(f.ledger.records.length, 0);
    assert.throws(() => f.ledger.accept(envelope), /STORAGE_UNAVAILABLE/);
    fail = false;
    f.restart();
    assert.equal(f.ledger.accept(envelope).duplicate, true);
    assert.equal(f.ledger.records.length, 1);
  } finally {
    f.cleanup();
  }
});

test("short disk writes are completed before success; torn records stop recovery", () => {
  const io = {
    ...fs,
    writeSync: (fd, buffer, offset, length) =>
      fs.writeSync(fd, buffer, offset, Math.min(length, 19)),
  };
  const f = fixture({ io });
  try {
    f.ledger.accept(f.sign(f.event()));
    f.ledger.close();
    fs.appendFileSync(path.join(f.directory, "events.jsonl"), "partial");
    assert.throws(() => new Ledger(f.config), /JOURNAL_INCOMPLETE/);
  } finally {
    f.cleanup();
  }
});

test("journal changes, wrong server keys and modified device signatures fail startup", () => {
  const f = fixture();
  try {
    f.ledger.accept(f.sign(f.event()));
    f.ledger.close();
    const filename = path.join(f.directory, "events.jsonl"),
      original = fs.readFileSync(filename, "utf8"),
      record = JSON.parse(original);
    record.eventEnvelope.payload.assessment.localScore = 1;
    fs.writeFileSync(filename, JSON.stringify(record) + "\n");
    assert.throws(() => new Ledger(f.config), /SIGNATURE_INVALID/);
    fs.writeFileSync(filename, original);
    const wrong = crypto
      .generateKeyPairSync("ed25519")
      .privateKey.export({ format: "pem", type: "pkcs8" });
    assert.throws(
      () => new Ledger({ ...f.config, serverPrivateKey: wrong }),
      /SIGNATURE_INVALID/,
    );
    const r = JSON.parse(original);
    r.receipt.payload.status = "SEALED";
    fs.writeFileSync(filename, JSON.stringify(r) + "\n");
    assert.throws(() => new Ledger(f.config), /SIGNATURE_INVALID/);
  } finally {
    f.cleanup();
  }
});

test("receipt polling requires scoped device signatures and fresh nonces", () => {
  const now = Date.now(),
    f = fixture({ clock: () => now });
  try {
    const event = f.event(),
      receipt = f.ledger.accept(f.sign(event)).receipt;
    const request = {
        purpose: "receipt-read",
        eventId: event.eventId,
        issuedAt: new Date(now).toISOString(),
        nonce: crypto.randomUUID(),
      },
      auth = f.sign(request);
    assert.deepEqual(f.ledger.readReceipt(event.eventId, auth), receipt);
    assert.throws(
      () => f.ledger.readReceipt(event.eventId, auth),
      /RECEIPT_REQUEST_REPLAY/,
    );
    assert.throws(
      () =>
        f.ledger.readReceipt(
          event.eventId,
          f.sign({
            ...request,
            nonce: crypto.randomUUID(),
            issuedAt: new Date(now - 180000).toISOString(),
          }),
        ),
      /RECEIPT_REQUEST_EXPIRED/,
    );
    const id = crypto.randomUUID();
    assert.throws(
      () =>
        f.ledger.readReceipt(
          id,
          f.sign({ ...request, eventId: id, nonce: crypto.randomUUID() }),
        ),
      /RECEIPT_NOT_FOUND/,
    );
  } finally {
    f.cleanup();
  }
});

test("local HTTP batch supports partial failures, duplicate retries, receipt polling and origin isolation", async () => {
  const f = fixture(),
    server = createService(f.ledger);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const clicked = f.event(),
      envelope = f.sign(clicked),
      invalid = f.sign({
        ...clicked,
        eventId: crypto.randomUUID(),
        sequence: 2,
        urlRedacted: "https://example.org/path",
      });
    let response = await fetch(base + "/v1/device/events:batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [envelope, invalid] }),
    });
    assert.equal(response.status, 207);
    let data = await response.json();
    assert.equal(data.results[0].receipt.payload.status, "STAGED");
    assert.equal(data.results[1].error, "EVENT_SCHEMA_INVALID");
    response = await fetch(base + "/v1/device/events:batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [envelope] }),
    });
    assert.equal((await response.json()).results[0].duplicate, true);
    const auth = f.sign({
      purpose: "receipt-read",
      eventId: clicked.eventId,
      issuedAt: new Date().toISOString(),
      nonce: crypto.randomUUID(),
    });
    response = await fetch(base + "/v1/device/receipts/" + clicked.eventId, {
      headers: {
        authorization:
          "Thundy-Signature " +
          Buffer.from(JSON.stringify(auth)).toString("base64url"),
      },
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).receipt.payload.eventId,
      clicked.eventId,
    );
    response = await fetch(base + "/v1/device/receipts/" + clicked.eventId);
    assert.equal(response.status, 401);
    response = await fetch(base + "/v1/device/events:batch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: "{}",
    });
    assert.equal(response.status, 403);
    response = await fetch(base + "/v1/device/events:batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: Array(101).fill(envelope) }),
    });
    assert.equal(response.status, 400);
    response = await fetch(base + "/v1/device/events:batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [], padding: "x".repeat(256 * 1024) }),
    });
    assert.equal(response.status, 413);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    f.cleanup();
  }
});

for (const language of Object.keys(labels))
  test(
    "offline " +
      language +
      " review filters by decision snapshot and escapes data",
    () => {
      const f = fixture();
      try {
        f.ledger.accept(f.sign(f.event()));
        f.ledger.accept(
          f.sign(
            f.event({ kind: "DECISION", outcome: "ABORTED", reason: "cancel" }),
          ),
        );
        const html = reviewHtml(f.ledger.exportRecords(), language),
          dom = new JSDOM(html, { runScripts: "dangerously" }),
          $ = (id) => dom.window.document.getElementById(id);
        assert.equal(dom.window.document.documentElement.lang, language);
        assert.equal($("rows").querySelectorAll("tr").length, 1);
        assert.ok($("rows").textContent.includes(labels[language].aborted));
        $("outcome").value = "OPENED";
        $("outcome").dispatchEvent(new dom.window.Event("input"));
        assert.ok($("rows").textContent.includes(labels[language].none));
        assert.ok(html.includes("connect-src 'none'"));
        assert.equal(
          dom.window.document.querySelector('a[href^="http"]'),
          null,
        );
        dom.window.close();
        const malicious = [
          {
            eventEnvelope: {
              payload: {
                interactionId: "id",
                deviceId: "id",
                streamEpoch: "id",
                urlRedacted: "</script><img src=x onerror=alert(1)>",
                assessment: { localScore: null },
              },
            },
            receipt: { payload: { organizationId: "id" } },
          },
        ];
        assert.equal(
          reviewHtml(malicious, language).includes("<img src=x"),
          false,
        );
      } finally {
        f.cleanup();
      }
    },
  );

test("local CLI initializes synthetic data, exports review/evidence and independently verifies signatures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-local-cli-")),
    directory = path.join(root, "data"),
    output = path.join(root, "records.json"),
    html = path.join(root, "review.html");
  const run = (args) =>
    spawnSync(process.execPath, ["enterprise/local.cjs", ...args], {
      encoding: "utf8",
    });
  try {
    assert.equal(run(["init", "--data-dir", directory]).status, 0);
    assert.notEqual(run(["init", "--data-dir", directory]).status, 0);
    assert.equal(run(["demo", "--data-dir", directory]).status, 0);
    assert.equal(
      run(["export", "--data-dir", directory, "--out", output]).status,
      0,
    );
    assert.equal(
      run(["review", "--data-dir", directory, "--out", html, "--lang", "de"])
        .status,
      0,
    );
    assert.equal(
      run([
        "verify",
        "--out",
        output,
        "--public-key",
        path.join(directory, "server-public.pem"),
      ]).status,
      0,
    );
    assert.equal(JSON.parse(fs.readFileSync(output)).records.length, 6);
    assert.notEqual(
      run(["export", "--data-dir", directory, "--out", output]).status,
      0,
    );
    const record = JSON.parse(fs.readFileSync(output));
    record.records[2].eventEnvelope.payload.outcome = "ABORTED";
    fs.writeFileSync(output, JSON.stringify(record));
    assert.notEqual(
      run([
        "verify",
        "--out",
        output,
        "--public-key",
        path.join(directory, "server-public.pem"),
      ]).status,
      0,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("abrupt process exit leaves a visible lock and preserves its acknowledged event after operator recovery", () => {
  const f = fixture();
  try {
    const envelope = f.sign(f.event());
    f.ledger.close();
    const script =
      "const fs=require('fs');const {Ledger}=require('./enterprise/ledger.cjs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const ledger=new Ledger(data.config);console.log(JSON.stringify(ledger.accept(data.envelope)));process.exit(0);";
    const child = spawnSync(process.execPath, ["-e", script], {
      input: JSON.stringify({ config: f.config, envelope }),
      encoding: "utf8",
    });
    assert.equal(child.status, 0);
    const acknowledged = JSON.parse(child.stdout).receipt;
    assert.throws(() => new Ledger(f.config), /WRITER_LOCKED/);
    // Test harness knows the child exited. Production recovery requires operator review.
    fs.unlinkSync(path.join(f.directory, "writer.lock"));
    const recovered = new Ledger(f.config);
    try {
      assert.deepEqual(recovered.accept(envelope).receipt, acknowledged);
    } finally {
      recovered.close();
    }
  } finally {
    f.cleanup();
  }
});

test("different devices and tenants cannot retrieve another device receipt", () => {
  const f = fixture();
  try {
    const other = crypto.generateKeyPairSync("ed25519"),
      registration = {
        ...f.registration,
        keyId: "device-2",
        organizationId: crypto.randomUUID(),
        deviceId: crypto.randomUUID(),
        streamEpoch: crypto.randomUUID(),
        publicKey: other.publicKey.export({ format: "pem", type: "spki" }),
      };
    f.ledger.close();
    const ledger = new Ledger({
      ...f.config,
      registrations: [f.registration, registration],
    });
    try {
      const event = f.event();
      ledger.accept(f.sign(event));
      const request = {
        purpose: "receipt-read",
        eventId: event.eventId,
        issuedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };
      assert.throws(
        () =>
          ledger.readReceipt(
            event.eventId,
            signed(request, registration.keyId, other.privateKey),
          ),
        /RECEIPT_NOT_FOUND/,
      );
    } finally {
      ledger.close();
    }
  } finally {
    f.cleanup();
  }
});

test("shared storage permissions and journal symlinks are rejected before ingestion", () => {
  const f = fixture();
  try {
    f.ledger.close();
    fs.chmodSync(f.directory, 0o755);
    assert.throws(() => new Ledger(f.config), /PRIVATE_DIRECTORY_REQUIRED/);
    fs.chmodSync(f.directory, 0o700);
    const journal = path.join(f.directory, "events.jsonl");
    fs.chmodSync(journal, 0o644);
    assert.throws(() => new Ledger(f.config), /PRIVATE_JOURNAL_REQUIRED/);
    fs.chmodSync(journal, 0o600);
    const original = path.join(f.directory, "original.jsonl");
    fs.renameSync(journal, original);
    fs.symlinkSync(original, journal);
    assert.throws(() => new Ledger(f.config), /JOURNAL_INVALID/);
  } finally {
    f.cleanup();
  }
});

test("admin review paginates larger journals and filters reset the current page", () => {
  const records = Array.from({ length: 57 }, (_, i) => ({
    eventEnvelope: {
      payload: {
        kind: "CLICKED",
        interactionId: String(i),
        deviceId: "device",
        streamEpoch: "epoch",
        urlRedacted: "https://example.org",
        observedAt: "2026-10-14T09:00:00Z",
        assessment: { localScore: null },
      },
    },
    receipt: {
      payload: {
        organizationId: "organization",
        receivedAt: "2026-10-14T09:00:01Z",
      },
    },
  }));
  const dom = new JSDOM(reviewHtml(records, "de"), {
      runScripts: "dangerously",
    }),
    $ = (id) => dom.window.document.getElementById(id);
  assert.equal($("rows").children.length, 50);
  assert.equal($("previous").disabled, true);
  $("next").click();
  assert.equal($("rows").children.length, 7);
  assert.equal($("next").disabled, true);
  $("query").value = "example.org";
  $("query").dispatchEvent(new dom.window.Event("input"));
  assert.equal($("rows").children.length, 50);
  assert.equal($("previous").disabled, true);
  dom.window.close();
});

test("oversize envelopes and byte capacity reject evidence without committing it", () => {
  const f = fixture({ maxBytes: 100 });
  try {
    assert.throws(
      () =>
        f.ledger.accept(
          f.sign(
            f.event({
              urlRedacted: "https://example.org/" + "x".repeat(33000),
            }),
          ),
        ),
      /EVENT_TOO_LARGE/,
    );
    assert.throws(
      () => f.ledger.accept(f.sign(f.event({ sequence: 1 }))),
      /JOURNAL_CAPACITY/,
    );
    assert.equal(f.ledger.records.length, 0);
  } finally {
    f.cleanup();
  }
});
