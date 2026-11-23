const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('hybrid_report.js','utf8'),provider=fs.readFileSync('provider_results.js','utf8');
const hash='ab'.repeat(32),token='12345678-1234-4234-8234-123456789abc';
function setup(extra={}) {const c=vm.createContext({URL,Date,crypto:require('node:crypto').webcrypto,...extra});vm.runInContext(provider+'\n'+source+'\nglobalThis.reportModel=ThundyHybridReport;',c);return c;}
const sample=()=>({url:'https://example.invalid/path?value=1#fragment',hybrid_sha256:hash,report_fetched_at:'2026-11-18T08:00:00Z',report:[{sha256:hash,job_id:'job-one',environment_id:1,environment_description:'First environment',verdict:'clean',state:'SUCCESS',threat_score:0,whitelisted:false,processes:[],domains:['same.invalid'],api_key:'never-show-this'},{sha256:hash,job_id:'job-two',environment_id:2,environment_description:'Second environment',verdict:'malicious',state:'SUCCESS',signatures:[{name:'<img src=x onerror=alert(1)>',threat_level:2}],processes:[{name:'second-only',process_id:2,parent_uid:'p',file_path:'c:\\fixture'}]}]});
test('Hybrid report roots retain separate provenance, missingness, false and zero without mutating history',()=>{
 const {reportModel:m}=setup(),raw=sample(),before=JSON.stringify(raw),out=m.project(raw,'link:0',{score:0,state:'checked'});
 assert.equal(out.schemaVersion,2);assert.equal(out.reports.length,2);assert.equal(out.resource.url,raw.url);assert.equal(out.local.score,0);
 const [a,b]=out.reports;assert.ok(a.emptySections.includes('processes'));assert.ok(b.missingSections.includes('network'));
 assert.equal(a.verdict,'none');assert.equal(b.verdict,'malicious');assert.ok(JSON.stringify(a).includes('First environment'));assert.ok(!JSON.stringify(a).includes('second-only'));
 const assessment=a.sections.find(s=>s.id==='assessment').rows[0];assert.equal(assessment.find(f=>f.key==='threat_score').value,0);assert.equal(assessment.find(f=>f.key==='whitelisted').value,false);
 assert.ok(!JSON.stringify(out).includes('never-show-this'));assert.equal(JSON.stringify(raw),before);
});
test('foreign report hashes are excluded and report/list/text budgets remain explicit',()=>{
 const {reportModel:m}=setup(),raw=sample();raw.report.unshift({sha256:'cd'.repeat(32),verdict:'malicious',job_id:'foreign'});
 const out=m.project(raw,'link:0');assert.equal(out.reports.length,2);assert.equal(out.truncated,true);assert.ok(!JSON.stringify(out).includes('foreign'));
 assert.throws(()=>m.project({hybrid_sha256:hash,report:{sha256:'cd'.repeat(32)}},'link:0'));
 const huge=m.project({report:{signatures:Array.from({length:80},()=>({name:'x'.repeat(900)}))}},'attachment:1');assert.equal(huge.reports[0].truncated,true);assert.equal(huge.reports[0].sections[0].rows.length,50);
});
function brokerFixture(resolve) {
 let now=0,next=1,removed;const created=[];
 const api={runtime:{id:'own',getURL:p=>'moz-extension://own/'+p},tabs:{create:async p=>{created.push(p);return {id:next++};},onRemoved:{addListener:fn=>removed=fn}}};
 const c=setup(),b=c.reportModel.broker(api,resolve||(()=>c.reportModel.project(sample(),'link:0')),()=>now,()=>token);
 return {b,api,created,setTime:v=>now=v,remove:id=>removed(id),open:()=>b.command({action:'openHybridReport',messageId:42,resourceRef:'link:0',contextToken:'bound'},{id:'own'}),read:(tabId=1)=>b.command({action:'readHybridReport',token},{id:'own',url:api.runtime.getURL('hybrid_report.html')+'#'+token,tab:{id:tabId}})};
}
test('report broker binds its snapshot to its own tab and rejects forged, expired and cleared access',async()=>{
 const f=brokerFixture();await assert.rejects(f.b.command({action:'openHybridReport'},{id:'foreign'}));assert.equal(f.created.length,0);
 await f.open();const read=await f.read();assert.equal(read.success,true);await assert.rejects(f.read(77));
 read.report.resource.url='changed';assert.notEqual((await f.read()).report.resource.url,'changed');
 f.setTime(300001);await assert.rejects(f.read());
 const g=brokerFixture();await g.open();g.b.clear();await assert.rejects(g.read());
 const h=brokerFixture();await h.open();h.remove(1);await assert.rejects(h.read());
});
test('cache clearing invalidates an opening report even while resource resolution is pending',async()=>{
 let release;const f=brokerFixture(()=>new Promise(r=>release=r));const open=f.open();f.b.clear();release(setup().reportModel.project(sample(),'link:0'));
 await assert.rejects(open);assert.equal(f.created.length,0);
});
test('actual background resolver requires the selected resource token and a single bound report',async()=>{
 const s=fs.readFileSync('background.js','utf8'),snippet=s.slice(s.indexOf('function resolveScopedHybridReport('),s.indexOf('browser.runtime.onMessage.addListener((request, sender, sendResponse) => {'));
 for(const problem of ['none','stale','ambiguous','disabled','disposed','changed-resource','missing-token']){
  const item={...sample(),analysisResourceRef:'link:0'};
  const context={disposed:problem==='disposed',snapshotId:'bound',isCached:()=>true,snapshot:async project=>project({
    displayPreferences:{hybridDetails:problem!=='disabled'},local:{score:12,state:'checked'},
    hybridReports:{'link:0':{resourceToken:problem==='changed-resource'?'other-resource':token}}
  },{links:problem==='ambiguous'?[item,item]:[item]})};
  let created=0;const c=setup({browser:{runtime:{id:'own',getURL:p=>'moz-extension://own/'+p},messages:{get:async()=>({id:42})},tabs:{create:async()=>({id:++created})}},getMessageAnalysisContext:async()=>context});
  vm.runInContext(snippet,c);
  const req={action:'openHybridReport',messageId:42,resourceRef:'link:0',contextToken:problem==='stale'?'old':'bound',
   resourceToken:problem==='missing-token'?undefined:token};
  const promise=c.hybridReportBroker.command(req,{id:'own'});if(problem==='none'){assert.equal((await promise).success,true);assert.equal(created,1);}else{await assert.rejects(promise);assert.equal(created,0);}
 }
});
test('six-language report viewer separates runs, searches loaded data and never interprets provider HTML or fetches',async()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
  const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),dom=new JSDOM(fs.readFileSync('hybrid_report.html','utf8'),{url:'https://extension.invalid/hybrid_report.html#'+token});
  let requests=0,listener,copied;Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
  const c=setup({ThundyI18n:{get:key=>{assert.ok(catalog[key],key);return catalog[key].message;}}});const snapshot=c.reportModel.project(sample(),'link:0',{score:0,state:'checked'});
  const api={runtime:{sendMessage:async req=>{requests++;assert.equal(req.action,'readHybridReport');return {success:true,report:snapshot};},onMessage:{addListener:fn=>listener=fn,removeListener:()=>{}}}};
  const view=c.reportModel.mount(api,dom.window.document,dom.window.location);await view.ready;
  const d=dom.window.document;assert.ok(d.getElementById('hybridReportOverview').textContent.includes('0 / 100'));assert.equal(d.querySelectorAll('#hybridReportSelect option').length,2);
  assert.ok(d.getElementById('hybridReportOverview').textContent.includes(sample().url));await d.querySelector('.report-value button').click();await new Promise(setImmediate);assert.equal(copied,sample().url);
  const select=d.getElementById('hybridReportSelect');select.value='1';select.dispatchEvent(new dom.window.Event('change'));assert.ok(d.getElementById('hybridReportContent').textContent.includes('<img src=x onerror=alert(1)>'));assert.equal(d.querySelectorAll('#hybridReportContent img,#hybridReportContent a,#hybridReportContent script').length,0);
  const search=d.getElementById('hybridReportSearch');search.value='second-only';search.dispatchEvent(new dom.window.Event('input'));assert.ok(d.getElementById('hybridReportContent').textContent.includes('second-only'));assert.equal(requests,1);
  listener({action:'memoryCachesCleared'});assert.equal(d.getElementById('hybridReportContent').children.length,0);assert.equal(search.disabled,true);view.dispose();dom.window.close();
 }
});

