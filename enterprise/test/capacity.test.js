"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process"),
  { JSDOM } = require("jsdom");
const { fixture } = require("./alert-review-fixtures.cjs"),
  { createPackage } = require("../review_package.cjs"),
  {
    capacityFromJournals,
    capacityFromPackage,
    project,
  } = require("../capacity.cjs"),
  { reviewHtml, labels } = require("../capacity_review.cjs");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex"),
  alarm = (f) => fs.readFileSync(f.journal),
  source = (f) => fs.readFileSync(f.store.journal.logPath),
  make = (f) => createPackage(alarm(f), source(f), { trustedContext: f.pub }),
  raw = (f, o = {}) =>
    capacityFromJournals(alarm(f), source(f), { trustedContext: f.pub, ...o });
const get = (r, id) => r.metrics.find((m) => m.id === id);
function pendingBoundary(f) {
  f.monitor.observe(source(f));
  f.advance(1);
  f.accept(1);
  f.monitor.observe(source(f));
  f.advance(1000);
  f.monitor.observe(source(f));
  f.advance(1000);
  f.monitor.observe(source(f));
}
test("raw journal capacity uses verified counts and exact bytes while unprovided package sizes stay unmeasured", () => {
  const f = fixture();
  try {
    const before = alarm(f),
      src = source(f),
      al = fs.readFileSync(f.monitor.journal.lockPath),
      sl = fs.readFileSync(f.store.journal.lockPath),
      r = raw(f, {
        expectedHead: f.head,
        expectedSourceHead: f.store.journal.head(),
      });
    assert.equal(get(r, "alarm_bytes").used, before.length);
    assert.equal(get(r, "source_bytes").used, src.length);
    assert.equal(get(r, "alarm_actions").used, 35);
    assert.equal(get(r, "source_actions").used, 11);
    assert.equal(get(r, "observations").used, 32);
    assert.equal(get(r, "comparisons").used, 96);
    assert.equal(get(r, "pending").used, 29);
    assert.equal(get(r, "pending").limit, 1000);
    assert.equal(get(r, "pending").basis, "signed_config");
    assert.equal(get(r, "alarm_actions").basis, "reader");
    assert.equal(get(r, "package_bytes").used, null);
    assert.equal(get(r, "package_bytes").remaining, null);
    assert.equal(get(r, "public_context_bytes").state, "not_measured");
    assert.equal(r.totals.not_measured, 2);
    assert.equal(r.pins.alarm, true);
    assert.equal(r.pins.source, true);
    assert.equal(r.pins.package, null);
    assert.deepEqual(alarm(f), before);
    assert.deepEqual(source(f), src);
    assert.deepEqual(fs.readFileSync(f.monitor.journal.lockPath), al);
    assert.deepEqual(fs.readFileSync(f.store.journal.lockPath), sl);
  } finally {
    f.cleanup();
  }
});
test("package capacity measures actual verified container/context bytes and keeps independent pin status", () => {
  const f = fixture();
  try {
    const b = make(f),
      p = JSON.parse(b),
      r = capacityFromPackage(b, {
        trustedContext: f.pub,
        expectedPackageHash: sha(b),
      });
    assert.equal(get(r, "package_bytes").used, b.length);
    assert.equal(
      get(r, "public_context_bytes").used,
      Buffer.from(p.files[2].data, "base64").length,
    );
    assert.equal(get(r, "alarm_bytes").used, alarm(f).length);
    assert.equal(get(r, "source_bytes").used, source(f).length);
    assert.equal(r.totals.not_measured, 0);
    assert.equal(r.pins.package, true);
    assert.equal(r.pins.alarm, false);
    assert.equal(r.references.packageHash, sha(b));
    assert.equal(r.freeDiskMeasured, false);
    assert.equal(r.deviceHealthMeasured, false);
    assert.equal(r.writesPerformed, false);
    assert.equal(r.sealed, false);
  } finally {
    f.cleanup();
  }
});
test("signed pending limit warns exactly at 80 percent, reaches 100 and drops after explicit ack", () => {
  const f = fixture(true, { maxPending: 5 });
  try {
    pendingBoundary(f);
    const warning = raw(f);
    assert.equal(get(warning, "pending").used, 4);
    assert.equal(get(warning, "pending").state, "warning");
    assert.equal(get(warning, "pending").remaining, 1);
    assert.equal(get(warning, "pending").utilizationBasisPoints, 8000);
    assert.equal(get(raw(f, { warningPercent: 81 }), "pending").state, "below");
    f.advance(1);
    f.accept(2);
    f.monitor.observe(source(f));
    const full = raw(f);
    assert.equal(get(full, "pending").state, "reached");
    assert.equal(get(full, "pending").remaining, 0);
    assert.equal(get(full, "pending").utilizationBasisPoints, 10000);
    const n = f.monitor.pending()[0];
    f.monitor.acknowledge(n.notificationId, { consumerId: "collector" });
    assert.equal(get(raw(f), "pending").state, "warning");
    assert.equal(get(raw(f, { warningPercent: 81 }), "pending").state, "below");
  } finally {
    f.cleanup();
  }
});
test("empty signed inputs distinguish zero usage from missing measurements without device-health claims", () => {
  const f = fixture(true);
  try {
    const r = raw(f);
    assert.equal(get(r, "alarm_actions").used, 0);
    assert.equal(get(r, "source_bytes").used, 0);
    assert.equal(get(r, "pending").used, 0);
    assert.equal(get(r, "pending").basis, "external_config");
    assert.equal(get(r, "package_bytes").used, null);
    assert.equal(r.references.alarmHead, null);
    assert.equal(r.deviceHealthMeasured, false);
    const packaged = capacityFromPackage(make(f), { trustedContext: f.pub });
    assert.ok(get(packaged, "package_bytes").used > 0);
    assert.equal(packaged.totals.not_measured, 0);
  } finally {
    f.cleanup();
  }
});
test("source tampering, missing history, fake snapshot imports and wrong pins never produce a capacity report", () => {
  const f = fixture();
  try {
    assert.throws(
      () =>
        capacityFromJournals(
          alarm(f),
          source(f).toString().replace("1.22.0", "1.20.0"),
          { trustedContext: f.pub },
        ),
      /JOURNAL/,
    );
    assert.throws(
      () => capacityFromJournals(alarm(f), "", { trustedContext: f.pub }),
      /PREFIX_MISSING/,
    );
    assert.throws(
      () =>
        capacityFromJournals(JSON.stringify(f.report) + "\n", source(f), {
          trustedContext: f.pub,
        }),
      /JOURNAL/,
    );
    assert.throws(
      () => raw(f, { expectedHead: "0".repeat(64) }),
      /HEAD_MISMATCH/,
    );
    const b = make(f);
    assert.throws(
      () =>
        capacityFromPackage(b, {
          trustedContext: f.pub,
          expectedPackageHash: "0".repeat(64),
        }),
      /HASH_MISMATCH/,
    );
    assert.throws(() => capacityFromPackage(b), /OPTIONS_INVALID/);
    assert.throws(() => raw(f, { warningPercent: 100 }), /OPTIONS_INVALID/);
    assert.throws(() => raw(f, { warningPercent: 0 }), /OPTIONS_INVALID/);
    assert.throws(() => raw(f, { warningPercent: 79.5 }), /OPTIONS_INVALID/);
    assert.throws(() => raw(f, { now: NaN }), /OPTIONS_INVALID/);
  } finally {
    f.cleanup();
  }
});
test("minimized projection excludes unexpected identifiers/secrets and rejects false derived states", () => {
  const f = fixture();
  try {
    const r = raw(f);
    r.secret = "SECRET_SENTINEL";
    r.references.deviceId = "SECRET_SENTINEL";
    r.metrics[0].url = "SECRET_SENTINEL";
    r.totals.warning = 999;
    const p = project(r);
    assert.ok(!JSON.stringify(p).includes("SECRET_SENTINEL"));
    assert.equal(p.totals.warning, 0);
    const text = JSON.stringify(p);
    for (const n of f.report.notifications) {
      assert.ok(!text.includes(n.deviceId));
      assert.ok(!text.includes(n.keyId));
      assert.ok(!text.includes(n.consumerId || "local-collector"));
    }
    for (const patch of [
      { freeDiskMeasured: true },
      { deviceHealthMeasured: true },
      { metrics: [...r.metrics].reverse() },
      {
        metrics: r.metrics.map((m, i) =>
          i === 0 ? { ...m, state: "reached" } : m,
        ),
      },
    ])
      assert.throws(() => project({ ...r, ...patch }), /REPORT_INVALID/);
  } finally {
    f.cleanup();
  }
});
test("integer headroom and displayed percentages do not round a below-threshold value up to warning", () => {
  const f = fixture();
  try {
    const r = raw(f),
      m = get(r, "alarm_actions");
    Object.assign(m, {
      used: 7999,
      remaining: 2001,
      utilizationBasisPoints: 7999,
      state: "below",
    });
    assert.equal(get(project(r), "alarm_actions").state, "below");
    Object.assign(m, {
      used: 8000,
      remaining: 2000,
      utilizationBasisPoints: 8000,
      state: "warning",
    });
    assert.equal(get(project(r), "alarm_actions").state, "warning");
    Object.assign(m, {
      used: 10000,
      remaining: 0,
      utilizationBasisPoints: 10000,
      state: "reached",
    });
    assert.equal(get(project(r), "alarm_actions").state, "reached");
    Object.assign(m, {
      used: 10001,
      remaining: -1,
      utilizationBasisPoints: 10001,
      state: "reached",
    });
    assert.throws(() => project(r), /METRIC_INVALID/);
  } finally {
    f.cleanup();
  }
});
for (const lang of Object.keys(labels))
  test(`capacity view ${lang}: signed pending warning, explicit reader limits and unmeasured values`, () => {
    const f = fixture(true, { maxPending: 5 });
    let dom;
    try {
      pendingBoundary(f);
      const r = raw(f),
        l = labels[lang];
      dom = new JSDOM(reviewHtml(r, lang));
      const d = dom.window.document;
      assert.equal(d.documentElement.lang, lang);
      assert.equal(d.querySelectorAll("article").length, 9);
      assert.ok(d.querySelector("main").textContent.includes(l.warning));
      assert.ok(d.querySelector("main").textContent.includes(l.signed_config));
      assert.ok(d.querySelector("main").textContent.includes(l.reader));
      assert.ok(d.querySelector("main").textContent.includes(l.not_measured));
      assert.ok(!d.querySelector("main").textContent.includes("undefined"));
      assert.equal(d.querySelectorAll("script,form,img").length, 0);
      assert.ok(
        d
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          .content.includes("default-src 'none'"),
      );
      assert.throws(
        () => reviewHtml({ ...r, freeDiskMeasured: true }, lang),
        /REPORT_INVALID/,
      );
    } finally {
      dom?.window.close();
      f.cleanup();
    }
  });
