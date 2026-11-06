const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function popup(record = { attachments: [], links: [] }) {
    const dom = new JSDOM('<main id="hybrid_analysis_api_content"></main>');
    const timers = [], cancelled = [], requests = [];
    const context = vm.createContext({
        document: dom.window.document, window: dom.window, console, URL,
        setTimeout: callback => { timers.push(callback); return timers.length; },
        clearTimeout: id => cancelled.push(id),
        openDB: async () => ({ close() {} }),
        updateStore: async (_db, _store, _key, edit) => edit(record),
        fetch: async url => { requests.push(url); return { status: 200, json: async () => ({ state: 'IN_PROGRESS' }) }; },
        browser: { runtime: { onMessage: { addListener() {} } } }
    });
    const source = fs.readFileSync('api.js', 'utf8')
        .replace(/^\(async \(\) => \{/m, 'async function initializeForTest() {')
        .replace(/\}\)\(\);/m, '}');
    vm.runInContext(source + '\nexternalAnalysisConsent = true;', context);
    return { context, dom, record, timers, cancelled, requests };
}

test('a late report cannot overwrite a newer submission with the same filename or hash', async () => {
    const state = popup({ attachments: [{ attachment_name: 'same.pdf', hybrid_sha256: 'new-hash', hybrid_job_id: 'new-job', report: { state: 'COMPLETE', verdict: 'new' } }] });
    try {
        const original = JSON.stringify(state.record);
        for (const binding of [{ sha256: 'old-hash' }, { sha256: 'new-hash', jobId: 'old-job' }]) {
            assert.equal(await state.context.persistHybridReport({ headerMessageId: 'mail', attachmentName: 'same.pdf', report: { state: 'COMPLETE', verdict: 'old' }, ...binding }), false);
            assert.equal(JSON.stringify(state.record), original);
        }
        assert.equal(await state.context.persistHybridReport({ headerMessageId: 'mail', sha256: 'new-hash', jobId: 'new-job', report: { state: 'COMPLETE', verdict: 'current' } }), true);
        assert.equal(state.record.attachments[0].report.verdict, 'current');
    } finally { state.dom.window.close(); }
});

test('closing the popup cancels polling and queued callbacks cannot make another request', async () => {
    const state = popup();
    try {
        await state.context.get_hybrid_report_by_sha256({ hybrid_sha: 'hash', attachmentName: 'test.pdf' });
        assert.equal(state.requests.length, 1);
        assert.equal(state.timers.length, 1);
        state.dom.window.dispatchEvent(new state.dom.window.Event('pagehide'));
        assert.deepEqual(state.cancelled, [1]);
        state.timers[0]();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(state.requests.length, 1);
    } finally { state.dom.window.close(); }
});

test('a response arriving after invalidation cannot render or save a report', async () => {
    const state = popup({ attachments: [{ hybrid_sha256: 'hash' }] });
    try {
        let resolveResponse;
        state.context.fetch_hybrid_report = () => new Promise(resolve => { resolveResponse = resolve; });
        const pending = state.context.get_hybrid_report_by_sha256({ hybrid_sha: 'hash', headerMessageId: 'mail' });
        state.context.cancelHybridReportWork();
        resolveResponse({ response: { status: 200 }, json_data: { state: 'COMPLETE' } });
        await pending;
        assert.equal(state.dom.window.document.querySelector('main').children.length, 0);
        assert.equal(state.record.attachments[0].report, undefined);
    } finally { state.dom.window.close(); }
});

test('a failed local report write remains visibly unconfirmed', async () => {
    const state = popup();
    try {
        state.context.updateStore = async () => { throw new Error('quota'); };
        state.context.fetch_hybrid_report = async () => ({ response: { status: 200 }, json_data: { state: 'COMPLETE' } });
        await state.context.get_hybrid_report_by_sha256({ hybrid_sha: 'hash', headerMessageId: 'mail' });
        assert.ok([...state.dom.window.document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('could not be saved')));
    } finally { state.dom.window.close(); }
});

// Phase 4.1: Hybrid Analysis quick-scan fallback and payload persistence.
test('a 404 overview for a fresh submission falls back to GET /quick-scan/{id}', async () => {
    const state = popup();
    try {
        const sha = 'c'.repeat(64);
        state.context.fetch = async url => {
            state.requests.push(url);
            if (url.includes('/overview/')) return { status: 404, json: async () => ({ message: 'Not Found' }) };
            return { status: 200, json: async () => ({ id: 'qs-1', finished: false, scanners_v2: { crowdstrike_ml: { status: 'in-progress' } } }) };
        };
        const { response, json_data } = await state.context.fetch_hybrid_report(sha, null, 'qs-1');
        assert.equal(response.status, 200);
        assert.equal(state.requests.length, 2);
        assert.ok(state.requests[1].endsWith('/api/v2/quick-scan/qs-1'));
        assert.equal(json_data.sha256, sha);
        assert.equal(state.context.isHybridReportInProgress(json_data), true);
    } finally { state.dom.window.close(); }
});

