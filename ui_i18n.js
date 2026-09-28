/**
 * Thundy AV - Lokalisierung fuer die Erweiterungsseiten (Popup und Optionen).
 *
 * Die Uebersetzungen liegen in `_locales/<sprache>/messages.json`. Thunderbird
 * waehlt die Sprache automatisch anhand der Anwendungssprache; `default_locale`
 * ist Englisch. Fehlt ein Schluessel, bleibt der im Markup hinterlegte deutsche
 * Text stehen - die Oberflaeche ist dadurch nie leer.
 */

function thundyT(key, fallback, subs) {
    try {
        if (typeof browser !== 'undefined' && browser.i18n && typeof browser.i18n.getMessage === 'function') {
            const localized = browser.i18n.getMessage(key, subs);
            if (localized) return localized;
        }
    } catch (e) { /* Fallback unten */ }
    let text = fallback !== undefined && fallback !== null ? String(fallback) : key;
    const values = Array.isArray(subs) ? subs.slice() : (subs === undefined ? [] : [subs]);
    text = text.replace(/\$[A-Z0-9_]+\$/g, () => (values.length ? String(values.shift()) : ''));
    return text;
}

/**
 * Uebersetzt alle Elemente mit `data-i18n*`-Attributen.
 *   data-i18n (Schluessel)              -> textContent
 *   data-i18n-placeholder (Schluessel)  -> placeholder
 *   data-i18n-aria (Schluessel)         -> aria-label
 *   data-i18n-title (Schluessel)        -> title
 */
function thundyApplyTranslations(root, t) {
    const scope = root || document;
    const translate = t || thundyT;

    scope.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) element.textContent = translate(key, element.textContent);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (key) element.setAttribute('placeholder', translate(key, element.getAttribute('placeholder') || ''));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(element => {
        const key = element.getAttribute('data-i18n-aria');
        if (key) element.setAttribute('aria-label', translate(key, element.getAttribute('aria-label') || ''));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (key) element.setAttribute('title', translate(key, element.getAttribute('title') || ''));
    });
    return scope;
}

/** Sprache fuer die Anzeige (z. B. fuer Diagnose/Bericht). */
function thundyUiLanguage() {
    try {
        if (typeof browser !== 'undefined' && browser.i18n && typeof browser.i18n.getUILanguage === 'function') {
            return browser.i18n.getUILanguage();
        }
    } catch (e) { /* unbekannt */ }
    return 'unbekannt';
}

if (typeof globalThis !== 'undefined') {
    globalThis.thundyT = thundyT;
    globalThis.thundyApplyTranslations = thundyApplyTranslations;
    globalThis.thundyUiLanguage = thundyUiLanguage;
}
