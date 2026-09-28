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

/**
 * Prüft die Zustimmung zur externen Analyse zum Zeitpunkt des Aufrufs.
 * Die Zustimmung wird bewusst neu aus dem Speicher gelesen: Nutzer können sie
 * widerrufen, während das Popup geöffnet ist - danach darf nichts mehr
 * übertragen werden.
 */
async function externalAnalysisAllowed() {
    try {
        const stored = await browser.storage.local.get(['externalAnalysisConsent']);
        return stored.externalAnalysisConsent === true;
    } catch (error) {
        console.error('Konnte die Zustimmung nicht lesen:', error);
        return false;
    }
}

async function hasHybridHostPermission() {
    try {
        if (browser.permissions && typeof browser.permissions.contains === 'function') {
            return await browser.permissions.contains({ origins: ['https://hybrid-analysis.com/*'] });
        }
    } catch (error) {
        console.error('Konnte die Host-Berechtigung nicht prüfen:', error);
    }
    return false;
}

/** fetch mit Zeitlimit; fällt ohne AbortController-Unterstützung auf fetch zurück. */
async function apiFetch(url, options = {}, timeout = 15000) {
    if (typeof AbortController !== 'function') {
        return fetch(url, options);
    }
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeout);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timerId);
    }
}

(async () => {
let result = await browser.storage.local.get('apikey');
apikey_hybridanalysis = result.apikey;

if (!apikey_hybridanalysis) {
    let container = document.getElementById('hybrid_analysis_api_content');
    container.textContent = '';
    let alertDiv = document.createElement('div');
    alertDiv.className = 'alert-error';
    alertDiv.setAttribute('role', 'alert');
    let strong = document.createElement('strong');
    strong.textContent = 'Warnung:';
    alertDiv.appendChild(strong);

    let messageSpan = document.createElement('span');
    messageSpan.id = 'api-key-error-msg';
    messageSpan.textContent = ' Kein API-Schlüssel für Hybrid-Analysis gefunden. Bitte hinterlegen Sie diesen in den Einstellungen der Erweiterung.';
    alertDiv.appendChild(messageSpan);

    let btnSettings = document.createElement('button');
    btnSettings.className = 'btn-primary mt-2 ml-2';
    btnSettings.textContent = 'Einstellungen öffnen';
    btnSettings.setAttribute('aria-describedby', 'api-key-error-msg');
    btnSettings.addEventListener('click', () => {
        browser.runtime.openOptionsPage();
    });
    alertDiv.appendChild(document.createElement('br'));
    alertDiv.appendChild(btnSettings);

    container.appendChild(alertDiv);
    return;
}

// Der Benutzer hat auf unseren Button geklickt, holen Sie sich den aktiven Tab im aktuellen Fenster mit
// der Tabs API.
let tabs = await browser.tabs.query({ active: true, currentWindow: true });

// Holen Sie sich die aktuell angezeigte Nachricht im aktiven Tab, mit der
// messageDisplay API. Hinweis: Dies benötigt die messagesRead Berechtigung.
// Manifest V3 in Thunderbird: getDisplayedMessages() liefert eine MessageList.
let message = null;
if (browser.messageDisplay && typeof browser.messageDisplay.getDisplayedMessages === 'function') {
    const messageList = await browser.messageDisplay.getDisplayedMessages(tabs[0].id);
    const messages = Array.isArray(messageList) ? messageList : (messageList && messageList.messages) || [];
    message = messages[0] || null;
} else if (browser.messageDisplay) {
    message = await browser.messageDisplay.getDisplayedMessage(tabs[0].id);
}

// Ohne Zustimmung zu externer Analyse wird nichts übertragen - das muss im
// Popup sichtbar sein, bevor der Nutzer Uploads auslöst.
const settings = await browser.storage.local.get(['externalAnalysisConsent', 'viewMode', 'historyEnabled']);
const externalAnalysisConsent = settings.externalAnalysisConsent === true;
const viewMode = VIEW_MODE_LABELS[settings.viewMode] ? settings.viewMode : 'private';
const technicalView = isTechnicalView(viewMode);


if (!message) {
    let container = document.getElementById('hybrid_analysis_api_content');
    container.textContent = '';
    let emptyCard = document.createElement('div');
    emptyCard.className = 'card card-info mt-3';
    emptyCard.setAttribute('role', 'status');
    let msg = document.createElement('p');
    msg.className = 'text-info';
    msg.textContent = "Bitte wählen Sie eine E-Mail aus, um sie zu überprüfen.";
    emptyCard.appendChild(msg);
    container.appendChild(emptyCard);
    return;
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

updateGridField("subject", message.subject, "(Kein Betreff)");
updateGridField("from", message.author, "(Unbekannter Absender)");
if (technicalView) {
    updateGridField("MessageHeaderID", message.headerMessageId, "(Keine ID)");
} else {
    const idRow = document.getElementById("MessageHeaderID");
    if (idRow && idRow.parentNode) idRow.parentNode.style.display = "none";
}

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
    loadingP.textContent = 'Lade Analyseergebnisse...';

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
    consentP.textContent = 'Externe Analyse ist nicht aktiviert: Es werden keine Hashes, Dateien oder Links an Analyse-Dienste übertragen.';
    consentCard.appendChild(consentP);

    let consentButton = document.createElement('button');
    consentButton.type = 'button';
    consentButton.className = 'btn-primary mt-2';
    consentButton.textContent = 'Einstellungen öffnen';
    consentButton.addEventListener('click', () => browser.runtime.openOptionsPage());
    consentCard.appendChild(consentButton);

    apiContainer.appendChild(consentCard);
}

// Lokale Bewertung transparent machen und die manuelle Anhang-Analyse anbieten.
if (apiContainer) {
    const activeTabId = tabs[0] ? tabs[0].id : null;
    renderAttachmentPanel(message, message.headerMessageId, apiContainer);
    renderScanStatusPanel(message.headerMessageId, apiContainer);
    currentMessage = message;
    currentContainer = apiContainer;
    currentViewMode = viewMode;
    renderResultsPanel(message, apiContainer);
    renderLinkList(message, apiContainer, viewMode);
    renderHistoryPanel(message, apiContainer, viewMode);
    renderReportExport(message, apiContainer, viewMode);
    renderResearcherPanel(message, apiContainer, viewMode);
    browser.runtime.sendMessage({ action: 'getDisplayState', tabId: activeTabId, messageId: message.id })
        .then(state => renderThreatSummary(apiContainer, state, viewMode))
        .catch(error => console.error('Bewertung konnte nicht geladen werden:', error));
}

try {

    // Öffnen Sie die Datenbank
    let openRequest = indexedDB.open("thunderbird_av", 3);

    openRequest.onupgradeneeded = function (e) {
        let db = e.target.result;

        if (!db.objectStoreNames.contains('hybridanalysis')) {
            db.createObjectStore('hybridanalysis', { keyPath: 'messageHeader' });
        }
    };


    openRequest.onsuccess = async function (e) {
        let db = e.target.result;
        // Erstellen Sie eine Transaktion und öffnen Sie den Object Store
        let transaction = db.transaction(["hybridanalysis"], "readonly");
        let store = transaction.objectStore("hybridanalysis");
        // Führen Sie eine Anfrage aus, um den Hash für die angegebene MessageHeaderId zu finden.
        let getRequest = store.get(message.headerMessageId);
        getRequest.onsuccess = async function (e) {
            const record = getRequest.result;
            const hasAttachments = record && record.attachments && record.attachments.length > 0;
            const hasLinks = record && record.links && record.links.length > 0;

            if (hasAttachments || hasLinks) {
                document.getElementById('hybrid_analysis_api_content').textContent = ''; // clear

                let fetchTasks = [];

                if (hasAttachments) {
                    for (const att of record.attachments) {
                        const hash256 = att.hybrid_sha256;
                        if (att.state === 'UNKNOWN') {
                            renderManualUploadUI(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId, syncFragment);
                        } else {
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
                        }
                    }
                }

                if (hasLinks) {
                    processRecordLinks(record.links, message.headerMessageId, syncFragment, fetchTasks);
                }

                if (fetchTasks.length > 0) {
                    await Promise.all(fetchTasks.map(async task => {
                        let taskFragment = document.createDocumentFragment();
                        await task(taskFragment);
                        if (taskFragment.hasChildNodes()) {
                            container.appendChild(taskFragment);
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
                p1.textContent = 'Keine Anhänge oder URLs für diese E-Mail gefunden.';
                emptyCard.appendChild(p1);
                container.appendChild(emptyCard);
            }
        };
    };

    openRequest.onerror = function(e) {
        let container = document.getElementById('hybrid_analysis_api_content');
        if (container) container.textContent = '';
        let emptyCard = document.createElement('div');
        emptyCard.className = 'card card-info mb-3';
        emptyCard.setAttribute('role', 'status');
        let p2 = document.createElement('p');
        p2.className = 'text-info';
        p2.textContent = 'Keine Analyseergebnisse für diese E-Mail vorhanden.';
        emptyCard.appendChild(p2);
        container.appendChild(emptyCard);
    }
} catch (error) {
    let container = document.getElementById('hybrid_analysis_api_content');
    if (container) {
        container.textContent = '';
        let errDiv = document.createElement('div');
        errDiv.className = 'alert-error';
        errDiv.setAttribute('role', 'alert');

        let errMsg = document.createElement('span');
        errMsg.id = 'unexpected-error-msg';
        errMsg.textContent = 'Unerwarteter Fehler beim Laden der Analyseergebnisse.';
        errDiv.appendChild(errMsg);

        let btnSettings = document.createElement('button');
        btnSettings.className = 'btn-primary mt-2 ml-2';
        btnSettings.textContent = 'Einstellungen öffnen';
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
    statusStrong.textContent = "Status:";
    pStatus.appendChild(statusStrong);
    pStatus.appendChild(document.createTextNode(" Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut."));
    card.appendChild(pStatus);

    const pHash = document.createElement('p');
    pHash.textContent = `SHA-256: ${json_data.sha256 || hybrid_sha}`;
    card.appendChild(pHash);
}

function renderThreatInfo(json_data, card) {
    let threatClass = "text-success";
    let semanticLabel = " (Normal)";
    if (json_data.threat_score > 50) {
        threatClass = "text-warning";
        semanticLabel = " (Suspicious)";
    }
    if (json_data.threat_score > 80) {
        threatClass = "text-danger";
        semanticLabel = " (Critical)";
    }

    const pThreat = document.createElement('p');
    const threatStrong = document.createElement('strong');
    threatStrong.className = `head_line ${threatClass}`;
    threatStrong.textContent = "Bedrohungsscore:";
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
    verdictStrong.textContent = "Urteil:";
    pVerdict.appendChild(verdictStrong);
    pVerdict.appendChild(document.createTextNode(" "));
    const verdictSpan = document.createElement('span');
    verdictSpan.className = threatClass;
    verdictSpan.textContent = json_data.verdict;
    pVerdict.appendChild(verdictSpan);
    card.appendChild(pVerdict);

    const pVxFamily = document.createElement('p');
    const vxStrong = document.createElement('strong');
    vxStrong.textContent = "Vx-Familie:";
    pVxFamily.appendChild(vxStrong);
    pVxFamily.appendChild(document.createTextNode(` ${json_data.vx_family || 'N/A'}`));
    card.appendChild(pVxFamily);

    const pMulti = document.createElement('p');
    pMulti.textContent = `Multiscan-Ergebnis: ${json_data.multiscan_result || 'N/A'}`;
    card.appendChild(pMulti);

    const pAddInfo = document.createElement('p');
    const addInfoStrong = document.createElement('strong');
    addInfoStrong.textContent = "Additional Information:";
    pAddInfo.appendChild(addInfoStrong);
    card.appendChild(pAddInfo);

    const pAnalysisTime = document.createElement('p');
    pAnalysisTime.textContent = `Analysis start time: ${json_data.analysis_start_time || 'N/A'}`;
    card.appendChild(pAnalysisTime);

    const pTags = document.createElement('p');
    pTags.textContent = `Tags: ${json_data.tags ? json_data.tags.join(', ') : 'N/A'}`;
    card.appendChild(pTags);
}

function renderVirusTotalStats(virustotal_stats, card) {
    const pVtHead = document.createElement('p');
    pVtHead.className = "ml-2";
    const vtHeadStrong = document.createElement('strong');
    vtHeadStrong.textContent = "VirusTotal Ergebnisse:";
    pVtHead.appendChild(vtHeadStrong);
    card.appendChild(pVtHead);

    const pVtMal = document.createElement('p');
    const malCount = virustotal_stats.malicious || 0;
    pVtMal.className = `ml-4 ${malCount > 0 ? "text-danger" : ""}`;
    pVtMal.textContent = `Malicious: ${malCount}`;
    card.appendChild(pVtMal);

    const pVtUnd = document.createElement('p');
    pVtUnd.className = "ml-4";
    pVtUnd.textContent = `Undetected: ${virustotal_stats.undetected || 0}`;
    card.appendChild(pVtUnd);

    const pVtSus = document.createElement('p');
    const susCount = virustotal_stats.suspicious || 0;
    pVtSus.className = `ml-4 ${susCount > 0 ? "text-warning" : ""}`;
    pVtSus.textContent = `Suspicious: ${susCount}`;
    card.appendChild(pVtSus);

    const pVtHarm = document.createElement('p');
    pVtHarm.className = "ml-4";
    pVtHarm.textContent = `Harmless: ${virustotal_stats.harmless || 0}`;
    card.appendChild(pVtHarm);
}

function renderScannerResults(scanners, card) {
    if (scanners && scanners.length > 0) {
        // Optimization: Use DocumentFragment to batch DOM insertions and avoid multiple reflows
        const fragment = document.createDocumentFragment();
        for (const scanner of scanners) {
            const pScanner = document.createElement('p');
            pScanner.className = "ml-2";
            pScanner.textContent = `Scanner: ${scanner.name}`;
            fragment.appendChild(pScanner);

            const pStatus = document.createElement('p');
            pStatus.className = "ml-4";
            pStatus.textContent = `Status: ${scanner.status}`;
            fragment.appendChild(pStatus);

            const avResults = scanner.anti_virus_results;
            if (avResults) {
                const pAvRes = document.createElement('p');
                pAvRes.className = "ml-4";
                pAvRes.textContent = `AV-Ergebnisse:`;
                fragment.appendChild(pAvRes);

                for (const avResult of avResults) {
                    const { product, verdict } = avResult;
                    const pAv = document.createElement('p');
                    pAv.className = "ml-6";
                    pAv.textContent = `AV: ${product} - Urteil: ${verdict}`;
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
        pNoScanners.textContent = `Keine Scanner-Ergebnisse verfügbar.`;
        emptyCard.appendChild(pNoScanners);
        card.appendChild(emptyCard);
    }
}

function renderFileDetails(json_data, card) {
    const pHash256 = document.createElement('p');
    pHash256.textContent = `SHA-256-Hashwert: ${json_data.sha256}`;
    card.appendChild(pHash256);

    const pFileName = document.createElement('p');
    pFileName.textContent = `Letzter Dateiname: ${json_data.last_file_name || 'N/A'}`;
    card.appendChild(pFileName);

    const pSize = document.createElement('p');
    pSize.textContent = `Größe: ${json_data.size || 'N/A'} Bytes`;
    card.appendChild(pSize);

    const pType = document.createElement('p');
    pType.textContent = `Typ: ${json_data.type || 'N/A'}`;
    card.appendChild(pType);
}

function renderActionButtons(hybrid_sha, attachmentName, card) {
    const btnRescan = document.createElement('button');
    btnRescan.id = `btn-rescan-${hybrid_sha}`;
    btnRescan.className = "btn-success mt-2";
    btnRescan.textContent = `Erneut scannen (Rescan)`;
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
        btnCdr.textContent = `Bereinigen & Herunterladen (Lokales CDR)`;
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
    h2.textContent = `Geprüftes Element: ${attachmentName || 'Unbekannt'}`;
    card.appendChild(h2);

    if (json_data.state === 'IN_PROGRESS') {
        renderInProgressStatus(json_data, hybrid_sha, card);
    } else {
        renderThreatInfo(json_data, card);

        const pTags = document.createElement('p');
        pTags.textContent = `Tags: ${json_data.tags ? json_data.tags.join(', ') : 'N/A'}`;
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

// ---------------------------------------------------------------------------
// Manuelle Anhang-Analyse
// Der Nutzer kann jeden Anhang explizit pruefen lassen: erst den SHA-256-Hash
// lokal berechnen, dann auf Wunsch an den konfigurierten Dienst uebertragen.
// Jede Uebertragung laeuft ueber das Hintergrundskript und bleibt damit an die
// Zustimmung gebunden.
// ---------------------------------------------------------------------------
function formatFileSize(bytes) {
    if (typeof bytes !== 'number' || bytes < 0) return 'unbekannte Groesse';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function describeErrorCode(code, fallbackMessage) {
    switch (code) {
        case 'NO_API_KEY':
            return 'Kein Hybrid-Analysis-API-Schluessel hinterlegt - bitte in den Einstellungen eintragen.';
        case 'EXTERNAL_ANALYSIS_DISABLED':
            return 'Externe Analyse ist nicht freigegeben - bitte in den Einstellungen aktivieren.';
        case 'PERMISSION_REQUIRED':
            return 'Host-Berechtigung fuer hybrid-analysis.com fehlt - bitte die Einstellungen speichern und die Berechtigung erteilen.';
        default:
            return fallbackMessage || 'Unbekannter Fehler.';
    }
}

async function requestAttachmentHash(messageId, partName) {
    const response = await browser.runtime.sendMessage({
        action: 'attachmentHash',
        messageId: messageId,
        partName: partName
    });
    if (response && response.status === 'success') return response;
    throw new Error(response && response.message ? response.message : 'Hash konnte nicht berechnet werden.');
}

async function uploadAttachmentForAnalysis({ messageId, partName, attachmentName, headerMessageId }) {
    const response = await browser.runtime.sendMessage({
        action: 'uploadAttachment',
        messageId: messageId,
        partName: partName,
        attachmentName: attachmentName,
        headerMessageId: headerMessageId
    });
    if (response && response.status === 'success') return response.data || {};
    const error = new Error(describeErrorCode(response && response.code, response && response.message));
    error.code = response && response.code;
    throw error;
}

/**
 * Status der zeitverzoegerten Analyse: klar unterscheiden zwischen der sofortigen
 * lokalen Pruefung und der externen Analyse, deren Ergebnis spaeter eintrifft.
 */
function describeJobState(job) {
    switch (job.state) {
        case 'finished':
            return 'Abgeschlossen - Verdikt: ' + (job.verdict || 'unbekannt');
        case 'timeout':
            return 'Kein Ergebnis innerhalb des Zeitfensters erhalten.';
        case 'failed':
            return 'Fehlgeschlagen: ' + (job.error || 'unbekannter Fehler');
        case 'queued':
            return 'In der Warteschlange - Analyse startet gleich.';
        default:
            return 'Analyse laeuft beim Anbieter (zeitverzoegert), Abfrage Nr. ' + (job.attempts || 0) +
                (job.elapsedMinutes !== null && job.elapsedMinutes !== undefined ? ' - laeuft seit ' + job.elapsedMinutes + ' Minute(n)' : '');
    }
}

async function renderScanStatusPanel(headerMessageId, container) {
    let response;
    try {
        response = await browser.runtime.sendMessage({ action: 'scanStatus', headerMessageId: headerMessageId });
    } catch (error) {
        console.error('Scan-Status konnte nicht geladen werden:', error);
        return;
    }
    if (!response || response.status !== 'success' || !Array.isArray(response.jobs) || response.jobs.length === 0) {
        return null;
    }

    let card = document.getElementById('thundy-scan-status-panel');
    if (!card) {
        card = document.createElement('div');
        card.id = 'thundy-scan-status-panel';
        card.className = 'card card-info mb-3';
        container.appendChild(card);
    }
    card.textContent = '';

    const title = document.createElement('p');
    title.textContent = 'Externe Analyse (zeitverzoegert) - ' + response.jobs.length + ' offene(r) Auftrag/Auftraege';
    card.appendChild(title);

    const hint = document.createElement('small');
    hint.textContent = 'Lokale Pruefungen (Hash, Heuristik, Kopfzeilen, Links) sind bereits in Echtzeit abgeschlossen. ' +
        'Der Anbieter analysiert die Datei asynchron; das Ergebnis wird automatisch abgefragt' +
        (response.pollIntervalMinutes ? ' (alle ' + response.pollIntervalMinutes + ' Minute(n))' : '') + '.';
    card.appendChild(hint);

    for (const job of response.jobs) {
        const row = document.createElement('div');
        row.className = 'thundy-attachment-row';
        const label = document.createElement('div');
        label.textContent = (job.attachmentName || job.sha256) + ' - ' + describeJobState(job);
        row.appendChild(label);
        const sha = document.createElement('small');
        sha.className = 'thundy-attachment-status';
        sha.textContent = 'SHA-256: ' + job.sha256;
        row.appendChild(sha);
        card.appendChild(row);
    }

    const pollButton = document.createElement('button');
    pollButton.type = 'button';
    pollButton.textContent = 'Ergebnis jetzt abrufen';
    pollButton.addEventListener('click', async () => {
        pollButton.disabled = true;
        pollButton.textContent = 'Frage Ergebnis ab...';
        try {
            const polled = await browser.runtime.sendMessage({ action: 'pollScansNow', headerMessageId: headerMessageId });
            if (polled && polled.status === 'success') {
                await renderScanStatusPanel(headerMessageId, container);
            }
        } catch (error) {
            console.error('Manuelle Abfrage fehlgeschlagen:', error);
        } finally {
            pollButton.disabled = false;
            pollButton.textContent = 'Ergebnis jetzt abrufen';
        }
    });
    card.appendChild(pollButton);

    return card;
}

// ---------------------------------------------------------------------------
// Rollen (Ansichtsmodi): steuern Informationsmenge und Detailtiefe.
//   quiet    - nur Warnungen
//   private  - Standard, klare Sprache ohne technische Kennungen
//   business - zusaetzlich Zeitstempel und Uebertragungszusammenfassung
//   research - volle Details (Hashes, Job-IDs, Versuche)
//   audit    - Nachweis-Sicht mit Verlauf und Export
// ---------------------------------------------------------------------------
/** Liest die Zustimmung zur externen Analyse jederzeit neu (Popup kann offen bleiben). */
async function currentConsent() {
    try {
        const stored = await browser.storage.local.get('externalAnalysisConsent');
        return stored.externalAnalysisConsent === true;
    } catch (error) {
        return false;
    }
}

/** Liest die Ansichtsrolle jederzeit neu aus dem Speicher (Popup kann offen bleiben). */
async function currentViewMode() {
    try {
        const stored = await browser.storage.local.get('viewMode');
        return VIEW_MODE_LABELS[stored.viewMode] ? stored.viewMode : 'private';
    } catch (error) {
        return 'private';
    }
}

// Oberflaeche lokalisieren (Thunderbird-Sprache; deutscher Text bleibt Fallback).
if (typeof thundyApplyTranslations === 'function') thundyApplyTranslations(document);

const VIEW_MODE_LABELS = {
    quiet: 'Nur Warnungen',
    private: 'Privat',
    business: 'Geschaeftlich',
    research: 'IT-Security-Forscher',
    audit: 'Nachweis / Compliance'
};

function viewModeDetailLevel(viewMode) {
    switch (viewMode) {
        case 'quiet': return 0;
        case 'research':
        case 'audit': return 2;
        default: return 1;
    }
}

function isTechnicalView(viewMode) {
    return viewModeDetailLevel(viewMode) >= 2;
}

function shorten(value, length) {
    if (!value) return '-';
    const text = String(value);
    return text.length > length ? text.slice(0, length) + '…' : text;
}

function describeHistoryEntry(entry, viewMode) {
    const detail = viewModeDetailLevel(viewMode);
    const time = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-';
    const what = entry.attachmentName || entry.domain || entry.ip || entry.sha256 || entry.subject || '(Nachricht)';
    const target = entry.transmitted ? 'uebertragen an ' + (entry.provider || 'Anbieter') : 'nur lokal';
    let line = time + ' - ' + (detail >= 1 ? what : 'Pruefung') + ' - ' + target;
    if (detail >= 2) {
        line += ' [' + entry.action + ']';
        if (entry.sha256) line += ' sha256=' + shorten(entry.sha256, 16);
        if (entry.jobId) line += ' job=' + entry.jobId;
        if (entry.verdict) line += ' verdict=' + entry.verdict;
    }
    if (entry.detail) line += ' - ' + entry.detail;
    return line;
}

/** Berichts-Export (Markdown/JSON) je Nachricht - auch ohne Zustimmung moeglich. */
async function renderReportExport(message, container, viewMode) {
    let report = null;
    try {
        const response = await browser.runtime.sendMessage({ action: 'getMessageReport', messageId: message.id });
        if (!response || response.status !== 'success') return null;
        report = response.report;
    } catch (error) {
        console.error('Bericht konnte nicht erstellt werden:', error);
        return null;
    }

    const card = document.createElement('div');
    card.id = 'thundy-report-panel';
    card.className = 'card card-info mb-3';

    const title = document.createElement('p');
    title.textContent = 'Bericht: ' + describeReportSummary(report, viewMode);
    card.appendChild(title);

    const markdownButton = document.createElement('button');
    markdownButton.type = 'button';
    markdownButton.textContent = 'Bericht als Markdown';
    markdownButton.addEventListener('click', () => {
        downloadHistoryFile('thundy-av-bericht.md', report.markdown, 'text/markdown;charset=utf-8');
    });
    card.appendChild(markdownButton);

    const jsonButton = document.createElement('button');
    jsonButton.type = 'button';
    jsonButton.textContent = 'Bericht als JSON';
    jsonButton.addEventListener('click', () => {
        downloadHistoryFile('thundy-av-bericht.json', JSON.stringify(report, null, 2), 'application/json');
    });
    card.appendChild(jsonButton);

    container.appendChild(card);
    return card;
}

function describeReportSummary(report, viewMode) {
    if (!report) return 'nicht verfügbar';
    const score = report.riskScore === null || report.riskScore === undefined ? 'unbekannt' : report.riskScore + '/100';
    let text = 'Bewertung ' + score + ', ' + report.attachments.length + ' Anhang/Anhänge, ' +
        report.transmissions.length + ' Übertragung(en)';
    if (isTechnicalView(viewMode)) {
        text += ', Auth: ' + (report.authStatus || 'unbekannt');
    }
    return text;
}


// ---------------------------------------------------------------------------
// Forscher-Panel: IOCs, Auth-Kette, Received-Hops, Link-Anatomie, Anhang-Typen
// Nur in den technischen Rollen; alle Daten sind lokal erhoben.
// ---------------------------------------------------------------------------
function buildIndicatorsCsv(insights) {
    const rows = [['type', 'value']];
    for (const url of insights.indicators.urls) rows.push(['url', url]);
    for (const domain of insights.indicators.domains) rows.push(['domain', domain]);
    for (const target of insights.indicators.registrableDomains) rows.push(['registrable-domain', target]);
    for (const ip of insights.indicators.ips) rows.push(['ip', ip]);
    for (const mail of insights.indicators.emails) rows.push(['email', mail]);
    for (const hash of insights.indicators.hashes) rows.push(['sha256', hash]);
    for (const id of insights.indicators.messageIds) rows.push(['message-id', id]);
    return rows.map(row => row.join(';')).join('\n');
}

function describeIndicatorCounts(insights) {
    const counts = insights.indicators.counts || {};
    return 'URLs: ' + (counts.urls || 0) + ', Domains: ' + (counts.domains || 0) +
        ', IPs: ' + (counts.ips || 0) + ', Adressen: ' + (counts.emails || 0) +
        ', Hashes: ' + (counts.hashes || 0);
}

async function renderResearcherPanel(message, container, viewMode) {
    if (!isTechnicalView(viewMode)) return null;

    let insights = null;
    try {
        const response = await browser.runtime.sendMessage({
            action: 'getMessageInsights',
            messageId: message.id,
            includeAttachmentBytes: true
        });
        if (!response || response.status !== 'success') return null;
        insights = response.insights;
    } catch (error) {
        console.error('Forscher-Analyse fehlgeschlagen:', error);
        return null;
    }

    const card = document.createElement('div');
    card.id = 'thundy-researcher-panel';
    card.className = 'card card-info mb-3';

    const title = document.createElement('p');
    title.textContent = thundyT('research.title', 'Forscher-Analyse (lokal erhoben)') + ' - ' +
        (insights.authStatus || 'Auth unbekannt');
    card.appendChild(title);

    // Bewertung nach Bestandteilen
    const breakdownTitle = document.createElement('small');
    breakdownTitle.textContent = thundyT('research.breakdown', 'Bewertung nach Bestandteilen:') + ' ' +
        (insights.scoreBreakdown || []).map(entry => entry.source + ' +' + entry.points).join(', ');
    card.appendChild(breakdownTitle);

    // Indikatoren
    const indicators = document.createElement('ul');
    indicators.className = 'thundy-history-list';
    const indicatorLines = [describeIndicatorCounts(insights)];
    if (insights.indicators.ips.length) indicatorLines.push('IPs: ' + insights.indicators.ips.slice(0, 10).join(', '));
    if (insights.indicators.hashes.length) indicatorLines.push('SHA-256: ' + insights.indicators.hashes.slice(0, 5).join(', '));
    if (insights.indicators.registrableDomains.length) indicatorLines.push('Domains: ' + insights.indicators.registrableDomains.slice(0, 10).join(', '));
    for (const line of indicatorLines) {
        const item = document.createElement('li');
        item.textContent = line;
        indicators.appendChild(item);
    }
    card.appendChild(indicators);

    // Authentifizierung + Received-Kette
    const authList = document.createElement('ul');
    authList.className = 'thundy-history-list';
    for (const result of insights.authResults) {
        const item = document.createElement('li');
        item.textContent = 'Auth: ' + result.mechanism.toUpperCase() + ' = ' + result.result +
            (result.domain ? ' (' + result.domain + ')' : '') + (result.authservId ? ' via ' + result.authservId : '');
        authList.appendChild(item);
    }
    for (const hop of insights.receivedChain.hops) {
        const item = document.createElement('li');
        item.textContent = 'Hop: ' + (hop.from || '?') + (hop.ip ? ' [' + hop.ip + ']' : '') +
            ' -> ' + (hop.by || '?') + (hop.delaySeconds !== null && hop.delaySeconds !== undefined ? ' (+' + hop.delaySeconds + ' s)' : '');
        authList.appendChild(item);
    }
    card.appendChild(authList);

    // Link-Anatomie (nur auffaellige oder getrackte Links)
    const flagged = insights.indicators.urlAnalyses.filter(entry => entry.flags.length > 0).slice(0, 10);
    if (flagged.length > 0) {
        const linkList = document.createElement('ul');
        linkList.className = 'thundy-history-list';
        for (const entry of flagged) {
            const item = document.createElement('li');
            item.textContent = shorten(entry.url, 90) + ' | ' + entry.registrableDomain + ' | ' + entry.flags.join('; ');
            linkList.appendChild(item);
        }
        card.appendChild(linkList);
    }

    // Anhang-Typanalyse
    const suspicious = insights.attachments.filter(entry => entry.flags.length > 0);
    if (suspicious.length > 0) {
        const attachmentList = document.createElement('ul');
        attachmentList.className = 'thundy-history-list';
        for (const entry of suspicious) {
            const item = document.createElement('li');
            item.textContent = entry.name + ' | deklariert: ' + entry.declaredType +
                (entry.detectedType ? ' | erkannt: ' + entry.detectedType : '') + ' | ' + entry.flags.join('; ');
            attachmentList.appendChild(item);
        }
        card.appendChild(attachmentList);
    }

    // Header-Forensik mit Schweregrad und MITRE-Zuordnung
    const forensics = insights.forensics || { findings: [], techniques: [] };
    if (forensics.findings.length > 0) {
        const forensicsList = document.createElement('ul');
        forensicsList.className = 'thundy-history-list';
        for (const finding of forensics.findings.slice(0, 15)) {
            const item = document.createElement('li');
            const badge = finding.severity === 'hoch' ? '[HOCH]' : (finding.severity === 'mittel' ? '[MITTEL]' : '[INFO]');
            item.textContent = badge + ' ' + finding.detail +
                (finding.techniques && finding.techniques.length ? ' (' + finding.techniques.join(', ') + ')' : '');
            forensicsList.appendChild(item);
        }
        card.appendChild(forensicsList);
    }
    if (forensics.techniques && forensics.techniques.length > 0) {
        const techniqueLine = document.createElement('small');
        techniqueLine.textContent = 'MITRE ATT&CK: ' +
            forensics.techniques.map(technique => technique.id + ' ' + technique.name).join(' | ');
        card.appendChild(techniqueLine);
    }

    // Archivinhalte (nur Metadaten, kein Entpacken)
    for (const attachment of insights.attachments.filter(entry => entry.archive)) {
        const archiveLine = document.createElement('small');
        const entries = (attachment.archive.entries || []).slice(0, 10).map(entry => entry.name).join(', ');
        const flags = (attachment.archive.flags || []).length ? ' - ' + attachment.archive.flags.join('; ') : '';
        archiveLine.textContent = 'Archiv ' + attachment.name + ': ' + entries + flags;
        card.appendChild(archiveLine);
    }

    // Pivot-Links zu oeffentlichen Diensten (Aufruf durch den Nutzer)
    const pivotLines = [];
    for (const pivot of (insights.pivots && insights.pivots.hashes) || []) {
        pivotLines.push({ label: 'SHA-256 ' + pivot.value.slice(0, 16) + '...', links: pivot.links });
    }
    for (const pivot of (insights.pivots && insights.pivots.ips) || []) {
        pivotLines.push({ label: 'IP ' + pivot.value, links: pivot.links });
    }
    for (const pivot of pivotLines.slice(0, 10)) {
        const pivotRow = document.createElement('div');
        const label = document.createElement('small');
        label.textContent = pivot.label + ': ';
        pivotRow.appendChild(label);
        for (const link of pivot.links) {
            const anchor = document.createElement('a');
            anchor.className = 'thundy-link';
            anchor.href = link.url;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            anchor.textContent = link.provider;
            anchor.style.marginRight = '8px';
            pivotRow.appendChild(anchor);
        }
        card.appendChild(pivotRow);
    }
    if (pivotLines.length > 0) {
        const pivotNote = document.createElement('small');
        pivotNote.className = 'thundy-muted';
        pivotNote.textContent = ' Hinweis: Ein Klick auf einen Anbieter-Link uebermittelt den jeweiligen Indikator an diesen Dienst.';
        card.appendChild(pivotNote);
    }

    const findingsCsvButton = document.createElement('button');
    findingsCsvButton.type = 'button';
    findingsCsvButton.textContent = thundyT('research.exportFindingsCsv', 'Befunde als CSV');
    findingsCsvButton.addEventListener('click', async () => {
        try {
            const response = await browser.runtime.sendMessage({ action: 'getFindingsCsv', messageId: message.id });
            if (response && response.status === 'success') {
                downloadHistoryFile('thundy-av-befunde.csv', response.csv, 'text/csv;charset=utf-8');
            }
        } catch (error) {
            console.error('Befundexport fehlgeschlagen:', error);
        }
    });
    card.appendChild(findingsCsvButton);

    // Sammelpruefung aller Links (nur mit Zustimmung; ausdruecklicher Klick)
    const linkCount = (insights.indicators.urls || []).length;
    if (linkCount > 0 && await currentConsent()) {
        const bulkButton = document.createElement('button');
        bulkButton.type = 'button';
        bulkButton.className = 'btn-accent';
        bulkButton.textContent = thundyT('research.scanAllLinks', 'Alle Links pruefen') + ' (' + linkCount + ')';
        bulkButton.addEventListener('click', async () => {
            const status = document.createElement('small');
            bulkButton.disabled = true;
            bulkButton.textContent = thundyT('research.scanAllLinksRunning', 'Uebermittle Links...');
            try {
                const response = await browser.runtime.sendMessage({ action: 'scanAllLinks', messageId: message.id, limit: 20 });
                if (response && response.status === 'success') {
                    status.textContent = ' ' + thundyT('research.scanAllLinksResult',
                        'Ergebnis: $SUBMITTED$ von $TOTAL$ Links uebermittelt.',
                        [String(response.submitted), String(response.total)]);
                } else {
                    status.textContent = ' ' + ((response && response.message) || 'Fehlgeschlagen.');
                }
            } catch (error) {
                status.textContent = ' ' + error.message;
            } finally {
                bulkButton.disabled = false;
                bulkButton.textContent = thundyT('research.scanAllLinks', 'Alle Links pruefen') + ' (' + linkCount + ')';
                card.appendChild(status);
            }
        });
        card.appendChild(bulkButton);
    }

    // Lokale Pivot-Suche: kam dieser Indikator schon einmal vor?
    const pivotTargets = [
        ...(insights.indicators.hashes || []).slice(0, 3).map(value => ({ type: 'sha256', value })),
        ...(insights.indicators.ips || []).slice(0, 3).map(value => ({ type: 'ip', value }))
    ];
    for (const target of pivotTargets) {
        const row = document.createElement('div');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = thundyT('research.pivot', 'Vorkommen suchen') + ': ' + shorten(target.value, 20);
        const result = document.createElement('small');
        result.className = 'thundy-attachment-status';
        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                const response = await browser.runtime.sendMessage({
                    action: 'pivotIndicator', indicatorType: target.type, value: target.value
                });
                if (response && response.status === 'success') {
                    const pivot = response.pivot;
                    result.textContent = pivot.count === 0
                        ? thundyT('research.pivotNone', 'Bisher kein weiteres Vorkommen im lokalen Verlauf.')
                        : thundyT('research.pivotFound',
                            'Treffer: $COUNT$ Eintraege in $MESSAGES$ Nachricht(en).',
                            [String(pivot.count), String(pivot.messageCount)]);
                }
            } catch (error) {
                result.textContent = 'Fehler: ' + error.message;
            } finally {
                button.disabled = false;
            }
        });
        row.appendChild(button);
        row.appendChild(result);
        card.appendChild(row);
    }

    const stixButton = document.createElement('button');
    stixButton.type = 'button';
    stixButton.textContent = thundyT('research.exportStix', 'IOCs als STIX 2.1');
    stixButton.addEventListener('click', () => {
        downloadHistoryFile('thundy-av-iocs-stix.json', JSON.stringify(insights.stix || {}, null, 2), 'application/json');
    });
    card.appendChild(stixButton);

    const jsonButton = document.createElement('button');
    jsonButton.type = 'button';
    jsonButton.textContent = thundyT('research.exportJson', 'IOCs als JSON');
    jsonButton.addEventListener('click', () => {
        downloadHistoryFile('thundy-av-iocs.json', JSON.stringify(insights, null, 2), 'application/json');
    });
    card.appendChild(jsonButton);

    const csvButton = document.createElement('button');
    csvButton.type = 'button';
    csvButton.textContent = thundyT('research.exportCsv', 'IOCs als CSV');
    csvButton.addEventListener('click', () => {
        downloadHistoryFile('thundy-av-iocs.csv', buildIndicatorsCsv(insights), 'text/csv;charset=utf-8');
    });
    card.appendChild(csvButton);

    container.appendChild(card);
    return { card, insights };
}

/**
 * Link-Liste im Popup: zeigt pro Link Ziel-Domain, Merkmale und Pruefstand und
 * bietet "Pruefen" sowie "Oeffnen nach Pruefung" - genau der Weg, den die
 * Option "Bestätigung im Popup" verlangt.
 */
/**
 * Beobachtet einzelne Ergebnisse: Sobald das zeitverzoegerte Verdikt eintrifft,
 * wird die Statuszeile aktualisiert - auch wenn das Popup noch offen ist.
 */
const watchedResults = new Map();

function watchResult(type, value, render) {
    if (!value || typeof render !== 'function') return;
    watchedResults.set(type + ':' + String(value).toLowerCase(), { type, value, render });
}

async function refreshWatchedResults() {
    if (watchedResults.size === 0) return;
    for (const watched of Array.from(watchedResults.values())) {
        try {
            const response = await browser.runtime.sendMessage({
                action: 'evaluateLink', url: watched.value
            });
            if (response && response.status === 'success' && response.evaluation) {
                const evaluation = response.evaluation;
                watched.render({
                    state: evaluation.state || (evaluation.checked ? 'done' : 'pending'),
                    verdict: evaluation.verdict,
                    checkedAt: evaluation.checkedAt,
                    updatedAt: evaluation.checkedAt,
                    attempts: evaluation.attempts || 0,
                    source: evaluation.source || null,
                    value: watched.value
                });
            }
        } catch (error) { /* Popup kann geschlossen werden */ }
    }
}

try {
    browser.runtime.onMessage.addListener((message) => {
        if (message && message.action === 'resultsUpdated') {
            refreshWatchedResults();
            renderResultsPanel(currentMessage, currentContainer);
            renderLinkList(currentMessage, currentContainer, currentViewMode);
        }
    });
} catch (e) { /* Listener optional */ }

/**
 * Ergebnis-Panel: zeigt offene und abgeschlossene Pruefungen aus dem Cache -
 * auch die, die erst nach dem letzten Oeffnen fertig wurden. Damit ist der
 * Stand beim naechsten Oeffnen des Popups sofort sichtbar.
 */
function describeResultEntry(entry) {
    const when = entry.checkedAt || entry.updatedAt;
    const time = when ? new Date(when).toLocaleString() : '-';
    const label = entry.attachmentName || entry.value;
    if (entry.state === 'done') {
        return (entry.verdict || 'unbekannt') + ' | ' + label + ' | geprueft: ' + time +
            (entry.source ? ' | Quelle: ' + entry.source : '');
    }
    if (entry.state === 'failed') {
        return 'ohne Ergebnis | ' + label + ' | letzter Versuch: ' + time;
    }
    const attempts = entry.attempts ? ' (' + entry.attempts + ' Abfrage(n))' : '';
    return 'Pruefung laeuft (zeitverzoegert)' + attempts + ' | ' + label + ' | gestartet: ' + time;
}

async function renderResultsPanel(message, container) {
    let response;
    try {
        response = await browser.runtime.sendMessage({
            action: 'getResults', messageHeaderId: message.headerMessageId, limit: 30
        });
    } catch (error) {
        console.error('Ergebnis-Cache nicht verfuegbar:', error);
        return null;
    }
    if (!response || response.status !== 'success') return null;

    const summary = response.summary || {};
    const entries = response.entries || [];
    const openScans = response.pendingScans || [];
    if (entries.length === 0 && openScans.length === 0) return null;

    let card = document.getElementById('thundy-results-panel');
    if (!card) {
        card = document.createElement('div');
        card.id = 'thundy-results-panel';
        card.className = 'card card-info mb-3';
        container.appendChild(card);
    }
    card.textContent = '';

    const title = document.createElement('p');
    title.textContent = thundyT('popup.results.title', 'Pruefergebnisse (zwischengespeichert):') +
        ' ' + summary.total + ' Eintrag/Eintraege, ' + summary.pending + ' offen, ' + summary.done + ' fertig' +
        (summary.failed ? ', ' + summary.failed + ' ohne Ergebnis' : '');
    card.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'thundy-history-list';
    for (const entry of entries.slice(0, 15)) {
        const item = document.createElement('li');
        item.textContent = describeResultEntry(entry);
        list.appendChild(item);
    }
    for (const job of openScans.slice(0, 10)) {
        const item = document.createElement('li');
        item.textContent = 'Auftrag ' + (job.attachmentName || job.sha256) + ': ' + job.state +
            ' (Pruefung Nr. ' + (job.attempts || 0) + ')';
        list.appendChild(item);
    }
    card.appendChild(list);

    const pollButton = document.createElement('button');
    pollButton.type = 'button';
    pollButton.className = 'btn-primary';
    pollButton.textContent = thundyT('popup.results.pollNow', 'Ergebnis jetzt abrufen');
    pollButton.addEventListener('click', async () => {
        pollButton.disabled = true;
        pollButton.textContent = thundyT('popup.results.polling', 'Frage Anbieter ab...');
        try {
            await browser.runtime.sendMessage({ action: 'pollScansNow' });
            await renderResultsPanel(message, container);
        } catch (error) {
            console.error('Abfrage fehlgeschlagen:', error);
        } finally {
            pollButton.disabled = false;
            pollButton.textContent = thundyT('popup.results.pollNow', 'Ergebnis jetzt abrufen');
        }
    });
    card.appendChild(pollButton);

    const hint = document.createElement('small');
    hint.className = 'thundy-muted';
    hint.textContent = thundyT('popup.results.hint',
        'Zeitverzoegerte Analysen werden im Hintergrund abgefragt; das Ergebnis steht beim naechsten Oeffnen sofort bereit.');
    card.appendChild(hint);

    return card;
}

async function renderLinkList(message, container, viewMode) {
    let response;
    try {
        response = await browser.runtime.sendMessage({
            action: 'getMessageInsights',
            messageId: message.id,
            includeAttachmentBytes: false
        });
    } catch (error) {
        console.error('Link-Liste nicht verfuegbar:', error);
        return null;
    }
    if (!response || response.status !== 'success') return null;

    const urlAnalyses = (response.insights.indicators && response.insights.indicators.urlAnalyses) || [];
    if (urlAnalyses.length === 0) return null;

    const card = document.createElement('div');
    card.id = 'thundy-link-list';
    card.className = 'card card-info mb-3';

    const title = document.createElement('p');
    title.textContent = thundyT('popup.links.title', 'Links dieser Nachricht (Prüfung vor dem Öffnen):') +
        ' ' + urlAnalyses.length;
    card.appendChild(title);

    const guardSettings = await browser.runtime.sendMessage({ action: 'getLinkGuardSettings' }).catch(() => null);
    const guardActive = guardSettings && guardSettings.status === 'success' ? guardSettings.mode : 'unknown';

    for (const analysis of urlAnalyses.slice(0, 15)) {
        const row = document.createElement('div');
        row.className = 'thundy-attachment-row';

        const label = document.createElement('div');
        label.textContent = shorten(analysis.url, 80);
        row.appendChild(label);

        const detail = document.createElement('small');
        detail.className = 'thundy-attachment-status';
        detail.textContent = (analysis.registrableDomain || analysis.host || '-') +
            (isTechnicalView(viewMode) && analysis.decodedHost && analysis.decodedHost !== analysis.host
                ? ' | liest sich als ' + analysis.decodedHost : '') +
            ((analysis.flags || []).length ? ' | ' + analysis.flags.join('; ') : '');
        row.appendChild(detail);

        const status = document.createElement('small');
        status.className = 'thundy-attachment-status';
        status.textContent = describeResultEntry({
            state: analysis.result ? analysis.result.state : 'new',
            verdict: analysis.result ? analysis.result.verdict : null,
            checkedAt: analysis.result ? analysis.result.checkedAt : null,
            updatedAt: analysis.result ? analysis.result.checkedAt : null,
            attempts: analysis.result ? analysis.result.attempts : 0,
            source: analysis.result ? analysis.result.source : null,
            value: analysis.url
        });
        row.appendChild(status);

        const checkButton = document.createElement('button');
        checkButton.type = 'button';
        checkButton.textContent = thundyT('popup.links.check', 'Prüfen');
        checkButton.addEventListener('click', async () => {
            checkButton.disabled = true;
            try {
                const result = await browser.runtime.sendMessage({ action: 'evaluateLink', url: analysis.url });
                if (result && result.status === 'success') {
                    status.textContent = result.evaluation.verdict +
                        ((result.evaluation.flags || []).length ? ' | ' + result.evaluation.flags.join('; ') : '');
                    openButton.disabled = result.evaluation.verdict === 'BLOCKED_BY_RULE';
                }
            } finally {
                checkButton.disabled = false;
            }
        });
        row.appendChild(checkButton);

        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'btn-accent';
        openButton.textContent = thundyT('popup.links.open', 'Öffnen nach Prüfung');
        openButton.addEventListener('click', async () => {
            openButton.disabled = true;
            status.textContent = thundyT('popup.links.opening', 'Öffne…');
            try {
                const result = await browser.runtime.sendMessage({
                    action: 'openLinkAfterCheck', url: analysis.url, headerMessageId: message.headerMessageId
                });
                status.textContent = result && result.status === 'success'
                    ? thundyT('popup.links.opened', 'Geöffnet – bitte im geöffneten Tab prüfen.')
                    : ((result && result.message) || 'Öffnen fehlgeschlagen.');
            } catch (error) {
                status.textContent = 'Öffnen fehlgeschlagen: ' + error.message;
            } finally {
                openButton.disabled = false;
            }
        });
        row.appendChild(openButton);

        card.appendChild(row);
    }

    const hint = document.createElement('small');
    hint.className = 'thundy-muted';
    hint.textContent = guardActive === 'confirm'
        ? thundyT('popup.links.guardConfirm', 'Link-Schutz aktiv: Links im Nachrichtentext werden erst nach der Freigabe geöffnet.')
        : thundyT('popup.links.guardHint', 'Tipp: In den Einstellungen kann der Link-Schutz auf "Blockieren bis zur Prüfung" gestellt werden.');
    card.appendChild(hint);

    container.appendChild(card);
    return card;
}

async function renderHistoryPanel(message, container, viewMode) {
    if (viewModeDetailLevel(viewMode) === 0) return null;

    let response;
    try {
        response = await browser.runtime.sendMessage({
            action: 'getHistory',
            messageHeaderId: message.headerMessageId,
            limit: 50
        });
    } catch (error) {
        console.error('Verlauf konnte nicht geladen werden:', error);
        return null;
    }
    if (!response || response.status !== 'success' || !Array.isArray(response.entries) || response.entries.length === 0) {
        return null;
    }

    const card = document.createElement('div');
    card.id = 'thundy-history-panel';
    card.className = 'card card-info mb-3';

    const title = document.createElement('p');
    const summary = response.summary || {};
    title.textContent = VIEW_MODE_LABELS[viewMode] + ': Verlauf dieser Nachricht (' + response.entries.length + ' Eintraege, ' +
        (summary.transmissions || 0) + ' Uebertragung(en))';
    card.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'thundy-history-list';
    for (const entry of response.entries.slice(-20).reverse()) {
        const item = document.createElement('li');
        item.textContent = describeHistoryEntry(entry, viewMode);
        list.appendChild(item);
    }
    card.appendChild(list);

    const hint = document.createElement('small');
    hint.textContent = viewModeClickHint(viewMode);
    card.appendChild(hint);

    container.appendChild(card);
    return card;
}

function viewModeClickHint(viewMode) {
    if (viewMode === 'audit') return 'Vollstaendiger Verlauf inklusive CSV/JSON-Export in den Einstellungen, Abschnitt "Verlauf".';
    if (viewMode === 'research') return 'Die Sicht "IT-Security-Forscher" zeigt Hashes, Job-IDs und Versuche; Export in den Einstellungen.';
    return 'Mehr Details in den Einstellungen (Ansicht/Verlauf).';
}

function renderThreatSummary(container, state) {
    if (!state || state.mode !== 'ready' || !state.threat) return;
    const threat = state.threat;
    const card = document.createElement('div');
    card.id = 'thundy-score-summary';
    card.className = 'card card-info mb-3';

    const heading = document.createElement('p');
    heading.textContent = 'Lokale Bewertung dieser Nachricht: ' + threat.score + ' von 100';
    card.appendChild(heading);

    const reasons = Array.isArray(threat.reasons) ? threat.reasons : [];
    if (reasons.length > 0) {
        const list = document.createElement('ul');
        list.className = 'thundy-reasons';
        for (const reason of reasons) {
            const item = document.createElement('li');
            item.textContent = String(reason);
            list.appendChild(item);
        }
        card.appendChild(list);
    } else {
        const none = document.createElement('p');
        none.textContent = 'Keine Auffaelligkeiten gefunden.';
        card.appendChild(none);
    }

    const note = document.createElement('small');
    note.textContent = 'Die Bewertung entsteht ausschliesslich lokal. Warnbanner erscheinen ab 50 von 100 Punkten.';
    card.appendChild(note);

    container.appendChild(card);
}

async function renderAttachmentPanel(message, headerMessageId, container, viewModeOverride) {
    const activeViewMode = viewModeOverride || await currentViewMode();
    const technicalViewActive = isTechnicalView(activeViewMode);
    let response;
    try {
        response = await browser.runtime.sendMessage({ action: 'listAttachments', messageId: message.id });
    } catch (error) {
        console.error('Anhaenge konnten nicht geladen werden:', error);
        return;
    }
    if (!response || response.status !== 'success' || !Array.isArray(response.attachments) || response.attachments.length === 0) {
        return;
    }

    const card = document.createElement('div');
    card.id = 'thundy-attachment-panel';
    card.className = 'card card-info mb-3';

    const title = document.createElement('p');
    title.textContent = 'Anhaenge dieser Nachricht (' + response.attachments.length + ')';
    card.appendChild(title);
    container.appendChild(card);

    for (const attachment of response.attachments) {
        const row = document.createElement('div');
        row.className = 'thundy-attachment-row';

        const label = document.createElement('div');
        label.textContent = attachment.name + ' (' + attachment.contentType + ', ' + formatFileSize(attachment.size) + ')';
        row.appendChild(label);

        const status = document.createElement('small');
        status.className = 'thundy-attachment-status';
        row.appendChild(status);

        const hashButton = document.createElement('button');
        hashButton.type = 'button';
        hashButton.textContent = 'Hash lokal berechnen';
        hashButton.addEventListener('click', async () => {
            hashButton.disabled = true;
            try {
                const result = await requestAttachmentHash(message.id, attachment.partName);
                status.textContent = technicalViewActive
                    ? 'SHA-256: ' + result.sha256
                    : 'SHA-256 berechnet: ' + shorten(result.sha256, 16) + ' (' + formatFileSize(result.size) + ')';
            } catch (error) {
                status.textContent = 'Fehler: ' + error.message;
            } finally {
                hashButton.disabled = false;
            }
        });
        row.appendChild(hashButton);

        const uploadButton = document.createElement('button');
        uploadButton.type = 'button';
        uploadButton.textContent = 'Hochladen & analysieren';
        uploadButton.addEventListener('click', async () => {
            uploadButton.disabled = true;
            status.textContent = 'Datei wird uebertragen...';
            try {
                const data = await uploadAttachmentForAnalysis({
                    messageId: message.id,
                    partName: attachment.partName,
                    attachmentName: attachment.name,
                    headerMessageId: headerMessageId
                });
                let sha256 = data && data.sha256 ? data.sha256 : null;
                if (!sha256) {
                    const local = await requestAttachmentHash(message.id, attachment.partName);
                    sha256 = local.sha256;
                }
                status.textContent = 'Hochgeladen - Pruefung laeuft (Ergebnis zeitverzoegert).';
                await get_hybrid_report_by_sha256({
                    hybrid_sha: sha256,
                    attachmentName: attachment.name,
                    messageId: message.id,
                    partName: attachment.partName,
                    headerMessageId: headerMessageId
                });
                status.textContent = technicalViewActive
                    ? 'Analyse angefordert (SHA-256: ' + sha256 + ') - Ergebnis zeitverzoegert.'
                    : 'Analyse angefordert - Ergebnis wird automatisch abgerufen.';
                // Registrieren: sobald das Ergebnis eintrifft, Status neu setzen.
                watchResult('sha256', sha256, (entry) => { status.textContent = describeResultEntry(entry); });
            } catch (error) {
                status.textContent = 'Fehler: ' + error.message;
                if (error.code === 'NO_API_KEY' || error.code === 'EXTERNAL_ANALYSIS_DISABLED' || error.code === 'PERMISSION_REQUIRED') {
                    const optionsButton = document.createElement('button');
                    optionsButton.type = 'button';
                    optionsButton.textContent = 'Einstellungen oeffnen';
                    optionsButton.addEventListener('click', () => browser.runtime.openOptionsPage());
                    row.appendChild(optionsButton);
                }
            } finally {
                uploadButton.disabled = false;
            }
        });
        row.appendChild(uploadButton);

        card.appendChild(row);
    }
}

const hybrid_report_cache = new Map();

async function fetch_hybrid_report(hybrid_sha) {
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

    // Der Cache-Eintrag wird bewusst synchron angelegt, damit parallele Aufrufe
    // denselben Request teilen. Die Zustimmungs- und Berechtigungsprüfung liegt
    // innerhalb der Promise, damit sie den Zeitpunkt des Aufrufs widerspiegelt:
    // Wurde die Zustimmung widerrufen, wird der Hash nicht übertragen.
    const fetchPromise = (async () => {
        try {
            if (!(await externalAnalysisAllowed())) {
                const error = new Error('Externe Analyse ist in den Einstellungen nicht freigegeben - es wurde nichts übertragen.');
                error.code = 'EXTERNAL_ANALYSIS_DISABLED';
                throw error;
            }
            if (!(await hasHybridHostPermission())) {
                const error = new Error('Host-Berechtigung für hybrid-analysis.com wurde nicht erteilt.');
                error.code = 'PERMISSION_DENIED';
                throw error;
            }

            const response = await apiFetch(options.url, options);
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
            btn.textContent = "Sende Rescan...";
            statusEl.textContent = "Datei wird für Rescan hochgeladen...";

            browser.runtime.sendMessage({
                action: "uploadAttachment",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName,
                hash: hybrid_sha,
                headerMessageId: headerMessageId
            }).then(res => {
                if (res && res.status === 'success') {
                    statusEl.innerText = "Rescan erfolgreich initiiert. Lade Seite neu...";
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2";
                    btn.innerText = "Erfolgreich";
                    if (btn.rescanTimeoutId) clearTimeout(btn.rescanTimeoutId);
                    btn.rescanTimeoutId = setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    statusEl.innerText = "Fehler beim Rescan: " + (res ? res.message : "Unbekannter Fehler");
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                    btn.innerText = "Erneut versuchen";
                }
            }).catch(err => {
                statusEl.innerText = "Kommunikationsfehler: " + err;
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = "Erneut versuchen";
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
            btn.innerText = "Bereinige...";
            statusEl.innerText = "Lokales CDR wird durchgeführt...";

            browser.runtime.sendMessage({
                action: "downloadDisarmed",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName
            }).then(res => {
                if (res && res.status === 'success') {
                    statusEl.innerText = "Herunterladen erfolgreich initiiert.";
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2 ml-2";
                    btn.innerText = "Bereinigt";
                } else {
                    statusEl.innerText = "Fehler beim Herunterladen: " + (res ? res.message : "Unbekannter Fehler");
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                    btn.innerText = "Erneut versuchen";
                }
            }).catch(err => {
                statusEl.innerText = "Kommunikationsfehler: " + err;
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = "Erneut versuchen";
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
    errMsg.textContent = `API Error: ${response.status} für Element ${attachmentName}`;
    errDiv1.appendChild(errMsg);

    if (response.status === 401 || response.status === 403) {
        errMsg.textContent += ' (Möglicherweise ungültiger oder fehlender API-Schlüssel).';
        let btnSettings = document.createElement('button');
        btnSettings.className = 'btn-primary mt-2 ml-2';
        btnSettings.textContent = 'Einstellungen öffnen';
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
    errDiv2.textContent = `Netzwerkfehler: ${error.message} für Element ${attachmentName}`;
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
        if (error && (error.code === 'EXTERNAL_ANALYSIS_DISABLED' || error.code === 'PERMISSION_DENIED')) {
            // Der Hinweis auf fehlende Zustimmung/Berechtigung wird bereits oben im
            // Popup angezeigt; hier keinen zusätzlichen Fehler ausgeben.
            console.log('Thundy AV: Analysebericht wird nicht geladen -', error.message);
            return;
        }
        handle_hybrid_report_fetch_error(error, attachmentName, targetContainer);
    }
}

function handleUrlScanClick(btn, url, urlId, headerMessageId) {
    let statusEl = document.getElementById(`upload-status-${urlId}`);
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerText = "Sende URL...";
    statusEl.innerText = "URL wird an Hybrid Analysis übertragen...";

    browser.runtime.sendMessage({
        action: "scanUrl",
        url: url,
        headerMessageId: headerMessageId
    }).then(response => {
        if (response && response.status === 'success') {
            statusEl.innerText = "Scan erfolgreich beauftragt! Lade Analyseergebnisse...";
            btn.removeAttribute('aria-busy');
            btn.className = "btn-success mt-2";
            btn.innerText = "Erfolgreich";
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
            statusEl.innerText = "Fehler beim Upload: " + (response ? response.message : "Unbekannter Fehler");
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerText = "Erneut versuchen";
        }
    }).catch(err => {
        statusEl.innerText = "Kommunikationsfehler: " + err;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.innerText = "Erneut versuchen";
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
    h2.textContent = `URL: ${url}`;
    card.appendChild(h2);

    let pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.appendChild(document.createTextNode("Diese URL wurde in der E-Mail gefunden. Aus Datenschutzgründen wurde sie "));
    const infoStrong = document.createElement('strong');
    infoStrong.textContent = "nicht automatisch hochgeladen";
    pInfo.appendChild(infoStrong);
    pInfo.appendChild(document.createTextNode("."));
    card.appendChild(pInfo);

    let btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${urlId}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = "URL jetzt scannen";
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
        btn.innerText = "Lade hoch...";
        if (statusEl) statusEl.textContent = "Datei wird an Hybrid Analysis übertragen...";

        browser.runtime.sendMessage({
            action: "uploadAttachment",
            messageId: messageId,
            partName: partName,
            attachmentName: attachmentName,
            hash: hash,
            headerMessageId: headerMessageId
        }).then(response => {
            if (response && response.status === 'success') {
                if (statusEl) statusEl.innerText = "Upload erfolgreich! Lade Analyseergebnisse...";
                btn.removeAttribute('aria-busy');
                btn.className = "btn-success mt-2";
                btn.innerText = "Erfolgreich";
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
                if (statusEl) statusEl.innerText = "Fehler beim Upload: " + (response ? response.message : "Unbekannter Fehler");
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = "Erneut versuchen";
            }
        }).catch(err => {
            if (statusEl) statusEl.innerText = "Kommunikationsfehler: " + err;
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerText = "Erneut versuchen";
        });
    };

    return handler;
}

function createUploadButton(card, { hash, safeHash, attachmentName, messageId, partName, headerMessageId }) {
    let btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${hash}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = `Datei jetzt scannen (Upload)`;
    btnUpload.setAttribute('aria-describedby', `upload-status-${hash}`);
    card.appendChild(btnUpload);

    let pUploadStatus = document.createElement('p');
    pUploadStatus.id = `upload-status-${hash}`;
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
    cdrBtn.textContent = "Bereinigen & Herunterladen (Lokales CDR)";
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
        btn.innerText = "Bereinige...";
        if (statusEl) statusEl.textContent = "Lokales CDR wird durchgeführt...";

        browser.runtime.sendMessage({
            action: "downloadDisarmed",
            messageId: messageId,
            partName: partName,
            attachmentName: attachmentName
        }).then(res => {
            if (res && res.status === 'success') {
                if (statusEl) statusEl.innerText = "Herunterladen erfolgreich initiiert.";
                if (btn) {
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2 ml-2";
                    btn.innerText = "Bereinigt";
                }
            } else {
                if (statusEl) statusEl.innerText = "Fehler beim Herunterladen: " + (res ? res.message : "Unbekannter Fehler");
                btn.disabled = false;
                if (btn) btn.removeAttribute('aria-busy');
                btn.innerText = "Erneut versuchen";
            }
        }).catch(err => {
            if (statusEl) statusEl.innerText = "Kommunikationsfehler: " + err;
            btn.disabled = false;
            if (btn) btn.removeAttribute('aria-busy');
            btn.innerText = "Erneut versuchen";
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
    h2.textContent = `Anhang: ${attachmentName || 'Unbekannt'}`;
    card.appendChild(h2);

    let pHash = document.createElement('p');
    pHash.textContent = `SHA-256: ${hash}`;
    card.appendChild(pHash);

    let pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.appendChild(document.createTextNode("Diese Datei ist der Datenbank von Hybrid Analysis unbekannt. Aus Datenschutzgründen wurde sie "));
    const infoStrong = document.createElement('strong');
    infoStrong.textContent = "nicht automatisch hochgeladen";
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
