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
                            ipReputationApiKey: 'ip-key'
                        }),
                        set: async (data) => {
                            context.browser.storage.local.lastSetData = data;
                        },
                        lastSetData: null
                    }
                },
                permissions: {
                    contains: async () => true,
                    getAll: async () => ({ data_collection: ['personalCommunications'] }),
                    request: async (spec) => {
                        context.browser.permissions.requests.push(spec);
                        return true;
                    },
                    remove: async (spec) => {
                        context.browser.permissions.removals.push(spec);
                        return true;
                    },
                    requests: [],
                    removals: []
                }
            },
            openDB: async (name, version) => ({ name, version }),
            clearStore: async (db, storeName) => true,
            console: {
                error: () => {},
                log: () => {}
            },
            confirm: () => true, // default confirm behavior for tests
            setTimeout: (cb, ms) => cb() // fire immediately for tests
        };

        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'options.js'), 'utf8');
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

        // Auto-Scan (autoScanLinks) und Time-of-Click-Schutz sind unabhängige
        // Optionen: Auto-Scan deaktiviert die Time-of-Click-Option nicht mehr.
        const autoScanLinksCheckbox = context.document.getElementById('autoScanLinks');
        const timeOfClickProtectionCheckbox = context.document.getElementById('timeOfClickProtection');

        // Mock-Setup: autoScanLinks = true, timeOfClickProtection = false
        assert.strictEqual(timeOfClickProtectionCheckbox.disabled, false);
        assert.strictEqual(timeOfClickProtectionCheckbox.title, '');

        autoScanLinksCheckbox.checked = false;
        autoScanLinksCheckbox.dispatchEvent(changeEvent);
        assert.strictEqual(timeOfClickProtectionCheckbox.disabled, false);
        assert.strictEqual(timeOfClickProtectionCheckbox.title, '');

        // Beide Optionen bleiben getrennt schaltbar
        timeOfClickProtectionCheckbox.checked = true;
        assert.strictEqual(timeOfClickProtectionCheckbox.checked, true);
        assert.strictEqual(autoScanLinksCheckbox.checked, false);
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

    it('should keep autoScanLinks and timeOfClickProtection independent of each other', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));

        const autoScanLinksCheckbox = context.document.getElementById('autoScanLinks');
        const timeOfClickProtectionCheckbox = context.document.getElementById('timeOfClickProtection');
        const consentCheckbox = context.document.getElementById('externalAnalysisConsent');
        const urlscanApikeyInput = context.document.getElementById('urlscanApikey');
        const urlhausApikeyInput = context.document.getElementById('urlhausApikey');

        const changeEvent = context.document.createEvent('Event');
        changeEvent.initEvent('change', true, true);
        const inputEvent = context.document.createEvent('Event');
        inputEvent.initEvent('input', true, true);

        // Ausgangslage des Mocks: Auto-Scan an, Zustimmung an, urlscan-Schlüssel vorhanden
        assert.strictEqual(autoScanLinksCheckbox.checked, true);
        assert.strictEqual(autoScanLinksCheckbox.disabled, false);
        assert.strictEqual(autoScanLinksCheckbox.title, '');
        assert.strictEqual(timeOfClickProtectionCheckbox.disabled, false);
        assert.strictEqual(timeOfClickProtectionCheckbox.title, '');

        // Ohne Anbieter-Schlüssel bleibt Auto-Scan bedienbar – es erscheint nur der Hinweis
        urlscanApikeyInput.value = '';
        urlhausApikeyInput.value = '';
        urlscanApikeyInput.dispatchEvent(inputEvent);
        assert.notStrictEqual(autoScanLinksCheckbox.title, '');
        assert.strictEqual(autoScanLinksCheckbox.disabled, false);
        assert.strictEqual(timeOfClickProtectionCheckbox.disabled, false);

        // Schlüssel wieder vorhanden -> Hinweis verschwindet
        urlscanApikeyInput.value = 'urlscan-key';
        urlscanApikeyInput.dispatchEvent(inputEvent);
        assert.strictEqual(autoScanLinksCheckbox.title, '');

        // Ohne Zustimmung erscheint der Hinweis erneut, nichts wird deaktiviert
        consentCheckbox.checked = false;
        consentCheckbox.dispatchEvent(changeEvent);
        assert.notStrictEqual(autoScanLinksCheckbox.title, '');
        assert.strictEqual(autoScanLinksCheckbox.disabled, false);
        assert.strictEqual(timeOfClickProtectionCheckbox.disabled, false);

        // Time-of-Click-Schutz ist unabhängig vom Auto-Scan aktivierbar
        timeOfClickProtectionCheckbox.checked = true;
        assert.strictEqual(timeOfClickProtectionCheckbox.checked, true);
        assert.strictEqual(timeOfClickProtectionCheckbox.disabled, false);
    });


    it('should request the optional data collection permission when external analysis consent is enabled', async () => {
        const permissions = context.browser.permissions;
        context.document.getElementById('apikey').value = 'consent-key';
        context.document.getElementById('externalAnalysisConsent').checked = true;

        context.document.getElementById('save').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(permissions.requests.length, 1);
        // Der Aufruf entsteht im vm-Kontext -> Felder einzeln prüfen (Realm-übergreifend)
        assert.deepStrictEqual(permissions.requests[0].data_collection.length, 1);
        assert.strictEqual(permissions.requests[0].data_collection[0], 'personalCommunications');
        assert.strictEqual(permissions.removals.length, 0);
        assert.strictEqual(context.browser.storage.local.lastSetData.externalAnalysisConsent, true);
        assert.strictEqual(context.document.getElementById('save').disabled, false);
    });

    it('should return the optional data collection permission when the consent is switched off', async () => {
        const permissions = context.browser.permissions;
        context.document.getElementById('apikey').value = 'consent-key';
        context.document.getElementById('externalAnalysisConsent').checked = false;

        context.document.getElementById('save').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(permissions.removals.length, 1);
        assert.strictEqual(permissions.removals[0].data_collection.length, 1);
        assert.strictEqual(permissions.removals[0].data_collection[0], 'personalCommunications');
        assert.strictEqual(permissions.requests.length, 0);
        assert.strictEqual(context.browser.storage.local.lastSetData.externalAnalysisConsent, false);
    });

    it('should use the existing status hint (no alert) when the data collection permission is denied', async () => {
        const permissions = context.browser.permissions;
        permissions.request = async (spec) => {
            permissions.requests.push(spec);
            return false; // Nutzer lehnt die optionale Datenfreigabe ab
        };
        let alertCalls = 0;
        context.alert = () => { alertCalls += 1; };
        context.document.getElementById('apikey').value = 'consent-key';
        context.document.getElementById('externalAnalysisConsent').checked = true;

        context.document.getElementById('save').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(alertCalls, 0);
        const statusSpan = context.document.getElementById('saveStatus');
        assert.match(statusSpan.textContent, /Datenfreigabe wurde nicht erteilt/);
        assert.strictEqual(context.browser.storage.local.lastSetData.externalAnalysisConsent, true);
        assert.strictEqual(context.document.getElementById('save').disabled, false);
        assert.strictEqual(context.document.getElementById('save').textContent, 'Speichern');
    });


    it('should not call the data collection API on older Thunderbird versions without data_collection', async () => {
        const permissions = context.browser.permissions;
        permissions.getAll = async () => ({}); // ältere Version: keine data_collection-Angabe
        let requestCalled = false;
        let removeCalled = false;
        permissions.request = async () => { requestCalled = true; return true; };
        permissions.remove = async () => { removeCalled = true; return true; };
        context.document.getElementById('apikey').value = 'consent-key';
        context.document.getElementById('externalAnalysisConsent').checked = true;

        context.document.getElementById('save').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(requestCalled, false);
        assert.strictEqual(removeCalled, false);
        assert.notStrictEqual(context.browser.storage.local.lastSetData, null);
        assert.strictEqual(context.document.getElementById('save').disabled, false);
        assert.strictEqual(context.document.getElementById('save').textContent, 'Speichern');
    });

    it('should keep saving when permissions.getAll is not available at all', async () => {
        const permissions = context.browser.permissions;
        delete permissions.getAll; // ältere Version ohne Feature-Erkennungs-API
        context.document.getElementById('apikey').value = 'consent-key';
        context.document.getElementById('externalAnalysisConsent').checked = true;

        context.document.getElementById('save').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(context.browser.storage.local.lastSetData.externalAnalysisConsent, true);
        assert.strictEqual(context.document.getElementById('save').disabled, false);
        assert.strictEqual(context.document.getElementById('save').textContent, 'Speichern');
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
