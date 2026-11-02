"use strict";
// Explicit offline review of an untrusted local export. No broker, network or signing.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { redactUrl } = require('./contracts.cjs');
const outcomes = new Set(['PENDING', 'OPENED', 'OPEN_ERROR', 'ABORTED']);
const providers = new Set(['none', 'Hybrid Analysis', 'VirusTotal', 'urlscan.io', 'URLhaus', 'AbuseIPDB']);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const score = value => value === null || Number.isInteger(value) && value >= 0 && value <= 100;
const time = value => Number.isFinite(value) && value > 0 && value <= 8640000000000000;
function reviewExport(input) {
    const payload = input?.payload;
    if (payload?.schemaVersion !== 1 || !Array.isArray(payload.records) || payload.records.length > 2000 || Buffer.byteLength(JSON.stringify(input)) > 3 * 1024 * 1024) throw new Error('AUDIT_EXPORT_INVALID');
    const checksum = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    if (checksum !== input.sha256) throw new Error('AUDIT_EXPORT_CHECKSUM_MISMATCH');
    const seen = new Set();
    const records = payload.records.map(record => {
        if (!uuid(record.id) || seen.has(record.id) || !outcomes.has(record.outcome) || !time(record.clickedAt) || !/^\d+\.\d+\.\d+$/.test(record.extensionVersion) || !score(record.score ?? null) || !score(record.scoreAtDecision ?? null)) throw new Error('AUDIT_RECORD_INVALID');
        seen.add(record.id);
        if (record.outcome === 'PENDING' ? record.decidedAt != null : !time(record.decidedAt) || record.decidedAt < record.clickedAt) throw new Error('AUDIT_DECISION_INVALID');
        const redacted = redactUrl(record.url);
        return {
            sourceEventId: record.id, clickedAt: record.clickedAt, decidedAt: record.decidedAt ?? null,
            extensionVersion: record.extensionVersion, ...redacted, outcome: record.outcome,
            score: record.score ?? null, scoreAtDecision: record.scoreAtDecision ?? null,
            providerAtDecision: providers.has(record.providerAtDecision) ? record.providerAtDecision : 'unknown',
            // Preserve the original verdict, but only within the known machine vocabulary.
            verdictAtDecision: ['CLEAN', 'MALICIOUS', 'MALICIOUS_VISUAL', 'SUSPICIOUS', 'UNKNOWN', 'ERROR', 'NOT_CHECKED'].includes(record.verdictAtDecision) ? record.verdictAtDecision : null
        };
    });
    return { schemaVersion: 1, kind: 'thundy-offline-audit-review', authenticatedSource: false,
        enterpriseActivated: false, sourceChecksum: checksum, records };
}
if (require.main === module) {
    try {
        if (process.argv.length !== 3) throw new Error('Usage: node enterprise/audit_import.cjs <local-export.json>');
        const file = process.argv[2], stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 3 * 1024 * 1024) throw new Error('AUDIT_INPUT_INVALID');
        process.stdout.write(JSON.stringify(reviewExport(JSON.parse(fs.readFileSync(file, 'utf8'))), null, 2) + '\n');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { reviewExport };
