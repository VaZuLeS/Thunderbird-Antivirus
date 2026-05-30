## 2024-05-30 - Required Form Fields and Helper Text Links
**Learning:** The primary API key field lacked visual distinction as a required field and its instructional text wasn't programmatically linked for screen readers. Using `aria-describedby` to link helper paragraphs and adding a visible `*` enhances both clarity and screen reader usability.
**Action:** Always verify that critical configuration inputs have explicit required indicators and that any preceding setup instructions are linked via `aria-describedby` during UX/accessibility reviews.

## 2024-05-20 - Explicit Form Label Association
**Learning:** Relying solely on implicit association (wrapping inputs inside `<label>` tags) is suboptimal for screen reader accessibility. Explicit association using the `for` attribute pointing to the input `id` guarantees better compatibility across various assistive technologies.
**Action:** Always verify and enforce explicit `for` attributes on form labels during UX/accessibility reviews.
## 2026-05-22 - Accessible Loading States for Buttons
**Learning:** During async UI actions, relying on  and  alone is insufficient for screen readers to recognize loading states. Explicitly toggling  allows assistive technologies to announce the element as currently busy.
**Action:** When creating async buttons in vanilla JS apps, toggle  alongside the disabled state and update UI element mocks in the test suite to avoid breaking tests when introducing /.
## 2024-05-20 - Accessible Loading States for Buttons
**Learning:** During async UI actions, relying on `disabled` and text changes alone is insufficient for screen readers. Explicitly toggling `aria-busy="true"` allows assistive technologies to announce the element as currently busy.
**Action:** When creating async buttons in vanilla JS apps, toggle `aria-busy` alongside the disabled state and update UI element mocks in the test suite to avoid breaking tests when introducing `setAttribute`/`removeAttribute`.
## 2024-05-18 - Explicit Label Associations
**Learning:** Implicit label association (wrapping inputs in labels) in this app's components caused slight layout difficulties and isn't optimal for screen readers. Extracting inputs to be adjacent to their labels with `for`/`id` linking works much better and is cleaner.
**Action:** Always verify if `options.html` forms are properly formatted with adjacent labels; if not, wrap the `<label>` and `<input>` pair in a layout container (like `.mb-3` here) rather than nesting them.
## 2026-05-26 - Accessible Loading States for Buttons
**Learning:** During async UI actions, relying on `disabled` and text changes alone is insufficient for screen readers. Explicitly toggling `aria-busy="true"` allows assistive technologies to announce the element as currently busy.
**Action:** When creating async buttons in vanilla JS apps, toggle `aria-busy` alongside the disabled state and update UI element mocks in the test suite to avoid breaking tests when introducing `setAttribute`/`removeAttribute`.
## 2026-05-29 - Accessible Error Messages with ARIA Alerts
**Learning:** Dynamically generated error or warning messages (e.g., using `div.className = 'alert-error'`) that are injected into the DOM after page load are often missed by screen readers unless they have a specific ARIA role. Using `role="alert"` ensures assistive technologies immediately interrupt and announce these critical messages to the user.
**Action:** When constructing UI error states manually via `document.createElement`, always ensure the parent container includes `.setAttribute('role', 'alert')` so all users are notified of API or configuration failures.
