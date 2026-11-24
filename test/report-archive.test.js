const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dbSource=fs.readFileSync('db.js','utf8');
function database(initial){
 const records=new Map(Object.entries(structuredClone(initial))),control={abortNext:false};
 const db={close(){},transaction(){
  const tx={error:null,abort(){queueMicrotask(()=>tx.onabort?.());},objectStore(){return {
   get(key){const request={};queueMicrotask(()=>{request.result=structuredClone(records.get(key));request.onsuccess?.({target:request});});return request;},
   put(value){const request={result:value.messageHeader};const pending=structuredClone(value);queueMicrotask(()=>{
    request.onsuccess?.({target:request});
    if(control.abortNext){control.abortNext=false;tx.error=new Error('late abort');tx.onabort?.();}
    else {records.set(value.messageHeader,pending);tx.oncomplete?.();}
   });return request;}
  };}};return tx;
 }};return {db,records,control};
}
function setup(record){const store=database({mail:record}),c=vm.createContext({console:{error(){}},TextEncoder,crypto:globalThis.crypto});vm.runInContext(dbSource,c);return {c,...store};}
const item=(verdict='malicious')=>({partName:'1.2',attachment_name:'same.bin',hybrid_sha256:'a'.repeat(64),hybrid_job_id:'job',hybrid_submission_id:'submission',state:'KNOWN',created:new Date('2026-10-01T00:00:00Z'),report_fetched_at:'2026-10-02T08:00:00Z',report:{state:'COMPLETE',verdict,nested:{created:'provider-time',data:['original',3]}},virustotal_stats:{malicious:2}});

test('protected transaction preserves full attachment and link payloads before in-place changes',async()=>{
 const original={messageHeader:'mail',attachments:[item()],links:[{url:'https://target.invalid/?token=private',report:{state:'COMPLETE',nested:{details:['link payload']}},report_fetched_at:'2026-10-02T09:00:00Z'}]};
 const s=setup(original);
 await s.c.updateStore(s.db,'hybridanalysis','mail',record=>{record.attachments[0].report.nested.data[0]='changed';record.links=[];return record;},{preserveReports:true});
 const saved=s.records.get('mail');assert.equal(saved.analysisReportArchive.entries.length,2);
 assert.deepEqual(saved.analysisReportArchive.entries[0].resource.report,original.attachments[0].report);
 assert.deepEqual(saved.analysisReportArchive.entries[0].resource.virustotal_stats,{malicious:2});
 assert.equal(saved.analysisReportArchive.entries[1].resource.url,original.links[0].url);
 assert.equal(saved.analysisReportArchive.entries[0].resource.report_fetched_at,original.attachments[0].report_fetched_at);
 assert.equal(saved.attachments[0].report.nested.data[0],'changed');
});

test('unchanged reports and cache timestamps do not create revisions, but provider timestamps do',async()=>{
 const s=setup({messageHeader:'mail',attachments:[item()]});
 await s.c.updateStore(s.db,'hybridanalysis','mail',record=>{record.attachments[0].created=new Date();return record;},{preserveReports:true});
 assert.equal(s.records.get('mail').analysisReportArchive,undefined);
 await s.c.updateStore(s.db,'hybridanalysis','mail',record=>{record.attachments[0].report.nested.created='new provider time';return record;},{preserveReports:true});
 assert.equal(s.records.get('mail').analysisReportArchive.entries[0].resource.report.nested.created,'provider-time');
});

