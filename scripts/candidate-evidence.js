// Bind real-client and browser evidence to the exact package and its source files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { ALLOWED_FILES, ALLOWED_PREFIXES, selectArtifact } = require('./verify-package.js');
const ROOT = path.resolve(__dirname, '..');
const languages = ['en', 'de', 'fr', 'es', 'it', 'pl'];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relevant = file => ALLOWED_FILES.includes(file) || ALLOWED_PREFIXES.some(prefix => file.startsWith(prefix));

function sourceEntries(root) {
    const entries = [];
    function visit(relative) {
        const absolute = path.join(root, relative);
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) throw new Error('Packaged symlink is not allowed: ' + relative);
        if (stat.isDirectory()) {
            for (const name of fs.readdirSync(absolute)) visit(relative + '/' + name);
        } else if (stat.isFile() && relevant(relative)) entries.push(relative);
    }
    for (const file of ALLOWED_FILES) if (fs.existsSync(path.join(root, file))) visit(file);
    for (const prefix of ALLOWED_PREFIXES) if (fs.existsSync(path.join(root, prefix))) visit(prefix.replace(/\/$/, ''));
    return [...new Set(entries)].sort().map(name => ({ name, sha256: sha256(fs.readFileSync(path.join(root, name))) }));
}
function sourceFingerprint(root = ROOT) { return sha256(JSON.stringify(sourceEntries(root))); }
function packageIdentity(root = ROOT) {
    const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version;
    const artifact = selectArtifact(path.join(root, 'build'));
    if (artifact && JSON.parse(execFileSync('unzip', ['-p', artifact, 'manifest.json'])).version !== version) throw new Error('Candidate version mismatch');
    if (!artifact) throw new Error('No candidate package');
    const names = execFileSync('unzip', ['-Z1', artifact], { encoding: 'utf8' }).trim().split('\n').filter(name => !name.endsWith('/')).sort();
    if (new Set(names).size !== names.length || names.some(name => !relevant(name))) throw new Error('Unexpected or duplicate package entries');
    const entries = names.map(name => ({ name, sha256: sha256(execFileSync('unzip', ['-p', artifact, name], { maxBuffer: 32 * 1024 * 1024 })) }));
    const fingerprint = sha256(JSON.stringify(entries));
    if (fingerprint !== sourceFingerprint(root)) throw new Error('Candidate package differs from working-tree source');
    return { extensionVersion: version, sourceFingerprint: fingerprint, packageSha256: sha256(fs.readFileSync(artifact)) };
}
function collectReports(directory) {
    const result = [];
    for (const name of fs.readdirSync(directory)) {
        const file = path.join(directory, name), stat = fs.lstatSync(file);
        if (stat.isSymbolicLink()) throw new Error('Evidence symlink is not allowed');
        if (stat.isDirectory()) result.push(...collectReports(file));
        else if (name === 'report.json') result.push(JSON.parse(fs.readFileSync(file)));
    }
    return result;
}
function validateReports(identity, thunderbird, browserUi) {
    for (const lang of languages) {
        const tb = thunderbird.find(report => {
            const language = report.uiLanguage || report.currentRestart?.uiLanguage || report.previousInstallation?.uiLanguage;
            return language?.split('-')[0] === lang && report.passed === true && report.extensionVersion === identity.extensionVersion && report.xpiSha256 === identity.packageSha256 &&
                report.client?.capabilities?.browserName === 'thunderbird' && report.gracefulRestarts >= 2 && report.forcedRestarts >= 2;
        });
        if (!tb) throw new Error('Missing package-bound real Thunderbird upgrade/crash evidence: ' + lang);
        if (!browserUi.some(report => !report.fatalError && report.sourceFingerprint === identity.sourceFingerprint && report.view === 'all' && (report.cssZoom ?? 1) === 1 && report.failed === 0 && report.passed > 0 && report.passed === report.planned && report.results?.some(result => result.lang === lang) && report.matrix === 'full'))
            throw new Error('Missing complete browser UI evidence: ' + lang);
    }
}
function evidenceFile(root = ROOT) {
    const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version;
    return path.join(root, 'docs', 'audits', 'candidate-' + version.replaceAll('.', '_') + '.json');
}
function verifyEvidence(root = ROOT) {
    try {
        const evidence = JSON.parse(fs.readFileSync(evidenceFile(root)));
        const identity = packageIdentity(root);
        if (evidence.schemaVersion !== 1 || Object.keys(identity).some(key => evidence[key] !== identity[key])) throw new Error('Evidence/package/source identity mismatch');
        validateReports(identity, evidence.thunderbird, evidence.browserUi);
        return { ok: true, evidence: 'Package SHA-256 ' + identity.packageSha256 + '; real upgrade/crash and browser UI reports for all six languages' };
    } catch (error) { return { ok: false, evidence: error.message }; }
}
function writeEvidence(root, liveDirectory, uiDirectory) {
    const identity = packageIdentity(root), thunderbird = collectReports(liveDirectory), browserUi = collectReports(uiDirectory);
    validateReports(identity, thunderbird, browserUi);
    // Remove transient profile identifiers and original paths from durable reports.
    const clean = value => JSON.parse(JSON.stringify(value, (key, item) => ['moz:profile', 'moz:processID', 'sessionId'].includes(key) ? undefined : item));
    const evidence = { schemaVersion: 1, generatedAt: new Date().toISOString(), ...identity, thunderbird: clean(thunderbird), browserUi: clean(browserUi) };
    fs.writeFileSync(evidenceFile(root), JSON.stringify(evidence, null, 2) + '\n');
    return evidenceFile(root);
}
if (require.main === module) {
    if (process.argv[2] === '--write' && process.argv.length === 5) console.log(writeEvidence(ROOT, path.resolve(process.argv[3]), path.resolve(process.argv[4])));
    else { const result = verifyEvidence(); console.log(JSON.stringify(result)); process.exitCode = result.ok ? 0 : 1; }
}
module.exports = { sourceFingerprint, packageIdentity, validateReports, verifyEvidence, writeEvidence, languages };
