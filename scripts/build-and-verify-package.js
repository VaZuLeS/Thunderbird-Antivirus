/**
 * Builds a fresh unsigned candidate, canonicalizes its ZIP metadata BEFORE
 * testing/signing, verifies its content and binds it to the current source.
 * Only the pinned local web-ext CLI is invoked; there is no npx fetch fallback.
 *
 * The artifacts directory is removed first: `scripts/verify-package.js` picks the
 * newest artifact, but a leftover ZIP from an older run must never be validated
 * (P2-20).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runTool } = require('./tool-process.js');
const { selectArtifact } = require('./verify-package.js');
const { packageIdentity } = require('./candidate-evidence.js');

const ROOT = path.resolve(__dirname, '..');
function buildPackage(root = ROOT, limits = {}) {
  const buildDir = path.join(root, 'build');
  fs.rmSync(buildDir, { recursive: true, force: true });
  const cli = path.join(root, 'node_modules/web-ext/bin/web-ext.js');
  if (!fs.existsSync(cli)) throw new Error('Pinned local web-ext is missing; run npm ci');
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-package-'));
  const run = (command, args) => {
    const result = runTool(command, args, { ...limits, cwd: root });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error || result.signal || result.status !== 0) {
      throw new Error('Package subprocess failed: ' + path.basename(command));
    }
  };
  try {
    const raw = path.join(staging, 'raw'), canonical = path.join(staging, 'candidate');
    run(process.execPath, [cli, 'build', '--source-dir', '.', '--artifacts-dir', raw]);
    run(process.execPath, [path.join(__dirname, 'verify-package.js'), raw]);
    const artifact = selectArtifact(raw);
    fs.mkdirSync(canonical);
    const candidate = path.join(canonical, path.basename(artifact));
    run('python3', [path.join(__dirname, 'reproducible-package.py'), artifact, candidate]);
    run(process.execPath, [path.join(__dirname, 'verify-package.js'), canonical]);
    fs.mkdirSync(buildDir);
    fs.copyFileSync(candidate, path.join(buildDir, path.basename(candidate)), fs.constants.COPYFILE_EXCL);
    const identity = packageIdentity(root);
    console.log('Candidate identity: ' + JSON.stringify(identity));
    return identity;
  } catch (error) {
    fs.rmSync(buildDir, { recursive: true, force: true });
    throw error;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function main() {
  try { buildPackage(); }
  catch (error) { console.error('Package build rejected: ' + error.message); process.exitCode = 1; }
}

module.exports = { buildPackage };

if (require.main === module) {
  main();
}