test('archive count and bytes refuse replacement without deleting prior data',async()=>{
 for(const kind of ['count','bytes','changed-archive','unknown-schema','malformed-entry','duplicate-id']){
  const entries=kind==='count'?Array.from({length:128},(_,i)=>({id:String(i),kind:'attachment',slot:0,resource:item('old-'+i)})):kind==='bytes'?[{id:'big',kind:'attachment',slot:0,resource:{report:{padding:'x'.repeat(2*1024*1024)}}}]:kind==='malformed-entry'?[null]:kind==='duplicate-id'?Array.from({length:2},()=>({id:'duplicate',kind:'attachment',slot:0,resource:item()})):[];
  const record={messageHeader:'mail',attachments:[item()],analysisReportArchive:{schemaVersion:kind==='unknown-schema'?2:1,entries}};
  const s=setup(record),before=JSON.stringify(s.records.get('mail'));
  await assert.rejects(s.c.updateStore(s.db,'hybridanalysis','mail',old=>{old.attachments[0].report=null;if(kind==='changed-archive')old.analysisReportArchive.entries.push({id:'forged'});return old;},{preserveReports:true}));
  assert.equal(JSON.stringify(s.records.get('mail')),before,kind);assert.equal(s.c.wasReportArchiveBlocked('mail'),true);
 }
});

test('a revision UUID collision or oversized captured protocol refuses replacement intact',async()=>{
 for(const kind of ['collision','capture-bytes']){
  const record={messageHeader:'mail',attachments:[item()]};
  if(kind==='collision')record.analysisReportArchive={schemaVersion:1,entries:[{id:'collision',kind:'link',slot:0,resource:{report:{verdict:'old'}}}]};
  else record.attachments[0].report.padding='x'.repeat(4*1024*1024);
  const s=setup(record);s.c.crypto={randomUUID:()=> 'collision'};const before=JSON.stringify(s.records.get('mail'));
  await assert.rejects(s.c.updateStore(s.db,'hybridanalysis','mail',old=>{old.attachments=[];return old;},{preserveReports:true}));
  assert.equal(JSON.stringify(s.records.get('mail')),before);assert.equal(s.c.wasReportArchiveBlocked('mail'),true);
 }
});

test('late abort cannot commit a report replacement or a partial archive',async()=>{
 const s=setup({messageHeader:'mail',attachments:[item()]}),before=JSON.stringify(s.records.get('mail'));s.control.abortNext=true;
 await assert.rejects(s.c.updateStore(s.db,'hybridanalysis','mail',record=>{record.attachments[0].report=null;return record;},{preserveReports:true}),/late abort/);
 assert.equal(JSON.stringify(s.records.get('mail')),before);assert.equal(s.c.wasReportArchiveBlocked('mail'),true);
 await s.c.updateStore(s.db,'hybridanalysis','mail',record=>{record.attachments[0].report=null;return record;},{preserveReports:true});
 assert.equal(s.records.get('mail').analysisReportArchive.entries.length,1);
});

test('same recorded revision is deduplicated while distinct observations stay preserved',async()=>{
 const s=setup({messageHeader:'mail',attachments:[item()]});
 const edit=verdict=>s.c.updateStore(s.db,'hybridanalysis','mail',record=>{record.attachments[0]=item(verdict);record.attachments[0].created=new Date();return record;},{preserveReports:true});
 await edit('none');await edit('malicious');await edit('none');
 const entries=s.records.get('mail').analysisReportArchive.entries;
 assert.equal(entries.length,2);assert.equal(new Set(entries.map(entry=>entry.id)).size,2);
});

test('real popup persistence archives an earlier protocol and ignores mismatched late responses',async()=>{
 const s=setup({messageHeader:'mail',attachments:[item()]});const dom=new JSDOM('<main></main>');
 Object.assign(s.c,{document:dom.window.document,window:dom.window,setTimeout,clearTimeout,browser:{runtime:{onMessage:{addListener(){}}}},openDB:async()=>s.db});
 const source=(fs.readFileSync('provider_results.js','utf8')+'\n'+fs.readFileSync('api.js','utf8')).replace(/^\(async \(\) => \{/m,'async function initializeForTest() {').replace(/\}\)\(\);/m,'}');
 vm.runInContext(source,s.c);s.c.openDB=async()=>s.db;
 try{
  assert.equal(await s.c.persistHybridReport({headerMessageId:'mail',sha256:'a'.repeat(64),jobId:'job',report:{state:'COMPLETE',verdict:'no specific threat'},fetchedAt:'2026-10-03T00:00:00Z'}),true);
  const saved=s.records.get('mail');assert.equal(saved.analysisReportArchive.entries[0].resource.report.verdict,'malicious');
  const before=JSON.stringify(saved);
  assert.equal(await s.c.persistHybridReport({headerMessageId:'mail',sha256:'a'.repeat(64),jobId:'old-job',report:{state:'COMPLETE',verdict:'late'}}),false);
  assert.equal(JSON.stringify(s.records.get('mail')),before);
 }finally{dom.window.close();}
});

