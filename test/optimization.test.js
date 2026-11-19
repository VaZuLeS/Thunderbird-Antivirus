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
        DOMParser: new JSDOM().window.DOMParser, crypto: globalThis.crypto, AbortController, setTimeout, clearTimeout, TextEncoder, TextDecoder,
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
    vm.runInContext(fs.readFileSync('i18n.js', 'utf8') + '\n' + runtime + '\n' + gateway + '\n' + fs.readFileSync('risk.js', 'utf8') + '\n' + fs.readFileSync('sanitize.js', 'utf8') + '\n' + [...(trackSources ? ['provider_results.js','analysis_status.js'] : ['provider_results.js']), 'scan_policy.js', 'providers.js', 'message_ui.js', 'vendor/tldts.js', 'link_audit.js', 'background.js'].map(file => fs.readFileSync(file, 'utf8')).join('\n') + '\n globalThis.configure = async () => { await loadSettings(); }; globalThis.forceTier = value => { privacyTier = value; };', context);
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

test('source export context changes after cache loss and does not initiate external requests', async () => {
    const state = setup({}, true);await state.context.configure();
    const read = () => new Promise(resolve => state.listeners[0]({action:'getMessageAnalysis',messageId:7},{id:'test',url:'source_export.html'},resolve));
    const first = await read(),same = await read();
    assert.equal(first.success,true);assert.equal(first.contextToken,same.contextToken);assert.equal(typeof first.contextToken,'string');
    vm.runInContext('messageAnalyses.clear()',state.context);
    const changed = await read();assert.notEqual(changed.contextToken,first.contextToken);assert.equal(changed.messageId,7);assert.equal(state.requests.length,0);
});

