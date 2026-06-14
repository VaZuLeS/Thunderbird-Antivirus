const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('ApiGateway module', () => {
    let context;

    it('should fetch and return JSON correctly', async () => {
        let fetchCalledWith = null;
        context = {
            AbortController: class AbortController {
                constructor() { this.signal = {}; }
                abort() {}
            },
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
            AbortController: class AbortController {
                constructor() { this.signal = {}; }
                abort() {}
            },
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

        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'api_gateway.js'), 'utf8');
        vm.runInContext(code, context);

        context.apiGateway = new context.ApiGateway();
        const apiGateway = context.apiGateway;
        const result = await apiGateway.fetchJson('https://example.com/api');

        assert.ok(warnMsg.includes('Rate limit exceeded'));
        assert.strictEqual(result.data.error, 'Too Many Requests');
        assert.strictEqual(result.response.status, 429);
    });

    it('should throw timeout error', async () => {
        context = {
            AbortController: class AbortController {
                constructor() { this.signal = {}; }
                abort() {}
            },
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            fetch: async () => {
                const err = new Error('The operation was aborted');
                err.name = 'AbortError';
                throw err;
            },
            console: { log: () => {}, warn: () => {}, error: () => {} }
        };

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
            AbortController: class AbortController {
                constructor() { this.signal = {}; }
                abort() {}
            },
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
            AbortController: class AbortController {
                constructor() { this.signal = {}; }
                abort() {}
            },
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
});
