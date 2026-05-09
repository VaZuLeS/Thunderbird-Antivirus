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

  document.getElementById('clearCache').addEventListener('click', function() {
    let statusSpan = document.getElementById('clearCacheStatus');
    statusSpan.style.display = 'none';
    statusSpan.textContent = '';
    statusSpan.style.color = 'green';

    let openRequest = indexedDB.open('thunderbird_av', 3);

    openRequest.onerror = function(e) {
      statusSpan.style.color = 'red';
      statusSpan.textContent = 'Fehler beim Öffnen der Datenbank.';
      statusSpan.style.display = 'inline';
    };

    openRequest.onsuccess = function(e) {
      let db = e.target.result;

      if (!db.objectStoreNames.contains('hybridanalysis')) {
        statusSpan.textContent = 'Datenbank existiert noch nicht oder ist bereits leer.';
        statusSpan.style.display = 'inline';
        return;
      }

      let transaction = db.transaction(['hybridanalysis'], 'readwrite');
      let store = transaction.objectStore('hybridanalysis');
      let clearRequest = store.clear();

      clearRequest.onsuccess = function() {
        statusSpan.textContent = 'Cache erfolgreich geleert.';
        statusSpan.style.display = 'inline';
      };

      clearRequest.onerror = function() {
        statusSpan.style.color = 'red';
        statusSpan.textContent = 'Fehler beim Leeren des Caches.';
        statusSpan.style.display = 'inline';
      };
    };
  });