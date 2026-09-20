## 2024-09-20 - Optimize URL parsing loops
**Learning:** Calling functions within hot loops adds measurable overhead. Checking cache maps inline, avoiding redundant `.toLowerCase()` calls on URLs (as the `hostname` property natively lowercases), and using indexed loops over array iterators yields performance benefits.
**Action:** Apply inline cache lookups and indexed loops in hot paths where repetitive processing occurs.
