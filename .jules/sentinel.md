## 2026-05-13 - Missing CDR function implementation
**Vulnerability:** The `disarmHTML` function was being invoked but not defined, breaking the Content Disarm and Reconstruction (CDR) feature.
**Learning:** Critical security functions can accidentally be dropped during refactors, causing features that users rely on for safety to fail silently or loudly but leaving them unprotected.
**Prevention:** Ensure robust test suites specifically check the definition and execution of core security functions, and do not ignore test suite failures.
##  2026-05-16  - Fix exposed API Keys
**Vulnerability:** API keys in `options.html` were visible in plain text due to using `type="text"`.
**Learning:** For UI elements handling sensitive data like API keys always use `<input type="password">` rather than `<input type="text">` to prevent visual exposure and shoulder surfing.
**Prevention:** Always use `type="password"` for sensitive inputs.