function loadBackgroundFunction(c,name){
 const source=fs.readFileSync('background.js','utf8'),start=source.search(new RegExp('(?:async )?function '+name+'\\(')),end=source.indexOf('\n}',start)+2;
 assert.ok(start>=0 && end>start);vm.runInContext(source.slice(start,end),c);
}
test('actual batch writers keep an offline report and archive changed content and link submissions',async()=>{
 const original={messageHeader:'mail',attachments:[item()],links:[{url:'https://old.invalid/',state:'KNOWN',report:{state:'COMPLETE',verdict:'malicious'},report_fetched_at:'2026-10-02T08:00:00Z'}]};
 const s=setup(original);Object.assign(s.c,{getSharedDB:async()=>s.db,messageReportOptions:(_message, options)=>options,Logger:{error(){}}});
 for(const name of ['indexedDB_save_batch_hybrid_data_to_db','indexedDB_save_links_objects_to_db'])loadBackgroundFunction(s.c,name);
 const result=hash=>({attachmentName:'same.bin',hybrid_data:{partName:'1.2',sha256:hash,state:'MANUAL_CHECK_PENDING',job_id:'MANUAL_CHECK',submission_id:'MANUAL_CHECK'}});
 await s.c.indexedDB_save_batch_hybrid_data_to_db({headerMessageId:'mail'},[result('a'.repeat(64))]);
 let saved=s.records.get('mail');assert.deepEqual(saved.attachments[0].report,original.attachments[0].report);assert.equal(saved.attachments[0].hybrid_job_id,'job');assert.equal(saved.attachments[0].report_fetched_at,'2026-10-02T08:00:00Z');assert.equal(saved.analysisReportArchive,undefined);
 await s.c.indexedDB_save_batch_hybrid_data_to_db({headerMessageId:'mail'},[result('b'.repeat(64))]);
 await s.c.indexedDB_save_links_objects_to_db({headerMessageId:'mail'},[{url:'https://old.invalid/',state:'UPLOADED',hybrid_job_id:'new-job'}]);
 saved=s.records.get('mail');assert.equal(saved.analysisReportArchive.entries.length,2);assert.equal(saved.analysisReportArchive.entries[0].resource.hybrid_sha256,'a'.repeat(64));assert.equal(saved.analysisReportArchive.entries[1].resource.url,'https://old.invalid/');
});

