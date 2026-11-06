let popupAnalysisContext = null;
let popupMessageId = null;
const popupLinkResources = new Map();
function uiText(key, fallback, params = []) {
    return typeof ThundyI18n !== 'undefined' ? ThundyI18n.get(key, params) : params.reduce((text, value, i) => text.replaceAll('$' + (i + 1), String(value)), fallback);
}

const byteToHex = new Array(256);
for (let n = 0; n <= 255; n++) {
    byteToHex[n] = n.toString(16).padStart(2, '0');
}

const HTML_ESCAPE_FAST_REGEX = /[&<>"']/;

function escapeHTML(str) {
    if (!str) return '';
    const s = String(str);

    // ⚡ Bolt Optimization: Use non-global regex to fast-path clean strings
    if (!HTML_ESCAPE_FAST_REGEX.test(s)) return s;

    // ⚡ Bolt Optimization: Use manual loop and substring instead of regex dictionary callback for faster escaping
    let res = '';
    let last = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '&') { res += s.substring(last, i) + '&amp;'; last = i + 1; }
        else if (c === '<') { res += s.substring(last, i) + '&lt;'; last = i + 1; }
        else if (c === '>') { res += s.substring(last, i) + '&gt;'; last = i + 1; }
        else if (c === '"') { res += s.substring(last, i) + '&quot;'; last = i + 1; }
        else if (c === "'") { res += s.substring(last, i) + '&#39;'; last = i + 1; }
    }
    return res + s.substring(last);
}

let apikey_hybridanalysis;

// Global consent for external analysis. Declared outside the startup IIFE so it
// is always defined, kept in sync while the popup is open.
let externalAnalysisConsent = false;
// Invalidate outstanding reports when this popup loses its request context.
let hybridReportGeneration = 0;
let hybridReportCardSequence = 0;
let hybridReportDisposed = false;
const hybridReportTimers = new Set();
function cancelHybridReportWork(dispose = false) {
    hybridReportGeneration++;
    hybridReportDisposed = hybridReportDisposed || dispose;
    for (const timer of hybridReportTimers) if (typeof clearTimeout === 'function') clearTimeout(timer.id);
    hybridReportTimers.clear();
    if (typeof apiGateway !== 'undefined') apiGateway.abortAll();
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', () => cancelHybridReportWork(true), { once: true });
}

if (typeof apiGateway !== 'undefined') apiGateway.beforeRequest = async () => {
    const current = await browser.storage.local.get('externalAnalysisConsent');
    if (current.externalAnalysisConsent !== true) throw new Error(uiText('bannerConsentMissing', 'External analysis is disabled.'));
    if (!await browser.permissions.contains({ origins: ['https://hybrid-analysis.com/*'] })) throw new Error(uiText('errorHostPermissionMissing', 'Host permission missing.'));
};


(async () => {
let result = await browser.storage.local.get('apikey');
apikey_hybridanalysis = result.apikey;

// Der Benutzer hat auf unseren Button geklickt, holen Sie sich den aktiven Tab im aktuellen Fenster mit
// der Tabs API.
let tabs = await browser.tabs.query({ active: true, currentWindow: true });

// Holen Sie sich die aktuell angezeigte Nachricht im aktiven Tab, mit der
// messageDisplay API. Hinweis: Dies benötigt die messagesRead Berechtigung.
// Manifest V3 in Thunderbird: getDisplayedMessages() liefert eine MessageList.
let message = null;
if (browser.messageDisplay && typeof browser.messageDisplay.getDisplayedMessages === 'function') {
    // Manifest V3: getDisplayedMessages() returns a MessageList; the removed
    // getDisplayedMessage() has no fallback (strict_min_version 140.0).
    const messageList = await browser.messageDisplay.getDisplayedMessages(tabs[0].id);
    const messages = Array.isArray(messageList) ? messageList : (messageList && messageList.messages) || [];
    message = messages[0] || null;
}

// Ohne Zustimmung zu externer Analyse wird nichts übertragen - das muss im
// Popup sichtbar sein, bevor der Nutzer Uploads auslöst.
const settings = await browser.storage.local.get(['externalAnalysisConsent']);
externalAnalysisConsent = settings && settings.externalAnalysisConsent === true;
try {
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.apikey) {
            apikey_hybridanalysis = changes.apikey.newValue;
            cancelHybridReportWork(); hybrid_report_cache.clear();
        }
        if (area === 'local' && changes.externalAnalysisConsent) {
            externalAnalysisConsent = changes.externalAnalysisConsent.newValue === true;
            if (!externalAnalysisConsent) { cancelHybridReportWork(); hybrid_report_cache.clear(); }
        }
    });
} catch (e) { /* storage.onChanged is optional in tests */ }

if (!message) {
    let container = document.getElementById('hybrid_analysis_api_content');
    container.textContent = '';
    let emptyCard = document.createElement('div');
    emptyCard.className = 'card card-info mt-3';
    emptyCard.setAttribute('role', 'status');
    let msg = document.createElement('p');
    msg.className = 'text-info';
    msg.textContent = uiText("ui_004", "Bitte wählen Sie eine E-Mail aus, um sie zu überprüfen.");
    emptyCard.appendChild(msg);
    container.appendChild(emptyCard);
    return;
}

if (!message.headerMessageId) message.headerMessageId = 'message:' + message.id;
popupMessageId = message.id;
if (typeof ThundyAnalysis !== 'undefined') {
    popupAnalysisContext = { scopeOverride: 'report', event: event => browser.runtime.sendMessage({ action: 'recordAnalysisEvent', messageId: message.id, event }) };
    let sourceGeneration = 0;
    const sourceLabels = ThundyAnalysis.labels(key => uiText(key, key));
    const sourceTheme = typeof ThundyTheme !== 'undefined' ? (await ThundyTheme.snapshot())?.css || '' : '';
    const noSources = { messageId: message.id, local: { state: 'unrecorded' }, rows: [], availability: {} };
    ThundyAnalysis.render(noSources, sourceLabels, sourceTheme);
    const refreshSources = async () => {
        const own = ++sourceGeneration;
        try { const result = await browser.runtime.sendMessage({ action: 'getMessageAnalysis', messageId: message.id });
            const exportLink = document.getElementById('sourceExportOpen');
            if (exportLink && !hybridReportDisposed && own === sourceGeneration) {
                exportLink.hidden = !result?.success || result.messageId !== message.id || typeof result.contextToken !== 'string';
                if (!exportLink.hidden) exportLink.href = browser.runtime.getURL('source_export.html') + '?messageId=' + message.id + '&contextToken=' + encodeURIComponent(result.contextToken);
                else exportLink.removeAttribute('href');
            }
            if (!hybridReportDisposed && own === sourceGeneration && result?.success && result.messageId === message.id) ThundyAnalysis.render(result, sourceLabels, sourceTheme);
            else if (!hybridReportDisposed && own === sourceGeneration) ThundyAnalysis.render({ ...noSources, unavailable: true }, sourceLabels, sourceTheme);
        } catch (_) { if (!hybridReportDisposed && own === sourceGeneration) { document.getElementById('sourceExportOpen')?.setAttribute('hidden','');ThundyAnalysis.render({ ...noSources, unavailable: true }, sourceLabels, sourceTheme); } }
    };
    browser.runtime.onMessage?.addListener(request => { if (request?.action === 'analysisStatusChanged' && request.messageId === message.id || request?.action === 'memoryCachesCleared') refreshSources(); });
    await refreshSources();
}


// Aktualisieren Sie die HTML-Felder mit dem Betreff und dem Absender der Nachricht.
const updateGridField = (id, value, fallbackText) => {
    const el = document.getElementById(id);
    if (value && String(value).trim() !== '') {
        el.textContent = value;
        el.style.color = "";
        el.style.fontStyle = "normal";
    } else {
        el.textContent = fallbackText;
        el.style.color = "var(--text-muted)";
        el.style.fontStyle = "italic";
    }
};

updateGridField("subject", message.subject, uiText('noSubject', "(Kein Betreff)"));
updateGridField("from", message.author, uiText('noSender', "(Unbekannter Absender)"));
updateGridField("MessageHeaderID", message.headerMessageId, uiText('noId', "(Keine ID)"));

// The local assessment is independent of provider configuration and consent.
try {
    const local = await browser.runtime.sendMessage({ action: 'getLocalRisk', messageId: message.id });
    if (local && local.threat) {
        const card = document.createElement('div');
        const risk = Math.max(0, Math.min(100, Number(local.threat.score) || 0));
        card.className = 'card local-risk ' + (risk >= 50 ? 'risk-high' : risk >= 25 ? 'risk-medium' : 'risk-low');
        card.setAttribute('role', 'status');
        const heading = document.createElement('div'); heading.className = 'risk-heading';
        const title = document.createElement('h2'); title.textContent = uiText('popupLocalAssessment', 'Local risk assessment');
        const score = document.createElement('span'); score.className = 'risk-score';
        score.textContent = uiText('bannerThreatScore', 'Risk score: $1 of 100', [risk]);
        heading.append(title, score); card.appendChild(heading);
        const meter = document.createElement('progress'); meter.className = 'risk-meter'; meter.max = 100; meter.value = risk;
        meter.setAttribute('aria-label', score.textContent); card.appendChild(meter);
        const note = document.createElement('p'); note.className = 'risk-note';
        note.textContent = uiText('popupLocalExplanation', 'Local indicators only. This score is not an antivirus verdict or a guarantee of safety.');
        card.appendChild(note);
        if (['incomplete','failed'].includes(local.threat.coverage?.state)) {
            const coverage = document.createElement('p'); coverage.className = 'risk-note';
            coverage.textContent = uiText('analysisLocalIncomplete', 'Local analysis is incomplete: some message content is unavailable.');
            card.appendChild(coverage);
        }
        if (local.threat.reasons.length) {
            const list = document.createElement('ul'); list.className = 'risk-reasons';
            for (const reason of local.threat.reasons) {
                const item = document.createElement('li'); item.textContent = reason; list.appendChild(item);
            }
            card.appendChild(list);
        }
        document.querySelector('.grid-container').before(card);
    }
} catch (e) { /* local assessment can be retried by reopening the popup */ }

