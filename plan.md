1. **Fix API Error Handling in `api.js`**
   - Update the `catch` and `else` blocks in `get_hybrid_report_by_sha256` to use the correct strings ("Netzwerkfehler" and "API Error") and fix the `escapeHTML(error)` bug by passing `error.message`.
2. **Update `api.test.js`**
   - Add tests for `get_hybrid_report_by_sha256` error paths.
   - Implement a robust DOM mock that supports `innerHTML` (via getter/setter) and `insertAdjacentHTML` to properly capture injected strings.
   - Mock `fetch` to throw a proper `Error` object for network failures and return non-200 status codes for API errors.
3. **Verify tests**
   - Run `node --test api.test.js` to ensure tests pass and `api.js` functions as expected.
4. **Complete pre-commit steps**
   - Ensure the code follows memory rules (e.g. escaping HTML).
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
5. **Submit**
   - Create a PR with testing improvements.
