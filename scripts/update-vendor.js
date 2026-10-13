// Reproduce the bundled PSL from the pinned development dependency; no network access.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const packageFile = require.resolve('tldts/package.json');
const dependency = JSON.parse(fs.readFileSync(packageFile));
const pinned = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).devDependencies.tldts;
if (dependency.version !== pinned) throw new Error('Installed tldts does not match the pinned version');
for (const [input, output] of [['dist/index.umd.min.js', 'vendor/tldts.js'], ['LICENSE', 'vendor/tldts.LICENSE']]) {
    const bytes = fs.readFileSync(path.join(path.dirname(packageFile), input));
    const target = path.join(root, output);
    if (process.argv.includes('--write')) fs.writeFileSync(target, bytes);
    else if (!fs.readFileSync(target).equals(bytes)) throw new Error(output + ' differs from the pinned dependency');
}
