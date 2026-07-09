const fs = require('fs');
const path = require('path');

function fail(msg){
  console.error('PRE-SUBMIT CHECK FAILED:', msg);
  process.exitCode = 2;
}

function ok(msg){
  console.log('ok:', msg);
}

try{
  const repoRoot = path.resolve(__dirname, '..');
  const manifestPath = path.join(repoRoot, 'manifest.json');
  if(!fs.existsSync(manifestPath)) fail('manifest.json missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));

  if(!manifest.homepage_url || manifest.homepage_url.trim()==='') fail('manifest.homepage_url is empty');
  else ok('homepage_url present');

  // privacy policy check: repo should have docs/privacy_policy.md
  const pp = path.join(repoRoot, 'docs','privacy_policy.md');
  if(!fs.existsSync(pp)) fail('docs/privacy_policy.md missing');
  else ok('privacy policy present');

  // optional_permissions sanity
  const opt = manifest.optional_permissions || manifest.host_permissions || [];
  if(!Array.isArray(opt) || opt.length===0) console.warn('warning: no optional_permissions/host_permissions declared — runtime host requests may be rejected by reviewers');
  else ok('optional_permissions/host_permissions present');

  // banned permissions
  const banned = ['webRequest','<all_urls>'];
  const perms = manifest.permissions || [];
  banned.forEach(p=>{ if(perms.includes(p)) fail(`forbidden permission found in manifest.permissions: ${p}`); });

  // check that optional host entries are https origins
  const httpsBad = (opt||[]).filter(x=>typeof x==='string' && !x.startsWith('https://'));
  if(httpsBad.length>0) fail('optional_permissions contains non-HTTPS origins: '+httpsBad.join(','));
  else ok('optional_permissions use HTTPS origins');

  console.log('\nPre-submit checks passed (exit code 0).');
  process.exit(0);
} catch(e){
  fail('exception during checks: '+e.message);
  console.error(e);
}
