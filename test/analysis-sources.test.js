const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('analysis_status.js','utf8');
function model(){const c=vm.createContext({URL,Date});vm.runInContext(source+'\nglobalThis.analysis=ThundyAnalysis;',c);return c.analysis;}
test('malformed stored rows and resource collections do not hide valid provider history',()=>{
 const a=model();
 const rows=a.providers.map(provider=>({provider,scope:'report',state:'checked',verdict:'malicious',responses:1,observedAt:12}));
 const stored={schemaVersion:2,rows:[null,7,[],...rows]},record={attachments:{unexpected:true},links:[null],analysisStatus:stored},before=JSON.stringify(record);
 const restored=a.create(stored);assert.equal(restored.data.rows.length,5);assert.equal(restored.data.sourceDataIncomplete,true);
 const history=a.history(record);assert.equal(history.rows.length,5);assert.equal(history.sourceDataIncomplete,true);
 assert.ok(history.rows.every(row=>row.verdict==='malicious'&&row.resource===null));assert.equal(JSON.stringify(record),before);
});

test('responses without a verdict and current authorization remain distinct in both six-language views',()=>{
 const a=model();
 for(const lang of ['en','de','fr','es','it','pl'])for(const serialized of [false,true]){
  const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),labels=a.labels(k=>catalog[k]?.message);
  for(const provider of a.providers){
   const dom=new JSDOM('<html lang="'+lang+'"><body data-thundy-analysis-view="expert"></body></html>');
   try{
    const data={local:{state:'checked'},rows:[null,{provider,scope:'url',resource:null,state:'received',verdict:'unknown',source:'remote',responses:1,failures:1}],availability:{[provider]:'authorization'}};
    const c=vm.createContext({document:dom.window.document,URL,Date,data,labels});
    if(!serialized)vm.runInContext(source,c);
    const render=()=>vm.runInContext(serialized?'('+a.render.toString()+')(data,labels)':'ThundyAnalysis.render(data,labels);',c);
    render();let root=dom.window.document.getElementById('thundy-analysis-status').shadowRoot;
    assert.equal(root.querySelector('.phase').textContent,catalog.analysisModeResponsesFailed.message);
    assert.ok(root.textContent.includes(catalog.analysisStoredDataIncomplete.message));
    const entry=root.querySelector('[data-provider="'+provider+'"]');
    assert.ok(entry.textContent.includes(catalog.analysisCurrentAvailability.message+': '+catalog.analysisReason_authorization.message));
    assert.equal(entry.querySelector('.service-results').textContent,catalog.analysisVerdict_unknown.message);
    assert.ok(entry.textContent.includes(catalog.analysisModeResponsesFailed.message));
    assert.ok(!entry.textContent.includes(catalog.analysisPartial.message));
    data.rows=data.rows.slice(1);data.rows[0].failures=0;render();
    assert.equal(root.querySelector('.phase').textContent,catalog.analysisModeResponses.message);
    data.rows[0].verdict='malicious';data.rows[0].failures=1;render();
    assert.equal(root.querySelector('.phase').textContent,catalog.analysisModePartial.message);
   }finally{dom.window.close();}
  }
 }
});
test('partial and failed local input survive storage and render in all six languages with live updates',()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
  const dom=new JSDOM('<html lang="'+lang+'"><body data-thundy-analysis-view="expert"></body></html>');
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
test('API verdicts and provenance are visible for every provider in popup and serialized message cards',()=>{
 const a=model(),m=a.create();
 const cases=[
  ['hybridanalysis','report',{state:'COMPLETE',verdict:'malicious'},'malicious'],
  ['virustotal','hash',{data:{attributes:{last_analysis_stats:{malicious:0,suspicious:0}}}},'none'],
  ['urlhaus','domain',{query_status:'ok',url_count:1},'malicious'],
  ['abuseipdb','ip',{data:{abuseConfidenceScore:90}},'malicious'],
  ['urlscan','url',{uuid:'queued'},'unknown']
 ];
 for(const [provider,scope,data] of cases){const spec={provider,scope,resource:'message'};m.event({...spec,phase:'start'});m.event({...spec,phase:'finish',...a.response(spec,200,data),responded:true,observedAt:100});}
 // A second unresolved observation must remain visible beside a no-detection result.
 m.event({provider:'virustotal',scope:'ip',resource:'link:0',phase:'finish',state:'failed',verdict:'unknown',responded:true,observedAt:100});
 for(const lang of ['en','de','fr','es','it','pl'])for(const serialized of [false,true]){
  const dom=new JSDOM('<html lang="'+lang+'"><body data-thundy-analysis-view="expert"></body></html>');
  try{
   const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),labels=a.labels(k=>catalog[k]?.message),before=JSON.stringify(m.data);
   const c=vm.createContext({document:dom.window.document,URL,Date,labels,data:m.data});
   vm.runInContext(serialized ? '('+a.render.toString()+')(data,labels)' : source+'\nThundyAnalysis.render(data,labels);',c);
   const root=dom.window.document.getElementById('thundy-analysis-status').shadowRoot;
   for(const [provider,,,verdict] of cases){
    const entry=root.querySelector('[data-provider="'+provider+'"]');assert.ok(entry);
    assert.ok(entry.querySelector('.service-results').textContent.includes(catalog['analysisVerdict_'+verdict].message));
    assert.ok(entry.querySelector('.service-origin').textContent.includes(catalog.analysisSource_remote.message));
   }
   const vt=root.querySelector('[data-provider="virustotal"]');assert.ok(vt.querySelector('.service-results').textContent.includes(catalog.analysisVerdict_unknown.message));
   assert.equal(root.querySelectorAll('.services details[open]').length,0);
   assert.equal(JSON.stringify(m.data),before);
  }finally{dom.window.close();}
 }
});
test('failed and unrecognized API responses remain visibly unknown for all five services',()=>{
 const a=model(),catalog=JSON.parse(fs.readFileSync('_locales/en/messages.json')),labels=a.labels(k=>catalog[k]?.message);
 for(const status of [200,401,429,500]){
  const m=a.create();
  for(const provider of a.providers){const spec={provider,scope:'report',resource:'message'};m.event({...spec,phase:'start'});m.event({...spec,phase:'finish',...a.response(spec,status,{}),responded:true,observedAt:100});}
  const dom=new JSDOM('<html><body data-thundy-analysis-view="expert"></body></html>');
  try{
   const c=vm.createContext({document:dom.window.document,URL,Date,data:m.data,labels});vm.runInContext(source+'\nThundyAnalysis.render(data,labels);',c);
   const root=dom.window.document.getElementById('thundy-analysis-status').shadowRoot;
   for(const provider of a.providers){const entry=root.querySelector('[data-provider="'+provider+'"]');
    assert.equal(entry.querySelector('.service-results').textContent,catalog.analysisVerdict_unknown.message);
    assert.ok(entry.querySelector('.service-status').textContent.includes(catalog[status===200?'analysisState_received':'analysisState_failed'].message));
   }
  }finally{dom.window.close();}
 }
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
 const dom=new JSDOM('<html lang="'+lang+'"><body data-thundy-analysis-view="expert"><div id="analysisSourceMount"></div></body></html>');try{
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
 const dom=new JSDOM('<html lang="de"><body data-thundy-analysis-view="expert"></body></html>');
 try{
 const c=vm.createContext({URL,Date,document:dom.window.document});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);
 const labels=c.a.labels(key=>catalog[key].message),m=c.a.create();m.data.local.state='checked';
 m.event({provider:'urlscan',scope:'url',resource:'link:0',phase:'start'});
 const check=key=>{c.a.render(m.data,labels);const card=dom.window.document.getElementById('thundy-analysis-status').shadowRoot.querySelector('.card');assert.ok(card.querySelector('.mode').textContent.includes(catalog.analysisMixed.message));assert.ok(card.querySelector('.phase').textContent.includes(catalog[key].message));};
 check('analysisModeRunning');m.event({provider:'urlscan',scope:'url',resource:'link:0',phase:'finish',state:'submitted',verdict:'unknown',responded:true,observedAt:100});check('analysisModeSubmitted');
 m.event({provider:'urlscan',scope:'url',resource:'link:0',phase:'start'});m.event({provider:'urlscan',scope:'url',resource:'link:0',phase:'finish',state:'failed',verdict:'unknown',responded:false});check('analysisModeResponsesFailed');
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
 const dom=new JSDOM('<html lang="en"><body data-thundy-analysis-view="expert"></body></html>',{pretendToBeVisual:true});
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
  const dom=new JSDOM('<html lang="'+lang+'"><body data-thundy-analysis-view="expert"></body></html>',{pretendToBeVisual:true});
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
 const dom=new JSDOM('<html lang="en"><body data-thundy-analysis-view="expert"></body></html>');
 try{
  const c=vm.createContext({document:dom.window.document,Date,labels:a.labels(key=>catalog[key]?.message),data:{local:{state:'checked'},rows:[],sourceHistory:{rows:[{provider:'urlscan',scope:'url',state:'submitted',verdict:'unknown',observedAt:100}]},reportArchiveBlocked:true}});
  vm.runInContext('('+a.render.toString()+')(data,labels)',c);
  const root=dom.window.document.getElementById('thundy-analysis-status').shadowRoot;
  assert.equal(root.querySelector('[data-key="unbound-history"] summary').textContent,catalog.analysisHistoryTitle.message+' · urlscan.io');
  assert.ok(root.textContent.includes(catalog.analysisHistoryWarning.message));
 }finally{dom.window.close();}
});


test('archived protocol payloads appear only as unbound historical observations',()=>{
 const a=model();const record={analysisReportArchive:{schemaVersion:1,entries:[{kind:'attachment',slot:0,resource:{partName:'1.2',attachment_name:'private.bin',hybrid_sha256:'private-hash',report:{state:'COMPLETE',verdict:'malicious'},report_fetched_at:'2026-10-02T08:00:00Z',virustotal_stats:{malicious:2}}}]}};
 const history=a.history(record);assert.equal(history.rows.length,2);assert.ok(history.rows.every(row=>row.resource===null&&row.source==='stored'));
 assert.ok(history.rows.some(row=>row.observedAt===Date.parse('2026-10-02T08:00:00Z')));assert.ok(!JSON.stringify(history).includes('private.bin'));assert.ok(!JSON.stringify(history).includes('private-hash'));
 assert.equal(a.create().data.rows.length,0);
});

test('all normalized history rows remain reachable and late warnings stay historical in all six languages',()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
  const dom=new JSDOM('<html lang="'+lang+'"><body data-thundy-analysis-view="expert"></body></html>',{pretendToBeVisual:true});
  try{
   const c=vm.createContext({document:dom.window.document,URL,Date});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);
   const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),labels=c.a.labels(key=>catalog[key]?.message || 'MISSING:'+key);
   const rows=Array.from({length:1200},(_,i)=>({provider:'urlhaus',scope:'domain',state:'checked',source:'stored',verdict:i===1199?'malicious':'none',resource:null,observedAt:1000+i,findingAt:1000+i}));
   const data={local:{state:'checked'},rows:[],sourceHistory:{rows,truncated:false}},original=JSON.stringify(data);
   const host=c.a.render(data,labels),root=host.shadowRoot,history=root.querySelector('[data-key="unbound-history"]');history.open=true;
   assert.ok(history.querySelector('summary').textContent.includes(catalog.analysisHistoryFlagged.message));assert.equal(root.querySelector('.card').style.borderColor,'');assert.equal(root.querySelector('.mode').textContent,catalog.analysisLocal.message);
   const seen=[];
   for(let page=0;page<40;page++){
    const items=history.querySelectorAll('.history-entries li');assert.equal(items.length,30);seen.push(...Array.from(items,item=>item.dataset.focusKey));
    const next=history.querySelector('[data-focus-key="history-next"]');assert.equal(next.disabled,page===39);if(!next.disabled)next.click();
   }
   assert.equal(new Set(seen).size,1200);assert.ok(history.textContent.includes(catalog.analysisVerdict_malicious.message));assert.ok(root.querySelector('.live').textContent.includes('1171–1200 / 1200'));
   const previous=history.querySelector('[data-focus-key="history-previous"]');previous.click();assert.equal(host.dataset.historyPage,'38');previous.focus();
   c.a.render(data,labels);assert.equal(host.dataset.historyPage,'38');assert.equal(root.activeElement.dataset.focusKey,'history-previous');assert.equal(root.querySelector('[data-key="unbound-history"]').open,true);
   root.querySelector('[data-focus-key="history-find-warning"]').click();assert.equal(host.dataset.historyPage,'39');assert.equal(root.activeElement.dataset.historyWarning,'true');
   c.a.render(data,labels);assert.equal(root.activeElement.dataset.historyWarning,'true');
   c.a.render({...data,sourceHistory:{rows:rows.slice(0,1),truncated:false}},labels);assert.equal(host.dataset.historyPage,'0');assert.equal(root.querySelectorAll('.history-entries li').length,1);assert.equal(root.activeElement.dataset.focusKey,'unbound-history');
   assert.equal(JSON.stringify(data),original);assert.ok(!root.textContent.includes('MISSING:'));
  }finally{dom.window.close();}
 }
});

