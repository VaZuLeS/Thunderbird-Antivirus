/**
 * Security hardening tests (round 5, theme "Security & Robustheit").
 *
 * Two areas:
 *  1. `disarmHTML()` must not leave anything that executes *or* that silently
 *     contacts the sender when the saved file is opened (tracking pixels, CSS
 *     imports) - while keeping the blocked target readable for the analyst.
 *  2. The `runtime.onMessage` boundary validates action and payload types, and
 *     exports are size- and type-limited.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

/**
 * URL-Wrapper: funktioniert mit und ohne `new` und liefert fuer den Exportpfad
 * einen Stub-BLOB-URL, damit kein echtes Node-Blob noetig ist.
 */
function createUrlStub() {
    function UrlShim(url, base) {
        return base === undefined ? new URL(url) : new URL(url, base);
    }
    UrlShim.createObjectURL = () => 'blob:thundy-test';
    UrlShim.revokeObjectURL = () => {};
    return UrlShim;
}

/** Minimaler Thunderbird-Mock, gerade genug, um background.js zu laden. */
function createBackgroundContext(extraGlobals = '') {
    const dom = new JSDOM();
    const context = {
        browser: {
            storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener: () => {} } },
            runtime: { onMessage: { addListener: () => {} }, getURL: () => 'img/icon-64px.png', id: 'thundy@test' },
            messageDisplay: { onMessagesDisplayed: { addListener: () => {} } },
            notifications: { create: () => {} },
            permissions: { contains: async () => true },
            menus: { create: () => {} },
            tabs: { query: async () => [] },
            scripting: { executeScript: async () => [] },
            messages: {}
        },
        console,
        setTimeout,
        clearTimeout,
        URL: createUrlStub(),
        URLSearchParams,
        DOMParser: dom.window.DOMParser,
        document: dom.window.document,
        Blob: dom.window.Blob,
        File: dom.window.File,
        TextEncoder,
        TextDecoder
    };
    vm.createContext(context);
    let code = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
    code += '\n; globalThis.disarmHTML = disarmHTML;\n; globalThis.validateRequest = validateRequest;\n' +
        '; globalThis.MAX_EXPORT_BYTES = MAX_EXPORT_BYTES;\n' +
        '; globalThis.handleSaveResearchExport = handleSaveResearchExport;\n' + extraGlobals;
    vm.runInContext(code, context);
    return context;
}


