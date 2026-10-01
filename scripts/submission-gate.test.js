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

const { evaluateGate, hasScreenshots, liveTestSummary } = require('./submission-gate.js');

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

describe('submission gate', () => {
  let complete;
  let incomplete;

  before(() => {
    complete = createRoot({
      'manifest.json': manifest,
      'docs/screenshots/01-options-consent.png': 'png',
      'docs/screenshots/02-optin-banner.png': 'png',
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
      tagLookup: () => ({ exists: true, atHead: true, tag: 'v1.6', tagSha: 'abc12345', headSha: 'abc12345' })
    });
    assert.strictEqual(go, true);
    assert.deepStrictEqual(criteria.map((criterion) => criterion.status), Array(7).fill('pass'));
    assert.deepStrictEqual(criteria.map((criterion) => criterion.id), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']);
  });

  it('reports NO-GO for the current repository state (no screenshots, protocol not filled, no tag)', () => {
    const { criteria, go } = evaluateGate({
      rootDir: incomplete,
      commandRunner: () => ({ ok: true, output: 'ok' }),
      tagLookup: () => ({ exists: true, atHead: false, tag: 'v1.6', tagSha: 'aaaaaaaa', headSha: 'bbbbbbbb' })
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
      tagLookup: () => ({ exists: true, atHead: true, tag: 'v1.6', tagSha: 'abc12345', headSha: 'abc12345' })
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
    assert.deepStrictEqual(liveTestSummary(complete), { present: true, filled: true, okCount: 12, failCount: 0 });
    assert.deepStrictEqual(liveTestSummary(incomplete).failCount, 1);
    const unfilled = createRoot({ 'docs/live_test_protocol.md': '**Summe:** __ OK / __ FAIL / __ N/A / __ OFFEN\n' });
    assert.strictEqual(liveTestSummary(unfilled).filled, false);
    assert.strictEqual(liveTestSummary(createRoot({})).present, false);
  });
});
