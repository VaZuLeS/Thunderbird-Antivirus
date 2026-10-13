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
        if (area === 'local' && changes.externalAnalysisConsent) {
            externalAnalysisConsent = changes.externalAnalysisConsent.newValue === true;
            if (!externalAnalysisConsent && typeof apiGateway !== 'undefined') { apiGateway.abortAll(); hybrid_report_cache.clear(); }
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
        card.className = 'card card-info';
        card.setAttribute('role', 'status');
        const score = document.createElement('p');
        score.textContent = uiText('bannerThreatScore', 'Risk score: $1 of 100', [local.threat.score]);
        card.appendChild(score);
        for (const reason of local.threat.reasons) {
            const p = document.createElement('p'); p.textContent = reason; card.appendChild(p);
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

    apiContainer.appendChild(consentCard);
}

try {

    const db = await openDB('thunderbird_av', 3);
    try {
            const record = await getFromStore(db, 'hybridanalysis', message.headerMessageId);
            const hasAttachments = record && record.attachments && record.attachments.length > 0;
            const hasLinks = record && record.links && record.links.length > 0;

            if (hasAttachments || hasLinks) {
                // Single live container for everything we render below. The old
                // code passed an undefined identifier (`syncFragment`) and used an
                // undeclared `container`, which threw a ReferenceError and left the
                // report area empty (P0-9).
                const liveContainer = apiContainer || document.getElementById('hybrid_analysis_api_content');
                if (liveContainer) liveContainer.textContent = ''; // clear

                let fetchTasks = [];

                if (hasAttachments) {
                    for (const att of record.attachments) {
                        const hash256 = att.hybrid_sha256;
                        if (att.state === 'SIZE_LIMIT') {
                            const p = document.createElement('p'); p.textContent = uiText('sizeLimit', 'Attachment exceeds the local size limit.'); liveContainer.appendChild(p);
                        } else if (['UNKNOWN', 'MANUAL_CHECK_PENDING', 'NOT_CHECKED'].includes(att.state)) {
                            renderManualUploadUI(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId, liveContainer);
                        } else if (externalAnalysisConsent && apikey_hybridanalysis) {
                            fetchTasks.push((frag) =>
                                get_hybrid_report_by_sha256({
                                    hybrid_sha: hash256,
                                    attachmentName: att.attachment_name,
                                    messageId: message.id,
                                    partName: att.partName,
                                    headerMessageId: message.headerMessageId,
                                    virustotal_stats: att.virustotal_stats
                                }, frag)
                            );
                        } else {
                            renderStoredResultWithoutConsent(att.attachment_name, hash256, liveContainer);
                        }
                    }
                }

                if (hasLinks) {
                    if (externalAnalysisConsent && apikey_hybridanalysis) {
                        processRecordLinks(record.links, message.headerMessageId, liveContainer, fetchTasks);
                    } else {
                        for (const linkObj of record.links) {
                            renderStoredResultWithoutConsent(linkObj.url, linkObj.hybrid_sha256, liveContainer);
                        }
                    }
                }

                if (fetchTasks.length > 0) {
                    await Promise.all(fetchTasks.map(async task => {
                        let taskFragment = document.createDocumentFragment();
                        await task(taskFragment);
                        if (taskFragment.hasChildNodes() && liveContainer) {
                            liveContainer.appendChild(taskFragment);
                        }
                    }));
                }
            } else {
                let container = document.getElementById('hybrid_analysis_api_content');
                if (container) container.textContent = '';
                let emptyCard = document.createElement('div');
                emptyCard.className = 'card card-info mb-3';
                emptyCard.setAttribute('role', 'status');
                let p1 = document.createElement('p');
                p1.className = 'text-info';
                p1.textContent = uiText("ui_007", "Keine Anhänge oder URLs für diese E-Mail gefunden.");
                emptyCard.appendChild(p1);
                container.appendChild(emptyCard);
            }
    } finally { db.close(); }
} catch (error) {
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

function renderInProgressStatus(json_data, hybrid_sha, card) {
    const pStatus = document.createElement('p');
    pStatus.className = "text-warning";
    const statusStrong = document.createElement('strong');
    statusStrong.textContent = uiText("ui_010", "Status:");
    pStatus.appendChild(statusStrong);
    pStatus.appendChild(document.createTextNode(uiText("ui_011", " Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut.")));
    card.appendChild(pStatus);

    const pHash = document.createElement('p');
    pHash.textContent = uiText("ui_012", "SHA-256: $1", [json_data.sha256 || hybrid_sha]);
    card.appendChild(pHash);
}

function renderThreatInfo(json_data, card) {
    let threatClass = "text-success";
    let semanticLabel = uiText('statusNormal', " (Normal)");
    if (json_data.threat_score > 50) {
        threatClass = "text-warning";
        semanticLabel = uiText('statusSuspicious', " (Suspicious)");
    }
    if (json_data.threat_score > 80) {
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
    threatSpan.textContent = json_data.threat_score + semanticLabel;
    pThreat.appendChild(threatSpan);
    card.appendChild(pThreat);

    const pVerdict = document.createElement('p');
    const verdictStrong = document.createElement('strong');
    verdictStrong.className = `head_line ${threatClass}`;
    verdictStrong.textContent = uiText("ui_014", "Urteil:");
    pVerdict.appendChild(verdictStrong);
    pVerdict.appendChild(document.createTextNode(" "));
    const verdictSpan = document.createElement('span');
    verdictSpan.className = threatClass;
    const verdictKeys = { 'no specific threat': 'providerNoDetection', 'clean': 'providerNoDetection', 'malicious': 'providerMalicious', 'suspicious': 'providerSuspicious', 'in progress': 'providerPending' };
    const verdictKey = verdictKeys[String(json_data.verdict).toLowerCase()];
    verdictSpan.textContent = verdictKey && typeof ThundyI18n !== 'undefined' ? ThundyI18n.get(verdictKey) : json_data.verdict;
    pVerdict.appendChild(verdictSpan);
    card.appendChild(pVerdict);

    const pVxFamily = document.createElement('p');
    const vxStrong = document.createElement('strong');
    vxStrong.textContent = uiText("ui_015", "Vx-Familie:");
    pVxFamily.appendChild(vxStrong);
    pVxFamily.appendChild(document.createTextNode(` ${json_data.vx_family || 'N/A'}`));
    card.appendChild(pVxFamily);

    const pMulti = document.createElement('p');
    pMulti.textContent = uiText("ui_016", "Multiscan-Ergebnis: $1", [json_data.multiscan_result || 'N/A']);
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
    pTags.textContent = uiText("ui_019", "Tags: $1", [json_data.tags ? json_data.tags.join(', ') : 'N/A']);
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

function renderScannerResults(scanners, card) {
    if (scanners && scanners.length > 0) {
        // Optimization: Use DocumentFragment to batch DOM insertions and avoid multiple reflows
        const fragment = document.createDocumentFragment();
        for (const scanner of scanners) {
            const pScanner = document.createElement('p');
            pScanner.className = "ml-2";
            pScanner.textContent = uiText("ui_025", "Scanner: $1", [scanner.name]);
            fragment.appendChild(pScanner);

            const pStatus = document.createElement('p');
            pStatus.className = "ml-4";
            pStatus.textContent = uiText("ui_026", "Status: $1", [scanner.status]);
            fragment.appendChild(pStatus);

            const avResults = scanner.anti_virus_results;
            if (avResults) {
                const pAvRes = document.createElement('p');
                pAvRes.className = "ml-4";
                pAvRes.textContent = uiText("ui_027", "AV-Ergebnisse:");
                fragment.appendChild(pAvRes);

                for (const avResult of avResults) {
                    const { product, verdict } = avResult;
                    const pAv = document.createElement('p');
                    pAv.className = "ml-6";
                    pAv.textContent = uiText("ui_028", "AV: $1 - Urteil: $2", [product, verdict]);
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

function renderFileDetails(json_data, card) {
    const pHash256 = document.createElement('p');
    pHash256.textContent = uiText("ui_030", "SHA-256-Hashwert: $1", [json_data.sha256]);
    card.appendChild(pHash256);

    const pFileName = document.createElement('p');
    pFileName.textContent = uiText("ui_031", "Letzter Dateiname: $1", [json_data.last_file_name || 'N/A']);
    card.appendChild(pFileName);

    const pSize = document.createElement('p');
    pSize.textContent = uiText("ui_032", "Größe: $1 Bytes", [(typeof ThundyI18n !== 'undefined' ? ThundyI18n.number(json_data.size) : json_data.size) || 'N/A']);
    card.appendChild(pSize);

    const pType = document.createElement('p');
    pType.textContent = uiText("ui_033", "Typ: $1", [json_data.type || 'N/A']);
    card.appendChild(pType);
}

function renderActionButtons(hybrid_sha, attachmentName, card) {
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

    if (attachmentName && /\.html?$/i.test(attachmentName)) {
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

function renderReport({ json_data, attachmentName, hybrid_sha, virustotal_stats = null }) {
    const card = document.createElement('div');
    card.className = "card mb-3";

    const h2 = document.createElement('h2');
    h2.textContent = uiText("ui_036", "Geprüftes Element: $1", [attachmentName || uiText('unknownAttachment', "Unbekannt")]);
    card.appendChild(h2);

    if (json_data.state === 'IN_PROGRESS') {
        renderInProgressStatus(json_data, hybrid_sha, card);
    } else {
        renderThreatInfo(json_data, card);

        const pTags = document.createElement('p');
        pTags.textContent = uiText("ui_019", "Tags: $1", [json_data.tags ? json_data.tags.join(', ') : 'N/A']);
        card.appendChild(pTags);

        if (virustotal_stats) {
            renderVirusTotalStats(virustotal_stats, card);
        }
    }

    renderScannerResults(json_data.scanners, card);
    renderFileDetails(json_data, card);
    renderActionButtons(hybrid_sha, attachmentName, card);
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
function renderStoredResultWithoutConsent(name, hash, targetContainer) {
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

async function fetch_hybrid_report(hybrid_sha) {
    if (!hasExternalAnalysisConsent()) {
        throw new Error('external-analysis-disabled');
    }
    if (typeof apiGateway !== 'undefined') {
        const current = await browser.storage.local.get('externalAnalysisConsent');
        if (current.externalAnalysisConsent !== true || !await browser.permissions.contains({ origins: ['https://hybrid-analysis.com/*'] })) throw new Error(uiText('errorHostPermissionMissing', 'Host permission missing'));
    }
    if (hybrid_report_cache.has(hybrid_sha)) {
        return hybrid_report_cache.get(hybrid_sha);
    }

    const options = {
        method: 'GET',
        url: 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha,
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
            'user-agent': 'Falcon',
        },
    };

    const fetchPromise = (async () => {
        try {
            const response = typeof apiGateway !== 'undefined' ? await apiGateway.fetchWithTimeout(options.url, options) : await fetch(options.url, options);
            const json_data = await response.json();

            const result = { response, json_data };
            if (response.status !== 200) {
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

function setupRescanButton({ hybrid_sha, attachmentName, messageId, partName, headerMessageId }) {
    let rescanBtn = document.getElementById(`btn-rescan-${hybrid_sha}`);
    if (rescanBtn) {
        rescanBtn.addEventListener('click', function() {
            let btn = this;
            let statusEl = document.getElementById(`rescan-status-${hybrid_sha}`);
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.textContent = uiText("ui_041", "Sende Rescan...");
            statusEl.textContent = uiText("ui_042", "Datei wird für Rescan hochgeladen...");

            browser.runtime.sendMessage({
                action: "uploadAttachment",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName,
                hash: hybrid_sha,
                headerMessageId: headerMessageId
            }).then(res => {
                if (res && res.status === 'success') {
                    statusEl.innerText = uiText("ui_043", "Rescan erfolgreich initiiert. Lade Seite neu...");
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2";
                    btn.innerText = uiText("ui_044", "Erfolgreich");
                    if (btn.rescanTimeoutId) clearTimeout(btn.rescanTimeoutId);
                    btn.rescanTimeoutId = setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    statusEl.innerText = uiText("ui_045", "Fehler beim Rescan: ") + (res ? res.message : uiText("ui_046", "Unbekannter Fehler"));
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
        });
    }
}

function setupCdrButton({ hybrid_sha, attachmentName, messageId, partName }) {
    let cdrBtn = document.getElementById(`btn-cdr-${hybrid_sha}`);
    if (cdrBtn) {
        cdrBtn.addEventListener('click', function() {
            let btn = this;
            let statusEl = document.getElementById(`cdr-status-${hybrid_sha}`);
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.innerText = uiText("ui_049", "Bereinige...");
            statusEl.innerText = uiText("ui_050", "Lokales CDR wird durchgeführt...");

            browser.runtime.sendMessage({
                action: "downloadDisarmed",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName
            }).then(res => {
                if (res && res.status === 'success') {
                    statusEl.innerText = uiText("ui_051", "Herunterladen erfolgreich initiiert.");
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2 ml-2";
                    btn.innerText = uiText("ui_052", "Bereinigt");
                } else {
                    statusEl.innerText = uiText("ui_053", "Fehler beim Herunterladen: ") + (res ? res.message : uiText("ui_046", "Unbekannter Fehler"));
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
        });
    }
}

function render_hybrid_report_ui({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, json_data }, targetContainer) {
    let container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    let reportNode = renderReport({ json_data, attachmentName, hybrid_sha, virustotal_stats });
    container.appendChild(reportNode);

    setupRescanButton({ hybrid_sha, attachmentName, messageId, partName, headerMessageId });
    setupCdrButton({ hybrid_sha, attachmentName, messageId, partName });
}

function handle_hybrid_report_error(response, attachmentName, targetContainer) {
    console.error(`Hybrid Analysis API error: ${response.status} - ${response.statusText}`);
    let errDiv1 = document.createElement('div');
    errDiv1.className = 'alert-error';
    errDiv1.setAttribute('role', 'alert');

    let errMsg = document.createElement('span');
    errMsg.id = 'api-error-msg-key';
    errMsg.textContent = uiText("ui_054", "API Error: $1 für Element $2", [response.status, attachmentName]);
    errDiv1.appendChild(errMsg);

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

async function get_hybrid_report_by_sha256({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats = null }, targetContainer) {
    try {
        const { response, json_data } = await fetch_hybrid_report(hybrid_sha);

        if (response.status === 200) {
            render_hybrid_report_ui({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, json_data }, targetContainer);
        } else {
            handle_hybrid_report_error(response, attachmentName, targetContainer);
        }
    } catch (error) {
        handle_hybrid_report_fetch_error(error, attachmentName, targetContainer);
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
                    attachmentName: url
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
            renderManualUrlScanUI(linkObj.url, headerMessageId, syncFragment);
        } else if (linkObj.hybrid_sha256) {
            fetchTasks.push((frag) => get_hybrid_report_by_sha256({
                hybrid_sha: linkObj.hybrid_sha256,
                attachmentName: linkObj.url
            }, frag));
        }
    }
}

function renderManualUrlScanUI(url, headerMessageId, targetContainer) {
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
                        hybrid_sha: hash,
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

function renderManualUploadUI(hash, attachmentName, messageId, partName, headerMessageId, targetContainer) {
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

    createUploadButton(card, { hash, safeHash, attachmentName, messageId, partName, headerMessageId });
    createCdrButton(card, safeHash, attachmentName, messageId, partName);

    if (targetContainer) {
        targetContainer.appendChild(card);
    } else {
        document.getElementById('hybrid_analysis_api_content').appendChild(card);
    }
}
