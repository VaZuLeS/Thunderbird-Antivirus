/**
 * Tests für die Forscher-Ansicht im Popup (Rendering, Exporte, IOC-Kopie).
 *
 * Geladen wird das echte api.js in einer VM mit jsdom-DOM, damit die
 * Renderfunktionen gegen echte DOM-Knoten geprüft werden (kein innerHTML,
 * kopierbare Werte, Tabellenaufbau).
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

const SAMPLE_DOSSIER = {
    schema: 'thundy-av/research-dossier@1',
    generatedAt: '2026-10-01T10:00:00.000Z',
    message: {
        id: 1,
        headerMessageId: '<abc@example.org>',
        subject: 'Dringend: Rechnung',
        date: '2026-10-01T09:00:00.000Z',
        recipients: 'opfer@example.org',
        size: 4096,
        folder: 'Inbox'
    },
    securityHeaders: { returnPath: '<bounce@paypa1.com>', messageId: '<abc@example.org>', xMailer: null, listUnsubscribe: null },
    provenance: {
        computedLocally: true,
        privacyTier: 'strict',
        consentGiven: true,
        providersConfigured: { hybridAnalysis: true, virusTotal: false, urlscan: false, urlhaus: false, abuseIpdb: false, ipReputation: false },
        urlhausMatches: [],
        maliciousIps: []
    },
    authentication: { spf: 'fail', dkim: ['pass'], dmarc: 'fail', spoofingSuspect: true, raw: [], spfRaw: [] },
    receivedChain: [
        { index: 0, from: 'mx.example', by: 'inbox.example', ip: '203.0.113.9', protocol: 'ESMTPS', timestamp: '2026-10-01T09:30:00.000Z', delaySeconds: 1800, delaySuspicious: false }
    ],
    sender: {
        address: 'buchhaltung@paypa1.com',
        domain: 'paypa1.com',
        registrableDomain: 'paypa1.com',
        displayName: 'Buchhaltung',
        replyTo: 'kontakt@other-mail.example',
        replyToDomain: 'other-mail.example',
        replyToMismatch: true,
        displayNameMismatch: true,
        displayNameLookalike: true,
        firstContact: true
    },
    attachments: [
        { partName: '1.2', name: 'rechnung.docm', contentType: 'application/msword', size: 2048, sha256: 'a'.repeat(64), riskyExtension: true, archive: false }
    ],
    links: [
        { url: 'https://bit.ly/3xY', scheme: 'https', host: 'bit.ly', registrableDomain: 'bit.ly', tld: 'ly', isPunycode: false, brandLookalike: null, trackingParameters: ['uid'], isShortener: true, hasCredentials: false, isHttps: true }
    ],
    iocs: {
        urls: ['https://bit.ly/3xY'],
        domains: ['bit.ly'],
        ips: ['203.0.113.9'],
        hashes: ['a'.repeat(64)],
        emails: ['buchhaltung@paypa1.com']
    },
    risk: {
        score: 85,
        rawScore: 130,
        verdict: 'malicious',
        authStatus: 'fail',
        reasons: ['SPF-Prüfung fehlgeschlagen (Mögliches Spoofing).'],
        breakdown: [{ id: 'auth', label: 'Authentifizierung (SPF/DKIM/DMARC)', points: 30, reasons: ['SPF fehlgeschlagen'] }]
    },
    mitre: [{ id: 'T1566.001', name: 'Spearphishing Attachment', tactic: 'Initial Access', confidence: 'heuristic', evidence: ['rechnung.docm'] }],
    timeline: [
        { at: '2026-10-01T09:00:00.000Z', event: 'Nachrichtendatum', detail: '' },
        { at: '2026-10-01T10:00:00.000Z', event: 'Lokale Bewertung', detail: 'Score 85' }
    ]
};

describe('researcher view in the popup', () => {
    let context;

    before(() => {
        const dom = new JSDOM('<!doctype html><html><body><div id="research-root"></div><div id="report-root"></div><div id="status_message"></div><div class="thundy-toolbar"><button type="button" id="btn-export-json">JSON</button><button type="button" id="btn-export-csv">CSV</button><button type="button" id="btn-copy-iocs">IOC</button></div></body></html>');
        context = {
            browser: {
                storage: { local: { get: async () => ({ externalAnalysisConsent: true }) } },
                runtime: { sendMessage: async () => ({ status: 'success', data: {} }), openOptionsPage: () => {} },
                tabs: { query: async () => [{ id: 1 }] },
                messageDisplay: { getDisplayedMessages: async () => ({ messages: [{ id: 1, headerMessageId: '<abc@example.org>' }] }) }
            },
            document: dom.window.document,
            navigator: dom.window.navigator,
            Node: dom.window.Node,
            console,
            setTimeout,
            clearTimeout,
            URL,
            URLSearchParams
        };
        vm.createContext(context);

        const code = fs.readFileSync(path.join(ROOT, 'api.js'), 'utf8');
        let wrapped = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrapped = wrapped.replace(/\}\)\(\);/, '}');
        for (const name of ['createEl', 'createTable', 'createKeyValueList', 'severityForScore', 'buildDossierCsv',
            'buildDossierStix', 'formatIocsAsText', 'renderResearchDossier', 'initResearchView', 'createResearchTabs',
            'ensureStixExportButton', 'saveResearchExport']) {
            wrapped += '\n; globalThis.' + name + ' = ' + name + ';\n';
        }
        vm.runInContext(wrapped, context);
    });

    beforeEach(() => {
        context.document.getElementById('research-root').textContent = '';
        context.document.getElementById('status_message').textContent = '';
        const stix = context.document.getElementById('btn-export-stix');
        if (stix) stix.remove();
    });

    it('classifies the score into a severity for the badge and the risk bar', () => {
        assert.strictEqual(context.severityForScore(95), 'critical');
        assert.strictEqual(context.severityForScore(60), 'high');
        assert.strictEqual(context.severityForScore(25), 'medium');
        assert.strictEqual(context.severityForScore(3), 'low');
    });

    it('renders the researcher sections into the DOM without innerHTML', () => {
        context.renderResearchDossier(SAMPLE_DOSSIER);
        const root = context.document.getElementById('research-root');
        const ids = Array.from(root.querySelectorAll('.thundy-section')).map((section) => section.id);
        for (const expected of ['research-breakdown', 'research-headers', 'research-attachments',
            'research-links', 'research-iocs', 'research-mitre', 'research-timeline']) {
            assert.ok(ids.includes(expected), 'missing section ' + expected + ' (have ' + ids.join(',') + ')');
        }
        assert.ok(root.querySelector('.thundy-verdict__score'), 'the score badge is rendered');
        assert.strictEqual(root.querySelector('.thundy-verdict__score').textContent, '85');
        assert.ok(root.querySelector('.thundy-riskbar__fill'), 'the risk bar is rendered');
        assert.strictEqual(root.querySelector('.thundy-riskbar__fill').style.width, '85%');
        assert.strictEqual(root.querySelector('.thundy-mono').textContent.length, 64, 'the SHA-256 is shown');
        assert.ok(root.querySelector('.thundy-table tbody tr'), 'tables have rows');
    });

    it('marks the heuristic MITRE mapping explicitly', () => {
        context.renderResearchDossier(SAMPLE_DOSSIER);
        const root = context.document.getElementById('research-root');
        const notes = Array.from(root.querySelectorAll('.thundy-note')).map((note) => note.textContent).join(' ');
        assert.match(notes, /Heuristische Zuordnung/);
        assert.match(root.textContent, /T1566\.001/);
    });

    it('builds a CSV export with message, score, attachment hash and IOCs', () => {
        const csv = context.buildDossierCsv(SAMPLE_DOSSIER);
        assert.match(csv, /"Kategorie";"Feld";"Wert"/);
        assert.match(csv, /"Nachricht";"Betreff";"Dringend: Rechnung"/);
        assert.match(csv, /"Bewertung";"Score";"85"/);
        assert.match(csv, /"Anhang";"rechnung\.docm";"a{64}"/);
        assert.match(csv, /"IOC:ips";"203\.0\.113\.9"/);
        assert.ok(csv.endsWith('\r\n'));
    });

    it('builds a minimal STIX 2.1 bundle for the IOCs', () => {
        const bundle = JSON.parse(context.buildDossierStix(SAMPLE_DOSSIER));
        assert.strictEqual(bundle.type, 'bundle');


        const indicators = bundle.objects.filter((object) => object.type === 'indicator');
        assert.strictEqual(indicators.length, 5, 'one indicator per IOC');
        assert.ok(indicators.every((indicator) => indicator.spec_version === '2.1'));
        assert.ok(indicators.some((indicator) => indicator.pattern.includes('domain-name:value')));
        assert.ok(indicators.some((indicator) => indicator.pattern.includes("file:hashes.'SHA-256'")));
        assert.ok(bundle.objects.some((object) => object.type === 'identity'));
    });

    it('formats the IOC list for the clipboard', () => {
        const text = context.formatIocsAsText(SAMPLE_DOSSIER);
        assert.match(text, /# URLs\nhttps:\/\/bit\.ly\/3xY/);
        assert.match(text, /# IP-Adressen\n203\.0\.113\.9/);
        assert.match(text, /# E-Mail-Adressen\nbuchhaltung@paypa1\.com/);
    });
});



describe('researcher view export wiring', () => {
    it('wires the export buttons and reports the saved file', async () => {
        const dom = new JSDOM('<!doctype html><html><body><div id="research-root"></div><div id="report-root"></div><div id="status_message"></div><div class="thundy-toolbar"><button type="button" id="btn-export-json">JSON</button><button type="button" id="btn-export-csv">CSV</button><button type="button" id="btn-copy-iocs">IOC</button></div></body></html>');
        const sent = [];
        const context = {
            browser: {
                storage: { local: { get: async () => ({ externalAnalysisConsent: true }) } },
                runtime: {
                    sendMessage: async (message) => {
                        sent.push(message);
                        if (message.action === 'getResearchDossier') return { status: 'success', data: SAMPLE_DOSSIER };
                        return { status: 'success', data: { filename: 'thundy-av-2026-10-01.json', downloadId: 1 } };
                    },
                    openOptionsPage: () => {}
                },
                tabs: { query: async () => [{ id: 1 }] },
                messageDisplay: { getDisplayedMessages: async () => ({ messages: [{ id: 1 }] }) }
            },
            document: dom.window.document,
            navigator: dom.window.navigator,
            Node: dom.window.Node,
            console,
            setTimeout,
            clearTimeout,
            URL,
            URLSearchParams
        };
        vm.createContext(context);
        const code = fs.readFileSync(path.join(ROOT, 'api.js'), 'utf8');
        let wrapped = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrapped = wrapped.replace(/\}\)\(\);/, '}');
        for (const name of ['initResearchView', 'buildDossierCsv']) {
            wrapped += '\n; globalThis.' + name + ' = ' + name + ';\n';
        }
        vm.runInContext(wrapped, context);

        await context.initResearchView(1);
        assert.strictEqual(sent[0].action, 'getResearchDossier');
        assert.strictEqual(sent[0].messageId, 1);
        assert.ok(context.document.getElementById('btn-export-stix'), 'the STIX button is added to the toolbar');

        context.document.getElementById('btn-export-json').click();
        context.document.getElementById('btn-export-csv').click();
        context.document.getElementById('btn-export-stix').click();
        await new Promise((resolve) => setTimeout(resolve, 20));

        const exports = sent.filter((message) => message.action === 'saveResearchExport');
        assert.strictEqual(exports.length, 3);
        assert.deepStrictEqual(exports.map((message) => message.mimeType), ['application/json', 'text/csv', 'application/json']);
        assert.match(exports[0].content, /"schema": "thundy-av\/research-dossier@1"/);
        assert.match(exports[1].content, /"Kategorie";"Feld";"Wert"/);
        assert.match(context.document.getElementById('status_message').textContent, /gespeichert/);
    });

    it('shows a note instead of failing silently when the dossier cannot be built', async () => {
        const dom = new JSDOM('<!doctype html><html><body><div id="research-root"></div><div id="report-root"></div><div id="status_message"></div></body></html>');
        const context = {
            browser: {
                storage: { local: { get: async () => ({ externalAnalysisConsent: true }) } },
                runtime: { sendMessage: async () => ({ status: 'error', message: 'No message' }), openOptionsPage: () => {} },
                tabs: { query: async () => [{ id: 1 }] },
                messageDisplay: { getDisplayedMessages: async () => ({ messages: [{ id: 1 }] }) }
            },
            document: dom.window.document,
            navigator: dom.window.navigator,
            Node: dom.window.Node,
            console,
            setTimeout,
            clearTimeout,
            URL,
            URLSearchParams
        };
        vm.createContext(context);
        const code = fs.readFileSync(path.join(ROOT, 'api.js'), 'utf8');
        let wrapped = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrapped = wrapped.replace(/\}\)\(\);/, '}');
        wrapped += '\n; globalThis.initResearchView = initResearchView;\n';
        vm.runInContext(wrapped, context);

        await context.initResearchView(1);
        assert.match(context.document.getElementById('research-root').textContent, /Forscheransicht nicht verfügbar: No message/);
    });
});
