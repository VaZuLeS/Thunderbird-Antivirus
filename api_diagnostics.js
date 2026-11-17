/* Opt-in, profile-local API diagnostics. No raw bodies, URLs or credentials retained. */
const ThundyApiDiagnostics = (() => {
    const MAX_ENTRIES=100, MAX_BYTES=1048576, MAX_AGE=3600000;
    const entries=[], pending=new Map(), references=new Map(), runs=new Map();
    let contexts=new WeakMap();
    let epoch=0, sequence=0, dropped=0, expiryTimer=null, referenceNamespace=null;
    const central=()=>typeof ThundySecurity!=='undefined';
    const providers=(typeof ThundyProviders!=='undefined'?Object.keys(ThundyProviders.registry):['hybridanalysis','urlscan','virustotal','urlhaus','abuseipdb']);
    const fields=new Set(('id uuid sha256 sha1 md5 submission_id job_id submission_type state status verdict finished progress positives total percent threat_score threat_level multiscan_result whitelisted whitelist scanners scanners_v2 reports anti_virus_results assessment verdicts overall urlscan engines malicious maliciousTotal suspicious score error errors code message detail description retry_after visibility query_status data attributes stats harmless undetected timeout type count quota limit remaining reset resource url file scan_type environment_id result api search results submitted').split(' '));
    const enums=new Set([...('MALICIOUS MALICIOUS_VISUAL SUSPICIOUS CLEAN HARMLESS WHITELISTED NO-THREAT NO_THREAT UNKNOWN NO-CLASSIFICATION ERROR FAILED FAILURE SUCCESS COMPLETE COMPLETED FINISHED DONE IN_PROGRESS IN_QUEUE IN-PROGRESS IN-QUEUE PENDING RUNNING QUEUED SUBMITTED PUBLIC PRIVATE UNLISTED PAGE_URL FILE URL ALL INVALID_KEY INVALID_API_KEY UNAUTHORIZED FORBIDDEN NOT_FOUND RATE_LIMITED VALIDATIONERROR OK NO_RESULTS').split(' '),'NO SPECIFIC THREAT','NO THREAT']);
    const reasons=['success','invalid_json','timeout_or_cancelled','network_error','policy_blocked','resource_mismatch','authentication','permission','rate_limited','not_found','gone','invalid_request','server_error','unknown'];
    const errorCodes=new Set(['HOST_PERMISSION_MISSING','EXTERNAL_ANALYSIS_DISABLED','TIER_BLOCKS_REQUEST','RESOURCE_MISMATCH','SCAN_CANCELLED','ADMIN_LOCKED','KEY_TEST_INVALID','AbortError','SyntaxError','TypeError']);
    const code=error=>errorCodes.has(error?.code)?error.code:errorCodes.has(error?.name)?error.name:errorCodes.has(error?.message)?error.message:null;
    const refFields=new Set(['id','uuid','sha256','sha1','md5','submission_id','job_id']);
    const safeNumber=value=>Number.isFinite(value)&&Math.abs(value)<=1e12?value:null;
    // Recheck projected popup data at the background boundary as well.
    function clean(value,depth=0) {
        if(depth>7)return '[depth limit]';
        if(value===null||typeof value==='boolean')return value;
        if(typeof value==='number')return safeNumber(value);
        if(typeof value==='string')return enums.has(value)||/^ref-(?:b|p[a-f0-9]{12})-[0-9]{1,4}$/.test(value)||['[redacted string]','[depth limit]','[reference limit]','[unsupported]'].includes(value)?value:'[redacted string]';
        if(Array.isArray(value))return value.slice(0,8).map(item=>clean(item,depth+1));
        if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>fields.has(key)||['items','count','truncated','omittedFields'].includes(key)).slice(0,40).map(([key,item])=>[key,clean(item,depth+1)]));
        return null;
    }
    function project(value, depth=0, key='', budget={remaining:256}) {
        if(depth>5||--budget.remaining<0)return '[depth limit]';
        if(value===null||typeof value==='boolean')return value;
        if(typeof value==='number')return safeNumber(value);
        if(typeof value==='string') {
            if(value.length>128)return '[redacted string]';
            if(refFields.has(key)) {
                if(!/^[A-Za-z0-9_-]{1,128}$/.test(value))return '[redacted string]';
                if(!referenceNamespace)referenceNamespace=central()?'b':'p'+Array.from(crypto.getRandomValues(new Uint8Array(6)),byte=>byte.toString(16).padStart(2,'0')).join('');
                if(!references.has(value)){if(references.size>=1000)return '[reference limit]';references.set(value,'ref-'+referenceNamespace+'-'+(references.size+1));}
                return references.get(value);
            }
            return enums.has(value.toUpperCase())?value.toUpperCase():'[redacted string]';
        }
        if(Array.isArray(value))return {items:value.slice(0,8).map(item=>project(item,depth+1,key,budget)),count:value.length,truncated:value.length>8};
        if(value&&typeof value==='object') {
            const out={};let omitted=0,used=0;
            for(const name of Object.keys(value)) {
                if(!fields.has(name)||used>=35){omitted++;continue;}
                used++;out[name]=project(value[name],depth+1,name,budget);
            }
            if(omitted)out.omittedFields=omitted;
            return out;
        }
        return '[unsupported]';
    }
    function describe(url,options={}) {
        let provider='unknown',endpoint='unrecognized',scope='unknown',pathReferences=[];
        try {
            const identified=ThundyProviders.identify(url,options.method);provider=identified.provider;scope=identified.scope;
            const path=new URL(url).pathname;
            // Keep known operation names; every variable segment is a placeholder.
            const words=new Set(('api v1 v2 v3 overview quick-scan state file url url-for-analysis url-to-file submit report summary key current quota search hash hashes ip_addresses check result scan query info').split(' '));
            endpoint=path.split('/').map(part=>!part?'':words.has(part)?part:':reference').join('/').slice(0,256);
            pathReferences=path.split('/').filter(part=>part&&!words.has(part)).slice(0,4).map(part=>({type:/^[a-f0-9]{64}$/i.test(part)?'sha256':/^[a-f0-9]{32}$/i.test(part)?'md5':'opaque',reference:project(part,0,'id')}));
        }catch(_){}
        const headers=options.headers||{};
        const names=typeof headers.keys==='function'?[...headers.keys()]:Array.isArray(headers)?headers.map(row=>row[0]):Object.keys(headers);
        const authPresent=names.some(name=>/^(api-key|x-apikey|auth-key|key|authorization)$/i.test(name));
        let body={kind:'none'};
        if(options.body!=null) {
            const source=options.body;
            if(typeof source.keys==='function')body={kind:'form',fields:[...new Set([...source.keys()].filter(key=>fields.has(key)))].slice(0,35)};
            else if(typeof source==='string') {
                let parsed;try{parsed=JSON.parse(source);}catch(_){}
                body={kind:'text',bytes:new TextEncoder().encode(source).byteLength,...(parsed&&typeof parsed==='object'?{shape:project(parsed)}:{})};
            } else body={kind:'binary'};
        }
        return {provider:providers.includes(provider)?provider:'unknown',endpoint,pathReferences,scope:['hash','file','url','report','ip','domain'].includes(scope)?scope:'unknown',method:['GET','POST','HEAD'].includes((options.method||'GET').toUpperCase())?(options.method||'GET').toUpperCase():'OTHER',authPresent,body};
    }
    const phases=['precondition','queue','attempt','response','parse','assessment','persistence','cache','wait','cancelled','expired'];
    const states=['running','complete','pending','failed','blocked','checked','incomplete','submitted','unknown','none','suspicious','malicious','unconfirmed','success'];
    const localReasons=['preparation_failed','unconfigured','disabled','permission','authorization','policy','manual','sender','links_disabled','no_resources','quota','source_capacity','snapshot_count','snapshot_bytes','snapshot_invalid','snapshot_collision','storage_failed','capacity','cancelled','timeout','result_gone','QuotaExceededError','InvalidStateError','DataCloneError','AbortError','UnknownError','NotFoundError','TransactionInactiveError','SecurityError'];
    const purposes=['automatic','manual','link','key_test','report','analysis'];
    const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
    function budget(){
        while(entries.length>MAX_ENTRIES){entries.shift();dropped++;}
        while(runs.size>300||bytes({entries,pending:[...pending.values()],runs:[...runs.values()],references:[...references]})>MAX_BYTES-4096){
            const id=runs.keys().next().value;if(id===undefined){entries.length=0;pending.clear();dropped++;break;}
            runs.delete(id);for(let i=entries.length-1;i>=0;i--)if(entries[i].runId===id)entries.splice(i,1);
            for(const [ticket,entry] of pending)if(entry.runId===id)pending.delete(ticket);dropped++;
        }
    }
    async function beginRun(purpose='analysis',sender){
        if(!central())return null;
        try{const own=epoch;if(!(await ThundySecurity.read()).apiDebugEnabled||own!==epoch)return null;return createRun(purpose,sender);}catch(_){return null;}
    }
    function createRun(purpose,sender){
        prune();const id=++sequence;runs.set(id,{id,purpose:purposes.includes(purpose)?purpose:'analysis',startedAt:Date.now(),state:'running',events:[],owner:sender?ThundySecurity.identity(sender):'background'});budget();expire();return runs.has(id)?id:null;
    }
    function event(runId,phase,data={}){
        const run=runs.get(runId);if(!run||!phases.includes(phase)||Date.now()-run.startedAt>=MAX_AGE)return;
        const row={phase,at:Date.now()};
        if(providers.includes(data.provider))row.provider=data.provider;
        if(states.includes(data.state))row.state=data.state;
        if([...reasons,...localReasons].includes(data.reason))row.reason=data.reason;
        for(const key of ['operationId','httpStatus','durationMs','count'])if(Number.isFinite(data[key])&&data[key]>=0&&data[key]<=1e12)row[key]=data[key];
        if(['unknown','none','suspicious','malicious'].includes(data.verdict))row.verdict=data.verdict;
        if(['pending','complete','failed','unknown'].includes(data.completion))row.completion=data.completion;
        if(run.events.length>=128){run.events.shift();run.truncated=true;dropped++;}
        if(phase==='attempt'&&pending.has(data.operationId))pending.get(data.operationId).networkStarted=true;
        run.events.push(row);budget();expire();
    }
    function endRun(id,state){const run=runs.get(id);if(run&&states.includes(state)){run.state=state;budget();}}
    async function progress(ticket,phase,data={}){
        try{if(central()){const entry=pending.get(ticket);if(entry)event(entry.runId,phase,{...data,operationId:ticket});}
        else if(ticket!==null)await browser.runtime.sendMessage({action:'apiDebugCapture',stage:'progress',ticket,phase,data});}catch(_){}
    }
    function prune() {
        const now=Date.now();
        // Completion order need not match start order for concurrent requests.
        for(let i=entries.length-1;i>=0;i--)if(now-entries[i].startedAt>=MAX_AGE)entries.splice(i,1);
        for(const [id,value] of pending)if(now-value.startedAt>=300000){pending.delete(id);const run=runs.get(value.runId);if(run){run.state='unconfirmed';if(run.events.length<128)run.events.push({phase:'expired',at:now,state:'unconfirmed'});}}
        for(const run of runs.values())if(['running','pending'].includes(run.state)&&now-run.startedAt>=300000){run.state='unconfirmed';if(run.events.length<128)run.events.push({phase:'expired',at:now,state:'unconfirmed'});}
        for(const [id,run] of runs)if(now-run.startedAt>=MAX_AGE){runs.delete(id);for(let i=entries.length-1;i>=0;i--)if(entries[i].runId===id)entries.splice(i,1);for(const [ticket,entry] of pending)if(entry.runId===id)pending.delete(ticket);}
    }
    function expire() {
        if(expiryTimer!==null)clearTimeout(expiryTimer);
        const deadlines=[...[...runs.values()].map(run=>run.startedAt+(['running','pending'].includes(run.state)?300000:MAX_AGE)),...entries.map(entry=>entry.startedAt+MAX_AGE),...[...pending.values()].map(entry=>entry.startedAt+300000)];
        if(!deadlines.length){expiryTimer=null;references.clear();return;}
        expiryTimer=setTimeout(()=>{expiryTimer=null;prune();expire();},Math.max(1,Math.min(...deadlines)-Date.now()+1));
        expiryTimer?.unref?.();
    }
    function reset(){epoch++;contexts=new WeakMap();if(expiryTimer!==null)clearTimeout(expiryTimer);expiryTimer=null;entries.length=0;pending.clear();references.clear();runs.clear();dropped=0;try{browser.runtime.sendMessage?.({action:'apiDebugReset',epoch})?.catch?.(()=>{});}catch(_){} }
    async function startLocal(request,sender) {
        const own=epoch;
        if(!(await ThundySecurity.read()).apiDebugEnabled||own!==epoch)return null;
        prune();if(pending.size>=200){dropped++;return null;}
        const explicitRun=runs.has(request.runId);let runId=request.runId;const owner=sender?ThundySecurity.identity(sender):'background';
        if(!runs.has(runId)||runs.get(runId).owner!==owner){runId=request.clientFlow?[...runs.values()].find(run=>run.owner===owner&&run.sourceRef===request.clientFlow)?.id:null;if(!runId){runId=createRun(request.purpose,sender);if(runs.has(runId))runs.get(runId).sourceRef=request.clientFlow;}}
        if(runId===null||own!==epoch||pending.size>=200)return null;
        if(!explicitRun&&runs.has(runId))runs.get(runId).state='running';
        request={...request};delete request.runId;
        const id=++sequence;
        pending.set(id,{runId,explicitRun,request,startedAt:Date.now(),epoch,owner:sender?ThundySecurity.identity(sender):'background'});
        event(runId,'queue',{operationId:id,state:'running',provider:request.provider});budget();expire();
        return pending.has(id)?id:null;
    }
    function finishLocal(id,trace,sender) {
        prune();
        const entry=pending.get(id);if(!entry||entry.epoch!==epoch||entry.owner!==(sender?ThundySecurity.identity(sender):'background'))return;
        pending.delete(id);prune();
        const record={...entry};delete record.owner;delete record.epoch;delete record.explicitRun;
        record.durationMs=Math.max(0,Date.now()-entry.startedAt);
        record.attempts=(trace.attempts||[]).slice(0,3).map(row=>({status:Number.isInteger(row.status)&&row.status>=100&&row.status<=599?row.status:null,durationMs:safeNumber(row.durationMs),contentType:['json','html','text','other','missing'].includes(row.contentType)?row.contentType:'other'}));
        record.localBackoff=trace.localBackoff===true;
        record.networkStarted=entry.networkStarted===true||record.attempts.length>0;
        record.reason=reasons.includes(trace.reason)?trace.reason:'unknown';
        record.errorCode=errorCodes.has(trace.errorCode)?trace.errorCode:null;
        if(trace.response!==undefined)record.response=clean(trace.response);
        record.bodyState=['json','invalid_json','not_read'].includes(trace.bodyState)?trace.bodyState:'not_read';
        const size=JSON.stringify(record).length;
        if(size>32768){delete record.response;record.responseTruncated=true;}
        entries.push(record);
        event(record.runId,record.attempts.length?'assessment':record.networkStarted?'attempt':'precondition',{operationId:id,provider:record.request.provider,reason:record.reason,state:record.reason==='success'?'complete':!record.networkStarted?'blocked':'failed'});
        if(!entry.explicitRun&&![...pending.values()].some(value=>value.runId===record.runId))endRun(record.runId,record.reason==='success'?'complete':'failed');
        while(entries.length>MAX_ENTRIES||bytes(entries)>MAX_BYTES){entries.shift();dropped++;}
        budget();expire();
    }
    async function start(url,options) {
        try {if((await browser.storage.local.get('thundySecurityV1')).thundySecurityV1?.apiDebugEnabled!==true)return null;const context=options.analysisContext?.diagnosticContext||options.analysisContext;let clientFlow;if(context&&typeof context==='object'){if(!contexts.has(context))contexts.set(context,'flow-'+Array.from(crypto.getRandomValues(new Uint8Array(6)),byte=>byte.toString(16).padStart(2,'0')).join(''));clientFlow=contexts.get(context);}
        const request={...describe(url,options),clientFlow,runId:options.analysisContext?.diagnosticRun,purpose:options.keyTest?'key_test':options.analysisContext?.diagnosticPurpose||'report'};return central()?await startLocal(request):((await browser.runtime.sendMessage({action:'apiDebugCapture',stage:'start',request}))?.ticket??null);}catch(_){return null;}
    }
    async function finish(ticket,trace) {
        if(ticket===null)return;
        try{if(central())finishLocal(ticket,trace);else await browser.runtime.sendMessage({action:'apiDebugCapture',stage:'finish',ticket,trace});}catch(_){}
    }
    function classify(error,status) {
        if(error?.name==='SyntaxError')return 'invalid_json';
        if(error?.name==='AbortError')return 'timeout_or_cancelled';
        if(error?.code==='RESOURCE_MISMATCH')return 'resource_mismatch';
        if(error?.code)return 'policy_blocked';
        return status===401?'authentication':status===403?'permission':status===429?'rate_limited':status===404?'not_found':status===410?'gone':status===400||status===422?'invalid_request':status>=500?'server_error':error?'network_error':status>=200&&status<300?'success':'unknown';
    }
    async function capture(request,sender) {
        if(!ThundySecurity.page(sender,'popup.html'))throw Object.assign(Error('ADMIN_PAGE_REQUIRED'),{code:'ADMIN_PAGE_REQUIRED'});
        if(request.stage==='progress'){const entry=pending.get(request.ticket);if(entry?.owner===ThundySecurity.identity(sender))event(entry.runId,request.phase,{...request.data,operationId:request.ticket});return {};}
        if(request.stage==='start') {
            // A popup can only append bounded diagnostics, never inspect the report.
            const r=request.request;
            if(!r||JSON.stringify(r).length>40000||!providers.includes(r.provider)||typeof r.endpoint!=='string'||!/^\/[a-z0-9/:-]{0,256}$/.test(r.endpoint))return {ticket:null};
            return {ticket:await startLocal({provider:r.provider,clientFlow:typeof r.clientFlow==='string'&&/^flow-[a-f0-9]{12}$/.test(r.clientFlow)?r.clientFlow:undefined,purpose:purposes.includes(r.purpose)?r.purpose:'report',runId:r.runId,endpoint:r.endpoint,pathReferences:(Array.isArray(r.pathReferences)?r.pathReferences:[]).slice(0,4).map(ref=>({type:['sha256','md5'].includes(ref.type)?ref.type:'opaque',reference:clean(ref.reference)})),method:['GET','POST','HEAD'].includes(r.method)?r.method:'OTHER',scope:['hash','file','url','report','ip','domain'].includes(r.scope)?r.scope:'unknown',authPresent:r.authPresent===true,body:{kind:['none','form','text','binary'].includes(r.body?.kind)?r.body.kind:'none',...(Number.isSafeInteger(r.body?.bytes)&&r.body.bytes>=0&&r.body.bytes<=1e12?{bytes:r.body.bytes}:{}),...(Array.isArray(r.body?.fields)?{fields:r.body.fields.filter(key=>fields.has(key)).slice(0,35)}:{}),...(r.body?.shape?{shape:clean(r.body.shape)}:{})}},sender)};
        }
        // Only schema-projected diagnostic data from a trusted popup is admitted.
        if(request.stage==='finish'&&Number.isSafeInteger(request.ticket)&&request.trace&&JSON.stringify(request.trace).length<=40000)finishLocal(request.ticket,request.trace,sender);
        return {};
    }
    function report() {prune();const version=browser.runtime.getManifest?.().version;return {schemaVersion:2,kind:'thundy-api-debug',epoch,providers:Object.fromEntries(Object.entries(typeof ThundyProviders!=='undefined'?ThundyProviders.registry:{}).map(([id,value])=>[id,value.name])),runs:[...runs.values()].map(({owner,sourceRef,...run})=>JSON.parse(JSON.stringify(run))),...(typeof version==='string'&&/^[0-9.]{1,20}$/.test(version)?{extensionVersion:version}:{}),createdAt:Date.now(),entries:JSON.parse(JSON.stringify(entries)),pending:[...pending.entries()].map(([id,entry])=>({id,runId:entry.runId,request:entry.request,startedAt:entry.startedAt,completion:'unconfirmed'})),dropped,limits:{maxEntries:MAX_ENTRIES,maxBytes:MAX_BYTES,maxAgeMs:MAX_AGE,memoryOnly:true,rawBodiesIncluded:false,identifiersPseudonymized:true,transportStatusIsNotAnalysisVerdict:true,liveProviderVerification:false}};}
    return {start,finish,project,classify,code,capture,report,reset,beginRun,event,endRun,progress};
})();
