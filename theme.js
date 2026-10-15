/* Local appearance preferences; scan settings are never changed here. */
const ThundyTheme = (() => {
  const { resolve, normalize, color, contrast } = ThundyDesign;
  const keys = ["thundyAppearance", "thundyAccent", "thundyDensity"];
  const api = typeof browser !== "undefined" ? browser : null;
  const media =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-color-scheme: dark)")
      : null;
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
        'input[name="appearance"],input[name="accent"],input[name="density"]',
      ),
    ];
    function render() {
      const r = resolve(preferences, native, media?.matches === true),
        root = document.documentElement;
      root.dataset.theme = r.scheme;
      root.dataset.appearance = r.thundyAppearance;
      root.dataset.accent = r.thundyAccent;
      root.dataset.density = r.thundyDensity;
      root.style.colorScheme = r.scheme;
      for (const [k, v] of Object.entries(r.colors))
        root.style.setProperty(k, v);
      for (const input of inputs)
        input.checked =
          input.value ===
          preferences[
            { appearance: keys[0], accent: keys[1], density: keys[2] }[
              input.name
            ]
          ];
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
        preferences[
          { appearance: keys[0], accent: keys[1], density: keys[2] }[input.name]
        ] = input.value;
        save();
      });
    retry?.addEventListener("click", save);
  }
  if (typeof document !== "undefined")
    document.addEventListener("DOMContentLoaded", initialize);
  return { resolve, normalize, snapshot, color, contrast };
})();
