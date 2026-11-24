"""Real Thunderbird file and IndexedDB bindings; synthetic Hybrid transport only."""
import hashlib
from pathlib import Path


def check(m, base, out, report, wait_for, open_page):
    open_page(m, base + 'options.html')
    # Test-profile permissions only. Production permissions and consent stay opt-in.
    m.js('''const {ExtensionPermissions}=ChromeUtils.importESModule("resource://gre/modules/ExtensionPermissions.sys.mjs");
      return ExtensionPermissions.add(arguments[0],{permissions:[],origins:["https://hybrid-analysis.com/*"]},WebExtensionPolicy.getByID(arguments[0]).extension);''', ['thundy-av@bludau-it-services.de'])
    modern=m.page('''return (async()=>{const raw=await window.wrappedJSObject.browser.runtime.getBackgroundPage();return typeof (raw.wrappedJSObject||raw).prepareProviderTransfer==='function';})();''')
    if modern:
        result=check_review(m, wait_for)
        report['manualUploadBinding']={'helperSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),**result}
        assert result['passed'] and result['auditPreserved'],result
        return
    result=m.page('''return (async()=>{
      const w=window.wrappedJSObject,b=w.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const message=(await b.messages.query({subject:'Thundy hybrid popup'})).messages.find(row=>row.subject==='Thundy hybrid popup');
      if(!message)throw Error('Manual binding fixture message missing');
      const attachment=(await b.messages.listAttachments(message.id))[0],file=await b.messages.getAttachmentFile(message.id,attachment.partName);
      const digest=await bg.get_sha256_hash(await file.arrayBuffer()),key=bg.resolveMessageStorageKey(message),db=await bg.getSharedDB();
      const settings=await b.storage.local.get(['apikey','externalAnalysisConsent','privacyTier','scanMode','alwaysManual','autoScanLinks']);
      const audit=JSON.stringify((await b.storage.local.get('linkAuditLog')).linkAuditLog),fetch=bg.fetch;
      const content=record=>JSON.stringify({attachments:record?.attachments?.map(({created,...item})=>item),links:record?.links,archive:record?.analysisReportArchive});
      const before=content(await bg.getFromStore(db,'hybridanalysis',key,bg.messageReportOptions(message)));
      const calls=[];let responseHash='b'.repeat(64),readBytes=false,actualName=false;
      bg.fetch=async(url,options={})=>{
        if(String(url)!=='https://hybrid-analysis.com/api/v2/quick-scan/file'||options.method!=='POST')throw Error('Unexpected network in manual binding probe');
        const sent=options.body.get('file');readBytes=await bg.get_sha256_hash(await sent.arrayBuffer())===digest;actualName=sent.name===file.name;calls.push('POST');
        return new bg.Response(JSON.stringify({id:'native-bound-quick-scan',sha256:responseHash}),{status:201,headers:{'Content-Type':'application/json'}});
      };
      try{
        await b.storage.local.set({apikey:'native-synthetic-manual-key',externalAnalysisConsent:true,privacyTier:'balanced',scanMode:'manual',alwaysManual:true,autoScanLinks:false});
        await bg.loadSettings();
        const send=(hash=digest,headerMessageId=key)=>b.runtime.sendMessage({action:'uploadAttachment',messageId:message.id,partName:attachment.partName,attachmentName:'untrusted-caller-name.bin',hash,headerMessageId});
        const foreign=await send(digest,'foreign-record'),stale=await send('a'.repeat(64));
        const refusedBeforePost=calls.length===0&&foreign.code==='MESSAGE_CONTEXT_CHANGED'&&stale.code==='MESSAGE_CONTEXT_CHANGED';
        const mismatch=await send();
        const mismatchPreserved=content(await bg.getFromStore(db,'hybridanalysis',key,bg.messageReportOptions(message)))===before;
        responseHash=digest;const accepted=await send(digest.toUpperCase());
        const stored=await bg.getFromStore(db,'hybridanalysis',key,bg.messageReportOptions(message)),current=stored.attachments.find(item=>item.partName===attachment.partName);
        return {passed:refusedBeforePost&&mismatch.code==='RESOURCE_MISMATCH'&&mismatch.uploadSent===true&&mismatchPreserved&&accepted.status==='success'&&current.hybrid_sha256===digest&&current.hybrid_quick_scan_id==='native-bound-quick-scan'&&readBytes&&actualName&&calls.length===2,
          realThunderbirdAPIs:true,realIndexedDB:true,syntheticTransport:true,liveProviderCalls:false,refusedBeforePost,mismatchPreserved,uploadSentReported:mismatch.uploadSent===true,actualBytesVerified:readBytes,actualFilenameUsed:actualName,matchingReferenceSaved:current.hybrid_quick_scan_id==='native-bound-quick-scan',singlePostPerExplicitAttempt:calls.length===2,auditPreserved:JSON.stringify((await b.storage.local.get('linkAuditLog')).linkAuditLog)===audit};
      }finally{bg.fetch=fetch;await b.storage.local.remove(['apikey','externalAnalysisConsent','privacyTier','scanMode','alwaysManual','autoScanLinks'].filter(key=>!Object.hasOwn(settings,key)));await b.storage.local.set(settings);await bg.loadSettings();}
    })();''')
    report['manualUploadBinding']={'helperSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),**result}
    assert result['passed'] and result['auditPreserved'],result


def check_review(m, wait_for):
    options='window.gTabmail.tabInfo.filter(tab=>tab.browser?.currentURI.spec.endsWith("/options.html")).at(-1).browser'
    modal='document.querySelector(\'browser[webextension-view-type="popup"]\')'
    target=m.page('''return (async()=>{
      const w=window.wrappedJSObject,b=w.browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;
      const message=(await b.messages.query({subject:'Thundy hybrid popup'})).messages.find(row=>row.subject==='Thundy hybrid popup');
      const attachment=(await b.messages.listAttachments(message.id))[0],file=await b.messages.getAttachmentFile(message.id,attachment.partName);
      const digest=await bg.get_sha256_hash(await file.arrayBuffer()),key=bg.resolveMessageStorageKey(message),db=await bg.getSharedDB();
      const patch={apikey:'native-synthetic-manual-key',externalAnalysisConsent:true,privacyTier:'balanced',scanMode:'manual',alwaysManual:true,autoScanLinks:false};
      const keys=Object.keys(patch),settings=await b.storage.local.get(keys),audit=JSON.stringify((await b.storage.local.get('linkAuditLog')).linkAuditLog);
      const stored=()=>bg.getFromStore(db,'hybridanalysis',key,bg.messageReportOptions(message));
      const content=async()=>{const row=await stored();return JSON.stringify({attachments:row?.attachments,links:row?.links,archive:row?.analysisReportArchive});};
      const p={bg,keys,settings,audit,stored,content,before:await content(),fetch:bg.fetch,calls:[],responseHash:'b'.repeat(64)};
      w.__reviewProbe=p;
      bg.fetch=async(url,options={})=>{
        if(String(url)!=='https://hybrid-analysis.com/api/v2/quick-scan/file'||options.method!=='POST')throw Error('Unexpected synthetic route');
        const sent=options.body.get('file');p.calls.push({bytes:await bg.get_sha256_hash(await sent.arrayBuffer())===digest,name:sent.name===file.name});
        return new bg.Response(JSON.stringify({id:'native-bound-quick-scan',sha256:p.responseHash}),{status:201,headers:{'Content-Type':'application/json'}});
      };
      await b.storage.local.set(patch);await bg.loadSettings();
      await b.messageDisplay.open({messageId:message.id,location:'tab'});
      return {messageId:message.id,partName:attachment.partName,hash:digest,headerMessageId:key,target:file.name};
    })();''',browser=options)
    try:
        toolbar='window.gTabmail.currentTabInfo.chromeBrowser?.contentDocument?.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton")'
        wait_for(lambda:m.js('return !!'+toolbar+';'))
        m.js(toolbar+'.click();')
        wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
        def send(action, data):
            return m.page('return window.wrappedJSObject.browser.runtime.sendMessage({action:arguments[0],...arguments[1]});',[action,data],browser=modal)
        prepare=lambda data: send('prepareProviderTransfer',data)
        foreign=prepare({**target,'headerMessageId':'foreign-record'})
        wrong=prepare({**target,'hash':'a'*64})
        refused=foreign.get('code')==wrong.get('code')=='MESSAGE_CONTEXT_CHANGED' and m.page('return window.wrappedJSObject.__reviewProbe.calls.length===0;',browser=options)
        reviewed=prepare(target)
        assert reviewed['success'] and reviewed['target']==target['target'],reviewed
        rejected=send('submitProviderTransfer',{'id':reviewed['id']})
        replay=send('submitProviderTransfer',{'id':reviewed['id']})
        mismatch_preserved=m.page('return (async()=>{const p=window.wrappedJSObject.__reviewProbe;return p.before===await p.content();})();',browser=options)
        m.page('window.wrappedJSObject.__reviewProbe.responseHash=arguments[0];',[target['hash']],browser=options)
        reviewed=prepare({**target,'hash':target['hash'].upper()})
        assert m.page('return window.wrappedJSObject.__reviewProbe.calls.length===1;',browser=options)
        accepted=send('submitProviderTransfer',{'id':reviewed['id']})
        observed=m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__reviewProbe,row=await p.stored();
          const item=row.attachments.find(item=>item.partName===arguments[0]);return {calls:p.calls,matching:item.hybrid_sha256===arguments[1]&&item.hybrid_quick_scan_id==='native-bound-quick-scan',
            audit:JSON.stringify((await w.browser.storage.local.get('linkAuditLog')).linkAuditLog)===p.audit};})();''',[target['partName'],target['hash']],browser=options)
        sent_unassigned=rejected.get('code')=='RESOURCE_MISMATCH' and rejected.get('uploadSent') is True
        single=len(observed['calls'])==2 and replay.get('code')=='TRANSFER_APPROVAL_REQUIRED'
        checked={'refusedBeforePost':refused,'mismatchPreserved':mismatch_preserved,'uploadSentReported':sent_unassigned,
            'actualBytesVerified':all(call['bytes'] for call in observed['calls']),'actualFilenameUsed':all(call['name'] for call in observed['calls']),
            'matchingReferenceSaved':observed['matching'],'singlePostPerExplicitAttempt':single,'auditPreserved':observed['audit']}
        return {'passed':accepted['status']=='success' and all(checked.values()),'realThunderbirdAPIs':True,'realIndexedDB':True,
            'syntheticTransport':True,'liveProviderCalls':False,**checked}
    finally:
        m.js('document.getElementById("webextension-remote-preload-panel")?.hidePopup();')
        m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__reviewProbe,b=w.browser;p.bg.fetch=p.fetch;
          await b.storage.local.remove(p.keys.filter(key=>!Object.hasOwn(p.settings,key)));await b.storage.local.set(p.settings);await p.bg.loadSettings();delete w.__reviewProbe;return true;})();''',browser=options)
