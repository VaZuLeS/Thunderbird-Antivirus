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
    bannerOpenOptions: 'Open options',
    bannerSenderOptIn: 'This sender is now scanned automatically.',
    errorHostPermissionMissing: 'Host permission for the analysis service is missing. Please grant it in the add-on options.',
    errorTierUploadBlocked: 'Uploading attachments is disabled in the privacy tier "Strict". Switch to "Balanced" or "Maximum" in the add-on options.',
    errorTierUrlScanBlocked: 'Submitting URLs is only allowed in the privacy tier "Maximum". Change the tier in the add-on options.',
    notificationInjectionFailed: 'The banner could not be inserted into the message view. Please report this with your Thunderbird version.',
    bannerTierBlocked: 'This action is not allowed by the current privacy tier. See the add-on options.',
    notificationScanStarted: 'Scan started for: $URL$',
    notificationScanRunning: 'Scanning "$SUBJECT$" …',
    notificationScanProgress: 'Link $DONE$ of $TOTAL$ submitted …',
    notificationScanLinksChecked: '$COUNT$ link(s) checked, analysis running …',
    notificationFallbackSubject: 'the open message',
    notificationScanSubmitted: 'Scan submitted successfully. Job ID: $JOBID$',
    notificationScanResult: 'Result: $VERDICT$ (risk score $SCORE$ of 100)',
    notificationClickHint: 'Click the notification to open the message.',
    notificationScanError: 'Scan error: $ERROR$',
    verdictClean: 'checked, no findings',
    verdictUnclear: 'unclear, please verify',
    verdictSuspicious: 'suspicious',
    verdictMalicious: 'malicious indicators',
    researchRuleLists: 'Custom black/whitelist',
    researchRuleAuth: 'Authentication (SPF/DKIM/DMARC)',
    researchRuleUrlhaus: 'URLhaus domain reputation',
    researchRuleReplyTo: 'Reply-To deviation',
    researchRuleBehavior: 'Content and urgency heuristics',
    researchRuleSenderDomain: 'Sender domain / brand look-alike',
    researchRuleLinks: 'Link analysis',
    timelineMessageDate: 'Message date',
    timelineHop: 'Received hop',
    timelineSuspiciousDelay: 'unusual delay',
    timelineLocalAssessment: 'Local assessment',
    timelineLocalAssessmentDetail: 'risk score $SCORE$ of 100 – $VERDICT$',
    selftestApiLabel: 'API available',
    selftestApiMissingDetail: 'This Thunderbird build does not expose the API – please report the version.',
    selftestConsentBlocked: 'Consent gate blocks transmission',
    selftestConsentBlockedDetail: 'without consent every transmission path must abort with EXTERNAL_ANALYSIS_DISABLED',
    selftestTierGates: 'Privacy tier gates work',
    selftestTierGatesDetail: 'strict blocks upload and URL scan, balanced allows upload, max allows both',
    selftestVerdictThresholds: 'Verdict thresholds',
    selftestAuthParser: 'Authentication-Results parser',
    selftestReceivedParser: 'Received chain parser (hops and delays)',
    selftestLinkAnatomy: 'Link anatomy (shortener, tracking, look-alike)',
    selftestIocs: 'IOC extraction',
    selftestAttachments: 'Attachment classification',
    selftestLedger: 'Risk score ledger',
    selftestMitre: 'MITRE ATT&CK mapping (heuristic)',
    selftestTimeline: 'Dossier timeline',
    selftestEntries: 'entries',
    selftestInjection: 'Banner injection into the message view',
    selftestInjectionNoMessage: 'No message is open – open a message and run the self-test again for this check.',
    selftestInjectionOkDetail: 'A probe script was injected into the open message and returned its result.',
    selftestInjectionFailedDetail: 'Injection failed – please report this together with the Thunderbird version.',
    selftestNotifications: 'Notification round-trip',
    selftestNotificationTitle: 'Thundy AV self-test',
    selftestNotificationMessage: 'Test notification created and removed again.',
    selftestProviderPermission: 'Host permission granted for',
    selftestProviderPermissionMissing: 'Host permission missing for',
    selftestConsentNotice: 'External analysis is switched off',
    selftestConsentNoticeDetail: 'Provider keys are configured but the global consent is off – nothing is transmitted.',
    selftestNote: 'All checks run locally on synthetic data; nothing is transmitted. The visual appearance of the banners and the permission dialogs still have to be checked by hand (docs/live_test_protocol.md).',
    selftestReportTitle: 'Self-test report',
    selftestReportStarted: 'Started',
    selftestReportResult: 'Result',
    notificationTitle: 'Thundy AV Scanner',
    notificationTitleError: 'Thundy AV Scanner error',
    notificationNoLinks: 'No links found in this message.'
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
    // Generic placeholder handling: $SCORE$, $URL$, $JOBID$, $ERROR$, $SUBJECT$,
    // $VERDICT$ … are filled in the order in which they appear.
    text = text.replace(/\$([A-Z0-9_]+)\$/g, () => (values.length ? String(values.shift()) : ''));
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
    const result = await browser.storage.local.get(['apikey', 'virustotalApikey', 'privacyTier', 'urlhausApikey', 'urlscanApikey', 'alwaysManual', 'autoScanLinks', 'timeOfClickProtection', 'ipReputationProvider', 'ipReputationApiKey', 'customBlacklist', 'customWhitelist', 'externalAnalysisConsent']);
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
    // Scoring ledger: every stage records how many points it contributed and which
    // reasons it added. The researcher view (and the notifications) show this
    // breakdown instead of just a total that nobody can reconstruct.
    const breakdown = [];

    let email = extractEmailAddress(author);
    let senderDomain = extractEmailDomain(email);

    const listCheck = checkLists(email, senderDomain);
    if (listCheck) {
        return {
            score: listCheck.score,
            reasons: listCheck.reasons,
            authStatus: 'neutral',
            verdict: verdictForScore(listCheck.score),
            breakdown: [{
                id: 'lists',
                label: msg('researchRuleLists'),
                points: listCheck.score,
                reasons: listCheck.reasons
            }]
        };
    }

    const runStage = (id, labelKey, stageFn) => {
        const scoreBefore = score;
        const reasonsBefore = reasons.length;
        score = stageFn();
        const points = score - scoreBefore;
        const stageReasons = reasons.slice(reasonsBefore);
        if (points !== 0 || stageReasons.length > 0) {
            breakdown.push({ id, label: msg(labelKey), points, reasons: stageReasons });
        }
    };

    let authStatus = 'neutral';
    runStage('auth', 'researchRuleAuth', () => {
        const authEval = evaluateAuthHeaders(authHeaders, score, reasons);
        authStatus = authEval.authStatus;
        return authEval.score;
    });
    runStage('urlhaus', 'researchRuleUrlhaus', () => evaluateUrlhaus(urlhausDomains, score, reasons));
    runStage('replyto', 'researchRuleReplyTo', () => evaluateReplyTo(replyTo, senderDomain, score, reasons));
    runStage('behavior', 'researchRuleBehavior', () => evaluateBehavior(subject, messageText, isFirstCommunication, score, reasons));

    let senderMainDomain = '';
    runStage('sender', 'researchRuleSenderDomain', () => {
        const senderEval = evaluateSenderDomain(senderDomain, score, reasons);
        senderMainDomain = senderEval.senderMainDomain;
        return senderEval.score;
    });

    runStage('links', 'researchRuleLinks', () => evaluateLinks({
        urls,
        senderDomain,
        senderMainDomain,
        score,
        reasons,
        parsedUrlCache
    }));

    const total = Math.min(score, 100);
    return {
        score: total,
        rawScore: score,
        reasons: reasons,
        authStatus: authStatus,
        verdict: verdictForScore(total),
        breakdown
    };
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
 * Injected banners cannot use theme.css (they live in the message display
 * document), so the palette is duplicated here - it must stay in sync with the
 * severity tokens in theme.css (see docs/design_system.md).
 */
