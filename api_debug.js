/* Dedicated, read-only diagnostic viewer. Never loads provider clients. */
(() => {
    const t=key=>ThundyI18n.get(key),get=id=>document.getElementById(id);
    let token=null,unlocked=false,enabled=false,paused=false,busy=false,disposed=false,generation=0,report=null,selected=Number(location.hash.match(/^#run=(\d+)$/)?.[1])||null,lastTouch=0,port,timer,renderedRun=null;
    const send=async(op,values={})=>{const result=await browser.runtime.sendMessage({action:'securityCommand',op,token,...values});if(!result?.success)throw Error(result?.code||'DIAGNOSTIC_FAILED');return result;};
    function wipe(){generation++;report=null;get('diagRuns').replaceChildren();get('diagContent').replaceChildren();get('diagSummary').textContent='';}
    function controls(){get('diagView').hidden=!unlocked;get('diagAuth').hidden=unlocked;get('diagLock').hidden=!token;for(const id of ['diagPause','diagExport','diagClear'])get(id).disabled=!unlocked||!enabled;}
    function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
    const date=value=>Number.isFinite(value)?new Date(value).toLocaleString():t('auditUnavailable');
    const label=(type,value)=>t('diag_'+type+'_'+value);
    function section(key,content){const details=node('details'),summary=node('summary',t(key));details.append(summary,content);get('diagContent').append(details);}
    function render(){
        if(!report||!unlocked)return;
        for(const [id,name] of Object.entries(report.providers||{}))if(![...get('diagProvider').options].some(option=>option.value===id)){const option=node('option',name);option.value=id;get('diagProvider').append(option);}
        const list=get('diagRuns'),focus=list.contains(document.activeElement)?document.activeElement?.dataset.run:null;
        const runs=(report.runs||[]).filter(run=>{
            const operations=[...(report.entries||[]),...(report.pending||[])].filter(op=>op.runId===run.id),provider=get('diagProvider').value;
            const from=Date.parse(get('diagFrom').value),to=Date.parse(get('diagTo').value);
            return (!provider||run.events.some(e=>e.provider===provider)||operations.some(op=>op.request.provider===provider))&&(!get('diagState').value||run.state===get('diagState').value)&&(!get('diagPurpose').value||run.purpose===get('diagPurpose').value)&&(!Number.isFinite(from)||run.startedAt>=from)&&(!Number.isFinite(to)||run.startedAt<=to);
        }).sort((a,b)=>b.startedAt-a.startedAt);
        if(!runs.some(run=>run.id===selected))selected=runs[0]?.id||null;
        list.replaceChildren();for(const run of runs){const li=node('li'),button=node('button','#'+run.id+' · '+label('purpose',run.purpose)+' · '+label('state',run.state)+' · '+date(run.startedAt));button.type='button';button.dataset.run=run.id;button.setAttribute('aria-pressed',String(run.id===selected));button.onclick=()=>{selected=run.id;render();};li.append(button);list.append(li);}
        if(focus)list.querySelector('[data-run="'+focus+'"]')?.focus();
        get('diagSummary').textContent=t('diagRuns')+': '+runs.length+' · '+t('diagDropped')+': '+(report.dropped||0);
        const content=get('diagContent'),same=renderedRun===selected,open=same?[...content.querySelectorAll('details')].map(d=>d.open):[],detailFocus=same?[...content.querySelectorAll('summary')].indexOf(document.activeElement):-1,scroll=same?content.scrollTop:0;content.replaceChildren();const run=runs.find(r=>r.id===selected);renderedRun=selected;
        if(!run){content.append(node('p',t(enabled?'diagEmpty':'diagOff')));return;}
        content.append(node('p',label('purpose',run.purpose)+' · '+label('state',run.state)+' · '+date(run.startedAt)));
        const events=node('ol');for(const event of run.events){const li=node('li',date(event.at)+' · '+label('phase',event.phase));const metadata={...event};delete metadata.at;delete metadata.phase;li.append(node('pre',JSON.stringify(metadata,null,2)));events.append(li);}
        if(!run.events.length)events.append(node('li',t('diagNotCaptured')));section('diagTimeline',events);
        const operations=[...(report.entries||[]),...(report.pending||[])].filter(op=>op.runId===run.id);
        if(!operations.length)content.append(node('p',t('diagNoHttp')));
        for(const op of operations){const details=node('details');details.append(node('summary','#'+op.id+' · '+op.request.provider+' · '+op.request.method+' '+op.request.endpoint));
            for(const [key,data] of [['diagRequest',op.request],['diagResponse',op.attempts?{networkStarted:op.networkStarted,localBackoff:op.localBackoff,attempts:op.attempts,bodyState:op.bodyState,response:op.response,responseTruncated:op.responseTruncated,reason:op.reason,errorCode:op.errorCode,durationMs:op.durationMs}:{completion:op.completion}]]){details.append(node('h3',t(key)),node('pre',JSON.stringify(data,null,2)));}content.append(details);}
        if(run.truncated)content.append(node('p',t('diagTruncated')));
        const phases=new Set(run.events.map(e=>e.phase)),missing=['precondition','cache','assessment','persistence'].filter(phase=>!phases.has(phase));if(missing.length)content.append(node('p',t('diagNotCaptured')+': '+missing.map(phase=>label('phase',phase)).join(', ')));
        [...content.querySelectorAll('details')].forEach((d,i)=>d.open=open[i]===true);if(detailFocus>=0)content.querySelectorAll('summary')[detailFocus]?.focus({preventScroll:true});content.scrollTop=scroll;
    }
    async function refresh(){
        if(busy||disposed)return;busy=true;const own=generation;
        try{
            const status=await send('status');if(own!==generation||disposed)return;unlocked=status.unlocked;
            if(!unlocked){token=null;wipe();controls();get('diagStatus').textContent=t('securityLocked');return;}
            const state=await send('apiDebugStatus');if(own!==generation||disposed)return;enabled=state.enabled;
            if(!enabled){wipe();controls();get('diagStatus').textContent=t('diagOff');return;}
            if(!paused){const result=await send('apiDebugReport');if(own!==generation||disposed)return;report=result.report;render();}
            controls();get('diagStatus').textContent=t(paused?'diagPaused':'diagActive');
        }catch(_){if(own===generation&&!disposed){token=null;unlocked=false;wipe();controls();get('diagStatus').textContent=t('securityLocked');}}finally{busy=false;}
    }
    document.addEventListener('DOMContentLoaded',()=>{
        for(const [id,values,type] of [['diagProvider',['hybridanalysis','virustotal','urlscan','urlhaus','abuseipdb'],'provider'],['diagState',['running','complete','pending','blocked','incomplete','failed','unconfirmed'],'state'],['diagPurpose',['automatic','manual','link','key_test','report','analysis'],'purpose']])for(const value of values){const option=node('option',type==='provider'?({hybridanalysis:'Hybrid Analysis',virustotal:'VirusTotal',urlscan:'urlscan.io',urlhaus:'URLhaus',abuseipdb:'AbuseIPDB'})[value]:label(type,value));option.value=value;get(id).append(option);}
        get('diagAuth').onsubmit=async event=>{event.preventDefault();const own=++generation;try{const value=await send('unlock',{password:get('diagPassword').value});if(own!==generation||disposed)return;token=value.token;port?.disconnect();port=browser.runtime.connect({name:'thundy-admin-session'});port.postMessage({token});await refresh();}catch(_){get('diagStatus').textContent=t('securityLocked');}finally{get('diagPassword').value='';}};
        get('diagLock').onclick=async()=>{const old=token;token=null;unlocked=false;wipe();controls();await browser.runtime.sendMessage({action:'securityCommand',op:'lock',token:old});};
        get('diagPause').onclick=()=>{paused=!paused;generation++;get('diagPause').textContent=t(paused?'diagResume':'diagPause');refresh();};
        get('diagFilters').onsubmit=e=>e.preventDefault();get('diagFilters').oninput=()=>render();
        get('diagReset').onclick=()=>{get('diagFilters').reset();selected=null;render();};
        get('diagClear').onclick=async()=>{wipe();try{await send('apiDebugClear');}catch(_){unlocked=false;token=null;}controls();await refresh();};
        get('diagExport').onclick=async()=>{const own=generation;let url;try{const result=await send('apiDebugReport');if(own!==generation||!unlocked||disposed)return;url=URL.createObjectURL(new Blob([JSON.stringify(result.report,null,2)],{type:'application/json'}));await browser.downloads.download({url,filename:'thundy-api-debug-v2.json',saveAs:true});}catch(_){wipe();get('diagStatus').textContent=t('apiDebugFailed');}finally{if(url)URL.revokeObjectURL(url);}};
        const touch=()=>{if(token&&Date.now()-lastTouch>=15000){lastTouch=Date.now();send('touch').catch(()=>refresh());}};
        document.addEventListener('pointerdown',touch);document.addEventListener('keydown',touch);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
        browser.runtime.onMessage.addListener((message,sender)=>{if(message?.action==='apiDebugReset'&&sender?.id===browser.runtime.id){wipe();refresh();}});
        browser.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.thundySecurityV1?.newValue?.apiDebugEnabled!==true&&changes.thundySecurityV1){enabled=false;wipe();controls();get('diagStatus').textContent=t('diagOff');}});
        timer=setInterval(()=>{if(!document.hidden)refresh();},1000);refresh();
        window.addEventListener('pagehide',()=>{disposed=true;wipe();clearInterval(timer);port?.disconnect();token=null;},{once:true});
    });
})();