test('serialized history navigation needs no module globals and keeps projection limits distinct from pages',()=>{
 const a=model(),catalog=JSON.parse(fs.readFileSync('_locales/en/messages.json'));
 const dom=new JSDOM('<html lang="en"><body data-thundy-analysis-view="expert"></body></html>',{pretendToBeVisual:true});
 try{
  const rows=Array.from({length:1201},(_,i)=>({provider:'urlscan',scope:'url',state:'submitted',verdict:i===1199?'suspicious':'unknown',observedAt:i}));
  const c=vm.createContext({document:dom.window.document,Date,labels:a.labels(key=>catalog[key]?.message),data:{local:{state:'checked'},rows:[],sourceHistory:{rows,truncated:false}}});
  vm.runInContext('('+a.render.toString()+')(data,labels)',c);
  const root=dom.window.document.getElementById('thundy-analysis-status').shadowRoot;
  assert.ok(root.textContent.includes(catalog.analysisTruncated.message));root.querySelector('[data-key="unbound-history"]').open=true;
  root.querySelector('[data-focus-key="history-find-warning"]').click();assert.equal(root.querySelectorAll('.history-entries li').length,30);assert.ok(root.querySelector('.history-range').textContent.includes('1200 / 1200'));assert.ok(root.textContent.includes(catalog.analysisVerdict_suspicious.message));assert.equal(root.querySelector('.card').style.borderColor,'');
 }finally{dom.window.close();}
});

