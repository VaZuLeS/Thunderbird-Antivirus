"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  { AxeBuilder } = require("@axe-core/playwright"),
  design = require("../design_system.js");
const messageHtml =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic message</title><style>body{font:16px/1.5 system-ui;background:#e2e8f0;color:#17243a;padding:16px;margin:0}a{color:#075985}button,section,header,footer{font-size:4px!important;color:#e2e8f0!important;background:#e2e8f0!important}h1{font-size:22px}</style></head><body><main><h1>Synthetic message</h1><p><a id="message-link" href="https://destination.example.invalid/path?test=1">destination.example.invalid</a></p><button id="outside">Outside</button></main></body></html>';
async function injection(catalog, scheme) {
  let captured;
  const resolved = design.resolve({}, {}, scheme === "dark"),
    theme = {
      scheme,
      css:
        Object.entries(resolved.colors)
          .map(([k, v]) => k + ":" + v)
          .join(";") +
        ";color-scheme:" +
        scheme +
        ";",
    };
  const context = vm.createContext({
    timeOfClickProtection: true,
    msg: (key) => catalog[key]?.message || key,
    ThundyTheme: { snapshot: async () => theme },
    browser: {
      scripting: {
        executeScript: async ({ func, args }) => {
          captured = { source: func.toString(), args };
        },
      },
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../message_ui.js"), "utf8"),
    context,
  );
  await vm.runInContext("injectTimeOfClickProtection(1, [], 42)", context);
  return JSON.parse(JSON.stringify(captured));
}
async function prepareMessage(page, c, catalog) {
  const payload = await injection(catalog, c.scheme);
  await page.evaluate(
    ({ source, args, lang }) => {
      document.documentElement.lang = lang;
      const old = browser.runtime.sendMessage;
      Object.assign(uiTest, {
        calls: [],
        openSucceeds: false,
        checkStatus: "MALICIOUS",
        deferCheck: false,
      });
      browser.runtime.sendMessage = async (request) => {
        uiTest.calls.push({ ...request });
        if (request.action === "getUiTheme") return null;
        if (request.action === "checkLinkState") {
          if (uiTest.deferCheck)
            await new Promise((resolve) => {
              uiTest.resolveCheck = resolve;
            });
          return {
            status: uiTest.checkStatus,
            score: uiTest.checkStatus === "CLEAN" ? 0 : 72,
            reasons: [],
            auditSaved: true,
          };
        }
        if (request.action === "openCheckedLink")
          return { success: uiTest.openSucceeds };
        return old(request);
      };
      // The function is serialized from the repository's actual executeScript
      // request, matching the Thunderbird injection boundary, not a duplicate UI.
      (0, eval)("(" + source + ")")(...args);
    },
    { ...payload, lang: c.lang },
  );
}
async function checkMessage(page, c, tags) {
  const link = page.locator("#message-link"),
    dialog = page.locator("#thundy-link-dialog"),
    proceed = dialog.locator("button.primary"),
    cancel = dialog.locator("footer button").first();
  const open = async () => {
    await link.click();
    await proceed.waitFor();
  };
  const focused = () =>
    page.evaluate(
      () =>
        document.getElementById("thundy-link-dialog")?.shadowRoot.activeElement
          ?.tagName,
    );
  await open();
  assert.equal(await dialog.getAttribute("role"), "alertdialog");
  assert.ok((await dialog.getAttribute("aria-label")).includes("Thundy AV"));
  assert.equal(await focused(), "BUTTON");
  assert.equal(
    await dialog
      .locator(".dialog")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    c.scheme === "dark" ? "rgb(25, 37, 50)" : "rgb(255, 255, 255)",
    "email styles escaped the shadow boundary",
  );
  const axe = await new AxeBuilder({ page })
    .include("#thundy-link-dialog")
    .withTags(tags)
    .analyze();
  assert.deepEqual(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    "message dialog accessibility",
  );
  const bounds = await dialog.locator(".dialog").boundingBox();
  assert.ok(
    bounds.width >= 250 && bounds.x >= 0 && bounds.x + bounds.width <= c.width,
    "dialog width contract",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(await focused(), "SUMMARY");
  await page.keyboard.press("Tab");
  assert.equal(await focused(), "BUTTON");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "message-link",
  );
  assert.equal(
    await page.evaluate(
      () =>
        uiTest.calls.filter((c) => c.action === "cancelLinkInteraction").at(-1)
          .reason,
    ),
    "escape",
  );
  // Result meanings remain separate: a clean provider result is not a guarantee,
  // unknown results keep their warning presentation, and middle-click is intercepted.
  await page.evaluate(() => (uiTest.checkStatus = "CLEAN"));
  await link.focus();
  await page.keyboard.press("Enter");
  await proceed.waitFor();
  assert.equal(
    await proceed.evaluate((el) => el.classList.contains("warning")),
    false,
  );
  await cancel.click();
  await dialog.waitFor({ state: "detached" });
  await page.evaluate(() => (uiTest.checkStatus = "UNKNOWN"));
  await link.click({ button: "middle" });
  await proceed.waitFor();
  assert.equal(await dialog.locator(".result.unknown").count(), 1);
  await cancel.click();
  await dialog.waitFor({ state: "detached" });
  await page.evaluate(() => (uiTest.checkStatus = "MALICIOUS"));
  // A failed asynchronous opening must retain a keyboard-operable retry/cancel UI.
  await open();
  await proceed.click();
  await dialog.locator(".error").filter({ hasText: /./ }).waitFor();
  assert.equal(
    await focused(),
    "BUTTON",
    "focus lost after asynchronous opening failure",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  // Retry uses the same interaction and original destination, without a direct navigation.
  await open();
  await proceed.click();
  await dialog.locator(".error").filter({ hasText: /./ }).waitFor();
  await page.evaluate(() => (uiTest.openSucceeds = true));
  await proceed.click();
  await dialog.waitFor({ state: "detached" });
  const calls = await page.evaluate(() => uiTest.calls),
    attempts = calls.filter((v) => v.action === "openCheckedLink"),
    last = attempts.at(-1);
  assert.equal(attempts.at(-2).interactionId, last.interactionId);
  assert.equal(attempts.at(-2).url, last.url);
  assert.equal(last.messageId, 42);
  assert.ok(
    !calls.some(
      (v) =>
        v.action === "cancelLinkInteraction" &&
        v.interactionId === last.interactionId,
    ),
    "successful opening was also cancelled",
  );
  // Cancelling while checking cannot be undone by a late response.
  await page.evaluate(() => {
    uiTest.deferCheck = true;
    uiTest.openSucceeds = false;
  });
  await link.click();
  await cancel.waitFor();
  await cancel.click();
  await page.evaluate(() => uiTest.resolveCheck());
  await dialog.waitFor({ state: "detached" });
  // A changed message link must never open the previously assessed destination.
  await page.evaluate(() => (uiTest.deferCheck = false));
  await open();
  const count = await page.evaluate(
    () => uiTest.calls.filter((v) => v.action === "openCheckedLink").length,
  );
  await link.evaluate((el) => (el.href = "https://changed.example.invalid/"));
  await proceed.click();
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(
      () => uiTest.calls.filter((v) => v.action === "openCheckedLink").length,
    ),
    count,
  );
  assert.equal(
    await page.evaluate(
      () =>
        uiTest.calls.filter((v) => v.action === "cancelLinkInteraction").at(-1)
          .reason,
    ),
    "destination_changed",
  );
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    "rgb(226, 232, 240)",
    "message appearance changed",
  );
  return {
    rulesPassed: axe.passes.length,
    incomplete: axe.incomplete.map((r) => ({
      id: r.id,
      targets: r.nodes.map((n) => n.target),
    })),
    messageFlows: [
      "keyboard-link",
      "clean-result",
      "unknown-middle-click",
      "escape",
      "opening-failure",
      "retry",
      "cancel-while-checking",
      "destination-change",
    ],
  };
}
module.exports = { messageHtml, prepareMessage, checkMessage };
