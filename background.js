let customBlacklist = new Set();
let customWhitelist = new Set();
let authStatus = null;
let apikey_hybridanalysis;
let urlhausApikey = "";
let urlscanApikey = "";
let apikey_virustotal;
let privacyTier = "balanced";
let alwaysManual = false;
let autoScanLinks = false;
let timeOfClickProtection = true;
let ipReputationProvider = "none";
let ipReputationApiKey = "";

let sharedDBPromise = null;

function getSharedDB() {
    if (!sharedDBPromise) {
        sharedDBPromise = openDB("thunderbird_av", 3);
    }
    return sharedDBPromise;
}

const knownSendersCache = new Set();
const MAX_KNOWN_SENDERS = 1000;

const urlhausCache = new Map();
const MAX_URLHAUS_CACHE_SIZE = 1000;

const ipReputationCache = new Map();
const MAX_IP_CACHE = 1000;

const vtCache = new Map();
const MAX_VT_CACHE_SIZE = 1000;

function getHybridAnalysisOptions(method, body = null, isUrl = false) {
    if (!apikey_hybridanalysis) throw new Error("API-Key fehlt.");
    const options = {
        method: method,
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
            'user-agent': 'Falcon'
        }
    };
    if (body) {
        options.body = body;
        options.headers['scan_type'] = 'all';
    }
    if (isUrl) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    return options;
}

// ⚡ Bolt Optimization: Precompiled Hexadecimal Look-Up Table (LUT) for O(1) byte-to-hex conversion
const byteToHex = new Array(256);
for (let i = 0; i < 256; i++) byteToHex[i] = i.toString(16).padStart(2, '0');

