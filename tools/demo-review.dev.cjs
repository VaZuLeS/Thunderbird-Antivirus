// Browser verification of the separate simulation. No extension API or real mail.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
(async () => {
    const origin = 'http://127.0.0.1:4178';
    const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { cwd: root, stdio: 'ignore' });
    let browser;
    try {
        let ready = false;
        for (let i = 0; i < 100; i++) {
            try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
            if (server.exitCode !== null) throw new Error('Demo server exited');
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.ok(ready, 'demo server readiness');
        browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        const context = await browser.newContext();
        const legacy = { id: 'legacy-demo', clickedAt: Date.now(), decidedAt: Date.now(), messageId: 'synthetic', url: 'https://example.invalid/old', score: 12, verdict: 'UNKNOWN', provider: 'none', reasons: [], outcome: 'OPENED', openAttempts: 1, extensionVersion: '1.23.0' };
        await context.addInitScript(record => { localStorage.setItem('thundy_linkAuditLog', JSON.stringify([record])); }, legacy);
        const page = await context.newPage();
        const external = [];
        await context.route('**/*', route => {
            if (route.request().url().startsWith(origin + '/')) return route.continue();
            external.push(route.request().url()); return route.abort();
        });
        await page.goto(origin);
        await page.getByRole('note', { name: 'Demo' }).waitFor();
        assert.match(await page.getByRole('note').textContent(), /synthetic decisions/);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        assert.ok(await page.locator('input[type=password]').count() >= 4);
        assert.equal(await page.locator('input[type=password]:enabled').count(), 0);
        await page.getByRole('button', { name: 'Message Scanner', exact: true }).click();
        await page.getByRole('button', { name: /Extracted Links/ }).click();
        await page.getByRole('button', { name: 'Test Link Protection', exact: true }).first().click();
        await page.getByRole('button', { name: 'Simulate opening request', exact: true }).click();
        const records = await page.evaluate(() => JSON.parse(localStorage.getItem('thundy_linkAuditLog')));
        assert.equal(records[0].outcome, 'SIMULATED_OPEN'); assert.equal(records[0].openAttempts, 0); assert.equal(records[0].simulation, true);
        assert.deepEqual(records.find(record => record.id === legacy.id), legacy);
        assert.equal(context.pages().length, 1); assert.deepEqual(external, []);
        console.log(JSON.stringify({ kind: 'separate-web-demo-review', passed: true, realThunderbird: false, simulatedOutcome: records[0].outcome, realOpeningAttempts: records[0].openAttempts, legacyDemoPreserved: true, providerInputsDisabled: true, externalRequests: 0 }, null, 2));
    } finally {
        await browser?.close();
        server.kill('SIGTERM');
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
