## 2026-05-25: Unsafe innerHTML API

### Vulnerability
The `api.js` file used custom functions `setElementHtml` and `appendElementHtml` which directly assigned unfiltered inputs to `el.innerHTML` and `el.insertAdjacentHTML`. This exposed the application to severe Cross-Site Scripting (XSS) risks when displaying API responses, attachment names, or URL data.

### Learning
Automated remediation scripts (like `replace_inner_html.js` and `replace_render.js`) might exist in the repository to clean up known legacy issues, but when fixing the core logic, all callers dynamically passing strings (such as `renderManualUploadUI` and `renderReport`) must be individually updated to use `document.createElement` to properly build a DOM tree. Furthermore, updating the functions requires rigorous updates to Node.js `vm` testing mocks so they support `childNodes`, `outerHTML`, and inline `click()` listeners if the real DOM isn't present.

### Prevention
1. Never use `innerHTML` or `insertAdjacentHTML` with generic string inputs.
2. Always construct DOM hierarchies programmatically using `document.createElement` and `textContent`.
3. When refactoring UI code tested under a simulated Node context, update the `document.createElement` mock to correctly intercept `.id` assignments and `addEventListener` logic to ensure tests can find and interact with the newly secure elements.
