const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const { JSDOM } = require("jsdom");
const locales = Object.fromEntries(
  ["en", "de", "fr", "es", "it", "pl"].map((lang) => [
    lang,
    JSON.parse(fs.readFileSync("_locales/" + lang + "/messages.json", "utf8")),
  ]),
);
const tick = () => new Promise((r) => setImmediate(r));
async function fixture(
  t,
  {
    language = "en",
    stored = {},
    saveError = false,
    loadError = false,
    optionsError = false,
  } = {},
) {
  const dom = new JSDOM(fs.readFileSync("onboarding.html", "utf8"), {
    runScripts: "outside-only",
    url: "https://extension.invalid/onboarding.html",
  });
  t.after(() => dom.window.close());
  await new Promise((r) =>
    dom.window.document.readyState === "loading"
      ? dom.window.document.addEventListener("DOMContentLoaded", r, {
          once: true,
        })
      : r(),
  );
  const state = {
    writes: [],
    options: 0,
    requests: 0,
    fetches: [],
    saveError,
    stored: { ...stored },
  };
  dom.window.browser = {
    runtime: {
      getURL: (path) => "moz-extension://test/" + path,
      openOptionsPage: async () => {
        state.options++;
        if (optionsError) throw new Error("open");
      },
    },
    i18n: {
      getUILanguage: () => language,
      getMessage: (key) =>
        (locales[language.split("-")[0]] || locales.en)[key]?.message || "",
    },
    storage: {
      local: {
        get: async () => {
          if (loadError) throw new Error("load");
          return { ...state.stored };
        },
        set: async (value) => {
          if (state.saveError) throw new Error("save");
          state.writes.push(value);
          Object.assign(state.stored, value);
        },
      },
    },
    permissions: {
      request: async () => {
        state.requests++;
        return true;
      },
    },
  };
  dom.window.fetch = async (url) => {
    state.fetches.push(url);
    const lang = url.match(
      /^moz-extension:\/\/test\/_locales\/(en|de|fr|es|it|pl)\/messages.json$/,
    )?.[1];
    assert.ok(lang, "only bundled catalogs");
    return { ok: true, json: async () => locales[lang] };
  };
  dom.window.eval(fs.readFileSync("i18n.js", "utf8")+"\n"+fs.readFileSync("onboarding.js", "utf8"));
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  await tick();
  await tick();
  const $ = (id) => dom.window.document.getElementById(id);
  const finish = async () => {
    $("next").click();
    $("next").click();
    $("setup").dispatchEvent(
      new dom.window.Event("submit", { cancelable: true }),
    );
    await tick();
  };
  return { dom, state, $, finish };
}
for (const language of Object.keys(locales))
  test(
    language +
      " wizard finishes locally without permissions, API keys or consent writes",
    async (t) => {
      const f = await fixture(t, {
        language,
        stored: {
          apikey: "keep",
          externalAnalysisConsent: false,
          scanningEnabledSenders: ["user@example.org"],
        },
      });
      assert.equal(f.dom.window.document.documentElement.lang, language);
      assert.equal(f.$("next").disabled, false);
      assert.equal(f.$("step0").hidden, false);
      await f.finish();
      assert.equal(f.state.writes.length, 1);
      assert.deepEqual(Object.keys(f.state.writes[0]).sort(), [
        "onboardingState",
        "timeOfClickProtection",
      ]);
      assert.equal(f.state.stored.onboardingState.status, "completed");
      assert.equal(f.state.stored.timeOfClickProtection, true);
      assert.equal(f.state.stored.apikey, "keep");
      assert.equal(f.state.requests, 0);
      assert.equal(f.state.options, 0);
      assert.equal(f.$("done").hidden, false);
      assert.equal(f.$("setup").hidden, true);
    },
  );
test("reopened wizard preserves active consent and user link-protection choice", async (t) => {
  const f = await fixture(t, {
    stored: {
      externalAnalysisConsent: true,
      timeOfClickProtection: false,
      privacyTier: "max",
      apikey: "keep",
    },
  });
  assert.equal(f.$("linkProtection").checked, false);
  f.$("next").click();
  f.$("next").click();
  assert.equal(
    f.$("externalStatus").textContent,
    locales.en.wizardExistingExternal.message,
  );
  f.$("setup").dispatchEvent(
    new f.dom.window.Event("submit", { cancelable: true }),
  );
  await tick();
  assert.equal(f.state.stored.externalAnalysisConsent, true);
  assert.equal(f.state.stored.privacyTier, "max");
  assert.equal(f.state.stored.timeOfClickProtection, false);
});
test("external configuration opens options only after save; failed opening is retryable", async (t) => {
  const f = await fixture(t, { optionsError: true });
  f.dom.window.document.querySelector("input[value=configure]").checked = true;
  await f.finish();
  assert.equal(f.state.options, 1);
  assert.equal(f.state.requests, 0);
  assert.equal(f.state.stored.externalAnalysisConsent, undefined);
  assert.equal(
    f.$("status").textContent,
    locales.en.wizardSettingsFailed.message,
  );
  f.$("settings").click();
  await tick();
  assert.equal(f.state.options, 2);
});
test("save failure keeps choices visible and successful retry completes setup", async (t) => {
  const f = await fixture(t, { saveError: true });
  f.$("linkProtection").checked = false;
  await f.finish();
  assert.equal(f.$("setup").hidden, false);
  assert.equal(f.$("status").textContent, locales.en.wizardSaveFailed.message);
  assert.equal(f.state.writes.length, 0);
  f.state.saveError = false;
  f.$("setup").dispatchEvent(
    new f.dom.window.Event("submit", { cancelable: true }),
  );
  await tick();
  assert.equal(f.state.stored.timeOfClickProtection, false);
});
test("postponing setup saves nothing and retains deferred wording after changing language", async (t) => {
  const f = await fixture(t);
  f.$("skip").click();
  f.$("language").value = "de";
  f.$("language").dispatchEvent(new f.dom.window.Event("change"));
  await tick();
  assert.equal(f.state.writes.length, 0);
  assert.equal(
    f.$("done").querySelector("h2").textContent,
    locales.de.wizardDeferred.message,
  );
});
test("storage load failure prevents overwriting defaults", async (t) => {
  const f = await fixture(t, { loadError: true });
  assert.equal(f.$("next").disabled, true);
  assert.equal(f.$("status").textContent, locales.en.wizardLoadFailed.message);
  f.$("setup").dispatchEvent(
    new f.dom.window.Event("submit", { cancelable: true }),
  );
  await tick();
  assert.equal(f.state.writes.length, 0);
});
test("unsupported locale falls back to bundled English and navigation saves only on finish", async (t) => {
  const f = await fixture(t, { language: "nl-NL" });
  assert.equal(f.dom.window.document.documentElement.lang, "en");
  f.$("next").click();
  f.$("back").click();
  assert.equal(f.state.writes.length, 0);
  assert.equal(
    f.dom.window.document.querySelector("[aria-current=step]").textContent,
    locales.en.wizardWelcome.message,
  );
});
