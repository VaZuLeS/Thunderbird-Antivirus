const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {JSDOM}=require('jsdom');
function fixture(){
 let now=1000000;const stored={},connect=[];
 const browser={runtime:{id:'addon',getURL:p=>'moz-extension://addon/'+p,onConnect:{addListener:fn=>connect.push(fn)}},storage:{local:{get:async key=>key===null?{...stored}:typeof key==='string'?{[key]:stored[key]}:Object.fromEntries(key.map(k=>[k,stored[k]])),set:async values=>Object.assign(stored,values)}}};
 const c=vm.createContext({browser,crypto:webcrypto,TextEncoder,Date:class extends Date{static now(){return now;}}});
 vm.runInContext(fs.readFileSync('security.js','utf8')+'\nglobalThis.security=ThundySecurity;',c);
 return {s:c.security,c,browser,stored,advance:ms=>now+=ms,sender:{id:'addon',url:browser.runtime.getURL('options.html'),tab:{id:1},documentId:'doc-1'}};
}
const policy={enabled:true,threshold:50,unknown:'warn'};
test('optional defaults, input boundaries and all opening decisions are explicit',()=>{
 const {s}=fixture();
 for(const score of [49,50,51])assert.equal(s.decision({...policy,revision:4},{score,coverage:'checked',verdict:'CLEAN'}).required,score>=50);
 assert.equal(s.decision(policy,{score:1,coverage:'checked',verdict:'MALICIOUS'}).required,true);
 assert.equal(s.decision(policy,{score:null,coverage:'failed',verdict:'ERROR'}).required,false);
 assert.equal(s.decision({...policy,unknown:'approval'},{score:0,coverage:'failed',verdict:'CLEAN'}).reason,'incomplete');
 for(const verdict of ['UPLOADED','IN_PROGRESS','TIMEOUT',null]) assert.equal(s.decision({...policy,unknown:'approval'},{score:1,coverage:'checked',verdict}).required,true);
 assert.equal(s.decision({...policy,unknown:'approval'},{score:1,coverage:'checked',verdict:'CLEAN',check:{outcome:'failed'}}).required,true);
 assert.equal(s.decision({...policy,enabled:false},{score:100,verdict:'MALICIOUS'}).required,false);
});
test('two salted 600000-iteration verifiers, document-bound sessions, expiry and withdrawal exception',async()=>{
 const {s,stored,sender,advance}=fixture();
 await s.command({op:'configure',adminPassword:'administrator-123',approvalPassword:'approval-secret-123',policy},sender);
 const data=stored.thundySecurityV1;
 assert.equal(data.admin.iterations,600000);assert.notEqual(data.admin.salt,data.approval.salt);
 assert.ok(!JSON.stringify(data).includes('administrator-123'));assert.ok(!JSON.stringify(data).includes('approval-secret-123'));
 assert.equal((await s.status(sender)).unlocked,false);
 await assert.rejects(s.write({privacyTier:'max'},sender),/ADMIN_LOCKED/);
 await s.write({externalAnalysisConsent:false},sender);
 await assert.rejects(s.write({externalAnalysisConsent:false,privacyTier:'max'},sender),/ADMIN_LOCKED/);
 const {token}=await s.command({op:'unlock',password:'administrator-123'},sender);
 await s.write({privacyTier:'strict'},sender,token);
 await assert.rejects(s.write({privacyTier:'max'},{...sender,documentId:'other'},token),/ADMIN_LOCKED/);
 advance(300001);await assert.rejects(s.write({privacyTier:'max'},sender,token),/ADMIN_LOCKED/);
 assert.equal(stored.privacyTier,'strict');
});
test('failure delays and one-time recovery rotate credentials and preserve policy',async()=>{
 const {s,sender,advance}=fixture();
 const initial=await s.command({op:'configure',adminPassword:'administrator-123',policy},sender);
 await assert.rejects(s.command({op:'unlock',password:'incorrect'},sender),/PASSWORD_INVALID/);
 await assert.rejects(s.command({op:'unlock',password:'administrator-123'},sender),/PASSWORD_WAIT/);
 advance(1001);
 const recovered=await s.command({op:'recover',recovery:initial.recovery,password:'new-admin-password'},sender);
 assert.notEqual(recovered.recovery,initial.recovery);assert.equal((await s.status(sender)).policy.threshold,50);
 await assert.rejects(s.command({op:'recover',recovery:initial.recovery,password:'another-password'},sender),/PASSWORD_INVALID/);
 const unlocked=await s.command({op:'unlock',password:'new-admin-password'},sender);assert.ok(unlocked.token);
 await s.command({op:'lock',token:unlocked.token},sender);assert.equal((await s.status(sender,unlocked.token)).unlocked,false);
});
test('admin boundaries reject short, equal and reserved settings, and policy changes invalidate sessions',async()=>{
 const {s,sender}=fixture();
 await assert.rejects(s.command({op:'configure',adminPassword:'short',policy},sender),/PASSWORD_LENGTH/);
 await assert.rejects(s.command({op:'configure',adminPassword:'same-password-123',approvalPassword:'same-password-123',policy},sender),/PASSWORDS_DISTINCT/);
 await assert.rejects(s.write({thundySecurityV1:{}},sender),/SETTINGS_INVALID/);
 await assert.rejects(s.command({op:'configure',policy:{...policy,threshold:50.5}},sender),/POLICY_INVALID/);
 await assert.rejects(s.write({privacyTier:'max'},{...sender,url:'https://evil.example/'}),/ADMIN_PAGE_REQUIRED/);
 await s.command({op:'configure',adminPassword:'administrator-123',policy},sender);
 const {token}=await s.command({op:'unlock',password:'administrator-123'},sender);
 await s.command({op:'configure',token,policy:{...policy,threshold:70}},sender);
 await assert.rejects(s.write({privacyTier:'max'},sender,token),/ADMIN_LOCKED/);
});
function links(){
 const f=fixture();let now=1000000,score=50,body='https://target.example/path',opened=0,verified=0;
 let config={approval:{},policy:{...policy,revision:1}};const logs=[];const sessions=new Map();let created;
 const sender={id:'addon',url:'mailbox://message',tab:{id:7}};
 const request={url:body,messageId:4,interactionId:'click-1'};
 const session={...request,checked:true,terminal:false,verdict:'CLEAN',record:{id:'audit'},score:50,check:{origin:'live'}};sessions.set('7:click-1',session);
 const c=vm.createContext({URL,TextEncoder,crypto:webcrypto,Date:class extends Date{static now(){return now;}},ThundySecurity:{read:async()=>config,defaults:f.s.defaults,decision:f.s.decision,serialized:f.s.serialized,page:(s,p)=>s.id==='addon'&&s.url==='moz-extension://addon/'+p,verify:async password=>{verified++;if(password!=='approval-secret-123')throw Error('PASSWORD_INVALID');}},browser:{runtime:{getURL:p=>'moz-extension://addon/'+p},tabs:{create:async value=>{created=value.url;return {id:99};}},windows:{openDefaultBrowser:async()=>opened++}},auditSessionKey:(r,s)=>s.tab.id+':'+r.interactionId,linkAuditSessions:sessions,getFirstDisplayedMessage:async()=>({id:4}),readFullForAnalysis:async()=>({parts:[],body}),extractTextFromParts:x=>body,filterUrls:x=>x,extractUrls:()=>[request.url],collectThreatEvaluationOptions:async()=>({}),calculateThreatScore:()=>({score,reasons:['reason']}),localContentCoverage:()=>({state:'checked'}),updateLinkAudit:async(id,value)=>{logs.push(value);return true;}});
 vm.runInContext(fs.readFileSync('security_links.js','utf8')+'\nglobalThis.links=ThundyLinkSecurity;',c);
 c.handleOpenAuditedLink=async(r,s)=>{const result=await c.links.open(r,s);if(result.success)session.terminal=true;return result;};
 const approvalSender={id:'addon',url:'moz-extension://addon/security.html',tab:{id:99}};
 return {...f,c,l:c.links,request,sender,session,logs,approvalSender,getOpened:()=>opened,getVerified:()=>verified,config,advance:ms=>now+=ms,setScore:x=>score=x,setBody:x=>body=x,challenge:()=>new URL(created).searchParams.get('approval')};
}
test('legacy bypass is blocked; isolated, acknowledged approval opens exactly once',async()=>{
 const f=links();
 assert.equal((await f.l.open({...f.request,interactionId:undefined},f.sender)).code,'LINK_CHECK_REQUIRED');
 assert.equal((await f.l.open(f.request,f.sender)).code,'APPROVAL_REQUIRED');assert.equal(f.getOpened(),0);
 await f.l.start(f.request,f.sender);const challenge=f.challenge();
 await assert.rejects(f.l.command({op:'approve',challenge,password:'approval-secret-123',confirmed:true},{...f.approvalSender,tab:{id:101}}),/APPROVAL_EXPIRED/);
 await assert.rejects(f.l.command({op:'approve',challenge,password:'approval-secret-123'},f.approvalSender),/APPROVAL_CONFIRM_REQUIRED/);
 const result=await f.l.command({op:'approve',challenge,password:'approval-secret-123',confirmed:true},f.approvalSender);
 assert.equal(result.success,true);assert.equal(f.getOpened(),1);
 await assert.rejects(f.l.command({op:'approve',challenge,password:'approval-secret-123',confirmed:true},f.approvalSender),/APPROVAL_EXPIRED/);
 assert.ok(!JSON.stringify(f.logs).includes('approval-secret-123'));
});
test('expired, changed checks and policy revisions never consume an opening',async()=>{
 for(const change of [f=>f.advance(60001),f=>f.config.policy.revision++,f=>f.setScore(80),f=>f.setBody('modified '+f.request.url)]){
  const f=links();await f.l.start(f.request,f.sender);const challenge=f.challenge();change(f);
  await assert.rejects(f.l.command({op:'approve',challenge,password:'approval-secret-123',confirmed:true},f.approvalSender));assert.equal(f.getOpened(),0);
 }
 const f=links();delete f.config.approval;assert.equal((await f.l.open(f.request,f.sender)).code,'APPROVAL_NOT_CONFIGURED');assert.equal(f.getOpened(),0);
});
test('simple and expert share findings, preserve mode and never label partial checks as safe in six languages',()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
  const dom=new JSDOM('<html lang="'+lang+'"><body></body></html>');
  const c=vm.createContext({document:dom.window.document,Date,URL});vm.runInContext((fs.readFileSync('provider_results.js','utf8')+'\n'+fs.readFileSync('analysis_status.js','utf8'))+'\nglobalThis.a=ThundyAnalysis;',c);
  const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json'));
  const labels=c.a.labels(key=>catalog[key]?.message||key);
  const data={local:{state:'checked'},rows:[{provider:'virustotal',scope:'hash',state:'failed',verdict:'unknown',failures:1}],protection:{required:true,reason:'threshold',revision:2}};
  const host=c.a.render(data,labels);assert.equal(dom.window.document.body.dataset.thundyAnalysisView,'simple');
  const root=host.shadowRoot;assert.ok(root.textContent.includes(catalog.analysisSimpleIncomplete.message));assert.ok(root.textContent.includes(catalog.analysisApprovalRequired.message));
  root.querySelector('[data-focus-key="view-switch"]').click();assert.equal(dom.window.document.body.dataset.thundyAnalysisView,'expert');
  c.a.render(data,labels);assert.equal(dom.window.document.body.dataset.thundyAnalysisView,'expert');dom.window.close();
 }
});
test('real settings client renders, locks, unlocks and writes through background authorization',async()=>{
 const f=fixture();const dom=new JSDOM('<html><body><div class="settings-shell"><h1>Settings</h1></div></body></html>',{url:'moz-extension://addon/options.html',runScripts:'outside-only'});
 await new Promise(setImmediate);
 const errors=[];dom.window.addEventListener('error',e=>errors.push(e.message));
 const browser={...f.browser,runtime:{...f.browser.runtime,sendMessage:async request=>{try{return {success:true,...await f.s.command(request,f.sender)};}catch(e){return {success:false,code:e.code||e.message};}}}};
 const catalog=JSON.parse(fs.readFileSync('_locales/en/messages.json'));
 Object.assign(dom.window,{browser,ThundyI18n:{get:key=>catalog[key]?.message||key}});
 const c=dom.getInternalVMContext();vm.runInContext((fs.readFileSync('provider_results.js','utf8')+'\n'+fs.readFileSync('provider_registry.js','utf8')),c);vm.runInContext(fs.readFileSync('security_client.js','utf8'),c);
 dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 const wait=async condition=>{for(let i=0;i<100;i++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('UI did not settle');};
 const doc=dom.window.document;
 try{
  await wait(()=>doc.getElementById('securitySettingsForm'));
  assert.equal(doc.querySelector('.settings-shell').hidden,false);
  const value=(key,text)=>doc.querySelector('[data-security="'+key+'"]').value=text;
  value('securityAdminPassword','administrator-123');value('securityApprovalPassword','approval-secret-123');
  doc.getElementById('securitySettingsForm').requestSubmit();
  await wait(()=>doc.querySelector('.settings-shell').hidden&&doc.getElementById('securityRecoveryOutput').textContent.includes('code'));
  assert.equal(doc.querySelector('[data-security=securityAdminPassword]').value,'');
  value('securityAdminPassword','administrator-123');doc.querySelector('[data-security=unlock]').click();
  await wait(()=>!doc.querySelector('.settings-shell').hidden);
  doc.querySelector('[data-security=lock]').click();await wait(()=>doc.querySelector('.settings-shell').hidden);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('changing an API key invalidates its previous connection result without affecting other providers',async()=>{
 const f=fixture();f.stored.apikey='old-key';f.stored.providerConnectionTests={hybridanalysis:{status:'valid'},urlhaus:{status:'valid'}};
 await f.s.write({apikey:'new-key'},f.sender);assert.equal(f.stored.providerConnectionTests.hybridanalysis,undefined);assert.equal(f.stored.providerConnectionTests.urlhaus.status,'valid');
});

test('parallel password guesses cannot bypass the retry delay',async()=>{
 const f=fixture();await f.s.command({op:'configure',adminPassword:'administrator-123',policy},f.sender);
 const results=await Promise.allSettled(Array.from({length:4},()=>f.s.command({op:'unlock',password:'wrong-password'},f.sender)));
 assert.equal(results.filter(r=>r.reason?.code==='PASSWORD_INVALID').length,1);assert.equal(results.filter(r=>r.reason?.code==='PASSWORD_WAIT').length,3);
});

test('recovery also enforces separation between administrator and link passwords',async()=>{
 const f=fixture();const setup=await f.s.command({op:'configure',adminPassword:'administrator-123',approvalPassword:'approval-secret-123',policy},f.sender);
 await assert.rejects(f.s.command({op:'recover',recovery:setup.recovery,password:'approval-secret-123'},f.sender),/PASSWORDS_DISTINCT/);
});

test('scan mode changes remain administratively protected and new scan revisions invalidate approvals',async()=>{
 const f=fixture();await f.s.command({op:'configure',adminPassword:'admin-password-123',approvalPassword:'approval-password-123',policy},f.sender);
 await assert.rejects(f.s.write({scanMode:'allDisplayed'},f.sender),/ADMIN_LOCKED/);
 const l=links();let revision=1;l.c.ThundyScans={revision:()=>revision};await l.l.start(l.request,l.sender);const challenge=l.challenge();revision++;
 await assert.rejects(l.l.command({op:'approve',challenge,password:'approval-secret-123',confirmed:true},l.approvalSender));assert.equal(l.getOpened(),0);
});

test('a report revision changing during the last opening check consumes no OS opening',async()=>{
 const l=links();let revision=1,calls=0;l.c.ThundyScans={revision:()=>revision};await l.l.start(l.request,l.sender);const challenge=l.challenge();
 l.c.getFirstDisplayedMessage=async()=>{if(++calls===3)revision++;return {id:4};};
 const result=await l.l.command({op:'approve',challenge,password:'approval-secret-123',confirmed:true},l.approvalSender);assert.equal(result.success,false);assert.equal(result.code,'APPROVAL_CHANGED');assert.equal(l.getOpened(),0);
});

test('incomplete shared provider analysis also enforces the unknown-result approval policy',async()=>{
 const l=links();l.setScore(1);l.config.policy.unknown='approval';l.c.ThundyScans={revision:()=>1,get:()=>({assessmentIncomplete:true})};
 const result=await l.l.open(l.request,l.sender);assert.equal(result.success,false);assert.equal(result.reason,'incomplete');assert.equal(l.getOpened(),0);
});
