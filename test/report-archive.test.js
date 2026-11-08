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
 const source=(fs.readFileSync('provider_results.js','utf8')+'\n'+fs.readFileSync('background.js','utf8')),start=source.indexOf('async function '+name+'('),end=source.indexOf('\n}',start)+2;
 assert.ok(start>=0 && end>start);vm.runInContext(source.slice(start,end),c);
}
test('actual batch writers keep an offline report and archive changed content and link submissions',async()=>{
 const original={messageHeader:'mail',attachments:[item()],links:[{url:'https://old.invalid/',state:'KNOWN',report:{state:'COMPLETE',verdict:'malicious'},report_fetched_at:'2026-10-02T08:00:00Z'}]};
 const s=setup(original);Object.assign(s.c,{getSharedDB:async()=>s.db,Logger:{error(){}}});
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
  const original={messageHeader:'mail',attachments:[item()],links:[{url:'https://old.invalid/',state:'KNOWN',report:{state:'COMPLETE',verdict:'malicious'}}]};
  if(full)original.analysisReportArchive={schemaVersion:1,entries:Array.from({length:128},(_,i)=>({id:String(i),kind:'attachment',slot:0,resource:item('previous-'+i)}))};
  const s=setup(original);let requests=0;
  Object.assign(s.c,{getSharedDB:async()=>s.db,Logger:{error(){}},URLSearchParams,File,FormData,apikey_hybridanalysis:'key',assertExternalAnalysisAllowed(){},tierAtLeast:()=>true,requireHostPermissionFor:async()=>true,requireHostPermission:async()=>{},getHybridAnalysisOptions:()=>({}),getMessageAnalysisContext:async()=>null,browser:{messages:{get:async()=>({id:7}),getAttachmentFile:async()=>new File(['bytes'],'same.bin')}},apiGateway:{fetchWithTimeout:async()=>{requests++;return {status:201,json:async()=>({job_id:'new-job',submission_id:'new-submission',sha256:'b'.repeat(64)})};}}});
  loadBackgroundFunction(s.c,name);
  const before=JSON.stringify(s.records.get('mail'));
  if(name==='handleUrlScan')await s.c.handleUrlScan('https://old.invalid/','mail');else await s.c.handleManualUpload(7,'1.2','same.bin','a'.repeat(64),'mail');
  assert.equal(requests,1,name);
  if(full){assert.equal(JSON.stringify(s.records.get('mail')),before);assert.equal(s.c.wasReportArchiveBlocked('mail'),true);}
  else {const entries=s.records.get('mail').analysisReportArchive.entries;assert.equal(entries.length,1);assert.equal(entries[0].resource.report.verdict,'malicious');}
 }
});

test('an unfinished submission identity is retained without inventing a completed report',async()=>{
 const s=setup({messageHeader:'mail',links:[{url:'https://old.invalid/',state:'UPLOADED',hybrid_job_id:'old-job',hybrid_submission_id:'old-submission',report:null}]});
 await s.c.updateStore(s.db,'hybridanalysis','mail',record=>{record.links[0]={url:'https://old.invalid/',state:'UPLOADED',hybrid_job_id:'new-job'};return record;},{preserveReports:true});
 const previous=s.records.get('mail').analysisReportArchive.entries[0].resource;
 assert.equal(previous.hybrid_job_id,'old-job');assert.equal(previous.state,'UPLOADED');assert.equal(previous.report,null);
});
