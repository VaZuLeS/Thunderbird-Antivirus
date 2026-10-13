const fs = require('node:fs');
const crypto = require('node:crypto');
try {
    const file = process.argv[2];
    if (!file) throw new Error('Usage: node scripts/verify-link-audit-export.js <export.json>');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.payload?.schemaVersion !== 1 || !Array.isArray(data.payload.records) || !/^[a-f0-9]{64}$/.test(data.sha256 || '')) throw new Error('Invalid audit export schema');
    const digest = crypto.createHash('sha256').update(JSON.stringify(data.payload)).digest('hex');
    if (digest !== data.sha256) throw new Error('Checksum mismatch: export changed or damaged');
    console.log('Checksum verified: ' + data.payload.records.length + ' records, profile ' + data.payload.profileId);
    console.log('This unkeyed checksum does not authenticate the source or prove tamper resistance.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
