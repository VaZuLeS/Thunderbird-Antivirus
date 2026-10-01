/**
 * Builds the XPI into ./build and verifies its content in one step.
 *
 * The artifacts directory is removed first: `scripts/verify-package.js` picks the
 * newest artifact, but a leftover ZIP from an older run must never be validated
 * (P2-20).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const buildDir = path.join(ROOT, 'build');

function main() {
  fs.rmSync(buildDir, { recursive: true, force: true });

  const build = spawnSync('npx', ['web-ext', 'build', '--source-dir', '.', '--artifacts-dir', './build'], {
    cwd: ROOT,
    stdio: 'inherit'
  });
  if (build.status !== 0) {
    process.exitCode = 1;
    return;
  }

  const verify = spawnSync('node', [path.join(__dirname, 'verify-package.js'), './build'], {
    cwd: ROOT,
    stdio: 'inherit'
  });
  process.exitCode = verify.status === 0 ? 0 : 1;
}

if (require.main === module) {
  main();
}
