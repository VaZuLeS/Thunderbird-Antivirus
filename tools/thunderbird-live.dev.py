#!/usr/bin/env python3
"""Offline integration checks in a real Thunderbird Linux GUI, using a fresh profile."""
import argparse
import base64
import ctypes
from contextlib import ExitStack
import hashlib
import http.server
import ssl
import threading
from urllib.parse import urlparse
import json
import os
from pathlib import Path
import select
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import zipfile
from email.message import EmailMessage
from email.policy import SMTP
from email.parser import BytesParser

ROOT = Path(__file__).resolve().parents[1]
ADDON_ID = 'thundy-av@bludau-it-services.de'
URL = 'https://destination.example.invalid/test?source=thundy'


class NavigationInProgress(RuntimeError):
    """A read-only readiness query lost its document during navigation."""


def wait_for(operation, timeout=20):
    deadline = time.monotonic() + timeout
    while True:
        try:
            value = operation()
        except NavigationInProgress:
            value = None
        if value:
            return value
        if time.monotonic() >= deadline:
            raise TimeoutError('Thunderbird check timed out')
        time.sleep(.1)


class Marionette:
    def __init__(self, port):
        self.socket = socket.create_connection(('127.0.0.1', port), 2)
        self.socket.settimeout(40)
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
            'sandbox': 'default', 'scriptTimeout': 35000,
        })['value']

    def page(self, script, args=None, browser='window.gTabmail.currentTabInfo.browser'):
        # Thunderbird content tabs require the shipped Marionette actor. No API mocks.
        result = self.js('''const done=arguments[arguments.length-1];
            const target=(''' + browser + ''');
            if(!target?.browsingContext?.currentWindowGlobal){done(null);return;}
            const actor=target.browsingContext.currentWindowGlobal.getActor("MarionetteCommands");
            actor.executeScript(arguments[0],arguments[1],
                {newSandbox:true,sandboxName:"default",async:false,timeout:30000})
                .then(done,e=>done({automationError:String(e)}));''',
                         [script, args or []], asynchronous=True)
        if isinstance(result, dict) and 'automationError' in result:
            error = result['automationError']
            if error.startswith("AbortError: Actor 'MarionetteCommands' destroyed before query"):
                raise NavigationInProgress(error)
            if 'document.documentElement is null' in error:
                # Read-only readiness probes can race document replacement.
                # Only wait_for retries this; write/click calls are not replayed.
                raise NavigationInProgress(error)
            raise RuntimeError(error)
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


def native_key(display, name):
    """A real X11 key press, used after focusing a native document control."""
    x11=ctypes.CDLL('libX11.so.6');xtest=ctypes.CDLL('libXtst.so.6')
    x11.XOpenDisplay.argtypes=[ctypes.c_char_p];x11.XOpenDisplay.restype=ctypes.c_void_p
    x11.XStringToKeysym.argtypes=[ctypes.c_char_p];x11.XStringToKeysym.restype=ctypes.c_ulong
    x11.XKeysymToKeycode.argtypes=[ctypes.c_void_p,ctypes.c_ulong];x11.XKeysymToKeycode.restype=ctypes.c_uint
    x11.XFlush.argtypes=[ctypes.c_void_p];x11.XCloseDisplay.argtypes=[ctypes.c_void_p]
    xtest.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
    connection=x11.XOpenDisplay(display.encode())
    if not connection: raise RuntimeError('Cannot open keyboard display')
    try:
        code=x11.XKeysymToKeycode(connection,x11.XStringToKeysym(name.encode()))
        if not code or not xtest.XTestFakeKeyEvent(connection,code,1,0) or not xtest.XTestFakeKeyEvent(connection,code,0,0): raise RuntimeError('Cannot send keyboard event')
        x11.XFlush(connection)
    finally: x11.XCloseDisplay(connection)


def native_save_path(display, path, save_button=False):
    """Type an ASCII location in the genuine GTK file picker with XTest."""
    x11 = ctypes.CDLL('libX11.so.6'); xtest = ctypes.CDLL('libXtst.so.6')
    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]; x11.XOpenDisplay.restype = ctypes.c_void_p
    x11.XStringToKeysym.argtypes = [ctypes.c_char_p]; x11.XStringToKeysym.restype = ctypes.c_ulong
    x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]; x11.XKeysymToKeycode.restype = ctypes.c_uint
    x11.XFlush.argtypes = [ctypes.c_void_p]; x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    xtest.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
    connection = x11.XOpenDisplay(display.encode())
    if not connection: raise RuntimeError('Cannot open save-picker display')
    def key(name, pressed):
        code = x11.XKeysymToKeycode(connection, x11.XStringToKeysym(name.encode()))
        if not code or not xtest.XTestFakeKeyEvent(connection, code, pressed, 0): raise RuntimeError('Cannot type save path')
        x11.XFlush(connection)
    try:
        key('Control_L',1); key('l',1); key('l',0); key('Control_L',0)
        time.sleep(.35)
        # Select the entire editable location explicitly; GTK may retain a
        # previous filename or completion while the picker finishes loading.
        key('Control_L',1); key('a',1); key('a',0); key('Control_L',0)
        names = {'/':'slash','.':'period','-':'minus','_':'underscore'}
        for char in str(path):
            shifted = char.isupper() or char == '_'
            if shifted: key('Shift_L',1)
            key(names.get(char,char),1); key(names.get(char,char),0)
            if shifted: key('Shift_L',0)
            time.sleep(.01)
        time.sleep(.2)
        if save_button:
            key('Alt_L',1);key('s',1);key('s',0);key('Alt_L',0)
        else:
            key('Return',1);key('Return',0)
    finally: x11.XCloseDisplay(connection)


def native_download(m, display, out, button, stem, browser='window.gTabmail.currentTabInfo.browser', button_browser=None, save_button=False):
    known = m.page('return window.wrappedJSObject.browser.downloads.search({}).then(items=>items.map(item=>item.id));',browser=browser)
    m.page('document.getElementById(arguments[0]).click();', [button],browser=button_browser or browser)
    time.sleep(1)
    native_save_path(display, out / stem, save_button=save_button)
    def completed():
        return m.page('''const known=new Set(arguments[0]);return window.wrappedJSObject.browser.downloads.search({}).then(items=>items.find(item=>!known.has(item.id)&&item.state==="complete")||null);''', [known],browser=browser)
    try: item = wait_for(completed, timeout=40)
    except TimeoutError:
        subprocess.run(['import','-window','root',str(out/(stem+'-failure.png'))], env={**os.environ,'DISPLAY':display},check=True,timeout=10)
        raise
    actual = Path(item['filename'])
    assert actual.parent.resolve() == out.resolve(), 'Download escaped the selected test directory'
    return actual


def native_json_download(m, display, out, button, stem):
    actual = native_download(m,display,out,button,stem)
    # GTK can add/retain filename extensions. Bind to the actual newly completed
    # download ID and content, never an older file or an assumed basename.
    def content():
        try: return json.loads(actual.read_text())
        except (FileNotFoundError,json.JSONDecodeError): return None
    return wait_for(content)


def run_checks(m, xpi, out, display, report, locale, langpack, previous_xpi, permanent=False, audit_only=False, banner_root_shot=False, message_kib=0):
    with zipfile.ZipFile(xpi) as package:
        manifest = json.loads(package.read('manifest.json'))
        catalogs = {lang: json.loads(package.read('_locales/' + lang + '/messages.json'))
                    for lang in ['en', 'de', 'fr', 'es', 'it', 'pl']}
    expected_score = 40 if urlparse(URL).hostname == '127.0.0.1' else 0
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
        m.command('Addon:Install', {'path': str(langpack), 'temporary': not permanent})
        wait_for(lambda: m.js('return Services.locale.availableLocales.includes(arguments[0]);', [requested]))
        report['languagePackSha256'] = hashlib.sha256(langpack.read_bytes()).hexdigest()
    m.js('Services.locale.requestedLocales=[arguments[0]];', [requested])
    wait_for(lambda: m.js('return Services.locale.appLocaleAsBCP47.split("-")[0]===arguments[0];', [locale]))
    report['appLocale'] = m.js('return Services.locale.appLocaleAsBCP47;')
    installed = m.command('Addon:Install', {'path': str(previous_xpi or xpi), 'temporary': not permanent})
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
        m.command('Addon:Install', {'path': str(xpi), 'temporary': not permanent})
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
                    '<p><a href="' + URL + '">Test destination</a></p>' +
                    ('<p>Ordinary local newsletter content for a repeatable measurement.</p>' * (message_kib * 1024 // 69)) + '</body></html>\n')
    report['syntheticMessageBytes'] = mail.stat().st_size
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
    if banner_root_shot:
        def banner_probe():
            return m.page('''const o=document.getElementById("thundy-optin-banner");
                const t=document.getElementById("thundy-threat-banner");
                const r={optin:null,threat:null};
                if(o){const b=o.querySelectorAll("button");
                    r.optin={text:o.innerText,buttons:b.length,
                        labels:Array.from(b).map(x=>x.textContent)};}
                if(t){r.threat={text:t.innerText};}
                return (o||t)?r:null;''')
        state = wait_for(banner_probe, 60)
        report['bannerProbe'] = state
        if state.get('optin') and state['optin'].get('buttons') in (2, 3) and 'Thundy AV' in state['optin'].get('text', ''):
            subprocess.run(['import', '-window', 'root', str(out / 'optin-banner.png')],
                           env={**os.environ, 'DISPLAY': display}, check=True, timeout=10)
        if state.get('threat'):
            subprocess.run(['import', '-window', 'root', str(out / 'threat-banner.png')],
                           env={**os.environ, 'DISPLAY': display}, check=True, timeout=10)
    m.page('document.querySelector("a[href^=http]").click();')
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
    m.page('document.querySelector("a[href^=http]").click();')
    wait_for(lambda: m.page('return document.getElementById("thundy-link-dialog")?.shadowRoot.querySelectorAll("footer button").length===2;'))
    m.page('document.getElementById("thundy-link-dialog").shadowRoot.querySelectorAll("footer button")[1].click();')
    wait_for(lambda: m.page('return !document.getElementById("thundy-link-dialog");'))
    receipt = out / 'os-handoff.json'
    def completed_receipt():
        try: return json.loads(receipt.read_text())
        except (FileNotFoundError, json.JSONDecodeError): return None
    report['osHandoff'] = wait_for(completed_receipt)
    assert report['osHandoff'] == {'argv': [URL]}, report['osHandoff']
    # Thunderbird 140 resolves its API even when its protocol policy blocks dispatch.
    # Preserve this observed limit: API acceptance alone cannot prove OS delivery.
    delivered = receipt.read_text()
    m.js('Services.prefs.setBoolPref("network.protocol-handler.external.https",false);')
    m.page('document.querySelector("a[href^=http]").click();')
    wait_for(lambda: m.page('return document.getElementById("thundy-link-dialog")?.shadowRoot.querySelectorAll("footer button").length===2;'))
    m.page('document.getElementById("thundy-link-dialog").shadowRoot.querySelectorAll("footer button")[1].click();')
    wait_for(lambda: m.page('return !document.getElementById("thundy-link-dialog");'))
    time.sleep(1)
    assert receipt.read_text() == delivered
    m.js('Services.prefs.clearUserPref("network.protocol-handler.external.https");')
    report['blockedOsDispatch'] = {'apiAccepted': True, 'additionalReceiverCalls': 0,
                                   'observationSeconds': 1, 'protocolPolicy': False}
    m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [base + 'audit.html'])
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.endsWith("/audit.html");'))
    wait_for(lambda: m.page('return document.querySelectorAll("#auditRows tr").length===3 && document.querySelector("#auditRows").innerText.includes(arguments[0]);', [urlparse(URL).hostname]))
    audit = m.page('return window.wrappedJSObject.browser.runtime.sendMessage({action:"getLinkAudit"});')
    records = audit.get('records', [])
    assert audit['success'] and len(records) == 3, audit
    record = next(r for r in records if r['outcome'] == 'ABORTED')
    assert record['outcome'] == 'ABORTED' and record['url'] == URL and record['scoreAtDecision'] == expected_score
    assert record['openAttempts'] == 0 and record['cancelReason'] == 'cancel'
    report['auditRecord'] = record
    opened_records = [r for r in records if r['outcome'] == 'OPENED']
    assert len(opened_records) == 2
    opened = min(opened_records, key=lambda r: r['clickedAt'])
    assert opened['url'] == URL and opened['scoreAtDecision'] == expected_score and opened['openAttempts'] == 1
    report['openedAuditRecord'] = opened
    report['blockedOsAuditRecord'] = max(opened_records, key=lambda r: r['clickedAt'])
    m.screenshot(out / 'audit.png')
    if audit_only:
        return
    m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [base + 'options.html'])
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.endsWith("/options.html");'))
    wait_for(lambda: m.page('return !document.querySelector(\'input[name="appearance"][value="dark"]\')?.disabled && !!document.querySelector(\'input[name="appearance"][value="dark"]\');'))
    # HTML inputs may precede DOMContentLoaded/theme listener initialization.
    # Wait for the ready status instead of replaying a potentially lost click.
    wait_for(lambda: m.page('return document.getElementById("themeStatus")?.textContent===arguments[0];', [catalogs[locale]['themeReady']['message']]))
    for name, value in [('appearance', 'dark'), ('accent', 'violet'), ('density', 'compact')]:
        m.page('document.querySelector(\'input[name="\'+arguments[0]+\'"][value="\'+arguments[1]+\'"]\').click();', [name, value])
    theme = wait_for(lambda: m.page('return window.wrappedJSObject.browser.storage.local.get(null).then(s=>s.thundyAppearance==="dark" && s.thundyAccent==="violet" && s.thundyDensity==="compact"?s:null);'))
    assert theme.get('externalAnalysisConsent') is not True
    assert m.page('return document.documentElement.dataset.theme;') == 'dark'
    report['appearanceSaved'] = {k: theme[k] for k in ['thundyAppearance', 'thundyAccent', 'thundyDensity']}
    m.screenshot(out / 'options-dark.png')
    previous = m.js('const b=window.gTabmail.currentTabInfo.browser;const id=b.browsingContext.currentWindowGlobal.innerWindowId;b.reload();return id;')
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser?.browsingContext.currentWindowGlobal?.innerWindowId!==arguments[0];', [previous]))
    wait_for(lambda: m.page('return document.documentElement.dataset.theme==="dark" && document.documentElement.dataset.accent==="violet" && document.documentElement.dataset.density==="compact";'))
    assert m.js('return Services.io.offline;')
    wait_for(lambda: m.page('return !document.querySelector(\'input[name="appearance"][value="system"]\')?.disabled && !!document.querySelector(\'input[name="appearance"][value="system"]\');'))
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
    if tuple(map(int, manifest['version'].split('.'))) >= (1, 24, 3):
        check_followup(m, base, out, report, display, catalogs[locale])
    report['passed'] = True


def import_appearance_profile(m, profile):
    m.page('''const input=document.getElementById("localProfileInput");input.value=arguments[0];input.dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("localProfilePreview").click();''', [json.dumps(profile)])
    wait_for(lambda: m.page('return !document.getElementById("localProfileApply").disabled;'))
    m.page('document.getElementById("localProfileApply").click();')
    wait_for(lambda: m.page('''return window.wrappedJSObject.browser.storage.local.get(["thundyAppearance","thundyAccent","thundyDensity"]).then(s=>s.thundyAppearance===arguments[0]&&s.thundyAccent===arguments[1]&&s.thundyDensity===arguments[2]);''', [profile['appearance']['mode'],profile['appearance']['accent'],profile['appearance']['density']]))

    wait_for(lambda: m.page('return !document.getElementById("localProfileExport").disabled && document.getElementById("localProfileDiff").hidden;'))


