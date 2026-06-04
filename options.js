// Event-Listener für das Laden der Seite
document.addEventListener('DOMContentLoaded', function() {
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get([
        'apikey', 'urlhausApikey', 'urlscanApikey', 'virustotalApikey',
        'alwaysManual', 'autoScanLinks', 'timeOfClickProtection',
        'privacyTier', 'customWhitelist', 'customBlacklist',
        'ipReputationProvider', 'ipReputationApiKey'
    ]).then((result) => {
      document.getElementById('apikey').value = result.apikey || "";
      document.getElementById('urlhausApikey').value = result.urlhausApikey || "";
      document.getElementById('urlscanApikey').value = result.urlscanApikey || "";
      document.getElementById('virustotalApikey').value = result.virustotalApikey || "";
      document.getElementById('privacyTier').value = result.privacyTier || "balanced";
      document.getElementById('customWhitelist').value = (result.customWhitelist || []).join(', ');
      document.getElementById('customBlacklist').value = (result.customBlacklist || []).join(', ');
      document.getElementById('ipReputationProvider').value = result.ipReputationProvider || "none";
      document.getElementById('ipReputationApiKey').value = result.ipReputationApiKey || "";
      document.getElementById('alwaysManual').checked = result.alwaysManual || false;
      document.getElementById('autoScanLinks').checked = result.autoScanLinks || false;
      // Default für timeOfClickProtection ist true
      document.getElementById('timeOfClickProtection').checked = result.timeOfClickProtection !== undefined ? result.timeOfClickProtection : true;

      const providerSelect = document.getElementById('ipReputationProvider');
      const apiKeyInput = document.getElementById('ipReputationApiKey');

      providerSelect.value = result.ipReputationProvider || "none";
      apiKeyInput.value = result.ipReputationApiKey || "";

      function updateIpReputationApiKeyStatus() {
          if (providerSelect.value === 'none') {
              apiKeyInput.disabled = true;
              apiKeyInput.title = 'Wählen Sie zuerst einen Anbieter aus';
              apiKeyInput.placeholder = 'Deaktiviert';
              apiKeyInput.setAttribute('aria-disabled', 'true');
          } else {
              apiKeyInput.disabled = false;
              apiKeyInput.title = '';
              apiKeyInput.placeholder = '';
              apiKeyInput.removeAttribute('aria-disabled');
          }
      }

      // Initiale Setzung
      updateIpReputationApiKeyStatus();

      // Event Listener für Änderungen
      providerSelect.addEventListener('change', updateIpReputationApiKeyStatus);
    });
  });
  
  document.getElementById('save').addEventListener('click', function() {
    const saveBtn = document.getElementById('save');
    saveBtn.disabled = true;
    saveBtn.setAttribute('aria-busy', 'true');
    saveBtn.textContent = 'Wird gespeichert...';

    let mySetting = document.getElementById('apikey').value.trim().replace(/\r|\n/g, '');
    let urlhausSetting = document.getElementById('urlhausApikey').value.trim().replace(/\r|\n/g, '');
    let urlscanSetting = document.getElementById('urlscanApikey').value.trim().replace(/\r|\n/g, '');
    let virustotalSetting = document.getElementById('virustotalApikey').value.trim().replace(/\r|\n/g, '');
    let privacyTierSetting = document.getElementById('privacyTier').value;

    let whitelistStr = document.getElementById('customWhitelist').value;
    let whitelistSetting = whitelistStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

    let blacklistStr = document.getElementById('customBlacklist').value;
    let blacklistSetting = blacklistStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

    let ipReputationProviderSetting = document.getElementById('ipReputationProvider').value;
    let ipReputationApiKeySetting = document.getElementById('ipReputationApiKey').value.trim().replace(/\r|\n/g, '');

    let alwaysManualSetting = document.getElementById('alwaysManual').checked;
    let autoScanLinksSetting = document.getElementById('autoScanLinks').checked;
    let timeOfClickProtectionSetting = document.getElementById('timeOfClickProtection').checked;
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
        ipReputationProvider: ipReputationProviderSetting,
        ipReputationApiKey: ipReputationApiKeySetting
    }).then(() => {
        let statusSpan = document.getElementById('saveStatus');
        statusSpan.style.display = 'inline';
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = 'Speichern';
        setTimeout(() => {
            statusSpan.style.display = 'none';
        }, 3000);
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
    setTimeout(() => {
        statusSpan.style.display = 'none';
    }, 3000);
  });