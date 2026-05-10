const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

describe('escapeHTML', () => {
    let context;
    let escapeHTML;

    before(() => {
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
            String: String
        };

        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        vm.runInContext(code, context);

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
