const vm = require('node:vm');
const fs = require('fs');

async function run() {
    const code = fs.readFileSync('background.js', 'utf8').replace(/let /g, 'var ');
    const context = {
        console: console,
        setTimeout: setTimeout,
        crypto: { subtle: { digest: async () => new Uint8Array([1,2,3]).buffer } },
        URL: URL,
        Set: Set,
        Promise: Promise,
        Array: Array,
        Uint8Array: Uint8Array,
        browser: {
            storage: {
                local: { get: async () => ({}) },
                onChanged: { addListener: () => {} }
            },
            messages: {
                listAttachments: async () => ([]),
                getFull: async () => ({
                    contentType: 'text/html',
                    body: '<a href="http://paypal.com">Click</a>',
                    headers: {}
                })
            },
            scripting: {
                executeScript: async (opts) => {
                    if (opts.args && opts.args.length > 0) {
                        context.executedWarningScript = opts;
                    }
                }
            },
            messageDisplay: {
                onMessageDisplayed: { addListener: () => {} }
            },
            runtime: {
                onMessage: { addListener: () => {} }
            }
        },
        openDB: async () => ({}),
        timeOfClickProtection: false,
        ipReputationProvider: 'none',
        urlhausApikey: '',
        knownSendersCache: new Set(),
        MAX_KNOWN_SENDERS: 1000,
        privacyTier: 'balanced',
        executedWarningScript: null,
    };

    vm.createContext(context);
    vm.runInContext(code, context);

    // Call loadSettings
    await context.loadSettings();

    await context.tab_mail_open_display({ id: 10 }, { id: 1, author: 'User <user@example.com>', subject: 'Action required' });
    console.log("executedWarningScript 2:", context.executedWarningScript);
}

run().catch(console.error);