test('current details format only on disclosure and preserve rendered times, focus and idempotent reopen in six languages',async()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
  const dom=new JSDOM('<html lang="'+lang+'"><body data-thundy-analysis-view="expert"></body></html>',{pretendToBeVisual:true});
  try{
   let formats=0;class CountedDate extends Date{toLocaleString(...args){formats++;return super.toLocaleString(...args);}}
   const c=vm.createContext({document:dom.window.document,URL,Date:CountedDate});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);
   const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),labels=c.a.labels(key=>catalog[key]?.message || 'MISSING:'+key);
   const oldTime=Date.parse('2026-10-01T08:00:00Z'),newTime=Date.parse('2026-11-01T12:00:00Z');
   const data={local:{state:'checked'},rows:[{provider:'hybridanalysis',scope:'report',resource:'message',source:'stored',state:'checked',verdict:'none',findingAt:oldTime,observedAt:oldTime,attemptedAt:oldTime}]};
   const host=c.a.render(data,labels),root=host.shadowRoot;let entry=root.querySelector('[data-key="hybridanalysis:report:message"]');
   assert.equal(formats,1);assert.equal(entry.querySelectorAll('p,small').length,0);
   data.rows[0].observedAt=newTime;data.rows[0].findingAt=newTime;data.rows[0].verdict='malicious';
   const toggle=async open=>{const changed=new Promise(resolve=>entry.addEventListener('toggle',resolve,{once:true}));entry.open=open;await changed;};
   await toggle(true);assert.equal(formats,4);assert.ok(entry.textContent.includes(new Date(oldTime).toLocaleString(lang)));assert.ok(!entry.textContent.includes(new Date(newTime).toLocaleString(lang)));assert.ok(entry.textContent.includes(catalog.analysisVerdict_none.message));
   const children=entry.children.length;await toggle(false);await toggle(true);assert.equal(entry.children.length,children);assert.equal(formats,4);
   entry.querySelector('summary').focus();c.a.render(data,labels);entry=root.querySelector('[data-key="hybridanalysis:report:message"]');assert.equal(entry.open,true);assert.equal(root.activeElement.dataset.focusKey,'hybridanalysis:report:message');assert.ok(entry.textContent.includes(new Date(newTime).toLocaleString(lang)));assert.ok(entry.textContent.includes(catalog.analysisVerdict_malicious.message));
  }finally{dom.window.close();}
 }
});

