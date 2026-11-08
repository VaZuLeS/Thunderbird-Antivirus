const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const calls=[],settings={externalAnalysisConsent:false,privacyTier:'strict'};let granted=true,body={},status=200,hang=false,malformed=false;
 const c=vm.createContext({URL,Headers,Response,AbortController,TextEncoder,setTimeout,clearTimeout,console:{warn(){},error(){}},browser:{storage:{local:{get:async()=>settings}},permissions:{contains:async()=>granted}},fetch:async(url,options)=>{calls.push({url,options});if(hang)return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error('Aborted'),{name:'AbortError'}))));return new Response(malformed?'not json':JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});}});
 vm.runInContext((fs.readFileSync('provider_results.js','utf8')+'\n'+fs.readFileSync('provider_registry.js','utf8'))+'\n'+fs.readFileSync('analysis_status.js','utf8')+'\n'+fs.readFileSync('api_gateway.js','utf8')+'\nglobalThis.registry=ThundyProviders;globalThis.gateway=apiGateway;',c);
 return {c,calls,settings,setGranted:v=>granted=v,setHang:v=>hang=v,setResponse:(s,b={},invalid=false)=>{status=s;body=b;malformed=invalid;}};
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