def check_followup(m, base, out, report, display, source_catalog):
    """Real extension APIs, synthetic MIME, no provider credentials or API mocks."""
    open_page(m, base + 'options.html')
    wait_for(lambda: m.page('return !!document.getElementById("supportPreview");'))
    original = storage_snapshot(m)
    profile = {'schemaVersion':1,'kind':'thundy-local-settings','appearance':{'mode':'dark','accent':'violet','density':'compact'}}
    import_appearance_profile(m, profile)
    imported = storage_snapshot(m)
    assert all(imported.get(key)==value for key,value in original.items() if key not in ['thundyAppearance','thundyAccent','thundyDensity'])
    assert native_json_download(m, display, out, 'localProfileExport', 'appearance-profile') == profile
    report['appearanceProfile'] = {'passed':True,'confirmedUiImport':True,'realDownloadsAPI':True,'unrelatedDataPreserved':True}
    m.screenshot(out / 'appearance-profile.png')
    m.page('document.getElementById("supportPreview").click();')
    preview = wait_for(lambda: m.page('return document.getElementById("supportContent").hidden?null:document.getElementById("supportContent").textContent;'))
    diagnostic = json.loads(preview)
    assert diagnostic['authenticatedSource'] is False and 'configuration' not in diagnostic
    assert diagnostic['extensionVersion'] == report['extensionVersion']
    assert not any(key in preview for key in ['apikey', 'messageId', 'profileId', 'linkAuditLog'])
    report['supportPreview'] = {'passed': True, 'minimal': True, 'configurationOmitted': True}
    m.screenshot(out / 'support-preview.png')
    assert native_json_download(m, display, out, 'supportSave', 'support-download') == diagnostic
    report['supportDownload'] = {'passed': True, 'realDownloadsAPI': True, 'nativeFilePicker': True}
    # Import actual MIME through Thunderbird's copy service, then use actual
    # messages APIs from its extension context. There are no attachment API doubles.
    mail = out / 'followup.eml'
    body = 'From: sender@example.invalid\nTo: recipient@example.invalid\nSubject: Thundy followup MIME\nMessage-ID: <followup@example.invalid>\nAuthentication-Results: mx.example.invalid; spf=passage; dkim=passage; dmarc=passage\nMIME-Version: 1.0\nContent-Type: multipart/mixed; boundary="thundy"\n\n--thundy\nContent-Type: text/plain\n\nSynthetic offline fixture.\n'
    if 'analysisResources' in source_catalog:
        body += 'https://fixture.invalid/one?token=one\nhttps://fixture.invalid/two?token=two\n'
    for index in range(101):
        name = 'same.txt' if 'analysisResources' in source_catalog and index < 2 else 'sample-' + str(index) + '.txt'
        body += '--thundy\nContent-Type: text/plain\nContent-Disposition: attachment; filename="' + name + '"\n\nhello\n'
    mail.write_text(body + '--thundy--\n')
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
        const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests");
        const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
        MailServices.copy.copyFileMessage(file,folder,null,false,0,"",null,null);''', [str(mail)])
    wait_for(lambda: m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
        return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests").getTotalMessages(false)===2;'''))
    probe = m.page('''return (async()=>{
        const b=window.wrappedJSObject.browser;
        const raw=await b.runtime.getBackgroundPage(); const bg=raw.wrappedJSObject || raw;
        const list=await b.messages.query({subject:"Thundy followup MIME"});
        const message=list.messages.find(m=>m.subject==="Thundy followup MIME");
        if(!message) throw new Error("Imported fixture missing");
        const previous=await b.storage.local.get("trustedAuthServers");
        await b.storage.local.set({trustedAuthServers:["mx.example.invalid"]});
        let risk;
        try {risk=await b.runtime.sendMessage({action:"getLocalRisk",messageId:message.id});}
        finally {if(previous.trustedAuthServers===undefined)await b.storage.local.remove("trustedAuthServers");else await b.storage.local.set(previous);}
        await bg.processAttachments(message,false,false);
        const db=await bg.getSharedDB();const stored=await bg.getFromStore(db,"hybridanalysis",message.headerMessageId);
        const auditBefore=await b.storage.local.get("linkAuditLog");
        const benchmark=[];
        try {
          for(const count of [0,50,2000]){
            await b.storage.local.set({linkAuditLog:Array.from({length:count},(_,i)=>({id:String(i),clickedAt:Date.now()-i,url:"https://benchmark.invalid/"+i,outcome:"PENDING",decidedAt:null}))});
            const start=performance.now();for(let i=0;i<3;i++)await bg.readLinkAudit();
            benchmark.push({count,meanReadMs:(performance.now()-start)/3});
          }
        } finally {await b.storage.local.set(auditBefore);}
        return {authStatus:risk.threat.authStatus,attachmentsListed:(await b.messages.listAttachments(message.id)).length,coverage:stored.scanCoverage.attachments,storedAttachments:stored.attachments.length,benchmark};
    })();''')
    assert probe['authStatus'] == 'neutral', probe
    assert probe['attachmentsListed'] == 101 and probe['storedAttachments'] == 100
    assert probe['coverage']['detected'] == 101 and probe['coverage']['skipped'] == 1
    assert probe['coverage']['processed'] == 100 and probe['coverage']['failed'] == 0
    # Verify the actual popup explains the 101/100/1 coverage after selecting
    # the imported MIME message, using the native toolbar button again.
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
        const {MailUtils}=ChromeUtils.importESModule("resource:///modules/MailUtils.sys.mjs");
        const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests");
        const header=Array.from(folder.messages).find(h=>h.subject==="Thundy followup MIME");
        MailUtils.displayMessage(header);''')
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.mode.name==="mailMessageTab";'))
    wait_for(lambda: m.page('return document.documentElement.dataset.thundyClickProtection==="true";'))
    if 'analysisTitle' in source_catalog:
        sources = wait_for(lambda: m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot?.querySelector(".card")?.textContent;'))
        assert source_catalog['analysisLocal']['message'] in sources, sources
        probe['analysisSources'] = {'nativeLocalMessage':True,'syntheticStoredReport':True,'liveProviderCalls':False}
    point = m.js('''const t=window.gTabmail.currentTabInfo,b=t.chromeBrowser;
        const r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect();
        const p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display, point['x'], point['y'])
    wait_for(lambda: m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup_browser = 'document.querySelector(\'browser[webextension-view-type="popup"]\')'
    wait_for(lambda: m.page('return !!document.getElementById("thundy-analysis-status")?.shadowRoot?.querySelector("[data-focus-key=view-switch]");', browser=popup_browser))
    m.page('if(document.body.dataset.thundyAnalysisView!=="expert")document.getElementById("thundy-analysis-status").shadowRoot.querySelector("[data-focus-key=view-switch]").click();', browser=popup_browser)
    wait_for(lambda: m.page('return document.body?.innerText?.includes("101") && document.body?.innerText?.includes("100");', browser=popup_browser))
    if 'analysisModeRunning' in source_catalog:
        # These are explicit synthetic observations through the real popup bridge,
        # never live provider requests. Exercise an already open native popup.
        bridge = m.page('''return (async()=>{
          const b=window.wrappedJSObject.browser;
          const raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject || raw;
          const tabs=await b.tabs.query({active:true,currentWindow:true});
          const message=(await b.messageDisplay.getDisplayedMessages(tabs[0].id)).messages[0];
          const record=await bg.getFromStore(await bg.getSharedDB(),"hybridanalysis",message.headerMessageId);
          window.wrappedJSObject.sourceProbe={id:message.id,resource:"attachment:"+record.attachments[0].partName,observedAt:Date.parse("2026-10-15T08:00:00Z")};
          const result=await b.runtime.sendMessage({action:"recordAnalysisEvent",messageId:message.id,event:{provider:"hybridanalysis",scope:"report",resource:window.wrappedJSObject.sourceProbe.resource,phase:"start"}});
          return result.success;
        })();''', browser=popup_browser)
        assert bridge is True
        wait_for(lambda: m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot?.querySelector(".phase")?.textContent===arguments[0];', [source_catalog['analysisModeRunning']['message']], browser=popup_browser))
        timed = m.page('''return (async()=>{
          const b=window.wrappedJSObject.browser,p=window.wrappedJSObject.sourceProbe;
          const event={provider:"hybridanalysis",scope:"report",resource:p.resource};
          await b.runtime.sendMessage({action:"recordAnalysisEvent",messageId:p.id,event:{...event,phase:"finish",state:"checked",verdict:"malicious",responded:true,observedAt:p.observedAt}});
          await b.runtime.sendMessage({action:"recordAnalysisEvent",messageId:p.id,event:{...event,phase:"cache",state:"checked",verdict:"malicious",observedAt:p.observedAt}});
          await b.runtime.sendMessage({action:"recordAnalysisEvent",messageId:p.id,event:{...event,phase:"start"}});
          await b.runtime.sendMessage({action:"recordAnalysisEvent",messageId:p.id,event:{...event,phase:"finish",state:"failed",verdict:"unknown",responded:false}});
          const snapshot=await b.runtime.sendMessage({action:"getMessageAnalysis",messageId:p.id});
          const row=snapshot.rows.find(row=>row.resource===p.resource && row.scope==="report");
          return {originalAgePreserved:row.observedAt===p.observedAt,warningPreserved:row.verdict==="malicious",cacheVisible:row.source==="cache"};
        })();''', browser=popup_browser)
        assert all(timed.values()), timed
        wait_for(lambda: m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot?.querySelector(".phase")?.textContent===arguments[0];', [source_catalog['analysisModePartial']['message']], browser=popup_browser))
        probe['analysisSources'].update({'nativeFirstRequest':True,'nativeCacheAndFailedRefresh':timed})
    if 'analysisTitle' in source_catalog:
        m.page('''return (async()=>{
          const b=window.wrappedJSObject.browser;
          const raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject || raw;
          const tabs=await b.tabs.query({active:true,currentWindow:true});
          const displayed=await b.messageDisplay.getDisplayedMessages(tabs[0].id);
          const message=displayed.messages[0];
          const db=await bg.getSharedDB();
          const modern = !!document.getElementById("thundy-analysis-status")?.shadowRoot?.querySelector(".phase");
          await bg.updateStore(db,"hybridanalysis",message.headerMessageId,old=>({...old,
            attachments:old.attachments.map((item,index)=>index<(modern?2:1)?{...item,report:{verdict:modern && index===0?"malicious":"no specific threat"},report_fetched_at:"2026-10-15T08:00:00Z"}:item),
            links:modern?(old.links || []).map((item,index)=>({...item,report:{verdict:index===0?"malicious":"no specific threat"},report_fetched_at:"2026-10-15T08:00:00Z"})):old.links
          }));
          await b.runtime.sendMessage({action:"getLocalRisk",messageId:message.id});
          return true;
        })();''', browser=popup_browser)
        popup_sources = wait_for(lambda: m.page('const text=document.getElementById("thundy-analysis-status")?.shadowRoot?.querySelector(".card")?.textContent;return text?.includes(arguments[0]) && text.includes(arguments[1])?text:null;', [source_catalog['analysisMixed']['message'],source_catalog['analysisSource_stored']['message']], browser=popup_browser))
        assert source_catalog['analysisMixed']['message'] in popup_sources, popup_sources
        assert source_catalog['analysisSource_stored']['message'] in popup_sources, popup_sources
        if 'analysisResources' in source_catalog:
            resources = m.page('''return (async()=>{
              const b=window.wrappedJSObject.browser,p=window.wrappedJSObject.sourceProbe;
              const snapshot=await b.runtime.sendMessage({action:"getMessageAnalysis",messageId:p.id});
              const attachments=Object.keys(snapshot.resourceLabels).filter(ref=>ref.startsWith("attachment:"));
              const links=Object.keys(snapshot.resourceLabels).filter(ref=>ref.startsWith("link:"));
              return {attachmentCount:attachments.length,linkCount:links.length,
                differentSameNameAttachments:snapshot.resourceLabels[attachments[0]]!==snapshot.resourceLabels[attachments[1]],
                linksHaveFindings:links.every(ref=>snapshot.rows.some(row=>row.resource===ref)),
                noStoredQueryInDisplay:links.every(ref=>!snapshot.resourceLabels[ref].includes("token="))};
            })();''', browser=popup_browser)
            assert resources['attachmentCount']==100 and resources['linkCount']==2, resources
            assert all(resources[key] for key in ['differentSameNameAttachments','linksHaveFindings','noStoredQueryInDisplay']), resources
            probe['analysisSources']['resources']=resources
        probe['analysisSources']['nativePopup'] = True
    probe['coverageVisibleInNativePopup'] = True
    subprocess.run(['import', '-window', 'root', str(out / 'coverage-popup.png')], env={**os.environ, 'DISPLAY': display}, check=True, timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    if 'analysisTitle' in source_catalog:
        sources = wait_for(lambda: m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot?.querySelector(".card")?.textContent;'))
        assert source_catalog['analysisMixed']['message'] in sources, sources
        assert source_catalog['analysisSource_stored']['message'] in sources, sources
        probe['analysisSources']['nativeStoredMessage'] = True
        m.screenshot(out / 'analysis-sources-message.png')
    report['followup'] = {'passed': True, 'realThunderbirdAPIs': True, **probe}


def addon_state(m):
    return m.js('''const done=arguments[arguments.length-1];
        ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager
            .getAddonByID(arguments[0]).then(a=>done(a?{version:a.version,active:a.isActive,
                temporary:a.temporarilyInstalled,appDisabled:a.appDisabled,
                profileScoped:a.scope===ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager.SCOPE_PROFILE}:null));''', [ADDON_ID], asynchronous=True)


def open_page(m, url):
    m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [url])
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec===arguments[0];', [url]))
    wait_for(lambda: m.page('return document.readyState==="complete" && !!document.querySelector("h1");'))


def expert_view(m, browser='window.gTabmail.currentTabInfo.browser'):
    """Select the public technical view before testing its disclosed controls."""
    wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status")?.shadowRoot?.querySelector("[data-focus-key=view-switch]");',browser=browser))
    m.page('if(document.body.dataset.thundyAnalysisView!=="expert")document.getElementById("thundy-analysis-status").shadowRoot.querySelector("[data-focus-key=view-switch]").click();',browser=browser)


def storage_snapshot(m):
    return m.page('return window.wrappedJSObject.browser.storage.local.get(null);')


def close_extension_tabs(m):
    m.js('''for(const tab of [...window.gTabmail.tabInfo]) {
        if(tab.browser?.currentURI.spec.startsWith("moz-extension:"))window.gTabmail.closeTab(tab);
    }''')


def check_resource_isolation(m, base, out, report):
    """Distinct real MIME resources sharing a Message-ID; no provider requests."""
    fixture = out / 'resource-isolation.eml'
    fixture.write_text('From: sender@example.invalid\nTo: recipient@example.invalid\nSubject: Thundy isolation B\nMessage-ID: <followup@example.invalid>\nMIME-Version: 1.0\nContent-Type: multipart/mixed; boundary="isolate"\n\n--isolate\nContent-Type: text/plain\n\nhttps://message-b.invalid/path\n--isolate\nContent-Type: text/plain\nContent-Disposition: attachment; filename="message-B.txt"\n\nDistinct resource B.\n--isolate--\n')
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
        const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests");
        const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
        MailServices.copy.copyFileMessage(file,folder,null,false,0,"",null,null);''', [str(fixture)])
    wait_for(lambda: m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests").getTotalMessages(false)===3;'''))
    open_page(m,base+'options.html')
    result=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser;
      const a=(await b.messages.query({subject:"Thundy followup MIME"})).messages.find(m=>m.subject==="Thundy followup MIME");
      const target=(await b.messages.query({subject:"Thundy isolation B"})).messages.find(m=>m.subject==="Thundy isolation B");
      if(a.headerMessageId!==target.headerMessageId)throw new Error("Shared header fixture missing");
      const before=await b.runtime.sendMessage({action:"getMessageAnalysis",messageId:target.id});
      const cached=await b.runtime.sendMessage({action:"getMessageAnalysisRecord",messageId:target.id});
      await b.runtime.sendMessage({action:"getLocalRisk",messageId:target.id});
      return {messageId:target.id,sharedHeader:true,actualNameVisible:Object.values(before.resourceLabels).some(name=>name.includes("message-B.txt")),foreignNameAbsent:!JSON.stringify(before.resourceLabels).includes("same.txt"),foreignUrlAbsent:!JSON.stringify(before.resourceLabels).includes("fixture.invalid"),popupRecordExcludesForeign:cached.success && cached.record.attachments.length===0 && cached.record.links.length===0};
    })();''')
    assert all(result[key] for key in ['sharedHeader','actualNameVisible','foreignNameAbsent','foreignUrlAbsent','popupRecordExcludesForeign']),result
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const {MailUtils}=ChromeUtils.importESModule("resource:///modules/MailUtils.sys.mjs");
      const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests");
      MailUtils.displayMessage(Array.from(folder.messages).find(item=>item.subject==="Thundy isolation B"));''')
    text=wait_for(lambda: m.page('const text=document.getElementById("thundy-analysis-status")?.shadowRoot?.textContent;return text?.includes("message-B.txt")?text:null;'))
    assert 'same.txt' not in text and 'fixture.invalid' not in text,text
    result['realMessageViewPassed']=True
    report['resourceIsolation']={'passed':True,'syntheticMime':True,'liveProviderCalls':False,**result}
    m.screenshot(out/'resource-isolation-message.png')


def owned_process_memory(root_pid):
    pending=[root_pid]
    owned=set()
    while pending:
        pid=pending.pop()
        if pid in owned:
            continue
        owned.add(pid)
        result=subprocess.run(['ps','-o','pid=','--ppid',str(pid)],capture_output=True,text=True,timeout=5)
        pending.extend(int(value) for value in result.stdout.split())
    rss=pss=measured=0
    for pid in owned:
        try:
            lines=Path('/proc/'+str(pid)+'/smaps_rollup').read_text().splitlines()
            fields={line.split(':',1)[0]:int(line.split()[1]) for line in lines if line.startswith(('Rss:','Pss:'))}
            rss+=fields['Rss'];pss+=fields['Pss'];measured+=1
        except (OSError,KeyError,ValueError):
            pass
    return {'processes':measured,'rssKiB':rss,'pssKiB':pss}


def check_context_capacity(m, base, out, report):
    count=205
    initial=m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests").getTotalMessages(false);''')
    for index in range(count):
        fixture=out/('capacity-'+str(index)+'.eml')
        fixture.write_text('From: fixture@example.invalid\nTo: receiver@example.invalid\nSubject: Thundy context capacity '+str(index)+'\nMessage-ID: <context-'+str(index)+'@example.invalid>\nMIME-Version: 1.0\nContent-Type: text/plain\n\nSynthetic local capacity probe.\n')
        m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
            const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests");
            const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
            MailServices.copy.copyFileMessage(file,folder,null,false,0,"",null,null);''', [str(fixture)])
    wait_for(lambda:m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests").getTotalMessages(false);''')==initial+count)
    open_page(m,base+'options.html')
    ids=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,ids=[];
      let list=await b.messages.query({subject:"Thundy context capacity "});
      while(true){ids.push(...list.messages.map(item=>item.id));if(!list.id)break;list=await b.messages.continueList(list.id);}
      window.wrappedJSObject.contextCapacityIds=ids;
      return ids.length;
    })();''')
    assert ids==count,ids
    pid=m.js('return Services.appinfo.processID;')
    before=owned_process_memory(pid)
    started=time.monotonic()
    result=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser;
      const raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject || raw;
      const ids=window.wrappedJSObject.contextCapacityIds;
      const first=await bg.getMessageAnalysisContext(await b.messages.get(ids[0]));
      for(const id of ids){const result=await b.runtime.sendMessage({action:"getMessageAnalysis",messageId:id});if(!result.success)throw new Error("Capacity source read failed");}
      const last=await bg.getMessageAnalysisContext(await b.messages.get(ids.at(-1)));
      return {firstDisposed:(first.wrappedJSObject || first).disposed,lastActive:!(last.wrappedJSObject || last).disposed};
    })();''')
    elapsed=round((time.monotonic()-started)*1000)
    after=owned_process_memory(pid)
    assert result['firstDisposed'] and result['lastActive'],result
    report['contextCapacity']={'passed':True,'syntheticMessages':count,'realThunderbirdAPIs':True,'configuredContextLimit':200,**result,'before':before,'after':after,'loadAndAutomationMs':elapsed,'scope':'Owned Thunderbird process tree; PSS/RSS snapshots after importing/querying fixtures, before/after source-context load. No field prevalence or isolated-allocation claim.'}


def message_identity_snapshot(m, second_first):
    return m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser;
      const subjects=arguments[0]?["Thundy identity second","Thundy AV synthetic live test"]:["Thundy AV synthetic live test","Thundy identity second"];
      const result=[];
      for(const subject of subjects){
        const list=await b.messages.query({subject});
        const item=list.messages.find(message=>message.subject===subject);
        if(!item)throw new Error("Identity fixture missing");
        result.push({id:item.id,headerMessageId:item.headerMessageId,folderId:item.folder?.id});
      }
      return result;
    })();''', [second_first])


def summarize_identity_bytes(raw):
    """Experimental local-header exclusion; preserve every other original byte."""
    header, separator, body = raw.partition(b'\r\n\r\n')
    if not separator:
        raise ValueError('CRLF MIME fixture headers missing')
    kept, local_status = [], []
    skip = False
    # Thunderbird may prepend LF status headers to a CRLF message and rewrite
    # them as CRLF on compaction. Splitting only on CRLF could drop From too.
    for line in header.splitlines(keepends=True):
        if not line.startswith((b' ', b'\t')):
            skip = line.split(b':', 1)[0].lower() in [b'x-mozilla-status', b'x-mozilla-status2', b'x-mozilla-keys']
        (local_status if skip else kept).append(line)
    return {
        'rawSha256': hashlib.sha256(raw).hexdigest(),
        'localStatusHeaders': [line.decode('ascii').rstrip('\r\n') for line in local_status],
        'localStatusLineEndings': ['CRLF' if line.endswith(b'\r\n') else 'LF' if line.endswith(b'\n') else 'none' for line in local_status],
        'withoutLocalStatusSha256': hashlib.sha256(b''.join(kept) + separator + body).hexdigest(),
    }


def content_identity_snapshot(m):
    """Observe candidate identities through real read-only WebExtension APIs."""
    rows = m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser;
      const result=[];
      let list=await b.messages.query({subject:"Thundy identity lifecycle"});
      while(true){
        for(const item of list.messages){
          if(item.subject!=="Thundy identity lifecycle")continue;
          const raw=await b.messages.getRaw(item.id,{decrypt:false,data_format:"BinaryString"});
          const attachments=[];
          for(const part of await b.messages.listAttachments(item.id)){
            const file=await b.messages.getAttachmentFile(item.id,part.partName);
            attachments.push({partName:part.partName,name:part.name,size:part.size,asciiFixture:await file.text()});
          }
          result.push({id:item.id,headerMessageId:item.headerMessageId,folderId:item.folderId ?? item.folder?.id ?? null,
            read:item.read,flagged:item.flagged,rawBytes:raw.length,
            rawBinaryString:raw,attachments});
        }
        if(!list.id)break;list=await b.messages.continueList(list.id);
      }
      return result;
    })();''')
    # Hash exact getRaw binary-string bytes outside the automation Xray realm.
    # Attachment fixtures are intentionally ASCII; this is no generic MIME decoder.
    for row in rows:
        raw = row.pop('rawBinaryString').encode('latin1')
        row.update(summarize_identity_bytes(raw))
        for attachment in row['attachments']:
            attachment['sha256'] = hashlib.sha256(attachment.pop('asciiFixture').encode('ascii')).hexdigest()
    return rows


