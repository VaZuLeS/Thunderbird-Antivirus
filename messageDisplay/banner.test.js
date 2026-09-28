const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

const BANNER_CODE = fs.readFileSync(path.join(__dirname, 'banner.js'), 'utf8');

function createContext({ consent = true, openOptionsPage = () => {} } = {}) {
    const dom = new JSDOM('<!doctype html><html><body><a href="https://example.com/login">Login</a></body></html>');
    const sent = [];
    const context = {
        browser: {
            i18n: { getMessage: () => '' }, // force the English fallbacks
            runtime: {
                sendMessage: async (message) => {
                    sent.push(message);
                    if (message.action === 'getDisplayState') return { mode: 'pending' };
                    return { success: true };
                },
                onMessage: { addListener: () => {} },
                openOptionsPage
            }
        },
        document: dom.window.document,
        console: { log: () => {}, error: () => {}, warn: () => {} },
        setTimeout: () => 0, // no retry loop inside the tests
        Array: globalThis.Array,
        Map: globalThis.Map,
        String: globalThis.String
    };
    vm.createContext(context);
    vm.runInContext(BANNER_CODE, context);
    return { context, sent, dom };
}

function readyState(overrides = {}) {
    return Object.assign({
        mode: 'ready',
        messageId: 42,
        senderEmail: 'sender@example.com',
        consent: true,
        showOptIn: true,
        timeOfClickProtection: false,
        urls: [],
        threat: { score: 0, reasons: [], authStatus: 'neutral' }
    }, overrides);
}

