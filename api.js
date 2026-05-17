function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(match) {
        const escape = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escape[match];
    });
}

let apikey_hybridanalysis;

(async () => {
let result = await browser.storage.local.get('apikey');
apikey_hybridanalysis = result.apikey;

if (!apikey_hybridanalysis) {
    let container = document.getElementById('hybrid_analysis_api_content');
    container.textContent = '';
    let alertDiv = document.createElement('div');
    alertDiv.className = 'alert-error';
    let strong = document.createElement('strong');
    strong.textContent = 'Warnung:';
    alertDiv.appendChild(strong);
    alertDiv.appendChild(document.createTextNode(' Kein API-Schlüssel für Hybrid-Analysis gefunden. Bitte hinterlegen Sie diesen in den Einstellungen der Erweiterung.'));
    container.appendChild(alertDiv);
    return;
}

// Der Benutzer hat auf unseren Button geklickt, holen Sie sich den aktiven Tab im aktuellen Fenster mit
// der Tabs API.
let tabs = await browser.tabs.query({ active: true, currentWindow: true });

// Holen Sie sich die aktuell angezeigte Nachricht im aktiven Tab, mit der
// messageDisplay API. Hinweis: Dies benötigt die messagesRead Berechtigung.
// Die zurückgegebene Nachricht ist ein MessageHeader-Objekt mit den relevantesten
// Informationen.
let message = await browser.messageDisplay.getDisplayedMessage(tabs[0].id);
console.log(message.headerMessageId);


// Aktualisieren Sie die HTML-Felder mit dem Betreff und dem Absender der Nachricht.
document.getElementById("subject").textContent = message.subject;
document.getElementById("from").textContent = message.author;
document.getElementById("MessageHeaderID").textContent = message.headerMessageId;
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
        getRequest.onsuccess = function (e) {
            const record = getRequest.result;
            const hasAttachments = record && record.attachments && record.attachments.length > 0;
            const hasLinks = record && record.links && record.links.length > 0;

            if (hasAttachments || hasLinks) {
                document.getElementById('hybrid_analysis_api_content').textContent = ''; // clear

                if (hasAttachments) {
                    for (const att of record.attachments) {
                        const hash256 = att.hybrid_sha256;
                        if (att.state === 'UNKNOWN') {
                            renderManualUploadUI(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId);
                        } else {
                            get_hybrid_report_by_sha256(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId, att.virustotal_stats);
                        }
                    }
                }

                if (hasLinks) {
                    for (const linkObj of record.links) {
                        if (linkObj.state === 'UNKNOWN') {
                            renderManualUrlScanUI(linkObj.url, message.headerMessageId);
                        } else if (linkObj.hybrid_sha256) {
                            get_hybrid_report_by_sha256(linkObj.hybrid_sha256, linkObj.url);
                        }
                    }
                }
            } else {
                 let p1 = document.createElement('p'); p1.textContent = 'Keine Anhänge oder URLs für diese E-Mail gefunden.'; document.getElementById('hybrid_analysis_api_content').appendChild(p1);
            }
        };
    };

    openRequest.onerror = function(e) {
        console.log("Kein Hash/Anhang gefunden.");
        let p2 = document.createElement('p'); p2.textContent = 'Keine Analyseergebnisse für diese E-Mail vorhanden.'; document.getElementById('hybrid_analysis_api_content').appendChild(p2);
    }
} catch (error) {
    console.log('Fehler beim Abrufen der Analyseergebnisse aus der Datenbank:', error);
}
})();

