/**
 * link_gate.js - Reine Erkennungs-Engine des Klick-Gates (Thundy AV).
 *
 * Diese Datei ist absichtlich frei von Browser-APIs, Netzwerkzugriffen und
 * Timern. Sie wird als klassisches Skript sowohl im Hintergrund-Kontext
 * (background.js) als auch im Message-Display-Kontext (msg_display.js) geladen.
 *
 * Wichtig: Alles liegt in einer sofort ausgefuehrten Funktion (IIFE), damit keine
 * top-level const-Deklaration in den gemeinsamen Hintergrund-Scope leckt
 * (background.js deklariert selbst KNOWN_BRANDS). Nach aussen wird nur
 * ThundyLinkGate ueber globalThis (bzw. module.exports fuer die Node-Tests)
 * bereitgestellt.
 *
 * Alle Funktionen sind defensiv: inspectUrl und decide werfen NIE, auch nicht
 * bei null/undefined/kaputten oder feindseligen Eingaben.
 */
(function () {
    'use strict';

    // Bekannte Marken (Domains). Muss mit der Markenliste in background.js
    // konsistent bleiben, damit lokale Heuristik und Bestandslogik gleich urteilen.
    const KNOWN_BRANDS = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];

    // Kurz-URL-Dienste (Host oder Registrierungsdomain).
    const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 't.ly', 'rb.gy', 'tiny.cc', 'lnkd.in', 's.id', 'v.gd', 'shorte.st', 'adf.ly', 'bit.do', 'soo.gd', 'clck.ru', 'u.to', 'qps.ru'];

    // Auffaellige Top-Level-Domains (gehaeuft in Spam/Phishing-Kampagnen).
    const SUSPICIOUS_TLDS = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'work', 'click', 'link', 'loan', 'download', 'stream', 'review', 'country', 'kim', 'men', 'party', 'gdn', 'bid', 'zip', 'mov', 'rest', 'fit', 'cam', 'surf', 'casa', 'buzz', 'icu', 'monster', 'quest', 'sbs', 'cfd', 'cyou', 'info', 'biz'];

    // Ausfuehrbare/skriptfaehige Dateiendungen.
    const SUSPICIOUS_EXTENSIONS = ['exe', 'scr', 'com', 'pif', 'bat', 'cmd', 'msi', 'msp', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'hta', 'jar', 'ps1', 'psm1', 'reg', 'lnk', 'cpl', 'dll', 'ocx', 'sys', 'drv', 'apk', 'dmg', 'app', 'sh', 'run', 'gadget', 'msc', 'sct', 'iso', 'img', 'vhd', 'vhdx'];

    // Dokumenten-/Bild-/Archivendungen, die fuer getarnte doppelte Endungen missbraucht werden.
    const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'zip', 'rar', '7z'];

    const LEVEL_NAMES = ['clean', 'low', 'medium', 'high', 'critical'];

    const REDIRECT_PARAMS = ['url', 'u', 'redirect', 'redirect_uri', 'redirect_url', 'target', 'dest', 'destination', 'goto', 'go', 'link', 'out', 'continue', 'return', 'returnurl', 'return_url', 'next', 'r', 'view'];

    const PHISHING_KEYWORDS = ['login', 'signin', 'sign-in', 'logon', 'log-in', 'verify', 'verification', 'account', 'secure', 'security', 'update', 'password', 'passwort', 'konto', 'banking', 'webscr', 'confirm', 'rechnung', 'invoice'];

    // Zwei-teilige Public-Suffixe, damit die Registrierungsdomain stimmt (klein gehalten).
    const TWO_PART_SUFFIXES = ['co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'com.br', 'com.tr', 'com.mx'];

    const SUSPICIOUS_TLD_SET = new Set(SUSPICIOUS_TLDS);
    const SUSPICIOUS_EXTENSION_SET = new Set(SUSPICIOUS_EXTENSIONS);
    const DOCUMENT_EXTENSION_SET = new Set(DOCUMENT_EXTENSIONS);
    const SHORTENER_SET = new Set(SHORTENERS);
    const KNOWN_BRAND_SET = new Set(KNOWN_BRANDS);
    const LEVEL_NAME_SET = new Set(LEVEL_NAMES);
    const REDIRECT_PARAM_SET = new Set(REDIRECT_PARAMS);
    const TWO_PART_SUFFIX_SET = new Set(TWO_PART_SUFFIXES);
    const BRAND_BASE_SET = new Set(KNOWN_BRANDS.map(function (brand) { return brand.split('.')[0]; }));

    // Farbwelt je Stufe - identisch zu den STYLES in msg_display.js.
    const LEVEL_STYLES = {
        clean: { color: '#145c14', background: '#e6ffe6', border: '#2e8b2e', icon: '\ud83d\udfe2', labelKey: 'bannerLevelClean', labelFallback: 'Clean' },
        low: { color: '#4d6b00', background: '#f6ffe6', border: '#8ebe2d', icon: '\ud83d\udfe2', labelKey: 'bannerLevelLow', labelFallback: 'Low' },
        medium: { color: '#7a5200', background: '#fff6e6', border: '#f0a500', icon: '\ud83d\udfe1', labelKey: 'bannerLevelMedium', labelFallback: 'Medium' },
        high: { color: '#8a3400', background: '#fff0e6', border: '#e8620c', icon: '\ud83d\udfe0', labelKey: 'bannerLevelHigh', labelFallback: 'High' },
        critical: { color: '#8a1010', background: '#ffeeee', border: '#c81e1e', icon: '\ud83d\udd34', labelKey: 'bannerLevelCritical', labelFallback: 'Critical' }
    };

    // ---- Normalisierung (defensiv, wirft nie) -----------------------------

    function normalizeScore(score) {
        const value = Number(score);
        if (!isFinite(value)) return 0;
        if (value < 0) return 0;
        if (value > 100) return 100;
        return Math.round(value);
    }

    function normalizeLevel(level) {
        return (typeof level === 'string' && LEVEL_NAME_SET.has(level)) ? level : '';
    }

    function normalizeMode(mode) {
        if (mode === 'balanced') return 'balanced';
        if (mode === 'off') return 'off';
        return 'strict';
    }

    // Externe Verdikte: true = boesartig, false = geprueft und sauber, null = nicht geprueft.
    function normalizeVerdict(verdict) {
        if (verdict === true || verdict === false) return verdict;
        if (verdict && typeof verdict === 'object') {
            if (typeof verdict.malicious === 'boolean') return verdict.malicious;
            if (typeof verdict.clean === 'boolean') return verdict.clean;
            return null;
        }
        if (verdict === 'malicious' || verdict === 'bad') return true;
        if (verdict === 'clean' || verdict === 'ok') return false;
        return null;
    }

    // Stufe aus Score: 0-14 clean, 15-39 low, 40-59 medium, 60-79 high, 80-100 critical.
    function levelFromScore(score) {
        const value = normalizeScore(score);
        if (value >= 80) return 'critical';
        if (value >= 60) return 'high';
        if (value >= 40) return 'medium';
        if (value >= 15) return 'low';
        return 'clean';
    }

    // ---- Reine Hilfsfunktionen -------------------------------------------

    function levenshteinDistance(a, b) {
        if (a === b) return 0;
        const aLen = a.length;
        const bLen = b.length;
        if (aLen === 0) return bLen;
        if (bLen === 0) return aLen;
        let prevRow = new Array(bLen + 1);
        let currRow = new Array(bLen + 1);
        for (let j = 0; j <= bLen; j++) prevRow[j] = j;
        for (let i = 1; i <= aLen; i++) {
            currRow[0] = i;
            const aChar = a.charCodeAt(i - 1);
            for (let j = 1; j <= bLen; j++) {
                const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1;
                let best = prevRow[j] + 1;
                if (currRow[j - 1] + 1 < best) best = currRow[j - 1] + 1;
                if (prevRow[j - 1] + cost < best) best = prevRow[j - 1] + cost;
                currRow[j] = best;
            }
            const tmp = prevRow; prevRow = currRow; currRow = tmp;
        }
        return prevRow[bLen];
    }

    function isIpLiteral(host) {
        if (!host) return false;
        if (host.charAt(0) === '[') return true; // IPv6 in eckigen Klammern
        return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    }

    function getTld(domain) {
        if (!domain) return '';
        const dot = domain.lastIndexOf('.');
        return dot === -1 ? '' : domain.slice(dot + 1).toLowerCase();
    }

    // Registrierungsdomain (Naeherung). Bekannte Marken haben Vorrang, damit
    // "www.paypal.com" zu "paypal.com" wird.
    function getMainDomain(host, ipLiteral) {
        if (!host) return '';
        if (ipLiteral) return host;
        for (let i = 0; i < KNOWN_BRANDS.length; i++) {
            const brand = KNOWN_BRANDS[i];
            if (host === brand || host.slice(-(brand.length + 1)) === '.' + brand) return brand;
        }
        const labels = host.split('.').filter(Boolean);
        if (labels.length <= 2) return host;
        const lastTwo = labels.slice(-2).join('.');
        if (TWO_PART_SUFFIX_SET.has(lastTwo) && labels.length >= 3) {
            return labels.slice(-3).join('.');
        }
        return lastTwo;
    }

    function getLastPathSegment(pathname) {
        if (typeof pathname !== 'string' || !pathname) return '';
        const parts = pathname.split('/');
        for (let i = parts.length - 1; i >= 0; i--) {
            if (parts[i]) return parts[i].toLowerCase();
        }
        return '';
    }

    function getExtension(segment) {
        if (!segment) return '';
        const dot = segment.lastIndexOf('.');
        if (dot < 0 || dot === segment.length - 1) return '';
        return segment.slice(dot + 1).toLowerCase();
    }

    function isIdnHost(host) {
        if (!host) return false;
        return host.indexOf('xn--') !== -1 || /[^\x00-\x7F]/.test(host);
    }

    function hostFromDisplayText(text) {
        if (typeof text !== 'string') return '';
        const value = text.trim();
        if (!value || /\s/.test(value)) return '';
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
            try {
                return (new URL(value).hostname || '').toLowerCase();
            } catch (e) {
                return '';
            }
        }
        const hostPart = value.split(/[/?#]/)[0];
        return hostPart.indexOf('.') !== -1 ? hostPart.toLowerCase() : '';
    }

    function isSameDomain(displayHost, host, mainDomain) {
        if (!displayHost) return true;
        const other = displayHost.toLowerCase();
        if (other === host) return true;
        if (other.slice(-(host.length + 1)) === '.' + host) return true;
        if (host.slice(-(other.length + 1)) === '.' + other) return true;
        return getMainDomain(other, isIpLiteral(other)) === mainDomain;
    }

    function isWhitelisted(host, mainDomain, whitelist) {
        if (!Array.isArray(whitelist) || whitelist.length === 0) return false;
        for (let i = 0; i < whitelist.length; i++) {
            let entry = whitelist[i];
            if (typeof entry !== 'string') continue;
            entry = entry.trim().toLowerCase();
            if (!entry) continue;
            if (entry.indexOf('://') !== -1) {
                try {
                    entry = (new URL(entry).hostname || '').toLowerCase();
                } catch (e) {
                    continue;
                }
            }
            if (!entry) continue;
            if (host === entry || host.slice(-(entry.length + 1)) === '.' + entry || mainDomain === entry) return true;
        }
        return false;
    }

    function isKnownBrand(mainDomain) {
        return !!mainDomain && KNOWN_BRAND_SET.has(mainDomain);
    }

    function findBrandToken(host) {
        if (!host) return '';
        const tokens = host.split(/[.\-_]/).filter(Boolean);
        for (let i = 0; i < tokens.length; i++) {
            if (BRAND_BASE_SET.has(tokens[i])) return tokens[i];
        }
        return '';
    }

    function findTyposquat(mainDomain, brands) {
        const list = (Array.isArray(brands) && brands.length) ? brands : KNOWN_BRANDS;
        if (!mainDomain || mainDomain.length < 4) return '';
        for (let i = 0; i < list.length; i++) {
            const brand = list[i];
            if (typeof brand !== 'string' || !brand) continue;
            const candidate = brand.toLowerCase();
            if (mainDomain === candidate) continue;
            if (Math.abs(mainDomain.length - candidate.length) > 2) continue;
            const distance = levenshteinDistance(mainDomain, candidate);
            if (distance > 0 && distance <= 2) return candidate;
        }
        return '';
    }

    function hasRedirectParameter(parsed) {
        let found = false;
        try {
            parsed.searchParams.forEach(function (value, key) {
                if (found) return;
                if (REDIRECT_PARAM_SET.has(String(key).toLowerCase()) && /^(https?:)?\/\//i.test(value)) found = true;
            });
        } catch (e) { /* defensiv: keine Analyse bei kaputtem Query-Teil */ }
        return found;
    }

    function hasPhishingKeywords(parsed) {
        const haystack = ((parsed.pathname || '') + ' ' + (parsed.search || '')).toLowerCase();
        for (let i = 0; i < PHISHING_KEYWORDS.length; i++) {
            if (haystack.indexOf(PHISHING_KEYWORDS[i]) !== -1) return true;
        }
        return false;
    }

    function isSenderRelated(host, mainDomain, senderDomain, senderMainDomain) {
        if (!senderDomain) return true;
        if (host === senderDomain || host.slice(-(senderDomain.length + 1)) === '.' + senderDomain) return true;
        if (senderDomain.slice(-(host.length + 1)) === '.' + host) return true;
        if (senderMainDomain && (mainDomain === senderMainDomain || mainDomain.slice(-(senderMainDomain.length + 1)) === '.' + senderMainDomain)) return true;
        return false;
    }

    // ---- Statische URL-Analyse -------------------------------------------

    // inspectUrl analysiert eine URL rein lokal. Rueckgabe enthaelt immer die
    // Felder url, host, mainDomain, scheme, port, isIpLiteral, score, level,
    // indicators und reasons - auch bei feindseliger Eingabe.
    function inspectUrl(url, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const raw = (typeof url === 'string') ? url.trim() : '';
        const result = {
            url: raw,
            host: '',
            mainDomain: '',
            scheme: '',
            port: '',
            isIpLiteral: false,
            score: 0,
            level: 'clean',
            indicators: [],
            reasons: []
        };

        const indicators = result.indicators;
        const reasons = result.reasons;
        const seen = new Set();
        function addIndicator(code, label, weight) {
            if (seen.has(code)) return;
            seen.add(code);
            indicators.push({ code: code, label: label, weight: weight });
            reasons.push(label);
        }

        if (!raw) {
            addIndicator('invalid-url', 'Leere oder ungueltige URL.', 0);
            return result;
        }

        let parsed;
        try {
            parsed = new URL(raw);
        } catch (e) {
            addIndicator('invalid-url', 'URL konnte nicht analysiert werden.', 0);
            return result;
        }

        const scheme = String(parsed.protocol || '').toLowerCase();
        const host = String(parsed.hostname || '').toLowerCase();
        result.scheme = scheme;
        result.host = host;
        result.port = parsed.port || '';
        result.isIpLiteral = isIpLiteral(host);
        result.mainDomain = getMainDomain(host, result.isIpLiteral);

        // Nur HTTP(S) wird vom Klick-Gate geprueft.
        if (scheme !== 'http:' && scheme !== 'https:') {
            addIndicator('unsupported-scheme', 'Kein HTTP(S)-Link.', 0);
            return result;
        }

        // Whitelist hat Vorrang: ein Treffer macht die URL sauber, unabhaengig
        // von allen anderen Signalen.
        if (isWhitelisted(host, result.mainDomain, opts.whitelist)) {
            result.indicators = [{ code: 'whitelisted', label: 'Domain steht auf der Whitelist.', weight: 0 }];
            result.reasons = ['Domain steht auf der Whitelist.'];
            result.score = 0;
            result.level = 'clean';
            return result;
        }

        if (scheme === 'http:') {
            addIndicator('http-cleartext', 'Unverschluesselte HTTP-Verbindung (Klartext).', 20);
        }

        if (result.isIpLiteral) {
            addIndicator('ip-literal', 'Host ist eine IP-Adresse statt eines Domainnamens.', 40);
        }

        if (result.port && result.port !== '80' && result.port !== '443') {
            addIndicator('unusual-port', 'Ungewoehnlicher Port in der URL.', 30);
        }

        if (isIdnHost(host)) {
            addIndicator('idn-homograph', 'Host verwendet Punycode/IDN (Homograph-Risiko).', 60);
        }

        if (parsed.username || parsed.password) {
            addIndicator('userinfo-credentials', 'Zielhost wird durch Zugangsdaten im Link verschleiert (Userinfo-Trick).', 70);
        }

        const tld = getTld(result.mainDomain);
        if (tld && SUSPICIOUS_TLD_SET.has(tld)) {
            addIndicator('suspicious-tld', 'Verdaechtige Top-Level-Domain (.' + tld + ').', 35);
        }

        if (SHORTENER_SET.has(host) || SHORTENER_SET.has(result.mainDomain)) {
            addIndicator('url-shortener', 'Kurz-URL-Dienst verschleiert das Ziel.', 25);
        }

        if (hasRedirectParameter(parsed)) {
            addIndicator('redirect-parameter', 'Weiterleitungs-Parameter in der URL.', 30);
        }

        const lastSegment = getLastPathSegment(parsed.pathname);
        const extension = getExtension(lastSegment);
        if (extension && SUSPICIOUS_EXTENSION_SET.has(extension)) {
            addIndicator('executable-download', 'Link zeigt auf eine ausfuehrbare Datei (.' + extension + ').', 45);
            const previousExtension = getExtension(lastSegment.slice(0, lastSegment.length - extension.length - 1));
            if (previousExtension && DOCUMENT_EXTENSION_SET.has(previousExtension)) {
                addIndicator('double-extension', 'Doppelte Dateiendung (.' + previousExtension + '.' + extension + ').', 55);
            }
        }

        const displayHost = hostFromDisplayText(opts.displayText);
        if (displayHost && !result.isIpLiteral && !isSameDomain(displayHost, host, result.mainDomain)) {
            addIndicator('text-href-mismatch', 'Sichtbarer Text und tatsaechliches Linkziel stimmen nicht ueberein.', 55);
        }

        if (!result.isIpLiteral && !isKnownBrand(result.mainDomain)) {
            const brandToken = findBrandToken(host);
            if (brandToken) {
                addIndicator('brand-in-host', 'Markenname "' + brandToken + '" im Host, aber die Domain gehoert nicht zur Marke.', 60);
            }
            const typosquat = findTyposquat(result.mainDomain, opts.brands);
            if (typosquat) {
                addIndicator('typosquatting', 'Domain aehnelt verdaechtig der Marke "' + typosquat + '".', 60);
            }
        }

        const senderDomain = (typeof opts.senderDomain === 'string') ? opts.senderDomain.toLowerCase() : '';
        const senderMainDomain = (typeof opts.senderMainDomain === 'string') ? opts.senderMainDomain.toLowerCase() : '';
        if (senderDomain && !isSenderRelated(host, result.mainDomain, senderDomain, senderMainDomain)) {
            addIndicator('sender-mismatch', 'Link-Domain weicht von der Absender-Domain ab.', 40);
        }

        if (!isKnownBrand(result.mainDomain) && hasPhishingKeywords(parsed)) {
            addIndicator('phishing-keywords', 'Phishing-typische Schluesselwoerter im Link.', 20);
        }

        let total = 0;
        for (let i = 0; i < indicators.length; i++) total += indicators[i].weight;
        result.score = normalizeScore(total);
        result.level = levelFromScore(result.score);
        return result;
    }

    // ---- Verdikt-Policy (strict/balanced/off) ----------------------------

    // decide fuehrt lokale und externe Signale zusammen. Externe Anreicherung
    // kann das Ergebnis verschlechtern, eine fehlende externe Pruefung darf ein
    // lokales "block" aber nie aufheben.
    function decide(input) {
        const safe = (input && typeof input === 'object') ? input : {};
        const local = (safe.local && typeof safe.local === 'object') ? safe.local : null;
        const localLevel = local ? (normalizeLevel(local.level) || levelFromScore(local.score)) : 'clean';
        const localScore = local ? normalizeScore(local.score) : 0;
        const mode = normalizeMode(safe.mode);
        const urlhaus = normalizeVerdict(safe.urlhaus);
        const urlscan = normalizeVerdict(safe.urlscan);
        const hybrid = normalizeVerdict(safe.hybrid);

        const externalChecked = urlhaus !== null || urlscan !== null || hybrid !== null;
        const externalMalicious = urlhaus === true || urlscan === true || hybrid === true;

        const reasons = [];
        if (local && Array.isArray(local.reasons)) {
            for (let i = 0; i < local.reasons.length; i++) {
                if (typeof local.reasons[i] === 'string' && local.reasons[i]) reasons.push(local.reasons[i]);
            }
        }

        let action;
        let level = localLevel;
        let score = localScore;

        if (mode === 'off') {
            // "off": das Gate oeffnet alles - auch bei externem Boesartig-Verdikt.
            action = 'allow';
        } else if (externalMalicious) {
            const hitSources = [];
            if (urlhaus === true) hitSources.push('URLhaus');
            if (urlscan === true) hitSources.push('urlscan.io');
            if (hybrid === true) hitSources.push('Hybrid Analysis');
            action = 'block';
            level = 'critical';
            score = Math.max(score, 90);
            reasons.push('Externe Analyse (' + hitSources.join(', ') + ') meldet diese URL als boesartig.');
        } else if (localLevel === 'critical' || localLevel === 'high') {
            action = (mode === 'balanced') ? 'warn' : 'block';
        } else if (localLevel === 'medium') {
            action = 'warn';
        } else if (externalChecked) {
            // lokal unauffaellig UND extern sauber geprueft
            action = 'allow';
        } else {
            // lokal unauffaellig, aber keine externe Pruefung moeglich (unknown)
            action = (mode === 'balanced') ? 'allow' : 'warn';
            if (action === 'warn') reasons.push('Keine externe Pruefung moeglich - die Bewertung beruht nur auf der lokalen Analyse.');
        }

        return {
            action: action,
            level: level,
            score: normalizeScore(score),
            reasons: reasons,
            sources: {
                local: localLevel,
                urlhaus: urlhaus,
                urlscan: urlscan,
                hybrid: hybrid,
                unknown: !externalChecked
            }
        };
    }

    // ---- UI-Stil ----------------------------------------------------------

    function levelStyle(level) {
        const name = normalizeLevel(level) || 'clean';
        const style = LEVEL_STYLES[name];
        return {
            color: style.color,
            background: style.background,
            border: style.border,
            icon: style.icon,
            labelKey: style.labelKey,
            labelFallback: style.labelFallback
        };
    }

    // ---- Oeffentliche Schnittstelle --------------------------------------

    const ThundyLinkGate = {
        KNOWN_BRANDS: KNOWN_BRANDS,
        SHORTENERS: SHORTENERS,
        SUSPICIOUS_TLDS: SUSPICIOUS_TLDS,
        SUSPICIOUS_EXTENSIONS: SUSPICIOUS_EXTENSIONS,
        levelFromScore: levelFromScore,
        inspectUrl: inspectUrl,
        decide: decide,
        levelStyle: levelStyle
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = ThundyLinkGate;
    if (typeof globalThis !== 'undefined') globalThis.ThundyLinkGate = ThundyLinkGate;
})();