// Initialen Lade-Status für async Operationen setzen
let apiContainer = document.getElementById('hybrid_analysis_api_content');
if (apiContainer) {
    let cardDiv = document.createElement('div');
    cardDiv.id = 'thundy-initial-loading';
    cardDiv.className = 'card card-info mb-3';

    let loadingP = document.createElement('p');
    loadingP.setAttribute('aria-live', 'polite');
    loadingP.setAttribute('role', 'status');
        loadingP.setAttribute('aria-busy', 'true');
    loadingP.className = 'text-info';
    loadingP.textContent = uiText("ui_005", "Lade Analyseergebnisse...");

    cardDiv.appendChild(loadingP);
    apiContainer.appendChild(cardDiv);
}

// Hinweis, wenn die externe Analyse (Datenübermittlung) nicht freigegeben ist.
if (!externalAnalysisConsent && apiContainer) {
    let consentCard = document.createElement('div');
    consentCard.id = 'thundy-consent-notice';
    consentCard.className = 'card card-warn mb-3';
    consentCard.setAttribute('role', 'status');

    let consentP = document.createElement('p');
    consentP.id = 'consent-notice-msg';
    consentP.textContent = uiText("ui_006", "Externe Analyse ist nicht aktiviert: Es werden keine Hashes, Dateien oder Links an Analyse-Dienste übertragen.");
    consentCard.appendChild(consentP);

    let consentButton = document.createElement('button');
    consentButton.type = 'button';
    consentButton.className = 'btn-primary mt-2';
    consentButton.textContent = uiText("ui_003", "Einstellungen öffnen");
    consentButton.setAttribute('aria-describedby', 'consent-notice-msg');
    consentButton.addEventListener('click', () => browser.runtime.openOptionsPage());
    consentCard.appendChild(consentButton);

    apiContainer.before(consentCard);
}

try {

    const db = await openDB('thunderbird_av', 3);
    try {
            let record;
            if (typeof ThundyAnalysis !== 'undefined') {
                const result = await browser.runtime.sendMessage({action:'getMessageAnalysisRecord',messageId:message.id});
                if (!result?.success) throw new Error('Message resource inventory unavailable');
                record = result.record;
            } else record = await getFromStore(db, 'hybridanalysis', message.headerMessageId);
            if (typeof ThundyAnalysis !== 'undefined' && typeof ThundyAnalysis.resources === 'function') record = ThundyAnalysis.resources(record);
            popupLinkResources.clear();
            for (const [index,item] of (record?.links || []).entries()) popupLinkResources.set(item.url, item.analysisResourceRef || 'link:' + index);
            const liveContainer = apiContainer || document.getElementById('hybrid_analysis_api_content');
            if (liveContainer) liveContainer.textContent = '';
            if (record?.sourceDataIncomplete) {
                const warning = document.createElement('p'); warning.className = 'card card-warn'; warning.setAttribute('role','status');
                warning.textContent = uiText('analysisStoredDataIncomplete','Some stored analysis data could not be read. Other results remain available.'); liveContainer.appendChild(warning);
            }
            for (const [kind, coverage] of Object.entries(record?.scanCoverage || {})) {
                const summary = document.createElement('p'); summary.className = 'card card-info'; summary.setAttribute('role', 'status');
                summary.textContent = uiText(({ attachments: 'coverageAttachments', domains: 'coverageDomains', batchLinks: 'coverageBatch' })[kind], '') + ' · ' + uiText('coverageSummary', 'Coverage: $1 / $2 / $3 / $4 / $5', [coverage.detected, coverage.eligible, coverage.processed, coverage.failed, coverage.skipped].map(String)) + ' · ' + new Date(coverage.observedAt).toLocaleString();
                liveContainer.appendChild(summary);
            }
            if (record?.scanCoverage) { const limits = document.createElement('p'); limits.textContent = uiText('coverageLimits', ''); liveContainer.appendChild(limits); }
            const hasAttachments = record && record.attachments && record.attachments.length > 0;
            const hasLinks = record && record.links && record.links.length > 0;
            const hasThreatIntel = Boolean(record?.threatIntel && ((Array.isArray(record.threatIntel.urlhausDomains) && record.threatIntel.urlhausDomains.length > 0) || (Array.isArray(record.threatIntel.maliciousIps) && record.threatIntel.maliciousIps.length > 0)));

            if (hasThreatIntel) {
                renderThreatIntelSummary(record.threatIntel, liveContainer);
            }

            if (hasAttachments || hasLinks || hasThreatIntel) {
                // Single live container for everything we render below. The old
                // code passed an undefined identifier (`syncFragment`) and used an
                // undeclared `container`, which threw a ReferenceError and left the
                // report area empty (P0-9).

                let fetchTasks = [];

                if (hasAttachments) {
                    for (const att of record.attachments) {
                        const hash256 = att.hybrid_sha256;
                        if (att.state === 'SIZE_LIMIT') {
                            const p = document.createElement('p'); p.textContent = uiText('sizeLimit', 'Attachment exceeds the local size limit.'); liveContainer.appendChild(p);
                        } else if ((att.state === 'UNKNOWN' || att.state === 'MANUAL_CHECK_PENDING' || att.state === 'NOT_CHECKED')) {
                            renderManualUploadUI(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId, liveContainer, att.virustotal_stats);
                        } else if (hasFinalStoredReport(att)) {
                            // FA-3: a finished protocol was already persisted; show it
                            // without a new provider request (the data is local).
                            fetchTasks.push(buildStoredAttachmentReportTask(att, message));
                        } else if (externalAnalysisConsent && apikey_hybridanalysis) {
                            fetchTasks.push((frag) =>
                                get_hybrid_report_by_sha256({
                                    hybrid_sha: hash256,
                                    attachmentName: att.attachment_name,
                                    messageId: message.id,
                                    partName: att.partName,
                                    headerMessageId: message.headerMessageId,
                                    virustotal_stats: att.virustotal_stats,
                                    jobId: att.hybrid_job_id,
                                    submissionId: att.hybrid_submission_id
                                }, frag)
                            );
                        } else {
                            renderStoredResultWithoutConsent(att.attachment_name, hash256, liveContainer, att.virustotal_stats);
                        }
                    }
                }

                if (hasLinks) {
                    if (externalAnalysisConsent && apikey_hybridanalysis) {
                        processRecordLinks(record.links, message.headerMessageId, liveContainer, fetchTasks);
                    } else {
                        for (const linkObj of record.links) {
                            if (hasFinalStoredReport(linkObj)) {
                                fetchTasks.push(buildStoredLinkReportTask(linkObj, message.headerMessageId));
                            } else {
                                renderStoredResultWithoutConsent(linkObj.url, linkObj.hybrid_sha256, liveContainer, null, linkObj.urlscan, linkObj.hybrid_verdict);
                            }
                        }
                    }
                }

                if (fetchTasks.length > 0) {
                    await Promise.all(fetchTasks.map(async task => {
                        let taskFragment = document.createDocumentFragment();
                        try { await task(taskFragment); }
                        catch (_) {
                            // One unreadable stored protocol must not erase all
                            // other results or turn into an apparent API outage.
                            taskFragment.textContent = '';
                            const notice = document.createElement('p');
                            notice.className = 'card card-warn'; notice.setAttribute('role','alert');
                            notice.textContent = uiText('reportDisplayFailed', 'A stored report could not be displayed. Other results remain available.');
                            taskFragment.appendChild(notice);
                        }
                        if (taskFragment.hasChildNodes() && liveContainer) {
                            liveContainer.appendChild(taskFragment);
                        }
                    }));
                }
            } else {
                let container = document.getElementById('hybrid_analysis_api_content');
                if (container && !record?.scanCoverage && !record?.sourceDataIncomplete) container.textContent = '';
                let emptyCard = document.createElement('div');
                emptyCard.className = 'card card-info mb-3';
                emptyCard.setAttribute('role', 'status');
                let p1 = document.createElement('p');
                p1.className = 'text-info';
                p1.textContent = uiText("ui_007", "No stored attachment or link scan results are available for this message.");
                emptyCard.appendChild(p1);
                container.appendChild(emptyCard);
            }
    } finally { db.close(); }
} catch (error) {
    // Do not log raw provider data, URLs, keys or potentially sensitive errors.
    console.error('Thundy popup analysis load failed', error instanceof TypeError ? 'invalid-data' : 'unavailable');
    let container = document.getElementById('hybrid_analysis_api_content');
    if (container) {
        container.textContent = '';
        let errDiv = document.createElement('div');
        errDiv.className = 'alert-error';
        errDiv.setAttribute('role', 'alert');

        let errMsg = document.createElement('span');
        errMsg.id = 'unexpected-error-msg';
        errMsg.textContent = uiText("ui_009", "Unerwarteter Fehler beim Laden der Analyseergebnisse.");
        errDiv.appendChild(errMsg);

        let btnSettings = document.createElement('button');
        btnSettings.className = 'btn-primary mt-2 ml-2';
        btnSettings.textContent = uiText("ui_003", "Einstellungen öffnen");
        btnSettings.setAttribute('aria-describedby', 'unexpected-error-msg');
        btnSettings.addEventListener('click', () => {
            browser.runtime.openOptionsPage();
        });
        errDiv.appendChild(document.createElement('br'));
        errDiv.appendChild(btnSettings);

        container.appendChild(errDiv);
    }
}
})();

