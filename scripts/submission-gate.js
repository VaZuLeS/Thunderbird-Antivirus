/**
 * Executable Go/No-Go gate for a submission to the Thunderbird Add-ons Store.
 *
 * Section 10 of docs/PROBLEMANALYSE_STORE_READINESS.md lists seven criteria that
 * must hold before the add-on may be submitted. This script turns that
 * checklist into a check that can be run at any time, so that a submission is
 * never started with an obvious gap (missing screenshots, unverified live test,
 * incomplete localization, missing reviewer package, ...).
 *
 * The checks are static (files and their content) and therefore fast; the
 * dynamic part (tests, lint, package build) is covered by `npm run check`.
 *
 * Usage: node scripts/submission-gate.js [rootDir]
 * Exit code 1 as soon as at least one blocker is found.
 */
const fs = require('fs');
const path = require('path');

const MIN_SCREENSHOTS = 3;
const MIN_SCREENSHOT_WIDTH = 1200;
const MIN_CHECKED_PROTOCOL_BOXES = 6;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngSize(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function collectFiles(dir, extension) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...collectFiles(target, extension));
    else if (!extension || target.toLowerCase().endsWith(extension)) result.push(target);
  }
  return result;
}

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/**
 * Collects every localization key that the UI or the runtime code uses.
 * Returns { used: Set, missing: string[] }.
 */