const BANNER_PALETTE = {
    light: {
        critical: { fg: '#b3261e', bg: '#fdecea' },
        high: { fg: '#b45309', bg: '#fdf3e3' },
        medium: { fg: '#a16207', bg: '#fdf8e3' },
        low: { fg: '#1f7a3f', bg: '#eaf6ee' },
        info: { fg: '#0b5fa5', bg: '#e8f1fb' }
    },
    dark: {
        critical: { fg: '#ff8a80', bg: '#3a1d1b' },
        high: { fg: '#ffc078', bg: '#3a2a16' },
        medium: { fg: '#ffd666', bg: '#3a3416' },
        low: { fg: '#7ee2a8', bg: '#16301f' },
        info: { fg: '#7cc4ff', bg: '#16283a' }
    }
};

function severityForScore(score) {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
}

/**
 * The injected banner cannot read CSS media queries for its inline palette, so
 * the colour scheme is chosen from the user's preference.
 */
function prefersDarkScheme() {
    try {
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches === true;
        }
    } catch (e) { /* fall back to the light palette */ }
    return false;
}

async function injectThreatBanner(tabId, threat) {
    if (threat.score >= 50 || threat.authStatus === 'pass') {
        await injectIntoMessageDisplay(tabId, function(score, reasons, authStatus, severity, palette, verdictText) {
                const t = (key, fallback, subs) => {
                    try {
                        return browser.i18n.getMessage(key, subs) || fallback;
                    } catch (e) {
                        return fallback;
                    }
                };
                const existing = document.getElementById('thundy-threat-banner') || document.getElementById('thundy-auth-badge');
                if (existing) existing.remove();

                if (score >= 50) {
                    // Sichere DOM-Manipulation ohne innerHTML
                    const banner = document.createElement('div');
                    banner.id = 'thundy-threat-banner';
                    banner.setAttribute('role', 'alert');
                    banner.setAttribute('aria-live', 'assertive');
                    banner.style.backgroundColor = palette.bg;
                    banner.style.border = '1px solid ' + palette.fg;
                    banner.style.borderLeft = '6px solid ' + palette.fg;
                    banner.style.color = palette.fg;
                    banner.style.padding = '12px 14px';
                    banner.style.margin = '10px';
                    banner.style.borderRadius = '8px';
                    banner.style.fontFamily = 'system-ui, Arial, sans-serif';
                    banner.style.fontSize = '14px';
                    banner.style.lineHeight = '1.45';
                    banner.style.zIndex = '9999';

                    const header = document.createElement('div');
                    header.style.display = 'flex';
                    header.style.alignItems = 'baseline';
                    header.style.gap = '10px';
                    header.style.flexWrap = 'wrap';

                    const scoreBadge = document.createElement('span');
                    scoreBadge.id = 'thundy-threat-score';
                    scoreBadge.textContent = String(score) + '/100';
                    scoreBadge.style.display = 'inline-block';
                    scoreBadge.style.padding = '2px 10px';
                    scoreBadge.style.borderRadius = '999px';
                    scoreBadge.style.backgroundColor = palette.fg;
                    scoreBadge.style.color = palette.bg;
                    scoreBadge.style.fontWeight = '700';
                    scoreBadge.style.fontSize = '13px';
                    scoreBadge.style.fontVariantNumeric = 'tabular-nums';
                    header.appendChild(scoreBadge);

                    const title = document.createElement('strong');
                    title.textContent = t('bannerThreatTitle', 'Thundy AV warning');
                    title.style.fontSize = '15px';
                    header.appendChild(title);

                    const verdict = document.createElement('span');
                    verdict.textContent = verdictText;
                    verdict.style.fontWeight = '600';
                    header.appendChild(verdict);

                    banner.appendChild(header);

                    const reasonList = document.createElement('ul');
                    reasonList.style.margin = '0';
                    reasonList.style.paddingLeft = '20px';
                    reasonList.style.fontSize = '14px';

                    for (const reason of reasons) {
                        const li = document.createElement('li');
                        li.textContent = reason;
                        reasonList.appendChild(li);
                    }
                    banner.appendChild(reasonList);

                    const footer = document.createElement('div');
                    footer.style.marginTop = '8px';
                    footer.style.fontSize = '12px';
                    footer.style.opacity = '0.85';
                    footer.textContent = t('bannerThreatHint', 'Open the Thundy AV button in the message toolbar for the full researcher view (headers, IOCs, MITRE mapping, export).');
                    banner.appendChild(footer);

                    document.body.prepend(banner);
                } else if (authStatus === 'pass') {
                    const badge = document.createElement('div');
                    badge.id = 'thundy-auth-badge';
                    badge.setAttribute('role', 'status');
                    badge.style.display = 'inline-block';
                    badge.style.backgroundColor = palette.bg;
                    badge.style.border = '1px solid ' + palette.fg;
                    badge.style.color = palette.fg;
                    badge.style.padding = '5px 12px';
                    badge.style.margin = '10px';
                    badge.style.borderRadius = '999px';
                    badge.style.fontWeight = '600';
                    badge.style.fontFamily = 'system-ui, Arial, sans-serif';
                    badge.style.fontSize = '12px';
                    badge.style.zIndex = '9999';
                    badge.textContent = t('bannerAuthPass', 'Sender verified (SPF/DKIM/DMARC passed)');

                    document.body.prepend(badge);
                }
        }, [threat.score, threat.reasons, threat.authStatus, severityForScore(threat.score),
            BANNER_PALETTE[prefersDarkScheme() ? 'dark' : 'light'], verdictLabel(threat.verdict)]);
    }
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
  await injectThreatBanner(tab.id, threat);
  return threat;
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

// ---------------------------------------------------------------------------
// Researcher dossier
//
// Everything below is local processing of the message the user has opened: no
// additional network access and no additional permissions (messagesRead +
// storage already cover it). The dossier is what the researcher view in the
// message-display popup renders and what the export functions serialise.
// ---------------------------------------------------------------------------

// Heuristic MITRE ATT&CK mapping. It maps *local indicators* (heuristics) to the
// technique they would belong to if the message were malicious - it is explicitly
// not a detection and must be presented as "heuristic".
const MITRE_TECHNIQUES = {
    spearphishingAttachment: { id: 'T1566.001', name: 'Spearphishing Attachment', tactic: 'Initial Access' },
    spearphishingLink: { id: 'T1566.002', name: 'Spearphishing Link', tactic: 'Initial Access' },
    phishing: { id: 'T1566', name: 'Phishing', tactic: 'Initial Access' },
    userExecutionFile: { id: 'T1204.002', name: 'User Execution: Malicious File', tactic: 'Execution' },
    userExecutionLink: { id: 'T1204.001', name: 'User Execution: Malicious Link', tactic: 'Execution' },
    masquerading: { id: 'T1036.005', name: 'Masquerading: Match Legitimate Name or Location', tactic: 'Defense Evasion' },
    impersonation: { id: 'T1656', name: 'Impersonation', tactic: 'Defense Evasion' },
    obfuscatedFiles: { id: 'T1027', name: 'Obfuscated Files or Information', tactic: 'Defense Evasion' },
    archiveCollected: { id: 'T1560.001', name: 'Archive Collected Data: Archive via Utility', tactic: 'Collection' }
};

// Extensions a security researcher reacts to in an e-mail attachment.
const RISKY_ATTACHMENT_EXTENSIONS = [
    'exe', 'scr', 'com', 'pif', 'bat', 'cmd', 'ps1', 'psm1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
    'hta', 'jar', 'lnk', 'iso', 'img', 'vhd', 'msi', 'msp', 'dll', 'cpl', 'reg', 'docm', 'xlsm', 'pptm',
    'dotm', 'xlam', 'svg', 'html', 'htm', 'chm', 'apk', 'dmg', 'one', 'iqy', 'slk', 'xll'
];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'gz', 'bz2', 'xz', 'tar', 'cab', 'arj', 'lzh', 'ace'];
// Hosts that only exist to shorten/redirect a link.
const URL_SHORTENER_HOSTS = new Set([
    'bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly',
    'lnkd.in', 'rb.gy', 'shorturl.at', 't.ly', 's.id', 'tiny.cc', 'urlz.fr', 'shorte.st', 'adf.ly'
]);
// Query parameters that usually carry tracking/identifiers rather than content.
const TRACKING_PARAMETERS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'mc_eid', 'mkt_tok', 'uid', 'userid', 'subscriber', 'token', 'ref', 'redirect'];

