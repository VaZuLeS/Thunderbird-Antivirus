/**
 * Contract tests for the store readiness decisions (see
 * docs/PROBLEMANALYSE_STORE_READINESS.md and docs/AUFGABENPLAN_STORE_READINESS.md).
 *
 * These are deliberately static assertions: they lock the decisions that a
 * reviewer checks (data collection declaration, runtime opt-in, message display
 * injection, no Manifest V2 leftovers, single packaging ignore source) so that a
 * later change cannot silently undo them.
 */
const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('store readiness contracts', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const background = read('background.js');
  const options = read('options.js');
  const api = read('api.js');

  it('declares no mandatory data collection and an opt-in type (P0-4)', () => {
    const dcp = manifest.browser_specific_settings.gecko.data_collection_permissions;
    assert.deepStrictEqual(dcp.required, ['none']);
    assert.ok(Array.isArray(dcp.optional) && dcp.optional.includes('personalCommunications'));
  });

  it('requests the optional data collection permission in a user gesture handler (P0-4)', () => {
    assert.match(options, /permissionsApi\.request\(\{ data_collection: \[DATA_COLLECTION_TYPE\] \}\)/);
    assert.match(options, /permissionsApi\.remove\(\{ data_collection: \[DATA_COLLECTION_TYPE\] \}\)/);
    assert.match(options, /addEventListener\('click', async/);
  });

  it('injects into the message display with the generic scripting API (P0-1)', () => {
    assert.match(background, /browser\.scripting\.executeScript\(\{ target: \{ tabId \}, func, args \}\)/);
    assert.doesNotMatch(background, /scripting\.messageDisplay\.executeScript/);
    assert.doesNotMatch(background, /browser\.messageDisplay\.getDisplayedMessage\(/);
    assert.doesNotMatch(background, /browser\.messageDisplay\.onMessageDisplayed\.addListener/);
    assert.doesNotMatch(api, /browser\.messageDisplay\.getDisplayedMessage\(/);
  });

  it('reports injection failures instead of swallowing them (P1-11)', () => {
    assert.match(background, /reportMessageDisplayInjectionFailure/);
    assert.match(background, /browser\.storage\.local\.set\(\{\s*messageDisplayInjectionFailed/);
    assert.match(background, /notify\('notificationTitleError', 'notificationBannerFailed'/);
  });

  it('offers a reliable user gesture fallback for the provider host permission (A-12)', () => {
    assert.match(api, /permissions\.request\(\{ origins: \[HYBRID_ANALYSIS_ORIGIN\] \}\)/);
    assert.match(api, /await renderHostPermissionNotice\(\)/);
  });

  it('routes every provider request through the ApiGateway (P2-16)', () => {
    assert.doesNotMatch(background, /await fetch\(uploadOptions\.url/);
    assert.match(background, /apiGateway\.fetchWithTimeout\(uploadOptions\.url/);
    assert.match(api, /fetchWithTimeout\(options\.url, options\)/);
  });

  it('keeps one packaging ignore source and no legacy Manifest V2 file (P3-17)', () => {
    assert.ok(!fs.existsSync(path.join(ROOT, '.webextignore')), '.webextignore must not exist');
    assert.ok(!fs.existsSync(path.join(ROOT, 'install.rdf')), 'install.rdf must not exist');
    const config = read('web-ext-config.mjs');
    assert.match(config, /'testdata'/);
    assert.match(config, /'\*\*\/\*\.test\.js'/);
  });

  it('documents the signing target for ATN instead of AMO (P1-6)', () => {
    const release = read('docs/ci/release.yml');
    assert.match(release, /--amo-base-url/);
    assert.match(release, /https:\/\/addons\.thunderbird\.net\/api\/v5\//);
    const ci = read('docs/ci/ci.yml');
    assert.match(ci, /npm test/);
    assert.match(ci, /filter-lint-warnings\.js/);
    assert.match(ci, /verify-package\.js/);
  });

  it('ships the reviewer package required for the store review (A-15/A-33)', () => {
    const notes = read('docs/reviewer_notes.md');
    assert.match(notes, /Anticipated review questions/);
    assert.ok(fs.existsSync(path.join(ROOT, 'docs', 'live_test_protocol.md')));
    assert.ok(fs.existsSync(path.join(ROOT, 'docs', 'testdata.md')));
    assert.ok(fs.existsSync(path.join(ROOT, 'testdata', '01-harmless-attachment.eml')));
  });
});