function collectI18nKeys(rootDir) {
  const catalogues = {};
  for (const locale of ['en', 'de']) {
    const file = path.join(rootDir, '_locales', locale, 'messages.json');
    catalogues[locale] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  }
  const used = new Set();
  for (const page of ['options.html', 'popup.html']) {
    const html = readIfExists(path.join(rootDir, page));
    if (!html) continue;
    for (const match of html.matchAll(/data-i18n(?:-placeholder|-aria-label|-title)?="([A-Za-z0-9_]+)"/g)) {
      used.add(match[1]);
    }
  }
  for (const source of ['background.js', 'options.js', 'api.js']) {
    const code = readIfExists(path.join(rootDir, source));
    if (!code) continue;
    for (const match of code.matchAll(/\b(?:t|msg)\('([A-Za-z0-9_]+)'/g)) used.add(match[1]);
  }
  const manifest = readIfExists(path.join(rootDir, 'manifest.json')) || '';
  for (const match of manifest.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) used.add(match[1]);

  const missing = [];
  for (const key of used) {
    for (const locale of ['en', 'de']) {
      if (!catalogues[locale][key]) missing.push(`${locale}:${key}`);
    }
  }
  return { used, missing };
}

function runGate(rootDir) {
  const blockers = [];
  const warnings = [];
  const passes = [];

  const fail = (message) => blockers.push(message);
  const warn = (message) => warnings.push(message);
  const ok = (message) => passes.push(message);

  const manifestPath = path.join(rootDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fail('manifest.json is missing - is this the add-on repository root?');
    return { blockers, warnings, passes };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const version = manifest.version;
  const normalize = (value) => String(value).split('.').concat(['0', '0', '0']).slice(0, 3).join('.');

  // 1. version consistency across manifest, package.json, changelog and listing
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (normalize(pkg.version) !== normalize(version)) {
      fail(`package.json version ${pkg.version} differs from manifest.json version ${version}`);
    } else {
      ok(`version ${version} is consistent in manifest.json and package.json`);
    }
  } else {
    warn('package.json is missing, version consistency could not be checked');
  }

  const changelog = readIfExists(path.join(rootDir, 'CHANGELOG.md'));
  if (!changelog) fail('CHANGELOG.md is missing');
  else if (!changelog.includes(`## [${version}]`) && !changelog.includes(`## [${normalize(version)}]`)) {
    warn(`CHANGELOG.md has no section for version ${version} - release notes are part of the listing`);
  } else {
    ok(`CHANGELOG.md documents version ${version}`);
  }

  const listing = readIfExists(path.join(rootDir, 'docs', 'store_listing.md'));
  if (!listing) fail('docs/store_listing.md is missing - the listing text is required for submission');
  else if (!listing.includes(version)) fail(`docs/store_listing.md does not mention version ${version}`);
  else ok('the store listing text mentions the version to be submitted');

  // 2. real screenshots (store listing assets)
  const images = collectFiles(path.join(rootDir, 'docs'), '.png');
  const usable = [];
  for (const image of images) {
    const size = readPngSize(fs.readFileSync(image));
    if (size && size.width >= MIN_SCREENSHOT_WIDTH) {
      usable.push(`${path.relative(rootDir, image)} (${size.width}x${size.height})`);
    }
  }
  if (usable.length < MIN_SCREENSHOTS) {
    fail(`only ${usable.length} of ${MIN_SCREENSHOTS} required screenshots found in docs/ ` +
      `(PNG, at least ${MIN_SCREENSHOT_WIDTH}px wide) - see docs/screenshot_capture.md`);
  } else {
    ok(`${usable.length} usable screenshots found: ${usable.join(', ')}`);
  }

  // 3. executed live test in Thunderbird
  const protocol = readIfExists(path.join(rootDir, 'docs', 'live_test_protocol.md'));
  if (!protocol) {
    fail('docs/live_test_protocol.md is missing - the manual verification is a submission blocker');
  } else {
    const checked = (protocol.match(/^- \[x\]/gmi) || []).length;
    const unchecked = (protocol.match(/^- \[ \]/gm) || []).length;
    if (unchecked > 0) {
      fail(`the live test protocol still has ${unchecked} open checklist item(s) - the test in ` +
        'Thunderbird 140 ESR has not been performed');
    } else if (checked < MIN_CHECKED_PROTOCOL_BOXES) {
      fail(`the live test protocol has only ${checked} completed checklist item(s); expected at least ` +
        `${MIN_CHECKED_PROTOCOL_BOXES}`);
    } else {
      ok('the live test protocol is completed');
    }
    const unfilled = [];
    for (const label of ['Datum', 'Thunderbird-Version', 'Getestet von']) {
      const row = protocol.split('\n').find((line) => line.trim().startsWith(`| ${label}`));
      const value = row ? row.split('|').slice(2, 3).join('').trim() : '';
      if (value === '') unfilled.push(label);
    }
    if (unfilled.length > 0) {
      fail('the live test protocol still has an empty environment field: ' + unfilled.join(', '));
    }
  }

  // 4. complete localization
  const i18n = collectI18nKeys(rootDir);
  if (i18n.missing.length > 0) {
    fail(`${i18n.missing.length} localization key(s) missing: ${i18n.missing.slice(0, 8).join(', ')}` +
      (i18n.missing.length > 8 ? ' ...' : ''));
  } else {
    ok(`all ${i18n.used.size} localization keys used by the UI exist in both catalogues`);
  }

  // 5. reviewer package
  const requiredDocs = [
    ['docs/reviewer_notes.md', 'reviewer notes'],
    ['docs/privacy_policy.md', 'privacy policy'],
    ['docs/testdata.md', 'test data description']
  ];
  const missingDocs = requiredDocs.filter(([file]) => !fs.existsSync(path.join(rootDir, file)));
  if (missingDocs.length > 0) {
    fail('reviewer package incomplete: ' + missingDocs.map(([, label]) => label).join(', '));
  } else {
    ok('reviewer package present (notes, privacy policy, test data)');
  }
  const notes = readIfExists(path.join(rootDir, 'docs', 'reviewer_notes.md')) || '';
  if (!/Anticipated review questions/.test(notes)) {
    warn('docs/reviewer_notes.md has no response catalogue for expected review questions (A-33)');
  }
  const fixtures = collectFiles(path.join(rootDir, 'testdata'), '.eml');
  if (fixtures.length === 0) {
    warn('no test messages found - run `node scripts/make-testdata.js` for the reviewer package');
  } else {
    ok(`${fixtures.length} test message(s) available for the review`);
  }

  // 6. documented policy decisions and the ATN signing target
  if (!fs.existsSync(path.join(rootDir, 'docs', 'data_collection_decision.md'))) {
    warn('docs/data_collection_decision.md is missing - justify the data collection declaration');
  } else {
    ok('the data collection declaration is documented');
  }
  const releaseWorkflow = readIfExists(path.join(rootDir, 'docs', 'ci', 'release.yml')) || '';
  if (!/--amo-base-url/.test(releaseWorkflow) || !/addons\.thunderbird\.net\/api\/v5/.test(releaseWorkflow)) {
    fail('docs/ci/release.yml does not sign against addons.thunderbird.net (--amo-base-url) - ' +
      'web-ext would upload the Thunderbird add-on to AMO');
  } else {
    ok('the release workflow signs against the Thunderbird Add-ons Store');
  }

  // 7. build artifact (informational: signing happens in the release job)
  const artifacts = collectFiles(path.join(rootDir, 'build'), '.zip')
    .concat(collectFiles(path.join(rootDir, 'build'), '.xpi'));
  if (artifacts.length === 0) {
    warn('no built artifact in ./build - run `npm run package:verify` before submitting');
  } else {
    ok(`${artifacts.length} build artifact(s) present in ./build`);
  }

  return { blockers, warnings, passes };
}

function main() {
  const rootDir = process.argv[2] || path.join(__dirname, '..');
  const { blockers, warnings, passes } = runGate(rootDir);

  for (const line of passes) console.log('ok: ' + line);
  for (const line of warnings) console.log('warning: ' + line);
  for (const line of blockers) console.log('BLOCKER: ' + line);

  console.log('');
  if (blockers.length > 0) {
    console.error(`Submission gate: NOT READY (${blockers.length} blocker(s), ${warnings.length} warning(s)).`);
    process.exitCode = 1;
  } else {
    console.log(`Submission gate: ready (${warnings.length} warning(s)).`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runGate, readPngSize, collectI18nKeys, MIN_SCREENSHOTS, MIN_SCREENSHOT_WIDTH };

