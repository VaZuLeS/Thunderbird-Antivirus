'use strict';
class RateLimiter {
    /**
     * Einfacher gleitendes Fenster-Ratenbegrenzer.
     * @param {number} maxRequests Maximale Anfragen pro Fenster
     * @param {number} windowMs Fenstergröße in Millisekunden
     */
    constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.timestamps = [];
    }

    /** Prüft (ohne zu verbrauchen), ob gerade eine Anfrage möglich wäre. */
    canProceed() {
        return this._prune().length < this.maxRequests;
    }

    /** Verbraucht ein Kontingent; gibt false zurück, wenn das Limit erschöpft ist. */
    tryAcquire() {
        const now = Date.now();
        const recent = this._prune(now);
        if (recent.length >= this.maxRequests) {
            return false;
        }
        recent.push(now);
        return true;
    }

    _prune(now = Date.now()) {
        this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
        return this.timestamps;
    }
}

class ApiGateway {
    /**
     * @param {Object} [rateLimits] Optionale Ratenlimits pro Anbieter,
     *   z. B. { virustotal: { maxRequests: 4, windowMs: 60000 } }
     *   (VirusTotal Free-Tier: 4 Anfragen/Minute).
     */
    constructor(rateLimits = {}) {
        this.apikeys = {};
        this.rateLimiters = {};
        for (const [provider, cfg] of Object.entries(rateLimits)) {
            this.rateLimiters[provider] = new RateLimiter(cfg.maxRequests, cfg.windowMs);
        }
    }

    setApikey(service, key) {
        this.apikeys[service] = key;
    }

    /** Ordnet eine URL einem Anbieter zu (für Auth-Header und Rate-Limits). */
    _providerForUrl(url) {
        let hostname;
        try {
            hostname = new URL(url).hostname;
        } catch (e) {
            return null;
        }
        if (hostname === 'virustotal.com' || hostname === 'www.virustotal.com') return 'virustotal';
        if (hostname === 'urlhaus-api.abuse.ch') return 'urlhaus';
        if (hostname === 'hybrid-analysis.com' || hostname === 'www.hybrid-analysis.com') return 'hybridanalysis';
        if (hostname === 'urlscan.io' || hostname === 'www.urlscan.io') return 'urlscan';
        if (hostname === 'api.abuseipdb.com') return 'abuseipdb';
        return null;
    }

    _injectAuthHeaders(url, options) {
        let headers = options.headers || {};
        let hostname;

        try {
            const parsedUrl = new URL(url);
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
        // Rate-Limit prüfen, bevor die Anfrage ans Netz geht.
        const provider = this._providerForUrl(url);
        if (provider && this.rateLimiters[provider] && !this.rateLimiters[provider].tryAcquire()) {
            throw new Error(`[ApiGateway] Rate limit for '${provider}' exhausted – request aborted before sending.`);
        }

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
    globalThis.RateLimiter = RateLimiter;

    // Vorbelegte Defaults: VirusTotal Free-Tier erlaubt nur 4 Anfragen/Minute.
    if (!globalThis.apiGateway) {
        globalThis.apiGateway = new ApiGateway({
            virustotal: { maxRequests: 4, windowMs: 60000 }
        });
    }
}
