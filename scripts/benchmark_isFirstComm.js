const { performance } = require('perf_hooks');

// Mock browser.messages.query
const browser = {
    messages: {
        query: async ({ to }) => {
            // Simulate I/O latency
            await new Promise(r => setTimeout(r, 2));
            return { messages: [1] }; // known sender
        }
    }
};

const knownSendersCache = new Set();

async function checkCommunicationOriginal(senderEmail) {
    let isFirstCommunication = false;
    try {
        if (browser.messages.query) {
            let previousMsgs = await browser.messages.query({ to: senderEmail });
            if (previousMsgs && previousMsgs.messages && previousMsgs.messages.length === 0) {
                isFirstCommunication = true;
            }
        }
    } catch (e) {}
    return isFirstCommunication;
}

async function checkCommunicationOptimized(senderEmail) {
    let isFirstCommunication = false;
    try {
        if (browser.messages.query) {
            if (knownSendersCache.has(senderEmail)) {
                isFirstCommunication = false;
            } else {
                let previousMsgs = await browser.messages.query({ to: senderEmail });
                if (previousMsgs && previousMsgs.messages && previousMsgs.messages.length === 0) {
                    isFirstCommunication = true;
                } else {
                    if (knownSendersCache.size > 1000) knownSendersCache.clear();
                    knownSendersCache.add(senderEmail);
                }
            }
        }
    } catch (e) {}
    return isFirstCommunication;
}

async function runBenchmark() {
    const iterations = 100;
    const email = "test@example.com";

    // Original
    const start1 = performance.now();
    for (let i = 0; i < iterations; i++) {
        await checkCommunicationOriginal(email);
    }
    const end1 = performance.now();
    const timeOriginal = end1 - start1;

    // Optimized
    const start2 = performance.now();
    for (let i = 0; i < iterations; i++) {
        await checkCommunicationOptimized(email);
    }
    const end2 = performance.now();
    const timeOptimized = end2 - start2;

    console.log(`Original Time for ${iterations} iterations: ${timeOriginal.toFixed(2)} ms`);
    console.log(`Optimized Time for ${iterations} iterations: ${timeOptimized.toFixed(2)} ms`);
    console.log(`Improvement: ${((timeOriginal - timeOptimized) / timeOriginal * 100).toFixed(2)}%`);
}

runBenchmark();
