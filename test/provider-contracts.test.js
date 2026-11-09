const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const calls=[],settings={externalAnalysisConsent:false,privacyTier:'strict'};let granted=true,body={},status=200,hang=false,malformed=false,responseHeaders={},now=Date.now();
 const c=vm.createContext({URL,Headers,Response,AbortController,TextEncoder,setTimeout,clearTimeout,Date:class extends Date{static now(){return now;}},console:{warn(){},error(){}},browser:{storage:{local:{get:async()=>settings}},permissions:{contains:async()=>granted}},fetch:async(url,options)=>{calls.push({url,options});if(hang)return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error('Aborted'),{name:'AbortError'}))));return new Response(malformed?'not json':JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...responseHeaders}});}});
 vm.runInContext((fs.readFileSync('provider_results.js','utf8')+'\n'+fs.readFileSync('provider_registry.js','utf8'))+'\n'+fs.readFileSync('analysis_status.js','utf8')+'\n'+fs.readFileSync('api_gateway.js','utf8')+'\nglobalThis.registry=ThundyProviders;globalThis.gateway=apiGateway;',c);
 return {c,calls,settings,advance:ms=>now+=ms,setGranted:v=>granted=v,setHang:v=>hang=v,setResponse:(s,b={},invalid=false,headers={})=>{status=s;body=b;malformed=invalid;responseHeaders=headers;}};
}
test('every service uses its fixed-data test without communication consent, with exact auth and redirection refusal',async()=>{
 for(const [id,conf] of Object.entries(fixture().c.registry.registry)){
  const f=fixture();const result=await f.c.registry.test(id,'private-key-123');
  assert.equal(result.status,'valid',id);assert.equal(result.uploadVerified,false);assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].url,conf.test.url);assert.equal(f.calls[0].options.headers[conf.header],'private-key-123');assert.equal(f.calls[0].options.redirect,'error');
  assert.equal(f.calls[0].options.keyTest,undefined);assert.equal(f.calls[0].options.body||'',conf.test.body||'');
 }
});
test('provider tests distinguish refusal, accepted 404, exhausted quota, malformed responses and absent keys',async()=>{
 for(const id of Object.keys(fixture().c.registry.registry)){
  for(const [http,status] of [[401,'invalid_key'],[403,'invalid_key'],[404,'valid'],[429,'rate_limited'],[500,'error']]){
   const f=fixture();f.setResponse(http);assert.equal((await f.c.registry.test(id,'private-key-123')).status,status,id+' '+http);
  }
  const absent=fixture();assert.equal((await absent.c.registry.test(id,'')).status,'empty');assert.equal(absent.calls.length,0);
  const denied=fixture();denied.setGranted(false);assert.equal((await denied.c.registry.test(id,'key')).status,'permission_denied');assert.equal(denied.calls.length,0);
  const malformed=fixture();malformed.setResponse(200,{},true);assert.equal((await malformed.c.registry.test(id,'key')).status,'error');
 }
 const f=fixture();f.setResponse(200,{query_status:'invalid_api_key'});assert.equal((await f.c.registry.test('urlhaus','key')).status,'invalid_key');
});
test('regular requests require consent and tier at send time; test mode cannot send arbitrary message data',async()=>{
 const f=fixture();
 await assert.rejects(f.c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/',{method:'POST',body:'{}'}),/EXTERNAL_ANALYSIS_DISABLED/);
 f.settings.externalAnalysisConsent=true;
 await assert.rejects(f.c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/',{method:'POST',body:'{}'}),/TIER_BLOCKS_REQUEST/);
 await assert.rejects(f.c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/',{method:'POST',body:'private URL',keyTest:true}),/KEY_TEST_INVALID/);
 await assert.rejects(f.c.gateway.fetchWithTimeout('https://evil.example/',{keyTest:true}),/PROVIDER_UNKNOWN/);
 f.settings.privacyTier='max';await f.c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/',{method:'POST',body:'{}'});assert.equal(f.calls.length,1);
});
test('queued requests recheck revoked consent and normalized fields omit arbitrary provider payload',async()=>{
 const f=fixture();f.settings.externalAnalysisConsent=true;
 let revoke=false;f.c.gateway.beforeRequest=()=>{if(revoke)f.settings.externalAnalysisConsent=false;revoke=true;};
 await assert.rejects(f.c.gateway.fetchWithTimeout('https://www.virustotal.com/api/v3/files/abc'),/EXTERNAL_ANALYSIS_DISABLED/);assert.equal(f.calls.length,0);
 const data={data:{attributes:{last_analysis_stats:{malicious:2,suspicious:1,undetected:7}}},key:'do-not-export',password:'do-not-export'};
 const normalized=f.c.registry.metadata('virustotal',data,200);
 assert.equal(normalized.maliciousCount,2);assert.equal(normalized.totalCount,10);assert.ok(!JSON.stringify(normalized).includes('do-not-export'));
});

test('response sanitization excludes authentication fields and echoed keys before storage or rendering',()=>{
 const f=fixture();f.c.gateway.setApikey('virustotal','secret-api-key-123');
 const result=f.c.gateway.sanitizeResponse({api_key:'secret-api-key-123',nested:{Authorization:'Bearer secret-api-key-123',message:'echo secret-api-key-123',statistics:{malicious:2}}});
 assert.ok(!JSON.stringify(result).includes('secret-api-key-123'));assert.equal(result.nested.statistics.malicious,2);
});

test('provider-specific scores remain attributed values rather than normalized probabilities',()=>{
 const r=fixture().c.registry;assert.equal(r.metadata('abuseipdb',{data:{abuseConfidenceScore:87,totalReports:9}},200).providerScore,87);
 assert.equal(r.metadata('urlscan',{verdicts:{overall:{score:65}}},200).providerScore,65);assert.equal(r.metadata('hybridanalysis',{threat_score:73},200).providerScore,73);
 assert.equal(r.metadata('urlhaus',{query_status:'no_results'},200).providerVerdict,'no_results');
});

test('Hybrid and urlscan preserve typed errors, pending 404 and successful unknown responses through shared transport',async()=>{
 for(const [provider,url] of [['hybridanalysis','https://hybrid-analysis.com/api/v2/quick-scan/synthetic'],['urlscan','https://urlscan.io/api/v1/result/synthetic/']]){
  for(const status of [401,403,404,429]){
   const f=fixture(),events=[];f.settings.externalAnalysisConsent=true;f.settings.privacyTier='max';f.setResponse(status);
   await f.c.gateway.fetchWithTimeout(url,{analysisContext:{event:e=>events.push(e)}});
   const finish=events.find(e=>e.phase==='finish');assert.equal(finish.verdict,'unknown');assert.equal(finish.httpStatus,status);assert.equal(finish.completion,status===404?provider==='urlscan'?'pending':'unknown':'failed');
  }
  const malformed=fixture();malformed.settings.externalAnalysisConsent=true;malformed.settings.privacyTier='max';malformed.setResponse(200,{},true);await assert.rejects(malformed.c.gateway.fetchWithTimeout(url));
  const stalled=fixture();stalled.settings.externalAnalysisConsent=true;stalled.settings.privacyTier='max';stalled.setHang(true);await assert.rejects(stalled.c.gateway.fetchWithTimeout(url,{},10));assert.equal(stalled.c.gateway.controllers.size,0);
 }
});

test('resource validation rejects foreign report bodies before any verdict is emitted',async()=>{
 const f=fixture();f.settings.externalAnalysisConsent=true;f.settings.privacyTier='max';f.setResponse(200,{task:{uuid:'foreign'},verdicts:{overall:{malicious:true}}});const events=[];
 await assert.rejects(f.c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/result/requested/',{analysisContext:{event:e=>events.push(e),validateResponse:data=>{if(data.task.uuid!=='requested')throw Object.assign(Error('RESOURCE_MISMATCH'),{code:'RESOURCE_MISMATCH'});}}}),/RESOURCE_MISMATCH/);
 assert.ok(events.every(e=>e.verdict!=='malicious'));assert.equal(events.at(-1).state,'failed');assert.equal(events.at(-1).errorCode,'RESOURCE_MISMATCH');
});

test('urlscan submission errors have identical typed meanings in the shared transport model',async()=>{
 for(const [body,expected] of [[{message:'DNS Error - Could not resolve domain'},'domain_unresolvable'],[{code:'validationerror',message:'CANARY_PRIVATE'},'invalid_request'],[{message:'Blocked CANARY_PRIVATE'},'submission_rejected'],[{errors:{some:'invalid'}},'submission_rejected']]){
  const f=fixture();f.settings.externalAnalysisConsent=true;f.settings.privacyTier='max';f.setResponse(400,body);const events=[];
  await f.c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/',{method:'POST',analysisContext:{event:e=>events.push(e)}});
  const event=events.at(-1);assert.equal(event.errorCode,expected);assert.equal(event.state,'failed');assert.equal(event.verdict,'unknown');assert.ok(!JSON.stringify(event).includes('CANARY_PRIVATE'));
 }
});

const scanAddress='https://urlscan.io/api/v1/scan/';
const scanOptions={method:'POST',body:JSON.stringify({url:'https://synthetic.invalid/path?private=CANARY_RESOURCE',visibility:'unlisted'})};
function quotaFixture(){const f=fixture();f.settings.externalAnalysisConsent=true;f.settings.privacyTier='max';return f;}

test('urlscan submission cooldown leaves result retrieval, search and other services available',async()=>{
 const f=quotaFixture();f.setResponse(429,{},false,{'X-Rate-Limit-Scope':'user','X-Rate-Limit-Window':'day','X-Rate-Limit-Reset-After':'7200'});
 const first=await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions);assert.equal(first.status,429);assert.equal(f.calls.length,1);
 const wait=f.c.gateway.getBackoff('urlscan.io:submit-unlisted');assert.equal(wait.remainingSeconds,7200);
 f.setResponse(200,{task:{uuid:'known'},verdicts:{overall:{malicious:false}}});
 await f.c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/result/known/');
 await f.c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/search/?q=domain:example.com');
 await f.c.gateway.fetchWithTimeout('https://hybrid-analysis.com/api/v2/overview/synthetic');
 assert.equal(f.calls.length,4);assert.equal((await f.c.gateway.fetchWithTimeout('https://www.urlscan.io/api/v1/scan/',scanOptions)).status,429);assert.equal(f.calls.length,4);
 f.advance(7200001);assert.equal((await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions)).status,200);assert.equal(f.calls.length,5);
});

test('a successful response with zero remaining quota keeps its assessment and defers only its own operation',async()=>{
 const f=quotaFixture(),events=[];const reset=new Date(Date.now()+600000).toISOString();
 f.setResponse(200,{verdicts:{overall:{malicious:false}}},false,{'X-Rate-Limit-Remaining':'0','X-Rate-Limit-Limit':'30','X-Rate-Limit-Reset':reset,'X-Rate-Limit-Window':'minute'});
 const address='https://urlscan.io/api/v1/result/existing/';await f.c.gateway.fetchWithTimeout(address,{analysisContext:{event:e=>events.push(e)}});
 const response=events.at(-1);assert.equal(response.verdict,'none');assert.equal(response.quotaRemaining,0);assert.equal(response.quotaLimit,30);assert.equal(response.quotaAction,'result');
 assert.equal((await f.c.gateway.fetchWithTimeout(address)).status,429);assert.equal(f.calls.length,1);
 f.setResponse(200,{uuid:'new-id'});assert.equal((await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions)).status,200);assert.equal(f.calls.length,2);
});

test('queued submissions recheck newly learned cooldowns without a second POST or invented HTTP response',async()=>{
 const f=quotaFixture(),events=[];let release;f.c.fetch=async(url,options)=>{f.calls.push({url,options});await new Promise(resolve=>release=resolve);return new Response('{}',{status:429,headers:{'Retry-After':'120'}});};
 const first=f.c.gateway.fetchWithTimeout(scanAddress,scanOptions);await new Promise(setImmediate);
 const second=f.c.gateway.fetchWithTimeout(scanAddress,{...scanOptions,analysisContext:{event:e=>events.push(e)}});await new Promise(setImmediate);release();
 assert.equal((await first).status,429);assert.equal((await second).status,429);assert.equal(f.calls.length,1);
 const event=events.at(-1);assert.equal(event.responded,false);assert.equal(event.localBackoff,true);assert.equal(event.httpStatus,undefined);assert.equal(event.observedAt,null);assert.equal(event.quotaAction,'submit-unlisted');assert.equal(event.retryAfter,120);
 assert.ok(!JSON.stringify(event).includes('CANARY_RESOURCE'));assert.equal(f.c.gateway.active.get('submit:urlscan'),0);
});

test('revocation wins over a cached provider cooldown',async()=>{
 const f=quotaFixture();f.setResponse(429,{},false,{'Retry-After':'60'});await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions);
 f.settings.externalAnalysisConsent=false;await assert.rejects(f.c.gateway.fetchWithTimeout(scanAddress,scanOptions),/EXTERNAL_ANALYSIS_DISABLED/);assert.equal(f.calls.length,1);
});

