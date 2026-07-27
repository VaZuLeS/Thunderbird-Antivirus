const { performance } = require('perf_hooks');

const NUM_DOMAINS = 10000;
let customBlacklist = new Set();
for (let i = 0; i < NUM_DOMAINS; i++) {
    customBlacklist.add(`bad-domain-${i}.com`);
}
customBlacklist.add('malicious.com');

const email = "user@test.com";
const senderDomain = "sub.malicious.com";

function checkLists_old(email, senderDomain) {
    if (customBlacklist.has(email)) return true;
    for (let b of customBlacklist) {
        if (b && (senderDomain === b || senderDomain.endsWith('.' + b))) {
            return true;
        }
    }
    return false;
}

function checkLists_new(email, senderDomain) {
    if (customBlacklist.has(email)) return true;

    let currentDomain = senderDomain;
    while (currentDomain) {
        if (customBlacklist.has(currentDomain)) return true;
        const dotIndex = currentDomain.indexOf('.');
        if (dotIndex === -1) break;
        currentDomain = currentDomain.substring(dotIndex + 1);
    }
    return false;
}

const ITERATIONS = 1000;

let start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    checkLists_old(email, senderDomain);
}
console.log('Old implementation:', performance.now() - start, 'ms');

start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    checkLists_new(email, senderDomain);
}
console.log('New implementation:', performance.now() - start, 'ms');
