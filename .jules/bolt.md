## 2024-05-24 - URL Deduplication Bottleneck
**Learning:** In `extractUrls` within `background.js`, using `Array.prototype.indexOf()` for deduplication creates a massive O(N²) performance bottleneck when emails contain many duplicate or unique links.
**Action:** Always prefer `Set` for deduplication in hot paths or when dealing with potentially unbounded arrays. Avoid the O(N²) trap of `indexOf` inside loops.

## 2026-07-14 - Async Loop Optimization
**Learning:** When optimizing caching logic inside asynchronous array loops (e.g., Array.map(async () => ...)), avoid unnecessary Promise wrappers by converting the map to a manual for loop and evaluating the cache hit's type with if (cachedValue instanceof Promise). This allows synchronously available cached values to bypass the microtask queue entirely, preventing N+1 performance bottlenecks.
**Action:** Use a manual for loop with instanceof Promise checking instead of map(async) for caching loops.
