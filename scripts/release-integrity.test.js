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

function acceptanceFixture(identity) {
    const live = languages.map(lang => ({ extensionVersion: identity.extensionVersion, xpiSha256: identity.packageSha256, uiLanguage: lang, passed: true, gracefulRestarts: 2, forcedRestarts: 2, client: { capabilities: { browserName: 'thunderbird' } },
        previousInstallation: { extensionVersion: '1.24.2', auditRecord: { id:'old-abort', outcome:'ABORTED', scoreAtDecision:12 }, openedAuditRecord: { id:'old-open', outcome:'OPENED', scoreAtDecision:0 }, blockedOsAuditRecord: { id:'old-blocked', outcome:'OPENED', scoreAtDecision:0 } }, previousRestart: { storagePreserved: true, addon: { version: '1.24.2' } },
        currentRestart: { storagePreserved: true, auditRecordsPreserved: 3, addon: { version: identity.extensionVersion, active: true } },
        acknowledgedCrashRecovery: { storagePreserved: true, extraOsDispatches: 0 },
        pendingCrashRecovery: { storagePreserved: true, decisionNotInvented: true, extraOsDispatches: 0, record: { id: 'pending', outcome: 'PENDING', decidedAt: null, openAttempts: 0 } },
        finalAuditRecords: [{ id:'old-abort', outcome:'ABORTED', scoreAtDecision:12 }, { id:'old-open', outcome:'OPENED', scoreAtDecision:0 }, { id:'old-blocked', outcome:'OPENED', scoreAtDecision:0 }, { id: 'pending', outcome: 'PENDING', decidedAt: null }]
    }));
    const results = require('../tools/browser-ui.dev.cjs').matrix({ matrix: 'full', zoom: 1 }, ['alerts', 'capacity-alerts', 'capacity', 'cases', 'events', 'health', 'heartbeats', 'storage']).map(row => ({ ...row, status: 'passed' }));
    const ui = [{ schemaVersion: 1, kind: 'thundy-browser-ui-check', language: 'all', sourceFingerprint: identity.sourceFingerprint, view: 'all', failed: 0, passed: results.length, planned: results.length, matrix: 'full', results }];
    return {live,ui};
}

