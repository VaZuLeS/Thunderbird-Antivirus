const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const crypto = require('node:crypto');
const source = fs.readFileSync('audit.js', 'utf8');
function exportsApi() {
    const context = vm.createContext({ TextEncoder, crypto: crypto.webcrypto });
    vm.runInContext(source + '\nglobalThis.exportsApi = AuditExport;', context);
    return context.exportsApi;
}
const records = [
    { id: '1', url: 'https://example.com/?secret=abc', clickedAt: new Date('2026-10-10T12:00:00Z').getTime(), decidedAt: null, score: 80, scoreAtDecision: 80, verdict: 'MALICIOUS', verdictAtDecision: 'MALICIOUS', outcome: 'OPENED', provider: 'Hybrid Analysis', reasons: ['<img src=x onerror=alert(1)>'], extensionVersion: '1.20.0' },
    { id: '2', url: 'https://other.example/', clickedAt: new Date('2026-10-11T12:00:00Z').getTime(), score: null, outcome: 'ABORTED', verdict: 'UNKNOWN', provider: 'none', reasons: [] },
];

test('JSON export preserves evidence and its checksum detects a changed payload', async () => {
    const data = JSON.parse(await exportsApi().json(records, { profileId: 'profile-1' }));
    const hash = payload => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    assert.equal(data.sha256, hash(data.payload)); assert.equal(data.payload.schemaVersion, 1);
    assert.equal(data.payload.records[0].url, records[0].url); assert.equal(data.payload.records[1].score, null);
    data.payload.records[0].outcome = 'ABORTED'; assert.notEqual(data.sha256, hash(data.payload));
});

test('CSV neutralizes spreadsheet formulas, quotes multiline evidence and preserves URL parameters', () => {
    const csv = exportsApi().csv([{ ...records[0], id: ' \t=HYPERLINK("https://evil.invalid")', url: records[0].url, provider: '@cmd', cancelReason: '\nformula', reasons: ['one,"two"\nthree'] }]);
    assert.ok(csv.includes('"\' \t=HYPERLINK(""https://evil.invalid"")"'));
    assert.ok(csv.includes('"\'@cmd"')); assert.ok(csv.includes('"\'\nformula"'));
    assert.ok(csv.includes('https://example.com/?secret=abc')); assert.ok(csv.includes('2026-10-10T12:00:00.000Z'));
    assert.ok(csv.includes('scoreAtDecision')); assert.ok(csv.includes('providerReasons'));
});

test('filters combine dates, URL, outcome and minimum score without treating unknown as zero', () => {
    const api = exportsApi();
    assert.equal(api.filter(records, { query: 'EXAMPLE.COM', outcome: 'OPENED', minScore: 50, from: '2026-10-10', to: '2026-10-10' }).length, 1);
    assert.equal(api.filter(records, { minScore: 0 }).length, 1);
    assert.equal(api.filter(records, { outcome: 'ABORTED', minScore: '' }).length, 1);
    assert.equal(api.filter(records, { from: '2026-10-12' }).length, 0);
});

