// Event-Listener für das Laden der Seite
document.addEventListener('DOMContentLoaded', function() {
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get('apikey').then((result) => {
      document.getElementById('apikey').value = result.apikey;
    });
  });

  document.getElementById('save').addEventListener('click', function() {
    let mySetting = document.getElementById('apikey').value;
    browser.storage.local.set({
        apikey: mySetting
    });
  });

  document.getElementById('clearCache').addEventListener('click', async function() {
    let statusSpan = document.getElementById('clearCacheStatus');
    statusSpan.style.display = 'none';
    statusSpan.textContent = '';
    statusSpan.style.color = 'green';

    try {
        const db = await new Promise((resolve, reject) => {
            const openRequest = indexedDB.open('thunderbird_av', 3);
            openRequest.onerror = () => reject(new Error('Fehler beim Öffnen der Datenbank.'));
            openRequest.onsuccess = (e) => resolve(e.target.result);
        });

        if (!db.objectStoreNames.contains('hybridanalysis')) {
            statusSpan.textContent = 'Datenbank existiert noch nicht oder ist bereits leer.';
            statusSpan.style.display = 'inline';
            return;
        }

        await new Promise((resolve, reject) => {
            const transaction = db.transaction(['hybridanalysis'], 'readwrite');
            const store = transaction.objectStore('hybridanalysis');
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(new Error('Fehler beim Leeren des Caches.'));
        });

        statusSpan.textContent = 'Cache erfolgreich geleert.';
        statusSpan.style.display = 'inline';
    } catch (error) {
        statusSpan.style.color = 'red';
        statusSpan.textContent = error.message;
        statusSpan.style.display = 'inline';
    }
  });