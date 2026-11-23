/* Local appearance preferences; scan settings are never changed here. */
const ThundyTheme = (() => {
  const { resolve, normalize, color, contrast } = ThundyDesign;
  const keys = ["thundyAppearance", "thundyAccent", "thundyDensity"];
  const api = typeof browser !== "undefined" ? browser : null;
  const media =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-color-scheme: dark)")
      : null;
  async function readNative(windowId) {
    try {
      const args = Number.isInteger(windowId) ? [windowId] : [];
      return (await api?.theme?.getCurrent(...args)) || {};
    } catch (_) {
      return {};
    }
  }
  async function snapshot(windowId) {
    let p = {};
    try {
      p = (await api?.storage.local.get(keys)) || {};
    } catch (_) {
      /* local default */
    }
    const r = resolve(p, await readNative(windowId), media?.matches === true);
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
  function watch(windowId, render) {
    let generation = 0;
    const refresh = async () => {
      const own = ++generation;
      const theme = await snapshot(windowId);
      if (own === generation) render(theme);
    };
    const storage = (changes, area) => {
      if (area === 'local' && keys.some(key => Object.hasOwn(changes,key))) void refresh();
    };
    const native = info => {
      if (info?.windowId === undefined || windowId === undefined || info.windowId === windowId) void refresh();
    };
    api?.storage?.onChanged?.addListener(storage);
    api?.theme?.onUpdated?.addListener(native);
    media?.addEventListener('change',refresh);
    void refresh();
    return () => {
      generation++;
      api?.storage?.onChanged?.removeListener?.(storage);
      api?.theme?.onUpdated?.removeListener?.(native);
      media?.removeEventListener?.('change',refresh);
    };
  }
  let idle = () => Promise.resolve();
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
      nativeGeneration = 0,
      pending = 0,
      queue = Promise.resolve();
    idle = () => queue;
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
    const ownWindow = Promise.resolve(api?.windows?.getCurrent?.()).then(value => value?.id, () => undefined);
    api?.theme?.onUpdated?.addListener(async info => {
      const windowId = await ownWindow;
      if (info?.windowId !== undefined && windowId !== undefined && info.windowId !== windowId) return;
      const own = ++nativeGeneration;
      const latest = await readNative(windowId);
      if (own === nativeGeneration) { native = latest; render(); }
    });
    media?.addEventListener("change", render);
    for (const input of inputs) input.disabled = true;
    const initial = generation;
    const initialNative = nativeGeneration;
    render();
    Promise.all([api?.storage.local.get(keys), ownWindow.then(readNative)])
      .then(([p, n]) => {
        if (generation === initial) preferences = normalize(p);
        if (nativeGeneration === initialNative) native = n;
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
  return { resolve, normalize, snapshot, watch, color, contrast, whenIdle: () => idle() };
})();
