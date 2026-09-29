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

// Zustimmung zur externen Analyse. Das Popup überträgt selbst keine Daten an
// Dritte: Jede Anbieter-Abfrage läuft als Nachricht an den Hintergrund, der
// Zustimmung und Host-Berechtigung erzwingt (siehe fetch_hybrid_report).
let externalAnalysisConsent = false;

// Zuletzt angezeigte Nachricht, damit eine Änderung der Zustimmung die Ansicht
// erneut aufbauen kann (browser.storage.onChanged).
let displayedPopupMessage = null;

const CONSENT_NOTICE_ID = 'thundy-consent-notice';
const CONSENT_REQUIRED_NOTE = 'Hinweis: Manuelle Uploads und URL-Scans erfordern die Zustimmung zur externen Analyse. Ohne Zustimmung lehnt der Hintergrund die Anfrage ab.';

(async () => {
try {
    await initPopup();
} catch (error) {
    // Kein Pfad darf werfen: auch ein unerwarteter Fehler endet in einer Karte.
    console.error('Unerwarteter Fehler beim Aufbau der Popup-Ansicht:', error && error.name ? error.name : 'Error');
    safeRenderUnexpectedErrorCard();
}
})();

// Baut die Popup-Ansicht auf. Als benannte Funktion, damit ein Fehler beim
// Aufbau nicht als unbehandelte Rejection endet.
async function initPopup() {
// Die Zustimmung wird vor jeder Anzeige und vor jedem Anbieter-Zugriff gelesen.
const settings = (await browser.storage.local.get(['externalAnalysisConsent'])) || {};
externalAnalysisConsent = settings.externalAnalysisConsent === true;

// Schaltet der Nutzer die Zustimmung um, wird die Ansicht sofort neu aufgebaut.
if (browser.storage && browser.storage.onChanged && typeof browser.storage.onChanged.addListener === 'function') {
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName && areaName !== 'local') return;
        if (!changes || !Object.prototype.hasOwnProperty.call(changes, 'externalAnalysisConsent')) return;
        externalAnalysisConsent = changes.externalAnalysisConsent.newValue === true;
        renderPopupAnalysis(displayedPopupMessage).catch(() => {});
    });
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

displayedPopupMessage = message;

await renderPopupAnalysis(message);
}

// ---------------------------------------------------------------------------
// Popup-Anzeige: Container, Zustimmung und Fehlerkarten
// ---------------------------------------------------------------------------

// Rendert die Fehlerkarte, ohne selbst werfen zu können.
function safeRenderUnexpectedErrorCard() {
    try {
        renderUnexpectedErrorCard(getPopupContainer());
    } catch (error) {
        console.error('Popup-Fehlerkarte konnte nicht gerendert werden:', error && error.name ? error.name : 'Error');
    }
}

function getPopupContainer() {
    return document.getElementById('hybrid_analysis_api_content');
}

// Nimmt entweder einen DOM-Container oder eine Sink-Funktion (syncFragment)
// entgegen, damit beide Aufrufarten unterstützt werden.
function toNodeSink(target) {
    if (typeof target === 'function') {
        return target;
    }
    if (target && typeof target.appendChild === 'function') {
        return (node) => target.appendChild(node);
    }
    return () => {};
}

// Hängt einen Knoten (Element oder DocumentFragment) an den Zielcontainer an,
// wenn er Inhalt hat. Leere Fragmente werden verworfen.
function appendIfNotEmpty(target, node) {
    if (!node) return false;
    if (typeof node.hasChildNodes === 'function' && !node.hasChildNodes()) {
        return false;
    }
    toNodeSink(target)(node);
    return true;
}

function isExternalAnalysisConsentEnabled() {
    return externalAnalysisConsent === true;
}

// Leert den Container und setzt den Consent-Hinweis sofort wieder: Der Hinweis
// darf während des Ladens der Daten nicht verschwinden.
function clearPopupContainer(container) {
    if (!container) return;
    container.textContent = '';
    if (!isExternalAnalysisConsentEnabled()) {
        appendConsentNotice(container);
    }
}

