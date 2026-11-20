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
            try {
                if (typeof pruneStore === 'function') await pruneStore(db, 'hybridanalysis');
                return db;
            } catch (error) {
                // A retry owns a new connection; failed startup must release this one.
                try { db.close(); } catch (_) { /* Preserve the original cleanup failure. */ }
                throw error;
            }
        }).catch(error => { sharedDBPromise = null; throw error; });
    }
    return sharedDBPromise;
}

// Contexts are keyed by the actual message, never by the currently selected tab.
const MAX_MESSAGE_ANALYSES = 200;
let analysisRuntimeId = null;
function getAnalysisRuntimeId() { return analysisRuntimeId ||= crypto.randomUUID(); }
function messageReportOptions(message, options = {}) {
    const reportScope=occurrenceMetadataKey(getAnalysisRuntimeId(),message?.id);
    return reportScope ? {...options,reportScope} : options;
}
const MAX_SOURCE_SNAPSHOTS = 64;
const MAX_SOURCE_SNAPSHOT_BYTES = 1024 * 1024;
const messageAnalyses = typeof ExpiringMap !== 'undefined' ? new ExpiringMap(900000, () => Date.now(), {
    maxSize: MAX_MESSAGE_ANALYSES, autoExpire: true,
    onEvict: ready => Promise.resolve(ready).then(context => { if(!context.scanJobOwner)context.dispose(); }).catch(() => {})
}) : new Map();
async function getMessageAnalysisContext(message, tabId = null, inventory = {}) {
    if (typeof ThundyAnalysis === 'undefined' || !message) return null;
    const key = typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id;
    const pinned = typeof ThundyScans !== 'undefined' ? ThundyScans.contextFor?.(message.id) : null;
    if(pinned && !pinned.disposed && pinned.headerMessageId===key) {
        if(tabId!=null)pinned.tabs.add(tabId);
        return pinned;
    }
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
                if (full) for (const url of messageUrlInventory(full)) currentLinks.add(url);
            } catch (_) { /* no fallback to another message's links */ }
            let record = null;
            try { record = await getFromStore(await getSharedDB(), 'hybridanalysis', key,messageReportOptions(message)); } catch (_) { /* still expose live state */ }
            const sourceRecord = saved => {
                if (!saved) return saved;
                saved = ThundyAnalysis.resources({...saved,links:Array.isArray(saved.links) ? saved.links.map((item,index) => item && typeof item === 'object' && !Array.isArray(item) ? {...item,analysisResourceRef:'link:' + index} : item) : saved.links});
                // Numeric IDs and metadata alone cannot bind historical findings.
                const attachments = (saved.attachments || []).filter(item => item.partName && currentParts.has(String(item.partName)) && currentParts.get(String(item.partName)) === item.attachment_name && verifiedHashes.has(String(item.partName)) && typeof item.hybrid_sha256 === 'string' && verifiedHashes.get(String(item.partName)) === item.hybrid_sha256.toLowerCase());
                const links = saved.links.filter(item => currentLinks.has(canonicalHttpUrl(item.url)));
                const {scanCoverage={},threatIntel,scanJobMeta}=readOccurrenceMetadata(saved,getAnalysisRuntimeId(),message.id);
                return {messageHeader:saved.messageHeader, attachments, links, ...(scanJobMeta ? {scanJobMeta}:{}), ...(saved.sourceDataIncomplete ? {sourceDataIncomplete:true} : {}), scanCoverage:Object.keys(scanCoverage).length ? scanCoverage : undefined, ...(threatIntel ? {threatIntel} : {})};
            };
            const model = ThundyAnalysis.create(ThundyAnalysis.legacy(sourceRecord(record)));
            // Current unreadability must not inherit a historical "checked" state.
            if (currentCoverage.state !== 'checked') model.data.local = {...currentCoverage,source:'local',observedAt:Date.now()};
            let snapshotCreated = false, persistenceQueue = Promise.resolve();
            const context = { disposed: false, model, snapshotId, persistenceFailed:false, headerMessageId: key, messageId: message.id, tabs: new Set(), timer: null,
                isCached() { return messageAnalyses.get(contextKey) === ready; },
                dispose() { context.disposed = true; if (context.timer) clearTimeout(context.timer); context.timer = null; context.tabs.clear(); },
                event(event) { if (context.disposed || !context.scanJobOwner && messageAnalyses.get(contextKey) !== ready) { context.dispose(); return false; } messageAnalyses.touch?.(contextKey); const valid = model.event(event); if (valid) context.schedule(); return valid; },
                cached(provider, scope, verdict, observedAt) { context.event({ provider, scope, phase: 'cache', state: verdict === 'unknown' ? 'received' : 'checked', verdict, observedAt }); },
                forAttachment(partName, name, hash) { if (name != null) currentParts.set(String(partName), name); if (/^[0-9a-f]{64}$/i.test(hash || '')) verifiedHashes.set(String(partName), hash.toLowerCase()); return ThundyAnalysis.bind(context, ['attachment:' + partName]); },
                async resourceRecord() {
                    const saved = sourceRecord(await getFromStore(await getSharedDB(), 'hybridanalysis', key,messageReportOptions(message)));
                    if (!saved) return null;
                    // Unbound legacy findings may remain unknown summaries, never named popup resources.
                    return {...saved,attachments:(saved.attachments || []).filter(item => item.partName && currentParts.get(String(item.partName)) === item.attachment_name)};
                },
                async forLinks(urls) {
                    for (const url of urls) { const key=canonicalHttpUrl(url); if(key)currentLinks.add(key); }
                    try {
                        const saved = await getFromStore(await getSharedDB(), 'hybridanalysis', key,messageReportOptions(message));
                        const links = Array.isArray(saved?.links) ? saved.links : [];
                        return ThundyAnalysis.bind(context, urls.map(url => { const index = links.findIndex(item => item && sameAnalysisUrl(item.url,url)); return index < 0 ? null : 'link:' + index; }));
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
                        const original = await getFromStore(await getSharedDB(), 'hybridanalysis', key,messageReportOptions(message,{includeHistory:true})), saved = original ? ThundyAnalysis.resources(original) : null, current = sourceRecord(original);
                        if (saved) sourceHistory = ThundyAnalysis.history({...saved,attachments:(saved.attachments || []).filter(item => !(current.attachments || []).includes(item)),links:(saved.links || []).filter(item => !currentLinks.has(canonicalHttpUrl(item.url)))},snapshotId);
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
                        if (!context.scanRunId) ThundyAnalysis.refreshStored(model,current);
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
                        const saved = await getFromStore(await getSharedDB(), 'hybridanalysis', key,messageReportOptions(message));
                        for (const [index,item] of (Array.isArray(saved?.links) ? saved.links : []).entries()) if (item && currentLinks.has(canonicalHttpUrl(item.url))) {
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
                    return { ...JSON.parse(JSON.stringify(model.data)), displayPreferences, hybridReports, hybridReportsTruncated, scanJob:context.scanJob || {state:'idle',migration:(await browser.storage.local.get('scanMode')).scanMode===undefined,manualAllowed:mayTransmitExternally()}, scanRunId:context.scanRunId || null, contextToken:context.snapshotId, protection, providerAccess, providerNames:typeof ThundyProviders !== 'undefined' ? Object.fromEntries(Object.entries(ThundyProviders.registry).map(([id,v])=>[id,v.name])) : undefined, sourceHistory, attachmentActions:typeof ThundyAttachmentDownload !== 'undefined', sourcePersistenceFailed:context.persistenceFailed, sourcePersistenceReason:context.persistenceReason || null, sourcePersistenceError:context.persistenceError || null, diagnosticRun:context.diagnosticRun||null, reportArchiveBlocked:typeof wasReportArchiveBlocked === 'function' && wasReportArchiveBlocked(key), resourceLabels, availability, diagnostics: { backoffs }, messageId: message.id };
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
                            if (previous != null && (typeof previous !== 'object' || Array.isArray(previous))) throw Object.assign(new Error('Invalid source snapshot container'),{code:'snapshot_invalid'});
                            if (!snapshotCreated && Object.prototype.hasOwnProperty.call(previous || {}, snapshotId)) throw Object.assign(new Error('Source snapshot identifier collision'),{code:'snapshot_collision'});
                            if (!Object.prototype.hasOwnProperty.call(previous || {}, snapshotId) && Object.keys(previous || {}).length >= MAX_SOURCE_SNAPSHOTS) throw Object.assign(new Error('Source snapshot capacity reached'),{code:'snapshot_count'});
                            // Reconcile the captured event state with current stored facts
                            // inside the transaction. Do not persist an older cached view.
                            const synchronized = {data:JSON.parse(JSON.stringify(value))};
                            if (!context.scanRunId) ThundyAnalysis.refreshStored(synchronized,sourceRecord(old));
                            const snapshots = {...previous,[snapshotId]:{savedAt:Date.now(),snapshot:synchronized.data}};
                            if (new TextEncoder().encode(JSON.stringify(snapshots)).length > MAX_SOURCE_SNAPSHOT_BYTES) throw Object.assign(new Error('Source snapshot byte capacity reached'),{code:'snapshot_bytes'});
                            // Additive area: never overwrite legacy snapshots under reused IDs.
                            return {...(old || {messageHeader:key}),analysisSourceSnapshots:snapshots,updatedAt:Date.now()};
                        },messageReportOptions(message));
                        snapshotCreated = true;
                        context.persistenceFailed = false; context.persistenceReason = null; context.persistenceError = null;if(typeof ThundyApiDiagnostics!=='undefined')ThundyApiDiagnostics.event(context.diagnosticRun,'persistence',{state:'complete'});
                      }
                      catch (error) { context.persistenceError=['QuotaExceededError','InvalidStateError','AbortError','UnknownError','DataCloneError','NotFoundError','TransactionInactiveError','SecurityError'].includes(error?.name)?error.name:null; if(typeof ThundyApiDiagnostics!=='undefined')ThundyApiDiagnostics.event(context.diagnosticRun,'persistence',{state:'failed',reason:context.persistenceError||error?.code||'storage_failed'}); context.persistenceFailed = true; context.persistenceReason = ['snapshot_invalid','snapshot_collision','snapshot_count','snapshot_bytes'].includes(error?.code) ? error.code : 'storage_failed'; Logger.warn('Analysis source metadata could not be persisted'); }
                    });
                    await persistenceQueue;
                    const snapshot = await context.snapshot();
                    if (context.disposed) return;
                    const labels = ThundyAnalysis.labels(msg);
                    const theme = typeof ThundyTheme !== 'undefined' ? await ThundyTheme.snapshot() : null;
                    for (const tab of context.tabs) {
                        try {
                            const active = await getFirstDisplayedMessage(tab, { throwOnError: true });
                            if (!context.disposed && active?.id === message.id) await injectIntoMessageDisplay(tab, ThundyAnalysis.render, [snapshot, labels, theme?.css || '', {surface:'message'}]);
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
function clearAnalysisMemory() {
    hybridReportBroker?.clear();
    attachmentDownloads?.clear();
    if(typeof ThundyScans !== 'undefined')ThundyScans.invalidate({silent:true,clear:true});
    if(typeof clearReportArchiveWarnings === 'function')clearReportArchiveWarnings();
    apiGateway?.clearBackoffs?.();
    urlhausCache.clear();ipReputationCache.clear();vtCache.clear();knownSendersCache.clear();
    for(const ready of messageAnalyses.values())Promise.resolve(ready).then(context=>context.dispose()).catch(()=>{});
    messageAnalyses.clear();
    browser.runtime.sendMessage?.({action:'memoryCachesCleared'})?.catch?.(()=>{});
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
                            hybrid_quick_scan_id: typeof json_data.id==='string'?json_data.id:null,
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
    try {
        await updateStore(await getSharedDB(), 'hybridanalysis', key, existing =>
            updateOccurrenceMetadata(existing || {messageHeader:key},getAnalysisRuntimeId(),message.id,{scanCoverage:{[kind]:coverage}}));
    } catch (error) {
        if (!['OCCURRENCE_METADATA_CAPACITY','OCCURRENCE_METADATA_INVALID'].includes(error?.code)) throw error;
        Logger.warn('Occurrence coverage could not be stored', error.code);
    }
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
  let urls = messageUrlInventory(fullMessage);
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
    await updateStore(await getSharedDB(), 'hybridanalysis', key, existing =>
      updateOccurrenceMetadata(existing || {messageHeader:key},getAnalysisRuntimeId(),message.id,{threatIntel:summary}));
  } catch (e) {
    Logger.error('Fehler beim Speichern der Threat-Intel-Zusammenfassung:', e);
  }
}

function attachmentRiskEvidence(item, digest, archived) {
  const {bound,fullyBound} = ThundyProviderResults.boundAttachmentReports(item.report,digest);
  // An assessment derived from a mixed legacy response cannot be bound separately.
  const assessment = fullyBound ? item.assessment : null;
  const hybrid = ThundyProviderResults.stored('hybridanalysis', {assessment, report:bound.length ? bound : null});
  const time = typeof item.report_fetched_at === 'string' ? Date.parse(item.report_fetched_at) : NaN;
  const observedAt = Number.isFinite(time) ? time : null;
  const confirmed = item.state !== 'UPLOADED' && hybrid.verdict !== 'unknown' &&
    hybrid.completion === 'complete' && bound.length > 0 && fullyBound &&
    bound.every(ThundyProviderResults.hybridCompletionConfirmed);
  const stats = archived ? null : item.virustotal_stats;
  const virusTotal = Number.isFinite(stats?.malicious) && stats.malicious > 0 ? 'malicious' :
    Number.isFinite(stats?.suspicious) && stats.suspicious > 0 ? 'suspicious' : 'unknown';
  return {digest, archived, observedAt, confirmed, hybrid:hybrid.verdict, virusTotal};
}

function attachmentFindingStrength(verdict) {
  return verdict === 'malicious' ? 2 : verdict === 'suspicious' ? 1 : 0;
}
function selectAttachmentRiskFinding(items, name) {
  let latestCompleted = -Infinity;
  for (const item of items) {
    if (!item.archived && item.confirmed && item.observedAt !== null) {
      latestCompleted = Math.max(latestCompleted, item.observedAt);
    }
  }
  let best = null;
  // Current records precede archived ones, so ties preserve current provenance.
  for (const item of items) {
    if (item.archived && item.observedAt !== null && latestCompleted > item.observedAt) continue;
    for (const [provider, verdict] of [['Hybrid Analysis',item.hybrid],['VirusTotal',item.virusTotal]]) {
      const strength = attachmentFindingStrength(verdict);
      if (strength > attachmentFindingStrength(best?.verdict)) {
        best = {name,verdict,provider,...(item.archived ? {source:'archive',observedAt:item.observedAt} : {})};
      } else if (strength && item.archived && best?.source === 'archive' && verdict === best.verdict &&
          (item.observedAt ?? -Infinity) > (best.observedAt ?? -Infinity)) {
        best.observedAt = item.observedAt;
      }
    }
  }
  return best;
}

/** Looks up byte-bound attachment warnings locally, including preserved Hybrid reports. */
async function collectAttachmentFindings(message) {
  if (!message || (!message.headerMessageId && message.id == null)) return [];
  if (typeof getFromStore !== 'function' || typeof getSharedDB !== 'function') return [];
  try {
    const key = typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id;
    const record = await getFromStore(await getSharedDB(), 'hybridanalysis', key,messageReportOptions(message,{includeHistory:'attachment'}));
    const candidates = new Map();
    const add = (item, archived) => {
      if (typeof item?.partName !== 'string' || !/^[0-9]+(?:\.[0-9]+)*$/.test(item.partName) ||
          typeof item.hybrid_sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(item.hybrid_sha256)) return;
      if (!candidates.has(item.partName)) candidates.set(item.partName, []);
      candidates.get(item.partName).push(attachmentRiskEvidence(item,item.hybrid_sha256.toLowerCase(),archived));
    };
    for (const item of Array.isArray(record?.attachments) ? record.attachments : []) add(item,false);
    const archive = record?.analysisReportArchive;
    if (archive?.schemaVersion === 1 && Array.isArray(archive.entries)) {
      for (const entry of archive.entries) {
        if (entry?.kind === 'attachment') add(entry.resource,true);
      }
    }
    for (const [part, items] of candidates) {
      if (!items.some(item => attachmentFindingStrength(item.hybrid) || attachmentFindingStrength(item.virusTotal))) candidates.delete(part);
    }
    if (!candidates.size) return [];
    const current=await browser.messages.listAttachments(message.id);
    const parts = new Map();
    for (const item of current.slice(0,100)) {
      if (candidates.has(item?.partName)) parts.set(item.partName,parts.has(item.partName) ? null : item);
    }
    const findings = [];
    for (const [part, actual] of parts) {
      if (!actual || actual.size > 25*1024*1024) continue;
      try {
        const file = await browser.messages.getAttachmentFile(message.id,part);
        if (file.size > 25*1024*1024) continue;
        const digest = await get_sha256_hash(await file.arrayBuffer());
        const items = candidates.get(part).filter(item => item.digest === digest);
        const finding = selectAttachmentRiskFinding(items,actual.name || file.name);
        if (finding) findings.push(finding);
      } catch (_) { /* An unreadable file cannot inherit a stored finding. */ }
    }
    return findings.sort((a,b) => attachmentFindingStrength(b.verdict)-attachmentFindingStrength(a.verdict));
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
function savedLinkAssessments(record, urls = null) {
    const current = new Map();
    for (const item of Array.isArray(record?.links) ? record.links : []) {
        const url = canonicalHttpUrl(item?.url);
        if (url && (!urls || urls.has(url)) && !current.has(url)) current.set(url, ThundyProviderResults.resource(item));
    }
    const findings = new Map(current);
    const entries = Array.isArray(record?.analysisReportArchive?.entries) ? record.analysisReportArchive.entries : [];
    for (const entry of entries) {
        if (entry?.kind !== 'link') continue;
        const url = canonicalHttpUrl(entry.resource?.url);
        if (!url || urls && !urls.has(url)) continue;
        const earlier = ThundyProviderResults.resource(entry.resource);
        if (!['malicious', 'suspicious'].includes(earlier.verdict)) continue;
        const finishedAt = current.get(url)?.completedAt?.[earlier.provider];
        const superseded = Number.isFinite(finishedAt) && Number.isFinite(earlier.observedAt) && finishedAt > earlier.observedAt;
        if (!superseded && attachmentFindingStrength(earlier.verdict) > attachmentFindingStrength(findings.get(url)?.verdict)) {
            findings.set(url, {...earlier, source: 'archive'});
        }
    }
    return findings;
}

async function collectLinkFindings(message, fullMessage = null) {
    if (typeof getFromStore !== 'function' || typeof getSharedDB !== 'function') return [];
    try {
        const key = typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id;
        const record = await getFromStore(await getSharedDB(), 'hybridanalysis', key, messageReportOptions(message, {includeHistory: 'link'}));
        const full = fullMessage || await readFullForAnalysis(message);
        const urls = new Set(messageUrlInventory(full));
        const saved = savedLinkAssessments(record, urls);
        const findings = [];
        for (const url of urls) {
            const fact = saved.get(url);
            if (['malicious', 'suspicious'].includes(fact?.verdict)) {
                findings.push({url, verdict: fact.verdict, provider: fact.provider === 'hybridanalysis' ? 'Hybrid Analysis' : 'URLScan.io', source: fact.source});
            }
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
  const assessment=beginLocalAssessment(message.id);
  const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache, allowExternal, analysisContext });
  const threat = calculateThreatScore(message.author, urls, options);
  threat.coverage = localContentCoverage(fullMessage);threat.assessment={...assessment,observedAt:Date.now()};
  if(analysisContext?.model.data.local?.assessment?.runtimeId===assessment.runtimeId&&analysisContext.model.data.local.assessment.revision>assessment.revision)return;
  if (analysisContext && !recordLocalCoverage(analysisContext, threat.coverage, threat)) return;
  await injectThreatBanner(tab.id, threat);
  if (analysisContext) await analysisContext.flush().catch(() => {});
}

// This describes the available text input, not an antivirus or full MIME verdict.
function localContentCoverage(fullMessage) {
  if (!fullMessage || typeof fullMessage !== 'object') return {state:'failed',reason:'read_failed'};
  if (fullMessage.thundyInputStatus === 'incomplete') return {state:'incomplete',reason:'text_unavailable'};
  let unavailable = false, missingText = false;
  const visit = part => {
    if (!part || typeof part !== 'object') return;
    if (['fail','skipped'].includes(part.decryptionStatus) ||
        part.contentType === 'multipart/encrypted' && fullMessage.decryptionStatus !== 'success' ||
        ['application/pkcs7-mime','application/x-pkcs7-mime'].includes(part.contentType) && !part.parts?.length) unavailable = true;
    // Thunderbird omits body for valid zero-length text parts. Absence alone
    // is no failure; a positive decoded size supplies the missing evidence.
    const attachment = !!part.name || (part.headers?.['content-disposition'] || []).some(value => /^attachment(?:;|$)/i.test(value.trim()));
    if (!attachment && ['text/plain','text/html'].includes(part.contentType) && part.size > 0 && typeof part.body !== 'string') missingText = true;
    for (const child of part.parts || []) visit(child);
  };
  visit(fullMessage);
  return unavailable ? {state:'incomplete',reason:'decryption_unavailable'} : missingText ? {state:'incomplete',reason:'text_unavailable'} : {state:'checked'};
}

let localAssessmentSequence=0;
function beginLocalAssessment(messageId,requestId){
  return {schemaVersion:1,runtimeId:getAnalysisRuntimeId(),revision:++localAssessmentSequence,messageId,observedAt:Date.now(),...(typeof requestId==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)?{requestId}:{})};
}
function recordLocalCoverage(context, coverage, threat = null, assessment = threat?.assessment) {
  if (!context || context.disposed) return false;
  assessment ||= beginLocalAssessment(context.messageId);
  const previous=context.model.data.local?.assessment;
  if(previous?.runtimeId===assessment.runtimeId&&previous.revision>=assessment.revision)return false;
  context.model.data.local = {...coverage,source:'local',observedAt:assessment.observedAt,assessment,...(threat ? {
    score:threat.score,heuristicScore:threat.heuristicScore,riskModelVersion:threat.riskModelVersion,
    reasons:threat.reasons.slice(0,20),heuristicReasons:threat.heuristicReasons?.slice(0,20),providerReasons:threat.providerReasons?.slice(0,20),
    archivedAttachmentReasons:threat.archivedAttachmentReasons?.slice(0,20)
  } : {})};
  context.schedule();
  return true;
}

async function readFullForAnalysis(message, context = null, assessment = null) {
  try { return await getAnalysisFull(message.id); }
  catch (error) {
    // Preserve the API failure without retrying it during context creation.
    try {
      context ||= await getMessageAnalysisContext(message, null, {fullMessage:null});
      recordLocalCoverage(context, {state:'failed',reason:'read_failed'},null,assessment);
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

const EXTRACT_URLS_REGEX = /https?:\/\/[^\s"'<>]+/gi;
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

function canonicalHttpUrl(value){
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch(_){return null;}
}
function sameAnalysisUrl(a,b){
  const key=canonicalHttpUrl(a);
  return key!==null&&key===canonicalHttpUrl(b);
}

// Actual message targets are independent of provider eligibility. Detached HTML
// is never inserted into a document; visible anchor text cannot replace href.
function messageUrlInventory(full){
  const urls=new Set();
  const add=value=>{const key=canonicalHttpUrl(value);if(key)urls.add(key);};
  const visit=part=>{
    if(Array.isArray(part)){for(const child of part)visit(child);return;}
    if(!part||typeof part!=='object')return;
    const attachment=!!part.name||(part.headers?.['content-disposition']||[]).some(value=>/^attachment(?:;|$)/i.test(value.trim()));
    if(attachment)return;
    if(typeof part.body==='string'){
      if(part.contentType?.toLowerCase().split(';')[0]==='text/html'){
        const doc=new DOMParser().parseFromString(part.body,'text/html');
        for(const element of doc.querySelectorAll('script,style,head,template'))element.remove();
        for(const anchor of doc.querySelectorAll('a[href]')){add(anchor.getAttribute('href'));anchor.remove();}
        for(const url of extractUrls(doc.body?.textContent||''))add(url);
      }else if(!part.contentType||part.contentType.toLowerCase().split(';')[0]==='text/plain')for(const url of extractUrls(part.body))add(url);
    }
    for(const child of part.parts||[])visit(child);
  };
  visit(full);return [...urls];
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
                hybridData.hybrid_data.quick_scan_id = typeof uploadData.id==='string'?uploadData.id:null;
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
        hybrid_quick_scan_id: result.hybrid_data.quick_scan_id || null,
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
                atts[j] = sameContent && ['MANUAL_CHECK_PENDING','UNKNOWN','NOT_CHECKED'].includes(newAtt.state) && (old.report != null || old.virustotal_stats != null || ['KNOWN','UPLOADED'].includes(old.state)) ? {...newAtt,state:old.state,hybrid_quick_scan_id:old.hybrid_quick_scan_id,hybrid_job_id:old.hybrid_job_id,hybrid_submission_id:old.hybrid_submission_id,report:old.report,report_fetched_at:old.report_fetched_at,virustotal_stats:newAtt.virustotal_stats ?? old.virustotal_stats} : newAtt;
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
      }, messageReportOptions(message,{preserveReports:true}));
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
      }, messageReportOptions(message,{preserveReports:true}));
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
      },messageReportOptions(message));
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
    if (typeof ThundyAttachmentDownload !== 'undefined') menus.push({
        id: 'save-attachment-thundy',
        title: msg('attachmentSaveWithThundy'),
        contexts: ['message_attachments']
    });
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

// Attachment menus can report the internal about:message tab instead of the
// enclosing API tab. Bind that menu to its active message before a click.
let attachmentMenuOrigin = null;
browser.menus?.onShown?.addListener((info,tab) => {
    if (!info.contexts?.includes('message_attachments')) return;
    attachmentMenuOrigin = null;
    if (!info.menuIds?.includes('save-attachment-thundy') || info.attachments?.length !== 1) return;
    attachmentMenuOrigin = {
        eventTabId:tab?.id,
        partName:info.attachments[0].partName,
        target:(async () => {
            const [active] = await browser.tabs.query({active:true,lastFocusedWindow:true});
            const tabId = ['mail','messageDisplay'].includes(tab?.type) ? tab.id : active?.id;
            if (!Number.isSafeInteger(tabId) || tabId !== active?.id) return null;
            const message = await getFirstDisplayedMessage(tabId);
            return message ? {tabId,messageId:message.id,partName:info.attachments[0].partName} : null;
        })().catch(() => null)
    };
});

if (browser.menus && browser.menus.onClicked) browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'save-attachment-thundy' && attachmentDownloads) {
        const origin = attachmentMenuOrigin;
        attachmentMenuOrigin = null;
        try {
            if (!origin || origin.eventTabId !== tab?.id || info.attachments?.length !== 1 ||
                origin.partName !== info.attachments[0].partName) throw Error('ATTACHMENT_CONTEXT_CHANGED');
            const target = await origin.target;
            if (!target) throw Error('ATTACHMENT_CONTEXT_CHANGED');
            await attachmentDownloads.start(target);
        } catch (_) {notify('attachmentProtectionTitle','attachmentFailed');}
        return;
    }
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

        const attemptedAt = Date.now();
        const reportUrl = typeof res.reportUrl === 'string' && /^https:\/\/urlscan\.io\/result\/[A-Za-z0-9_-]+\/?$/i.test(res.reportUrl.trim())
            ? res.reportUrl.trim()
            : null;
        await updateStore(db, 'hybridanalysis', message.headerMessageId, existingRecord => {
            if (!existingRecord || !Array.isArray(existingRecord.links)) return existingRecord;
            for (const item of existingRecord.links) {
                if (item && sameAnalysisUrl(item.url,url)) {
                    item.urlscan = ThundyProviderResults.urlscanRecord({
                        status:res.status,
                        ...(res.terminal===true?{terminal:true}:{}),
                        ...(res.assessment?.assessmentVersion===1?{assessment:res.assessment}:{}),
                        ...(typeof res.uuid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(res.uuid)?{uuid:res.uuid}:{}),
                        reasons:Array.isArray(res.reasons)?res.reasons:[],
                        ...(res.errorCode?{errorCode:res.errorCode}:{}),
                        ...(reportUrl?{reportUrl}:{})
                    },item.urlscan,attemptedAt);
                }
            }
            existingRecord.updatedAt = attemptedAt;
            return existingRecord;
        }, messageReportOptions(message,{preserveReports:true}));
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
                if (item && sameAnalysisUrl(item.url,url)) {
                    if (result.check?.outcome !== 'success' && item.hybrid_verdict?.status === 'MALICIOUS' && result.status !== 'MALICIOUS') continue;
                    item.hybrid_verdict = {status:result.status,observedAt,completion:result.check?.outcome === 'success'?'complete':'incomplete'};
                }
            }
            existingRecord.updatedAt = observedAt;
            return existingRecord;
        }, messageReportOptions(message,{preserveReports:true}));
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
        const reportOptions = messageReportOptions(message, {includeHistory: 'link'});
        const record = await getFromStore(db, 'hybridanalysis', message.headerMessageId, reportOptions);
        const linkObj = Array.isArray(record?.links) ? record.links.find(item => item && sameAnalysisUrl(item.url, request.url)) : null;
        const url = canonicalHttpUrl(request.url);

        const forward=sendResponse;let incompleteProvider=false;
        sendResponse=async result=>{
            let latest = record;
            try { latest = await getFromStore(db, 'hybridanalysis', message.headerMessageId, reportOptions); }
            catch (_) { incompleteProvider = true; }
            const fact=savedLinkAssessments(latest,new Set([url])).get(url) || {},rank={unknown:0,none:1,suspicious:2,malicious:3},status=({MALICIOUS:'malicious',MALICIOUS_VISUAL:'malicious',SUSPICIOUS:'suspicious',CLEAN:'none'})[result.status]||'unknown';
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
                const status = res?.status === 'CLEAN' && res.assessment?.completion !== 'complete' ? 'UNKNOWN' : res?.status;
                const hasFinding = ['MALICIOUS','MALICIOUS_VISUAL','SUSPICIOUS','CLEAN'].includes(status);
                const completed = hasFinding && res?.assessment?.completion === 'complete';
                const outcome = completed ? 'success' : status === 'NOT_CHECKED' ? 'not_requested' :
                    ['rate_limited','invalid_key'].includes(res?.errorCode) ? res.errorCode :
                    ['UNKNOWN','SUBMITTED','TIMEOUT'].includes(status) || hasFinding ? 'incomplete' : 'failed';
                if (!completed && status !== 'NOT_CHECKED') incompleteProvider = true;
                const attemptedAt = Date.now();
                urlscanAttempt = {
                    origin: hasFinding ? 'live' : 'none',
                    outcome,
                    errorCode: res?.errorCode || null,
                    errorDetails: res?.details || null,
                    httpStatus: res?.httpStatus || null,
                    retryAfter: res?.retryAfter || null,
                    attemptedAt,
                    observedAt: hasFinding ? attemptedAt : null
                };
                if (res && status !== 'NOT_CHECKED') await persistUrlscanLinkResult(message, request.url, {...res,status});
                if (hasFinding) {
                    await sendResponse({ status, reasons: res.reasons, provider: 'urlscan.io', check: urlscanAttempt });
                    return;
                }
            } catch (e) {
                urlscanAttempt = { origin: 'none', outcome: 'failed', errorCode: 'fetch_failed', attemptedAt: Date.now(), observedAt: null };
                incompleteProvider = true;
                Logger.warn('urlscan.io click check failed');
            }
        }

        if (linkObj?.urlscan && ['MALICIOUS_VISUAL','MALICIOUS','SUSPICIOUS','CLEAN'].includes(linkObj.urlscan.status) &&
            (!linkObj.hybrid_sha256 || linkObj.state === 'UNKNOWN') &&
            (linkObj.urlscan.status !== 'CLEAN' || linkObj.urlscan.assessment?.completion === 'complete')) {
            await sendResponse({
                status: linkObj.urlscan.status,
                reasons: Array.isArray(linkObj.urlscan.reasons) ? linkObj.urlscan.reasons : [],
                provider: 'urlscan.io',
                check: { origin: 'stored', outcome: linkObj.urlscan.assessment?.completion === 'complete' ? 'success' : 'incomplete', attemptedAt: request.userAction ? Date.now() : null, observedAt: Number.isFinite(linkObj.urlscan.observedAt) ? linkObj.urlscan.observedAt : null }
            });
            return;
        }

        if (linkObj?.hybrid_sha256) {
            // A previously observed live verdict or stored report outranks the submission state.
            const storedVerdict = linkObj.hybrid_verdict && ['MALICIOUS', 'SUSPICIOUS', 'CLEAN'].includes(linkObj.hybrid_verdict.status) ? linkObj.hybrid_verdict : null;
            const reportVerdict = !storedVerdict && linkObj.report && typeof extractHybridVerdictFromOverview === 'function' ? extractHybridVerdictFromOverview(linkObj.report) : null;
            const fallbackStatus = storedVerdict ? storedVerdict.status : (reportVerdict || linkObj.state);
            const fallbackObservedAt = storedVerdict && Number.isFinite(storedVerdict.observedAt) ? storedVerdict.observedAt : linkObj.observedAt;
            const result = await checkHybridAnalysisResult(linkObj.hybrid_sha256, fallbackStatus, {
                requested: request.userAction === true,
                observedAt: fallbackObservedAt,
                analysisContext,
                quickScanId: linkObj.hybrid_quick_scan_id || linkObj.hybrid_submission_id || linkObj.hybrid_job_id || null
            });
            if (result && result.check && result.check.origin === 'live' && (result.check.outcome === 'success' || ['MALICIOUS','SUSPICIOUS'].includes(result.status)) && typeof persistHybridLinkVerdict === 'function') {
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
async function handleOpenCheckedLink(request, sender, options) {
    try {
        const tabId = sender && sender.tab && sender.tab.id;
        if (tabId == null || request.messageId == null || typeof request.url !== 'string') return { success: false };
        const url = new URL(request.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return { success: false };
        if (typeof ThundyLinkSecurity !== 'undefined') return await ThundyLinkSecurity.open(request,sender,options);
        const message = await getFirstDisplayedMessage(tabId, { throwOnError: true });
        if (!message || message.id !== request.messageId) return { success: false };
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
            check.httpStatus = 429;
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
            check.httpStatus = response.status;
            check.error = 'Invalid API key';
            check.errorDetails = 'Invalid or unauthorized Hybrid Analysis API key';
            return fallback();
        }
        if (response.ok === false) {
            check.outcome = 'failed';
            check.httpStatus = response.status;
            check.errorCode = `http_${response.status}`;
            check.error = `HTTP ${response.status}`;
            check.errorDetails = `HTTP ${response.status}`;
            return fallback();
        }
        const data = await response.json();
        const verdict = extractHybridVerdictFromOverview(data);
        const roots = Array.isArray(data) ? data : [data];
        if (roots.some(row => row?.sha256 != null && String(row.sha256).toLowerCase() !== String(hybrid_sha256).toLowerCase())) {
            check.outcome = 'failed';
            check.errorCode = 'resource_mismatch';
            return fallback();
        }
        const assessment = ThundyProviderResults.evaluate('hybridanalysis',data);
        const complete = assessment.completion === 'complete' && roots.length > 0 &&
            roots.every(ThundyProviderResults.hybridCompletionConfirmed);
        if (!verdict || verdict === 'UNKNOWN' || verdict === 'CLEAN' && !complete) {
            check.outcome = assessment.completion === 'pending' ? 'incomplete' : 'no_result';
            return fallback();
        }
        return { status: verdict, check: { ...check, origin: 'live', outcome: complete ? 'success' : 'incomplete', observedAt: Date.now() } };
    } catch (error) {
        check.outcome = 'failed';
        check.errorCode = error instanceof SyntaxError ? 'invalid_response' : 'fetch_failed';
        check.errorDetails = uiText('checkOutcome_failed','Provider request failed.');
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

// Viewer snapshots never accept a caller-supplied database key or provider request.
var hybridReportBroker = typeof ThundyHybridReport === 'undefined' ? null : ThundyHybridReport.broker(browser, async request => {
    const context = await getMessageAnalysisContext(await browser.messages.get(request.messageId));
    if (!context || context.disposed || context.snapshotId !== request.contextToken) throw Error('REPORT_UNAVAILABLE');
    const snapshot = await context.snapshot();
    if (snapshot.displayPreferences?.hybridDetails === false) throw Error('REPORT_UNAVAILABLE');
    const record = await context.resourceRecord();
    const candidates = request.resourceRef.startsWith('attachment:')
        ? (record?.attachments || []).filter(item => 'attachment:'+item.partName === request.resourceRef)
        : (record?.links || []).filter(item => item.analysisResourceRef === request.resourceRef);
    if (context.disposed || !context.isCached() || candidates.length !== 1 || !candidates[0].report) throw Error('REPORT_UNAVAILABLE');
    return ThundyHybridReport.project(candidates[0], request.resourceRef, snapshot.local, snapshot.rows);
});

// The download dialog uses the same resource-bound report broker as the message view.
var attachmentDownloads = typeof ThundyAttachmentDownload === 'undefined' ? null : ThundyAttachmentDownload.create(browser,{
    security:ThundySecurity,
    hash:get_sha256_hash,
    record:async message => getFromStore(await getSharedDB(),'hybridanalysis',resolveMessageStorageKey(message),messageReportOptions(message,{includeHistory:'attachment'})),
    revision:id => typeof ThundyScans === 'undefined' ? null : ThundyScans.revision(id),
    pending:(id,part) => typeof ThundyScans !== 'undefined' && ThundyScans.attachmentPending(id,part),
    openReport:async (target,resource,sender,archived) => {
        const message = await getFirstDisplayedMessage(target.tabId);
        if (message?.id !== target.messageId) throw Error('ATTACHMENT_CONTEXT_CHANGED');
        if (archived) {
            const snapshot = ThundyHybridReport.project(archived,'attachment:'+target.partName);
            return hybridReportBroker.openBound({...snapshot,historical:true});
        }
        const context = await getMessageAnalysisContext(message);
        context.forAttachment(target.partName,resource.file.name,resource.digest);
        return hybridReportBroker.command({action:'openHybridReport',messageId:message.id,
            contextToken:context.snapshotId,resourceRef:'attachment:'+target.partName},sender);
    }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Harden the message boundary: only our own extension contexts may drive the
    // background script (P3-25 in docs/PROBLEMANALYSE_STORE_READINESS.md).
    if (sender && sender.id && sender.id !== browser.runtime.id) {
        Logger.warn('Ignoring a message from a foreign sender', sender.id);
        return false;
    }
    if (!request || typeof request !== 'object') return false;

    if(request.action==='apiDebugCapture'&&typeof ThundyApiDiagnostics!=='undefined') {
        ThundyApiDiagnostics.capture(request,sender).then(result=>sendResponse({success:true,...result})).catch(()=>sendResponse({success:false,code:'DIAGNOSTIC_REJECTED'}));
        return true;
    }

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
            else { clearAnalysisMemory(); }
            sendResponse({success:true,status:'success'});
        }).catch(()=>sendResponse({success:false,code:'ADMIN_LOCKED'}));
        return true;
    }
    if (['startAttachmentDownload','attachmentDownloadCommand'].includes(request.action) && attachmentDownloads) {
        (async () => {
            if (sender?.id !== browser.runtime.id) throw Error('ATTACHMENT_CONTEXT_CHANGED');
            if (request.action === 'attachmentDownloadCommand') return attachmentDownloads.command(request,sender);
            const tabId = ThundySecurity.page(sender,'popup.html')
                ? (await browser.tabs.query({active:true,currentWindow:true}))[0]?.id : sender.tab?.id;
            return attachmentDownloads.start({tabId,messageId:request.messageId,partName:request.partName});
        })().then(sendResponse).catch(error => sendResponse({success:false,code:error.code || 'ATTACHMENT_DOWNLOAD_FAILED'}));
        return true;
    }
    if (['openHybridReport','readHybridReport'].includes(request.action) && hybridReportBroker) {
        hybridReportBroker.command(request,sender).then(sendResponse).catch(()=>sendResponse({success:false,code:'REPORT_UNAVAILABLE'}));return true;
    }
    if(request.action==='openApiDebug'&&sender?.id===browser.runtime.id){const run=Number.isSafeInteger(request.runId)&&request.runId>0?'#run='+request.runId:'';browser.tabs.create({url:browser.runtime.getURL('api_debug.html')+run}).then(()=>sendResponse({success:true})).catch(()=>sendResponse({success:false}));return true;}
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
                return {success:!!context,reportScope:messageReportOptions({id:request.messageId}).reportScope,record:context ? await context.resourceRecord() : null};
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
        case "getLocalRisk": {
            const assessment=beginLocalAssessment(request.messageId,request.requestId);
            (async () => {
                const message = await browser.messages.get(request.messageId);
                const fullMessage = await readFullForAnalysis(message,null,assessment);
                const messageText = extractTextFromParts(fullMessage.parts || fullMessage);
                const urls = messageUrlInventory(fullMessage);
                const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls: urls, messageText, allowExternal: false });
                const threat = calculateThreatScore(message.author, urls, options);
                threat.coverage = localContentCoverage(fullMessage);threat.assessment={...assessment,observedAt:Date.now()};
                // Recording provenance must not discard an already computed score.
                void Promise.resolve().then(()=>getMessageAnalysisContext(message, null, {fullMessage})).then(context=>recordLocalCoverage(context, threat.coverage, threat)).catch(()=>{});
                return threat;
            })().then(threat => sendResponse({ status: 'success', threat })).catch(() => sendResponse({ status: 'error', assessment:{...assessment,observedAt:Date.now()} }));
            return true;
        }
        case "refreshThreatBanner": {
            if (sender?.url?.split(/[?#]/)[0] !== browser.runtime.getURL('popup.html') || !Number.isInteger(request.messageId)) { sendResponse({ success: false }); return false; }
            (async () => {
                const assessment=beginLocalAssessment(request.messageId);
                const message = await browser.messages.get(request.messageId);
                const fullMessage = await readFullForAnalysis(message,null,assessment);
                const messageText = extractTextFromParts(fullMessage.parts || fullMessage);
                const urls = messageUrlInventory(fullMessage);
                const filteredUrls = filterUrls(urls);
                const parsedUrlCache = new Map();
                const context = await getMessageAnalysisContext(message, null, { fullMessage });
                const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls, messageText, parsedUrlCache, allowExternal: false, analysisContext: context });
                const threat = calculateThreatScore(message.author, urls, options);
                threat.coverage = localContentCoverage(fullMessage);threat.assessment={...assessment,observedAt:Date.now()};
                if(context?.model.data.local?.assessment?.runtimeId===assessment.runtimeId&&context.model.data.local.assessment.revision>assessment.revision)return {success:false};
                if(context && !recordLocalCoverage(context, threat.coverage, threat))return {success:false};
                for (const tab of (context && context.tabs ? context.tabs : [])) {
                    try {
                        const active = await getFirstDisplayedMessage(tab, { throwOnError: true });
                        if (!context.disposed && active?.id === message.id) await injectThreatBanner(tab, threat);
                    } catch (_) { /* closed or changed message */ }
                }
                if (context) await context.flush().catch(() => {});
                return { success: true, score: threat.score };
            })().then(sendResponse).catch(() => sendResponse({ success: false }));
            return true;
        }
        case "clearMemoryCaches":
            clearAnalysisMemory();
            sendResponse({ status: 'success' });
            return false;
        case "uploadAttachment":
            handleManualUpload(request.messageId, request.partName, request.attachmentName, request.hash, request.headerMessageId)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status:'error',message:err.message,code:err.code,...(err.uploadSent?{uploadSent:true}:{} )}));
            return true;
        case "savePopupHybridReport":
            if (sender?.url?.split(/[?#]/)[0] !== browser.runtime.getURL('popup.html')) return false;
            savePopupHybridReport(request).then(saved=>sendResponse({success:saved})).catch(()=>sendResponse({success:false}));
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
    const reportOptions=messageReportOptions({id:analysisContext?.messageId},{preserveReports:true});
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
                        existingRecord.links[linkIndex].hybrid_quick_scan_id = typeof json_data.id==='string'?json_data.id:null;
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
            }, reportOptions);
        } catch (dbError) {
            Logger.error('Fehler beim Aktualisieren des DB Records für URL:', dbError);
        }
        return json_data;
    } else {
        throw new Error(uiText("ui_099", "Fehler beim URL-Scan: ") + String(response.status));
    }
}

