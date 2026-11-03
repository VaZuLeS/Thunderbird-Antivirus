const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const runtime = fs.readFileSync('runtime.js', 'utf8');
const gateway = fs.readFileSync('api_gateway.js', 'utf8');
function setup(settings = {}, trackSources = false) {
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
    vm.runInContext(fs.readFileSync('i18n.js', 'utf8') + '\n' + runtime + '\n' + gateway + '\n' + fs.readFileSync('risk.js', 'utf8') + '\n' + fs.readFileSync('sanitize.js', 'utf8') + '\n' + [...(trackSources ? ['analysis_status.js'] : []), 'scan_policy.js', 'providers.js', 'message_ui.js', 'vendor/tldts.js', 'link_audit.js', 'background.js'].map(file => fs.readFileSync(file, 'utf8')).join('\n') + '\n globalThis.configure = async () => { await loadSettings(); }; globalThis.forceTier = value => { privacyTier = value; };', context);
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
    state.full.headers['authentication-results'] = ['attacker.invalid; spf=pass; dkim=pass; dmarc=pass'];
    const options = await state.context.collectThreatEvaluationOptions({ message: state.message, fullMessage: state.full, filteredUrls: [], messageText: '', allowExternal: false });
    const result = state.context.calculateThreatScore(state.message.author, [], options);
    assert.equal(result.authStatus, 'neutral');
    state.config.trustedAuthServers = ['recipient.example.com'];
    state.full.headers['authentication-results'] = ['recipient.example.com; spf=pass; dkim=pass; dmarc=pass'];
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
    resolveFull(state.full); verdict({ status: 'MALICIOUS', provider: 'test-provider', reasons: ['late provider reason'], check: {origin:'live',outcome:'success',observedAt:Date.now()} }); await check;
    const record = (await state.context.readLinkAudit()).records[0];
    assert.equal(record.outcome, 'ABORTED'); assert.equal(record.cancelReason, 'escape');
    assert.equal(record.scoreAtDecision, null); assert.equal(record.verdictAtDecision, 'UNKNOWN');
    assert.equal(record.verdict, 'MALICIOUS'); assert.equal(typeof record.score, 'number');
    assert.equal(record.reasonsAtDecision, null); assert.equal(record.providerReasonsAtDecision, null); assert.equal(record.checkAtDecision, null);
    assert.deepEqual(Array.from(record.providerReasons), ['late provider reason']);
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

test('concurrent open/cancel actions issue only one native request and one terminal snapshot', async () => {
    const state = setup(); await state.context.configure(); const request = auditRequest('concurrent_open');
    await state.context.handleAuditedLinkCheck(request, auditSender);
    let complete, calls = 0;
    state.context.browser.windows.openDefaultBrowser = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
    const first = state.context.handleOpenAuditedLink(request, auditSender);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal((await state.context.handleOpenAuditedLink(request, auditSender)).success, false);
    assert.equal((await state.context.handleCancelAuditedLink(request, auditSender)).success, false);
    complete(); assert.equal((await first).success, true);
    assert.equal(calls, 1);
    const record = (await state.context.readLinkAudit()).records[0];
    assert.equal(record.outcome, 'OPENED'); assert.equal(record.openAttempts, 1);
});

test('an accepted native request followed by a failed audit commit stays uncertain on restart', async () => {
    const state = setup(); await state.context.configure(); const request = auditRequest('commit_gap');
    await state.context.handleAuditedLinkCheck(request, auditSender);
    // Emulate the storage API's structured clone boundary, not shared object mutation.
    const baseline = JSON.parse(JSON.stringify(state.config));
    state.context.browser.storage.local.get = async () => JSON.parse(JSON.stringify(baseline));
    state.context.browser.storage.local.set = async () => { throw new Error('quota after native acceptance'); };
    const result = await state.context.handleOpenAuditedLink(request, auditSender);
    assert.equal(result.success, true); assert.equal(result.auditSaved, false);
    const recovered = setup(baseline); await recovered.context.configure();
    let requests = 0; recovered.context.browser.windows.openDefaultBrowser = async () => { requests++; };
    const record = (await recovered.context.readLinkAudit()).records[0];
    assert.equal(record.outcome, 'PENDING'); assert.equal(record.decidedAt, null);
    assert.equal(record.openAttempts, 0); assert.equal(requests, 0);
    assert.equal((await recovered.context.handleOpenAuditedLink(request, auditSender)).success, false);
});

test('the actual displayed message is rechecked immediately before native opening', async () => {
    const state = setup(); await state.context.configure(); const request = auditRequest('message_switch');
    await state.context.handleAuditedLinkCheck(request, auditSender);
    let calls = 0; state.context.browser.windows.openDefaultBrowser = async () => { calls++; };
    state.context.browser.messageDisplay.getDisplayedMessages = async () => ({ messages: [{ id: 99 }] });
    assert.equal((await state.context.handleOpenAuditedLink(request, auditSender)).success, false);
    assert.equal(calls, 0);
    assert.equal((await state.context.readLinkAudit()).records[0].outcome, 'OPEN_ERROR');
});

test('structured link checks retain stored warning and observation time on failure without claiming freshness', async () => {
 const s=setup({externalAnalysisConsent:true,apikey:'dummy'});await s.context.configure();
 s.context.fetch=async()=>{throw new Error('offline')};
 const result=await s.context.checkHybridAnalysisResult('hash','MALICIOUS',{observedAt:123});
 assert.equal(result.status,'MALICIOUS');assert.equal(result.check.origin,'stored');assert.equal(result.check.observedAt,123);assert.equal(result.check.outcome,'failed');assert.ok(result.check.attemptedAt>123);
 s.config.externalAnalysisConsent=false;await s.context.configure();
 assert.equal((await s.context.checkHybridAnalysisResult('hash','CLEAN')).check.outcome,'disabled');
 s.config.externalAnalysisConsent=true;await s.context.configure();s.context.browser.permissions.contains=async()=>false;
 assert.equal((await s.context.checkHybridAnalysisResult('hash','CLEAN')).check.outcome,'permission_denied');
 assert.equal((await s.context.checkHybridAnalysisResult('hash','CLEAN',{requested:false})).check.attemptedAt,null);
});
test('coverage accounts for 101 attachments and 21 batch links without raising limits', async()=>{
 const s=setup({externalAnalysisConsent:true,privacyTier:'max',apikey:'dummy'});await s.context.configure();const saved={};
 s.context.persistScanCoverage=async(_m,kind,coverage)=>{saved[kind]=coverage};s.context.indexedDB_save_batch_hybrid_data_to_db=async()=>{};
 s.context.process_single_attachment=async(_m,a)=>a.name==='failed'?null:{hybrid_data:{state:a.size>25*1024*1024?'SIZE_LIMIT':'MANUAL_CHECK_PENDING'}};
 const atts=Array.from({length:101},(_,i)=>({name:i===1?'failed':String(i),size:i===2?26*1024*1024:10}));
 await s.context.sent_to_hybrid_by_attachment(s.message,atts,false,false);
 assert.equal(saved.attachments.detected,101);assert.equal(saved.attachments.eligible,100);assert.equal(saved.attachments.processed,98);assert.equal(saved.attachments.failed,1);assert.equal(saved.attachments.skipped,2);
 s.full.parts=[{contentType:'text/plain',body:Array.from({length:21},(_,i)=>'https://example'+i+'.invalid/').join(' ')}];let count=0;s.context.handleUrlScan=async()=>{count++;if(count===1)throw new Error('failed')};
 await s.context.scanLinksOfDisplayedMessage(1);assert.equal(count,20);assert.equal(saved.batchLinks.processed,19);assert.equal(saved.batchLinks.failed,1);assert.equal(saved.batchLinks.skipped,1);
});
test('domain coverage counts unique domains, failures and the 100-domain limit',async()=>{
 const s=setup({externalAnalysisConsent:true,urlhausApikey:'dummy'});await s.context.configure();s.context.checkURLhaus=async domain=>domain==='d0.invalid'?null:false;
 const coverage={};await s.context.checkURLhausDomains([...Array.from({length:101},(_,i)=>'https://d'+i+'.invalid/'),'https://d1.invalid/again'],null,coverage);
 assert.equal(coverage.detected,101);assert.equal(coverage.processed,99);assert.equal(coverage.failed,1);assert.equal(coverage.skipped,1);
});
test('message link contract rejects invalid schemes and malformed identities before work',async()=>{
 const s=setup();const sender={tab:{id:1}};
 assert.equal(s.context.validLinkRequest({messageId:7,url:'https://example.invalid',userAction:true,interactionId:'ok'},sender),true);
 for(const patch of [{url:'javascript:alert(1)'},{messageId:'7'},{interactionId:'bad space'},{userAction:'true'}])assert.equal(s.context.validLinkRequest({messageId:7,url:'https://example.invalid',userAction:true,...patch},sender),false);
});

test('message-bound sources expose successful clean external checks and cached results without extra transmissions',async()=>{
 const s=setup({externalAnalysisConsent:true,privacyTier:'strict',apikey:'key',virustotalApikey:'vt-key',urlhausApikey:'url-key',ipReputationProvider:'abuseipdb',ipReputationApiKey:'ip-key',scanningEnabledSenders:['alice@example.com']},true);
 const records=new Map();s.context.getFromStore=async(_db,_store,key)=>records.get(key)||null;s.context.updateStore=async(_db,_store,key,update)=>{const value=update(records.get(key)||null);if(value)records.set(key,value);return value};
 s.full.headers.received=['from sender.example ([8.8.8.8])'];const calls=[];
 s.context.fetch=async(url,options)=>{calls.push({url,options});assert.equal(options.analysisContext,undefined);return {status:200,ok:true,json:async()=>url.includes('virustotal.com')?{data:{attributes:{last_analysis_stats:{malicious:0,suspicious:0}}}}:url.includes('urlhaus')?{query_status:'no_results'}:url.includes('abuseipdb')?{data:{abuseConfidenceScore:0}}:{verdict:'no specific threat',submission_id:'submission',job_id:'job'}}};
 await s.context.configure();await s.context.handleDisplayedMessage({id:1},s.message);
 const context=await s.context.getMessageAnalysisContext(s.message);const data=await context.snapshot();assert.equal(data.local.state,'checked');
 for(const provider of ['hybridanalysis','virustotal','urlhaus','abuseipdb'])assert.ok(data.rows.some(row=>row.provider===provider&&row.state==='checked'&&row.source==='remote'),provider);
 const before=new Map(data.rows.map(row=>[row.provider+row.scope,row.observedAt]));
 await s.context.handleDisplayedMessage({id:1},s.message);const cached=await context.snapshot();
 for(const provider of ['virustotal','urlhaus','abuseipdb']){const row=cached.rows.find(row=>row.provider===provider);assert.equal(row.source,'cache');assert.equal(row.observedAt,before.get(row.provider+row.scope));assert.equal(calls.filter(call=>call.url.includes(provider==='urlhaus'?'urlhaus':provider==='abuseipdb'?'abuseipdb':'virustotal')).length,1)}
 const metadata=JSON.stringify(records.get(s.message.headerMessageId).analysisStatus);for(const secret of ['8.8.8.8','alice@example.com','https://example.com/','vt-key'])assert.ok(!metadata.includes(secret));
 assert.ok(s.injections.some(injection=>injection.func.toString().includes('thundy-analysis-status')));
});
test('disabled external analysis exposes local-only status and stored findings without performing requests',async()=>{
 const s=setup({},true);s.context.getFromStore=async()=>({attachments:[{state:'KNOWN',report:{verdict:'malicious'},report_fetched_at:'2026-10-01T08:00:00Z'}]});await s.context.configure();
 const c=await s.context.getMessageAnalysisContext(s.message);const snapshot=await c.snapshot();assert.equal(s.requests.length,0);assert.equal(snapshot.rows[0].source,'stored');assert.equal(snapshot.rows[0].verdict,'malicious');assert.equal(snapshot.availability.hybridanalysis,'unconfigured');
});
test('urlscan submission is visible before its later report and VirusTotal IP scope is distinct', {timeout:15000}, async()=>{
 const s=setup({externalAnalysisConsent:true,privacyTier:'max',urlscanApikey:'url-key',ipReputationProvider:'virustotal',ipReputationApiKey:'ip-key'},true);await s.context.configure();
 s.context.fetch=async(url)=>({status:200,ok:true,json:async()=>url.includes('/scan/')?{uuid:'scan-id'}:url.includes('/result/')?{verdicts:{overall:{malicious:true}}}:{data:{attributes:{last_analysis_stats:{malicious:2}}}}});
 const ctx=await s.context.getMessageAnalysisContext(s.message);const pending=s.context.checkUrlscanIo('https://example.net/','url-key',ctx);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ctx.model.data.rows.find(r=>r.provider==='urlscan').state,'submitted');await pending;assert.equal(ctx.model.data.rows.find(r=>r.provider==='urlscan').verdict,'malicious');
 await s.context.checkIPReputation(['from sender ([8.8.8.8])'],ctx);assert.ok(ctx.model.data.rows.some(r=>r.provider==='virustotal'&&r.scope==='ip'&&r.verdict==='malicious'));await ctx.flush();
});

