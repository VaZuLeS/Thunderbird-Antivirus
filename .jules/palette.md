## 2026-05-14 - Vanilla JS DOM Modal Accessibility
**Learning:** Custom DOM-injected overlay modals require manual focus management (e.g. focusing a safe cancel button) and explicit ARIA roles (`role="dialog"`, `aria-modal="true"`) to be screen reader and keyboard accessible, as vanilla JS lacks the built-in semantic wrappers often provided by modern component libraries.
**Action:** When creating raw JS overlays, ensure the safe/cancel action receives focus automatically upon injection and bind the appropriate `aria-labelledby` and `aria-describedby` IDs to the modal container.
## 2026-05-10 - External Links Feedback
**Learning:** External links that open in new tabs cause user disorientation and accessibility issues if not properly indicated.
**Action:** Always add visual indicators (`↗`) and semantic labels (`aria-label="..."`) to external links opening in a new tab to manage expectations for both sighted and screen reader users.
