1. **Understand the Testing Gap**:
   - The issue requests tests for the `processAndUploadUrls` function in `background.js`. This function handles uploading URLs to Hybrid Analysis if the `privacyTier` is set to 'max', or otherwise just saves them locally using `indexedDB_save_links_to_db`.

2. **Design the Test Strategy**:
   - Test framework: `node:test` with assertions from `node:assert`.
   - Add `globalThis.processAndUploadUrls = processAndUploadUrls;` to the `vm.runInContext` evaluation script in `background.test.js`.
   - Add a describe block `describe('processAndUploadUrls', ...)` in `background.test.js`.
   - Scenarios to test:
     1. When `privacyTier` is not 'max' (e.g. 'balanced'): it calls `indexedDB_save_links_to_db` and NOT `indexedDB_save_links_objects_to_db`.
     2. When `privacyTier` is 'max' and `fetch` succeeds (status 200): it calls `indexedDB_save_links_objects_to_db` with the correct state 'UPLOADED', job_id, etc.
     3. When `privacyTier` is 'max' and `fetch` fails (status 500): it falls back to 'UNKNOWN' state.
     4. When `privacyTier` is 'max' and `fetch` throws an error: it catches the error and falls back to 'UNKNOWN' state.

3. **Implementation Details**:
   - Use `replace_with_git_merge_diff` to modify `background.test.js`.
   - Update `vm.runInContext` setup block to expose `processAndUploadUrls`.
   - Mocking involves setting functions on `context`:
     - `context.set_privacyTier('max')` or `'balanced'`
     - Mock `context.indexedDB_save_links_to_db`
     - Mock `context.indexedDB_save_links_objects_to_db`
     - Mock `context.fetch`
     - Mock `context.getHybridAnalysisOptions` to return an object (so it won't crash)

4. **Execution**:
   - Apply edits to `background.test.js`.
   - Temporarily break `processAndUploadUrls` in `background.js` (e.g. return early) using `replace_with_git_merge_diff` and run the specific test with `run_in_bash_session` (`NODE_PATH=node_modules node --test background.test.js --test-name-pattern="processAndUploadUrls"`) to verify the test fails and catches the bug.
   - Revert the break in `background.js`.
   - Run full test suite with `NODE_PATH=node_modules node --test` using `run_in_bash_session`.
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done using `run_in_bash_session` to call `pre_commit_instructions` or directly.
   - Submit PR with `submit` tool using the exact title format requested ("🧪 [testing improvement description]").
