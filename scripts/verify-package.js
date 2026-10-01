/**
 * Verifies the content of the built XPI.
 *
 * The store package must contain the runtime files only - no tests, no
 * documentation, no lock files and no legacy Manifest V2 leftovers.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ALLOWED_FILES = [
  'manifest.json',
  'background.js',
  'db.js',
  'api.js',
  'api_gateway.js',
  'options.html',
  'options.js',
  'popup.html',
  'theme.css',
  'LICENSE'
];
// Runtime files that must be inside the package (otherwise the add-on is broken).
const REQUIRED_FILES = [
  'manifest.json',
  'background.js',
  'db.js',
  'api.js',
  'api_gateway.js',
  'options.html',
  'options.js',
  'popup.html',
  'theme.css'
];
const ALLOWED_PREFIXES = ['img/', '_locales/'];
const FORBIDDEN = [
  /install\.rdf$/,
  /\.test\.js$/,
  /_test\.js$/,
  /\.dev\.js$/,
  /^docs\//,
  /^test\//,
  /^testdata\//,
  /^tools\//,
  /^scripts\//,
  /^examples\//,
  /\.md$/,
  /^package(-lock)?\.json$/,
  /\.sh$/,
  /^\.webextignore$/
];
const MAX_UNCOMPRESSED_BYTES = 400 * 1024;

/**
 * Picks the artifact to check. `web-ext` writes one ZIP per version into the
 * artifacts directory, so "the last entry after sorting the names" would happily
 * validate an old build (a lexicographic sort puts `...-1.6.zip` after
 * `...-1.10.zip`). We therefore prefer the newest modification time and fall
 * back to the highest version number embedded in the file name.
 */
function selectArtifact(artifactsDir) {
  const names = fs.readdirSync(artifactsDir).filter((name) => name.endsWith('.zip') || name.endsWith('.xpi'));
  if (names.length === 0) return null;
  const versionOf = (name) => {
    const match = name.match(/-(\d+(?:\.\d+)*)(?:\.zip|\.xpi)$/);
    return match ? match[1].split('.').map((part) => parseInt(part, 10) || 0) : [];
  };
  const compareVersions = (a, b) => {
    const av = versionOf(a);
    const bv = versionOf(b);
    const length = Math.max(av.length, bv.length, 1);
    for (let i = 0; i < length; i += 1) {
      const diff = (av[i] || 0) - (bv[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };
  const sorted = names.slice().sort((a, b) => {
    const versionDiff = compareVersions(a, b);
    if (versionDiff !== 0) return versionDiff;
    return fs.statSync(path.join(artifactsDir, a)).mtimeMs -
      fs.statSync(path.join(artifactsDir, b)).mtimeMs;
  });
  return path.join(artifactsDir, sorted[sorted.length - 1]);
}


function listPackage(artifactPath) {
  const output = execFileSync('python3', ['-c', `
import json, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
print(json.dumps([{"name": i.filename, "size": i.file_size} for i in z.infolist()]))
`, artifactPath], { encoding: 'utf8' });
  return JSON.parse(output);
}

function main() {
  const artifactsDir = process.argv[2] || './build';
  if (!fs.existsSync(artifactsDir)) {
    console.error('Artifacts directory does not exist: ' + artifactsDir);
    process.exitCode = 1;
    return;
  }

  const artifact = selectArtifact(artifactsDir);
  if (!artifact) {
    console.error('No XPI/ZIP artifact found in ' + artifactsDir);
    process.exitCode = 1;
    return;
  }

  const entries = listPackage(artifact);
  const files = entries.filter((entry) => !entry.name.endsWith('/'));
  const names = files.map((file) => file.name);
  const problems = [];

  for (const file of files) {
    if (ALLOWED_FILES.includes(file.name)) continue;
    if (ALLOWED_PREFIXES.some((prefix) => file.name.startsWith(prefix))) continue;
    problems.push('unexpected file in package: ' + file.name);
  }
  for (const file of files) {
    if (FORBIDDEN.some((pattern) => pattern.test(file.name))) {
      problems.push('forbidden file in package: ' + file.name);
    }
  }
  for (const required of REQUIRED_FILES) {
    if (!names.includes(required)) {
      problems.push('runtime file is missing from the package: ' + required);
    }
  }

  const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
    problems.push('package is larger than expected: ' + totalBytes + ' bytes (limit ' + MAX_UNCOMPRESSED_BYTES + ')');
  }

  console.log('package: ' + artifact);
  console.log('files: ' + files.length + ', uncompressed size: ' + totalBytes + ' bytes');
  for (const file of files) console.log('  ' + file.name);

  if (problems.length > 0) {
    for (const problem of problems) console.error('PACKAGE CHECK FAILED: ' + problem);
    process.exitCode = 1;
    return;
  }

  console.log('Package content is valid.');
}

if (require.main === module) {
  main();
}

module.exports = { ALLOWED_FILES, REQUIRED_FILES, FORBIDDEN, selectArtifact };
