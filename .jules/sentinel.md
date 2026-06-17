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

## 2026-06-03 - Unhandled URI Schemes in Time-of-Click Protection Bypass
**Vulnerability:** In `content_script.js`, the Time-of-Click protection check for links only intercepts HTTP and HTTPS URLs. Links using alternative schemes supported by Thunderbird (like `file:`, `ftp:`, `smb:`, or `mailto:`) bypass the warning mechanisms, allowing potentially malicious local or network links to be opened without inspection.
**Learning:** Only intercepting known safe protocols allows attackers to pivot to unexpected vectors that native desktop applications support.
**Prevention:** If a security mechanism cannot validate a URI scheme, it should fail closed (block the click) rather than failing open (allowing the unhandled protocol to execute). Ensure default actions are prevented for unhandled protocols.

## 2026-06-08 - Insecure Sensitive API Key Input Configuration
**Vulnerability:** The API key configuration inputs in `options.html` were implemented as standard `<input type="password">` fields without bounding constraints or autocomplete directives. This could allow resource exhaustion (Denial of Service) via excessively large string injections and inadvertently permit browser password managers to cache and expose sensitive API tokens.
**Learning:** Browser autofill and unbounded inputs pose secondary risks for high-privilege secrets that shouldn't be managed like standard passwords.
**Prevention:** Always explicitly define `maxlength` bounds (e.g., `255`) and apply `autocomplete="off"` to sensitive configuration inputs (like API keys and tokens) to enforce limits and prevent unauthorized local caching.

## 2026-06-15 - Spelljacking Risk in Configuration Fields
**Vulnerability:** The custom blacklist and whitelist configuration textareas in `options.html` were susceptible to spelljacking. Browser spellcheck mechanisms can send the contents of these fields to third-party servers, potentially leaking sensitive user data or internal network structures.
**Learning:** Browser spellcheck poses a subtle data leakage vector for user-defined configuration fields containing sensitive PII or network information.
**Prevention:** Explicitly add `spellcheck="false"` to textareas or inputs intended for sensitive configurations to prevent unauthorized data transmission to spellcheck dictionary providers.

## 2026-06-25 - XSS Filter Evasion via Ignored URL Characters
**Vulnerability:** The `disarmHTML` sanitization function attempted to block dangerous URIs (like `javascript:`) by stripping control characters `[\x00-\x1F\x7F-\x9F]` before matching. However, standard spaces (`\x20`) and the Unicode replacement character (`\uFFFD`, often generated by decoding null bytes `&#x00;`) are ignored by browser URL parsers but were not stripped by the filter. Attackers could evade the `startsWith` check using payloads like `java&#x00;script:alert(1)`.
**Learning:** Browser URL parsing is highly fault-tolerant and ignores certain characters (like tabs, newlines, spaces, and replacement characters) when evaluating schemas. Sanitization filters must accurately strip *all* characters the browser ignores before validating URIs.
**Prevention:** Aggressively strip spaces (`\x20`) and replacement characters (`\uFFFD`) alongside control characters during attribute sanitization before performing explicit blocklist checks.
