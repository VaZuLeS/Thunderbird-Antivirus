const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { validateReports, packageIdentity, languages } = require('./candidate-evidence.js');
const { releaseTagState } = require('./submission-gate.js');
const { publish } = require('./publish-release.js');

test('all six real-client upgrade/crash reports and browser reports must match the candidate', () => {
    const identity = { extensionVersion: '1.24.3', packageSha256: 'package', sourceFingerprint: 'source' };
    const live = languages.map(lang => ({ extensionVersion: identity.extensionVersion, xpiSha256: 'package', uiLanguage: lang, passed: true, gracefulRestarts: 2, forcedRestarts: 2, client: { capabilities: { browserName: 'thunderbird' } },
        previousInstallation: { extensionVersion: '1.24.2', auditRecord: { id:'old-abort', outcome:'ABORTED', scoreAtDecision:12 }, openedAuditRecord: { id:'old-open', outcome:'OPENED', scoreAtDecision:0 }, blockedOsAuditRecord: { id:'old-blocked', outcome:'OPENED', scoreAtDecision:0 } }, previousRestart: { storagePreserved: true, addon: { version: '1.24.2' } },
        currentRestart: { storagePreserved: true, auditRecordsPreserved: 3, addon: { version: '1.24.3', active: true } },
        acknowledgedCrashRecovery: { storagePreserved: true, extraOsDispatches: 0 },
        pendingCrashRecovery: { storagePreserved: true, decisionNotInvented: true, extraOsDispatches: 0, record: { id: 'pending', outcome: 'PENDING', decidedAt: null, openAttempts: 0 } },
        finalAuditRecords: [{ id:'old-abort', outcome:'ABORTED', scoreAtDecision:12 }, { id:'old-open', outcome:'OPENED', scoreAtDecision:0 }, { id:'old-blocked', outcome:'OPENED', scoreAtDecision:0 }, { id: 'pending', outcome: 'PENDING', decidedAt: null }]
    }));
    const results = require('../tools/browser-ui.dev.cjs').matrix({ matrix: 'full', zoom: 1 }, ['alerts', 'capacity-alerts', 'capacity', 'cases', 'events', 'health', 'heartbeats', 'storage']).map(row => ({ ...row, status: 'passed' }));
    const ui = [{ schemaVersion: 1, kind: 'thundy-browser-ui-check', language: 'all', sourceFingerprint: 'source', view: 'all', failed: 0, passed: results.length, planned: results.length, matrix: 'full', results }];
    validateReports(identity, live, ui);
    assert.throws(() => validateReports(identity, live.slice(1), ui), /en/);
    assert.throws(() => validateReports(identity, live.map(report => ({ ...report, xpiSha256: 'older' })), ui), /real Thunderbird/);
    assert.throws(() => validateReports(identity, live, [{ ...ui[0], sourceFingerprint: 'older' }]), /browser UI/);
    assert.throws(() => validateReports(identity, live, [{ ...ui[0], matrix: 'smoke' }]), /browser UI/);
    assert.throws(() => validateReports(identity, live, [{ ...ui[0], failed: 1 }]), /browser UI/);
    for (const mutate of [
        r => { r.results[0].status = 'failed'; },
        r => { r.results[0].error = 'runner error despite passed summary'; },
        r => { const row=r.results.find(row=>row.populated); row.populated=false; },
        r => { r.results[0].status = 'skipped'; },
        r => { r.passed = 1; r.planned = 1; },
        r => { r.results.pop(); r.passed--; r.planned--; },
        r => { r.results[0] = r.results[1]; },
        r => { r.results[0].lang = 'xx'; },
    ]) { const bad = JSON.parse(JSON.stringify(ui)); mutate(bad[0]); assert.throws(() => validateReports(identity, live, bad), /browser UI/); }
    for (const mutate of [
        r => { delete r.pendingCrashRecovery; },
        r => { r.pendingCrashRecovery.record.outcome = 'OPENED'; },
        r => { r.acknowledgedCrashRecovery.extraOsDispatches = 1; },
        r => { r.currentRestart.storagePreserved = false; },
        r => { r.finalAuditRecords[0].scoreAtDecision = 99; },
    ]) { const bad = JSON.parse(JSON.stringify(live)); mutate(bad[0]); assert.throws(() => validateReports(identity, bad, ui), /real Thunderbird/); }

});