test('quota parsing rejects malformed values, uses the longer valid reset and caps waits at one day',async()=>{
 const f=quotaFixture();
 for(const [headers,expected] of [[{'Retry-After':'-1','X-Rate-Limit-Reset-After':'invalid'},60],[{'Retry-After':'10','X-Rate-Limit-Reset-After':'30'},30],[{'Retry-After':'999999999'},86400]]){
  f.c.gateway.clearBackoffs();f.setResponse(429,{},false,headers);await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions);assert.equal(f.c.gateway.getBackoff('urlscan.io:submit-unlisted').remainingSeconds,expected);
 }
 f.c.gateway.clearBackoffs();f.setResponse(200,{uuid:'accepted'},false,{'X-Rate-Limit-Remaining':'0oops','X-Rate-Limit-Reset-After':'-1'});await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions);assert.equal(f.c.gateway.getBackoff('urlscan.io:submit-unlisted'),null);
});

test('credential replacement clears user-scoped quotas but preserves IP quotas and POSTs never retry',async()=>{
 const f=quotaFixture();f.c.gateway.setApikey('urlscan','old-synthetic-key');
 f.setResponse(429,{},false,{'X-Rate-Limit-Scope':'user','Retry-After':'0'});await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions);assert.equal(f.calls.length,1);
 f.c.gateway.setApikey('urlscan','new-synthetic-key');assert.equal(f.c.gateway.getBackoff('urlscan.io:submit-unlisted'),null);
 f.setResponse(429,{},false,{'X-Rate-Limit-Scope':'ip-address','Retry-After':'90'});await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions);f.c.gateway.setApikey('urlscan','another-synthetic-key');assert.equal(f.c.gateway.getBackoff('urlscan.io:submit-unlisted').remainingSeconds,90);
 assert.ok(!JSON.stringify([...f.c.gateway.backoffs]).includes('synthetic-key'));
});

