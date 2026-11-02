const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { reviewExport } = require('../audit_import.cjs');
const record = { id: crypto.randomUUID(), clickedAt: 1793577600000, decidedAt: null, extensionVersion: '1.24.2', url: 'https://user:password@example.org/private?token=SECRET#identity', outcome: 'PENDING', score: 90, scoreAtDecision: null, reasons: ['PRIVATE-REASON'], apikey: 'SECRET-KEY', providerAtDecision: null };
function envelope(records) {
    const payload = { schemaVersion: 1, profileId: 'PRIVATE-PROFILE', records };
    return { payload, sha256: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}
test('offline import redacts personal fields and preserves pending/snapshot semantics without activation', () => {
    const input = envelope([record]), original = JSON.stringify(input), result = reviewExport(input);
    assert.equal(JSON.stringify(input), original);
    assert.equal(result.authenticatedSource, false); assert.equal(result.enterpriseActivated, false);
    assert.equal(result.records[0].outcome, 'PENDING'); assert.equal(result.records[0].decidedAt, null);
    assert.equal(result.records[0].scoreAtDecision, null); assert.equal(result.records[0].urlRedacted, 'https://example.org');
    assert.ok(!/SECRET|PRIVATE|password|token/.test(JSON.stringify(result)));
});
test('offline import rejects checksum changes, simulations, duplicate identities and fabricated pending decisions', () => {
    const changed = envelope([record]); changed.payload.records[0].score = 1;
    assert.throws(() => reviewExport(changed), /CHECKSUM/);
    assert.throws(() => reviewExport(envelope([{ ...record, outcome: 'SIMULATED_OPEN' }])), /INVALID/);
    assert.throws(() => reviewExport(envelope([record, record])), /INVALID/);
    assert.throws(() => reviewExport(envelope([{ ...record, decidedAt: record.clickedAt + 1 }])), /DECISION/);
    assert.throws(() => reviewExport(envelope([{ ...record, scoreAtDecision: -1 }])), /INVALID/);
});
test('a later assessment never replaces the exported decision snapshot', () => {
    const result = reviewExport(envelope([{ ...record, outcome: 'ABORTED', decidedAt: record.clickedAt + 100, score: 90, scoreAtDecision: 12, verdictAtDecision: 'UNKNOWN', verdict: 'MALICIOUS' }]));
    assert.equal(result.records[0].scoreAtDecision, 12); assert.equal(result.records[0].verdictAtDecision, 'UNKNOWN');
});
