const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { validateReports, packageIdentity, languages } = require('./candidate-evidence.js');
const { releaseTagState } = require('./submission-gate.js');
const { publish } = require('./publish-release.js');

test('all six real-client upgrade/crash reports and browser reports must match the candidate', () => {
    const identity = { extensionVersion: '1.24.3', packageSha256: 'package', sourceFingerprint: 'source' };
    const live = languages.map(lang => ({ extensionVersion: identity.extensionVersion, xpiSha256: 'package', uiLanguage: lang, passed: true, gracefulRestarts: 2, forcedRestarts: 2, client: { capabilities: { browserName: 'thunderbird' } } }));
    const ui = [{ sourceFingerprint: 'source', view: 'all', failed: 0, passed: 6, planned: 6, matrix: 'full', results: languages.map(lang => ({ lang })) }];
    validateReports(identity, live, ui);
    assert.throws(() => validateReports(identity, live.slice(1), ui), /en/);
    assert.throws(() => validateReports(identity, live.map(report => ({ ...report, xpiSha256: 'older' })), ui), /real Thunderbird/);
    assert.throws(() => validateReports(identity, live, [{ ...ui[0], sourceFingerprint: 'older' }]), /browser UI/);
    assert.throws(() => validateReports(identity, live, [{ ...ui[0], matrix: 'smoke' }]), /browser UI/);
    assert.throws(() => validateReports(identity, live, [{ ...ui[0], failed: 1 }]), /browser UI/);
});

test('a package cannot be validated against changed working-tree source', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-package-'));
    try {
        fs.mkdirSync(path.join(root, 'build'));
        fs.writeFileSync(path.join(root, 'manifest.json'), '{"version":"1.24.3"}');
        execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],"w"); z.write(sys.argv[2],"manifest.json"); z.close()', path.join(root, 'build/test-1.24.3.zip'), path.join(root, 'manifest.json')]);
        assert.equal(packageIdentity(root).extensionVersion, '1.24.3');
        fs.writeFileSync(path.join(root, 'manifest.json'), '{"version":"1.24.3","changed":true}');
        assert.throws(() => packageIdentity(root), /differs/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a release tag at HEAD does not excuse staged or untracked package changes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-tag-'));
    const git = args => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: root, stdio: 'pipe' });
    try {
        git(['init']); fs.writeFileSync(path.join(root, 'manifest.json'), '{}');
        git(['add', '.']); git(['commit', '-m', 'fixture']); git(['tag', 'v1.24.3']);
        assert.deepEqual(releaseTagState('1.24.3', root).changedArtifacts, []);
        fs.writeFileSync(path.join(root, 'manifest.json'), '{"changed":true}'); git(['add', '.']);
        fs.writeFileSync(path.join(root, 'audit.js'), '// untracked package code');
        const state = releaseTagState('1.24.3', root);
        assert.equal(state.atHead, true);
        assert.deepEqual(state.dirtyArtifacts.sort(), ['audit.js', 'manifest.json']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

function releaseFixture(operation) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-publish-'));
    try {
        fs.mkdirSync(path.join(root, 'build'));
        const name = 'thundy-av-1.24.3.xpi', bytes = Buffer.from('tested archive');
        fs.writeFileSync(path.join(root, 'build', name), bytes);
        fs.writeFileSync(path.join(root, 'build/SHA256SUMS.txt'), crypto.createHash('sha256').update(bytes).digest('hex') + '  ' + name + '\n');
        operation({ root, name, tag: 'v1.24.3', version: '1.24.3', repository: 'example/repository' });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test('repeating publication verifies existing bytes without upload or clobber', () => releaseFixture(options => {
    const calls = [];
    const result = publish({ ...options, run: args => {
        calls.push(args);
        if (args[0] === 'api') return { status: 0, stdout: JSON.stringify({ tag_name: options.tag, draft: false, prerelease: false, assets: [{ name: options.name }, { name: 'SHA256SUMS.txt' }] }) };
        const directory = args[args.indexOf('--dir') + 1];
        for (const name of [options.name, 'SHA256SUMS.txt']) fs.copyFileSync(path.join(options.root, 'build', name), path.join(directory, name));
        return { status: 0 };
    } });
    assert.match(result, /identical/);
    assert.equal(calls.length, 2);
    assert.equal(calls[1][1], 'download');
}));
test('publication fails closed on status/auth errors and does not try to create', () => releaseFixture(options => {
    let calls = 0;
    assert.throws(() => publish({ ...options, run: () => { calls++; return { status: 1, stderr: 'HTTP 403' }; } }), /Cannot determine/);
    assert.equal(calls, 1);
}));
test('publication refuses mismatched existing asset bytes', () => releaseFixture(options => {
    assert.throws(() => publish({ ...options, run: args => {
        if (args[0] === 'api') return { status: 0, stdout: JSON.stringify({ tag_name: options.tag, draft: false, prerelease: false, assets: [{ name: options.name }, { name: 'SHA256SUMS.txt' }] }) };
        const directory = args[args.indexOf('--dir') + 1];
        for (const name of [options.name, 'SHA256SUMS.txt']) fs.writeFileSync(path.join(directory, name), 'different');
        return { status: 0 };
    } }), /published bytes differ/);
}));
