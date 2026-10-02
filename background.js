const Logger = {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.info(...args)
};

// ---------------------------------------------------------------------------
// Localization
// Strings are resolved through browser.i18n (see _locales/) with English
// fallbacks, so unit tests and unusual environments never produce "undefined".
// ---------------------------------------------------------------------------
const I18N_FALLBACKS = {
    bannerScanOnce: 'Scan this message once',
    bannerScanSender: 'Always scan this sender',
    bannerTitleOptIn: 'Thundy AV: real-time scanning is not enabled for this message.',
    bannerNoteOptIn: 'Scanning transmits data to external analysis services, but only if you enabled it in the add-on settings and only after you gave your consent. See the add-on options.',
    bannerScanRunning: 'Scanning…',
    bannerScanDone: 'Scan finished',
    bannerScanFailed: 'Scan failed',
    bannerPermissionDenied: 'Required host permission was denied',
    bannerPermissionDeniedHint: 'The host permission for the analysis service is missing. Please grant it in the add-on options.',
    bannerConsentMissing: 'External analysis is disabled in the options – nothing was transmitted.',
    bannerThreatTitle: 'Thundy AV warning',
    bannerThreatScore: 'Risk score: $SCORE$ of 100',
    bannerAuthPass: 'Sender verified (SPF/DKIM/DMARC passed)',
    bannerAuthFail: 'Sender authentication failed (SPF/DKIM/DMARC)',
    bannerOpenOptions: 'Open options',
    bannerSenderOptIn: 'This sender is now scanned automatically.',
    errorHostPermissionMissing: 'Host permission for the analysis service is missing. Please grant it in the add-on options.',
    errorTierUploadBlocked: 'Uploading attachments is disabled in the privacy tier "Strict". Switch to "Balanced" or "Maximum" in the add-on options.',
    errorTierUrlScanBlocked: 'Submitting URLs is only allowed in the privacy tier "Maximum". Change the tier in the add-on options.',
    notificationInjectionFailed: 'The banner could not be inserted into the message view. Please report this with your Thunderbird version.',
    bannerTierBlocked: 'This action is not allowed by the current privacy tier. See the add-on options.',
    notificationScanStarted: 'Scan started for: $URL$',
    notificationScanSubmitted: 'Scan submitted successfully. Job ID: $JOBID$',
    notificationScanError: 'Scan error: $ERROR$',
    notificationTitle: 'Thundy AV Scanner',
    notificationTitleError: 'Thundy AV Scanner error',
    notificationNoLinks: 'No links found in this message.',
    // --- 1.7: threat level indicator, link gate, admin report ---
    bannerLevelClean: 'Harmless',
    bannerLevelLow: 'Low risk',
    bannerLevelMedium: 'Noticeable',
    bannerLevelHigh: 'High risk',
    bannerLevelCritical: 'Critical',
    bannerLevelUnknown: 'Not evaluated',
    bannerLevelTitle: 'Thundy AV assessment: $LEVEL$ (risk score $SCORE$ of 100)',
    bannerLevelScoreShort: 'Score $SCORE$',
    bannerLinksTitle: 'Links in this message',
    bannerLinksNone: 'No links found',
    bannerAttachmentsTitle: 'Attachments',
    bannerAuthTitle: 'Sender authentication',
    bannerAuthNone: 'No SPF/DKIM/DMARC result in the headers',
    bannerFirstContact: 'First contact with this sender',
    bannerReplyToMismatch: 'Reply-To points to a different domain',
    bannerDetailsToggle: 'Show details',
    bannerDetailsHide: 'Hide details',
    bannerReportAdmin: 'Report to administrator',
    bannerGateNote: 'Links in this message are only handed to the browser after a check.',
    gateChecking: 'Thundy AV is checking this link …',
    gateBlocked: 'Link blocked: the check found a high risk.',
    gateWarning: 'Link checked: noticeable – verify target and sender.',
    gateAllowed: 'Link checked: nothing suspicious found.',
    gateUnknown: 'Link checked: no external source available, local assessment only.',
    gateOpenAnyway: 'Open anyway',
    gateCancel: 'Cancel',
    gateDetails: 'Show details',
    gateReportAdmin: 'Report to administrator',
    gateConfirmOverride: 'You are about to open a link that was rated as risky. This decision is written to the Thundy AV audit log. Continue?',
    gateHost: 'Target host',
    gateReasonTitle: 'Reasons',
    gateReportSent: 'Report to the administrator has been prepared.',
    gateReportFailed: 'The report could not be created (no administrator contact configured?).',
    gateLoading: 'Link check is not available in this message view.',
    notificationGateBlocked: 'Blocked a risky link: $URL$',
    notificationReportStarted: 'Report for $URL$ prepared for the administrator.',
    notificationReportNoContact: 'No administrator contact configured. Please add it in the add-on options.',
    notificationReportComposeFailed: 'The compose window could not be opened. The report text is available in the add-on options.',
    notificationGateActive: 'Link gate: links in this message are checked before opening.',
    actionTitleLevel: 'Thundy AV: $LEVEL$ ($SCORE$ of 100)'
};

function msg(key, subs) {
    try {
        if (typeof browser !== 'undefined' && browser.i18n && typeof browser.i18n.getMessage === 'function') {
            const value = browser.i18n.getMessage(key, subs);
            if (value) return value;
        }
    } catch (e) { /* fall through to the fallback string */ }
    let text = I18N_FALLBACKS[key] || key;
    const values = Array.isArray(subs) ? subs.slice() : (subs === undefined ? [] : [subs]);
    text = text.replace(/\$(SCORE|LEVEL|URL|JOBID|ERROR)\$/g, () => (values.length ? String(values.shift()) : ''));
    return text;
}

function iconUrl() {
    try {
        if (typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.getURL === 'function') {
            return browser.runtime.getURL('img/icon-64px.png');
        }
    } catch (e) { /* ignore */ }
    return 'img/icon-64px.png';
}

/**
 * Notifications are shown by the operating system (and may appear on a lock
 * screen), so they must not contain the full URL with its query parameters
 * (tracking IDs, tokens). The host is enough to tell the user what was scanned.
 */
function describeUrlForUser(url) {
    try {
        return new URL(url).hostname || String(url);
    } catch (e) {
        return String(url);
    }
}

// ---------------------------------------------------------------------------
// External analysis consent
// Thunderbird has no built-in data collection consent prompt, therefore the
// add-on asks for consent explicitly (options page) and enforces it here:
// without consent nothing is sent to any third party service.
// ---------------------------------------------------------------------------
const EXTERNAL_ANALYSIS_DISABLED = 'EXTERNAL_ANALYSIS_DISABLED';
const HOST_PERMISSION_MISSING = 'HOST_PERMISSION_MISSING';
const TIER_BLOCKS_UPLOAD = 'TIER_BLOCKS_UPLOAD';
const TIER_REQUIRES_MAX = 'TIER_REQUIRES_MAX';

function typedError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function mayTransmitExternally() {
    return externalAnalysisConsent === true;
}

function assertExternalAnalysisAllowed() {
    if (!mayTransmitExternally()) {
        const error = new Error(msg('bannerConsentMissing'));
        error.code = EXTERNAL_ANALYSIS_DISABLED;
        throw error;
    }
}

// Privacy tiers are ordered: strict < balanced < max. The tier limits what may
// leave the machine, and it applies to the automatic scans as well as to the
// manual actions in the popup/context menu (see docs/privacy_policy.md §3.3).
const TIER_ORDER = { strict: 0, balanced: 1, max: 2 };

function tierAtLeast(minimumTier) {
    const current = TIER_ORDER[privacyTier] === undefined ? 0 : TIER_ORDER[privacyTier];
    const required = TIER_ORDER[minimumTier] === undefined ? 0 : TIER_ORDER[minimumTier];
    return current >= required;
}

/**
 * Every provider request must be covered by a host permission the user granted
 * when saving that provider's key (options.js). Without it the request would fail
 * with an opaque network error, so we raise a typed error that the UI can explain.
 */
async function requireHostPermission(url) {
    if (await hasHostPermissionFor(url)) return;
    throw typedError(HOST_PERMISSION_MISSING, msg('errorHostPermissionMissing'));
}

// Host origins that are declared in manifest.json -> optional_host_permissions
const PROVIDER_ORIGINS = {
    hybridanalysis: 'https://hybrid-analysis.com/*',
    virustotal: 'https://www.virustotal.com/*',
    urlscan: 'https://urlscan.io/*',
    urlhaus: 'https://urlhaus-api.abuse.ch/*',
    abuseipdb: 'https://api.abuseipdb.com/*'
};

function originForUrl(url) {
    try {
        const host = new URL(url).hostname;
        if (host === 'hybrid-analysis.com' || host.endsWith('.hybrid-analysis.com')) return PROVIDER_ORIGINS.hybridanalysis;
        if (host === 'virustotal.com' || host.endsWith('.virustotal.com')) return PROVIDER_ORIGINS.virustotal;
        if (host === 'urlscan.io' || host.endsWith('.urlscan.io')) return PROVIDER_ORIGINS.urlscan;
        if (host === 'urlhaus-api.abuse.ch') return PROVIDER_ORIGINS.urlhaus;
        if (host === 'api.abuseipdb.com') return PROVIDER_ORIGINS.abuseipdb;
    } catch (e) { /* invalid URL */ }
    return null;
}

async function hasHostPermissionFor(url) {
    const origin = originForUrl(url);
    if (!origin) return false;
    try {
        return await browser.permissions.contains({ origins: [origin] });
    } catch (e) {
        Logger.error('permissions.contains failed', e);
        return false;
    }
}

/**
 * Injects a function into the message display document of a tab.
 *
 * `browser.scripting.executeScript({ target: { tabId } })` is the documented way
 * to reach an already displayed message: Thunderbird's own browser test
 * `browser_ext_messageDisplayScripts_mv3.js` uses exactly this call for `mail`
 * tabs and requires the `messagesRead` host permission, which this add-on
 * declares. `scripting.messageDisplay` only offers register/unregister (no
 * executeScript), so a "preferred" branch for it would be dead code (P1-9).
 *
 * Failures are reported to the user once per session: silently missing banners
 * were one of the store-readiness findings (P1-9/AUD-09).
 */
let injectionFailureReported = false;

async function injectIntoMessageDisplay(tabId, func, args = []) {
    if (tabId === undefined || tabId === null) return null;
    const injection = { target: { tabId }, func, args };
    try {
        return await browser.scripting.executeScript(injection);
    } catch (e) {
        Logger.warn('Injecting into the message display failed (please report with your Thunderbird version):', e);
        if (!injectionFailureReported) {
            injectionFailureReported = true;
            notify('notificationTitleError', 'notificationInjectionFailed');
        }
        return null;
    }
}

let customBlacklist = new Set();
let customWhitelist = new Set();
let authStatus = null;
let apikey_hybridanalysis;
let urlhausApikey = "";
let urlscanApikey = "";
let apikey_virustotal;
let privacyTier = "strict";
let alwaysManual = false;
let autoScanLinks = false;
let timeOfClickProtection = true;
let ipReputationProvider = "none";
let ipReputationApiKey = "";
let externalAnalysisConsent = false;

// --- 1.7: link gate, threat indicator and administrator contacts -----------
// The link gate blocks the hand-off of an http(s) link to the default browser
// until the link has been assessed (finding F-1). `linkGateMode` is the policy
// (strict/balanced/off), `adminEmails`/`adminPhone` feed the incident report.
let linkGateEnabled = true;
let linkGateMode = "strict";
let adminEmails = [];
let adminPhone = "";
let adminContactName = "";
let adminOrganization = "";
let reportIncludeUrls = true;

const LINK_GATE_AUDIT_LIMIT = 100;
const LINK_GATE_LIVE_SCAN_BUDGET_MS = 6000;
const THREAT_LEVELS = ['clean', 'low', 'medium', 'high', 'critical'];

// The detection engine lives in link_gate.js (loaded before this file in the
// manifest). It is feature-detected so that a partially loaded package (or a
// unit test that only loads background.js) degrades instead of crashing.
function gateEngine() {
    return (typeof ThundyLinkGate !== 'undefined' && ThundyLinkGate) ? ThundyLinkGate : null;
}

function levelFromScore(score) {
    const engine = gateEngine();
    if (engine && typeof engine.levelFromScore === 'function') {
        return engine.levelFromScore(score);
    }
    const value = Number(score) || 0;
    if (value >= 80) return 'critical';
    if (value >= 60) return 'high';
    if (value >= 40) return 'medium';
    if (value >= 15) return 'low';
    return 'clean';
}

function levelStyle(level) {
    const engine = gateEngine();
    if (engine && typeof engine.levelStyle === 'function') {
        try {
            const style = engine.levelStyle(level);
            if (style) return style;
        } catch (e) { /* fall through to the local table */ }
    }
    const styles = {
        clean: { color: '#145c14', background: '#e6ffe6', border: '#2e8b2e', icon: '🟢', labelKey: 'bannerLevelClean', labelFallback: 'Harmless' },
        low: { color: '#4d6b00', background: '#f6ffe6', border: '#8ebe2d', icon: '🟢', labelKey: 'bannerLevelLow', labelFallback: 'Low risk' },
        medium: { color: '#7a5200', background: '#fff6e6', border: '#f0a500', icon: '🟡', labelKey: 'bannerLevelMedium', labelFallback: 'Noticeable' },
        high: { color: '#8a3400', background: '#fff0e6', border: '#e8620c', icon: '🟠', labelKey: 'bannerLevelHigh', labelFallback: 'High risk' },
        critical: { color: '#8a1010', background: '#ffeeee', border: '#c81e1e', icon: '🔴', labelKey: 'bannerLevelCritical', labelFallback: 'Critical' },
        unknown: { color: '#333333', background: '#f2f2f2', border: '#999999', icon: '⚪', labelKey: 'bannerLevelUnknown', labelFallback: 'Not evaluated' }
    };
    return styles[level] || styles.unknown;
}

function levelLabel(level) {
    const style = levelStyle(level);
    return msg(style.labelKey, []) || style.labelFallback;
}

let sharedDBPromise = null;

function getSharedDB() {
    if (!sharedDBPromise) {
        sharedDBPromise = openDB("thunderbird_av", 3);
    }
    return sharedDBPromise;
}

const knownSendersCache = new Set();
const MAX_KNOWN_SENDERS = 1000;

const urlhausCache = new Map();
const MAX_URLHAUS_CACHE_SIZE = 1000;

const ipReputationCache = new Map();
const MAX_IP_CACHE = 1000;

const vtCache = new Map();
const MAX_VT_CACHE_SIZE = 1000;

function getHybridAnalysisOptions(method, body = null, isUrl = false) {
    if (!apikey_hybridanalysis) throw new Error("API-Key fehlt.");
    const options = {
        method: method,
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
            'user-agent': 'Falcon'
        }
    };
    if (body) {
        options.body = body;
        options.headers['scan_type'] = 'all';
    }
    if (isUrl) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    return options;
}

// Precompiled Regexes for Performance
const GLOBAL_IPV4_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

const URGENCY_WORDS = ['überweisung', 'schnell', 'ceo', 'dringend', 'sofort', 'wichtig', 'payment', 'urgent', 'rechnung', 'fällig', 'passwort', 'konto', 'transfer', 'bank'];
const URGENCY_REGEX = new RegExp('(^|[^a-z0-9_äöüß])(' + URGENCY_WORDS.join('|') + ')(?![a-z0-9_äöüß])', 'g');


