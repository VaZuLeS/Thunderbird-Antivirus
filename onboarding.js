"use strict";
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id),
    languages = ["en", "de", "fr", "es", "it", "pl"];
  let step = 0,
    busy = false,
    ready = false,
    externalEnabled = false,
    catalog = {},
    language = "en",
    languageLoad = 0,
    finishMode = null;
  const text = (key) => catalog[key]?.message || ThundyI18n.get(key);
  function render(focus = false) {
    document.documentElement.lang = language;
    document.title = "Thundy AV — " + text("wizardTitle");
    for (const el of document.querySelectorAll("[data-i18n]"))
      el.textContent = text(el.dataset.i18n);
    for (let i = 0; i < 3; i++) {
      $("step" + i).hidden = i !== step;
      const item = $("progress").children[i];
      if (i === step) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    }
    $("progress").setAttribute("aria-label", text("wizardTitle"));
    $("back").hidden = step === 0;
    $("next").hidden = step === 2;
    $("finish").hidden = step !== 2;
    $("keepLabel").textContent = text(
      externalEnabled ? "wizardKeepExisting" : "wizardKeepLocal",
    );
    $("externalStatus").textContent = text(
      externalEnabled ? "wizardExistingExternal" : "wizardLocalNotice",
    );
    if (finishMode) {
      $("done").querySelector("h2").textContent = text(
        finishMode === "saved" ? "wizardDone" : "wizardDeferred",
      );
      $("doneText").textContent = text(
        finishMode === "saved" ? "wizardDoneText" : "wizardDeferredText",
      );
    }
    $("finish").textContent = text(
      document.querySelector("input[name=external]:checked").value ===
        "configure"
        ? "wizardFinishConfigure"
        : "wizardFinish",
    );
    for (const el of document.querySelectorAll(
      "#setup button,#setup input,#language",
    ))
      el.disabled = busy || !ready;
    if (focus)
      $("step" + step)
        .querySelector("h2")
        .focus();
  }
  async function loadLanguage(value) {
    const token = ++languageLoad;
    try {
      const response = await fetch(
        browser.runtime.getURL("_locales/" + value + "/messages.json"),
      );
      if (!response.ok) throw new Error("CATALOG");
      const result = await response.json();
      if (token !== languageLoad) return;
      catalog = result;
      language = value;
      render();
    } catch {
      if (token !== languageLoad) return;
      $("status").textContent = text("wizardLanguageFailed");
      $("language").value = language;
    }
  }
  $("language").addEventListener("change", () =>
    loadLanguage($("language").value),
  );
  $("next").addEventListener("click", () => {
    if (ready && !busy && step < 2) {
      step++;
      render(true);
    }
  });
  $("back").addEventListener("click", () => {
    if (ready && !busy && step > 0) {
      step--;
      render(true);
    }
  });
  for (const el of document.querySelectorAll("input[name=external]"))
    el.addEventListener("change", () => render());
  async function openSettings() {
    try {
      await browser.runtime.openOptionsPage();
      $("status").textContent = text("wizardSettingsOpened");
    } catch {
      $("status").textContent = text("wizardSettingsFailed");
    }
  }
  $("settings").addEventListener("click", openSettings);
  $("skip").addEventListener("click", () => {
    if (busy) return;
    finishMode = "deferred";
    $("setup").hidden = true;
    $("progress").hidden = true;
    $("done").hidden = false;
    $("done").querySelector("h2").textContent = text("wizardDeferred");
    $("doneText").textContent = text("wizardDeferredText");
    $("done").querySelector("h2").focus();
  });
  $("setup").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ready || busy || finishMode || step !== 2) return;
    busy = true;
    render();
    $("status").textContent = "";
    const configure =
      document.querySelector("input[name=external]:checked").value ===
      "configure";
    try {
      await browser.storage.local.set({
        timeOfClickProtection: $("linkProtection").checked,
        onboardingState: {
          schemaVersion: 1,
          status: "completed",
          completedAt: new Date().toISOString(),
        },
      });
      finishMode = "saved";
      $("setup").hidden = true;
      $("progress").hidden = true;
      $("done").hidden = false;
      $("doneText").textContent = text("wizardDoneText");
      $("done").querySelector("h2").focus();
      if (configure) await openSettings();
    } catch {
      $("status").textContent = text("wizardSaveFailed");
    } finally {
      busy = false;
      render();
    }
  });
  render();
  try {
    const stored = await browser.storage.local.get([
      "timeOfClickProtection",
      "externalAnalysisConsent",
    ]);
    $("linkProtection").checked = stored.timeOfClickProtection !== false;
    externalEnabled = stored.externalAnalysisConsent === true;
    let uiLanguage = browser.i18n.getUILanguage().toLowerCase().split("-")[0];
    if (!languages.includes(uiLanguage)) uiLanguage = "en";
    language = uiLanguage;
    $("language").value = uiLanguage;
    await loadLanguage(uiLanguage);
    ready = true;
    render();
  } catch {
    $("status").textContent = text("wizardLoadFailed");
  }
});