def check_identity_lifecycle(m, base, out, report, restart):
    """Isolated local-folder mutations by test chrome, never added addon rights."""
    probe={'passed':False,'syntheticMime':True,'liveProviderCalls':False,
           'mutationActor':'privileged test harness; no added message-mutation permissions',
           'rawOptions':{'decrypt':False,'data_format':'BinaryString'},'stages':{},'folderStages':{}}
    report['contentIdentity']=probe  # Keep failed observations too.
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const root=MailServices.accounts.localFoldersServer.rootFolder;
      for(const name of ["Identity Source","Identity Copy","Identity Moved"])root.createSubfolder(name,null);''')
    # Exactly equal visible metadata, header ID, part names and byte lengths.
    for index, payload in enumerate(['AAAA','BBBB']):
        fixture=out/('identity-content-'+str(index)+'.eml')
        fixture.write_bytes(('From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\n'
            'Date: Tue, 03 Nov 2026 10:00:00 +0000\r\nSubject: Thundy identity lifecycle\r\n'
            'Message-ID: <identity-collision@example.invalid>\r\nMIME-Version: 1.0\r\n'
            'Content-Type: multipart/mixed; boundary="identity"\r\n\r\n'
            '--identity\r\nContent-Type: text/plain\r\n\r\nIdentical body.\r\n'
            '--identity\r\nContent-Type: application/octet-stream\r\n'
            'Content-Disposition: attachment; filename="same.bin"\r\n\r\n'+payload+'\r\n--identity--\r\n').encode('ascii'))
        m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Identity Source");
          const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
          MailServices.copy.copyFileMessage(file,folder,null,false,0,"",null,null);''',[str(fixture)])
        wait_for(lambda:m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Identity Source").getTotalMessages(false);''')==index+1)
    def observe(stage):
        rows=content_identity_snapshot(m)
        probe['stages'][stage]=rows
        probe['folderStages'][stage]=m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          const root=MailServices.accounts.localFoldersServer.rootFolder;
          return ["Identity Source","Identity Copy","Identity Moved"].map(name=>({name,
            messages:Array.from(root.getChildNamed(name).messages).map(h=>({messageKey:h.messageKey,headerMessageId:h.messageId}))}));''')
        return rows
    open_page(m,base+'options.html')
    initial=observe('initial')
    assert len(initial)==2 and len({r['headerMessageId'] for r in initial})==1,initial
    assert len({r['rawSha256'] for r in initial})==2,initial
    assert len({r['withoutLocalStatusSha256'] for r in initial})==2,initial
    assert all(len(r['attachments'])==1 for r in initial),initial
    assert len({(r['attachments'][0]['partName'],r['attachments'][0]['name'],r['attachments'][0]['size']) for r in initial})==1,initial
    assert len({r['attachments'][0]['sha256'] for r in initial})==2,initial
    keys=m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      return Array.from(MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Identity Source").messages).map(h=>h.messageKey).sort((a,b)=>a-b);''')
    for key, destination, move in [(keys[0],'Identity Copy',False),(keys[1],'Identity Moved',True)]:
        result=m.js('''const done=arguments[arguments.length-1];
          const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          const root=MailServices.accounts.localFoldersServer.rootFolder;
          const source=root.getChildNamed("Identity Source");
          MailServices.copy.copyMessages(source,[source.GetMessageHeader(arguments[0])],root.getChildNamed(arguments[1]),arguments[2],
            {onStartCopy(){},onProgress(){},setMessageKey(){},getMessageId(){return null;},onStopCopy(status){done({status});},
             QueryInterface:ChromeUtils.generateQI(["nsIMsgCopyServiceListener"])},null,false);''',[key,destination,move],asynchronous=True)
        assert result['status']==0,result
        current=observe('moved' if move else 'copied')
        assert len({r['id'] for r in current})==3,current
        assert [len(f['messages']) for f in probe['folderStages']['moved' if move else 'copied']]==([1,1,1] if move else [2,1,0])
        assert len(current)==3 and {r['rawSha256'] for r in current}=={r['rawSha256'] for r in initial},current
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Identity Source");
      const headers=Array.from(folder.messages);folder.markMessagesRead(headers,true);folder.markMessagesFlagged(headers,true);''')
    marked=observe('flagsChanged')
    assert any(r['read'] and r['flagged'] for r in marked),marked
    assert sorted(r['withoutLocalStatusSha256'] for r in marked)==sorted(r['withoutLocalStatusSha256'] for r in current),marked
    result=m.js('''const done=arguments[arguments.length-1];
      const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Identity Source").compact(
        {OnStartRunningUrl(){},OnStopRunningUrl(url,status){done({status});},QueryInterface:ChromeUtils.generateQI(["nsIUrlListener"])},null);''',asynchronous=True)
    assert result['status']==0,result
    compacted=observe('compacted')
    expected=sorted((r['withoutLocalStatusSha256'],r['folderId'],r['attachments'][0]['sha256']) for r in compacted)
    assert sorted(r['withoutLocalStatusSha256'] for r in compacted)==sorted(r['withoutLocalStatusSha256'] for r in marked),compacted
    before=storage_snapshot(m)
    close_extension_tabs(m)
    m.js('''for(const tab of [...window.gTabmail.tabInfo])if(tab.mode.name==="mailMessageTab")window.gTabmail.closeTab(tab);''')
    backup=out/'.identity-profile'
    m=restart(backup_to=backup)
    open_page(m,base+'options.html')
    after=observe('restarted')
    assert sorted((r['withoutLocalStatusSha256'],r['folderId'],r['attachments'][0]['sha256']) for r in after)==expected,after
    assert storage_snapshot(m)==before
    assert probe['folderStages']['restarted']==probe['folderStages']['compacted']
    # A post-backup folder must disappear after full-profile restore.
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const root=MailServices.accounts.localFoldersServer.rootFolder;root.createSubfolder("Identity After Backup",null);
      if(!root.containsChildNamed("Identity After Backup"))throw new Error("Backup marker missing");''')
    close_extension_tabs(m)
    m=restart(restore_from=backup)
    open_page(m,base+'options.html')
    restored=observe('profileRestored')
    assert sorted((r['withoutLocalStatusSha256'],r['folderId'],r['attachments'][0]['sha256']) for r in restored)==expected,restored
    assert storage_snapshot(m)==before
    assert m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      return !MailServices.accounts.localFoldersServer.rootFolder.containsChildNamed("Identity After Backup");''')
    assert probe['folderStages']['profileRestored']==probe['folderStages']['compacted']
    shutil.rmtree(backup)
    probe.update(passed=True,metadataCollisionDistinguished=True,copyRemainsDistinctInstance=True,
                 rawDigestStableAcrossFlagChange=sorted(r['rawSha256'] for r in marked)==sorted(r['rawSha256'] for r in current),
                 digestWithoutLocalStatusStableAcrossTestedMutations=True,auditAndSettingsPreserved=True,
                 scope='Local mbox, plaintext MIME only; unfiltered raw digest includes mutable local headers; stripped digest is an experimental candidate, not occurrence identity. No production migration or retention change.')
    return m


def check_mime_content(m, base, out, report, display):
    """Small controlled encoding/readability investigation, no provider calls."""
    expected={}
    fixtures=[]
    for name,payload in [('binary-a',bytes(range(256))),('binary-b',bytes(range(255))+b'\x00')]:
        mail=EmailMessage(policy=SMTP)
        mail['From']='fixture@example.invalid';mail['To']='receiver@example.invalid'
        mail['Subject']='Thundy MIME '+name;mail['Message-ID']='<mime-'+name+'@example.invalid>'
        mail.set_content('Grüße — Français, Español, Italiano, Polski: żółć. 测试',charset='utf-8',cte='quoted-printable')
        mail.add_attachment(payload,maintype='application',subtype='octet-stream',filename='prøbe-ä-测试.bin',cte='base64')
        fixtures.append((name,mail.as_bytes()))
        expected[name]=hashlib.sha256(payload).hexdigest()
    fixtures.append(('empty',b'From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\nSubject: Thundy MIME empty\r\nMessage-ID: <mime-empty@example.invalid>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n'))
    fixtures.append(('unavailable',b'From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\nSubject: Thundy MIME unavailable\r\nMessage-ID: <mime-unavailable@example.invalid>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/encrypted; protocol="application/pgp-encrypted"; boundary="unavailable"\r\n\r\n--unavailable\r\nContent-Type: application/pgp-encrypted\r\n\r\nVersion: 1\r\n--unavailable\r\nContent-Type: application/octet-stream\r\n\r\nThis is deliberately not a decryptable OpenPGP message.\r\n--unavailable--\r\n'))
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      MailServices.accounts.localFoldersServer.rootFolder.createSubfolder("MIME Content",null);''')
    for index,(name,data) in enumerate(fixtures):
        path=out/('mime-'+name+'.eml');path.write_bytes(data)
        m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("MIME Content");
          const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
          MailServices.copy.copyFileMessage(file,folder,null,false,0,"",null,null);''',[str(path)])
        wait_for(lambda:m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("MIME Content").getTotalMessages(false);''')==index+1)
    open_page(m,base+'options.html')
    rows=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,result=[];
      for(const name of ["binary-a","binary-b","empty","unavailable"]){
        const item=(await b.messages.query({subject:"Thundy MIME "+name})).messages.find(m=>m.subject==="Thundy MIME "+name);
        let full=null,fullError=null;try{full=await b.messages.getFull(item.id);}catch(e){fullError=String(e);}
        const textParts=[];const visit=part=>{if(part?.contentType?.startsWith("text/"))textParts.push({type:part.contentType,hasBody:typeof part.body==="string",body:part.body ?? null});for(const child of part?.parts || [])visit(child);};visit(full);
        const page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject || page;
        const input=await bg.readFullForAnalysis(item),inputText=bg.extractTextFromParts(input.parts || input);
        const attachments=[];
        try{for(const part of await b.messages.listAttachments(item.id)){
          const file=await b.messages.getAttachmentFile(item.id,part.partName);
          const binaryString=await new Promise((resolve,reject)=>{const reader=new window.wrappedJSObject.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Fixture FileReader failed"));reader.readAsBinaryString(file);});
          attachments.push({partName:part.partName,name:part.name,size:part.size,binaryString});
        }}catch(e){attachments.push({readError:String(e)});}
        const rawBinaryString=await b.messages.getRaw(item.id,{decrypt:false,data_format:"BinaryString"});
        const risk=await b.runtime.sendMessage({action:"getLocalRisk",messageId:item.id});
        const sources=await b.runtime.sendMessage({action:"getMessageAnalysis",messageId:item.id});
        result.push({name,messageId:item.id,decryptionStatus:full?.decryptionStatus ?? null,fullError,textParts,attachments,rawBinaryString,inputText,inputStatus:input.thundyInputStatus ?? null,
          apiReplacementCharacters:textParts.some(part=>part.body?.includes(String.fromCharCode(65533))),
          riskStatus:risk.status,coverage:risk.threat?.coverage ?? null,local:sources.local ?? null});
      }return result;
    })();''')
    report['mimeContent']={'passed':False,'realThunderbirdAPIs':True,'liveProviderCalls':False,'rows':rows,
      'scope':'Synthetic quoted-printable Unicode, base64 binary and empty plaintext; malformed encrypted MIME probes unavailable content, not successful OpenPGP/S-MIME decryption.'}
    for row in rows:
        raw=row.pop('rawBinaryString').encode('latin1')
        body=raw.partition(b'\r\n\r\n')[2]
        fixture=dict(fixtures)[row['name']]
        row['rawBodySha256']=hashlib.sha256(body).hexdigest()
        row['rawBodyMatchesFixture']=body==fixture.partition(b'\r\n\r\n')[2]
        assert row['rawBodyMatchesFixture'],row
        for part in row['attachments']:
            if 'binaryString' in part:
                part['sha256']=hashlib.sha256(part.pop('binaryString').encode('latin1')).hexdigest()
        if row['name'] in expected:
            parsed=BytesParser(policy=SMTP).parsebytes(fixture)
            row['fixtureUnicodeRoundTripExact']='żółć. 测试' in parsed.get_body(preferencelist=('plain',)).get_content()
            assert row['fixtureUnicodeRoundTripExact'],row
            assert len(row['attachments'])==1 and row['attachments'][0]['sha256']==expected[row['name']],row
            assert row['attachments'][0]['name']=='prøbe-ä-测试.bin',row
            row['unicodeRoundTripExact']=any('Grüße — Français, Español, Italiano, Polski: żółć. 测试' in (part['body'] or '') for part in row['textParts'])
            row['productUnicodeExact']='Grüße — Français, Español, Italiano, Polski: żółć. 测试' in row['inputText']
            assert row['productUnicodeExact'],row
        assert row['riskStatus']=='success',row
        expected_state='incomplete' if row['name']=='unavailable' else 'checked'
        assert row['local']['state']==expected_state and row['coverage']['state']==expected_state,row
    # Exercise both actual displays for the unavailable encrypted fixture.
    label=m.page('return window.wrappedJSObject.browser.i18n.getMessage("analysisLocalIncomplete");')
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const {MailUtils}=ChromeUtils.importESModule("resource:///modules/MailUtils.sys.mjs");
      const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("MIME Content");
      MailUtils.displayMessage(Array.from(folder.messages).find(h=>h.subject==="Thundy MIME unavailable"));''')
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.textContent.includes(arguments[0]);',[label]))
    m.screenshot(out/'mime-unavailable-message.png')
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser;
      const r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect();
      const p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display,point['x'],point['y'])
    popup_browser='document.querySelector(\'browser[webextension-view-type="popup"]\')'
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    wait_for(lambda:m.page('return document.querySelector(".local-risk")?.textContent.includes(arguments[0]) && document.getElementById("thundy-analysis-status")?.shadowRoot.textContent.includes(arguments[0]);',[label],browser=popup_browser))
    subprocess.run(['import','-window','root',str(out/'mime-unavailable-popup.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    report['mimeContent']['actualMessageAndPopupIncomplete']=True
    report['mimeContent']['passed']=True


def check_unicode_input(m, base, out, report):
    """Compare native decode variants with independently known MIME inputs."""
    text='Prüfung: żółć — 测试 https://unicode.example.invalid/ż'
    import quopri
    encoded=quopri.encodestring(text.encode('utf-8'))
    split=encoded.replace(b'=C5=BC',b'=C5=\r\n=BC')
    cases=[('8bit','utf-8','8bit',text.encode('utf-8'),text),
           ('base64','utf-8','base64',base64.b64encode(text.encode('utf-8')),text),
           ('qp','utf-8','quoted-printable',encoded,text),
           ('qp-byte-split','utf-8','quoted-printable',split,text),
           ('qp-character-split','utf-8','quoted-printable',encoded.replace(b'=C5=BC',b'=\r\n=C5=BC'),text),
           ('qp-literal-replacement','utf-8','quoted-printable',b'Valid =EF=BF=BD replacement character.','Valid \ufffd replacement character.'),
           ('qp-invalid-utf8','utf-8','quoted-printable',b'Invalid =C5=20 bytes.',None),
           ('latin1','iso-8859-1','quoted-printable',b'Gr=FC=DFe','Grüße'),
           ('mixed-qp-byte-split','utf-8','quoted-printable',split,text),
           ('mixed-base64','utf-8','base64',base64.b64encode(text.encode('utf-8')),text),
           ('alternative-qp-byte-split','utf-8','quoted-printable',split,text)]
    cases.extend([('mixed-html-byte-split','utf-8','quoted-printable',b'<p>'+split+b'</p>','<p>'+text+'</p>'),
                  ('mixed-qp-literal-replacement','utf-8','quoted-printable',b'Valid =EF=BF=BD replacement character.','Valid \ufffd replacement character.'),
                  ('mixed-latin1','iso-8859-1','quoted-printable',b'Gr=FC=DFe','Grüße')])
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      MailServices.accounts.localFoldersServer.rootFolder.createSubfolder("Unicode Input",null);''')
    expected={}
    for index,(name,charset,cte,body,reference) in enumerate(cases):
        body=body.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')
        media='text/html' if 'html' in name else 'text/plain'
        data=('From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\nSubject: Thundy Unicode '+name+'\r\nMessage-ID: <unicode-'+name+'@example.invalid>\r\nMIME-Version: 1.0\r\nContent-Type: '+media+'; charset="'+charset+'"\r\nContent-Transfer-Encoding: '+cte+'\r\n\r\n').encode('ascii')+body+b'\r\n'
        if name.startswith(('mixed-','alternative-')):
            outer,leaf=data.split(b'MIME-Version: 1.0\r\n',1)
            subtype='alternative' if name.startswith('alternative-') else 'mixed'
            data=outer+('MIME-Version: 1.0\r\nContent-Type: multipart/'+subtype+'; boundary="unicode-matrix"\r\n\r\n--unicode-matrix\r\n').encode('ascii')+leaf+b'--unicode-matrix\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="control.bin"\r\nContent-Transfer-Encoding: base64\r\n\r\nAAEC/w==\r\n--unicode-matrix--\r\n'
        if reference is not None:
            assert BytesParser(policy=SMTP).parsebytes(data).get_body(preferencelist=('plain','html')).get_content().rstrip('\r\n')==reference,name
        path=out/('unicode-'+name+'.eml');path.write_bytes(data)
        expected[name]=reference
        m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Unicode Input");
          const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
          MailServices.copy.copyFileMessage(file,folder,null,false,0,"",null,null);''',[str(path)])
        wait_for(lambda:m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Unicode Input").getTotalMessages(false);''')==index+1)
    open_page(m,base+'options.html')
    rows=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,result=[];
      const page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject || page;
      const leaves=full=>{const result=[];const visit=p=>{if(p.contentType?.startsWith("text/"))result.push({partName:p.partName,contentType:p.contentType,headers:p.headers || p.rawHeaders,body:p.body ?? p.rawBody});for(const child of p.parts || [])visit(child);};visit(full);return result;};
      for(const name of arguments[0]){
        const item=(await b.messages.query({subject:"Thundy Unicode "+name})).messages.find(m=>m.subject==="Thundy Unicode "+name);
        const decoded=await b.messages.getFull(item.id);
        const encoded=await b.messages.getFull(item.id,{decodeContent:false});
        const noHeaderDecode=await b.messages.getFull(item.id,{decodeHeaders:false});
        const input=await bg.readFullForAnalysis(item);
        const risk=await b.runtime.sendMessage({action:"getLocalRisk",messageId:item.id});
        result.push({name,decoded:leaves(decoded),encoded:leaves(encoded),noHeaderDecode:leaves(noHeaderDecode),input:leaves(input),inputStatus:input.thundyInputStatus ?? null,coverage:risk.threat?.coverage});
      }return result;
    })();''',[[case[0] for case in cases]])
    report['unicodeInput']={'passed':False,'realThunderbirdAPIs':True,'liveProviderCalls':False,'rows':rows,'scope':'Synthetic encoding matrix; native decoding and product input are separate observations. No Crypto/backend coverage claim.'}
    for row in rows:
        reference=expected[row['name']]
        row['validFixture']=reference is not None
        row['nativeExact']=reference is not None and any(part.get('body','').rstrip('\r\n')==reference for part in row['decoded'])
        row['inputExact']=reference is not None and any(part.get('body','').rstrip('\r\n')==reference for part in row['input'])
        if reference is not None: assert row['inputExact'] and row['coverage']['state']=='checked',row
        else: assert row['coverage']['state']=='incomplete',row
    report['unicodeInput']['passed']=True


def check_source_history(m, base, out, report, restart, display):
    """Synthetic stored observations through real DB/APIs, including ID reuse."""
    for name,payload in [('A','AAAA'),('B','BBBB')]:
        fixture=out/('source-history-'+name+'.eml')
        fixture.write_bytes(('From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\nSubject: Thundy source history '+name+'\r\nMessage-ID: <source-history-collision@example.invalid>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="source-history"\r\n\r\n--source-history\r\nContent-Type: text/plain\r\n\r\nSynthetic source history.\r\n--source-history\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="same.bin"\r\n\r\n'+payload+'\r\n--source-history--\r\n').encode('ascii'))
        m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          const root=MailServices.accounts.localFoldersServer.rootFolder;
          if(!root.containsChildNamed("Source History"))root.createSubfolder("Source History",null);
          const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
          MailServices.copy.copyFileMessage(file,root.getChildNamed("Source History"),null,false,0,"",null,null);''',[str(fixture)])
        wait_for(lambda:m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Source History").getTotalMessages(false);''')==(1 if name=='A' else 2))
    open_page(m,base+'options.html')
    before=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject || page;
      const find=async suffix=>(await b.messages.query({subject:"Thundy source history "+suffix})).messages.find(m=>m.subject==="Thundy source history "+suffix);
      const target=await find("B"),other=await find("A");
      const part=(await b.messages.listAttachments(other.id))[0];
      const result=await bg.process_single_attachment(other,part,false,false);
      const oldTime=Date.parse("2026-10-15T08:00:00Z");
      const rows=["hybridanalysis","virustotal","urlhaus","abuseipdb","urlscan"].map((provider,index)=>({provider,scope:["report","hash","domain","ip","url"][index],resource:"message",state:provider==="urlscan"?"running":"checked",verdict:provider==="urlscan"?"unknown":"malicious",responses:provider==="urlscan"?0:1,observedAt:oldTime,findingAt:oldTime}));
      const legacy={schemaVersion:2,local:{state:"checked",observedAt:oldTime},rows};
      const original={analysisStatus:legacy,analysisStatusOwner:target.id,analysisStatusByMessage:{[target.id]:legacy},analysisStatusLegacy:legacy};
      const db=await bg.getSharedDB();
      await bg.updateStore(db,"hybridanalysis",target.headerMessageId,()=>({messageHeader:target.headerMessageId,...original,attachments:[{partName:part.partName,attachment_name:"same.bin",hybrid_sha256:result.hybrid_data.sha256,report:{verdict:"malicious"},report_fetched_at:new Date(oldTime).toISOString()}],updatedAt:Date.now()}));
      window.wrappedJSObject.historyProbeOriginal=JSON.stringify(original);
      const pending=await bg.getMessageAnalysisContext(target),context=pending.wrappedJSObject || pending,initial=await context.snapshot();
      const ownPart=(await b.messages.listAttachments(target.id))[0];
      await bg.process_single_attachment(target,ownPart,false,false,context);
      const cached=await context.resourceRecord();
      await b.runtime.sendMessage({action:"getLocalRisk",messageId:target.id});
      context.event({provider:"urlhaus",scope:"domain",phase:"finish",state:"checked",verdict:"none",responded:true,observedAt:Date.now()});await context.flush();
      const saved=await bg.getFromStore(db,"hybridanalysis",target.headerMessageId);
      const fields=Object.fromEntries(Object.keys(original).map(key=>[key,saved[key]]));
      return {oldNumericId:target.id,otherNumericId:other.id,initialActiveRows:initial.rows.length,oldLocalNotInherited:initial.local.state!=="checked",historicalProviders:[...new Set(initial.sourceHistory.rows.map(row=>row.provider))],historicalResourcesUnbound:initial.sourceHistory.rows.every(row=>row.resource===null),oldTimePreserved:initial.sourceHistory.rows.some(row=>row.observedAt===oldTime),differentBytesHideCachedReport:cached.attachments.length===0,originalFieldsPreserved:JSON.stringify(fields)===JSON.stringify(original),legacy:JSON.stringify(original),newSnapshotId:context.snapshotId,newSnapshot:saved.analysisSourceSnapshots[context.snapshotId]};
    })();''')
    assert before['initialActiveRows']==0 and len(before['historicalProviders'])==5,before
    assert all(before[k] for k in ['oldLocalNotInherited','historicalResourcesUnbound','oldTimePreserved','differentBytesHideCachedReport','originalFieldsPreserved']),before
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const {MailUtils}=ChromeUtils.importESModule("resource:///modules/MailUtils.sys.mjs");
      MailUtils.displayMessage(Array.from(MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Source History").messages).find(h=>h.subject==="Thundy source history B"));''')
    brands=['Hybrid Analysis','VirusTotal','URLhaus','AbuseIPDB','urlscan.io']
    wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector(\'[data-key="unbound-history"]\');'))
    expert_view(m)
    visible=m.page('''const root=document.getElementById("thundy-analysis-status").shadowRoot;
      const detail=root.querySelector('[data-key="unbound-history"]');detail.open=true;
      return {summary:detail.querySelector("summary").textContent,currentNotMalicious:root.querySelector(".card").style.borderColor===""};''')
    assert visible['currentNotMalicious'] and all(brand in visible['summary'] for brand in brands),visible
    m.screenshot(out/'source-history-message.png')
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser;
      const r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();
      return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display,point['x'],point['y'])
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
    expert_view(m,popup)
    summary=wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector(\'[data-key="unbound-history"] summary\')?.textContent;',browser=popup))
    assert all(brand in summary for brand in brands),summary
    subprocess.run(['import','-window','root',str(out/'source-history-popup.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    close_extension_tabs(m)
    m.js('''for(const tab of [...window.gTabmail.tabInfo])if(tab.mode.name==="mailMessageTab")window.gTabmail.closeTab(tab);''')
    m=restart()
    open_page(m,base+'options.html')
    after=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject || page;
      for(const subject of ["Thundy AV synthetic live test","Thundy followup MIME"])await b.messages.query({subject});
      const other=(await b.messages.query({subject:"Thundy source history A"})).messages.find(m=>m.subject==="Thundy source history A");
      const target=(await b.messages.query({subject:"Thundy source history B"})).messages.find(m=>m.subject==="Thundy source history B");
      const snapshot=await b.runtime.sendMessage({action:"getMessageAnalysis",messageId:other.id});
      const record=await bg.getFromStore(await bg.getSharedDB(),"hybridanalysis",other.headerMessageId);
      return {otherNumericId:other.id,targetNumericId:target.id,activeRows:snapshot.rows.length,historicalProviders:[...new Set(snapshot.sourceHistory.rows.map(row=>row.provider))],allHistoricalResourcesUnbound:snapshot.sourceHistory.rows.every(row=>row.resource===null),oldNumericOwner:record.analysisStatusOwner,legacy:JSON.stringify({analysisStatus:record.analysisStatus,analysisStatusOwner:record.analysisStatusOwner,analysisStatusByMessage:record.analysisStatusByMessage,analysisStatusLegacy:record.analysisStatusLegacy}),snapshots:record.analysisSourceSnapshots};
    })();''')
    assert after['activeRows']==0 and after['allHistoricalResourcesUnbound'] and len(after['historicalProviders'])==5,after
    assert after['oldNumericOwner']==before['oldNumericId'] and after['legacy']==before['legacy'],after
    assert after['snapshots'][before['newSnapshotId']]['snapshot']['rows'][0]['verdict']=='none',after
    report['sourceHistory']={'passed':True,'realThunderbirdAPIs':True,'syntheticObservations':True,'liveProviderCalls':False,'beforeRestart':before,'afterRestart':after,'numericIdReassignedToSibling':after['otherNumericId']==before['oldNumericId'],'actualMessageAndPopupPassed':True,'scope':'Read projection and additive source snapshots; no durable occurrence migration or general retention guarantee.'}
    return m


def check_active_sources(m, base, out, report, display, baseline=False):
    """Paired native operation measurements; synthetic observations, real MIME inventory."""
    fixture=out/'active-sources.eml'
    urls=['https://source-'+str(i)+'.example.net/item' for i in range(500)]
    fixture.write_bytes(('From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\nSubject: Thundy active sources\r\nMessage-ID: <active-sources@example.invalid>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\n'+'\r\n'.join(urls)+'\r\n').encode('ascii'))
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");const root=MailServices.accounts.localFoldersServer.rootFolder;if(!root.containsChildNamed("Active Sources"))root.createSubfolder("Active Sources",null);const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);MailServices.copy.copyFileMessage(file,root.getChildNamed("Active Sources"),null,false,0,"",null,null);''',[str(fixture)])
    wait_for(lambda:m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Active Sources").getTotalMessages(false);''')==1)
    open_page(m,base+'options.html')
    target=m.page('''return (async()=>{const b=window.wrappedJSObject.browser,message=(await b.messages.query({subject:"Thundy active sources"})).messages.find(item=>item.subject==="Thundy active sources");await b.messageDisplay.open({messageId:message.id,location:"tab"});return message.id;})();''')
    wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status");'))
    options='window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.endsWith("/options.html")).browser'
    measured=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page,message=await b.messages.get(arguments[0]);
      await bg.updateStore(await bg.getSharedDB(),"hybridanalysis",message.headerMessageId,old=>({...old,messageHeader:message.headerMessageId,links:arguments[1].map(url=>({url,state:"UNKNOWN"})),updatedAt:Date.now()}));
      const ready=await bg.getMessageAnalysisContext(message),context=ready.wrappedJSObject||ready;
      for(let index=0;index<1200;index++)context.event({provider:["hybridanalysis","virustotal","urlhaus","abuseipdb","urlscan"][index%5],scope:["report","hash","domain","ip","url"][index%5],resource:"link:"+Math.floor(index/5),phase:"cache",state:"checked",verdict:index===1199?"malicious":"none",observedAt:1790000000000+index*1000});
      const samples=[];for(let run=0;run<3;run++){const start=performance.now();await context.flush();samples.push(performance.now()-start);}
      const snapshot=await context.snapshot();return {flushMs:samples,activeRows:snapshot.rows.length,inventory:Object.keys(snapshot.resourceLabels).length,sourceTimesUnchanged:snapshot.rows[0].observedAt===1790000000000&&snapshot.rows[1199].observedAt===1790001199000};
    })();''',[target,urls],browser=options)
    assert measured['activeRows']==1200 and measured['inventory']==500 and measured['sourceTimesUnchanged'],measured
    inspect='''const root=document.getElementById("thundy-analysis-status").shadowRoot,items=Array.from(root.querySelectorAll("details")).filter(d=>/^(hybridanalysis|virustotal|urlhaus|abuseipdb|urlscan):/.test(d.dataset.key||""));return {nodes:root.querySelectorAll("*").length,details:items.length,closedWithBody:items.filter(d=>!d.open&&d.querySelector("p,small")).length,opened:items.filter(d=>d.open).length,firstKey:items[0].dataset.key,jumpAvailable:!!root.querySelector('[data-focus-key="current-find-warning"]')};'''
    expert_view(m)
    initial=m.page(inspect);assert initial['details']==1200,initial
    assert initial['closedWithBody']==(1200 if baseline else 0),initial
    m.page('const root=document.getElementById("thundy-analysis-status").shadowRoot;Array.from(root.querySelectorAll("details")).find(d=>d.dataset.key?.startsWith("hybridanalysis:")).querySelector("summary").focus();')
    native_key(display,'Return')
    wait_for(lambda:m.page('const d=document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-key="hybridanalysis:report:link:0"]\');return d.open&&!!d.querySelector("small");'))
    opened=m.page('const d=document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-key="hybridanalysis:report:link:0"]\');return {timesPreserved:d.textContent.includes(new Date(1790000000000).toLocaleString("en")),children:d.children.length};')
    assert opened['timesPreserved'],opened
    m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page,ready=await bg.getMessageAnalysisContext(await b.messages.get(arguments[0]));await (ready.wrappedJSObject||ready).flush();return true;})();''',[target],browser=options)
    preserved=m.page('const root=document.getElementById("thundy-analysis-status").shadowRoot,d=root.querySelector(\'[data-key="hybridanalysis:report:link:0"]\');return d.open&&!!d.querySelector("small")&&root.activeElement?.dataset.focusKey===d.dataset.key;')
    assert preserved
    if not baseline:
        m.page('document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-focus-key="current-find-warning"]\').focus();')
        native_key(display,'Return')
        wait_for(lambda:m.page('const root=document.getElementById("thundy-analysis-status").shadowRoot,d=root.querySelector(\'[data-key="urlscan:url:link:239"]\');return d.open&&!!d.querySelector("small")&&d.querySelector(".service-status")?.textContent==="urlscan.io"&&d.querySelector("summary").getAttribute("aria-label")?.startsWith("urlscan.io · ")&&root.activeElement?.dataset.focusKey===d.dataset.key;'))
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    started=time.monotonic();native_click(display,point['x'],point['y'])
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup='document.getElementById("webextension-remote-preload-panel").querySelector(\'browser[webextension-view-type="popup"]\')'
    wait_for(lambda:m.page('return Array.from(document.getElementById("thundy-analysis-status")?.shadowRoot.querySelectorAll("details")||[]).filter(d=>/^(hybridanalysis|virustotal|urlhaus|abuseipdb|urlscan):/.test(d.dataset.key||"")).length===1200;',browser=popup))
    expert_view(m,popup)
    popup_initial=m.page(inspect,browser=popup);popup_ms=round((time.monotonic()-started)*1000)
    assert popup_initial['closedWithBody']==(1200 if baseline else 0),popup_initial
    wait_for(lambda:m.page('return !!document.querySelector(".local-risk")&&!document.getElementById("thundy-initial-loading");',browser=popup))
    m.js('document.getElementById("webextension-remote-preload-panel").querySelector(\'browser[webextension-view-type="popup"]\').focus();')
    m.page('document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-key="hybridanalysis:report:link:0"] summary\').focus();',browser=popup)
    native_key(display,'Return')
    wait_for(lambda:m.page('const d=document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-key="hybridanalysis:report:link:0"]\');return d.open&&!!d.querySelector("small");',browser=popup))
    popup_opened=m.page('const d=document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-key="hybridanalysis:report:link:0"]\');return d.textContent.includes(new Date(1790000000000).toLocaleString("en"));',browser=popup)
    assert popup_opened
    if not baseline:
        m.page('document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-focus-key="current-find-warning"]\').focus();',browser=popup)
        native_key(display,'Return')
        wait_for(lambda:m.page('const root=document.getElementById("thundy-analysis-status").shadowRoot,d=root.querySelector(\'[data-key="urlscan:url:link:239"]\');return d.open&&!!d.querySelector("small")&&d.querySelector(".service-status")?.textContent==="urlscan.io"&&d.querySelector("summary").getAttribute("aria-label")?.startsWith("urlscan.io · ")&&root.activeElement?.dataset.focusKey===d.dataset.key;',browser=popup))
        m.page('return new Promise(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>resolve(true))));',browser=popup)
        subprocess.run(['import','-window','root',str(out/'active-sources-popup.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    report['activeSources']={'passed':True,'baseline':baseline,'syntheticObservations':True,'liveProviderCalls':False,'fixtureUrls':500,'operationScope':'Context persistence, snapshot construction, runtime injection and DOM commit; no pure renderer time or general latency/RSS claim','message':{'measured':measured,'initial':initial,'opened':opened,'focusAndOpenPreserved':preserved},'popup':{'initial':popup_initial,'openAndAutomationMs':popup_ms,'openedTimePreserved':popup_opened,'keyboardDisclosurePassed':True,'strongestWarningJumpPassed':not baseline}}


def check_history_pages(m, base, out, report, display):
    """Large synthetic history through real storage, message and popup renderer."""
    fixture=out/'large-history.eml'
    fixture.write_bytes(b'From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\nSubject: Thundy large history\r\nMessage-ID: <large-history@example.invalid>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\nSynthetic source history.\r\n')
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const root=MailServices.accounts.localFoldersServer.rootFolder;if(!root.containsChildNamed("Large History"))root.createSubfolder("Large History",null);
      const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);MailServices.copy.copyFileMessage(file,root.getChildNamed("Large History"),null,false,0,"",null,null);''',[str(fixture)])
    wait_for(lambda:m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Large History").getTotalMessages(false);''')==1)
    open_page(m,base+'options.html')
    seeded=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const message=(await b.messages.query({subject:"Thundy large history"})).messages.find(item=>item.subject==="Thundy large history");
      const rows=Array.from({length:1200},(_,index)=>({provider:["hybridanalysis","virustotal","urlhaus","abuseipdb","urlscan"][index%5],scope:["report","hash","domain","ip","url"][index%5],resource:"link:"+index,state:"checked",verdict:index===1199?"malicious":"none",responses:1,observedAt:1790000000000+index*1000,findingAt:1790000000000+index*1000}));
      const legacy={schemaVersion:2,rows};await bg.updateStore(await bg.getSharedDB(),"hybridanalysis",message.headerMessageId,()=>({messageHeader:message.headerMessageId,analysisStatusLegacy:legacy,updatedAt:Date.now()}));
      await b.messageDisplay.open({messageId:message.id,location:"tab"});return {id:message.id,legacy:JSON.stringify(legacy)};
    })();''')
    wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector(".history-range");'))
    inspect='''const host=document.getElementById("thundy-analysis-status"),root=host.shadowRoot,detail=root.querySelector('[data-key="unbound-history"]');return {view:host.dataset.view,cardHidden:root.querySelector(".card").hidden,page:Number(host.dataset.historyPage),entries:detail.querySelectorAll(".history-entries li").length,range:detail.querySelector(".history-range").textContent,summary:detail.querySelector("summary").textContent,localOnly:root.querySelector(".mode").textContent==="Local · no external results recorded",noCurrentThreat:root.querySelector(".card").style.borderColor==="",nodes:root.querySelectorAll("*").length,focused:root.activeElement?.dataset.focusKey||null,warningFocused:root.activeElement?.dataset.historyWarning==="true"};'''
    expert_view(m)
    first=m.page(inspect);assert first['entries']==30 and first['page']==0 and first['noCurrentThreat'],first
    assert 'association unconfirmed' in first['summary'] and 'Suspicious or malicious historical finding' in first['summary'],first
    m.page('const d=document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-key="unbound-history"]\');d.open=true;d.querySelector(\'[data-focus-key="history-next"]\').focus();')
    native_key(display,'Return')
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status").dataset.historyPage==="1";'))
    keyboard=m.page(inspect);assert keyboard['focused']=='history-next' and keyboard['entries']==30,keyboard
    m.page('document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-focus-key="history-find-warning"]\').focus();')
    native_key(display,'Return')
    last=wait_for(lambda:(lambda value:value if value['page']==39 else None)(m.page(inspect)))
    assert last['warningFocused'] and '1171–1200 / 1200' in last['range'] and last['noCurrentThreat'],last
    options_browser='window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.endsWith("/options.html")).browser'
    m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page,ready=await bg.getMessageAnalysisContext(await b.messages.get(arguments[0]));await (ready.wrappedJSObject||ready).flush();return true;})();''',[seeded['id']],browser=options_browser)
    refreshed=m.page(inspect);assert refreshed['page']==39 and refreshed['warningFocused'],refreshed
    m.page('return new Promise(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>resolve(true))));')
    m.screenshot(out/'history-pages-message.png')
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display,point['x'],point['y'])
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
    expert_view(m,popup)
    wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector(".history-range");',browser=popup))
    popup_first=m.page(inspect,browser=popup);assert popup_first['page']==0 and popup_first['entries']==30 and popup_first['noCurrentThreat'],popup_first
    wait_for(lambda:m.page('return !!document.querySelector(".local-risk")&&!document.getElementById("thundy-initial-loading");',browser=popup))
    # The remote popup needs chrome-level browser focus before X11 keys;
    # focusing only a DOM child leaves the native key target in the message.
    popup='document.getElementById("webextension-remote-preload-panel").querySelector(\'browser[webextension-view-type="popup"]\')'
    m.js('document.getElementById("webextension-remote-preload-panel").querySelector(\'browser[webextension-view-type="popup"]\').focus();')
    m.page('const d=document.getElementById("thundy-analysis-status").shadowRoot.querySelector(\'[data-key="unbound-history"]\');d.open=true;d.querySelector(\'[data-focus-key="history-next"]\').focus();',browser=popup)
    m.page('return new Promise(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>resolve(true))));',browser=popup)
    popup_ready=m.page(inspect,browser=popup)
    assert popup_ready['view']=='expert' and not popup_ready['cardHidden'] and popup_ready['focused']=='history-next',popup_ready
    native_key(display,'Return')
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status").dataset.historyPage==="1";',browser=popup))
    native_key(display,'space')
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status").dataset.historyPage==="2";',browser=popup))
    native_key(display,'Tab')
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status").shadowRoot.activeElement?.dataset.focusKey==="history-find-warning";',browser=popup))
    native_key(display,'Return')
    popup_last=wait_for(lambda:(lambda value:value if value['page']==39 else None)(m.page(inspect,browser=popup)))
    assert popup_last['warningFocused'] and popup_last['noCurrentThreat'],popup_last
    assert m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";')
    m.page('return new Promise(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>resolve(true))));',browser=popup)
    subprocess.run(['import','-window','root',str(out/'history-pages-popup.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    open_page(m,base+'options.html')
    preserved=m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page,message=await b.messages.get(arguments[0]),record=await bg.getFromStore(await bg.getSharedDB(),"hybridanalysis",message.headerMessageId);return JSON.stringify(record.analysisStatusLegacy)===arguments[1];})();''',[seeded['id'],seeded['legacy']])
    assert preserved
    report['historyPages']={'passed':True,'syntheticObservations':True,'liveProviderCalls':False,'storedHistoryUnchanged':preserved,'realX11Keyboard':True,'popupKeys':['Return','space','Tab'],'popupKeyboardSetup':'Explicit chrome browser focus before X11 keys','firstMessagePage':first,'keyboardMessagePage':keyboard,'lastMessagePage':last,'afterRefresh':refreshed,'firstPopupPage':popup_first,'lastPopupPage':popup_last,'scope':'Real message and popup, 1200 unbound history observations; no current threat inherited, no screen reader acceptance.'}


def check_hybrid_popup(m, base, out, report, display, baseline=False, actions=False, action_baseline=False):
    """Real popup startup with synthetic stored provider protocols; no network."""
    fixture=out/'hybrid-popup.eml'
    mail=EmailMessage(policy=SMTP)
    mail['From']='fixture@example.invalid';mail['To']='receiver@example.invalid'
    mail['Subject']='Thundy hybrid popup';mail['Message-ID']='<hybrid-popup@example.invalid>'
    mail.set_content('Synthetic local report presentation fixture.')
    names=['first.html','second.html'] if actions else ['first.bin','second.bin']
    for name in names:
        payload=b'<html><body><p>Fixture</p><script>window.fixture=true</script></body></html>' if actions else name.encode()
        mail.add_attachment(payload,maintype='application',subtype='octet-stream',filename=name)
    fixture.write_bytes(mail.as_bytes())
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const root=MailServices.accounts.localFoldersServer.rootFolder;if(!root.containsChildNamed("Hybrid Popup"))root.createSubfolder("Hybrid Popup",null);
      const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
      MailServices.copy.copyFileMessage(file,root.getChildNamed("Hybrid Popup"),null,false,0,"",null,null);''',[str(fixture)])
    wait_for(lambda:m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Hybrid Popup").getTotalMessages(false)===1;'''))
    open_page(m,base+'options.html')
    target=m.page('''return (async()=>{const b=window.wrappedJSObject.browser;await b.storage.local.set({externalAnalysisConsent:false});const message=(await b.messages.query({subject:"Thundy hybrid popup"})).messages.find(row=>row.subject==="Thundy hybrid popup");await b.messageDisplay.open({messageId:message.id,location:"tab"});return message.id;})();''')
    wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status");'))
    open_page(m,base+'options.html')
    before=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page,message=await b.messages.get(arguments[0]);
      const ready=await bg.getMessageAnalysisContext(message),context=ready.wrappedJSObject||ready;
      await bg.processAttachments(message,false,false,context);
      await bg.updateStore(await bg.getSharedDB(),"hybridanalysis",message.headerMessageId,record=>({...record,attachments:record.attachments.map((item,i)=>({...item,state:"KNOWN",report:i===0?{state:"COMPLETE",threat_score:95,verdict:"malicious",tags:"phishing",scanners:[null,{name:"fixture",anti_virus_results:{}}]}:{state:"COMPLETE",threat_score:20,verdict:"clean",tags:["fixture"]}}))}));
      for(const provider of ["hybridanalysis","virustotal","urlhaus","abuseipdb","urlscan"])context.event({provider,scope:"report",resource:"message",phase:"finish",state:provider==="urlscan"?"submitted":"checked",verdict:provider==="hybridanalysis"?"malicious":provider==="urlscan"?"unknown":"none",responded:true,observedAt:1000});
      await context.flush();return JSON.stringify((await bg.getFromStore(await bg.getSharedDB(),"hybridanalysis",message.headerMessageId)).attachments.map(item=>item.report));
    })();''',[target])
    options='window.gTabmail.tabInfo.filter(tab=>tab.browser?.currentURI.spec.endsWith("/options.html")).at(-1).browser'
    if actions:
        m.page('''const b=window.wrappedJSObject.browser,rows=[];
          const observer=request=>{if(["uploadAttachment","downloadDisarmed"].includes(request?.action))rows.push({action:request.action,messageId:request.messageId,partName:request.partName});};
          window.wrappedJSObject.__reportActionRows=rows;window.wrappedJSObject.__reportActionObserver=observer;
          b.runtime.onMessage.addListener(observer);''')
    m.js('window.gTabmail.switchToTab(window.gTabmail.tabInfo.filter(tab=>tab.mode.name==="mailMessageTab").at(-1));')
    wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status");'))
    if not baseline:
        wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status").shadowRoot.querySelectorAll(".service-results").length===5;'))
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display,point['x'],point['y'])
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
    expert_view(m,popup)
    wait_for(lambda:m.page('const area=document.getElementById("hybrid_analysis_api_content");return document.getElementById("subject")?.textContent==="Thundy hybrid popup"&&area?.childElementCount>0&&!document.getElementById("thundy-initial-loading");',browser=popup))
    result=m.page('''const area=document.getElementById("hybrid_analysis_api_content");return {genericError:!!document.getElementById("unexpected-error-msg"),first:area.textContent.includes(arguments[0]),second:area.textContent.includes(arguments[1]),partialNotice:area.textContent.includes("unsupported format"),providerCards:document.getElementById("thundy-analysis-status").shadowRoot.querySelectorAll(".service-results").length};''',names,browser=popup)
    assert result['genericError']==baseline,result
    if not baseline:
        assert result['first'] and result['second'] and result['partialNotice'] and result['providerCards']==5,result
    subprocess.run(['import','-window','root',str(out/'hybrid-popup.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    m.page('document.getElementById("hybrid_analysis_api_content").scrollIntoView({block:"start"});',browser=popup)
    subprocess.run(['import','-window','root',str(out/'hybrid-report-details.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    if actions:
        controls=m.page('''const area=document.getElementById("hybrid_analysis_api_content"),buttons=[...area.querySelectorAll("button")];
          const api=window.wrappedJSObject.browser,rescans=buttons.filter(b=>b.textContent===api.i18n.getMessage("ui_034")),downloads=buttons.filter(b=>b.textContent===api.i18n.getMessage("ui_035"));
          const ids=[...area.querySelectorAll("[id]")].map(n=>n.id);
          rescans[0].click();return {firstRescan:rescans[0].id,secondRescan:rescans[1].id,secondDownload:downloads[1].id,unique:new Set(ids).size===ids.length};''',browser=popup)
        if action_baseline:
            # Old callbacks are absent: no request reaches the observer. Allow
            # the real event loop to drain without inventing a successful click.
            m.page('return new Promise(resolve=>setTimeout(()=>resolve(true),300));',browser=popup)
            observed=m.page('return JSON.stringify(window.wrappedJSObject.__reportActionRows);',browser=options)
            assert json.loads(observed)==[] and not controls['unique'],controls
            report['reportActions']={'passed':True,'baseline':True,'requestCount':0,'uniqueControlIds':False}
        else:
            observed=wait_for(lambda:(lambda rows:rows if rows else None)(json.loads(m.page('return JSON.stringify(window.wrappedJSObject.__reportActionRows);',browser=options))))
            assert observed==[{'action':'uploadAttachment','messageId':target,'partName':'1.2'}],observed
            wait_for(lambda:m.page('const b=document.getElementById(arguments[0]),s=document.getElementById(b.getAttribute("aria-describedby"));return !b.disabled&&s.textContent.startsWith(window.wrappedJSObject.browser.i18n.getMessage("ui_045"));',[controls['firstRescan']],browser=popup))
            assert controls['unique']
            assert m.page('const b=document.getElementById(arguments[0]);return !b.disabled&&document.getElementById(b.getAttribute("aria-describedby")).textContent==="";',[controls['secondRescan']],browser=popup)
            actual=native_download(m,display,out,controls['secondDownload'],'local-cdr-report.html',browser=options,button_browser=popup,save_button=True)
            data=actual.read_bytes();assert b'Fixture' in data and b'<script' not in data.lower(),data
            observed=json.loads(m.page('return JSON.stringify(window.wrappedJSObject.__reportActionRows);',browser=options))
            assert observed==[{'action':'uploadAttachment','messageId':target,'partName':'1.2'},{'action':'downloadDisarmed','messageId':target,'partName':'1.3'}],observed
            report['reportActions']={'passed':True,'baseline':False,'requests':observed,'uniqueControlIds':True,'externalConsent':False,'realLocalCdrDownload':True,'scriptRemoved':True,'downloadSha256':hashlib.sha256(data).hexdigest(),'inputAttachmentsHaveEqualBytes':True}
        m.page('window.wrappedJSObject.browser.runtime.onMessage.removeListener(window.wrappedJSObject.__reportActionObserver);',browser=options)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    m.screenshot(out/'hybrid-message.png')
    open_page(m,base+'options.html')
    after=m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page,message=await b.messages.get(arguments[0]);return JSON.stringify((await bg.getFromStore(await bg.getSharedDB(),"hybridanalysis",message.headerMessageId)).attachments.map(item=>item.report));})();''',[target])
    assert before==after
    report['hybridPopup']={'passed':True,'baseline':baseline,'syntheticReports':True,'externalConsent':False,'storedReportsUnchanged':True,**result}



