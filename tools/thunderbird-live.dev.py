#!/usr/bin/env python3
"""Offline integration checks in a real Thunderbird Linux GUI, using a fresh profile."""
import argparse
import base64
import ctypes
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import select
import socket
import subprocess
import sys
import tempfile
import time
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ADDON_ID = 'thundy-av@bludau-it-services.de'
URL = 'https://destination.example.invalid/test?source=thundy'


def wait_for(operation, timeout=20):
    deadline = time.monotonic() + timeout
    while True:
        value = operation()
        if value:
            return value
        if time.monotonic() >= deadline:
            raise TimeoutError('Thunderbird check timed out')
        time.sleep(.1)


class Marionette:
    def __init__(self, port):
        self.socket = socket.create_connection(('127.0.0.1', port), 2)
        self.socket.settimeout(30)
        self.index = 0
        self.read()

    def read(self):
        size = b''
        while not size.endswith(b':'):
            chunk = self.socket.recv(1)
            if not chunk:
                raise RuntimeError('Marionette disconnected')
            size += chunk
        data = b''
        while len(data) < int(size[:-1]):
            chunk = self.socket.recv(int(size[:-1]) - len(data))
            if not chunk:
                raise RuntimeError('Marionette disconnected')
            data += chunk
        return json.loads(data)

    def command(self, name, parameters=None):
        self.index += 1
        data = json.dumps([0, self.index, name, parameters or {}]).encode()
        self.socket.sendall(str(len(data)).encode() + b':' + data)
        result = self.read()
        if result[1] != self.index or result[2]:
            raise RuntimeError(str(result[2] or 'Unexpected Marionette response'))
        return result[3]

    def js(self, script, args=None, asynchronous=False):
        return self.command('WebDriver:ExecuteAsyncScript' if asynchronous else
                            'WebDriver:ExecuteScript', {
            'script': script, 'args': args or [], 'newSandbox': True,
            'sandbox': 'default', 'scriptTimeout': 20000,
        })['value']

    def page(self, script, args=None, browser='window.gTabmail.currentTabInfo.browser'):
        # Thunderbird content tabs require the shipped Marionette actor. No API mocks.
        result = self.js('''const done=arguments[arguments.length-1];
            const target=(''' + browser + ''');
            if(!target?.browsingContext?.currentWindowGlobal){done(null);return;}
            const actor=target.browsingContext.currentWindowGlobal.getActor("MarionetteCommands");
            actor.executeScript(arguments[0],arguments[1],
                {newSandbox:true,sandboxName:"default",async:false})
                .then(done,e=>done({automationError:String(e)}));''',
                         [script, args or []], asynchronous=True)
        if isinstance(result, dict) and 'automationError' in result:
            raise RuntimeError(result['automationError'])
        return result

    def screenshot(self, path):
        path.write_bytes(base64.b64decode(self.command(
            'WebDriver:TakeScreenshot', {'full': True})['value']))


def native_click(display, x, y):
    """XTest sends a real X11 button event, needed for native popup activation."""
    x11 = ctypes.CDLL('libX11.so.6')
    xtest = ctypes.CDLL('libXtst.so.6')
    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XOpenDisplay.restype = ctypes.c_void_p
    x11.XFlush.argtypes = [ctypes.c_void_p]
    x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    xtest.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int,
                                         ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
    xtest.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint,
                                         ctypes.c_int, ctypes.c_ulong]
    connection = x11.XOpenDisplay(display.encode())
    if not connection:
        raise RuntimeError('Cannot connect to isolated Xvfb display')
    try:
        for result in [xtest.XTestFakeMotionEvent(connection, -1, round(x), round(y), 0),
                       xtest.XTestFakeButtonEvent(connection, 1, 1, 0),
                       xtest.XTestFakeButtonEvent(connection, 1, 0, 0)]:
            if not result:
                raise RuntimeError('XTest event failed')
        x11.XFlush(connection)
    finally:
        x11.XCloseDisplay(connection)