test("CLI supports both verified input modes, six-language HTML, thresholds, secure outputs and strict arguments", () => {
  const f = fixture();
  try {
    const file = (n) => path.join(f.root, n),
      bundle = file("bundle.json"),
      out = file("capacity.json");
    fs.writeFileSync(bundle, make(f));
    const run = (cmd, ...extra) =>
      spawnSync(
        process.execPath,
        [
          "enterprise/capacity_cli.cjs",
          cmd,
          "--config",
          f.config,
          "--out",
          out,
          ...extra,
        ],
        { encoding: "utf8" },
      );
    const args = [
      "--journal",
      f.journal,
      "--source-journal",
      f.store.journal.logPath,
    ];
    let result = run("journals", ...args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(fs.readFileSync(out)).totals.not_measured, 2);
    assert.equal(fs.statSync(out).mode & 0o777, 0o600);
    const original = fs.readFileSync(out);
    assert.equal(run("journals", ...args).status, 1);
    assert.deepEqual(fs.readFileSync(out), original);
    fs.unlinkSync(out);
    result = run(
      "package",
      "--package",
      bundle,
      "--format",
      "html",
      "--lang",
      "pl",
      "--warning-percent",
      "1",
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.readFileSync(out, "utf8").includes(labels.pl.title));
    fs.unlinkSync(out);
    for (const extra of [
      ["--warning-percent", "0"],
      ["--warning-percent", "100"],
      ["--warning-percent", "01"],
      ["--lang", "de"],
      ["--format", "html", "--lang", "xx"],
      ["--private-key", "forbidden"],
      ["--expected-head", "0".repeat(64)],
    ])
      assert.equal(run("journals", ...args, ...extra).status, 1);
    assert.ok(!fs.existsSync(out));
    const alias = file("alias.json");
    fs.symlinkSync(bundle, alias);
    assert.equal(run("package", "--package", alias).status, 1);
    const missing = file("missing");
    fs.symlinkSync(missing, out);
    assert.equal(run("journals", ...args).status, 1);
    assert.equal(fs.readlinkSync(out), missing);
    assert.ok(
      !fs.readdirSync(f.root).some((n) => n.startsWith(".thundy-review-")),
    );
  } finally {
    f.cleanup();
  }
});
