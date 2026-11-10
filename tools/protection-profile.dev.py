"""Native protection-profile UI import/export; isolated synthetic test profile."""
import hashlib
import json
from pathlib import Path
import time

KEYS = ['privacyTier', 'alwaysManual', 'timeOfClickProtection', 'scanMode', 'autoScanLinks']


def check(m, base, out, report, display, catalog, native_download):
    def wait(operation):
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            value = operation()
            if value:
                return value
            time.sleep(.1)
        raise TimeoutError('Protection profile UI condition timed out')

    selected = m.js('return window.gTabmail.tabInfo.indexOf(window.gTabmail.currentTabInfo);')
    m.js('window.gTabmail.openTab("contentTab",{url:arguments[0]});', [base+'options.html'])
    wait(lambda: m.js('return window.gTabmail.currentTabInfo.browser?.currentURI.spec.endsWith("/options.html");'))
    wait(lambda: m.page('return !!document.getElementById("localProtectionProfileExport");'))
    original = m.page('return window.wrappedJSObject.browser.storage.local.get(null);')
    permissions = m.page('return window.wrappedJSObject.browser.permissions.getAll();')
    report['protectionProfile'] = {'passed': False, 'helperSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    m.page('''return (async()=>{const w=window.wrappedJSObject,b=w.browser,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;w.__protectionProbe={originalFetch:bg.fetch,calls:0};bg.fetch=async()=>{w.__protectionProbe.calls++;throw Error('Unexpected transport during profile UI test');};})();''')
    try:
        before_export = m.page('return window.wrappedJSObject.browser.storage.local.get(null);')
        exported = native_download(m, display, out, 'localProtectionProfileExport', 'protection-profile-before')
        assert exported['schemaVersion'] == 2 and exported['kind'] == 'thundy-local-protection'
        assert set(exported) == {'schemaVersion','kind','protection'} and set(exported['protection']) == set(KEYS)
        assert m.page('return window.wrappedJSObject.browser.storage.local.get(null);') == before_export
        profile = {'schemaVersion':2,'kind':'thundy-local-protection','protection':{'privacyTier':'strict','alwaysManual':True,'timeOfClickProtection':True,'scanMode':'manual','autoScanLinks':False}}

        def preview(value):
            m.page('''const input=document.getElementById('localProfileInput');input.value=arguments[0];input.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('localProfilePreview').click();''', [json.dumps(value)])
            wait(lambda: m.page('return !document.getElementById("localProfileApply").disabled;'))

        preview(profile)
        assert m.page('return window.wrappedJSObject.browser.storage.local.get(null);') == original
        diff = m.page('return document.getElementById("localProfileDiff").textContent;')
        assert catalog['localProfileYes']['message'] in diff
        m.page('document.getElementById("localProfileDiscard").click();')
        assert m.page('return window.wrappedJSObject.browser.storage.local.get(null);') == original
        assert m.page('return document.getElementById("localProfileApply").disabled;')
        preview(profile)
        m.page('document.getElementById("localProfileApply").click();')
        wait(lambda: m.page('return document.getElementById("localProfileDiff").hidden && !document.getElementById("localProtectionProfileExport").disabled;'))
        committed = m.page('return window.wrappedJSObject.browser.storage.local.get(null);')
        assert all(committed.get(key) == value for key,value in profile['protection'].items())
        assert all(committed.get(key) == value for key,value in original.items() if key not in KEYS)
        assert native_download(m, display, out, 'localProtectionProfileExport', 'protection-profile-after') == profile
        # v1 remains an accepted import; it cannot turn on the v2 send scope.
        old = {'schemaVersion':1,'kind':'thundy-local-protection','protection':{'privacyTier':'strict','alwaysManual':True,'timeOfClickProtection':True}}
        preview(old)
        assert catalog['localProtectionLegacyHelp']['message'] in m.page('return document.getElementById("localProfileDiff").textContent;')
        m.page('document.getElementById("localProfileApply").click();')
        wait(lambda: m.page('return document.getElementById("localProfileDiff").hidden;'))
        after_v1 = m.page('return window.wrappedJSObject.browser.storage.local.get(null);')
        assert after_v1['scanMode'] == 'manual' and after_v1['autoScanLinks'] is False
        assert after_v1.get('linkAuditLog') == original.get('linkAuditLog')
        assert m.page('return window.wrappedJSObject.browser.permissions.getAll();') == permissions
        assert m.page('return window.wrappedJSObject.__protectionProbe.calls;') == 0
        report['protectionProfile'].update(passed=True,realThunderbirdAPIs=True,realDownloadsAPI=True,nativeFilePicker=True,
            exportedSavedPolicy=True,explicitUiImport=True,previewReadOnly=True,cancelPreserved=True,unrelatedDataPreserved=True,
            v1Compatible=True,noConsentOrPermissionGrant=True,noProviderRequests=True,appearanceProfileCompatible=(report.get('appearanceProfile',{}).get('passed') is True or all(report.get('appearanceProfileRestart',{}).get(key) is True for key in ['passed','confirmedUiImport','storagePreserved','unrelatedDataPreserved'])),
            scope='Actual UI and downloads in an isolated synthetic profile; no live providers. Storage/validation/stale failures have separate simulated checks.')
        assert report['protectionProfile']['appearanceProfileCompatible'], 'Missing confirmed appearance profile compatibility proof'
        m.screenshot(out/'protection-profile.png')
    finally:
        # Restore effective policy through actual storage, then restore absence of
        # legacy optional fields. This does not touch unrelated keys or audit.
        m.page('''return (async()=>{const b=window.wrappedJSObject.browser,previous=arguments[0];const keys=arguments[1];const mode=['allDisplayed','approvedSenders','manual'].includes(previous.scanMode)?previous.scanMode:previous.alwaysManual===true?'manual':'approvedSenders';await b.storage.local.set({privacyTier:previous.privacyTier||'strict',alwaysManual:mode==='manual',timeOfClickProtection:previous.timeOfClickProtection!==false,scanMode:mode,autoScanLinks:previous.autoScanLinks===true});const own=Object.fromEntries(keys.filter(k=>Object.hasOwn(previous,k)).map(k=>[k,previous[k]]));if(Object.keys(own).length)await b.storage.local.set(own);const absent=keys.filter(k=>!Object.hasOwn(previous,k));if(absent.length)await b.storage.local.remove(absent);const w=window.wrappedJSObject,raw=await b.runtime.getBackgroundPage(),bg=raw.wrappedJSObject||raw;bg.fetch=w.__protectionProbe.originalFetch;delete w.__protectionProbe;})();''', [original,KEYS])
        assert m.page('return window.wrappedJSObject.browser.storage.local.get(null);') == original
        m.js('window.gTabmail.switchToTab(arguments[0]);', [selected])
