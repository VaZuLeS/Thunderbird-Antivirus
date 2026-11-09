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
    bannerConsentMissing: 'New external requests are disabled. Previously stored reports may still be shown.',
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

// Contexts are keyed by the actual message, never by the currently selected tab.
const MAX_MESSAGE_ANALYSES = 200;
let analysisRuntimeId = null;
function getAnalysisRuntimeId() { return analysisRuntimeId ||= crypto.randomUUID(); }
const MAX_SOURCE_SNAPSHOTS = 64;
const MAX_SOURCE_SNAPSHOT_BYTES = 1024 * 1024;
const messageAnalyses = typeof ExpiringMap !== 'undefined' ? new ExpiringMap(900000, () => Date.now(), {
    maxSize: MAX_MESSAGE_ANALYSES, autoExpire: true,
    onEvict: ready => Promise.resolve(ready).then(context => context.dispose()).catch(() => {})
}) : new Map();
async function getMessageAnalysisContext(message, tabId = null, inventory = {}) {
    if (typeof ThundyAnalysis === 'undefined' || !message) return null;
    const key = typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id;
    const contextKey = key + ':' + message.id;
    if (!messageAnalyses.has(contextKey)) {
        const ready = (async () => {
            // Labels must come from the actual message, not a shared Message-ID cache.
            const currentParts = new Map();
            const verifiedHashes = new Map();
            const currentLinks = new Set();
            const snapshotId = crypto.randomUUID();
            let currentCoverage = {state:'failed',reason:'read_failed'};
            try {
                const attachments = inventory.attachments || await browser.messages.listAttachments(message.id);
                for (const item of attachments.slice(0,100)) currentParts.set(String(item.partName), item.name || '');
            } catch (_) { /* unreadable inventory stays unknown */ }
            try {
                const full = Object.prototype.hasOwnProperty.call(inventory, 'fullMessage') ? inventory.fullMessage : await getAnalysisFull(message.id);
                currentCoverage = localContentCoverage(full);
                if (full) for (const url of filterUrls(extractUrls(extractTextFromParts(full.parts || full)))) currentLinks.add(url);
            } catch (_) { /* no fallback to another message's links */ }
            let record = null;
            try { record = await getFromStore(await getSharedDB(), 'hybridanalysis', key); } catch (_) { /* still expose live state */ }
            const sourceRecord = saved => {
                if (!saved) return saved;
                saved = ThundyAnalysis.resources({...saved,links:Array.isArray(saved.links) ? saved.links.map((item,index) => item && typeof item === 'object' && !Array.isArray(item) ? {...item,analysisResourceRef:'link:' + index} : item) : saved.links});
                // Numeric IDs and metadata alone cannot bind historical findings.
                const attachments = (saved.attachments || []).filter(item => item.partName && currentParts.has(String(item.partName)) && currentParts.get(String(item.partName)) === item.attachment_name && verifiedHashes.has(String(item.partName)) && typeof item.hybrid_sha256 === 'string' && verifiedHashes.get(String(item.partName)) === item.hybrid_sha256.toLowerCase());
                const links = saved.links.filter(item => currentLinks.has(item.url));
                const scanCoverage = Object.fromEntries(Object.entries(saved.scanCoverage || {}).filter(([kind]) => saved.scanCoverageBindings?.[kind]?.runtimeId === getAnalysisRuntimeId() && saved.scanCoverageBindings[kind].messageId === message.id));
                const threatIntel = saved.threatIntel && (!saved.threatIntelBinding || (saved.threatIntelBinding.runtimeId === getAnalysisRuntimeId() && saved.threatIntelBinding.messageId === message.id)) ? saved.threatIntel : undefined;
                return {messageHeader:saved.messageHeader, attachments, links, ...(saved.scanJobMeta ? {scanJobMeta:saved.scanJobMeta}:{}), ...(saved.sourceDataIncomplete ? {sourceDataIncomplete:true} : {}), scanCoverage:Object.keys(scanCoverage).length ? scanCoverage : undefined, ...(threatIntel ? {threatIntel} : {})};
            };
            const model = ThundyAnalysis.create(ThundyAnalysis.legacy(sourceRecord(record)));
            // Current unreadability must not inherit a historical "checked" state.
            if (currentCoverage.state !== 'checked') model.data.local = {...currentCoverage,source:'local',observedAt:Date.now()};
            let snapshotCreated = false, persistenceQueue = Promise.resolve();
            const context = { disposed: false, model, snapshotId, persistenceFailed:false, headerMessageId: key, messageId: message.id, tabs: new Set(), timer: null,
                dispose() { context.disposed = true; if (context.timer) clearTimeout(context.timer); context.timer = null; context.tabs.clear(); },
                event(event) { if (context.disposed || messageAnalyses.get(contextKey) !== ready) { context.dispose(); return false; } messageAnalyses.touch?.(contextKey); const valid = model.event(event); if (valid) context.schedule(); return valid; },
                cached(provider, scope, verdict, observedAt) { context.event({ provider, scope, phase: 'cache', state: verdict === 'unknown' ? 'received' : 'checked', verdict, observedAt }); },
                forAttachment(partName, name, hash) { if (name != null) currentParts.set(String(partName), name); if (/^[0-9a-f]{64}$/i.test(hash || '')) verifiedHashes.set(String(partName), hash.toLowerCase()); return ThundyAnalysis.bind(context, ['attachment:' + partName]); },
                async resourceRecord() {
                    const saved = sourceRecord(await getFromStore(await getSharedDB(), 'hybridanalysis', key));
                    if (!saved) return null;
                    // Unbound legacy findings may remain unknown summaries, never named popup resources.
                    return {...saved,attachments:(saved.attachments || []).filter(item => item.partName && currentParts.get(String(item.partName)) === item.attachment_name)};
                },
                async forLinks(urls) {
                    for (const url of urls) currentLinks.add(url);
                    try {
                        const saved = await getFromStore(await getSharedDB(), 'hybridanalysis', key);
                        const links = Array.isArray(saved?.links) ? saved.links : [];
                        return ThundyAnalysis.bind(context, urls.map(url => { const index = links.findIndex(item => item && item.url === url); return index < 0 ? null : 'link:' + index; }));
                    } catch (_) { return ThundyAnalysis.bind(context, []); }
                },
                schedule() { if (context.disposed) return; if (!context.timer) context.timer = setTimeout(() => { context.timer = null; context.flush().catch(() => {}); }, 300); },
                async snapshot() {
                    const displaySettings=await browser.storage.local.get(['analysisDefaultView','analysisShowHybridDetails']);
                    const displayPreferences={view:displaySettings.analysisDefaultView==='expert'?'expert':'simple',hybridDetails:displaySettings.analysisShowHybridDetails!==false};
                    let sourceHistory = {rows:[],truncated:false};
                    const hybridReports = {};
                    let hybridReportsTruncated=false,hybridReportBudget=500000;
                    try {
                        const original = await getFromStore(await getSharedDB(), 'hybridanalysis', key), saved = original ? ThundyAnalysis.resources(original) : null, current = sourceRecord(original);
                        if (saved) sourceHistory = ThundyAnalysis.history({...saved,attachments:(saved.attachments || []).filter(item => !(current.attachments || []).includes(item)),links:(saved.links || []).filter(item => !currentLinks.has(item.url))},snapshotId);
                        // Only current, content-bound resources enter the detailed display.
                        // Raw protocols and these resource details never enter provenance exports.
                        for(const item of [...(current?.attachments||[]),...(current?.links||[])]){
                            const ref=item.url?item.analysisResourceRef:'attachment:'+item.partName;
                            if(displayPreferences.hybridDetails&&item.report&&ThundyAnalysis.validResource(ref)){
                                const details={...ThundyProviderResults.hybridDetails(item.report,item.hybrid_sha256||null),observedAt:Number.isFinite(Date.parse(item.report_fetched_at))?Date.parse(item.report_fetched_at):null};
                                const size=JSON.stringify(details).length;
                                if(Object.keys(hybridReports).length>=100||size>hybridReportBudget){hybridReportsTruncated=true;continue;}
                                hybridReportBudget-=size;hybridReports[ref]=details;
                            }
                        }
                        if (!context.scanRunId) for (const row of ThundyAnalysis.legacy({...current,analysisStatus:model.data}).rows) if (!model.data.rows.some(active => ThundyAnalysis.rowKey(active) === ThundyAnalysis.rowKey(row)) && model.data.rows.length < 1200) model.data.rows.push(row);
                    } catch (_) { /* retain known live metadata */ }
                    const enabled = { hybridanalysis: !!apikey_hybridanalysis, virustotal: !!apikey_virustotal || ipReputationProvider === 'virustotal' && !!ipReputationApiKey, urlhaus: !!urlhausApikey, abuseipdb: ipReputationProvider === 'abuseipdb' && !!ipReputationApiKey, urlscan: !!urlscanApikey };
                    const availability = {};
                    const providerAccess = {};
                    const connectionTests = (await browser.storage.local.get('providerConnectionTests')).providerConnectionTests || {};
                    const authorized = await authorizeMessageScan(message);
                    await Promise.all(ThundyAnalysis.providers.map(async provider => {
                        providerAccess[provider] = {configured:!!enabled[provider],testStatus:['valid','invalid_key','rate_limited','permission_denied','error'].includes(connectionTests[provider]?.status)?connectionTests[provider].status:null,testedAt:Number.isFinite(connectionTests[provider]?.observedAt)?connectionTests[provider].observedAt:null};
                        availability[provider] = !enabled[provider] ? 'unconfigured' : !mayTransmitExternally() ? 'disabled' : !await hasHostPermissionFor(PROVIDER_ORIGINS[provider]) ? 'permission' : provider === 'urlscan' ? !tierAtLeast('max') ? 'policy' : 'on_action' : !authorized ? 'authorization' : 'unrecorded';
                    }));
                    if (context.scanJob?.providers) for(const [id,value] of Object.entries(context.scanJob.providers)) { const reasons=value.checks.map(c=>c.reason);availability[id]=value.state==='failed'&&value.error==='rate_limited'?'quota':reasons.some(r=>!r)?value.state==='running'?'running':'unrecorded':reasons[0]||'no_resources'; }
                    const resourceLabels = {};
                    const clean = text => String(text || '').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,512);
                    for (const [partName,name] of currentParts) if (ThundyAnalysis.validResource('attachment:' + partName)) resourceLabels['attachment:' + partName] = clean(name) + ' (' + partName + ')';
                    try {
                        const saved = await getFromStore(await getSharedDB(), 'hybridanalysis', key);
                        for (const [index,item] of (Array.isArray(saved?.links) ? saved.links : []).entries()) if (item && currentLinks.has(item.url)) {
                            try { const url = new URL(item.url); resourceLabels['link:' + index] = clean(url.origin + url.pathname); } catch (_) { /* no URL guess */ }
                        }
                    } catch (_) { /* actual parts remain identifiable without cached links */ }
                    const backoffs = {};
                    if (typeof apiGateway !== 'undefined' && apiGateway.backoffs) {
                        for (const host of apiGateway.backoffs.keys()) {
                            const b = apiGateway.getBackoff(host);
                            if (b && b.active) {
                                backoffs[host] = { active: true, remainingSeconds: b.remainingSeconds };
                            }
                        }
                    }
                    const security = typeof ThundySecurity !== 'undefined' ? await ThundySecurity.read() : null;
                    const protection = security ? ThundySecurity.decision({...ThundySecurity.defaults,...security.policy},{score:model.data.local.score,coverage:model.data.local.state,verdict:model.data.rows.some(row=>row.verdict==='malicious')?'MALICIOUS':model.data.rows.length && model.data.rows.every(row=>['none','suspicious'].includes(row.verdict)&&row.state==='checked')?model.data.rows.some(row=>row.verdict==='suspicious')?'SUSPICIOUS':'CLEAN':'UNKNOWN'}) : null;
                    return { ...JSON.parse(JSON.stringify(model.data)), displayPreferences, hybridReports, hybridReportsTruncated, scanJob:context.scanJob || {state:'idle',migration:(await browser.storage.local.get('scanMode')).scanMode===undefined,manualAllowed:mayTransmitExternally()}, scanRunId:context.scanRunId || null, contextToken:context.snapshotId, protection, providerAccess, providerNames:typeof ThundyProviders !== 'undefined' ? Object.fromEntries(Object.entries(ThundyProviders.registry).map(([id,v])=>[id,v.name])) : undefined, sourceHistory, sourcePersistenceFailed:context.persistenceFailed, reportArchiveBlocked:typeof wasReportArchiveBlocked === 'function' && wasReportArchiveBlocked(key), resourceLabels, availability, diagnostics: { backoffs }, messageId: message.id };
                },
                async flush() {
                    if (context.disposed) return;
                    if (context.timer) { clearTimeout(context.timer); context.timer = null; }
                    const value = JSON.parse(JSON.stringify(model.data));
                    persistenceQueue = persistenceQueue.then(async () => {
                      try {
                        await updateStore(await getSharedDB(), 'hybridanalysis', key, old => {
                            if (context.disposed) return old;
                            const previous = old?.analysisSourceSnapshots;
                            if (previous != null && (typeof previous !== 'object' || Array.isArray(previous))) throw new Error('Invalid source snapshot container');
                            if (!snapshotCreated && Object.prototype.hasOwnProperty.call(previous || {}, snapshotId)) throw new Error('Source snapshot identifier collision');
                            if (!Object.prototype.hasOwnProperty.call(previous || {}, snapshotId) && Object.keys(previous || {}).length >= MAX_SOURCE_SNAPSHOTS) throw new Error('Source snapshot capacity reached');
                            const snapshots = {...previous,[snapshotId]:{savedAt:Date.now(),snapshot:value}};
                            if (new TextEncoder().encode(JSON.stringify(snapshots)).length > MAX_SOURCE_SNAPSHOT_BYTES) throw new Error('Source snapshot byte capacity reached');
                            // Additive area: never overwrite legacy snapshots under reused IDs.
                            return {...(old || {messageHeader:key}),analysisSourceSnapshots:snapshots,updatedAt:Date.now()};
                        });
                        snapshotCreated = true;
                        context.persistenceFailed = false;
                      }
                      catch (_) { context.persistenceFailed = true; Logger.warn('Analysis source metadata could not be persisted'); }
                    });
                    await persistenceQueue;
                    const snapshot = await context.snapshot();
                    if (context.disposed) return;
                    const labels = ThundyAnalysis.labels(msg);
                    const theme = typeof ThundyTheme !== 'undefined' ? await ThundyTheme.snapshot() : null;
                    for (const tab of context.tabs) {
                        try {
                            const active = await getFirstDisplayedMessage(tab, { throwOnError: true });
                            if (!context.disposed && active?.id === message.id) await injectIntoMessageDisplay(tab, ThundyAnalysis.render, [snapshot, labels, theme?.css || '']);
                            else if (active?.id !== message.id) context.tabs.delete(tab);
                        } catch (_) { /* closed or changed message */ }
                    }
                    if (browser.runtime.sendMessage) browser.runtime.sendMessage({ action: 'analysisStatusChanged', messageId: message.id }).catch(() => {});
                }
            };
            return context;
        })();
        messageAnalyses.set(contextKey, ready);
        ready.catch(() => { if (messageAnalyses.get(contextKey) === ready) messageAnalyses.delete(contextKey); });
    }
    const context = await messageAnalyses.get(contextKey);
    messageAnalyses.touch?.(contextKey);
    if (tabId != null) context.tabs.add(tabId);
    return context;
}
async function analysisByHeader(key) {
    // Header-only fallbacks may not attribute events when duplicate headers exist.
    const matches = [];
    for (const ready of messageAnalyses.values()) {
        const context = await ready;
        if (context.headerMessageId === key) matches.push(context);
    }
    return matches.length === 1 ? matches[0] : null;
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
    const result = await browser.storage.local.get(['apikey', 'virustotalApikey', 'privacyTier', 'urlhausApikey', 'urlscanApikey', 'alwaysManual', 'autoScanLinks', 'timeOfClickProtection', 'ipReputationProvider', 'ipReputationApiKey', 'customBlacklist', 'customWhitelist', 'externalAnalysisConsent','scanMode']);
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
      alwaysManual = result.scanMode ? result.scanMode === 'manual' : result.alwaysManual;
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
    if (['allDisplayed','approvedSenders','manual'].includes(result.scanMode)) alwaysManual = result.scanMode === 'manual';
    syncGatewayApikeys();
  } catch (error) {
    Logger.error("Fehler beim Laden der Einstellungen:", error);
  }
}
/**
 * The gateway injects provider auth headers as defense in depth; the adapters
 * already carry the same headers, so leaving this unwired would silently
 * disable that layer (provider audit PA-8).
 */
