"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const sharedCSS = fs.readFileSync(
  path.join(__dirname, "../design.css"),
  "utf8",
);
const labels = {
  en: [
    "Local review",
    "Appearance",
    "Color scheme",
    "System",
    "Light",
    "Dark",
    "Accent color",
    "Ocean",
    "Violet",
    "Forest",
    "Amber",
    "Density",
    "Comfortable",
    "Compact",
    "Changes affect only this document and are not saved.",
  ],
  de: [
    "Lokale Review",
    "Darstellung",
    "Erscheinungsbild",
    "System",
    "Hell",
    "Dunkel",
    "Akzentfarbe",
    "Ozean",
    "Violett",
    "Wald",
    "Bernstein",
    "Informationsdichte",
    "Komfortabel",
    "Kompakt",
    "Änderungen gelten nur für dieses Dokument und werden nicht gespeichert.",
  ],
  fr: [
    "Revue locale",
    "Apparence",
    "Mode d’affichage",
    "Système",
    "Clair",
    "Sombre",
    "Couleur d’accent",
    "Océan",
    "Violet",
    "Forêt",
    "Ambre",
    "Densité",
    "Confortable",
    "Compacte",
    "Les modifications concernent uniquement ce document et ne sont pas enregistrées.",
  ],
  es: [
    "Revisión local",
    "Apariencia",
    "Modo de color",
    "Sistema",
    "Claro",
    "Oscuro",
    "Color de acento",
    "Océano",
    "Violeta",
    "Bosque",
    "Ámbar",
    "Densidad",
    "Cómoda",
    "Compacta",
    "Los cambios solo afectan a este documento y no se guardan.",
  ],
  it: [
    "Revisione locale",
    "Aspetto",
    "Modalità colore",
    "Sistema",
    "Chiaro",
    "Scuro",
    "Colore di accento",
    "Oceano",
    "Viola",
    "Foresta",
    "Ambra",
    "Densità",
    "Comoda",
    "Compatta",
    "Le modifiche riguardano solo questo documento e non vengono salvate.",
  ],
  pl: [
    "Przegląd lokalny",
    "Wygląd",
    "Tryb kolorów",
    "System",
    "Jasny",
    "Ciemny",
    "Kolor akcentu",
    "Ocean",
    "Fiolet",
    "Las",
    "Bursztyn",
    "Gęstość",
    "Wygodna",
    "Zwarta",
    "Zmiany dotyczą tylko tego dokumentu i nie są zapisywane.",
  ],
};
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function chrome(language) {
  const l = labels[language];
  if (!l) throw Error("DESIGN_LANGUAGE_INVALID");
  const group = (name, title, values) =>
    `<fieldset><legend>${esc(title)}</legend><div class="review-choices">${values.map(([value, label], i) => `<label><input type="radio" name="review-${name}" value="${value}"${i === 0 ? " checked" : ""}>${esc(label)}</label>`).join("")}</div></fieldset>`;
  return `<div class="review-toolbar"><strong>THUNDY AV · ${esc(l[0])}</strong><details class="review-appearance"><summary>${esc(l[1])}</summary>${group(
    "theme",
    l[2],
    [
      ["system", l[3]],
      ["light", l[4]],
      ["dark", l[5]],
    ],
  )}${group("accent", l[6], [
    ["ocean", l[7]],
    ["violet", l[8]],
    ["forest", l[9]],
    ["amber", l[10]],
  ])}${group("density", l[11], [
    ["comfortable", l[12]],
    ["compact", l[13]],
  ])}<p>${esc(l[14])}</p></details></div>`;
}
function decorateHTML(html, language) {
  if (typeof html !== "string" || !html.startsWith("<!doctype html>"))
    throw Error("DESIGN_HTML_INVALID");
  if (!html.includes("<body>"))
    html = html
      .replace("</style>", "</style><body>")
      .replace("</html>", "</body></html>");
  let count = 0;
  html = html.replace(
    /<style nonce="([^"]+)">([\s\S]*?)<\/style>/g,
    (_, nonce, css) => {
      count++;
      return `<style nonce="${nonce}">${css}\n${sharedCSS}</style>`;
    },
  );
  if (count !== 1) throw Error("DESIGN_STYLE_INVALID");
  if (!html.includes("<main>"))
    html = html
      .replace("<body>", "<body><main>")
      .replace("</body>", "</main></body>");
  html = html.replace("<body>", '<body class="admin-page">');
  if (html.includes("<main>"))
    html = html.replace("<main>", "<main>" + chrome(language));
  else
    html = html.replace(
      '<body class="admin-page">',
      '<body class="admin-page">' + chrome(language),
    );
  return html.replace(
    /<html lang="([^"]+)">/,
    '<html lang="$1" data-design-version="1">',
  );
}
module.exports = { decorateHTML, labels };
