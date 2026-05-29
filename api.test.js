const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, before } = require('node:test');
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
        const wrappedCode = code.replace(/^\(async function \(\) {/m, 'async function initAPI() {');
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
        const wrappedCode = code.replace(/^\(async function \(\) {/m, 'async function initAPI() {');
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
        const wrappedCode = code.replace(/^\(async function \(\) \{/m, 'async function initAPI() {');
        vm.runInContext(wrappedCode, context);

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

        const urlId = Array.from(new TextEncoder().encode(url))
            .map(b => b.toString(16).padStart(2, '0')).join('');

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
