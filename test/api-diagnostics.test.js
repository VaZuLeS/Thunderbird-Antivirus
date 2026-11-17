const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function fixture(){
 const stored={},calls=[];let now=1000000;
 const sender={id:'addon',url:'moz-extension://addon/options.html',tab:{id:1},documentId:'options'};
 const browser={runtime:{id:'addon',getURL:p=>'moz-extension://addon/'+p,onConnect:{addListener(){}}},storage:{local:{get:async key=>({[key]:stored[key]}),set:async value=>Object.assign(stored,value)}}};
 const c=vm.createContext({browser,crypto:webcrypto,URL,Headers,Response,FormData,URLSearchParams,AbortController,TextEncoder,setTimeout,clearTimeout,console,Date:class extends Date{static now(){return now;}},fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({id:'quick-reference',submission_id:'submission-reference',finished:false,scanners:[{status:'in-progress'}]}),{status:200,headers:{'content-type':'application/json'}});}});
 vm.runInContext(['provider_results.js','provider_registry.js','security.js','api_diagnostics.js','api_gateway.js'].map(file=>fs.readFileSync(file,'utf8')).join('\n')+'\nglobalThis.s=ThundySecurity;globalThis.d=ThundyApiDiagnostics;globalThis.g=apiGateway;',c);
 // Transport policy is verified separately; this suite exercises real gateway instrumentation.
 vm.runInContext('ThundyProviders.enforce=async()=>{};',c);
 return {c,s:c.s,d:c.d,g:c.g,stored,calls,browser,sender,advance:ms=>now+=ms,enable:()=>c.s.command({op:'apiDebugSet',enabled:true},sender)};
}
const url='https://hybrid-analysis.com/api/v2/quick-scan/url-for-analysis';
test('debug is off by default and capture never adds a provider request',async()=>{
 const f=fixture();await f.g.fetchWithTimeout(url,{method:'POST',body:'private-body'});assert.equal(f.calls.length,1);assert.equal(f.d.report().entries.length,0);
 await f.enable();await f.g.fetchWithTimeout(url,{method:'POST',headers:{'api-key':'CANARY_KEY'},body:new URLSearchParams({url:'https://private.invalid/?secret=CANARY_URL',scan_type:'all'})});
 assert.equal(f.calls.length,2);const r=f.d.report();assert.equal(r.entries.length,1);assert.equal(r.entries[0].request.authPresent,true);assert.equal(r.entries[0].reason,'success');assert.equal(r.entries[0].attempts[0].status,200);assert.equal(r.entries[0].response.finished,false);
 const text=JSON.stringify(r);for(const secret of ['CANARY','private.invalid','private-body','quick-reference','submission-reference'])assert.ok(!text.includes(secret),secret);
 assert.notEqual(r.entries[0].response.id,r.entries[0].response.submission_id);
});
test('admin protection covers enable, read, export and clear with document-bound tokens',async()=>{
 const f=fixture();await f.s.command({op:'configure',adminPassword:'administrator-123',policy:{enabled:false,threshold:50,unknown:'warn'}},f.sender);
 for(const op of ['apiDebugSet','apiDebugStatus','apiDebugReport','apiDebugClear'])await assert.rejects(f.s.command({op,enabled:true},f.sender),/ADMIN_LOCKED/);
 await assert.rejects(f.s.write({apiDebugEnabled:true},f.sender),/ADMIN_LOCKED/);
 const {token}=await f.s.command({op:'unlock',password:'administrator-123'},f.sender);
 await f.s.command({op:'apiDebugSet',enabled:true,token},f.sender);
 assert.equal((await f.s.command({op:'apiDebugReport',token},f.sender)).report.kind,'thundy-api-debug');
 await assert.rejects(f.s.command({op:'apiDebugReport',token},{...f.sender,documentId:'other'}),/ADMIN_LOCKED/);
 await f.s.command({op:'lock',token},f.sender);await assert.rejects(f.s.command({op:'apiDebugReport',token},f.sender),/ADMIN_LOCKED/);
});
test('HTTP failures and invalid JSON retain metadata without raw HTML or error secrets',async()=>{
 const f=fixture();await f.enable();
 f.c.fetch=async()=>new Response('<html>CANARY_COOKIE</html>',{status:403,headers:{'content-type':'text/html','set-cookie':'CANARY'}});
 const response=await f.g.fetchWithTimeout(url,{method:'POST'});assert.equal(response.status,403);
 let e=f.d.report().entries[0];assert.equal(e.attempts[0].status,403);assert.equal(e.attempts[0].contentType,'html');assert.equal(e.bodyState,'invalid_json');assert.ok(!JSON.stringify(e).includes('CANARY'));
 f.c.fetch=async()=>new Response('not JSON CANARY',{status:200});await assert.rejects(f.g.fetchWithTimeout(url,{method:'POST'}));
 e=f.d.report().entries[1];assert.equal(e.reason,'invalid_json');assert.equal(e.attempts[0].status,200);
 f.c.fetch=async()=>{throw new TypeError('CANARY URL or network secret');};await assert.rejects(f.g.fetchWithTimeout(url,{method:'POST'}));assert.equal(f.d.report().entries[2].reason,'network_error');assert.ok(!JSON.stringify(f.d.report()).includes('CANARY'));
});
test('disabling and reenabling invalidates in-flight records; clear and age limits work',async()=>{
 const f=fixture();await f.enable();let finish,started;const ready=new Promise(resolve=>started=resolve);
 f.c.fetch=async()=>{started();return new Promise(resolve=>finish=()=>resolve(new Response('{}',{status:200})));};
 const request=f.g.fetchWithTimeout(url,{method:'POST'});await ready;
 await f.s.command({op:'apiDebugSet',enabled:false},f.sender);await f.enable();finish();await request;assert.equal(f.d.report().entries.length,0);
 f.c.fetch=async()=>new Response('{}',{status:200});
 for(let i=0;i<105;i++)await f.g.fetchWithTimeout(url,{method:'POST'});
 assert.equal(f.d.report().entries.length,100);assert.equal(f.d.report().dropped,5);
 f.advance(3600001);assert.equal(f.d.report().entries.length,0);
 await f.g.fetchWithTimeout(url,{method:'POST'});await f.s.command({op:'apiDebugClear'},f.sender);assert.equal(f.d.report().entries.length,0);
});
test('popup capture is sender-bound and rechecks redaction before admin export',async()=>{
 const f=fixture();await f.enable();const popup={...f.sender,url:'moz-extension://addon/popup.html',documentId:'popup'};
 await assert.rejects(f.d.capture({stage:'start',request:{}},{...popup,url:'https://mail.invalid/'}),/ADMIN_PAGE_REQUIRED/);
 const {ticket}=await f.d.capture({stage:'start',request:{provider:'hybridanalysis',endpoint:'/api/v2/quick-scan/:reference',method:'GET',scope:'report'}},popup);
 await f.d.capture({stage:'finish',ticket,trace:{attempts:[{status:401,durationMs:2}],reason:'authentication',response:{password:'CANARY',id:'CANARY',message:'CANARY',finished:false}}},{...popup,documentId:'wrong'});
 assert.equal(f.d.report().entries.length,0);
 await f.d.capture({stage:'finish',ticket,trace:{attempts:[{status:401,durationMs:2}],reason:'authentication',response:{password:'CANARY',id:'CANARY',message:'CANARY',finished:false}}},popup);
 assert.equal(f.d.report().entries.length,1);assert.ok(!JSON.stringify(f.d.report()).includes('CANARY'));assert.equal(f.d.report().entries[0].reason,'authentication');
});
test('response reference aliases correlate with a later request and raw payloads stay unchanged',async()=>{
 const f=fixture();await f.enable();const data={id:'quick-reference',job_id:'sandbox-reference',url:'https://private.invalid/token',api_key:'CANARY',finished:false};const before=JSON.stringify(data);
 f.c.fetch=async()=>new Response(JSON.stringify(data),{status:200});
 const result=await f.g.fetchWithTimeout(url,{method:'POST'});assert.equal((await result.json()).url,data.url);
 await f.g.fetchWithTimeout('https://hybrid-analysis.com/api/v2/quick-scan/quick-reference',{method:'GET'});
 const rows=f.d.report().entries;assert.equal(rows[0].response.id,rows[1].request.pathReferences[0].reference);assert.equal(JSON.stringify(data),before);assert.ok(!JSON.stringify(rows).includes('CANARY'));
});

