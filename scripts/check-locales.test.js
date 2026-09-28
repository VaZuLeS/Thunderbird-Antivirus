const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { runLocaleCheck } = require('./check-locales.js');

const REPO_ROOT = path.resolve(__dirname, '..');

function writeFixture(rootDir, files) {
    for (const [relative, content] of Object.entries(files)) {
        const target = path.join(rootDir, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    }
}

describe('check-locales', () => {
    let tmpDir;

    before(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-locales-')); });
    after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    function createExtension(enMessages, deMessages, html) {
        const rootDir = fs.mkdtempSync(path.join(tmpDir, 'ext-'));
        writeFixture(rootDir, {
            '_locales/en/messages.json': JSON.stringify(enMessages, null, 2),
            '_locales/de/messages.json': JSON.stringify(deMessages, null, 2),
            'popup.html': html
        });
        return rootDir;
    }

    it('accepts a consistent localization', () => {
        const result = runLocaleCheck(createExtension(
            { a: { message: 'A' }, b: { message: 'B' } },
            { a: { message: 'A-de' }, b: { message: 'B-de' } },
            '<div data-i18n="a">A</div>'
        ));
        assert.deepStrictEqual(result.problems, []);
    });

    it('reports missing translations in a language', () => {
        const result = runLocaleCheck(createExtension(
            { a: { message: 'A' }, b: { message: 'B' } },
            { a: { message: 'A-de' } },
            '<div data-i18n="a">A</div>'
        ));
        assert.ok(result.problems.some(problem => problem.includes('b')));
    });

    it('reports keys used in the UI but missing from the catalogs', () => {
        const result = runLocaleCheck(createExtension(
            { a: { message: 'A' } },
            { a: { message: 'A-de' } },
            '<div data-i18n="a">A</div><span data-i18n-placeholder="fehlt"></span>'
        ));
        assert.ok(result.problems.some(problem => problem.includes('fehlt')));
    });

    it('reports a missing catalog file', () => {
        const rootDir = fs.mkdtempSync(path.join(tmpDir, 'ext-'));
        writeFixture(rootDir, {
            '_locales/en/messages.json': JSON.stringify({ a: { message: 'A' } }),
            'popup.html': '<div data-i18n="a">A</div>'
        });
        const result = runLocaleCheck(rootDir);
        assert.ok(result.problems.some(problem => problem.includes('_locales/de')));
    });

    it('validates the real repository', () => {
        const result = runLocaleCheck(REPO_ROOT);
        assert.deepStrictEqual(result.problems, [], 'the repository localization must be complete');
        assert.ok(result.usedKeys.length > 20);
    });
});
