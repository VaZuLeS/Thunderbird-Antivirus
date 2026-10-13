// Message language is independent of the UI language. These are transparent heuristics.
const STRONG_URGENCY_WORDS = ['schnell', 'dringend', 'sofort', 'wichtig', 'urgent', 'asap', 'immediately', 'immédiatement', 'urgente', 'inmediatamente', 'subito', 'immediatamente', 'pilne', 'pilnie', 'natychmiast', 'ważne', 'szybko'];
const URGENCY_WORDS = [...STRONG_URGENCY_WORDS, 'überweisung', 'ceo', 'payment', 'rechnung', 'fällig', 'passwort', 'konto', 'transfer', 'bank', 'facture', 'virement', 'pago', 'contraseña', 'pagamento', 'fattura', 'przelew', 'hasło'];
const STRONG_URGENCY_SET = new Set(STRONG_URGENCY_WORDS);
const URGENCY_REGEX = new RegExp('(^|[^\\p{L}\\p{N}_])(' + URGENCY_WORDS.join('|') + ')(?![\\p{L}\\p{N}_])', 'giu');
const FAST_URGENCY_REGEX = new RegExp(STRONG_URGENCY_WORDS.join('|'), 'iu');

let lev_prevRow = new Uint16Array(64);
let lev_currRow = new Uint16Array(64);

function levenshteinDistance(a, b) {
    // ⚡ Bolt Optimization: Fast-path for identical strings early
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    if (a.length > b.length) {
        let tmp = a; a = b; b = tmp;
    }

    // ⚡ Bolt Optimization: Cached string lengths and hoisted charCodeAt evaluation for the outer loop to eliminate repeated property lookups in the hot nested loop.
    const aLen = a.length;
    const bLen = b.length;

    if (aLen + 1 > lev_prevRow.length) {
        lev_prevRow = new Uint16Array(aLen + 1);
        lev_currRow = new Uint16Array(aLen + 1);
    }

    let prevRow = lev_prevRow;
    let currRow = lev_currRow;

    for (let j = 0; j <= aLen; j++) prevRow[j] = j;

    for (let i = 1; i <= bLen; i++) {
        currRow[0] = i;
        const bChar = b.charCodeAt(i - 1);
        for (let j = 1; j <= aLen; j++) {
            if (bChar === a.charCodeAt(j - 1)) {
                currRow[j] = prevRow[j - 1];
            } else {
                // ⚡ Bolt Optimization: Use manual comparison instead of Math.min to avoid function call overhead
                let sub = prevRow[j - 1];
                let del = prevRow[j];
                let ins = currRow[j - 1];
                let min = sub < del ? sub : del;
                if (ins < min) min = ins;

                currRow[j] = 1 + min;
            }
        }
        // Swap arrays to avoid allocating a new one next iteration
        let tmp = prevRow; prevRow = currRow; currRow = tmp;
    }
    return prevRow[aLen];
}

const KNOWN_BRANDS = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];
const KNOWN_BRANDS_SET = new Set(KNOWN_BRANDS);
const KNOWN_BRANDS_REGEX = new RegExp(`(?:^|\\.)(${KNOWN_BRANDS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')).join('|')})$`, 'i');

