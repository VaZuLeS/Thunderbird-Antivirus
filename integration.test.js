/**
 * Integration test for the reported bug "scan results are not shown in the popup".
 *
 * It wires the background script and the popup script against one shared
 * in-memory IndexedDB implementation and asserts the full contract:
 *   message is displayed -> assessment is stored under the Message-ID header
 *   -> the popup reads that record and renders it.
 *
 * Unit tests mock the database on both sides; this test is what fails when the
 * two sides disagree about the storage key or the record shape.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { JSDOM, VirtualConsole } = require('jsdom');

const BACKGROUND_CODE = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
const GATEWAY_CODE = fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8');
const POPUP_CODE = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
const DB_CODE = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');

/** Minimal in-memory IndexedDB with the API surface used by the add-on. */
function createFakeIndexedDB() {
    const stores = new Map([['hybridanalysis', new Map()]]);

    function createRequest(executor) {
        const request = { onsuccess: null, onerror: null, result: undefined };
        setTimeout(() => {
            try {
                request.result = executor();
                if (typeof request.onsuccess === 'function') request.onsuccess({ target: request });
            } catch (error) {
                request.error = error;
                if (typeof request.onerror === 'function') request.onerror({ target: request });
            }
        }, 0);
        return request;
    }

    const db = {
        objectStoreNames: { contains: (name) => stores.has(name) },
        createObjectStore: (name) => { if (!stores.has(name)) stores.set(name, new Map()); },
        transaction: (names) => {
            const name = Array.isArray(names) ? names[0] : names;
            if (!stores.has(name)) throw new Error('unknown store: ' + name);
            const store = stores.get(name);
            return {
                objectStore: () => ({
                    get: (key) => createRequest(() => store.get(key) || undefined),
                    put: (item) => createRequest(() => { store.set(item.messageHeader, item); return item.messageHeader; })
                })
            };
        }
    };

    const indexedDB = {
        open: () => {
            const request = { onupgradeneeded: null, onsuccess: null, onerror: null, result: db };
            setTimeout(() => {
                if (typeof request.onupgradeneeded === 'function') request.onupgradeneeded({ target: request });
                if (typeof request.onsuccess === 'function') request.onsuccess({ target: request });
            }, 0);
            return request;
        }
    };

    return {
        indexedDB,
        records: stores.get('hybridanalysis'),
        getRecord: (key) => stores.get('hybridanalysis').get(key)
    };
}

/** Loads background.js with the mocks it needs, sharing one database. */
async function createBackgroundContext({ indexedDB, consent = true }) {
    const dom = new JSDOM();
    const context = {
        browser: {
            storage: {
                local: {
                    get: async (keys) => (Array.isArray(keys)
                        ? { externalAnalysisConsent: consent, scanningEnabledSenders: [], apikey: 'test-key' }
                        : { apikey: 'test-key', externalAnalysisConsent: consent }),
                    set: async () => {}
                },
                onChanged: { addListener: () => {}, listeners: [] }
            },
            messages: {
                get: async (id) => ({ id, headerMessageId: 'hdr-integration', author: 'Service <service@paypal-support.com>', subject: 'Action required' }),
                getFull: async () => ({
                    contentType: 'text/html',
                    body: '<a href="https://login.amaz0n.de/paypal">Konto prüfen</a><p>Bitte sofort bestätigen: Überweisung fällig</p>',
                    headers: { received: [], 'authentication-results': ['spf=fail'] }
                }),
                listAttachments: async () => [],
                query: async () => ({ messages: [] })
            },
            messageDisplay: {
                getDisplayedMessages: async () => ({ messages: [] }),
                onMessagesDisplayed: { addListener: () => {} },
                onMessageDisplayed: { addListener: () => {} }
            },
            permissions: { contains: async () => true, request: async () => true },
            runtime: {
                onMessage: { addListener: () => {} },
                onStartup: { addListener: () => {} },
                onInstalled: { addListener: () => {} },
                sendMessage: async () => undefined
            },
            scripting: { executeScript: async () => {}, messageDisplay: { registerScripts: async () => {}, getRegisteredScripts: async () => [] } },
            menus: { create: () => {}, onClicked: { addListener: () => {} } },
            notifications: { create: () => {} },
            downloads: { download: async () => {} },
            tabs: { create: async () => ({}) },
            i18n: { getMessage: () => '' }
        },
        indexedDB,
        crypto: globalThis.crypto,
        Math: globalThis.Math,
        Set: globalThis.Set,
        Map: globalThis.Map,
        URL: globalThis.URL,
        DOMParser: dom.window.DOMParser,
        TextDecoder: globalThis.TextDecoder,
        Blob: globalThis.Blob,
        File: globalThis.File,
        FormData: globalThis.FormData,
        ArrayBuffer: globalThis.ArrayBuffer,
        Uint8Array: globalThis.Uint8Array,
        AbortController: globalThis.AbortController,
        fetch: async () => ({ status: 200, json: async () => ({}) }),
        setTimeout,
        clearTimeout,
        setInterval: () => 0,
        clearInterval: () => {},
        console: { log: () => {}, error: () => {}, warn: () => {}, info: () => {} },
        JSON,
        Date,
        String,
        Array,
        Object,
        Error
    };

    if (!consent) {
        context.browser.storage.local.get = async (keys) => {
            if (Array.isArray(keys)) return { externalAnalysisConsent: false };
            return {};
        };
    }

    vm.createContext(context);
    vm.runInContext(DB_CODE, context);
    vm.runInContext(GATEWAY_CODE, context);
    vm.runInContext(BACKGROUND_CODE, context);
    // loadSettings() runs at script load and resolves the consent flag in a
    // microtask; give it a tick so mayTransmitExternally() sees the value.
    await new Promise((resolve) => setTimeout(resolve, 5));
    return context;
}

