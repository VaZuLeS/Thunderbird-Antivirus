## 2024-05-24 - URL Deduplication Bottleneck
**Learning:** In `extractUrls` within `background.js`, using `Array.prototype.indexOf()` for deduplication creates a massive O(N²) performance bottleneck when emails contain many duplicate or unique links.
**Action:** Always prefer `Set` for deduplication in hot paths or when dealing with potentially unbounded arrays. Avoid the O(N²) trap of `indexOf` inside loops.
## 2024-10-24 - Async Cache Hits Bottleneck in Array.map
**Learning:** Using `Array.map(async () => ...)` combined with `Promise.all` forces every iteration through the microtask queue, even when the cache value is already resolved synchronously (e.g. `isMalicious` as a boolean from `ipReputationCache`). This creates an unnecessary overhead bottleneck for large cached arrays.
**Action:** When iterating over a cache that may return synchronous values or promises, replace `Array.map` with a manual `for` loop and check `if (cached instanceof Promise)`. Only wrap/await the true pending promises to allow synchronous cache hits to bypass the microtask queue entirely.