def check_stored_sources(m, base, out, report, display, baseline=False):
    """Actual source RPCs and both views, synthetic stored metadata, no provider calls."""
    open_page(m,base+'options.html')
    prepared=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const message=(await b.messages.query({subject:"Thundy hybrid popup"})).messages.find(row=>row.subject==="Thundy hybrid popup");
      let tabId=null;for(const tab of await b.tabs.query({})){try{const list=await b.messageDisplay.getDisplayedMessages(tab.id);if(list.messages?.some(row=>row.id===message.id)){tabId=tab.id;break;}}catch{}}
      if(tabId===null)throw new Error("Fixture message tab missing");
      await b.runtime.sendMessage({action:"clearMemoryCaches"});
      const ready=await bg.getMessageAnalysisContext(message,tabId),context=ready.wrappedJSObject||ready;
      for(const provider of ["hybridanalysis","virustotal","urlhaus","abuseipdb","urlscan"]){context.event({provider,scope:"url",resource:null,phase:"finish",state:"failed",verdict:"unknown",responded:false,observedAt:null});context.event({provider,scope:"url",resource:null,phase:"finish",state:"received",verdict:"unknown",responded:true,observedAt:1000});}
      await b.runtime.sendMessage({action:"getLocalRisk",messageId:message.id});await context.flush();
      return {messageId:message.id,expectedPhase:b.i18n.getMessage(arguments[0]?"analysisModePartial":"analysisModeResponsesFailed"),warning:b.i18n.getMessage("analysisStoredDataIncomplete")};
    })();''',[baseline])
    m.js('window.gTabmail.switchToTab(window.gTabmail.tabInfo.filter(tab=>tab.mode.name==="mailMessageTab").at(-1));')
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector(".phase")?.textContent===arguments[0];',[prepared['expectedPhase']]))
    m.screenshot(out/'responses-without-verdict.png')
    open_page(m,base+'options.html')
    original=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page,message=await b.messages.get(arguments[0]),db=await bg.getSharedDB();
      await bg.updateStore(db,"hybridanalysis",message.headerMessageId,old=>({...old,attachments:[null,...old.attachments],links:{unreadable:true},analysisStatusLegacy:{schemaVersion:2,rows:[null,...["hybridanalysis","virustotal","urlhaus","abuseipdb","urlscan"].map(provider=>({provider,scope:"report",state:"checked",verdict:"malicious",responses:1,observedAt:10}))]}}));
      if(!arguments[1]){
        await bg.pruneStore(db,"hybridanalysis");
        const ready=await bg.getMessageAnalysisContext(message),context=ready.wrappedJSObject||ready;
        for(const attachment of await b.messages.listAttachments(message.id)){
          const file=await b.messages.getAttachmentFile(message.id,attachment.partName);
          const bytes=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsArrayBuffer(file);});
          context.forAttachment(attachment.partName,attachment.name,await bg.get_sha256_hash(bytes));
        }
        await context.flush();
      }
      const stored=await bg.getFromStore(db,"hybridanalysis",message.headerMessageId);
      return JSON.stringify({attachments:stored.attachments,links:stored.links,legacy:stored.analysisStatusLegacy});
    })();''',[prepared['messageId'],baseline])
    result=m.page('return window.wrappedJSObject.browser.runtime.sendMessage({action:"getMessageAnalysisRecord",messageId:arguments[0]});',[prepared['messageId']])
    assert result['success'] != baseline,result
    m.js('window.gTabmail.switchToTab(window.gTabmail.tabInfo.filter(tab=>tab.mode.name==="mailMessageTab").at(-1));')
    if not baseline:
        wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.textContent.includes(arguments[0]);',[prepared['warning']]))
        assert m.page('return document.getElementById("thundy-analysis-status").shadowRoot.querySelectorAll("[data-provider]").length===5;')
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display,point['x'],point['y'])
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
    expert_view(m,popup)
    wait_for(lambda:m.page('return document.getElementById("subject")?.textContent==="Thundy hybrid popup"&&!!document.getElementById("hybrid_analysis_api_content")?.childElementCount&&!document.getElementById("thundy-initial-loading");',browser=popup))
    assert m.page('return !!document.getElementById("unexpected-error-msg");',browser=popup)==baseline
    if not baseline:
        assert m.page('return document.getElementById("hybrid_analysis_api_content").textContent.includes(arguments[0])&&document.getElementById("hybrid_analysis_api_content").textContent.includes("first.bin")&&document.getElementById("hybrid_analysis_api_content").textContent.includes("second.bin");',[prepared['warning']],browser=popup)
    subprocess.run(['import','-window','root',str(out/'stored-source-recovery.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    open_page(m,base+'options.html')
    after=m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page,message=await b.messages.get(arguments[0]),stored=await bg.getFromStore(await bg.getSharedDB(),"hybridanalysis",message.headerMessageId);return JSON.stringify({attachments:stored.attachments,links:stored.links,legacy:stored.analysisStatusLegacy});})();''',[prepared['messageId']])
    assert original==after
    report['storedSources']={'passed':True,'baseline':baseline,'genericPopupError':baseline,'rpcSuccess':not baseline,'reportsAndLegacyUnchanged':True,'externalConsent':False,'syntheticObservations':True,'phaseWithoutVerdict':prepared['expectedPhase']}


def probe_source_export_navigation(m, base, invalidate=False):
    """Observe actual document reuse, without assuming a back/forward cache."""
    m.page('''sessionStorage.removeItem("thundyNavigationEvents");
      window.wrappedJSObject.__thundyNavigationMarker="original-export-document";
      for(const type of ["pagehide","pageshow"])addEventListener(type,event=>{
        const rows=JSON.parse(sessionStorage.getItem("thundyNavigationEvents")||"[]");
        rows.push({type,persisted:event.persisted});sessionStorage.setItem("thundyNavigationEvents",JSON.stringify(rows));
      });
      setTimeout(()=>location.assign(arguments[0]),0);''', [base+'options.html'])
    wait_for(lambda:m.page('return location.pathname.endsWith("/options.html")&&document.readyState==="complete";'))
    if invalidate:
        m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
          await bg.clearStore(await bg.getSharedDB(),"hybridanalysis");
          await b.runtime.sendMessage({action:"clearMemoryCaches"});return true;})();''')
    m.page('setTimeout(()=>history.back(),0);')
    wait_for(lambda:m.page('return location.pathname.endsWith("/source_export.html")&&document.readyState==="complete";'))
    observed=m.page('''return {sameDocument:window.wrappedJSObject.__thundyNavigationMarker==="original-export-document",
      events:JSON.parse(sessionStorage.getItem("thundyNavigationEvents")||"[]"),
      navigationType:performance.getEntriesByType("navigation")[0]?.type,
      initiallyEmpty:document.getElementById("sourceExportContent").textContent==="",
      initiallyDisabled:document.getElementById("sourceExportSave").disabled};''')
    m.page('document.getElementById("sourceExportPreview").click();')
    state=wait_for(lambda:m.page('''const p=document.getElementById("sourceExportContent"),s=document.getElementById("sourceExportSave");
      if(!p.hidden&&!s.disabled)return "fresh-preview";
      if(document.getElementById("sourceExportStatus").textContent.startsWith("The message context is no longer available")&&s.disabled&&p.textContent==="")return "unavailable";
      return null;'''))
    observed['afterExplicitPreview']=state
    observed['cacheClearedWhileAway']=invalidate
    assert observed['initiallyEmpty'] and observed['initiallyDisabled'],observed
    assert state==('unavailable' if invalidate else 'fresh-preview'),observed
    return observed