/** Loads the real popup markup plus api.js against the same database. */
function createPopupContext({ indexedDB, consent = true }) {
    const html = fs.readFileSync(path.join(__dirname, 'popup.html'), 'utf8');
    const dom = new JSDOM(html, { url: 'about:blank', virtualConsole: new VirtualConsole() });
    const fetchCalls = [];
    const context = {
        browser: {
            storage: { local: { get: async (keys) => (Array.isArray(keys) ? { externalAnalysisConsent: consent } : { apikey: 'test-key' }) } },
            messageDisplay: {
                getDisplayedMessages: async () => ({ messages: [{
                    id: 1,
                    headerMessageId: 'hdr-integration',
                    subject: 'Action required',
                    author: 'Service <service@paypal-support.com>',
                    date: '2026-09-30T10:00:00.000Z'
                }] })
            },
            tabs: { query: async () => ([{ id: 1 }]) },
            runtime: {
                sendMessage: async () => ({ status: 'success', success: true }),
                openOptionsPage: () => {}
            },
            permissions: { getAll: async () => ({ data_collection: ['personalCommunications'] }) },
            i18n: { getMessage: () => '' }
        },
        document: dom.window.document,
        indexedDB,
        fetch: async (url) => { fetchCalls.push(String(url)); return { status: 500, json: async () => ({}) }; },
        setTimeout,
        clearTimeout,
        URL,
        JSON,
        Date,
        String,
        Array,
        Object,
        Map,
        Set,
        TextEncoder,
        console: { log: () => {}, error: () => {}, warn: () => {} }
    };

    vm.createContext(context);
    let wrapped = POPUP_CODE.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
    wrapped = wrapped.replace(/\}\)\(\);/, '}');
    vm.runInContext(wrapped, context);
    return { context, dom, fetchCalls };
}


describe('integration: displayed message -> stored assessment -> popup', () => {
    let fake;

    before(() => {
        fake = createFakeIndexedDB();
    });

    it('stores the assessment of a displayed message and renders it in the popup', async () => {
        const background = await createBackgroundContext({ indexedDB: fake.indexedDB, consent: true });

        // The background evaluates the message that is displayed in the tab.
        await background.handleDisplayedMessage(
            { id: 42 },
            { id: 7, headerMessageId: 'hdr-integration', author: 'Service <service@paypal-support.com>', subject: 'Action required' }
        );
        // The database writes are promise based; give them a tick.
        await new Promise((resolve) => setTimeout(resolve, 30));

        const stored = fake.getRecord('hdr-integration');
        assert.ok(stored, 'the background must store the record under the headerMessageId');
        assert.ok(stored.localAssessment, 'the local assessment is part of the record');
        assert.ok(stored.localAssessment.score >= 50,
            'the crafted message scores high, got ' + stored.localAssessment.score);
        assert.ok(stored.localAssessment.reasons.length > 0, 'the reasons are stored');

        // The popup reads the very same record and shows the assessment.
        const popup = createPopupContext({ indexedDB: fake.indexedDB, consent: true });
        await popup.context.initAPI();
        await new Promise((resolve) => setTimeout(resolve, 30));

        const container = popup.dom.window.document.getElementById('hybrid_analysis_api_content');
        assert.ok(container.querySelector('#thundy-assessment'), 'the popup renders the assessment card');
        assert.ok(container.textContent.includes(String(stored.localAssessment.score)),
            'the popup shows the stored score');
        assert.ok(container.textContent.includes(stored.localAssessment.reasons[0]),
            'the popup shows the stored reason');
        assert.strictEqual(popup.dom.window.document.getElementById('MessageHeaderID').textContent, 'hdr-integration');
    });

    it('shows the stored assessment in the popup even without consent and without provider requests', async () => {
        const background = await createBackgroundContext({ indexedDB: fake.indexedDB, consent: true });
        await background.handleDisplayedMessage(
            { id: 42 },
            { id: 8, headerMessageId: 'hdr-integration-consent-off', author: 'Service <service@paypal-support.com>', subject: 'Action required' }
        );
        await new Promise((resolve) => setTimeout(resolve, 30));

        const popup = createPopupContext({ indexedDB: fake.indexedDB, consent: false });
        // The popup resolves the message by its own mock; point it at the stored record.
        popup.context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{
            id: 1,
            headerMessageId: 'hdr-integration-consent-off',
            subject: 'Action required',
            author: 'Service <service@paypal-support.com>'
        }] });

        await popup.context.initAPI();
        await new Promise((resolve) => setTimeout(resolve, 30));

        const container = popup.dom.window.document.getElementById('hybrid_analysis_api_content');
        assert.ok(container.querySelector('#thundy-assessment'), 'local data is visible without consent');
        assert.ok(container.querySelector('#thundy-consent-notice'), 'the consent notice is shown');
        assert.deepStrictEqual(popup.fetchCalls, [], 'no provider request without consent');
    });

    it('keeps the record retrievable after a scan triggered from the message banner', async () => {
        const background = await createBackgroundContext({ indexedDB: fake.indexedDB, consent: true });
        // Simulate the banner button: requestScan without a stored header in the request.
        const response = await background.handleRequestScan(
            { action: 'requestScan', messageId: 7, senderEmail: 'service@paypal-support.com', persist: false },
            { tab: { id: 42 } }
        );
        await new Promise((resolve) => setTimeout(resolve, 30));

        assert.strictEqual(response.success, true, 'the scan runs');
        const stored = fake.getRecord('hdr-integration');
        assert.ok(stored && stored.localAssessment,
            'a banner scan stores its result under the headerMessageId the popup reads');
    });
});

