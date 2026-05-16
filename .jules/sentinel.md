## 2026-05-13 - Missing CDR function implementation
**Vulnerability:** The `disarmHTML` function was being invoked but not defined, breaking the Content Disarm and Reconstruction (CDR) feature.
**Learning:** Critical security functions can accidentally be dropped during refactors, causing features that users rely on for safety to fail silently or loudly but leaving them unprotected.
**Prevention:** Ensure robust test suites specifically check the definition and execution of core security functions, and do not ignore test suite failures.
## 2026-05-15 - Missing Input Sanitization in File System APIs
**Vulnerability:** The `handleDownloadDisarmed` function directly passed unsanitized user-provided attachment names to `browser.downloads.download()`, allowing for arbitrary Path Traversal (e.g. `../../../../`).
**Learning:** File system interaction APIs (such as saving downloads) do not inherently sanitize input filenames in browser extensions. If an external or untrusted source provides the filename, it must be explicitly stripped of directory traversal characters to prevent arbitrary file writes.
**Prevention:** Always extract the basename and sanitize special characters using regex (e.g. replacing `[^a-zA-Z0-9_\-\.]`) when an external source dictates a filename for the local file system.