test('serialized current warning jump chooses the strongest active finding without inheriting historical warnings',()=>{
 const a=model();for(const lang of ['en','de','fr','es','it','pl']){
  const dom=new JSDOM('<html lang="'+lang+'"><body data-thundy-analysis-view="expert"></body></html>',{pretendToBeVisual:true});
  try{
   const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),labels=a.labels(key=>catalog[key]?.message || 'MISSING:'+key);
   const data={local:{state:'checked'},rows:[{provider:'urlhaus',scope:'domain',resource:'link:0',state:'checked',source:'remote',verdict:'suspicious',observedAt:100},{provider:'virustotal',scope:'hash',resource:'attachment:1.2',state:'checked',source:'cache',verdict:'malicious',observedAt:200}],sourceHistory:{rows:[{provider:'urlscan',scope:'url',state:'checked',verdict:'malicious',observedAt:300}]}};
   const c=vm.createContext({document:dom.window.document,Date,labels,data});vm.runInContext('globalThis.render=('+a.render.toString()+');render(data,labels);',c);
   const root=dom.window.document.getElementById('thundy-analysis-status').shadowRoot,jump=root.querySelector('[data-focus-key="current-find-warning"]');
   assert.equal(jump.textContent,catalog.analysisCurrentFindWarning.message);jump.click();
   const target=root.querySelector('[data-key="virustotal:hash:attachment:1.2"]');assert.equal(target.open,true);assert.equal(root.activeElement,target.querySelector('summary'));assert.ok(target.querySelector('summary').getAttribute('aria-label').startsWith('VirusTotal · '));assert.equal(target.querySelector('.service-status').textContent,'VirusTotal');assert.ok(target.querySelector('small'));assert.equal(root.querySelector('[data-key="urlhaus:domain:link:0"]').open,false);
   c.render({...data,rows:[]},labels);assert.equal(root.querySelector('[data-focus-key="current-find-warning"]'),null);assert.ok(root.querySelector('[data-focus-key="history-find-warning"]'));assert.equal(root.querySelector('.card').style.borderColor,'');
  }finally{dom.window.close();}
 }
});

