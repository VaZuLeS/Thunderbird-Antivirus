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


function setElementHtml(id, html) {
    let el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function appendElementHtml(id, html) {
    let el = document.getElementById(id);
    if (el) {
        if (typeof html === 'string') {
            el.insertAdjacentHTML('beforeend', html);
        } else if (html instanceof Node) {
            el.appendChild(html);
        }
    }
}

function setElementText(id, text) {
    let el = document.getElementById(id);
    if (el) el.textContent = text;
}

function sendExtensionMessage(message, btn, statusEl, errorPrefix, onSuccess) {
    return browser.runtime.sendMessage(message).then(res => {
        if (res && res.status === 'success') {
            if (btn) btn.removeAttribute('aria-busy');
            if (onSuccess) onSuccess(res);
        } else {
            statusEl.innerText = errorPrefix + (res ? res.message : "Unbekannter Fehler");
            btn.disabled = false;
            if (btn) btn.removeAttribute('aria-busy');
            btn.innerText = "Erneut versuchen";
        }
    }).catch(err => {
        statusEl.innerText = "Kommunikationsfehler: " + err;
        btn.disabled = false;
        if (btn) btn.removeAttribute('aria-busy');
        btn.innerText = "Erneut versuchen";
    });
}

let apikey_hybridanalysis;

(async () => {
let result = await browser.storage.local.get('apikey');
apikey_hybridanalysis = result.apikey;

if (!apikey_hybridanalysis) {
    setElementHtml('hybrid_analysis_api_content', '<div class="alert-error"><strong>Warnung:</strong> Kein API-Schlüssel für Hybrid-Analysis gefunden. Bitte hinterlegen Sie diesen in den Einstellungen der Erweiterung.</div>');
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


// Aktualisieren Sie die HTML-Felder mit dem Betreff und dem Absender der Nachricht.
setElementText("subject", message.subject);
setElementText("from", message.author);
setElementText("MessageHeaderID", message.headerMessageId);
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
                setElementHtml('hybrid_analysis_api_content', ''); // clear

                if (hasAttachments) {
                    for (const att of record.attachments) {
                        const hash256 = att.hybrid_sha256;
                        if (att.state === 'UNKNOWN') {
                            renderManualUploadUI(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId);
                        } else {
                            get_hybrid_report_by_sha256({
                                hybrid_sha: hash256,
                                attachmentName: att.attachment_name,
                                messageId: message.id,
                                partName: att.partName,
                                headerMessageId: message.headerMessageId,
                                virustotal_stats: att.virustotal_stats
                            });
                        }
                    }
                }

                if (hasLinks) {
                    for (const linkObj of record.links) {
                        if (linkObj.state === 'UNKNOWN') {
                            renderManualUrlScanUI(linkObj.url, message.headerMessageId);
                        } else if (linkObj.hybrid_sha256) {
                            get_hybrid_report_by_sha256({
                                hybrid_sha: linkObj.hybrid_sha256,
                                attachmentName: linkObj.url
                            });
                        }
                    }
                }
            } else {
                 setElementHtml('hybrid_analysis_api_content', '<p>Keine Anhänge oder URLs für diese E-Mail gefunden.</p>');
            }
        };
    };

    openRequest.onerror = function(e) {
        setElementHtml('hybrid_analysis_api_content', '<p>Keine Analyseergebnisse für diese E-Mail vorhanden.</p>');
    }
} catch (error) {
    console.error('Fehler beim Abrufen der Analyseergebnisse aus der Datenbank:', error);
}
})();

