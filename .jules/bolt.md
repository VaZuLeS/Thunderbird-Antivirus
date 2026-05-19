## 2025-05-19 - Case-Insensitive Regex Extract Optimizations
**Learning:** When removing a global string `.toLowerCase()` pass before a case-insensitive regex evaluation (to save O(N) memory allocation on large text blocks), the matched capture groups themselves will retain their original mixed casing. This can silently break downstream logic like `Set` deduplication or strict equality checks.
**Action:** Always ensure that extracted regex capture groups (`match[n]`) are explicitly `.toLowerCase()`'d individually after extraction if the subsequent application logic expects normalized casing.
