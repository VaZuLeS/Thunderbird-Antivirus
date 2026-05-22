const KNOWN_BRANDS = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];

// Create an exact mapping back to the canonical brand to avoid case changes and preserve original behavior
const KNOWN_BRANDS_MAP = new Map(KNOWN_BRANDS.map(b => [b.toLowerCase(), b]));

// The `replaceAll` is much better.
const KNOWN_BRANDS_REGEX = new RegExp(`(?:^|\\.)(${KNOWN_BRANDS.map(b => b.replaceAll('.', '\\.')).join('|')})$`, 'i');

function getMainDomain(domain) {
    const match = domain.match(KNOWN_BRANDS_REGEX);
    if (match) return KNOWN_BRANDS_MAP.get(match[1].toLowerCase());

    const dParts = domain.split('.');
    if (dParts.length >= 2) {
        return dParts.slice(-2).join('.');
    }
    return domain;
}

console.log(getMainDomain("www.paypal.com")); // paypal.com
console.log(getMainDomain("paypal-com")); // paypal-com (should not match regex wildcard)
console.log(getMainDomain("sub.paypal.com")); // paypal.com
console.log(getMainDomain("apple.com")); // apple.com
