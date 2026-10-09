const { performance } = require('perf_hooks');

function evalCurrent(headerStr) {
    let score = 0;
    const headerStrLower = headerStr.toLowerCase();

    if (headerStrLower.includes("spf=fail") || headerStrLower.includes("spf=softfail")) {
        score += 50;
    }
    if (headerStrLower.includes("dkim=fail")) {
        score += 50;
    }
    if (headerStrLower.includes("dmarc=fail")) {
        score += 50;
    }
    return score;
}

const FAIL_SPF_REGEX = /spf=(?:fail|softfail)/i;
const FAIL_DKIM_REGEX = /dkim=fail/i;
const FAIL_DMARC_REGEX = /dmarc=fail/i;

function evalNew(headerStr) {
    let score = 0;
    if (FAIL_SPF_REGEX.test(headerStr)) {
        score += 50;
    }
    if (FAIL_DKIM_REGEX.test(headerStr)) {
        score += 50;
    }
    if (FAIL_DMARC_REGEX.test(headerStr)) {
        score += 50;
    }
    return score;
}

const text = "A".repeat(1000) + " spf=fail " + "B".repeat(1000) + " dkim=fail " + "C".repeat(1000);

const ITERATIONS = 100000;
let start = performance.now();
for (let i=0; i<ITERATIONS; i++) {
    evalCurrent(text);
}
console.log("Current:", performance.now() - start);

start = performance.now();
for (let i=0; i<ITERATIONS; i++) {
    evalNew(text);
}
console.log("New:", performance.now() - start);
