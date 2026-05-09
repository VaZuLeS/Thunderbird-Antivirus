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

                // Überprüfe den Report und zeige ggf. eine Warnung an
                check_hybrid_analysis_report(json_data.sha256, message, tabId, attachment.name);
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

// Funktion zum Überprüfen des Analyseberichts
async function check_hybrid_analysis_report(sha256, message, tabId, filename, attempt = 1) {
    if (!apikey_hybridanalysis) return;

    const options = {
        method: 'GET',
        url: 'https://hybrid-analysis.com/api/v2/overview/' + sha256,
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
            'user-agent': 'Falcon',
        },
    };

    try {
        const response = await fetch(options.url, options);
        if (response.status === 200) {
            const json_data = await response.json();
            console.log(`Report für ${sha256} abgerufen (Versuch ${attempt}):`, json_data);

            if (json_data.threat_score === undefined && attempt < 6) {
                console.log(`Scan läuft noch. Neuer Versuch in 10 Sekunden...`);
                setTimeout(() => {
                    check_hybrid_analysis_report(sha256, message, tabId, filename, attempt + 1);
                }, 10000);
                return;
            }

            if (json_data.threat_score >= 50 || json_data.verdict === 'malicious') {
                show_warning(json_data, message, tabId, filename);
            }
        } else {
            console.log(`Status ${response.status} beim Abrufen des Reports (Versuch ${attempt}).`);
            if (attempt < 6) {
                setTimeout(() => {
                    check_hybrid_analysis_report(sha256, message, tabId, filename, attempt + 1);
                }, 10000);
            }
        }
    } catch (error) {
        console.error('Fehler beim Abrufen des Hybrid Analysis Reports:', error);
    }
}

// Warnung anzeigen (Notification + Inject)
async function show_warning(json_data, message, tabId, filename) {
    const title = 'Thundy AV Checker Warnung!';
    const warningMsg = `Achtung! Der Anhang "${filename}" wurde als potenziell gefährlich eingestuft.\nUrteil: ${json_data.verdict}\nBedrohungsscore: ${json_data.threat_score}`;

    // 1. Notification anzeigen
    browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('img/icon-64px.jpg'),
        title: title,
        message: warningMsg
    });

    // 2. Banner in das E-Mail Fenster injizieren
    try {
        await browser.scripting.executeScript({
            target: { tabId: tabId },
            func: injectBanner,
            args: [filename, json_data.threat_score, json_data.verdict]
        });
    } catch (error) {
        console.error('Fehler beim Injizieren des Warnbanners:', error);
    }
}

// Diese Funktion wird im Kontext der angezeigten E-Mail ausgeführt
function injectBanner(filename, threatScore, verdict) {
    // Prüfen, ob das Banner schon existiert
    if (document.getElementById('thundy-av-warning-banner')) {
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'thundy-av-warning-banner';
    banner.style.backgroundColor = '#ffcccc';
    banner.style.color = '#cc0000';
    banner.style.border = '2px solid #cc0000';
    banner.style.padding = '15px';
    banner.style.margin = '10px 0';
    banner.style.fontWeight = 'bold';
    banner.style.fontSize = '14px';
    banner.style.fontFamily = 'Arial, sans-serif';
    banner.style.borderRadius = '5px';
    banner.style.zIndex = '9999';

    const strongText = document.createElement('strong');
    strongText.innerText = '⚠️ Thundy AV Checker Warnung:';
    banner.appendChild(strongText);

    const msg = document.createElement('p');
    msg.style.margin = '5px 0 0 0';
    msg.innerText = `Der Anhang "${filename}" ist potenziell schädlich! (Urteil: ${verdict}, Score: ${threatScore})`;
    banner.appendChild(msg);

    // Banner ganz oben im Body einfügen
    document.body.insertBefore(banner, document.body.firstChild);
}

// Listener registrieren
browser.messageDisplay.onMessageDisplayed.addListener(tab_mail_open_display);
