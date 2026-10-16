/**
 * Tests for the executable Go/No-Go gate (scripts/submission-gate.js).
 *
 * The gate must be conservative: as long as the artefacts that need a real
 * Thunderbird or an ATN account are missing, the result is NO-GO.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { evaluateGate, hasScreenshots, liveTestSummary, isArtifactRelevant } = require('./submission-gate.js');

function createRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-gate-'));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

const manifest = JSON.stringify({ manifest_version: 3, version: '1.6' }, null, 2);

/** Minimal real PNG buffer with the given dimensions (signature + IHDR). */
function pngBuffer(width, height) {
  const buffer = Buffer.alloc(8 + 4 + 4 + 13 + 4);
  buffer.write('\x89PNG\r\n\x1a\n', 0, 'binary');
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer.writeUInt8(8, 24);
  buffer.writeUInt8(6, 25);
  return buffer;
}

describe('submission gate', () => {
  let complete;
  let incomplete;

  before(() => {
    complete = createRoot({
      'manifest.json': manifest,
      'docs/screenshots/01-options-consent.png': pngBuffer(1280, 800),
      'docs/screenshots/02-optin-banner.png': pngBuffer(1280, 800),
      'docs/live_test_protocol.md': '| Schritt | Erwartung | Ist | Status |\n' +
        Array.from({ length: 12 }, (_, i) => '| ' + i + ' | x | y | OK |').join('\n') +
        '\n**Summe:** 12 OK / 0 FAIL / 0 N/A / 0 OFFEN\n'
    });
    incomplete = createRoot({
      'manifest.json': manifest,
      'docs/live_test_protocol.md': '**Summe:** 11 OK / 1 FAIL / 0 N/A / 0 OFFEN\n'
    });
  });

  after(() => {
    fs.rmSync(complete, { recursive: true, force: true });
    fs.rmSync(incomplete, { recursive: true, force: true });
  });

  it('reports GO when commands, screenshots, protocol and release tag are all in place', () => {
    const { criteria, go } = evaluateGate({
      rootDir: complete,
      commandRunner: () => ({ ok: true, output: 'ok' }),
      tagLookup: () => ({ exists: true, atHead: true, tag: 'v1.6', tagSha: 'abc12345', headSha: 'abc12345', changedArtifacts: [] })
    });
    assert.strictEqual(go, true);
    assert.deepStrictEqual(criteria.map((criterion) => criterion.status), Array(7).fill('pass'));
    assert.deepStrictEqual(criteria.map((criterion) => criterion.id), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']);
  });

  it('reports NO-GO for the current repository state (no screenshots, protocol not filled, no tag)', () => {
    const { criteria, go } = evaluateGate({
      rootDir: incomplete,
      commandRunner: () => ({ ok: true, output: 'ok' }),
      tagLookup: () => ({ exists: true, atHead: false, tag: 'v1.6', tagSha: 'aaaaaaaa', headSha: 'bbbbbbbb', changedArtifacts: ['manifest.json'] })
    });
    assert.strictEqual(go, false);
    const failed = criteria.filter((criterion) => criterion.status === 'fail').map((criterion) => criterion.id);
    assert.deepStrictEqual(failed, ['C5', 'C6', 'C7']);
    const protocol = criteria.find((criterion) => criterion.id === 'C6');
    assert.match(protocol.evidence, /FAIL/);
  });

  it('fails when a gate command fails', () => {
    const { criteria, go } = evaluateGate({
      rootDir: complete,
      commandRunner: (command, args) => ({ ok: !args.includes('scripts/lint-with-filter.js'), output: 'lint failed' }),
      tagLookup: () => ({ exists: true, atHead: true, tag: 'v1.6', tagSha: 'abc12345', headSha: 'abc12345', changedArtifacts: [] })
    });
    assert.strictEqual(go, false);
    const lint = criteria.find((criterion) => criterion.id === 'C3');
    assert.strictEqual(lint.status, 'fail');
    assert.match(lint.evidence, /lint failed/);
  });

  it('skips the commands on request but still evaluates the artefacts', () => {
    const { criteria, go } = evaluateGate({ rootDir: complete, skipCommands: true, tagLookup: () => true });
    assert.strictEqual(go, false, 'skipped commands cannot be counted as passed');
    for (const id of ['C1', 'C2', 'C3', 'C4']) {
      assert.strictEqual(criteria.find((criterion) => criterion.id === id).status, 'skipped');
    }
  });

  it('detects screenshots and the protocol counters', () => {
    assert.deepStrictEqual(hasScreenshots(complete).sort(), ['01-options-consent.png', '02-optin-banner.png']);
    assert.deepStrictEqual(liveTestSummary(complete), {
      present: true, filled: true, okCount: 12, failCount: 0, source: 'docs/live_test_protocol.md'
    });
    assert.deepStrictEqual(liveTestSummary(incomplete).failCount, 1);
    const unfilled = createRoot({ 'docs/live_test_protocol.md': '**Summe:** __ OK / __ FAIL / __ N/A / __ OFFEN\n' });
    assert.strictEqual(liveTestSummary(unfilled).filled, false);
    assert.strictEqual(liveTestSummary(createRoot({})).present, false);
  });

  it('scans docs/screenshots recursively for real captures', () => {
    const nested = createRoot({
      'docs/screenshots/thunderbird-linux/native-popup.png': pngBuffer(1280, 1000),
      'docs/screenshots/placeholder.svg': '<svg/>'
    });
    assert.deepStrictEqual(hasScreenshots(nested), ['thunderbird-linux/native-popup.png']);
    fs.rmSync(nested, { recursive: true, force: true });
  });

  it('prefers the version-specific live test document over the legacy protocol', () => {
    const versioned = createRoot({
      'docs/live_test_1_6.md': '**Summe:** 25 OK / 0 FAIL / 0 N/A / 5 OFFEN\n',
      'docs/live_test_protocol.md': '**Summe:** __ OK / __ FAIL\n'
    });
    const summary = liveTestSummary(versioned, '1.6');
    assert.strictEqual(summary.present, true);
    assert.strictEqual(summary.filled, true);
    assert.strictEqual(summary.okCount, 25);
    assert.strictEqual(summary.source, 'docs/live_test_1_6.md');
    assert.strictEqual(liveTestSummary(versioned, '9.9').source, 'docs/live_test_protocol.md');
    fs.rmSync(versioned, { recursive: true, force: true });
  });

  it('passes C5 only when a real capture reaches the minimum listing width', () => {
    const extras = {
      'manifest.json': manifest,
      'docs/live_test_protocol.md': '**Summe:** 12 OK / 0 FAIL / 0 N/A / 0 OFFEN\n'
    };
    const narrow = createRoot({
      ...extras,
      'docs/screenshots/narrow.png': pngBuffer(1152, 1000)
    });
    const wide = createRoot({
      ...extras,
      'docs/screenshots/narrow.png': pngBuffer(1152, 1000),
      'docs/screenshots/thunderbird-linux/wide.png': pngBuffer(1280, 1000)
    });
    for (const [root, expected] of [[narrow, false], [wide, true]]) {
      const { criteria, go } = evaluateGate({
        rootDir: root,
        commandRunner: () => ({ ok: true, output: 'ok' }),
        tagLookup: () => ({ exists: true, atHead: true, tag: 'v1.6', tagSha: 'abc12345', headSha: 'abc12345', changedArtifacts: [] })
      });
      const c5 = criteria.find((criterion) => criterion.id === 'C5');
      assert.strictEqual(c5.status, expected ? 'pass' : 'fail');
      assert.strictEqual(go, expected);
    }
    fs.rmSync(narrow, { recursive: true, force: true });
    fs.rmSync(wide, { recursive: true, force: true });
  });

  it('treats every packaged file as artifact-relevant for C7', () => {
    for (const file of ['audit.js', 'audit.html', 'design_system.js', 'i18n.js', 'theme.js',
      'message_ui.js', 'privacy.html', 'onboarding.html', 'options.css', 'design.css',
      'background.js', 'manifest.json', 'img/icon-16px.png', '_locales/de/messages.json']) {
      assert.strictEqual(isArtifactRelevant(file), true, file);
    }
    for (const file of ['docs/store_listing.md', 'CHANGELOG.md', 'scripts/submission-gate.js', 'README.md']) {
      assert.strictEqual(isArtifactRelevant(file), false, file);
    }
  });

  it('passes C7 when only documentation changed since the release tag', () => {
    const { criteria, go } = evaluateGate({
      rootDir: complete,
      commandRunner: () => ({ ok: true, output: 'ok' }),
      tagLookup: () => ({ exists: true, atHead: false, tag: 'v1.6', tagSha: 'aaaaaaaa', headSha: 'bbbbbbbb', changedArtifacts: [] })
    });
    assert.strictEqual(go, true);
    const c7 = criteria.find((criterion) => criterion.id === 'C7');
    assert.strictEqual(c7.status, 'pass');
    assert.match(c7.evidence, /no artifact-relevant changes/);
  });

  it('fails C7 when a packaged file changed after the release tag', () => {
    const { criteria, go } = evaluateGate({
      rootDir: complete,
      commandRunner: () => ({ ok: true, output: 'ok' }),
      tagLookup: () => ({ exists: true, atHead: false, tag: 'v1.6', tagSha: 'aaaaaaaa', headSha: 'bbbbbbbb', changedArtifacts: ['background.js'] })
    });
    assert.strictEqual(go, false);
    const c7 = criteria.find((criterion) => criterion.id === 'C7');
    assert.strictEqual(c7.status, 'fail');
    assert.match(c7.evidence, /background\.js/);
  });
});
