## 2026-05-10 - Save Button Feedback
**Learning:** Silent saves cause user confusion; visual confirmation is critical for async operations.
**Action:** Always add a temporary success message to save buttons.
## 2026-05-19 - Transient Status Messages
**Learning:** For asynchronous operations (like clearing cache), leaving success messages displayed indefinitely can cause user confusion as it becomes unclear if a subsequent action triggered a new save or if it's lingering.
**Action:** Always wrap status messages for async actions in a `setTimeout` (e.g., 3000ms) to provide transient, auto-dismissing visual feedback.