test('manual URL and file paths preserve protocols and never repeat an accepted submission after a refused write',async()=>{
 for(const name of ['handleUrlScan','handleManualUpload'])for(const full of [false,true]){
  const hash=require('node:crypto').createHash('sha256').update('bytes').digest('hex');
  const attachment=item();attachment.hybrid_sha256=hash;
  const original={messageHeader:'mail',attachments:[attachment],links:[{url:'https://old.invalid/',state:'KNOWN',report:{state:'COMPLETE',verdict:'malicious'}}]};
  if(full)original.analysisReportArchive={schemaVersion:1,entries:Array.from({length:128},(_,i)=>({id:String(i),kind:'attachment',slot:0,resource:item('previous-'+i)}))};
  const s=setup(original);let requests=0;
  s.c.providerEnabled = () => true;
  Object.assign(s.c,{getSharedDB:async()=>s.db,messageReportOptions:(_message, options)=>options,Logger:{error(){}},URLSearchParams,File,FormData,apikey_hybridanalysis:'key',assertExternalAnalysisAllowed(){},tierAtLeast:()=>true,requireHostPermissionFor:async()=>true,requireHostPermission:async()=>{},getHybridAnalysisOptions:()=>({}),getMessageAnalysisContext:async()=>null,get_sha256_hash:async()=>hash,browser:{messages:{get:async()=>({id:7,headerMessageId:'mail'}),getAttachmentFile:async()=>new File(['bytes'],'same.bin')}},apiGateway:{fetchWithTimeout:async()=>{requests++;return {status:201,json:async()=>({job_id:'new-job',submission_id:'new-submission',sha256:name==='handleManualUpload'?hash:'b'.repeat(64)})};}}});
  loadBackgroundFunction(s.c,name);
  s.c.sameAnalysisUrl = (left,right) => left === right;
  const before=JSON.stringify(s.records.get('mail'));
  if(name==='handleUrlScan')await s.c.handleUrlScan('https://old.invalid/','mail');else await s.c.handleManualUpload(7,'1.2','same.bin',hash,'mail');
  assert.equal(requests,1,name);
  if(full){assert.equal(JSON.stringify(s.records.get('mail')),before);assert.equal(s.c.wasReportArchiveBlocked('mail'),true);}
  else {const entries=s.records.get('mail').analysisReportArchive.entries;assert.equal(entries.length,1);assert.equal(entries[0].resource.report.verdict,'malicious');}
 }
});

test('colliding message IDs keep provider writes scoped, including popup refresh and rollback', async () => {
 const url = 'https://target.invalid/path?value=7#view';
 const legacy = {messageHeader: 'mail', attachments: [item()], links: [{url, report: {verdict: 'malicious'}}]};
 const s = setup(legacy);
 const first = {id: 7, headerMessageId: 'mail'}, second = {...first, id: 8};
 let runtime = 'first-runtime';
 Object.assign(s.c, {
    URL, getAnalysisRuntimeId: () => runtime, getSharedDB: async () => s.db,
    Logger: {error() {}}, browser: {messages: {get: async id => id === first.id ? first : second}}
 });
 vm.runInContext(fs.readFileSync('runtime.js', 'utf8') + '\n' + fs.readFileSync('provider_results.js', 'utf8'), s.c);
 for (const name of ['messageReportOptions', 'canonicalHttpUrl', 'sameAnalysisUrl', 'attachmentFindingStrength',
     'savedLinkAssessments', 'indexedDB_save_batch_hybrid_data_to_db', 'indexedDB_save_links_objects_to_db', 'savePopupHybridReport']) {
    loadBackgroundFunction(s.c, name);
 }
 const digest = 'b'.repeat(64), twinDigest = 'c'.repeat(64);
 const link = verdict => ({url, state: 'KNOWN', report: {state: 'COMPLETE', verdict}});
 const attachment = (sha256, verdict) => ({
    attachmentName: 'same.bin',
    hybrid_data: {partName: '1.2', sha256, job_id: 'job', state: 'KNOWN'}, report: {state: 'COMPLETE', verdict}
 });
 const view = (message, options) => s.c.getFromStore(s.db, 'hybridanalysis', 'mail', s.c.messageReportOptions(message, options));
 await s.c.indexedDB_save_batch_hybrid_data_to_db(first, [attachment(digest, 'malicious')]);
 await s.c.indexedDB_save_batch_hybrid_data_to_db(second, [attachment(twinDigest, 'clean')]);
 await s.c.indexedDB_save_links_objects_to_db(first, [link('malicious')]);
 await s.c.indexedDB_save_links_objects_to_db(second, [link('clean')]);
 assert.equal((await view(first)).attachments[0].report.verdict, 'malicious');
 assert.equal((await view(second)).attachments[0].report.verdict, 'clean');
 assert.equal(s.c.savedLinkAssessments(await view(first)).get(url).verdict, 'malicious');
 assert.equal(s.c.savedLinkAssessments(await view(second)).get(url).verdict, 'none');
 const reportScope = s.c.messageReportOptions(first).reportScope;
 const request = {messageId: first.id, headerMessageId: 'mail', reportScope, sha256: digest, partName: '1.2', jobId: 'job',
    report: {state: 'COMPLETE', verdict: 'suspicious', sha256: digest}};
 const before = JSON.stringify(s.records.get('mail'));
 assert.equal(await s.c.savePopupHybridReport({...request, messageId: second.id}), false);
 assert.equal(await s.c.savePopupHybridReport({...request, jobId: 'previous-job'}), false);
 assert.equal(await s.c.savePopupHybridReport({...request, report: {state: 'IN_PROGRESS', sha256: digest}}), false);
 assert.equal(await s.c.savePopupHybridReport({...request, report: {...request.report, sha256: twinDigest}}), false);
 assert.equal(JSON.stringify(s.records.get('mail')), before);
 s.control.abortNext = true;
 await assert.rejects(s.c.savePopupHybridReport(request), /late abort/);
 assert.equal(JSON.stringify(s.records.get('mail')), before);
 assert.equal(await s.c.savePopupHybridReport(request), true);
 assert.equal((await view(first)).attachments[0].report.verdict, 'suspicious');
 assert.equal((await view(first)).analysisReportArchive.entries[0].resource.report.verdict, 'malicious');
 assert.equal((await view(second)).analysisReportArchive, undefined);
 assert.deepEqual(s.records.get('mail').attachments, legacy.attachments);
 assert.deepEqual(s.records.get('mail').links, legacy.links);

 runtime = 'second-runtime';
 const afterRestart = await view(first, {includeHistory: true});
 assert.equal(afterRestart.links, undefined);
 const assessments = s.c.savedLinkAssessments(afterRestart);
 assert.equal(assessments.get(url).source, 'archive');
 assert.equal(assessments.get(url).verdict, 'malicious');
 assert.equal(assessments.has('https://target.invalid/path?value=8#view'), false);
 assert.equal(await s.c.savePopupHybridReport(request), false);
});

