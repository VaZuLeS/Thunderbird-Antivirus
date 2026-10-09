const { performance } = require('perf_hooks');

const longString = "A".repeat(1000) + " spf=fail " + "B".repeat(1000) + " dkim=fail " + "C".repeat(1000);

const AUTH_FAIL_REGEX = /(?:spf=fail|spf=softfail|dkim=fail|dmarc=fail)/i;
const FAIL_SPF_REGEX = /spf=(?:fail|softfail)/i;
const FAIL_DKIM_REGEX = /dkim=fail/i;
const FAIL_DMARC_REGEX = /dmarc=fail/i;
const AUTH_PASS_REGEX_SPF = /spf=pass/i;
const AUTH_PASS_REGEX_DKIM = /dkim=pass/i;
const AUTH_PASS_REGEX_DMARC = /dmarc=pass/i;


function evalCurrent(headerStr) {
    let score = 0;
    let authStatus = 'neutral';
    if (AUTH_FAIL_REGEX.test(headerStr)) {
        const headerStrLower = headerStr.toLowerCase();
        let fail = false;

        if (headerStrLower.includes("spf=fail") || headerStrLower.includes("spf=softfail")) {
            score += 50;
            fail = true;
        }
        if (headerStrLower.includes("dkim=fail")) {
            score += 50;
            fail = true;
        }
        if (headerStrLower.includes("dmarc=fail")) {
            score += 50;
            fail = true;
        }

        if (fail) {
            authStatus = 'fail';
        } else if (headerStrLower.includes("spf=pass") && headerStrLower.includes("dkim=pass") && headerStrLower.includes("dmarc=pass")) {
            authStatus = 'pass';
        }
    }
    return score;
}

function evalNew(headerStr) {
    let score = 0;
    let authStatus = 'neutral';
    if (AUTH_FAIL_REGEX.test(headerStr)) {
        let fail = false;

        if (FAIL_SPF_REGEX.test(headerStr)) {
            score += 50;
            fail = true;
        }
        if (FAIL_DKIM_REGEX.test(headerStr)) {
            score += 50;
            fail = true;
        }
        if (FAIL_DMARC_REGEX.test(headerStr)) {
            score += 50;
            fail = true;
        }

        if (fail) {
            authStatus = 'fail';
        } else if (AUTH_PASS_REGEX_SPF.test(headerStr) && AUTH_PASS_REGEX_DKIM.test(headerStr) && AUTH_PASS_REGEX_DMARC.test(headerStr)) {
            authStatus = 'pass';
        }
    }
    return score;
}

const ITERATIONS = 100000;

let start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    evalCurrent(longString);
}
console.log('Current:', performance.now() - start);

start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    evalNew(longString);
}
console.log('New:', performance.now() - start);