function syncGatewayApikeys() {
    if (typeof apiGateway === 'undefined' || typeof apiGateway.setApikey !== 'function') return;
    apiGateway.setApikey('hybridanalysis', apikey_hybridanalysis);
    apiGateway.setApikey('virustotal', apikey_virustotal);
    apiGateway.setApikey('urlscan', urlscanApikey);
    apiGateway.setApikey('urlhaus', urlhausApikey);
    apiGateway.setApikey('abuseipdb', ipReputationProvider === 'abuseipdb' ? ipReputationApiKey : '');
}

const settingsReady = loadSettings();
syncGatewayApikeys();
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


for (const event of [browser.permissions?.onAdded,browser.permissions?.onRemoved]) event?.addListener(() => { if(typeof ThundyScans !== 'undefined') ThundyScans.reconfigure(); });

// Listener für Änderungen an den Einstellungen (API Key)
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if(changes.analysisDefaultView||changes.analysisShowHybridDetails)for(const ready of messageAnalyses.values())Promise.resolve(ready).then(context=>context.schedule()).catch(()=>{});
    if (typeof ThundyScans !== 'undefined' && ['scanMode','alwaysManual','autoScanLinks','externalAnalysisConsent','privacyTier','scanningEnabledSenders','apikey','virustotalApikey','urlscanApikey','urlhausApikey','ipReputationProvider','ipReputationApiKey'].some(key=>changes[key])) { ThundyScans.reconfigure();apiGateway.abortAll(); }
    if (changes.thundySecurityV1) {
        for (const ready of messageAnalyses.values()) Promise.resolve(ready).then(async context => {
            for (const tabId of context.tabs || []) { try { const current=await getFirstDisplayedMessage(tabId,{throwOnError:true});if(current?.id===context.messageId) await injectTimeOfClickProtection(tabId,[],current.id); }catch(_){} }
        }).catch(()=>{});
    }
    if ((changes.externalAnalysisConsent && changes.externalAnalysisConsent.newValue !== true) || changes.privacyTier) {
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
  syncGatewayApikeys();
});

