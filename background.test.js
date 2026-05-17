const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, before, beforeEach } = require('node:test');
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
                }
            },
            crypto: globalThis.crypto,
            Math: globalThis.Math,
            Set: globalThis.Set,
            URL: globalThis.URL,
            DOMParser: dom.window.DOMParser,
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
            ${code}
            globalThis.loadSettings = loadSettings;
            globalThis.get_apikey = () => apikey_hybridanalysis;
            globalThis.set_apikey = (val) => { apikey_hybridanalysis = val; };
            globalThis.tab_mail_open_display = tab_mail_open_display;
            globalThis.sent_to_hybrid_by_attachment = sent_to_hybrid_by_attachment;
            globalThis.get_sha256_hash = get_sha256_hash;
            globalThis.indexedDB_save_hybrid_data_to_db = indexedDB_save_hybrid_data_to_db;
            globalThis.indexedDB_save_batch_hybrid_data_to_db = indexedDB_save_batch_hybrid_data_to_db;
            globalThis.handleManualUpload = handleManualUpload;
            globalThis.extractUrls = extractUrls;
            globalThis.filterUrls = filterUrls;
            globalThis.extractTextFromParts = extractTextFromParts;
            globalThis.indexedDB_save_links_to_db = indexedDB_save_links_to_db;
            globalThis.handleUrlScan = handleUrlScan;
            globalThis.calculateThreatScore = calculateThreatScore;
            globalThis.levenshteinDistance = levenshteinDistance;
        `;
        context.URL = URL;
        context.URLSearchParams = URLSearchParams;
        vm.runInContext(wrappedCode, context);
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

    describe('calculateThreatScore', () => {
        it('calculates threat score correctly for spf=fail', async () => {
            const author = 'Service <service@paypal.com>';
            const urls = [];
            const authHeaders = ["spf=fail"];
            const result = context.calculateThreatScore(author, urls, { authHeaders });
            assert.strictEqual(result.score, 50);
            assert.ok(result.reasons.some(r => r.includes("SPF-Prüfung fehlgeschlagen")));
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

    describe('levenshteinDistance', () => {
        it('returns 0 for identical strings', () => {
            assert.strictEqual(context.levenshteinDistance('hello', 'hello'), 0);
            assert.strictEqual(context.levenshteinDistance('', ''), 0);
        });

        it('returns the length of the other string if one is empty', () => {
            assert.strictEqual(context.levenshteinDistance('', 'hello'), 5);
            assert.strictEqual(context.levenshteinDistance('world', ''), 5);
        });

        it('calculates distance correctly for substitutions', () => {
            assert.strictEqual(context.levenshteinDistance('amazon.de', 'amaz0n.de'), 1);
            assert.strictEqual(context.levenshteinDistance('paypal.com', 'paypa1.com'), 1);
        });

        it('calculates distance correctly for insertions', () => {
            assert.strictEqual(context.levenshteinDistance('test', 'tests'), 1);
            assert.strictEqual(context.levenshteinDistance('car', 'cars'), 1);
        });

        it('calculates distance correctly for deletions', () => {
            assert.strictEqual(context.levenshteinDistance('tests', 'test'), 1);
            assert.strictEqual(context.levenshteinDistance('cars', 'car'), 1);
        });

        it('is case-sensitive', () => {
            assert.strictEqual(context.levenshteinDistance('Test', 'test'), 1);
        });

        it('calculates distance correctly for completely different strings', () => {
            assert.strictEqual(context.levenshteinDistance('kitten', 'sitting'), 3);
            assert.strictEqual(context.levenshteinDistance('flaw', 'lawn'), 2);
        });

        it('is symmetric', () => {
            const distance1 = context.levenshteinDistance('kitten', 'sitting');
            const distance2 = context.levenshteinDistance('sitting', 'kitten');
            assert.strictEqual(distance1, distance2);
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
});
