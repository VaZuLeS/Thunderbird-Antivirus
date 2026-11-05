const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {assessReport,isKnownFalsePositive}=require('./filter-lint-warnings.js');
const {assessLintRun,runLint}=require('./lint-with-filter.js');
function report(errors=[],warnings=[],notices=[]){return {count:errors.length+warnings.length+notices.length,summary:{errors:errors.length,warnings:warnings.length,notices:notices.length},metadata:{manifestVersion:3},errors,warnings,notices};}
const known={_type:'warning',code:'UNSUPPORTED_API',message:'messages.getFull is not supported'};

function localCli(source, check) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'thundy-tool-limits-'));
 try {
  const cli=path.join(root,'node_modules/web-ext/bin/web-ext.js');
  fs.mkdirSync(path.dirname(cli),{recursive:true});fs.writeFileSync(cli,source);
  return check(root);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
}

test('a real local lint subprocess cannot pass with valid JSON followed by a hang',()=>{
 const clean=JSON.stringify(report([],[known]));
 localCli(`require('node:fs').writeSync(1,${JSON.stringify(clean)});process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`,root=>{
  const result=runLint(root,{timeoutMs:1000});
  assert.equal(result.error?.code,'ETIMEDOUT');assert.equal(result.signal,'SIGKILL');
  assert.equal(result.stdout,clean);assert.throws(()=>assessLintRun(result),/did not complete normally/);
 });
});

test('excessive output from a real local lint subprocess fails instead of accepting a truncated report',()=>{
 localCli("const fs=require('node:fs'),chunk=Buffer.alloc(65536,32);for(let i=0;i<100;i++)fs.writeSync(1,chunk);",root=>{
  const result=runLint(root,{timeoutMs:5000,maxBuffer:65536});
  assert.equal(result.error?.code,'ENOBUFS');assert.throws(()=>assessLintRun(result),/did not complete normally/);
 });
});

test('bounded local lint still accepts complete reports and rejects actual error reports',()=>{
 for(const [value,exit,accepted] of [[report([],[known]),0,true],[report([{code:'BAD_MANIFEST',message:'Invalid manifest'}]),1,false]]){
  localCli(`process.stdout.write(${JSON.stringify(JSON.stringify(value))});process.exitCode=${exit};`,root=>{
   const result=runLint(root);assert.equal(result.error,undefined);assert.equal(assessLintRun(result).accepted,accepted);
  });
 }
});

test('lint schema rejects missing, mistyped or inconsistent reports instead of treating them as clean',()=>{
 const bad=[null,[],{},true,{errors:[],warnings:[]}];
 for(const edit of [r=>delete r.notices,r=>r.metadata=[],r=>r.summary.warnings=1,r=>r.summary.errors=-1,r=>r.count=1,r=>r.count=0.5,r=>r.errors={},r=>r.summary=null]){const r=report();edit(r);bad.push(r);}
 for(const item of [null,{},'warning',{code:1,message:'text'},{code:'',message:'text'},{code:'X',message:''},{code:'X',message:4},{...known,_type:'error'}])bad.push(report([],[item]));
 for(const value of bad)assert.throws(()=>assessReport(value),/Incomplete or inconsistent/);
 assert.equal(assessReport(report()).accepted,true);
 assert.equal(assessReport(report([],[],[{_type:'notice',code:'EMPTY_FILE',message:'Empty file'}])).accepted,true);
});
test('only exact documented Thunderbird exceptions are accepted, including correct diagnostic categories',()=>{
 for(const api of ['messages.get','messages.getFull','messages.query','messages.listAttachments','messages.getAttachmentFile','messageDisplay.getDisplayedMessages','messageDisplay.onMessagesDisplayed','windows.openDefaultBrowser','scripting.messageDisplay','scripting.messageDisplay.register','scripting.messageDisplay.unregister'])assert.equal(isKnownFalsePositive({code:'UNSUPPORTED_API',message:api+' is not supported'}),true,api);
 assert.equal(isKnownFalsePositive({code:'MANIFEST_PERMISSIONS',message:'/permissions: Invalid permissions "messagesRead" at 0.'}),true);
 assert.equal(isKnownFalsePositive({code:'MANIFEST_OPTIONAL_PERMISSIONS',message:'/optional_permissions: Invalid optional_permissions "sensitiveDataUpload" at 0.'}),true);
 for(const warning of [
  {code:'UNSUPPORTED_API',message:'messages.getFullExtra is not supported'},
  {code:'UNSUPPORTED_API',message:'tabs.executeScript is not supported; messages.getFull'},
  {code:'UNSUPPORTED_API',message:'messageDisplay.getDisplayedMessage is not supported'},
  {code:'MANIFEST_PERMISSIONS',message:'/permissions: Invalid permissions "messagesReadExtra" at 0.'},
  {code:'MANIFEST_OPTIONAL_PERMISSIONS',message:'/optional_permissions: Invalid optional_permissions "sensitiveDataUploadExtra" at 0.'},
  {code:'INLINE_SCRIPT',message:'messages.getFull is not supported'},
 ])assert.equal(assessReport(report([],[warning])).accepted,false,warning.message);
});
test('errors are never suppressed by a known warning exception and valid unknown warnings still fail',()=>{
 assert.equal(assessReport(report([{...known,_type:'error'}])).accepted,false);
 assert.equal(assessReport(report([],[known])).accepted,true);
 assert.equal(assessReport(report([],[{code:'NEW_WARNING',message:'A new scanner rule'}])).accepted,false);
});
test('invocation errors, signals and nonzero success-shaped output cannot become successful lint results',()=>{
 const clean=JSON.stringify(report([],[known])),failure=JSON.stringify(report([{code:'BAD_MANIFEST',message:'Invalid manifest'}]));
 assert.equal(assessLintRun({status:0,stdout:clean}).accepted,true);
 assert.equal(assessLintRun({status:1,stdout:failure}).accepted,false);
 assert.equal(assessLintRun({status:0,stdout:failure}).accepted,false);
 for(const result of [{status:0,stdout:''},{status:0,stdout:'{}'},{status:0,stdout:'not JSON'},{status:1,stdout:clean},{status:2,stdout:failure},{status:null,stdout:clean},{status:0,signal:'SIGTERM',stdout:clean},{status:0,error:new Error('spawn failed'),stdout:clean}])assert.throws(()=>assessLintRun(result));
});
test('the actual report CLI fails closed for malformed and misleading files and preserves legitimate success',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thundy-lint-gate-'));
 try{
  const cases=[['empty',{},1],['clean',report([],[known]),0],['error',report([{...known,_type:'error'}]),1],['unexpected',report([],[{code:'INLINE_SCRIPT',message:'Inline script'}]),1],['counts',{...report(),count:3},1]];
  for(const [name,value,status] of cases){const file=path.join(dir,name+'.json');fs.writeFileSync(file,JSON.stringify(value));const run=spawnSync(process.execPath,[path.join(__dirname,'filter-lint-warnings.js'),file],{encoding:'utf8'});assert.equal(run.status,status,name);assert.equal(run.stdout.includes('Lint ok:'),status===0,name);}
  const absent=spawnSync(process.execPath,[path.join(__dirname,'filter-lint-warnings.js'),path.join(dir,'absent.json')],{encoding:'utf8'});assert.equal(absent.status,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
