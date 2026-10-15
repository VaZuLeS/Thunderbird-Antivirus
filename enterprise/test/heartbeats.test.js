"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { Heartbeats } = require("../heartbeats.cjs"),
  { signed } = require("../ledger.cjs");
const at = Date.parse("2026-10-15T10:00:00Z"),
  iso = (n) => new Date(n).toISOString();
function fixture(extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-heartbeat-")),
    device = crypto.generateKeyPairSync("ed25519"),
    writer = crypto.generateKeyPairSync("ed25519");
  let now = at;
  const registration = {
    keyId: "device-1",
    organizationId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    streamEpoch: crypto.randomUUID(),
    policyId: crypto.randomUUID(),
    policyVersion: 3,
    revoked: false,
    publicKey: device.publicKey.export({ type: "spki", format: "pem" }),
  };
  const options = {
    directory: path.join(root, "state"),
    organizationId: registration.organizationId,
    registrations: [registration],
    signerKeyId: "heartbeat-writer",
    signerPrivateKey: writer.privateKey,
    clock: () => now,
    ...extra,
  };
  let store = new Heartbeats(options);
  const envelope = (sequence = 1, changes = {}) =>
    signed(
      {
        schemaVersion: 1,
        kind: "thundy-device-heartbeat",
        organizationId: registration.organizationId,
        deviceId: registration.deviceId,
        streamEpoch: registration.streamEpoch,
        sequence,
        observedAt: iso(now),
        extensionVersion: "1.22.0",
        policyId: registration.policyId,
        policyVersion: 3,
        brokerReady: true,
        queue: { pending: 0, retry: 0, deadLetter: 0, bytes: 0 },
        ...changes,
      },
      registration.keyId,
      device.privateKey,
    );
  return {
    root,
    options,
    registration,
    device,
    writer,
    envelope,
    get store() {
      return store;
    },
    time(n) {
      now = n;
    },
    restart() {
      store.close();
      store = new Heartbeats(options);
    },
    publicOptions() {
      return {
        ...options,
        signerPrivateKey: undefined,
        signerPublicKey: writer.publicKey,
        now,
      };
    },
    cleanup() {
      store.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
function pub(f) {
  const { directory, signerPrivateKey, clock, ...rest } = f.publicOptions();
  return rest;
}
test("never-seen device becomes current, late and unknown based on both clocks", () => {
  const f = fixture();
  try {
    assert.equal(f.store.status().counts.NEVER_SEEN, 1);
    f.store.accept(f.envelope());
    assert.equal(f.store.status().counts.CURRENT, 1);
    f.time(at + 600000);
    assert.equal(f.store.status().counts.LATE, 1);
    f.time(at + 1200000);
    const r = f.store.status();
    assert.equal(r.counts.UNKNOWN, 1);
    assert.equal(r.productionFleetVerified, false);
    assert.equal(r.runtimeIntegrated, false);
    assert.equal(r.sealed, false);
  } finally {
    f.cleanup();
  }
});
test("duplicates after restart return original receipt and never refresh contact time", () => {
  const f = fixture();
  try {
    const one = f.envelope(),
      first = f.store.accept(one);
    f.time(at + 1000);
    f.store.accept(f.envelope(2));
    const head = f.store.journal.head();
    f.restart();
    f.time(at + 700000);
    const duplicate = f.store.accept(one);
    assert.equal(duplicate.duplicate, true);
    assert.deepEqual(duplicate.receipt, first.receipt);
    assert.equal(f.store.journal.head(), head);
    assert.equal(f.store.status().devices[0].receivedAt, iso(at + 1000));
    assert.equal(f.store.status().devices[0].status, "LATE");
  } finally {
    f.cleanup();
  }
});
test("wrong organization/device/epoch, forged signatures, payload additions and revoked keys fail", () => {
  const f = fixture();
  try {
    for (const edit of [
      { organizationId: crypto.randomUUID() },
      { deviceId: crypto.randomUUID() },
      { streamEpoch: crypto.randomUUID() },
      { url: "https://secret/?token=x" },
      { queue: { pending: 0, retry: 0, deadLetter: 0, bytes: 0, secret: "x" } },
    ])
      assert.throws(() => f.store.accept(f.envelope(1, edit)));
    const forged = f.envelope();
    forged.signature = "A".repeat(86);
    assert.throws(() => f.store.accept(forged));
    assert.equal(f.store.journal.records.length, 0);
    f.store.close();
    const revoked = new Heartbeats({
      ...f.options,
      directory: path.join(f.root, "revoked"),
      registrations: [{ ...f.registration, revoked: true }],
    });
    try {
      assert.throws(
        () => revoked.accept(f.envelope()),
        /HEARTBEAT_DEVICE_UNTRUSTED/,
      );
      assert.equal(revoked.status().counts.REVOKED, 1);
    } finally {
      revoked.close();
    }
  } finally {
    f.cleanup();
  }
});
test("sequence gaps, equivocation, clock skew and reversed device time are rejected", () => {
  const f = fixture();
  try {
    assert.throws(
      () => f.store.accept(f.envelope(2)),
      /HEARTBEAT_SEQUENCE_INVALID/,
    );
    assert.throws(
      () => f.store.accept(f.envelope(1, { observedAt: iso(at + 120001) })),
      /HEARTBEAT_CLOCK_SKEW/,
    );
    assert.throws(
      () => f.store.accept(f.envelope(1, { observedAt: iso(at - 120001) })),
      /HEARTBEAT_CLOCK_SKEW/,
    );
    f.store.accept(f.envelope());
    assert.throws(
      () => f.store.accept(f.envelope(1, { brokerReady: false })),
      /HEARTBEAT_SEQUENCE_CONFLICT/,
    );
    assert.throws(
      () => f.store.accept(f.envelope(2, { observedAt: iso(at - 1) })),
      /HEARTBEAT_TIME_REVERSED/,
    );
    f.time(at - 1);
    assert.throws(() => f.store.status(), /JOURNAL_CLOCK_ROLLBACK/);
  } finally {
    f.cleanup();
  }
});
test("reported extension and policy versions are classified without claiming applied policy", () => {
  const f = fixture();
  try {
    f.store.accept(
      f.envelope(1, { extensionVersion: "1.21.0", policyVersion: 2 }),
    );
    assert.equal(f.store.status().devices[0].extensionState, "below_minimum");
    assert.equal(f.store.status().devices[0].policyState, "behind");
    f.store.accept(f.envelope(2, { policyVersion: 4 }));
    assert.equal(f.store.status().devices[0].policyState, "ahead");
  } finally {
    f.cleanup();
  }
});
test("public verifier checks device and journal signatures while writer is active", () => {
  const f = fixture();
  try {
    f.store.accept(f.envelope());
    const bytes = fs.readFileSync(f.store.journal.logPath),
      lock = fs.readFileSync(f.store.journal.lockPath);
    const r = Heartbeats.verifyJournal(bytes, {
      ...pub(f),
      expectedHead: f.store.journal.head(),
    });
    assert.deepEqual(r.devices, f.store.status().devices);
    assert.equal(r.verification.deviceSignaturesVerified, true);
    assert.equal(r.verification.headPinned, true);
    assert.deepEqual(fs.readFileSync(f.store.journal.logPath), bytes);
    assert.deepEqual(fs.readFileSync(f.store.journal.lockPath), lock);
    assert.throws(
      () =>
        Heartbeats.verifyJournal(bytes, {
          ...pub(f),
          signerPublicKey: f.writer.privateKey,
        }),
      /JOURNAL_PUBLIC_KEY_REQUIRED/,
    );
    assert.throws(
      () => Heartbeats.verifyJournal(bytes, { ...pub(f), now: at - 1 }),
      /HEARTBEAT_CLOCK_ROLLBACK/,
    );
  } finally {
    f.cleanup();
  }
});
test("capacity and fsync errors do not confirm new state; complete records recover on restart", () => {
  let fail = false;
  const f = fixture({
    maxActions: 2,
    io: {
      ...fs,
      fsyncSync(fd) {
        if (fail) throw new Error("offline");
        fs.fsyncSync(fd);
      },
    },
  });
  try {
    fail = true;
    assert.throws(() => f.store.accept(f.envelope()), /JOURNAL_UNAVAILABLE/);
    assert.throws(() => f.store.status(), /JOURNAL_UNAVAILABLE/);
    fail = false;
    f.restart();
    assert.equal(f.store.status().devices[0].sequence, 1);
    f.store.accept(f.envelope(2));
    assert.throws(() => f.store.accept(f.envelope(3)), /JOURNAL_CAPACITY/);
    assert.equal(f.store.accept(f.envelope(1)).duplicate, true);
  } finally {
    f.cleanup();
  }
});
test("truncation, tampering, changed thresholds and duplicate device/key registration are rejected", () => {
  const f = fixture();
  try {
    f.store.accept(f.envelope());
    f.store.accept(f.envelope(2));
    const content = fs.readFileSync(f.store.journal.logPath, "utf8"),
      head = f.store.journal.head();
    assert.throws(
      () => Heartbeats.verifyJournal(content + "{}", pub(f)),
      /JOURNAL_INCOMPLETE/,
    );
    assert.throws(() =>
      Heartbeats.verifyJournal(content.replace("1.22.0", "1.20.0"), pub(f)),
    );
    assert.throws(
      () =>
        Heartbeats.verifyJournal(content.split("\n")[0] + "\n", {
          ...pub(f),
          expectedHead: head,
        }),
      /JOURNAL_HEAD_MISMATCH/,
    );
    assert.throws(
      () =>
        Heartbeats.verifyJournal(content, { ...pub(f), lateAfterMs: 500000 }),
      /JOURNAL_ACTION_INVALID/,
    );
    assert.throws(
      () =>
        new Heartbeats({
          ...f.options,
          registrations: [
            f.registration,
            {
              ...f.registration,
              keyId: "other",
              deviceId: crypto.randomUUID(),
            },
          ],
        }),
      /HEARTBEAT_REGISTRY_DUPLICATE_DEVICE_OR_KEY/,
    );
  } finally {
    f.cleanup();
  }
});
test("future client clock cannot extend freshness and old client time ages conservatively", () => {
  const f = fixture();
  try {
    f.store.accept(f.envelope(1, { observedAt: iso(at + 120000) }));
    f.time(at + 600000);
    assert.equal(f.store.status().devices[0].status, "LATE");
    assert.equal(f.store.status().devices[0].ageMs, 600000);
  } finally {
    f.cleanup();
  }
  const old = fixture();
  try {
    old.store.accept(old.envelope(1, { observedAt: iso(at - 120000) }));
    old.time(at + 480000);
    assert.equal(old.store.status().devices[0].status, "LATE");
  } finally {
    old.cleanup();
  }
});
test("even a newly signed writer record cannot conceal an invalid device signature", () => {
  const f = fixture();
  try {
    f.store.accept(f.envelope());
    const record = JSON.parse(fs.readFileSync(f.store.journal.logPath, "utf8"));
    record.payload.data.envelope.signature = "A".repeat(86);
    const forged = signed(
      record.payload,
      f.options.signerKeyId,
      f.writer.privateKey,
    );
    assert.throws(
      () => Heartbeats.verifyJournal(JSON.stringify(forged) + "\n", pub(f)),
      /JOURNAL_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});
test("CLI accepts signed input and verifies with public keys; malformed config never leaks secrets", () => {
  const { spawnSync } = require("node:child_process"),
    f = fixture();
  try {
    f.store.close();
    const file = (name) => path.join(f.root, name),
      now = Date.now();
    fs.writeFileSync(
      file("private.pem"),
      f.writer.privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      file("public.pem"),
      f.writer.publicKey.export({ type: "spki", format: "pem" }),
    );
    fs.writeFileSync(
      file("registry.json"),
      JSON.stringify({ registrations: [f.registration] }),
    );
    const config = {
      schemaVersion: 1,
      organizationId: f.registration.organizationId,
      signerKeyId: f.options.signerKeyId,
      signerPublicKeyFile: file("public.pem"),
      registryFile: file("registry.json"),
      minimumExtensionVersion: "1.22.0",
      lateAfterMs: 600000,
      unknownAfterMs: 1200000,
      maxClockSkewMs: 120000,
    };
    fs.writeFileSync(file("config.json"), JSON.stringify(config));
    fs.writeFileSync(
      file("input.json"),
      JSON.stringify(f.envelope(1, { observedAt: iso(now) })),
    );
    const run = (args) =>
        spawnSync(
          process.execPath,
          ["enterprise/heartbeats_cli.cjs", ...args],
          { encoding: "utf8" },
        ),
      accept = run([
        "accept",
        "--directory",
        f.options.directory,
        "--config",
        file("config.json"),
        "--private-key",
        file("private.pem"),
        "--input",
        file("input.json"),
      ]);
    assert.equal(accept.status, 0, accept.stderr);
    assert.equal(JSON.parse(accept.stdout).duplicate, false);
    const verifyArgs = [
      "verify",
      "--journal",
      path.join(f.options.directory, "actions.jsonl"),
      "--config",
      file("config.json"),
      "--out",
      file("status.json"),
    ];
    assert.equal(run(verifyArgs).status, 0);
    const report = JSON.parse(fs.readFileSync(file("status.json")));
    assert.equal(report.verification.deviceSignaturesVerified, true);
    assert.equal(report.counts.CURRENT, 1);
    assert.equal(fs.statSync(file("status.json")).mode & 0o077, 0);
    assert.notEqual(run(verifyArgs).status, 0);
    fs.unlinkSync(file("status.json"));
    fs.writeFileSync(
      file("config.json"),
      JSON.stringify({ ...config, secret: "SECRET_TOKEN" }),
    );
    const rejected = run(verifyArgs);
    assert.notEqual(rejected.status, 0);
    assert.ok(!rejected.stderr.includes("SECRET_TOKEN"));
  } finally {
    f.cleanup();
  }
});
