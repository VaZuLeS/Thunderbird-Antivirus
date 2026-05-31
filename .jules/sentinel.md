## 2026-05-25: Unsafe innerHTML API

### Vulnerability
The `api.js` file used custom functions `setElementHtml` and `appendElementHtml` which directly assigned unfiltered inputs to `el.innerHTML` and `el.insertAdjacentHTML`. This exposed the application to severe Cross-Site Scripting (XSS) risks when displaying API responses, attachment names, or URL data.

## 2026-05-20 - Fix Blacklist Case Sensitivity Bypass
**Vulnerability:** The custom blacklist allowed malicious domains to bypass protection if the user entered uppercase letters in the configuration UI, due to a strict case-sensitive comparison against a lowercase sender domain.
**Learning:** Always normalize security configuration data (like blacklists and whitelists) to a consistent case (e.g., lowercase) during ingestion or evaluation to prevent trivial evasion.
**Prevention:** Apply `.toLowerCase()` universally when comparing user-defined rules against normalized incoming data.

## 2024-05-24 - Time-of-Click Bypass via DOM Attributes
**Vulnerability:** The `content_script.js` relied on checking a DOM attribute (`data-thundy-allowed="true"`) to bypass the Time-of-Click protection and allow users to open links. Attackers could add this attribute directly to malicious HTML email payloads, effectively bypassing the extension's visual and reputational checks.
**Learning:** Security state should never be stored in user-controlled contexts (like DOM attributes) where the attacker dictates the markup.
**Prevention:** Store security validation state in memory using constructs like `WeakSet` or `Set` that map directly to the DOM objects rather than relying on mutable string attributes.

## 2026-05-25: Unsafe innerHTML API (Continued)
**Vulnerability:** Additional `innerHTML` assignments in `api.js` (e.g. `pStatus.innerHTML`, `pThreat.innerHTML`) allowed unescaped HTML content insertion, maintaining a severe XSS vector despite earlier patches.
**Learning:** Code reviewers and security linters flag all usages of `innerHTML` as high-risk, even when developers attempt to manually escape some inputs, due to the high likelihood of missing an edge case.
**Prevention:** Establish a strict policy to completely avoid `innerHTML` and `insertAdjacentHTML`. Always use secure DOM methods like `document.createElement`, `document.createTextNode`, and `textContent` for constructing UI elements from dynamic or external data sources.

## 2026-05-31 - Fix Unhandled ReferenceError in UI rendering
**Vulnerability:** A duplicate, broken definition of `renderManualUploadUI` in `api.js` contained reference errors (`url` and `urlId` were undefined). If triggered, it would crash the UI rendering, potentially allowing denial-of-service in the email parsing or analysis context.
**Learning:** Duplicate, copy-pasted code segments can introduce hidden reference errors that manifest as crashes during execution. Always verify that variables used in string templates or DOM attribute assignments are properly scoped.
**Prevention:** Utilize linting and strict mode to catch undefined variables at build/lint time. Remove dead or duplicate code to prevent it from accidentally being invoked.