test('concurrent messages, duplicate headers and stale display never redirect source events', async () => {
    const state = setup({}, true); await state.context.configure();
    const first = await state.context.getMessageAnalysisContext(state.message, 1);
    const second = await state.context.getMessageAnalysisContext({...state.message,id:8}, 2);
    assert.notEqual(first, second);
    first.event({provider:'urlhaus',scope:'domain',phase:'start'});
    second.event({provider:'urlscan',scope:'url',phase:'start'});
    first.event({provider:'urlhaus',scope:'domain',phase:'finish',state:'checked',verdict:'none',observedAt:100,responded:true});
    second.event({provider:'urlscan',scope:'url',phase:'finish',state:'submitted',verdict:'unknown',observedAt:200,responded:true});
    assert.equal((await first.snapshot()).rows[0].provider,'urlhaus');
    assert.equal((await second.snapshot()).rows[0].provider,'urlscan');
    assert.equal(await state.context.analysisByHeader(state.message.headerMessageId),null);
    await second.flush();
    assert.equal(state.injections.length,0, 'message 7 is displayed, so message 8 must not be injected');
    await first.flush();
    assert.equal(state.injections.length,1);
    assert.equal(state.injections[0].args[0].messageId,7);
    assert.equal(state.requests.length,0);
});

test('popup event bridge rejects other pages and unvalidated provider events', async () => {
    const state = setup({}, true);await state.context.configure();
    const listener=state.listeners.at(-1);
    const payload={action:'recordAnalysisEvent',messageId:7,event:{provider:'hybridanalysis',scope:'report',phase:'finish',state:'checked',verdict:'none',responded:true,observedAt:100}};
    const before=await state.context.getMessageAnalysisContext(state.message);
    await listener(payload,{url:'options.html'});
    await listener({...payload,event:{...payload.event,provider:'virustotal'}},{url:'popup.html'});
    assert.equal(before.model.data.rows.length,0);
    const accepted=await new Promise(resolve=>listener(payload,{url:'popup.html'},resolve));
    assert.equal(accepted.success,true);
    assert.equal(before.model.data.rows[0].provider,'hybridanalysis');
    await before.flush();
    assert.equal(state.requests.length,0);
});

