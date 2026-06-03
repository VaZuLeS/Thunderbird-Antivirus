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
## 2024-05-31 - Accessible Required Form Elements and Instructions
**Learning:** Adding a visual `*` (wrapped in `aria-hidden="true"`) helps sighted users quickly identify required fields, while explicit `required` and `aria-describedby` attributes ensure screen readers announce the requirement and the associated setup instructions context immediately.
**Action:** Always link complex setup instruction paragraphs directly to their corresponding input using `aria-describedby` and a unique wrapper ID so screen reader users aren't forced to navigate away to understand what is expected.
## 2024-06-01 - Keyboard Accessibility for Modals/Dialogs
**Learning:** When custom modals or dialogs are opened, they trap focus. For true keyboard accessibility (following WCAG guidelines), it's essential that users can dismiss these dialogs using the `Escape` key and that the focus is subsequently restored to the element that triggered the modal (e.g., the clicked link).
**Action:** Always implement a `keydown` listener for the `Escape` key on custom modals, and store a reference to the triggering element so focus can be programmatically returned via `.focus()` upon dismissal.

## 2024-06-02 - Custom Focus Rings on Links
**Learning:** In this project's design system (`theme.css`), custom `:focus-visible` styles with enhanced offsets and colors were applied to form inputs and buttons, but standard link elements (`<a>`) were omitted. This omission caused links to fall back to less visible browser default focus rings, creating an inconsistent keyboard navigation experience across the extension.
**Action:** When defining custom focus ring styles (`outline`, `outline-offset`) for interactive elements in the design system, always explicitly include `a:focus-visible` to ensure a consistent and highly visible focus state for all tab-navigable elements.
