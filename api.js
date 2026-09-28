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
    renderHistoryPanel(message, apiContainer, viewMode);
    renderReportExport(message, apiContainer, viewMode);
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
/** Liest die Ansichtsrolle jederzeit neu aus dem Speicher (Popup kann offen bleiben). */
async function currentViewMode() {
    try {
        const stored = await browser.storage.local.get('viewMode');
        return VIEW_MODE_LABELS[stored.viewMode] ? stored.viewMode : 'private';
    } catch (error) {
        return 'private';
    }
}

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
                status.textContent = 'Hochgeladen - Analyse wird geladen...';
                await get_hybrid_report_by_sha256({
                    hybrid_sha: sha256,
                    attachmentName: attachment.name,
                    messageId: message.id,
                    partName: attachment.partName,
                    headerMessageId: headerMessageId
                });
                status.textContent = technicalViewActive
                    ? 'Analyse angefordert (SHA-256: ' + sha256 + ')'
                    : 'Analyse angefordert - Ergebnis wird automatisch abgerufen.';
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
