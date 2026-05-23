## 2024-05-20 - Explicit Form Label Association
**Learning:** Relying solely on implicit association (wrapping inputs inside `<label>` tags) is suboptimal for screen reader accessibility. Explicit association using the `for` attribute pointing to the input `id` guarantees better compatibility across various assistive technologies.
**Action:** Always verify and enforce explicit `for` attributes on form labels during UX/accessibility reviews.
## 2026-05-22 - Accessible Loading States for Buttons
**Learning:** During async UI actions, relying on  and  alone is insufficient for screen readers to recognize loading states. Explicitly toggling  allows assistive technologies to announce the element as currently busy.
**Action:** When creating async buttons in vanilla JS apps, toggle  alongside the disabled state and update UI element mocks in the test suite to avoid breaking tests when introducing /.
## 2024-05-20 - Accessible Loading States for Buttons
**Learning:** During async UI actions, relying on `disabled` and text changes alone is insufficient for screen readers. Explicitly toggling `aria-busy="true"` allows assistive technologies to announce the element as currently busy.
**Action:** When creating async buttons in vanilla JS apps, toggle `aria-busy` alongside the disabled state and update UI element mocks in the test suite to avoid breaking tests when introducing `setAttribute`/`removeAttribute`.
