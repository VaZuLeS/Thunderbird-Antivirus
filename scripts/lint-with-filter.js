/**
 * Runs the pinned local `web-ext lint` and validates its in-memory result with
 * the curated Thunderbird allow-list (scripts/filter-lint-warnings.js).
 *
 * This exists so that CI and `npm run check` can use one command: plain
 * `web-ext lint` cannot fail on warnings (warningsAsErrors is off and would also
 * break on Thunderbird-only APIs), while the filter fails on every warning that
 * is not a documented Thunderbird false positive.
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { assessReport, printAssessment } = require('./filter-lint-warnings.js');

function assessLintRun(lint) {
  if (lint.error || lint.signal || ![0,1].includes(lint.status)) throw new Error('Lint process did not complete normally');
  let report;
  try { report = JSON.parse(lint.stdout); } catch (_) { throw new Error('Lint process did not return a valid JSON report'); }
  const assessment = assessReport(report);
  // Exit 1 is the documented errors-found outcome, not an execution-success bypass.
  if (lint.status !== 0 && report.errors.length === 0) throw new Error('Lint process failed without reporting lint errors');
  return assessment;
}

function main() {
  const lint = spawnSync(process.execPath, [path.resolve(__dirname, '../node_modules/web-ext/bin/web-ext.js'), 'lint', '--source-dir', '.', '--output', 'json'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8'
  });

  try {
    const assessment = assessLintRun(lint);
    printAssessment(assessment);
    process.exitCode = assessment.accepted ? 0 : 1;
  } catch (error) {
    console.error('Lint rejected: ' + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, assessLintRun };
