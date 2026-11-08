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
        this.apikeys[service] = key;
    }

    getBackoff(host) {
        if (!host || !this.backoffs.has(host)) return null;
        const entry = this.backoffs.get(host);
        const remainingMs = entry.until - Date.now();
        if (remainingMs <= 0) {
            this.backoffs.delete(host);
            return null;
        }
        return {
            active: true,
            remainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
            until: entry.until
        };
    }

    setBackoff(host, seconds) {
        if (!host) return;
        const s = Math.min(3600, Math.max(1, Math.ceil(seconds)));
        this.backoffs.set(host, {
            until: Date.now() + (s * 1000),
            duration: s
        });
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

    acquire(host, signal) {
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
            if ((this.active.get(host) || 0) < 2) item.start();
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

        if (hostname) {
            const activeBackoff = this.getBackoff(hostname);
            if (activeBackoff && activeBackoff.active) {
                const retrySeconds = activeBackoff.remainingSeconds;
                const synthesizedData = {
                    error: 'rate_limited',
                    message: `Rate limit backoff active for ${hostname}`,
                    retry_after: retrySeconds
                };
                const headerMap = {
                    'content-type': 'application/json',
                    'retry-after': String(retrySeconds)
                };
                const synthesizedHeaders = typeof Headers !== 'undefined'
                    ? new Headers(headerMap)
                    : { get: k => headerMap[k.toLowerCase()] || headerMap[k] || null };
                const ResponseCtor = typeof Response !== 'undefined' ? Response : class MockResponse {
                    constructor(body, init = {}) {
                        this.status = init.status || 200;
                        this.statusText = init.statusText || '';
                        this.headers = init.headers;
                        this._body = body;
                    }
                    async json() { return JSON.parse(this._body); }
                    async text() { return String(this._body); }
                };
                const synthesizedResponse = new ResponseCtor(JSON.stringify(synthesizedData), {
                    status: 429,
                    statusText: 'Too Many Requests',
                    headers: synthesizedHeaders
                });
                synthesizedResponse.json = async () => synthesizedData;
                if (info) {
                    emit({
                        phase: 'finish',
                        responded: true,
                        ...ThundyAnalysis.response(info, 429, synthesizedData),
                        retryAfter: retrySeconds,
                        observedAt: Date.now()
                    });
                }
                return synthesizedResponse;
            }
        }

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

        let release;
        try {
            release = await this.acquire(hostname || new URL(url).hostname, controller.signal);
            options.analysisContext?.guard?.();
        if (options.keyTestAuthorization) await options.keyTestAuthorization();
            if (typeof ThundyProviders !== 'undefined') await ThundyProviders.enforce(url, options);
            if (!options.keyTest && this.beforeRequest) await this.beforeRequest();
            let response;
            for (let attempt = 0; attempt < 3; attempt++) {
                options.analysisContext?.guard?.();
        if (options.keyTestAuthorization) await options.keyTestAuthorization();
            if (typeof ThundyProviders !== 'undefined') await ThundyProviders.enforce(url, options);
            if (!options.keyTest && this.beforeRequest) await this.beforeRequest();
                if (info && !started) { emit({ phase: 'start' }); started = true; }
                response = await fetch(url, fetchOptions);
                responded = true;
                const retryAfter = response.headers && typeof response.headers.get === 'function' ? response.headers.get('retry-after') : null;
                const isGet = (options.method || 'GET').toUpperCase() === 'GET';
                if (!isGet || !retryAfter || ![429, 503].includes(response.status) || attempt === 2) break;
                const seconds = Number(retryAfter);
                const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
                if (!Number.isFinite(delay) || delay > 2000 || delay < 0) break;
                await this.pause(delay, controller.signal);
            }
            // Provider responses are JSON. Keep the slot, abort signal and deadline
            // active until the body has been consumed, not just until headers arrive.
            let observedData;
            if ((response.body || info) && typeof response.json === 'function') {
                let data;
                try { data = await response.json(); }
                catch(error) { if(response.status>=200&&response.status<300)throw error;data=null; }
                data=this.sanitizeResponse(data,fetchOptions);
                observedData = data;
                response.json = async () => data;
            }
            clearTimeout(id);

            if (response.status === 429) {
                console.warn('[ApiGateway] Provider rate limit exceeded (429)');
                let backoffSeconds = 60;
                const retryHeader = response.headers && typeof response.headers.get === 'function' ? response.headers.get('retry-after') : null;
                if (retryHeader) {
                    const parsedNum = Number(retryHeader);
                    if (Number.isFinite(parsedNum) && parsedNum > 0) {
                        backoffSeconds = Math.min(3600, parsedNum);
                    } else {
                        const parsedDate = Date.parse(retryHeader);
                        if (Number.isFinite(parsedDate) && parsedDate > Date.now()) {
                            backoffSeconds = Math.min(3600, Math.ceil((parsedDate - Date.now()) / 1000));
                        }
                    }
                }
                if (hostname) {
                    this.setBackoff(hostname, backoffSeconds);
                }
                if (observedData && typeof observedData === 'object') {
                    observedData.retry_after = backoffSeconds;
                }
            }

            if (info) emit({ phase: 'finish', responded: true, ...(typeof ThundyProviders !== 'undefined' ? ThundyProviders.registry[info.provider].normalize(info,response.status,observedData) : ThundyAnalysis.response(info, response.status, observedData)), ...(typeof ThundyProviders !== 'undefined' ? ThundyProviders.metadata(info.provider,observedData,response.status) : {}), observedAt: Date.now() });
            return response;
        } catch (error) {
            if (info && started) emit({ phase: 'finish', responded, state: 'failed', verdict: 'unknown', errorDetails: error.code || error.name || 'Request failed', observedAt: null });
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
