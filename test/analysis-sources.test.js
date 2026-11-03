const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('analysis_status.js','utf8');
function model(){const c=vm.createContext({URL,Date});vm.runInContext(source+'\nglobalThis.analysis=ThundyAnalysis;',c);return c.analysis;}
test('partial and failed local input survive storage and render in all six languages with live updates',()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
  const dom=new JSDOM('<html lang="'+lang+'"><body></body></html>');
  try{
   const c=vm.createContext({document:dom.window.document,URL,Date});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);
   const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),labels=c.a.labels(key=>catalog[key]?.message || 'MISSING:'+key);
   const m=c.a.create({schemaVersion:2,local:{state:'incomplete',reason:'decryption_unavailable',observedAt:123},rows:[]});
   assert.equal(m.data.local.state,'incomplete');assert.equal(m.data.local.observedAt,123);
   const host=c.a.render(m.data,labels);assert.ok(host.shadowRoot.textContent.includes(catalog.analysisLocalIncomplete.message));
   assert.ok(!host.shadowRoot.textContent.includes(catalog.analysisLocalChecked.message));
   m.data.local.state='failed';c.a.render(m.data,labels);
   assert.ok(host.shadowRoot.textContent.includes(catalog.analysisLocalUnavailable.message));
   assert.ok(host.shadowRoot.querySelector('.live').textContent.includes(catalog.analysisLocalUnavailable.message));
   m.data.local.state='checked';c.a.render(m.data,labels);
   assert.ok(host.shadowRoot.textContent.includes(catalog.analysisLocalChecked.message));
   assert.ok(!host.shadowRoot.textContent.includes('MISSING:'));
  }finally{dom.window.close();}
 }
});
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

test('first external request, submission, loss and failure are visible in the headline before any usable result',()=>{
 const catalog=JSON.parse(fs.readFileSync('_locales/de/messages.json'));
 const dom=new JSDOM('<html lang="de"><body></body></html>');
 try{
 const c=vm.createContext({URL,Date,document:dom.window.document});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);
 const labels=c.a.labels(key=>catalog[key].message),m=c.a.create();m.data.local.state='checked';
 m.event({provider:'urlscan',scope:'url',resource:'link:0',phase:'start'});
 const check=key=>{c.a.render(m.data,labels);const card=dom.window.document.getElementById('thundy-analysis-status').shadowRoot.querySelector('.card');assert.ok(card.querySelector('.mode').textContent.includes(catalog.analysisMixed.message));assert.ok(card.querySelector('.phase').textContent.includes(catalog[key].message));};
 check('analysisModeRunning');m.event({provider:'urlscan',scope:'url',resource:'link:0',phase:'finish',state:'submitted',verdict:'unknown',responded:true,observedAt:100});check('analysisModeSubmitted');
 m.event({provider:'urlscan',scope:'url',resource:'link:0',phase:'start'});m.event({provider:'urlscan',scope:'url',resource:'link:0',phase:'finish',state:'failed',verdict:'unknown',responded:false});check('analysisModePartial');
 const restarted=c.a.create({schemaVersion:2,local:{state:'checked'},rows:[{provider:'urlscan',scope:'url',resource:'link:0',state:'running'}]});c.a.render(restarted.data,labels);assert.ok(dom.window.document.getElementById('thundy-analysis-status').shadowRoot.querySelector('.phase').textContent.includes(catalog.analysisModeIncomplete.message));
 }finally{dom.window.close()}
});

