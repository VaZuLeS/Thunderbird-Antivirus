## 2024-05-24 - Attachment processing loop refactor
**Learning:** Sequential await loops over collections like email attachments block subsequent requests and increase processing time significantly in Manifest V3 extensions doing network IO. However, naively switching to `Promise.all` can cause race conditions when updating IndexedDB if multiple promises try to read/write the exact same DB record concurrently.
**Action:** When migrating sequential loops to concurrent `Promise.all` in background workers, also batch the resulting database writes into a single transaction to prevent race conditions during `readwrite` IndexedDB operations.

## 2024-05-18 - Optimized Levenshtein Distance Calculation Space Complexity
**Learning:** The Levenshtein distance algorithm implemented in `background.js` and `test_risk_score.js` originally used a 2D matrix, requiring O(m*n) space complexity, which is inefficient. Since the computation algorithm only relies on the current and immediate previous row to calculate distances, allocating a full matrix is an unnecessary memory bottleneck.
**Action:** Replaced the full O(m*n) matrix approach with an optimized O(n) array-based logic that only retains `currRow` and `prevRow`. This improved raw performance significantly (~5x speedup in benchmarks) and minimized memory allocations, aligning with the Bolt persona's focus on algorithmic efficiency.

## 2024-05-25 - Regex Precompilation in Threat Scoring Loop
**Learning:** Recompiling Regular Expressions (using `new RegExp()`) inside a loop or function that is called frequently (like `calculateThreatScore` analyzing email text for BEC urgency words) causes massive unnecessary processing overhead due to JIT compilation costs in V8.
**Action:** When filtering text against a known list of keywords dynamically using regex, precompile a single, global RegExp object containing all possible OR'd conditions, rather than creating a new `RegExp` per word on every function call. This reduced iteration time by ~3x in micro-benchmarks.