// Einstellungen laden
async function loadSettings() {
  try {
    const result = await browser.storage.local.get(['apikey', 'virustotalApikey', 'privacyTier', 'urlhausApikey', 'urlscanApikey', 'alwaysManual', 'autoScanLinks', 'timeOfClickProtection', 'ipReputationProvider', 'ipReputationApiKey', 'customBlacklist', 'customWhitelist', 'externalAnalysisConsent', 'linkGateEnabled', 'linkGateMode', 'adminEmails', 'adminPhone', 'adminContactName', 'adminOrganization', 'reportIncludeUrls']);
    if (result.virustotalApikey !== undefined) {
      apikey_virustotal = result.virustotalApikey;
    }
    if (result.privacyTier !== undefined) {
      privacyTier = result.privacyTier;
    }
    apikey_hybridanalysis = result.apikey;
    if (result.externalAnalysisConsent !== undefined) {
      externalAnalysisConsent = result.externalAnalysisConsent === true;
    }
    if (result.customBlacklist !== undefined) {
      customBlacklist = new Set(result.customBlacklist.map(s => s ? s.toLowerCase() : ""));
    }
    if (result.customWhitelist !== undefined) {
      customWhitelist = new Set(result.customWhitelist.map(s => s ? s.toLowerCase() : ""));
    }
    if (result.urlhausApikey !== undefined) {
      urlhausApikey = result.urlhausApikey;
    }
    if (result.urlscanApikey !== undefined) {
      urlscanApikey = result.urlscanApikey;
    }
    if (result.alwaysManual !== undefined) {
      alwaysManual = result.alwaysManual;
    }
    if (result.autoScanLinks !== undefined) {
      autoScanLinks = result.autoScanLinks;
    }
    if (result.timeOfClickProtection !== undefined) {
      timeOfClickProtection = result.timeOfClickProtection;
    }
    if (result.ipReputationProvider !== undefined) {
      ipReputationProvider = result.ipReputationProvider;
    }
    if (result.ipReputationApiKey !== undefined) {
      ipReputationApiKey = result.ipReputationApiKey;
    }
    if (result.linkGateEnabled !== undefined) {
      linkGateEnabled = result.linkGateEnabled !== false;
    }
    if (result.linkGateMode !== undefined) {
      linkGateMode = ['strict', 'balanced', 'off'].includes(result.linkGateMode) ? result.linkGateMode : 'strict';
    }
    if (Array.isArray(result.adminEmails)) {
      adminEmails = result.adminEmails.filter((entry) => typeof entry === 'string' && entry.length > 0);
    } else if (typeof result.adminEmails === 'string') {
      adminEmails = result.adminEmails.split(';').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    }
    if (typeof result.adminPhone === 'string') {
      adminPhone = result.adminPhone;
    }
    if (typeof result.adminContactName === 'string') {
      adminContactName = result.adminContactName;
    }
    if (typeof result.adminOrganization === 'string') {
      adminOrganization = result.adminOrganization;
    }
    if (result.reportIncludeUrls !== undefined) {
      reportIncludeUrls = result.reportIncludeUrls !== false;
    }
  } catch (error) {
    Logger.error("Fehler beim Laden der Einstellungen:", error);
  }
}
loadSettings();

// Opt-In helpers
async function hasHybridPermission() {
  return await hasHostPermissionFor('https://hybrid-analysis.com/api/v2/overview/');
}

async function addSenderOptIn(senderEmail) {
  try {
    const res = await browser.storage.local.get('scanningEnabledSenders');
    const arr = res.scanningEnabledSenders || [];
    if (!arr.includes(senderEmail)) {
      arr.push(senderEmail);
      await browser.storage.local.set({ scanningEnabledSenders: arr });
    }
  } catch (e) { Logger.error('addSenderOptIn failed', e); }
}


// Listener für Änderungen an den Einstellungen (API Key)
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.apikey) {
    apikey_hybridanalysis = changes.apikey.newValue;
  }
  if (area === 'local' && changes.virustotalApikey !== undefined) {
    apikey_virustotal = changes.virustotalApikey.newValue;
  }
  if (area === 'local' && changes.privacyTier !== undefined) {
    privacyTier = changes.privacyTier.newValue;
  }
  if (area === 'local' && changes.urlhausApikey !== undefined) {
    urlhausApikey = changes.urlhausApikey.newValue;
  }
  if (area === 'local' && changes.urlscanApikey !== undefined) {
    urlscanApikey = changes.urlscanApikey.newValue;
  }
  if (area === 'local' && changes.alwaysManual !== undefined) {
    alwaysManual = changes.alwaysManual.newValue;
  }
  if (area === 'local' && changes.autoScanLinks !== undefined) {
    autoScanLinks = changes.autoScanLinks.newValue;
  }
  if (area === 'local' && changes.timeOfClickProtection !== undefined) {
    timeOfClickProtection = changes.timeOfClickProtection.newValue;
  }
  if (area === 'local' && changes.customBlacklist !== undefined) {
    customBlacklist = new Set((changes.customBlacklist.newValue || []).map(s => s ? s.toLowerCase() : ""));
  }
  if (area === 'local' && changes.customWhitelist !== undefined) {
    customWhitelist = new Set((changes.customWhitelist.newValue || []).map(s => s ? s.toLowerCase() : ""));
  }
  if (area === 'local' && changes.externalAnalysisConsent !== undefined) {
    externalAnalysisConsent = changes.externalAnalysisConsent.newValue === true;
  }
  if (area === 'local' && changes.linkGateEnabled !== undefined) {
    linkGateEnabled = changes.linkGateEnabled.newValue !== false;
  }
  if (area === 'local' && changes.linkGateMode !== undefined) {
    linkGateMode = ['strict', 'balanced', 'off'].includes(changes.linkGateMode.newValue) ? changes.linkGateMode.newValue : 'strict';
  }
  if (area === 'local' && changes.adminEmails !== undefined) {
    adminEmails = Array.isArray(changes.adminEmails.newValue) ? changes.adminEmails.newValue.filter((e) => typeof e === 'string' && e.length > 0) : [];
  }
  if (area === 'local' && changes.adminPhone !== undefined) {
    adminPhone = typeof changes.adminPhone.newValue === 'string' ? changes.adminPhone.newValue : '';
  }
  if (area === 'local' && changes.adminContactName !== undefined) {
    adminContactName = typeof changes.adminContactName.newValue === 'string' ? changes.adminContactName.newValue : '';
  }
  if (area === 'local' && changes.adminOrganization !== undefined) {
    adminOrganization = typeof changes.adminOrganization.newValue === 'string' ? changes.adminOrganization.newValue : '';
  }
  if (area === 'local' && changes.reportIncludeUrls !== undefined) {
    reportIncludeUrls = changes.reportIncludeUrls.newValue !== false;
  }
});

function extractPublicIPs(receivedHeaders) {
    if (!receivedHeaders) return [];
    let ips = [];
    let ipsSet = new Set();

    // ⚡ Bolt Optimization: Use a traditional for loop instead of for-of for better iteration performance
    for (let i = 0, len = receivedHeaders.length; i < len; i++) {
        const header = receivedHeaders[i];
        let matches = header.match(GLOBAL_IPV4_REGEX);
        if (matches) {
            for (let j = 0, mlen = matches.length; j < mlen; j++) {
                const ip = matches[j];

                // ⚡ Bolt Optimization: Fast path out common loopbacks early before any parsing
                if (ip === "127.0.0.1" || ip === "0.0.0.0") continue;

                // ⚡ Bolt Optimization: parseInt ignores trailing non-digits (like '.'), avoiding the need to allocate a substring for the first block
                const part1 = parseInt(ip, 10);

                if (part1 === 10 || part1 === 127 || part1 === 0) {
                    continue;
                }

                // ⚡ Bolt Optimization: Use indexOf and substring instead of split to avoid allocating intermediate arrays for string parts
                const dot1 = ip.indexOf('.');
                const dot2 = ip.indexOf('.', dot1 + 1);
                const part2 = parseInt(ip.substring(dot1 + 1, dot2), 10);

                if (
                    (part1 === 192 && part2 === 168) ||
                    (part1 === 172 && part2 >= 16 && part2 <= 31) ||
                    (part1 === 169 && part2 === 254)
                ) {
                    continue;
                }
                if (!ipsSet.has(ip)) {
                    ipsSet.add(ip);
                    ips.push(ip);
                }
            }
        }
    }
    return ips;
}

