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

test('Hybrid expert projection keeps API fields separate from secrets, raw protocols and zero defaults',()=>{
 const {a}=adapter(),digest='ab'.repeat(32);
 const raw={sha256:digest,finished:false,verdict:'clean',threat_score:0,password:'CANARY_SECRET',headers:{'api-key':'CANARY_SECRET'},target_url:'https://user:CANARY_SECRET@example.invalid/path?token=CANARY_SECRET#CANARY_SECRET',scanners_v2:{metadefender:{status:'malicious',positives:3,total:35,anti_virus_results:[{product:'Fixture AV',verdict:'Fixture.Trojan',token:'CANARY_SECRET'}]}},reports:['job-123',{job_id:'job-456',environment_id:160,verdict:'malicious',threat_score:85}],mitre_attcks:[{attck_id:'T1059',tactic:'execution',description:'Synthetic technique'}],signatures:[{name:'Synthetic behavior',threat_level:2}],processes:[{name:'fixture.exe',process_id:12,command_line:'--password=CANARY_SECRET',environment:{SECRET:'CANARY_SECRET'}}],domains:['c2.example.invalid'],extracted_files:[{name:'child.exe',sha256:digest,size:12}],total_processes:0};
 const before=JSON.stringify(raw),details=a.hybridDetails(raw),json=JSON.stringify(details);
 assert.equal(JSON.stringify(raw),before);assert.equal(details.schemaVersion,1);assert.equal(details.truncated,false);
 for(const expected of ['metadefender','Fixture AV','Fixture.Trojan','job-123','job-456','T1059','fixture.exe','c2.example.invalid','child.exe','https://example.invalid/path'])assert.ok(json.includes(expected),expected);
 assert.ok(!json.includes('CANARY_SECRET'));assert.ok(!json.includes('command_line'));assert.ok(!json.includes('total_signatures'));
 assert.ok(details.sections.find(s=>s.id==='counts').rows[0].some(f=>f.key==='total_processes'&&f.value===0));
 assert.ok(details.sections.find(s=>s.id==='assessment').rows[0].some(f=>f.key==='finished'&&f.value===false));
 assert.deepEqual(Object.keys(a.project({...a.evaluate('hybridanalysis',raw),hybridReports:details})).sort(),['assessmentVersion','completion','conflicts','signals']);
});

test('Hybrid expert projection bounds display data and tolerates absent, malformed and multiple reports',()=>{
 const {a}=adapter();for(const raw of [null,{},3,{scanners_v2:3,reports:3,processes:[null,4]}])assert.equal(a.hybridDetails(raw).sections.length,0);
 const details=a.hybridDetails([{job_id:'job1',verdict:'clean'},{job_id:'job2',verdict:'malicious',scanners_v2:[{name:'Array scanner',status:'error'}],signatures:Array.from({length:70},()=>({name:'x'.repeat(800),threat_level:2}))}]);
 assert.equal(details.truncated,true);assert.equal(details.sections.find(s=>s.id==='assessment').rows.length,2);assert.equal(details.sections.find(s=>s.id==='scanners').rows[0][0].value,'Array scanner');assert.ok(details.sections.every(s=>s.rows.length<=50));assert.ok(JSON.stringify(details).length<65000);
});

test('expert Hybrid projection refuses explicit foreign report hashes',()=>{
 const {a}=adapter(),expected='ab'.repeat(32),foreign='cd'.repeat(32);
 assert.equal(a.hybridDetails({sha256:foreign,verdict:'malicious'},expected).sections.length,0);
 const detail=a.hybridDetails([{sha256:foreign,verdict:'malicious'},{sha256:expected,verdict:'clean'}],expected);
 assert.ok(!JSON.stringify(detail).includes(foreign));assert.ok(JSON.stringify(detail).includes(expected));
});

test('Hybrid expert details distinguish explicitly empty lists from missing and malformed data',()=>{
 const {a}=adapter(),empty=a.hybridDetails({reports:[],scanners_v2:{},mitre_attcks:[],domains:[],processes:[]});
 for(const id of ['reports','scanners','mitre','network','processes'])assert.ok(empty.emptySections.includes(id),id);
 assert.equal(a.hybridDetails({}).emptySections.length,0);assert.ok(!a.hybridDetails({scanners:[null],processes:[null]}).emptySections.includes('scanners'));
 assert.equal(a.hybridDetails({verdict:'unknown'},123).sections[0].id,'assessment');
});