test('inventory provider index preserves resource ownership, source order and deduplication',()=>{
 const a=model(),dom=new JSDOM('<html lang="en"><body data-thundy-analysis-view="expert"></body></html>');try{
  const catalog=JSON.parse(fs.readFileSync('_locales/en/messages.json')),labels=a.labels(key=>catalog[key]?.message),c=vm.createContext({document:dom.window.document,Date,URL});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);
  const rows=[{provider:'urlhaus',scope:'domain',resource:'link:0'},{provider:'virustotal',scope:'hash',resource:'link:0'},{provider:'urlhaus',scope:'url',resource:'link:0'},{provider:'hybridanalysis',scope:'report',resource:'link:1'}].map(row=>({...row,state:'checked',source:'stored',verdict:'none'}));
  const original=JSON.stringify(rows),host=c.a.render({rows,local:{state:'checked'},resourceLabels:{'link:0':'first','link:1':'second','link:2':'third'}},labels),items=host.shadowRoot.querySelectorAll('[data-key="resources"] li');
  assert.equal(items[0].lastChild.textContent,'URLhaus · VirusTotal');assert.equal(items[1].lastChild.textContent,'Hybrid Analysis');assert.equal(items[2].lastChild.textContent,catalog.analysisResourceNoExternal.message);assert.equal(JSON.stringify(rows),original);
 }finally{dom.window.close();}
});

