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

function processIpOld(ip) {
    const part1 = parseInt(ip, 10);
    if (part1 === 10 || part1 === 127 || part1 === 0) {
        return false;
    }
    const dot1 = ip.indexOf('.');
    const dot2 = ip.indexOf('.', dot1 + 1);
    const part2 = parseInt(ip.substring(dot1 + 1, dot2), 10);

    if (
        (part1 === 192 && part2 === 168) ||
        (part1 === 172 && part2 >= 16 && part2 <= 31) ||
        (part1 === 169 && part2 === 254)
    ) {
        return false;
    }
    return true;
}

function processIpNew(ip) {
    // Actually, split is usually slower than manual indexing, but sometimes modern V8 makes it faster.
    const parts = ip.split('.');
    const part1 = parseInt(parts[0], 10);
    if (part1 === 10 || part1 === 127 || part1 === 0) {
        return false;
    }
    const part2 = parseInt(parts[1], 10);

    if (
        (part1 === 192 && part2 === 168) ||
        (part1 === 172 && part2 >= 16 && part2 <= 31) ||
        (part1 === 169 && part2 === 254)
    ) {
        return false;
    }
    return true;
}

const ITERATIONS = 10000;
let start = performance.now();
for (let i=0; i<ITERATIONS; i++) {
    for (let ip of ips) processIpOld(ip);
}
console.log("Current:", performance.now() - start);

start = performance.now();
for (let i=0; i<ITERATIONS; i++) {
    for (let ip of ips) processIpNew(ip);
}
console.log("New:", performance.now() - start);