def run_checks(m, xpi, out, display, report, locale, langpack, previous_xpi):
    with zipfile.ZipFile(xpi) as package:
        manifest = json.loads(package.read('manifest.json'))
        catalogs = {lang: json.loads(package.read('_locales/' + lang + '/messages.json'))
                    for lang in ['en', 'de', 'fr', 'es', 'it', 'pl']}
    report['extensionVersion'] = manifest['version']
    report['client'] = m.command('WebDriver:NewSession', {
        'capabilities': {'alwaysMatch': {'acceptInsecureCerts': False}}})
    m.command('Marionette:SetContext', {'value': 'chrome'})
    assert m.js('return Services.io.offline;'), 'Client must be offline'
    requested = 'es-ES' if locale == 'es' else locale
    if langpack:
        with zipfile.ZipFile(langpack) as pack:
            pack_manifest = json.loads(pack.read('manifest.json'))
        assert pack_manifest['langpack_id'] == requested
        m.command('Addon:Install', {'path': str(langpack), 'temporary': True})
        wait_for(lambda: m.js('return Services.locale.availableLocales.includes(arguments[0]);', [requested]))
        report['languagePackSha256'] = hashlib.sha256(langpack.read_bytes()).hexdigest()
    m.js('Services.locale.requestedLocales=[arguments[0]];', [requested])
    wait_for(lambda: m.js('return Services.locale.appLocaleAsBCP47.split("-")[0]===arguments[0];', [locale]))
    report['appLocale'] = m.js('return Services.locale.appLocaleAsBCP47;')
    installed = m.command('Addon:Install', {'path': str(previous_xpi or xpi), 'temporary': True})
    assert installed.get('value', installed) == ADDON_ID, installed
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.includes("/onboarding.html");'))
    wait_for(lambda: m.page('return !!document.getElementById("language") && !document.getElementById("next").disabled;'))
    report['uiLanguage'] = m.page('return window.wrappedJSObject.browser.i18n.getUILanguage();')
    assert report['uiLanguage'].split('-')[0] == locale
    wizard_catalogs = catalogs
    if previous_xpi:
        with zipfile.ZipFile(previous_xpi) as previous:
            wizard_catalogs = {lang: json.loads(previous.read('_locales/'+lang+'/messages.json')) for lang in catalogs}
    report['wizardVersion'] = m.page('return window.wrappedJSObject.browser.runtime.getManifest().version;')
    report['wizardLanguages'] = []
    for lang, catalog in wizard_catalogs.items():
        m.page('const e=document.getElementById("language");e.value=arguments[0];e.dispatchEvent(new Event("change",{bubbles:true}));', [lang])
        wait_for(lambda: m.page('return document.documentElement.lang===arguments[0] && !document.getElementById("next").disabled;', [lang]))
        title = m.page('return document.querySelector("h1").textContent;')
        assert title == catalog['wizardTitle']['message'], title
        report['wizardLanguages'].append({'language': lang, 'title': title})
        if lang == 'de':
            m.screenshot(out / 'wizard-de.png')
    for step in [1, 2]:
        m.page('document.getElementById("next").click();')
        assert m.page('return {step:Array.from(document.querySelectorAll("#progress li")).findIndex(e=>e.getAttribute("aria-current")==="step"),focus:document.activeElement.tagName};') == {'step': step, 'focus': 'H2'}
    m.page('document.getElementById("finish").click();')
    state = wait_for(lambda: m.page('return window.wrappedJSObject.browser.storage.local.get(["onboardingState","externalAnalysisConsent","timeOfClickProtection"]).then(s=>s.onboardingState?.status==="completed"?s:null);'))
    assert state.get('externalAnalysisConsent') is not True and state['timeOfClickProtection'] is True
    report['wizardSaved'] = state
    base = m.page('return window.wrappedJSObject.browser.runtime.getURL("");')
    if previous_xpi:
        with zipfile.ZipFile(previous_xpi) as previous:
            previous_version = json.loads(previous.read('manifest.json'))['version']
        assert tuple(map(int, previous_version.split('.'))) < tuple(map(int, manifest['version'].split('.')))
        before = m.js('return window.gTabmail.tabInfo.filter(t=>t.browser?.currentURI.spec.endsWith("/onboarding.html")).length;')
        m.command('Addon:Install', {'path': str(xpi), 'temporary': True})
        wait_for(lambda: m.js('''const done=arguments[arguments.length-1];
            ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager
                .getAddonByID(arguments[0]).then(a=>done(a?.isActive && a.version===arguments[1]));''', [ADDON_ID, manifest['version']], asynchronous=True))
        m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [base+'options.html'])
        wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.endsWith("/options.html");'))
        wait_for(lambda: m.page('return !!document.querySelector(\'input[name="appearance"]\');'))
        saved = m.page('return window.wrappedJSObject.browser.storage.local.get(["onboardingState","externalAnalysisConsent","timeOfClickProtection"]);')
        assert saved == state
        assert m.page('return window.wrappedJSObject.browser.runtime.getManifest().version;') == manifest['version']
        assert m.js('return window.gTabmail.tabInfo.filter(t=>t.browser?.currentURI.spec.endsWith("/onboarding.html")).length;') <= before
        report['upgrade'] = {'from': previous_version, 'to': manifest['version'], 'statePreserved': True,
                             'noExtraWizard': True, 'previousXpiSha256': hashlib.sha256(previous_xpi.read_bytes()).hexdigest()}

    mail = out / 'synthetic.eml'
    mail.write_text('From: sender@example.invalid\nTo: recipient@example.invalid\n'
                    'Date: Thu, 15 Oct 2026 12:00:00 +0000\n'
                    'Message-ID: <thundy-live-test@example.invalid>\n'
                    'Subject: Thundy AV synthetic live test\nMIME-Version: 1.0\n'
                    'Content-Type: text/html; charset=UTF-8\n\n'
                    '<!doctype html><html><body><p>Synthetic offline test message.</p>'
                    '<p><a href="' + URL + '">Test destination</a></p></body></html>\n')
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
        const root=MailServices.accounts.localFoldersServer.rootFolder;
        root.createSubfolder("Thundy Tests",null);const folder=root.getChildNamed("Thundy Tests");
        const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
        MailServices.copy.copyFileMessage(file,folder,null,false,0,"",null,null);''', [str(mail)])
    wait_for(lambda: m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
        return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests").getTotalMessages(false)===1;'''))
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
        const {MailUtils}=ChromeUtils.importESModule("resource:///modules/MailUtils.sys.mjs");
        const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests");
        Services.prefs.setIntPref("mail.openMessageBehavior",2);MailUtils.displayMessage(Array.from(folder.messages)[0]);''')
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.mode.name==="mailMessageTab";'))
    wait_for(lambda: m.page('return document.documentElement.dataset.thundyClickProtection==="true";'))
    m.screenshot(out / 'message.png')
    m.page('document.querySelector("a[href^=https]").click();')
    dialog = wait_for(lambda: m.page('''const p=document.getElementById("thundy-link-dialog");
        const r=p?.shadowRoot;if(r?.querySelectorAll("footer button").length!==2)return null;
        return {text:r.querySelector(".dialog").innerText,width:r.querySelector(".dialog").getBoundingClientRect().width,
            focus:r.activeElement?.textContent,url:r.querySelector("code").textContent};'''))
    assert dialog['width'] >= 500 and dialog['url'] == URL and 'Thundy AV' in dialog['text']
    assert catalogs[locale]['linkDialogTitle']['message'] in dialog['text']
    assert dialog['focus'] == catalogs[locale]['linkCancel']['message']
    report['linkDialog'] = dialog
    m.screenshot(out / 'link-dialog.png')
    m.page('document.getElementById("thundy-link-dialog").shadowRoot.querySelector("footer button").click();')
    assert m.page('return !document.getElementById("thundy-link-dialog") && document.activeElement.href===arguments[0];', [URL])
    # Native toolbar popup: synthetic DOM click/openPopup alone is insufficient here.
    point = m.js('''const t=window.gTabmail.currentTabInfo,b=t.chromeBrowser;
        const r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect();
        const p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,
            y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display, point['x'], point['y'])
    popup = wait_for(lambda: m.js('''const p=document.getElementById("webextension-remote-preload-panel");
        const b=p?.querySelector('browser[webextension-view-type="popup"]');
        return p?.state==="open" && b?.currentURI.spec.endsWith("/popup.html") && b.getBoundingClientRect().width>=500
            ? {panelWidth:p.getBoundingClientRect().width,contentWidth:b.getBoundingClientRect().width}:null;'''))
    popup_browser = 'document.querySelector(\'browser[webextension-view-type="popup"]\')'
    wait_for(lambda: m.page('return document.body.innerText.includes("Thundy AV") && document.body.innerText.includes("sender@example.invalid");', browser=popup_browser))
    assert m.page('return document.documentElement.lang;', browser=popup_browser) == locale
    assert m.page('return document.querySelector("h1").textContent;', browser=popup_browser) == catalogs[locale]['popupSubtitle']['message']
    popup['language'] = locale
    popup['heading'] = catalogs[locale]['popupSubtitle']['message']
    report['nativePopup'] = popup
    # X11 screenshot includes the separate native panel widget.
    subprocess.run(['import', '-window', 'root', str(out / 'native-popup.png')],
                   env={**os.environ, 'DISPLAY': display}, check=True, timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    # Real OS dispatch to a receiver registered only in this run's XDG directories.
    m.page('document.querySelector("a[href^=https]").click();')
    wait_for(lambda: m.page('return document.getElementById("thundy-link-dialog")?.shadowRoot.querySelectorAll("footer button").length===2;'))
    m.page('document.getElementById("thundy-link-dialog").shadowRoot.querySelectorAll("footer button")[1].click();')
    wait_for(lambda: m.page('return !document.getElementById("thundy-link-dialog");'))
    receipt = out / 'os-handoff.json'
    wait_for(lambda: receipt.exists())
    report['osHandoff'] = json.loads(receipt.read_text())
    assert report['osHandoff'] == {'argv': [URL]}, report['osHandoff']
    # Thunderbird 140 resolves its API even when its protocol policy blocks dispatch.
    # Preserve this observed limit: API acceptance alone cannot prove OS delivery.
    delivered = receipt.read_text()
    m.js('Services.prefs.setBoolPref("network.protocol-handler.external.https",false);')
    m.page('document.querySelector("a[href^=https]").click();')
    wait_for(lambda: m.page('return document.getElementById("thundy-link-dialog")?.shadowRoot.querySelectorAll("footer button").length===2;'))
    m.page('document.getElementById("thundy-link-dialog").shadowRoot.querySelectorAll("footer button")[1].click();')
    wait_for(lambda: m.page('return !document.getElementById("thundy-link-dialog");'))
    time.sleep(1)
    assert receipt.read_text() == delivered
    m.js('Services.prefs.clearUserPref("network.protocol-handler.external.https");')
    report['blockedOsDispatch'] = {'apiAccepted': True, 'additionalReceiverCalls': 0,
                                   'observationSeconds': 1, 'protocolPolicy': False}
    m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [base + 'audit.html'])
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser.currentURI.spec.endsWith("/audit.html");'))
    wait_for(lambda: m.page('return document.querySelectorAll("#auditRows tr").length===3 && document.querySelector("#auditRows").innerText.includes("destination.example.invalid");'))
    audit = m.page('return window.wrappedJSObject.browser.runtime.sendMessage({action:"getLinkAudit"});')
    records = audit.get('records', [])
    assert audit['success'] and len(records) == 3, audit
    record = next(r for r in records if r['outcome'] == 'ABORTED')
    assert record['outcome'] == 'ABORTED' and record['url'] == URL and record['scoreAtDecision'] == 0
    assert record['openAttempts'] == 0 and record['cancelReason'] == 'cancel'
    report['auditRecord'] = record
    opened_records = [r for r in records if r['outcome'] == 'OPENED']
    assert len(opened_records) == 2
    opened = min(opened_records, key=lambda r: r['clickedAt'])
    assert opened['url'] == URL and opened['scoreAtDecision'] == 0 and opened['openAttempts'] == 1
    report['openedAuditRecord'] = opened
    report['blockedOsAuditRecord'] = max(opened_records, key=lambda r: r['clickedAt'])
    m.screenshot(out / 'audit.png')
    m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [base + 'options.html'])
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser.currentURI.spec.endsWith("/options.html");'))
    wait_for(lambda: m.page('return !!document.querySelector(\'input[name="appearance"][value="dark"]\');'))
    for name, value in [('appearance', 'dark'), ('accent', 'violet'), ('density', 'compact')]:
        m.page('document.querySelector(\'input[name="\'+arguments[0]+\'"][value="\'+arguments[1]+\'"]\').click();', [name, value])
    theme = wait_for(lambda: m.page('return window.wrappedJSObject.browser.storage.local.get(null).then(s=>s.thundyAppearance==="dark" && s.thundyAccent==="violet" && s.thundyDensity==="compact"?s:null);'))
    assert theme.get('externalAnalysisConsent') is not True
    assert m.page('return document.documentElement.dataset.theme;') == 'dark'
    report['appearanceSaved'] = {k: theme[k] for k in ['thundyAppearance', 'thundyAccent', 'thundyDensity']}
    m.screenshot(out / 'options-dark.png')
    previous = m.js('const b=window.gTabmail.currentTabInfo.browser;const id=b.browsingContext.currentWindowGlobal.innerWindowId;b.reload();return id;')
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser.browsingContext.currentWindowGlobal?.innerWindowId!==arguments[0];', [previous]))
    wait_for(lambda: m.page('return document.documentElement.dataset.theme==="dark" && document.documentElement.dataset.accent==="violet" && document.documentElement.dataset.density==="compact";'))
    assert m.js('return Services.io.offline;')
    wait_for(lambda: m.page('return !!document.querySelector(\'input[name="appearance"][value="system"]\');'))
    report['nativeThemes'] = []
    m.page('document.querySelector(\'input[name="appearance"][value="system"]\').click();')
    wait_for(lambda: m.page('return document.documentElement.dataset.appearance==="system";'))
    for scheme in ['dark', 'light']:
        m.js('''const done=arguments[arguments.length-1];
            ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager
                .getAddonByID("thunderbird-compact-"+arguments[0]+"@mozilla.org")
                .then(a=>a.enable()).then(()=>done(true),e=>done({error:String(e)}));''', [scheme], asynchronous=True)
        wait_for(lambda: m.page('return document.documentElement.dataset.theme===arguments[0];', [scheme]))
        report['nativeThemes'].append(scheme)
        m.screenshot(out / ('options-native-' + scheme + '.png'))
    report['localizedPages'] = []
    for page, key in [('options.html', 'ui_116'), ('audit.html', 'auditTitle'),
                      ('enterprise_setup.html', 'profilesTitle'), ('privacy.html', 'ui_128')]:
        m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [base + page])
        wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.endsWith(arguments[0]);', [page]))
        expected = catalogs[locale][key]['message']
        wait_for(lambda: m.page('return document.documentElement.lang===arguments[0] && document.querySelector("h1")?.textContent===arguments[1];', [locale, expected]))
        report['localizedPages'].append({'page': page, 'language': locale, 'heading': expected})
        m.screenshot(out / (page.replace('.html', '') + '-' + locale + '.png'))
    report['passed'] = True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--thunderbird', type=Path, required=True)
    parser.add_argument('--xvfb', type=Path, required=True)
    parser.add_argument('--xpi', type=Path, required=True)
    parser.add_argument('--previous-xpi', type=Path)
    parser.add_argument('--locale', choices=['en', 'de', 'fr', 'es', 'it', 'pl'], default='en')
    parser.add_argument('--langpack', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / '.audit/thunderbird-live')
    args = parser.parse_args()
    if not __debug__:
        parser.error("Run without Python optimization so assertions remain enabled")
    for name in ['thunderbird', 'xvfb', 'xpi']:
        setattr(args, name, getattr(args, name).resolve(strict=True))
    if args.locale != 'en' and not args.langpack:
        parser.error('Non-English runs require the corresponding Thunderbird --langpack')
    if args.previous_xpi:
        args.previous_xpi = args.previous_xpi.resolve(strict=True)
    if args.langpack:
        args.langpack = args.langpack.resolve(strict=True)
    out = args.out.resolve()
    # Fresh output prevents old reports/screenshots from being mistaken for new evidence.
    out.mkdir(parents=True, exist_ok=False, mode=0o700)
    report = {'passed': False, 'scope': 'Linux X11 GUI; synthetic plaintext; offline; no API mocks',
              'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'xpiSha256': hashlib.sha256(args.xpi.read_bytes()).hexdigest(),
              'binarySha256': hashlib.sha256(args.thunderbird.read_bytes()).hexdigest()}
    xvfb = tb = m = None
    try:
        with tempfile.TemporaryDirectory(prefix='thundy-tb-profile-') as directory, \
                (out / 'xvfb.log').open('w') as xlog, (out / 'thunderbird.log').open('w') as log, \
                ExitStack() as cleanup:
            profile = Path(directory)
            with socket.socket() as port_socket:
                port_socket.bind(('127.0.0.1', 0))
                port = port_socket.getsockname()[1]
            prefs = {'marionette.port': port, 'marionette.enabled': True,
                     'app.update.enabled': False, 'app.update.auto': False,
                     'extensions.update.enabled': False, 'extensions.getAddons.showPane': False,
                     'toolkit.telemetry.enabled': False, 'datareporting.healthreport.uploadEnabled': False,
                     'datareporting.policy.dataSubmissionEnabled': False,
                     'mailnews.start_page.enabled': False, 'mail.provider.enabled': False,
                     'mail.shell.checkDefaultClient': False, 'browser.shell.checkDefaultBrowser': False,
                     'mailnews.start_page.override_url': 'about:blank',
                     'mail.accountmanager.accounts': 'account1',
                     'mail.accountmanager.localfoldersserver': 'server1',
                     'mail.account.account1.server': 'server1',
                     'mail.server.server1.hostname': 'Local Folders', 'mail.server.server1.type': 'none',
                     'mail.server.server1.userName': 'nobody', 'mail.server.server1.name': 'Local Folders',
                     'mail.server.server1.directory-rel': '[ProfD]Mail/Local Folders',
                     'network.manage-offline-status': False}
            (profile / 'Mail/Local Folders').mkdir(parents=True)
            (profile / 'user.js').write_text('\n'.join('user_pref(' + json.dumps(k) + ', ' +
                                                     json.dumps(v) + ');' for k, v in prefs.items()))
            xvfb = subprocess.Popen([str(args.xvfb), '-displayfd', '1', '-screen', '0',
                                     '1280x1000x24', '-nolisten', 'tcp'], stdout=subprocess.PIPE,
                                    stderr=xlog, text=True)
            cleanup.callback(stop, xvfb)
            if not select.select([xvfb.stdout], [], [], 15)[0]:
                raise TimeoutError('Xvfb did not initialize')
            display = ':' + xvfb.stdout.readline().strip()
            if not display[1:].isdigit():
                raise RuntimeError('Invalid Xvfb display')
            data_home = profile / 'xdg-data'
            config_home = profile / 'xdg-config'
            applications = data_home / 'applications'
            applications.mkdir(parents=True)
            config_home.mkdir()
            receiver = profile / 'receive-url.py'
            receiver.write_text('import json,sys\nfrom pathlib import Path\nPath(' +
                                repr(str(out / 'os-handoff.json')) + ').open("a").write(json.dumps({"argv":sys.argv[1:]})+"\\n")\n')
            # Desktop Entry Exec arguments use double quotes and escaped special characters.
            def desktop_quote(value):
                return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$') + '"'
            (applications / 'thundy-test.desktop').write_text(
                '[Desktop Entry]\nType=Application\nName=Thundy integration receiver\n'
                'NoDisplay=true\nTerminal=false\nExec=' + desktop_quote(sys.executable) + ' ' +
                desktop_quote(receiver) + ' %u\nMimeType=x-scheme-handler/http;x-scheme-handler/https;\n')
            (config_home / 'mimeapps.list').write_text('[Default Applications]\n'
                'x-scheme-handler/http=thundy-test.desktop\nx-scheme-handler/https=thundy-test.desktop\n')
            tb = subprocess.Popen([str(args.thunderbird), '--no-remote', '--profile', str(profile),
                                   '--marionette', '--remote-allow-system-access', '-offline'],
                                  env={**os.environ, 'DISPLAY': display, 'XDG_DATA_HOME': str(data_home),
                                       'XDG_CONFIG_HOME': str(config_home)}, stdout=log, stderr=subprocess.STDOUT)
            cleanup.callback(stop, tb)
            def connect():
                if tb.poll() is not None:
                    raise RuntimeError('Thunderbird exited during startup')
                try:
                    return Marionette(port)
                except (ConnectionRefusedError, socket.timeout):
                    return None
            m = wait_for(connect, 30)
            try:
                run_checks(m, args.xpi, out, display, report, args.locale, args.langpack, args.previous_xpi)
            except Exception:
                try:
                    m.screenshot(out / 'failure.png')
                except (OSError, RuntimeError):
                    pass
                raise
            finally:
                # Stop processes before TemporaryDirectory removes this run's profile.
                if m:
                    try:
                        m.command('WebDriver:DeleteSession')
                    except (OSError, RuntimeError):
                        pass
                    m.socket.close()
                    m = None
                stop(tb)
                stop(xvfb)
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        stop(tb)
        stop(xvfb)
        report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'passed': report['passed'], 'report': str(out / 'report.json')}))


def stop(process):
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


if __name__ == '__main__':
    main()
