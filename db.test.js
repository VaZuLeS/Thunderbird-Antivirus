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

    it('should resolve getFromStore correctly on success', async () => {
        let expectedResult = { id: 123, data: 'test data' };
        let dbMock = {
            transaction: () => ({
                objectStore: () => ({
                    get: () => {
                        let req = {};
                        setTimeout(() => {
                            req.result = expectedResult;
                            req.onsuccess();
                        }, 10);
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

        const getFromStore = context.getFromStore;
        const result = await getFromStore(dbMock, 'hybridanalysis', 'some_key');
        assert.deepStrictEqual(result, expectedResult);
    });

    it('should reject getFromStore correctly on error', async () => {
        let expectedError = new Error('Test error');
        let dbMock = {
            transaction: () => ({
                objectStore: () => ({
                    get: () => {
                        let req = {};
                        setTimeout(() => {
                            req.target = { error: expectedError };
                            req.onerror({ target: req.target });
                        }, 10);
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

        const getFromStore = context.getFromStore;
        try {
            await getFromStore(dbMock, 'hybridanalysis', 'some_key');
            assert.fail('Should have rejected');
        } catch (e) {
            assert.strictEqual(e, expectedError);
        }
    });

    it('should resolve putToStore correctly on success', async () => {
        let expectedResult = 123;
        let itemToPut = { id: 123, data: 'test data' };
        let dbMock = {
            transaction: () => ({
                objectStore: () => ({
                    put: (item) => {
                        assert.strictEqual(item, itemToPut);
                        let req = {};
                        setTimeout(() => {
                            req.result = expectedResult;
                            req.onsuccess();
                        }, 10);
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

        const putToStore = context.putToStore;
        const result = await putToStore(dbMock, 'hybridanalysis', itemToPut);
        assert.strictEqual(result, expectedResult);
    });

    it('should reject putToStore correctly on error', async () => {
        let expectedError = new Error('Test put error');
        let itemToPut = { id: 123, data: 'test data' };
        let dbMock = {
            transaction: () => ({
                objectStore: () => ({
                    put: (item) => {
                        assert.strictEqual(item, itemToPut);
                        let req = {};
                        setTimeout(() => {
                            req.target = { error: expectedError };
                            req.onerror({ target: req.target });
                        }, 10);
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

        const putToStore = context.putToStore;
        try {
            await putToStore(dbMock, 'hybridanalysis', itemToPut);
            assert.fail('Should have rejected');
        } catch (e) {
            assert.strictEqual(e, expectedError);
        }
    });
});