function extractPublicIPs(receivedHeaders) {
    if (!receivedHeaders) return [];
    let ips = [];
    let ipsSet = new Set();

    // ⚡ Bolt Optimization: Use a traditional for loop instead of for-of for better iteration performance
    for (let i = 0, len = receivedHeaders.length; i < len; i++) {
        const header = receivedHeaders[i];
        GLOBAL_IPV4_REGEX.lastIndex = 0;
        let match;
        while ((match = GLOBAL_IPV4_REGEX.exec(header)) !== null) {
            const ip = match[0];

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
    return ips;
}





async function processAndUploadUrls(message, filteredUrls, allowExternal = true, manualAction = false, analysisContext = null) {
    await indexedDB_save_links_to_db(message, filteredUrls);
    if (allowExternal && (manualAction || (!alwaysManual && autoScanLinks)) && privacyTier === 'max' && mayTransmitExternally()) {
        try {
            await requireHostPermission('https://hybrid-analysis.com/api/v2/quick-scan/url-for-analysis');
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
                    options.analysisContext = analysisContext?.forLinks ? await analysisContext.forLinks([url]) : analysisContext;
                    options.url = 'https://hybrid-analysis.com/api/v2/quick-scan/url-for-analysis';
                    const response = await apiGateway.fetchWithTimeout(options.url, options);
                    if (response.status === 200 || response.status === 201) {
                        const json_data = await response.json();
                        const quickReport = typeof quickScanReport === 'function' ? quickScanReport(json_data) : null;
                        result = {
                            url: url,
                            state: 'UPLOADED',
                            hybrid_submission_id: json_data.submission_id || json_data.id,
                            hybrid_job_id: json_data.job_id || (Array.isArray(json_data.reports) && json_data.reports[0]) || json_data.id,
                            hybrid_sha256: json_data.sha256,
                            ...(quickReport && { report: quickReport, report_fetched_at: new Date().toISOString() })
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
    }
}



async function checkIPReputation(receivedHeaders, analysisContext = null) {
    if (analysisContext && typeof ThundyAnalysis !== 'undefined') analysisContext = ThundyAnalysis.bind(analysisContext, ['message']);
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

        const noteCachedIp = (ip, value) => { if (analysisContext && value != null && typeof ThundyAnalysis !== 'undefined') analysisContext.cached(ipReputationProvider, 'ip', value ? 'malicious' : 'none', ThundyAnalysis.cacheTime(ipReputationProvider, 'ip', ip)); };
        let ipChecks = [];

        for (let i = 0; i < Math.min(publicIps.length, 20); i++) {
            const ip = publicIps[i];
            if (ipReputationCache.has(ip)) {
                const cached = ipReputationCache.get(ip);
                if (cached instanceof Promise) {
                     ipChecks.push(cached.then(isMalicious => { noteCachedIp(ip, isMalicious); return { ip, isMalicious }; }));
                } else {
                     noteCachedIp(ip, cached);
                     if (cached) maliciousIps.push(ip);
                }
                continue;
            }

            let promise = (async () => {
                try {
                    if (ipReputationProvider === "abuseipdb") {
                        return await checkAbuseIPDB(ip, ipReputationApiKey, analysisContext);
                    } else if (ipReputationProvider === "virustotal") {
                        return await checkVirusTotalIP(ip, ipReputationApiKey, analysisContext);
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

// Counts describe this particular pass, not a whole-message safety verdict.
function scanCoverage(detected, eligible, processed, failed, reason) {
    return { detected, eligible, processed, failed, skipped: detected - processed - failed, reason, observedAt: Date.now() };
}
async function persistScanCoverage(message, kind, coverage) {
    const key = (typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id);
    await updateStore(await getSharedDB(), 'hybridanalysis', key, existing => ({
        ...(existing || { messageHeader: key }), scanCoverage: { ...(existing?.scanCoverage || {}), [kind]: coverage },
        ...(typeof ThundyAnalysis !== 'undefined' ? {scanCoverageBindings:{...(existing?.scanCoverageBindings || {}),[kind]:{runtimeId:getAnalysisRuntimeId(),messageId:message.id}}} : {})
    }));
}

async function checkURLhausDomains(filteredUrls, parsedUrlCache = null, coverage = null, analysisContext = null) {
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
        let failed = 0;

        // ⚡ Bolt Optimization: Iterate directly over the Set to avoid Array.from() allocation overhead
        for (const domain of Array.from(linkDomainsSet).slice(0, 100)) {
            const domainContext = analysisContext?.forLinks ? await analysisContext.forLinks(filteredUrls.filter(url => getHostnameOptimized(url, parsedUrlCache) === domain)) : analysisContext;
            const noteCachedDomain = (domain, value) => { if (domainContext && value != null && typeof ThundyAnalysis !== 'undefined') domainContext.cached('urlhaus', 'domain', value ? 'malicious' : 'none', ThundyAnalysis.cacheTime('urlhaus', 'domain', domain)); };


            if (urlhausCache.has(domain)) {
                const cached = urlhausCache.get(domain);
                if (cached instanceof Promise) {
                    domainChecks.push(cached.then(isMal => { if (isMal === null) failed++; else { noteCachedDomain(domain, isMal); if (isMal) urlhausDomains.push(domain); } }));
                } else { noteCachedDomain(domain, cached); if (cached) urlhausDomains.push(domain); }
                continue;
            }

            let checkPromise = checkURLhaus(domain, urlhausApikey, domainContext);

            if (urlhausCache.size >= MAX_URLHAUS_CACHE_SIZE) {
                const firstKey = urlhausCache.keys().next().value;
                urlhausCache.delete(firstKey);
            }
            urlhausCache.set(domain, checkPromise);

            domainChecks.push(checkPromise.then(isMalicious => {
                if (isMalicious === null) { failed++; urlhausCache.delete(domain); }
                else urlhausCache.set(domain, isMalicious);
                if (isMalicious) urlhausDomains.push(domain);
            }));
        }

        if (domainChecks.length > 0) {
            await Promise.all(domainChecks);
        }
        if (coverage) Object.assign(coverage, scanCoverage(linkDomainsSet.size, linkDomainsSet.size, Math.min(linkDomainsSet.size, 100) - failed, failed, 'domain_limit_100'));
    }
    return urlhausDomains;
}



async function processAttachments(message, allowExternal = true, manualAction = false, analysisContext = null) {
  let attachments = await browser.messages.listAttachments(message.id);

  if (attachments.length > 0) {
    await sent_to_hybrid_by_attachment(message, attachments, allowExternal, manualAction, analysisContext);
  }
}

async function processLinks(tab, message, fullMessage, parsedUrlCache = null, allowExternal = true, manualAction = false, analysisContext = null) {
  let messageText = extractTextFromParts(fullMessage.parts || fullMessage);
  let urls = extractUrls(messageText);
  let filteredUrls = filterUrls(urls, parsedUrlCache);

  if (filteredUrls.length > 0) {
    await processAndUploadUrls(message, filteredUrls, allowExternal, manualAction, analysisContext);
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

async function persistThreatIntelSummary(message, summary) {
  if (!message || (!message.headerMessageId && message.id == null)) return;
  const key = typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id;
  try {
    await updateStore(await getSharedDB(), 'hybridanalysis', key, existing => ({
      ...(existing || { messageHeader: key }),
      threatIntel: summary,
      ...(typeof ThundyAnalysis !== 'undefined' ? { threatIntelBinding: { runtimeId: getAnalysisRuntimeId(), messageId: message.id } } : {})
    }), { preserveReports: true });
  } catch (e) {
    Logger.error('Fehler beim Speichern der Threat-Intel-Zusammenfassung:', e);
  }
}

/**
 * Reads attachment verdicts already stored for this message (Hybrid Analysis
 * report or VirusTotal stats). Local-only: no provider request is made here.
 */
async function collectAttachmentFindings(message) {
  if (!message || (!message.headerMessageId && message.id == null)) return [];
  if (typeof getFromStore !== 'function' || typeof getSharedDB !== 'function') return [];
  try {
    const key = typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id;
    const record = await getFromStore(await getSharedDB(), 'hybridanalysis', key);
    const current = await browser.messages.listAttachments(message.id);
    const hashes = new Map();
    for (const item of current.slice(0,100)) { if (item.size > 25*1024*1024) continue; try { const file=await browser.messages.getAttachmentFile(message.id,item.partName);hashes.set(String(item.partName),await get_sha256_hash(await file.arrayBuffer())); } catch (_) {} }
    const findings = [];
    for (const att of (record && Array.isArray(record.attachments) ? record.attachments : [])) {
      if (!att || typeof att !== 'object') continue;
      if (!att.partName || !hashes.has(String(att.partName)) || hashes.get(String(att.partName)) !== String(att.hybrid_sha256 || '').toLowerCase()) continue;
      const actual = current.find(item=>String(item.partName)===String(att.partName));
      const name = typeof actual?.name === 'string' ? actual.name : typeof att.attachment_name === 'string' ? att.attachment_name : '';
      const a=ThundyProviderResults.stored('hybridanalysis',att);const ha=({malicious:'MALICIOUS',suspicious:'SUSPICIOUS',none:'CLEAN'})[a.verdict]||null;
      const vt = att.virustotal_stats && typeof att.virustotal_stats === 'object' ? att.virustotal_stats : null;
      const vtMalicious = vt && Number.isFinite(vt.malicious) && vt.malicious > 0;
      const vtSuspicious = vt && Number.isFinite(vt.suspicious) && vt.suspicious > 0;
      if (ha === 'MALICIOUS') findings.push({ name, verdict: 'malicious', provider: 'Hybrid Analysis' });
      else if (vtMalicious) findings.push({ name, verdict: 'malicious', provider: 'VirusTotal' });
      else if (ha === 'SUSPICIOUS') findings.push({ name, verdict: 'suspicious', provider: 'Hybrid Analysis' });
      else if (vtSuspicious) findings.push({ name, verdict: 'suspicious', provider: 'VirusTotal' });
    }
    return findings;
  } catch (e) {
    Logger.warn('Anhang-Befunde konnten nicht gelesen werden', e);
    return [];
  }
}

/**
 * Reads link verdicts already stored for this message (Hybrid Analysis
 * report, Hybrid Analysis live link verdict, or URLScan.io result).
 * Local-only: no provider request is made here.
 */
async function collectLinkFindings(message, fullMessage = null) {
  if (!message || (!message.headerMessageId && message.id == null)) return [];
  if (typeof getFromStore !== 'function' || typeof getSharedDB !== 'function') return [];
  try {
    const key = typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id;
    const record = await getFromStore(await getSharedDB(), 'hybridanalysis', key);
    const full = fullMessage || await readFullForAnalysis(message);
    const currentLinks = new Set(filterUrls(extractUrls(extractTextFromParts(full.parts || full))));
    const findings = [];
    for (const link of (record && Array.isArray(record.links) ? record.links : [])) {
      if (!link || typeof link !== 'object') continue;
      const url = typeof link.url === 'string' ? link.url : '';
      if (!currentLinks.has(url)) continue;
      const fact=ThundyProviderResults.resource(link);
      if(['malicious','suspicious'].includes(fact.verdict))findings.push({url,verdict:fact.verdict,provider:fact.provider==='hybridanalysis'?'Hybrid Analysis':'URLScan.io'});
    }
    return findings;
  } catch (e) {
    Logger.warn('Link-Befunde konnten nicht gelesen werden', e);
    return [];
  }
}

async function collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache, allowExternal = true, analysisContext = null }) {
  const rawAuthHeaders = (fullMessage.headers && fullMessage.headers['authentication-results']) || [];
  const settings = await browser.storage.local.get('trustedAuthServers');
  const trusted = new Set((settings.trustedAuthServers || []).map(host => host.toLowerCase()));
  const first = rawAuthHeaders[0] || '';
  const authServer = first.split(';')[0].trim().toLowerCase();
  const authHeaders = trusted.has(authServer) ? [first] : [];
  const receivedHeaders = (fullMessage.headers && fullMessage.headers['received']) || [];

  const domainCoverage = {};
  const [maliciousIps, urlhausDomains, becData, attachmentFindings, linkFindings] = await Promise.all([
    allowExternal ? checkIPReputation(receivedHeaders, analysisContext) : [],
    allowExternal ? checkURLhausDomains(filteredUrls, parsedUrlCache, domainCoverage, analysisContext) : [],
    extractBecProtectionData(message, fullMessage),
    typeof collectAttachmentFindings === 'function' ? collectAttachmentFindings(message) : [],
    typeof collectLinkFindings === 'function' ? collectLinkFindings(message, fullMessage) : []
  ]);

  if (domainCoverage.detected != null) await persistScanCoverage(message, 'domains', domainCoverage);
  if (allowExternal && ((Array.isArray(urlhausDomains) && urlhausDomains.length > 0) || (Array.isArray(maliciousIps) && maliciousIps.length > 0))) {
    await persistThreatIntelSummary(message, {
      urlhausDomains: Array.isArray(urlhausDomains) ? urlhausDomains : [],
      maliciousIps: Array.isArray(maliciousIps) ? maliciousIps : [],
      ipReputationProvider: ipReputationProvider && ipReputationProvider !== 'none' ? ipReputationProvider : null,
      observedAt: Date.now()
    });
  }
  return {
    authHeaders,
    urlhausDomains,
    isFirstCommunication: becData.isFirstCommunication,
    messageText,
    subject: becData.subject,
    replyTo: becData.replyTo,
    parsedUrlCache,
    maliciousIps,
    attachmentFindings,
    linkFindings
  };
}

async function evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText, parsedUrlCache = null, allowExternal = true, analysisContext = null }) {
  const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache, allowExternal, analysisContext });
  const threat = calculateThreatScore(message.author, urls, options);
  threat.coverage = localContentCoverage(fullMessage);
  await injectThreatBanner(tab.id, threat);
  if (analysisContext) { recordLocalCoverage(analysisContext, threat.coverage, threat); await analysisContext.flush().catch(() => {}); }
}

// This describes the available text input, not an antivirus or full MIME verdict.
function localContentCoverage(fullMessage) {
  if (!fullMessage || typeof fullMessage !== 'object') return {state:'failed',reason:'read_failed'};
  if (fullMessage.thundyInputStatus === 'incomplete') return {state:'incomplete',reason:'text_unavailable'};
  let unavailable = false, missingText = false;
  const visit = part => {
    if (!part || typeof part !== 'object') return;
    if (['fail','skipped'].includes(part.decryptionStatus) ||
        part.contentType === 'multipart/encrypted' && fullMessage.decryptionStatus !== 'success') unavailable = true;
    // Thunderbird omits body for valid zero-length text parts. Absence alone
    // is no failure; a positive decoded size supplies the missing evidence.
    const attachment = !!part.name || (part.headers?.['content-disposition'] || []).some(value => /^attachment(?:;|$)/i.test(value.trim()));
    if (!attachment && ['text/plain','text/html'].includes(part.contentType) && part.size > 0 && typeof part.body !== 'string') missingText = true;
    for (const child of part.parts || []) visit(child);
  };
  visit(fullMessage);
  return unavailable ? {state:'incomplete',reason:'decryption_unavailable'} : missingText ? {state:'incomplete',reason:'text_unavailable'} : {state:'checked'};
}

function recordLocalCoverage(context, coverage, threat = null) {
  if (!context || context.disposed) return;
  context.model.data.local = {...coverage,source:'local',observedAt:Date.now(),...(threat ? {score:threat.score,reasons:threat.reasons.slice(0,20)} : {})};
  context.schedule();
}

async function readFullForAnalysis(message, context = null) {
  try { return await getAnalysisFull(message.id); }
  catch (error) {
    // Preserve the API failure without retrying it during context creation.
    try {
      context ||= await getMessageAnalysisContext(message, null, {fullMessage:null});
      recordLocalCoverage(context, {state:'failed',reason:'read_failed'});
      await context?.flush();
    } catch (_) { /* the original read failure remains authoritative */ }
    throw error;
  }
}

const TEXT_RECOVERY_BYTES = 1024 * 1024;
const TEXT_RECOVERY_PARTS = 2000;
function decodeUtf8QuotedPrintable(text) {
  if (typeof text !== 'string' || text.length > TEXT_RECOVERY_BYTES || /[ \t](?:\r?\n|$)/.test(text)) return null;
  const bytes = new Uint8Array(text.length);
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 61) {
      if (text.slice(i + 1, i + 3) === '\r\n') { i += 2; continue; }
      const hex = text.slice(i + 1, i + 3);
      if (!/^[0-9a-f]{2}$/i.test(hex)) return null;
      bytes[length++] = parseInt(hex, 16); i += 2;
    } else {
      if (!(code === 9 || code === 10 || code === 13 || code >= 32 && code <= 126)) return null;
      bytes[length++] = code;
    }
  }
  try { return new TextDecoder('utf-8', {fatal:true,ignoreBOM:true}).decode(bytes.subarray(0, length)); }
  catch (_) { return null; }
}

async function getAnalysisFull(messageId) {
  const full = await browser.messages.getFull(messageId);
  const parts = tree => {
    const found = [], pending = [tree];
    while (pending.length && found.length < TEXT_RECOVERY_PARTS) {
      const part = pending.pop(); if (!part || typeof part !== 'object') continue;
      found.push(part);
      if (Array.isArray(part.parts)) {
        if (found.length + pending.length + part.parts.length > TEXT_RECOVERY_PARTS) return null;
        for (const child of part.parts) pending.push(child);
      }
    }
    return pending.length ? null : found;
  };
  const utf8QP = part => ['text/plain','text/html'].includes(part.contentType) && !part.name &&
    typeof part.partName === 'string' && part.partName.length <= 80 && /^\d+(?:\.\d+)*$/.test(part.partName) &&
    (part.headers?.['content-transfer-encoding'] || []).length === 1 &&
    part.headers['content-transfer-encoding'][0].trim().toLowerCase() === 'quoted-printable' &&
    (part.headers?.['content-type'] || []).length === 1 &&
    (part.headers['content-type'][0].match(/;\s*charset\s*=/gi) || []).length === 1 &&
    /;\s*charset\s*=\s*(?:"utf-?8"|utf-?8)\s*(?:;|$)/i.test(part.headers['content-type'][0]) &&
    !(part.headers?.['content-disposition'] || []).some(value => /^attachment(?:;|$)/i.test(value.trim()));
  const tree = parts(full);
  const limited = () => ({...full,thundyInputStatus:'incomplete'});
  if (!tree) return limited();
  const candidates = tree.filter(part => utf8QP(part) && typeof part.body === 'string' && part.body.includes('\ufffd'));
  if (!candidates.length || ['fail','skipped'].includes(full.decryptionStatus)) return full;
  if (full.size > TEXT_RECOVERY_BYTES) return limited();
  // Thunderbird still owns MIME structure/decryption. Only verify affected
  // UTF-8/QP leaves; never reparse an entire raw message or guess a charset.
  let raw;
  try { raw = await browser.messages.getFull(messageId, {decodeContent:false}); }
  catch (_) { return limited(); }
  if (!raw || raw.decryptionStatus !== full.decryptionStatus || JSON.stringify(raw.headers?.['message-id']) !== JSON.stringify(full.headers?.['message-id'])) return limited();
  const rawTree = parts(raw);
  if (!rawTree || rawTree.reduce((size,part) => size + (typeof part.rawBody === 'string' ? part.rawBody.length : 0), 0) > TEXT_RECOVERY_BYTES) return limited();
  const uniqueParts = list => {
    const map = new Map();
    for (const part of list) map.set(part.partName, map.has(part.partName) ? null : part);
    return map;
  };
  const decodedParts = uniqueParts(tree), rawParts = uniqueParts(rawTree);
  const replacements = new Map(); let incomplete = false, recovered = false;
  for (const part of candidates) {
    const matching = rawParts.get(part.partName);
    const input = decodedParts.get(part.partName) === part && matching && utf8QP(matching) ? matching : null;
    const decoded = input && input.contentType === part.contentType ? decodeUtf8QuotedPrintable(input.rawBody) : null;
    if (decoded === null) { incomplete = true; continue; }
    replacements.set(part, decoded); recovered ||= decoded !== part.body;
  }
  const derive = part => ({...part,...(replacements.has(part) ? {body:replacements.get(part)} : {}),...(Array.isArray(part.parts) ? {parts:part.parts.map(derive)} : {})});
  return {...derive(full),thundyInputStatus:incomplete ? 'incomplete' : recovered ? 'recovered' : 'verified'};
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
  if (typeof ThundyScans !== 'undefined') { try { return await ThundyScans.display(tab,message); } catch(error) { Logger.error('Message scan setup failed',error.code || error.name); } return; }
  if (!message || message.id === undefined || message.id === null) return;
  let analysisContext = null;
  try {
    if (typeof ThundyAnalysis !== 'undefined') await injectIntoMessageDisplay(tab.id, function(id) { document.documentElement.dataset.thundyAnalysisMessage = String(id); }, [message.id]);
    const senderEmail = extractEmailAddress(message.author || '');

    const stored = await browser.storage.local.get('scanningEnabledSenders');
    const enabledSenders = stored.scanningEnabledSenders || [];

    const permission = await hasHybridPermission();
    const allowExternal = await authorizeMessageScan(message);
    const canAutoUpload = permission && enabledSenders.includes(senderEmail) && !alwaysManual &&
      !!apikey_hybridanalysis && mayTransmitExternally();

    let fullMessage = await readFullForAnalysis(message);
    let attachments = [];
    try {
      attachments = await browser.messages.listAttachments(message.id);
    } catch (e) { /* ignore */ }

    analysisContext = await getMessageAnalysisContext(message, tab.id, {attachments,fullMessage});
    await processAttachments(message, allowExternal, false, analysisContext);

    let parsedUrlCache = new Map();
    let { messageText, urls, filteredUrls } = await processLinks(tab, message, fullMessage, parsedUrlCache, allowExternal, false, analysisContext);

    await evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText, parsedUrlCache, allowExternal, analysisContext });

    if (!canAutoUpload && ((attachments && attachments.length > 0) || (filteredUrls && filteredUrls.length > 0))) {
      await injectOptInBanner(tab.id, message.id, senderEmail, mayTransmitExternally());
    }
  } catch (error) {
    Logger.error(`Fehler beim Laden der Anhänge oder Links: ${error}`);
    if (analysisContext) await analysisContext.flush().catch(() => {});
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

async function handle_unknown_attachment({ attachment, content_of_attachment, local_hash, virustotal_stats, privacyTier, fileType, analysisContext = null }) {
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
            uploadOptions.analysisContext = analysisContext;
            uploadOptions.url = 'https://hybrid-analysis.com/api/v2/quick-scan/file';
            const uploadResponse = await apiGateway.fetchWithTimeout(uploadOptions.url, uploadOptions, 60000);
            if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                const uploadData = await uploadResponse.json();
                const hybridData = HybridDataBuilder.create(
                    uploadData.submission_id || uploadData.id,
                    uploadData.job_id || (Array.isArray(uploadData.reports) && uploadData.reports[0]) || uploadData.id,
                    uploadData.sha256 || local_hash,
                    'UPLOADED',
                    attachment,
                    virustotal_stats
                );
                const quickReport = typeof quickScanReport === 'function' ? quickScanReport(uploadData) : null;
                if (quickReport) {
                    hybridData.report = quickReport;
                    hybridData.report_fetched_at = new Date().toISOString();
                }
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


async function fetch_virustotal_stats(local_hash, apikey, analysisContext = null) {
    if (apikey && mayTransmitExternally() && await hasHostPermissionFor('https://www.virustotal.com/api/v3/files/x')) {
        return await checkVirusTotal(local_hash, apikey, analysisContext);
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

function hasHybridReportContent(json_data) {
    if (!json_data || typeof json_data !== 'object' || Array.isArray(json_data)) return false;
    return Boolean(
        (typeof json_data.verdict === 'string' && json_data.verdict.trim() !== '') ||
        json_data.whitelisted === true ||
        (typeof json_data.threat_score === 'number' && Number.isFinite(json_data.threat_score)) ||
        (typeof json_data.multiscan_result === 'number' && Number.isFinite(json_data.multiscan_result)) ||
        (Array.isArray(json_data.scanners) && json_data.scanners.length > 0) ||
        (json_data.scanners_v2 && typeof json_data.scanners_v2 === 'object' && !Array.isArray(json_data.scanners_v2) && Object.keys(json_data.scanners_v2).length > 0) ||
        (typeof json_data.state === 'string' && json_data.state.trim() !== '')
    );
}

async function check_hybrid_analysis_for_attachment(local_hash, attachment, content_of_attachment, virustotal_stats, file_type, analysisContext = null) {
    if (!mayTransmitExternally()) {
        return create_manual_check_hybrid_data(local_hash, attachment, virustotal_stats);
    }
    const optionsCheck = getHybridAnalysisOptions('GET');
    optionsCheck.analysisContext = analysisContext;
    optionsCheck.url = 'https://hybrid-analysis.com/api/v2/overview/' + local_hash;
    const responseCheck = await apiGateway.fetchWithTimeout(optionsCheck.url, optionsCheck);

    if (responseCheck.status === 200) {
        const json_data = await responseCheck.json();
        const item = HybridDataBuilder.create(
            json_data.submission_id || json_data.id || 'N/A',
            json_data.job_id || (Array.isArray(json_data.reports) && json_data.reports[0]) || json_data.id || 'N/A',
            local_hash,
            'KNOWN',
            attachment,
            virustotal_stats
        );
        if (hasHybridReportContent(json_data)) {
            item.report = json_data;
            item.report_fetched_at = new Date().toISOString();
        }
        return item;
    }

    if (responseCheck.status !== 404) throw typedError(responseCheck.status===429?'rate_limited':responseCheck.status===401||responseCheck.status===403?'invalid_key':'provider_error','Provider request failed');
    return await handle_unknown_attachment({
        attachment,
        content_of_attachment,
        local_hash,
        virustotal_stats,
        privacyTier,
        fileType: file_type, analysisContext
    });
}


async function process_single_attachment(message, attachment, allowExternal = true, manualAction = false, analysisContext = null) {
    if (attachment.size > 25 * 1024 * 1024) {
        const item = create_manual_check_hybrid_data('', attachment, null);
        item.hybrid_data.state = 'SIZE_LIMIT';
        return item;
    }
        try {
            const file = await browser.messages.getAttachmentFile(message.id, attachment.partName);
            const content_of_attachment = file.slice();
            const arrayBuffer = await content_of_attachment.arrayBuffer();
            const local_hash = await get_sha256_hash(arrayBuffer);
            if (analysisContext?.forAttachment) analysisContext = analysisContext.forAttachment(attachment.partName, attachment.name, local_hash);

            const virustotal_stats = allowExternal ? await fetch_virustotal_stats(local_hash, apikey_virustotal, analysisContext) : null;

            if (!allowExternal || (alwaysManual && !manualAction) || !apikey_hybridanalysis || !mayTransmitExternally()) {
                return create_manual_check_hybrid_data(local_hash, attachment, virustotal_stats);
            }

            return await check_hybrid_analysis_for_attachment(
                local_hash,
                attachment,
                content_of_attachment,
                virustotal_stats,
                file.type, analysisContext
            );

        } catch (error) {
          Logger.error('Netzwerk- oder Verarbeitungsfehler beim Überprüfen:', error);
          return null;
        }
}


async function sent_to_hybrid_by_attachment(message, attachments, allowExternal = true, manualAction = false, analysisContext = null) {

  const selected = attachments.slice(0, 100);
  const results = typeof mapWithLimit !== 'undefined'
      ? await mapWithLimit(selected, 2, attachment => process_single_attachment(message, attachment, allowExternal, manualAction, analysisContext))
      : await Promise.all(selected.map(attachment => process_single_attachment(message, attachment, allowExternal, manualAction, analysisContext)));

  const validResults = results.filter(r => r != null);
  const limited = validResults.filter(r => r.hybrid_data?.state === 'SIZE_LIMIT').length;
  await persistScanCoverage(message, 'attachments', scanCoverage(attachments.length, attachments.filter(a => !(a.size > 25 * 1024 * 1024)).length, validResults.length - limited, selected.length - validResults.length, 'attachment_limit_100_or_25MiB'));
  if (validResults.length > 0) {
      await indexedDB_save_batch_hybrid_data_to_db(message, validResults);
  }
}

async function indexedDB_save_batch_hybrid_data_to_db(message, results) {
  if (!message.headerMessageId && message.id != null) message = { ...message, headerMessageId: typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : 'message:' + message.id };
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
        // A new submission invalidates any previously persisted analysis
        // protocol (FA-3); a freshly fetched KNOWN overview report is preserved.
        // A quick-scan upload may already return scanner states (UPLOADED).
        report: ['KNOWN', 'UPLOADED'].includes(result.hybrid_data.state) && result.report ? result.report : null,
        report_fetched_at: ['KNOWN', 'UPLOADED'].includes(result.hybrid_data.state) && result.report ? (result.report_fetched_at || new Date().toISOString()) : null,
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
              if (newAtt.partName && atts[j].partName === newAtt.partName || !atts[j].partName && atts[j].attachment_name === newAtt.attachment_name && atts.filter(item => item.attachment_name === newAtt.attachment_name).length === 1 && newAttachments.filter(item => item.attachment_name === newAtt.attachment_name).length === 1) {
                const old = atts[j];
                // An offline/local reread is not a new provider submission.
                const sameContent = /^[0-9a-f]{64}$/i.test(newAtt.hybrid_sha256 || '') && old.hybrid_sha256?.toLowerCase() === newAtt.hybrid_sha256.toLowerCase();
                atts[j] = sameContent && ['MANUAL_CHECK_PENDING','UNKNOWN','NOT_CHECKED'].includes(newAtt.state) && (old.report != null || old.virustotal_stats != null || ['KNOWN','UPLOADED'].includes(old.state)) ? {...newAtt,state:old.state,hybrid_job_id:old.hybrid_job_id,hybrid_submission_id:old.hybrid_submission_id,report:old.report,report_fetched_at:old.report_fetched_at,virustotal_stats:newAtt.virustotal_stats ?? old.virustotal_stats} : newAtt;
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
      }, {preserveReports:true});
    }
  } catch (error) {
    Logger.error('Fehler bei der Batch-Interaktion mit der Datenbank:', error);
  }
}

// Speicherung der Ergebnisse in IndexedDB
async function indexedDB_save_links_objects_to_db(message, urlObjects) {
  if (!message.headerMessageId && message.id != null) message = { ...message, headerMessageId: typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : 'message:' + message.id };
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

          // Keep every existing slot, including historical duplicate URLs: source
          // references address this local list and must survive result updates.
          const incoming = new Map(newLinks.map(item => [item.url,item]));
          const seen = new Set();
          recordToSave.links = recordToSave.links.map(item => {
            seen.add(item.url);
            const next = incoming.get(item.url);
            if (!next) return item;
            if (next.state === 'UNKNOWN' && (item.report != null || item.urlscan != null || item.hybrid_verdict != null || ['KNOWN', 'UPLOADED'].includes(item.state))) return item;
            return item.urlscan != null && next.urlscan == null ? { ...next, urlscan: item.urlscan } : next;
          });
          for (const item of newLinks) if (!seen.has(item.url)) { recordToSave.links.push(item); seen.add(item.url); }


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
      }, {preserveReports:true});
    }
  } catch (error) {
    Logger.error('IndexedDB (Links) Save Error:', error);
  }
}

