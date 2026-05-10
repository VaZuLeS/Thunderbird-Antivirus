// Event-Listener für das Laden der Seite
document.addEventListener('DOMContentLoaded', function() {
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get(['apikey', 'urlhausApikey', 'urlscanApikey', 'alwaysManual', 'autoScanLinks', 'timeOfClickProtection']).then((result) => {
      document.getElementById('apikey').value = result.apikey || "";
      document.getElementById('urlhausApikey').value = result.urlhausApikey || "";
      document.getElementById('urlscanApikey').value = result.urlscanApikey || "";
      document.getElementById('alwaysManual').checked = result.alwaysManual || false;
      document.getElementById('autoScanLinks').checked = result.autoScanLinks || false;
      // Default für timeOfClickProtection ist true
      document.getElementById('timeOfClickProtection').checked = result.timeOfClickProtection !== undefined ? result.timeOfClickProtection : true;
    });
  });
  
  document.getElementById('save').addEventListener('click', function() {
    let mySetting = document.getElementById('apikey').value.trim().replace(/\r|\n/g, '');
    let urlhausSetting = document.getElementById('urlhausApikey').value.trim().replace(/\r|\n/g, '');
    let urlscanSetting = document.getElementById('urlscanApikey').value.trim().replace(/\r|\n/g, '');
    let alwaysManualSetting = document.getElementById('alwaysManual').checked;
    let autoScanLinksSetting = document.getElementById('autoScanLinks').checked;
    let timeOfClickProtectionSetting = document.getElementById('timeOfClickProtection').checked;
    browser.storage.local.set({
        apikey: mySetting,
        urlhausApikey: urlhausSetting,
        urlscanApikey: urlscanSetting,
        alwaysManual: alwaysManualSetting,
        autoScanLinks: autoScanLinksSetting,
        timeOfClickProtection: timeOfClickProtectionSetting
    }).then(() => {
        let statusSpan = document.getElementById('saveStatus');
        statusSpan.style.display = 'inline';
        setTimeout(() => {
            statusSpan.style.display = 'none';
        }, 3000);
    });
  });

  document.getElementById('clearCache').addEventListener('click', async function() {
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
    }

    statusSpan.style.display = 'inline';
  });