async function checkAbuseIPDB(ip, apikey) {
    if (!mayTransmitExternally()) return false;
    await requireHostPermission('https://api.abuseipdb.com/api/v2/check');
    try {
        const response = await apiGateway.fetchWithTimeout(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
            method: 'GET',
            headers: {
                'Key': apikey,
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        if (data && data.data && data.data.abuseConfidenceScore > 50) {
            return true;
        }
    } catch (e) {
        Logger.error("Fehler bei AbuseIPDB Abfrage", e);
    }
    return false;
}

async function checkVirusTotalIP(ip, apikey) {
    if (!mayTransmitExternally()) return false;
    await requireHostPermission('https://www.virustotal.com/api/v3/ip_addresses/' + ip);
    try {
        const response = await apiGateway.fetchWithTimeout(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
            method: 'GET',
            headers: {
                'x-apikey': apikey,
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        if (data && data.data && data.data.attributes && data.data.attributes.last_analysis_stats) {
            if (data.data.attributes.last_analysis_stats.malicious > 0) {
                return true;
            }
        }
    } catch (e) {
        Logger.error("Fehler bei VirusTotal IP Abfrage", e);
    }
    return false;
}

let lev_prevRow = new Uint16Array(64);
let lev_currRow = new Uint16Array(64);

function levenshteinDistance(a, b) {
    // ⚡ Bolt Optimization: Fast-path for identical strings early
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    if (a.length > b.length) {
        let tmp = a; a = b; b = tmp;
    }

    // ⚡ Bolt Optimization: Cached string lengths and hoisted charCodeAt evaluation for the outer loop to eliminate repeated property lookups in the hot nested loop.
    const aLen = a.length;
    const bLen = b.length;

    if (aLen + 1 > lev_prevRow.length) {
        lev_prevRow = new Uint16Array(aLen + 1);
        lev_currRow = new Uint16Array(aLen + 1);
    }

    let prevRow = lev_prevRow;
    let currRow = lev_currRow;

    for (let j = 0; j <= aLen; j++) prevRow[j] = j;

    for (let i = 1; i <= bLen; i++) {
        currRow[0] = i;
        const bChar = b.charCodeAt(i - 1);
        for (let j = 1; j <= aLen; j++) {
            if (bChar === a.charCodeAt(j - 1)) {
                currRow[j] = prevRow[j - 1];
            } else {
                // ⚡ Bolt Optimization: Use manual comparison instead of Math.min to avoid function call overhead
                let sub = prevRow[j - 1];
                let del = prevRow[j];
                let ins = currRow[j - 1];
                let min = sub < del ? sub : del;
                if (ins < min) min = ins;

                currRow[j] = 1 + min;
            }
        }
        // Swap arrays to avoid allocating a new one next iteration
        let tmp = prevRow; prevRow = currRow; currRow = tmp;
    }
    return prevRow[aLen];
}

const KNOWN_BRANDS = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];
const KNOWN_BRANDS_SET = new Set(KNOWN_BRANDS);
const KNOWN_BRANDS_REGEX = new RegExp(`(?:^|\\.)(${KNOWN_BRANDS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')).join('|')})$`, 'i');

function checkLists(email, senderDomain) {
    if (email) email = email.toLowerCase();
    if (senderDomain) senderDomain = senderDomain.toLowerCase();

    // Check Blacklist
    if (typeof customBlacklist !== 'undefined' && customBlacklist && customBlacklist.size > 0) {
        if (customBlacklist.has(email)) {
            return { score: 100, reasons: [`Absender-E-Mail (${email}) steht auf der Blacklist.`], listType: 'blacklist' };
        }
        // ⚡ Bolt Optimization: Replace O(n) array iteration with O(1) set lookups for domain checking
        if (customBlacklist.has(senderDomain)) {
            return { score: 100, reasons: [`Absender-Domain (${senderDomain}) steht auf der Blacklist (${senderDomain}).`], listType: 'blacklist' };
        }
        let dotIdx = senderDomain.indexOf('.');
        while (dotIdx !== -1) {
            let parentDomain = senderDomain.substring(dotIdx + 1);
            if (customBlacklist.has(parentDomain)) {
                return { score: 100, reasons: [`Absender-Domain (${senderDomain}) steht auf der Blacklist (${parentDomain}).`], listType: 'blacklist' };
            }
            dotIdx = senderDomain.indexOf('.', dotIdx + 1);
        }
    }

    // Check Whitelist
    if (typeof customWhitelist !== 'undefined' && customWhitelist && customWhitelist.size > 0) {
        if (customWhitelist.has(email)) {
            return { score: 0, reasons: [`Absender-E-Mail (${email}) steht auf der Whitelist.`], listType: 'whitelist' };
        }
        // ⚡ Bolt Optimization: Replace O(n) array iteration with O(1) set lookups for domain checking
        if (customWhitelist.has(senderDomain)) {
            return { score: 0, reasons: [`Absender-Domain (${senderDomain}) steht auf der Whitelist (${senderDomain}).`], listType: 'whitelist' };
        }
        let dotIdx = senderDomain.indexOf('.');
        while (dotIdx !== -1) {
            let parentDomain = senderDomain.substring(dotIdx + 1);
            if (customWhitelist.has(parentDomain)) {
                return { score: 0, reasons: [`Absender-Domain (${senderDomain}) steht auf der Whitelist (${parentDomain}).`], listType: 'whitelist' };
            }
            dotIdx = senderDomain.indexOf('.', dotIdx + 1);
        }
    }
    return null;
}

function evaluateAuthHeaders(authHeaders, score, reasons) {
    let authStatus = 'neutral';
    if (authHeaders && authHeaders.length > 0) {
        const headerStr = authHeaders.join(' ').toLowerCase();
        let fail = false;

        if (headerStr.includes("spf=fail") || headerStr.includes("spf=softfail")) {
            score += 50;
            reasons.push("SPF-Prüfung fehlgeschlagen (Mögliches Spoofing).");
            fail = true;
        }
        if (headerStr.includes("dkim=fail")) {
            score += 50;
            reasons.push("DKIM-Signatur ungültig (Mögliches Spoofing).");
            fail = true;
        }
        if (headerStr.includes("dmarc=fail")) {
            score += 50;
            reasons.push("DMARC-Prüfung fehlgeschlagen (Mögliches Spoofing).");
            fail = true;
        }

        if (fail) {
            authStatus = 'fail';
        } else if (headerStr.includes("spf=pass") && headerStr.includes("dkim=pass") && headerStr.includes("dmarc=pass")) {
            authStatus = 'pass';
        }
    }
    return { score, authStatus };
}

function evaluateUrlhaus(urlhausDomains, score, reasons) {
    if (urlhausDomains && urlhausDomains.length > 0) {
        for (let domain of urlhausDomains) {
            score += 80;
            reasons.push(`Domain (${domain}) ist auf URLhaus als bösartig gelistet.`);
        }
    }
    return score;
}

function evaluateReplyTo(replyTo, senderDomain, score, reasons) {
    if (replyTo && senderDomain) {
        let replyToEmail = extractEmailAddress(replyTo);
        const replyDomain = extractEmailDomain(replyToEmail);

        if (replyDomain && replyDomain !== senderDomain) {
            score += 50;
            reasons.push(`Diskrepanz erkannt: "Reply-To" Domain (${replyDomain}) weicht von der Absender-Domain (${senderDomain}) ab.`);
        }
    }
    return score;
}

function evaluateBehavior(subject, messageText, isFirstCommunication, score, reasons) {
    let textToAnalyze = (subject + " " + messageText).toLowerCase();
    let foundUrgencyWords = [];

    let match;
    URGENCY_REGEX.lastIndex = 0;
    while ((match = URGENCY_REGEX.exec(textToAnalyze)) !== null) {
        if (foundUrgencyWords.indexOf(match[2]) === -1) {
            foundUrgencyWords.push(match[2]);
        }
    }

    if (foundUrgencyWords.length > 0) {
        if (isFirstCommunication) {
            score += 50;
            reasons.push(`Mögliches BEC (Business Email Compromise): Erste Kommunikation mit diesem Absender und Dringlichkeits-Signalwörter gefunden (${foundUrgencyWords.join(', ')}).`);
        } else {
            score += 20;
            reasons.push(`Dringlichkeits-Signalwörter gefunden (${foundUrgencyWords.join(', ')}). Bitte prüfen Sie die Anfrage sorgfältig.`);
        }
    } else if (isFirstCommunication) {
        score += 10;
        reasons.push("Dies ist das erste Mal, dass Sie mit diesem Absender kommunizieren.");
    }
    return score;
}

function getMainDomain(domain) {
    const match = domain.match(KNOWN_BRANDS_REGEX);
    if (match) {
        return match[1].toLowerCase();
    }

    const lastDot = domain.lastIndexOf('.');
    if (lastDot !== -1) {
        const secondLastDot = domain.lastIndexOf('.', lastDot - 1);
        if (secondLastDot !== -1) {
            return domain.substring(secondLastDot + 1);
        }
    }
    return domain;
}

function evaluateSenderDomain(senderDomain, score, reasons) {
    let senderMainDomain = "";
    if (senderDomain) {
        senderMainDomain = getMainDomain(senderDomain);
        let isSenderKnownBrand = KNOWN_BRANDS_SET.has(senderMainDomain);

        if (!isSenderKnownBrand) {
            for (let brand of KNOWN_BRANDS) {
                if (senderMainDomain.length < 4 || Math.abs(senderMainDomain.length - brand.length) > 2) continue;

                let distance = levenshteinDistance(senderMainDomain, brand);
                if (distance > 0 && distance <= 2) {
                    score += 60;
                    reasons.push(`Absender-Domain (${senderMainDomain}) ähnelt verdächtig der bekannten Marke ${brand}.`);
                    break;
                }
            }
        }
    }
    return { score, senderMainDomain };
}

function getHostnameOptimized(url, cache = null) {
    if (cache) {
        let cached = cache.get(url);
        if (cached !== undefined) return cached;
    }
    try {
        let hostname = new URL(url).hostname;
        if (cache) cache.set(url, hostname);
        return hostname;
    } catch (e) {
        if (cache) cache.set(url, null);
        return null;
    }
}

function checkTyposquattingLink(linkMainDomain, checkedMainDomains, reasons, reasonsDomainsSet) {
    // ⚡ Bolt Optimization: Fast-path for exact brand matches early
    if (KNOWN_BRANDS_SET.has(linkMainDomain)) {
        return false;
    }

    let cachedBrandMatch = checkedMainDomains.get(linkMainDomain);
    if (cachedBrandMatch !== undefined) {
        if (cachedBrandMatch !== null) {
            if (!reasonsDomainsSet.has(linkMainDomain)) {
                reasons.push(`Link-Domain (${linkMainDomain}) ähnelt verdächtig der bekannten Marke ${cachedBrandMatch}.`);
                reasonsDomainsSet.add(linkMainDomain);
            }
            return true;
        }
        return false;
    }

    for (let brand of KNOWN_BRANDS) {
        if (linkMainDomain.length < 4 || Math.abs(linkMainDomain.length - brand.length) > 2) continue;

        let distance = levenshteinDistance(linkMainDomain, brand);
        if (distance > 0 && distance <= 2) {
            checkedMainDomains.set(linkMainDomain, brand);
            if (!reasonsDomainsSet.has(linkMainDomain)) {
                reasons.push(`Link-Domain (${linkMainDomain}) ähnelt verdächtig der bekannten Marke ${brand}.`);
                reasonsDomainsSet.add(linkMainDomain);
            }
            return true;
        }
    }

    checkedMainDomains.set(linkMainDomain, null);
    return false;
}

function evaluateLinks(options = {}) {
    let {
        urls = [],
        senderDomain = '',
        senderMainDomain = '',
        score = 0,
        reasons = [],
        parsedUrlCache = null
    } = options;
    let linkDomainsSet = new Set();
    // ⚡ Bolt Optimization: Use indexed loop and inline cache check to reduce function call overhead
    for (let i = 0; i < urls.length; i++) {
        try {
            let url = urls[i];
            let hostname;
            if (parsedUrlCache) {
                hostname = parsedUrlCache.get(url);
                if (hostname === undefined) {
                    hostname = getHostnameOptimized(url, parsedUrlCache);
                }
            } else {
                hostname = getHostnameOptimized(url, parsedUrlCache);
            }
            if (hostname) linkDomainsSet.add(hostname);
        } catch (e) { /* Ignore invalid URLs */ }
    }
    if (linkDomainsSet.size > 0 && senderDomain) {
        let matchFound = false;
        let typosquatLinkFound = false;
        let checkedMainDomains = new Map();
        let reasonsDomainsSet = new Set();

        // ⚡ Bolt Optimization: Iterate directly over the Set to avoid Array.from() allocation overhead
        const dotSenderDomain = '.' + senderDomain;
        const dotSenderMainDomain = senderMainDomain ? '.' + senderMainDomain : '';
        for (let ld of linkDomainsSet) {
            if (!matchFound) {
                if (ld === senderDomain || ld.endsWith(dotSenderDomain) || senderDomain.endsWith('.' + ld)) {
                    matchFound = true;
                } else if (senderMainDomain && (ld === senderMainDomain || ld.endsWith(dotSenderMainDomain))) {
                     matchFound = true;
                }
            }

            let linkMainDomain = getMainDomain(ld);
            let isLinkKnownBrand = KNOWN_BRANDS_SET.has(linkMainDomain);

            if (!isLinkKnownBrand) {
                if (checkTyposquattingLink(linkMainDomain, checkedMainDomains, reasons, reasonsDomainsSet)) {
                    typosquatLinkFound = true;
                }
            }
        }

        if (!matchFound) {
            score += 40;
            if (!reasons.some(r => r.includes('Keiner der Links'))) {
                 reasons.push(`Keiner der Links im Text verweist auf die Absender-Domain (${senderDomain}).`);
            }
        }
        if (typosquatLinkFound) {
            score += 60;
        }
    }
    return score;
}

function extractEmailAddress(rawAuthor) {
    let email = rawAuthor;
    // ⚡ Bolt Optimization: Use indexOf and substring to avoid regex allocation overhead
    // 🛡️ Sentinel: Use lastIndexOf to prevent email spoofing via decoy display names
    const start = rawAuthor.lastIndexOf('<');
    if (start !== -1) {
        const end = rawAuthor.indexOf('>', start + 1);
        if (end !== -1) {
            email = rawAuthor.substring(start + 1, end);
        }
    }
    return email.toLowerCase();
}

function extractEmailDomain(emailAddress) {
    // ⚡ Bolt Optimization: Use indexOf and substring instead of split for O(n) extraction without array allocation
    const atIndex = emailAddress.indexOf('@');
    return atIndex !== -1 ? emailAddress.substring(atIndex + 1).toLowerCase() : "";
}

function calculateThreatScore(author, urls, options = {}) {
    const {
        authHeaders = [],
        urlhausDomains = [],
        isFirstCommunication = false,
        messageText = "",
        subject = "",
        replyTo = "",
        parsedUrlCache = null
    } = options;
    let score = 0;
    let reasons = [];

    let email = extractEmailAddress(author);
    let senderDomain = extractEmailDomain(email);

    const listCheck = checkLists(email, senderDomain);
    if (listCheck) {
        return { score: listCheck.score, reasons: listCheck.reasons, authStatus: 'neutral' };
    }

    const authEval = evaluateAuthHeaders(authHeaders, score, reasons);
    score = authEval.score;
    let authStatus = authEval.authStatus;

    score = evaluateUrlhaus(urlhausDomains, score, reasons);
    score = evaluateReplyTo(replyTo, senderDomain, score, reasons);
    score = evaluateBehavior(subject, messageText, isFirstCommunication, score, reasons);

    const senderEval = evaluateSenderDomain(senderDomain, score, reasons);
    score = senderEval.score;
    let senderMainDomain = senderEval.senderMainDomain;

    score = evaluateLinks({
        urls,
        senderDomain,
        senderMainDomain,
        score,
        reasons,
        parsedUrlCache
    });

    return { score: Math.min(score, 100), reasons: reasons, authStatus: authStatus };
}

async function processAndUploadUrls(message, filteredUrls) {
    if (privacyTier === 'max' && mayTransmitExternally()) {
        try {
            await requireHostPermission('https://hybrid-analysis.com/api/v2/quick-scan/url');
        } catch (e) {
            Logger.warn('Skipping URL upload: host permission missing', e);
            return;
        }
        const urlResults = [];
        const concurrencyLimit = 5;
        let i = 0;

        async function worker() {
            while (i < filteredUrls.length) {
                const index = i++;
                const url = filteredUrls[index];

                let result = { url: url, state: 'UNKNOWN' };
                try {
                    const formBody = new URLSearchParams();
                    formBody.append('scan_type', 'all');
                    formBody.append('url', url);

                    const options = getHybridAnalysisOptions('POST', formBody, true);
                    options.url = 'https://hybrid-analysis.com/api/v2/quick-scan/url';
                    const response = await apiGateway.fetchWithTimeout(options.url, options);
                    if (response.status === 200 || response.status === 201) {
                        const json_data = await response.json();
                        result = {
                            url: url,
                            state: 'UPLOADED',
                            hybrid_submission_id: json_data.submission_id,
                            hybrid_job_id: json_data.job_id,
                            hybrid_sha256: json_data.sha256
                        };
                    }
                } catch (e) {
                    Logger.error('Fehler beim automatischen URL-Upload', e);
                }
                urlResults[index] = result;
            }
        }

        const workers = [];
        for (let j = 0; j < Math.min(concurrencyLimit, filteredUrls.length); j++) {
            workers.push(worker());
        }
        await Promise.all(workers);

        await indexedDB_save_links_objects_to_db(message, urlResults);
    } else {
        await indexedDB_save_links_to_db(message, filteredUrls);
    }
}

async function injectTimeOfClickProtection(tabId, filteredUrls) {
    if (timeOfClickProtection && filteredUrls.length > 0) {
        await injectIntoMessageDisplay(tabId, function() {
            // ⚡ Bolt Optimization: Use native CSS attribute selector instead of filtering all 'a' tags in JS
            const links = document.querySelectorAll('a[href^="http"]');
            links.forEach(link => {
                link.title = "Protected by Thundy Time-of-Click";
                link.style.borderBottom = "1px dashed #ff8c00";
            });
        });
    }
}

async function checkIPReputation(receivedHeaders) {
    let maliciousIps = [];
    if (ipReputationProvider !== "none" && ipReputationApiKey) {
        // Without consent or without the host permission nothing is transmitted -
        // and, importantly, nothing is cached either: a cached "not malicious"
        // from the un-consented period would hide results forever (see P2-24 in
        // docs/PROBLEMANALYSE_STORE_READINESS.md).
        if (!mayTransmitExternally()) return maliciousIps;
        const providerOrigin = ipReputationProvider === "abuseipdb"
            ? PROVIDER_ORIGINS.abuseipdb
            : PROVIDER_ORIGINS.virustotal;
        let providerAllowed = false;
        try {
            providerAllowed = await browser.permissions.contains({ origins: [providerOrigin] });
        } catch (e) {
            Logger.error('permissions.contains failed for IP reputation', e);
        }
        if (!providerAllowed) return maliciousIps;

        let publicIps = extractPublicIPs(receivedHeaders);

        let ipChecks = [];

        for (let i = 0; i < publicIps.length; i++) {
            const ip = publicIps[i];
            if (ipReputationCache.has(ip)) {
                const cached = ipReputationCache.get(ip);
                if (cached instanceof Promise) {
                     ipChecks.push(cached.then(isMalicious => ({ ip, isMalicious })));
                } else {
                     if (cached) maliciousIps.push(ip);
                }
                continue;
            }

            let promise = (async () => {
                try {
                    if (ipReputationProvider === "abuseipdb") {
                        return await checkAbuseIPDB(ip, ipReputationApiKey);
                    } else if (ipReputationProvider === "virustotal") {
                        return await checkVirusTotalIP(ip, ipReputationApiKey);
                    }
                } catch(e) { Logger.error(e); }
                // null = "not checked" (error, missing permission, ...) - must not
                // be remembered as a clean result.
                return null;
            })();

            if (ipReputationCache.size >= MAX_IP_CACHE) {
                ipReputationCache.delete(ipReputationCache.keys().next().value);
            }
            ipReputationCache.set(ip, promise);

            ipChecks.push(promise.then(isMalicious => {
                if (isMalicious === null) {
                    ipReputationCache.delete(ip);
                } else {
                    ipReputationCache.set(ip, isMalicious);
                }
                return { ip, isMalicious: isMalicious === true };
            }));
        }

        if (ipChecks.length > 0) {
            let results = await Promise.all(ipChecks);
            for (const result of results) {
                // ⚡ Bolt Optimization: Replace traditional for-loop with for...of to improve readability
                // and allow JS engines to optimize iterator traversal over arrays without repeated index lookups.
                if (result.isMalicious) {
                    maliciousIps.push(result.ip);
                }
            }
        }
    }
    return maliciousIps;
}

async function checkFirstCommunication(senderEmail) {
    let isFirstCommunication = false;
    try {
        if (browser.messages.query) {
            if (knownSendersCache.has(senderEmail)) {
                isFirstCommunication = false;
            } else {
                let previousMsgs = await browser.messages.query({ to: senderEmail });
                if (previousMsgs && previousMsgs.messages && previousMsgs.messages.length === 0) {
                    isFirstCommunication = true;
                } else {
                    if (knownSendersCache.size >= MAX_KNOWN_SENDERS) {
                        knownSendersCache.delete(knownSendersCache.keys().next().value);
                    }
                    knownSendersCache.add(senderEmail);
                }
            }
        }
    } catch (e) {
        Logger.error("Fehler bei messages.query (Möglicherweise nicht unterstützt):", e);
    }
    return isFirstCommunication;
}

async function checkURLhausDomains(filteredUrls, parsedUrlCache = null) {
    let urlhausDomains = [];
    if (urlhausApikey && filteredUrls.length > 0 && mayTransmitExternally()) {
        let linkDomainsSet = new Set();
        // ⚡ Bolt Optimization: Use indexed loop and inline cache check to reduce function call overhead
        for (let i = 0; i < filteredUrls.length; i++) {
            try {
                let url = filteredUrls[i];
                let hostname;
                if (parsedUrlCache) {
                    hostname = parsedUrlCache.get(url);
                    if (hostname === undefined) {
                        hostname = getHostnameOptimized(url, parsedUrlCache);
                    }
                } else {
                    hostname = getHostnameOptimized(url, parsedUrlCache);
                }
                if (hostname) linkDomainsSet.add(hostname);
            } catch (e) { /* Ignore invalid URLs */ }
        }
        const domainChecks = [];

        // ⚡ Bolt Optimization: Iterate directly over the Set to avoid Array.from() allocation overhead
        for (const domain of linkDomainsSet) {

            if (urlhausCache.has(domain)) {
                const cached = urlhausCache.get(domain);
                if (cached instanceof Promise) {
                    domainChecks.push(cached.then(isMal => { if (isMal) urlhausDomains.push(domain); }));
                } else if (cached) {
                    urlhausDomains.push(domain);
                }
                continue;
            }

            let checkPromise = checkURLhaus(domain, urlhausApikey);

            if (urlhausCache.size >= MAX_URLHAUS_CACHE_SIZE) {
                const firstKey = urlhausCache.keys().next().value;
                urlhausCache.delete(firstKey);
            }
            urlhausCache.set(domain, checkPromise);

            domainChecks.push(checkPromise.then(isMalicious => {
                urlhausCache.set(domain, isMalicious);
                if (isMalicious) urlhausDomains.push(domain);
            }));
        }

        if (domainChecks.length > 0) {
            await Promise.all(domainChecks);
        }
    }
    return urlhausDomains;
}

/**
 * Injiziert das Link-Gate in das Nachrichtenansicht-Dokument.
 *
 * `files` statt `func`: msg_display.js braucht die Engine (link_gate.js) im
 * selben Kontext, damit die lokale Vorabanalyse auch ohne Hintergrund greift.
 * Beide Dateien liegen im Paket (siehe scripts/verify-package.js).
 */
async function installLinkGate(tabId) {
    if (tabId === undefined || tabId === null) return null;
    if (linkGateEnabled !== true || linkGateMode === 'off') return null;
    try {
        return await browser.scripting.executeScript({
            target: { tabId },
            files: ['link_gate.js', 'msg_display.js']
        });
    } catch (e) {
        Logger.warn('Could not install the link gate in the message display', e);
        return null;
    }
}

/**
 * Toolbar-Indikator (message_display_action) fuer die gerade gelesene Nachricht.
 *
 * Befund F-2 aus docs/plan_1.7_threat_indicator_link_gate.md: Das Icon war
 * statisch, die Stufe nur im Popup sichtbar. Hier werden Badge (Score),
 * Hintergrundfarbe, Icon-Set und Tooltip an die Stufe gebunden.
 *
 * Feature-Detection ist Pflicht: `messageDisplayAction` ist in Thunderbird zwar
 * vorhanden, die Badge-Methoden sind es je nach Version aber nicht. Fehlt eine
 * Methode, bleiben die uebrigen Indikatoren aktiv (kein Totalausfall).
 */
async function updateThreatIndicator(tabId, threat) {
    if (tabId === undefined || tabId === null) return false;
    let action = null;
    try {
        action = browser.messageDisplayAction || browser.action || null;
    } catch (e) { /* older build without message_display_action */ }
    if (!action) return false;

    const evaluated = !!(threat && (threat.evaluated !== false));
    const score = evaluated ? Math.max(0, Math.min(100, Number(threat.score) || 0)) : null;
    const level = evaluated ? (threat.level || levelFromScore(score)) : 'unknown';
    const style = level === 'unknown' ? levelStyle('unknown') : levelStyle(level);
    const badgeText = score === null ? '' : String(score);
    const title = msg('actionTitleLevel', [levelLabel(level), score === null ? '?' : String(score)]);
    return await applyThreatIndicator(action, tabId, { level, score, style, badgeText, title });
}

/**
 * Setzt die einzelnen messageDisplayAction-Eigenschaften. Jede Methode ist
 * optional und wird einzeln abgesichert, damit ein fehlendes Badge nicht das
 * Icon verhindert. Rueckgabe: true, wenn mindestens ein Indikator gesetzt wurde.
 */
async function applyThreatIndicator(action, tabId, { level, score, style, badgeText, title }) {
    let applied = false;
    void score;

    if (typeof action.setBadgeText === 'function') {
        try {
            await action.setBadgeText({ tabId, text: badgeText });
            applied = true;
        } catch (e) { Logger.warn('setBadgeText failed', e); }
    }

    if (typeof action.setBadgeBackgroundColor === 'function' && badgeText) {
        try {
            await action.setBadgeBackgroundColor({ tabId, color: style.border || '#999999' });
            applied = true;
        } catch (e) { Logger.warn('setBadgeBackgroundColor failed', e); }
    }

    if (typeof action.setIcon === 'function') {
        try {
            await action.setIcon({
                tabId,
                path: {
                    16: 'img/levels/level-' + level + '-16px.png',
                    32: 'img/levels/level-' + level + '-32px.png',
                    64: 'img/levels/level-' + level + '-64px.png'
                }
            });
            applied = true;
        } catch (e) { Logger.warn('setIcon failed', e); }
    }

    if (typeof action.setTitle === 'function') {
        try {
            await action.setTitle({ tabId, title });
            applied = true;
        } catch (e) { Logger.warn('setTitle failed', e); }
    }

    return applied;
}

/**
 * Warnbanner in der Nachrichtenansicht.
 */
async function injectThreatBanner(tabId, threat) {
    const links = (threat && Array.isArray(threat.links)) ? threat.links : [];
    const attachments = (threat && Array.isArray(threat.attachments)) ? threat.attachments : [];
    if (!threat || threat.evaluated === false) return;
    const score = Math.max(0, Math.min(100, Number(threat.score) || 0));
    const hasContent = score >= 50 || threat.authStatus === 'pass' || links.length > 0 || attachments.length > 0;
    if (!hasContent) return;

    // Nur serialisierbare Daten an die injizierte Funktion uebergeben.
    const data = {
        score: score,
        level: threat.level || levelFromScore(score),
        reasons: (threat.reasons || []).slice(0, 12),
        authStatus: threat.authStatus || 'neutral',
        firstContact: threat.firstContact === true,
        replyToMismatch: threat.replyToMismatch === true,
        links: links.slice(0, 20).map(function (link) {
            return {
                host: link.host || '',
                level: link.level || 'unknown',
                reasons: (link.reasons || []).slice(0, 3),
                action: link.action || null
            };
        }),
        attachments: attachments.slice(0, 10).map(function (item) {
            return { name: item.name || '', verdict: item.verdict || '', hash: item.hash || '' };
        }),
        messageId: threat.messageId
    };
    if (score < 50 && threat.authStatus === 'pass') {
        await injectIntoMessageDisplay(tabId, function (authStatus) {
                const t = (key, fallback, subs) => {
                    try {
                        return browser.i18n.getMessage(key, subs) || fallback;
                    } catch (e) {
                        return fallback;
                    }
                };
                if (authStatus === "pass") {
                    const badge = document.createElement('div');
                    badge.id = 'thundy-auth-badge';
                    badge.style.display = 'inline-block';
                    badge.style.backgroundColor = '#e6ffe6';
                    badge.style.border = '1px solid #008000';
                    badge.style.color = '#008000';
                    badge.style.padding = '5px 10px';
                    badge.style.margin = '10px';
                    badge.style.borderRadius = '20px';
                    badge.style.fontWeight = 'bold';
                    badge.style.fontFamily = 'Arial, sans-serif';
                    badge.style.fontSize = '12px';
                    badge.style.zIndex = '9999';
                    badge.textContent = '🟢 🛡️ ' + t('bannerAuthPass', 'Sender verified (SPF/DKIM/DMARC passed)');

                    document.body.prepend(badge);
                }
        }, ['pass']);
        return;
    }

    await injectIntoMessageDisplay(tabId, renderThreatPanelInPage, [data]);
}

/**
 * Rendert das Inline-Panel in der Nachrichtenansicht (Befund F-3/F-6).
 *
 * Diese Funktion laeuft im Message-Display-Dokument (executeScript serialisiert
 * sie), darf also nur browser.i18n und das DOM benutzen und keine Variablen des
 * Hintergrund-Skopes referenzieren. Alle dynamischen Werte werden mit
 * textContent gesetzt - kein innerHTML.
 */
function renderThreatPanelInPage(d) {
    if (!d || typeof document === 'undefined' || !document.body) return;
    if (document.getElementById('thundy-threat-banner') || document.getElementById('thundy-status-panel')) return;

    const fmt = function (template, values) {
        let index = 0;
        return String(template === null || template === undefined ? '' : template)
            .replace(/\$[A-Z_]+\$/g, function () { return index < values.length ? String(values[index++]) : ''; });
    };
    const t = function (key, fallback, values) {
        let raw = fallback;
        try {
            raw = browser.i18n.getMessage(key) || fallback;
        } catch (e) { raw = fallback; }
        return fmt(raw, values || []);
    };
    const styles = {
        clean: { color: '#145c14', background: '#e6ffe6', border: '#2e8b2e', icon: '🟢' },
        low: { color: '#4d6b00', background: '#f6ffe6', border: '#8ebe2d', icon: '🟢' },
        medium: { color: '#7a5200', background: '#fff6e6', border: '#f0a500', icon: '🟡' },
        high: { color: '#8a3400', background: '#fff0e6', border: '#e8620c', icon: '🟠' },
        critical: { color: '#8a1010', background: '#ffeeee', border: '#c81e1e', icon: '🔴' },
        unknown: { color: '#333333', background: '#f2f2f2', border: '#999999', icon: '⚪' }
    };
    const style = styles[d.level] || styles.unknown;
    const levelNames = {
        clean: 'Harmless', low: 'Low risk', medium: 'Noticeable',
        high: 'High risk', critical: 'Critical', unknown: 'Not evaluated'
    };
    const levelLabel = t('bannerLevel' + d.level.charAt(0).toUpperCase() + d.level.slice(1), levelNames[d.level] || levelNames.unknown);
    const isWarning = d.score >= 50;
    const panel = document.createElement('div');
    panel.id = isWarning ? 'thundy-threat-banner' : 'thundy-status-panel';
    panel.setAttribute('role', 'status');
    panel.style.backgroundColor = style.background;
    panel.style.border = '1px solid ' + style.border;
    panel.style.color = style.color;
    panel.style.padding = '10px';
    panel.style.margin = '10px';
    panel.style.borderRadius = '4px';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.fontSize = '13px';
    panel.style.zIndex = '9999';

    const head = document.createElement('div');
    head.style.fontWeight = 'bold';
    head.style.fontSize = '14px';
    head.style.marginBottom = '6px';
    head.textContent = style.icon + ' ' + t('bannerLevelTitle', 'Thundy AV assessment: $LEVEL$ (risk score $SCORE$ of 100)', [levelLabel, String(d.score)]);
    panel.appendChild(head);

    const summary = document.createElement('div');
    const bits = [];
    bits.push(d.links.length > 0
        ? t('bannerLinksTitle', 'Links in this message') + ': ' + d.links.length
        : t('bannerLinksNone', 'No links found'));
    if (d.attachments.length > 0) bits.push(t('bannerAttachmentsTitle', 'Attachments') + ': ' + d.attachments.length);
    if (d.firstContact) bits.push(t('bannerFirstContact', 'First contact with this sender'));
    if (d.replyToMismatch) bits.push(t('bannerReplyToMismatch', 'Reply-To points to a different domain'));
    summary.textContent = bits.join(' · ');
    panel.appendChild(summary);

    const auth = document.createElement('div');
    auth.style.marginTop = '4px';
    if (d.authStatus === 'pass') {
        auth.textContent = '🛡️ ' + t('bannerAuthPass', 'Sender verified (SPF/DKIM/DMARC passed)');
    } else if (d.authStatus === 'fail') {
        auth.textContent = '⚠️ ' + t('bannerAuthFail', 'Sender authentication failed (SPF/DKIM/DMARC)');
    } else {
        auth.textContent = 'ℹ️ ' + t('bannerAuthNone', 'No SPF/DKIM/DMARC result in the headers');
    }
    panel.appendChild(auth);

    const details = document.createElement('div');
    details.id = 'thundy-panel-details';
    details.style.display = isWarning ? 'block' : 'none';
    details.style.marginTop = '8px';
    details.style.fontSize = '13px';
    panel.appendChild(details);

    const listHeading = document.createElement('div');
    listHeading.style.fontWeight = 'bold';
    listHeading.textContent = t('gateReasonTitle', 'Reasons');
    details.appendChild(listHeading);

    const reasonList = document.createElement('ul');
    reasonList.style.margin = '2px 0 6px 0';
    reasonList.style.paddingLeft = '20px';
    for (let i = 0; i < d.reasons.length; i++) {
        const li = document.createElement('li');
        li.textContent = d.reasons[i];
        reasonList.appendChild(li);
    }
    details.appendChild(reasonList);

    if (d.links.length > 0) {
        const linkHeading = document.createElement('div');
        linkHeading.style.fontWeight = 'bold';
        linkHeading.textContent = t('bannerLinksTitle', 'Links in this message');
        details.appendChild(linkHeading);

        const linkList = document.createElement('ul');
        linkList.style.margin = '2px 0 6px 0';
        linkList.style.paddingLeft = '20px';
        for (let i = 0; i < d.links.length; i++) {
            const item = d.links[i];
            const li = document.createElement('li');
            const icon = (styles[item.level] || styles.unknown).icon;
            li.textContent = icon + ' ' + item.host +
                (item.action === 'block' ? ' [' + t('gateBlocked', 'Link blocked: the check found a high risk.') + ']' : '');
            if (item.reasons.length > 0) {
                const sub = document.createElement('div');
                sub.style.opacity = '0.8';
                sub.style.fontSize = '12px';
                sub.textContent = item.reasons.join(' | ');
                li.appendChild(sub);
            }
            linkList.appendChild(li);
        }
        details.appendChild(linkList);
    }



    if (d.attachments.length > 0) {
        const attHeading = document.createElement('div');
        attHeading.style.fontWeight = 'bold';
        attHeading.textContent = t('bannerAttachmentsTitle', 'Attachments');
        details.appendChild(attHeading);

        const attList = document.createElement('ul');
        attList.style.margin = '2px 0 6px 0';
        attList.style.paddingLeft = '20px';
        for (let i = 0; i < d.attachments.length; i++) {
            const item = d.attachments[i];
            const li = document.createElement('li');
            let line = item.name || '';
            if (item.verdict) line += ' — ' + item.verdict;
            if (item.hash) line += ' (SHA-256: ' + item.hash.slice(0, 16) + '…)';
            li.textContent = line;
            attList.appendChild(li);
        }
        details.appendChild(attList);
    }


    const actions = document.createElement('div');
    actions.style.marginTop = '8px';

    const detailsButton = document.createElement('button');
    detailsButton.type = 'button';
    detailsButton.textContent = isWarning
        ? t('bannerDetailsHide', 'Hide details')
        : t('bannerDetailsToggle', 'Show details');
    detailsButton.addEventListener('click', function () {
        const open = details.style.display !== 'none';
        details.style.display = open ? 'none' : 'block';
        detailsButton.textContent = open
            ? t('bannerDetailsToggle', 'Show details')
            : t('bannerDetailsHide', 'Hide details');
    });
    actions.appendChild(detailsButton);

    const reportButton = document.createElement('button');
    reportButton.type = 'button';
    reportButton.id = 'thundy-report-admin';
    reportButton.style.marginLeft = '8px';
    reportButton.textContent = t('bannerReportAdmin', 'Report to administrator');
    reportButton.addEventListener('click', async function () {
        reportButton.disabled = true;
        reportButton.setAttribute('aria-busy', 'true');
        let message = t('gateReportFailed', 'The report could not be created (no administrator contact configured?).');
        try {
            const response = await browser.runtime.sendMessage({ action: 'requestAdminReport', messageId: d.messageId });
            if (response && response.success) {
                message = t('gateReportSent', 'Report to the administrator has been prepared.');
            }
        } catch (e) { /* keep the failure text */ }
        reportButton.textContent = message;
        reportButton.disabled = false;
        reportButton.removeAttribute('aria-busy');
    });
    actions.appendChild(reportButton);
    panel.appendChild(actions);

    document.body.prepend(panel);
}


async function processAttachments(message) {

  let attachments = await browser.messages.listAttachments(message.id);

  if (attachments.length > 0) {
    await sent_to_hybrid_by_attachment(message, attachments);
  }
}

async function processLinks(tab, message, fullMessage, parsedUrlCache = null) {
  let messageText = extractTextFromParts(fullMessage.parts || fullMessage);
  let urls = extractUrls(messageText);
  let filteredUrls = filterUrls(urls, parsedUrlCache);

  if (filteredUrls.length > 0) {
    await processAndUploadUrls(message, filteredUrls);
  }

  // Wenn timeOfClickProtection aktiv ist, senden wir eine Nachricht an den Content-Script
  await injectTimeOfClickProtection(tab.id, filteredUrls);

  return { messageText, urls, filteredUrls };
}

async function extractBecProtectionData(message, fullMessage) {
  const senderEmail = extractEmailAddress(message.author);
  const isFirstCommunication = await checkFirstCommunication(senderEmail);
  const replyTo = (fullMessage.headers && fullMessage.headers['reply-to']) ? fullMessage.headers['reply-to'][0] : "";
  const subject = message.subject || "";

  return { senderEmail, isFirstCommunication, replyTo, subject };
}

async function collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache }) {
  const authHeaders = (fullMessage.headers && fullMessage.headers['authentication-results']) || [];
  const receivedHeaders = (fullMessage.headers && fullMessage.headers['received']) || [];

  const [maliciousIps, urlhausDomains, becData] = await Promise.all([
    checkIPReputation(receivedHeaders),
    checkURLhausDomains(filteredUrls, parsedUrlCache),
    extractBecProtectionData(message, fullMessage)
  ]);

  return {
    authHeaders,
    urlhausDomains,
    isFirstCommunication: becData.isFirstCommunication,
    messageText,
    subject: becData.subject,
    replyTo: becData.replyTo,
    parsedUrlCache,
    maliciousIps
  };
}

async function evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText, parsedUrlCache = null }) {
  const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache });
  const threat = calculateThreatScore(message.author, urls, options);
  const senderEmail = extractEmailAddress(message.author || '');
  const senderDomain = extractEmailDomain(senderEmail);

  threat.level = levelFromScore(threat.score);
  threat.evaluated = true;
  threat.messageId = message.id;
  threat.firstContact = options.isFirstCommunication === true;
  threat.replyToMismatch = hasReplyToMismatch(options.replyTo, senderEmail);
  threat.links = buildThreatLinkSummaries(filteredUrls, senderDomain);
  threat.attachments = await collectAttachmentSummaries(message);

  const tabId = tab ? tab.id : null;
  await updateThreatIndicator(tabId, threat);
  await injectThreatBanner(tabId, threat);
  rememberThreatForTab(tabId, threat);
  return threat;
}

