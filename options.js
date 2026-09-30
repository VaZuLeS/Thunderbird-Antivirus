// Event-Listener für das Laden der Seite
let _saveTimeoutId = null;
let _clearTimeoutId = null;
document.addEventListener('DOMContentLoaded', function() {
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get([
        'apikey', 'urlhausApikey', 'urlscanApikey', 'virustotalApikey',
        'alwaysManual', 'autoScanLinks', 'timeOfClickProtection',
        'privacyTier', 'customWhitelist', 'customBlacklist',
        'externalAnalysisConsent', 'ipReputationProvider', 'ipReputationApiKey'
    ]).then((result) => {
      document.getElementById('apikey').value = result.apikey || "";
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
          if (alwaysManualCheckbox.checked) {
              privacyTierSelect.disabled = true;
              privacyTierSelect.title = 'Datenschutz-Stufe ist bei manuellem Scan irrelevant';
          } else {
              privacyTierSelect.disabled = false;
              privacyTierSelect.title = '';
          }
      }

      const autoScanLinksCheckbox = document.getElementById('autoScanLinks');
      const timeOfClickProtectionCheckbox = document.getElementById('timeOfClickProtection');

      function updateTimeOfClickProtectionStatus() {
          if (autoScanLinksCheckbox.checked) {
              timeOfClickProtectionCheckbox.disabled = true;
              timeOfClickProtectionCheckbox.title = 'Time-of-Click Protection ist irrelevant, wenn Auto-Scan aktiv ist';
          } else {
              timeOfClickProtectionCheckbox.disabled = false;
              timeOfClickProtectionCheckbox.title = '';
          }
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

    const saveBtn = document.getElementById('save');
    saveBtn.disabled = true;
    saveBtn.setAttribute('aria-busy', 'true');
    saveBtn.textContent = 'Wird gespeichert...';

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
    const DATA_COLLECTION_TYPE = 'personalCommunications';

    /**
     * Synchronises the platform level data collection permission with the
     * add-on's own "Externe Analyse erlauben" switch.
     *
     * manifest.json declares personalCommunications as *optional* data
     * collection (required: ["none"]): all local checks run without any
     * transmission, so nothing is mandatory. Thunderbird does not show an
     * automatic data collection prompt ("Unlike Firefox, Thunderbird does not
     * use the built-in onboarding flow ... add-ons must request consent
     * explicitly"), therefore the opt-in is requested here - directly in
     * response to the "Speichern" click, which is a user gesture.
     *
     * The add-on's own consent flag stays authoritative: platforms without a
     * data collection permission API simply return { supported: false }.
     */
    async function syncDataCollectionConsent(enabled) {
        const permissionsApi = (typeof browser !== 'undefined' && browser.permissions) ? browser.permissions : null;
        if (!permissionsApi || typeof permissionsApi.request !== 'function') {
            return { supported: false, granted: false };
        }
        try {
            if (enabled) {
                const granted = await permissionsApi.request({ data_collection: [DATA_COLLECTION_TYPE] });
                return { supported: true, granted: granted === true };
            }
            if (typeof permissionsApi.remove === 'function') {
                await permissionsApi.remove({ data_collection: [DATA_COLLECTION_TYPE] });
            }
            return { supported: true, granted: false };
        } catch (e) {
            console.warn('Data collection permission could not be synchronised', e);
            return { supported: false, granted: false };
        }
    }

    if (externalAnalysisConsentSetting) {
        const dataCollection = await syncDataCollectionConsent(true);
        if (dataCollection.supported && !dataCollection.granted) {
            // The user declined the data transmission prompt: keep the switch off
            // so that the stored consent matches the granted permission.
            externalAnalysisConsentSetting = false;
            document.getElementById('externalAnalysisConsent').checked = false;
            alert('Die Zustimmung zur Datenübermittlung wurde nicht erteilt. „Externe Analyse erlauben“ bleibt abgeschaltet, es werden weiterhin keine Daten übertragen.');
        }
    } else {
        await syncDataCollectionConsent(false);
    }

    browser.storage.local.set({
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
        externalAnalysisConsent: externalAnalysisConsentSetting,
        ipReputationProvider: ipReputationProviderSetting,
        ipReputationApiKey: ipReputationApiKeySetting
    }).then(async () => {
        let statusSpan = document.getElementById('saveStatus');
        statusSpan.style.display = 'inline';
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = 'Speichern';

        // Host-Berechtigungen nur für die tatsächlich konfigurierten Dienste
        // anfragen (Nutzer-Geste = Klick auf "Speichern").
        const requestedOrigins = [];
        if (mySetting) requestedOrigins.push(['hybrid-analysis.com', 'https://hybrid-analysis.com/*']);
        if (virustotalSetting || ipReputationProviderSetting === 'virustotal') requestedOrigins.push(['virustotal.com', 'https://www.virustotal.com/*']);
        if (urlscanSetting) requestedOrigins.push(['urlscan.io', 'https://urlscan.io/*']);
        if (urlhausSetting) requestedOrigins.push(['urlhaus.abuse.ch', 'https://urlhaus-api.abuse.ch/*']);
        if (ipReputationProviderSetting === 'abuseipdb') requestedOrigins.push(['abuseipdb.com', 'https://api.abuseipdb.com/*']);

        if (externalAnalysisConsentSetting && requestedOrigins.length > 0) {
            const denied = [];
            for (const [label, origin] of requestedOrigins) {
                try {
                    const granted = await browser.permissions.contains({ origins: [origin] }) ||
                        await browser.permissions.request({ origins: [origin] });
                    if (!granted) denied.push(label);
                } catch (e) {
                    console.error('Permission request failed', e);
                    denied.push(label);
                }
            }
            if (denied.length > 0) {
                alert('Host‑Berechtigung nicht erteilt für: ' + denied.join(', ') +
                    '. Ohne diese Berechtigung sind die entsprechenden Prüfungen deaktiviert.');
            }
        }

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
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = 'Speichern';
    });
  });

  document.getElementById('clearCache').addEventListener('click', async function() {
    if (!confirm('Möchten Sie den Cache wirklich leeren? Dies entfernt alle lokal gespeicherten Analyse-Ergebnisse.')) {
        return;
    }
    const clearBtn = document.getElementById('clearCache');
    clearBtn.disabled = true;
    clearBtn.setAttribute('aria-busy', 'true');
    clearBtn.textContent = 'Wird geleert...';

    let statusSpan = document.getElementById('clearCacheStatus');
    statusSpan.style.display = 'none';
    statusSpan.textContent = '';
    statusSpan.className = 'text-success ml-2';

    try {
        const db = await openDB('thunderbird_av', 3);
        const cleared = await clearStore(db, 'hybridanalysis');

        if (cleared) {
            statusSpan.textContent = 'Cache erfolgreich geleert.';
        } else {
            statusSpan.textContent = 'Datenbank existiert noch nicht oder ist bereits leer.';
        }
    } catch (error) {
        statusSpan.className = 'text-danger ml-2';
        statusSpan.textContent = 'Fehler beim Leeren des Caches.';
        console.error(error);
    } finally {
        clearBtn.disabled = false;
        clearBtn.removeAttribute('aria-busy');
        clearBtn.textContent = 'Cache leeren';
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