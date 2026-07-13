const fs = require('fs');
const { performance } = require('perf_hooks');

function getHostnameOptimized(url) {
    if (!url) return null;
    if (url.length > 2000) return null;

    // Quick check for obvious invalid inputs
    if (url.indexOf('://') === -1) {
        if (!url.startsWith('mailto:') && !url.startsWith('tel:')) {
            try {
                // Try parsing without protocol to see if it's a valid host
                let testUrl = new URL('http://' + url);
                return testUrl.hostname;
            } catch (e) {
                return null;
            }
        }
        return null; // Not a standard URL with a hostname
    }

    try {
        let u = new URL(url);
        return u.hostname;
    } catch (e) {
        return null;
    }
}

// Generate test data
const urls = [];
for (let i = 0; i < 50000; i++) {
    const domainId = Math.floor(i / 10); // 10 links per domain on average
    urls.push(`https://domain${domainId}.com/path/to/page`);
}

function testArray() {
    let linkDomains = [];
    for (let url of urls) {
        let hostname = getHostnameOptimized(url);
        if (!hostname) continue;
        if (linkDomains.indexOf(hostname) === -1) {
            linkDomains.push(hostname);
        }
    }
    return linkDomains.length;
}

function testSet() {
    let linkDomainsSet = new Set();
    for (let url of urls) {
        let hostname = getHostnameOptimized(url);
        if (!hostname) continue;
        linkDomainsSet.add(hostname);
    }
    return Array.from(linkDomainsSet).length;
}

// Warmup
for (let i = 0; i < 10; i++) {
    testArray();
    testSet();
}

const numRuns = 10;

let arrayTotal = 0;
for (let i = 0; i < numRuns; i++) {
    const start = performance.now();
    testArray();
    const end = performance.now();
    arrayTotal += (end - start);
}
console.log(`Array.indexOf approach: ${arrayTotal / numRuns} ms (average)`);

let setTotal = 0;
for (let i = 0; i < numRuns; i++) {
    const start = performance.now();
    testSet();
    const end = performance.now();
    setTotal += (end - start);
}
