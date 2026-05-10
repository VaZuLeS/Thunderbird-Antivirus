let apikey_hybridanalysis;
let urlhausApikey = "";
let alwaysManual = false;

// Einstellungen laden
async function loadSettings() {
  try {
    const result = await browser.storage.local.get(['apikey', 'urlhausApikey', 'alwaysManual']);
    console.log("Ihr Hybrid-Analysis API-KEY wurde geladen.");
    apikey_hybridanalysis = result.apikey;
    if (result.urlhausApikey !== undefined) {
      urlhausApikey = result.urlhausApikey;
    }
    if (result.alwaysManual !== undefined) {
      alwaysManual = result.alwaysManual;
      console.log("alwaysManual erfolgreich geladen:", alwaysManual);
    }
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
  if (area === 'local' && changes.urlhausApikey !== undefined) {
    urlhausApikey = changes.urlhausApikey.newValue;
    console.log("URLhaus API-KEY wurde aktualisiert.");
  }
  if (area === 'local' && changes.alwaysManual !== undefined) {
    alwaysManual = changes.alwaysManual.newValue;
    console.log("alwaysManual wurde aktualisiert:", alwaysManual);
  }
});

function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1,
                                        Math.min(matrix[i][j - 1] + 1,
                                                 matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

function calculateThreatScore(author, urls, authHeaders = [], urlhausDomains = []) {
    let score = 0;
    let reasons = [];
    const knownBrands = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];

    // Auth-Header Checks (SPF, DKIM, DMARC)
    if (authHeaders && authHeaders.length > 0) {
        const headerStr = authHeaders.join(' ').toLowerCase();
        if (headerStr.includes("spf=fail") || headerStr.includes("spf=softfail")) {
            score += 50;
            reasons.push("SPF-Prüfung fehlgeschlagen (Mögliches Spoofing).");
        }
        if (headerStr.includes("dkim=fail")) {
            score += 50;
            reasons.push("DKIM-Signatur ungültig (Mögliches Spoofing).");
        }
        if (headerStr.includes("dmarc=fail")) {
            score += 50;
            reasons.push("DMARC-Prüfung fehlgeschlagen (Mögliches Spoofing).");
        }
    }

    // URLhaus Checks
    if (urlhausDomains && urlhausDomains.length > 0) {
        for (let domain of urlhausDomains) {
            score += 80;
            reasons.push(`Domain (${domain}) ist auf URLhaus als bösartig gelistet.`);
        }
    }

    const emailMatch = author.match(/<([^>]+)>/);
    let email = emailMatch ? emailMatch[1] : author;
    const parts = email.split('@');
    let senderDomain = parts.length === 2 ? parts[1].toLowerCase() : "";

    // Hilfsfunktion zur Ermittlung der Hauptdomain
    function getMainDomain(domain) {
        for (let brand of knownBrands) {
            if (domain === brand || domain.endsWith('.' + brand)) {
                return brand;
            }
        }
        const dParts = domain.split('.');
        if (dParts.length >= 2) {
            return dParts.slice(-2).join('.');
        }
        return domain;
    }

    let senderMainDomain = "";
    if (senderDomain) {
        senderMainDomain = getMainDomain(senderDomain);

        let isSenderKnownBrand = knownBrands.includes(senderMainDomain);

        if (!isSenderKnownBrand) {
            for (let brand of knownBrands) {
                let distance = levenshteinDistance(senderMainDomain, brand);
                if (distance > 0 && distance <= 2 && senderMainDomain.length >= 4) {
                    score += 60;
                    reasons.push(`Absender-Domain (${senderMainDomain}) ähnelt verdächtig der bekannten Marke ${brand}.`);
                    break;
                }
            }
        }
    }

    let linkDomains = new Set();
    for (let url of urls) {
        try {
            let parsed = new URL(url);
            linkDomains.add(parsed.hostname.toLowerCase());
        } catch (e) {}
    }

    if (linkDomains.size > 0 && senderDomain) {
        let matchFound = false;
        let typosquatLinkFound = false;

        for (let ld of linkDomains) {
            if (ld === senderDomain || ld.endsWith('.' + senderDomain) || senderDomain.endsWith('.' + ld)) {
                matchFound = true;
            } else if (senderMainDomain && (ld === senderMainDomain || ld.endsWith('.' + senderMainDomain))) {
                 matchFound = true;
            }

            let linkMainDomain = getMainDomain(ld);
            let isLinkKnownBrand = knownBrands.includes(linkMainDomain);

            if (!isLinkKnownBrand) {
                for (let brand of knownBrands) {
                    let distance = levenshteinDistance(linkMainDomain, brand);
                    if (distance > 0 && distance <= 2 && linkMainDomain.length >= 4) {
                        typosquatLinkFound = true;
                        if (!reasons.some(r => r.includes(linkMainDomain))) {
                            reasons.push(`Link-Domain (${linkMainDomain}) ähnelt verdächtig der bekannten Marke ${brand}.`);
                        }
                    }
                }
            }
        }

        if (!matchFound) {
            score += 40;
            if (!reasons.some(r => r.includes('Keiner der Links'))) {
                 reasons.push(`Keiner der Links im Text verweist auf die Absender-Domain (${senderDomain}).`);
            }
        }
        if (typosquatLinkFound) {
            score += 60;
        }
    }

    return { score: Math.min(score, 100), reasons: reasons };
}

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

    let authHeaders = (fullMessage.headers && fullMessage.headers['authentication-results']) || [];
    let urlhausDomains = [];

    if (urlhausApikey && filteredUrls.length > 0) {
      let linkDomains = new Set();
      for (let url of filteredUrls) {
        try {
          let parsed = new URL(url);
          linkDomains.add(parsed.hostname.toLowerCase());
        } catch (e) {}
      }

      const domainChecks = Array.from(linkDomains).map(async (domain) => {
        let isMalicious = await checkURLhaus(domain, urlhausApikey);
        if (isMalicious) {
          return domain;
        }
        return null;
      });

      const checkResults = await Promise.all(domainChecks);
      urlhausDomains = checkResults.filter(d => d !== null);
    }

    let threat = calculateThreatScore(message.author, urls, authHeaders, urlhausDomains);
    if (threat.score >= 50) {
      console.log(`Threat erkannt! Score: ${threat.score}, Gründe:`, threat.reasons);
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: function(score, reasons) {
          // Sichere DOM-Manipulation ohne innerHTML
          const banner = document.createElement('div');
          banner.style.backgroundColor = '#ffeeee';
          banner.style.border = '1px solid #ff0000';
          banner.style.color = '#ff0000';
          banner.style.padding = '10px';
          banner.style.margin = '10px';
          banner.style.borderRadius = '4px';
          banner.style.fontWeight = 'bold';
          banner.style.fontFamily = 'Arial, sans-serif';
          banner.style.zIndex = '9999';

          const title = document.createElement('div');
          title.textContent = `⚠️ Warnung! Mögliches Phishing erkannt (Risk Score: ${score}/100)`;
          title.style.fontSize = '16px';
          title.style.marginBottom = '5px';
          banner.appendChild(title);

          const reasonList = document.createElement('ul');
          reasonList.style.margin = '0';
          reasonList.style.paddingLeft = '20px';
          reasonList.style.fontSize = '14px';

          for (const reason of reasons) {
            const li = document.createElement('li');
            li.textContent = reason;
            reasonList.appendChild(li);
          }
          banner.appendChild(reasonList);

          document.body.prepend(banner);
        },
        args: [threat.score, threat.reasons]
      });
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

            if (alwaysManual) {
                console.log('Immer manuell scannen ist aktiv. Speichere Metadaten für manuellen Hash-Check.');
                return {
                    hybrid_data: {
                        submission_id: 'MANUAL_CHECK',
                        job_id: 'MANUAL_CHECK',
                        sha256: local_hash,
                        state: 'MANUAL_CHECK_PENDING',
                        partName: attachment.partName
                    },
                    attachmentName: attachment.name
                };
            }

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

    if (request.action === "checkLinkState") {
        // Need to find the active message to get headerMessageId
        // Since content script doesn't know the message ID, we can get it via tabs API
        browser.messageDisplay.getDisplayedMessage(sender.tab.id).then(message => {
            if (message && message.headerMessageId) {
                return openDB("thunderbird_av", 3).then(db => {
                    return getFromStore(db, "hybridanalysis", message.headerMessageId);
                }).then(record => {
                    if (record && record.links) {
                        const linkObj = record.links.find(l => l.url.replace(/\/$/, "") === request.url.replace(/\/$/, ""));
                        if (linkObj) {
                            if (linkObj.hybrid_sha256) {
                                // Known to hybrid-analysis
                                // Could do a fetch here, but for now we rely on state if we want it fast.
                                // But the instruction says: "If a hybrid_sha256 is found, query the Hybrid Analysis API to check the verdict." Wait, no, we agreed to rely on existing API wrappers. Let's just fetch it using fetch() as that's easiest inside background script, or rely on db state.
                                // Actually, let's just return the db state, and if they click scan, it handles it via 'scanUrl'.
                                // Oh wait! State might be 'UNKNOWN' or 'UPLOADED' in DB.
                                // The prompt plan: "Find the matching URL in record.links, extract its state (e.g. UNKNOWN, CLEAN, MALICIOUS), and return it".
                                // If it has a hybrid_sha256, we can fetch the overview API to get current verdict.
                                if (apikey_hybridanalysis) {
                                    return fetch('https://hybrid-analysis.com/api/v2/overview/' + linkObj.hybrid_sha256, {
                                        method: 'GET',
                                        headers: {
                                            accept: 'application/json',
                                            'api-key': apikey_hybridanalysis,
                                            'user-agent': 'Falcon',
                                        }
                                    }).then(response => response.json())
                                    .then(json_data => {
                                        if (json_data.verdict) {
                                            if (json_data.verdict === 'no specific threat') {
                                                sendResponse({status: 'CLEAN'});
                                            } else {
                                                sendResponse({status: json_data.verdict.toUpperCase()});
                                            }
                                        } else {
                                            sendResponse({status: linkObj.state});
                                        }
                                    }).catch(err => {
                                        sendResponse({status: linkObj.state});
                                    });
                                } else {
                                    sendResponse({status: linkObj.state});
                                }
                            } else {
                                sendResponse({status: linkObj.state || 'UNKNOWN'});
                            }
                        } else {
                            sendResponse({status: 'UNKNOWN'});
                        }
                    } else {
                        sendResponse({status: 'UNKNOWN'});
                    }
                }).catch(err => {
                    sendResponse({status: 'ERROR'});
                });
            } else {
                sendResponse({status: 'UNKNOWN'});
            }
        }).catch(err => {
            sendResponse({status: 'ERROR'});
        });
        return true; // Keep the message channel open for the async response
    }

    if (request.action === "checkHash") {
        handleManualCheck(request.hash, request.headerMessageId, request.partName)
            .then(res => sendResponse({status: 'success', data: res}))
            .catch(err => sendResponse({status: 'error', message: err.message}));
        return true;
    }

    if (request.action === "downloadDisarmed") {
        handleDownloadDisarmed(request.messageId, request.partName, request.attachmentName)
            .then(res => sendResponse({status: 'success', data: res}))
            .catch(err => sendResponse({status: 'error', message: err.message}));
        return true;
    }
});

