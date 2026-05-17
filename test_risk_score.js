let customBlacklist = [];
let customWhitelist = [];
let authStatus = null;
const URGENCY_WORDS = ['überweisung', 'schnell', 'ceo', 'dringend', 'sofort', 'wichtig', 'payment', 'urgent', 'rechnung', 'fällig', 'passwort', 'konto', 'transfer', 'bank'];
const URGENCY_REGEX_COMBINED = new RegExp(`(?:^|[^\\wäöüßÄÖÜ])(${URGENCY_WORDS.join('|')})(?=[^\\wäöüßÄÖÜ]|$)`, 'gi');

function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    if (a.length > b.length) {
        let tmp = a; a = b; b = tmp;
    }

    let prevRow = [];
    for (let j = 0; j <= a.length; j++) prevRow[j] = j;

    for (let i = 1; i <= b.length; i++) {
        let currRow = [i];
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                currRow[j] = prevRow[j - 1];
            } else {
                currRow[j] = 1 + Math.min(
                    prevRow[j - 1], // substitution
                    prevRow[j],     // deletion
                    currRow[j - 1]  // insertion
                );
            }
        }
        prevRow = currRow;
    }
    return prevRow[a.length];
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
    let authStatus = 'neutral';
    const knownBrands = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];

    let emailMatch = author.match(/<([^>]+)>/);
    let email = emailMatch ? emailMatch[1].toLowerCase() : author.toLowerCase();
    let parts = email.split('@');
    let senderDomain = parts.length === 2 ? parts[1].toLowerCase() : "";

    // Check Blacklist
    if (typeof customBlacklist !== 'undefined' && customBlacklist && customBlacklist.length > 0) {
        if (typeof customBlacklist !== 'undefined' && customBlacklist.includes(email)) {
            return { score: 100, reasons: [`Absender-E-Mail (${email}) steht auf der Blacklist.`] };
        }
        for (let b of customBlacklist) {
            if (b && (senderDomain === b || senderDomain.endsWith('.' + b))) {
                return { score: 100, reasons: [`Absender-Domain (${senderDomain}) steht auf der Blacklist (${b}).`] };
            }
        }
    }

    // Check Whitelist
    if (typeof customWhitelist !== 'undefined' && customWhitelist && customWhitelist.length > 0) {
        if (typeof customWhitelist !== 'undefined' && customWhitelist.includes(email)) {
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

    emailMatch = author.match(/<([^>]+)>/);
    email = emailMatch ? emailMatch[1].toLowerCase() : author.toLowerCase();
    parts = email.split('@');
    senderDomain = parts.length === 2 ? parts[1].toLowerCase() : "";

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
    let textToAnalyze = (subject + " " + messageText).toLowerCase();

    let foundUrgencyWords = [];
    let match;
    URGENCY_REGEX_COMBINED.lastIndex = 0;
    while ((match = URGENCY_REGEX_COMBINED.exec(textToAnalyze)) !== null) {
        foundUrgencyWords.push(match[1].toLowerCase());
    }
    foundUrgencyWords = [...new Set(foundUrgencyWords)];

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

    return { score: Math.min(score, 100), reasons: reasons };
}

console.log("Test 0: Legit subdomain sender, root link", calculateThreatScore("Service <service@service.paypal.com>", ["http://paypal.com/login"]));
console.log("Test 1: Typosquatting sender", calculateThreatScore("Service <service@paypa1.com>", []));
console.log("Test 2: Domain mismatch", calculateThreatScore("Service <service@paypal.com>", ["http://login.hacker.com/123"]));
console.log("Test 3: Both", calculateThreatScore("Service <service@paypal-support.com>", ["http://login.paypa1.com"]));
console.log("Test 4: Legitimate", calculateThreatScore("Service <service@paypal.com>", ["http://paypal.com/login", "http://info.paypal.com/test"]));

console.log("Test 5: SPF fail", calculateThreatScore("Service <service@paypal.com>", [], { authHeaders: ["spf=fail"] }));
console.log("Test 6: DKIM fail", calculateThreatScore("Service <service@paypal.com>", [], { authHeaders: ["dkim=fail"] }));
console.log("Test 7: URLhaus listing", calculateThreatScore("Service <service@paypal.com>", ["http://malware.example.com"], { urlhausDomains: ["malware.example.com"] }));
console.log("Test 8: Multiple fails", calculateThreatScore("Hacker <hacker@evil.com>", ["http://evil.com/bad"], { authHeaders: ["spf=fail dkim=fail"], urlhausDomains: ["evil.com"] }));

console.log("Test 9: Reply-To discrepancy", calculateThreatScore("CEO <ceo@company.com>", [], { messageText: "Hello", subject: "Hi", replyTo: "Hacker <hacker@evil.com>" }));
console.log("Test 10: BEC (First comm + urgency)", calculateThreatScore("CEO <ceo@company.com>", [], { isFirstCommunication: true, messageText: "Bitte schnell überweisung tätigen.", subject: "Wichtig!" }));
console.log("Test 11: First comm, no urgency", calculateThreatScore("Bob <bob@example.com>", [], { isFirstCommunication: true, messageText: "Hi there", subject: "Hello" }));