test('a locally deferred key test does not claim another provider HTTP response',async()=>{
 const f=quotaFixture();f.setResponse(429,{},false,{'X-Rate-Limit-Reset-After':'120'});
 const first=await f.c.registry.test('urlscan','synthetic-key');assert.equal(first.httpStatus,429);
 const second=await f.c.registry.test('urlscan','synthetic-key');assert.equal(second.status,'rate_limited');assert.equal(second.httpStatus,null);assert.equal(second.localBackoff,true);assert.equal(f.calls.length,1);
});

test('public, private and unlisted submissions have distinct rate buckets without resource identifiers',()=>{
 const f=quotaFixture(),keys=['public','private','unlisted'].map(visibility=>f.c.registry.rateLimit(scanAddress,{...scanOptions,body:JSON.stringify({url:'https://CANARY.invalid/',visibility})}).key);
 assert.equal(new Set(keys).size,3);assert.ok(keys.every(key=>!key.includes('CANARY')));
});

test('documented submission action headers keep a private quota separate from unlisted submissions',async()=>{
 const f=quotaFixture();f.setResponse(429,{},false,{'X-Rate-Limit-Action':'private','X-Rate-Limit-Reset-After':'300'});await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions);
 assert.equal(f.c.gateway.getBackoff('urlscan.io:submit-unlisted'),null);assert.equal(f.c.gateway.getBackoff('urlscan.io:submit-private').remainingSeconds,300);
 f.setResponse(200,{uuid:'accepted'});assert.equal((await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions)).status,200);
 assert.equal((await f.c.gateway.fetchWithTimeout(scanAddress,{...scanOptions,body:JSON.stringify({url:'https://synthetic.invalid',visibility:'private'})})).status,429);assert.equal(f.calls.length,2);
});

