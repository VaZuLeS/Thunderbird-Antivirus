'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {JSDOM}=require('jsdom');
const profiles=require('../../enterprise_profiles.js');

test('all 3125 mixed profile combinations stay disabled and contain no credentials or activity',()=>{
    const keys=Object.keys(profiles.categories);
    let count=0;
    function check(selection,index){
        if(index<keys.length){for(const p of profiles.categories[keys[index]])check({...selection,[keys[index]]:p.id},index+1);return;}
        const draft=profiles.buildDraft(selection);count++;
        assert.equal(draft.mode,'disabled');assert.equal(draft.privacy.automaticTransmission,false);
        assert.equal(draft.readiness.deployment,'not_deployed');
        for(const integration of Object.values(draft.integrations)){assert.equal(integration.enabled,false);assert.deepEqual(integration.settings,{});}
        assert.equal(JSON.stringify(draft).includes('https://'),false);
    }
    check({},0);assert.equal(count,3125);
});

test('invalid selections cannot smuggle activation or secrets into generated drafts',()=>{
    for(const invalid of [null,[],{mode:'enabled'},{sso:'__proto__'},{siem:'constructor'},{tickets:{token:'secret'}},JSON.parse('{"__proto__":{"enabled":true}}')]){
        assert.throws(()=>profiles.buildDraft(invalid),/PROFILE_SELECTION_INVALID/);
    }
    const draft=profiles.buildDraft(profiles.bundles.microsoft);
    draft.integrations.hosting.components.push('changed');draft.selection.sso='none';
    assert.equal(profiles.buildDraft(profiles.bundles.microsoft).selection.sso,'entra-id');
    assert.equal(profiles.categories.hosting.find(p=>p.id==='azure').components.includes('changed'),false);
    assert.ok(Object.isFrozen(profiles.bundles.microsoft));
});

test('CLI creates private drafts and refuses to overwrite existing operator files',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thundy-profiles-'));
    try{
        const output=path.join(dir,'config.json');
        const run=args=>spawnSync(process.execPath,['enterprise/configure.cjs',...args],{encoding:'utf8'});
        let result=run(['--hosting','azure','--sso','keycloak','--out',output]);
        assert.equal(result.status,0);const content=fs.readFileSync(output,'utf8');
        assert.equal(JSON.parse(content).selection.sso,'keycloak');
        if(process.platform!=='win32')assert.equal(fs.statSync(output).mode&0o777,0o600);
        result=run(['--out',output]);assert.equal(result.status,1);assert.match(result.stderr,/EEXIST/);assert.equal(fs.readFileSync(output,'utf8'),content);
        for(const args of [['--token','secret'],['--sso','none','--sso','entra-id'],['--hosting'],['--siem','bogus']])assert.equal(run(args).status,1);
        assert.equal(JSON.parse(run([]).stdout).selection.siem,'none');
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

async function setup(language='en',saved){
    const dom=new JSDOM(fs.readFileSync('enterprise_setup.html','utf8'));
    const state={externalConsent:true,enterpriseProfileSelection:saved};let blob,download,networkCalls=0;
    const catalog=JSON.parse(fs.readFileSync('_locales/'+language+'/messages.json','utf8'));
    const MockURL=class extends URL{};MockURL.createObjectURL=data=>{blob=data;return 'blob:profile';};MockURL.revokeObjectURL=()=>{};
    const context=vm.createContext({document:dom.window.document,URL:MockURL,Blob,
        fetch:()=>{networkCalls++;throw new Error('network prohibited');},
        browser:{i18n:{getUILanguage:()=>language,getMessage:key=>catalog[key]?.message||''},
            storage:{local:{get:async()=>({enterpriseProfileSelection:state.enterpriseProfileSelection}),set:async data=>Object.assign(state,data),remove:async key=>delete state[key]}},
            downloads:{download:async data=>{download=data;return 1;}}}});
    for(const file of ['i18n.js','enterprise_profiles.js','enterprise_setup.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
    await new Promise(resolve=>setImmediate(resolve));
    return {document:dom.window.document,dom,state,getBlob:()=>blob,getDownload:()=>download,getNetworkCalls:()=>networkCalls};
}
for(const language of ['en','de','fr','es','it','pl'])test('offline '+language+' assistant saves, exports and resets only its own selection',async()=>{
    const ui=await setup(language);const $=id=>ui.document.getElementById(id);
    assert.equal(JSON.parse($('profilePreview').textContent).selection.sso,'none');
    $('profileBundle').value='microsoft';$('profileBundle').dispatchEvent(new ui.dom.window.Event('change'));
    $('profileSiem').value='none';$('profileSiem').dispatchEvent(new ui.dom.window.Event('change'));
    $('profileSave').click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(ui.state.enterpriseProfileSelection.sso,'entra-id');assert.equal(ui.state.enterpriseProfileSelection.siem,'none');assert.equal(ui.state.externalConsent,true);
    $('profileExport').click();await new Promise(resolve=>setImmediate(resolve));
    const exported=JSON.parse(await ui.getBlob().text());assert.equal(exported.mode,'disabled');assert.equal(exported.integrations.sso.enabled,false);assert.equal(ui.getDownload().saveAs,true);
    $('profileReset').click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(ui.state.enterpriseProfileSelection,undefined);assert.equal(ui.state.externalConsent,true);assert.equal(ui.getNetworkCalls(),0);
    assert.equal(JSON.parse($('profilePreview').textContent).selection.sso,'none');ui.dom.window.close();
});

test('malformed saved profile falls back to a disabled local draft',async()=>{
    const ui=await setup('de',{sso:'unknown',enabled:true});
    const draft=JSON.parse(ui.document.getElementById('profilePreview').textContent);
    assert.equal(draft.selection.hosting,'local-development');assert.equal(draft.mode,'disabled');
    assert.ok(ui.document.getElementById('profileStatus').textContent);ui.dom.window.close();
});
