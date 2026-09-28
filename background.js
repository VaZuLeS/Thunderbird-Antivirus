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
    notificationScanFinished: 'Analysis finished: $NAME$ - verdict: $VERDICT$',
    notificationScanTimeout: 'No analysis result received in time for: $NAME$',
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
 * Injects content into the message display of a tab.
 *
 * Thunderbird's documented Manifest V3 way to place UI into displayed messages
 * is a registered message display script (`scripting.messageDisplay.registerScripts`).
 * This helper is the fallback for already open messages: it injects the same
 * bundled script file (and its stylesheet) into the message display document.
 */
async function injectIntoMessageDisplay(tabId, injection) {
    if (tabId === undefined || tabId === null) return null;
    const details = Object.assign({ target: { tabId } }, injection || {});
    try {
        if (browser.scripting && browser.scripting.messageDisplay &&
            typeof browser.scripting.messageDisplay.executeScript === 'function') {
            return await browser.scripting.messageDisplay.executeScript(details);
        }
        return await browser.scripting.executeScript(details);
    } catch (e) {
        Logger.warn('Injecting into the message display failed (please report with your Thunderbird version):', e);
        return null;
    }
}

const MESSAGE_DISPLAY_SCRIPT_ID = 'thundy-av-banner';
const MESSAGE_DISPLAY_SCRIPT_FILES = ['messageDisplay/banner.js'];
const MESSAGE_DISPLAY_SCRIPT_CSS = ['messageDisplay/banner.css'];

let messageDisplayScriptRegistered = false;

/**
 * Registers the message display script once per background start. Registered
 * scripts are automatically injected into newly opened messages.
 */
async function registerMessageDisplayScript() {
    try {
        if (!browser.scripting || !browser.scripting.messageDisplay ||
            typeof browser.scripting.messageDisplay.registerScripts !== 'function') {
            Logger.warn('scripting.messageDisplay.registerScripts is not available - falling back to per-message injection');
            return false;
        }
        await browser.scripting.messageDisplay.registerScripts([{
            id: MESSAGE_DISPLAY_SCRIPT_ID,
            js: MESSAGE_DISPLAY_SCRIPT_FILES.map(file => ({ file })),
            css: MESSAGE_DISPLAY_SCRIPT_CSS.map(file => ({ file })),
            runAt: 'document_idle'
        }]);
        messageDisplayScriptRegistered = true;
        return true;
    } catch (e) {
        Logger.warn('Registering the message display script failed - falling back to per-message injection:', e);
        return false;
    }
}

/** Makes sure the banner script runs in the given message display tab. */
async function ensureMessageDisplayScript(tabId) {
    if (messageDisplayScriptRegistered) return true;
    await injectIntoMessageDisplay(tabId, { files: MESSAGE_DISPLAY_SCRIPT_FILES });
    try {
        if (browser.scripting && typeof browser.scripting.insertCSS === 'function') {
            await browser.scripting.insertCSS({ target: { tabId }, files: MESSAGE_DISPLAY_SCRIPT_CSS });
        }
    } catch (e) { /* styles are cosmetic */ }
    return false;
}

// ---------------------------------------------------------------------------
// Auftragswarteschlange fuer zeitverzoegerte Analysen
//
// Die Schnellanalyse von Hybrid Analysis ist asynchron: Nach dem Upload liegt das
// Ergebnis erst nach einigen Minuten vor. Auftraege werden deshalb lokal gespeichert
// (sie ueberleben einen Neustart des Hintergrundskripts), per browser.alarms
// regelmaessig nachgefragt und danach in den Nachrichten-Cache geschrieben.
// Lokale Pruefungen (Heuristik, Auth-Header, Links, Hash) laufen dagegen sofort.
// ---------------------------------------------------------------------------
const PENDING_SCANS_KEY = 'pendingScans';
const SCAN_ALARM_NAME = 'thundy-pending-scan-check';
const SCAN_POLL_INTERVAL_MINUTES = 1;
const SCAN_MAX_ATTEMPTS = 30;
const SCAN_MAX_AGE_MS = 90 * 60 * 1000; // nach 90 Minuten aufgeben

// Anzeige-Zustaende eines Auftrags:
//   queued    - Upload gestartet, noch keine Antwort des Anbieters
//   running   - Anbieter hat den Auftrag angenommen, Analyse laeuft (zeitverzoegert)
//   finished  - Ergebnis liegt vor (Verdikt wurde uebernommen)
//   timeout   - Anbieter hat innerhalb des Zeitfensters kein Ergebnis geliefert
//   failed    - Fehler beim Upload oder bei der Abfrage
const SCAN_STATES = ['queued', 'running', 'finished', 'timeout', 'failed'];

