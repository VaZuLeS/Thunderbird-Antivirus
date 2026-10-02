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

// 1.7: Datensparsamkeits-Schalter aus den Einstellungen. Ist er false, zeigt die
// Link-Tabelle nur den Host statt der vollstaendigen URL (analog zum Report).
let reportIncludeUrls = true;

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
const settings = await browser.storage.local.get(['externalAnalysisConsent', 'reportIncludeUrls']);
externalAnalysisConsent = settings && settings.externalAnalysisConsent === true;
reportIncludeUrls = !settings || settings.reportIncludeUrls !== false;
try {
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.externalAnalysisConsent) {
            externalAnalysisConsent = changes.externalAnalysisConsent.newValue === true;
        }
    });
} catch (e) { /* storage.onChanged is optional in tests */ }

// 1.7: Kopfzeile, Link-Tabelle und Admin-Bericht initial aufbauen. Bewusst vor
// dem "keine Nachricht"-Abbruch, damit der neutrale Zustand ("nicht bewertet")
// immer sichtbar ist und nie faelschlich "clean" erscheint.
initializeThreatPanel({ messageId: message ? message.id : null });

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

            // 1.7: gespeicherte Bedrohungsstufe und Link-Verdikte anzeigen.
            renderThreatPanelFromRecord(record);

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

// ===========================================================================
// 1.7 - Bedrohungsstufe, Link-Verdikte und Admin-Bericht im Popup
//
// Sicherheitsregel: Eine Nachricht ohne gespeicherte Bewertung wird NIEMALS als
// "clean"/gruen dargestellt. Fehlt der Score, zeigt der Kopf "Nicht bewertet"
// mit neutraler (grauer) Farbe. Die Engine ThundyLinkGate wird nur benutzt,
// wenn sie geladen ist (Feature-Detection); sonst greift eine lokale Kopie der
// Farb-/Label-Zuordnung (identisch zu link_gate.js).
// ===========================================================================

// Lokaler Fallback der Stil-Zuordnung. Absichtlich identisch zu LEVEL_STYLES in
// link_gate.js, damit das Popup auch ohne geladene Engine korrekt aussieht.
const POPUP_LEVEL_STYLE_FALLBACK = {
    clean: { color: '#145c14', background: '#e6ffe6', border: '#2e8b2e', icon: '\uD83D\uDFE2', labelKey: 'bannerLevelClean', labelFallback: 'Clean' },
    low: { color: '#4d6b00', background: '#f6ffe6', border: '#8ebe2d', icon: '\uD83D\uDFE2', labelKey: 'bannerLevelLow', labelFallback: 'Low' },
    medium: { color: '#7a5200', background: '#fff6e6', border: '#f0a500', icon: '\uD83D\uDFE1', labelKey: 'bannerLevelMedium', labelFallback: 'Medium' },
    high: { color: '#8a3400', background: '#fff0e6', border: '#e8620c', icon: '\uD83D\uDFE0', labelKey: 'bannerLevelHigh', labelFallback: 'High' },
    critical: { color: '#8a1010', background: '#ffeeee', border: '#c81e1e', icon: '\uD83D\uDD34', labelKey: 'bannerLevelCritical', labelFallback: 'Critical' }
};

// Neutraler Zustand fuer "nicht bewertet" - bewusst grau, nie gruen.
const POPUP_UNKNOWN_LEVEL_STYLE = {
    color: '#444444', background: '#f0f0f0', border: '#999999', icon: '\u2753',
    labelKey: 'bannerLevelUnknown', labelFallback: 'Nicht bewertet'
};

function getLinkGateEngine() {
    try {
        if (typeof ThundyLinkGate !== 'undefined' && ThundyLinkGate) return ThundyLinkGate;
    } catch (e) { /* Engine nicht geladen */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.ThundyLinkGate) return globalThis.ThundyLinkGate;
    } catch (e) { /* Engine nicht geladen */ }
    return null;
}

