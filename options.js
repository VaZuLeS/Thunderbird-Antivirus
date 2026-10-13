function uiText(key, fallback, params = []) {
    return typeof ThundyI18n !== 'undefined' ? ThundyI18n.get(key, params) : params.reduce((text, value, i) => text.replaceAll('$' + (i + 1), String(value)), fallback);
}

// ---------------------------------------------------------------------------
// Data collection consent
//
// manifest.json declares `data_collection_permissions: { required: ["none"],
// optional: ["personalCommunications"] }` and the Thunderbird permission
// `sensitiveDataUpload` as an optional permission. Thunderbird has no built-in
// onboarding prompt for data collection ("add-ons must request consent
// explicitly", webextension-api.thunderbird.net/en/mv3/permissions.html), so the
// consent is requested here - inside the save click handler, i.e. in a user
// gesture. Feature detection via permissions.getAll() keeps this working on
// Thunderbird builds without the built-in data collection consent.
// ---------------------------------------------------------------------------
let collectionConsentSupported = true;

const DATA_COLLECTION_REQUEST = {
    data_collection: ['personalCommunications'],
    permissions: ['sensitiveDataUpload']
};

async function dataCollectionConsentSupported() {
    try {
        const permissions = await browser.permissions.getAll();
        return !!permissions && Object.prototype.hasOwnProperty.call(permissions, 'data_collection');
    } catch (e) {
        return false;
    }
}

/**
 * Requests the data collection consent (and the Thunderbird permission for
 * uploading sensitive data). Returns true if the add-on may transmit.
 */
async function requestDataCollectionConsent(origins = []) {
    try {
        if (collectionConsentSupported) {
            return await browser.permissions.request({ ...DATA_COLLECTION_REQUEST, origins }) === true;
        }
        return await requestSensitiveDataUploadPermission(origins);
    } catch (e) {
        return false;
    }
}

async function requestSensitiveDataUploadPermission(origins = []) {
    try {
        return await browser.permissions.request({ permissions: ['sensitiveDataUpload'], origins }) === true;
    } catch (e) {
        return false;
    }
}

async function removeDataCollectionConsent() {
    try {
        await browser.permissions.remove({ data_collection: ['personalCommunications'] });
    } catch (e) { /* ignore */ }
    try {
        await browser.permissions.remove({ permissions: ['sensitiveDataUpload'] });
    } catch (e) { /* ignore */ }
}

