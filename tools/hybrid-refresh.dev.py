"""Native stale stored-result and full source-archive probe; synthetic/offline."""
import hashlib
from pathlib import Path


def check(m, base, out, report, display, wait, open_page, native_click):
    open_page(m,base+'options.html')
    probe_tab=m.js('return window.gTabmail.tabInfo.indexOf(window.gTabmail.currentTabInfo);')
    prepared=m.page('''return (async()=>{
      const w=window.wrappedJSObject,b=w.browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;
      const message=(await b.messages.query({subject:'Thundy AV synthetic live test'})).messages.find(row=>row.subject==='Thundy AV synthetic live test');
      let tabId;for(const tab of await b.tabs.query({})){try{if((await b.messageDisplay.getDisplayedMessages(tab.id)).messages?.some(row=>row.id===message.id)){tabId=tab.id;break;}}catch{}}
      if(tabId===undefined)throw Error('Missing original message tab');
      const db=await bg.getSharedDB(),key=message.headerMessageId,original=await bg.getFromStore(db,'hybridanalysis',key),audit=await b.storage.local.get('linkAuditLog');
      w.__lateHybridProbe={bg,db,key,original,audit,originalFetch:bg.fetch,calls:0};bg.fetch=async()=>{w.__lateHybridProbe.calls++;throw Error('Unexpected provider request');};
      await b.runtime.sendMessage({action:'clearMemoryCaches'});
      const full=await bg.getAnalysisFull(message.id),urls=bg.filterUrls(bg.extractUrls(bg.extractTextFromParts(full.parts||full)));if(!urls.length)throw Error('Missing fixture URL');
      const link={url:urls[0],state:'UPLOADED',report:{id:'synthetic-quick-scan',finished:false},report_fetched_at:'2026-11-10T10:00:00Z'};
      await bg.updateStore(db,'hybridanalysis',key,old=>({...old,messageHeader:key,links:[link],analysisSourceSnapshots:{}}));
      const ready=await bg.getMessageAnalysisContext(message,tabId),context=ready.wrappedJSObject||ready;w.__lateHybridProbe.context=context;
      const before=await context.snapshot();if(!before.rows.some(row=>row.provider==='hybridanalysis'&&row.resource==='link:0'&&row.completion==='pending'))throw Error('Missing pending baseline');
      const snapshots=Object.fromEntries(Array.from({length:64},(_,i)=>['synthetic-history-'+i,{savedAt:10,snapshot:{schemaVersion:2,rows:[]}}]));
      w.__lateHybridProbe.history=JSON.stringify(snapshots);
      await bg.updateStore(db,'hybridanalysis',key,old=>({...old,links:[{...link,state:'KNOWN',report:{finished:true,state:'COMPLETE',verdict:'malicious',threat_score:85},report_fetched_at:'2026-11-10T10:01:00Z'}],analysisSourceSnapshots:snapshots}));
      await context.flush();const after=await context.snapshot(),again=await context.snapshot(),row=after.rows.find(row=>row.provider==='hybridanalysis'&&row.resource==='link:0');
      if(row?.verdict!=='malicious'||row.completion!=='complete'||after.sourcePersistenceReason!=='snapshot_count'||!after.sourcePersistenceFailed)throw Error('Stored result or capacity reason not exposed');
      if(JSON.stringify(after.rows)!==JSON.stringify(again.rows))throw Error('Repeated read changed response counts');
      w.__lateHybridProbe.snapshotId=context.snapshotId;
      return {messageId:message.id,tabId,pendingAdvanced:true,capacityReason:after.sourcePersistenceReason,brand:'Hybrid Analysis',reason:b.i18n.getMessage('analysisPersistence_snapshot_count')};
    })();''')
    try:
        m.js('''const tab=window.gTabmail.tabInfo.find(tab=>tab.mode.name==='mailMessageTab'&&tab.browser);window.gTabmail.switchToTab(tab);''')
        wait(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.textContent.includes(arguments[0]);',[prepared['reason']]))
        assert m.page('return !!document.getElementById("thundy-analysis-status").shadowRoot.querySelector("[data-provider=hybridanalysis]");')
        m.screenshot(out/'late-hybrid-result-message.png')
        point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById('thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton').getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
        native_click(display,point['x'],point['y'])
        wait(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
        popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
        wait(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.textContent.includes(arguments[0]);',[prepared['reason']],browser=popup))
        assert m.page('return !!document.getElementById("thundy-analysis-status").shadowRoot.querySelector("[data-provider=hybridanalysis]");',browser=popup)
        m.screenshot(out/'late-hybrid-result-popup.png')
        m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
        m.js('window.gTabmail.switchToTab(arguments[0]);',[probe_tab])
        preserved=m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__lateHybridProbe,b=w.browser,stored=await p.bg.getFromStore(p.db,'hybridanalysis',p.key);return {history:JSON.stringify(stored.analysisSourceSnapshots)===p.history,audit:JSON.stringify(await b.storage.local.get('linkAuditLog'))===JSON.stringify(p.audit),sameContext:p.context.snapshotId===p.snapshotId,calls:p.calls};})();''')
        assert preserved=={'history':True,'audit':True,'sameContext':True,'calls':0},preserved
        report['hybridStoredRefresh']={'passed':True,'helperSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'realThunderbirdAPIs':True,'realIndexedDB':True,'syntheticProviderPayload':True,'liveProviderCalls':False,'pendingAdvanced':True,'sameContext':True,'messageView':True,'popupView':True,'capacityReasonVisible':True,'historyPreserved':True,'auditPreserved':True,'readCountersStable':True}
    finally:
        m.js('window.gTabmail.switchToTab(arguments[0]);',[probe_tab])
        m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__lateHybridProbe;if(!p)return;p.context?.dispose();p.bg.fetch=p.originalFetch;await new Promise((resolve,reject)=>{const tx=p.db.transaction(['hybridanalysis'],'readwrite'),store=tx.objectStore('hybridanalysis');if(p.original)store.put(p.original);else store.delete(p.key);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error);});delete w.__lateHybridProbe;})();''')
