"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process"),
  { JSDOM } = require("jsdom");
const { fixture } = require("./alert-review-fixtures.cjs"),
  { reviewHtml, project, labels } = require("../heartbeat_alerts_review.cjs");
for (const lang of Object.keys(labels))
  test(`alert review ${lang}: historical alarm vs last report, acknowledgement, filters and pagination`, () => {
    const f = fixture();
    let dom;
    try {
      dom = new JSDOM(reviewHtml(f.report, lang), {
        runScripts: "dangerously",
      });
      const d = dom.window.document,
        l = labels[lang],
        change = (id, value) => {
          d.getElementById(id).value = value;
          d.getElementById(id).dispatchEvent(
            new dom.window.Event(id === "search" ? "input" : "change"),
          );
        };
      assert.equal(d.documentElement.lang, lang);
      assert.equal(d.querySelectorAll("article").length, 25);
      assert.ok(!d.querySelector("main").textContent.includes("undefined"));
      assert.ok(d.querySelector("header").textContent.includes(l.scopeProof));
      d.querySelector("#next").click();
      assert.equal(d.querySelectorAll("article").length, 7);
      change("kind", "HEARTBEAT_UNKNOWN");
      assert.equal(d.querySelectorAll("article").length, 10);
      assert.ok(d.querySelector("article").textContent.includes(l.current));
      assert.ok(d.querySelector("article").textContent.includes(l.stale));
      assert.ok(d.querySelector("article").textContent.includes(l.pending));
      assert.ok(d.querySelector("article").textContent.includes(l.candidateAt));
      change("freshness", "CURRENT");
      assert.equal(d.querySelectorAll("article").length, 10);
      change("freshness", "UNKNOWN");
      assert.equal(d.querySelectorAll("article").length, 0);
      change("freshness", "");
      change("kind", "HEARTBEAT_RECOVERED");
      assert.equal(d.querySelectorAll("article").length, 10);
      change("severity", "high");
      assert.equal(d.querySelectorAll("article").length, 0);
      change("severity", "");
      change("kind", "");
      change("delivery", "ACKNOWLEDGED");
      assert.equal(d.querySelectorAll("article").length, 3);
      assert.ok(
        d.querySelector("article").textContent.includes("local-collector"),
      );
      change("search", "local-collector");
      assert.equal(d.querySelectorAll("article").length, 3);
      change("search", f.report.notifications[0].notificationId);
      assert.equal(d.querySelectorAll("article").length, 1);
      assert.ok(d.querySelector("article").textContent.includes(l.noOutage));
      change("search", "not-found");
      assert.ok(d.querySelector("#cards").textContent.includes(l.empty));
      assert.equal(d.querySelector("#next").disabled, true);
    } finally {
      dom?.window.close();
      f.cleanup();
    }
  });