/**
 * Reply-To auf einer anderen Domain als der Absender ist ein klassisches
 * BEC-Muster (Antworten landen beim Angreifer). Reiner String-Vergleich, damit
 * die Auswertung ohne Netzwerkzugriff auskommt.
 */
function hasReplyToMismatch(replyTo, senderEmail) {
  try {
    if (!replyTo || !senderEmail) return false;
    const replyEmail = extractEmailAddress(String(replyTo));
    const replyDomain = extractEmailDomain(replyEmail);
    const senderDomain = extractEmailDomain(senderEmail);
    if (!replyDomain || !senderDomain) return false;
    return replyDomain !== senderDomain;
  } catch (e) {
    return false;
  }
}

/**
 * Pro-Link-Zusammenfassung fuer das Inline-Panel: Host, Stufe, Gruende. Die
 * Bewertung kommt aus der lokalen Engine (link_gate.js); ohne Engine bleibt die
 * Stufe "unknown", damit das Panel nichts vortaeuscht.
 */
function buildThreatLinkSummaries(filteredUrls, senderDomain) {
  const urls = Array.isArray(filteredUrls) ? filteredUrls.slice(0, 20) : [];
  const engine = gateEngine();
  const summaries = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let host = '';
    try { host = new URL(url).hostname; } catch (e) { host = String(url); }
    if (!engine || typeof engine.inspectUrl !== 'function') {
      summaries.push({ url: url, host: host, level: 'unknown', reasons: [], action: null });
      continue;
    }
    try {
      const local = engine.inspectUrl(url, { senderDomain: senderDomain, whitelist: Array.from(customWhitelist) });
      summaries.push({
        url: url,
        host: host,
        level: local.level || 'unknown',
        score: local.score || 0,
        reasons: (local.reasons || []).slice(0, 3),
        action: null
      });
    } catch (e) {
      summaries.push({ url: url, host: host, level: 'unknown', reasons: [], action: null });
    }
  }
  return summaries;
}

