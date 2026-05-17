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
                    <select id="ipReputationProvider"><option value="none">None</option><option value="provider1">Provider 1</option></select>
                    <input id="ipReputationApiKey" value="">
                    <input type="checkbox" id="alwaysManual">
                    <input type="checkbox" id="autoScanLinks">
                    <input type="checkbox" id="timeOfClickProtection">

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
                            ipReputationProvider: 'provider1',
                            ipReputationApiKey: 'test-ip-key',
                            alwaysManual: true,
                            autoScanLinks: true,
                            timeOfClickProtection: false
                        }),
                        set: async (data) => {
                            context.browser.storage.local.lastSetData = data;
                        },
                        lastSetData: null
                    }
                }
            },
            openDB: async (name, version) => ({ name, version }),
            clearStore: async (db, storeName) => true,
            console: {
                error: () => {},
                log: () => {}
            },
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
        assert.strictEqual(context.document.getElementById('ipReputationProvider').value, 'provider1');
        assert.strictEqual(context.document.getElementById('ipReputationApiKey').value, 'test-ip-key');
        assert.strictEqual(context.document.getElementById('alwaysManual').checked, true);
        assert.strictEqual(context.document.getElementById('autoScanLinks').checked, true);
        assert.strictEqual(context.document.getElementById('timeOfClickProtection').checked, false);
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
        context.document.getElementById('ipReputationProvider').value = 'none';
        context.document.getElementById('ipReputationApiKey').value = 'new-ip-key';
        context.document.getElementById('alwaysManual').checked = false;
        context.document.getElementById('autoScanLinks').checked = false;
        context.document.getElementById('timeOfClickProtection').checked = true;

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
        assert.strictEqual(savedData.ipReputationProvider, 'none');
        assert.strictEqual(savedData.ipReputationApiKey, 'new-ip-key');
        assert.strictEqual(savedData.alwaysManual, false);
        assert.strictEqual(savedData.autoScanLinks, false);
        assert.strictEqual(savedData.timeOfClickProtection, true);

        assert.strictEqual(saveBtn.disabled, false);
        assert.strictEqual(saveBtn.textContent, 'Speichern');

        // saveStatus block
        // It sets display to 'inline' then after timeout to 'none'.
        // Since we mock setTimeout to fire immediately, it will be 'none' again.
        assert.strictEqual(context.document.getElementById('saveStatus').style.display, 'none');
    });

    it('should handle save error', async () => {
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
        assert.strictEqual(statusSpan.style.display, 'inline');
    });

    it('should display info if cache is already empty or DB does not exist', async () => {
        context.clearStore = async () => false;

        context.document.getElementById('clearCache').click();
        await new Promise(resolve => setTimeout(resolve, 10));

        const statusSpan = context.document.getElementById('clearCacheStatus');
        assert.strictEqual(statusSpan.textContent, 'Datenbank existiert noch nicht oder ist bereits leer.');
        assert.strictEqual(statusSpan.className, 'text-success ml-2');
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
    });
});