def check_source_export(m, base, out, report, restart, display):
    """Real popup entry, privacy projection, GTK download, clear and restart."""
    open_page(m,base+'options.html')
    target_id=report['auditRecord']['messageId']
    m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const message=await b.messages.get(arguments[0]),ready=await bg.getMessageAnalysisContext(message),context=ready.wrappedJSObject||ready;
      const rows=["hybridanalysis","virustotal","urlhaus","abuseipdb","urlscan"].map((provider,index)=>({provider,scope:["report","hash","domain","ip","url"][index],resource:"message",state:provider==="urlscan"?"submitted":"checked",verdict:provider==="urlscan"?"unknown":"none",responses:1,observedAt:1000}));
      await bg.updateStore(await bg.getSharedDB(),"hybridanalysis",message.headerMessageId,record=>({...record,messageHeader:message.headerMessageId,analysisStatusLegacy:{schemaVersion:2,rows:rows.map(row=>({...row,observedAt:500,verdict:"malicious"}))},updatedAt:Date.now()}));
      for(const row of rows)context.event({...row,phase:"finish",responded:true});await context.flush();
      await b.messageDisplay.open({messageId:message.id,location:"tab"});
      return {messageId:message.id};
    })();''',[target_id])
    wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status");'))
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser;
      const r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();
      return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display,point['x'],point['y'])
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
    expert_view(m,popup)
    wait_for(lambda:m.page('return !!document.querySelector(".local-risk")&&!document.getElementById("thundy-initial-loading");',browser=popup))
    m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;const ready=await bg.getMessageAnalysisContext(await b.messages.get(arguments[0]));await (ready.wrappedJSObject||ready).flush();return true;})();''',[target_id],browser=popup)
    url=wait_for(lambda:m.page('const a=document.getElementById("sourceExportOpen");return a&&!a.hidden&&a.href;',browser=popup))
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    open_page(m,url)
    wait_for(lambda:m.page('return document.getElementById("sourceExportPreview")?.textContent!=="";'))
    wait_for(lambda:m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;const ready=await bg.getMessageAnalysisContext(await b.messages.get(arguments[0]));return !(ready.wrappedJSObject||ready).timer;})();''',[target_id]))
    assert m.page('return document.getElementById("sourceExportContent").hidden&&document.getElementById("sourceExportSave").disabled;')
    m.page('document.getElementById("sourceExportPreview").click();')
    preview=wait_for(lambda:m.page('const p=document.getElementById("sourceExportContent");return !p.hidden&&JSON.parse(p.textContent);'))
    assert len({row['provider'] for row in preview['current']['rows']})==5,preview
    assert all(row['observedAt']==1000 for row in preview['current']['rows']),preview
    assert preview['history']['rows'] and all(row['resource']['kind']=='unbound' for row in preview['history']['rows']),preview
    encoded=json.dumps(preview)
    assert all(text not in encoded for text in ['messageId','contextToken','headerMessageId','https://','@','fixture@example','apikey','resourceLabels']),encoded
    save_control=m.page('const b=document.getElementById("sourceExportSave"),s=getComputedStyle(b),r=b.getBoundingClientRect();return {text:b.textContent,disabled:b.disabled,display:s.display,visibility:s.visibility,opacity:s.opacity,width:r.width,height:r.height};')
    assert save_control['text'] and not save_control['disabled'] and save_control['display']!='none' and save_control['visibility']=='visible' and float(save_control['opacity'])>0 and save_control['width']>40 and save_control['height']>=40,save_control
    m.screenshot(out/'source-export-preview.png')
    subprocess.run(['import','-window','root',str(out/'source-export-preview-root.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    m.page('document.getElementById("sourceExportCancel").click();')
    assert m.page('return document.getElementById("sourceExportContent").textContent===""&&document.getElementById("sourceExportSave").disabled;')
    m.page('document.getElementById("sourceExportPreview").click();')
    expected=wait_for(lambda:m.page('const p=document.getElementById("sourceExportContent");return !p.hidden&&JSON.parse(p.textContent);'))
    downloaded=native_json_download(m,display,out,'sourceExportSave','source-export-download')
    assert downloaded==expected
    navigation=[probe_source_export_navigation(m,base),probe_source_export_navigation(m,base,invalidate=True)]
    report['sourceExportNavigation']={'passed':True,'cases':navigation,'scope':'Actual same-tab forward navigation and history.back; document reuse observed rather than assumed. No synthetic pageshow event.'}
    m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;await bg.clearStore(await bg.getSharedDB(),"hybridanalysis");await b.runtime.sendMessage({action:"clearMemoryCaches"});return true;})();''')
    wait_for(lambda:m.page('return document.getElementById("sourceExportSave").disabled&&document.getElementById("sourceExportContent").textContent==="";'))
    m.page('document.getElementById("sourceExportPreview").click();')
    wait_for(lambda:m.page('return document.getElementById("sourceExportStatus").textContent.startsWith("The message context is no longer available");'))
    close_extension_tabs(m)
    m.js('for(const tab of [...window.gTabmail.tabInfo])if(tab.mode.name==="mailMessageTab")window.gTabmail.closeTab(tab);')
    m=restart();open_page(m,url)
    wait_for(lambda:m.page('return !!document.getElementById("sourceExportPreview");'))
    m.page('document.getElementById("sourceExportPreview").click();')
    wait_for(lambda:m.page('return document.getElementById("sourceExportStatus").textContent.startsWith("The message context is no longer available");'))
    assert m.page('return document.getElementById("sourceExportSave").disabled&&document.getElementById("sourceExportContent").textContent==="";')
    report['sourceExport']={'passed':True,'realPopupEntry':True,'realGtkDownload':True,'downloadMatchesPreview':True,'cancelAndCacheClearInvalidate':True,'oldRuntimeLinkRefusedAfterRestart':True,'syntheticObservations':True,'liveProviderCalls':False,'saveControl':save_control,'providers':sorted({row['provider'] for row in downloaded['current']['rows']}),'canonicalDownloadSha256':hashlib.sha256(json.dumps(downloaded,sort_keys=True).encode()).hexdigest(),'scope':'Native Linux APIs and real download of allowlisted snapshot; synthetic observations, no live provider or screen reader acceptance.'}
    return m


