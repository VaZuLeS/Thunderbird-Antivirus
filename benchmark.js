const { performance } = require('perf_hooks');

// Mock data and functions
const publicIps = ['1.1.1.1', '8.8.8.8', '9.9.9.9', '4.4.4.4', '2.2.2.2'];
const ipReputationProvider = "abuseipdb";
const ipReputationApiKey = "test-key";

async function checkAbuseIPDB(ip, apiKey) {
    // Simulate network delay of 100ms
    return new Promise(resolve => setTimeout(() => resolve(ip === '9.9.9.9'), 100));
}

async function checkVirusTotalIP(ip, apiKey) {
    return new Promise(resolve => setTimeout(() => resolve(false), 100));
}

async function runSequential() {
    let maliciousIps = [];
    const start = performance.now();

    for (let ip of publicIps) {
        let isMalicious = false;
        if (ipReputationProvider === "abuseipdb") {
            isMalicious = await checkAbuseIPDB(ip, ipReputationApiKey);
        } else if (ipReputationProvider === "virustotal") {
            isMalicious = await checkVirusTotalIP(ip, ipReputationApiKey);
        }
        if (isMalicious) {
            maliciousIps.push(ip);
        }
    }

    const end = performance.now();
    return { time: end - start, maliciousIps };
}

async function runConcurrent() {
    let maliciousIps = [];
    const start = performance.now();

    let ipChecks = publicIps.map(async (ip) => {
        let isMalicious = false;
        if (ipReputationProvider === "abuseipdb") {
            isMalicious = await checkAbuseIPDB(ip, ipReputationApiKey);
        } else if (ipReputationProvider === "virustotal") {
            isMalicious = await checkVirusTotalIP(ip, ipReputationApiKey);
        }
        return { ip, isMalicious };
    });

    let results = await Promise.all(ipChecks);
    for (let result of results) {
        if (result.isMalicious) {
            maliciousIps.push(result.ip);
        }
    }

    const end = performance.now();
    return { time: end - start, maliciousIps };
}

async function run() {
    console.log("Running Sequential...");
    const seqRes = await runSequential();
    console.log(`Sequential: ${seqRes.time.toFixed(2)}ms, found: ${seqRes.maliciousIps}`);

    console.log("Running Concurrent...");
    const conRes = await runConcurrent();
    console.log(`Concurrent: ${conRes.time.toFixed(2)}ms, found: ${conRes.maliciousIps}`);
}

run();
