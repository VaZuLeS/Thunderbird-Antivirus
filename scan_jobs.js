/* Shared background coordinator. No popup owns network work or polling timers. */
function createScanCoordinator(env) {
    const jobs=new Map();let queue=Promise.resolve(),generation=0;
    const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
    const active=job=>jobs.get(job.messageId)===job&&!job.controller.signal.aborted&&job.generation===generation&&env.now()<job.deadline&&(!env.valid||env.valid(job));
    const assert=job=>{if(!active(job))throw Object.assign(Error('SCAN_CANCELLED'),{code:'SCAN_CANCELLED'});};
    const snapshot=job=>job?{schemaVersion:1,id:job.id,state:job.state,completed:job.completed,total:job.total,startedAt:job.startedAt,finishedAt:job.finishedAt||null,providers:job.providers,pending:job.pending||false,errors:job.errors||0,revision:job.revision}:null;
    async function start(input,options={}) {
        return serial(async()=>{
            const requestedAt=env.now();
            let preparationTimer;
            const prepared=await Promise.race([env.prepare(input,options),new Promise((resolve,reject)=>{preparationTimer=env.setTimeout(()=>reject(Error('SCAN_PREPARATION_TIMEOUT')),300000);})]).finally(()=>env.clearTimeout(preparationTimer));
            if(env.now()-requestedAt>=300000)throw Error('SCAN_PREPARATION_TIMEOUT');
            const previous=jobs.get(input.id);
            if(previous&&previous.fingerprint===prepared.fingerprint&&!previous.controller.signal.aborted&&(!env.valid||env.valid(previous))&&(previous.state==='running'||previous.state==='queued'||!options.manual&&!options.refresh&&previous.state==='completed'&&env.now()-(previous.finishedAt||0)<900000))return {...snapshot(previous),attached:true};
            if(previous)previous.controller.abort();
            const job={id:env.uuid(),messageId:input.id,revision:env.uuid(),fingerprint:prepared.fingerprint,prepared,options,generation,controller:new AbortController(),startedAt:env.now(),deadline:requestedAt+300000,state:'queued',completed:0,total:0,providers:prepared.providers,errors:0,pending:false};
            jobs.set(input.id,job);
            if(!options.manual&&!options.refresh&&prepared.reusable){Object.assign(job,prepared.reusable,{id:job.id,revision:job.revision});await env.changed(job,snapshot(job));return snapshot(job);}
            while(jobs.size>200){const entry=[...jobs].find(([,j])=>!['queued','running'].includes(j.state));if(!entry)break;jobs.delete(entry[0]);}
            await env.changed(job,snapshot(job));
            job.done=(async()=>{
                const timer=env.setTimeout(()=>{if(jobs.get(input.id)!==job)return;job.controller.abort();job.state='incomplete';job.finishedAt=env.now();env.changed(job,snapshot(job)).catch(()=>{});},Math.max(0,job.deadline-env.now()));
                try {
                    await env.begin(job);assert(job);job.state='running';await env.changed(job,snapshot(job));
                    await env.run(job,assert,async()=>{if(active(job))await env.changed(job,snapshot(job));});assert(job);
                    job.state=job.pending?'pending':job.errors||Object.values(job.providers).some(p=>p.state==='failed')?'incomplete':job.total?'completed':'blocked';
                }catch(error){if(jobs.get(input.id)===job&&job.generation===generation)job.state=job.controller.signal.aborted?'incomplete':'failed';}
                finally {env.clearTimeout(timer);job.finishedAt=env.now();if(jobs.get(input.id)===job&&job.generation===generation)await env.changed(job,snapshot(job)).catch(()=>{});}
            })();
            return snapshot(job);
        });
    }
    function invalidate(options={}){generation++;for(const job of jobs.values()){job.controller.abort();if(['running','queued'].includes(job.state)){job.state='incomplete';job.finishedAt=env.now();if(!options.silent)env.changed(job,snapshot(job)).catch(()=>{});}}if(options.clear)jobs.clear();}
    return {start,invalidate,current:job=>jobs.get(job.messageId)===job,get:id=>snapshot(jobs.get(id)),revision:id=>jobs.get(id)?.revision||null,active,assert,settled:id=>jobs.get(id)?.done};
}

