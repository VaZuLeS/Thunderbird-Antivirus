const { performance } = require('perf_hooks');

const knownBrands = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];
const text = "Please visit https://paypal.com/login and https://www.amazon.de/order and also http://someother.site.com/stuff";

const EXTRACT_URLS_REGEX = /https?:\/\/[^\s"'<>]+/g;
function extractUrlsCurrent(text) {
    const urlSet = new Set();
    let match;
    EXTRACT_URLS_REGEX.lastIndex = 0;
    while ((match = EXTRACT_URLS_REGEX.exec(text)) !== null) {
        let url = match[0];
        let len = url.length;
        while(len > 0) {
            let c = url.charCodeAt(len - 1);
            if (c === 46 || c === 44 || c === 59 || c === 58 || c === 33 || c === 41 || c === 93) {
                len--;
            } else {
                break;
            }
        }
        if (len !== url.length) {
            url = url.substring(0, len);
        }
        urlSet.add(url);
    }
    return Array.from(urlSet);
}


function extractUrlsNew(text) {
    const urlSet = new Set();
    let match;
    EXTRACT_URLS_REGEX.lastIndex = 0;
    while ((match = EXTRACT_URLS_REGEX.exec(text)) !== null) {
        let url = match[0];
        let len = url.length;

        let c = url.charCodeAt(len - 1);
        while(c === 46 || c === 44 || c === 59 || c === 58 || c === 33 || c === 41 || c === 93) {
            len--;
            if (len === 0) break;
            c = url.charCodeAt(len - 1);
        }
        if (len !== url.length) {
            url = url.substring(0, len);
        }
        urlSet.add(url);
    }
    return Array.from(urlSet);
}

const ITERATIONS = 500000;
let start = performance.now();
for (let i=0; i<ITERATIONS; i++) extractUrlsCurrent(text);
console.log("Current:", performance.now() - start);

start = performance.now();
for (let i=0; i<ITERATIONS; i++) extractUrlsNew(text);
console.log("New:", performance.now() - start);
