function uiText(key, fallback, params = []) {
    return typeof ThundyI18n !== 'undefined' ? ThundyI18n.get(key, params) : params.reduce((text, value, i) => text.replaceAll('$' + (i + 1), String(value)), fallback);
}

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
    bannerAuthPass: 'Trusted server reports SPF/DKIM/DMARC passed',
    bannerOpenOptions: 'Open options',
    bannerSenderOptIn: 'This sender is now scanned automatically.',
    errorHostPermissionMissing: 'Host permission for the analysis service is missing. Please grant it in the add-on options.',
    errorTierUploadBlocked: 'Uploading attachments is disabled in the privacy tier "Strict". Switch to "Balanced" or "Maximum" in the add-on options.',
    errorTierUrlScanBlocked: 'Submitting URLs is only allowed in the privacy tier "Maximum". Change the tier in the add-on options.',
    notificationInjectionFailed: 'The banner could not be inserted into the message view. Please report this with your Thunderbird version.',
    bannerTierBlocked: 'This action is not allowed by the current privacy tier. See the add-on options.',
    notificationScanCount: 'Submitted scans: $COUNT$',
    notificationScanStarted: 'Scan started for: $URL$',
    notificationScanSubmitted: 'Scan submitted successfully. Job ID: $JOBID$',
    notificationScanError: 'Scan error: $ERROR$',
    notificationTitle: 'Thundy AV Scanner',
    notificationTitleError: 'Thundy AV Scanner error',
    notificationNoLinks: 'No links found in this message.'
};

function msg(key, subs) {
    if (typeof ThundyI18n !== 'undefined') return ThundyI18n.get(key, subs || []);
    try {
        if (typeof browser !== 'undefined' && browser.i18n && typeof browser.i18n.getMessage === 'function') {
            const value = browser.i18n.getMessage(key, subs);
            if (value) return value;
        }
    } catch (e) { /* fall through to the fallback string */ }
    let text = I18N_FALLBACKS[key] || key;
    const values = Array.isArray(subs) ? subs.slice() : (subs === undefined ? [] : [subs]);
    text = text.replace(/\$(SCORE|URL|JOBID|ERROR)\$/g, () => (values.length ? String(values.shift()) : ''));
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
        sharedDBPromise = openDB("thunderbird_av", 3).then(async db => {
            if (typeof pruneStore === 'function') await pruneStore(db, 'hybridanalysis');
            return db;
        }).catch(error => { sharedDBPromise = null; throw error; });
    }
    return sharedDBPromise;
}

const knownSendersCache = new Set();
const MAX_KNOWN_SENDERS = 1000;

const urlhausCache = typeof ExpiringMap !== 'undefined' ? new ExpiringMap() : new Map();
const MAX_URLHAUS_CACHE_SIZE = 1000;

const ipReputationCache = typeof ExpiringMap !== 'undefined' ? new ExpiringMap() : new Map();
const MAX_IP_CACHE = 1000;

const vtCache = typeof ExpiringMap !== 'undefined' ? new ExpiringMap() : new Map();
const MAX_VT_CACHE_SIZE = 1000;



// Precompiled Regexes for Performance
const GLOBAL_IPV4_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

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
apiGateway.beforeRequest = () => assertExternalAnalysisAllowed();

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
  if (area === 'local') {
    if (changes.externalAnalysisConsent && changes.externalAnalysisConsent.newValue !== true) {
      if (typeof apiGateway.abortAll === 'function') apiGateway.abortAll();
    }
    if (['externalAnalysisConsent', 'ipReputationProvider', 'ipReputationApiKey', 'apikey', 'virustotalApikey', 'urlhausApikey', 'urlscanApikey'].some(key => changes[key])) {
      urlhausCache.clear(); ipReputationCache.clear(); vtCache.clear();
    }
  }

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

                // ⚡ Bolt Optimization: Manual charCodeAt calculation avoids substring allocation entirely
                let part1 = 0;
                let idx = 0;
                for (; idx < ip.length; idx++) {
                    let c = ip.charCodeAt(idx);
                    if (c === 46) break;
                    part1 = part1 * 10 + (c - 48);
                }

                if (part1 === 10 || part1 === 127 || part1 === 0) {
                    continue;
                }

                idx++;
                let part2 = 0;
                for (; idx < ip.length; idx++) {
                    let c = ip.charCodeAt(idx);
                    if (c === 46) break;
                    part2 = part2 * 10 + (c - 48);
                }

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