test('resource histories stay separate, schema-1 summaries survive and invalid or excessive references do not hide limits',()=>{
 const a=model(),m=a.create({schemaVersion:1,rows:[{provider:'hybridanalysis',scope:'hash',state:'checked',verdict:'malicious',observedAt:20,responses:1}]});
 for(const [resource,verdict,time] of [['attachment:1.2','none',100],['attachment:1.3','suspicious',200],['link:0','none',300],['link:1','malicious',400]])m.event({provider:'hybridanalysis',scope:'hash',resource,phase:'cache',state:'checked',verdict,observedAt:time});
 const loaded=a.create(JSON.parse(JSON.stringify(m.data)));assert.equal(loaded.data.schemaVersion,2);assert.equal(loaded.data.rows.length,5);assert.equal(loaded.data.rows.find(r=>r.resource===null).verdict,'malicious');assert.equal(loaded.data.rows.find(r=>r.resource==='attachment:1.2').verdict,'none');assert.equal(loaded.data.rows.find(r=>r.resource==='link:1').observedAt,400);
 assert.equal(m.event({provider:'hybridanalysis',scope:'hash',resource:'https://secret.invalid',phase:'start'}),false);
 for(let i=2;i<1300;i++)m.event({provider:'urlhaus',scope:'domain',resource:'link:'+i,phase:'start'});
 assert.equal(m.data.rows.length,1200);assert.equal(m.data.truncated,true);
});

test('source refresh preserves each open resource and keyboard focus, and announces changed external status only',()=>{
 const dom=new JSDOM('<html lang="en"><body></body></html>',{pretendToBeVisual:true});
 try{
 const c=vm.createContext({URL,Date,document:dom.window.document});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);
 const catalog=JSON.parse(fs.readFileSync('_locales/en/messages.json')),labels=c.a.labels(key=>catalog[key].message),m=c.a.create();m.data.local.state='checked';
 m.event({provider:'urlhaus',scope:'domain',resource:'link:0',phase:'start'});const data=()=>({...m.data,resourceLabels:{'link:0':'https://a.invalid/path','attachment:1.2':'same.txt (1.2)'}});
 const host=c.a.render(data(),labels),root=host.shadowRoot;
 const detail=root.querySelector('details');detail.open=true;detail.querySelector('summary').focus();const key=detail.dataset.key;
 m.event({provider:'urlhaus',scope:'domain',resource:'link:0',phase:'finish',state:'checked',verdict:'none',responded:true,observedAt:100});assert.equal(c.a.render(data(),labels),host);
 assert.equal(root.activeElement.dataset.focusKey,key);assert.equal(Array.from(root.querySelectorAll('details')).find(node=>node.dataset.key===key).open,true);assert.ok(root.querySelector('.live').textContent.includes(catalog.analysisModeResults.message));
 assert.ok(root.textContent.includes(catalog.analysisResourceNoExternal.message));assert.ok(root.textContent.includes(catalog.analysisResourceTarget.message));assert.ok(root.textContent.includes(catalog.analysisResourceLocal.message));
 const unchanged=root.querySelector('.live').textContent;c.a.render(data(),labels);assert.equal(root.querySelector('.live').textContent,unchanged);
 }finally{dom.window.close()}
});

test('unbound history retains source times and states without resource data or mutating originals',()=>{
 const a=model(),snapshot={schemaVersion:2,local:{state:'checked',observedAt:5},rows:[{provider:'hybridanalysis',scope:'report',resource:'attachment:1.2',state:'running',verdict:'malicious',responses:1,observedAt:10,findingAt:9}]};
 const record={analysisStatus:snapshot,analysisStatusByMessage:{7:snapshot},analysisSourceSnapshots:{saved:{snapshot}},attachments:[{partName:'1.2',attachment_name:'secret.txt',hybrid_sha256:'private-hash',report:{verdict:'suspicious'}}]};
 const original=JSON.stringify(record),history=a.history(record);
 assert.ok(history.rows.some(row=>row.state==='incomplete'&&row.observedAt===10&&row.findingAt===9));
 assert.ok(history.rows.every(row=>row.resource===null&&row.source==='stored'&&row.active===0));
 assert.ok(!JSON.stringify(history).includes('secret.txt'));assert.ok(!JSON.stringify(history).includes('private-hash'));assert.equal(JSON.stringify(record),original);
 assert.ok(a.history({...record,analysisStatus:null,analysisStatusLegacy:null,analysisStatusByMessage:{missing:null,7:snapshot}}).rows.some(row=>row.observedAt===10));
 const tooMany={analysisStatusByMessage:Object.fromEntries(Array.from({length:130},(_,i)=>[String(i),{schemaVersion:2,rows:[]}]))};
 assert.equal(a.history(tooMany).truncated,true);
});