/**
 * Anhang-Metadaten (Name, Groesse, Typ, SHA-256 falls schon berechnet). Es werden
 * bewusst keine Anhangsinhalte gelesen - der Report soll forensisch nutzbar, aber
 * datensparsam sein.
 */
async function collectAttachmentSummaries(message) {
  if (!message || message.id === undefined || message.id === null) return [];
  let attachments = [];
  try {
    attachments = await browser.messages.listAttachments(message.id);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(attachments)) return [];

  let hashes = {};
  try {
    const db = await getSharedDB();
    const record = await getFromStore(db, "hybridanalysis", message.headerMessageId);
    if (record && Array.isArray(record.attachments)) {
      for (const entry of record.attachments) {
        if (entry && entry.name && entry.local_hash) hashes[entry.name] = entry.local_hash;
      }
    }
  } catch (e) { /* Cache ist optional */ }

  return attachments.slice(0, 10).map(function (item) {
    const name = item && item.name ? item.name : '';
    return {
      name: name,
      size: item && item.size ? item.size : 0,
      contentType: item && item.contentType ? item.contentType : '',
      hash: hashes[name] || '',
      verdict: ''
    };
  });
}

// Letzte Bewertung je Tab, damit das Popup und das Message-Display-Panel den
// gleichen Stand sehen (kein erneutes Scannen noetig).
const lastThreatByTab = new Map();

function rememberThreatForTab(tabId, threat) {
  if (tabId === undefined || tabId === null) return;
  if (lastThreatByTab.size > 20) {
    lastThreatByTab.delete(lastThreatByTab.keys().next().value);
  }
  lastThreatByTab.set(tabId, threat);
}

function threatForTab(tabId) {
  if (tabId === undefined || tabId === null) return null;
  return lastThreatByTab.get(tabId) || null;
}

/**
 * Injects the per-message opt-in banner.
 * Two explicit actions: scan this message once (no persistent opt-in) or
 * enable scanning for this sender permanently.
 */
async function injectOptInBanner(tabId, messageId, senderEmail, consentGiven) {
  await injectIntoMessageDisplay(tabId, function(messageId, senderEmail, consentGiven) {
        const t = (key, fallback, subs) => {
          try {
            return browser.i18n.getMessage(key, subs) || fallback;
          } catch (e) {
            return fallback;
          }
        };

        const existing = document.getElementById('thundy-optin-banner');
        if (existing) return;

        const banner = document.createElement('div');
        banner.id = 'thundy-optin-banner';
        banner.style.backgroundColor = '#fff8e1';
        banner.style.border = '1px solid #ffcc80';
        banner.style.color = '#333';
        banner.style.padding = '8px';
        banner.style.margin = '8px';
        banner.style.borderRadius = '4px';
        banner.style.fontFamily = 'Arial, sans-serif';
        banner.style.zIndex = '9999';

        const text = document.createElement('span');
        text.textContent = t('bannerTitleOptIn', 'Thundy AV: real-time scanning is not enabled for this message.');
        banner.appendChild(text);

        const createButton = (label, persist) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = label;
          btn.style.marginLeft = '10px';
          btn.addEventListener('click', async () => {
            const buttons = banner.querySelectorAll('button');
            buttons.forEach(b => { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
            btn.textContent = t('bannerScanRunning', 'Scanning…');
            try {
              const resp = await browser.runtime.sendMessage({
                action: 'requestScan',
                messageId: messageId,
                senderEmail: senderEmail,
                persist: persist
              });
              if (resp && resp.success) {
                btn.textContent = t('bannerScanDone', 'Scan finished');
                btn.removeAttribute('aria-busy');
                buttons.forEach(b => { b.disabled = false; });
                if (persist) {
                  setNote(t('bannerSenderOptIn', 'This sender is now scanned automatically.'));
                }
              } else if (resp && resp.error === 'permission_denied') {
                btn.textContent = t('bannerPermissionDenied', 'Required host permission was denied');
                // A request triggered from the banner travels over
                // runtime.sendMessage, so it has no user gesture in the context
                // that calls permissions.request; if it is rejected, the options
                // page is the reliable path (P2-23).
                setNote(t('bannerPermissionDeniedHint', 'The host permission for the analysis service is missing. Please grant it in the add-on options.'));
                addOptionsButton();
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
              } else if (resp && (resp.error === 'HOST_PERMISSION_MISSING' || resp.code === 'HOST_PERMISSION_MISSING')) {
                btn.textContent = t('bannerScanFailed', 'Scan failed');
                setNote(t('bannerPermissionDeniedHint', 'The host permission for the analysis service is missing. Please grant it in the add-on options.'));
                addOptionsButton();
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
              } else if (resp && (resp.error === 'TIER_BLOCKS_UPLOAD' || resp.code === 'TIER_BLOCKS_UPLOAD' ||
                                  resp.error === 'TIER_REQUIRES_MAX' || resp.code === 'TIER_REQUIRES_MAX')) {
                btn.textContent = t('bannerScanFailed', 'Scan failed');
                setNote(t('bannerTierBlocked', 'This action is not allowed by the current privacy tier. See the add-on options.'));
                addOptionsButton();
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
              } else if (resp && (resp.error === 'EXTERNAL_ANALYSIS_DISABLED' || resp.code === 'EXTERNAL_ANALYSIS_DISABLED')) {
                setNote(t('bannerConsentMissing', 'External analysis is disabled in the options – nothing was transmitted.'));
                addOptionsButton();
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); btn.textContent = label; });
              } else {
                btn.textContent = t('bannerScanFailed', 'Scan failed');
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
              }
            } catch (e) {
              btn.textContent = t('bannerScanFailed', 'Scan failed');
              buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
            }
          });
          banner.appendChild(btn);
        };

        const note = document.createElement('div');
        note.id = 'thundy-optin-note';
        note.style.fontSize = '12px';
        note.style.marginTop = '6px';
        note.textContent = t('bannerNoteOptIn', 'Scanning transmits data to external analysis services, but only if you enabled it in the add-on settings and only after you gave your consent. See the add-on options.');
        if (!consentGiven) {
          note.textContent = t('bannerConsentMissing', 'External analysis is disabled in the options – nothing was transmitted.');
        }

        function setNote(value) {
          note.textContent = value;
        }

        function addOptionsButton() {
          if (banner.querySelector('#thundy-open-options')) return;
          const optionsButton = document.createElement('button');
          optionsButton.id = 'thundy-open-options';
          optionsButton.type = 'button';
          optionsButton.textContent = t('bannerOpenOptions', 'Open options');
          optionsButton.style.marginLeft = '10px';
          optionsButton.addEventListener('click', () => browser.runtime.openOptionsPage());
          note.appendChild(optionsButton);
        }

        createButton(t('bannerScanOnce', 'Scan this message once'), false);
        createButton(t('bannerScanSender', 'Always scan this sender'), true);

        banner.appendChild(note);

        if (!consentGiven) {
          addOptionsButton();
        }

        document.body.prepend(banner);
  }, [messageId, senderEmail, consentGiven === true]);
}

/**
 * Returns the first message displayed in the given tab.
 *
 * Manifest V3 removed `messageDisplay.getDisplayedMessage()`; the replacement
 * `getDisplayedMessages()` returns a `MessageList` (see the Thunderbird MV3
 * migration guide and mail/components/extensions/schemas/messageDisplay.json,
 * where the old API is marked `max_manifest_version: 2`). There is deliberately
 * no legacy fallback any more: `strict_min_version` is 140.0.
 */
async function getFirstDisplayedMessage(tabId, { throwOnError = false } = {}) {
  if (tabId === undefined || tabId === null) return null;
  try {
    if (browser.messageDisplay && typeof browser.messageDisplay.getDisplayedMessages === 'function') {
      const list = await browser.messageDisplay.getDisplayedMessages(tabId);
      return messageListToArray(list)[0] || null;
    }
    Logger.error('messageDisplay.getDisplayedMessages() is unavailable in this Thunderbird version');
  } catch (e) {
    Logger.error('Failed to determine the displayed message', e);
    if (throwOnError) throw e;
  }
  return null;
}

function messageListToArray(messages) {
  if (!messages) return [];
  if (Array.isArray(messages)) return messages;
  if (Array.isArray(messages.messages)) return messages.messages;
  return [messages];
}

// Hauptfunktion: Wird ausgelöst, wenn Nachrichten angezeigt werden
// (MV3: messageDisplay.onMessagesDisplayed liefert eine MessageList)
async function tab_mail_open_display(tab, messages) {
  for (const message of messageListToArray(messages)) {
    await handleDisplayedMessage(tab, message);
  }
}

async function handleDisplayedMessage(tab, message) {
  if (!message || message.id === undefined || message.id === null) return;
  try {
    const senderEmail = extractEmailAddress(message.author || '');

    const stored = await browser.storage.local.get('scanningEnabledSenders');
    const enabledSenders = stored.scanningEnabledSenders || [];

    const permission = await hasHybridPermission();
    const canAutoUpload = permission && enabledSenders.includes(senderEmail) && !alwaysManual &&
      !!apikey_hybridanalysis && mayTransmitExternally();

    let fullMessage = await browser.messages.getFull(message.id);
    let attachments = [];
    try {
      attachments = await browser.messages.listAttachments(message.id);
    } catch (e) { /* ignore */ }

    await processAttachments(message);

    let parsedUrlCache = new Map();
    let { messageText, urls, filteredUrls } = await processLinks(tab, message, fullMessage, parsedUrlCache);

    // Klick-Gate: erst installieren, dann bewerten. Ohne diese Injektion wuerde
    // Thunderbird Links ungeprueft an den Standardbrowser geben (Befund F-1).
    await installLinkGate(tab.id);

    await evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText, parsedUrlCache });

    if (!canAutoUpload && ((attachments && attachments.length > 0) || (filteredUrls && filteredUrls.length > 0))) {
      await injectOptInBanner(tab.id, message.id, senderEmail, mayTransmitExternally());
    }
  } catch (error) {
    Logger.error(`Fehler beim Laden der Anhänge oder Links: ${error}`);
  }
}

// ⚡ Bolt Optimization: Avoided intermediate array allocations and map/join overhead
// by using string concatenation in an accumulator object for faster recursive text extraction.
function extractTextFromParts(part, outObj) {
  const isRoot = outObj === undefined;
  if (isRoot) {
      outObj = { text: "" };
  }

  if (part.contentType === "text/plain" || part.contentType === "text/html") {
      if (part.body) {
         outObj.text += part.body + " ";
      }
  }
  if (part.parts) {
      for (let subPart of part.parts) {
          extractTextFromParts(subPart, outObj);
      }
  }

  if (isRoot) {
      return outObj.text;
  }
}

function extractUrls(text) {
    const urlSet = new Set();
    const punct = ".,;:!)]";
    let searchStart = 0;

    while (true) {
        // ⚡ Bolt Optimization: Find 'http' once instead of searching for 'http://' and 'https://' separately.
        const startIdx = text.indexOf("http", searchStart);
        if (startIdx === -1) break;

        let isHttp = text.startsWith("http://", startIdx);
        let isHttps = false;
        let prefixLen = 7;

        if (!isHttp) {
            isHttps = text.startsWith("https://", startIdx);
            if (isHttps) prefixLen = 8;
        }

        if (!isHttp && !isHttps) {
            searchStart = startIdx + 1;
            continue;
        }

        let endIdx = startIdx + prefixLen;
        while (endIdx < text.length) {
            const charCode = text.charCodeAt(endIdx);

            if (charCode <= 32 || charCode === 34 || charCode === 39 || charCode === 60 || charCode === 62) {
                if (charCode === 32 || charCode === 9 || charCode === 10 || charCode === 13 ||
                    charCode === 34 || charCode === 39 || charCode === 60 || charCode === 62) {
                    break;
                }
            } else if (charCode > 127 && /\s/.test(text[endIdx])) {
                break;
            }
            endIdx++;
        }

        if (endIdx > startIdx + prefixLen) {
            let url = text.substring(startIdx, endIdx);

            let len = url.length;
            while(len > 0) {
                let c = url.charCodeAt(len - 1);
                // Check for '.', ',', ';', ':', '!', ')', ']'
                if (c === 46 || c === 44 || c === 59 || c === 58 || c === 33 || c === 41 || c === 93) {
                    len--;
                } else {
                    break;
                }
            }
            if (len !== url.length) {
                url = url.substring(0, len);
            }

            // ⚡ Bolt Optimization: Use Set for O(1) deduplication, which significantly outperforms Array indexOf for large numbers of links
            urlSet.add(url);
        }

        searchStart = endIdx === startIdx ? startIdx + 1 : endIdx;
    }
    return Array.from(urlSet);
}

const IGNORED_DOMAINS = [
    'w3.org', 'google.com', 'microsoft.com', 'apple.com',
    'mozilla.org', 'schemas.microsoft.com', 'yahoo.com', 'github.com'
];
// Precompiled regex for faster O(1) checks instead of O(N) array loops
const IGNORED_DOMAINS_REGEX = new RegExp(`(?:^|\\.)(${IGNORED_DOMAINS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`);

function filterUrls(urls, parsedUrlCache = null) {
    return urls.filter(url => {
        try {
            // 🛡️ Sentinel: Use standard URL parser safely
            let hostname = getHostnameOptimized(url, parsedUrlCache);
            if (!hostname) return false;
            return !IGNORED_DOMAINS_REGEX.test(hostname);
        } catch (e) {
            return false; // Ungültige URL
        }
    });
    return filtered;
}