test('Hybrid Analysis API v2 Quick-Scan and Overview payloads classify id, finished, whitelisted and scanners_v2 accurately',()=>{
 const a=model();
 assert.deepEqual({...a.spec('https://hybrid-analysis.com/api/v2/quick-scan/64f123')},{provider:'hybridanalysis',scope:'report'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'file'},200,{id:'qs-123',sha256:'abc',finished:false})},{state:'submitted',verdict:'unknown'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'report'},200,{id:'qs-123',sha256:'abc',finished:false,scanners:[{name:'CrowdStrike Falcon',status:'in-progress'}]})},{state:'incomplete',verdict:'unknown'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'hash'},200,{sha256:'abc',verdict:'whitelisted',whitelisted:true})},{state:'checked',verdict:'none'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'report'},200,{sha256:'abc',verdict:null,whitelisted:false,scanners_v2:{metadefender:{status:'malicious',positives:4,total:35}}})},{state:'checked',verdict:'malicious'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'report'},200,{sha256:'abc',verdict:'no-classification',scanners:[{name:'MetaDefender',status:'clean',positives:0,total:35}]})},{state:'checked',verdict:'none'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'report'},200,{threat_level:0})},{state:'checked',verdict:'none'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'report'},200,{threat_level:1})},{state:'checked',verdict:'suspicious'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'report'},200,{threat_level:2})},{state:'checked',verdict:'malicious'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'report'},200,{threat_score:15})},{state:'checked',verdict:'none'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'report'},200,[{threat_level:0,threat_score:5}])},{state:'checked',verdict:'none'});
 assert.deepEqual({...a.response({provider:'hybridanalysis',scope:'report'},200,{scanners:[{name:'MetaDefender',status:'harmless'}]})},{state:'checked',verdict:'none'});
});

