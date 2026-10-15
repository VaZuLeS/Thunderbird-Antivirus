"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process"),
  { JSDOM } = require("jsdom");
const { fixture } = require("./alert-review-fixtures.cjs"),
  { CapacityAlerts } = require("../capacity_alerts.cjs"),
  { createPackage } = require("../review_package.cjs"),
  { reviewHtml, words } = require("../capacity_alerts_review.cjs");
const alarm = (f) => fs.readFileSync(f.journal),
  source = (f) => fs.readFileSync(f.store.journal.logPath),
  sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
function make({ warning = true, ...options } = {}) {
  const f = fixture(true, { maxPending: 5 });
  if (warning) {
    f.monitor.observe(source(f));
    f.advance(1);
    f.accept(1);
    f.monitor.observe(source(f));
    f.advance(1000);
    f.monitor.observe(source(f));
    f.advance(1000);
    f.monitor.observe(source(f));
  }
  let now = f.monitor.journal.now();
  const keys = crypto.generateKeyPairSync("ed25519"),
    directory = path.join(f.root, "capacity"),
    policy = {
      trustedContext: f.pub,
      warningPercent: 80,
      recoveryPercent: 70,
      cooldownMs: 1000,
      maxPending: 100,
      ...options,
    },
    writer = {
      ...policy,
      directory,
      signerKeyId: "capacity-writer",
      signerPrivateKey: keys.privateKey,
      clock: () => now,
    },
    verifier = {
      ...policy,
      signerKeyId: "capacity-writer",
      signerPublicKey: keys.publicKey,
    };
  let monitor = new CapacityAlerts(writer);
  return {
    f,
    keys,
    directory,
    policy,
    writer,
    verifier,
    get monitor() {
      return monitor;
    },
    observe(o) {
      return monitor.observeJournals(alarm(f), source(f), o);
    },
    advance(ms = 1) {
      now += ms;
      f.advance(ms);
    },
    reopen() {
      monitor.close();
      monitor = new CapacityAlerts(writer);
      return monitor;
    },
    content() {
      return fs.readFileSync(monitor.journal.logPath);
    },
    cleanup() {
      monitor.close();
      f.cleanup();
    },
  };
}
test("verified warning persists pending through restart and public-key replay; ACK is explicit and idempotent", () => {
  const x = make();
  try {
    const beforeA = alarm(x.f),
      beforeS = source(x.f),
      r = x.observe(),
      n = r.notifications[0];
    assert.equal(n.metric.id, "pending");
    assert.equal(n.transition, "RAISED");
    assert.equal(n.metric.used, 4);
    assert.equal(n.metric.limit, 5);
    assert.equal(n.status, "PENDING");
    assert.equal(n.inputHashes.alarm, sha(beforeA));
    assert.equal(r.originalEvidenceReverified, true);
    const head = r.journalHead;
    x.reopen();
    assert.deepEqual(x.monitor.pending(), [n]);
    const v = CapacityAlerts.verifyJournal(x.content(), {
      ...x.verifier,
      expectedHead: head,
    });
    assert.equal(v.verification.headPinned, true);
    assert.equal(v.originalEvidenceReverified, false);
    assert.deepEqual(v.notifications, [n]);
    assert.equal(v.externalDeliveryVerified, false);
    assert.equal(v.sealed, false);
    assert.equal(
      x.monitor.acknowledge(n.notificationId, { consumerId: "local-admin" })
        .duplicate,
      false,
    );
    assert.equal(
      x.monitor.acknowledge(n.notificationId, { consumerId: "local-admin" })
        .duplicate,
      true,
    );
    assert.throws(
      () =>
        x.monitor.acknowledge(n.notificationId, { consumerId: "other-admin" }),
      /ACK_CONFLICT/,
    );
    x.reopen();
    assert.equal(x.monitor.pending().length, 0);
    assert.equal(x.monitor.status().acknowledged, 1);
    assert.deepEqual(alarm(x.f), beforeA);
    assert.deepEqual(source(x.f), beforeS);
  } finally {
    x.cleanup();
  }
});
test("duplicate observations do not append; reminders retain suppression counts and survive restart", () => {
  const x = make();
  try {
    x.observe();
    const first = x.content();
    assert.equal(x.observe().duplicate, true);
    assert.deepEqual(x.content(), first);
    x.advance(1);
    assert.equal(x.observe().notifications.length, 0);
    x.reopen();
    x.advance(999);
    const r = x.observe();
    assert.equal(r.notifications[0].transition, "REMINDER");
    assert.equal(r.notifications[0].suppressedObservations, 1);
    assert.equal(r.pending, 2);
  } finally {
    x.cleanup();
  }
});
test("100 percent escalates immediately; below-warning hysteresis waits for real measured recovery and can rearm", () => {
  const x = make();
  try {
    x.observe();
    x.advance();
    x.f.accept(2);
    x.f.monitor.observe(source(x.f));
    assert.equal(x.observe().notifications[0].transition, "ESCALATED");
    x.f.monitor.acknowledge(x.f.monitor.pending()[0].notificationId, {
      consumerId: "collector",
    });
    x.advance();
    assert.equal(x.observe().notifications.length, 0); // 80%, still active
    x.f.monitor.acknowledge(x.f.monitor.pending()[0].notificationId, {
      consumerId: "collector",
    });
    x.advance();
    const recovered = x.observe().notifications[0];
    assert.equal(recovered.transition, "RECOVERED");
    assert.equal(recovered.metric.used, 3);
    assert.equal(x.monitor.status().pending, 3);
    assert.equal(
      x.monitor.status().metrics.find((m) => m.metric.id === "pending").active,
      false,
    );
    x.advance(1000);
    x.f.monitor.observe(source(x.f));
    assert.equal(x.observe().notifications[0].transition, "RAISED");
  } finally {
    x.cleanup();
  }
});
test("hysteresis band does not announce a recovery until the configured boundary is reached", () => {
  const x = make({ warningPercent: 80, recoveryPercent: 50 });
  try {
    x.observe();
    x.f.monitor.acknowledge(x.f.monitor.pending()[0].notificationId, {
      consumerId: "collector",
    });
    x.advance();
    assert.equal(x.observe().notifications.length, 0); // 60%, below warning but above recovery
    assert.equal(
      x.monitor.status().metrics.find((m) => m.metric.id === "pending").active,
      true,
    );
    x.f.monitor.acknowledge(x.f.monitor.pending()[0].notificationId, {
      consumerId: "collector",
    });
    x.advance();
    assert.equal(x.observe().notifications[0].transition, "RECOVERED");
  } finally {
    x.cleanup();
  }
});
test("full candidate queue rejects the whole observation, preserves bytes and retries after explicit ACK", () => {
  const x = make({ maxPending: 1 });
  try {
    const n = x.observe().notifications[0],
      before = x.content(),
      state = x.monitor.status();
    x.advance();
    x.f.accept(2);
    x.f.monitor.observe(source(x.f));
    assert.throws(() => x.observe(), /NOTIFICATION_CAPACITY/);
    assert.deepEqual(x.content(), before);
    assert.deepEqual(x.monitor.status(), state);
    x.monitor.acknowledge(n.notificationId, { consumerId: "collector" });
    assert.equal(x.observe().notifications[0].transition, "ESCALATED");
    assert.equal(x.monitor.status().acknowledged, 1);
  } finally {
    x.cleanup();
  }
});
test("raw journal and package observations share source continuity; missing package sizes stay unmeasured", () => {
  const x = make();
  try {
    const bundle = createPackage(alarm(x.f), source(x.f), {
      trustedContext: x.f.pub,
    });
    const r = x.monitor.observePackage(bundle, {
      expectedPackageHash: sha(bundle),
      expectedHead: x.f.monitor.journal.head(),
      expectedSourceHead: x.f.store.journal.head(),
    });
    assert.equal(r.notifications[0].pins.package, true);
    assert.equal(r.lastObservation.report.inputKind, "package");
    assert.equal(r.lastObservation.report.totals.not_measured, 0);
    x.advance();
    const raw = x.observe();
    assert.equal(raw.lastObservation.report.totals.not_measured, 2);
    assert.equal(raw.lastObservation.report.metrics[7].used, null);
    assert.equal(raw.notifications.length, 0);
    assert.throws(
      () =>
        x.monitor.observePackage(bundle, {
          expectedPackageHash: "0".repeat(64),
        }),
      /HASH_MISMATCH/,
    );
    const v = CapacityAlerts.verifyJournal(x.content(), x.verifier);
    assert.equal(v.lastObservation.report.inputKind, "journals");
  } finally {
    x.cleanup();
  }
});
test("an unprovided package measurement cannot recover an active package-context warning", () => {
  const x = make({ warning: false });
  let monitor;
  try {
    const registrations = [...x.f.pub.source.registrations];
    while (registrations.length < 70) {
      const keys = crypto.generateKeyPairSync("ed25519");
      registrations.push({
        ...registrations[0],
        keyId: "extra-" + registrations.length,
        deviceId: crypto.randomUUID(),
        publicKey: keys.publicKey.export({ type: "spki", format: "pem" }),
      });
    }
    const trustedContext = {
      ...x.f.pub,
      source: { ...x.f.pub.source, registrations },
    };
    monitor = new CapacityAlerts({
      ...x.writer,
      directory: path.join(x.f.root, "package-warning"),
      trustedContext,
      warningPercent: 1,
      recoveryPercent: 0,
    });
    const bundle = createPackage("", "", { trustedContext });
    const raised = monitor.observePackage(bundle);
    assert.ok(
      raised.notifications.some(
        (n) =>
          n.metric.id === "public_context_bytes" && n.transition === "RAISED",
      ),
    );
    x.advance(1000);
    const raw = monitor.observeJournals("", "");
    assert.equal(raw.notifications.length, 0);
    assert.equal(
      raw.metrics.find((m) => m.metric.id === "public_context_bytes").active,
      true,
    );
    assert.equal(raw.lastObservation.report.metrics[8].used, null);
    x.advance(1000);
    const repeat = monitor.observePackage(bundle);
    assert.ok(
      repeat.notifications.some(
        (n) =>
          n.metric.id === "public_context_bytes" && n.transition === "REMINDER",
      ),
    );
    assert.ok(!repeat.notifications.some((n) => n.transition === "RECOVERED"));
  } finally {
    monitor?.close();
    x.cleanup();
  }
});
test("recovery occurs exactly at the configured integer percentage boundary", () => {
  const x = make({ recoveryPercent: 60 });
  try {
    x.observe();
    x.f.monitor.acknowledge(x.f.monitor.pending()[0].notificationId, {
      consumerId: "collector",
    });
    x.advance();
    const r = x.observe();
    assert.equal(r.notifications[0].metric.used, 3);
    assert.equal(r.notifications[0].transition, "RECOVERED");
  } finally {
    x.cleanup();
  }
});
test("minimized signed journal never includes device registry, private keys, URLs or paths", () => {
  const x = make();
  try {
    x.observe();
    const text = x.content().toString();
    assert.ok(!text.includes(x.f.root));
    assert.ok(!text.includes("PRIVATE KEY"));
    assert.ok(!text.includes("http"));
    for (const d of x.f.pub.source.registrations) {
      assert.ok(!text.includes(d.deviceId));
      assert.ok(!text.includes(d.publicKey));
    }
  } finally {
    x.cleanup();
  }
});
test("tampering, reports as evidence, wrong pins and valid reformatted source prefixes do not mutate state", () => {
  const x = make();
  try {
    x.observe();
    const before = x.content();
    x.advance();
    assert.throws(
      () =>
        x.monitor.observeJournals(
          JSON.stringify(x.monitor.status()),
          source(x.f),
        ),
      /JOURNAL/,
    );
    assert.throws(
      () => x.observe({ expectedHead: "0".repeat(64) }),
      /HEAD_MISMATCH/,
    );
    assert.throws(
      () =>
        x.monitor.observeJournals(
          alarm(x.f),
          source(x.f).toString().replace("1.22.0", "1.20.0"),
        ),
      /JOURNAL/,
    );
    assert.throws(
      () => x.monitor.observeJournals(alarm(x.f), ""),
      /PREFIX_MISSING/,
    );
    assert.throws(
      () =>
        x.monitor.observeJournals(
          alarm(x.f)
            .toString()
            .replaceAll('"schemaVersion":1', '"schemaVersion": 1'),
          source(x.f),
        ),
      /SOURCE_ROLLBACK/,
    );
    assert.throws(() => x.monitor.observeJournals("", ""), /SOURCE_ROLLBACK/);
    assert.deepEqual(x.content(), before);
    const corrupt = before.toString().replace('"used":4', '"used":3');
    assert.notEqual(corrupt, before.toString());
    assert.throws(
      () => CapacityAlerts.verifyJournal(corrupt, x.verifier),
      /SIGNATURE|JOURNAL/,
    );
  } finally {
    x.cleanup();
  }
});
test("configuration and source context are scope-bound; writer lock, external head and clock rollback fail closed", () => {
  const x = make();
  try {
    x.observe();
    assert.throws(() => new CapacityAlerts(x.writer), /WRITER_LOCKED/);
    assert.throws(
      () =>
        CapacityAlerts.verifyJournal(x.content(), {
          ...x.verifier,
          warningPercent: 81,
        }),
      /JOURNAL_ACTION_INVALID/,
    );
    assert.throws(
      () =>
        CapacityAlerts.verifyJournal(x.content(), {
          ...x.verifier,
          maxPending: 99,
        }),
      /JOURNAL_ACTION_INVALID/,
    );
    assert.throws(
      () =>
        CapacityAlerts.verifyJournal(x.content(), {
          ...x.verifier,
          expectedHead: "0".repeat(64),
        }),
      /HEAD_MISMATCH/,
    );
    const changed = { ...x.f.pub, maxPending: 6 };
    assert.throws(
      () =>
        CapacityAlerts.verifyJournal(x.content(), {
          ...x.verifier,
          trustedContext: changed,
        }),
      /JOURNAL_ACTION_INVALID/,
    );
    x.advance(-1);
    assert.throws(() => x.observe(), /CLOCK_ROLLBACK/);
  } finally {
    x.cleanup();
  }
});
test("incomplete tail is rejected on restart; readers do not change source bytes or writer locks", () => {
  const x = make();
  try {
    x.observe();
    const before = x.content(),
      lock = fs.readFileSync(x.monitor.journal.lockPath);
    CapacityAlerts.verifyJournal(before, x.verifier);
    assert.deepEqual(x.content(), before);
    assert.deepEqual(fs.readFileSync(x.monitor.journal.lockPath), lock);
    assert.throws(
      () =>
        CapacityAlerts.verifyJournal(
          before.subarray(0, before.length - 1),
          x.verifier,
        ),
      /INCOMPLETE/,
    );
    const file = x.monitor.journal.logPath;
    x.monitor.close();
    fs.appendFileSync(file, "{");
    assert.throws(() => new CapacityAlerts(x.writer), /INCOMPLETE/);
    assert.ok(!fs.existsSync(path.join(x.directory, "writer.lock")));
  } finally {
    x.cleanup();
  }
});
test("journal writer failure poisons the monitor and does not emit an uncommitted candidate", () => {
  const x = make();
  try {
    let calls = 0;
    x.monitor.journal.io = {
      ...fs,
      writeSync(fd, b, offset, length) {
        if (calls++) throw new Error("disk failure");
        return fs.writeSync(fd, b, offset, Math.floor(length / 2));
      },
    };
    assert.throws(() => x.observe(), /JOURNAL_UNAVAILABLE/);
    assert.throws(() => x.monitor.pending(), /JOURNAL_UNAVAILABLE/);
    const file = x.monitor.journal.logPath;
    x.monitor.close();
    assert.ok(fs.statSync(file).size > 0);
    assert.throws(() => new CapacityAlerts(x.writer), /JOURNAL_INCOMPLETE/);
  } finally {
    x.cleanup();
  }
});
test("empty inputs and strict options distinguish zero usage, missing measurements and invalid policies", () => {
  const x = make({ warning: false });
  try {
    assert.equal(x.monitor.status().lastObservation, null);
    const r = x.observe();
    assert.equal(r.pending, 0);
    assert.equal(r.lastObservation.report.metrics[0].used, 0);
    assert.equal(r.lastObservation.report.metrics[7].used, null);
    for (const patch of [
      { warningPercent: 100 },
      { warningPercent: 0 },
      { recoveryPercent: 80 },
      { recoveryPercent: -1 },
      { maxPending: 0 },
      { cooldownMs: 0 },
      { unknown: true },
    ])
      assert.throws(
        () =>
          CapacityAlerts.verifyJournal(x.content(), {
            ...x.verifier,
            ...patch,
          }),
        /INVALID|UNSUPPORTED/,
      );
    assert.throws(() => x.observe({ now: 0 }), /UNSUPPORTED/);
    assert.throws(() => x.monitor.pending({ limit: 0 }), /LIMIT_INVALID/);
    assert.throws(
      () => x.monitor.acknowledge("0".repeat(64), { consumerId: "admin" }),
      /UNKNOWN/,
    );
  } finally {
    x.cleanup();
  }
});
for (const lang of Object.keys(words))
  test(`capacity alert review ${lang}: six-language shared design, genuine verifier and safe empty/ACK history`, () => {
    const x = make();
    let dom;
    try {
      x.observe();
      x.monitor.acknowledge(x.monitor.pending()[0].notificationId, {
        consumerId: "local-admin",
      });
      dom = new JSDOM(
        reviewHtml(
          x.content(),
          { ...x.verifier, expectedHead: x.monitor.journal.head() },
          lang,
        ),
      );
      const d = dom.window.document;
      assert.equal(d.documentElement.lang, lang);
      assert.ok(d.body.textContent.includes(words[lang][2]));
      assert.ok(d.body.textContent.includes(words[lang][15]));
      assert.ok(d.body.textContent.includes(words[lang][13]));
      assert.ok(!d.body.textContent.includes("undefined"));
      assert.equal(d.querySelectorAll("script,form,img").length, 0);
      assert.equal(d.querySelectorAll("article").length, 1);
      assert.ok(d.querySelector("[data-design-version]"));
      assert.throws(
        () => reviewHtml(JSON.stringify(x.monitor.status()), x.verifier, lang),
        /JOURNAL/,
      );
      dom.window.close();
      dom = new JSDOM(reviewHtml("", x.verifier, lang));
      assert.ok(dom.window.document.body.textContent.includes(words[lang][20]));
    } finally {
      dom?.window.close();
      x.cleanup();
    }
  });
