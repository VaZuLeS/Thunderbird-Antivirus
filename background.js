let apikey_hybridanalysis;

// Einstellungen laden
async function loadSettings() {
  await messenger.storage.local.get('apikey').then((result) => {
      console.log("Ihr Hybrid-Analysis API-KEY wurde geladen.");
      apikey_hybridanalysis =  result.apikey;
    });    
}
loadSettings();

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
async function sent_to_hybrid_by_attachment(message, attachments) {
  if (!apikey_hybridanalysis) {
      console.error("Kein API-Key gefunden. Bitte in den Einstellungen hinterlegen.");
      return;
  }

  for (const attachment of attachments) {
    console.log(`Prüfe Anhang: ${attachment.name} (${attachment.contentType}, ${attachment.size} bytes)`);

    let file = await browser.messages.getAttachmentFile(message.id, attachment.partName);

    // Einfache Filterung bekannter sicherer Text-Typen (optional anpassbar)
    // Falls man diese auch scannen will, einfach den case entfernen.
    switch (attachment.contentType) {
      case 'text/plain':
      case 'text/html':
      case 'text/css':
      case 'text/csv':
      case 'text/javascript': // JS könnte man sicherheitshalber scannen lassen, hier aber per Default ausgeschlossen wie im Original
      case 'application/json':
      case 'application/xml':
      case 'application/xhtml+xml':
        console.log(`Überspringe Datei vom Typ ${attachment.contentType}`);
        break;
        
      default:
        console.log(`Sende Datei an hybrid-analysis.com | Typ: ${attachment.contentType}`);

        try {
            const content_of_atachment = file.slice();
            const file_to_submit = new File([content_of_atachment], attachment.name, { type: attachment.contentType });



                        // Lokalen SHA-256 Hash berechnen
            const arrayBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            console.log("Lokaler SHA-256 Hash berechnet:", hashHex);

            const options = {
                method: 'GET',
                url: 'https://hybrid-analysis.com/api/v2/overview/' + hashHex,
                headers: {
                    accept: 'application/json',
                    'api-key': apikey_hybridanalysis,
                    'user-agent': 'Falcon'
                }
            };

            const response = await fetch(options.url, options);

            if (response.status === 200) {
                console.log('Datei ist Hybrid Analysis bereits bekannt.');
                const json_data = await response.json();

                // Ergebnis in der lokalen Datenbank speichern
                indexedDB_save_hybrid_data_to_db(message, { sha256: hashHex }, false);
            } else if (response.status === 404) {
                console.log('Datei ist unbekannt. Speichere Status für manuelle Freigabe.');
                indexedDB_save_hybrid_data_to_db(message, { sha256: hashHex }, true);
            } else {
                console.error('Fehler bei der Hash-Prüfung:', response.status);
            }
        } catch (error) {
          console.error('Netzwerk- oder Verarbeitungsfehler beim Senden:', error);
        }
    }
  }
}

// Speicherung der Ergebnisse in IndexedDB
function indexedDB_save_hybrid_data_to_db(message, hybrid_data, needs_upload = false) {
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
    
    let item = {
      messageHeader: message.headerMessageId,
      hybrid_submission_id: hybrid_data.submission_id || '',
      hybrid_job_id: hybrid_data.job_id || '',
      needs_upload: needs_upload,
      hybrid_sha256: hybrid_data.sha256,
      author: message.author,
      subject: message.subject,
      created: new Date()
    };

    if (item.messageHeader) {
      // Prüfen, ob Eintrag schon existiert (um Duplikate zu vermeiden oder zu aktualisieren)
      let getRequest = store.get(item.messageHeader);
      getRequest.onsuccess = function () {
        // Wir überschreiben/aktualisieren einfach oder fügen neu hinzu
        let addRequest = store.put(item); // .put ist meist besser als .add für Updates
        addRequest.onsuccess = function () {
            console.log('Daten erfolgreich in DB gespeichert.');
        };
        addRequest.onerror = function () {
            console.error('Fehler beim Speichern in DB.');
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

// Listener für Nachrichten von der Benutzeroberfläche (z.B. Button-Klick zum manuellen Upload)
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "upload_to_hybrid" && message.headerMessageId) {
        upload_manual_attachment(message.headerMessageId);
    }
});

async function upload_manual_attachment(headerMessageId) {
    if (!apikey_hybridanalysis) {
        console.error("Kein API-Key gefunden.");
        return;
    }

    try {
        let openTabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (openTabs.length > 0) {
            let msg = await browser.messageDisplay.getDisplayedMessage(openTabs[0].id);
            if (msg.headerMessageId === headerMessageId) {
                let attachments = await browser.messages.listAttachments(msg.id);
                for (const attachment of attachments) {
                    switch (attachment.contentType) {
                        case 'text/plain':
                        case 'text/html':
                        case 'text/css':
                        case 'text/csv':
                        case 'text/javascript':
                        case 'application/json':
                        case 'application/xml':
                        case 'application/xhtml+xml':
                            break;
                        default:
                            let file = await browser.messages.getAttachmentFile(msg.id, attachment.partName);
                            const content_of_atachment = file.slice();
                            const file_to_submit = new File([content_of_atachment], attachment.name, { type: attachment.contentType });

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
                                console.log('Datei manuell erfolgreich an Hybrid Analysis gesendet.');
                                indexedDB_save_hybrid_data_to_db(msg, json_data, false);

                                // Die UI aktualisieren, indem wir sie anweisen, den Bericht neu zu laden
                                browser.runtime.sendMessage({
                                    action: "upload_success",
                                    sha256: json_data.sha256
                                }).catch(() => {});
                            } else {
                                console.error('Fehler beim manuellen Senden:', json_data);
                            }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Fehler beim manuellen Upload:", error);
    }
}