describe('disarmHTML hardening: no execution, no beaconing', () => {
    let context;

    before(() => {
        context = createBackgroundContext();
    });

    const disarm = (html) => context.disarmHTML(html);

    it('removes tracking pixels and other remote resource attributes but keeps the target', () => {
        const result = disarm('<html><body><img src="http://tracker.example/pixel.gif" width="1"><img srcset="https://cdn.example/a.png 1x, https://cdn.example/b.png 2x"><video poster="https://cdn.example/p.jpg"></video></body></html>');
        const dom = new JSDOM(result).window.document;
        const images = Array.from(dom.querySelectorAll('img'));
        assert.strictEqual(images[0].getAttribute('src'), null, 'remote src must not survive');
        assert.match(images[0].getAttribute('data-thundy-blocked-src'), /tracker\.example/, 'the blocked target stays readable');
        assert.strictEqual(images[1].getAttribute('srcset'), null, 'remote srcset must not survive');
        assert.strictEqual(dom.querySelector('video').getAttribute('poster'), null);
        assert.ok(!dom.querySelector('img[src]'), 'no image keeps a loadable remote URL');
    });

    it('neutralises remote references inside inline styles and style blocks', () => {
        const result = disarm('<html><head><style>@import url("https://evil.example/x.css"); .a { background: url(https://evil.example/p.gif); }</style></head><body><p style="background-image: url(https://evil.example/q.gif)">Text</p></body></html>');
        const dom = new JSDOM(result).window.document;
        const css = dom.querySelector('style').textContent;
        assert.ok(!/https:\/\/evil\.example/.test(css), 'the style block must not load a remote resource');
        assert.ok(!/@import\s+(url\(|["'])/.test(css), 'remote @import must be removed');
        const paragraph = dom.querySelector('p');
        assert.ok(!/https:\/\/evil\.example/.test(paragraph.getAttribute('style')),
            'the inline style must not load a remote resource');
        assert.match(paragraph.getAttribute('style'), /about:blank#thundy-blocked/);
        // Der blockierte Zielpfad bleibt fuer die Analyse lesbar (data-Attribut, inert).
        assert.match(paragraph.getAttribute('data-thundy-blocked-style'), /evil\.example/);
        assert.match(dom.querySelector('style').getAttribute('data-thundy-blocked-style'), /evil\.example/);
    });

    it('keeps relative and non-remote references untouched', () => {
        const result = disarm('<html><body><img src="cid:attachment-1"><img src="images/local.png"><a href="https://example.org/page">Link</a></body></html>');
        const dom = new JSDOM(result).window.document;
        const images = Array.from(dom.querySelectorAll('img'));
        assert.strictEqual(images[0].getAttribute('src'), 'cid:attachment-1');
        assert.strictEqual(images[1].getAttribute('src'), 'images/local.png');
        assert.strictEqual(dom.querySelector('a').getAttribute('href'), 'https://example.org/page',
            'links stay readable for the analyst');
    });

    it('still removes active content (script, handlers, javascript:/data: URIs)', () => {
        const result = disarm('<html><body onload="evil()"><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="data:image/svg+xml,<svg onload=alert(1)>"><iframe srcdoc="<script>alert(1)</script>"></iframe></body></html>');
        const dom = new JSDOM(result).window.document;
        assert.strictEqual(dom.body.getAttribute('onload'), null, 'event handlers must not survive');
        assert.strictEqual(dom.querySelectorAll('script').length, 0, 'scripts must not survive');
        assert.strictEqual(dom.querySelector('a').getAttribute('href'), null, 'javascript URIs must not survive');
        assert.strictEqual(dom.querySelector('img').getAttribute('src'), null, 'data URIs must not survive');
        assert.strictEqual(dom.querySelectorAll('iframe').length, 0, 'iframes (and srcdoc) must not survive');
        assert.ok(!/javascript:/i.test(dom.documentElement.outerHTML.replace(/data-thundy-[a-z]+="[^"]*"/g, '')),
            'no active URI scheme remains outside the inert data attributes');
    });

    it('handles malformed and deeply nested markup without throwing', () => {
        const samples = [
            '<html><body><div><span>unclosed',
            '<table><tr><td><style>@import url(http://a.example/x.css);</style>',
            '<template><template><img src="http://tracker.example/x.gif"></template></template>',
            '<p style="background:url(\'http://tracker.example/p.gif\')">x</p>',
            ''
        ];
        for (const sample of samples) {
            assert.doesNotThrow(() => disarm(sample), 'input: ' + sample.slice(0, 40));
        }
        const nested = disarm('<template><template><img src="http://tracker.example/x.gif"></template></template>');
        const nestedDom = new JSDOM(nested).window.document;
        const templateImage = nestedDom.querySelector('template').content.querySelector('template').content.querySelector('img');
        assert.strictEqual(templateImage.getAttribute('src'), null, 'remote src inside templates is neutralised');
        assert.match(templateImage.getAttribute('data-thundy-blocked-src'), /tracker\.example/,
            'the blocked target stays readable');
    });
});

describe('message boundary validation and export limits', () => {
    let context;

    before(() => {
        context = createBackgroundContext('; globalThis.handleSaveResearchExport = handleSaveResearchExport;\n');
    });

    const reject = (request) => context.validateRequest(request);

    it('rejects malformed envelopes and unknown actions', () => {
        assert.strictEqual(reject(null), 'invalid_request');
        assert.strictEqual(reject('text'), 'invalid_request');
        assert.strictEqual(reject(['scanUrl']), 'invalid_request');
        assert.strictEqual(reject({}), 'unknown_action');
        assert.strictEqual(reject({ action: 'runShellCommand' }), 'unknown_action');
    });

    it('validates the payload types of every supported action', () => {
        assert.strictEqual(reject({ action: 'requestScan', messageId: 1 }), null);
        assert.strictEqual(reject({ action: 'requestScan', messageId: '1' }), 'invalid_message_id');
        assert.strictEqual(reject({ action: 'requestScan', messageId: 0 }), 'invalid_message_id');
        assert.strictEqual(reject({ action: 'requestScan', messageId: 1, persist: 'yes' }), 'invalid_persist');

        assert.strictEqual(reject({ action: 'scanUrl', url: 'https://example.org/' }), null);
        assert.strictEqual(reject({ action: 'scanUrl', url: 'file:///etc/passwd' }), 'invalid_url');
        assert.strictEqual(reject({ action: 'scanUrl', url: 'javascript:alert(1)' }), 'invalid_url');

        assert.strictEqual(reject({ action: 'uploadAttachment', messageId: 1, partName: '1.2' }), null);
        assert.strictEqual(reject({ action: 'uploadAttachment', messageId: 1 }), 'invalid_part_name');
        assert.strictEqual(reject({ action: 'uploadAttachment', messageId: 1, partName: '1.2', attachmentName: 42 }),
            'invalid_attachment_name');

        assert.strictEqual(reject({ action: 'getResearchDossier', messageId: 7 }), null);
        assert.strictEqual(reject({ action: 'getResearchDossier' }), 'invalid_message_id');

        assert.strictEqual(reject({ action: 'saveResearchExport', filename: 'x.json', content: '{}' }), null);
        assert.strictEqual(reject({ action: 'saveResearchExport', filename: 'x.json' }), 'invalid_content');
        assert.strictEqual(reject({ action: 'saveResearchExport', filename: 'x.json', content: '{}', mimeType: 'application/x-sh' }),
            'invalid_mime_type');
        assert.strictEqual(reject({ action: 'saveResearchExport', filename: 'x.json', content: 'x'.repeat(context.MAX_EXPORT_BYTES + 1) }),
            'export_too_large');
    });

    it('limits exports independently of the message path', async () => {
        const downloads = [];
        context.browser.downloads = { download: async (options) => { downloads.push(options); return 1; } };
        await assert.rejects(
            () => context.handleSaveResearchExport({ filename: 'x.json', content: 'x'.repeat(context.MAX_EXPORT_BYTES + 1) }),
            /export too large/
        );
        await assert.rejects(
            () => context.handleSaveResearchExport({ filename: 'x.json', content: '{}', mimeType: 'text/html' }),
            /mime type not allowed/
        );
        await assert.doesNotReject(() => context.handleSaveResearchExport({ filename: 'x.json', content: '{}' }));
        assert.strictEqual(downloads.length, 1);
        assert.strictEqual(downloads[0].filename, 'x.json');
    });

    it('never puts configured API keys into a research export', async () => {
        const secret = 'super-secret-api-key-123';
        context.browser.messages.get = async () => ({ id: 3, author: 'a@b.example', subject: 's', headerMessageId: '<x@y>' });
        context.browser.messages.getFull = async () => ({ headers: {}, parts: [{ contentType: 'text/plain', body: 'text' }] });
        context.browser.messages.listAttachments = async () => ([]);
        context.browser.storage.local.get = async () => ({
            apikey: secret, virustotalApikey: secret, urlscanApikey: secret, urlhausApikey: secret, ipReputationApiKey: secret
        });
        await context.loadSettings();

        const dossier = await context.buildResearchDossier(3);
        const exported = JSON.stringify(dossier);
        assert.ok(!exported.includes(secret), 'the dossier must never contain an API key');
        assert.strictEqual(dossier.provenance.providersConfigured.hybridAnalysis, true,
            'the dossier only reports whether a provider is configured');
    });
});

