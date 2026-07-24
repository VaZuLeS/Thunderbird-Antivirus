## 2024-05-24 - URL Deduplication Bottleneck
**Learning:** In `extractUrls` within `background.js`, using `Array.prototype.indexOf()` for deduplication creates a massive O(N²) performance bottleneck when emails contain many duplicate or unique links.
**Action:** Always prefer `Set` for deduplication in hot paths or when dealing with potentially unbounded arrays. Avoid the O(N²) trap of `indexOf` inside loops.
## 2024-05-24 - Hoisting Invariants in Tight Loops
**Learning:** In algorithms with O(N*M) nested loops like `levenshteinDistance` in `background.js`, repeating property lookups (`.length`) and function calls (`charCodeAt` for invariant outer-loop data) inside the inner loop creates substantial overhead.
**Action:** When optimizing tight nested loops, always cache lengths locally outside the loops, and hoist any evaluation that is invariant for the inner loop (e.g., `const bChar = b.charCodeAt(i - 1);`) into the outer loop block.

## 2024-07-24 - Optimize domain checking against sets
**Learning:** When checking if a domain matches any domain in a large blacklist/whitelist `Set`, iterating over the entire `Set` to check `endsWith` is an O(n) operation that negates the performance benefit of using a `Set`.
**Action:** Instead of iterating over the `Set`, extract the base domains (e.g., generating `sub.domain.com`, `domain.com`) using `indexOf` and `substring` and perform O(1) `.has()` lookups against the `Set`. This drastically reduces execution time (from ~3.5s to ~30ms for 100k checks on a 1k item list).
