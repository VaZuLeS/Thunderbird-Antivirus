const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('analysis_status.js','utf8');
function model(){const c=vm.createContext({URL,Date});vm.runInContext(source+'\nglobalThis.analysis=ThundyAnalysis;',c);return c.analysis;}
test('all five services classify actual responses, submission is separate from completed analysis',()=>{
 const a=model();for(const [url,method,data,provider,scope,state] of [
 ['https://hybrid-analysis.com/api/v2/overview/hash','GET',{verdict:'malicious'},'hybridanalysis','hash','checked'],
 ['https://hybrid-analysis.com/api/v2/quick-scan/file','POST',{job_id:'job'},'hybridanalysis','file','submitted'],
 ['https://www.virustotal.com/api/v3/files/hash','GET',{data:{attributes:{last_analysis_stats:{malicious:0}}}},'virustotal','hash','checked'],
 ['https://urlhaus-api.abuse.ch/v1/host/','POST',{query_status:'no_results'},'urlhaus','domain','checked'],
 ['https://api.abuseipdb.com/api/v2/check','GET',{data:{abuseConfidenceScore:90}},'abuseipdb','ip','checked'],
 ['https://urlscan.io/api/v1/scan/','POST',{uuid:'id'},'urlscan','url','submitted'],
 ['https://urlscan.io/api/v1/result/id/','GET',{verdicts:{overall:{malicious:false}}},'urlscan','url','checked'],
 ]){const spec=a.spec(url,method);assert.equal(spec.provider,provider);assert.equal(spec.scope,scope);assert.equal(a.response(spec,200,data).state,state)}
 assert.equal(a.response({provider:'urlscan'},200,{verdicts:{overall:{}}}).state,'received');
 assert.equal(a.response({provider:'hybridanalysis',scope:'file'},200,{}).state,'received');
 assert.equal(a.spec('https://virustotal.com.attacker.invalid/x'),null);
});
test('failed refresh and cache hits never freshen an older finding; mixed outcomes retain warning',()=>{
 const a=model(),m=a.create();
 const base={provider:'urlhaus',scope:'domain'};m.event({...base,phase:'start'});m.event({...base,phase:'finish',state:'checked',verdict:'malicious',observedAt:100,responded:true});
 m.event({...base,phase:'start'});m.event({...base,phase:'finish',state:'failed',verdict:'unknown',observedAt:200,responded:true});
 m.event({...base,phase:'cache',state:'checked',verdict:'none',observedAt:50});
 const r=m.data.rows[0];assert.equal(r.observedAt,100);assert.equal(r.findingAt,100);assert.equal(r.verdict,'malicious');assert.equal(r.failures,1);assert.equal(r.source,'cache');
 assert.equal(a.create(JSON.parse(JSON.stringify(m.data))).data.rows[0].source,'stored');
 const pending=a.create({schemaVersion:1,rows:[{provider:'urlscan',scope:'url',state:'running',verdict:'unknown'}]});assert.equal(pending.data.rows[0].state,'incomplete');assert.equal(pending.data.rows[0].responses,0);
});
test('legacy data proves only actual provider records, never an API key or a local hash',()=>{
 const a=model();assert.equal(a.legacy({attachments:[{state:'MANUAL_CHECK_PENDING',hybrid_sha256:'hash'}],apikey:'key'}).rows.length,0);
 const d=a.legacy({attachments:[{state:'UPLOADED',created:new Date(),virustotal_stats:{malicious:1}}]});assert.equal(d.rows.length,2);assert.equal(d.rows[0].state,'submitted');assert.equal(d.rows[0].observedAt,null);assert.equal(d.rows[1].verdict,'malicious');assert.equal(d.rows[1].source,'stored');
 assert.doesNotThrow(()=>a.create({schemaVersion:1,rows:{}}));
});
test('same renderer shows local, mixed, errors and all service names in all six languages',()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
 const dom=new JSDOM('<html lang="'+lang+'"><body><div id="analysisSourceMount"></div></body></html>');try{
 const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json'));const c=vm.createContext({document:dom.window.document,URL,Date});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);const labels=c.a.labels(key=>catalog[key]?.message||'MISSING:'+key);
 c.a.render({local:{state:'checked'},rows:[],availability:{}},labels);let root=dom.window.document.getElementById('thundy-analysis-status').shadowRoot;assert.ok(root.textContent.includes(catalog.analysisLocal.message));
 for(const brand of ['Hybrid Analysis','VirusTotal','URLhaus','AbuseIPDB','urlscan.io'])assert.ok(root.textContent.includes(brand));
 const m=c.a.create();m.data.local.state='checked';m.event({provider:'hybridanalysis',scope:'report',phase:'cache',state:'checked',verdict:'malicious',observedAt:123});
 c.a.render(m.data,labels);root=dom.window.document.getElementById('thundy-analysis-status').shadowRoot;assert.ok(root.textContent.includes(catalog.analysisMixed.message));assert.ok(root.textContent.includes(catalog.analysisSource_cache.message));assert.ok(root.textContent.includes(catalog.analysisVerdict_malicious.message));assert.ok(!root.textContent.includes('MISSING:'));
 dom.window.document.documentElement.dataset.thundyAnalysisMessage='new';assert.equal(c.a.render({...m.data,messageId:'old'},labels),null);
 }finally{dom.window.close()}
 }
});
test('gateway observes every supported provider without transmitting observer metadata',async()=>{
 const c=vm.createContext({URL,Date,AbortController,setTimeout,clearTimeout,console,fetch:async(_u,options)=>{assert.equal(options.analysisContext,undefined);return {status:200,ok:true,json:async()=>({verdict:'no specific threat'})}}});vm.runInContext(source+'\n'+fs.readFileSync('api_gateway.js','utf8')+'\nglobalThis.a=ThundyAnalysis;globalThis.gateway=apiGateway;',c);
 const m=c.a.create(),ctx={event:e=>m.event(e)};await c.gateway.fetchWithTimeout('https://hybrid-analysis.com/api/v2/overview/hash',{analysisContext:ctx});assert.equal(m.data.rows[0].state,'checked');assert.equal(m.data.rows[0].source,'remote');
 c.fetch=async()=>{throw new Error('offline')};await assert.rejects(c.gateway.fetchWithTimeout('https://urlhaus-api.abuse.ch/v1/host/',{analysisContext:ctx}));assert.equal(m.data.rows[1].state,'failed');assert.equal(m.data.rows[1].responses,0);
});
