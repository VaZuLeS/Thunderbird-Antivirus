// Synthetic Storage API benchmark; does not measure physical disk writes.
const fs = require('node:fs'), vm = require('node:vm'), { execFileSync } = require('node:child_process'), { performance } = require('node:perf_hooks'), crypto = require('node:crypto');
function measure(source, count) {
  let reads=0,writes=0;
  const store={linkAuditProfileId:'synthetic-benchmark',linkAuditLog:Array.from({length:count},(_,i)=>({id:String(i),clickedAt:Date.now()-i,url:'https://benchmark.invalid/'+i,outcome:'PENDING',decidedAt:null}))};
  const context=vm.createContext({TextEncoder,crypto:crypto.webcrypto,browser:{storage:{local:{get:async()=>{reads++;return structuredClone(store)},set:async value=>{writes++;Object.assign(store,structuredClone(value))}}}}});
  vm.runInContext(fs.readFileSync('runtime.js','utf8')+'\n'+source,context);
  return (async()=>{const times=[];for(let i=0;i<10;i++){const start=performance.now();await context.readLinkAudit();times.push(performance.now()-start)}return {count,reads,writes,meanReadMs:times.reduce((a,b)=>a+b,0)/times.length,serializedBytes:Buffer.byteLength(JSON.stringify(store.linkAuditLog))}})();
}
(async()=>{const result={synthetic:true,physicalDiskMeasured:false,node:process.version,before:[],after:[]};for(const count of [0,50,2000]){result.before.push(await measure(execFileSync('git',['show','3024636:link_audit.js'],{encoding:'utf8'}),count));result.after.push(await measure(fs.readFileSync('link_audit.js','utf8'),count))}console.log(JSON.stringify(result,null,2))})();
