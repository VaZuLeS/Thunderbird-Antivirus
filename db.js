class DatabaseDAO {
    constructor(dbName = "thunderbird_av", version = 4) {
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
                // Local indicator index for the researcher pivot/history features
                // (DB version 4). Keyed by "kind|value|messageHeader" so one
                // indicator can occur in many messages.
                if (!db.objectStoreNames.contains('iocs')) {
                    const store = db.createObjectStore('iocs', { keyPath: 'key' });
                    store.createIndex('value', 'value', { unique: false });
                    store.createIndex('kind', 'kind', { unique: false });
                    store.createIndex('messageHeader', 'messageHeader', { unique: false });
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
        const storePromise = new Promise((resolve, reject) => {
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
        return storePromise;
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

    /** Liest alle Einträge eines Stores (für Pivot- und Verlaufssuche). */
    getAllFromStore(db, storeName) {
        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(storeName)) {
                resolve([]);
                return;
            }
            const transaction = db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = function () {
                resolve(request.result || []);
            };

            request.onerror = function (e) {
                reject(e.target.error || new Error('Fehler beim Lesen aus Store: ' + storeName));
            };
        });
    }

    /** Löscht einen einzelnen Eintrag (z. B. einen Indikator-Treffer). */
    deleteFromStore(db, storeName, key) {
        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(storeName)) {
                resolve(false);
                return;
            }
            const transaction = db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = function () {
                resolve(true);
            };

            request.onerror = function (e) {
                reject(e.target.error || new Error('Fehler beim Löschen aus Store: ' + storeName));
            };
        });
    }

    clearStore(db, storeName) {

        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(storeName)) {
                 return resolve(false); // store doesn't exist
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

function openDB(dbName = "thunderbird_av", version = 4) {
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

function getAllFromStore(db, storeName) {
    return defaultDAO.getAllFromStore(db, storeName);
}

function deleteFromStore(db, storeName, key) {
    return defaultDAO.deleteFromStore(db, storeName, key);
}

function clearStore(db, storeName) {
    return defaultDAO.clearStore(db, storeName);
}