function createEl(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

function renderInProgressStatus(json_data, hybrid_sha, card, attempt = null) {
    const pStatus = document.createElement('p');
    pStatus.className = "text-warning";
    const statusStrong = document.createElement('strong');
    statusStrong.textContent = uiText("ui_010", "Status:");
    pStatus.appendChild(statusStrong);
    pStatus.appendChild(document.createTextNode(uiText("ui_011", " Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut.")));
    card.appendChild(pStatus);

    // FA-1: the popup now polls automatically, so say so instead of leaving the
    // user with a dead "try again later" message.
    if (attempt) {
        const pPoll = document.createElement('p');
        pPoll.className = "text-info";
        pPoll.setAttribute('role', 'status');
        pPoll.textContent = uiText("ui_173", " Die Analyse läuft noch (IN_PROGRESS). Das Ergebnis wird automatisch alle $1 Sekunden erneut abgefragt (Versuch $2); das fertige Analyse-Protokoll erscheint hier, sobald es gespeichert ist, ohne erneute Abfrage.", [HYBRID_REPORT_POLL_DELAY_MS / 1000, attempt, HYBRID_REPORT_POLL_MAX_ATTEMPTS]);
        card.appendChild(pPoll);
    }

    const pHash = document.createElement('p');
    pHash.textContent = uiText("ui_012", "SHA-256: $1", [json_data.sha256 || hybrid_sha]);
    card.appendChild(pHash);
}

function reportTags(tags) {
    if (typeof tags === 'string') return tags || 'N/A';
    return Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string').join(', ') || 'N/A' : 'N/A';
}

function extractHybridScanners(scannersInput, scannersV2Input = null) {
    const validObj = item => Boolean(item && typeof item === 'object' && !Array.isArray(item));
    const list = [];
    const seen = new Set();
    const rawScanners = Array.isArray(scannersInput)
        ? scannersInput
        : (validObj(scannersInput) && Array.isArray(scannersInput.scanners) ? scannersInput.scanners : []);
    const rawV2 = validObj(scannersV2Input)
        ? scannersV2Input
        : (validObj(scannersInput) && validObj(scannersInput.scanners_v2) ? scannersInput.scanners_v2 : null);

    for (const scanner of rawScanners) {
        if (!validObj(scanner)) continue;
        const nameKey = typeof scanner.name === 'string' && scanner.name.trim() ? scanner.name.trim().toLowerCase() : null;
        if (nameKey) seen.add(nameKey);
        list.push(scanner);
    }
    if (rawV2) {
        for (const [key, scanner] of Object.entries(rawV2)) {
            if (!validObj(scanner)) continue;
            const resolvedName = typeof scanner.name === 'string' && scanner.name.trim() ? scanner.name : key;
            const nameKey = String(resolvedName).trim().toLowerCase();
            if (nameKey && seen.has(nameKey)) continue;
            if (nameKey) seen.add(nameKey);
            list.push(scanner.name ? scanner : { ...scanner, name: resolvedName });
        }
    }
    return list;
}

function isHybridReportInProgress(json_data) {
    if (!json_data || typeof json_data !== 'object' || Array.isArray(json_data)) return false;
    const rawState = typeof json_data.state === 'string' ? json_data.state.toUpperCase() : '';
    if (rawState === 'IN_PROGRESS' || rawState === 'IN_QUEUE' || json_data.finished === false) return true;
    const scanners = extractHybridScanners(json_data);
    return scanners.some(s => typeof s.status === 'string' && ['in-progress', 'in_queue', 'in-queue', 'pending', 'running', 'queued'].includes(s.status.toLowerCase()));
}

function deriveHybridVerdict(json_data) {
    if (!json_data || typeof json_data !== 'object' || Array.isArray(json_data)) return '';
    const rawVerdict = typeof json_data.verdict === 'string' ? json_data.verdict.trim() : '';
    const lower = rawVerdict.toLowerCase();
    if (rawVerdict && lower !== 'unknown' && lower !== 'no-classification') return rawVerdict;

    const scanners = extractHybridScanners(json_data);
    const hasMaliciousScanner = scanners.some(s => (typeof s.status === 'string' && s.status.toLowerCase() === 'malicious') || (Number.isFinite(s.positives) && s.positives > 0) || (Array.isArray(s.anti_virus_results) && s.anti_virus_results.some(av => typeof av?.verdict === 'string' && av.verdict.toLowerCase() === 'malicious')));
    const hasSuspiciousScanner = scanners.some(s => typeof s.status === 'string' && s.status.toLowerCase() === 'suspicious');
    const hasCleanScanner = scanners.some(s => typeof s.status === 'string' && ['clean', 'whitelisted'].includes(s.status.toLowerCase()) && (!Number.isFinite(s.positives) || s.positives === 0));
    const threatScore = typeof json_data.threat_score === 'number' && Number.isFinite(json_data.threat_score) ? json_data.threat_score : null;
    const multiscan = typeof json_data.multiscan_result === 'number' && Number.isFinite(json_data.multiscan_result) ? json_data.multiscan_result : null;

    if (hasMaliciousScanner || (threatScore !== null && threatScore >= 70) || (multiscan !== null && multiscan >= 50) || json_data.threat_level === 2) return 'malicious';
    if (hasSuspiciousScanner || (threatScore !== null && threatScore >= 30) || (multiscan !== null && multiscan > 0) || json_data.threat_level === 1) return 'suspicious';
    if (json_data.whitelisted === true) return 'whitelisted';
    if (hasCleanScanner || (json_data.threat_level === 0 && !isHybridReportInProgress(json_data))) return 'clean';
    return rawVerdict;
}

/**
 * Maps a Hybrid Analysis report to a card severity class so malicious,
 * suspicious and clean results are distinguishable at a glance.
 */
function hybridVerdictCardClass(json_data) {
    if (isHybridReportInProgress(json_data)) return '';
    const verdict = String(deriveHybridVerdict(json_data) || '').toLowerCase();
    if (verdict === 'malicious') return 'card-danger';
    if (verdict === 'suspicious') return 'card-warning';
    if (['no specific threat', 'no threat', 'clean', 'whitelisted'].includes(verdict)) return 'card-success';
    return '';
}

/**
 * Renders a link to the full public Hybrid Analysis report. The link opens in
 * the user's default browser; nothing is transmitted by rendering it.
 */
function renderHybridReportLink(sha256, card) {
    if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(sha256)) return;
    const url = 'https://www.hybrid-analysis.com/sample/' + sha256.toLowerCase();
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'hybrid-report-link';
    a.textContent = uiText('hybridReportLink', 'Open full report on Hybrid Analysis');
    a.addEventListener('click', event => {
        if (typeof browser !== 'undefined' && browser.windows && typeof browser.windows.openDefaultBrowser === 'function') {
            event.preventDefault();
            Promise.resolve(browser.windows.openDefaultBrowser(url)).catch(() => {});
        }
    });
    p.appendChild(a);
    card.appendChild(p);
}


function renderThreatInfo(json_data, card) {
    const score = typeof json_data.threat_score === 'number' && Number.isFinite(json_data.threat_score) && json_data.threat_score >= 0 && json_data.threat_score <= 100 ? json_data.threat_score : null;
    let threatClass = score === null ? 'text-muted' : "text-success";
    let semanticLabel = score === null ? '' : uiText('statusNormal', " (Normal)");
    if (score > 50) {
        threatClass = "text-warning";
        semanticLabel = uiText('statusSuspicious', " (Suspicious)");
    }
    if (score > 80) {
        threatClass = "text-danger";
        semanticLabel = uiText('statusCritical', " (Critical)");
    }

    const pThreat = document.createElement('p');
    const threatStrong = document.createElement('strong');
    threatStrong.className = `head_line ${threatClass}`;
    threatStrong.textContent = uiText("ui_013", "Bedrohungsscore:");
    pThreat.appendChild(threatStrong);
    pThreat.appendChild(document.createTextNode(" "));
    const threatSpan = document.createElement('span');
    threatSpan.className = threatClass;
    threatSpan.textContent = score === null ? uiText('providerUnknown','Unknown') : score + semanticLabel;
    pThreat.appendChild(threatSpan);
    card.appendChild(pThreat);

    const pVerdict = document.createElement('p');
    const verdictStrong = document.createElement('strong');
    verdictStrong.className = `head_line ${threatClass}`;
    verdictStrong.textContent = uiText("ui_014", "Urteil:");
    pVerdict.appendChild(verdictStrong);
    pVerdict.appendChild(document.createTextNode(" "));
    const verdictSpan = document.createElement('span');
    const resolvedVerdict = deriveHybridVerdict(json_data);
    const verdictLower = String(resolvedVerdict).toLowerCase();
    // Quick-scan payloads often carry no threat_score; colour the verdict itself then.
    verdictSpan.className = score !== null ? threatClass
        : verdictLower === 'malicious' ? 'text-danger'
        : verdictLower === 'suspicious' ? 'text-warning'
        : ['no specific threat', 'no threat', 'clean', 'whitelisted'].includes(verdictLower) ? 'text-success'
        : threatClass;
    const verdictKeys = { 'no specific threat': 'providerNoDetection', 'no threat': 'providerNoDetection', 'clean': 'providerNoDetection', 'whitelisted': 'providerNoDetection', 'malicious': 'providerMalicious', 'suspicious': 'providerSuspicious', 'in progress': 'providerPending' };
    const verdictKey = verdictKeys[verdictLower];
    verdictSpan.textContent = verdictKey && typeof ThundyI18n !== 'undefined' ? ThundyI18n.get(verdictKey) : typeof resolvedVerdict === 'string' && resolvedVerdict ? resolvedVerdict : uiText('providerUnknown','Unknown');
    pVerdict.appendChild(verdictSpan);
    card.appendChild(pVerdict);

    const vxFamily = typeof json_data.vx_family === 'string' && json_data.vx_family.trim() ? json_data.vx_family.trim() : '';
    const pVxFamily = document.createElement('p');
    if (vxFamily) pVxFamily.className = 'text-danger';
    const vxStrong = document.createElement('strong');
    vxStrong.textContent = uiText("ui_015", "Vx-Familie:");
    pVxFamily.appendChild(vxStrong);
    pVxFamily.appendChild(document.createTextNode(` ${vxFamily || 'N/A'}`));
    card.appendChild(pVxFamily);

    const pMulti = document.createElement('p');
    const multiVal = (json_data.multiscan_result !== null && json_data.multiscan_result !== undefined && json_data.multiscan_result !== '') ? json_data.multiscan_result : 'N/A';
    pMulti.textContent = uiText("ui_016", "Multiscan-Ergebnis: $1", [multiVal]);
    card.appendChild(pMulti);

    const pAddInfo = document.createElement('p');
    const addInfoStrong = document.createElement('strong');
    addInfoStrong.textContent = uiText("ui_017", "Additional Information:");
    pAddInfo.appendChild(addInfoStrong);
    card.appendChild(pAddInfo);

    const pAnalysisTime = document.createElement('p');
    pAnalysisTime.textContent = uiText("ui_018", "Analysis start time: $1", [(typeof ThundyI18n !== 'undefined' && json_data.analysis_start_time ? ThundyI18n.date(json_data.analysis_start_time) : json_data.analysis_start_time) || 'N/A']);
    card.appendChild(pAnalysisTime);

    const pTags = document.createElement('p');
    pTags.textContent = uiText("ui_019", "Tags: $1", [reportTags(json_data.tags)]);
    card.appendChild(pTags);
}

