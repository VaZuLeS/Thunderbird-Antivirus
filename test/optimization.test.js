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
        DOMParser: new JSDOM().window.DOMParser, crypto: globalThis.crypto, AbortController, setTimeout, clearTimeout,
        browser: {
            runtime: { id: 'test', getURL: p => p, onMessage: { addListener: f => listeners.push(f) } },
            storage: { local: { get: async () => ({ ...config }), set: async values => Object.assign(config, values) }, onChanged: { addListener() {} } },
            permissions: { contains: async () => true, request: async () => true },
            messages: { get: async () => message, getFull: async () => full, listAttachments: async () => [{ name: 'file.html', contentType: 'text/html', partName: '1', size: 4 }], getAttachmentFile: async () => new File(['test'], 'file.html') },
            messageDisplay: { getDisplayedMessages: async () => ({ messages: [message] }), onMessagesDisplayed: { addListener() {} } },
            scripting: { executeScript: async script => { injections.push(script); } }, menus: { create() {}, onClicked: { addListener() {} } }, notifications: { create() {} }
        },
        fetch: async (url, options) => { requests.push({ url, options }); return { status: 200, ok: true, json: async () => ({ verdict: 'no specific threat', query_status: 'no_results', data: { attributes: { last_analysis_stats: { malicious: 0 } } } }) }; },
        openDB: async () => ({}), getFromStore: async () => null, updateStore: async () => {},
    });
    vm.runInContext(runtime + '\n' + gateway + '\n' + fs.readFileSync('risk.js', 'utf8') + '\n' + fs.readFileSync('sanitize.js', 'utf8') + '\n' + ['scan_policy.js', 'providers.js', 'message_ui.js', 'vendor/tldts.js', 'background.js'].map(file => fs.readFileSync(file, 'utf8')).join('\n') + '\n globalThis.configure = async () => { await loadSettings(); }; globalThis.forceTier = value => { privacyTier = value; };', context);
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
        const context = vm.createContext({ document: dom.window.document, window: dom.window, browser: { runtime: { sendMessage: async value => { payload = value; return { status: 'MALICIOUS' }; } } } });
        context.args = injected.args;
        vm.runInContext('(' + injected.func.toString() + ')(...args)', context);
        const event = new dom.window.MouseEvent(type, { button, bubbles: true, cancelable: true });
        dom.window.document.querySelector('a').dispatchEvent(event);
        assert.equal(event.defaultPrevented, true);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(payload.userAction, true); assert.equal(payload.messageId, 7);
        assert.equal(dom.window.document.querySelectorAll('[role="alertdialog"] button').length, 2);
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
    const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, console, fetch: (_, { signal }) => new Promise((resolve, reject) => {
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
    const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, console: { warn() {} }, fetch: async () => {
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
    const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, console, fetch: async (_, { signal }) => ({
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
