const { performance } = require('perf_hooks');

const ips = [];
for (let i = 0; i < 50; i++) {
    ips.push(`192.168.1.${i}`);
    ips.push(`10.0.0.${i}`);
    ips.push(`172.16.0.${i}`);
    ips.push(`127.0.0.1`);
    ips.push(`8.8.8.8`);
    ips.push(`1.1.1.1`);
}

function extractPublicIPsCurrent(receivedHeaders) {
    let ipsSet = new Set();
    const ips = [];
    for (let i = 0, len = receivedHeaders.length; i < len; i++) {
        const header = receivedHeaders[i];
        let matches = header.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g);
        if (matches) {
            for (let j = 0, mlen = matches.length; j < mlen; j++) {
                const ip = matches[j];

                if (ip === "127.0.0.1" || ip === "0.0.0.0") continue;

                const part1 = parseInt(ip, 10);
                if (part1 === 10 || part1 === 127 || part1 === 0) continue;

                const dot1 = ip.indexOf('.');
                const dot2 = ip.indexOf('.', dot1 + 1);
                const part2 = parseInt(ip.substring(dot1 + 1, dot2), 10);

                if (
                    (part1 === 192 && part2 === 168) ||
                    (part1 === 172 && part2 >= 16 && part2 <= 31) ||
                    (part1 === 169 && part2 === 254)
                ) {
                    continue;
                }
                if (!ipsSet.has(ip)) {
                    ipsSet.add(ip);
                    ips.push(ip);
                }
            }
        }
    }
    return ips;
}

function extractPublicIPsNew(receivedHeaders) {
    let ipsSet = new Set();
    const ips = [];
    for (let i = 0, len = receivedHeaders.length; i < len; i++) {
        const header = receivedHeaders[i];
        let matches = header.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g);
        if (matches) {
            for (let j = 0, mlen = matches.length; j < mlen; j++) {
                const ip = matches[j];

                if (ip === "127.0.0.1" || ip === "0.0.0.0") continue;

                let part1 = 0;
                let idx = 0;
                for (; idx < ip.length; idx++) {
                    let c = ip.charCodeAt(idx);
                    if (c === 46) break;
                    part1 = part1 * 10 + (c - 48);
                }
                if (part1 === 10 || part1 === 127 || part1 === 0) continue;

                idx++;
                let part2 = 0;
                for (; idx < ip.length; idx++) {
                    let c = ip.charCodeAt(idx);
                    if (c === 46) break;
                    part2 = part2 * 10 + (c - 48);
                }

                if (
                    (part1 === 192 && part2 === 168) ||
                    (part1 === 172 && part2 >= 16 && part2 <= 31) ||
                    (part1 === 169 && part2 === 254)
                ) {
                    continue;
                }
                if (!ipsSet.has(ip)) {
                    ipsSet.add(ip);
                    ips.push(ip);
                }
            }
        }
    }
    return ips;
}

const headers = ips.map(ip => `Received: from mail.example.com ([${ip}]) by ...`);

const ITERATIONS = 10000;
let start = performance.now();
for (let i=0; i<ITERATIONS; i++) {
    extractPublicIPsCurrent(headers);
}
console.log("Current:", performance.now() - start);

start = performance.now();
for (let i=0; i<ITERATIONS; i++) {
    extractPublicIPsNew(headers);
}
console.log("New:", performance.now() - start);