test('VirusTotal, URLhaus, AbuseIPDB and URLScan.io API response parsers handle normalized and edge payloads accurately',()=>{
 const a=model();
 // VirusTotal unwrapped last_analysis_stats and suspicious
 assert.deepEqual({...a.response({provider:'virustotal',scope:'hash'},200,{last_analysis_stats:{malicious:0,suspicious:2,harmless:60,undetected:8}})},{state:'checked',verdict:'suspicious'});
 assert.deepEqual({...a.response({provider:'virustotal',scope:'ip'},200,{attributes:{last_analysis_stats:{malicious:3,suspicious:0,harmless:60}}})},{state:'checked',verdict:'malicious'});
 // URLhaus string url_count, urls array, and URL endpoint fields
 assert.deepEqual({...a.response({provider:'urlhaus',scope:'domain'},200,{query_status:'ok',url_count:'3'})},{state:'checked',verdict:'malicious'});
 assert.deepEqual({...a.response({provider:'urlhaus',scope:'domain'},200,{query_status:'ok',urls:[{url:'https://bad.example/payload.exe'}]})},{state:'checked',verdict:'malicious'});
 assert.deepEqual({...a.response({provider:'urlhaus',scope:'url'},200,{query_status:'ok',url_status:'online',threat:'malware_download'})},{state:'checked',verdict:'malicious'});
 // AbuseIPDB suspicious range (25..50) and whitelisted override
 assert.deepEqual({...a.response({provider:'abuseipdb',scope:'ip'},200,{data:{abuseConfidenceScore:35,isWhitelisted:false}})},{state:'checked',verdict:'suspicious'});
 assert.deepEqual({...a.response({provider:'abuseipdb',scope:'ip'},200,{data:{abuseConfidenceScore:85,isWhitelisted:true}})},{state:'checked',verdict:'none'});
 // URLScan.io engines maliciousTotal, brand objects, and suspicious score
 assert.deepEqual({...a.response({provider:'urlscan',scope:'report'},200,{verdicts:{overall:{malicious:false,score:10},engines:{maliciousTotal:2}}})},{state:'checked',verdict:'malicious'});
 assert.deepEqual({...a.response({provider:'urlscan',scope:'report'},200,{verdicts:{overall:{malicious:false,score:65},urlscan:{brands:[{name:'PayPal',key:'paypal'}]}}})},{state:'checked',verdict:'suspicious'});
 assert.deepEqual({...a.response({provider:'urlscan',scope:'report'},200,{page:{url:'https://clean.example'}})},{state:'checked',verdict:'none'});
 // Legacy restoration of stored urlscan link verdict
 const legacyUrlscan=a.legacy({links:[{url:'https://phish.example',state:'UNKNOWN',urlscan:{status:'MALICIOUS_VISUAL',observedAt:500}}]});
 assert.equal(legacyUrlscan.rows.length,1);
 assert.equal(legacyUrlscan.rows[0].provider,'urlscan');
 assert.equal(legacyUrlscan.rows[0].verdict,'malicious');
 assert.equal(legacyUrlscan.rows[0].observedAt,500);

 // Status code and error harmonization (404, 429, 401)
 assert.deepEqual({...a.response({provider:'virustotal',scope:'hash'},404,{})},{state:'not_found',verdict:'unknown',errorDetails:'Element not yet recorded in VirusTotal database.'});
 assert.deepEqual({...a.response({provider:'virustotal',scope:'hash'},429,{})},{state:'failed',verdict:'unknown',errorCode:'rate_limited',errorDetails:'The VirusTotal rate limit or quota was reached. Please try again later.'});
 assert.deepEqual({...a.response({provider:'virustotal',scope:'hash'},429,{retry_after:42})},{state:'failed',verdict:'unknown',errorCode:'rate_limited',errorDetails:'Rate limit or quota reached. Please try again in 42 seconds.',retryAfter:42});
 assert.deepEqual({...a.response({provider:'virustotal',scope:'hash'},401,{})},{state:'failed',verdict:'unknown',errorCode:'invalid_key',errorDetails:'Invalid or unauthorized VirusTotal API key.'});
 assert.deepEqual({...a.response({provider:'abuseipdb',scope:'ip'},429,{})},{state:'failed',verdict:'unknown',errorCode:'rate_limited',errorDetails:'The AbuseIPDB rate limit or quota was reached. Please try again later.'});
 assert.deepEqual({...a.response({provider:'abuseipdb',scope:'ip'},401,{})},{state:'failed',verdict:'unknown',errorCode:'invalid_key',errorDetails:'Invalid or unauthorized AbuseIPDB API key.'});
 assert.deepEqual({...a.response({provider:'urlhaus',scope:'domain'},429,{})},{state:'failed',verdict:'unknown',errorCode:'rate_limited',errorDetails:'The URLhaus rate limit or quota was reached. Please try again later.'});
 assert.deepEqual({...a.response({provider:'urlhaus',scope:'domain'},401,{})},{state:'failed',verdict:'unknown',errorCode:'invalid_key',errorDetails:'Invalid or unauthorized URLhaus API key.'});
 assert.deepEqual({...a.response({provider:'urlhaus',scope:'domain'},200,{query_status:'invalid_api_key'})},{state:'failed',verdict:'unknown',errorCode:'invalid_key',errorDetails:'Invalid or unauthorized URLhaus API key.'});
 assert.deepEqual({...a.response({provider:'urlhaus',scope:'domain'},200,{query_status:'host_not_found'})},{state:'not_found',verdict:'unknown'});
});