test('diagnostic projection bounds oversized strings and branching response structures',()=>{
 const f=fixture();let tree={message:'CANARY'.repeat(100000)};
 for(let i=0;i<8;i++)tree={data:tree,attributes:tree,verdicts:tree};
 const projected=JSON.stringify(f.d.project(tree));assert.ok(projected.length<32768);assert.ok(projected.includes('[depth limit]'));assert.ok(!projected.includes('CANARY'));
});

test('independent popup reference namespaces cannot imply a shared provider identifier',async()=>{
 const f=fixture();await f.enable();
 for(const documentId of ['popup-one','popup-two']){
  const sender={...f.sender,url:'moz-extension://addon/popup.html',documentId};
  const browser={...f.browser,runtime:{...f.browser.runtime,sendMessage:async request=>({success:true,...await f.d.capture(request,sender)})}};
  const c=vm.createContext({browser,URL,crypto:webcrypto});vm.runInContext(fs.readFileSync('provider_registry.js','utf8')+'\n'+fs.readFileSync('api_diagnostics.js','utf8')+'\nglobalThis.d=ThundyApiDiagnostics;',c);
  const ticket=await c.d.start(url,{method:'POST'});await c.d.finish(ticket,{attempts:[{status:200,durationMs:1}],response:c.d.project({id:'provider-reference'}),bodyState:'json'});
 }
 const rows=f.d.report().entries;assert.equal(rows.length,2);assert.notEqual(rows[0].response.id,rows[1].response.id);assert.ok(rows.every(row=>/^ref-p[a-f0-9]{12}-1$/.test(row.response.id)));
});