async function getPendingScans() {
    try {
        const stored = await browser.storage.local.get(PENDING_SCANS_KEY);
        return Array.isArray(stored[PENDING_SCANS_KEY]) ? stored[PENDING_SCANS_KEY] : [];
    } catch (e) {
        Logger.warn('Auftragsliste konnte nicht gelesen werden:', e);
        return [];
    }
}

async function savePendingScans(jobs) {
    const cleaned = (jobs || []).filter(job => job && job.sha256 && job.state !== 'finished');
    try {
        await browser.storage.local.set({ [PENDING_SCANS_KEY]: cleaned });
    } catch (e) {
        Logger.warn('Auftragsliste konnte nicht gespeichert werden:', e);
    }
    return cleaned;
}

async function upsertPendingScan(job) {
    const jobs = await getPendingScans();
    const index = jobs.findIndex(existing => existing.sha256 === job.sha256 && existing.partName === job.partName);
    if (index >= 0) {
        jobs[index] = Object.assign({}, jobs[index], job);
    } else {
        jobs.push(job);
    }
    const saved = await savePendingScans(jobs);
    await scheduleScanPolling(saved.length > 0);
    return job;
}

async function removePendingScan(sha256, partName) {
    const jobs = await getPendingScans();
    const remaining = jobs.filter(job => !(job.sha256 === sha256 && (partName === undefined || job.partName === partName)));
    const saved = await savePendingScans(remaining);
    await scheduleScanPolling(saved.length > 0);
    return saved;
}

/** Plant (oder beendet) die regelmaessige Nachfrage beim Anbieter. */
async function scheduleScanPolling(active) {
    if (!browser.alarms || typeof browser.alarms.create !== 'function') {
        Logger.warn('browser.alarms ist nicht verfuegbar - zeitverzoegerte Ergebnisse werden nur bei manueller Abfrage geholt.');
        return false;
    }
    try {
        if (!active) {
            if (typeof browser.alarms.clear === 'function') await browser.alarms.clear(SCAN_ALARM_NAME);
            return false;
        }
        await browser.alarms.create(SCAN_ALARM_NAME, {
            delayInMinutes: SCAN_POLL_INTERVAL_MINUTES,
            periodInMinutes: SCAN_POLL_INTERVAL_MINUTES
        });
        return true;
    } catch (e) {
        Logger.error('Alarm konnte nicht eingerichtet werden:', e);
        return false;
    }
}

/** Beschreibt einen Auftrag fuer die Anzeige in Banner und Popup. */
function describeScanJob(job) {
    const started = job.startedAt ? new Date(job.startedAt) : null;
    const elapsedMinutes = started ? Math.round((Date.now() - started.getTime()) / 60000) : null;
    return {
        sha256: job.sha256,
        partName: job.partName || null,
        attachmentName: job.attachmentName || null,
        state: job.state,
        timing: 'delayed',
        submissionId: job.submissionId || null,
        jobId: job.jobId || null,
        startedAt: job.startedAt || null,
        lastCheckAt: job.lastCheckAt || null,
        attempts: typeof job.attempts === 'number' ? job.attempts : 0,
        elapsedMinutes,
        verdict: job.verdict || null,
        error: job.error || null,
        canPollNow: job.state === 'queued' || job.state === 'running'
    };
}

/**
 * Fragt fuer alle offenen Auftraege das Ergebnis ab.
 * Wird sowohl vom Alarm als auch manuell (Popup) aufgerufen.
 */
async function pollPendingScans() {
    const jobs = await getPendingScans();
    if (jobs.length === 0) {
        await scheduleScanPolling(false);
        return { checked: 0, finished: 0, pending: 0 };
    }

    let finished = 0;
    const updated = [];

    for (const job of jobs) {
        if (job.state === 'finished') continue;
        if (!mayTransmitExternally() || !apikey_hybridanalysis) {
            // Ohne Zustimmung/Schluessel darf nicht nachgefragt werden.
            updated.push(Object.assign({}, job, { state: 'failed', error: 'Zustimmung oder API-Schluessel fehlt.' }));
            continue;
        }

        const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : Date.now();
        if (Date.now() - startedAt > SCAN_MAX_AGE_MS || (job.attempts || 0) >= SCAN_MAX_ATTEMPTS) {
            updated.push(Object.assign({}, job, { state: 'timeout', error: 'Der Anbieter hat innerhalb des Zeitfensters kein Ergebnis geliefert.' }));
            notify('notificationTitle', 'notificationScanTimeout', [job.attachmentName || job.sha256]);
            continue;
        }

        const result = await fetchHybridVerdictForJob(job);
        if (result && result.verdict) {
            await storeJobResult(job, result);
            await removePendingScan(job.sha256, job.partName);
            finished++;
            notify('notificationTitle', 'notificationScanFinished', [job.attachmentName || job.sha256, result.verdict]);
            continue;
        }

        updated.push(Object.assign({}, job, {
            state: 'running',
            attempts: (job.attempts || 0) + 1,
            lastCheckAt: Date.now(),
            error: null
        }));
    }

    const saved = await savePendingScans(updated);
    await scheduleScanPolling(saved.length > 0);
    return { checked: jobs.length, finished, pending: saved.length };
}

