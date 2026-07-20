const { performance } = require('perf_hooks');

// Mock data
const record = {
    attachments: Array.from({ length: 50 }, (_, i) => ({
        hybrid_sha256: `hash${i}`,
        state: 'KNOWN',
        attachment_name: `att${i}.txt`,
        partName: `part${i}`
    })),
    links: Array.from({ length: 50 }, (_, i) => ({
        hybrid_sha256: `linkhash${i}`,
        state: 'KNOWN',
        url: `http://example.com/${i}`
    }))
};

let activeFetches = 0;
let maxActiveFetches = 0;

async function mock_get_hybrid_report_by_sha256() {
    activeFetches++;
    if (activeFetches > maxActiveFetches) {
        maxActiveFetches = activeFetches;
    }
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    activeFetches--;
}

async function runUnbounded() {
    activeFetches = 0;
    maxActiveFetches = 0;
    const start = performance.now();

    let fetchPromises = [];
    if (record.attachments) {
        for (const att of record.attachments) {
            fetchPromises.push(mock_get_hybrid_report_by_sha256());
        }
    }
    if (record.links) {
        const linkPromises = [];
        for (const linkObj of record.links) {
            linkPromises.push(mock_get_hybrid_report_by_sha256());
        }
        if (linkPromises.length > 0) {
            fetchPromises.push(Promise.all(linkPromises));
        }
    }
    if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
    }

    const end = performance.now();
    return { time: end - start, maxActive: maxActiveFetches };
}

async function runBatched() {
    activeFetches = 0;
    maxActiveFetches = 0;
    const start = performance.now();

    let fetchTasks = [];
    if (record.attachments) {
        for (const att of record.attachments) {
            fetchTasks.push(() => mock_get_hybrid_report_by_sha256());
        }
    }
    if (record.links) {
        for (const linkObj of record.links) {
            fetchTasks.push(() => mock_get_hybrid_report_by_sha256());
        }
    }
    if (fetchTasks.length > 0) {
        const BATCH_SIZE = 5;
        for (let i = 0; i < fetchTasks.length; i += BATCH_SIZE) {
            const batch = fetchTasks.slice(i, i + BATCH_SIZE).map(task => task());
            await Promise.all(batch);
        }
    }

    const end = performance.now();
    return { time: end - start, maxActive: maxActiveFetches };
}

async function run() {
    const unb = await runUnbounded();
    const batch = await runBatched();
    console.log(`Unbounded: Time = ${unb.time.toFixed(2)}ms, Max Active Fetches = ${unb.maxActive}`);
    console.log(`Batched (size 5): Time = ${batch.time.toFixed(2)}ms, Max Active Fetches = ${batch.maxActive}`);
}

run();
