const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('db.js module', () => {
    let context;

    it('should resolve openDB correctly on success', async () => {
        let dbMock = { name: 'test_db' };
        context = {
            indexedDB: {
                open: () => {
                    let req = {};
                    setTimeout(() => {
                        req.result = dbMock;
                        req.onsuccess({ target: req });
                    }, 10);
                    return req;
                }
            },
            console: { log: () => {}, error: () => {} },
            Promise: Promise
        };

        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
        vm.runInContext(code, context);

        const openDB = context.openDB;
        const result = await openDB('test', 1);
        assert.strictEqual(result, dbMock);
    });

    it('should clearStore correctly', async () => {
        let dbMock = {
            objectStoreNames: { contains: () => true },
            transaction: () => ({
                objectStore: () => ({
                    clear: () => {
                        let req = {};
                        setTimeout(() => req.onsuccess(), 10);
                        return req;
                    }
                })
            })
        };
        context = {
            Promise: Promise,
            console: { log: () => {}, error: () => {} }
        };
        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
        vm.runInContext(code, context);

        const clearStore = context.clearStore;
        const result = await clearStore(dbMock, 'hybridanalysis');
        assert.strictEqual(result, true);
    });
});
