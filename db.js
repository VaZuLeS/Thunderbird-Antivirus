class DatabaseDAO {
    constructor(dbName = "thunderbird_av", version = 3) {
        this.dbName = dbName;
        this.version = version;
    }

    openDB(dbName = this.dbName, version = this.version) {
        return new Promise((resolve, reject) => {
            const openRequest = indexedDB.open(dbName, version);

            openRequest.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('hybridanalysis')) {
                    db.createObjectStore('hybridanalysis', { keyPath: 'messageHeader' });
                }
            };

            openRequest.onsuccess = function (e) {
                resolve(e.target.result);
            };

            openRequest.onerror = function (e) {
                console.error('Fehler beim Öffnen der Datenbank:', e);
                reject(e.target.error || new Error('Fehler beim Öffnen der Datenbank'));
            };
        });
    }

    updateStore(db, storeName, key, updateFn) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = function () {
                const record = request.result;
                const updatedRecord = updateFn(record);
                const putRequest = store.put(updatedRecord);

                putRequest.onsuccess = function() {
                    resolve(putRequest.result);
                };

                putRequest.onerror = function(e) {
                    reject(e.target.error || new Error('Fehler beim Aktualisieren im Store: ' + storeName));
                }
            };

            request.onerror = function (e) {
                reject(e.target.error || new Error('Fehler beim Abrufen aus Store für Update: ' + storeName));
            };
        });
    }

    getFromStore(db, storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = function () {
                resolve(request.result);
            };

            request.onerror = function (e) {
                reject(e.target.error || new Error('Fehler beim Abrufen aus Store: ' + storeName));
            };
        });
    }

    putToStore(db, storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.put(item);

            request.onsuccess = function () {
                resolve(request.result);
            };

            request.onerror = function (e) {
                reject(e.target.error || new Error('Fehler beim Speichern in Store: ' + storeName));
            };
        });
    }

    clearStore(db, storeName) {
        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(storeName)) {
                 resolve(false); // store doesn't exist
                 return;
            }

            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const clearRequest = store.clear();

            clearRequest.onsuccess = function () {
                resolve(true);
            };

            clearRequest.onerror = function (e) {
                reject(e.target.error || new Error('Fehler beim Leeren des Stores: ' + storeName));
            };
        });
    }
}

// Instantiate exactly what the previous functions did globally for backward compat
const defaultDAO = new DatabaseDAO();

function openDB(dbName = "thunderbird_av", version = 3) {
    if (dbName !== defaultDAO.dbName || version !== defaultDAO.version) {
        return new DatabaseDAO(dbName, version).openDB(dbName, version);
    }
    return defaultDAO.openDB(dbName, version);
}

function updateStore(db, storeName, key, updateFn) {
    return defaultDAO.updateStore(db, storeName, key, updateFn);
}

function getFromStore(db, storeName, key) {
    return defaultDAO.getFromStore(db, storeName, key);
}

function putToStore(db, storeName, item) {
    return defaultDAO.putToStore(db, storeName, item);
}

function clearStore(db, storeName) {
    return defaultDAO.clearStore(db, storeName);
}
