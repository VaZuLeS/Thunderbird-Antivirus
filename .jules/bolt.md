## 2024-05-20 - [Avoid .toLowerCase() in Regex Hot Loops]
**Learning:** Calling `.toLowerCase()` individually on captured regex match groups (`match[n].toLowerCase()`) inside a `while` loop parsing large text blocks (like email bodies) creates massive redundant memory allocations. Pre-converting the *entire* input string once before the loop reduces processing time for 10k iterations from ~395ms down to ~227ms (a ~42% speedup). Additionally, micro-optimizations like `Set.has()` vs `Array.includes()` for tiny arrays (e.g., 12 items) yield zero measurable benefit and should be ignored.
**Action:** Always pre-normalize (lowercase) large input strings *before* iterating over them with case-insensitive regular expressions, especially when the extracted groups need to be normalized downstream anyway.
## 2024-05-24 - [Avoid Array.map() inside Hot Loops]
**Learning:** Calling `.map(s => s.toLowerCase())` on dynamically sized arrays inside frequently called functions (like `checkLists` running for every link or email evaluation) introduces an O(N) array allocation overhead per call. Moving this `.map()` to occur only once during configuration loading avoids redundant allocations, significantly reducing GC pressure.
**Action:** Always pre-process configuration arrays (e.g. lowecase normalization) at initialization time rather than mapping them inline during hot evaluation paths.
## 2026-05-24

### 💡 What:
Replaced the fixed 2-second polling loop in `checkUrlscanIo` (`background.js`) with an exponential backoff loop.

### 🎯 Why:
The previous implementation made up to 15 rapid API requests over 30 seconds when waiting for URLScan results. Using exponential backoff (starting at 2s, increasing 1.5x up to 10s max) achieves the same 30-second timeout window while significantly reducing the number of requests to the URLScan API, preventing rate limits and saving bandwidth.

### 📊 Impact:
In the worst-case scenario (timeout), API requests are reduced from 15 to 6 (a 60% reduction in unnecessary API polling overhead).

### 🔬 Measurement:
A standalone benchmark script confirmed the reduction in loop iterations and total requests across varying response time limits. Verified functionality using the native test suite `node --test background.test.js`.
