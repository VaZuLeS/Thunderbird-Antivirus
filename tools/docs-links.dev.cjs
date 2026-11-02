const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const files = ['README.md', 'README.de.md', ...[
    'VEROEFFENTLICHUNG_1_24_3.md', 'AUFGABENPLAN_WEITERENTWICKLUNG_1_24_3.md', 'AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md', 'WEITERENTWICKLUNG_VERTRAEGE.md', 'CI_WEITERENTWICKLUNG.md',
    'AKTUELLER_PRODUKTSTAND.md', 'AUSFUEHRUNG_AUFGABEN_2026-11-02.md',
    'PRODUKTANALYSE_AUFGABENPLAN_2026-11-02.md', 'privacy_policy.md',
    'DATENLEBENSZYKLUS.md', 'NATIVE_ABNAHME_2026-11.md',
    'SCHUTZWIRKUNG_VALIDIERUNG_2026-11.md', 'PERFORMANCE_BASELINE_2026-11.md',
    'ENTERPRISE_BRUECKE_2026-11.md', 'ATN_KANDIDAT_1_24_3.md',
    'support_faq.md', 'index.md', 'index.html', 'ci/README.md',
    'live_test_1_24_3.md', 'releases/1.24.3.md', 'ANALYSEQUELLEN_1_24_4.md', 'PLAN_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md', 'UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md', 'ABNAHME_INFORMATIONSDARSTELLUNG_EXTERN.md', 'live_test_1_24_4.md', 'releases/1.24.4.md',
    ...['en', 'de', 'fr', 'es', 'it', 'pl'].map(lang => 'index_' + lang + '.html')
].map(file => 'docs/' + file)];
const permalinks = new Map();
for (const name of fs.readdirSync(path.join(root, 'docs'))) {
    if (!name.endsWith('.md')) continue;
    const source = fs.readFileSync(path.join(root, 'docs', name), 'utf8');
    const match = source.match(/^permalink:\s*\/?([^\n]+)$/m);
    if (match) permalinks.set(match[1].trim(), path.join(root, 'docs', name));
}
let checked = 0;
const missing = [];
for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8').replace(/```[\s\S]*?```/g, '');
    const urls = [...text.matchAll(/\]\(([^)]+)\)|\bhref=["']([^"']+)["']/g)].map(match => match[1] || match[2]);
    for (let url of urls) {
        if (/^(?:https?:|mailto:|#)/i.test(url)) continue;
        url = decodeURIComponent(url.split('#')[0]);
        const target = path.resolve(root, path.dirname(file), url);
        const renderedSource = target.endsWith('.html') ? target.slice(0, -5) + '.md' : target;
        if (!fs.existsSync(target) && !fs.existsSync(renderedSource) && !permalinks.has(url)) missing.push({ file, url });
        checked++;
    }
}
assert.deepEqual(missing, [], 'broken current documentation links');
console.log(JSON.stringify({ files: files.length, checked, missing: 0, scope: 'current local sources and Jekyll permalink resolution; no HTTP or Jekyll runtime claim' }));