async function savePopupHybridReport(request) {
    const {messageId, headerMessageId, reportScope, sha256, partName, url, report, jobId, submissionId, quickScanId}=request;
    if (!Number.isSafeInteger(messageId) || !reportScope || reportScope!==messageReportOptions({id:messageId}).reportScope ||
        !report || typeof report!=='object' || (partName ? !/^[0-9]+(?:\.[0-9]+)*$/.test(partName) : !canonicalHttpUrl(url)) ||
        !sha256 && !jobId && !submissionId && !quickScanId) return false;
    if (sha256 && (!/^[a-f0-9]{64}$/i.test(sha256) || !ThundyProviderResults.boundAttachmentReports(report,sha256.toLowerCase()).fullyBound)) return false;
    const message=await browser.messages.get(messageId);
    if (message?.id!==messageId || resolveMessageStorageKey(message)!==headerMessageId) return false;
    const assessment=ThundyProviderResults.evaluate('hybridanalysis',report);
    let saved=false;
    await updateStore(await getSharedDB(),'hybridanalysis',headerMessageId,record=>{
        const rows=partName ? record?.attachments : record?.links;
        const matches=(rows || []).filter(item=>item && (partName ? item.partName===partName : sameAnalysisUrl(item.url,url)) &&
            (!sha256 || item.hybrid_sha256?.toLowerCase()===sha256.toLowerCase()) &&
            (!jobId || item.hybrid_job_id===jobId) &&
            (!submissionId || item.hybrid_submission_id===submissionId) &&
            (!quickScanId || item.hybrid_quick_scan_id===quickScanId));
        if (matches.length!==1) return record;
        const item=matches[0];
        if (assessment.completion !== 'complete' && ThundyProviderResults.evaluate('hybridanalysis', item.report).completion === 'complete') return record;
        item.report=report;
        item.report_fetched_at=new Date().toISOString();
        if (assessment.completion==='complete' && item.state==='UPLOADED') item.state='KNOWN';
        record.updatedAt=Date.now();
        saved=true;
        return record;
    },{reportScope,preserveReports:true});
    return saved;
}

