#!/usr/bin/env node
/**
 * Builds the installable add-on package as *.xpi.
 *
 * Steps: web-ext build -> rename to <slug>-<version>.xpi -> verify the package
 * content (see scripts/verify-package.js). The result can be loaded in
 * Thunderbird through about:debugging (temporary add-on) or distributed after
 * signing via `web-ext sign`.
 *
 * Usage: node scripts/build-xpi.js [--artifacts-dir ./build] [--channel unlisted]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main() {
  const artifactsDir = path.resolve(repoRoot, argument('--artifacts-dir', 'build'));
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
  const baseName = 'thundy-av-' + manifest.version;

  fs.rmSync(artifactsDir, { recursive: true, force: true });
  fs.mkdirSync(artifactsDir, { recursive: true });

  console.log('Building ' + baseName + '.xpi ...');
  execFileSync('npx', ['web-ext', 'build', '--source-dir', '.', '--artifacts-dir', artifactsDir, '--overwrite-dest'], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  const produced = fs.readdirSync(artifactsDir).filter((file) => file.endsWith('.zip'));
  if (produced.length !== 1) {
    console.error('Expected exactly one ZIP artifact, found: ' + produced.join(', '));
    process.exitCode = 1;
    return;
  }

  const xpiPath = path.join(artifactsDir, baseName + '.xpi');
  fs.renameSync(path.join(artifactsDir, produced[0]), xpiPath);

  console.log('Verifying package content ...');
  execFileSync('node', [path.join(__dirname, 'verify-package.js'), artifactsDir], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  console.log('\nXPI ready: ' + path.relative(repoRoot, xpiPath));
  console.log('Install for testing: Thunderbird -> Tools -> Add-ons and Themes -> gear icon -> "Debug Add-ons" -> "Load Temporary Add-on" -> select the .xpi file.');
}

if (require.main === module) {
  main();
}

module.exports = { };
