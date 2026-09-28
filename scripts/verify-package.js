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
  'ui_i18n.js',
  'LICENSE'
];
const ALLOWED_PREFIXES = ['img/', '_locales/', 'messageDisplay/'];
const FORBIDDEN = [
  /install\.rdf$/,
  /\.test\.js$/,
  /_test\.js$/,
  /^docs\//,
  /^test\//,
  /^scripts\//,
  /^examples\//,
  /\.md$/,
  /^package(-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /\.sh$/
];
// Schutzgrenze gegen versehentlich mitgepackte Entwicklungsdateien: Tests und
// Dokumentation wuerden das Paket um mehrere hundert Kilobyte vergroessern.
// Der reine Laufzeitcode liegt aktuell bei ~420 KB.
const MAX_UNCOMPRESSED_BYTES = 600 * 1024;

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
  const candidates = fs.readdirSync(artifactsDir).filter((name) => /\.(zip|xpi)$/i.test(name));
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

  // Funktionaler Smoke-Test: Alle im gepackten Manifest referenzierten Dateien
  // muessen im Archiv liegen, ebenso die Skripte, die background.js registriert.
  const names = new Set(entries.map((entry) => entry.name));
  const readEntry = (name) => {
    const output = execFileSync('python3', ['-c', `
import sys, zipfile
sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode('utf-8', 'ignore'))
`, artifact, name], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return output;
  };

  try {
    const manifest = JSON.parse(readEntry('manifest.json'));
    const referenced = [];
    for (const icon of Object.values(manifest.icons || {})) referenced.push(icon);
    for (const script of (manifest.background && manifest.background.scripts) || []) referenced.push(script);
    if (manifest.options_ui && manifest.options_ui.page) referenced.push(manifest.options_ui.page);
    const action = manifest.message_display_action || {};
    if (action.default_popup) referenced.push(action.default_popup);
    if (action.default_icon) referenced.push(action.default_icon);
    for (const file of referenced) {
      if (!names.has(file)) problems.push('manifest.json references a file that is missing in the package: ' + file);
    }

    const background = readEntry('background.js');
    const scriptFiles = Array.from(background.matchAll(/'(messageDisplay\/[A-Za-z0-9_.-]+)'/g)).map((m) => m[1]);
    for (const file of new Set(scriptFiles)) {
      if (!names.has(file)) problems.push('background.js registers a message display script that is missing in the package: ' + file);
    }
  } catch (e) {
    problems.push('package smoke test failed: ' + e.message);
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
