"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process");
const { chromium } = require("playwright"),
  { AxeBuilder } = require("@axe-core/playwright"),
  { languages, createReviews, addonMock } = require("./ui-fixtures.dev.cjs");
const root = path.resolve(__dirname, ".."),
  addonFiles = [
    "options.html",
    "onboarding.html",
    "enterprise_setup.html",
    "audit.html",
    "privacy.html",
    "popup.html",
  ],
  tags = [
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
    "best-practice",
  ];
function options(args) {
  const o = { matrix: "full", out: path.join(root, ".audit/ui") };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.slice(2);
    if (
      !args[i]?.startsWith("--") ||
      !["matrix", "out", "browser", "lang"].includes(key) ||
      !args[i + 1] ||
      Object.hasOwn(o, "provided-" + key)
    )
      throw Error("UI_ARGUMENT_INVALID");
    o[key] = args[i + 1];
    o["provided-" + key] = true;
  }
  if (!["smoke", "full"].includes(o.matrix)) throw Error("UI_MATRIX_INVALID");
  if (o.lang !== undefined && !languages.includes(o.lang))
    throw Error("UI_LANGUAGE_INVALID");
  o.out = path.resolve(o.out);
  return o;
}
function startServer(reviews) {
  const allowed = new Set(
    require("../scripts/verify-package.js").ALLOWED_FILES,
  );
  for (const name of fs.readdirSync(path.join(root, "img")))
    if (/\.png$/.test(name)) allowed.add("img/" + name);
  return http.createServer((req, res) => {
    const p = new URL(req.url, "http://localhost").pathname;
    const review = reviews.pages.get(p);
    if (review !== undefined) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(review);
    }
    const file = p.slice(1);
    if (!allowed.has(file)) {
      res.statusCode = 404;
      return res.end("Not found");
    }
    const types = {
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".html": "text/html; charset=utf-8",
    };
    res.setHeader("Content-Type", types[path.extname(file)] || "text/plain");
    res.end(fs.readFileSync(path.join(root, file)));
  });
}
function matrix(o, kinds) {
  const cases = [],
    langs = o.lang ? [o.lang] : o.matrix === "smoke" ? ["en", "de"] : languages;
  for (const kind of kinds)
    for (const lang of langs)
      for (const state of o.matrix === "smoke" ? ["full"] : ["full", "empty"])
        for (const width of o.matrix === "smoke" ? [360] : [320, 1280])
          for (const scheme of o.matrix === "smoke"
            ? ["dark"]
            : ["light", "dark"])
            cases.push({
              id: `review-${kind}-${state}-${lang}-${width}-${scheme}`,
              kind: "review",
              view: kind,
              url: `/review/${kind}/${state}/${lang}`,
              lang,
              state,
              width,
              scheme,
            });
  for (const file of addonFiles)
    for (const lang of langs)
      for (const width of o.matrix === "smoke" ? [360] : [320, 1280])
        for (const scheme of o.matrix === "smoke"
          ? ["dark"]
          : ["light", "dark"])
          cases.push({
            id: `addon-${file}-${lang}-${file === "popup.html" ? Math.max(600, width) : width}-${scheme}`,
            kind: "addon",
            view: file,
            url: "/" + file,
            lang,
            width: file === "popup.html" ? Math.max(600, width) : width,
            scheme,
          });
  return cases;
}
async function ready(page, c) {
  await page.waitForFunction(
    (lang) => document.documentElement.lang === lang,
    c.lang,
  );
  if (c.kind === "addon") {
    if (c.view === "options.html")
      await page
        .locator('[name="appearance"]')
        .first()
        .waitFor({ state: "attached" });
    if (c.view === "enterprise_setup.html")
      await page.waitForFunction(
        () => !document.getElementById("profileSave").disabled,
      );
    if (c.view === "onboarding.html")
      await page.waitForFunction(
        () => !document.getElementById("next").disabled,
      );
    if (c.view === "popup.html")
      await page.locator("#hybrid_analysis_api_content .card").waitFor();
    if (c.view === "audit.html")
      await page.waitForFunction(
        () => document.getElementById("auditJson").disabled === false,
      );
  }
}
async function checks(page, c) {
  assert.equal(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    true,
    "horizontal page overflow",
  );
  const theme = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  assert.equal(
    theme,
    c.scheme === "dark" ? "rgb(16, 24, 33)" : "rgb(245, 247, 250)",
    "system theme",
  );
  const axe = await new AxeBuilder({ page }).withTags(tags).analyze();
  if (axe.violations.length) {
    const error = new Error("UI_ACCESSIBILITY_VIOLATIONS");
    error.violations = axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.helpUrl,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
    throw error;
  }
  return {
    rulesPassed: axe.passes.length,
    incomplete: axe.incomplete.map((r) => ({
      id: r.id,
      targets: r.nodes.map((n) => n.target),
    })),
  };
}
async function interaction(page, c) {
  if (c.kind === "review") {
    const summary = page.locator(".review-appearance>summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    const light = page.locator('[name="review-theme"][value="light"]');
    await light.focus();
    await page.keyboard.press("Space");
    assert.equal(await light.isChecked(), true, "keyboard theme selection");
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.locator('[name="review-theme"][value="dark"]').isChecked(),
      true,
      "keyboard radio navigation",
    );
    await page.locator('[name="review-accent"][value="violet"]').check();
    await page.locator('[name="review-density"][value="compact"]').check();
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
      "rgb(16, 24, 33)",
      "explicit theme",
    );
    await summary.click();
    const download = page.locator("#download");
    if (await download.count()) {
      const read = async () => {
        const waiting = page.waitForEvent("download");
        await download.click();
        const file = await (await waiting).path();
        return JSON.parse(fs.readFileSync(file, "utf8"));
      };
      const before = await read(),
        search = page.locator("#query,#search");
      if (await search.count()) await search.first().fill("synthetic-no-match");
      assert.deepEqual(
        await read(),
        before,
        "complete export changed after filter",
      );
    }
  } else if (c.view === "options.html") {
    await page.waitForFunction(
      () => !document.querySelector('[name="appearance"]').disabled,
    );
    for (const accent of ["ocean", "violet", "forest", "amber"]) {
      await page
        .locator(`label:has([name="accent"][value="${accent}"])`)
        .click();
      await page.waitForFunction(
        (a) => document.documentElement.dataset.accent === a,
        accent,
      );
    }
    await page.locator('label:has([name="density"][value="compact"])').click();
    await page.waitForFunction(
      () => document.documentElement.dataset.density === "compact",
    );
    assert.equal(
      await page.locator("#externalAnalysisConsent").isChecked(),
      false,
    );
    assert.equal(
      await page.evaluate(
        () =>
          uiTest.writes.every((p) =>
            Object.keys(p).every((k) =>
              ["thundyAppearance", "thundyAccent", "thundyDensity"].includes(k),
            ),
          ) && uiTest.permissionRequests === 0,
      ),
      true,
      "appearance changed consent",
    );
  } else if (c.view === "enterprise_setup.html") {
    await page.locator("#profileBundle").selectOption("microsoft");
    assert.equal(await page.locator("#profileChanges").isVisible(), true);
    await page.locator("#profileDiscard").click();
    assert.equal(await page.locator("#profileChanges").isVisible(), false);
    await page.evaluate(() => (uiTest.failSave = true));
    await page.locator("#profileBundle").selectOption("openSource");
    await page.locator("#profileSave").click();
    assert.equal(
      await page.locator("#profileChanges").isVisible(),
      true,
      "failed save lost draft",
    );
  } else if (c.view === "audit.html") {
    await page.locator("#auditClear").click();
    assert.equal(
      await page.locator("#auditConfirm").evaluate((el) => el.open),
      true,
    );
    const dialog = await new AxeBuilder({ page }).withTags(tags).analyze();
    assert.deepEqual(
      dialog.violations.map((v) => v.id),
      [],
      "audit dialog accessibility",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("#auditConfirm").evaluate((el) => el.open),
      false,
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "auditClear",
      "dialog focus return",
    );
  } else if (c.view === "onboarding.html") {
    for (let i = 1; i <= 2; i++) {
      await page.locator("#next").click();
      assert.equal(
        await page.evaluate(
          (step) =>
            document.activeElement ===
            document.querySelector("#step" + step + " h2"),
          i,
        ),
        true,
        "wizard focus",
      );
    }
  }
  assert.equal(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    true,
    "overflow after interaction",
  );
}
async function main() {
  const o = options(process.argv.slice(2));
  o.out = path.join(
    o.out,
    new Date().toISOString().replaceAll(":", "-") +
      "-" +
      require("node:crypto").randomUUID().slice(0, 8),
  );
  fs.mkdirSync(o.out, { recursive: true, mode: 0o700 });
  const reviews = createReviews(),
    server = startServer(reviews);
  let browser;
  const report = {
    schemaVersion: 1,
    kind: "thundy-browser-ui-check",
    matrix: o.matrix,
    language: o.lang ?? "all",
    startedAt: new Date().toISOString(),
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    sourceDirty:
      execFileSync("git", ["status", "--porcelain"], {
        cwd: root,
        encoding: "utf8",
      }).trim().length > 0,
    syntheticBrowserAPIs: true,
    realThunderbirdVerified: false,
    screenReaderVerified: false,
    wcagCertification: false,
    axeTags: tags,
    results: [],
  };
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({
      ...(o.browser ? { executablePath: o.browser } : {}),
      args: process.getuid?.() === 0 ? ["--no-sandbox"] : [],
    });
    report.browser = browser.version();
    report.playwright = require("playwright/package.json").version;
    report.axe = require("axe-core/package.json").version;
    const jobs = matrix(o, reviews.kinds);
    report.planned = jobs.length;
    let cursor = 0;
    const worker = async () => {
      while (cursor < jobs.length) {
        const c = jobs[cursor++],
          result = { ...c },
          errors = [],
          network = [],
          context = await browser.newContext({
            viewport: { width: c.width, height: 1000 },
            colorScheme: c.scheme,
            acceptDownloads: true,
            locale: c.lang,
          });
        let page;
        try {
          await context.route("**/*", (route) => {
            const url = route.request().url();
            if (url.startsWith(origin + "/") || url.startsWith("blob:"))
              return route.continue();
            network.push(url);
            return route.abort("blockedbyclient");
          });
          if (c.kind === "addon")
            await context.addInitScript(addonMock, {
              catalog: JSON.parse(
                fs.readFileSync(
                  path.join(root, "_locales", c.lang, "messages.json"),
                ),
              ),
              lang: c.lang,
              version: require("../manifest.json").version,
            });
          page = await context.newPage();
          page.setDefaultTimeout(10000);
          page.on("pageerror", (e) => errors.push(e.message));
          await page.goto(origin + c.url);
          await ready(page, c);
          Object.assign(result, await checks(page, c));
          await interaction(page, c);
          assert.deepEqual(errors, [], "page errors");
          assert.deepEqual(network, [], "external requests");
          result.status = "passed";
        } catch (error) {
          result.status = "failed";
          result.error = error.message;
          if (error.violations) result.violations = error.violations;
          result.pageErrors = errors;
          result.externalRequests = network;
          await page
            ?.screenshot({
              path: path.join(o.out, c.id + ".png"),
              fullPage: true,
            })
            .catch(() => {});
        } finally {
          await context.close();
          report.results.push(result);
          if (report.results.length % 25 === 0)
            console.log(
              `UI progress: ${report.results.length}/${report.planned}`,
            );
          if (result.status === "failed")
            process.stderr.write(c.id + ": " + result.error + "\n");
        }
      }
    };
    const outcomes = await Promise.allSettled([worker(), worker()]);
    for (const outcome of outcomes)
      if (outcome.status === "rejected") throw outcome.reason;
    assert.equal(
      report.results.length,
      report.planned,
      "incomplete browser matrix",
    );
  } catch (error) {
    report.fatalError = error.message;
    throw error;
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
    reviews.cleanup();
    report.finishedAt = new Date().toISOString();
    report.passed = report.results.filter((r) => r.status === "passed").length;
    report.failed = report.results.filter((r) => r.status === "failed").length;
    report.results.sort((a, b) => a.id.localeCompare(b.id));
    fs.writeFileSync(
      path.join(o.out, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
      { mode: 0o600 },
    );
  }
  console.log(
    JSON.stringify({
      matrix: o.matrix,
      passed: report.passed,
      failed: report.failed,
      report: path.join(o.out, "report.json"),
    }),
  );
  if (report.failed) process.exitCode = 1;
}
if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { options, matrix };