test('overlapping user and IP cooldowns survive credential changes independently',async()=>{
 const f=quotaFixture();f.c.gateway.setApikey('urlscan','old-synthetic-key');
 f.c.gateway.setBackoff('urlscan.io:submit-unlisted',7200,{quotaAction:'submit-unlisted',quotaScope:'user'},86400);
 f.c.gateway.setBackoff('urlscan.io:submit-unlisted',90,{quotaAction:'submit-unlisted',quotaScope:'ip-address'},86400);
 assert.equal(f.c.gateway.getBackoff('urlscan.io:submit-unlisted').remainingSeconds,7200);
 f.c.gateway.setApikey('urlscan','new-synthetic-key');assert.equal(f.c.gateway.getBackoff('urlscan.io:submit-unlisted').remainingSeconds,90);
});

test('arbitrary quota action headers cannot become metadata or prototype lookups',async()=>{
 for(const value of ['__proto__','constructor','CANARY']){
  const f=quotaFixture();f.setResponse(429,{},false,{'X-Rate-Limit-Action':value,'Retry-After':'120'});
  assert.equal((await f.c.gateway.fetchWithTimeout(scanAddress,scanOptions)).status,429);assert.equal(f.c.gateway.getBackoff('urlscan.io:submit-unlisted').remainingSeconds,120);
 }
});
