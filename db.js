// ---------------------------------------------------------------------------
// UI localization
//
// All user visible strings are resolved through browser.i18n (see _locales/).
// The German/English text in the code stays as a fallback, so the UI never
// shows empty labels (e.g. in unit tests or if a catalogue entry is missing).
// Placeholders use the $1..$n notation in the fallback text; the catalogues map
// them to named placeholders (see _locales/*/messages.json).
// ---------------------------------------------------------------------------
function i18nText(key, fallback, subs) {
    try {
        if (typeof browser !== 'undefined' && browser.i18n && typeof browser.i18n.getMessage === 'function') {
            const value = browser.i18n.getMessage(key, subs);
            if (value) return value;
        }
    } catch (e) { /* fall through to the bundled fallback */ }
    const values = Array.isArray(subs) ? subs.slice() : (subs === undefined ? [] : [subs]);
    return String(fallback).replace(/\$(\d)/g, (match, index) => {
        const position = Number(index) - 1;
        return position < values.length ? String(values[position]) : match;
    });
}

/**
 * Applies localized texts to elements marked with data-i18n* attributes:
 *   data-i18n             -> textContent
 *   data-i18n-placeholder -> placeholder attribute
 *   data-i18n-title       -> title attribute
 * Elements without a catalogue entry keep their markup (the fallback text is
 * part of the HTML).
 */
function applyUiTranslations(root) {
    const scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || typeof scope.querySelectorAll !== 'function') return;

    scope.querySelectorAll('[data-i18n]').forEach((element) => {
        const text = i18nText(element.dataset.i18n, '');
        if (text) element.textContent = text;
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const text = i18nText(element.dataset.i18nPlaceholder, '');
        if (text) element.setAttribute('placeholder', text);
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((element) => {
        const text = i18nText(element.dataset.i18nTitle, '');
        if (text) element.setAttribute('title', text);
    });
}

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
