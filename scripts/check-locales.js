#!/usr/bin/env node
/**
 * Prueft die Lokalisierung:
 *   1. Alle Sprachen haben denselben Schluesselsatz wie die Standardsprache.
 *   2. Jeder `data-i18n*`-Schluessel im HTML und jeder `thundyT('key')`-Aufruf
 *      in den JS-Dateien existiert in allen Katalogen.
 * Die Pruefung laeuft als Teil der Pre-Submit-Checks und in der CI.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCALES = ['en', 'de'];
const DEFAULT_LOCALE = 'en';
const SCANNED_FILES = ['popup.html', 'options.html', 'api.js', 'options.js', 'ui_i18n.js',
    'background.js', 'messageDisplay/banner.js'];
// Schluessel, die zur Laufzeit dynamisch gebildet werden oder nur der Steuerung dienen
const IGNORED_KEYS = new Set(['extensionName', 'extensionDescription', 'actionTitle']);

function readCatalog(locale) {
    const file = path.join(REPO_ROOT, '_locales', locale, 'messages.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function collectUsedKeys(rootDir = REPO_ROOT) {
    const used = new Map();
    for (const relative of SCANNED_FILES) {
        const file = path.join(rootDir, relative);
        if (!fs.existsSync(file)) continue;
        const source = fs.readFileSync(file, 'utf8');

        for (const match of source.matchAll(/data-i18n(?:-placeholder|-aria|-title)?="([A-Za-z0-9_]+)"/g)) {
            used.set(match[1], relative);
        }
        for (const match of source.matchAll(/thundyT\(\s*'([A-Za-z0-9_]+)'/g)) {
            used.set(match[1], relative);
        }
        for (const match of source.matchAll(/thundyText\(\s*'([A-Za-z0-9_]+)'/g)) {
            used.set(match[1], relative);
        }
        for (const match of source.matchAll(/msg\(\s*'([A-Za-z0-9_]+)'/g)) {
            used.set(match[1], relative);
        }
    }
    return used;
}

function runLocaleCheck(rootDir = REPO_ROOT) {
    const problems = [];
    const catalogs = {};

    for (const locale of LOCALES) {
        const file = path.join(rootDir, '_locales', locale, 'messages.json');
        if (!fs.existsSync(file)) {
            problems.push('Katalog fehlt: _locales/' + locale + '/messages.json');
            continue;
        }
        try {
            catalogs[locale] = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (e) {
            problems.push('Katalog _locales/' + locale + '/messages.json ist kein gueltiges JSON: ' + e.message);
        }
    }

    const reference = catalogs[DEFAULT_LOCALE];
    if (reference) {
        for (const locale of LOCALES) {
            const catalog = catalogs[locale];
            if (!catalog) continue;
            for (const key of Object.keys(reference)) {
                if (!catalog[key]) problems.push('Schluessel fehlt in ' + locale + ': ' + key);
            }
            for (const key of Object.keys(catalog)) {
                if (!reference[key]) problems.push('Schluessel fehlt in ' + DEFAULT_LOCALE + ': ' + key);
            }
        }
    }

    const usedKeys = collectUsedKeys(rootDir);
    for (const [key, file] of usedKeys) {
        if (IGNORED_KEYS.has(key)) continue;
        for (const locale of LOCALES) {
            if (catalogs[locale] && !catalogs[locale][key]) {
                problems.push('Verwendeter Schluessel fehlt in ' + locale + ': ' + key + ' (' + file + ')');
            }
        }
    }

    return { problems, usedKeys: Array.from(usedKeys.keys()).sort(), locales: Object.keys(catalogs) };
}

function main() {
    const { problems, usedKeys, locales } = runLocaleCheck();
    console.log('Sprachen: ' + locales.join(', ') + ' | verwendete Schluessel: ' + usedKeys.length);
    if (problems.length > 0) {
        for (const problem of problems) console.error('LOKALISIERUNG:', problem);
        console.error('\n' + problems.length + ' Problem(e) gefunden.');
        process.exitCode = 1;
        return;
    }
    console.log('Lokalisierung vollstaendig.');
}

if (require.main === module) {
    main();
}

module.exports = { runLocaleCheck, LOCALES, DEFAULT_LOCALE };