test("unsigned minimised projection recomputes totals and omits unexpected fields", () => {
  const f = fixture();
  try {
    const r = structuredClone(f.report);
    r.secret = "SECRET_SENTINEL";
    r.pending = 999;
    r.counts.CURRENT = 999;
    r.devices[0].streamEpoch = "SECRET_SENTINEL";
    r.devices[0].url = "SECRET_SENTINEL";
    r.notifications[0].credential = "SECRET_SENTINEL";
    const p = project(r);
    assert.equal(p.pending, 29);
    assert.equal(p.acknowledged, 3);
    assert.equal(p.counts.CURRENT, 1);
    assert.ok(!JSON.stringify(p).includes("SECRET_SENTINEL"));
    assert.equal(p.notifications.length, 32);
    assert.equal(p.devices.length, 3);
    assert.equal(p.proof.sourceDeviceEvidenceReverified, false);
    assert.throws(() => project(p), /REVIEW_INVALID/);
    assert.throws(() => reviewHtml(r, "unknown"), /LANGUAGE_INVALID/);
  } finally {
    f.cleanup();
  }
});
test("invalid proof, duplicate identities, unsupported status and oversized reports fail closed", () => {
  const f = fixture();
  try {
    for (const patch of [
      {
        verification: {
          ...f.report.verification,
          sourceDeviceEvidenceReverified: true,
        },
      },
      { runtimeIntegrated: true },
      { devices: [f.report.devices[0], f.report.devices[0]] },
      { notifications: [f.report.notifications[0], f.report.notifications[0]] },
      {
        notifications: [{ ...f.report.notifications[0], code: "UNCLASSIFIED" }],
      },
    ])
      assert.throws(() => project({ ...f.report, ...patch }), /REVIEW_INVALID/);
    assert.throws(
      () =>
        project({
          ...f.report,
          notifications: Array(10001).fill(f.report.notifications[0]),
        }),
      /REVIEW_CAPACITY/,
    );
  } finally {
    f.cleanup();
  }
});
test("safe JSON/text embedding and nonce CSP prevent markup execution; missing monitor pin stays visible", () => {
  const f = fixture();
  let dom;
  try {
    const r = structuredClone(f.report),
      id = '</script><img src=x onerror="window.injected=1">',
      old = r.devices[0].deviceId;
    r.devices[0].deviceId = id;
    for (const n of r.notifications) if (n.deviceId === old) n.deviceId = id;
    r.verification.headPinned = false;
    dom = new JSDOM(reviewHtml(r, "de"), { runScripts: "dangerously" });
    const d = dom.window.document;
    assert.equal(d.querySelectorAll("img").length, 0);
    assert.equal(dom.window.injected, undefined);
    assert.ok(d.querySelector("main").textContent.includes(id));
    assert.ok(
      d.querySelector("footer").textContent.includes(labels.de.unpinned),
    );
    assert.ok(
      d
        .querySelector('meta[http-equiv="Content-Security-Policy"]')
        .content.includes("default-src 'none'"),
    );
    assert.equal(d.querySelectorAll("form").length, 0);
  } finally {
    dom?.window.close();
    f.cleanup();
  }
});
test("empty alert journal reports not evaluated, without inventing healthy devices or alarm receipt", () => {
  const f = fixture(true);
  let dom;
  try {
    const p = project(f.report);
    assert.equal(p.evaluatedAt, null);
    assert.equal(p.notEvaluatedDevices, 3);
    assert.equal(p.pending, 0);
    assert.equal(p.acknowledged, 0);
    assert.equal(p.counts.CURRENT, 0);
    dom = new JSDOM(reviewHtml(f.report), { runScripts: "dangerously" });
    assert.equal(dom.window.document.querySelectorAll("article").length, 0);
    assert.ok(
      dom.window.document
        .querySelector("main")
        .textContent.includes(labels.en.notEvaluated),
    );
  } finally {
    dom?.window.close();
    f.cleanup();
  }
});
test("CLI review uses public keys next to active writers, preserves inputs and rejects bad journals/arguments", () => {
  const f = fixture();
  try {
    const out = path.join(f.root, "review.html"),
      run = (...extra) =>
        spawnSync(
          process.execPath,
          [
            "enterprise/heartbeat_alerts_cli.cjs",
            "review",
            "--config",
            f.config,
            "--journal",
            f.journal,
            "--out",
            out,
            ...extra,
          ],
          { encoding: "utf8" },
        ),
      before = fs.readFileSync(f.journal),
      sourceBefore = fs.readFileSync(f.store.journal.logPath),
      lockBefore = fs.readFileSync(f.monitor.journal.lockPath);
    let r = run("--lang", "pl", "--expected-head", f.head);
    assert.equal(r.status, 0, r.stderr);
    const html = fs.readFileSync(out, "utf8");
    assert.ok(html.includes('lang="pl"'));
    assert.equal(fs.statSync(out).mode & 0o777, 0o600);
    assert.deepEqual(fs.readFileSync(f.journal), before);
    assert.deepEqual(fs.readFileSync(f.store.journal.logPath), sourceBefore);
    assert.deepEqual(fs.readFileSync(f.monitor.journal.lockPath), lockBefore);
    assert.equal(run().status, 1);
    assert.equal(fs.readFileSync(out, "utf8"), html);
    fs.unlinkSync(out);
    assert.equal(run("--lang", "xx").status, 1);
    assert.equal(run("--private-key", "not-allowed").status, 1);
    assert.equal(run("--expected-head", "0".repeat(64)).status, 1);
    assert.ok(!fs.existsSync(out));
    const copy = path.join(f.root, "bad.jsonl");
    fs.writeFileSync(copy, before.toString().replace("device-0", "device-X"));
    r = spawnSync(
      process.execPath,
      [
        "enterprise/heartbeat_alerts_cli.cjs",
        "review",
        "--config",
        f.config,
        "--journal",
        copy,
        "--out",
        out,
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 1);
    assert.ok(!fs.existsSync(out));
  } finally {
    f.cleanup();
  }
});
