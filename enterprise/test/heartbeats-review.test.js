"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process"),
  { JSDOM } = require("jsdom");
const { fixture } = require("./heartbeat-review-fixtures.cjs"),
  { reviewHtml, project, labels } = require("../heartbeats_review.cjs");
for (const lang of Object.keys(labels))
  test(`heartbeat review ${lang}: all states, nulls, search, problem filter and pagination`, () => {
    const f = fixture();
    let dom;
    try {
      dom = new JSDOM(reviewHtml(f.report, lang), {
        runScripts: "dangerously",
      });
      const d = dom.window.document,
        l = labels[lang];
      assert.equal(d.documentElement.lang, lang);
      assert.equal(d.querySelectorAll("article").length, 25);
      assert.equal(d.querySelector("#previous").disabled, true);
      assert.ok(d.querySelector("main").textContent.includes(l.never));
      assert.ok(d.querySelector("main").textContent.includes(l.stale));
      assert.ok(!d.querySelector("main").textContent.includes("undefined"));
      d.querySelector("#next").click();
      assert.equal(d.querySelectorAll("article").length, 6);
      const status = d.querySelector("#status");
      status.value = "NEVER_SEEN";
      status.dispatchEvent(new dom.window.Event("change"));
      assert.equal(d.querySelectorAll("article").length, 7);
      assert.ok(d.querySelector("article").textContent.includes(l.notReported));
      assert.ok(d.querySelector("article").textContent.includes(l.unknown));
      status.value = "";
      status.dispatchEvent(new dom.window.Event("change"));
      const issues = d.querySelector("#issues");
      issues.checked = true;
      issues.dispatchEvent(new dom.window.Event("change"));
      assert.equal(d.querySelectorAll("article").length, 6);
      const search = d.querySelector("#search");
      search.value = "device-002";
      search.dispatchEvent(new dom.window.Event("input"));
      assert.equal(d.querySelectorAll("article").length, 1);
      search.value = "nonexistent";
      search.dispatchEvent(new dom.window.Event("input"));
      assert.equal(d.querySelectorAll("article").length, 0);
      assert.ok(d.querySelector("#cards").textContent.includes(l.empty));
    } finally {
      dom?.window.close();
      f.cleanup();
    }
  });
test("heartbeat projection omits unexpected fields and cannot be reused as a verified report", () => {
  const f = fixture();
  try {
    const r = structuredClone(f.report);
    r.secret = "SECRET_SENTINEL";
    r.devices[0].url = "SECRET_SENTINEL";
    r.devices[0].queue = null;
    r.devices[0].streamEpoch = "SECRET_SENTINEL";
    const p = project(r);
    assert.equal(p.devices[0].queue, null);
    assert.ok(!JSON.stringify(p).includes("SECRET_SENTINEL"));
    assert.throws(() => project(p), /HEARTBEAT_REVIEW_INVALID/);
    assert.throws(() => reviewHtml(r, "xx"), /HEARTBEAT_LANGUAGE_INVALID/);
    for (const patch of [
      { verification: {} },
      { runtimeIntegrated: true },
      { devices: [{ ...r.devices[0], status: "ONLINE" }] },
      { devices: [r.devices[0], r.devices[0]] },
    ])
      assert.throws(
        () => reviewHtml({ ...r, ...patch }),
        /HEARTBEAT_REVIEW_INVALID/,
      );
  } finally {
    f.cleanup();
  }
});
test("heartbeat markup escapes identifiers, blocks external resources and preserves unpinned warning", () => {
  const f = fixture();
  let dom;
  try {
    const r = structuredClone(f.report);
    r.devices[0].keyId = '</script><img src=x onerror="window.injected=1">';
    r.verification.headPinned = false;
    dom = new JSDOM(reviewHtml(r, "de"), { runScripts: "dangerously" });
    const d = dom.window.document;
    assert.equal(d.querySelectorAll("img").length, 0);
    assert.equal(dom.window.injected, undefined);
    assert.ok(
      d.querySelector("article").textContent.includes(r.devices[0].keyId),
    );
    assert.ok(
      d.querySelector("footer").textContent.includes(labels.de.unpinned),
    );
    const csp = d.querySelector(
      'meta[http-equiv="Content-Security-Policy"]',
    ).content;
    assert.ok(csp.includes("default-src 'none'"));
    assert.ok(csp.includes("form-action 'none'"));
  } finally {
    dom?.window.close();
    f.cleanup();
  }
});
test("heartbeat CLI review verifies original journal, works beside writer, protects output and rejects tampering", () => {
  const f = fixture(5);
  try {
    const out = path.join(f.root, "review.html"),
      config = path.join(f.root, "config.json"),
      before = fs.readFileSync(f.journal),
      run = (...extra) =>
        spawnSync(
          process.execPath,
          [
            "enterprise/heartbeats_cli.cjs",
            "review",
            "--journal",
            f.journal,
            "--config",
            config,
            "--out",
            out,
            ...extra,
          ],
          { encoding: "utf8" },
        );
    assert.equal(run("--lang", "pl", "--expected-head", f.head).status, 0);
    const html = fs.readFileSync(out, "utf8");
    assert.ok(html.includes('lang="pl"'));
    assert.equal(fs.statSync(out).mode & 0o777, 0o600);
    assert.equal(run().status, 1);
    assert.equal(fs.readFileSync(out, "utf8"), html);
    assert.deepEqual(fs.readFileSync(f.journal), before);
    fs.unlinkSync(out);
    assert.equal(run("--lang", "xx").status, 1);
    assert.ok(!fs.existsSync(out));
    assert.equal(run("--private-key", "dummy").status, 1);
    assert.equal(run("--expected-head", "0".repeat(64)).status, 1);
    assert.ok(!fs.existsSync(out));
    fs.writeFileSync(f.journal, before.toString().replace("1.22.0", "1.20.0"));
    assert.equal(run().status, 1);
    assert.ok(!fs.existsSync(out));
  } finally {
    f.cleanup();
  }
});
test("empty verified journal shows all registered devices as never reported without proof of contact", () => {
  const f = fixture(1);
  let dom;
  try {
    assert.equal(f.report.journalHead, null);
    dom = new JSDOM(reviewHtml(f.report), { runScripts: "dangerously" });
    assert.equal(dom.window.document.querySelectorAll("article").length, 1);
    const p = project(f.report);
    assert.equal(p.devices[0].receivedAt, null);
    assert.equal(p.devices[0].queue, null);
  } finally {
    dom?.window.close();
    f.cleanup();
  }
});
