const fs = require('fs');
const vm = require('vm');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');

// We just want to measure `sent_to_hybrid_by_attachment`
async function runPerf() {
    let context = {
        browser: {
            storage: {
                local: { get: async () => ({}) },
                onChanged: { addListener: () => {} }
            },
            messageDisplay: { onMessageDisplayed: { addListener: () => {} } },
            runtime: { onMessage: { addListener: () => {} } },
            messages: {
                getAttachmentFile: async () => ({
                    slice: () => ({
                        arrayBuffer: async () => {
                            // simulate reading file delay
                            await new Promise(resolve => setTimeout(resolve, 50));
                            return new ArrayBuffer(8);
                        }
                    }),
                    type: 'application/octet-stream'
                })
            }
        },
        crypto: globalThis.crypto,
        fetch: async () => {
            // simulate network delay
            await new Promise(resolve => setTimeout(resolve, 200));
            return {
                status: 200,
                json: async () => ({ submission_id: 'sub', job_id: 'job' })
            };
        },
        indexedDB_save_hybrid_data_to_db: () => {},
        console: { log: () => {}, error: () => {} },
        Array: globalThis.Array,
        Uint8Array: globalThis.Uint8Array,
        Promise: globalThis.Promise,
        setTimeout: setTimeout
    };

    vm.createContext(context);
    const wrappedCode = `
        ${code}
        apikey_hybridanalysis = 'test';
        globalThis.sent_to_hybrid_by_attachment = sent_to_hybrid_by_attachment;
    `;
    vm.runInContext(wrappedCode, context);

    const attachments = [];
    for (let i = 0; i < 5; i++) {
        attachments.push({ name: `test${i}.exe`, contentType: 'application/x-msdownload', size: 100, partName: `${i}` });
    }

    const start = Date.now();
    await context.sent_to_hybrid_by_attachment({ id: 1, headerMessageId: '123' }, attachments);
    const end = Date.now();
    console.log(`Execution time for 5 attachments: ${end - start}ms`);
}
runPerf();