function getFileExtension(name) {
    const clean = String(name || '').split(/[?#]/)[0];
    const index = clean.lastIndexOf('.');
    return index === -1 ? '' : clean.slice(index + 1).toLowerCase();
}

function isRiskyAttachmentName(name) {
    return RISKY_ATTACHMENT_EXTENSIONS.includes(getFileExtension(name));
}

function isArchiveAttachmentName(name) {
    return ARCHIVE_EXTENSIONS.includes(getFileExtension(name));
}

/**
 * Checks whether a registrable domain is a look-alike of one of the known brands
 * (the same Levenshtein heuristic the score uses, but pure - no reasons array).
 */
function findBrandLookalike(mainDomain) {
    if (!mainDomain || KNOWN_BRANDS_SET.has(mainDomain)) return null;
    for (const brand of KNOWN_BRANDS) {
        if (Math.abs(brand.length - mainDomain.length) > 3) continue;
        if (levenshteinDistance(mainDomain, brand) <= 2) return brand;
    }
    return null;
}

/**
 * Breaks a URL down into the parts a researcher looks at.
 */
function analyseLinkAnatomy(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const mainDomain = getMainDomain(host);
        const labels = host.split('.');
        const trackingParameters = [];
        for (const parameter of TRACKING_PARAMETERS) {
            if (parsed.searchParams.has(parameter)) trackingParameters.push(parameter);
        }
        return {
            url: url,
            scheme: parsed.protocol.replace(':', ''),
            host: host,
            registrableDomain: mainDomain,
            tld: labels.length > 1 ? labels[labels.length - 1] : '',
            port: parsed.port || null,
            path: parsed.pathname,
            isPunycode: host.includes('xn--') || /[^\u0000-\u007f]/.test(host),
            brandLookalike: findBrandLookalike(mainDomain),
            trackingParameters: trackingParameters,
            isShortener: URL_SHORTENER_HOSTS.has(host) || URL_SHORTENER_HOSTS.has(mainDomain),
            hasCredentials: parsed.username !== '' || parsed.password !== '',
            isHttps: parsed.protocol === 'https:'
        };
    } catch (e) {
        return { url: url, invalid: true };
    }
}

/**
 * Parses `Authentication-Results` and `Received-SPF` headers into a flat result.
 */
function parseAuthenticationResults(authHeaders = [], spfHeaders = []) {
    const result = { spf: null, dkim: [], dmarc: null, spoofingSuspect: false, raw: [], spfRaw: [] };
    for (const header of authHeaders) {
        const text = String(header);
        result.raw.push(text);
        for (const chunk of text.split(';')) {
            const match = chunk.trim().match(/^(spf|dkim|dmarc)\s*=\s*([a-z]+)/i);
            if (!match) continue;
            const name = match[1].toLowerCase();
            const value = match[2].toLowerCase();
            if (name === 'dkim') result.dkim.push(value);
            else if (result[name] === null) result[name] = value;
            else if (result[name] !== value) result[name] = result[name] + ',' + value;
        }
    }
    for (const header of spfHeaders) {
        const text = String(header);
        result.spfRaw.push(text);
        const match = text.match(/^(pass|fail|softfail|neutral|none|temperror|permerror)/i);
        if (match && (result.spf === null || result.spf === 'none')) result.spf = match[1].toLowerCase();
    }
    const failing = (value) => typeof value === 'string' && /fail|permerror/.test(value);
    result.spoofingSuspect = failing(result.spf) || failing(result.dmarc) || result.dkim.some(failing);
    return result;
}

/**
 * Parses the `Received` chain. Received headers are prepended by every hop, so
 * they are ordered newest-first; the delay between two hops is one of the few
 * timing signals a mail header offers (long or negative delays are interesting).
 */
function parseReceivedChain(receivedHeaders = []) {
    const hops = receivedHeaders.map((raw, index) => {
        const text = String(raw).replace(/\s+/g, ' ');
        const from = text.match(/\bfrom\s+([^\s;()]+)/i);
        const by = text.match(/\bby\s+([^\s;()]+)/i);
        const ip = text.match(/\[?((?:\d{1,3}\.){3}\d{1,3})\]?/);
        const protocol = text.match(/\bwith\s+([A-Za-z0-9+._-]+)/i);
        const datePart = text.split(';').pop().trim();
        const parsedDate = Date.parse(datePart);
        return {
            index: index,
            from: from ? from[1] : null,
            by: by ? by[1] : null,
            ip: ip ? ip[1] : null,
            protocol: protocol ? protocol[1] : null,
            timestamp: Number.isNaN(parsedDate) ? null : new Date(parsedDate).toISOString(),
            raw: text.length > 400 ? text.slice(0, 400) + '…' : text
        };
    });

    const chronological = hops
        .filter((hop) => hop.timestamp)
        .slice()
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    for (let i = 1; i < chronological.length; i += 1) {
        const delay = (Date.parse(chronological[i].timestamp) - Date.parse(chronological[i - 1].timestamp)) / 1000;
        chronological[i].delaySeconds = Math.round(delay);
        chronological[i].delaySuspicious = delay < 0 || delay > 3600;
    }
    return hops;
}

/**
 * Extracts the indicators of compromise that are visible in the message itself
 * (no external lookup). Everything is de-duplicated and capped so the export
 * stays usable.
 */
function extractIocs(messageText = '', urls = []) {
    const iocs = { urls: [], domains: [], ips: [], hashes: [], emails: [] };
    const seen = new Set();
    const limit = 100;
    const add = (bucket, value) => {
        const text = String(value || '').trim().toLowerCase();
        if (!text || seen.has(bucket + '|' + text) || iocs[bucket].length >= limit) return;
        seen.add(bucket + '|' + text);
        iocs[bucket].push(text);
    };

    for (const url of urls) {
        add('urls', url);
        try { add('domains', new URL(url).hostname); } catch (e) { /* ignore */ }
    }
    const body = String(messageText || '');
    for (const match of body.matchAll(/\b((?:\d{1,3}\.){3}\d{1,3})\b/g)) add('ips', match[1]);
    for (const match of body.matchAll(/\b([a-f0-9]{64})\b/gi)) add('hashes', match[1]);
    for (const match of body.matchAll(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)) add('emails', match[1]);
    for (const match of body.matchAll(/\b((?:[a-z0-9-]+\.)+(?:[a-z]{2,}))\b/gi)) {
        const candidate = match[1].toLowerCase();
        // Skip the documentation/example infrastructure the test data uses.
        if (candidate.endsWith('.example') || candidate.endsWith('example.com')) continue;
        add('domains', candidate);
    }
    return iocs;
}

/**
 * Maps the local indicators to MITRE ATT&CK techniques. This is a *heuristic*
 * hint for the analyst - not a detection and not a statement that an attack
 * happened.
 */
function mapMitreTechniques({ breakdown = [], attachments = [], links = [], authentication = {}, sender = {} } = {}) {
    const found = new Map();
    const addTechnique = (key, evidence) => {
        const technique = MITRE_TECHNIQUES[key];
        if (!technique) return;
        if (!found.has(technique.id)) {
            found.set(technique.id, {
                id: technique.id,
                name: technique.name,
                tactic: technique.tactic,
                confidence: 'heuristic',
                evidence: []
            });
        }
        const entry = found.get(technique.id);
        if (evidence && entry.evidence.length < 5 && !entry.evidence.includes(evidence)) {
            entry.evidence.push(evidence);
        }
    };

    const riskyAttachments = attachments.filter((attachment) => isRiskyAttachmentName(attachment.name));
    if (riskyAttachments.length > 0) {
        addTechnique('spearphishingAttachment', riskyAttachments.map((a) => a.name).join(', '));
        addTechnique('userExecutionFile', 'risky attachment type: ' + riskyAttachments.map((a) => getFileExtension(a.name)).join(', '));
    }
    const archiveAttachments = attachments.filter((attachment) => isArchiveAttachmentName(attachment.name));
    if (archiveAttachments.length > 0) {
        addTechnique('archiveCollected', archiveAttachments.map((a) => a.name).join(', '));
        addTechnique('obfuscatedFiles', 'payload delivered inside an archive');
    }
    const lookalikeLinks = links.filter((link) => link.brandLookalike || link.isPunycode);
    if (lookalikeLinks.length > 0) {
        addTechnique('spearphishingLink', lookalikeLinks.map((l) => l.host).slice(0, 3).join(', '));
        addTechnique('masquerading', 'look-alike domain: ' + lookalikeLinks.map((l) => l.host).slice(0, 3).join(', '));
    }
    if (links.some((link) => link.isShortener)) {
        addTechnique('userExecutionLink', 'link shortener used');
    }
    if (links.some((link) => (link.trackingParameters || []).length > 0)) {
        addTechnique('phishing', 'tracking parameters in the link (bulk phishing infrastructure)');
    }
    if (sender.displayNameMismatch || sender.replyToMismatch || sender.displayNameLookalike) {
        addTechnique('impersonation', sender.displayNameMismatch
            ? 'display name differs from the address'
            : 'Reply-To domain differs from the sender domain');
        addTechnique('masquerading', 'sender identity does not match the address');
    }
    if (authentication.spoofingSuspect) {
        addTechnique('impersonation', 'SPF/DKIM/DMARC failure');
    }
    for (const rule of breakdown) {
        if (rule.points > 0 && (rule.id === 'behavior' || rule.id === 'links')) {
            addTechnique('phishing', rule.reasons[0] || rule.label);
        }
    }
    return Array.from(found.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Chronological view of everything with a timestamp: message date, the Received
 * hops (with delays) and the local assessment.
 */
function buildDossierTimeline(header, receivedChain, threat) {
    const entries = [];
    if (header.date) entries.push({ at: new Date(header.date).toISOString(), event: msg('timelineMessageDate'), detail: '' });
    for (const hop of receivedChain) {
        if (!hop.timestamp) continue;
        const delay = hop.delaySeconds === undefined
            ? ''
            : ' (+' + hop.delaySeconds + 's' + (hop.delaySuspicious ? ', ' + msg('timelineSuspiciousDelay') : '') + ')';
        entries.push({
            at: hop.timestamp,
            event: msg('timelineHop'),
            detail: [hop.from, hop.by, hop.ip].filter(Boolean).join(' → ') + delay
        });
    }
    entries.push({
        at: new Date().toISOString(),
        event: msg('timelineLocalAssessment'),
        detail: msg('timelineLocalAssessmentDetail', [String(threat.score), verdictLabel(threat.verdict)])
    });
    return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/**
 * Attachment hashes are cached per message part: the popup can be opened several
 * times for the same message and hashing large attachments twice is pointless.
 */
const ATTACHMENT_HASH_CACHE = new Map();
const MAX_ATTACHMENT_HASH_CACHE = 200;

async function cachedAttachmentHash(messageId, partName) {
    const key = messageId + '|' + partName;
    if (ATTACHMENT_HASH_CACHE.has(key)) return ATTACHMENT_HASH_CACHE.get(key);
    let sha256 = null;
    try {
        const file = await browser.messages.getAttachmentFile(messageId, partName);
        sha256 = await get_sha256_hash(file);
    } catch (e) {
        sha256 = null;
    }
    while (ATTACHMENT_HASH_CACHE.size >= MAX_ATTACHMENT_HASH_CACHE) {
        ATTACHMENT_HASH_CACHE.delete(ATTACHMENT_HASH_CACHE.keys().next().value);
    }
    ATTACHMENT_HASH_CACHE.set(key, sha256);
    return sha256;
}

/**
 * Reads the locally stored provider states for a message so the dossier can show
 * what was already analysed without triggering another request (rate limits and
 * the user's quota are respected).
 */
async function readStoredScanRecord(headerMessageId) {
    if (!headerMessageId) return null;
    try {
        const db = await getSharedDB();
        const record = await getFromStore(db, 'hybridanalysis', headerMessageId);
        return record || null;
    } catch (e) {
        Logger.warn('Could not read the stored scan record for the dossier', e);
        return null;
    }
}

/** Merge der gespeicherten Anbieter-Zustände in die Anhangsliste. */
function mergeStoredAttachmentState(attachments, storedRecord) {
    const stored = new Map();
    for (const entry of (storedRecord && storedRecord.attachments) || []) {
        if (entry && entry.partName) stored.set(entry.partName, entry);
    }
    return attachments.map((attachment) => {
        const entry = stored.get(attachment.partName);
        if (!entry) return attachment;
        return Object.assign({}, attachment, {
            hybridState: (entry.hybrid_data && entry.hybrid_data.state) || entry.state || null,
            hybridJobId: (entry.hybrid_data && entry.hybrid_data.job_id) || entry.hybrid_job_id || null,
            storedSha256: entry.hybrid_sha256 || null,
            virustotalStats: entry.virustotal_stats || null,
            stateSource: 'stored'
        });
    });
}

/** Merge der gespeicherten Anbieter-Zustände in die Linkliste. */
function mergeStoredLinkState(links, storedRecord) {
    const stored = new Map();
    for (const entry of (storedRecord && storedRecord.links) || []) {
        if (entry && entry.url) stored.set(entry.url, entry);
    }
    return links.map((link) => {
        const entry = stored.get(link.url);
        if (!entry) return link;
        return Object.assign({}, link, {
            hybridState: entry.state || null,
            hybridJobId: entry.hybrid_job_id || null,
            storedSha256: entry.hybrid_sha256 || null,
            urlhausMatch: (storedRecord.urlhausMatches || []).includes(link.host),
            stateSource: 'stored'
        });
    });
}

/**
 * Builds the researcher dossier for one message. Everything is local: headers,
 * body, attachments and the states already stored in the local cache database.
 * The only network activity is the same consent-gated reputation check the
 * normal message scan performs.
 */
async function buildResearchDossier(messageId) {
    const header = await browser.messages.get(messageId);
    const fullMessage = await browser.messages.getFull(messageId);
    const headers = fullMessage.headers || {};
    const parseCache = new Map();
    const messageText = extractTextFromParts(fullMessage.parts || fullMessage);
    const urls = filterUrls(extractUrls(messageText), parseCache);

    let listedAttachments = [];
    try {
        listedAttachments = await browser.messages.listAttachments(messageId);
    } catch (e) {
        Logger.warn('listAttachments failed for the dossier', e);
    }
    const storedRecord = await readStoredScanRecord(header.headerMessageId);
    const attachments = [];
    for (const attachment of listedAttachments.slice(0, 25)) {
        const sha256 = await cachedAttachmentHash(messageId, attachment.partName);
        attachments.push({
            partName: attachment.partName,
            name: attachment.name,
            contentType: attachment.contentType,
            size: attachment.size,
            sha256: sha256,
            riskyExtension: isRiskyAttachmentName(attachment.name),
            archive: isArchiveAttachmentName(attachment.name)
        });
    }

    const senderEmail = extractEmailAddress(header.author || '');
    const senderDomain = extractEmailDomain(senderEmail);
    const senderMainDomain = getMainDomain(senderDomain);
    const replyTo = (headers['reply-to'] || [''])[0];
    const replyToEmail = replyTo ? extractEmailAddress(replyTo) : '';
    const replyToDomain = replyToEmail ? extractEmailDomain(replyToEmail) : '';
    const displayName = String(header.author || '').replace(/<[^>]*>/, '').trim().replace(/^"|"$/g, '');
    const authentication = parseAuthenticationResults(headers['authentication-results'] || [], headers['received-spf'] || []);
    const receivedChain = parseReceivedChain(headers['received'] || []);
    const links = urls.map(analyseLinkAnatomy);
    const enrichedAttachments = mergeStoredAttachmentState(attachments, storedRecord);
    const enrichedLinks = mergeStoredLinkState(links, storedRecord);

    let isFirstCommunication = false;
    try {
        isFirstCommunication = await checkFirstCommunication(senderEmail);
    } catch (e) { /* first contact detection is best effort */ }
    let urlhausDomains = [];
    try {
        urlhausDomains = await checkURLhausDomains(urls, parseCache);
    } catch (e) { /* requires a configured URLhaus key and consent */ }
    let maliciousIps = [];
    try {
        maliciousIps = await checkIPReputation(headers['received'] || []);
    } catch (e) { /* requires a configured provider and consent */ }

    const threat = calculateThreatScore(header.author, urls, {
        authHeaders: headers['authentication-results'] || [],
        urlhausDomains: urlhausDomains,
        isFirstCommunication: isFirstCommunication,
        messageText: messageText,
        subject: header.subject || '',
        replyTo: replyTo,
        parsedUrlCache: parseCache
    });

    const sender = {
        address: senderEmail,
        domain: senderDomain,
        registrableDomain: senderMainDomain,
        displayName: displayName,
        replyTo: replyToEmail,
        replyToDomain: replyToDomain,
        replyToMismatch: !!replyToDomain && !!senderDomain && replyToDomain !== senderDomain,
        displayNameMismatch: !!displayName && !!senderDomain &&
            !displayName.toLowerCase().includes(senderDomain.split('.')[0]),
        displayNameLookalike: !!findBrandLookalike(senderMainDomain),
        firstContact: isFirstCommunication
    };

    return {
        schema: 'thundy-av/research-dossier@1',
        generatedAt: new Date().toISOString(),
        message: {
            id: header.id,
            headerMessageId: header.headerMessageId || null,
            subject: header.subject || '',
            date: header.date ? new Date(header.date).toISOString() : null,
            recipients: (header.recipients || []).join(', '),
            size: header.size || null,
            folder: (header.folder && header.folder.name) || null
        },
        securityHeaders: {
            returnPath: (headers['return-path'] || [''])[0] || null,
            messageId: (headers['message-id'] || [''])[0] || null,
            xMailer: (headers['x-mailer'] || [''])[0] || null,
            listUnsubscribe: (headers['list-unsubscribe'] || [''])[0] || null
        },
        provenance: {
            computedLocally: true,
            privacyTier: privacyTier,
            consentGiven: mayTransmitExternally(),
            providersConfigured: {
                hybridAnalysis: !!apikey_hybridanalysis,
                virusTotal: !!apikey_virustotal,
                urlscan: !!urlscanApikey,
                urlhaus: !!urlhausApikey,
                abuseIpdb: ipReputationProvider === 'abuseipdb',
                ipReputation: ipReputationProvider !== 'none'
            },
            urlhausMatches: urlhausDomains,
            maliciousIps: maliciousIps,
            storedScanRecord: !!storedRecord,
            storedAttachments: ((storedRecord && storedRecord.attachments) || []).length,
            storedLinks: ((storedRecord && storedRecord.links) || []).length
        },
        authentication: authentication,
        receivedChain: receivedChain,
        sender: sender,
        attachments: enrichedAttachments,
        links: enrichedLinks,
        iocs: extractIocs(messageText, urls),
        risk: {
            score: threat.score,
            rawScore: threat.rawScore,
            verdict: threat.verdict,
            authStatus: threat.authStatus,
            reasons: threat.reasons,
            breakdown: threat.breakdown
        },
        mitre: mapMitreTechniques({ breakdown: threat.breakdown, attachments, links, authentication, sender }),
        timeline: buildDossierTimeline(header, receivedChain, threat)
    };
}

// ---------------------------------------------------------------------------
// Notifications
//
// One notification per scan context with a *stable* id: Thunderbird replaces the
// existing bubble instead of stacking a new one, so a scan reports
// "running -> submitted (job id) -> result" in a single place. `buttons` is
// marked as unsupported by Thunderbird's notifications API, therefore the click
// on the notification itself is the only action - it opens the message the
// notification belongs to. Message texts never contain the full URL (only the
// host, see describeUrlForUser).
// ---------------------------------------------------------------------------
const NOTIFICATION_CONTEXTS = new Map();
const MAX_NOTIFICATION_CONTEXTS = 50;

function notificationIdFor(key) {
    return 'thundy-' + String(key).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
}

function rememberNotificationContext(notificationId, context) {
    if (!notificationId || !context) return;
    NOTIFICATION_CONTEXTS.set(notificationId, Object.assign({ createdAt: Date.now() }, context));
    while (NOTIFICATION_CONTEXTS.size > MAX_NOTIFICATION_CONTEXTS) {
        NOTIFICATION_CONTEXTS.delete(NOTIFICATION_CONTEXTS.keys().next().value);
    }
}

function showNotification({ id, titleKey, messageKey, subs = [], context = null }) {
    try {
        const options = {
            type: 'basic',
            iconUrl: iconUrl(),
            title: msg(titleKey),
            message: msg(messageKey, subs)
        };
        if (id) {
            const notificationId = notificationIdFor(id);
            const created = browser.notifications.create(notificationId, options);
            if (created && typeof created.catch === 'function') {
                created.catch((e) => Logger.warn('Could not update notification', e));
            }
            rememberNotificationContext(notificationId, context);
            return notificationId;
        }
        const created = browser.notifications.create(options);
        if (created && typeof created.catch === 'function') {
            created.catch((e) => Logger.warn('Could not create notification', e));
        }
        return undefined;
    } catch (e) {
        Logger.error('Could not create notification', e);
        return undefined;
    }
}

function notify(titleKey, messageKey, subs) {
    return showNotification({ titleKey, messageKey, subs });
}

/**
 * Updates (or creates) the notification that belongs to one scan context, e.g.
 * `scan-<messageId>` for a message scan or `scan-url-<host>` for a link scan.
 */
function notifyScanStatus(key, titleKey, messageKey, subs = [], context = null) {
    return showNotification({ id: key, titleKey, messageKey, subs, context });
}

function clearNotification(key) {
    const notificationId = notificationIdFor(key);
    try {
        if (browser.notifications && typeof browser.notifications.clear === 'function') {
            browser.notifications.clear(notificationId);
        }
    } catch (e) { /* the notification may already be gone */ }
    NOTIFICATION_CONTEXTS.delete(notificationId);
}

/**
 * Classifies a local risk score into the verdict vocabulary used by the banners,
 * the notifications and the researcher view.
 */
function verdictForScore(score) {
    if (score >= 75) return 'malicious';
    if (score >= 50) return 'suspicious';
    if (score >= 20) return 'unclear';
    return 'clean';
}

function verdictLabel(verdict) {
    switch (verdict) {
        case 'malicious': return msg('verdictMalicious');
        case 'suspicious': return msg('verdictSuspicious');
        case 'unclear': return msg('verdictUnclear');
        default: return msg('verdictClean');
    }
}

async function openMessageFromNotification(notificationId) {
    const context = NOTIFICATION_CONTEXTS.get(notificationId);
    if (!context || context.messageId === undefined || context.messageId === null) return;
    try {
        if (browser.messageDisplay && typeof browser.messageDisplay.open === 'function') {
            await browser.messageDisplay.open({ messageId: context.messageId });
        }
    } catch (e) {
        Logger.warn('Could not open the message from the notification', e);
    }
}

if (browser.notifications && browser.notifications.onClicked) {
    browser.notifications.onClicked.addListener((notificationId) => {
        openMessageFromNotification(notificationId);
    });
}
if (browser.notifications && browser.notifications.onClosed) {
    browser.notifications.onClosed.addListener((notificationId) => {
        NOTIFICATION_CONTEXTS.delete(notificationId);
    });
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
        const notificationKey = 'scan-links-' + message.id;
        const notificationContext = { messageId: message.id };
        let submitted = 0;
        notifyScanStatus(notificationKey, 'notificationTitle', 'notificationScanRunning',
            [truncateForNotification(message.subject, msg('notificationFallbackSubject'))], notificationContext);
        for (const url of urls.slice(0, 20)) {
            try {
                await handleUrlScan(url, message.headerMessageId);
                submitted++;
                notifyScanStatus(notificationKey, 'notificationTitle', 'notificationScanProgress',
                    [String(submitted), String(Math.min(urls.length, 20))], notificationContext);
            } catch (e) {
                Logger.error('Could not submit link for analysis', e);
            }
        }
        notifyScanStatus(notificationKey, 'notificationTitle', 'notificationScanSubmitted',
            [String(submitted)], notificationContext);
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

        const notificationKey = 'scan-url-' + describeUrlForUser(url);
        notifyScanStatus(notificationKey, 'notificationTitle', 'notificationScanStarted', [describeUrlForUser(url)]);

        try {
            // Need a dummy headerMessageId as context menu might be clicked outside standard flow
            // or we just fetch the active message
            const activeMessage = await getFirstDisplayedMessage(tab && tab.id);
            let msgId = activeMessage ? activeMessage.headerMessageId : "context_menu_scan";
            const notificationContext = activeMessage ? { messageId: activeMessage.id } : null;

            let result = await handleUrlScan(url, msgId);

            notifyScanStatus(notificationKey, 'notificationTitle', 'notificationScanSubmitted',
                [String(result.job_id)], notificationContext);
        } catch (error) {
            notifyScanStatus(notificationKey, 'notificationTitleError', 'notificationScanError', [error.message]);
        }
    }
});

async function handleCheckLinkState(request, sender, sendResponse) {
    try {
        // Need to find the active message to get headerMessageId
        const message = await getFirstDisplayedMessage(sender && sender.tab && sender.tab.id, { throwOnError: true });
        if (!message || !message.headerMessageId) {
            sendResponse({status: 'UNKNOWN'});
            return;
        }

        const db = await getSharedDB();
        const record = await getFromStore(db, "hybridanalysis", message.headerMessageId);

        let linkObj = null;
        if (record && record.links) {
            // ⚡ Optimize URL normalization: Move requestUrl processing out of loop and use fast string methods over Regex
            const reqUrl = request.url.endsWith("/") ? request.url.slice(0, -1) : request.url;
            const reqUrlSlash = reqUrl + "/";
            // ⚡ Bolt Optimization: Replace .find() with for loop to avoid callback overhead
            linkObj = undefined; // Reset to match .find() semantics
            const links = record.links;
            const len = links.length;
            for (let i = 0; i < len; i++) {
                const u = links[i].url;
                if (u === reqUrl || u === reqUrlSlash) {
                    linkObj = links[i];
                    break;
                }
            }
        }

        // Time-of-Click Live Scan via urlscan.io
        if (urlscanApikey && (!linkObj || linkObj.state === 'UNKNOWN')) {
            try {
                const res = await checkUrlscanIo(request.url, urlscanApikey);
                if (res && res.status !== 'ERROR' && res.status !== 'TIMEOUT') {
                    // Wir überschreiben das Verhalten: Wenn es Visuelles Phishing ist, sofort warnen
                    sendResponse({ status: res.status, reasons: res.reasons });
                    return;
                }
            } catch (e) {
                Logger.error("Fehler bei Time-of-Click Live-Scan:", e);
            }
        }

        if (linkObj) {
            const status = await checkHybridAnalysisVerdict(linkObj.hybrid_sha256, linkObj.state);
            sendResponse({status: status});
        } else {
            sendResponse({status: 'UNKNOWN'});
        }
    } catch (err) {
        sendResponse({status: 'ERROR'});
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
        const notificationKey = 'scan-message-' + request.messageId;
        const notificationContext = { messageId: request.messageId };
        let subject = '';
        try {
            const header = await browser.messages.get(request.messageId);
            subject = (header && header.subject) || '';
        } catch (e) { /* the subject is only a display detail */ }
        notifyScanStatus(notificationKey, 'notificationTitle', 'notificationScanRunning',
            [truncateForNotification(subject, msg('notificationFallbackSubject'))], notificationContext);
        await processAttachments(messageObj);
        const fullMessage = await browser.messages.getFull(request.messageId);
        const tabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : (request.tabId || null);
        const tab = { id: tabId };
        const parsedUrlCache = new Map();
        const { messageText, urls, filteredUrls } = await processLinks(tab, messageObj, fullMessage, parsedUrlCache);
        notifyScanStatus(notificationKey, 'notificationTitle', 'notificationScanLinksChecked',
            [String(filteredUrls.length)], notificationContext);
        const threat = (await evaluateAndInjectThreats({ tab, message: messageObj, fullMessage, urls, filteredUrls, messageText, parsedUrlCache })) ||
            { score: 0, verdict: 'clean' };
        notifyScanStatus(notificationKey, 'notificationTitle', 'notificationScanResult',
            [verdictLabel(threat.verdict), String(threat.score)], notificationContext);
        return { success: true, persisted: request.persist === true, verdict: threat.verdict, score: threat.score };
    } catch (e) {
        Logger.error('requestScan failed', e);
        notifyScanStatus('scan-message-' + request.messageId, 'notificationTitleError', 'notificationScanError',
            [e && e.message ? e.message : String(e)], { messageId: request.messageId });
        return { success: false, error: e && e.message ? e.message : String(e), code: e && e.code ? e.code : undefined };
    }
}

/**
 * Notification texts are one-liners: long subjects are cut and never contain the
 * full URL (privacy).
 */
function truncateForNotification(text, fallback = '') {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return fallback;
    return value.length > 60 ? value.slice(0, 57) + '…' : value;
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
            handleCheckLinkState(request, sender, sendResponse);
            return true;

        case "downloadDisarmed":
            handleDownloadDisarmed(request.messageId, request.partName, request.attachmentName)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message}));
            return true;

        case "requestScan":
            handleRequestScan(request, sender).then(res => sendResponse(res));
            return true;

        case "getResearchDossier":
            buildResearchDossier(request.messageId)
                .then(dossier => sendResponse({ status: 'success', data: dossier }))
                .catch(error => {
                    Logger.error('Research dossier failed', error);
                    sendResponse({ status: 'error', message: error && error.message ? error.message : String(error) });
                });
            return true;

        case "saveResearchExport":
            handleSaveResearchExport(request)
                .then(res => sendResponse({ status: 'success', data: res }))
                .catch(error => sendResponse({ status: 'error', message: error && error.message ? error.message : String(error) }));
            return true;

        case "runSelfTest":
            runSelfTest()
                .then(report => sendResponse({ status: 'success', data: report }))
                .catch(error => {
                    Logger.error('Self-test failed', error);
                    sendResponse({ status: 'error', message: error && error.message ? error.message : String(error) });
                });
            return true;

        case "saveSelfTestReport":
            runSelfTest()
                .then((report) => handleSaveResearchExport({
                    filename: 'thundy-av-selftest-' + new Date().toISOString().slice(0, 10) + '.txt',
                    content: formatSelfTestReport(report),
                    mimeType: 'text/plain'
                }))
                .then(res => sendResponse({ status: 'success', data: res }))
                .catch(error => sendResponse({ status: 'error', message: error && error.message ? error.message : String(error) }));
            return true;

        default:
            return false;
    }
});

