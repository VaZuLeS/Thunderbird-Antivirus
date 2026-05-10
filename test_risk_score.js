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

function calculateThreatScore(author, urls) {
    let score = 0;
    let reasons = [];
    const knownBrands = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];

    const emailMatch = author.match(/<([^>]+)>/);
    let email = emailMatch ? emailMatch[1] : author;
    const parts = email.split('@');
    let senderDomain = parts.length === 2 ? parts[1].toLowerCase() : "";

    if (senderDomain) {
        for (let brand of knownBrands) {
            if (senderDomain !== brand) {
                let distance = levenshteinDistance(senderDomain, brand);
                if (distance > 0 && distance <= 2 && senderDomain.length >= 4) {
                    score += 60;
                    reasons.push(`Absender-Domain (${senderDomain}) ähnelt verdächtig der bekannten Marke ${brand}.`);
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
            if (ld === senderDomain || ld.endsWith('.' + senderDomain)) {
                matchFound = true;
            }
            for (let brand of knownBrands) {
                if (ld !== brand && !ld.endsWith('.' + brand)) {
                    let mainDomainPart = ld;
                    const ldParts = ld.split('.');
                    if (ldParts.length >= 2) {
                        mainDomainPart = ldParts.slice(-2).join('.');
                    }
                    let distance = levenshteinDistance(mainDomainPart, brand);
                    if (distance > 0 && distance <= 2 && mainDomainPart.length >= 4) {
                        typosquatLinkFound = true;
                        if (!reasons.some(r => r.includes(mainDomainPart))) {
                            reasons.push(`Link-Domain (${mainDomainPart}) ähnelt verdächtig der bekannten Marke ${brand}.`);
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

console.log("Test 1: Typosquatting sender", calculateThreatScore("Service <service@paypa1.com>", []));
console.log("Test 2: Domain mismatch", calculateThreatScore("Service <service@paypal.com>", ["http://login.hacker.com/123"]));
console.log("Test 3: Both", calculateThreatScore("Service <service@paypal-support.com>", ["http://login.paypa1.com"]));
console.log("Test 4: Legitimate", calculateThreatScore("Service <service@paypal.com>", ["http://paypal.com/login", "http://info.paypal.com/test"]));
