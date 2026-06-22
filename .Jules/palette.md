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

## 2024-06-03 - Disabling Irrelevant Form Inputs
**Learning:** Displaying form inputs that are irrelevant based on other selections (e.g., an API key input when the provider is set to "Deaktiviert") causes user confusion.
**Action:** Always dynamically disable irrelevant form inputs based on preceding select choices. Additionally, update the `title` and `placeholder` of the disabled input, and set `aria-disabled="true"` to explicitly convey the disabled context to assistive technologies.

## 2024-06-04 - Confirm Destructive Actions
**Learning:** The 'Clear Cache' button executed immediately upon clicking, which could lead to accidental loss of data (e.g. analysis results). Providing a native confirmation dialog before performing such destructive actions prevents unintended consequences and creates a safer user experience.
**Action:** Always add a confirmation step (like `confirm()`) before executing destructive actions, such as clearing caches, deleting items, or submitting unrecoverable state changes.

## 2026-06-07 - Redundant ARIA Disabled Attribute
**Learning:** Adding `aria-disabled="true"` to standard HTML input elements (like text inputs) that already use the native `disabled` attribute is redundant and unnecessary. The native `disabled` attribute already conveys the disabled state to assistive technologies automatically.
**Action:** Always rely solely on the native `disabled` attribute for standard HTML form elements to indicate disabled state, avoiding redundant ARIA attributes that clutter the DOM without providing additional accessibility value.
## 2024-06-09 - ARIA Describedby for Helper Texts
**Learning:** Textareas with placeholder text or `select` dropdowns with adjacent paragraph instructions often lack programmatic linkage. Relying on placeholders or adjacent text alone means screen reader users won't hear the instructions when they focus the input.
**Action:** Always wrap detailed setup instructions or helper text in a `<small>` or `<p>` element with a unique `id`, and explicitly link it to the corresponding `<input>`, `<textarea>`, or `<select>` element using `aria-describedby` so screen readers announce the helper text upon focus.
## 2024-06-12 - Disabling Spellcheck on Technical Inputs
**Learning:** Textareas used for technical configuration, such as domain whitelists and blacklists, trigger distracting red squiggly lines for valid entries when browser spellchecking is enabled. Furthermore, leaving spellcheck enabled on these fields risks leaking sensitive internal domain data or user emails to third-party dictionaries used by the browser.
**Action:** Always explicitly add `spellcheck="false"` to HTML inputs and textareas used for technical or security configurations to improve the visual experience and protect sensitive data.
## 2024-06-13 - Dynamic Form Disabling Based on Checkboxes
**Learning:** In configuration forms, displaying form inputs (like `select` options or related `checkboxes`) that are rendered functionally irrelevant by the activation of a primary setting (like "Immer manuell scannen" or "Auto-Scan") can cause user confusion regarding what settings are actively applying.
**Action:** Always dynamically toggle the `disabled` state of irrelevant form inputs based on related checkbox toggles using `change` event listeners, and update their `title` attributes to explicitly explain their deactivated state.

## 2024-06-15 - Visual Cues for Disabled Form Inputs
**Learning:** While buttons typically have obvious disabled states defined in CSS (`opacity`, `cursor: not-allowed`), other form inputs (`input`, `select`, `textarea`) that are dynamically disabled by JS logic (e.g. when an overriding checkbox is activated) lack these visual cues if omitted from the design system. This leads to user confusion as the inputs appear interactive but are unresponsive.
**Action:** Always verify that the design system (`theme.css`) includes `:disabled` state styles for all standard form input types alongside buttons, ensuring users receive consistent visual feedback when interactive elements are disabled.
## 2026-06-25 - Direct Action in Error States
**Learning:** When displaying an error message about a missing configuration (like an API key), requiring the user to manually navigate menus to find the settings page adds unnecessary friction. Adding a direct action button to open the settings resolves this immediately.
**Action:** When creating empty or error states related to missing configuration, always include a direct call-to-action button using `browser.runtime.openOptionsPage()` to guide the user straight to the solution.
## 2026-06-25 - Contextual Placeholders in Configuration Inputs
**Learning:** Empty password or configuration inputs with generic or no placeholders force users to consult documentation to understand the expected format (e.g., whether to enter a 16-character hex string or a UUID). Providing an explicit, contextual example in the placeholder (like `placeholder="z.B. abcdef123456..."`) significantly reduces friction and prevents formatting errors.
**Action:** When adding or reviewing configuration inputs (especially API keys or domain lists), ensure they have contextual `placeholder` attributes that demonstrate the exact expected format.
## 2026-06-25 - ARIA Status Role on Empty State Cards
**Learning:** Dynamically generated "empty state" cards (e.g. indicating no attachments or analysis results were found) injected into the DOM after an asynchronous operation are not automatically announced by screen readers. This leaves visually impaired users unaware that an operation has completed with no results.
**Action:** When generating dynamic empty state cards or informational containers post-load, always add `role="status"` or `aria-live="polite"` so screen readers proactively announce these critical updates.
