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
