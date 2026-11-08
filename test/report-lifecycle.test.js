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
    record.attachments.forEach((item,index)=>{item.partName=String(index+1);item.hybrid_sha256='a'.repeat(64);});
    const keys = [];
    const context = vm.createContext({ browser:{messages:{listAttachments:async()=>record.attachments.map(item=>({partName:item.partName,size:1})),getAttachmentFile:async()=>({arrayBuffer:async()=>new ArrayBuffer(1)})}},get_sha256_hash:async()=>'a'.repeat(64),Logger: { warn() {} }, getSharedDB: async () => ({}), getFromStore: async (_db, _store, key) => { keys.push(key); return record; } });
    loadSlice('background.js', 'extractHybridVerdictFromOverview', context);
    loadSlice('background.js', 'collectAttachmentFindings', context);
    const findings = await context.collectAttachmentFindings({ id: 4 });
    assert.deepEqual(keys, ['message:4']);
    assert.deepEqual(JSON.parse(JSON.stringify(findings)), [
        { name: 'a.exe', verdict: 'malicious', provider: 'Hybrid Analysis' },
        { name: 'b.doc', verdict: 'malicious', provider: 'VirusTotal' },
        { name: 'c.js', verdict: 'suspicious', provider: 'Hybrid Analysis' }
    ]);
    context.get_sha256_hash=async()=>'b'.repeat(64);
    assert.equal((await context.collectAttachmentFindings({id:4})).length,0,'different attachment bytes never inherit findings');
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

test('checkHybridAnalysisResult falls back to GET /quick-scan/{id} on 404 overview', async () => {
    const requestedUrls = [];
    const context = vm.createContext({
        mayTransmitExternally: () => true,
        apikey_hybridanalysis: 'key',
        getHybridAnalysisOptions: () => ({}),
        requireHostPermission: async () => {},
        apiGateway: {
            fetchWithTimeout: async (url) => {
                requestedUrls.push(url);
                if (url.includes('/overview/')) return { ok: false, status: 404, json: async () => ({}) };
                return { ok: true, status: 200, json: async () => ({ finished: true, scanners_v2: { crowdstrike_ml: { status: 'malicious' } } }) };
            }
        }
    });
    loadSlice('background.js', 'extractHybridVerdictFromOverview', context);
    loadSlice('background.js', 'checkHybridAnalysisResult', context);
    const res = await context.checkHybridAnalysisResult('f'.repeat(64), 'UPLOADED', { requested: true, quickScanId: 'qs-live-1' });
    assert.equal(res.status, 'MALICIOUS');
    assert.equal(res.check.origin, 'live');
    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls[1].endsWith('/api/v2/quick-scan/qs-live-1'));
});

test('urlscan reportUrl is persisted and rendered as a clickable link in the popup, and checkAbuseIPDB respects isWhitelisted', async () => {
    const record = { links: [{ url: 'https://phish.invalid/' }] };
    const bgContext = vm.createContext({ Logger: { error() {} }, getSharedDB: async () => ({}), updateStore: async (_db, _store, _key, edit) => edit(record) });
    loadSlice('background.js', 'persistUrlscanLinkResult', bgContext);
    await bgContext.persistUrlscanLinkResult({ headerMessageId: 'm' }, 'https://phish.invalid/', {
        status: 'MALICIOUS_VISUAL',
        reasons: ['Brand spoof'],
        reportUrl: 'https://urlscan.io/result/12345678-aaaa-bbbb-cccc-1234567890ab/'
    });
    assert.equal(record.links[0].urlscan.reportUrl, 'https://urlscan.io/result/12345678-aaaa-bbbb-cccc-1234567890ab/');

    const state = popup();
    try {
        const card = state.dom.window.document.createElement('div');
        state.context.renderUrlscanResult(record.links[0].urlscan, card);
        const link = card.querySelector('a.urlscan-report-link');
        assert.ok(link);
        assert.equal(link.getAttribute('href'), 'https://urlscan.io/result/12345678-aaaa-bbbb-cccc-1234567890ab/');
    } finally { state.dom.window.close(); }

    const provContext = vm.createContext({
        mayTransmitExternally: () => true,
        requireHostPermission: async () => {},
        Logger: { error() {} },
        apiGateway: {
            fetchWithTimeout: async () => ({
                status: 200,
                json: async () => ({ data: { abuseConfidenceScore: 95, isWhitelisted: true } })
            })
        }
    });
    loadSlice('providers.js', 'checkAbuseIPDB', provContext);
    assert.equal(await provContext.checkAbuseIPDB('8.8.8.8', 'key'), false);
});

