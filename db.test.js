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
            transaction: (storeNames, mode) => {
                assert.strictEqual(Array.from(storeNames).join(','), 'hybridanalysis');
                assert.strictEqual(mode, 'readonly');
                return {
                    objectStore: (storeName) => {
                        assert.strictEqual(storeName, 'hybridanalysis');
                        return {
                            get: (key) => {
                                assert.strictEqual(key, 'some_key');
                                let req = {};
                                setTimeout(() => {
                                    req.result = expectedResult;
                                    req.onsuccess();
                                }, 10);
                                return req;
                            }
                        };
                    }
                };
            }
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

    it('should resolve getFromStore correctly when item not found', async () => {
        let dbMock = {
            transaction: (storeNames, mode) => {
                assert.strictEqual(Array.from(storeNames).join(','), 'hybridanalysis');
                assert.strictEqual(mode, 'readonly');
                return {
                    objectStore: (storeName) => {
                        assert.strictEqual(storeName, 'hybridanalysis');
                        return {
                            get: (key) => {
                                assert.strictEqual(key, 'missing_key');
                                let req = {};
                                setTimeout(() => {
                                    req.result = undefined;
                                    req.onsuccess();
                                }, 10);
                                return req;
                            }
                        };
                    }
                };
            }
        };
        context = {
            Promise: Promise,
            console: { log: () => {}, error: () => {} }
        };
        vm.createContext(context);
        const code = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
        vm.runInContext(code, context);

        const getFromStore = context.getFromStore;
        const result = await getFromStore(dbMock, 'hybridanalysis', 'missing_key');
        assert.strictEqual(result, undefined);
    });

    it('should reject getFromStore correctly on error', async () => {
        let expectedError = new Error('Test error');
        let dbMock = {
            transaction: (storeNames, mode) => {
                assert.strictEqual(Array.from(storeNames).join(','), 'hybridanalysis');
                assert.strictEqual(mode, 'readonly');
                return {
                    objectStore: (storeName) => {
                        assert.strictEqual(storeName, 'hybridanalysis');
                        return {
                            get: (key) => {
                                assert.strictEqual(key, 'some_key');
                                let req = {};
                                setTimeout(() => {
                                    req.target = { error: expectedError };
                                    req.onerror({ target: req.target });
                                }, 10);
                                return req;
                            }
                        };
                    }
                };
            }
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

    it('should resolve getFromStore correctly when key is not found', async () => {
        let expectedResult = undefined;
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
        assert.strictEqual(result, expectedResult);
    });

    it('should reject getFromStore correctly with fallback error message', async () => {
        let dbMock = {
            transaction: () => ({
                objectStore: () => ({
                    get: () => {
                        let req = {};
                        setTimeout(() => {
                            req.target = {}; // No explicitly defined target.error
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
            assert.strictEqual(e.message, 'Fehler beim Abrufen aus Store: hybridanalysis');
        }
    });

    it('should resolve updateStore correctly on success', async () => {
        let initialRecord = { id: 123, count: 1 };
        let updatedRecord = { id: 123, count: 2 };
        let expectedResult = 123;

        let dbMock = {
            transaction: () => ({
                objectStore: () => ({
                    get: () => {
                        let req = {};
                        setTimeout(() => {
                            req.result = initialRecord;
                            req.onsuccess();
                        }, 10);
                        return req;
                    },
                    put: (item) => {
                        assert.deepStrictEqual(item, updatedRecord);
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

        const updateStore = context.updateStore;
        const result = await updateStore(dbMock, 'hybridanalysis', 'some_key', (record) => {
            record.count += 1;
            return record;
        });
        assert.strictEqual(result, expectedResult);
    });

    it('should reject updateStore correctly on get error', async () => {
        let expectedError = new Error('Test get error');
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

        const updateStore = context.updateStore;
        try {
            await updateStore(dbMock, 'hybridanalysis', 'some_key', (r) => r);
            assert.fail('Should have rejected');
        } catch (e) {
            assert.strictEqual(e, expectedError);
        }
    });

    it('should reject updateStore correctly on put error', async () => {
        let initialRecord = { id: 123, count: 1 };
        let expectedError = new Error('Test put error');
        let dbMock = {
            transaction: () => ({
                objectStore: () => ({
                    get: () => {
                        let req = {};
                        setTimeout(() => {
                            req.result = initialRecord;
                            req.onsuccess();
                        }, 10);
                        return req;
                    },
                    put: () => {
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

        const updateStore = context.updateStore;
        try {
            await updateStore(dbMock, 'hybridanalysis', 'some_key', (r) => r);
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
