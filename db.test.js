const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

describe('UI localization helpers (db.js)', () => {
    function loadDb({ i18n } = {}) {
        const dom = new JSDOM('<!doctype html><html><body>' +
            '<h1 data-i18n="optionsTitle">Alt</h1>' +
            '<input id="field" placeholder="alt">' +
            '<div id="box" title="alt-title">x</div>' +
            '</body></html>');
        const context = {
            browser: i18n ? { i18n } : {},
            document: dom.window.document,
            console: { log: () => {}, error: () => {} },
            Promise,
            indexedDB: { open: () => ({}) }
        };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8'), context);
        return { context, document: dom.window.document };
    }

    it('returns the bundled fallback when no catalogue is available', () => {
        const { context } = loadDb();
        assert.strictEqual(context.i18nText('optionsTitle', 'Thundy AV Einstellungen'), 'Thundy AV Einstellungen');
    });

    it('substitutes the $1..$n placeholders in the fallback text', () => {
        const { context } = loadDb();
        assert.strictEqual(context.i18nText('optionsPermissionDenied', 'Nicht erteilt für: $1.', ['a.com, b.com']),
            'Nicht erteilt für: a.com, b.com.');
        assert.strictEqual(context.i18nText('optionsTwo', 'First $1 then $2', ['A', 'B']), 'First A then B');
    });

    it('prefers the catalogue message when browser.i18n provides one', () => {
        const { context } = loadDb({ i18n: { getMessage: (key) => (key === 'optionsTitle' ? 'Thundy AV settings' : '') } });
        assert.strictEqual(context.i18nText('optionsTitle', 'Thundy AV Einstellungen'), 'Thundy AV settings');
        assert.strictEqual(context.i18nText('other', 'Fallback'), 'Fallback');
    });

    it('survives a throwing i18n implementation', () => {
        const { context } = loadDb({ i18n: { getMessage: () => { throw new Error('no i18n'); } } });
        assert.strictEqual(context.i18nText('optionsTitle', 'Fallback'), 'Fallback');
    });

    it('applies translations to data-i18n elements and attributes', () => {
        const { context, document } = loadDb({
            i18n: {
                getMessage: (key) => ({
                    optionsTitle: 'Thundy AV settings',
                    optionsPlaceholder: 'e.g. abcdef',
                    optionsTitleAttr: 'Opens in a new tab'
                }[key] || '')
            }
        });
        document.getElementById('field').setAttribute('data-i18n-placeholder', 'optionsPlaceholder');
        document.getElementById('box').setAttribute('data-i18n-title', 'optionsTitleAttr');

        context.applyUiTranslations(document);

        assert.strictEqual(document.querySelector('h1').textContent, 'Thundy AV settings');
        assert.strictEqual(document.getElementById('field').getAttribute('placeholder'), 'e.g. abcdef');
        assert.strictEqual(document.getElementById('box').getAttribute('title'), 'Opens in a new tab');
    });

    it('keeps the existing markup when a key has no catalogue entry', () => {
        const { context, document } = loadDb();
        context.applyUiTranslations(document);
        assert.strictEqual(document.querySelector('h1').textContent, 'Alt');
    });

    it('does not throw without a document', () => {
        const { context } = loadDb();
        assert.doesNotThrow(() => context.applyUiTranslations(null));
    });
});

describe('db.js module', () => {
    let context;

    it('should create object store in onupgradeneeded if it does not exist', async () => {
        let createObjectStoreCalled = false;
        let dbMock = {
            objectStoreNames: { contains: () => false },
            createObjectStore: (name, options) => {
                createObjectStoreCalled = true;
            }
        };
        context = {
            indexedDB: {
                open: () => {
                    let req = {};
                    setTimeout(() => {
                        req.result = dbMock;
                        req.onupgradeneeded({ target: req });
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
        await openDB('test', 1);
        assert.strictEqual(createObjectStoreCalled, true);
    });

    it('should not create object store in onupgradeneeded if it already exists', async () => {
        let createObjectStoreCalled = false;
        let dbMock = {
            objectStoreNames: { contains: () => true },
            createObjectStore: () => {
                createObjectStoreCalled = true;
            }
        };
        context = {
            indexedDB: {
                open: () => {
                    let req = {};
                    setTimeout(() => {
                        req.result = dbMock;
                        req.onupgradeneeded({ target: req });
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
        await openDB('test', 1);
        assert.strictEqual(createObjectStoreCalled, false);
    });

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

    it('should reject openDB correctly on error when e.target.error is provided', async () => {
        let testError = new Error('Database opening failed');
        context = {
            indexedDB: {
                open: () => {
                    let req = {};
                    setTimeout(() => {
                        req.error = testError;
                        req.onerror({ target: req });
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
        await assert.rejects(async () => {
            await openDB('test', 1);
        }, (err) => {
            assert.strictEqual(err, testError);
            return true;
        });
    });

    it('should reject openDB correctly on error with fallback error message when e.target.error is falsy', async () => {
        context = {
            indexedDB: {
                open: () => {
                    let req = {};
                    setTimeout(() => {
                        req.error = null;
                        req.onerror({ target: req });
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
        await assert.rejects(async () => {
            await openDB('test', 1);
        }, (err) => {
            assert.strictEqual(err.message, 'Fehler beim Öffnen der Datenbank');
            return true;
        });
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
