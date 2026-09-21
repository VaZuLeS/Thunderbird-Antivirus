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
## 2024-10-24 - Optimize evaluateBehavior by avoiding full string lowercasing
**Learning:** In Node.js/V8, when performing regular expression searches on massive strings, it is significantly faster and more memory-efficient to compile the RegExp with the case-insensitive (`i`) flag rather than allocating a huge new string via `.toLowerCase()` prior to matching.
**Action:** Always prefer compiling RegExp with the `i` flag over calling `.toLowerCase()` on the entire string when doing case-insensitive regex matching.
## 2024-10-24 - Remove redundant lowercasing on WHATWG URL properties
**Learning:** The `hostname` and `protocol` properties of a `URL` object natively return ASCII-lowercased strings according to the WHATWG standard. Calling `.toLowerCase()` on them is an anti-pattern that incurs unnecessary method invocation and string allocation overhead on hot paths.
**Action:** Never append `.toLowerCase()` to `URL.hostname` or `URL.protocol` when parsing URLs.
