1. **Identify Bottleneck:** The `evaluateBehavior` function calls `toLowerCase()` on individual regex match groups *inside* a `while` loop over a potentially large text string, creating unnecessary string allocations during a hot loop.
2. **Optimize Regex Logic:** Modify the `evaluateBehavior` function in `background.js`. Pre-convert the input `textToAnalyze` to lower case *once* before the loop, and update the regex loop to avoid redundant case conversions, ensuring `Set` deduplication correctly receives normalized strings without per-iteration memory hits. Add a comment documenting the performance impact.
3. Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.
4. **Verify Tests:** Run `node --test` to ensure the logic remains correct.
5. **Submit PR:** Submit the optimized branch.
