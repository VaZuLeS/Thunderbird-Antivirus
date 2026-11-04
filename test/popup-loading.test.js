const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');

async function popup(record, lang='de') {
 const dom=new JSDOM(fs.readFileSync('popup.html','utf8'),{url:'https://addon.invalid/popup.html'});
 const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json'));
 const requests=[],reads=[];
 const browser={
  tabs:{query:async()=>[{id:1}]},messageDisplay:{getDisplayedMessages:async()=>({messages:[{id:7,headerMessageId:'fixture',subject:'Fixture',author:'sender@example.invalid'}]})},
  storage:{local:{get:async()=>({apikey:'fixture',externalAnalysisConsent:true})},onChanged:{addListener(){}}},
  permissions:{contains:async()=>true},
  runtime:{onMessage:{addListener(){}},getURL:p=>'https://addon.invalid/'+p,openOptionsPage(){},sendMessage:async request=>{
   reads.push(request.action);
   if(request.action==='getMessageAnalysisRecord')return {success:true,record};
   if(request.action==='getMessageAnalysis')return {success:true,messageId:7,local:{state:'checked'},rows:[],availability:{}};
   if(request.action==='getLocalRisk')return {threat:{score:0,reasons:[]}};
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
 return {dom,context,requests,reads,catalog,close:()=>dom.window.close()};
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
