const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const runtime = fs.readFileSync('runtime.js', 'utf8');
const gateway = fs.readFileSync('api_gateway.js', 'utf8');
function setup(settings = {}) {
    const requests = [], injections = [], listeners = [];
    const config = { externalAnalysisConsent: false, privacyTier: 'strict', ...settings };
    const message = { id: 7, headerMessageId: 'mail-7', author: 'Alice <alice@example.com>', subject: 'Hello' };
    const full = { headers: {}, parts: [{ contentType: 'text/plain', body: 'Visit https://example.com/' }] };
    const context = vm.createContext({
        console: { error() {}, warn() {}, info() {} }, URL, URLSearchParams, Blob, File, FormData,
        DOMParser: new JSDOM().window.DOMParser, crypto: globalThis.crypto, AbortController, setTimeout, clearTimeout, TextEncoder,
        browser: {
            runtime: { id: 'test', getURL: p => p, getManifest: () => ({ version: '1.20.0' }), onMessage: { addListener: f => listeners.push(f) } },
            storage: { local: { get: async () => ({ ...config }), set: async values => Object.assign(config, values) }, onChanged: { addListener() {} } },
            permissions: { contains: async () => true, request: async () => true },
            messages: { get: async () => message, getFull: async () => full, listAttachments: async () => [{ name: 'file.html', contentType: 'text/html', partName: '1', size: 4 }], getAttachmentFile: async () => new File(['test'], 'file.html') },
            messageDisplay: { getDisplayedMessages: async () => ({ messages: [message] }), onMessagesDisplayed: { addListener() {} } },
            windows: { openDefaultBrowser: async () => {} },
            scripting: { executeScript: async script => { injections.push(script); } }, menus: { create() {}, onClicked: { addListener() {} } }, notifications: { create() {} }
        },
        fetch: async (url, options) => { requests.push({ url, options }); return { status: 200, ok: true, json: async () => ({ verdict: 'no specific threat', query_status: 'no_results', data: { attributes: { last_analysis_stats: { malicious: 0 } } } }) }; },
        openDB: async () => ({}), getFromStore: async () => null, updateStore: async () => {},
    });
    vm.runInContext(fs.readFileSync('i18n.js', 'utf8') + '\n' + runtime + '\n' + gateway + '\n' + fs.readFileSync('risk.js', 'utf8') + '\n' + fs.readFileSync('sanitize.js', 'utf8') + '\n' + ['scan_policy.js', 'providers.js', 'message_ui.js', 'vendor/tldts.js', 'link_audit.js', 'background.js'].map(file => fs.readFileSync(file, 'utf8')).join('\n') + '\n globalThis.configure = async () => { await loadSettings(); }; globalThis.forceTier = value => { privacyTier = value; };', context);
    return { context, config, requests, injections, listeners, message, full };
}

test('opening an unauthorized sender never sends data across all privacy tiers', async () => {
    for (const consent of [false, true]) for (const tier of ['strict', 'balanced', 'max']) {
        const state = setup({ externalAnalysisConsent: consent, privacyTier: tier, apikey: 'dummy', virustotalApikey: 'dummy', urlhausApikey: 'dummy', urlscanApikey: 'dummy', autoScanLinks: true });
        await state.context.configure();
        await state.context.handleDisplayedMessage({ id: 1 }, state.message);
        assert.equal(state.requests.length, 0, `${consent}/${tier}`);
        assert.ok(state.injections.length > 0);
    }
});

test('authorized senders respect manual mode and full URL tier', async () => {
    for (const manual of [false, true]) for (const tier of ['strict', 'balanced', 'max']) {
        const state = setup({ externalAnalysisConsent: true, alwaysManual: manual, privacyTier: tier, apikey: 'dummy', autoScanLinks: true, scanningEnabledSenders: ['alice@example.com'] });
        await state.context.configure();
        await state.context.handleDisplayedMessage({ id: 1 }, state.message);
        assert.equal(state.requests.some(x => x.url.endsWith('/quick-scan/url')), !manual && tier === 'max');
        if (manual) assert.equal(state.requests.length, 0);
    }
});

