const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

describe('content_script.js', () => {
    let dom;
    let context;
    let sendMessageMock;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <a id="safe-link" href="https://example.com/safe">Safe</a>
                    <a id="unsafe-link" href="http://example.com/unsafe">Unsafe</a>
                    <a id="non-http-link" href="mailto:test@example.com">Email</a>
                    <a id="js-link" href="javascript:alert(1)">JS</a>
                    <a id="data-link" href="data:text/html,<h1>Hello</h1>">Data</a>
                    <span id="not-a-link">Not a link</span>
                </body>
            </html>
        `, { url: "http://localhost/" });

        sendMessageMock = async () => ({ status: 'UNKNOWN' });

        context = {
            document: dom.window.document,
            browser: {
                runtime: {
                    sendMessage: async (msg) => sendMessageMock(msg)
                }
            },
            console: {
                error: () => {},
                log: () => {},
                warn: () => {}
            },
            Node: dom.window.Node, URL: dom.window.URL,
            setTimeout: (cb, ms) => cb()
        };

        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'content_script.js'), 'utf8');
        vm.runInContext(code, context);
    });

    it('should ignore non-link clicks', async () => {
        let messageSent = false;
        sendMessageMock = async () => { messageSent = true; return { status: 'CLEAN' }; };

        const span = context.document.getElementById('not-a-link');
        const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        span.dispatchEvent(event);

        assert.strictEqual(messageSent, false);
    });

    it('should ignore non-HTTP(S) links', async () => {
        let messageSent = false;
        sendMessageMock = async () => { messageSent = true; return { status: 'CLEAN' }; };

        const link = context.document.getElementById('non-http-link');
        const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);

        assert.strictEqual(messageSent, false);
        assert.strictEqual(event.defaultPrevented, false);
    });

    it('should block dangerous URIs like javascript: and data:', async () => {
        let messageSent = false;
        sendMessageMock = async () => { messageSent = true; return { status: 'CLEAN' }; };

        const jsLink = context.document.getElementById('js-link');
        const jsEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        jsLink.dispatchEvent(jsEvent);

        assert.strictEqual(messageSent, false);
        assert.strictEqual(jsEvent.defaultPrevented, true);

        const dataLink = context.document.getElementById('data-link');
        const dataEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        dataLink.dispatchEvent(dataEvent);

        assert.strictEqual(messageSent, false);
        assert.strictEqual(dataEvent.defaultPrevented, true);
    });

    it('should allow the click when status is CLEAN', async () => {
        let messageSent = false;
        sendMessageMock = async (msg) => {
            messageSent = true;
            assert.strictEqual(msg.action, 'checkLinkState');
            assert.strictEqual(msg.url, 'https://example.com/safe');
            return { status: 'CLEAN' };
        };

        const link = context.document.getElementById('safe-link');
        let allowedClickSeen = false;
        context.document.addEventListener('click', (e) => {
            if (!e.defaultPrevented) {
                allowedClickSeen = true;
            }
        });

        const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        // The first click is intercepted and preventDefault is called.
        // Then, after async completion, the content script clicks the link again (without preventing default).
        link.dispatchEvent(event);

        // Wait for microtasks
        await new Promise(resolve => setImmediate(resolve));

        assert.strictEqual(messageSent, true);
        assert.strictEqual(allowedClickSeen, true);
        assert.strictEqual(context.document.getElementById('thundy-loading-modal'), null);
        assert.strictEqual(context.document.querySelector('.thundy-overlay'), null);
    });

    it('should show a loading modal and then a warning modal when status is UNKNOWN', async () => {
        let resolveMessage;
        sendMessageMock = () => new Promise(resolve => { resolveMessage = resolve; });

        const link = context.document.getElementById('unsafe-link');
        const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);

        // Before resolution, loading modal should be visible
        assert.ok(context.document.getElementById('thundy-loading-modal'));
        assert.strictEqual(context.document.querySelector('.thundy-overlay .thundy-modal h2').textContent, 'Time-of-Click Protection aktiv...');

        // Resolve message
        resolveMessage({ status: 'UNKNOWN' });
        await new Promise(resolve => setImmediate(resolve));

        // Loading modal should be removed
        assert.strictEqual(context.document.getElementById('thundy-loading-modal'), null);

        // Warning modal should be visible
        const warningOverlay = context.document.querySelector('.thundy-overlay');
        assert.ok(warningOverlay);
        assert.strictEqual(warningOverlay.querySelector('h2').textContent, 'Achtung: Sie verlassen Thunderbird');
        assert.ok(warningOverlay.querySelector('p').textContent.includes('Dieser Link wurde noch nicht vollständig überprüft oder ist unbekannt.'));
    });

    it('should show MALICIOUS_VISUAL warning modal with reasons', async () => {
        sendMessageMock = async () => ({
            status: 'MALICIOUS_VISUAL',
            reasons: ['Reason 1', 'Reason 2']
        });

        const link = context.document.getElementById('unsafe-link');
        const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);

        await new Promise(resolve => setImmediate(resolve));

        const warningOverlay = context.document.querySelector('.thundy-overlay');
        assert.ok(warningOverlay);
        assert.strictEqual(warningOverlay.querySelector('h2').textContent, 'Warnung: Visuelles Phishing erkannt!');
        assert.strictEqual(warningOverlay.querySelector('h2').style.color, 'red');

        const lis = warningOverlay.querySelectorAll('li');
        assert.strictEqual(lis.length, 2);
        assert.strictEqual(lis[0].textContent, 'Reason 1');
        assert.strictEqual(lis[1].textContent, 'Reason 2');
    });

    it('should show a warning modal when sendMessage throws an error', async () => {
        sendMessageMock = async () => { throw new Error('Network error'); };

        const link = context.document.getElementById('unsafe-link');
        const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);

        await new Promise(resolve => setImmediate(resolve));

        const warningOverlay = context.document.querySelector('.thundy-overlay');
        assert.ok(warningOverlay);

        const stateInfo = Array.from(warningOverlay.querySelectorAll('p')).find(p => p.textContent.startsWith('Status: '));
        assert.ok(stateInfo);
        assert.strictEqual(stateInfo.textContent, 'Status: ERROR');
    });

    it('should remove the warning modal when Cancel is clicked', async () => {
        sendMessageMock = async () => ({ status: 'UNKNOWN' });

        const link = context.document.getElementById('unsafe-link');
        const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);

        await new Promise(resolve => setImmediate(resolve));

        const warningOverlay = context.document.querySelector('.thundy-overlay');
        assert.ok(warningOverlay);

        const cancelBtn = warningOverlay.querySelector('.btn-success');
        assert.strictEqual(cancelBtn.textContent, 'Abbrechen');

        let focusCalled = false;
        link.focus = () => { focusCalled = true; };

        cancelBtn.click();

        assert.strictEqual(context.document.querySelector('.thundy-overlay'), null);
        assert.strictEqual(focusCalled, true);
    });

    it('should remove the warning modal when Escape key is pressed', async () => {
        sendMessageMock = async () => ({ status: 'UNKNOWN' });

        const link = context.document.getElementById('unsafe-link');
        const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);

        await new Promise(resolve => setImmediate(resolve));

        const warningOverlay = context.document.querySelector('.thundy-overlay');
        assert.ok(warningOverlay);

        let focusCalled = false;
        link.focus = () => { focusCalled = true; };

        const modal = warningOverlay.querySelector('.thundy-modal');
        const keydownEvent = new dom.window.KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true
        });
        modal.dispatchEvent(keydownEvent);

        assert.strictEqual(context.document.querySelector('.thundy-overlay'), null);
        assert.strictEqual(focusCalled, true);
    });

    it('should remove the warning modal and allow click when Open Anyway is clicked', async () => {
        sendMessageMock = async () => ({ status: 'UNKNOWN' });

        const link = context.document.getElementById('unsafe-link');
        let allowedClickSeen = false;
        context.document.addEventListener('click', (e) => {
            if (!e.defaultPrevented) {
                allowedClickSeen = true;
            }
        });

        const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);

        await new Promise(resolve => setImmediate(resolve));

        const warningOverlay = context.document.querySelector('.thundy-overlay');
        assert.ok(warningOverlay);

        const openBtn = warningOverlay.querySelector('.btn-primary');
        assert.strictEqual(openBtn.textContent, 'Auf eigene Gefahr öffnen');

        openBtn.click();

        assert.strictEqual(context.document.querySelector('.thundy-overlay'), null);
        assert.strictEqual(allowedClickSeen, true);
    });
});
