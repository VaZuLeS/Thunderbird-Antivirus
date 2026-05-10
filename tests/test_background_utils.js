const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

// Mock browser API
const browserMock = {
  storage: {
    local: {
      get: () => Promise.resolve({ apikey: 'test-key' })
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
  },
  messages: {
    getFull: () => Promise.resolve({}),
    listAttachments: () => Promise.resolve([]),
    getAttachmentFile: () => Promise.resolve({})
  }
};

// Mock TextEncoder for convenience in tests
const textEncoder = new TextEncoder();

const code = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');

const context = {
  browser: browserMock,
  console: console,
  crypto: globalThis.crypto,
  Uint8Array: Uint8Array,
  Array: Array,
  TextEncoder: TextEncoder,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
};

vm.createContext(context);
vm.runInContext(code, context);

async function runTests() {
  console.log('Starting tests for get_sha256_hash...');

  const { get_sha256_hash } = context;

  // Test Case 1: "hello world"
  try {
    const input = textEncoder.encode('hello world').buffer;
    const expected = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
    const result = await get_sha256_hash(input);
    assert.strictEqual(result, expected, 'Hash for "hello world" should match');
    console.log('✅ Test Case 1 passed: "hello world"');
  } catch (err) {
    console.error('❌ Test Case 1 failed:', err.message);
    process.exit(1);
  }

  // Test Case 2: Empty input
  try {
    const input = textEncoder.encode('').buffer;
    const expected = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const result = await get_sha256_hash(input);
    assert.strictEqual(result, expected, 'Hash for empty input should match');
    console.log('✅ Test Case 2 passed: empty input');
  } catch (err) {
    console.error('❌ Test Case 2 failed:', err.message);
    process.exit(1);
  }

  // Test Case 3: "Thunderbird"
  try {
    const input = textEncoder.encode('Thunderbird').buffer;
    const expected = '08348a9b632da399c7201b2951334e21f664b84532d82bc771af7f3a402dcd41';
    const result = await get_sha256_hash(input);
    assert.strictEqual(result, expected, 'Hash for "Thunderbird" should match');
    console.log('✅ Test Case 3 passed: "Thunderbird"');
  } catch (err) {
    console.error('❌ Test Case 3 failed:', err.message);
    process.exit(1);
  }

  // Test Case 4: Larger buffer (1MB of zeros)
  try {
    const size = 1024 * 1024;
    const buffer = new Uint8Array(size).fill(0).buffer;
    const expected = '30e14955ebf1352266dc2ff8067e68104607e750abb9d3b36582b8af909fcb58';
    const result = await get_sha256_hash(buffer);
    assert.strictEqual(result, expected, 'Hash for 1MB of zeros should match');
    console.log('✅ Test Case 4 passed: 1MB of zeros');
  } catch (err) {
    console.error('❌ Test Case 4 failed:', err.message);
    process.exit(1);
  }

  console.log('All tests passed!');
}

runTests();
