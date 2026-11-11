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
