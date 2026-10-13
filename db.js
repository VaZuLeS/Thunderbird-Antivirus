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

    commit(transaction, resolve, reject, result) {
        transaction.oncomplete = () => resolve(result());
        transaction.onerror = () => reject(transaction.error || new Error('Database transaction failed'));
        transaction.onabort = () => reject(transaction.error || new Error('Database transaction aborted'));
    }

    updateStore(db, storeName, key, updateFn) {
        const storePromise = new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            let result;
            this.commit(transaction, resolve, reject, () => result);

            request.onsuccess = function () {
                const record = request.result;
                let updatedRecord;
                try { updatedRecord = updateFn(record); }
                catch (error) { reject(error); transaction.abort(); return; }
                if (!updatedRecord) { reject(new Error('Cannot update a missing record')); transaction.abort(); return; }
                const putRequest = store.put(updatedRecord);

                putRequest.onsuccess = function() {
                    result = putRequest.result;
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
            this.commit(transaction, resolve, reject, () => request.result);

            request.onsuccess = function () {
                // Resolve only after transaction.oncomplete.
            };

            request.onerror = function (e) {
                reject(e.target.error || new Error('Fehler beim Speichern in Store: ' + storeName));
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
            this.commit(transaction, resolve, reject, () => true);

            clearRequest.onsuccess = function () {
                // Resolve only after transaction.oncomplete.
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

// Retain at most 1,000 message records for 30 days. Old schema records use item timestamps.
function pruneStore(db, storeName, now = Date.now()) {
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(storeName)) return resolve();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.openCursor();
        const retained = [];
        transaction.oncomplete = () => resolve();
        transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Cache cleanup failed'));
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                const record = cursor.value;
                const dates = [...(record.attachments || []), ...(record.links || [])].map(item => new Date(item.created || 0).getTime());
                const updatedAt = record.updatedAt || dates.reduce((latest, value) => Math.max(latest, value || 0), 0);
                if (updatedAt < now - 30 * 24 * 60 * 60 * 1000) cursor.delete();
                else retained.push({ key: cursor.primaryKey, updatedAt });
                cursor.continue();
            } else {
                retained.sort((a, b) => b.updatedAt - a.updatedAt);
                for (const record of retained.slice(1000)) store.delete(record.key);
            }
        };
    });
}