test('urlscan does not submit complete URLs in strict or balanced', async () => {
    for (const tier of ['strict', 'balanced']) {
        const state = setup({ externalAnalysisConsent: true, privacyTier: tier });
        await state.context.configure();
        assert.equal((await state.context.checkUrlscanIo('https://example.com/?token=secret', 'dummy')).status, 'NOT_CHECKED');
        assert.equal(state.requests.length, 0);
    }
});

test('one-off scan uses authoritative message metadata and does not authorize another sender', async () => {
    const state = setup({ externalAnalysisConsent: true, privacyTier: 'strict', alwaysManual: true });
    await state.context.configure();
    const result = await state.context.handleRequestScan({ messageId: 7, senderEmail: 'forged@example.net', persist: true }, { tab: { id: 1 } });
    assert.equal(result.success, true);
    assert.deepEqual(Array.from(state.config.scanningEnabledSenders), ['alice@example.com']);
    assert.equal(state.requests.length, 0); // local use without a provider key
});

test('URLhaus errors remain unknown and are retried instead of cached as clean', async () => {
    const state = setup({ externalAnalysisConsent: true, urlhausApikey: 'dummy' });
    await state.context.configure();
    let calls = 0;
    state.context.fetch = async () => { calls++; throw new Error('offline'); };
    await state.context.checkURLhausDomains(['https://example.com/']);
    await state.context.checkURLhausDomains(['https://example.com/']);
    assert.equal(calls, 2);
});

test('link protection intercepts normal and middle clicks and presents an explicit choice', async () => {
    const state = setup(); await state.context.configure();
    await state.context.injectTimeOfClickProtection(1, ['https://example.com/'], 7);
    const injected = state.injections.at(-1);
    for (const [type, button] of [['click', 0], ['auxclick', 1]]) {
        const dom = new JSDOM('<a href="https://example.com/">Open</a>', { url: 'https://mail.invalid/' });
        let payload;
        const context = vm.createContext({ document: dom.window.document, window: dom.window, URL, browser: { runtime: { sendMessage: async value => { payload = value; return value.action === 'openCheckedLink' ? { success: true } : { status: 'MALICIOUS' }; } } } });
        context.args = injected.args;
        vm.runInContext('(' + injected.func.toString() + ')(...args)', context);
        const event = new dom.window.MouseEvent(type, { button, bubbles: true, cancelable: true });
        dom.window.document.querySelector('a').dispatchEvent(event);
        assert.equal(event.defaultPrevented, true);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(payload.userAction, true); assert.equal(payload.messageId, 7);
        assert.equal(dom.window.document.querySelector('[role="alertdialog"]').shadowRoot.querySelectorAll('button').length, 2);
        dom.window.document.querySelector('[role="alertdialog"]').shadowRoot.querySelector('.primary').click();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(payload.action, 'openCheckedLink');
        assert.equal(payload.url, 'https://example.com/');
        assert.equal(dom.window.document.querySelector('[role="alertdialog"]'), null);
    }
});

test('reputation cache expires and workload stays bounded', async () => {
    const context = vm.createContext({}); vm.runInContext(runtime + '\n globalThis.Cache = ExpiringMap;', context);
    let now = 0; const cache = new context.Cache(10, () => now);
    cache.set('a', false); now = 11; assert.equal(cache.has('a'), false);
    let active = 0, peak = 0;
    await context.mapWithLimit(Array.from({ length: 20 }), 2, async () => { peak = Math.max(peak, ++active); await new Promise(resolve => setImmediate(resolve)); active--; });
    assert.equal(peak, 2);
});