// ⚡ Bolt Optimization: Precompute hex table to avoid expensive .toString(16).padStart(2, '0') calls in loop
const byteToHex = new Array(256);
for (let n = 0; n <= 255; n++) {
    byteToHex[n] = n.toString(16).padStart(2, '0');
}

const sha256Cache = new WeakMap();

// Funktion zum Senden der Anhänge an Hybrid Analysis
async function get_sha256_hash(fileData) {
    // ⚡ Bolt Optimization: Cache SHA-256 hash calculation per file buffer reference using WeakMap
    if (typeof fileData === "object" && fileData !== null && sha256Cache.has(fileData)) {
        return sha256Cache.get(fileData);
    }
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileData);
    const u8 = new Uint8Array(hashBuffer);
    // ⚡ Bolt Optimization: Use pre-allocated array and .join() instead of string concatenation or Array.from
    const hex = new Array(u8.length);
    for (let j = 0; j < u8.length; j++) hex[j] = byteToHex[u8[j]];
    const result = hex.join("");
    if (typeof fileData === "object" && fileData !== null) {
        sha256Cache.set(fileData, result);
    }
    return result;
}

class HybridDataBuilder {
    static create(submissionId, jobId, sha256, state, attachment, virustotalStats = null) {
        return {
            hybrid_data: {
                submission_id: submissionId,
                job_id: jobId,
                sha256,
                state,
                partName: attachment.partName
            },
            attachmentName: attachment.name,
            ...(virustotalStats && { virustotal_stats: virustotalStats })
        };
    }
}

async function handle_unknown_attachment({ attachment, content_of_attachment, local_hash, virustotal_stats, privacyTier, fileType }) {
    if ((privacyTier === 'balanced' || privacyTier === 'max') && mayTransmitExternally()) {
        try {
            // The upload must be covered by the host permission the user granted
            // when saving the key, and it must go through the shared gateway so
            // the timeout/rate-limit handling applies (P1-12).
            await requireHostPermission('https://hybrid-analysis.com/api/v2/quick-scan/file');
            const file_to_submit = new File([content_of_attachment], attachment.name, { type: fileType || 'application/octet-stream' });
            const formData = new FormData();
            formData.append('scan_type', 'all');
            formData.append('file', file_to_submit);

            const uploadOptions = getHybridAnalysisOptions('POST', formData);
            uploadOptions.url = 'https://hybrid-analysis.com/api/v2/quick-scan/file';
            const uploadResponse = await apiGateway.fetchWithTimeout(uploadOptions.url, uploadOptions, 60000);
            if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                const uploadData = await uploadResponse.json();
                const hybridData = HybridDataBuilder.create(
                    uploadData.submission_id,
                    uploadData.job_id,
                    uploadData.sha256 || local_hash,
                    'UPLOADED',
                    attachment
                );
                return hybridData;
            } else {
                Logger.error('Fehler beim automatischen Upload, falle auf manuell zurück.');
            }
        } catch (uploadError) {
            Logger.error('Ausnahme beim automatischen Upload, falle auf manuell zurück.', uploadError);
        }
    }

    const pendingData = HybridDataBuilder.create(
        'PENDING_UPLOAD',
        'PENDING_UPLOAD',
        local_hash,
        'UNKNOWN',
        attachment,
        virustotal_stats
    );
    return pendingData;
}


async function fetch_virustotal_stats(local_hash, apikey) {
    if (apikey && mayTransmitExternally() && await hasHostPermissionFor('https://www.virustotal.com/api/v3/files/x')) {
        return await checkVirusTotal(local_hash, apikey);
    }
    return null;
}

function create_manual_check_hybrid_data(local_hash, attachment, virustotal_stats) {
    const data = HybridDataBuilder.create(
        'MANUAL_CHECK',
        'MANUAL_CHECK',
        local_hash,
        'MANUAL_CHECK_PENDING',
        attachment,
        virustotal_stats
    );
    return data;
}

async function check_hybrid_analysis_for_attachment(local_hash, attachment, content_of_attachment, virustotal_stats, file_type) {
    if (!mayTransmitExternally()) {
        return create_manual_check_hybrid_data(local_hash, attachment, virustotal_stats);
    }
    const optionsCheck = getHybridAnalysisOptions('GET');
    optionsCheck.url = 'https://hybrid-analysis.com/api/v2/overview/' + local_hash;
    const responseCheck = await apiGateway.fetchWithTimeout(optionsCheck.url, optionsCheck);

    if (responseCheck.status === 200) {
        const json_data = await responseCheck.json();
        return HybridDataBuilder.create(
            json_data.submission_id || 'N/A',
            json_data.job_id || 'N/A',
            local_hash,
            'KNOWN',
            attachment,
            virustotal_stats
        );
    }

    return await handle_unknown_attachment({
        attachment,
        content_of_attachment,
        local_hash,
        virustotal_stats,
        privacyTier,
        fileType: file_type
    });
}


async function process_single_attachment(message, attachment) {
    let file = await browser.messages.getAttachmentFile(message.id, attachment.partName);

    switch (attachment.contentType) {
      case 'text/plain':
      case 'text/html':
      case 'text/css':
      case 'text/csv':
      case 'text/javascript':
      case 'application/json':
      case 'application/xml':
      case 'application/xhtml+xml':
        return null;

      default:
        try {
            const content_of_attachment = file.slice();
            const arrayBuffer = await content_of_attachment.arrayBuffer();
            const local_hash = await get_sha256_hash(arrayBuffer);

            const virustotal_stats = await fetch_virustotal_stats(local_hash, apikey_virustotal);

            if (alwaysManual || !mayTransmitExternally()) {
                return create_manual_check_hybrid_data(local_hash, attachment, virustotal_stats);
            }

            return await check_hybrid_analysis_for_attachment(
                local_hash,
                attachment,
                content_of_attachment,
                virustotal_stats,
                file.type
            );

        } catch (error) {
          Logger.error('Netzwerk- oder Verarbeitungsfehler beim Überprüfen:', error);
          return null;
        }
    }
}


async function sent_to_hybrid_by_attachment(message, attachments) {
  if (!apikey_hybridanalysis) {
      Logger.error("Kein API-Key gefunden. Bitte in den Einstellungen hinterlegen.");
      return;
  }

  const promises = [];
  for (const attachment of attachments) {
    promises.push(process_single_attachment(message, attachment));
  }
  const results = await Promise.all(promises);

  const validResults = results.filter(r => r !== null);
  if (validResults.length > 0) {
      await indexedDB_save_batch_hybrid_data_to_db(message, validResults);
  }
}

async function indexedDB_save_batch_hybrid_data_to_db(message, results) {
  try {
    const db = await getSharedDB();

    if (message.headerMessageId) {
      const newAttachments = results.map(result => ({
        hybrid_submission_id: result.hybrid_data.submission_id,
        hybrid_job_id: result.hybrid_data.job_id,
        hybrid_sha256: result.hybrid_data.sha256,
        attachment_name: result.attachmentName,
        state: result.hybrid_data.state,
        partName: result.hybrid_data.partName,
        virustotal_stats: result.virustotal_stats,
        created: new Date()
      }));

      await updateStore(db, 'hybridanalysis', message.headerMessageId, (existingRecord) => {
        let recordToSave;
        if (existingRecord) {
          // Update existing record
          recordToSave = existingRecord;
          if (!recordToSave.attachments) recordToSave.attachments = [];

          // ⚡ Bolt Optimization: Replace Map and Array.from allocations with direct in-place array search to eliminate Map overhead and extra lookups
          const atts = recordToSave.attachments;
          for (let i = 0; i < newAttachments.length; i++) {
            const newAtt = newAttachments[i];
            let found = false;
            for (let j = 0; j < atts.length; j++) {
              if (atts[j].attachment_name === newAtt.attachment_name) {
                atts[j] = newAtt;
                found = true;
                break;
              }
            }
            if (!found) {
              atts.push(newAtt);
            }
          }
        } else {
          // Create new record
          recordToSave = {
            messageHeader: message.headerMessageId,
            author: message.author,
            subject: message.subject,
            attachments: newAttachments
          };
        }
        return recordToSave;
      });
    }
  } catch (error) {
    Logger.error('Fehler bei der Batch-Interaktion mit der Datenbank:', error);
  }
}

// Speicherung der Ergebnisse in IndexedDB
async function indexedDB_save_links_objects_to_db(message, urlObjects) {
  try {
    const db = await getSharedDB();

    if (message.headerMessageId) {
      const newLinks = urlObjects.map(obj => ({
        ...obj,
        created: new Date()
      }));

      await updateStore(db, 'hybridanalysis', message.headerMessageId, (existingRecord) => {
        let recordToSave;
        if (existingRecord) {
          recordToSave = existingRecord;
          if (!recordToSave.links) recordToSave.links = [];

          // Pre-compute map for O(1) lookups, changing complexity from O(N*M) to O(N+M)
          const urlMap = new Map();
          for (let i = 0; i < recordToSave.links.length; i++) {
            urlMap.set(recordToSave.links[i].url, recordToSave.links[i]);
          }
          for (let i = 0; i < newLinks.length; i++) {
            urlMap.set(newLinks[i].url, newLinks[i]);
          }
          recordToSave.links = [...urlMap.values()];

        } else {
          recordToSave = {
            messageHeader: message.headerMessageId,
            author: message.author,
            subject: message.subject,
            links: newLinks
          };
        }
        return recordToSave;
      });
    }
  } catch (error) {
    Logger.error('IndexedDB (Links) Save Error:', error);
  }
}

async function indexedDB_save_links_to_db(message, urls) {
  try {
    const db = await getSharedDB();

    if (message.headerMessageId) {
      const newLinks = urls.map(url => ({
        url: url,
        state: 'UNKNOWN',
        created: new Date()
      }));

      await updateStore(db, 'hybridanalysis', message.headerMessageId, (existingRecord) => {
        let recordToSave;
        if (existingRecord) {
          recordToSave = existingRecord;
          if (!recordToSave.links) recordToSave.links = [];

          // Pre-compute Set for O(1) lookups, changing complexity from O(N*M) to O(N+M)
          const existingUrls = new Set(recordToSave.links.map(l => l.url));
          for (const newLink of newLinks) {
            if (!existingUrls.has(newLink.url)) {
              recordToSave.links.push(newLink);
              existingUrls.add(newLink.url); // Keep Set in sync with newly added links
            }
          }
        } else {
          recordToSave = {
            messageHeader: message.headerMessageId,
            author: message.author,
            subject: message.subject,
            links: newLinks
          };
        }
        return recordToSave;
      });
    }
  } catch (error) {
    Logger.error('Fehler bei der URL-Speicherung in der Datenbank:', error);
  }
}

// Listener registrieren
// Manifest V3 removed messageDisplay.onMessageDisplayed in favour of
// onMessagesDisplayed (which delivers a MessageList).
// Manifest V3 removed messageDisplay.onMessageDisplayed; onMessagesDisplayed
// delivers a MessageList. `strict_min_version` is 140.0, so no MV2 fallback.
if (browser.messageDisplay && browser.messageDisplay.onMessagesDisplayed) {
    browser.messageDisplay.onMessagesDisplayed.addListener(tab_mail_open_display);
} else {
    Logger.error('messageDisplay.onMessagesDisplayed is unavailable in this Thunderbird version');
}

function createContextMenus() {
    if (!browser.menus || typeof browser.menus.create !== 'function') return;
    const menus = [
        {
            id: "scan-link-thundy",
            title: msg('menuScanLink', 'Scan link with Thundy AV'),
            contexts: ["link"]
        },
        {
            id: "scan-message-links-thundy",
            title: msg('menuScanMessageLinks', 'Scan all links of this message'),
            contexts: ["message_display_action"]
        }
    ];
    for (const menu of menus) {
        try {
            // menus.create is asynchronous: a synchronous try/catch cannot catch
            // duplicate-ID errors, so the returned promise is handled as well.
            const created = browser.menus.create(menu);
            if (created && typeof created.catch === 'function') {
                created.catch((e) => Logger.warn('Could not create context menu entry', menu.id, e));
            }
        } catch (e) {
            Logger.warn('Could not create context menu entry', menu.id, e);
        }
    }
}

function notify(titleKey, messageKey, subs) {
    try {
        browser.notifications.create({
            type: "basic",
            iconUrl: iconUrl(),
            title: msg(titleKey),
            message: msg(messageKey, subs)
        });
    } catch (e) {
        Logger.error('Could not create notification', e);
    }
}

// Scans every link of the currently displayed message (context menu entry of
// the message display action, which is a documented Thunderbird context).
async function scanLinksOfDisplayedMessage(tabId) {
    const message = await getFirstDisplayedMessage(tabId);
    if (!message) {
        notify('notificationTitleError', 'notificationScanError', ['No displayed message found']);
        return;
    }
    try {
        assertExternalAnalysisAllowed();
        const fullMessage = await browser.messages.getFull(message.id);
        const text = extractTextFromParts(fullMessage.parts || fullMessage);
        const urls = filterUrls(extractUrls(text));
        if (urls.length === 0) {
            notify('notificationTitle', 'notificationNoLinks', []);
            return;
        }
        let submitted = 0;
        for (const url of urls.slice(0, 20)) {
            try {
                await handleUrlScan(url, message.headerMessageId);
                submitted++;
            } catch (e) {
                Logger.error('Could not submit link for analysis', e);
            }
        }
        notify('notificationTitle', 'notificationScanSubmitted', [String(submitted)]);
    } catch (e) {
        notify('notificationTitleError', 'notificationScanError', [e.message]);
    }
}

createContextMenus();

if (browser.menus && browser.menus.onClicked) browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "scan-message-links-thundy") {
        await scanLinksOfDisplayedMessage(tab && tab.id);
        return;
    }

    if (info.menuItemId === "scan-link-thundy") {
        let url = info.linkUrl;
        if (!url) {
            Logger.warn('No link URL available in the context menu data');
            return;
        }

        notify('notificationTitle', 'notificationScanStarted', [describeUrlForUser(url)]);

        try {
            // Need a dummy headerMessageId as context menu might be clicked outside standard flow
            // or we just fetch the active message
            const activeMessage = await getFirstDisplayedMessage(tab && tab.id);
            let msgId = activeMessage ? activeMessage.headerMessageId : "context_menu_scan";

            let result = await handleUrlScan(url, msgId);

            notify('notificationTitle', 'notificationScanSubmitted', [String(result.job_id)]);
        } catch (error) {
            notify('notificationTitleError', 'notificationScanError', [error.message]);
        }
    }
});
/**
 * Konfiguration fuer das Link-Gate im Message-Display-Skript. Texte kommen aus
 * der Locale-Datei, damit die Gate-UI dieselbe Sprache spricht wie die Banner;
 * die Farben stammen aus levelStyle(), damit Toolbar und Dialog zusammenpassen.
 */
function linkGateConfigPayload() {
    const texts = {};
    for (const key of Object.keys(I18N_FALLBACKS)) {
        if (key.indexOf('gate') === 0 || key.indexOf('bannerLevel') === 0) {
            texts[key] = msg(key, []);
        }
    }
    const styles = {};
    for (const level of THREAT_LEVELS.concat(['unknown'])) {
        const style = levelStyle(level);
        styles[level] = {
            color: style.color,
            background: style.background,
            border: style.border,
            icon: style.icon
        };
    }
    return {
        enabled: linkGateEnabled === true && linkGateMode !== 'off',
        mode: linkGateMode,
        whitelist: Array.from(customWhitelist),
        texts: texts,
        styles: styles
    };
}

/**
 * Audit-Log des Link-Gates: Ringpuffer in storage.local, damit eine Entscheidung
 * ("trotzdem geoeffnet") nachvollziehbar bleibt. Bewusst lokal und begrenzt -
 * keine Telemetrie, kein Server (F-8).
 */
