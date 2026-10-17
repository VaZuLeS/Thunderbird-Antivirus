class ApiGateway {
    constructor() {
        this.apikeys = {};
        this.controllers = new Set();
        this.beforeRequest = null;
        this.active = new Map();
        this.waiting = new Map();
        this.generation = 0;
    }

    setApikey(service, key) {
        this.apikeys[service] = key;
    }

    _injectAuthHeaders(url, options) {
        let headers = options.headers || {};
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
        if ((hostname === 'virustotal.com' || hostname === 'www.virustotal.com') && this.apikeys['virustotal'] && !headers['x-apikey']) {
            headers['x-apikey'] = this.apikeys['virustotal'];
        } else if (hostname === 'urlhaus-api.abuse.ch' && this.apikeys['urlhaus'] && !headers['Auth-Key']) {
            headers['Auth-Key'] = this.apikeys['urlhaus'];
        } else if ((hostname === 'hybrid-analysis.com' || hostname === 'www.hybrid-analysis.com') && this.apikeys['hybridanalysis'] && !headers['api-key']) {
            headers['api-key'] = this.apikeys['hybridanalysis'];
        } else if ((hostname === 'urlscan.io' || hostname === 'www.urlscan.io') && this.apikeys['urlscan'] && !headers['API-Key']) {
            headers['API-Key'] = this.apikeys['urlscan'];
        } else if (hostname === 'api.abuseipdb.com' && this.apikeys['abuseipdb'] && !headers['Key']) {
            headers['Key'] = this.apikeys['abuseipdb'];
        }

        const requestOptions = {
            ...options,
            headers: headers
        };

        return requestOptions;
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
        if (this.beforeRequest) await this.beforeRequest();
        const controller = new AbortController();
        this.controllers.add(controller);
        const id = setTimeout(() => controller.abort(), timeout);

        const fetchOptions = {
            ...this._injectAuthHeaders(url, options),
            signal: controller.signal
        };

        let release;
        try {
            release = await this.acquire(new URL(url).hostname, controller.signal);
            if (this.beforeRequest) await this.beforeRequest();
            let response;
            for (let attempt = 0; attempt < 3; attempt++) {
                if (this.beforeRequest) await this.beforeRequest();
                response = await fetch(url, fetchOptions);
                const retryAfter = response.headers && response.headers.get('retry-after');
                if ((options.method || 'GET').toUpperCase() !== 'GET' || !retryAfter || ![429, 503].includes(response.status) || attempt === 2) break;
                const seconds = Number(retryAfter);
                const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
                if (!Number.isFinite(delay)) break;
                await this.pause(Math.min(30000, Math.max(0, delay)), controller.signal);
            }
            // Provider responses are JSON. Keep the slot, abort signal and deadline
            // active until the body has been consumed, not just until headers arrive.
            if (response.body && typeof response.json === 'function') {
                const data = await response.json();
                response.json = async () => data;
            }
            clearTimeout(id);

            if (response.status === 429) {
                console.warn('[ApiGateway] Provider rate limit exceeded (429)');
                // In a production scenario, you might want to implement retry logic here
            }

            return response;
        } catch (error) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error(typeof ThundyI18n !== 'undefined' ? ThundyI18n.get('gatewayRequestTimeout') : `[ApiGateway] Request cancelled or timed out after ${timeout}ms`);
            }
            if (typeof ThundyI18n !== 'undefined' && !error.code) throw new Error(ThundyI18n.get(error.name === 'SyntaxError' ? 'gatewayInvalidJson' : 'gatewayNetworkError'));
            throw error; // Preserve typed policy failures
        } finally {
            clearTimeout(id);
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
