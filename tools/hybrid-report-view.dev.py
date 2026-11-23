"""Native read-only Hybrid viewer and compact inline navigation; synthetic stored data."""
import hashlib
from pathlib import Path


def check(m, base, out, report, wait_for, open_page):
    open_page(m, base+'options.html')
    probe_tab=m.js('return window.gTabmail.tabInfo.indexOf(window.gTabmail.currentTabInfo);')
    result=None
    try:
        resource_ref = m.page('''return (async()=>{
          const w=window.wrappedJSObject,b=w.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
          const message=(await b.messages.query({subject:'Thundy hybrid popup'})).messages.find(v=>v.subject==='Thundy hybrid popup');
          const filePart=(await b.messages.listAttachments(message.id))[0],file=await b.messages.getAttachmentFile(message.id,filePart.partName),hash=await bg.get_sha256_hash(await file.arrayBuffer());
          const db=await bg.getSharedDB(),key=bg.resolveMessageStorageKey(message),original=await bg.getFromStore(db,'hybridanalysis',key);
          const settings=await b.storage.local.get(['externalAnalysisConsent','scanMode','analysisShowHybridDetails']);
          const p=w.__hybridViewerProbe={bg,db,key,original,messageId:message.id,scope:bg.messageReportOptions(message),settings,fetch:bg.fetch,calls:0,audit:JSON.stringify((await b.storage.local.get('linkAuditLog')).linkAuditLog)};
          bg.fetch=async()=>{p.calls++;throw Error('Unexpected provider request in report viewer');};
          await b.storage.local.set({externalAnalysisConsent:false,scanMode:'manual',analysisShowHybridDetails:true});await bg.loadSettings();
          await bg.updateStore(db,'hybridanalysis',key,old=>({...old,attachments:old.attachments.map(a=>a.partName===filePart.partName?{...a,hybrid_sha256:hash,report_fetched_at:'2026-11-18T08:00:00Z',report:[{sha256:hash,job_id:'native-report-one',environment_description:'Native first environment',analysis_start_time:'2026-11-17T14:00:00Z',state:'SUCCESS',verdict:'clean',threat_score:0,processes:[]},{sha256:hash,job_id:'native-report-two',environment_description:'Native second environment',verdict:'unknown',scanners_v2:{Native:{positives:3,total:22}},signatures:[{name:'native-second-only',threat_level:2}]}]}:a)}),p.scope);
          p.content=r=>JSON.stringify({attachments:r.attachments.map(({created,...v})=>v),links:r.links,archive:r.analysisReportArchive});
          p.fixture=p.content(await bg.getFromStore(db,'hybridanalysis',key,p.scope));
          await b.messageDisplay.open({messageId:message.id,location:'tab'});return 'attachment:'+filePart.partName;
        })();''')
        wait_for(lambda:m.page('const h=document.getElementById("thundy-analysis-status");return h?.dataset.surface==="message"&&!!h.shadowRoot.querySelector(".finding-card .local-score");'))
        m.page('const r=document.getElementById("thundy-analysis-status").shadowRoot;if(document.body.dataset.thundyAnalysisView==="expert")r.querySelector("[data-focus-key=view-switch]").click();')
        report_button = '[data-key="overview-resources"] [data-resource="' + resource_ref + '"] .hybrid-report-link button'
        wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector(arguments[0]);',[report_button]))
        inline=m.page('const h=document.getElementById("thundy-analysis-status"),s=h.shadowRoot.querySelector(".finding-card .local-score");return h.dataset.surface==="message"&&s.getClientRects().length>0&&s.textContent.includes("/ 100");')
        m.js('window.gTabmail.switchToTab(arguments[0]);',[probe_tab])
        rejected=m.page('''return (async()=>{
          const w=window.wrappedJSObject,b=w.browser,messageId=w.__hybridViewerProbe.messageId;
          const view=await b.runtime.sendMessage({action:"getMessageAnalysis",messageId});
          const [resourceRef,details]=Object.entries(view.hybridReports).find(([,report])=>report.sections.length);
          const tabs=(await b.tabs.query({})).length;
          const result=await b.runtime.sendMessage({action:"openHybridReport",messageId,contextToken:view.contextToken,
            resourceRef,resourceToken:crypto.randomUUID()});
          return typeof details.resourceToken==="string"&&result.code==="REPORT_UNAVAILABLE"&&(await b.tabs.query({})).length===tabs;
        })();''')
        assert rejected
        m.js('window.gTabmail.switchToTab(window.gTabmail.tabInfo.filter(tab=>tab.mode.name==="mailMessageTab").at(-1));')
        m.page('document.getElementById("thundy-analysis-status").shadowRoot.querySelector(arguments[0]).click();',[report_button])
        wait_for(lambda:m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.startsWith(arguments[0]);',[base+'hybrid_report.html#']))
        wait_for(lambda:m.page('return document.querySelectorAll("#hybridReportSelect option").length===2;'))
        checks=m.page('''const s=document.getElementById('hybridReportSelect'),view=document.getElementById('hybridReportOverview');
          const comparison=document.querySelector('.report-comparison');comparison.open=true;comparison.querySelector('button[data-run="1"]').click();
          const q=document.getElementById('hybridReportSearch');q.value='native-second-only';q.dispatchEvent(new Event('input'));
          const content=document.getElementById('hybridReportContent');
          return {separateReports:s.options.length===2,comparedRun:s.value==='1'&&comparison.querySelector('button[aria-current=true]').dataset.run==='1',
            signalExplained:view.querySelector('.report-explanation').textContent.includes('3 / 22'),
            completionUnconfirmed:view.textContent.includes('completion unconfirmed'),
            searchWorks:content.textContent.includes('native-second-only'),textOnly:content.querySelectorAll('a,script,img').length===0};''')
        m.screenshot(out/'hybrid-report-view.png')
        m.js('window.gTabmail.switchToTab(arguments[0]);',[probe_tab])
        preserved=m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__hybridViewerProbe,b=w.browser;return {noProviderRequests:p.calls===0,auditPreserved:JSON.stringify((await b.storage.local.get('linkAuditLog')).linkAuditLog)===p.audit,resourcesPreserved:p.content(await p.bg.getFromStore(p.db,'hybridanalysis',p.key,p.scope))===p.fixture};})();''')
        result={'realThunderbirdAPIs':True,'syntheticStoredData':True,'liveProviderCalls':False,'compactInline':inline,
                'mismatchedResourceRefused':rejected,**checks,**preserved}
        result['passed']=all(v for k,v in result.items() if k!='liveProviderCalls')
        assert result['passed'],result
    finally:
        m.js('window.gTabmail.switchToTab(arguments[0]);',[probe_tab])
        m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__hybridViewerProbe;if(!p)return;const b=w.browser;p.bg.fetch=p.fetch;await p.bg.putToStore(p.db,'hybridanalysis',p.original);await b.storage.local.remove(['externalAnalysisConsent','scanMode','analysisShowHybridDetails'].filter(key=>!Object.hasOwn(p.settings,key)));await b.storage.local.set(p.settings);await p.bg.loadSettings();delete w.__hybridViewerProbe;return true;})();''')
        report['hybridReportView']={'helperSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),**(result or {'passed':False})}