test('viewer does not restore a pending read after cache clearing',async()=>{
 const dom=new JSDOM(fs.readFileSync('hybrid_report.html','utf8'),{url:'https://extension.invalid/hybrid_report.html#'+token});
 let release,listener;const c=setup({ThundyI18n:{get:key=>key}}),api={runtime:{sendMessage:()=>new Promise(r=>release=r),onMessage:{addListener:fn=>listener=fn,removeListener:()=>{}}}};
 const view=c.reportModel.mount(api,dom.window.document,dom.window.location);listener({action:'memoryCachesCleared'});release({success:true,report:c.reportModel.project(sample(),'link:0')});await view.ready;
 assert.equal(dom.window.document.getElementById('hybridReportContent').children.length,0);view.dispose();dom.window.close();
});

test('compact inline keeps warnings and score visible while preserving focused controls and detail state',async()=>{
 const source=fs.readFileSync('analysis_status.js','utf8');
 for(const lang of ['en','de','fr','es','it','pl']){
  const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),dom=new JSDOM('<html><body></body></html>');let requests=[];
  const c=setup({document:dom.window.document,browser:{runtime:{sendMessage:async req=>{requests.push(req);return {success:true};}}}});vm.runInContext(source+'\nglobalThis.analysis=ThundyAnalysis;',c);
  const labels=c.analysis.labels(key=>catalog[key]?.message||'MISSING:'+key),data={messageId:42,contextToken:'bound',local:{state:'checked',score:0},scanJob:{state:'failed',reason:'source_capacity',manualAllowed:false},sourcePersistenceFailed:true,sourcePersistenceReason:'storage_failed',rows:[],hybridReports:{'attachment:1':{schemaVersion:1,sections:[],resourceToken:token}}};
  const render=()=>c.analysis.render(data,labels,'',{surface:'message'}),host=render(),root=host.shadowRoot;
  assert.ok(root.querySelector('.finding-card .local-score').textContent.includes('0 / 100'));
  assert.ok(root.querySelector('.card:not(.finding-card):not([hidden])').textContent.includes(catalog.analysisPersistenceFailed.message));
  assert.ok(root.querySelector('.scan-actions').textContent.includes(catalog.scanFailure_source_capacity.message));
  root.querySelector('[data-focus-key=view-switch]').click();const details=root.querySelector('[data-key=expert-explanation]');details.open=true;details.querySelector('summary').focus();render();
  assert.equal(root.querySelector('[data-key=expert-explanation]').open,true);assert.equal(root.activeElement?.dataset.focusKey,'expert-explanation');
  root.querySelector('.hybrid-report-link button').click();await new Promise(setImmediate);assert.equal(requests[0].action,'openHybridReport');assert.equal(requests[0].contextToken,'bound');assert.equal(requests.length,1);
  assert.ok(!root.textContent.includes('MISSING:'));dom.window.close();
 }
});