async function indexedDB_save_links_to_db(message, urls) {
  if (!message.headerMessageId && message.id != null) message = { ...message, headerMessageId: typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : 'message:' + message.id };
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
        const fullMessage = await readFullForAnalysis(message);
        const text = extractTextFromParts(fullMessage.parts || fullMessage);
        const rawUrls = extractUrls(text);
        const urls = filterUrls(rawUrls);
        if (urls.length === 0) {
            notify('notificationTitle', 'notificationNoLinks', []);
            return;
        }
        const analysisContext = await getMessageAnalysisContext(message, tabId);
        const messageKey = (typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id);
        let submitted = 0;
        for (const url of urls.slice(0, 20)) {
            try {
                await handleUrlScan(url, messageKey, analysisContext);
                submitted++;
            } catch (e) {
                Logger.error('Could not submit link for analysis', e);
            }
        }
        const coverage = scanCoverage(urls.length, urls.length, submitted, Math.min(urls.length, 20) - submitted, 'batch_limit_20');
        await persistScanCoverage(message, 'batchLinks', coverage);
        if (submitted > 0 && typeof evaluateAndInjectThreats === 'function') {
            await evaluateAndInjectThreats({ tab: { id: tabId }, message, fullMessage, urls: rawUrls, filteredUrls: urls, messageText: text, allowExternal: false, analysisContext }).catch(() => {});
        }
        notify('notificationTitle', 'coverageSummary', [coverage.detected, coverage.eligible, coverage.processed, coverage.failed, coverage.skipped].map(String));
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
            let msgId = activeMessage ? (typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(activeMessage) : activeMessage.headerMessageId || 'message:' + activeMessage.id) : "context_menu_scan";

            let result = await handleUrlScan(url, msgId, activeMessage ? await getMessageAnalysisContext(activeMessage, tab?.id) : null);

            notify('notificationTitle', 'notificationScanSubmitted', [String(result.job_id || (Array.isArray(result.reports) && result.reports[0]) || result.id || result.submission_id || result.sha256 || 'OK')]);
        } catch (error) {
            notify('notificationTitleError', 'notificationScanError', [error.message]);
        }
    }
});

