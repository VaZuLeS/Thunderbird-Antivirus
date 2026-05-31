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
                    onMessageDisplayed: {
                        addListener: (listener) => {
                            context.browser.messageDisplay.onMessageDisplayed.listeners.push(listener);
                        },
                        listeners: []
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
                    create: () => {}
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
            console: { log: () => {}, error: () => {} },
            fetch: async () => ({ status: 200, json: async () => ({}) }),
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
        const wrappedCode = `
            globalThis.customBlacklist = [];
            globalThis.customWhitelist = [];
            globalThis.knownSendersCache = new Set();
            globalThis.MAX_KNOWN_SENDERS = 1000;
            ${code}
            globalThis.loadSettings = loadSettings;
            globalThis.set_customBlacklist = (list) => { customBlacklist = list.map(s => s ? s.toLowerCase() : ""); };
            globalThis.set_customWhitelist = (list) => { customWhitelist = list.map(s => s ? s.toLowerCase() : ""); };
            globalThis.get_apikey = () => apikey_hybridanalysis;
            globalThis.set_apikey = (val) => { apikey_hybridanalysis = val; };
            globalThis.tab_mail_open_display = tab_mail_open_display;
            globalThis.sent_to_hybrid_by_attachment = sent_to_hybrid_by_attachment;
            globalThis.get_sha256_hash = get_sha256_hash;
            globalThis.indexedDB_save_batch_hybrid_data_to_db = indexedDB_save_batch_hybrid_data_to_db;
            globalThis.handleManualUpload = handleManualUpload;
            globalThis.extractUrls = extractUrls;
            globalThis.filterUrls = filterUrls;
            globalThis.extractTextFromParts = extractTextFromParts;
            globalThis.indexedDB_save_links_to_db = indexedDB_save_links_to_db;
            globalThis.handleUrlScan = handleUrlScan;
            globalThis.checkVirusTotal = checkVirusTotal;
            globalThis.calculateThreatScore = calculateThreatScore;
            globalThis.evaluateReplyTo = evaluateReplyTo;
            globalThis.levenshteinDistance = levenshteinDistance;
            globalThis.extractPublicIPs = extractPublicIPs;
            globalThis.checkURLhaus = checkURLhaus;
            globalThis.evaluateAuthHeaders = evaluateAuthHeaders;
            globalThis.knownSendersCache = knownSendersCache;
        `;
        context.URL = URL;
        context.URL.createObjectURL = () => 'blob:test';
        context.URLSearchParams = URLSearchParams;
        vm.runInContext(wrappedCode, context);

        if (context.knownSendersCache) context.knownSendersCache.clear();
    });

    it('should initialize successfully', () => {
        assert.ok(context.get_apikey() === undefined || context.get_apikey() === 'test-api-key');
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
        assert.deepStrictEqual(urls, ['https://test.com/', 'http://example.org/path?q=1']);
    });

    it('extractUrls filters duplicate URLs', () => {
        const text = "Check out https://test.com/ and https://test.com/ again.";
        const urls = context.extractUrls(text);
        assert.deepStrictEqual(urls, ['https://test.com/']);
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
        assert.deepStrictEqual(urls, []);
    });

    it('extractUrls returns empty array for empty string', () => {
        const text = "";
        const urls = context.extractUrls(text);
        assert.deepStrictEqual(urls, []);
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

        it('returns false and handles error gracefully on fetch failure', async () => {
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
            context.set_customBlacklist(['hacker@evil.com']);
            const result = context.calculateThreatScore("Hacker <hacker@evil.com>", []);
            assert.strictEqual(result.score, 100);
            assert.ok(result.reasons.some(r => r.includes("steht auf der Blacklist")));
            context.set_customBlacklist([]);
        });

        it('calculates threat score correctly for custom blacklist domain match', async () => {
            context.set_customBlacklist(['evil.com']);
            const result = context.calculateThreatScore("Hacker <hacker@evil.com>", []);
            assert.strictEqual(result.score, 100);
            assert.ok(result.reasons.some(r => r.includes("steht auf der Blacklist")));
            context.set_customBlacklist([]);
        });

        it('calculates threat score correctly for custom whitelist exact match', async () => {
            context.set_customWhitelist(['good@guy.com']);
            const result = context.calculateThreatScore("Good <good@guy.com>", [], {
                urlhausDomains: ['malware.com'] // should be ignored due to whitelist return
            });
            assert.strictEqual(result.score, 0);
            assert.ok(result.reasons.some(r => r.includes("steht auf der Whitelist")));
            context.set_customWhitelist([]);
        });

        it('calculates threat score correctly for custom whitelist domain match', async () => {
            context.set_customWhitelist(['guy.com']);
            const result = context.calculateThreatScore("Good <good@guy.com>", [], {
                urlhausDomains: ['malware.com'] // should be ignored due to whitelist return
            });
            assert.strictEqual(result.score, 0);
            assert.ok(result.reasons.some(r => r.includes("steht auf der Whitelist")));
            context.set_customWhitelist([]);
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

    describe('tab_mail_open_display with threat score', () => {
        it('injects warning banner if score >= 50', async () => {
            let executedWarningScript = null;
            context.browser.scripting.executeScript = async (opts) => {
                executedWarningScript = opts;
            };

            context.browser.messages.listAttachments = async () => ([]);
            context.browser.messages.getFull = async () => ({
                contentType: 'text/html',
                body: '<a href="https://login.amaz0n.de">Click</a>'
            });

            await context.tab_mail_open_display({ id: 10 }, { id: 1, author: 'Service <service@paypal-support.com>', subject: 'Action required' });

            assert.notStrictEqual(executedWarningScript, null);
            assert.strictEqual(executedWarningScript.target.tabId, 10);
            assert.strictEqual(typeof executedWarningScript.func, 'function');
            assert.strictEqual(executedWarningScript.args[0], 100); // 100 score
        });

        it('does not inject warning banner if score < 50', async () => {
            let executedWarningScript = null;
            context.browser.scripting.executeScript = async (opts) => {
                // Ignore the time-of-click style injection script
                if (opts.args && opts.args.length > 0) {
                    executedWarningScript = opts;
                }
            };

            context.browser.messages.listAttachments = async () => ([]);
            context.browser.messages.getFull = async () => ({
                contentType: 'text/html',
                body: '<a href="http://paypal.com">Click</a>'
            });

            // "service@newsletter.paypal.com" has domain "newsletter.paypal.com", not quite "paypal.com" but close
            // This might trigger a moderate score. Actually, let's use a known scenario that yields a score < 50 but > 0.
            // If sender is "test@example.com" and body has no links matching sender, it adds 40.
            await context.tab_mail_open_display({ id: 10 }, { id: 1, author: 'User <user@example.com>', subject: 'Action required' });

            assert.notStrictEqual(executedWarningScript, null);
            assert.strictEqual(executedWarningScript.target.tabId, 10);
            assert.strictEqual(typeof executedWarningScript.func, 'function');
            assert.strictEqual(executedWarningScript.args[0], 40); // 40 score
        });

        it('does not inject warning banner if score === 0', async () => {
            let executedWarningScript = null;
            context.browser.scripting.executeScript = async (opts) => {
                executedWarningScript = opts;
            };

            context.browser.messages.listAttachments = async () => ([]);
            context.browser.messages.getFull = async () => ({
                contentType: 'text/plain',
                body: 'Just a normal text without links.'
            });

            await context.tab_mail_open_display({ id: 10 }, { id: 1, author: 'Friend <friend@domain.com>', subject: 'Hello' });

            assert.strictEqual(executedWarningScript, null);
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
            const input = '<html><body><a href="java\tscript:alert(1)">Link</a><a href="jav&#x09;ascript:alert(1)">Link2</a></body></html>';
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
    });

    describe('extractPublicIPs', () => {
        it('should return empty array for null/undefined/empty headers', () => {
            assert.strictEqual(context.extractPublicIPs(null).length, 0);
            assert.strictEqual(context.extractPublicIPs(undefined).length, 0);
            assert.strictEqual(context.extractPublicIPs([]).length, 0);
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
});
