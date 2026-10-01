/**
 * Static invariants of the repository that the store-readiness package relies on.
 *
 * These tests do not mock Thunderbird - they check the real files, so a change
 * that breaks one of the agreed rules (data declaration, permissions, locale
 * coverage, packaging, test discovery) fails here instead of during the ATN
 * review. Finding IDs refer to docs/PROBLEMANALYSE_STORE_READINESS.md.
 */
const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const manifest = JSON.parse(read('manifest.json'));
const gecko = manifest.browser_specific_settings.gecko;

describe('manifest invariants (store readiness)', () => {
  it('declares the data collection as opt-in: required none, optional personalCommunications', () => {
    assert.deepStrictEqual(gecko.data_collection_permissions, {
      required: ['none'],
      optional: ['personalCommunications']
    });
  });

  it('requests every declared optional data type at runtime (P0-1)', () => {
    const optionsSource = read('options.js');
    for (const type of gecko.data_collection_permissions.optional) {
      assert.ok(optionsSource.includes('data_collection'), 'options.js must use permissions.request({data_collection})');
      assert.ok(optionsSource.includes(`'${type}'`), `options.js must request the declared type ${type}`);
    }
  });

  it('declares the menus permission because the context menus are used (P0-8)', () => {
    assert.ok(manifest.permissions.includes('menus'));
    assert.match(read('background.js'), /browser\.menus\s*\./);
  });

  it('declares sensitiveDataUpload as an optional permission (P2-22)', () => {
    assert.deepStrictEqual(manifest.optional_permissions, ['sensitiveDataUpload']);
  });

  it('keeps host access optional and never uses <all_urls>', () => {
    assert.ok(manifest.optional_host_permissions.length >= 5);
    for (const entry of manifest.permissions) {
      assert.ok(!entry.includes('://'), 'host patterns belong into optional_host_permissions');
    }
    assert.ok(!JSON.stringify(manifest).includes('<all_urls>'));
  });

  it('does not use APIs that Manifest V3 removed (P0-3, P1-10)', () => {
    const runtimeFiles = ['background.js', 'api.js', 'options.js', 'db.js', 'api_gateway.js'];
    const forbidden = [
      /messageDisplay\.onMessageDisplayed/,
      /messageDisplay\.getDisplayedMessage\s*\(/,
      /scripting\.messageDisplay\.executeScript/,
      /browser\.messageDisplayScripts/,
      /browser\.tabs\.executeScript/
    ];
    for (const file of runtimeFiles) {
      const source = stripComments(read(file));
      for (const pattern of forbidden) {
        assert.ok(!pattern.test(source), `${file} must not use ${pattern}`);
      }
    }
  });
});

describe('locale coverage', () => {
  const en = JSON.parse(read('_locales/en/messages.json'));
  const de = JSON.parse(read('_locales/de/messages.json'));

  it('has the same keys in English and German', () => {
    assert.deepStrictEqual(Object.keys(en).sort(), Object.keys(de).sort());
  });

  it('covers every string that background.js falls back to', () => {
    const source = read('background.js');
    const start = source.indexOf('const I18N_FALLBACKS = {');
    const end = source.indexOf('};', start);
    const block = source.slice(start, end);
    const keys = Array.from(block.matchAll(/^\s{4}([A-Za-z0-9_]+):/gm)).map((match) => match[1]);
    assert.ok(keys.length > 20, 'the fallback table should have been parsed');
    for (const key of keys) {
      assert.ok(en[key], `_locales/en is missing the key ${key}`);
      assert.ok(de[key], `_locales/de is missing the key ${key}`);
    }
  });

  it('covers the message keys referenced by manifest.json', () => {
    const referenced = Array.from(read('manifest.json').matchAll(/__MSG_([A-Za-z0-9_]+)__/g)).map((match) => match[1]);
    assert.ok(referenced.length >= 2);
    for (const key of referenced) {
      assert.ok(en[key], `_locales/en is missing ${key}`);
      assert.ok(de[key], `_locales/de is missing ${key}`);
    }
  });
});

describe('packaging and test discovery (P0-6, P2-16, P3-23, P3-24)', () => {
  it('lists every test file explicitly and no non-test file (P2-16)', () => {
    const testScript = JSON.parse(read('package.json')).scripts.test;
    const listed = testScript.split(/\s+/).filter((part) => part.endsWith('.js'));
    assert.ok(listed.length >= 6, 'the test script should list the test files explicitly');
    for (const file of listed) {
      assert.ok(fs.existsSync(path.join(ROOT, file)), `the test script references a missing file: ${file}`);
      assert.match(file, /(\.test\.js|_test\.js|^test\/)/, `${file} does not look like a test file`);
    }
    // Developer scripts (JS or Python) must not match the Node test discovery
    // patterns any more.
    for (const name of fs.readdirSync(path.join(ROOT, 'tools'))) {
      assert.ok(/\.dev\.(js|py|mjs|cjs)$/.test(name), `${name} would be picked up by the Node test runner`);
    }
  });

  it('excludes developer files from the package (web-ext ignoreFiles)', () => {
    const config = read('web-ext-config.mjs');
    for (const pattern of ["'tools'", "'testdata'", "'scripts'", "'docs'", "'*.md'"]) {
      assert.ok(config.includes(pattern), `web-ext-config.mjs should ignore ${pattern}`);
    }
    assert.ok(!fs.existsSync(path.join(ROOT, '.webextignore')), '.webextignore is not read by web-ext (P3-23)');
  });

  it('uses a single package manager (P3-24)', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'package-lock.json')));
    assert.ok(!fs.existsSync(path.join(ROOT, 'pnpm-lock.yaml')));
  });

  it('forbids developer directories in the package check (P0-6)', () => {
    const { FORBIDDEN, ALLOWED_FILES, REQUIRED_FILES } = require('../scripts/verify-package.js');
    for (const name of ['tools/form-check.dev.js', 'test/manifest.test.js', 'docs/readme.md', 'scripts/submission-gate.js', 'testdata/01.eml']) {
      assert.ok(FORBIDDEN.some((pattern) => pattern.test(name)), `${name} should be forbidden in the package`);
    }
    for (const file of ['manifest.json', 'background.js', 'api.js', 'popup.html']) {
      assert.ok(ALLOWED_FILES.includes(file));
      assert.ok(REQUIRED_FILES.includes(file));
    }
  });
});

