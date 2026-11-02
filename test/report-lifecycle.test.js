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
