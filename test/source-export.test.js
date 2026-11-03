const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('source_export.js','utf8');
const fresh=()=>({success:true,messageId:7,contextToken:'runtime-context',local:{state:'checked',source:'local',observedAt:100},rows:[{provider:'urlhaus',scope:'domain',resource:'link:456',state:'running',source:'attempt',verdict:'unknown',active:1,attemptedAt:200}],sourceHistory:{rows:[{provider:'hybridanalysis',scope:'report',resource:'attachment:1.99',state:'incomplete',source:'remote',verdict:'malicious',observedAt:50,findingAt:40}]}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(lang='en',query='?messageId=7&contextToken=runtime-context'){
 const dom=new JSDOM(fs.readFileSync('source_export.html','utf8'),{url:'https://addon.invalid/source_export.html'+query,pretendToBeVisual:true});
 const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json'));
 const c=vm.createContext({URL,Blob,ThundyI18n:{get:key=>catalog[key]?.message || 'MISSING:'+key}});vm.runInContext(source+'\nglobalThis.subject=ThundySourceExport;',c);
 const listeners=new Set(),requests=[],downloads=[],urls=[],revoked=[];let snapshot=fresh(),read=async()=>structuredClone(snapshot),download=async()=>1;
 const api={runtime:{sendMessage:async request=>{requests.push(request);return read();},onMessage:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}},downloads:{download:async options=>{downloads.push(options);return download();}}};
 const controller=c.subject.mount(api,dom.window.document,dom.window.location,{createObjectURL:blob=>{urls.push(blob);return 'blob:local-fixture';},revokeObjectURL:url=>revoked.push(url)},Blob);
 const get=id=>dom.window.document.getElementById('sourceExport'+id);
 return {c,dom,catalog,requests,downloads,urls,revoked,listeners,get,controller,setSnapshot:value=>snapshot=value,setRead:fn=>read=fn,setDownload:fn=>download=fn,emit:message=>listeners.forEach(fn=>fn(message)),close(){controller.dispose();dom.window.close();}};
}
test('source projection strictly excludes identifiers and payloads while retaining actual states and original times',()=>{
 const f=fixture();try{
 const secret='SENSITIVE-PRIVATE',snapshot=fresh();
 snapshot.resourceLabels={'link:456':secret};snapshot.subject=secret;snapshot.url=secret;snapshot.apikey=secret;snapshot.contextToken=secret;
 snapshot.rows=Array.from(['hybridanalysis','virustotal','urlhaus','abuseipdb','urlscan'],(provider,index)=>({...snapshot.rows[0],provider,scope:['report','hash','domain','ip','url'][index],hash:secret,ip:secret,report:{secret},resource:index<2?'attachment:1.99':'link:456',extra:secret}));
 snapshot.rows.push({provider:secret,scope:'hash'});
 const report=JSON.parse(JSON.stringify(f.c.subject.project(snapshot,300))),json=JSON.stringify(report);
 assert.equal(report.current.rows.length,5);assert.equal(report.authenticatedSource,false);assert.equal(report.createdAt,300);
 for(const forbidden of [secret,'contextToken','messageId','1.99','456','resourceLabels','apikey'])assert.ok(!json.includes(forbidden),forbidden);
 assert.deepEqual(report.current.rows[0].resource,{kind:'attachment',ordinal:1});assert.deepEqual(report.current.rows[1].resource,{kind:'attachment',ordinal:1});assert.deepEqual(report.current.rows[2].resource,{kind:'link',ordinal:1});
 assert.equal(report.current.rows[0].state,'running');assert.equal(report.current.rows[0].verdict,'unknown');assert.equal(report.current.rows[0].attemptedAt,200);
 assert.equal(report.history.association,'unconfirmed');assert.deepEqual(report.history.rows[0].resource,{kind:'unbound'});assert.equal(report.history.rows[0].source,'stored');assert.equal(report.history.rows[0].observedAt,50);assert.equal(report.history.rows[0].findingAt,40);assert.equal(report.history.rows[0].active,0);
 }finally{f.close();}
});
test('malformed fields remain unknown and bounded; pending and failed checks never become completed decisions',()=>{
 const f=fixture();try{
 const snapshot=fresh();snapshot.rows=Array.from({length:1201},()=>({provider:'urlscan',scope:'url',resource:'https://private.invalid/',source:'private',state:'PENDING',verdict:'OPENED',observedAt:Infinity,findingAt:'private',attemptedAt:9e20,responses:1e12,failures:-1,cacheHits:'private'}));
 snapshot.local={state:'private',reason:'private',source:'private',observedAt:NaN};snapshot.availability={urlscan:'private'};
 const report=f.c.subject.project(snapshot);assert.equal(report.current.rows.length,1200);assert.equal(report.current.truncated,true);
 const row=report.current.rows[0];assert.equal(row.state,'incomplete');assert.equal(row.source,'unknown');assert.equal(row.verdict,'unknown');assert.equal(row.observedAt,null);assert.equal(row.attemptedAt,null);assert.equal(row.responses,100000);assert.equal(row.failures,0);assert.equal(row.resource.kind,'unknown');assert.equal(report.current.local.state,'unrecorded');assert.equal(report.current.availability.urlscan,'unknown');
 }finally{f.close();}
});
test('six-language preview is explicit, keyboard focusable, cancellable and downloads exactly its allowlisted bytes',async()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
  const f=fixture(lang);try{
   assert.equal(f.requests.length,0);assert.equal(f.get('Save').disabled,true);
   f.get('Preview').click();await tick();assert.equal(f.get('Content').hidden,false);assert.equal(f.dom.window.document.activeElement,f.get('Content'));assert.equal(f.get('Status').textContent,f.catalog.sourceExportReady.message);
   f.get('Cancel').click();assert.equal(f.get('Content').textContent,'');assert.equal(f.get('Save').disabled,true);assert.equal(f.dom.window.document.activeElement,f.get('Preview'));
   f.get('Preview').click();await tick();const expected=f.get('Content').textContent;f.get('Save').click();await tick();
   assert.equal(f.downloads.length,1);assert.equal(f.downloads[0].saveAs,true);assert.equal(f.downloads[0].filename,'thundy-analysis-sources.json');assert.equal(await f.urls[0].text(),expected);assert.deepEqual(f.revoked,['blob:local-fixture']);
   assert.equal(f.get('Status').textContent,f.catalog.sourceExportRequested.message);assert.ok(f.requests.every(request=>request.action==='getMessageAnalysis'));assert.equal(f.get('Content').querySelectorAll('*').length,0);
  }finally{f.close();}
 }
});
test('missing or replaced runtime context, bad message selector and read failures cannot export a different message',async()=>{
 for(const mode of ['no-token','bad-id','new-context','other-message','error']){
  const f=fixture('de',mode==='no-token'?'?messageId=7':mode==='bad-id'?'?messageId=7x&contextToken=runtime-context':undefined);try{
   if(mode==='new-context')f.setSnapshot({...fresh(),contextToken:'new-runtime-context'});
   if(mode==='other-message')f.setSnapshot({...fresh(),messageId:8});
   if(mode==='error')f.setRead(async()=>{throw new Error('SECRET-ERROR');});
   f.get('Preview').click();await tick();assert.equal(f.get('Save').disabled,true);assert.equal(f.get('Content').textContent,'');assert.equal(f.downloads.length,0);assert.equal(f.get('Status').textContent,f.catalog.sourceExportUnavailable.message);
  }finally{f.close();}
 }
});
test('cache clear or changed observations invalidate both a ready and an in-flight preview',async()=>{
 const f=fixture();try{
 f.get('Preview').click();await tick();f.emit({action:'analysisStatusChanged',messageId:8});assert.equal(f.get('Save').disabled,false);
 f.emit({action:'memoryCachesCleared'});assert.equal(f.get('Save').disabled,true);assert.equal(f.get('Content').textContent,'');
 let finish;f.setRead(()=>new Promise(resolve=>finish=resolve));f.get('Preview').click();f.emit({action:'analysisStatusChanged',messageId:7});finish(fresh());await tick();assert.equal(f.get('Save').disabled,true);assert.equal(f.get('Content').textContent,'');
 }finally{f.close();}
});
test('save revalidates the preview and never downloads deleted or changed observations',async()=>{
 const f=fixture();try{
 f.get('Preview').click();await tick();f.setSnapshot({...fresh(),rows:[],sourceHistory:{rows:[]}});f.get('Save').click();await tick();
 assert.equal(f.downloads.length,0);assert.equal(f.urls.length,0);assert.equal(f.get('Content').textContent,'');assert.equal(f.get('Status').textContent,f.catalog.sourceExportChanged.message);
 }finally{f.close();}
});
test('cancel during save validation and page disposal prevent late downloads; picker failures revoke blobs',async()=>{
 for(const mode of ['cancel','dispose','picker']){
  const f=fixture();try{
   f.get('Preview').click();await tick();
   let finish;if(mode==='picker')f.setDownload(async()=>{throw new Error('SECRET');});else f.setRead(()=>new Promise(resolve=>finish=resolve));
   f.get('Save').click();
   if(mode==='cancel')f.get('Cancel').click();if(mode==='dispose')f.controller.dispose();if(finish)finish(fresh());await tick();
   if(mode==='picker'){assert.deepEqual(f.revoked,['blob:local-fixture']);assert.equal(f.get('Status').textContent,f.catalog.sourceExportFailed.message);}else assert.equal(f.downloads.length,0);
   assert.equal(f.get('Save').disabled,true);
  }finally{f.close();}
 }
});