async function logGateDecision(entry) {
    try {
        const stored = await browser.storage.local.get('threatAuditLog');
        const log = Array.isArray(stored.threatAuditLog) ? stored.threatAuditLog : [];
        log.push({
            at: new Date().toISOString(),
            url: entry && entry.url ? describeUrlForUser(entry.url) : '',
            host: entry && entry.host ? entry.host : '',
            action: entry && entry.action ? entry.action : 'unknown',
            level: entry && entry.level ? entry.level : 'unknown',
            override: entry && entry.override === true,
            source: entry && entry.source ? entry.source : 'link-gate'
        });
        while (log.length > LINK_GATE_AUDIT_LIMIT) log.shift();
        await browser.storage.local.set({ threatAuditLog: log });
        return true;
    } catch (e) {
        Logger.warn('Could not write the link-gate audit log', e);
        return false;
    }
}

/**
 * Klick-Gate im Hintergrund.
 *
 * Der Message-Display-Kontext liefert die lokale Vorabanalyse mit (`local`), hier
 * kommen nur die externen Quellen dazu. Bewusst schnell: URLhaus (eine Anfrage)
 * und der bereits gespeicherte Hybrid-Analysis-Befund aus IndexedDB; der
 * urlscan.io-Live-Scan laeuft nur bei auffaelligen Links und mit Zeitbudget
 * (LINK_GATE_LIVE_SCAN_BUDGET_MS), damit ein Klick nie "haengt".
 */
async function handleCheckLinkState(request) {
    const url = request && typeof request.url === 'string' ? request.url : '';
    if (!url) return { status: 'ERROR', action: 'warn', level: 'unknown', score: 0, reasons: [], sources: {} };

    const engine = gateEngine();
    let local = request.local || null;
    if (!local && engine && typeof engine.inspectUrl === 'function') {
        try {
            local = engine.inspectUrl(url, {
                displayText: request.displayText || '',
                whitelist: Array.from(customWhitelist)
            });
        } catch (e) { local = null; }
    }
    if (!local) {
        local = { url: url, host: describeUrlForUser(url), level: 'unknown', score: 0, reasons: [], indicators: [] };
    }

    let host = local.host || '';
    let domain = host;
    try { domain = new URL(url).hostname; } catch (e) { /* keep the local host */ }

    const sources = { urlhaus: null, urlscan: null, hybrid: null, unknown: true };

    // Whitelist-Treffer: kein externer Aufruf, sofort freigeben.
    const whitelisted = (local.indicators || []).some(function (item) { return item && item.code === 'whitelisted'; });

    if (!whitelisted && urlhausApikey && mayTransmitExternally()) {
        try {
            sources.urlhaus = await checkURLhaus(domain, urlhausApikey);
            sources.unknown = false;
        } catch (e) { Logger.warn('URLhaus check at click time failed', e); }
    }

    if (!whitelisted && urlscanApikey && mayTransmitExternally() && local.level !== 'clean') {
        try {
            const result = await checkUrlscanIo(url, urlscanApikey, LINK_GATE_LIVE_SCAN_BUDGET_MS);
            if (result && result.status !== 'ERROR' && result.status !== 'TIMEOUT') {
                sources.urlscan = result;
                sources.unknown = false;
            }
        } catch (e) { Logger.warn('urlscan.io check at click time failed', e); }
    }

    // Gespeicherter Hybrid-Analysis-Befund (schnell, offline): der Hintergrund
    // Scan fuellt diesen Cache bereits.
    try {
        const message = await getFirstDisplayedMessage(request.tabId || null);
        if (message && message.headerMessageId) {
            const db = await getSharedDB();
            const record = await getFromStore(db, "hybridanalysis", message.headerMessageId);
            if (record && Array.isArray(record.links)) {
                for (const link of record.links) {
                    if (link && link.url === url && link.state && link.state !== 'UNKNOWN') {
                        sources.hybrid = link.state;
                        sources.unknown = false;
                        break;
                    }
                }
            }
        }
    } catch (e) { /* Cache ist optional */ }

    const decision = engine && typeof engine.decide === 'function'
        ? engine.decide({ local: local, urlhaus: sources.urlhaus, urlscan: sources.urlscan, hybrid: sources.hybrid, mode: linkGateMode })
        : conservativeGateDecision(local, sources);

    await logGateDecision({ url: url, host: domain, action: decision.action, level: decision.level, override: false, source: 'check' });

    return {
        status: gateStatusFor(decision),
        action: decision.action,
        level: decision.level,
        score: decision.score,
        reasons: decision.reasons,
        sources: sources
    };
}

/**
 * Rueckwaerts-kompatibler Status (das Popup und aeltere Aufrufer kennen diese
 * Werte), abgeleitet aus der Entscheidung.
 */
function gateStatusFor(decision) {
    if (!decision) return 'UNKNOWN';
    if (decision.action === 'block') return 'MALICIOUS';
    if (decision.action === 'warn') return 'SUSPICIOUS';
    if (decision.action === 'allow' && decision.level === 'clean') return 'CLEAN';
    return 'UNKNOWN';
}

/**
 * Fallback, wenn die Engine fehlt: im Zweifel warnen, aber nie stillschweigend
 * freigeben (fail-safe statt fail-open).
 */
function conservativeGateDecision(local, sources) {
    const reasons = (local && local.reasons) ? local.reasons.slice() : [];
    if (sources && sources.urlhaus === true) {
        return { action: 'block', level: 'critical', score: 100, reasons: reasons.concat(['Die Domain steht auf der URLhaus-Malware-Liste.']), sources: sources };
    }
    return { action: 'warn', level: (local && local.level) || 'unknown', score: (local && local.score) || 0, reasons: reasons, sources: sources };
}


/**
 * Oeffnet ein Compose-Fenster mit der fertigen Vorlage. `compose` ist eine
 * eigene Manifest-Berechtigung; fehlt sie oder die API, wird das dem Aufrufer
 * gemeldet, damit die Oberflaeche den Text zum Kopieren anbieten kann.
 */
async function openComposeWithTemplate(template) {
    const to = (template && Array.isArray(template.to)) ? template.to.filter(Boolean) : [];
    if (to.length === 0) return { success: false, reason: 'no_admin_contact' };
    try {
        if (!browser.compose || typeof browser.compose.beginNew !== 'function') {
            return { success: false, reason: 'compose_failed' };
        }
        await browser.compose.beginNew({
            to: to,
            subject: template.subject || '',
            body: template.body || '',
            isPlainText: true
        });
        return { success: true, recipients: to };
    } catch (e) {
        Logger.error('Could not open the compose window', e);
        return { success: false, reason: 'compose_failed' };
    }
}

function adminContactPayload() {
    return {
        emails: Array.isArray(adminEmails) ? adminEmails.slice() : [],
        phone: adminPhone || '',
        name: adminContactName || '',
        organization: adminOrganization || ''
    };
}


/**
 * Erzeugt die ausfuehrliche Erstbewertung fuer den Administrator und oeffnet die
 * Vorlage. Quelle ist die zuletzt berechnete Bewertung des Tabs bzw. eine
 * frische Auswertung der angezeigten Nachricht.
 */
async function handleAdminReportRequest(request, sender) {
    const tabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : (request && request.tabId) || null;
    if (!Array.isArray(adminEmails) || adminEmails.length === 0) {
        notify('notificationTitleError', 'notificationReportNoContact');
        return { success: false, reason: 'no_admin_contact' };
    }
    const report = (typeof ThundyReport !== 'undefined' && ThundyReport) ? ThundyReport : null;
    if (!report || typeof report.buildIncidentReport !== 'function') {
        return { success: false, reason: 'compose_failed' };
    }

    let threat = threatForTab(tabId);
    let message = null;
    try {
        message = await getFirstDisplayedMessage(tabId);
    } catch (e) { message = null; }

    if (!threat && message) {
        threat = await evaluateMessageThreat(message);
    }

    const template = report.buildIncidentReport({
        message: {
            headerMessageId: message ? message.headerMessageId : '',
            subject: message ? message.subject : '',
            author: message ? message.author : '',
            recipient: message ? (message.recipients || []).join(', ') : '',
            date: message ? message.date : ''
        },
        threat: {
            score: threat ? threat.score : 0,
            level: threat ? threat.level : 'unknown',
            reasons: threat ? threat.reasons : [],
            authStatus: threat ? threat.authStatus : 'neutral'
        },
        links: (threat && threat.links) ? threat.links : [],
        attachments: (threat && threat.attachments) ? threat.attachments : [],
        contacts: adminContactPayload(),
        meta: {
            version: browser.runtime.getManifest ? browser.runtime.getManifest().version : '',
            generatedAt: new Date().toISOString(),
            privacyTier: privacyTier,
            consent: externalAnalysisConsent === true,
            gateMode: linkGateMode,
            includeUrls: reportIncludeUrls === true
        }
    });

    const result = await openComposeWithTemplate(template);
    if (!result.success) {
        notify('notificationTitleError', 'notificationReportComposeFailed');
    } else {
        notify('notificationTitle', 'notificationReportStarted', [describeUrlForUser((message && message.subject) || '')]);
    }
    return result;
}

/**
 * Hilfeanforderung aus den Einstellungen ("Template-Hilfe"): der Nutzer fordert
 * mit einem Klick eine Vorlage an, die an den Administrator geht und die
 * Kontaktdaten inklusive Telefonnummer enthaelt.
 */
async function handleHelpTemplateRequest() {
    const report = (typeof ThundyReport !== 'undefined' && ThundyReport) ? ThundyReport : null;
    if (!report || typeof report.buildHelpRequest !== 'function') {
        return { success: false, reason: 'compose_failed' };
    }
    const template = report.buildHelpRequest({
        contacts: adminContactPayload(),
        meta: {
            version: browser.runtime.getManifest ? browser.runtime.getManifest().version : '',
            generatedAt: new Date().toISOString(),
            privacyTier: privacyTier,
            consent: externalAnalysisConsent === true,
            gateMode: linkGateMode
        }
    });
    const result = await openComposeWithTemplate(template);
    return { success: result.success, reason: result.reason, recipients: result.recipients, template: template };
}

/**
 * Vollstaendige Auswertung einer Nachricht ohne UI (fuer den Report, wenn fuer
 * den Tab noch keine Bewertung vorliegt).
 */
async function evaluateMessageThreat(message) {
    try {
        const fullMessage = await browser.messages.getFull(message.id);
        const parsedUrlCache = new Map();
        const messageText = extractTextFromParts(fullMessage.parts || fullMessage);
        const urls = extractUrls(messageText);
        const filteredUrls = filterUrls(urls, parsedUrlCache);
        const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache });
        const threat = calculateThreatScore(message.author, urls, options);
        const senderEmail = extractEmailAddress(message.author || '');
        threat.level = levelFromScore(threat.score);
        threat.evaluated = true;
        threat.messageId = message.id;
        threat.firstContact = options.isFirstCommunication === true;
        threat.replyToMismatch = hasReplyToMismatch(options.replyTo, senderEmail);
        threat.links = buildThreatLinkSummaries(filteredUrls, extractEmailDomain(senderEmail));
        threat.attachments = await collectAttachmentSummaries(message);
        return threat;
    } catch (e) {
        Logger.error('Could not evaluate the message for the report', e);
        return null;
    }
}




async function checkHybridAnalysisVerdict(hybrid_sha256, fallbackState) {
    if (hybrid_sha256 && apikey_hybridanalysis && mayTransmitExternally()) {
        const overviewOptions = getHybridAnalysisOptions('GET');
        overviewOptions.url = 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha256;
        try {
            await requireHostPermission(overviewOptions.url);
            const response = await apiGateway.fetchWithTimeout(overviewOptions.url, overviewOptions);
            const json_data = await response.json();
            if (json_data.verdict) {
                if (json_data.verdict === 'no specific threat') {
                    return 'CLEAN';
                } else {
                    return json_data.verdict.toUpperCase();
                }
            } else {
                return fallbackState;
            }
        } catch (err) {
            return fallbackState;
        }
    } else {
        return fallbackState || 'UNKNOWN';
    }
}

/**
 * Handles a scan request coming from the injected per-message banner.
 * persist === true adds the sender to the persistent opt-in list, otherwise
 * the scan stays a one-off action (no hidden opt-in).
 */
async function handleRequestScan(request, sender) {
    if (!request || !request.messageId) {
        return { success: false, error: 'invalid_request' };
    }

    if (!mayTransmitExternally()) {
        return { success: false, error: EXTERNAL_ANALYSIS_DISABLED, code: EXTERNAL_ANALYSIS_DISABLED };
    }

    // Ensure permission to contact the analysis service
    let granted = await hasHybridPermission();
    if (!granted) {
        try {
            granted = await browser.permissions.request({ origins: [PROVIDER_ORIGINS.hybridanalysis] });
        } catch (e) { granted = false; }
    }

    if (!granted) {
        return { success: false, error: 'permission_denied' };
    }

    if (request.persist === true && request.senderEmail) {
        await addSenderOptIn(request.senderEmail.toLowerCase());
    }

    try {
        const messageObj = { id: request.messageId };
        await processAttachments(messageObj);
        const fullMessage = await browser.messages.getFull(request.messageId);
        const tabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : (request.tabId || null);
        const tab = { id: tabId };
        const parsedUrlCache = new Map();
        const { messageText, urls, filteredUrls } = await processLinks(tab, messageObj, fullMessage, parsedUrlCache);
        await evaluateAndInjectThreats({ tab, message: messageObj, fullMessage, urls, filteredUrls, messageText, parsedUrlCache });
        return { success: true, persisted: request.persist === true };
    } catch (e) {
        Logger.error('requestScan failed', e);
        return { success: false, error: e && e.message ? e.message : String(e), code: e && e.code ? e.code : undefined };
    }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Harden the message boundary: only our own extension contexts may drive the
    // background script (P3-25 in docs/PROBLEMANALYSE_STORE_READINESS.md).
    if (sender && sender.id && sender.id !== browser.runtime.id) {
        Logger.warn('Ignoring a message from a foreign sender', sender.id);
        return false;
    }
    if (!request || typeof request !== 'object') return false;

    switch (request.action) {
        case "uploadAttachment":
            handleManualUpload(request.messageId, request.partName, request.attachmentName, request.hash, request.headerMessageId)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message, code: err.code}));
            return true;

        case "scanUrl":
            handleUrlScan(request.url, request.headerMessageId)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message, code: err.code}));
            return true;

        case "checkLinkState":
            handleCheckLinkState(Object.assign({}, request, {
                tabId: (sender && sender.tab && sender.tab.id) ? sender.tab.id : null
            }))
                .then(res => sendResponse(res))
                .catch(err => sendResponse({ status: 'ERROR', action: 'warn', level: 'unknown', score: 0, reasons: [err.message], sources: {} }));
            return true;

        case "linkGateConfig":
            sendResponse(linkGateConfigPayload());
            return true;

        case "linkGateDecision":
            logGateDecision({
                url: request.url,
                action: request.action,
                level: request.level,
                override: request.override === true,
                source: request.source || 'message-display'
            }).then(logged => sendResponse({ logged: logged === true }));
            return true;

        case "requestAdminReport":
            handleAdminReportRequest(request, sender)
                .then(res => sendResponse(res))
                .catch(err => sendResponse({ success: false, reason: 'compose_failed', message: err.message }));
            return true;

        case "requestHelpTemplate":
            handleHelpTemplateRequest()
                .then(res => sendResponse(res))
                .catch(err => sendResponse({ success: false, reason: 'compose_failed', message: err.message }));
            return true;

        case "requestThreatSummary":
            sendResponse({ threat: threatForTab(sender && sender.tab ? sender.tab.id : null) });
            return true;

        case "downloadDisarmed":
            handleDownloadDisarmed(request.messageId, request.partName, request.attachmentName)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message}));
            return true;

        case "requestScan":
            handleRequestScan(request, sender).then(res => sendResponse(res));
            return true;

        default:
            return false;
    }
});

/**
 * Handles the "downloadDisarmed" message to sanitize and download an HTML attachment.
 * Called dynamically via background messaging (e.g., from api.js).
 *
 * @param {number} messageId - The ID of the message containing the attachment.
 * @param {string} partName - The part name of the attachment.
 * @param {string} [attachmentName] - The optional name of the file to save as.
 * @returns {Promise<{downloadId: number}>} Resolves with the download ID.
 */
