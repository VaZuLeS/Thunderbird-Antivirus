const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { readDistribution } = require('./distribution-state.js');
const { version } = require('../manifest.json');
const path = require('node:path');
const { setTimeout: wait } = require('node:timers/promises');

const languages = ['en', 'de', 'fr', 'es', 'it', 'pl'];
const guides = {
    de: ['guide-de.html', 'UNTERNEHMENSRICHTLINIE.html', 'python-receiver.html'],
    en: ['guide-en.html', 'enterprise-policy.en.html', 'python-receiver.en.html'],
};

async function get(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.ok, true, `${url} returned HTTP ${response.status}`);
    return response;
}

function requireLink(html, href, page) {
    assert.ok(html.includes(`href="${href}"`), `${page} must link to ${href}`);
}

async function verifyPages({ base, release, download, xpiName, receiverName, xpiSha256, publishedVersion, notesPath, documentationLinks }) {
    const pages = ['index.html', 'documentation.html', 'AKTUELLER_PRODUKTSTAND.html',
        ...languages.map(language => `index_${language}.html`)];
    const loaded = await Promise.all(pages.map(async page => {
        const url = new URL(page === 'index.html' ? './' : page, base);
        url.searchParams.set('release', publishedVersion);
        return [page, await (await get(url)).text()];
    }));

    for (const [page, html] of loaded) {
        requireLink(html, release, page);
        if (page === 'index.html') {
            for (const language of languages) requireLink(html, `index_${language}.html`, page);
        }
        if (page === 'documentation.html') {
            const links = [...html.matchAll(/\bhref="([^"]+)"/g)].map(match => new URL(match[1], base).href);
            for (const target of [notesPath, ...Object.values(guides).flat()]) {
                assert.ok(links.includes(new URL(target, base).href), `${page} must link to ${target}`);
            }
        }
        if (/^index_[a-z]{2}\.html$/.test(page)) {
            requireLink(html, `${download}/${xpiName}`, page);
            requireLink(html, `${download}/SHA256SUMS.txt`, page);
            requireLink(html, `${download}/${receiverName}`, page);
            for (const target of guides[page === 'index_de.html' ? 'de' : 'en']) requireLink(html, target, page);
        }
        if (page === 'AKTUELLER_PRODUKTSTAND.html') {
            assert.ok(html.includes(xpiSha256), `${page} must list the published XPI digest`);
        }
    }

    await Promise.all(Object.values(guides).flat().map(async guide => {
        const url = new URL(guide, base);
        url.searchParams.set('release', publishedVersion);
        const response = await get(url);
        assert.match(response.headers.get('content-type') || '', /^text\/html\b/i, `${guide} must serve HTML`);
        await response.text();
    }));

    const notesUrl = new URL(notesPath, base);
    notesUrl.searchParams.set('release', publishedVersion);
    const notes = await (await get(notesUrl)).text();
    await Promise.all(documentationLinks.map(async href => {
        requireLink(notes, href, notesPath);
        const document = await get(href);
        assert.match(document.headers.get('content-type') || '', /^text\/html\b/i, `${href} must serve HTML`);
        await document.text();
    }));
}

async function main() {
    const distribution = readDistribution(path.join(__dirname, '..'), version);
    const { publishedVersion, xpiSha256 } = distribution;
    const base = new URL(process.env.PAGES_URL);
    assert.equal(base.protocol, 'https:');
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    const repository = process.env.RELEASE_REPOSITORY;
    assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
    const releaseRoot = `https://github.com/${repository}/releases`;
    const tag = `v${publishedVersion}`;
    const release = `${releaseRoot}/tag/${tag}`;
    const download = `${releaseRoot}/download/${tag}`;
    const xpiName = `thundy-av-${publishedVersion}.xpi`;
    const receiverName = `thundy-python-receiver-${publishedVersion}.zip`;
    const notesPath = `releases/${publishedVersion}.html`;
    const notesSource = readFileSync(path.join(__dirname, '../docs/releases', `${publishedVersion}.md`), 'utf8');
    const site = new URL(require('../package.json').homepage);
    const documentationLinks = Array.from(new Set(
        [...notesSource.matchAll(/\]\((https:\/\/[^\s)]+)\)/g)].map(match => match[1])
            .filter(href => href.startsWith(site.href))
    ));
    const options = { base, release, download, xpiName, receiverName, xpiSha256, publishedVersion, notesPath, documentationLinks };

    // A newly deployed revision can take time to reach the public CDN.
    for (let attempt = 1; ; attempt++) {
        try {
            await verifyPages(options);
            break;
        } catch (error) {
            if (attempt === 8) throw error;
            console.log(`Waiting for public Pages revision (${attempt}/8): ${error.message}`);
            await wait(15000);
        }
    }

    const [xpi, checksums, receiver] = await Promise.all([
        get(`${download}/${xpiName}`).then(response => response.arrayBuffer()),
        get(`${download}/SHA256SUMS.txt`).then(response => response.text()),
        get(`${download}/${receiverName}`).then(response => response.arrayBuffer()),
    ]);
    assert.equal(createHash('sha256').update(Buffer.from(xpi)).digest('hex'), xpiSha256);
    assert.equal(checksums.trim(), `${xpiSha256}  ${xpiName}`);
    assert.equal(Buffer.from(receiver).subarray(0, 4).toString('hex'), '504b0304', 'The receiver asset must be a ZIP');
    console.log(`Verified ${publishedVersion} on public Pages, six language downloads and XPI SHA-256 ${xpiSha256}`);
    console.log(`Verified ${notesPath} and ${documentationLinks.length} linked Pages documents`);
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
