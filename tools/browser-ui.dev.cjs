"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process");
const { chromium } = require("playwright"),
  { AxeBuilder } = require("@axe-core/playwright"),
  { languages, createReviews, addonMock } = require("./ui-fixtures.dev.cjs");
const {
  messageHtml,
  prepareMessage,
  checkMessage,
} = require("./message-flow.dev.cjs");
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

// Synthetic Hybrid-Analysis records for the analysis-protocol cases (FA-A6):
// "stored" renders a finished protocol offline (consent off, no requests),
// "poll" exercises the automatic IN_PROGRESS -> finished transition.
const HYBRID_SHA = "a".repeat(64);
const HYBRID_RECORD = {
  stored: {
    messageHeader: "synthetic-message",
    attachments: [
      {
        hybrid_sha256: HYBRID_SHA,
        attachment_name: "invoice.pdf",
        state: "UPLOADED",
        hybrid_job_id: "job-9",
        hybrid_submission_id: "sub-9",
        partName: "1",
        report: {
          state: "COMPLETE",
          threat_score: 12,
          verdict: "clean",
          sha256: HYBRID_SHA,
          tags: ["synthetic"],
          analysis_start_time: "2026-10-16T09:00:00Z",
        },
        report_fetched_at: "2026-10-16T09:30:00.000Z",
      },
    ],
  },
  poll: {
    messageHeader: "synthetic-message",
    attachments: [
      {
        hybrid_sha256: HYBRID_SHA,
        attachment_name: "invoice.pdf",
        state: "UPLOADED",
        hybrid_job_id: "job-9",
        hybrid_submission_id: "sub-9",
        partName: "1",
      },
    ],
  },
};
// Node-side log of fulfilled overview requests per case id (poll assertions).
const hybridPollLog = {};
async function seedHybridStore(record) {
  await new Promise((resolve, reject) => {
    const openRequest = indexedDB.open("thunderbird_av", 3);
    openRequest.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("hybridanalysis"))
        db.createObjectStore("hybridanalysis", { keyPath: "messageHeader" });
    };
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onsuccess = () => {
      const db = openRequest.result;
      const tx = db.transaction(["hybridanalysis"], "readwrite");
      tx.objectStore("hybridanalysis").put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}
function options(args) {
  const o = { matrix: "full", out: path.join(root, ".audit/ui") };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.slice(2);
    if (
      !args[i]?.startsWith("--") ||
      !["matrix", "out", "browser", "lang", "view"].includes(key) ||
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
    if (p === "/message-fixture") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(messageHtml);
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
  for (const lang of langs)
    for (const width of o.matrix === "smoke" ? [360] : [320, 1280])
      for (const scheme of o.matrix === "smoke"
        ? ["dark"]
        : ["light", "dark"]) {
        for (const file of ["popup.html", "audit.html"])
          cases.push({
            id: `addon-${file}-populated-${lang}-${file === "popup.html" ? Math.max(600, width) : width}-${scheme}`,
            kind: "addon",
            view: file,
            url: "/" + file,
            lang,
            width: file === "popup.html" ? Math.max(600, width) : width,
            scheme,
            populated: true,
          });
        cases.push({
          id: `message-${lang}-${width}-${scheme}`,
          kind: "message",
          view: "message",
          url: "/message-fixture",
          lang,
          width,
          scheme,
        });
      }
  for (const hybrid of ["stored", "poll"])
    for (const lang of o.lang ? [o.lang] : ["en", "de"])
      cases.push({
        id: `hybrid-${hybrid}-${lang}-1280-dark`,
        kind: "addon",
        view: "popup.html",
        url: "/popup.html",
        lang,
        width: 1280,
        scheme: "dark",
        hybrid,
        // The popup only resolves the stored hybrid record when a displayed
        // message exists; without this flag the mock returns an empty
        // message list and the startup path renders the empty-state card.
        populated: true,
      });
  const selected = o.view ? cases.filter((c) => c.view === o.view) : cases;
  if (selected.length === 0) throw Error("UI_VIEW_INVALID");
  return selected;
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
      await page
        .locator("#hybrid_analysis_api_content .card")
        .first()
        .waitFor();
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
  if (c.kind !== "message")
    assert.equal(
      theme,
      c.scheme === "dark" ? "rgb(16, 24, 33)" : "rgb(245, 247, 250)",
      "system theme",
    );
  if (c.kind === "message") return {};
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
  if (c.kind === "message") return;
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
  } else if (c.view === "popup.html" && c.hybrid === "stored") {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(root, "_locales", c.lang, "messages.json")),
    );
    const label = catalog.ui_169.message.split("$")[0].trim();
    const card = page
      .locator("#hybrid_analysis_api_content .card")
      .filter({ hasText: label });
    assert.equal(await card.count(), 1, "stored protocol card rendered");
    const text = await card.first().innerText();
    assert.ok(text.includes("job-9"), "job id shown in protocol");
    assert.ok(text.includes("sub-9"), "submission id shown in protocol");
    assert.ok(text.includes("2026-10-16"), "fetched-at shown in protocol");
    assert.equal(
      await page.locator("#hybrid_analysis_api_content > .card").count(),
      1,
      "exactly one protocol card",
    );
  } else if (c.view === "popup.html" && c.hybrid === "poll") {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(root, "_locales", c.lang, "messages.json")),
    );
    // The finished protocol card is the only one that renders the threat
    // score; the IN_PROGRESS card already shows the protocol metadata, so
    // waiting on the score is what guarantees the poll completed.
    const scoreLabel = catalog.ui_013.message.split("$")[0].trim();
    await page.waitForFunction(
      ([selector, needle]) =>
        (document.querySelector(selector)?.textContent ?? "").includes(needle),
      ["#hybrid_analysis_api_content", `${scoreLabel} 12`],
      { timeout: 15000 },
    );
    assert.equal(
      hybridPollLog[c.id],
      2,
      "overview fetched once for IN_PROGRESS and once for the finished protocol",
    );
  } else if (c.view === "popup.html" && c.populated) {
    assert.equal(
      await page.locator(".local-risk .risk-meter").getAttribute("value"),
      "72",
    );
    assert.equal(
      await page.locator("#subject").innerText(),
      "Synthetic message",
    );
    assert.equal(
      await page.locator("#thundy-consent-notice").isVisible(),
      true,
    );
    assert.equal(await page.evaluate(() => uiTest.permissionRequests), 0);
  } else if (c.view === "audit.html") {
    if (c.populated) {
      assert.equal(await page.locator("#auditRows tr").count(), 2);
      const row = page.locator("#auditRows tr.audit-risky");
      assert.ok(
        (await row.innerText()).includes("72"),
        "decision-time score disappeared",
      );
      const catalog = JSON.parse(
        fs.readFileSync(path.join(root, "_locales", c.lang, "messages.json")),
      );
      const historical = await row.locator("td").nth(3).textContent();
      assert.ok(historical.includes(catalog.auditVerdictAtDecision.message));
      assert.ok(historical.includes(catalog.providerMalicious.message));
      assert.ok(!historical.includes(catalog.providerNoDetection.message));
      assert.equal(
        await row.locator("code").textContent(),
        "https://opened.example.invalid/path?x=1",
      );
      assert.equal(
        await page.locator("#auditRows a").count(),
        0,
        "audit URL became navigable",
      );
      await page.locator("#auditOutcome").selectOption("ABORTED");
      assert.equal(await page.locator("#auditRows tr").count(), 1);
      await page.locator("#auditJson").click();
      await page.waitForFunction(() => uiTest.downloads.length === 1);
      const downloaded = JSON.parse(
        await page.evaluate(() => uiTest.downloads[0].content),
      );
      assert.deepEqual(
        downloaded.payload.records.map((r) => ({
          id: r.id,
          url: r.url,
          score: r.scoreAtDecision,
          outcome: r.outcome,
          verdict: r.verdictAtDecision,
        })),
        [
          {
            id: "synthetic-abort",
            url: "https://aborted.example.invalid/path",
            score: 18,
            outcome: "ABORTED",
            verdict: "UNKNOWN",
          },
        ],
      );
      assert.equal(
        downloaded.sha256,
        require("node:crypto")
          .createHash("sha256")
          .update(JSON.stringify(downloaded.payload))
          .digest("hex"),
      );
      await page.locator("#auditOutcome").selectOption("");
      assert.equal(await page.locator("#auditRows tr").count(), 2);
    }
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
    view: o.view ?? "all",
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
          if (c.kind === "addon" || c.kind === "message")
            await context.addInitScript(addonMock, {
              catalog: JSON.parse(
                fs.readFileSync(
                  path.join(root, "_locales", c.lang, "messages.json"),
                ),
              ),
              lang: c.lang,
              version: require("../manifest.json").version,
              populated: c.populated === true,
              hybrid: c.hybrid ?? null,
            });
          if (c.hybrid === "poll") {
            // Fulfil the overview endpoint synthetically: first request
            // IN_PROGRESS, second request the finished protocol. Registered
            // after the catch-all route, so it takes precedence and the
            // generic external-request guard never sees these requests.
            hybridPollLog[c.id] = 0;
            await context.route("https://hybrid-analysis.com/**", (route) => {
              hybridPollLog[c.id] += 1;
              const body =
                hybridPollLog[c.id] === 1
                  ? { state: "IN_PROGRESS", sha256: HYBRID_SHA }
                  : {
                      state: "COMPLETE",
                      threat_score: 12,
                      verdict: "clean",
                      sha256: HYBRID_SHA,
                      tags: ["synthetic"],
                    };
              return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(body),
              });
            });
          }
          page = await context.newPage();
          page.setDefaultTimeout(10000);
          page.on("pageerror", (e) => errors.push(e.message));
          await page.goto(origin + c.url);
          if (c.hybrid) {
            await page.evaluate(seedHybridStore, HYBRID_RECORD[c.hybrid]);
            await page.reload();
          }
          if (c.kind === "message")
            await prepareMessage(
              page,
              c,
              JSON.parse(
                fs.readFileSync(
                  path.join(root, "_locales", c.lang, "messages.json"),
                ),
              ),
            );
          await ready(page, c);
          Object.assign(result, await checks(page, c));
          await interaction(page, c);
          if (c.kind === "message")
            Object.assign(result, await checkMessage(page, c, tags));
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
