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
      const externalAnalysisConsentCheckbox = document.getElementById('externalAnalysisConsent');
      const urlhausApikeyInput = document.getElementById('urlhausApikey');
      const urlscanApikeyInput = document.getElementById('urlscanApikey');

      // Auto-Scan und Time-of-Click-Schutz sind zwei unabhängige Optionen:
      //  - Auto-Scan prüft Links schon beim Öffnen der Nachricht. Lokal geschieht das
      //    immer; extern (URL-/Domain-Übermittlung) nur zusätzlich, wenn „Externe
      //    Analyse erlauben“ aktiv ist, ein Anbieter-Schlüssel (urlscan.io oder
      //    URLhaus) hinterlegt ist und die Host-Berechtigung erteilt wurde.
      //  - Time-of-Click markiert Links und prüft sie lokal beim Klick – ohne
      //    Datenübertragung.
      // Deshalb wird keine der beiden Optionen deaktiviert. Das Kontrollkästchen
      // Auto-Scan erhält lediglich einen erklärenden Hinweis, solange die
      // Voraussetzungen für die zusätzliche externe Prüfung fehlen.
      function updateAutoScanPrerequisites() {
          const hasProviderKey = urlscanApikeyInput.value.trim().length > 0 ||
              urlhausApikeyInput.value.trim().length > 0;
          const externalCheckPossible = externalAnalysisConsentCheckbox.checked && hasProviderKey;

          if (autoScanLinksCheckbox.checked && !externalCheckPossible) {
              autoScanLinksCheckbox.title = 'Links werden beim Öffnen lokal geprüft. Für eine zusätzliche externe Prüfung zusätzlich „Externe Analyse erlauben“ aktivieren, einen Schlüssel für urlscan.io oder URLhaus hinterlegen und die Host-Berechtigung erteilen.';
          } else {
              autoScanLinksCheckbox.title = '';
          }
      }

      // Initiale Setzung
      updatePrivacyTierStatus();
      updateAutoScanPrerequisites();

      // Event Listener für Änderungen
      alwaysManualCheckbox.addEventListener('change', updatePrivacyTierStatus);
      autoScanLinksCheckbox.addEventListener('change', updateAutoScanPrerequisites);
      externalAnalysisConsentCheckbox.addEventListener('change', updateAutoScanPrerequisites);
      urlhausApikeyInput.addEventListener('input', updateAutoScanPrerequisites);
      urlscanApikeyInput.addEventListener('input', updateAutoScanPrerequisites);
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

        // Optionale Datenfreigabe (data_collection) im selben Nutzer-Klick wie das
        // Speichern anfragen bzw. bei deaktivierter Zustimmung wieder zurückgeben.
        // Feature-Erkennung: ältere Thunderbird-Versionen kennen
        // permissions.getAll().data_collection (und request/remove dafür) nicht –
        // dann erfolgt kein Aufruf und es entsteht kein Fehler.
        let dataCollectionDenied = false;
        try {
            const canQueryPermissions = browser.permissions &&
                typeof browser.permissions.getAll === 'function';
            const perms = canQueryPermissions
                ? await browser.permissions.getAll().catch(() => ({}))
                : {};
            const hasDataCollectionApi = perms && Array.isArray(perms.data_collection);

            if (hasDataCollectionApi) {
                if (externalAnalysisConsentSetting) {
                    if (typeof browser.permissions.request === 'function') {
                        const granted = await browser.permissions
                            .request({ data_collection: ['personalCommunications'] })
                            .catch(() => false);
                        dataCollectionDenied = !granted;
                    }
                } else if (typeof browser.permissions.remove === 'function') {
                    await browser.permissions
                        .remove({ data_collection: ['personalCommunications'] })
                        .catch(() => {});
                }
            }
        } catch (e) {
            console.error('Optionale Datenfreigabe konnte nicht angepasst werden', e);
        }

        // Kein alert()-Spam: eine Ablehnung wird ausschließlich über den
        // bestehenden Status-Hinweis (aria-live) mitgeteilt.
        if (dataCollectionDenied) {
            statusSpan.textContent = 'Gespeichert – optionale Datenfreigabe wurde nicht erteilt. Ohne diese Freigabe findet keine externe Analyse statt.';
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