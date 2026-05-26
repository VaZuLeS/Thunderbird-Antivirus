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