test('review UI escapes evidence, paginates and exports all filtered rows', { timeout: 10000 }, async () => {
    const dom = new JSDOM(fs.readFileSync('audit.html', 'utf8'));
    const entries = Array.from({ length: 57 }, (_, index) => ({ ...records[0], id: String(index), clickedAt: Date.now() - index }));
    const catalog = JSON.parse(fs.readFileSync('_locales/en/messages.json'));
    let blob, download, revoked = false, exportFinished;
    const exported = new Promise(resolve => { exportFinished = resolve; });
    const context = vm.createContext({
        document: dom.window.document, TextEncoder, crypto: crypto.webcrypto, Blob,
        URL: { createObjectURL: data => { blob = data; return 'blob:test'; }, revokeObjectURL: () => { revoked = true; } },
        browser: { runtime: { getManifest: () => ({ version: '1.20.0' }), sendMessage: async request => request.action === 'getLinkAudit' ? { success: true, records: entries, profileId: 'profile-test', retentionDays: 30, maxRecords: 2000 } : { success: true } },
            downloads: { download: async data => { download = data; } }, i18n: { getUILanguage: () => 'en', getMessage: key => catalog[key]?.message || '' } }
    });
    // Preserve the native URL constructor while intercepting blob operations.
    context.URL = class extends URL {}; context.URL.createObjectURL = data => { blob = data; return 'blob:test'; }; context.URL.revokeObjectURL = () => { revoked = true; exportFinished(); };
    vm.runInContext(fs.readFileSync('i18n.js', 'utf8') + '\n' + source, context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(dom.window.document.querySelectorAll('#auditRows tr').length, 50);
    assert.equal(dom.window.document.querySelector('#auditRows img'), null);
    assert.ok(dom.window.document.querySelector('#auditRows').textContent.includes('<img src=x'));
    assert.equal(dom.window.document.querySelector('#auditRows a'), null);
    dom.window.document.getElementById('auditNext').click();
    assert.equal(dom.window.document.querySelectorAll('#auditRows tr').length, 7);
    dom.window.document.getElementById('auditJson').click();
    await exported;
    assert.equal(download.saveAs, true); assert.equal(revoked, true);
    assert.equal(JSON.parse(await blob.text()).payload.records.length, 57);
    dom.window.close();
});


test('high-risk opened events use the decision snapshot rather than a later verdict', () => {
    const api = exportsApi();
    assert.equal(api.riskyOpened({ outcome: 'OPENED', scoreAtDecision: 80, verdictAtDecision: 'UNKNOWN' }), true);
    assert.equal(api.riskyOpened({ outcome: 'OPENED', scoreAtDecision: 0, verdictAtDecision: 'MALICIOUS' }), true);
    assert.equal(api.riskyOpened({ outcome: 'OPENED', scoreAtDecision: null, verdictAtDecision: 'UNKNOWN', verdict: 'MALICIOUS', score: 80 }), false);
    assert.equal(api.riskyOpened({ outcome: 'ABORTED', scoreAtDecision: 100, verdictAtDecision: 'MALICIOUS' }), false);
});

for (const lang of ['en', 'de', 'fr', 'es', 'it', 'pl']) test(`audit ${lang}: localized historical verdict stays separate from latest or missing decision evidence`, async () => {
    const dom = new JSDOM(fs.readFileSync('audit.html', 'utf8'));
    try {
        const catalog = JSON.parse(fs.readFileSync('_locales/' + lang + '/messages.json'));
        const entries = [
            { ...records[0], score: 9, scoreAtDecision: 72, verdictAtDecision: 'MALICIOUS', providerAtDecision: 'snapshot-provider', verdict: 'CLEAN', provider: 'latest-provider', checkedAt: Date.parse('2026-10-12T08:00:00Z') },
            { ...records[1], score: 80, scoreAtDecision: null, verdictAtDecision: null, providerAtDecision: null, verdict: 'MALICIOUS', provider: 'latest-provider' }
        ];
        const context = vm.createContext({ document: dom.window.document, browser: {
            runtime: { sendMessage: async () => ({ success: true, records: entries, profileId: 'synthetic' }) },
            i18n: { getUILanguage: () => lang, getMessage: key => catalog[key]?.message || '' }
        }});
        vm.runInContext(fs.readFileSync('i18n.js', 'utf8') + '\n' + source, context);
        await new Promise(resolve => setImmediate(resolve));
        const rows = dom.window.document.querySelectorAll('#auditRows tr');
        assert.equal(rows.length, 2);
        const historical = rows[0].children[3], missing = rows[1].children[3];
        assert.ok(historical.textContent.includes(catalog.auditVerdictAtDecision.message));
        assert.ok(historical.textContent.includes(catalog.providerMalicious.message));
        assert.ok(historical.textContent.includes('snapshot-provider'));
        assert.ok(!historical.textContent.includes(catalog.providerNoDetection.message));
        assert.ok(!historical.textContent.includes('latest-provider'));
        assert.ok(missing.textContent.includes(catalog.auditUnavailable.message));
        assert.ok(!missing.textContent.includes(catalog.providerMalicious.message));
        assert.ok(!missing.textContent.includes('latest-provider'));
        assert.ok(rows[0].querySelector('details').textContent.includes(catalog.providerNoDetection.message));
        assert.ok(rows[0].children[2].textContent.includes('72'));
        assert.equal(rows[0].querySelector('code').textContent, entries[0].url);
    } finally { dom.window.close(); }
});

test('returning to audit refreshes data while retaining filters, expanded evidence and keyboard focus', async () => {
    const dom = new JSDOM(fs.readFileSync('audit.html', 'utf8'), { pretendToBeVisual: true });
    try {
        const doc = dom.window.document, catalog = JSON.parse(fs.readFileSync('_locales/en/messages.json'));
        let entries = [{ ...records[0], id: 'original', url: 'https://review.example.invalid/first' }], calls = 0;
        const context = vm.createContext({ document: doc, browser: {
            runtime: { sendMessage: async () => { calls++; return { success: true, records: entries, profileId: 'synthetic' }; } },
            i18n: { getUILanguage: () => 'en', getMessage: key => catalog[key]?.message || '' }
        }});
        vm.runInContext(fs.readFileSync('i18n.js', 'utf8') + '\n' + source, context);
        await new Promise(resolve => setImmediate(resolve));
        doc.getElementById('auditSearch').value = 'review.example.invalid';
        const details = doc.querySelector('#auditRows details'); details.open = true;
        details.querySelector('summary').focus();
        entries = [...entries, { ...records[1], id: 'new', url: 'https://review.example.invalid/second' }];
        doc.dispatchEvent(new dom.window.Event('visibilitychange'));
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(calls, 2);
        assert.equal(doc.querySelectorAll('#auditRows tr').length, 2);
        assert.equal(doc.getElementById('auditSearch').value, 'review.example.invalid');
        assert.equal(doc.querySelector('#auditRows details').open, true);
        assert.equal(doc.activeElement.localName, 'summary');
        assert.equal(doc.activeElement.closest('tr').dataset.recordId, 'original');
        Object.defineProperty(doc, 'hidden', { value: true });
        doc.dispatchEvent(new dom.window.Event('visibilitychange'));
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(calls, 2, 'hiding the tab must not trigger background refreshes');
    } finally { dom.window.close(); }
});

test('late audit responses and errors cannot replace the newest successful snapshot', async () => {
    const dom = new JSDOM(fs.readFileSync('audit.html', 'utf8'));
    try {
        const doc = dom.window.document, pending = [];
        const context = vm.createContext({ document: doc, ThundyI18n: { get: key => key }, browser: {
            runtime: { sendMessage: () => new Promise((resolve, reject) => pending.push({resolve, reject})) }
        }});
        vm.runInContext(source, context);
        await new Promise(resolve => setImmediate(resolve));
        doc.getElementById('auditRefresh').click();
        pending[1].resolve({ success: true, records: records.slice(0, 2), profileId: 'latest' });
        await new Promise(resolve => setImmediate(resolve));
        pending[0].resolve({ success: true, records: [], profileId: 'stale' });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(doc.querySelectorAll('#auditRows tr').length, 2);
        assert.ok(doc.getElementById('auditStatus').textContent.includes('latest'));
        doc.getElementById('auditRefresh').click();
        doc.getElementById('auditRefresh').click();
        pending[3].resolve({ success: true, records, profileId: 'newest' });
        await new Promise(resolve => setImmediate(resolve));
        pending[2].reject(new Error('late failure'));
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(doc.querySelectorAll('#auditRows tr').length, records.length);
        assert.ok(doc.getElementById('auditStatus').textContent.includes('newest'));
        assert.equal(doc.getElementById('auditJson').disabled, false);
    } finally { dom.window.close(); }
});
