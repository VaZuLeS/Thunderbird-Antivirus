## 2024-05-24 - URL extraction string scan redundancy
**Learning:** The URL extraction function ran two separate `indexOf` passes over the entire email body payload for both "http://" and "https://". On large nested threads, this redundant O(N) scanning causes unnecessary CPU spikes.
**Action:** Always scan for the common prefix (`http`) once using `indexOf`, then branch locally using `startsWith` to classify the exact scheme to save passes over large strings.