test('clearing analysis caches disposes observers so late responses cannot restore deleted metadata', async () => {
    const state=setup({},true);await state.context.configure();
    const context=await state.context.getMessageAnalysisContext(state.message);
    context.event({provider:'urlhaus',scope:'domain',phase:'start'});
    state.listeners.at(-1)({action:'clearMemoryCaches'},{},()=>{});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(context.disposed,true);
    assert.equal(context.event({provider:'urlhaus',scope:'domain',phase:'finish',state:'checked',verdict:'none',responded:true,observedAt:100}),false);
    const fresh=await state.context.getMessageAnalysisContext(state.message);
    assert.equal(fresh.model.data.rows.length,0);
    assert.equal(state.requests.length,0);
});

function sourceRecords(state, initial = null) {
    const records = new Map(initial ? [[state.message.headerMessageId,initial]] : []);
    state.context.getFromStore=async(_db,_store,key)=>records.get(key)||null;
    state.context.updateStore=async(_db,_store,key,update)=>{const value=update(records.get(key)||null);if(value)records.set(key,value);return value};
    return records;
}

test('two same-name attachments and two links retain distinct provider resources through cache and restart',async()=>{
 const s=setup({externalAnalysisConsent:true,privacyTier:'strict',virustotalApikey:'vt',urlhausApikey:'uh'},true);await s.context.configure();
 const records=sourceRecords(s);
 const attachments=[{name:'same.txt',partName:'1.2',size:4},{name:'same.txt',partName:'1.3',size:4}];
 s.context.browser.messages.listAttachments=async()=>attachments;
 const ctx=await s.context.getMessageAnalysisContext(s.message);
 await s.context.sent_to_hybrid_by_attachment(s.message,attachments,true,false,ctx);
 const urls=['https://example.com/a?token=one','https://example.com/b?token=two'];
 await s.context.processAndUploadUrls(s.message,urls,false,false,ctx);
 await s.context.checkURLhausDomains(urls,null,null,ctx);
 await ctx.flush();let snap=await ctx.snapshot();
 assert.equal(records.get(s.message.headerMessageId).attachments.length,2);
 for(const ref of ['attachment:1.2','attachment:1.3','link:0','link:1'])assert.ok(snap.rows.some(row=>row.resource===ref),ref);
 // Concurrent digest completion order is not guaranteed; exactly one request is shared.
 assert.deepEqual(new Set(snap.rows.filter(row=>row.provider==='virustotal').map(row=>row.source)),new Set(['remote','cache']));
 assert.equal(s.requests.filter(call=>call.url.includes('virustotal')).length,1);
 assert.equal(Object.keys(snap.resourceLabels).length,4);assert.notEqual(snap.resourceLabels['attachment:1.2'],snap.resourceLabels['attachment:1.3']);
 assert.ok(!snap.resourceLabels['link:0'].includes('token='));
 const metadata=JSON.stringify(records.get(s.message.headerMessageId).analysisStatus);
 for(const value of [...urls,'same.txt','token=one'])assert.ok(!metadata.includes(value));
 const requestCount=s.requests.length;await s.context.checkURLhausDomains(urls,null,null,ctx);await ctx.flush();assert.equal(s.requests.length,requestCount);
 const restarted=setup({},true);restarted.context.getFromStore=async()=>records.get(s.message.headerMessageId);await restarted.context.configure();
 const loaded=await restarted.context.getMessageAnalysisContext(restarted.message);snap=await loaded.snapshot();assert.equal(snap.rows.length,ctx.model.data.rows.length);assert.ok(snap.rows.every(row=>row.source==='stored'));assert.equal(restarted.requests.length,0);
});