test('all six views separate historical services from current verdicts and expose unsaved observations',()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
  const dom=new JSDOM('<html lang="'+lang+'"><body></body></html>',{pretendToBeVisual:true});
  try{
   const c=vm.createContext({document:dom.window.document,URL,Date});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);
   const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),labels=c.a.labels(key=>catalog[key]?.message || 'MISSING:'+key);
   const history=c.a.history({analysisStatus:{schemaVersion:2,rows:c.a.providers.map(provider=>({provider,scope:'report',resource:'message',state:'checked',verdict:'malicious',responses:1,observedAt:10}))}});
   const data={local:{state:'checked'},rows:[],sourceHistory:history};const host=c.a.render(data,labels),root=host.shadowRoot;
   assert.equal(root.querySelector('.mode').textContent,catalog.analysisLocal.message);
   assert.equal(root.querySelector('.card').style.borderColor,'');
   const detail=root.querySelector('[data-key="unbound-history"]');
   for(const brand of ['Hybrid Analysis','VirusTotal','URLhaus','AbuseIPDB','urlscan.io'])assert.ok(detail.querySelector('summary').textContent.includes(brand));
   assert.ok(detail.textContent.includes(catalog.analysisHistoryWarning.message));
   detail.open=true;detail.querySelector('summary').focus();
   c.a.render({...data,sourcePersistenceFailed:true,reportArchiveBlocked:true},labels);
   assert.equal(root.querySelector('[data-key="unbound-history"]').open,true);assert.equal(root.activeElement.dataset.focusKey,'unbound-history');
   assert.ok(root.querySelector('.live').textContent.includes(catalog.analysisPersistenceFailed.message));assert.ok(root.textContent.includes(catalog.analysisReportArchiveBlocked.message));assert.ok(!root.textContent.includes('MISSING:'));
  }finally{dom.window.close();}
 }
});

test('serialized mail renderer can display history without module globals',()=>{
 const a=model(),catalog=JSON.parse(fs.readFileSync('_locales/en/messages.json'));
 const dom=new JSDOM('<html lang="en"><body></body></html>');
 try{
  const c=vm.createContext({document:dom.window.document,Date,labels:a.labels(key=>catalog[key]?.message),data:{local:{state:'checked'},rows:[],sourceHistory:{rows:[{provider:'urlscan',scope:'url',state:'submitted',verdict:'unknown',observedAt:100}]},reportArchiveBlocked:true}});
  vm.runInContext('('+a.render.toString()+')(data,labels)',c);
  const root=dom.window.document.getElementById('thundy-analysis-status').shadowRoot;
  assert.ok(root.querySelector('[data-key="unbound-history"]').textContent.includes('urlscan.io'));
  assert.ok(root.textContent.includes(catalog.analysisHistoryWarning.message));
 }finally{dom.window.close();}
});


test('archived protocol payloads appear only as unbound historical observations',()=>{
 const a=model();const record={analysisReportArchive:{schemaVersion:1,entries:[{kind:'attachment',slot:0,resource:{partName:'1.2',attachment_name:'private.bin',hybrid_sha256:'private-hash',report:{state:'COMPLETE',verdict:'malicious'},report_fetched_at:'2026-10-02T08:00:00Z',virustotal_stats:{malicious:2}}}]}};
 const history=a.history(record);assert.equal(history.rows.length,2);assert.ok(history.rows.every(row=>row.resource===null&&row.source==='stored'));
 assert.ok(history.rows.some(row=>row.observedAt===Date.parse('2026-10-02T08:00:00Z')));assert.ok(!JSON.stringify(history).includes('private.bin'));assert.ok(!JSON.stringify(history).includes('private-hash'));
 assert.equal(a.create().data.rows.length,0);
});