// Event-Listener für das Laden der Seite
let _saveTimeoutId = null;
let _clearTimeoutId = null;
document.addEventListener('DOMContentLoaded', function() {
    dataCollectionConsentSupported().then(supported => { collectionConsentSupported = supported; });
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get([
        'apikey', 'urlhausApikey', 'urlscanApikey', 'virustotalApikey',
        'alwaysManual', 'autoScanLinks', 'timeOfClickProtection',
        'privacyTier', 'customWhitelist', 'customBlacklist',
        'externalAnalysisConsent', 'ipReputationProvider', 'ipReputationApiKey', 'trustedAuthServers', 'scanningEnabledSenders'
    ]).then((result) => {
      document.getElementById('apikey').value = result.apikey || "";
      const trustedInput = document.getElementById('trustedAuthServers');
      if (trustedInput) trustedInput.value = (result.trustedAuthServers || []).join(', ');
      const senderInput = document.getElementById('scanningEnabledSenders');
      if (senderInput) senderInput.value = (result.scanningEnabledSenders || []).join('\n');
      document.getElementById('urlhausApikey').value = result.urlhausApikey || "";
      document.getElementById('urlscanApikey').value = result.urlscanApikey || "";
      document.getElementById('virustotalApikey').value = result.virustotalApikey || "";
      document.getElementById('privacyTier').value = result.privacyTier || "strict";
      document.getElementById('customWhitelist').value = (result.customWhitelist || []).join(', ');
      document.getElementById('customBlacklist').value = (result.customBlacklist || []).join(', ');
      document.getElementById('alwaysManual').checked = result.alwaysManual || false;
      document.getElementById('autoScanLinks').checked = result.autoScanLinks || false;
      // Default für timeOfClickProtection ist true
      document.getElementById('timeOfClickProtection').checked = result.timeOfClickProtection !== undefined ? result.timeOfClickProtection : true;
      // Zustimmung zur externen Analyse ist standardmäßig NICHT erteilt
      document.getElementById('externalAnalysisConsent').checked = result.externalAnalysisConsent === true;
      document.getElementById('ipReputationProvider').value = result.ipReputationProvider || "none";
      document.getElementById('ipReputationApiKey').value = result.ipReputationApiKey || "";

      const alwaysManualCheckbox = document.getElementById('alwaysManual');
      const privacyTierSelect = document.getElementById('privacyTier');

      function updatePrivacyTierStatus() {
          // The privacy tier now also governs the manual actions (popup upload /
          // URL scan), so it is never irrelevant - the tier stays selectable and
          // "strict" blocks those actions explicitly (see P0-2).
          privacyTierSelect.disabled = false;
          privacyTierSelect.title = alwaysManualCheckbox.checked
              ? uiText("ui_071", "Automatische Uploads sind gesperrt (\"Immer manuell scannen\"); die Stufe gilt weiterhin für manuelle Scans.")
              : '';
      }

      const autoScanLinksCheckbox = document.getElementById('autoScanLinks');
      const timeOfClickProtectionCheckbox = document.getElementById('timeOfClickProtection');

      function updateTimeOfClickProtectionStatus() {
          timeOfClickProtectionCheckbox.disabled = false;
          timeOfClickProtectionCheckbox.title = '';
      }

      // Initiale Setzung
      updatePrivacyTierStatus();
      updateTimeOfClickProtectionStatus();

      // Event Listener für Änderungen
      alwaysManualCheckbox.addEventListener('change', updatePrivacyTierStatus);
      autoScanLinksCheckbox.addEventListener('change', updateTimeOfClickProtectionStatus);
    });
  });
  
  document.getElementById('save').addEventListener('click', async function() {
    const apikeyInput = document.getElementById('apikey');
    if (!apikeyInput.reportValidity()) {
        return;
    }

    const senderInput = document.getElementById('scanningEnabledSenders');
    const senderEntries = (senderInput?.value || '').split(/[\r\n,]+/).map(address => address.trim().toLowerCase()).filter(Boolean);
    if (senderInput) {
        senderInput.setCustomValidity(senderEntries.every(address => /^[^\s@<>]+@[^\s@<>]+$/.test(address)) ? '' : uiText('invalidSenderAddress', 'Enter plain email addresses.'));
        if (!senderInput.reportValidity()) return;
    }

    const saveBtn = document.getElementById('save');
    saveBtn.disabled = true;
    saveBtn.setAttribute('aria-busy', 'true');
    saveBtn.textContent = uiText("ui_073", "Wird gespeichert...");

    let mySetting = apikeyInput.value.trim().replace(/\r|\n/g, '');
    let urlhausSetting = document.getElementById('urlhausApikey').value.trim().replace(/\r|\n/g, '');
    let urlscanSetting = document.getElementById('urlscanApikey').value.trim().replace(/\r|\n/g, '');
    let virustotalSetting = document.getElementById('virustotalApikey').value.trim().replace(/\r|\n/g, '');
    let privacyTierSetting = document.getElementById('privacyTier').value;

    let whitelistStr = document.getElementById('customWhitelist').value;
    let whitelistSetting = [];
    for (let start = 0; start < whitelistStr.length; ) {
        let end = whitelistStr.indexOf(',', start);
        if (end === -1) end = whitelistStr.length;
        let item = whitelistStr.substring(start, end).trim().toLowerCase();
        if (item.length > 0) whitelistSetting.push(item);
        start = end + 1;
    }

    let blacklistStr = document.getElementById('customBlacklist').value;
    let blacklistSetting = [];
    for (let start = 0; start < blacklistStr.length; ) {
        let end = blacklistStr.indexOf(',', start);
        if (end === -1) end = blacklistStr.length;
        let item = blacklistStr.substring(start, end).trim().toLowerCase();
        if (item.length > 0) blacklistSetting.push(item);
        start = end + 1;
    }

    let alwaysManualSetting = document.getElementById('alwaysManual').checked;
    let autoScanLinksSetting = document.getElementById('autoScanLinks').checked;
    let timeOfClickProtectionSetting = document.getElementById('timeOfClickProtection').checked;
    let externalAnalysisConsentSetting = document.getElementById('externalAnalysisConsent').checked;
    let ipReputationProviderSetting = document.getElementById('ipReputationProvider').value;
    let ipReputationApiKeySetting = document.getElementById('ipReputationApiKey').value.trim().replace(/\r|\n/g, '');
    // Host-Berechtigungen nur für die tatsächlich konfigurierten Dienste
    // anfragen (Nutzer-Geste = Klick auf "Speichern").
    const requestedOrigins = [];
    if (mySetting) requestedOrigins.push(['hybrid-analysis.com', 'https://hybrid-analysis.com/*']);
    if (virustotalSetting || (ipReputationProviderSetting === 'virustotal' && ipReputationApiKeySetting)) requestedOrigins.push(['virustotal.com', 'https://www.virustotal.com/*']);
    if (urlscanSetting && privacyTierSetting === 'max') requestedOrigins.push(['urlscan.io', 'https://urlscan.io/*']);
    if (urlhausSetting) requestedOrigins.push(['urlhaus.abuse.ch', 'https://urlhaus-api.abuse.ch/*']);
    if (ipReputationProviderSetting === 'abuseipdb' && ipReputationApiKeySetting) requestedOrigins.push(['abuseipdb.com', 'https://api.abuseipdb.com/*']);


    const consentPromise = externalAnalysisConsentSetting ? requestDataCollectionConsent(requestedOrigins.map(([, origin]) => origin)) : Promise.resolve(false);
    browser.storage.local.set({
        scanningEnabledSenders: [...new Set(senderEntries)],
        trustedAuthServers: (document.getElementById('trustedAuthServers')?.value || '').split(',').map(host => host.trim().toLowerCase()).filter(host => /^[a-z0-9.-]+$/.test(host)),
        apikey: mySetting,
        urlhausApikey: urlhausSetting,
        urlscanApikey: urlscanSetting,
        virustotalApikey: virustotalSetting,
        privacyTier: privacyTierSetting,
        customWhitelist: whitelistSetting,
        customBlacklist: blacklistSetting,
        alwaysManual: alwaysManualSetting,
        autoScanLinks: autoScanLinksSetting,
        timeOfClickProtection: timeOfClickProtectionSetting,
        externalAnalysisConsent: false,
        ipReputationProvider: ipReputationProviderSetting,
        ipReputationApiKey: ipReputationApiKeySetting
    }).then(async () => {
        let statusSpan = document.getElementById('saveStatus');
        statusSpan.className = 'text-success ml-2';
        statusSpan.textContent = uiText("ui_073", "Wird gespeichert...");
        statusSpan.style.display = 'inline';


        // Daten-Deklaration und Konsent: das Manifest deklariert die Übermittlung
        // als optional, deshalb wird die Zustimmung hier eingeholt (Thunderbird
        // zeigt keinen eigenen Prompt). Lehnt der Nutzer den Dialog ab, wird die
        // Checkbox zurückgesetzt - ohne Zustimmung wird nichts übertragen.
        if (externalAnalysisConsentSetting) {
            const consentGranted = await consentPromise;
            if (!consentGranted) {
                externalAnalysisConsentSetting = false;
                await browser.storage.local.set({ externalAnalysisConsent: false });
                const consentBox = document.getElementById('externalAnalysisConsent');
                if (consentBox) consentBox.checked = false;
                statusSpan.textContent = uiText("ui_076", "Zustimmung zur Datenübermittlung nicht erteilt – es wird nichts übertragen.");
            }
        } else {
            await removeDataCollectionConsent();
        }

        await browser.storage.local.set({ externalAnalysisConsent: externalAnalysisConsentSetting === true });

        if (externalAnalysisConsentSetting && requestedOrigins.length > 0) {
            const denied = [];
            for (const [label, origin] of requestedOrigins) {
                try {
                    const granted = await browser.permissions.contains({ origins: [origin] });
                    if (!granted) denied.push(label);
                } catch (e) {
                    console.error('Permission request failed', e);
                    denied.push(label);
                }
            }
            if (denied.length > 0) {
                alert(uiText("ui_077", "Host‑Berechtigung nicht erteilt für: ") + denied.join(', ') +
                    uiText("ui_078", ". Ohne diese Berechtigung sind die entsprechenden Prüfungen deaktiviert."));
            }
        }

        if (externalAnalysisConsentSetting || !document.getElementById('externalAnalysisConsent').checked) {
            if (statusSpan.textContent === uiText('ui_073', 'Wird gespeichert...')) statusSpan.textContent = uiText('ui_074', 'Erfolgreich gespeichert!');
        }
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = uiText("ui_075", "Speichern");

        if (statusSpan.id === 'status') {
            if (_saveTimeoutId) clearTimeout(_saveTimeoutId);
            _saveTimeoutId = setTimeout(() => {
                if (statusSpan.style) statusSpan.style.display = 'none';
            }, 3000);
        } else {
            if (_clearTimeoutId) clearTimeout(_clearTimeoutId);
            _clearTimeoutId = setTimeout(() => {
                if (statusSpan.style) statusSpan.style.display = 'none';
            }, 3000);
        }
    }).catch(error => {
        console.error("Speichern fehlgeschlagen", error);
        let statusSpan = document.getElementById('saveStatus');
        statusSpan.className = 'text-danger ml-2';
        statusSpan.textContent = uiText("ui_079", "Fehler beim Speichern!");
        statusSpan.style.display = 'inline';
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = uiText("ui_075", "Speichern");
    });
  });

  document.getElementById('clearCache').addEventListener('click', async function() {
    if (!confirm(uiText("ui_080", "Möchten Sie den Cache wirklich leeren? Dies entfernt alle lokal gespeicherten Analyse-Ergebnisse."))) {
        return;
    }
    const clearBtn = document.getElementById('clearCache');
    clearBtn.disabled = true;
    clearBtn.setAttribute('aria-busy', 'true');
    clearBtn.textContent = uiText("ui_081", "Wird geleert...");

    let statusSpan = document.getElementById('clearCacheStatus');
    statusSpan.style.display = 'none';
    statusSpan.textContent = '';
    statusSpan.className = 'text-success ml-2';

    try {
        const db = await openDB('thunderbird_av', 3);
        const cleared = await clearStore(db, 'hybridanalysis');
        await browser.runtime.sendMessage({ action: 'clearMemoryCaches' });
        if (typeof db.close === 'function') db.close();

        if (cleared) {
            statusSpan.textContent = uiText("ui_082", "Cache erfolgreich geleert.");
        } else {
            statusSpan.textContent = uiText("ui_083", "Datenbank existiert noch nicht oder ist bereits leer.");
        }
    } catch (error) {
        statusSpan.className = 'text-danger ml-2';
        statusSpan.textContent = uiText("ui_084", "Fehler beim Leeren des Caches.");
        console.error(error);
    } finally {
        clearBtn.disabled = false;
        clearBtn.removeAttribute('aria-busy');
        clearBtn.textContent = uiText("ui_085", "Cache leeren");
    }

    statusSpan.style.display = 'inline';
    if (statusSpan.id === 'status') {
            if (_saveTimeoutId) clearTimeout(_saveTimeoutId);
            _saveTimeoutId = setTimeout(() => {
                if (statusSpan.style) statusSpan.style.display = 'none';
            }, 3000);
        } else {
            if (_clearTimeoutId) clearTimeout(_clearTimeoutId);
            _clearTimeoutId = setTimeout(() => {
                if (statusSpan.style) statusSpan.style.display = 'none';
            }, 3000);
        }
  });