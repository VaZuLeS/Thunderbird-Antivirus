import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve(process.cwd(), 'manifest.json');
const raw = fs.readFileSync(manifestPath, 'utf8');
let manifest;
try {
  manifest = JSON.parse(raw);
} catch (e) {
  throw new Error('manifest.json is not valid JSON: ' + e.message);
}

const gecko = manifest.browser_specific_settings && manifest.browser_specific_settings.gecko;
assert.ok(gecko, 'browser_specific_settings.gecko missing in manifest.json');

const dcp = gecko.data_collection_permissions;
assert.ok(dcp, 'gecko.data_collection_permissions missing');
assert.ok(Array.isArray(dcp.required), 'data_collection_permissions.required must be an array');
assert.ok(typeof dcp.policy_url === 'string' && dcp.policy_url.length > 0, 'policy_url must be a non-empty string');

// optional may be an array of objects describing categories
assert.ok(Array.isArray(dcp.optional), 'data_collection_permissions.optional must be an array');

if (dcp.optional.length > 0) {
  for (const cat of dcp.optional) {
    assert.ok(typeof cat.name === 'string' && cat.name.length > 0, 'optional category must have a name');
    assert.ok(typeof cat.description === 'string' && cat.description.length > 0, 'optional category must have a description');
    assert.ok(cat.data_practices, 'optional category must have data_practices');
    assert.ok(Array.isArray(cat.data_practices.data_types), 'data_practices.data_types must be an array');
    assert.ok(typeof cat.data_practices.purpose === 'string' && cat.data_practices.purpose.length > 0, 'data_practices.purpose required');
    assert.ok(typeof cat.data_practices.retention === 'string', 'data_practices.retention should be a string');
    assert.ok(Array.isArray(cat.data_practices.destinations), 'data_practices.destinations must be an array');
    assert.ok(typeof cat.user_controls === 'string', 'user_controls should be a string');
  }
}

console.log('manifest gecko.data_collection_permissions structure validated');
