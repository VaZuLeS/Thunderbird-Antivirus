/* Shared local appearance preferences. No scan settings or permissions are changed. */
const ThundyTheme = (() => {
  const modes = ["system", "light", "dark"];
  const accents = {
    ocean: ["#146b80", "#82d6e9", "#e9f5f7", "#193541"],
    violet: ["#6943b8", "#c7b4ff", "#f1edfb", "#302746"],
    forest: ["#246b4c", "#8edcb5", "#ebf5ef", "#1c392d"],
    amber: ["#90530f", "#f2c48a", "#fbf2e6", "#403022"],
  };
  const keys = ["thundyAppearance", "thundyAccent"];
  const light = {
    "--bg-color": "#f5f7fa",
    "--text-color": "#192b40",
    "--text-muted": "#536579",
    "--card-bg": "#ffffff",
    "--card-border": "#dce3ec",
    "--input-bg": "#f9fbfd",
    "--input-border": "#96a7ba",
    "--color-success": "#216341",
    "--color-warning": "#92510d",
    "--color-danger": "#b32642",
    "--color-info": "#146b80",
    "--alert-error-bg": "#fff0f3",
    "--warning-bg": "#fff4e5",
  };
  const dark = {
    "--bg-color": "#101821",
    "--text-color": "#e7eef7",
    "--text-muted": "#afbed0",
    "--card-bg": "#192532",
    "--card-border": "#35465a",
    "--input-bg": "#131e2a",
    "--input-border": "#697d95",
    "--color-success": "#92ddb3",
    "--color-warning": "#f2c48a",
    "--color-danger": "#ffa5b6",
    "--color-info": "#82d6e9",
    "--alert-error-bg": "#412333",
    "--warning-bg": "#3c3021",
  };
  const api = typeof browser !== "undefined" ? browser : null;
  const media =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-color-scheme: dark)")
      : null;
  const normalize = (p) => ({
    thundyAppearance: modes.includes(p?.thundyAppearance)
      ? p.thundyAppearance
      : "system",
    thundyAccent:
      typeof p?.thundyAccent === "string" &&
      Object.hasOwn(accents, p.thundyAccent)
        ? p.thundyAccent
        : "ocean",
  });
  // Accept only opaque native colors. Never interpolate arbitrary theme strings into CSS.
  function color(input) {
    if (typeof input !== "string") return null;
    const s = input.trim();
    if (/^#[\da-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[\da-f]{3}$/i.test(s))
      return "#" + [...s.slice(1)].map((c) => c + c).join("");
    const m =
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(1(?:\.0+)?|0?\.\d+)\s*)?\)$/i.exec(
        s,
      );
    if (
      !m ||
      m.slice(1, 4).some((n) => Number(n) > 255) ||
      (m[4] !== undefined && Number(m[4]) !== 1)
    )
      return null;
    return (
      "#" +
      m
        .slice(1, 4)
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  function luminance(hex) {
    return [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((n, c, i) => n + c * [0.2126, 0.7152, 0.0722][i], 0);
  }
  const contrast = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05);
  function resolve(preferences, native = {}, prefersDark = false) {
    const p = normalize(preferences);
    const bg = color(native?.colors?.popup),
      text = color(native?.colors?.popup_text);
    const useNative =
      p.thundyAppearance === "system" &&
      bg &&
      text &&
      contrast(bg, text) >= 4.5;
    const isDark =
      p.thundyAppearance === "dark" ||
      (p.thundyAppearance === "system" &&
        (useNative ? luminance(bg) < 0.179 : prefersDark));
    const colors = { ...(isDark ? dark : light) },
      a = accents[p.thundyAccent];
    Object.assign(colors, {
      "--link-color": a[isDark ? 1 : 0],
      "--link-hover-color": a[isDark ? 1 : 0],
      "--btn-primary-bg": a[0],
      "--btn-primary-text": "#ffffff",
      "--btn-success-bg": "#246b4c",
      "--btn-success-text": "#ffffff",
      "--accent-soft": a[isDark ? 3 : 2],
      "--alert-error-border": colors["--color-danger"],
      "--alert-info-border": a[isDark ? 1 : 0],
    });
    if (useNative) {
      for (const key of [
        "--bg-color",
        "--card-bg",
        "--input-bg",
        "--accent-soft",
      ])
        colors[key] = bg;
      for (const key of [
        "--text-color",
        "--text-muted",
        "--link-color",
        "--link-hover-color",
        "--input-border",
        "--card-border",
      ])
        colors[key] = text;
    }
    return {
      ...p,
      scheme: isDark ? "dark" : "light",
      native: !!useNative,
      colors,
    };
  }
  async function readNative() {
    try {
      return (await api?.theme?.getCurrent()) || {};
    } catch (_) {
      return {};
    }
  }
  async function snapshot() {
    let p = {};
    try {
      p = (await api?.storage.local.get(keys)) || {};
    } catch (_) {
      /* local default */
    }
    const r = resolve(p, await readNative(), media?.matches === true);
    return {
      scheme: r.scheme,
      css:
        Object.entries(r.colors)
          .map(([k, v]) => k + ":" + v)
          .join(";") +
        ";color-scheme:" +
        r.scheme +
        ";",
    };
  }
  function initialize() {
    // The same file is loaded by the background for isolated message UI snapshots.
    if (
      typeof document === "undefined" ||
      !document.querySelector('script[src="theme.js"]')
    )
      return;
    let preferences = normalize({}),
      native = {},
      generation = 0,
      pending = 0,
      queue = Promise.resolve();
    const status = document.getElementById("themeStatus"),
      retry = document.getElementById("themeRetry");
    const say = (key) => {
      if (retry) retry.hidden = key !== "themeSaveError";
      if (status)
        status.textContent =
          typeof ThundyI18n !== "undefined" ? ThundyI18n.get(key) : "";
    };
    const inputs = [
      ...document.querySelectorAll(
        'input[name="appearance"],input[name="accent"]',
      ),
    ];
    function render() {
      const r = resolve(preferences, native, media?.matches === true),
        root = document.documentElement;
      root.dataset.theme = r.scheme;
      root.dataset.appearance = r.thundyAppearance;
      root.dataset.accent = r.thundyAccent;
      root.style.colorScheme = r.scheme;
      for (const [k, v] of Object.entries(r.colors))
        root.style.setProperty(k, v);
      for (const input of inputs)
        input.checked =
          input.value ===
          preferences[input.name === "appearance" ? keys[0] : keys[1]];
    }
    api?.storage.onChanged?.addListener((changes, area) => {
      if (
        area !== "local" ||
        !keys.some((k) => Object.hasOwn(changes, k)) ||
        pending
      )
        return;
      for (const key of keys)
        if (Object.hasOwn(changes, key))
          preferences[key] = changes[key].newValue;
      preferences = normalize(preferences);
      generation++;
      render();
    });
    api?.theme?.onUpdated?.addListener(async () => {
      native = await readNative();
      render();
    });
    media?.addEventListener("change", render);
    for (const input of inputs) input.disabled = true;
    const initial = generation;
    Promise.all([api?.storage.local.get(keys), readNative()])
      .then(([p, n]) => {
        if (generation === initial) preferences = normalize(p);
        native = n;
        render();
        say("themeReady");
      })
      .catch(() => {
        render();
        say("themeLoadError");
      })
      .finally(() =>
        inputs.forEach((i) => {
          i.disabled = false;
        }),
      );
    function save() {
      preferences = normalize(preferences);
      const saved = { ...preferences },
        own = ++generation;
      render();
      say("themeSaving");
      pending++;
      queue = queue
        .catch(() => {})
        .then(() => {
          if (!api?.storage?.local)
            throw new Error("THEME_STORAGE_UNAVAILABLE");
          return api.storage.local.set(saved);
        })
        .then(
          () => {
            if (generation === own) say("themeSaved");
          },
          async () => {
            if (generation !== own) return;
            say("themeSaveError");
          },
        )
        .finally(() => {
          pending--;
        });
    }
    for (const input of inputs)
      input.addEventListener("change", () => {
        if (!input.checked) return;
        preferences[input.name === "appearance" ? keys[0] : keys[1]] =
          input.value;
        save();
      });
    retry?.addEventListener("click", save);
  }
  if (typeof document !== "undefined")
    document.addEventListener("DOMContentLoaded", initialize);
  return { resolve, normalize, snapshot, color, contrast };
})();
