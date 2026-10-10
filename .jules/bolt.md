## 2024-07-28 - Optimize domain matching loop by caching string concatenations
**Learning:** In string matching loops involving Sets, concatenating strings within the loop condition (e.g. `endsWith('.' + domain)`) creates unnecessary allocations in the hot path. Additionally, when breaking out of a check early isn't fully possible due to other validations in the same loop, skipping the redundant checks via `if (!matchFound)` prevents unnecessary string operations.
**Action:** Always extract invariant string concatenations outside of hot loops. When dealing with expensive string checks (like `endsWith` or regex) inside a loop that cannot break early, wrap the checks in an early-exit condition (e.g., `if (!matchFound)`) to minimize execution time on subsequent iterations.
## 2024-05-24 - Optimize escapeHTML with Regex check and manual loop
**Learning:** While chained `.replace()` calls can sometimes beat global regex + dictionary lookup, combining a fast non-global regex `.test()` to skip clean strings with a manual string builder loop using `substring()` is significantly faster for HTML escaping in V8 (2x faster for clean strings, 33% faster for dirty strings).
**Action:** When implementing frequent string escaping or sanitization functions on the hot path, benchmark against a manual loop that buffers slices with `substring()` instead of relying purely on regex replacements or array joins.
## 2024-08-08 - Optimize file extension checking using Regex
**Learning:** In V8, checking for file extensions (like `.html` and `.htm`) by chaining `.toLowerCase()` and `.endsWith()` causes unnecessary string allocations and is slower than a simple case-insensitive Regex test (`/\.html?$/i.test(string)`), which reduces operations and memory usage.
**Action:** Always prefer precompiled or literal case-insensitive Regex tests (e.g. `/\.ext$/i.test(str)`) over chaining `.toLowerCase()` and multiple `.endsWith()` checks in hot paths.
## 2024-08-09 - SHA-256 Hash String Concatenation Optimization
**Learning:** Converting a `Uint8Array` to a hex string using `Array.from(u8).map(...)` is significantly slower (by about 40%) in V8 than naive string concatenation (`+=`) because of callback overhead and array creation. However, both can be beaten by a wide margin (2x faster) by using a pre-allocated array (`const hex = new Array(u8.length)`), a standard `for` loop to look up pre-computed hex values, and finally calling `.join('')`. Always benchmark proposed "modern" JS array method alternatives against basic loops when on hot paths.
**Action:** When converting byte arrays to strings in hot paths, avoid `Array.from` and `.map`. Instead, use pre-allocated arrays, simple `for` loops, precomputed lookup tables, and `.join('')`.
## 2026-03-30 - Eliminate N+1 Promise.all batching in async request loops
**Learning:** Sequential batching within loops (e.g. `await Promise.all(chunk)` every N items) forces network requests to pause until each chunk resolves, introducing unnecessary latency serialization (N+1 queries).
**Action:** Fire promises synchronously in the collection loop and perform a single `await Promise.all()` on all gathered promises afterwards.
## 2026-03-31 - Add fast-path to levenshtein distance algorithm
**Learning:** The Levenshtein distance algorithm performs an expensive O(M*N) nested loop calculation. In use cases like domain typosquatting detection, many strings might be identical, forcing the algorithm to calculate the full matrix just to return 0. String equality checks (`a === b`) are highly optimized in V8 (often O(1) for identical string references or interned strings).
**Action:** Always add an early O(1) equality check (`if (a === b) return 0;`) before entering expensive distance calculation loops, as it eliminates unnecessary work on happy paths.

## 2026-04-01 - Align IP reputation lookup concurrency with URLhaus domain checks
**Learning:** While `checkURLhausDomains` executed all API lookup promises concurrently in a single `Promise.all()`, `checkIPReputation` artificially chunked requests in batches of 5. This created an asynchronous pipeline bottleneck, multiplying response latency by the number of chunks.
**Action:** Avoid artificial request chunking loops in extension background scripts when fetching endpoint reputations; collect all promises in a single array and resolve concurrently via `Promise.all()`.
## 2026-06-15 - Optimize DOM querying with CSS attribute selectors
**Learning:** When filtering DOM elements by attribute in frontend scripts, fetching all elements (e.g. `querySelectorAll('a')`) and filtering them in a JavaScript loop (e.g. `startsWith('http')`) is inefficient.
**Action:** Relying on the browser's native C++ DOM querying via CSS attribute selectors (e.g., `document.querySelectorAll('a[href^="http"]')`) is significantly faster. Always prefer native CSS selectors over JS loops when possible.
## 2026-06-25 - Fast-path regex avoids large string allocations
**Learning:** When evaluating large strings (like concatenated email subjects and bodies) for specific keywords using multiple steps or regexes that require a normalized (lowercased) string, unconditionally allocating the `.toLowerCase()` copy for every message is an expensive operation that dominates the happy-path (clean emails) processing time.
**Action:** Use a unified, case-insensitive `RegExp.test()` fast-path to quickly reject clean texts. Only perform the expensive `.toLowerCase()` allocation and detailed processing if the fast-path matches.
## 2024-10-07 - Optimize evaluateAuthHeaders
**Learning:** Adding a regex fast-path can actually make code slower if you still unconditionally allocate the string you were trying to avoid (e.g. `const headerStrLower = headerStr.toLowerCase();` in an `else` block). To properly optimize string parsing, you must avoid the allocation entirely on the happy path by using targeted regexes instead of lowercasing.
**Action:** When adding a fast path to avoid `.toLowerCase()`, ensure that *all* branches that follow (including `else` and subsequent non-failing conditions) also avoid calling `.toLowerCase()`. Use individual regexes (e.g., `/spf=pass/i`) for those checks.
## 2024-05-17 - Avoid string allocation for IP address parsing
**Learning:** When parsing delimited numbers (like IP addresses) in performance-critical hot paths, using `parseInt` on extracted substrings incurs hidden overhead from string allocation and coercion.
**Action:** Use a manual string iteration loop with `charCodeAt` (e.g., `val = val * 10 + (c - 48)`) to extract octets without allocating any intermediate string objects.
## 2024-10-10 - Fast-path Set lookup before Regex execution
**Learning:** When evaluating domains against a list of known brands using a Regex, parsing identical exact matches (like `paypal.com`) through the Regex engine is inefficient. Additionally, calling `.match()` on a string forces array allocation.
**Action:** Add an O(1) early return `Set.has()` check for exact matches before invoking the Regex engine, and use `.exec()` instead of `.match()` to avoid allocating full match arrays on a miss.
