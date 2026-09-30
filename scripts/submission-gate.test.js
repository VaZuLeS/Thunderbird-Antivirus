/**
 * Tests for scripts/submission-gate.js (the executable Go/No-Go checklist).
 *
 * The gate must pass for a complete add-on directory and must report the exact
 * blocker for every missing submission requirement.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { runGate, readPngSize } = require('./submission-gate.js');

function write(rootDir, relative, content) {
  const target = path.join(rootDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function png(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

const PROTOCOL = [
  '# Live-Test-Protokoll',
  '',
  '| Feld | Wert |',
  '|---|---|',
  '| Datum | 2026-09-30 |',
  '| Thunderbird-Version (Hilfe → Über Thunderbird) | 140.0esr |',
  '| Getestet von | maintainer |',
  '',
  '## Abschnitt',
  '',
  '- [x] Schritt eins',
  '- [x] Schritt zwei',
  '- [x] Schritt drei',
  '- [x] Schritt vier',
  '- [x] Schritt fünf',
  '- [x] Schritt sechs',
  ''
].join('\n');

function completeAddon(rootDir, overrides = {}) {
  write(rootDir, 'manifest.json', JSON.stringify({
    manifest_version: 3,
    name: 'Demo',
    version: '1.6.1',
    description: 'Demo add-on for the gate test.',
    browser_specific_settings: { gecko: { id: 'demo@example.org', strict_min_version: '140.0' } }
  }, null, 2));
  write(rootDir, 'package.json', JSON.stringify({ name: 'demo', version: '1.6.1' }, null, 2));
  write(rootDir, 'CHANGELOG.md', '# Changelog\n\n## [1.6.1]\n\n- something\n');
  write(rootDir, 'docs/store_listing.md', '# Listing\n\n**Version:** 1.6.1\n');
  write(rootDir, 'docs/reviewer_notes.md', '# Notes\n\n## 10. Anticipated review questions\n');
  write(rootDir, 'docs/privacy_policy.md', '# Privacy policy\n');
  write(rootDir, 'docs/testdata.md', '# Test data\n');
  write(rootDir, 'docs/data_collection_decision.md', '# Decision\n');
  write(rootDir, 'docs/live_test_protocol.md', PROTOCOL);
  write(rootDir, 'docs/ci/release.yml',
    'run: web-ext sign --amo-base-url https://addons.thunderbird.net/api/v5/\n');
  write(rootDir, 'testdata/01-test.eml', 'From: test@example.org\n');
  write(rootDir, 'build/demo-1.6.1.zip', 'PK-fake-artifact\n');
  write(rootDir, '_locales/en/messages.json', JSON.stringify({ extensionName: { message: 'Demo' } }));
  write(rootDir, '_locales/de/messages.json', JSON.stringify({ extensionName: { message: 'Demo' } }));
  fs.mkdirSync(path.join(rootDir, 'docs', 'screenshots'), { recursive: true });
  for (let index = 1; index <= 3; index += 1) {
    fs.writeFileSync(path.join(rootDir, 'docs', 'screenshots', `0${index}.png`), png(1280, 800));
  }
  for (const [relative, content] of Object.entries(overrides)) {
    if (content === null) fs.rmSync(path.join(rootDir, relative), { force: true });
    else write(rootDir, relative, content);
  }
}

describe('submission-gate', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-gate-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function fixture(overrides) {
    const rootDir = fs.mkdtempSync(path.join(tmpDir, 'addon-'));
    completeAddon(rootDir, overrides);
    return rootDir;
  }

  it('recognises the PNG dimensions of a screenshot', () => {
    assert.deepStrictEqual(readPngSize(png(1280, 800)), { width: 1280, height: 800 });
    assert.strictEqual(readPngSize(Buffer.alloc(24)), null);
  });

  it('passes for a complete add-on directory', () => {
    const { blockers, warnings } = runGate(fixture({}));
    assert.deepStrictEqual(blockers, [], 'expected no blockers, got: ' + blockers.join(' | '));
    assert.deepStrictEqual(warnings, [], 'expected no warnings, got: ' + warnings.join(' | '));
  });

  it('reports missing screenshots', () => {
    const rootDir = fixture({});
    fs.rmSync(path.join(rootDir, 'docs', 'screenshots'), { recursive: true, force: true });
    const { blockers } = runGate(rootDir);
    assert.ok(blockers.some((line) => line.includes('required screenshots')), blockers.join(' | '));
  });

  it('ignores screenshots that are too small', () => {
    const rootDir = fixture({});
    for (let index = 1; index <= 3; index += 1) {
      fs.writeFileSync(path.join(rootDir, 'docs', 'screenshots', `0${index}.png`), png(800, 600));
    }
    const { blockers } = runGate(rootDir);
    assert.ok(blockers.some((line) => line.includes('required screenshots')), blockers.join(' | '));
  });

  it('reports an unfinished live test protocol', () => {
    const rootDir = fixture({
      'docs/live_test_protocol.md': PROTOCOL.replace('- [x] Schritt eins', '- [ ] Schritt eins')
    });
    const { blockers } = runGate(rootDir);
    assert.ok(blockers.some((line) => line.includes('open checklist item')), blockers.join(' | '));
  });

  it('reports an unset environment field of the live test protocol', () => {
    const rootDir = fixture({});
    fs.writeFileSync(path.join(rootDir, 'docs', 'live_test_protocol.md'),
      PROTOCOL.replace('| Getestet von | maintainer |', '| Getestet von | |'));
    const { blockers } = runGate(rootDir);
    assert.ok(blockers.some((line) => line.includes('empty environment field')), blockers.join(' | '));
  });

  it('reports a version mismatch between manifest and package.json', () => {
    const rootDir = fixture({ 'package.json': JSON.stringify({ name: 'demo', version: '1.5.0' }) });
    const { blockers } = runGate(rootDir);
    assert.ok(blockers.some((line) => line.includes('differs from manifest.json version')), blockers.join(' | '));
  });

  it('reports a release workflow that would upload to AMO', () => {
    const rootDir = fixture({ 'docs/ci/release.yml': 'run: web-ext sign --channel listed\n' });
    const { blockers } = runGate(rootDir);
    assert.ok(blockers.some((line) => line.includes('addons.thunderbird.net')), blockers.join(' | '));
  });

  it('reports localization keys missing from a catalogue', () => {
    const rootDir = fixture({
      'options.html': '<label data-i18n="optMissingKey">x</label>',
      'popup.html': '<div data-i18n="popupMissingKey">y</div>'
    });
    const { blockers } = runGate(rootDir);
    assert.ok(blockers.some((line) => line.includes('localization key(s) missing')), blockers.join(' | '));
    assert.ok(blockers.some((line) => line.includes('en:optMissingKey')), blockers.join(' | '));
  });

  it('reports a missing reviewer package', () => {
    const rootDir = fixture({ 'docs/reviewer_notes.md': null });
    const { blockers } = runGate(rootDir);
    assert.ok(blockers.some((line) => line.includes('reviewer package incomplete')), blockers.join(' | '));
  });

  it('reports a missing listing text and changelog entry as blockers and warnings', () => {
    const rootDir = fixture({
      'docs/store_listing.md': null,
      'CHANGELOG.md': '# Changelog\n\n## [1.6.0]\n'
    });
    const { blockers, warnings } = runGate(rootDir);
    assert.ok(blockers.some((line) => line.includes('store_listing.md is missing')), blockers.join(' | '));
    assert.ok(warnings.some((line) => line.includes('no section for version')), warnings.join(' | '));
  });
});