test('gateway cancels running and queued work on consent withdrawal', async () => {
    const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, TextEncoder, console, fetch: (_, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => { const error = new Error('cancelled'); error.name = 'AbortError'; reject(error); });
    }) });
    vm.runInContext(gateway + '\n globalThis.gateway = apiGateway;', context);
    const jobs = [1, 2, 3].map(() => context.gateway.fetchWithTimeout('https://example.com/'));
    await new Promise(resolve => setImmediate(resolve));
    context.gateway.abortAll();
    const results = await Promise.allSettled(jobs);
    assert.ok(results.every(x => x.status === 'rejected'));
    assert.equal(context.gateway.controllers.size, 0);
});

test('public suffix handling distinguishes private tenants and normalizes IDNs', () => {
    const context = vm.createContext({}); vm.runInContext(fs.readFileSync('vendor/tldts.js', 'utf8'), context);
    assert.equal(context.tldts.getDomain('mail.shop.co.uk'), 'shop.co.uk');
    assert.equal(context.tldts.getDomain('alice.github.io', { allowPrivateDomains: true }), 'alice.github.io');
    assert.equal(new URL('https://bücher.de').hostname, 'xn--bcher-kva.de');
});

test('DAO waits for commit and reports a late transaction abort', async () => {
    const context = vm.createContext({ console }); vm.runInContext(fs.readFileSync('db.js', 'utf8'), context);
    for (const abort of [false, true]) {
        let request = {}, tx = { objectStore: () => ({ put: () => request }) };
        const job = context.putToStore({ transaction: () => tx }, 'hybridanalysis', { messageHeader: 'm' });
        let settled = false; job.then(() => { settled = true; }, () => { settled = true; });
        request.result = 'm'; request.onsuccess(); await Promise.resolve(); assert.equal(settled, false);
        if (abort) { tx.onabort(); await assert.rejects(job, /aborted/); }
        else { tx.oncomplete(); assert.equal(await job, 'm'); }
    }
});

test('heuristic corpus distinguishes urgency from ordinary invoices across message languages', async () => {
    const state = setup(); await state.context.configure();
    const corpus = JSON.parse(fs.readFileSync('testdata/heuristics.json'));
    for (const sample of corpus) {
        const reasons = [];
        const score = state.context.evaluateBehavior(sample.subject, sample.body, true, 0, reasons);
        assert.equal(score >= 50, sample.risky, sample.language + ': ' + sample.subject);
    }
});

test('untrusted authentication reports never become a verified status', async () => {
    const state = setup(); await state.context.configure();
    state.full.headers['authentication-results'] = ['attacker.invalid; spf=pass dkim=pass dmarc=pass'];
    const options = await state.context.collectThreatEvaluationOptions({ message: state.message, fullMessage: state.full, filteredUrls: [], messageText: '', allowExternal: false });
    const result = state.context.calculateThreatScore(state.message.author, [], options);
    assert.equal(result.authStatus, 'neutral');
    state.config.trustedAuthServers = ['recipient.example.com'];
    state.full.headers['authentication-results'] = ['recipient.example.com; spf=pass dkim=pass dmarc=pass'];
    const trusted = await state.context.collectThreatEvaluationOptions({ message: state.message, fullMessage: state.full, filteredUrls: [], messageText: '', allowExternal: false });
    assert.equal(state.context.calculateThreatScore(state.message.author, [], trusted).authStatus, 'pass');
});

test('sanitized HTML cannot load remote images or CSS and removes forms', async () => {
    const state = setup();
    const clean = state.context.disarmHTML('<style>@import "https://remote.invalid/x";</style><img src="https://remote.invalid/pixel" srcset="https://remote.invalid/large"><p style="background:url(https://remote.invalid/bg)">Visible</p><form action="https://remote.invalid/"><input></form>');
    assert.ok(clean.includes('Visible'));
    assert.ok(!clean.includes('remote.invalid'));
    assert.ok(!clean.includes('<form'));
});

test('oversize attachments remain visible without allocating a file', async () => {
    const state = setup(); await state.context.configure();
    state.context.browser.messages.getAttachmentFile = async () => { throw new Error('must not read'); };
    const result = await state.context.process_single_attachment(state.message, { size: 26 * 1024 * 1024, name: 'large.html', partName: '1' }, false);
    assert.equal(result.hybrid_data.state, 'SIZE_LIMIT');
    assert.equal(state.requests.length, 0);
});