// Sichtbarer Hinweis (eigene Karte, role="status"), dass ohne Zustimmung nichts
// an Dritte übertragen wird. Ohne Zustimmung führt das Popup keine Abfrage aus.
function appendConsentNotice(container, extraMessage) {
    if (!container) return null;

    const existing = document.getElementById(CONSENT_NOTICE_ID);
    if (existing && typeof existing.remove === 'function') {
        existing.remove();
    }

    const consentCard = document.createElement('div');
    consentCard.id = CONSENT_NOTICE_ID;
    consentCard.className = 'card card-warn mb-3';
    consentCard.setAttribute('role', 'status');

    const consentP = document.createElement('p');
    consentP.textContent = 'Externe Analyse ist nicht aktiviert: Es werden keine Hashes, Dateien oder Links an Analyse-Dienste übertragen.';
    consentCard.appendChild(consentP);

    if (extraMessage) {
        const extraP = document.createElement('p');
        extraP.textContent = extraMessage;
        consentCard.appendChild(extraP);
    }

    const consentButton = document.createElement('button');
    consentButton.type = 'button';
    consentButton.className = 'btn-primary mt-2';
    consentButton.textContent = 'Einstellungen öffnen';
    consentButton.addEventListener('click', () => browser.runtime.openOptionsPage());
    consentCard.appendChild(consentButton);

    container.appendChild(consentCard);
    return consentCard;
}

function appendStatusCard(container, text, className = 'card card-info mb-3') {
    if (!container) return;
    const card = document.createElement('div');
    card.className = className;
    card.setAttribute('role', 'status');
    const p = document.createElement('p');
    p.className = 'text-info';
    p.textContent = text;
    card.appendChild(p);
    container.appendChild(card);
}

