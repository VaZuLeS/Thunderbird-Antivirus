let apikey_hybridanalysis;

// Einstellungen laden
async function loadSettings() {
  try {
    const result = await browser.storage.local.get('apikey');
    console.log("Ihr Hybrid-Analysis API-KEY wurde geladen.");
    apikey_hybridanalysis = result.apikey;
  } catch (error) {
    console.error("Fehler beim Laden der Einstellungen:", error);
  }
}
loadSettings();

// Listener für Änderungen an den Einstellungen (API Key)
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.apikey) {
    apikey_hybridanalysis = changes.apikey.newValue;
    console.log("Hybrid-Analysis API-KEY wurde dynamisch aktualisiert.");
  }
});

// Hauptfunktion: Wird ausgelöst, wenn eine Nachricht angezeigt wird
async function tab_mail_open_display(tab, message) {
  console.log(`Folgende Email Nachricht ist aktiv: ${message.author}: ${message.subject}`);

  try {
    // Die volle Nachricht inkl. Anhänge laden
    // message_full wird hier definiert, falls es später benötigt wird, aktuell wird es nicht direkt weiterverwendet
    let message_full = await browser.messages.getFull(message.id);

    // Liste der Anhänge abrufen
    let attachments = await browser.messages.listAttachments(message.id);

    console.log("Gefundene Anhänge:", attachments);
    
    if (attachments.length > 0) {
      await sent_to_hybrid_by_attachment(message, attachments);
    }

  } catch (error) {
    console.log(`Fehler beim Laden der Anhänge: ${error}`);
  }
}

// Funktion zum Senden der Anhänge an Hybrid Analysis
async function get_sha256_hash(fileData) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sent_to_hybrid_by_attachment(message, attachments) {
  if (!apikey_hybridanalysis) {
      console.error("Kein API-Key gefunden. Bitte in den Einstellungen hinterlegen.");
      return;
  }

  const results = [];

  await Promise.all(attachments.map(async (attachment) => {
    console.log(`Prüfe Anhang: ${attachment.name} (${attachment.contentType}, ${attachment.size} bytes)`);

    switch (attachment.contentType) {
      case 'text/plain':
      case 'text/html':
      case 'text/css':
      case 'text/csv':
      case 'text/javascript':
      case 'application/json':
      case 'application/xml':
      case 'application/xhtml+xml':
        console.log(`Überspringe Datei vom Typ ${attachment.contentType}`);
        break;

      default:
        console.log(`Berechne lokalen Hash für Datei | Typ: ${attachment.contentType}`);

        try {
            let file = await browser.messages.getAttachmentFile(message.id, attachment.partName);
            const content_of_atachment = file.slice();
            const arrayBuffer = await content_of_atachment.arrayBuffer();
            const local_hash = await get_sha256_hash(arrayBuffer);
            console.log("Lokaler SHA-256:", local_hash);

            // First check if it exists using hash
            const optionsCheck = {
                method: 'GET',
                url: 'https://hybrid-analysis.com/api/v2/overview/' + local_hash,
                headers: {
                    accept: 'application/json',
                    'api-key': apikey_hybridanalysis,
                    'user-agent': 'Falcon',
                }
            };

            const responseCheck = await fetch(optionsCheck.url, optionsCheck);

            if (responseCheck.status === 200) {
                const json_data = await responseCheck.json();
                console.log('Datei ist der API bereits bekannt.');
                results.push({
                    attachmentName: attachment.name,
                    hybrid_data: {
                        submission_id: json_data.submission_id || 'N/A',
                        job_id: json_data.job_id || 'N/A',
                        sha256: local_hash,
                        state: 'KNOWN'
                    }
                });
            } else {
                console.log('Datei ist der API unbekannt. Speichere Metadaten für manuellen Upload.');
                results.push({
                    attachmentName: attachment.name,
                    hybrid_data: {
                        submission_id: 'PENDING_UPLOAD',
                        job_id: 'PENDING_UPLOAD',
                        sha256: local_hash,
                        state: 'UNKNOWN',
                        partName: attachment.partName
                    }
                });
            }

        } catch (error) {
          console.error('Netzwerk- oder Verarbeitungsfehler beim Überprüfen:', error);
        }
    }
  }));

  if (results.length > 0) {
    indexedDB_save_batch_hybrid_data_to_db(message, results);
  }
}