// i18n mit deutschem Fallback: fehlt browser.i18n oder der Schluessel, bleibt
// der uebergebene Text stehen. Wirft nie.
function popupI18nMessage(key, fallback, substitutions) {
    try {
        if (typeof browser !== 'undefined' && browser && browser.i18n && typeof browser.i18n.getMessage === 'function') {
            const value = browser.i18n.getMessage(key, substitutions);
            if (value) return value;
        }
    } catch (e) { /* Fallback unten */ }
    // Fallback-Platzhalter ($SCORE$, $LEVEL$, ...) auch ohne i18n aufloesen,
    // damit der deutsche Text nie rohe Platzhalter zeigt.
    const values = Array.isArray(substitutions) ? substitutions.slice() : (substitutions === undefined ? [] : [substitutions]);
    return String(fallback).replace(/\$(SCORE|LEVEL|URL|LIST|COUNT)\$/g, function () {
        return values.length ? String(values.shift()) : '';
    });
}

function popupNormalizeScore(value) {
    if (typeof value === 'number' && isFinite(value)) return Math.round(value);
    if (typeof value === 'string' && value.trim() !== '') {
        const num = Number(value);
        if (isFinite(num)) return Math.round(num);
    }
    return null;
}

function popupLevelFromScore(score) {
    const engine = getLinkGateEngine();
    if (engine && typeof engine.levelFromScore === 'function') {
        try {
            const level = engine.levelFromScore(score);
            if (typeof level === 'string' && level) return level;
        } catch (e) { /* Fallback unten */ }
    }
    const value = Number(score) || 0;
    if (value >= 80) return 'critical';
    if (value >= 60) return 'high';
    if (value >= 40) return 'medium';
    if (value >= 15) return 'low';
    return 'clean';
}

// Stil fuer eine Stufe. Unbekannte Stufen bekommen den neutralen (grauen) Stil,
// damit "unknown" nie als "clean"/gruen erscheint.
function resolvePopupLevelStyle(level) {
    const name = (typeof level === 'string') ? level.trim().toLowerCase() : '';
    const fallback = POPUP_LEVEL_STYLE_FALLBACK[name];
    if (!fallback) return POPUP_UNKNOWN_LEVEL_STYLE;

    const engine = getLinkGateEngine();
    if (engine && typeof engine.levelStyle === 'function') {
        try {
            const style = engine.levelStyle(name);
            if (style && typeof style === 'object' && style.color) {
                return {
                    color: style.color,
                    background: style.background || fallback.background,
                    border: style.border || fallback.border,
                    icon: style.icon || fallback.icon,
                    labelKey: style.labelKey || fallback.labelKey,
                    labelFallback: style.labelFallback || fallback.labelFallback
                };
            }
        } catch (e) { /* Fallback unten */ }
    }
    return fallback;
}

function popupLevelLabel(level) {
    const style = resolvePopupLevelStyle(level);
    return popupI18nMessage(style.labelKey, style.labelFallback);
}


// Liest die gespeicherte Bewertung aus dem IndexedDB-Record. Es wird bewusst
// KEIN Score erfunden: fehlt ein gespeicherter Wert, bleibt evaluated=false.
function extractStoredThreat(record) {
    const empty = { evaluated: false, score: null, level: null, reasons: [] };
    if (!record || typeof record !== 'object') return empty;

    const candidates = [record.threat, record.evaluation, record];
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate || typeof candidate !== 'object') continue;

        let rawScore = candidate.score;
        if (rawScore === undefined || rawScore === null) rawScore = candidate.threatScore;
        const score = popupNormalizeScore(rawScore);
        if (score === null) continue;

        let level = candidate.level;
        if (typeof level !== 'string' || !level) level = candidate.threatLevel;
        const reasons = Array.isArray(candidate.reasons)
            ? candidate.reasons.filter(function (reason) { return typeof reason === 'string' && reason; })
            : [];
        return {
            evaluated: true,
            score: score,
            level: (typeof level === 'string' && level) ? level : null,
            reasons: reasons
        };
    }
    return empty;
}

function deriveHostFromUrl(url) {
    if (typeof url !== 'string' || !url) return '';
    try {
        const parsed = new URL(url);
        return parsed.hostname || String(url);
    } catch (e) {
        return String(url);
    }
}

function shortenUrl(url, maxLength) {
    const text = (typeof url === 'string') ? url : String(url === undefined || url === null ? '' : url);
    const limit = (typeof maxLength === 'number' && maxLength > 8) ? maxLength : 60;
    if (text.length <= limit) return text;
    return text.slice(0, limit - 1) + '\u2026';
}