test('link result updates preserve historical duplicate slots and all source references',async()=>{
 const s=setup({},true);const links=[{url:'https://a.invalid',state:'UNKNOWN'},{url:'https://a.invalid',state:'UNKNOWN'},{url:'https://b.invalid',state:'UNKNOWN'}];
 const records=sourceRecords(s,{links,analysisStatus:{schemaVersion:2,rows:[{provider:'urlhaus',scope:'domain',resource:'link:2',state:'checked',verdict:'malicious',responses:1,observedAt:100}]}});
 await s.context.indexedDB_save_links_objects_to_db(s.message,[{url:'https://a.invalid',state:'UPLOADED'},{url:'https://c.invalid',state:'UPLOADED'}]);
 const result=records.get(s.message.headerMessageId);assert.equal(result.links.length,4);assert.equal(result.links[2].url,'https://b.invalid');assert.equal(result.analysisStatus.rows[0].resource,'link:2');
});

test('clearing caches during a queued source write cannot resurrect the cleared record',async()=>{
 const s=setup({},true);await s.context.configure();const ctx=await s.context.getMessageAnalysisContext(s.message);
 let apply,entered;const started=new Promise(resolve=>entered=resolve);let saved=null;
 s.context.updateStore=async(_db,_store,_key,update)=>{entered();await new Promise(resolve=>apply=resolve);saved=update(null)};
 const pending=ctx.flush();await started;s.listeners.at(-1)({action:'clearMemoryCaches'},{},()=>{});await new Promise(resolve=>setImmediate(resolve));apply();await pending;
 assert.equal(saved,null);assert.equal(s.injections.length,0);
});