def check_report_archive(m, base, out, report, restart, display):
    """Real MIME, popup-side protected DAO and restart; synthetic provider protocols."""
    for index, (name, payload) in enumerate([('A', 'AAAA'), ('B', 'BBBB')], 1):
        fixture = out / ('report-archive-' + name + '.eml')
        fixture.write_bytes(('From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\nSubject: Thundy report archive ' + name + '\r\nMessage-ID: <report-archive-collision@example.invalid>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="archive"\r\n\r\n--archive\r\nContent-Type: text/plain\r\n\r\nSynthetic archive fixture.\r\n--archive\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="same.bin"\r\n\r\n' + payload + '\r\n--archive--\r\n').encode('ascii'))
        m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          const root=MailServices.accounts.localFoldersServer.rootFolder;
          if(!root.containsChildNamed("Report Archive"))root.createSubfolder("Report Archive",null);
          const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
          MailServices.copy.copyFileMessage(file,root.getChildNamed("Report Archive"),null,false,0,"",null,null);''', [str(fixture)])
        wait_for(lambda: m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
          return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Report Archive").getTotalMessages(false);''') == index)
    open_page(m, base + 'options.html')
    before = m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const find=async name=>(await b.messages.query({subject:"Thundy report archive "+name})).messages.find(item=>item.subject==="Thundy report archive "+name);
      const a=await find("A"),target=await find("B"),part=(await b.messages.listAttachments(a.id))[0];
      const hashed=await bg.process_single_attachment(a,part,false,false),db=await bg.getSharedDB();
      const old={partName:part.partName,attachment_name:"same.bin",hybrid_sha256:hashed.hybrid_data.sha256,hybrid_job_id:"job-A",hybrid_submission_id:"submission-A",state:"KNOWN",report:{state:"COMPLETE",verdict:"malicious",created:"provider-original",details:{nested:[1,"original",{retained:true}]}},report_fetched_at:"2026-10-02T08:00:00.000Z",virustotal_stats:{malicious:2,undetected:5},created:new Date()};
      await bg.updateStore(db,"hybridanalysis",a.headerMessageId,()=>({messageHeader:a.headerMessageId,attachments:[old],updatedAt:Date.now()}));
      await bg.processAttachments(a,false,false);
      const same=await bg.getFromStore(db,"hybridanalysis",a.headerMessageId);
      const offlineKeptReport=JSON.stringify(same.attachments[0].report)===JSON.stringify(old.report)&&same.attachments[0].report_fetched_at===old.report_fetched_at&&same.attachments[0].hybrid_job_id==="job-A"&&!same.analysisReportArchive;
      await bg.processAttachments(target,false,false);
      const changed=await bg.getFromStore(db,"hybridanalysis",a.headerMessageId),entry=changed.analysisReportArchive.entries[0];
      const exactOriginal=JSON.stringify(entry.resource.report)===JSON.stringify(old.report)&&entry.resource.hybrid_sha256===old.hybrid_sha256&&entry.resource.report_fetched_at===old.report_fetched_at&&entry.resource.virustotal_stats.malicious===2&&entry.resource.hybrid_submission_id==="submission-A";
      const current=changed.attachments[0];
      await bg.updateStore(db,"hybridanalysis",a.headerMessageId,record=>{record.attachments[0]={...current,state:"KNOWN",hybrid_job_id:"job-B",report:{state:"COMPLETE",verdict:"malicious",details:{originalB:true}},report_fetched_at:"2026-10-03T08:00:00.000Z"};return record;});
      return {offlineKeptReport,exactOriginal,newContentClearedCurrentReport:current.report===null,differentHashes:current.hybrid_sha256!==old.hybrid_sha256,archiveEntries:changed.analysisReportArchive.entries.length};
    })();''')
    assert all(before[key] for key in ['offlineKeptReport', 'exactOriginal', 'newContentClearedCurrentReport', 'differentHashes']) and before['archiveEntries'] == 1, before
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const {MailUtils}=ChromeUtils.importESModule("resource:///modules/MailUtils.sys.mjs");
      MailUtils.displayMessage(Array.from(MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Report Archive").messages).find(h=>h.subject==="Thundy report archive B"));''')
    wait_for(lambda: m.page('return !!document.getElementById("thundy-analysis-status");'))
    point = m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser;
      const r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();
      return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display, point['x'], point['y'])
    wait_for(lambda: m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup = 'document.querySelector(\'browser[webextension-view-type="popup"]\')'
    wait_for(lambda: m.page('return typeof window.wrappedJSObject.updateStore==="function"&&!!document.getElementById("thundy-analysis-status");', browser=popup))
    saved = m.page('''return (async()=>{
      const w=window.wrappedJSObject,b=w.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const target=(await b.messages.query({subject:"Thundy report archive B"})).messages.find(item=>item.subject==="Thundy report archive B");
      const db=await bg.getSharedDB(),record=await bg.getFromStore(db,"hybridanalysis",target.headerMessageId),item=record.attachments[0];
      const write=async(report,fetchedAt)=>{const popupDb=await w.openDB();try{return await w.updateStore(popupDb,"hybridanalysis",target.headerMessageId,record=>{record.attachments[0].report=report;record.attachments[0].report_fetched_at=fetchedAt;return record;},{preserveReports:true}).then(()=>true,()=>false);}finally{popupDb.close();}};
      const success=await write({state:"COMPLETE",verdict:"clean",details:{newB:true}},"2026-11-03T08:00:00.000Z");
      const saved=await bg.getFromStore(db,"hybridanalysis",target.headerMessageId);
      const oldB=saved.analysisReportArchive.entries.find(entry=>entry.resource.report?.details?.originalB);
      await bg.updateStore(db,"hybridanalysis",target.headerMessageId,record=>{
        while(record.analysisReportArchive.entries.length<128)record.analysisReportArchive.entries.push({id:crypto.randomUUID(),archivedAt:Date.now(),kind:"link",slot:record.analysisReportArchive.entries.length,resource:{url:"https://archive.example.invalid/"+record.analysisReportArchive.entries.length,report:{state:"COMPLETE",verdict:"unknown"}}});return record;
      });
      const full=await bg.getFromStore(db,"hybridanalysis",target.headerMessageId);
      const refused=await write({state:"COMPLETE",verdict:"malicious",details:{mustNotCommit:true}},new Date().toISOString());
      const after=await bg.getFromStore(db,"hybridanalysis",target.headerMessageId);
      return {popupSaved:success,oldBRetained:!!oldB&&oldB.resource.report_fetched_at==="2026-10-03T08:00:00.000Z",archiveEntriesBeforeLimit:saved.analysisReportArchive.entries.length,capacityRefused:refused===false,protocolUnchanged:JSON.stringify(after.attachments)===JSON.stringify(full.attachments),archiveUnchanged:JSON.stringify(after.analysisReportArchive)===JSON.stringify(full.analysisReportArchive)};
    })();''', browser=popup)
    assert all(saved[key] for key in ['popupSaved', 'oldBRetained', 'capacityRefused', 'protocolUnchanged', 'archiveUnchanged']) and saved['archiveEntriesBeforeLimit'] == 2, saved
    warning = 'A report update could not be saved. Earlier protocols were retained.'
    wait_for(lambda: m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.textContent.includes(arguments[0]);', [warning], browser=popup))
    subprocess.run(['import', '-window', 'root', str(out / 'report-archive-popup.png')], env={**os.environ, 'DISPLAY': display}, check=True, timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    wait_for(lambda: m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.textContent.includes(arguments[0]);', [warning]))
    m.screenshot(out / 'report-archive-message.png')
    close_extension_tabs(m)
    m.js('for(const tab of [...window.gTabmail.tabInfo])if(tab.mode.name==="mailMessageTab")window.gTabmail.closeTab(tab);')
    m = restart()
    open_page(m, base + 'options.html')
    after = m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const target=(await b.messages.query({subject:"Thundy report archive B"})).messages.find(item=>item.subject==="Thundy report archive B");
      const record=await bg.getFromStore(await bg.getSharedDB(),"hybridanalysis",target.headerMessageId);
      const snapshot=await b.runtime.sendMessage({action:"getMessageAnalysis",messageId:target.id});
      return {archiveEntries:record.analysisReportArchive.entries.length,originalA:record.analysisReportArchive.entries.some(entry=>entry.resource.report?.details?.nested?.[2]?.retained),originalB:record.analysisReportArchive.entries.some(entry=>entry.resource.report?.details?.originalB),currentClean:record.attachments[0].report.verdict==="clean",activeRows:snapshot.rows.length,historicalUnbound:snapshot.sourceHistory.rows.every(row=>row.resource===null),originalTimeInHistory:snapshot.sourceHistory.rows.some(row=>row.observedAt===Date.parse("2026-10-02T08:00:00Z"))};
    })();''')
    assert after['archiveEntries'] == 128 and after['activeRows'] == 0 and all(after[key] for key in ['originalA', 'originalB', 'currentClean', 'historicalUnbound', 'originalTimeInHistory']), after
    report['reportArchive'] = {'passed': True, 'syntheticProtocols': True, 'liveProviderCalls': False, 'realMimeIndexedDBPopupRestart': True, 'popupWriteScope': 'Actual protected DAO in the native popup with fixture callback; module-private persistHybridReport is covered separately by Node integration.', 'before': before, 'popupAndCapacity': saved, 'afterRestart': after, 'warningVisibleInMessageAndPopup': True, 'scope': 'Bounded revisions in the existing header cache; no independent durable archive.'}
    return m


def check_restart_upgrade(m, args, out, display, report, restart):
    with zipfile.ZipFile(args.xpi) as package:
        current_version = json.loads(package.read('manifest.json'))['version']
        current_catalog = json.loads(package.read('_locales/'+args.locale+'/messages.json'))
    old = {}
    run_checks(m, args.previous_xpi, out, display, old, args.locale, args.langpack, None,
               permanent=True, audit_only=True)
    report['previousInstallation'] = old
    report['client'] = old['client']
    report['extensionVersion'] = current_version
    report['previousXpiSha256'] = hashlib.sha256(args.previous_xpi.read_bytes()).hexdigest()
    old_state = addon_state(m)
    assert old_state['active'] and not old_state['temporary'] and not old_state['appDisabled'] and old_state['profileScoped']
    assert tuple(map(int, old_state['version'].split('.'))) < tuple(map(int, current_version.split('.')))
    base = m.page('return window.wrappedJSObject.browser.runtime.getURL("");')
    if args.identity_check:
        probe_mail = out / 'identity-second.eml'
        probe_mail.write_text('From: fixture@example.invalid\nTo: receiver@example.invalid\nSubject: Thundy identity second\nMessage-ID: <identity-second@example.invalid>\nMIME-Version: 1.0\nContent-Type: text/plain\n\nSynthetic identity probe.\n')
        m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
            const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests");
            const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
            MailServices.copy.copyFileMessage(file,folder,null,false,0,"",null,null);''', [str(probe_mail)])
        wait_for(lambda: m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");return MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests").getTotalMessages(false)===2;'''))
        report['messageIdentity'] = {'synthetic':True,'beforeRestart':message_identity_snapshot(m, False)}
        m.js('''for(const tab of [...window.gTabmail.tabInfo])if(tab.mode.name==="mailMessageTab")window.gTabmail.closeTab(tab);''')
    before = storage_snapshot(m)
    assert len(before['linkAuditLog']) == 3
    close_extension_tabs(m)
    m = restart(backup_to=out / '.rollback-profile' if args.restore_check else None)
    assert addon_state(m) == old_state
    assert m.js('return !window.gTabmail.tabInfo.some(t=>t.browser?.currentURI.spec.endsWith("/onboarding.html"));')
    open_page(m, base+'audit.html')
    assert storage_snapshot(m) == before
    if args.identity_check:
        report['messageIdentity']['afterRestart'] = message_identity_snapshot(m, True)
        old_ids={item['headerMessageId']:item['id'] for item in report['messageIdentity']['beforeRestart']}
        report['messageIdentity']['numericIdsStableInThisProbe'] = all(old_ids[item['headerMessageId']]==item['id'] for item in report['messageIdentity']['afterRestart'])

    assert m.js('return !window.gTabmail.tabInfo.some(t=>t.browser?.currentURI.spec.endsWith("/onboarding.html"));')
    language = m.page('return window.wrappedJSObject.browser.i18n.getUILanguage();')
    assert language.split('-')[0] == args.locale
    report['previousRestart'] = {'addon': addon_state(m), 'storagePreserved': True, 'wizardAbsent': True, 'uiLanguage': language}
    m.screenshot(out/'previous-after-restart.png')
    m.command('Addon:Install', {'path': str(args.xpi), 'temporary': False})
    wait_for(lambda: (addon_state(m) or {}).get('version') == current_version)
    current_state = addon_state(m)
    assert current_state['active'] and not current_state['temporary'] and not current_state['appDisabled'] and current_state['profileScoped']
    assert m.js('return !window.gTabmail.tabInfo.some(t=>t.browser?.currentURI.spec.endsWith("/onboarding.html"));')
    open_page(m, base+'options.html')
    saved = storage_snapshot(m)
    assert all(saved.get(key) == value for key, value in before.items())
    assert saved.get('externalAnalysisConsent') is not True
    wait_for(lambda: m.page('return !document.querySelector(\'input[name="appearance"][value="dark"]\')?.disabled && !!document.querySelector(\'input[name="appearance"][value="dark"]\');'))
    import_appearance_profile(m, {'schemaVersion':1,'kind':'thundy-local-settings','appearance':{'mode':'dark','accent':'violet','density':'compact'}})
    wait_for(lambda: m.page('return document.documentElement.dataset.theme==="dark" && document.documentElement.dataset.accent==="violet" && document.documentElement.dataset.density==="compact";'))
    after_upgrade = wait_for(lambda: m.page('return window.wrappedJSObject.browser.storage.local.get(null).then(s=>s.thundyAppearance==="dark" && s.thundyAccent==="violet" && s.thundyDensity==="compact"?s:null);'))
    close_extension_tabs(m)
    m = restart()
    assert addon_state(m) == current_state
    assert m.js('return !window.gTabmail.tabInfo.some(t=>t.browser?.currentURI.spec.endsWith("/onboarding.html"));')
    open_page(m, base+'audit.html')
    assert storage_snapshot(m) == after_upgrade
    assert all(after_upgrade.get(key)==value for key,value in before.items() if key not in ['thundyAppearance','thundyAccent','thundyDensity'])
    report['appearanceProfileRestart'] = {'passed':True,'confirmedUiImport':True,'storagePreserved':True,'unrelatedDataPreserved':True}
    wait_for(lambda: m.page('return document.querySelectorAll("#auditRows tr").length===3;'))
    assert current_catalog['auditRiskyOpened']['message'] in m.page('return document.getElementById("auditSummary").textContent;')
    m.screenshot(out/'current-audit-after-restart.png')
    language = m.page('return window.wrappedJSObject.browser.i18n.getUILanguage();')
    assert language.split('-')[0] == args.locale
    report['currentRestart'] = {'addon': addon_state(m), 'storagePreserved': True, 'uiLanguage': language,
        'wizardAbsent': True, 'auditRecordsPreserved': len(before['linkAuditLog'])}
    open_page(m, base+'options.html')
    wait_for(lambda: m.page('return {theme:document.documentElement.dataset.theme,accent:document.documentElement.dataset.accent,density:document.documentElement.dataset.density};') == {'theme':'dark','accent':'violet','density':'compact'})
    m.screenshot(out/'current-settings-after-restart.png')
    # Reopen the persisted local message and use the real, newly injected link protection.
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
        const {MailUtils}=ChromeUtils.importESModule("resource:///modules/MailUtils.sys.mjs");
        const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests");
        MailUtils.displayMessage(Array.from(folder.messages)[0]);''')
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.mode.name==="mailMessageTab";'))
    wait_for(lambda: m.page('return document.documentElement.dataset.thundyClickProtection==="true";'))
    m.page('document.querySelector("a[href^=http]").click();')
    wait_for(lambda: m.page('return document.getElementById("thundy-link-dialog")?.shadowRoot.querySelectorAll("footer button").length===2;'))
    with zipfile.ZipFile(args.xpi) as package:
        catalog = json.loads(package.read('_locales/'+args.locale+'/messages.json'))
    report['dialogTitleAfterRestart'] = m.page('return document.getElementById("thundy-link-dialog").shadowRoot.querySelector("h2").textContent;')
    assert report['dialogTitleAfterRestart'] == catalog['linkDialogTitle']['message']
    m.page('document.getElementById("thundy-link-dialog").shadowRoot.querySelector("footer button").click();')
    open_page(m, base+'audit.html')
    final = wait_for(lambda: m.page('return window.wrappedJSObject.browser.storage.local.get("linkAuditLog").then(s=>s.linkAuditLog?.length===4?s.linkAuditLog:null);'))
    assert all(record in final for record in before['linkAuditLog'])
    added = [r for r in final if r['id'] not in {r['id'] for r in before['linkAuditLog']}]
    assert len(added)==1 and added[0]['outcome']=='ABORTED' and added[0]['url']==URL
    assert added[0]['extensionVersion']==current_version and added[0]['scoreAtDecision']==0
    assert m.js('return !window.gTabmail.tabInfo.some(t=>t.browser?.currentURI.spec.endsWith("/onboarding.html"));')
    report['newRecordAfterRestart'] = added[0]
    report['finalAuditRecords'] = final
    assert report.get('gracefulRestarts') == 2
    if args.crash_check:
        check_crash_recovery(m, args, out, report, restart, base, current_state)
    if args.restore_check:
        m = restart(restore_from=out / '.rollback-profile')
        restored = addon_state(m)
        assert restored['version'] == old_state['version'] and restored['active']
        open_page(m, base + 'options.html')
        assert storage_snapshot(m) == before
        report['backupRestore'] = {'passed': True, 'restoredVersion': restored['version'],
                                  'snapshotRecordsPreserved': len(before['linkAuditLog']),
                                  'scope': 'clean full-profile backup before upgrade; newer candidate events are outside this snapshot'}
        shutil.rmtree(out / '.rollback-profile')
    report['passed'] = True


def open_test_link_dialog(m):
    m.js('''const {MailServices}=ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
        const {MailUtils}=ChromeUtils.importESModule("resource:///modules/MailUtils.sys.mjs");
        const folder=MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Thundy Tests");
        MailUtils.displayMessage(Array.from(folder.messages)[0]);''')
    wait_for(lambda: m.js('return window.gTabmail.currentTabInfo.mode.name==="mailMessageTab";'))
    wait_for(lambda: m.page('return document.documentElement.dataset.thundyClickProtection==="true";'))
    m.page('document.querySelector("a[href^=http]").click();')
    wait_for(lambda: m.page('return document.getElementById("thundy-link-dialog")?.shadowRoot.querySelectorAll("footer button").length===2;'))