test('report scope capacity refuses a new occurrence while preserving old data', async () => {
 const entries = Object.fromEntries(Array.from({length: 64}, (_, i) => [JSON.stringify(['session', i + 1]), {attachments: [item()]}]));
 const s = setup({messageHeader: 'mail', analysisOccurrenceReports: {schemaVersion: 1, entries}});
 const before = JSON.stringify(s.records.get('mail'));
 await assert.rejects(s.c.updateStore(s.db, 'hybridanalysis', 'mail', record => ({...record, attachments: [item()]}), {
    reportScope: JSON.stringify(['session', 65]), preserveReports: true
 }), {code: 'REPORT_ARCHIVE_BLOCKED'});
 assert.equal(JSON.stringify(s.records.get('mail')), before);
});

test('historical protection sees applicable resources beyond the bounded history display', async () => {
 const message = {id: 7, headerMessageId: 'mail'};
 const url = 'https://target.invalid/path?value=7#view';
 const unrelated = 'https://target.invalid/path?value=7#other';
 const observedAt = '2026-10-01T08:00:00Z';
 const report = {state: 'COMPLETE', verdict: 'malicious'};
 const digest = 'a'.repeat(64);
 const previous = {
    attachments: [item()],
    links: [{url, report, report_fetched_at: observedAt}]
 };
 const legacy = {schemaVersion: 1, entries: Array.from({length: 128}, (_, slot) => ({
    id: String(slot), slot, kind: 'link', resource: {url: 'https://legacy.invalid/' + slot, report: {state: 'COMPLETE', verdict: 'clean'}}
 }))};
 const s = setup({messageHeader: 'mail', analysisReportArchive: legacy, analysisOccurrenceReports: {
    schemaVersion: 1, entries: {
        '["previous",4]': previous,
        '["current",8]': {links: [{url: unrelated, report}]},
        '["invalid"]': {links: [{url: unrelated, report}]}
    }
 }});
 const file = new File(['test'], 'same.bin');
 Object.assign(s.c, {
    URL, getAnalysisRuntimeId: () => 'current', getSharedDB: async () => s.db, Logger: {warn() {}},
    browser: {messages: {listAttachments: async () => [{partName: '1.2', name: file.name, size: file.size}], getAttachmentFile: async () => file}},
    get_sha256_hash: async () => digest, messageUrlInventory: () => [url, unrelated]
 });
 vm.runInContext(['runtime.js', 'provider_results.js', 'analysis_status.js'].map(file => fs.readFileSync(file, 'utf8')).join('\n'), s.c);
 for (const name of ['messageReportOptions', 'canonicalHttpUrl', 'attachmentFindingStrength',
     'savedLinkAssessments', 'collectLinkFindings', 'attachmentRiskEvidence', 'selectAttachmentRiskFinding', 'collectAttachmentFindings']) {
    loadBackgroundFunction(s.c, name);
 }
 const view = await s.c.getFromStore(s.db, 'hybridanalysis', 'mail', s.c.messageReportOptions(message, {includeHistory: true}));
 assert.equal(view.analysisReportArchive.entries.length, 128);
 assert.equal(view.links, undefined);
 const links = await s.c.collectLinkFindings(message, {});
 const attachments = await s.c.collectAttachmentFindings(message);
 assert.deepEqual(Array.from(links, finding => [finding.url, finding.verdict, finding.source]), [[url, 'malicious', 'archive']]);
 assert.deepEqual(Array.from(attachments, finding => [finding.name, finding.verdict, finding.source]), [[file.name, 'malicious', 'archive']]);
 assert.equal(vm.runInContext('ThundyAnalysis', s.c).history(view).truncated, true);
});