function checkLists(email, senderDomain) {
    if (email) email = email.toLowerCase();
    if (senderDomain) senderDomain = senderDomain.toLowerCase();

    // Check Blacklist
    if (typeof customBlacklist !== 'undefined' && customBlacklist && customBlacklist.size > 0) {
        if (customBlacklist.has(email)) {
            return { score: 100, reasons: [uiText('reasonBlockedEmail', 'Absender-E-Mail ($1) steht auf der Blacklist.', [email])], listType: 'blacklist' };
        }
        // ⚡ Bolt Optimization: Replace O(n) array iteration with O(1) set lookups for domain checking
        if (customBlacklist.has(senderDomain)) {
            return { score: 100, reasons: [uiText('reasonBlockedDomain', 'Absender-Domain ($1) steht auf der Blacklist ($2).', [senderDomain, senderDomain])], listType: 'blacklist' };
        }
        let dotIdx = senderDomain.indexOf('.');
        while (dotIdx !== -1) {
            let parentDomain = senderDomain.substring(dotIdx + 1);
            if (customBlacklist.has(parentDomain)) {
                return { score: 100, reasons: [uiText('reasonBlockedDomain', 'Absender-Domain ($1) steht auf der Blacklist ($2).', [senderDomain, parentDomain])], listType: 'blacklist' };
            }
            dotIdx = senderDomain.indexOf('.', dotIdx + 1);
        }
    }

    // Check Whitelist
    if (typeof customWhitelist !== 'undefined' && customWhitelist && customWhitelist.size > 0) {
        if (customWhitelist.has(email)) {
            return { score: 0, reasons: [uiText('reasonAllowedEmail', 'Absender-E-Mail ($1) steht auf der Whitelist.', [email])], listType: 'whitelist' };
        }
        // ⚡ Bolt Optimization: Replace O(n) array iteration with O(1) set lookups for domain checking
        if (customWhitelist.has(senderDomain)) {
            return { score: 0, reasons: [uiText('reasonAllowedDomain', 'Absender-Domain ($1) steht auf der Whitelist ($2).', [senderDomain, senderDomain])], listType: 'whitelist' };
        }
        let dotIdx = senderDomain.indexOf('.');
        while (dotIdx !== -1) {
            let parentDomain = senderDomain.substring(dotIdx + 1);
            if (customWhitelist.has(parentDomain)) {
                return { score: 0, reasons: [uiText('reasonAllowedDomain', 'Absender-Domain ($1) steht auf der Whitelist ($2).', [senderDomain, parentDomain])], listType: 'whitelist' };
            }
            dotIdx = senderDomain.indexOf('.', dotIdx + 1);
        }
    }
    return null;
}

const AUTH_FAIL_REGEX = /(?:spf=fail|spf=softfail|dkim=fail|dmarc=fail)/i;
const AUTH_PASS_REGEX_SPF = /spf=pass/i;
const AUTH_PASS_REGEX_DKIM = /dkim=pass/i;
const AUTH_PASS_REGEX_DMARC = /dmarc=pass/i;

function evaluateAuthHeaders(authHeaders, score, reasons) {
    let authStatus = 'neutral';
    if (authHeaders && authHeaders.length > 0) {
        const headerStr = authHeaders.join(' ');

        // ⚡ Bolt Optimization: Fast-path to avoid unconditionally allocating lowercased copy of large texts
        if (AUTH_FAIL_REGEX.test(headerStr)) {
            let fail = false;

            if (/spf=(?:fail|softfail)/i.test(headerStr)) {
                score += 50;
                addReason(reasons, "ui_087", "SPF-Prüfung fehlgeschlagen (Mögliches Spoofing).");
                fail = true;
            }
            if (/dkim=fail/i.test(headerStr)) {
                score += 50;
                addReason(reasons, "ui_088", "DKIM-Signatur ungültig (Mögliches Spoofing).");
                fail = true;
            }
            if (/dmarc=fail/i.test(headerStr)) {
                score += 50;
                addReason(reasons, "ui_089", "DMARC-Prüfung fehlgeschlagen (Mögliches Spoofing).");
                fail = true;
            }

            if (fail) {
                authStatus = 'fail';
            } else if (AUTH_PASS_REGEX_SPF.test(headerStr) && AUTH_PASS_REGEX_DKIM.test(headerStr) && AUTH_PASS_REGEX_DMARC.test(headerStr)) {
                authStatus = 'pass';
            }
        } else if (AUTH_PASS_REGEX_SPF.test(headerStr) && AUTH_PASS_REGEX_DKIM.test(headerStr) && AUTH_PASS_REGEX_DMARC.test(headerStr)) {
            authStatus = 'pass';
        }
    }
    return { score, authStatus };
}

function evaluateUrlhaus(urlhausDomains, score, reasons) {
    if (urlhausDomains && urlhausDomains.length > 0) {
        for (let domain of urlhausDomains) {
            score += 80;
            addReason(reasons, "ui_090", "Domain ($1) ist auf URLhaus als bösartig gelistet.", [domain]);
        }
    }
    return score;
}

function evaluateReplyTo(replyTo, senderDomain, score, reasons) {
    if (replyTo && senderDomain) {
        let replyToEmail = extractEmailAddress(replyTo);
        const replyDomain = extractEmailDomain(replyToEmail);

        if (replyDomain && replyDomain !== senderDomain) {
            score += 50;
            addReason(reasons, "ui_091", "Diskrepanz erkannt: \"Reply-To\" Domain ($1) weicht von der Absender-Domain ($2) ab.", [replyDomain, senderDomain]);
        }
    }
    return score;
}

