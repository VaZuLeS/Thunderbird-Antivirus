// Endonyms keep the language selector readable regardless of the current UI language.
const locales = Object.freeze({
  bg: 'Български', cs: 'Čeština', da: 'Dansk', de: 'Deutsch', el: 'Ελληνικά',
  en: 'English', es: 'Español', et: 'Eesti', fi: 'Suomi', fr: 'Français',
  ga: 'Gaeilge', hr: 'Hrvatski', hu: 'Magyar', it: 'Italiano', lt: 'Lietuvių',
  lv: 'Latviešu', mt: 'Malti', nl: 'Nederlands', pl: 'Polski', pt: 'Português',
  ro: 'Română', sk: 'Slovenčina', sl: 'Slovenščina', sv: 'Svenska',
});

module.exports = { locales, catalogFiles: Object.keys(locales).map(code => `_locales/${code}/messages.json`) };
