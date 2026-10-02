/**
 * Unit-Tests fuer die reine Link-Gate-Engine (link_gate.js).
 *
 * Jede sicherheitsrelevante Regel hat hier einen Test, der fehlschlaegt, wenn
 * die Regel entfernt wird: die Policy-Matrix prueft exakte Aktionen (nicht nur
 * "truthy") und jeder Angriffsvektor aus dem Plan hat einen eigenen Testfall.
 * Kein Netzwerk, keine Browser-APIs, deterministisch.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ThundyLinkGate = require('./link_gate.js');
const SOURCE_PATH = path.join(__dirname, 'link_gate.js');

function codes(result) {
    return result.indicators.map(function (indicator) { return indicator.code; });
}

function decideLocal(level, mode, extra) {
    const input = { local: { level: level, score: 0, reasons: [] }, mode: mode };
    if (extra) {
        Object.keys(extra).forEach(function (key) { input[key] = extra[key]; });
    }
    return ThundyLinkGate.decide(input);
}

describe('link_gate: Export-Vertrag (Abschnitt 6.1)', function () {
    it('exportiert genau die verbindliche API', function () {
        assert.strictEqual(typeof ThundyLinkGate.levelFromScore, 'function');
        assert.strictEqual(typeof ThundyLinkGate.inspectUrl, 'function');
        assert.strictEqual(typeof ThundyLinkGate.decide, 'function');
        assert.strictEqual(typeof ThundyLinkGate.levelStyle, 'function');
        assert.ok(Array.isArray(ThundyLinkGate.KNOWN_BRANDS));
        assert.ok(Array.isArray(ThundyLinkGate.SHORTENERS));
        assert.ok(Array.isArray(ThundyLinkGate.SUSPICIOUS_TLDS));
        assert.ok(Array.isArray(ThundyLinkGate.SUSPICIOUS_EXTENSIONS));
        assert.ok(ThundyLinkGate.KNOWN_BRANDS.indexOf('paypal.com') !== -1);
        assert.ok(ThundyLinkGate.SHORTENERS.indexOf('bit.ly') !== -1);
        assert.ok(ThundyLinkGate.SUSPICIOUS_TLDS.indexOf('tk') !== -1);
        assert.ok(ThundyLinkGate.SUSPICIOUS_EXTENSIONS.indexOf('exe') !== -1);
    });

    it('ist als IIFE gekapselt und leakt keine Top-Level-Deklarationen', function () {
        const context = {};
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(SOURCE_PATH, 'utf8'), context, { filename: 'link_gate.js' });
        assert.strictEqual(typeof context.ThundyLinkGate, 'object');
        assert.strictEqual(typeof context.KNOWN_BRANDS, 'undefined');
        assert.strictEqual(typeof context.SHORTENERS, 'undefined');
        assert.strictEqual(typeof context.SUSPICIOUS_TLDS, 'undefined');
        assert.strictEqual(typeof context.inspectUrl, 'undefined');
        assert.strictEqual(typeof context.levelFromScore, 'undefined');
    });

    it('enthaelt keine Netzwerk-, Browser- oder Timer-APIs', function () {
        const source = fs.readFileSync(SOURCE_PATH, 'utf8');
        assert.ok(!/\bfetch\s*\(/.test(source), 'fetch darf nicht vorkommen');
        assert.ok(!/\bXMLHttpRequest\b/.test(source), 'XMLHttpRequest darf nicht vorkommen');
        assert.ok(!/\bWebSocket\b/.test(source), 'WebSocket darf nicht vorkommen');
        assert.ok(!/\bbrowser\s*\./.test(source), 'browser.* darf nicht vorkommen');
        assert.ok(!/\bsetTimeout\b|\bsetInterval\b/.test(source), 'Timer duerfen nicht vorkommen');
    });
});

describe('link_gate: levelFromScore-Grenzen', function () {
    it('trifft die Stufengrenzen exakt', function () {
        assert.strictEqual(ThundyLinkGate.levelFromScore(0), 'clean');
        assert.strictEqual(ThundyLinkGate.levelFromScore(14), 'clean');
        assert.strictEqual(ThundyLinkGate.levelFromScore(15), 'low');
        assert.strictEqual(ThundyLinkGate.levelFromScore(39), 'low');
        assert.strictEqual(ThundyLinkGate.levelFromScore(40), 'medium');
        assert.strictEqual(ThundyLinkGate.levelFromScore(59), 'medium');
        assert.strictEqual(ThundyLinkGate.levelFromScore(60), 'high');
        assert.strictEqual(ThundyLinkGate.levelFromScore(79), 'high');
        assert.strictEqual(ThundyLinkGate.levelFromScore(80), 'critical');
        assert.strictEqual(ThundyLinkGate.levelFromScore(100), 'critical');
    });

    it('ist robust gegen kaputte Score-Eingaben', function () {
        assert.strictEqual(ThundyLinkGate.levelFromScore(-5), 'clean');
        assert.strictEqual(ThundyLinkGate.levelFromScore(999), 'critical');
        assert.strictEqual(ThundyLinkGate.levelFromScore('abc'), 'clean');
        assert.strictEqual(ThundyLinkGate.levelFromScore(null), 'clean');
        assert.strictEqual(ThundyLinkGate.levelFromScore(undefined), 'clean');
    });
});

describe('link_gate: Angriffsvektoren (Abschnitt 4)', function () {
    it('erkennt Typosquatting gegen die Markenliste', function () {
        const result = ThundyLinkGate.inspectUrl('https://paypa1.com/login');
        assert.ok(codes(result).indexOf('typosquatting') !== -1);
        assert.ok(result.level === 'high' || result.level === 'critical');
        assert.strictEqual(ThundyLinkGate.decide({ local: result, mode: 'strict' }).action, 'block');
    });

    it('erkennt Homograph/IDN ueber Punycode', function () {
        const result = ThundyLinkGate.inspectUrl('https://\u0440\u0430ypal.com/');
        assert.ok(codes(result).indexOf('idn-homograph') !== -1);
        assert.strictEqual(result.level, 'high');
        const puny = ThundyLinkGate.inspectUrl('https://xn--pypal-4ve.com/');
        assert.ok(codes(puny).indexOf('idn-homograph') !== -1);
    });

    it('erkennt IP-Literal als Host', function () {
        const result = ThundyLinkGate.inspectUrl('https://192.168.0.1/');
        assert.strictEqual(result.isIpLiteral, true);
        assert.ok(codes(result).indexOf('ip-literal') !== -1);
    });

    it('erkennt ungewoehnlichen Port', function () {
        const result = ThundyLinkGate.inspectUrl('https://example.com:8443/');
        assert.strictEqual(result.port, '8443');
        assert.ok(codes(result).indexOf('unusual-port') !== -1);
        const standard = ThundyLinkGate.inspectUrl('https://example.com:443/');
        assert.ok(codes(standard).indexOf('unusual-port') === -1);
    });

    it('erkennt Zugangsdaten im Userinfo-Teil', function () {
        const result = ThundyLinkGate.inspectUrl('https://paypal.com@evil.tld/login');
        assert.strictEqual(result.host, 'evil.tld');
        assert.ok(codes(result).indexOf('userinfo-credentials') !== -1);
        assert.strictEqual(ThundyLinkGate.decide({ local: result, mode: 'strict' }).action, 'block');
    });

    it('erkennt Klartext-HTTP und verdaechtige TLD', function () {
        const result = ThundyLinkGate.inspectUrl('http://secure-login.tk/verify');
        assert.ok(codes(result).indexOf('http-cleartext') !== -1);
        assert.ok(codes(result).indexOf('suspicious-tld') !== -1);
        assert.strictEqual(result.level, 'high');
    });

    it('erkennt Kurz-URL-Dienste', function () {
        const result = ThundyLinkGate.inspectUrl('https://bit.ly/abc123');
        assert.ok(codes(result).indexOf('url-shortener') !== -1);
        assert.strictEqual(result.level, 'low');
    });

    it('erkennt Weiterleitungs-Parameter', function () {
        const result = ThundyLinkGate.inspectUrl('https://example.com/r?url=https://evil.tld');
        assert.ok(codes(result).indexOf('redirect-parameter') !== -1);
    });

    it('erkennt ausfuehrbare Downloads und doppelte Dateiendungen', function () {
        const doubleExt = ThundyLinkGate.inspectUrl('https://example.com/invoice.pdf.exe');
        assert.ok(codes(doubleExt).indexOf('executable-download') !== -1);
        assert.ok(codes(doubleExt).indexOf('double-extension') !== -1);
        assert.strictEqual(doubleExt.level, 'critical');
        const single = ThundyLinkGate.inspectUrl('https://example.com/setup.exe');
        assert.ok(codes(single).indexOf('executable-download') !== -1);
        assert.ok(codes(single).indexOf('double-extension') === -1);
    });

    it('erkennt sichtbaren Text ungleich Linkziel', function () {
        const result = ThundyLinkGate.inspectUrl('https://evil.tld/login', { displayText: 'https://paypal.com/login' });
        assert.ok(codes(result).indexOf('text-href-mismatch') !== -1);
        assert.strictEqual(ThundyLinkGate.decide({ local: result, mode: 'strict' }).action, 'block');
        const matching = ThundyLinkGate.inspectUrl('https://paypal.com/login', { displayText: 'https://paypal.com/login' });
        assert.ok(codes(matching).indexOf('text-href-mismatch') === -1);
    });

    it('erkennt Markenname in fremdem Host', function () {
        const result = ThundyLinkGate.inspectUrl('https://paypal-secure.evil.tld/login');
        assert.ok(codes(result).indexOf('brand-in-host') !== -1);
    });

    it('erkennt Link-Domain abweichend von der Absender-Domain', function () {
        const result = ThundyLinkGate.inspectUrl('https://evil.tld/x', { senderDomain: 'good.com', senderMainDomain: 'good.com' });
        assert.ok(codes(result).indexOf('sender-mismatch') !== -1);
        const related = ThundyLinkGate.inspectUrl('https://mail.good.com/x', { senderDomain: 'good.com', senderMainDomain: 'good.com' });
        assert.ok(codes(related).indexOf('sender-mismatch') === -1);
    });

    it('meldet eine unauffaellige Marken-URL als sauber', function () {
        const result = ThundyLinkGate.inspectUrl('https://www.paypal.com/account');
        assert.strictEqual(result.score, 0);
        assert.strictEqual(result.level, 'clean');
        assert.deepStrictEqual(codes(result), []);
    });

    it('setzt Whitelist-Treffer auf sauber, auch bei sonst boesartiger URL', function () {
        const result = ThundyLinkGate.inspectUrl('https://evil.tld/invoice.pdf.exe', { whitelist: ['evil.tld'] });
        assert.strictEqual(result.score, 0);
        assert.strictEqual(result.level, 'clean');
        assert.deepStrictEqual(codes(result), ['whitelisted']);
    });
});

describe('link_gate: inspectUrl Robustheit', function () {
    it('wirft nie bei null/undefined/falschem Typ', function () {
        [null, undefined, 0, 123, true, {}, [], function () {}, ''].forEach(function (input) {
            const result = ThundyLinkGate.inspectUrl(input);
            assert.strictEqual(typeof result.level, 'string');
            assert.ok(Array.isArray(result.indicators));
            assert.ok(Array.isArray(result.reasons));
        });
    });

    it('wirft nie bei kaputten oder feindseligen URLs', function () {
        const inputs = [
            'not a url',
            'http://',
            '://',
            'javascript:alert(1)',
            'ftp://example.com',
            'https://exa\u0000mple.com/\u0007',
            'https://' + 'a'.repeat(100000) + '.com/'
        ];
        inputs.forEach(function (input) {
            const result = ThundyLinkGate.inspectUrl(input);
            assert.ok(['clean', 'low', 'medium', 'high', 'critical'].indexOf(result.level) !== -1);
        });
    });

    it('markiert Nicht-HTTP(S) als nicht unterstuetzt', function () {
        const result = ThundyLinkGate.inspectUrl('javascript:alert(1)');
        assert.ok(codes(result).indexOf('unsupported-scheme') !== -1);
        assert.strictEqual(result.level, 'clean');
    });

    it('verarbeitet eine sehr lange URL ohne Absturz', function () {
        const result = ThundyLinkGate.inspectUrl('https://example.com/' + 'a'.repeat(100000));
        assert.strictEqual(result.host, 'example.com');
    });
});

describe('link_gate: decide Policy-Matrix (Abschnitt 10)', function () {
    // Lage / lokale Stufe / externe Quelle / erwartete Aktion je Modus.
    const matrix = [
        { name: 'extern boesartig (URLhaus) gewinnt immer', local: 'clean', extra: { urlhaus: true }, strict: 'block', balanced: 'block', off: 'allow' },
        { name: 'lokal critical', local: 'critical', extra: {}, strict: 'block', balanced: 'warn', off: 'allow' },
        { name: 'lokal high', local: 'high', extra: {}, strict: 'block', balanced: 'warn', off: 'allow' },
        { name: 'lokal medium', local: 'medium', extra: {}, strict: 'warn', balanced: 'warn', off: 'allow' },
        { name: 'lokal low und extern sauber geprueft', local: 'low', extra: { urlscan: false }, strict: 'allow', balanced: 'allow', off: 'allow' },
        { name: 'lokal clean und extern sauber geprueft', local: 'clean', extra: { hybrid: false }, strict: 'allow', balanced: 'allow', off: 'allow' },
        { name: 'lokal clean und keine externe Pruefung (unknown)', local: 'clean', extra: {}, strict: 'warn', balanced: 'allow', off: 'allow' },
        { name: 'lokal low und keine externe Pruefung (unknown)', local: 'low', extra: {}, strict: 'warn', balanced: 'allow', off: 'allow' }
    ];

    matrix.forEach(function (row) {
        it(row.name, function () {
            ['strict', 'balanced', 'off'].forEach(function (mode) {
                const result = decideLocal(row.local, mode, row.extra);
                assert.strictEqual(result.action, row[mode], row.name + ' / ' + mode);
            });
        });
    });

    it('meldet Quellen und hebt ein externes Boesartig-Verdikt auf critical', function () {
        const result = ThundyLinkGate.decide({ local: { level: 'clean', score: 0 }, urlhaus: true, mode: 'strict' });
        assert.strictEqual(result.action, 'block');
        assert.strictEqual(result.level, 'critical');
        assert.strictEqual(result.sources.urlhaus, true);
        assert.strictEqual(result.sources.unknown, false);
        assert.ok(result.reasons.some(function (reason) { return reason.indexOf('URLhaus') !== -1; }));

        const unknown = ThundyLinkGate.decide({ local: { level: 'clean', score: 0 }, mode: 'strict' });
        assert.strictEqual(unknown.sources.unknown, true);
        assert.strictEqual(unknown.sources.urlhaus, null);
        assert.strictEqual(unknown.sources.urlscan, null);
    });

    it('akzeptiert externe Verdikte auch als Objekt', function () {
        const result = ThundyLinkGate.decide({ local: { level: 'clean' }, urlscan: { malicious: true }, mode: 'balanced' });
        assert.strictEqual(result.action, 'block');
        assert.strictEqual(result.sources.urlscan, true);
    });
});

describe('link_gate: decide Sicherheits-Invarianten', function () {
    it('gibt bei URLhaus-Treffer niemals allow (strict/balanced)', function () {
        ['strict', 'balanced'].forEach(function (mode) {
            assert.strictEqual(ThundyLinkGate.decide({ local: { level: 'clean' }, urlhaus: true, mode: mode }).action, 'block');
        });
    });

    it('externe Sauberkeit hebt ein lokales block nicht auf', function () {
        assert.strictEqual(ThundyLinkGate.decide({ local: { level: 'high' }, urlscan: false, mode: 'strict' }).action, 'block');
        assert.strictEqual(ThundyLinkGate.decide({ local: { level: 'critical' }, hybrid: false, mode: 'strict' }).action, 'block');
        assert.notStrictEqual(ThundyLinkGate.decide({ local: { level: 'high' }, urlscan: false, mode: 'balanced' }).action, 'allow');
    });

    it('fehlende externe Pruefung hebt ein lokales block nicht auf', function () {
        assert.strictEqual(ThundyLinkGate.decide({ local: { level: 'high' }, mode: 'strict' }).action, 'block');
    });

    it('wirft nie, auch nicht bei kaputten Eingaben', function () {
        [null, undefined, 'x', 123, {}, { local: null }, { local: 'nope' }, { local: { level: 'weird' } }].forEach(function (input) {
            const result = ThundyLinkGate.decide(input);
            assert.ok(['allow', 'warn', 'block'].indexOf(result.action) !== -1);
            assert.ok(['clean', 'low', 'medium', 'high', 'critical'].indexOf(result.level) !== -1);
        });
    });
});

describe('link_gate: levelStyle', function () {
    it('liefert fuer jede Stufe Farbe, Icon und i18n-Schluessel', function () {
        ['clean', 'low', 'medium', 'high', 'critical'].forEach(function (level) {
            const style = ThundyLinkGate.levelStyle(level);
            assert.ok(style.color && style.background && style.border && style.icon);
            assert.strictEqual(style.labelKey, 'bannerLevel' + level.charAt(0).toUpperCase() + level.slice(1));
            assert.ok(typeof style.labelFallback === 'string' && style.labelFallback.length > 0);
        });
    });

    it('bleibt mit der Farbwelt von msg_display.js konsistent', function () {
        assert.strictEqual(ThundyLinkGate.levelStyle('clean').color, '#145c14');
        assert.strictEqual(ThundyLinkGate.levelStyle('medium').border, '#f0a500');
        assert.strictEqual(ThundyLinkGate.levelStyle('critical').border, '#c81e1e');
    });

    it('faellt bei unbekannter Stufe auf clean zurueck', function () {
        assert.deepStrictEqual(ThundyLinkGate.levelStyle('bogus'), ThundyLinkGate.levelStyle('clean'));
        assert.deepStrictEqual(ThundyLinkGate.levelStyle(undefined), ThundyLinkGate.levelStyle('clean'));
    });
});
