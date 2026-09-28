/**
 * Pre-submit checks for Thundy AV (Thunderbird add-on store readiness).
 *
 * The checks are implemented as a pure function so that they can be unit
 * tested (see scripts/pre-submit-checks.test.js). The command line wrapper is
 * executed when the file is run directly and exits with a non-zero status if any
 * check failed, so the CI job (and a manual run) really fail.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_LOCALES = ['en', 'de'];
const REQUIRED_MDM_KEYS = ['gecko'];
const FORBIDDEN_PERMISSIONS = ['webRequest', '<all_urls>', 'management'];
const MV3_UNSUPPORTED_KEYS = ['content_scripts', 'optional_permissions', 'user_scripts', 'web_accessible_resources'];

// Match patterns: <scheme>://<host><path> (path is mandatory, e.g. "/*")
const MATCH_PATTERN_RE = /^(https?|wss?|ftp):\/\/(\*|\*\.[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*|[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*)\/.*$/;

function collectFiles(rootDir, relative) {
  const target = path.join(rootDir, relative);
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return [target];
  return fs.readdirSync(target).flatMap((entry) => collectFiles(rootDir, path.join(relative, entry)));
}

function runChecks(rootDir) {
  const errors = [];
  const warnings = [];
  const passes = [];

  const fail = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);
  const ok = (message) => passes.push(message);

  const manifestPath = path.join(rootDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fail('manifest.json missing');
    return { errors, warnings, passes };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    fail('manifest.json is not valid JSON: ' + e.message);
    return { errors, warnings, passes };
  }

  // --- basic metadata ------------------------------------------------------
  if (manifest.manifest_version !== 3) fail('manifest_version must be 3 for new Thunderbird submissions');
  else ok('manifest_version is 3');

  if (!manifest.name) fail('manifest.name is missing');
  if (!manifest.version || !/^\d+(\.\d+){0,3}$/.test(manifest.version)) fail('manifest.version has an invalid format: ' + manifest.version);
  else ok('manifest.version format is valid (' + manifest.version + ')');

  if (!manifest.description || manifest.description.trim().length < 20) fail('manifest.description is missing or too short');
  if (/^thunderbird\b/i.test(manifest.name || '')) {
    fail('manifest.name starts with the Thunderbird trademark; use the "<Name> for Thunderbird" convention');
  }

  if (!/^https:\/\//.test(manifest.homepage_url || '')) fail('manifest.homepage_url must be an https URL');
  else ok('homepage_url present and https');

  // --- icons ---------------------------------------------------------------
  for (const size of ['16', '32', '64']) {
    const iconPath = manifest.icons && manifest.icons[size];
    if (!iconPath) fail('manifest.icons is missing the ' + size + 'px entry');
    else if (!fs.existsSync(path.join(rootDir, iconPath))) fail('icon file is missing on disk: ' + iconPath);
  }
  // Verify that declared icon files really are PNGs of the declared size.
  for (const [size, iconPath] of Object.entries(manifest.icons || {})) {
    const absolute = path.join(rootDir, iconPath);
    if (!fs.existsSync(absolute)) continue;
    const header = fs.readFileSync(absolute).subarray(0, 24);
    const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (!isPng) {
      warn('icon ' + iconPath + ' is not a PNG file');
      continue;
    }
    const width = header.readUInt32BE(16);
    const height = header.readUInt32BE(20);
    if (String(width) !== String(size) || String(height) !== String(size)) {
      fail('icon ' + iconPath + ' is ' + width + 'x' + height + ' but is declared as ' + size + 'px in manifest.icons');
    }
  }

  // --- localization --------------------------------------------------------
  if (manifest.default_locale) {
    const localeFile = path.join(rootDir, '_locales', manifest.default_locale, 'messages.json');
    if (!fs.existsSync(localeFile)) fail('default_locale is set but _locales/' + manifest.default_locale + '/messages.json is missing');
    else ok('default locale catalogue present');
  } else {
    warn('default_locale is not set; localizing name/description is recommended');
  }

  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const referencedMessages = Array.from(manifestRaw.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)).map((m) => m[1]);
  for (const locale of DEFAULT_LOCALES) {
    const localeFile = path.join(rootDir, '_locales', locale, 'messages.json');
    if (!fs.existsSync(localeFile)) { warn('_locales/' + locale + '/messages.json is missing'); continue; }
    let catalogue = {};
    try {
      catalogue = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
    } catch (e) {
      fail('_locales/' + locale + '/messages.json is not valid JSON: ' + e.message);
      continue;
    }
    for (const key of referencedMessages) {
      if (!catalogue[key]) fail('__MSG_' + key + '__ is used in manifest.json but missing in _locales/' + locale + '/messages.json');
    }
  }

  // --- add-on id / compatibility ------------------------------------------
  const gecko = (manifest.browser_specific_settings && manifest.browser_specific_settings.gecko) || {};
  for (const key of REQUIRED_MDM_KEYS) {
    if (!manifest.browser_specific_settings || !manifest.browser_specific_settings[key]) fail('browser_specific_settings.' + key + ' is missing');
  }
  if (!gecko.id) fail('browser_specific_settings.gecko.id is missing (required to publish on ATN)');
  else if (!/^(@?[A-Za-z0-9._-]+@[A-Za-z0-9.-]+|[\{[0-9a-f-]{36}\}])$/i.test(gecko.id)) fail('gecko.id is not a valid email-style id or GUID: ' + gecko.id);
  else ok('add-on id is set (' + gecko.id + ')');
  if (!gecko.strict_min_version) warn('strict_min_version is not set');

  // --- data collection declaration ----------------------------------------
  const dcp = gecko.data_collection_permissions;
  if (!dcp) {
    fail('browser_specific_settings.gecko.data_collection_permissions is missing: the add-on transmits message data to third parties');
  } else {
    const requiredTypes = Array.isArray(dcp.required) ? dcp.required : [];
    const optionalTypes = Array.isArray(dcp.optional) ? dcp.optional : [];
    if (requiredTypes.length === 0) fail('data_collection_permissions.required must list at least one data type');
    if (requiredTypes.includes('none')) {
      if (optionalTypes.length > 0) fail('data_collection_permissions is contradictory: "none" cannot be combined with optional data types');
      else fail('data_collection_permissions declares "none" although the add-on transmits message data to analysis providers');
    }
    const allowed = ['authenticationInfo', 'bookmarksInfo', 'browsingActivity', 'financialAndPaymentInfo', 'healthInfo',
      'locationInfo', 'personalCommunications', 'personallyIdentifyingInfo', 'searchTerms', 'websiteActivity', 'websiteContent', 'technicalAndInteraction', 'none'];
    for (const type of requiredTypes.concat(optionalTypes)) {
      if (!allowed.includes(type)) fail('unknown data_collection_permissions value: ' + type);
    }
  }

  // --- permissions ---------------------------------------------------------
  const permissions = manifest.permissions || [];
  for (const forbidden of FORBIDDEN_PERMISSIONS) {
    if (permissions.includes(forbidden)) fail('forbidden permission in manifest.permissions: ' + forbidden);
  }
  for (const entry of permissions) {
    if (typeof entry === 'string' && (entry.includes('://') || entry.startsWith('*'))) {
      fail('host patterns must not be listed in permissions (Manifest V3): ' + entry);
    }
  }
  for (const entry of manifest.optional_permissions || []) {
    fail('optional_permissions is not supported in Thunderbird Manifest V3, use optional_host_permissions: ' + entry);
  }

  const optionalHosts = manifest.optional_host_permissions || [];
  if (optionalHosts.length === 0 && permissions.length === 0) warn('no permissions declared at all - is that intended?');
  for (const origin of optionalHosts) {
    if (!MATCH_PATTERN_RE.test(origin)) fail('optional_host_permissions contains an invalid match pattern: ' + origin);
  }
  if (optionalHosts.length > 0) ok('optional_host_permissions are valid match patterns (' + optionalHosts.length + ')');
  if (optionalHosts.length > 0 && !errors.some((e) => e.startsWith('data_collection_permissions'))) {
    ok('host permissions are optional and declared for analysis providers');
  }

  // --- Manifest V3 key restrictions ---------------------------------------
  for (const key of MV3_UNSUPPORTED_KEYS) {
    if (manifest[key] !== undefined) fail('manifest key "' + key + '" is not supported in Thunderbird Manifest V3');
  }
  const jsonForStyleCheck = JSON.stringify(manifest);
  if (jsonForStyleCheck.includes('browser_style')) fail('browser_style is not supported in Manifest V3 (options_ui/action)');

  // --- referenced files ----------------------------------------------------
  if (manifest.background && Array.isArray(manifest.background.scripts)) {
    for (const script of manifest.background.scripts) {
      if (!fs.existsSync(path.join(rootDir, script))) fail('background script is missing on disk: ' + script);
    }
    if (manifest.background.scripts.length === 0) fail('background.scripts is empty');
  } else {
    fail('manifest.background.scripts is required for Thunderbird (event pages)');
  }
  const optionsPage = manifest.options_ui && manifest.options_ui.page;
  if (!optionsPage) fail('options_ui.page is missing');
  else if (!fs.existsSync(path.join(rootDir, optionsPage))) fail('options page is missing on disk: ' + optionsPage);
  const popup = manifest.message_display_action && manifest.message_display_action.default_popup;
  if (popup && !fs.existsSync(path.join(rootDir, popup))) fail('message_display_action popup is missing on disk: ' + popup);

  // message display scripts registered by background.js must exist on disk
  const backgroundPath = path.join(rootDir, ((manifest.background || {}).scripts || [])[0] || 'background.js');
  const backgroundSource = fs.existsSync(path.join(rootDir, 'background.js'))
    ? fs.readFileSync(path.join(rootDir, 'background.js'), 'utf8')
    : '';
  const displayScripts = Array.from(backgroundSource.matchAll(/'(messageDisplay\/[A-Za-z0-9_.-]+)'/g)).map((m) => m[1]);
  for (const script of new Set(displayScripts)) {
    if (!fs.existsSync(path.join(rootDir, script))) fail('message display script is missing on disk: ' + script);
  }
  if (displayScripts.length > 0) ok('message display scripts are present (' + new Set(displayScripts).size + ')');
  if (backgroundSource && !/registerMessageDisplayScript/.test(backgroundSource)) {
    warn('background.js does not register a message display script');
  }
  if (backgroundPath && !fs.existsSync(backgroundPath)) fail('background script is missing on disk: ' + backgroundPath);

  // --- repository / store assets ------------------------------------------
  if (fs.existsSync(path.join(rootDir, 'install.rdf'))) fail('install.rdf is a legacy Manifest V2 leftover and must be removed');
  else ok('no legacy install.rdf present');

  const privacyPolicy = path.join(rootDir, 'docs', 'privacy_policy.md');
  if (!fs.existsSync(privacyPolicy)) fail('docs/privacy_policy.md is missing');
  else ok('privacy policy document present');

  const screenshots = collectFiles(rootDir, 'docs').filter((file) => /\.(png|jpe?g)$/i.test(file));
  if (screenshots.length === 0) warn('no PNG/JPEG screenshots found in docs/ (the store listing needs real screenshots)');
  else ok('store screenshots found (' + screenshots.length + ')');

  const linkingFiles = ['docs/index.html', 'docs/index_en.html', 'docs/index_de.html'];
  const linked = linkingFiles.filter((file) => {
    const absolute = path.join(rootDir, file);
    return fs.existsSync(absolute) && /privacy_policy/i.test(fs.readFileSync(absolute, 'utf8'));
  });
  if (linked.length === 0) warn('no landing page links to the privacy policy');
  else ok('privacy policy is linked from ' + linked.length + ' landing page(s)');

  if (fs.existsSync(path.join(rootDir, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      const normalize = (value) => String(value).split('-')[0].split('.').map((part) => parseInt(part, 10) || 0);
      if (pkg.version) {
        const a = normalize(pkg.version);
        const b = normalize(manifest.version);
        const length = Math.max(a.length, b.length);
        const sameVersion = Array.from({ length }, (_, i) => a[i] || 0).join('.') ===
          Array.from({ length }, (_, i) => b[i] || 0).join('.');
        if (!sameVersion) {
          warn('package.json version (' + pkg.version + ') differs from manifest.json version (' + manifest.version + ')');
        } else {
          ok('package.json and manifest.json versions match');
        }
      }
    } catch (e) {
      warn('package.json could not be parsed: ' + e.message);
    }
  }

  // Lokalisierung: Katalogparitaet und verwendete Schluessel pruefen
  try {
    const { runLocaleCheck } = require('./check-locales.js');
    const localeResult = runLocaleCheck(rootDir);
    for (const problem of localeResult.problems) fail('Lokalisierung: ' + problem);
    if (localeResult.problems.length === 0) {
      ok('Lokalisierung vollstaendig (' + localeResult.locales.join('/') + ', ' + localeResult.usedKeys.length + ' Schluessel verwendet)');
    }
  } catch (e) {
    warn('Lokalisierungspruefung konnte nicht ausgefuehrt werden: ' + e.message);
  }

  return { errors, warnings, passes };
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const { errors, warnings, passes } = runChecks(rootDir);

  for (const message of passes) console.log('ok:', message);
  for (const message of warnings) console.warn('warning:', message);
  for (const message of errors) console.error('PRE-SUBMIT CHECK FAILED:', message);

  if (errors.length > 0) {
    console.error('\nPre-submit checks failed (' + errors.length + ' error(s), ' + warnings.length + ' warning(s)).');
    process.exitCode = 1;
    return;
  }

  console.log('\nPre-submit checks passed (' + warnings.length + ' warning(s), exit code 0).');
}

if (require.main === module) {
  main();
}

module.exports = { runChecks, MATCH_PATTERN_RE };