async function processAndUploadUrls(message, filteredUrls, allowExternal = true, manualAction = false) {
    if (allowExternal && (manualAction || (!alwaysManual && autoScanLinks)) && privacyTier === 'max' && mayTransmitExternally()) {
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
                    Logger.error('Automatic URL upload failed');
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

        for (let i = 0; i < Math.min(publicIps.length, 20); i++) {
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
        for (const domain of Array.from(linkDomainsSet).slice(0, 100)) {

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
                if (isMalicious === null) urlhausCache.delete(domain);
                else urlhausCache.set(domain, isMalicious);
                if (isMalicious) urlhausDomains.push(domain);
            }));
        }

        if (domainChecks.length > 0) {
            await Promise.all(domainChecks);
        }
    }
    return urlhausDomains;
}



async function processAttachments(message, allowExternal = true, manualAction = false) {
  let attachments = await browser.messages.listAttachments(message.id);

  if (attachments.length > 0) {
    await sent_to_hybrid_by_attachment(message, attachments, allowExternal, manualAction);
  }
}

async function processLinks(tab, message, fullMessage, parsedUrlCache = null, allowExternal = true, manualAction = false) {
  let messageText = extractTextFromParts(fullMessage.parts || fullMessage);
  let urls = extractUrls(messageText);
  let filteredUrls = filterUrls(urls, parsedUrlCache);

  if (filteredUrls.length > 0) {
    await processAndUploadUrls(message, filteredUrls, allowExternal, manualAction);
  }

  // Wenn timeOfClickProtection aktiv ist, senden wir eine Nachricht an den Content-Script
  await injectTimeOfClickProtection(tab.id, filteredUrls, message.id);

  return { messageText, urls, filteredUrls };
}

async function extractBecProtectionData(message, fullMessage) {
  const senderEmail = extractEmailAddress(message.author);
  const isFirstCommunication = await checkFirstCommunication(senderEmail);
  const replyTo = (fullMessage.headers && fullMessage.headers['reply-to']) ? fullMessage.headers['reply-to'][0] : "";
  const subject = message.subject || "";

  return { senderEmail, isFirstCommunication, replyTo, subject };
}

async function collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache, allowExternal = true }) {
  const rawAuthHeaders = (fullMessage.headers && fullMessage.headers['authentication-results']) || [];
  const settings = await browser.storage.local.get('trustedAuthServers');
  const trusted = new Set((settings.trustedAuthServers || []).map(host => host.toLowerCase()));
  const first = rawAuthHeaders[0] || '';
  const authServer = first.split(';')[0].trim().toLowerCase();
  const authHeaders = trusted.has(authServer) ? [first] : [];
  const receivedHeaders = (fullMessage.headers && fullMessage.headers['received']) || [];

  const [maliciousIps, urlhausDomains, becData] = await Promise.all([
    allowExternal ? checkIPReputation(receivedHeaders) : [],
    allowExternal ? checkURLhausDomains(filteredUrls, parsedUrlCache) : [],
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

async function evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText, parsedUrlCache = null, allowExternal = true }) {
  const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache, allowExternal });
  const threat = calculateThreatScore(message.author, urls, options);
  await injectThreatBanner(tab.id, threat);
}

/**
 * Injects the per-message opt-in banner.
 * Two explicit actions: scan this message once (no persistent opt-in) or
 * enable scanning for this sender permanently.
 */


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
    const allowExternal = await authorizeMessageScan(message);
    const canAutoUpload = permission && enabledSenders.includes(senderEmail) && !alwaysManual &&
      !!apikey_hybridanalysis && mayTransmitExternally();

    let fullMessage = await browser.messages.getFull(message.id);
    let attachments = [];
    try {
      attachments = await browser.messages.listAttachments(message.id);
    } catch (e) { /* ignore */ }

    await processAttachments(message, allowExternal);

    let parsedUrlCache = new Map();
    let { messageText, urls, filteredUrls } = await processLinks(tab, message, fullMessage, parsedUrlCache, allowExternal);

    await evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText, parsedUrlCache, allowExternal });

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

  if (Array.isArray(part)) {
      for (const child of part) extractTextFromParts(child, outObj);
      return isRoot ? outObj.text : undefined;
  }
  if (!part) return isRoot ? outObj.text : undefined;
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