// Precompiled Regexes for Performance
const GLOBAL_IPV4_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
const GLOBAL_URL_REGEX = /(https?:\/\/[^\s"'<>]+)/g;

const URGENCY_WORDS = ['überweisung', 'schnell', 'ceo', 'dringend', 'sofort', 'wichtig', 'payment', 'urgent', 'rechnung', 'fällig', 'passwort', 'konto', 'transfer', 'bank'];
// ⚡ Bolt Optimization: Removed redundant 'i' flag since input text is pre-lowercased
const URGENCY_REGEX_COMBINED = new RegExp(`(?:^|[^\\wäöüßÄÖÜ])(${URGENCY_WORDS.join('|')})(?=[^\\wäöüßÄÖÜ]|$)`, 'g');

// Einstellungen laden
async function loadSettings() {
  try {
    const result = await browser.storage.local.get(['apikey', 'virustotalApikey', 'privacyTier', 'urlhausApikey', 'urlscanApikey', 'alwaysManual', 'autoScanLinks', 'timeOfClickProtection', 'ipReputationProvider', 'ipReputationApiKey', 'customBlacklist', 'customWhitelist']);
    if (result.virustotalApikey !== undefined) {
      apikey_virustotal = result.virustotalApikey;
    }
    if (result.privacyTier !== undefined) {
      privacyTier = result.privacyTier;
    }
    apikey_hybridanalysis = result.apikey;
    if (result.customBlacklist !== undefined) {
      customBlacklist = new Set(result.customBlacklist.map(s => s ? s.toLowerCase() : ""));
    }
    if (result.customWhitelist !== undefined) {
      customWhitelist = new Set(result.customWhitelist.map(s => s ? s.toLowerCase() : ""));
    }
    if (result.urlhausApikey !== undefined) {
      urlhausApikey = result.urlhausApikey;
    }
    if (result.urlscanApikey !== undefined) {
      urlscanApikey = result.urlscanApikey;
    }
    if (result.alwaysManual !== undefined) {
      alwaysManual = result.alwaysManual;
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
  }
  if (area === 'local' && changes.virustotalApikey !== undefined) {
    apikey_virustotal = changes.virustotalApikey.newValue;
  }
  if (area === 'local' && changes.privacyTier !== undefined) {
    privacyTier = changes.privacyTier.newValue;
  }
  if (area === 'local' && changes.urlhausApikey !== undefined) {
    urlhausApikey = changes.urlhausApikey.newValue;
  }
  if (area === 'local' && changes.urlscanApikey !== undefined) {
    urlscanApikey = changes.urlscanApikey.newValue;
  }
  if (area === 'local' && changes.alwaysManual !== undefined) {
    alwaysManual = changes.alwaysManual.newValue;
  }
  if (area === 'local' && changes.autoScanLinks !== undefined) {
    autoScanLinks = changes.autoScanLinks.newValue;
  }
  if (area === 'local' && changes.timeOfClickProtection !== undefined) {
    timeOfClickProtection = changes.timeOfClickProtection.newValue;
  }
  if (area === 'local' && changes.customBlacklist !== undefined) {
    customBlacklist = new Set((changes.customBlacklist.newValue || []).map(s => s ? s.toLowerCase() : ""));
  }
  if (area === 'local' && changes.customWhitelist !== undefined) {
    customWhitelist = new Set((changes.customWhitelist.newValue || []).map(s => s ? s.toLowerCase() : ""));
  }
});

function extractPublicIPs(receivedHeaders) {
    if (!receivedHeaders) return [];
    // ⚡ Bolt Optimization: Use standard array and indexOf instead of Set allocation for small unique collections
    let ips = [];

    for (let header of receivedHeaders) {
        let matches = header.match(GLOBAL_IPV4_REGEX);
        if (matches) {
            for (let ip of matches) {
                // ⚡ Bolt Optimization: Use String.prototype.indexOf and string splitting without .map(Number)
                // to avoid allocating multiple arrays and mapping over them for every IP address.
                const dot1 = ip.indexOf('.');
                const part1 = parseInt(ip.substring(0, dot1), 10);

                if (part1 === 10 || part1 === 127 || part1 === 0) {
                    continue;
                }

                const dot2 = ip.indexOf('.', dot1 + 1);
                const part2 = parseInt(ip.substring(dot1 + 1, dot2), 10);

                if (
                    (part1 === 172 && part2 >= 16 && part2 <= 31) ||
                    (part1 === 192 && part2 === 168) ||
                    (part1 === 169 && part2 === 254)
                ) {
                    continue;
                }
                if (ips.indexOf(ip) === -1) {
                    ips.push(ip);
                }
            }
        }
    }
    return ips;
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

let lev_prevRow = new Uint16Array(64);
let lev_currRow = new Uint16Array(64);

function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    if (a.length > b.length) {
        let tmp = a; a = b; b = tmp;
    }

    // ⚡ Bolt Optimization: Use typed arrays (Uint16Array) and array pooling
    // to avoid garbage collection overhead in the hot loop.
    // charCodeAt is also faster than charAt.
    if (a.length + 1 > lev_prevRow.length) {
        lev_prevRow = new Uint16Array(a.length + 1);
        lev_currRow = new Uint16Array(a.length + 1);
    }

    let prevRow = lev_prevRow;
    let currRow = lev_currRow;

    for (let j = 0; j <= a.length; j++) prevRow[j] = j;

    for (let i = 1; i <= b.length; i++) {
        currRow[0] = i;
        for (let j = 1; j <= a.length; j++) {
            if (b.charCodeAt(i - 1) === a.charCodeAt(j - 1)) {
                currRow[j] = prevRow[j - 1];
            } else {
                currRow[j] = 1 + Math.min(
                    prevRow[j - 1], // substitution
                    prevRow[j],     // deletion
                    currRow[j - 1]  // insertion
                );
            }
        }
        // Swap arrays to avoid allocating a new one next iteration
        let tmp = prevRow; prevRow = currRow; currRow = tmp;
    }
    return prevRow[a.length];
}

const KNOWN_BRANDS = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];
// ⚡ Bolt Optimization: Precompiled Set for O(1) existence checks instead of O(N) array loops
const KNOWN_BRANDS_SET = new Set(KNOWN_BRANDS);
// ⚡ Bolt Optimization: Precompiled Regex for O(1) .endsWith() checks instead of O(N) array loops
const KNOWN_BRANDS_REGEX = new RegExp(`(?:^|\\.)(${KNOWN_BRANDS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'i');

function checkLists(email, senderDomain) {
    // Check Blacklist
    if (typeof customBlacklist !== 'undefined' && customBlacklist && customBlacklist.size > 0) {
        // ⚡ Bolt Optimization: Use O(1) Set lookup instead of O(N) Array includes
        if (customBlacklist.has(email)) {
            return { score: 100, reasons: [`Absender-E-Mail (${email}) steht auf der Blacklist.`], listType: 'blacklist' };
        }
        for (let b of customBlacklist) {
            if (b && (senderDomain === b || senderDomain.endsWith('.' + b))) {
                return { score: 100, reasons: [`Absender-Domain (${senderDomain}) steht auf der Blacklist (${b}).`], listType: 'blacklist' };
            }
        }
    }

    // Check Whitelist
    if (typeof customWhitelist !== 'undefined' && customWhitelist && customWhitelist.size > 0) {
        // ⚡ Bolt Optimization: Use O(1) Set lookup instead of O(N) Array includes
        if (customWhitelist.has(email)) {
            return { score: 0, reasons: [`Absender-E-Mail (${email}) steht auf der Whitelist.`], listType: 'whitelist' };
        }
        for (let w of customWhitelist) {
            if (w && (senderDomain === w || senderDomain.endsWith('.' + w))) {
                return { score: 0, reasons: [`Absender-Domain (${senderDomain}) steht auf der Whitelist (${w}).`], listType: 'whitelist' };
            }
        }
    }
    return null;
}

function evaluateAuthHeaders(authHeaders, score, reasons) {
    let authStatus = 'neutral';
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
            authStatus = 'pass';
        }
    }
    return { score, authStatus };
}

function evaluateUrlhaus(urlhausDomains, score, reasons) {
    if (urlhausDomains && urlhausDomains.length > 0) {
        for (let domain of urlhausDomains) {
            score += 80;
            reasons.push(`Domain (${domain}) ist auf URLhaus als bösartig gelistet.`);
        }
    }
    return score;
}

function evaluateReplyTo(replyTo, senderDomain, score, reasons) {
    if (replyTo && senderDomain) {
        let replyToEmail = replyTo;
        // ⚡ Bolt Optimization: Use indexOf and substring to avoid regex allocation overhead
        const start = replyTo.indexOf('<');
        if (start !== -1) {
            const end = replyTo.indexOf('>', start + 1);
            if (end !== -1) {
                replyToEmail = replyTo.substring(start + 1, end);
            }
        }
        replyToEmail = replyToEmail.toLowerCase();

        // ⚡ Bolt Optimization: Use indexOf and substring instead of split for O(n) extraction without array allocation
        const atIndex = replyToEmail.indexOf('@');
        const replyDomain = atIndex !== -1 ? replyToEmail.substring(atIndex + 1) : "";

        if (replyDomain && replyDomain !== senderDomain) {
            score += 50;
            reasons.push(`Diskrepanz erkannt: "Reply-To" Domain (${replyDomain}) weicht von der Absender-Domain (${senderDomain}) ab.`);
        }
    }
    return score;
}

function evaluateBehavior(subject, messageText, isFirstCommunication, score, reasons) {
    // ⚡ Bolt Optimization: Call .toLowerCase() exactly once on the large combined text string
    // *before* regex execution. This avoids redundantly calling .toLowerCase() on every captured
    // match group inside the hot loop, reducing memory allocations while keeping the extracted
    // terms normalized for deduplication.
    let textToAnalyze = (subject + " " + messageText).toLowerCase();
    // ⚡ Bolt Optimization: Replace Set and Array.from with standard array and indexOf
    // to reduce allocation overhead when parsing megabytes of message body.
    let foundUrgencyWords = [];
    let match;
    URGENCY_REGEX_COMBINED.lastIndex = 0;
    while ((match = URGENCY_REGEX_COMBINED.exec(textToAnalyze)) !== null) {
        if (foundUrgencyWords.indexOf(match[1]) === -1) {
            foundUrgencyWords.push(match[1]);
        }
    }

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
    return score;
}

function getMainDomain(domain) {
    // ⚡ Bolt Optimization: Use precompiled regex instead of O(N) loop with .endsWith()
    const match = domain.match(KNOWN_BRANDS_REGEX);
    if (match) {
        return match[1].toLowerCase();
    }

    // ⚡ Bolt Optimization: Use lastIndexOf and substring instead of split/slice/join
    // to prevent intermediate array allocations in hot paths.
    const lastDot = domain.lastIndexOf('.');
    if (lastDot !== -1) {
        const secondLastDot = domain.lastIndexOf('.', lastDot - 1);
        if (secondLastDot !== -1) {
            return domain.substring(secondLastDot + 1);
        }
    }
    return domain;
}

function evaluateSenderDomain(senderDomain, score, reasons) {
    let senderMainDomain = "";
    if (senderDomain) {
        senderMainDomain = getMainDomain(senderDomain);
        // ⚡ Bolt Optimization: Use O(1) Set lookup instead of O(N) array includes
        let isSenderKnownBrand = KNOWN_BRANDS_SET.has(senderMainDomain);

        if (!isSenderKnownBrand) {
            for (let brand of KNOWN_BRANDS) {
                if (senderMainDomain.length < 4 || Math.abs(senderMainDomain.length - brand.length) > 2) continue;

                let distance = levenshteinDistance(senderMainDomain, brand);
                if (distance > 0 && distance <= 2) {
                    score += 60;
                    reasons.push(`Absender-Domain (${senderMainDomain}) ähnelt verdächtig der bekannten Marke ${brand}.`);
                    break;
                }
            }
        }
    }
    return { score, senderMainDomain };
}

// Precompiled regex for faster URL hostname extraction without new URL() overhead
const HTTP_HOSTNAME_EXTRACTOR = /^(?:https?:\/\/)([^\/\?#\\]+)/i;

function getHostnameOptimized(url) {
    let match = HTTP_HOSTNAME_EXTRACTOR.exec(url);
    if (match) {
        let host = match[1];
        // Fallback to new URL if complex parsing is needed (e.g. basic auth, ports, IPv6)
        if (host.includes('@') || host.includes(':')) {
             return new URL(url).hostname;
        }
        return host.toLowerCase();
    }
    return new URL(url).hostname.toLowerCase();
}

function evaluateLinks(urls, senderDomain, senderMainDomain, score, reasons) {
    // ⚡ Bolt Optimization: Use standard array and indexOf instead of Set allocation for small unique collections
    let linkDomains = [];
    for (let url of urls) {
        try {
            // ⚡ Bolt Optimization: Use fast regex parsing for standard HTTP URLs to avoid `new URL()` instantiation overhead
            let hostname = getHostnameOptimized(url);
            if (linkDomains.indexOf(hostname) === -1) {
                linkDomains.push(hostname);
            }
        } catch (e) { /* Ignore invalid URLs */ }
    }

    if (linkDomains.length > 0 && senderDomain) {
        let matchFound = false;
        let typosquatLinkFound = false;
        let checkedMainDomains = new Map();

        for (let ld of linkDomains) {
            if (ld === senderDomain || ld.endsWith('.' + senderDomain) || senderDomain.endsWith('.' + ld)) {
                matchFound = true;
            } else if (senderMainDomain && (ld === senderMainDomain || ld.endsWith('.' + senderMainDomain))) {
                 matchFound = true;
            }

            let linkMainDomain = getMainDomain(ld);
            // ⚡ Bolt Optimization: Use O(1) Set lookup instead of O(N) array includes
            let isLinkKnownBrand = KNOWN_BRANDS_SET.has(linkMainDomain);

            if (!isLinkKnownBrand) {
                let cachedBrandMatch = checkedMainDomains.get(linkMainDomain);
                if (cachedBrandMatch !== undefined) {
                    if (cachedBrandMatch !== null) {
                        typosquatLinkFound = true;
                        if (!reasons.some(r => r.includes(linkMainDomain))) {
                            reasons.push(`Link-Domain (${linkMainDomain}) ähnelt verdächtig der bekannten Marke ${cachedBrandMatch}.`);
                        }
                    }
                    continue;
                }

                let foundTyposquat = false;
                for (let brand of KNOWN_BRANDS) {
                    if (linkMainDomain.length < 4 || Math.abs(linkMainDomain.length - brand.length) > 2) continue;

                    let distance = levenshteinDistance(linkMainDomain, brand);
                    if (distance > 0 && distance <= 2) {
                        foundTyposquat = true;
                        typosquatLinkFound = true;
                        checkedMainDomains.set(linkMainDomain, brand);
                        if (!reasons.some(r => r.includes(linkMainDomain))) {
                            reasons.push(`Link-Domain (${linkMainDomain}) ähnelt verdächtig der bekannten Marke ${brand}.`);
                        }
                        // Found a match, no need to check other brands for the same domain
                        break;
                    }
                }
                if (!foundTyposquat) {
                    checkedMainDomains.set(linkMainDomain, null);
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
    return score;
}

function calculateThreatScore(author, urls, options = {}) {
    const {
        authHeaders = [],
        urlhausDomains = [],
        isFirstCommunication = false,
        messageText = "",
        subject = "",
        replyTo = ""
    } = options;
    let score = 0;
    let reasons = [];

    let email = author;
    // ⚡ Bolt Optimization: Use indexOf and substring to avoid regex allocation overhead
    const start = author.indexOf('<');
    if (start !== -1) {
        const end = author.indexOf('>', start + 1);
        if (end !== -1) {
            email = author.substring(start + 1, end);
        }
    }
    email = email.toLowerCase();

    // ⚡ Bolt Optimization: Use indexOf and substring instead of split for O(n) extraction without array allocation
    let atIndex = email.indexOf('@');
    let senderDomain = atIndex !== -1 ? email.substring(atIndex + 1).toLowerCase() : "";

    const listCheck = checkLists(email, senderDomain);
    if (listCheck) {
        return { score: listCheck.score, reasons: listCheck.reasons, authStatus: 'neutral' };
    }

    const authEval = evaluateAuthHeaders(authHeaders, score, reasons);
    score = authEval.score;
    let authStatus = authEval.authStatus;

    score = evaluateUrlhaus(urlhausDomains, score, reasons);
    score = evaluateReplyTo(replyTo, senderDomain, score, reasons);
    score = evaluateBehavior(subject, messageText, isFirstCommunication, score, reasons);

    const senderEval = evaluateSenderDomain(senderDomain, score, reasons);
    score = senderEval.score;
    let senderMainDomain = senderEval.senderMainDomain;

    score = evaluateLinks(urls, senderDomain, senderMainDomain, score, reasons);

    return { score: Math.min(score, 100), reasons: reasons, authStatus: authStatus };
}

async function processAndUploadUrls(message, filteredUrls) {
    if (privacyTier === 'max') {
        const urlResults = await Promise.all(filteredUrls.map(async (url) => {
            try {
                const formBody = new URLSearchParams();
                formBody.append('scan_type', 'all');
                formBody.append('url', url);

                const options = getHybridAnalysisOptions('POST', formBody, true);
                options.url = 'https://hybrid-analysis.com/api/v2/quick-scan/url';
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

async function injectTimeOfClickProtection(tabId, filteredUrls) {
    if (timeOfClickProtection && filteredUrls.length > 0) {
        await browser.scripting.executeScript({
            target: { tabId: tabId },
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
}

async function checkIPReputation(receivedHeaders) {
    let maliciousIps = [];
    if (ipReputationProvider !== "none" && ipReputationApiKey) {
        let publicIps = extractPublicIPs(receivedHeaders);
        let ipChecks = publicIps.map(async (ip) => {
            if (ipReputationCache.has(ip)) {
                return { ip, isMalicious: await ipReputationCache.get(ip) };
            }

            let promise = (async () => {
                let isMalicious = false;
                try {
                    if (ipReputationProvider === "abuseipdb") {
                        isMalicious = await checkAbuseIPDB(ip, ipReputationApiKey);
                    } else if (ipReputationProvider === "virustotal") {
                        isMalicious = await checkVirusTotalIP(ip, ipReputationApiKey);
                    }
                } catch(e) { console.error(e); }
                return isMalicious;
            })();

            if (ipReputationCache.size >= MAX_IP_CACHE) {
                ipReputationCache.clear();
            }
            ipReputationCache.set(ip, promise);

            let isMalicious = await promise;
            ipReputationCache.set(ip, isMalicious);

            return { ip, isMalicious };
        });

        let results = await Promise.all(ipChecks);
        for (let result of results) {
            if (result.isMalicious) {
                maliciousIps.push(result.ip);
            }
        }
    }
    return maliciousIps;
}

async function checkFirstCommunication(senderEmail) {
    let isFirstCommunication = false;
    try {
        if (browser.messages.query) {
            if (knownSendersCache.has(senderEmail)) {
                isFirstCommunication = false;
            } else {
                let previousMsgs = await browser.messages.query({ to: senderEmail });
                if (previousMsgs && previousMsgs.messages && previousMsgs.messages.length === 0) {
                    isFirstCommunication = true;
                } else {
                    if (knownSendersCache.size > MAX_KNOWN_SENDERS) {
                        knownSendersCache.clear();
                    }
                    knownSendersCache.add(senderEmail);
                }
            }
        }
    } catch (e) {
        console.log("Fehler bei messages.query (Möglicherweise nicht unterstützt):", e);
    }
    return isFirstCommunication;
}

async function checkURLhausDomains(filteredUrls) {
    let urlhausDomains = [];
    if (urlhausApikey && filteredUrls.length > 0) {
        // ⚡ Bolt Optimization: Use standard array and indexOf instead of Set allocation for small unique collections
        let linkDomains = [];
        for (let url of filteredUrls) {
            try {
                // ⚡ Bolt Optimization: Use fast regex parsing for standard HTTP URLs to avoid `new URL()` instantiation overhead
                let hostname = getHostnameOptimized(url);
                if (linkDomains.indexOf(hostname) === -1) {
                    linkDomains.push(hostname);
                }
            } catch (e) { /* Ignore invalid URLs */ }
        }

        const domainChecks = linkDomains.map(async (domain) => {
            if (urlhausCache.has(domain)) {
                return await urlhausCache.get(domain) ? domain : null;
            }

            let checkPromise = checkURLhaus(domain, urlhausApikey);

            if (urlhausCache.size >= MAX_URLHAUS_CACHE_SIZE) {
                const firstKey = urlhausCache.keys().next().value;
                urlhausCache.delete(firstKey);
            }
            urlhausCache.set(domain, checkPromise);

            let isMalicious = await checkPromise;
            urlhausCache.set(domain, isMalicious);

            if (isMalicious) {
                return domain;
            }
            return null;
        });

        const checkResults = await Promise.all(domainChecks);
        urlhausDomains = checkResults.filter(d => d !== null);
    }
    return urlhausDomains;
}

async function injectThreatBanner(tabId, threat) {
    if (threat.score >= 50 || threat.authStatus === 'pass') {
        await browser.scripting.executeScript({
            target: { tabId: tabId },
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
}

async function processAttachments(message) {
  let attachments = await browser.messages.listAttachments(message.id);

  if (attachments.length > 0) {
    await sent_to_hybrid_by_attachment(message, attachments);
  }
}

async function processLinks(tab, message, fullMessage) {
  let messageText = extractTextFromParts(fullMessage.parts || fullMessage);
  let urls = extractUrls(messageText);
  let filteredUrls = filterUrls(urls);

  console.log("Gefundene URLs:", filteredUrls);
  if (filteredUrls.length > 0) {
    await processAndUploadUrls(message, filteredUrls);
  }

  // Wenn timeOfClickProtection aktiv ist, senden wir eine Nachricht an den Content-Script
  await injectTimeOfClickProtection(tab.id, filteredUrls);

  return { messageText, urls, filteredUrls };
}

async function evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText }) {
  let authHeaders = (fullMessage.headers && fullMessage.headers['authentication-results']) || [];
  let receivedHeaders = (fullMessage.headers && fullMessage.headers['received']) || [];

  let maliciousIps = await checkIPReputation(receivedHeaders);

  // BEC Protection Data Extraction
  let senderEmail = message.author;
  // ⚡ Bolt Optimization: Use indexOf and substring to avoid regex allocation overhead
  const start = message.author.indexOf('<');
  if (start !== -1) {
      const end = message.author.indexOf('>', start + 1);
      if (end !== -1) {
          senderEmail = message.author.substring(start + 1, end);
      }
  }
  senderEmail = senderEmail.toLowerCase();

  let isFirstCommunication = await checkFirstCommunication(senderEmail);

  let replyTo = "";
  if (fullMessage.headers && fullMessage.headers['reply-to']) {
      replyTo = fullMessage.headers['reply-to'][0];
  }

  let subject = message.subject || "";
  let urlhausDomains = await checkURLhausDomains(filteredUrls);

  let threat = calculateThreatScore(message.author, urls, {
    authHeaders,
    urlhausDomains,
    isFirstCommunication,
    messageText,
    subject,
    replyTo
  });

  await injectThreatBanner(tab.id, threat);
}

// Hauptfunktion: Wird ausgelöst, wenn eine Nachricht angezeigt wird
async function tab_mail_open_display(tab, message) {
  try {
    await processAttachments(message);

    let fullMessage = await browser.messages.getFull(message.id);
    let { messageText, urls, filteredUrls } = await processLinks(tab, message, fullMessage);

    await evaluateAndInjectThreats({ tab, message, fullMessage, urls, filteredUrls, messageText });
  } catch (error) {
    console.log(`Fehler beim Laden der Anhänge oder Links: ${error}`);
  }
}

function extractTextFromParts(part, partsArray) {
  const isRoot = partsArray === undefined;
  if (isRoot) {
      partsArray = [];
  }

  if (part.contentType === "text/plain" || part.contentType === "text/html") {
      if (part.body) {
         partsArray.push(part.body + " ");
      }
  }
  if (part.parts) {
      for (let subPart of part.parts) {
          extractTextFromParts(subPart, partsArray);
      }
  }

  if (isRoot) {
      return partsArray.join("");
  }
}

function extractUrls(text) {
    const urls = [];
    let match;
    GLOBAL_URL_REGEX.lastIndex = 0; // Reset lastIndex for global regex
    const punct = ".,;:!)]";
    while ((match = GLOBAL_URL_REGEX.exec(text)) !== null) {
        let url = match[1];
        // ⚡ Bolt Optimization: Fast manual loop for stripping punctuation instead of regex
        let len = url.length;
        while(len > 0 && punct.indexOf(url[len - 1]) !== -1) {
            len--;
        }
        if (len !== url.length) {
            url = url.substring(0, len);
        }
        // ⚡ Bolt Optimization: Use Array indexOf instead of Set allocation for small arrays
        if (urls.indexOf(url) === -1) {
            urls.push(url);
        }
    }
    return urls;
}

const IGNORED_DOMAINS = [
    'w3.org', 'google.com', 'microsoft.com', 'apple.com',
    'mozilla.org', 'schemas.microsoft.com', 'yahoo.com', 'github.com'
];
// Precompiled regex for faster O(1) checks instead of O(N) array loops
const IGNORED_DOMAINS_REGEX = new RegExp(`(?:^|\\.)(${IGNORED_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|')})$`, 'i');

function filterUrls(urls) {
    return urls.filter(url => {
        try {
            // ⚡ Bolt Optimization: Use fast regex parsing for standard HTTP URLs to avoid `new URL()` instantiation overhead
            let hostname = getHostnameOptimized(url);
            // ⚡ Bolt Optimization: Use precompiled regex instead of iterating over ignoredDomains array
            return !IGNORED_DOMAINS_REGEX.test(hostname);
        } catch (e) {
            return false; // Ungültige URL
        }
    });
}

// Funktion zum Senden der Anhänge an Hybrid Analysis
async function get_sha256_hash(fileData) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileData);
    const u8 = new Uint8Array(hashBuffer);
    let hashStr = '';
    // ⚡ Bolt Optimization: Use fast loop with LUT instead of Array.from().map().join('')
    for (let j = 0; j < u8.length; j++) hashStr += byteToHex[u8[j]];
    return hashStr;
}

class HybridDataBuilder {
    static create(submissionId, jobId, sha256, state, attachment, virustotalStats = null) {
        return {
            hybrid_data: {
                submission_id: submissionId,
                job_id: jobId,
                sha256,
                state,
                partName: attachment.partName
            },
            attachmentName: attachment.name,
            ...(virustotalStats && { virustotal_stats: virustotalStats })
        };
    }
}

async function handle_unknown_attachment({ attachment, content_of_attachment, local_hash, virustotal_stats, privacyTier, fileType }) {
    if (privacyTier === 'balanced' || privacyTier === 'max') {
        console.log('Lade unbekannte Datei automatisch hoch...');
        try {
            const file_to_submit = new File([content_of_attachment], attachment.name, { type: fileType || 'application/octet-stream' });
            const formData = new FormData();
            formData.append('scan_type', 'all');
            formData.append('file', file_to_submit);

            const uploadOptions = getHybridAnalysisOptions('POST', formData);
            uploadOptions.url = 'https://hybrid-analysis.com/api/v2/quick-scan/file';
            const uploadResponse = await fetch(uploadOptions.url, uploadOptions);
            if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                const uploadData = await uploadResponse.json();
                return HybridDataBuilder.create(
                    uploadData.submission_id,
                    uploadData.job_id,
                    uploadData.sha256 || local_hash,
                    'UPLOADED',
                    attachment
                );
            } else {
                console.error('Fehler beim automatischen Upload, falle auf manuell zurück.');
            }
        } catch (uploadError) {
            console.error('Ausnahme beim automatischen Upload, falle auf manuell zurück.', uploadError);
        }
    }

    return HybridDataBuilder.create(
        'PENDING_UPLOAD',
        'PENDING_UPLOAD',
        local_hash,
        'UNKNOWN',
        attachment,
        virustotal_stats
    );
}


async function fetch_virustotal_stats(local_hash, apikey) {
    if (apikey) {
        return await checkVirusTotal(local_hash, apikey);
    }
    return null;
}

function create_manual_check_hybrid_data(local_hash, attachment, virustotal_stats) {
    return HybridDataBuilder.create(
        'MANUAL_CHECK',
        'MANUAL_CHECK',
        local_hash,
        'MANUAL_CHECK_PENDING',
        attachment,
        virustotal_stats
    );
}

async function check_hybrid_analysis_for_attachment(local_hash, attachment, content_of_attachment, virustotal_stats, file_type) {
    const optionsCheck = getHybridAnalysisOptions('GET');
    optionsCheck.url = 'https://hybrid-analysis.com/api/v2/overview/' + local_hash;
    const responseCheck = await fetch(optionsCheck.url, optionsCheck);

    if (responseCheck.status === 200) {
        const json_data = await responseCheck.json();
        console.log('Datei ist der API bereits bekannt.');
        return HybridDataBuilder.create(
            json_data.submission_id || 'N/A',
            json_data.job_id || 'N/A',
            local_hash,
            'KNOWN',
            attachment,
            virustotal_stats
        );
    } else {
        return await handle_unknown_attachment({
            attachment,
            content_of_attachment,
            local_hash,
            virustotal_stats,
            privacyTier,
            fileType: file_type
        });
    }
}


async function process_single_attachment(message, attachment) {
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
            const content_of_attachment = file.slice();
            const arrayBuffer = await content_of_attachment.arrayBuffer();
            const local_hash = await get_sha256_hash(arrayBuffer);

            const virustotal_stats = await fetch_virustotal_stats(local_hash, apikey_virustotal);

            if (alwaysManual) {
                return create_manual_check_hybrid_data(local_hash, attachment, virustotal_stats);
            }

            return await check_hybrid_analysis_for_attachment(
                local_hash,
                attachment,
                content_of_attachment,
                virustotal_stats,
                file.type
            );

        } catch (error) {
          console.error('Netzwerk- oder Verarbeitungsfehler beim Überprüfen:', error);
          return null;
        }
    }
}


