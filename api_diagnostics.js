/* Opt-in, profile-local API diagnostics. No raw bodies, URLs or credentials retained. */
const ThundyApiDiagnostics = (() => {
    const MAX_ENTRIES=100, MAX_BYTES=1048576, MAX_AGE=3600000;
    const entries=[], pending=new Map(), references=new Map();
    let epoch=0, sequence=0, dropped=0, expiryTimer=null;
    const central=()=>typeof ThundySecurity!=='undefined';
    const providers=['hybridanalysis','urlscan','virustotal','urlhaus','abuseipdb'];
    const fields=new Set(('id uuid sha256 sha1 md5 submission_id job_id submission_type state status verdict finished progress positives total percent threat_score threat_level multiscan_result whitelisted whitelist scanners scanners_v2 reports anti_virus_results assessment verdicts overall urlscan engines malicious maliciousTotal suspicious score error errors code message detail description retry_after visibility query_status data attributes stats harmless undetected timeout type count quota limit remaining reset resource url file scan_type environment_id result api search results submitted').split(' '));
    const enums=new Set(('MALICIOUS SUSPICIOUS CLEAN HARMLESS WHITELISTED UNKNOWN NO-CLASSIFICATION ERROR FAILED FAILURE SUCCESS COMPLETE COMPLETED FINISHED DONE IN_PROGRESS IN_QUEUE IN-PROGRESS IN-QUEUE PENDING RUNNING QUEUED SUBMITTED PUBLIC PRIVATE UNLISTED PAGE_URL FILE URL ALL INVALID_KEY UNAUTHORIZED FORBIDDEN NOT_FOUND RATE_LIMITED VALIDATIONERROR OK NO_RESULTS').split(' '));
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
        if(typeof value==='string')return enums.has(value)||/^ref-[0-9]{1,4}$/.test(value)||['[redacted string]','[depth limit]','[reference limit]','[unsupported]'].includes(value)?value:'[redacted string]';
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
                if(!references.has(value)){if(references.size>=1000)return '[reference limit]';references.set(value,'ref-'+(references.size+1));}
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
                body={kind:'text',bytes:source.length,...(parsed&&typeof parsed==='object'?{shape:project(parsed)}:{})};
            } else body={kind:'binary'};
        }
        return {provider:providers.includes(provider)?provider:'unknown',endpoint,pathReferences,scope:['hash','file','url','report','ip','domain'].includes(scope)?scope:'unknown',method:['GET','POST','HEAD'].includes((options.method||'GET').toUpperCase())?(options.method||'GET').toUpperCase():'OTHER',authPresent,body};
    }
    function prune() {
        const now=Date.now();
        while(entries.length&&now-entries[0].startedAt>MAX_AGE)entries.shift();
        for(const [id,value] of pending)if(now-value.startedAt>300000)pending.delete(id);
    }
    function expire() {
        if(expiryTimer!==null)clearTimeout(expiryTimer);
        const deadlines=[...entries.map(entry=>entry.startedAt+MAX_AGE),...[...pending.values()].map(entry=>entry.startedAt+300000)];
        if(!deadlines.length){expiryTimer=null;references.clear();return;}
        expiryTimer=setTimeout(()=>{expiryTimer=null;prune();expire();},Math.max(1,Math.min(...deadlines)-Date.now()+1));
        expiryTimer?.unref?.();
    }
    function reset(){epoch++;if(expiryTimer!==null)clearTimeout(expiryTimer);expiryTimer=null;entries.length=0;pending.clear();references.clear();dropped=0;}
    async function startLocal(request,sender) {
        const own=epoch;
        if(!(await ThundySecurity.read()).apiDebugEnabled||own!==epoch)return null;
        prune();if(pending.size>=200){dropped++;return null;}
        const id=++sequence;
        pending.set(id,{request,startedAt:Date.now(),epoch,owner:sender?ThundySecurity.identity(sender):'background'});
        expire();
        return id;
    }
    function finishLocal(id,trace,sender) {
        const entry=pending.get(id);if(!entry||entry.epoch!==epoch||entry.owner!==(sender?ThundySecurity.identity(sender):'background'))return;
        pending.delete(id);prune();
        const record={...entry};delete record.owner;delete record.epoch;
        record.durationMs=Math.max(0,Date.now()-entry.startedAt);
        record.attempts=(trace.attempts||[]).slice(0,3).map(row=>({status:Number.isInteger(row.status)&&row.status>=100&&row.status<=599?row.status:null,durationMs:safeNumber(row.durationMs),contentType:['json','html','text','other','missing'].includes(row.contentType)?row.contentType:'other'}));
        record.localBackoff=trace.localBackoff===true;
        record.reason=reasons.includes(trace.reason)?trace.reason:'unknown';
        record.errorCode=errorCodes.has(trace.errorCode)?trace.errorCode:null;
        if(trace.response!==undefined)record.response=clean(trace.response);
        record.bodyState=['json','invalid_json','not_read'].includes(trace.bodyState)?trace.bodyState:'not_read';
        const size=JSON.stringify(record).length;
        if(size>32768){delete record.response;record.responseTruncated=true;}
        entries.push(record);
        while(entries.length>MAX_ENTRIES||JSON.stringify(entries).length>MAX_BYTES){entries.shift();dropped++;}
        expire();
    }
    async function start(url,options) {
        try {if((await browser.storage.local.get('thundySecurityV1')).thundySecurityV1?.apiDebugEnabled!==true)return null;const request=describe(url,options);return central()?await startLocal(request):((await browser.runtime.sendMessage({action:'apiDebugCapture',stage:'start',request}))?.ticket??null);}catch(_){return null;}
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
        if(request.stage==='start') {
            // A popup can only append bounded diagnostics, never inspect the report.
            const r=request.request;
            if(!r||!providers.includes(r.provider)||typeof r.endpoint!=='string'||!/^\/[a-z0-9/:-]{0,256}$/.test(r.endpoint))return {ticket:null};
            return {ticket:await startLocal({provider:r.provider,endpoint:r.endpoint,pathReferences:(Array.isArray(r.pathReferences)?r.pathReferences:[]).slice(0,4).map(ref=>({type:['sha256','md5'].includes(ref.type)?ref.type:'opaque',reference:clean(ref.reference)})),method:['GET','POST','HEAD'].includes(r.method)?r.method:'OTHER',scope:['hash','file','url','report','ip','domain'].includes(r.scope)?r.scope:'unknown',authPresent:r.authPresent===true,body:{kind:['none','form','text','binary'].includes(r.body?.kind)?r.body.kind:'none',...(Array.isArray(r.body?.fields)?{fields:r.body.fields.filter(key=>fields.has(key)).slice(0,35)}:{}),...(r.body?.shape?{shape:clean(r.body.shape)}:{})}},sender)};
        }
        // Only schema-projected diagnostic data from a trusted popup is admitted.
        if(request.stage==='finish'&&Number.isSafeInteger(request.ticket)&&request.trace&&JSON.stringify(request.trace).length<=40000)finishLocal(request.ticket,request.trace,sender);
        return {};
    }
    function report() {prune();const version=browser.runtime.getManifest?.().version;return {schemaVersion:1,kind:'thundy-api-debug',...(typeof version==='string'&&/^[0-9.]{1,20}$/.test(version)?{extensionVersion:version}:{}),createdAt:Date.now(),entries:JSON.parse(JSON.stringify(entries)),pending:[...pending.values()].map(entry=>({request:entry.request,startedAt:entry.startedAt,completion:'unconfirmed'})),dropped,limits:{maxEntries:MAX_ENTRIES,maxBytes:MAX_BYTES,maxAgeMs:MAX_AGE,memoryOnly:true,rawBodiesIncluded:false,identifiersPseudonymized:true,transportStatusIsNotAnalysisVerdict:true,liveProviderVerification:false}};}
    return {start,finish,project,classify,code,capture,report,reset};
})();