test('manual URL submission creates a stable reference for a previously unrecorded link',async()=>{
 const s=setup({externalAnalysisConsent:true,privacyTier:'max',apikey:'ha'},true);await s.context.configure();const records=sourceRecords(s);const ctx=await s.context.getMessageAnalysisContext(s.message);
 s.context.fetch=async()=>({status:201,ok:true,json:async()=>({submission_id:'submission',job_id:'job',sha256:'hash'})});
 await s.context.handleUrlScan('https://new.invalid/path',s.message.headerMessageId,ctx);await ctx.flush();
 const record=records.get(s.message.headerMessageId);assert.equal(record.links[0].url,'https://new.invalid/path');assert.equal(ctx.model.data.rows[0].resource,'link:0');assert.equal(ctx.model.data.rows[0].state,'submitted');
});

test('persisted source observations are isolated between different messages sharing a header and survive reopening both',async()=>{
 const s=setup({},true);await s.context.configure();const records=sourceRecords(s);
 const first=await s.context.getMessageAnalysisContext(s.message);
 first.event({provider:'urlhaus',scope:'domain',resource:'link:0',phase:'cache',state:'checked',verdict:'malicious',observedAt:100});await first.flush();
 const otherMessage={...s.message,id:8};const second=await s.context.getMessageAnalysisContext(otherMessage);
 assert.equal((await second.snapshot()).rows.length,0);
 second.event({provider:'urlscan',scope:'url',resource:'link:1',phase:'start'});await second.flush();
 assert.equal((await first.snapshot()).rows.length,1);assert.equal((await first.snapshot()).rows[0].provider,'urlhaus');
 const restart=setup({},true);restart.context.getFromStore=async()=>records.get(s.message.headerMessageId);await restart.context.configure();
 const loadedFirst=await restart.context.getMessageAnalysisContext(restart.message),loadedSecond=await restart.context.getMessageAnalysisContext(otherMessage);
 assert.equal(loadedFirst.model.data.rows.length,1);assert.equal(loadedFirst.model.data.rows[0].verdict,'malicious');assert.equal(loadedSecond.model.data.rows.length,1);assert.equal(loadedSecond.model.data.rows[0].provider,'urlscan');assert.equal(loadedSecond.model.data.rows[0].state,'incomplete');
});

