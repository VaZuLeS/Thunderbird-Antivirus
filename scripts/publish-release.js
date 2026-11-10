// An existing release is accepted only if its bytes match. Never clobber assets.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function publish({ tag, version, repository, root = path.resolve(__dirname, '..'), run = (args) => spawnSync('gh', args, { encoding: 'utf8' }) }) {
    if (tag !== 'v' + version || !/^\d+\.\d+\.\d+$/.test(version) || !/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Invalid release identity');
    const names = ['thundy-av-' + version + '.xpi', 'SHA256SUMS.txt', 'acceptance-' + version + '.json'];
    const files = names.map(name => path.join(root, 'build', name));
    for (const file of files) if (!fs.statSync(file).isFile()) throw new Error('Missing release file');
    if (fs.readFileSync(files[1], 'utf8') !== digest(files[0]) + '  ' + names[0] + '\n') throw new Error('Release checksum mismatch');
    require('./release-evidence.js').verify(JSON.parse(fs.readFileSync(files[2])), {extensionVersion:version,packageSha256:digest(files[0])});
    const existing = run(['api', 'repos/' + repository + '/releases/tags/' + tag]);
    if (existing.status === 0) {
        const release = JSON.parse(existing.stdout);
        if (release.tag_name !== tag || release.draft || release.prerelease || release.assets.length !== names.length || names.some(name => !release.assets.some(asset => asset.name === name))) throw new Error('Existing release metadata/assets differ');
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-release-compare-'));
        try {
            const downloaded = run(['release', 'download', tag, '--repo', repository, '--dir', directory, ...names.flatMap(name => ['--pattern', name])]);
            if (downloaded.status !== 0) throw new Error('Cannot verify existing release assets');
            for (let i = 0; i < names.length; i++) if (digest(path.join(directory, names[i])) !== digest(files[i])) throw new Error('Existing published bytes differ: ' + names[i]);
        } finally { fs.rmSync(directory, { recursive: true, force: true }); }
        return 'Existing release has identical assets; no changes made';
    }
    if (!/HTTP 404/.test(existing.stderr || '')) throw new Error('Cannot determine release status; refusing to publish');
    const created = run(['release', 'create', tag, ...files, '--repo', repository, '--verify-tag', '--latest', '--title', 'Thundy AV ' + version, '--notes-file', path.join(root, 'docs/releases', version + '.md')]);
    if (created.status !== 0) throw new Error('Release creation failed; inspect remote status before retrying');
    return 'Published new release';
}
if (require.main === module) {
    try { console.log(publish({ tag: process.env.RELEASE_TAG, version: require('../manifest.json').version, repository: process.env.GH_REPO })); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { publish };
