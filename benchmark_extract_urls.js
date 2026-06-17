const { performance } = require('perf_hooks');

const urlRegex = /(https?:\/\/[^\s<"']+)/gi;

const text = "Dies ist ein Text mit vielen URLs: " +
             Array(1000).fill(0).map((_, i) => `http://example.com/page${i}.html.,;!`).join(" ") +
             " " + Array(500).fill("https://www.google.com/?q=test").join(" ");


function extractUrlsRegex(text) {
    const urls = new Set();
    let match;
    urlRegex.lastIndex = 0;
    while ((match = urlRegex.exec(text)) !== null) {
        let url = match[1].replace(/[.,;:!)\]]+$/, '');
        urls.add(url);
    }
    return Array.from(urls);
}

function extractUrlsManualLoop(text) {
    const urls = new Set();
    let match;
    urlRegex.lastIndex = 0;
    while ((match = urlRegex.exec(text)) !== null) {
        let url = match[1];
        let end = url.length - 1;
        while (end >= 0) {
            let c = url.charCodeAt(end);
            if (c === 46 || c === 44 || c === 59 || c === 58 || c === 33 || c === 41 || c === 93) {
                end--;
            } else {
                break;
            }
        }
        urls.add(url.substring(0, end + 1));
    }
    return Array.from(urls);
}

let start = performance.now();
for (let i = 0; i < 100; i++) extractUrlsRegex(text);
console.log("extractUrlsRegex:", performance.now() - start, "ms");

start = performance.now();
for (let i = 0; i < 100; i++) extractUrlsManualLoop(text);
console.log("extractUrlsManualLoop:", performance.now() - start, "ms");
