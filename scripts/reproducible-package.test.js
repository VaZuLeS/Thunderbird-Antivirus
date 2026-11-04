const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { buildPackage } = require('./build-and-verify-package.js');
const script = path.join(__dirname, 'reproducible-package.py');
function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thundy-repro-test-'));
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function zip(file, entries, variant = 0) {
  execFileSync('python3', ['-c', `import sys,json,zipfile
entries=json.load(sys.stdin); variant=int(sys.argv[2])
with zipfile.ZipFile(sys.argv[1],'w') as z:
 z.comment=b'variable comment' if variant else b''
 for name,body in entries:
  i=zipfile.ZipInfo(name,(2026 if variant else 2001,2,3,4,5,6))
  i.create_system=3; i.external_attr=(0o100777 if variant else 0o100600)<<16
  i.comment=b'entry comment' if variant else b''; i.compress_type=zipfile.ZIP_STORED if variant else zipfile.ZIP_DEFLATED
  z.writestr(i,body.encode('utf-8'))
`, file, String(variant)], { stdio: 'pipe', input: JSON.stringify(entries) });
}
function normalize(input, output, tz = 'UTC') {
  return spawnSync('python3', [script, input, output], { encoding: 'utf8', env: { ...process.env, TZ: tz } });
}
test('equal payloads yield identical bytes despite ordering, timestamps, permissions, comments, compression and timezone', () => fixture(root => {
  const entries = [['manifest.json','{"version":"1.24.4"}'], ['_locales/pl/messages.json','Zażółć gęślą jaźń'], ['img/binary.dat','\0\u00ff\r\n']];
  const a=path.join(root,'a.zip'), b=path.join(root,'b.zip'), ca=path.join(root,'ca.zip'), cb=path.join(root,'cb.zip');
  zip(a, entries); zip(b, entries.slice().reverse(), 1);
  const beforeA=fs.readFileSync(a),beforeB=fs.readFileSync(b);
  assert.notDeepEqual(beforeA,beforeB);
  assert.equal(normalize(a,ca,'Pacific/Honolulu').status,0);
  assert.equal(normalize(b,cb,'Europe/Berlin').status,0);
  assert.deepEqual(fs.readFileSync(ca),fs.readFileSync(cb));
  assert.deepEqual(fs.readFileSync(a),beforeA); assert.deepEqual(fs.readFileSync(b),beforeB);
  execFileSync('python3',['-c',`import zipfile,sys,json
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.namelist()==sorted(z.namelist())
 assert not z.comment
 for i in z.infolist():
  assert i.date_time==(1980,1,1,0,0,0) and i.external_attr>>16==0o100644
  assert not i.extra and not i.comment and i.compress_type==zipfile.ZIP_DEFLATED
 assert z.read('_locales/pl/messages.json').decode('utf-8')=='Zażółć gęślą jaźń'
`,ca]);
}));
test('actual payload changes change the candidate and do not alter earlier candidates', () => fixture(root => {
  const input=path.join(root,'input.zip'),a=path.join(root,'a.zip'),b=path.join(root,'b.zip');
  zip(input,[['manifest.json','original']]);assert.equal(normalize(input,a).status,0);const before=fs.readFileSync(a);
  zip(input,[['manifest.json','changed']]);assert.equal(normalize(input,b).status,0);
  assert.notDeepEqual(before,fs.readFileSync(b));assert.deepEqual(fs.readFileSync(a),before);
}));
test('signed metadata, duplicate names, unsafe paths, symlinks and excessive payloads cannot become candidates', () => fixture(root => {
  for (const entries of [
    [['META-INF/mozilla.rsa','signature']], [['meta-inf/manifest.mf','signature']],
    [['manifest.json','one'],['manifest.json','two']], [['../escape','data']],
    [['/absolute','data']], [['folder\\escape','data']], [['a/./b','data']],
    Array.from({length:1025},(_,i)=>['file-'+i,'']),
    [['manifest.json','x'.repeat(1000*1024+1)]]
  ]) {
    const input=path.join(root,'input.zip'),output=path.join(root,'output.zip');zip(input,entries);
    const r=normalize(input,output);assert.notEqual(r.status,0);assert.equal(fs.existsSync(output),false);
  }
  const input=path.join(root,'link.zip'),output=path.join(root,'output.zip');
  execFileSync('python3',['-c',`import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w') as z:
 i=zipfile.ZipInfo('link');i.create_system=3;i.external_attr=0o120777<<16;z.writestr(i,'target')
`,input]);
  assert.notEqual(normalize(input,output).status,0);assert.equal(fs.existsSync(output),false);
  // A readable ZIP header with corrupted file bytes must not pass CRC validation.
  zip(input,[['manifest.json','payload']],1);
  const bytes=fs.readFileSync(input),start=30+bytes.readUInt16LE(26)+bytes.readUInt16LE(28);
  bytes[start]^=1;fs.writeFileSync(input,bytes);
  assert.notEqual(normalize(input,output).status,0);assert.equal(fs.existsSync(output),false);
}));
test('canonicalization never overwrites existing outputs or its own input and rejects corrupt archives', () => fixture(root => {
  const input=path.join(root,'input.zip'),output=path.join(root,'output.zip');zip(input,[['manifest.json','data']]);
  const original=fs.readFileSync(input);fs.writeFileSync(output,'existing candidate');
  assert.notEqual(normalize(input,output).status,0);assert.equal(fs.readFileSync(output,'utf8'),'existing candidate');
  assert.notEqual(normalize(input,input).status,0);assert.deepEqual(fs.readFileSync(input),original);
  fs.unlinkSync(output);fs.writeFileSync(input,'not a ZIP');
  assert.notEqual(normalize(input,output).status,0);assert.equal(fs.existsSync(output),false);
}));
test('missing or failing pinned local tools leave no stale candidate and never fall back to a downloader', () => fixture(root => {
  fs.mkdirSync(path.join(root,'build'));fs.writeFileSync(path.join(root,'build','old.zip'),'stale');
  assert.throws(()=>buildPackage(root),/Pinned local web-ext is missing/);
  assert.equal(fs.existsSync(path.join(root,'build')),false);
  const cli=path.join(root,'node_modules/web-ext/bin/web-ext.js');fs.mkdirSync(path.dirname(cli),{recursive:true});
  fs.writeFileSync(cli,'process.exit(17);');
  assert.throws(()=>buildPackage(root),/Package subprocess failed/);
  assert.equal(fs.existsSync(path.join(root,'build')),false);
}));