test('retention expires all entries when requests complete out of start order',async()=>{
 const f=fixture();let timer;f.c.setTimeout=(callback,ms)=>(timer={callback,ms,unref(){}});f.c.clearTimeout=()=>{};await f.enable();
 const a=await f.d.start(url,{method:'POST'});f.advance(100);const b=await f.d.start(url,{method:'POST'});f.advance(100);
 await f.d.finish(b,{attempts:[{status:200}],reason:'success'});f.advance(100);await f.d.finish(a,{attempts:[{status:200}],reason:'success'});
 f.advance(3599750);timer.callback();const report=f.d.report();
 assert.equal(report.entries.length,1);assert.equal(report.createdAt-report.entries[0].startedAt,3599950);assert.equal(timer.ms,51);
 f.advance(50);assert.equal(f.d.report().entries.length,0);f.d.reset();
});
test('expired diagnostic tickets cannot append a late completion',async()=>{
 const f=fixture();await f.enable();const ticket=await f.d.start(url,{method:'POST'});f.advance(300001);
 await f.d.finish(ticket,{attempts:[{status:200}],reason:'success'});assert.equal(f.d.report().entries.length,0);f.d.reset();
});
test('diagnostic body sizes count UTF-8 bytes rather than UTF-16 code units',async()=>{
 const f=fixture();await f.enable();
 for(const text of ['ASCII','ä','😀']){
  const body=JSON.stringify({url:'https://example.invalid/'+text,visibility:'unlisted'});
  await f.g.fetchWithTimeout('https://urlscan.io/api/v1/scan/',{method:'POST',body});
  assert.equal(f.d.report().entries.at(-1).request.body.bytes,Buffer.byteLength(body,'utf8'));
 }
 const sender={...f.sender,url:'moz-extension://addon/popup.html',documentId:'size-popup'};
 const {ticket}=await f.d.capture({stage:'start',request:{provider:'urlscan',endpoint:'/api/v1/scan/',method:'POST',scope:'url',body:{kind:'text',bytes:64}}},sender);
 await f.d.capture({stage:'finish',ticket,trace:{attempts:[{status:200}]}},sender);
 assert.equal(f.d.report().entries.at(-1).request.body.bytes,64);f.d.reset();
});
test('known provider protocol values survive projection while arbitrary strings remain redacted',async()=>{
 const f=fixture();await f.enable();const input={query_status:'invalid_api_key',verdict:'no specific threat',status:'MALICIOUS_VISUAL',message:'CANARY_PRIVATE'};
 const projected=f.d.project(input);assert.equal(projected.query_status,'INVALID_API_KEY');assert.equal(projected.verdict,'NO SPECIFIC THREAT');assert.equal(projected.status,'MALICIOUS_VISUAL');assert.equal(projected.message,'[redacted string]');
 const sender={...f.sender,url:'moz-extension://addon/popup.html',documentId:'protocol-popup'};
 const {ticket}=await f.d.capture({stage:'start',request:{provider:'hybridanalysis',endpoint:'/api/v2/overview/:reference',method:'GET'}},sender);
 await f.d.capture({stage:'finish',ticket,trace:{response:projected,attempts:[{status:200}]}},sender);
 assert.equal(f.d.report().entries[0].response.verdict,'NO SPECIFIC THREAT');assert.ok(!JSON.stringify(f.d.report()).includes('CANARY'));f.d.reset();
});

