// AVN-009.e: diagnostic evidence, never a migration or a release-readiness gate.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const {createHash, webcrypto} = require('node:crypto');
const {JSDOM} = require('jsdom');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function simulatedDatabase() {
    const records = new Map(), access = [];
    return {records, access, db:{transaction(_stores, mode) {
        access.push(mode);
        const tx = {abort(){queueMicrotask(()=>tx.onabort?.());},objectStore(){return {
            get(key){const r={};queueMicrotask(()=>{r.result=structuredClone(records.get(key));r.onsuccess?.();});return r;},
            put(value){const r={result:value.messageHeader},copy=structuredClone(value);queueMicrotask(()=>{r.onsuccess?.();records.set(copy.messageHeader,copy);tx.oncomplete?.();});return r;}
        };}};
        return tx;
    }}};
}
async function run() {
    const dom=new JSDOM(), store=simulatedDatabase(), errors=[];
    const settings={externalAnalysisConsent:false,privacyTier:'strict',linkAuditLog:[{id:'historical',clickedAt:Date.now(),outcome:'PENDING',decidedAt:null,scoreAtDecision:null}]};
    const auditBefore=JSON.stringify(settings.linkAuditLog);
    const messages=new Map(), bodies=new Map(), bytes=new Map();
    const c=vm.createContext({URL,URLSearchParams,Blob,File,FormData,DOMParser:dom.window.DOMParser,crypto:webcrypto,AbortController,setTimeout,clearTimeout,TextEncoder,TextDecoder,
        console:{error:(...args)=>errors.push(args.map(String).join(" ")),warn(){},info(){}},
        browser:{runtime:{id:'probe',getURL:p=>p,getManifest:()=>({version:require('../manifest.json').version}),onMessage:{addListener(){}}},
            storage:{local:{get:async()=>structuredClone(settings),set:async values=>Object.assign(settings,structuredClone(values))},onChanged:{addListener(){}}},
            permissions:{contains:async()=>false},messages:{get:async id=>messages.get(id),getFull:async id=>bodies.get(id),listAttachments:async()=>[{name:'same.bin',partName:'1.2',size:4}],getAttachmentFile:async id=>new File([bytes.get(id)],'same.bin')},
            messageDisplay:{getDisplayedMessages:async()=>({messages:[]}),onMessagesDisplayed:{addListener(){}}},
            scripting:{executeScript:async()=>{}},menus:{create(){},onClicked:{addListener(){}}},notifications:{create(){}},windows:{openDefaultBrowser:async()=>{throw Error('No opening permitted in investigation');}}},
        fetch:async()=>{throw Error('No provider request permitted in investigation');}});
    const scripts=['db.js','i18n.js','runtime.js','api_gateway.js','risk.js','sanitize.js','provider_results.js','analysis_status.js','scan_policy.js','providers.js','message_ui.js','vendor/tldts.js','link_audit.js','background.js'];
    vm.runInContext(scripts.map(name=>fs.readFileSync(name,'utf8')).join('\n'),c);
    c.getSharedDB=async()=>store.db;
    const rows=[];
    try {
        await c.loadSettings();
        for(const kind of ['duplicate-header','missing-header','same-attachment-other-text','byte-identical-copy']) {
            vm.runInContext('messageAnalyses.clear();sharedDBPromise=null;',c);store.records.clear();store.access.length=0;
            const sameBytes=['same-attachment-other-text','byte-identical-copy'].includes(kind),sameBody=kind==='byte-identical-copy';
            const a={id:1,headerMessageId:kind==='missing-header'?'':'duplicate@example.invalid',author:'same@example.invalid',subject:'Same metadata',date:123};
            const b={...a,id:2};messages.set(1,a);messages.set(2,b);
            bodies.set(1,{parts:[{contentType:'text/plain',body:'Original https://example.com/'}]});
            bodies.set(2,{parts:[{contentType:'text/plain',body:sameBody?'Original https://example.com/':'Different https://example.com/'}]});
            bytes.set(1,Buffer.from([0,1,2,3]));bytes.set(2,Buffer.from(sameBytes?[0,1,2,3]:[0,1,2,4]));
            const keyA=c.resolveMessageStorageKey(a),keyB=c.resolveMessageStorageKey(b),digest=sha(bytes.get(1));
            const original={messageHeader:keyA,attachments:[{partName:'1.2',attachment_name:'same.bin',hybrid_sha256:digest,state:'KNOWN',report:{state:'COMPLETE',verdict:'malicious'},report_fetched_at:'2026-10-01T00:00:00Z'}],links:[{url:'https://example.com/',report:{state:'COMPLETE',verdict:'malicious'}}],updatedAt:Date.now()};
            store.records.set(keyA,structuredClone(original));
            const originalFindings=await c.collectAttachmentFindings(a);
            const beforeScore=c.calculateThreatScore(a.author,[],{attachmentFindings:originalFindings}).score;
            const findings=await c.collectAttachmentFindings(b),links=await c.collectLinkFindings(b,bodies.get(2));
            const context=await c.getMessageAnalysisContext(b),snapshot=await context.snapshot();
            context.forAttachment("1.2","same.bin",sha(bytes.get(2)));const verifiedSnapshot=await context.snapshot();
            const noReadMutation=JSON.stringify(store.records.get(keyA))===JSON.stringify(original);
            await c.indexedDB_save_batch_hybrid_data_to_db(b,[{attachmentName:'same.bin',hybrid_data:{sha256:sha(bytes.get(2)),partName:'1.2',state:'UPLOADED',submission_id:'new-submission'},report:{state:'IN_PROGRESS'}}]);
            const after=store.records.get(keyA);
            rows.push({kind,sameStorageKey:keyA===keyB,sameBody,sameAttachmentBytes:sameBytes,
                attachmentFindingReused:findings.length>0,matchingUrlFindingReused:links.length>0,
                unverifiedAttachmentCardHidden:!snapshot.hybridReports?.['attachment:1.2'],
                readPreservesOriginal:noReadMutation,priorReportArchived:after.analysisReportArchive?.entries?.some(e=>e.resource?.report?.verdict==='malicious')===true,
                originalMessageCurrentFindingsAfterSiblingWrite:(await c.collectAttachmentFindings(a)).length,
                originalScoreBefore:beforeScore,originalScoreAfter:c.calculateThreatScore(a.author,[],{attachmentFindings:await c.collectAttachmentFindings(a)}).score,
                verifiedAttachmentCardVisible:!!verifiedSnapshot.hybridReports?.["attachment:1.2"],
                auditUnchanged:JSON.stringify(settings.linkAuditLog)===auditBefore});
            context.dispose();
        }
        assert.deepEqual(errors,[],'The diagnostic must not turn runtime errors into empty findings');
        return {schemaVersion:1,kind:'thundy-identity-investigation',extensionVersion:require('../manifest.json').version,
            sourceFingerprint:require('../scripts/candidate-evidence.js').sourceFingerprint(),simulatedBrowserAndIndexedDB:true,realThunderbirdVerified:false,migrationPerformed:false,rows};
    } finally {vm.runInContext('messageAnalyses.clear()',c);dom.window.close();}
}
if(require.main===module)run().then(result=>process.stdout.write(JSON.stringify(result,null,2)+'\n')).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run};
