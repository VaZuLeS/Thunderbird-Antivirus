const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
function risk(){const c=vm.createContext({uiText:(_k,f)=>f});vm.runInContext(fs.readFileSync('risk.js','utf8'),c);return c;}
test('authentication parser ignores prose, comments, suffixes and malformed syntax',()=>{
 const c=risk();for(const headers of [
 ['mx; spf=passage; dkim=passage; dmarc=passage'],
 ['mx; spf=pass (comment: dkim=pass dmarc=pass)'],
 ['mx; spf=pass reason="dkim=pass; dmarc=pass"'],
 ['mx; spf=pass; dkim=pass; dmarc=pass (unterminated'],
 ['mx; spf=temperror; dkim=pass; dmarc=pass'],
 ['mx; spf=none; dkim=pass; dmarc=pass'],
 ['mx; spf=permerror; dkim=pass; dmarc=pass'],
 ['mx; spf=neutral; dkim=pass; dmarc=pass'],
 ])assert.equal(c.evaluateAuthHeaders(headers,0,[]).authStatus,'neutral',String(headers));
 assert.equal(c.evaluateAuthHeaders(['mx; spf=pass (nested (escaped \\) comment));\r\n\tdkim=pass; dmarc=pass'],0,[]).authStatus,'pass');
 for(const result of ['fail','softfail'])assert.equal(c.evaluateAuthHeaders(['mx; spf='+result+'; spf=pass; dkim=pass; dmarc=pass'],0,[]).authStatus,'fail');
 assert.equal(c.parseAuthenticationResults(['mx; spf=temperror']).spf[0],'temperror');
});
function audit(stored={}){let writes=0;const c=vm.createContext({TextEncoder,crypto:crypto.webcrypto,browser:{storage:{local:{get:async()=>structuredClone(stored),set:async values=>{writes++;Object.assign(stored,structuredClone(values))}}}}});vm.runInContext(fs.readFileSync('runtime.js','utf8')+'\n'+fs.readFileSync('link_audit.js','utf8'),c);return {c,stored,writes:()=>writes};}
test('read-only audit skips unchanged writes but persists pruning and profile creation',async()=>{
 const a=audit();await a.c.readLinkAudit();assert.equal(a.writes(),1);await a.c.readLinkAudit();assert.equal(a.writes(),1);
 a.stored.linkAuditLog=[{id:'old',clickedAt:0}];await a.c.readLinkAudit();assert.equal(a.writes(),2);assert.equal(a.stored.linkAuditLog.length,0);
 a.stored.linkAuditLog=[{id:'valid',clickedAt:Date.now(),outcome:'PENDING'}];
 await Promise.all([a.c.readLinkAudit(),a.c.updateLinkAudit('valid',{outcome:'ABORTED'}),a.c.readLinkAudit()]);
 assert.equal(a.stored.linkAuditLog[0].outcome,'ABORTED');assert.equal(a.writes(),3);
});
test('decision reason snapshot is immutable and missing early evidence stays missing',()=>{
 const {c}=audit();const s={scoredAt:10,reasons:['old'],reasonDetails:[{code:'old'}],checked:true,providerCheckedAt:10,providerReasons:['provider-old'],check:{origin:'stored'}};
 const snap=c.decisionReasons(s,11);s.reasons.push('later');s.reasonDetails[0].code='later';s.check.origin='live';
 assert.deepEqual(Array.from(snap.reasonsAtDecision),['old']);assert.equal(snap.reasonDetailsAtDecision[0].code,'old');assert.equal(snap.checkAtDecision.origin,'stored');
 assert.equal(c.decisionReasons({...s,scoredAt:20,checked:false},11).reasonsAtDecision,null);
});
test('support projection rejects canaries in arbitrary fields and enum values',async()=>{
 const c=vm.createContext({document:{addEventListener(){},getElementById(){return {addEventListener(){}}}}});vm.runInContext(fs.readFileSync('options.js','utf8')+'\nglobalThis.support=SupportReport;',c);
 const canary='SECRET https://user:pass@private.invalid/path?key=secret#fragment /home/person/profile';
 const api={runtime:{getManifest:()=>({version:'1.24.3',name:canary}),getBrowserInfo:async()=>({version:'153.6.0',vendor:canary})},storage:{local:{get:async()=>({apikey:canary,customWhitelist:[canary],privacyTier:canary,externalAnalysisConsent:false,alwaysManual:true,thundyAppearance:'dark',error:canary})}}};
 const report=await c.support.create(api,true);assert.ok(!JSON.stringify(report).includes(canary));assert.ok(!JSON.stringify(report).includes('apikey'));assert.equal(report.configuration.alwaysManual,true);assert.equal(report.configuration.privacyTier,undefined);assert.equal(report.authenticatedSource,false);
 assert.equal((await c.support.create(api,false)).configuration,undefined);
});
test('CI routing preserves PR, fork, main, tag and standalone branch checks; API errors run checks',async()=>{
 const {shouldRunChecks}=require('../scripts/ci-event');const base={eventName:'push',ref:'refs/heads/feature',defaultBranch:'main',owner:'owner',repository:'repo',listOpenPulls:async()=>[{state:'open',head:{ref:'feature',repo:{full_name:'owner/repo'}}}]};
 assert.equal(await shouldRunChecks(base),false);
 for(const patch of [{eventName:'pull_request'},{eventName:'workflow_call'},{ref:'refs/heads/main'},{ref:'refs/tags/v1.24.3'},{listOpenPulls:async()=>[]},{listOpenPulls:async()=>{throw new Error('403')}},{listOpenPulls:async()=>[{state:'open',head:{ref:'feature',repo:{full_name:'fork/repo'}}}]}])assert.equal(await shouldRunChecks({...base,...patch}),true);
});
