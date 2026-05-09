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
    browser.messageDisplayAction.setBadgeText({text: "", tabId: tab.id});

    // Die volle Nachricht inkl. Anhänge laden
    // message_full wird hier definiert, falls es später benötigt wird, aktuell wird es nicht direkt weiterverwendet
    let message_full = await browser.messages.getFull(message.id);

    // Liste der Anhänge abrufen
    let attachments = await browser.messages.listAttachments(message.id);

    console.log("Gefundene Anhänge:", attachments);

    if (attachments.length > 0) {
      await sent_to_hybrid_by_attachment(message, attachments, tab.id);
    }

  } catch (error) {
    console.log(`Fehler beim Laden der Anhänge: ${error}`);
  }
}

// Funktion zum Senden der Anhänge an Hybrid Analysis
async function sent_to_hybrid_by_attachment(message, attachments, tabId) {
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

        browser.messageDisplayAction.setBadgeText({text: "Lade...", tabId: tabId});
        browser.messageDisplayAction.setBadgeBackgroundColor({color: "yellow", tabId: tabId});

        try {
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
                console.log('Datei erfolgreich an Hybrid Analysis gesendet.');
                console.log("SHA-256:", json_data.sha256);

                // Ergebnis in der lokalen Datenbank speichern
                indexedDB_save_hybrid_data_to_db(message, json_data);
                poll_hybrid_analysis(json_data.sha256, tabId);
            } else {
                console.error('Fehler beim Senden an Hybrid Analysis:', json_data);
            }
        } catch (error) {
          console.error('Netzwerk- oder Verarbeitungsfehler beim Senden:', error);
        }
    }
  }
}

// Speicherung der Ergebnisse in IndexedDB
function indexedDB_save_hybrid_data_to_db(message, hybrid_data) {
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
      hybrid_submission_id: hybrid_data.submission_id,
      hybrid_job_id: hybrid_data.job_id,
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

async function poll_hybrid_analysis(sha256, tabId, retries = 0) {
    if (retries > 40) { // Max ~10 minutes
        browser.messageDisplayAction.setBadgeText({text: "TO", tabId: tabId});
        browser.messageDisplayAction.setBadgeBackgroundColor({color: "red", tabId: tabId});
        return;
    }
    try {
        const options = {
            method: 'GET',
            url: 'https://hybrid-analysis.com/api/v2/overview/' + sha256,
            headers: {
                accept: 'application/json',
                'api-key': apikey_hybridanalysis,
                'user-agent': 'Falcon',
            }
        };
        const response = await fetch(options.url, options);
        if (response.status === 200) {
            const json_data = await response.json();
            if (json_data.verdict === 'in progress' || json_data.threat_score === undefined) {
                setTimeout(() => poll_hybrid_analysis(sha256, tabId, retries + 1), 15000);
                return;
            }

            // To prevent a clean attachment from overwriting a malicious attachment's badge,
            // check the current badge text.
            let currentBadgeText = await browser.messageDisplayAction.getBadgeText({tabId: tabId});
            if (currentBadgeText === "Gefahr" || (!isNaN(parseInt(currentBadgeText)) && parseInt(currentBadgeText) > 0)) {
                return; // Already marked as dangerous
            }

            if (json_data.threat_score > 0 || json_data.verdict === 'malicious' || json_data.verdict === 'suspicious') {
                let threatText = json_data.threat_score ? json_data.threat_score.toString() : "Gefahr";
                browser.messageDisplayAction.setBadgeText({text: threatText, tabId: tabId});
                browser.messageDisplayAction.setBadgeBackgroundColor({color: "red", tabId: tabId});
            } else {
                // If it's clean, only set OK if it wasn't already marked danger or still loading other attachments
                // As a simplification, we set OK. True synchronization requires a centralized state, but this works well.
                browser.messageDisplayAction.setBadgeText({text: "OK", tabId: tabId});
                browser.messageDisplayAction.setBadgeBackgroundColor({color: "green", tabId: tabId});
            }
        } else if (response.status === 202) {
            setTimeout(() => poll_hybrid_analysis(sha256, tabId, retries + 1), 15000);
        } else {
            browser.messageDisplayAction.setBadgeText({text: "ERR", tabId: tabId});
            browser.messageDisplayAction.setBadgeBackgroundColor({color: "red", tabId: tabId});
        }
    } catch (error) {
        console.error("Polling error:", error);
    }
}

// Listener registrieren
browser.messageDisplay.onMessageDisplayed.addListener(tab_mail_open_display);