function evaluateBehavior(subject, messageText, isFirstCommunication, score, reasons) {
    let mixedCaseText = (subject + " " + messageText).normalize('NFC');

    // ⚡ Bolt Optimization: Fast path to avoid unconditionally allocating lowercased copy of large texts
    if (FAST_URGENCY_REGEX.test(mixedCaseText)) {
        let foundUrgencyWords = [];

        let match;
        URGENCY_REGEX.lastIndex = 0;
        while ((match = URGENCY_REGEX.exec(mixedCaseText)) !== null) {
            let m = match[2].toLowerCase();
            // ⚡ Bolt Optimization: Replace O(N) array iteration with includes
            if (!foundUrgencyWords.includes(m)) {
                foundUrgencyWords.push(m);
            }
        }

        if (foundUrgencyWords.some(word => STRONG_URGENCY_SET.has(word))) {
            if (isFirstCommunication) {
                score += 50;
                addReason(reasons, "ui_092", "Mögliches BEC (Business Email Compromise): Erste Kommunikation mit diesem Absender und Dringlichkeits-Signalwörter gefunden ($1).", [foundUrgencyWords.join(', ')]);
            } else {
                score += 20;
                addReason(reasons, "ui_093", "Dringlichkeits-Signalwörter gefunden ($1). Bitte prüfen Sie die Anfrage sorgfältig.", [foundUrgencyWords.join(', ')]);
            }
            return score;
        }
    }

    if (isFirstCommunication) {
        score += 10;
        addReason(reasons, "ui_094", "Dies ist das erste Mal, dass Sie mit diesem Absender kommunizieren.");
    }
    return score;
}

function getMainDomain(domain) {
    if (typeof tldts !== 'undefined') {
        try { domain = new URL('https://' + domain).hostname; } catch (e) { return domain; }
        return tldts.getDomain(domain, { allowPrivateDomains: true }) || domain;
    }

    // ⚡ Bolt Optimization: Fast path for exact brand matches avoids RegExp execution
    if (KNOWN_BRANDS_SET.has(domain)) {
        return domain;
    }

    // ⚡ Bolt Optimization: Use exec instead of match to prevent full array allocation on miss
    const match = KNOWN_BRANDS_REGEX.exec(domain);
    if (match !== null) {
        return match[1].toLowerCase();
    }

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
        let isSenderKnownBrand = KNOWN_BRANDS_SET.has(senderMainDomain);

        if (!isSenderKnownBrand) {
            for (let brand of KNOWN_BRANDS) {
                if (senderMainDomain.length < 4 || Math.abs(senderMainDomain.length - brand.length) > 2) continue;

                let distance = levenshteinDistance(senderMainDomain, brand);
                if (distance > 0 && distance <= 2) {
                    score += 60;
                    addReason(reasons, "ui_095", "Absender-Domain ($1) ähnelt verdächtig der bekannten Marke $2.", [senderMainDomain, brand]);
                    break;
                }
            }
        }
    }
    return { score, senderMainDomain };
}

function getHostnameOptimized(url, cache = null) {
    if (cache) {
        let cached = cache.get(url);
        if (cached !== undefined) return cached;
    }
    try {
        let hostname = new URL(url).hostname;
        if (cache) cache.set(url, hostname);
        return hostname;
    } catch (e) {
        if (cache) cache.set(url, null);
        return null;
    }
}

function checkTyposquattingLink(linkMainDomain, checkedMainDomains, reasons, reasonsDomainsSet) {
    // ⚡ Bolt Optimization: Fast-path for exact brand matches early
    if (KNOWN_BRANDS_SET.has(linkMainDomain)) {
        return false;
    }

    let cachedBrandMatch = checkedMainDomains.get(linkMainDomain);
    if (cachedBrandMatch !== undefined) {
        if (cachedBrandMatch !== null) {
            if (!reasonsDomainsSet.has(linkMainDomain)) {
                addReason(reasons, "ui_096", "Link-Domain ($1) ähnelt verdächtig der bekannten Marke $2.", [linkMainDomain, cachedBrandMatch]);
                reasonsDomainsSet.add(linkMainDomain);
            }
            return true;
        }
        return false;
    }

    for (let brand of KNOWN_BRANDS) {
        if (linkMainDomain.length < 4 || Math.abs(linkMainDomain.length - brand.length) > 2) continue;

        let distance = levenshteinDistance(linkMainDomain, brand);
        if (distance > 0 && distance <= 2) {
            checkedMainDomains.set(linkMainDomain, brand);
            if (!reasonsDomainsSet.has(linkMainDomain)) {
                addReason(reasons, "ui_096", "Link-Domain ($1) ähnelt verdächtig der bekannten Marke $2.", [linkMainDomain, brand]);
                reasonsDomainsSet.add(linkMainDomain);
            }
            return true;
        }
    }

    checkedMainDomains.set(linkMainDomain, null);
    return false;
}

