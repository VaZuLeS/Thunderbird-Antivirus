const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('ApiGateway module', () => {
    it('injects provider auth headers for keys wired via setApikey', () => {
        context = {
            AbortController: globalThis.AbortController,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            fetch: async () => ({ status: 200, json: async () => ({}) }),
            console: { log: () => {}, warn: () => {}, error: () => {} },
            URL: URL
        };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8'), context);
        const gw = new context.ApiGateway();
        gw.setApikey('virustotal', 'vt-key');
        gw.setApikey('abuseipdb', 'ip-key');
        gw.setApikey('urlscan', 'scan-key');
        const vt = gw._injectAuthHeaders('https://www.virustotal.com/api/v3/files/abc', { method: 'GET' });
        assert.strictEqual(vt.headers['x-apikey'], 'vt-key');
        const ip = gw._injectAuthHeaders('https://api.abuseipdb.com/api/v2/check?ipAddress=1.2.3.4', { method: 'GET' });
        assert.strictEqual(ip.headers['Key'], 'ip-key');
        const scan = gw._injectAuthHeaders('https://urlscan.io/api/v1/result/uuid/', { method: 'GET' });
        assert.strictEqual(scan.headers['API-Key'], 'scan-key');
        const plain = gw._injectAuthHeaders('https://example.com/api', { method: 'GET' });
        assert.ok(!('x-apikey' in plain.headers) && !('Key' in plain.headers));
        // Defense in depth: an adapter-provided header is never overridden.
        gw.setApikey('hybridanalysis', 'gw-key');
        const ha = gw._injectAuthHeaders('https://hybrid-analysis.com/api/v2/overview/abc', {
            method: 'GET',
            headers: { 'api-key': 'adapter-key' }
        });
        assert.strictEqual(ha.headers['api-key'], 'adapter-key');
    });
    let context;

    it('should fetch and return JSON correctly', async () => {
        let fetchCalledWith = null;
        context = {
            AbortController: globalThis.AbortController,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            fetch: async (url, options) => {
                fetchCalledWith = { url, options };
                return {
                    status: 200,
                    json: async () => ({ key: 'value' })
                };
            },
            console: { log: () => {}, warn: () => {}, error: () => {} }
        };

        context.URL = URL;
        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8');
        vm.runInContext(code, context);

        context.apiGateway = new context.ApiGateway();
        const apiGateway = context.apiGateway;
        const result = await apiGateway.fetchJson('https://example.com/api', { method: 'GET' });

        assert.ok(fetchCalledWith);
        assert.strictEqual(fetchCalledWith.url, 'https://example.com/api');
        assert.strictEqual(fetchCalledWith.options.method, 'GET');
        assert.strictEqual(result.data.key, 'value');
        assert.strictEqual(result.response.status, 200);
    });

    it('should catch 429 rate limit warning but return response', async () => {
        let warnMsg = null;
        context = {
            AbortController: globalThis.AbortController,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            fetch: async () => {
                return {
                    status: 429,
                    json: async () => ({ error: 'Too Many Requests' })
                };
            },
            console: {
                log: () => {},
                warn: (msg) => { warnMsg = msg; },
                error: () => {}
            }
        };

        context.URL = URL;
        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8');
        vm.runInContext(code, context);

        context.apiGateway = new context.ApiGateway();
        const apiGateway = context.apiGateway;
        const result = await apiGateway.fetchJson('https://example.com/api');

        assert.ok(warnMsg.includes('rate limit exceeded'));
        assert.strictEqual(result.data.error, 'Too Many Requests');
        assert.strictEqual(result.response.status, 429);
    });

    it('should throw timeout error', async () => {
        context = {
            AbortController: globalThis.AbortController,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            fetch: async () => {
                const err = new Error('The operation was aborted');
                err.name = 'AbortError';
                throw err;
            },
            console: { log: () => {}, warn: () => {}, error: () => {} }
        };

        context.URL = URL;
        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8');
        vm.runInContext(code, context);

        context.apiGateway = new context.ApiGateway();
        const apiGateway = context.apiGateway;
        await assert.rejects(
            async () => {
                await apiGateway.fetchJson('https://example.com/api', {}, 10);
            },
            (err) => {
                assert.ok(err.message.includes('timed out'));
                return true;
            }
        );
    });

    it('should bubble up generic network errors', async () => {
        let loggedError = null;
        context = {
            AbortController: globalThis.AbortController,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            fetch: async () => {
                throw new Error('Network failure');
            },
            console: {
                log: () => {},
                warn: () => {},
                error: (msg, err) => { loggedError = err; }
            },
            Error: Error
        };

        context.URL = URL;
        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8');
        vm.runInContext(code, context);

        context.apiGateway = new context.ApiGateway();
        const apiGateway = context.apiGateway;
        await assert.rejects(
            async () => {
                await apiGateway.fetchJson('https://example.com/api');
            },
            (err) => {
                assert.strictEqual(err.message, 'Network failure');
                return true;
            }
        );
    });

    it('should throw on invalid JSON', async () => {
        context = {
            AbortController: globalThis.AbortController,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            fetch: async () => {
                return {
                    status: 200,
                    json: async () => { throw new Error('SyntaxError'); }
                };
            },
            console: { log: () => {}, warn: () => {}, error: () => {} },
            Error: Error
        };

        context.URL = URL;
        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8');
        vm.runInContext(code, context);

        context.apiGateway = new context.ApiGateway();
        const apiGateway = context.apiGateway;
        await assert.rejects(
            async () => {
                await apiGateway.fetchJson('https://example.com/api');
            },
            (err) => {
                assert.ok(err.message.includes('Invalid JSON'));
                return true;
            }
        );
    });

    it('records rate limit backoff on 429 and intercepts subsequent requests without network calls', async () => {
        let fetchCalls = 0;
        const mockContext = {
            AbortController: globalThis.AbortController,
            setTimeout,
            clearTimeout,
            Date,
            JSON,
            Response: globalThis.Response,
            Headers: globalThis.Headers,
            fetch: async (url) => {
                fetchCalls++;
                return {
                    status: 429,
                    statusText: 'Too Many Requests',
                    headers: { get: (name) => name.toLowerCase() === 'retry-after' ? '45' : null },
                    json: async () => ({ error: 'rate_limit' })
                };
            },
            console: { log: () => {}, warn: () => {}, error: () => {} },
            URL: URL
        };
        vm.createContext(mockContext);
        vm.runInContext(fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8'), mockContext);

        const gw = new mockContext.ApiGateway();
        assert.strictEqual(gw.getBackoff('api.virustotal.com'), null);

        // 1. Initial call triggers fetch and receives 429
        const res1 = await gw.fetchWithTimeout('https://api.virustotal.com/v3/ip');
        assert.strictEqual(res1.status, 429);
        assert.strictEqual(fetchCalls, 1);

        // Verify backoff is recorded
        const backoff = gw.getBackoff('api.virustotal.com');
        assert.ok(backoff);
        assert.strictEqual(backoff.active, true);
        assert.ok(backoff.remainingSeconds <= 45 && backoff.remainingSeconds >= 40);

        // 2. Second call during active backoff must NOT call fetch
        const res2 = await gw.fetchWithTimeout('https://api.virustotal.com/v3/ip');
        assert.strictEqual(res2.status, 429);
        assert.strictEqual(fetchCalls, 1, 'fetch should NOT be called during active backoff');
        const data2 = await res2.json();
        assert.strictEqual(data2.error, 'rate_limited');
        assert.ok(data2.retry_after > 0);

        // 3. Clearing backoffs allows fetch again
        gw.clearBackoffs();
        assert.strictEqual(gw.getBackoff('api.virustotal.com'), null);
        await gw.fetchWithTimeout('https://api.virustotal.com/v3/ip');
        assert.strictEqual(fetchCalls, 2);
    });

    it('falls back to 60s backoff when retry-after header is missing on 429', async () => {
        let fetchCalls = 0;
        const mockContext = {
            AbortController: globalThis.AbortController,
            setTimeout,
            clearTimeout,
            Date,
            JSON,
            Response: globalThis.Response,
            Headers: globalThis.Headers,
            fetch: async () => {
                fetchCalls++;
                return {
                    status: 429,
                    statusText: 'Too Many Requests',
                    headers: { get: () => null },
                    json: async () => ({ error: 'too_many' })
                };
            },
            console: { log: () => {}, warn: () => {}, error: () => {} },
            URL: URL
        };
        vm.createContext(mockContext);
        vm.runInContext(fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8'), mockContext);

        const gw = new mockContext.ApiGateway();
        await gw.fetchWithTimeout('https://api.abuseipdb.com/check');
        assert.strictEqual(fetchCalls, 1);

        const backoff = gw.getBackoff('api.abuseipdb.com');
        assert.ok(backoff);
        assert.ok(backoff.remainingSeconds <= 60 && backoff.remainingSeconds >= 55);
    });
});