function popupActionLabel(action) {
    // Kurze Badge-Texte bewusst als Klartext: die bestehenden Gate-Keys
    // (gateBlocked/gateWarning/gateAllowed) sind ganze Saetze und fuer eine
    // Tabellenzelle zu lang. Neue Keys siehe Abschlussbericht.
    if (action === 'block') return 'Blockiert';
    if (action === 'warn') return 'Warnung';
    if (action === 'allow') return 'Erlaubt';
    return 'Nicht bewertet';
}

// Kompakte Kopfzeile: Stufe + Score. Ohne gespeicherte Bewertung erscheint der
// neutrale "Nicht bewertet"-Zustand (grau).
function renderThreatLevelHeader(threat, target) {
    const container = target || (typeof document !== 'undefined' ? document.getElementById('threatLevelHeader') : null);
    if (!container) return null;

    const evaluated = !!(threat && threat.evaluated === true && threat.score !== null && threat.score !== undefined);
    const level = evaluated ? (threat.level || popupLevelFromScore(threat.score)) : null;
    const style = evaluated ? resolvePopupLevelStyle(level) : POPUP_UNKNOWN_LEVEL_STYLE;

    container.textContent = '';
    container.className = 'card mt-3';
    container.style.borderLeft = '6px solid ' + style.border;
    container.style.background = style.background;
    container.style.color = style.color;
    container.style.padding = '8px 12px';

    const badge = document.createElement('span');
    badge.id = 'threatLevelBadge';
    badge.style.fontWeight = 'bold';
    badge.textContent = style.icon + ' ' + popupLevelLabel(evaluated ? level : 'unknown');
    container.appendChild(badge);

    const scoreEl = document.createElement('span');
    scoreEl.id = 'threatLevelScore';
    scoreEl.className = 'ml-2';
    scoreEl.textContent = evaluated
        ? popupI18nMessage('bannerThreatScore', 'Risikobewertung: $SCORE$ von 100', [String(threat.score)])
        : popupI18nMessage('bannerNotEvaluatedHint', 'Keine gespeicherte Bewertung fuer diese Nachricht.');
    container.appendChild(scoreEl);

    return container;
}