def check_crash_recovery(m, args, out, report, restart, base, installed):
    before = storage_snapshot(m)
    receipt = (out/'os-handoff.json').read_text()
    assert len(before['linkAuditLog']) == 4
    # No flush, artificial delay, or graceful shutdown between the acknowledged read and SIGKILL.
    m = restart(abrupt=True)
    assert addon_state(m) == installed
    open_page(m, base+'audit.html')
    assert storage_snapshot(m) == before
    wait_for(lambda: m.page('return document.querySelectorAll("#auditRows tr").length===4;'))
    language = m.page('return window.wrappedJSObject.browser.i18n.getUILanguage();')
    assert language.split('-')[0] == args.locale
    assert (out/'os-handoff.json').read_text() == receipt
    m.screenshot(out/'audit-after-first-crash.png')
    report['acknowledgedCrashRecovery'] = {'recordsPreserved': 4, 'storagePreserved': True,
        'addon': addon_state(m), 'uiLanguage': language, 'extraOsDispatches': 0}
    open_test_link_dialog(m)
    # Read the actual storage from the existing, inactive audit tab; leave the dialog open.
    audit_browser = 'window.gTabmail.tabInfo.find(t=>t.browser?.currentURI.spec.endsWith("/audit.html")).browser'
    pending_state = m.page('return window.wrappedJSObject.browser.storage.local.get(null);', browser=audit_browser)
    pending = [r for r in pending_state['linkAuditLog'] if r['id'] not in {r['id'] for r in before['linkAuditLog']}]
    assert len(pending)==1 and pending[0]['outcome']=='PENDING' and pending[0]['url']==URL
    assert pending[0]['decidedAt'] is None and pending[0]['openAttempts']==0
    m = restart(abrupt=True)
    assert addon_state(m) == installed
    open_page(m, base+'audit.html')
    assert storage_snapshot(m) == pending_state
    wait_for(lambda: m.page('return document.querySelectorAll("#auditRows tr").length===5;'))
    assert (out/'os-handoff.json').read_text() == receipt
    m.screenshot(out/'audit-after-pending-crash.png')
    report['pendingCrashRecovery'] = {'record': pending[0], 'storagePreserved': True,
        'decisionNotInvented': True, 'extraOsDispatches': 0}
    open_page(m, base+'options.html')
    wait_for(lambda: m.page('return {theme:document.documentElement.dataset.theme,accent:document.documentElement.dataset.accent,density:document.documentElement.dataset.density};') == {'theme':'dark','accent':'violet','density':'compact'})
    assert m.page('return window.wrappedJSObject.browser.i18n.getUILanguage();').split('-')[0] == args.locale
    open_test_link_dialog(m)
    with zipfile.ZipFile(args.xpi) as package:
        catalog = json.loads(package.read('_locales/'+args.locale+'/messages.json'))
    title = m.page('return document.getElementById("thundy-link-dialog").shadowRoot.querySelector("h2").textContent;')
    assert title == catalog['linkDialogTitle']['message']
    m.page('document.getElementById("thundy-link-dialog").shadowRoot.querySelector("footer button").click();')
    open_page(m, base+'audit.html')
    final = wait_for(lambda: m.page('return window.wrappedJSObject.browser.storage.local.get("linkAuditLog").then(s=>s.linkAuditLog?.length===6 && s.linkAuditLog.every(r=>r.outcome!=="PENDING" || r.decidedAt===null)?s.linkAuditLog:null);'))
    added = [r for r in final if r['id'] not in {r['id'] for r in pending_state['linkAuditLog']}]
    assert len(added)==1 and added[0]['outcome']=='ABORTED' and added[0]['url']==URL
    assert added[0]['extensionVersion']==installed['version'] and added[0]['scoreAtDecision']==0
    assert all(r in final for r in pending_state['linkAuditLog'])
    assert (out/'os-handoff.json').read_text() == receipt
    assert m.js('return !window.gTabmail.tabInfo.some(t=>t.browser?.currentURI.spec.endsWith("/onboarding.html"));')
    wait_for(lambda: m.page('return document.querySelectorAll("#auditRows tr").length===6;'))
    m.screenshot(out/'audit-after-crash-new-decision.png')
    report['newRecordAfterCrash'] = added[0]
    report['finalAuditRecords'] = final
    assert report.get('forcedRestarts') == 2


def check_administration(m, base, out, report):
    """Real UI and background authorization; no provider traffic or mocked extension APIs."""
    open_page(m,base+'options.html')
    wait_for(lambda:m.page('return !!document.getElementById("securitySettingsForm");'))
    m.page('''const set=(key,value)=>{const el=document.querySelector('[data-security="'+key+'"]');if(el.type==='checkbox')el.checked=value;else el.value=value;};
        set('securityAdminPassword','native-admin-password');set('securityAdminConfirm','native-admin-password');set('securityApprovalPassword','native-approval-password');set('securityApprovalConfirm','native-approval-password');
        set('securityEnablePolicy',true);set('securityThreshold',0);document.getElementById('securitySettingsForm').requestSubmit();''')
    wait_for(lambda:m.page('return document.querySelector(".settings-shell").hidden && document.getElementById("securityRecoveryOutput").textContent.length>65;'))
    rejected=m.page('''return window.wrappedJSObject.browser.runtime.sendMessage({action:'securitySettingsWrite',values:{privacyTier:'max'}});''')
    assert rejected['success'] is False and rejected['code']=='ADMIN_LOCKED',rejected
    display_rejected=m.page('return window.wrappedJSObject.browser.runtime.sendMessage({action:"securitySettingsWrite",values:{analysisDefaultView:"expert"}});')
    assert display_rejected['success'] is False and display_rejected['code']=='ADMIN_LOCKED',display_rejected
    state=m.page('''return window.wrappedJSObject.browser.storage.local.get('thundySecurityV1').then(s=>({adminIterations:s.thundySecurityV1.admin.iterations,approvalIterations:s.thundySecurityV1.approval.iterations,separateSalts:s.thundySecurityV1.admin.salt!==s.thundySecurityV1.approval.salt,threshold:s.thundySecurityV1.policy.threshold}));''')
    assert state=={'adminIterations':600000,'approvalIterations':600000,'separateSalts':True,'threshold':0}
    m.page('''document.querySelector('[data-security="securityAdminPassword"]').value='native-admin-password';document.querySelector('[data-security="unlock"]').click();''')
    wait_for(lambda:m.page('return !document.querySelector(".settings-shell").hidden;'))
    m.page('document.getElementById("analysisDefaultView").value="expert";document.getElementById("analysisShowHybridDetails").checked=false;document.getElementById("analysisDisplayForm").requestSubmit();')
    wait_for(lambda:m.page('return window.wrappedJSObject.browser.storage.local.get(["analysisDefaultView","analysisShowHybridDetails"]).then(s=>s.analysisDefaultView==="expert"&&s.analysisShowHybridDetails===false);'))
    m.page('document.getElementById("analysisShowHybridDetails").checked=true;document.getElementById("analysisDisplayForm").requestSubmit();')
    wait_for(lambda:m.page('return window.wrappedJSObject.browser.storage.local.get("analysisShowHybridDetails").then(s=>s.analysisShowHybridDetails===true);'))
    m.page('document.querySelector("[data-security=lock]").click();')
    wait_for(lambda:m.page('return document.querySelector(".settings-shell").hidden;'))
    m.screenshot(out/'settings-protected.png')
    message_tab=m.js('return window.gTabmail.tabInfo.findIndex(tab=>tab.mode.name==="mailMessageTab");')
    assert message_tab>=0
    m.js('window.gTabmail.switchToTab(arguments[0]);',[message_tab])
    wait_for(lambda:m.page('return !!document.getElementById("thundy-analysis-status");'))
    m.page('document.querySelector("a[href]").click();')
    wait_for(lambda:m.page('return !!document.getElementById("thundy-link-dialog")?.shadowRoot.querySelector(".primary");'))
    m.page('document.getElementById("thundy-link-dialog").shadowRoot.querySelector(".primary").click();')
    wait_for(lambda:m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.includes("/security.html?approval=");'))
    wait_for(lambda:m.page('return !!document.getElementById("destination")?.textContent;'))
    assert m.page('return document.getElementById("password").type;')=='password'
    m.screenshot(out/'link-approval.png')
    m.page('document.getElementById("confirmed").checked=true;document.getElementById("password").value="native-approval-password";document.getElementById("approvalForm").requestSubmit();')
    wait_for(lambda:m.page('return document.getElementById("approvalForm").hidden;'))
    snapshot=m.page('return window.wrappedJSObject.browser.storage.local.get("linkAuditLog");')
    approved=[r for r in snapshot['linkAuditLog'] if r.get('approvalDecision')=='granted']
    assert len(approved)==1 and approved[0]['outcome']=='OPENED' and approved[0]['openAttempts']==1,approved
    assert approved[0]['blockReason']=='threshold'
    report['administration']={'passed':True,'realThunderbirdAPIs':True,'protectedWriteRejected':True,'protectedDisplaySettings':True,'unlockAndRelock':True,'separatePasswordPage':True,'oneApprovedOpening':True,'passwordVerifiers':state,'liveProviderCalls':False}


def check_automatic_scans(m, base, out, report, display):
    # Real display events, persistence and UI; synthetic transport only.
    open_page(m,base+'options.html')
    wait_for(lambda:m.page('return !!document.getElementById("scanMode");'))
    assert m.page('return document.getElementById("scanMode").value;') == ''
    m.js('''const {ExtensionPermissions}=ChromeUtils.importESModule("resource://gre/modules/ExtensionPermissions.sys.mjs");return ExtensionPermissions.add(arguments[0],{permissions:[],origins:["https://hybrid-analysis.com/*","https://urlscan.io/*"]},WebExtensionPolicy.getByID(arguments[0]).extension);''',[ADDON_ID])
    setup=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const message=(await b.messages.query({subject:"Thundy AV synthetic live test"})).messages.find(m=>m.subject==="Thundy AV synthetic live test");
      const calls=[];window.wrappedJSObject.__automaticScanCalls=calls;
      const errors=[];window.wrappedJSObject.__automaticScanErrors=errors;bg.console.error=(...args)=>errors.push(args.map(x=>typeof x==='string'?x:x?.message||x?.name||'error').join(' '));
      bg.fetch=async(url,options={})=>{
        url=String(url);calls.push({url,method:options.method||'GET',body:typeof options.body==='string'?options.body:null});
        let data;
        if(url==='https://hybrid-analysis.com/api/v2/quick-scan/url-for-analysis')data={id:'native-hybrid-job',verdict:'clean',finished:true};
        else if(url.includes('hybrid-analysis.com/api/v2/quick-scan/'))data={id:'native-hybrid-job',verdict:'clean',finished:true};
        else if(url==='https://urlscan.io/api/v1/scan/')data={uuid:'native-urlscan-job'};
        else if(url.includes('urlscan.io/api/v1/result/'))data={verdicts:{overall:{malicious:false,score:0}},page:{url:'https://destination.example.invalid/test'}};
        else throw Error('Unexpected synthetic provider route');
        return new bg.Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
      };
      await b.storage.local.set({scanMode:'allDisplayed',alwaysManual:false,externalAnalysisConsent:true,privacyTier:'max',autoScanLinks:true,apikey:'synthetic-native-ha',urlscanApikey:'synthetic-native-urlscan'});
      await b.messageDisplay.open({messageId:message.id,location:'tab'});return {messageId:message.id};
    })();''')
    options='window.gTabmail.tabInfo.filter(tab=>tab.browser?.currentURI.spec.endsWith("/options.html")).at(-1).browser'
    def snapshot():
        return m.page('return window.wrappedJSObject.browser.runtime.sendMessage({action:"getMessageAnalysis",messageId:arguments[0]});',[setup['messageId']],browser=options)
    try:
        finished=wait_for(lambda:(r if (r:=snapshot()).get('scanJob',{}).get('state')=='completed' else None),45)
    except TimeoutError:
        report['automaticScanFailure']={'snapshot':snapshot(),'errors':m.page('return window.wrappedJSObject.__automaticScanErrors;',browser=options),'calls':m.page('return window.wrappedJSObject.__automaticScanCalls;',browser=options),'probe':m.page('return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;const tab=(await b.tabs.query({active:true,currentWindow:true}))[0];return bg.handleRequestScan({messageId:arguments[0],tabId:tab.id},{});})();',[setup['messageId']],browser=options)}
        raise
    calls=m.page('return window.wrappedJSObject.__automaticScanCalls;',browser=options)
    ha=[c for c in calls if c['method']=='POST' and 'hybrid-analysis' in c['url']]
    us=[c for c in calls if c['method']=='POST' and 'urlscan.io' in c['url']]
    assert ha and us,calls
    assert all(json.loads(c['body'])['visibility']=='unlisted' for c in us)
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector("[data-focus-key=scan-start]")?.textContent==="Check again";'))
    m.screenshot(out/'automatic-scan-message.png')
    # A second display event attaches to the current scan; it must not submit again.
    m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;await bg.handleDisplayedMessage({id:(await b.tabs.query({active:true,currentWindow:true}))[0].id},await b.messages.get(arguments[0]));return true;})();''',[setup['messageId']],browser=options)
    assert len(m.page('return window.wrappedJSObject.__automaticScanCalls;',browser=options))==len(calls)
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display,point['x'],point['y'])
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector("[data-focus-key=scan-start]")?.textContent==="Check again";',browser=popup))
    m.page('document.getElementById("thundy-analysis-status").shadowRoot.querySelector("[data-focus-key=scan-start]").click();',browser=popup)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    wait_for(lambda:(r if (r:=snapshot()).get('scanJob',{}).get('id')!=finished['scanJob']['id'] and r.get('scanJob',{}).get('state')=='completed' else None),45)
    later=m.page('return window.wrappedJSObject.__automaticScanCalls;',browser=options)
    assert len([c for c in later if c['method']=='POST' and 'urlscan.io' in c['url']])>len(us)
    report['passed']=True
    report['automaticScans']={'passed':True,'realDisplayEvents':True,'bothProvidersWithoutLinkClick':True,'popupClosedDuringRetry':True,'duplicateDisplayReused':True,'unlisted':True,'syntheticTransport':True,'liveProviderCalls':False}
    check_provider_results(m,base,out,report,display,setup['messageId'])


