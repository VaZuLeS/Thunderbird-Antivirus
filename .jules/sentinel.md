## 2026-05-13 - Missing CDR function implementation
**Vulnerability:** The `disarmHTML` function was being invoked but not defined, breaking the Content Disarm and Reconstruction (CDR) feature.
**Learning:** Critical security functions can accidentally be dropped during refactors, causing features that users rely on for safety to fail silently or loudly but leaving them unprotected.
**Prevention:** Ensure robust test suites specifically check the definition and execution of core security functions, and do not ignore test suite failures.
##  2026-05-16  - Fix exposed API Keys
**Vulnerability:** API keys in `options.html` were visible in plain text due to using `type="text"`.
**Learning:** For UI elements handling sensitive data like API keys always use `<input type="password">` rather than `<input type="text">` to prevent visual exposure and shoulder surfing.
**Prevention:** Always use `type="password"` for sensitive inputs.

## Cross-Site Scripting (XSS) via `insertAdjacentHTML`
When taking input and embedding it into the DOM, methods that parse raw HTML strings such as `insertAdjacentHTML` or `innerHTML` pose significant XSS risks. Even if developers attempt to escape the input via utility functions like `escapeHTML()`, edge cases or missed escaping calls can result in vulnerability.

In `api.js`, the functions `renderManualUrlScanUI` and `renderManualUploadUI` were vulnerable due to string concatenation with variables (derived from untrusted email data or APIs) being injected directly into the DOM using `insertAdjacentHTML('beforeend', resultHtml)`.

### The Fix
To eliminate this risk completely, DOM creation was refactored from string templates to programmatic element creation using `document.createElement()`.
- Textual data is set safely via the `.textContent` property, which automatically encodes any special HTML characters and neutralizes injection vectors.
- Class names, IDs, and attributes are set individually on the DOM object.
- The use of `insertAdjacentHTML` has been removed in these functions, meeting Mozilla AMO security guidelines and eliminating the XSS vector entirely.

This pattern is highly recommended for building DOM components in a vanilla JS context where security is critical, especially when handling arbitrary strings.
