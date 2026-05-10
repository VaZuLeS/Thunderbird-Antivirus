// Event-Listener für das Laden der Seite
document.addEventListener('DOMContentLoaded', function() {
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get(['apikey', 'alwaysManual']).then((result) => {
      document.getElementById('apikey').value = result.apikey || '';
      document.getElementById('alwaysManual').checked = result.alwaysManual || false;
    });
  });

  document.getElementById('save').addEventListener('click', function() {
    let mySetting = document.getElementById('apikey').value;
    let alwaysManualSetting = document.getElementById('alwaysManual').checked;
    browser.storage.local.set({
        apikey: mySetting,
        alwaysManual: alwaysManualSetting
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
    statusSpan.style.color = 'green';

    try {
        const db = await openDB('thunderbird_av', 3);
        const cleared = await clearStore(db, 'hybridanalysis');

        if (cleared) {
            statusSpan.textContent = 'Cache erfolgreich geleert.';
        } else {
            statusSpan.textContent = 'Datenbank existiert noch nicht oder ist bereits leer.';
        }
    } catch (error) {
        statusSpan.style.color = 'red';
        statusSpan.textContent = 'Fehler beim Leeren des Caches.';
        console.error(error);
    }

    statusSpan.style.display = 'inline';
  });