## 2024-05-18 - Optimize delimited string parsing in options
**Learning:** In JavaScript, when parsing delimited strings, replacing a chained `.split().map().filter()` approach with a single-pass manual `while` loop using `indexOf()` and `substring()` significantly improves performance by avoiding the allocation of multiple intermediate arrays.
**Action:** When working on tight loops or performance-critical sections involving string splitting and array processing, prefer single-pass iteration with `indexOf` to avoid array allocations.
