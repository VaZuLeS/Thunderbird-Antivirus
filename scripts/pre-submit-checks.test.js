const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { runChecks, MATCH_PATTERN_RE } = require('./pre-submit-checks.js');

const REPO_ROOT = path.resolve(__dirname, '..');

function writeFixture(rootDir, files) {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(rootDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

function baseManifest(overrides = {}) {
  return Object.assign({
    manifest_version: 3,
    name: '__MSG_extensionName__',
    version: '1.6',
    description: 'Opt-in scanner for email attachments and links.',
    homepage_url: 'https://example.org/addon/',
    default_locale: 'en',
    browser_specific_settings: {
      gecko: {
        id: 'demo@example.org',
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['personalCommunications'] }
      }
    },
    permissions: ['messagesRead', 'storage'],
    optional_host_permissions: ['https://example.com/*'],
    background: { scripts: ['background.js'] },
    options_ui: { page: 'options.html' },
    icons: { '16': 'img/icon-16px.png', '32': 'img/icon-32px.png', '64': 'img/icon-64px.png' }
  }, overrides);
}

describe('pre-submit-checks', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-presubmit-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createExtension(files = {}, manifestOverrides = {}) {
    const rootDir = fs.mkdtempSync(path.join(tmpDir, 'ext-'));
    writeFixture(rootDir, Object.assign({
      'manifest.json': JSON.stringify(baseManifest(manifestOverrides), null, 2),
      'background.js': '// background\n',
      'options.html': '<html></html>',
      'img/icon-16px.png': 'png',
      'img/icon-32px.png': 'png',
      'img/icon-64px.png': 'png',
      '_locales/en/messages.json': JSON.stringify({ extensionName: { message: 'Demo' } }),
      'docs/privacy_policy.md': '# Privacy\n',
      'docs/index.html': '<a href="privacy_policy.html">Privacy</a>'
    }, files));
    return rootDir;
  }

  it('accepts a minimal, well formed Manifest V3 extension', () => {
    const result = runChecks(createExtension());
    assert.deepStrictEqual(result.errors, []);
  });

  it('accepts an optional data collection declaration (nothing is required)', () => {
    const result = runChecks(createExtension({}, {
      browser_specific_settings: {
        gecko: {
          id: 'demo@example.org',
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'], optional: ['personalCommunications'] }
        }
      }
    }));
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.passes.some((p) => p.includes('personalCommunications (optional)')));
  });

  it('fails when no data collection type is declared at all', () => {
    const result = runChecks(createExtension({}, {
      browser_specific_settings: {
        gecko: { id: 'demo@example.org', data_collection_permissions: { required: [], optional: [] } }
      }
    }));
    assert.ok(result.errors.some((e) => e.includes('must list at least one data type')));
  });

  it('fails when "none" hides the transmission without any optional declaration', () => {
    const result = runChecks(createExtension({}, {
      browser_specific_settings: {
        gecko: { id: 'demo@example.org', data_collection_permissions: { required: ['none'] } }
      }
    }));
    assert.ok(result.errors.some((e) => e.includes('declares "none" although the add-on transmits')));
  });

  it('fails when "none" is mixed with other required data types', () => {
    const result = runChecks(createExtension({}, {
      browser_specific_settings: {
        gecko: {
          id: 'demo@example.org',
          data_collection_permissions: { required: ['none', 'personalCommunications'] }
        }
      }
    }));
    assert.ok(result.errors.some((e) => e.includes('cannot be combined with other required data types')));
  });

  it('fails when a used API namespace has no declared permission (menus regression)', () => {
    const result = runChecks(createExtension({
      'background.js': 'browser.menus.create({ id: "x", title: "x", contexts: ["link"] });\n'
    }, { permissions: ['messagesRead', 'storage'] }));
    assert.ok(result.errors.some((e) => e.includes('browser.menus is used but none of its permissions is declared')));
  });

  it('accepts a used API namespace whose permission is declared', () => {
    const result = runChecks(createExtension({
      'background.js': 'browser.menus.create({ id: "x" });\nbrowser.notifications.create({});\n'
    }, { permissions: ['messagesRead', 'storage', 'menus', 'notifications'] }));
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.passes.some((p) => p.includes('permission for browser.menus is declared')));
  });

  it('fails when a registered message display script is not shipped', () => {
    const result = runChecks(createExtension({
      'background.js': "browser.scripting.messageDisplay.registerScripts([{ id: 'x', js: ['message_display.js'] }]);\n"
    }, { permissions: ['messagesRead', 'storage', 'scripting'] }));
    assert.ok(result.errors.some((e) => e.includes('registered script is referenced by the code but missing on disk')));
  });

  it('accepts a shipped registered message display script', () => {
    const result = runChecks(createExtension({
      'background.js': "browser.scripting.messageDisplay.registerScripts([{ id: 'x', js: ['message_display.js'] }]);\n",
      'message_display.js': '// ui\n'
    }, { permissions: ['messagesRead', 'storage', 'scripting'] }));
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.passes.some((p) => p.includes('registered script present (message_display.js)')));
  });

  it('fails when manifest.json is missing', () => {
    const rootDir = fs.mkdtempSync(path.join(tmpDir, 'empty-'));
    const result = runChecks(rootDir);
    assert.ok(result.errors.some((e) => e.includes('manifest.json missing')));
  });

  it('fails when manifest.json is not valid JSON', () => {
    const result = runChecks(createExtension({ 'manifest.json': '{ not json' }));
    assert.ok(result.errors.some((e) => e.includes('not valid JSON')));
  });

  it('fails on a legacy install.rdf', () => {
    const result = runChecks(createExtension({ 'install.rdf': '<RDF/>' }));
    assert.ok(result.errors.some((e) => e.includes('install.rdf')));
  });

  it('fails when host patterns are placed in permissions', () => {
    const result = runChecks(createExtension({}, { permissions: ['storage', 'https://example.com/*'] }));
    assert.ok(result.errors.some((e) => e.includes('host patterns must not be listed in permissions')));
  });

  it('fails when optional_permissions is used in Manifest V3', () => {
    const result = runChecks(createExtension({}, { optional_permissions: ['https://example.com/*'] }));
    assert.ok(result.errors.some((e) => e.includes('optional_permissions is not supported')));
  });

  it('fails on invalid match patterns', () => {
    const result = runChecks(createExtension({}, { optional_host_permissions: ['https://*urlhaus.abuse.ch/*'] }));
    assert.ok(result.errors.some((e) => e.includes('invalid match pattern')));
  });

  it('fails when browser_style is used in Manifest V3', () => {
    const result = runChecks(createExtension({}, { options_ui: { page: 'options.html', browser_style: true } }));
    assert.ok(result.errors.some((e) => e.includes('browser_style')));
  });

  it('fails when no data collection permission is declared', () => {
    const result = runChecks(createExtension({}, {
      browser_specific_settings: { gecko: { id: 'demo@example.org', strict_min_version: '140.0' } }
    }));
    assert.ok(result.errors.some((e) => e.includes('data_collection_permissions is missing')));
  });

  it('fails when "none" is listed as an optional data type', () => {
    const result = runChecks(createExtension({}, {
      browser_specific_settings: {
        gecko: {
          id: 'demo@example.org',
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['personalCommunications'], optional: ['none'] }
        }
      }
    }));
    assert.ok(result.errors.some((e) => e.includes('must not be listed as optional data type')));
  });

  it('fails when a forbidden permission is requested', () => {
    const result = runChecks(createExtension({}, { permissions: ['storage', 'webRequest'] }));
    assert.ok(result.errors.some((e) => e.includes('forbidden permission')));
  });

  it('fails when the add-on name uses the Thunderbird trademark as prefix', () => {
    const result = runChecks(createExtension({}, { name: 'Thunderbird Security AV' }));
    assert.ok(result.errors.some((e) => e.includes('trademark')));
  });

  it('fails when referenced files are missing', () => {
    const result = runChecks(createExtension({}, { background: { scripts: ['nope.js'] } }));
    assert.ok(result.errors.some((e) => e.includes('background script is missing on disk')));
  });

  it('fails when a localized manifest string has no catalogue entry', () => {
    const result = runChecks(createExtension({
      '_locales/en/messages.json': JSON.stringify({ somethingElse: { message: 'x' } })
    }, { name: '__MSG_extensionName__' }));
    assert.ok(result.errors.some((e) => e.includes('__MSG_extensionName__')));
  });

  it('warns when no store screenshots are present', () => {
    const result = runChecks(createExtension());
    assert.ok(result.warnings.some((w) => w.includes('no PNG/JPEG screenshots')));
  });


  it('fails when an icon has the wrong dimensions for its manifest entry', () => {
    const rootDir = createExtension();
    // 64x64 content declared as the 16px icon
    const png = fs.readFileSync(path.join(REPO_ROOT, 'img', 'icon-64px.png'));
    fs.copyFileSync(path.join(REPO_ROOT, 'img', 'icon-64px.png'), path.join(rootDir, 'img', 'icon-16px.png'));
    assert.ok(png.length > 0);
    const result = runChecks(rootDir);
    assert.ok(result.errors.some((e) => e.includes('is declared as 16px')));
  });

  it('accepts the real generated icons', () => {
    const result = runChecks(REPO_ROOT);
    assert.ok(!result.errors.some((e) => e.includes('but is declared as')));
    assert.ok(!result.warnings.some((w) => w.includes('is not a PNG file')));
  });


  it('generate-icons produces PNGs with the declared dimensions', () => {
    const { encodePng, renderIcon, SIZES } = require('./generate-icons.js');
    assert.deepStrictEqual(SIZES, [16, 32, 48, 64, 128]);
    for (const size of [16, 64]) {
      const png = encodePng(size, renderIcon(size));
      assert.ok(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
      assert.strictEqual(png.readUInt32BE(16), size);
      assert.strictEqual(png.readUInt32BE(20), size);
    }
  });

  it('all icons referenced in manifest.json exist in the expected size', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));
    for (const [size, iconPath] of Object.entries(manifest.icons)) {
      const file = path.join(REPO_ROOT, iconPath);
      assert.ok(fs.existsSync(file), iconPath + ' must exist');
      const png = fs.readFileSync(file);
      assert.strictEqual(png.readUInt32BE(16), Number(size), iconPath + ' width');
      assert.strictEqual(png.readUInt32BE(20), Number(size), iconPath + ' height');
    }
  });

  it('fails when a localized UI string has no catalogue entry', () => {
    const result = runChecks(createExtension({
      'options.html': '<html><body><h1 data-i18n="missingUiKey">Alt</h1></body></html>'
    }));
    assert.ok(result.errors.some((e) => e.includes('localized strings without a catalogue entry')));
  });

  it('accepts localized UI strings that exist in the default catalogue', () => {
    const result = runChecks(createExtension({
      'options.html': '<html><body><h1 data-i18n="extensionName">Demo</h1></body></html>',
      'popup.html': '<html><body><div data-i18n-placeholder="extensionName"></div></body></html>'
    }));
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.passes.some((p) => p.includes('localized UI strings have a catalogue entry')));
  });

  it('fails when a locale catalogue is missing keys of the default locale', () => {
    const manifest = baseManifest();
    const result = runChecks(createExtension({
      '_locales/en/messages.json': JSON.stringify({ extensionName: { message: 'Demo' }, extraKey: { message: 'x' } }),
      '_locales/de/messages.json': JSON.stringify({ extensionName: { message: 'Demo' } })
    }, manifest));
    assert.ok(result.errors.some((e) => e.includes('_locales/de is missing')), 'missing keys are reported');
  });

  it('accepts locale catalogues that are in sync', () => {
    const result = runChecks(createExtension({
      '_locales/en/messages.json': JSON.stringify({ extensionName: { message: 'Demo' } }),
      '_locales/de/messages.json': JSON.stringify({ extensionName: { message: 'Demo' } })
    }));
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.passes.some((p) => p.includes('locale catalogues are in sync')));
  });

  it('warns about translations that the default locale does not know', () => {
    const result = runChecks(createExtension({
      '_locales/en/messages.json': JSON.stringify({ extensionName: { message: 'Demo' } }),
      '_locales/de/messages.json': JSON.stringify({ extensionName: { message: 'Demo' }, unknown: { message: 'x' } })
    }));
    assert.ok(result.warnings.some((w) => w.includes('unknown to')));
  });

  it('validates the real repository without errors', () => {
    const result = runChecks(REPO_ROOT);
    assert.deepStrictEqual(result.errors, [], 'the repository must pass the pre-submit checks');
  });

  it('rejects malformed match patterns and accepts valid ones', () => {
    assert.ok(MATCH_PATTERN_RE.test('https://example.com/*'));
    assert.ok(MATCH_PATTERN_RE.test('https://*.example.com/*'));
    assert.ok(MATCH_PATTERN_RE.test('https://api.abuseipdb.com/*'));
    assert.ok(!MATCH_PATTERN_RE.test('https://*example.com/*'));
    assert.ok(!MATCH_PATTERN_RE.test('http:/example.com/*'));
    assert.ok(!MATCH_PATTERN_RE.test('https://example.com'));
  });
});


