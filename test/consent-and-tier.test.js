/**
 * Consent and privacy-tier rules of the store-readiness package.
 *
 * Behavioural part: the popup is the second place (next to the background
 * script) that talks to a provider, so it is checked here in isolation - the
 * former consent bypass (finding P0-7) must not come back.
 *
 * Static part: a cheap guard that the manual upload / URL scan paths keep their
 * privacy-tier check (the detailed behaviour is covered in background.test.js).
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');

describe('popup consent enforcement (P0-7)', () => {
  let context;
  let fetch_hybrid_report;
  let hybrid_report_cache;

  before(() => {
    context = {
      browser: {
        storage: {
          local: { get: async () => ({ externalAnalysisConsent: false }) },
          onChanged: { addListener: (listener) => { context.storageListener = listener; } }
        },
        runtime: { sendMessage: async () => ({ status: 'success' }) }
      },
      console,
      setTimeout,
      clearTimeout
    };
    context.document = {
      getElementById: () => null,
      createElement: (tag) => ({
        tagName: tag,
        children: [],
        setAttribute() {},
        appendChild(child) { this.children.push(child); }
      }),
      createTextNode: (text) => ({ textContent: text }),
      createDocumentFragment: () => ({ hasChildNodes: () => false, appendChild() {} })
    };
    vm.createContext(context);

    const code = fs.readFileSync(path.join(ROOT, 'api.js'), 'utf8');
    let wrapped = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
    wrapped = wrapped.replace(/\}\)\(\);/, '}');
    wrapped += '\n; globalThis.fetch_hybrid_report = fetch_hybrid_report;\n';
    wrapped += '; globalThis.hybrid_report_cache = hybrid_report_cache;\n';
    wrapped += '; globalThis.hasExternalAnalysisConsent = hasExternalAnalysisConsent;\n';
    wrapped += '; globalThis.renderStoredResultWithoutConsent = renderStoredResultWithoutConsent;\n';
    wrapped += '; globalThis.__setConsent = (value) => { externalAnalysisConsent = value === true; };\n';
    vm.runInContext(wrapped, context);

    fetch_hybrid_report = context.fetch_hybrid_report;
    hybrid_report_cache = context.hybrid_report_cache;
  });

  beforeEach(() => {
    hybrid_report_cache.clear();
    context.__setConsent(false);
    context.fetchCount = 0;
    context.fetch = async () => {
      context.fetchCount += 1;
      return { status: 200, json: async () => ({ verdict: 'no specific threat' }) };
    };
  });

  it('sends nothing to Hybrid Analysis without the global consent', async () => {
    await assert.rejects(() => fetch_hybrid_report('a'.repeat(64)), /external-analysis-disabled/);
    assert.strictEqual(context.fetchCount, 0, 'no request without consent');
    assert.strictEqual(hybrid_report_cache.size, 0, 'nothing may be cached without consent');
  });

  it('transmits and caches the lookup once the consent is granted', async () => {
    context.__setConsent(true);
    const result = await fetch_hybrid_report('b'.repeat(64));
    assert.strictEqual(context.fetchCount, 1);
    assert.strictEqual(result.json_data.verdict, 'no specific threat');
    assert.ok(hybrid_report_cache.size >= 1);
  });

  it('subscribes to browser.storage.onChanged so a withdrawn consent takes effect (static)', () => {
    // The startup IIFE does not run in this harness, so the wiring is asserted
    // against the source: api.js must react to consent changes while open.
    const source = fs.readFileSync(path.join(ROOT, 'api.js'), 'utf8');
    assert.match(source, /browser\.storage\.onChanged\.addListener/);
    assert.match(source, /changes\.externalAnalysisConsent/);
  });

  it('renders only the locally stored result when the consent is off', () => {
    const container = context.document.createElement('div');
    const card = context.renderStoredResultWithoutConsent('anhang.pdf', 'c'.repeat(64), container);
    assert.strictEqual(container.children.length, 1);
    assert.strictEqual(card.children.length, 2);
    const texts = card.children.map((child) => child.textContent || '').join(' ');
    assert.ok(texts.includes('c'.repeat(64)), 'the stored hash is shown locally');
    assert.strictEqual(context.fetchCount, 0, 'rendering a local result must not transmit anything');
  });
});

describe('privacy tier guards in the manual paths (P0-2, static)', () => {
  const background = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');

  it('handleManualUpload checks the tier before uploading the file', () => {
    const start = background.indexOf('async function handleManualUpload');
    const body = background.slice(start, background.indexOf('\n}', start));
    assert.match(body, /tierAtLeast\('balanced'\)/, 'the upload must require at least the balanced tier');
    assert.match(body, /TIER_BLOCKS_UPLOAD/);
  });

  it('handleUrlScan checks the tier before submitting the URL', () => {
    const start = background.indexOf('async function handleUrlScan');
    const body = background.slice(start, background.indexOf('\n}', start));
    assert.match(body, /tierAtLeast\('max'\)/, 'the URL scan must require the max tier');
    assert.match(body, /TIER_REQUIRES_MAX/);
  });

  it('every provider request is preceded by a host permission check', () => {
    const guarded = (background.match(/requireHostPermission\(/g) || []).length;
    assert.ok(guarded >= 10, 'expected a host permission guard at every provider call site, found ' + guarded);
  });
});
