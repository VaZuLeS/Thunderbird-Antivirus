/**
 * Fails when addons-linter reports errors or unexpected warnings.
 *
 * The linter ships Firefox API metadata only, so Thunderbird specific APIs and
 * permissions are reported as "unsupported". Those known false positives are
 * listed here explicitly - everything else fails the CI job.
 */
const fs = require('fs');

const KNOWN_THUNDERBIRD_FALSE_POSITIVES = [
  'messagesRead',
  'messageDisplay.getDisplayedMessages',
  'messageDisplay.getDisplayedMessage',
  'messageDisplay.onMessagesDisplayed',
  'messageDisplay.onMessageDisplayed',
  'messages.get(',
  'messages.get is not supported',
  'messages.getFull',
  'messages.listAttachments',
  'messages.getAttachmentFile',
  'messages.query',
  'scripting.messageDisplay',
  // Thunderbird dokumentiert openPopup fuer die messageDisplayAction (der Firefox-Linter kennt sie nicht)
  'message_display_action.openPopup',
  'alarms'
];

const ALLOWED_CODES = [
  // Thunderbird only permission / API surface
  'MANIFEST_PERMISSIONS',
  'UNSUPPORTED_API',
  // The add-on targets Thunderbird, not Firefox for Android
  'KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION'
];

function isKnownFalsePositive(warning) {
  if (!ALLOWED_CODES.includes(warning.code)) return false;
  // The add-on is distributed for Thunderbird only; the Firefox for Android
  // compatibility notice can never apply and is always irrelevant.
  if (warning.code === 'KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION') return true;
  const message = warning.message || '';
  return KNOWN_THUNDERBIRD_FALSE_POSITIVES.some((needle) => message.includes(needle));
}

function main() {
  const file = process.argv[2] || '/tmp/lint.json';
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = report.errors || [];
  const warnings = report.warnings || [];
  const unexpected = warnings.filter((warning) => !isKnownFalsePositive(warning));

  console.log('lint summary:', JSON.stringify(report.summary));
  for (const warning of warnings) {
    const known = isKnownFalsePositive(warning);
    console.log((known ? 'known-false-positive: ' : 'UNEXPECTED WARNING: ') + warning.code + ' | ' + warning.message);
  }

  if (errors.length > 0) {
    for (const error of errors) console.error('LINT ERROR: ' + error.code + ' | ' + error.message);
    process.exitCode = 1;
    return;
  }

  if (unexpected.length > 0) {
    console.error('\n' + unexpected.length + ' unexpected lint warning(s); fix them or document them as known Thunderbird false positives.');
    process.exitCode = 1;
    return;
  }

  console.log('\nLint ok: ' + warnings.length + ' warning(s), all of them known Thunderbird false positives.');
}

if (require.main === module) {
  main();
}

module.exports = { isKnownFalsePositive, KNOWN_THUNDERBIRD_FALSE_POSITIVES };