function renderVirusTotalStats(virustotal_stats, card) {
    const pVtHead = document.createElement('p');
    pVtHead.className = "ml-2";
    const vtHeadStrong = document.createElement('strong');
    vtHeadStrong.textContent = uiText("ui_020", "VirusTotal Ergebnisse:");
    pVtHead.appendChild(vtHeadStrong);
    card.appendChild(pVtHead);

    const pVtMal = document.createElement('p');
    const malCount = virustotal_stats.malicious || 0;
    pVtMal.className = `ml-4 ${malCount > 0 ? "text-danger" : ""}`;
    pVtMal.textContent = uiText("ui_021", "Malicious: $1$2", [malCount, malCount > 0 ? uiText('statusDangerous', " (Gef\u00e4hrlich)") : ""]);
    card.appendChild(pVtMal);

    const pVtUnd = document.createElement('p');
    pVtUnd.className = "ml-4";
    pVtUnd.textContent = uiText("ui_022", "Undetected: $1", [virustotal_stats.undetected || 0]);
    card.appendChild(pVtUnd);

    const pVtSus = document.createElement('p');
    const susCount = virustotal_stats.suspicious || 0;
    pVtSus.className = `ml-4 ${susCount > 0 ? "text-warning" : ""}`;
    pVtSus.textContent = uiText("ui_023", "Suspicious: $1$2", [susCount, susCount > 0 ? uiText('statusSuspicious', " (Verd\u00e4chtig)") : ""]);
    card.appendChild(pVtSus);

    const pVtHarm = document.createElement('p');
    pVtHarm.className = "ml-4";
    pVtHarm.textContent = uiText("ui_024", "Harmless: $1", [virustotal_stats.harmless || 0]);
    card.appendChild(pVtHarm);
}

function renderUrlscanResult(urlscan, card) {
    if (!urlscan || typeof urlscan !== 'object' || Array.isArray(urlscan) || typeof urlscan.status !== 'string') return;
    const status = urlscan.status.trim().toUpperCase();
    if (!status) return;

    const pHead = document.createElement('p');
    pHead.className = "ml-2";
    const headStrong = document.createElement('strong');
    headStrong.textContent = uiText("urlscanHeading", "urlscan.io Ergebnisse:");
    pHead.appendChild(headStrong);
    card.appendChild(pHead);

    const isMalicious = status === 'MALICIOUS' || status === 'MALICIOUS_VISUAL';
    const isSuspicious = status === 'SUSPICIOUS';
    const isClean = status === 'CLEAN';
    const statusClass = isMalicious ? "text-danger" : isSuspicious ? "text-warning" : isClean ? "text-success" : "";

    const pStatus = document.createElement('p');
    pStatus.className = `ml-4 ${statusClass}`.trim();
    pStatus.textContent = uiText("urlscanStatus", "Status: $1", [status]);
    card.appendChild(pStatus);

    if (Array.isArray(urlscan.reasons)) {
        for (const reason of urlscan.reasons) {
            if (typeof reason !== 'string' || !reason.trim()) continue;
            const pReason = document.createElement('p');
            pReason.className = `ml-4 ${statusClass}`.trim();
            pReason.textContent = reason;
            card.appendChild(pReason);
        }
    }

    if (typeof urlscan.reportUrl === 'string' && /^https:\/\/urlscan\.io\/result\/[A-Za-z0-9_-]+\/?$/i.test(urlscan.reportUrl.trim())) {
        const cleanUrl = urlscan.reportUrl.trim();
        const pLink = document.createElement('p');
        pLink.className = 'ml-4';
        const a = document.createElement('a');
        a.href = cleanUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'urlscan-report-link';
        a.textContent = uiText('urlscanReportLink', 'Open full report on urlscan.io');
        a.addEventListener('click', event => {
            if (typeof browser !== 'undefined' && browser.windows && typeof browser.windows.openDefaultBrowser === 'function') {
                event.preventDefault();
                Promise.resolve(browser.windows.openDefaultBrowser(cleanUrl)).catch(() => {});
            }
        });
        pLink.appendChild(a);
        card.appendChild(pLink);
    }
}

function renderHybridLinkVerdict(hybridVerdict, card) {
    if (!hybridVerdict || typeof hybridVerdict !== 'object' || Array.isArray(hybridVerdict) || typeof hybridVerdict.status !== 'string') return;
    const status = hybridVerdict.status.trim().toUpperCase();
    if (!status) return;
    const statusClass = status === 'MALICIOUS' ? 'text-danger' : status === 'SUSPICIOUS' ? 'text-warning' : status === 'CLEAN' ? 'text-success' : '';
    const pVerdict = document.createElement('p');
    pVerdict.className = `ml-2 hybrid-link-verdict ${statusClass}`.trim();
    pVerdict.textContent = uiText('hybridLinkVerdictStatus', 'Hybrid Analysis: $1', [status]);
    card.appendChild(pVerdict);
}

function renderThreatIntelSummary(threatIntel, targetContainer) {
    if (!threatIntel || typeof threatIntel !== 'object' || Array.isArray(threatIntel)) return null;
    const domains = Array.isArray(threatIntel.urlhausDomains) ? threatIntel.urlhausDomains.filter(d => typeof d === 'string' && d.trim()) : [];
    const ips = Array.isArray(threatIntel.maliciousIps) ? threatIntel.maliciousIps.filter(ip => typeof ip === 'string' && ip.trim()) : [];
    if (domains.length === 0 && ips.length === 0) return null;

    const container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    if (!container) return null;

    const card = document.createElement('div');
    card.className = 'card mb-3';
    card.setAttribute('role', 'status');

    const h2 = document.createElement('h2');
    h2.textContent = uiText('threatIntelTitle', 'Externe Bedrohungsindikatoren (URLhaus & IP-Reputation)');
    card.appendChild(h2);

    if (domains.length > 0) {
        const pDomains = document.createElement('p');
        pDomains.className = 'text-danger';
        pDomains.textContent = uiText('threatIntelUrlhaus', 'URLhaus – Bekannte Malware-Domains erkannt: $1', [domains.join(', ')]);
        card.appendChild(pDomains);
    }

    if (ips.length > 0) {
        const providerRaw = typeof threatIntel.ipReputationProvider === 'string' ? threatIntel.ipReputationProvider.toLowerCase() : '';
        const providerLabel = providerRaw === 'abuseipdb' ? 'AbuseIPDB' : providerRaw === 'virustotal' ? 'VirusTotal' : 'IP-Check';
        const pIps = document.createElement('p');
        pIps.className = 'text-danger';
        pIps.textContent = uiText('threatIntelIpReputation', 'IP-Reputation ($1) – Verdächtige Server-IPs: $2', [providerLabel, ips.join(', ')]);
        card.appendChild(pIps);
    }

    container.appendChild(card);
    return card;
}

function renderScannerResults(scanners, card, scanners_v2 = null) {
    const rows = extractHybridScanners(scanners, scanners_v2);
    if (rows.length > 0) {
        // Optimization: Use DocumentFragment to batch DOM insertions and avoid multiple reflows
        const fragment = document.createDocumentFragment();
        for (const scanner of rows) {
            const field = value => typeof value === 'string' && value.trim() ? value : uiText('providerUnknown','Unknown');
            const pScanner = document.createElement('p');
            pScanner.className = "ml-2";
            pScanner.textContent = uiText("ui_025", "Scanner: $1", [field(scanner.name)]);
            fragment.appendChild(pScanner);

            const pStatus = document.createElement('p');
            pStatus.className = "ml-4";
            let statusText = field(scanner.status);
            if (Number.isFinite(scanner.positives) && Number.isFinite(scanner.total) && scanner.total > 0) {
                statusText += ` (${scanner.positives}/${scanner.total}${Number.isFinite(scanner.percent) ? `, ${scanner.percent}%` : ''})`;
            }
            if (typeof scanner.error_message === 'string' && scanner.error_message.trim()) {
                statusText += ` - ${scanner.error_message.trim()}`;
            }
            pStatus.textContent = uiText("ui_026", "Status: $1", [statusText]);
            fragment.appendChild(pStatus);

            const avResults = scanner.anti_virus_results;
            if (Array.isArray(avResults)) {
                const pAvRes = document.createElement('p');
                pAvRes.className = "ml-4";
                pAvRes.textContent = uiText("ui_027", "AV-Ergebnisse:");
                fragment.appendChild(pAvRes);

                for (const avResult of avResults) {
                    if (!avResult || typeof avResult !== 'object' || Array.isArray(avResult)) continue;
                    const { product, verdict } = avResult;
                    const pAv = document.createElement('p');
                    pAv.className = "ml-6";
                    pAv.textContent = uiText("ui_028", "AV: $1 - Urteil: $2", [field(product), field(verdict)]);
                    fragment.appendChild(pAv);
                }
            }
        }
        card.appendChild(fragment);
    } else {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'card card-info mt-2';
        emptyCard.setAttribute('role', 'status');
        const pNoScanners = document.createElement('p');
        pNoScanners.className = 'text-info';
        pNoScanners.textContent = uiText("ui_029", "Keine Scanner-Ergebnisse verfügbar.");
        emptyCard.appendChild(pNoScanners);
        card.appendChild(emptyCard);
    }
}