function createEl(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

function renderReport(json_data, attachmentName, hybrid_sha, messageId, partName, headerMessageId, virustotal_stats = null) {
    const fragment = document.createDocumentFragment();
    const card = createEl('div', 'card mb-3');
    fragment.appendChild(card);

    const title = createEl('h2', '', `Geprüftes Element: ${attachmentName || 'Unbekannt'}`);
    card.appendChild(title);

    if (json_data.state === 'IN_PROGRESS') {
        const p1 = createEl('p', 'text-warning');
        const s1 = createEl('strong', '', 'Status:');
        p1.appendChild(s1);
        p1.appendChild(document.createTextNode(' Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut.'));
        card.appendChild(p1);

        card.appendChild(createEl('p', '', `SHA-256: ${json_data.sha256 || hybrid_sha}`));
    } else {
        let threatClass = "text-success";
        if (json_data.threat_score > 50) threatClass = "text-warning";
        if (json_data.threat_score > 80) threatClass = "text-danger";

        const pThreat = createEl('p');
        pThreat.appendChild(createEl('strong', `head_line ${threatClass}`, 'Bedrohungsscore: '));
        pThreat.appendChild(createEl('span', threatClass, String(json_data.threat_score)));
        card.appendChild(pThreat);

        const pVerdict = createEl('p');
        pVerdict.appendChild(createEl('strong', `head_line ${threatClass}`, 'Urteil: '));
        pVerdict.appendChild(createEl('span', threatClass, String(json_data.verdict)));
        card.appendChild(pVerdict);

        const pVxFam = createEl('p');
        pVxFam.appendChild(createEl('strong', '', 'Vx-Familie: '));
        pVxFam.appendChild(document.createTextNode(String(json_data.vx_family || 'N/A')));
        card.appendChild(pVxFam);

        card.appendChild(createEl('p', '', `Multiscan-Ergebnis: ${json_data.multiscan_result || 'N/A'}`));

        const pAdditionalInfo = createEl('p');
        pAdditionalInfo.appendChild(createEl('strong', '', 'Additional Information:'));
        card.appendChild(pAdditionalInfo);

        card.appendChild(createEl('p', '', `Analysis start time: ${json_data.analysis_start_time || 'N/A'}`));
        card.appendChild(createEl('p', '', `Tags: ${json_data.tags ? json_data.tags.join(', ') : 'N/A'}`));

        card.appendChild(createEl('div', 'head_line', 'Scannerergebnisse:'));

        if (virustotal_stats) {
            const pVT = createEl('p', 'ml-2');
            pVT.appendChild(createEl('strong', '', 'VirusTotal Ergebnisse:'));
            card.appendChild(pVT);

            card.appendChild(createEl('p', 'ml-4 text-warning', `Malicious: ${virustotal_stats.malicious || 0}`));
            card.appendChild(createEl('p', 'ml-4', `Undetected: ${virustotal_stats.undetected || 0}`));
            card.appendChild(createEl('p', 'ml-4', `Suspicious: ${virustotal_stats.suspicious || 0}`));
            card.appendChild(createEl('p', 'ml-4', `Harmless: ${virustotal_stats.harmless || 0}`));
        }

        if (json_data.scanners && json_data.scanners.length > 0) {
            for (const scanner of json_data.scanners) {
                card.appendChild(createEl('p', 'ml-2', `Scanner: ${scanner.name}`));
                card.appendChild(createEl('p', 'ml-4', `Status: ${scanner.status}`));
                if (scanner.anti_virus_results) {
                    card.appendChild(createEl('p', 'ml-4', 'AV-Ergebnisse:'));
                    for (const avResult of scanner.anti_virus_results) {
                        card.appendChild(createEl('p', 'ml-6', `AV: ${avResult.product} - Urteil: ${avResult.verdict}`));
                    }
                }
            }
        } else {
            card.appendChild(createEl('p', 'ml-2', 'Keine Scanner-Ergebnisse verfügbar.'));
        }

        card.appendChild(createEl('p', '', `SHA-256-Hashwert: ${json_data.sha256}`));
        card.appendChild(createEl('p', '', `Letzter Dateiname: ${json_data.last_file_name || 'N/A'}`));
        card.appendChild(createEl('p', '', `Größe: ${json_data.size || 'N/A'} Bytes`));
        card.appendChild(createEl('p', '', `Typ: ${json_data.type || 'N/A'}`));

        const rescanBtn = createEl('button', 'btn-success mt-2', 'Erneut scannen (Rescan)');
        rescanBtn.id = `btn-rescan-${hybrid_sha}`;
        card.appendChild(rescanBtn);

        const rescanStatus = createEl('p', 'mt-2');
        rescanStatus.id = `rescan-status-${hybrid_sha}`;
        rescanStatus.setAttribute('aria-live', 'polite');
        rescanStatus.setAttribute('role', 'status');
        card.appendChild(rescanStatus);

        if (attachmentName && (attachmentName.toLowerCase().endsWith('.html') || attachmentName.toLowerCase().endsWith('.htm'))) {
            const cdrBtn = createEl('button', 'btn-primary mt-2 ml-2', 'Bereinigen & Herunterladen (Lokales CDR)');
            cdrBtn.id = `btn-cdr-${hybrid_sha}`;
            card.appendChild(cdrBtn);

            const cdrStatus = createEl('p', 'mt-2');
            cdrStatus.id = `cdr-status-${hybrid_sha}`;
            cdrStatus.setAttribute('aria-live', 'polite');
            cdrStatus.setAttribute('role', 'status');
            card.appendChild(cdrStatus);
        }
    }
    return fragment;
}

async function get_hybrid_report_by_sha256(hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats = null) {

    // Set the request options
    const options = {
        method: 'GET',
        url: 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha,
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
            'user-agent': 'Falcon',
        },

    };

    // Send the request and handle the response
    try {
        const response = await fetch(options.url, options);
        console.log(response);
        const json_data = await response.json();
        console.log(json_data);

        if (response.status === 200) {
            let container = document.getElementById('hybrid_analysis_api_content');
            let resultHtml = renderReport(json_data, attachmentName, hybrid_sha, messageId, partName, headerMessageId, virustotal_stats);
            container.appendChild(resultHtml);

            let rescanBtn = document.getElementById(`btn-rescan-${escapeHTML(hybrid_sha)}`);
            if (rescanBtn) {
                rescanBtn.addEventListener('click', function() {
                    let btn = this;
                    let statusEl = document.getElementById(`rescan-status-${escapeHTML(hybrid_sha)}`);
                    btn.disabled = true;
                    btn.innerText = "Sende Rescan...";
                    statusEl.innerText = "Datei wird für Rescan hochgeladen...";

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
                            setTimeout(() => {
                                window.location.reload();
                            }, 2000);
                        } else {
                            statusEl.innerText = "Fehler beim Rescan: " + (res ? res.message : "Unbekannter Fehler");
                            btn.disabled = false;
                            btn.innerText = "Erneut versuchen";
                        }
                    }).catch(err => {
                        statusEl.innerText = "Kommunikationsfehler: " + err;
                        btn.disabled = false;
                        btn.innerText = "Erneut versuchen";
                    });
                });
            }

            let cdrBtn = document.getElementById(`btn-cdr-${escapeHTML(hybrid_sha)}`);
            if (cdrBtn) {
                cdrBtn.addEventListener('click', function() {
                    let btn = this;
                    let statusEl = document.getElementById(`cdr-status-${escapeHTML(hybrid_sha)}`);
                    btn.disabled = true;
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
                            btn.innerText = "Bereinigt";
                        } else {
                            statusEl.innerText = "Fehler beim Herunterladen: " + (res ? res.message : "Unbekannter Fehler");
                            btn.disabled = false;
                            btn.innerText = "Erneut versuchen";
                        }
                    }).catch(err => {
                        statusEl.innerText = "Kommunikationsfehler: " + err;
                        btn.disabled = false;
                        btn.innerText = "Erneut versuchen";
                    });
                });
            }

        } else {
            console.error(`Hybrid Analysis API error: ${response.status} - ${response.statusText}`);
            let errDiv1 = document.createElement('div'); errDiv1.className = 'text-danger'; errDiv1.textContent = `API Error: ${response.status} für Element ${attachmentName}`; document.getElementById('hybrid_analysis_api_content').appendChild(errDiv1);
        }
    } catch (error) {
        console.error('Fetch error:', error);
        let errDiv2 = document.createElement('div'); errDiv2.className = 'text-danger'; errDiv2.textContent = `Netzwerkfehler: ${error.message} für Element ${attachmentName}`; document.getElementById('hybrid_analysis_api_content').appendChild(errDiv2);
    }
}

