## 2024-05-24 - [Avoid getElementsByTagName('*') in DOM Processing]
**Learning:** Iterating over every single DOM element using `getElementsByTagName('*')` and processing all of their attributes is an O(N*M) operation that scales horribly with large HTML documents (like complex email bodies). Replacing this iteration with a targeted `TreeWalker` to find attributes and `querySelectorAll` for specific attributes reduces processing time significantly. In a 5000-node DOM test, this optimization reduced execution time from ~48,606ms (baseline) down to ~687ms (a massive 98.5% speedup).
**Action:** Use `TreeWalker` (with `SHOW_ELEMENT`) and targeted `querySelectorAll` selectors when you need to parse/sanitize specific attributes in the DOM rather than looping through all elements and attributes.

## 2024-05-20 - [Avoid .toLowerCase() in Regex Hot Loops]
**Learning:** Calling `.toLowerCase()` individually on captured regex match groups (`match[n].toLowerCase()`) inside a `while` loop parsing large text blocks (like email bodies) creates massive redundant memory allocations. Pre-converting the *entire* input string once before the loop reduces processing time for 10k iterations from ~395ms down to ~227ms (a ~42% speedup). Additionally, micro-optimizations like `Set.has()` vs `Array.includes()` for tiny arrays (e.g., 12 items) yield zero measurable benefit and should be ignored.
**Action:** Always pre-normalize (lowercase) large input strings *before* iterating over them with case-insensitive regular expressions, especially when the extracted groups need to be normalized downstream anyway.
## 2024-05-24 - [Avoid Array.map() inside Hot Loops]
**Learning:** Calling `.map(s => s.toLowerCase())` on dynamically sized arrays inside frequently called functions (like `checkLists` running for every link or email evaluation) introduces an O(N) array allocation overhead per call. Moving this `.map()` to occur only once during configuration loading avoids redundant allocations, significantly reducing GC pressure.
**Action:** Always pre-process configuration arrays (e.g. lowecase normalization) at initialization time rather than mapping them inline during hot evaluation paths.
## 2026-05-24

### 💡 What:
Replaced the fixed 2-second polling loop in `checkUrlscanIo` (`background.js`) with an exponential backoff loop.

### 🎯 Why:
The previous implementation made up to 15 rapid API requests over 30 seconds when waiting for URLScan results. Using exponential backoff (starting at 2s, increasing 1.5x up to 10s max) achieves the same 30-second timeout window while significantly reducing the number of requests to the URLScan API, preventing rate limits and saving bandwidth.

### 📊 Impact:
In the worst-case scenario (timeout), API requests are reduced from 15 to 6 (a 60% reduction in unnecessary API polling overhead).

### 🔬 Measurement:
A standalone benchmark script confirmed the reduction in loop iterations and total requests across varying response time limits. Verified functionality using the native test suite `node --test background.test.js`.
## 2024-05-24

### Learning
When iterating over arrays (like attachments or links) and dispatching asynchronous API calls (`get_hybrid_report_by_sha256`) from an IndexedDB `onsuccess` callback, firing them concurrently without `await` acts as a "fire-and-forget". While this initiates all requests instantly (e.g., 100 requests in 0.5ms), it floods the background event loop with concurrent HTTP requests. This can lead to unhandled promise rejections, memory spikes, and aggressive HTTP 429 Rate Limiting from third-party APIs.

To solve this, the callback can be made `async` and the API calls `await`ed. This ensures a sequential request flow, resolving the spamming issue.

**Note on IndexedDB:** Making an `onsuccess` handler `async` causes the underlying transaction to automatically commit when the microtask queue yields (at the first `await`). This is safe *only* if there are no subsequent IndexedDB operations dependent on that specific transaction after the `await`. In this codebase, the transaction is only used to retrieve a single record before the network loop begins, so this optimization is safe.
