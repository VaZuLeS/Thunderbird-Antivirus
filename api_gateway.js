class ApiGateway {
    constructor() {
        this.apikeys = {};
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

        if ((hostname === 'virustotal.com' || hostname === 'www.virustotal.com') && this.apikeys['virustotal']) {
            headers['x-apikey'] = this.apikeys['virustotal'];
        } else if (hostname === 'urlhaus-api.abuse.ch' && this.apikeys['urlhaus']) {
            headers['Auth-Key'] = this.apikeys['urlhaus'];
        } else if ((hostname === 'hybrid-analysis.com' || hostname === 'www.hybrid-analysis.com') && this.apikeys['hybridanalysis']) {
            headers['api-key'] = this.apikeys['hybridanalysis'];
        } else if ((hostname === 'urlscan.io' || hostname === 'www.urlscan.io') && this.apikeys['urlscan']) {
            headers['API-Key'] = this.apikeys['urlscan'];
        } else if (hostname === 'api.abuseipdb.com' && this.apikeys['abuseipdb']) {
            headers['Key'] = this.apikeys['abuseipdb'];
        }

        return {
            ...options,
            headers: headers
        };
    }

    async fetchWithTimeout(url, options = {}, timeout = 15000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        const fetchOptions = {
            ...this._injectAuthHeaders(url, options),
            signal: controller.signal
        };

        try {
            const response = await fetch(url, fetchOptions);
            clearTimeout(id);

            if (response.status === 429) {
                console.warn(`[ApiGateway] Rate limit exceeded (429) for ${url}`);
                // In a production scenario, you might want to implement retry logic here
            }

            return response;
        } catch (error) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error(`[ApiGateway] Request to ${url} timed out after ${timeout}ms`);
            }
            throw error; // Let other network errors bubble up
        }
    }

    async fetchJson(url, options = {}, timeout = 15000) {
        const response = await this.fetchWithTimeout(url, options, timeout);

        try {
            const data = await response.json();
            return { response, data };
        } catch (error) {
            console.error(`[ApiGateway] Error parsing JSON from ${url}:`, error);
            throw new Error(`[ApiGateway] Invalid JSON response from ${url}`);
        }
    }
}

// Instantiate globally as many background and api scripts will need it without module loading
if (typeof globalThis !== 'undefined') {
    globalThis.ApiGateway = ApiGateway;
}
const apiGateway = new ApiGateway();
