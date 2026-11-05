// Compare installed public linter CLIs on the exact XPI and controlled canaries.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {runTool}=require('../scripts/tool-process.js');
const {assessLintRun}=require('../scripts/lint-with-filter.js');
const [oldCli,newCli,packageFile,output]=process.argv.slice(2);
if(!oldCli||!newCli||!packageFile||!output)throw new Error('Usage: node tools/linter-compatibility.dev.cjs OLD_CLI NEW_CLI PACKAGE NEW_DIRECTORY');
const out=path.resolve(output);fs.mkdirSync(out,{mode:0o700});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest={manifest_version:3,name:'Linter compatibility fixture',version:'1.0',browser_specific_settings:{gecko:{id:'linter-fixture@example.invalid',strict_min_version:'140.0',data_collection_permissions:{required:['none']}}}};
const cases=[{name:'candidate',target:path.resolve(packageFile),accepted:true}];
for(const [name,edit,files,accepted] of [
 ['clean',()=>{},{},true],
 ['empty-script',m=>m.background={scripts:['empty.js']},{'empty.js':''},true],
 ['permission-lookalike',m=>m.permissions=['messagesReadExtra'],{},false],
 ['bad-manifest',m=>m.manifest_version=99,{},false],
 ['unsafe-script',m=>m.background={scripts:['unsafe.js']},{'unsafe.js':'eval(window.name);\n'},false],
 ['inline-script',m=>m.options_ui={page:'options.html'},{'options.html':'<!doctype html><script>window.alert("fixture");</script>'},false],
]){
 const target=path.join(out,name);fs.mkdirSync(target,{mode:0o700});const copy=structuredClone(manifest);edit(copy);fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(copy,null,2));
 for(const [file,data] of Object.entries(files))fs.writeFileSync(path.join(target,file),data);
 cases.push({name,target,accepted});
}
const results=[];
for(const cli of [oldCli,newCli]){
 const absolute=path.resolve(cli),pkg=JSON.parse(fs.readFileSync(path.resolve(absolute,'../../package.json'),'utf8'));assert.equal(pkg.name,'addons-linter');
 for(const entry of cases){
  const run=runTool(process.execPath,[absolute,'--output','json',entry.target]);
  fs.writeFileSync(path.join(out,pkg.version+'-'+entry.name+'.json'),run.stdout||'');
  let assessment,error;try{assessment=assessLintRun(run);}catch(e){error=e.message;}
  results.push({version:pkg.version,case:entry.name,status:run.status,expectedAccepted:entry.accepted,accepted:assessment?.accepted===true,reportContractValid:!!assessment,summary:assessment?.report.summary,codes:assessment?[...assessment.report.errors,...assessment.report.warnings,...assessment.report.notices].map(item=>item.code):[],...(error?{error}:{}),stdoutSha256:sha(run.stdout||'')});
 }
}
const passed=results.every(r=>r.reportContractValid&&r.accepted===r.expectedAccepted);
const report={schemaVersion:1,kind:'isolated-linter-compatibility',passed,packageSha256:sha(fs.readFileSync(packageFile)),node:process.version,results,scope:'Public CLI scans of exact development package and synthetic canaries; no web-ext dependency override or security clearance.'};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));if(!passed)process.exitCode=1;
