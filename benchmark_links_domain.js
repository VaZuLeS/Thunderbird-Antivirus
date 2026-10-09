const { performance } = require('perf_hooks');

const KNOWN_BRANDS = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];
const KNOWN_BRANDS_SET = new Set(KNOWN_BRANDS);
const KNOWN_BRANDS_REGEX = new RegExp(`(?:^|\\.)(${KNOWN_BRANDS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')).join('|')})$`, 'i');

function getMainDomainCurrent(domain) {
    const match = domain.match(KNOWN_BRANDS_REGEX);
    if (match) {
        return match[1].toLowerCase();
    }

    const lastDot = domain.lastIndexOf('.');
    if (lastDot !== -1) {
        const secondLastDot = domain.lastIndexOf('.', lastDot - 1);
        if (secondLastDot !== -1) {
            return domain.substring(secondLastDot + 1);
        }
    }
    return domain;
}

function getMainDomainNew(domain) {
    const match = KNOWN_BRANDS_REGEX.exec(domain);
    if (match !== null) {
        return match[1].toLowerCase();
    }

    const lastDot = domain.lastIndexOf('.');
    if (lastDot !== -1) {
        const secondLastDot = domain.lastIndexOf('.', lastDot - 1);
        if (secondLastDot !== -1) {
            return domain.substring(secondLastDot + 1);
        }
    }
    return domain;
}

const ITERATIONS = 1000000;
let start = performance.now();
for (let i=0; i<ITERATIONS; i++) {
    getMainDomainCurrent("www.login.paypal.com");
    getMainDomainCurrent("unknown-site.co.uk");
}
console.log("Current:", performance.now() - start);

start = performance.now();
for (let i=0; i<ITERATIONS; i++) {
    getMainDomainNew("www.login.paypal.com");
    getMainDomainNew("unknown-site.co.uk");
}
console.log("New:", performance.now() - start);
