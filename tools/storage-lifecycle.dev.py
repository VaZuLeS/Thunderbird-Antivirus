"""Native retention/abort/restore probes; synthetic records in an isolated profile."""
import hashlib
import imaplib
import json
import runpy
from pathlib import Path
import shutil


def check(m, base, out, report, restart, fixture):
    def options():
        m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [base + 'options.html'])
        # The existing Marionette page actor waits for the document below.
        from time import monotonic, sleep
        deadline = monotonic() + 20
        while monotonic() < deadline:
            if m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.endsWith("/options.html");'):
                try:
                    if m.page('return document.readyState==="complete";'):
                        return
                except RuntimeError:
                    pass
            sleep(0.1)
        raise TimeoutError('Storage options page did not load')

    options()
    runpy.run_path(str(Path(__file__).with_name('storage-concurrency.dev.py')))['check'](m, report)
    seeded = m.page('''return (async()=>{
      const b=(window.wrappedJSObject||window).browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw,db=await bg.getSharedDB();
      const audit=(await b.storage.local.get('linkAuditLog')).linkAuditLog;
      for(const [name,age] of [['old',31],['fresh',0],['future',-2]])await bg.updateStore(db,'hybridanalysis','storage-probe-'+name,()=>({messageHeader:'storage-probe-'+name,updatedAt:Date.now()-age*86400000,attachments:[],links:[]}));
      // Reusing the existing connection deliberately does not trigger a new cleanup.
      return {longSessionKeepsAgedRecord:!!await bg.getFromStore(await bg.getSharedDB(),'hybridanalysis','storage-probe-old'),audit};
    })();''')
    assert seeded['longSessionKeepsAgedRecord']
    m.js('for(const tab of [...window.gTabmail.tabInfo])if(tab.mode.name==="mailMessageTab"||tab.browser?.currentURI.spec.startsWith("moz-extension:"))window.gTabmail.closeTab(tab);')
    m = restart()
    options()
    cold = m.page('''return (async()=>{const b=(window.wrappedJSObject||window).browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw,db=await bg.getSharedDB();
      const old=await bg.getFromStore(db,'hybridanalysis','storage-probe-old'),fresh=await bg.getFromStore(db,'hybridanalysis','storage-probe-fresh'),future=await bg.getFromStore(db,'hybridanalysis','storage-probe-future');
      return {expiredRemoved:!old,freshRetained:!!fresh,futureRetained:!!future,audit:(await b.storage.local.get('linkAuditLog')).linkAuditLog};})();''')
    assert cold['expiredRemoved'] and cold['freshRetained'] and cold['futureRetained']
    assert cold['audit'] == seeded['audit']
    probe = m.page('''return (async()=>{
      const b=(window.wrappedJSObject||window).browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw,db=await bg.openDB('thundy_storage_probe',3),now=Date.now();let stage='cleanup';
      try {
        await bg.clearStore(db,'hybridanalysis');
        await bg.updateStore(db,'hybridanalysis','clock',()=>({messageHeader:'clock',updatedAt:now-30.5*86400000,attachments:[],links:[]}));
        await bg.pruneStore(db,'hybridanalysis',now-86400000);const backwardKeeps=!!await bg.getFromStore(db,'hybridanalysis','clock');
        await bg.pruneStore(db,'hybridanalysis',now);const forwardRemoves=!await bg.getFromStore(db,'hybridanalysis','clock');
        await new Promise((resolve,reject)=>{const tx=db.transaction(['hybridanalysis'],'readwrite'),store=tx.objectStore('hybridanalysis');for(let i=0;i<1002;i++)store.put({messageHeader:'capacity-'+i,updatedAt:now+i,attachments:[],links:[]});store.put({messageHeader:'unreadable',updatedAt:1,attachments:[null]});tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||Error('Seed transaction failed'));});
        await bg.pruneStore(db,'hybridanalysis',now);
        const oldestGone=!await bg.getFromStore(db,'hybridanalysis','capacity-0')&&!await bg.getFromStore(db,'hybridanalysis','capacity-1'),retained=!!await bg.getFromStore(db,'hybridanalysis','capacity-2')&&!!await bg.getFromStore(db,'hybridanalysis','capacity-1001'),unreadableRetained=!!await bg.getFromStore(db,'hybridanalysis','unreadable');
        const original={messageHeader:'atomic',updatedAt:now,attachments:[{partName:'1.2',state:'KNOWN',hybrid_sha256:'a'.repeat(64),report:{verdict:'malicious',original:true}}]};
        await bg.updateStore(db,'hybridanalysis','atomic',()=>original);
        stage='abort';let requestSucceeded=false,aborted=false,abortError=null;
        // Only the failure boundary is injected; get/put/abort are actual IndexedDB operations.
        const facade={transaction(...args){const tx=db.transaction(...args),store=tx.objectStore('hybridanalysis');return {
          get error(){return tx.error;},set oncomplete(fn){tx.oncomplete=fn;},set onerror(fn){tx.onerror=fn;},set onabort(fn){tx.onabort=fn;},abort(){tx.abort();},
          objectStore(){return {get:key=>store.get(key),put(value){const request=store.put(value);request.addEventListener('success',()=>{requestSucceeded=true;tx.abort();},{once:true});return request;}};}
        };}};
        try{await bg.updateStore(facade,'hybridanalysis','atomic',record=>{record.attachments[0].report={verdict:'none',replacement:true};return record;},{preserveReports:true});}catch(error){aborted=true;abortError=error.message||String(error);}
        stage='read-after-abort';const atomicPreserved=JSON.stringify(await bg.getFromStore(db,'hybridanalysis','atomic'))===JSON.stringify(original);
        stage='archive';const large={messageHeader:'byte-limit',updatedAt:now,attachments:[{partName:'1.2',state:'KNOWN',report:{verdict:'malicious',padding:'x'.repeat(1024*1024)}}],analysisReportArchive:{schemaVersion:1,entries:[{id:'old-large-revision',kind:'link',slot:0,archivedAt:now,resource:{report:{verdict:'unknown',padding:'y'.repeat(1536*1024)}}}]}};
        await bg.updateStore(db,'hybridanalysis','byte-limit',()=>large);let byteLimitRefused=false;
        try{await bg.updateStore(db,'hybridanalysis','byte-limit',record=>{record.attachments[0].report={verdict:'none'};return record;},{preserveReports:true});}catch(_){byteLimitRefused=true;}
        const byteLimitPreserved=JSON.stringify(await bg.getFromStore(db,'hybridanalysis','byte-limit'))===JSON.stringify(large);
        return {realIndexedDB:true,controlledCleanupClock:true,backwardKeeps,forwardRemoves,oldestGone,retained,unreadableRetained,putRequestSucceededBeforeAbort:requestSucceeded,aborted,abortError,atomicPreserved,byteLimitRefused,byteLimitPreserved};
      }catch(error){throw Error(stage+': '+(error.stack||error));}finally{db.close();}
    })();''', sandbox=None)  # Same-principal mutable sandbox keeps the native DAO facade callable.
    report['storageLifecycle'] = {'helperSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'database': probe, 'coldOpen': {k: cold[k] for k in ['expiredRemoved', 'freshRetained', 'futureRetained']}, 'longSessionKeepsAgedRecord': seeded['longSessionKeepsAgedRecord']}
    assert all(value for value in probe.values() if isinstance(value, bool)), probe
    retained = m.page('''return (async()=>{
      const b=(window.wrappedJSObject||window).browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;
      const original=(await b.storage.local.get('linkAuditLog')).linkAuditLog;
      const pending=Array.from({length:2001},(_,i)=>({id:'storage-pending-'+i,clickedAt:Date.now()-7200000-i,url:'https://fixture.example.invalid/',outcome:'PENDING',decidedAt:null,openAttempts:0,scoreAtDecision:null}));
      await b.storage.local.set({linkAuditLog:[...original,...pending]});const response=await bg.readLinkAudit();if(!Array.isArray(response.records))throw Error('Audit read failed');
      const records=(await b.storage.local.get('linkAuditLog')).linkAuditLog;
      const originalsPreserved=original.every(old=>records.some(row=>JSON.stringify(row)===JSON.stringify(old))),pendingUnchanged=records.filter(row=>row.id.startsWith('storage-pending-')).every(row=>row.outcome==='PENDING'&&row.decidedAt===null&&row.openAttempts===0);
      const before=JSON.stringify(records);await bg.clearStore(await bg.getSharedDB(),'hybridanalysis');const clear=await b.runtime.sendMessage({action:'clearMemoryCaches'});if(!clear.success)throw Error('Authorized cache clear failed');
      const cacheClearKeepsAudit=JSON.stringify((await b.storage.local.get('linkAuditLog')).linkAuditLog)===before;
      const analysisBaseline={messageHeader:'storage-restore-record',updatedAt:Date.now(),attachments:[{partName:'1.2',state:'KNOWN',hybrid_sha256:'b'.repeat(64),report:{verdict:'malicious',preserved:true},report_fetched_at:'2026-10-02T08:00:00Z'}]};
      await bg.updateStore(await bg.getSharedDB(),'hybridanalysis',analysisBaseline.messageHeader,()=>analysisBaseline);
      await b.storage.local.set({thundyStorageProbeMarker:'before-backup'});
      return {count:records.length,originalsPreserved,pendingUnchanged,cacheClearKeepsAudit,audit:records,analysisBaseline};
    })();''')
    assert retained['count'] == 2000 and all(retained[k] for k in ['originalsPreserved', 'pendingUnchanged', 'cacheClearKeepsAudit'])
    backup = out / '.rollback-profile'
    try:
        m.js('for(const tab of [...window.gTabmail.tabInfo])if(tab.mode.name==="mailMessageTab"||tab.browser?.currentURI.spec.startsWith("moz-extension:"))window.gTabmail.closeTab(tab);')
        m = restart(backup_to=backup)
        options()
        newer = m.page('''return (async()=>{const b=(window.wrappedJSObject||window).browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw,old=(await b.storage.local.get('linkAuditLog')).linkAuditLog;await bg.updateStore(await bg.getSharedDB(),'hybridanalysis','storage-restore-record',record=>{record.attachments[0].report={verdict:'none',postBackup:true};return record;},{preserveReports:true});const record={id:crypto.randomUUID(),clickedAt:Date.now(),url:'https://fixture.example.invalid/after-backup',outcome:'PENDING',decidedAt:null,openAttempts:0};await b.storage.local.set({linkAuditLog:[record,...old],thundyStorageProbeMarker:'after-backup'});return record;})();''')
        # Explicitly preserve post-backup events separately; profile restore is not a merge.
        exported = out / 'post-backup-pending.json'
        exported.write_text(json.dumps(newer, sort_keys=True) + '\n')
        server_after_backup = None
        if fixture:
            state = json.loads(Path(fixture).read_text())
            client = imaplib.IMAP4('127.0.0.1', state['port'], timeout=10)
            try:
                client.login('fixture', 'synthetic-fixture')
                assert client.append('INBOX', None, None, b'From: fixture@example.invalid\r\nSubject: Thundy post-backup server mail\r\nMessage-ID: <post-backup-server@example.invalid>\r\n\r\nServer data is outside the profile backup.\r\n')[0] == 'OK'
                client.select('INBOX')
                server_after_backup = int(client.search(None, 'ALL')[1][0].split()[-1])
            finally:
                client.logout()
        m.js('for(const tab of [...window.gTabmail.tabInfo])if(tab.browser?.currentURI.spec.startsWith("moz-extension:"))window.gTabmail.closeTab(tab);')
        m = restart(restore_from=backup)
        options()
        restored = m.page('return (window.wrappedJSObject||window).browser.storage.local.get(["linkAuditLog","thundyStorageProbeMarker"]);')
        assert restored['thundyStorageProbeMarker'] == 'before-backup'
        assert restored['linkAuditLog'] == retained['audit']
        analysis=m.page('return (async()=>{const b=(window.wrappedJSObject||window).browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;return bg.getFromStore(await bg.getSharedDB(),"hybridanalysis","storage-restore-record");})();')
        assert analysis == retained['analysisBaseline']
        assert all(row['id'] != newer['id'] for row in restored['linkAuditLog'])
        server_unchanged = None
        if fixture:
            state = json.loads(Path(fixture).read_text())
            client = imaplib.IMAP4('127.0.0.1', state['port'], timeout=10)
            try:
                client.login('fixture', 'synthetic-fixture')
                client.select('INBOX')
                server_unchanged = int(client.search(None, 'ALL')[1][0].split()[-1]) == server_after_backup
            finally:
                client.logout()
            assert server_unchanged
        report['storageLifecycle'].update(passed=True, realThunderbirdAPIs=True, syntheticRecords=True, liveProviderCalls=False,
            audit={k:retained[k] for k in ['count','originalsPreserved','pendingUnchanged','cacheClearKeepsAudit']},
            profileRestore={'passed':True,'auditSnapshotPreserved':True,'analysisSnapshotPreserved':True,'newerEventsSeparatelySaved':True,'newerEventExportSha256':hashlib.sha256(exported.read_bytes()).hexdigest(),'newerEventsNotMerged':True,'imapServerNotRolledBack':server_unchanged},
            scope='Actual native IndexedDB/storage/profile restore; injected transaction abort and controlled cleanup timestamps; real loopback IMAP when configured. No disk failure or unlimited archive guarantee.')
        if fixture:
            m = runpy.run_path(str(Path(__file__).with_name('imap-lifecycle.dev.py')))['check'](m, base, out, report, restart, fixture)
        report['passed'] = True
        return m
    finally:
        if backup.exists():
            shutil.rmtree(backup)