test('resource labels and popup records use the actual message inventory across duplicate headers and status writes',async()=>{
 const s=setup({},true);await s.context.configure();
 const records=sourceRecords(s,{analysisStatusOwner:7,analysisStatusByMessage:{7:{schemaVersion:2,rows:[]}},attachments:[{partName:'1.2',attachment_name:'message-A.txt',report:{verdict:'malicious'}}],links:[{url:'https://a.invalid/private',report:{verdict:'malicious'}}]});
 s.context.browser.messages.listAttachments=async id=>[{partName:'1.2',name:id===7?'message-A.txt':'message-B.txt'}];
 s.context.browser.messages.getFull=async id=>({parts:[{contentType:'text/plain',body:id===7?'https://a.invalid/private':'https://b.invalid/private'}]});
 const first=await s.context.getMessageAnalysisContext(s.message),second=await s.context.getMessageAnalysisContext({...s.message,id:8});
 for(const flush of [false,true]){
  if(flush)await second.flush();
  const snapshot=await second.snapshot();assert.ok(!JSON.stringify(snapshot.resourceLabels).includes('message-A'));assert.ok(!JSON.stringify(snapshot.resourceLabels).includes('a.invalid'));
  assert.ok(snapshot.resourceLabels['attachment:1.2'].includes('message-B'));
  const record=await second.resourceRecord();assert.equal(record.attachments.length,0);assert.equal(record.links.length,0);
 }
 const firstSnap=await first.snapshot();assert.ok(firstSnap.resourceLabels['attachment:1.2'].includes('message-A'));
 const stored=records.get(s.message.headerMessageId);assert.equal(stored.attachments[0].attachment_name,'message-A.txt');assert.equal(stored.links[0].url,'https://a.invalid/private');
 assert.equal(s.requests.length,0);
});

test('filtered legacy links keep original slot references and never acquire another link label',async()=>{
 const s=setup({},true);await s.context.configure();sourceRecords(s,{links:[{url:'https://other.invalid/private',report:{verdict:'malicious'}},{url:'https://example.com/',report:{verdict:'no specific threat'}}]});
 const ctx=await s.context.getMessageAnalysisContext(s.message);const snapshot=await ctx.snapshot();
 assert.equal(snapshot.rows.length,1);assert.equal(snapshot.rows[0].resource,'link:1');assert.ok(!snapshot.resourceLabels['link:0']);assert.equal(snapshot.resourceLabels['link:1'],'https://example.com/');
 const record=await ctx.resourceRecord();assert.equal(record.links[0].analysisResourceRef,'link:1');assert.equal(s.requests.length,0);
});

