"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process");
const { HeartbeatAlerts } = require("../heartbeat_alerts.cjs"),
  { Heartbeats } = require("../heartbeats.cjs"),
  { signed } = require("../ledger.cjs");
const at = Date.parse("2026-10-15T12:00:00Z"),
  iso = (n) => new Date(n).toISOString();
function fixture(extra = {}) {
  const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "thundy-heartbeat-alerts-"),
    ),
    device = crypto.generateKeyPairSync("ed25519"),
    writer = crypto.generateKeyPairSync("ed25519"),
    alerts = crypto.generateKeyPairSync("ed25519");
  let now = at;
  const registration = {
    keyId: "test-device",
    organizationId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    streamEpoch: crypto.randomUUID(),
    policyId: crypto.randomUUID(),
    policyVersion: 3,
    revoked: false,
    publicKey: device.publicKey.export({ type: "spki", format: "pem" }),
  };
  const source = {
    organizationId: registration.organizationId,
    registrations: [registration],
    minimumExtensionVersion: "1.22.0",
    lateAfterMs: 1000,
    unknownAfterMs: 2000,
    maxClockSkewMs: 100,
    signerKeyId: "heartbeat-writer",
    signerPublicKey: writer.publicKey,
  };
  const { signerPublicKey: unused, ...writerContext } = source;
  void unused;
  const sourceOptions = {
    ...writerContext,
    directory: path.join(root, "source"),
    signerPrivateKey: writer.privateKey,
    clock: () => now,
  };
  const store = new Heartbeats(sourceOptions),
    options = {
      source,
      directory: path.join(root, "alerts"),
      signerKeyId: "alerts-writer",
      signerPrivateKey: alerts.privateKey,
      clock: () => now,
      cooldownMs: 500,
      maxSnapshotAgeMs: 500,
      ...extra,
    };
  let monitor = new HeartbeatAlerts(options);
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
    source,
    sourceOptions,
    options,
    store,
    alerts,
    writer,
    registration,
    envelope,
    get monitor() {
      return monitor;
    },
    time(n) {
      now = n;
    },
    content() {
      return fs.readFileSync(store.journal.logPath, "utf8");
    },
    observe(opts) {
      return monitor.observe(this.content(), opts);
    },
    restart() {
      monitor.close();
      monitor = new HeartbeatAlerts(options);
    },
    pub() {
      return {
        source,
        signerKeyId: options.signerKeyId,
        signerPublicKey: alerts.publicKey,
        cooldownMs: options.cooldownMs,
        maxSnapshotAgeMs: options.maxSnapshotAgeMs,
        ...(options.maxPending === undefined
          ? {}
          : { maxPending: options.maxPending }),
      };
    },
    cleanup() {
      monitor.close();
      store.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
test("never reported is a one-time informational candidate without outage or false recovery", () => {
  const f = fixture();
  try {
    const first = f.observe();
    assert.equal(first.notifications[0].code, "HEARTBEAT_NEVER_SEEN");
    assert.equal(first.notifications[0].firstDetectedAt, null);
    assert.equal(first.notifications[0].lastReceivedAt, null);
    assert.equal(first.notifications[0].sequence, null);
    const head = f.monitor.journal.head();
    assert.equal(f.observe().duplicate, true);
    assert.equal(f.monitor.journal.head(), head);
    f.time(at + 1000);
    assert.equal(f.observe().notifications.length, 0);
    f.store.accept(f.envelope());
    f.time(at + 1001);
    assert.equal(f.observe().notifications.length, 0);
    assert.equal(f.monitor.status().counts.CURRENT, 1);
    assert.equal(f.monitor.pending().length, 1);
  } finally {
    f.cleanup();
  }
});
test("late boundary, cooldown, escalation and recovery persist independently from acknowledgement", () => {
  const f = fixture();
  try {
    f.store.accept(f.envelope());
    assert.equal(f.observe().notifications.length, 0);
    f.time(at + 999);
    assert.equal(f.observe().notifications.length, 0);
    f.time(at + 1000);
    const first = f.observe().notifications[0];
    assert.equal(first.code, "HEARTBEAT_LATE");
    assert.equal(first.firstDetectedAt, iso(at + 1000));
    assert.equal(first.lastReceivedAt, iso(at));
    f.time(at + 1499);
    assert.equal(f.observe().notifications.length, 0);
    f.time(at + 1500);
    assert.equal(f.observe().notifications[0].code, "HEARTBEAT_LATE");
    f.time(at + 1999);
    assert.equal(f.observe().notifications.length, 0);
    f.time(at + 2000);
    const unknown = f.observe().notifications[0];
    assert.equal(unknown.code, "HEARTBEAT_UNKNOWN");
    assert.equal(unknown.severity, "high");
    assert.equal(unknown.firstDetectedAt, first.firstDetectedAt);
    f.restart();
    assert.equal(f.monitor.pending().length, 3);
    f.time(at + 2001);
    f.store.accept(f.envelope(2));
    const recovery = f.observe().notifications[0];
    assert.equal(recovery.code, "HEARTBEAT_RECOVERED");
    assert.equal(recovery.firstDetectedAt, first.firstDetectedAt);
    assert.equal(recovery.sequence, 2);
    assert.equal(f.monitor.pending().length, 4);
    f.monitor.acknowledge(first.notificationId, { consumerId: "collector" });
    assert.equal(f.monitor.pending().length, 3);
    f.restart();
    assert.equal(
      f.monitor.acknowledge(first.notificationId, { consumerId: "collector" })
        .duplicate,
      true,
    );
    assert.throws(
      () =>
        f.monitor.acknowledge(first.notificationId, { consumerId: "other" }),
      /ACK_CONFLICT/,
    );
    assert.equal(f.monitor.status().acknowledged, 1);
  } finally {
    f.cleanup();
  }
});
test("stale/future/equal-time conflicting snapshots and backward evaluations cannot mutate state", () => {
  const f = fixture();
  try {
    f.store.accept(f.envelope());
    f.observe();
    const head = f.monitor.journal.head();
    f.time(at + 501);
    assert.throws(
      () => f.observe({ evaluatedAt: iso(at) }),
      /SNAPSHOT_STALE_OR_FUTURE/,
    );
    assert.throws(
      () => f.observe({ evaluatedAt: iso(at + 502) }),
      /SNAPSHOT_STALE_OR_FUTURE/,
    );
    assert.throws(
      () => f.observe({ evaluatedAt: iso(at - 1) }),
      /SNAPSHOT_STALE_OR_FUTURE/,
    );
    assert.throws(
      () => f.observe({ expectedSourceHead: "0".repeat(64) }),
      /HEAD_MISMATCH/,
    );
    assert.equal(f.monitor.journal.head(), head);
    f.store.accept(f.envelope(2));
    assert.throws(
      () => f.observe({ evaluatedAt: iso(at + 1) }),
      /CLOCK_ROLLBACK/,
    );
    f.observe();
    const nextHead = f.monitor.journal.head();
    f.time(at + 502);
    f.store.accept(f.envelope(3));
    assert.throws(
      () => f.observe({ evaluatedAt: iso(at + 501) }),
      /CLOCK_ROLLBACK/,
    );
    assert.equal(f.monitor.journal.head(), nextHead);
  } finally {
    f.cleanup();
  }
});
test("valid source prefix and valid alternate branch cannot replace processed history", () => {
  const f = fixture();
  let alternate;
  try {
    f.store.accept(f.envelope());
    const prefix = f.content();
    f.time(at + 1);
    f.store.accept(f.envelope(2));
    f.observe();
    f.time(at + 2);
    assert.throws(() => f.monitor.observe(prefix), /SOURCE_ROLLBACK/);
    alternate = new Heartbeats({
      ...f.sourceOptions,
      directory: path.join(f.root, "alternate"),
    });
    alternate.accept(f.envelope(1, { brokerReady: false }));
    alternate.accept(f.envelope(2));
    alternate.accept(f.envelope(3));
    const branch = fs.readFileSync(alternate.journal.logPath);
    Heartbeats.verifyJournal(branch, { ...f.source, now: at + 2 });
    assert.throws(() => f.monitor.observe(branch), /SOURCE_ROLLBACK/);
  } finally {
    alternate?.close();
    f.cleanup();
  }
});
test("source tampering, unsigned report imports and changed trust or thresholds are rejected", () => {
  const f = fixture();
  try {
    f.store.accept(f.envelope());
    assert.throws(
      () => f.monitor.observe(f.content().replace("1.22.0", "1.20.0")),
      /JOURNAL/,
    );
    assert.throws(
      () => f.monitor.observe(JSON.stringify(f.store.status()) + "\n"),
      /JOURNAL/,
    );
    f.observe();
    const content = fs.readFileSync(f.monitor.journal.logPath);
    assert.throws(
      () =>
        HeartbeatAlerts.verifyJournal(content, {
          ...f.pub(),
          source: { ...f.source, lateAfterMs: 1100 },
        }),
      /JOURNAL_ACTION_INVALID/,
    );
    assert.throws(
      () =>
        HeartbeatAlerts.verifyJournal(content, { ...f.pub(), cooldownMs: 600 }),
      /JOURNAL_ACTION_INVALID/,
    );
    assert.throws(
      () =>
        HeartbeatAlerts.verifyJournal(content, {
          ...f.pub(),
          signerPublicKey: crypto.generateKeyPairSync("ed25519").publicKey,
        }),
      /JOURNAL/,
    );
    assert.equal(f.monitor.pending().length, 0);
  } finally {
    f.cleanup();
  }
});
test("observation and candidates recover after fsync failure without a false success", () => {
  let fail = false;
  const io = {
      ...fs,
      fsyncSync(fd) {
        if (fail) throw new Error("disk");
        fs.fsyncSync(fd);
      },
    },
    f = fixture({ io });
  try {
    fail = true;
    assert.throws(() => f.observe(), /JOURNAL_UNAVAILABLE/);
    assert.throws(() => f.monitor.pending(), /JOURNAL_UNAVAILABLE/);
    fail = false;
    f.restart();
    const n = f.monitor.pending()[0];
    assert.equal(n.code, "HEARTBEAT_NEVER_SEEN");
    assert.equal(f.observe().duplicate, true);
    fail = true;
    assert.throws(
      () =>
        f.monitor.acknowledge(n.notificationId, { consumerId: "collector" }),
      /JOURNAL_UNAVAILABLE/,
    );
    fail = false;
    f.restart();
    assert.equal(f.monitor.pending().length, 0);
    assert.equal(
      f.monitor.acknowledge(n.notificationId, { consumerId: "collector" })
        .duplicate,
      true,
    );
  } finally {
    f.cleanup();
  }
});
test("capacity rejection is atomic and acknowledgement frees pending capacity", () => {
  const f = fixture({ maxPending: 1 });
  try {
    f.observe();
    f.time(at + 1);
    f.store.accept(f.envelope());
    f.observe();
    f.time(at + 1001);
    const head = f.monitor.journal.head();
    assert.throws(() => f.observe(), /HEARTBEAT_ALERT_CAPACITY/);
    assert.equal(f.monitor.journal.head(), head);
    assert.equal(f.monitor.status().counts.CURRENT, 1);
    const n = f.monitor.pending()[0];
    f.monitor.acknowledge(n.notificationId, { consumerId: "collector" });
    assert.equal(f.observe().notifications[0].code, "HEARTBEAT_LATE");
    assert.equal(f.monitor.pending().length, 1);
  } finally {
    f.cleanup();
  }
});
test("public reader verifies monitor history while writer stays active, pins head and exposes proof limits", () => {
  const f = fixture();
  try {
    f.observe();
    const head = f.monitor.journal.head(),
      before = fs.readFileSync(f.monitor.journal.logPath);
    let report = HeartbeatAlerts.verifyJournal(before, {
      ...f.pub(),
      expectedHead: head,
    });
    assert.equal(report.pending, 1);
    assert.equal(report.verification.sourceDeviceEvidenceReverified, false);
    assert.equal(report.verification.headPinned, true);
    assert.equal(report.externalDeliveryVerified, false);
    assert.deepEqual(report.notifications, f.monitor.pending());
    assert.deepEqual(fs.readFileSync(f.monitor.journal.logPath), before);
    const n = f.monitor.pending()[0];
    f.monitor.acknowledge(n.notificationId, { consumerId: "collector" });
    const all = fs.readFileSync(f.monitor.journal.logPath);
    assert.throws(
      () =>
        HeartbeatAlerts.verifyJournal(before, {
          ...f.pub(),
          expectedHead: f.monitor.journal.head(),
        }),
      /HEAD_MISMATCH/,
    );
    assert.throws(
      () => HeartbeatAlerts.verifyJournal(all.toString() + "{}", f.pub()),
      /INCOMPLETE/,
    );
    assert.throws(
      () =>
        HeartbeatAlerts.verifyJournal(
          all.toString().replace("collector", "intruder"),
          f.pub(),
        ),
      /JOURNAL/,
    );
    report = HeartbeatAlerts.verifyJournal(all, f.pub());
    assert.equal(report.acknowledged, 1);
  } finally {
    f.cleanup();
  }
});
test("revoked registrations emit no missing-device alerts and configuration/ack limits are strict", () => {
  const f = fixture();
  try {
    const source = {
      ...f.source,
      registrations: [{ ...f.registration, revoked: true }],
    };
    const m = new HeartbeatAlerts({
      ...f.options,
      source,
      directory: path.join(f.root, "revoked"),
    });
    try {
      assert.equal(m.observe("").notifications.length, 0);
      assert.equal(m.status().counts.REVOKED, 1);
    } finally {
      m.close();
    }
    assert.throws(() => f.monitor.pending({ limit: 0 }), /LIMIT_INVALID/);
    assert.throws(
      () => f.monitor.acknowledge("0".repeat(64), { consumerId: "collector" }),
      /NOTIFICATION_UNKNOWN/,
    );
    assert.throws(
      () => new HeartbeatAlerts({ ...f.options, cooldownMs: 0 }),
      /CONFIG_INVALID/,
    );
    assert.throws(
      () => f.monitor.observe("", { expectedSourceHead: "invalid" }),
      /HEAD_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});
test("signed but semantically invalid monitor actions are rejected on independent replay", () => {
  const f = fixture();
  try {
    f.observe();
    const record = JSON.parse(
      fs.readFileSync(f.monitor.journal.logPath, "utf8"),
    );
    record.payload.data.devices[0].status = "UNKNOWN";
    const forged = signed(
      record.payload,
      f.options.signerKeyId,
      f.alerts.privateKey,
    );
    assert.throws(
      () =>
        HeartbeatAlerts.verifyJournal(JSON.stringify(forged) + "\n", f.pub()),
      /DEVICE_REPLAY/,
    );
  } finally {
    f.cleanup();
  }
});
test("equal evaluation conflicts, time rollback and journal capacity leave previous candidates unchanged", () => {
  const f = fixture({ maxActions: 3 });
  try {
    assert.equal(f.monitor.status().notEvaluatedDevices, 1);
    f.store.accept(f.envelope());
    f.observe();
    assert.equal(f.monitor.status().notEvaluatedDevices, 0);
    assert.equal(f.monitor.status().registeredDevices, 1);
    assert.throws(
      () => f.observe({ expectedSourceHead: f.store.journal.head() }),
      /SNAPSHOT_CONFLICT/,
    );
    f.store.accept(f.envelope(2));
    assert.throws(() => f.observe(), /SNAPSHOT_CONFLICT/);
    f.time(at + 100);
    f.observe();
    f.time(at + 101);
    assert.throws(
      () => f.observe({ evaluatedAt: iso(at + 99) }),
      /EVALUATION_REPLAY/,
    );
    f.time(at + 200);
    f.observe();
    f.time(at + 300);
    assert.throws(() => f.observe(), /JOURNAL_CAPACITY/);
    assert.equal(f.monitor.pending().length, 0);
    f.time(at + 99);
    assert.throws(() => f.monitor.pending(), /CLOCK_ROLLBACK/);
  } finally {
    f.cleanup();
  }
});
test("CLI observe/pending/ack/public verify protect files, preserve source and sanitize failures", () => {
  const f = fixture();
  try {
    f.time(Date.now() - 1000);
    f.store.accept(f.envelope());
    f.monitor.close();
    const file = (n) => path.join(f.root, n);
    fs.writeFileSync(
      file("source-public.pem"),
      f.writer.publicKey.export({ type: "spki", format: "pem" }),
    );
    fs.writeFileSync(
      file("alerts-public.pem"),
      f.alerts.publicKey.export({ type: "spki", format: "pem" }),
    );
    fs.writeFileSync(
      file("alerts-private.pem"),
      f.alerts.privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      file("registry.json"),
      JSON.stringify({ registrations: f.source.registrations }),
    );
    const {
      registrations: unused,
      signerPublicKey: unusedKey,
      ...source
    } = f.source;
    void unused;
    void unusedKey;
    fs.writeFileSync(
      file("source-config.json"),
      JSON.stringify({
        schemaVersion: 1,
        ...source,
        registryFile: file("registry.json"),
        signerPublicKeyFile: file("source-public.pem"),
      }),
    );
    fs.writeFileSync(
      file("alerts-config.json"),
      JSON.stringify({
        schemaVersion: 1,
        signerKeyId: f.options.signerKeyId,
        signerPublicKeyFile: file("alerts-public.pem"),
        heartbeatConfigFile: file("source-config.json"),
        cooldownMs: 500,
        maxSnapshotAgeMs: 500,
        maxPending: 1000,
      }),
    );
    const run = (command, ...args) =>
      spawnSync(
        process.execPath,
        [
          "enterprise/heartbeat_alerts_cli.cjs",
          command,
          "--config",
          file("alerts-config.json"),
          ...(command === "verify"
            ? []
            : [
                "--directory",
                f.options.directory,
                "--private-key",
                file("alerts-private.pem"),
              ]),
          ...args,
        ],
        { encoding: "utf8" },
      );
    const before = fs.readFileSync(f.store.journal.logPath);
    let r = run(
      "observe",
      "--journal",
      f.store.journal.logPath,
      "--expected-source-head",
      f.store.journal.head(),
      "--out",
      file("observation.json"),
    );
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(fs.readFileSync(file("observation.json")));
    assert.equal(report.notifications.length, 1);
    assert.equal(report.notifications[0].sourceHeadPinned, true);
    assert.equal(fs.statSync(file("observation.json")).mode & 0o777, 0o600);
    const monitorJournal = path.join(f.options.directory, "actions.jsonl"),
      original = fs.readFileSync(monitorJournal);
    assert.equal(
      run(
        "observe",
        "--journal",
        f.store.journal.logPath,
        "--out",
        file("observation.json"),
      ).status,
      1,
    );
    assert.deepEqual(fs.readFileSync(monitorJournal), original);
    assert.equal(
      run("pending", "--limit", "1", "--out", file("pending.json")).status,
      0,
    );
    const n = JSON.parse(fs.readFileSync(file("pending.json")))
      .notifications[0];
    assert.equal(n.notificationId, report.notifications[0].notificationId);
    assert.equal(
      run(
        "ack",
        "--notification-id",
        n.notificationId,
        "--consumer-id",
        "collector",
      ).status,
      0,
    );
    assert.equal(
      JSON.parse(
        run(
          "ack",
          "--notification-id",
          n.notificationId,
          "--consumer-id",
          "collector",
        ).stdout,
      ).duplicate,
      true,
    );
    assert.equal(
      run(
        "ack",
        "--notification-id",
        n.notificationId,
        "--consumer-id",
        "other",
      ).status,
      1,
    );
    assert.equal(
      run("verify", "--journal", monitorJournal, "--out", file("verified.json"))
        .status,
      0,
    );
    const verified = JSON.parse(fs.readFileSync(file("verified.json")));
    assert.equal(verified.acknowledged, 1);
    assert.equal(verified.verification.sourceDeviceEvidenceReverified, false);
    assert.deepEqual(fs.readFileSync(f.store.journal.logPath), before);
    assert.equal(
      run("pending", "--limit", "0", "--out", file("bad.json")).status,
      1,
    );
    assert.equal(
      run(
        "pending",
        "--expected-head",
        "0".repeat(64),
        "--out",
        file("bad.json"),
      ).status,
      1,
    );
    assert.ok(!fs.existsSync(file("bad.json")));
    fs.chmodSync(file("alerts-private.pem"), 0o644);
    assert.equal(run("pending", "--out", file("bad.json")).status, 1);
    fs.chmodSync(file("alerts-private.pem"), 0o600);
    fs.writeFileSync(
      file("alerts-private.pem"),
      f.writer.privateKey.export({ type: "pkcs8", format: "pem" }),
    );
    assert.equal(run("pending", "--out", file("bad.json")).status, 1);
    assert.ok(!fs.existsSync(file("bad.json")));
    fs.writeFileSync(
      file("alerts-config.json"),
      '{"secret":"SECRET_SENTINEL"}',
    );
    r = run("pending", "--out", file("bad.json"));
    assert.equal(r.status, 1);
    assert.ok(!r.stderr.includes("SECRET_SENTINEL"));
  } finally {
    f.cleanup();
  }
});
test("constructor trust context is copied and device candidates are atomic across a registry", () => {
  const f = fixture();
  let store, monitor;
  try {
    f.store.accept(f.envelope());
    f.observe();
    f.source.lateAfterMs = 1;
    f.source.registrations[0].revoked = true;
    f.time(at + 1);
    assert.equal(f.observe().notifications.length, 0);
    assert.equal(f.monitor.status().counts.CURRENT, 1);
    f.source.lateAfterMs = 1000;
    f.source.registrations[0].revoked = false;
    const secondKey = crypto.generateKeyPairSync("ed25519"),
      second = {
        ...f.registration,
        keyId: "second-device",
        deviceId: crypto.randomUUID(),
        publicKey: secondKey.publicKey.export({ type: "spki", format: "pem" }),
      },
      registrations = [f.registration, second],
      source = { ...f.source, registrations };
    store = new Heartbeats({
      ...f.sourceOptions,
      registrations,
      directory: path.join(f.root, "two-source"),
    });
    monitor = new HeartbeatAlerts({
      ...f.options,
      source,
      maxPending: 1,
      directory: path.join(f.root, "two-alerts"),
    });
    const content = () => fs.readFileSync(store.journal.logPath);
    assert.throws(() => monitor.observe(content()), /CAPACITY/);
    assert.equal(monitor.journal.head(), null);
    assert.equal(monitor.pending().length, 0);
    assert.equal(monitor.status().notEvaluatedDevices, 2);
    store.accept(f.envelope());
    const report = monitor.observe(content());
    assert.equal(report.notifications.length, 1);
    assert.equal(report.notifications[0].deviceId, second.deviceId);
    assert.equal(report.notifications[0].firstDetectedAt, null);
    assert.equal(report.counts.CURRENT, 1);
    assert.equal(report.counts.NEVER_SEEN, 1);
    monitor.acknowledge(report.notifications[0].notificationId, {
      consumerId: "collector",
    });
    f.time(at + 1001);
    const late = monitor.observe(content());
    assert.equal(late.notifications.length, 1);
    assert.equal(late.notifications[0].deviceId, f.registration.deviceId);
    assert.equal(late.notifications[0].code, "HEARTBEAT_LATE");
  } finally {
    monitor?.close();
    store?.close();
    f.cleanup();
  }
});