function renderFileDetails(json_data, card, boundHash = null, knownName = null) {
    const pHash256 = document.createElement('p');
    pHash256.textContent = uiText("ui_030", "SHA-256-Hashwert: $1", [json_data.sha256 || boundHash || uiText('providerUnknown','Unknown')]);
    card.appendChild(pHash256);

    const text = value => typeof value === 'string' && value.trim() ? value.trim() : '';
    const fileName = text(json_data.last_file_name) || text(json_data.submit_name) ||
        (Array.isArray(json_data.submissions) ? json_data.submissions.map(s => text(s && s.filename)).find(Boolean) : '') ||
        text(knownName);
    const pFileName = document.createElement('p');
    pFileName.textContent = uiText("ui_031", "Letzter Dateiname: $1", [fileName || 'N/A']);
    card.appendChild(pFileName);

    const pSize = document.createElement('p');
    pSize.textContent = uiText("ui_032", "Größe: $1 Bytes", [(typeof ThundyI18n !== 'undefined' ? ThundyI18n.number(json_data.size) : json_data.size) ?? 'N/A']);
    card.appendChild(pSize);

    const typeShort = Array.isArray(json_data.type_short) ? json_data.type_short.filter(t => typeof t === 'string' && t.trim()).join(', ') : text(json_data.type_short);
    const pType = document.createElement('p');
    pType.textContent = uiText("ui_033", "Typ: $1", [text(json_data.type) || typeShort || 'N/A']);
    card.appendChild(pType);
}

function renderActionButtons(hybrid_sha, attachmentName, card, allowCdr = true) {
    const btnRescan = document.createElement('button');
    btnRescan.id = `btn-rescan-${hybrid_sha}`;
    btnRescan.className = "btn-success mt-2";
    btnRescan.textContent = uiText("ui_034", "Erneut scannen (Rescan)");
    btnRescan.setAttribute('aria-describedby', `rescan-status-${hybrid_sha}`);
    card.appendChild(btnRescan);

    const pRescanStatus = document.createElement('p');
    pRescanStatus.id = `rescan-status-${hybrid_sha}`;
    pRescanStatus.className = "mt-2";
    pRescanStatus.setAttribute('aria-live', 'polite');
    pRescanStatus.setAttribute('role', 'status');
    card.appendChild(pRescanStatus);

    if (allowCdr && attachmentName && /\.html?$/i.test(attachmentName)) {
        const btnCdr = document.createElement('button');
        btnCdr.id = `btn-cdr-${hybrid_sha}`;
        btnCdr.className = "btn-primary mt-2 ml-2";
        btnCdr.textContent = uiText("ui_035", "Bereinigen & Herunterladen (Lokales CDR)");
        btnCdr.setAttribute('aria-describedby', `cdr-status-${hybrid_sha}`);
        card.appendChild(btnCdr);

        const pCdrStatus = document.createElement('p');
        pCdrStatus.id = `cdr-status-${hybrid_sha}`;
        pCdrStatus.className = "mt-2";
        pCdrStatus.setAttribute('aria-live', 'polite');
        pCdrStatus.setAttribute('role', 'status');
        card.appendChild(pCdrStatus);
    }
}

/**
 * Renders the analysis-protocol metadata block (FA-2): job/submission IDs from
 * the stored submission plus retrieval time. This is what makes a Hybrid
 * Analysis result traceable instead of an anonymous threat score.
 */
function renderProtocolMeta({ hybrid_sha, jobId = null, submissionId = null, fetched_at = null }, card) {
    const parts = [];
    if (jobId) parts.push(uiText("ui_170", "Job-ID: $1", [jobId]));
    if (submissionId) parts.push(uiText("ui_171", "Submission-ID: $1", [submissionId]));
    parts.push(uiText("ui_012", "SHA-256: $1", [hybrid_sha]));
    if (fetched_at) parts.push(uiText("ui_172", "Protokoll abgerufen: $1", [fetched_at]));

    const pMeta = document.createElement('p');
    pMeta.className = "text-muted";
    const metaStrong = document.createElement('strong');
    metaStrong.textContent = uiText("ui_169", "Analyse-Protokoll:");
    pMeta.appendChild(metaStrong);
    pMeta.appendChild(document.createTextNode(` ${parts.join(' · ')}`));
    card.appendChild(pMeta);
}

function renderReport({ json_data, attachmentName, hybrid_sha, virustotal_stats = null, urlscan = null, jobId = null, submissionId = null, fetched_at = null, attempt = null, controlId = hybrid_sha, allowCdr = true }) {
    if (!json_data || typeof json_data !== 'object' || Array.isArray(json_data)) throw new TypeError('Invalid report');
    const card = document.createElement('div');
    const verdictClass = hybridVerdictCardClass(json_data);
    card.className = verdictClass ? `card ${verdictClass} mb-3` : "card mb-3";

    const h2 = document.createElement('h2');
    h2.textContent = uiText("ui_036", "Geprüftes Element: $1", [attachmentName || uiText('unknownAttachment', "Unbekannt")]);
    card.appendChild(h2);

    const resolvedJobId = json_data.job_id || (Array.isArray(json_data.reports) && typeof json_data.reports[0] === 'string' ? json_data.reports[0] : null) || json_data.id || jobId;
    const resolvedSubmissionId = json_data.submission_id || json_data.id || submissionId;
    renderProtocolMeta({ hybrid_sha, jobId: resolvedJobId, submissionId: resolvedSubmissionId, fetched_at }, card);

    if (isHybridReportInProgress(json_data)) {
        renderInProgressStatus(json_data, hybrid_sha, card, attempt);
    } else {
        renderThreatInfo(json_data, card);
    }

    if (virustotal_stats && typeof virustotal_stats === 'object' && !Array.isArray(virustotal_stats)) {
        renderVirusTotalStats(virustotal_stats, card);
    }
    if (urlscan && typeof urlscan === 'object' && !Array.isArray(urlscan)) {
        renderUrlscanResult(urlscan, card);
    }

    renderScannerResults(json_data.scanners, card, json_data.scanners_v2);
    const invalidTags = json_data.tags != null && !(typeof json_data.tags === 'string' || Array.isArray(json_data.tags) && json_data.tags.every(tag => typeof tag === 'string'));
    const validRow = row => row && typeof row === 'object' && !Array.isArray(row);
    const invalidScanners = json_data.scanners != null && (!Array.isArray(json_data.scanners) || json_data.scanners.some(row => !validRow(row) || row.anti_virus_results != null && (!Array.isArray(row.anti_virus_results) || row.anti_virus_results.some(item => !validRow(item)))));
    if (invalidTags || invalidScanners) {
        const notice = document.createElement('p'); notice.setAttribute('role','status'); notice.className = 'text-warning';
        notice.textContent = uiText('reportFieldsUnavailable','Some report details have an unsupported format and could not be displayed.');
        card.appendChild(notice);
    }
    const knownName = typeof attachmentName === 'string' && !/^https?:\/\//i.test(attachmentName) ? attachmentName : null;
    renderFileDetails(json_data, card, hybrid_sha, knownName);
    renderHybridReportLink(json_data.sha256 || hybrid_sha, card);
    renderActionButtons(controlId, attachmentName, card, allowCdr);
    return card;
}

const hybrid_report_cache = typeof ExpiringMap !== 'undefined' ? new ExpiringMap() : new Map();
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) browser.runtime.onMessage.addListener(request => {
    if (request && request.action === 'memoryCachesCleared') hybrid_report_cache.clear();
});

/**
 * Renders a locally stored result without contacting any provider. This is what
 * the popup shows when the global consent is off: the data was already on the
 * machine, so displaying it is fine, only the network lookup is skipped (P0-7).
 */
function renderStoredResultWithoutConsent(name, hash, targetContainer, virustotal_stats = null, urlscan = null, hybridVerdict = null) {
    const container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    if (!container) return null;

    const card = document.createElement('div');
    card.className = 'card card-info mb-3';
    card.setAttribute('role', 'status');

    const h2 = document.createElement('h2');
    h2.textContent = uiText("ui_037", "Lokales Ergebnis: $1", [name || uiText('unknownAttachment', "Unbekannt")]);
    card.appendChild(h2);

    const p = document.createElement('p');
    p.className = 'text-info';
    p.textContent = hash
        ? uiText("ui_038", "SHA-256: $1 – keine externe Abfrage, da \"Externe Analyse erlauben\" ausgeschaltet ist.", [hash])
        : uiText("ui_039", "Keine externe Abfrage, da \"Externe Analyse erlauben\" ausgeschaltet ist.");
    card.appendChild(p);

    if (virustotal_stats && typeof virustotal_stats === 'object' && !Array.isArray(virustotal_stats)) {
        renderVirusTotalStats(virustotal_stats, card);
    }
    if (hybridVerdict && typeof hybridVerdict === 'object' && !Array.isArray(hybridVerdict)) {
        renderHybridLinkVerdict(hybridVerdict, card);
    }
    if (urlscan && typeof urlscan === 'object' && !Array.isArray(urlscan)) {
        renderUrlscanResult(urlscan, card);
    }

    container.appendChild(card);
    return card;
}

/**
 * Defense in depth for the consent rule: this is the single place in the popup
 * that talks to a provider, so it refuses to send anything without the global
 * consent (P0-7). `externalAnalysisConsent` is filled from browser.storage.local
 * at startup and refreshed through storage.onChanged.
 */
function hasExternalAnalysisConsent() {
    return externalAnalysisConsent === true;
}

const HYBRID_QUICK_SCAN_ID = /^[A-Za-z0-9_-]{1,128}$/;

