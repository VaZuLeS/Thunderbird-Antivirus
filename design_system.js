/* Shared, pure design contract for extension pages and offline reports. */
const ThundyDesign = (() => {
  const modes = ["system", "light", "dark"];
  const accents = {
    ocean: ["#146b80", "#82d6e9", "#e9f5f7", "#193541"],
    violet: ["#6943b8", "#c7b4ff", "#f1edfb", "#302746"],
    forest: ["#246b4c", "#8edcb5", "#ebf5ef", "#1c392d"],
    amber: ["#90530f", "#f2c48a", "#fbf2e6", "#403022"],
  };
  const light = {
    "--bg-color": "#f5f7fa",
    "--text-color": "#192b40",
    "--text-muted": "#536579",
    "--card-bg": "#ffffff",
    "--card-border": "#dce3ec",
    "--input-bg": "#f9fbfd",
    "--input-border": "#7a8da3",
    "--color-success": "#216341",
    "--color-warning": "#92510d",
    "--color-danger": "#b32642",
    "--color-info": "#146b80",
    "--alert-error-bg": "#fff0f3",
    "--warning-bg": "#fff4e5",
    "--success-bg": "#ebf5ef",
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
    "--success-bg": "#1c392d",
  };
  const normalize = (p) => ({
    thundyDensity: p?.thundyDensity === "compact" ? "compact" : "comfortable",
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
      "--control-size": p.thundyDensity === "compact" ? "36px" : "44px",
      "--surface-pad": p.thundyDensity === "compact" ? "16px" : "24px",
      "--table-pad": p.thundyDensity === "compact" ? "8px" : "12px",
      "--link-color": a[isDark ? 1 : 0],
      "--link-hover-color": a[isDark ? 1 : 0],
      "--btn-primary-bg": a[0],
      "--btn-primary-text": "#ffffff",
      "--btn-danger-bg": "#9f1239",
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

  return {
    version: 1,
    resolve,
    normalize,
    color,
    contrast,
    accents: Object.freeze(Object.keys(accents)),
  };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = ThundyDesign;