const EXTRACT_URLS_REGEX = /https?:\/\/[^\s"'<>]+/g;
function extractUrls(text) {
    const urlSet = new Set();
    let match;
    EXTRACT_URLS_REGEX.lastIndex = 0;
    while ((match = EXTRACT_URLS_REGEX.exec(text)) !== null) {
        let url = match[0];
        let len = url.length;
        while(len > 0) {
            let c = url.charCodeAt(len - 1);
            if (c === 46 || c === 44 || c === 59 || c === 58 || c === 33 || c === 41 || c === 93) {
                len--;
            } else {
                break;
            }
        }
        if (len !== url.length) {
            url = url.substring(0, len);
        }
        // ⚡ Bolt Optimization: Native RegExp matching paired with O(1) Set deduplication outperforms manual string iteration.
        urlSet.add(url);
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


async function process_single_attachment(message, attachment, allowExternal = true, manualAction = false) {
    if (attachment.size > 25 * 1024 * 1024) {
        const item = create_manual_check_hybrid_data('', attachment, null);
        item.hybrid_data.state = 'SIZE_LIMIT';
        return item;
    }
    let file = await browser.messages.getAttachmentFile(message.id, attachment.partName);

        try {
            const content_of_attachment = file.slice();
            const arrayBuffer = await content_of_attachment.arrayBuffer();
            const local_hash = await get_sha256_hash(arrayBuffer);

            const virustotal_stats = allowExternal ? await fetch_virustotal_stats(local_hash, apikey_virustotal) : null;

            if (!allowExternal || (alwaysManual && !manualAction) || !apikey_hybridanalysis || !mayTransmitExternally()) {
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


async function sent_to_hybrid_by_attachment(message, attachments, allowExternal = true, manualAction = false) {

  const selected = attachments.slice(0, 100);
  const results = typeof mapWithLimit !== 'undefined'
      ? await mapWithLimit(selected, 2, attachment => process_single_attachment(message, attachment, allowExternal, manualAction))
      : await Promise.all(selected.map(attachment => process_single_attachment(message, attachment, allowExternal, manualAction)));

  const validResults = results.filter(r => r !== null);
  if (validResults.length > 0) {
      await indexedDB_save_batch_hybrid_data_to_db(message, validResults);
  }
}

async function indexedDB_save_batch_hybrid_data_to_db(message, results) {
  if (!message.headerMessageId && message.id != null) message = { ...message, headerMessageId: 'message:' + message.id };
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
        recordToSave.updatedAt = Date.now();
        return recordToSave;
      });
    }
  } catch (error) {
    Logger.error('Fehler bei der Batch-Interaktion mit der Datenbank:', error);
  }
}

// Speicherung der Ergebnisse in IndexedDB
async function indexedDB_save_links_objects_to_db(message, urlObjects) {
  if (!message.headerMessageId && message.id != null) message = { ...message, headerMessageId: 'message:' + message.id };
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
        recordToSave.updatedAt = Date.now();
        return recordToSave;
      });
    }
  } catch (error) {
    Logger.error('IndexedDB (Links) Save Error:', error);
  }
}