function createEl(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

function renderReport({ json_data, attachmentName, hybrid_sha, messageId, partName, headerMessageId, virustotal_stats = null }) {
    const card = document.createElement('div');
    card.className = "card mb-3";

    const h2 = document.createElement('h2');
    h2.textContent = `Geprüftes Element: ${attachmentName || 'Unbekannt'}`;
    card.appendChild(h2);

    if (json_data.state === 'IN_PROGRESS') {
        const pStatus = document.createElement('p');
        pStatus.className = "text-warning";
        pStatus.innerHTML = `<strong>Status:</strong> Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut.`;
        card.appendChild(pStatus);

        const pHash = document.createElement('p');
        pHash.textContent = `SHA-256: ${json_data.sha256 || hybrid_sha}`;
        card.appendChild(pHash);
    } else {
        let threatClass = "text-success";
        if (json_data.threat_score > 50) threatClass = "text-warning";
        if (json_data.threat_score > 80) threatClass = "text-danger";

        const pThreat = document.createElement('p');
        pThreat.innerHTML = `<strong class="head_line ${threatClass}">Bedrohungsscore:</strong> <span class="${threatClass}">${escapeHTML(json_data.threat_score)}</span>`;
        card.appendChild(pThreat);

        const pVerdict = document.createElement('p');
        pVerdict.innerHTML = `<strong class="head_line ${threatClass}">Urteil:</strong> <span class="${threatClass}">${escapeHTML(json_data.verdict)}</span>`;
        card.appendChild(pVerdict);

        const pVxFamily = document.createElement('p');
        pVxFamily.innerHTML = `<strong>Vx-Familie:</strong> ${escapeHTML(json_data.vx_family || 'N/A')}`;
        card.appendChild(pVxFamily);

        const pMulti = document.createElement('p');
        pMulti.textContent = `Multiscan-Ergebnis: ${json_data.multiscan_result || 'N/A'}`;
        card.appendChild(pMulti);

        const pAddInfo = document.createElement('p');
        pAddInfo.innerHTML = `<strong>Additional Information:</strong>`;
        card.appendChild(pAddInfo);

        const pAnalysisTime = document.createElement('p');
        pAnalysisTime.textContent = `Analysis start time: ${json_data.analysis_start_time || 'N/A'}`;
        card.appendChild(pAnalysisTime);

        const pTags = document.createElement('p');
        pTags.textContent = `Tags: ${json_data.tags ? json_data.tags.join(', ') : 'N/A'}`;
        card.appendChild(pTags);

        const divScanners = document.createElement('div');
        divScanners.className = "head_line";
        divScanners.textContent = `Scannerergebnisse:`;
        card.appendChild(divScanners);

        if (virustotal_stats) {
            const pVtHead = document.createElement('p');
            pVtHead.className = "ml-2";
            pVtHead.innerHTML = `<strong>VirusTotal Ergebnisse:</strong>`;
            card.appendChild(pVtHead);

            const pVtMal = document.createElement('p');
            pVtMal.className = "ml-4 text-warning";
            pVtMal.textContent = `Malicious: ${virustotal_stats.malicious || 0}`;
            card.appendChild(pVtMal);

            const pVtUnd = document.createElement('p');
            pVtUnd.className = "ml-4";
            pVtUnd.textContent = `Undetected: ${virustotal_stats.undetected || 0}`;
            card.appendChild(pVtUnd);

            const pVtSus = document.createElement('p');
            pVtSus.className = "ml-4";
            pVtSus.textContent = `Suspicious: ${virustotal_stats.suspicious || 0}`;
            card.appendChild(pVtSus);

            const pVtHarm = document.createElement('p');
            pVtHarm.className = "ml-4";
            pVtHarm.textContent = `Harmless: ${virustotal_stats.harmless || 0}`;
            card.appendChild(pVtHarm);
        }

        if (json_data.scanners && json_data.scanners.length > 0) {
            for (const scanner of json_data.scanners) {
                const pScanner = document.createElement('p');
                pScanner.className = "ml-2";
                pScanner.textContent = `Scanner: ${scanner.name}`;
                card.appendChild(pScanner);

                const pStatus = document.createElement('p');
                pStatus.className = "ml-4";
                pStatus.textContent = `Status: ${scanner.status}`;
                card.appendChild(pStatus);

                if (scanner.anti_virus_results) {
                    const pAvRes = document.createElement('p');
                    pAvRes.className = "ml-4";
                    pAvRes.textContent = `AV-Ergebnisse:`;
                    card.appendChild(pAvRes);

                    for (const avResult of scanner.anti_virus_results) {
                        const pAv = document.createElement('p');
                        pAv.className = "ml-6";
                        pAv.textContent = `AV: ${avResult.product} - Urteil: ${avResult.verdict}`;
                        card.appendChild(pAv);
                    }
                }
            }
        } else {
            const pNoScanners = document.createElement('p');
            pNoScanners.className = "ml-2";
            pNoScanners.textContent = `Keine Scanner-Ergebnisse verfügbar.`;
            card.appendChild(pNoScanners);
        }

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

        const btnRescan = document.createElement('button');
        btnRescan.id = `btn-rescan-${hybrid_sha}`;
        btnRescan.className = "btn-success mt-2";
        btnRescan.textContent = `Erneut scannen (Rescan)`;
        card.appendChild(btnRescan);

        const pRescanStatus = document.createElement('p');
        pRescanStatus.id = `rescan-status-${hybrid_sha}`;
        pRescanStatus.className = "mt-2";
        pRescanStatus.setAttribute('aria-live', 'polite');
        pRescanStatus.setAttribute('role', 'status');
        card.appendChild(pRescanStatus);

        if (attachmentName && (attachmentName.toLowerCase().endsWith('.html') || attachmentName.toLowerCase().endsWith('.htm'))) {
            const btnCdr = document.createElement('button');
            btnCdr.id = `btn-cdr-${hybrid_sha}`;
            btnCdr.className = "btn-primary mt-2 ml-2";
            btnCdr.textContent = `Bereinigen & Herunterladen (Lokales CDR)`;
            card.appendChild(btnCdr);

            const pCdrStatus = document.createElement('p');
            pCdrStatus.id = `cdr-status-${hybrid_sha}`;
            pCdrStatus.className = "mt-2";
            pCdrStatus.setAttribute('aria-live', 'polite');
            pCdrStatus.setAttribute('role', 'status');
            card.appendChild(pCdrStatus);
        }
    }
    return card;
}

function bindRescanButton(btn, hybrid_sha, messageId, partName, attachmentName, headerMessageId) {
    btn.addEventListener('click', function() {
        let statusId = `rescan-status-${escapeHTML(hybrid_sha)}`;
        let statusEl = document.getElementById(statusId);
        btn.disabled = true;
        if (btn) btn.setAttribute('aria-busy', 'true');
        btn.innerText = "Sende Rescan...";
        setElementText(statusId, "Datei wird für Rescan hochgeladen...");

        sendExtensionMessage(
            {
                action: "uploadAttachment",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName,
                hash: hybrid_sha,
                headerMessageId: headerMessageId
            },
            btn,
            statusEl,
            "Fehler beim Rescan: ",
            (res) => {
                if(statusEl) statusEl.innerText = "Rescan erfolgreich initiiert. Lade Seite neu...";
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        );
    });
}

function bindCdrButton(btn, hybrid_sha, messageId, partName, attachmentName) {
    btn.addEventListener('click', function() {
        let statusId = `cdr-status-${escapeHTML(hybrid_sha)}`;
        let statusEl = document.getElementById(statusId);
        btn.disabled = true;
        if (btn) btn.setAttribute('aria-busy', 'true');
        btn.innerText = "Bereinige...";
        setElementText(statusId, "Lokales CDR wird durchgeführt...");

        sendExtensionMessage(
            {
                action: "downloadDisarmed",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName
            },
            btn,
            statusEl,
            "Fehler beim Herunterladen: ",
            (res) => {
                if(statusEl) statusEl.innerText = "Herunterladen erfolgreich initiiert.";
                btn.innerText = "Bereinigt";
            }
        );
    });
}

async function get_hybrid_report_by_sha256({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats = null }) {

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
        const json_data = await response.json();

        if (response.status === 200) {
            let resultHtml = renderReport(json_data, attachmentName, hybrid_sha, messageId, partName, headerMessageId, virustotal_stats);
            appendElementHtml('hybrid_analysis_api_content', resultHtml);

            let rescanBtn = document.getElementById(`btn-rescan-${hybrid_sha}`);
            if (rescanBtn) {
                bindRescanButton(rescanBtn, hybrid_sha, messageId, partName, attachmentName, headerMessageId);
            }

            let cdrBtn = document.getElementById(`btn-cdr-${hybrid_sha}`);
            if (cdrBtn) {
                bindCdrButton(cdrBtn, hybrid_sha, messageId, partName, attachmentName);
            }

        } else {
            console.error(`Hybrid Analysis API error: ${response.status} - ${response.statusText}`);
            appendElementHtml('hybrid_analysis_api_content', `<div class="text-danger">API Error: ${response.status} für Element ${escapeHTML(attachmentName)}</div>`);
        }
    } catch (error) {
        console.error('Fetch error:', error);
        appendElementHtml('hybrid_analysis_api_content', `<div class="text-danger">Netzwerkfehler: ${escapeHTML(error.message)} für Element ${escapeHTML(attachmentName)}</div>`);
    }
}

function renderManualUrlScanUI(url, headerMessageId) {
    let safeUrl = escapeHTML(url);
    // Erzeuge eine sichere, eindeutige ID für die URL
    let urlId = Array.from(new TextEncoder().encode(url))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    let resultHtml = `<div class="card card-info mb-3" id="upload-container-${urlId}">
        <h2>URL: ${safeUrl}</h2>
        <p class="text-info">Diese URL wurde in der E-Mail gefunden. Aus Datenschutzgründen wurde sie <strong>nicht automatisch hochgeladen</strong>.</p>
        <button id="btn-upload-${urlId}" class="btn-primary mt-2">URL jetzt scannen</button>
        <p id="upload-status-${urlId}" class="mt-2" aria-live="polite" role="status"></p>
    </div>`;
    appendElementHtml('hybrid_analysis_api_content', resultHtml);

    document.getElementById(`btn-upload-${urlId}`).addEventListener('click', function() {
        let btn = this;
        let statusId = `upload-status-${urlId}`;
        btn.disabled = true;
        if (btn) btn.setAttribute('aria-busy', 'true');
        btn.innerText = "Sende URL...";
        setElementText(statusId, "URL wird an Hybrid Analysis übertragen...");

        sendExtensionMessage(
            {
                action: "scanUrl",
                url: url,
                headerMessageId: headerMessageId
            },
            btn,
            statusEl,
            "Fehler beim Upload: ",
            (response) => {
                statusEl.innerText = "Scan erfolgreich beauftragt! Lade Analyseergebnisse...";
                setTimeout(() => {
                    document.getElementById(`upload-container-${urlId}`).remove();
                    // response.data.sha256 enthält den sha256-Hash des URL-Scans
                    get_hybrid_report_by_sha256({
                        hybrid_sha: response.data.sha256,
                        attachmentName: url
                    });
                }, 3000);
            }
        );
    });
}

function createUploadButton(card, hash, safeHash, attachmentName, messageId, partName, headerMessageId) {
    let btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${safeHash}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = "Datei jetzt scannen (Upload)";
    card.appendChild(btnUpload);

    let pStatus = document.createElement('p');
    pStatus.id = `upload-status-${safeHash}`;
    pStatus.className = "mt-2";
    pStatus.setAttribute("aria-live", "polite");
    pStatus.setAttribute("role", "status");
    card.appendChild(pStatus);

    btnUpload.addEventListener('click', function() {
        let btn = this;
        let statusId = `upload-status-${safeHash}`;
        let statusEl = document.getElementById(statusId);
        btn.disabled = true;
        if (btn) btn.setAttribute('aria-busy', 'true');
        btn.innerText = "Lade hoch...";
        setElementText(statusId, "Datei wird an Hybrid Analysis übertragen...");

        sendExtensionMessage(
            {
                action: "uploadAttachment",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName,
                hash: hash,
                headerMessageId: headerMessageId
            },
            btn,
            statusEl,
            "Fehler beim Upload: ",
            (response) => {
                if (statusEl) statusEl.innerText = "Upload erfolgreich! Lade Analyseergebnisse...";
                setTimeout(() => {
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
            }
        );
    });
}

function createCdrButton(card, safeHash, attachmentName, messageId, partName) {
    if (!attachmentName || (!attachmentName.toLowerCase().endsWith('.html') && !attachmentName.toLowerCase().endsWith('.htm'))) {
        return;
    }

    let cdrBtn = document.createElement('button');
    cdrBtn.id = `btn-cdr-${safeHash}`;
    cdrBtn.className = "btn-primary mt-2 ml-2";
    cdrBtn.textContent = "Bereinigen & Herunterladen (Lokales CDR)";
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
        setElementText(statusId, "Lokales CDR wird durchgeführt...");

        sendExtensionMessage(
            {
                action: "downloadDisarmed",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName
            },
            btn,
            statusEl,
            "Fehler beim Herunterladen: ",
            (res) => {
                if (statusEl) statusEl.innerText = "Herunterladen erfolgreich initiiert.";
                btn.innerText = "Bereinigt";
            }
        );
    });
}

function renderManualUploadUI(hash, attachmentName, messageId, partName, headerMessageId) {
    let safeHash = escapeHTML(hash);

    let card = document.createElement('div');
    card.className = "card card-info mb-3";
    card.id = `upload-container-${safeHash}`;

    let h2 = document.createElement('h2');
    h2.textContent = `Anhang: ${attachmentName || 'Unbekannt'}`;
    card.appendChild(h2);

    let pHash = document.createElement('p');
    pHash.textContent = `SHA-256: ${hash}`;
    card.appendChild(pHash);

    let pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.innerHTML = 'Diese Datei ist der Datenbank von Hybrid Analysis unbekannt. Aus Datenschutzgründen wurde sie <strong>nicht automatisch hochgeladen</strong>.';
    card.appendChild(pInfo);

    createUploadButton(card, hash, safeHash, attachmentName, messageId, partName, headerMessageId);
    createCdrButton(card, safeHash, attachmentName, messageId, partName);

    appendElementHtml('hybrid_analysis_api_content', card);
}
