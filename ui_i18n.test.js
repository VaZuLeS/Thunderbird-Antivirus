const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

const CODE = fs.readFileSync(path.join(__dirname, 'ui_i18n.js'), 'utf8');

function createContext(messages = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const context = {
        browser: {
            i18n: {
                getMessage: (key, subs) => {
                    if (!messages[key]) return '';
                    let text = messages[key];
                    const values = Array.isArray(subs) ? subs.slice() : (subs === undefined ? [] : [subs]);
                    text = text.replace(/\$[0-9]+/g, () => (values.length ? String(values.shift()) : ''));
                    return text;
                },
                getUILanguage: () => 'de-DE'
            }
        },
        document: dom.window.document,
        console: { log: () => {}, error: () => {}, warn: () => {},
            error: () => {} },
        globalThis: null
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(CODE, context);
    return { context, dom };
}

describe('ui_i18n.js', () => {
    it('uses the catalog when a translation exists', () => {
        const { context } = createContext({ 'opt.save': 'Save' });
        assert.strictEqual(context.thundyT('opt.save', 'Speichern'), 'Save');
    });

    it('falls back to the German text from the markup', () => {
        const { context } = createContext({});
        assert.strictEqual(context.thundyT('opt.save', 'Speichern'), 'Speichern');
        assert.strictEqual(context.thundyT('unbekannt', 'Fallback'), 'Fallback');
        assert.strictEqual(context.thundyT('unbekannt'), 'unbekannt');
    });

    it('substitutes placeholders in fallback and catalog texts', () => {
        const { context } = createContext({ 'x.y': 'Score $1 of 100' });
        assert.strictEqual(context.thundyT('x.y', 'Bewertung $SCORE$', ['50']), 'Score 50 of 100');
        assert.strictEqual(context.thundyT('z.z', 'Bewertung $SCORE$ von 100', ['50']), 'Bewertung 50 von 100');
    });

    it('translates elements with data-i18n attributes', () => {
        const { context, dom } = createContext({ 'a.one': 'One', 'a.two': 'Two', 'a.three': 'Three' });
        dom.window.document.body.innerHTML = `
            <h1 data-i18n="a.one">Eins</h1>
            <input data-i18n-placeholder="a.two" placeholder="Zwei">
            <button data-i18n-aria="a.three" aria-label="Drei">x</button>
            <span data-i18n="a.missing">Bleibt deutsch</span>`;

        context.thundyApplyTranslations(dom.window.document, context.thundyT);

        const document = dom.window.document;
        assert.strictEqual(document.querySelector('h1').textContent, 'One');
        assert.strictEqual(document.querySelector('input').getAttribute('placeholder'), 'Two');
        assert.strictEqual(document.querySelector('button').getAttribute('aria-label'), 'Three');
        assert.strictEqual(document.querySelector('span').textContent, 'Bleibt deutsch');
    });

    it('reports the application language', () => {
        const { context } = createContext({});
        assert.strictEqual(context.thundyUiLanguage(), 'de-DE');
    });
});
