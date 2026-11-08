const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function adapter(){const c=vm.createContext({URL,Date});vm.runInContext(fs.readFileSync('provider_results.js','utf8')+'\n'+fs.readFileSync('analysis_status.js','utf8')+'\nglobalThis.a=ThundyProviderResults;globalThis.model=ThundyAnalysis;',c);return c;}
test('Hybrid Analysis retains malicious evidence despite clean, whitelist and pending components',()=>{
 const {a}=adapter();for(const data of [{verdict:'clean',scanners:[{status:'malicious'}]},{whitelisted:true,scanners_v2:{one:{positives:2,total:35}}},{verdict:'malicious',finished:false,scanners:[{status:'in-progress'}]}]){
  const r=a.evaluate('hybridanalysis',data);assert.equal(r.verdict,'malicious');assert.ok(r.signals.some(s=>s.verdict==='malicious'));
 }
 const r=a.evaluate('hybridanalysis',{verdict:'clean',scanners:[{status:'malicious'},{status:'in-progress'}]});assert.equal(r.completion,'pending');assert.equal(r.state,'incomplete');assert.deepEqual([...r.conflicts],['mixed_verdicts']);
});
test('Hybrid completion is separate from known, unknown and failed findings',()=>{
 const {a}=adapter();for(const [data,completion,verdict] of [[{finished:true,verdict:'unknown'},'complete','unknown'],[{finished:false,verdict:'malicious'},'pending','malicious'],[{state:'ERROR'},'failed','unknown'],[{id:'accepted'},'pending','unknown'],[{},'failed','unknown']]){
  const r=a.evaluate('hybridanalysis',data,'url');assert.equal(r.completion,completion);assert.equal(r.verdict,verdict);
 }
});
test('urlscan uses all three engines; brands alone never upgrade findings or identify visual phishing',()=>{
 const {a,model}=adapter();for(const name of ['overall','urlscan','engines']){const body={verdicts:{[name]:{malicious:true}}};assert.equal(a.evaluate('urlscan',body).verdict,'malicious');assert.equal(model.response({provider:'urlscan'},200,body).verdict,'malicious');}
 for(const brands of [[],['Example'],[{name:'Example'}]])assert.equal(a.evaluate('urlscan',{verdicts:{overall:{malicious:false,score:65},urlscan:{brands}}}).verdict,'suspicious');
 for(const data of [{page:{url:'https://fixture.invalid'}},{verdicts:{overall:{}}}])assert.equal(a.evaluate('urlscan',data).verdict,'unknown');
 assert.equal(a.evaluate('urlscan',{verdicts:{overall:{malicious:false,score:0}}}).verdict,'none');assert.equal(a.evaluate('urlscan',{uuid:'receipt'},'url').completion,'pending');
});
test('partial evidence survives final unknown reports, restart projection and source export without raw secrets',()=>{
 const {a,model}=adapter();const first=a.evaluate('hybridanalysis',{finished:false,verdict:'malicious'}),last=a.evaluate('hybridanalysis',{finished:true,verdict:'unknown'}),combined=a.merge(first,last);
 assert.equal(combined.completion,'complete');assert.equal(combined.verdict,'malicious');assert.equal(a.stored('hybridanalysis',{assessment:combined,report:{finished:true,verdict:'unknown'}}).verdict,'malicious');
 const m=model.create();m.event({provider:'hybridanalysis',scope:'report',resource:'link:0',phase:'finish',responded:true,...combined});const restored=model.create(JSON.parse(JSON.stringify(m.data)));assert.equal(restored.data.rows[0].completion,'complete');assert.equal(restored.data.rows[0].verdict,'malicious');
 const sanitized=a.project({...combined,password:'CANARY',signals:[...combined.signals,{code:'password',verdict:'malicious',value:'CANARY'}],conflicts:['CANARY']});assert.ok(!JSON.stringify(sanitized).includes('CANARY'));
});
test('bounded evidence preserves late malicious findings and conflict representatives',()=>{
 const {a}=adapter();const body={finished:true,scanners:[...Array.from({length:200},()=>({status:'clean'})),{status:'malicious'}]};const r=a.evaluate('hybridanalysis',body);assert.equal(r.verdict,'malicious');assert.ok(r.signals.length<=128);assert.ok(r.signals.some(s=>s.verdict==='malicious'));assert.ok(r.signals.some(s=>s.verdict==='none'));assert.equal(a.stored('hybridanalysis',{assessment:r}).verdict,'malicious');
});
test('shared transport serializes urlscan POST submissions while allowing result GETs',async()=>{
 const started=[],pending=[];let posts=0,max=0;
 const c=vm.createContext({URL,Headers,Response,AbortController,setTimeout,clearTimeout,console,fetch:async(url,options)=>{started.push({url,method:options.method});if(options.method==='POST'){max=Math.max(max,++posts);await new Promise(r=>pending.push(r));posts--;}return new Response(JSON.stringify({uuid:'synthetic'}),{status:200});},browser:{storage:{local:{get:async()=>({externalAnalysisConsent:true,privacyTier:'max'})}},permissions:{contains:async()=>true}}});
 vm.runInContext(fs.readFileSync('provider_results.js','utf8')+'\n'+fs.readFileSync('provider_registry.js','utf8')+'\n'+fs.readFileSync('api_gateway.js','utf8')+'\nglobalThis.gateway=apiGateway;',c);
 const first=c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/',{method:'POST'}),second=c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/',{method:'POST'});await new Promise(setImmediate);assert.equal(pending.length,1);
 await c.gateway.fetchWithTimeout('https://urlscan.io/api/v1/result/synthetic/',{method:'GET'});assert.ok(started.some(s=>s.method==='GET'));pending.shift()();await first;await new Promise(setImmediate);assert.equal(pending.length,1);pending.shift()();await second;assert.equal(max,1);
});

test('processing transitions finish submission rows without fabricating another HTTP response',()=>{
 const {a,model}=adapter(),m=model.create(),base={provider:'urlscan',scope:'url',resource:'link:0'};
 m.event({...base,phase:'start'});m.event({...base,phase:'finish',responded:true,...a.evaluate('urlscan',{uuid:'accepted'},'url'),observedAt:100});
 assert.equal(m.data.rows[0].completion,'pending');assert.equal(m.data.rows[0].responses,1);
 m.event({...base,phase:'assessment',...a.evaluate('urlscan',{verdicts:{overall:{malicious:false,score:0}}}),observedAt:200});
 assert.equal(m.data.rows[0].completion,'complete');assert.equal(m.data.rows[0].responses,1);assert.equal(m.data.rows[0].verdict,'none');assert.equal(m.data.rows[0].source,'remote');
});

test('a benign result from another service never suppresses an applicable malicious finding',()=>{
 const {a}=adapter();const resource={url:'https://fixture.invalid',report:{verdict:'clean'},hybrid_verdict:{status:'MALICIOUS',observedAt:10},urlscan:{status:'CLEAN',assessment:a.evaluate('urlscan',{verdicts:{overall:{malicious:false}}}),observedAt:20}};
 const result=a.resource(resource);assert.equal(result.verdict,'malicious');assert.equal(result.provider,'hybridanalysis');assert.equal(result.observedAt,10);
});
