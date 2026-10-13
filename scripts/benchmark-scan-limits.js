// Synthetic memory-pressure comparison. This is not a Thunderbird performance measurement.
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('runtime.js', 'utf8'), context);
async function run(limit) {
    let active = 0, peak = 0;
    const start = performance.now();
    await context.mapWithLimit(Array.from({ length: 40 }), limit, async () => {
        const buffer = new Uint8Array(2 * 1024 * 1024); buffer.fill(1);
        peak = Math.max(peak, ++active);
        await new Promise(resolve => setImmediate(resolve));
        active--;
        return buffer[0];
    });
    return { limit, peakFiles: peak, peakInputMiB: peak * 2, elapsedMs: Math.round(performance.now() - start) };
}
(async () => { console.log(JSON.stringify({ bounded: await run(2), previousUnboundedPattern: await run(40) }, null, 2)); })();
