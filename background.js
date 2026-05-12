let apikey_hybridanalysis;
let urlhausApikey = "";
let urlscanApikey = "";
let alwaysManual = false;
let autoScanLinks = false;
let timeOfClickProtection = true;
let ipReputationProvider = "none";
let ipReputationApiKey = "";

// Einstellungen laden
async function loadSettings() {
  try {
    const result = await browser.storage.local.get(['apikey', 'urlhausApikey', 'urlscanApikey', 'alwaysManual', 'autoScanLinks', 'timeOfClickProtection', 'ipReputationProvider', 'ipReputationApiKey']);
    console.log("Ihr Hybrid-Analysis API-KEY wurde geladen.");
    apikey_hybridanalysis = result.apikey;
    if (result.urlhausApikey !== undefined) {
      urlhausApikey = result.urlhausApikey;
    }
    if (result.urlscanApikey !== undefined) {
      urlscanApikey = result.urlscanApikey;
    }
    if (result.alwaysManual !== undefined) {
      alwaysManual = result.alwaysManual;
      console.log("alwaysManual erfolgreich geladen:", alwaysManual);
    }
    if (result.autoScanLinks !== undefined) {
      autoScanLinks = result.autoScanLinks;
    }
    if (result.timeOfClickProtection !== undefined) {
      timeOfClickProtection = result.timeOfClickProtection;
    }
    if (result.ipReputationProvider !== undefined) {
      ipReputationProvider = result.ipReputationProvider;
    }
    if (result.ipReputationApiKey !== undefined) {
      ipReputationApiKey = result.ipReputationApiKey;
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
  if (area === 'local' && changes.urlscanApikey !== undefined) {
    urlscanApikey = changes.urlscanApikey.newValue;
    console.log("urlscan.io API-KEY wurde aktualisiert.");
  }
  if (area === 'local' && changes.alwaysManual !== undefined) {
    alwaysManual = changes.alwaysManual.newValue;
    console.log("alwaysManual wurde aktualisiert:", alwaysManual);
  }
  if (area === 'local' && changes.autoScanLinks !== undefined) {
    autoScanLinks = changes.autoScanLinks.newValue;
  }
  if (area === 'local' && changes.timeOfClickProtection !== undefined) {
    timeOfClickProtection = changes.timeOfClickProtection.newValue;
  }
});

function extractPublicIPs(receivedHeaders) {
    if (!receivedHeaders) return [];
    let ips = new Set();
    const ipv4Regex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

    for (let header of receivedHeaders) {
        let matches = header.match(ipv4Regex);
        if (matches) {
            for (let ip of matches) {
                // Filter private/local IPs
                let parts = ip.split('.').map(Number);
                if (
                    parts[0] === 10 ||
                    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
                    (parts[0] === 192 && parts[1] === 168) ||
                    parts[0] === 127 ||
                    parts[0] === 0 ||
                    (parts[0] === 169 && parts[1] === 254)
                ) {
                    continue;
                }
                ips.add(ip);
            }
        }
    }
    return Array.from(ips);
}

async function checkAbuseIPDB(ip, apikey) {
    try {
        const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
            method: 'GET',
            headers: {
                'Key': apikey,
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        if (data && data.data && data.data.abuseConfidenceScore > 50) {
            return true;
        }
    } catch (e) {
        console.error("Fehler bei AbuseIPDB Abfrage", e);
    }
    return false;
}

async function checkVirusTotalIP(ip, apikey) {
    try {
        const response = await fetch(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
            method: 'GET',
            headers: {
                'x-apikey': apikey,
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        if (data && data.data && data.data.attributes && data.data.attributes.last_analysis_stats) {
            if (data.data.attributes.last_analysis_stats.malicious > 0) {
                return true;
            }
        }
    } catch (e) {
        console.error("Fehler bei VirusTotal IP Abfrage", e);
    }
    return false;
}

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

function calculateThreatScore(author, urls, authHeaders = [], urlhausDomains = [], isFirstCommunication = false, messageText = "", subject = "", replyTo = "") {
    let score = 0;
    let reasons = [];
    const knownBrands = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];

    const emailMatch = author.match(/<([^>]+)>/);
    let email = emailMatch ? emailMatch[1].toLowerCase() : author.toLowerCase();
    const parts = email.split('@');
    let senderDomain = parts.length === 2 ? parts[1].toLowerCase() : "";

    // Check Blacklist
    if (customBlacklist && customBlacklist.length > 0) {
        if (customBlacklist.includes(email)) {
            return { score: 100, reasons: [`Absender-E-Mail (${email}) steht auf der Blacklist.`] };
        }
        for (let b of customBlacklist) {
            if (b && (senderDomain === b || senderDomain.endsWith('.' + b))) {
                return { score: 100, reasons: [`Absender-Domain (${senderDomain}) steht auf der Blacklist (${b}).`] };
            }
        }
    }

    // Check Whitelist
    if (customWhitelist && customWhitelist.length > 0) {
        if (customWhitelist.includes(email)) {
            return { score: 0, reasons: [`Absender-E-Mail (${email}) steht auf der Whitelist.`] };
        }
        for (let w of customWhitelist) {
            if (w && (senderDomain === w || senderDomain.endsWith('.' + w))) {
                return { score: 0, reasons: [`Absender-Domain (${senderDomain}) steht auf der Whitelist (${w}).`] };
            }
        }
    }

    // Auth-Header Checks (SPF, DKIM, DMARC)
    if (authHeaders && authHeaders.length > 0) {
        const headerStr = authHeaders.join(' ').toLowerCase();
        let fail = false;

        if (headerStr.includes("spf=fail") || headerStr.includes("spf=softfail")) {
            score += 50;
            reasons.push("SPF-Prüfung fehlgeschlagen (Mögliches Spoofing).");
            fail = true;
        }
        if (headerStr.includes("dkim=fail")) {
            score += 50;
            reasons.push("DKIM-Signatur ungültig (Mögliches Spoofing).");
            fail = true;
        }
        if (headerStr.includes("dmarc=fail")) {
            score += 50;
            reasons.push("DMARC-Prüfung fehlgeschlagen (Mögliches Spoofing).");
            fail = true;
        }

        if (fail) {
            authStatus = 'fail';
        } else if (headerStr.includes("spf=pass") && headerStr.includes("dkim=pass") && headerStr.includes("dmarc=pass")) {
            // Need at least SPF, DKIM, and DMARC passing for full verification. BIMI is a bonus.
            authStatus = 'pass';
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
    let email = emailMatch ? emailMatch[1].toLowerCase() : author.toLowerCase();
    const parts = email.split('@');
    let senderDomain = parts.length === 2 ? parts[1].toLowerCase() : "";

    // Reply-To Check
    let replyToEmail = "";
    if (replyTo) {
        const replyMatch = replyTo.match(/<([^>]+)>/);
        replyToEmail = replyMatch ? replyMatch[1].toLowerCase() : replyTo.toLowerCase();
    }

    if (replyToEmail && senderDomain) {
        const replyParts = replyToEmail.split('@');
        const replyDomain = replyParts.length === 2 ? replyParts[1] : "";
        if (replyDomain && replyDomain !== senderDomain) {
            score += 50;
            reasons.push(`Diskrepanz erkannt: "Reply-To" Domain (${replyDomain}) weicht von der Absender-Domain (${senderDomain}) ab.`);
        }
    }

    // Verhaltensanalyse / BEC Schutz
    const urgencyWords = ['überweisung', 'schnell', 'ceo', 'dringend', 'sofort', 'wichtig', 'payment', 'urgent', 'rechnung', 'fällig', 'passwort', 'konto', 'transfer', 'bank'];
    let textToAnalyze = (subject + " " + messageText).toLowerCase();
    let foundUrgencyWords = urgencyWords.filter(word => {
        let regex = new RegExp(`(?:^|[^\\wäöüßÄÖÜ])(${word})(?=[^\\wäöüßÄÖÜ]|$)`, 'i');
        return regex.test(textToAnalyze);
    });

    if (foundUrgencyWords.length > 0) {
        if (isFirstCommunication) {
            score += 50;
            reasons.push(`Mögliches BEC (Business Email Compromise): Erste Kommunikation mit diesem Absender und Dringlichkeits-Signalwörter gefunden (${foundUrgencyWords.join(', ')}).`);
        } else {
            score += 20;
            reasons.push(`Dringlichkeits-Signalwörter gefunden (${foundUrgencyWords.join(', ')}). Bitte prüfen Sie die Anfrage sorgfältig.`);
        }
    } else if (isFirstCommunication) {
        score += 10;
        reasons.push("Dies ist das erste Mal, dass Sie mit diesem Absender kommunizieren.");
    }

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

    return { score: Math.min(score, 100), reasons: reasons, authStatus: authStatus };
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
      if (privacyTier === 'max') {
         console.log('Maximaler Schutz aktiv. Lade URLs automatisch hoch...');
         const urlResults = await Promise.all(filteredUrls.map(async (url) => {
            try {
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
                if (response.status === 200 || response.status === 201) {
                    const json_data = await response.json();
                    return {
                        url: url,
                        state: 'UPLOADED',
                        hybrid_submission_id: json_data.submission_id,
                        hybrid_job_id: json_data.job_id,
                        hybrid_sha256: json_data.sha256
                    };
                }
            } catch (e) {
                console.error('Fehler beim automatischen URL-Upload', e);
            }
            return { url: url, state: 'UNKNOWN' };
         }));

         await indexedDB_save_links_objects_to_db(message, urlResults);
      } else {
         await indexedDB_save_links_to_db(message, filteredUrls);
      }
    }

    // Wenn timeOfClickProtection aktiv ist, senden wir eine Nachricht an den Content-Script
    if (timeOfClickProtection && filteredUrls.length > 0) {
       browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: function() {
              const links = document.querySelectorAll('a');
              links.forEach(link => {
                  if (link.href && link.href.startsWith('http')) {
                      link.title = "Protected by Thundy Time-of-Click";
                      link.style.borderBottom = "1px dashed #ff8c00";
                  }
              });
          }
       }).catch(e => console.log("Fehler beim Injecten von Time-of-Click Styles:", e));
    }

    let authHeaders = (fullMessage.headers && fullMessage.headers['authentication-results']) || [];
    let receivedHeaders = (fullMessage.headers && fullMessage.headers['received']) || [];
    let urlhausDomains = [];
    let maliciousIps = [];

    if (ipReputationProvider !== "none" && ipReputationApiKey) {
        let publicIps = extractPublicIPs(receivedHeaders);
        for (let ip of publicIps) {
            let isMalicious = false;
            if (ipReputationProvider === "abuseipdb") {
                isMalicious = await checkAbuseIPDB(ip, ipReputationApiKey);
            } else if (ipReputationProvider === "virustotal") {
                isMalicious = await checkVirusTotalIP(ip, ipReputationApiKey);
            }
            if (isMalicious) {
                maliciousIps.push(ip);
            }
        }
    }

    // BEC Protection Data Extraction
    const emailMatch = message.author.match(/<([^>]+)>/);
    let senderEmail = emailMatch ? emailMatch[1].toLowerCase() : message.author.toLowerCase();

    let isFirstCommunication = false;
    try {
        if (browser.messages.query) {
            let previousMsgs = await browser.messages.query({ to: senderEmail });
            if (previousMsgs && previousMsgs.messages && previousMsgs.messages.length === 0) {
                isFirstCommunication = true;
            }
        }
    } catch (e) {
        console.log("Fehler bei messages.query (Möglicherweise nicht unterstützt):", e);
    }

    let replyTo = "";
    if (fullMessage.headers && fullMessage.headers['reply-to']) {
        replyTo = fullMessage.headers['reply-to'][0];
    }

    let subject = message.subject || "";

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

    let threat = calculateThreatScore(message.author, urls, authHeaders, urlhausDomains, isFirstCommunication, messageText, subject, replyTo);
    if (threat.score >= 50) {
      console.log(`Threat erkannt! Score: ${threat.score}, Gründe:`, threat.reasons);
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: function(score, reasons, authStatus) {
          if (score >= 50) {
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
            title.textContent = `🔴 ⚠️ Warnung! Mögliches Phishing erkannt (Risk Score: ${score}/100)`;
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
          } else if (authStatus === 'pass') {
            const badge = document.createElement('div');
            badge.style.display = 'inline-block';
            badge.style.backgroundColor = '#e6ffe6';
            badge.style.border = '1px solid #008000';
            badge.style.color = '#008000';
            badge.style.padding = '5px 10px';
            badge.style.margin = '10px';
            badge.style.borderRadius = '20px';
            badge.style.fontWeight = 'bold';
            badge.style.fontFamily = 'Arial, sans-serif';
            badge.style.fontSize = '12px';
            badge.style.zIndex = '9999';
            badge.textContent = `🟢 🛡️ Absender verifiziert`;

            document.body.prepend(badge);
          }
        },
        args: [threat.score, threat.reasons, threat.authStatus]
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

            let virustotal_stats = null;
            if (apikey_virustotal) {
                virustotal_stats = await checkVirusTotal(local_hash, apikey_virustotal);
            }

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
                    attachmentName: attachment.name,
                    virustotal_stats: virustotal_stats
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
                    attachmentName: attachment.name,
                    virustotal_stats: virustotal_stats
                };
            } else {
                console.log('Datei ist der API unbekannt.');
                if (privacyTier === 'balanced' || privacyTier === 'max') {
                    console.log('Lade unbekannte Datei automatisch hoch...');
                    try {
                        const file_to_submit = new File([content_of_atachment], attachment.name, { type: file.type || 'application/octet-stream' });
                        const formData = new FormData();
                        formData.append('scan_type', 'all');
                        formData.append('file', file_to_submit);

                        const uploadOptions = {
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
                        const uploadResponse = await fetch(uploadOptions.url, uploadOptions);
                        if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                            const uploadData = await uploadResponse.json();
                            return {
                                hybrid_data: {
                                    submission_id: uploadData.submission_id,
                                    job_id: uploadData.job_id,
                                    sha256: uploadData.sha256 || local_hash,
                                    state: 'UPLOADED',
                                    partName: attachment.partName
                                },
                                attachmentName: attachment.name
                            };
                        } else {
                            console.error('Fehler beim automatischen Upload, falle auf manuell zurück.');
                        }
                    } catch (uploadError) {
                        console.error('Ausnahme beim automatischen Upload, falle auf manuell zurück.', uploadError);
                    }
                }

                console.log('Speichere Metadaten für manuellen Upload.');
                return {
                    hybrid_data: {
                        submission_id: 'PENDING_UPLOAD',
                        job_id: 'PENDING_UPLOAD',
                        sha256: local_hash,
                        state: 'UNKNOWN',
                        partName: attachment.partName
                    },
                    attachmentName: attachment.name,
                    virustotal_stats: virustotal_stats
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
        virustotal_stats: result.virustotal_stats,
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
async function indexedDB_save_links_objects_to_db(message, urlObjects) {
  try {
    const db = await openDB("thunderbird_av", 3);

    if (message.headerMessageId) {
      const newLinks = urlObjects.map(obj => ({
        ...obj,
        created: new Date()
      }));

      await updateStore(db, 'hybridanalysis', message.headerMessageId, (existingRecord) => {
        let recordToSave;
        if (existingRecord) {
          recordToSave = existingRecord;
          if (!recordToSave.links) recordToSave.links = [];

          for (const newLink of newLinks) {
            let existingIdx = recordToSave.links.findIndex(l => l.url === newLink.url);
            if (existingIdx > -1) {
                recordToSave.links[existingIdx] = newLink;
            } else {
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
    }
  } catch (error) {
    console.error('Fehler bei der Batch-Interaktion (Links Objects) mit der Datenbank:', error);
  }
}

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

async function indexedDB_save_hybrid_data_to_db(message, hybrid_data, attachmentName, virustotal_stats = null) {
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
        virustotal_stats: virustotal_stats,
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

browser.menus.create({
    id: "scan-link-thundy",
    title: "Link mit Thundy scannen",
    contexts: ["link"]
});

browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "scan-link-thundy") {
        let url = info.linkUrl;

        browser.notifications.create({
            type: "basic",
            iconUrl: "img/icon-64px.jpg",
            title: "Thundy AV Scanner",
            message: "Scan gestartet für: " + url
        });

        try {
            // Need a dummy headerMessageId as context menu might be clicked outside standard flow
            // or we just fetch the active message
            let activeMessage = null;
            try {
                activeMessage = await browser.messageDisplay.getDisplayedMessage(tab.id);
            } catch (e) {}

            let msgId = activeMessage ? activeMessage.headerMessageId : "context_menu_scan";

            let result = await handleUrlScan(url, msgId);

            browser.notifications.create({
                type: "basic",
                iconUrl: "img/icon-64px.jpg",
                title: "Thundy AV Scanner",
                message: "Scan erfolgreich eingereicht. Job ID: " + result.job_id
            });
        } catch (error) {
            browser.notifications.create({
                type: "basic",
                iconUrl: "img/icon-64px.jpg",
                title: "Thundy AV Scanner Fehler",
                message: error.message
            });
        }
    }
});

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
        browser.messageDisplay.getDisplayedMessage(sender.tab.id).then(message => {
            if (message && message.headerMessageId) {
                return openDB("thunderbird_av", 3).then(db => {
                    return getFromStore(db, "hybridanalysis", message.headerMessageId);
                }).then(async record => {
                    let linkObj = null;
                    if (record && record.links) {
                        linkObj = record.links.find(l => l.url.replace(/\/$/, "") === request.url.replace(/\/$/, ""));
                    }

                    // Time-of-Click Live Scan via urlscan.io
                    if (urlscanApikey && (!linkObj || linkObj.state === 'UNKNOWN')) {
                        try {
                            const res = await checkUrlscanIo(request.url, urlscanApikey);
                            if (res && res.status !== 'ERROR' && res.status !== 'TIMEOUT') {
                                // Wir überschreiben das Verhalten: Wenn es Visuelles Phishing ist, sofort warnen
                                return sendResponse({ status: res.status, reasons: res.reasons });
                            }
                        } catch (e) {
                            console.log("Fehler bei Time-of-Click Live-Scan:", e);
                        }
                    }

                    if (linkObj) {
                        if (linkObj.hybrid_sha256 && apikey_hybridanalysis) {
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
                            sendResponse({status: linkObj.state || 'UNKNOWN'});
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
        return true;
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

async function checkVirusTotal(hash, apikey) {
    if (!apikey) return null;
    const url = `https://www.virustotal.com/api/v3/files/${hash}`;
    const options = {
        method: 'GET',
        headers: {
            'x-apikey': apikey,
            'accept': 'application/json'
        }
    };
    try {
        const response = await fetch(url, options);
        if (response.status === 200) {
            const data = await response.json();
            if (data && data.data && data.data.attributes && data.data.attributes.last_analysis_stats) {
                return data.data.attributes.last_analysis_stats;
            }
        }
        return null;
    } catch (e) {
        console.error("Fehler bei VirusTotal Abfrage:", e);
        return null;
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

async function checkUrlscanIo(url, apikey) {
    if (!apikey) return null;
    try {
        // Start Scan
        const scanRes = await fetch('https://urlscan.io/api/v1/scan/', {
            method: 'POST',
            headers: {
                'API-Key': apikey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url, visibility: 'public' })
        });

        if (scanRes.status === 400) {
           console.log("urlscan.io API Error 400 (e.g. Domain not resolvable)", await scanRes.json());
           return { status: 'ERROR', details: 'Domain not resolvable' };
        }

        if (!scanRes.ok) throw new Error("Fehler beim Starten des Scans (urlscan.io): " + scanRes.status);

        const scanData = await scanRes.json();
        const uuid = scanData.uuid;

        if (!uuid) throw new Error("Keine UUID von urlscan.io erhalten.");

        // Wait for result (Polling)
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 2000)); // wait 2s
            const resultRes = await fetch(`https://urlscan.io/api/v1/result/${uuid}/`);
            if (resultRes.status === 200) {
                const resultData = await resultRes.json();

                let isMalicious = false;
                let reasons = [];

                if (resultData.verdicts && resultData.verdicts.overall && resultData.verdicts.overall.malicious) {
                    isMalicious = true;
                    reasons.push("Die URL wurde von urlscan.io generell als bösartig eingestuft.");
                }

                if (resultData.verdicts && resultData.verdicts.urlscan && resultData.verdicts.urlscan.brands && resultData.verdicts.urlscan.brands.length > 0) {
                     // Check if it's visually trying to spoof a brand
                     if (resultData.verdicts.urlscan.malicious) {
                        isMalicious = true;
                        reasons.push("Visuelle Erkennung: Die Seite gibt sich als " + resultData.verdicts.urlscan.brands.join(', ') + " aus (Phishing-Verdacht).");
                     }
                }

                if (isMalicious) {
                    return { status: 'MALICIOUS_VISUAL', reasons: reasons };
                } else {
                    return { status: 'CLEAN' };
                }
            } else if (resultRes.status === 404) {
                // Not ready yet, continue polling
            } else {
                throw new Error("Fehler beim Abrufen der Ergebnisse (urlscan.io): " + resultRes.status);
            }
        }

        return { status: 'TIMEOUT' }; // Took too long
    } catch (e) {
        console.error("Fehler bei urlscan.io Abfrage", e);
        return { status: 'ERROR', details: e.message };
    }
}
