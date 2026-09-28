const IGNORED_DOMAINS = [
    'w3.org', 'google.com', 'microsoft.com', 'apple.com',
    'mozilla.org', 'schemas.microsoft.com', 'yahoo.com', 'github.com'
];
console.log('Array literal:', IGNORED_DOMAINS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
const r1 = new RegExp(`(?:^|\\.)(${IGNORED_DOMAINS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`);
console.log('Regex1 source:', r1.source);

console.log('Array literal 2:', IGNORED_DOMAINS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')).join('|'));
const r2 = new RegExp(`(?:^|\\.)(${IGNORED_DOMAINS.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')).join('|')})$`);
console.log('Regex2 source:', r2.source);
