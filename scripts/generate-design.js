const fs = require("node:fs"),
  path = require("node:path"),
  design = require("../design_system.js");
const root = path.resolve(__dirname, ".."),
  file = path.join(root, "design.css");
const { resolve } = design;
const accents = Object.fromEntries(
  design.accents.map((name) => [
    name,
    [resolve({ thundyAccent: name }).colors["--btn-primary-bg"]],
  ]),
);
function styles() {
  const declarations = (colors) =>
    Object.entries(colors)
      .map(([k, v]) => k + ":" + v + ";")
      .join("");
  const tokens = (mode, accent = "ocean") =>
    resolve({ thundyAppearance: mode, thundyAccent: accent }).colors;
  const fixed = (mode) =>
    `:root[data-theme="${mode}"],:root:has([name="review-theme"][value="${mode}"]:checked)`;
  const accentSelector = (accent) => [
    `:root[data-accent="${accent}"]`,
    `:root:has([name="review-accent"][value="${accent}"]:checked)`,
  ];
  const modeSelector = (mode) => [
    `:root[data-theme="${mode}"]`,
    `:root:has([name="review-theme"][value="${mode}"]:checked)`,
  ];
  const accentTokens = (mode, accent) =>
    Object.fromEntries(
      Object.entries(tokens(mode, accent)).filter(([k]) =>
        [
          "--link-color",
          "--link-hover-color",
          "--btn-primary-bg",
          "--accent-soft",
          "--alert-info-border",
        ].includes(k),
      ),
    );
  let css =
    ":root{" +
    declarations(tokens("light")) +
    "color-scheme:light;--surface-shadow:0 4px 24px #12263b05;--surface-radius:18px;--control-radius:9px;--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-6:24px;--space-8:32px;--space-12:48px;}";
  css +=
    "@media(prefers-color-scheme:dark){:root{" +
    declarations(tokens("dark")) +
    "color-scheme:dark;}}";
  for (const accent of Object.keys(accents).filter(
    (name) => name !== "ocean",
  )) {
    css +=
      accentSelector(accent).join(",") +
      "{" +
      declarations(accentTokens("light", accent)) +
      "}";
    css +=
      "@media(prefers-color-scheme:dark){" +
      accentSelector(accent).join(",") +
      "{" +
      declarations(accentTokens("dark", accent)) +
      "}}";
  }
  for (const mode of ["light", "dark"]) {
    css +=
      fixed(mode) +
      "{" +
      declarations(tokens(mode)) +
      "color-scheme:" +
      mode +
      ";}";
    for (const accent of Object.keys(accents).filter(
      (name) => name !== "ocean",
    )) {
      const selectors = modeSelector(mode).flatMap((m) =>
        accentSelector(accent).map((a) => m + a.slice(5)),
      );
      css +=
        selectors.join(",") +
        "{" +
        declarations(accentTokens(mode, accent)) +
        "}";
    }
  }
  css +=
    ':root[data-density="compact"],:root:has([name="review-density"][value="compact"]:checked){--control-size:36px;--surface-pad:16px;--table-pad:8px;}';
  for (const [name, values] of Object.entries(accents))
    css += ":root{--accent-" + name + ":" + values[0] + ";}";
  return css;
}
const compact = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .trim();
const content =
  "/* Generated from design_system.js and design_components.css. */\n" +
  compact(
    styles() +
      "\n" +
      fs.readFileSync(path.join(root, "design_components.css"), "utf8"),
  );
if (process.argv.includes("--check")) {
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) {
    process.stderr.write(
      "Shared design CSS is out of date. Run npm run design:build.\n",
    );
    process.exitCode = 1;
  } else console.log("Shared design CSS matches its sources.");
} else fs.writeFileSync(file, content);
