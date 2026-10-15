const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  { JSDOM } = require("jsdom");
const source = fs.readFileSync("theme.js", "utf8");
function setup({
  saved = {},
  native = {},
  dark = false,
  getError = false,
  setError = false,
} = {}) {
  const dom = new JSDOM(fs.readFileSync("options.html", "utf8"), {
      runScripts: "outside-only",
    }),
    w = dom.window,
    calls = [],
    changes = [],
    updates = [];
  w.ThundyI18n = { get: (key) => key };
  w.matchMedia = () => ({ matches: dark, addEventListener: () => {} });
  let state = { ...saved },
    failure = setError;
  w.browser = {
    storage: {
      local: {
        get: async () => {
          if (getError) throw Error("load");
          return { ...state };
        },
        set: async (p) => {
          calls.push({ ...p });
          if (failure) throw Error("save");
          state = { ...state, ...p };
          for (const fn of changes)
            fn(
              Object.fromEntries(
                Object.entries(p).map(([k, newValue]) => [k, { newValue }]),
              ),
              "local",
            );
        },
      },
      onChanged: { addListener: (fn) => changes.push(fn) },
    },
    theme: {
      getCurrent: async () => native,
      onUpdated: { addListener: (fn) => updates.push(fn) },
    },
  };
  w.eval(source + "\nwindow.theme=ThundyTheme;");
  return {
    w,
    dom,
    calls,
    changes,
    updates,
    setFailure: (v) => (failure = v),
    get state() {
      return state;
    },
    close: () => w.close(),
  };
}
const tick = () => new Promise((r) => setTimeout(r, 15));
async function ready(f) {
  await tick();
  return f;
}
function select(f, name, value) {
  const el = f.w.document.querySelector(
    `input[name="${name}"][value="${value}"]`,
  );
  el.checked = true;
  el.dispatchEvent(new f.w.Event("change", { bubbles: true }));
}
test("theme defaults follow the system and do not write or request consent", async () => {
  const f = await ready(setup({ dark: true }));
  try {
    assert.equal(f.w.document.documentElement.dataset.theme, "dark");
    assert.equal(
      f.w.document.querySelector("[name=appearance]:checked").value,
      "system",
    );
    assert.deepEqual(f.calls, []);
  } finally {
    f.close();
  }
});
test("explicit light overrides a dark system and all palettes keep readable controls and risk colors", async () => {
  const f = await ready(setup());
  try {
    for (const mode of ["light", "dark"])
      for (const accent of ["ocean", "violet", "forest", "amber"]) {
        const r = f.w.theme.resolve(
          { thundyAppearance: mode, thundyAccent: accent },
          {},
          mode === "light",
        );
        assert.equal(r.scheme, mode);
        const c = r.colors;
        assert.ok(f.w.theme.contrast(c["--text-color"], c["--card-bg"]) >= 4.5);
        assert.ok(f.w.theme.contrast(c["--text-muted"], c["--card-bg"]) >= 4.5);
        assert.ok(f.w.theme.contrast(c["--link-color"], c["--card-bg"]) >= 4.5);
        assert.ok(f.w.theme.contrast(c["--btn-primary-bg"], "#ffffff") >= 4.5);
        assert.ok(
          f.w.theme.contrast(c["--color-danger"], c["--alert-error-bg"]) >= 4.5,
        );
      }
  } finally {
    f.close();
  }
});
test("rapid appearance choices serialize writes and preserve unrelated scan credentials", async () => {
  const f = await ready(
    setup({ saved: { apikey: "secret", externalAnalysisConsent: true } }),
  );
  try {
    select(f, "appearance", "dark");
    select(f, "accent", "violet");
    select(f, "appearance", "light");
    await tick();
    assert.equal(f.state.thundyAppearance, "light");
    assert.equal(f.state.thundyAccent, "violet");
    assert.equal(f.state.apikey, "secret");
    assert.equal(f.state.externalAnalysisConsent, true);
    assert.equal(f.calls.length, 3);
    assert.ok(
      f.calls.every(
        (p) =>
          Object.keys(p).sort().join(",") === "thundyAccent,thundyAppearance",
      ),
    );
    assert.equal(f.w.document.documentElement.dataset.theme, "light");
  } finally {
    f.close();
  }
});
test("existing pages react only to local theme storage events and reset removed preferences", async () => {
  const f = await ready(setup());
  try {
    for (const fn of f.changes)
      fn(
        {
          thundyAppearance: { newValue: "dark" },
          thundyAccent: { newValue: "forest" },
        },
        "local",
      );
    assert.equal(f.w.document.documentElement.dataset.theme, "dark");
    assert.equal(f.w.document.documentElement.dataset.accent, "forest");
    for (const fn of f.changes)
      fn({ thundyAppearance: { newValue: "light" } }, "sync");
    assert.equal(f.w.document.documentElement.dataset.theme, "dark");
    for (const fn of f.changes)
      fn({ thundyAppearance: {}, thundyAccent: {} }, "local");
    assert.equal(f.w.document.documentElement.dataset.appearance, "system");
    assert.equal(f.w.document.documentElement.dataset.accent, "ocean");
  } finally {
    f.close();
  }
});
test("native Thunderbird popup colors are applied only in automatic mode and update live", async () => {
  const native = { colors: { popup: "#203040", popup_text: "#eeeeee" } },
    f = await ready(setup({ native }));
  try {
    assert.equal(
      f.w.document.documentElement.style.getPropertyValue("--card-bg"),
      "#203040",
    );
    assert.equal(f.w.document.documentElement.dataset.theme, "dark");
    native.colors.popup = "#fff";
    native.colors.popup_text = "#123";
    await f.updates[0]();
    assert.equal(
      f.w.document.documentElement.style.getPropertyValue("--card-bg"),
      "#ffffff",
    );
    select(f, "appearance", "dark");
    await tick();
    assert.equal(
      f.w.document.documentElement.style.getPropertyValue("--card-bg"),
      "#192532",
    );
  } finally {
    f.close();
  }
});
test("invalid, transparent, injected and low-contrast native colors fall back safely", async () => {
  const f = await ready(setup());
  try {
    for (const v of [
      "red;display:none",
      "url(https://evil.test)",
      "rgba(0,0,0,0.5)",
      "#00000000",
      "rgb(999,0,0)",
    ])
      assert.equal(f.w.theme.color(v), null);
    assert.equal(f.w.theme.color("rgb(32,48,64)"), "#203040");
    assert.equal(f.w.theme.color("rgba(32,48,64,1)"), "#203040");
    const r = f.w.theme.resolve(
      { thundyAppearance: "bad", thundyAccent: "__proto__" },
      { colors: { popup: "#fff", popup_text: "#eee" } },
      false,
    );
    assert.equal(r.native, false);
    assert.equal(r.thundyAppearance, "system");
    assert.equal(r.thundyAccent, "ocean");
    assert.equal(
      f.w.theme.normalize({ thundyAccent: { toString: "invalid" } })
        .thundyAccent,
      "ocean",
    );
    assert.equal(r.colors["--card-bg"], "#ffffff");
  } finally {
    f.close();
  }
});
test("failed theme saves keep the choice and expose a working retry without touching scan settings", async () => {
  const f = await ready(setup({ setError: true }));
  try {
    select(f, "appearance", "dark");
    await tick();
    assert.equal(
      f.w.document.getElementById("themeStatus").textContent,
      "themeSaveError",
    );
    assert.equal(f.w.document.getElementById("themeRetry").hidden, false);
    assert.equal(f.w.document.documentElement.dataset.theme, "dark");
    f.setFailure(false);
    f.w.document.getElementById("themeRetry").click();
    await tick();
    assert.equal(f.state.thundyAppearance, "dark");
    assert.equal(f.w.document.getElementById("themeRetry").hidden, true);
    assert.equal(
      f.w.document.getElementById("themeStatus").textContent,
      "themeSaved",
    );
  } finally {
    f.close();
  }
});
test("failed loads are visible and isolated message snapshots contain only safe tokens", async () => {
  const f = await ready(setup({ getError: true }));
  try {
    assert.equal(
      f.w.document.getElementById("themeStatus").textContent,
      "themeLoadError",
    );
    const s = await f.w.theme.snapshot();
    assert.equal(s.scheme, "light");
    assert.ok(s.css.includes("--card-bg:#ffffff;"));
    assert.ok(!s.css.includes("undefined"));
    assert.equal(
      f.w.document.querySelector("[name=appearance]").disabled,
      false,
    );
  } finally {
    f.close();
  }
});
test("link dialogs fetch the latest appearance at click time and keep warning semantics and email styles isolated", async () => {
  const injected = [],
    c = vm.createContext({
      timeOfClickProtection: true,
      msg: (k) => k,
      ThundyTheme: {
        snapshot: async () => ({ scheme: "light", css: "--card-bg:#ffffff;" }),
      },
      browser: { scripting: { executeScript: async (p) => injected.push(p) } },
    });
  vm.runInContext(fs.readFileSync("message_ui.js", "utf8"), c);
  await vm.runInContext("injectTimeOfClickProtection(1,[],7)", c);
  const dom = new JSDOM(
      '<html><head><style>body{background:lime}</style></head><body><a href="https://example.com/">Open</a></body></html>',
      { runScripts: "outside-only" },
    ),
    w = dom.window,
    sent = [];
  try {
    w.args = injected[0].args;
    w.browser = {
      runtime: {
        sendMessage: async (p) => {
          sent.push(p);
          if (p.action === "getUiTheme")
            return {
              scheme: "dark",
              css: "--card-bg:#192532;--text-color:#e7eef7;color-scheme:dark;",
            };
          if (p.action === "checkLinkState")
            return { status: "MALICIOUS", score: 80 };
          return { success: true };
        },
      },
    };
    w.eval("(" + injected[0].func.toString() + ")(...args)");
    const event = new w.MouseEvent("click", {
      button: 0,
      bubbles: true,
      cancelable: true,
    });
    w.document.querySelector("a").dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    await tick();
    const panel = w.document.getElementById("thundy-link-dialog"),
      root = panel.shadowRoot;
    assert.ok(
      root.querySelector("style").textContent.includes("--card-bg:#192532;"),
    );
    assert.equal(
      root.querySelector(".result").classList.contains("danger"),
      true,
    );
    assert.ok(root.querySelector(".primary").classList.contains("warning"));
    assert.equal(
      w.getComputedStyle(w.document.body).backgroundColor,
      "rgb(0, 255, 0)",
    );
    assert.equal(sent[0].action, "getUiTheme");
    root.querySelector("button").click();
    await tick();
    assert.ok(sent.some((p) => p.action === "cancelLinkInteraction"));
    assert.equal(w.document.getElementById("thundy-link-dialog"), null);
  } finally {
    w.close();
  }
});
test("an unavailable theme refresh never delays interception or the security result", async () => {
  const injected = [],
    c = vm.createContext({
      timeOfClickProtection: true,
      msg: (k) => k,
      ThundyTheme: { snapshot: async () => ({ css: "--card-bg:#ffffff;" }) },
      browser: { scripting: { executeScript: async (p) => injected.push(p) } },
    });
  vm.runInContext(fs.readFileSync("message_ui.js", "utf8"), c);
  await vm.runInContext("injectTimeOfClickProtection(1,[],7)", c);
  const dom = new JSDOM('<a href="https://example.com/">Open</a>', {
      runScripts: "outside-only",
    }),
    w = dom.window;
  try {
    w.args = injected[0].args;
    w.browser = {
      runtime: {
        sendMessage: async (p) =>
          p.action === "getUiTheme"
            ? new Promise(() => {})
            : { status: "CLEAN", score: 0 },
      },
    };
    w.eval("(" + injected[0].func.toString() + ")(...args)");
    const event = new w.MouseEvent("click", {
      button: 0,
      bubbles: true,
      cancelable: true,
    });
    w.document.querySelector("a").dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.ok(w.document.getElementById("thundy-link-dialog"));
    await tick();
    assert.ok(
      w.document
        .getElementById("thundy-link-dialog")
        .shadowRoot.querySelector(".primary"),
    );
  } finally {
    w.close();
  }
});