/**
 * Saves a researcher export (JSON/CSV/STIX) through the download manager. The
 * content is generated locally in the popup; the background only writes it to
 * disk, so no additional permission or network access is involved.
 */
async function handleSaveResearchExport(request) {
    const content = String((request && request.content) || '');
    if (!content) throw new Error('empty export');

    const mimeType = (request && request.mimeType) || 'application/json';
    const rawName = String((request && request.filename) || 'thundy-export.json');
    const safeName = rawName.split(/[\/\\]/).pop().replace(/[^a-zA-Z0-9_.-]/g, '_') || 'thundy-export.json';

    const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
        const downloadId = await browser.downloads.download({
            url: url,
            filename: safeName,
            saveAs: true
        });
        setTimeout(() => {
            try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        }, 10000);
        return { downloadId: downloadId, filename: safeName, bytes: content.length };
    } catch (e) {
        try { URL.revokeObjectURL(url); } catch (revokeError) { /* ignore */ }
        throw e;
    }
}


/**
 * Handles the "downloadDisarmed" message: sanitise an HTML attachment locally
 * and save the safe copy through the download manager.
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

async function checkUrlscanIo(url, apikey) {
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

        return await pollUrlscanIoResult(uuid);
    } catch (e) {
        Logger.error("Fehler bei urlscan.io Abfrage", e);
        return { status: 'ERROR', details: e.message };
    }
}

async function pollUrlscanIoResult(uuid) {
    let waitTime = 2000;
    let elapsed = 0;
    const maxTime = 30000;

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

// ---------------------------------------------------------------------------
// Selbsttest / Diagnose
//
// Der Selbsttest prüft die lokale Engine und die Laufzeitumgebung im echten
// Thunderbird. Er überträgt **nichts** an Dritte: alle Eingaben sind synthetisch
// (keine echten Nachrichteninhalte), es werden keine Anbieter-Endpunkte
// aufgerufen. Er ersetzt nicht die visuelle Prüfung der Banner und die
// Berechtigungsdialoge (docs/live_test_protocol.md), macht diese aber schneller
// reproduzierbar.
// ---------------------------------------------------------------------------

const SELFTEST_SCHEMA = 'thundy-av/selftest@1';

function selftestCheck(id, title, condition, detail, status) {
    return {
        id: id,
        title: title,
        status: status || (condition ? 'pass' : 'fail'),
        detail: detail || ''
    };
}

function selftestEnvironment() {
    return {
        apiAvailability: {
            messageDisplayOnMessagesDisplayed: !!(browser.messageDisplay && browser.messageDisplay.onMessagesDisplayed),
            messageDisplayGetDisplayedMessages: !!(browser.messageDisplay && typeof browser.messageDisplay.getDisplayedMessages === 'function'),
            messageDisplayOpen: !!(browser.messageDisplay && typeof browser.messageDisplay.open === 'function'),
            scriptingExecuteScript: !!(browser.scripting && typeof browser.scripting.executeScript === 'function'),
            notificationsCreate: !!(browser.notifications && typeof browser.notifications.create === 'function'),
            notificationsClear: !!(browser.notifications && typeof browser.notifications.clear === 'function'),
            permissionsRequest: !!(browser.permissions && typeof browser.permissions.request === 'function'),
            permissionsContains: !!(browser.permissions && typeof browser.permissions.contains === 'function'),
            permissionsGetAll: !!(browser.permissions && typeof browser.permissions.getAll === 'function'),
            downloadsDownload: !!(browser.downloads && typeof browser.downloads.download === 'function'),
            menusCreate: !!(browser.menus && typeof browser.menus.create === 'function'),
            messagesGet: !!(browser.messages && typeof browser.messages.get === 'function'),
            indexedDb: typeof indexedDB !== 'undefined'
        },
        runtimeVersion: (browser.runtime && browser.runtime.getManifest)
            ? (browser.runtime.getManifest().version || null)
            : null,
        privacyTier: privacyTier,
        consentGiven: mayTransmitExternally(),
        providersConfigured: {
            hybridAnalysis: !!apikey_hybridanalysis,
            virusTotal: !!apikey_virustotal,
            urlscan: !!urlscanApikey,
            urlhaus: !!urlhausApikey,
            ipReputation: ipReputationProvider !== 'none'
        }
    };
}

/** Synthetische Nachricht für die Engine-Prüfungen (keine echten Inhalte). */
function selftestSyntheticMessage() {
    return {
        author: 'Buchhaltung <buchhaltung@paypa1.com>',
        subject: 'Dringend: offene Rechnung',
        text: 'Bitte sofort zahlen: https://bit.ly/3xY und https://paypa1.com/login?uid=7 . Hash ' +
            'a'.repeat(64) + ' IP 203.0.113.5',
        authHeaders: ['mx.test; spf=fail smtp.mailfrom=paypa1.com; dkim=fail header.d=paypa1.com; dmarc=fail header.from=paypa1.com'],
        received: [
            'from mx.test (mx.test [203.0.113.9]) by inbox.test with ESMTPS; Thu, 1 Oct 2026 12:00:00 +0000',
            'from sender.test (sender.test [198.51.100.4]) by mx.test with ESMTP; Thu, 1 Oct 2026 06:00:00 +0000'
        ],
        replyTo: 'kontakt@other-mail.example',
        attachmentName: 'rechnung.docm'
    };
}


