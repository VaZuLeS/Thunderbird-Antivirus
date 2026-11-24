const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { locales } = require('../scripts/locale-catalogs.js');
const catalogs = Object.fromEntries(Object.keys(locales).map(language => [language, JSON.parse(fs.readFileSync(`_locales/${language}/messages.json`, 'utf8'))]));
const source = fs.readFileSync('i18n.js', 'utf8');
const pages = ['options.html', 'popup.html', 'privacy.html', 'audit.html', 'enterprise_setup.html', 'security.html', 'source_export.html', 'onboarding.html', 'attachment_download.html', 'hybrid_report.html', 'api_debug.html'];
const substitutions = /\$[A-Z][A-Z0-9_]*\$|\$\d+|\$\$/g;
function substitute(item, values = []) {
    return item.message.replace(/\$([A-Z0-9_]+)\$/g, (all, key) => {
        const content = item.placeholders[key.toLowerCase()].content;
        return content.replace(/\$(\d+)/g, (_, index) => String(values[index - 1] ?? ''));
    });
}

test('mandatory catalogs have complete nonempty keys and matching placeholders', () => {
    for (const locale of Object.keys(catalogs)) assert.deepEqual(Object.keys(catalogs.en).sort(), Object.keys(catalogs[locale]).sort());
    for (const key of Object.keys(catalogs.en)) {
        for (const locale of Object.keys(catalogs)) assert.ok(catalogs[locale][key].message.trim(), `${locale}/${key}`);
        for (const locale of Object.keys(catalogs)) {
            assert.deepEqual(catalogs.en[key].placeholders || {}, catalogs[locale][key].placeholders || {}, locale + '/' + key);
            assert.deepEqual((catalogs[locale][key].message.match(substitutions) || []).sort(), (catalogs.en[key].message.match(substitutions) || []).sort(), `${locale}/${key} substitutions`);
        }
    }
    for (const file of [...pages, 'api.js', 'options.js', 'background.js', 'risk.js', 'scan_policy.js', 'providers.js', 'message_ui.js', 'link_audit.js', 'audit.js', 'enterprise_setup.js', 'security_page.js', 'source_export.js', 'i18n.js', 'onboarding.js']) {
        const text = fs.readFileSync(file, 'utf8');
        const keys = [...text.matchAll(/\b(?:uiText|msg|t)\(['"]([^'"]+)['"]/g)].map(match => match[1]);
        const domKeys = [...text.matchAll(/data-i18n(?:-(?:title|aria-label|placeholder))?="([^"]+)"/g)].map(match => match[1]);
        for (const key of [...keys, ...domKeys]) assert.ok(catalogs.en[key], `${file}: ${key}`);
    }
});

for (const locale of [...Object.keys(locales), 'en-IE', 'de-AT', 'fr-BE', 'nl-BE', 'el-CY', 'ga-IE', 'mt-MT', 'pt-PT', 'sv-SE', 'ja']) {
    test(`extension pages render ${locale} with bundled English fallback`, () => {
        for (const file of pages) {
            const dom = new JSDOM(fs.readFileSync(file, 'utf8'));
            const language = catalogs[locale.split('-')[0]] ? locale.split('-')[0] : 'en';
            const context = vm.createContext({ document: dom.window.document, browser: { i18n: {
                getUILanguage: () => locale,
                getMessage: (key, values) => catalogs[locale.split('-')[0]]?.[key] ? substitute(catalogs[locale.split('-')[0]][key], values) : ''
            }}});
            vm.runInContext(source + '\nThundyI18n.initialize();', context);
            assert.equal(dom.window.document.documentElement.lang, language);
            for (const el of dom.window.document.querySelectorAll('[data-i18n]')) {
                assert.equal(el.textContent, substitute(catalogs[language][el.dataset.i18n]), `${file}/${el.dataset.i18n}`);
                assert.ok(!/\$[A-Z0-9_]+\$/.test(el.textContent));
            }
            for (const attr of ['title', 'placeholder', 'aria-label']) {
                for (const el of dom.window.document.querySelectorAll(`[data-i18n-${attr}]`)) {
                    assert.equal(el.getAttribute(attr), substitute(catalogs[language][el.getAttribute(`data-i18n-${attr}`)]));
                }
            }
            assert.equal(dom.window.document.getElementById('apikey')?.required || false, false);
            dom.window.close();
        }
    });
}

test('an add-on language can be selected across Thunderbird locales and saved without changing protection settings', async () => {
    const dom = new JSDOM('<label for="addonLanguage" data-i18n="addonLanguage"></label><select id="addonLanguage" disabled><option value="system">System</option></select><p id="addonLanguageStatus"></p>');
    const document = dom.window.document;
    const writes = [], requested = [];
    const context = vm.createContext({ document, fetch: async url => {
        requested.push(url);
        return {ok:true,json:async()=>catalogs.mt};
    }, browser: { i18n: { getUILanguage: () => 'de-AT', getMessage: key => catalogs.de[key]?.message },
        runtime: { getURL: path => 'moz-extension://test/' + path },
        storage: { local: { get: async () => ({}), set: async data => writes.push({...data}) } }
    }});
    vm.runInContext(source + '\nglobalThis.i18n = ThundyI18n;', context);
    await new Promise(resolve => setImmediate(resolve));
    const picker = document.querySelector('select');
    assert.equal(picker.options.length, 25);
    assert.deepEqual([...picker.options].slice(1).map(option => [option.value, option.textContent]), Object.entries(locales));
    picker.value = 'mt';
    picker.dispatchEvent(new dom.window.Event('change'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(writes, [{thundyLocale:'mt'}]);
    assert.deepEqual(requested, ['moz-extension://test/_locales/mt/messages.json']);
    assert.equal(context.i18n.get('addonLanguage'), catalogs.mt.addonLanguage.message);
    assert.equal(document.getElementById('addonLanguageStatus').textContent, catalogs.mt.addonLanguageSaved.message);
    picker.value = 'system';
    picker.dispatchEvent(new dom.window.Event('change'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(context.i18n.get('addonLanguage'), catalogs.de.addonLanguage.message);
    dom.window.close();
});

test('English fallback substitutes dynamic values without markup parsing', () => {
    const context = vm.createContext({ browser: { i18n: { getMessage: () => '' } } });
    vm.runInContext(source + '\nglobalThis.translate = ThundyI18n.get;', context);
    assert.equal(context.translate('bannerThreatScore', ['42']), 'Risk score: 42 of 100');
    assert.equal(context.translate('ui_031', ['<img src=x>']), 'Last file name: <img src=x>');
});

test('the bundled fallback covers every catalog key and placeholder', () => {
    const context = vm.createContext({ browser: { i18n: { getMessage: () => '' } } });
    vm.runInContext(fs.readFileSync('i18n.js', 'utf8') + '\nglobalThis.translate = ThundyI18n.get;', context);
    const values = ['one', 'two', 'three'];
    for (const [key, item] of Object.entries(catalogs.en)) {
        assert.equal(context.translate(key, values), substitute(item, values), key);
    }
});

test('fresh popup without API credentials renders local risk and HTML actions without requests', async () => {
    const dom = new JSDOM(fs.readFileSync('popup.html', 'utf8'));
    let network = 0;
    const context = vm.createContext({
        document: dom.window.document, console, URL, AbortController, setTimeout, clearTimeout,
        fetch: async () => { network++; throw new Error('must remain offline'); },
        openDB: async () => ({ close() {} }),
        getFromStore: async () => ({ attachments: [{ hybrid_sha256: 'a'.repeat(64), attachment_name: 'local.html', partName: '1', state: 'MANUAL_CHECK_PENDING' }] }),
        browser: {
            tabs: { query: async () => [{ id: 1 }] },
            messageDisplay: { getDisplayedMessages: async () => ({ messages: [{ id: 7, headerMessageId: 'm7', subject: 'Local test', author: 'test@example.com' }] }) },
            storage: { local: { get: async () => ({ externalAnalysisConsent: false }) }, onChanged: { addListener() {} } },
            runtime: { onMessage: { addListener() {} }, sendMessage: async () => ({ threat: { score: 0, reasons: [] } }) },
            permissions: { contains: async () => true },
            i18n: { getMessage: key => catalogs.en[key]?.placeholders ? '' : catalogs.en[key]?.message || '', getUILanguage: () => 'en' }
        }
    });
    vm.runInContext(fs.readFileSync('i18n.js', 'utf8') + '\n' + fs.readFileSync('runtime.js', 'utf8') + '\n' + fs.readFileSync('api_gateway.js', 'utf8'), context);
    const api = (fs.readFileSync('provider_results.js','utf8')+'\n'+fs.readFileSync('api.js', 'utf8')).replace(/^\(async \(\) => \{/m, 'globalThis.initialization = (async () => {');
    vm.runInContext(api, context);
    await context.initialization;
    const text = dom.window.document.body.textContent;
    assert.ok(text.includes(catalogs.en.localScoreMessage.message+': 0 / 100'));
    assert.ok(text.includes('local.html'));
    assert.ok(text.includes('Sanitize and download'));
    const notice = dom.window.document.getElementById('thundy-consent-notice');
    assert.ok(notice, 'consent information survives rendering scan results');
    assert.notEqual(notice.parentElement.id, 'hybrid_analysis_api_content');
    assert.equal(network, 0);
});
