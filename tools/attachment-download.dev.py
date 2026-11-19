"""Native original-attachment save guard using an already stored synthetic Hybrid report."""
import hashlib

def check(m, base, out, report, display, wait_for, open_page, native_click, native_dialogs, native_download):
    open_page(m, base+'options.html')
    options_index=m.js('return window.gTabmail.tabInfo.indexOf(window.gTabmail.currentTabInfo);')
    arrangement=m.page('''return (async()=>{
      const w=window.wrappedJSObject,b=w.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const message=(await b.messages.query({subject:'Thundy hybrid popup'})).messages.find(v=>v.subject==='Thundy hybrid popup');
      const part=(await b.messages.listAttachments(message.id))[0];
      const bytes=await (await b.messages.getAttachmentFile(message.id,part.partName)).arrayBuffer();
      const hash=await bg.get_sha256_hash(bytes),key=bg.resolveMessageStorageKey(message),db=await bg.getSharedDB();
      const original=await bg.getFromStore(db,'hybridanalysis',key),settings=await b.storage.local.get(['externalAnalysisConsent','thundySecurityV1']);
      const sec=settings.thundySecurityV1||{schemaVersion:1,policy:{enabled:false,threshold:50,unknown:'warn',revision:0}};
      const p=w.__attachTest={bg,b,db,key,original,scope:bg.messageReportOptions(message),settings,sec,fetch:bg.fetch,providerCalls:0};
      p.onMenu=(info,tab)=>{if(info.menuItemId==='save-attachment-thundy')p.menu={tabId:tab?.id,parts:info.attachments?.map(item=>item.partName)};};
      b.menus.onClicked.addListener(p.onMenu);
      bg.fetch=async()=>{p.providerCalls++;throw Error('Unexpected provider request');};
      const policy={mode:'block',threshold:70,unknown:'warn',revision:1};
      await b.storage.local.set({externalAnalysisConsent:false,thundySecurityV1:{...sec,attachmentPolicy:policy}});await bg.loadSettings();
      await bg.updateStore(db,'hybridanalysis',key,old=>({...old,analysisReportArchive:{schemaVersion:1,entries:[]},attachments:old.attachments.map(a=>a.partName===part.partName?
        {...a,hybrid_sha256:hash,state:'KNOWN',assessment:null,report:{state:'SUCCESS',sha256:hash,threat_score:70}}:a)}),p.scope);
      const downloads=(await b.downloads.search({})).map(item=>item.id);
      await b.messageDisplay.open({messageId:message.id,location:'tab'});
      return {hash,part:part.partName,downloads};
    })();''')
    message_index=m.js('return window.gTabmail.tabInfo.indexOf(window.gTabmail.currentTabInfo);')
    all_checks={}
    try:
        def switch_message():
            m.js('window.gTabmail.switchToTab(arguments[0]);',[message_index])

        button_click='''const h=document.getElementById('thundy-analysis-status'),r=h?.shadowRoot;
          const section=r?.querySelector(h.dataset.view==='expert'?'[data-key=resources]':'[data-key=overview-resources]');
          if(!section)return false;
          const suffix=':save:attachment:'+arguments[0],button=[...section.querySelectorAll('button')].find(b=>b.dataset.focusKey.endsWith(suffix));
          if(!button)return false;section.open=true;button.click();return true;'''

        def check_block(name):
            wait_for(lambda:m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.startsWith(arguments[0]);',[base+'attachment_download.html#']))
            wait_for(lambda:m.page('return !document.getElementById("attachmentDecision")?.hidden&&document.getElementById("attachmentScore")?.textContent==="70 / 100";'))
            verdict=m.page('''return (async()=>{
              const b=window.wrappedJSObject.browser,challenge=location.hash.slice(1);
              const forbidden=await b.runtime.sendMessage({action:'attachmentDownloadCommand',op:'save',challenge});
              const history=(await b.downloads.search({})).map(item=>item.id);
              return {hidden:document.getElementById('attachmentSaveForm').hidden,blocked:forbidden.code==='ATTACHMENT_BLOCKED',untouched:history.every(id=>arguments[0].includes(id))};
            })();''',[arrangement['downloads']])
            assert all(verdict.values()),verdict
            assert native_dialogs(display)==dialogs_before, 'A blocked original opened an OS save picker'
            all_checks[name]=True
            if name=='inline':
                m.screenshot(out/'attachment-blocked.png')
                dialog_index=m.js('return window.gTabmail.tabInfo.indexOf(window.gTabmail.currentTabInfo);')
                m.page('document.getElementById("attachmentReport").click();')
                wait_for(lambda:m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.startsWith(arguments[0]);',[base+'hybrid_report.html#']))
                wait_for(lambda:m.page('''return (async()=>{
                  const target=await window.wrappedJSObject.browser.runtime.sendMessage({action:'readHybridReport',token:location.hash.slice(1)});
                  return target.success&&target.report.resource.sha256===arguments[0]&&target.report.resourceRef==='attachment:'+arguments[1];
                })();''',[arrangement['hash'],arrangement['part']]))
                all_checks['linkedReport']=True
                m.js('window.gTabmail.switchToTab(arguments[0]);',[dialog_index])
            m.page('document.getElementById("attachmentCancel").click();')
            switch_message()

        dialogs_before=native_dialogs(display)
        wait_for(lambda:m.page(button_click,[arrangement['part']]))
        check_block('inline')

        point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
        native_click(display,point['x'],point['y'])
        popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
        wait_for(lambda:m.page(button_click,[arrangement['part']],browser=popup))
        check_block('popup')
        m.js('document.getElementById("webextension-remote-preload-panel")?.hidePopup();')

        point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,d=b.contentDocument;
          const list=d.getElementById('attachmentList');
          if(list.getBoundingClientRect().height===0)d.getElementById('attachmentToggle').click();
          const first=list.querySelector('richlistitem, .attachmentItem'),r=first.getBoundingClientRect(),p=b.getBoundingClientRect();
          return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
        native_click(display,point['x'],point['y'])
        native_click(display,point['x'],point['y'],button=3)
        shown=wait_for(lambda:m.js('''const doc=window.gTabmail.currentTabInfo.chromeBrowser.contentDocument,popup=doc.getElementById('attachmentItemContext');
          const node=[...popup.querySelectorAll('menuitem')].find(item=>item.getAttribute('label')==='Save with Thundy');
          if(!node||popup.state!=='open')return false;
          return [...doc.getElementById('attachmentList').selectedItems].map(item=>item.attachment.partID);'''))
        assert shown==[arrangement['part']],shown
        m.js('''const doc=window.gTabmail.currentTabInfo.chromeBrowser.contentDocument,popup=doc.getElementById('attachmentItemContext');
          [...popup.querySelectorAll('menuitem')].find(item=>item.getAttribute('label')==='Save with Thundy').doCommand();
          popup.hidePopup();''')
        settings_browser='window.gTabmail.tabInfo['+str(options_index)+'].browser'
        menu=wait_for(lambda:m.page('return window.wrappedJSObject.__attachTest.menu||null;',browser=settings_browser))
        assert menu['parts']==[arrangement['part']] and isinstance(menu.get('tabId'),int),menu
        check_block('menu')

        m.js('window.gTabmail.switchToTab(arguments[0]);',[options_index])
        m.page("""return (async()=>{const p=window.wrappedJSObject.__attachTest;
          await p.bg.updateStore(p.db,'hybridanalysis',p.key,old=>({...old,attachments:old.attachments.map(a=>a.partName===arguments[0]
            ? {...a,hybrid_sha256:'f'.repeat(64),report:{state:'SUCCESS',sha256:'f'.repeat(64),threat_score:5}} : a)}),{...p.scope,preserveReports:true});
        })();""",[arrangement['part']])
        switch_message()
        wait_for(lambda:m.page(button_click,[arrangement['part']]))
        wait_for(lambda:m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.startsWith(arguments[0]);',[base+'attachment_download.html#']))
        wait_for(lambda:m.page('return document.getElementById("attachmentProvenance")?.textContent.includes("Historical Hybrid Analysis finding");'))
        check_block('archive')
        m.js('window.gTabmail.switchToTab(arguments[0]);',[options_index])
        m.page('''const form=document.getElementById('securitySettingsForm');
          form.querySelector('[data-security="attachmentPolicyMode"]').value='warn';
          form.requestSubmit();''')
        wait_for(lambda:m.page('''return window.wrappedJSObject.browser.storage.local.get('thundySecurityV1')
          .then(result=>result.thundySecurityV1?.attachmentPolicy?.mode==='warn');'''))
        all_checks['settings']=True
        switch_message()
        wait_for(lambda:m.page(button_click,[arrangement['part']]))
        wait_for(lambda:m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.startsWith(arguments[0]);',[base+'attachment_download.html#']))
        wait_for(lambda:m.page('return !document.getElementById("attachmentSaveForm")?.hidden;'))
        downloaded=native_download(m,display,out,'attachmentConfirm','thundy-saved-original',save_button=True)
        assert hashlib.sha256(downloaded.read_bytes()).hexdigest()==arrangement['hash']
        all_checks['originalBytes']=True
        m.js('window.gTabmail.switchToTab(arguments[0]);',[options_index])
        all_checks['noProviderRequests']=m.page('return window.wrappedJSObject.__attachTest.providerCalls===0;')
        assert all_checks['noProviderRequests']
    finally:
        m.js('window.gTabmail.switchToTab(arguments[0]);',[options_index])
        m.page('''return (async()=>{const w=window.wrappedJSObject,p=w.__attachTest;if(!p)return;
          p.b.menus.onClicked.removeListener(p.onMenu);p.bg.fetch=p.fetch;await p.bg.putToStore(p.db,'hybridanalysis',p.original);
          await p.b.storage.local.remove(['externalAnalysisConsent','thundySecurityV1'].filter(key=>!Object.hasOwn(p.settings,key)));
          await p.b.storage.local.set(p.settings);await p.bg.loadSettings();delete w.__attachTest;})();''')
    report['attachmentDownload']={'passed':True,**all_checks}
