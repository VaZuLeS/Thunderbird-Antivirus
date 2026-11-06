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
function profiles(){const c=vm.createContext({document:{addEventListener(){},getElementById(){return {addEventListener(){}}}}});vm.runInContext(fs.readFileSync('options.js','utf8')+'\nglobalThis.profiles=LocalSettingsProfile;',c);return c.profiles;}
test('portable profiles exclude keys, consent, rules and history and reject unsupported schemas',()=>{
 const p=profiles();const profile=p.create({thundyAppearance:'dark',thundyAccent:'forest',thundyDensity:'compact',apikey:'secret',externalAnalysisConsent:true,linkAuditLog:[{outcome:'OPENED'}]});
 assert.deepEqual(JSON.parse(JSON.stringify(profile)),{schemaVersion:1,kind:'thundy-local-settings',appearance:{mode:'dark',accent:'forest',density:'compact'}});
 for(const mutation of [v=>{v.schemaVersion=2},v=>{v.apikey='secret'},v=>{v.appearance.mode='javascript:alert(1)'},v=>{v.appearance.externalAnalysisConsent=true},v=>{delete v.appearance.density},v=>{v.appearance=[]},v=>{v.kind='enterprise-profile'}]){const bad=JSON.parse(JSON.stringify(profile));mutation(bad);assert.throws(()=>p.parse(JSON.stringify(bad)));}
 assert.throws(()=>p.parse(' '.repeat(8193)));assert.throws(()=>p.parse('{"__proto__":{"polluted":true}}'));assert.equal({}.polluted,undefined);
 const Ajv=require('ajv/dist/2020');const validate=new Ajv().compile(JSON.parse(fs.readFileSync('docs/schemas/local-settings-profile-v1.json')));assert.equal(validate(JSON.parse(JSON.stringify(profile))),true);assert.equal(validate({...profile,externalAnalysisConsent:true}),false);
});
test('profile preview is read-only; confirmation writes only appearance and rejects stale or failed changes',async()=>{
 const p=profiles();const store={apikey:'retained',externalAnalysisConsent:false,timeOfClickProtection:true,linkAuditLog:[{outcome:'PENDING'}],thundyAppearance:'light',thundyAccent:'ocean',thundyDensity:'comfortable'};let writes=0,fail=false;
 const storage={get:async()=>structuredClone(store),set:async value=>{if(fail)throw new Error('quota');writes++;Object.assign(store,structuredClone(value))}};
 const profile=p.create({thundyAppearance:'dark',thundyAccent:'forest',thundyDensity:'compact'});
 const draft=await p.prepare(JSON.stringify(profile),storage);assert.equal(writes,0);assert.equal(store.thundyAppearance,'light');
 store.thundyAccent='amber';await assert.rejects(p.commit(draft,storage),/PROFILE_CHANGED/);assert.equal(writes,0);
 const fresh=await p.prepare(JSON.stringify(profile),storage);fail=true;await assert.rejects(p.commit(fresh,storage),/quota/);assert.equal(store.thundyAppearance,'light');fail=false;
 await p.commit(fresh,storage);assert.equal(writes,1);assert.equal(store.thundyAppearance,'dark');assert.equal(store.apikey,'retained');assert.equal(store.externalAnalysisConsent,false);assert.equal(store.timeOfClickProtection,true);assert.equal(store.linkAuditLog[0].outcome,'PENDING');
});
function protectionProfiles(){const c=vm.createContext({document:{addEventListener(){},getElementById(){return {addEventListener(){}}}}});vm.runInContext(fs.readFileSync('options.js','utf8')+'\nglobalThis.protection=LocalProtectionProfile;',c);return c.protection;}
test('local protection profiles validate safe protection options and reject keys, consent, rules and history (AVN-010)',async()=>{
 const p=protectionProfiles();const profile=p.create({privacyTier:'balanced',alwaysManual:true,timeOfClickProtection:true,apikey:'secret',externalAnalysisConsent:true,scanningEnabledSenders:['a@b.test'],linkAuditLog:[{outcome:'OPENED'}]});
 assert.deepEqual(JSON.parse(JSON.stringify(profile)),{schemaVersion:1,kind:'thundy-local-protection',protection:{privacyTier:'balanced',alwaysManual:true,timeOfClickProtection:true}});
 for(const mutation of [v=>{v.schemaVersion=2},v=>{v.apikey='secret'},v=>{v.externalAnalysisConsent=true},v=>{v.protection.privacyTier='all'},v=>{v.protection.alwaysManual='yes'},v=>{v.protection.externalAnalysisConsent=true},v=>{v.protection.scanningEnabledSenders=['x@y.z']},v=>{delete v.protection.timeOfClickProtection},v=>{v.kind='thundy-local-settings'}]){const bad=JSON.parse(JSON.stringify(profile));mutation(bad);assert.throws(()=>p.parse(JSON.stringify(bad)));}
 assert.throws(()=>p.parse(' '.repeat(8193)));assert.throws(()=>p.parse('{"__proto__":{"polluted":true}}'));assert.equal({}.polluted,undefined);
 const Ajv=require('ajv/dist/2020');const validate=new Ajv().compile(JSON.parse(fs.readFileSync('docs/schemas/local-protection-profile-v1.json')));
 assert.equal(validate(JSON.parse(JSON.stringify(profile))),true);assert.equal(validate({...profile,externalAnalysisConsent:true}),false);
 const store={apikey:'retained',externalAnalysisConsent:false,privacyTier:'strict',alwaysManual:false,timeOfClickProtection:true,scanningEnabledSenders:['keep@example.com'],linkAuditLog:[{outcome:'PENDING'}]};let writes=0,fail=false;
 const storage={get:async()=>structuredClone(store),set:async value=>{if(fail)throw new Error('quota');writes++;Object.assign(store,structuredClone(value))}};
 const draft=await p.prepare(JSON.stringify(profile),storage);assert.equal(writes,0);assert.equal(store.privacyTier,'strict');
 store.alwaysManual=true;await assert.rejects(p.commit(draft,storage),/PROFILE_CHANGED/);assert.equal(writes,0);
 store.alwaysManual=false;const fresh=await p.prepare(JSON.stringify(profile),storage);fail=true;await assert.rejects(p.commit(fresh,storage),/quota/);assert.equal(store.privacyTier,'strict');fail=false;
 await p.commit(fresh,storage);assert.equal(writes,1);assert.equal(store.privacyTier,'balanced');assert.equal(store.alwaysManual,true);assert.equal(store.apikey,'retained');assert.equal(store.externalAnalysisConsent,false);assert.deepEqual(store.scanningEnabledSenders,['keep@example.com']);assert.equal(store.linkAuditLog[0].outcome,'PENDING');
});
test('synthetic risk corpus evaluates legitimate counterexamples and threat contracts (AVN-005)',()=>{
 const {execFileSync}=require('node:child_process');
 const out=JSON.parse(execFileSync(process.execPath,['tools/risk-corpus.dev.cjs'],{encoding:'utf8'}));
 assert.equal(out.kind,'thundy-synthetic-risk-corpus');
 assert.equal(out.privateSuffixSeparation,true);
 assert.ok(out.results.length>=17);
 assert.ok(out.results.every(r=>r.passed===true));
});