test('diagnostic page has document-bound read access but no settings or debug-enable privileges',async()=>{
 const f=fixture(),page={...f.sender,url:'moz-extension://addon/api_debug.html',documentId:'diagnostic'};
 await f.s.command({op:'configure',adminPassword:'administrator-123',policy:{enabled:false,threshold:50,unknown:'warn'}},f.sender);
 await assert.rejects(f.s.command({op:'apiDebugReport'},page),/ADMIN_LOCKED/);
 const {token}=await f.s.command({op:'unlock',password:'administrator-123'},page);
 for(const op of ['configure','disableAdmin','recover','apiDebugSet'])await assert.rejects(f.s.command({op,enabled:true,token},page),/ADMIN_PAGE_REQUIRED/);
 await assert.rejects(f.s.write({privacyTier:'max'},page,token),/ADMIN_PAGE_REQUIRED/);
 assert.equal((await f.s.command({op:'apiDebugReport',token},page)).report.schemaVersion,2);
 f.advance(299999);await f.s.command({op:'apiDebugReport',token},page);f.advance(2);
 await assert.rejects(f.s.command({op:'apiDebugReport',token},page),/ADMIN_LOCKED/);
});
test('flow correlation exposes prerequisites and real transport steps without secret values or owner identity',async()=>{
 const f=fixture();await f.enable();const run=await f.d.beginRun('manual');
 f.d.event(run,'precondition',{provider:'urlscan',state:'blocked',reason:'storage_failed',message:'PRIVATE_CANARY'});
 await f.g.fetchWithTimeout(url,{method:'POST',headers:{'api-key':'PRIVATE_CANARY'},analysisContext:{diagnosticRun:run}});
 const report=f.d.report();assert.equal(report.schemaVersion,2);assert.equal(report.entries[0].runId,run);assert.equal(report.runs.length,1);
 for(const phase of ['precondition','attempt','response','parse'])assert.ok(report.runs[0].events.some(e=>e.phase===phase),phase);
 assert.ok(!JSON.stringify(report).includes('PRIVATE_CANARY'));assert.ok(!JSON.stringify(report).includes('owner'));
 f.d.reset();assert.equal(f.d.report().runs.length,0);
});
test('pending captures and flow events share a UTF-8 byte bound and expose truncation',async()=>{
 const f=fixture();await f.enable();const run=await f.d.beginRun('automatic');
 for(let i=0;i<140;i++)f.d.event(run,'wait',{durationMs:1000,message:'CANARY'});
 assert.ok(f.d.report().runs[0].truncated);assert.ok(f.d.report().dropped>0);
 const popup={...f.sender,url:'moz-extension://addon/popup.html',documentId:'large-popup'};
 for(let i=0;i<200;i++)await f.d.capture({stage:'start',request:{provider:'urlscan',endpoint:'/api/v1/scan/',body:{kind:'text',shape:{data:Array.from({length:8},()=>({attributes:Array.from({length:8},()=>({count:123456789}))}))}}}},popup);
 const report=f.d.report();assert.ok(Buffer.byteLength(JSON.stringify(report))<1048576);assert.ok(report.pending.length<=200);assert.ok(!JSON.stringify(report).includes('CANARY'));f.d.reset();
});

test('policy and local cooldown are prerequisites, not invented HTTP responses',async()=>{
 const f=fixture();await f.enable();
 f.g.beforeRequest=async()=>{throw Object.assign(Error('CANARY'),{code:'EXTERNAL_ANALYSIS_DISABLED'});};
 await assert.rejects(f.g.fetchWithTimeout(url,{method:'POST'}));
 let r=f.d.report(),op=r.entries[0];assert.equal(op.networkStarted,false);assert.equal(f.calls.length,0);assert.equal(op.reason,'policy_blocked');assert.ok(!r.runs[0].events.some(e=>e.phase==='response'));
 f.g.beforeRequest=null;f.g.setBackoff('hybrid-analysis.com',60);
 await f.g.fetchWithTimeout(url,{method:'POST'});r=f.d.report();op=r.entries[1];assert.equal(op.localBackoff,true);assert.equal(op.networkStarted,false);assert.equal(f.calls.length,0);assert.ok(!r.runs[1].events.some(e=>e.phase==='response'));f.d.reset();
});
test('an operation does not prematurely finish an explicitly owned pipeline and abandoned flows stay unconfirmed',async()=>{
 const f=fixture();await f.enable();const id=await f.d.beginRun('manual');
 await f.g.fetchWithTimeout(url,{method:'POST',analysisContext:{diagnosticRun:id}});
 assert.equal(f.d.report().runs[0].state,'running');f.d.event(id,'persistence',{state:'failed',reason:'storage_failed'});f.d.endRun(id,'incomplete');assert.equal(f.d.report().runs[0].state,'incomplete');
 const abandoned=await f.d.beginRun('analysis');f.advance(300001);assert.equal(f.d.report().runs.find(r=>r.id===abandoned).state,'unconfirmed');f.d.reset();
});
