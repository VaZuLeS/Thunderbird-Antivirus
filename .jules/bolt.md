## 2024-05-24

### Observation
Repeatedly querying the local Thunderbird email database using `browser.messages.query` for the same recipient in the `tab_mail_open_display` hook is inefficient and adds redundant I/O overhead.

### Action
Introduced a `Set` (`knownSendersCache`) in `background.js` to memorize the `senderEmail` after a successful database query confirms prior communication. Future emails from the same sender skip the database query entirely.

### Prevention / Guidelines
When dealing with repeated I/O operations inside frequently invoked event hooks (like opening an email), cache the results for known positive states using a simple structure like a `Set`. Use a bounded size (e.g., clearing at 1000 items) to prevent memory leaks while maintaining an O(1) fast path.

## 2024-05-25 - DOM Traversal Optimization
**Learning:** In `disarmHTML`, traversing the DOM twice—once with a `TreeWalker` for event handlers, and then again using `querySelectorAll` for dangerous attributes—creates a massive performance overhead (O(N*M)).
**Action:** Always merge subsequent DOM attribute or tag checks into a single `TreeWalker` pass whenever possible to eliminate redundant DOM parsing and layout calculation overhead.

## 2024-05-26 - Optimized DOM active tag removal with querySelectorAll
**Learning:** In the HTML sanitization loop (`disarmHTML`), iterating over an array of tag names to call `getElementsByTagName` creates a massive performance bottleneck on large HTML payloads. `getElementsByTagName` returns live `HTMLCollection` objects, and repeatedly calling it forces the browser engine to traverse the DOM repeatedly.
**Action:** Replace sequential `getElementsByTagName` iterations with a single `querySelectorAll('tag1, tag2, ...')` call. `querySelectorAll` returns a static `NodeList` and traverses the document exactly once in native engine code, turning O(K*N) traversals into a highly optimized O(N) operation.

## 2024-05-27 - Merged DOM traversals for sanitization
**Learning:** Using `querySelectorAll` to find and remove specific tags, followed by a `TreeWalker` pass to sanitize attributes, still traverses the DOM twice.
**Action:** When performing multiple DOM checks or mutations (like removing tags and sanitizing attributes), merge them into a single `TreeWalker` pass. Check the `tagName` first against a precompiled `Set`, collect nodes for removal, and sanitize attributes on the rest. This eliminates a redundant full-tree traversal.

## 2026-05-31 - Fast Byte to Hex String Conversion
**Learning:** Using `Array.from(uint8array).map(b => b.toString(16).padStart(2, '0')).join('')` for generating hex strings (like SHA-256 hashes or IDs) creates a significant performance overhead and unnecessary garbage collection pressure due to mapping over an array and creating new string segments.
**Action:** Use a precompiled hexadecimal Look Up Table (LUT) with a standard string concatenation `for` loop (`for (let j = 0; j < u8.length; j++) hex += byteToHex[u8[j]];`) to drastically improve string generation performance and avoid `Array.from()` memory allocations.

**Learning:** Using `.replace(/[&<>"']/g, function(match) { return map[match]; })` with a new `map` object declared inside the callback causes unnecessary memory allocations and puts pressure on the garbage collector in hot paths like `escapeHTML`.
**Action:** Replace regex function callbacks with either a pre-allocated static mapping object outside the function scope, or use a series of chained `.replace()` calls. Chained replace operations (e.g., `.replace(/&/g, '&amp;').replace(/</g, '&lt;')`) are highly optimized by the V8 engine and avoid per-match allocations, leading to measurable performance improvements (e.g., ~20% faster).

## 2024-05-32 - Move Set initializations outside function scopes
**Learning:** Initializing a `Set` inside a frequently called function (like `disarmHTML`) to use `Set.has()` for fast lookups incurs significant memory allocation overhead on every invocation. This negates the O(1) lookup speed advantage and causes high garbage collection pressure.
**Action:** Always move static `Set` initializations to the module scope. This guarantees they are allocated only once while keeping the fast O(1) lookups in the hot path.

## 2024-06-04 - True Array Pooling
**Learning:** Re-allocating typed arrays (`new Uint16Array()`) inside a frequently called function (like `levenshteinDistance` in a loop) creates massive garbage collection overhead, even if intended for "array pooling". True pooling requires the buffers to be allocated *outside* the function scope.
**Action:** Move typed array buffer allocations to the module/global level and reuse them by reference inside hot-path functions, dynamically expanding them only when the required size exceeds the pooled buffer size.

## 2024-05-24
* **Learning:** When processing multiple items sequentially (e.g., extracting domains and calling an external API like URLhaus for each), redundant calls to the same API endpoint for identical items can cause significant performance bottlenecks and network overhead.
* **Action:** Implement a bounded, module-level in-memory cache (like `Map`) with a reasonable maximum size to store previous API responses. Before invoking the API, check the cache. If the maximum size is reached, evict the oldest entry using `.keys().next().value` to maintain O(1) time complexity while preventing unbounded memory growth.

## 2024-06-10 - String indexOf instead of split/map for performance
**Learning:** Using `.split('.').map(Number)` to parse IP addresses or other delimited strings inside a tight loop allocates multiple temporary arrays per execution, causing significant memory pressure and GC pauses.
**Action:** Replace `.split('.').map()` with direct string operations like `indexOf()` and `substring()` combined with `parseInt()`. This avoids temporary array allocations and is much faster for simple delimited string parsing.
## 2024-10-27 - Regex Engine vs. Manual string loops
**Learning:** V8's regex engine (Irregexp) is highly optimized for multiple string searches using patterns like `(word1|word2)`. Attempting to manually reimplement this with an outer loop over words and an inner loop with `indexOf()` turns an `O(L)` operation into `O(L*W)`, heavily degrading performance and causing GC issues by forcing closure allocations in hot loops.
**Action:** Do not attempt to manualize complex compiled regular expressions with native loops. Native string loops are only faster for very specific, single-operation micro-tasks (like stripping a few trailing characters). For compound searching, let the regex engine do its job.

## 2024-10-27 - Micro-allocations in Hot Paths
**Learning:** Creating temporary objects like `new Set()` and converting them back to arrays using `Array.from()` inside a function called in a hot loop (like parsing every megabyte of a message body) adds unnecessary allocation overhead and GC churn.
**Action:** When deduplicating a very small, known upper-bound set of results (like 14 fixed urgency words), it is faster to use a plain Array and check `.indexOf(item) === -1` before pushing, avoiding the Set allocation entirely.

## 2024-11-20 - Custom URL Parsing Pitfalls
**Learning:** Attempting to optimize `new URL(url).hostname` by manually slicing strings (e.g. using `indexOf('/')`, `indexOf('?')`) in a hot loop is highly error-prone. Simple implementations often break on valid URLs like `http://example.com?query/path` because they find the first slash regardless of whether it's in the path or query string.
**Action:** When extracting hostnames for performance, prefer a simple, precompiled regex (like `/^(?:https?:\/\/)([^\/\?#]+)/i`) that correctly handles the basic syntax structure. Check the resulting match for edge cases (like `@` for auth, `:` for ports/IPv6) and fallback to the robust native `new URL()` parser only when necessary.
