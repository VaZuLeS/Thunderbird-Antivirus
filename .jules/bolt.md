## 2024-05-24 - Attachment processing loop refactor
**Learning:** Sequential await loops over collections like email attachments block subsequent requests and increase processing time significantly in Manifest V3 extensions doing network IO. However, naively switching to `Promise.all` can cause race conditions when updating IndexedDB if multiple promises try to read/write the exact same DB record concurrently.
**Action:** When migrating sequential loops to concurrent `Promise.all` in background workers, also batch the resulting database writes into a single transaction to prevent race conditions during `readwrite` IndexedDB operations.

## 2024-05-18 - Optimized Levenshtein Distance Calculation Space Complexity
**Learning:** The Levenshtein distance algorithm implemented in `background.js` and `test_risk_score.js` originally used a 2D matrix, requiring O(m*n) space complexity, which is inefficient. Since the computation algorithm only relies on the current and immediate previous row to calculate distances, allocating a full matrix is an unnecessary memory bottleneck.
**Action:** Replaced the full O(m*n) matrix approach with an optimized O(n) array-based logic that only retains `currRow` and `prevRow`. This improved raw performance significantly (~5x speedup in benchmarks) and minimized memory allocations, aligning with the Bolt persona's focus on algorithmic efficiency.

## 2024-05-25 - Regex Precompilation in Threat Scoring Loop
**Learning:** Recompiling Regular Expressions (using `new RegExp()`) inside a loop or function that is called frequently (like `calculateThreatScore` analyzing email text for BEC urgency words) causes massive unnecessary processing overhead due to JIT compilation costs in V8.
**Action:** When filtering text against a known list of keywords dynamically using regex, precompile a single, global RegExp object containing all possible OR'd conditions, rather than creating a new `RegExp` per word on every function call. This reduced iteration time by ~3x in micro-benchmarks.

## 2024-05-26 - Early Exit in Expensive Distance Algorithms
**Learning:** Checking string edit distance (like Levenshtein) for typosquatting checks against a list of known brands in a loop (`calculateThreatScore`) is computationally expensive, especially for long URLs or domains where the edit distance is significantly higher than the allowed threshold.
**Action:** Added an early exit check `Math.abs(str1.length - str2.length) > threshold` before computing the Levenshtein distance. It is mathematically impossible for the edit distance to be less than or equal to the threshold if the difference in string lengths already exceeds that threshold. This optimization reduces the execution time of loops filtering for minor typosquatting variations from ~734ms to ~4ms for 10,000 iterations.

## 2024-05-27 - Precompiled Regular Expressions & Global Scope
**Learning:** Instantiating Regex objects (e.g. `/(https?:\/\/[^\s"'<>]+)/g`) inside frequently executed functions adds measurable overhead. Further, filtering text sequentially with a `.map()` over 14 distinct regexes takes ~3-4x longer than running a single OR'd regex `new RegExp('(word1|word2)', 'gi')`.
**Action:** When a regex is static, move it to the global scope (e.g., `GLOBAL_URL_REGEX`). When multiple related regexes search the same text, combine them into one OR'd precompiled expression. **Crucially**, when using `.exec()` on global regexes, you must reset `.lastIndex = 0` before the `while` loop to prevent state leakage across function calls.

## 2024-05-24 - [Levenshtein Distance Uint16Array Optimization]
**Learning:** In V8, standard Javascript arrays (`[]`) can be less performant than Typed Arrays (`Uint16Array`) when used for tightly scoped algorithmic calculations with predictable numerical values. Additionally, creating new arrays inside a hot loop (like O(N*M) edit distance matrixes) causes substantial garbage collection overhead.
**Action:** When working on numerical array algorithms like Levenshtein string distance, utilize statically typed arrays (e.g., `new Uint16Array()`) instead of standard arrays. Use array pooling by pre-allocating the arrays outside the hot loop and dynamically swapping their references (`let tmp = prevRow; prevRow = currRow; currRow = tmp;`) instead of instantiating new arrays (e.g., `let currRow = [i];`) per iteration. Furthermore, `.charCodeAt()` is marginally faster than `.charAt()` when iterating across strings.
