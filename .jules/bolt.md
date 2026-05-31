2024-05-24
Learning: When converting array lookup loops to `Set.has()` to improve performance in frequently called functions, always initialize the `Set` outside the function scope. Initializing the `Set` inside the function incurs repeated memory allocation overhead that can actually decrease performance compared to V8's highly optimized small array loops.
Action: Initialized the `dangerousAttributes` Set in the top-level scope of `background.js` rather than repeatedly allocating it inside `disarmHTML`.
2024-05-31
Learning: When evaluating the loop for HTTP requests to external APIs (like Hybrid Analysis for multiple links), parallelizing requests via Promise.all() over sequential await provides a significant latency reduction. A benchmark simulated 10 requests at 100ms each, demonstrating a 90% latency drop (1000ms -> 100ms) with concurrent fetching. It was verified that api.js:115 already uses this optimization.
Action: Verified the concurrent execution of link report fetching in api.js and confirmed no further structural change is needed.
