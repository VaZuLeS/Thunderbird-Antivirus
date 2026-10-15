const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM } = require("jsdom");
const { fixtures } = require("./design-fixtures.cjs"),
  { decorateHTML, labels } = require("../design_system.cjs"),
  design = require("../../design_system.js");
test("shared design generator and every scheme keep text, controls and safety colors legible", () => {
  for (const mode of ["light", "dark"])
    for (const accent of ["ocean", "violet", "forest", "amber"])
      for (const density of ["comfortable", "compact"]) {
        const r = design.resolve({
            thundyAppearance: mode,
            thundyAccent: accent,
            thundyDensity: density,
          }),
          c = r.colors;
        assert.equal(r.thundyDensity, density);
        for (const [fg, bg] of [
          ["--text-color", "--card-bg"],
          ["--text-muted", "--card-bg"],
          ["--color-danger", "--alert-error-bg"],
          ["--color-warning", "--warning-bg"],
          ["--color-success", "--success-bg"],
        ])
          assert.ok(design.contrast(c[fg], c[bg]) >= 4.5, fg);
        assert.ok(design.contrast(c["--input-border"], c["--input-bg"]) >= 3);
        assert.equal(
          c["--control-size"],
          density === "compact" ? "36px" : "44px",
        );
      }
  assert.equal(
    design.normalize({ thundyDensity: "bad" }).thundyDensity,
    "comfortable",
  );
});
test("decorator preserves script payloads and CSP nonces without adding executable code or remote assets", () => {
  const script = 'window.data={score:80,proof:"STAGED"};',
    h =
      '<!doctype html><html lang="en"><head><style nonce="test">body{padding:20px}</style></head><body><main><h1>Report</h1></main><script nonce="test">' +
      script +
      "</script></body></html>",
    d = new JSDOM(decorateHTML(h, "en")).window.document;
  assert.equal(d.querySelector("script").textContent, script);
  assert.equal(d.querySelectorAll("script").length, 1);
  assert.equal(d.querySelector("style").getAttribute("nonce"), "test");
  assert.equal(d.querySelectorAll("link,img,iframe,form").length, 0);
  assert.throws(() => decorateHTML(h, "xx"), /LANGUAGE/);
  assert.throws(() => decorateHTML("x", "en"), /HTML/);
});
for (const lang of Object.keys(labels))
  test(
    "all seven " +
      lang +
      " renderers share offline controls, styles and independent risk/decision/evidence information",
    () => {
      const f = fixtures();
      try {
        for (const kind of Object.keys(f.data)) {
          const dom = new JSDOM(f.html(kind, lang), {
              runScripts: "dangerously",
            }),
            d = dom.window.document;
          assert.equal(d.documentElement.dataset.designVersion, "1");
          assert.equal(d.querySelectorAll("main").length, 1);
          assert.ok(d.querySelector("main .review-toolbar"));
          assert.ok(d.body.classList.contains("admin-page"));
          assert.equal(d.querySelectorAll('[name="review-theme"]').length, 3);
          assert.equal(d.querySelectorAll('[name="review-accent"]').length, 4);
          assert.equal(d.querySelectorAll('[name="review-density"]').length, 2);
          assert.ok(
            d
              .querySelector(".review-toolbar")
              .textContent.includes(labels[lang][14]),
          );
          assert.ok(
            d
              .querySelector("style")
              .textContent.includes("Generated from design_system.js"),
          );
          assert.equal(d.querySelectorAll("img,iframe,link").length, 0);
          assert.equal(
            d.querySelectorAll('[name="review-density"]:checked')[0].value,
            "comfortable",
          );
          if (["health", "capacity"].includes(kind))
            assert.equal(d.querySelectorAll("script").length, 0);
          dom.window.close();
        }
      } finally {
        f.cleanup();
      }
    },
  );
test("event review keeps five primary columns, sortable time and complete details/export payload", () => {
  const f = fixtures();
  try {
    const dom = new JSDOM(f.html("events", "en"), {
        runScripts: "dangerously",
      }),
      d = dom.window.document;
    assert.equal(d.querySelectorAll("thead th").length, 5);
    assert.ok(
      d
        .querySelector("#rows")
        .firstChild.textContent.includes("later.example.invalid"),
    );
    d.getElementById("sort").value = "oldest";
    d.getElementById("sort").dispatchEvent(new dom.window.Event("input"));
    const row = d.querySelector("#rows").firstChild;
    assert.ok(row.textContent.includes("earlier.example.invalid"));
    assert.equal(row.querySelectorAll("td").length, 5);
    assert.ok(row.querySelector("details").textContent.includes("test-device"));
    assert.ok(row.querySelector("details code").textContent.includes("/path"));
    assert.equal(
      JSON.parse(d.getElementById("review-data").textContent).records.length,
      2,
    );
    d.getElementById("outcome").value = "BLOCKED";
    d.getElementById("outcome").dispatchEvent(new dom.window.Event("input"));
    assert.equal(d.querySelector("#rows td").colSpan, 5);
    dom.window.close();
  } finally {
    f.cleanup();
  }
});
