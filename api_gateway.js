class ApiGateway {
    constructor() {
        this.apikeys = {};
        this.controllers = new Set();
        this.beforeRequest = null;
        this.active = new Map();
        this.waiting = new Map();
        this.generation = 0;
        this.backoffs = new Map();
    }

    setApikey(service, key) {
        if(service==='urlscan'&&this.apikeys[service]!==key){
            for(const [bucket,value] of this.backoffs)if(bucket.startsWith('urlscan.io:')&&value.quotaScope==='user')this.backoffs.delete(bucket);
        }
        this.apikeys[service] = key;
    }

    getBackoff(host) {
        if(!host)return null;
        const keys=[host];if(host.startsWith('urlscan.io:')&&!host.endsWith(':ip-address'))keys.push(host+':ip-address');
        let current=null;
        for(const key of keys){
            const entry=this.backoffs.get(key);if(!entry)continue;
            const remainingMs=entry.until-Date.now();if(remainingMs<=0){this.backoffs.delete(key);continue;}
            if(!current||entry.until>current.until)current={active:true,remainingSeconds:Math.max(1,Math.ceil(remainingMs/1000)),until:entry.until,...entry.quota};
        }
        return current;
    }

    setBackoff(host, seconds, quota = {}, maxSeconds = 3600) {
        if (!host || !Number.isFinite(seconds)) return;
        if(host.startsWith('urlscan.io:')&&quota.quotaScope==='ip-address'&&!host.endsWith(':ip-address'))host+=':ip-address';
        const ceiling=Number.isFinite(maxSeconds)&&maxSeconds>0?Math.min(86400,maxSeconds):3600;
        const s = Math.min(ceiling, Math.max(1, Math.ceil(seconds)));
        const until=Date.now()+s*1000;
        if(this.backoffs.get(host)?.until>=until)return;
        this.backoffs.set(host, {
            until,duration: s,quota,
            quotaScope:quota.quotaScope
        });
    }

    rateHeaders(response, policy) {
        const read=name=>{const value=response.headers?.get?.(name);return typeof value==='string'&&value.length<=128?value.trim():null;};
        const integer=name=>{const value=read(name);return value!==null&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)<=1000000000?Number(value):null;};
        const future=value=>{const date=Date.parse(value||'');return Number.isFinite(date)&&date>Date.now()?date:null;};
        const delay=value=>value!==null&&/^\d+(?:\.\d+)?$/.test(value)?Number(value):(future(value)-Date.now())/1000;
        const retry=read('retry-after');const delays=[];if(retry!==null){const value=delay(retry);if(Number.isFinite(value)&&value>=0)delays.push(value);}
        const quota={};
        if(policy){
            quota.quotaAction=policy.action;
            const reportedAction=read('x-rate-limit-action');
            const reported=Object.prototype.hasOwnProperty.call(policy.headerActions||{},reportedAction)?policy.headerActions[reportedAction]:null;
            if(reported===policy.action||policy.action.startsWith('submit-')&&reported?.startsWith('submit-'))quota.quotaAction=reported;
            const scope=read('x-rate-limit-scope'),window=read('x-rate-limit-window');
            if(['user','ip-address'].includes(scope))quota.quotaScope=scope;
            if(['minute','hour','day'].includes(window))quota.quotaWindow=window;
            for(const [name,key] of [['x-rate-limit-limit','quotaLimit'],['x-rate-limit-remaining','quotaRemaining']]){const value=integer(name);if(value!==null)quota[key]=value;}
            const reset=future(read('x-rate-limit-reset')),after=read('x-rate-limit-reset-after');
            const resetAfter=after!==null&&/^\d+(?:\.\d+)?$/.test(after)?Number(after):null;
            if(reset)quota.quotaResetAt=reset;
            if(Number.isFinite(resetAfter)&&resetAfter>=0){const at=Date.now()+Math.min(86400,resetAfter)*1000;quota.quotaResetAt=Math.max(quota.quotaResetAt||0,at);}
            if(response.status===429||quota.quotaRemaining===0){
                if(reset)delays.push((reset-Date.now())/1000);
                if(Number.isFinite(resetAfter)&&resetAfter>=0)delays.push(resetAfter);
            }
        }
        return {quota,key:policy?policy.host+':'+quota.quotaAction:null,seconds:delays.length?Math.min(policy?.maxSeconds||3600,Math.max(...delays)):null};
    }

    clearBackoffs() {
        this.backoffs.clear();
    }

    _injectAuthHeaders(url, options) {
        const inputHeaders = options.headers || {};
        const headers = typeof inputHeaders.entries === 'function' ? Object.fromEntries(inputHeaders.entries()) : Array.isArray(inputHeaders) ? Object.fromEntries(inputHeaders) : { ...inputHeaders };
        const hasHeader = name => Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase());
        let hostname;

        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'https:') {
                return options;
            }
            hostname = parsedUrl.hostname;
        } catch (e) {
            // Invalid URL, do not inject auth headers to be safe
            return options;
        }

        // Defense in depth only: adapters already carry the same auth headers,
        // so never override an existing header (PA-8 follow-up).
        if ((hostname === 'virustotal.com' || hostname === 'www.virustotal.com') && this.apikeys['virustotal'] && !hasHeader('x-apikey')) {
            headers['x-apikey'] = this.apikeys['virustotal'];
        } else if (hostname === 'urlhaus-api.abuse.ch' && this.apikeys['urlhaus'] && !hasHeader('Auth-Key')) {
            headers['Auth-Key'] = this.apikeys['urlhaus'];
        } else if ((hostname === 'hybrid-analysis.com' || hostname === 'www.hybrid-analysis.com') && this.apikeys['hybridanalysis'] && !hasHeader('api-key')) {
            headers['api-key'] = this.apikeys['hybridanalysis'];
        } else if ((hostname === 'urlscan.io' || hostname === 'www.urlscan.io') && this.apikeys['urlscan'] && !hasHeader('API-Key')) {
            headers['API-Key'] = this.apikeys['urlscan'];
        } else if (hostname === 'api.abuseipdb.com' && this.apikeys['abuseipdb'] && !hasHeader('Key')) {
            headers['Key'] = this.apikeys['abuseipdb'];
        }

        const requestOptions = {
            ...options,
            headers: headers
        };

        return requestOptions;
    }

    sanitizeResponse(data, options = {}) {
        const input=options.headers || {};
        const headers=typeof input.entries==='function'?Object.fromEntries(input.entries()):Array.isArray(input)?Object.fromEntries(input):input;
        const secrets=[...Object.values(this.apikeys),...Object.entries(headers).filter(([key])=>/^(x-apikey|api-key|auth-key|key|authorization)$/i.test(key)).map(([,value])=>value)].filter(value=>typeof value==='string'&&value.length>=6);
        const copy=(value,depth=0)=>{
            if(depth>32)return null;
            if(typeof value==='string'){for(const secret of secrets)value=value.split(secret).join('[redacted]');return value;}
            if(Array.isArray(value))return value.map(item=>copy(item,depth+1));
            if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,/^(api[_-]?key|authorization|password|secret|access[_-]?token)$/i.test(key)?'[redacted]':copy(item,depth+1)]));
            return value;
        };
        return copy(data);
    }

    abortAll() {
        this.generation++;
        for (const controller of this.controllers) controller.abort();
    }

    acquire(host, signal, limit = 2) {
        return new Promise((resolve, reject) => {
            const queue = this.waiting.get(host) || [];
            this.waiting.set(host, queue);
            const item = { start: () => {
                signal.removeEventListener('abort', cancelled);
                this.active.set(host, (this.active.get(host) || 0) + 1);
                resolve(() => {
                    this.active.set(host, this.active.get(host) - 1);
                    const next = queue.shift();
                    if (next) next.start();
                });
            }};
            const cancelled = () => {
                const index = queue.indexOf(item);
                if (index !== -1) queue.splice(index, 1);
                const error = new Error('Request cancelled'); error.name = 'AbortError'; reject(error);
            };
            if (signal.aborted) { cancelled(); return; }
            signal.addEventListener('abort', cancelled, { once: true });
            if ((this.active.get(host) || 0) < limit) item.start();
            else queue.push(item);
        });
    }

    pause(ms, signal) {
        return new Promise((resolve, reject) => {
            const cancelled = () => {
                clearTimeout(timer);
                const error = new Error('Request cancelled'); error.name = 'AbortError'; reject(error);
            };
            const timer = setTimeout(() => { signal.removeEventListener('abort', cancelled); resolve(); }, ms);
            signal.addEventListener('abort', cancelled, { once: true });
            if (signal.aborted) cancelled();
        });
    }

    async fetchWithTimeout(url, options = {}, timeout = 15000) {
        const diagnostic=typeof ThundyApiDiagnostics!=='undefined'?ThundyApiDiagnostics:null;
        const ticket=diagnostic?await diagnostic.start(url,this._injectAuthHeaders(url,options)):null;
        const trace={attempts:[]};
        try {return await this._fetchWithTimeout(url,options,timeout,ticket===null?null:trace);}
        catch(error){if(!trace.reason&&diagnostic)trace.reason=diagnostic.classify(error);if(diagnostic&&!trace.errorCode)trace.errorCode=diagnostic.code(error);throw error;}
        finally {if(ticket!==null)await diagnostic.finish(ticket,trace);}
    }

    async _fetchWithTimeout(url, options = {}, timeout = 15000, trace = null) {
        let hostname = null;
        try {
            hostname = new URL(url).hostname;
        } catch (_) {
            hostname = null;
        }

        const context = options.analysisContext;
        const info = typeof ThundyAnalysis !== 'undefined' && context ? ThundyAnalysis.spec(url, options.method) : null;
        if (info && ['report','url'].includes(context.scopeOverride) && info.provider === 'hybridanalysis') info.scope = context.scopeOverride;
        const emit = event => { try { const pending = context?.event({ ...info, ...event }); pending?.catch?.(() => {}); } catch (_) { /* metadata never blocks protection */ } };

        let ratePolicy=null;
        if(typeof ThundyProviders!=='undefined')try{ratePolicy=ThundyProviders.rateLimit(url,options);}catch(_){}
        const rateKey=ratePolicy?.key||hostname;
        const currentBackoff=()=>[...new Set([rateKey,hostname,ratePolicy?.host])].map(key=>this.getBackoff(key)).filter(Boolean).sort((a,b)=>b.remainingSeconds-a.remainingSeconds)[0]||null;
        const localResponse=backoff=>{
            if(trace){trace.localBackoff=true;trace.reason='rate_limited';}
            const data={error:'rate_limited',message:'Provider cooldown active',retry_after:backoff.remainingSeconds};
            const headers={'content-type':'application/json','retry-after':String(backoff.remainingSeconds)};
            const ResponseCtor=typeof Response!=='undefined'?Response:class {constructor(body,init){this.status=init.status;this.headers={get:key=>headers[key.toLowerCase()]||null};}async json(){return data;}};
            const response=new ResponseCtor(JSON.stringify(data),{status:429,statusText:'Too Many Requests',headers});response.json=async()=>data;response.localBackoff=true;
            if(info){
                emit({phase:'start'});
                emit({phase:'finish',responded:false,...(typeof ThundyProviders!=='undefined'?ThundyProviders.registry[info.provider].normalize(info,429,data):ThundyAnalysis.response(info,429,data)),...(typeof ThundyProviderResults!=='undefined'?ThundyProviderResults.projectQuota({...backoff,retryAt:backoff.until}):{}),localBackoff:true,retryAfter:backoff.remainingSeconds,observedAt:null});
            }
            return response;
        };

        options.analysisContext?.guard?.();
        if (options.keyTestAuthorization) await options.keyTestAuthorization();
        if (typeof ThundyProviders !== 'undefined') await ThundyProviders.enforce(url, options);
        if (!options.keyTest && this.beforeRequest) await this.beforeRequest();
        const controller = new AbortController();
        const upstreamSignal=options.analysisContext?.signal;
        const upstreamAbort=()=>controller.abort();
        upstreamSignal?.addEventListener('abort',upstreamAbort,{once:true});
        if(upstreamSignal?.aborted)controller.abort();
        this.controllers.add(controller);
        const id = setTimeout(() => controller.abort(), timeout);

        const fetchOptions = { ...this._injectAuthHeaders(url, options), signal: controller.signal };
        delete fetchOptions.analysisContext;
        delete fetchOptions.keyTest;
        delete fetchOptions.keyTestAuthorization;
        fetchOptions.redirect = 'error';
        let started = false, responded = false;

        let release,releaseSubmission;
        try {
            if(typeof ThundyProviders !== 'undefined') { const {provider,config,scope}=ThundyProviders.identify(url,options.method);if((options.method||'GET').toUpperCase()==='POST'&&scope==='url'&&config.submitConcurrency)releaseSubmission=await this.acquire('submit:'+provider,controller.signal,config.submitConcurrency); }
            release = await this.acquire(hostname || new URL(url).hostname, controller.signal);
            options.analysisContext?.guard?.();
            if (options.keyTestAuthorization) await options.keyTestAuthorization();
            if (typeof ThundyProviders !== 'undefined') await ThundyProviders.enforce(url, options);
            if (!options.keyTest && this.beforeRequest) await this.beforeRequest();
            let response,quota={},retrySeconds=null,cooldownKey=rateKey;
            for (let attempt = 0; attempt < 3; attempt++) {
                options.analysisContext?.guard?.();
                if (options.keyTestAuthorization) await options.keyTestAuthorization();
                if (typeof ThundyProviders !== 'undefined') await ThundyProviders.enforce(url, options);
                if (!options.keyTest && this.beforeRequest) await this.beforeRequest();
                const blocked=currentBackoff();
                if(blocked){if(response)break;return localResponse(blocked);}
                if (info && !started) { emit({ phase: 'start' }); started = true; }
                const attemptAt=Date.now();
                response = await fetch(url, fetchOptions);
                if(trace){const type=response.headers?.get?.('content-type')||'';trace.attempts.push({status:response.status,durationMs:Math.max(0,Date.now()-attemptAt),contentType:!type?'missing':/json/i.test(type)?'json':/html/i.test(type)?'html':/^text\//i.test(type)?'text':'other'});trace.reason=ThundyApiDiagnostics.classify(null,response.status);}
                responded = true;
                const rate=this.rateHeaders(response,ratePolicy);quota=rate.quota;retrySeconds=rate.seconds;cooldownKey=rate.key||rateKey;
                if(response.status===429||quota.quotaRemaining===0&&retrySeconds!==null){
                    const seconds=retrySeconds??60;
                    this.setBackoff(cooldownKey,seconds,quota,ratePolicy?.maxSeconds||3600);
                }
                const isGet=(options.method||'GET').toUpperCase()==='GET';
                if(!isGet||![429,503].includes(response.status)||retrySeconds===null||retrySeconds>2||attempt===2)break;
                await this.pause(Math.max(1,Math.ceil(retrySeconds))*1000,controller.signal);
            }
            // Provider responses are JSON. Keep the slot, abort signal and deadline
            // active until the body has been consumed, not just until headers arrive.
            let observedData;
            if ((response.body || info) && typeof response.json === 'function') {
                let data;
                try { data = await response.json(); }
                catch(error) { if(trace){trace.bodyState='invalid_json';if(response.status>=200&&response.status<300)trace.reason='invalid_json';}if(response.status>=200&&response.status<300)throw error;data=null; }
                data=this.sanitizeResponse(data,fetchOptions);
                if(trace){trace.bodyState=trace.bodyState||'json';trace.response=ThundyApiDiagnostics.project(data);}
                await options.analysisContext?.validateResponse?.(data);
                observedData = data;
                response.json = async () => data;
            }
            clearTimeout(id);

            if(response.status===429){
                console.warn('[ApiGateway] Provider rate limit exceeded (429)');
                retrySeconds=this.getBackoff(cooldownKey)?.remainingSeconds||currentBackoff()?.remainingSeconds||retrySeconds||60;
                if(observedData&&typeof observedData==='object')observedData.retry_after=retrySeconds;
            }

            const cooldown=this.getBackoff(cooldownKey)||currentBackoff();
            if (info) emit({ phase: 'finish', responded: true, ...(typeof ThundyProviders !== 'undefined' ? ThundyProviders.registry[info.provider].normalize(info,response.status,observedData) : ThundyAnalysis.response(info, response.status, observedData)), ...(typeof ThundyProviders !== 'undefined' ? ThundyProviders.metadata(info.provider,observedData,response.status) : {}),...quota,...(response.status===429?{retryAfter:retrySeconds}:{}),...(cooldown?{retryAt:cooldown.until}:{}), observedAt: Date.now() });
            return response;
        } catch (error) {
            if(trace){trace.reason=ThundyApiDiagnostics.classify(error);trace.errorCode=ThundyApiDiagnostics.code(error);}
            if (info && started) emit({ phase: 'finish', responded, state: 'failed', verdict: 'unknown',errorCode:error.code||error.name, errorDetails: error.code || error.name || 'Request failed', observedAt: null });
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error(typeof ThundyI18n !== 'undefined' ? ThundyI18n.get('gatewayRequestTimeout') : `[ApiGateway] Request cancelled or timed out after ${timeout}ms`);
            }
            if (typeof ThundyI18n !== 'undefined' && !error.code) throw new Error(ThundyI18n.get(error.name === 'SyntaxError' ? 'gatewayInvalidJson' : 'gatewayNetworkError'));
            throw error; // Preserve typed policy failures
        } finally {
            clearTimeout(id);
            upstreamSignal?.removeEventListener('abort',upstreamAbort);
            this.controllers.delete(controller);
            if (release) release();
            if (releaseSubmission) releaseSubmission();
        }
    }

    async fetchJson(url, options = {}, timeout = 15000) {
        const response = await this.fetchWithTimeout(url, options, timeout);

        try {
            const data = await response.json();
            return { response, data };
        } catch (error) {
            console.error('[ApiGateway] Invalid provider JSON');
            throw new Error(typeof ThundyI18n !== 'undefined' ? ThundyI18n.get('gatewayInvalidJson') : '[ApiGateway] Invalid JSON response');
        }
    }
}

// Instantiate globally as many background and api scripts will need it without module loading
if (typeof globalThis !== 'undefined') {
    globalThis.ApiGateway = ApiGateway;
}
const apiGateway = new ApiGateway();
