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

function extractHostnameSimple(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        let start = url.indexOf('//') + 2;
        let end = url.indexOf('/', start);
        if (end === -1) end = url.indexOf('?', start);
        if (end === -1) end = url.indexOf('#', start);
        if (end === -1) end = url.length;

        let hostPart = url.substring(start, end);
        // Fallback to new URL if complex parsing is needed (e.g. basic auth, ports, IPv6)
        if (hostPart.indexOf('@') !== -1 || hostPart.indexOf(':') !== -1 || hostPart.charCodeAt(0) === 91) {
            return new URL(url).hostname;
        }
        return hostPart;
    }
    return new URL(url).hostname;
}

function filterUrlsSimpleOptimized(urls) {
    return urls.filter(url => {
        try {
            let hostname = extractHostnameSimple(url);
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
for (let i = 0; i < 100; i++) filterUrlsSimpleOptimized(urls);
console.log("filterUrlsSimpleOptimized:", performance.now() - start, "ms");