test('all six real-client upgrade/crash reports and browser reports must match the candidate', () => {
    const identity = { extensionVersion: '1.24.3', packageSha256: 'package', sourceFingerprint: 'source' };
    const {live,ui}=acceptanceFixture(identity);
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
        r => { r.results.find(row=>row.scenario).scenario='not-tested'; },
        r => { r.results.find(row=>row.density).density='not-tested'; },
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
        const identity={extensionVersion:'1.24.3',packageSha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceFingerprint:'source'};
        const {live,ui}=acceptanceFixture(identity);
        fs.writeFileSync(path.join(root,'build/acceptance-1.24.3.json'),JSON.stringify(require('./release-evidence.js').create(identity,live,ui,'fixture-commit')));
        operation({ root, name, tag: 'v1.24.3', version: '1.24.3', repository: 'example/repository' });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test('repeating publication verifies existing bytes without upload or clobber', () => releaseFixture(options => {
    const calls = [];
    const result = publish({ ...options, run: args => {
        calls.push(args);
        if (args[0] === 'api') return { status: 0, stdout: JSON.stringify({ tag_name: options.tag, draft: false, prerelease: false, assets: [{ name: options.name }, { name: 'SHA256SUMS.txt' }, {name:'acceptance-1.24.3.json'}] }) };
        const directory = args[args.indexOf('--dir') + 1];
        for (const name of [options.name, 'SHA256SUMS.txt', 'acceptance-1.24.3.json']) fs.copyFileSync(path.join(options.root, 'build', name), path.join(directory, name));
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
        if (args[0] === 'api') return { status: 0, stdout: JSON.stringify({ tag_name: options.tag, draft: false, prerelease: false, assets: [{ name: options.name }, { name: 'SHA256SUMS.txt' }, {name:'acceptance-1.24.3.json'}] }) };
        const directory = args[args.indexOf('--dir') + 1];
        for (const name of [options.name, 'SHA256SUMS.txt', 'acceptance-1.24.3.json']) fs.writeFileSync(path.join(directory, name), 'different');
        return { status: 0 };
    } }), /published bytes differ/);
}));

test('1.25.2 requires package-bound native Hybrid expert detail evidence',()=>{
 const identity={extensionVersion:'1.25.2',packageSha256:'a'.repeat(64)};
 const report={passed:true,extensionVersion:identity.extensionVersion,xpiSha256:identity.packageSha256,automaticScans:{passed:true,bothProvidersWithoutLinkClick:true,popupClosedDuringRetry:true,duplicateDisplayReused:true,unlisted:true,syntheticTransport:true},providerResults:{passed:true,partialMaliciousBlocks:true,terminalUnknownRetainsFinding:true,brandDoesNotEscalate:true,refreshWithoutSubmission:true,bothViewsAgree:true}};
 assert.throws(()=>validateReports(identity,[report],[]),/Hybrid expert detail/);
 assert.throws(()=>validateReports(identity,[report,{...report,xpiSha256:'b'.repeat(64),providerResults:{hybridExpertDetails:true}}],[]),/Hybrid expert detail/);
 const detailed={...report,providerResults:{...report.providerResults,hybridExpertDetails:true}};
 assert.throws(()=>validateReports(identity,[detailed],[]),/protected display settings/);
 assert.throws(()=>validateReports(identity,[detailed,{...report,xpiSha256:'b'.repeat(64),administration:{passed:true,protectedDisplaySettings:true}}],[]),/protected display settings/);
 assert.throws(()=>validateReports(identity,[{...detailed,administration:{passed:true,protectedDisplaySettings:true}}],[]),/real Thunderbird/);
});

test('1.25.3 requires package-bound synthetic urlscan action quota acceptance',()=>{
 const identity={extensionVersion:'1.25.3',packageSha256:'a'.repeat(64)};
 const report={passed:true,extensionVersion:identity.extensionVersion,xpiSha256:identity.packageSha256,automaticScans:{passed:true,bothProvidersWithoutLinkClick:true,popupClosedDuringRetry:true,duplicateDisplayReused:true,unlisted:true,syntheticTransport:true},providerResults:{passed:true,partialMaliciousBlocks:true,terminalUnknownRetainsFinding:true,brandDoesNotEscalate:true,refreshWithoutSubmission:true,bothViewsAgree:true,hybridExpertDetails:true},administration:{passed:true,protectedDisplaySettings:true}};
 assert.throws(()=>validateReports(identity,[report],[]),/urlscan action quota/);
 const quota={...report,providerResults:{...report.providerResults,actionScopedQuota:true,syntheticTransport:true}};
 assert.throws(()=>validateReports(identity,[report,{...quota,xpiSha256:'b'.repeat(64)}],[]),/urlscan action quota/);
 assert.throws(()=>validateReports(identity,[{...quota,providerResults:{...quota.providerResults,syntheticTransport:false}}],[]),/urlscan action quota/);
 assert.throws(()=>validateReports(identity,[quota],[]),/scan capacity/);
 const capacity={passed:true,syntheticCoordinatorEnvironment:true,realThunderbirdEngine:true,retainedActive:200,deferredIsIncomplete:true,rejectedBeforePreparation:true,reuseAtCapacity:true,retryAfterCompletion:true};
 assert.throws(()=>validateReports(identity,[quota,{...quota,xpiSha256:'b'.repeat(64),scanCapacity:capacity}],[]),/scan capacity/);
 const inline={passed:true,realThunderbirdAPIs:true,syntheticTransport:true,contextRenewed:true,completed:true,visibleCompletion:true,submissions:1,historicalAuditUnchanged:true};
 assert.throws(()=>validateReports(identity,[{...quota,scanCapacity:capacity}],[]),/inline manual scan/);
 assert.throws(()=>validateReports(identity,[{...quota,scanCapacity:capacity},{...quota,xpiSha256:'wrong',inlineManualScan:inline}],[]),/inline manual scan/);
 assert.throws(()=>validateReports(identity,[{...quota,scanCapacity:capacity,inlineManualScan:{...inline,submissions:2}}],[]),/inline manual scan/);
 assert.throws(()=>validateReports(identity,[{...quota,scanCapacity:capacity,inlineManualScan:inline}],[]),/real Thunderbird/);
});


test('durable release proof rejects raw failures before redaction and preserves historical equality without URLs',()=>{
 const identity={extensionVersion:'1.24.3',packageSha256:'a'.repeat(64),sourceFingerprint:'b'.repeat(64)}, {live,ui}=acceptanceFixture(identity),api=require('./release-evidence.js');
 live[0].storageLifecycle={passed:true,realThunderbirdAPIs:true,database:{atomicPreserved:true,abortError:'CANARY'},audit:{originalsPreserved:true,count:2000,records:['CANARY']},profileRestore:{passed:true,path:'CANARY'},scope:'CANARY'};
 live[0].client.capabilities.browserVersion='CANARY';live[0].providerResults={CANARY:true};
 live[0].previousInstallation.auditRecord.url='https://private.invalid/?token=CANARY';
 live[0].finalAuditRecords[0].url=live[0].previousInstallation.auditRecord.url;
 live[0].finalAuditRecords[0]=Object.fromEntries(Object.entries(live[0].finalAuditRecords[0]).reverse());
 const proof=api.create(identity,live,ui,'fixture');assert.equal(proof.thunderbird[0].storageLifecycle.database.atomicPreserved,true);assert.equal(proof.thunderbird[0].storageLifecycle.audit.count,2000);assert.ok(!JSON.stringify(proof).includes('CANARY'));assert.ok(api.verify(proof,identity));
 assert.throws(()=>api.verify(proof,{...identity,packageSha256:'wrong'}),/identity/);
 live[0].storageLifecycle.passed=false;assert.throws(()=>api.create(identity,live,ui,'fixture'),/failed release evidence/);live[0].storageLifecycle.passed=true;
 live[0].finalAuditRecords[0].url='https://changed.invalid/';assert.throws(()=>api.create(identity,live,ui,'fixture'),/real Thunderbird/);
 live[0].finalAuditRecords[0].url=live[0].previousInstallation.auditRecord.url;
 assert.throws(()=>api.create(identity,[...live,{...live[0],error:'CANARY'}],ui,'fixture'),/failed release evidence/);
 ui[0].fatalError='CANARY';assert.throws(()=>api.create(identity,live,ui,'fixture'),/failed release evidence/);
});

test('new candidates require six-language upgrade/crash proof for both declared client targets',()=>{
 const identity={extensionVersion:'1.25.3',packageSha256:'a'.repeat(64),sourceFingerprint:'b'.repeat(64)}, {live,ui}=acceptanceFixture(identity);
 for(const report of live) {
  report.automaticScans={passed:true,bothProvidersWithoutLinkClick:true,popupClosedDuringRetry:true,duplicateDisplayReused:true,unlisted:true,syntheticTransport:true};
  report.providerResults={passed:true,partialMaliciousBlocks:true,terminalUnknownRetainsFinding:true,brandDoesNotEscalate:true,refreshWithoutSubmission:true,bothViewsAgree:true,hybridExpertDetails:true,actionScopedQuota:true,syntheticTransport:true};
  report.scanCapacity={passed:true,syntheticCoordinatorEnvironment:true,realThunderbirdEngine:true,retainedActive:200,deferredIsIncomplete:true,rejectedBeforePreparation:true,reuseAtCapacity:true,retryAfterCompletion:true};
  report.administration={passed:true,protectedDisplaySettings:true};
  report.inlineManualScan={passed:true,realThunderbirdAPIs:true,syntheticTransport:true,contextRenewed:true,completed:true,visibleCompletion:true,submissions:1,historicalAuditUnchanged:true};
 }
 assert.throws(()=>validateReports(identity,live,ui),/client matrix/);
 const matrix=live.flatMap(report=>['minimum','current'].map(target=>({...structuredClone(report),clientMatrixTarget:target,client:{capabilities:{browserName:'thunderbird',browserVersion:target==='minimum'?'140.12.0':'153.6.0'}}})));
 validateReports(identity,matrix,ui);
 for(const mutate of [rows=>rows.pop(),rows=>{rows[1].clientMatrixTarget='minimum';},rows=>{rows[0].client.capabilities.browserVersion='141.0';},rows=>{rows[1].xpiSha256='wrong';}]) {
  const broken=structuredClone(matrix);mutate(broken);assert.throws(()=>validateReports(identity,broken,ui),/client matrix/);
 }
 const api=require('./release-evidence.js'),proof=api.create(identity,matrix,ui,'fixture');assert.ok(api.verify(proof,identity));
 const next={...identity,extensionVersion:'1.25.4'},reports=structuredClone(matrix);
 for(const r of reports){r.extensionVersion=next.extensionVersion;r.currentRestart.addon.version=next.extensionVersion;r.inlineManualScan.liveProviderCalls=false;}
 assert.throws(()=>validateReports(next,reports,ui),/fresh inline/);
 for(const r of reports){
  r.inlineFreshManualScan={...r.inlineManualScan,contextRenewed:false};
  r.cryptoContent={passed:true,synthetic:true,realThunderbirdAPIs:true,liveProviderCalls:false,openpgpDecrypted:true,smimeSignedReadable:true,smimeEnvelopeConservative:true,attachmentBytesVerified:true};
  r.scanCoverage={passed:true,baselineObserved:false,realThunderbirdAPIs:true,syntheticTransport:true,injectedInventoryFailure:true,liveProviderCalls:false,state:'incomplete',assessmentIncomplete:true,coverage:{attachments:{readFailed:1,secret:'CANARY'}},visibleState:true,visiblePopup:true,sourceCapacityPreserved:true,sourceCapacityReason:'source_capacity'};
 }
 validateReports(next,reports,ui);
 for(const mutate of [r=>{delete r.inlineFreshManualScan;},r=>{r.inlineFreshManualScan.contextRenewed=true;},r=>{r.inlineFreshManualScan.submissions=2;},r=>{delete r.cryptoContent;},r=>{r.cryptoContent.attachmentBytesVerified=false;},r=>{delete r.scanCoverage;},r=>{r.scanCoverage.visiblePopup=false;},r=>{r.scanCoverage.sourceCapacityPreserved=false;},r=>{r.scanCoverage.coverage.attachments.readFailed=0;}]){
  const broken=structuredClone(reports);for(const r of broken.filter(r=>r.clientMatrixTarget==='current'))mutate(r);
  assert.throws(()=>validateReports(next,broken,ui),/inline|coverage|crypto/);
 }
 const nextProof=api.create(next,reports,ui,'fixture');assert.ok(api.verify(nextProof,next));assert.ok(!JSON.stringify(nextProof).includes('CANARY'));
});
