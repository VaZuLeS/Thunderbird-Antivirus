## 2024-05-24 - URL extraction string scan redundancy
**Learning:** The URL extraction function ran two separate `indexOf` passes over the entire email body payload for both "http://" and "https://". On large nested threads, this redundant O(N) scanning causes unnecessary CPU spikes.
**Action:** Always scan for the common prefix (`http`) once using `indexOf`, then branch locally using `startsWith` to classify the exact scheme to save passes over large strings.
## 2024-07-10 - Hex String Generation Performance
**Learning:** Using `Array.from(uint8array).map(...).join('')` for hex string conversion creates a significant performance overhead (~5x slower) due to intermediate array allocation and map iteration compared to a simple `for` loop string concatenation in V8.
**Action:** Use simple `for` loops for iterating over TypedArrays in performance-critical path for hex string creation instead of chained array methods.
