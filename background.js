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
    bannerConsentMissing: 'External analysis is disabled in the options – nothing was transmitted.',
    bannerThreatTitle: 'Thundy AV warning',
    bannerThreatScore: 'Risk score: $SCORE$ of 100',
    bannerAuthPass: 'Sender verified (SPF/DKIM/DMARC passed)',
    bannerOpenOptions: 'Open options',
    bannerSenderOptIn: 'This sender is now scanned automatically.',
    notificationScanStarted: 'Scan started for: $URL$',
    notificationScanSubmitted: 'Scan submitted successfully. Job ID: $JOBID$',
    notificationScanError: 'Scan error: $ERROR$',
    notificationTitle: 'Thundy AV Scanner',
    notificationTitleError: 'Thundy AV Scanner error',
    notificationInjectionFailed: 'The add-on could not display its banner in the message view. Please report this together with your Thunderbird version.'
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
    text = text.replace(/\$(SCORE|URL|JOBID|ERROR|REASONS)\$/g, () => (values.length ? String(values.shift()) : ''));
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

// ---------------------------------------------------------------------------
// External analysis consent
// Thunderbird has no built-in data collection consent prompt, therefore the
// add-on asks for consent explicitly (options page) and enforces it here:
// without consent nothing is sent to any third party service.
// ---------------------------------------------------------------------------
const EXTERNAL_ANALYSIS_DISABLED = 'EXTERNAL_ANALYSIS_DISABLED';

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
 * Thunderbird's generic scripting API is used; if a future Thunderbird
 * release exposes scripting.messageDisplay.executeScript, it is preferred.
 */
const injectionFailureNotified = new Set();
const MAX_INJECTION_FAILURES_TRACKED = 100;

