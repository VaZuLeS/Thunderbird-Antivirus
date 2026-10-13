// English is bundled so missing/unsupported locale lookup never needs a network request.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'i18n.js');
const source = fs.readFileSync(file, 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root, '_locales/en/messages.json'), 'utf8'));
const start = source.indexOf('    const fallback = ');
const end = source.indexOf(';\n    function get', start);
if (start < 0 || end < 0) throw new Error('Cannot locate the English fallback');
const updated = source.slice(0, start) + '    const fallback = ' + JSON.stringify(catalog, null, 2) + source.slice(end);
if (process.argv.includes('--check')) {
    if (source !== updated) { console.error('English fallback is stale; run node scripts/generate-i18n-fallback.js'); process.exitCode = 1; }
} else fs.writeFileSync(file, updated);