describe('messageDisplay/banner.js', () => {
    let ctx;

    beforeEach(() => {
        ctx = createContext();
    });

    it('ignores states that are not ready', () => {
        ctx.context.thundyRenderDisplayState({ mode: 'pending' });
        assert.strictEqual(ctx.dom.window.document.getElementById('thundy-optin-banner'), null);
        assert.strictEqual(ctx.dom.window.document.getElementById('thundy-threat-banner'), null);
    });

    it('renders the threat banner with score and reasons', () => {
        ctx.context.thundyRenderDisplayState(readyState({
            showOptIn: false,
            threat: { score: 87, reasons: ['Typosquatting link', 'Reply-To mismatch'], authStatus: 'fail' }
        }));

        const banner = ctx.dom.window.document.getElementById('thundy-threat-banner');
        assert.ok(banner, 'threat banner must exist');
        assert.match(banner.textContent, /Risk score: 87 of 100/);
        assert.match(banner.textContent, /Typosquatting link/);
        assert.match(banner.textContent, /Reply-To mismatch/);
        assert.strictEqual(ctx.dom.window.document.getElementById('thundy-auth-badge'), null);
    });

    it('renders the verified badge for a passing authentication status', () => {
        ctx.context.thundyRenderDisplayState(readyState({
            showOptIn: false,
            threat: { score: 0, reasons: [], authStatus: 'pass' }
        }));

        const badge = ctx.dom.window.document.getElementById('thundy-auth-badge');
        assert.ok(badge);
        assert.match(badge.textContent, /Sender verified/);
        assert.strictEqual(ctx.dom.window.document.getElementById('thundy-threat-banner'), null);
    });

    it('renders the opt-in banner with two separate actions', () => {
        ctx.context.thundyRenderDisplayState(readyState());

        const banner = ctx.dom.window.document.getElementById('thundy-optin-banner');
        assert.ok(banner);
        const buttons = banner.querySelectorAll('button');
        assert.strictEqual(buttons.length, 2);
        assert.strictEqual(buttons[0].textContent, 'Scan this message once');
        assert.strictEqual(buttons[1].textContent, 'Always scan this sender');
    });

    it('sends a one-off scan without persist and a permanent opt-in with persist', async () => {
        ctx.context.thundyRenderDisplayState(readyState());

        const banner = ctx.dom.window.document.getElementById('thundy-optin-banner');
        const buttons = banner.querySelectorAll('button');

        buttons[0].click();
        await new Promise(resolve => setImmediate(resolve));
        buttons[1].click();
        await new Promise(resolve => setImmediate(resolve));

        const scans = ctx.sent.filter(message => message.action === 'requestScan');
        assert.strictEqual(scans.length, 2);
        assert.strictEqual(scans[0].persist, false);
        assert.strictEqual(scans[1].persist, true);
        assert.strictEqual(scans[0].messageId, 42);
        assert.strictEqual(scans[0].senderEmail, 'sender@example.com');
    });

    it('offers a shortcut to the options page when consent is missing', () => {
        ctx.context.thundyRenderDisplayState(readyState({ consent: false }));

        const banner = ctx.dom.window.document.getElementById('thundy-optin-banner');
        assert.match(banner.textContent, /External analysis is disabled/);
        assert.ok(banner.querySelector('#thundy-open-options'));
    });

    it('points to the options page when the host permission is missing', async () => {
        const denied = createContext();
        denied.context.browser.runtime.sendMessage = async (message) => {
            denied.sent.push(message);
            if (message.action === 'getDisplayState') return { mode: 'pending' };
            return { success: false, error: 'permission_required', code: 'PERMISSION_REQUIRED' };
        };
        denied.context.thundyRenderDisplayState(readyState());

        const banner = denied.dom.window.document.getElementById('thundy-optin-banner');
        banner.querySelectorAll('button')[0].click();
        await new Promise(resolve => setImmediate(resolve));

        assert.match(banner.textContent, /host permission was denied/);
        assert.ok(banner.querySelector('#thundy-open-options'));
    });

    it('shows the concrete reason when a scan fails', async () => {
        const failing = createContext();
        failing.context.browser.runtime.sendMessage = async (message) => {
            failing.sent.push(message);
            if (message.action === 'getDisplayState') return { mode: 'pending' };
            return { success: false, code: 'SCAN_FAILED', stage: 'links', error: 'folderId is required' };
        };
        failing.context.thundyRenderDisplayState(readyState());

        const banner = failing.dom.window.document.getElementById('thundy-optin-banner');
        banner.querySelectorAll('button')[0].click();
        await new Promise(resolve => setImmediate(resolve));

        assert.match(banner.textContent, /folderId is required/);
        assert.match(banner.textContent, /links/);
    });

    it('points to the options page when no API key is configured', async () => {
        const noKey = createContext();
        noKey.context.browser.runtime.sendMessage = async (message) => {
            noKey.sent.push(message);
            if (message.action === 'getDisplayState') return { mode: 'pending' };
            return { success: false, code: 'NO_API_KEY', error: 'Kein API-Schluessel' };
        };
        noKey.context.thundyRenderDisplayState(readyState());

        const banner = noKey.dom.window.document.getElementById('thundy-optin-banner');
        banner.querySelectorAll('button')[0].click();
        await new Promise(resolve => setImmediate(resolve));

        assert.match(banner.textContent, /API key/);
        assert.ok(banner.querySelector('#thundy-open-options'));
    });

    it('communicates that local checks are finished in real time', () => {
        ctx.context.thundyRenderDisplayState(readyState({
            showOptIn: true,
            localChecks: { timing: 'realtime', finished: true }
        }));

        const banner = ctx.dom.window.document.getElementById('thundy-optin-banner');
        assert.ok(banner);
        assert.ok(banner.querySelector('#thundy-scan-status'));
    });

    it('announces the delayed external analysis and keeps watching it', async () => {
        const delayed = createContext();
        delayed.context.browser.runtime.sendMessage = async (message) => {
            delayed.sent.push(message);
            if (message.action === 'getDisplayState') return { mode: 'pending' };
            if (message.action === 'scanStatus') {
                return { status: 'success', pollIntervalMinutes: 1, jobs: [
                    { sha256: 'd'.repeat(64), attachmentName: 'x.exe', state: 'running', attempts: 1, canPollNow: true }
                ] };
            }
            return { success: true, timing: 'delayed', pendingScans: 1, pollIntervalMinutes: 1 };
        };
        delayed.context.thundyRenderDisplayState(readyState());

        const banner = delayed.dom.window.document.getElementById('thundy-optin-banner');
        banner.querySelectorAll('button')[0].click();
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));

        const status = banner.querySelector('#thundy-scan-status');
        assert.ok(status, 'status line expected');
        assert.ok(delayed.sent.some(m => m.action === 'scanStatus'));
    });

    it('marks links when Time-of-Click Protection is enabled', () => {
        ctx.context.thundyRenderDisplayState(readyState({
            showOptIn: false,
            timeOfClickProtection: true,
            urls: ['https://example.com/login']
        }));

        const link = ctx.dom.window.document.querySelector('a');
        assert.strictEqual(link.title, 'Protected by Thundy Time-of-Click');
        assert.ok(link.classList.contains('thundy-toc-link'));
    });

    it('does not decorate links when Time-of-Click Protection is disabled', () => {
        ctx.context.thundyRenderDisplayState(readyState({ showOptIn: false, urls: ['https://example.com/login'] }));
        assert.strictEqual(ctx.dom.window.document.querySelector('a').title, '');
    });

    it('never transmits anything itself', async () => {
        ctx.context.thundyRenderDisplayState(readyState({ consent: false }));
        const banner = ctx.dom.window.document.getElementById('thundy-optin-banner');
        banner.querySelectorAll('button')[0].click();
        await new Promise(resolve => setImmediate(resolve));

        const allowedActions = ['getDisplayState', 'requestScan'];
        for (const message of ctx.sent) {
            assert.ok(allowedActions.includes(message.action), 'unexpected message: ' + message.action);
        }
    });
});
