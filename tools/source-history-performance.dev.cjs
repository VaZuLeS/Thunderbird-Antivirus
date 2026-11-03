// Reproducible DOM measurements, not native layout or screen reader evidence.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks'),{JSDOM}=require('jsdom');
const input=process.argv[2] || 'analysis_status.js',output=process.argv[3];
const source=fs.readFileSync(input,'utf8'),results=[];
for(const lang of ['en','de','fr','es','it','pl']){
 const dom=new JSDOM('<html lang="'+lang+'"><body></body></html>',{pretendToBeVisual:true});
 try{
  const c=vm.createContext({document:dom.window.document,Date,URL});vm.runInContext(source+'\nglobalThis.a=ThundyAnalysis;',c);
  const catalog=JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json')),labels=c.a.labels(key=>catalog[key]?.message || key);
  const rows=Array.from({length:1200},(_,index)=>({provider:['hybridanalysis','virustotal','urlhaus','abuseipdb','urlscan'][index%5],scope:'url',resource:null,state:'checked',source:'stored',verdict:index===1199?'malicious':'none',observedAt:1790000000000+index*1000,findingAt:1790000000000+index*1000,responses:1}));
  const data={local:{state:'checked'},rows:[],sourceHistory:{rows,truncated:false}},samples=[];
  let host;
  for(let run=0;run<3;run++){const started=performance.now();host=c.a.render(data,labels);samples.push(Math.round((performance.now()-started)*100)/100);}
  const root=host.shadowRoot,detail=root.querySelector('[data-key="unbound-history"]');
  const historyNodes=root.querySelectorAll('*').length,historyRows=detail.querySelectorAll('li').length;
  const warningPresent=detail.textContent.includes(catalog.analysisVerdict_malicious.message);
  const warningIndicator=detail.querySelector('summary').textContent.includes(catalog.analysisHistoryFlagged.message);
  const jump=detail.querySelector('[data-focus-key="history-find-warning"]');
  const jumpStarted=performance.now();jump?.click();
  const jumpToLastWarningMs=jump ? Math.round((performance.now()-jumpStarted)*100)/100 : null;
  const lastWarningReachable=!!jump && detail.textContent.includes(catalog.analysisVerdict_malicious.message) && detail.textContent.includes(new Date(rows[1199].observedAt).toLocaleString(lang));
  const started=performance.now();c.a.render({...data,rows:rows.map((row,index)=>({...row,resource:'link:'+index})),resourceLabels:Object.fromEntries(Array.from({length:500},(_,i)=>['link:'+i,'Synthetic resource '+i]))},labels);
  results.push({lang,historyOnlyMs:samples,historyOnlyNodes:historyNodes,historyRowsRendered:historyRows,lastHistoricalWarningVisible:warningPresent,historicalWarningIndicatorVisible:warningIndicator,lastWarningReachable,jumpToLastWarningMs,mixedMs:Math.round((performance.now()-started)*100)/100,mixedNodes:root.querySelectorAll('*').length});
 }finally{dom.window.close();}
}
const report={schemaVersion:1,kind:'source-history-dom-measurement',scope:'Synthetic JSDOM DOM construction including date formatting; no browser layout, RSS, user comprehension or screen reader claim',node:process.version,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),results};
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
