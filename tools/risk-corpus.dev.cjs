// Synthetic behavior contracts for the actual extension engine, not the web demo.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ URL, uiText: (_key, fallback, values = []) => fallback.replace(/\$(\d+)/g, (_, index) => String(values[index - 1])) });
vm.runInContext(fs.readFileSync(path.join(root, 'vendor/tldts.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'risk.js'), 'utf8'), context);
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'testdata/risk-behavior.json')));
const results = corpus.cases.map(item => {
    const result = context.calculateThreatScore(item.author, item.urls, item.options);
    const codes = Array.from(result.reasonDetails, reason => reason.code);
    assert.ok(result.score >= item.expect.minScore && result.score <= item.expect.maxScore, item.id + ': score outside behavior contract');
    if (item.expect.authStatus) assert.equal(result.authStatus, item.expect.authStatus, item.id);
    if (item.expect.reason) assert.ok(codes.includes(item.expect.reason), item.id + ': reason missing');
    return { id: item.id, passed: true, score: result.score, authStatus: result.authStatus, reasonCodes: codes };
});
// A private suffix must not merge unrelated tenants after a bundled PSL update.
assert.equal(context.getMainDomain('alice.github.io'), 'alice.github.io');
assert.equal(context.getMainDomain('bob.github.io'), 'bob.github.io');
console.log(JSON.stringify({ schemaVersion: 1, kind: 'thundy-synthetic-risk-corpus', generatedAt: new Date().toISOString(), scope: corpus.scope, sourceFingerprint: require('../scripts/candidate-evidence.js').sourceFingerprint(root), results, privateSuffixSeparation: true }, null, 2));
