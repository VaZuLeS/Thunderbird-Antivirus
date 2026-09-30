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
const ALLOWED_PREFIXES = ['img/', '_locales/'];
const FORBIDDEN = [
  /install\.rdf$/,
  /\.test\.js$/,
  /_test\.js$/,
  /^docs\//,
  /^test\//,
  /^testdata\//,
  /^scripts\//,
  /^examples\//,
  /\.md$/,
  /^package(-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /\.sh$/
];
const MAX_UNCOMPRESSED_BYTES = 400 * 1024;

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
  const candidates = fs.readdirSync(artifactsDir).filter((name) => name.endsWith('.zip'));
  if (candidates.length === 0) {
    console.error('No XPI/ZIP artifact found in ' + artifactsDir);
    process.exitCode = 1;
    return;
  }

  const artifact = path.join(artifactsDir, candidates.sort().pop());
  const entries = listPackage(artifact);
  const files = entries.filter((entry) => !entry.name.endsWith('/'));
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

module.exports = { ALLOWED_FILES, FORBIDDEN };
