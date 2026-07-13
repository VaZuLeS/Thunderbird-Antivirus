## 2024-05-24 - URL extraction string scan redundancy
**Learning:** The URL extraction function ran two separate `indexOf` passes over the entire email body payload for both "http://" and "https://". On large nested threads, this redundant O(N) scanning causes unnecessary CPU spikes.
**Action:** Always scan for the common prefix (`http`) once using `indexOf`, then branch locally using `startsWith` to classify the exact scheme to save passes over large strings.

## 2024-05-25 - Extract Text Object Reassignment
**Learning:** The recursive `extractTextFromParts` function concatenated email body text into an array and used `join` at the end. However, `Array.push` and `Array.join` incurs a lot of intermediate allocations during deep recursive calls for long strings. Passing an accumulator object (`{ text: "" }`) and using simple string concatenation (`+=`) is roughly 81% faster in a benchmark, since modern V8 optimizes string concatenation very effectively.
**Action:** Use an accumulator object with string concatenation (`+=`) for recursive text building instead of arrays when the length or depth is potentially large to avoid intermediate array allocations.
## 2024-07-13 - Optimize URL lookup string operations in checkLinkState
**Learning:** To optimize loop comparisons against string variants (e.g., a URL with or without a trailing slash), pre-calculating all acceptable variant strings outside the loop and using strict equality (`===`) checks inside avoids expensive string manipulations (like `endsWith` or `slice`) on every iteration.
**Action:** When asked to normalize strings inside a loop for comparison, always look for opportunities to pre-compute the target variants outside the loop to keep the loop operations as lightweight as possible.