async function fetch_hybrid_report(hybrid_sha, resource = null, quickScanId = null) {
    const reportContext = popupAnalysisContext ? {scopeOverride:'report', event:event => { if (event.phase === 'finish' && event.state !== 'failed' && Number.isFinite(event.observedAt)) ThundyAnalysis.cacheTime('hybridanalysis','report',hybrid_sha,event.observedAt); return popupAnalysisContext.event({...event,resource}); }} : null;
    if (!hasExternalAnalysisConsent()) {
        throw new Error('external-analysis-disabled');
    }
    if (typeof apiGateway !== 'undefined') {
        const current = await browser.storage.local.get('externalAnalysisConsent');
        if (current.externalAnalysisConsent !== true || !await browser.permissions.contains({ origins: ['https://hybrid-analysis.com/*'] })) throw new Error(uiText('errorHostPermissionMissing', 'Host permission missing'));
    }
    if (hybrid_report_cache.has(hybrid_sha)) {
        const cached = await hybrid_report_cache.get(hybrid_sha);
        if (popupAnalysisContext && typeof ThundyAnalysis !== 'undefined') {
            const classified = ThundyAnalysis.response({ provider: 'hybridanalysis', scope: 'report' }, cached.response.status, cached.json_data);
            reportContext.event({ phase: 'cache', provider: 'hybridanalysis', scope: 'report', ...classified, observedAt: ThundyAnalysis.cacheTime('hybridanalysis', 'report', hybrid_sha) }).catch(() => {});
        }
        return cached;
    }

    const options = {
        method: 'GET',
        url: 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha,
        analysisContext: reportContext,
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
        },
    };

    const request = async (url) => {
        const response = typeof apiGateway !== 'undefined' ? await apiGateway.fetchWithTimeout(url, { ...options, url }) : await fetch(url, { ...options, url });
        let json_data = null;
        try { json_data = await response.json(); }
        catch (error) { if (response.status === 200) throw error; }
        return { response, json_data };
    };

    const fetchPromise = (async () => {
        try {
            let result = await request(options.url);
            // A fresh quick-scan submission is often not yet known to the
            // overview endpoint. Its scanner state lives under /quick-scan/{id}.
            const qsId = quickScanId != null ? String(quickScanId) : '';
            if (result.response.status === 404 && HYBRID_QUICK_SCAN_ID.test(qsId) && !['MANUAL_CHECK', 'PENDING_UPLOAD', 'N/A'].includes(qsId)) {
                const quick = await request('https://hybrid-analysis.com/api/v2/quick-scan/' + encodeURIComponent(qsId));
                if (quick.response.status === 200 && quick.json_data && typeof quick.json_data === 'object' && !Array.isArray(quick.json_data)) {
                    result = { response: quick.response, json_data: { ...quick.json_data, sha256: quick.json_data.sha256 || hybrid_sha }, source: 'quick-scan' };
                }
            }
            if (result.response.status !== 200) {
                hybrid_report_cache.delete(hybrid_sha);
            }

            return result;
        } catch (error) {
            hybrid_report_cache.delete(hybrid_sha);
            throw error;
        }
    })();

    hybrid_report_cache.set(hybrid_sha, fetchPromise);
    return fetchPromise;
}

function reportControl(root, id) {
    if (root === document || typeof root.querySelectorAll !== 'function') return document.getElementById(id);
    return [...root.querySelectorAll('[id]')].find(node => node.id === id) || null;
}

function reportActionAvailable(button, root) {
    return !hybridReportDisposed && !button.disabled && (root === document || root.isConnected !== false);
}

function setupRescanButton({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, controlId = hybrid_sha, kind = 'attachment' }, controlsRoot = document) {
    let rescanBtn = reportControl(controlsRoot, `btn-rescan-${controlId}`);
    if (rescanBtn) {
        if (kind === 'unknown') {
            rescanBtn.disabled = true;
            rescanBtn.setAttribute('title',uiText('analysisResourceUnknown','Unknown resource'));
            return;
        }
        rescanBtn.addEventListener('click', function() {
            let btn = this;
            if (!reportActionAvailable(btn,controlsRoot)) return;
            let statusEl = reportControl(controlsRoot, `rescan-status-${controlId}`);
            if (!statusEl) return;
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.textContent = uiText("ui_041", "Sende Rescan...");
            statusEl.textContent = kind === 'link' ? uiText('ui_058','URL is being submitted...') : uiText("ui_042", "Datei wird für Rescan hochgeladen...");

            browser.runtime.sendMessage(kind === 'link' ? {
                action: 'scanUrl', messageId, url: attachmentName, headerMessageId
            } : {
                action: "uploadAttachment",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName,
                hash: hybrid_sha,
                headerMessageId: headerMessageId
            }).then(res => {
                if (hybridReportDisposed) return;
                if (res && res.status === 'success') {
                    statusEl.textContent = uiText("ui_043", "Rescan erfolgreich initiiert. Lade Seite neu...");
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2";
                    btn.textContent = uiText("ui_044", "Erfolgreich");
                    if (btn.rescanTimeoutId) clearTimeout(btn.rescanTimeoutId);
                    btn.rescanTimeoutId = setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    statusEl.textContent = uiText("ui_045", "Fehler beim Rescan: ") + (res ? res.message : uiText("ui_046", "Unbekannter Fehler"));
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                    btn.textContent = uiText("ui_047", "Erneut versuchen");
                }
            }).catch(err => {
                if (hybridReportDisposed) return;
                statusEl.textContent = uiText("ui_048", "Kommunikationsfehler: ") + err;
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.textContent = uiText("ui_047", "Erneut versuchen");
            });
        });
    }
}

function setupCdrButton({ hybrid_sha, attachmentName, messageId, partName, controlId = hybrid_sha }, controlsRoot = document) {
    let cdrBtn = reportControl(controlsRoot, `btn-cdr-${controlId}`);
    if (cdrBtn) {
        cdrBtn.addEventListener('click', function() {
            let btn = this;
            if (!reportActionAvailable(btn,controlsRoot)) return;
            let statusEl = reportControl(controlsRoot, `cdr-status-${controlId}`);
            if (!statusEl) return;
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.textContent = uiText("ui_049", "Bereinige...");
            statusEl.textContent = uiText("ui_050", "Lokales CDR wird durchgeführt...");

            browser.runtime.sendMessage({
                action: "downloadDisarmed",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName
            }).then(res => {
                if (hybridReportDisposed) return;
                if (res && res.status === 'success') {
                    statusEl.textContent = uiText("ui_051", "Herunterladen erfolgreich initiiert.");
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2 ml-2";
                    btn.textContent = uiText("ui_052", "Bereinigt");
                } else {
                    statusEl.textContent = uiText("ui_053", "Fehler beim Herunterladen: ") + (res ? res.message : uiText("ui_046", "Unbekannter Fehler"));
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                    btn.textContent = uiText("ui_047", "Erneut versuchen");
                }
            }).catch(err => {
                if (hybridReportDisposed) return;
                statusEl.textContent = uiText("ui_048", "Kommunikationsfehler: ") + err;
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.textContent = uiText("ui_047", "Erneut versuchen");
            });
        });
    }
}

function render_hybrid_report_ui({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, urlscan = null, json_data, jobId = null, submissionId = null, fetched_at = null, attempt = null }, targetContainer, replaceNode = null) {
    let container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    const boundMessageId = messageId ?? popupMessageId;
    const kind = Number.isInteger(boundMessageId) && boundMessageId > 0 ? partName ? 'attachment' : popupLinkResources.has(attachmentName) ? 'link' : 'unknown' : 'unknown';
    // Presentation IDs are local to this popup, not resource identities. Equal
    // file contents can occur in multiple parts and must have distinct controls.
    const controlId = 'thundy-report-' + (++hybridReportCardSequence);
    let reportNode = renderReport({ json_data, attachmentName, hybrid_sha, virustotal_stats, urlscan, jobId, submissionId, fetched_at, attempt, controlId, allowCdr:kind === 'attachment' });
    // A poll attempt replaces the previous (still IN_PROGRESS) card instead of
    // appending a duplicate report (FA-1).
    if (replaceNode && typeof replaceNode.replaceWith === 'function') {
        replaceNode.replaceWith(reportNode);
    } else {
        container.appendChild(reportNode);
    }

    setupRescanButton({ hybrid_sha, attachmentName, messageId:boundMessageId, partName, headerMessageId, controlId, kind }, reportNode);
    setupCdrButton({ hybrid_sha, attachmentName, messageId:boundMessageId, partName, controlId }, reportNode);
    return reportNode;
}

function handle_hybrid_report_error(response, attachmentName, targetContainer, json_data = null) {
    console.error(`Hybrid Analysis API error: ${response.status} - ${response.statusText}`);
    let errDiv1 = document.createElement('div');
    errDiv1.className = 'alert-error';
    errDiv1.setAttribute('role', 'alert');

    let errMsg = document.createElement('span');
    errMsg.id = 'api-error-msg-key';
    errMsg.textContent = uiText("ui_054", "API Error: $1 für Element $2", [response.status, attachmentName]);
    errDiv1.appendChild(errMsg);

    // Hybrid Analysis explains quota, key and parameter problems in `message`.
    const providerMessage = json_data && typeof json_data === 'object' && !Array.isArray(json_data)
        ? [json_data.message, json_data.error, json_data.detail].find(value => typeof value === 'string' && value.trim())
        : null;
    if (providerMessage) {
        const pProvider = document.createElement('p');
        pProvider.className = 'hybrid-provider-message';
        pProvider.textContent = uiText('hybridProviderMessage', 'Provider message: $1', [providerMessage.trim().slice(0, 500)]);
        errDiv1.appendChild(pProvider);
    }
    if (response.status === 429) {
        const pRate = document.createElement('p');
        pRate.textContent = uiText('hybridRateLimited', 'The Hybrid Analysis rate limit or quota was reached. Please try again later.');
        errDiv1.appendChild(pRate);
    }

    if (response.status === 401 || response.status === 403) {
        errMsg.textContent += uiText("ui_055", " (Möglicherweise ungültiger oder fehlender API-Schlüssel).");
        let btnSettings = document.createElement('button');
        btnSettings.className = 'btn-primary mt-2 ml-2';
        btnSettings.textContent = uiText("ui_003", "Einstellungen öffnen");
        btnSettings.setAttribute('aria-describedby', 'api-error-msg-key');
        btnSettings.addEventListener('click', () => {
            browser.runtime.openOptionsPage();
        });
        errDiv1.appendChild(document.createElement('br'));
        errDiv1.appendChild(btnSettings);
    }

    let container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    container.appendChild(errDiv1);
}

function handle_hybrid_report_fetch_error(error, attachmentName, targetContainer) {
    console.error('Fetch error:', error);
    let errDiv2 = document.createElement('div');
    errDiv2.className = 'alert-error';
    errDiv2.setAttribute('role', 'alert');
    errDiv2.textContent = uiText("ui_056", "Netzwerkfehler: $1 für Element $2", [error.message, attachmentName]);
    let container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    container.appendChild(errDiv2);
}

