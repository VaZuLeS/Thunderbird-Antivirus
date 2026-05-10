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
    // Liste der Anhänge abrufen
    let attachments = await browser.messages.listAttachments(message.id);

    console.log("Gefundene Anhänge:", attachments);
    
    if (attachments.length > 0) {
      await sent_to_hybrid_by_attachment(message, attachments);
    }

    // Vollständige Nachricht abrufen für Link-Extraktion
    let fullMessage = await browser.messages.getFull(message.id);
    let messageText = extractTextFromParts(fullMessage);
    let urls = extractUrls(messageText);
    let filteredUrls = filterUrls(urls);

    console.log("Gefundene URLs:", filteredUrls);
    if (filteredUrls.length > 0) {
      await indexedDB_save_links_to_db(message, filteredUrls);
    }

  } catch (error) {
    console.log(`Fehler beim Laden der Anhänge oder Links: ${error}`);
  }
}

function extractTextFromParts(part) {
  let text = "";
  if (part.contentType === "text/plain" || part.contentType === "text/html") {
      if (part.body) {
         text += part.body + " ";
      }
  }
  if (part.parts) {
      for (let subPart of part.parts) {
          text += extractTextFromParts(subPart);
      }
  }
  return text;
}

function extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
    const urls = new Set();
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
        // Bereinige ggf. am Ende hängende Satzzeichen
        let url = match[1].replace(/[.,;:!)\]]+$/, '');
        urls.add(url);
    }
    return Array.from(urls);
}

function filterUrls(urls) {
    const ignoredDomains = [
        'w3.org', 'google.com', 'microsoft.com', 'apple.com',
        'mozilla.org', 'schemas.microsoft.com', 'yahoo.com', 'github.com'
    ];

    return urls.filter(url => {
        try {
            let parsed = new URL(url);
            for (let domain of ignoredDomains) {
                if (parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)) {
                    return false;
                }
            }
            return true;
        } catch (e) {
            return false; // Ungültige URL
        }
    });
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

  const results = await Promise.all(attachments.map(async (attachment) => {
    console.log(`Prüfe Anhang: ${attachment.name} (${attachment.contentType}, ${attachment.size} bytes)`);

    let file = await browser.messages.getAttachmentFile(message.id, attachment.partName);

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
        return null;

      default:
        console.log(`Berechne lokalen Hash für Datei | Typ: ${attachment.contentType}`);

        try {
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
                return {
                    hybrid_data: {
                        submission_id: json_data.submission_id || 'N/A',
                        job_id: json_data.job_id || 'N/A',
                        sha256: local_hash,
                        state: 'KNOWN',
                        partName: attachment.partName
                    },
                    attachmentName: attachment.name
                };
            } else {
                console.log('Datei ist der API unbekannt. Speichere Metadaten für manuellen Upload.');
                return {
                    hybrid_data: {
                        submission_id: 'PENDING_UPLOAD',
                        job_id: 'PENDING_UPLOAD',
                        sha256: local_hash,
                        state: 'UNKNOWN',
                        partName: attachment.partName
                    },
                    attachmentName: attachment.name
                };
            }

        } catch (error) {
          console.error('Netzwerk- oder Verarbeitungsfehler beim Überprüfen:', error);
          return null;
        }
    }
  }));

  const validResults = results.filter(r => r !== null);
  if (validResults.length > 0) {
      await indexedDB_save_batch_hybrid_data_to_db(message, validResults);
  }
}

async function indexedDB_save_batch_hybrid_data_to_db(message, results) {
  try {
    const db = await openDB("thunderbird_av", 3);

    if (message.headerMessageId) {
      const newAttachments = results.map(result => ({
        hybrid_submission_id: result.hybrid_data.submission_id,
        hybrid_job_id: result.hybrid_data.job_id,
        hybrid_sha256: result.hybrid_data.sha256,
        attachment_name: result.attachmentName,
        state: result.hybrid_data.state,
        partName: result.hybrid_data.partName,
        created: new Date()
      }));

      await updateStore(db, 'hybridanalysis', message.headerMessageId, (existingRecord) => {
        let recordToSave;
        if (existingRecord) {
          // Update existing record
          recordToSave = existingRecord;
          if (!recordToSave.attachments) recordToSave.attachments = [];

          for (const newAtt of newAttachments) {
              let existingAttIndex = recordToSave.attachments.findIndex(a => a.attachment_name === newAtt.attachment_name);
              if (existingAttIndex > -1) {
                  recordToSave.attachments[existingAttIndex] = newAtt;
              } else {
                  recordToSave.attachments.push(newAtt);
              }
          }
        } else {
          // Create new record
          recordToSave = {
            messageHeader: message.headerMessageId,
            author: message.author,
            subject: message.subject,
            attachments: newAttachments
          };
        }
        return recordToSave;
      });
      console.log('Batch-Daten erfolgreich in DB gespeichert.');
    }
  } catch (error) {
    console.error('Fehler bei der Batch-Interaktion mit der Datenbank:', error);
  }
}

