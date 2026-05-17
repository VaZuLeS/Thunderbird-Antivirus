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
                getElementById: () => ({ textContent: '', insertAdjacentHTML: () => {} })
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
                createElement: (tag) => {
                    return {
                        className: '',
                        textContent: '',
                    };
                },
                getElementById: (id) => {
                    if (id === 'hybrid_analysis_api_content') {
                        if (!context.apiContentElement) {
                            context.apiContentElement = {
                                _html: '',
                                get innerHTML() { return this._html; },
                                set innerHTML(val) { this._html = val; },
                                appendChild: function(el) {
                                    let content = el.textContent || '';
                                    if (el.className) {
                                        this._html += `<div class="${el.className}">${content}</div>`;
                                    } else {
                                        this._html += `<div>${content}</div>`;
                                    }
                                },
                                insertAdjacentHTML: function(position, text) {
                                    this._html += text;
                                }
                            };
                        }
                        return context.apiContentElement;
                    }
                    return { textContent: '', insertAdjacentHTML: () => {}, innerHTML: '', appendChild: () => {} };
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
        context.document.getElementById('hybrid_analysis_api_content'); context.apiContentElement._html = '';
        context.fetch = async () => {
            throw new Error('Network timeout');
        };

        await get_hybrid_report_by_sha256('dummy_sha', 'test.txt');

        assert.ok(context.apiContentElement._html.includes('<div class="text-danger">Netzwerkfehler: Network timeout für Element test.txt</div>'));
    });

    it('injects API Error message on fetch non-200 status', async () => {
        context.document.getElementById('hybrid_analysis_api_content'); context.apiContentElement._html = '';
        context.fetch = async () => {
            return {
                status: 500,
                statusText: 'Internal Server Error',
                json: async () => ({})
            };
        };

        await get_hybrid_report_by_sha256('dummy_sha', 'test.txt');

        assert.ok(context.apiContentElement._html.includes('<div class="text-danger">API Error: 500 für Element test.txt</div>'));
    });
});
