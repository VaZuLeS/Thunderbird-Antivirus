1. Modify `levenshteinDistance` in `background.js` to allocate the buffers globally.
2. The current code re-allocates two `Uint16Array(a.length + 1)` buffers on every call to `levenshteinDistance`. Since this function is called in a nested loop (for each domain and for each known brand), this creates massive garbage collection overhead.
3. We will declare `let lev_prevRow = new Uint16Array(64); let lev_currRow = new Uint16Array(64);` outside the function. Inside the function, we'll ensure they are large enough, expanding them if `a.length + 1 > lev_prevRow.length`.
4. We will run tests to verify that `levenshteinDistance` continues to work properly and the code doesn't introduce any cross-test/concurrency issues (since it's a synchronous extension background script, single-threaded execution is guaranteed for this synchronous block).
5. Add a journal entry in `.jules/bolt.md`.
6. Complete pre commit steps to make sure proper testing, verifications, reviews and reflections are done.
7. Submit the PR.
