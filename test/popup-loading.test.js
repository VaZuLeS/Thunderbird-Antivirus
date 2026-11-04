const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');

async function popup(record, lang='de') {
 const dom=new JSDOM(fs.readFileSync('popup.html','utf8'),{url:'https://addon.invalid/popup.html'});
 const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json'));
 const requests=[],reads=[],messages=[];
 const browser={
  tabs:{query:async()=>[{id:1}]},messageDisplay:{getDisplayedMessages:async()=>({messages:[{id:7,headerMessageId:'fixture',subject:'Fixture',author:'sender@example.invalid'}]})},
  storage:{local:{get:async()=>({apikey:'fixture',externalAnalysisConsent:true})},onChanged:{addListener(){}}},
  permissions:{contains:async()=>true},
  runtime:{onMessage:{addListener(){}},getURL:p=>'https://addon.invalid/'+p,openOptionsPage(){},sendMessage:async request=>{
   reads.push(request.action);
   messages.push(structuredClone(request));
   if(request.action==='getMessageAnalysisRecord')return {success:true,record};
   if(request.action==='getMessageAnalysis')return {success:true,messageId:7,local:{state:'checked'},rows:[],availability:{}};
   if(request.action==='getLocalRisk')return {threat:{score:0,reasons:[]}};
   if(['uploadAttachment','downloadDisarmed','scanUrl'].includes(request.action))return {status:'error',message:'Controlled refusal'};
   return {success:true};
  }}
 };
 const context=vm.createContext({document:dom.window.document,window:dom.window,URL,TextEncoder,console,
  browser,openDB:async()=>({close(){}}),setTimeout,clearTimeout,
  ThundyI18n:{get:(key,args=[])=>{
   const item=catalog[key];return (item?.message||key).replace(/\$([A-Z0-9_]+)\$/g,(all,name)=>{
    const placeholder=item?.placeholders?.[name.toLowerCase()];return placeholder ? placeholder.content.replace(/\$(\d+)/g,(_,i)=>String(args[Number(i)-1]??'')) : all;
   });
  },number:value=>value,date:value=>new Date(value).toLocaleString()},
  fetch:async url=>{requests.push(url);throw Error('No network expected');}});
 vm.runInContext(fs.readFileSync('analysis_status.js','utf8'),context);
 const source=fs.readFileSync('api.js','utf8').replace(/^\(async \(\) => \{/m,'async function initializePopup() {').replace(/\}\)\(\);/m,'}');
 vm.runInContext(source,context);
 await context.initializePopup();
 return {dom,context,requests,reads,messages,catalog,close:()=>dom.window.close()};
}

test('opening the popup tolerates optional Hybrid Analysis field shapes without losing other stored results',async()=>{
 const record={links:[
  {url:'https://first.example.invalid',state:'KNOWN',hybrid_sha256:'a',report:{state:'COMPLETE',threat_score:90,verdict:'malicious',tags:'phishing',scanners:[null,{name:'scanner',anti_virus_results:{}}]}},
  {url:'https://second.example.invalid',state:'KNOWN',hybrid_sha256:'b',report:{state:'COMPLETE',threat_score:10,verdict:'clean',tags:['pdf']}}
 ]};
 const f=await popup(record);try{
  assert.doesNotThrow(()=>f.context.renderReport({json_data:record.links[0].report,attachmentName:record.links[0].url,hybrid_sha:'a'}));
  assert.equal(f.dom.window.document.getElementById('unexpected-error-msg'),null);
  const text=f.dom.window.document.getElementById('hybrid_analysis_api_content').textContent;
  assert.ok(text.includes('first.example.invalid'),text);assert.ok(text.includes('second.example.invalid'));
  assert.ok(text.includes('phishing'));assert.equal(f.requests.length,0);
  assert.ok(!text.includes('undefined'));
 }finally{f.close();}
});

test('stored report actions bind after fragment rendering and remain separate for equal attachment hashes',async()=>{
 const record={attachments:['1.2','1.3'].map(partName=>({partName,attachment_name:'same.html',hybrid_sha256:'same-hash',state:'KNOWN',report:{state:'COMPLETE',verdict:'clean',threat_score:0}}))};
 const before=JSON.stringify(record),f=await popup(record);
 try{
  const area=f.dom.window.document.getElementById('hybrid_analysis_api_content');
  const rescans=[...area.querySelectorAll('button')].filter(b=>b.textContent===f.catalog.ui_034.message);
  const downloads=[...area.querySelectorAll('button')].filter(b=>b.textContent===f.catalog.ui_035.message);
  assert.equal(rescans.length,2);assert.equal(downloads.length,2);
  assert.equal(f.messages.filter(m=>['uploadAttachment','downloadDisarmed'].includes(m.action)).length,0);
  rescans[0].click();rescans[0].dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true}));
  downloads[1].click();await new Promise(setImmediate);
  assert.deepEqual(f.messages.filter(m=>['uploadAttachment','downloadDisarmed'].includes(m.action)).map(m=>({action:m.action,messageId:m.messageId,partName:m.partName})),[
   {action:'uploadAttachment',messageId:7,partName:'1.2'},
   {action:'downloadDisarmed',messageId:7,partName:'1.3'}
  ]);
  const ids=[...area.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
  for(const button of [...rescans,...downloads]){
   const status=f.dom.window.document.getElementById(button.getAttribute('aria-describedby'));
   assert.ok(status);assert.equal(status.closest('.card'),button.closest('.card'));
  }
  assert.equal(rescans[1].disabled,false);assert.equal(downloads[0].disabled,false);
  assert.equal(f.dom.window.document.getElementById(rescans[1].getAttribute('aria-describedby')).textContent,'');
  assert.equal(f.dom.window.document.getElementById(downloads[0].getAttribute('aria-describedby')).textContent,'');
  assert.ok(f.dom.window.document.getElementById(rescans[0].getAttribute('aria-describedby')).textContent.includes('Controlled refusal'));
  assert.equal(JSON.stringify(record),before);assert.equal(f.requests.length,0);
 }finally{f.close();}
});

