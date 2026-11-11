"""Real Thunderbird admin/debug/export probe; provider transport is synthetic."""
import hashlib
import json
from pathlib import Path


def check(m, base, out, report, display, wait, open_page, native_click, native_json_download):
    open_page(m,base+'options.html')
    tab=m.js('return window.gTabmail.tabInfo.indexOf(window.gTabmail.currentTabInfo);')
    wait(lambda:m.page('return !!document.getElementById("apiDebugEnabled");'))
    assert m.page('return document.getElementById("apiDebugEnabled").disabled&&document.getElementById("apiDebugExport").disabled;')
    denied=m.page('return window.wrappedJSObject.browser.runtime.sendMessage({action:"securityCommand",op:"apiDebugReport"});')
    assert denied['success'] is False and denied['code']=='ADMIN_LOCKED'
    m.js('''const {ExtensionPermissions}=ChromeUtils.importESModule("resource://gre/modules/ExtensionPermissions.sys.mjs");return ExtensionPermissions.add(arguments[0],{permissions:[],origins:["https://hybrid-analysis.com/*","https://urlscan.io/*"]},WebExtensionPolicy.getByID(arguments[0]).extension);''',['thundy-av@bludau-it-services.de'])
    m.page('document.querySelector("[data-security=securityAdminPassword]").value="native-admin-password";document.querySelector("[data-security=unlock]").click();')
    wait(lambda:m.page('return !document.getElementById("apiDebugEnabled").disabled;'))
    m.page('document.getElementById("apiDebugEnabled").checked=true;document.getElementById("apiDebugForm").requestSubmit();')
    wait(lambda:m.page('return window.wrappedJSObject.browser.storage.local.get("thundySecurityV1").then(s=>s.thundySecurityV1.apiDebugEnabled===true&&!document.querySelector("#apiDebugForm button").disabled);'))
    m.page('''return (async()=>{const w=window.wrappedJSObject,b=w.browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;w.__apiDebugProbe={bg,fetch:bg.fetch,audit:JSON.stringify(await b.storage.local.get('linkAuditLog')),calls:0};bg.fetch=async()=>{w.__apiDebugProbe.calls++;return new bg.Response('<html>CANARY_PRIVATE_BODY</html>',{status:403,headers:{'content-type':'text/html','set-cookie':'CANARY_COOKIE'}});};return true;})();''')
    try:
        result=m.page('return window.wrappedJSObject.ProviderKeyTester.testKey("hybridanalysis","CANARY_DEBUG_KEY");')
        assert result['status']=='invalid_key',result
        m.page('''const w=window.wrappedJSObject;w.__apiDebugProbe.bg.fetch=async()=>{w.__apiDebugProbe.calls++;return new w.__apiDebugProbe.bg.Response(JSON.stringify({status:'ok',uuid:'synthetic-debug-reference',message:'CANARY_PRIVATE_MESSAGE'}),{status:200,headers:{'content-type':'application/json'}});};''')
        result=m.page('return window.wrappedJSObject.ProviderKeyTester.testKey("urlscan","CANARY_DEBUG_KEY");')
        assert result['status']=='valid',result
        message_tab=m.js('return window.gTabmail.tabInfo.findIndex(t=>t.mode.name==="mailMessageTab"&&t.browser);')
        m.js('window.gTabmail.switchToTab(arguments[0]);',[message_tab])
        point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById('thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton').getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
        native_click(display,point['x'],point['y'])
        wait(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
        popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
        wait(lambda:m.page('return !!window.wrappedJSObject.ApiGateway;',browser=popup))
        result=m.page('''return (async()=>{const w=window.wrappedJSObject,original=w.fetch;let calls=0;w.fetch=async()=>{calls++;return new w.Response(JSON.stringify({id:'synthetic-popup-reference',finished:false}),{status:200,headers:{'content-type':'application/json'}});};try{const gateway=new w.ApiGateway();await gateway.fetchWithTimeout('https://hybrid-analysis.com/api/v2/overview/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',{method:'GET',keyTest:true,headers:{'api-key':'CANARY_POPUP_KEY'}});const denied=await w.browser.runtime.sendMessage({action:'securityCommand',op:'apiDebugReport'});return {calls,reportDenied:denied.success===false};}finally{w.fetch=original;}})();''',browser=popup)
        assert result=={'calls':1,'reportDenied':True},result
        m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();window.gTabmail.switchToTab(arguments[0]);',[tab])
        wait(lambda:m.page('return !document.getElementById("apiDebugPreview").disabled;'))
        m.page('document.getElementById("apiDebugPreview").click();')
        wait(lambda:m.page('return !document.getElementById("apiDebugContent").hidden;'))
        preview=json.loads(m.page('return document.getElementById("apiDebugContent").textContent;'))
        assert len(preview['entries'])==3,preview
        assert any(e['attempts'][0]['status']==403 and e['bodyState']=='invalid_json' for e in preview['entries'])
        assert any(e['request']['provider']=='urlscan' for e in preview['entries'])
        assert 'CANARY' not in json.dumps(preview)
        m.screenshot(out/'api-debug-preview.png')
        exported=native_json_download(m,display,out,'apiDebugExport','api-debug-export.json')
        assert exported['entries']==preview['entries'] and 'CANARY' not in json.dumps(exported)
        m.page('document.getElementById("apiDebugEnabled").checked=false;document.getElementById("apiDebugForm").requestSubmit();')
        wait(lambda:m.page('return !document.getElementById("apiDebugPreview").disabled&&document.getElementById("apiDebugStatus").textContent.length>0;'))
        m.page('document.getElementById("apiDebugPreview").click();')
        wait(lambda:m.page('return !document.getElementById("apiDebugContent").hidden;'))
        assert json.loads(m.page('return document.getElementById("apiDebugContent").textContent;'))['entries']==[]
        preserved=m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__apiDebugProbe;return {calls:p.calls,audit:JSON.stringify(await w.browser.storage.local.get('linkAuditLog'))===p.audit};})();''')
        assert preserved=={'calls':2,'audit':True},preserved
        report['apiDebug']={key:True for key in ['passed','realThunderbirdAPIs','adminProtected','backgroundCaptured','popupCaptured','httpStatusVisible','invalidJsonVisible','exportVerified','secretsRedacted','noExtraRequests','auditPreserved','disabledCleared']}
        report['apiDebug'].update({'liveProviderCalls':False,'syntheticTransport':True,'helperSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
    finally:
        m.js('window.gTabmail.switchToTab(arguments[0]);',[tab])
        m.page('''const w=window.wrappedJSObject,p=w.__apiDebugProbe;if(p){p.bg.fetch=p.fetch;delete w.__apiDebugProbe;}''')
