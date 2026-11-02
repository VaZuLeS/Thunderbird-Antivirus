/* Read-only diagnostic for the planning report. Synthetic APIs; no provider calls. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
process.chdir(root);
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('runtime.js', 'utf8') + '\nglobalThis.Cache = ExpiringMap;', context);
let now = 0;
const cache = new context.Cache(10, () => now);
for (let i = 0; i < 100; i++) cache.set('message-' + i, {});
now = 11;
const ttl = { experiment: 'expired-context-iteration', expiredEntriesStillInSize: cache.size, expiredEntriesStillInValues: [...cache.values()].length };
ttl.checkedKeyPresent = cache.has('message-0');
ttl.remainingAfterCheckingOneKey = cache.size;
// Reuse the repository's existing VM fixture without registering its tests.
const source = fs.readFileSync('test/optimization.test.js', 'utf8').split('\ntest(')[0];
const fixture = new Module(path.join(root, 'test/planning-diagnostic.cjs'), module);
fixture.filename = path.join(root, 'test/planning-diagnostic.cjs');
fixture.paths = Module._nodeModulePaths(root);
fixture._compile(source + '\nmodule.exports = setup;', fixture.filename);
(async () => {
    const state = fixture.exports({}, true);
    await state.context.configure();
    const record = {
        messageHeader: state.message.headerMessageId,
        analysisStatusOwner: 7,
        analysisStatusByMessage: { 7: { schemaVersion: 2, local: { state: 'checked' }, rows: [] } },
        attachments: [{ partName: '1.2', attachment_name: 'from-message-A.txt' }],
        links: [{ url: 'https://message-a.invalid/private' }]
    };
    state.context.getFromStore = async () => record;
    const other = await state.context.getMessageAnalysisContext({ ...state.message, id: 8, subject: 'Message B' });
    const snapshot = await other.snapshot();
    console.log(JSON.stringify({
        synthetic: true,
        ttl,
        ownership: { experiment: 'foreign-owner-resource-labels', messageId: snapshot.messageId, rows: snapshot.rows.length, resourceLabels: snapshot.resourceLabels }
    }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
