"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");
const { reviewHtml, project, labels } = require("../cases_review.cjs"),
  { fixture } = require("./cases-review-fixtures.cjs");
for (const lang of ["en", "de", "fr", "es", "it", "pl"])
  test(
    lang + " case review filters and renders history with complete labels",
    () => {
      const data = fixture(),
        before = JSON.stringify(data),
        dom = new JSDOM(reviewHtml(data, lang), { runScripts: "dangerously" }),
        d = dom.window.document,
        $ = (id) => d.getElementById(id);
      try {
        assert.equal(d.documentElement.lang, lang);
        assert.equal(d.querySelectorAll("article").length, 25);
        assert.ok(d.body.textContent.includes(labels[lang].history));
        assert.ok(!d.querySelector("main").textContent.includes("undefined"));
        $("state").value = "RESOLVED";
        $("state").dispatchEvent(new dom.window.Event("input"));
        assert.equal(d.querySelectorAll("article").length, 7);
        assert.ok(d.body.textContent.includes(labels[lang].resolutions[1]));
        $("state").value = "";
        $("state").dispatchEvent(new dom.window.Event("input"));
        $("unknown").checked = true;
        $("unknown").dispatchEvent(new dom.window.Event("input"));
        assert.equal(d.querySelectorAll("article").length, 6);
        $("unknown").checked = false;
        $("minimum").value = "80";
        $("minimum").dispatchEvent(new dom.window.Event("input"));
        assert.equal(d.querySelectorAll("article").length, 24);
        assert.equal(d.querySelectorAll("form,iframe,img,link").length, 0);
        assert.ok(
          d
            .querySelector('meta[http-equiv="Content-Security-Policy"]')
            .content.includes("default-src 'none'"),
        );
        assert.equal(JSON.stringify(data), before);
      } finally {
        dom.window.close();
      }
    },
  );
test("pagination resets after filters and export retains all cases", () => {
  const dom = new JSDOM(reviewHtml(fixture()), { runScripts: "dangerously" }),
    d = dom.window.document,
    $ = (id) => d.getElementById(id);
  try {
    $("next").click();
    assert.equal(d.querySelectorAll("article").length, 5);
    $("search").value = "example1.org";
    $("search").dispatchEvent(new dom.window.Event("input"));
    assert.equal(d.querySelectorAll("article").length, 1);
    assert.equal($("previous").disabled, true);
    let blob;
    dom.window.URL.createObjectURL = (value) => {
      blob = value;
      return "blob:local";
    };
    dom.window.URL.revokeObjectURL = () => {};
    dom.window.HTMLAnchorElement.prototype.click = function () {
      assert.equal(this.download, "thundy-incident-cases.json");
    };
    $("download").click();
    assert.ok(blob);
    assert.ok(blob.size > 10000);
  } finally {
    dom.window.close();
  }
});
test("projection excludes unexpected private fields, device IDs and settings", () => {
  const input = fixture(1);
  input.privateKey = "SECRET";
  input.cases[0].credential = "SECRET";
  input.cases[0].incident.deviceId = "device-secret";
  input.cases[0].history[0].settings = { token: "SECRET" };
  const json = JSON.stringify(project(input));
  assert.ok(!json.includes("SECRET"));
  assert.ok(!json.includes("device-secret"));
});
test("hostile alias cannot escape embedded JSON or become an executable element", () => {
  const input = fixture(1);
  input.cases[0].assigneeId = '</script><img src=x onerror="window.pwned=1">';
  const dom = new JSDOM(reviewHtml(input), { runScripts: "dangerously" });
  try {
    assert.equal(dom.window.document.querySelectorAll("img").length, 0);
    assert.equal(dom.window.pwned, undefined);
    assert.ok(dom.window.document.body.textContent.includes("</script>"));
  } finally {
    dom.window.close();
  }
});
test("unsigned snapshots, protected-storage claims, unknown locales and duplicate identities fail", () => {
  const input = fixture(1);
  for (const data of [
    { ...input, verification: undefined },
    { ...input, sealed: true },
    { ...input, cases: [...input.cases, ...input.cases] },
  ])
    assert.throws(() => reviewHtml(data), /CASES_REVIEW_INVALID/);
  assert.throws(() => reviewHtml(input, "xx"), /CASES_REVIEW_LANGUAGE_INVALID/);
  input.verification.headPinned = true;
  assert.ok(reviewHtml(input, "de").includes(labels.de.pinned));
});
test("long histories render lazily and remain complete through history pagination", () => {
  const data = fixture(1),
    h = data.cases[0].history[0];
  data.cases[0].history = Array.from({ length: 56 }, (_, i) => ({
    ...h,
    index: i + 1,
    revision: i + 1,
  }));
  const dom = new JSDOM(reviewHtml(data), { runScripts: "dangerously" });
  try {
    const details = dom.window.document.querySelector(".case-history");
    assert.equal(details.querySelectorAll("li").length, 0);
    details.open = true;
    details.dispatchEvent(new dom.window.Event("toggle"));
    assert.equal(details.querySelectorAll("li").length, 50);
    details.querySelectorAll("button")[1].click();
    assert.equal(details.querySelectorAll("li").length, 6);
    assert.equal(details.querySelector("ol").start, 51);
    details.querySelectorAll("button")[0].click();
    assert.equal(details.querySelectorAll("li").length, 50);
  } finally {
    dom.window.close();
  }
});