async function handleDownloadDisarmed(messageId, partName, attachmentName) {
    let file = await browser.messages.getAttachmentFile(messageId, partName);
    const contentBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const htmlString = decoder.decode(contentBuffer);

    // Disarm the HTML locally
    const safeHtml = disarmHTML(htmlString);

    // Create a blob from the safe HTML
    const blob = new Blob([safeHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Download the file
    let safeName = attachmentName || 'disarmed.html';
    if (!safeName.toLowerCase().endsWith('.html') && !safeName.toLowerCase().endsWith('.htm')) {
        safeName += '.html';
    }
    const downloadId = await browser.downloads.download({
        url: url,
        filename: 'disarmed_' + safeName,
        saveAs: true
    });

    // Revoke object URL after a short delay to free memory, giving download time to start
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 10000);

    return { downloadId: downloadId };
}

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

async function checkURLhaus(domain, apikey) {
    if (!apikey) return false;
    try {
        const body = new URLSearchParams();
        body.append('host', domain);
        const response = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
            method: 'POST',
            headers: {
                'Auth-Key': apikey,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });
        const data = await response.json();
        if (data.query_status === 'ok' && data.url_count > 0) {
            return true;
        }
    } catch (e) {
        console.error("Fehler bei URLhaus Abfrage", e);
    }
    return false;
}

