const REPORT_ARCHIVE_ENTRIES = 128;
const REPORT_ARCHIVE_BYTES = 2 * 1024 * 1024;
const REPORT_CAPTURE_BYTES = 4 * 1024 * 1024;
const reportArchiveBlockedKeys = new Set();
function noteReportArchiveBlocked(key, notify = true) {
    if (!reportArchiveBlockedKeys.has(key) && reportArchiveBlockedKeys.size >= 1000) reportArchiveBlockedKeys.delete(reportArchiveBlockedKeys.values().next().value);
    reportArchiveBlockedKeys.add(key);
    if (notify && typeof browser !== 'undefined') {
        try { browser.runtime?.sendMessage?.({action:'reportArchiveBlocked',headerMessageId:key})?.catch?.(() => {}); } catch (_) { /* local diagnostic only */ }
    }
}
function wasReportArchiveBlocked(key) { return reportArchiveBlockedKeys.has(key); }
function clearReportArchiveWarnings() { reportArchiveBlockedKeys.clear(); }
function reportArchiveError() { const error = new Error('Report revision preservation refused'); error.code = 'REPORT_ARCHIVE_BLOCKED'; return error; }
function reportJsonCopy(value, limit) {
    try {
        const json = JSON.stringify(value);
        if (json.length > limit || new TextEncoder().encode(json).length > limit) throw reportArchiveError();
        return JSON.parse(json);
    } catch (_) { throw reportArchiveError(); }
}
function reportSignature(value) {
    return JSON.stringify(value, (key, item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) return Object.fromEntries(Object.keys(item).sort().map(name => [name,item[name]]));
        return item;
    });
}
function reportRevisionSignature(value) {
    const resource = {...value.resource};delete resource.created;
    return reportSignature({kind:value.kind,slot:value.slot,resource});
}
function captureReportState(record) {
    const archive = record?.analysisReportArchive == null ? null : reportJsonCopy(record.analysisReportArchive, REPORT_ARCHIVE_BYTES);
    if (archive && (archive.schemaVersion !== 1 || !Array.isArray(archive.entries) || archive.entries.length > REPORT_ARCHIVE_ENTRIES)) throw reportArchiveError();
    if (archive && archive.entries.some(entry => !entry || typeof entry.id !== 'string' || !['attachment','link'].includes(entry.kind) || !Number.isInteger(entry.slot) || entry.slot < 0 || !entry.resource || typeof entry.resource !== 'object' || Array.isArray(entry.resource))) throw reportArchiveError();
    if (archive && new Set(archive.entries.map(entry => entry.id)).size !== archive.entries.length) throw reportArchiveError();
    const resources = [];
    for (const [kind, field] of [['attachment','attachments'],['link','links']]) {
        if (record?.[field] != null && !Array.isArray(record[field])) throw reportArchiveError();
        for (const [slot, item] of (record?.[field] || []).entries()) {
            if (item && (item.report != null || item.virustotal_stats != null || ['KNOWN','UPLOADED'].includes(item.state))) resources.push({kind,slot,resource:item});
        }
    }
    return {archive,resources:reportJsonCopy(resources, REPORT_CAPTURE_BYTES)};
}
function preserveReportRevisions(before, updated, now = Date.now()) {
    const after = captureReportState(updated);
    if (reportSignature(before.archive) !== reportSignature(after.archive)) throw reportArchiveError();
    const entries = before.archive?.entries || [], known = new Set(entries.map(reportRevisionSignature));
    const current = new Map(after.resources.map(item => [item.kind + ':' + item.slot,reportRevisionSignature(item)]));
    const additions = [];
    for (const previous of before.resources) {
        const signature = reportRevisionSignature(previous);
        if (current.get(previous.kind + ':' + previous.slot) === signature || known.has(signature)) continue;
        if (entries.length + additions.length >= REPORT_ARCHIVE_ENTRIES) throw reportArchiveError();
        const id = crypto.randomUUID();
        if (entries.some(entry => entry.id === id) || additions.some(entry => entry.id === id)) throw reportArchiveError();
        additions.push({id,archivedAt:now,...previous});known.add(signature);
    }
    if (!additions.length) return updated;
    const archive = {schemaVersion:1,entries:[...entries,...additions]};
    reportJsonCopy(archive, REPORT_ARCHIVE_BYTES);
    return {...updated,analysisReportArchive:archive};
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

    commit(transaction, resolve, reject, result) {
        transaction.oncomplete = () => resolve(result());
        transaction.onerror = () => reject(transaction.error || new Error('Database transaction failed'));
        transaction.onabort = () => reject(transaction.error || new Error('Database transaction aborted'));
    }

    updateStore(db, storeName, key, updateFn, options = {}) {
        const storePromise = new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            let result;
            this.commit(transaction, resolve, reject, () => result);
            let preservationNeeded = false;
            const failed = () => {
                if (preservationNeeded) noteReportArchiveBlocked(key);
                reject(transaction.error || new Error('Database transaction failed'));
            };
            transaction.onerror = transaction.onabort = failed;

            request.onsuccess = function () {
                const record = request.result;
                let updatedRecord;
                try {
                    const before = options.preserveReports && storeName === 'hybridanalysis' ? captureReportState(record) : null;
                    preservationNeeded = !!before && (before.resources.length > 0 || before.archive != null);
                    updatedRecord = updateFn(record);
                    if (before && updatedRecord) updatedRecord = preserveReportRevisions(before, updatedRecord);
                }
                catch (error) { if (preservationNeeded || error?.code === 'REPORT_ARCHIVE_BLOCKED') noteReportArchiveBlocked(key); reject(error); transaction.abort(); return; }
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

function updateStore(db, storeName, key, updateFn, options = {}) {
    return defaultDAO.updateStore(db, storeName, key, updateFn, options);
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