async function injectIntoMessageDisplay(tabId, func, args = []) {
    if (tabId === undefined || tabId === null) return null;
    const injection = { target: { tabId }, func, args };
    try {
        if (browser.scripting && browser.scripting.messageDisplay &&
            typeof browser.scripting.messageDisplay.executeScript === 'function') {
            return await browser.scripting.messageDisplay.executeScript(injection);
        }
        return await browser.scripting.executeScript(injection);
    } catch (e) {
        Logger.warn('Injecting into the message display failed (please report with your Thunderbird version):', e);
        // Ein fehlgeschlagener Injektionsversuch darf nicht still bleiben: ohne
        // Banner fehlt dem Nutzer der zweite Zustimmungsschritt.
        if (!injectionFailureNotified.has(tabId)) {
            if (injectionFailureNotified.size >= MAX_INJECTION_FAILURES_TRACKED) {
                injectionFailureNotified.delete(injectionFailureNotified.values().next().value);
            }
            injectionFailureNotified.add(tabId);
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

// ---------------------------------------------------------------------------
// Grenzen und Zustand für automatische Scans
// `allowExternal` (siehe unten) ist überall fail-closed: eine Übermittlung
// findet nur statt, wenn der Aufrufer sie ausdrücklich erlaubt (Absender-Opt-in
// oder ausdrücklich ausgelöster Scan).
// ---------------------------------------------------------------------------
const MAX_AUTO_SCAN_ATTACHMENT_BYTES = 25 * 1024 * 1024; // Anhänge > 25 MB werden nicht automatisch verarbeitet
const MAX_AUTO_SCAN_ATTACHMENTS = 10;                    // höchstens 10 Anhänge pro Nachricht
const ATTACHMENT_SCAN_CONCURRENCY = 3;                   // parallele Anhang-Verarbeitungen
const MAX_AUTO_SCAN_URLS = 5;                            // höchstens 5 Links pro Nachricht automatisch prüfen

// Domains, die im laufenden Betrieb als bösartig erkannt wurden (URLhaus,
// urlscan.io). Grundlage für den lokalen Time-of-Click-Hinweis; rein lokal.
const flaggedDomains = new Set();
const MAX_FLAGGED_DOMAINS = 2000;

function markDomainFlagged(domain) {
    if (!domain || typeof domain !== 'string') return;
    const normalized = domain.toLowerCase();
    if (flaggedDomains.size >= MAX_FLAGGED_DOMAINS) {
        flaggedDomains.delete(flaggedDomains.values().next().value);
    }
    flaggedDomains.add(normalized);
}

function domainOfUrl(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch (e) {
        return '';
    }
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

/**
 * Hält die Schlüssel im API-Gateway aktuell. Das Gateway bindet einen Schlüssel
 * nur an den Host, zu dem er gehört (api_gateway.js: _injectAuthHeaders) und
 * setzt Redirects/Timeouts zentral durch.
 */
function syncApiGatewayKeys() {
  try {
    if (typeof apiGateway === 'undefined' || typeof apiGateway.setApikey !== 'function') return;
    apiGateway.setApikey('hybridanalysis', apikey_hybridanalysis || '');
    apiGateway.setApikey('virustotal', apikey_virustotal || '');
    apiGateway.setApikey('urlhaus', urlhausApikey || '');
    apiGateway.setApikey('urlscan', urlscanApikey || '');
    apiGateway.setApikey('abuseipdb', ipReputationProvider === 'abuseipdb' ? (ipReputationApiKey || '') : '');
  } catch (e) { /* Gateway ist optional */ }
}

syncApiGatewayKeys();
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
  syncApiGatewayKeys();
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
const KNOWN_BRANDS_REGEX = new RegExp(`(?:^|\\.)(${KNOWN_BRANDS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'i');

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

// ---------------------------------------------------------------------------
// Lokale Linkbewertung für den Time-of-Click-Schutz.
// Es findet KEIN Netzwerkzugriff statt: geprüft werden URL-Struktur, der
// angezeigte Linktext, eigene Listen und bereits erkannte bösartige Domains.
// ---------------------------------------------------------------------------
const PHISHING_BRAND_DOMAINS = [
    'paypal.com', 'amazon.de', 'amazon.com', 'microsoft.com', 'apple.com', 'google.com',
    'dhl.de', 'deutschepost.de', 'sparkasse.de', 'commerzbank.de', 'volksbank.de', 'ing.de',
    'postbank.de', 'netflix.com', 'ebay.de', 'ebay.com', 'telekom.de', 'vodafone.de',
    'facebook.com', 'instagram.com', 'whatsapp.com', 'binance.com', 'coinbase.com', 'klarna.com'
];

const IPV4_ONLY_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_LITERAL_REGEX = /^\[[0-9a-f:.]+\]$/i;

function firstUrlInText(text) {
    if (!text || typeof text !== 'string') return '';
    const match = text.match(/https?:\/\/[^\s<>"']+/i);
    return match ? match[0] : '';
}

/**
 * Bewertet einen Link ausschließlich lokal.
 * @returns {{risk: 'none'|'high', reasons: string[]}} reasons sind i18n-Schlüssel
 */
function evaluateClickRisk(url, { displayedText = '', flagged = flaggedDomains, blacklist = customBlacklist, whitelist = customWhitelist } = {}) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (e) {
        return { risk: 'high', reasons: ['tocReasonInvalidUrl'] };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { risk: 'high', reasons: ['tocReasonScheme'] };
    }

    const host = (parsed.hostname || '').toLowerCase();
    const mainDomain = getMainDomain(host);

    if (whitelist && (whitelist.has(host) || whitelist.has(mainDomain))) {
        return { risk: 'none', reasons: [] };
    }
    if (blacklist && (blacklist.has(host) || blacklist.has(mainDomain))) {
        return { risk: 'high', reasons: ['tocReasonBlacklist'] };
    }
    if (flagged && (flagged.has(host) || flagged.has(mainDomain))) {
        return { risk: 'high', reasons: ['tocReasonKnownMalicious'] };
    }
    if (parsed.username || parsed.password) {
        return { risk: 'high', reasons: ['tocReasonUserInfo'] };
    }
    if (IPV4_ONLY_REGEX.test(host) || IPV6_LITERAL_REGEX.test(parsed.hostname)) {
        return { risk: 'high', reasons: ['tocReasonIpLiteral'] };
    }
    if (host.includes('xn--')) {
        return { risk: 'high', reasons: ['tocReasonPunycode'] };
    }

    const reasons = [];

    // Klassisches Phishing: der angezeigte Linktext nennt eine andere Domain als das Ziel
    const textUrl = firstUrlInText(displayedText);
    if (textUrl) {
        let textHost = '';
        try { textHost = new URL(textUrl).hostname.toLowerCase(); } catch (e) { textHost = ''; }
        if (textHost && textHost !== host && getMainDomain(textHost) !== mainDomain) {
            reasons.push('tocReasonTextMismatch');
        }
    }

    // Markenmissbrauch in Subdomains bzw. Tippfehler-Domains
    const mainLabel = mainDomain.split('.')[0];
    for (const brand of PHISHING_BRAND_DOMAINS) {
        const brandMain = getMainDomain(brand);
        const brandLabel = brandMain.split('.')[0];
        if (mainDomain === brandMain) break; // echte Markendomain
        if (host.includes(brand) && mainDomain !== brandMain) {
            reasons.push('tocReasonBrandInSubdomain');
            break;
        }
        if (brandLabel.length > 4 && mainLabel.length > 4 && levenshteinDistance(mainLabel, brandLabel) === 1) {
            reasons.push('tocReasonLookAlike');
            break;
        }
    }

    return { risk: reasons.length > 0 ? 'high' : 'none', reasons };
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

/**
 * Time-of-Click-Schutz: markiert Links in der Nachrichtenansicht und prüft sie
 * beim Überfahren/Klick ausschließlich LOKAL (URL-Struktur, angezeigter
 * Linktext, eigene Listen, bereits erkannte bösartige Domains). Verdächtige
 * Ziele werden vor dem Öffnen mit einer Warnung abgefangen, die dem Nutzer die
 * Entscheidung überlässt. Es werden dabei keine Daten übertragen.
 */
async function injectTimeOfClickProtection(tabId) {
    if (!timeOfClickProtection || tabId === undefined || tabId === null) return;
    const strings = {
        marked: msg('tocLinkMarked', 'Thundy AV: checked locally when clicked'),
        title: msg('tocWarnTitle', 'Thundy AV: suspicious link'),
        reasonsLabel: msg('tocWarnReasons', 'Reasons: $REASONS$'),
        openAnyway: msg('tocWarnOpenAnyway', 'Open anyway'),
        cancel: msg('tocWarnCancel', 'Cancel'),
        note: msg('tocWarnNote', 'The check was local; no data was transmitted. Opening is at your own risk.'),
        openFailed: msg('tocWarnOpenFailed', 'Could not open the link.'),
        reasonTexts: {
            tocReasonInvalidUrl: msg('tocReasonInvalidUrl', 'Invalid link target'),
            tocReasonScheme: msg('tocReasonScheme', 'Not an http(s) link'),
            tocReasonBlacklist: msg('tocReasonBlacklist', 'Blocked by your own blacklist'),
            tocReasonKnownMalicious: msg('tocReasonKnownMalicious', 'Previously reported as malicious'),
            tocReasonUserInfo: msg('tocReasonUserInfo', 'Credentials embedded in the URL'),
            tocReasonIpLiteral: msg('tocReasonIpLiteral', 'Raw IP address instead of a domain'),
            tocReasonPunycode: msg('tocReasonPunycode', 'Punycode/obfuscated domain'),
            tocReasonTextMismatch: msg('tocReasonTextMismatch', 'Displayed link text differs from the target'),
            tocReasonBrandInSubdomain: msg('tocReasonBrandInSubdomain', 'Brand name in an unrelated domain'),
            tocReasonLookAlike: msg('tocReasonLookAlike', 'Domain looks like a well-known brand')
        }
    };
    await injectIntoMessageDisplay(tabId, function(strings) {
        const OVERLAY_ID = 'thundy-toc-warning';
        const verdicts = new Map();
        const pending = new Set();

        const requestVerdict = async (url, displayedText) => {
            if (!url || verdicts.has(url) || pending.has(url)) return;
            pending.add(url);
            try {
                const response = await browser.runtime.sendMessage({
                    action: 'checkLinkState',
                    url: url,
                    displayedText: displayedText
                });
                if (response && response.data && response.data.risk) {
                    verdicts.set(url, response.data);
                }
            } catch (e) { /* ohne Antwort bleibt der Link ungeprüft, aber unverändert nutzbar */ }
            finally { pending.delete(url); }
        };

        const reasonText = (key) => strings.reasonTexts[key] || key;

        const closeOverlay = () => {
            const existing = document.getElementById(OVERLAY_ID);
            if (existing) existing.remove();
        };
        const showWarning = (url, verdict) => {
            closeOverlay();
            const overlay = document.createElement('div');
            overlay.id = OVERLAY_ID;
            overlay.setAttribute('role', 'alertdialog');
            overlay.setAttribute('aria-label', strings.title);
            overlay.style.position = 'fixed';
            overlay.style.top = '10px';
            overlay.style.left = '10px';
            overlay.style.right = '10px';
            overlay.style.zIndex = '2147483647';
            overlay.style.backgroundColor = '#fff3f3';
            overlay.style.border = '2px solid #d32f2f';
            overlay.style.borderRadius = '6px';
            overlay.style.padding = '10px 12px';
            overlay.style.fontFamily = 'Arial, sans-serif';
            overlay.style.fontSize = '13px';
            overlay.style.color = '#333';
            overlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';

            const headline = document.createElement('div');
            headline.style.fontWeight = 'bold';
            headline.style.color = '#d32f2f';
            headline.textContent = strings.title;
            overlay.appendChild(headline);

            const target = document.createElement('div');
            target.style.margin = '4px 0';
            target.style.wordBreak = 'break-all';
            target.textContent = url; // nur textContent -> kein HTML aus der Mail
            overlay.appendChild(target);

            const reasonsText = (verdict.reasons || []).map(reasonText).join(', ');
            const reasons = document.createElement('div');
            reasons.textContent = strings.reasonsLabel.indexOf('$REASONS$') !== -1
                ? strings.reasonsLabel.replace('$REASONS$', reasonsText)
                : strings.reasonsLabel + ' ' + reasonsText;
            overlay.appendChild(reasons);

            const note = document.createElement('div');
            note.style.marginTop = '6px';
            note.style.fontSize = '12px';
            note.textContent = strings.note;
            overlay.appendChild(note);

            const actions = document.createElement('div');
            actions.style.marginTop = '8px';

            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.textContent = strings.openAnyway;
            openBtn.addEventListener('click', async () => {
                openBtn.disabled = true;
                try {
                    const resp = await browser.runtime.sendMessage({ action: 'openLink', url: url });
                    if (!resp || resp.status === 'error') throw new Error('open_failed');
                    closeOverlay();
                } catch (e) {
                    openBtn.disabled = false;
                    note.textContent = strings.openFailed;
                }
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.style.marginLeft = '8px';
            cancelBtn.textContent = strings.cancel;
            cancelBtn.addEventListener('click', closeOverlay);

            actions.appendChild(openBtn);
            actions.appendChild(cancelBtn);
            overlay.appendChild(actions);

            const host = document.body || document.documentElement;
            if (host) host.insertBefore(overlay, host.firstChild);
        };

        const links = document.querySelectorAll('a');
        links.forEach(link => {
            const href = link.href;
            if (!href || !href.startsWith('http')) return;
            link.title = strings.marked;
            link.style.borderBottom = '1px dashed #ff8c00';
            const prefetch = () => { void requestVerdict(href, link.textContent || ''); };
            link.addEventListener('mouseover', prefetch);
            link.addEventListener('focus', prefetch);
            link.addEventListener('click', (event) => {
                const verdict = verdicts.get(href);
                if (verdict && verdict.risk === 'high') {
                    event.preventDefault();
                    event.stopPropagation();
                    showWarning(href, verdict);
                }
            }, true);
        });
    }, [strings]);
}


async function checkIPReputation(receivedHeaders) {
    let maliciousIps = [];
    if (ipReputationProvider !== "none" && ipReputationApiKey) {
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
                let isMalicious = false;
                try {
                    if (ipReputationProvider === "abuseipdb") {
                        isMalicious = await checkAbuseIPDB(ip, ipReputationApiKey);
                    } else if (ipReputationProvider === "virustotal") {
                        isMalicious = await checkVirusTotalIP(ip, ipReputationApiKey);
                    }
                } catch(e) { Logger.error(e); }
                return isMalicious;
            })();

            if (ipReputationCache.size >= MAX_IP_CACHE) {
                ipReputationCache.delete(ipReputationCache.keys().next().value);
            }
            ipReputationCache.set(ip, promise);

            ipChecks.push(promise.then(isMalicious => {
                ipReputationCache.set(ip, isMalicious);
                return { ip, isMalicious };
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
                    domainChecks.push(cached.then(isMal => {
                        if (isMal) {
                            urlhausDomains.push(domain);
                            markDomainFlagged(domain);
                        }
                    }));
                } else if (cached) {
                    urlhausDomains.push(domain);
                    markDomainFlagged(domain);
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
                if (isMalicious) {
                    urlhausDomains.push(domain);
                    markDomainFlagged(domain);
                }
            }));
        }

        if (domainChecks.length > 0) {
            await Promise.all(domainChecks);
        }
    }
    return urlhausDomains;
}

async function injectThreatBanner(tabId, threat) {
    if (threat.score >= 50 || threat.authStatus === 'pass') {
        await injectIntoMessageDisplay(tabId, function(score, reasons, authStatus) {
                const t = (key, fallback, subs) => {
                    try {
                        return browser.i18n.getMessage(key, subs) || fallback;
                    } catch (e) {
                        return fallback;
                    }
                };
                if (score >= 50) {
                    // Sichere DOM-Manipulation ohne innerHTML
                    const banner = document.createElement('div');
                    banner.id = 'thundy-threat-banner';
                    banner.style.backgroundColor = '#ffeeee';
                    banner.style.border = '1px solid #ff0000';
                    banner.style.color = '#ff0000';
                    banner.style.padding = '10px';
                    banner.style.margin = '10px';
                    banner.style.borderRadius = '4px';
                    banner.style.fontWeight = 'bold';
                    banner.style.fontFamily = 'Arial, sans-serif';
                    banner.style.zIndex = '9999';

                    const title = document.createElement('div');
                    title.textContent = '🔴 ⚠️ ' + t('bannerThreatTitle', 'Thundy AV warning') +
                        ' (' + t('bannerThreatScore', 'Risk score: $SCORE$ of 100', [String(score)]) + ')';
                    title.style.fontSize = '16px';
                    title.style.marginBottom = '5px';
                    banner.appendChild(title);

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

                    document.body.prepend(banner);
                } else if (authStatus === 'pass') {
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
        }, [threat.score, threat.reasons, threat.authStatus]);
    }
}

async function processAttachments(message, { allowExternal = false } = {}) {
  let attachments = await browser.messages.listAttachments(message.id);
  if (!attachments || attachments.length === 0) return;

  // Grenzen (Speicher-/Bandbreitenschutz): nur die ersten N Anhänge und nur
  // Anhänge unterhalb der Größenobergrenze werden verarbeitet.
  const candidates = [];
  const limited = attachments.slice(0, MAX_AUTO_SCAN_ATTACHMENTS);
  if (attachments.length > limited.length) {
    Logger.warn('Attachment limit reached, the remaining attachments are skipped:', attachments.length);
  }
  for (const attachment of limited) {
    const size = typeof attachment.size === 'number' ? attachment.size : 0;
    if (size > MAX_AUTO_SCAN_ATTACHMENT_BYTES) {
      Logger.warn('Attachment skipped (too large for automatic processing):', attachment.name);
      continue;
    }
    candidates.push(attachment);
  }

  if (candidates.length > 0) {
    await sent_to_hybrid_by_attachment(message, candidates, { allowExternal });
  }
}

async function processLinks(tab, message, fullMessage, parsedUrlCache = null, { allowExternal = false } = {}) {
  let messageText = extractTextFromParts(fullMessage);
  let urls = extractUrls(messageText);
  let filteredUrls = filterUrls(urls, parsedUrlCache);

  if (filteredUrls.length > 0) {
    if (allowExternal) {
      await processAndUploadUrls(message, filteredUrls);
      if (autoScanLinks) {
        // Bewusst nicht abgewartet: die Anzeige der Nachricht darf nicht auf
        // langlaufende Link-Abfragen warten.
        void scanLinksWithConfiguredProviders(filteredUrls.slice(0, MAX_AUTO_SCAN_URLS), message.headerMessageId);
      }
    } else {
      await indexedDB_save_links_to_db(message, filteredUrls);
    }
  }

  // Time-of-Click-Schutz markiert und prüft Links lokal (ohne Netzwerkzugriff)
  await injectTimeOfClickProtection(tab.id);

  return { messageText, urls, filteredUrls };
}

/**
 * Prüft Links über die konfigurierten Dienste (derzeit urlscan.io). Nur wenn
 * der Nutzer den Auto-Scan aktiviert hat, die globale Zustimmung vorliegt und
 * eine Host-Berechtigung für den Dienst erteilt wurde. Erkannte bösartige
 * Domains werden lokal markiert, damit der Time-of-Click-Schutz sie kennt.
 */
async function scanLinksWithConfiguredProviders(urls, headerMessageId) {
  try {
    if (!autoScanLinks || !mayTransmitExternally() || !urlscanApikey) return;
    if (!(await hasHostPermissionFor('https://urlscan.io/api/v1/scan/'))) return;
    for (const url of urls) {
      try {
        const res = await checkUrlscanIo(url, urlscanApikey);
        if (res && res.status === 'MALICIOUS_VISUAL') {
          markDomainFlagged(domainOfUrl(url));
        }
      } catch (e) {
        Logger.warn('Link check failed for a message link');
      }
    }
  } catch (e) {
    Logger.warn('Automatic link check skipped');
  }
}

async function extractBecProtectionData(message, fullMessage) {
  const senderEmail = extractEmailAddress(message.author);
  const isFirstCommunication = await checkFirstCommunication(senderEmail);
  const replyTo = (fullMessage.headers && fullMessage.headers['reply-to']) ? fullMessage.headers['reply-to'][0] : "";
  const subject = message.subject || "";

  return { senderEmail, isFirstCommunication, replyTo, subject };
}

async function collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache, allowExternal = false }) {
  const authHeaders = (fullMessage.headers && fullMessage.headers['authentication-results']) || [];
  const receivedHeaders = (fullMessage.headers && fullMessage.headers['received']) || [];

  // IP- und Domain-Abfragen nur nach Opt-in (Absender) bzw. ausgelöstem Scan.
  const [maliciousIps, urlhausDomains, becData] = await Promise.all([
    allowExternal ? checkIPReputation(receivedHeaders) : Promise.resolve([]),
    allowExternal ? checkURLhausDomains(filteredUrls, parsedUrlCache) : Promise.resolve([]),
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

async function evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText, parsedUrlCache = null, allowExternal = false }) {
  const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache, allowExternal });
  const threat = calculateThreatScore(message.author, urls, options);
  await injectThreatBanner(tab.id, threat);
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
 * Manifest V3 in Thunderbird removed messageDisplay.getDisplayedMessage();
 * getDisplayedMessages() returns a MessageList instead.
 */
async function getFirstDisplayedMessage(tabId, { throwOnError = false } = {}) {
  if (tabId === undefined || tabId === null) return null;
  try {
    if (browser.messageDisplay && typeof browser.messageDisplay.getDisplayedMessages === 'function') {
      const list = await browser.messageDisplay.getDisplayedMessages(tabId);
      if (!list) return null;
      if (Array.isArray(list)) return list[0] || null;
      if (Array.isArray(list.messages)) return list.messages[0] || null;
      return list || null;
    }
    // Legacy fallback (Manifest V2)
    if (browser.messageDisplay && typeof browser.messageDisplay.getDisplayedMessage === 'function') {
      return await browser.messageDisplay.getDisplayedMessage(tabId);
    }
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
    // Automatische externe Prüfungen sind an das ausdrückliche Opt-in für diesen
    // Absender gebunden (plus globale Zustimmung, Host-Berechtigung und Schlüssel).
    // Ohne Opt-in läuft ausschließlich die lokale Bewertung.
    const automaticScanAllowed = permission && enabledSenders.includes(senderEmail) && !alwaysManual &&
      !!apikey_hybridanalysis && mayTransmitExternally();

    let fullMessage = await browser.messages.getFull(message.id);
    let attachments = [];
    try {
      attachments = await browser.messages.listAttachments(message.id);
    } catch (e) { /* ignore */ }

    await processAttachments(message, { allowExternal: automaticScanAllowed });

    let parsedUrlCache = new Map();
    let { messageText, urls, filteredUrls } = await processLinks(tab, message, fullMessage, parsedUrlCache, { allowExternal: automaticScanAllowed });

    await evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText, parsedUrlCache, allowExternal: automaticScanAllowed });

    if (!automaticScanAllowed && ((attachments && attachments.length > 0) || (filteredUrls && filteredUrls.length > 0))) {
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
const IGNORED_DOMAINS_REGEX = new RegExp(`(?:^|\\.)(${IGNORED_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|')})$`, 'i');

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


async function process_single_attachment(message, attachment, { allowExternal = false } = {}) {
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

            const virustotal_stats = allowExternal
                ? await fetch_virustotal_stats(local_hash, apikey_virustotal)
                : null;

            if (alwaysManual || !allowExternal) {
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


async function sent_to_hybrid_by_attachment(message, attachments, { allowExternal = false } = {}) {
  if (!apikey_hybridanalysis) {
      Logger.error("Kein API-Key gefunden. Bitte in den Einstellungen hinterlegen.");
      return;
  }

  // Begrenzte Parallelität: große Nachrichten sollen den Prozess nicht fluten.
  const results = [];
  for (let i = 0; i < attachments.length; i += ATTACHMENT_SCAN_CONCURRENCY) {
    const batch = attachments.slice(i, i + ATTACHMENT_SCAN_CONCURRENCY);
    results.push(...await Promise.all(
      batch.map(attachment => process_single_attachment(message, attachment, { allowExternal }))
    ));
  }

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
if (browser.messageDisplay) {
    if (browser.messageDisplay.onMessagesDisplayed) {
        browser.messageDisplay.onMessagesDisplayed.addListener(tab_mail_open_display);
    } else if (browser.messageDisplay.onMessageDisplayed) {
        // Legacy fallback (Manifest V2 / Thunderbird < 121)
        browser.messageDisplay.onMessageDisplayed.addListener(tab_mail_open_display);
    }
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
    const createAll = () => {
        for (const menu of menus) {
            try {
                browser.menus.create(menu);
            } catch (e) {
                // Duplicate ids can occur if the background page is restarted.
                Logger.warn('Could not create context menu entry', menu.id, e);
            }
        }
    };
    // Vor dem Anlegen aufräumen, damit ein Neustart des Hintergrundskripts keine
    // Duplikat-IDs hinterlässt.
    try {
        if (typeof browser.menus.removeAll === 'function') {
            const result = browser.menus.removeAll();
            if (result && typeof result.then === 'function') {
                result.then(createAll).catch(createAll);
                return;
            }
        }
    } catch (e) { /* ohne removeAll direkt anlegen */ }
    createAll();
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
        const text = extractTextFromParts(fullMessage);
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

        notify('notificationTitle', 'notificationScanStarted', [url]);

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
 * Sucht den zu einer URL gespeicherten Link-Datensatz (URL-Normalisierung wie
 * beim Speichern: mit und ohne abschließenden Schrägstrich).
 */
function findLinkRecord(record, url) {
    if (!record || !Array.isArray(record.links) || typeof url !== 'string') return null;
    const reqUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const reqUrlSlash = reqUrl + '/';
    for (let i = 0; i < record.links.length; i++) {
        const u = record.links[i].url;
        if (u === reqUrl || u === reqUrlSlash) return record.links[i];
    }
    return null;
}

/**
 * Time-of-Click-Verdikt für einen Link. Ausschließlich LOKAL: URL-Struktur,
 * angezeigter Linktext, eigene Listen, zuvor erkannte bösartige Domains und ein
 * bereits gespeichertes Scan-Ergebnis. Es wird kein Netzwerkdienst aufgerufen.
 */
async function handleCheckLinkState(request, sender, sendResponse) {
    try {
        const url = (request && typeof request.url === 'string') ? request.url : '';
        if (!url) {
            sendResponse({ status: 'error', code: 'invalid_request' });
            return;
        }
        const displayedText = (request && typeof request.displayedText === 'string') ? request.displayedText : '';
        const verdict = evaluateClickRisk(url, { displayedText });

        let storedState = null;
        try {
            const message = await getFirstDisplayedMessage(sender && sender.tab && sender.tab.id);
            if (message && message.headerMessageId) {
                const db = await getSharedDB();
                const record = await getFromStore(db, "hybridanalysis", message.headerMessageId);
                const linkObj = findLinkRecord(record, url);
                if (linkObj && typeof linkObj.state === 'string') storedState = linkObj.state;
            }
        } catch (e) { /* optionale Zusatzinformation */ }

        if (storedState === 'MALICIOUS' || storedState === 'MALICIOUS_VISUAL') {
            verdict.risk = 'high';
            if (!verdict.reasons.includes('tocReasonKnownMalicious')) {
                verdict.reasons.push('tocReasonKnownMalicious');
            }
        }

        const domain = domainOfUrl(url);
        if (domain && flaggedDomains.has(domain)) {
            verdict.risk = 'high';
            if (!verdict.reasons.includes('tocReasonKnownMalicious')) {
                verdict.reasons.push('tocReasonKnownMalicious');
            }
        }

        sendResponse({ status: 'success', data: { risk: verdict.risk, reasons: verdict.reasons, storedState } });
    } catch (err) {
        sendResponse({ status: 'error', code: 'check_failed' });
    }
}

/**
 * Öffnet einen Link, den der Nutzer nach der Time-of-Click-Warnung ausdrücklich
 * freigegeben hat. Nur http(s); alles andere wird abgelehnt.
 */
async function handleOpenLink(request, sendResponse) {
    try {
        const url = (request && typeof request.url === 'string') ? request.url : '';
        let parsed;
        try {
            parsed = new URL(url);
        } catch (e) {
            sendResponse({ status: 'error', code: 'invalid_url' });
            return;
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            sendResponse({ status: 'error', code: 'invalid_url' });
            return;
        }
        const tab = await browser.tabs.create({ url: parsed.href });
        sendResponse({ status: 'success', data: { tabId: tab && tab.id !== undefined ? tab.id : null } });
    } catch (err) {
        Logger.warn('Could not open the link', err);
        sendResponse({ status: 'error', code: 'open_failed' });
    }
}

async function checkHybridAnalysisVerdict(hybrid_sha256, fallbackState) {
    if (hybrid_sha256 && apikey_hybridanalysis && mayTransmitExternally()) {
        const overviewOptions = getHybridAnalysisOptions('GET');
        overviewOptions.url = 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha256;
        try {
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
        // Vollständiger MessageHeader (mit author/headerMessageId) - ein Objekt
        // mit nur einer id würde die Bewertung mit einem TypeError abbrechen.
        let messageObj = null;
        try {
            messageObj = await browser.messages.get(request.messageId);
        } catch (e) { /* fallback unten */ }
        if (!messageObj) {
            messageObj = await getFirstDisplayedMessage(
                (sender && sender.tab && sender.tab.id !== undefined) ? sender.tab.id : request.tabId
            );
        }
        if (!messageObj) {
            return { success: false, error: 'message_not_found' };
        }
        await processAttachments(messageObj, { allowExternal: true });
        const fullMessage = await browser.messages.getFull(request.messageId);
        const tabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : (request.tabId || null);
        const tab = { id: tabId };
        const parsedUrlCache = new Map();
        const { messageText, urls, filteredUrls } = await processLinks(tab, messageObj, fullMessage, parsedUrlCache, { allowExternal: true });
        await evaluateAndInjectThreats({ tab, message: messageObj, fullMessage, urls, filteredUrls, messageText, parsedUrlCache, allowExternal: true });
        return { success: true, persisted: request.persist === true };
    } catch (e) {
        Logger.error('requestScan failed', e);
        return { success: false, error: e && e.message ? e.message : String(e) };
    }
}

/**
 * Holt das Hybrid-Analysis-Overview zu einem SHA-256-Hash für das Popup.
 * Läuft vollständig durch die zentrale Schranke: ohne globale Zustimmung, ohne
 * Host-Berechtigung oder ohne Schlüssel wird nichts übertragen.
 */
async function handleGetHybridOverview(request) {
    try {
        if (!request || typeof request.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(request.sha256)) {
            return { status: 'error', code: 'invalid_request', message: 'invalid sha256' };
        }
        if (!mayTransmitExternally()) {
            return { status: 'error', code: EXTERNAL_ANALYSIS_DISABLED, message: msg('bannerConsentMissing') };
        }
        if (!apikey_hybridanalysis) {
            return { status: 'error', code: 'no_api_key', message: msg('bannerNoApiKey', 'No API key for Hybrid Analysis configured.') };
        }
        if (!(await hasHybridPermission())) {
            return { status: 'error', code: 'permission_denied', message: msg('bannerPermissionDenied') };
        }
        const options = getHybridAnalysisOptions('GET');
        options.url = 'https://hybrid-analysis.com/api/v2/overview/' + request.sha256;
        const response = await apiGateway.fetchWithTimeout(options.url, options);
        if (response.status !== 200) {
            return { status: 'error', code: 'http_' + response.status, message: 'HTTP ' + response.status };
        }
        return { status: 'success', data: await response.json() };
    } catch (e) {
        Logger.warn('Overview lookup failed:', e && e.name ? e.name : 'error');
        return { status: 'error', code: 'network_error', message: e && e.message ? e.message : String(e) };
    }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request && request.action) {
        case "uploadAttachment":
            handleManualUpload(request.messageId, request.partName, request.attachmentName, request.hash, request.headerMessageId)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message}));
            return true;

        case "scanUrl":
            handleUrlScan(request.url, request.headerMessageId)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message}));
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

        case "getHybridOverview":
            handleGetHybridOverview(request)
                .then(res => sendResponse(res))
                .catch(err => sendResponse({ status: 'error', code: 'network_error', message: err.message }));
            return true;

        case "openLink":
            handleOpenLink(request, sendResponse);
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