/**
 * Persists the fetched analysis protocol (FA-3) into the IndexedDB record so
 * the finished Hybrid Analysis report survives the popup being closed and is
 * shown on the next open without a new provider request. Local-only write; the
 * report data is already on the machine, so this never violates the consent
 * rules. Returns true when the record was updated.
 */
async function persistHybridReport({ headerMessageId, sha256, attachmentName, report, fetchedAt = null, jobId = null, submissionId = null, generation = hybridReportGeneration }) {
    if (!headerMessageId || !report || typeof updateStore !== 'function' || typeof openDB !== 'function') return false;
    try {
        const db = await openDB('thunderbird_av', 3);
        try {
            const updatedAt = Date.now();
            let changed = false;
            await updateStore(db, 'hybridanalysis', headerMessageId, (record) => {
                if (!record) return null;
                if (hybridReportDisposed || generation !== hybridReportGeneration) return record;
                // A filename is not a submission identity. A resubmission may have
                // reused it while an older provider response was in flight.
                const matches = item => (
                    (sha256 ? item.hybrid_sha256 === sha256 : attachmentName && (item.attachment_name === attachmentName || item.url === attachmentName)) &&
                    (!jobId || item.hybrid_job_id === jobId) &&
                    (!submissionId || item.hybrid_submission_id === submissionId)
                );
                const finalReport = !isHybridReportInProgress(report);
                for (const att of (record.attachments || [])) {
                    if (matches(att)) {
                        att.report = report;
                        att.report_fetched_at = fetchedAt || new Date().toISOString();
                        if (finalReport && att.state === 'UPLOADED') att.state = 'KNOWN';
                        changed = true;
                    }
                }
                for (const link of (record.links || [])) {
                    if (matches(link)) {
                        link.report = report;
                        link.report_fetched_at = fetchedAt || new Date().toISOString();
                        if (finalReport && link.state === 'UPLOADED') link.state = 'KNOWN';
                        changed = true;
                    }
                }
                if (changed) record.updatedAt = updatedAt;
                return record;
            }, {preserveReports:true});
            return changed;
        } finally { db.close(); }
    } catch (error) {
        console.error('Fehler beim Speichern des Analyse-Protokolls:', error);
        return false;
    }
}

/**
 * True when a finished analysis protocol was already persisted for this item
 * (FA-3): it can be rendered offline instead of querying the provider again.
 */
function hasFinalStoredReport(item) {
    const r = item && item.report;
    if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
    if (isHybridReportInProgress(r)) return false;
    if (typeof r.state === 'string' && r.state.trim() !== '') return true;
    return Boolean(
        (typeof r.verdict === 'string' && r.verdict.trim() !== '') ||
        r.whitelisted === true ||
        (typeof r.threat_score === 'number' && Number.isFinite(r.threat_score)) ||
        (typeof r.multiscan_result === 'number' && Number.isFinite(r.multiscan_result)) ||
        (Array.isArray(r.scanners) && r.scanners.length > 0) ||
        (r.scanners_v2 && typeof r.scanners_v2 === 'object' && !Array.isArray(r.scanners_v2) && Object.keys(r.scanners_v2).length > 0)
    );
}

function buildStoredAttachmentReportTask(att, message) {
    return (frag) => render_hybrid_report_ui({
        hybrid_sha: att.hybrid_sha256,
        attachmentName: att.attachment_name,
        messageId: message.id,
        partName: att.partName,
        headerMessageId: message.headerMessageId,
        virustotal_stats: att.virustotal_stats,
        json_data: att.report,
        jobId: att.hybrid_job_id,
        submissionId: att.hybrid_submission_id,
        fetched_at: att.report_fetched_at
    }, frag);
}

function buildStoredLinkReportTask(linkObj, headerMessageId) {
    return (frag) => render_hybrid_report_ui({
        hybrid_sha: linkObj.hybrid_sha256,
        attachmentName: linkObj.url,
        headerMessageId: headerMessageId,
        urlscan: linkObj.urlscan,
        json_data: linkObj.report,
        jobId: linkObj.hybrid_job_id,
        submissionId: linkObj.hybrid_submission_id,
        fetched_at: linkObj.report_fetched_at
    }, frag);
}

// Polling bounds for the in-progress analysis protocol (FA-1). The Hybrid
// Analysis overview endpoint returns state IN_PROGRESS until the analysis is
// finished; without polling the popup never delivered the finished protocol.
// Quick scans with several engines regularly need 20-45 seconds.
const HYBRID_REPORT_POLL_MAX_ATTEMPTS = 8;
const HYBRID_REPORT_POLL_DELAY_MS = 5000;

function scheduleHybridReportPoll(params, targetContainer, replaceNode) {
    if (typeof setTimeout !== 'function' || hybridReportDisposed) return;
    const generation = hybridReportGeneration;
    // Timer handles are records so synchronous timer testdoubles are safe too.
    const timer = { id: null };
    hybridReportTimers.add(timer);
    timer.id = setTimeout(() => {
        hybridReportTimers.delete(timer);
        if (hybridReportDisposed || generation !== hybridReportGeneration) return;
        hybrid_report_cache.delete(params.hybrid_sha);
        get_hybrid_report_by_sha256(params, targetContainer, replaceNode);
    }, HYBRID_REPORT_POLL_DELAY_MS);
}

async function get_hybrid_report_by_sha256({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats = null, urlscan = null, jobId = null, submissionId = null, _attempt = 1 }, targetContainer, replaceNode = null) {
    const generation = hybridReportGeneration;
    if (hybridReportDisposed) return;
    try {
        const { response, json_data } = await fetch_hybrid_report(hybrid_sha, partName ? 'attachment:' + partName : popupLinkResources.get(attachmentName) || null, submissionId || jobId);
        if (hybridReportDisposed || generation !== hybridReportGeneration) return;

        if (response.status === 200) {
            const reportNode = render_hybrid_report_ui({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, urlscan, json_data, jobId, submissionId, attempt: _attempt }, targetContainer, replaceNode);
            const saved = await persistHybridReport({ headerMessageId, sha256: hybrid_sha, attachmentName, report: json_data, jobId, submissionId, generation });
            if (hybridReportDisposed || generation !== hybridReportGeneration) return;
            if (headerMessageId && !saved && reportNode) {
                const status = document.createElement('p'); status.setAttribute('role', 'status');
                status.textContent = uiText('reportNotSaved', 'This report could not be saved locally.');
                reportNode.appendChild(status);
            }
            if (saved && json_data && !isHybridReportInProgress(json_data) && typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.sendMessage === 'function') {
                const activeMessageId = Number.isInteger(messageId) ? messageId : popupMessageId;
                if (Number.isInteger(activeMessageId)) {
                    Promise.resolve(browser.runtime.sendMessage({ action: 'refreshThreatBanner', messageId: activeMessageId })).catch(() => {});
                }
            }
            if (json_data && isHybridReportInProgress(json_data) && _attempt < HYBRID_REPORT_POLL_MAX_ATTEMPTS) {
                scheduleHybridReportPoll({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, urlscan, jobId, submissionId, _attempt: _attempt + 1 }, targetContainer, reportNode);
            }
        } else if (response.status === 404 && (jobId || submissionId) && _attempt < HYBRID_REPORT_POLL_MAX_ATTEMPTS) {
            const pendingReport = { state: 'IN_PROGRESS', sha256: hybrid_sha, job_id: jobId, submission_id: submissionId };
            const reportNode = render_hybrid_report_ui({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, urlscan, json_data: pendingReport, jobId, submissionId, attempt: _attempt }, targetContainer, replaceNode);
            scheduleHybridReportPoll({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, urlscan, jobId, submissionId, _attempt: _attempt + 1 }, targetContainer, reportNode);
        } else {
            handle_hybrid_report_error(response, attachmentName, targetContainer, json_data);
        }
    } catch (error) {
        if (!hybridReportDisposed && generation === hybridReportGeneration) handle_hybrid_report_fetch_error(error, attachmentName, targetContainer);
    }
}

function handleUrlScanClick(btn, url, urlId, headerMessageId) {
    let statusEl = document.getElementById(`upload-status-${urlId}`);
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerText = uiText("ui_057", "Sende URL...");
    statusEl.innerText = uiText("ui_058", "URL wird an Hybrid Analysis übertragen...");

    browser.runtime.sendMessage({
        action: "scanUrl",
        messageId: popupMessageId,
        url: url,
        headerMessageId: headerMessageId
    }).then(response => {
        if (response && response.status === 'success') {
            statusEl.innerText = uiText("ui_059", "Scan erfolgreich beauftragt! Lade Analyseergebnisse...");
            btn.removeAttribute('aria-busy');
            btn.className = "btn-success mt-2";
            btn.innerText = uiText("ui_044", "Erfolgreich");
            if (btn.urlScanTimeoutId) clearTimeout(btn.urlScanTimeoutId);
            btn.urlScanTimeoutId = setTimeout(() => {
                const el = document.getElementById(`upload-container-${urlId}`);
                if (el) el.remove();
                // response.data.sha256 enthält den sha256-Hash des URL-Scans
                get_hybrid_report_by_sha256({
                    hybrid_sha: response.data.sha256,
                    attachmentName: url, headerMessageId,
                    jobId: response.data?.job_id || (Array.isArray(response.data?.reports) && response.data.reports[0]) || response.data?.id,
                    submissionId: response.data?.submission_id || response.data?.id
                });
            }, 3000);
        } else {
            statusEl.innerText = uiText("ui_060", "Fehler beim Upload: ") + (response ? response.message : uiText("ui_046", "Unbekannter Fehler"));
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerText = uiText("ui_047", "Erneut versuchen");
        }
    }).catch(err => {
        statusEl.innerText = uiText("ui_048", "Kommunikationsfehler: ") + err;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.innerText = uiText("ui_047", "Erneut versuchen");
    });
}