test('cache retention deletes expired records and keeps the newest 1000', async () => {
    const context = vm.createContext({ console }); vm.runInContext(fs.readFileSync('db.js', 'utf8'), context);
    const now = Date.now(), deleted = [];
    const records = [{ key: 'expired', value: { updatedAt: now - 31 * 86400000 } }, ...Array.from({ length: 1001 }, (_, i) => ({ key: 'recent-' + i, value: { updatedAt: now - i } }))];
    let index = 0, request = {}, transaction;
    function next() {
        const item = records[index++];
        request.result = item ? { ...item, primaryKey: item.key, delete: () => deleted.push(item.key), continue: () => queueMicrotask(next) } : null;
        request.onsuccess();
        if (!item) queueMicrotask(() => transaction.oncomplete());
    }
    const db = { objectStoreNames: { contains: () => true }, transaction: () => transaction = { objectStore: () => ({ openCursor: () => { queueMicrotask(next); return request; }, delete: key => deleted.push(key) }) } };
    await context.pruneStore(db, 'hybridanalysis', now);
    assert.deepEqual(deleted, ['expired', 'recent-1000']);
});

test('provider retries honor Retry-After for GET and never repeat an upload', async () => {
    let calls = 0;
    const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, TextEncoder, console: { warn() {} }, fetch: async () => {
        calls++; return { status: calls === 1 ? 429 : 200, headers: { get: () => '0' } };
    } });
    vm.runInContext(gateway + '\n globalThis.gateway = apiGateway;', context);
    assert.equal((await context.gateway.fetchWithTimeout('https://example.com/')).status, 200);
    assert.equal(calls, 2);
    calls = 0;
    assert.equal((await context.gateway.fetchWithTimeout('https://example.com/', { method: 'POST' })).status, 429);
    assert.equal(calls, 1);
});

test('IP reputation failures are not stored as clean results', async () => {
    const state = setup({ externalAnalysisConsent: true, ipReputationProvider: 'abuseipdb', ipReputationApiKey: 'dummy' });
    await state.context.configure();
    let calls = 0;
    state.context.fetch = async () => { calls++; return { status: 503, json: async () => ({}) }; };
    await state.context.checkIPReputation(['from host (8.8.8.8)']);
    await state.context.checkIPReputation(['from host (8.8.8.8)']);
    assert.equal(calls, 2);
});

test('request deadline also aborts a stalled JSON body', async () => {
    const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, TextEncoder, console, fetch: async (_, { signal }) => ({
        status: 200, body: {}, headers: { get: () => null },
        json: () => new Promise((resolve, reject) => {
            const fail = () => { const error = new Error('cancelled body'); error.name = 'AbortError'; reject(error); };
            signal.addEventListener('abort', fail, { once: true });
            if (signal.aborted) fail();
        })
    }) });
    vm.runInContext(gateway + '\n globalThis.gateway = apiGateway;', context);
    await assert.rejects(context.gateway.fetchWithTimeout('https://example.com/', {}, 10), /timed out/);
    assert.equal(context.gateway.controllers.size, 0);
});

test('every configured provider stays offline without its host permission', async () => {
    const state = setup({ externalAnalysisConsent: true, privacyTier: 'max', apikey: 'dummy' });
    await state.context.configure();
    state.context.browser.permissions.contains = async () => false;
    await Promise.allSettled([
        state.context.checkVirusTotal('a'.repeat(64), 'dummy'),
        state.context.checkURLhaus('example.com', 'dummy'),
        state.context.checkUrlscanIo('https://example.com/', 'dummy'),
        state.context.checkAbuseIPDB('8.8.8.8', 'dummy'),
        state.context.checkVirusTotalIP('8.8.8.8', 'dummy'),
        state.context.handleUrlScan('https://example.com/', 'mail-7')
    ]);
    assert.equal(state.requests.length, 0);
});

