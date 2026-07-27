## 2024-05-24 - URL Deduplication Bottleneck
**Learning:** In `extractUrls` within `background.js`, using `Array.prototype.indexOf()` for deduplication creates a massive O(N²) performance bottleneck when emails contain many duplicate or unique links.
**Action:** Always prefer `Set` for deduplication in hot paths or when dealing with potentially unbounded arrays. Avoid the O(N²) trap of `indexOf` inside loops.
## 2024-05-24 - Hoisting Invariants in Tight Loops
**Learning:** In algorithms with O(N*M) nested loops like `levenshteinDistance` in `background.js`, repeating property lookups (`.length`) and function calls (`charCodeAt` for invariant outer-loop data) inside the inner loop creates substantial overhead.
**Action:** When optimizing tight nested loops, always cache lengths locally outside the loops, and hoist any evaluation that is invariant for the inner loop (e.g., `const bChar = b.charCodeAt(i - 1);`) into the outer loop block.
## 2024-05-18 - Batching Async DOM Updates with DocumentFragments
**Learning:** DocumentFragments can be used to batch not just synchronous DOM insertions, but also asynchronous ones by passing the fragment reference through the async task chain. However, you must await the resolution of the asynchronous tasks (e.g., using `Promise.all`) *before* appending the fragment to the DOM. If the fragment is appended before the promises resolve, the DOM will not update when the promises finally mutate the detached fragment.
**Action:** When batching async appends, explicitly create the `DocumentFragment` immediately before the `Promise.all` block, ensure the fragment reference is correctly passed down to the async rendering functions, await the batch's completion, and only then call `container.appendChild(fragment)`.