function evaluateLinks(options = {}) {
    let {
        urls = [],
        senderDomain = '',
        senderMainDomain = '',
        score = 0,
        reasons = [],
        parsedUrlCache = null
    } = options;
    let linkDomainsSet = new Set();
    // ⚡ Bolt Optimization: Use indexed loop and inline cache check to reduce function call overhead
    for (let i = 0; i < urls.length; i++) {
        try {
            let url = urls[i];
            let hostname;
            if (parsedUrlCache) {
                hostname = parsedUrlCache.get(url);
                if (hostname === undefined) {
                    hostname = getHostnameOptimized(url, parsedUrlCache);
                }
            } else {
                hostname = getHostnameOptimized(url, parsedUrlCache);
            }
            if (hostname) linkDomainsSet.add(hostname);
        } catch (e) { /* Ignore invalid URLs */ }
    }
    if (linkDomainsSet.size > 0 && senderDomain) {
        let matchFound = false;
        let typosquatLinkFound = false;
        let checkedMainDomains = new Map();
        let reasonsDomainsSet = new Set();

        // ⚡ Bolt Optimization: Iterate directly over the Set to avoid Array.from() allocation overhead
        const dotSenderDomain = '.' + senderDomain;
        const dotSenderMainDomain = senderMainDomain ? '.' + senderMainDomain : '';
        for (let ld of linkDomainsSet) {
            if (!matchFound) {
                if (ld === senderDomain || ld.endsWith(dotSenderDomain) || senderDomain.endsWith('.' + ld)) {
                    matchFound = true;
                } else if (senderMainDomain && (ld === senderMainDomain || ld.endsWith(dotSenderMainDomain))) {
                     matchFound = true;
                }
            }

            let linkMainDomain = getMainDomain(ld);
            let isLinkKnownBrand = KNOWN_BRANDS_SET.has(linkMainDomain);

            if (!isLinkKnownBrand) {
                if (checkTyposquattingLink(linkMainDomain, checkedMainDomains, reasons, reasonsDomainsSet)) {
                    typosquatLinkFound = true;
                }
            }
        }

        if (!matchFound) {
            score += 40;
            if (!(reasons.details || []).some(reason => reason.code === 'ui_097')) {
                 addReason(reasons, "ui_097", "Keiner der Links im Text verweist auf die Absender-Domain ($1).", [senderDomain]);
            }
        }
        if (typosquatLinkFound) {
            score += 60;
        }
    }
    return score;
}

function extractEmailAddress(rawAuthor) {
    let email = rawAuthor;
    // ⚡ Bolt Optimization: Use indexOf and substring to avoid regex allocation overhead
    // 🛡️ Sentinel: Use lastIndexOf to prevent email spoofing via decoy display names
    const start = rawAuthor.lastIndexOf('<');
    if (start !== -1) {
        const end = rawAuthor.indexOf('>', start + 1);
        if (end !== -1) {
            email = rawAuthor.substring(start + 1, end);
        }
    }
    return email.toLowerCase();
}

function extractEmailDomain(emailAddress) {
    // ⚡ Bolt Optimization: Use indexOf and substring instead of split for O(n) extraction without array allocation
    const atIndex = emailAddress.indexOf('@');
    return atIndex !== -1 ? emailAddress.substring(atIndex + 1).toLowerCase() : "";
}

function addReason(reasons, code, fallback, params = []) {
    if (!reasons.details) Object.defineProperty(reasons, 'details', { value: [], enumerable: false });
    reasons.details.push({ code, params: params.map(String) });
    reasons.push(uiText(code, fallback, params));
}

function calculateThreatScore(author, urls, options = {}) {
    const {
        authHeaders = [],
        urlhausDomains = [],
        isFirstCommunication = false,
        messageText = "",
        subject = "",
        replyTo = "",
        parsedUrlCache = null
    } = options;
    let score = 0;
    let reasons = [];

    let email = extractEmailAddress(author);
    let senderDomain = extractEmailDomain(email);

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

    score = evaluateLinks({
        urls,
        senderDomain,
        senderMainDomain,
        score,
        reasons,
        parsedUrlCache
    });

    return { score: Math.min(score, 100), reasons: reasons, reasonDetails: reasons.details || [], authStatus: authStatus };
}

