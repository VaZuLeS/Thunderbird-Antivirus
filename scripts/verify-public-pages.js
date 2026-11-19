const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readDistribution } = require('./distribution-state.js');
const { version } = require('../manifest.json');
const path = require('node:path');
const { setTimeout: wait } = require('node:timers/promises');

const languages = ['en', 'de', 'fr', 'es', 'it', 'pl'];

async function get(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.ok, true, `${url} returned HTTP ${response.status}`);
    return response;
}

function requireLink(html, href, page) {
    assert.ok(html.includes(`href="${href}"`), `${page} must link to ${href}`);
}

async function verifyPages({ base, release, download, xpiName, xpiSha256, publishedVersion }) {
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
        if (/^index_[a-z]{2}\.html$/.test(page)) {
            requireLink(html, `${download}/${xpiName}`, page);
            requireLink(html, `${download}/SHA256SUMS.txt`, page);
        }
        if (page === 'AKTUELLER_PRODUKTSTAND.html') {
            assert.ok(html.includes(xpiSha256), `${page} must list the published XPI digest`);
        }
    }
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
    const options = { base, release, download, xpiName, xpiSha256, publishedVersion };

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

    const [xpi, checksums] = await Promise.all([
        get(`${download}/${xpiName}`).then(response => response.arrayBuffer()),
        get(`${download}/SHA256SUMS.txt`).then(response => response.text())
    ]);
    assert.equal(createHash('sha256').update(Buffer.from(xpi)).digest('hex'), xpiSha256);
    assert.equal(checksums.trim(), `${xpiSha256}  ${xpiName}`);
    console.log(`Verified ${publishedVersion} on public Pages, six language downloads and XPI SHA-256 ${xpiSha256}`);
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
