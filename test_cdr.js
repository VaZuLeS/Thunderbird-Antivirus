const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

test('Test local disarmHTML function', async (t) => {
    const code = fs.readFileSync('background.js', 'utf8');

    // Setup the VM context
    const dom = new JSDOM();
    const sandbox = {
        DOMParser: dom.window.DOMParser,
        globalThis: { DOMParserMock: dom.window.DOMParser },
        browser: {
            storage: {
                local: { get: () => Promise.resolve({apikey: '123'}) },
                onChanged: { addListener: () => {} }
            },
            messageDisplayAction: { setTitle: () => {}, setBadgeBackgroundColor: () => {}, setBadgeText: () => {} },
            messages: { onNewMailReceived: { addListener: () => {} } },
            messageDisplay: { onMessageDisplayed: { addListener: () => {} } },
            runtime: { onMessage: { addListener: () => {} } }
        },
        console: { log: () => {}, error: () => {} }
    };

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    await t.test('disarmHTML should remove script tags', () => {
        const input = '<html><body><h1>Test</h1><script>alert(1);</script></body></html>';
        const result = sandbox.disarmHTML(input);
        assert.ok(!result.includes('<script>'), 'Script tag should be removed');
        assert.ok(!result.includes('alert(1)'), 'Script content should be removed');
        assert.ok(result.includes('Test'), 'Safe content should remain');
    });

    await t.test('disarmHTML should remove inline event handlers', () => {
        const input = '<html><body><button onclick="evil()">Click</button></body></html>';
        const result = sandbox.disarmHTML(input);
        assert.ok(!result.includes('onclick'), 'onclick attribute should be removed');
        assert.ok(!result.includes('evil()'), 'Event handler content should be removed');
        assert.ok(result.includes('<button>Click</button>'), 'Button element should remain');
    });

    await t.test('disarmHTML should remove javascript URIs', () => {
        const input = '<html><body><a href="javascript:alert(1)">Link</a><a href="http://safe.com">Safe</a></body></html>';
        const result = sandbox.disarmHTML(input);
        assert.ok(!result.includes('javascript:'), 'javascript URI should be removed');
        assert.ok(result.includes('http://safe.com'), 'Safe URI should remain');
    });

    await t.test('disarmHTML should remove object, embed, iframe', () => {
        const input = '<html><body><object data="evil.swf"></object><embed src="evil.swf"></embed><iframe src="evil.html"></iframe></body></html>';
        const result = sandbox.disarmHTML(input);
        assert.ok(!result.includes('object'), 'object should be removed');
        assert.ok(!result.includes('embed'), 'embed should be removed');
        assert.ok(!result.includes('iframe'), 'iframe should be removed');
    });

    await t.test('disarmHTML should prevent javascript URI evasion', () => {
        const input = '<html><body><a href="java\tscript:alert(1)">Link</a><a href="jav&#x09;ascript:alert(1)">Link2</a></body></html>';
        const result = sandbox.disarmHTML(input);
        assert.ok(!result.includes('javascript:'), 'evaded javascript URI should be removed');
    });

    await t.test('disarmHTML should remove data and vbscript URIs', () => {
        const input = '<html><body><a href="data:text/html,<script>alert(1)</script>">Data Link</a><img src="vbscript:msgbox(\'hello\')"></body></html>';
        const result = sandbox.disarmHTML(input);
        assert.ok(!result.includes('data:'), 'data URI should be removed');
        assert.ok(!result.includes('vbscript:'), 'vbscript URI should be removed');
    });

    await t.test('disarmHTML should remove base and meta tags', () => {
        const input = '<html><head><base href="http://evil.com"><meta http-equiv="refresh" content="0;url=javascript:alert(1)"></head><body></body></html>';
        const result = sandbox.disarmHTML(input);
        assert.ok(!result.includes('<base'), 'base tag should be removed');
        assert.ok(!result.includes('<meta'), 'meta tag should be removed');
    });

    await t.test('disarmHTML should sanitize action, formaction, and xlink:href attributes', () => {
        const input = `<html><body>
            <form action="javascript:alert(1)"><input type="submit"></form>
            <button formaction="data:text/html,<script>alert(1)</script>">Click</button>
            <svg><use xlink:href="javascript:alert(1)"></use></svg>
        </body></html>`;
        const result = sandbox.disarmHTML(input);
        assert.ok(!result.includes('javascript:'), 'javascript URI should be removed from action/xlink:href');
        assert.ok(!result.includes('data:'), 'data URI should be removed from formaction');
        assert.ok(!result.includes('action="javascript'), 'action attribute should be removed/sanitized');
    });

});
