/* Trusted extension-page client. Never loaded into email documents. */
const ThundySettings = (() => {
    let token=null, timer=null, busy=false;
    const t=key=>ThundyI18n.get(key);
    const send=async request=>{
        const result=await browser.runtime.sendMessage({...request,token});
        if(!result?.success && result?.code)throw Object.assign(Error(result.code),{code:result.code});
        return result;
    };
    const set=values=>send({action:'securitySettingsWrite',values});
    const storage={get:(...args)=>browser.storage.local.get(...args),set};
    async function command(op,values={}){return send({action:'securityCommand',op,...values});}
    async function mount(){
        const shell=document.querySelector('.settings-shell')||document.querySelector('main');
        if(!shell)return;
        const initial=await command('status');
        if(!initial.protected&&!location.pathname.endsWith('/options.html'))return;
        const hideShell=!location.pathname.endsWith('/audit.html');
        shell.hidden=hideShell;
        const panel=document.createElement('section');panel.className='security-controls';panel.setAttribute('aria-label',t('securityTitle'));
        const heading=document.createElement('h2');heading.textContent=t('securityTitle');panel.append(heading);
        const note=document.createElement('p');note.textContent=t('securityScope');panel.append(note);
        const state=document.createElement('p');state.id='securityState';state.setAttribute('role','status');panel.append(state);
        const form=document.createElement('form');form.id='securitySettingsForm';panel.append(form);
        const field=(key,type='password')=>{const label=document.createElement('label');label.textContent=t(key);const input=document.createElement('input');input.type=type;input.dataset.security=key;input.autocomplete=type==='password'?'new-password':'off';label.append(input);form.append(label);return input;};
        const admin=field('securityAdminPassword'),approval=field('securityApprovalPassword');
        const threshold=field('securityThreshold','number');threshold.required=true;threshold.min='0';threshold.max='100';threshold.value='50';
        const enabled=field('securityEnablePolicy','checkbox');
        const unknown=field('securityUnknownApproval','checkbox');
        const unlock=document.createElement('button');unlock.type='button';unlock.dataset.security='unlock';unlock.textContent=t('securityUnlock');form.append(unlock);
        const save=document.createElement('button');save.type='submit';save.textContent=t('securitySave');form.append(save);
        const lock=document.createElement('button');lock.type='button';lock.dataset.security='lock';lock.textContent=t('securityLock');form.append(lock);
        const disable=document.createElement('button');disable.type='button';disable.textContent=t('securityDisable');form.append(disable);
        const recovery=field('securityRecovery','text');
        const recover=document.createElement('button');recover.type='button';recover.textContent=t('securityRecover');form.append(recover);
        const stop=document.createElement('button');stop.type='button';stop.textContent=t('securityStopTransfers');panel.append(stop);
        const output=document.createElement('p');output.id='securityRecoveryOutput';output.setAttribute('role','status');output.style.overflowWrap='anywhere';panel.append(output);
        const providers=document.createElement('details');const providerTitle=document.createElement('summary');providerTitle.textContent=t('analysisProviderSetup');providers.append(providerTitle);
        const configured=await browser.storage.local.get(null);
        for(const [id,config] of Object.entries(ThundyProviders.registry)) {
            const entry=document.createElement('section'),name=document.createElement('h2');name.textContent=config.name;entry.append(name);
            const p=document.createElement('p');p.textContent=t(configured[config.key]?'analysisProviderConfigured':'analysisProviderNoKey');entry.append(p);
            for(const [scope,tier] of Object.entries(config.capabilities)){const line=document.createElement('p');line.textContent=t('analysisData'+scope[0].toUpperCase()+scope.slice(1))+' · '+tier;entry.append(line);}
            const test=configured.providerConnectionTests?.[id];if(test){const result=document.createElement('p');result.textContent=t('testApiKeyTesting')+': '+test.status+' · '+new Date(test.observedAt).toLocaleString()+' · HTTP '+(test.httpStatus||'—');entry.append(result);}
            providers.append(entry);
        }
        panel.append(providers);
        document.body.prepend(panel);
        let current;
        const refresh=async()=>{
            try{current=await command('status');shell.hidden=hideShell&&!current.unlocked;
                state.textContent=t(current.protected?current.unlocked?'securityUnlocked':'securityLocked':'securityOptional');
                approval.disabled=!current.unlocked;threshold.disabled=!current.unlocked;enabled.disabled=!current.unlocked;unknown.disabled=!current.unlocked;save.disabled=!current.unlocked;disable.hidden=!current.protected||!current.unlocked;lock.hidden=!current.protected||!current.unlocked;unlock.hidden=!current.protected||current.unlocked;recovery.hidden=current.unlocked;recover.hidden=current.unlocked;
                threshold.value=current.policy.threshold;enabled.checked=current.policy.enabled;unknown.checked=current.policy.unknown==='approval';
            }catch(_){shell.hidden=hideShell;state.textContent=t('securityError');}
        };
        const run=async fn=>{if(busy)return;busy=true;output.textContent='';try{await fn();await refresh();}catch(e){output.textContent=t(e.code==='PASSWORD_WAIT'?'securityWait':e.code==='PASSWORD_LENGTH'?'securityLength':'securityError');if(e.code==='ADMIN_LOCKED')await refresh();}finally{busy=false;admin.value='';approval.value='';recovery.value='';}};
        unlock.onclick=()=>run(async()=>{token=(await command('unlock',{password:admin.value})).token;connect();});
        form.onsubmit=event=>{event.preventDefault();run(async()=>{const result=await command('configure',{adminPassword:admin.value||undefined,approvalPassword:approval.value||undefined,policy:{enabled:enabled.checked,threshold:Number(threshold.value),unknown:unknown.checked?'approval':'warn'}});token=null;output.textContent=result.recovery?t('securityRecoverySave')+' '+result.recovery:t('securitySaved');});};
        lock.onclick=()=>run(async()=>{await command('lock');token=null;});
        disable.onclick=()=>run(async()=>{if(!window.confirm(t('securityDisableConfirm')))return;await command('disableAdmin');token=null;});
        recover.onclick=()=>run(async()=>{const result=await command('recover',{recovery:recovery.value,password:admin.value});token=null;output.textContent=t('securityRecoverySave')+' '+result.recovery;});
        stop.onclick=()=>run(async()=>{await set({externalAnalysisConsent:false});output.textContent=t('securityStopped');});
        let lastTouch=0;
        const activity=()=>{if(!token||Date.now()-lastTouch<15000)return;lastTouch=Date.now();command('touch').catch(()=>refresh());};
        document.addEventListener('pointerdown',activity);document.addEventListener('keydown',activity);
        timer=setInterval(async()=>{if(token){const status=await command('status').catch(()=>null);if(!status?.unlocked){token=null;await refresh();}}},15000);
        window.addEventListener('pagehide',()=>{clearInterval(timer);if(token)command('lock').catch(()=>{});token=null;},{once:true});
        await refresh();
    }
    let port;
    function connect(){try{port?.disconnect();port=browser.runtime.connect({name:'thundy-admin-session'});port.postMessage({token});}catch(_){}}
    document.addEventListener('DOMContentLoaded',mount);
    return {send,set,storage,command};
})();