async function indexedDB_save_links_to_db(message, urls) {
  if (!message.headerMessageId && message.id != null) message = { ...message, headerMessageId: 'message:' + message.id };
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
        recordToSave.updatedAt = Date.now();
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
        notify('notificationTitleError', 'notificationScanError', [uiText('noMessageFound', 'No displayed message found')]);
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
        notify('notificationTitle', 'notificationScanCount', [String(submitted)]);
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

async function handleCheckLinkState(request, sender, sendResponse) {
    try {
        // Need to find the active message to get headerMessageId
        const message = await getFirstDisplayedMessage(sender && sender.tab && sender.tab.id, { throwOnError: true });
        if (!message || !message.headerMessageId || (request.messageId != null && request.messageId !== message.id)) {
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
        if (request.userAction === true && urlscanApikey && tierAtLeast('max') && (!linkObj || linkObj.state === 'UNKNOWN')) {
            try {
                const res = await checkUrlscanIo(request.url, urlscanApikey);
                if (res && res.status !== 'ERROR' && res.status !== 'TIMEOUT' && res.status !== 'NOT_CHECKED') {
                    // Wir überschreiben das Verhalten: Wenn es Visuelles Phishing ist, sofort warnen
                    sendResponse({ status: res.status, reasons: res.reasons });
                    return;
                }
            } catch (e) {
                Logger.error("Fehler bei Time-of-Click Live-Scan:", e);
            }
        }

        if (linkObj) {
            const status = request.userAction === true ? await checkHybridAnalysisVerdict(linkObj.hybrid_sha256, linkObj.state) : linkObj.state;
            sendResponse({status: status});
        } else {
            sendResponse({status: 'UNKNOWN'});
        }
    } catch (err) {
        sendResponse({status: 'ERROR'});
    }
}

// Message documents cannot navigate reliably. Use Thunderbird's external-browser API.
async function handleOpenCheckedLink(request, sender) {
    try {
        const tabId = sender && sender.tab && sender.tab.id;
        if (tabId == null || request.messageId == null || typeof request.url !== 'string') return { success: false };
        const url = new URL(request.url);
        if (!['http:', 'https:'].includes(url.protocol)) return { success: false };
        const message = await getFirstDisplayedMessage(tabId, { throwOnError: true });
        if (!message || message.id !== request.messageId) return { success: false };
        await browser.windows.openDefaultBrowser(url.href);
        return { success: true };
    } catch (error) {
        Logger.warn('Could not open confirmed link in the default browser', error);
        return { success: false };
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
    let granted = !apikey_hybridanalysis || await hasHybridPermission();
    if (!granted) {
        try {
            granted = await browser.permissions.request({ origins: [PROVIDER_ORIGINS.hybridanalysis] });
        } catch (e) { granted = false; }
    }

    if (!granted) {
        return { success: false, error: 'permission_denied' };
    }

    try {
        const messageObj = await browser.messages.get(request.messageId);
        if (request.persist === true && messageObj.author) {
            await addSenderOptIn(extractEmailAddress(messageObj.author));
        }
        await processAttachments(messageObj, true, true);
        const fullMessage = await browser.messages.getFull(request.messageId);
        const tabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : (request.tabId || null);
        const tab = { id: tabId };
        const parsedUrlCache = new Map();
        const { messageText, urls, filteredUrls } = await processLinks(tab, messageObj, fullMessage, parsedUrlCache, true, true);
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
        case "getLocalRisk":
            (async () => {
                const message = await browser.messages.get(request.messageId);
                const fullMessage = await browser.messages.getFull(request.messageId);
                const messageText = extractTextFromParts(fullMessage.parts || fullMessage);
                const urls = filterUrls(extractUrls(messageText));
                const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls: urls, messageText, allowExternal: false });
                return calculateThreatScore(message.author, urls, options);
            })().then(threat => sendResponse({ status: 'success', threat })).catch(() => sendResponse({ status: 'error' }));
            return true;
        case "clearMemoryCaches":
            urlhausCache.clear(); ipReputationCache.clear(); vtCache.clear(); knownSendersCache.clear();
            if (browser.runtime.sendMessage) browser.runtime.sendMessage({ action: 'memoryCachesCleared' }).catch(() => {});
            sendResponse({ status: 'success' });
            return false;
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

        case "openCheckedLink":
            handleOpenCheckedLink(request, sender).then(sendResponse);
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

async function handleUrlScan(url, headerMessageId) {
    if (!apikey_hybridanalysis) throw new Error(uiText("ui_086", "API-Key fehlt."));
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
        throw new Error(uiText("ui_099", "Fehler beim URL-Scan: ") + String(response.status));
    }
}

async function handleManualUpload(messageId, partName, attachmentName, hash, headerMessageId) {
    if (!apikey_hybridanalysis) throw new Error(uiText("ui_086", "API-Key fehlt."));
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
        throw new Error(uiText("ui_060", "Fehler beim Upload: ") + String(response.status));
    }
}
