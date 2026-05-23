## 2024-05-20 - Explicit Form Label Association
**Learning:** Relying solely on implicit association (wrapping inputs inside `<label>` tags) is suboptimal for screen reader accessibility. Explicit association using the `for` attribute pointing to the input `id` guarantees better compatibility across various assistive technologies.
**Action:** Always verify and enforce explicit `for` attributes on form labels during UX/accessibility reviews.
## 2025-05-23 - Added missing `aria-busy` states to async options buttons
**Learning:** For a11y, `disabled` is not enough for async buttons; screen readers need to know the button is in a loading state. `aria-busy="true"` solves this perfectly for the options page.
**Action:** Always add `aria-busy="true"` alongside `disabled="true"` when waiting for async operations like storage or cache clearing to complete.