test('no quick-scan fallback without a usable submission id and non-JSON errors keep their status', async () => {
    const state = popup();
    try {
        state.context.fetch = async url => { state.requests.push(url); return { status: 404, json: async () => { throw new SyntaxError('html'); } }; };
        for (const id of [null, 'MANUAL_CHECK', '../etc']) {
            const { response, json_data } = await state.context.fetch_hybrid_report('d'.repeat(64), null, id);
            assert.equal(response.status, 404);
            assert.equal(json_data, null);
        }
        assert.ok(state.requests.every(url => url.includes('/overview/')));
    } finally { state.dom.window.close(); }
});

test('quickScanReport keeps scanner payloads and drops bare submission receipts', () => {
    const source = fs.readFileSync('background.js', 'utf8');
    const start = source.indexOf('function quickScanReport('), end = source.indexOf('\n}', start) + 2;
    const context = vm.createContext({});
    vm.runInContext(source.slice(start, end), context);
    assert.equal(context.quickScanReport({ job_id: 'j', submission_id: 's', sha256: 'x' }), null);
    assert.equal(context.quickScanReport(null), null);
    const payload = { id: 'qs', finished: true, scanners_v2: { metadefender: { status: 'no-classification' } } };
    assert.equal(context.quickScanReport(payload), payload);
});

// Phase 4.2: complete Hybrid Analysis v2 representation in the popup.
test('a quick-scan report shows threat level verdict, family, name/type fallbacks and the report link', () => {
    const state = popup();
    try {
        const sha = 'e'.repeat(64);
        const card = state.context.renderReport({
            json_data: { finished: true, threat_level: 2, vx_family: 'AgentTesla', submit_name: 'invoice.exe', type_short: ['peexe', 'executable'], scanners_v2: {} },
            attachmentName: 'fallback.exe', hybrid_sha: sha
        });
        assert.ok(card.className.split(' ').includes('card-danger'));
        assert.ok(card.textContent.includes('AgentTesla'));
        assert.ok(card.textContent.includes('invoice.exe'));
        assert.ok(card.textContent.includes('peexe, executable'));
        const link = card.querySelector('a.hybrid-report-link');
        assert.equal(link.getAttribute('href'), 'https://www.hybrid-analysis.com/sample/' + sha);
        assert.equal(link.getAttribute('rel'), 'noopener noreferrer');

        const clean = state.context.renderReport({ json_data: { finished: true, threat_level: 0, scanners_v2: {} }, attachmentName: 'ok.pdf', hybrid_sha: 'not-a-hash' });
        assert.ok(clean.className.split(' ').includes('card-success'));
        assert.equal(clean.querySelector('a.hybrid-report-link'), null);
        assert.ok(clean.textContent.includes('ok.pdf'));

        const pending = state.context.renderReport({ json_data: { finished: false, threat_level: 0 }, attachmentName: 'wait.pdf', hybrid_sha: sha });
        assert.equal(pending.className, 'card mb-3');
    } finally { state.dom.window.close(); }
});

test('provider error messages and rate limits are shown to the tester', () => {
    const state = popup();
    try {
        const main = state.dom.window.document.querySelector('main');
        state.context.handle_hybrid_report_error({ status: 429, statusText: 'Too Many Requests' }, 'x.pdf', main, { message: 'API quota exceeded' });
        assert.ok(main.textContent.includes('API quota exceeded'));
        assert.ok(main.textContent.includes('rate limit'));
        main.textContent = '';
        state.context.handle_hybrid_report_error({ status: 500, statusText: 'err' }, 'x.pdf', main, ['not', 'an', 'object']);
        assert.ok(!main.textContent.includes('Provider message'));
    } finally { state.dom.window.close(); }
});

// Phase 4.3/4.4: stored sandbox verdicts feed the in-mail warning and provider matrix.
function loadSlice(file, name, context) {
    const source = fs.readFileSync(file, 'utf8');
    const start = source.search(new RegExp('(async )?function ' + name + '\\(')), end = source.indexOf('\n}', start) + 2;
    assert.ok(start >= 0, name);
    vm.runInContext(source.slice(start, end), context);
}