test('replacing a report binds its new controls and detached or closed report controls stay inert',async()=>{
 const record={attachments:[{partName:'1.2',attachment_name:'fixture.html',hybrid_sha256:'hash',state:'KNOWN',report:{state:'COMPLETE'}}]},f=await popup(record);
 try{
  const area=f.dom.window.document.getElementById('hybrid_analysis_api_content'),old=area.querySelector('button'),oldCard=old.closest('.card');
  const card=f.context.render_hybrid_report_ui({hybrid_sha:'hash',attachmentName:'fixture.html',messageId:7,partName:'1.2',headerMessageId:'fixture',json_data:{state:'COMPLETE'}},area,oldCard);
  old.click();assert.equal(f.messages.some(m=>m.action==='uploadAttachment'),false);
  card.querySelector('button').click();await new Promise(setImmediate);
  assert.equal(f.messages.filter(m=>m.action==='uploadAttachment').length,1);
  f.dom.window.dispatchEvent(new f.dom.window.Event('pagehide'));
  for(const button of card.querySelectorAll('button'))button.click();await new Promise(setImmediate);
  assert.equal(f.messages.filter(m=>['uploadAttachment','downloadDisarmed'].includes(m.action)).length,1);
 }finally{f.close();}
});

test('an unbound report remains read-only and never enables an attachment action',async()=>{
 const f=await popup({});try{
  const area=f.dom.window.document.getElementById('hybrid_analysis_api_content');
  const card=f.context.render_hybrid_report_ui({hybrid_sha:'legacy',attachmentName:'unbound.html',json_data:{state:'COMPLETE'}},area);
  assert.equal(card.querySelectorAll('button').length,1);assert.equal(card.querySelector('button').disabled,true);
  card.querySelector('button').click();assert.equal(f.messages.some(m=>['uploadAttachment','downloadDisarmed','scanUrl'].includes(m.action)),false);
 }finally{f.close();}
});

test('URL report rescan uses the bound URL action and offers no local attachment download',async()=>{
 const url='https://target.example.invalid/page.html';
 const f=await popup({links:[{url,hybrid_sha256:'url-hash',state:'KNOWN',report:{state:'COMPLETE',verdict:'clean',threat_score:0}}]});
 try{
  const area=f.dom.window.document.getElementById('hybrid_analysis_api_content');
  const button=[...area.querySelectorAll('button')].find(b=>b.textContent===f.catalog.ui_034.message);
  button.click();await new Promise(setImmediate);
  const actions=f.messages.filter(m=>['scanUrl','uploadAttachment','downloadDisarmed'].includes(m.action));
  assert.equal(actions.length,1);assert.equal(actions[0].action,'scanUrl');
  assert.equal(actions[0].url,url);assert.equal(actions[0].messageId,7);assert.equal(actions[0].headerMessageId,'fixture');
  assert.equal([...area.querySelectorAll('button')].some(b=>b.textContent===f.catalog.ui_035.message),false);
  assert.equal(f.requests.length,0);
 }finally{f.close();}
});

test('one unreadable stored protocol does not erase its neighboring report or rewrite stored data',async()=>{
 const record={links:[
  {url:'https://broken.example.invalid',state:'KNOWN',hybrid_sha256:'a',report:{state:'COMPLETE',last_file_name:{toString:null}}},
  {url:'https://valid.example.invalid',state:'KNOWN',hybrid_sha256:'b',report:{state:'COMPLETE',threat_score:90,verdict:'malicious'}}
 ]},before=JSON.stringify(record);
 const f=await popup(record);try{
  const content=f.dom.window.document.getElementById('hybrid_analysis_api_content');
  assert.equal(f.dom.window.document.getElementById('unexpected-error-msg'),null);
  assert.ok(content.textContent.includes(f.catalog.reportDisplayFailed.message));
  assert.ok(content.textContent.includes('valid.example.invalid'));
  assert.equal(JSON.stringify(record),before);assert.equal(f.requests.length,0);
 }finally{f.close();}
});

test('missing scores stay unknown and malformed optional fields have six-language notices',async()=>{
 for(const lang of ['en','de','fr','es','it','pl']){
  const f=await popup({attachments:[{attachment_name:'fixture.bin',partName:'1.2',state:'KNOWN',hybrid_sha256:'a',report:{state:'COMPLETE',threat_score:null,tags:{},scanners:{}}}]},lang);
  try{
   const content=f.dom.window.document.getElementById('hybrid_analysis_api_content');
   assert.equal(f.dom.window.document.getElementById('unexpected-error-msg'),null);
   assert.ok(content.textContent.includes(f.catalog.reportFieldsUnavailable.message));
   assert.ok(content.textContent.includes(f.catalog.providerUnknown.message));
   assert.equal(content.querySelector('.text-success'),null);assert.equal(f.requests.length,0);
  }finally{f.close();}
 }
});