// Link-Tabelle mit Host/URL, Stufen-Badge, Gate-Aktion und aufklappbaren
// Gruenden. Ausschliesslich textContent/createElement - kein innerHTML.
function renderLinkVerdictTable(links, options) {
    const opts = options || {};
    const container = opts.container || (typeof document !== 'undefined' ? document.getElementById('linkVerdictTable') : null);
    if (!container) return null;

    const includeUrls = opts.includeUrls === true;
    const list = Array.isArray(links) ? links : [];

    container.textContent = '';

    if (list.length === 0) {
        const empty = document.createElement('p');
        empty.id = 'linkVerdictEmpty';
        empty.className = 'text-info';
        empty.textContent = popupI18nMessage('bannerLinksNone', 'Keine Links gespeichert.');
        container.appendChild(empty);
        return container;
    }

    const table = document.createElement('table');
    table.id = 'linkVerdictTableInner';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const headings = [
        popupI18nMessage('popupColumnHost', 'Ziel-Host'),
        popupI18nMessage('popupColumnLevel', 'Stufe'),
        popupI18nMessage('popupColumnAction', 'Aktion'),
        popupI18nMessage('bannerDetailsToggle', 'Details')
    ];
    for (let h = 0; h < headings.length; h++) {
        const th = document.createElement('th');
        th.textContent = headings[h];
        th.style.textAlign = 'left';
        th.style.borderBottom = '1px solid var(--card-border)';
        th.style.padding = '4px';
        headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 0; i < list.length; i++) {
        const link = list[i];
        if (!link || typeof link !== 'object') continue;

        const row = document.createElement('tr');
        row.id = 'link-verdict-row-' + i;

        const host = link.host || deriveHostFromUrl(link.url);
        const level = (typeof link.level === 'string' && link.level) ? link.level : 'unknown';
        const style = resolvePopupLevelStyle(level);

        const hostCell = document.createElement('td');
        hostCell.style.padding = '4px';
        hostCell.style.verticalAlign = 'top';
        hostCell.textContent = (includeUrls && link.url) ? shortenUrl(link.url) : host;
        row.appendChild(hostCell);

        const levelCell = document.createElement('td');
        levelCell.style.padding = '4px';
        levelCell.style.verticalAlign = 'top';
        const badge = document.createElement('span');
        badge.className = 'link-level-badge';
        badge.style.color = style.color;
        badge.style.background = style.background;
        badge.style.border = '1px solid ' + style.border;
        badge.style.borderRadius = '10px';
        badge.style.padding = '1px 8px';
        badge.style.whiteSpace = 'nowrap';
        badge.textContent = style.icon + ' ' + popupLevelLabel(level);
        levelCell.appendChild(badge);
        row.appendChild(levelCell);

        const actionCell = document.createElement('td');
        actionCell.style.padding = '4px';
        actionCell.style.verticalAlign = 'top';
        actionCell.textContent = popupActionLabel(link.action);
        row.appendChild(actionCell);

        const detailsCell = document.createElement('td');
        detailsCell.style.padding = '4px';
        detailsCell.style.verticalAlign = 'top';
        const reasons = Array.isArray(link.reasons)
            ? link.reasons.filter(function (reason) { return typeof reason === 'string' && reason; })
            : [];
        if (reasons.length > 0) {
            const detailsId = 'link-details-panel-' + i;
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.id = 'link-details-toggle-' + i;
            toggle.className = 'btn-primary';
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-controls', detailsId);
            toggle.textContent = popupI18nMessage('bannerDetailsToggle', 'Details');
            detailsCell.appendChild(toggle);

            const panel = document.createElement('div');
            panel.id = detailsId;
            panel.style.display = 'none';
            panel.style.marginTop = '4px';
            panel.style.fontSize = '12px';
            const reasonList = document.createElement('ul');
            reasonList.style.margin = '0';
            reasonList.style.paddingLeft = '18px';
            for (let r = 0; r < reasons.length; r++) {
                const li = document.createElement('li');
                li.textContent = reasons[r];
                reasonList.appendChild(li);
            }
            panel.appendChild(reasonList);
            detailsCell.appendChild(panel);

            toggle.addEventListener('click', function () {
                const isHidden = panel.style.display === 'none';
                panel.style.display = isHidden ? 'block' : 'none';
                toggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
            });
        } else {
            detailsCell.textContent = '\u2014';
        }
        row.appendChild(detailsCell);

        tbody.appendChild(row);
    }
    table.appendChild(tbody);
    container.appendChild(table);
    return container;
}


// Aufbau aus dem IndexedDB-Record: Stufe/Score + Link-Verdikte.
function renderThreatPanelFromRecord(record) {
    const threat = extractStoredThreat(record);
    renderThreatLevelHeader(threat, null);
    const links = (record && Array.isArray(record.links)) ? record.links : [];
    renderLinkVerdictTable(links, { includeUrls: reportIncludeUrls === true, container: null });
    return { threat: threat, links: links };
}

// Sendet exakt {action:'requestAdminReport', messageId}. Ohne runtime-API gibt
// es einen sauberen Fehlerzustand statt einer Ausnahme.
function requestAdminReportFromPopup(messageId) {
    if (typeof browser === 'undefined' || !browser.runtime || typeof browser.runtime.sendMessage !== 'function') {
        return Promise.resolve({ success: false, reason: 'compose_failed' });
    }
    try {
        return Promise.resolve(browser.runtime.sendMessage({ action: 'requestAdminReport', messageId: messageId }));
    } catch (e) {
        return Promise.resolve({ success: false, reason: 'compose_failed' });
    }
}