function renderManualUrlScanUI(url, headerMessageId) {
    let container = document.getElementById('hybrid_analysis_api_content');

    // Erzeuge eine sichere, eindeutige ID für die URL
    let urlId = Array.from(new TextEncoder().encode(url))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const card = document.createElement('div');
    card.className = 'card card-info mb-3';
    card.id = `upload-container-${urlId}`;

    const title = document.createElement('h2');
    title.textContent = `URL: ${url}`;
    card.appendChild(title);

    const pInfo = document.createElement('p');
    pInfo.className = 'text-info';
    pInfo.appendChild(document.createTextNode('Diese URL wurde in der E-Mail gefunden. Aus Datenschutzgründen wurde sie '));
    const strong = document.createElement('strong');
    strong.textContent = 'nicht automatisch hochgeladen';
    pInfo.appendChild(strong);
    pInfo.appendChild(document.createTextNode('.'));
    card.appendChild(pInfo);

    const btnUpload = document.createElement('button');
    btnUpload.className = 'btn-primary mt-2';
    btnUpload.id = `btn-upload-${urlId}`;
    btnUpload.textContent = 'URL jetzt scannen';
    card.appendChild(btnUpload);

    const pStatus = document.createElement('p');
    pStatus.className = 'mt-2';
    pStatus.id = `upload-status-${urlId}`;
    pStatus.setAttribute('aria-live', 'polite');
    pStatus.setAttribute('role', 'status');
    card.appendChild(pStatus);

    container.appendChild(card);

    document.getElementById(`btn-upload-${urlId}`).addEventListener('click', function() {
        let btn = this;
        let statusEl = document.getElementById(`upload-status-${urlId}`);
        btn.disabled = true;
        btn.innerText = "Sende URL...";
        statusEl.innerText = "URL wird an Hybrid Analysis übertragen...";

        browser.runtime.sendMessage({
            action: "scanUrl",
            url: url,
            headerMessageId: headerMessageId
        }).then(response => {
            if (response && response.status === 'success') {
                statusEl.innerText = "Scan erfolgreich beauftragt! Lade Analyseergebnisse...";
                setTimeout(() => {
                    document.getElementById(`upload-container-${urlId}`).remove();
                    // response.data.sha256 enthält den sha256-Hash des URL-Scans
                    get_hybrid_report_by_sha256(response.data.sha256, url);
                }, 3000);
            } else {
                statusEl.innerText = "Fehler beim Upload: " + (response ? response.message : "Unbekannter Fehler");
                btn.disabled = false;
                btn.innerText = "Erneut versuchen";
            }
        }).catch(err => {
            statusEl.innerText = "Kommunikationsfehler: " + err;
            btn.disabled = false;
            btn.innerText = "Erneut versuchen";
        });
    });
}