async function persistUrlscanLinkResult(message, url, res) {
    if (message && !message.headerMessageId && message.id != null) message={...message,headerMessageId:typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : 'message:' + message.id};
    if (!message || !message.headerMessageId || !res || !res.status) return;
    try {
        const db = await getSharedDB();
        const reqUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const reqUrlSlash = reqUrl + '/';
        const observedAt = Date.now();
        const reportUrl = typeof res.reportUrl === 'string' && /^https:\/\/urlscan\.io\/result\/[A-Za-z0-9_-]+\/?$/i.test(res.reportUrl.trim())
            ? res.reportUrl.trim()
            : null;
        await updateStore(db, 'hybridanalysis', message.headerMessageId, existingRecord => {
            if (!existingRecord || !Array.isArray(existingRecord.links)) return existingRecord;
            for (const item of existingRecord.links) {
                if (item && (item.url === reqUrl || item.url === reqUrlSlash)) {
                    item.urlscan = {
                        status: res.status,
                        ...(res.assessment?.assessmentVersion===1?{assessment:ThundyProviderResults.merge(item.urlscan?.uuid===res.uuid?item.urlscan?.assessment:null,res.assessment)}:{}),
                        ...(typeof res.uuid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(res.uuid)?{uuid:res.uuid}:{}),
                        reasons: Array.isArray(res.reasons) ? res.reasons : [],
                        ...(res.details && { details: res.details }),
                        ...(res.errorCode && { errorCode: res.errorCode }),
                        ...(reportUrl && { reportUrl }),
                        observedAt
                    };
                }
            }
            existingRecord.updatedAt = observedAt;
            return existingRecord;
        }, { preserveReports: true });
    } catch (e) {
        Logger.error('Fehler beim Speichern des urlscan.io-Ergebnisses:', e);
    }
}

