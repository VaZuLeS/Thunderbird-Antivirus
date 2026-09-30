/**
 * Guards the localization added for the store readiness work (A-23).
 *
 * The add-on ships English and German catalogues; the UI pages declare their
 * strings through data-i18n* attributes and the runtime code looks them up with
 * t() (options/popup) and msg() (background). A missing key would silently fall
 * back to the German text, so every key is verified here.
 */
const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

describe('localization integrity', () => {
  const en = readJson('_locales/en/messages.json');
  const de = readJson('_locales/de/messages.json');

  it('ships the same message keys for every locale', () => {
    assert.deepStrictEqual(Object.keys(de).sort(), Object.keys(en).sort());
    assert.ok(Object.keys(en).length > 100, 'expected the full catalogue, got ' + Object.keys(en).length);
    for (const [key, entry] of Object.entries(en)) {
      assert.ok(entry.message && entry.message.length > 0, key + ' has no message');
      assert.ok(entry.message.length <= 1024, key + ' exceeds the 1024 character limit of messages.json');
    }
  });

  it('resolves every __MSG_ reference of the manifest from the default locale', () => {
    const manifestText = fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8');
    const refs = [...manifestText.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map((match) => match[1]);
    assert.ok(refs.length >= 2, 'expected localized manifest strings');
    for (const ref of refs) {
      assert.ok(en[ref], 'manifest references the missing message key ' + ref);
    }
  });

  it('provides every data-i18n key used in the UI pages', () => {
    for (const file of ['options.html', 'popup.html']) {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const keys = [...html.matchAll(/data-i18n(?:-placeholder|-aria-label|-title)?="([A-Za-z0-9_]+)"/g)]
        .map((match) => match[1]);
      assert.ok(keys.length > 0, file + ' declares no localizable strings');
      for (const key of keys) {
        assert.ok(en[key], file + ' uses ' + key + ' which is missing in _locales/en');
        assert.ok(de[key], file + ' uses ' + key + ' which is missing in _locales/de');
      }
    }
  });

  it('provides every t()/msg() key used in the runtime code', () => {
    for (const file of ['background.js', 'options.js', 'api.js']) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const keys = new Set([...source.matchAll(/\b(?:t|msg)\('([A-Za-z0-9_]+)'/g)].map((match) => match[1]));
      for (const key of keys) {
        assert.ok(en[key], file + ' uses ' + key + ' which is missing in _locales/en');
        assert.ok(de[key], file + ' uses ' + key + ' which is missing in _locales/de');
      }
    }
  });

  it('applies the English catalogue to the real options page', () => {
    const vm = require('node:vm');
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'options.html'), 'utf8'));
    const context = {
      browser: {
        i18n: {
          getMessage: (key) => (en[key] ? en[key].message : ''),
          getUILanguage: () => 'en-US'
        },
        storage: { local: { get: async () => ({}), set: async () => {} } },
        permissions: { contains: async () => true, request: async () => true }
      },
      document: dom.window.document,
      console: { log: () => {}, error: () => {}, warn: () => {} },
      setTimeout: () => {},
      clearTimeout: () => {}
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'options.js'), 'utf8'), context);

    const event = dom.window.document.createEvent('Event');
    event.initEvent('DOMContentLoaded', true, true);
    dom.window.document.dispatchEvent(event);

    const document = dom.window.document;
    assert.strictEqual(document.getElementById('save').textContent, en.optSaveButton.message);
    assert.strictEqual(document.getElementById('clearCache').textContent, en.optClearCacheButton.message);
    assert.strictEqual(document.getElementById('apikey').placeholder, en.optPlaceholderApiKey.message);
    assert.ok(document.getElementById('externalAnalysisConsentHelp').textContent
      .includes(en.optConsentHelp.message), 'the consent help text must be localized');
    assert.ok(document.querySelector('h1').textContent.includes(en.optTitle.message));
    assert.strictEqual(document.documentElement.lang, 'en-US');
    assert.strictEqual(
      document.querySelector('option[value="strict"]').textContent,
      en.optTierStrict.message);
  });

  it('declares a placeholder entry for every $NAME$ used in a message', () => {
    for (const [locale, catalogue] of Object.entries({ en, de })) {
      for (const [key, entry] of Object.entries(catalogue)) {
        const used = [...entry.message.matchAll(/\$([A-Za-z0-9_]+)\$/g)].map((match) => match[1].toLowerCase());
        const declared = Object.keys(entry.placeholders || {});
        for (const name of used) {
          assert.ok(declared.includes(name),
            locale + ':' + key + ' uses $' + name + '$ without a placeholder definition');
        }
      }
    }
  });
});
