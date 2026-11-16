"""Actual stored failure -> newer finding, with no provider traffic."""
import hashlib
from pathlib import Path


def check(m, base, out, report, display, wait, open_page, native_click):
    open_page(m,base+'options.html')
    probe_tab=m.js('return window.gTabmail.tabInfo.indexOf(window.gTabmail.currentTabInfo);')
    prepared=m.page('''return (async()=>{
      const w=window.wrappedJSObject,b=w.browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;
      const message=(await b.messages.query({subject:'Thundy AV synthetic live test'})).messages.find(row=>row.subject==='Thundy AV synthetic live test');
      let tabId;for(const tab of await b.tabs.query({})){try{if((await b.messageDisplay.getDisplayedMessages(tab.id)).messages?.some(row=>row.id===message.id)){tabId=tab.id;break;}}catch{}}
      if(tabId===undefined)throw Error('Missing original message');
      const db=await bg.getSharedDB(),key=message.headerMessageId,original=await bg.getFromStore(db,'hybridanalysis',key),audit=await b.storage.local.get('linkAuditLog');
      w.__storedFailureProbe={bg,db,key,original,audit,fetch:bg.fetch,calls:0};bg.fetch=async()=>{w.__storedFailureProbe.calls++;throw Error('Unexpected provider request');};
      await b.runtime.sendMessage({action:'clearMemoryCaches'});
      const full=await bg.getAnalysisFull(message.id),urls=bg.filterUrls(bg.extractUrls(bg.extractTextFromParts(full.parts||full)));if(!urls.length)throw Error('Missing fixture URL');
      await bg.updateStore(db,'hybridanalysis',key,old=>({...old,messageHeader:key,attachments:[],sourceDataIncomplete:false,links:[{url:urls[0],state:'UPLOADED',report:{state:'ERROR'},report_fetched_at:new Date(Date.now()-60000).toISOString()}],analysisSourceSnapshots:{}}));
      const ready=await bg.getMessageAnalysisContext(message,tabId),context=ready.wrappedJSObject||ready;w.__storedFailureProbe.context=context;
      const initial=await context.snapshot(),row=initial.rows.find(row=>row.provider==='hybridanalysis'&&row.resource==='link:0');
      if(row?.state!=='failed'||row.verdict!=='unknown'||row.failures!==1)throw Error('Missing stored failed baseline');
      w.__storedFailureProbe.before={failures:row.failures,responses:row.responses,cacheHits:row.cacheHits};context.schedule();
      w.__storedFailureProbe.message=message;w.__storedFailureProbe.url=urls[0];
      return {failed:b.i18n.getMessage('analysisVerdict_unknown'),malicious:b.i18n.getMessage('analysisVerdict_malicious')};
    })();''')
    try:
        m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.mode.name==="mailMessageTab"&&tab.browser);window.gTabmail.switchToTab(tab);')
        wait(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector("[data-provider=hybridanalysis] .service-results")?.textContent===arguments[0];',[prepared['failed']]))
        m.js('window.gTabmail.switchToTab(arguments[0]);',[probe_tab])
        recovered=m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__storedFailureProbe,b=w.browser;
          await p.bg.updateStore(p.db,'hybridanalysis',p.key,old=>({...old,links:old.links.map(link=>({...link,state:'KNOWN',report:{finished:true,verdict:'malicious',threat_score:85},report_fetched_at:new Date().toISOString()}))}));
          await p.context.flush();const after=await p.context.snapshot(),again=await p.context.snapshot(),row=after.rows.find(row=>row.provider==='hybridanalysis'&&row.resource==='link:0');
          const saved=await p.bg.getFromStore(p.db,'hybridanalysis',p.key),written=saved.analysisSourceSnapshots[p.context.snapshotId]?.snapshot.rows.find(row=>row.provider==='hybridanalysis'&&row.resource==='link:0');
          const findings=await p.bg.collectLinkFindings(p.message);
          p.context.schedule();return {recovered:row?.state==='checked'&&row.verdict==='malicious'&&row.completion==='complete',history:row.failures===p.before.failures&&row.responses===p.before.responses&&row.cacheHits===p.before.cacheHits,stable:JSON.stringify(after.rows)===JSON.stringify(again.rows),persisted:written?.verdict==='malicious'&&written.failures===1,local:findings.some(f=>f.url===p.url&&f.verdict==='malicious'),audit:JSON.stringify(await b.storage.local.get('linkAuditLog'))===JSON.stringify(p.audit),calls:p.calls};})();''')
        assert recovered=={'recovered':True,'history':True,'stable':True,'persisted':True,'local':True,'audit':True,'calls':0},recovered
        m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.mode.name==="mailMessageTab"&&tab.browser);window.gTabmail.switchToTab(tab);')
        wait(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector("[data-provider=hybridanalysis] .service-results")?.textContent===arguments[0];',[prepared['malicious']]))
        m.screenshot(out/'stored-failure-recovered-message.png')
        point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById('thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton').getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
        native_click(display,point['x'],point['y']);wait(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
        popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
        wait(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector("[data-provider=hybridanalysis] .service-results")?.textContent===arguments[0];',[prepared['malicious']],browser=popup))
        m.screenshot(out/'stored-failure-recovered-popup.png');m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
        report['failedStoredRecovery']={key:True for key in ['passed','realThunderbirdAPIs','realIndexedDB','syntheticProviderPayload','messageView','popupView','earlierFailuresPreserved','responseCountersPreserved','storedSnapshotAgrees','localFindingAgrees','auditPreserved','idempotent']}
        report['failedStoredRecovery'].update({'liveProviderCalls':False,'helperSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
    finally:
        m.js('window.gTabmail.switchToTab(arguments[0]);',[probe_tab])
        m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__storedFailureProbe;if(!p)return;p.context?.dispose();p.bg.fetch=p.fetch;await new Promise((resolve,reject)=>{const tx=p.db.transaction(['hybridanalysis'],'readwrite'),store=tx.objectStore('hybridanalysis');if(p.original)store.put(p.original);else store.delete(p.key);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error);});delete w.__storedFailureProbe;})();''')
