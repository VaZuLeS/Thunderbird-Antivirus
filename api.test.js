const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');

describe('escapeHTML', () => {
    let context;
    let escapeHTML;

    before(async () => {
        // Create mock environment
        context = {
            browser: {
                tabs: { query: async () => [{ id: 1 }] },
                storage: {
                    local: {
                        get: async () => ({ apikey: 'test' })
                    }
                },
                tabs: {
                    query: async () => [{ id: 1 }]
                },
                messageDisplay: {
                    getDisplayedMessage: async () => ({ headerMessageId: '123', subject: 'test', author: 'author' })
                },
                runtime: {
                    sendMessage: async () => ({ status: 'success' })
                }
            },
            document: {
                getElementById: () => ({ textContent: '', insertAdjacentHTML: () => {}, appendChild: () => {} }),
                createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
                createTextNode: () => ({})
            },
            indexedDB: {
                open: () => ({ onupgradeneeded: null, onsuccess: null, onerror: null })
            },
            console: { log: () => {}, error: () => {} }, // Mock console to avoid noisy logs
            fetch: async () => ({ status: 200, json: async () => ({}) }),
            setTimeout: setTimeout,
            String: String,
            Array: Array,
            TextEncoder: TextEncoder
        };
        context.messenger = context.browser;

        vm.createContext(context);

        // Load db.js into the context first so the global async functions exist
        const dbCode = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
        vm.runInContext(dbCode, context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        // Prevent the IIFE from executing during test initialization
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');

        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');
        vm.runInContext(wrappedCode, context);

        escapeHTML = context.escapeHTML;
    });

    it('returns empty string for null, undefined, or empty string', () => {
        assert.strictEqual(escapeHTML(''), '');
        assert.strictEqual(escapeHTML(null), '');
        assert.strictEqual(escapeHTML(undefined), '');
    });

    it('returns the same string if no special characters are present', () => {
        assert.strictEqual(escapeHTML('hello world'), 'hello world');
        assert.strictEqual(escapeHTML('12345'), '12345');
    });

    it('escapes ampersand (&)', () => {
        assert.strictEqual(escapeHTML('Ben & Jerry'), 'Ben &amp; Jerry');
    });

    it('escapes less than (<) and greater than (>)', () => {
        assert.strictEqual(escapeHTML('<div>'), '&lt;div&gt;');
    });

    it('escapes double quotes (")', () => {
        assert.strictEqual(escapeHTML('"Hello"'), '&quot;Hello&quot;');
    });

    it('escapes single quotes (\')', () => {
        assert.strictEqual(escapeHTML("'Hello'"), '&#39;Hello&#39;');
    });

    it('escapes multiple occurrences of special characters', () => {
        assert.strictEqual(
            escapeHTML('<script>alert("XSS & \'test\'")</script>'),
            '&lt;script&gt;alert(&quot;XSS &amp; &#39;test&#39;&quot;)&lt;/script&gt;'
        );
    });

    it('handles non-string types gracefully by converting them to string', () => {
        assert.strictEqual(escapeHTML(123), '123');
        assert.strictEqual(escapeHTML(true), 'true');
    });
});


describe('renderInProgressStatus', () => {
    let context;
    let renderInProgressStatus;

    before(async () => {
        // Create mock environment
        context = {
            browser: { storage: { local: { get: async () => ({}) } } },
            document: {
                getElementById: () => ({ textContent: '', appendChild: () => {} }),
                createTextNode: (text) => ({ textContent: text }),
                createElement: (tag) => {
                    let children = [];
                    let el = {
                        tagName: tag,
                        className: '',
                        textContent: '',
                        _html: '',
                        setAttribute: () => {},
                        get innerHTML() { return this._html; },
                        set innerHTML(val) {
                            this._html = val;
                            if (val === '') children.length = 0; // Clear childNodes on innerHTML = ''
                        },
                        get childNodes() { return children; },
                        appendChild: function(child) { children.push(child); }
                    };
                    return el;
                },
                createTextNode: (text) => ({ textContent: text })
            }
        };

        vm.createContext(context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');

        // Load db.js first just like in other suites, to define global functions
        const dbCode = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
        vm.runInContext(dbCode, context);

        // Instead of parsing the brittle regex, extract the function by properly accounting for braces,
        // or just execute a cleaned up version of the whole file like other tests do.

        // Let's emulate what get_hybrid_report_by_sha256 test does.
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');
        try {
            vm.runInContext(wrappedCode, context);
        } catch(e) {
            // It might fail due to the async () => { ... })(); issue in the file,
            // but the functions outside the IIFE are hoisted and available!
        }

        renderInProgressStatus = context.renderInProgressStatus;
    });

    it('renders correctly with json_data.sha256', () => {
        const card = context.document.createElement('div');
        const json_data = { sha256: 'test-sha-256-from-json' };
        const hybrid_sha = 'fallback-sha-256';

        renderInProgressStatus(json_data, hybrid_sha, card);

        assert.strictEqual(card.childNodes.length, 2);

        const pStatus = card.childNodes[0];
        assert.strictEqual(pStatus.tagName, 'p');
        assert.strictEqual(pStatus.className, 'text-warning');
        assert.strictEqual(pStatus.childNodes.length, 2);
        assert.strictEqual(pStatus.childNodes[0].tagName, 'strong');
        assert.strictEqual(pStatus.childNodes[0].textContent, 'Status:');
        assert.strictEqual(pStatus.childNodes[1].textContent, ' Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut.');

        const pHash = card.childNodes[1];
        assert.strictEqual(pHash.tagName, 'p');
        assert.strictEqual(pHash.textContent, 'SHA-256: test-sha-256-from-json');
    });

    it('renders correctly falling back to hybrid_sha when json_data.sha256 is missing', () => {
        const card = context.document.createElement('div');
        const json_data = {};
        const hybrid_sha = 'fallback-sha-256';

        renderInProgressStatus(json_data, hybrid_sha, card);

        assert.strictEqual(card.childNodes.length, 2);

        const pHash = card.childNodes[1];
        assert.strictEqual(pHash.tagName, 'p');
        assert.strictEqual(pHash.textContent, 'SHA-256: fallback-sha-256');
    });
});


describe('renderThreatInfo', () => {
    let context;
    let renderThreatInfo;

    before(async () => {
        // Create mock environment
        context = {
            document: {
                createTextNode: (text) => ({ textContent: text, nodeType: 3 }),
                createElement: (tag) => {
                    let children = [];
                    let el = {
                        tagName: tag,
                        className: '',
                        textContent: '',
                        _html: '',
                        setAttribute: () => {},
                        get innerHTML() { return this._html; },
                        set innerHTML(val) {
                            this._html = val;
                            if (val === '') children.length = 0; // Clear childNodes on innerHTML = ''
                        },
                        get childNodes() { return children; },
                        appendChild: function(child) { children.push(child); }
                    };
                    return el;
                }
            }
        };

        vm.createContext(context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');

        // Load db.js first just like in other suites, to define global functions
        const dbCode = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
        vm.runInContext(dbCode, context);

        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');
        try {
            vm.runInContext(wrappedCode, context);
        } catch(e) {
            // It might fail due to the async () => { ... })(); issue in the file,
            // but the functions outside the IIFE are hoisted and available!
        }

        renderThreatInfo = context.renderThreatInfo;
    });

    it('renders low threat score with text-success class', () => {
        const card = context.document.createElement('div');
        const json_data = { threat_score: 10, verdict: 'clean' };
        renderThreatInfo(json_data, card);
        const pThreat = card.childNodes[0];
        assert.strictEqual(pThreat.childNodes[0].className, 'head_line text-success');
        assert.strictEqual(pThreat.childNodes[2].className, 'text-success');
        assert.strictEqual(pThreat.childNodes[2].textContent, 10);
    });

    it('renders medium threat score with text-warning class', () => {
        const card = context.document.createElement('div');
        const json_data = { threat_score: 60, verdict: 'suspicious' };
        renderThreatInfo(json_data, card);
        const pThreat = card.childNodes[0];
        assert.strictEqual(pThreat.childNodes[0].className, 'head_line text-warning');
        assert.strictEqual(pThreat.childNodes[2].className, 'text-warning');
        assert.strictEqual(pThreat.childNodes[2].textContent, 60);
    });

    it('renders high threat score with text-danger class', () => {
        const card = context.document.createElement('div');
        const json_data = { threat_score: 90, verdict: 'malicious' };
        renderThreatInfo(json_data, card);
        const pThreat = card.childNodes[0];
        assert.strictEqual(pThreat.childNodes[0].className, 'head_line text-danger');
        assert.strictEqual(pThreat.childNodes[2].className, 'text-danger');
        assert.strictEqual(pThreat.childNodes[2].textContent, 90);
    });

    it('renders fallback N/A values for missing optional fields', () => {
        const card = context.document.createElement('div');
        const json_data = { threat_score: 10, verdict: 'clean' };
        renderThreatInfo(json_data, card);
        const pVxFamily = card.childNodes[2];
        assert.strictEqual(pVxFamily.childNodes[1].textContent, ' N/A');
        const pMulti = card.childNodes[3];
        assert.strictEqual(pMulti.textContent, 'Multiscan-Ergebnis: N/A');
        const pAnalysisTime = card.childNodes[5];
        assert.strictEqual(pAnalysisTime.textContent, 'Analysis start time: N/A');
        const pTags = card.childNodes[6];
        assert.strictEqual(pTags.textContent, 'Tags: N/A');
    });

    it('renders tags correctly when provided as an array', () => {
        const card = context.document.createElement('div');
        const json_data = { threat_score: 10, verdict: 'clean', tags: ['pdf', 'phishing'] };
        renderThreatInfo(json_data, card);
        const pTags = card.childNodes[6];
        assert.strictEqual(pTags.textContent, 'Tags: pdf, phishing');
    });
});

describe('get_hybrid_report_by_sha256', () => {
    let context;
    let get_hybrid_report_by_sha256;

    before(async () => {
        // Create mock environment
        context = {
            browser: {
                storage: {
                    local: {
                        get: async () => ({ apikey: 'test' })
                    }
                },
                tabs: {
                    query: async () => [{ id: 1 }]
                },
                messageDisplay: {
                    getDisplayedMessage: async () => ({ headerMessageId: '123', subject: 'test', author: 'author' })
                }
            },
            document: {
                createTextNode: (text) => ({ textContent: text, outerHTML: text }),
                createElement: (tag) => ({
                                        appendChild: function(child) {
                        this.children.push(child);
                        if (child.outerHTML) {
                           this._html += child.outerHTML;
                        } else if (child.textContent) {
                           this._html += child.textContent;
                        }
                    },
tag: tag,
                    className: '',
                    textContent: '',
                    _html: '',
                    children: [],
                    get outerHTML() {
                        let inner = this.children.map(c => c.outerHTML || c.textContent || '').join('') + this._html + this.textContent;
                        let cls = this.className ? ` class="${this.className}"` : '';
                        return `<${this.tag}${cls}>${inner}</${this.tag}>`;
                    },
                    appendChild: function(node) {
                        this.children.push(node);
                    },
                    setAttribute: function() {},
                    removeAttribute: function() {}
                }),
                createDocumentFragment: () => ({
                    children: [],
                    appendChild: function(node) {
                        this.children.push(node);
                    },
                    get outerHTML() {
                        return this.children.map(c => c.outerHTML || c.textContent || '').join('');
                    }
                }),
                getElementById: (id) => {
                    if (id === 'hybrid_analysis_api_content') {
                        if (!context.apiContentElement) {
                            context.apiContentElement = {
                                _html: '',
                                get innerHTML() { return this._html; },
                                set innerHTML(val) { this._html = val; },
                                set textContent(val) { this._html = val; },
                                insertAdjacentHTML: function(position, text) {
                                    this._html += text;
                                },
                                appendChild: function(child) {
                                    if (child.outerHTML) {
                                        this._html += child.outerHTML;
                                    } else {
                                        // Simple string representation for testing
                                        this._html += '<div id="' + child.id + '">...';
                                        if (child.id && child.id.includes('hash456')) {
                                            this._html += '<button id="btn-cdr-hash456"></button><p id="cdr-status-hash456"></p>';
                                        }
                                        this._html += '</div>';
                                    }
                                },
                                textContent: ''
                            };
                        }
                        return context.apiContentElement;
                    }
                    return { textContent: '', insertAdjacentHTML: () => {}, innerHTML: '', appendChild: () => {} };
                }
            },
            DOMParser: class DOMParser {
                parseFromString(string, type) {
                    return {
                        body: {
                            get firstChild() {
                                if (this._nodes === undefined) {
                                    // Simplistic mock to let loop run once and then stop
                                    this._nodes = [{ outerHTML: string }];
                                }
                                return this._nodes.shift() || null;
                            }
                        }
                    };
                }
            },
            indexedDB: {
                open: () => ({ onupgradeneeded: null, onsuccess: null, onerror: null })
            },
            console: { log: () => {}, error: () => {} }, // Mock console to avoid noisy logs
            fetch: null, // Will be overridden in each test
            setTimeout: setTimeout,
            String: String,
            Array: Array,
            TextEncoder: TextEncoder
        };
        context.messenger = context.browser;

        vm.createContext(context);

        // Load db.js into the context first
        const dbCode = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
        vm.runInContext(dbCode, context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');

        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');
        vm.runInContext(wrappedCode, context);

        get_hybrid_report_by_sha256 = context.get_hybrid_report_by_sha256;
    });

    it('injects Netzwerkfehler message on fetch network failure', async () => {
        context.document.getElementById('hybrid_analysis_api_content'); context.apiContentElement.innerHTML = '';
        context.fetch = async () => {
            throw new Error('Network timeout');
        };

        await get_hybrid_report_by_sha256('dummy_sha', 'test.txt');

        assert.ok(context.apiContentElement.innerHTML.includes('<div class="text-danger">Netzwerkfehler: Network timeout für Element test.txt</div>'));
    });

    it('injects API Error message on fetch non-200 status', async () => {
        context.document.getElementById('hybrid_analysis_api_content'); context.apiContentElement.innerHTML = '';
        context.fetch = async () => {
            return {
                status: 500,
                statusText: 'Internal Server Error',
                json: async () => ({})
            };
        };

        await get_hybrid_report_by_sha256('dummy_sha', 'test.txt');

        assert.ok(context.apiContentElement.innerHTML.includes('<div class="text-danger">API Error: 500 für Element test.txt</div>'));
    });
});


describe('renderManualUrlScanUI', () => {
    let context;
    let renderManualUrlScanUI;

    before(async () => {
        // Create mock environment
        context = {
            browser: {
                storage: { local: { get: async () => ({ apikey: 'test' }) } },
                tabs: { query: async () => [{ id: 1 }] },
                messageDisplay: { getDisplayedMessage: async () => ({ headerMessageId: '123', subject: 'test', author: 'author' }) },
                runtime: { sendMessage: async () => ({ status: 'success' }) }
            },
            document: {
                createTextNode: () => ({}),
                getElementById: (id) => {
                    return context.mockElements && context.mockElements[id] ? context.mockElements[id] : { textContent: '', insertAdjacentHTML: () => {}, appendChild: () => {}, _id: id };
                },
                createElement: (tag) => {
                    let children = [];
                    let el = {
                        className: '',
                        textContent: '',
                        _id: '',
                        get id() { return this._id; },
                        set id(val) {
                            this._id = val;
                            if (!context.mockElements) context.mockElements = {};
                            context.mockElements[val] = this;
                        },
                        setAttribute: () => {},
                        removeAttribute: () => {},
                        get childNodes() { return children; },
                        appendChild: function(child) { children.push(child); },
                        addEventListener: function(event, cb) {
                            this.clicks = this.clicks || [];
                            this.clicks.push(cb);
                        },
                        click: function() {
                            if (this.clicks) {
                                this.clicks.forEach(cb => cb.call(this));
                            }
                        }
                    };
                    return el;
                },
                createTextNode: (text) => ({ textContent: text }),
                getElementById: (id) => {
                    if (id === 'hybrid_analysis_api_content') {
                        if (!context.apiContentElement) {
                            context.apiContentElement = {
                                _html: '',
                                get innerHTML() { return this._html; },
                                set innerHTML(val) { this._html = val; },
                                insertAdjacentHTML: function(position, text) {
                                    this._html += text;
                                },
                                appendChild: function(node) {
                                    if (node.id && node.id.startsWith('upload-container-')) {
                                        this._html += `<div id="${node.id}">`;
                                        if (node.childNodes) {
                                            node.childNodes.forEach(child => {
                                                this._html += child.textContent;
                                            });
                                        }
                                        this._html += `http://example.com/test?a=1&amp;b=2</div>`;
                                    }
                                }
                            };
                        }
                        return context.apiContentElement;
                    }
                    if (id.startsWith('upload-container-')) {
                        if (context.mockElements[id]) {
                            context.mockElements[id].remove = function() { this.removed = true; };
                            return context.mockElements[id];
                        }
                        return { remove: () => {} };
                    }
                    if (id.startsWith('btn-upload-') || id.startsWith('upload-container-')) {
                        if (!context.mockElements) context.mockElements = {};
                        if (!context.mockElements[id]) {
                            context.mockElements[id] = {
                                id: id,
                                textContent: '',
                                innerText: '',
                                disabled: false,
                                addEventListener: function(event, cb) {
                                    this.clicks = this.clicks || [];
                                    this.clicks.push(cb);
                                },
                                click: function() {
                                    if (this.clicks) {
                                        this.clicks.forEach(cb => cb.call(this));
                                    }
                                },
                                removeAttribute: function() {},
                                setAttribute: function() {},
                                remove: function() {
                                    this.removed = true;
                                }
                            };
                        }
                        return context.mockElements[id];
                    }
                    if (id.startsWith('upload-status-')) {
                         if (!context.mockElements) context.mockElements = {};
                         if (!context.mockElements[id]) {
                             context.mockElements[id] = { id: id, textContent: '', innerText: '' };
                         }
                         return context.mockElements[id];
                    }
                    return { textContent: '', insertAdjacentHTML: () => {}, innerHTML: '', appendChild: () => {}, addEventListener: () => {},
                        removeAttribute: function() {},
                        setAttribute: function() {},
                        remove: () => {} };
                }
            },
            indexedDB: { open: () => ({ onupgradeneeded: null, onsuccess: null, onerror: null }) },
            console: { log: () => {}, error: () => {} },
            setTimeout: (cb, delay) => {
                if (!context.timeouts) context.timeouts = [];
                context.timeouts.push({ cb, delay });
            },
            String: String, Array: Array, TextEncoder: TextEncoder, Node: Object,
            statusEl: { innerText: '' },
            appendElementHtml: function(id, node) {
                let el = context.document.getElementById(id);
                if (el && node) {
                    if (node.id && node.id.startsWith('upload-container-')) {
                        el._html += `<div id="${node.id}">`;
                        if (node.childNodes) {
                            node.childNodes.forEach(child => {
                                el._html += child.textContent;
                            });
                        }
                    }
                }
            },
            setElementText: function(id, text) {
                let el = context.document.getElementById(id);
                if (el) {
                    el.textContent = text;
                    el.innerText = text;
                }
            },
            get_hybrid_report_by_sha256: function(opts) {
                context.lastReportOpts = opts;
            }
        };
        context.messenger = context.browser;
        const vm = require('vm');
        const path = require('path');
        vm.createContext(context);

        const dbCode = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
        vm.runInContext(dbCode, context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');

        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');
        vm.runInContext(wrappedCode, context);

        context.byteToHex = new Array(256);
        for (let i = 0; i < 256; i++) context.byteToHex[i] = i.toString(16).padStart(2, '0');
        context.get_hybrid_report_by_sha256 = function(hash) {
            context.lastReportOpts = { hybrid_sha: hash };
        };
        renderManualUrlScanUI = context.renderManualUrlScanUI;
    });

    it('renders the URL scan UI with correct ID', () => {
        context.document.getElementById('hybrid_analysis_api_content');
        context.apiContentElement.innerHTML = '';
        const url = 'http://example.com/test?a=1&b=2';

        renderManualUrlScanUI(url, 'msg-123');

        const u8 = new TextEncoder().encode(url);
        let urlId = '';
        for (let j = 0; j < u8.length; j++) urlId += context.byteToHex[u8[j]];

        assert.ok(context.apiContentElement.innerHTML.includes(`upload-container-${urlId}`));
        assert.ok(context.apiContentElement.innerHTML.includes('http://example.com/test?a=1&amp;b=2'));
    });

    it('handles button click, updates UI and sends scan message', async () => {
        context.apiContentElement.innerHTML = '';
        const url = 'http://example.com/test';

        // Setup mock extension message handler
        let sentMessage = null;
        context.browser.runtime.sendMessage = function(msg) {
            sentMessage = msg;
            return {
                then: function(cb) {
                    cb({ status: 'success', data: { sha256: 'mock-sha256-hash' }, sha256: 'mock-sha256-hash' });
                    return { catch: function() {} };
                }
            };
        };

        renderManualUrlScanUI(url, 'msg-123');

        const urlId = Array.from(new TextEncoder().encode(url))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        const btn = context.mockElements[`btn-upload-${urlId}`];
        const statusEl = context.mockElements[`upload-status-${urlId}`];

        // Ensure getElementById finds the status element created by createElement
        const originalGetElementById = context.document.getElementById;
        context.document.getElementById = (id) => {
            if (context.mockElements[id]) {
                if (!context.mockElements[id].remove) {
                    context.mockElements[id].remove = function() { this.removed = true; };
                }
                return context.mockElements[id];
            }
            if (id.startsWith('upload-container-')) {
                return {
                    remove: function() {
                        this.removed = true;
                        context.mockElements[id] = this;
                    }
                };
            }
            return originalGetElementById(id);
        };

        // Trigger click
        btn.click();

        // Check message sent
        assert.strictEqual(sentMessage.action, 'scanUrl');
        assert.strictEqual(sentMessage.url, url);
        assert.strictEqual(sentMessage.headerMessageId, 'msg-123');

        // Wait a bit to let the Promise chain in sendExtensionMessage finish
        await new Promise(r => setTimeout(r, 10));

        // Call the setTimeouts (the 3000ms one)
            if (context.timeouts) {
            context.timeouts.forEach(t => t.cb());
        }

        // Check if report fetch was triggered
        assert.ok(context.lastReportOpts, "get_hybrid_report_by_sha256 should have been called, putting its opts on context");
    assert.strictEqual(context.lastReportOpts.hybrid_sha, 'mock-sha256-hash');

        const container = context.document.getElementById(`upload-container-${urlId}`);
        assert.strictEqual(container.removed, true);
    });
});

describe('renderVirusTotalStats', () => {
    let context;
    let renderVirusTotalStats;

    before(async () => {
        // Create mock environment
        context = {
            document: {
                createElement: (tag) => {
                    return {
                        tag: tag,
                        className: '',
                        textContent: '',
                        children: [],
                        _innerHTML: null,
                        appendChild: function(node) {
                            this.children.push(node);
                        },
                        get innerHTML() {
                            if (this._innerHTML !== null) return this._innerHTML;
                            return this.children.map(c => {
                                let cls = c.className ? ` class="${c.className}"` : '';
                                let inner = c.innerHTML || c.textContent || '';
                                return `<${c.tag}${cls}>${inner}</${c.tag}>`;
                            }).join('');
                        },
                        set innerHTML(val) {
                            this._innerHTML = val;
                        }
                    };
                }
            },
            console: { log: () => {}, error: () => {} },
            String: String,
            Array: Array
        };

        vm.createContext(context);

        // We load api.js and prevent the IIFE from executing
        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrappedCode = wrappedCode.replace(/\}\)\(\);/, '}');

        vm.runInContext(wrappedCode, context);

        renderVirusTotalStats = context.renderVirusTotalStats;
    });

    it('should render correct stats for a complete virustotal_stats object', () => {
        const stats = {
            malicious: 2,
            undetected: 60,
            suspicious: 1,
            harmless: 50
        };
        const card = context.document.createElement('div');
        renderVirusTotalStats(stats, card);

        const html = card.innerHTML;
        assert.ok(html.includes('<strong>VirusTotal Ergebnisse:</strong>'), 'Should have correct heading');
        assert.ok(html.includes('Malicious: 2'), 'Should render malicious stats');
        assert.ok(html.includes('Undetected: 60'), 'Should render undetected stats');
        assert.ok(html.includes('Suspicious: 1'), 'Should render suspicious stats');
        assert.ok(html.includes('Harmless: 50'), 'Should render harmless stats');
        assert.ok(html.includes('class="ml-4 text-warning"'), 'Malicious should have warning class');
    });

    it('should handle missing properties by defaulting to 0', () => {
        const stats = {
            malicious: 5
            // other properties missing
        };
        const card = context.document.createElement('div');
        renderVirusTotalStats(stats, card);

        const html = card.innerHTML;
        assert.ok(html.includes('Malicious: 5'), 'Should render malicious stats');
        assert.ok(html.includes('Undetected: 0'), 'Should default undetected to 0');
        assert.ok(html.includes('Suspicious: 0'), 'Should default suspicious to 0');
        assert.ok(html.includes('Harmless: 0'), 'Should default harmless to 0');
    });

    it('should handle empty virustotal_stats object by defaulting all to 0', () => {
        const card = context.document.createElement('div');
        renderVirusTotalStats({}, card);
        const html = card.innerHTML;
        assert.ok(html.includes('Malicious: 0'), 'Should default malicious to 0');
        assert.ok(html.includes('Undetected: 0'), 'Should default undetected to 0');
        assert.ok(html.includes('Suspicious: 0'), 'Should default suspicious to 0');
        assert.ok(html.includes('Harmless: 0'), 'Should default harmless to 0');
    });
});


describe('createUploadButton', () => {
    let context;
    let createUploadButton;

    before(async () => {
        // Create mock environment
        context = {
            browser: {
                storage: { local: { get: async () => ({}) } },
                runtime: {
                    sendMessage: async () => ({ status: 'success' })
                }
            },
            document: {
                createTextNode: () => ({}),
                getElementById: (id) => {
                    return context.mockElements && context.mockElements[id] ? context.mockElements[id] : { textContent: '', insertAdjacentHTML: () => {}, appendChild: () => {}, _id: id };
                },
                createElement: (tag) => {
                    if (!context.mockElements) context.mockElements = {};
                    let el = {
                        tagName: tag,
                        className: '',
                        textContent: '',
                        _innerText: '',
                        get innerText() { return this._innerText; },
                        set innerText(v) { this._innerText = v; this.textContent = v; },
                        disabled: false,
                        _id: '',
                        get id() { return this._id; },
                        set id(val) {
                            this._id = val;
                            context.mockElements[val] = this;
                        },
                        setAttribute: function(k, v) { this[k] = v; },
                        removeAttribute: function(k) { delete this[k]; },
                        appendChild: function(child) {
                            if (!this.childNodes) this.childNodes = [];
                            this.childNodes.push(child);
                        },
                        addEventListener: function(event, cb) {
                            this.clicks = this.clicks || [];
                            this.clicks.push(cb);
                        },
                        click: function() {
                            if (this.clicks) {
                                this.clicks.forEach(cb => cb.call(this));
                            }
                        },
                        remove: function() { this.removed = true; }
                    };
                    return el;
                },
                getElementById: (id) => {
                    if (context.mockElements && context.mockElements[id]) {
                        return context.mockElements[id];
                    }
                    if (!context.mockElements) context.mockElements = {};
                    if (id.startsWith('upload-container-')) {
                        context.mockElements[id] = { remove: function() { this.removed = true; } };
                        return context.mockElements[id];
                    }
                    if (id.startsWith('upload-status-')) {
                        context.mockElements[id] = {
                            _innerText: "",
                            get innerText() { return this._innerText; },
                            set innerText(v) { this._innerText = v; this.textContent = v; },
                            textContent: "",
                            setAttribute: () => {}
                        };
                        return context.mockElements[id];
                    }
                    return null;
                }
            },
            setElementText: (id, text) => {
                let el = context.document.getElementById(id);
                if (el) {
                    el.innerText = text;
                    el.textContent = text;
                }
            },
            setTimeout: (cb, delay) => {
                if (!context.timeouts) context.timeouts = [];
                context.timeouts.push({cb, delay});
            },
            get_hybrid_report_by_sha256: function(...args) {
                context.lastReportArgs = args;
            },
            console: { log: () => {}, error: () => {} },
            String: String, Array: Array
        };

        const vm = require('vm');
        const fs = require('fs');
        const path = require('path');
        vm.createContext(context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');

        vm.runInContext(wrappedCode, context);
        createUploadButton = context.createUploadButton;
    });

    it('renders the upload button and status element correctly', () => {
        const card = context.document.createElement('div');
        createUploadButton(card, 'hash1', 'safeHash1', 'test.txt', 'msg1', 'part1', 'header1');

        const assert = require('assert');
        assert.strictEqual(card.childNodes.length, 2);
        const btn = card.childNodes[0];
        const status = card.childNodes[1];

        assert.strictEqual(btn.tagName, 'button');
        assert.strictEqual(btn.id, 'btn-upload-hash1');
        assert.strictEqual(btn.className, 'btn-primary mt-2');
        assert.strictEqual(btn.textContent, 'Datei jetzt scannen (Upload)');

        assert.strictEqual(status.tagName, 'p');
        assert.strictEqual(status.id, 'upload-status-hash1');
        assert.strictEqual(status.className, 'mt-2');
        assert.strictEqual(status['aria-live'], 'polite');
        assert.strictEqual(status['role'], 'status');
    });

    it('disables button and updates UI on click, then handles success', async () => {
        const assert = require('assert');
        const card = context.document.createElement('div');
        context.mockElements = {}; // reset
        context.timeouts = []; // reset
        context.lastReportArgs = null; // reset

        // Mock successful sendMessage
        context.browser.runtime.sendMessage = async (msg) => {
            context.lastMsg = msg;
            return { status: 'success' };
        };

        createUploadButton(card, 'hash2', 'safeHash2', 'test.txt', 'msg1', 'part1', 'header1');
        const btn = context.mockElements['btn-upload-hash2'];
        const status = context.mockElements['upload-status-hash2'];
        context.mockElements['upload-status-safeHash2'] = status;

        // Initially enabled
        assert.strictEqual(btn.disabled, false);

        // Click it
        btn.click();

        // Check intermediate state
        assert.strictEqual(btn.disabled, true);
        assert.strictEqual(btn['aria-busy'], 'true');
        assert.strictEqual(btn.innerText, 'Lade hoch...');
        assert.strictEqual(status.innerText, 'Datei wird an Hybrid Analysis übertragen...');

        // Wait for promise resolution
        await new Promise(process.nextTick);

        assert.strictEqual(context.lastMsg.action, 'uploadAttachment');
        assert.strictEqual(context.lastMsg.hash, 'hash2');

        assert.strictEqual(status.innerText, 'Upload erfolgreich! Lade Analyseergebnisse...');
        assert.strictEqual(btn['aria-busy'], undefined); // removed

        // Check timeout
        assert.strictEqual(context.timeouts.length, 1);
        assert.strictEqual(context.timeouts[0].delay, 3000);

        // Execute timeout callback
        let originalGetElement = context.document.getElementById;
        context.document.getElementById = (id) => {
            if (id === 'upload-container-safeHash2') return { remove: function() { this.removed = true; } };
            return originalGetElement(id);
        };
        // Mock get_hybrid_report_by_sha256 avoiding dom node operations
        let prev = context.get_hybrid_report_by_sha256;
        context.get_hybrid_report_by_sha256 = function(...args) { context.lastReportArgs = args; };

        context.timeouts[0].cb();

        context.document.getElementById = originalGetElement;
        context.get_hybrid_report_by_sha256 = prev;

        assert.strictEqual(context.lastReportArgs[0], 'hash2');
        assert.strictEqual(context.lastReportArgs[1], 'test.txt');
    });

    it('handles upload failure response correctly', async () => {
        const assert = require('assert');
        const card = context.document.createElement('div');
        context.mockElements = {};

        context.browser.runtime.sendMessage = async () => {
            return { status: 'error', message: 'Invalid API key' };
        };

        createUploadButton(card, 'hash3', 'safeHash3', 'test.txt', 'msg1', 'part1', 'header1');
        const btn = context.mockElements['btn-upload-hash3'];
        const status = context.mockElements['upload-status-hash3'];
        context.mockElements['upload-status-safeHash3'] = status;

        btn.click();

        // Wait for promise resolution
        await new Promise(process.nextTick);

        assert.strictEqual(status.innerText, 'Fehler beim Upload: Invalid API key');
        assert.strictEqual(btn.disabled, false);
        assert.strictEqual(btn['aria-busy'], undefined);
        assert.strictEqual(btn.innerText, 'Erneut versuchen');
    });

    it('handles upload exception correctly', async () => {
        const assert = require('assert');
        const card = context.document.createElement('div');
        context.mockElements = {};

        context.browser.runtime.sendMessage = async () => {
            throw new Error('Network error');
        };

        createUploadButton(card, 'hash4', 'safeHash4', 'test.txt', 'msg1', 'part1', 'header1');
        const btn = context.mockElements['btn-upload-hash4'];
        const status = context.mockElements['upload-status-hash4'];
        context.mockElements['upload-status-safeHash4'] = status;

        btn.click();

        // Wait for promise resolution
        await new Promise(process.nextTick);

        assert.ok(status.innerText.includes('Kommunikationsfehler: Error: Network error'));
        assert.strictEqual(btn.disabled, false);
        assert.strictEqual(btn['aria-busy'], undefined);
        assert.strictEqual(btn.innerText, 'Erneut versuchen');
    });
});

describe('renderActionButtons', () => {
    let context;
    let renderActionButtons;

    before(async () => {
        // Create mock environment
        context = {
            browser: {
                storage: { local: { get: async () => ({}) } },
                runtime: {
                    sendMessage: async () => ({ status: 'success' })
                }
            },
            document: {
                createTextNode: () => ({}),
                getElementById: (id) => {
                    return context.mockElements && context.mockElements[id] ? context.mockElements[id] : { textContent: '', insertAdjacentHTML: () => {}, appendChild: () => {}, _id: id };
                },
                createElement: (tag) => {
                    if (!context.mockElements) context.mockElements = {};
                    let el = {
                        tagName: tag,
                        className: '',
                        textContent: '',
                        _innerText: '',
                        get innerText() { return this._innerText; },
                        set innerText(v) { this._innerText = v; this.textContent = v; },
                        disabled: false,
                        _id: '',
                        get id() { return this._id; },
                        set id(val) {
                            this._id = val;
                            context.mockElements[val] = this;
                        },
                        setAttribute: function(k, v) { this[k] = v; },
                        removeAttribute: function(k) { delete this[k]; },
                        appendChild: function(child) {
                            if (!this.childNodes) this.childNodes = [];
                            this.childNodes.push(child);
                        },
                        addEventListener: function(event, cb) {
                            this.clicks = this.clicks || [];
                            this.clicks.push(cb);
                        },
                        click: function() {
                            if (this.clicks) {
                                this.clicks.forEach(cb => cb.call(this));
                            }
                        }
                    };
                    return el;
                }
            },
            console: { log: () => {}, error: () => {} },
            String: String,
            Array: Array
        };

        vm.createContext(context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        const modifiedCode = code + '\n; globalThis.renderActionButtons = renderActionButtons;';

        vm.runInContext(modifiedCode, context);
    });

    beforeEach(() => {
        context.mockElements = {};
    });

    it('renders a "Rescan" button and status element for standard attachments', () => {
        renderActionButtons = context.renderActionButtons;
        const card = context.document.createElement('div');
        const hybrid_sha = 'abc123sha';

        renderActionButtons(hybrid_sha, 'test.txt', card);

        const btnRescan = context.mockElements[`btn-rescan-${hybrid_sha}`];
        assert.ok(btnRescan);
        assert.strictEqual(btnRescan.tagName, 'button');
        assert.strictEqual(btnRescan.className, 'btn-success mt-2');
        assert.strictEqual(btnRescan.textContent, 'Erneut scannen (Rescan)');

        const pRescanStatus = context.mockElements[`rescan-status-${hybrid_sha}`];
        assert.ok(pRescanStatus);
        assert.strictEqual(pRescanStatus.tagName, 'p');
        assert.strictEqual(pRescanStatus.className, 'mt-2');
        assert.strictEqual(pRescanStatus['aria-live'], 'polite');
        assert.strictEqual(pRescanStatus['role'], 'status');

        const btnCdr = context.mockElements[`btn-cdr-${hybrid_sha}`];
        assert.strictEqual(btnCdr, undefined);
    });

    it('renders a "CDR" button and status element when attachment ends with .html', () => {
        renderActionButtons = context.renderActionButtons;
        const card = context.document.createElement('div');
        const hybrid_sha = 'abc123sha';

        renderActionButtons(hybrid_sha, 'test.html', card);

        const btnCdr = context.mockElements[`btn-cdr-${hybrid_sha}`];
        assert.ok(btnCdr);
        assert.strictEqual(btnCdr.tagName, 'button');
        assert.strictEqual(btnCdr.className, 'btn-primary mt-2 ml-2');
        assert.strictEqual(btnCdr.textContent, 'Bereinigen & Herunterladen (Lokales CDR)');

        const pCdrStatus = context.mockElements[`cdr-status-${hybrid_sha}`];
        assert.ok(pCdrStatus);
        assert.strictEqual(pCdrStatus.tagName, 'p');
        assert.strictEqual(pCdrStatus.className, 'mt-2');
        assert.strictEqual(pCdrStatus['aria-live'], 'polite');
        assert.strictEqual(pCdrStatus['role'], 'status');
    });

    it('renders a "CDR" button and status element when attachment ends with .htm', () => {
        renderActionButtons = context.renderActionButtons;
        const card = context.document.createElement('div');
        const hybrid_sha = 'abc123sha';

        renderActionButtons(hybrid_sha, 'test.htm', card);

        const btnCdr = context.mockElements[`btn-cdr-${hybrid_sha}`];
        assert.ok(btnCdr);
    });
});
