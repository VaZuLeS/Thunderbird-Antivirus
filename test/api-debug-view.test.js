const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const settle=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
async function viewer({protectedMode=false}={}){
 const dom=new JSDOM(fs.readFileSync('api_debug.html','utf8'),{url:'https://addon.invalid/api_debug.html#run=1',runScripts:'outside-only',pretendToBeVisual:true});
 await new Promise(resolve=>dom.window.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 const w=dom.window,catalog=JSON.parse(fs.readFileSync('_locales/de/messages.json','utf8')),calls=[],downloads=[];
 const state={unlocked:!protectedMode,enabled:true,report:{schemaVersion:2,kind:'thundy-api-debug',runs:[
  {id:1,purpose:'manual',state:'failed',startedAt:1000,events:[{phase:'persistence',at:1001,provider:'hybridanalysis',state:'failed',reason:'storage_failed'}]},
  {id:3,purpose:'link',state:'pending',startedAt:2000,events:[{phase:'wait',at:2001,provider:'urlscan'}]}
 ],entries:[{id:2,runId:1,request:{provider:'hybridanalysis',method:'POST',endpoint:'/api/v2/quick-scan/url-for-analysis'},attempts:[{status:403}],networkStarted:true,reason:'permission',bodyState:'json',response:{id:'ref-b-1',message:'[redacted string]'}}],pending:[],dropped:0},deferred:null};
 let interval,changed,notified,disconnected=0;
 w.setInterval=fn=>(interval=fn,1);w.clearInterval=()=>{};
 w.fetch=()=>{throw Error('Viewer must not access providers');};
 w.ThundyI18n={get:key=>catalog[key]?.message||key};
 w.URL.createObjectURL=blob=>(downloads.push({blob}), 'blob:filtered');w.URL.revokeObjectURL=()=>{};
 w.browser={storage:{onChanged:{addListener:fn=>changed=fn}},downloads:{download:async request=>downloads.push(request)},runtime:{
  id:'addon',onMessage:{addListener:fn=>notified=fn},
  connect:()=>({postMessage(){},disconnect(){disconnected++;}}),
  sendMessage:async request=>{calls.push(request);assert.equal(request.action,'securityCommand');
   switch(request.op){
    case 'status':return {success:true,protected:protectedMode,unlocked:state.unlocked};
    case 'unlock':state.unlocked=true;return {success:true,token:'document-session'};
    case 'lock':state.unlocked=false;return {success:true};
    case 'touch':return {success:true};
    case 'apiDebugStatus':return {success:true,enabled:state.enabled};
    case 'apiDebugReport':if(!state.unlocked)return {success:false,code:'ADMIN_LOCKED'};if(state.deferred)return state.deferred;return {success:true,report:structuredClone(state.report)};
    case 'apiDebugClear':state.report={...state.report,runs:[],entries:[],pending:[]};return {success:true};
    default:throw Error('Unexpected mutation '+request.op);
   }
  }
 }};
 w.eval(fs.readFileSync('api_debug.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
 return {w,state,calls,downloads,catalog,by:id=>w.document.getElementById(id),tick:async()=>{interval();await settle();},notify:()=>notified({action:'apiDebugReset'},{id:'addon'}),change:value=>changed({thundySecurityV1:{newValue:{apiDebugEnabled:value}}},'local'),close:()=>{w.dispatchEvent(new w.Event('pagehide'));dom.window.close();},disconnected:()=>disconnected};
}
test('viewer groups and filters recorded operations, pauses, exports and clears without provider calls',async()=>{
 const f=await viewer();try{
  assert.equal(f.by('diagRuns').children.length,2);assert.ok(f.by('diagContent').textContent.includes('storage_failed'));assert.ok(f.by('diagContent').textContent.includes('ref-b-1'));
  f.by('diagProvider').value='urlscan';f.by('diagFilters').dispatchEvent(new f.w.Event('input'));assert.equal(f.by('diagRuns').children.length,1);assert.ok(f.by('diagContent').textContent.includes(f.catalog.diagNoHttp.message));
  f.by('diagReset').click();f.by('diagState').value='failed';f.by('diagFilters').dispatchEvent(new f.w.Event('input'));assert.equal(f.by('diagRuns').children.length,1);
  f.by('diagPause').click();await settle();const reads=f.calls.filter(c=>c.op==='apiDebugReport').length;await f.tick();assert.equal(f.calls.filter(c=>c.op==='apiDebugReport').length,reads);
  f.by('diagExport').click();await settle();assert.equal(f.downloads.at(-1).filename,'thundy-api-debug-v2.json');assert.equal(f.downloads.at(-1).saveAs,true);
  f.by('diagClear').click();await settle();assert.equal(f.by('diagRuns').children.length,0);assert.equal(f.by('diagContent').textContent,'');
  assert.ok(!f.calls.some(c=>['apiDebugSet','configure','scanUrl','requestScan'].includes(c.op)));
 }finally{f.close();}
});
test('a protected viewer unlocks its own session and removes details when idle expiry is observed',async()=>{
 const f=await viewer({protectedMode:true});try{
  assert.equal(f.by('diagView').hidden,true);assert.equal(f.calls.some(c=>c.op==='apiDebugReport'),false);
  f.by('diagPassword').value='admin-secret';f.by('diagAuth').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await settle();
  assert.equal(f.by('diagPassword').value,'');assert.equal(f.by('diagView').hidden,false);assert.equal(f.by('diagRuns').children.length,2);
  assert.ok(f.calls.filter(c=>c.op==='apiDebugReport').every(c=>c.token==='document-session'));
  f.state.unlocked=false;await f.tick();assert.equal(f.by('diagRuns').children.length,0);assert.equal(f.by('diagView').hidden,true);assert.equal(f.by('diagLock').hidden,true);
 }finally{f.close();}
});
test('a report delayed across lock or disable cannot restore cleared content',async()=>{
 for(const action of ['lock','disable','clear']){
  const f=await viewer();try{
   let resolve;f.state.deferred=new Promise(r=>resolve=r);const ticking=f.tick();await settle();
   if(action==='lock')f.by('diagLock').onclick();else if(action==='disable')f.change(false);else f.by('diagClear').click();
   await settle();assert.equal(f.by('diagRuns').children.length,0);
   resolve({success:true,report:f.state.report});await ticking;await settle();assert.equal(f.by('diagRuns').children.length,0,action);
   if(action==='disable')assert.equal(f.by('diagStatus').textContent,f.catalog.diagOff.message);
  }finally{f.close();}
 }
});

test('clearing diagnostics in another tab also clears a paused viewer',async()=>{const f=await viewer();try{f.by('diagPause').click();await settle();assert.equal(f.by('diagRuns').children.length,2);f.notify();await settle();assert.equal(f.by('diagRuns').children.length,0);}finally{f.close();}});

test('passive refresh preserves expanded sections and keyboard focus in the selected flow',async()=>{const f=await viewer();try{const details=f.by('diagContent').querySelector('details');details.open=true;details.querySelector('summary').focus();await f.tick();assert.equal(f.by('diagContent').querySelector('details').open,true);assert.equal(f.w.document.activeElement,f.by('diagContent').querySelector('summary'));}finally{f.close();}});