async function persistHybridLinkVerdict(message, url, result) {
    if (message && !message.headerMessageId && message.id != null) message={...message,headerMessageId:typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : 'message:' + message.id};
    if (!message || !message.headerMessageId || !url || !result || !result.status) return;
    try {
        const observedAt = Number.isFinite(result.check?.observedAt) ? result.check.observedAt : Date.now();
        await updateStore(await getSharedDB(), 'hybridanalysis', message.headerMessageId, existingRecord => {
            if (!existingRecord || !Array.isArray(existingRecord.links)) return existingRecord;
            for (const item of existingRecord.links) {
                if (item && item.url === url) item.hybrid_verdict = { status: result.status, observedAt };
            }
            existingRecord.updatedAt = observedAt;
            return existingRecord;
        }, { preserveReports: true });
    } catch (e) {
        Logger.error('Fehler beim Speichern des Hybrid-Analysis-Link-Urteils:', e);
    }
}

async function handleCheckLinkState(request, sender, sendResponse) {
    try {
        // Need to find the active message to get headerMessageId
        let message = await getFirstDisplayedMessage(sender && sender.tab && sender.tab.id, { throwOnError: true });
        if (message && !message.headerMessageId && message.id != null) message={...message,headerMessageId:typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : 'message:' + message.id};
        if (!message || !message.headerMessageId || (request.messageId != null && request.messageId !== message.id)) {
            await sendResponse({status: 'UNKNOWN'});
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

        const forward=sendResponse;let incompleteProvider=false;
        sendResponse=async result=>{
            try{const latest=await getFromStore(db,'hybridanalysis',message.headerMessageId);const base=request.url.endsWith('/')?request.url.slice(0,-1):request.url;linkObj=latest?.links?.find(l=>l.url===base||l.url===base+'/')||linkObj;}catch(_){incompleteProvider=true;}
            const fact=ThundyProviderResults.resource(linkObj),rank={unknown:0,none:1,suspicious:2,malicious:3},status=({MALICIOUS:'malicious',MALICIOUS_VISUAL:'malicious',SUSPICIOUS:'suspicious',CLEAN:'none'})[result.status]||'unknown';
            if(rank[fact.verdict]>rank[status]&&['malicious','suspicious'].includes(fact.verdict))result={...result,status:fact.verdict==='malicious'?'MALICIOUS':'SUSPICIOUS',provider:fact.provider==='hybridanalysis'?'Hybrid Analysis':'urlscan.io',retainedFinding:true,check:{...result.check,origin:'stored',outcome:result.check?.outcome||'success',observedAt:fact.observedAt}};
            else if(result.status==='CLEAN'&&(incompleteProvider||typeof ThundyScans!=='undefined'&&ThundyScans.get?.(message.id)?.assessmentIncomplete))result={...result,status:'UNKNOWN',check:{...result.check,outcome:'incomplete'}};
            await forward(result);
        };
        const messageContext = await getMessageAnalysisContext(message, sender?.tab?.id);
        if (messageContext && !linkObj) await indexedDB_save_links_to_db(message, [request.url]);
        const analysisContext = messageContext?.forLinks ? await messageContext.forLinks([linkObj?.url || request.url]) : messageContext;
        let urlscanAttempt = null;
        // Time-of-Click Live Scan via urlscan.io
        if (request.userAction === true && urlscanApikey && tierAtLeast('max') && (!linkObj || linkObj.state === 'UNKNOWN')) {
            try {
                const res = await checkUrlscanIo(request.url, urlscanApikey, analysisContext);
                if(res?.status==='UNKNOWN'){incompleteProvider=true;await persistUrlscanLinkResult(message,request.url,res);}
                if(['ERROR','TIMEOUT'].includes(res?.status))incompleteProvider=true;
                const outcome = res?.status === 'NOT_CHECKED' ? 'not_requested' :
                    res?.errorCode === 'rate_limited' ? 'rate_limited' :
                    res?.errorCode === 'invalid_key' ? 'invalid_key' : 'failed';
                urlscanAttempt = {
                    origin: 'none',
                    outcome,
                    errorCode: res?.errorCode || null,
                    errorDetails: res?.details || null,
                    retryAfter: res?.retryAfter || null,
                    attemptedAt: Date.now(),
                    observedAt: null
                };
                if (res && res.status !== 'ERROR' && res.status !== 'TIMEOUT' && res.status !== 'NOT_CHECKED') {
                    await persistUrlscanLinkResult(message, request.url, res);
                    // Wir überschreiben das Verhalten: Wenn es Visuelles Phishing ist, sofort warnen
                    await sendResponse({ status: res.status, reasons: res.reasons, provider: 'urlscan.io', check: { origin: 'live', outcome: 'success', attemptedAt: Date.now(), observedAt: Date.now() } });
                    return;
                } else if (res && (res.status === 'ERROR' || res.status === 'TIMEOUT')) {
                    await persistUrlscanLinkResult(message, request.url, res);
                }
            } catch (e) {
                urlscanAttempt = { origin: 'none', outcome: 'failed', errorCode: e.name || 'error', errorDetails: e.message, attemptedAt: Date.now(), observedAt: null };
                Logger.error("Fehler bei Time-of-Click Live-Scan:", e);
            }
        }

        if (linkObj && linkObj.urlscan && ['MALICIOUS_VISUAL', 'MALICIOUS', 'SUSPICIOUS', 'CLEAN'].includes(linkObj.urlscan.status) && (!linkObj.hybrid_sha256 || linkObj.state === 'UNKNOWN')) {
            await sendResponse({
                status: linkObj.urlscan.status,
                reasons: Array.isArray(linkObj.urlscan.reasons) ? linkObj.urlscan.reasons : [],
                provider: 'urlscan.io',
                check: { origin: 'stored', outcome: 'success', attemptedAt: request.userAction ? Date.now() : null, observedAt: Number.isFinite(linkObj.urlscan.observedAt) ? linkObj.urlscan.observedAt : null }
            });
            return;
        }

        if (linkObj) {
            // A previously observed live verdict or stored report outranks the submission state.
            const storedVerdict = linkObj.hybrid_verdict && ['MALICIOUS', 'SUSPICIOUS', 'CLEAN'].includes(linkObj.hybrid_verdict.status) ? linkObj.hybrid_verdict : null;
            const reportVerdict = !storedVerdict && linkObj.report && typeof extractHybridVerdictFromOverview === 'function' ? extractHybridVerdictFromOverview(linkObj.report) : null;
            const fallbackStatus = storedVerdict ? storedVerdict.status : (reportVerdict || linkObj.state);
            const fallbackObservedAt = storedVerdict && Number.isFinite(storedVerdict.observedAt) ? storedVerdict.observedAt : linkObj.observedAt;
            const result = await checkHybridAnalysisResult(linkObj.hybrid_sha256, fallbackStatus, {
                requested: request.userAction === true,
                observedAt: fallbackObservedAt,
                analysisContext,
                quickScanId: linkObj.hybrid_submission_id || linkObj.hybrid_job_id || null
            });
            if (result && result.check && result.check.origin === 'live' && result.check.outcome === 'success' && typeof persistHybridLinkVerdict === 'function') {
                await persistHybridLinkVerdict(message, linkObj.url, result);
            }
            await sendResponse({ ...result, provider: 'Hybrid Analysis' });
        } else {
            await sendResponse({
                status: 'UNKNOWN',
                provider: urlscanAttempt ? 'urlscan.io' : 'none',
                errorDetails: urlscanAttempt?.errorDetails || null,
                errorCode: urlscanAttempt?.errorCode || null,
                retryAfter: urlscanAttempt?.retryAfter || null,
                check: urlscanAttempt || { origin: 'none', outcome: !request.userAction ? 'not_requested' : !mayTransmitExternally() ? 'disabled' : 'missing_reference', attemptedAt: request.userAction ? Date.now() : null, observedAt: null }
            });
        }
    } catch (err) {
        await sendResponse({status: 'ERROR'});
    }
}

function validLinkRequest(request, sender, { checking = true } = {}) {
    if (!sender?.tab || !Number.isInteger(sender.tab.id) || !Number.isInteger(request.messageId) || typeof request.url !== 'string' || request.url.length > 65536 || (checking && typeof request.userAction !== 'boolean')) return false;
    if (request.interactionId != null && (typeof request.interactionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(request.interactionId))) return false;
    try { return ['http:', 'https:'].includes(new URL(request.url).protocol); } catch (error) { return false; }
}

// Message documents cannot navigate reliably. Use Thunderbird's external-browser API.
async function handleOpenCheckedLink(request, sender) {
    try {
        const tabId = sender && sender.tab && sender.tab.id;
        if (tabId == null || request.messageId == null || typeof request.url !== 'string') return { success: false };
        const url = new URL(request.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return { success: false };
        const message = await getFirstDisplayedMessage(tabId, { throwOnError: true });
        if (!message || message.id !== request.messageId) return { success: false };
        if (typeof ThundyLinkSecurity !== 'undefined') return await ThundyLinkSecurity.open(request,sender);
        await browser.windows.openDefaultBrowser(url.href);
        return { success: true };
    } catch (error) {
        Logger.warn('Could not open confirmed link in the default browser', error);
        return { success: false };
    }
}

function extractHybridVerdictFromOverview(data) { return ThundyProviderResults.legacy('hybridanalysis',data); }

/**
 * Returns the POST /quick-scan/* response as a storable report when it already
 * carries scanner results or a verdict; bare submission receipts yield null.
 * Callers guard with typeof so isolated test loaders may omit it.
 */
function quickScanReport(json_data) {
    if (!json_data || typeof json_data !== 'object' || Array.isArray(json_data)) return null;
    const hasScanners = (Array.isArray(json_data.scanners) && json_data.scanners.length > 0) ||
        (json_data.scanners_v2 && typeof json_data.scanners_v2 === 'object' && !Array.isArray(json_data.scanners_v2) && Object.keys(json_data.scanners_v2).length > 0);
    const hasVerdict = (typeof json_data.verdict === 'string' && json_data.verdict.trim() !== '') ||
        (typeof json_data.threat_score === 'number' && Number.isFinite(json_data.threat_score)) ||
        typeof json_data.finished === 'boolean';
    return hasScanners || hasVerdict ? json_data : null;
}

// Optional legacy fields never imply a known observation time. `created` on a
// submission is not the time a provider observed its final verdict.
async function checkHybridAnalysisResult(hybrid_sha256, fallbackState, { requested = true, observedAt = null, analysisContext = null, quickScanId = null } = {}) {
    const check = { origin: fallbackState ? 'stored' : 'none', outcome: 'not_requested', attemptedAt: requested ? Date.now() : null, observedAt: Number.isFinite(observedAt) ? observedAt : null };
    const fallback = () => ({ status: fallbackState || 'UNKNOWN', check });
    if (!requested) return fallback();
    if (!mayTransmitExternally()) { check.outcome = 'disabled'; return fallback(); }
    if (!apikey_hybridanalysis) { check.outcome = 'missing_key'; return fallback(); }
    if (!hybrid_sha256) { check.outcome = 'missing_reference'; return fallback(); }
    const options = getHybridAnalysisOptions('GET');
    options.analysisContext = analysisContext ? { event: event => analysisContext.event(event), scopeOverride: 'url' } : null;
    options.url = 'https://hybrid-analysis.com/api/v2/overview/' + encodeURIComponent(hybrid_sha256);
    try { await requireHostPermission(options.url); }
    catch (error) { check.outcome = 'permission_denied'; return fallback(); }
    try {
        let response = await apiGateway.fetchWithTimeout(options.url, options);
        const qsId = quickScanId != null ? String(quickScanId) : '';
        if (response.status === 404 && /^[A-Za-z0-9_-]{1,128}$/.test(qsId) && !['MANUAL_CHECK', 'PENDING_UPLOAD', 'N/A'].includes(qsId)) {
            const qsUrl = 'https://hybrid-analysis.com/api/v2/quick-scan/' + encodeURIComponent(qsId);
            await requireHostPermission(qsUrl);
            response = await apiGateway.fetchWithTimeout(qsUrl, { ...options, url: qsUrl });
        }
        if (response.status === 404) {
            check.outcome = 'not_found';
            return fallback();
        }
        if (response.status === 429) {
            check.outcome = 'rate_limited';
            check.errorCode = 'rate_limited';
            let retrySeconds = null;
            try {
                const errData = await response.json();
                if (errData && Number.isFinite(errData.retry_after)) retrySeconds = errData.retry_after;
            } catch (_) {}
            if (!retrySeconds) {
                const header = response.headers?.get?.('retry-after');
                const num = Number(header);
                if (Number.isFinite(num) && num > 0) retrySeconds = num;
            }
            if (retrySeconds) check.retryAfter = retrySeconds;
            check.error = retrySeconds ? `Rate limit reached. Retry after ${retrySeconds}s` : 'Rate limit or quota reached';
            check.errorDetails = check.error;
            return fallback();
        }
        if (response.status === 401 || response.status === 403) {
            check.outcome = 'invalid_key';
            check.errorCode = 'invalid_key';
            check.error = 'Invalid API key';
            check.errorDetails = 'Invalid or unauthorized Hybrid Analysis API key';
            return fallback();
        }
        if (response.ok === false) {
            check.outcome = 'failed';
            check.errorCode = `http_${response.status}`;
            check.error = `HTTP ${response.status}`;
            check.errorDetails = `HTTP ${response.status}`;
            return fallback();
        }
        const data = await response.json();
        const verdict = extractHybridVerdictFromOverview(data);
        if (!verdict) { check.outcome = 'no_result'; return fallback(); }
        return { status: verdict, check: { ...check, origin: 'live', outcome: 'success', observedAt: Date.now() } };
    } catch (error) {
        check.outcome = 'failed';
        check.errorCode = error.name || 'error';
        check.error = error.message;
        check.errorDetails = error.message;
        return fallback();
    }
}

// Compatibility for existing string-result callers. Message/audit consumers use
// the structured contract above so a fallback cannot acquire fresh evidence.
async function checkHybridAnalysisVerdict(hash, fallbackState) {
    return (await checkHybridAnalysisResult(hash, fallbackState)).status;
}

/**
 * Handles a scan request coming from the injected per-message banner.
 * persist === true adds the sender to the persistent opt-in list, otherwise
 * the scan stays a one-off action (no hidden opt-in).
 */
async function handleRequestScan(request, sender) {
    if (typeof ThundyScans !== 'undefined') { try { return await ThundyScans.request(request,sender); } catch(error) { return {success:false,code:error.code || error.message,error:error.code || error.message}; } }
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
            if (typeof ThundySecurity !== 'undefined' && (await ThundySecurity.read()).admin) await ThundySecurity.authorized(sender,request.token);
            await addSenderOptIn(extractEmailAddress(messageObj.author));
        }
        const analysisContext = await getMessageAnalysisContext(messageObj, sender?.tab?.id ?? request.tabId);
        await processAttachments(messageObj, true, true, analysisContext);
        const fullMessage = await readFullForAnalysis(messageObj, analysisContext);
        const tabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : (request.tabId || null);
        const tab = { id: tabId };
        const parsedUrlCache = new Map();
        const { messageText, urls, filteredUrls } = await processLinks(tab, messageObj, fullMessage, parsedUrlCache, true, true, analysisContext);
        await evaluateAndInjectThreats({ tab, message: messageObj, fullMessage, urls, filteredUrls, messageText, parsedUrlCache, analysisContext });
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

    if (typeof ThundySecurity !== 'undefined' && ['securityCommand','securitySettingsWrite','testProviderKey','startLinkApproval','linkApprovalCommand','securityClearCache'].includes(request.action)) {
        (async () => {
            if (request.action === 'securityCommand') return {success:true,...await ThundySecurity.command(request,sender)};
            if (request.action === 'securitySettingsWrite') return await ThundySecurity.write(request.values,sender,request.token);
            if (request.action === 'testProviderKey') {
                await ThundySecurity.authorized(sender,request.token);
                const result=await ThundyProviders.test(request.provider,request.key,()=>ThundySecurity.authorized(sender,request.token,false));
                const config=ThundyProviders.registry[request.provider];
                const stored=await browser.storage.local.get(['providerConnectionTests',config?.key || 'apikey','ipReputationProvider','ipReputationApiKey']);
                const matches=config && (stored[config.key]===request.key.trim() || stored.ipReputationProvider===request.provider && stored.ipReputationApiKey===request.key.trim());
                if(matches)await browser.storage.local.set({providerConnectionTests:{...stored.providerConnectionTests,[request.provider]:{status:result.status,httpStatus:result.httpStatus||null,observedAt:Date.now(),uploadVerified:false}}});
                return {success:true,...result};
            }
            if (request.action === 'startLinkApproval') return await ThundyLinkSecurity.start(request,sender);
            if (request.action === 'linkApprovalCommand') return await ThundyLinkSecurity.command(request,sender);
            await ThundySecurity.authorized(sender,request.token);
            const db=await getSharedDB();await clearStore(db,'hybridanalysis');return {success:true};
        })().then(sendResponse).catch(error => sendResponse({success:false,code:error.code||(/^[A-Z_]+$/.test(error.message)?error.message:'SECURITY_REQUEST_FAILED')}));
        return true;
    }
    if (typeof ThundySecurity !== 'undefined' && ['clearLinkAudit','clearMemoryCaches'].includes(request.action)) {
        ThundySecurity.authorized(sender,request.token).then(async()=>{
            if(request.action==='clearLinkAudit') { await editLinkAudit(records=>{records.length=0;}); }
            else { urlhausCache.clear();ipReputationCache.clear();vtCache.clear();knownSendersCache.clear();for(const ready of messageAnalyses.values()) Promise.resolve(ready).then(c=>c.dispose()).catch(()=>{});messageAnalyses.clear(); }
            sendResponse({success:true,status:'success'});
        }).catch(()=>sendResponse({success:false,code:'ADMIN_LOCKED'}));
        return true;
    }
    if (request.action === 'openScanSettings') { browser.runtime.openOptionsPage().then(()=>sendResponse({success:true})).catch(()=>sendResponse({success:false}));return true; }
    switch (request.action) {
        case "reportArchiveBlocked":
            if (sender?.url?.split(/[?#]/)[0] !== browser.runtime.getURL('popup.html') || typeof request.headerMessageId !== 'string' || request.headerMessageId.length > 4096) return false;
            if (typeof noteReportArchiveBlocked === 'function') noteReportArchiveBlocked(request.headerMessageId, false);
            for (const ready of messageAnalyses.values()) Promise.resolve(ready).then(context => { if (context.headerMessageId === request.headerMessageId) context.schedule(); }).catch(() => {});
            sendResponse({success:true});return false;
        case "getUiTheme":
            ThundyTheme.snapshot().then(sendResponse).catch(() => sendResponse(null));
            return true;
        case "getMessageAnalysisRecord":
            if (!Number.isInteger(request.messageId)) { sendResponse({success:false}); return false; }
            (async () => {
                const context = await getMessageAnalysisContext(await browser.messages.get(request.messageId));
                return {success:!!context,record:context ? await context.resourceRecord() : null};
            })().then(sendResponse).catch(() => sendResponse({success:false}));
            return true;
        case "getMessageAnalysis":
            if (!Number.isInteger(request.messageId)) { sendResponse({ success: false }); return false; }
            (async () => {
                const message = await browser.messages.get(request.messageId);
                const context = await getMessageAnalysisContext(message, sender?.tab?.id);
                return context ? { success: true, ...await context.snapshot(), contextToken:context.snapshotId } : { success: false };
            })().then(sendResponse).catch(() => sendResponse({ success: false }));
            return true;
        case "recordAnalysisEvent":
            if (sender?.url?.split(/[?#]/)[0] !== browser.runtime.getURL('popup.html') || !Number.isInteger(request.messageId) || request.event?.provider !== 'hybridanalysis' || request.event?.scope !== 'report') return false;
            (async () => {
                const context = await getMessageAnalysisContext(await browser.messages.get(request.messageId));
                return { success: context ? context.event(request.event) : false };
            })().then(sendResponse).catch(() => sendResponse({ success: false }));
            return true;
        case "getLocalRisk":
            (async () => {
                const message = await browser.messages.get(request.messageId);
                const fullMessage = await readFullForAnalysis(message);
                const messageText = extractTextFromParts(fullMessage.parts || fullMessage);
                const urls = filterUrls(extractUrls(messageText));
                const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls: urls, messageText, allowExternal: false });
                const threat = calculateThreatScore(message.author, urls, options);
                threat.coverage = localContentCoverage(fullMessage);
                const context = await getMessageAnalysisContext(message, null, {fullMessage});
                recordLocalCoverage(context, threat.coverage, threat);
                return threat;
            })().then(threat => sendResponse({ status: 'success', threat })).catch(() => sendResponse({ status: 'error' }));
            return true;
        case "refreshThreatBanner":
            if (sender?.url?.split(/[?#]/)[0] !== browser.runtime.getURL('popup.html') || !Number.isInteger(request.messageId)) { sendResponse({ success: false }); return false; }
            (async () => {
                const message = await browser.messages.get(request.messageId);
                const fullMessage = await readFullForAnalysis(message);
                const messageText = extractTextFromParts(fullMessage.parts || fullMessage);
                const urls = extractUrls(messageText);
                const filteredUrls = filterUrls(urls);
                const parsedUrlCache = new Map();
                const context = await getMessageAnalysisContext(message, null, { fullMessage });
                const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache, allowExternal: false, analysisContext: context });
                const threat = calculateThreatScore(message.author, urls, options);
                threat.coverage = localContentCoverage(fullMessage);
                for (const tab of (context && context.tabs ? context.tabs : [])) {
                    try {
                        const active = await getFirstDisplayedMessage(tab, { throwOnError: true });
                        if (!context.disposed && active?.id === message.id) await injectThreatBanner(tab, threat);
                    } catch (_) { /* closed or changed message */ }
                }
                if (context) { recordLocalCoverage(context, threat.coverage, threat); await context.flush().catch(() => {}); }
                return { success: true, score: threat.score };
            })().then(sendResponse).catch(() => sendResponse({ success: false }));
            return true;
        case "clearMemoryCaches":
            if(typeof ThundyScans !== 'undefined') ThundyScans.invalidate({silent:true,clear:true});
            if (typeof clearReportArchiveWarnings === 'function') clearReportArchiveWarnings();
            if (typeof apiGateway !== 'undefined' && typeof apiGateway.clearBackoffs === 'function') apiGateway.clearBackoffs();
            urlhausCache.clear(); ipReputationCache.clear(); vtCache.clear(); knownSendersCache.clear();
            for (const ready of messageAnalyses.values()) Promise.resolve(ready).then(context => {
                context.dispose();
            }).catch(() => {});
            messageAnalyses.clear();
            if (browser.runtime.sendMessage) browser.runtime.sendMessage({ action: 'memoryCachesCleared' }).catch(() => {});
            sendResponse({ status: 'success' });
            return false;
        case "uploadAttachment":
            handleManualUpload(request.messageId, request.partName, request.attachmentName, request.hash, request.headerMessageId)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message, code: err.code}));
            return true;

        case "scanUrl":
            (async () => {
                let context = null;
                if (Number.isInteger(request.messageId)) {
                    const message = await browser.messages.get(request.messageId);
                    const key = (typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id);
                    if (key !== request.headerMessageId) throw typedError('MESSAGE_CONTEXT_CHANGED', msg('analysisContextChanged'));
                    context = await getMessageAnalysisContext(message);
                }
                return await handleUrlScan(request.url, request.headerMessageId, context);
            })().then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message, code: err.code}));
            return true;

        case "cancelLinkInteraction":
            if (!validLinkRequest(request, sender, { checking: false })) { sendResponse({ success: false }); return false; }
            handleCancelAuditedLink(request, sender).then(sendResponse);
            return true;

        case "getLinkAudit":
            if (!isLinkAuditAdminPage(sender)) return false;
            readLinkAudit().then(data => sendResponse({ success: true, ...data })).catch(() => sendResponse({ success: false }));
            return true;

        case "clearLinkAudit":
            if (!isLinkAuditAdminPage(sender)) return false;
            editLinkAudit(records => { records.length = 0; }).then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
            return true;

        case "openCheckedLink":
            if (!validLinkRequest(request, sender, { checking: false })) { sendResponse({ success: false }); return false; }
            (request.interactionId ? handleOpenAuditedLink(request, sender) : handleOpenCheckedLink(request, sender)).then(sendResponse);
            return true;

        case "checkLinkState":
            if (!validLinkRequest(request, sender)) { sendResponse({ status: 'ERROR', auditSaved: false }); return false; }
            if (request.interactionId) handleAuditedLinkCheck(request, sender).then(sendResponse);
            else handleCheckLinkState(request, sender, sendResponse);
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

async function handleUrlScan(url, headerMessageId, analysisContext = null) {
    // A header-only caller cannot prove which duplicate message initiated this request.
    if (!apikey_hybridanalysis) throw new Error(uiText("ui_086", "API-Key fehlt."));
    assertExternalAnalysisAllowed();
    // Submitting the full URL to the sandbox is a "max" tier feature (see
    // docs/privacy_policy.md §3.3/§5); the host permission must be granted too.
    if (!tierAtLeast('max')) {
        throw typedError(TIER_REQUIRES_MAX, msg('errorTierUrlScanBlocked'));
    }
    await requireHostPermission('https://hybrid-analysis.com/api/v2/quick-scan/url-for-analysis');
    if (analysisContext?.forLinks) {
        await indexedDB_save_links_to_db({id:analysisContext.messageId,headerMessageId:analysisContext.headerMessageId}, [url]);
        analysisContext = await analysisContext.forLinks([url]);
    }


    const formBody = new URLSearchParams();
    formBody.append('scan_type', 'all');
    formBody.append('url', url);

    const options = getHybridAnalysisOptions('POST', formBody, true);
    options.analysisContext = analysisContext;
    options.url = 'https://hybrid-analysis.com/api/v2/quick-scan/url-for-analysis';

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
                        existingRecord.links[linkIndex].hybrid_submission_id = json_data.submission_id || json_data.id;
                        existingRecord.links[linkIndex].hybrid_job_id = json_data.job_id || (Array.isArray(json_data.reports) && json_data.reports[0]) || json_data.id;
                        existingRecord.links[linkIndex].hybrid_sha256 = json_data.sha256;
                        existingRecord.links[linkIndex].state = 'UPLOADED';
                        // Keep the immediate quick-scan payload (scanner states) instead of discarding it.
                        const quickReport = typeof quickScanReport === 'function' ? quickScanReport(json_data) : null;
                        existingRecord.links[linkIndex].report = quickReport;
                        existingRecord.links[linkIndex].report_fetched_at = quickReport ? new Date().toISOString() : null;
                    }
                }
                return existingRecord;
            }, {preserveReports:true});
        } catch (dbError) {
            Logger.error('Fehler beim Aktualisieren des DB Records für URL:', dbError);
        }
        return json_data;
    } else {
        throw new Error(uiText("ui_099", "Fehler beim URL-Scan: ") + String(response.status));
    }
}

