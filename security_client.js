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
    const storage={get:(...args)=>browser.storage.local.get(...args),set:values=>{
        if (document.getElementById('timeOfClickProtection')?.dataset.managed) {
            const {timeOfClickProtection,...editable} = values;
            return set(editable);
        }
        return set(values);
    }};
    async function command(op,values={}){return send({action:'securityCommand',op,...values});}
    function mountReporting(panel) {
        const section = document.createElement('section');
        section.className = 'security-controls';
        section.id = 'incidentReporting';
        const heading = document.createElement('h2');
        heading.textContent = t('reportingTitle');
        const status = document.createElement('p');
        status.setAttribute('role','status');
        const destination = document.createElement('p');
        const lastReceipt = document.createElement('p');
        const oldestPending = document.createElement('p');
        const enrollment = document.createElement('form');
        const consentLabel = document.createElement('label');
        const consent = document.createElement('input');
        consent.type='checkbox';consent.required=true;
        const explanation = document.createElement('span');
        consentLabel.append(consent,explanation);
        const credentialLabel = document.createElement('label');
        const credential = document.createElement('input');
        credential.type='password';credential.required=true;credential.minLength=16;credential.maxLength=1024;
        credential.autocomplete='off';credential.spellcheck=false;
        credentialLabel.append(t('reportingToken'),credential);
        const activate = document.createElement('button');
        activate.textContent=t('reportingActivate');
        enrollment.append(consentLabel,credentialLabel,activate);
        const revoke = document.createElement('button');
        revoke.type='button';revoke.textContent=t('reportingRevoke');
        const result = document.createElement('p');
        result.setAttribute('role','status');
        section.append(heading,status,destination,lastReceipt,oldestPending,enrollment,revoke,result);
        panel.after(section);
        let sending = false, currentReporting;
        function render(info, unlocked) {
            currentReporting = info;
            section.hidden = !info;
            if (!info) return;
            const states = {off:'reportingOff',invalid:'managedPolicyInvalid',consent:'reportingNeedsConsent',permission:'reportingNeedsPermission',ready:'reportingReady',storage:'reportingStorage'};
            const failures = {authentication:'reportingAuthentication',rejected:'reportingRejected',storage:'reportingStorage',full:'reportingFull',expired:'reportingExpired'};
            const label = [t(states[info.state]), info.endpoint ? t('reportingQueued')+' '+info.queued : '',
                info.failure ? t(failures[info.failure]) : ''].filter(Boolean).join(' · ');
            if (status.textContent !== label) status.textContent = label;
            destination.textContent = info.endpoint ? [info.endpoint,t(info.mode==='malicious'?'reportingMalicious':'reportingSuspicious')].join(' · ') : '';
            for (const [line,label,at,id] of [
                [lastReceipt,'reportingLastReceipt',info.lastReceiptAt,info.lastReceiptId],
                [oldestPending,'reportingOldestPending',info.oldestPendingAt,info.oldestPendingId]
            ]) {
                line.hidden = !info.endpoint;
                line.textContent = [t(label), Number.isFinite(at) ? ThundyI18n.date(at) : t('auditUnavailable'), id].filter(Boolean).join(' · ');
            }
            explanation.textContent = [t(info.indicators?'reportingConsentIndicators':'reportingConsent'),
                info.details ? t('reportingConsentDetails') : '',info.detections ? t('reportingConsentDetections') : ''].filter(Boolean).join(' ');
            enrollment.hidden = !info.endpoint || !unlocked;
            revoke.hidden = !['ready','permission','storage'].includes(info.state);
            activate.disabled = revoke.disabled = sending;
        }
        async function refresh() {
            const latest = await command('status');
            render(latest.reporting,latest.unlocked);
        }
        async function change(task) {
            if (sending) return;
            sending=true;activate.disabled=revoke.disabled=true;result.textContent='';
            try {
                await task();
                consent.checked=false;
            } catch (_) { result.textContent=t('reportingSetupFailed'); }
            finally {
                credential.value='';sending=false;activate.disabled=revoke.disabled=false;
                await refresh().catch(() => {});
            }
        }
        enrollment.onsubmit = event => {
            event.preventDefault();
            const info = currentReporting;
            if (!info?.endpoint || !consent.checked) return;
            void change(async () => {
                if (!await requestIncidentPermissions(info)) throw Error('REPORTING_SETUP_INVALID');
                await command('enableReporting',{consent:true,details:info.details,detections:info.detections,endpoint:info.endpoint,credential:credential.value});
            });
        };
        revoke.onclick = () => change(() => command('disableReporting'));
        setInterval(() => {
            if (!sending && !document.hidden && currentReporting?.endpoint) void refresh().catch(() => {});
        },10000);
        return render;
    }
    async function mount(){
        if (ThundyI18n.ready) await ThundyI18n.ready;
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
        const help=document.createElement('p');help.textContent=t('securityPasswordHelp');form.append(help);
        const admin=field('securityAdminPassword'),adminConfirm=field('securityAdminConfirm'),approval=field('securityApprovalPassword'),approvalConfirm=field('securityApprovalConfirm');
        for(const input of [admin,adminConfirm,approval,approvalConfirm]){input.minLength=12;input.maxLength=1024;input.spellcheck=false;}
        const approvalState=document.createElement('p');approvalState.id='securityApprovalState';approvalState.setAttribute('role','status');form.append(approvalState);
        const threshold=field('securityThreshold','number');threshold.required=true;threshold.min='0';threshold.max='100';threshold.value='50';
        const enabled=field('securityEnablePolicy','checkbox');
        const unknown=field('securityUnknownApproval','checkbox');
        const linkSource = document.createElement('p');
        form.append(linkSource);
        const attachmentControls = [];
        const linkControls = [enabled,threshold,unknown];
        const auditControls = [];
        let waitForResults, autoOpenBelow, auditLimit, auditDays, auditSource, colorsSource;
        let attachmentMode, attachmentThreshold, attachmentUnknown, attachmentSource;
        if (location.pathname.endsWith('/options.html')) {
            const waitHelp = document.createElement('p');
            waitHelp.textContent = t('linkOpeningOptionsHelp');
            waitForResults = field('linkWaitForResults','checkbox');
            autoOpenBelow = field('linkAutoOpenBelow','number');
            autoOpenBelow.min = '1';autoOpenBelow.max = '100';
            linkControls.push(waitForResults,autoOpenBelow);
            form.append(waitHelp);

            const auditGroup = document.createElement('fieldset');
            const auditTitle = document.createElement('legend');
            auditTitle.textContent = t('linkAuditRetentionTitle');
            auditLimit = field('linkAuditLimit','number');
            auditDays = field('linkAuditDays','number');
            for (const input of [auditLimit,auditDays]) {
                input.min = '1';input.max = String(Number.MAX_SAFE_INTEGER);
                auditControls.push(input);
            }
            auditSource = document.createElement('p');
            auditGroup.append(auditTitle,auditLimit.parentElement,auditDays.parentElement,auditSource);
            colorsSource = document.createElement('p');
            colorsSource.hidden = true;
            form.append(auditGroup,colorsSource);
            const group = document.createElement('fieldset');
            const legend = document.createElement('legend');
            legend.textContent = t('attachmentProtectionTitle');
            const scope = document.createElement('p');
            scope.textContent = t('attachmentProtectionScope');
            group.append(legend,scope);
            const choices = (key,entries) => {
                const label = document.createElement('label'), select = document.createElement('select');
                label.textContent = t(key);
                select.dataset.security = key;
                for (const [value,message] of entries) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = t(message);
                    select.append(option);
                }
                label.append(select);
                group.append(label);
                return select;
            };
            attachmentMode = choices('attachmentPolicyMode',[
                ['off','attachmentModeOff'],['warn','attachmentModeWarn'],
                ['approval','attachmentModeApproval'],['block','attachmentModeBlock']
            ]);
            attachmentThreshold = field('attachmentScoreThreshold','number');
            attachmentThreshold.required = true;
            attachmentThreshold.min = '0';
            attachmentThreshold.max = '100';
            attachmentThreshold.value = '70';
            group.append(attachmentThreshold.parentElement);
            attachmentUnknown = choices('attachmentUnknownSetting',[
                ['warn','attachmentModeWarn'],['block','attachmentModeBlock']
            ]);
            attachmentControls.push(attachmentMode,attachmentThreshold,attachmentUnknown);
            attachmentSource = document.createElement('p');
            group.append(attachmentSource);
            form.append(group);
        }
        const unlock=document.createElement('button');unlock.type='button';unlock.dataset.security='unlock';unlock.textContent=t('securityUnlock');form.append(unlock);
        const save=document.createElement('button');save.type='submit';save.textContent=t('securitySave');form.append(save);
        const lock=document.createElement('button');lock.type='button';lock.dataset.security='lock';lock.textContent=t('securityLock');form.append(lock);
        const disable=document.createElement('button');disable.type='button';disable.textContent=t('securityDisable');form.append(disable);
        const recoveryGroup=document.createElement('details'),recoveryTitle=document.createElement('summary');recoveryTitle.textContent=t('securityRecover');recoveryGroup.append(recoveryTitle);panel.append(recoveryGroup);
        const recovery=field('securityRecovery'),recoveryAdmin=field('securityRecoveryPassword'),recoveryConfirm=field('securityAdminConfirm');
        recoveryAdmin.dataset.security='securityRecoveryPassword';recoveryConfirm.dataset.security='securityRecoveryConfirm';
        for(const input of [recovery,recoveryAdmin,recoveryConfirm]){input.maxLength=1024;input.spellcheck=false;recoveryGroup.append(input.parentElement);}
        const recover=document.createElement('button');recover.type='button';recover.dataset.security='recover';recover.textContent=t('securityRecover');recoveryGroup.append(recover);
        const stop=document.createElement('button');stop.type='button';stop.textContent=t('securityStopTransfers');panel.append(stop);
        const output=document.createElement('p');output.id='securityRecoveryOutput';output.setAttribute('role','status');output.style.overflowWrap='anywhere';panel.append(output);
        const providers=document.createElement('details');providers.id='securityProviderOverview';const providerTitle=document.createElement('summary');providerTitle.textContent=t('analysisProviderSetup');providers.append(providerTitle);
        const providerKeys=[...Object.values(ThundyProviders.registry).map(config=>config.key),'providerConnectionTests'];
        let providerGeneration=0,disposed=false;
        const refreshProviders=async()=>{
        const own=++providerGeneration,configured=await browser.storage.local.get(providerKeys);if(disposed||own!==providerGeneration)return;
        for(const child of [...providers.children])if(child!==providerTitle)child.remove();
        for(const [id,config] of Object.entries(ThundyProviders.registry)) {
            const entry=document.createElement('section'),name=document.createElement('h2');name.textContent=config.name;entry.append(name);
            const p=document.createElement('p');p.textContent=t(configured[config.key]?'analysisProviderConfigured':'analysisProviderNoKey');entry.append(p);
            for(const [scope,tier] of Object.entries(config.capabilities)){const line=document.createElement('p');line.textContent=t('analysisData'+scope[0].toUpperCase()+scope.slice(1))+' · '+tier;entry.append(line);}
            const test=configured.providerConnectionTests?.[id];if(test){const result=document.createElement('p');const keys={valid:'testApiKeyValid',invalid_key:'testApiKeyInvalid',rate_limited:'testApiKeyRateLimited',permission_denied:'testApiKeyPermissionDenied',error:'testApiKeyError'};result.textContent=t(keys[test.status]||'testApiKeyError')+' · '+(Number.isFinite(test.observedAt)?new Date(test.observedAt).toLocaleString():'—')+' · HTTP '+(Number.isInteger(test.httpStatus)&&test.httpStatus>=100&&test.httpStatus<600?test.httpStatus:'—');entry.append(result);}
            providers.append(entry);
        }
        };
        await refreshProviders();
        const providerChanged=(changes,area)=>{if(area==='local'&&providerKeys.some(key=>changes[key]))refreshProviders().catch(()=>{});};
        browser.storage.onChanged?.addListener(providerChanged);
        panel.append(providers);
        document.body.prepend(panel);
        const renderReporting = location.pathname.endsWith('/options.html') ? mountReporting(panel) : () => {};
        // Appearance preferences have their own save operation: no key tests,
        // permission prompts, scan restart or consent changes accompany it.
        let view,showDetails,displaySave,debugControls=[],debugRefresh=async()=>{},debugHide=()=>{};
        if(location.pathname.endsWith('/options.html')){
            const section=document.createElement('section');section.className='security-controls';section.id='analysisDisplaySettings';
            const title=document.createElement('h2');title.id='analysisDisplayTitle';title.textContent=t('displaySettingsTitle');section.setAttribute('aria-labelledby',title.id);section.append(title);
            const note=document.createElement('p');note.textContent=t('displaySettingsHelp');section.append(note);
            const preferences=document.createElement('form');preferences.id='analysisDisplayForm';section.append(preferences);
            const viewLabel=document.createElement('label');viewLabel.textContent=t('displayDefaultView');view=document.createElement('select');view.id='analysisDefaultView';viewLabel.append(view);preferences.append(viewLabel);
            for(const [value,key] of [['simple','analysisSimple'],['expert','analysisExpert']]){const option=document.createElement('option');option.value=value;option.textContent=t(key);view.append(option);}
            const detailLabel=document.createElement('label');detailLabel.textContent=t('displayHybridDetails');showDetails=document.createElement('input');showDetails.type='checkbox';showDetails.id='analysisShowHybridDetails';detailLabel.prepend(showDetails);preferences.append(detailLabel);
            displaySave=document.createElement('button');displaySave.type='submit';displaySave.textContent=t('displaySave');preferences.append(displaySave);
            const status=document.createElement('p');status.id='analysisDisplayStatus';status.setAttribute('role','status');section.append(status);
            const saved=await browser.storage.local.get(['analysisDefaultView','analysisShowHybridDetails']);view.value=saved.analysisDefaultView==='expert'?'expert':'simple';showDetails.checked=saved.analysisShowHybridDetails!==false;
            preferences.onsubmit=async event=>{event.preventDefault();displaySave.disabled=view.disabled=showDetails.disabled=true;status.textContent='';try{await set({analysisDefaultView:view.value,analysisShowHybridDetails:showDetails.checked});status.textContent=t('displaySaved');}catch(e){status.textContent=t(e.code==='ADMIN_LOCKED'?'securityLocked':'securityError');await refresh();}finally{displaySave.disabled=view.disabled=showDetails.disabled=!current?.unlocked;}};
            const appearance=shell.querySelector('#appearance');if(appearance)appearance.after(section);else (shell.querySelector('main')||shell).prepend(section);

            const debug=document.createElement('section');debug.className='security-controls';debug.id='apiDebugSettings';
            const debugTitle=document.createElement('h2');debugTitle.id='apiDebugTitle';debugTitle.textContent=t('apiDebugTitle');debug.setAttribute('aria-labelledby',debugTitle.id);debug.append(debugTitle);
            const debugNote=document.createElement('p');debugNote.textContent=t('apiDebugHelp');debug.append(debugNote);
            const debugForm=document.createElement('form');debugForm.id='apiDebugForm';debug.append(debugForm);
            const debugLabel=document.createElement('label'),debugEnabled=document.createElement('input');debugEnabled.id='apiDebugEnabled';debugEnabled.type='checkbox';debugLabel.append(debugEnabled,document.createTextNode(t('apiDebugEnable')));debugForm.append(debugLabel);
            const debugSave=document.createElement('button');debugSave.type='submit';debugSave.textContent=t('apiDebugSave');debugForm.append(debugSave);
            const debugPreview=document.createElement('button'),debugExport=document.createElement('button'),debugClear=document.createElement('button');
            for(const [button,key,id] of [[debugPreview,'apiDebugPreview','apiDebugPreview'],[debugExport,'apiDebugExport','apiDebugExport'],[debugClear,'apiDebugClear','apiDebugClear']]){button.type='button';button.id=id;button.textContent=t(key);debug.append(button);}
            const openDebug=document.createElement('button');openDebug.type='button';openDebug.id='apiDebugOpen';openDebug.textContent=t('apiDebugOpen');openDebug.onclick=()=>browser.tabs.create({url:browser.runtime.getURL('api_debug.html')});debug.append(openDebug);
            const debugState=document.createElement('p');debugState.id='apiDebugStatus';debugState.setAttribute('role','status');debug.append(debugState);
            const debugContent=document.createElement('pre');debugContent.id='apiDebugContent';debugContent.tabIndex=0;debugContent.hidden=true;debugContent.setAttribute('aria-label',t('apiDebugPreview'));debugContent.style.cssText='max-height:24rem;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere';debug.append(debugContent);section.after(debug);
            debugControls=[debugEnabled,debugSave,debugPreview,debugExport,debugClear];let debugBusy=false;
            debugHide=()=>{debugContent.textContent='';debugContent.hidden=true;};
            debugRefresh=async()=>{if(!current?.unlocked){debugHide();return;}const result=await command('apiDebugStatus');debugEnabled.checked=result.enabled;};
            const debugRun=async task=>{
                if(debugBusy)return;debugBusy=true;debugControls.forEach(control=>control.disabled=true);debugState.textContent='';
                try{await task();}catch(error){debugHide();debugState.textContent=t(error.code==='ADMIN_LOCKED'?'securityLocked':'apiDebugFailed');}
                finally{debugBusy=false;await refresh();}
            };
            debugForm.onsubmit=event=>{event.preventDefault();debugRun(async()=>{await command('apiDebugSet',{enabled:debugEnabled.checked});debugHide();debugState.textContent=t('apiDebugSaved');});};
            debugPreview.onclick=()=>debugRun(async()=>{const result=await command('apiDebugReport');debugContent.textContent=JSON.stringify(result.report,null,2);debugContent.hidden=false;debugContent.focus();});
            debugExport.onclick=()=>debugRun(async()=>{const result=await command('apiDebugReport');let url;try{url=URL.createObjectURL(new Blob([JSON.stringify(result.report,null,2)],{type:'application/json'}));await browser.downloads.download({url,filename:'thundy-api-debug.json',saveAs:true});debugState.textContent=t('auditExported');}finally{if(url)URL.revokeObjectURL(url);}});
            debugClear.onclick=()=>debugRun(async()=>{await command('apiDebugClear');debugHide();debugState.textContent=t('apiDebugCleared');});
        }
        let current;
        const refresh=async()=>{
            try{current=await command('status');shell.hidden=hideShell&&!current.unlocked;
                state.textContent=t(current.protected?current.unlocked?'securityUnlocked':'securityLocked':'securityOptional');
                for(const input of [approval,adminConfirm,approvalConfirm,save,view,showDetails,displaySave,...linkControls,...auditControls,...debugControls,...attachmentControls])if(input)input.disabled=!current.unlocked;
                adminConfirm.parentElement.hidden=!current.unlocked;approvalConfirm.parentElement.hidden=!current.unlocked;
                admin.autocomplete=current.unlocked?'new-password':'current-password';admin.parentElement.firstChild.textContent=t(current.unlocked?'securityAdminPassword':'securityUnlockPassword');
                disable.hidden=!current.protected||!current.unlocked;lock.hidden=!current.protected||!current.unlocked;unlock.hidden=!current.protected||current.unlocked;recoveryGroup.hidden=!current.protected||current.unlocked;
                approvalState.textContent=t(current.approvalConfigured?'securityApprovalConfigured':'securityApprovalMissing');
                threshold.value=current.policy.threshold ?? '';enabled.checked=current.policy.enabled;unknown.checked=current.policy.unknown==='approval';
                const source = policy => policy.managed ? policy.invalid ? t('managedPolicyInvalid') :
                    [t('managedByCompany'),t('managedRevision')+' '+policy.revision,
                        t('managedThreshold')+' '+policy.threshold,t(policy.action==='block'?'attachmentModeBlock':'attachmentModeWarn'),
                        t('attachmentUnknownSetting')+' '+t(policy.unknown==='block'?'attachmentModeBlock':'attachmentModeWarn')].join(' · ') : t('managedLocal');
                linkSource.textContent=source(current.policy);
                if (current.policy.managed) for (const input of linkControls) input.disabled=true;
                if (waitForResults) {
                    waitForResults.checked = current.policy.waitForResults === true;
                    autoOpenBelow.value = current.policy.autoOpenBelow ?? '';
                    const audit = current.linkAudit || {maxRecords:2000,retentionDays:30};
                    auditLimit.value = audit.maxRecords ?? '';
                    auditDays.value = audit.retentionDays ?? '';
                    auditSource.textContent = t(audit.invalid ? 'managedPolicyInvalid' : audit.managed ? 'managedByCompany' : 'managedLocal');
                    for (const input of auditControls) input.disabled = audit.managed || !current.unlocked;
                    colorsSource.hidden = !current.severityColorsManaged;
                    colorsSource.textContent = t(current.severityColorsInvalid ? 'managedPolicyInvalid' : 'protectionManagedColors');
                }
                const clickProtection = document.getElementById('timeOfClickProtection');
                if (clickProtection && current.policy.managed) {
                    clickProtection.dataset.managed='true';clickProtection.checked=true;clickProtection.disabled=true;
                    clickProtection.title=t('managedByCompany');
                }
                if (attachmentMode) {
                    const policy = current.attachmentPolicy || {mode:'off',threshold:70,unknown:'warn'};
                    attachmentMode.value = policy.mode;
                    attachmentThreshold.value = policy.threshold ?? '';
                    attachmentUnknown.value = policy.unknown;
                    attachmentSource.textContent=source(policy);
                    if (policy.managed) for (const input of attachmentControls) input.disabled=true;
                }
                renderReporting(current.reporting,current.unlocked);
                await debugRefresh();
            }catch(_){shell.hidden=hideShell;debugHide();for(const input of [...linkControls,...auditControls,...debugControls,...attachmentControls])input.disabled=true;state.textContent=t('securityError');}
        };
        const run=async fn=>{if(busy)return;busy=true;output.textContent='';try{await fn();await refresh();}catch(e){output.textContent=t(e.code==='PASSWORD_WAIT'?'securityWait':['PASSWORD_LENGTH','PASSWORDS_DISTINCT'].includes(e.code)?'securityLength':e.code==='PASSWORD_CONFIRM'?'securityConfirmMismatch':'securityError');if(e.code==='ADMIN_LOCKED')await refresh();}finally{busy=false;for(const input of [admin,adminConfirm,approval,approvalConfirm,recovery,recoveryAdmin,recoveryConfirm])input.value='';}};
        const confirm=(password,repeated)=>{if(password!==repeated)throw Object.assign(Error('PASSWORD_CONFIRM'),{code:'PASSWORD_CONFIRM'});};
        unlock.onclick=()=>run(async()=>{token=(await command('unlock',{password:admin.value})).token;connect();});
        form.onsubmit=event=>{event.preventDefault();run(async()=>{confirm(admin.value,adminConfirm.value);confirm(approval.value,approvalConfirm.value);const result=await command('configure',{adminPassword:admin.value||undefined,approvalPassword:approval.value||undefined,
            ...(!current.policy.managed ? {policy:{enabled:enabled.checked,threshold:Number(threshold.value),unknown:unknown.checked?'approval':'warn',
                ...(waitForResults ? {waitForResults:waitForResults.checked,autoOpenBelow:autoOpenBelow.value === '' ? null : autoOpenBelow.valueAsNumber} : {})}} : {}),
            ...(auditLimit && !current.linkAudit?.managed ? {linkAudit:{maxRecords:auditLimit.value === '' ? null : auditLimit.valueAsNumber,
                retentionDays:auditDays.value === '' ? null : auditDays.valueAsNumber}} : {}),
            ...(attachmentMode && !current.attachmentPolicy?.managed ? {attachmentPolicy:{mode:attachmentMode.value,threshold:Number(attachmentThreshold.value),unknown:attachmentUnknown.value}} : {})
        });token=null;output.textContent=result.recovery?t('securityRecoverySave')+' '+result.recovery:t('securitySaved');});};
        lock.onclick=()=>run(async()=>{await command('lock');token=null;});
        disable.onclick=()=>run(async()=>{if(!window.confirm(t('securityDisableConfirm')))return;await command('disableAdmin');token=null;});
        recover.onclick=()=>run(async()=>{confirm(recoveryAdmin.value,recoveryConfirm.value);const result=await command('recover',{recovery:recovery.value,password:recoveryAdmin.value});token=null;output.textContent=t('securityRecoverySave')+' '+result.recovery;});
        stop.onclick=()=>run(async()=>{await set({externalAnalysisConsent:false});output.textContent=t('securityStopped');});
        let lastTouch=0;
        const activity=()=>{if(!token||Date.now()-lastTouch<15000)return;lastTouch=Date.now();command('touch').catch(()=>refresh());};
        document.addEventListener('pointerdown',activity);document.addEventListener('keydown',activity);
        timer=setInterval(async()=>{if(token){const status=await command('status').catch(()=>null);if(!status?.unlocked){token=null;await refresh();}}},15000);
        window.addEventListener('pagehide',()=>{disposed=true;providerGeneration++;browser.storage.onChanged?.removeListener?.(providerChanged);clearInterval(timer);if(token)command('lock').catch(()=>{});token=null;},{once:true});
        await refresh();
    }
    let port;
    function connect(){try{port?.disconnect();port=browser.runtime.connect({name:'thundy-admin-session'});port.postMessage({token});}catch(_){}}
    document.addEventListener('DOMContentLoaded',mount);
    return {send,set,storage,command};
})();
