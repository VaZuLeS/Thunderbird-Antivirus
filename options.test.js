const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

describe('options.js', () => {
    let context;
    let dom;

    beforeEach(() => {
        // Create mock environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <input id="apikey" value="">
                    <input id="urlhausApikey" value="">
                    <input id="urlscanApikey" value="">
                    <input id="virustotalApikey" value="">
                    <select id="privacyTier"><option value="balanced">Balanced</option><option value="high">High</option></select>
                    <input id="customWhitelist" value="">
                    <input id="customBlacklist" value="">
                    <input type="checkbox" id="alwaysManual">
                    <input type="checkbox" id="autoScanLinks">
                    <input type="checkbox" id="timeOfClickProtection">
                    <input type="checkbox" id="externalAnalysisConsent">
                    <select id="ipReputationProvider"><option value="none">none</option><option value="abuseipdb">abuseipdb</option><option value="virustotal">virustotal</option></select>
                    <input id="ipReputationApiKey" value="">

                    <button id="save">Speichern</button>
                    <span id="saveStatus" style="display: none;">Erfolgreich gespeichert.</span>

                    <select id="viewMode">
                        <option value="quiet">quiet</option>
                        <option value="private">private</option>
                        <option value="business">business</option>
                        <option value="research">research</option>
                        <option value="audit">audit</option>
                    </select>
                    <input type="checkbox" id="historyEnabled">
                    <input type="number" id="historyLimit" value="500">
                    <select id="historyFilter">
                        <option value="all">all</option>
                        <option value="transmissions">transmissions</option>
                    </select>
                    <input id="historySearch" value="">
                    <input type="date" id="historyFrom">
                    <input type="date" id="historyTo">
                    <input type="checkbox" id="webhookEnabled">
                    <input id="webhookUrl" value="">
                    <input id="webhookSecret" value="">
                    <button id="webhookTest">Test</button>
                    <small id="webhookStatus"></small>
                    <button id="historyRefresh">Aktualisieren</button>
                    <button id="historyExportCsv">CSV</button>
                    <button id="historyExportJson">JSON</button>
                    <button id="historyClear">Verlauf loeschen</button>
                    <select id="statisticsDays"><option value="7">7</option></select>
                    <button id="statisticsRefresh">Statistik</button>
                    <div id="statisticsPanel"></div>
                    <input id="sandboxAuthor" value="">
                    <input id="sandboxSubject" value="">
                    <textarea id="sandboxText"></textarea>
                    <textarea id="sandboxUrls"></textarea>
                    <button id="sandboxRun">Auswerten</button>
                    <div id="sandboxResult"></div>
                    <button id="diagnosticsRun">Diagnose</button>
                    <div id="diagnosticsPanel"></div>
                    <p id="historySummary"></p>
                    <ul id="historyList"></ul>

                    <button id="clearCache">Cache leeren</button>
                    <span id="clearCacheStatus" style="display: none;"></span>
                </body>
            </html>
        `);

        context = {
            document: dom.window.document,
            browser: {
                storage: {
                    local: {
                        get: async () => ({
                            apikey: 'test-api-key',
                            urlhausApikey: 'test-urlhaus',
                            urlscanApikey: 'test-urlscan',
                            virustotalApikey: 'test-vt',
                            privacyTier: 'high',
                            customWhitelist: ['example.com', 'test.com'],
                            customBlacklist: ['bad.com'],
                            alwaysManual: true,
                            autoScanLinks: true,
                            timeOfClickProtection: false,
                            externalAnalysisConsent: true,
                            ipReputationProvider: 'abuseipdb',
                            ipReputationApiKey: 'ip-key',
                            viewMode: 'research',
                            webhookEnabled: true,
                            webhookUrl: 'https://siem.example/hook',
                            webhookSecret: 'secret',
                            historyEnabled: true,
                            historyLimit: 250
                        }),
                        set: async (data) => {
                            context.browser.storage.local.lastSetData = data;
                        },
                        lastSetData: null
                    }
                },
                permissions: {
                    contains: async () => true,
                    request: async () => true
                },
                runtime: {
                    sendMessage: async (message) => {
                        context.sentMessages.push(message);
                        if (message.action === 'getHistory') {
                            return context.historyResponse;
                        }
                        if (message.action === 'evaluateSample') {
                            return context.sampleResponse;
                        }
                        if (message.action === 'getStatistics') {
                            return context.statisticsResponse;
                        }
                        if (message.action === 'getDiagnostics') {
                            return context.diagnosticsResponse;
                        }
                        if (message.action === 'clearHistory') {
                            return { status: 'success' };
                        }
                        return { status: 'success' };
                    }
                }
            },
            openDB: async (name, version) => ({ name, version }),
            clearStore: async (db, storeName) => true,
            console: {
                error: () => {},
                log: () => {}
            },
            confirm: () => true, // default confirm behavior for tests
            sentMessages: [],
            sampleResponse: { status: 'success', result: { score: 0, authStatus: 'neutral', breakdown: [], reasons: [], matchedRules: [], forensics: { findings: [] } } },
            statisticsResponse: { status: 'success', statistics: { total: 0, transmissions: 0, localOnly: 0, windowDays: 7, recent: 0, byAction: {}, byProvider: {}, byDay: {}, recentTransmissions: [] }, managed: false, managedKeys: [] },
            diagnosticsResponse: { status: 'success', report: { generatedAt: '2026-09-28T10:00:00.000Z', summary: { ok: 0, warn: 0, fail: 0 }, checks: [] } },
            historyResponse: { status: 'success', entries: [], summary: { total: 0, transmissions: 0, local: 0, providers: {}, lastTransmissionAt: null } },
            URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
            Blob: class Blob { constructor(parts, opts) { this.parts = parts; this.opts = opts; } },
            setTimeout: (cb, ms) => cb() // fire immediately for tests
        };

        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'options.js'), 'utf8');
        vm.runInContext(fs.readFileSync(path.join(__dirname, 'ui_i18n.js'), 'utf8'), context);
        vm.runInContext(code, context);

        // Trigger DOMContentLoaded for all tests so listeners are attached
        const event = context.document.createEvent('Event');
        event.initEvent('DOMContentLoaded', true, true);
        context.document.dispatchEvent(event);
    });

    it('should load settings on DOMContentLoaded', async () => {
        // Wait a small tick to allow Promises in the listener to resolve
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(context.document.getElementById('apikey').value, 'test-api-key');
        assert.strictEqual(context.document.getElementById('urlhausApikey').value, 'test-urlhaus');
        assert.strictEqual(context.document.getElementById('urlscanApikey').value, 'test-urlscan');
        assert.strictEqual(context.document.getElementById('virustotalApikey').value, 'test-vt');
        assert.strictEqual(context.document.getElementById('privacyTier').value, 'high');
        assert.strictEqual(context.document.getElementById('customWhitelist').value, 'example.com, test.com');
        assert.strictEqual(context.document.getElementById('customBlacklist').value, 'bad.com');
        assert.strictEqual(context.document.getElementById('alwaysManual').checked, true);
        assert.strictEqual(context.document.getElementById('autoScanLinks').checked, true);
        assert.strictEqual(context.document.getElementById('timeOfClickProtection').checked, false);
        assert.strictEqual(context.document.getElementById('externalAnalysisConsent').checked, true);
        assert.strictEqual(context.document.getElementById('ipReputationProvider').value, 'abuseipdb');
        assert.strictEqual(context.document.getElementById('ipReputationApiKey').value, 'ip-key');

        const changeEvent = context.document.createEvent('Event');
        changeEvent.initEvent('change', true, true);

        // Check alwaysManual disables privacyTier
        const alwaysManualCheckbox = context.document.getElementById('alwaysManual');
        const privacyTierSelect = context.document.getElementById('privacyTier');

        // Initial is checked (true) in mock setup
        assert.strictEqual(privacyTierSelect.disabled, true);
        assert.strictEqual(privacyTierSelect.title, 'Datenschutz-Stufe ist bei manuellem Scan irrelevant');

        alwaysManualCheckbox.checked = false;
        alwaysManualCheckbox.dispatchEvent(changeEvent);
        assert.strictEqual(privacyTierSelect.disabled, false);
        assert.strictEqual(privacyTierSelect.title, '');

        // Check autoScanLinks disables timeOfClickProtection
        const autoScanLinksCheckbox = context.document.getElementById('autoScanLinks');
        const timeOfClickProtectionCheckbox = context.document.getElementById('timeOfClickProtection');

        // Initial is checked (true) in mock setup
        assert.strictEqual(timeOfClickProtectionCheckbox.disabled, true);
        assert.strictEqual(timeOfClickProtectionCheckbox.title, 'Time-of-Click Protection ist irrelevant, wenn Auto-Scan aktiv ist');

        autoScanLinksCheckbox.checked = false;
        autoScanLinksCheckbox.dispatchEvent(changeEvent);
        assert.strictEqual(timeOfClickProtectionCheckbox.disabled, false);
        assert.strictEqual(timeOfClickProtectionCheckbox.title, '');
    });

    it('should save settings when save button is clicked', async () => {
        // Manually set values in DOM to simulate user input
        context.document.getElementById('apikey').value = 'new-api-key\n';
        context.document.getElementById('urlhausApikey').value = 'new-urlhaus';
        context.document.getElementById('urlscanApikey').value = 'new-urlscan';
        context.document.getElementById('virustotalApikey').value = 'new-vt\r';
        context.document.getElementById('privacyTier').value = 'balanced';
        context.document.getElementById('customWhitelist').value = 'new.com, another.com';
        context.document.getElementById('customBlacklist').value = 'verybad.com';
        context.document.getElementById('alwaysManual').checked = false;
        context.document.getElementById('autoScanLinks').checked = false;
        context.document.getElementById('timeOfClickProtection').checked = true;
        context.document.getElementById('externalAnalysisConsent').checked = true;
        context.document.getElementById('ipReputationProvider').value = 'virustotal';
        context.document.getElementById('ipReputationApiKey').value = 'ip-key-new\n';

        const saveBtn = context.document.getElementById('save');
        saveBtn.click();

        assert.strictEqual(saveBtn.disabled, true);
        assert.strictEqual(saveBtn.textContent, 'Wird gespeichert...');

        await new Promise(resolve => setTimeout(resolve, 10));

        const savedData = context.browser.storage.local.lastSetData;
        assert.strictEqual(savedData.apikey, 'new-api-key'); // \n removed
        assert.strictEqual(savedData.urlhausApikey, 'new-urlhaus');
        assert.strictEqual(savedData.urlscanApikey, 'new-urlscan');
        assert.strictEqual(savedData.virustotalApikey, 'new-vt'); // \r removed
        assert.strictEqual(savedData.privacyTier, 'balanced');
        assert.strictEqual(savedData.customWhitelist.length, 2);
        assert.strictEqual(savedData.customWhitelist[0], 'new.com');
        assert.strictEqual(savedData.customWhitelist[1], 'another.com');
        assert.strictEqual(savedData.customBlacklist.length, 1);
        assert.strictEqual(savedData.customBlacklist[0], 'verybad.com');
        assert.strictEqual(savedData.alwaysManual, false);
        assert.strictEqual(savedData.autoScanLinks, false);
        assert.strictEqual(savedData.timeOfClickProtection, true);
        assert.strictEqual(savedData.externalAnalysisConsent, true);
        assert.strictEqual(savedData.ipReputationProvider, 'virustotal');
        assert.strictEqual(savedData.ipReputationApiKey, 'ip-key-new');

        assert.strictEqual(saveBtn.disabled, false);
        assert.strictEqual(saveBtn.textContent, 'Speichern');

        // saveStatus block
        // It sets display to 'inline' then after timeout to 'none'.
        // Since we mock setTimeout to fire immediately, it will be 'none' again.
        assert.strictEqual(context.document.getElementById('saveStatus').style.display, 'none');
    });

    it('should handle save error', async () => {
        context.document.getElementById('apikey').value = 'dummy-key';
        context.browser.storage.local.set = async () => {
            throw new Error("mock error");
        };

        const saveBtn = context.document.getElementById('save');
        saveBtn.click();

        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(saveBtn.disabled, false);
        assert.strictEqual(saveBtn.textContent, 'Speichern');
    });

    it('loads the role and history settings', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(context.document.getElementById('viewMode').value, 'research');
        assert.strictEqual(context.document.getElementById('historyEnabled').checked, true);
        assert.strictEqual(context.document.getElementById('historyLimit').value, '250');
    });

    it('saves the role and history settings', async () => {
        context.document.getElementById('viewMode').value = 'audit';
        context.document.getElementById('historyEnabled').checked = false;
        context.document.getElementById('historyLimit').value = '1000';
        context.document.getElementById('apikey').value = 'key';
        context.document.getElementById('save').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        const saved = context.browser.storage.local.lastSetData;
        assert.strictEqual(saved.viewMode, 'audit');
        assert.strictEqual(saved.historyEnabled, false);
        assert.strictEqual(saved.historyLimit, 1000);
    });

    it('formats a history entry for the options list', () => {
        const line = context.describeHistoryLine({
            timestamp: '2026-09-28T10:00:00.000Z', action: 'attachment-upload', transmitted: true,
            provider: 'hybrid-analysis', attachmentName: 'rechnung.pdf', sha256: 'a'.repeat(64),
            jobId: 'job-7', verdict: 'MALICIOUS', detail: 'hochgeladen'
        });
        assert.match(line, /attachment-upload/);
        assert.match(line, /uebertragen an hybrid-analysis/);
        assert.match(line, /rechnung\.pdf/);
        assert.match(line, /verdict=MALICIOUS/);
        assert.match(line, /job=job-7/);
    });

    it('builds a CSV export with a header row and escaping', () => {
        const csv = context.buildHistoryCsv([
            { timestamp: '2026-09-28T10:00:00.000Z', action: 'local-check', transmitted: false, subject: 'Rechnung; wichtig', detail: 'ok' }
        ]);
        const lines = csv.split('\n');
        assert.strictEqual(lines.length, 2);
        assert.match(lines[0], /^timestamp;action;transmitted/);
        assert.match(lines[1], /Rechnung; wichtig/);
    });

    it('builds a JSON export', () => {
        const parsed = JSON.parse(context.buildHistoryJson([{ action: 'url-scan', transmitted: true }]));
        assert.strictEqual(parsed.length, 1);
        assert.strictEqual(parsed[0].action, 'url-scan');
    });

    it('renders the history list and summary', async () => {
        context.historyResponse = {
            status: 'success',
            entries: [
                { timestamp: '2026-09-28T10:00:00.000Z', action: 'local-check', transmitted: false, subject: 'Erste', detail: 'lokal' },
                { timestamp: '2026-09-28T10:05:00.000Z', action: 'attachment-upload', transmitted: true, provider: 'hybrid-analysis', attachmentName: 'x.exe', detail: 'hochgeladen' }
            ],
            summary: { total: 2, transmissions: 1, local: 1, providers: { 'hybrid-analysis': 1 }, lastTransmissionAt: '2026-09-28T10:05:00.000Z' }
        };
        await context.loadHistory();

        const list = context.document.getElementById('historyList');
        assert.strictEqual(list.children.length, 2);
        assert.strictEqual(list.children[0].textContent.includes('hochgeladen'), true);
        assert.match(context.document.getElementById('historySummary').textContent, /1 Uebertragung/);
    });

    it('clears the history after confirmation', async () => {
        context.document.getElementById('historyClear').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.ok(context.sentMessages.some(message => message.action === 'clearHistory'));
    });

    it('renders the statistics panel including managed policy info', async () => {
        context.statisticsResponse = {
            status: 'success',
            statistics: {
                total: 6, transmissions: 2, localOnly: 4, windowDays: 7, recent: 5,
                byAction: { 'local-check': 4, 'attachment-upload': 2 },
                byProvider: { 'hybrid-analysis': 2 },
                byDay: { '2026-09-28': 5 },
                recentTransmissions: []
            },
            managed: true,
            managedKeys: ['viewMode']
        };
        context.document.getElementById('statisticsRefresh').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        const panel = context.document.getElementById('statisticsPanel');
        assert.match(panel.textContent, /Übertragungen an Anbieter: 2/);
        assert.match(panel.textContent, /Rein lokale Prüfungen: 4/);
        assert.match(panel.textContent, /hybrid-analysis: 2/);
        assert.match(panel.textContent, /Verwaltete Vorgaben aktiv: viewMode/);
    });

    it('renders the diagnostics panel with status icons', async () => {
        context.diagnosticsResponse = {
            status: 'success',
            report: {
                generatedAt: '2026-09-28T10:00:00.000Z',
                summary: { ok: 1, warn: 1, fail: 0 },
                checks: [
                    { id: 'consent', label: 'Zustimmung', status: 'warn', detail: 'Inaktiv' },
                    { id: 'indexeddb', label: 'Ergebnisspeicher', status: 'ok', detail: 'Erreichbar' }
                ]
            }
        };
        context.document.getElementById('diagnosticsRun').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        const panel = context.document.getElementById('diagnosticsPanel');
        assert.match(panel.textContent, /1 ok, 1 Hinweis\(e\), 0 Fehler/);
        assert.match(panel.textContent, /⚠️ Zustimmung: Inaktiv/);
        assert.match(panel.textContent, /✅ Ergebnisspeicher: Erreichbar/);
    });

    it('evaluates a sample in the local sandbox and shows the breakdown', async () => {
        context.sampleResponse = {
            status: 'success',
            result: {
                score: 85,
                authStatus: 'fail',
                breakdown: [{ source: 'authentifizierung', points: 60 }, { source: 'header-forensik', points: 25 }],
                reasons: ['SPF-Prüfung fehlgeschlagen.', 'Header-Forensik: Anzeigename nennt PayPal, Domain ist fremd.'],
                matchedRules: [{ type: 'subject', pattern: 'rechnung', action: 'score', matched: 'Ihre Rechnung' }],
                forensics: { findings: [{ severity: 'hoch', detail: 'Anzeigename nennt PayPal, Domain ist fremd.' }] }
            }
        };
        context.document.getElementById('sandboxAuthor').value = 'Service <service@fremd.example>';
        context.document.getElementById('sandboxSubject').value = 'Ihre Rechnung';
        context.document.getElementById('sandboxUrls').value = 'https://evil.example/a\n\nhttps://evil.example/b';
        context.document.getElementById('sandboxRun').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        const panel = context.document.getElementById('sandboxResult');
        assert.match(panel.textContent, /Bewertung: 85 von 100/);
        assert.match(panel.textContent, /authentifizierung \+60/);
        assert.match(panel.textContent, /SPF-Prüfung fehlgeschlagen\./);
        assert.match(panel.textContent, /Greifende Regeln: subject "rechnung" \(score auf Ihre Rechnung\)/);
        assert.match(panel.textContent, /\[hoch\] Anzeigename nennt PayPal/);

        const sampleMessage = context.sentMessages.find(message => message.action === 'evaluateSample');
        assert.ok(sampleMessage, 'the sandbox must call the background evaluation');
        assert.strictEqual(sampleMessage.sample.urls.length, 2, 'empty lines are dropped');
        assert.strictEqual(sampleMessage.sample.subject, 'Ihre Rechnung');
    });

    it('renders detected bursts in the statistics panel', async () => {
        context.statisticsResponse = {
            status: 'success',
            statistics: {
                total: 4, transmissions: 1, localOnly: 3, windowDays: 7, recent: 4,
                byAction: {}, byProvider: {}, byDay: {}, recentTransmissions: []
            },
            bursts: [{ key: 'spam@example.net', count: 3, windowMinutes: 10, transmissions: 1 }],
            managed: false,
            managedKeys: []
        };
        context.document.getElementById('statisticsRefresh').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        const panel = context.document.getElementById('statisticsPanel');
        assert.match(panel.textContent, /Häufungen \(Bursts\):/);
        assert.match(panel.textContent, /spam@example\.net: 3 Einträge in 10 Minuten \(1 Übertragungen\)/);
    });

    it('should clear cache when clearCache button is clicked (success)', async () => {
        let openDBCalled = false;
        let clearStoreCalled = false;

        context.openDB = async (name, version) => {
            openDBCalled = true;
            assert.strictEqual(name, 'thunderbird_av');
            assert.strictEqual(version, 3);
            return { db: true };
        };

        context.clearStore = async (db, storeName) => {
            clearStoreCalled = true;
            assert.strictEqual(storeName, 'hybridanalysis');
            return true;
        };

        const clearBtn = context.document.getElementById('clearCache');
        clearBtn.click();

        assert.strictEqual(clearBtn.disabled, true);
        assert.strictEqual(clearBtn.textContent, 'Wird geleert...');

        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(openDBCalled, true);
        assert.strictEqual(clearStoreCalled, true);
        assert.strictEqual(clearBtn.disabled, false);
        assert.strictEqual(clearBtn.textContent, 'Cache leeren');

        const statusSpan = context.document.getElementById('clearCacheStatus');
        assert.strictEqual(statusSpan.textContent, 'Cache erfolgreich geleert.');
        assert.strictEqual(statusSpan.className, 'text-success ml-2');
        assert.strictEqual(statusSpan.style.display, 'none');
    });

    it('should not clear cache when confirmation is cancelled', async () => {
        let openDBCalled = false;
        let clearStoreCalled = false;

        context.confirm = () => false;

        context.openDB = async (name, version) => {
            openDBCalled = true;
            return { db: true };
        };

        context.clearStore = async (db, storeName) => {
            clearStoreCalled = true;
            return true;
        };

        const clearBtn = context.document.getElementById('clearCache');
        clearBtn.click();

        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(openDBCalled, false);
        assert.strictEqual(clearStoreCalled, false);

        // Reset the mock
        context.confirm = () => true;
    });

    it('should display info if cache is already empty or DB does not exist', async () => {
        context.clearStore = async () => false;

        context.document.getElementById('clearCache').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        const statusSpan = context.document.getElementById('clearCacheStatus');
        assert.strictEqual(statusSpan.textContent, 'Datenbank existiert noch nicht oder ist bereits leer.');
        assert.strictEqual(statusSpan.className, 'text-success ml-2');
        assert.strictEqual(statusSpan.style.display, 'none');
    });

    it('should handle clear cache error', async () => {
        context.openDB = async () => {
            throw new Error("mock error");
        };

        context.document.getElementById('clearCache').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        const statusSpan = context.document.getElementById('clearCacheStatus');
        assert.strictEqual(statusSpan.textContent, 'Fehler beim Leeren des Caches.');
        assert.strictEqual(statusSpan.className, 'text-danger ml-2');
        assert.strictEqual(statusSpan.style.display, 'none');
    });

    it('should enforce security attributes on all API key input fields in options.html', () => {
        const html = fs.readFileSync(path.join(__dirname, 'options.html'), 'utf8');
        const optionsDom = new JSDOM(html);
        const apiKeyIds = ['apikey', 'urlhausApikey', 'urlscanApikey', 'virustotalApikey'];

        for (const id of apiKeyIds) {
            const inputEl = optionsDom.window.document.getElementById(id);
            assert.ok(inputEl, `Input element #${id} should exist`);
            assert.strictEqual(inputEl.getAttribute('type'), 'password', `#${id} must have type="password"`);
            assert.strictEqual(inputEl.getAttribute('autocomplete'), 'off', `#${id} must have autocomplete="off"`);
            assert.strictEqual(inputEl.getAttribute('maxlength'), '255', `#${id} must have maxlength="255"`);
            assert.strictEqual(inputEl.getAttribute('spellcheck'), 'false', `#${id} must have spellcheck="false"`);
        }
    });
});
