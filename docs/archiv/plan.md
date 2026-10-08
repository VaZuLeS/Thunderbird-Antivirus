1. **Understand the code health issue:**
   The function `renderManualUploadUI` in `api.js` is quite long because it contains logic for both rendering the initial DOM elements, conditionally adding CDR (Content Disarm and Reconstruction) buttons, handling innerHTML assignments which we want to avoid if possible, and configuring the click event listeners for `btnUpload` and `cdrBtn`.

2. **Assess Risk:**
   It is a core UI rendering function, so logic needs to remain equivalent. Extracting button rendering and event listener logic to a separate helper function will make it more concise. Also, there's a bug where `resultHtml += \`</div>\`;` is appended, and then `appendElementHtml('hybrid_analysis_api_content', resultHtml);` is called, but `resultHtml` is not defined anywhere in the function.

   Let's check the bug:
   ```javascript
    resultHtml += `
    </div>`;
    appendElementHtml('hybrid_analysis_api_content', resultHtml);
   ```
   Wait, `card` is a `HTMLDivElement` created dynamically. It seems the author mixed strings with DOM nodes. `appendElementHtml` handles nodes, so `appendElementHtml('hybrid_analysis_api_content', card);` should be used instead. We should fix that.

3. **Plan:**
   - Modify `renderManualUploadUI` to use DOM API correctly, replacing the `resultHtml += ...` with `document.getElementById('hybrid_analysis_api_content').appendChild(card);` or `appendElementHtml('hybrid_analysis_api_content', card);`.
   - Extract the logic that creates the upload and status paragraphs into helper functions or just shorten the function by extracting the button creation and event listener logic to helper functions:
     - `createUploadButtonUI(safeHash, hash, attachmentName, messageId, partName, headerMessageId)`
     - `createCdrButtonUI(safeHash, attachmentName, messageId, partName)`

4. **Implementation:**
   Modify `api.js` using `replace_with_git_merge_diff` to extract the UI rendering and bind logic for buttons into separate functions to shorten `renderManualUploadUI`. Run tests to ensure no regressions.
