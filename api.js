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
updateGridField("MessageHeaderID", message.headerMessageId, "(Keine ID)");

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
    consentP.id = 'consent-notice-msg';
    consentP.textContent = 'Externe Analyse ist nicht aktiviert: Es werden keine Hashes, Dateien oder Links an Analyse-Dienste übertragen.';
    consentCard.appendChild(consentP);

    let consentButton = document.createElement('button');
    consentButton.type = 'button';
    consentButton.className = 'btn-primary mt-2';
    consentButton.textContent = 'Einstellungen öffnen';
    consentButton.setAttribute('aria-describedby', 'consent-notice-msg');
    consentButton.addEventListener('click', () => browser.runtime.openOptionsPage());
    consentCard.appendChild(consentButton);

    apiContainer.appendChild(consentCard);
}

try {

    // Öffnen Sie die Datenbank
    let openRequest = indexedDB.open("thunderbird_av", 4);

    openRequest.onupgradeneeded = function (e) {
        let db = e.target.result;

        if (!db.objectStoreNames.contains('hybridanalysis')) {
            db.createObjectStore('hybridanalysis', { keyPath: 'messageHeader' });
        }
        // Same schema as db.js (version 4): local indicator index + case notes.
        if (!db.objectStoreNames.contains('iocs')) {
            const store = db.createObjectStore('iocs', { keyPath: 'key' });
            store.createIndex('value', 'value', { unique: false });
            store.createIndex('kind', 'kind', { unique: false });
            store.createIndex('messageHeader', 'messageHeader', { unique: false });
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
                        if (att.state === 'UNKNOWN') {
                            renderManualUploadUI(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId, liveContainer);
                        } else if (externalAnalysisConsent) {
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
                    if (externalAnalysisConsent) {
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

// Forscher-Ansicht erst laden, wenn feststeht, welche Nachricht offen ist.
if (message) {
    initResearchView(message.id);
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
    pVtMal.textContent = `Malicious: ${malCount}${malCount > 0 ? " (Gefährlich)" : ""}`;
    card.appendChild(pVtMal);

    const pVtUnd = document.createElement('p');
    pVtUnd.className = "ml-4";
    pVtUnd.textContent = `Undetected: ${virustotal_stats.undetected || 0}`;
    card.appendChild(pVtUnd);

    const pVtSus = document.createElement('p');
    const susCount = virustotal_stats.suspicious || 0;
    pVtSus.className = `ml-4 ${susCount > 0 ? "text-warning" : ""}`;
    pVtSus.textContent = `Suspicious: ${susCount}${susCount > 0 ? " (Verdächtig)" : ""}`;
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
    h2.textContent = `Lokales Ergebnis: ${name || 'Unbekannt'}`;
    card.appendChild(h2);

    const p = document.createElement('p');
    p.className = 'text-info';
    p.textContent = hash
        ? `SHA-256: ${hash} – keine externe Abfrage, da "Externe Analyse erlauben" ausgeschaltet ist.`
        : 'Keine externe Abfrage, da "Externe Analyse erlauben" ausgeschaltet ist.';
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
            const response = await fetch(options.url, options);
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
// ---------------------------------------------------------------------------
// Forscher-Ansicht (lokales Dossier)
//
// Alle Daten kommen aus dem Hintergrundskript (`getResearchDossier`) und werden
// dort ausschließlich lokal aus der geöffneten Nachricht abgeleitet. Das Popup
// rendert nur; Netzwerkzugriffe entstehen hier nicht. Exporte werden über den
// Download-Manager gespeichert (`saveResearchExport`).
// ---------------------------------------------------------------------------

const SEVERITY_LABELS = {
    critical: 'Kritisch',
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig',
    info: 'Info'
};

const VERDICT_LABELS = {
    clean: 'geprüft, keine Auffälligkeiten',
    unclear: 'unklar, bitte prüfen',
    suspicious: 'verdächtig',
    malicious: 'bösartige Indikatoren'
};

function severityForScore(score) {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
}

function createBadge(severity, text) {
    return createEl('span', 'thundy-badge thundy-badge--' + severity, text);
}

/** Baut eine zweispaltige Schlüssel/Wert-Liste (dl.thundy-kv). */
function createKeyValueList(rows) {
    const list = createEl('dl', 'thundy-kv');
    for (const [key, value] of rows) {
        if (value === undefined || value === null || value === '') continue;
        list.appendChild(createEl('dt', 'thundy-kv__key', key));
        const dd = createEl('dd', 'thundy-kv__value');
        if (value instanceof Node) {
            dd.appendChild(value);
        } else {
            dd.textContent = String(value);
        }
        list.appendChild(dd);
    }
    return list;
}

/** Baut eine kompakte Tabelle mit Kopfzeile. */
function createTable(headers, rows) {
    const table = createEl('table', 'thundy-table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const header of headers) {
        headRow.appendChild(createEl('th', '', header));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const row of rows) {
        const tr = document.createElement('tr');
        for (const cell of row) {
            const td = document.createElement('td');
            if (cell instanceof Node) td.appendChild(cell);
            else td.textContent = cell === undefined || cell === null ? '–' : String(cell);
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}

/** Kopierbarer Monospace-Wert (Hash, IOC, …). */
function createCopyableValue(value, label) {
    const wrapper = createEl('span', 'thundy-value-copy');
    wrapper.appendChild(createEl('code', 'thundy-mono', value));
    const button = createEl('button', 'thundy-copy', 'Kopieren');
    button.type = 'button';
    button.setAttribute('aria-label', (label || 'Wert') + ' kopieren');
    button.addEventListener('click', async () => {
        const ok = await writeToClipboard(value);
        button.textContent = ok ? 'Kopiert' : 'Fehlgeschlagen';
        setTimeout(() => { button.textContent = 'Kopieren'; }, 2000);
    });
    wrapper.appendChild(button);
    return wrapper;
}

async function writeToClipboard(text) {
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) { /* Fallback unten */ }
    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand && document.execCommand('copy');
        area.remove();
        return !!ok;
    } catch (e) {
        return false;
    }
}

function createSection(id, title, open = true) {
    const section = document.createElement('details');
    section.className = 'thundy-section';
    section.id = id;
    if (open) section.open = true;
    const summary = createEl('summary', 'thundy-section__summary', title);
    section.appendChild(summary);
    const body = createEl('div', 'thundy-section__body');
    section.appendChild(body);
    return { section, body };
}


/** Kopfbereich: Verdikt, Score, Zustimmung, Datenherkunft. */
function renderResearchVerdict(dossier) {
    const card = createEl('section', 'thundy-card');
    const header = createEl('div', 'thundy-card__header');
    header.appendChild(createEl('h2', 'thundy-card__title', 'Risikobewertung'));
    card.appendChild(header);
    const body = createEl('div', 'thundy-card__body');
    card.appendChild(body);

    const risk = dossier.risk || {};
    const severity = severityForScore(risk.score || 0);
    const verdictBox = createEl('div', 'thundy-verdict thundy-verdict--' + severity);
    verdictBox.appendChild(createEl('span', 'thundy-verdict__score', String(risk.score || 0)));
    verdictBox.appendChild(createEl('span', 'thundy-verdict__label',
        'von 100 – ' + (VERDICT_LABELS[risk.verdict] || risk.verdict || 'unbekannt')));
    body.appendChild(verdictBox);

    const bar = createEl('div', 'thundy-riskbar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', 'Risiko-Score ' + String(risk.score || 0) + ' von 100');
    const fill = createEl('div', 'thundy-riskbar__fill thundy-riskbar__fill--' + severity);
    fill.style.width = Math.max(0, Math.min(100, risk.score || 0)) + '%';
    bar.appendChild(fill);
    body.appendChild(bar);

    const chips = createEl('div', 'thundy-chip-row');
    chips.appendChild(createBadge(severity, SEVERITY_LABELS[severity]));
    if (risk.rawScore !== undefined && risk.rawScore > (risk.score || 0)) {
        chips.appendChild(createBadge('info', 'Rohsumme ' + risk.rawScore + ' (auf 100 begrenzt)'));
    }
    if (dossier.provenance) {
        chips.appendChild(createBadge(dossier.provenance.consentGiven ? 'low' : 'medium',
            dossier.provenance.consentGiven ? 'Externe Analyse erlaubt' : 'Externe Analyse aus'));
        chips.appendChild(createBadge('info', 'Datenschutz-Stufe: ' + (dossier.provenance.privacyTier || '–')));
        chips.appendChild(createBadge('info', 'lokal berechnet'));
    }
    body.appendChild(chips);

    body.appendChild(createKeyValueList([
        ['Erhoben am', new Date(dossier.generatedAt).toLocaleString('de-DE')],
        ['Nachrichtendatum', dossier.message && dossier.message.date ? new Date(dossier.message.date).toLocaleString('de-DE') : ''],
        ['Ordner', dossier.message ? dossier.message.folder : ''],
        ['Größe', dossier.message && dossier.message.size ? dossier.message.size + ' Bytes' : ''],
        ['Authentifizierung', risk.authStatus || '']
    ]));

    if (Array.isArray(risk.reasons) && risk.reasons.length > 0) {
        const list = createEl('ul', 'thundy-reason-list');
        for (const reason of risk.reasons) list.appendChild(createEl('li', '', reason));
        body.appendChild(list);
    }
    return card;
}


/** Risiko-Aufschlüsselung: welcher Regelbeitrag erklärt den Score. */
function renderResearchBreakdown(dossier) {
    const { section, body } = createSection('research-breakdown', 'Risiko-Aufschlüsselung');
    const breakdown = (dossier.risk && dossier.risk.breakdown) || [];
    if (breakdown.length === 0) {
        body.appendChild(createEl('p', 'thundy-empty', 'Keine Regel hat zum Score beigetragen.'));
        return section;
    }
    body.appendChild(createTable(
        ['Regel', 'Punkte', 'Begründung'],
        breakdown.map((rule) => [
            rule.label || rule.id,
            (rule.points > 0 ? '+' : '') + String(rule.points),
            (rule.reasons || []).join(' ') || '–'
        ])
    ));
    body.appendChild(createEl('p', 'thundy-note thundy-note--info',
        'Die Punkte sind die Beiträge der lokalen Regeln; angezeigt wird der auf 100 begrenzte Score.'));
    return section;
}

/** Header-Forensik: Authentifizierung, Received-Kette, Sicherheits-Header. */
function renderResearchHeaders(dossier) {
    const { section, body } = createSection('research-headers', 'Header-Forensik');
    const auth = dossier.authentication || {};
    const sender = dossier.sender || {};
    const securityHeaders = dossier.securityHeaders || {};

    body.appendChild(createKeyValueList([
        ['Absender', sender.address || ''],
        ['Anzeigename', sender.displayName || ''],
        ['Antwortadresse (Reply-To)', sender.replyTo || ''],
        ['Reply-To weicht ab', sender.replyToMismatch ? 'ja' : 'nein'],
        ['Anzeigename ≠ Adresse', sender.displayNameMismatch ? 'ja' : 'nein'],
        ['Erstkontakt', sender.firstContact ? 'ja' : 'nein'],
        ['SPF', auth.spf || 'nicht im Header'],
        ['DKIM', (auth.dkim || []).join(', ') || 'nicht im Header'],
        ['DMARC', auth.dmarc || 'nicht im Header'],
        ['Rückpfad (Return-Path)', securityHeaders.returnPath || ''],
        ['Message-ID', securityHeaders.messageId || ''],
        ['X-Mailer', securityHeaders.xMailer || ''],
        ['List-Unsubscribe', securityHeaders.listUnsubscribe || '']
    ]));

    if (auth.spoofingSuspect) {
        body.appendChild(createEl('p', 'thundy-note thundy-note--critical',
            'Mindestens eine Authentifizierungsprüfung (SPF/DKIM/DMARC) ist fehlgeschlagen – typisch für Spoofing.'));
    }

    const hops = dossier.receivedChain || [];
    if (hops.length > 0) {
        body.appendChild(createEl('h3', 'thundy-subtitle', 'Received-Kette (' + hops.length + ' Hops)'));
        body.appendChild(createTable(
            ['#', 'von', 'an', 'IP', 'Protokoll', 'Zeit', 'Verzögerung'],
            hops.map((hop) => [
                String(hop.index + 1),
                hop.from || '–',
                hop.by || '–',
                hop.ip || '–',
                hop.protocol || '–',
                hop.timestamp ? new Date(hop.timestamp).toLocaleString('de-DE') : '–',
                hop.delaySeconds === undefined ? '–'
                    : hop.delaySeconds + ' s' + (hop.delaySuspicious ? ' ⚠ ungewöhnlich' : '')
            ])
        ));
    }
    return section;
}


/** Anhang-Forensik: Hash, Typ, Größe, Risikokennzeichnung. */
function renderResearchAttachments(dossier) {
    const { section, body } = createSection('research-attachments', 'Anhang-Forensik');
    const attachments = dossier.attachments || [];
    if (attachments.length === 0) {
        body.appendChild(createEl('p', 'thundy-empty', 'Keine Anhänge in dieser Nachricht.'));
        return section;
    }
    const rows = attachments.map((attachment) => {
        const nameCell = createEl('span', '', attachment.name || '(ohne Namen)');
        if (attachment.riskyExtension) {
            nameCell.appendChild(createBadge('high', 'riskant'));
        }
        if (attachment.archive) {
            nameCell.appendChild(createBadge('medium', 'Archiv'));
        }
        const stateCell = createEl('span', 'thundy-chip-row');
        if (attachment.hybridState) {
            const stateSeverity = attachment.hybridState === 'KNOWN' ? 'info' : 'low';
            stateCell.appendChild(createBadge(stateSeverity,
                'Hybrid Analysis: ' + attachment.hybridState + (attachment.stateSource === 'stored' ? ' (gespeichert)' : '')));
        }
        if (attachment.hybridJobId) {
            stateCell.appendChild(createEl('code', 'thundy-mono', attachment.hybridJobId));
        }
        if (attachment.virustotalStats && typeof attachment.virustotalStats.malicious === 'number') {
            const malicious = attachment.virustotalStats.malicious;
            stateCell.appendChild(createBadge(malicious > 0 ? 'high' : 'low',
                'VirusTotal: ' + malicious + ' Treffer'));
        }
        if (stateCell.childNodes.length === 0) {
            stateCell.appendChild(createEl('span', 'thundy-muted', 'nicht analysiert'));
        }
        return [
            nameCell,
            attachment.contentType || '–',
            attachment.size !== undefined && attachment.size !== null ? attachment.size + ' B' : '–',
            attachment.sha256 ? createCopyableValue(attachment.sha256, 'SHA-256') : 'nicht gehasht',
            stateCell
        ];
    });
    body.appendChild(createTable(['Datei', 'MIME-Typ', 'Größe', 'SHA-256', 'Anbieter-Status'], rows));
    return section;
}

/** Link-Anatomie: Domain, TLD, Punycode, Tracker, Kurz-URLs. */
function renderResearchLinks(dossier) {
    const { section, body } = createSection('research-links', 'Link-Anatomie');
    const links = dossier.links || [];
    if (links.length === 0) {
        body.appendChild(createEl('p', 'thundy-empty', 'Keine Links in dieser Nachricht.'));
        return section;
    }
    body.appendChild(createTable(
        ['Host', 'Domain', 'TLD', 'Hinweise'],
        links.map((link) => {
            const hints = createEl('span', 'thundy-chip-row');
            if (link.isHttps === false) hints.appendChild(createBadge('medium', 'kein HTTPS'));
            if (link.isPunycode) hints.appendChild(createBadge('high', 'Punycode/Homoglyph'));
            if (link.brandLookalike) hints.appendChild(createBadge('high', 'ähnelt ' + link.brandLookalike));
            if (link.isShortener) hints.appendChild(createBadge('medium', 'Kurz-URL'));
            if (link.hasCredentials) hints.appendChild(createBadge('critical', 'Zugangsdaten in URL'));
            if (link.urlhausMatch) hints.appendChild(createBadge('high', 'URLhaus-Treffer'));
            if (link.hybridState) {
                hints.appendChild(createBadge('info',
                    'Hybrid Analysis: ' + link.hybridState + (link.stateSource === 'stored' ? ' (gespeichert)' : '')));
            }
            if ((link.trackingParameters || []).length > 0) {
                hints.appendChild(createBadge('info', 'Tracking: ' + link.trackingParameters.join(', ')));
            }
            if (hints.childNodes.length === 0) hints.appendChild(createEl('span', 'thundy-muted', 'keine Auffälligkeit'));
            return [link.host || '–', link.registrableDomain || '–', link.tld || '–', hints];
        })
    ));
    return section;
}


/** IOC-Block: URLs, Domains, IPs, Hashes, Adressen – kopierbar. */
function renderResearchIocs(dossier) {
    const { section, body } = createSection('research-iocs', 'Indikatoren (IOC)');
    const iocs = dossier.iocs || {};
    const groups = [
        ['URLs', iocs.urls || []],
        ['Domains', iocs.domains || []],
        ['IP-Adressen', iocs.ips || []],
        ['Hashes (SHA-256)', iocs.hashes || []],
        ['E-Mail-Adressen', iocs.emails || []]
    ];
    const bucketKinds = { 'URLs': 'urls', 'Domains': 'domains', 'IP-Adressen': 'ips', 'Hashes (SHA-256)': 'hashes', 'E-Mail-Adressen': 'emails' };
    const pivotContainer = createEl('div', 'thundy-pivot-results');
    pivotContainer.id = 'pivot-results';
    pivotContainer.setAttribute('aria-live', 'polite');
    let total = 0;
    for (const [label, values] of groups) {
        const bucketKind = bucketKinds[label] || null;
        if (values.length === 0) continue;
        total += values.length;
        body.appendChild(createEl('h3', 'thundy-subtitle', label + ' (' + values.length + ')'));
        const list = createEl('div', 'thundy-ioc-list');
        for (const value of values.slice(0, 25)) {
            list.appendChild(createCopyableValue(value, label));
            const pivotButton = createEl('button', 'thundy-copy', 'Pivot');
            pivotButton.type = 'button';
            pivotButton.title = 'Andere Nachrichten mit diesem Indikator suchen (lokal)';
            pivotButton.setAttribute('aria-label', 'Pivot für ' + value + ' starten');
            pivotButton.addEventListener('click', () => { runIndicatorPivot(value, bucketKind, pivotContainer); });
            list.appendChild(pivotButton);
        }
        if (values.length > 25) {
            list.appendChild(createEl('p', 'thundy-muted', '… ' + (values.length - 25) + ' weitere im Export'));
        }
        body.appendChild(list);
    }
    if (total === 0) {
        body.appendChild(createEl('p', 'thundy-empty', 'Keine Indikatoren erkannt.'));
    } else {
        body.appendChild(createEl('p', 'thundy-muted',
            'Pivot durchsucht den lokalen Index (nur Nachrichten, die dieses Add-on bereits gescannt hat).'));
    }
    body.appendChild(pivotContainer);
    return section;
}

/**
 * Pivot: zeigt, in welchen anderen Nachrichten ein Indikator vorkommt.
 * Rein lokal (Indikator-Index im Hintergrundskript).
 */
async function runIndicatorPivot(value, kind, container) {
    if (!container) return;
    container.textContent = '';
    container.appendChild(createEl('p', 'thundy-muted', 'Suche nach „' + value + '“ im lokalen Index …'));
    try {
        const response = await browser.runtime.sendMessage({ action: 'pivotIndicator', value: value, kind: kind || null });
        if (!response || response.status !== 'success') {
            throw new Error(response && response.message ? response.message : 'Pivot fehlgeschlagen');
        }
        renderPivotResults(response.data, container);
    } catch (e) {
        container.textContent = '';
        container.appendChild(createEl('p', 'thundy-note thundy-note--warn', 'Pivot nicht möglich: ' + e.message));
    }
}

function renderPivotResults(result, container) {
    container.textContent = '';
    if (!result.matches || result.matches.length === 0) {
        container.appendChild(createEl('p', 'thundy-empty',
            'Dieser Indikator kommt in keiner anderen erfassten Nachricht vor (Datenbasis: lokal indexierte Scans).'));
        return;
    }
    container.appendChild(createEl('p', 'thundy-note thundy-note--info',
        result.matches.length + ' Nachricht(en) mit diesem Indikator (lokal, neueste zuerst):'));
    container.appendChild(createTable(
        ['Betreff', 'Datum', 'Verdikt', 'Score', 'Art', 'Aktion'],
        result.matches.map((match) => {
            const openButton = createEl('button', 'thundy-copy', 'Öffnen');
            openButton.type = 'button';
            openButton.addEventListener('click', async () => {
                try {
                    if (browser.messageDisplay && typeof browser.messageDisplay.open === 'function' && match.messageHeader) {
                        await browser.messageDisplay.open({ headerMessageId: match.messageHeader });
                    }
                } catch (e) {
                    openButton.textContent = 'Nicht möglich';
                }
            });
            const verdictSeverity = match.verdict === 'malicious' ? 'critical'
                : (match.verdict === 'suspicious' ? 'high' : (match.verdict === 'unclear' ? 'medium' : 'low'));
            const verdictCell = createEl('span', 'thundy-chip-row');
            verdictCell.appendChild(createBadge(verdictSeverity, VERDICT_LABELS[match.verdict] || match.verdict || 'unbekannt'));
            return [
                match.subject || '(ohne Betreff)',
                match.date ? new Date(match.date).toLocaleString('de-DE') : '–',
                verdictCell,
                String(match.score || 0),
                (match.kinds || []).join(', '),
                openButton
            ];
        })
    ));
}

function renderResearchMitre(dossier) {
    const { section, body } = createSection('research-mitre', 'MITRE ATT&CK (heuristisch)');
    const techniques = dossier.mitre || [];
    body.appendChild(createEl('p', 'thundy-note thundy-note--warn',
        'Heuristische Zuordnung lokaler Indikatoren zu MITRE-ATT&CK-Techniken. Das ist kein Nachweis eines Angriffs und keine Attribuierung.'));
    if (techniques.length === 0) {
        body.appendChild(createEl('p', 'thundy-empty', 'Keine Techniken aus den lokalen Indikatoren abgeleitet.'));
        return section;
    }
    body.appendChild(createTable(
        ['ID', 'Technik', 'Taktik', 'Belegindikator'],
        techniques.map((technique) => [
            technique.id,
            technique.name,
            technique.tactic,
            (technique.evidence || []).join('; ') || '–'
        ])
    ));
    return section;
}

/** Zeitleiste: Nachrichtendatum, Received-Hops, lokale Bewertung. */
function renderResearchTimeline(dossier) {
    const { section, body } = createSection('research-timeline', 'Zeitleiste', false);
    const entries = dossier.timeline || [];
    if (entries.length === 0) {
        body.appendChild(createEl('p', 'thundy-empty', 'Keine Zeitangaben verfügbar.'));
        return section;
    }
    body.appendChild(createTable(
        ['Zeitpunkt', 'Ereignis', 'Detail'],
        entries.map((entry) => [
            new Date(entry.at).toLocaleString('de-DE'),
            entry.event,
            entry.detail || '–'
        ])
    ));
    return section;
}



/** Reiter „Übersicht“ / „Forscher“. */
function createResearchTabs(onSelect) {
    const tabs = createEl('div', 'thundy-tabs');
    tabs.setAttribute('role', 'tablist');
    const definitions = [
        { id: 'overview', label: 'Übersicht' },
        { id: 'research', label: 'Forscher' }
    ];
    const buttons = new Map();
    for (const definition of definitions) {
        const button = createEl('button', 'thundy-tab', definition.label);
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.dataset.tab = definition.id;
        button.addEventListener('click', () => {
            for (const [id, other] of buttons) {
                const active = id === definition.id;
                other.classList.toggle('thundy-tab--active', active);
                other.setAttribute('aria-selected', active ? 'true' : 'false');
            }
            onSelect(definition.id);
        });
        buttons.set(definition.id, button);
        tabs.appendChild(button);
    }
    return { tabs, buttons };
}

/** CSV-Export der wichtigsten Dossier-Felder (Excel-freundlich, Semikolon). */
function buildDossierCsv(dossier) {
    const escape = (value) => '"' + String(value === undefined || value === null ? '' : value).replace(/"/g, '""') + '"';
    const lines = [];
    lines.push(['Kategorie', 'Feld', 'Wert'].map(escape).join(';'));
    const push = (category, field, value) => lines.push([category, field, value].map(escape).join(';'));

    const message = dossier.message || {};
    push('Nachricht', 'Betreff', message.subject);
    push('Nachricht', 'Datum', message.date);
    push('Nachricht', 'Absender', dossier.sender && dossier.sender.address);
    push('Nachricht', 'Reply-To', dossier.sender && dossier.sender.replyTo);
    push('Bewertung', 'Score', dossier.risk && dossier.risk.score);
    push('Bewertung', 'Rohsumme', dossier.risk && dossier.risk.rawScore);
    push('Bewertung', 'Verdikt', dossier.risk && dossier.risk.verdict);

    for (const rule of (dossier.risk && dossier.risk.breakdown) || []) {
        push('Regel', rule.label || rule.id,
            (rule.points > 0 ? '+' : '') + rule.points + ' – ' + (rule.reasons || []).join(' '));
    }
    for (const attachment of dossier.attachments || []) {
        push('Anhang', attachment.name, attachment.sha256 || 'kein Hash');
    }
    for (const link of dossier.links || []) {
        push('Link', link.host, link.registrableDomain);
    }
    const iocs = dossier.iocs || {};
    for (const [bucket, values] of Object.entries(iocs)) {
        for (const value of values || []) push('IOC:' + bucket, value, '');
    }
    for (const technique of dossier.mitre || []) {
        push('MITRE', technique.id + ' ' + technique.name, (technique.evidence || []).join('; '));
    }
    return lines.join('\r\n') + '\r\n';
}

/** Minimales STIX-2.1-Bundle mit den IOCs des Dossiers (offline erzeugt). */
function buildDossierStix(dossier) {
    const now = new Date().toISOString();
    const objects = [];
    const identityId = 'identity--thundy-av-local';
    objects.push({
        type: 'identity',
        spec_version: '2.1',
        id: identityId,
        created: now,
        modified: now,
        name: 'Thundy AV (local analysis)',
        identity_class: 'tool'
    });
    const iocs = dossier.iocs || {};
    let counter = 0;
    const addPattern = (pattern, kind) => {
        counter += 1;
        objects.push({
            type: 'indicator',
            spec_version: '2.1',
            id: 'indicator--thundy-' + kind + '-' + counter,
            created: now,
            modified: now,
            created_by_ref: identityId,
            name: 'Thundy AV observed ' + kind,
            pattern: pattern,
            pattern_type: 'stix',
            valid_from: now,
            labels: ['thundy-av', 'heuristic']
        });
    };
    const quote = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    for (const url of (iocs.urls || []).slice(0, 50)) addPattern("[url:value = '" + quote(url) + "']", 'url');
    for (const domain of (iocs.domains || []).slice(0, 50)) addPattern("[domain-name:value = '" + quote(domain) + "']", 'domain');
    for (const ip of (iocs.ips || []).slice(0, 50)) addPattern("[ipv4-addr:value = '" + quote(ip) + "']", 'ipv4');
    for (const hash of (iocs.hashes || []).slice(0, 50)) addPattern("[file:hashes.'SHA-256' = '" + quote(hash) + "']", 'file');
    for (const email of (iocs.emails || []).slice(0, 50)) addPattern("[email-addr:value = '" + quote(email) + "']", 'email');
    return JSON.stringify({
        type: 'bundle',
        id: 'bundle--thundy-av-local',
        objects: objects
    }, null, 2);
}

/** Speichert einen Export über den Hintergrund (Download-Manager). */
async function saveResearchExport(kind, dossier) {
    const now = new Date().toISOString().slice(0, 10);
    let payload;
    if (kind === 'csv') {
        payload = { filename: 'thundy-av-' + now + '.csv', content: buildDossierCsv(dossier), mimeType: 'text/csv' };
    } else if (kind === 'stix') {
        payload = { filename: 'thundy-av-stix-' + now + '.json', content: buildDossierStix(dossier), mimeType: 'application/json' };
    } else {
        payload = { filename: 'thundy-av-' + now + '.json', content: JSON.stringify(dossier, null, 2), mimeType: 'application/json' };
    }
    const response = await browser.runtime.sendMessage(Object.assign({ action: 'saveResearchExport' }, payload));
    if (!response || response.status !== 'success') {
        throw new Error(response && response.message ? response.message : 'Export fehlgeschlagen');
    }
    return response.data;
}

/** Kopiert alle IOCs als Textblock in die Zwischenablage. */
function formatIocsAsText(dossier) {
    const iocs = dossier.iocs || {};
    const lines = [];
    const labels = { urls: 'URLs', domains: 'Domains', ips: 'IP-Adressen', hashes: 'SHA-256', emails: 'E-Mail-Adressen' };
    for (const [bucket, label] of Object.entries(labels)) {
        const values = iocs[bucket] || [];
        if (values.length === 0) continue;
        lines.push('# ' + label);
        for (const value of values) lines.push(value);
        lines.push('');
    }
    return lines.join('\n').trim();
}


/** Baut die Forscher-Ansicht aus dem Dossier. */
function renderResearchDossier(dossier) {
    const root = document.getElementById('research-root');
    if (!root) return;
    root.textContent = '';

    const tabs = createResearchTabs((selected) => {
        const overview = document.getElementById('report-root');
        if (overview) overview.classList.toggle('thundy-hidden', selected !== 'overview');
        root.classList.toggle('thundy-hidden', selected !== 'research');
    });
    root.appendChild(tabs.tabs);
    tabs.buttons.get('research').classList.add('thundy-tab--active');
    tabs.buttons.get('research').setAttribute('aria-selected', 'true');

    const container = createEl('div', 'thundy-research__content');
    container.appendChild(renderResearchVerdict(dossier));
    container.appendChild(renderResearchBreakdown(dossier));
    container.appendChild(renderResearchHeaders(dossier));
    container.appendChild(renderResearchAttachments(dossier));
    container.appendChild(renderResearchLinks(dossier));
    container.appendChild(renderResearchIocs(dossier));
    container.appendChild(renderResearchMitre(dossier));
    container.appendChild(renderResearchTimeline(dossier));
    root.appendChild(container);

    // Reiter „Übersicht“ ist beim Öffnen aktiv; die Forscheransicht hängt direkt darunter.
    const overview = document.getElementById('report-root');
    if (overview) overview.classList.remove('thundy-hidden');
}

async function requestResearchDossier(messageId) {
    const response = await browser.runtime.sendMessage({ action: 'getResearchDossier', messageId: messageId });
    if (!response || response.status !== 'success') {
        throw new Error(response && response.message ? response.message : 'Dossier konnte nicht erstellt werden');
    }
    return response.data;
}

let currentResearchDossier = null;

/**
 * Reiter „Übersicht“ / „Forscher“ benötigen denselben Toolbar-Bereich; der
 * STIX-Export-Knopf wird hier ergänzt, damit die Exportleiste vollständig ist,
 * auch wenn das Markup (noch) keinen eigenen Knopf vorsieht.
 */
function ensureStixExportButton() {
    if (document.getElementById('btn-export-stix')) return;
    const csvButton = document.getElementById('btn-export-csv');
    if (!csvButton || !csvButton.parentNode) return;
    const button = createEl('button', 'btn-primary', 'STIX-Bundle exportieren');
    button.type = 'button';
    button.id = 'btn-export-stix';
    csvButton.parentNode.insertBefore(button, csvButton.nextSibling);
}

/** Lädt das Dossier, rendert die Forscheransicht und verdrahtet die Exporte. */
async function initResearchView(messageId) {
    const root = document.getElementById('research-root');
    const statusEl = document.getElementById('status_message');
    ensureStixExportButton();
    try {
        const dossier = await requestResearchDossier(messageId);
        currentResearchDossier = dossier;
        renderResearchDossier(dossier);
        const exportJson = document.getElementById('btn-export-json');
        if (exportJson) exportJson.addEventListener('click', async () => {
            try {
                const result = await saveResearchExport('json', currentResearchDossier);
                if (statusEl) statusEl.textContent = 'Export gespeichert: ' + result.filename;
            } catch (e) {
                if (statusEl) statusEl.textContent = 'Export fehlgeschlagen: ' + e.message;
            }
        });
        const exportCsv = document.getElementById('btn-export-csv');
        if (exportCsv) exportCsv.addEventListener('click', async () => {
            try {
                const result = await saveResearchExport('csv', currentResearchDossier);
                if (statusEl) statusEl.textContent = 'CSV gespeichert: ' + result.filename;
            } catch (e) {
                if (statusEl) statusEl.textContent = 'CSV-Export fehlgeschlagen: ' + e.message;
            }
        });
        const copyIocs = document.getElementById('btn-copy-iocs');
        if (copyIocs) copyIocs.addEventListener('click', async () => {
            const ok = await writeToClipboard(formatIocsAsText(currentResearchDossier));
            if (statusEl) statusEl.textContent = ok ? 'IOC-Liste kopiert.' : 'Kopieren fehlgeschlagen.';
        });
        const exportStix = document.getElementById('btn-export-stix');
        if (exportStix) exportStix.addEventListener('click', async () => {
            try {
                const result = await saveResearchExport('stix', currentResearchDossier);
                if (statusEl) statusEl.textContent = 'STIX-Bundle gespeichert: ' + result.filename;
            } catch (e) {
                if (statusEl) statusEl.textContent = 'STIX-Export fehlgeschlagen: ' + e.message;
            }
        });    } catch (e) {
        if (root) {
            root.textContent = '';
            root.appendChild(createEl('p', 'thundy-note thundy-note--warn',
                'Forscheransicht nicht verfügbar: ' + e.message));
        }
    }
}

