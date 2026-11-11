// Bind real-client and browser evidence to the exact package and its source files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { ALLOWED_FILES, ALLOWED_PREFIXES, selectArtifact } = require('./verify-package.js');
const ROOT = path.resolve(__dirname, '..');
const languages = ['en', 'de', 'fr', 'es', 'it', 'pl'];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relevant = file => ALLOWED_FILES.includes(file) || ALLOWED_PREFIXES.some(prefix => file.startsWith(prefix));

function sourceEntries(root) {
    const entries = [];
    function visit(relative) {
        const absolute = path.join(root, relative);
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) throw new Error('Packaged symlink is not allowed: ' + relative);
        if (stat.isDirectory()) {
            for (const name of fs.readdirSync(absolute)) visit(relative + '/' + name);
        } else if (stat.isFile() && relevant(relative)) entries.push(relative);
    }
    for (const file of ALLOWED_FILES) if (fs.existsSync(path.join(root, file))) visit(file);
    for (const prefix of ALLOWED_PREFIXES) if (fs.existsSync(path.join(root, prefix))) visit(prefix.replace(/\/$/, ''));
    return [...new Set(entries)].sort().map(name => ({ name, sha256: sha256(fs.readFileSync(path.join(root, name))) }));
}
function sourceFingerprint(root = ROOT) { return sha256(JSON.stringify(sourceEntries(root))); }
function packageIdentity(root = ROOT) {
    const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version;
    const artifact = selectArtifact(path.join(root, 'build'));
    if (artifact && JSON.parse(execFileSync('unzip', ['-p', artifact, 'manifest.json'])).version !== version) throw new Error('Candidate version mismatch');
    if (!artifact) throw new Error('No candidate package');
    const names = execFileSync('unzip', ['-Z1', artifact], { encoding: 'utf8' }).trim().split('\n').filter(name => !name.endsWith('/')).sort();
    if (new Set(names).size !== names.length || names.some(name => !relevant(name))) throw new Error('Unexpected or duplicate package entries');
    const entries = names.map(name => ({ name, sha256: sha256(execFileSync('unzip', ['-p', artifact, name], { maxBuffer: 32 * 1024 * 1024 })) }));
    const fingerprint = sha256(JSON.stringify(entries));
    if (fingerprint !== sourceFingerprint(root)) throw new Error('Candidate package differs from working-tree source');
    return { extensionVersion: version, sourceFingerprint: fingerprint, packageSha256: sha256(fs.readFileSync(artifact)) };
}
function collectReports(directory) {
    const result = [];
    for (const name of fs.readdirSync(directory)) {
        const file = path.join(directory, name), stat = fs.lstatSync(file);
        if (stat.isSymbolicLink()) throw new Error('Evidence symlink is not allowed');
        if (stat.isDirectory()) result.push(...collectReports(file));
        else if (name === 'report.json') result.push(JSON.parse(fs.readFileSync(file)));
    }
    return result;
}
function historicalRecordsPreserved(report) {
    const previous = report.previousInstallation;
    const originals = [previous?.auditRecord, previous?.openedAuditRecord, previous?.blockedOsAuditRecord];
    if (originals.some(record => typeof record?.id !== 'string') || new Set(originals.map(record => record.id)).size !== 3 || !Array.isArray(report.finalAuditRecords)) return false;
    if (new Set(report.finalAuditRecords.map(record => record.id)).size !== report.finalAuditRecords.length) return false;
    return originals.every(original => {
        const current = report.finalAuditRecords.find(record => record.id === original.id);
        return current && Object.keys(current).length === Object.keys(original).length && Object.keys(original).every(key => JSON.stringify(current[key]) === JSON.stringify(original[key]));
    });
}
function validateReports(identity, thunderbird, browserUi) {
    // A summary is only a claim. Derive success from the actual runner rows and
    // require the complete expected case IDs for each language.
    const { matrix } = require('../tools/browser-ui.dev.cjs');
    const expected = matrix({ matrix: 'full', zoom: 1 }, ['alerts', 'capacity-alerts', 'capacity', 'cases', 'events', 'health', 'heartbeats', 'storage']);
    const versionParts=identity.extensionVersion.split('.').map(Number);
    if(versionParts[0]>1 || versionParts[0]===1 && (versionParts[1]>25 || versionParts[1]===25 && versionParts[2]>=1)) {
        const automatic=thunderbird.some(r=>r.passed===true&&!r.error&&r.extensionVersion===identity.extensionVersion&&r.xpiSha256===identity.packageSha256&&r.automaticScans?.passed===true&&r.automaticScans.bothProvidersWithoutLinkClick===true&&r.automaticScans.popupClosedDuringRetry===true&&r.automaticScans.duplicateDisplayReused===true&&r.automaticScans.unlisted===true&&r.automaticScans.syntheticTransport===true&&r.providerResults?.passed===true&&r.providerResults.partialMaliciousBlocks===true&&r.providerResults.terminalUnknownRetainsFinding===true&&r.providerResults.brandDoesNotEscalate===true&&r.providerResults.refreshWithoutSubmission===true&&r.providerResults.bothViewsAgree===true);
        if(!automatic)throw new Error('Missing package-bound automatic scan acceptance');
        if((versionParts[0]>1||versionParts[1]>25||versionParts[2]>=2)&&!thunderbird.some(r=>r.passed===true&&!r.error&&r.extensionVersion===identity.extensionVersion&&r.xpiSha256===identity.packageSha256&&r.providerResults?.hybridExpertDetails===true))throw new Error('Missing package-bound Hybrid expert detail acceptance');
        if((versionParts[0]>1||versionParts[1]>25||versionParts[2]>=3)&&!thunderbird.some(r=>r.passed===true&&!r.error&&r.extensionVersion===identity.extensionVersion&&r.xpiSha256===identity.packageSha256&&r.providerResults?.passed===true&&r.providerResults.actionScopedQuota===true&&r.providerResults.syntheticTransport===true))throw new Error('Missing package-bound urlscan action quota acceptance');
        if((versionParts[0]>1||versionParts[1]>25||versionParts[2]>=3)&&!thunderbird.some(r=>r.passed===true&&!r.error&&r.extensionVersion===identity.extensionVersion&&r.xpiSha256===identity.packageSha256&&r.scanCapacity?.passed===true&&r.scanCapacity.syntheticCoordinatorEnvironment===true&&r.scanCapacity.realThunderbirdEngine===true&&r.scanCapacity.retainedActive===200&&r.scanCapacity.deferredIsIncomplete===true&&r.scanCapacity.rejectedBeforePreparation===true&&r.scanCapacity.reuseAtCapacity===true&&r.scanCapacity.retryAfterCompletion===true))throw new Error('Missing package-bound scan capacity acceptance');
        if((versionParts[0]>1||versionParts[1]>25||versionParts[2]>=3)&&!thunderbird.some(r=>r.passed===true&&!r.error&&r.extensionVersion===identity.extensionVersion&&r.xpiSha256===identity.packageSha256&&r.inlineManualScan?.passed===true&&r.inlineManualScan.realThunderbirdAPIs===true&&r.inlineManualScan.syntheticTransport===true&&r.inlineManualScan.contextRenewed===true&&r.inlineManualScan.completed===true&&r.inlineManualScan.visibleCompletion===true&&r.inlineManualScan.submissions===1&&r.inlineManualScan.historicalAuditUnchanged===true))throw new Error('Missing package-bound inline manual scan acceptance');
        if((versionParts[0]>1||versionParts[1]>25||versionParts[2]>=2)&&!thunderbird.some(r=>r.passed===true&&!r.error&&r.extensionVersion===identity.extensionVersion&&r.xpiSha256===identity.packageSha256&&r.administration?.passed===true&&r.administration.protectedDisplaySettings===true))throw new Error('Missing package-bound protected display settings acceptance');
    }
    if(versionParts[0]>1||versionParts[0]===1&&(versionParts[1]>25||versionParts[1]===25&&versionParts[2]>=4)) {
        for(const target of ['minimum','current']) {
            const matches=r=>r.passed===true&&!r.error&&r.extensionVersion===identity.extensionVersion&&r.xpiSha256===identity.packageSha256&&r.clientMatrixTarget===target&&r.client?.capabilities?.browserName==='thunderbird';
            const inline=r=>r?.passed===true&&r.realThunderbirdAPIs===true&&r.syntheticTransport===true&&r.liveProviderCalls===false&&r.completed===true&&r.visibleCompletion===true&&r.submissions===1&&r.historicalAuditUnchanged===true;
            if(!thunderbird.some(r=>matches(r)&&inline(r.inlineFreshManualScan)&&r.inlineFreshManualScan.contextRenewed===false))throw Error('Missing fresh inline scan acceptance: '+target);
            if(!thunderbird.some(r=>matches(r)&&inline(r.inlineManualScan)&&r.inlineManualScan.contextRenewed===true))throw Error('Missing renewed inline scan acceptance: '+target);
            if(!thunderbird.some(r=>matches(r)&&r.scanCoverage?.passed===true&&r.scanCoverage.baselineObserved===false&&r.scanCoverage.realThunderbirdAPIs===true&&r.scanCoverage.syntheticTransport===true&&r.scanCoverage.injectedInventoryFailure===true&&r.scanCoverage.liveProviderCalls===false&&r.scanCoverage.state==='incomplete'&&r.scanCoverage.assessmentIncomplete===true&&r.scanCoverage.coverage?.attachments?.readFailed===1&&r.scanCoverage.visibleState===true&&r.scanCoverage.visiblePopup===true&&r.scanCoverage.sourceCapacityPreserved===true&&r.scanCoverage.sourceCapacityReason==='source_capacity'))throw Error('Missing scan coverage acceptance: '+target);
            if((versionParts[0]>1||versionParts[1]>25||versionParts[2]>=6)&&!thunderbird.some(r=>matches(r)&&r.hybridStoredRefresh?.liveProviderCalls===false&&['passed','realThunderbirdAPIs','realIndexedDB','syntheticProviderPayload','pendingAdvanced','sameContext','messageView','popupView','capacityReasonVisible','historyPreserved','auditPreserved','readCountersStable'].every(key=>r.hybridStoredRefresh?.[key]===true)))throw Error('Missing stored Hybrid result refresh acceptance: '+target);
            if(!thunderbird.some(r=>matches(r)&&r.cryptoContent?.passed===true&&r.cryptoContent.synthetic===true&&r.cryptoContent.realThunderbirdAPIs===true&&r.cryptoContent.liveProviderCalls===false&&['openpgpDecrypted','smimeSignedReadable','smimeEnvelopeConservative','attachmentBytesVerified'].every(key=>r.cryptoContent[key]===true)))throw Error('Missing crypto input acceptance: '+target);
        }
    }
    for (const lang of languages) {
        const validUpgrade = report => {
            const language = report.uiLanguage || report.currentRestart?.uiLanguage;
            const pending = report.pendingCrashRecovery;
            const current = report.currentRestart;
            return language?.split('-')[0] === lang && report.passed === true && !report.error && report.extensionVersion === identity.extensionVersion && report.xpiSha256 === identity.packageSha256 &&
                report.client?.capabilities?.browserName === 'thunderbird' && Number.isInteger(report.gracefulRestarts) && report.gracefulRestarts >= 2 && Number.isInteger(report.forcedRestarts) && report.forcedRestarts >= 2 && historicalRecordsPreserved(report) &&
                report.previousRestart?.storagePreserved === true && current?.storagePreserved === true && current.addon?.version === identity.extensionVersion && current.addon.active === true &&
                report.previousRestart?.addon?.version === report.previousInstallation?.extensionVersion && report.previousRestart.addon.version !== identity.extensionVersion && current.auditRecordsPreserved >= 3 &&
                report.acknowledgedCrashRecovery?.storagePreserved === true && report.acknowledgedCrashRecovery.extraOsDispatches === 0 &&
                pending?.storagePreserved === true && pending.decisionNotInvented === true && pending.extraOsDispatches === 0 &&
                pending.record?.outcome === 'PENDING' && pending.record.decidedAt === null && pending.record.openAttempts === 0 &&
                Array.isArray(report.finalAuditRecords) && report.finalAuditRecords.some(record => record.id === pending.record.id && record.outcome === 'PENDING' && record.decidedAt === null);
        };
        if(versionParts[0]>1||versionParts[0]===1&&(versionParts[1]>25||versionParts[1]===25&&versionParts[2]>=5)) {
            for(const target of ['minimum','current']) {
                const flags=['passed','realThunderbirdAPIs','realDownloadsAPI','nativeFilePicker','exportedSavedPolicy','explicitUiImport','previewReadOnly','cancelPreserved','unrelatedDataPreserved','v1Compatible','noConsentOrPermissionGrant','noProviderRequests','appearanceProfileCompatible'];
                if(!thunderbird.some(r=>validUpgrade(r)&&r.clientMatrixTarget===target&&flags.every(key=>r.protectionProfile?.[key]===true)))throw Error('Missing native protection profile acceptance: '+target+'/'+lang);
            }
        }
        const tb = thunderbird.find(validUpgrade);
        if (!tb) throw new Error('Missing package-bound real Thunderbird upgrade/crash evidence: ' + lang);
        if(versionParts[0]>1||versionParts[0]===1&&(versionParts[1]>25||versionParts[1]===25&&versionParts[2]>=3)) {
            for(const target of ['minimum','current']) {
                if(!thunderbird.some(report=>validUpgrade(report)&&report.clientMatrixTarget===target&&
                    /^\d+\./.test(report.client?.capabilities?.browserVersion||'')&&
                    (target==='minimum'?parseInt(report.client.capabilities.browserVersion,10)===140:parseInt(report.client.capabilities.browserVersion,10)>=140)))throw new Error('Missing client matrix upgrade/crash evidence: '+target+'/'+lang);
            }
        }
        const complete = browserUi.some(report => {
            if (report.schemaVersion !== 1 || report.kind !== 'thundy-browser-ui-check' || report.fatalError || report.sourceFingerprint !== identity.sourceFingerprint || report.view !== 'all' || (report.cssZoom ?? 1) !== 1 || report.matrix !== 'full' || !Array.isArray(report.results)) return false;
            const rows = report.results;
            if (!rows.length || report.failed !== 0 || report.passed !== rows.length || report.planned !== rows.length || rows.some(row => row.status !== 'passed' || row.error || row.errors?.length || row.violations?.length)) return false;
            if (new Set(rows.map(row => row.id)).size !== rows.length) return false;
            const scope = report.language === 'all' ? languages : [report.language];
            if (!scope.includes(lang) || scope.some(value => !languages.includes(value))) return false;
            const wanted = expected.filter(row => scope.includes(row.lang));
            return wanted.length === rows.length && wanted.every(want => rows.some(row => row.id === want.id && ['lang', 'view', 'kind', 'width', 'scheme', 'state', 'populated', 'url', 'scenario', 'density'].every(key => row[key] === want[key])));
        });
        if (!complete) throw new Error('Missing complete browser UI evidence: ' + lang);
    }
}