test('authorized senders respect manual mode and full URL tier', async () => {
    for (const manual of [false, true]) for (const tier of ['strict', 'balanced', 'max']) {
        const state = setup({ externalAnalysisConsent: true, alwaysManual: manual, privacyTier: tier, apikey: 'dummy', autoScanLinks: true, scanningEnabledSenders: ['alice@example.com'] });
        await state.context.configure();
        await state.context.handleDisplayedMessage({ id: 1 }, state.message);
        assert.equal(state.requests.some(x => x.url.endsWith('/quick-scan/url-for-analysis')), !manual && tier === 'max');
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
        assert.equal(dom.window.document.querySelector('[role="alertdialog"]').shadowRoot.querySelectorAll('button').length, 3);
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
    const unreadable=[{key:'bad-list',value:{attachments:{old:true}}},{key:'bad-item',value:{links:[null]}}],original=JSON.stringify(unreadable);
    const records = [...unreadable,{ key: 'expired', value: { updatedAt: now - 31 * 86400000 } }, ...Array.from({ length: 1001 }, (_, i) => ({ key: 'recent-' + i, value: { updatedAt: now - i } }))];
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
    assert.equal(JSON.stringify(unreadable),original);
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
        sent.push(payload); return payload.action === 'checkLinkState' ? typeof status==='string'?{ status, reasons: ['Provider result'] }:status : open(payload);
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
    assert.equal(record.score, result.score); assert.equal(record.scoreSource, 'decision-message-and-link');
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
    click();
    for(let attempt=0;attempt<200&&!dom.window.document.querySelector('[role=alertdialog]')?.shadowRoot.querySelector('.primary');attempt++)await new Promise(resolve=>setTimeout(resolve,5));
    const panel = dom.window.document.querySelector('[role="alertdialog"]');
    assert.ok(panel.shadowRoot.textContent.includes('100 / 100'), panel.shadowRoot.textContent);
    panel.shadowRoot.querySelector('.primary').click();
    for(let attempt=0;attempt<200&&panel.isConnected;attempt++)await new Promise(resolve=>setTimeout(resolve,5));
    click();
    for(let attempt=0;attempt<200&&!dom.window.document.querySelector('[role=alertdialog]')?.shadowRoot.querySelector('.primary');attempt++)await new Promise(resolve=>setTimeout(resolve,5));
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
 s.context.fetch=async(url,options)=>{calls.push({url,options});assert.equal(options.analysisContext,undefined);let host='';try{host=new URL(url).hostname}catch{}const isVirustotalHost=host==='virustotal.com'||host.endsWith('.virustotal.com');const isUrlhausHost=host==='urlhaus-api.abuse.ch'||host==='urlhaus.abuse.ch'||host.endsWith('.urlhaus.abuse.ch');const isAbuseipdbHost=host==='abuseipdb.com'||host.endsWith('.abuseipdb.com');return {status:200,ok:true,json:async()=>isVirustotalHost?{data:{attributes:{last_analysis_stats:{malicious:0,suspicious:0}}}}:isUrlhausHost?{query_status:'no_results'}:isAbuseipdbHost?{data:{abuseConfidenceScore:0}}:{verdict:'no specific threat',submission_id:'submission',job_id:'job'}}};
 await s.context.configure();await s.context.handleDisplayedMessage({id:1},s.message);
 const context=await s.context.getMessageAnalysisContext(s.message);const data=await context.snapshot();assert.equal(data.local.state,'checked');
 for(const provider of ['hybridanalysis','virustotal','urlhaus','abuseipdb'])assert.ok(data.rows.some(row=>row.provider===provider&&row.state==='checked'&&row.source==='remote'),provider);
 const before=new Map(data.rows.map(row=>[row.provider+row.scope,row.observedAt]));
 await s.context.handleDisplayedMessage({id:1},s.message);const cached=await context.snapshot();
 for(const provider of ['virustotal','urlhaus','abuseipdb']){const row=cached.rows.find(row=>row.provider===provider);assert.equal(row.source,'cache');assert.equal(row.observedAt,before.get(row.provider+row.scope));assert.equal(calls.filter(call=>call.url.includes(provider==='urlhaus'?'urlhaus':provider==='abuseipdb'?'abuseipdb':'virustotal')).length,1)}
 const metadata=JSON.stringify(records.get(s.message.headerMessageId).analysisSourceSnapshots[context.snapshotId].snapshot);for(const secret of ['8.8.8.8','alice@example.com','https://example.com/','vt-key'])assert.ok(!metadata.includes(secret));
 assert.ok(s.injections.some(injection=>injection.func.toString().includes('thundy-analysis-status')));
});
test('disabled external analysis exposes local-only status and stored findings without performing requests',async()=>{
 const s=setup({},true);s.context.getFromStore=async()=>({attachments:[{state:'KNOWN',report:{verdict:'malicious'},report_fetched_at:'2026-10-01T08:00:00Z'}]});await s.context.configure();
 const c=await s.context.getMessageAnalysisContext(s.message);const snapshot=await c.snapshot();assert.equal(s.requests.length,0);assert.equal(snapshot.rows.length,0);assert.equal(snapshot.sourceHistory.rows[0].source,'stored');assert.equal(snapshot.sourceHistory.rows[0].verdict,'malicious');assert.equal(snapshot.availability.hybridanalysis,'unconfigured');
});
test('urlscan submission is visible before its later report and VirusTotal IP scope is distinct', {timeout:15000}, async()=>{
 const s=setup({externalAnalysisConsent:true,privacyTier:'max',urlscanApikey:'url-key',ipReputationProvider:'virustotal',ipReputationApiKey:'ip-key'},true);await s.context.configure();
 s.context.fetch=async(url)=>({status:200,ok:true,json:async()=>url.includes('/scan/')?{uuid:'scan-id'}:url.includes('/result/')?{verdicts:{overall:{malicious:true}}}:{data:{attributes:{last_analysis_stats:{malicious:2}}}}});
 const nativeTimer=s.context.setTimeout;let releasePoll;s.context.setTimeout=(fn,ms)=>ms===30000?(releasePoll=fn,0):nativeTimer(fn,ms);
 const ctx=await s.context.getMessageAnalysisContext(s.message);const pending=s.context.checkUrlscanIo('https://example.net/','url-key',ctx);await new Promise(resolve=>setImmediate(resolve));
 assert.ok(releasePoll,'fresh scan waits before fetching its result');
 assert.equal(ctx.model.data.rows.find(r=>r.provider==='urlscan').state,'submitted');releasePoll();s.context.setTimeout=nativeTimer;await pending;assert.equal(ctx.model.data.rows.find(r=>r.provider==='urlscan').verdict,'malicious');
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

test('an existing source context exposes a later stored Hybrid URL result without another request',async()=>{
 const s=setup({},true);await s.context.configure();const records=sourceRecords(s,{messageHeader:s.message.headerMessageId,links:[{url:'https://example.com/',state:'UPLOADED',report:{id:'synthetic-quickscan',finished:false}}]});
 const ctx=await s.context.getMessageAnalysisContext(s.message);
 try{
  assert.ok((await ctx.snapshot()).rows.some(row=>row.provider==='hybridanalysis'&&row.completion==='pending'));
  records.set(s.message.headerMessageId,{messageHeader:s.message.headerMessageId,links:[{url:'https://example.com/',state:'KNOWN',report:{state:'COMPLETE',verdict:'malicious',threat_score:85},report_fetched_at:'2026-11-10T10:00:00Z'}]});
  const before=JSON.stringify(records.get(s.message.headerMessageId)),snapshot=await ctx.snapshot();
  assert.ok(snapshot.rows.some(row=>row.provider==='hybridanalysis'&&row.resource==='link:0'&&row.verdict==='malicious'),'saved matching URL report must be visible in the existing context');
  const findings=await s.context.collectLinkFindings(s.message,s.full);assert.equal(findings.length,1);assert.equal(findings[0].verdict,'malicious');assert.equal(findings[0].provider,'Hybrid Analysis');
  assert.equal(JSON.stringify(records.get(s.message.headerMessageId)),before);assert.equal(s.requests.length,0);
 }finally{ctx.dispose();}
});

test('a saved Hybrid URL verdict remains visible beside its unfinished raw report',async()=>{
 const s=setup({},true);await s.context.configure();const records=sourceRecords(s,{messageHeader:s.message.headerMessageId,links:[{url:'https://example.com/',state:'UPLOADED',report:{id:'synthetic-quickscan',finished:false}}]});
 const ctx=await s.context.getMessageAnalysisContext(s.message);
 try{
  await ctx.snapshot();await s.context.persistHybridLinkVerdict(s.message,'https://example.com/',{status:'MALICIOUS',check:{origin:'live',outcome:'success',observedAt:12345}});
  await ctx.flush();
  const snapshot=await ctx.snapshot(),findings=await s.context.collectLinkFindings(s.message,s.full);
  const written=records.get(s.message.headerMessageId).analysisSourceSnapshots[ctx.snapshotId].snapshot;
  assert.ok(written.rows.some(row=>row.scope==='url'&&row.verdict==='malicious'),'the persisted source snapshot must include the saved URL verdict');
  assert.ok(written.rows.some(row=>row.scope==='report'&&row.completion==='pending'));
  assert.equal(findings[0].verdict,'malicious');
  assert.ok(snapshot.rows.some(row=>row.provider==='hybridanalysis'&&row.scope==='url'&&row.resource==='link:0'&&row.verdict==='malicious'&&row.observedAt===12345),'the actual saved URL verdict must not be hidden by a pending report');
  assert.ok(snapshot.rows.some(row=>row.provider==='hybridanalysis'&&row.scope==='report'&&row.completion==='pending'));
  assert.equal(records.get(s.message.headerMessageId).links[0].report.finished,false);assert.equal(s.requests.length,0);
 }finally{ctx.dispose();}
});

test('source RPC survives malformed stored lists and retains link slots and all provider history',async()=>{
 const s=setup({},true);await s.context.configure();
 const record={attachments:{bad:true},links:[null,{url:'https://example.com/',state:'KNOWN',report:{state:'COMPLETE',verdict:'malicious'}}],analysisStatus:{schemaVersion:2,rows:[null,...['hybridanalysis','virustotal','urlhaus','abuseipdb','urlscan'].map(provider=>({provider,scope:'report',state:'checked',verdict:'malicious',observedAt:10,responses:1}))]}};
 const records=sourceRecords(s,record),before=JSON.stringify(record),ctx=await s.context.getMessageAnalysisContext(s.message);
 try{
  const bound=await ctx.resourceRecord();assert.equal(bound.links.length,1);assert.equal(bound.links[0].analysisResourceRef,'link:1');
  const snapshot=await ctx.snapshot();assert.equal(snapshot.sourceDataIncomplete,true);assert.equal(snapshot.sourceHistory.sourceDataIncomplete,true);
  for(const provider of ['hybridanalysis','virustotal','urlhaus','abuseipdb','urlscan'])assert.ok(snapshot.sourceHistory.rows.some(row=>row.provider===provider&&row.verdict==='malicious'));
  assert.equal(JSON.stringify(records.get(s.message.headerMessageId)),before);assert.equal(s.requests.length,0);
 }finally{ctx.dispose();}
});

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
 const metadata=JSON.stringify(records.get(s.message.headerMessageId).analysisSourceSnapshots[ctx.snapshotId].snapshot);
 for(const value of [...urls,'same.txt','token=one'])assert.ok(!metadata.includes(value));
 const requestCount=s.requests.length;await s.context.checkURLhausDomains(urls,null,null,ctx);await ctx.flush();assert.equal(s.requests.length,requestCount);
 const restarted=setup({},true);restarted.context.getFromStore=async()=>records.get(s.message.headerMessageId);await restarted.context.configure();
 const loaded=await restarted.context.getMessageAnalysisContext(restarted.message);snap=await loaded.snapshot();assert.equal(snap.rows.length,0);assert.ok(snap.sourceHistory.rows.length>0);assert.ok(snap.sourceHistory.rows.every(row=>row.source==='stored' && row.resource===null));assert.equal(restarted.requests.length,0);
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
 assert.equal(loadedFirst.model.data.rows.length,0);assert.equal(loadedSecond.model.data.rows.length,0);const history=(await loadedFirst.snapshot()).sourceHistory.rows;assert.ok(history.some(row=>row.provider==='urlhaus'&&row.verdict==='malicious'));assert.ok(history.some(row=>row.provider==='urlscan'&&row.state==='incomplete'));assert.ok(history.every(row=>row.resource===null));
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
 assert.equal(reopened.model.data.rows.length,0);assert.equal((await reopened.snapshot()).sourceHistory.rows[0].state,'incomplete');await reopened.flush();assert.equal(s.requests.length,0);
});

test('unbound legacy findings remain summaries and never leak a cached filename through the popup record',async()=>{
 const s=setup({},true);await s.context.configure();sourceRecords(s,{attachments:[{attachment_name:'foreign-legacy.txt',report:{verdict:'malicious'}}]});
 const ctx=await s.context.getMessageAnalysisContext(s.message);
 const snapshot=await ctx.snapshot();assert.equal(snapshot.rows.length,0);assert.equal(snapshot.sourceHistory.rows[0].resource,null);assert.equal(snapshot.sourceHistory.rows[0].verdict,'malicious');
 assert.equal((await ctx.resourceRecord()).attachments.length,0);assert.ok(!JSON.stringify(snapshot.resourceLabels).includes('foreign-legacy'));
});
test('opaque S/MIME envelopes cannot imply checked text even when no decryption failure is reported',()=>{
 const s=setup({},true);
 for(const contentType of ['application/pkcs7-mime','application/x-pkcs7-mime']){
  const opaque={contentType,name:'smime.p7m',size:100};
  assert.equal(s.context.localContentCoverage({parts:[opaque]}).state,'incomplete');
  assert.equal(s.context.localContentCoverage({decryptionStatus:'success',parts:[opaque]}).state,'incomplete');
  assert.equal(s.context.localContentCoverage({parts:[{...opaque,parts:[{contentType:'text/plain',body:'readable',size:8}]}]}).state,'checked');
 }
 assert.equal(s.context.localContentCoverage({parts:[{contentType:'multipart/signed',parts:[{contentType:'text/plain',body:'signed text',size:11},{contentType:'application/pkcs7-signature',name:'smime.p7s'}]}]}).state,'checked');
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

test('unavailable decryption never inherits checked status and local risk reports partial input',async()=>{
 const s=setup({},true);await s.context.configure();
 const original={analysisStatus:{schemaVersion:2,local:{state:'checked',observedAt:123},rows:[]}};
 const before=JSON.stringify(original);s.context.getFromStore=async()=>original;
 s.full.decryptionStatus='fail';s.full.parts=[];
 const context=await s.context.getMessageAnalysisContext(s.message);
 assert.equal((await context.snapshot()).local.state,'incomplete');
 const result=await new Promise(resolve=>s.listeners.at(-1)({action:'getLocalRisk',messageId:7},{},resolve));
 assert.equal(result.status,'success');assert.equal(result.threat.coverage.state,'incomplete');
 assert.equal(result.threat.coverage.reason,'decryption_unavailable');
 assert.equal((await context.snapshot()).local.state,'incomplete');
 assert.equal(JSON.stringify(original),before);assert.equal(s.requests.length,0);context.dispose();
});

test('a read failure replaces current completion, avoids an initialization retry and can recover',async()=>{
 const s=setup({},true);await s.context.configure();let reads=0;
 s.context.browser.messages.getFull=async()=>{reads++;throw new Error('unreadable');};
 const request=()=>new Promise(resolve=>s.listeners.at(-1)({action:'getLocalRisk',messageId:7},{},resolve));
 assert.equal((await request()).status,'error');assert.equal(reads,1);
 const context=await s.context.getMessageAnalysisContext(s.message);
 assert.equal((await context.snapshot()).local.state,'failed');
 s.context.browser.messages.getFull=async()=>s.full;
 assert.equal((await request()).threat.coverage.state,'checked');
 assert.equal((await context.snapshot()).local.state,'checked');assert.equal(s.requests.length,0);context.dispose();
});

test('empty text stays valid while nonempty missing text and skipped decryption remain partial',async()=>{
 const s=setup({},true);await s.context.configure();
 for(const [full,expected] of [
  [{decryptionStatus:'none',parts:[{contentType:'text/plain',size:0}]},'checked'],
  [{decryptionStatus:'success',parts:[{contentType:'text/html',size:3,body:'abc'}]},'checked'],
  [{parts:[{contentType:'text/plain',size:8,name:'document.txt',headers:{'content-disposition':['attachment; filename=document.txt']}}]},'checked'],
  [{decryptionStatus:'none',parts:[{contentType:'text/plain',size:8}]},'incomplete'],
  [{decryptionStatus:'skipped',parts:[]},'incomplete'],
  [{parts:[{contentType:'multipart/encrypted',parts:[]}]},'incomplete']
 ]){
  s.context.browser.messages.getFull=async()=>full;
  const result=await new Promise(resolve=>s.listeners.at(-1)({action:'getLocalRisk',messageId:7},{},resolve));
  assert.equal(result.status,'success');assert.equal(result.threat.coverage.state,expected);
 }
 (await s.context.getMessageAnalysisContext(s.message)).dispose();assert.equal(s.requests.length,0);
});

test('strict UTF-8/QP decoding joins bytes before decoding and refuses ambiguous input',()=>{
 const s=setup();
 assert.equal(s.context.decodeUtf8QuotedPrintable('=C5=\r\n=BC =F0=9F=\r\n=98=80 <p>=E6=B5=8B</p>'),'ż 😀 <p>测</p>');
 assert.equal(s.context.decodeUtf8QuotedPrintable('=EF=BB=BFtext'),'\ufefftext');
 for(const value of ['=C5=20','=ED=A0=80','=FF','=Q0','=A','=\n','=C5=BC \r\n','ü','a'.repeat(1024*1024+1)]) assert.equal(s.context.decodeUtf8QuotedPrintable(value),null);
});

function qpInput(s, rawBody='https://example.invalid/=C5=\r\n=BC') {
 const headers={'content-type':['text/plain; charset="utf-8"'],'content-transfer-encoding':['quoted-printable']};
 const leaf={partName:'1.1',contentType:'text/plain',headers,body:'https://example.invalid/��'};
 const full={decryptionStatus:'none',size:80,headers:{'message-id':['same']},parts:[leaf]};
 const raw={...full,parts:[{...leaf,body:undefined,rawBody}]};
 const reads=[];s.context.browser.messages.getFull=async(id,options)=>{reads.push({id,options});return options?.decodeContent===false?raw:full;};
 return {leaf,full,raw,reads};
}

test('affected input is repaired without mutating native trees and reaches the local URL assessment',async()=>{
 const s=setup({},true);await s.context.configure();const f=qpInput(s),before=JSON.stringify(f.full),rawBefore=JSON.stringify(f.raw);
 const received=[];const calculate=s.context.calculateThreatScore;
 s.context.calculateThreatScore=(author,urls,options)=>{received.push({urls:Array.from(urls),text:options.messageText});return calculate(author,urls,options);};
 const result=await new Promise(resolve=>s.listeners.at(-1)({action:'getLocalRisk',messageId:7},{},resolve));
 assert.equal(result.status,'success');assert.equal(result.threat.coverage.state,'checked');
 assert.equal(received[0].text,'https://example.invalid/ż ');assert.deepEqual(received[0].urls,['https://example.invalid/%C5%BC']);
 assert.equal(f.reads.length,2);assert.equal(f.reads[1].options.decodeContent,false);
 assert.equal(JSON.stringify(f.full),before);assert.equal(JSON.stringify(f.raw),rawBefore);assert.equal(s.requests.length,0);
 (await s.context.getMessageAnalysisContext(s.message)).dispose();
});

test('normal inputs need one read and genuine replacement characters are retained after verification',async()=>{
 const s=setup();const normal=qpInput(s);normal.leaf.body='ordinary UTF-8 ż';
 assert.equal((await s.context.getAnalysisFull(7)).parts[0].body,normal.leaf.body);assert.equal(normal.reads.length,1);
 const literal=qpInput(s,'Valid =EF=BF=BD');literal.leaf.body='Valid �';
 const input=await s.context.getAnalysisFull(7);assert.equal(input.parts[0].body,'Valid �');assert.equal(input.thundyInputStatus,'verified');
 assert.equal(s.context.localContentCoverage(input).state,'checked');
 const other=qpInput(s);other.leaf.headers['content-type']=['text/plain; charset=iso-8859-1'];
 await s.context.getAnalysisFull(7);assert.equal(other.reads.length,1);assert.equal(s.requests.length,0);
});

test('unverifiable text is partial and limits avoid a second read of large or excessive trees',async()=>{
 for(const problem of ['invalid-utf8','failed-read','wrong-part','duplicate-part','wrong-charset','changed-header','changed-decryption','large-message','large-encoded','too-many-parts']){
  const s=setup();const f=qpInput(s);
  if(problem==='invalid-utf8')f.raw.parts[0].rawBody='=C5=20';
  if(problem==='failed-read')s.context.browser.messages.getFull=async(_id,options)=>{if(options)throw new Error('offline');return f.full;};
  if(problem==='wrong-part')f.raw.parts[0].partName='2';
  if(problem==='duplicate-part')f.raw.parts.push({...f.raw.parts[0]});
  if(problem==='wrong-charset')f.raw.parts[0].headers={...f.raw.parts[0].headers,'content-type':['text/plain; charset=latin1']};
  if(problem==='changed-header')f.raw.headers={'message-id':['different']};
  if(problem==='changed-decryption')f.raw.decryptionStatus='fail';
  if(problem==='large-message')f.full.size=1024*1024+1;
  if(problem==='large-encoded')f.raw.parts[0].rawBody='a'.repeat(1024*1024+1);
  if(problem==='too-many-parts')f.full.parts.push(...Array.from({length:2001},()=>({contentType:'application/octet-stream'})));
  const original=JSON.stringify(f.full),input=await s.context.getAnalysisFull(7);
  assert.equal(s.context.localContentCoverage(input).state,'incomplete',problem);assert.equal(JSON.stringify(f.full),original,problem);
  assert.equal(input.parts[0].body,'https://example.invalid/��',problem);
  if(['large-message','too-many-parts'].includes(problem))assert.equal(f.reads.length,1,problem);
  assert.equal(s.requests.length,0,problem);
 }
});

test('legacy numeric ownership is unbound and new snapshots never overwrite original fields',async()=>{
 const s=setup({},true);await s.context.configure();
 const legacy={schemaVersion:2,local:{state:'checked',observedAt:10},rows:[{provider:'virustotal',scope:'ip',resource:'message',state:'checked',verdict:'malicious',responses:1,observedAt:20}]};
 const old={analysisStatus:legacy,analysisStatusOwner:7,analysisStatusByMessage:{7:legacy},analysisStatusLegacy:legacy};
 const original=JSON.stringify(old),records=sourceRecords(s,old),ctx=await s.context.getMessageAnalysisContext(s.message);
 let snapshot=await ctx.snapshot();assert.equal(snapshot.local.state,'unrecorded');assert.equal(snapshot.rows.length,0);assert.equal(snapshot.sourceHistory.rows[0].resource,null);
 ctx.event({provider:'urlhaus',scope:'domain',phase:'finish',state:'checked',verdict:'none',responded:true,observedAt:50});await ctx.flush();
 const saved=records.get(s.message.headerMessageId);assert.equal(JSON.stringify(Object.fromEntries(Object.keys(old).map(key=>[key,saved[key]]))),original);
 assert.equal(saved.analysisSourceSnapshots[ctx.snapshotId].snapshot.rows[0].provider,'urlhaus');
 const restart=setup({},true);restart.context.getFromStore=async()=>saved;await restart.context.configure();
 snapshot=await (await restart.context.getMessageAnalysisContext({...restart.message,id:7})).snapshot();
 assert.equal(snapshot.rows.length,0);assert.ok(snapshot.sourceHistory.rows.some(row=>row.provider==='virustotal'&&row.observedAt===20));assert.ok(snapshot.sourceHistory.rows.some(row=>row.provider==='urlhaus'&&row.observedAt===50));
 ctx.dispose();assert.equal(s.requests.length,0);assert.equal(restart.requests.length,0);
});

test('matching attachment metadata cannot expose a cached report until actual file bytes match',async()=>{
 const s=setup({},true);await s.context.configure();
 const hash=await s.context.get_sha256_hash(new TextEncoder().encode('AAAA'));
 const records=sourceRecords(s,{attachments:[{partName:'1.2',attachment_name:'same.txt',hybrid_sha256:hash,state:'KNOWN',report:{verdict:'malicious'},report_fetched_at:'2026-10-01T08:00:00Z'}]});
 s.context.browser.messages.listAttachments=async()=>[{partName:'1.2',name:'same.txt',size:4}];
 s.context.browser.messages.getAttachmentFile=async()=>new File(['BBBB'],'same.txt');
 const ctx=await s.context.getMessageAnalysisContext(s.message),before=JSON.stringify(records.get(s.message.headerMessageId));
 await s.context.process_single_attachment(s.message,{partName:'1.2',name:'same.txt',size:4},false,false,ctx);
 assert.equal((await ctx.resourceRecord()).attachments.length,0);assert.equal((await ctx.snapshot()).rows.length,0);
 assert.equal((await ctx.snapshot()).sourceHistory.rows[0].verdict,'malicious');assert.equal(JSON.stringify(records.get(s.message.headerMessageId)),before);
 s.context.browser.messages.getAttachmentFile=async()=>new File(['AAAA'],'same.txt');
 await s.context.process_single_attachment(s.message,{partName:'1.2',name:'same.txt',size:4},false,false,ctx);
 assert.equal((await ctx.resourceRecord()).attachments.length,1);const snapshot=await ctx.snapshot();
 assert.equal(snapshot.rows[0].resource,'attachment:1.2');assert.equal(snapshot.rows[0].source,'stored');assert.equal(snapshot.rows[0].observedAt,Date.parse('2026-10-01T08:00:00Z'));
 assert.equal(s.requests.length,0);ctx.dispose();
});

test('snapshot count, byte limits, collisions and write errors preserve history and remain visible',async()=>{
 for(const problem of ['count','bytes','collision','transaction']){
  const s=setup({},true);await s.context.configure();const records=sourceRecords(s),ctx=await s.context.getMessageAnalysisContext(s.message);
  const snapshots=problem==='count'?Object.fromEntries(Array.from({length:64},(_,i)=>[String(i),{snapshot:{}}])):problem==='bytes'?{large:{padding:'x'.repeat(1024*1024)}}:problem==='collision'?{[ctx.snapshotId]:{snapshot:{local:{state:'checked'}}}}:{};
  records.set(s.message.headerMessageId,{messageHeader:s.message.headerMessageId,analysisSourceSnapshots:snapshots});
  const original=JSON.stringify(records.get(s.message.headerMessageId));if(problem==='transaction')s.context.updateStore=async()=>{throw new Error('commit failed');};
  ctx.event({provider:'urlhaus',scope:'domain',phase:'start'});await ctx.flush();
  assert.equal(JSON.stringify(records.get(s.message.headerMessageId)),original,problem);const failed=await ctx.snapshot();assert.equal(failed.sourcePersistenceFailed,true,problem);assert.equal(failed.sourcePersistenceReason,({count:'snapshot_count',bytes:'snapshot_bytes',collision:'snapshot_collision',transaction:'storage_failed'})[problem]);ctx.dispose();
 }
});

test('source writes serialize their snapshots and a failed write does not poison later saves',async()=>{
 const s=setup({},true);await s.context.configure();const records=sourceRecords(s),ctx=await s.context.getMessageAnalysisContext(s.message);
 let release,entered,attempts=0;const ready=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
 s.context.updateStore=async(_db,_store,key,update)=>{attempts++;if(attempts===1){entered();await gate;}const next=update(records.get(key));if(next)records.set(key,next);};
 ctx.event({provider:'urlhaus',scope:'domain',phase:'start'});const first=ctx.flush();await ready;
 ctx.event({provider:'virustotal',scope:'hash',phase:'start'});const second=ctx.flush();await new Promise(resolve=>setImmediate(resolve));assert.equal(attempts,1);
 release();await Promise.all([first,second]);assert.equal(records.get(s.message.headerMessageId).analysisSourceSnapshots[ctx.snapshotId].snapshot.rows.length,2);
 s.context.updateStore=async()=>{throw new Error('offline');};await ctx.flush();assert.equal(ctx.persistenceFailed,true);
 sourceRecords(s,records.get(s.message.headerMessageId));await ctx.flush();assert.equal(ctx.persistenceFailed,false);assert.equal((await ctx.snapshot()).sourcePersistenceReason,null);ctx.dispose();
});

test('expert report snapshot exposes only current resources and never persists display details',async()=>{
 const s=setup({},true);await s.context.configure();
 const record={links:[{url:'https://other.invalid/',report:{verdict:'malicious',signatures:[{name:'FOREIGN_SIGNATURE'}]}},{url:'https://example.com/',report:{finished:true,verdict:'unknown',mitre_attcks:[{attck_id:'T1059'}]},report_fetched_at:'2026-11-09T00:00:00Z'}]};
 const records=sourceRecords(s,record),before=JSON.stringify(record),ctx=await s.context.getMessageAnalysisContext(s.message);
 try{
  let snapshot=await ctx.snapshot();assert.deepEqual(Object.keys(snapshot.hybridReports),['link:1']);assert.ok(JSON.stringify(snapshot.hybridReports).includes('T1059'));assert.ok(!JSON.stringify(snapshot.hybridReports).includes('FOREIGN_SIGNATURE'));
  assert.equal(JSON.stringify(records.get(s.message.headerMessageId)),before);assert.equal(s.requests.length,0);
  await ctx.flush();assert.ok(!JSON.stringify(records.get(s.message.headerMessageId).analysisSourceSnapshots).includes('hybridReports'));
  records.set(s.message.headerMessageId,null);snapshot=await ctx.snapshot();assert.equal(Object.keys(snapshot.hybridReports).length,0);
 }finally{ctx.dispose();}
});

test('display preference reads suppress only extra report projection and never transmit or change findings',async()=>{
 const s=setup({analysisDefaultView:'expert',analysisShowHybridDetails:false},true);await s.context.configure();
 const records=sourceRecords(s,{links:[{url:'https://example.com/',report:{verdict:'malicious',finished:true,mitre_attcks:[{attck_id:'T1059'}]}}]});
 const ctx=await s.context.getMessageAnalysisContext(s.message);try{
  let snapshot=await ctx.snapshot();assert.equal(snapshot.displayPreferences.view,'expert');assert.equal(Object.keys(snapshot.hybridReports).length,0);assert.ok(snapshot.rows.some(row=>row.verdict==='malicious'));
  s.config.analysisDefaultView='simple';s.config.analysisShowHybridDetails=true;snapshot=await ctx.snapshot();assert.equal(snapshot.displayPreferences.view,'simple');assert.ok(JSON.stringify(snapshot.hybridReports).includes('T1059'));assert.equal(s.requests.length,0);assert.equal(records.size,1);
 }finally{ctx.dispose();}
});

test('urlscan HTTP 400 distinguishes DNS, validation and unknown rejection without exposing raw payloads',async()=>{
 for(const [body,errorCode] of [[{message:'DNS Error - Could not resolve domain'},'domain_unresolvable'],[{code:'validationerror',message:'private-token=CANARY'},'invalid_request'],[{message:'Submission blocked CANARY'},'submission_rejected'],[{errors:{some:'CANARY'}},'submission_rejected'],[null,'submission_rejected']]){
  const s=setup({externalAnalysisConsent:true,privacyTier:'max'},true);await s.context.configure();s.context.fetch=async()=>({status:400,ok:false,json:async()=>body});
  const result=await s.context.checkUrlscanIo('https://example.com/','synthetic');assert.equal(result.errorCode,errorCode);assert.equal(result.httpStatus,400);assert.ok(!JSON.stringify(result).includes('CANARY'));
 }
});

test('active scan owners survive observer eviction and reuse the same message context (AVN-019)',async()=>{
 const s=setup({},true);await s.context.configure();
 const first=await s.context.getMessageAnalysisContext(s.message);first.scanJobOwner='running-job';
 for(let id=100;id<305;id++)await s.context.getMessageAnalysisContext({...s.message,id});
 await new Promise(setImmediate);assert.equal(first.isCached(),false);assert.equal(first.disposed,false);
 assert.equal(first.event({provider:'urlhaus',scope:'domain',phase:'finish',state:'checked',verdict:'none',observedAt:100}),true);
 s.context.ThundyScans={contextFor:id=>id===s.message.id?first:null};
 assert.equal(await s.context.getMessageAnalysisContext(s.message),first);
 delete first.scanJobOwner;first.dispose();vm.runInContext('messageAnalyses.clear()',s.context);
});

test('authorized cache clearing uses the same cancellation and notification path as legacy clearing',async()=>{
 const s=setup({},true);await s.context.configure();const context=await s.context.getMessageAnalysisContext(s.message);
 let cancellation;s.context.ThundyScans={invalidate:options=>{cancellation=options;}};
 s.context.ThundySecurity={authorized:async()=>{}};const notifications=[];
 s.context.browser.runtime.sendMessage=async value=>notifications.push(value);
 const result=await new Promise(resolve=>s.listeners.at(-1)({action:'clearMemoryCaches'},{},resolve));
 await new Promise(setImmediate);assert.equal(result.success,true);assert.equal(cancellation.clear,true);assert.equal(cancellation.silent,true);
 assert.equal(context.disposed,true);assert.ok(notifications.some(value=>value.action==='memoryCachesCleared'));
});

test('a stalled provider cannot indefinitely block explicit opening with default policy; late verdicts do not rewrite decisions',async()=>{
 const s=setup();await s.context.configure();let finish;const clock=auditClock(s);
 s.context.handleCheckLinkState=(_request,_sender,resolve)=>{finish=resolve;};
 const request=auditRequest(),checking=s.context.handleAuditedLinkCheck(request,auditSender);
 while(!finish)await new Promise(setImmediate);await clock.advance(5000);
 const result=await checking;assert.equal(result.status,'UNKNOWN');assert.equal(result.check.errorCode,'LINK_CHECK_TIMEOUT');assert.equal(result.check.observedAt,null);
 let opened=0;s.context.browser.windows.openDefaultBrowser=async()=>{opened++;};
 assert.equal((await s.context.handleOpenAuditedLink(request,auditSender)).success,true);
 finish({status:'MALICIOUS',provider:'late provider'});await new Promise(setImmediate);
 const record=(await s.context.readLinkAudit()).records[0];assert.equal(record.outcome,'OPENED');assert.equal(record.verdictAtDecision,'UNKNOWN');assert.equal(opened,1);
});
test('unavailable providers with default settings remain unknown and can be explicitly confirmed',async()=>{
 const s=setup();await s.context.configure();s.context.handleCheckLinkState=(_request,_sender,resolve)=>resolve({status:'UNKNOWN',check:{origin:'none',outcome:'missing_key',observedAt:null}});
 const request=auditRequest(),result=await s.context.handleAuditedLinkCheck(request,auditSender);assert.equal(result.status,'UNKNOWN');assert.notEqual(result.protection?.required,true);
 assert.equal((await s.context.handleOpenAuditedLink(request,auditSender)).success,true);assert.equal((await s.context.readLinkAudit()).records[0].verdictAtDecision,'UNKNOWN');
});
test('source storage failures expose only a fixed safe exception name and clear it after recovery',async()=>{
 const s=setup({},true);await s.context.configure();sourceRecords(s,{links:[]});const ctx=await s.context.getMessageAnalysisContext(s.message);
 const save=s.context.updateStore;s.context.updateStore=async()=>{throw Object.assign(new Error('PRIVATE_PATH_CANARY'),{name:'QuotaExceededError'});};
 await ctx.flush();let snapshot=await ctx.snapshot();assert.equal(snapshot.sourcePersistenceReason,'storage_failed');assert.equal(snapshot.sourcePersistenceError,'QuotaExceededError');assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_PATH_CANARY'));
 s.context.updateStore=save;await ctx.flush();snapshot=await ctx.snapshot();assert.equal(snapshot.sourcePersistenceError,null);ctx.dispose();
});


test('local-only checks return their own complete score and reasons without provider verdicts',async()=>{
 for(const [url,score] of [['https://example.com/',0],['https://unrelated.invalid/',40],['https://paypa1.com/',100]]){
  const s=setup();await s.context.configure();s.full.parts[0].body='Visit '+url;
  const result=await s.context.handleAuditedLinkCheck({...auditRequest(),url},auditSender);
  assert.equal(result.status,'UNKNOWN');assert.equal(result.score,score);assert.equal(result.local.score,score);assert.equal(result.local.state,'checked');assert.equal(result.local.scope,'link-in-message');assert.equal(s.requests.length,0);
  assert.deepEqual(Array.from(result.local.reasons),Array.from((await s.context.readLinkAudit()).records[0].reasons));
 }
});
test('local score and reasons are visible before switching to the expert link view',async()=>{
 for(const score of [0,40,100]){
  const f=await clickDialog({status:'UNKNOWN',local:{state:'checked',score,reasons:score?['Local warning']:[]},check:{origin:'none',outcome:'disabled'}});
  try{const text=f.root.querySelector('.local-score');assert.ok(text.textContent.includes(score+' / 100'));assert.equal(text.hidden,false);assert.equal(text.closest('[hidden]'),null);
   if(score)assert.equal(f.root.querySelector('[data-source=local]').hidden,false);
   const switcher=[...f.root.querySelectorAll('button')].find(b=>!b.closest('footer'));switcher.click();assert.equal(text.hidden,false);switcher.click();assert.equal(text.hidden,false);
  }finally{f.dom.window.close();}
 }
});
test('local read failures remain unavailable instead of a zero score',async()=>{
 const s=setup();await s.context.configure();s.context.browser.messages.getFull=async()=>{throw Error('read failure');};
 const result=await s.context.handleAuditedLinkCheck(auditRequest(),auditSender);assert.equal(result.local.state,'failed');assert.equal(result.local.score,null);assert.equal(result.score,null);assert.equal(s.requests.length,0);
 const f=await clickDialog(result);try{assert.ok(!f.root.querySelector('.local-score').textContent.includes('0 / 100'));assert.equal(f.root.querySelector('.local-score').closest('[hidden]'),null);}finally{f.dom.window.close();}
});

test('a failed source context does not discard an already calculated local popup score',async()=>{
 const s=setup();await s.context.configure();s.full.parts[0].body='Visit https://paypa1.com/';s.context.getMessageAnalysisContext=async()=>{throw Error('source cache unavailable');};
 const result=await new Promise(resolve=>s.listeners.at(-1)({action:'getLocalRisk',messageId:7},{},resolve));assert.equal(result.status,'success');assert.equal(result.threat.score,100);assert.equal(s.requests.length,0);
});

test('a stalled source context does not hold a calculated local popup score',{timeout:2000},async()=>{
 const s=setup();await s.context.configure();s.full.parts[0].body='Visit https://paypa1.com/';s.context.getMessageAnalysisContext=()=>new Promise(()=>{});
 const result=await new Promise(resolve=>s.listeners.at(-1)({action:'getLocalRisk',messageId:7},{},resolve));assert.equal(result.status,'success');assert.equal(result.threat.score,100);assert.equal(s.requests.length,0);
});

test('message URL inventory retains actual HTML targets and provider-excluded hosts independently',async()=>{
 const s=setup();await s.context.configure();
 const full={parts:[{contentType:'text/html',body:'<style>https://style.invalid/</style><script>https://script.invalid/</script><a href="HTTPS://GITHUB.COM/project?a=1&amp;b=2#part">https://decoy.invalid/</a><a href="https://example.com/path/">Open</a><p>HTTPS://MICROSOFT.COM/help</p><img src="https://pixel.invalid/">'},{contentType:'text/plain',name:'file.txt',body:'https://attachment.invalid/'}]};
 const urls=Array.from(s.context.messageUrlInventory(full));
 assert.deepEqual(urls,['https://github.com/project?a=1&b=2#part','https://example.com/path/','https://microsoft.com/help']);
 assert.deepEqual(Array.from(s.context.filterUrls(urls)),['https://example.com/path/']);assert.equal(s.requests.length,0);
});

test('stored link verdicts and urlscan writes never cross path, query or fragment boundaries',async()=>{
 const s=setup();await s.context.configure();
 const urls=['https://example.com/path','https://example.com/path/','https://example.com/path?a=1','https://example.com/path?a=2','https://example.com/path#one','https://example.com/path#two'];
 const links=urls.map(url=>({url,state:'UNKNOWN',urlscan:{status:'MALICIOUS'}}));
 const records=sourceRecords(s,{links});
 for(const url of urls){
  for(const link of links)link.urlscan={status:link.url===url?'CLEAN':'MALICIOUS',assessment:{assessmentVersion:1,completion:'complete',signals:[{code:'overall',verdict:link.url===url?'none':'malicious'}]}};
  const result=await new Promise(resolve=>s.context.handleCheckLinkState({url,messageId:7},auditSender,resolve));assert.equal(result.status,'CLEAN',url);
  await s.context.persistUrlscanLinkResult(s.message,url,{status:'SUSPICIOUS'});
  assert.equal(links.filter(link=>link.urlscan.status==='SUSPICIOUS').length,1);assert.equal(links.find(link=>link.url===url).urlscan.status,'SUSPICIOUS');
 }
 assert.equal(records.get(s.message.headerMessageId).links.length,6);
 assert.equal(s.context.sameAnalysisUrl('HTTPS://EXAMPLE.COM:443','https://example.com/'),true);assert.equal(s.context.sameAnalysisUrl('invalid','invalid'),false);
});

test('local scoring includes provider-excluded URLs and ignores an HTML anchor decoy',async()=>{
 const s=setup();await s.context.configure();s.message.author='Alice <alice@unrelated.invalid>';
 s.full.parts=[{contentType:'text/html',body:'<a href="https://github.com/project">https://unrelated.invalid/</a>'}];
 const result=await new Promise(resolve=>s.listeners.at(-1)({action:'getLocalRisk',messageId:7},{},resolve));
 assert.ok(result.threat.score>0);assert.equal(s.requests.length,0);
});

test('local attachment lookup skips all file APIs without relevant stored findings',async()=>{
 const s=setup();await s.context.configure();let listed=0,read=0;
 s.context.browser.messages.listAttachments=async()=>{listed++;return [];};s.context.browser.messages.getAttachmentFile=async()=>{read++;return new Promise(()=>{});};
 for(const record of [null,{attachments:[]},{attachments:[{partName:'1',hybrid_sha256:'a'.repeat(64),report:{verdict:'no specific threat',finished:true}}]}]){
  s.context.getFromStore=async()=>record;assert.equal((await s.context.collectAttachmentFindings(s.message)).length,0);
 }
 assert.equal(listed,0);assert.equal(read,0);
});

test('attachment findings hash only relevant parts once per evaluation and reject changed actual bytes',async()=>{
 const s=setup();await s.context.configure();const hash=await s.context.get_sha256_hash(new TextEncoder().encode('test'));
 sourceRecords(s,{attachments:[{partName:'1',hybrid_sha256:hash,state:'KNOWN',report:{verdict:'malicious'}},{partName:'1',hybrid_sha256:hash,virustotal_stats:{malicious:1}},{partName:'2',hybrid_sha256:'a'.repeat(64),report:{verdict:'no specific threat'}}]});
 s.context.browser.messages.listAttachments=async()=>[{partName:'1',name:'relevant.txt',size:4},{partName:'2',name:'unrelated.txt',size:4}];let bytes='test';const reads=[];
 s.context.browser.messages.getAttachmentFile=async(_id,part)=>{reads.push(part);assert.equal(part,'1');return new File([bytes],'relevant.txt');};
 let findings=await s.context.collectAttachmentFindings(s.message);assert.equal(findings.length,1);assert.deepEqual(reads,['1']);
 bytes='changed';findings=await s.context.collectAttachmentFindings(s.message);assert.equal(findings.length,0);assert.deepEqual(reads,['1','1']);
});

test('a displaced Hybrid warning follows verified bytes and survives unknown or older replacement reports',async()=>{
 const s=setup();await s.context.configure();
 const hash=await s.context.get_sha256_hash(new TextEncoder().encode('test')),foreign='a'.repeat(64);
 const time='2026-11-17T12:00:00Z',later='2026-11-18T12:00:00Z';
 const archived={partName:'1',hybrid_sha256:hash,report_fetched_at:time,report:{state:'COMPLETE',sha256:hash,verdict:'malicious'}};
 const active={...archived,hybrid_sha256:foreign,report:{state:'COMPLETE',sha256:foreign,verdict:'clean'}};
 const record={attachments:[active],analysisReportArchive:{schemaVersion:1,entries:[
  {kind:'attachment',resource:archived},{kind:'attachment',resource:archived},
  {kind:'attachment',resource:{...archived,partName:'2',report:{...archived.report,sha256:foreign}}},
  {kind:'attachment',resource:{...archived,partName:'2',report:null,virustotal_stats:{malicious:20}}},
  {kind:'link',resource:{...archived,partName:'2'}}
 ]}};
 sourceRecords(s,record);
 const reads=[];
 s.context.browser.messages.listAttachments=async()=>['1','2'].map(partName=>({partName,name:'file.pdf',size:4}));
 s.context.browser.messages.getAttachmentFile=async(_id,part)=>{reads.push(part);return new File(['test'],'file.pdf');};
 const lookup=()=>s.context.collectAttachmentFindings(s.message);
 const findings=await lookup();
 assert.deepEqual(reads,['1']);
 assert.equal(findings.length,1);
 assert.equal(findings[0].source,'archive');
 assert.equal(findings[0].observedAt,Date.parse(time));
 const assessment=s.context.calculateThreatScore(s.message.author,[],{attachmentFindings:findings});
 assert.equal(assessment.heuristicScore,0);
 assert.equal(assessment.score,80);
 assert.equal(assessment.reasonDetails[0].code,'reasonArchivedMaliciousAttachment');
 assert.match(assessment.archivedAttachmentReasons[0],/Historical finding.*Hybrid Analysis.*file\.pdf/i);
 const clean={...archived,report:{state:'COMPLETE',sha256:hash,verdict:'clean'}};
 for (const replacement of [
  {...clean,report_fetched_at:'2026-11-16T12:00:00Z'},
  {...clean,report_fetched_at:later,report:{...clean.report,finished:false}},
  {...clean,report_fetched_at:later,report:{state:'COMPLETE',sha256:hash}},
  {...clean,report_fetched_at:later,report:[clean.report,{state:'COMPLETE',sha256:foreign,verdict:'clean'}]}
 ]) {
  record.attachments[0]=replacement;
  assert.equal((await lookup())[0].source,'archive');
 }
 record.attachments[0]={...clean,report_fetched_at:later};
 assert.equal((await lookup()).length,0);
 record.attachments[0]={...clean,report_fetched_at:later,virustotal_stats:{malicious:1}};
 assert.equal((await lookup())[0].provider,'VirusTotal');
 record.attachments[0]=active;
 s.context.browser.messages.getAttachmentFile=async()=>new File(['different'],'file.pdf');
 assert.equal((await lookup()).length,0);
 assert.equal(s.requests.length,0);
});

test('local revisions are allocated before asynchronous reads and older computations cannot overwrite the source score',async()=>{
 const s=setup({},true);await s.context.configure();const ctx=await s.context.getMessageAnalysisContext(s.message);
 const earlier=s.context.beginLocalAssessment(7),later=s.context.beginLocalAssessment(7);
 s.context.recordLocalCoverage(ctx,{state:'checked'},{score:100,reasons:['current'],assessment:later});
 s.context.recordLocalCoverage(ctx,{state:'checked'},{score:0,reasons:[],assessment:earlier});
 assert.equal(ctx.model.data.local.score,100);assert.equal(ctx.model.data.local.assessment.revision,later.revision);ctx.dispose();
 let release;let reads=0;s.context.browser.messages.getFull=()=>++reads===1?new Promise(resolve=>{release=resolve;}):Promise.resolve(s.full);
 const call=id=>new Promise(resolve=>s.listeners.at(-1)({action:'getLocalRisk',messageId:7,requestId:id},{},resolve));
 const old=call('old');while(!release)await new Promise(setImmediate);const current=await call('current');release(s.full);const previous=await old;
 assert.ok(previous.threat.assessment.revision<current.threat.assessment.revision);assert.equal(previous.threat.assessment.requestId,'old');assert.equal(current.threat.assessment.messageId,7);
 vm.runInContext('messageAnalyses.clear()',s.context);
});

function auditClock(state){
 let now=Date.now(),next=0;const timers=new Map();
 state.context.Date=class extends Date{static now(){return now;}};
 state.context.setTimeout=(fn,ms)=>{const id=++next;timers.set(id,{fn,at:now+ms});return id;};state.context.clearTimeout=id=>timers.delete(id);
 return {advance:async ms=>{now+=ms;for(let round=0;round<20;round++){await new Promise(setImmediate);const due=[...timers].filter(([,t])=>t.at<=now);if(!due.length)break;for(const [id,t]of due){timers.delete(id);t.fn();}}}};
}

test('a stalled initial audit write does not block the local score; late persistence remains PENDING',async()=>{
 const s=setup();await s.context.configure();const clock=auditClock(s);let release;const original=s.context.browser.storage.local.set;
 s.context.browser.storage.local.set=values=>new Promise(resolve=>{release=async()=>{await original(structuredClone(values));resolve();};});
 const request=auditRequest('slow_initial'),checking=s.context.handleAuditedLinkCheck(request,auditSender);
 while(!release)await new Promise(setImmediate);await clock.advance(5000);
 const result=await checking;assert.equal(result.auditSaved,false);assert.equal(typeof result.score,'number');
 await release();await new Promise(setImmediate);
 const record=s.config.linkAuditLog[0];assert.equal(record.outcome,'PENDING');assert.equal(record.decidedAt,null);assert.equal(record.openAttempts,0);
});

test('audit timeouts retain real serialization and expired queued edits never execute later',async()=>{
 const s=setup();await s.context.configure();const clock=auditClock(s);const original=s.context.browser.storage.local.set;
 let release,writes=0,edited=false;
 s.context.browser.storage.local.set=values=>{writes++;return new Promise(resolve=>{release=async()=>{await original(structuredClone(values));resolve();};});};
 const first=s.context.editLinkAudit(records=>records.unshift({id:'first',clickedAt:Date.now(),outcome:'PENDING'}));const firstRejected=assert.rejects(first,{code:'AUDIT_STORAGE_TIMEOUT'});
 while(!release)await new Promise(setImmediate);
 const second=s.context.editLinkAudit(records=>{edited=true;records.unshift({id:'must-not-appear',clickedAt:Date.now(),outcome:'OPENED'});});const secondRejected=assert.rejects(second,{code:'AUDIT_STORAGE_TIMEOUT'});
 await clock.advance(5000);await Promise.all([firstRejected,secondRejected]);assert.equal(writes,1);assert.equal(edited,false);
 await release();await new Promise(setImmediate);assert.equal(edited,false);assert.equal(s.config.linkAuditLog.length,1);assert.equal(s.config.linkAuditLog[0].outcome,'PENDING');
 s.context.browser.storage.local.set=original;assert.equal((await s.context.readLinkAudit()).records.length,1);
});

test('audit initialization reads and post-opening commits are bounded without replaying an accepted opening',async()=>{
 for(const stage of ['initial_read','final_write']){
  const s=setup();await s.context.configure();const request=auditRequest(stage),clock=auditClock(s);let opens=0,release;
  s.context.browser.windows.openDefaultBrowser=async()=>{opens++;};
  if(stage==='initial_read'){
   const get=s.context.browser.storage.local.get;s.context.browser.storage.local.get=keys=>Array.isArray(keys)&&keys.includes('linkAuditLog')?new Promise(resolve=>{release=()=>resolve({});}):get(keys);
   const checking=s.context.handleAuditedLinkCheck(request,auditSender);while(!release)await new Promise(setImmediate);await clock.advance(5000);
   assert.equal((await checking).auditSaved,false);release();await new Promise(setImmediate);assert.equal(s.config.linkAuditLog.length,0);
  }else{
   await s.context.handleAuditedLinkCheck(request,auditSender);const set=s.context.browser.storage.local.set;
   s.context.browser.storage.local.set=values=>new Promise(resolve=>{release=async()=>{await set(structuredClone(values));resolve();};});
   const opening=s.context.handleOpenAuditedLink(request,auditSender);while(!release)await new Promise(setImmediate);await clock.advance(5000);
   const result=await opening;assert.equal(result.success,true);assert.equal(result.auditSaved,false);assert.equal(opens,1);
   assert.equal((await s.context.handleOpenAuditedLink(request,auditSender)).success,false);assert.equal(opens,1);
   await release();assert.equal(s.config.linkAuditLog[0].outcome,'OPENED');assert.equal(s.config.linkAuditLog[0].openAttempts,1);
  }
 }
});

test('admin link evaluation accepts actual message targets even when providers exclude their domains',async()=>{
 const s=setup();await s.context.configure();
 s.context.ThundySecurity={read:async()=>({policy:{enabled:true}}),defaults:{},decision:()=>({required:false})};
 s.context.getMessageAnalysisContext=async()=>({scanJob:null});
 vm.runInContext(fs.readFileSync('security_links.js','utf8')+'\nglobalThis.linkSecurity=ThundyLinkSecurity;',s.context);
 for(const url of ['https://github.com/project','https://microsoft.com/help?x=1&y=2#part']){
  s.full.parts=[{contentType:'text/html',body:'<a href="'+url.replaceAll('&','&amp;')+'">https://decoy.invalid/</a>'}];
  assert.equal(s.context.filterUrls([url]).length,0);
  const result=await s.context.linkSecurity.evaluate({messageId:7,url,verdict:'UNKNOWN'},auditSender);assert.equal(typeof result.fingerprint,'string');
  await assert.rejects(s.context.linkSecurity.evaluate({messageId:7,url:'https://decoy.invalid/'},auditSender),/LINK_CONTEXT_CHANGED/);
 }
 assert.equal(s.requests.length,0);
});

test('injected warning banners reject out-of-order scores and clear a superseded warning',async()=>{
 const s=setup();await s.context.configure();const dom=new JSDOM('<body></body>');
 const context=vm.createContext({document:dom.window.document});
 async function render(score,revision,runtimeId='runtime-a'){
  await s.context.injectThreatBanner(1,{score,reasons:['warning'],assessment:{messageId:7,runtimeId,revision}});
  const injected=s.injections.at(-1);context.args=injected.args;vm.runInContext('('+injected.func.toString()+')(...args)',context);
 }
 try{await render(100,2);assert.ok(dom.window.document.getElementById('thundy-threat-banner'));
  await render(0,1);assert.ok(dom.window.document.getElementById('thundy-threat-banner'));
  await render(0,3);assert.equal(dom.window.document.getElementById('thundy-threat-banner'),null);
  await render(100,2);assert.equal(dom.window.document.getElementById('thundy-threat-banner'),null);
  await render(100,1,'runtime-b');assert.ok(dom.window.document.getElementById('thundy-threat-banner'));
  await render(0,100,'runtime-a');assert.ok(dom.window.document.getElementById('thundy-threat-banner'));
 }finally{dom.window.close();}
});

test('cancelled interactions cannot wait indefinitely for the final audit write',async()=>{
 const s=setup();await s.context.configure();const request=auditRequest('slow_cancel'),clock=auditClock(s);
 await s.context.handleAuditedLinkCheck(request,auditSender);let release;const set=s.context.browser.storage.local.set;
 s.context.browser.storage.local.set=values=>new Promise(resolve=>{release=async()=>{await set(structuredClone(values));resolve();};});
 const cancel=s.context.handleCancelAuditedLink({...request,reason:'escape'},auditSender);
 while(!release)await new Promise(setImmediate);await clock.advance(5000);assert.equal((await cancel).success,false);
 assert.equal((await s.context.handleOpenAuditedLink(request,auditSender)).success,false);
 await release();assert.equal(s.config.linkAuditLog[0].outcome,'ABORTED');assert.equal(s.config.linkAuditLog[0].cancelReason,'escape');
});

test('provider timeout does not invent an admin requirement, while unavailable policy stays protected',async()=>{
 for(const stalledPolicy of [false,true]){
  const s=setup();await s.context.configure();const clock=auditClock(s);let provider;
  s.context.ThundySecurity={read:stalledPolicy?()=>new Promise(()=>{}):async()=>({policy:{enabled:false}})};
  s.context.ThundyLinkSecurity={evaluate:async()=>{throw Error('must not evaluate a disabled or unreadable policy');}};
  s.context.handleCheckLinkState=(_request,_sender,resolve)=>{provider=resolve;};
  const check=s.context.handleAuditedLinkCheck(auditRequest('policy_'+stalledPolicy),auditSender);
  while(!provider)await new Promise(setImmediate);await clock.advance(5000);const result=await check;
  assert.equal(result.status,'UNKNOWN');assert.equal(result.protection?.required===true,stalledPolicy);
 }
});

async function manualUploadFixture(){
 const s=setup({apikey:'synthetic-key',externalAnalysisConsent:true,privacyTier:'balanced'});await s.context.configure();
 const digest=await s.context.get_sha256_hash(await new File(['test'],'actual.txt').arrayBuffer());
 const records=sourceRecords(s,{messageHeader:s.message.headerMessageId,attachments:[{partName:'1',attachment_name:'actual.txt',hybrid_sha256:digest,hybrid_job_id:'old-job',report:{verdict:'malicious'},report_fetched_at:'2026-10-01T00:00:00Z'}]});
 s.context.browser.messages.getAttachmentFile=async()=>new File(['test'],'actual.txt');
 const posts=[];s.context.fetch=async(url,options)=>{posts.push({url,options});return {status:201,ok:true,json:async()=>({id:'accepted-quick-scan',sha256:digest})};};
 return {...s,digest,records,posts,upload:(hash=digest,key=s.message.headerMessageId)=>s.context.handleManualUpload(7,'1','untrusted-name.txt',hash,key)};
}

test('manual uploads reject foreign storage keys, wrong hashes, changed bytes and ambiguous slots before POST',async()=>{
 for(const problem of ['key','hash','bytes','missing','duplicate']){
  const s=await manualUploadFixture();const record=s.records.get(s.message.headerMessageId);
  if(problem==='bytes')s.context.browser.messages.getAttachmentFile=async()=>new File(['changed'],'actual.txt');
  if(problem==='missing')s.records.clear();if(problem==='duplicate')record.attachments.push({...record.attachments[0]});
  const before=JSON.stringify([...s.records]);
  await assert.rejects(s.upload(problem==='hash'?'a'.repeat(64):s.digest,problem==='key'?'unrelated-record':undefined),{code:'MESSAGE_CONTEXT_CHANGED'});
  assert.equal(s.posts.length,0,problem);assert.equal(JSON.stringify([...s.records]),before,problem);
 }
});

test('manual uploads transmit verified bytes and Thunderbird filename, accepting a missing or uppercase response hash',async()=>{
 for(const hashKind of ['missing','uppercase']){
  const s=await manualUploadFixture();s.context.fetch=async(url,options)=>{s.posts.push({url,options});return {status:201,ok:true,json:async()=>({id:'accepted',...(hashKind==='uppercase'?{sha256:s.digest.toUpperCase()}: {})})};};
  const result=await s.upload(s.digest.toUpperCase());assert.equal(result.sha256,s.digest);assert.equal(s.posts.length,1);
  const file=s.posts[0].options.body.get('file');assert.equal(file.name,'actual.txt');assert.equal(await file.text(),'test');
  assert.equal(s.records.get(s.message.headerMessageId).attachments[0].hybrid_quick_scan_id,'accepted');
 }
});

test('a foreign provider hash is not assigned and the response records that the upload was sent',async()=>{
 const s=await manualUploadFixture(),before=JSON.stringify([...s.records]);
 s.context.fetch=async()=>{s.posts.push('POST');return {status:201,ok:true,json:async()=>({id:'foreign-job',sha256:'b'.repeat(64)})};};
 await assert.rejects(s.upload(),error=>error.code==='RESOURCE_MISMATCH'&&error.uploadSent===true);
 assert.equal(s.posts.length,1);assert.equal(JSON.stringify([...s.records]),before);
});

test('a late manual response cannot overwrite another resource or a later submission',async()=>{
 for(const change of ['bytes','reference','deleted']){
  const s=await manualUploadFixture();let release;
  s.context.fetch=async()=>{s.posts.push('POST');return await new Promise(resolve=>{release=()=>resolve({status:201,ok:true,json:async()=>({id:'late-job',sha256:s.digest})});});};
  const upload=s.upload();while(!release)await new Promise(setImmediate);
  const record=s.records.get(s.message.headerMessageId);
  if(change==='bytes')record.attachments[0].hybrid_sha256='b'.repeat(64);
  if(change==='reference')record.attachments[0].hybrid_quick_scan_id='newer-accepted-job';
  if(change==='deleted')s.records.clear();
  const before=JSON.stringify([...s.records]);release();await assert.rejects(upload,error=>error.code==='RESOURCE_MISMATCH'&&error.uploadSent===true);
  assert.equal(JSON.stringify([...s.records]),before);assert.equal(s.posts.length,1);
 }
});

test('consent withdrawal during manual file hashing prevents the POST',async()=>{
 const s=await manualUploadFixture(),hash=s.context.get_sha256_hash;let release;
 s.context.get_sha256_hash=async bytes=>{await new Promise(resolve=>{release=resolve;});return hash(bytes);};
 const upload=s.upload();while(!release)await new Promise(setImmediate);vm.runInContext('externalAnalysisConsent=false;',s.context);release();
 await assert.rejects(upload,{code:'EXTERNAL_ANALYSIS_DISABLED'});assert.equal(s.posts.length,0);
});

test('the upload RPC preserves the sent-but-unassigned distinction for the popup',async()=>{
 const s=await manualUploadFixture();s.context.fetch=async()=>({status:201,ok:true,json:async()=>({id:'foreign',sha256:'b'.repeat(64)})});
 const result=await new Promise(resolve=>s.listeners.at(-1)({action:'uploadAttachment',messageId:7,partName:'1',attachmentName:'untrusted-name.txt',hash:s.digest,headerMessageId:s.message.headerMessageId},{id:'test',url:'popup.html'},resolve));
 assert.equal(result.status,'error');assert.equal(result.code,'RESOURCE_MISMATCH');assert.equal(result.uploadSent,true);
});

test('oversized manual attachments are rejected before allocating their bytes',async()=>{
 const s=await manualUploadFixture();let reads=0;
 s.context.browser.messages.getAttachmentFile=async()=>({size:26*1024*1024,arrayBuffer:async()=>{reads++;throw Error('must not allocate');}});
 await assert.rejects(s.upload(),error=>error.code==='RESOURCE_MISMATCH'&&!error.uploadSent);assert.equal(reads,0);assert.equal(s.posts.length,0);
});

test('a newer resource reference during manual hashing prevents the POST',async()=>{
 const s=await manualUploadFixture(),hash=s.context.get_sha256_hash;let release;
 s.context.get_sha256_hash=async bytes=>{await new Promise(resolve=>{release=resolve;});return hash(bytes);};
 const upload=s.upload();while(!release)await new Promise(setImmediate);
 s.records.get(s.message.headerMessageId).attachments[0].hybrid_quick_scan_id='newer-before-send';release();
 await assert.rejects(upload,{code:'MESSAGE_CONTEXT_CHANGED'});assert.equal(s.posts.length,0);
});

test('manual uploads use current credentials and policy after the last storage wait',async()=>{
 for(const change of ['key','removed-key','consent','tier']){
  const s=await manualUploadFixture(),get=s.context.getFromStore;let reads=0,release;
  s.context.getFromStore=async(...args)=>{if(++reads===2)await new Promise(resolve=>{release=resolve;});return get(...args);};
  const upload=s.upload();while(!release)await new Promise(setImmediate);
  const assignments={key:"apikey_hybridanalysis='rotated-key'",'removed-key':"apikey_hybridanalysis=''",consent:'externalAnalysisConsent=false',tier:"privacyTier='strict'"};
  vm.runInContext(assignments[change],s.context);release();
  if(change==='key'){await upload;assert.equal(s.posts.length,1);assert.equal(s.posts[0].options.headers['api-key'],'rotated-key');}
  else{await assert.rejects(upload);assert.equal(s.posts.length,0,change);}
 }
});

test('a provider finding adjusts the decision value independently of the sender marker and heuristic', async () => {
 const s=setup({customWhitelist:['example.invalid']});await s.context.configure();
 const options={replyTo:'help@reply.invalid'};
 const plain=s.context.calculateThreatScore('sender@example.invalid',['https://destination.invalid/'],options);
 const enriched=s.context.calculateThreatScore('sender@example.invalid',['https://destination.invalid/'],
  {...options,attachmentFindings:[{name:'Fixture.txt',verdict:'malicious',provider:'Hybrid Analysis'}]});
 assert.ok(plain.heuristicReasons.some(reason=>/allowlist|whitelist/i.test(reason)));
 assert.ok(plain.heuristicScore>=50);assert.equal(enriched.heuristicScore,plain.heuristicScore);
 assert.ok(enriched.score>enriched.heuristicScore);
 assert.equal(enriched.riskModelVersion,2);assert.ok(enriched.providerReasons.length>0);
});

test('a delayed OS acknowledgement leaves PENDING, prevents replay and resolves the original interaction once', async () => {
 const s=setup();await s.context.configure();const clock=auditClock(s),req=auditRequest('delayed_native');
 await s.context.handleAuditedLinkCheck(req,auditSender);
 let resolve,dispatches=0;
 s.context.handleOpenCheckedLink=async()=>{dispatches++;return {handoff:new Promise(done=>{resolve=done;})};};
 const opening=s.context.handleOpenAuditedLink(req,auditSender);
 while(!resolve)await new Promise(setImmediate);
 await clock.advance(5000);
 assert.equal((await opening).code,'LINK_HANDOFF_PENDING');
 assert.equal(s.config.linkAuditLog[0].outcome,'PENDING');assert.equal(s.config.linkAuditLog[0].decidedAt,null);
 assert.equal((await s.context.handleOpenAuditedLink(req,auditSender)).success,false);
 assert.equal((await s.context.handleCancelAuditedLink(req,auditSender)).success,false);
 resolve({success:true});await new Promise(setImmediate);
 assert.equal(dispatches,1);assert.equal(s.config.linkAuditLog[0].outcome,'OPENED');
 assert.equal(s.config.linkAuditLog[0].openAttempts,1);
});
