const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const tick=()=>new Promise(setImmediate);
const source=fs.readFileSync('scan_jobs.js','utf8');
function coordinator(run=async()=>{}) {
 let now=1000000,seq=0;const timers=new Map(),changes=[];
 const c=vm.createContext({AbortController});vm.runInContext(source.split('const ThundyScans=')[0]+'globalThis.create=createScanCoordinator;',c);
 const env={now:()=>now,uuid:()=>String(++seq),setTimeout:fn=>{timers.set(++seq,fn);return seq;},clearTimeout:id=>timers.delete(id),prepare:async input=>({fingerprint:input.content||'same',providers:{}}),begin:async()=>{},run,changed:async(job,value)=>changes.push(JSON.parse(JSON.stringify(value)))};
 return {s:c.create(env),env,changes,advance:ms=>{now+=ms;for(const fn of [...timers.values()])fn();}};
}
test('accepted is not completed; multiple windows and clicks share one running job',async()=>{
 let finish,started=0;const f=coordinator(async job=>{started++;job.total=1;await new Promise(r=>finish=r);job.completed++;});
 const first=await f.s.start({id:1}),other=await f.s.start({id:1},{manual:true});
 assert.equal(first.id,other.id);assert.equal(other.attached,true);assert.equal(started,1);assert.equal(other.state,'running');
 finish();await f.s.settled(1);assert.equal(f.s.get(1).state,'completed');
 const cached=await f.s.start({id:1});assert.equal(cached.id,first.id);
 const repeated=await f.s.start({id:1},{manual:true});assert.notEqual(repeated.id,first.id);await tick();finish();await f.s.settled(1);
});
test('deadline and configuration changes reject late results and invalidate revisions',async()=>{
 let late,guard;const f=coordinator(async(job,assert)=>{guard=()=>assert(job);await new Promise(r=>late=r);assert(job);});
 await f.s.start({id:1});await tick();f.advance(300001);assert.equal(f.s.get(1).state,'incomplete');assert.throws(guard,/SCAN_CANCELLED/);late();await f.s.settled(1);
 const previous=f.s.revision(1);await f.s.start({id:1,content:'changed'});assert.notEqual(f.s.revision(1),previous);await tick();f.s.invalidate();assert.throws(guard,/SCAN_CANCELLED/);late();await f.s.settled(1);
});
test('automatic freshness expires after fifteen minutes, pending and partial remain distinct',async()=>{
 const f=coordinator(async job=>{job.total=1;job.pending=true;});await f.s.start({id:1});await f.s.settled(1);assert.equal(f.s.get(1).state,'pending');
 const previous=f.s.get(1).id;f.advance(900001);await f.s.start({id:1});await f.s.settled(1);assert.notEqual(f.s.get(1).id,previous);
 const partial=coordinator(async job=>{job.total=2;job.errors=1;});await partial.s.start({id:1});await partial.s.settled(1);assert.equal(partial.s.get(1).state,'incomplete');
});
function runtime(overrides={}){
 const settings={scanMode:'allDisplayed',autoScanLinks:true,externalAnalysisConsent:true,privacyTier:'max',apikey:'synthetic-ha',urlscanApikey:'synthetic-us',...overrides};
 const stored={},calls=[],events=[];let permission=true;
 const message={id:1,author:'sender@example.invalid',headerMessageId:'fixture'},full={parts:[{body:'https://example.invalid/target'}],headers:{}};
 const context={model:{data:{schemaVersion:1,rows:[]}},tabs:new Set([7]),snapshotId:'context',schedule(){},flush:async()=>{},forLinks:async()=>({event:e=>events.push(e)}),forAttachment:()=>({event:e=>events.push(e)})};
 const b={storage:{local:{get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).map(k=>[k,settings[k]]))}},messages:{listAttachments:async()=>[],getAttachmentFile:async()=>new Blob(['file'])},tabs:{query:async()=>[{id:7}]}};
 const c=vm.createContext({browser:b,crypto:webcrypto,TextEncoder,URL,URLSearchParams,AbortController,Blob,setTimeout,clearTimeout,console,
 extractEmailAddress:x=>x,extractPublicIPs:()=>[],hasHostPermissionFor:async()=>permission,loadSettings:async()=>{},readFullForAnalysis:async()=>full,extractTextFromParts:parts=>parts[0].body,extractUrls:text=>[text],filterUrls:x=>x,
 resolveMessageStorageKey:m=>m.headerMessageId,getMessageAnalysisContext:async()=>context,getSharedDB:async()=>({}),getFromStore:async(db,store,key)=>structuredClone(stored[key]),updateStore:async(db,store,key,edit)=>{stored[key]=edit(structuredClone(stored[key]));},
 apiGateway:{fetchWithTimeout:async(url,options)=>{calls.push({url,method:options.method});return {status:200,json:async()=>({id:'hybrid-job',verdict:'clean'})};},pause:async()=>{}},getHybridAnalysisOptions:(method,body)=>({method,body}),quickScanReport:x=>x,extractHybridVerdictFromOverview:x=>x?.verdict,
 checkUrlscanIo:async(url,key,ctx)=>{calls.push({url,provider:'urlscan',submit:true});await ctx.submitted('urlscan-job');return {uuid:'urlscan-job',status:'CLEAN'};},pollUrlscanIoResult:async uuid=>{calls.push({uuid,refresh:true});return {status:'CLEAN'};},
 indexedDB_save_links_to_db:async()=>{},collectThreatEvaluationOptions:async()=>({}),calculateThreatScore:()=>({score:0}),localContentCoverage:()=>({state:'checked'}),recordLocalCoverage:()=>{},injectThreatBanner:async()=>{},getFirstDisplayedMessage:async()=>message,
 injectIntoMessageDisplay:async()=>{},processAttachments:async()=>{},injectTimeOfClickProtection:async()=>{},evaluateAndInjectThreats:async()=>{},vtCache:new Map(),urlhausCache:new Map(),ipReputationCache:new Map(),mayTransmitExternally:()=>settings.externalAnalysisConsent,
 });
 vm.runInContext(fs.readFileSync('provider_registry.js','utf8')+'\n'+source+'\nglobalThis.scans=ThundyScans;',c);
 return {s:c.scans,c,settings,stored,calls,context,message,full,permission:value=>permission=value};
}
for(const [title,keys,count] of [['Hybrid only',{urlscanApikey:''},1],['urlscan only',{apikey:''},1],['both',{},2]])test('opening a message starts '+title+' without a link click',async()=>{
 const f=runtime(keys);await f.s.display({id:7},f.message);await f.s.settled(1);assert.equal(f.s.get(1).state,'completed');
 assert.equal(f.calls.filter(x=>x.submit||x.method==='POST').length,count);
 assert.equal(f.stored.fixture.scanJobMeta.state,'completed');
 const before=f.calls.length;await f.s.display({id:8},f.message);assert.equal(f.calls.length,before);
});
for(const [reason,settings] of [['manual',{scanMode:'manual'}],['sender',{scanMode:'approvedSenders'}],['disabled',{externalAnalysisConsent:false}],['policy',{privacyTier:'strict'}],['links_disabled',{autoScanLinks:false}]])test('start requirements: '+reason,async()=>{
 const f=runtime(settings);await f.s.display({id:7},f.message);await f.s.settled(1);assert.equal(f.calls.length,0);
 assert.ok(f.s.get(1).providers.urlscan.checks.some(x=>x.reason===reason));
});
test('missing permission blocks requests and manual mode does not bypass consent or privacy tier',async()=>{
 const f=runtime();f.permission(false);await f.s.display({id:7},f.message);await f.s.settled(1);assert.equal(f.calls.length,0);assert.equal(f.s.get(1).providers.urlscan.checks[0].reason,'permission');
 const manual=runtime({scanMode:'manual'});await manual.s.request({messageId:1,contextToken:'context'},{});await manual.s.settled(1);assert.equal(manual.s.get(1).state,'completed');
 await assert.rejects(manual.s.request({messageId:2},{}),/MESSAGE_CONTEXT_CHANGED/);
});
test('one provider fails while the other persists its result; refresh reuses a pending identifier',async()=>{
 const f=runtime();f.c.apiGateway.fetchWithTimeout=async()=>({status:429});
 await f.s.display({id:7},f.message);await f.s.settled(1);assert.equal(f.s.get(1).state,'incomplete');assert.equal(f.stored.fixture.links[0].urlscan.status,'CLEAN');assert.equal(f.s.get(1).providers.hybridanalysis.error,'rate_limited');
 f.settings.apikey='';f.stored.fixture.links[0].urlscan.status='TIMEOUT';f.s.invalidate();
 const submissions=f.calls.filter(x=>x.submit).length;
 await f.s.request({messageId:1,operation:'refresh'},{});await f.s.settled(1);
 assert.equal(f.calls.filter(x=>x.submit).length,submissions);assert.ok(f.calls.some(x=>x.uuid==='urlscan-job'&&x.refresh));
});
test('legacy settings preserve sender scope and manual flag; provider capability registry supplies the plan',async()=>{
 const f=runtime({scanMode:undefined,alwaysManual:true});assert.equal(f.s.mode(f.settings),'manual');f.settings.alwaysManual=false;assert.equal(f.s.mode(f.settings),'approvedSenders');
 const plan=await f.s.plan(f.settings,f.message,[],['https://example.invalid']);assert.equal(plan.urlscan.checks[0].reason,'sender');
 f.settings.scanningEnabledSenders=[f.message.author];assert.equal((await f.s.plan(f.settings,f.message,[],['https://example.invalid'])).urlscan.checks[0].reason,null);
});