function evidenceFile(root = ROOT) {
    const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version;
    return path.join(root, 'docs', 'audits', 'candidate-' + version.replaceAll('.', '_') + '.json');
}
function verifyEvidence(root = ROOT) {
    try {
        const evidence = JSON.parse(fs.readFileSync(evidenceFile(root)));
        const identity = packageIdentity(root);
        if (evidence.schemaVersion !== 1 || Object.keys(identity).some(key => evidence[key] !== identity[key])) throw new Error('Evidence/package/source identity mismatch');
        validateReports(identity, evidence.thunderbird, evidence.browserUi);
        return { ok: true, evidence: 'Package SHA-256 ' + identity.packageSha256 + '; real upgrade/crash and browser UI reports for all six languages' };
    } catch (error) { return { ok: false, evidence: error.message }; }
}
function writeEvidence(root, liveDirectory, uiDirectory) {
    const identity = packageIdentity(root), thunderbird = collectReports(liveDirectory), browserUi = collectReports(uiDirectory);
    validateReports(identity, thunderbird, browserUi);
    // Remove transient profile identifiers and original paths from durable reports.
    const clean = value => JSON.parse(JSON.stringify(value, (key, item) => ['moz:profile', 'moz:processID', 'sessionId'].includes(key) ? undefined : item));
    const evidence = { schemaVersion: 1, generatedAt: new Date().toISOString(), ...identity, thunderbird: clean(thunderbird), browserUi: clean(browserUi) };
    fs.writeFileSync(evidenceFile(root), JSON.stringify(evidence, null, 2) + '\n');
    return evidenceFile(root);
}
if (require.main === module) {
    if (process.argv[2] === '--write' && process.argv.length === 5) console.log(writeEvidence(ROOT, path.resolve(process.argv[3]), path.resolve(process.argv[4])));
    else { const result = verifyEvidence(); console.log(JSON.stringify(result)); process.exitCode = result.ok ? 0 : 1; }
}
module.exports = { sourceFingerprint, packageIdentity, validateReports, verifyEvidence, writeEvidence, languages };
