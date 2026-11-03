const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('runtime.js','utf8');
function fixture(){
 let now=0,next=1;const timers=new Map(),removed=[];
 const context=vm.createContext({setTimeout:(fn,delay)=>{const id=next++;timers.set(id,{fn,at:now+delay});return id},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source+'\nglobalThis.Cache=ExpiringMap;',context);
 return {Cache:context.Cache,removed,timers,clock:()=>now,advance(value){now=value;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}}};
}
test('expiry applies to size, every iterator and forEach without looking up individual keys',()=>{
 for(const access of ['size','keys','values','entries','iterator','forEach']){
  const f=fixture(),cache=new f.Cache(10,f.clock);cache.set('a',1).set('b',2);f.advance(11);
  let result;if(access==='size')result=cache.size;else if(access==='iterator')result=[...cache].length;else if(access==='forEach'){result=0;cache.forEach(()=>result++)}else result=[...cache[access]()].length;
  assert.equal(result,0,access);assert.equal(cache.expires.size,0);
 }
});
test('idle expiry uses a single timer, disposes exactly once and leaves no owned timer',()=>{
 const f=fixture(),removed=[];const cache=new f.Cache(10,f.clock,{autoExpire:true,onEvict:(v,k,reason)=>removed.push({v,k,reason})});
 cache.set('a',1);f.advance(5);cache.set('b',2);assert.equal(f.timers.size,1);
 f.advance(10);assert.deepEqual(removed,[{v:1,k:'a',reason:'expired'}]);assert.equal(cache.size,1);assert.equal(f.timers.size,1);
 f.advance(15);assert.equal(cache.size,0);assert.equal(f.timers.size,0);assert.equal(removed.length,2);
 cache.clear();assert.equal(removed.length,2);
});
test('capacity, explicit deletion, replacement and clear dispose their own values; touch preserves active work',()=>{
 const f=fixture(),removed=[];const cache=new f.Cache(10,f.clock,{maxSize:2,autoExpire:true,onEvict:(value,key,reason)=>removed.push([value,key,reason])});
 cache.set('a',1).set('b',2);f.advance(5);assert.equal(cache.touch('a'),true);cache.set('c',3);
 assert.deepEqual(removed,[[2,'b','capacity']]);assert.equal(cache.get('a'),1);
 f.advance(11);assert.equal(cache.get('a'),1);assert.equal(cache.get('c'),3);
 cache.set('a',4);cache.delete('c');cache.clear();
 assert.deepEqual(removed.slice(1),[[1,'a','replaced'],[3,'c','deleted'],[4,'a','cleared']]);assert.equal(f.timers.size,0);
});
test('cleanup callback failure does not stop expiry or leak the idle timer',()=>{
 const f=fixture();let count=0;const cache=new f.Cache(10,f.clock,{autoExpire:true,onEvict:()=>{count++;throw Error('cleanup')}});
 cache.set('a',1).set('b',2);f.advance(10);assert.equal(count,2);assert.equal(cache.size,0);assert.equal(f.timers.size,0);
});