test('urlscan submissions are serialized across resources',async()=>{
 const f=runtime({apikey:''});f.c.extractUrls=()=>['https://example.invalid/1','https://example.invalid/2'];let active=0,maximum=0;
 f.c.checkUrlscanIo=async(url,key,ctx)=>{maximum=Math.max(maximum,++active);await ctx.submitted('job-'+url.at(-1));await tick();active--;return {status:'CLEAN',uuid:'job-'+url.at(-1)};};
 await f.s.display({id:7},f.message);await f.s.settled(1);assert.equal(maximum,1);assert.equal(f.stored.fixture.links.length,2);assert.equal(f.s.get(1).state,'completed');
});
test('accepted identifier survives a lost poll response and background restart in manual mode',async()=>{
 const f=runtime({apikey:''});f.c.checkUrlscanIo=async(url,key,ctx)=>{await ctx.submitted('accepted-before-loss');return {status:'ERROR',errorCode:'fetch_failed'};};
 await f.s.display({id:7},f.message);await f.s.settled(1);assert.equal(f.stored.fixture.links[0].urlscan.uuid,'accepted-before-loss');assert.equal(f.s.get(1).state,'pending');
 const restarted=runtime({apikey:'',scanMode:'manual'});Object.assign(restarted.stored,structuredClone(f.stored));await restarted.s.display({id:7},restarted.message);assert.equal(restarted.calls.length,0);assert.equal(restarted.s.get(1).state,'pending');
 await restarted.s.request({messageId:1,operation:'refresh'},{});await restarted.s.settled(1);assert.ok(restarted.calls.some(x=>x.uuid==='accepted-before-loss'&&x.refresh));assert.equal(restarted.calls.filter(x=>x.submit).length,0);
});