function processRecordLinks(links, headerMessageId, syncFragment, fetchTasks) {
    for (const linkObj of links) {
        if (linkObj.state === 'UNKNOWN') {
            renderManualUrlScanUI(linkObj.url, headerMessageId, syncFragment, linkObj.urlscan, linkObj.hybrid_verdict);
        } else if (hasFinalStoredReport(linkObj)) {
            // FA-3: finished protocol already persisted; render it offline.
            fetchTasks.push(buildStoredLinkReportTask(linkObj, headerMessageId));
        } else if (linkObj.hybrid_sha256) {
            fetchTasks.push((frag) => get_hybrid_report_by_sha256({
                hybrid_sha: linkObj.hybrid_sha256,
                attachmentName: linkObj.url,
                headerMessageId: headerMessageId,
                urlscan: linkObj.urlscan,
                jobId: linkObj.hybrid_job_id,
                submissionId: linkObj.hybrid_submission_id
            }, frag));
        }
    }
}

function renderManualUrlScanUI(url, headerMessageId, targetContainer, urlscan = null, hybridVerdict = null) {
    let container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    // Erzeuge eine sichere, eindeutige ID für die URL
    const u8 = new TextEncoder().encode(url);
    // ⚡ Bolt Optimization: Use a pre-allocated array and .join() to avoid string concatenation overhead.
    const hex = new Array(u8.length);
    for (let j = 0; j < u8.length; j++) hex[j] = byteToHex[u8[j]];
    let urlId = hex.join('');

    let card = document.createElement('div');
    card.className = "card card-info mb-3";
    card.id = `upload-container-${urlId}`;
    card.setAttribute('role', 'status');

    let h2 = document.createElement('h2');
    h2.textContent = uiText("ui_061", "URL: $1", [url]);
    card.appendChild(h2);

    let pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.appendChild(document.createTextNode(uiText("ui_062", "Diese URL wurde in der E-Mail gefunden. Aus Datenschutzgründen wurde sie ")));
    const infoStrong = document.createElement('strong');
    infoStrong.textContent = uiText("ui_063", "nicht automatisch hochgeladen");
    pInfo.appendChild(infoStrong);
    pInfo.appendChild(document.createTextNode("."));
    card.appendChild(pInfo);

    if (hybridVerdict && typeof hybridVerdict === 'object' && !Array.isArray(hybridVerdict)) {
        renderHybridLinkVerdict(hybridVerdict, card);
    }
    if (urlscan && typeof urlscan === 'object' && !Array.isArray(urlscan)) {
        renderUrlscanResult(urlscan, card);
    }

    let btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${urlId}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = uiText("ui_064", "URL jetzt scannen");
    btnUpload.setAttribute('aria-describedby', `upload-status-${urlId}`);
    card.appendChild(btnUpload);

    let pStatus = document.createElement('p');
    pStatus.id = `upload-status-${urlId}`;
    pStatus.className = "mt-2";
    pStatus.setAttribute('aria-live', 'polite');
    pStatus.setAttribute('role', 'status');
    card.appendChild(pStatus);

    container.appendChild(card);

    btnUpload.addEventListener('click', function() {
        handleUrlScanClick(this, url, urlId, headerMessageId);
    });
}

function handleUploadClick({ hash, safeHash, attachmentName, messageId, partName, headerMessageId }) {
    const handler = function() {
        let btn = this;
        let statusId = `upload-status-${safeHash}`;
        let statusEl = document.getElementById(statusId);
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.innerText = uiText("ui_065", "Lade hoch...");
        if (statusEl) statusEl.textContent = uiText("ui_066", "Datei wird an Hybrid Analysis übertragen...");

        browser.runtime.sendMessage({
            action: "uploadAttachment",
            messageId: messageId,
            partName: partName,
            attachmentName: attachmentName,
            hash: hash,
            headerMessageId: headerMessageId
        }).then(response => {
            if (response && response.status === 'success') {
                if (statusEl) statusEl.innerText = uiText("ui_067", "Upload erfolgreich! Lade Analyseergebnisse...");
                btn.removeAttribute('aria-busy');
                btn.className = "btn-success mt-2";
                btn.innerText = uiText("ui_044", "Erfolgreich");
                if (btn.uploadTimeoutId) clearTimeout(btn.uploadTimeoutId);
                btn.uploadTimeoutId = setTimeout(() => {
                    let container = document.getElementById(`upload-container-${safeHash}`);
                    if (container) container.remove();
                    get_hybrid_report_by_sha256({
                        hybrid_sha: response.data?.sha256 || hash,
                        jobId: response.data?.job_id || (Array.isArray(response.data?.reports) && response.data.reports[0]) || response.data?.id,
                        submissionId: response.data?.submission_id || response.data?.id,
                        attachmentName: attachmentName,
                        messageId: messageId,
                        partName: partName,
                        headerMessageId: headerMessageId
                    });
                }, 3000);
            } else {
                if (statusEl) statusEl.innerText = uiText("ui_060", "Fehler beim Upload: ") + (response ? response.message : uiText("ui_046", "Unbekannter Fehler"));
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = uiText("ui_047", "Erneut versuchen");
            }
        }).catch(err => {
            if (statusEl) statusEl.innerText = uiText("ui_048", "Kommunikationsfehler: ") + err;
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerText = uiText("ui_047", "Erneut versuchen");
        });
    };

    return handler;
}

function createUploadButton(card, { hash, safeHash, attachmentName, messageId, partName, headerMessageId }) {
    let btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${safeHash}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = uiText("ui_068", "Datei jetzt scannen (Upload)");
    btnUpload.setAttribute('aria-describedby', `upload-status-${safeHash}`);
    card.appendChild(btnUpload);

    let pUploadStatus = document.createElement('p');
    pUploadStatus.id = `upload-status-${safeHash}`;
    pUploadStatus.className = "mt-2";
    pUploadStatus.setAttribute('aria-live', 'polite');
    pUploadStatus.setAttribute('role', 'status');
    card.appendChild(pUploadStatus);

    btnUpload.addEventListener('click', handleUploadClick({ hash, safeHash, attachmentName, messageId, partName, headerMessageId }));
}

function createCdrButton(card, safeHash, attachmentName, messageId, partName) {
    if (!attachmentName || !/\.html?$/i.test(attachmentName)) {
        return;
    }

    let cdrBtn = document.createElement('button');
    cdrBtn.id = `btn-cdr-${safeHash}`;
    cdrBtn.className = "btn-primary mt-2 ml-2";
    cdrBtn.textContent = uiText("ui_035", "Bereinigen & Herunterladen (Lokales CDR)");
    cdrBtn.setAttribute('aria-describedby', `cdr-status-${safeHash}`);
    card.appendChild(cdrBtn);

    let pCdrStatus = document.createElement('p');
    pCdrStatus.id = `cdr-status-${safeHash}`;
    pCdrStatus.className = "mt-2";
    pCdrStatus.setAttribute("aria-live", "polite");
    pCdrStatus.setAttribute("role", "status");
    card.appendChild(pCdrStatus);

    cdrBtn.addEventListener('click', function() {
        let btn = this;
        let statusId = `cdr-status-${safeHash}`;
        let statusEl = document.getElementById(statusId);
        btn.disabled = true;
        if (btn) btn.setAttribute('aria-busy', 'true');
        btn.innerText = uiText("ui_049", "Bereinige...");
        if (statusEl) statusEl.textContent = uiText("ui_050", "Lokales CDR wird durchgeführt...");

        browser.runtime.sendMessage({
            action: "downloadDisarmed",
            messageId: messageId,
            partName: partName,
            attachmentName: attachmentName
        }).then(res => {
            if (res && res.status === 'success') {
                if (statusEl) statusEl.innerText = uiText("ui_051", "Herunterladen erfolgreich initiiert.");
                if (btn) {
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2 ml-2";
                    btn.innerText = uiText("ui_052", "Bereinigt");
                }
            } else {
                if (statusEl) statusEl.innerText = uiText("ui_053", "Fehler beim Herunterladen: ") + (res ? res.message : uiText("ui_046", "Unbekannter Fehler"));
                btn.disabled = false;
                if (btn) btn.removeAttribute('aria-busy');
                btn.innerText = uiText("ui_047", "Erneut versuchen");
            }
        }).catch(err => {
            if (statusEl) statusEl.innerText = uiText("ui_048", "Kommunikationsfehler: ") + err;
            btn.disabled = false;
            if (btn) btn.removeAttribute('aria-busy');
            btn.innerText = uiText("ui_047", "Erneut versuchen");
        });
    });
}

function renderManualUploadUI(hash, attachmentName, messageId, partName, headerMessageId, targetContainer, virustotal_stats = null) {
    let safeHash = escapeHTML(hash);

    let card = document.createElement('div');
    card.className = "card card-info mb-3";
    card.id = `upload-container-${safeHash}`;
    card.setAttribute('role', 'status');

    let h2 = document.createElement('h2');
    h2.textContent = uiText("ui_069", "Anhang: $1", [attachmentName || uiText('unknownAttachment', "Unbekannt")]);
    card.appendChild(h2);

    let pHash = document.createElement('p');
    pHash.textContent = uiText("ui_012", "SHA-256: $1", [hash]);
    card.appendChild(pHash);

    let pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.appendChild(document.createTextNode(uiText("ui_070", "Diese Datei ist der Datenbank von Hybrid Analysis unbekannt. Aus Datenschutzgründen wurde sie ")));
    const infoStrong = document.createElement('strong');
    infoStrong.textContent = uiText("ui_063", "nicht automatisch hochgeladen");
    pInfo.appendChild(infoStrong);
    pInfo.appendChild(document.createTextNode("."));
    card.appendChild(pInfo);

    if (virustotal_stats && typeof virustotal_stats === 'object' && !Array.isArray(virustotal_stats)) {
        renderVirusTotalStats(virustotal_stats, card);
    }

    createUploadButton(card, { hash, safeHash, attachmentName, messageId, partName, headerMessageId });
    createCdrButton(card, safeHash, attachmentName, messageId, partName);

    if (targetContainer) {
        targetContainer.appendChild(card);
    } else {
        document.getElementById('hybrid_analysis_api_content').appendChild(card);
    }
}