async function clickDialog(status = 'UNKNOWN', open = async () => ({ success: true })) {
    const state = setup(); await state.context.configure();
    await state.context.injectTimeOfClickProtection(1, [], 7);
    const injected = state.injections.at(-1);
    const dom = new JSDOM('<a href="https://example.com/path?token=secret">Visit</a>', { url: 'https://mail.invalid/' });
    const sent = [];
    const context = vm.createContext({ document: dom.window.document, URL, browser: { runtime: { sendMessage: async payload => {
        sent.push(payload); return payload.action === 'checkLinkState' ? { status, reasons: ['Provider result'] } : open(payload);
    } } }, args: injected.args });
    vm.runInContext('(' + injected.func.toString() + ')(...args)', context);
    const link = dom.window.document.querySelector('a');
    link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setImmediate(resolve));
    const panel = dom.window.document.querySelector('[role="alertdialog"]');
    return { dom, link, sent, panel, root: panel.shadowRoot };
}

test('confirmed links use the default browser without navigating the message', async () => {
    const state = setup(); await state.context.configure();
    const opened = []; state.context.browser.windows.openDefaultBrowser = async url => opened.push(url);
    for (const protocol of ['https', 'http']) {
        const result = await state.context.handleOpenCheckedLink({ url: protocol + '://example.com/path?q=1', messageId: 7 }, { tab: { id: 1 } });
        assert.equal(result.success, true);
    }
    assert.equal(opened.length, 2);
    const dialog = await clickDialog('CLEAN', async payload => state.context.handleOpenCheckedLink(payload, { tab: { id: 1 } }));
    assert.match(dialog.root.textContent, /Thundy AV/);
    assert.equal(dialog.root.querySelector('.destination').textContent, 'example.com');
    dialog.root.querySelector('.primary').click(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(dialog.panel.isConnected, false);
    assert.equal(dialog.dom.window.location.href, 'https://mail.invalid/');
    assert.equal(opened.at(-1), 'https://example.com/path?token=secret');
    assert.equal(dialog.sent[1].action, 'openCheckedLink');
});

test('link opening rejects unsafe schemes, absent contexts and a changed message', async () => {
    const state = setup(); await state.context.configure();
    let opens = 0; state.context.browser.windows.openDefaultBrowser = async () => { opens++; };
    for (const url of ['javascript:alert(1)', 'file:///tmp/test', 'data:text/html,test', 'not a url']) {
        assert.equal((await state.context.handleOpenCheckedLink({ url, messageId: 7 }, { tab: { id: 1 } })).success, false);
    }
    assert.equal((await state.context.handleOpenCheckedLink({ url: 'https://example.com/', messageId: 8 }, { tab: { id: 1 } })).success, false);
    assert.equal((await state.context.handleOpenCheckedLink({ url: 'https://example.com/', messageId: 7 }, {})).success, false);
    assert.equal(opens, 0);
});

test('failed browser handoff keeps the dialog and supports retry without duplicate opens', async () => {
    let attempts = 0;
    const dialog = await clickDialog('UNKNOWN', async () => ({ success: ++attempts > 1 }));
    const button = dialog.root.querySelector('.primary'); button.click(); button.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(attempts, 1); assert.equal(dialog.panel.isConnected, true);
    assert.ok(dialog.root.querySelector('[role="alert"]').textContent.length > 0);
    assert.equal(button.disabled, false); button.click(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(attempts, 2); assert.equal(dialog.panel.isConnected, false);
});

test('cancel and Escape never open links; a changed destination cannot be confirmed', async () => {
    for (const action of ['cancel', 'escape', 'changed']) {
        const dialog = await clickDialog('MALICIOUS');
        if (action === 'cancel') dialog.root.querySelector('button').click();
        else if (action === 'escape') dialog.root.querySelector('button').dispatchEvent(new dialog.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        else { dialog.link.href = 'https://changed.invalid/'; dialog.root.querySelector('.primary').click(); }
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(dialog.panel.isConnected, false); assert.equal(dialog.sent.filter(value => value.action === 'openCheckedLink').length, 0);
        assert.equal(dialog.sent.at(-1).action, 'cancelLinkInteraction');
    }
});

test('context/right clicks and non-web links retain their native behavior', async () => {
    const state = setup(); await state.context.configure(); await state.context.injectTimeOfClickProtection(1, [], 7);
    const injected = state.injections.at(-1);
    const dom = new JSDOM('<a href="https://example.com/">Web</a><a href="mailto:a@example.com">Mail</a>');
    const context = vm.createContext({ document: dom.window.document, URL, browser: { runtime: { sendMessage: () => { throw new Error('unexpected'); } } }, args: injected.args });
    vm.runInContext('(' + injected.func.toString() + ')(...args)', context);
    for (const [index, type, button] of [[0, 'click', 2], [0, 'auxclick', 2], [1, 'click', 0]]) {
        const event = new dom.window.MouseEvent(type, { button, bubbles: true, cancelable: true });
        dom.window.document.querySelectorAll('a')[index].dispatchEvent(event);
        assert.equal(event.defaultPrevented, false);
    }
    assert.equal(dom.window.document.querySelector('[role="alertdialog"]'), null);
});


test('a rejected system browser call is reported as failure instead of false success', async () => {
    const state = setup(); await state.context.configure();
    state.context.browser.windows.openDefaultBrowser = async () => { throw new Error('OS browser launch failed'); };
    assert.equal((await state.context.handleOpenCheckedLink({ url: 'https://example.com/', messageId: 7 }, { tab: { id: 1 } })).success, false);
});

test('cancelling a pending check cannot restore the dialog or open its URL', async () => {
    const state = setup(); await state.context.configure(); await state.context.injectTimeOfClickProtection(1, [], 7);
    const injected = state.injections.at(-1), dom = new JSDOM('<a href="https://example.com/">Web</a>');
    let resolveCheck; const sent = [];
    const context = vm.createContext({ document: dom.window.document, URL, args: injected.args, browser: { runtime: { sendMessage: value => { sent.push(value); return value.action === 'checkLinkState' ? new Promise(resolve => { resolveCheck = resolve; }) : Promise.resolve({ success: true }); } } } });
    vm.runInContext('(' + injected.func.toString() + ')(...args)', context);
    dom.window.document.querySelector('a').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    dom.window.document.querySelector('[role="alertdialog"]').shadowRoot.querySelector('button').click();
    resolveCheck({ status: 'CLEAN' }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(dom.window.document.querySelector('[role="alertdialog"]'), null); assert.equal(sent.length, 2); assert.equal(sent[1].action, 'cancelLinkInteraction');
});


test('a cancelled check finishing late cannot unlock a second active dialog', async () => {
    const state = setup(); await state.context.configure(); await state.context.injectTimeOfClickProtection(1, [], 7);
    const injected = state.injections.at(-1), dom = new JSDOM('<a href="https://example.com/">Web</a>');
    const pending = [];
    const context = vm.createContext({ document: dom.window.document, URL, args: injected.args, browser: { runtime: { sendMessage: value => value.action === 'checkLinkState' ? new Promise(resolve => pending.push(resolve)) : Promise.resolve({ success: true }) } } });
    vm.runInContext('(' + injected.func.toString() + ')(...args)', context);
    const click = () => dom.window.document.querySelector('a').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    click(); dom.window.document.querySelector('[role="alertdialog"]').shadowRoot.querySelector('button').click(); click();
    pending[0]({ status: 'CLEAN' }); await new Promise(resolve => setImmediate(resolve)); click();
    assert.equal(pending.length, 2); assert.equal(dom.window.document.querySelectorAll('[role="alertdialog"]').length, 1);
    pending[1]({ status: 'UNKNOWN' }); await new Promise(resolve => setImmediate(resolve));
    dom.window.document.querySelector('[role="alertdialog"]').shadowRoot.querySelector('button').click();
});


const auditRequest = (interactionId = 'event_1') => ({ interactionId, messageId: 7, url: 'https://example.com/private?token=abc', userAction: true });
const auditSender = { id: 'test', tab: { id: 1 } };

test('audited link decisions persist URL, local score and provider verdict independently without network', async () => {
    const state = setup(); await state.context.configure();
    const request = auditRequest(); const result = await state.context.handleAuditedLinkCheck(request, auditSender);
    assert.equal(result.auditSaved, true); assert.equal(typeof result.score, 'number'); assert.equal(result.status, 'UNKNOWN');
    const opened = await state.context.handleOpenAuditedLink(request, auditSender);
    assert.equal(opened.success, true);
    const data = await state.context.readLinkAudit(); assert.equal(data.records.length, 1);
    const record = data.records[0]; assert.equal(record.outcome, 'OPENED'); assert.equal(record.url, request.url);
    assert.equal(record.score, result.score); assert.equal(record.scoreSource, 'local-message-and-link');
    assert.equal(record.verdictAtDecision, 'UNKNOWN'); assert.ok(record.decidedAt >= record.clickedAt);
    assert.equal(state.requests.length, 0); assert.ok(data.profileId);
    assert.equal((await state.context.handleOpenAuditedLink(request, auditSender)).success, false);
});

test('cancellation during pending checks keeps the decision snapshot when a later malicious verdict arrives', async () => {
    const state = setup(); await state.context.configure();
    let resolveFull, verdict;
    state.context.browser.messages.getFull = () => new Promise(resolve => { resolveFull = resolve; });
    state.context.handleCheckLinkState = (_request, _sender, resolve) => { verdict = resolve; };
    const request = auditRequest('pending_cancel'), check = state.context.handleAuditedLinkCheck(request, auditSender);
    await new Promise(resolve => setImmediate(resolve));
    const cancel = await state.context.handleCancelAuditedLink({ ...request, reason: 'escape' }, auditSender);
    assert.equal(cancel.success, true);
    resolveFull(state.full); verdict({ status: 'MALICIOUS', provider: 'test-provider' }); await check;
    const record = (await state.context.readLinkAudit()).records[0];
    assert.equal(record.outcome, 'ABORTED'); assert.equal(record.cancelReason, 'escape');
    assert.equal(record.scoreAtDecision, null); assert.equal(record.verdictAtDecision, 'UNKNOWN');
    assert.equal(record.verdict, 'MALICIOUS'); assert.equal(typeof record.score, 'number');
    assert.equal((await state.context.handleOpenAuditedLink(request, auditSender)).success, false);
});

test('an opening failure is never logged as opened and retries update one interaction', async () => {
    const state = setup(); await state.context.configure(); const request = auditRequest();
    await state.context.handleAuditedLinkCheck(request, auditSender);
    state.context.browser.windows.openDefaultBrowser = async () => { throw new Error('offline'); };
    assert.equal((await state.context.handleOpenAuditedLink(request, auditSender)).success, false);
    assert.equal((await state.context.readLinkAudit()).records[0].outcome, 'OPEN_ERROR');
    state.context.browser.windows.openDefaultBrowser = async () => {};
    assert.equal((await state.context.handleOpenAuditedLink(request, auditSender)).success, true);
    const data = await state.context.readLinkAudit(); assert.equal(data.records.length, 1);
    assert.equal(data.records[0].outcome, 'OPENED'); assert.equal(data.records[0].openAttempts, 2);
});

test('interaction IDs cannot be reused to change URL, tab, message or a terminal decision', async () => {
    const state = setup(); await state.context.configure(); const request = auditRequest();
    await state.context.handleAuditedLinkCheck(request, auditSender);
    for (const altered of [{ ...request, url: 'https://changed.invalid/' }, { ...request, messageId: 8 }]) assert.equal((await state.context.handleOpenAuditedLink(altered, auditSender)).success, false);
    assert.equal((await state.context.handleOpenAuditedLink(request, { tab: { id: 2 } })).success, false);
    assert.equal((await state.context.handleAuditedLinkCheck(request, auditSender)).status, 'ERROR');
    await state.context.handleCancelAuditedLink(request, auditSender);
    assert.equal((await state.context.handleOpenAuditedLink(request, auditSender)).success, false);
});

test('concurrent audit writes do not lose entries; retention enforces age, count and bytes', async () => {
    const state = setup(); await state.context.configure();
    await Promise.all(Array.from({ length: 30 }, (_, i) => state.context.editLinkAudit(records => records.unshift({ id: String(i), clickedAt: Date.now(), url: 'https://example.com/' }))));
    assert.equal((await state.context.readLinkAudit()).records.length, 30);
    const now = Date.now(), records = Array.from({ length: 2100 }, (_, i) => ({ id: i, clickedAt: now - i, url: 'x'.repeat(3000) }));
    records.push({ id: 'expired', clickedAt: now - 31 * 86400000 });
    const pruned = state.context.pruneLinkAudit(records, now);
    assert.ok(pruned.length <= 2000); assert.ok(!pruned.some(record => record.id === 'expired'));
    assert.ok(new TextEncoder().encode(JSON.stringify(pruned)).length <= 2 * 1024 * 1024);
    assert.equal(pruned[0].id, 0);
});

test('audit access is limited to the extension review page and log deletion keeps settings', async () => {
    const state = setup({ apikey: 'secret' }); await state.context.configure();
    assert.equal(state.context.isLinkAuditAdminPage({ url: 'audit.html' }), true);
    for (const url of ['https://mail.invalid/audit.html', 'popup.html', 'audit.html?spoof=true']) assert.equal(state.context.isLinkAuditAdminPage({ url }), false);
    await state.context.handleAuditedLinkCheck(auditRequest(), auditSender);
    await state.context.editLinkAudit(records => { records.length = 0; });
    assert.equal((await state.context.readLinkAudit()).records.length, 0); assert.equal(state.config.apikey, 'secret');
});

test('a failed audit write is visible without falsely confirming that the decision was logged', async () => {
    const state = setup(); await state.context.configure();
    state.context.browser.storage.local.set = async () => { throw new Error('quota'); };
    const request = auditRequest(), result = await state.context.handleAuditedLinkCheck(request, auditSender);
    assert.equal(result.auditSaved, false); assert.equal(result.status, 'UNKNOWN');
    const opened = await state.context.handleOpenAuditedLink(request, auditSender);
    assert.equal(opened.success, true); assert.equal(opened.auditSaved, false);
});


test('injected dialogs and background auditing record both decisions with one event per click', async () => {
    const state = setup({ customBlacklist: ['example.com'] }); await state.context.configure();
    await state.context.injectTimeOfClickProtection(1, [], 7);
    const injected = state.injections.at(-1), dom = new JSDOM('<a href="https://example.com/">Web</a>');
    const route = value => new Promise(resolve => state.listeners[0](value, auditSender, resolve));
    const context = vm.createContext({ document: dom.window.document, URL, args: injected.args, browser: { runtime: { sendMessage: route } } });
    vm.runInContext('(' + injected.func.toString() + ')(...args)', context);
    const click = () => dom.window.document.querySelector('a').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    click(); await new Promise(resolve => setImmediate(resolve));
    const panel = dom.window.document.querySelector('[role="alertdialog"]');
    assert.ok(panel.shadowRoot.textContent.includes('100 / 100'));
    panel.shadowRoot.querySelector('.primary').click(); await new Promise(resolve => setImmediate(resolve));
    click(); await new Promise(resolve => setImmediate(resolve));
    dom.window.document.querySelector('[role="alertdialog"]').shadowRoot.querySelector('button').click();
    await new Promise(resolve => setImmediate(resolve));
    const data = await state.context.readLinkAudit(); assert.equal(data.records.length, 2);
    assert.equal(data.records.filter(record => record.outcome === 'OPENED').length, 1);
    assert.equal(data.records.filter(record => record.outcome === 'ABORTED').length, 1);
    assert.ok(data.records.every(record => record.score === 100)); assert.equal(state.requests.length, 0);
});