/** Holt das Verdikt zu einem Auftrag (null, solange kein Ergebnis vorliegt). */
async function fetchHybridVerdictForJob(job) {
    if (!job || !job.sha256) return null;
    const options = getHybridAnalysisOptions('GET');
    options.url = 'https://hybrid-analysis.com/api/v2/overview/' + job.sha256;
    try {
        const response = await apiGateway.fetchWithTimeout(options.url, options);
        if (response.status !== 200) return null;
        const data = await response.json();
        const verdict = data && data.verdict ? String(data.verdict) : null;
        if (!verdict) return null;
        return {
            verdict: verdict === 'no specific threat' ? 'CLEAN' : verdict.toUpperCase(),
            rawVerdict: verdict,
            submissionId: (data && data.submission_id) || job.submissionId || null,
            jobId: (data && data.job_id) || job.jobId || null
        };
    } catch (e) {
        Logger.warn('Ergebnisabfrage fehlgeschlagen:', e);
        return null;
    }
}

/** Schreibt das eingetroffene Ergebnis in den lokalen Nachrichten-Cache. */
async function storeJobResult(job, result) {
    try {
        const db = await getSharedDB();
        if (!job.messageHeaderId) return;
        await updateStore(db, 'hybridanalysis', job.messageHeaderId, (existingRecord) => {
            const record = existingRecord || { messageHeader: job.messageHeaderId, attachments: [], links: [] };
            if (!Array.isArray(record.attachments)) record.attachments = [];
            const index = record.attachments.findIndex(a => a.partName === job.partName);
            const entry = {
                hybrid_submission_id: result.submissionId || 'N/A',
                hybrid_job_id: result.jobId || 'N/A',
                hybrid_sha256: job.sha256,
                attachment_name: job.attachmentName || '',
                partName: job.partName,
                state: 'KNOWN',
                verdict: result.verdict,
                checked_at: new Date().toISOString(),
                timing: 'delayed'
            };
            if (index >= 0) record.attachments[index] = Object.assign({}, record.attachments[index], entry);
            else record.attachments.push(entry);
            return record;
        });
    } catch (e) {
        Logger.error('Ergebnis konnte nicht gespeichert werden:', e);
    }
}

// ---------------------------------------------------------------------------
// Display state
// The background script owns the state (threat score, consent, opt-in need);
// the message display script only renders it. That keeps every provider request
// in the background and makes the injected code unable to transmit anything.
// ---------------------------------------------------------------------------
const displayStates = new Map();

function updateDisplayState(tabId, state) {
    if (tabId === undefined || tabId === null) return;
    displayStates.set(tabId, state);
    pushDisplayState(tabId, state);
}

