const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const files = ['README.md', 'README.de.md', ...[
    'VEROEFFENTLICHUNG_1_25_5.md', 'SCHUTZPROFILE_1_25_5.md', 'live_test_1_25_5.md', 'releases/1.25.5.md', 'PRODUKTANALYSE_AUFGABENPLAN_2026-11-09.md', 'VEROEFFENTLICHUNG_1_25_6.md', 'HYBRID_QUELLENAKTUALISIERUNG_1_25_6.md', 'live_test_1_25_6.md', 'releases/1.25.6.md', 'VEROEFFENTLICHUNG_1_25_4.md', 'SPEICHERWIEDERANLAUF_2026_11_10.md', 'SPEICHERABNAHME_2026_11_10.md', 'ENTWICKLUNG_2026_11_10.md', 'live_test_1_25_4.md', 'releases/1.25.4.md', 'IDENTITAETSVERTRAG_2026_11_10.md', 'INLINE_SCAN_KONTEXT.md', 'ENTWICKLUNG_2026_11_09.md', 'IDENTITAET_FOLGEVERTRAG_2026_11_09.md', 'HYBRID_REFERENZEN_2026_11_09.md', 'UNABHAENGIGE_ABNAHMEN_2026_11_09.md', 'URLSCAN_KONTINGENTE.md', 'VEROEFFENTLICHUNG_1_25_3.md', 'live_test_1_25_3.md', 'releases/1.25.3.md', 'EINSTELLUNGEN_ADMIN_UND_ANSICHT.md', 'HYBRID_FACHANSICHT.md', 'VEROEFFENTLICHUNG_1_25_2.md', 'live_test_1_25_2.md', 'releases/1.25.2.md', 'VEROEFFENTLICHUNG_1_25_1.md', 'live_test_1_25_1.md', 'releases/1.25.1.md', 'AUTOMATISCHE_PRUEFUNGEN.md', 'ANBIETER_AUSWERTUNG.md', 'VEROEFFENTLICHUNG_1_25_0.md', 'live_test_1_25_0.md', 'releases/1.25.0.md', 'EXTERNE_ANALYSEN_UND_LINKFREIGABE.md', 'VEROEFFENTLICHUNG_1_24_3.md', 'VEROEFFENTLICHUNG_1_24_4.md', 'VEROEFFENTLICHUNG_1_24_5.md', 'HOTFIX_QUELLENLADEFEHLER_1_24_6.md', 'live_test_1_24_6.md', 'releases/1.24.6.md', 'VEROEFFENTLICHUNG_1_24_7.md', 'live_test_1_24_7.md', 'releases/1.24.7.md', 'VEROEFFENTLICHUNG_1_24_8.md', 'live_test_1_24_8.md', 'releases/1.24.8.md', 'AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md', 'WEITERENTWICKLUNG_VERTRAEGE.md', 'CI_WEITERENTWICKLUNG.md',
    'AKTUELLER_PRODUKTSTAND.md', 'HOTFIX_ANALYSEERGEBNISSE_1_24_5.md', 'BERICHTSAKTIONEN_1_24_5.md', 'live_test_1_24_5.md', 'releases/1.24.5.md', 'IDENTITAET_ANALYSEBEFUNDE.md', 'PRUEFUMFANG_NACHRICHTENINHALT.md', 'UNICODE_NACHRICHTENEINGANG.md', 'QUELLENHISTORIE_ZUORDNUNG.md', 'PROTOKOLLHISTORIE.md', 'QUELLENEXPORT.md', 'EXPORT_NAVIGATION.md', 'GROSSE_QUELLENHISTORIEN.md', 'AKTIVE_QUELLENANSICHTEN.md', 'LINT_PRUEFVERTRAG.md', 'REPRODUZIERBARE_PAKETE.md', 'AUSFUEHRUNG_AUFGABEN_2026-11-02.md',
    'PRODUKTANALYSE_AUFGABENPLAN_2026-11-04.md', 'privacy_policy.md',
    'DATENLEBENSZYKLUS.md', 'NATIVE_ABNAHME_2026-11.md',
    'SCHUTZWIRKUNG_VALIDIERUNG_2026-11.md', 'PERFORMANCE_BASELINE_2026-11.md',
    'ENTERPRISE_BRUECKE_2026-11.md', 'ATN_KANDIDAT_1_24_3.md',
    'support_faq.md', 'index.md', 'index.html', 'ci/README.md',
    'live_test_1_24_3.md', 'releases/1.24.3.md', 'ANALYSEQUELLEN_1_24_4.md', 'AUFGABENPLAN_NAECHSTE_ENTWICKLUNG_1_24_4.md', 'FORTSCHRITT_AVN_001_002_009.md', 'PLAN_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md', 'UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md', 'ABNAHME_INFORMATIONSDARSTELLUNG_EXTERN.md', 'live_test_1_24_4.md', 'releases/1.24.4.md',
    ...['en', 'de', 'fr', 'es', 'it', 'pl'].map(lang => 'index_' + lang + '.html')
].map(file => 'docs/' + file)];
const permalinks = new Map();
for (const name of fs.readdirSync(path.join(root, 'docs'))) {
    if (!name.endsWith('.md')) continue;
    const source = fs.readFileSync(path.join(root, 'docs', name), 'utf8');
    const match = source.match(/^permalink:\s*\/?([^\n]+)$/m);
    if (match) permalinks.set(match[1].trim(), path.join(root, 'docs', name));
}
const configText = fs.readFileSync(path.join(root, 'docs', '_config.yml'), 'utf8');
const excludedDirs = [...configText.matchAll(/^\s*-\s*([^\s#]+)\s*$/gm)].map(m => path.join(root, 'docs', m[1]));
let checked = 0;
const missing = [];
for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8').replace(/```[\s\S]*?```/g, '');
    const urls = [...text.matchAll(/\]\(([^)]+)\)|\bhref=["']([^"']+)["']/g)].map(match => match[1] || match[2]);
    const inDocs = file.startsWith('docs/') && !excludedDirs.some(dir => path.resolve(root, file).startsWith(dir + path.sep));
    for (let url of urls) {
        if (/^(?:https?:|mailto:|#)/i.test(url)) continue;
        url = decodeURIComponent(url.split('#')[0]);
        const target = path.resolve(root, path.dirname(file), url);
        const renderedSource = target.endsWith('.html') ? target.slice(0, -5) + '.md' : target;
        const isExcludedInPages = inDocs && excludedDirs.some(dir => target === dir || target.startsWith(dir + path.sep));
        if (isExcludedInPages || (!fs.existsSync(target) && !fs.existsSync(renderedSource) && !permalinks.has(url))) missing.push({ file, url });
        checked++;
    }
}
assert.deepEqual(missing, [], 'broken current documentation links');
const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version;
const {publishedVersion}=require('../scripts/distribution-state.js').readDistribution(root,version);
const tagPages = ['README.md', 'README.de.md', 'docs/index.md', 'docs/index.html', ...['en', 'de', 'fr', 'es', 'it', 'pl'].map(lang => 'docs/index_' + lang + '.html')];
for (const page of tagPages) {
    const content = fs.readFileSync(path.join(root, page), 'utf8');
    assert.ok(content.includes('releases/tag/v' + publishedVersion), page + ' must link to releases/tag/v' + publishedVersion);
    const staleTags = [...content.matchAll(/releases\/tag\/v(\d+\.\d+\.\d+)/g)].map(m => m[1]).filter(v => v !== publishedVersion);
    assert.deepEqual(staleTags, [], page + ' contains stale release tag links');
}
for (const lang of ['en', 'de', 'fr', 'es', 'it', 'pl']) {
    const page = 'docs/index_' + lang + '.html';
    const content = fs.readFileSync(path.join(root, page), 'utf8');
    const expectedXpi = 'releases/download/v' + publishedVersion + '/thundy-av-' + publishedVersion + '.xpi';
    assert.ok(content.includes(expectedXpi), page + ' must link to ' + expectedXpi);
    const staleDownloads = [...content.matchAll(/releases\/download\/v(\d+\.\d+\.\d+)\/thundy-av-(\d+\.\d+\.\d+)\.xpi/g)]
        .filter(m => m[1] !== publishedVersion || m[2] !== publishedVersion);
    assert.deepEqual(staleDownloads, [], page + ' contains stale XPI download links');
}
for (const doc of ['docs/reviewer_notes.md', 'docs/store_listing.md']) {
    const content = fs.readFileSync(path.join(root, doc), 'utf8');
    assert.ok(content.includes('**Version:** ' + version), doc + ' must declare Version ' + version);
}
console.log(JSON.stringify({ files: files.length, checked, missing: 0, candidateVersion:version,publishedVersion, scope: 'current local sources, version parity and Jekyll permalink resolution; no HTTP or Jekyll runtime claim' }));
