"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { summarize, HealthMonitor } = require("../health.cjs");
const { DurableJournal } = require("../durable_journal.cjs");
const at = Date.parse("2026-10-14T10:00:00Z");
const iso = (n) => new Date(n).toISOString();
function input(capturedAt = at) {
  return {
    sourceId: "local-queue",
    capturedAt: iso(capturedAt),
    outbox: {
      counts: { PENDING: 0, RETRY: 1, STAGED: 0, DEAD_LETTER: 1 },
      bytes: 10,
      maxBytes: 100,
      retainedEvents: 2,
      maxEvents: 100,
      oldestQueuedAt: iso(at - 10000),
      errors: [
        {
          error: "DELIVERY_TIMEOUT",
          eventId: "private-id",
          url: "https://secret.example/?token=secret",
        },
        { error: "Secret-token-https://x" },
      ],
    },
    storage: {
      schemaVersion: 1,
      kind: "thundy-storage-jobs-status",
      sealed: false,
      journalBytes: 80,
      maxBytes: 100,
      maxJobs: 100,
      jobs: [
        {
          status: "DEAD_LETTER",
          sealed: false,
          error: "DELIVERY_TIMEOUT",
          nextAttemptAt: null,
          observedRetainUntil: null,
          requestedRetainUntil: iso(at + 1000),
        },
        {
          status: "CLOUD_OBSERVED",
          sealed: false,
          error: null,
          nextAttemptAt: null,
          observedRetainUntil: iso(at - 1),
          requestedRetainUntil: null,
        },
      ],
    },
  };
}
function fixture(extra = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-health-")),
    keys = crypto.generateKeyPairSync("ed25519");
  let now = at;
  const options = {
    directory,
    sourceId: "local-queue",
    signerKeyId: "health",
    signerPrivateKey: keys.privateKey,
    clock: () => now,
    cooldownMs: 1000,
    staleAfterMs: 5000,
    ...extra,
  };
  let monitor = new HealthMonitor(options);
  return {
    directory,
    options,
    get monitor() {
      return monitor;
    },
    time(value) {
      now = value;
    },
    restart() {
      monitor.close();
      monitor = new HealthMonitor(options);
    },
    cleanup() {
      monitor.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
test("health minimizes identity/URLs/secrets, groups errors and marks stale snapshots", () => {
  const report = summarize(input(), at + 6000, { staleAfterMs: 5000 });
  assert.equal(report.stale, true);
  assert.equal(report.heartbeatStatus, "not_measured");
  assert.equal(report.metrics.storage.expiredRetention, 1);
  assert.deepEqual(report.errors, [
    { code: "DELIVERY_TIMEOUT", count: 2 },
    { code: "UNCLASSIFIED_ERROR", count: 1 },
  ]);
  const json = JSON.stringify(report);
  for (const secret of ["secret.example", "private-id", "Secret-token"])
    assert.ok(!json.includes(secret));
  assert.equal(report.sealed, false);
});
test("persistent damping survives restart; identical snapshots do not notify again", () => {
  const f = fixture();
  try {
    const first = f.monitor.observe(input());
    assert.ok(first.notifications.length > 0);
    assert.equal(f.monitor.observe(input()).duplicate, true);
    f.restart();
    f.time(at + 500);
    assert.equal(f.monitor.observe(input(at + 500)).notifications.length, 0);
    f.time(at + 1100);
    const repeat = f.monitor.observe(input(at + 1100));
    assert.ok(repeat.notifications.length > 0);
    assert.ok(repeat.notifications.some((n) => n.repeatedObservations === 1));
  } finally {
    f.cleanup();
  }
});
test("stale transition on identical input notifies once and cannot recover queue fault", () => {
  const f = fixture();
  try {
    f.monitor.observe(input());
    f.time(at + 6000);
    const stale = f.monitor.observe(input());
    assert.deepEqual(
      stale.notifications.map((n) => n.code),
      ["SNAPSHOT_STALE"],
    );
    assert.equal(f.monitor.observe(input()).notifications.length, 0);
    assert.equal(
      f.monitor.journal.snapshot().alerts.OUTBOX_DEAD_LETTER.active,
      true,
    );
    f.time(at + 6100);
    const clean = input(at + 6100);
    clean.outbox.counts = { PENDING: 2, RETRY: 0, STAGED: 0, DEAD_LETTER: 0 };
    f.monitor.observe(clean);
    assert.equal(
      f.monitor.journal.snapshot().alerts.OUTBOX_DEAD_LETTER.active,
      false,
    );
    f.time(at + 6200);
    assert.ok(
      f.monitor
        .observe(input(at + 6200))
        .notifications.some((n) => n.code === "OUTBOX_DEAD_LETTER"),
    );
  } finally {
    f.cleanup();
  }
});
test("reject reversed/conflicting/future snapshots, invalid queue counts and unsupported statuses", () => {
  const f = fixture();
  try {
    f.monitor.observe(input());
    assert.throws(
      () => f.monitor.observe({ ...input(), sourceId: "other" }),
      /HEALTH_SOURCE_MISMATCH/,
    );
    const conflict = input();
    conflict.outbox.bytes = 11;
    assert.throws(
      () => f.monitor.observe(conflict),
      /HEALTH_SNAPSHOT_CONFLICT/,
    );
    assert.throws(
      () => f.monitor.observe(input(at - 1)),
      /HEALTH_SNAPSHOT_REPLAY/,
    );
    assert.throws(
      () => summarize(input(at + 1), at),
      /HEALTH_SNAPSHOT_INVALID/,
    );
    const bad = input();
    bad.outbox.counts.RETRY = -1;
    assert.throws(() => summarize(bad, at));
    bad.outbox = input().outbox;
    bad.storage.jobs[0].status = "SEALED";
    assert.throws(() => summarize(bad, at));
    f.time(at - 1);
    assert.throws(() => f.monitor.observe(input()), /JOURNAL_CLOCK_ROLLBACK/);
  } finally {
    f.cleanup();
  }
});
test("journal fsync failure prevents confirming an alarm; restart recovers signed action", () => {
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
    fail = true;
    assert.throws(() => f.monitor.observe(input()), /JOURNAL_UNAVAILABLE/);
    assert.throws(() => f.monitor.observe(input()), /JOURNAL_UNAVAILABLE/);
    fail = false;
    f.restart();
    assert.equal(f.monitor.observe(input()).duplicate, true);
  } finally {
    f.cleanup();
  }
});
test("exclusive writer, changed configuration, partial tails, tampering and external head are enforced", () => {
  const f = fixture();
  try {
    f.monitor.observe(input());
    assert.throws(() => new HealthMonitor(f.options), /JOURNAL_WRITER_LOCKED/);
    const head = f.monitor.journal.head();
    f.monitor.close();
    assert.throws(
      () => new HealthMonitor({ ...f.options, cooldownMs: 999 }),
      /JOURNAL_ACTION_INVALID/,
    );
    const valid = fs.readFileSync(path.join(f.directory, "actions.jsonl"));
    assert.throws(
      () => new HealthMonitor({ ...f.options, expectedHead: "a".repeat(64) }),
      /JOURNAL_HEAD_MISMATCH/,
    );
    const replay = new HealthMonitor({ ...f.options, expectedHead: head });
    replay.close();
    fs.appendFileSync(path.join(f.directory, "actions.jsonl"), "{}");
    assert.throws(() => new HealthMonitor(f.options), /JOURNAL_INCOMPLETE/);
    fs.writeFileSync(
      path.join(f.directory, "actions.jsonl"),
      valid.toString().replace("OBSERVED", "FORGEDXX"),
    );
    assert.throws(() => new HealthMonitor(f.options), /JOURNAL_INVALID/);
  } finally {
    f.cleanup();
  }
});
test("bounded journal never evicts actions and returns no alarm when full", () => {
  const f = fixture({ maxActions: 1 });
  try {
    f.monitor.observe(input());
    f.time(at + 500);
    assert.throws(() => f.monitor.observe(input(at + 500)), /JOURNAL_CAPACITY/);
    assert.equal(f.monitor.journal.snapshot().lastCapturedAt, iso(at));
  } finally {
    f.cleanup();
  }
});
test("connector queue metrics use aggregate states and never copy artifact IDs or URLs", () => {
  const { collectSnapshot } = require("../health.cjs");
  const status = {
    kind: "thundy-connector-status",
    schemaVersion: 1,
    sealed: false,
    transportEnabled: false,
    journalBytes: 90,
    maxBytes: 100,
    maxJobs: 100,
    jobs: [
      {
        status: "DEAD_LETTER",
        error: "LOCAL_EXPORT_FAILED",
        jobId: "sensitive",
        url: "https://private.example",
      },
    ],
  };
  const snapshot = collectSnapshot({
    sourceId: "local",
    connectors: { status: () => status },
    now: at,
  });
  const report = summarize(snapshot, at);
  assert.equal(report.metrics.connectors.counts.DEAD_LETTER, 1);
  assert.equal(report.metrics.connectors.remoteDeliveryVerified, false);
  assert.ok(!JSON.stringify(report).includes("private.example"));
  assert.ok(!JSON.stringify(report).includes("sensitive"));
});
test("health CLI writes a minimized private report and never overwrites an existing one", () => {
  const { spawnSync } = require("node:child_process");
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "thundy-health-cli-"),
  );
  try {
    const file = (name) => path.join(directory, name),
      source = input(Date.now() - 1000);
    fs.writeFileSync(file("input.json"), JSON.stringify(source));
    const run = () =>
      spawnSync(
        process.execPath,
        [
          "enterprise/health_cli.cjs",
          "report",
          "--input",
          file("input.json"),
          "--out",
          file("report.json"),
        ],
        { encoding: "utf8" },
      );
    assert.equal(run().status, 0);
    const bytes = fs.readFileSync(file("report.json"));
    assert.ok(!bytes.includes("secret.example"));
    assert.equal(fs.statSync(file("report.json")).mode & 0o077, 0);
    assert.notEqual(run().status, 0);
    assert.deepEqual(fs.readFileSync(file("report.json")), bytes);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
for (const language of ["en", "de", "fr", "es", "it", "pl"])
  test(
    language +
      " health HTML is complete, static and minimizes injected details",
    () => {
      const { JSDOM } = require("jsdom"),
        { reviewHtml, labels } = require("../health_review.cjs");
      const report = summarize(input(), at + 600000);
      report.errors.push({
        code: "https://secret.example/?token=SECRET",
        count: 1,
      });
      report.conditions.push({
        code: "<script>SECRET</script>",
        severity: "high",
        count: 1,
      });
      const html = reviewHtml(report, language),
        dom = new JSDOM(html);
      assert.equal(dom.window.document.documentElement.lang, language);
      assert.ok(
        dom.window.document.body.textContent.includes(labels[language].stale),
      );
      assert.ok(!html.includes("SECRET"));
      assert.equal(
        dom.window.document.querySelectorAll("script,iframe,img,link").length,
        0,
      );
      assert.equal(dom.window.document.querySelectorAll("table").length, 3);
      assert.ok(
        dom.window.document
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          .content.includes("default-src 'none'"),
      );
      assert.ok(!html.includes("undefined"));
      dom.window.close();
    },
  );
test("HTML rejects unknown language and unsupported protected-storage claims", () => {
  const { reviewHtml } = require("../health_review.cjs");
  const report = summarize(input(), at);
  assert.throws(() => reviewHtml(report, "xx"), /HEALTH_REVIEW_INVALID/);
  assert.throws(
    () => reviewHtml({ ...report, sealed: true }, "en"),
    /HEALTH_REVIEW_INVALID/,
  );
});
test("lost observe return is recoverable through durable pending IDs and idempotent acknowledgement", () => {
  const f = fixture();
  try {
    const first = f.monitor.observe(input()),
      id = first.notifications[0].notificationId;
    assert.ok(id);
    const original = f.monitor.pending();
    f.restart();
    assert.deepEqual(f.monitor.pending(), original);
    assert.equal(f.monitor.observe(input()).notifications.length, 0);
    const ack = f.monitor.acknowledge(id, { consumerId: "local-collector" });
    assert.equal(ack.duplicate, false);
    const head = f.monitor.journal.head();
    assert.equal(
      f.monitor.acknowledge(id, { consumerId: "local-collector" }).duplicate,
      true,
    );
    assert.equal(f.monitor.journal.head(), head);
    assert.throws(
      () => f.monitor.acknowledge(id, { consumerId: "other" }),
      /HEALTH_ACK_CONFLICT/,
    );
    f.restart();
    assert.ok(!f.monitor.pending().some((n) => n.notificationId === id));
    assert.equal(f.monitor.notificationStatus().acknowledged, 1);
    assert.equal(
      f.monitor.notificationStatus().externalDeliveryVerified,
      false,
    );
  } finally {
    f.cleanup();
  }
});
test("queue capacity rejects entire observation without losing prior candidates or damping state", () => {
  const f = fixture({ maxPending: 1 });
  try {
    const only = {
      ...input(),
      storage: null,
      outbox: {
        ...input().outbox,
        counts: { PENDING: 1, RETRY: 0, STAGED: 0, DEAD_LETTER: 1 },
      },
    };
    const id = f.monitor.observe(only).notifications[0].notificationId,
      head = f.monitor.journal.head();
    f.time(at + 1100);
    const next = { ...only, capturedAt: iso(at + 1100) };
    assert.throws(
      () => f.monitor.observe(next),
      /HEALTH_NOTIFICATION_CAPACITY/,
    );
    assert.equal(f.monitor.journal.head(), head);
    assert.equal(f.monitor.pending().length, 1);
    f.monitor.acknowledge(id, { consumerId: "collector" });
    assert.equal(f.monitor.observe(next).notifications.length, 1);
    assert.notEqual(f.monitor.pending()[0].notificationId, id);
    f.monitor.close();
    assert.throws(
      () => new HealthMonitor({ ...f.options, maxPending: 2 }),
      /HEALTH_DELIVERY_LIMIT_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});
test("ack sync failure never confirms delivery; recovery retains an authenticated terminal acknowledgement", () => {
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
    const id = f.monitor.observe(input()).notifications[0].notificationId;
    fail = true;
    assert.throws(
      () => f.monitor.acknowledge(id, { consumerId: "collector" }),
      /JOURNAL_UNAVAILABLE/,
    );
    assert.throws(() => f.monitor.pending(), /JOURNAL_UNAVAILABLE/);
    fail = false;
    f.restart();
    assert.equal(
      f.monitor.acknowledge(id, { consumerId: "collector" }).duplicate,
      true,
    );
    assert.ok(!f.monitor.pending().some((n) => n.notificationId === id));
  } finally {
    f.cleanup();
  }
});
test("legacy OBSERVED records replay without inventing pending notifications", () => {
  const f = fixture();
  try {
    const source = input(),
      conditions = summarize(source, at).conditions;
    f.monitor.journal.append("OBSERVED", {
      capturedAt: source.capturedAt,
      snapshotHash: require("../ledger.cjs").hash(source),
      conditions,
    });
    f.restart();
    assert.deepEqual(f.monitor.pending(), []);
    assert.equal(f.monitor.notificationStatus().legacyObservations, 1);
    f.time(at + 1100);
    assert.ok(f.monitor.observe(input(at + 1100)).notifications.length > 0);
    f.time(at + 1200);
    assert.throws(
      () =>
        f.monitor.journal.append("OBSERVED", {
          capturedAt: iso(at + 1200),
          snapshotHash: "a".repeat(64),
          conditions,
        }),
      /HEALTH_LEGACY_AFTER_QUEUE/,
    );
  } finally {
    f.cleanup();
  }
});
test("pending is bounded and non-destructive; invalid or unknown acknowledgements never append", () => {
  const f = fixture();
  try {
    f.monitor.observe(input());
    const head = f.monitor.journal.head();
    assert.equal(f.monitor.pending({ limit: 1 }).length, 1);
    assert.equal(f.monitor.journal.head(), head);
    assert.throws(
      () => f.monitor.pending({ limit: 1001 }),
      /HEALTH_PENDING_LIMIT_INVALID/,
    );
    assert.throws(
      () => f.monitor.acknowledge("a".repeat(64), { consumerId: "collector" }),
      /HEALTH_NOTIFICATION_UNKNOWN/,
    );
    assert.throws(
      () =>
        f.monitor.acknowledge(f.monitor.pending()[0].notificationId, {
          consumerId: "https://secret/",
        }),
      /HEALTH_ACK_INVALID/,
    );
    assert.equal(f.monitor.journal.head(), head);
    assert.ok(!JSON.stringify(f.monitor.pending()).includes("secret.example"));
  } finally {
    f.cleanup();
  }
});
test("CLI observe, pending and ack preserve candidates until explicit confirmation", () => {
  const { spawnSync } = require("node:child_process"),
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "thundy-health-delivery-cli-"),
    ),
    keys = crypto.generateKeyPairSync("ed25519");
  try {
    const file = (name) => path.join(directory, name);
    fs.writeFileSync(
      file("key.pem"),
      keys.privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      file("input.json"),
      JSON.stringify(input(Date.now() - 1000)),
    );
    const worker = [
        "--directory",
        file("state"),
        "--key-id",
        "health",
        "--private-key",
        file("key.pem"),
      ],
      run = (command, extra) =>
        spawnSync(
          process.execPath,
          ["enterprise/health_cli.cjs", command, ...worker, ...extra],
          { encoding: "utf8" },
        );
    assert.equal(
      run("observe", [
        "--input",
        file("input.json"),
        "--out",
        file("observation.json"),
      ]).status,
      0,
    );
    assert.equal(
      run("pending", [
        "--source-id",
        "local-queue",
        "--limit",
        "1",
        "--out",
        file("pending.json"),
      ]).status,
      0,
    );
    const n = JSON.parse(fs.readFileSync(file("pending.json")))
      .notifications[0];
    assert.ok(n.notificationId);
    const args = [
      "--source-id",
      "local-queue",
      "--notification-id",
      n.notificationId,
      "--consumer-id",
      "collector",
    ];
    assert.equal(JSON.parse(run("ack", args).stdout).duplicate, false);
    assert.equal(JSON.parse(run("ack", args).stdout).duplicate, true);
    assert.equal(fs.statSync(file("pending.json")).mode & 0o077, 0);
    assert.notEqual(
      run("pending", [
        "--source-id",
        "local-queue",
        "--limit",
        "0",
        "--out",
        file("bad.json"),
      ]).status,
      0,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("later healthy observations or resolved faults never retire pending candidates implicitly", () => {
  const f = fixture();
  try {
    const first = f.monitor.observe(input()),
      ids = first.notifications.map((n) => n.notificationId);
    f.time(at + 500);
    const healthy = input(at + 500);
    healthy.outbox.counts = { PENDING: 2, RETRY: 0, STAGED: 0, DEAD_LETTER: 0 };
    healthy.storage = null;
    f.monitor.observe(healthy);
    assert.deepEqual(
      f.monitor.pending().map((n) => n.notificationId),
      ids,
    );
    f.restart();
    assert.deepEqual(
      f.monitor.pending().map((n) => n.notificationId),
      ids,
    );
  } finally {
    f.cleanup();
  }
});
test("signed but invalid or repeated acknowledgement actions are rejected on replay rules", () => {
  const f = fixture();
  try {
    const id = f.monitor.observe(input()).notifications[0].notificationId;
    const head = f.monitor.journal.head();
    assert.throws(
      () =>
        f.monitor.journal.append("NOTIFICATION_ACKNOWLEDGED", {
          notificationId: "a".repeat(64),
          consumerId: "collector",
        }),
      /HEALTH_ACK_INVALID/,
    );
    assert.equal(f.monitor.journal.head(), head);
    f.monitor.acknowledge(id, { consumerId: "collector" });
    assert.throws(
      () =>
        f.monitor.journal.append("NOTIFICATION_ACKNOWLEDGED", {
          notificationId: id,
          consumerId: "collector",
        }),
      /HEALTH_ACK_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});