async function handleManualUpload(messageId, partName, attachmentName, hash, headerMessageId) {
    if (!apikey_hybridanalysis) throw new Error(uiText('ui_086', 'API-Key fehlt.'));
    assertExternalAnalysisAllowed();
    if (!tierAtLeast('balanced')) throw typedError(TIER_BLOCKS_UPLOAD, msg('errorTierUploadBlocked'));
    await requireHostPermission('https://hybrid-analysis.com/api/v2/quick-scan/file');

    const changed = () => typedError('MESSAGE_CONTEXT_CHANGED', msg('analysisContextChanged'));
    if (!Number.isInteger(messageId) || typeof partName !== 'string' || !partName || typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) throw changed();
    const message = await browser.messages.get(messageId);
    if (!message || message.id !== messageId) throw changed();
    const key = typeof resolveMessageStorageKey === 'function' ? resolveMessageStorageKey(message) : message.headerMessageId || 'message:' + message.id;
    if (!key || key !== headerMessageId) throw changed();
    const digest = hash.toLowerCase();
    const matching = record => (Array.isArray(record?.attachments) ? record.attachments : []).filter(item => item && typeof item === 'object' && !Array.isArray(item) && item.partName === partName && typeof item.hybrid_sha256 === 'string' && item.hybrid_sha256.toLowerCase() === digest);
    const reference = item => JSON.stringify([item.hybrid_quick_scan_id || null, item.hybrid_submission_id || null, item.hybrid_job_id || null]);
    const db = await getSharedDB();
    const candidates = matching(await getFromStore(db, 'hybridanalysis', key,messageReportOptions(message)));
    if (candidates.length !== 1) throw changed();
    const originalReference = reference(candidates[0]);
    const file = await browser.messages.getAttachmentFile(messageId, partName);
    if (file.size > 25 * 1024 * 1024) throw typedError('RESOURCE_MISMATCH', msg('scanCoverage_size_limit'));
    const bytes = await file.arrayBuffer();
    if (await get_sha256_hash(bytes) !== digest) throw changed();

    const messageContext = await getMessageAnalysisContext(message);
    const analysisContext = messageContext?.forAttachment ? messageContext.forAttachment(partName, file.name, digest) : messageContext;
    const unassigned = () => Object.assign(typedError('RESOURCE_MISMATCH', msg('uploadSentUnassigned')), {uploadSent:true});
    const validateResponse = data => {
        if (data?.sha256 != null && (typeof data.sha256 !== 'string' || data.sha256.toLowerCase() !== digest)) throw unassigned();
    };
    const formData = new FormData();
    formData.append('scan_type', 'all');
    // Send exactly the bytes whose hash was checked, with Thunderbird's actual filename.
    formData.append('file', new File([bytes], file.name || attachmentName, {type:file.type || 'application/octet-stream'}));
    const url = 'https://hybrid-analysis.com/api/v2/quick-scan/file';
    await requireHostPermission(url);
    const beforeSend = matching(await getFromStore(db, 'hybridanalysis', key,messageReportOptions(message)));
    if (messageContext?.disposed || beforeSend.length !== 1 || reference(beforeSend[0]) !== originalReference) throw changed();
    // Read policy and credentials after preflight awaits, immediately before queuing.
    assertExternalAnalysisAllowed();
    if (!tierAtLeast('balanced')) throw typedError(TIER_BLOCKS_UPLOAD, msg('errorTierUploadBlocked'));
    const options = getHybridAnalysisOptions('POST', formData);
    options.analysisContext = {...analysisContext, validateResponse};
    options.url = url;
    const response = await apiGateway.fetchWithTimeout(options.url, options, 60000);
    const data = await response.json();
    if (response.status !== 200 && response.status !== 201) throw new Error(uiText('ui_060', 'Fehler beim Upload: ') + String(response.status));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw unassigned();
    validateResponse(data);
    try {
        await updateStore(db, 'hybridanalysis', key, record => {
            const current = matching(record);
            // A later submission or another message's part must not inherit this response.
            if (messageContext?.disposed || current.length !== 1 || reference(current[0]) !== originalReference) throw unassigned();
            const target = current[0];
            target.hybrid_quick_scan_id = typeof data.id === 'string' ? data.id : null;
            target.hybrid_submission_id = data.submission_id || data.id;
            target.hybrid_job_id = data.job_id || (Array.isArray(data.reports) && data.reports[0]) || data.id;
            target.hybrid_sha256 = digest;
            target.state = 'UPLOADED';
            const quickReport = typeof quickScanReport === 'function' ? quickScanReport(data) : null;
            target.report = quickReport;
            target.report_fetched_at = quickReport ? new Date().toISOString() : null;
            return record;
        }, messageReportOptions(message,{preserveReports:true}));
    } catch (error) {
        if (error.uploadSent) throw error;
        Logger.error('Fehler beim Aktualisieren des DB Records:', error);
    }
    return {...data, sha256:digest};
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