test('persistHybridReport upgrades UPLOADED state to KNOWN on finished report and get_hybrid_report_by_sha256 triggers refreshThreatBanner', async () => {
    const sentMessages = [];
    const state = popup({
        attachments: [{ attachment_name: 'sample.exe', hybrid_sha256: '1'.repeat(64), hybrid_job_id: 'job-1', state: 'UPLOADED' }],
        links: [{ url: 'https://test.invalid/', hybrid_sha256: '2'.repeat(64), hybrid_job_id: 'job-2', state: 'UPLOADED' }]
    });
    state.context.fetch = async () => ({
        status: 200,
        json: async () => ({ state: 'SUCCESS', verdict: 'malicious', threat_score: 100, sha256: '1'.repeat(64) })
    });
    state.context.browser.runtime.sendMessage = async (msg) => { sentMessages.push(msg); return { success: true }; };
    try {
        await state.context.get_hybrid_report_by_sha256({
            hybrid_sha: '1'.repeat(64),
            attachmentName: 'sample.exe',
            messageId: 42,
            partName: '1.2',
            headerMessageId: 'mail',
            jobId: 'job-1'
        });
        assert.equal(state.record.attachments[0].state, 'KNOWN');
        assert.ok(sentMessages.some(m => m && m.action === 'refreshThreatBanner' && m.messageId === 42));

        await state.context.persistHybridReport({
            headerMessageId: 'mail',
            sha256: '2'.repeat(64),
            jobId: 'job-2',
            report: { state: 'SUCCESS', verdict: 'suspicious' }
        });
        assert.equal(state.record.links[0].state, 'KNOWN');
    } finally { state.dom.window.close(); }
});

test('renderStoredResultWithoutConsent and renderManualUrlScanUI render stored hybrid_verdict', () => {
    const state = popup();
    state.context.TextEncoder = TextEncoder;
    try {
        const container = state.dom.window.document.getElementById('hybrid_analysis_api_content');
        const card = state.context.renderStoredResultWithoutConsent('https://bad.invalid/', null, container, null, null, { status: 'MALICIOUS' });
        const verdictEl = card.querySelector('.hybrid-link-verdict');
        assert.ok(verdictEl);
        assert.ok(verdictEl.className.includes('text-danger'));
        assert.match(verdictEl.textContent, /MALICIOUS/);

        state.context.renderManualUrlScanUI('https://susp.invalid/', 'mail', container, null, { status: 'SUSPICIOUS' });
        const verdicts = container.querySelectorAll('.hybrid-link-verdict');
        assert.equal(verdicts.length, 2);
        assert.ok(verdicts[1].className.includes('text-warning'));
    } finally { state.dom.window.close(); }
});

test('collectLinkFindings and evaluateLinkFindings incorporate Hybrid Analysis and URLScan.io link verdicts into the threat score', async () => {
    const riskContext = vm.createContext({
        sanitizeUrlForLog: u => u,
        uiText: (_key, fallback, params = []) => params.reduce((text, value, i) => text.replace('$' + (i + 1), value), fallback)
    });
    loadSlice('risk.js', 'addReason', riskContext);
    loadSlice('risk.js', 'evaluateLinkFindings', riskContext);
    const reasons = [];
    const score = riskContext.evaluateLinkFindings([
        { url: 'https://evil.invalid/login', verdict: 'malicious', provider: 'Hybrid Analysis' },
        { url: 'https://odd.invalid/', verdict: 'suspicious', provider: 'URLScan.io' }
    ], 0, reasons);
    assert.equal(score, 115);
    assert.equal(reasons.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(reasons.details.map(d => d.code))), ['reasonMaliciousLinkVerdict', 'reasonSuspiciousLinkVerdict']);

    const bgContext = vm.createContext({
        Logger: { warn() {} },
        getSharedDB: async () => ({}),
        getFromStore: async () => ({
            links: [
                { url: 'https://a.invalid/', report: { verdict: 'malicious' } },
                { url: 'https://b.invalid/', hybrid_verdict: { status: 'SUSPICIOUS' } },
                { url: 'https://c.invalid/', urlscan: { status: 'MALICIOUS_VISUAL' } },
                { url: 'https://d.invalid/', urlscan: { status: 'CLEAN' } }
            ]
        })
    });
    loadSlice('background.js', 'extractHybridVerdictFromOverview', bgContext);
    Object.assign(bgContext,{readFullForAnalysis:async()=>({parts:[]}),extractTextFromParts:()=>'',extractUrls:()=>['https://a.invalid/','https://b.invalid/','https://c.invalid/','https://d.invalid/'],filterUrls:urls=>urls});
    loadSlice('background.js', 'collectLinkFindings', bgContext);
    const findings = await bgContext.collectLinkFindings({ headerMessageId: 'm' });
    assert.deepEqual(JSON.parse(JSON.stringify(findings)), [
        { url: 'https://a.invalid/', verdict: 'malicious', provider: 'Hybrid Analysis' },
        { url: 'https://b.invalid/', verdict: 'suspicious', provider: 'Hybrid Analysis' },
        { url: 'https://c.invalid/', verdict: 'malicious', provider: 'URLScan.io' }
    ]);
    bgContext.extractUrls=()=>[];
    assert.equal((await bgContext.collectLinkFindings({headerMessageId:'m'})).length,0,'absent links cannot inherit old verdicts');
});