async function sent_to_hybrid_by_attachment(message, attachments) {
  if (!apikey_hybridanalysis) {
      console.error("Kein API-Key gefunden. Bitte in den Einstellungen hinterlegen.");
      return;
  }

  const results = await Promise.all(attachments.map(async (attachment) => {
    return await process_single_attachment(message, attachment);
  }));

  const validResults = results.filter(r => r !== null);
  if (validResults.length > 0) {
      await indexedDB_save_batch_hybrid_data_to_db(message, validResults);
  }
}

async function indexedDB_save_batch_hybrid_data_to_db(message, results) {
  try {
    const db = await getSharedDB();

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

          const existingAttMap = new Map();
          recordToSave.attachments.forEach((a, i) => existingAttMap.set(a.attachment_name, i));

          for (const newAtt of newAttachments) {
              const existingAttIndex = existingAttMap.get(newAtt.attachment_name);
              if (existingAttIndex !== undefined) {
                  recordToSave.attachments[existingAttIndex] = newAtt;
              } else {
                  existingAttMap.set(newAtt.attachment_name, recordToSave.attachments.length);
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
    const db = await getSharedDB();

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

          // Pre-compute map for O(1) lookups, changing complexity from O(N*M) to O(N+M)
          const existingUrlMap = new Map(recordToSave.links.map((l, idx) => [l.url, idx]));
          for (const newLink of newLinks) {
            if (existingUrlMap.has(newLink.url)) {
                recordToSave.links[existingUrlMap.get(newLink.url)] = newLink;
            } else {
                recordToSave.links.push(newLink);
                existingUrlMap.set(newLink.url, recordToSave.links.length - 1);
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
    console.error('IndexedDB (Links) Save Error:', error);
  }
}

async function indexedDB_save_links_to_db(message, urls) {
  try {
    const db = await getSharedDB();

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

          // Pre-compute Set for O(1) lookups, changing complexity from O(N*M) to O(N+M)
          const existingUrls = new Set(recordToSave.links.map(l => l.url));
          for (const newLink of newLinks) {
            if (!existingUrls.has(newLink.url)) {
              recordToSave.links.push(newLink);
              existingUrls.add(newLink.url); // Keep Set in sync with newly added links
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

// Listener registrieren
browser.messageDisplay.onMessageDisplayed.addListener(tab_mail_open_display);

if (browser.menus) browser.menus.create({
    id: "scan-link-thundy",
    title: "Link mit Thundy scannen",
    contexts: ["link"]
});

if (browser.menus && browser.menus.onClicked) browser.menus.onClicked.addListener(async (info, tab) => {
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
            } catch (e) {
                console.error("Failed to get displayed message for context menu scan:", e);
            }

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

async function handleCheckLinkState(request, sender, sendResponse) {
    try {
        // Need to find the active message to get headerMessageId
        const message = await browser.messageDisplay.getDisplayedMessage(sender.tab.id);
        if (!message || !message.headerMessageId) {
            sendResponse({status: 'UNKNOWN'});
            return;
        }

        const db = await getSharedDB();
        const record = await getFromStore(db, "hybridanalysis", message.headerMessageId);

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
                    sendResponse({ status: res.status, reasons: res.reasons });
                    return;
                }
            } catch (e) {
                console.log("Fehler bei Time-of-Click Live-Scan:", e);
            }
        }

        if (linkObj) {
            const status = await checkHybridAnalysisVerdict(linkObj.hybrid_sha256, linkObj.state);
            sendResponse({status: status});
        } else {
            sendResponse({status: 'UNKNOWN'});
        }
    } catch (err) {
        sendResponse({status: 'ERROR'});
    }
}

async function checkHybridAnalysisVerdict(hybrid_sha256, fallbackState) {
    if (hybrid_sha256 && apikey_hybridanalysis) {
        const overviewOptions = getHybridAnalysisOptions('GET');
        overviewOptions.url = 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha256;
        try {
            const response = await fetch(overviewOptions.url, overviewOptions);
            const json_data = await response.json();
            if (json_data.verdict) {
                if (json_data.verdict === 'no specific threat') {
                    return 'CLEAN';
                } else {
                    return json_data.verdict.toUpperCase();
                }
            } else {
                return fallbackState;
            }
        } catch (err) {
            return fallbackState;
        }
    } else {
        return fallbackState || 'UNKNOWN';
    }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "uploadAttachment":
            handleManualUpload(request.messageId, request.partName, request.attachmentName, request.hash, request.headerMessageId)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message}));
            return true;

        case "scanUrl":
            handleUrlScan(request.url, request.headerMessageId)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message}));
            return true;

        case "checkLinkState":
            handleCheckLinkState(request, sender, sendResponse);
            return true;

        case "downloadDisarmed":
            handleDownloadDisarmed(request.messageId, request.partName, request.attachmentName)
                .then(res => sendResponse({status: 'success', data: res}))
                .catch(err => sendResponse({status: 'error', message: err.message}));
            return true;

        default:
            return false;
    }
});

