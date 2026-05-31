2024-05-24
Learning: When converting array lookup loops to `Set.has()` to improve performance in frequently called functions, always initialize the `Set` outside the function scope. Initializing the `Set` inside the function incurs repeated memory allocation overhead that can actually decrease performance compared to V8's highly optimized small array loops.
Action: Initialized the `dangerousAttributes` Set in the top-level scope of `background.js` rather than repeatedly allocating it inside `disarmHTML`.
