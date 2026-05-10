function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(match) {
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
    document.getElementById('hybrid_analysis_api_content').innerHTML = '<div style="color: red; padding: 10px; border: 1px solid red; background-color: #fee;"><strong>Warnung:</strong> Kein API-Schlüssel für Hybrid-Analysis gefunden. Bitte hinterlegen Sie diesen in den Einstellungen der Erweiterung.</div>';
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
            if (getRequest.result && getRequest.result.attachments && getRequest.result.attachments.length > 0) {
                document.getElementById('hybrid_analysis_api_content').innerHTML = ''; // clear
                for (const att of getRequest.result.attachments) {
                    const hash256 = att.hybrid_sha256;
                    if (att.state === 'UNKNOWN') {
                        renderManualUploadUI(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId);
                    } else {
                        get_hybrid_report_by_sha256(hash256, att.attachment_name);
                    }
                }
            } else {
                console.log("Kein Hash/Anhang gefunden.");
                document.getElementById('hybrid_analysis_api_content').innerHTML = '<p>Keine Analyseergebnisse für diese E-Mail vorhanden.</p>';
            }
        };
        getRequest.onerror = function (e) {
            console.log("Fehler beim Abrufen des Datensatzes:", e.target.error);
        };
    };
} catch (error) {
    console.log('Error opening local Hybrid Analysis Database:', error);
}
})();

function renderReport(json_data, attachmentName, hybrid_sha) {
    let resultHtml = '';

    // Pending check (in_progress)
    if (json_data.state === 'IN_PROGRESS') {
        resultHtml += `<div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ccc;">
            <h2>Anhang: ${escapeHTML(attachmentName || 'Unbekannt')}</h2>
            <p style="color: orange;"><strong>Status:</strong> Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut.</p>
            <p>SHA-256: ${escapeHTML(json_data.sha256 || hybrid_sha)}</p>
        </div>`;
    } else {
        let threatColor = "green";
        if (json_data.threat_score > 50) threatColor = "orange";
        if (json_data.threat_score > 80) threatColor = "red";

        resultHtml += `<div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ccc;">
            <h2>Anhang: ${escapeHTML(attachmentName || 'Unbekannt')}</h2>
            <p><strong class="head_line" style="color: ${threatColor};">Bedrohungsscore:</strong> ${escapeHTML(json_data.threat_score)}</p>
            <p><strong class="head_line" style="color: ${threatColor};">Urteil:</strong> ${escapeHTML(json_data.verdict)}</p>
            <p><strong>Vx-Familie:</strong> ${escapeHTML(json_data.vx_family || 'N/A')}</p>
            <p>Multiscan-Ergebnis: ${escapeHTML(json_data.multiscan_result || 'N/A')}</p>
            <p><strong>Additional Information:</strong></p>
            <p>Analysis start time: ${escapeHTML(json_data.analysis_start_time || 'N/A')}</p>
            <p>Tags: ${escapeHTML(json_data.tags ? json_data.tags.join(', ') : 'N/A')}</p>
            <div class="head_line">Scannerergebnisse:</div>`;

        if (json_data.scanners && json_data.scanners.length > 0) {
            for (const scanner of json_data.scanners) {
                resultHtml += `<p style="margin-left: 10px;">Scanner: ${escapeHTML(scanner.name)}</p>`;
                resultHtml += `<p style="margin-left: 20px;">Status: ${escapeHTML(scanner.status)}</p>`;
                if (scanner.anti_virus_results) {
                    resultHtml += `<p style="margin-left: 20px;">AV-Ergebnisse:</p>`;
                    for (const avResult of scanner.anti_virus_results) {
                        resultHtml += `<p style="margin-left: 30px;">AV: ${escapeHTML(avResult.product)} - Urteil: ${escapeHTML(avResult.verdict)}</p>`;
                    }
                }
            }
        } else {
            resultHtml += `<p style="margin-left: 10px;">Keine Scanner-Ergebnisse verfügbar.</p>`;
        }

        resultHtml += `
            <p>SHA-256-Hashwert: ${escapeHTML(json_data.sha256)}</p>
            <p>Letzter Dateiname: ${escapeHTML(json_data.last_file_name || 'N/A')}</p>
            <p>Größe: ${escapeHTML(json_data.size || 'N/A')} Bytes</p>
            <p>Typ: ${escapeHTML(json_data.type || 'N/A')}</p>
        </div>`;
    }
    return resultHtml;
}

async function get_hybrid_report_by_sha256(hybrid_sha, attachmentName) {

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
            let resultHtml = renderReport(json_data, attachmentName, hybrid_sha);
            container.insertAdjacentHTML('beforeend', resultHtml);

        } else {
            // Fügen Sie das div-Element zum DOM hinzu
            let container = document.getElementById('hybrid_analysis_api_content');
            container.insertAdjacentHTML('beforeend', `<div style="color: red;">Failed to Get Report for SHA256 at Hybrid Analysis.</div>`);
        }
    } catch (error) {

        // Fügen Sie das div-Element zum DOM hinzu
        let container = document.getElementById('hybrid_analysis_api_content');
        if (container) {
            container.insertAdjacentHTML('beforeend', `<div style="color: red;">Error getting analysis from Hybrid Analysis: ${escapeHTML(error)}</div>`);
        }
    }
}
function renderManualUploadUI(hash, attachmentName, messageId, partName, headerMessageId) {
    let container = document.getElementById('hybrid_analysis_api_content');
    let safeHash = escapeHTML(hash);
    let resultHtml = `<div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; border-left: 5px solid blue;" id="upload-container-${safeHash}">
        <h2>Anhang: ${escapeHTML(attachmentName || 'Unbekannt')}</h2>
        <p>SHA-256: ${safeHash}</p>
        <p style="color: blue;">Diese Datei ist der Datenbank von Hybrid Analysis unbekannt. Aus Datenschutzgründen wurde sie <strong>nicht automatisch hochgeladen</strong>.</p>
        <button id="btn-upload-${safeHash}" style="padding: 10px; background-color: #005a9e; color: white; border: none; cursor: pointer;">Datei jetzt scannen (Upload)</button>
        <p id="upload-status-${safeHash}" style="margin-top: 5px;"></p>
    </div>`;
    container.insertAdjacentHTML('beforeend', resultHtml);

    document.getElementById(`btn-upload-${safeHash}`).addEventListener('click', function() {
        let btn = this;
        let statusEl = document.getElementById(`upload-status-${safeHash}`);
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
                    document.getElementById(`upload-container-${safeHash}`).remove();
                    get_hybrid_report_by_sha256(hash, attachmentName);
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
