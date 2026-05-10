1. **Modify `options.html`**
   - I will use `replace_with_git_merge_diff` to add an input field `<input type="text" id="virustotalApikey">` for the VirusTotal API key inside `options.html`.
   - I will verify the changes using `cat`.

2. **Modify `options.js`**
   - I will use `replace_with_git_merge_diff` to read and save `virustotalApikey` from `browser.storage.local` in `options.js`.
   - I will verify the changes using `cat`.

3. **Modify `background.js` to add `checkVirusTotal` function**
   - I will use `replace_with_git_merge_diff` to add `let apikey_virustotal;` and retrieve it from storage.
   - I will use `replace_with_git_merge_diff` to add a new function `checkVirusTotal(hash, apikey)` that calls the `GET https://www.virustotal.com/api/v3/files/{hash}` API.
   - I will verify the changes using `cat`.

4. **Modify `background.js` to run VT scan and save stats**
   - I will use `replace_with_git_merge_diff` to update `sent_to_hybrid_by_attachment` so that it calls `checkVirusTotal` as well, storing the returned stats in the result object.
   - I will use `replace_with_git_merge_diff` to update `indexedDB_save_batch_hybrid_data_to_db` (and `indexedDB_save_hybrid_data_to_db` if it's used to save manual uploads) to save `virustotal_stats` to the database. I have confirmed both are in `background.js`.
   - I will verify the changes using `cat`.

5. **Modify `api.js` to display VirusTotal stats**
   - I will use `replace_with_git_merge_diff` to update the `renderReport` function in `api.js` to display the VirusTotal stats if present.
   - I will verify the changes using `cat`.

6. **Update Tests**
   - I will modify `background.test.js` or create a new test file to mock `checkVirusTotal` and ensure `sent_to_hybrid_by_attachment` correctly processes VT API logic.
   - I will run tests using `node --test background.test.js api.test.js` to ensure no regressions were introduced.

7. **Pre-commit Steps**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

8. **Submit**
   - Submit the branch with all the changes.