// Batch-Speicherung der Ergebnisse in IndexedDB
function indexedDB_save_batch_hybrid_data_to_db(message, results) {
  let openRequest = indexedDB.open("thunderbird_av", 3);

  openRequest.onupgradeneeded = function (e) {
    let db = e.target.result;
    if (!db.objectStoreNames.contains('hybridanalysis')) {
      db.createObjectStore('hybridanalysis', { keyPath: 'messageHeader' });
      console.log('Datenbank hybridanalysis wurde erstellt.');
    }
  };

  openRequest.onsuccess = function (e) {
    const db = e.target.result;
    const transaction = db.transaction(['hybridanalysis'], 'readwrite');
    const store = transaction.objectStore('hybridanalysis');
    
    if (message.headerMessageId) {
      let getRequest = store.get(message.headerMessageId);
      getRequest.onsuccess = function () {
        let existingRecord = getRequest.result;
        let recordToSave;

        if (existingRecord) {
          recordToSave = existingRecord;
          if (!recordToSave.attachments) recordToSave.attachments = [];
        } else {
          recordToSave = {
            messageHeader: message.headerMessageId,
            author: message.author,
            subject: message.subject,
            attachments: []
          };
        }

        for (const item of results) {
          const { hybrid_data, attachmentName } = item;
          let newAttachment = {
            hybrid_submission_id: hybrid_data.submission_id,
            hybrid_job_id: hybrid_data.job_id,
            hybrid_sha256: hybrid_data.sha256,
            attachment_name: attachmentName,
            state: hybrid_data.state,
            partName: hybrid_data.partName,
            created: new Date()
          };

          let existingAttIndex = recordToSave.attachments.findIndex(a => a.attachment_name === attachmentName);
          if (existingAttIndex > -1) {
              recordToSave.attachments[existingAttIndex] = newAttachment;
          } else {
              recordToSave.attachments.push(newAttachment);
          }
        }

        let addRequest = store.put(recordToSave);
        addRequest.onsuccess = function () {
            console.log('Batch-Daten erfolgreich in DB gespeichert.');
        };
        addRequest.onerror = function () {
            console.error('Fehler beim Speichern der Batch-Daten in DB.');
        };
      };
    }
  };
  
  openRequest.onerror = function (e) {
    console.error('Fehler beim Öffnen der Datenbank:', e);
  };  
}

// Listener registrieren
browser.messageDisplay.onMessageDisplayed.addListener(tab_mail_open_display);

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "uploadAttachment") {
        handleManualUpload(request.messageId, request.partName, request.attachmentName, request.hash, request.headerMessageId)
            .then(res => sendResponse({status: 'success', data: res}))
            .catch(err => sendResponse({status: 'error', message: err.message}));
        return true;
    }
});

async function handleManualUpload(messageId, partName, attachmentName, hash, headerMessageId) {
    if (!apikey_hybridanalysis) throw new Error("API-Key fehlt.");

    let file = await browser.messages.getAttachmentFile(messageId, partName);
    const content_of_atachment = file.slice();
    const file_to_submit = new File([content_of_atachment], attachmentName, { type: file.type || 'application/octet-stream' });

    const formData = new FormData();
    formData.append('scan_type', 'all');
    formData.append('file', file_to_submit);

    const options = {
        method: 'POST',
        url: 'https://hybrid-analysis.com/api/v2/quick-scan/file',
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
            'user-agent': 'Falcon',
            'scan_type': 'all'
        },
        body: formData
    };

    const response = await fetch(options.url, options);
    const json_data = await response.json();

    if (response.status === 200 || response.status === 201) {
        console.log('Datei manuell an Hybrid Analysis gesendet.');

        // Update DB record
        let openRequest = indexedDB.open("thunderbird_av", 3);
        openRequest.onsuccess = function (e) {
            const db = e.target.result;
            const transaction = db.transaction(['hybridanalysis'], 'readwrite');
            const store = transaction.objectStore('hybridanalysis');
            let getRequest = store.get(headerMessageId);
            getRequest.onsuccess = function () {
                let existingRecord = getRequest.result;
                if (existingRecord && existingRecord.attachments) {
                    let attIndex = existingRecord.attachments.findIndex(a => a.partName === partName);
                    if (attIndex > -1) {
                        existingRecord.attachments[attIndex].hybrid_submission_id = json_data.submission_id;
                        existingRecord.attachments[attIndex].hybrid_job_id = json_data.job_id;
                        existingRecord.attachments[attIndex].state = 'UPLOADED';
                        store.put(existingRecord);
                    }
                }
            }
        };
        return json_data;
    } else {
        throw new Error("Fehler beim Upload: " + JSON.stringify(json_data));
    }
}
