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
 * Usage:
 *   node scripts/submission-gate.js            # full gate (runs tests, lint, build)
 *   node scripts/submission-gate.js --no-commands   # only artefacts/criteria, skip commands
 *
 * Exit code 0 = GO, 1 = NO-GO.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function runCommand(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  return {
    ok: result.status === 0,
    output: ((result.stdout || '') + (result.stderr || '')).trim().split('\n').slice(-6).join('\n')
  };
}

function hasScreenshots(rootDir) {
  const dir = path.join(rootDir, 'docs', 'screenshots');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => /\.(png|jpe?g)$/i.test(name));
}

function liveTestSummary(rootDir) {
  const file = path.join(rootDir, 'docs', 'live_test_protocol.md');
  if (!fs.existsSync(file)) return { present: false, filled: false, okCount: 0, failCount: 0 };
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
    failCount: failMatch ? parseInt(failMatch[1], 10) : 0
  };
}

/**
 * A release tag must exist for the exact commit that is submitted - an older tag
 * with the same version number is not enough.
 */
function releaseTagState(version) {
  const tag = 'v' + version;
  const tagCommit = spawnSync('git', ['rev-list', '-n', '1', tag], { cwd: ROOT, encoding: 'utf8' });
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const tagSha = (tagCommit.stdout || '').trim();
  const headSha = (head.stdout || '').trim();
  if (!tagSha) return { exists: false, atHead: false, tag, tagSha, headSha };
  return { exists: true, atHead: tagSha === headSha, tag, tagSha, headSha };
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

  const screenshots = hasScreenshots(rootDir);
  add('C5', 'real screenshots (PNG, no SVG placeholders)', screenshots.length > 0 ? 'pass' : 'fail',
    screenshots.length > 0 ? screenshots.join(', ') : 'no PNG/JPEG screenshots in docs/screenshots/');

  const live = liveTestSummary(rootDir);
  if (!live.present) {
    add('C6', 'live test protocol for Thunderbird 140 ESR', 'fail', 'docs/live_test_protocol.md is missing');
  } else if (!live.filled) {
    add('C6', 'live test protocol for Thunderbird 140 ESR', 'fail',
      'the protocol has not been filled in yet (no result in the "Summe" line)');
  } else if (live.failCount > 0) {
    add('C6', 'live test protocol for Thunderbird 140 ESR', 'fail', live.failCount + ' documented FAIL entries');
  } else if (live.okCount < 10) {
    add('C6', 'live test protocol for Thunderbird 140 ESR', 'fail',
      'only ' + live.okCount + ' OK entries recorded (at least 10 expected)');
  } else {
    add('C6', 'live test protocol for Thunderbird 140 ESR', 'pass', live.okCount + ' OK entries, no FAIL');
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
  const tag = tagLookup(manifest.version);
  if (tag && tag.exists && tag.atHead) {
    add('C7', 'release tag for version ' + manifest.version + ' points at the submitted commit', 'pass',
      tag.tag + ' -> ' + String(tag.tagSha).slice(0, 8));
  } else if (tag && tag.exists) {
    add('C7', 'release tag for version ' + manifest.version + ' points at the submitted commit', 'fail',
      tag.tag + ' points at ' + String(tag.tagSha).slice(0, 8) + ' but the submitted commit is ' +
      String(tag.headSha).slice(0, 8) + ' (re-tag deliberately or bump the version)');
  } else {
    add('C7', 'release tag for version ' + manifest.version + ' points at the submitted commit', 'fail',
      'no git tag ' + (tag ? tag.tag : 'v' + manifest.version) + ' yet');
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

module.exports = { evaluateGate, hasScreenshots, liveTestSummary, releaseTagState, runCommand };
