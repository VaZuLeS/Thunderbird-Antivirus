"""Real IndexedDB concurrency and startup-failure probes in an isolated profile."""
import hashlib
from pathlib import Path


def check(m, report):
    installed_source = m.page('''return (async()=>{const raw=await window.wrappedJSObject.browser.runtime.getBackgroundPage();return (raw.wrappedJSObject||raw).getSharedDB.toString();})();''')
    # Execute the installed function unchanged in an isolated closure. Factories
    # target a private native DB; no product singleton or product schema is reset.
    startup = m.page('''return (async()=>{
      const raw=await (window.wrappedJSObject||window).browser.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;
      const owned=[];let sharedDBPromise=null,version=3,cleanups=0,opens=0;
      const cleanupError=new Error('injected cleanup transaction abort');
      const openDB=async()=>{opens++;const db=await bg.openDB('thundy_startup_probe',version);owned.push(db);return db;};
      const pruneStore=async db=>{if(++cleanups!==1)return bg.pruneStore(db,'hybridanalysis');await new Promise((resolve,reject)=>{const tx=db.transaction(['hybridanalysis'],'readwrite');tx.onabort=()=>reject(cleanupError);tx.abort();});};
    ''' + installed_source + '''
      try{
        const first=getSharedDB(),same=getSharedDB();let originalErrorPreserved=false;
        try{await first;}catch(error){originalErrorPreserved=error===cleanupError;}
        let blocked=false;
        const upgraded=await new Promise((resolve,reject)=>{const request=bg.indexedDB.open('thundy_startup_probe',4);request.onblocked=()=>{blocked=true;for(const db of owned)db.close();};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});upgraded.close();version=4;
        const recovered=await getSharedDB(),cached=await getSharedDB();
        return {sameFailurePromise:first===same,originalErrorPreserved,upgradeUnblocked:!blocked,retrySucceeded:!!recovered,retryCached:recovered===cached,openedTwice:opens===2,cleanupRetried:cleanups===2};
      }finally{for(const db of owned)db.close();}
    })();''', sandbox=None)
    report['storageConcurrency'] = {'passed': False, 'helperSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'startup': startup,
        'scope': 'Installed getSharedDB source in an isolated closure; real IndexedDB connections and injected cleanup abort; private test DB upgrade only.'}
    assert all(startup.values()), startup
    parallel = m.page('''return (async()=>{
      const raw=await (window.wrappedJSObject||window).browser.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;
      const one=await bg.openDB('thundy_parallel_probe',3),two=await bg.openDB('thundy_parallel_probe',3),now=Date.now();
      const seed=key=>({messageHeader:key,updatedAt:now,attachments:[{partName:'1.2',state:'KNOWN',report:{verdict:'malicious',revision:0}}],links:[]});
      const replace=(key,revision,db=one)=>bg.updateStore(db,'hybridanalysis',key,record=>{record.attachments[0].report={verdict:'unknown',revision};return record;},{preserveReports:true});
      try{
        await bg.updateStore(one,'hybridanalysis','parallel',()=>seed('parallel'));
        await Promise.all([replace('parallel',1,one),replace('parallel',2,two)]);
        const record=await bg.getFromStore(one,'hybridanalysis','parallel'),revisions=[...record.analysisReportArchive.entries.map(e=>e.resource.report.revision),record.attachments[0].report.revision].sort();
        let requestSucceeded=false,aborted=false;
        const facade={transaction(...args){const tx=one.transaction(...args),store=tx.objectStore('hybridanalysis');return {
          get error(){return tx.error;},set oncomplete(fn){tx.oncomplete=fn;},set onerror(fn){tx.onerror=fn;},set onabort(fn){tx.onabort=fn;},abort(){tx.abort();},
          objectStore(){return {get:key=>store.get(key),put(value){const req=store.put(value);req.addEventListener('success',()=>{requestSucceeded=true;tx.abort();},{once:true});return req;}};}};}};
        await bg.updateStore(one,'hybridanalysis','abort-then-write',()=>seed('abort-then-write'));
        const failed=replace('abort-then-write',9,facade).catch(()=>{aborted=true;});
        const following=replace('abort-then-write',1,two);await Promise.all([failed,following]);
        const recovered=await bg.getFromStore(one,'hybridanalysis','abort-then-write');
        await bg.updateStore(one,'hybridanalysis','refresh-before-prune',()=>({...seed('refresh-before-prune'),updatedAt:now-31*86400000}));
        await Promise.all([bg.updateStore(one,'hybridanalysis','refresh-before-prune',record=>({...record,updatedAt:now})),bg.pruneStore(two,'hybridanalysis',now)]);
        const refreshed=await bg.getFromStore(one,'hybridanalysis','refresh-before-prune');
        return {twoNativeConnections:one!==two,bothRevisionsRetained:JSON.stringify(revisions)==='[0,1,2]',distinctArchiveIds:new Set(record.analysisReportArchive.entries.map(e=>e.id)).size===2,
          requestSucceededBeforeAbort:requestSucceeded,firstWriterAborted:aborted,followingWriterCommitted:recovered.attachments[0].report.revision===1,
          abortedRevisionNotArchived:JSON.stringify(recovered.analysisReportArchive.entries.map(e=>e.resource.report.revision))==='[0]',refreshBeforePruneRetained:refreshed?.updatedAt===now};
      }finally{one.close();two.close();}
    })();''', sandbox=None)
    report['storageConcurrency']['parallel'] = parallel
    assert all(parallel.values()), parallel
    report['storageConcurrency'].update(passed=True, realIndexedDB=True, realThunderbirdEngine=True, syntheticRecords=True, liveProviderCalls=False,
        scope='Installed product DAO and startup function; two native DB connections, concurrent report replacement, abort followed by write, refresh before cleanup. Not a migration or disk-failure test.')