async function handleDownloadDisarmed(messageId, partName, attachmentName) {
    let file = await browser.messages.getAttachmentFile(messageId, partName);
    const contentBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const htmlString = decoder.decode(contentBuffer);

    // Disarm the HTML locally
    const safeHtml = disarmHTML(htmlString);

    // Create a blob from the safe HTML
    const blob = new Blob([safeHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Download the file
    // Prevent path traversal by extracting the basename and replacing suspicious characters
    let safeName = attachmentName || 'disarmed.html';
    safeName = safeName.split(/[\/\\]/).pop().replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    if (!/\.html?$/i.test(safeName)) {
        safeName += '.html';
    }
    const downloadId = await browser.downloads.download({
        url: url,
        filename: 'disarmed_' + safeName,
        saveAs: true
    });

    // Revoke object URL after a short delay to free memory, giving download time to start
    const revokeTimeoutId = setTimeout(() => {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(url);
        }
    }, 10000);

    return { downloadId: downloadId };
}

const dangerousAttributes = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

const activeTags = new Set(['script', 'object', 'embed', 'iframe', 'base', 'meta', 'applet', 'link', 'math', 'svg', 'noscript']);

// ⚡ Bolt: Use a direct precompiled regex with bounds and no capturing groups for peak performance
const DANGEROUS_URI_CHARS_REGEX = /[\x00-\x20\x7F-\x9F\xA0\u1680\u180E\u2000-\u2029\u202F\u205F\u3000\u200B-\u200D\uFEFF\uFFFD]/g;
const DANGEROUS_URI_CHARS_TEST_REGEX = /[\x00-\x20\x7F-\x9F\xA0\u1680\u180E\u2000-\u2029\u202F\u205F\u3000\u200B-\u200D\uFEFF\uFFFD]/;

function disarmHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const nodesToRemove = [];

    const safeEl = doc.createElement('div');
    const safeHasAttributes = safeEl.hasAttributes;
    const safeRemoveAttribute = safeEl.removeAttribute;

    let protoForTagName = Object.getPrototypeOf(safeEl);
    while (protoForTagName && !Object.getOwnPropertyDescriptor(protoForTagName, 'tagName')) {
        protoForTagName = Object.getPrototypeOf(protoForTagName);
    }
    const safeGetTagName = Object.getOwnPropertyDescriptor(protoForTagName, 'tagName').get;

    let protoForAttributes = Object.getPrototypeOf(safeEl);
    while (protoForAttributes && !Object.getOwnPropertyDescriptor(protoForAttributes, 'attributes')) {
        protoForAttributes = Object.getPrototypeOf(protoForAttributes);
    }
    const safeGetAttributes = Object.getOwnPropertyDescriptor(protoForAttributes, 'attributes').get;

    let protoForNodeType = Object.getPrototypeOf(safeEl);
    while (protoForNodeType && !Object.getOwnPropertyDescriptor(protoForNodeType, 'nodeType')) {
        protoForNodeType = Object.getPrototypeOf(protoForNodeType);
    }
    const safeGetNodeType = Object.getOwnPropertyDescriptor(protoForNodeType, 'nodeType').get;

    let protoForParentNode = Object.getPrototypeOf(safeEl);
    while (protoForParentNode && !Object.getOwnPropertyDescriptor(protoForParentNode, 'parentNode')) {
        protoForParentNode = Object.getPrototypeOf(protoForParentNode);
    }
    const safeGetParentNode = Object.getOwnPropertyDescriptor(protoForParentNode, 'parentNode').get;

    let protoForRemoveChild = Object.getPrototypeOf(safeEl);
    while (protoForRemoveChild && !Object.getOwnPropertyDescriptor(protoForRemoveChild, 'removeChild')) {
        protoForRemoveChild = Object.getPrototypeOf(protoForRemoveChild);
    }
    const safeRemoveChild = Object.getOwnPropertyDescriptor(protoForRemoveChild, 'removeChild').value;

    const safeTemplate = doc.createElement('template');
    let protoForContent = Object.getPrototypeOf(safeTemplate);
    while (protoForContent && !Object.getOwnPropertyDescriptor(protoForContent, 'content')) {
        protoForContent = Object.getPrototypeOf(protoForContent);
    }
    const safeGetContent = Object.getOwnPropertyDescriptor(protoForContent, 'content').get;

    function processRoot(root) {
        const walker = doc.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);
        let el = walker.currentNode;
        while (el) {
            // For DocumentFragment, nodeType is 11, but SHOW_ELEMENT only shows elements (nodeType 1).
            if (safeGetNodeType.call(el) === 1) {
                const tagName = safeGetTagName.call(el).toLowerCase();
                if (activeTags.has(tagName)) {
                    nodesToRemove.push(el);
                } else {
                    if (safeHasAttributes.call(el)) {
                        const attrs = safeGetAttributes.call(el);
                        for (let j = attrs.length - 1; j >= 0; j--) {
                            const attrName = attrs[j].name.toLowerCase();
                            if (attrName.startsWith('on')) {
                                safeRemoveAttribute.call(el, attrName);
                                continue;
                            }
                            if (dangerousAttributes.has(attrName)) {
                                let val = attrs[j].value.toLowerCase();
                                // Remove control characters (like tabs/newlines) that might evade the check
                                // ⚡ Bolt: Fast test before replacing avoids regex replace string allocation on clean values
                                let cleanVal = DANGEROUS_URI_CHARS_TEST_REGEX.test(val) ? val.replace(DANGEROUS_URI_CHARS_REGEX, '') : val;
                                if (cleanVal.startsWith('javascript:') || cleanVal.startsWith('data:') || cleanVal.startsWith('vbscript:')) {
                                    safeRemoveAttribute.call(el, attrName);
                                }
                            }
                        }
                    }
                    if (tagName === 'template') {
                        const content = safeGetContent.call(el);
                        if (content) {
                            processRoot(content);
                        }
                    }
                }
            }
            el = walker.nextNode();
        }
    }

    processRoot(doc.documentElement);

    // Remove active tags collected during the pass
    for (let i = nodesToRemove.length - 1; i >= 0; i--) {
        const pNode = safeGetParentNode.call(nodesToRemove[i]);
        if (pNode) {
            safeRemoveChild.call(pNode, nodesToRemove[i]);
        }
    }

    return doc.documentElement.outerHTML;
}

async function handleUrlScan(url, headerMessageId) {
    if (!apikey_hybridanalysis) throw new Error("API-Key fehlt.");
    assertExternalAnalysisAllowed();
    // Submitting the full URL to the sandbox is a "max" tier feature (see
    // docs/privacy_policy.md §3.3/§5); the host permission must be granted too.
    if (!tierAtLeast('max')) {
        throw typedError(TIER_REQUIRES_MAX, msg('errorTierUrlScanBlocked'));
    }
    await requireHostPermission('https://hybrid-analysis.com/api/v2/quick-scan/url');

    const formBody = new URLSearchParams();
    formBody.append('scan_type', 'all');
    formBody.append('url', url);

    const options = getHybridAnalysisOptions('POST', formBody, true);
    options.url = 'https://hybrid-analysis.com/api/v2/quick-scan/url';

    const response = await apiGateway.fetchWithTimeout(options.url, options);
    const json_data = await response.json();

    if (response.status === 200 || response.status === 201) {
        // Update DB record
        try {
            const db = await getSharedDB();
            await updateStore(db, 'hybridanalysis', headerMessageId, (existingRecord) => {
                if (existingRecord && existingRecord.links) {
                    // ⚡ Bolt Optimization: Replace .findIndex() with for loop to avoid callback overhead
                    let linkIndex = -1;
                    const links = existingRecord.links;
                    const len = links.length;
                    for (let i = 0; i < len; i++) {
                        if (links[i].url === url) {
                            linkIndex = i;
                            break;
                        }
                    }
                    if (linkIndex > -1) {
                        existingRecord.links[linkIndex].hybrid_submission_id = json_data.submission_id;
                        existingRecord.links[linkIndex].hybrid_job_id = json_data.job_id;
                        existingRecord.links[linkIndex].hybrid_sha256 = json_data.sha256;
                        existingRecord.links[linkIndex].state = 'UPLOADED';
                    }
                }
                return existingRecord;
            });
        } catch (dbError) {
            Logger.error('Fehler beim Aktualisieren des DB Records für URL:', dbError);
        }
        return json_data;
    } else {
        throw new Error("Fehler beim URL-Scan: " + JSON.stringify(json_data));
    }
}

async function handleManualUpload(messageId, partName, attachmentName, hash, headerMessageId) {
    if (!apikey_hybridanalysis) throw new Error("API-Key fehlt.");
    assertExternalAnalysisAllowed();
    // Uploading the full file is only allowed from "balanced" upwards; the tier
    // applies to manual actions as well (see docs/privacy_policy.md §3.3/§5).
    if (!tierAtLeast('balanced')) {
        throw typedError(TIER_BLOCKS_UPLOAD, msg('errorTierUploadBlocked'));
    }
    await requireHostPermission('https://hybrid-analysis.com/api/v2/quick-scan/file');

    let file = await browser.messages.getAttachmentFile(messageId, partName);
    const content_of_atachment = file.slice();
    const file_to_submit = new File([content_of_atachment], attachmentName, { type: file.type || 'application/octet-stream' });

    const formData = new FormData();
    formData.append('scan_type', 'all');
    formData.append('file', file_to_submit);

    const options = getHybridAnalysisOptions('POST', formData);
    options.url = 'https://hybrid-analysis.com/api/v2/quick-scan/file';

    const response = await apiGateway.fetchWithTimeout(options.url, options, 60000);
    const json_data = await response.json();

    if (response.status === 200 || response.status === 201) {
        // Update DB record
        try {
            const db = await getSharedDB();
            await updateStore(db, 'hybridanalysis', headerMessageId, (existingRecord) => {
                if (existingRecord && existingRecord.attachments) {
                    // ⚡ Bolt Optimization: Replace .findIndex() with for loop to avoid callback overhead
                    let attIndex = -1;
                    const attachments = existingRecord.attachments;
                    const len = attachments.length;
                    for (let i = 0; i < len; i++) {
                        if (attachments[i].partName === partName) {
                            attIndex = i;
                            break;
                        }
                    }
                    if (attIndex > -1) {
                        existingRecord.attachments[attIndex].hybrid_submission_id = json_data.submission_id;
                        existingRecord.attachments[attIndex].hybrid_job_id = json_data.job_id;
                        existingRecord.attachments[attIndex].state = 'UPLOADED';
                    }
                }
                return existingRecord;
            });
        } catch (dbError) {
            Logger.error('Fehler beim Aktualisieren des DB Records:', dbError);
        }
        return json_data;
    } else {
        throw new Error("Fehler beim Upload: " + JSON.stringify(json_data));
    }
}

async function checkVirusTotal(hash, apikey) {
    if (!apikey) return null;
    if (!mayTransmitExternally()) return null;
    if (vtCache.has(hash)) {
        return await vtCache.get(hash);
    }

    let checkPromise = (async () => {
        const url = `https://www.virustotal.com/api/v3/files/${hash}`;
        const options = {
            method: 'GET',
            headers: {
                'x-apikey': apikey,
                'accept': 'application/json'
            }
        };
        try {
            await requireHostPermission(url);
            const response = await apiGateway.fetchWithTimeout(url, options);
            if (response.status === 200) {
                const data = await response.json();
                if (data && data.data && data.data.attributes && data.data.attributes.last_analysis_stats) {
                    return data.data.attributes.last_analysis_stats;
                }
            }
            return null;
        } catch (e) {
            Logger.error("Fehler bei VirusTotal Abfrage:", e);
            return null;
        }
    })();

    if (vtCache.size >= MAX_VT_CACHE_SIZE) {
        const firstKey = vtCache.keys().next().value;
        vtCache.delete(firstKey);
    }
    vtCache.set(hash, checkPromise);

    let stats = await checkPromise;
    if (stats === null) {
        // Remove from cache on failure so it can be retried
        vtCache.delete(hash);
    }
    return stats;
}

async function checkURLhaus(domain, apikey) {
    if (!apikey) return false;
    if (!mayTransmitExternally()) return false;
    await requireHostPermission('https://urlhaus-api.abuse.ch/v1/host/');
    try {
        const body = new URLSearchParams();
        body.append('host', domain);
        const response = await apiGateway.fetchWithTimeout('https://urlhaus-api.abuse.ch/v1/host/', {
            method: 'POST',
            headers: {
                'Auth-Key': apikey,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });
        const data = await response.json();
        if (data.query_status === 'ok' && data.url_count > 0) {
            return true;
        }
    } catch (e) {
        Logger.error("Fehler bei URLhaus Abfrage", e);
    }
    return false;
}

async function checkUrlscanIo(url, apikey, maxWaitMs) {
    if (!apikey) return null;
    if (!mayTransmitExternally()) return null;
    try {
        await requireHostPermission('https://urlscan.io/api/v1/scan/');
        // Start Scan
        // 🛡️ Sentinel: Prevent sensitive URL leakage by defaulting to 'unlisted' instead of 'public' visibility
        const scanRes = await apiGateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/', {
            method: 'POST',
            headers: {
                'API-Key': apikey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url, visibility: 'unlisted' })
        });

        if (scanRes.status === 400) {
           Logger.error("urlscan.io API Error 400 (e.g. Domain not resolvable)", await scanRes.json());
           return { status: 'ERROR', details: 'Domain not resolvable' };
        }

        if (!scanRes.ok) throw new Error("Fehler beim Starten des Scans (urlscan.io): " + scanRes.status);

        const scanData = await scanRes.json();
        const uuid = scanData.uuid;

        if (!uuid) throw new Error("Keine UUID von urlscan.io erhalten.");

        return await pollUrlscanIoResult(uuid, maxWaitMs);
    } catch (e) {
        Logger.error("Fehler bei urlscan.io Abfrage", e);
        return { status: 'ERROR', details: e.message };
    }
}

async function pollUrlscanIoResult(uuid, maxWaitMs) {
    let waitTime = 2000;
    let elapsed = 0;
    // Klick-Gate: kurzes Budget, damit ein Link-Klick nicht 30 Sekunden haengt.
    const budget = (typeof maxWaitMs === 'number' && maxWaitMs > 0) ? maxWaitMs : 30000;
    const maxTime = budget;

    while (elapsed < maxTime) {
        await new Promise(r => setTimeout(r, waitTime));
        elapsed += waitTime;
        waitTime = Math.min(waitTime * 1.5, 10000); // 1.5x backoff, max 10s

        const resultRes = await apiGateway.fetchWithTimeout(`https://urlscan.io/api/v1/result/${uuid}/`);
        if (resultRes.status === 200) {
            const resultData = await resultRes.json();

            let isMalicious = false;
            let reasons = [];

            if (resultData.verdicts && resultData.verdicts.overall && resultData.verdicts.overall.malicious) {
                isMalicious = true;
                reasons.push("Die URL wurde von urlscan.io generell als bösartig eingestuft.");
            }

            if (resultData.verdicts && resultData.verdicts.urlscan && resultData.verdicts.urlscan.brands && resultData.verdicts.urlscan.brands.length > 0) {
                 // Check if it's visually trying to spoof a brand
                 if (resultData.verdicts.urlscan.malicious) {
                    isMalicious = true;
                    reasons.push("Visuelle Erkennung: Die Seite gibt sich als " + resultData.verdicts.urlscan.brands.join(', ') + " aus (Phishing-Verdacht).");
                 }
            }

            if (isMalicious) {
                return { status: 'MALICIOUS_VISUAL', reasons: reasons };
            } else {
                return { status: 'CLEAN' };
            }
        } else if (resultRes.status === 404) {
            // Not ready yet, continue polling
        } else {
            throw new Error("Fehler beim Abrufen der Ergebnisse (urlscan.io): " + resultRes.status);
        }
    }

    return { status: 'TIMEOUT' }; // Took too long
}