const ThundyScans=(()=>{
    const keys=['scanMode','alwaysManual','autoScanLinks','externalAnalysisConsent','privacyTier','scanningEnabledSenders','ipReputationProvider','ipReputationApiKey',...Object.values(ThundyProviders.registry).map(p=>p.key)];
    const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('');
    function mode(settings){return ['allDisplayed','approvedSenders','manual'].includes(settings.scanMode)?settings.scanMode:settings.alwaysManual===true?'manual':'approvedSenders';}
    function commonReason(settings,message,manual){if(settings.externalAnalysisConsent!==true)return 'disabled';if(!manual&&mode(settings)==='manual')return 'manual';if(!manual&&mode(settings)==='approvedSenders'&&!(settings.scanningEnabledSenders||[]).includes(extractEmailAddress(message.author||'').toLowerCase()))return 'sender';return null;}
    async function plan(settings,message,attachments,urls,manual=false,full={}){
        const providers={};const gate=commonReason(settings,message,manual);
        for(const [id,config] of Object.entries(ThundyProviders.registry)){
            const ip=settings.ipReputationProvider===id&&!!settings.ipReputationApiKey&&!!config.capabilities.ip;
            const configured=!!settings[config.key]&&(id!=='abuseipdb'||ip)||ip;
            const permission=configured?await hasHostPermissionFor(config.origin):false;
            const checks=[];
            const add=(kind,eligible,tier='strict')=>{const order={strict:0,balanced:1,max:2};checks.push({kind,reason:!configured?'unconfigured':gate||!permission&&'permission'||!eligible&&'no_resources'||(order[settings.privacyTier]??0)<order[tier]&&'policy'||kind==='url'&&!manual&&!settings.autoScanLinks&&'links_disabled'||null});};
            for(const [kind,supported] of Object.entries(config.scanKinds||{}))if(supported)add(kind,kind==='hash'?!!settings[config.key]&&attachments.length>0:kind==='ip'?ip&&extractPublicIPs(full.headers?.received||[]).length>0:urls.length>0,kind==='url'?'max':'strict');
            if(config.capabilities.ip&&ip&&!checks.some(c=>c.kind==='ip'))add('ip',extractPublicIPs(full.headers?.received||[]).length>0);
            providers[id]={configured,checks,state:'not_started'};
        }
        return providers;
    }
    function bound(job,ctx){return {signal:job.controller.signal,guard:()=>coordinator.assert(job),event:event=>{if(coordinator.active(job)){if(event.phase==='finish'&&event.state==='failed'&&job.providers[event.provider]){job.providers[event.provider].state='failed';job.providers[event.provider].error=event.httpStatus===429?'rate_limited':'provider_error';}ctx?.event?.(event);job.prepared.context.schedule();}},cached:(...args)=>{if(coordinator.active(job))ctx?.cached?.(...args);}};}
    async function record(job,edit,terminal=false){if(!terminal)coordinator.assert(job);await updateStore(await getSharedDB(),'hybridanalysis',job.prepared.key,old=>{if(!terminal)coordinator.assert(job);else if(!coordinator.current(job)||job.prepared.context.disposed)throw Error('SCAN_CANCELLED');const value=edit(old||{messageHeader:job.prepared.key});value.updatedAt=Date.now();return value;},{preserveReports:true});if(!terminal)coordinator.assert(job);}
    async function attachment(job,item,patch){await record(job,old=>{const values=[...(old.attachments||[])];let index=values.findIndex(a=>a.partName===item.partName);const digest=job.prepared.hashes[item.partName];let previous=index<0?{}:values[index];if(previous.hybrid_sha256!==digest)previous={};const value={...previous,partName:item.partName,attachment_name:item.name,hybrid_sha256:digest,created:previous.created||new Date().toISOString(),...patch};if(index<0)values.push(value);else values[index]=value;return {...old,attachments:values};});}
    async function link(job,url,patch){await record(job,old=>{const values=[...(old.links||[])];const index=values.findIndex(l=>l.url===url);const value={...(index<0?{}:values[index]),url,created:index<0?new Date().toISOString():values[index].created,...patch};if(index<0)values.push(value);else values[index]=value;return {...old,links:values};});}
    function pending(job,resource,value){job.pendingResources ||= new Set();if(value)job.pendingResources.add(resource);else job.pendingResources.delete(resource);job.pending=job.pendingResources.size>0;}
    async function hybridReport(job,item,ctx,save){
        if(extractHybridVerdictFromOverview(item.report)){await save({state:'KNOWN'});return false;}
        const until=Math.min(job.deadline,Date.now()+30000);const current=item;
        while(Date.now()<until){
            coordinator.assert(job);const sha=current.hybrid_sha256,id=current.hybrid_submission_id||current.hybrid_job_id;
            const validId=/^[A-Za-z0-9_-]{1,128}$/.test(id||'')&&!['N/A','MANUAL_CHECK','PENDING_UPLOAD'].includes(id);
            if(!/^[a-f0-9]{64}$/i.test(sha||'')&&!validId)throw Error('no_result');
            let url=/^[a-f0-9]{64}$/i.test(sha||'')?'https://hybrid-analysis.com/api/v2/overview/'+sha:'https://hybrid-analysis.com/api/v2/quick-scan/'+encodeURIComponent(id);
            let response=await apiGateway.fetchWithTimeout(url,{...getHybridAnalysisOptions('GET'),analysisContext:ctx});
            if(response.status===404&&validId)response=await apiGateway.fetchWithTimeout('https://hybrid-analysis.com/api/v2/quick-scan/'+encodeURIComponent(id),{...getHybridAnalysisOptions('GET'),analysisContext:ctx});
            coordinator.assert(job);
            if([401,403,429].includes(response.status))throw Object.assign(Error(response.status===429?'rate_limited':'invalid_key'),{code:response.status===429?'rate_limited':'invalid_key'});
            if(response.status===200){const data=await response.json();const report=quickScanReport(data)||data;await save({report,report_fetched_at:new Date().toISOString(),state:extractHybridVerdictFromOverview(report)?'KNOWN':'UPLOADED'});if(extractHybridVerdictFromOverview(report))return false;}
            else if(response.status!==404)throw Error('provider_error');
            await apiGateway.pause(Math.min(2000,Math.max(0,until-Date.now())),job.controller.signal);
        }
        return true;
    }
    async function tasks(job){
        const p=job.prepared,list=[],s=p.settings;
        const add=(provider,kind,run)=>{if(p.providers[provider]?.checks.some(c=>c.kind===kind&&!c.reason))list.push({provider,kind,run});};
        for(const item of p.attachments){
            const digest=p.hashes[item.partName];if(!digest)continue;
            if(ThundyProviders.registry.virustotal)add('virustotal','hash',async()=>{const ctx=bound(job,p.context.forAttachment(item.partName,item.name,digest));const stats=await checkVirusTotal(digest,s.virustotalApikey,ctx);coordinator.assert(job);if(!stats)throw Error('no_result');await attachment(job,item,{virustotal_stats:stats});});
            if(ThundyProviders.registry.hybridanalysis)add('hybridanalysis','hash',async()=>{
                const ctx=bound(job,p.context.forAttachment(item.partName,item.name,digest));const stored=p.record?.attachments?.find(a=>a.partName===item.partName&&a.hybrid_sha256===digest);
                const save=patch=>attachment(job,item,patch);
                if((job.options.refresh||stored?.state==='UPLOADED')&&stored){const ref='ha:attachment:'+item.partName;pending(job,ref,true);pending(job,ref,await hybridReport(job,stored,ctx,save));return;}
                const file=await browser.messages.getAttachmentFile(p.message.id,item.partName);
                const result=await check_hybrid_analysis_for_attachment(digest,item,file.slice(),null,file.type,ctx);coordinator.assert(job);
                const h=result.hybrid_data;
                await save({hybrid_submission_id:h.submission_id,hybrid_job_id:h.job_id,state:h.state,report:result.report||null,report_fetched_at:result.report?new Date().toISOString():null});
                if(h.state==='UPLOADED'||h.state==='KNOWN'&&!extractHybridVerdictFromOverview(result.report)){const ref='ha:attachment:'+item.partName;pending(job,ref,true);pending(job,ref,await hybridReport(job,{hybrid_sha256:digest,hybrid_submission_id:h.submission_id,hybrid_job_id:h.job_id},ctx,save));}
            });
        }
        for(const url of p.urls){
            if(ThundyProviders.registry.hybridanalysis)add('hybridanalysis','url',async()=>{
                const ctx=bound(job,await p.context.forLinks([url]));const previous=p.record?.links?.find(l=>l.url===url);const save=patch=>link(job,url,patch);
                if((job.options.refresh||previous?.state==='UPLOADED')&&previous){const ref='ha:url:'+url;pending(job,ref,true);pending(job,ref,await hybridReport(job,previous,ctx,save));return;}
                const body=new URLSearchParams({scan_type:'all',url});const response=await apiGateway.fetchWithTimeout('https://hybrid-analysis.com/api/v2/quick-scan/url',{...getHybridAnalysisOptions('POST',body,true),analysisContext:ctx});coordinator.assert(job);
                if(![200,201].includes(response.status))throw Object.assign(Error('provider_error'),{code:response.status===429?'rate_limited':response.status===401||response.status===403?'invalid_key':'provider_error'});
                const data=await response.json(),value={state:'UPLOADED',hybrid_sha256:data.sha256,hybrid_submission_id:data.submission_id||data.id,hybrid_job_id:data.job_id||data.id,report:quickScanReport(data)};
                await save(value);const ref='ha:url:'+url;pending(job,ref,true);pending(job,ref,await hybridReport(job,value,ctx,save));
            });
            if(ThundyProviders.registry.urlscan)add('urlscan','url',async()=>{
                const ctx=bound(job,await p.context.forLinks([url]));const previous=p.record?.links?.find(l=>l.url===url)?.urlscan;
                let result,submittedUuid;const ref='urlscan:'+url;
                if(previous?.uuid&&(job.options.refresh||['TIMEOUT','SUBMITTED','ERROR'].includes(previous.status))){pending(job,ref,true);result={...await pollUrlscanIoResult(previous.uuid,s.urlscanApikey,ctx),uuid:previous.uuid};}
                else{
                    if(job.options.refresh)return;
                    ctx.submitted=async uuid=>{coordinator.assert(job);submittedUuid=uuid;pending(job,ref,true);await link(job,url,{urlscan:{status:'SUBMITTED',uuid,observedAt:Date.now()}});};
                    result=await checkUrlscanIo(url,s.urlscanApikey,ctx);
                }
                coordinator.assert(job);if(!result)throw Error('no_result');
                if(submittedUuid&&!result.uuid)result={...result,uuid:submittedUuid};
                await link(job,url,{urlscan:{...result,observedAt:Date.now()}});
                pending(job,ref,!!result.uuid&&['TIMEOUT','SUBMITTED','ERROR'].includes(result.status));
                if(result.status==='ERROR')throw Object.assign(Error(result.errorCode||'provider_error'),{code:result.errorCode||'provider_error'});
            });
        }
        const domains=new Set(p.urls.map(url=>new URL(url).hostname));
        for(const domain of domains)if(ThundyProviders.registry.urlhaus)add('urlhaus','domain',async()=>{const ctx=bound(job,await p.context.forLinks(p.urls.filter(url=>new URL(url).hostname===domain)));const value=await checkURLhaus(domain,s.urlhausApikey,ctx);if(value===null)throw Error('no_result');if(value)job.domains.push(domain);});
        if(s.ipReputationProvider&&ThundyProviders.registry[s.ipReputationProvider])add(s.ipReputationProvider,'ip',async()=>{job.ips=await checkIPReputation(p.full.headers?.received||[],bound(job,p.context));});
        return list;
    }
    const lanes=new Map();
    async function lane(provider,fn){if(provider!=='urlscan')return fn();const old=lanes.get(provider)||Promise.resolve();const next=old.catch(()=>{}).then(fn);lanes.set(provider,next);try{return await next;}finally{if(lanes.get(provider)===next)lanes.delete(provider);}}
    const coordinator=createScanCoordinator({valid:job=>!job.prepared.context.disposed,now:()=>Date.now(),uuid:()=>crypto.randomUUID(),setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id),
        async prepare(message,options){
            if(typeof settingsReady!=='undefined')await settingsReady;await loadSettings();const settings=await browser.storage.local.get(keys);
            const full=options.full||await readFullForAnalysis(message);const attachments=(options.attachments||await browser.messages.listAttachments(message.id)).slice(0,100);
            const urls=[...new Set(filterUrls(extractUrls(extractTextFromParts(full.parts||full))))].slice(0,100);
            const key=resolveMessageStorageKey(message);const context=await getMessageAnalysisContext(message,options.tabId,{fullMessage:full,attachments});
            const preparationDeadline=Date.now()+300000;
            const hashes={};for(const item of attachments){if(Date.now()>preparationDeadline)throw Error('SCAN_PREPARATION_TIMEOUT');if(item.size>25*1024*1024)continue;try{const file=await browser.messages.getAttachmentFile(message.id,item.partName);hashes[item.partName]=await get_sha256_hash(await file.arrayBuffer());context.forAttachment(item.partName,item.name,hashes[item.partName]);}catch(_){}}
            const record=await getFromStore(await getSharedDB(),'hybridanalysis',key);
            const providers=await plan(settings,message,attachments,urls,options.manual,full);
            const fingerprint=await hash({messageId:message.id,full,hashes,settings:Object.fromEntries(Object.entries(settings).sort(([a],[b])=>a.localeCompare(b))),providers});
            const meta=record?.scanJobMeta, same=meta?.fingerprint===fingerprint;
            const pending=record?.links?.some(l=>urls.includes(l.url)&&(l.state==='UPLOADED'||l.urlscan?.uuid&&['SUBMITTED','TIMEOUT','ERROR'].includes(l.urlscan.status)))||record?.attachments?.some(a=>hashes[a.partName]===a.hybrid_sha256&&a.state==='UPLOADED');
            const reusable=same&&meta.state==='completed'&&Date.now()-meta.finishedAt<900000?{...meta,providers,pending:false}:!options.manual&&pending&&!Object.values(providers).some(p=>p.checks.some(c=>!c.reason))?{state:'pending',providers,pending:true,finishedAt:Date.now(),total:meta?.total||0,completed:meta?.completed||0}:null;
            return {reusable,message:{...message,headerMessageId:key},settings,full,attachments,urls,key,context,hashes,record,fingerprint,providers};
        },
        async begin(job){const p=job.prepared;if(!Object.values(p.providers).some(v=>v.checks.some(c=>!c.reason)))return;
            await p.context.flush();
            if(p.context.model.data.rows.length)await record(job,old=>{const snapshots={...old.analysisSourceSnapshots};if(Object.keys(snapshots).length>=64)throw Error('SOURCE_CAPACITY');snapshots[crypto.randomUUID()]={savedAt:Date.now(),snapshot:JSON.parse(JSON.stringify(p.context.model.data))};if(new TextEncoder().encode(JSON.stringify(snapshots)).length>1024*1024)throw Error('SOURCE_CAPACITY');return {...old,analysisSourceSnapshots:snapshots};});
            p.context.model.data.rows=[];p.context.scanRunId=job.id;
        },
        async run(job,assert,changed){
            const p=job.prepared;job.domains=[];job.ips=[];
            if(job.options.manual&&!job.options.refresh){vtCache.clear();urlhausCache.clear();ipReputationCache.clear();}
            await indexedDB_save_links_to_db(p.message,p.urls);assert(job);
            const work=await tasks(job);job.total=work.length;await changed();let index=0;
            await Promise.all(Array.from({length:Math.min(4,work.length)},async()=>{while(index<work.length){assert(job);const task=work[index++];await lane(task.provider,async()=>{assert(job);const state=job.providers[task.provider];state.state='running';await changed();try{await task.run();assert(job);if(state.state!=='failed')state.state='checked';}catch(error){assert(job);job.errors++;state.state='failed';state.error=['rate_limited','invalid_key','no_result'].includes(error.code||error.message)?error.code||error.message:'provider_error';}finally{if(coordinator.active(job)){job.completed++;await changed();}}});}}));
            assert(job);
            if(job.domains.length||job.ips.length)await record(job,old=>({...old,threatIntel:{urlhausDomains:job.domains,maliciousIps:job.ips,observedAt:Date.now()},threatIntelBinding:{runtimeId:getAnalysisRuntimeId(),messageId:p.message.id}}));
            assert(job);
            const text=extractTextFromParts(p.full.parts||p.full),risk=await collectThreatEvaluationOptions({message:p.message,fullMessage:p.full,filteredUrls:p.urls,messageText:text,allowExternal:false});
            risk.urlhausDomains=job.domains;risk.maliciousIps=job.ips;const threat=calculateThreatScore(p.message.author,p.urls,risk);threat.coverage=localContentCoverage(p.full);recordLocalCoverage(p.context,threat.coverage,threat);
            assert(job);for(const tab of p.context.tabs){assert(job);const current=await getFirstDisplayedMessage(tab);if(current?.id===p.message.id)await injectThreatBanner(tab,threat);}
        },
        async changed(job,summary){if(!coordinator.current(job))return;const p=job.prepared;p.context.scanJob={...summary,migration:!p.settings.scanMode,manualAllowed:p.settings.externalAnalysisConsent===true};
            if(!p.context.disposed){p.context.schedule();await record(job,old=>({...old,scanJobMeta:{...summary,fingerprint:job.fingerprint}}),!['queued','running'].includes(summary.state)).catch(()=>{});}
        }
    });
    async function display(tab,message){
        if(typeof settingsReady!=='undefined')await settingsReady;
        const full=await readFullForAnalysis(message),attachments=await browser.messages.listAttachments(message.id);
        await injectIntoMessageDisplay(tab.id,function(id){document.documentElement.dataset.thundyAnalysisMessage=String(id);},[message.id]);
        const context=await getMessageAnalysisContext(message,tab.id,{fullMessage:full,attachments});
        await processAttachments(message,false,false,context);const text=extractTextFromParts(full.parts||full),urls=filterUrls(extractUrls(text));await indexedDB_save_links_to_db(message,urls);
        await injectTimeOfClickProtection(tab.id,urls,message.id);
        await evaluateAndInjectThreats({tab,message,fullMessage:full,urls,filteredUrls:urls,messageText:text,allowExternal:false,analysisContext:context});
        await coordinator.start(message,{tabId:tab.id,full,attachments,manual:false});
    }
    async function request(request,sender){
        if(typeof settingsReady!=='undefined')await settingsReady;
        const tabId=sender.tab?.id??request.tabId??(await browser.tabs.query({active:true,currentWindow:true}))[0]?.id;
        const message=await getFirstDisplayedMessage(tabId,{throwOnError:true});if(!message||message.id!==request.messageId)throw Error('MESSAGE_CONTEXT_CHANGED');
        const context=await getMessageAnalysisContext(message,tabId);if(request.contextToken&&request.contextToken!==context.snapshotId)throw Error('MESSAGE_CONTEXT_CHANGED');
        if(!mayTransmitExternally())throw typedError(EXTERNAL_ANALYSIS_DISABLED,msg('bannerConsentMissing'));
        if(request.persist){if((await ThundySecurity.read()).admin)await ThundySecurity.authorized(sender,request.token);await addSenderOptIn(extractEmailAddress(message.author).toLowerCase());}
        return {success:true,...await coordinator.start(message,{tabId,manual:true,refresh:request.operation==='refresh'})};
    }
    let restartTimer=null;
    function reconfigure(){coordinator.invalidate();if(restartTimer)clearTimeout(restartTimer);restartTimer=setTimeout(async()=>{const seen=new Set();for(const tab of await browser.tabs.query({}).catch(()=>[])){try{const message=await getFirstDisplayedMessage(tab.id);if(message&&!seen.has(message.id)){seen.add(message.id);await display(tab,message);}}catch(_){}}},200);}
    return {...coordinator,reconfigure,display,request,mode,plan};
})();
