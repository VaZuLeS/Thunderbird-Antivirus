const REPORT_ARCHIVE_ENTRIES = 128;
const REPORT_ARCHIVE_BYTES = 2 * 1024 * 1024;
const REPORT_CAPTURE_BYTES = 4 * 1024 * 1024;
const REPORT_OCCURRENCE_LIMIT = 64;
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

const occurrenceReportFields = ['attachments','links','analysisReportArchive'];

function* reportHistoryEntries(source, includeCurrent) {
    if (includeCurrent) for (const [kind,field] of [['attachment','attachments'],['link','links']]) {
        for (const resource of Array.isArray(source?.[field]) ? source[field] : []) {
            if (resource && (resource.report || resource.hybrid_verdict || resource.urlscan || resource.virustotal_stats)) {
                yield {kind,resource};
            }
        }
    }
    const archive = source?.analysisReportArchive;
    if (archive?.schemaVersion === 1 && Array.isArray(archive.entries)) {
        yield* archive.entries.slice(0, REPORT_ARCHIVE_ENTRIES);
    }
}

function* occurrenceReportHistory(record, area, current, scope) {
    yield* reportHistoryEntries(current, false);
    yield* reportHistoryEntries(record, true);
    if (area?.schemaVersion !== 1) return;
    const [runtime] = JSON.parse(scope);
    for (const [key,previous] of Object.entries(area.entries || {}).slice(0, REPORT_OCCURRENCE_LIMIT)) {
        let binding;
        try { binding = JSON.parse(key); } catch (_) { continue; }
        if (Array.isArray(binding) && binding.length === 2 && typeof binding[0] === 'string' && binding[0] &&
            binding[0] !== runtime && Number.isSafeInteger(binding[1]) && binding[1] > 0) yield* reportHistoryEntries(previous, true);
    }
}

function projectOccurrenceReports(record, scope, includeHistory = false) {
    if (!record || !scope) return record;
    const area=record.analysisOccurrenceReports;
    const current=area?.schemaVersion===1 && Object.hasOwn(area.entries || {},scope) ? area.entries[scope] : null;
    const view={...record};
    delete view.analysisOccurrenceReports;
    for (const field of occurrenceReportFields) {
        delete view[field];
        if (current?.[field] != null) view[field]=current[field];
    }
    if (includeHistory) {
        const entries = [];
        let truncated = false;
        // The history screen has a row limit. Protection searches all retained reports of the requested resource kind.
        for (const entry of occurrenceReportHistory(record, area, current, scope)) {
            if (includeHistory === true && entries.length >= REPORT_ARCHIVE_ENTRIES) {
                truncated = true;
                break;
            }
            if (includeHistory === true || entry?.kind === includeHistory) entries.push(entry);
        }
        if (entries.length) view.analysisReportArchive = {schemaVersion: 1, entries, truncated};
    }
    return view;
}

function commitOccurrenceReports(original, scoped, scope) {
    const area=original?.analysisOccurrenceReports;
    if (area!=null && (area.schemaVersion!==1 || !area.entries || typeof area.entries!=='object' || Array.isArray(area.entries))) throw reportArchiveError();
    const entries=area?.entries || {};
    const previous=entries[scope];
    if (Object.hasOwn(entries,scope) && (!previous || typeof previous!=='object' || Array.isArray(previous))) throw reportArchiveError();
    const updated={...scoped};
    delete updated.analysisOccurrenceReports;
    const reports={...previous};
    for (const field of occurrenceReportFields) {
        if (Object.hasOwn(scoped,field)) reports[field]=scoped[field];
        else delete reports[field];
        if (Object.hasOwn(original || {},field)) updated[field]=original[field];
        else delete updated[field];
    }
    if (!previous && !Object.keys(reports).length) return area ? {...updated,analysisOccurrenceReports:area} : updated;
    if (!previous && Object.keys(entries).length>=REPORT_OCCURRENCE_LIMIT) throw reportArchiveError();
    const next={...entries,[scope]:reports};
    reportJsonCopy(next,REPORT_CAPTURE_BYTES);
    return {...updated,analysisOccurrenceReports:{...area,schemaVersion:1,entries:next}};
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
                const original = request.result;
                let updatedRecord;
                try {
                    const scope=storeName==='hybridanalysis' ? options.reportScope : null;
                    const record=projectOccurrenceReports(original,scope);
                    const before = options.preserveReports && storeName === 'hybridanalysis' ? captureReportState(record) : null;
                    preservationNeeded = !!before && (before.resources.length > 0 || before.archive != null);
                    updatedRecord = updateFn(record);
                    if (before && updatedRecord) updatedRecord = preserveReportRevisions(before, updatedRecord);
                    if (scope && updatedRecord) updatedRecord=commitOccurrenceReports(original,updatedRecord,scope);
                }
                catch (error) { if (preservationNeeded || error?.code === 'REPORT_ARCHIVE_BLOCKED') noteReportArchiveBlocked(key); reject(error); transaction.abort(); return; }
                if (!updatedRecord) { reject(new Error('Cannot update a missing record')); transaction.abort(); return; }
                let putRequest;
                try { putRequest = store.put(updatedRecord); }
                catch(error) { if(preservationNeeded)noteReportArchiveBlocked(key);reject(error);transaction.abort();return; }

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

    getFromStore(db, storeName, key, options = {}) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = function () {
                try {
                    resolve(projectOccurrenceReports(request.result,storeName==='hybridanalysis' ? options.reportScope : null,options.includeHistory));
                } catch (error) { reject(error); }
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

function getFromStore(db, storeName, key, options = {}) {
    return defaultDAO.getFromStore(db, storeName, key, options);
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
                // Unreadable resource collections are not a deletion decision.
                // Leave the original intact and let other records remain usable.
                if (!record || ['attachments','links'].some(field => record[field] != null && (!Array.isArray(record[field]) || record[field].some(item => !item || typeof item !== 'object' || Array.isArray(item))))) {
                    cursor.continue(); return;
                }
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

function deriveMessageContentKey(message, attachmentHashes = []) {
    if (!message || typeof message !== 'object') return null;
    const author = typeof message.author === 'string' ? message.author.trim().toLowerCase() : '';
    const subject = typeof message.subject === 'string' ? message.subject.trim() : '';
    const rawDate = message.date instanceof Date ? message.date.getTime() : typeof message.date === 'number' ? message.date : typeof message.date === 'string' && message.date.trim() ? Date.parse(message.date) : NaN;
    const datePart = Number.isFinite(rawDate) ? String(rawDate) : '';
    const hashes = Array.isArray(attachmentHashes) ? attachmentHashes.filter(h => typeof h === 'string' && /^[0-9a-f]{64}$/i.test(h)).map(h => h.toLowerCase()).sort() : [];
    if (!author && !subject && !datePart && !hashes.length) return message.id != null ? 'message:' + message.id : null;
    const canonical = JSON.stringify({ v: 1, author, subject, date: datePart, attachments: hashes });
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < canonical.length; i++) {
        const c = canonical.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
    }
    return 'content:' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + ':' + canonical.length;
}

function resolveMessageStorageKey(message, attachmentHashes = []) {
    if (!message || typeof message !== 'object') return null;
    if (typeof message.headerMessageId === 'string' && message.headerMessageId.trim()) return message.headerMessageId;
    return deriveMessageContentKey(message, attachmentHashes);
}