/**
 * Handles the "downloadDisarmed" message to sanitize and download an HTML attachment.
 * Called dynamically via background messaging (e.g., from api.js).
 *
 * @param {number} messageId - The ID of the message containing the attachment.
 * @param {string} partName - The part name of the attachment.
 * @param {string} [attachmentName] - The optional name of the file to save as.
 * @returns {Promise<{downloadId: number}>} Resolves with the download ID.
 */
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
    // Prevent path traversal by extracting the basename and replacing suspicious characters
    let safeName = attachmentName || 'disarmed.html';
    safeName = safeName.split(/[\/\\]/).pop().replace(/[^a-zA-Z0-9_\-\.]/g, '_');

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

// ⚡ Bolt Optimization: Precompiled Set for O(1) attribute lookup
const dangerousAttributes = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

// ⚡ Bolt Optimization: Precompiled Set for O(1) tag lookup.
// Moved outside the function to avoid redundant memory allocations and garbage collection
// overhead on every invocation, preserving the Set.has() performance benefit.
const activeTags = new Set(['script', 'object', 'embed', 'iframe', 'base', 'meta', 'applet', 'link', 'math', 'svg', 'noscript']);

function disarmHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const nodesToRemove = [];

    // ⚡ Bolt Optimization: Merge tag removal and attribute sanitization into a single TreeWalker pass.
    // This eliminates the redundant DOM traversal previously caused by calling querySelectorAll
    // before the TreeWalker loop, significantly reducing overhead on large HTML payloads.
    function processRoot(root) {
        const walker = doc.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);
        let el = walker.currentNode;
        while (el) {
            // For DocumentFragment, nodeType is 11, but SHOW_ELEMENT only shows elements (nodeType 1).
            if (el.nodeType === 1) {
                if (activeTags.has(el.tagName.toLowerCase())) {
                    nodesToRemove.push(el);
                } else {
                    if (el.hasAttributes()) {
                        for (let j = el.attributes.length - 1; j >= 0; j--) {
                            const attrName = el.attributes[j].name.toLowerCase();
                            if (attrName.startsWith('on')) {
                                el.removeAttribute(attrName);
                                continue;
                            }
                            if (dangerousAttributes.has(attrName)) {
                                let val = el.attributes[j].value;
                                // Remove control characters (like tabs/newlines) that might evade the check
                                let cleanVal = val.replace(/[\x00-\x20\x7F-\x9F\uFFFD]/g, '').toLowerCase();
                                if (cleanVal.startsWith('javascript:') || cleanVal.startsWith('data:') || cleanVal.startsWith('vbscript:')) {
                                    el.removeAttribute(attrName);
                                }
                            }
                        }
                    }
                    if (el.tagName.toLowerCase() === 'template' && el.content) {
                        processRoot(el.content);
                    }
                }
            }
            el = walker.nextNode();
        }
    }

    processRoot(doc.documentElement);

    // Remove active tags collected during the pass
    for (let i = nodesToRemove.length - 1; i >= 0; i--) {
        if (nodesToRemove[i].parentNode) {
            nodesToRemove[i].parentNode.removeChild(nodesToRemove[i]);
        }
    }

    return doc.documentElement.outerHTML;
}

