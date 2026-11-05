// Optional preload for controlled local CLI probes. Observe calls, never alter
// arguments/results or record source text, pattern values or manifest values.
const fs=require('node:fs'),Module=require('node:module');
const output=process.env.THUNDY_TOOLCHAIN_PROBE_OUT;
if(!output)throw new Error('THUNDY_TOOLCHAIN_PROBE_OUT is required');
const compile=Module.prototype._compile,wrappers=new WeakMap(),observations={};
function observe(name,args){
 const row=observations[name]||= {calls:0,maxPatternCharacters:0,maxPatternParts:0,ownProtoKeys:0,protoSymbols:0,callSites:[]};
 row.calls++;
 if(name.startsWith('minimatch')){
  const pattern=args[/\.(Minimatch|filter|makeRe|braceExpand)$/.test(name)?0:1];
  if(typeof pattern==='string'){
   row.maxPatternCharacters=Math.max(row.maxPatternCharacters,pattern.length);
   row.maxPatternParts=Math.max(row.maxPatternParts,pattern.split('/').length);
  }
 }else{
  for(const value of args.slice(0,2))if(value&&typeof value==='object'){
   if(Object.hasOwn(value,'__proto__'))row.ownProtoKeys++;
   row.protoSymbols+=Object.getOwnPropertySymbols(value).filter(key=>key.description==='__proto__').length;
  }
 }
 const sites=(new Error().stack||'').match(/node_modules\/(?:web-ext|addons-linter|eslint|@eslint|multimatch)\/[^\s)]+/g)||[];
 for(const site of sites)if(row.callSites.length<16&&!row.callSites.includes(site))row.callSites.push(site);
}
function wrap(value,name){
 if(typeof value!=='function')return value;
 if(wrappers.has(value))return wrappers.get(value);
 const proxy=new Proxy(value,{
  apply(target,receiver,args){observe(name,args);return Reflect.apply(target,receiver,args);},
  construct(target,args,newTarget){observe(name,args);return Reflect.construct(target,args,newTarget);},
  get(target,key,receiver){
   const child=Reflect.get(target,key,receiver);
   return ['Minimatch','all','match','filter','makeRe','braceExpand'].includes(key)?wrap(child,name+'.'+key):child;
  }
 });
 wrappers.set(value,proxy);return proxy;
}
Module.prototype._compile=function(content,filename){
 const result=Reflect.apply(compile,this,arguments);
 // Observe CJS exports even when an ESM consumer loads them through Node's
 // CJS translator instead of Module._load.
 const name=filename.replaceAll('\\','/').match(/\/node_modules\/(deepmerge|minimatch)\/(?:index|minimatch|dist\/cjs)\.js$/)?.[1];
 if(name)this.exports=wrap(this.exports,name);
 return result;
};
process.on('exit',code=>fs.writeFileSync(output,JSON.stringify({schemaVersion:1,node:process.version,exitCode:code,observations,scope:'Controlled CLI observation; no exploit proof or general reachability guarantee'},null,2)+'\n',{flag:'wx',mode:0o600}));