def check_provider_results(m, base, out, report, display, message_id):
    # All resources and provider responses are synthetic; real extension UI and persistence.
    options='window.gTabmail.tabInfo.filter(tab=>tab.browser?.currentURI.spec.endsWith("/options.html")).at(-1).browser'
    m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;
      const configured=await b.runtime.sendMessage({action:'securityCommand',op:'configure',policy:{enabled:true,threshold:100,unknown:'warn'}});if(!configured.success)throw Error('Policy setup failed');
      window.wrappedJSObject.__providerReleased=false;window.wrappedJSObject.__providerCalls=[];let hybridPolls=0;
      bg.fetch=async(url,options={})=>{
        url=String(url);window.wrappedJSObject.__providerCalls.push({url,method:options.method||'GET'});let data;
        if(url==='https://hybrid-analysis.com/api/v2/quick-scan/url-for-analysis')data={id:'provider-hybrid-job',finished:false};
        else if(url.includes('hybrid-analysis.com/api/v2/quick-scan/')){
          hybridPolls++;
          if(hybridPolls===1)data={id:'provider-hybrid-job',finished:false,verdict:'clean',scanners:[{status:'malicious',positives:2,total:35},{status:'in-progress'}]};
          else{if(!window.wrappedJSObject.__providerReleased)await new Promise(resolve=>window.wrappedJSObject.__releaseProvider=resolve);data={id:'provider-hybrid-job',finished:true,verdict:'unknown',type:'Synthetic HTML',scanners_v2:{Fixture:{status:'unknown'}},mitre_attcks:[{attck_id:'T1059',tactic:'execution'}],signatures:[{name:'Synthetic expert signature',threat_level:2}],total_processes:0};}
        }else if(url==='https://urlscan.io/api/v1/scan/')data={uuid:'provider-urlscan-job'};
        else if(url.includes('urlscan.io/api/v1/result/'))data={task:{uuid:'provider-urlscan-job'},verdicts:{overall:{malicious:false,score:65},urlscan:{malicious:false,brands:['Example']}}};
        else throw Error('Unexpected synthetic provider route');
        return new bg.Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
      };return true;
    })();''',browser=options)
    def snapshot():
        return m.page('return window.wrappedJSObject.browser.runtime.sendMessage({action:"getMessageAnalysis",messageId:arguments[0]});',[message_id],browser=options)
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.querySelector("[data-focus-key=scan-start]")?.disabled===false;'))
    m.page('document.getElementById("thundy-analysis-status").shadowRoot.querySelector("[data-focus-key=scan-start]").click();')
    def partial():
        state=snapshot()
        return state if any(r.get('provider')=='hybridanalysis' and r.get('completion')=='pending' and r.get('verdict')=='malicious' for r in state.get('rows',[])) and any(r.get('provider')=='urlscan' and r.get('verdict')=='suspicious' for r in state.get('rows',[])) else None
    try:
        observed=wait_for(partial,20)
    except TimeoutError:
        report['providerFailure']={'snapshot':snapshot(),'calls':m.page('return window.wrappedJSObject.__providerCalls;',browser=options),'errors':m.page('return window.wrappedJSObject.__automaticScanErrors;',browser=options)}
        raise
    assert observed['protection']['required'] and observed['protection']['reason']=='malicious',observed
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status").shadowRoot.textContent.includes("Dangerous content reported");'))
    expert_view(m)
    m.page('const root=document.getElementById("thundy-analysis-status").shadowRoot;Array.from(root.querySelectorAll("details")).find(d=>d.dataset.key?.startsWith("hybridanalysis:report:" )).open=true;')
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status").shadowRoot.textContent.includes("Different partial assessments");'))
    m.screenshot(out/'provider-partial-malicious.png')
    m.page('window.wrappedJSObject.__providerReleased=true;window.wrappedJSObject.__releaseProvider?.();',browser=options)
    final=wait_for(lambda:(s if (s:=snapshot()).get('scanJob',{}).get('state')=='completed' else None),20)
    assert any(r['provider']=='hybridanalysis' and r['verdict']=='malicious' and r.get('completion')=='complete' for r in final['rows']),final
    record=m.page('return window.wrappedJSObject.browser.runtime.sendMessage({action:"getMessageAnalysisRecord",messageId:arguments[0]});',[message_id],browser=options)['record']
    assert any(l.get('report',{}).get('verdict')=='unknown' and l.get('assessment',{}).get('verdict')=='malicious' for l in record['links']),record
    assert all(l.get('urlscan',{}).get('status')=='SUSPICIOUS' for l in record['links'])
    before=m.page('return window.wrappedJSObject.__providerCalls.filter(c=>c.method==="POST").length;',browser=options)
    accepted=m.page('''return (async()=>{const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page;return bg.handleRequestScan({messageId:arguments[0],tabId:(await b.tabs.query({active:true,currentWindow:true}))[0].id,operation:'refresh'},{});})();''',[message_id],browser=options)
    assert accepted['success'] and accepted.get('id')!=final['scanJob']['id'],accepted
    refreshed=wait_for(lambda:(s if (s:=snapshot()).get('scanJob',{}).get('state')=='completed' else None),20)
    assert m.page('return window.wrappedJSObject.__providerCalls.filter(c=>c.method==="POST").length;',browser=options)==before
    assert any(r['provider']=='hybridanalysis' and r['verdict']=='malicious' for r in refreshed['rows']),refreshed
    def expert_details(browser='window.gTabmail.currentTabInfo.browser'):
        m.page('const root=document.getElementById("thundy-analysis-status").shadowRoot;const panel=root.querySelector(".hybrid-expert");if(!panel)throw Error("Missing Hybrid expert panel");panel.open=true;for(const group of panel.querySelectorAll("details"))group.open=true;',browser=browser)
        wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status").shadowRoot.querySelector(".hybrid-expert").textContent.includes("T1059");',browser=browser))
        result=m.page('const panel=document.getElementById("thundy-analysis-status").shadowRoot.querySelector(".hybrid-expert");return {text:panel.textContent,activeContent:panel.querySelectorAll("script,img,a").length};',browser=browser)
        assert 'Synthetic expert signature' in result['text'] and 'total_processes' in result['text'] and result['activeContent']==0,result
        m.page('document.getElementById("thundy-analysis-status").shadowRoot.querySelector(".hybrid-expert details[data-key$=mitre]").scrollIntoView({block:"center"});',browser=browser)
        def visible_details():
            return m.page('const node=document.getElementById("thundy-analysis-status").shadowRoot.querySelector(".hybrid-expert details[data-key$=mitre]");node.scrollIntoView({block:"center"});const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;',browser=browser)
        wait_for(visible_details)
    expert_details()
    m.screenshot(out/'hybrid-expert-inline.png')
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display,point['x'],point['y'])
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    popup='document.querySelector(\'browser[webextension-view-type="popup"]\')'
    wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status")?.shadowRoot.textContent.includes("Dangerous content reported");',browser=popup))
    expert_view(m,popup)
    wait_for(lambda:m.page('return !!document.querySelector("#hybrid_analysis_api_content .card-danger");',browser=popup))
    expert_details(popup)
    subprocess.run(['import','-window','root',str(out/'provider-results-popup.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    quota=m.page('''return (async()=>{
      const b=window.wrappedJSObject.browser,page=await b.runtime.getBackgroundPage(),bg=page.wrappedJSObject||page,original=bg.fetch;let submissions=0;
      bg.fetch=async(url,options={})=>{
        if(String(url)==='https://urlscan.io/api/v1/scan/'&&options.method==='POST'){submissions++;return new bg.Response('{}',{status:429,headers:{'Content-Type':'application/json','X-Rate-Limit-Action':'unlisted','X-Rate-Limit-Scope':'user','X-Rate-Limit-Window':'day','X-Rate-Limit-Remaining':'0','X-Rate-Limit-Reset-After':'7200'}});}
        return original(url,options);
      };
      try{
        const key='native-urlscan-synthetic',first=await bg.checkUrlscanIo('https://synthetic-quota.example.invalid/',key),result=await bg.pollUrlscanIoResult('provider-urlscan-job',key),again=await bg.checkUrlscanIo('https://synthetic-quota.example.invalid/',key);
        return {first:first.errorCode,result:result.status,again:again.errorCode,submissions,wait:first.retryAfter};
      }finally{bg.fetch=original;}
    })();''',browser=options)
    assert quota['first']=='rate_limited' and quota['again']=='rate_limited' and quota['result']=='SUSPICIOUS' and quota['submissions']==1 and quota['wait']>=7195,quota
    previous_scan=snapshot()['scanJob']['id']
    m.page('document.getElementById("thundy-analysis-status").shadowRoot.querySelector("[data-focus-key=scan-start]").click();')
    limited=wait_for(lambda:(s if (s:=snapshot()).get('scanJob',{}).get('id')!=previous_scan and any(r.get('provider')=='urlscan' and r.get('localBackoff') is True and r.get('quotaRemaining')==0 for r in s.get('rows',[])) else None),20)
    assert any(r.get('retryAt',0)>0 and r.get('quotaAction')=='submit-unlisted' for r in limited['rows']),limited
    def quota_details(browser='window.gTabmail.currentTabInfo.browser'):
        expert_view(m,browser)
        wait_for(lambda:m.page('return document.getElementById("thundy-analysis-status").shadowRoot.textContent.includes("This attempt was deferred locally; no new provider request was sent.");',browser=browser))
        assert m.page('return document.getElementById("thundy-analysis-status").shadowRoot.textContent.includes("quotaRemaining: 0");',browser=browser)
        wait_for(lambda:m.page('const node=Array.from(document.getElementById("thundy-analysis-status").shadowRoot.querySelectorAll("p")).find(p=>p.textContent==="This attempt was deferred locally; no new provider request was sent.");node.scrollIntoView({block:"center"});const r=node.getBoundingClientRect();return r.height>0&&r.top>=0&&r.bottom<=innerHeight;',browser=browser))
    quota_details()
    m.screenshot(out/'urlscan-quota-inline.png')
    point=m.js('''const b=window.gTabmail.currentTabInfo.chromeBrowser,r=b.contentDocument.getElementById("thundy-av_bludau-it-services_de-messageDisplayAction-toolbarbutton").getBoundingClientRect(),p=b.getBoundingClientRect();return {x:window.mozInnerScreenX+p.x+r.x+r.width/2,y:window.mozInnerScreenY+p.y+r.y+r.height/2};''')
    native_click(display,point['x'],point['y'])
    wait_for(lambda:m.js('return document.getElementById("webextension-remote-preload-panel")?.state==="open";'))
    quota_details(popup)
    subprocess.run(['import','-window','root',str(out/'urlscan-quota-popup.png')],env={**os.environ,'DISPLAY':display},check=True,timeout=10)
    m.js('document.getElementById("webextension-remote-preload-panel").hidePopup();')
    report['providerResults']={'passed':True,'partialMaliciousBlocks':True,'terminalUnknownRetainsFinding':True,'brandDoesNotEscalate':True,'refreshWithoutSubmission':True,'bothViewsAgree':True,'hybridExpertDetails':True,'actionScopedQuota':True,'syntheticTransport':True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--thunderbird', type=Path, required=True)
    parser.add_argument('--xvfb', type=Path, required=True)
    parser.add_argument('--xpi', type=Path, required=True)
    parser.add_argument('--previous-xpi', type=Path)
    parser.add_argument('--restart-check', action='store_true',
                        help='Permanent upgrade with two graceful restarts; requires --previous-xpi')
    parser.add_argument('--real-browser', type=Path, help='Isolated real Chromium handoff to a controlled local HTTPS page, direct install only')
    parser.add_argument('--restore-check', action='store_true', help='Verify clean pre-upgrade profile backup restore; requires --restart-check')
    parser.add_argument('--automatic-scan-check', action='store_true', help='Real automatic display scans and popup retry with synthetic provider transport')
    parser.add_argument('--security-check', action='store_true', help='Real optional administration, protected writes and one-time link approval')
    parser.add_argument('--performance-check', action='store_true', help='Measure actual local message analysis through the extension API')
    parser.add_argument('--message-kib', type=int, default=0, help='Synthetic newsletter body size for direct-install performance checks (0..10240 KiB)')
    parser.add_argument('--context-load-check', action='store_true', help='Real 205-message source cache bound and owned-process PSS/RSS probe after direct install')
    parser.add_argument('--resource-isolation-check', action='store_true', help='Real duplicate-Message-ID resource inventory check after direct install')
    parser.add_argument('--identity-check', action='store_true', help='Probe numeric message IDs across a restart with reversed lookup order; requires --restart-check')
    parser.add_argument('--identity-lifecycle-check', action='store_true', help='Real content/metadata collision, copy/move/flags/compact/restart/profile-restore investigation; direct permanent install')
    parser.add_argument('--mime-content-check', action='store_true', help='Real Unicode, binary and unreadable-content investigation; direct install')
    parser.add_argument('--unicode-input-check', action='store_true', help='Compare real MIME decoding variants and product analysis input; direct install')
    parser.add_argument('--source-history-check', action='store_true', help='Real legacy source separation, content guard and persisted history across ID reuse; direct permanent install')
    parser.add_argument('--report-archive-check', action='store_true', help='Real bounded protocol revisions, popup writes, capacity refusal and restart; synthetic reports, direct permanent install')
    parser.add_argument('--source-export-check', action='store_true', help='Real popup source export, GTK download, cache clear and stale runtime rejection; direct permanent install, EN')
    parser.add_argument('--hybrid-popup-check', action='store_true', help='Real popup startup with malformed optional provider fields and message/popup result cards; direct EN')
    parser.add_argument('--hybrid-popup-baseline', action='store_true', help='Expect the released popup failure; requires --hybrid-popup-check')
    parser.add_argument('--stored-source-check', action='store_true', help='Real malformed stored metadata recovery and response-only status; direct EN install')
    parser.add_argument('--stored-source-baseline', action='store_true', help='Expect 1.24.5 source RPC failure and generic popup error')
    parser.add_argument('--report-actions-check', action='store_true', help='Real equal-hash report actions, policy refusal and local CDR download; implies --hybrid-popup-check')
    parser.add_argument('--report-actions-baseline', action='store_true', help='Expect missing callbacks and duplicate IDs in the prepared prior candidate')
    parser.add_argument('--history-pages-check', action='store_true', help='Real 1200-row history, late warnings and X11 keyboard in message and popup; direct EN install')
    parser.add_argument('--active-sources-check', action='store_true', help='Real 1200 active rows and 500-resource inventory, operation timings and disclosure behavior; direct EN')
    parser.add_argument('--active-sources-baseline', action='store_true', help='Expect the recorded eager baseline; requires --active-sources-check')
    parser.add_argument('--crash-check', action='store_true',
                        help='Also verify two SIGKILL recoveries; requires --restart-check')
    parser.add_argument('--locale', choices=['en', 'de', 'fr', 'es', 'it', 'pl'], default='en')
    parser.add_argument('--langpack', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / '.audit/thunderbird-live')
    parser.add_argument('--banner-root-shot', action='store_true',
                        help='verify the opt-in banner (2 buttons) and capture an X11 root screenshot of the message view')
    args = parser.parse_args()
    if args.stored_source_check:
        args.hybrid_popup_check=True
    if args.stored_source_baseline and not args.stored_source_check:
        parser.error("--stored-source-baseline requires --stored-source-check")
    if args.report_actions_check:
        args.hybrid_popup_check=True
    if args.report_actions_baseline and not args.report_actions_check:
        parser.error('--report-actions-baseline requires --report-actions-check')
    if not __debug__:
        parser.error("Run without Python optimization so assertions remain enabled")
    for name in ['thunderbird', 'xvfb', 'xpi']:
        setattr(args, name, getattr(args, name).resolve(strict=True))
    if args.locale != 'en' and not args.langpack:
        parser.error('Non-English runs require the corresponding Thunderbird --langpack')
    if args.real_browser and args.restart_check:
        parser.error('--real-browser is a direct-install check')
    if args.real_browser:
        args.real_browser = args.real_browser.resolve(strict=True)
    if args.restore_check and not args.restart_check:
        parser.error('--restore-check requires --restart-check')
    if not 0 <= args.message_kib <= 10240 or (args.restart_check and (args.message_kib or args.performance_check)):
        parser.error('performance payload requires a direct-install run and at most 10240 KiB')
    if args.context_load_check and args.restart_check:
        parser.error('--context-load-check requires direct installation')
    if args.resource_isolation_check and args.restart_check:
        parser.error('--resource-isolation-check requires direct installation')
    if args.identity_check and not args.restart_check:
        parser.error('--identity-check requires --restart-check')
    if args.identity_lifecycle_check and (args.restart_check or args.previous_xpi):
        parser.error('--identity-lifecycle-check requires a direct install without --previous-xpi')
    if args.mime_content_check and args.restart_check:
        parser.error('--mime-content-check requires direct installation')
    if args.unicode_input_check and args.restart_check:
        parser.error('--unicode-input-check requires direct installation')
    if args.source_history_check and (args.restart_check or args.previous_xpi):
        parser.error('--source-history-check requires direct installation without --previous-xpi')
    if args.report_archive_check and (args.restart_check or args.previous_xpi):
        parser.error('--report-archive-check requires direct installation without --previous-xpi')
    if args.source_export_check and (args.restart_check or args.previous_xpi or args.locale != 'en'):
        parser.error('--source-export-check requires direct EN installation without --previous-xpi')
    if args.hybrid_popup_check and (args.restart_check or args.previous_xpi or args.locale != 'en'):
        parser.error('--hybrid-popup-check requires direct EN installation without --previous-xpi')
    if args.hybrid_popup_baseline and not args.hybrid_popup_check:
        parser.error('--hybrid-popup-baseline requires --hybrid-popup-check')
    if args.history_pages_check and (args.restart_check or args.previous_xpi or args.locale != 'en'):
        parser.error('--history-pages-check requires direct EN installation without --previous-xpi')
    if args.active_sources_check and (args.restart_check or args.previous_xpi or args.locale != 'en'):
        parser.error('--active-sources-check requires direct EN installation without --previous-xpi')
    if args.active_sources_baseline and not args.active_sources_check:
        parser.error('--active-sources-baseline requires --active-sources-check')
    if args.crash_check and not args.restart_check:
        parser.error('--crash-check requires --restart-check')
    if args.restart_check and not args.previous_xpi:
        parser.error('--restart-check requires --previous-xpi')
    if args.previous_xpi:
        args.previous_xpi = args.previous_xpi.resolve(strict=True)
    if args.langpack:
        args.langpack = args.langpack.resolve(strict=True)
    out = args.out.resolve()
    # Fresh output prevents old reports/screenshots from being mistaken for new evidence.
    out.mkdir(parents=True, exist_ok=False, mode=0o700)
    report = {'passed': False, 'scope': 'Linux X11 GUI; synthetic plaintext; offline; no API mocks',
              'runnerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
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
            if args.real_browser:
                # Controlled localhost HTTPS only; no external website or personal profile.
                cert, key = profile / 'localhost.crt', profile / 'localhost.key'
                subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
                                '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1',
                                '-keyout', str(key), '-out', str(cert)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                receipt = out / 'real-browser-page.json'
                class LocalPage(http.server.BaseHTTPRequestHandler):
                    def do_GET(self):
                        if self.path == '/thundy-browser-check':
                            receipt.write_text(json.dumps({'method': 'GET', 'path': self.path}))
                        self.send_response(200)
                        self.send_header('Content-Type', 'text/html; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(b'<!doctype html><title>Thundy controlled local browser test</title><p>Local test only</p>')
                    def log_message(self, *_args):
                        pass
                server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), LocalPage)
                tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                tls.minimum_version = ssl.TLSVersion.TLSv1_2
                tls.load_cert_chain(cert, key)
                server.socket = tls.wrap_socket(server.socket, server_side=True)
                threading.Thread(target=server.serve_forever, daemon=True).start()
                cleanup.callback(server.server_close)
                cleanup.callback(server.shutdown)
                global URL
                URL = 'https://127.0.0.1:' + str(server.server_port) + '/thundy-browser-check'
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
            if args.real_browser:
                browser_profile = profile / 'real-browser-profile'
                pid_file = out / 'real-browser-pid.json'
                with receiver.open('a') as script:
                    command = [str(args.real_browser), '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                               '--disable-background-networking', '--disable-component-update', '--disable-sync',
                               '--disable-domain-reliability', '--disable-features=MediaRouter', '--allow-insecure-localhost',
                               '--user-data-dir=' + str(browser_profile)]
                    script.write('import subprocess\ncommand=' + repr(command) + '\np=subprocess.Popen(command+sys.argv[1:],start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\nPath(' + repr(str(pid_file)) + ').write_text(json.dumps({"pid":p.pid}))\n')
                def stop_real_browser():
                    if not pid_file.exists():
                        return
                    pid = json.loads(pid_file.read_text())['pid']
                    try:
                        command = Path('/proc/' + str(pid) + '/cmdline').read_bytes()
                        if not command:
                            return  # The isolated browser already exited (zombie/reaped).
                        if str(browser_profile).encode() not in command or os.getpgid(pid) != pid:
                            raise RuntimeError('Refusing to stop an unrelated browser process')
                        os.killpg(pid, signal.SIGTERM)
                    except (ProcessLookupError, FileNotFoundError):
                        pass
                cleanup.callback(stop_real_browser)
            # Desktop Entry Exec arguments use double quotes and escaped special characters.
            def desktop_quote(value):
                return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$') + '"'
            (applications / 'thundy-test.desktop').write_text(
                '[Desktop Entry]\nType=Application\nName=Thundy integration receiver\n'
                'NoDisplay=true\nTerminal=false\nExec=' + desktop_quote(sys.executable) + ' ' +
                desktop_quote(receiver) + ' %u\nMimeType=x-scheme-handler/http;x-scheme-handler/https;\n')
            (config_home / 'mimeapps.list').write_text('[Default Applications]\n'
                'x-scheme-handler/http=thundy-test.desktop\nx-scheme-handler/https=thundy-test.desktop\n')
            def start_client():
                nonlocal tb
                tb = subprocess.Popen([str(args.thunderbird), '--no-remote', '--profile', str(profile),
                                       '--marionette', '--remote-allow-system-access', '-offline'],
                                      start_new_session=True,
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
                return wait_for(connect, 30)

            m = start_client()
            def restart_client(abrupt=False, backup_to=None, restore_from=None):
                nonlocal m
                previous_pid = tb.pid
                if abrupt:
                    # This group belongs exclusively to this runner's Thunderbird launch.
                    assert os.getpgid(tb.pid) == tb.pid
                    os.killpg(tb.pid, signal.SIGKILL)
                    m.socket.close()
                    if tb.wait(timeout=15) != -signal.SIGKILL:
                        raise RuntimeError('Expected an actual SIGKILL exit')
                    report['forcedRestarts'] = report.get('forcedRestarts', 0) + 1
                else:
                    # eAttemptQuit allows Thunderbird to flush storage and session state.
                    try:
                        m.js('Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit); return true;')
                    except (OSError, RuntimeError):
                        pass  # A clean shutdown may close Marionette before its reply.
                    m.socket.close()
                    if tb.wait(timeout=30) != 0:
                        raise RuntimeError('Thunderbird did not exit cleanly')
                    report['gracefulRestarts'] = report.get('gracefulRestarts', 0) + 1
                if backup_to:
                    shutil.copytree(profile, backup_to, symlinks=True, ignore=shutil.ignore_patterns('lock', '.parentlock', 'parent.lock'))
                if restore_from:
                    if not restore_from.is_dir():
                        raise RuntimeError('No clean rollback snapshot')
                    shutil.rmtree(profile)
                    shutil.copytree(restore_from, profile, symlinks=True)
                m = start_client()
                assert tb.pid != previous_pid
                m.command('WebDriver:NewSession', {'capabilities': {'alwaysMatch': {'acceptInsecureCerts': False}}})
                m.command('Marionette:SetContext', {'value': 'chrome'})
                assert m.js('return Services.io.offline;')
                return m

            try:
                if args.restart_check:
                    check_restart_upgrade(m, args, out, display, report, restart_client)
                else:
                    run_checks(m, args.xpi, out, display, report, args.locale, args.langpack, args.previous_xpi, permanent=args.identity_lifecycle_check or args.source_history_check or args.report_archive_check or args.source_export_check or args.hybrid_popup_check, audit_only=args.automatic_scan_check, banner_root_shot=args.banner_root_shot, message_kib=args.message_kib)
                    if args.automatic_scan_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        check_automatic_scans(m,base,out,report,display)
                    if args.security_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        check_administration(m,base,out,report)
                    if args.resource_isolation_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        check_resource_isolation(m,base,out,report)
                    if args.context_load_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        check_context_capacity(m,base,out,report)


                    if args.real_browser:
                        wait_for(lambda: (out / 'real-browser-page.json').exists(), 30)
                        report['realBrowserHandoff'] = {'browser': str(args.real_browser), 'browserStarted': True,
                                                      'controlledLocalPageRequested': True,
                                                      'scope': 'real isolated Chromium process; localhost HTTPS fixture, not an external website'}
                    if args.performance_check:
                        report['performance'] = m.page('''return (async()=>{
                            const samples=[]; let score=null;
                            for(let i=0;i<6;i++){
                                const start=performance.now();
                                const result=await window.wrappedJSObject.browser.runtime.sendMessage({action:"getLocalRisk",messageId:arguments[0]});
                                if(result.status!=="success")throw new Error("Local assessment failed");
                                samples.push(performance.now()-start);score=result.threat.score;
                            }return {scope:"real Thunderbird local analysis plus API roundtrip; no memory claim",coldMs:samples[0],warmMs:samples.slice(1),score};
                        })();''', [report['auditRecord']['messageId']])
                        bench = m.page('''return window.wrappedJSObject.browser.storage.local.set({linkAuditLog:Array.from({length:2000},(_,index)=>({id:crypto.randomUUID(),clickedAt:Date.now()-index,decidedAt:null,messageId:arguments[0],url:'https://benchmark.example.invalid/'+index,score:null,scoreAtDecision:null,verdict:'UNKNOWN',outcome:'PENDING',openAttempts:0,extensionVersion:window.wrappedJSObject.browser.runtime.getManifest().version,syntheticBenchmark:true}))}).then(()=>true);''', [report['auditRecord']['messageId']])
                        assert bench
                        base = m.page('return window.wrappedJSObject.browser.runtime.getURL("");')
                        started = time.monotonic()
                        open_page(m, base + 'audit.html')
                        wait_for(lambda: m.page('return document.querySelectorAll("#auditRows tr").length===50;'))
                        report['auditBenchmark'] = {'synthetic': True, 'inserted': 2000, 'visibleRows': 50,
                                                    'loadAndAutomationMs': round((time.monotonic()-started)*1000),
                                                    'scope': 'real Thunderbird render of synthetic storage fixtures; includes automation/navigation overhead'}

                    if args.identity_lifecycle_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        m=check_identity_lifecycle(m,base,out,report,restart_client)
                    if args.mime_content_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        check_mime_content(m,base,out,report,display)
                    if args.unicode_input_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        check_unicode_input(m,base,out,report)
                    if args.source_history_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        m=check_source_history(m,base,out,report,restart_client,display)
                    if args.report_archive_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        m=check_report_archive(m,base,out,report,restart_client,display)
                    if args.source_export_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        m=check_source_export(m,base,out,report,restart_client,display)
                    if args.history_pages_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        check_history_pages(m,base,out,report,display)
                    if args.active_sources_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        check_active_sources(m,base,out,report,display,args.active_sources_baseline)
                    if args.hybrid_popup_check:
                        base=m.js('const tab=window.gTabmail.tabInfo.find(tab=>tab.browser?.currentURI.spec.startsWith("moz-extension:"));return tab.browser.currentURI.prePath+"/";')
                        check_hybrid_popup(m,base,out,report,display,args.hybrid_popup_baseline,args.report_actions_check,args.report_actions_baseline)
                        if args.stored_source_check:
                            check_stored_sources(m,base,out,report,display,args.stored_source_baseline)

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
        report['passed'] = False
        report['error'] = str(error)
        raise
    finally:
        stop(tb)
        stop(xvfb)
        report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'passed': report['passed'], 'report': str(out / 'report.json'),
                          'gracefulRestarts': report.get('gracefulRestarts', 0),
                          'forcedRestarts': report.get('forcedRestarts', 0)}))


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