function renderUnexpectedErrorCard(targetContainer) {
    const container = targetContainer || getPopupContainer();
    if (!container) return;

    clearPopupContainer(container);

    const errDiv = document.createElement('div');
    errDiv.className = 'alert-error';
    errDiv.setAttribute('role', 'alert');

    const errMsg = document.createElement('span');
    errMsg.id = 'unexpected-error-msg';
    errMsg.textContent = 'Unerwarteter Fehler beim Laden der Analyseergebnisse.';
    errDiv.appendChild(errMsg);

    const btnSettings = document.createElement('button');
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

// Aktualisieren Sie die HTML-Felder mit dem Betreff und dem Absender der Nachricht.
function updateGridField(id, value, fallbackText) {
    const el = document.getElementById(id);
    if (!el) return;
    if (value && String(value).trim() !== '') {
        el.textContent = value;
        el.style.color = "";
        el.style.fontStyle = "normal";
    } else {
        el.textContent = fallbackText;
        el.style.color = "var(--text-muted)";
        el.style.fontStyle = "italic";
    }
}

// Baut die Popup-Ansicht vollständig auf. Wird auch nach einer Änderung der
// Zustimmung (browser.storage.onChanged) erneut aufgerufen.
async function renderPopupAnalysis(message) {
    const container = getPopupContainer();

    if (!message) {
        appendStatusCard(container, "Bitte wählen Sie eine E-Mail aus, um sie zu überprüfen.", 'card card-info mt-3');
        return;
    }

    updateGridField("subject", message.subject, "(Kein Betreff)");
    updateGridField("from", message.author, "(Unbekannter Absender)");
    updateGridField("MessageHeaderID", message.headerMessageId, "(Keine ID)");

    // Der Consent-Hinweis steht sichtbar über dem Ladehinweis und wird beim
    // Laden der Daten nicht mehr entfernt.
    if (!isExternalAnalysisConsentEnabled()) {
        appendConsentNotice(container);
    }

    // Initialen Lade-Status für async Operationen setzen
    if (container) {
        const cardDiv = document.createElement('div');
        cardDiv.id = 'thundy-initial-loading';
        cardDiv.className = 'card card-info mb-3';

        const loadingP = document.createElement('p');
        loadingP.setAttribute('aria-live', 'polite');
        loadingP.setAttribute('role', 'status');
        loadingP.setAttribute('aria-busy', 'true');
        loadingP.className = 'text-info';
        loadingP.textContent = 'Lade Analyseergebnisse...';

        cardDiv.appendChild(loadingP);
        container.appendChild(cardDiv);
    }

    await loadStoredRecordAndRender(message, container);
}

// Liest den lokal gespeicherten Datensatz und baut daraus die Ansicht.
function loadStoredRecordAndRender(message, container) {
    return new Promise((resolve) => {
        let openRequest;
        try {
            // Öffnen Sie die Datenbank
            openRequest = indexedDB.open("thunderbird_av", 3);
        } catch (error) {
            console.error('IndexedDB konnte nicht geöffnet werden:', error && error.name ? error.name : 'Error');
            renderUnexpectedErrorCard(container);
            resolve();
            return;
        }

        openRequest.onupgradeneeded = function (e) {
            const db = e.target.result;

            if (!db.objectStoreNames.contains('hybridanalysis')) {
                db.createObjectStore('hybridanalysis', { keyPath: 'messageHeader' });
            }
        };

        openRequest.onsuccess = function (e) {
            const db = e.target.result;
            // Erstellen Sie eine Transaktion und öffnen Sie den Object Store
            const transaction = db.transaction(["hybridanalysis"], "readonly");
            const store = transaction.objectStore("hybridanalysis");
            // Führen Sie eine Anfrage aus, um den Hash für die angegebene MessageHeaderId zu finden.
            const getRequest = store.get(message.headerMessageId);

            getRequest.onsuccess = async function () {
                try {
                    await renderRecordView(getRequest.result, message, container);
                } catch (error) {
                    console.error('Fehler beim Anzeigen der Analyseergebnisse:', error && error.name ? error.name : 'Error');
                    renderUnexpectedErrorCard(container);
                } finally {
                    resolve();
                }
            };
        };

        openRequest.onerror = function () {
            appendStatusCard(container, 'Keine Analyseergebnisse für diese E-Mail vorhanden.');
            resolve();
        };
    });
}

// Zeigt einen gespeicherten Datensatz an. Ohne Zustimmung werden ausschließlich
// lokal vorliegende Daten und die manuellen Aktionen dargestellt - es wird kein
// getHybridOverview ausgelöst und keine Fetch-Aufgabe gebaut.
async function renderRecordView(record, message, container) {
    clearPopupContainer(container);

    const attachments = (record && Array.isArray(record.attachments)) ? record.attachments : [];
    const links = (record && Array.isArray(record.links)) ? record.links : [];
    const hasAttachments = attachments.length > 0;
    const hasLinks = links.length > 0;

    if (!hasAttachments && !hasLinks) {
        appendStatusCard(container, 'Keine Anhänge oder URLs für diese E-Mail gefunden.');
        return;
    }

    if (!isExternalAnalysisConsentEnabled()) {
        renderStoredDataWithoutConsent(record, message, container);
        return;
    }

    // Zustimmung erteilt: Jede Abfrage läuft über den Hintergrund.
    const fetchTasks = [];
    // Hängt einen Knoten nur an, wenn er Inhalt hat (deckt den früheren
    // Namensfehler "syncFragment is not defined" ab).
    const syncFragment = (node) => appendIfNotEmpty(container, node);

    if (hasAttachments) {
        for (const att of attachments) {
            if (!att || typeof att !== 'object') continue;
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
        processRecordLinks(links, message.headerMessageId, syncFragment, fetchTasks);
    }

    if (fetchTasks.length > 0) {
        await Promise.all(fetchTasks.map(async task => {
            const taskFragment = document.createDocumentFragment();
            await task(taskFragment);
            syncFragment(taskFragment);
        }));
    }
}

// ---------------------------------------------------------------------------
// Ohne Zustimmung: gespeicherte Daten und manuelle Aktionen
// ---------------------------------------------------------------------------

// Stellt ausschließlich lokal vorhandene Daten dar und bietet die manuellen
// Aktionen an. Ohne Zustimmung wird nichts an einen Anbieter übertragen.
function renderStoredDataWithoutConsent(record, message, container) {
    if (!container) return;

    if (!isExternalAnalysisConsentEnabled()) {
        appendConsentNotice(container);
    }

    const attachments = (record && Array.isArray(record.attachments)) ? record.attachments : [];
    const links = (record && Array.isArray(record.links)) ? record.links : [];

    for (const att of attachments) {
        if (att && typeof att === 'object') {
            renderStoredAttachmentCard(att, message, container);
        }
    }

    for (const link of links) {
        if (link && typeof link === 'object') {
            renderStoredLinkCard(link, message, container);
        }
    }
}

function renderStoredAttachmentCard(att, message, container) {
    const hash = att.hybrid_sha256 || '';
    const safeHash = escapeHTML(hash);

    const card = document.createElement('div');
    card.className = 'card card-info mb-3';
    card.id = `stored-attachment-${safeHash}`;
    card.setAttribute('role', 'status');

    card.appendChild(createEl('h2', '', `Anhang: ${att.attachment_name || 'Unbekannt'}`));
    card.appendChild(createEl('p', '', `SHA-256: ${hash || 'N/A'}`));
    card.appendChild(createEl('p', '', `Status: ${att.state || 'UNKNOWN'}`));
    if (att.virustotal_stats && typeof att.virustotal_stats === 'object') {
        renderVirusTotalStats(att.virustotal_stats, card);
    }
    card.appendChild(createEl('p', 'text-warning', CONSENT_REQUIRED_NOTE));
    container.appendChild(card);

    createUploadButton(card, {
        hash: hash,
        safeHash: safeHash,
        attachmentName: att.attachment_name,
        messageId: message.id,
        partName: att.partName,
        headerMessageId: message.headerMessageId
    });
    createCdrButton(card, safeHash, att.attachment_name, message.id, att.partName);
}

function renderStoredLinkCard(link, message, container) {
    const card = document.createElement('div');
    card.className = 'card card-info mb-3';
    card.setAttribute('role', 'status');

    card.appendChild(createEl('h2', '', `URL: ${link.url || 'Unbekannt'}`));
    card.appendChild(createEl('p', '', `Status: ${link.state || 'UNKNOWN'}`));
    if (link.hybrid_sha256) {
        card.appendChild(createEl('p', '', `SHA-256: ${link.hybrid_sha256}`));
    }
    card.appendChild(createEl('p', 'text-warning', CONSENT_REQUIRED_NOTE));
    container.appendChild(card);

    createUrlScanButton(card, link.url, message.headerMessageId);
}

// Erzeugt eine sichere, eindeutige ID für eine URL.
function computeUrlId(url) {
    const u8 = new TextEncoder().encode(url || '');
    // ⚡ Bolt Optimization: Use a pre-allocated array and .join() to avoid string concatenation overhead.
    const hex = new Array(u8.length);
    for (let j = 0; j < u8.length; j++) hex[j] = byteToHex[u8[j]];
    return hex.join('');
}

// Erzeugt den manuellen URL-Scan-Button samt Statuszeile innerhalb einer Karte.
function createUrlScanButton(card, url, headerMessageId) {
    const urlId = computeUrlId(url);

    const btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${urlId}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = "URL jetzt scannen";
    btnUpload.setAttribute('aria-describedby', `upload-status-${urlId}`);
    card.appendChild(btnUpload);

    const pStatus = document.createElement('p');
    pStatus.id = `upload-status-${urlId}`;
    pStatus.className = "mt-2";
    pStatus.setAttribute('aria-live', 'polite');
    pStatus.setAttribute('role', 'status');
    card.appendChild(pStatus);

    btnUpload.addEventListener('click', function() {
        handleUrlScanClick(this, url, urlId, headerMessageId);
    });

    return urlId;
}

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

const hybrid_report_cache = new Map();

// Kein direkter Netzwerkzugriff im Popup: Der Hintergrund prüft Zustimmung und
// Host-Berechtigung und antwortet mit
//   { status: 'success', data: <Provider-JSON> }
// oder
//   { status: 'error', code: 'EXTERNAL_ANALYSIS_DISABLED' | 'permission_denied' |
//     'no_api_key' | 'http_<code>' | 'network_error', message: '<lokalisierter Text>' }.
async function fetch_hybrid_report({ hybrid_sha, attachmentName, messageId, partName, headerMessageId }) {
    if (hybrid_report_cache.has(hybrid_sha)) {
        return hybrid_report_cache.get(hybrid_sha);
    }

    const requestPromise = requestHybridOverview({ hybrid_sha, attachmentName, messageId, partName, headerMessageId });

    hybrid_report_cache.set(hybrid_sha, requestPromise);
    return requestPromise;
}

async function requestHybridOverview({ hybrid_sha, attachmentName, messageId, partName, headerMessageId }) {
    try {
        const response = await browser.runtime.sendMessage({
            action: 'getHybridOverview',
            sha256: hybrid_sha,
            headerMessageId: headerMessageId,
            attachmentName: attachmentName,
            partName: partName
        });

        if (!response || typeof response !== 'object' || typeof response.status !== 'string') {
            hybrid_report_cache.delete(hybrid_sha);
            return { status: 'error', code: 'network_error', message: 'Unerwartete Antwort des Hintergrunddienstes.' };
        }

        if (response.status !== 'success') {
            hybrid_report_cache.delete(hybrid_sha);
        }

        return response;
    } catch (error) {
        hybrid_report_cache.delete(hybrid_sha);
        throw error;
    }
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

const ERROR_CODES_WITH_SETTINGS_BUTTON = ['permission_denied', 'no_api_key', 'http_401', 'http_403'];

// Baut den Fehlertext aus dem Antwortvertrag des Hintergrunds. attachmentName
// bleibt der lokale Dateiname; es werden keine URLs protokolliert.
function buildAnalysisErrorMessage(code, message, attachmentName) {
    const target = attachmentName ? ` für Element ${attachmentName}` : '';
    let base = message;

    if (!base) {
        if (code === 'permission_denied') {
            base = 'Keine Berechtigung für die externe Analyse';
        } else if (code === 'no_api_key') {
            base = 'Kein API-Schlüssel für den Analyse-Dienst im Add-on hinterlegt';
        } else if (code === 'network_error') {
            base = 'Netzwerkfehler bei der Abfrage des Analyse-Dienstes';
        } else if (/^http_\d+$/.test(code)) {
            base = `API Error: ${code.slice(5)}`;
        } else {
            base = `Analyse nicht möglich (${code})`;
        }
    }

    if (code === 'permission_denied' && !message) {
        return `${base}${target}. Bitte erteilen Sie dem Add-on die Host-Berechtigung für den Analyse-Dienst.`;
    }

    if (code === 'no_api_key' || code === 'http_401' || code === 'http_403') {
        return `${base}${target} (Möglicherweise ungültiger oder fehlender API-Schlüssel).`;
    }

    return `${base}${target}.`;
}

function handle_hybrid_report_error(errorResponse, attachmentName, targetContainer) {
    const code = (errorResponse && errorResponse.code) ? String(errorResponse.code) : 'unknown_error';
    // Nur der Fehlercode wird protokolliert - keine URLs, keine Empfängerdaten.
    console.error('Hybrid Analysis Abfrage fehlgeschlagen, Fehlercode:', code);

    const errDiv1 = document.createElement('div');
    errDiv1.className = 'alert-error';
    errDiv1.setAttribute('role', 'alert');

    const errMsg = document.createElement('span');
    errMsg.id = 'api-error-msg-key';
    errMsg.textContent = buildAnalysisErrorMessage(code, errorResponse && errorResponse.message, attachmentName);
    errDiv1.appendChild(errMsg);

    if (ERROR_CODES_WITH_SETTINGS_BUTTON.includes(code)) {
        const btnSettings = document.createElement('button');
        btnSettings.className = 'btn-primary mt-2 ml-2';
        btnSettings.textContent = 'Einstellungen öffnen';
        btnSettings.setAttribute('aria-describedby', 'api-error-msg-key');
        btnSettings.addEventListener('click', () => {
            browser.runtime.openOptionsPage();
        });
        errDiv1.appendChild(document.createElement('br'));
        errDiv1.appendChild(btnSettings);
    }

    toNodeSink(targetContainer || getPopupContainer())(errDiv1);
}

function handle_hybrid_report_fetch_error(error, attachmentName, targetContainer) {
    // Nur der Fehlername wird protokolliert, nicht die Meldung (kann URLs enthalten).
    console.error('Netzwerkfehler bei der Hybrid-Analysis-Abfrage:', (error && error.name) ? error.name : 'Error');
    const errDiv2 = document.createElement('div');
    errDiv2.className = 'alert-error';
    errDiv2.setAttribute('role', 'alert');
    errDiv2.textContent = `Netzwerkfehler: ${(error && error.message) ? error.message : 'Unbekannter Fehler'} für Element ${attachmentName}`;
    toNodeSink(targetContainer || getPopupContainer())(errDiv2);
}

async function get_hybrid_report_by_sha256({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats = null }, targetContainer) {
    const container = targetContainer || getPopupContainer();

    let response;
    try {
        response = await fetch_hybrid_report({ hybrid_sha, attachmentName, messageId, partName, headerMessageId });
    } catch (error) {
        handle_hybrid_report_fetch_error(error, attachmentName, container);
        return;
    }

    if (response && response.status === 'success') {
        // Die Detail-Felder des Provider-JSON dürfen fehlen.
        const json_data = (response.data && typeof response.data === 'object') ? response.data : {};
        render_hybrid_report_ui({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, json_data }, container);
        return;
    }

    const code = (response && response.code) ? String(response.code) : 'unknown_error';

    if (code === 'EXTERNAL_ANALYSIS_DISABLED') {
        // Der Hintergrund ist die maßgebliche Instanz: Die Zustimmung liegt nicht
        // (mehr) vor. Hinweis anzeigen - kein Retry, kein weiterer Aufruf.
        externalAnalysisConsent = false;
        appendConsentNotice(container, response && response.message);
        return;
    }

    handle_hybrid_report_error({ code, message: response && response.message }, attachmentName, container);
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
    // Nimmt sowohl einen Container als auch syncFragment (Sink) entgegen.
    const sink = toNodeSink(targetContainer || getPopupContainer());

    const card = document.createElement('div');
    card.className = "card card-info mb-3";
    card.id = `upload-container-${computeUrlId(url)}`;
    card.setAttribute('role', 'status');

    const h2 = document.createElement('h2');
    h2.textContent = `URL: ${url}`;
    card.appendChild(h2);

    const pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.appendChild(document.createTextNode("Diese URL wurde in der E-Mail gefunden. Aus Datenschutzgründen wurde sie "));
    const infoStrong = document.createElement('strong');
    infoStrong.textContent = "nicht automatisch hochgeladen";
    pInfo.appendChild(infoStrong);
    pInfo.appendChild(document.createTextNode("."));
    card.appendChild(pInfo);

    createUrlScanButton(card, url, headerMessageId);

    sink(card);
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

    // Nimmt sowohl einen Container als auch syncFragment (Sink) entgegen.
    toNodeSink(targetContainer || getPopupContainer())(card);
}