/**
 * Führt alle lokalen Prüfungen aus. Rückgabe ist ein Bericht, der kopiert,
 * exportiert und in das Live-Test-Protokoll übernommen werden kann.
 */
async function runSelfTest() {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const checks = [];
    const sample = selftestSyntheticMessage();
    const environment = selftestEnvironment();

    for (const [key, present] of Object.entries(environment.apiAvailability)) {
        checks.push(selftestCheck('api.' + key,
            msg('selftestApiLabel') + ': ' + key, present,
            present ? '' : msg('selftestApiMissingDetail')));
    }

    // Zustimmungs-Regel
    const consentBefore = externalAnalysisConsent;
    externalAnalysisConsent = false;
    let consentBlocked = false;
    try { assertExternalAnalysisAllowed(); } catch (e) { consentBlocked = e && e.code === EXTERNAL_ANALYSIS_DISABLED; }
    const mayNotTransmit = mayTransmitExternally() === false;
    externalAnalysisConsent = consentBefore;
    checks.push(selftestCheck('consent.blocked', msg('selftestConsentBlocked'), consentBlocked && mayNotTransmit,
        msg('selftestConsentBlockedDetail')));

    // Datenschutz-Stufen
    const tierBefore = privacyTier;
    privacyTier = 'strict';
    const strictBlocksUpload = !tierAtLeast('balanced');
    const strictBlocksUrl = !tierAtLeast('max');
    privacyTier = 'balanced';
    const balancedAllowsUpload = tierAtLeast('balanced') && !tierAtLeast('max');
    privacyTier = 'max';
    const maxAllowsBoth = tierAtLeast('balanced') && tierAtLeast('max');
    privacyTier = tierBefore;
    checks.push(selftestCheck('tier.gates', msg('selftestTierGates'),
        strictBlocksUpload && strictBlocksUrl && balancedAllowsUpload && maxAllowsBoth,
        msg('selftestTierGatesDetail')));

    // Verdikt-Schwellen
    const verdictOk = verdictForScore(10) === 'clean' && verdictForScore(30) === 'unclear'
        && verdictForScore(60) === 'suspicious' && verdictForScore(90) === 'malicious';
    checks.push(selftestCheck('verdict.thresholds', msg('selftestVerdictThresholds'), verdictOk,
        '0–19 clean, 20–49 unclear, 50–74 suspicious, >=75 malicious'));

    // Header-/Auth-Parser
    const auth = parseAuthenticationResults(sample.authHeaders, []);
    const authOk = auth.spf === 'fail' && auth.dmarc === 'fail' && auth.dkim.includes('fail') && auth.spoofingSuspect === true;
    checks.push(selftestCheck('parser.authentication', msg('selftestAuthParser'), authOk,
        JSON.stringify({ spf: auth.spf, dmarc: auth.dmarc, dkim: auth.dkim })));

    const chain = parseReceivedChain(sample.received);
    const newestHop = chain.find((hop) => hop.ip === '203.0.113.9');
    const chainOk = chain.length === 2 && !!newestHop && newestHop.delaySeconds === 21600 && newestHop.delaySuspicious === true;
    checks.push(selftestCheck('parser.received', msg('selftestReceivedParser'), chainOk,
        JSON.stringify(chain.map((hop) => ({ ip: hop.ip, delay: hop.delaySeconds })))));

    // Link-Anatomie
    const shortener = analyseLinkAnatomy('https://bit.ly/3xY?uid=7');
    const lookalike = analyseLinkAnatomy('https://paypa1.com/login');
    const linkOk = shortener.isShortener === true && shortener.trackingParameters.includes('uid')
        && lookalike.brandLookalike === 'paypal.com';
    checks.push(selftestCheck('parser.links', msg('selftestLinkAnatomy'), linkOk,
        JSON.stringify({ shortener: shortener.isShortener, tracking: shortener.trackingParameters, lookalike: lookalike.brandLookalike })));

    // IOC-Extraktion
    const iocs = extractIocs(sample.text, ['https://bit.ly/3xY', 'https://paypa1.com/login?uid=7']);
    const iocOk = iocs.urls.length === 2 && iocs.ips.includes('203.0.113.5')
        && iocs.hashes.length === 1 && iocs.domains.includes('paypa1.com');
    checks.push(selftestCheck('parser.iocs', msg('selftestIocs'), iocOk,
        JSON.stringify({ urls: iocs.urls.length, ips: iocs.ips.length, hashes: iocs.hashes.length, domains: iocs.domains.length })));

    // Anhangs-Erkennung
    const attachmentOk = isRiskyAttachmentName(sample.attachmentName) && isArchiveAttachmentName('paket.zip')
        && !isRiskyAttachmentName('notizen.txt') && getFileExtension('a.b.C') === 'c';
    checks.push(selftestCheck('parser.attachments', msg('selftestAttachments'), attachmentOk, sample.attachmentName));


    // Score-Ledger
    const threat = calculateThreatScore(sample.author, ['https://bit.ly/3xY', 'https://paypa1.com/login?uid=7'], {
        authHeaders: sample.authHeaders,
        urlhausDomains: [],
        isFirstCommunication: true,
        messageText: sample.text,
        subject: sample.subject,
        replyTo: sample.replyTo,
        parsedUrlCache: new Map()
    });
    const ledgerSum = threat.breakdown.reduce((total, rule) => total + rule.points, 0);
    const ledgerOk = ledgerSum === threat.rawScore && threat.score === Math.min(threat.rawScore, 100) && threat.breakdown.length > 0;
    checks.push(selftestCheck('scoring.ledger', msg('selftestLedger'), ledgerOk,
        JSON.stringify({ raw: threat.rawScore, capped: threat.score, rules: threat.breakdown.length })));

    // MITRE-Zuordnung
    const techniques = mapMitreTechniques({
        breakdown: threat.breakdown,
        attachments: [{ name: sample.attachmentName }],
        links: [shortener, lookalike],
        authentication: auth,
        sender: { replyToMismatch: true, displayNameMismatch: true }
    });
    const techniqueIds = techniques.map((technique) => technique.id);
    const mitreOk = techniqueIds.includes('T1566.001') && techniqueIds.includes('T1566.002') && techniqueIds.includes('T1656')
        && techniques.every((technique) => technique.confidence === 'heuristic' && technique.evidence.length > 0);
    checks.push(selftestCheck('mitre.mapping', msg('selftestMitre'), mitreOk, techniqueIds.join(', ')));

    // Zeitleiste
    const timeline = buildDossierTimeline({ date: Date.parse('2026-10-01T06:00:00Z') }, chain, threat);
    const timelineOk = timeline.length >= 3
        && Date.parse(timeline[0].at) <= Date.parse(timeline[timeline.length - 1].at);
    checks.push(selftestCheck('dossier.timeline', msg('selftestTimeline'), timelineOk,
        timeline.length + ' ' + msg('selftestEntries')));

    // Injektion in die Nachrichtenansicht - genau der Pfad, den der Live-Test
    // visuell prüft. Ohne geöffnete Nachricht ist das ein Hinweis, kein Fehler.
    let injectionDetail = '';
    let injectionStatus = 'fail';
    let tabs = [];
    try {
        tabs = await browser.tabs.query({});
    } catch (e) {
        tabs = [];
    }
    try {
        const messageTabs = await browser.tabs.query({ type: ['mail', 'messageDisplay'] });
        if (messageTabs && messageTabs.length > 0) tabs = messageTabs;
    } catch (e) { /* andere Signatur: erste Abfrage behalten */ }
    const activeTab = tabs && tabs.length > 0 ? tabs[0] : null;
    const displayed = activeTab ? await getFirstDisplayedMessage(activeTab.id) : null;
    if (!activeTab || !displayed) {
        injectionStatus = 'warn';
        injectionDetail = msg('selftestInjectionNoMessage');
    } else {
        const result = await injectIntoMessageDisplay(activeTab.id, function() {
            return 'thundy-selftest-probe';
        });
        const ok = Array.isArray(result) && result.length > 0
            && result[0] && result[0].result === 'thundy-selftest-probe';
        injectionStatus = ok ? 'pass' : 'fail';
        injectionDetail = ok ? msg('selftestInjectionOkDetail') : msg('selftestInjectionFailedDetail');
    }
    checks.push(selftestCheck('injection.messageDisplay', msg('selftestInjection'),
        injectionStatus === 'pass', injectionDetail, injectionStatus));


    // Benachrichtigungen wirklich anlegen und wieder entfernen
    const notificationId = 'thundy-selftest-' + Date.now();
    let notificationOk = false;
    try {
        const created = browser.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: iconUrl(),
            title: msg('selftestNotificationTitle'),
            message: msg('selftestNotificationMessage')
        });
        if (created && typeof created.catch === 'function') await created.catch(() => {});
        notificationOk = true;
    } catch (e) {
        notificationOk = false;
    }
    try {
        if (browser.notifications && typeof browser.notifications.clear === 'function') {
            browser.notifications.clear(notificationId);
        }
    } catch (e) { /* die Meldung ist nur ein Test */ }
    checks.push(selftestCheck('notifications.roundtrip', msg('selftestNotifications'), notificationOk, notificationId));

    // Anbieter: Schlüssel gesetzt, aber Host-Berechtigung (noch) nicht erteilt?
    for (const [provider, origin] of Object.entries(PROVIDER_ORIGINS)) {
        const configured = (provider === 'hybridanalysis' && !!apikey_hybridanalysis)
            || (provider === 'virustotal' && (!!apikey_virustotal || ipReputationProvider === 'virustotal'))
            || (provider === 'urlscan' && !!urlscanApikey)
            || (provider === 'urlhaus' && !!urlhausApikey)
            || (provider === 'abuseipdb' && ipReputationProvider === 'abuseipdb');
        if (!configured) continue;
        let granted = false;
        try {
            granted = await browser.permissions.contains({ origins: [origin] });
        } catch (e) {
            granted = false;
        }
        checks.push(selftestCheck('provider.' + provider, msg('selftestProviderPermission') + ' ' + provider,
            granted, granted ? origin : msg('selftestProviderPermissionMissing') + ' ' + origin,
            granted ? 'pass' : 'warn'));
    }

    if (!environment.consentGiven && Object.values(environment.providersConfigured).some(Boolean)) {
        checks.push(selftestCheck('consent.notice', msg('selftestConsentNotice'), false,
            msg('selftestConsentNoticeDetail'), 'warn'));
    }

    const summary = {
        pass: checks.filter((check) => check.status === 'pass').length,
        fail: checks.filter((check) => check.status === 'fail').length,
        warn: checks.filter((check) => check.status === 'warn').length
    };
    summary.verdict = summary.fail > 0 ? 'failed' : (summary.warn > 0 ? 'attention' : 'ok');

    return {
        schema: SELFTEST_SCHEMA,
        startedAt: startedAt,
        durationMs: Date.now() - startTime,
        environment: environment,
        checks: checks,
        summary: summary,
        note: msg('selftestNote')
    };
}

/** Formatiert einen Selbsttest-Bericht als Text für Protokoll oder Issue. */
function formatSelfTestReport(report) {
    const lines = [];
    lines.push('Thundy AV ' + (report.environment.runtimeVersion || '?') + ' – ' + msg('selftestReportTitle'));
    lines.push(msg('selftestReportStarted') + ': ' + report.startedAt + ' (' + report.durationMs + ' ms)');
    lines.push(msg('selftestReportResult') + ': ' + String(report.summary.verdict).toUpperCase() +
        ' (' + report.summary.pass + ' pass / ' + report.summary.fail + ' fail / ' + report.summary.warn + ' warn)');
    lines.push('');
    for (const check of report.checks) {
        lines.push('[' + String(check.status).toUpperCase() + '] ' + check.id + ' – ' + check.title +
            (check.detail ? ' :: ' + check.detail : ''));
    }
    lines.push('');
    lines.push(report.note);
    return lines.join('\n');
}