/**
 * Perform local Content Disarm and Reconstruction (CDR) on HTML strings.
 * It uses DOMParser to remove active and potentially malicious elements and attributes.
 * @param {string} htmlString - The raw HTML string.
 * @returns {string} - The sanitized HTML string.
 */
function disarmHTML(htmlString) {
    if (typeof DOMParser === 'undefined') {
        // Fallback for tests if DOMParser is not mocked, though it should be.
        if (globalThis.DOMParserMock) {
            var parser = new globalThis.DOMParserMock();
        } else {
            return htmlString; // Cannot parse without DOMParser
        }
    } else {
        var parser = new DOMParser();
    }

    let doc = parser.parseFromString(htmlString, 'text/html');

    // Tags to remove entirely
    const tagsToRemove = ['script', 'object', 'embed', 'applet', 'base', 'form', 'meta', 'iframe', 'frame', 'frameset'];
    tagsToRemove.forEach(tag => {
        let elements = doc.getElementsByTagName(tag);
        for (let i = elements.length - 1; i >= 0; i--) {
            elements[i].parentNode.removeChild(elements[i]);
        }
    });

    // Remove inline event handlers (attributes starting with 'on') and javascript: URIs
    let allElements = doc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
        let el = allElements[i];

        // Remove 'on...' attributes
        let attributesToRemove = [];
        for (let j = 0; j < el.attributes.length; j++) {
            let attrName = el.attributes[j].name.toLowerCase();
            if (attrName.startsWith('on')) {
                attributesToRemove.push(el.attributes[j].name);
            }
        }
        attributesToRemove.forEach(attr => el.removeAttribute(attr));

        // Clean href and src attributes
        ['href', 'src', 'action'].forEach(attr => {
            if (el.hasAttribute(attr)) {
                let val = el.getAttribute(attr);
                // Remove invisible control characters and whitespace from the value to prevent evasions
                let sanitizedVal = val.replace(/[\x00-\x20]/g, '').toLowerCase();
                if (sanitizedVal.startsWith('javascript:') || sanitizedVal.startsWith('vbscript:') || sanitizedVal.startsWith('data:text/html')) {
                    el.removeAttribute(attr);
                }
            }
        });
    }

    return doc.documentElement.outerHTML;
}