// Speicherung der Ergebnisse in IndexedDB
async function indexedDB_save_links_to_db(message, urls) {
  try {
    const db = await openDB("thunderbird_av", 3);

    if (message.headerMessageId) {
      const newLinks = urls.map(url => ({
        url: url,
        state: 'UNKNOWN',
        created: new Date()
      }));

      await updateStore(db, 'hybridanalysis', message.headerMessageId, (existingRecord) => {
        let recordToSave;
        if (existingRecord) {
          recordToSave = existingRecord;
          if (!recordToSave.links) recordToSave.links = [];

          for (const newLink of newLinks) {
            if (!recordToSave.links.find(l => l.url === newLink.url)) {
              recordToSave.links.push(newLink);
            }
          }
        } else {
          recordToSave = {
            messageHeader: message.headerMessageId,
            author: message.author,
            subject: message.subject,
            links: newLinks
          };
        }
        return recordToSave;
      });
      console.log('URLs erfolgreich in DB gespeichert.');
    }
  } catch (error) {
    console.error('Fehler bei der URL-Speicherung in der Datenbank:', error);
  }
}

async function indexedDB_save_hybrid_data_to_db(message, hybrid_data, attachmentName) {
  try {
    const db = await openDB("thunderbird_av", 3);
    
    if (message.headerMessageId) {
      let newAttachment = {
        hybrid_submission_id: hybrid_data.submission_id,
        hybrid_job_id: hybrid_data.job_id,
        hybrid_sha256: hybrid_data.sha256,
        attachment_name: attachmentName,
        state: hybrid_data.state,
        partName: hybrid_data.partName,
        created: new Date()
      };

      await updateStore(db, 'hybridanalysis', message.headerMessageId, (existingRecord) => {
        let recordToSave;
        if (existingRecord) {
          // Update existing record
          recordToSave = existingRecord;
          if (!recordToSave.attachments) recordToSave.attachments = [];
          let existingAttIndex = recordToSave.attachments.findIndex(a => a.attachment_name === attachmentName);
          if (existingAttIndex > -1) {
              recordToSave.attachments[existingAttIndex] = newAttachment;
          } else {
              recordToSave.attachments.push(newAttachment);
          }
        } else {
          // Create new record
          recordToSave = {
            messageHeader: message.headerMessageId,
            author: message.author,
            subject: message.subject,
            attachments: [newAttachment]
          };
        }
        return recordToSave;
      });
      console.log('Daten erfolgreich in DB gespeichert.');
    }
  } catch (error) {
    console.error('Fehler bei der Interaktion mit der Datenbank:', error);
  }
}

// Listener registrieren
browser.messageDisplay.onMessageDisplayed.addListener(tab_mail_open_display);

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "uploadAttachment") {
        handleManualUpload(request.messageId, request.partName, request.attachmentName, request.hash, request.headerMessageId)
            .then(res => sendResponse({status: 'success', data: res}))
            .catch(err => sendResponse({status: 'error', message: err.message}));
        return true;
    } else if (request.action === "scanUrl") {
        handleUrlScan(request.url, request.headerMessageId)
            .then(res => sendResponse({status: 'success', data: res}))
            .catch(err => sendResponse({status: 'error', message: err.message}));
        return true;
    }
});

async function handleUrlScan(url, headerMessageId) {
    if (!apikey_hybridanalysis) throw new Error("API-Key fehlt.");

    const formBody = new URLSearchParams();
    formBody.append('scan_type', 'all');
    formBody.append('url', url);

    const options = {
        method: 'POST',
        url: 'https://hybrid-analysis.com/api/v2/quick-scan/url',
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
            'user-agent': 'Falcon',
            'scan_type': 'all',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody
    };

    const response = await fetch(options.url, options);
    const json_data = await response.json();

    if (response.status === 200 || response.status === 201) {
        console.log('URL manuell an Hybrid Analysis gesendet.');

        // Update DB record
        try {
            const db = await openDB("thunderbird_av", 3);
            await updateStore(db, 'hybridanalysis', headerMessageId, (existingRecord) => {
                if (existingRecord && existingRecord.links) {
                    let linkIndex = existingRecord.links.findIndex(l => l.url === url);
                    if (linkIndex > -1) {
                        existingRecord.links[linkIndex].hybrid_submission_id = json_data.submission_id;
                        existingRecord.links[linkIndex].hybrid_job_id = json_data.job_id;
                        existingRecord.links[linkIndex].hybrid_sha256 = json_data.sha256;
                        existingRecord.links[linkIndex].state = 'UPLOADED';
                    }
                }
                return existingRecord;
            });
        } catch (dbError) {
            console.error('Fehler beim Aktualisieren des DB Records für URL:', dbError);
        }
        return json_data;
    } else {
        throw new Error("Fehler beim URL-Scan: " + JSON.stringify(json_data));
    }
}

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
        try {
            const db = await openDB("thunderbird_av", 3);
            await updateStore(db, 'hybridanalysis', headerMessageId, (existingRecord) => {
                if (existingRecord && existingRecord.attachments) {
                    let attIndex = existingRecord.attachments.findIndex(a => a.partName === partName);
                    if (attIndex > -1) {
                        existingRecord.attachments[attIndex].hybrid_submission_id = json_data.submission_id;
                        existingRecord.attachments[attIndex].hybrid_job_id = json_data.job_id;
                        existingRecord.attachments[attIndex].state = 'UPLOADED';
                    }
                }
                return existingRecord;
            });
        } catch (dbError) {
            console.error('Fehler beim Aktualisieren des DB Records:', dbError);
        }
        return json_data;
    } else {
        throw new Error("Fehler beim Upload: " + JSON.stringify(json_data));
    }
}
