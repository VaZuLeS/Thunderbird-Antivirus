/**
 * Executable Go/No-Go gate for the Thunderbird Add-ons Store submission.
 *
 * Implements the criteria from docs/PROBLEMANALYSE_STORE_READINESS.md §9 so that
 * "ready to submit" is a measured result instead of an opinion. Everything that
 * can be checked automatically is checked here; the parts that need a real
 * Thunderbird or an ATN account are evaluated through their artefacts
 * (live-test protocol, screenshots, release tag) and reported as unmet while
 * they are missing.
 *
 * Artefact sources (decisions D13/D14 in docs/decisions.md, plan
 * docs/AUFGABENPLAN_STORE_READINESS_1_23_0.md):
 *   - C5 scans docs/screenshots/ recursively and requires at least one real
 *     capture with a width of >= 1200 px (shared logic with the pre-submit
 *     checks via scripts/screenshot-inventory.js).
 *   - C6 reads the version-specific protocol docs/live_test_<version>.md
 *     first and falls back to the legacy docs/live_test_protocol.md.
 *   - C7 derives "artifact-relevant" from the package list in
 *     scripts/verify-package.js instead of a hand-maintained pattern.
 *
 * Usage:
 *   node scripts/submission-gate.js            # full gate (runs tests, lint, build)
 *   node scripts/submission-gate.js --no-commands   # only artefacts/criteria, skip commands
 *
 * Exit code 0 = GO, 1 = NO-GO.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { collectScreenshots, MIN_LISTING_WIDTH } = require('./screenshot-inventory.js');
const { ALLOWED_FILES, ALLOWED_PREFIXES } = require('./verify-package.js');

const ROOT = path.resolve(__dirname, '..');

function runCommand(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  return {
    ok: result.status === 0,
    output: ((result.stdout || '') + (result.stderr || '')).trim().split('\n').slice(-6).join('\n')
  };
}

function hasScreenshots(rootDir) {
  return collectScreenshots(rootDir).map((shot) => shot.name);
}

function liveTestSummary(rootDir, version) {
  const candidates = [];
  // Repository convention: docs/live_test_1_22_0.md (version dots become underscores).
  if (version) candidates.push('live_test_' + String(version).replace(/\./g, '_') + '.md');
  candidates.push('live_test_protocol.md');
  const files = candidates.map((name) => path.join(rootDir, 'docs', name));
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    // The protocol ends with "**Summe:** __ OK / __ FAIL / ..."; unfilled
    // placeholders mean the test has not been performed yet.
    const summaryLine = (content.match(/\*\*Summe:\*\*[^\n]*/) || [''])[0];
    const okMatch = summaryLine.match(/(\d+)\s*OK/);
    const failMatch = summaryLine.match(/(\d+)\s*FAIL/);
    return {
      present: true,
      filled: !summaryLine.includes('__') && (!!okMatch || !!failMatch),
      okCount: okMatch ? parseInt(okMatch[1], 10) : 0,
      failCount: failMatch ? parseInt(failMatch[1], 10) : 0,
      source: path.relative(rootDir, file)
    };
  }
  return { present: false, filled: false, okCount: 0, failCount: 0, source: null };
}

/**
 * Checks the release tag for a version.
 *
 * A tag alone is not enough: the published artifact must correspond to the
 * current package content. The criterion therefore passes only if the tag exists
 * and no **artifact-relevant** file changed since that tag (documentation
 * commits after the release are fine, a changed manifest/background script is
 * not - that would require a new release).
 *
 * "Artifact-relevant" is derived from the package content list in
 * scripts/verify-package.js (ALLOWED_FILES + ALLOWED_PREFIXES), so every file
 * that ships in the XPI counts - including files a hand-maintained pattern
 * missed (finding M1 of PROBLEMANALYSE_STORE_READINESS_1_23_0.md).
 */
