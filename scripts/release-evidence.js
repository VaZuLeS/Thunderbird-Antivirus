// Durable, allowlisted proof of the existing candidate gate, without profiles or URLs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {validateReports,packageIdentity,languages}=require('./candidate-evidence.js');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
const booleans=(value,keys)=>Object.fromEntries(keys.filter(key=>typeof value?.[key]==='boolean').map(key=>[key,value[key]]));
const version=value=>typeof value==='string'&&/^\d+(?:\.\d+){0,3}(?:[a-z]\d*)?(?:esr)?$/i.test(value)?value:undefined;
const language=value=>languages.includes(value?.split('-')[0])?value.split('-')[0]:undefined;
function audit(record) {
    if(!record)return undefined;
    return {outcome:['PENDING','OPENED','OPEN_ERROR','ABORTED'].includes(record.outcome)?record.outcome:null,decidedAt:Number.isFinite(record.decidedAt)?record.decidedAt:null,...(Number.isSafeInteger(record.openAttempts)?{openAttempts:record.openAttempts}:{}),id:hash(record.id),recordSha256:hash(Object.fromEntries(Object.keys(record).sort().map(key=>[key,record[key]])))};
}
function native(report) {
    const restart=value=>value?{...pick(value,['storagePreserved','auditRecordsPreserved']),uiLanguage:language(value.uiLanguage),addon:{version:version(value.addon?.version),...(typeof value.addon?.active==='boolean'?{active:value.addon.active}:{})}}:undefined;
    const recovery=value=>value?{...pick(value,['storagePreserved','decisionNotInvented','extraOsDispatches']),...(value.record?{record:audit(value.record)}:{})}:undefined;
    return {...pick(report,['extensionVersion','xpiSha256','passed','gracefulRestarts','forcedRestarts']),
        clientMatrixTarget:['minimum','current'].includes(report.clientMatrixTarget)?report.clientMatrixTarget:undefined,
        uiLanguage:language(report.uiLanguage),client:{capabilities:{browserName:report.client?.capabilities?.browserName==='thunderbird'?'thunderbird':undefined,browserVersion:version(report.client?.capabilities?.browserVersion)}},
        previousInstallation:{extensionVersion:version(report.previousInstallation?.extensionVersion),
            ...Object.fromEntries(['auditRecord','openedAuditRecord','blockedOsAuditRecord'].map(key=>[key,audit(report.previousInstallation?.[key])]))},
        previousRestart:restart(report.previousRestart),currentRestart:restart(report.currentRestart),
        acknowledgedCrashRecovery:recovery(report.acknowledgedCrashRecovery),pendingCrashRecovery:recovery(report.pendingCrashRecovery),
        finalAuditRecords:report.finalAuditRecords?.map(audit),
        inlineManualScan:pick(report.inlineManualScan,['passed','realThunderbirdAPIs','syntheticTransport','liveProviderCalls','contextRenewed','completed','visibleCompletion','submissions','historicalAuditUnchanged']),
        cryptoContent:booleans(report.cryptoContent,['passed','synthetic','realThunderbirdAPIs','liveProviderCalls','openpgpDecrypted','smimeSignedReadable','smimeEnvelopeConservative','attachmentBytesVerified']),
        inlineFreshManualScan:pick(report.inlineFreshManualScan,['passed','realThunderbirdAPIs','syntheticTransport','liveProviderCalls','contextRenewed','completed','visibleCompletion','submissions','historicalAuditUnchanged']),
        scanCoverage:report.scanCoverage?{...pick(report.scanCoverage,['passed','baselineObserved','realThunderbirdAPIs','syntheticTransport','injectedInventoryFailure','liveProviderCalls','state','assessmentIncomplete','visibleState','visiblePopup','sourceCapacityPreserved','sourceCapacityReason']),coverage:{attachments:pick(report.scanCoverage.coverage?.attachments,['readFailed'])}}:undefined,
        scanCapacity:pick(report.scanCapacity,['passed','syntheticCoordinatorEnvironment','realThunderbirdEngine','retainedActive','rejectedBeforePreparation','deferredIsIncomplete','reuseAtCapacity','retryAfterCompletion']),
        automaticScans:booleans(report.automaticScans,['passed','bothProvidersWithoutLinkClick','popupClosedDuringRetry','duplicateDisplayReused','unlisted','syntheticTransport']),providerResults:booleans(report.providerResults,['passed','partialMaliciousBlocks','terminalUnknownRetainsFinding','brandDoesNotEscalate','refreshWithoutSubmission','bothViewsAgree','hybridExpertDetails','actionScopedQuota','syntheticTransport']),administration:booleans(report.administration,['passed','protectedDisplaySettings'])};
}
function browser(report) {
    return {...pick(report,['schemaVersion','kind','language','sourceFingerprint','view','cssZoom','matrix','failed','passed','planned']),
        browser:version(report.browser),playwright:version(report.playwright),axe:version(report.axe),
        results:report.results.map(row=>pick(row,['id','lang','view','kind','width','scheme','state','populated','url','scenario','density','status']))};
}
function healthy(thunderbird,browserUi) {
    if(!Array.isArray(thunderbird)||!Array.isArray(browserUi)||thunderbird.some(r=>r.passed!==true||r.error)||browserUi.some(r=>r.fatalError||r.failed!==0||r.results?.some(row=>row.status!=='passed'||row.error||row.errors?.length||row.violations?.length)))throw Error('Refusing failed release evidence');
}
function create(identity,thunderbird,browserUi,commit) {
    // Validate BEFORE projection: a raw failure must never disappear in redaction.
    healthy(thunderbird,browserUi);
    validateReports(identity,thunderbird,browserUi);
    const result={schemaVersion:1,kind:'thundy-release-acceptance',...identity,commit,
        originalReportsSha256:hash({thunderbird,browserUi}),
        limits:{unsignedEvidence:true,syntheticProviderResponses:true,realProviderAccountsVerified:false,windowsVerified:false,macosVerified:false,screenReadersVerified:false,automaticUpdateChannelVerified:false},
        thunderbird:thunderbird.filter(r=>r.extensionVersion===identity.extensionVersion&&r.xpiSha256===identity.packageSha256).map(native),browserUi:browserUi.filter(r=>r.sourceFingerprint===identity.sourceFingerprint).map(browser)};
    validateReports(identity,result.thunderbird,result.browserUi);
    return result;
}
function verify(evidence,identity) {
    if(evidence?.schemaVersion!==1||evidence.kind!=='thundy-release-acceptance'||Object.keys(identity).some(key=>evidence[key]!==identity[key]))throw Error('Release acceptance identity mismatch');
    healthy(evidence.thunderbird,evidence.browserUi);
    validateReports(evidence,evidence.thunderbird,evidence.browserUi);
    return true;
}
function write(root=path.resolve(__dirname,'..')) {
    const identity=packageIdentity(root),file=path.join(root,'docs/audits/candidate-'+identity.extensionVersion.replaceAll('.','_')+'.json');
    const evidence=JSON.parse(fs.readFileSync(file));
    if(Object.keys(identity).some(key=>evidence[key]!==identity[key]))throw Error('Candidate evidence identity mismatch');
    const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
    const output=path.join(root,'build','acceptance-'+identity.extensionVersion+'.json');
    fs.writeFileSync(output,JSON.stringify(create(identity,evidence.thunderbird,evidence.browserUi,commit),null,2)+'\n');
    return output;
}
if(require.main===module){try{console.log(write());}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={create,verify,write};