async function pushDisplayState(tabId, state) {
    try {
        if (browser.tabs && typeof browser.tabs.sendMessage === 'function') {
            await browser.tabs.sendMessage(tabId, { action: 'updateDisplayState', state });
        }
    } catch (e) {
        // The banner script may not be injected yet; it will ask for the state.
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
            return { score: SCORE_WEIGHTS.blacklist, reasons: [`Absender-E-Mail (${email}) steht auf der Blacklist.`], listType: 'blacklist' };
        }
        // ⚡ Bolt Optimization: Replace O(n) array iteration with O(1) set lookups for domain checking
        if (customBlacklist.has(senderDomain)) {
            return { score: SCORE_WEIGHTS.blacklist, reasons: [`Absender-Domain (${senderDomain}) steht auf der Blacklist (${senderDomain}).`], listType: 'blacklist' };
        }
        let dotIdx = senderDomain.indexOf('.');
        while (dotIdx !== -1) {
            let parentDomain = senderDomain.substring(dotIdx + 1);
            if (customBlacklist.has(parentDomain)) {
                return { score: SCORE_WEIGHTS.blacklist, reasons: [`Absender-Domain (${senderDomain}) steht auf der Blacklist (${parentDomain}).`], listType: 'blacklist' };
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

// Gewichte der Einzelsignale. Kein einzelnes schwaches Signal erreicht allein
// die Banner-Schwelle von 50 Punkten - sonst zeigt jedes Newsletter-/Weiterleitungs-
// Postfach dauerhaft "50 von 100" an.
const SCORE_WEIGHTS = {
    spfFail: 25,
    dkimFail: 25,
    dmarcFail: 30,
    authTotalCap: 60,
    replyToMismatch: 25,
    firstContactWithUrgency: 25,
    urgencyOnly: 10,
    firstContactOnly: 5,
    linkDomainMismatch: 25,
    linkTyposquatting: 45,
    senderTyposquatting: 60,
    urlhausDomain: 80,
    maliciousIp: 50,
    maliciousIpCap: 70,
    blacklist: 100
};

function evaluateAuthHeaders(authHeaders, score, reasons) {
    let authStatus = 'neutral';
    if (authHeaders && authHeaders.length > 0) {
        const headerStr = authHeaders.join(' ').toLowerCase();
        let fail = false;
        let authScore = 0;

        if (headerStr.includes("spf=fail") || headerStr.includes("spf=softfail")) {
            authScore += SCORE_WEIGHTS.spfFail;
            reasons.push("SPF-Prüfung fehlgeschlagen (Mögliches Spoofing).");
            fail = true;
        }
        if (headerStr.includes("dkim=fail")) {
            authScore += SCORE_WEIGHTS.dkimFail;
            reasons.push("DKIM-Signatur ungültig (Mögliches Spoofing).");
            fail = true;
        }
        if (headerStr.includes("dmarc=fail")) {
            authScore += SCORE_WEIGHTS.dmarcFail;
            reasons.push("DMARC-Prüfung fehlgeschlagen (Mögliches Spoofing).");
            fail = true;
        }

        score += Math.min(authScore, SCORE_WEIGHTS.authTotalCap);

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
            score += SCORE_WEIGHTS.urlhausDomain;
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
            score += SCORE_WEIGHTS.replyToMismatch;
            reasons.push(`Diskrepanz erkannt: "Reply-To" Domain (${replyDomain}) weicht von der Absender-Domain (${senderDomain}) ab.`);
        }
    }
    return score;
}

/**
 * Bewertet Dringlichkeits-Sprache und (optional) den Erstkontakt.
 * `isFirstCommunication` ist dreiwertig: true = Erstkontakt, false = bekannter
 * Absender, null = unbekannt/nicht ermittelbar (keine Punkte, kein Raten).
 */
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
        if (isFirstCommunication === true) {
            score += SCORE_WEIGHTS.firstContactWithUrgency;
            reasons.push(`Mögliches BEC: Erste Kommunikation mit diesem Absender kombiniert mit Dringlichkeits-Signalwörtern (${foundUrgencyWords.join(', ')}).`);
        } else {
            score += SCORE_WEIGHTS.urgencyOnly;
            reasons.push(`Dringlichkeits-Signalwörter gefunden (${foundUrgencyWords.join(', ')}). Bitte prüfen Sie die Anfrage sorgfältig.`);
        }
    } else if (isFirstCommunication === true) {
        score += SCORE_WEIGHTS.firstContactOnly;
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
                    score += SCORE_WEIGHTS.senderTyposquatting;
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
            score += SCORE_WEIGHTS.linkDomainMismatch;
            if (!reasons.some(r => r.includes('Keiner der Links'))) {
                 reasons.push(`Keiner der Links im Text verweist auf die Absender-Domain (${senderDomain}).`);
            }
        }
        if (typosquatLinkFound) {
            score += SCORE_WEIGHTS.linkTyposquatting;
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

function evaluateMaliciousIps(maliciousIps, score, reasons) {
    if (!maliciousIps || maliciousIps.length === 0) return score;
    let ipScore = 0;
    for (const ip of maliciousIps) {
        ipScore += SCORE_WEIGHTS.maliciousIp;
        reasons.push(`IP-Adresse (${ip}) aus den Received-Headern ist als bösartig gemeldet.`);
    }
    return score + Math.min(ipScore, SCORE_WEIGHTS.maliciousIpCap);
}

function calculateThreatScore(author, urls, options = {}) {
    const {
        authHeaders = [],
        urlhausDomains = [],
        isFirstCommunication = null,
        messageText = "",
        subject = "",
        replyTo = "",
        maliciousIps = [],
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
    score = evaluateMaliciousIps(maliciousIps, score, reasons);
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

/** Time-of-Click hints are rendered by the message display script. */
function injectTimeOfClickProtection(tabId, filteredUrls) {
    const state = displayStates.get(tabId);
    const urls = timeOfClickProtection ? (filteredUrls || []) : [];
    updateDisplayState(tabId, Object.assign({
        mode: (state && state.mode) || 'pending',
        timeOfClickProtection,
        urls
    }, state || {}));
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

/**
 * Ermittelt, ob es die erste Kommunikation mit diesem Absender ist.
 *
 * Rueckgabe: true = Erstkontakt, false = bekannter Absender, null = unbekannt
 * (Nachrichtenabfrage nicht verfuegbar oder fehlgeschlagen). "Unbekannt" gibt
 * bewusst keine Punkte, sonst wuerde jede Nachricht als Erstkontakt gelten und
 * die Bewertung dauerhaft dieselbe Punktzahl liefern.
 */
async function checkFirstCommunication(senderEmail) {
    if (!senderEmail) return null;

    const normalized = senderEmail.toLowerCase();
    if (knownSendersCache.has(normalized) || await isKnownSenderStored(normalized)) {
        knownSendersCache.add(normalized);
        return false;
    }

    if (!browser.messages || typeof browser.messages.query !== 'function') {
        return null;
    }

    try {
        // Nachrichten VON diesem Absender suchen (nicht an ihn).
        const previousMsgs = await browser.messages.query({ from: senderEmail });
        if (!previousMsgs || !Array.isArray(previousMsgs.messages)) {
            return null;
        }
        if (previousMsgs.messages.length === 0) {
            await rememberSender(normalized);
            return true;
        }
        await rememberSender(normalized);
        return false;
    } catch (e) {
        Logger.warn('messages.query ist nicht verfuegbar; Erstkontakt bleibt unbekannt:', e);
        return null;
    }
}

async function isKnownSenderStored(senderEmail) {
    try {
        const stored = await browser.storage.local.get('knownSenders');
        return Array.isArray(stored.knownSenders) && stored.knownSenders.includes(senderEmail);
    } catch (e) {
        return false;
    }
}

/** Merkt sich einen Absender dauerhaft (MV3-Eventpages verlieren den Speicher). */
async function rememberSender(senderEmail) {
    if (knownSendersCache.size >= MAX_KNOWN_SENDERS) {
        knownSendersCache.delete(knownSendersCache.keys().next().value);
    }
    knownSendersCache.add(senderEmail);

    try {
        const stored = await browser.storage.local.get('knownSenders');
        const list = Array.isArray(stored.knownSenders) ? stored.knownSenders.slice() : [];
        if (!list.includes(senderEmail)) {
            list.push(senderEmail);
            while (list.length > MAX_KNOWN_SENDERS) list.shift();
            await browser.storage.local.set({ knownSenders: list });
        }
    } catch (e) {
        Logger.warn('Absender konnte nicht gespeichert werden:', e);
    }
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

/** Threat banner/badge is rendered by the message display script. */
function injectThreatBanner(tabId, threat) {
    const state = displayStates.get(tabId) || { mode: 'pending' };
    updateDisplayState(tabId, Object.assign({}, state, { threat }));
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
  const previous = displayStates.get(tab.id) || {};
  updateDisplayState(tab.id, Object.assign({}, previous, {
    mode: 'ready',
    messageId: message && message.id,
    threat,
    timeOfClickProtection,
    urls: timeOfClickProtection ? (filteredUrls || []) : []
  }));
}

/** The per-message opt-in banner is rendered by the message display script. */
function injectOptInBanner(tabId, messageId, senderEmail, consentGiven) {
    const state = displayStates.get(tabId) || { mode: 'pending' };
    updateDisplayState(tabId, Object.assign({}, state, {
        messageId,
        senderEmail,
        showOptIn: true,
        consent: consentGiven === true
    }));
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

    // Zustand zuerst setzen: das Nachrichten-Script fragt ihn ab und rendert
    // anschließend die Banner, sobald der Scan abgeschlossen ist.
    updateDisplayState(tab.id, {
      mode: 'pending',
      messageId: message.id,
      senderEmail,
      consent: mayTransmitExternally()
    });

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

    const evaluationOptions = await collectThreatEvaluationOptions({
      message, fullMessage, filteredUrls, messageText, parsedUrlCache
    });
    const threat = calculateThreatScore(message.author, urls, evaluationOptions);

    const showOptIn = !canAutoUpload &&
      ((attachments && attachments.length > 0) || (filteredUrls && filteredUrls.length > 0));

    updateDisplayState(tab.id, {
      mode: 'ready',
      messageId: message.id,
      senderEmail,
      permission,
      consent: mayTransmitExternally(),
      canAutoUpload,
      showOptIn,
      threat,
      timeOfClickProtection,
      urls: timeOfClickProtection ? (filteredUrls || []) : []
    });

    await ensureMessageDisplayScript(tab.id);
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

async function handle_unknown_attachment({ attachment, content_of_attachment, local_hash, virustotal_stats, privacyTier, fileType, messageHeaderId, messageId }) {
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

                // Auch automatische Uploads laufen asynchron beim Anbieter.
                await upsertPendingScan({
                    sha256: uploadData.sha256 || local_hash,
                    partName: attachment.partName,
                    attachmentName: attachment.name,
                    messageId: messageId || null,
                    messageHeaderId: messageHeaderId || null,
                    submissionId: uploadData.submission_id || null,
                    jobId: uploadData.job_id || null,
                    state: 'running',
                    attempts: 0,
                    startedAt: Date.now(),
                    lastCheckAt: Date.now()
                });

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

async function check_hybrid_analysis_for_attachment(local_hash, attachment, content_of_attachment, virustotal_stats, file_type, context = {}) {
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
        fileType: file_type,
        messageHeaderId: context.messageHeaderId || null,
        messageId: context.messageId || null
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
                file.type,
                { messageId: message.id, messageHeaderId: message.headerMessageId }
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
if (browser.messageDisplay) {
    if (browser.messageDisplay.onMessagesDisplayed) {
        browser.messageDisplay.onMessagesDisplayed.addListener(tab_mail_open_display);
    } else if (browser.messageDisplay.onMessageDisplayed) {
        // Legacy fallback (Manifest V2 / Thunderbird < 121)
        browser.messageDisplay.onMessageDisplayed.addListener(tab_mail_open_display);
    }
}

// Das Banner-Script wird einmal registriert (dokumentierter MV3-Weg) und greift
// damit automatisch in allen neu geöffneten Nachrichten.
registerMessageDisplayScript();

// Zeitverzoegerte Ergebnisse: Alarm einrichten/abholen und beim Start offene Auftraege pruefen.
if (browser.alarms) {
    if (browser.alarms.onAlarm && typeof browser.alarms.onAlarm.addListener === 'function') {
        browser.alarms.onAlarm.addListener(async (alarm) => {
            if (!alarm || alarm.name !== SCAN_ALARM_NAME) return;
            try {
                const summary = await pollPendingScans();
                Logger.info('Zeitverzoegerte Analyse-Abfrage:', summary);
            } catch (e) {
                Logger.error('Abfrage zeitverzoegerter Ergebnisse fehlgeschlagen:', e);
            }
        });
    }
    // Nach einem Neustart des Hintergrundskripts: offene Auftraege weiter verfolgen.
    getPendingScans().then(jobs => {
        if (jobs.length > 0) {
            return scheduleScanPolling(true).then(() => pollPendingScans());
        }
        return undefined;
    }).catch(e => Logger.warn('Offene Auftraege konnten nicht wieder aufgenommen werden:', e));
}


function createContextMenus() {
    if (!browser.menus || typeof browser.menus.create !== 'function') return;
    // "message_display_action" is a documented Thunderbird context for the
    // message display area. The former "link" context is not documented for
    // Thunderbird message bodies and could never be triggered, so it is gone.
    const menus = [
        {
            id: "scan-message-links-thundy",
            title: msg('menuScanMessageLinks', 'Scan all links of this message'),
            contexts: ["message_display_action"]
        }
    ];
    for (const menu of menus) {
        try {
            browser.menus.create(menu);
        } catch (e) {
            // Duplicate ids can occur if the background page is restarted.
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
 * Listet die Anhaenge einer Nachricht auf (rein lokal, keine Uebertragung).
 * Die Anzeige von Dateiname, Typ und Groesse benoetigt keine Zustimmung.
 */
async function listMessageAttachments(messageId) {
    if (!messageId) throw new Error('Keine Nachricht angegeben.');
    const attachments = await browser.messages.listAttachments(messageId);
    return (attachments || []).map(attachment => ({
        name: attachment.name || '(ohne Namen)',
        contentType: attachment.contentType || 'application/octet-stream',
        size: typeof attachment.size === 'number' ? attachment.size : null,
        partName: attachment.partName
    }));
}

/** Berechnet den SHA-256-Hash eines Anhangs lokal (keine Uebertragung). */
async function computeAttachmentHash(messageId, partName) {
    if (!messageId || !partName) throw new Error('Nachricht oder Anhang fehlt.');
    const file = await browser.messages.getAttachmentFile(messageId, partName);
    const buffer = await file.slice().arrayBuffer();
    const sha256 = await get_sha256_hash(buffer);
    return { sha256, size: buffer.byteLength };
}

/**
 * Handles a scan request coming from the injected per-message banner.
 * persist === true adds the sender to the persistent opt-in list, otherwise
 * the scan stays a one-off action (no hidden opt-in).
 */
async function handleRequestScan(request, sender) {
    if (!request || !request.messageId) {
        return { success: false, error: 'invalid_request', code: 'INVALID_REQUEST' };
    }

    if (!mayTransmitExternally()) {
        return { success: false, error: EXTERNAL_ANALYSIS_DISABLED, code: EXTERNAL_ANALYSIS_DISABLED };
    }

    // Host permissions are requested from the options page, where the user's
    // click is a real user gesture. Calling permissions.request() here would be
    // unreliable: Gecko requires a user input handler, and that context is lost
    // when the request travels from the injected banner script to the background.
    if (!(await hasHybridPermission())) {
        return { success: false, error: 'permission_required', code: 'PERMISSION_REQUIRED' };
    }

    // Ohne API-Schluessel ist kein externer Scan moeglich. Diese Ursache wurde
    // vorher verschluckt - der Nutzer sah nur "Scan fehlgeschlagen".
    if (!apikey_hybridanalysis) {
        return {
            success: false,
            code: 'NO_API_KEY',
            error: 'Kein API-Schluessel fuer Hybrid Analysis hinterlegt - bitte in den Einstellungen eintragen.'
        };
    }

    if (request.persist === true && request.senderEmail) {
        await addSenderOptIn(request.senderEmail.toLowerCase());
    }

    const messageObj = { id: request.messageId };
    const tabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : (request.tabId || null);
    const tab = { id: tabId };

    // Jede Stufe einzeln absichern, damit Fehler eine konkrete Ursache melden.
    const stages = [
        ['attachments', () => processAttachments(messageObj)],
        ['links', async () => {
            const fullMessage = await browser.messages.getFull(request.messageId);
            const parsedUrlCache = new Map();
            const result = await processLinks(tab, messageObj, fullMessage, parsedUrlCache);
            return { fullMessage, parsedUrlCache, ...result };
        }],
        ['score', async (previousStage) => {
            await evaluateAndInjectThreats({
                tab,
                message: messageObj,
                fullMessage: previousStage.fullMessage,
                urls: previousStage.urls,
                filteredUrls: previousStage.filteredUrls,
                messageText: previousStage.messageText,
                parsedUrlCache: previousStage.parsedUrlCache
            });
            return previousStage;
        }]
    ];

    let stageResult = null;
    for (const [stageName, run] of stages) {
        try {
            stageResult = await run(stageResult);
        } catch (error) {
            Logger.error(`requestScan failed in stage "${stageName}":`, error);
            return {
                success: false,
                code: 'SCAN_FAILED',
                stage: stageName,
                error: (error && error.message) ? error.message : String(error)
            };
        }
    }

    const previous = displayStates.get(tabId) || {};
    const pendingForMessage = (await getPendingScans())
        .filter(job => job.messageId === request.messageId)
        .map(describeScanJob);

    updateDisplayState(tabId, Object.assign({}, previous, {
        mode: 'ready',
        messageId: request.messageId,
        canAutoUpload: true,
        showOptIn: false,
        consent: mayTransmitExternally(),
        pendingJobs: pendingForMessage,
        pollIntervalMinutes: SCAN_POLL_INTERVAL_MINUTES,
        localChecks: { timing: 'realtime', finished: true }
    }));
    await ensureMessageDisplayScript(tabId);

    // Klar kommunizieren: lokal sofort, extern zeitverzoegert.
    return {
        success: true,
        persisted: request.persist === true,
        localChecks: 'finished',
        timing: pendingForMessage.length > 0 ? 'delayed' : 'realtime',
        pendingScans: pendingForMessage.length,
        pollIntervalMinutes: SCAN_POLL_INTERVAL_MINUTES
    };
}

async function handleManualUpload(messageId, partName, attachmentName, hash, headerMessageId) {
    if (!apikey_hybridanalysis) {
        const error = new Error('Kein Hybrid-Analysis-API-Schluessel hinterlegt - bitte in den Einstellungen eintragen.');
        error.code = 'NO_API_KEY';
        throw error;
    }
    assertExternalAnalysisAllowed();
    if (!await hasHostPermissionFor('https://hybrid-analysis.com/api/v2/overview/x')) {
        const error = new Error('Host-Berechtigung fuer hybrid-analysis.com fehlt - bitte die Einstellungen speichern und die Berechtigung erteilen.');
        error.code = 'PERMISSION_REQUIRED';
        throw error;
    }

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
        const sha256 = json_data.sha256 || hash;

        // Der Anbieter analysiert asynchron: Auftrag merken und regelmaessig nachfragen.
        await upsertPendingScan({
            sha256,
            partName,
            attachmentName,
            messageId,
            messageHeaderId: headerMessageId,
            submissionId: json_data.submission_id || null,
            jobId: json_data.job_id || null,
            state: 'running',
            attempts: 0,
            startedAt: Date.now(),
            lastCheckAt: Date.now()
        });

        try {
            const db = await getSharedDB();
            await updateStore(db, 'hybridanalysis', headerMessageId, (existingRecord) => {
                const record = existingRecord || { messageHeader: headerMessageId, attachments: [], links: [] };
                if (!Array.isArray(record.attachments)) record.attachments = [];
                const index = record.attachments.findIndex(a => a.partName === partName);
                const entry = {
                    hybrid_submission_id: json_data.submission_id,
                    hybrid_job_id: json_data.job_id,
                    hybrid_sha256: sha256,
                    attachment_name: attachmentName,
                    partName: partName,
                    state: 'UPLOADED',
                    timing: 'delayed',
                    started_at: new Date().toISOString()
                };
                if (index >= 0) record.attachments[index] = Object.assign({}, record.attachments[index], entry);
                else record.attachments.push(entry);
                return record;
            });
        } catch (dbError) {
            Logger.error('Fehler beim Aktualisieren des DB Records:', dbError);
        }

        return Object.assign({}, json_data, {
            sha256,
            timing: 'delayed',
            state: 'running',
            pollIntervalMinutes: SCAN_POLL_INTERVAL_MINUTES,
            message: 'Analyse laeuft beim Anbieter (zeitverzoegert) - das Ergebnis wird automatisch abgerufen.'
        });
    } else {
        throw new Error("Fehler beim Upload: " + JSON.stringify(json_data));
    }
}
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request && request.action) {
        case "uploadAttachment":
            handleManualUpload(request.messageId, request.partName, request.attachmentName, request.hash, request.headerMessageId)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message, code: err.code || null}));
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

        case "scanStatus": {
            getPendingScans().then(jobs => {
                const filtered = request.headerMessageId
                    ? jobs.filter(job => job.messageHeaderId === request.headerMessageId)
                    : jobs;
                sendResponse({
                    status: 'success',
                    jobs: filtered.map(describeScanJob),
                    pending: filtered.length,
                    pollIntervalMinutes: SCAN_POLL_INTERVAL_MINUTES
                });
            }).catch(err => sendResponse({ status: 'error', message: err.message }));
            return true;
        }

        case "pollScansNow":
            pollPendingScans()
                .then(async (summary) => {
                    const jobs = await getPendingScans();
                    const filtered = request.headerMessageId
                        ? jobs.filter(job => job.messageHeaderId === request.headerMessageId)
                        : jobs;
                    sendResponse({ status: 'success', summary, jobs: filtered.map(describeScanJob) });
                })
                .catch(err => sendResponse({ status: 'error', message: err.message }));
            return true;

        case "listAttachments":
            listMessageAttachments(request.messageId)
                .then(attachments => sendResponse({ status: 'success', attachments }))
                .catch(err => sendResponse({ status: 'error', message: err.message }));
            return true;

        case "attachmentHash":
            computeAttachmentHash(request.messageId, request.partName)
                .then(result => sendResponse({ status: 'success', ...result }))
                .catch(err => sendResponse({ status: 'error', message: err.message }));
            return true;

        case "getDisplayState": {
            const tabId = (sender && sender.tab) ? sender.tab.id : (request.tabId !== undefined ? request.tabId : null);
            const state = tabId !== null ? displayStates.get(tabId) : null;
            sendResponse(state || { mode: 'pending' });
            return true;
        }

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

    if (response.status !== 200 && response.status !== 201) {
        throw new Error("Fehler beim Upload: " + JSON.stringify(json_data));
    }

    const sha256 = json_data.sha256 || null;

    // Auch URL-Scans laufen beim Anbieter asynchron.
    if (sha256) {
        await upsertPendingScan({
            sha256,
            partName: 'url:' + url,
            attachmentName: url,
            messageId: null,
            messageHeaderId: headerMessageId || null,
            submissionId: json_data.submission_id || null,
            jobId: json_data.job_id || null,
            state: 'running',
            attempts: 0,
            startedAt: Date.now(),
            lastCheckAt: Date.now()
        });
    }

    try {
        const db = await getSharedDB();
        await updateStore(db, 'hybridanalysis', headerMessageId, (existingRecord) => {
            if (existingRecord && existingRecord.links) {
                const links = existingRecord.links;
                for (let i = 0; i < links.length; i++) {
                    if (links[i].url === url) {
                        links[i].hybrid_submission_id = json_data.submission_id;
                        links[i].hybrid_job_id = json_data.job_id;
                        links[i].hybrid_sha256 = json_data.sha256;
                        links[i].state = 'UPLOADED';
                        links[i].timing = 'delayed';
                        break;
                    }
                }
            }
            return existingRecord;
        });
    } catch (dbError) {
        Logger.error('Fehler beim Aktualisieren des DB Records fuer URL:', dbError);
    }

    return Object.assign({}, json_data, {
        timing: 'delayed',
        state: 'running',
        pollIntervalMinutes: SCAN_POLL_INTERVAL_MINUTES
    });
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
