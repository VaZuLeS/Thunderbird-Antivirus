## 2026-05-10 - Save Button Feedback
**Learning:** Silent saves cause user confusion; visual confirmation is critical for async operations.
**Action:** Always add a temporary success message to save buttons.
## 2026-05-18 - Transient Message Testing
**Learning:** In the test suite, `setTimeout` is mocked to fire immediately `(cb, ms) => cb()`. When updating tests for UI elements that use `setTimeout` for transient states (like fading out a status message), assert against the final resolved state (e.g., `display: 'none'`) rather than the intermediate synchronous state.
**Action:** Always check how timers are mocked in the test setup before asserting on transient UI states.
