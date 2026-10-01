/**
 * Runs `web-ext lint` and pipes the machine readable result through the curated
 * Thunderbird allow-list (scripts/filter-lint-warnings.js).
 *
 * This exists so that CI and `npm run check` can use one command: plain
 * `web-ext lint` cannot fail on warnings (warningsAsErrors is off and would also
 * break on Thunderbird-only APIs), while the filter fails on every warning that
 * is not a documented Thunderbird false positive.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function main() {
  const reportFile = path.join(os.tmpdir(), 'thundy-web-ext-lint.json');
  const lint = spawnSync('npx', ['web-ext', 'lint', '--source-dir', '.', '--output', 'json'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8'
  });

  // `web-ext lint` writes the JSON report to stdout when errors were found with a
  // non-zero exit code, so the report is used whenever it is parseable.
  const raw = (lint.stdout || '').trim();
  if (!raw) {
    console.error('web-ext lint produced no output (exit code ' + lint.status + ')');
    console.error(lint.stderr || '');
    process.exitCode = 1;
    return;
  }
  try {
    JSON.parse(raw);
  } catch (e) {
    console.error('web-ext lint did not return JSON: ' + e.message);
    console.error(raw.split('\n').slice(0, 20).join('\n'));
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(reportFile, raw);

  const filter = spawnSync('node', [path.join(__dirname, 'filter-lint-warnings.js'), reportFile], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });
  process.exitCode = filter.status === 0 ? 0 : 1;
}

if (require.main === module) {
  main();
}

module.exports = { main };
