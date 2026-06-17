const { performance } = require('perf_hooks');

const urls = Array(10000).fill("https://user:pass@www.example-domain-long-name.com:8080/path/to/resource/file.html?query=1#hash");
urls.push("http://simple.com");
urls.push("https://no-path.org");

function testNative() {
    let start = performance.now();
    for (let i = 0; i < urls.length; i++) {
        try {
            let hostname = new URL(urls[i]).hostname.toLowerCase();
        } catch (e) {}
    }
    return performance.now() - start;
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
             // ensure it's not an IPv6 address? Native URL handles IPv6 as [::1], we would get [::1
             // For safety, fallback if '[' is present
             if (hostPart.charCodeAt(0) === 91) {
                 return new URL(url).hostname.toLowerCase();
             }
             hostPart = hostPart.substring(0, colonIndex);
        }
        return hostPart.toLowerCase();
    }
    return new URL(url).hostname.toLowerCase();
}

function testOptimized() {
    let start = performance.now();
    for (let i = 0; i < urls.length; i++) {
        try {
            let hostname = extractHostnameOptimized(urls[i]);
        } catch(e) {}
    }
    return performance.now() - start;
}

console.log("Native URL:", testNative(), "ms");
console.log("Optimized indexOf:", testOptimized(), "ms");
