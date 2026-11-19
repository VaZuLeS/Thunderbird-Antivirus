"""Real Thunderbird file and IndexedDB bindings; synthetic Hybrid transport only."""
import hashlib
from pathlib import Path


def check(m, base, out, report, wait_for, open_page):
    open_page(m, base + 'options.html')
    # Test-profile permissions only. Production permissions and consent stay opt-in.
    m.js('''const {ExtensionPermissions}=ChromeUtils.importESModule("resource://gre/modules/ExtensionPermissions.sys.mjs");
      return ExtensionPermissions.add(arguments[0],{permissions:[],origins:["https://hybrid-analysis.com/*"]},WebExtensionPolicy.getByID(arguments[0]).extension);''', ['thundy-av@bludau-it-services.de'])
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