test('manual upload and URL scan handlers preserve existing virustotal_stats and urlscan when polling for the report', async () => {
    const state = popup();
    state.context.TextEncoder = TextEncoder;
    const reportCalls = [];
    state.context.get_hybrid_report_by_sha256 = opts => { reportCalls.push(opts); };
    state.context.browser.runtime.sendMessage = async () => ({ status: 'success', data: { sha256: '3'.repeat(64), id: 'qs-3' } });
    try {
        const container = state.dom.window.document.getElementById('hybrid_analysis_api_content');
        const vtStats = { malicious: 2, suspicious: 1, harmless: 40 };
        state.context.renderManualUploadUI('3'.repeat(64), 'file.bin', 11, '1.2', 'mail-11', container, vtStats);
        const uploadBtn = container.querySelector(`#btn-upload-${'3'.repeat(64)}`);
        uploadBtn.click();
        await new Promise(resolve => setImmediate(resolve));
        state.timers.at(-1)();
        assert.equal(reportCalls.length, 1);
        assert.deepEqual(JSON.parse(JSON.stringify(reportCalls[0].virustotal_stats)), vtStats);

        const urlscanData = { status: 'SUSPICIOUS', reasons: ['Brand mismatch'] };
        state.context.renderManualUrlScanUI('https://url.invalid/', 'mail-11', container, urlscanData);
        const urlBtns = container.querySelectorAll('button.btn-primary');
        urlBtns[urlBtns.length - 1].click();
        await new Promise(resolve => setImmediate(resolve));
        state.timers.at(-1)();
        assert.equal(reportCalls.length, 2);
        assert.deepEqual(JSON.parse(JSON.stringify(reportCalls[1].urlscan)), urlscanData);
    } finally { state.dom.window.close(); }
});

test('indexedDB_save_links_objects_to_db preserves existing link findings on UNKNOWN fallback and keeps urlscan on re-upload', async () => {
    const record = {
        messageHeader: 'mail-1',
        links: [
            { url: 'https://keep.invalid/', state: 'KNOWN', report: { verdict: 'malicious' }, urlscan: { status: 'MALICIOUS_VISUAL' } },
            { url: 'https://reupload.invalid/', state: 'UNKNOWN', urlscan: { status: 'SUSPICIOUS', reasons: ['Test'] } }
        ]
    };
    const bgContext = vm.createContext({
        Date, Map, Set,
        Logger: { error() {} },
        getSharedDB: async () => ({}),
        updateStore: async (_db, _store, _key, edit) => edit(record)
    });
    loadSlice('background.js', 'indexedDB_save_links_objects_to_db', bgContext);
    await bgContext.indexedDB_save_links_objects_to_db({ headerMessageId: 'mail-1' }, [
        { url: 'https://keep.invalid/', state: 'UNKNOWN' },
        { url: 'https://reupload.invalid/', state: 'UPLOADED', hybrid_sha256: '4'.repeat(64) }
    ]);
    assert.equal(record.links[0].state, 'KNOWN');
    assert.equal(record.links[0].report.verdict, 'malicious');
    assert.equal(record.links[1].state, 'UPLOADED');
    assert.equal(record.links[1].urlscan.status, 'SUSPICIOUS');
});