test('bound target URLs preserve encoded characters, query and fragment instead of stripping control-like Unicode',()=>{
 const {reportModel:m}=setup(),item=sample();item.url='https://example.invalid/\u202e?value=1#fragment';
 assert.equal(m.project(item,'link:0').resource.url,new URL(item.url).href);
});

test('inline names the strongest resource and attributes only comparable cross-provider conflicts', async () => {
 const dom = new JSDOM('<html><body></body></html>');
 try {
  const calls = [];
  const c = setup({document:dom.window.document,browser:{runtime:{sendMessage:async request=>{calls.push(request);return {success:true};}}}});
  vm.runInContext(fs.readFileSync('analysis_status.js','utf8')+'\nglobalThis.analysis=ThundyAnalysis;',c);
  const labels = c.analysis.labels(key=>key);
  const data = {messageId:42,contextToken:'bound',local:{state:'checked',score:0,reasons:['reason one','reason two','reason three']},
   resourceLabels:{'attachment:1':'fixture.zip','link:0':'https://example.invalid/'},rows:[]};
  const render = () => c.analysis.render(data,labels,'',{surface:'message'}).shadowRoot;
  const visibleCard = root => root.querySelector('.card:not([hidden])');
  assert.match(visibleCard(render()).textContent,/analysisLocalOnly/);
  const malicious = {provider:'hybridanalysis',resource:'attachment:1',scope:'file',verdict:'malicious',state:'checked',findingAt:100000,attemptedAt:400000,failures:1};
  const clean = {provider:'urlscan',resource:'link:0',scope:'url',verdict:'none',state:'checked'};
  const domain = {provider:'urlhaus',resource:'link:0',scope:'domain',verdict:'suspicious',state:'submitted'};
  data.rows = [malicious,clean,domain];
  data.hybridReports = {'attachment:1':{schemaVersion:1,sections:[],resourceToken:token}};
  const root = render(), simple = visibleCard(root);
  assert.match(simple.querySelector('.finding-summary').textContent,/Hybrid Analysis.*fixture\.zip/);
  assert.match(simple.querySelector('.provider-counts').textContent,/analysisProviderFindingsCount: 3.*analysisProviderPendingCount: 1.*analysisProviderErrorsCount: 1/);
  assert.doesNotMatch(simple.textContent,/analysisConflict/);
  assert.match(root.textContent,/analysisFindingObserved.*analysisAttempted/);
  data.rows.push({...clean,provider:'virustotal',resource:'attachment:1',scope:'hash'});
  assert.match(render().querySelector('[data-key="overview-resources"] [data-resource="attachment:1"]').textContent,/analysisConflict/);
  root.querySelector('[data-focus-key=view-switch]').click();
  const report = root.querySelector('[data-provider=hybridanalysis] .service-resource');
  assert.match(report.querySelector('summary').textContent,/fixture\.zip/);
  report.querySelector('button').click();
  await new Promise(setImmediate);
  assert.equal(calls[0].resourceRef,'attachment:1');
  assert.equal(calls.length,1);
 } finally { dom.window.close(); }
});