test('attachment findings from Hybrid Analysis and VirusTotal raise the threat score with reasons', () => {
    const context = vm.createContext({ uiText: (key, fallback, params = []) => params.reduce((text, value, i) => text.replace('$' + (i + 1), value), fallback) });
    loadSlice('risk.js', 'addReason', context);
    loadSlice('risk.js', 'evaluateAttachmentFindings', context);
    const reasons = [];
    const score = context.evaluateAttachmentFindings([
        { name: 'invoice.exe', verdict: 'malicious', provider: 'Hybrid Analysis' },
        { name: 'doc.pdf', verdict: 'suspicious', provider: 'VirusTotal' },
        { name: 'ok.txt', verdict: 'clean' }, null, 'junk'
    ], 0, reasons);
    assert.equal(score, 110);
    assert.equal(reasons.length, 2);
    assert.ok(reasons[0].includes('invoice.exe') && reasons[0].includes('Hybrid Analysis'));
    assert.deepEqual(JSON.parse(JSON.stringify(reasons.details.map(d => d.code))), ['reasonMaliciousAttachment', 'reasonSuspiciousAttachment']);
    assert.equal(context.evaluateAttachmentFindings('not-an-array', 5, []), 5);
});

test('collectAttachmentFindings derives verdicts from stored reports and VirusTotal stats only', async () => {
    const record = { attachments: [
        { attachment_name: 'a.exe', report: { verdict: 'malicious' } },
        { attachment_name: 'b.doc', virustotal_stats: { malicious: 3, suspicious: 0 } },
        { attachment_name: 'c.js', report: { threat_level: 1 } },
        { attachment_name: 'd.pdf', report: { finished: false, verdict: 'malicious' } },
        { attachment_name: 'e.txt', report: { verdict: 'no specific threat' }, virustotal_stats: { malicious: 0 } }
    ] };
    const keys = [];
    const context = vm.createContext({ Logger: { warn() {} }, getSharedDB: async () => ({}), getFromStore: async (_db, _store, key) => { keys.push(key); return record; } });
    loadSlice('background.js', 'extractHybridVerdictFromOverview', context);
    loadSlice('background.js', 'collectAttachmentFindings', context);
    const findings = await context.collectAttachmentFindings({ id: 4 });
    assert.deepEqual(keys, ['message:4']);
    assert.deepEqual(JSON.parse(JSON.stringify(findings)), [
        { name: 'a.exe', verdict: 'malicious', provider: 'Hybrid Analysis' },
        { name: 'b.doc', verdict: 'malicious', provider: 'VirusTotal' },
        { name: 'c.js', verdict: 'suspicious', provider: 'Hybrid Analysis' }
    ]);
    context.getFromStore = async () => { throw new Error('db'); };
    assert.equal((await context.collectAttachmentFindings({ headerMessageId: 'm' })).length, 0);
});

test('a live Hybrid Analysis link verdict is persisted and restored into the provider matrix', async () => {
    const record = { links: [{ url: 'https://x.invalid/', state: 'UPLOADED', hybrid_sha256: 'h' }, { url: 'https://other.invalid/' }] };
    const context = vm.createContext({ Logger: { error() {} }, getSharedDB: async () => ({}), updateStore: async (_db, _store, _key, edit) => edit(record) });
    loadSlice('background.js', 'persistHybridLinkVerdict', context);
    await context.persistHybridLinkVerdict({ headerMessageId: 'm' }, 'https://x.invalid/', { status: 'MALICIOUS', check: { observedAt: 1234 } });
    assert.deepEqual(JSON.parse(JSON.stringify(record.links[0].hybrid_verdict)), { status: 'MALICIOUS', observedAt: 1234 });
    assert.equal(record.links[1].hybrid_verdict, undefined);

    const statusContext = vm.createContext({ console });
    vm.runInContext(fs.readFileSync('analysis_status.js', 'utf8'), statusContext);
    const analysis = vm.runInContext('typeof ThundyAnalysis !== "undefined" ? ThundyAnalysis : this.ThundyAnalysis', statusContext);
    const data = analysis.legacy({ links: [{ url: 'https://x.invalid/', state: 'UPLOADED', hybrid_verdict: { status: 'MALICIOUS', observedAt: 1234 } }] });
    const row = data.rows.find(r => r.provider === 'hybridanalysis');
    assert.equal(row.verdict, 'malicious');
    assert.equal(row.scope, 'url');
});
