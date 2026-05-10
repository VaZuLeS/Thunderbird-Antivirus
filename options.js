// Event-Listener für das Laden der Seite
document.addEventListener('DOMContentLoaded', function() {
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get(['apikey', 'urlhausApikey', 'alwaysManual', 'ipReputationProvider', 'ipReputationApiKey']).then((result) => {
      document.getElementById('apikey').value = result.apikey || "";
      document.getElementById('urlhausApikey').value = result.urlhausApikey || "";
      document.getElementById('alwaysManual').checked = result.alwaysManual || false;
      document.getElementById('ipReputationProvider').value = result.ipReputationProvider || "none";
      document.getElementById('ipReputationApiKey').value = result.ipReputationApiKey || "";
    });
  });
  
  document.getElementById('save').addEventListener('click', function() {
    let mySetting = document.getElementById('apikey').value.trim().replace(/\r|\n/g, '');
    let urlhausSetting = document.getElementById('urlhausApikey').value.trim().replace(/\r|\n/g, '');
    let alwaysManualSetting = document.getElementById('alwaysManual').checked;
    let ipRepProvider = document.getElementById('ipReputationProvider').value;
    let ipRepApiKey = document.getElementById('ipReputationApiKey').value.trim().replace(/\r|\n/g, '');

    browser.storage.local.set({
        apikey: mySetting,
        urlhausApikey: urlhausSetting,
        alwaysManual: alwaysManualSetting,
        ipReputationProvider: ipRepProvider,
        ipReputationApiKey: ipRepApiKey
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