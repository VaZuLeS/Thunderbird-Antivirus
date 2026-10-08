const KNOWN_BRANDS = ['paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 'sparkasse.de', 'volksbank.de'];
const map1 = KNOWN_BRANDS.map(b => b.replace(/\\./g, '\\.'));
console.log("map1 (incorrect):", map1);

const map2 = KNOWN_BRANDS.map(b => b.replaceAll('.', '\\.'));
console.log("map2 (correct):", map2);
