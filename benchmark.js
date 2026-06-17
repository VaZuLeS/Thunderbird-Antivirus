const { performance } = require('perf_hooks');

const urls = Array(10000).fill("https://www.example-domain-long-name.com/path/to/resource/file.html.,;!)");

function testRegex() {
    let start = performance.now();
    for (let i = 0; i < urls.length; i++) {
        let u = urls[i];
        u.replace(/[.,;:!)\]]+$/, '');
    }
    return performance.now() - start;
}

function testManual() {
    let start = performance.now();
    for (let i = 0; i < urls.length; i++) {
        let u = urls[i];
        let end = u.length - 1;
        while (end >= 0) {
            let c = u.charCodeAt(end);
            if (c === 46 || c === 44 || c === 59 || c === 58 || c === 33 || c === 41 || c === 93) {
                end--;
            } else {
                break;
            }
        }
        let clean = u.substring(0, end + 1);
    }
    return performance.now() - start;
}

console.log("Regex replace:", testRegex(), "ms");
console.log("Manual loop:", testManual(), "ms");