test('report search spans sections, pagination stays within a section and a retained warning survives run selection', async () => {
 const dom = new JSDOM(fs.readFileSync('hybrid_report.html','utf8'),{url:'https://extension.invalid/hybrid_report.html#'+token});
 const c = setup({ThundyI18n:{get:key=>key}});
 const item = sample();
 item.report[0].analysis_start_time = '2026-11-18T07:30:00Z';
 Object.assign(item.report[1],{state:undefined,verdict:'clean',scanners_v2:{Test:{positives:3,total:22}}});
 const storedWarning = {provider:'hybridanalysis',scope:'report',resource:'link:0',verdict:'malicious',findingAt:123,attemptedAt:456};
 const snapshot = c.reportModel.project(item,'link:0',{score:64,state:'checked'},[storedWarning,{...storedWarning,resource:'link:1',findingAt:999}]);
 snapshot.reports[0].sections.push({id:'signatures',rows:Array.from({length:51},(_,i)=>[{key:'name',value:'signature-'+i}])},{id:'mitre',rows:[[{key:'attck_id',value:'T1059'}]]});
 let requests = 0;
 const api = {runtime:{sendMessage:async()=>{requests++;return {success:true,report:snapshot};},onMessage:{addListener:()=>{},removeListener:()=>{}}}};
 const view = c.reportModel.mount(api,dom.window.document,dom.window.location);
 try {
  await view.ready;
  const d = dom.window.document, byId = id=>d.getElementById(id), change = element=>element.dispatchEvent(new dom.window.Event('change'));
  const overview = byId('hybridReportOverview'), content = byId('hybridReportContent');
  assert.match(overview.querySelector('h2').textContent,/example\.invalid/);
  assert.equal(overview.querySelector('.retained-finding time').dateTime,new Date(123).toISOString());
  const section = byId('hybridReportSection'), search = byId('hybridReportSearch');
  section.value='signatures';change(section);
  assert.equal(byId('hybridReportPages').hidden,false);
  byId('hybridReportNext').focus();
  byId('hybridReportNext').click();
  assert.equal(d.activeElement,byId('hybridReportPrevious'));
  assert.match(content.textContent,/signature-50/);
  assert.doesNotMatch(content.textContent,/T1059/);
  section.value='';change(section);
  for(const [keyword,group] of [['T1059','mitre'],['same.invalid','network'],[hash,'identity']]) {
   search.value=keyword;search.dispatchEvent(new dom.window.Event('input'));
   assert.match(content.querySelector('[data-section="'+group+'"]').textContent,new RegExp(keyword));
   assert.equal(section.querySelector('option[value="'+group+'"]').textContent.endsWith('(1)'),true);
   assert.equal(byId('hybridReportPages').hidden,true);
  }
  const comparison = byId('hybridReportComparison').querySelector('details');
  assert.equal(comparison.open,false);
  assert.equal(comparison.querySelector('[data-run="0"]').getAttribute('aria-current'),'true');
  assert.match(comparison.querySelector('li:nth-child(2)').textContent,/analysisTimeUnknown/);
  assert.equal(overview.querySelector('.report-provenance').open,false);
  comparison.open = true;
  comparison.querySelector('[data-run="1"]').click();
  const select = byId('hybridReportSelect');
  assert.equal(select.value,'1');
  assert.equal(d.activeElement,overview.querySelector('h2'));
  assert.equal(comparison.querySelector('[data-run="1"]').getAttribute('aria-current'),'true');
  assert.match(overview.querySelector('.report-explanation > ul').textContent,/assessmentSignal_scanner.*3 \/ 22/);
  assert.match(overview.querySelector('.report-explanation details').textContent,/assessmentSignal_verdict/);
  assert.match(overview.textContent,/hybridReportProcessing_unconfirmed/);
  assert.equal(overview.querySelector('.retained-finding'),null);
  select.value='0';change(select);
  assert.ok(overview.querySelector('.retained-finding'));
  assert.equal(requests,1);
 } finally {view.dispose();dom.window.close();}
});

