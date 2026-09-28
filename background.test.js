const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

describe('background.js', () => {
    let context;

    beforeEach(() => {
        // Create mock environment
        const dom = new JSDOM();
        context = {
            browser: {
                storage: {
                    local: {
                        get: async () => ({ apikey: 'test-api-key', virustotalApikey: 'test-vt-key' })
                    },
                    onChanged: {
                        addListener: (listener) => {
                            context.browser.storage.onChanged.listeners.push(listener);
                        },
                        listeners: []
                    }
                },
                messages: {
                    getFull: async () => ({}),
                    listAttachments: async () => ([]),
                    getAttachmentFile: async () => ({
                        slice: () => ({
                            arrayBuffer: async () => new ArrayBuffer(8)
                        }),
                        type: 'application/octet-stream'
                    })
                },
                messageDisplay: {
                    getDisplayedMessages: async () => ({ messages: [{ headerMessageId: 'test-msg-id' }] }),
                    getDisplayedMessage: async () => ({ headerMessageId: 'test-msg-id' }),
                    onMessagesDisplayed: {
                        addListener: (listener) => {
                            context.browser.messageDisplay.onMessagesDisplayed.listeners.push(listener);
                        },
                        listeners: []
                    },
                    onMessageDisplayed: {
                        addListener: (listener) => {
                            context.browser.messageDisplay.onMessageDisplayed.listeners.push(listener);
                        },
                        listeners: []
                    }
                },
                permissions: {
                    contains: async () => true,
                    request: async () => true
                },
                alarms: {
                    create: async (name, info) => { context.alarmCalls.push({ name, info }); },
                    clear: async (name) => { context.alarmCleared.push(name); return true; },
                    onAlarm: {
                        addListener: (listener) => { context.alarmListeners.push(listener); }
                    }
                },
                runtime: {
                    onMessage: {
                        addListener: (listener) => {
                            context.browser.runtime.onMessage.listeners.push(listener);
                        },
                        listeners: []
                    }
                },
                scripting: {
                    executeScript: async () => {}
                },
                menus: {
                    create: () => {},
                    onClicked: {
                        addListener: () => {}
                    }
                },
                notifications: {
                    create: (options) => { context.notifications.push(options); }
                },
                downloads: {
                    download: async () => {}
                }
            },
            crypto: globalThis.crypto,
            Math: globalThis.Math,
            Set: globalThis.Set,
            URL: globalThis.URL,
            DOMParser: dom.window.DOMParser,
            TextDecoder: globalThis.TextDecoder,
            Blob: globalThis.Blob,
            indexedDB: {
                open: () => ({
                    onupgradeneeded: null,
                    onsuccess: null,
                    onerror: null,
                    result: {
                        objectStoreNames: { contains: () => false },
                        createObjectStore: () => {},
                        transaction: () => ({
                            objectStore: () => ({
                                get: () => ({ onsuccess: null }),
                                put: () => ({ onsuccess: null, onerror: null })
                            })
                        })
                    }
                })
            },
            alarmCalls: [],
            alarmCleared: [],
            alarmListeners: [],
            notifications: [],
            console: { log: () => {}, error: () => {}, warn: () => {}, info: () => {} },
            fetch: async () => ({ status: 200, json: async () => ({}) }),
            AbortController: globalThis.AbortController,
            clearTimeout: globalThis.clearTimeout,
            FormData: class FormData { append() {} },
            File: class File { constructor(bits, name, options) { this.bits = bits; this.name = name; this.options = options; } },
            ArrayBuffer: globalThis.ArrayBuffer,
            Uint8Array: globalThis.Uint8Array,
            Array: globalThis.Array,
            Date: globalThis.Date,
            JSON: globalThis.JSON,
            String: globalThis.String,
            Error: globalThis.Error,
            setTimeout: setTimeout
        };

        // Managed Storage (Enterprise-Policy): standardmaessig ohne Vorgaben
        context.browser.storage.managed = { get: async () => ({}) };

        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
        const gatewayCode = fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8');
        const wrappedCode = `
            globalThis.customBlacklist = new Set();
            globalThis.customWhitelist = new Set();
            globalThis.knownSendersCache = new Set();
            globalThis.MAX_KNOWN_SENDERS = 1000;
            ${gatewayCode}
            ${code}
            globalThis.loadSettings = loadSettings;
            globalThis.set_externalAnalysisConsent = (val) => { externalAnalysisConsent = val === true; };
            globalThis.get_externalAnalysisConsent = () => externalAnalysisConsent;
            globalThis.set_customBlacklist = (list) => { customBlacklist = new Set(Array.from(list).map(s => s ? s.toLowerCase() : "")); };
            globalThis.set_customWhitelist = (list) => { customWhitelist = new Set(Array.from(list).map(s => s ? s.toLowerCase() : "")); };
            globalThis.get_apikey = () => apikey_hybridanalysis;
            globalThis.set_apikey = (val) => { apikey_hybridanalysis = val; };
            globalThis.set_vt_apikey = (val) => { apikey_virustotal = val; };
            globalThis.getSharedDB = getSharedDB;
            globalThis.reset_sharedDBPromise = () => { sharedDBPromise = null; };
            globalThis.tab_mail_open_display = tab_mail_open_display;
            globalThis.sent_to_hybrid_by_attachment = sent_to_hybrid_by_attachment;
            globalThis.injectTimeOfClickProtection = injectTimeOfClickProtection;
            globalThis.set_timeOfClickProtection = (val) => { timeOfClickProtection = val; };
            globalThis.set_privacyTier = (val) => { privacyTier = val; };
            globalThis.get_sha256_hash = get_sha256_hash;
            globalThis.indexedDB_save_batch_hybrid_data_to_db = indexedDB_save_batch_hybrid_data_to_db;
            globalThis.handleManualUpload = handleManualUpload;
            globalThis.extractEmailAddress = extractEmailAddress;
            globalThis.extractEmailDomain = extractEmailDomain;
            globalThis.extractUrls = extractUrls;
            globalThis.filterUrls = filterUrls;
            globalThis.extractTextFromParts = extractTextFromParts;
            globalThis.indexedDB_save_links_to_db = indexedDB_save_links_to_db;
            globalThis.indexedDB_save_links_objects_to_db = indexedDB_save_links_objects_to_db;
            globalThis.handleUrlScan = handleUrlScan;
            globalThis.checkVirusTotal = checkVirusTotal;
            globalThis.calculateThreatScore = calculateThreatScore;
            globalThis.evaluateReplyTo = evaluateReplyTo;
            globalThis.levenshteinDistance = levenshteinDistance;
            globalThis.evaluateLinks = evaluateLinks;
            globalThis.evaluateSenderDomain = evaluateSenderDomain;
            globalThis.evaluateBehavior = evaluateBehavior;
            globalThis.extractPublicIPs = extractPublicIPs;
            globalThis.getMainDomain = getMainDomain;
            globalThis.processAndUploadUrls = processAndUploadUrls;
            globalThis.checkFirstCommunication = checkFirstCommunication;
            globalThis.checkURLhausDomains = checkURLhausDomains;
            globalThis.checkURLhaus = checkURLhaus;
            globalThis.evaluateUrlhaus = evaluateUrlhaus;
            globalThis.knownSendersCache = knownSendersCache;
            globalThis.getHybridAnalysisOptions = getHybridAnalysisOptions;
            globalThis.set_apikey_hybridanalysis = (val) => { apikey_hybridanalysis = val; };
            globalThis.urlhausCache = urlhausCache;
            globalThis.MAX_URLHAUS_CACHE_SIZE = MAX_URLHAUS_CACHE_SIZE;
            globalThis.checkLists = checkLists;
            globalThis.handle_unknown_attachment = handle_unknown_attachment;
            globalThis.extractBecProtectionData = extractBecProtectionData;
            globalThis.collectThreatEvaluationOptions = collectThreatEvaluationOptions;
            globalThis.addSenderOptIn = addSenderOptIn;
            globalThis.evaluateAndInjectThreats = evaluateAndInjectThreats;

            // CheckIPReputation exposed variables
            globalThis.checkIPReputation = checkIPReputation;
            globalThis.checkAbuseIPDB = checkAbuseIPDB;
            globalThis.checkVirusTotalIP = checkVirusTotalIP;
            globalThis.ipReputationCache = ipReputationCache;
            globalThis.MAX_IP_CACHE = MAX_IP_CACHE;
            globalThis.set_ipReputationProvider = (val) => { ipReputationProvider = val; };
            globalThis.set_ipReputationApiKey = (val) => { ipReputationApiKey = val; };
            globalThis.set_urlscanApikey = (val) => { urlscanApikey = val; };
            globalThis.set_apikey_hybridanalysis = (val) => { apikey_hybridanalysis = val; };
            globalThis.getFirstDisplayedMessage = getFirstDisplayedMessage;
            globalThis.displayStates = displayStates;
            globalThis.updateDisplayState = updateDisplayState;
            globalThis.registerMessageDisplayScript = registerMessageDisplayScript;
            globalThis.ensureMessageDisplayScript = ensureMessageDisplayScript;
            globalThis.messageListToArray = messageListToArray;
            globalThis.handleRequestScan = handleRequestScan;
            globalThis.injectIntoMessageDisplay = injectIntoMessageDisplay;
            globalThis.mayTransmitExternally = mayTransmitExternally;
            globalThis.hasHostPermissionFor = hasHostPermissionFor;
            globalThis.assertExternalAnalysisAllowed = assertExternalAnalysisAllowed;
            globalThis.originForUrl = originForUrl;
            globalThis.PROVIDER_ORIGINS = PROVIDER_ORIGINS;
            globalThis.handleDisplayedMessage = handleDisplayedMessage;
            globalThis.listMessageAttachments = listMessageAttachments;
            globalThis.getPendingScans = getPendingScans;
            globalThis.recordScanHistory = recordScanHistory;
            globalThis.clearScanHistory = clearScanHistory;
            globalThis.filterScanHistory = filterScanHistory;
            globalThis.summarizeHistory = summarizeHistory;
            globalThis.getScanHistory = getScanHistory;
            globalThis.HISTORY_KEY = HISTORY_KEY;
            globalThis.loadManagedSettings = loadManagedSettings;
            globalThis.applyManagedSettings = applyManagedSettings;
            globalThis.hasManagedPolicy = hasManagedPolicy;
            globalThis.getEffectiveSettings = getEffectiveSettings;
            globalThis.collectDiagnostics = collectDiagnostics;
            globalThis.computeHistoryStatistics = computeHistoryStatistics;
            globalThis.buildMessageReport = buildMessageReport;
            globalThis.get_privacyTier = () => privacyTier;
            globalThis.set_privacyTier = (value) => { privacyTier = value; };
            globalThis.get_externalAnalysisConsent = () => externalAnalysisConsent;
            globalThis.get_managed_keys = () => Object.keys(managedSettings);
            globalThis.get_customBlacklist = () => customBlacklist;
            globalThis.get_history_enabled = () => historyEnabled;
            globalThis.get_history_limit = () => historyLimit;
            globalThis.get_view_mode = () => viewMode;
            globalThis.set_view_mode = (value) => { viewMode = value; };
            globalThis.set_history_enabled = (value) => { historyEnabled = value === true; };
            globalThis.set_history_limit = (value) => { historyLimit = value; };
            globalThis.upsertPendingScan = upsertPendingScan;
            globalThis.pollPendingScans = pollPendingScans;
            globalThis.describeScanJob = describeScanJob;
            globalThis.scheduleScanPolling = scheduleScanPolling;
            globalThis.storeJobResult = storeJobResult;
            globalThis.PENDING_SCANS_KEY = PENDING_SCANS_KEY;
            globalThis.SCAN_ALARM_NAME = SCAN_ALARM_NAME;
            globalThis.SCAN_MAX_ATTEMPTS = SCAN_MAX_ATTEMPTS;
            globalThis.computeAttachmentHash = computeAttachmentHash;
            globalThis.SCORE_WEIGHTS = SCORE_WEIGHTS;
            globalThis.notify = notify;
            globalThis.scanLinksOfDisplayedMessage = scanLinksOfDisplayedMessage;
            globalThis.msg = msg;
            globalThis.get_privacyTier = () => privacyTier;
        `;
        context.URL = URL;
        context.URL.createObjectURL = () => 'blob:test';
        context.URLSearchParams = URLSearchParams;
        vm.runInContext(wrappedCode, context);

        // Default für Tests: Zustimmung zur externen Analyse erteilt.
        // Tests, die das Fehlen der Zustimmung prüfen, setzen sie explizit auf false.
        context.set_externalAnalysisConsent(true);

        if (context.knownSendersCache) context.knownSendersCache.clear();
        if (context.urlhausCache) context.urlhausCache.clear();
        if (context.ipReputationCache) context.ipReputationCache.clear();
        if (context.displayStates) context.displayStates.clear();
    });

    it('should initialize successfully', () => {
        assert.ok(context.get_apikey() === undefined || context.get_apikey() === 'test-api-key');
    });




    it('loadSettings catches and logs storage errors', async () => {
        const originalConsoleError = context.console.error;
        let loggedError = null;
        context.console.error = (msg, err) => { loggedError = { msg, err }; };
        const originalGet = context.browser.storage.local.get;
        const fakeError = new Error('Storage error');
        context.browser.storage.local.get = async () => { throw fakeError; };

        await context.loadSettings();

        assert.ok(loggedError, 'Expected console.error to be called');
        assert.strictEqual(loggedError.msg, 'Fehler beim Laden der Einstellungen:');
        assert.strictEqual(loggedError.err, fakeError);

        context.console.error = originalConsoleError;
        context.browser.storage.local.get = originalGet;
    });

    it('loadSettings retrieves API key from storage', async () => {
        context.set_apikey(undefined);
        await context.loadSettings();
        assert.strictEqual(context.get_apikey(), 'test-api-key');
    });

    it('storage.onChanged updates API key dynamically', () => {
        context.set_apikey(undefined);
        const listener = context.browser.storage.onChanged.listeners[0];
        assert.ok(listener);

        listener({ apikey: { newValue: 'new-dynamic-key' } }, 'local');
        assert.strictEqual(context.get_apikey(), 'new-dynamic-key');
    });

    it('storage.onChanged ignores updates from other areas or keys', async () => {
        context.set_apikey(undefined);
        await context.loadSettings();
        const listener = context.browser.storage.onChanged.listeners[0];

        listener({ apikey: { newValue: 'ignored-key' } }, 'sync');
        assert.strictEqual(context.get_apikey(), 'test-api-key');

        listener({ otherKey: { newValue: 'ignored-key' } }, 'local');
        assert.strictEqual(context.get_apikey(), 'test-api-key');
    });

    it('get_sha256_hash computes correct hash', async () => {
        const buffer = new TextEncoder().encode('test data').buffer;
        const hash = await context.get_sha256_hash(buffer);
        assert.strictEqual(hash, '916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9');
    });

    it('get_sha256_hash throws error if crypto.subtle.digest fails', async () => {
        const buffer = new TextEncoder().encode('test data').buffer;
        const originalDigest = context.crypto.subtle.digest;
        context.crypto.subtle.digest = async () => {
            throw new Error('Crypto API Error');
        };

        try {
            await assert.rejects(
                async () => {
                    await context.get_sha256_hash(buffer);
                },
                { message: 'Crypto API Error' }
            );
        } finally {
            context.crypto.subtle.digest = originalDigest;
        }
    });

    it('tab_mail_open_display processes attachments correctly', async () => {
        let sentAttachments = [];
        // Mock sent_to_hybrid_by_attachment to verify it's called
        const originalFunc = context.sent_to_hybrid_by_attachment;
        context.sent_to_hybrid_by_attachment = async (msg, atts) => {
            sentAttachments = atts;
        };

        context.browser.messages.listAttachments = async () => ([{ name: 'test.exe' }]);

        await context.tab_mail_open_display({ id: 1 }, { id: 1, author: 'test', subject: 'test' });

        assert.strictEqual(sentAttachments.length, 1);
        assert.strictEqual(sentAttachments[0].name, 'test.exe');

        // Restore
        context.sent_to_hybrid_by_attachment = originalFunc;
    });

    it('tab_mail_open_display ignores when no attachments', async () => {
        let sentAttachments = null;
        const originalFunc = context.sent_to_hybrid_by_attachment;
        context.sent_to_hybrid_by_attachment = async (msg, atts) => {
            sentAttachments = atts;
        };

        context.browser.messages.listAttachments = async () => ([]);
        context.browser.messages.getFull = async () => ({ contentType: 'text/plain', body: 'No links here' });

        await context.tab_mail_open_display({ id: 1 }, { id: 1, author: 'test', subject: 'test' });

        assert.strictEqual(sentAttachments, null);

        // Restore
        context.sent_to_hybrid_by_attachment = originalFunc;
    });

    it('extractUrls correctly extracts links', () => {
        const text = "Check out https://test.com/ and http://example.org/path?q=1.";
        const urls = context.extractUrls(text);
        assert.deepEqual(urls, ['https://test.com/', 'http://example.org/path?q=1']);
    });

    it('extractUrls filters duplicate URLs', () => {
        const text = "Check out https://test.com/ and https://test.com/ again.";
        const urls = context.extractUrls(text);
        assert.deepEqual(urls, ['https://test.com/']);
    });

    it('extractUrls handles URLs with various trailing punctuation', () => {
        const text = "See https://test.com/!, https://test.com/?, (https://test.com/), [https://test.com/]; and https://test.com/:";
        const urls = context.extractUrls(text);
        // The regex replaces trailing characters `[.,;:!)\]]` but DOES NOT remove `?`.
        // 'https://test.com/?,' -> 'https://test.com/?'

        // Assert length and elements instead of exact order / deep equality,
        // because we want the test to FAIL if the punctuation IS NOT stripped,
        // rather than accidentally passing if both the stripped and unstripped versions are sorted the same.
        // If trailing punctuation is NOT removed, urls will have 5 unique items:
        // ['https://test.com/!,', 'https://test.com/?,', 'https://test.com/),', 'https://test.com/];', 'https://test.com/:']
        assert.strictEqual(urls.length, 2);
        assert.ok(urls.find(u => u === 'https://test.com/'));
        assert.ok(urls.find(u => u === 'https://test.com/?'));
    });

    it('extractUrls returns empty array for text with no URLs', () => {
        const text = "This is a simple text without any URLs.";
        const urls = context.extractUrls(text);
        assert.deepEqual(urls, []);
    });

    it('extractUrls returns empty array for empty string', () => {
        const text = "";
        const urls = context.extractUrls(text);
        assert.deepEqual(urls, []);
    });

    it('filterUrls correctly ignores safe domains', () => {
        const urls = ['https://google.com/', 'http://malicious.com', 'https://github.com/repo', 'https://unknown.org'];
        const filtered = context.filterUrls(urls);
        assert.deepStrictEqual(filtered, ['http://malicious.com', 'https://unknown.org']);
    });

    it('filterUrls correctly ignores subdomains of safe domains', () => {
        const urls = ['https://mail.google.com/', 'https://sub.github.com/repo', 'https://not-safe.google.com.malicious.net/'];
        const filtered = context.filterUrls(urls);
        assert.deepStrictEqual(filtered, ['https://not-safe.google.com.malicious.net/']);
    });

    it('filterUrls removes invalid URLs', () => {
        const urls = ['not_a_url', 'https://good-domain.com/', 'http://'];
        const filtered = context.filterUrls(urls);
        assert.deepStrictEqual(filtered, ['https://good-domain.com/']);
    });

    it('filterUrls triggers exception block for malformed URLs', () => {
        const urls = ['::::', 'http://[::1', 'https://:80', 'https://good.com/'];
        const filtered = context.filterUrls(urls);
        assert.deepStrictEqual(filtered, ['https://good.com/']);
    });

    it('filterUrls handles empty array', () => {
        const filtered = context.filterUrls([]);
        assert.deepStrictEqual(filtered, []);
    });

    it('handleUrlScan successfully uploads and updates DB', async () => {
        context.set_apikey('test-key');

        let fetchCalledWith = null;
        context.fetch = async (url, options) => {
            fetchCalledWith = options;
            return {
                status: 200,
                json: async () => ({ submission_id: 'sub-url', job_id: 'job-url', sha256: 'hash-url' })
            };
        };

        let dbUpdated = false;
        context.indexedDB.open = () => ({
            onsuccess: function() {
                this.result = {
                    transaction: () => ({
                        objectStore: () => ({
                            get: () => ({
                                onsuccess: function() {
                                    this.result = {
                                        links: [{ url: 'http://scanme.com', state: 'UNKNOWN' }]
                                    };
                                    this.onsuccess();
                                }
                            }),
                            put: (data) => {
                                if (data.links[0].state === 'UPLOADED' && data.links[0].hybrid_sha256 === 'hash-url') dbUpdated = true;
                                const req = {};
                                setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 0);
                                return req;
                            }
                        })
                    })
                };
                setTimeout(() => { if (this.onsuccess) this.onsuccess({ target: { result: this.result } }); }, 0);
            }
        });

        const res = await context.handleUrlScan('http://scanme.com', 'header123');

        assert.ok(fetchCalledWith);
        assert.strictEqual(fetchCalledWith.method, 'POST');
        assert.strictEqual(res.submission_id, 'sub-url');
        // Let's just mock updateStore directly on context, since openDB mock is tricky for updateStore
        assert.ok(fetchCalledWith);
        assert.strictEqual(fetchCalledWith.method, 'POST');
    });

    it('sent_to_hybrid_by_attachment skips ignored content types', async () => {
        context.set_apikey('test-key');
        let dbSaved = false;
        context.indexedDB_save_batch_hybrid_data_to_db = () => { dbSaved = true; };

        const attachments = [
            { name: 'test.txt', contentType: 'text/plain', size: 100, partName: '1' },
            { name: 'test.html', contentType: 'text/html', size: 100, partName: '2' },
            { name: 'test.js', contentType: 'text/javascript', size: 100, partName: '3' },
            { name: 'test.json', contentType: 'application/json', size: 100, partName: '4' }
        ];

        await context.sent_to_hybrid_by_attachment({ id: 1 }, attachments);
        assert.strictEqual(dbSaved, false); // shouldn't save anything because they are ignored
    });

    it('sent_to_hybrid_by_attachment processes valid attachments (known file)', async () => {
        context.set_apikey('test-key');
        context.set_vt_apikey('test-vt-key');
        context.set_privacyTier('balanced');

        let savedResults = null;
        context.indexedDB_save_batch_hybrid_data_to_db = (msg, results) => {
            savedResults = results;
        };

        // Mock fetch to return 200 OK (known file) and handle virustotal mock
        context.fetch = async (url) => {
            let isVirusTotalHost = false;
            if (url) {
                try {
                    const parsedUrl = new URL(url);
                    isVirusTotalHost =
                        parsedUrl.hostname === 'virustotal.com' ||
                        parsedUrl.hostname.endsWith('.virustotal.com');
                } catch (_) {
                    isVirusTotalHost = false;
                }
            }

            if (isVirusTotalHost) {
                return {
                    status: 200,
                    json: async () => ({
                        data: { attributes: { last_analysis_stats: { malicious: 2, undetected: 68 } } }
                    })
                };
            }
            return {
                status: 200,
                json: async () => ({ submission_id: 'sub123', job_id: 'job123' })
            };
        };

        const attachments = [
            { name: 'test.exe', contentType: 'application/x-msdownload', size: 100, partName: '1' }
        ];

        await context.sent_to_hybrid_by_attachment({ id: 1 }, attachments);

        assert.ok(savedResults);
        assert.strictEqual(savedResults.length, 1);
        assert.strictEqual(savedResults[0].hybrid_data.state, 'KNOWN');
        assert.strictEqual(savedResults[0].hybrid_data.submission_id, 'sub123');
        assert.strictEqual(savedResults[0].hybrid_data.job_id, 'job123');
        assert.strictEqual(savedResults[0].attachmentName, 'test.exe');
        assert.deepStrictEqual(savedResults[0].virustotal_stats, { malicious: 2, undetected: 68 });
    });

    it('sent_to_hybrid_by_attachment processes valid attachments (unknown file)', async () => {
        context.set_apikey('test-key');
        context.set_vt_apikey('test-vt-key');
        context.set_privacyTier('balanced');

        let savedResults = null;
        context.indexedDB_save_batch_hybrid_data_to_db = (msg, results) => {
            savedResults = results;
        };

        // Mock fetch to return 404 (unknown file)
        context.fetch = async () => ({
            status: 404,
            json: async () => ({})
        });

        const attachments = [
            { name: 'unknown.exe', contentType: 'application/x-msdownload', size: 100, partName: '1' }
        ];

        await context.sent_to_hybrid_by_attachment({ id: 1 }, attachments);

        assert.ok(savedResults);
        assert.strictEqual(savedResults.length, 1);
        assert.strictEqual(savedResults[0].hybrid_data.state, 'UNKNOWN');
        assert.strictEqual(savedResults[0].hybrid_data.submission_id, 'PENDING_UPLOAD');
        assert.strictEqual(savedResults[0].hybrid_data.job_id, 'PENDING_UPLOAD');
        assert.strictEqual(savedResults[0].attachmentName, 'unknown.exe');
    });

    it('handleManualUpload successfully uploads and updates DB', async () => {
        context.set_apikey('test-key');

        let fetchCalledWith = null;
        context.fetch = async (url, options) => {
            fetchCalledWith = options;
            return {
                status: 200,
                json: async () => ({ submission_id: 'sub-upload', job_id: 'job-upload' })
            };
        };

        let dbUpdated = false;
        context.indexedDB.open = () => ({
            onsuccess: function() {
                this.result = {
                    transaction: () => ({
                        objectStore: () => ({
                            get: () => ({
                                onsuccess: function() {
                                    this.result = {
                                        attachments: [{ partName: 'part1', state: 'UNKNOWN' }]
                                    };
                                    this.onsuccess();
                                }
                            }),
                            put: (data) => {
                                if (data.attachments[0].state === 'UPLOADED') dbUpdated = true;
                            }
                        })
                    })
                };
                this.onsuccess({ target: { result: this.result } });
            }
        });

        const res = await context.handleManualUpload(1, 'part1', 'file.exe', 'hash123', 'header123');

        assert.ok(fetchCalledWith);
        assert.strictEqual(fetchCalledWith.method, 'POST');
        assert.strictEqual(res.submission_id, 'sub-upload');
    });

    it('handleManualUpload throws error on failed upload', async () => {
        context.set_apikey('test-key');

        context.fetch = async () => ({
            status: 500,
            json: async () => ({ error: 'Internal Error' })
        });

        await assert.rejects(
            async () => {
                await context.handleManualUpload(1, 'part1', 'file.exe', 'hash123', 'header123');
            },
            (err) => {
                assert.strictEqual(err.message, 'Fehler beim Upload: {"error":"Internal Error"}');
                return true;
            }
        );
    });

    it('runtime.onMessage listener processes uploadAttachment action', async () => {
        const listener = context.browser.runtime.onMessage.listeners[0];
        assert.ok(listener);

        let sentResponse = null;

        // Mock handleManualUpload for the listener
        context.handleManualUpload = async () => ({ success: true });

        listener(
            { action: "uploadAttachment", messageId: 1, partName: '1', attachmentName: 'test', hash: 'hash', headerMessageId: 'header' },
            {},
            (res) => { sentResponse = res; }
        );

        // Wait a tick for the promise to resolve
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.ok(sentResponse);
        assert.strictEqual(sentResponse.status, 'success');
    });

    it('runtime.onMessage requestScan reports a missing host permission without asking for it', async () => {
        let requested = false;
        context.browser.permissions = {
            contains: async () => false,
            request: async () => { requested = true; return true; }
        };

        const response = await context.handleRequestScan(
            { action: 'requestScan', messageId: 42, senderEmail: 'user@example.com' },
            { tab: { id: 1 } }
        );

        assert.strictEqual(response.error, 'permission_required');
        assert.strictEqual(response.code, 'PERMISSION_REQUIRED');
        assert.strictEqual(requested, false, 'permissions.request() must happen in the options page');
    });

    it('runtime.onMessage requestScan returns EXTERNAL_ANALYSIS_DISABLED without consent', async () => {
        context.set_externalAnalysisConsent(false);

        const response = await context.handleRequestScan(
            { action: 'requestScan', messageId: 42, senderEmail: 'user@example.com', persist: true },
            { tab: { id: 1 } }
        );
        assert.strictEqual(response.error, 'EXTERNAL_ANALYSIS_DISABLED');
        assert.strictEqual(response.code, 'EXTERNAL_ANALYSIS_DISABLED');
    });

    it('runtime.onMessage requestScan asks for permission and runs scan when granted', async () => {
        context.browser.permissions = {
            contains: async () => true,
            request: async () => true
        };

        // Mock storage.get/set for scanningEnabledSenders
        let stored = {};
        context.browser.storage.local.get = async (keys) => {
            if (Array.isArray(keys)) {
                const out = {};
                keys.forEach(k => { out[k] = stored[k]; });
                return out;
            }
            // When requested with a single key, browser.storage.local.get returns an object
            return { [keys]: stored[keys] };
        };
        context.browser.storage.local.set = async (obj) => { Object.assign(stored, obj); };

        // Replace heavy functions with no-ops to observe they are called
        let processed = false;
        context.processAttachments = async (msg) => { processed = true; };
        context.processLinks = async (tab, message, fullMessage) => ({ messageText: '', urls: [], filteredUrls: [] });
        context.evaluateAndInjectThreats = async () => { processed = true; };

        // persist: true -> dauerhaftes Opt-in für den Absender
        const response = await context.handleRequestScan(
            { action: 'requestScan', messageId: 101, senderEmail: 'user@example.com', tabId: 1, persist: true },
            { tab: { id: 1 } }
        );

        assert.strictEqual(response.success, true);
        assert.strictEqual(response.persisted, true);
        assert.ok(processed);
        assert.ok(stored.scanningEnabledSenders && stored.scanningEnabledSenders.includes('user@example.com'));
    });

    it('runtime.onMessage requestScan without persist does not create a permanent opt-in', async () => {
        context.browser.permissions = {
            contains: async () => true,
            request: async () => true
        };

        let stored = {};
        context.browser.storage.local.get = async (keys) => {
            if (Array.isArray(keys)) {
                const out = {};
                keys.forEach(k => { out[k] = stored[k]; });
                return out;
            }
            return { [keys]: stored[keys] };
        };
        context.browser.storage.local.set = async (obj) => { Object.assign(stored, obj); };

        context.processAttachments = async () => {};
        context.processLinks = async () => ({ messageText: '', urls: [], filteredUrls: [] });
        context.evaluateAndInjectThreats = async () => {};

        const response = await context.handleRequestScan(
            { action: 'requestScan', messageId: 102, senderEmail: 'once@example.com', persist: false },
            { tab: { id: 1 } }
        );

        assert.strictEqual(response.success, true);
        assert.strictEqual(response.persisted, false);
        assert.strictEqual(stored.scanningEnabledSenders, undefined);
    });


    describe('checkVirusTotalIP', () => {
        it('returns true if malicious > 0', async () => {
            const originalFetch = context.fetch;
            try {
                context.fetch = async () => ({
                    json: async () => ({
                        data: {
                            attributes: {
                                last_analysis_stats: {
                                    malicious: 1
                                }
                            }
                        }
                    })
                });
                const result = await context.checkVirusTotalIP('1.2.3.4', 'dummykey');
                assert.strictEqual(result, true);
            } finally {
                context.fetch = originalFetch;
            }
        });

        it('returns false if malicious === 0', async () => {
            const originalFetch = context.fetch;
            try {
                context.fetch = async () => ({
                    json: async () => ({
                        data: {
                            attributes: {
                                last_analysis_stats: {
                                    malicious: 0
                                }
                            }
                        }
                    })
                });
                const result = await context.checkVirusTotalIP('1.2.3.4', 'dummykey');
                assert.strictEqual(result, false);
            } finally {
                context.fetch = originalFetch;
            }
        });

        it('returns false if data is missing', async () => {
            const originalFetch = context.fetch;
            try {
                context.fetch = async () => ({
                    json: async () => ({})
                });
                const result = await context.checkVirusTotalIP('1.2.3.4', 'dummykey');
                assert.strictEqual(result, false);
            } finally {
                context.fetch = originalFetch;
            }
        });

        it('returns false and logs error on fetch failure', async () => {
            const originalFetch = context.fetch;
            const originalConsoleError = context.console.error;
            let errorLogged = false;
            try {
                context.fetch = async () => {
                    throw new Error("Network failure");
                };
                context.console.error = (msg, e) => {
                    if (msg.includes("Fehler bei VirusTotal IP Abfrage")) {
                        errorLogged = true;
                    }
                };
                const result = await context.checkVirusTotalIP('1.2.3.4', 'dummykey');
                assert.strictEqual(result, false);
                assert.strictEqual(errorLogged, true);
            } finally {
                context.fetch = originalFetch;
                context.console.error = originalConsoleError;
            }
        });
    });

    describe('checkAbuseIPDB', () => {
        it('returns true if abuse confidence score is > 50', async () => {
            const originalFetch = context.fetch;
            try {
                context.fetch = async () => ({
                    json: async () => ({
                        data: {
                            abuseConfidenceScore: 51
                        }
                    })
                });
                const result = await context.checkAbuseIPDB('1.2.3.4', 'dummykey');
                assert.strictEqual(result, true);
            } finally {
                context.fetch = originalFetch;
            }
        });

        it('returns false if abuse confidence score is <= 50', async () => {
            const originalFetch = context.fetch;
            try {
                context.fetch = async () => ({
                    json: async () => ({
                        data: {
                            abuseConfidenceScore: 50
                        }
                    })
                });
                const result = await context.checkAbuseIPDB('1.2.3.4', 'dummykey');
                assert.strictEqual(result, false);
            } finally {
                context.fetch = originalFetch;
            }
        });

        it('returns false and handles error gracefully on fetch network failure', async () => {
            const originalFetch = context.fetch;
            const originalConsoleError = context.console.error;
            let errorLogged = false;
            try {
                context.fetch = async () => {
                    throw new Error("Network failure");
                };
                context.console.error = (msg, e) => {
                    if (msg.includes("Fehler bei AbuseIPDB Abfrage")) {
                        errorLogged = true;
                    }
                };
                const result = await context.checkAbuseIPDB('1.2.3.4', 'dummykey');
                assert.strictEqual(result, false);
                assert.strictEqual(errorLogged, true);
            } finally {
                context.fetch = originalFetch;
                context.console.error = originalConsoleError;
            }
        });

        it('returns false and handles error gracefully on fetch json parse failure', async () => {
            const originalFetch = context.fetch;
            const originalConsoleError = context.console.error;
            let errorLogged = false;
            try {
                context.fetch = async () => ({
                    json: async () => {
                        throw new Error("Invalid JSON");
                    }
                });
                context.console.error = (msg, e) => {
                    if (msg.includes("Fehler bei AbuseIPDB Abfrage")) {
                        errorLogged = true;
                    }
                };
                const result = await context.checkAbuseIPDB('1.2.3.4', 'dummykey');
                assert.strictEqual(result, false);
                assert.strictEqual(errorLogged, true);
            } finally {
                context.fetch = originalFetch;
                context.console.error = originalConsoleError;
            }
        });
    });

    describe('checkVirusTotal', () => {
        it('returns null if apikey is not provided', async () => {
            const result = await context.checkVirusTotal('dummyhash', null);
            assert.strictEqual(result, null);
        });

        it('returns last_analysis_stats on successful response with status 200', async () => {
            const originalFetch = context.fetch;
            try {
                context.fetch = async (url, options) => {
                    assert.strictEqual(url, 'https://www.virustotal.com/api/v3/files/dummyhash');
                    assert.strictEqual(options.method, 'GET');
                    assert.strictEqual(options.headers['x-apikey'], 'dummyapikey');
                    assert.strictEqual(options.headers['accept'], 'application/json');

                    return {
                        status: 200,
                        json: async () => ({
                            data: {
                                attributes: {
                                    last_analysis_stats: { malicious: 5, undetected: 60 }
                                }
                            }
                        })
                    };
                };

                const result = await context.checkVirusTotal('dummyhash', 'dummyapikey');
                assert.deepStrictEqual(result, { malicious: 5, undetected: 60 });
            } finally {
                context.fetch = originalFetch;
            }
        });

        it('returns null on response with status 200 but missing JSON structure', async () => {
            const originalFetch = context.fetch;
            try {
                context.fetch = async () => {
                    return {
                        status: 200,
                        json: async () => ({
                            data: {
                                attributes: {
                                    // missing last_analysis_stats
                                }
                            }
                        })
                    };
                };

                const result = await context.checkVirusTotal('dummyhash', 'dummyapikey');
                assert.strictEqual(result, null);
            } finally {
                context.fetch = originalFetch;
            }
        });

        it('returns null on response with status other than 200', async () => {
            const originalFetch = context.fetch;
            try {
                context.fetch = async () => {
                    return {
                        status: 404,
                        json: async () => ({
                            error: { code: 'NotFoundError', message: 'File not found' }
                        })
                    };
                };

                const result = await context.checkVirusTotal('dummyhash', 'dummyapikey');
                assert.strictEqual(result, null);
            } finally {
                context.fetch = originalFetch;
            }
        });

        it('returns null and handles error safely on fetch failure', async () => {
            const originalFetch = context.fetch;
            const originalConsoleError = context.console.error;
            let errorLogged = false;

            try {
                context.fetch = async () => {
                    throw new Error("Network failure");
                };
                context.console.error = (msg, e) => {
                    if (msg.includes("Fehler bei VirusTotal Abfrage:")) {
                        errorLogged = true;
                    }
                };

                const result = await context.checkVirusTotal('dummyhash', 'dummyapikey');

                assert.strictEqual(result, null);
                assert.strictEqual(errorLogged, true);
            } finally {
                context.fetch = originalFetch;
                context.console.error = originalConsoleError;
            }
        });
    });

    describe('checkUrlscanIo', () => {
        let originalFetch;
        let originalConsoleError;
        let originalConsoleLog;
        let originalSetTimeout;

        beforeEach(() => {
            originalFetch = context.fetch;
            originalConsoleError = context.console.error;
            originalConsoleLog = context.console.log;
            originalSetTimeout = context.setTimeout;
            context.console.error = () => {};
            context.console.log = () => {};
            context.setTimeout = (cb) => {
                cb(); // execute instantly
            };
        });

        afterEach(() => {
            context.fetch = originalFetch;
            context.console.error = originalConsoleError;
            context.console.log = originalConsoleLog;
            context.setTimeout = originalSetTimeout;
        });

        it('returns null if no apikey', async () => {
            const result = await context.checkUrlscanIo('http://example.com', null);
            assert.strictEqual(result, null);
        });

        it('handles 400 error correctly', async () => {
            context.fetch = async () => ({
                status: 400,
                json: async () => ({ error: 'bad request' })
            });

            const result = await context.checkUrlscanIo('http://example.com', 'apikey');
            assert.strictEqual(result.status, 'ERROR');
            assert.strictEqual(result.details, 'Domain not resolvable');
        });

        it('handles successful scan and result polling (malicious overall)', async () => {
            let callCount = 0;
            context.fetch = async (url) => {
                callCount++;
                if (callCount === 1) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ uuid: 'test-uuid-1' })
                    };
                } else if (callCount === 2) {
                    return {
                        status: 200,
                        json: async () => ({
                            verdicts: {
                                overall: { malicious: true }
                            }
                        })
                    };
                }
            };

            const result = await context.checkUrlscanIo('http://malicious.com', 'apikey');
            assert.strictEqual(result.status, 'MALICIOUS_VISUAL');
            assert.ok(result.reasons.includes("Die URL wurde von urlscan.io generell als bösartig eingestuft."));
        });

        it('handles successful scan and result polling (malicious brand)', async () => {
            let callCount = 0;
            context.fetch = async (url) => {
                callCount++;
                if (callCount === 1) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ uuid: 'test-uuid-2' })
                    };
                } else if (callCount === 2) {
                    return {
                        status: 200,
                        json: async () => ({
                            verdicts: {
                                urlscan: {
                                    malicious: true,
                                    brands: ['PayPal']
                                }
                            }
                        })
                    };
                }
            };

            const result = await context.checkUrlscanIo('http://phishing.com', 'apikey');
            assert.strictEqual(result.status, 'MALICIOUS_VISUAL');
            assert.ok(result.reasons.includes("Visuelle Erkennung: Die Seite gibt sich als PayPal aus (Phishing-Verdacht)."));
        });

        it('handles successful scan and result polling (clean)', async () => {
            let callCount = 0;
            context.fetch = async (url) => {
                callCount++;
                if (callCount === 1) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ uuid: 'test-uuid-3' })
                    };
                } else if (callCount === 2) {
                    return {
                        status: 200,
                        json: async () => ({ verdicts: {} })
                    };
                }
            };

            const result = await context.checkUrlscanIo('http://clean.com', 'apikey');
            assert.strictEqual(result.status, 'CLEAN');
        });

        it('handles successful scan but polling timeout', async () => {
            let callCount = 0;
            context.fetch = async (url) => {
                callCount++;
                if (callCount === 1) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ uuid: 'test-uuid-4' })
                    };
                } else {
                    return {
                        status: 404, // Not ready
                        json: async () => ({})
                    };
                }
            };

            const result = await context.checkUrlscanIo('http://slow.com', 'apikey');
            assert.strictEqual(result.status, 'TIMEOUT');
        });

        it('handles fetch failure/exception gracefully', async () => {
            let errorLogged = false;
            context.console.error = (msg, e) => {
                if (msg.includes("Fehler bei urlscan.io Abfrage")) errorLogged = true;
            };
            context.fetch = async () => {
                throw new Error("Network offline");
            };

            const result = await context.checkUrlscanIo('http://error.com', 'apikey');
            assert.strictEqual(result.status, 'ERROR');
            assert.strictEqual(result.details, 'Network offline');
            assert.strictEqual(errorLogged, true);
        });
    });


    describe('evaluateUrlhaus', () => {
        it('returns unchanged score and reasons for empty array', () => {
            const reasons = [];
            const score = context.evaluateUrlhaus([], 10, reasons);
            assert.strictEqual(score, 10);
            assert.strictEqual(reasons.length, 0);
        });

        it('returns unchanged score and reasons for undefined urlhausDomains', () => {
            const reasons = [];
            const score = context.evaluateUrlhaus(undefined, 10, reasons);
            assert.strictEqual(score, 10);
            assert.strictEqual(reasons.length, 0);
        });

        it('increases score and adds reason for each domain in the array', () => {
            const reasons = [];
            const score = context.evaluateUrlhaus(['malicious.com', 'evil.org'], 0, reasons);
            assert.strictEqual(score, 160);
            assert.strictEqual(reasons.length, 2);
            assert.ok(reasons[0].includes('malicious.com'));
            assert.ok(reasons[1].includes('evil.org'));
        });
    });

    describe('evaluateReplyTo', () => {
        it('extracts email normally with matching brackets', () => {
            const reasons = [];
            const result = context.evaluateReplyTo('Name <reply@example.com>', 'example.com', 0, reasons);
            assert.strictEqual(result, 0);
            assert.strictEqual(reasons.length, 0);
        });

        it('handles strings with no angle brackets', () => {
            const reasons = [];
            const result = context.evaluateReplyTo('reply@example.com', 'example.com', 0, reasons);
            assert.strictEqual(result, 0);
            assert.strictEqual(reasons.length, 0);
        });

        it('detects domain discrepancy and increases score', () => {
            const reasons = [];
            const result = context.evaluateReplyTo('Name <reply@other.com>', 'example.com', 10, reasons);
            assert.strictEqual(result, 35);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('Diskrepanz erkannt'));
        });

        it('handles missing closing bracket', () => {
            const reasons = [];
            // When closing bracket is missing, indexOf('>', start + 1) returns -1.
            // substring is NOT called, so replyToEmail remains "Name <reply@other.com".
            // Since there is an "@", the domain becomes "other.com".
            const result = context.evaluateReplyTo('Name <reply@other.com', 'example.com', 0, reasons);
            assert.strictEqual(result, 25);
            assert.strictEqual(reasons.length, 1);
        });

        it('handles missing opening bracket', () => {
            const reasons = [];
            // When opening bracket is missing, start is -1.
            // substring is NOT called, so replyToEmail remains "Name reply@other.com>".
            // Since there is an "@", the domain becomes "other.com>".
            const result = context.evaluateReplyTo('Name reply@other.com>', 'example.com', 0, reasons);
            assert.strictEqual(result, 25);
            assert.strictEqual(reasons.length, 1);
        });

        it('handles multiple and mismatched brackets', () => {
            const reasons = [];
            const result = context.evaluateReplyTo('<<Name> <reply@example.com>>', 'example.com', 0, reasons);
            // First '<' is at index 0. First '>' after 0 is at index 6.
            // Extracted: "<Name"
            // "atIndex" = -1
            // replyDomain = ""
            // So no discrepancy because replyDomain is falsy.
            assert.strictEqual(result, 0);
            assert.strictEqual(reasons.length, 0);

            const reasons2 = [];
            const result2 = context.evaluateReplyTo('Name <reply@other.com> >', 'example.com', 0, reasons2);
            assert.strictEqual(result2, 25);
            assert.strictEqual(reasons2.length, 1);
        });

        it('handles empty brackets', () => {
            const reasons = [];
            const result = context.evaluateReplyTo('<>', 'example.com', 0, reasons);
            // Extract is "". "atIndex" = -1. replyDomain = "".
            assert.strictEqual(result, 0);
            assert.strictEqual(reasons.length, 0);
        });
    });

    describe('evaluateBehavior', () => {
        it('returns initial score when no urgency words and not first communication', () => {
            const reasons = [];
            const result = context.evaluateBehavior('Meeting update', 'The meeting is at 10 AM', false, 10, reasons);
            assert.strictEqual(result, 10);
            assert.strictEqual(reasons.length, 0);
        });

        it('increases score by 5 for first communication without urgency words', () => {
            const reasons = [];
            const result = context.evaluateBehavior('Hello', 'Nice to meet you', true, 0, reasons);
            assert.strictEqual(result, 5);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('Dies ist das erste Mal, dass Sie mit diesem Absender kommunizieren.'));
        });

        it('increases score by 10 and logs urgency words when not first communication', () => {
            const reasons = [];
            const result = context.evaluateBehavior('Dringend', 'Bitte überweisung sofort ausführen', false, 0, reasons);
            assert.strictEqual(result, 10);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('Dringlichkeits-Signalwörter gefunden'));
            assert.ok(reasons[0].includes('dringend'));
            assert.ok(reasons[0].includes('überweisung'));
            assert.ok(reasons[0].includes('sofort'));
        });

        it('increases score by 25 and logs BEC for first communication with urgency words', () => {
            const reasons = [];
            const result = context.evaluateBehavior('Invoice payment', 'The payment is urgent', true, 0, reasons);
            assert.strictEqual(result, 25);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('Mögliches BEC'));
            assert.ok(reasons[0].includes('payment'));
            assert.ok(reasons[0].includes('urgent'));
        });

        it('handles case insensitivity correctly', () => {
            const reasons = [];
            const result = context.evaluateBehavior('WICHTIG', 'ÜBERWEISUNG', true, 0, reasons);
            assert.strictEqual(result, 25);
            assert.ok(reasons[0].includes('wichtig'));
            assert.ok(reasons[0].includes('überweisung'));
        });

        it('deduplicates urgency words', () => {
            const reasons = [];
            context.evaluateBehavior('Dringend dringend', 'Bitte dringend sofort', false, 0, reasons);
            assert.ok(reasons[0].includes('dringend, sofort'));
            // check that "dringend" is only printed once.
            const matchCount = (reasons[0].match(/dringend/g) || []).length;
            assert.strictEqual(matchCount, 1);
        });
    });

    describe('evaluateLinks', () => {
        it('ignores invalid URLs without throwing an error', () => {
            const urls = ['not-a-valid-url', 'http://example.com'];
            const reasons = [];
            const score = context.evaluateLinks({
                urls,
                senderDomain: 'example.com',
                senderMainDomain: 'example.com',
                score: 0,
                reasons
            });

            // Should not throw, and should find the match for example.com
            assert.strictEqual(score, 0);
            assert.strictEqual(reasons.length, 0);
        });

        it('catches and ignores errors thrown by getHostnameOptimized', () => {
            const originalGetHostnameOptimized = context.getHostnameOptimized;

            // Mock getHostnameOptimized to throw an error
            context.getHostnameOptimized = () => {
                throw new Error('Mocked URL parsing error');
            };

            const urls = ['http://example.com'];
            const reasons = [];
            let score;

            try {
                // This should catch the error internally and not throw
                score = context.evaluateLinks({
                    urls,
                    senderDomain: 'example.com',
                    senderMainDomain: 'example.com',
                    score: 0,
                    reasons
                });
            } finally {
                // Restore original function
                context.getHostnameOptimized = originalGetHostnameOptimized;
            }

            // If getHostnameOptimized throws, the link is ignored.
            // If no valid links are found, evaluateLinks returns the original score.
            assert.strictEqual(score, 0);
            assert.strictEqual(reasons.length, 0);
        });

        it('increases score if no link matches sender domain', () => {
            const urls = ['http://other-domain.com'];
            const reasons = [];
            const score = context.evaluateLinks({
                urls,
                senderDomain: 'example.com',
                senderMainDomain: 'example.com',
                score: 0,
                reasons
            });

            assert.strictEqual(score, 25);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('Keiner der Links im Text verweist auf die Absender-Domain'));
        });
    });

    describe('checkTyposquattingLink', () => {
        let reasons;
        let reasonsDomainsSet;
        let checkedMainDomains;

        beforeEach(() => {
            reasons = [];
            reasonsDomainsSet = new Set();
            checkedMainDomains = new Map();
        });

        it('identifies typosquatting on known brands', () => {
            const isTyposquatting = context.checkTyposquattingLink('paypa1.com', checkedMainDomains, reasons, reasonsDomainsSet);
            assert.strictEqual(isTyposquatting, true);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('ähnelt verdächtig der bekannten Marke paypal.com'));
            assert.ok(reasonsDomainsSet.has('paypa1.com'));
            assert.strictEqual(checkedMainDomains.get('paypa1.com'), 'paypal.com');
        });

        it('returns false for domain length < 4', () => {
            const isTyposquatting = context.checkTyposquattingLink('abc', checkedMainDomains, reasons, reasonsDomainsSet);
            assert.strictEqual(isTyposquatting, false);
            assert.strictEqual(checkedMainDomains.get('abc'), null);
        });

        it('returns false when length difference is > 2', () => {
            const isTyposquatting = context.checkTyposquattingLink('paypal-is-great.com', checkedMainDomains, reasons, reasonsDomainsSet);
            assert.strictEqual(isTyposquatting, false);
            assert.strictEqual(checkedMainDomains.get('paypal-is-great.com'), null);
        });

        it('returns false for completely different domains', () => {
            const isTyposquatting = context.checkTyposquattingLink('example.com', checkedMainDomains, reasons, reasonsDomainsSet);
            assert.strictEqual(isTyposquatting, false);
            assert.strictEqual(checkedMainDomains.get('example.com'), null);
        });

        it('uses cached brand match', () => {
            checkedMainDomains.set('paypa1.com', 'paypal.com');
            const isTyposquatting = context.checkTyposquattingLink('paypa1.com', checkedMainDomains, reasons, reasonsDomainsSet);
            assert.strictEqual(isTyposquatting, true);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('ähnelt verdächtig der bekannten Marke paypal.com'));
            assert.ok(reasonsDomainsSet.has('paypa1.com'));
        });

        it('uses cached brand match but does not duplicate reasons if already in set', () => {
            checkedMainDomains.set('paypa1.com', 'paypal.com');
            reasonsDomainsSet.add('paypa1.com');
            const isTyposquatting = context.checkTyposquattingLink('paypa1.com', checkedMainDomains, reasons, reasonsDomainsSet);
            assert.strictEqual(isTyposquatting, true);
            assert.strictEqual(reasons.length, 0);
        });

        it('uses cached null match', () => {
            checkedMainDomains.set('example.com', null);
            const isTyposquatting = context.checkTyposquattingLink('example.com', checkedMainDomains, reasons, reasonsDomainsSet);
            assert.strictEqual(isTyposquatting, false);
            assert.strictEqual(reasons.length, 0);
        });
    });

    describe('getMainDomain', () => {
        it('extracts known brand from subdomain', () => {
            assert.strictEqual(context.getMainDomain('www.paypal.com'), 'paypal.com');
            assert.strictEqual(context.getMainDomain('sub.amazon.de'), 'amazon.de');
        });

        it('returns known brand when just the brand is provided', () => {
            assert.strictEqual(context.getMainDomain('paypal.com'), 'paypal.com');
        });

        it('extracts regular domain from subdomain', () => {
            assert.strictEqual(context.getMainDomain('sub.example.com'), 'example.com');
        });

        it('extracts regular domain from multi-level subdomain', () => {
            assert.strictEqual(context.getMainDomain('a.b.example.com'), 'example.com');
        });

        it('returns domain when it has only one part', () => {
            assert.strictEqual(context.getMainDomain('localhost'), 'localhost');
        });

        it('returns domain when it has two parts', () => {
            assert.strictEqual(context.getMainDomain('example.com'), 'example.com');
        });
    });

    describe('levenshteinDistance', () => {
        it('returns 0 for identical strings', () => {
            assert.strictEqual(context.levenshteinDistance('test', 'test'), 0);
        });

        it('returns 1 for a single character difference (substitution)', () => {
            assert.strictEqual(context.levenshteinDistance('test', 'tent'), 1);
        });

        it('returns 1 for a single character addition (insertion)', () => {
            assert.strictEqual(context.levenshteinDistance('test', 'tests'), 1);
        });

        it('returns 1 for a single character deletion', () => {
            assert.strictEqual(context.levenshteinDistance('test', 'tes'), 1);
        });

        it('handles completely different strings', () => {
            assert.strictEqual(context.levenshteinDistance('abc', 'xyz'), 3);
        });

        it('returns string length when comparing with empty string', () => {
            assert.strictEqual(context.levenshteinDistance('test', ''), 4);
            assert.strictEqual(context.levenshteinDistance('', 'test'), 4);
        });

        it('returns 0 for both empty strings', () => {
            assert.strictEqual(context.levenshteinDistance('', ''), 0);
        });

        it('is symmetric', () => {
            const dist1 = context.levenshteinDistance('hello', 'world');
            const dist2 = context.levenshteinDistance('world', 'hello');
            assert.strictEqual(dist1, dist2);
            assert.strictEqual(dist1, 4);
        });

        it('handles long strings reallocating Uint16Array', () => {
            const str1 = 'a'.repeat(70);
            const str2 = 'b'.repeat(70);
            assert.strictEqual(context.levenshteinDistance(str1, str2), 70);
        });
    });

    describe('evaluateSenderDomain', () => {
        it('returns initial score when senderDomain is empty', () => {
            const result = context.evaluateSenderDomain('', 10, []);
            assert.strictEqual(result.score, 10);
            assert.strictEqual(result.senderMainDomain, '');
        });

        it('identifies exact known brands without increasing score', () => {
            const reasons = [];
            const result = context.evaluateSenderDomain('service.paypal.com', 0, reasons);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.senderMainDomain, 'paypal.com');
            assert.strictEqual(reasons.length, 0);
        });

        it('increases score for typosquatted known brands (levenshtein distance 1 or 2)', () => {
            const reasons = [];
            const result = context.evaluateSenderDomain('paypel.com', 0, reasons);
            assert.strictEqual(result.score, 60);
            assert.strictEqual(result.senderMainDomain, 'paypel.com');
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('ähnelt verdächtig der bekannten Marke paypal.com'));
        });

        it('does not increase score for completely unknown, unrelated domains', () => {
            const reasons = [];
            const result = context.evaluateSenderDomain('some-random-domain.org', 0, reasons);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.senderMainDomain, 'some-random-domain.org');
            assert.strictEqual(reasons.length, 0);
        });

        it('ignores short domains from typosquatting checks to prevent false positives', () => {
            const reasons = [];
            const result = context.evaluateSenderDomain('a.b', 0, reasons);
            assert.strictEqual(result.score, 0);
        });
    });

    describe('getHostnameOptimized', () => {
        it('extracts hostname from http URL', () => {
            assert.strictEqual(context.getHostnameOptimized('http://example.com/path'), 'example.com');
        });

        it('extracts hostname from https URL', () => {
            assert.strictEqual(context.getHostnameOptimized('https://www.google.com/search?q=test'), 'www.google.com');
        });

        it('converts hostname to lowercase', () => {
            assert.strictEqual(context.getHostnameOptimized('https://EXAMPLE.COM/path'), 'example.com');
        });

        it('returns null for invalid URLs', () => {
            assert.strictEqual(context.getHostnameOptimized('not-a-url'), null);
        });

        it('returns null for empty string', () => {
            assert.strictEqual(context.getHostnameOptimized(''), null);
        });

        it('returns null for null/undefined input', () => {
            assert.strictEqual(context.getHostnameOptimized(null), null);
            assert.strictEqual(context.getHostnameOptimized(undefined), null);
        });
    });

    describe('calculateThreatScore', () => {
        it('calculates threat score correctly for spf=fail', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = [];
            const authHeaders = ["spf=fail"];
            const result = context.calculateThreatScore(author, urls, { authHeaders });
            assert.strictEqual(result.score, 25);
            assert.strictEqual(result.authStatus, 'fail');
            assert.ok(result.reasons.some(r => r.includes("SPF-Prüfung fehlgeschlagen")));
        });

        it('calculates threat score correctly for dkim=fail', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = [];
            const authHeaders = ["dkim=fail"];
            const result = context.calculateThreatScore(author, urls, { authHeaders });
            assert.strictEqual(result.score, 25);
            assert.strictEqual(result.authStatus, 'fail');
            assert.ok(result.reasons.some(r => r.includes("DKIM-Signatur ungültig")));
        });

        it('calculates threat score correctly for dmarc=fail', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = [];
            const authHeaders = ["dmarc=fail"];
            const result = context.calculateThreatScore(author, urls, { authHeaders });
            assert.strictEqual(result.score, 30);
            assert.strictEqual(result.authStatus, 'fail');
            assert.ok(result.reasons.some(r => r.includes("DMARC-Prüfung fehlgeschlagen")));
        });

        it('calculates threat score correctly for auth pass', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = [];
            const authHeaders = ["spf=pass", "dkim=pass", "dmarc=pass"];
            const result = context.calculateThreatScore(author, urls, { authHeaders });
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.authStatus, 'pass');
        });

        it('calculates threat score correctly for urlhaus blacklisted domain', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = ["http://malware.com/"];
            const urlhausDomains = ["malware.com"];
            const result = context.calculateThreatScore(author, urls, { urlhausDomains });
            assert.strictEqual(result.score >= 80, true);
            assert.ok(result.reasons.some(r => r.includes("auf URLhaus als bösartig gelistet")));
        });

        it('calculates threat score correctly for typosquatting sender', async () => {
            const author = 'Service <service@amaz0n.de>';
            const urls = [];
            const result = context.calculateThreatScore(author, urls);
            assert.strictEqual(result.score, 60);
            assert.ok(result.reasons.some(r => r.includes('amaz0n.de')));
        });

        it('calculates threat score correctly for domain mismatch', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = ['http://login.hacker.com/123'];
            const result = context.calculateThreatScore(author, urls);
            assert.strictEqual(result.score, 25);
            assert.ok(result.reasons.some(r => r.includes('Keiner der Links')));
        });

        it('calculates threat score correctly for domain mismatch with parsedUrlCache and options', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = ['http://login.hacker.com/123'];
            const cache = new Map();
            const result = context.calculateThreatScore(author, urls, { parsedUrlCache: cache });
            assert.strictEqual(result.score, 25);
            assert.ok(result.reasons.some(r => r.includes('Keiner der Links')));
            assert.strictEqual(cache.get('http://login.hacker.com/123'), 'login.hacker.com');
        });

        it('calculates threat score correctly when at least one link matches sender domain', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = ['http://paypal.com/login', 'http://login.hacker.com/123'];
            const result = context.calculateThreatScore(author, urls);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.reasons.length, 0);
        });

        it('calculates threat score correctly for typosquatting link and mismatch', async () => {
            const author = 'Service <service@paypal-support.com>';
            const urls = ['https://login.amaz0n.de'];
            const result = context.calculateThreatScore(author, urls);
            // 45 (Link-Typosquat) + 25 (Link-Mismatch) = 70; der Absender selbst
            // ist kein Typosquat, weil 'paypal-support.com' nicht auf 'paypal.com' endet.
            assert.strictEqual(result.score, 70);
            assert.ok(result.reasons.some(r => r.includes('amaz0n.de')));
        });

        it('calculates threat score correctly for legitimate emails', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = ['http://paypal.com/login', 'http://info.paypal.com/test'];
            const result = context.calculateThreatScore(author, urls);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.reasons.length, 0);
        });

        it('calculates threat score correctly for legitimate emails with subdomain sender and root link', async () => {
            const author = 'Service <service@service.paypal.com>';
            const urls = ['http://paypal.com/login', 'http://info.paypal.com/test'];
            const result = context.calculateThreatScore(author, urls);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.reasons.length, 0);
        });

        it('calculates threat score correctly for reply-to discrepancy', async () => {
            const result = context.calculateThreatScore("CEO <ceo@company.com>", [], {
                replyTo: "Hacker <hacker@evil.com>",
                messageText: "Hello",
                subject: "Hi"
            });
            assert.strictEqual(result.score, 25);
            assert.ok(result.reasons.some(r => r.includes("Diskrepanz erkannt")));
        });

        it('calculates threat score correctly for BEC first comm + urgency', async () => {
            const result = context.calculateThreatScore("CEO <ceo@company.com>", [], {
                isFirstCommunication: true,
                messageText: "Bitte schnell überweisung tätigen.",
                subject: "Wichtig!"
            });
            assert.strictEqual(result.score, 25);
            assert.ok(result.reasons.some(r => r.includes("Erste Kommunikation")));
        });

        it('calculates threat score correctly for urgency without first comm', async () => {
            const result = context.calculateThreatScore("CEO <ceo@company.com>", [], {
                isFirstCommunication: false,
                messageText: "Bitte schnell überweisung tätigen.",
                subject: "Wichtig!"
            });
            assert.strictEqual(result.score, 10);
            assert.ok(result.reasons.some(r => r.includes("Dringlichkeits-Signalwörter gefunden")));
        });

        it('calculates threat score correctly for first comm without urgency', async () => {
            const result = context.calculateThreatScore("CEO <ceo@company.com>", [], {
                isFirstCommunication: true,
                messageText: "Hallo wie geht es dir.",
                subject: "Hi"
            });
            assert.strictEqual(result.score, 5);
            assert.ok(result.reasons.some(r => r.includes("erste Mal, dass Sie mit diesem Absender kommunizieren")));
        });

        it('calculates threat score correctly for custom blacklist exact match', async () => {
            context.set_customBlacklist(new Set(['hacker@evil.com']));
            const result = context.calculateThreatScore("Hacker <hacker@evil.com>", []);
            assert.strictEqual(result.score, 100);
            assert.ok(result.reasons.some(r => r.includes("steht auf der Blacklist")));
            context.set_customBlacklist(new Set());
        });

        it('calculates threat score correctly for custom blacklist domain match', async () => {
            context.set_customBlacklist(new Set(['evil.com']));
            const result = context.calculateThreatScore("Hacker <hacker@evil.com>", []);
            assert.strictEqual(result.score, 100);
            assert.ok(result.reasons.some(r => r.includes("steht auf der Blacklist")));
            context.set_customBlacklist(new Set());
        });

        it('calculates threat score correctly for custom whitelist exact match', async () => {
            context.set_customWhitelist(new Set(['good@guy.com']));
            const result = context.calculateThreatScore("Good <good@guy.com>", [], {
                urlhausDomains: ['malware.com'] // should be ignored due to whitelist return
            });
            assert.strictEqual(result.score, 0);
            assert.ok(result.reasons.some(r => r.includes("steht auf der Whitelist")));
            context.set_customWhitelist(new Set());
        });

        it('calculates threat score correctly for custom whitelist domain match', async () => {
            context.set_customWhitelist(new Set(['guy.com']));
            const result = context.calculateThreatScore("Good <good@guy.com>", [], {
                urlhausDomains: ['malware.com'] // should be ignored due to whitelist return
            });
            assert.strictEqual(result.score, 0);
            assert.ok(result.reasons.some(r => r.includes("steht auf der Whitelist")));
            context.set_customWhitelist(new Set());
        });
    });

    describe('handleDownloadDisarmed', () => {
        let originalBlob;

        beforeEach(() => {
            originalBlob = context.Blob;
        });

        afterEach(() => {
            context.Blob = originalBlob;
        });

        it('disarms HTML and triggers download with safe name', async () => {
            const htmlContent = '<html><body><h1>Test</h1><script>alert(1);</script></body></html>';
            const encoder = new TextEncoder();
            const arrayBuffer = encoder.encode(htmlContent).buffer;

            context.browser.messages.getAttachmentFile = async () => ({
                arrayBuffer: async () => arrayBuffer
            });

            let blobContent = '';
            context.Blob = class {
                constructor(content, options) {
                    blobContent = content[0];
                }
            };

            let downloadArgs = null;
            context.browser.downloads.download = async (args) => {
                downloadArgs = args;
            };

            await context.handleDownloadDisarmed(1, 'part1', 'test_attachment.html');

            assert.ok(!blobContent.includes('<script>'), 'Script tag should be removed');
            assert.ok(!blobContent.includes('alert(1)'), 'Script content should be removed');
            assert.ok(blobContent.includes('Test'), 'Safe content should remain');

            assert.strictEqual(downloadArgs.filename, 'disarmed_test_attachment.html');
            assert.strictEqual(downloadArgs.saveAs, true);
        });

        it('appends .html to files missing html extension', async () => {
            const htmlContent = '<html><body><h1>Test</h1></body></html>';
            const encoder = new TextEncoder();
            const arrayBuffer = encoder.encode(htmlContent).buffer;

            context.browser.messages.getAttachmentFile = async () => ({
                arrayBuffer: async () => arrayBuffer
            });

            context.Blob = class { constructor(content) {} };

            let downloadArgs = null;
            context.browser.downloads.download = async (args) => {
                downloadArgs = args;
            };

            await context.handleDownloadDisarmed(1, 'part1', 'test_attachment.txt');

            assert.strictEqual(downloadArgs.filename, 'disarmed_test_attachment.txt.html');
        });

        it('sanitizes malicious attachment names', async () => {
            const htmlContent = '<html><body><h1>Test</h1></body></html>';
            const encoder = new TextEncoder();
            const arrayBuffer = encoder.encode(htmlContent).buffer;

            context.browser.messages.getAttachmentFile = async () => ({
                arrayBuffer: async () => arrayBuffer
            });

            context.Blob = class { constructor(content) {} };

            let downloadArgs = null;
            context.browser.downloads.download = async (args) => {
                downloadArgs = args;
            };

            await context.handleDownloadDisarmed(1, 'part1', '../../../etc/passwd.html');

            assert.strictEqual(downloadArgs.filename, 'disarmed_passwd.html');

            await context.handleDownloadDisarmed(1, 'part1', 'hello?world*.html');

            assert.strictEqual(downloadArgs.filename, 'disarmed_hello_world_.html');
        });
    });

    describe('display state (message display script)', () => {
        it('stores the Time-of-Click URLs in the display state', () => {
            context.set_timeOfClickProtection(true);
            const filteredUrls = ['http://malicious.com'];

            context.injectTimeOfClickProtection(10, filteredUrls);

            const state = context.displayStates.get(10);
            assert.strictEqual(state.timeOfClickProtection, true);
            assert.strictEqual(state.urls.length, 1);
            assert.strictEqual(state.urls[0], 'http://malicious.com');
        });

        it('does not store URLs when Time-of-Click Protection is disabled', () => {
            context.set_timeOfClickProtection(false);

            context.injectTimeOfClickProtection(11, ['http://malicious.com']);

            const state = context.displayStates.get(11);
            assert.strictEqual(state.timeOfClickProtection, false);
            assert.strictEqual(state.urls.length, 0);
        });

        it('falls back to per-message injection when registerScripts is unavailable', async () => {
            const injections = [];
            context.browser.scripting.executeScript = async (opts) => { injections.push(opts); };
            delete context.browser.scripting.messageDisplay;

            await context.registerMessageDisplayScript();
            await context.ensureMessageDisplayScript(12);

            assert.strictEqual(injections.length, 1);
            assert.strictEqual(injections[0].target.tabId, 12);
            assert.strictEqual(injections[0].files.length, 1);
            assert.strictEqual(injections[0].files[0], 'messageDisplay/banner.js');
        });

        it('registers the message display script when the API is available', async () => {
            let registered = null;
            context.browser.scripting.messageDisplay = {
                registerScripts: async (scripts) => { registered = scripts; }
            };

            const ok = await context.registerMessageDisplayScript();

            assert.strictEqual(ok, true);
            assert.strictEqual(registered.length, 1);
            assert.strictEqual(registered[0].id, 'thundy-av-banner');
            assert.strictEqual(registered[0].js.length, 1);
            assert.strictEqual(registered[0].js[0].file, 'messageDisplay/banner.js');
            assert.strictEqual(registered[0].css.length, 1);
            assert.strictEqual(registered[0].css[0].file, 'messageDisplay/banner.css');

            // Mit registriertem Script darf nichts zusätzlich injiziert werden
            const injections = [];
            context.browser.scripting.executeScript = async (opts) => { injections.push(opts); };
            await context.ensureMessageDisplayScript(13);
            assert.strictEqual(injections.length, 0);
        });

        it('swallows injection errors', async () => {
            delete context.browser.scripting.messageDisplay;
            context.browser.scripting.executeScript = async () => { throw new Error('blocked'); };

            await assert.doesNotReject(async () => {
                await context.injectIntoMessageDisplay(14, { files: ['messageDisplay/banner.js'] });
                await context.ensureMessageDisplayScript(14);
            });
        });
    });

    describe('tab_mail_open_display builds the display state', () => {
        beforeEach(() => {
            context.browser.scripting.messageDisplay = {
                registerScripts: async () => {}
            };
        });

        it('publishes a ready state with a high threat score', async () => {
            context.set_timeOfClickProtection(false);
            context.set_privacyTier('balanced');

            context.browser.messages.listAttachments = async () => ([]);
            context.browser.messages.getFull = async () => ({
                contentType: 'text/html',
                body: '<a href="https://login.amaz0n.de">Click</a>'
            });

            await context.tab_mail_open_display({ id: 10 }, { messages: [{ id: 1, author: 'Service <service@paypal-support.com>', subject: 'Action required' }] });

            const state = context.displayStates.get(10);
            assert.strictEqual(state.mode, 'ready');
            assert.strictEqual(state.messageId, 1);
            assert.ok(state.threat.score >= 50, 'spoofed message must be above the banner threshold');
        });

        it('publishes a ready state with a low threat score', async () => {
            context.set_timeOfClickProtection(false);
            context.set_privacyTier('balanced');

            context.browser.messages.listAttachments = async () => ([]);
            context.browser.messages.getFull = async () => ({
                contentType: 'text/plain',
                body: 'Just a normal text.'
            });

            await context.tab_mail_open_display({ id: 10 }, { messages: [{ id: 1, author: 'User <user@example.com>', subject: 'Action required' }] });

            const state = context.displayStates.get(10);
            assert.strictEqual(state.mode, 'ready');
            assert.ok(state.threat.score < 50);
        });

        it('offers the opt-in banner when scanning is not enabled for the sender', async () => {
            context.set_timeOfClickProtection(false);
            context.browser.storage.local.get = async () => ({ scanningEnabledSenders: [] });
            context.browser.messages.listAttachments = async () => ([{ name: 'x.exe', partName: '1', contentType: 'application/x-msdownload' }]);
            context.browser.messages.getFull = async () => ({ contentType: 'text/plain', body: 'text' });

            await context.tab_mail_open_display({ id: 11 }, { messages: [{ id: 2, author: 'Sender <sender@example.com>', subject: 'Hello' }] });

            const state = context.displayStates.get(11);
            assert.strictEqual(state.showOptIn, true);
            assert.strictEqual(state.consent, true);
        });

        it('does not offer the opt-in banner when the sender is opted in and permission is granted', async () => {
            context.set_timeOfClickProtection(false);
            context.set_apikey('test-key');
            context.browser.permissions = { contains: async () => true, request: async () => true };
            context.browser.storage.local.get = async () => ({ scanningEnabledSenders: ['sender@example.com'] });
            context.browser.messages.listAttachments = async () => ([{ name: 'x.exe', partName: '1', contentType: 'application/x-msdownload' }]);
            context.browser.messages.getFull = async () => ({ contentType: 'text/plain', body: 'text' });

            await context.tab_mail_open_display({ id: 12 }, { messages: [{ id: 3, author: 'Sender <sender@example.com>', subject: 'Hello' }] });

            const state = context.displayStates.get(12);
            assert.strictEqual(state.canAutoUpload, true);
            assert.strictEqual(state.showOptIn, false);
        });
    });

    describe('evaluateAndInjectThreats and helpers', () => {
        it('extractBecProtectionData extracts senderEmail, firstComm, replyTo, and subject', async () => {
            const originalQuery = context.browser.messages.query;
            context.browser.messages.query = async () => ({ messages: [] });
            try {
                const message = { author: 'Alice <alice@example.com>', subject: 'Test Subject' };
                const fullMessage = { headers: { 'reply-to': ['reply@example.com'] } };
                const res = await context.extractBecProtectionData(message, fullMessage);
                assert.strictEqual(res.senderEmail, 'alice@example.com');
                assert.strictEqual(res.subject, 'Test Subject');
                assert.strictEqual(res.replyTo, 'reply@example.com');
                assert.strictEqual(res.isFirstCommunication, true);
            } finally {
                context.browser.messages.query = originalQuery;
            }
        });

        it('collectThreatEvaluationOptions aggregates options correctly', async () => {
            const message = { author: 'Bob <bob@example.com>', subject: 'Urgent' };
            const fullMessage = { headers: { 'authentication-results': ['spf=pass'], 'received': [] } };
            const options = await context.collectThreatEvaluationOptions({
                message,
                fullMessage,
                filteredUrls: [],
                messageText: 'Hello',
                parsedUrlCache: new Map()
            });
            assert.deepStrictEqual(options.authHeaders, ['spf=pass']);
            assert.strictEqual(options.subject, 'Urgent');
            assert.strictEqual(options.messageText, 'Hello');
        });
    });

    describe('extractTextFromParts', () => {
        it('extracts text from plain text parts', () => {
            const part = { contentType: 'text/plain', body: 'Hello World' };
            assert.strictEqual(context.extractTextFromParts(part), 'Hello World ');
        });

        it('extracts text from HTML parts', () => {
            const part = { contentType: 'text/html', body: '<b>Hello</b> World' };
            assert.strictEqual(context.extractTextFromParts(part), '<b>Hello</b> World ');
        });

        it('ignores parts that are not text/plain or text/html', () => {
            const part = { contentType: 'image/png', body: 'base64data' };
            assert.strictEqual(context.extractTextFromParts(part), '');
        });

        it('handles parts with missing body safely', () => {
            const part = { contentType: 'text/plain' }; // no body
            assert.strictEqual(context.extractTextFromParts(part), '');
        });

        it('recursively extracts text from nested subparts', () => {
            const part = {
                contentType: 'multipart/alternative',
                parts: [
                    { contentType: 'text/plain', body: 'Part 1' },
                    {
                        contentType: 'multipart/mixed',
                        parts: [
                            { contentType: 'image/jpeg', body: 'ignored' },
                            { contentType: 'text/html', body: 'Part 2' }
                        ]
                    }
                ]
            };
            assert.strictEqual(context.extractTextFromParts(part), 'Part 1 Part 2 ');
        });
    });

    describe('disarmHTML', () => {
        it('removes script tags and their content', () => {
            const input = '<html><body><h1>Test</h1><script>alert(1);</script></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('<script>'), 'Script tag should be removed');
            assert.ok(!result.includes('alert(1)'), 'Script content should be removed');
            assert.ok(result.includes('Test'), 'Safe content should remain');
        });

        it('removes inline event handlers', () => {
            const input = '<html><body><button onclick="evil()">Click</button></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('onclick'), 'onclick attribute should be removed');
            assert.ok(!result.includes('evil()'), 'Event handler content should be removed');
            assert.ok(result.includes('<button>Click</button>'), 'Button element should remain');
        });

        it('removes javascript URIs', () => {
            const input = '<html><body><a href="javascript:alert(1)">Link</a><a href="http://safe.com">Safe</a></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('javascript:'), 'javascript URI should be removed');
            const sanitizedDom = new (new JSDOM()).window.DOMParser().parseFromString(result, 'text/html');
            const hrefs = Array.from(sanitizedDom.querySelectorAll('a'))
                .map((a) => a.getAttribute('href'))
                .filter(Boolean);
            const hasSafeHost = hrefs.some((href) => {
                try {
                    return new URL(href).hostname === 'safe.com';
                } catch {
                    return false;
                }
            });
            assert.ok(hasSafeHost, 'Safe URI host should remain');
        });

        it('removes object, embed, iframe', () => {
            const input = '<html><body><object data="evil.swf"></object><embed src="evil.swf"></embed><iframe src="evil.html"></iframe></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('object'), 'object should be removed');
            assert.ok(!result.includes('embed'), 'embed should be removed');
            assert.ok(!result.includes('iframe'), 'iframe should be removed');
        });

        it('prevents javascript URI evasion', () => {
            const input = '<html><body><a href="java\tscript:alert(1)">Link</a><a href="jav&#x09;ascript:alert(1)">Link2</a><a href=" java&#x00;script:alert(1)">Link3</a><a href="javascript&#x3A;alert(1)">Link4</a><a href="java&#x200B;script:alert(1)">Link5</a><a href="java&#xA0;script:alert(1)">Link6</a></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('javascript:'), 'evaded javascript URI should be removed');
        });

        it('removes data and vbscript URIs', () => {
            const input = '<html><body><a href="data:text/html,<script>alert(1)</script>">Data Link</a><img src="vbscript:msgbox(\'hello\')"></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('data:'), 'data URI should be removed');
            assert.ok(!result.includes('vbscript:'), 'vbscript URI should be removed');
        });

        it('removes base and meta tags', () => {
            const input = '<html><head><base href="http://evil.com"><meta http-equiv="refresh" content="0;url=javascript:alert(1)"></head><body></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('<base'), 'base tag should be removed');
            assert.ok(!result.includes('<meta'), 'meta tag should be removed');
        });

        it('sanitizes action, formaction, and xlink:href attributes', () => {
            const input = `<html><body>
                <form action="javascript:alert(1)"><input type="submit"></form>
                <button formaction="data:text/html,<script>alert(1)</script>">Click</button>
                <svg><use xlink:href="javascript:alert(1)"></use></svg>
            </body></html>`;
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('javascript:'), 'javascript URI should be removed from action/xlink:href');
            assert.ok(!result.includes('data:'), 'data URI should be removed from formaction');
            assert.ok(!result.includes('action="javascript'), 'action attribute should be removed/sanitized');
        });

        it('prevents mXSS bypasses using template, math, svg, and noscript', () => {
            const templateInput = '<html><body><template><script>alert(1)</script><a href="javascript:alert(1)">X</a></template></body></html>';
            const templateResult = context.disarmHTML(templateInput);
            assert.ok(!templateResult.includes('<script>'), 'script tag inside template should be removed');
            assert.ok(!templateResult.includes('javascript:'), 'javascript URI inside template should be removed');

            const nestedTemplateInput = '<template><template><script>alert(1)</script></template></template>';
            const nestedTemplateResult = context.disarmHTML(nestedTemplateInput);
            assert.ok(!nestedTemplateResult.includes('<script>'), 'script tag inside nested template should be removed');

            const mathInput = '<math><script>alert(1)</script></math>';
            const mathResult = context.disarmHTML(mathInput);
            assert.ok(!mathResult.includes('math'), 'math tag should be removed');
            assert.ok(!mathResult.includes('script'), 'script tag inside math should be removed');

            const svgInput = '<svg><script>alert(1)</script></svg>';
            const svgResult = context.disarmHTML(svgInput);
            assert.ok(!svgResult.includes('svg'), 'svg tag should be removed');
            assert.ok(!svgResult.includes('script'), 'script tag inside svg should be removed');

            const noscriptInput = '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>';
            const noscriptResult = context.disarmHTML(noscriptInput);
            assert.ok(!noscriptResult.includes('<noscript>'), 'noscript tag should be removed');
        });
    });

    describe('checkLists', () => {
        beforeEach(() => {
            vm.runInContext('customBlacklist = new Set(); customWhitelist = new Set();', context);
        });

        it('returns null if lists are empty or undefined', () => {
            assert.strictEqual(context.checkLists('test@example.com', 'example.com'), null);
            vm.runInContext('customBlacklist = undefined; customWhitelist = undefined;', context);
            assert.strictEqual(context.checkLists('test@example.com', 'example.com'), null);
        });

        it('matches exact email on blacklist', () => {
            vm.runInContext('customBlacklist = new Set(["attacker@bad.com"]);', context);
            const result = context.checkLists('attacker@bad.com', 'bad.com');
            assert.ok(result);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.listType, 'blacklist');
            assert.strictEqual(result.reasons[0], 'Absender-E-Mail (attacker@bad.com) steht auf der Blacklist.');
        });

        it('matches exact domain on blacklist', () => {
            vm.runInContext('customBlacklist = new Set(["bad.com"]);', context);
            const result = context.checkLists('test@bad.com', 'bad.com');
            assert.ok(result);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.listType, 'blacklist');
            assert.strictEqual(result.reasons[0], 'Absender-Domain (bad.com) steht auf der Blacklist (bad.com).');
        });

        it('matches subdomain on blacklist', () => {
            vm.runInContext('customBlacklist = new Set(["bad.com"]);', context);
            const result = context.checkLists('test@sub.bad.com', 'sub.bad.com');
            assert.ok(result);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.listType, 'blacklist');
            assert.strictEqual(result.reasons[0], 'Absender-Domain (sub.bad.com) steht auf der Blacklist (bad.com).');
        });

        it('matches exact email on whitelist', () => {
            vm.runInContext('customWhitelist = new Set(["friend@good.com"]);', context);
            const result = context.checkLists('friend@good.com', 'good.com');
            assert.ok(result);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.listType, 'whitelist');
            assert.strictEqual(result.reasons[0], 'Absender-E-Mail (friend@good.com) steht auf der Whitelist.');
        });

        it('matches exact domain on whitelist', () => {
            vm.runInContext('customWhitelist = new Set(["good.com"]);', context);
            const result = context.checkLists('test@good.com', 'good.com');
            assert.ok(result);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.listType, 'whitelist');
            assert.strictEqual(result.reasons[0], 'Absender-Domain (good.com) steht auf der Whitelist (good.com).');
        });

        it('matches subdomain on whitelist', () => {
            vm.runInContext('customWhitelist = new Set(["good.com"]);', context);
            const result = context.checkLists('test@sub.good.com', 'sub.good.com');
            assert.ok(result);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.listType, 'whitelist');
            assert.strictEqual(result.reasons[0], 'Absender-Domain (sub.good.com) steht auf der Whitelist (good.com).');
        });

        it('prioritizes blacklist over whitelist if both match', () => {
            vm.runInContext('customBlacklist = new Set(["example.com"]); customWhitelist = new Set(["example.com"]);', context);
            const result = context.checkLists('test@example.com', 'example.com');
            assert.ok(result);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.listType, 'blacklist');
        });

        it('returns null if no matches in non-empty lists', () => {
            vm.runInContext('customBlacklist = new Set(["bad.com"]); customWhitelist = new Set(["good.com"]);', context);
            assert.strictEqual(context.checkLists('test@example.com', 'example.com'), null);
        });
    });

    describe('extractPublicIPs', () => {
        it('should return empty array for null/undefined/empty headers', () => {
            assert.deepEqual(context.extractPublicIPs(null), []);
            assert.deepEqual(context.extractPublicIPs(undefined), []);
            assert.deepEqual(context.extractPublicIPs([]), []);
        });

        it('should filter out private and local IPs', () => {
            const headers = [
                "Received: from 10.0.0.1 (localhost [127.0.0.1])",
                "Received: from 172.16.0.5 by 192.168.1.100",
                "Received: from 0.0.0.0 or 169.254.1.2"
            ];
            assert.strictEqual(context.extractPublicIPs(headers).length, 0);
        });

        it('should extract public IPs correctly', () => {
            const headers = [
                "Received: from mx.google.com (8.8.8.8)",
                "Received: from unknown (1.1.1.1) by 8.8.4.4"
            ];
            const ips = context.extractPublicIPs(headers);
            assert.strictEqual(ips.length, 3);
            assert.ok(ips.includes('8.8.8.8'));
            assert.ok(ips.includes('1.1.1.1'));
            assert.ok(ips.includes('8.8.4.4'));
        });

        it('should return unique public IPs when there are duplicates', () => {
            const headers = [
                "Received: from 8.8.8.8 by 8.8.8.8",
                "Received: from 9.9.9.9 and 8.8.8.8"
            ];
            const ips = context.extractPublicIPs(headers);
            assert.strictEqual(ips.length, 2);
            assert.ok(ips.includes('8.8.8.8'));
            assert.ok(ips.includes('9.9.9.9'));
        });

        it('should ignore non-IP numbers', () => {
            const headers = [
                "Received: id 12345.6789 by 9.9.9.9 version 1.2.3"
            ];
            const ips = context.extractPublicIPs(headers);
            assert.strictEqual(ips.length, 1);
            assert.strictEqual(ips[0], '9.9.9.9');
        });
    });


    describe('checkIPReputation', () => {
        let originalCheckAbuseIPDB;
        let originalCheckVirusTotalIP;

        beforeEach(() => {
            originalCheckAbuseIPDB = context.checkAbuseIPDB;
            originalCheckVirusTotalIP = context.checkVirusTotalIP;
            context.set_ipReputationApiKey('test-key');
        });

        afterEach(() => {
            context.checkAbuseIPDB = originalCheckAbuseIPDB;
            context.checkVirusTotalIP = originalCheckVirusTotalIP;
            context.set_ipReputationProvider('none');
            context.set_ipReputationApiKey('');
        });

        it('should return empty array if provider is none', async () => {
            context.set_ipReputationProvider('none');
            const result = await context.checkIPReputation(['from mx.google.com (1.2.3.4)']);
            assert.deepEqual(result, []);
        });

        it('should return empty array if api key is missing', async () => {
            context.set_ipReputationProvider('abuseipdb');
            context.set_ipReputationApiKey('');
            const result = await context.checkIPReputation(['from mx.google.com (1.2.3.4)']);
            assert.deepEqual(result, []);
        });

        it('should call checkAbuseIPDB when provider is abuseipdb', async () => {
            context.set_ipReputationProvider('abuseipdb');
            context.checkAbuseIPDB = async (ip) => {
                return ip === '8.8.8.8';
            };

            const result = await context.checkIPReputation(['from a.com (8.8.8.8)', 'from b.com (1.1.1.1)']);
            assert.deepEqual(result, ['8.8.8.8']);
        });

        it('should call checkVirusTotalIP when provider is virustotal', async () => {
            context.set_ipReputationProvider('virustotal');
            context.checkVirusTotalIP = async (ip) => {
                return ip === '9.9.9.9';
            };

            const result = await context.checkIPReputation(['from a.com (8.8.8.8)', 'from c.com (9.9.9.9)']);
            assert.deepEqual(result, ['9.9.9.9']);
        });

        it('should use the cache for repeated IP checks', async () => {
            context.set_ipReputationProvider('abuseipdb');
            let apiCallCount = 0;
            context.checkAbuseIPDB = async (ip) => {
                apiCallCount++;
                return ip === '8.8.8.8';
            };

            // First call
            let result1 = await context.checkIPReputation(['from a.com (8.8.8.8)']);
            assert.strictEqual(apiCallCount, 1);
            assert.deepEqual(result1, ['8.8.8.8']);

            // Second call
            let result2 = await context.checkIPReputation(['from a.com (8.8.8.8)']);
            assert.strictEqual(apiCallCount, 1); // Should be cached
            assert.deepEqual(result2, ['8.8.8.8']);

            // Flood cache
            for (let i = 0; i < context.MAX_IP_CACHE + 10; i++) {
                let octet2 = Math.floor(i / (256 * 256));
                let octet3 = Math.floor((i % (256 * 256)) / 256);
                let octet4 = i % 256;
                let ip = `100.${octet2}.${octet3}.${octet4}`;
                await context.checkIPReputation([`from a.com (${ip})`]);
            }
            // Max cache should be respected
            assert.strictEqual(context.ipReputationCache.size, context.MAX_IP_CACHE);
        });

        it('should handle errors thrown by checkAbuseIPDB gracefully', async () => {
            const originalConsoleError = context.console.error;
            let errorLogged = false;
            context.console.error = () => { errorLogged = true; };

            context.set_ipReputationProvider('abuseipdb');
            context.checkAbuseIPDB = async () => {
                throw new Error("Mocked checkAbuseIPDB error");
            };

            const result = await context.checkIPReputation(['from a.com (8.8.8.8)']);
            assert.deepEqual(result, []); // Should return empty array, ignoring the error
            assert.strictEqual(errorLogged, true); // Error should be logged

            context.console.error = originalConsoleError;
        });

        it('should handle errors thrown by checkVirusTotalIP gracefully', async () => {
            const originalConsoleError = context.console.error;
            let errorLogged = false;
            context.console.error = () => { errorLogged = true; };

            context.set_ipReputationProvider('virustotal');
            context.checkVirusTotalIP = async () => {
                throw new Error("Mocked checkVirusTotalIP error");
            };

            const result = await context.checkIPReputation(['from a.com (9.9.9.9)']);
            assert.deepEqual(result, []); // Should return empty array, ignoring the error
            assert.strictEqual(errorLogged, true); // Error should be logged

            context.console.error = originalConsoleError;
        });
    });

    describe('checkURLhausDomains', () => {
        let originalCheckURLhaus;

        beforeEach(() => {
            originalCheckURLhaus = context.checkURLhaus;
            vm.runInContext('urlhausApikey = "test-key";', context);
        });

        afterEach(() => {
            context.checkURLhaus = originalCheckURLhaus;
            vm.runInContext('urlhausApikey = "";', context);
        });

        it('ignores invalid URLs without throwing an error', async () => {
            context.checkURLhaus = async (domain, apikey) => {
                return false;
            };

            const invalidUrl = 'not-a-valid-url';
            const validUrl = 'http://example.com';

            const result = await context.checkURLhausDomains([invalidUrl, validUrl]);
            assert.strictEqual(result.length, 0);
        });

        it('returns malicious domains for valid URLs', async () => {
            context.checkURLhaus = async (domain, apikey) => {
                return domain === 'bad.com';
            };

            const result = await context.checkURLhausDomains(['http://bad.com', 'http://good.com']);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0], 'bad.com');
        });

        it('should use the cache for repeated domain checks', async () => {
            let apiCallCount = 0;
            context.checkURLhaus = async (domain, apikey) => {
                apiCallCount++;
                return domain === 'bad.com';
            };

            // First call should increment apiCallCount
            let result1 = await context.checkURLhausDomains(['http://bad.com']);
            assert.strictEqual(apiCallCount, 1);
            assert.strictEqual(result1.length, 1);

            // Second call with the same domain should use cache, apiCallCount should remain 1
            let result2 = await context.checkURLhausDomains(['http://bad.com']);
            assert.strictEqual(apiCallCount, 1);
            assert.strictEqual(result2.length, 1);

            // Ensure cache size is respected
            for (let i = 0; i < context.MAX_URLHAUS_CACHE_SIZE + 10; i++) {
                await context.checkURLhausDomains([`http://domain${i}.com`]);
            }
            assert.strictEqual(context.urlhausCache.size, context.MAX_URLHAUS_CACHE_SIZE);
        });
    });

    describe('getSharedDB', () => {
        let originalOpenDB;

        beforeEach(() => {
            originalOpenDB = context.openDB;
            if (context.reset_sharedDBPromise) context.reset_sharedDBPromise();
        });

        afterEach(() => {
            context.openDB = originalOpenDB;
            if (context.reset_sharedDBPromise) context.reset_sharedDBPromise();
        });

        it('initializes and caches sharedDBPromise singleton', async () => {
            let openDBCalls = 0;
            const fakeDB = { name: 'fakeDB' };
            context.openDB = (name, version) => {
                openDBCalls++;
                assert.strictEqual(name, 'thunderbird_av');
                assert.strictEqual(version, 3);
                return Promise.resolve(fakeDB);
            };

            const p1 = context.getSharedDB();
            const p2 = context.getSharedDB();

            assert.strictEqual(p1, p2, 'Expected getSharedDB to return the exact same promise instance');
            assert.strictEqual(openDBCalls, 1, 'Expected openDB to be called exactly once');

            const db = await p1;
            assert.strictEqual(db, fakeDB);
        });

        it('calls openDB again if sharedDBPromise is reset', async () => {
            let openDBCalls = 0;
            context.openDB = () => {
                openDBCalls++;
                return Promise.resolve({});
            };

            const p1 = context.getSharedDB();
            assert.strictEqual(openDBCalls, 1);

            context.reset_sharedDBPromise();

            const p2 = context.getSharedDB();
            assert.strictEqual(openDBCalls, 2);
            assert.notStrictEqual(p1, p2);
        });
    });

    describe('IndexedDB Catch Blocks', () => {
        let originalConsoleError;
        let originalOpenDB;

        beforeEach(() => {
            originalConsoleError = context.console.error;
            originalOpenDB = context.openDB;
        });

        afterEach(() => {
            context.console.error = originalConsoleError;
            context.openDB = originalOpenDB;
            vm.runInContext('globalThis.sharedDBPromise = null;', context);
        });

        it('tests catch block in indexedDB_save_links_objects_to_db', async () => {
            let errorLogged = null;
            context.console.error = (msg, err) => {
                errorLogged = { msg, err };
            };

            // Mock openDB to throw
            vm.runInContext('globalThis.sharedDBPromise = null;', context);
            vm.runInContext('globalThis.openDB = async () => { throw new Error("Mock DB Error"); };', context);

            await context.indexedDB_save_links_objects_to_db({ headerMessageId: '123' }, [{ url: 'http://test.com' }]);

            assert.ok(errorLogged, 'Expected console.error to be called');
            assert.strictEqual(errorLogged.msg, 'IndexedDB (Links) Save Error:');
            assert.strictEqual(errorLogged.err.message, 'Mock DB Error');
        });

        it('tests catch block in indexedDB_save_links_to_db', async () => {
            let errorLogged = null;
            context.console.error = (msg, err) => {
                errorLogged = { msg, err };
            };

            // Mock openDB to throw
            vm.runInContext('globalThis.sharedDBPromise = null;', context);
            vm.runInContext('globalThis.openDB = async () => { throw new Error("Mock DB Error 2"); };', context);

            await context.indexedDB_save_links_to_db({ headerMessageId: '123' }, ['http://test.com']);

            assert.ok(errorLogged, 'Expected console.error to be called');
            assert.strictEqual(errorLogged.msg, 'Fehler bei der URL-Speicherung in der Datenbank:');
            assert.strictEqual(errorLogged.err.message, 'Mock DB Error 2');
        });
    });

    describe('evaluateAuthHeaders', () => {
        it('should return neutral and unchanged score for empty or null headers', () => {
            let reasons = [];
            let result = context.evaluateAuthHeaders(null, 10, reasons);
            assert.strictEqual(result.authStatus, 'neutral');
            assert.strictEqual(result.score, 10);
            assert.strictEqual(reasons.length, 0);

            result = context.evaluateAuthHeaders([], 20, reasons);
            assert.strictEqual(result.authStatus, 'neutral');
            assert.strictEqual(result.score, 20);
            assert.strictEqual(reasons.length, 0);
        });

        it('should return fail and increase score for a single failure (SPF)', () => {
            let reasons = [];
            const result = context.evaluateAuthHeaders(["Authentication-Results: mx.example.com; spf=fail"], 0, reasons);
            assert.strictEqual(result.authStatus, 'fail');
            assert.strictEqual(result.score, 25);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('SPF-Prüfung fehlgeschlagen'));
        });

        it('should handle multiple failures and increase score for each', () => {
            let reasons = [];
            const headers = [
                "Authentication-Results: mx.example.com; spf=softfail",
                "Authentication-Results: mx.example.com; dkim=fail header.i=@example.com"
            ];
            const result = context.evaluateAuthHeaders(headers, 10, reasons);
            assert.strictEqual(result.authStatus, 'fail');
            assert.strictEqual(result.score, 60); // 10 + 25 (spf) + 25 (dkim)
            assert.strictEqual(reasons.length, 2);
        });

        it('should return pass if SPF, DKIM, and DMARC all pass', () => {
            let reasons = [];
            const headers = [
                "Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=example.com;",
                " dkim=pass header.i=@example.com;",
                " dmarc=pass"
            ];
            const result = context.evaluateAuthHeaders(headers, 0, reasons);
            assert.strictEqual(result.authStatus, 'pass');
            assert.strictEqual(result.score, 0);
            assert.strictEqual(reasons.length, 0);
        });

        it('should return neutral for partial passes without any failures', () => {
            let reasons = [];
            const headers = [
                "Authentication-Results: mx.example.com; spf=pass",
                " dkim=pass"
                // Missing dmarc=pass
            ];
            const result = context.evaluateAuthHeaders(headers, 0, reasons);
            assert.strictEqual(result.authStatus, 'neutral');
            assert.strictEqual(result.score, 0);
            assert.strictEqual(reasons.length, 0);
        });

        it('should handle case insensitivity correctly', () => {
            let reasons = [];
            const headers = ["Authentication-Results: mx.example.com; SPF=FAIL"];
            const result = context.evaluateAuthHeaders(headers, 0, reasons);
            assert.strictEqual(result.authStatus, 'fail');
            assert.strictEqual(result.score, 25);
        });
    });

    describe('checkFirstCommunication', () => {
        let originalQuery;

        beforeEach(() => {
            originalQuery = context.browser.messages.query;
            context.knownSendersCache.clear();
            context.browser.storage.local.get = async () => ({});
            context.browser.storage.local.set = async () => {};
        });

        afterEach(() => {
            context.browser.messages.query = originalQuery;
        });

        it('returns null (unknown) if the messages API is not available', async () => {
            context.browser.messages.query = undefined;
            const result = await context.checkFirstCommunication('test@example.com');
            assert.strictEqual(result, null);
        });

        it('returns null when the query fails, so the score does not guess', async () => {
            context.browser.messages.query = async () => {
                throw new Error('folderId is required');
            };
            const result = await context.checkFirstCommunication('failing@example.com');
            assert.strictEqual(result, null);
        });

        it('returns false and does not query if the sender is already known', async () => {
            context.knownSendersCache.add('known@example.com');
            let queryCalled = false;
            context.browser.messages.query = async () => {
                queryCalled = true;
                return { messages: [] };
            };
            const result = await context.checkFirstCommunication('known@example.com');
            assert.strictEqual(result, false);
            assert.strictEqual(queryCalled, false);
        });

        it('queries messages FROM the sender (not to the sender)', async () => {
            let queriedInfo = null;
            context.browser.messages.query = async (queryInfo) => {
                queriedInfo = queryInfo;
                return { messages: [] };
            };

            const result = await context.checkFirstCommunication('new@example.com');

            assert.strictEqual(result, true);
            assert.strictEqual(queriedInfo.from, 'new@example.com');
            assert.strictEqual(queriedInfo.to, undefined);
        });

        it('stores unknown senders persistently so restarts do not reset them', async () => {
            let stored = null;
            context.browser.storage.local.set = async (data) => { stored = data; };
            context.browser.messages.query = async () => ({ messages: [] });

            await context.checkFirstCommunication('persist@example.com');

            assert.ok(stored && Array.isArray(stored.knownSenders));
            assert.ok(stored.knownSenders.includes('persist@example.com'));
        });

        it('treats a persisted sender as known', async () => {
            context.browser.storage.local.get = async () => ({ knownSenders: ['stored@example.com'] });
            let queryCalled = false;
            context.browser.messages.query = async () => { queryCalled = true; return { messages: [] }; };

            const result = await context.checkFirstCommunication('stored@example.com');

            assert.strictEqual(result, false);
            assert.strictEqual(queryCalled, false);
        });

        it('returns false when previous messages exist', async () => {
            context.browser.messages.query = async () => ({ messages: [{ id: 1 }] });
            const result = await context.checkFirstCommunication('old@example.com');
            assert.strictEqual(result, false);
            assert.strictEqual(context.knownSendersCache.has('old@example.com'), true);
        });
    });

    describe('evaluateAndInjectThreats and helpers', () => {
        it('extractBecProtectionData extracts senderEmail, firstComm, replyTo, and subject', async () => {
            const originalQuery = context.browser.messages.query;
            context.browser.messages.query = async () => ({ messages: [] });
            try {
                const message = { author: 'Alice <alice@example.com>', subject: 'Test Subject' };
                const fullMessage = { headers: { 'reply-to': ['reply@example.com'] } };
                const res = await context.extractBecProtectionData(message, fullMessage);
                assert.strictEqual(res.senderEmail, 'alice@example.com');
                assert.strictEqual(res.subject, 'Test Subject');
                assert.strictEqual(res.replyTo, 'reply@example.com');
                assert.strictEqual(res.isFirstCommunication, true);
            } finally {
                context.browser.messages.query = originalQuery;
            }
        });

        it('collectThreatEvaluationOptions aggregates options correctly', async () => {
            const message = { author: 'Bob <bob@example.com>', subject: 'Urgent' };
            const fullMessage = { headers: { 'authentication-results': ['spf=pass'], 'received': [] } };
            const options = await context.collectThreatEvaluationOptions({
                message,
                fullMessage,
                filteredUrls: [],
                messageText: 'Hello',
                parsedUrlCache: new Map()
            });
            assert.deepStrictEqual(options.authHeaders, ['spf=pass']);
            assert.strictEqual(options.subject, 'Urgent');
            assert.strictEqual(options.messageText, 'Hello');
        });
    });

    describe('extractTextFromParts', () => {
        it('extracts text from plain text parts', () => {
            const part = { contentType: 'text/plain', body: 'Hello World' };
            assert.strictEqual(context.extractTextFromParts(part), 'Hello World ');
        });

        it('extracts text from HTML parts', () => {
            const part = { contentType: 'text/html', body: '<b>Hello</b> World' };
            assert.strictEqual(context.extractTextFromParts(part), '<b>Hello</b> World ');
        });

        it('ignores parts that are not text/plain or text/html', () => {
            const part = { contentType: 'image/png', body: 'base64data' };
            assert.strictEqual(context.extractTextFromParts(part), '');
        });

        it('handles parts with missing body safely', () => {
            const part = { contentType: 'text/plain' }; // no body
            assert.strictEqual(context.extractTextFromParts(part), '');
        });

        it('recursively extracts text from nested subparts', () => {
            const part = {
                contentType: 'multipart/alternative',
                parts: [
                    { contentType: 'text/plain', body: 'Part 1' },
                    {
                        contentType: 'multipart/mixed',
                        parts: [
                            { contentType: 'image/jpeg', body: 'ignored' },
                            { contentType: 'text/html', body: 'Part 2' }
                        ]
                    }
                ]
            };
            assert.strictEqual(context.extractTextFromParts(part), 'Part 1 Part 2 ');
        });
    });

    describe('disarmHTML', () => {
        it('removes script tags and their content', () => {
            const input = '<html><body><h1>Test</h1><script>alert(1);</script></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('<script>'), 'Script tag should be removed');
            assert.ok(!result.includes('alert(1)'), 'Script content should be removed');
            assert.ok(result.includes('Test'), 'Safe content should remain');
        });

        it('removes inline event handlers', () => {
            const input = '<html><body><button onclick="evil()">Click</button></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('onclick'), 'onclick attribute should be removed');
            assert.ok(!result.includes('evil()'), 'Event handler content should be removed');
            assert.ok(result.includes('<button>Click</button>'), 'Button element should remain');
        });

        it('removes javascript URIs', () => {
            const input = '<html><body><a href="javascript:alert(1)">Link</a><a href="http://safe.com">Safe</a></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('javascript:'), 'javascript URI should be removed');
            const sanitizedDom = new (new JSDOM()).window.DOMParser().parseFromString(result, 'text/html');
            const hrefs = Array.from(sanitizedDom.querySelectorAll('a'))
                .map((a) => a.getAttribute('href'))
                .filter(Boolean);
            const hasSafeHost = hrefs.some((href) => {
                try {
                    return new URL(href).hostname === 'safe.com';
                } catch {
                    return false;
                }
            });
            assert.ok(hasSafeHost, 'Safe URI host should remain');
        });

        it('removes object, embed, iframe', () => {
            const input = '<html><body><object data="evil.swf"></object><embed src="evil.swf"></embed><iframe src="evil.html"></iframe></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('object'), 'object should be removed');
            assert.ok(!result.includes('embed'), 'embed should be removed');
            assert.ok(!result.includes('iframe'), 'iframe should be removed');
        });

        it('prevents javascript URI evasion', () => {
            const input = '<html><body><a href="java\tscript:alert(1)">Link</a><a href="jav&#x09;ascript:alert(1)">Link2</a><a href=" java&#x00;script:alert(1)">Link3</a><a href="javascript&#x3A;alert(1)">Link4</a><a href="java&#x200B;script:alert(1)">Link5</a><a href="java&#xA0;script:alert(1)">Link6</a></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('javascript:'), 'evaded javascript URI should be removed');
        });

        it('removes data and vbscript URIs', () => {
            const input = '<html><body><a href="data:text/html,<script>alert(1)</script>">Data Link</a><img src="vbscript:msgbox(\'hello\')"></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('data:'), 'data URI should be removed');
            assert.ok(!result.includes('vbscript:'), 'vbscript URI should be removed');
        });

        it('removes base and meta tags', () => {
            const input = '<html><head><base href="http://evil.com"><meta http-equiv="refresh" content="0;url=javascript:alert(1)"></head><body></body></html>';
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('<base'), 'base tag should be removed');
            assert.ok(!result.includes('<meta'), 'meta tag should be removed');
        });

        it('sanitizes action, formaction, and xlink:href attributes', () => {
            const input = `<html><body>
                <form action="javascript:alert(1)"><input type="submit"></form>
                <button formaction="data:text/html,<script>alert(1)</script>">Click</button>
                <svg><use xlink:href="javascript:alert(1)"></use></svg>
            </body></html>`;
            const result = context.disarmHTML(input);
            assert.ok(!result.includes('javascript:'), 'javascript URI should be removed from action/xlink:href');
            assert.ok(!result.includes('data:'), 'data URI should be removed from formaction');
            assert.ok(!result.includes('action="javascript'), 'action attribute should be removed/sanitized');
        });

        it('prevents mXSS bypasses using template, math, svg, and noscript', () => {
            const templateInput = '<html><body><template><script>alert(1)</script><a href="javascript:alert(1)">X</a></template></body></html>';
            const templateResult = context.disarmHTML(templateInput);
            assert.ok(!templateResult.includes('<script>'), 'script tag inside template should be removed');
            assert.ok(!templateResult.includes('javascript:'), 'javascript URI inside template should be removed');

            const nestedTemplateInput = '<template><template><script>alert(1)</script></template></template>';
            const nestedTemplateResult = context.disarmHTML(nestedTemplateInput);
            assert.ok(!nestedTemplateResult.includes('<script>'), 'script tag inside nested template should be removed');

            const mathInput = '<math><script>alert(1)</script></math>';
            const mathResult = context.disarmHTML(mathInput);
            assert.ok(!mathResult.includes('math'), 'math tag should be removed');
            assert.ok(!mathResult.includes('script'), 'script tag inside math should be removed');

            const svgInput = '<svg><script>alert(1)</script></svg>';
            const svgResult = context.disarmHTML(svgInput);
            assert.ok(!svgResult.includes('svg'), 'svg tag should be removed');
            assert.ok(!svgResult.includes('script'), 'script tag inside svg should be removed');

            const noscriptInput = '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>';
            const noscriptResult = context.disarmHTML(noscriptInput);
            assert.ok(!noscriptResult.includes('<noscript>'), 'noscript tag should be removed');
        });
    });

    describe('checkLists', () => {
        beforeEach(() => {
            vm.runInContext('customBlacklist = new Set(); customWhitelist = new Set();', context);
        });

        it('returns null if lists are empty or undefined', () => {
            assert.strictEqual(context.checkLists('test@example.com', 'example.com'), null);
            vm.runInContext('customBlacklist = undefined; customWhitelist = undefined;', context);
            assert.strictEqual(context.checkLists('test@example.com', 'example.com'), null);
        });

        it('matches exact email on blacklist', () => {
            vm.runInContext('customBlacklist = new Set(["attacker@bad.com"]);', context);
            const result = context.checkLists('attacker@bad.com', 'bad.com');
            assert.ok(result);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.listType, 'blacklist');
            assert.strictEqual(result.reasons[0], 'Absender-E-Mail (attacker@bad.com) steht auf der Blacklist.');
        });

        it('matches exact domain on blacklist', () => {
            vm.runInContext('customBlacklist = new Set(["bad.com"]);', context);
            const result = context.checkLists('test@bad.com', 'bad.com');
            assert.ok(result);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.listType, 'blacklist');
            assert.strictEqual(result.reasons[0], 'Absender-Domain (bad.com) steht auf der Blacklist (bad.com).');
        });

        it('matches subdomain on blacklist', () => {
            vm.runInContext('customBlacklist = new Set(["bad.com"]);', context);
            const result = context.checkLists('test@sub.bad.com', 'sub.bad.com');
            assert.ok(result);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.listType, 'blacklist');
            assert.strictEqual(result.reasons[0], 'Absender-Domain (sub.bad.com) steht auf der Blacklist (bad.com).');
        });

        it('matches exact email on whitelist', () => {
            vm.runInContext('customWhitelist = new Set(["friend@good.com"]);', context);
            const result = context.checkLists('friend@good.com', 'good.com');
            assert.ok(result);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.listType, 'whitelist');
            assert.strictEqual(result.reasons[0], 'Absender-E-Mail (friend@good.com) steht auf der Whitelist.');
        });

        it('matches exact domain on whitelist', () => {
            vm.runInContext('customWhitelist = new Set(["good.com"]);', context);
            const result = context.checkLists('test@good.com', 'good.com');
            assert.ok(result);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.listType, 'whitelist');
            assert.strictEqual(result.reasons[0], 'Absender-Domain (good.com) steht auf der Whitelist (good.com).');
        });

        it('matches subdomain on whitelist', () => {
            vm.runInContext('customWhitelist = new Set(["good.com"]);', context);
            const result = context.checkLists('test@sub.good.com', 'sub.good.com');
            assert.ok(result);
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.listType, 'whitelist');
            assert.strictEqual(result.reasons[0], 'Absender-Domain (sub.good.com) steht auf der Whitelist (good.com).');
        });

        it('prioritizes blacklist over whitelist if both match', () => {
            vm.runInContext('customBlacklist = new Set(["example.com"]); customWhitelist = new Set(["example.com"]);', context);
            const result = context.checkLists('test@example.com', 'example.com');
            assert.ok(result);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.listType, 'blacklist');
        });

        it('returns null if no matches in non-empty lists', () => {
            vm.runInContext('customBlacklist = new Set(["bad.com"]); customWhitelist = new Set(["good.com"]);', context);
            assert.strictEqual(context.checkLists('test@example.com', 'example.com'), null);
        });
    });

    describe('extractPublicIPs', () => {
        it('should return empty array for null/undefined/empty headers', () => {
            assert.deepEqual(context.extractPublicIPs(null), []);
            assert.deepEqual(context.extractPublicIPs(undefined), []);
            assert.deepEqual(context.extractPublicIPs([]), []);
        });

        it('should filter out private and local IPs', () => {
            const headers = [
                "Received: from 10.0.0.1 (localhost [127.0.0.1])",
                "Received: from 172.16.0.5 by 192.168.1.100",
                "Received: from 0.0.0.0 or 169.254.1.2"
            ];
            assert.strictEqual(context.extractPublicIPs(headers).length, 0);
        });

        it('should extract public IPs correctly', () => {
            const headers = [
                "Received: from mx.google.com (8.8.8.8)",
                "Received: from unknown (1.1.1.1) by 8.8.4.4"
            ];
            const ips = context.extractPublicIPs(headers);
            assert.strictEqual(ips.length, 3);
            assert.ok(ips.includes('8.8.8.8'));
            assert.ok(ips.includes('1.1.1.1'));
            assert.ok(ips.includes('8.8.4.4'));
        });

        it('should return unique public IPs when there are duplicates', () => {
            const headers = [
                "Received: from 8.8.8.8 by 8.8.8.8",
                "Received: from 9.9.9.9 and 8.8.8.8"
            ];
            const ips = context.extractPublicIPs(headers);
            assert.strictEqual(ips.length, 2);
            assert.ok(ips.includes('8.8.8.8'));
            assert.ok(ips.includes('9.9.9.9'));
        });

        it('should ignore non-IP numbers', () => {
            const headers = [
                "Received: id 12345.6789 by 9.9.9.9 version 1.2.3"
            ];
            const ips = context.extractPublicIPs(headers);
            assert.strictEqual(ips.length, 1);
            assert.strictEqual(ips[0], '9.9.9.9');
        });
    });


    describe('checkIPReputation', () => {
        let originalCheckAbuseIPDB;
        let originalCheckVirusTotalIP;

        beforeEach(() => {
            originalCheckAbuseIPDB = context.checkAbuseIPDB;
            originalCheckVirusTotalIP = context.checkVirusTotalIP;
            context.set_ipReputationApiKey('test-key');
        });

        afterEach(() => {
            context.checkAbuseIPDB = originalCheckAbuseIPDB;
            context.checkVirusTotalIP = originalCheckVirusTotalIP;
            context.set_ipReputationProvider('none');
            context.set_ipReputationApiKey('');
        });

        it('should return empty array if provider is none', async () => {
            context.set_ipReputationProvider('none');
            const result = await context.checkIPReputation(['from mx.google.com (1.2.3.4)']);
            assert.deepEqual(result, []);
        });

        it('should return empty array if api key is missing', async () => {
            context.set_ipReputationProvider('abuseipdb');
            context.set_ipReputationApiKey('');
            const result = await context.checkIPReputation(['from mx.google.com (1.2.3.4)']);
            assert.deepEqual(result, []);
        });

        it('should call checkAbuseIPDB when provider is abuseipdb', async () => {
            context.set_ipReputationProvider('abuseipdb');
            context.checkAbuseIPDB = async (ip) => {
                return ip === '8.8.8.8';
            };

            const result = await context.checkIPReputation(['from a.com (8.8.8.8)', 'from b.com (1.1.1.1)']);
            assert.deepEqual(result, ['8.8.8.8']);
        });

        it('should call checkVirusTotalIP when provider is virustotal', async () => {
            context.set_ipReputationProvider('virustotal');
            context.checkVirusTotalIP = async (ip) => {
                return ip === '9.9.9.9';
            };

            const result = await context.checkIPReputation(['from a.com (8.8.8.8)', 'from c.com (9.9.9.9)']);
            assert.deepEqual(result, ['9.9.9.9']);
        });

        it('should use the cache for repeated IP checks', async () => {
            context.set_ipReputationProvider('abuseipdb');
            let apiCallCount = 0;
            context.checkAbuseIPDB = async (ip) => {
                apiCallCount++;
                return ip === '8.8.8.8';
            };

            // First call
            let result1 = await context.checkIPReputation(['from a.com (8.8.8.8)']);
            assert.strictEqual(apiCallCount, 1);
            assert.deepEqual(result1, ['8.8.8.8']);

            // Second call
            let result2 = await context.checkIPReputation(['from a.com (8.8.8.8)']);
            assert.strictEqual(apiCallCount, 1); // Should be cached
            assert.deepEqual(result2, ['8.8.8.8']);

            // Flood cache
            for (let i = 0; i < context.MAX_IP_CACHE + 10; i++) {
                let octet2 = Math.floor(i / (256 * 256));
                let octet3 = Math.floor((i % (256 * 256)) / 256);
                let octet4 = i % 256;
                let ip = `100.${octet2}.${octet3}.${octet4}`;
                await context.checkIPReputation([`from a.com (${ip})`]);
            }
            // Max cache should be respected
            assert.strictEqual(context.ipReputationCache.size, context.MAX_IP_CACHE);
        });

        it('should handle errors thrown by checkAbuseIPDB gracefully', async () => {
            const originalConsoleError = context.console.error;
            let errorLogged = false;
            context.console.error = () => { errorLogged = true; };

            context.set_ipReputationProvider('abuseipdb');
            context.checkAbuseIPDB = async () => {
                throw new Error("Mocked checkAbuseIPDB error");
            };

            const result = await context.checkIPReputation(['from a.com (8.8.8.8)']);
            assert.deepEqual(result, []); // Should return empty array, ignoring the error
            assert.strictEqual(errorLogged, true); // Error should be logged

            context.console.error = originalConsoleError;
        });

        it('should handle errors thrown by checkVirusTotalIP gracefully', async () => {
            const originalConsoleError = context.console.error;
            let errorLogged = false;
            context.console.error = () => { errorLogged = true; };

            context.set_ipReputationProvider('virustotal');
            context.checkVirusTotalIP = async () => {
                throw new Error("Mocked checkVirusTotalIP error");
            };

            const result = await context.checkIPReputation(['from a.com (9.9.9.9)']);
            assert.deepEqual(result, []); // Should return empty array, ignoring the error
            assert.strictEqual(errorLogged, true); // Error should be logged

            context.console.error = originalConsoleError;
        });
    });

    describe('checkURLhausDomains', () => {
        let originalCheckURLhaus;

        beforeEach(() => {
            originalCheckURLhaus = context.checkURLhaus;
            vm.runInContext('urlhausApikey = "test-key";', context);
        });

        afterEach(() => {
            context.checkURLhaus = originalCheckURLhaus;
            vm.runInContext('urlhausApikey = "";', context);
        });

        it('ignores invalid URLs without throwing an error', async () => {
            context.checkURLhaus = async (domain, apikey) => {
                return false;
            };

            const invalidUrl = 'not-a-valid-url';
            const validUrl = 'http://example.com';

            const result = await context.checkURLhausDomains([invalidUrl, validUrl]);
            assert.strictEqual(result.length, 0);
        });

        it('returns malicious domains for valid URLs', async () => {
            context.checkURLhaus = async (domain, apikey) => {
                return domain === 'bad.com';
            };

            const result = await context.checkURLhausDomains(['http://bad.com', 'http://good.com']);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0], 'bad.com');
        });

        it('should use the cache for repeated domain checks', async () => {
            let apiCallCount = 0;
            context.checkURLhaus = async (domain, apikey) => {
                apiCallCount++;
                return domain === 'bad.com';
            };

            // First call should increment apiCallCount
            let result1 = await context.checkURLhausDomains(['http://bad.com']);
            assert.strictEqual(apiCallCount, 1);
            assert.strictEqual(result1.length, 1);

            // Second call with the same domain should use cache, apiCallCount should remain 1
            let result2 = await context.checkURLhausDomains(['http://bad.com']);
            assert.strictEqual(apiCallCount, 1);
            assert.strictEqual(result2.length, 1);

            // Ensure cache size is respected
            for (let i = 0; i < context.MAX_URLHAUS_CACHE_SIZE + 10; i++) {
                await context.checkURLhausDomains([`http://domain${i}.com`]);
            }
            assert.strictEqual(context.urlhausCache.size, context.MAX_URLHAUS_CACHE_SIZE);
        });
    });

    describe('getSharedDB', () => {
        let originalOpenDB;

        beforeEach(() => {
            originalOpenDB = context.openDB;
            if (context.reset_sharedDBPromise) context.reset_sharedDBPromise();
        });

        afterEach(() => {
            context.openDB = originalOpenDB;
            if (context.reset_sharedDBPromise) context.reset_sharedDBPromise();
        });

        it('initializes and caches sharedDBPromise singleton', async () => {
            let openDBCalls = 0;
            const fakeDB = { name: 'fakeDB' };
            context.openDB = (name, version) => {
                openDBCalls++;
                assert.strictEqual(name, 'thunderbird_av');
                assert.strictEqual(version, 3);
                return Promise.resolve(fakeDB);
            };

            const p1 = context.getSharedDB();
            const p2 = context.getSharedDB();

            assert.strictEqual(p1, p2, 'Expected getSharedDB to return the exact same promise instance');
            assert.strictEqual(openDBCalls, 1, 'Expected openDB to be called exactly once');

            const db = await p1;
            assert.strictEqual(db, fakeDB);
        });

        it('calls openDB again if sharedDBPromise is reset', async () => {
            let openDBCalls = 0;
            context.openDB = () => {
                openDBCalls++;
                return Promise.resolve({});
            };

            const p1 = context.getSharedDB();
            assert.strictEqual(openDBCalls, 1);

            context.reset_sharedDBPromise();

            const p2 = context.getSharedDB();
            assert.strictEqual(openDBCalls, 2);
            assert.notStrictEqual(p1, p2);
        });
    });

    describe('IndexedDB Catch Blocks', () => {
        let originalConsoleError;
        let originalOpenDB;

        beforeEach(() => {
            originalConsoleError = context.console.error;
            originalOpenDB = context.openDB;
        });

        afterEach(() => {
            context.console.error = originalConsoleError;
            context.openDB = originalOpenDB;
            vm.runInContext('globalThis.sharedDBPromise = null;', context);
        });

        it('tests catch block in indexedDB_save_links_objects_to_db', async () => {
            let errorLogged = null;
            context.console.error = (msg, err) => {
                errorLogged = { msg, err };
            };

            // Mock openDB to throw
            vm.runInContext('globalThis.sharedDBPromise = null;', context);
            vm.runInContext('globalThis.openDB = async () => { throw new Error("Mock DB Error"); };', context);

            await context.indexedDB_save_links_objects_to_db({ headerMessageId: '123' }, [{ url: 'http://test.com' }]);

            assert.ok(errorLogged, 'Expected console.error to be called');
            assert.strictEqual(errorLogged.msg, 'IndexedDB (Links) Save Error:');
            assert.strictEqual(errorLogged.err.message, 'Mock DB Error');
        });

        it('tests catch block in indexedDB_save_links_to_db', async () => {
            let errorLogged = null;
            context.console.error = (msg, err) => {
                errorLogged = { msg, err };
            };

            // Mock openDB to throw
            vm.runInContext('globalThis.sharedDBPromise = null;', context);
            vm.runInContext('globalThis.openDB = async () => { throw new Error("Mock DB Error 2"); };', context);

            await context.indexedDB_save_links_to_db({ headerMessageId: '123' }, ['http://test.com']);

            assert.ok(errorLogged, 'Expected console.error to be called');
            assert.strictEqual(errorLogged.msg, 'Fehler bei der URL-Speicherung in der Datenbank:');
            assert.strictEqual(errorLogged.err.message, 'Mock DB Error 2');
        });
    });

    describe('evaluateAuthHeaders', () => {
        it('should return neutral and unchanged score for empty or null headers', () => {
            let reasons = [];
            let result = context.evaluateAuthHeaders(null, 10, reasons);
            assert.strictEqual(result.authStatus, 'neutral');
            assert.strictEqual(result.score, 10);
            assert.strictEqual(reasons.length, 0);

            result = context.evaluateAuthHeaders([], 20, reasons);
            assert.strictEqual(result.authStatus, 'neutral');
            assert.strictEqual(result.score, 20);
            assert.strictEqual(reasons.length, 0);
        });

        it('should return fail and increase score for a single failure (SPF)', () => {
            let reasons = [];
            const result = context.evaluateAuthHeaders(["Authentication-Results: mx.example.com; spf=fail"], 0, reasons);
            assert.strictEqual(result.authStatus, 'fail');
            assert.strictEqual(result.score, 25);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('SPF-Prüfung fehlgeschlagen'));
        });

        it('should handle multiple failures and increase score for each', () => {
            let reasons = [];
            const headers = [
                "Authentication-Results: mx.example.com; spf=softfail",
                "Authentication-Results: mx.example.com; dkim=fail header.i=@example.com"
            ];
            const result = context.evaluateAuthHeaders(headers, 10, reasons);
            assert.strictEqual(result.authStatus, 'fail');
            assert.strictEqual(result.score, 60); // 10 + 25 (spf) + 25 (dkim)
            assert.strictEqual(reasons.length, 2);
        });

        it('should return pass if SPF, DKIM, and DMARC all pass', () => {
            let reasons = [];
            const headers = [
                "Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=example.com;",
                " dkim=pass header.i=@example.com;",
                " dmarc=pass"
            ];
            const result = context.evaluateAuthHeaders(headers, 0, reasons);
            assert.strictEqual(result.authStatus, 'pass');
            assert.strictEqual(result.score, 0);
            assert.strictEqual(reasons.length, 0);
        });

        it('should return neutral for partial passes without any failures', () => {
            let reasons = [];
            const headers = [
                "Authentication-Results: mx.example.com; spf=pass",
                " dkim=pass"
                // Missing dmarc=pass
            ];
            const result = context.evaluateAuthHeaders(headers, 0, reasons);
            assert.strictEqual(result.authStatus, 'neutral');
            assert.strictEqual(result.score, 0);
            assert.strictEqual(reasons.length, 0);
        });

        it('should handle case insensitivity correctly', () => {
            let reasons = [];
            const headers = ["Authentication-Results: mx.example.com; SPF=FAIL"];
            const result = context.evaluateAuthHeaders(headers, 0, reasons);
            assert.strictEqual(result.authStatus, 'fail');
            assert.strictEqual(result.score, 25);
        });
    });

    describe('handleCheckLinkState', () => {
        let originalFetch;
        let originalConsoleLog;

        beforeEach(() => {
            originalFetch = context.fetch;
            originalConsoleLog = context.console.log;
            context.console.log = () => {};
            context.set_urlscanApikey('');
            context.set_apikey_hybridanalysis('test-key');
        });

    describe('checkHybridAnalysisVerdict', () => {
        let originalFetch;
        let originalOptions;
        let originalApiKey;

        beforeEach(() => {
            originalFetch = context.fetch;
            originalOptions = context.getHybridAnalysisOptions;
            originalApiKey = context.apikey_hybridanalysis;
            context.getHybridAnalysisOptions = () => ({ headers: {} });
        });

        afterEach(() => {
            context.fetch = originalFetch;
            context.getHybridAnalysisOptions = originalOptions;
            context.apikey_hybridanalysis = originalApiKey;
        });

        it('should return fallbackState if apikey_hybridanalysis is missing', async () => {
            context.apikey_hybridanalysis = null;
            const res = await context.checkHybridAnalysisVerdict('hash123', 'UNKNOWN');
            assert.strictEqual(res, 'UNKNOWN');
        });

        it('should return fallbackState if hybrid_sha256 is falsy', async () => {
            context.apikey_hybridanalysis = 'some_key';
            const res = await context.checkHybridAnalysisVerdict(null, 'UNKNOWN');
            assert.strictEqual(res, 'UNKNOWN');
        });

        it('should return CLEAN if verdict is no specific threat', async () => {
            context.apikey_hybridanalysis = 'some_key';
            context.fetch = async (url) => {
                assert.strictEqual(url, 'https://hybrid-analysis.com/api/v2/overview/hash123');
                return {
                    json: async () => ({ verdict: 'no specific threat' })
                };
            };
            const res = await context.checkHybridAnalysisVerdict('hash123', 'UNKNOWN');
            assert.strictEqual(res, 'CLEAN');
        });

        it('should return uppercase verdict if verdict is specific threat', async () => {
            context.apikey_hybridanalysis = 'some_key';
            context.fetch = async () => ({
                json: async () => ({ verdict: 'malicious' })
            });
            const res = await context.checkHybridAnalysisVerdict('hash123', 'UNKNOWN');
            assert.strictEqual(res, 'MALICIOUS');
        });

        it('should return fallbackState if fetch throws an error', async () => {
            context.apikey_hybridanalysis = 'some_key';
            context.fetch = async () => { throw new Error('Network error'); };
            const res = await context.checkHybridAnalysisVerdict('hash123', 'FALLBACK');
            assert.strictEqual(res, 'FALLBACK');
        });

        it('should return fallbackState if verdict is missing in response', async () => {
            context.apikey_hybridanalysis = 'some_key';
            context.fetch = async () => ({
                json: async () => ({ other_field: 'value' })
            });
            const res = await context.checkHybridAnalysisVerdict('hash123', 'FALLBACK');
            assert.strictEqual(res, 'FALLBACK');
        });
    });

    describe('handle_unknown_attachment', () => {
        it('should auto-upload when privacyTier is balanced or max', async () => {
            let fetchCalled = false;
            let appendedData = null;
            context.set_apikey('test-key');
            context.fetch = async (url, options) => {
                fetchCalled = true;
                assert.strictEqual(url, 'https://hybrid-analysis.com/api/v2/quick-scan/file');
                appendedData = options.body;
                return {
                    status: 200,
                    json: async () => ({ submission_id: 'sub_123', job_id: 'job_456', sha256: 'hash_api' })
                };
            };

            const result = await context.handle_unknown_attachment({
                attachment: { name: 'test.pdf', partName: 'part1' },
                content_of_attachment: new ArrayBuffer(8),
                local_hash: 'hash123',
                virustotal_stats: null,
                privacyTier: 'balanced',
                fileType: 'application/pdf'
            });

            assert.strictEqual(fetchCalled, true);
            assert.ok(appendedData);
            assert.deepEqual(result, {
                hybrid_data: {
                    submission_id: 'sub_123',
                    job_id: 'job_456',
                    sha256: 'hash_api',
                    state: 'UPLOADED',
                    partName: 'part1'
                },
                attachmentName: 'test.pdf'
            });
        });

        it('falls back to PENDING_UPLOAD when privacyTier is off or default', async () => {
            const result = await context.handle_unknown_attachment({
                attachment: { name: 'test.pdf', partName: 'part1' },
                content_of_attachment: new ArrayBuffer(8),
                local_hash: 'hash123',
                virustotal_stats: { malicious: 0 },
                privacyTier: 'off'
            });

            assert.deepEqual(result, {
                hybrid_data: {
                    submission_id: 'PENDING_UPLOAD',
                    job_id: 'PENDING_UPLOAD',
                    sha256: 'hash123',
                    state: 'UNKNOWN',
                    partName: 'part1'
                },
                attachmentName: 'test.pdf',
                virustotal_stats: { malicious: 0 }
            });
        });

        it('falls back to PENDING_UPLOAD when API key is missing during auto-upload', async () => {
            context.set_apikey_hybridanalysis(null);
            const result = await context.handle_unknown_attachment({
                attachment: { name: 'test.pdf', partName: 'part1' },
                content_of_attachment: new ArrayBuffer(8),
                local_hash: 'hash123',
                virustotal_stats: { malicious: 1 },
                privacyTier: 'balanced'
            });

            assert.deepEqual(result, {
                hybrid_data: {
                    submission_id: 'PENDING_UPLOAD',
                    job_id: 'PENDING_UPLOAD',
                    sha256: 'hash123',
                    state: 'UNKNOWN',
                    partName: 'part1'
                },
                attachmentName: 'test.pdf',
                virustotal_stats: { malicious: 1 }
            });
        });

        it('falls back to PENDING_UPLOAD when auto-upload fetch fails or throws', async () => {
            context.set_apikey('test-key');
            context.fetch = async () => ({ status: 500 });

            const result = await context.handle_unknown_attachment({
                attachment: { name: 'test.pdf', partName: 'part1' },
                content_of_attachment: new ArrayBuffer(8),
                local_hash: 'hash123',
                virustotal_stats: null,
                privacyTier: 'max'
            });

            assert.deepEqual(result, {
                hybrid_data: {
                    submission_id: 'PENDING_UPLOAD',
                    job_id: 'PENDING_UPLOAD',
                    sha256: 'hash123',
                    state: 'UNKNOWN',
                    partName: 'part1'
                },
                attachmentName: 'test.pdf'
            });
        });

        it('returns UNKNOWN if no active message or headerMessageId', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [] });

            let response;
            await context.handleCheckLinkState({ url: 'http://test.com' }, { tab: { id: 1 } }, (res) => { response = res; });
            assert.deepEqual(response, { status: 'UNKNOWN' });

            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ id: 1 }] }); // Missing headerMessageId
            await context.handleCheckLinkState({ url: 'http://test.com' }, { tab: { id: 1 } }, (res) => { response = res; });
            assert.deepEqual(response, { status: 'UNKNOWN' });
        });

        it('returns UNKNOWN if no link object is found and urlscan is disabled', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ headerMessageId: 'msg1' }] });
            context.getFromStore = async () => ({ links: [] });
            context.openDB = async () => ({});

            let response;
            await context.handleCheckLinkState({ url: 'http://test.com' }, { tab: { id: 1 } }, (res) => { response = res; });
            assert.deepEqual(response, { status: 'UNKNOWN' });
        });

        it('checks urlscan.io if no link object is found and urlscan is active, returning MALICIOUS', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ headerMessageId: 'msg1' }] });
            context.set_urlscanApikey('test-urlscan');

            // Mock checkUrlscanIo behaviour via fetch
            let callCount = 0;
            context.fetch = async (url) => {
                callCount++;
                if (callCount === 1) return { ok: true, status: 200, json: async () => ({ uuid: 'uuid-1' }) };
                if (callCount === 2) return { status: 200, json: async () => ({ verdicts: { overall: { malicious: true } } }) };
            };

            context.getFromStore = async () => ({ links: [] });
            context.openDB = async () => ({});

            let response;
            await context.handleCheckLinkState({ url: 'http://test.com' }, { tab: { id: 1 } }, (res) => { response = res; });
            assert.strictEqual(response.status, 'MALICIOUS_VISUAL');
        });

        it('returns linkObj state if urlscan is clean and hybrid_sha256 is missing', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ headerMessageId: 'msg1' }] });
            context.set_urlscanApikey('test-urlscan');

            let callCount = 0;
            context.fetch = async (url) => {
                callCount++;
                if (callCount === 1) return { ok: true, status: 200, json: async () => ({ uuid: 'uuid-2' }) };
                if (callCount === 2) return { status: 200, json: async () => ({ verdicts: {} }) };
            };

            context.getFromStore = async () => ({ links: [{ url: 'http://test.com', state: 'CUSTOM_STATE' }] });
            context.openDB = async () => ({});

            let response;
            await context.handleCheckLinkState({ url: 'http://test.com' }, { tab: { id: 1 } }, (res) => { response = res; });
            assert.deepEqual(response, { status: 'CUSTOM_STATE' });
        });

        it('fetches overview from hybrid analysis if hybrid_sha256 exists, returning CLEAN for no specific threat', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ headerMessageId: 'msg1' }] });
            // Disable urlscan to simplify
            context.set_urlscanApikey('');

            context.fetch = async (url) => {
                assert.ok(url.includes('api/v2/overview/hash123'));
                return { status: 200, json: async () => ({ verdict: 'no specific threat' }) };
            };

            context.getFromStore = async () => ({ links: [{ url: 'http://test.com', state: 'UPLOADED', hybrid_sha256: 'hash123' }] });
            context.openDB = async () => ({});

            let response;
            await context.handleCheckLinkState({ url: 'http://test.com' }, { tab: { id: 1 } }, (res) => { response = res; });
            assert.deepEqual(response, { status: 'CLEAN' });
        });

        it('fetches overview from hybrid analysis, returning UPPERCASE verdict for threats', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ headerMessageId: 'msg1' }] });

            context.fetch = async () => ({ status: 200, json: async () => ({ verdict: 'malicious' }) });

            context.getFromStore = async () => ({ links: [{ url: 'http://test.com', state: 'UPLOADED', hybrid_sha256: 'hash123' }] });
            context.openDB = async () => ({});

            let response;
            await context.handleCheckLinkState({ url: 'http://test.com' }, { tab: { id: 1 } }, (res) => { response = res; });
            assert.deepEqual(response, { status: 'MALICIOUS' });
        });

        it('falls back to link state if hybrid analysis fetch throws an error', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ headerMessageId: 'msg1' }] });

            context.fetch = async () => { throw new Error('Network error'); };

            context.getFromStore = async () => ({ links: [{ url: 'http://test.com', state: 'FALLBACK_STATE', hybrid_sha256: 'hash123' }] });
            context.openDB = async () => ({});

            let response;
            await context.handleCheckLinkState({ url: 'http://test.com' }, { tab: { id: 1 } }, (res) => { response = res; });
            assert.deepEqual(response, { status: 'FALLBACK_STATE' });
        });

        it('returns ERROR on generic unexpected errors in the main flow', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => { throw new Error('API failure'); };

            let response;
            await context.handleCheckLinkState({ url: 'http://test.com' }, { tab: { id: 1 } }, (res) => { response = res; });
            assert.deepEqual(response, { status: 'ERROR' });
        });
    });

    describe('extractEmailDomain', () => {
        it('returns the domain for a standard email', () => {
            assert.strictEqual(context.extractEmailDomain('user@example.com'), 'example.com');
        });
        it('returns the domain including subdomains', () => {
            assert.strictEqual(context.extractEmailDomain('user@mail.example.com'), 'mail.example.com');
        });
        it('returns an empty string if there is no @ symbol', () => {
            assert.strictEqual(context.extractEmailDomain('invalidemail'), '');
        });
        it('extracts correctly if there are multiple @ symbols', () => {
            assert.strictEqual(context.extractEmailDomain('user@name@example.com'), 'name@example.com');
        });
        it('converts uppercase domains to lowercase', () => {
            assert.strictEqual(context.extractEmailDomain('user@EXAMPLE.COM'), 'example.com');
        });
        it('returns empty string for empty input', () => {
            assert.strictEqual(context.extractEmailDomain(''), '');
        });
    });

    describe('extractEmailAddress', () => {
        it('returns plain email unchanged', () => {
            assert.strictEqual(context.extractEmailAddress('test@example.com'), 'test@example.com');
        });
        it('extracts email from brackets', () => {
            assert.strictEqual(context.extractEmailAddress('John Doe <john@example.com>'), 'john@example.com');
        });
        it('prevents email spoofing from decoy display names', () => {
            assert.strictEqual(context.extractEmailAddress('"Safe Sender <decoy@safe.com>" <hacker@evil.com>'), 'hacker@evil.com');
        });
        it('converts to lowercase', () => {
            assert.strictEqual(context.extractEmailAddress('TEST@EXAMPLE.COM'), 'test@example.com');
            assert.strictEqual(context.extractEmailAddress('User <USER@EXAMPLE.COM>'), 'user@example.com');
        });
        it('handles missing ending bracket', () => {
            assert.strictEqual(context.extractEmailAddress('John <john@example.com'), 'john <john@example.com');
        });
        it('handles empty string', () => {
            assert.strictEqual(context.extractEmailAddress(''), '');
        });
        it('handles string with only brackets', () => {
            assert.strictEqual(context.extractEmailAddress('<>'), '');
        });
        it('extracts correct email when spoofed with multiple brackets', () => {
            assert.strictEqual(context.extractEmailAddress('"Safe Sender <decoy@safe.com>" <hacker@evil.com>'), 'hacker@evil.com');
        });
    });

    describe('getHybridAnalysisOptions', () => {
        let originalApiKey;

        beforeEach(() => {
            originalApiKey = context.get_apikey();
            context.set_apikey_hybridanalysis('test-api-key');
        });

        afterEach(() => {
            context.set_apikey_hybridanalysis(originalApiKey);
        });

        it('should throw Error if apikey_hybridanalysis is missing', () => {
            context.set_apikey_hybridanalysis(null);
            assert.throws(
                () => context.getHybridAnalysisOptions('GET'),
                /API-Key fehlt\./
            );
        });

        it('should return basic options for GET request without body or isUrl', () => {
            const options = context.getHybridAnalysisOptions('GET');
            assert.equal(options.method, 'GET');
            assert.equal(options.headers.accept, 'application/json');
            assert.equal(options.headers['api-key'], 'test-api-key');
            assert.match(options.headers['user-agent'], /Falcon/);
            assert.ok(!options.body);
        });

        it('should add body and scan_type header for POST request with body', () => {
            const body = { test: 'data' };
            const options = context.getHybridAnalysisOptions('POST', body);
            assert.equal(options.method, 'POST');
            assert.equal(options.headers.accept, 'application/json');
            assert.equal(options.headers['api-key'], 'test-api-key');
            assert.match(options.headers['user-agent'], /Falcon/);
            assert.equal(options.headers['scan_type'], 'all');
            assert.deepEqual(options.body, body);
        });

        it('should add Content-Type header if isUrl is true', () => {
            const body = 'url=http%3A%2F%2Fexample.com';
            const options = context.getHybridAnalysisOptions('POST', body, true);
            assert.equal(options.method, 'POST');
            assert.equal(options.headers.accept, 'application/json');
            assert.equal(options.headers['api-key'], 'test-api-key');
            assert.match(options.headers['user-agent'], /Falcon/);
            assert.equal(options.headers['scan_type'], 'all');
            assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
            assert.deepEqual(options.body, body);
        });
    });

    describe('create_manual_check_hybrid_data', () => {
        it('should construct hybrid data object with MANUAL_CHECK defaults and virustotal_stats when provided', () => {
            const localHash = 'abc123sha256hash';
            const attachment = { name: 'test.pdf', partName: 'part1.2' };
            const vtStats = { harmless: 10, malicious: 0, suspicious: 0, undetected: 2 };

            const result = context.create_manual_check_hybrid_data(localHash, attachment, vtStats);

            assert.deepEqual(result, {
                hybrid_data: {
                    submission_id: 'MANUAL_CHECK',
                    job_id: 'MANUAL_CHECK',
                    sha256: localHash,
                    state: 'MANUAL_CHECK_PENDING',
                    partName: 'part1.2'
                },
                attachmentName: 'test.pdf',
                virustotal_stats: vtStats
            });
        });

        it('should construct hybrid data object without virustotal_stats when virustotalStats is null or omitted', () => {
            const localHash = 'xyz987sha256hash';
            const attachment = { name: 'invoice.docx', partName: 'part2.1' };

            const result = context.create_manual_check_hybrid_data(localHash, attachment, null);

            assert.deepEqual(result, {
                hybrid_data: {
                    submission_id: 'MANUAL_CHECK',
                    job_id: 'MANUAL_CHECK',
                    sha256: localHash,
                    state: 'MANUAL_CHECK_PENDING',
                    partName: 'part2.1'
                },
                attachmentName: 'invoice.docx'
            });
            assert.strictEqual('virustotal_stats' in result, false);
        });
    });

    describe('addSenderOptIn', () => {
        it('should add new sender to scanningEnabledSenders when empty or undefined', async () => {
            let savedData = null;
            context.browser.storage.local.get = async (key) => ({ scanningEnabledSenders: [] });
            context.browser.storage.local.set = async (obj) => { savedData = obj; };

            await context.addSenderOptIn('new@example.com');

            assert.deepEqual(savedData, { scanningEnabledSenders: ['new@example.com'] });
        });

        it('should not duplicate sender if already in scanningEnabledSenders', async () => {
            let setCalled = false;
            context.browser.storage.local.get = async (key) => ({ scanningEnabledSenders: ['existing@example.com'] });
            context.browser.storage.local.set = async (obj) => { setCalled = true; };

            await context.addSenderOptIn('existing@example.com');

            assert.strictEqual(setCalled, false);
        });

        it('should append sender to existing list of senders', async () => {
            let savedData = null;
            context.browser.storage.local.get = async (key) => ({ scanningEnabledSenders: ['user1@example.com'] });
            context.browser.storage.local.set = async (obj) => { savedData = obj; };

            await context.addSenderOptIn('user2@example.com');

            assert.deepEqual(savedData, { scanningEnabledSenders: ['user1@example.com', 'user2@example.com'] });
        });

        it('should handle storage errors gracefully without throwing', async () => {
            context.browser.storage.local.get = async () => { throw new Error('Storage failure'); };

            await assert.doesNotReject(async () => {
                await context.addSenderOptIn('error@example.com');
            });
        });
    });
});

    describe('scoring regression: no constant 50 (user report)', () => {
        it('keeps a newsletter with spf=softfail below the banner threshold', () => {
            const result = context.calculateThreatScore('Newsletter <news@example-news.de>', ['https://example-news.de/abmelden'], {
                authHeaders: ['spf=softfail dkim=none dmarc=none'],
                isFirstCommunication: false,
                messageText: 'Angebote der Woche',
                subject: 'Ihr Newsletter'
            });
            assert.strictEqual(result.score, 25);
            assert.ok(result.score < 50, 'a single weak signal must not trigger the banner');
        });

        it('keeps an ordinary invoice with one urgency word below the banner threshold', () => {
            const result = context.calculateThreatScore('Kunde <buchhaltung@kunde-gmbh.de>', [], {
                authHeaders: [],
                isFirstCommunication: true,
                messageText: 'Bitte ueberweisen Sie die Rechnung',
                subject: 'Rechnung 2026-01'
            });
            assert.ok(result.score < 50, 'first contact + urgency must not reach 50 on its own');
            assert.ok(result.reasons.some(r => r.includes('Mögliches BEC')));
        });

        it('does not score first contact when the information is unknown', () => {
            const unknown = context.calculateThreatScore('Kunde <buchhaltung@kunde-gmbh.de>', [], {
                isFirstCommunication: null,
                messageText: 'Bitte ueberweisen Sie die Rechnung',
                subject: 'Rechnung'
            });
            const notFirst = context.calculateThreatScore('Kunde <buchhaltung@kunde-gmbh.de>', [], {
                isFirstCommunication: false,
                messageText: 'Bitte ueberweisen Sie die Rechnung',
                subject: 'Rechnung'
            });
            assert.strictEqual(unknown.score, notFirst.score);
        });

        it('reaches the banner threshold when all three authentication checks fail', () => {
            const result = context.calculateThreatScore('info <info@fremde-domain.de>', [], {
                authHeaders: ['spf=fail dkim=fail dmarc=fail'],
                isFirstCommunication: false,
                messageText: 'hallo',
                subject: 'hi'
            });
            assert.strictEqual(result.score, 60);
        });

        it('scores a real spoofing attempt well above the threshold', () => {
            const result = context.calculateThreatScore('Service <service@paypal-support.com>', ['https://login.amaz0n.de/x'], {
                authHeaders: ['spf=fail dkim=fail dmarc=fail'],
                isFirstCommunication: false,
                messageText: 'Konto gesperrt'
            });
            assert.ok(result.score >= 80, 'expected a high score for a spoofed message, got ' + result.score);
        });

        it('takes malicious IP addresses from the Received headers into account', () => {
            const result = context.calculateThreatScore('info <info@fremde-domain.de>', [], {
                authHeaders: ['spf=pass dkim=pass dmarc=pass'],
                maliciousIps: ['203.0.113.5'],
                isFirstCommunication: false,
                messageText: 'hallo',
                subject: 'hi'
            });
            assert.strictEqual(result.score, 50);
            assert.ok(result.reasons.some(r => r.includes('203.0.113.5')));
        });
    });

    describe('scan diagnostics and manual attachment handling', () => {
        it('reports a missing API key instead of a generic scan failure', async () => {
            context.set_apikey_hybridanalysis('');
            context.browser.permissions = { contains: async () => true, request: async () => true };

            const response = await context.handleRequestScan(
                { action: 'requestScan', messageId: 5, senderEmail: 'a@example.com' },
                { tab: { id: 1 } }
            );

            assert.strictEqual(response.success, false);
            assert.strictEqual(response.code, 'NO_API_KEY');
            assert.match(response.error, /API-Schluessel/i);
        });

        it('names the failing stage when a scan stage throws', async () => {
            context.set_apikey_hybridanalysis('test-key');
            context.browser.permissions = { contains: async () => true, request: async () => true };
            const originalProcessAttachments = context.processAttachments;
            context.processAttachments = async () => { throw new Error('attachment stage broke'); };

            try {
                const response = await context.handleRequestScan(
                    { action: 'requestScan', messageId: 6, senderEmail: 'a@example.com' },
                    { tab: { id: 1 } }
                );
                assert.strictEqual(response.success, false);
                assert.strictEqual(response.code, 'SCAN_FAILED');
                assert.strictEqual(response.stage, 'attachments');
                assert.strictEqual(response.error, 'attachment stage broke');
            } finally {
                context.processAttachments = originalProcessAttachments;
            }
        });

        it('lists the attachments of a message without transmitting anything', async () => {
            context.browser.messages.listAttachments = async () => ([
                { name: 'rechnung.pdf', contentType: 'application/pdf', size: 20480, partName: '1.2' },
                { name: 'bild.png', contentType: 'image/png', size: 512, partName: '1.3' }
            ]);

            const attachments = await context.listMessageAttachments(42);

            assert.strictEqual(attachments.length, 2);
            assert.strictEqual(attachments[0].name, 'rechnung.pdf');
            assert.strictEqual(attachments[0].contentType, 'application/pdf');
            assert.strictEqual(attachments[0].size, 20480);
            assert.strictEqual(attachments[1].partName, '1.3');
        });

        it('computes the attachment hash locally', async () => {
            const result = await context.computeAttachmentHash(42, '1.2');
            assert.strictEqual(result.sha256.length, 64);
            assert.strictEqual(result.size, 8);
        });

        it('requires an API key for manual uploads and reports the reason', async () => {
            context.set_apikey_hybridanalysis('');
            await assert.rejects(
                () => context.handleManualUpload(1, '1.2', 'x.exe', 'hash', 'header'),
                (error) => error.code === 'NO_API_KEY'
            );
        });
    });

    describe('time-delayed analyses: queue, polling and status (user request)', () => {
        function stubStorage() {
            let store = {};
            context.browser.storage.local.get = async (keys) => {
                if (typeof keys === 'string') return { [keys]: store[keys] };
                if (Array.isArray(keys)) {
                    const out = {};
                    keys.forEach(k => { out[k] = store[k]; });
                    return out;
                }
                return store;
            };
            context.browser.storage.local.set = async (data) => { Object.assign(store, data); };
            return { get: () => store };
        }

        it('stores a job and schedules the periodic result check', async () => {
            const storage = stubStorage();
            context.alarmCalls.length = 0;

            await context.upsertPendingScan({
                sha256: 'a'.repeat(64),
                partName: '1.2',
                attachmentName: 'rechnung.pdf',
                messageId: 7,
                messageHeaderId: 'hdr-7',
                state: 'running',
                attempts: 0,
                startedAt: Date.now()
            });

            const jobs = storage.get()[context.PENDING_SCANS_KEY];
            assert.strictEqual(jobs.length, 1);
            assert.strictEqual(jobs[0].attachmentName, 'rechnung.pdf');
            assert.ok(context.alarmCalls.some(call => call.name === context.SCAN_ALARM_NAME));
        });

        it('describes a job as delayed and pollable', async () => {
            const described = context.describeScanJob({ sha256: 'b'.repeat(64), state: 'running', attempts: 2, startedAt: Date.now() });
            assert.strictEqual(described.timing, 'delayed');
            assert.strictEqual(described.state, 'running');
            assert.strictEqual(described.canPollNow, true);
            assert.strictEqual(described.attempts, 2);
        });

        it('picks up a finished analysis, stores the verdict and notifies the user', async () => {
            const storage = stubStorage();
            context.notifications.length = 0;
            await context.upsertPendingScan({
                sha256: 'c'.repeat(64), partName: '1.2', attachmentName: 'x.exe',
                messageId: 8, messageHeaderId: 'hdr-8', state: 'running', attempts: 0, startedAt: Date.now()
            });

            let storedRecord = null;
            context.getSharedDB = async () => ({});
            context.updateStore = async (db, store, key, updateFn) => { storedRecord = updateFn(null); };
            context.fetch = async () => ({ status: 200, json: async () => ({ verdict: 'malicious', submission_id: 's1', job_id: 'j1' }) });

            const summary = await context.pollPendingScans();

            assert.strictEqual(summary.finished, 1);
            assert.strictEqual(storage.get()[context.PENDING_SCANS_KEY].length, 0);
            assert.ok(storedRecord, 'the verdict must be written to the local cache');
            assert.strictEqual(storedRecord.attachments[0].verdict, 'MALICIOUS');
            assert.strictEqual(storedRecord.attachments[0].timing, 'delayed');
            assert.ok(context.notifications.some(n => /Analyse|Analysis/.test(n.message)));
        });

        it('keeps polling while the provider has no result yet', async () => {
            const storage = stubStorage();
            await context.upsertPendingScan({
                sha256: 'd'.repeat(64), partName: '1.2', attachmentName: 'y.exe',
                messageId: 9, messageHeaderId: 'hdr-9', state: 'running', attempts: 0, startedAt: Date.now()
            });
            context.fetch = async () => ({ status: 404, json: async () => ({}) });

            const summary = await context.pollPendingScans();

            assert.strictEqual(summary.pending, 1);
            const job = storage.get()[context.PENDING_SCANS_KEY][0];
            assert.strictEqual(job.state, 'running');
            assert.strictEqual(job.attempts, 1);
            assert.ok(job.lastCheckAt > 0);
        });

        it('does not query the provider without consent and marks the job', async () => {
            const storage = stubStorage();
            await context.upsertPendingScan({
                sha256: 'e'.repeat(64), partName: '1.2', attachmentName: 'z.exe',
                messageId: 10, messageHeaderId: 'hdr-10', state: 'running', attempts: 0, startedAt: Date.now()
            });
            context.set_externalAnalysisConsent(false);
            let fetchCalls = 0;
            context.fetch = async () => { fetchCalls++; return { status: 200, json: async () => ({ verdict: 'clean' }) }; };

            try {
                await context.pollPendingScans();
            } finally {
                context.set_externalAnalysisConsent(true);
            }

            assert.strictEqual(fetchCalls, 0);
            assert.strictEqual(storage.get()[context.PENDING_SCANS_KEY][0].state, 'failed');
        });

        it('gives up after the maximum number of attempts and informs the user', async () => {
            const storage = stubStorage();
            context.notifications.length = 0;
            await context.upsertPendingScan({
                sha256: 'f'.repeat(64), partName: '1.2', attachmentName: 'late.exe',
                messageId: 11, messageHeaderId: 'hdr-11', state: 'running',
                attempts: context.SCAN_MAX_ATTEMPTS, startedAt: Date.now()
            });
            context.fetch = async () => ({ status: 404, json: async () => ({}) });

            await context.pollPendingScans();

            const job = storage.get()[context.PENDING_SCANS_KEY][0];
            assert.strictEqual(job.state, 'timeout');
            assert.match(job.error, /Zeitfenster/);
            assert.ok(context.notifications.some(n => /Zeitfenster|result/i.test(n.message)));
        });

        it('manual upload registers a delayed job and reports it to the caller', async () => {
            const storage = stubStorage();
            context.set_apikey_hybridanalysis('test-key');
            context.fetch = async () => ({ status: 200, json: async () => ({ sha256: '0'.repeat(64), submission_id: 'sub', job_id: 'job' }) });
            context.getSharedDB = async () => ({});
            context.updateStore = async () => {};

            const result = await context.handleManualUpload(12, '1.2', 'doku.pdf', null, 'hdr-12');

            assert.strictEqual(result.timing, 'delayed');
            assert.strictEqual(result.state, 'running');
            assert.match(result.message, /zeitverzoegert/);
            const jobs = storage.get()[context.PENDING_SCANS_KEY];
            assert.strictEqual(jobs.length, 1);
            assert.strictEqual(jobs[0].messageHeaderId, 'hdr-12');
        });
    });

    describe('audit fixes: terminal jobs, placeholders, header id, state lookup', () => {
        function stubStorage() {
            let store = {};
            context.browser.storage.local.get = async (keys) => {
                if (typeof keys === 'string') return { [keys]: store[keys] };
                if (Array.isArray(keys)) { const out = {}; keys.forEach(k => { out[k] = store[k]; }); return out; }
                return store;
            };
            context.browser.storage.local.set = async (data) => { Object.assign(store, data); };
            return { get: () => store };
        }

        it('does not notify again for a job that already timed out', async () => {
            const storage = stubStorage();
            context.notifications.length = 0;
            context.alarmCalls.length = 0;
            await context.upsertPendingScan({
                sha256: 'a'.repeat(64), partName: '1', attachmentName: 'late.exe',
                messageId: 1, messageHeaderId: 'h1', state: 'running',
                attempts: context.SCAN_MAX_ATTEMPTS, startedAt: Date.now()
            });
            context.fetch = async () => ({ status: 404, json: async () => ({}) });

            await context.pollPendingScans();
            const afterFirst = context.notifications.length;
            await context.pollPendingScans();
            await context.pollPendingScans();

            assert.strictEqual(afterFirst, 1, 'exactly one timeout notification expected');
            assert.strictEqual(context.notifications.length, 1, 'no repeated notifications for the same job');
            assert.strictEqual(storage.get()[context.PENDING_SCANS_KEY][0].state, 'timeout');
        });

        it('stops the polling alarm once no job is open any more', async () => {
            const storage = stubStorage();
            context.alarmCalls.length = 0;
            context.alarmCleared.length = 0;
            await context.upsertPendingScan({
                sha256: 'b'.repeat(64), partName: '1', attachmentName: 'x.exe',
                messageId: 2, messageHeaderId: 'h2', state: 'running',
                attempts: context.SCAN_MAX_ATTEMPTS, startedAt: Date.now()
            });
            context.fetch = async () => ({ status: 404, json: async () => ({}) });

            await context.pollPendingScans();

            assert.ok(context.alarmCleared.includes(context.SCAN_ALARM_NAME), 'alarm must be cleared');
            assert.strictEqual(storage.get()[context.PENDING_SCANS_KEY][0].state, 'timeout');
        });

        it('substitutes $NAME$ and $VERDICT$ in the fallback notification strings', () => {
            assert.strictEqual(
                context.msg('notificationScanTimeout', ['rechnung.pdf']),
                'No analysis result received in time for: rechnung.pdf'
            );
            assert.strictEqual(
                context.msg('notificationScanFinished', ['rechnung.pdf', 'MALICIOUS']),
                'Analysis finished: rechnung.pdf - verdict: MALICIOUS'
            );
        });

        it('resolves the message header id for one-off scans so results can be stored later', async () => {
            const storage = stubStorage();
            context.set_apikey_hybridanalysis('test-key');
            context.browser.permissions = { contains: async () => true, request: async () => true };
            context.browser.messages.get = async () => ({ id: 77, headerMessageId: 'hdr-77', author: 'a@example.com', subject: 's' });
            context.browser.messages.listAttachments = async () => ([
                { name: 'anhang.exe', contentType: 'application/x-msdownload', size: 128, partName: '1.2' }
            ]);
            context.browser.messages.getAttachmentFile = async () => ({
                slice: () => ({ arrayBuffer: async () => new ArrayBuffer(8) }),
                type: 'application/x-msdownload'
            });
            // Tier 'balanced': unbekannte Anhaenge werden hochgeladen (Upload = zeitverzoegert).
            context.set_privacyTier('balanced');
            context.fetch = async (url) => {
                if (String(url).includes('/overview/')) {
                    return { status: 404, json: async () => ({}) }; // Datei ist dem Anbieter noch unbekannt
                }
                return { status: 200, json: async () => ({ sha256: '1'.repeat(64), submission_id: 's', job_id: 'j' }) };
            };
            context.getSharedDB = async () => ({});
            context.updateStore = async () => {};

            await context.handleRequestScan({ action: 'requestScan', messageId: 77, senderEmail: 'a@example.com' }, { tab: { id: 4 } });

            const jobs = storage.get()[context.PENDING_SCANS_KEY] || [];
            assert.strictEqual(jobs.length, 1);
            assert.strictEqual(jobs[0].messageHeaderId, 'hdr-77');
            assert.strictEqual(jobs[0].messageId, 77);
        });

        it('finds the display state via the message id even without the tab id', async () => {
            context.updateDisplayState(99, { mode: 'ready', messageId: 555, threat: { score: 40, reasons: [], authStatus: 'neutral' } });

            let response = null;
            const listener = context.browser.runtime.onMessage.listeners[0];
            assert.ok(listener);
            listener({ action: 'getDisplayState', messageId: 555 }, {}, (res) => { response = res; });
            await new Promise(resolve => setImmediate(resolve));

            assert.ok(response);
            assert.strictEqual(response.mode, 'ready');
            assert.strictEqual(response.threat.score, 40);
        });
    });

    describe('history (audit trail) and view roles', () => {
        function stubStorage() {
            let store = {};
            context.browser.storage.local.get = async (keys) => {
                if (typeof keys === 'string') return { [keys]: store[keys] };
                if (Array.isArray(keys)) { const out = {}; keys.forEach(k => { out[k] = store[k]; }); return out; }
                return store;
            };
            context.browser.storage.local.set = async (data) => { Object.assign(store, data); };
            return { get: () => store };
        }

        it('records a local check without marking it as transmitted', async () => {
            const storage = stubStorage();
            await context.recordScanHistory({ action: 'local-check', transmitted: false, subject: 'Test' });

            const history = storage.get()[context.HISTORY_KEY];
            assert.strictEqual(history.length, 1);
            assert.strictEqual(history[0].transmitted, false);
            assert.strictEqual(history[0].action, 'local-check');
            assert.ok(history[0].timestamp, 'timestamp expected');
            assert.ok(history[0].id, 'id expected');
        });

        it('records transmissions with provider, data type and timing', async () => {
            const storage = stubStorage();
            await context.recordScanHistory({
                action: 'attachment-upload', transmitted: true, provider: 'hybrid-analysis',
                dataType: 'attachment', timing: 'delayed', attachmentName: 'x.exe', sha256: 'a'.repeat(64)
            });

            const entry = storage.get()[context.HISTORY_KEY][0];
            assert.strictEqual(entry.provider, 'hybrid-analysis');
            assert.strictEqual(entry.dataType, 'attachment');
            assert.strictEqual(entry.timing, 'delayed');
        });

        it('does not record anything while the history is disabled', async () => {
            const storage = stubStorage();
            context.set_history_enabled(false);
            try {
                await context.recordScanHistory({ action: 'local-check', transmitted: false });
            } finally {
                context.set_history_enabled(true);
            }
            assert.strictEqual(storage.get()[context.HISTORY_KEY], undefined);
        });

        it('caps the history at the configured limit', async () => {
            const storage = stubStorage();
            context.set_history_limit(50);
            try {
                for (let i = 0; i < 60; i++) {
                    await context.recordScanHistory({ action: 'local-check', transmitted: false, subject: 'm' + i });
                }
            } finally {
                context.set_history_limit(500);
            }
            const history = storage.get()[context.HISTORY_KEY];
            assert.strictEqual(history.length, 50);
            assert.strictEqual(history[history.length - 1].subject, 'm59');
        });

        it('filters by message and by transmissions and summarizes', async () => {
            const history = [
                { action: 'local-check', transmitted: false, messageHeaderId: 'h1' },
                { action: 'hash-lookup', transmitted: true, provider: 'virustotal', messageHeaderId: 'h1' },
                { action: 'attachment-upload', transmitted: true, provider: 'hybrid-analysis', messageHeaderId: 'h2' }
            ];

            assert.strictEqual(context.filterScanHistory(history, { messageHeaderId: 'h1' }).length, 2);
            assert.strictEqual(context.filterScanHistory(history, { onlyTransmissions: true }).length, 2);
            assert.strictEqual(context.filterScanHistory(history, { action: 'local-check' }).length, 1);

            const summary = context.summarizeHistory(context.filterScanHistory(history, { messageHeaderId: 'h1' }));
            assert.strictEqual(summary.total, 2);
            assert.strictEqual(summary.transmissions, 1);
            assert.strictEqual(summary.local, 1);
            assert.deepStrictEqual(Object.keys(summary.providers), ['virustotal']);
        });

        it('can be cleared', async () => {
            const storage = stubStorage();
            await context.recordScanHistory({ action: 'local-check', transmitted: false });
            assert.strictEqual(storage.get()[context.HISTORY_KEY].length, 1);

            await context.clearScanHistory();

            const cleared = storage.get()[context.HISTORY_KEY];
            assert.strictEqual(Array.isArray(cleared), true);
            assert.strictEqual(cleared.length, 0);
        });

        it('falls back to the private role for unknown values', () => {
            assert.strictEqual(context.get_view_mode(), 'private');
            context.set_view_mode('audit');
            assert.strictEqual(context.get_view_mode(), 'audit');
            context.set_view_mode('private');
        });

        it('exposes the history through the runtime action', async () => {
            const storage = stubStorage();
            await context.recordScanHistory({ action: 'attachment-upload', transmitted: true, provider: 'hybrid-analysis' });

            let response = null;
            const listener = context.browser.runtime.onMessage.listeners[0];
            listener({ action: 'getHistory', onlyTransmissions: true }, {}, (res) => { response = res; });
            await new Promise(resolve => setImmediate(resolve));

            assert.ok(response);
            assert.strictEqual(response.status, 'success');
            assert.strictEqual(response.entries.length, 1);
            assert.strictEqual(response.entries[0].transmitted, true);
            assert.strictEqual(response.viewMode, 'private');
        });
    });

    describe('enterprise policy (managed storage)', () => {
        it('applies managed settings with priority over local ones', async () => {
            context.browser.storage.managed = {
                get: async () => ({
                    externalAnalysisConsent: true,
                    privacyTier: 'strict',
                    viewMode: 'audit',
                    historyEnabled: false,
                    historyLimit: 120,
                    customBlacklist: ['evil.example']
                })
            };

            await context.loadManagedSettings();
            context.applyManagedSettings();

            assert.strictEqual(context.get_view_mode(), 'audit');
            assert.strictEqual(context.get_privacyTier(), 'strict');
            assert.strictEqual(context.hasManagedPolicy(), true);
            assert.strictEqual(context.get_externalAnalysisConsent(), true);
            assert.strictEqual(context.get_history_enabled(), false);
            assert.strictEqual(context.get_customBlacklist().has('evil.example'), true);

            context.browser.storage.managed = { get: async () => ({}) };
            await context.loadManagedSettings();
        });

        it('stays neutral when no policy is installed', async () => {
            context.browser.storage.managed = { get: async () => { throw new Error('no policy'); } };
            await context.loadManagedSettings();
            assert.strictEqual(context.hasManagedPolicy(), false);
        });

        it('ignores invalid managed values', async () => {
            context.browser.storage.managed = {
                get: async () => ({ privacyTier: 'balanced', viewMode: 'quatsch', historyLimit: 'viel' })
            };
            context.set_view_mode('private');
            await context.loadManagedSettings();
            context.applyManagedSettings();

            assert.strictEqual(context.get_privacyTier(), 'balanced');
            assert.strictEqual(context.get_view_mode(), 'private');
            assert.strictEqual(context.get_history_limit(), 500);

            context.set_privacyTier('strict');
            context.browser.storage.managed = { get: async () => ({}) };
            await context.loadManagedSettings();
        });

        it('merges local and managed settings for the UI', async () => {
            context.browser.storage.managed = { get: async () => ({ viewMode: 'research' }) };
            await context.loadManagedSettings();
            const effective = await context.getEffectiveSettings();

            assert.strictEqual(effective.viewMode, 'research');
            assert.strictEqual(effective.managedKeys.length, 1);
            assert.strictEqual(effective.managedKeys[0], 'viewMode');

            context.browser.storage.managed = { get: async () => ({}) };
            await context.loadManagedSettings();
        });
    });

    describe('diagnostics, statistics and report export', () => {
        it('reports diagnostics with ok and warn states', async () => {
            context.set_apikey_hybridanalysis('');
            context.set_externalAnalysisConsent(false);
            const report = await context.collectDiagnostics();

            assert.ok(report.checks.length >= 8);
            assert.ok(report.summary.warn >= 2, 'missing consent and API key are warnings');
            assert.strictEqual(report.checks.find(check => check.id === 'consent').status, 'warn');
            assert.ok(report.checks.some(check => check.id === 'indexeddb'));
            assert.ok(report.checks.some(check => check.id === 'policy'));
            context.set_externalAnalysisConsent(true);
        });

        it('aggregates the history into statistics', () => {
            const now = new Date().toISOString();
            const history = [
                { action: 'local-check', transmitted: false, timestamp: now },
                { action: 'attachment-upload', transmitted: true, provider: 'hybrid-analysis', attachmentName: 'a.exe', timestamp: now },
                { action: 'hash-lookup', transmitted: true, provider: 'virustotal', sha256: 'a'.repeat(64), timestamp: now },
                { action: 'domain-check', transmitted: true, provider: 'urlhaus', domain: 'bad.example', timestamp: now }
            ];

            const statistics = context.computeHistoryStatistics(history, { days: 7 });

            assert.strictEqual(statistics.total, 4);
            assert.strictEqual(statistics.transmissions, 3);
            assert.strictEqual(statistics.localOnly, 1);
            assert.strictEqual(statistics.byProvider['hybrid-analysis'], 1);
            assert.strictEqual(statistics.byAction['local-check'], 1);
            assert.strictEqual(statistics.recentTransmissions.length, 3);
            assert.strictEqual(Object.keys(statistics.byDay).length, 1);
        });

        it('builds a markdown report that names every transmission', () => {
            const report = context.buildMessageReport({
                message: { subject: 'Rechnung', sender: 'kunde@example.com' },
                threat: { score: 60, authStatus: 'fail', reasons: ['SPF-Pruefung fehlgeschlagen'] },
                attachments: [{ name: 'rechnung.pdf', contentType: 'application/pdf', size: 2048, state: 'KNOWN', verdict: 'CLEAN', hybrid_sha256: 'f'.repeat(64) }],
                historyEntries: [
                    { transmitted: false, action: 'local-check' },
                    { transmitted: true, action: 'attachment-upload', provider: 'hybrid-analysis', dataType: 'attachment', timing: 'delayed', attachmentName: 'rechnung.pdf', sha256: 'f'.repeat(64) }
                ]
            });

            assert.strictEqual(report.riskScore, 60);
            assert.strictEqual(report.transmissions.length, 1);
            assert.match(report.markdown, /Thundy AV - Sicherheitsbericht/);
            assert.match(report.markdown, /Rechnung/);
            assert.match(report.markdown, /hybrid-analysis/);
            assert.match(report.markdown, /zeitverzoegert/);
            assert.match(report.markdown, /rechnung\.pdf/);
        });

        it('states explicitly when nothing was transmitted', () => {
            const report = context.buildMessageReport({
                message: { subject: 'Intern', sender: 'kollege@example.com' },
                threat: { score: 10, reasons: [] },
                attachments: [],
                historyEntries: [{ transmitted: false, action: 'local-check' }]
            });
            assert.match(report.markdown, /Keine - es wurde nichts an Dritte uebertragen\./);
        });

        it('answers diagnostics, statistics and settings requests', async () => {
            const listener = context.browser.runtime.onMessage.listeners[0];
            const ask = (message) => new Promise(resolve => listener(message, {}, resolve));

            const diagnostics = await ask({ action: 'getDiagnostics' });
            assert.strictEqual(diagnostics.status, 'success');
            assert.ok(diagnostics.report.checks.length > 0);

            const statistics = await ask({ action: 'getStatistics', days: 30 });
            assert.strictEqual(statistics.status, 'success');
            assert.strictEqual(statistics.statistics.windowDays, 30);

            const settings = await ask({ action: 'getEffectiveSettings' });
            assert.strictEqual(settings.status, 'success');
            assert.ok(settings.settings);
        });
    });

    describe('Manifest V3 port (B1) and consent enforcement (B2)', () => {
        it('defaults to the strict privacy tier (hashes only)', () => {
            assert.strictEqual(context.get_privacyTier(), 'strict');
        });

        it('registers onMessagesDisplayed (MV3) instead of the removed onMessageDisplayed', () => {
            assert.strictEqual(context.browser.messageDisplay.onMessagesDisplayed.listeners.length, 1);
            assert.strictEqual(context.browser.messageDisplay.onMessageDisplayed.listeners.length, 0);
        });

        it('messageListToArray handles MessageList objects, arrays and single messages', () => {
            const fromList = context.messageListToArray({ messages: [{ id: 1 }] });
            assert.strictEqual(fromList.length, 1);
            assert.strictEqual(fromList[0].id, 1);

            const fromArray = context.messageListToArray([{ id: 2 }]);
            assert.strictEqual(fromArray.length, 1);
            assert.strictEqual(fromArray[0].id, 2);

            const fromSingle = context.messageListToArray({ id: 3 });
            assert.strictEqual(fromSingle.length, 1);
            assert.strictEqual(fromSingle[0].id, 3);

            assert.strictEqual(context.messageListToArray(null).length, 0);
        });

        it('getFirstDisplayedMessage prefers getDisplayedMessages and falls back to getDisplayedMessage', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ id: 11, headerMessageId: 'h11' }] });
            assert.strictEqual((await context.getFirstDisplayedMessage(1)).headerMessageId, 'h11');

            delete context.browser.messageDisplay.getDisplayedMessages;
            context.browser.messageDisplay.getDisplayedMessage = async () => ({ id: 12, headerMessageId: 'h12' });
            assert.strictEqual((await context.getFirstDisplayedMessage(1)).headerMessageId, 'h12');
        });

        it('tab_mail_open_display processes every message of a MessageList', async () => {
            const processed = [];
            context.processAttachments = async (message) => { processed.push(message.id); };
            context.processLinks = async () => ({ messageText: '', urls: [], filteredUrls: [] });
            context.evaluateAndInjectThreats = async () => {};
            context.browser.messages.listAttachments = async () => ([]);
            context.browser.storage.local.get = async () => ({ scanningEnabledSenders: [] });

            await context.tab_mail_open_display({ id: 7 }, { messages: [{ id: 101, author: 'a@example.com' }, { id: 102, author: 'b@example.com' }] });

            assert.deepStrictEqual(processed, [101, 102]);
        });

        it('injectIntoMessageDisplay uses scripting.messageDisplay when available', async () => {
            const calls = [];
            context.browser.scripting.messageDisplay = {
                executeScript: async (injection) => { calls.push(['messageDisplay', injection.target.tabId]); }
            };
            const genericCalls = [];
            context.browser.scripting.executeScript = async (injection) => { genericCalls.push(injection.target.tabId); };

            await context.injectIntoMessageDisplay(5, function () {});

            assert.deepStrictEqual(calls, [['messageDisplay', 5]]);
            assert.strictEqual(genericCalls.length, 0);
        });

        it('injectIntoMessageDisplay falls back to scripting.executeScript and swallows errors', async () => {
            delete context.browser.scripting.messageDisplay;
            const genericCalls = [];
            context.browser.scripting.executeScript = async (injection) => { genericCalls.push(injection.target.tabId); };
            await context.injectIntoMessageDisplay(6, function () {});
            assert.deepStrictEqual(genericCalls, [6]);

            context.browser.scripting.executeScript = async () => { throw new Error('blocked'); };
            const result = await context.injectIntoMessageDisplay(6, function () {});
            assert.strictEqual(result, null);
        });

        it('originForUrl maps provider hosts to the declared optional host permissions', () => {
            assert.strictEqual(context.originForUrl('https://www.virustotal.com/api/v3/files/x'), context.PROVIDER_ORIGINS.virustotal);
            assert.strictEqual(context.originForUrl('https://urlhaus-api.abuse.ch/v1/host/'), context.PROVIDER_ORIGINS.urlhaus);
            assert.strictEqual(context.originForUrl('https://api.abuseipdb.com/api/v2/check'), context.PROVIDER_ORIGINS.abuseipdb);
            assert.strictEqual(context.originForUrl('https://hybrid-analysis.com/api/v2/overview/x'), context.PROVIDER_ORIGINS.hybridanalysis);
            assert.strictEqual(context.originForUrl('https://urlscan.io/api/v1/scan/'), context.PROVIDER_ORIGINS.urlscan);
            assert.strictEqual(context.originForUrl('https://example.com/'), null);
            assert.strictEqual(context.originForUrl('not a url'), null);
        });

        it('msg() falls back to English strings and substitutes placeholders', () => {
            assert.strictEqual(context.msg('bannerScanOnce'), 'Scan this message once');
            assert.strictEqual(context.msg('bannerThreatScore', ['77']), 'Risk score: 77 of 100');
            assert.strictEqual(context.msg('doesNotExist'), 'doesNotExist');
        });

        it('blocks every third party request without explicit consent', async () => {
            context.set_externalAnalysisConsent(false);

            let fetchCalls = 0;
            context.fetch = async () => { fetchCalls++; return { status: 200, json: async () => ({}) }; };

            assert.strictEqual(await context.checkVirusTotal('abc', 'vt-key'), null);
            assert.strictEqual(await context.checkURLhaus('example.com', 'urlhaus-key'), false);
            assert.strictEqual(await context.checkAbuseIPDB('1.1.1.1', 'ip-key'), false);
            assert.strictEqual(await context.checkUrlscanIo('https://example.com', 'scan-key'), null);
            assert.throws(() => context.assertExternalAnalysisAllowed());

            await context.processAndUploadUrls({ id: 1 }, ['https://example.com']);
            assert.strictEqual(fetchCalls, 0, 'no network activity may happen without consent');
        });

        it('does not auto-upload attachments without consent even on the balanced tier', async () => {
            context.set_externalAnalysisConsent(false);
            let fetchCalls = 0;
            context.fetch = async () => { fetchCalls++; return { status: 200, json: async () => ({}) }; };

            const result = await context.handle_unknown_attachment({
                attachment: { name: 'x.exe', partName: '1' },
                content_of_attachment: {},
                local_hash: 'hash',
                virustotal_stats: null,
                privacyTier: 'balanced',
                fileType: 'application/x-msdownload'
            });

            assert.strictEqual(fetchCalls, 0);
            assert.strictEqual(result.hybrid_data.state, 'UNKNOWN');
            assert.strictEqual(result.hybrid_data.submission_id, 'PENDING_UPLOAD');
        });

        it('does not persist a sender when a one-off scan finishes', async () => {
            let saved = null;
            context.browser.storage.local.get = async () => ({ scanningEnabledSenders: [] });
            context.browser.storage.local.set = async (obj) => { saved = obj; };
            context.browser.permissions = { contains: async () => true, request: async () => true };
            context.processAttachments = async () => {};
            context.processLinks = async () => ({ messageText: '', urls: [], filteredUrls: [] });
            context.evaluateAndInjectThreats = async () => {};

            const response = await context.handleRequestScan(
                { action: 'requestScan', messageId: 1, senderEmail: 'once@example.com', persist: false },
                { tab: { id: 1 } }
            );

            assert.strictEqual(response.success, true);
            assert.strictEqual(saved, null);
        });

        it('notify() never throws when the notifications API is unavailable', () => {
            const originalNotifications = context.browser.notifications;
            try {
                context.browser.notifications = {
                    create: () => { throw new Error('no notifications'); }
                };
                assert.doesNotThrow(() => context.notify('notificationTitle', 'notificationScanStarted', ['https://example.com']));
            } finally {
                context.browser.notifications = originalNotifications;
            }
        });
    });
});