test('cache deletion cancels work without repopulating records and permits a fresh job',async()=>{
 let finish;const f=coordinator(async job=>{job.total=1;await new Promise(r=>finish=r);});await f.s.start({id:1});await tick();
 const changes=f.changes.length;f.s.invalidate({silent:true,clear:true});assert.equal(f.s.get(1),null);assert.equal(f.changes.length,changes);finish();await tick();assert.equal(f.changes.length,changes);
 await f.s.start({id:1});await tick();finish();await f.s.settled(1);assert.equal(f.s.get(1).state,'completed');
});
test('preparation timeout releases the start queue before any network work',async()=>{
 const f=coordinator();f.env.prepare=()=>new Promise(()=>{});const request=f.s.start({id:1});await tick();f.advance(300001);await assert.rejects(request,/SCAN_PREPARATION_TIMEOUT/);assert.equal(f.s.get(1),null);
 f.env.prepare=async()=>({fingerprint:'new',providers:{}});await f.s.start({id:2});await f.s.settled(2);assert.equal(f.s.get(2).state,'blocked');
});

test('unavailable attachment inventory still renders and scans independently available links',async()=>{
 const f=runtime({apikey:''});f.c.browser.messages.listAttachments=async()=>{throw Error('decryption unavailable');};await f.s.display({id:7},f.message);await f.s.settled(1);
 assert.equal(f.s.get(1).state,'incomplete');assert.equal(f.stored.fixture.links[0].urlscan.status,'CLEAN');assert.equal(f.context.scanJob.errors,1);
});
