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
    return {evaluate,project,merge,stored,resource,legacy};
}());