test('an archived URL warning lasts until a newer completed assessment from its provider', () => {
 const s = setup({messageHeader: 'mail'});
 s.c.URL = URL;
 vm.runInContext(fs.readFileSync('provider_results.js', 'utf8'), s.c);
 for (const name of ['canonicalHttpUrl', 'attachmentFindingStrength', 'savedLinkAssessments']) loadBackgroundFunction(s.c, name);
 const url = 'https://target.invalid/path';
 const old = {url, report_fetched_at: '2026-10-01T12:00:00Z', report: {state: 'COMPLETE', verdict: 'malicious'}};
 const current = {url, report_fetched_at: '2026-10-02T12:00:00Z', report: {finished: false, verdict: 'clean'}};
 const record = {links: [current], analysisReportArchive: {schemaVersion: 1, entries: [{kind: 'link', resource: old}]}};
 assert.equal(s.c.savedLinkAssessments(record).get(url).verdict, 'malicious');
 current.report.finished = true;
 assert.equal(s.c.savedLinkAssessments(record).get(url).verdict, 'none');
 current.report.finished = false;
 current.hybrid_verdict = {status: 'CLEAN', completion: 'complete', observedAt: Date.parse('2026-10-03T12:00:00Z')};
 assert.equal(s.c.savedLinkAssessments(record).get(url).verdict, 'none');
 record.links = [{
    url, urlscan: {observedAt: Date.parse('2026-10-04T12:00:00Z'), assessment: {
        assessmentVersion: 1, completion: 'complete', signals: [{code: 'overall', verdict: 'none'}]
    }}
 }];
 assert.equal(s.c.savedLinkAssessments(record).get(url).verdict, 'malicious');
});

test('an unfinished submission identity is retained without inventing a completed report',async()=>{
 const s=setup({messageHeader:'mail',links:[{url:'https://old.invalid/',state:'UPLOADED',hybrid_job_id:'old-job',hybrid_submission_id:'old-submission',report:null}]});
 await s.c.updateStore(s.db,'hybridanalysis','mail',record=>{record.links[0]={url:'https://old.invalid/',state:'UPLOADED',hybrid_job_id:'new-job'};return record;},{preserveReports:true});
 const previous=s.records.get('mail').analysisReportArchive.entries[0].resource;
 assert.equal(previous.hybrid_job_id,'old-job');assert.equal(previous.state,'UPLOADED');assert.equal(previous.report,null);
});