test('hybrid reports separate explicit provider completion from a finding inferred from scanner data', () => {
 const {reportModel} = setup();
 const item = sample();
 item.report = [
  {state:'SUCCESS',verdict:'clean'},
  {scanners_v2:{Test:{positives:3,total:22}}},
  {finished:false,scanners_v2:{Test:{positives:3,total:22}}},
  {finished:true,state:'FAILED',verdict:'clean'}
 ];
 const reports = reportModel.project(item,'link:0').reports;
 assert.deepEqual(Array.from(reports,r=>r.completion),['complete','complete','pending','failed']);
 assert.deepEqual(Array.from(reports,r=>r.completionConfirmed),[true,false,false,false]);
 assert.equal(reports[2].verdict,'malicious');
 assert.equal(reports[2].signals.find(s=>s.code==='scanner').total,22);
});

test('inline evidence action opens only the bound Hybrid report or focuses the exact detail row', async () => {
 const dom = new JSDOM('<html><body></body></html>');
 try {
  const calls = [];
  const c = setup({document:dom.window.document,browser:{runtime:{sendMessage:async request=>{calls.push(request);return {success:true};}}}});
  vm.runInContext(fs.readFileSync('analysis_status.js','utf8')+'\nglobalThis.analysis=ThundyAnalysis;',c);
  const labels = c.analysis.labels(key=>key);
  const warning = {provider:'hybridanalysis',resource:'attachment:1',scope:'file',verdict:'malicious',state:'checked'};
  const data = {messageId:42,contextToken:'bound',local:{state:'checked',score:0},rows:[warning],
   resourceLabels:{'attachment:1':'fixture.zip'},hybridReports:{'attachment:1':{schemaVersion:1,sections:[],resourceToken:token}}};
  const render = () => c.analysis.render(data,labels,'',{surface:'message'}).shadowRoot;
  const root = render();
  root.querySelector('.overview-report-link button').click();
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{action:'openHybridReport',messageId:42,contextToken:'bound',resourceRef:'attachment:1',resourceToken:token}]);
  data.rows = [{...warning,provider:'virustotal',scope:'hash'}];
  render();
  assert.equal(root.querySelector('.overview-report-link'),null);
  assert.ok(root.querySelector('[data-key="overview-resources"] .hybrid-report-link button'));
  root.querySelector('[data-focus-key=overview-find-warning]').click();
  assert.equal(root.activeElement.dataset.focusKey,'virustotal:hash:attachment:1');
  assert.equal(root.activeElement.parentElement.open,true);
  assert.equal(calls.length,1);
  root.querySelector('[data-focus-key=view-switch]').click();
  data.rows = [{...warning,resource:null}];
  render();
  assert.equal(root.querySelector('[data-focus-key=overview-find-warning]'),null);
  assert.equal(root.querySelector('.overview-report-link'),null);
 } finally {dom.window.close();}
});
