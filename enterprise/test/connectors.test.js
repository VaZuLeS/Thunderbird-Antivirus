"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { Ledger, signed, hash } = require("../ledger.cjs");
const { ConnectorQueue, exportFormats, profile } = require("../connectors.cjs");
const at = Date.parse("2026-10-14T09:00:00Z");
function fixture(extra = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-connectors-")),
    server = crypto.generateKeyPairSync("ed25519"),
    device = crypto.generateKeyPairSync("ed25519"),
    signer = crypto.generateKeyPairSync("ed25519");
  const registration = {
    keyId: "device",
    organizationId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    streamEpoch: crypto.randomUUID(),
    policyId: crypto.randomUUID(),
    policyVersion: 1,
    revoked: false,
    publicKey: device.publicKey.export({ type: "spki", format: "pem" }),
  };
  const ledger = new Ledger({
    directory: path.join(base, "ledger"),
    registrations: [registration],
    serverKeyId: "server",
    serverPrivateKey: server.privateKey.export({
      type: "pkcs8",
      format: "pem",
    }),
  });
  let sequence = 0;
  const interactionId = crypto.randomUUID();
  for (const change of [
    {},
    { kind: "OPEN_INTENT", attemptNumber: 1 },
    { kind: "DECISION", outcome: "OPENED", attemptNumber: 1 },
  ]) {
    const event = {
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
      extensionVersion: "1.22.0",
      urlMode: "domain_only",
      urlRedacted: "https://example.org",
      assessment: {
        localScore: 80,
        modelVersion: "v1",
        providerVerdict: "UNKNOWN",
        provider: "none",
        observedAt: "2026-10-14T09:00:00Z",
        reasonCodes: [],
      },
      reason: null,
      ...change,
    };
    ledger.accept(signed(event, "device", device.privateKey));
  }
  const data = {
    schemaVersion: 1,
    kind: "thundy-staged-journal-export",
    records: ledger.exportRecords(),
  };
  ledger.close();
  const trust = {
      serverKeyId: "server",
      serverPublicKey: server.publicKey,
      registrations: [registration],
    },
    rules = {
      schemaVersion: 1,
      organizationId: registration.organizationId,
      ruleSetId: "risk",
      version: 1,
      rules: [
        {
          id: "high-score",
          outcomes: ["OPENED"],
          minScore: 70,
          matchUnknownScore: false,
          providerVerdicts: [],
          severity: "high",
        },
      ],
    };
  let now = at;
  const options = {
    directory: path.join(base, "queue"),
    outputDirectory: path.join(base, "exports"),
    signerKeyId: "connector",
    signerPrivateKey: signer.privateKey,
    trust,
    organizationId: registration.organizationId,
    profileId: "elastic",
    clock: () => now,
    ...extra,
  };
  let queue = new ConnectorQueue(options);
  return {
    base,
    options,
    data,
    rules,
    trust,
    signer,
    get queue() {
      return queue;
    },
    time(n) {
      now = n;
    },
    restart() {
      queue.close();
      queue = new ConnectorQueue(options);
    },
    cleanup() {
      queue.close();
      fs.rmSync(base, { recursive: true, force: true });
    },
  };
}
test("all four SIEM formats preserve score/provenance and only domain URLs", () => {
  const f = fixture();
  try {
    for (const name of ["splunk", "elastic", "sentinel", "generic-https"]) {
      const draft = profile(name);
      assert.equal(draft.transportEnabled, false);
      const artifacts = exportFormats(f.data, f.rules, f.trust, name);
      assert.equal(artifacts.length, 1);
      const lines = artifacts[0].trim().split("\n").map(JSON.parse);
      const item =
        name === "splunk"
          ? lines[0].event
          : name === "elastic"
            ? lines[1]
            : name === "sentinel"
              ? lines[0][0]
              : lines[0];
      assert.equal(item.scoreAtDecision, 80);
      assert.equal(item.urlRedacted, "https://example.org");
      assert.equal(item.sealed, false);
      assert.ok(!Object.hasOwn(item, "deviceId"));
      assert.equal(item.receiptHash, hash(f.data.records[2].receipt));
      if (name === "elastic")
        assert.equal(lines[0].create._id, item.incidentId);
    }
    assert.equal(profile("none").enabled, false);
  } finally {
    f.cleanup();
  }
});
test("durable queue dedupes after restart and never claims remote delivery", () => {
  const f = fixture();
  try {
    const one = f.queue.enqueue(f.data, f.rules, {
      expectedHead: hash(f.data.records.at(-1).receipt),
    });
    assert.equal(one[0].duplicate, false);
    f.restart();
    assert.equal(f.queue.enqueue(f.data, f.rules)[0].duplicate, true);
    const result = f.queue.exportOne();
    assert.equal(result.status, "EXPORTED");
    assert.equal(f.queue.exportOne(), null);
    const file = f.queue.outputPath(result.jobId),
      before = fs.readFileSync(file);
    f.restart();
    assert.equal(f.queue.exportOne(), null);
    assert.deepEqual(fs.readFileSync(file), before);
    assert.equal(fs.statSync(file).mode & 0o077, 0);
    assert.equal(f.queue.status().remoteDeliveryVerified, false);
    assert.ok(!JSON.stringify(f.queue.status()).includes("example.org"));
  } finally {
    f.cleanup();
  }
});
test("default-disabled profile and unknown endpoint/credential options cannot activate transport", () => {
  const f = fixture({ profileId: "none" });
  try {
    assert.throws(() => f.queue.enqueue(f.data, f.rules), /CONNECTOR_DISABLED/);
    assert.throws(() => f.queue.exportOne(), /CONNECTOR_DISABLED/);
    for (const key of ["httpsEndpoint", "credential", "transportEnabled"])
      assert.throws(
        () =>
          new ConnectorQueue({
            ...f.options,
            [key]: "https://127.0.0.1/private",
          }),
        /CONNECTOR_OPTION_UNSUPPORTED/,
      );
    assert.throws(
      () => profile("http://127.0.0.1"),
      /CONNECTOR_PROFILE_UNSUPPORTED/,
    );
  } finally {
    f.cleanup();
  }
});
test("local conflicts retry with backoff, dead-letter and explicit reset without overwrite", () => {
  const f = fixture({ maxAttempts: 2 });
  try {
    const [{ jobId }] = f.queue.enqueue(f.data, f.rules);
    fs.writeFileSync(f.queue.outputPath(jobId), "do-not-overwrite", {
      mode: 0o600,
    });
    assert.equal(f.queue.exportOne().status, "RETRY");
    assert.equal(f.queue.exportOne(), null);
    f.time(at + 1000);
    assert.equal(f.queue.exportOne().status, "DEAD_LETTER");
    assert.equal(
      fs.readFileSync(f.queue.outputPath(jobId), "utf8"),
      "do-not-overwrite",
    );
    f.queue.retry(jobId);
    fs.unlinkSync(f.queue.outputPath(jobId));
    assert.equal(f.queue.exportOne().status, "EXPORTED");
    assert.equal(f.queue.status().jobs[0].totalAttempts, 3);
  } finally {
    f.cleanup();
  }
});
test("complete artifact survives lost journal confirmation and is adopted only if content matches", () => {
  let fail = false;
  const f = fixture({
    io: {
      ...fs,
      fsyncSync(fd) {
        if (fail) throw new Error("offline");
        fs.fsyncSync(fd);
      },
    },
  });
  try {
    const [{ jobId }] = f.queue.enqueue(f.data, f.rules);
    f.queue.journal.append("ATTEMPT", { jobId });
    fail = true;
    assert.throws(() => f.queue.exportOne(), /JOURNAL_UNAVAILABLE/);
    const file = f.queue.outputPath(jobId);
    assert.ok(fs.existsSync(file));
    fail = false;
    f.restart();
    assert.equal(f.queue.status().jobs[0].status, "EXPORTED");
    assert.equal(f.queue.exportOne(), null);
  } finally {
    f.cleanup();
  }
});
test("interrupted attempt resumes existing exact output without creating a second artifact", () => {
  const f = fixture();
  try {
    const [{ jobId }] = f.queue.enqueue(f.data, f.rules);
    f.queue.journal.append("ATTEMPT", { jobId });
    const artifact = exportFormats(f.data, f.rules, f.trust, "elastic")[0];
    fs.writeFileSync(f.queue.outputPath(jobId), artifact, { mode: 0o600 });
    f.restart();
    assert.equal(f.queue.exportOne().status, "EXPORTED");
    assert.equal(fs.readdirSync(f.options.outputDirectory).length, 1);
  } finally {
    f.cleanup();
  }
});
test("forged evidence, wrong org, version changes and capacity are distinguished", () => {
  const f = fixture({ maxJobs: 1 });
  try {
    const bad = structuredClone(f.data);
    bad.records[2].eventEnvelope.payload.urlRedacted =
      "https://x/?token=secret";
    assert.throws(() => f.queue.enqueue(bad, f.rules));
    assert.equal(f.queue.status().jobs.length, 0);
    assert.throws(
      () =>
        f.queue.enqueue(f.data, {
          ...f.rules,
          organizationId: crypto.randomUUID(),
        }),
      /CONNECTOR_ORGANIZATION_MISMATCH/,
    );
    f.queue.enqueue(f.data, f.rules);
    assert.throws(
      () => f.queue.enqueue(f.data, { ...f.rules, version: 2 }),
      /CONNECTOR_CAPACITY/,
    );
    assert.equal(f.queue.status().jobs.length, 1);
  } finally {
    f.cleanup();
  }
});
test("symlink output and changed trust/profile cannot bypass recovery checks", () => {
  const f = fixture();
  try {
    const [{ jobId }] = f.queue.enqueue(f.data, f.rules);
    const sensitive = path.join(f.base, "sensitive");
    fs.writeFileSync(sensitive, "secret");
    fs.symlinkSync(sensitive, f.queue.outputPath(jobId));
    assert.equal(f.queue.exportOne().status, "RETRY");
    assert.equal(fs.readFileSync(sensitive, "utf8"), "secret");
    f.queue.close();
    assert.throws(
      () => new ConnectorQueue({ ...f.options, profileId: "splunk" }),
      /JOURNAL_ACTION_INVALID/,
    );
    const text = fs.readFileSync(
      path.join(f.options.directory, "actions.jsonl"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(f.options.directory, "actions.jsonl"),
      text.replace("QUEUED", "FORGED"),
    );
    assert.throws(() => new ConnectorQueue(f.options), /JOURNAL_INVALID/);
  } finally {
    f.cleanup();
  }
});
test("CLI offline pipeline rejects endpoints and credentials without leaking input values", () => {
  const { spawnSync } = require("node:child_process");
  const f = fixture();
  try {
    f.queue.close();
    const file = (name) => path.join(f.base, name),
      write = (name, value) =>
        fs.writeFileSync(file(name), JSON.stringify(value), { mode: 0o600 });
    fs.writeFileSync(
      file("signer.pem"),
      f.signer.privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      file("public.pem"),
      f.trust.serverPublicKey.export({ type: "spki", format: "pem" }),
    );
    write("registry.json", { registrations: f.trust.registrations });
    write("events.json", f.data);
    write("rules.json", f.rules);
    const config = {
      schemaVersion: 1,
      mode: "offline-export-only",
      organizationId: f.options.organizationId,
      profileId: "elastic",
      signerKeyId: "connector",
      signerPrivateKeyFile: file("signer.pem"),
      serverKeyId: "server",
      serverPublicKeyFile: file("public.pem"),
      registryFile: file("registry.json"),
      outputDirectory: f.options.outputDirectory,
    };
    // The fixture used a custom clock; CLI defaults are the same persisted scope.
    write("config.json", config);
    const run = (command, extra = []) =>
      spawnSync(
        process.execPath,
        [
          "enterprise/connectors_cli.cjs",
          command,
          "--directory",
          f.options.directory,
          "--config",
          file("config.json"),
          ...extra,
        ],
        { encoding: "utf8" },
      );
    const result = run("enqueue", [
      "--export",
      file("events.json"),
      "--rules",
      file("rules.json"),
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(run("run").stdout).status, "EXPORTED");
    assert.equal(JSON.parse(run("status").stdout).transportEnabled, false);
    write("config.json", {
      ...config,
      httpsEndpoint: "https://127.0.0.1/?token=SECRET",
    });
    const denied = run("status");
    assert.notEqual(denied.status, 0);
    assert.ok(!denied.stderr.includes("SECRET"));
    write("config.json", config);
    fs.chmodSync(file("signer.pem"), 0o644);
    assert.notEqual(run("status").status, 0);
    assert.notEqual(run("status", ["--credential", "SECRET"]).status, 0);
  } finally {
    f.cleanup();
  }
});
