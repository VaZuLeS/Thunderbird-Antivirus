const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM();
function createEnv(code) {
    const context = {
        browser: {
            storage: { local: { get: async () => ({}) }, onChanged: { addListener: () => {}, listeners: [] } },
            messages: { getFull: async () => ({}), listAttachments: async () => ([]), getAttachmentFile: async () => ({}) },
            messageDisplay: { getDisplayedMessage: async () => ({}), onMessageDisplayed: { addListener: () => {}, listeners: [] } },
            runtime: { onMessage: { addListener: () => {}, listeners: [] } },
            scripting: { executeScript: async () => {} },
            menus: { create: () => {}, onClicked: { addListener: () => {} } },
            notifications: { create: () => {} },
            downloads: { download: async () => {} }
        },
        crypto: globalThis.crypto,
        Math: globalThis.Math,
        Set: globalThis.Set,
        URL: globalThis.URL,
        DOMParser: dom.window.DOMParser,
        TextDecoder: globalThis.TextDecoder,
        Blob: globalThis.Blob,
        indexedDB: { open: () => ({}) },
        console: { log: () => {}, error: () => {} },
        fetch: async () => ({ status: 200, json: async () => ({}) }),
        FormData: class FormData {},
        File: class File {},
        ArrayBuffer: globalThis.ArrayBuffer,
        Uint8Array: globalThis.Uint8Array,
        Array: globalThis.Array,
        Date: globalThis.Date,
        JSON: globalThis.JSON,
        String: globalThis.String,
        Error: globalThis.Error,
        setTimeout: setTimeout
    };

    vm.createContext(context);
    const wrappedCode = `
        ${code}
        globalThis.checkIPReputation = checkIPReputation;
        globalThis.checkAbuseIPDB = checkAbuseIPDB;
        globalThis.checkVirusTotalIP = checkVirusTotalIP;
        globalThis.ipReputationCache = ipReputationCache;
        globalThis.MAX_IP_CACHE = MAX_IP_CACHE;
        globalThis.set_ipReputationProvider = (val) => { ipReputationProvider = val; };
        globalThis.set_ipReputationApiKey = (val) => { ipReputationApiKey = val; };
    `;
    context.URL = URL;
    context.URLSearchParams = URLSearchParams;
    vm.runInContext(wrappedCode, context);
    context.set_ipReputationProvider('abuseipdb');
    context.set_ipReputationApiKey('test-key');
    context.checkAbuseIPDB = async (ip) => {
        await new Promise(r => setTimeout(r, 20));
        return ip.endsWith('.1') || ip.endsWith('.6') || ip.endsWith('.11');
    };
    return context;
}

const code = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
const contextOrig = createEnv(code);

// Optimized code replaces chunking with single loop + single Promise.all
const unchunkedCode = code.replace(
    /const CONCURRENCY_LIMIT = 5;[\s\S]*?\}\s*\}\s*\}\s*return maliciousIps;/,
    `let ipChecks = [];

        for (let i = 0; i < publicIps.length; i++) {
            const ip = publicIps[i];
            if (ipReputationCache.has(ip)) {
                const cached = ipReputationCache.get(ip);
                if (cached instanceof Promise) {
                     ipChecks.push(cached.then(isMalicious => ({ ip, isMalicious })));
                } else {
                     if (cached) maliciousIps.push(ip);
                }
                continue;
            }

            let promise = (async () => {
                let isMalicious = false;
                try {
                    if (ipReputationProvider === "abuseipdb") {
                        isMalicious = await checkAbuseIPDB(ip, ipReputationApiKey);
                    } else if (ipReputationProvider === "virustotal") {
                        isMalicious = await checkVirusTotalIP(ip, ipReputationApiKey);
                    }
                } catch(e) { Logger.error(e); }
                return isMalicious;
            })();

            if (ipReputationCache.size >= MAX_IP_CACHE) {
                ipReputationCache.delete(ipReputationCache.keys().next().value);
            }
            ipReputationCache.set(ip, promise);

            ipChecks.push(promise.then(isMalicious => {
                ipReputationCache.set(ip, isMalicious);
                return { ip, isMalicious };
            }));
        }

        if (ipChecks.length > 0) {
            let results = await Promise.all(ipChecks);
            for (const result of results) {
                if (result.isMalicious) {
                    maliciousIps.push(result.ip);
                }
            }
        }
    }
    return maliciousIps;`
);

const contextOpt = createEnv(unchunkedCode);

async function runBenchmark() {
    const testHeaders = Array.from({ length: 15 }, (_, i) => `from mx.example.com (1.2.3.${i + 1})`);
    const ITERATIONS = 10;

    // Baseline
    let totalOrig = 0;
    for (let run = 0; run < ITERATIONS; run++) {
        contextOrig.ipReputationCache.clear();
        const start = performance.now();
        await contextOrig.checkIPReputation(testHeaders);
        totalOrig += performance.now() - start;
    }
    const avgOrig = totalOrig / ITERATIONS;

    // Optimized
    let totalOpt = 0;
    for (let run = 0; run < ITERATIONS; run++) {
        contextOpt.ipReputationCache.clear();
        const start = performance.now();
        await contextOpt.checkIPReputation(testHeaders);
        totalOpt += performance.now() - start;
    }
    const avgOpt = totalOpt / ITERATIONS;

    console.log(`Baseline Avg: ${avgOrig.toFixed(2)} ms`);
    console.log(`Optimized Avg: ${avgOpt.toFixed(2)} ms`);
    console.log(`Speedup: ${((avgOrig - avgOpt) / avgOrig * 100).toFixed(2)}%`);
}

runBenchmark();