test('message contexts evict above the limit, stop pending timers and refuse late responses without deleting stored data',async()=>{
 const s=setup({},true);await s.context.configure();const records=sourceRecords(s);
 const first=await s.context.getMessageAnalysisContext(s.message,1);first.event({provider:'urlhaus',scope:'domain',phase:'start'});await first.flush();
 first.event({provider:'urlscan',scope:'url',phase:'start'});assert.ok(first.timer);
 for(let i=0;i<200;i++)await s.context.getMessageAnalysisContext({...s.message,id:100+i,headerMessageId:'bounded-'+i});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(first.disposed,true);assert.equal(first.timer,null);assert.equal(first.tabs.size,0);
 assert.equal(first.event({provider:'urlhaus',scope:'domain',phase:'finish',state:'checked',verdict:'none',responded:true,observedAt:100}),false);
 assert.ok(records.has(s.message.headerMessageId));const reopened=await s.context.getMessageAnalysisContext(s.message);
 assert.equal(reopened.model.data.rows[0].state,'incomplete');await reopened.flush();assert.equal(s.requests.length,0);
});

test('unbound legacy findings remain summaries and never leak a cached filename through the popup record',async()=>{
 const s=setup({},true);await s.context.configure();sourceRecords(s,{attachments:[{attachment_name:'foreign-legacy.txt',report:{verdict:'malicious'}}]});
 const ctx=await s.context.getMessageAnalysisContext(s.message);
 const snapshot=await ctx.snapshot();assert.equal(snapshot.rows[0].resource,null);assert.equal(snapshot.rows[0].verdict,'malicious');
 assert.equal((await ctx.resourceRecord()).attachments.length,0);assert.ok(!JSON.stringify(snapshot.resourceLabels).includes('foreign-legacy'));
});

test('header-only manual submission never attributes an evicted popup request to a remaining sibling context',async()=>{
 const s=setup({externalAnalysisConsent:true,privacyTier:'max',apikey:'ha'},true);await s.context.configure();sourceRecords(s);
 let calls=0;s.context.fetch=async()=>{calls++;return {status:201,ok:true,json:async()=>({submission_id:'job',sha256:'hash'})}};
 const sibling=await s.context.getMessageAnalysisContext(s.message);
 await s.context.handleUrlScan('https://other.invalid/',s.message.headerMessageId);
 assert.equal(sibling.model.data.rows.length,0);assert.equal(calls,1);
});

test('manual popup URL submission recreates its explicit message context rather than guessing by shared header',async()=>{
 const s=setup({externalAnalysisConsent:true,privacyTier:'max',apikey:'ha'},true);await s.context.configure();sourceRecords(s);
 const sibling=await s.context.getMessageAnalysisContext(s.message);
 const other={...s.message,id:8};s.context.browser.messages.get=async id=>id===8?other:s.message;
 s.context.fetch=async()=>({status:201,ok:true,json:async()=>({submission_id:'job',sha256:'hash'})});
 const response=await new Promise(resolve=>s.listeners.at(-1)({action:'scanUrl',url:'https://other.invalid/',headerMessageId:other.headerMessageId,messageId:8},{url:'popup.html'},resolve));
 assert.equal(response.status,'success');assert.equal(sibling.model.data.rows.length,0);
 const target=await s.context.getMessageAnalysisContext(other);assert.equal(target.model.data.rows[0].state,'submitted');await target.flush();
});

test('manual URL submission refuses a mismatched explicit message before contacting a provider',async()=>{
 const s=setup({externalAnalysisConsent:true,privacyTier:'max',apikey:'ha'},true);await s.context.configure();let calls=0;s.context.fetch=async()=>{calls++;throw Error('unexpected')};
 const response=await new Promise(resolve=>s.listeners.at(-1)({action:'scanUrl',url:'https://other.invalid/',headerMessageId:'different-header',messageId:7},{url:'popup.html'},resolve));
 assert.equal(response.status,'error');assert.equal(response.code,'MESSAGE_CONTEXT_CHANGED');assert.equal(calls,0);
});
