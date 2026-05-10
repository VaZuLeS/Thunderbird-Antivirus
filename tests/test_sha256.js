const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

// Read background.js
const backgroundJs = fs.readFileSync('background.js', 'utf8');

// Define a context to execute the code with all necessary mocks
const context = {
    crypto: {
        subtle: {
            digest: null
        }
    },
    Uint8Array,
    Array,
    console,
    // Mocks for Thunderbird/WebExtension APIs
    messenger: {
        storage: {
            local: {
                get: () => Promise.resolve({})
            }
        }
    },
    browser: {
        storage: {
            local: {
                get: () => Promise.resolve({})
            },
            onChanged: {
                addListener: () => {}
            }
        },
        messageDisplay: {
            onMessageDisplayed: {
                addListener: () => {}
            }
        },
        runtime: {
            onMessage: {
                addListener: () => {}
            }
        }
    }
};

// Also mock indexedDB and other globals if needed by background.js initialization
context.indexedDB = {
    open: () => ({ onupgradeneeded: null, onsuccess: null, onerror: null })
};

// Execute background.js in the context
vm.createContext(context);
try {
    vm.runInContext(backgroundJs, context);
} catch (e) {
    // If it fails due to some missing mock, we might need to add it.
    // But we only care about get_sha256_hash for this task.
}

const get_sha256_hash = context.get_sha256_hash;

if (typeof get_sha256_hash !== 'function') {
    console.error("Failed to extract get_sha256_hash from background.js context");
    process.exit(1);
}

async function runTests() {
    console.log("Running tests for get_sha256_hash from background.js...");

    // Happy path test
    console.log("Testing happy path...");
    const mockHash = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer;
    context.crypto.subtle.digest = async (algo, data) => {
        assert.strictEqual(algo, 'SHA-256');
        return mockHash;
    };

    const result = await get_sha256_hash(new Uint8Array([1, 2, 3]).buffer);
    assert.strictEqual(result, 'deadbeef');
    console.log("✅ Happy path passed");

    // Error path test
    console.log("Testing error path...");
    const errorMessage = "Crypto failure";
    context.crypto.subtle.digest = async () => {
        throw new Error(errorMessage);
    };

    try {
        await get_sha256_hash(new Uint8Array([1, 2, 3]).buffer);
        assert.fail("Should have thrown an error");
    } catch (e) {
        assert.strictEqual(e.message, errorMessage);
        console.log("✅ Error path passed");
    }

    console.log("All tests passed!");
}

runTests().catch(err => {
    console.error("Tests failed:", err);
    process.exit(1);
});