function isArtifactRelevant(file) {
  return ALLOWED_FILES.includes(file) || ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function releaseTagState(version) {
  const tag = 'v' + version;
  const tagCommit = spawnSync('git', ['rev-list', '-n', '1', tag], { cwd: ROOT, encoding: 'utf8' });
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const tagSha = (tagCommit.stdout || '').trim();
  const headSha = (head.stdout || '').trim();
  if (!tagSha) return { exists: false, atHead: false, tag, tagSha, headSha, changedArtifacts: [] };

  const diff = spawnSync('git', ['diff', '--name-only', tag + '..HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const changed = (diff.stdout || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const changedArtifacts = changed.filter((file) => isArtifactRelevant(file));
  return { exists: true, atHead: tagSha === headSha, tag, tagSha, headSha, changedArtifacts };
}

/**
 * Evaluates every criterion. `commandRunner` and `tagLookup` are injectable so
 * the gate itself is unit tested.
 */
function evaluateGate({ rootDir = ROOT, commandRunner = runCommand, tagLookup = releaseTagState, skipCommands = false } = {}) {
  const criteria = [];
  const add = (id, title, status, evidence) => criteria.push({ id, title, status, evidence });

  const commandCriteria = [
    ['C1', 'pre-submit checks (manifest, declaration, permissions, assets)', ['node', ['scripts/pre-submit-checks.js']]],
    ['C2', 'complete test suite (npm test)', ['npm', ['test']]],
    ['C3', 'web-ext lint with curated Thunderbird allow-list', ['node', ['scripts/lint-with-filter.js']]],
    ['C4', 'build + package content check', ['node', ['scripts/build-and-verify-package.js']]]
  ];

  if (skipCommands) {
    for (const [id, title] of commandCriteria) add(id, title, 'skipped', 'commands skipped (--no-commands)');
  } else {
    for (const [id, title, [command, args]] of commandCriteria) {
      const result = commandRunner(command, args);
      add(id, title, result.ok ? 'pass' : 'fail', result.output || '');
    }
  }

  const shots = collectScreenshots(rootDir);
  const qualifying = shots.filter((shot) => (shot.width || 0) >= MIN_LISTING_WIDTH);
  const shotEvidence = shots.length === 0
    ? 'no PNG/JPEG screenshots in docs/screenshots/'
    : shots.length + ' PNG/JPEG found (recursive), widths: ' +
      shots.map((shot) => shot.name + '=' + (shot.width === null ? '?' : shot.width + 'px')).join(', ');
  add('C5', 'real screenshots (PNG/JPEG, at least one with width >= ' + MIN_LISTING_WIDTH + ' px)',
    qualifying.length > 0 ? 'pass' : 'fail',
    qualifying.length > 0
      ? qualifying.map((shot) => shot.name + ' (' + shot.width + 'px)').join(', ')
      : (shots.length > 0
        ? shotEvidence + ' - none reaches ' + MIN_LISTING_WIDTH + ' px width (curate the listing set)'
        : shotEvidence));

  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
  const live = liveTestSummary(rootDir, manifest.version);
  const c6Title = 'live test protocol for version ' + manifest.version + ' (Thunderbird 140 ESR)';
  if (!live.present) {
    add('C6', c6Title, 'fail', 'no docs/live_test_' + manifest.version + '.md and no docs/live_test_protocol.md');
  } else if (!live.filled) {
    add('C6', c6Title, 'fail',
      live.source + ' has not been filled in yet (no result in the "Summe" line)');
  } else if (live.failCount > 0) {
    add('C6', c6Title, 'fail', live.failCount + ' documented FAIL entries in ' + live.source);
  } else if (live.okCount < 10) {
    add('C6', c6Title, 'fail',
      'only ' + live.okCount + ' OK entries recorded in ' + live.source + ' (at least 10 expected)');
  } else {
    add('C6', c6Title, 'pass', live.okCount + ' OK entries, no FAIL (source: ' + live.source + ')');
  }

  const tag = tagLookup(manifest.version);
  const title = 'release for version ' + manifest.version + ' matches the package content';
  if (tag && tag.exists && (tag.atHead || (tag.changedArtifacts || []).length === 0)) {
    add('C7', title, 'pass',
      tag.tag + ' -> ' + String(tag.tagSha).slice(0, 8) +
      (tag.atHead ? ' (at the submitted commit)' : ' (no artifact-relevant changes since the release)'));
  } else if (tag && tag.exists) {
    add('C7', title, 'fail',
      tag.tag + ' -> ' + String(tag.tagSha).slice(0, 8) + ' but these packaged files changed afterwards: ' +
      (tag.changedArtifacts || []).join(', ') + ' (publish a new version)');
  } else {
    add('C7', title, 'fail', 'no git tag ' + (tag ? tag.tag : 'v' + manifest.version) + ' yet');
  }

  const go = criteria.every((criterion) => criterion.status === 'pass');
  return { criteria, go };
}

function main() {
  const skipCommands = process.argv.includes('--no-commands');
  const { criteria, go } = evaluateGate({ skipCommands });

  console.log('Store-Readiness Go/No-Go gate');
  console.log('==============================');
  for (const criterion of criteria) {
    const symbol = criterion.status === 'pass' ? 'PASS' : (criterion.status === 'skipped' ? 'SKIP' : 'FAIL');
    console.log(symbol + '  ' + criterion.id + '  ' + criterion.title);
    for (const line of String(criterion.evidence).split('\n').filter(Boolean).slice(0, 6)) {
      console.log('        ' + line);
    }
  }
  const failed = criteria.filter((criterion) => criterion.status === 'fail');
  console.log('');
  console.log(go
    ? 'Result: GO - all criteria passed. The package may be signed and submitted.'
    : 'Result: NO-GO - ' + failed.length + ' unmet criteria: ' + failed.map((criterion) => criterion.id).join(', '));
  process.exitCode = go ? 0 : 1;
}

if (require.main === module) {
  main();
}

module.exports = { evaluateGate, hasScreenshots, liveTestSummary, releaseTagState, runCommand, isArtifactRelevant };