async function handleManualUpload(messageId, partName, attachmentName, hash, headerMessageId) {
    const messageContext = await getMessageAnalysisContext(await browser.messages.get(messageId));
    const analysisContext = messageContext?.forAttachment ? messageContext.forAttachment(partName) : messageContext;
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
    options.analysisContext = analysisContext;
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
                        existingRecord.attachments[attIndex].hybrid_submission_id = json_data.submission_id || json_data.id;
                        existingRecord.attachments[attIndex].hybrid_job_id = json_data.job_id || (Array.isArray(json_data.reports) && json_data.reports[0]) || json_data.id;
                        if (json_data.sha256) existingRecord.attachments[attIndex].hybrid_sha256 = json_data.sha256;
                        existingRecord.attachments[attIndex].state = 'UPLOADED';
                        // Keep the immediate quick-scan payload (scanner states) instead of discarding it.
                        const quickReport = typeof quickScanReport === 'function' ? quickScanReport(json_data) : null;
                        existingRecord.attachments[attIndex].report = quickReport;
                        existingRecord.attachments[attIndex].report_fetched_at = quickReport ? new Date().toISOString() : null;
                    }
                }
                return existingRecord;
            }, {preserveReports:true});
        } catch (dbError) {
            Logger.error('Fehler beim Aktualisieren des DB Records:', dbError);
        }
        return json_data;
    } else {
        throw new Error(uiText("ui_060", "Fehler beim Upload: ") + String(response.status));
    }
}

// Prune expired audit records when the extension starts as well as on access/write.
if (typeof readLinkAudit === 'function') readLinkAudit().catch(() => Logger.warn('Could not prune local link audit at startup'));

// First-install setup only. Updates never change existing preferences or reopen setup.
let onboardingOpened = false;
async function openInitialSetup(details) {
    if (details?.reason !== 'install' || onboardingOpened) return;
    onboardingOpened = true;
    try {
        const stored = await browser.storage.local.get('onboardingState');
        if (stored.onboardingState?.status === 'completed') return;
        await browser.tabs.create({ url: browser.runtime.getURL('onboarding.html') });
    } catch (error) {
        onboardingOpened = false;
        Logger.error('Initial setup could not be opened; it remains available in settings', error);
    }
}
if (browser.runtime?.onInstalled) browser.runtime.onInstalled.addListener(openInitialSetup);