function renderManualUploadUI(hash, attachmentName, messageId, partName, headerMessageId) {
    let container = document.getElementById('hybrid_analysis_api_content');

    const card = document.createElement('div');
    card.className = 'card card-info mb-3';
    card.id = `upload-container-${hash}`;

    const title = document.createElement('h2');
    title.textContent = `Anhang: ${attachmentName || 'Unbekannt'}`;
    card.appendChild(title);

    const pHash = document.createElement('p');
    pHash.textContent = `SHA-256: ${hash}`;
    card.appendChild(pHash);

    const pInfo = document.createElement('p');
    pInfo.className = 'text-info';
    pInfo.appendChild(document.createTextNode('Diese Datei ist der Datenbank von Hybrid Analysis unbekannt. Aus Datenschutzgründen wurde sie '));
    const strong = document.createElement('strong');
    strong.textContent = 'nicht automatisch hochgeladen';
    pInfo.appendChild(strong);
    pInfo.appendChild(document.createTextNode('.'));
    card.appendChild(pInfo);

    const btnUpload = document.createElement('button');
    btnUpload.className = 'btn-primary mt-2';
    btnUpload.id = `btn-upload-${hash}`;
    btnUpload.textContent = 'Datei jetzt scannen (Upload)';
    card.appendChild(btnUpload);

    const pStatus = document.createElement('p');
    pStatus.className = 'mt-2';
    pStatus.id = `upload-status-${hash}`;
    pStatus.setAttribute('aria-live', 'polite');
    pStatus.setAttribute('role', 'status');
    card.appendChild(pStatus);

    if (attachmentName && (attachmentName.toLowerCase().endsWith('.html') || attachmentName.toLowerCase().endsWith('.htm'))) {
        const cdrBtn = document.createElement('button');
        cdrBtn.className = 'btn-primary mt-2 ml-2';
        cdrBtn.id = `btn-cdr-${hash}`;
        cdrBtn.textContent = 'Bereinigen & Herunterladen (Lokales CDR)';
        card.appendChild(cdrBtn);

        const cdrStatus = document.createElement('p');
        cdrStatus.className = 'mt-2';
        cdrStatus.id = `cdr-status-${hash}`;
        cdrStatus.setAttribute('aria-live', 'polite');
        cdrStatus.setAttribute('role', 'status');
        card.appendChild(cdrStatus);
    }

    container.appendChild(card);

    let cdrBtn = document.getElementById(`btn-cdr-${hash}`);
    if (cdrBtn) {
        cdrBtn.addEventListener('click', function() {
            let btn = this;
            let statusEl = document.getElementById(`cdr-status-${hash}`);
            btn.disabled = true;
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
                    btn.innerText = "Bereinigt";
                } else {
                    statusEl.innerText = "Fehler beim Herunterladen: " + (res ? res.message : "Unbekannter Fehler");
                    btn.disabled = false;
                    btn.innerText = "Erneut versuchen";
                }
            }).catch(err => {
                statusEl.innerText = "Kommunikationsfehler: " + err;
                btn.disabled = false;
                btn.innerText = "Erneut versuchen";
            });
        });
    }

    document.getElementById(`btn-upload-${hash}`).addEventListener('click', function() {
        let btn = this;
        let statusEl = document.getElementById(`upload-status-${hash}`);
        btn.disabled = true;
        btn.innerText = "Lade hoch...";
        statusEl.innerText = "Datei wird an Hybrid Analysis übertragen...";

        browser.runtime.sendMessage({
            action: "uploadAttachment",
            messageId: messageId,
            partName: partName,
            attachmentName: attachmentName,
            hash: hash,
            headerMessageId: headerMessageId
        }).then(response => {
            if (response && response.status === 'success') {
                statusEl.innerText = "Upload erfolgreich! Lade Analyseergebnisse...";
                setTimeout(() => {
                    document.getElementById(`upload-container-${hash}`).remove();
                    get_hybrid_report_by_sha256(hash, attachmentName, messageId, partName, headerMessageId);
                }, 3000);
            } else {
                statusEl.innerText = "Fehler beim Upload: " + (response ? response.message : "Unbekannter Fehler");
                btn.disabled = false;
                btn.innerText = "Erneut versuchen";
            }
        }).catch(err => {
            statusEl.innerText = "Kommunikationsfehler: " + err;
            btn.disabled = false;
            btn.innerText = "Erneut versuchen";
        });
    });
}
