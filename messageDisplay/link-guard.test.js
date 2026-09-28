const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

const GUARD_CODE = fs.readFileSync(path.join(__dirname, 'link-guard.js'), 'utf8');

function createContext(options = {}) {
    const dom = new JSDOM('<!doctype html><html><body><a href="https://evil.example/a">Link</a></body></html>');
    const sent = [];
    const context = {
        browser: {
            i18n: { getMessage: () => '' },
            runtime: {
                sendMessage: async (message) => {
                    sent.push(message);
                    if (message.action === 'getLinkGuardSettings') {
                        return { status: 'success', mode: options.mode || 'hint', target: options.target || 'inline' };
                    }
                    if (message.action === 'evaluateLink') {
                        return { status: 'success', evaluation: options.evaluation || {
                            url: message.url, display: 'https://evil.example/...', host: 'evil.example',
                            registrableDomain: 'evil.example', decodedHost: null, flags: ['Punycode-Host'],
                            verdict: 'KNOWN_CLEAN', checked: true, messageHeaderId: 'hdr-1'
                        } };
                    }
                    return { status: 'success' };
                },
                onMessage: { addListener: () => {} }
            }
        },
        document: dom.window.document,
        MutationObserver: dom.window.MutationObserver,
        setTimeout,
        console: { log: () => {}, error: () => {}, warn: () => {} }
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(GUARD_CODE, context);
    return { context, sent, dom };
}

function click(link) {
    const event = new (link.ownerDocument.defaultView.Event)('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    return event;
}

describe('messageDisplay/link-guard.js', () => {
    let ctx;

    beforeEach(() => { ctx = createContext(); });

    it('decorates links and shows the tooltip with the additional information', async () => {
        const link = ctx.dom.window.document.querySelector('a');
        await ctx.context.thundyGuardInit();

        assert.strictEqual(link.classList.contains('thundy-guard-link'), true);
        assert.strictEqual(link.getAttribute('data-thundy-guard'), '1');

        await ctx.context.thundyGuardRenderTooltip(link, {
            display: 'https://evil.example/...', host: 'evil.example', registrableDomain: 'evil.example',
            decodedHost: 'xn--80ak6aa92e.com', flags: ['Punycode-Host'], verdict: 'KNOWN_MALICIOUS', checked: true
        });

        const tooltip = ctx.dom.window.document.getElementById('thundy-link-tooltip');
        assert.ok(tooltip, 'tooltip expected');
        assert.match(tooltip.textContent, /Thundy AV Link-Guard/);
        assert.match(tooltip.textContent, /Host: evil\.example/);
        assert.match(tooltip.textContent, /Liest sich als: xn--80ak6aa92e\.com/);
        assert.match(tooltip.textContent, /Als bösartig bekannt/);
        assert.match(tooltip.textContent, /Punycode-Host/);
        assert.ok(tooltip.querySelector('.thundy-guard-check'));
        assert.ok(tooltip.querySelector('.thundy-guard-open'));
        assert.ok(tooltip.querySelector('.thundy-guard-popup'));
    });

    it('checks a link on demand and enables opening afterwards', async () => {
        const link = ctx.dom.window.document.querySelector('a');
        await ctx.context.thundyGuardInit();
        await ctx.context.thundyGuardRenderTooltip(link, null);

        const tooltip = ctx.dom.window.document.getElementById('thundy-link-tooltip');
        const openButton = tooltip.querySelector('.thundy-guard-open');
        assert.strictEqual(openButton.disabled, true, 'open must stay disabled before the check');

        tooltip.querySelector('.thundy-guard-check').click();
        await new Promise(resolve => setImmediate(resolve));

        assert.ok(ctx.sent.some(message => message.action === 'evaluateLink' && message.url === 'https://evil.example/a'));
        assert.strictEqual(openButton.disabled, false, 'open is enabled after the check');

        openButton.click();
        await new Promise(resolve => setImmediate(resolve));
        assert.ok(ctx.sent.some(message => message.action === 'openLinkAfterCheck'));
    });

    it('blocks the click in confirm mode and keeps the hint mode permissive', async () => {
        const blocking = createContext({ mode: 'confirm', target: 'inline' });
        const blockingLink = blocking.dom.window.document.querySelector('a');
        await blocking.context.thundyGuardInit();
        await new Promise(resolve => setImmediate(resolve));
        const blockedEvent = click(blockingLink);
        await new Promise(resolve => setImmediate(resolve));

        assert.strictEqual(blockedEvent.defaultPrevented, true, 'click must be intercepted in confirm mode');
        const tooltip = blocking.dom.window.document.getElementById('thundy-link-tooltip');
        assert.ok(tooltip);
        assert.strictEqual(tooltip.classList.contains('thundy-guard-modal'), true);
        assert.match(tooltip.textContent, /Klick abgefangen/);

        const hinting = createContext({ mode: 'hint' });
        const hintLink = hinting.dom.window.document.querySelector('a');
        await hinting.context.thundyGuardInit();
        const allowedEvent = click(hintLink);
        await new Promise(resolve => setImmediate(resolve));

        assert.strictEqual(allowedEvent.defaultPrevented, false, 'hint mode does not block clicks');
    });

    it('routes the confirmation to the add-on popup when configured', async () => {
        const popup = createContext({ mode: 'confirm', target: 'popup' });
        const link = popup.dom.window.document.querySelector('a');
        await popup.context.thundyGuardInit();
        await new Promise(resolve => setImmediate(resolve));

        const event = click(link);
        await new Promise(resolve => setImmediate(resolve));

        assert.strictEqual(event.defaultPrevented, true);
        assert.ok(popup.sent.some(message => message.action === 'openLinkGuardPopup'), 'popup must be requested');
    });

    it('passes an already allowed link through', async () => {
        const allowing = createContext({ mode: 'confirm' });
        const link = allowing.dom.window.document.querySelector('a');
        await allowing.context.thundyGuardInit();
        allowing.context.thundyGuardAllow('https://evil.example/a');

        const event = click(link);

        assert.strictEqual(event.defaultPrevented, false, 'an allowed link passes through');
    });
});

