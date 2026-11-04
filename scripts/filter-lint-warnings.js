/**
 * Fails when addons-linter reports errors or unexpected warnings.
 *
 * The linter ships Firefox API metadata only, so Thunderbird specific APIs and
 * permissions are reported as "unsupported". Those known false positives are
 * listed here explicitly - everything else fails the CI job.
 *
 * Deliberately NOT listed any more: `messageDisplay.onMessageDisplayed` and
 * `messageDisplay.getDisplayedMessage`. Those APIs were really removed in
 * Manifest V3 (Thunderbird's schema marks them `max_manifest_version: 2`), so
 * allow-listing them would hide exactly the regression that the store-readiness
 * analysis flagged as blocker B1/P0-3. `scripts/pre-submit-checks.js` now checks
 * the runtime files for them instead.
 */
const fs = require('fs');

const KNOWN_THUNDERBIRD_FALSE_POSITIVES = [
  'messageDisplay.getDisplayedMessages',
  'messageDisplay.onMessagesDisplayed',
  'messages.getFull',
  // Thunderbird messages.get(messageId) retrieves the authoritative MessageHeader.
  'messages.get',
  'messages.listAttachments',
  'messages.getAttachmentFile',
  'messages.query',
  // Thunderbird API since TB 85; absent from Firefox's linter schema.
  // https://webextension-api.thunderbird.net/en/mv3/windows.html#opendefaultbrowser-url
  'windows.openDefaultBrowser',
  'scripting.messageDisplay',
  'scripting.messageDisplay.register',
  'scripting.messageDisplay.unregister'
];

const ALLOWED_CODES = [
  // Thunderbird only permission / API surface
  'MANIFEST_PERMISSIONS',
  'MANIFEST_OPTIONAL_PERMISSIONS',
  'UNSUPPORTED_API',
  // The add-on targets Thunderbird, not Firefox for Android
  'KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION'
];

function isKnownFalsePositive(warning) {
  if (!warning || typeof warning.message !== 'string') return false;
  if (!ALLOWED_CODES.includes(warning.code)) return false;
  // The add-on is distributed for Thunderbird only; the Firefox for Android
  // compatibility notice can never apply and is always irrelevant.
  if (warning.code === 'KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION') return true;
  if (warning.code === 'MANIFEST_OPTIONAL_PERMISSIONS') {
    return /^(?:\/optional_permissions: )?Invalid optional_permissions "sensitiveDataUpload" at \d+\.$/.test(warning.message);
  }
  if (warning.code === 'MANIFEST_PERMISSIONS') {
    return /^(?:\/permissions: )?Invalid permissions "messagesRead" at \d+\.$/.test(warning.message);
  }
  return warning.code === 'UNSUPPORTED_API' && KNOWN_THUNDERBIRD_FALSE_POSITIVES.some(api => warning.message === api + ' is not supported');
}

function assessReport(report) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const invalid = () => { throw new Error('Incomplete or inconsistent lint report'); };
  if (!object(report) || !object(report.summary) || !object(report.metadata)) invalid();
  for (const [bucket, type] of [['errors','error'],['warnings','warning'],['notices','notice']]) {
    if (!Array.isArray(report[bucket]) || !Number.isSafeInteger(report.summary[bucket]) || report.summary[bucket] < 0 || report.summary[bucket] !== report[bucket].length) invalid();
    if (report[bucket].some(item => !object(item) || typeof item.code !== 'string' || !item.code.trim() || typeof item.message !== 'string' || !item.message.trim() || item._type !== undefined && item._type !== type)) invalid();
  }
  if (!Number.isSafeInteger(report.count) || report.count < 0 || report.count !== report.errors.length + report.warnings.length + report.notices.length) invalid();
  const unexpected = report.warnings.filter(warning => !isKnownFalsePositive(warning));
  return {report,unexpected,accepted:report.errors.length === 0 && unexpected.length === 0};
}

function printAssessment({report,unexpected,accepted}, logger = console) {
  const {errors,warnings} = report;
  logger.log('lint summary:', JSON.stringify(report.summary));
  for (const warning of warnings) {
    const known = isKnownFalsePositive(warning);
    logger.log((known ? 'known-false-positive: ' : 'UNEXPECTED WARNING: ') + warning.code + ' | ' + warning.message);
  }

  if (errors.length > 0) {
    for (const error of errors) logger.error('LINT ERROR: ' + error.code + ' | ' + error.message);
  }

  if (unexpected.length > 0) {
    logger.error('\n' + unexpected.length + ' unexpected lint warning(s); fix them or document them as known Thunderbird false positives.');
  }

  if (accepted) logger.log('\nLint ok: ' + warnings.length + ' warning(s), all of them known Thunderbird false positives.');
}

function main() {
  try {
    const report = JSON.parse(fs.readFileSync(process.argv[2] || '/tmp/lint.json', 'utf8'));
    const assessment = assessReport(report);
    printAssessment(assessment);
    process.exitCode = assessment.accepted ? 0 : 1;
  } catch (_) {
    console.error('Lint report rejected: unreadable, invalid or inconsistent report.');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { isKnownFalsePositive, KNOWN_THUNDERBIRD_FALSE_POSITIVES, assessReport, printAssessment };