// Stellt das Ergebnis des Berichts im Statusbereich dar. Erfolg -> Empfaenger,
// sonst eine klare deutsche Meldung je Grund (inkl. Einstellungen-Button).
function renderAdminReportResult(response, statusEl) {
    const status = statusEl || (typeof document !== 'undefined' ? document.getElementById('adminReportStatus') : null);
    if (!status) return null;

    status.textContent = '';
    status.className = 'grid-content mt-2';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    if (response && response.success === true) {
        const recipients = Array.isArray(response.recipients)
            ? response.recipients.filter(function (entry) { return typeof entry === 'string' && entry; })
            : [];
        const p = document.createElement('p');
        p.id = 'adminReportSuccess';
        p.className = 'text-success';
        p.textContent = popupI18nMessage('notificationReportStarted', 'Bericht an den Administrator wurde vorbereitet.');
        status.appendChild(p);
        if (recipients.length > 0) {
            const rp = document.createElement('p');
            rp.id = 'adminReportRecipients';
            rp.textContent = popupI18nMessage('popupReportRecipients', 'Empfaenger: $LIST$', [recipients.join(', ')]);
            status.appendChild(rp);
        }
        return status;
    }

    const reason = (response && typeof response.reason === 'string') ? response.reason : '';
    const alert = document.createElement('div');
    alert.className = 'alert-error';
    alert.setAttribute('role', 'alert');

    const msg = document.createElement('p');
    msg.id = 'adminReportErrorMsg';

    if (reason === 'no_admin_contact') {
        msg.textContent = popupI18nMessage('notificationReportNoContact', 'Kein Administrator-Kontakt konfiguriert - bitte in den Einstellungen hinterlegen.');
        alert.appendChild(msg);

        const optionsButton = document.createElement('button');
        optionsButton.type = 'button';
        optionsButton.id = 'adminReportOptionsButton';
        optionsButton.className = 'btn-primary mt-2';
        optionsButton.textContent = popupI18nMessage('bannerOpenOptions', 'Einstellungen öffnen');
        optionsButton.addEventListener('click', function () {
            if (typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.openOptionsPage === 'function') {
                browser.runtime.openOptionsPage();
            }
        });
        alert.appendChild(optionsButton);
    } else if (reason === 'no_message') {
        msg.textContent = popupI18nMessage('popupReportNoMessage', 'Keine Nachricht ausgewaehlt - bitte waehlen Sie eine E-Mail aus.');
        alert.appendChild(msg);
    } else if (reason === 'compose_failed') {
        msg.textContent = popupI18nMessage('notificationReportComposeFailed', 'Der Bericht konnte nicht erstellt werden (kein Compose-Fenster verfuegbar). Bitte versuchen Sie es erneut.');
        alert.appendChild(msg);
    } else {
        msg.textContent = popupI18nMessage('popupReportFailed', 'Der Bericht konnte nicht erstellt werden. Bitte versuchen Sie es erneut.');
        alert.appendChild(msg);
    }

    status.appendChild(alert);
    return status;
}

// Verdrahtet den Button "#requestAdminReport". Sendet genau die vereinbarte
// Nachricht und stellt Erfolg/Fehler im Statusbereich dar.
function setupAdminReportButton(messageId, options) {
    const opts = options || {};
    const button = opts.button || (typeof document !== 'undefined' ? document.getElementById('requestAdminReport') : null);
    const statusEl = opts.status || (typeof document !== 'undefined' ? document.getElementById('adminReportStatus') : null);
    if (!button) return null;

    button.textContent = popupI18nMessage('bannerReportAdmin', 'Bericht an den Administrator');
    button.addEventListener('click', function () {
        const self = this;
        if (self) {
            self.disabled = true;
            self.setAttribute('aria-busy', 'true');
        }
        if (statusEl) {
            statusEl.textContent = popupI18nMessage('popupReportSending', 'Bericht wird vorbereitet...');
        }
        requestAdminReportFromPopup(messageId).then(function (response) {
            renderAdminReportResult(response, statusEl);
        }).catch(function () {
            renderAdminReportResult({ success: false, reason: 'compose_failed' }, statusEl);
        }).then(function () {
            if (self) {
                self.disabled = false;
                self.removeAttribute('aria-busy');
            }
        });
    });
    return button;
}

// Initialer Aufbau des Popup-Panels. Setzt IMMER den neutralen Zustand, damit
// vor dem Laden des Records kein "clean" vorgetaeuscht wird.
function initializeThreatPanel(options) {
    const opts = options || {};
    renderThreatLevelHeader({ evaluated: false }, null);
    renderLinkVerdictTable([], { includeUrls: reportIncludeUrls === true, container: null });
    setupAdminReportButton(opts.messageId, {});
    return true;
}
