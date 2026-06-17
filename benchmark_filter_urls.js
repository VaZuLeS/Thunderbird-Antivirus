const { performance } = require('perf_hooks');

const urls = Array(5000).fill("https://www.unknown-domain.com/path").concat(
             Array(1000).fill("http://microsoft.com/download"),
             Array(1000).fill("https://w3.org/something"),
             Array(3000).fill("ftp://invalid-url")
);

const IGNORED_DOMAINS = [
    'w3.org', 'google.com', 'microsoft.com', 'apple.com',
    'mozilla.org', 'schemas.microsoft.com', 'yahoo.com', 'github.com'
];
const IGNORED_DOMAINS_REGEX = new RegExp(`(?:^|\\.)(${IGNORED_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|')})$`, 'i');

function filterUrlsOriginal(urls) {
    return urls.filter(url => {
        try {
            let parsed = new URL(url);
            return !IGNORED_DOMAINS_REGEX.test(parsed.hostname);
        } catch (e) {
            return false;
        }
    });
}


function extractHostnameOptimized(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        let start = url.indexOf('//') + 2;
        let end = url.indexOf('/', start);
        if (end === -1) end = url.indexOf('?', start);
        if (end === -1) end = url.indexOf('#', start);
        if (end === -1) end = url.length;

        let hostPart = url.substring(start, end);
        let atIndex = hostPart.indexOf('@');
        if (atIndex !== -1) hostPart = hostPart.substring(atIndex + 1);

        let colonIndex = hostPart.indexOf(':');
        if (colonIndex !== -1) {
             if (hostPart.charCodeAt(0) === 91) {
                 return new URL(url).hostname.toLowerCase();
             }
             hostPart = hostPart.substring(0, colonIndex);
        }
        return hostPart.toLowerCase();
    }
    return new URL(url).hostname.toLowerCase();
}

function filterUrlsOptimized(urls) {
    return urls.filter(url => {
        try {
            let hostname = extractHostnameOptimized(url);
            return !IGNORED_DOMAINS_REGEX.test(hostname);
        } catch (e) {
            return false;
        }
    });
}

let start = performance.now();
for (let i = 0; i < 100; i++) filterUrlsOriginal(urls);
console.log("filterUrlsOriginal:", performance.now() - start, "ms");

start = performance.now();
for (let i = 0; i < 100; i++) filterUrlsOptimized(urls);
console.log("filterUrlsOptimized:", performance.now() - start, "ms");
