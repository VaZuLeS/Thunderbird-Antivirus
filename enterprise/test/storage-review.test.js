"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { reviewHtml, report, labels } = require("../storage_review.cjs");
const { fixture, at, hash } = require("./storage-review-fixtures.cjs");
function view(data, lang = "en", options = {}) {
  return new JSDOM(reviewHtml(data, lang, { generatedAt: at, ...options }), {
    runScripts: "dangerously",
  });
}
for (const lang of Object.keys(labels))
  test(`${lang} review filters problems, explains timeouts and keeps source snapshot unchanged`, () => {
    const source = fixture(),
      before = JSON.stringify(source),
      dom = view(source, lang),
      doc = dom.window.document,
      $ = (id) => doc.getElementById(id);
    try {
      assert.equal(doc.documentElement.lang, lang);
      assert.equal($("rows").querySelectorAll("tr").length, 6);
      assert.equal(
        $("cards").firstChild.querySelector("strong").textContent,
        "6",
      );
      assert.equal(
        $("cards").children[1].querySelector("strong").textContent,
        "4",
      );
      assert.ok(
        $("capacity").textContent.includes(labels[lang].capacityWarning),
      );
      assert.ok($("rows").textContent.includes(labels[lang].timeout));
      assert.ok($("rows").textContent.includes(labels[lang].expired));
      assert.ok($("rows").textContent.includes(labels[lang].interrupted));
      $("provider").value = "local-simulation";
      $("provider").dispatchEvent(new dom.window.Event("input"));
      assert.equal($("rows").querySelectorAll("tr").length, 1);
      assert.ok($("rows").textContent.includes(labels[lang].localProvider));
      $("provider").value = "";
      $("attention").checked = true;
      $("attention").dispatchEvent(new dom.window.Event("input"));
      assert.equal($("rows").querySelectorAll("tr").length, 4);
      $("query").value = source.jobs[0].jobId;
      $("query").dispatchEvent(new dom.window.Event("input"));
      assert.equal($("rows").textContent, labels[lang].empty);
      assert.equal(JSON.stringify(source), before);
      assert.equal(doc.querySelector('a[href^="http"]'), null);
      assert.ok(
        doc
          .querySelector("meta[http-equiv]")
          .content.includes("connect-src 'none'"),
      );
    } finally {
      dom.window.close();
    }
  });
test("pagination resets after filter and complete JSON export ignores visible subset", () => {
  const dom = view(fixture(101)),
    doc = dom.window.document,
    $ = (id) => doc.getElementById(id);
  try {
    assert.equal($("rows").children.length, 50);
    $("next").click();
    assert.ok($("count").textContent.endsWith("51–100"));
    $("state").value = "DEAD_LETTER";
    $("state").dispatchEvent(new dom.window.Event("input"));
    assert.ok($("count").textContent.endsWith("1–17"));
    let blobs = [];
    dom.window.Blob = class {
      constructor(parts) {
        blobs = parts;
      }
    };
    dom.window.URL.createObjectURL = () => "blob:test";
    dom.window.URL.revokeObjectURL = () => {};
    dom.window.HTMLAnchorElement.prototype.click = function () {
      assert.equal(this.download, "thundy-storage-status.json");
    };
    $("download").click();
    const data = JSON.parse(blobs.join(""));
    assert.equal(data.jobs.length, 101);
    assert.equal(data.sealed, false);
    assert.equal(data.kind, "thundy-storage-jobs-review");
  } finally {
    dom.window.close();
  }
});
test("projection excludes secrets, URLs, settings and unknown properties", () => {
  const source = fixture();
  source.privateKey = "DO_NOT_EXPORT";
  source.jobs[0].input = {
    url: "https://private.example",
    token: "DO_NOT_EXPORT",
  };
  const data = report(source, { generatedAt: at }),
    json = JSON.stringify(data);
  assert.equal(json.includes("DO_NOT_EXPORT"), false);
  assert.equal(json.includes("private.example"), false);
  source.jobs[0].jobId = hash("changed");
  assert.notEqual(data.jobs[0].jobId, source.jobs[0].jobId);
});
test("malicious object version cannot escape embedded JSON or create elements", () => {
  const source = fixture();
  source.jobs[5].objectVersion = '</script><img src=x onerror="alert(1)">';
  const html = reviewHtml(source, "en", { generatedAt: at }),
    dom = new JSDOM(html, { runScripts: "dangerously" });
  try {
    assert.equal(dom.window.document.querySelector("img"), null);
    assert.ok(
      dom.window.document
        .getElementById("rows")
        .textContent.includes("</script><img"),
    );
  } finally {
    dom.window.close();
  }
});
test("unknown language, SEALED claim, invalid clock and duplicate job identities fail closed", () => {
  assert.throws(() => reviewHtml(fixture(), "xx"), /LANGUAGE_INVALID/);
  assert.throws(
    () => report(fixture(), { generatedAt: "not-a-date" }),
    /STORAGE_REVIEW_INVALID/,
  );
  for (const change of [
    { sealed: true },
    { transportVerified: true },
    { status: "SEALED" },
    { requestedRetainUntil: "bad" },
  ]) {
    const source = fixture();
    Object.assign(source.jobs[0], change);
    assert.throws(
      () => report(source, { generatedAt: at }),
      /STORAGE_REVIEW_INVALID/,
    );
  }
  const duplicate = fixture();
  duplicate.jobs[1].jobId = duplicate.jobs[0].jobId;
  assert.throws(() => report(duplicate), /STORAGE_REVIEW_INVALID/);
});
test("head-pin wording reflects supplied verification context, including empty journals", () => {
  const source = fixture(0);
  source.head = "genesis";
  const html = reviewHtml(source, "de", { headPinned: true, generatedAt: at }),
    dom = new JSDOM(html, { runScripts: "dangerously" });
  try {
    assert.ok(dom.window.document.body.textContent.includes(labels.de.pinned));
    assert.equal(
      dom.window.document.getElementById("rows").textContent,
      labels.de.empty,
    );
    assert.equal(report(source).jobs.length, 0);
  } finally {
    dom.window.close();
  }
});