test('a package cannot be validated against changed working-tree source', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-package-'));
    try {
        fs.mkdirSync(path.join(root, 'build'));
        fs.writeFileSync(path.join(root, 'manifest.json'), '{"version":"1.24.3"}');
        execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],"w"); z.write(sys.argv[2],"manifest.json"); z.close()', path.join(root, 'build/test-1.24.3.zip'), path.join(root, 'manifest.json')]);
        assert.equal(packageIdentity(root).extensionVersion, '1.24.3');
        fs.writeFileSync(path.join(root, 'manifest.json'), '{"version":"1.24.3","changed":true}');
        assert.throws(() => packageIdentity(root), /differs/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a release tag at HEAD does not excuse staged or untracked package changes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-tag-'));
    const git = args => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: root, stdio: 'pipe' });
    try {
        git(['init']); fs.writeFileSync(path.join(root, 'manifest.json'), '{}');
        git(['add', '.']); git(['commit', '-m', 'fixture']); git(['tag', 'v1.24.3']);
        assert.deepEqual(releaseTagState('1.24.3', root).changedArtifacts, []);
        fs.writeFileSync(path.join(root, 'manifest.json'), '{"changed":true}'); git(['add', '.']);
        fs.writeFileSync(path.join(root, 'audit.js'), '// untracked package code');
        const state = releaseTagState('1.24.3', root);
        assert.equal(state.atHead, true);
        assert.deepEqual(state.dirtyArtifacts.sort(), ['audit.js', 'manifest.json']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

function releaseFixture(operation) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-publish-'));
    try {
        fs.mkdirSync(path.join(root, 'build'));
        const name = 'thundy-av-1.24.3.xpi', bytes = Buffer.from('tested archive');
        fs.writeFileSync(path.join(root, 'build', name), bytes);
        fs.writeFileSync(path.join(root, 'build/SHA256SUMS.txt'), crypto.createHash('sha256').update(bytes).digest('hex') + '  ' + name + '\n');
        operation({ root, name, tag: 'v1.24.3', version: '1.24.3', repository: 'example/repository' });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test('repeating publication verifies existing bytes without upload or clobber', () => releaseFixture(options => {
    const calls = [];
    const result = publish({ ...options, run: args => {
        calls.push(args);
        if (args[0] === 'api') return { status: 0, stdout: JSON.stringify({ tag_name: options.tag, draft: false, prerelease: false, assets: [{ name: options.name }, { name: 'SHA256SUMS.txt' }] }) };
        const directory = args[args.indexOf('--dir') + 1];
        for (const name of [options.name, 'SHA256SUMS.txt']) fs.copyFileSync(path.join(options.root, 'build', name), path.join(directory, name));
        return { status: 0 };
    } });
    assert.match(result, /identical/);
    assert.equal(calls.length, 2);
    assert.equal(calls[1][1], 'download');
}));
test('publication fails closed on status/auth errors and does not try to create', () => releaseFixture(options => {
    let calls = 0;
    assert.throws(() => publish({ ...options, run: () => { calls++; return { status: 1, stderr: 'HTTP 403' }; } }), /Cannot determine/);
    assert.equal(calls, 1);
}));
test('publication refuses mismatched existing asset bytes', () => releaseFixture(options => {
    assert.throws(() => publish({ ...options, run: args => {
        if (args[0] === 'api') return { status: 0, stdout: JSON.stringify({ tag_name: options.tag, draft: false, prerelease: false, assets: [{ name: options.name }, { name: 'SHA256SUMS.txt' }] }) };
        const directory = args[args.indexOf('--dir') + 1];
        for (const name of [options.name, 'SHA256SUMS.txt']) fs.writeFileSync(path.join(directory, name), 'different');
        return { status: 0 };
    } }), /published bytes differ/);
}));

test('1.25.2 requires package-bound native Hybrid expert detail evidence',()=>{
 const identity={extensionVersion:'1.25.2',packageSha256:'a'.repeat(64)};
 const report={passed:true,extensionVersion:identity.extensionVersion,xpiSha256:identity.packageSha256,automaticScans:{passed:true,bothProvidersWithoutLinkClick:true,popupClosedDuringRetry:true,duplicateDisplayReused:true,unlisted:true,syntheticTransport:true},providerResults:{passed:true,partialMaliciousBlocks:true,terminalUnknownRetainsFinding:true,brandDoesNotEscalate:true,refreshWithoutSubmission:true,bothViewsAgree:true}};
 assert.throws(()=>validateReports(identity,[report],[]),/Hybrid expert detail/);
 assert.throws(()=>validateReports(identity,[report,{...report,xpiSha256:'b'.repeat(64),providerResults:{hybridExpertDetails:true}}],[]),/Hybrid expert detail/);
 assert.throws(()=>validateReports(identity,[{...report,providerResults:{...report.providerResults,hybridExpertDetails:true}}],[]),/real Thunderbird/);
});
