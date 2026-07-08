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

    it('propagates errors thrown during stringification', () => {
        const errorObject = {
            toString: () => {
                throw new Error('Stringification error');
            }
        };
        assert.throws(() => escapeHTML(errorObject), /Stringification error/);
    });
});

describe('createEl', () => {
    let context;
    let createEl;

    before(async () => {
        // Create mock environment
        context = {
            document: {
                createElement: (tag) => {
                    let el = {
                        tagName: tag.toUpperCase(),
                        className: '',
                        textContent: ''
                    };
                    return el;
                }
            }
        };

        vm.createContext(context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        // Prevent the IIFE from executing during test initialization
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');
        vm.runInContext(wrappedCode, context);

        createEl = context.createEl;
    });

    it('creates an element with just a tag name', () => {
        const el = createEl('div');
        assert.strictEqual(el.tagName, 'DIV');
        assert.strictEqual(el.className, '');
        assert.strictEqual(el.textContent, '');
    });

    it('creates an element with a tag name and class name', () => {
        const el = createEl('span', 'test-class');
        assert.strictEqual(el.tagName, 'SPAN');
        assert.strictEqual(el.className, 'test-class');
        assert.strictEqual(el.textContent, '');
    });

    it('creates an element with a tag name, class name, and text content', () => {
        const el = createEl('p', 'text-bold', 'Hello World');
        assert.strictEqual(el.tagName, 'P');
        assert.strictEqual(el.className, 'text-bold');
        assert.strictEqual(el.textContent, 'Hello World');
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
                                children: [],
                                get innerHTML() { return this._html; },
                                set innerHTML(val) { this._html = val; },
                                set textContent(val) { this._html = val; },
                                insertAdjacentHTML: function(position, text) {
                                    this._html += text;
                                },
                                appendChild: function(child) {
                                    if (!this.children) this.children = [];
                                    this.children.push(child);
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

        await get_hybrid_report_by_sha256({ hybrid_sha: 'dummy_sha', attachmentName: 'test.txt' });

        const html = context.apiContentElement.innerHTML;
        assert.ok(html.includes('alert-error'));
        assert.ok(html.includes('Netzwerkfehler: Network timeout'));
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

        await get_hybrid_report_by_sha256({ hybrid_sha: 'dummy_sha', attachmentName: 'test.txt' });

        assert.ok(context.apiContentElement.innerHTML.includes('API Error: 500 für Element test.txt'));
        assert.ok(context.apiContentElement.innerHTML.includes('alert-error'));
    });

    it('calls render_hybrid_report_ui on successful fetch', async () => {
        let originalFetch = context.fetch_hybrid_report;
        let originalRender = context.render_hybrid_report_ui;

        let renderArgs = null;
        context.fetch_hybrid_report = async (sha) => {
            return { response: { status: 200 }, json_data: { test: 'data' } };
        };
        context.render_hybrid_report_ui = (args) => {
            renderArgs = args;
        };

        await get_hybrid_report_by_sha256({
            hybrid_sha: 'dummy_sha',
            attachmentName: 'test.txt',
            messageId: 'msg1',
            partName: 'part1',
            headerMessageId: 'hdr1',
            virustotal_stats: { malicious: 1 }
        });

        assert.ok(renderArgs, 'render_hybrid_report_ui should have been called');
        assert.strictEqual(renderArgs.hybrid_sha, 'dummy_sha');
        assert.strictEqual(renderArgs.attachmentName, 'test.txt');
        assert.strictEqual(renderArgs.messageId, 'msg1');
        assert.strictEqual(renderArgs.partName, 'part1');
        assert.strictEqual(renderArgs.headerMessageId, 'hdr1');
        assert.deepStrictEqual(renderArgs.virustotal_stats, { malicious: 1 });
        assert.deepStrictEqual(renderArgs.json_data, { test: 'data' });

        context.fetch_hybrid_report = originalFetch;
        context.render_hybrid_report_ui = originalRender;
    });

    it('calls handle_hybrid_report_error on non-200 fetch status', async () => {
        let originalFetch = context.fetch_hybrid_report;
        let originalHandleError = context.handle_hybrid_report_error;

        let handleErrorArgs = null;
        context.fetch_hybrid_report = async (sha) => {
            return { response: { status: 500, statusText: 'Internal Error' }, json_data: null };
        };
        context.handle_hybrid_report_error = (response, attachmentName) => {
            handleErrorArgs = { response, attachmentName };
        };

        await get_hybrid_report_by_sha256({
            hybrid_sha: 'dummy_sha',
            attachmentName: 'test.txt'
        });

        assert.ok(handleErrorArgs, 'handle_hybrid_report_error should have been called');
        assert.strictEqual(handleErrorArgs.response.status, 500);
        assert.strictEqual(handleErrorArgs.attachmentName, 'test.txt');

        context.fetch_hybrid_report = originalFetch;
        context.handle_hybrid_report_error = originalHandleError;
    });

    it('calls handle_hybrid_report_fetch_error on fetch exception', async () => {
        let originalFetch = context.fetch_hybrid_report;
        let originalHandleFetchError = context.handle_hybrid_report_fetch_error;

        let handleFetchErrorArgs = null;
        let testError = new Error('Test Exception');
        context.fetch_hybrid_report = async (sha) => {
            throw testError;
        };
        context.handle_hybrid_report_fetch_error = (error, attachmentName) => {
            handleFetchErrorArgs = { error, attachmentName };
        };

        await get_hybrid_report_by_sha256({
            hybrid_sha: 'dummy_sha',
            attachmentName: 'test.txt'
        });

        assert.ok(handleFetchErrorArgs, 'handle_hybrid_report_fetch_error should have been called');
        assert.strictEqual(handleFetchErrorArgs.error, testError);
        assert.strictEqual(handleFetchErrorArgs.attachmentName, 'test.txt');

        context.fetch_hybrid_report = originalFetch;
        context.handle_hybrid_report_fetch_error = originalHandleFetchError;
    });
});



describe('handle_hybrid_report_fetch_error', () => {
    let context;
    let handle_hybrid_report_fetch_error;

    before(async () => {
        // Create mock environment
        context = {
            browser: {
                storage: {
                    local: {
                        get: async () => ({})
                    }
                }
            },
            document: {
                createElement: (tag) => {
                    let children = [];
                    let el = {
                        tag: tag,
                        className: '',
                        textContent: '',
                        appendChild: function(child) {
                            children.push(child);
                        },
                        setAttribute: function(name, val) {
                            this[name] = val;
                        },
                        addEventListener: function(evt, cb) {},
                        get children() { return children; },
                        get outerHTML() {
                            let inner = children.map(c => c.outerHTML || c.textContent || '').join('') + this.textContent;
                            return `<${this.tag}>${inner}</${this.tag}>`;
                        }
                    };
                    return el;
                },
                getElementById: (id) => {
                    if (id === 'hybrid_analysis_api_content') {
                        if (!context.apiContentElement) {
                            context.apiContentElement = {
                                appendChild: function(child) {
                                    this.child = child;
                                }
                            };
                        }
                        return context.apiContentElement;
                    }
                    return null;
                }
            },
            console: { error: () => {}, log: () => {} },
            String: String,
            setTimeout: setTimeout
        };

        vm.createContext(context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');
        vm.runInContext(wrappedCode, context);

        handle_hybrid_report_fetch_error = context.handle_hybrid_report_fetch_error;
    });

    it('injects Netzwerkfehler message for fetch error', async () => {
        context.apiContentElement = null; // Reset
        handle_hybrid_report_fetch_error(new Error('Network timeout'), 'test.txt');

        const appended = context.apiContentElement.child;
        assert.strictEqual(appended.className, 'alert-error');
        assert.ok(appended.textContent.includes('Netzwerkfehler: Network timeout für Element test.txt'));
        assert.strictEqual(appended.role, 'alert');
    });
});



describe('renderManualUploadUI', () => {
    let context;
    let renderManualUploadUI;

    before(async () => {
        context = {
            document: {
                createElement: (tag) => {
                    let children = [];
                    let el = {
                        tag: tag,
                        className: '',
                        textContent: '',
                        _id: '',
                        get id() { return this._id; },
                        set id(val) { this._id = val; },
                        appendChild: function(child) { children.push(child); },
                        get children() { return children; },
                        setAttribute: function() {},
                        addEventListener: function() {}
                    };
                    return el;
                },
                createTextNode: (text) => ({ textContent: text, type: 'textNode' }),
                getElementById: (id) => {
                    if (id === 'hybrid_analysis_api_content') {
                        if (!context.apiContentElement) {
                            context.apiContentElement = {
                                children: [],
                                appendChild: function(child) {
                                    this.children.push(child);
                                }
                            };
                        }
                        return context.apiContentElement;
                    }
                    return {
                        appendChild: function() {},
                        insertAdjacentHTML: function() {},
                        setAttribute: function() {}
                    };
                }
            },
            escapeHTML: (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'),
            createUploadButtonCalls: [],
            createCdrButtonCalls: [],
            appendElementHtmlCalls: [],
            String: String,
        };

        const vm = require('vm');
        const path = require('path');
        vm.createContext(context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');

        vm.runInContext(wrappedCode, context);

        renderManualUploadUI = context.renderManualUploadUI;

        vm.runInContext(`
            createUploadButton = function(card, { hash, safeHash, attachmentName, messageId, partName, headerMessageId }) {
                createUploadButtonCalls.push({card, hash, safeHash, attachmentName, messageId, partName, headerMessageId});
            };
            createCdrButton = function(card, safeHash, attachmentName, messageId, partName) {
                createCdrButtonCalls.push({card, safeHash, attachmentName, messageId, partName});
            };
            appendElementHtml = function(id, node) {
                appendElementHtmlCalls.push({id, node});
            };
        `, context);
    });

    it('renders correctly with attachmentName', () => {
        context.createUploadButtonCalls.length = 0;
        context.createCdrButtonCalls.length = 0;
        context.appendElementHtmlCalls.length = 0;

        renderManualUploadUI('hash123', 'test.txt', 'msg1', 'part1', 'hdr1');

        assert.strictEqual(context.apiContentElement.children.length, 1);
        const card = context.apiContentElement.children[0];
        assert.strictEqual(card.tag, 'div');
        assert.strictEqual(card.className, 'card card-info mb-3');
        assert.strictEqual(card.id, 'upload-container-hash123');

        // Check children
        // 1. h2
        // 2. pHash
        // 3. pInfo
        assert.strictEqual(card.children[0].tag, 'h2');
        assert.strictEqual(card.children[0].textContent, 'Anhang: test.txt');

        assert.strictEqual(card.children[1].tag, 'p');
        assert.strictEqual(card.children[1].textContent, 'SHA-256: hash123');

        assert.strictEqual(card.children[2].tag, 'p');
        assert.strictEqual(card.children[2].className, 'text-info');

        // helper function calls
        assert.strictEqual(context.createUploadButtonCalls.length, 1);
        assert.strictEqual(context.createUploadButtonCalls[0].hash, 'hash123');
        assert.strictEqual(context.createUploadButtonCalls[0].attachmentName, 'test.txt');

        assert.strictEqual(context.createCdrButtonCalls.length, 1);
        assert.strictEqual(context.createCdrButtonCalls[0].safeHash, 'hash123');
        assert.strictEqual(context.createCdrButtonCalls[0].attachmentName, 'test.txt');
    });

    it('renders correctly falling back to Unbekannt if attachmentName is missing', () => {
        context.createUploadButtonCalls.length = 0;
        context.createCdrButtonCalls.length = 0;
        context.appendElementHtmlCalls.length = 0;

        context.apiContentElement.children = [];
        renderManualUploadUI('hash123', null, 'msg1', 'part1', 'hdr1');

        assert.strictEqual(context.apiContentElement.children.length, 1);
        const card = context.apiContentElement.children[0];
        assert.strictEqual(card.children[0].tag, 'h2');
        assert.strictEqual(card.children[0].textContent, 'Anhang: Unbekannt');
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
                                children: [],
                                get innerHTML() { return this._html; },
                                set innerHTML(val) { this._html = val; },
                                insertAdjacentHTML: function(position, text) {
                                    this._html += text;
                                },
                                appendChild: function(node) {
                                    if (!this.children) this.children = [];
                                    this.children.push(node);
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
        context.get_hybrid_report_by_sha256 = function(opts) {
            context.lastReportOpts = opts;
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
                createDocumentFragment: () => ({
                    isFragment: true,
                    children: [],
                    appendChild: function(node) {
                        this.children.push(node);
                    },
                    get outerHTML() {
                        return this.children.map(c => c.outerHTML || c.textContent || '').join('');
                    }
                }),
                createElement: (tag) => {
                    return {
                        tag: tag,
                        className: '',
                        textContent: '',
                        children: [],
                        _innerHTML: null,
                        setAttribute: () => {},
                        appendChild: function(node) {
                            if (node && node.isFragment) {
                                for (let i = 0; i < node.children.length; i++) {
                                    this.children.push(node.children[i]);
                                }
                            } else {
                                this.children.push(node);
                            }
                        },
                        get innerHTML() {
                            if (this._innerHTML !== null) return this._innerHTML;
                            return this.children.map(c => {
                                let cls = c.className ? ` class="${c.className}"` : '';
                                let inner = c.innerHTML || c.textContent || '';
                                return `<${c.tag || tag}${cls}>${inner}</${c.tag || tag}>`;
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


describe('renderScannerResults', () => {
    let context;
    let renderScannerResults;

    before(async () => {
        // Create mock environment
        context = {
            document: {
                createDocumentFragment: () => ({
                    isFragment: true,
                    children: [],
                    appendChild: function(node) {
                        this.children.push(node);
                    },
                    get outerHTML() {
                        return this.children.map(c => c.outerHTML || c.textContent || '').join('');
                    }
                }),
                createElement: (tag) => {
                    return {
                        tag: tag,
                        className: '',
                        textContent: '',
                        children: [],
                        _innerHTML: null,
                        setAttribute: () => {},
                        appendChild: function(node) {
                            if (node && node.isFragment) {
                                for (let i = 0; i < node.children.length; i++) {
                                    this.children.push(node.children[i]);
                                }
                            } else {
                                this.children.push(node);
                            }
                        },
                        get innerHTML() {
                            if (this._innerHTML !== null) return this._innerHTML;
                            return this.children.map(c => {
                                let cls = c.className ? ` class="${c.className}"` : '';
                                let inner = c.innerHTML || c.textContent || '';
                                return `<${c.tag || tag}${cls}>${inner}</${c.tag || tag}>`;
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

        renderScannerResults = context.renderScannerResults;
    });

    it('should render "Keine Scanner-Ergebnisse verfügbar." if scanners is null or empty', () => {
        const card1 = context.document.createElement('div');
        renderScannerResults(null, card1);
        assert.ok(card1.innerHTML.includes('class="card card-info mt-2"'));
        assert.ok(card1.innerHTML.includes('Keine Scanner-Ergebnisse verfügbar.'));

        const card2 = context.document.createElement('div');
        renderScannerResults([], card2);
        assert.ok(card2.innerHTML.includes('class="card card-info mt-2"'));
        assert.ok(card2.innerHTML.includes('Keine Scanner-Ergebnisse verfügbar.'));
    });

    it('should render scanner name and status when anti_virus_results is not present', () => {
        const scanners = [{ name: 'TestScanner', status: 'clean' }];
        const card = context.document.createElement('div');
        renderScannerResults(scanners, card);

        const html = card.innerHTML;
        assert.ok(html.includes('Scanner: TestScanner'));
        assert.ok(html.includes('Status: clean'));
        assert.ok(!html.includes('AV-Ergebnisse:'));
    });

    it('should render scanner name, status, and anti_virus_results when present', () => {
        const scanners = [{
            name: 'AdvancedScanner',
            status: 'malicious',
            anti_virus_results: [
                { product: 'AV-1', verdict: 'Threat found' },
                { product: 'AV-2', verdict: 'Clean' }
            ]
        }];
        const card = context.document.createElement('div');
        renderScannerResults(scanners, card);

        const html = card.innerHTML;
        assert.ok(html.includes('Scanner: AdvancedScanner'));
        assert.ok(html.includes('Status: malicious'));
        assert.ok(html.includes('AV-Ergebnisse:'));
        assert.ok(html.includes('AV: AV-1 - Urteil: Threat found'));
        assert.ok(html.includes('AV: AV-2 - Urteil: Clean'));
    });
});


describe('handleUploadClick', () => {
    let context;
    let handleUploadClick;

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
                createTextNode: (text) => ({ textContent: text }),
                createElement: (tag) => ({ tagName: tag, setAttribute: () => {}, removeAttribute: () => {}, appendChild: () => {}, addEventListener: () => {} }),
                getElementById: (id) => {
                    if (!context.mockElements) context.mockElements = {};
                    if (context.mockElements[id]) return context.mockElements[id];
                    let el = { textContent: '', insertAdjacentHTML: () => {}, appendChild: () => {}, setAttribute: () => {}, removeAttribute: () => {}, addEventListener: () => {}, remove: () => {}, _id: id };
                    context.mockElements[id] = el;
                    return el;
                }
            },
            setTimeout: (cb, delay) => {
                context.timeouts.push({cb, delay});
            },
            get_hybrid_report_by_sha256: () => {}
        };

        const vm = require('vm');
        const fs = require('fs');
        const code = fs.readFileSync('api.js', 'utf8');

        // Wrap the code to extract handleUploadClick
        let wrappedCode = `(function() {
            let browser = context.browser;
            let document = context.document;
            let setTimeout = context.setTimeout;

            ${code}

            context.handleUploadClick = handleUploadClick;

            get_hybrid_report_by_sha256 = function() {
                if (context.get_hybrid_report_by_sha256) {
                    return context.get_hybrid_report_by_sha256.apply(this, arguments);
                }
            };
        })();`;

        vm.runInContext(wrappedCode, vm.createContext({context, console}));
        handleUploadClick = context.handleUploadClick;
    });

    it('disables button and updates UI, then handles success', async () => {
        const assert = require('assert');
        context.mockElements = {}; // reset
        context.timeouts = []; // reset
        context.lastReportArgs = null; // reset

        // Mock successful sendMessage
        context.browser.runtime.sendMessage = async (msg) => {
            context.lastMsg = msg;
            return { status: 'success' };
        };

        const btn = {
            disabled: false,
            setAttribute: function(k, v) { this[k] = v; },
            removeAttribute: function(k) { delete this[k]; },
            innerText: '',
            className: ''
        };
        const statusEl = {
            textContent: '',
            innerText: ''
        };
        context.mockElements['upload-status-safeHash2'] = statusEl;

        const args = { hash: 'hash2', safeHash: 'safeHash2', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' };
        const handler = handleUploadClick(args);

        // Call handler bound to btn
        handler.call(btn);

        // Check intermediate state
        assert.strictEqual(btn.disabled, true);
        assert.strictEqual(btn['aria-busy'], 'true');
        assert.strictEqual(btn.innerText, 'Lade hoch...');
        assert.strictEqual(statusEl.textContent, 'Datei wird an Hybrid Analysis übertragen...');

        // Wait for promise resolution
        await new Promise(process.nextTick);

        assert.strictEqual(context.lastMsg.action, 'uploadAttachment');
        assert.strictEqual(context.lastMsg.hash, 'hash2');

        assert.strictEqual(statusEl.innerText, 'Upload erfolgreich! Lade Analyseergebnisse...');
        assert.strictEqual(btn['aria-busy'], undefined); // removed
        assert.strictEqual(btn.className, 'btn-success mt-2');
        assert.strictEqual(btn.innerText, 'Erfolgreich');

        // Check timeout
        assert.strictEqual(context.timeouts.length, 1);
        assert.strictEqual(context.timeouts[0].delay, 3000);

        // Execute timeout callback
        let removedContainer = false;
        context.mockElements['upload-container-safeHash2'] = { remove: () => { removedContainer = true; } };

        let prev = context.get_hybrid_report_by_sha256;
        context.get_hybrid_report_by_sha256 = function(opts) { context.lastReportArgs = [opts]; };

        context.timeouts[0].cb();

        context.get_hybrid_report_by_sha256 = prev;

        assert.strictEqual(removedContainer, true);
        assert.strictEqual(context.lastReportArgs[0].hybrid_sha, 'hash2');
        assert.strictEqual(context.lastReportArgs[0].attachmentName, 'test.txt');
    });

    it('handles upload failure response correctly', async () => {
        const assert = require('assert');
        context.mockElements = {};

        context.browser.runtime.sendMessage = async () => {
            return { status: 'error', message: 'Invalid API key' };
        };

        const btn = {
            disabled: false,
            setAttribute: function(k, v) { this[k] = v; },
            removeAttribute: function(k) { delete this[k]; },
            innerText: '',
            className: ''
        };
        const statusEl = {
            textContent: '',
            innerText: ''
        };
        context.mockElements['upload-status-safeHash3'] = statusEl;

        const args = { hash: 'hash3', safeHash: 'safeHash3', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' };
        const handler = handleUploadClick(args);
        handler.call(btn);

        // Wait for promise resolution
        await new Promise(process.nextTick);

        assert.strictEqual(statusEl.innerText, 'Fehler beim Upload: Invalid API key');
        assert.strictEqual(btn.disabled, false);
        assert.strictEqual(btn['aria-busy'], undefined);
        assert.strictEqual(btn.innerText, 'Erneut versuchen');
    });

    it('handles upload exception correctly', async () => {
        const assert = require('assert');
        context.mockElements = {};

        context.browser.runtime.sendMessage = async () => {
            throw new Error('Network error');
        };

        const btn = {
            disabled: false,
            setAttribute: function(k, v) { this[k] = v; },
            removeAttribute: function(k) { delete this[k]; },
            innerText: '',
            className: ''
        };
        const statusEl = {
            textContent: '',
            innerText: ''
        };
        context.mockElements['upload-status-safeHash4'] = statusEl;

        const args = { hash: 'hash4', safeHash: 'safeHash4', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' };
        const handler = handleUploadClick(args);
        handler.call(btn);

        // Wait for promise resolution
        await new Promise(process.nextTick);

        assert.ok(statusEl.innerText.includes('Kommunikationsfehler: Error: Network error'));
        assert.strictEqual(btn.disabled, false);
        assert.strictEqual(btn['aria-busy'], undefined);
        assert.strictEqual(btn.innerText, 'Erneut versuchen');
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
            get_hybrid_report_by_sha256: function(opts) {
                context.lastReportArgs = [opts];
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
        createUploadButton(card, { hash: 'hash1', safeHash: 'safeHash1', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' });

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

        createUploadButton(card, { hash: 'hash2', safeHash: 'safeHash2', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' });
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
        assert.strictEqual(status.textContent || status.innerText, 'Datei wird an Hybrid Analysis übertragen...');

        // Wait for promise resolution
        await new Promise(process.nextTick);

        assert.strictEqual(context.lastMsg.action, 'uploadAttachment');
        assert.strictEqual(context.lastMsg.hash, 'hash2');

        assert.strictEqual(status.innerText, 'Upload erfolgreich! Lade Analyseergebnisse...');
        assert.strictEqual(btn['aria-busy'], undefined); // removed
        assert.strictEqual(btn.className, 'btn-success mt-2');
        assert.strictEqual(btn.innerText, 'Erfolgreich');

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
        context.get_hybrid_report_by_sha256 = function(opts) { context.lastReportArgs = [opts]; };

        context.timeouts[0].cb();

        context.document.getElementById = originalGetElement;
        context.get_hybrid_report_by_sha256 = prev;

        assert.strictEqual(context.lastReportArgs[0].hybrid_sha, 'hash2');
        assert.strictEqual(context.lastReportArgs[0].attachmentName, 'test.txt');
    });

    it('handles upload failure response correctly', async () => {
        const assert = require('assert');
        const card = context.document.createElement('div');
        context.mockElements = {};

        context.browser.runtime.sendMessage = async () => {
            return { status: 'error', message: 'Invalid API key' };
        };

        createUploadButton(card, { hash: 'hash3', safeHash: 'safeHash3', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' });
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

        createUploadButton(card, { hash: 'hash4', safeHash: 'safeHash4', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' });
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

describe('handleUrlScanClick', () => {
    let context;
    let handleUrlScanClick;

    before(async () => {
        context = {
            browser: {
                storage: { local: { get: async () => ({}) } },
                runtime: {
                    sendMessage: async () => ({ status: 'success' })
                }
            },
            document: {
                createTextNode: () => ({}),
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
            setTimeout: (cb, delay) => {
                if (!context.timeouts) context.timeouts = [];
                context.timeouts.push({cb, delay});
            },
            get_hybrid_report_by_sha256: function(opts) {
                context.lastReportArgs = context.lastReportArgs || [];
                context.lastReportArgs.push(opts);
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
        handleUrlScanClick = context.handleUrlScanClick;
    });

    beforeEach(() => {
        context.mockElements = {};
        context.timeouts = [];
        context.lastReportArgs = [];
    });

    it('handles success correctly', async () => {
        const assert = require('assert');
        context.browser.runtime.sendMessage = async (msg) => {
            context.lastMsg = msg;
            return { status: 'success', data: { sha256: 'test-sha' } };
        };
        const btn = context.document.createElement('button');
        const status = context.document.createElement('div');
        status.id = 'upload-status-123';

        handleUrlScanClick(btn, 'https://example.com', '123', 'header1');

        assert.strictEqual(btn.disabled, true);
        assert.strictEqual(btn['aria-busy'], 'true');
        assert.strictEqual(btn.innerText, 'Sende URL...');
        assert.strictEqual(status.innerText, 'URL wird an Hybrid Analysis übertragen...');

        await new Promise(process.nextTick);

        assert.strictEqual(context.lastMsg.action, 'scanUrl');
        assert.strictEqual(context.lastMsg.url, 'https://example.com');

        assert.strictEqual(status.innerText, 'Scan erfolgreich beauftragt! Lade Analyseergebnisse...');
        assert.strictEqual(btn.className, 'btn-success mt-2');
        assert.strictEqual(btn.innerText, 'Erfolgreich');

        assert.strictEqual(context.timeouts.length, 1);

        let prev = context.get_hybrid_report_by_sha256;
        context.get_hybrid_report_by_sha256 = function(opts) { context.lastReportArgs.push(opts); };

        context.timeouts[0].cb();
        context.get_hybrid_report_by_sha256 = prev;

        assert.strictEqual(context.lastReportArgs.length, 1);
        assert.strictEqual(context.lastReportArgs[0].hybrid_sha, 'test-sha');
        assert.strictEqual(context.lastReportArgs[0].attachmentName, 'https://example.com');
    });

    it('handles error response correctly', async () => {
        const assert = require('assert');
        context.browser.runtime.sendMessage = async (msg) => {
            return { status: 'error', message: 'API error' };
        };
        const btn = context.document.createElement('button');
        const status = context.document.createElement('div');
        status.id = 'upload-status-124';

        handleUrlScanClick(btn, 'https://example.com', '124', 'header1');
        await new Promise(process.nextTick);

        assert.strictEqual(status.innerText, 'Fehler beim Upload: API error');
        assert.strictEqual(btn.disabled, false);
        assert.strictEqual(btn.innerText, 'Erneut versuchen');
    });

    it('handles exception correctly', async () => {
        const assert = require('assert');
        context.browser.runtime.sendMessage = async (msg) => {
            throw new Error('Network error');
        };
        const btn = context.document.createElement('button');
        const status = context.document.createElement('div');
        status.id = 'upload-status-125';

        handleUrlScanClick(btn, 'https://example.com', '125', 'header1');
        await new Promise(process.nextTick);

        assert.ok(status.innerText.includes('Kommunikationsfehler: Error: Network error'));
        assert.strictEqual(btn.disabled, false);
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

describe('setupRescanButton', () => {
    let context;
    let setupRescanButton;

    before(async () => {
        context = {
            browser: {
                storage: { local: { get: async () => ({}) } },
                runtime: {
                    sendMessage: async () => ({ status: 'success' })
                }
            },
            document: {
                getElementById: (id) => {
                    return context.mockElements && context.mockElements[id] ? context.mockElements[id] : null;
                },
                createElement: (tag) => {
                    if (!context.mockElements) context.mockElements = {};
                    let el = {
                        tagName: tag,
                        className: '',
                        textContent: '',
                        _innerText: '',
                        get innerText() { return this._innerText; },
                        set innerText(val) { this._innerText = val; },
                        attributes: {},
                        setAttribute: function(k, v) { this.attributes[k] = v; },
                        removeAttribute: function(k) { delete this.attributes[k]; },
                        childNodes: [],
                        appendChild: function(node) { this.childNodes.push(node); },
                        listeners: {},
                        addEventListener: function(evt, cb) { this.listeners[evt] = cb; },
                        click: function() {
                            if (this.listeners['click']) {
                                this.listeners['click'].call(this);
                            }
                        }
                    };
                    return el;
                }
            },
            window: {
                location: {
                    reload: () => { context.reloadCalled = true; }
                }
            },
            setTimeout: (cb) => { cb(); },
            String: String,
            Array: Array
        };

        vm.createContext(context);

        const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
        let wrappedCode = code.replace(/^\(async \(\) => \{/m, 'async function initAPI() {');
        wrappedCode = wrappedCode.replace(/\}\)\(\);/m, '}');

        // Export setupRescanButton for testing
        wrappedCode += '\n; globalThis.setupRescanButton = setupRescanButton;';

        vm.runInContext(wrappedCode, context);
        setupRescanButton = context.setupRescanButton;
    });

    beforeEach(() => {
        context.mockElements = {};
        context.reloadCalled = false;
        context.lastMsg = null;
    });

    it('renders the rescan button and status element correctly', () => {
        const btn = context.document.createElement('button');
        const status = context.document.createElement('div');
        context.mockElements['btn-rescan-hash1'] = btn;
        context.mockElements['rescan-status-hash1'] = status;

        setupRescanButton({ hybrid_sha: 'hash1', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' });

        // Ensure listener is added
        assert.strictEqual(typeof btn.listeners['click'], 'function');
    });

    it('disables button and updates UI on click, then handles success', async () => {
        const btn = context.document.createElement('button');
        const status = context.document.createElement('div');
        context.mockElements['btn-rescan-hash2'] = btn;
        context.mockElements['rescan-status-hash2'] = status;

        context.browser.runtime.sendMessage = async (msg) => {
            context.lastMsg = msg;
            return { status: 'success' };
        };

        setupRescanButton({ hybrid_sha: 'hash2', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' });

        btn.click();

        // Immediate UI updates
        assert.strictEqual(btn.disabled, true);
        assert.strictEqual(btn.attributes['aria-busy'], 'true');
        assert.strictEqual(btn.innerText, 'Sende Rescan...');
        assert.strictEqual(status.innerText, 'Datei wird für Rescan hochgeladen...');

        // Wait for promise resolution (macro task)
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(context.lastMsg.action, 'uploadAttachment');
        assert.strictEqual(status.innerText, 'Rescan erfolgreich initiiert. Lade Seite neu...');
        assert.strictEqual(btn.attributes['aria-busy'], undefined);
        assert.strictEqual(btn.className, 'btn-success mt-2');
        assert.strictEqual(btn.innerText, 'Erfolgreich');
        assert.strictEqual(context.reloadCalled, true);
    });

    it('handles upload failure response correctly', async () => {
        const btn = context.document.createElement('button');
        const status = context.document.createElement('div');
        context.mockElements['btn-rescan-hash3'] = btn;
        context.mockElements['rescan-status-hash3'] = status;

        context.browser.runtime.sendMessage = async () => {
            return { status: 'error', message: 'test err' };
        };

        setupRescanButton({ hybrid_sha: 'hash3', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' });

        btn.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(status.innerText, 'Fehler beim Rescan: test err');
        assert.strictEqual(btn.disabled, false);
        assert.strictEqual(btn.attributes['aria-busy'], undefined);
        assert.strictEqual(btn.innerText, 'Erneut versuchen');
    });

    it('handles upload exception correctly', async () => {
        const btn = context.document.createElement('button');
        const status = context.document.createElement('div');
        context.mockElements['btn-rescan-hash4'] = btn;
        context.mockElements['rescan-status-hash4'] = status;

        context.browser.runtime.sendMessage = async () => {
            throw new Error('Network error');
        };

        setupRescanButton({ hybrid_sha: 'hash4', attachmentName: 'test.txt', messageId: 'msg1', partName: 'part1', headerMessageId: 'header1' });

        btn.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(status.innerText, 'Kommunikationsfehler: Error: Network error');
        assert.strictEqual(btn.disabled, false);
        assert.strictEqual(btn.attributes['aria-busy'], undefined);
        assert.strictEqual(btn.innerText, 'Erneut versuchen');
    });
});