test("CLI observes, reopens, verifies, renders and ACKs with protected keys, strict options and exclusive outputs", () => {
  const x = make();
  try {
    const file = (n) => path.join(x.f.root, n),
      pub = file("capacity-public.pem"),
      priv = file("capacity-private.pem"),
      cfg = file("capacity-config.json"),
      out = file("result.json");
    fs.writeFileSync(
      pub,
      x.keys.publicKey.export({ type: "spki", format: "pem" }),
    );
    fs.writeFileSync(
      priv,
      x.keys.privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      cfg,
      JSON.stringify({
        schemaVersion: 1,
        signerKeyId: "capacity-writer",
        signerPublicKeyFile: pub,
        heartbeatAlertsConfigFile: x.f.config,
        warningPercent: 80,
        recoveryPercent: 70,
        cooldownMs: 1000,
        maxPending: 100,
      }),
    );
    const dir = file("cli-capacity"),
      journal = path.join(dir, "actions.jsonl"),
      worker = ["--directory", dir, "--private-key", priv],
      run = (cmd, ...args) =>
        spawnSync(
          process.execPath,
          ["enterprise/capacity_alerts_cli.cjs", cmd, "--config", cfg, ...args],
          { encoding: "utf8" },
        );
    let result = run(
      "observe",
      ...worker,
      "--journal",
      x.f.journal,
      "--source-journal",
      x.f.store.journal.logPath,
      "--out",
      out,
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(fs.readFileSync(out));
    assert.equal(report.pending, 1);
    assert.equal(fs.statSync(out).mode & 0o777, 0o600);
    const before = fs.readFileSync(journal);
    result = run("pending", ...worker, "--out", out);
    assert.equal(result.status, 1);
    assert.deepEqual(fs.readFileSync(journal), before);
    fs.unlinkSync(out);
    result = run(
      "verify",
      "--journal",
      journal,
      "--out",
      out,
      "--expected-head",
      report.journalHead,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(fs.readFileSync(out)).originalEvidenceReverified,
      false,
    );
    fs.unlinkSync(out);
    result = run("review", "--journal", journal, "--out", out, "--lang", "pl");
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.readFileSync(out, "utf8").includes(words.pl[0]));
    fs.unlinkSync(out);
    result = run("pending", ...worker, "--out", out);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(fs.readFileSync(out)).notifications.length, 1);
    result = run(
      "ack",
      ...worker,
      "--notification-id",
      report.notifications[0].notificationId,
      "--consumer-id",
      "admin",
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).externalDeliveryVerified, false);
    fs.unlinkSync(out);
    for (const args of [
      ["--limit", "0"],
      ["--limit", "01"],
      ["--lang", "de"],
      ["--expected-head", "0".repeat(64)],
      ["--unknown", "x"],
    ])
      assert.equal(run("pending", ...worker, "--out", out, ...args).status, 1);
    const bundleFile = file("cli-review-package.json");
    fs.writeFileSync(
      bundleFile,
      createPackage(alarm(x.f), source(x.f), { trustedContext: x.f.pub }),
    );
    result = run(
      "observe-package",
      ...worker,
      "--package",
      bundleFile,
      "--expected-package-hash",
      sha(fs.readFileSync(bundleFile)),
      "--out",
      out,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(fs.readFileSync(out)).lastObservation.report.inputKind,
      "package",
    );
    fs.unlinkSync(out);
    const wrongKey = file("wrong-private.pem");
    fs.writeFileSync(
      wrongKey,
      crypto
        .generateKeyPairSync("ed25519")
        .privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 },
    );
    const beforeWrongKey = fs.readFileSync(journal);
    result = run(
      "pending",
      "--directory",
      dir,
      "--private-key",
      wrongKey,
      "--out",
      out,
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /WRITER_KEY_MISMATCH/);
    assert.deepEqual(fs.readFileSync(journal), beforeWrongKey);
    fs.chmodSync(priv, 0o644);
    assert.equal(run("pending", ...worker, "--out", out).status, 1);
    fs.chmodSync(priv, 0o600);
    fs.symlinkSync(file("missing"), out);
    const prior = fs.readFileSync(journal);
    assert.equal(
      run(
        "observe",
        ...worker,
        "--journal",
        x.f.journal,
        "--source-journal",
        x.f.store.journal.logPath,
        "--out",
        out,
      ).status,
      1,
    );
    assert.deepEqual(fs.readFileSync(journal), prior);
    assert.equal(fs.readlinkSync(out), file("missing"));
  } finally {
    x.cleanup();
  }
});