describe('CI helper scripts', () => {
  it('filter-lint-warnings treats Thunderbird API false positives as known', () => {
    const { isKnownFalsePositive } = require('./filter-lint-warnings.js');
    assert.ok(isKnownFalsePositive({ code: 'UNSUPPORTED_API', message: 'messages.getFull is not supported' }));
    assert.ok(isKnownFalsePositive({ code: 'MANIFEST_PERMISSIONS', message: 'Invalid permissions "messagesRead" at 0.' }));
    assert.ok(isKnownFalsePositive({ code: 'KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION', message: 'Manifest key not supported' }));
    assert.ok(!isKnownFalsePositive({ code: 'INLINE_SCRIPT', message: 'Inline scripts blocked by default' }));
    assert.ok(!isKnownFalsePositive({ code: 'UNSUPPORTED_API', message: 'tabs.executeScript is not supported' }));
  });

  it('verify-package forbids tests, docs and legacy files in the XPI', () => {
    const { FORBIDDEN, ALLOWED_FILES } = require('./verify-package.js');
    const matchesForbidden = (name) => FORBIDDEN.some((pattern) => pattern.test(name));
    assert.ok(ALLOWED_FILES.includes('manifest.json'));
    assert.ok(matchesForbidden('install.rdf'));
    assert.ok(matchesForbidden('background.test.js'));
    assert.ok(matchesForbidden('docs/privacy_policy.md'));
    assert.ok(matchesForbidden('scripts/pre-submit-checks.js'));
    assert.ok(matchesForbidden('package-lock.json'));
    assert.ok(matchesForbidden('examples/minimal_scan.sh'));
    assert.ok(!matchesForbidden('background.js'));
    assert.ok(!matchesForbidden('_locales/en/messages.json'));
  });
});
