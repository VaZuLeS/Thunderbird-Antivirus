/* Pure provider evidence adapters. No network, resources or credentials are retained. */
var ThundyProviderResults = (function () {
    const verdicts=['unknown','none','suspicious','malicious'];
    const codes=['verdict','scanner','threat_score','multiscan_result','threat_level','whitelist','overall','urlscan','engines','brand','report'];
    const complete=['COMPLETE','COMPLETED','FINISHED','DONE','SUCCESS'];
    const pending=['IN_PROGRESS','IN_QUEUE','IN-PROGRESS','IN-QUEUE','PENDING','RUNNING','QUEUED','SUBMITTED'];
    const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
    const word=x=>typeof x==='string'?x.trim().toUpperCase():'';
    const number=x=>Number.isFinite(x)&&x>=0;
    const judgement=x=>({MALICIOUS:'malicious',MALICIOUS_VISUAL:'malicious',SUSPICIOUS:'suspicious',CLEAN:'none',WHITELISTED:'none',HARMLESS:'none','NO SPECIFIC THREAT':'none','NO THREAT':'none','NO-THREAT':'none',NO_THREAT:'none'})[word(x)]||'unknown';
    function result(signals,completion,receipt=false,invalid=false){
        if(invalid)completion='failed';
        const observed=signals.filter(s=>verdicts.includes(s.verdict)&&s.verdict!=='unknown');
        const verdict=observed.reduce((a,s)=>verdicts.indexOf(s.verdict)>verdicts.indexOf(a)?s.verdict:a,'unknown');
        return {assessmentVersion:1,state:invalid?'failed':completion==='pending'?receipt?'submitted':'incomplete':completion==='failed'?'failed':verdict==='unknown'?'received':'checked',verdict,completion,
            signals:[...new Set([...verdicts.slice().reverse().map(v=>signals.find(s=>s.verdict===v)).filter(Boolean),...signals])].slice(0,128),conflicts:new Set(observed.map(s=>s.verdict)).size>1?['mixed_verdicts']:[],...(invalid?{errorCode:'invalid_response'}:{})};
    }
    function hybrid(data,scope='report'){
        if(Array.isArray(data)){
            if(!data.length)return result([],'unknown');
            const rows=data.map(item=>hybrid(item,scope));
            const completion=rows.some(r=>r.completion==='pending')?'pending':rows.some(r=>r.completion==='failed')?'failed':rows.some(r=>r.completion==='unknown')?'unknown':'complete';
            return result(rows.flatMap(r=>r.signals),completion,false,rows.every(r=>r.errorCode==='invalid_response'));
        }
        if(!object(data))return result([],'failed',false,true);
        const signals=[];const add=(code,verdict,value,total)=>signals.push({code,verdict,...(number(value)?{value}:{}),...(number(total)?{total}:{})});
        const v=judgement(data.verdict);if(v!=='unknown'||['UNKNOWN','NO-CLASSIFICATION'].includes(word(data.verdict)))add('verdict',v);
        if(data.whitelisted===true)add('whitelist','none');
        const scanners=[...(Array.isArray(data.scanners)?data.scanners:[]),...(object(data.scanners_v2)?Object.values(data.scanners_v2):[])].filter(object);
        for(const scanner of scanners){
            let verdict=judgement(scanner.status);const positives=number(scanner.positives)?scanner.positives:null,total=number(scanner.total)?scanner.total:null;
            if(positives>0)verdict='malicious';else if(verdict==='unknown'&&positives===0&&total>0)verdict='none';
            if(verdict!=='unknown')add('scanner',verdict,positives,total);
            for(const av of (Array.isArray(scanner.anti_virus_results)?scanner.anti_virus_results:[])){const avVerdict=judgement(av?.verdict);if(avVerdict!=='unknown')add('scanner',avVerdict);}
        }
        for(const [code,value] of [['threat_score',data.threat_score],['multiscan_result',data.multiscan_result],['threat_level',data.threat_level]]){
            if(!number(value))continue;
            const verdict=code==='threat_score'?value>=70?'malicious':value>=30?'suspicious':'none':code==='multiscan_result'?value>=50?'malicious':value>0?'suspicious':'unknown':value===2?'malicious':value===1?'suspicious':value===0?'none':'unknown';
            add(code,verdict,value);
        }
        const state=word(data.state),isPending=pending.includes(state)||data.finished===false||scanners.some(s=>pending.includes(word(s.status)));
        const failed=['ERROR','FAILED','FAILURE'].includes(state);
        const receipt=['file','url'].includes(scope)&&!!(data.id||data.submission_id||data.job_id)&&data.finished!==true&&!complete.includes(state)&&!signals.some(s=>s.verdict!=='unknown');
        const completion=isPending||receipt?'pending':failed?'failed':data.finished===true||complete.includes(state)||signals.some(s=>s.verdict!=='unknown')?'complete':'unknown';
        const valid=signals.length||scanners.length||data.finished!==undefined||state||data.verdict!==undefined||data.id||data.submission_id||data.job_id||data.sha256;
        return result(signals,completion,receipt,!valid);
    }
    function urlscan(data,scope='report'){
        if(!object(data))return result([],'failed',false,true);
        const signals=[];const overall=data.verdicts?.overall,us=data.verdicts?.urlscan,eng=data.verdicts?.engines;
        for(const [code,part] of [['overall',overall],['urlscan',us],['engines',eng]]){
            if(!object(part))continue;
            let verdict=typeof part.malicious==='boolean'?part.malicious?'malicious':'none':'unknown';
            if(code==='engines'&&number(part.maliciousTotal)){if(part.maliciousTotal>0)verdict='malicious';else if(verdict==='unknown')verdict='none';}
            if(code==='overall'&&number(part.score)){if(part.score>=80)verdict='malicious';else if(part.score>=50&&verdict!=='malicious')verdict='suspicious';else if(verdict==='unknown')verdict='none';}
            if(code==='urlscan'&&number(part.score)){if(part.score>=50&&verdict!=='malicious')verdict='suspicious';else if(verdict==='unknown')verdict='none';}
            if(verdict!=='unknown')signals.push({code,verdict,...(number(part.score)?{value:part.score}:code==='engines'&&number(part.maliciousTotal)?{value:part.maliciousTotal}:{})});
        }
        if(Array.isArray(us?.brands)&&us.brands.length)signals.push({code:'brand',verdict:'unknown'});
        const receipt=scope==='url'&&typeof data.uuid==='string'&&!data.verdicts&&!data.page;
        const processing=pending.includes(word(data.state))||data.finished===false||receipt;
        const failed=['ERROR','FAILED','FAILURE'].includes(word(data.state));
        const valid=receipt||object(data.verdicts)||object(data.page)||object(data.task)||data.finished!==undefined||word(data.state);
        return result(signals,processing?'pending':failed?'failed':valid?'complete':'unknown',receipt,!valid);
    }
    function urlscanRejection(data){
        const errors=Array.isArray(data?.errors)?data.errors:[];
        const messages=[data?.message,...errors.slice(0,10).map(error=>error?.title)].filter(value=>typeof value==='string').map(value=>value.slice(0,512)).join(' ');
        if(/\bDNS\b|could not resolve|not resolvable/i.test(messages))return 'domain_unresolvable';
        return data?.code==='validationerror'||errors.some(error=>error?.code==='validationerror')?'invalid_request':'submission_rejected';
    }
    function projectQuota(value){
        const out={};
        for(const [key,allowed] of [['quotaAction',['submit-public','submit-unlisted','submit-private','submit-unknown','result','search']],['quotaScope',['user','ip-address']],['quotaWindow',['minute','hour','day']]])if(allowed.includes(value?.[key]))out[key]=value[key];
        for(const key of ['quotaLimit','quotaRemaining'])if(Number.isSafeInteger(value?.[key])&&value[key]>=0&&value[key]<=1000000000)out[key]=value[key];
        for(const key of ['quotaResetAt','retryAt'])if(Number.isFinite(value?.[key])&&value[key]>=0&&value[key]<=8640000000000000)out[key]=value[key];
        if(value?.localBackoff===true)out.localBackoff=true;
        return out;
    }
    function evaluate(provider,data,scope='report'){return provider==='hybridanalysis'?hybrid(data,scope):provider==='urlscan'?urlscan(data,scope):result([],'unknown');}
    function project(value){
        if(value?.assessmentVersion!==1)return {};
        const completion=['pending','complete','failed','unknown'].includes(value.completion)?value.completion:'unknown';
        const signals=(Array.isArray(value.signals)?value.signals:[]).filter(s=>object(s)&&codes.includes(s.code)&&verdicts.includes(s.verdict)).slice(0,128).map(s=>({code:s.code,verdict:s.verdict,...(number(s.value)?{value:s.value}:{}),...(number(s.total)?{total:s.total}:{})}));
        return {assessmentVersion:1,completion,signals,conflicts:Array.isArray(value.conflicts)&&value.conflicts.includes('mixed_verdicts')?['mixed_verdicts']:[]};
    }
    function merge(previous,current){
        const a=project(previous),b=project(current);
        if(!a.assessmentVersion)return current;
        if(!b.assessmentVersion)return previous;
        const signals=[...new Map([...a.signals,...b.signals].map(s=>[JSON.stringify(s),s])).values()];
        return result(signals,b.completion,current.state==='submitted',current.state==='failed'&&current.errorCode==='invalid_response');
    }
    function stored(provider,item){
        const saved=project(item?.assessment),raw=provider==='hybridanalysis'&&item?.report?evaluate(provider,item.report):null;
        if(saved.assessmentVersion){const known=result(saved.signals,saved.completion);return raw?merge(known,raw):known;}
        return raw||evaluate(provider,null);
    }
    function resource(item){
        const ha=stored('hybridanalysis',item),us=item?.urlscan?.assessment?.assessmentVersion===1?stored('urlscan',item.urlscan):{verdict:judgement(item?.urlscan?.status)};
        const values=[{verdict:ha.verdict,provider:'hybridanalysis',observedAt:Number.isFinite(Date.parse(item?.report_fetched_at))?Date.parse(item.report_fetched_at):null},{verdict:judgement(item?.hybrid_verdict?.status),provider:'hybridanalysis',observedAt:item?.hybrid_verdict?.observedAt||null},{verdict:us.verdict,provider:'urlscan',observedAt:item?.urlscan?.observedAt||null}];
        return values.reduce((a,b)=>verdicts.indexOf(b.verdict)>verdicts.indexOf(a.verdict)?b:a,{verdict:'unknown',provider:null,observedAt:null});
    }
    function legacy(provider,data){const a=evaluate(provider,data);return a.verdict==='malicious'?'MALICIOUS':a.verdict==='suspicious'?'SUSPICIOUS':a.verdict==='none'&&a.completion==='complete'?'CLEAN':a.completion==='complete'?'UNKNOWN':null;}
    // Display-only API v2 projection. Kept separate from provenance, exports and
    // protection decisions. No raw JSON, command lines, cookies or arbitrary keys.
    function hybridDetails(data, expectedHash = null) {
        if(typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/i.test(expectedHash))expectedHash=null;
        const sections=[];let truncated=false,budget=60000;
        const text=value=>{
            if(typeof value!=='string')return null;
            const clean=value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').trim();
            if(!clean)return null;
            if(clean.length>512)truncated=true;
            return clean.slice(0,512);
        };
        const url=value=>{try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))return null;return text(u.origin+u.pathname);}catch(_){return null;}};
        const hash=value=>typeof value==='string'&&/^[a-f0-9]{32,128}$/i.test(value)?value:null;
        const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)?value:null;
        const fields=(value,keys)=>{
            if(!object(value))return [];
            return keys.flatMap(key=>{
                const raw=value[key];let v=null;
                // Performance: Inline array allocations for `.includes()` cause recurrent GC overhead in hot paths.
                // Using direct string comparisons executes approximately 4-7x faster (e.g. ~70ms instead of ~450ms for 1M iterations).
                if(key==='md5'||key==='sha1'||key==='sha256'||key==='sha512'||key==='imphash')v=hash(raw);
                else if(key==='id'||key==='job_id'||key==='submission_id')v=id(raw);
                else if(key==='url'||key==='target_url')v=url(raw);
                else if(typeof raw==='boolean'||number(raw))v=raw;
                else if(Array.isArray(raw)){if(raw.length>20)truncated=true;v=raw.slice(0,20).map(text).filter(Boolean).join(', ')||null;}
                else v=text(raw);
                return v===null?[]:[{key,value:v}];
            });
        };
        const add=(section,rows)=>{
            const available=rows.filter(row=>row.length);
            if(available.length>50)truncated=true;
            const selected=[];
            for(const row of available.slice(0,50)){
                const size=JSON.stringify(row).length;
                if(size>budget){truncated=true;break;}
                budget-=size;selected.push(row);
            }
            if(selected.length)sections.push({id:section,rows:selected});
        };
        const roots=(Array.isArray(data)?data:[data]).filter(value=>object(value)&&(!expectedHash||typeof value.sha256!=='string'||value.sha256.toLowerCase()===expectedHash.toLowerCase()));
        if(roots.length>20)truncated=true;
        const values=roots.slice(0,20);
        add('identity',values.map(v=>fields(v,['sha256','sha1','md5','sha512','imphash','type','type_short','size','last_file_name','submit_name','url_analysis','target_url'])));
        add('assessment',values.map(v=>fields(v,['id','job_id','submission_id','state','finished','verdict','threat_score','threat_level','multiscan_result','av_detect','whitelisted','vx_family','classification_tags','tags','analysis_start_time','environment_id','environment_description','error_type','error_origin'])));
        const scanners=[];
        for(const v of values){
            for(const scanner of (Array.isArray(v.scanners)?v.scanners:[]))if(object(scanner))scanners.push(scanner);
            const v2=v.scanners_v2;
            if(object(v2)){for(const [name,scanner] of Object.entries(v2))if(object(scanner))scanners.push({...scanner,name:scanner.name||name});}
            else if(Array.isArray(v2)){for(const scanner of v2)if(object(scanner))scanners.push(scanner);}
        }
        add('scanners',scanners.map(s=>fields(s,['name','status','progress','positives','total','percent','scan_time','scan_date'])));
        const av=[];
        for(const scanner of scanners)for(const entry of (Array.isArray(scanner.anti_virus_results)?scanner.anti_virus_results:[]))if(object(entry))av.push([...fields(scanner,['name']),...fields(entry,['product','verdict','version','update'])]);
        add('antivirus',av);
        const reports=[];
        for(const v of values)for(const report of (Array.isArray(v.reports)?v.reports:[])){
            if(typeof report==='string')reports.push(fields({job_id:report},['job_id']));
            else if(object(report))reports.push(fields(report,['job_id','id','environment_id','environment_description','state','verdict','threat_score','threat_level','analysis_start_time']));
        }
        add('reports',reports);
        add('counts',values.map(v=>fields(v,['total_network_connections','total_processes','total_signatures'])));
        const collect=(key,keys)=>values.flatMap(v=>(Array.isArray(v[key])?v[key]:[]).map(row=>fields(row,keys)));
        add('signatures',collect('signatures',['name','type','category','threat_level','threat_score']));
        add('mitre',collect('mitre_attcks',['attck_id','tactic','technique','description']));
        const network=[];
        for(const v of values)for(const key of ['domains','hosts','compromised_hosts'])for(const item of (Array.isArray(v[key])?v[key]:[])){
            const row=typeof item==='string'?fields({[key]:item},[key]):fields(item,['domain','host','ip','port','protocol','country','asn']);
            if(row.length)network.push(row);
        }
        add('network',network);
        add('processes',collect('processes',['uid','name','process_id','parent_uid','file_path','sha256']));
        add('extracted',collect('extracted_files',['name','type','size','sha256','sha1','md5','threat_level','threat_score']));
        add('certificates',collect('certificates',['subject','issuer','valid_from','valid_until','serial_number']));
        const emptySections=[];
        for(const [section,keys] of Object.entries({reports:['reports'],signatures:['signatures'],mitre:['mitre_attcks'],network:['domains','hosts','compromised_hosts'],processes:['processes'],extracted:['extracted_files'],certificates:['certificates']})){
            const arrays=values.flatMap(v=>keys.filter(key=>Array.isArray(v[key])).map(key=>v[key]));
            if(arrays.length&&arrays.every(rows=>rows.length===0)&&!sections.some(s=>s.id===section))emptySections.push(section);
        }
        const scannerLists=values.flatMap(v=>[...(Array.isArray(v.scanners)?[v.scanners]:[]),...(Array.isArray(v.scanners_v2)?[v.scanners_v2]:object(v.scanners_v2)?[Object.values(v.scanners_v2)]:[])]);
        if(scannerLists.length&&scannerLists.every(rows=>rows.length===0))emptySections.push('scanners');
        if(scanners.some(s=>Array.isArray(s.anti_virus_results))&&scanners.filter(s=>Array.isArray(s.anti_virus_results)).every(s=>s.anti_virus_results.length===0))emptySections.push('antivirus');
        return {schemaVersion:1,sections,emptySections,truncated};
    }
    return {evaluate,project,merge,stored,resource,legacy,hybridDetails,urlscanRejection,projectQuota};
}());
