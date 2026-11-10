"""Native IMAP lifecycle research; privileged mutations are not extension rights."""
from email.parser import BytesParser
from email.policy import default
import hashlib
import imaplib
import json
from pathlib import Path
import time

NAMES = ['ThundyLifecycleSource', 'ThundyLifecycleCopy', 'ThundyLifecycleMoved']
SUBJECT = 'Thundy IMAP identity lifecycle'


def check(m, base, out, report, restart, fixture):
    state = json.loads(Path(fixture).read_text())
    assert state['host'] == '127.0.0.1' and state['realImapServer']
    client = imaplib.IMAP4(state['host'], state['port'], timeout=10)
    try:
        client.login('fixture', 'synthetic-fixture')
        for name in NAMES:
            assert client.create(name)[0] == 'OK'
            assert client.subscribe(name)[0] == 'OK'
        for body in ['AAAA', 'BBBB']:
            message = ('From: fixture@example.invalid\r\nSubject: ' + SUBJECT + '\r\n'
                       'Message-ID: <imap-lifecycle-duplicate@example.invalid>\r\n'
                       'Date: Tue, 10 Nov 2026 08:00:00 +0000\r\n'
                       'Content-Type: text/plain; charset=us-ascii\r\n\r\n' + body + '\r\n').encode()
            assert client.append(NAMES[0], None, None, message)[0] == 'OK'
    finally:
        client.logout()

    def wait(operation, seconds=30):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            value = operation()
            if value:
                return value
            time.sleep(.1)
        raise TimeoutError('Native IMAP lifecycle condition timed out')

    root = '''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const server=[...MailServices.accounts.allServers].find(s=>s.type==='imap');if(!server)throw Error('Isolated IMAP account missing: '+JSON.stringify([...MailServices.accounts.allServers].map(s=>({type:s.type,host:s.hostName,port:s.port}))));Services.io.offline=false;server.password='synthetic-fixture';const root=server.rootFolder;'''
    m.js(root + 'server.performExpand(window.msgWindow);')
    wait(lambda: m.js(root + 'return arguments[0].every(name=>root.containsChildNamed(name));', [NAMES]))
    for name, count in zip(NAMES, [2, 0, 0]):
        m.js(root + 'MailServices.imap.selectFolder(root.getChildNamed(arguments[0]),null,null);', [name])
        wait(lambda: m.js(root + 'return root.getChildNamed(arguments[0]).getTotalMessages(false)===arguments[1];', [name, count]))
    stages = {}
    report['imapLifecycle'] = {'passed': False, 'stages': stages,
        'mutationActor': 'Privileged test harness; no added extension permissions',
        'helperSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}

    def page():
        m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [base+'options.html'])
        wait(lambda: m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.endsWith("/options.html");'))
        wait(lambda: m.page('return document.readyState==="complete";'))

    def observe(stage, expected):
        def snapshot():
            return m.page('''return (async()=>{const b=window.wrappedJSObject.browser;let list=await b.messages.query({subject:arguments[0]});const rows=[];
              while(true){for(const message of list.messages){if(message.subject!==arguments[0])continue;const raw=await b.messages.getRaw(message.id,{decrypt:false,data_format:'BinaryString'});rows.push({id:message.id,headerMessageId:message.headerMessageId,folderId:message.folderId??message.folder?.id??null,read:message.read,flagged:message.flagged,raw});}if(!list.id)break;list=await b.messages.continueList(list.id);}return rows;})();''', [SUBJECT])
        rows = wait(lambda: (rows if len(rows := snapshot()) == expected else None))
        for row in rows:
            raw = row.pop('raw').encode('latin1')
            row['rawSha256'] = hashlib.sha256(raw).hexdigest()
            row['bodySha256'] = hashlib.sha256(BytesParser(policy=default).parsebytes(raw).get_payload(decode=True)).hexdigest()
        assert len({row['id'] for row in rows}) == expected
        assert len({row['headerMessageId'] for row in rows}) == 1
        stages[stage] = {'messages': rows, 'folderCounts': m.js(root + 'return arguments[0].map(name=>root.getChildNamed(name).getTotalMessages(false));', [NAMES])}
        return rows

    page()
    audit = m.page('return window.wrappedJSObject.browser.storage.local.get("linkAuditLog");')
    rights = m.page('''return (async()=>{const b=window.wrappedJSObject.browser;return {accountsRead:await b.permissions.contains({permissions:['accountsRead']}),onMoved:!!b.messages.onMoved,onCopied:!!b.messages.onCopied,onDeleted:!!b.messages.onDeleted};})();''')
    assert not any(rights.values()), rights
    initial = observe('initial', 2)
    assert len({r['bodySha256'] for r in initial}) == 2
    keys = m.js(root + 'return [...root.getChildNamed(arguments[0]).messages].map(h=>h.messageKey).sort((a,b)=>a-b);', [NAMES[0]])
    for key, destination, move in [(keys[0], NAMES[1], False), (keys[1], NAMES[2], True)]:
        result = m.js(root + '''const done=arguments[arguments.length-1],source=root.getChildNamed(arguments[0]);
          MailServices.copy.copyMessages(source,[source.GetMessageHeader(arguments[1])],root.getChildNamed(arguments[2]),arguments[3],
            {onStartCopy(){},onProgress(){},setMessageKey(){},getMessageId(){return null;},onStopCopy(status){done({status});},QueryInterface:ChromeUtils.generateQI(['nsIMsgCopyServiceListener'])},null,false);''', [NAMES[0], key, destination, move], asynchronous=True)
        assert result['status'] == 0, result
        rows = observe('moved' if move else 'copied', 3)
        assert {r['bodySha256'] for r in rows} == {r['bodySha256'] for r in initial}
        if move:
            assert sorted(r['bodySha256'] for r in rows) == sorted(r['bodySha256'] for r in stages['copied']['messages'])
        else:
            assert sorted(sum(r['bodySha256'] == key for r in rows) for key in {r['bodySha256'] for r in rows}) == [1, 2]
    m.js(root + 'const folder=root.getChildNamed(arguments[0]),headers=[...folder.messages];folder.markMessagesRead(headers,true);folder.markMessagesFlagged(headers,true);', [NAMES[0]])
    wait(lambda: any(r['read'] and r['flagged'] for r in observe('flagsChanged', 3)))
    result = m.js(root + '''const done=arguments[arguments.length-1],folder=root.getChildNamed(arguments[0]);folder.deleteMessages([...folder.messages],window.msgWindow,true,false,
      {onStartCopy(){},onProgress(){},setMessageKey(){},getMessageId(){return null;},onStopCopy(status){done({status});},QueryInterface:ChromeUtils.generateQI(['nsIMsgCopyServiceListener'])},false);''', [NAMES[0]], asynchronous=True)
    assert result['status'] == 0, result
    remaining = observe('deleted', 2)
    for name in NAMES:
        result = m.js(root + '''const done=arguments[arguments.length-1];root.getChildNamed(arguments[0]).compact({OnStartRunningUrl(){},OnStopRunningUrl(url,status){done({status});},QueryInterface:ChromeUtils.generateQI(['nsIUrlListener'])},null);''', [name], asynchronous=True)
        assert result['status'] == 0, result
    compacted = observe('compacted', 2)
    assert sorted(r['bodySha256'] for r in compacted) == sorted(r['bodySha256'] for r in remaining)
    m.js('for(const tab of [...window.gTabmail.tabInfo])if(tab.mode.name==="mailMessageTab"||tab.browser?.currentURI.spec.startsWith("moz-extension:"))window.gTabmail.closeTab(tab);')
    m = restart()
    page()
    after = observe('restarted', 2)
    assert sorted(r['bodySha256'] for r in after) == sorted(r['bodySha256'] for r in compacted)
    assert m.page('return window.wrappedJSObject.browser.storage.local.get("linkAuditLog");') == audit
    assert stages['restarted']['folderCounts'] == [0, 1, 1]
    report['imapLifecycle'].update(passed=True, realThunderbirdAPIs=True, realImapServer=True,
        loopbackOnly=True, synthetic=True, liveProviderCalls=False, auditUnchanged=True, permissions=rights,
        scope='Actual IMAP copy/move/flags/delete/compact/restart with read-only extension observations. No durable occurrence inference, retention change or permission addition.')
    return m