async function handleUrlScan(url, headerMessageId) {
    if (!apikey_hybridanalysis) throw new Error("API-Key fehlt.");

    const formBody = new URLSearchParams();
    formBody.append('scan_type', 'all');
    formBody.append('url', url);

    const options = getHybridAnalysisOptions('POST', formBody, true);
    options.url = 'https://hybrid-analysis.com/api/v2/quick-scan/url';

    const response = await fetch(options.url, options);
    const json_data = await response.json();

    if (response.status === 200 || response.status === 201) {
        console.log('URL manuell an Hybrid Analysis gesendet.');

        // Update DB record
        try {
            const db = await getSharedDB();
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

    const options = getHybridAnalysisOptions('POST', formData);
    options.url = 'https://hybrid-analysis.com/api/v2/quick-scan/file';

    const response = await fetch(options.url, options);
    const json_data = await response.json();

    if (response.status === 200 || response.status === 201) {
        console.log('Datei manuell an Hybrid Analysis gesendet.');

        // Update DB record
        try {
            const db = await getSharedDB();
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
    if (vtCache.has(hash)) {
        return await vtCache.get(hash);
    }

    let checkPromise = (async () => {
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
    })();

    if (vtCache.size >= MAX_VT_CACHE_SIZE) {
        const firstKey = vtCache.keys().next().value;
        vtCache.delete(firstKey);
    }
    vtCache.set(hash, checkPromise);

    let stats = await checkPromise;
    if (stats === null) {
        // Remove from cache on failure so it can be retried
        vtCache.delete(hash);
    }
    return stats;
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
        let waitTime = 2000;
        let elapsed = 0;
        const maxTime = 30000;

        while (elapsed < maxTime) {
            await new Promise(r => setTimeout(r, waitTime));
            elapsed += waitTime;
            waitTime = Math.min(waitTime * 1.5, 10000); // 1.5x backoff, max 10s

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
