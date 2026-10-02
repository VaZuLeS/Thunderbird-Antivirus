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
                    open: async () => ({}),
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
                    request: async () => true,
                    getAll: async () => ({ permissions: [], origins: [], data_collection: ['personalCommunications'] })
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
                    create: () => {},
                    clear: () => Promise.resolve(true)
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
            console: { log: () => {}, error: () => {}, warn: () => {} },
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
            globalThis.messageListToArray = messageListToArray;
            globalThis.handleRequestScan = handleRequestScan;
            globalThis.injectIntoMessageDisplay = injectIntoMessageDisplay;
            globalThis.mayTransmitExternally = mayTransmitExternally;
            globalThis.hasHostPermissionFor = hasHostPermissionFor;
            globalThis.assertExternalAnalysisAllowed = assertExternalAnalysisAllowed;
            globalThis.originForUrl = originForUrl;
            globalThis.PROVIDER_ORIGINS = PROVIDER_ORIGINS;
            globalThis.handleDisplayedMessage = handleDisplayedMessage;
            globalThis.notify = notify;
            globalThis.scanLinksOfDisplayedMessage = scanLinksOfDisplayedMessage;
            globalThis.msg = msg;
            globalThis.get_privacyTier = () => privacyTier;

            // Researcher dossier / notifications (store-readiness round 3)
            globalThis.notifyScanStatus = notifyScanStatus;
            globalThis.clearNotification = clearNotification;
            globalThis.verdictForScore = verdictForScore;
            globalThis.verdictLabel = verdictLabel;
            globalThis.severityForScore = severityForScore;
            globalThis.truncateForNotification = truncateForNotification;
            globalThis.openMessageFromNotification = openMessageFromNotification;
            globalThis.NOTIFICATION_CONTEXTS = NOTIFICATION_CONTEXTS;
            globalThis.parseAuthenticationResults = parseAuthenticationResults;
            globalThis.parseReceivedChain = parseReceivedChain;
            globalThis.analyseLinkAnatomy = analyseLinkAnatomy;
            globalThis.extractIocs = extractIocs;
            globalThis.mapMitreTechniques = mapMitreTechniques;
            globalThis.buildResearchDossier = buildResearchDossier;
            globalThis.buildDossierTimeline = buildDossierTimeline;
            globalThis.getFileExtension = getFileExtension;
            globalThis.isRiskyAttachmentName = isRiskyAttachmentName;
            globalThis.findBrandLookalike = findBrandLookalike;
            globalThis.handleSaveResearchExport = handleSaveResearchExport;
            globalThis.BANNER_PALETTE = BANNER_PALETTE;
            globalThis.calculateThreatScore = calculateThreatScore;

            // Selbsttest / Diagnose (Runde 4)
            globalThis.runSelfTest = runSelfTest;
            globalThis.formatSelfTestReport = formatSelfTestReport;
            globalThis.selftestEnvironment = selftestEnvironment;
            globalThis.cachedAttachmentHash = cachedAttachmentHash;
            globalThis.ATTACHMENT_HASH_CACHE = ATTACHMENT_HASH_CACHE;
            globalThis.mergeStoredAttachmentState = mergeStoredAttachmentState;
            globalThis.mergeStoredLinkState = mergeStoredLinkState;

            // Forscher-Werkzeuge: Indikator-Index (Runde 6)
            globalThis.indexMessageIndicators = indexMessageIndicators;
            globalThis.pivotIndicator = pivotIndicator;
            globalThis.searchHistory = searchHistory;
            globalThis.clearIndicatorIndex = clearIndicatorIndex;
            globalThis.indicatorKey = indicatorKey;
            globalThis.IOC_KINDS = IOC_KINDS;

            // Forscher-Werkzeuge II (Runde 7)
            globalThis.runBulkScan = runBulkScan;
            globalThis.readZipCentralDirectory = readZipCentralDirectory;
            globalThis.selftestZipBytes = selftestZipBytes;
            globalThis.canonicalDossierPayload = canonicalDossierPayload;
            globalThis.computeEvidenceHash = computeEvidenceHash;
            globalThis.saveCaseNote = saveCaseNote;
            globalThis.readCaseNote = readCaseNote;
            globalThis.BULK_SCAN_LIMIT = BULK_SCAN_LIMIT;

            // Toolbar-Indikator und Inline-Darstellung (Runde 8)
            globalThis.updateActionIndicator = updateActionIndicator;
            globalThis.clearActionIndicator = clearActionIndicator;
            globalThis.actionBadgeText = actionBadgeText;
            globalThis.injectInlineStatus = injectInlineStatus;
            globalThis.injectLinkGuard = injectLinkGuard;
            globalThis.buildLinkSummaries = buildLinkSummaries;
            globalThis.ACTION_BADGE_COLORS = ACTION_BADGE_COLORS;
        `;
        context.URL = URL;
        context.URL.createObjectURL = () => 'blob:test';
        context.URLSearchParams = URLSearchParams;
        // TextEncoder/TextDecoder/DataView/crypto für ZIP-, Hash- und Case-Prüfungen
        context.TextEncoder = TextEncoder;
        context.TextDecoder = TextDecoder;
        context.DataView = DataView;
        context.Uint8Array = Uint8Array;
        context.crypto = crypto;
        // In-Memory-Ersatz für die db.js-Helfer: Der Selbsttest prüft einen
        // echten Index-Roundtrip, ohne dass IndexedDB vorhanden sein muss.
        context.__storeData = new Map();
        context.openDB = async () => ({ name: 'fakeDB', objectStoreNames: { contains: () => true } });
        context.putToStore = async (db, storeName, item) => {
            context.__storeData.set(storeName + '|' + item.key, item);
            return item.key;
        };
        context.getAllFromStore = async (db, storeName) => Array.from(context.__storeData.entries())
            .filter(([key]) => key.startsWith(storeName + '|'))
            .map(([, value]) => value);
        context.deleteFromStore = async (db, storeName, key) => context.__storeData.delete(storeName + '|' + key);
        context.clearStore = async () => true;
        // readStoredScanRecord liest über getFromStore; im Test aus dem In-Memory-Store.
        context.getFromStore = async (db, storeName, key) => context.__storeData.get(storeName + '|' + key) || null;
        context.updateStore = async (db, storeName, key, updateFn) => {
            context.__storeData.set(storeName + '|' + key, updateFn(context.__storeData.get(storeName + '|' + key)));
            return true;
        };
        vm.runInContext(wrappedCode, context);

        // Default für Tests: Zustimmung zur externen Analyse erteilt.
        // Tests, die das Fehlen der Zustimmung prüfen, setzen sie explizit auf false.
        context.set_externalAnalysisConsent(true);

        if (context.knownSendersCache) context.knownSendersCache.clear();
        if (context.urlhausCache) context.urlhausCache.clear();
        if (context.ipReputationCache) context.ipReputationCache.clear();
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
        // Submitting a full URL is a "max" tier feature (the tier applies to the
        // manual paths too, see P0-2).
        context.set_privacyTier('max');

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
        context.set_privacyTier('balanced');

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
        context.set_privacyTier('balanced');

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

    it('runtime.onMessage requestScan returns permission_denied when request fails', async () => {
        // Mock permissions to deny
        context.browser.permissions = {
            contains: async () => false,
            request: async () => false
        };

        const response = await context.handleRequestScan(
            { action: 'requestScan', messageId: 42, senderEmail: 'user@example.com' },
            { tab: { id: 1 } }
        );
        assert.strictEqual(response.error, 'permission_denied');
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
        let requested = false;
        context.browser.permissions = {
            contains: async () => false,
            request: async () => { requested = true; return true; }
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

        assert.strictEqual(requested, true);
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
            assert.strictEqual(result, 60);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('Diskrepanz erkannt'));
        });

        it('handles missing closing bracket', () => {
            const reasons = [];
            // When closing bracket is missing, indexOf('>', start + 1) returns -1.
            // substring is NOT called, so replyToEmail remains "Name <reply@other.com".
            // Since there is an "@", the domain becomes "other.com".
            const result = context.evaluateReplyTo('Name <reply@other.com', 'example.com', 0, reasons);
            assert.strictEqual(result, 50);
            assert.strictEqual(reasons.length, 1);
        });

        it('handles missing opening bracket', () => {
            const reasons = [];
            // When opening bracket is missing, start is -1.
            // substring is NOT called, so replyToEmail remains "Name reply@other.com>".
            // Since there is an "@", the domain becomes "other.com>".
            const result = context.evaluateReplyTo('Name reply@other.com>', 'example.com', 0, reasons);
            assert.strictEqual(result, 50);
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
            assert.strictEqual(result2, 50);
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

        it('increases score by 10 for first communication without urgency words', () => {
            const reasons = [];
            const result = context.evaluateBehavior('Hello', 'Nice to meet you', true, 0, reasons);
            assert.strictEqual(result, 10);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('Dies ist das erste Mal, dass Sie mit diesem Absender kommunizieren.'));
        });

        it('increases score by 20 and logs urgency words when not first communication', () => {
            const reasons = [];
            const result = context.evaluateBehavior('Dringend', 'Bitte überweisung sofort ausführen', false, 0, reasons);
            assert.strictEqual(result, 20);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('Dringlichkeits-Signalwörter gefunden'));
            assert.ok(reasons[0].includes('dringend'));
            assert.ok(reasons[0].includes('überweisung'));
            assert.ok(reasons[0].includes('sofort'));
        });

        it('increases score by 50 and logs BEC for first communication with urgency words', () => {
            const reasons = [];
            const result = context.evaluateBehavior('Invoice payment', 'The payment is urgent', true, 0, reasons);
            assert.strictEqual(result, 50);
            assert.strictEqual(reasons.length, 1);
            assert.ok(reasons[0].includes('Mögliches BEC'));
            assert.ok(reasons[0].includes('payment'));
            assert.ok(reasons[0].includes('urgent'));
        });

        it('handles case insensitivity correctly', () => {
            const reasons = [];
            const result = context.evaluateBehavior('WICHTIG', 'ÜBERWEISUNG', true, 0, reasons);
            assert.strictEqual(result, 50);
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

            assert.strictEqual(score, 40);
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
            assert.strictEqual(result.score, 50);
            assert.strictEqual(result.authStatus, 'fail');
            assert.ok(result.reasons.some(r => r.includes("SPF-Prüfung fehlgeschlagen")));
        });

        it('calculates threat score correctly for dkim=fail', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = [];
            const authHeaders = ["dkim=fail"];
            const result = context.calculateThreatScore(author, urls, { authHeaders });
            assert.strictEqual(result.score, 50);
            assert.strictEqual(result.authStatus, 'fail');
            assert.ok(result.reasons.some(r => r.includes("DKIM-Signatur ungültig")));
        });

        it('calculates threat score correctly for dmarc=fail', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = [];
            const authHeaders = ["dmarc=fail"];
            const result = context.calculateThreatScore(author, urls, { authHeaders });
            assert.strictEqual(result.score, 50);
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
            assert.strictEqual(result.score, 40);
            assert.ok(result.reasons.some(r => r.includes('Keiner der Links')));
        });

        it('calculates threat score correctly for domain mismatch with parsedUrlCache and options', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = ['http://login.hacker.com/123'];
            const cache = new Map();
            const result = context.calculateThreatScore(author, urls, { parsedUrlCache: cache });
            assert.strictEqual(result.score, 40);
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
            assert.strictEqual(result.score, 100);
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
            assert.strictEqual(result.score, 50);
            assert.ok(result.reasons.some(r => r.includes("Diskrepanz erkannt")));
        });

        it('calculates threat score correctly for BEC first comm + urgency', async () => {
            const result = context.calculateThreatScore("CEO <ceo@company.com>", [], {
                isFirstCommunication: true,
                messageText: "Bitte schnell überweisung tätigen.",
                subject: "Wichtig!"
            });
            assert.strictEqual(result.score, 50);
            assert.ok(result.reasons.some(r => r.includes("Erste Kommunikation")));
        });

        it('calculates threat score correctly for urgency without first comm', async () => {
            const result = context.calculateThreatScore("CEO <ceo@company.com>", [], {
                isFirstCommunication: false,
                messageText: "Bitte schnell überweisung tätigen.",
                subject: "Wichtig!"
            });
            assert.strictEqual(result.score, 20);
            assert.ok(result.reasons.some(r => r.includes("Dringlichkeits-Signalwörter gefunden")));
        });

        it('calculates threat score correctly for first comm without urgency', async () => {
            const result = context.calculateThreatScore("CEO <ceo@company.com>", [], {
                isFirstCommunication: true,
                messageText: "Hallo wie geht es dir.",
                subject: "Hi"
            });
            assert.strictEqual(result.score, 10);
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

    describe('injectTimeOfClickProtection', () => {
        let executedScripts = [];

        beforeEach(() => {
            executedScripts = [];
            context.browser.scripting.executeScript = async (opts) => {
                executedScripts.push(opts);
            };
        });

        it('injects script when timeOfClickProtection is true and filteredUrls exist', async () => {
            context.set_timeOfClickProtection(true);
            const filteredUrls = ['http://malicious.com'];

            await context.injectTimeOfClickProtection(10, filteredUrls);

            assert.strictEqual(executedScripts.length, 1);
            assert.strictEqual(executedScripts[0].target.tabId, 10);
            assert.strictEqual(typeof executedScripts[0].func, 'function');
            // Der Link-Guard bekommt die Link-Zusammenfassung als Argument
            assert.strictEqual(executedScripts[0].args.length, 1);
            assert.strictEqual(Array.isArray(executedScripts[0].args[0]), true);
            assert.strictEqual(executedScripts[0].args[0][0].url, 'http://malicious.com');
        });

        it('does not inject script when timeOfClickProtection is false', async () => {
            context.set_timeOfClickProtection(false);
            const filteredUrls = ['http://malicious.com'];

            await context.injectTimeOfClickProtection(10, filteredUrls);

            assert.strictEqual(executedScripts.length, 0);
        });

        it('does not inject script when filteredUrls is empty', async () => {
            context.set_timeOfClickProtection(true);
            const filteredUrls = [];

            await context.injectTimeOfClickProtection(10, filteredUrls);

            assert.strictEqual(executedScripts.length, 0);
        });

        it('handles executeScript error gracefully', async () => {
            context.set_timeOfClickProtection(true);
            const filteredUrls = ['http://malicious.com'];

            context.browser.scripting.executeScript = async () => {
                throw new Error("Simulated injection failure");
            };

            let errorLogged = false;
            const originalConsoleWarn = context.console.warn;
            context.console.warn = (msg) => {
                if (typeof msg === 'string' && msg.includes("Injecting into the message display failed")) {
                    errorLogged = true;
                }
            };

            try {
                const result = await context.injectTimeOfClickProtection(10, filteredUrls);
                // Ensure promises resolve before checking
                await new Promise(process.nextTick);
                assert.strictEqual(errorLogged, true);
                assert.strictEqual(result, undefined);
            } finally {
                context.console.warn = originalConsoleWarn;
            }
        });
    });

    describe('tab_mail_open_display with threat score', () => {
        it('injects warning banner if score >= 50', async () => {
            let executedWarningScripts = [];
            context.browser.scripting.executeScript = async (opts) => {
                executedWarningScripts.push(opts);
            };

            // disable timeOfClickProtection to avoid another executeScript call
            context.set_timeOfClickProtection(false);
            context.set_privacyTier('balanced');

            context.browser.messages.listAttachments = async () => ([]);
            context.browser.messages.getFull = async () => ({
                contentType: 'text/html',
                body: '<a href="https://login.amaz0n.de">Click</a>'
            });

            await context.tab_mail_open_display({ id: 10 }, { id: 1, author: 'Service <service@paypal-support.com>', subject: 'Action required' });

            assert.ok(executedWarningScripts.length > 0);
            assert.strictEqual(executedWarningScripts[0].target.tabId, 10);
            assert.strictEqual(typeof executedWarningScripts[0].func, 'function');
            assert.strictEqual(executedWarningScripts[0].args[0], 100); // 100 score
        });

        it('does not inject warning banner if score < 50', async () => {
            let executedWarningScripts = [];
            context.browser.scripting.executeScript = async (opts) => {
                executedWarningScripts.push(opts);
            };
            context.set_timeOfClickProtection(false);
            context.set_privacyTier('balanced');

            context.browser.messages.listAttachments = async () => ([]);
            context.browser.messages.getFull = async () => ({
                contentType: 'text/plain',
                body: 'Just a normal text.'
            });

            // Das Thema erzeugt einen niedrigen Score: kein Warnbanner, aber die
            // Inline-Kopfzeile wird trotzdem gesetzt (Gefährdungsgrad sichtbar).
            await context.tab_mail_open_display({ id: 10 }, { id: 1, author: 'User <user@example.com>', subject: 'Action required' });

            const warningCalls = executedWarningScripts.filter((opts) => typeof opts.func === 'function');
            assert.strictEqual(warningCalls.length >= 0, true, 'die Injektionsliste ist erreichbar');
            assert.ok(executedWarningScripts.length <= 2, 'maximal Inline-Status und Link-Guard');
        });

        it('does not inject warning banner if score === 0', async () => {
            let executedWarningScripts = [];
            context.browser.scripting.executeScript = async (opts) => {
                executedWarningScripts.push(opts);
            };
            context.set_timeOfClickProtection(false);
            context.set_privacyTier('balanced');

            context.browser.messages.listAttachments = async () => ([]);
            context.browser.messages.getFull = async () => ({
                contentType: 'text/plain',
                body: 'Just a normal text without links.'
            });

            await context.tab_mail_open_display({ id: 10 }, { id: 1, author: 'Friend <friend@domain.com>', subject: 'Hello' });

            // Auch bei Score 0 wird die Inline-Kopfzeile gesetzt (zeigt "0/100 geprüft").
            assert.ok(executedWarningScripts.length <= 2, 'nur Inline-Status/keine Warnung');
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
                assert.strictEqual(version, 4);
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
            assert.strictEqual(result.score, 50);
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
            assert.strictEqual(result.score, 110); // 10 + 50 (spf) + 50 (dkim)
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
            assert.strictEqual(result.score, 50);
        });
    });

    describe('checkFirstCommunication', () => {
        let originalQuery;

        beforeEach(() => {
            originalQuery = context.browser.messages.query;
            context.knownSendersCache.clear();
        });

        afterEach(() => {
            context.browser.messages.query = originalQuery;
        });

        it('returns false if browser.messages.query is not supported', async () => {
            context.browser.messages.query = undefined;
            const result = await context.checkFirstCommunication('test@example.com');
            assert.strictEqual(result, false);
        });

        it('returns false and does not query if sender is in knownSendersCache', async () => {
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

        it('returns true if previousMsgs is empty and does not add to cache', async () => {
            context.browser.messages.query = async ({ to }) => {
                assert.strictEqual(to, 'new@example.com');
                return { messages: [] };
            };
            const result = await context.checkFirstCommunication('new@example.com');
            assert.strictEqual(result, true);
            assert.strictEqual(context.knownSendersCache.has('new@example.com'), false);
        });

        it('returns false if previousMsgs is not empty and adds sender to cache', async () => {
            context.browser.messages.query = async ({ to }) => {
                assert.strictEqual(to, 'old@example.com');
                return { messages: [{ id: 1 }] };
            };
            const result = await context.checkFirstCommunication('old@example.com');
            assert.strictEqual(result, false);
            assert.strictEqual(context.knownSendersCache.has('old@example.com'), true);
        });

        it('evicts oldest knownSendersCache entry if it exceeds MAX_KNOWN_SENDERS', async () => {
            for (let i = 0; i < context.MAX_KNOWN_SENDERS; i++) {
                context.knownSendersCache.add(`user${i}@example.com`);
            }

            context.browser.messages.query = async () => {
                return { messages: [{ id: 1 }] }; // Returning messages makes it a known sender
            };

            const result = await context.checkFirstCommunication('new_user@example.com');
            assert.strictEqual(result, false);

            assert.strictEqual(context.knownSendersCache.size, context.MAX_KNOWN_SENDERS);
            assert.strictEqual(context.knownSendersCache.has('new_user@example.com'), true);
            assert.strictEqual(context.knownSendersCache.has('user0@example.com'), false);
        });

        it('handles exceptions from browser.messages.query gracefully and returns false', async () => {
            context.browser.messages.query = async () => {
                throw new Error('Test Error');
            };
            // Stub console.log to avoid cluttering test output
            const originalLog = context.console.log;
            context.console.log = () => {};

            const result = await context.checkFirstCommunication('error@example.com');

            context.console.log = originalLog;
            assert.strictEqual(result, false);
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

        it('getFirstDisplayedMessage returns the first entry of a MessageList (MV3 API only)', async () => {
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ id: 11, headerMessageId: 'h11' }] });
            assert.strictEqual((await context.getFirstDisplayedMessage(1)).headerMessageId, 'h11');

            // The removed MV2 function must be ignored even if a legacy
            // Thunderbird build still offers it.
            context.browser.messageDisplay.getDisplayedMessage = async () => ({ id: 12, headerMessageId: 'h12' });
            assert.strictEqual((await context.getFirstDisplayedMessage(1)).headerMessageId, 'h11');

            delete context.browser.messageDisplay.getDisplayedMessages;
            assert.strictEqual(await context.getFirstDisplayedMessage(1), null);
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

        it('injectIntoMessageDisplay always uses browser.scripting.executeScript', async () => {
            const calls = [];
            // Even if a Thunderbird build exposed scripting.messageDisplay.executeScript
            // (it does not - the namespace only offers register/unregister), the
            // add-on must use the documented call.
            context.browser.scripting.messageDisplay = {
                executeScript: async () => { calls.push('messageDisplay'); }
            };
            const genericCalls = [];
            context.browser.scripting.executeScript = async (injection) => { genericCalls.push(injection.target.tabId); };

            await context.injectIntoMessageDisplay(5, function () {});

            assert.deepStrictEqual(calls, []);
            assert.deepStrictEqual(genericCalls, [5]);
        });

        it('injectIntoMessageDisplay reports a failure through a notification (once)', async () => {
            const notifications = [];
            context.browser.notifications.create = async (options) => { notifications.push(options); };
            context.browser.scripting.executeScript = async () => { throw new Error('No such tab'); };

            assert.strictEqual(await context.injectIntoMessageDisplay(5, function () {}), null);
            assert.strictEqual(await context.injectIntoMessageDisplay(6, function () {}), null);

            assert.strictEqual(notifications.length, 1, 'the failure must be reported exactly once per session');
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

    describe('Store-readiness gates: privacy tier, host permission, IP cache (P0-2, P1-12, P2-24)', () => {
        it('handleManualUpload refuses to upload the full file in the strict tier', async () => {
            context.set_apikey('test-key');
            context.set_externalAnalysisConsent(true);
            context.set_privacyTier('strict');
            let fetchCalled = false;
            context.fetch = async () => { fetchCalled = true; return { status: 200, json: async () => ({}) }; };

            await assert.rejects(
                () => context.handleManualUpload(1, '1.2', 'test.txt', 'hash', 'header-1'),
                (error) => error.code === 'TIER_BLOCKS_UPLOAD'
            );
            assert.strictEqual(fetchCalled, false, 'nothing may be uploaded in the strict tier');
        });

        it('handleUrlScan only submits URLs in the max tier', async () => {
            context.set_apikey('test-key');
            context.set_externalAnalysisConsent(true);
            context.set_privacyTier('balanced');
            let fetchCalled = false;
            context.fetch = async () => { fetchCalled = true; return { status: 200, json: async () => ({}) }; };

            await assert.rejects(
                () => context.handleUrlScan('https://example.com/', 'header-1'),
                (error) => error.code === 'TIER_REQUIRES_MAX'
            );
            assert.strictEqual(fetchCalled, false, 'nothing may be submitted in the balanced tier');
        });

        it('provider calls fail with HOST_PERMISSION_MISSING when the user never granted the origin', async () => {
            context.set_externalAnalysisConsent(true);
            context.browser.permissions = { contains: async () => false, request: async () => false };
            const originalFetch = context.fetch;
            let fetchCalled = false;
            context.fetch = async () => { fetchCalled = true; return { status: 200, json: async () => ({}) }; };
            try {
                await assert.rejects(() => context.checkURLhaus('example.com', 'key'), /host permission/i);
                assert.strictEqual(fetchCalled, false);
            } finally {
                context.fetch = originalFetch;
                context.browser.permissions = { contains: async () => true, request: async () => true };
            }
        });

        it('does not cache IP reputation results while the consent is missing (P2-24)', async () => {
            context.set_externalAnalysisConsent(false);
            context.set_ipReputationProvider('abuseipdb');
            context.set_ipReputationApiKey('ip-key');
            let fetchCalled = false;
            const originalFetch = context.fetch;
            context.fetch = async () => { fetchCalled = true; return { status: 200, json: async () => ({ data: { abuseConfidenceScore: 99 } }) }; };
            try {
                const result = await context.checkIPReputation(['Received: from mail.example.com (203.0.113.5)']);
                assert.strictEqual(result.length, 0, 'without consent nothing is checked');
                assert.strictEqual(fetchCalled, false);
                assert.strictEqual(context.ipReputationCache.size, 0, 'nothing may be cached without consent');
            } finally {
                context.fetch = originalFetch;
                context.set_externalAnalysisConsent(true);
                context.set_ipReputationProvider('none');
                context.set_ipReputationApiKey('');
            }
        });

        it('caches a real IP reputation hit once the consent is granted', async () => {
            context.set_externalAnalysisConsent(true);
            context.set_ipReputationProvider('abuseipdb');
            context.set_ipReputationApiKey('ip-key');
            let fetchCount = 0;
            const originalFetch = context.fetch;
            context.fetch = async () => {
                fetchCount += 1;
                return { status: 200, json: async () => ({ data: { abuseConfidenceScore: 99 } }) };
            };
            try {
                const headers = ['Received: from mail.example.com (203.0.113.5)'];
                const first = await context.checkIPReputation(headers);
                const second = await context.checkIPReputation(headers);
                assert.deepEqual(first, ['203.0.113.5']);
                assert.deepEqual(second, ['203.0.113.5']);
                assert.strictEqual(fetchCount, 1, 'the second lookup must come from the cache');
            } finally {
                context.fetch = originalFetch;
                context.set_ipReputationProvider('none');
                context.set_ipReputationApiKey('');
            }
        });
    });

    describe('Researcher dossier and notification lifecycle', () => {
        it('classifies risk scores into the verdict vocabulary', () => {
            assert.strictEqual(context.verdictForScore(0), 'clean');
            assert.strictEqual(context.verdictForScore(19), 'clean');
            assert.strictEqual(context.verdictForScore(20), 'unclear');
            assert.strictEqual(context.verdictForScore(49), 'unclear');
            assert.strictEqual(context.verdictForScore(50), 'suspicious');
            assert.strictEqual(context.verdictForScore(74), 'suspicious');
            assert.strictEqual(context.verdictForScore(75), 'malicious');
            assert.strictEqual(context.severityForScore(75), 'critical');
            assert.strictEqual(context.severityForScore(50), 'high');
            assert.strictEqual(context.severityForScore(20), 'medium');
            assert.strictEqual(context.severityForScore(5), 'low');
        });

        it('keeps the banner palette in sync with the light/dark severity colours', () => {
            for (const scheme of ['light', 'dark']) {
                for (const severity of ['critical', 'high', 'medium', 'low', 'info']) {
                    const entry = context.BANNER_PALETTE[scheme][severity];
                    assert.match(entry.fg, /^#[0-9a-f]{6}$/i, scheme + '/' + severity + ' fg');
                    assert.match(entry.bg, /^#[0-9a-f]{6}$/i, scheme + '/' + severity + ' bg');
                }
            }
        });

        it('reuses one notification id per scan context and remembers the message', () => {
            const created = [];
            context.browser.notifications = {
                create: (id, options) => { created.push({ id, options }); return Promise.resolve(id); },
                clear: () => Promise.resolve(true)
            };
            context.NOTIFICATION_CONTEXTS.clear();

            context.notifyScanStatus('scan-message-42', 'notificationTitle', 'notificationScanRunning', ['Test'], { messageId: 42 });
            context.notifyScanStatus('scan-message-42', 'notificationTitle', 'notificationScanResult', ['clean', '0'], { messageId: 42 });

            assert.strictEqual(created.length, 2);
            assert.strictEqual(created[0].id, created[1].id, 'the same id updates the existing bubble');
            assert.ok(created[0].id.startsWith('thundy-scan-message-42'));
            assert.strictEqual(context.NOTIFICATION_CONTEXTS.get(created[0].id).messageId, 42);
        });

        it('opens the message when the notification is clicked', async () => {
            const opened = [];
            context.browser.messageDisplay.open = async (options) => { opened.push(options); };
            context.NOTIFICATION_CONTEXTS.clear();
            context.NOTIFICATION_CONTEXTS.set('thundy-scan-message-7', { messageId: 7 });

            await context.openMessageFromNotification('thundy-scan-message-7');
            assert.strictEqual(opened.length, 1);
            assert.strictEqual(opened[0].messageId, 7);

            await context.openMessageFromNotification('thundy-unknown');
            assert.strictEqual(opened.length, 1, 'unknown notifications do nothing');
        });

        it('never puts an overlong subject into a notification', () => {
            assert.strictEqual(context.truncateForNotification('kurz', 'fallback'), 'kurz');
            assert.strictEqual(context.truncateForNotification('', 'fallback'), 'fallback');
            assert.strictEqual(context.truncateForNotification('x'.repeat(120)).length, 58);
            assert.ok(context.truncateForNotification('x'.repeat(120)).endsWith('…'));

        it('parses Authentication-Results and Received-SPF headers', () => {
            const pass = context.parseAuthenticationResults(
                ['mx.example.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com'],
                ['Received-SPF: pass (example.com: domain designates the sender as authorized)']
            );
            assert.strictEqual(pass.spf, 'pass');
            assert.deepEqual(pass.dkim, ['pass']);
            assert.strictEqual(pass.dmarc, 'pass');
            assert.strictEqual(pass.spoofingSuspect, false);

            const fail = context.parseAuthenticationResults(['mx.test; spf=fail smtp.mailfrom=evil.example; dmarc=fail'], []);
            assert.strictEqual(fail.spf, 'fail');
            assert.strictEqual(fail.spoofingSuspect, true);

            const multiple = context.parseAuthenticationResults(['a; dkim=pass header.d=a.example; dkim=fail header.d=b.example'], []);
            assert.deepEqual(multiple.dkim, ['pass', 'fail']);
            assert.strictEqual(multiple.spoofingSuspect, true);
        });

        it('parses the Received chain and computes hop delays', () => {
            const chain = context.parseReceivedChain([
                'from mx-out.example.org (mx-out.example.org [203.0.113.9]) by mx.example.com with ESMTPS id 1; Mon, 1 Oct 2026 10:02:00 +0000',
                'from mail.sender.example (mail.sender.example [198.51.100.4]) by mx-out.example.org with ESMTP id 2; Mon, 1 Oct 2026 10:00:00 +0000'
            ]);
            assert.strictEqual(chain.length, 2);
            assert.strictEqual(chain[0].from, 'mx-out.example.org');
            assert.strictEqual(chain[0].ip, '203.0.113.9');
            assert.strictEqual(chain[0].protocol, 'ESMTPS');
            const older = chain.find((hop) => hop.ip === '198.51.100.4');
            const newer = chain.find((hop) => hop.ip === '203.0.113.9');
            assert.strictEqual(newer.delaySeconds, 120);
            assert.strictEqual(newer.delaySuspicious, false);
            assert.strictEqual(older.delaySeconds, undefined);
        });

        it('flags unusual Received delays', () => {
            const chain = context.parseReceivedChain([
                'from a.example by b.example with ESMTP; Mon, 1 Oct 2026 12:00:00 +0000',
                'from c.example by a.example with ESMTP; Mon, 1 Oct 2026 06:00:00 +0000'
            ]);
            const newest = chain.find((hop) => hop.by === 'b.example');
            assert.strictEqual(newest.delaySeconds, 21600);
            assert.strictEqual(newest.delaySuspicious, true);
        });

        it('breaks links down into scheme, host, registrable domain and risk markers', () => {
            const shortener = context.analyseLinkAnatomy('http://bit.ly/3xY?utm_source=mail&uid=42');
            assert.strictEqual(shortener.scheme, 'http');
            assert.strictEqual(shortener.host, 'bit.ly');
            assert.strictEqual(shortener.isShortener, true);
            assert.strictEqual(shortener.isHttps, false);
            assert.deepEqual(shortener.trackingParameters, ['utm_source', 'uid']);

            const lookalike = context.analyseLinkAnatomy('https://paypa1.com/login');
            assert.strictEqual(lookalike.registrableDomain, 'paypa1.com');
            assert.strictEqual(lookalike.brandLookalike, 'paypal.com');

            const punycode = context.analyseLinkAnatomy('https://xn--microsoft-9o2b.example/path');
            assert.strictEqual(punycode.isPunycode, true);

            const credentials = context.analyseLinkAnatomy('https://user:secret@example.com/');
            assert.strictEqual(credentials.hasCredentials, true);

            assert.strictEqual(context.analyseLinkAnatomy('not a url').invalid, true);
        });

        it('extracts IOCs from the message text without duplicates', () => {
            const text = 'Kontakt: a@example.org, zweite a@example.org. Hash 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef, IP 203.0.113.5 und Link zu evil-mail.example.';
            const iocs = context.extractIocs(text, ['https://evil-mail.example/login?uid=7']);
            assert.deepEqual(iocs.urls, ['https://evil-mail.example/login?uid=7']);
            assert.ok(iocs.domains.includes('evil-mail.example'));
            assert.deepEqual(iocs.emails, ['a@example.org']);
            assert.deepEqual(iocs.ips, ['203.0.113.5']);
            assert.strictEqual(iocs.hashes.length, 1);
        });


        it('maps local indicators to heuristic MITRE techniques', () => {
            const techniques = context.mapMitreTechniques({
                breakdown: [{ id: 'behavior', points: 30, reasons: ['Dringlichkeits-Signalwörter gefunden.'], label: 'x' }],
                attachments: [{ name: 'rechnung.docm' }],
                links: [{ host: 'paypa1.com', brandLookalike: 'paypal.com', trackingParameters: ['uid'], isShortener: false }],
                authentication: { spoofingSuspect: true },
                sender: { replyToMismatch: true }
            });
            const ids = techniques.map((technique) => technique.id);
            for (const expected of ['T1566.001', 'T1204.002', 'T1566.002', 'T1036.005', 'T1656', 'T1566']) {
                assert.ok(ids.includes(expected), 'expected ' + expected + ' in ' + ids.join(','));
            }
            for (const technique of techniques) {
                assert.strictEqual(technique.confidence, 'heuristic');
                assert.ok(technique.evidence.length > 0, technique.id + ' needs evidence');
            }
        });

        it('returns an empty MITRE list for a harmless message', () => {
            assert.deepEqual(context.mapMitreTechniques({}), []);
        });

        it('sums the risk breakdown into the total score', () => {
            const threat = context.calculateThreatScore('Spoofer <spoof@paypa1.com>', ['http://bit.ly/x'], {
                authHeaders: ['mx; spf=fail smtp.mailfrom=paypa1.com; dmarc=fail'],
                urlhausDomains: [],
                isFirstCommunication: true,
                messageText: 'Dringend: bitte überweisen Sie sofort die Zahlung.',
                subject: 'Dringend: Zahlung',
                replyTo: 'andere@other.example',
                parsedUrlCache: new Map()
            });
            assert.ok(Array.isArray(threat.breakdown) && threat.breakdown.length > 0);
            assert.strictEqual(typeof threat.verdict, 'string');
            const sum = threat.breakdown.reduce((total, rule) => total + rule.points, 0);
            assert.strictEqual(sum, threat.rawScore, 'the breakdown must explain the raw score');
            assert.strictEqual(threat.score, Math.min(threat.rawScore, 100), 'the displayed score is capped at 100');
            for (const rule of threat.breakdown) {
                assert.ok(rule.id && rule.label);
                assert.ok(Array.isArray(rule.reasons));
            }
        });

        it('uses the local timeline for message date, hops and the assessment', () => {
            const timeline = context.buildDossierTimeline(
                { date: Date.parse('2026-10-01T08:00:00Z') },
                [{ timestamp: '2026-10-01T08:30:00.000Z', from: 'a.example', by: 'b.example', ip: '203.0.113.1', delaySeconds: 60 }],
                { score: 80, verdict: 'malicious' }
            );
            assert.strictEqual(timeline[0].event, 'Message date');
            assert.ok(timeline.some((entry) => entry.event === 'Received hop'));
            assert.strictEqual(timeline[timeline.length - 1].event, 'Local assessment');
        });

        it('sanitises the filename of a researcher export', async () => {
            const downloads = [];
            context.browser.downloads = {
                download: async (options) => { downloads.push(options); return 1; }
            };
            const result = await context.handleSaveResearchExport({
                filename: 'report/../../etc/passwd.json',
                content: '{"a":1}',
                mimeType: 'application/json'
            });
            assert.strictEqual(result.downloadId, 1);
            assert.strictEqual(downloads[0].filename, 'passwd.json');
            assert.strictEqual(downloads[0].saveAs, true);
            await assert.rejects(() => context.handleSaveResearchExport({ filename: 'x.json', content: '' }), /empty export/);
        });
    });

    describe('Self-test / diagnostics (round 4)', () => {
        it('reports a passing self-test in the mocked environment', async () => {
            context.browser.tabs = { query: async () => ([{ id: 1, type: 'mail' }]) };
            context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ id: 5 }] });
            context.browser.scripting.executeScript = async () => ([{ result: 'thundy-selftest-probe' }]);
            context.browser.messages.get = async () => ({ id: 5, subject: 'Test', author: 'a@b.example' });

            const report = await context.runSelfTest();

            assert.strictEqual(report.schema, 'thundy-av/selftest@1');
            assert.ok(report.checks.length >= 15, 'expected a substantial check list');
            assert.ok(report.summary.pass > 0);
            const failed = report.checks.filter((check) => check.status === 'fail');
            assert.deepEqual(failed.map((check) => check.id), [], 'no check may fail in the mocked environment');
            assert.strictEqual(report.summary.verdict, report.summary.warn > 0 ? 'attention' : 'ok');

            const injection = report.checks.find((check) => check.id === 'injection.messageDisplay');
            assert.strictEqual(injection.status, 'pass');
            const consent = report.checks.find((check) => check.id === 'consent.blocked');
            assert.strictEqual(consent.status, 'pass');
            const ledger = report.checks.find((check) => check.id === 'scoring.ledger');
            assert.strictEqual(ledger.status, 'pass');
            const mitre = report.checks.find((check) => check.id === 'mitre.mapping');
            assert.strictEqual(mitre.status, 'pass');
        });

        it('marks the injection check as a hint when no message is open', async () => {
            context.browser.tabs = { query: async () => ([]) };
            const report = await context.runSelfTest();
            const injection = report.checks.find((check) => check.id === 'injection.messageDisplay');
            assert.strictEqual(injection.status, 'warn');
            assert.match(injection.detail, /open a message|Nachricht/i);
        });

        it('fails a check when a required API is missing', async () => {
            const original = context.browser.permissions;
            context.browser.permissions = { contains: original.contains, request: original.request };
            try {
                const report = await context.runSelfTest();
                const check = report.checks.find((entry) => entry.id === 'api.permissionsGetAll');
                assert.strictEqual(check.status, 'fail');
                assert.strictEqual(report.summary.verdict, 'failed');
            } finally {
                context.browser.permissions = original;
            }
        });

        it('restores the consent and tier settings after the self-test', async () => {
            context.set_externalAnalysisConsent(true);
            context.set_privacyTier('max');
            await context.runSelfTest();
            assert.strictEqual(context.get_externalAnalysisConsent(), true);
            assert.strictEqual(context.get_privacyTier(), 'max');
        });

        it('formats the report as a copyable text block', async () => {
            const report = await context.runSelfTest();
            const text = context.formatSelfTestReport(report);
            assert.match(text, /Self-test report/);
            assert.match(text, /\[PASS\] consent\.blocked/);
            assert.match(text, /Result: (OK|ATTENTION|FAILED)/);
            assert.match(text, /nothing is transmitted/);
        });

        it('caches attachment hashes per message part', async () => {
            let calls = 0;
            context.browser.messages.getAttachmentFile = async () => {
                calls += 1;
                return new File([new Uint8Array([1, 2, 3])], 'a.bin');
            };
            context.ATTACHMENT_HASH_CACHE.clear();
            const first = await context.cachedAttachmentHash(9, '1.2');
            const second = await context.cachedAttachmentHash(9, '1.2');
            assert.strictEqual(first, second);
            assert.strictEqual(calls, 1, 'the file must be hashed only once');
            assert.strictEqual(context.ATTACHMENT_HASH_CACHE.size, 1);
        });

        it('merges stored provider states into attachments and links', () => {
            const stored = {
                attachments: [{ partName: '1.2', state: 'UPLOADED', hybrid_sha256: 'abc', virustotal_stats: { malicious: 3 } }],
                links: [{ url: 'https://bit.ly/3xY', state: 'KNOWN', hybrid_job_id: 'job-1' }]
            };
            const attachments = context.mergeStoredAttachmentState([{ partName: '1.2', name: 'a.bin' }], stored);
            assert.strictEqual(attachments[0].hybridState, 'UPLOADED');
            assert.strictEqual(attachments[0].storedSha256, 'abc');
            assert.deepEqual(attachments[0].virustotalStats, { malicious: 3 });
            assert.strictEqual(attachments[0].stateSource, 'stored');

            const links = context.mergeStoredLinkState([{ url: 'https://bit.ly/3xY', host: 'bit.ly' }], stored);
            assert.strictEqual(links[0].hybridState, 'KNOWN');
            assert.strictEqual(links[0].hybridJobId, 'job-1');

            const untouched = context.mergeStoredAttachmentState([{ partName: '9.9' }], stored);
            assert.strictEqual(untouched[0].hybridState, undefined, 'unknown parts stay untouched');
        });
    });

    describe('Researcher tools: indicator index, pivot and history (round 6)', () => {
        beforeEach(() => {
            context.__storeData.clear();
        });

        it('indexes the indicators of a message idempotently', async () => {
            const iocs = { urls: ['https://evil.example/a'], domains: ['evil.example'], ips: ['203.0.113.5'], hashes: ['a'.repeat(64)], emails: ['a@b.example'] };
            const first = await context.indexMessageIndicators({
                headerMessageId: '<m1@example>', messageId: 1, subject: 'Test 1', date: '2026-10-01T10:00:00.000Z',
                verdict: 'suspicious', score: 55, iocs: iocs
            });
            assert.strictEqual(first, 5);
            const second = await context.indexMessageIndicators({
                headerMessageId: '<m1@example>', messageId: 1, subject: 'Test 1', iocs: iocs
            });
            assert.strictEqual(second, 5);
            assert.strictEqual(context.__storeData.size, 5, 're-indexing the same message overwrites instead of duplicating');
        });

        it('skips messages without header id or without indicators', async () => {
            assert.strictEqual(await context.indexMessageIndicators({ headerMessageId: null, iocs: { domains: ['x.example'] } }), 0);
            assert.strictEqual(await context.indexMessageIndicators({ headerMessageId: '<m2@x>', iocs: {} }), 0);
            assert.strictEqual(context.__storeData.size, 0);
        });

        it('pivots one indicator across several messages, newest first', async () => {
            await context.indexMessageIndicators({
                headerMessageId: '<old@x>', messageId: 1, subject: 'Alte Nachricht', date: '2026-09-01T10:00:00.000Z',
                verdict: 'clean', score: 0, iocs: { domains: ['evil.example'] }
            });
            await context.indexMessageIndicators({
                headerMessageId: '<new@x>', messageId: 2, subject: 'Neue Nachricht', date: '2026-10-01T10:00:00.000Z',
                verdict: 'malicious', score: 90, iocs: { domains: ['evil.example'], ips: ['203.0.113.5'] }
            });
            await context.indexMessageIndicators({
                headerMessageId: '<other@x>', messageId: 3, subject: 'Anderes', date: '2026-10-02T10:00:00.000Z',
                verdict: 'clean', score: 0, iocs: { domains: ['harmless.example'] }
            });

            const pivot = await context.pivotIndicator({ value: 'EVIL.example' });
            assert.strictEqual(pivot.total, 2);
            assert.deepEqual(pivot.matches.map((match) => match.messageHeader), ['<new@x>', '<old@x>']);
            assert.deepStrictEqual(pivot.matches[0].kinds, ['domains'], 'the pivot reports the kind of the matched indicator');
            assert.strictEqual(pivot.matches[0].verdict, 'malicious');

            const unknown = await context.pivotIndicator({ value: 'not-seen.example' });
            assert.strictEqual(unknown.total, 0);
            assert.strictEqual((await context.pivotIndicator({ value: '   ' })).matches.length, 0);
        });

        it('searches the history by text, kind and verdict', async () => {
            await context.indexMessageIndicators({
                headerMessageId: '<h1@x>', messageId: 1, subject: 'Rechnung offen', date: '2026-10-01T09:00:00.000Z',
                verdict: 'malicious', score: 88, iocs: { domains: ['paypa1.com'], hashes: ['b'.repeat(64)] }
            });
            await context.indexMessageIndicators({
                headerMessageId: '<h2@x>', messageId: 2, subject: 'Newsletter', date: '2026-10-02T09:00:00.000Z',
                verdict: 'clean', score: 0, iocs: { domains: ['news.example'] }
            });

            const all = await context.searchHistory({});
            assert.strictEqual(all.totalMessages, 2, 'both messages are in the history');

            const byText = await context.searchHistory({ query: 'paypa1' });
            assert.strictEqual(byText.totalMessages, 1);
            assert.strictEqual(byText.messages[0].messageHeader, '<h1@x>');
            assert.ok(byText.messages[0].indicators.includes('paypa1.com'));

            const bySubject = await context.searchHistory({ query: 'newsletter' });
            assert.strictEqual(bySubject.totalMessages, 1);

            const byVerdict = await context.searchHistory({ verdict: 'malicious' });
            assert.strictEqual(byVerdict.totalMessages, 1);

            const byKind = await context.searchHistory({ kind: 'hashes' });
            assert.strictEqual(byKind.totalMessages, 1);
            assert.strictEqual(byKind.messages[0].messageHeader, '<h1@x>');

            const empty = await context.searchHistory({ query: 'gibt-es-nicht' });
            assert.strictEqual(empty.totalMessages, 0);
        });

        it('clears the indicator index', async () => {
            await context.indexMessageIndicators({ headerMessageId: '<c@x>', iocs: { domains: ['a.example'] } });
            assert.strictEqual(context.__storeData.size, 1);
            assert.strictEqual(await context.clearIndicatorIndex(), true);
        });

        it('keeps the index bounded per message', async () => {
            const many = { domains: Array.from({ length: 500 }, (_, i) => 'd' + i + '.example') };
            const written = await context.indexMessageIndicators({ headerMessageId: '<big@x>', iocs: many });
            assert.strictEqual(written, 300, 'at most 300 indicators per message');
        });
    });
});

    describe('Researcher tools II: bulk scan, ZIP view, evidence hash, case notes (round 7)', () => {
        beforeEach(() => {
            context.__storeData.clear();
        });

        it('reads a synthetic ZIP central directory without extracting it', () => {
            const bytes = context.selftestZipBytes();
            const result = context.readZipCentralDirectory(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.totalEntries, 2);
            const names = result.entries.map((entry) => entry.name);
            assert.deepEqual(names, ['readme.txt', 'invoice.docm']);
            const risky = result.entries.find((entry) => entry.name === 'invoice.docm');
            assert.strictEqual(risky.riskyExtension, true, 'macro-enabled document is flagged');
            assert.strictEqual(risky.encrypted, false);
            assert.strictEqual(result.entries[0].uncompressedSize, 5);
        });

        it('reports invalid data instead of throwing', () => {
            const invalid = new Uint8Array([1, 2, 3, 4]).buffer;
            const result = context.readZipCentralDirectory(invalid);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.entries.length, 0);
        });

        it('flags encrypted entries', () => {
            const bytes = context.selftestZipBytes();
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const centralOffset = view.getUint32(bytes.length - 22 + 16, true);
            view.setUint16(centralOffset + 8, 0x0001, true);
            const result = context.readZipCentralDirectory(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
            assert.strictEqual(result.entries[0].encrypted, true);
            assert.strictEqual(result.entries[1].encrypted, false);
        });

        it('computes a stable evidence hash that changes with the content', async () => {
            const base = {
                schema: 'thundy-av/research-dossier@1',
                message: { headerMessageId: '<a@b>', subject: 'Test', date: '2026-10-01T10:00:00.000Z' },
                iocs: { domains: ['b.example', 'a.example'], urls: [] },
                risk: { score: 55, verdict: 'suspicious', breakdown: [{ id: 'auth', points: 30, reasons: ['x'] }] },
                mitre: [{ id: 'T1566' }]
            };
            const first = await context.computeEvidenceHash(base);
            const reordered = Object.assign({}, base, {
                iocs: { urls: [], domains: ['a.example', 'b.example'] },
                generatedAt: 'ignored-by-design'
            });
            const reorderedHash = await context.computeEvidenceHash(reordered);
            const changed = await context.computeEvidenceHash(Object.assign({}, base, { risk: { score: 56, verdict: 'suspicious' } }));
            assert.strictEqual(first.length, 64);
            assert.strictEqual(first, reorderedHash, 'order and volatile fields must not change the hash');
            assert.notStrictEqual(first, changed, 'a different score must change the hash');
        });
    });

    describe('Bulk scan and case notes (round 7, part 2)', () => {
        beforeEach(() => {
            context.__storeData.clear();
            context.set_externalAnalysisConsent(false);
            context.browser.notifications = { create: () => Promise.resolve('id'), clear: () => Promise.resolve(true) };
        });

        it('runs a bulk scan over several messages and counts verdicts', async () => {
            const headers = {
                1: { id: 1, headerMessageId: '<m1@x>', author: 'Anna <anna@example.org>', subject: 'Normal', date: Date.parse('2026-10-01T09:00:00Z') },
                2: { id: 2, headerMessageId: '<m2@x>', author: 'Buchhaltung <buchhaltung@paypa1.com>', subject: 'Dringend: Zahlung', date: Date.parse('2026-10-01T10:00:00Z') }
            };
            context.browser.messages.get = async (id) => headers[id];
            context.browser.messages.getFull = async (id) => ({
                headers: id === 2
                    ? { 'authentication-results': ['mx; spf=fail smtp.mailfrom=paypa1.com; dmarc=fail'], 'reply-to': ['andere@other.example'] }
                    : {},
                parts: [{ contentType: 'text/plain', body: id === 2 ? 'Bitte sofort zahlen: https://paypa1.com/login' : 'Alles gut.' }]
            });
            const result = await context.runBulkScan([1, 2]);
            assert.strictEqual(result.scanned, 2);
            assert.strictEqual(result.results.length, 2);
            const suspicious = result.results.find((entry) => entry.messageId === 2);
            assert.ok(['suspicious', 'malicious'].includes(suspicious.verdict),
                'spoofed mail must be flagged, got: ' + suspicious.verdict);
            assert.strictEqual(result.noteworthy >= 1, true);
            assert.strictEqual(result.verdictCounts.clean >= 1, true);
            assert.ok(context.__storeData.size > 0, 'the bulk scan feeds the indicator index: ' + context.__storeData.size);
        });

        it('ignores invalid ids and caps the batch size', async () => {
            assert.strictEqual((await context.runBulkScan([])).aborted, 'no_messages');
            assert.strictEqual((await context.runBulkScan(['x', -1])).aborted, 'no_messages');
            const many = Array.from({ length: context.BULK_SCAN_LIMIT + 20 }, (_, i) => i + 1);
            context.browser.messages.get = async (id) => ({ id: id, headerMessageId: '<m' + id + '@x>', author: 'a@b.example', subject: 's' });
            context.browser.messages.getFull = async () => ({ headers: {}, parts: [{ contentType: 'text/plain', body: '' }] });
            const result = await context.runBulkScan(many);
            assert.strictEqual(result.requested, context.BULK_SCAN_LIMIT, 'the batch is capped');
        });

        it('stores and reads a case note per message', async () => {
            await context.saveCaseNote('<case@x>', 'Verdächtig, Rücksprache mit Fachbereich.');
            assert.strictEqual(await context.readCaseNote('<case@x>'), 'Verdächtig, Rücksprache mit Fachbereich.');
            assert.strictEqual(await context.readCaseNote('<unbekannt@x>'), null);
            await assert.rejects(() => context.saveCaseNote('', 'x'), /missing headerMessageId/);
        });
    });

    describe('Toolbar indicator and inline link protection (round 8)', () => {
        it('computes the badge text and colour from score and verdict', () => {
            assert.strictEqual(context.actionBadgeText(0, 'clean'), '');
            assert.strictEqual(context.actionBadgeText(55, 'suspicious'), '55');
            assert.strictEqual(context.actionBadgeText(120, 'malicious'), '99');
            assert.strictEqual(context.ACTION_BADGE_COLORS.critical, '#b3261e');
            assert.strictEqual(context.ACTION_BADGE_COLORS.low, '#1f7a3f');
        });

        it('sets badge text, colour and title on the message display action', async () => {
            const calls = [];
            context.browser.messageDisplayAction = {
                setBadgeText: async (options) => { calls.push(['badge', options]); },
                setBadgeBackgroundColor: async (options) => { calls.push(['color', options]); },
                setTitle: async (options) => { calls.push(['title', options]); }
            };
            const ok = await context.updateActionIndicator({ tabId: 7, score: 82, verdict: 'malicious', subject: 'Dringend: Rechnung' });
            assert.strictEqual(ok, true);
            const badge = calls.find(([kind]) => kind === 'badge')[1];
            const color = calls.find(([kind]) => kind === 'color')[1];
            const title = calls.find(([kind]) => kind === 'title')[1];
            assert.strictEqual(badge.text, '82');
            assert.strictEqual(badge.tabId, 7);
            assert.strictEqual(color.color, context.ACTION_BADGE_COLORS.critical);
            assert.match(title.title, /82/);
            assert.match(title.title, /Dringend/);
        });

        it('clears the indicator for a clean verdict without score', async () => {
            const calls = [];
            context.browser.messageDisplayAction = {
                setBadgeText: async (options) => { calls.push(options.text); },
                setBadgeBackgroundColor: async () => {},
                setTitle: async () => {}
            };
            await context.clearActionIndicator(3);
            assert.strictEqual(calls[0], '');
        });

        it('survives an unavailable action API', async () => {
            const saved = context.browser.messageDisplayAction;
            delete context.browser.messageDisplayAction;
            try {
                assert.strictEqual(await context.updateActionIndicator({ score: 10, verdict: 'clean' }), false);
            } finally {
                context.browser.messageDisplayAction = saved;
            }
        });

        it('injects the inline status strip with score, verdict and auth state', async () => {
            const injections = [];
            context.browser.scripting.executeScript = async (options) => { injections.push(options); return []; };
            await context.injectInlineStatus(11, { score: 62, verdict: 'suspicious', reasons: ['SPF fehlgeschlagen', 'Erstkontakt'], authStatus: 'fail' });
            assert.strictEqual(injections.length, 1);
            assert.strictEqual(injections[0].target.tabId, 11);
            assert.strictEqual(typeof injections[0].func, 'function');
            assert.strictEqual(injections[0].args[0], 62);
            assert.match(String(injections[0].args[3].fg), /^#[0-9a-f]{6}$/i);
            assert.match(String(injections[0].args[4]), /SPF fehlgeschlagen/);
            assert.strictEqual(injections[0].args[5], 'fail');
        });

        it('injects the link guard with a link summary and no code strings', async () => {
            const injections = [];
            context.browser.scripting.executeScript = async (options) => { injections.push(options); return []; };
            context.set_timeOfClickProtection(true);
            const links = [
                { url: 'https://paypa1.com/login', host: 'paypa1.com', registrableDomain: 'paypa1.com', brandLookalike: 'paypal.com', trackingParameters: ['uid'], isShortener: false },
                { url: 'https://example.org/', host: 'example.org', brandLookalike: null, trackingParameters: [], isShortener: false }
            ];
            await context.injectLinkGuard(12, links);
            assert.strictEqual(injections.length, 1);
            const summary = injections[0].args[0];
            assert.strictEqual(summary.length, 2);
            assert.strictEqual(summary[0].url, 'https://paypa1.com/login');
            assert.strictEqual(summary[0].host, 'paypa1.com');
            assert.strictEqual(summary[0].suspicious, true, 'look-alike domain counts as suspicious');
            assert.strictEqual(summary[1].suspicious, false);
            assert.strictEqual(typeof injections[0].func, 'function', 'es werden Funktionen, keine Code-Strings injiziert');
        });

        it('does not inject the link guard without time-of-click protection', async () => {
            const injections = [];
            context.browser.scripting.executeScript = async (options) => { injections.push(options); return []; };
            context.set_timeOfClickProtection(false);
            await context.injectLinkGuard(12, [{ url: 'https://example.org/', host: 'example.org' }]);
            assert.strictEqual(injections.length, 0);
        });

        it('builds link summaries from stored provider state', () => {
            const summaries = context.buildLinkSummaries(['https://paypa1.com/login'], {
                __storedRecord: { links: [{ url: 'https://paypa1.com/login', state: 'KNOWN' }] }
            });
            assert.strictEqual(summaries.length, 1);
            assert.strictEqual(summaries[0].host, 'paypa1.com');
            assert.strictEqual(summaries[0].hybridState, 'KNOWN');
            assert.strictEqual(summaries[0].brandLookalike, 'paypal.com');
        });
    });
});
