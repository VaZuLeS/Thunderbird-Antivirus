Reviewer Notes for Thunderbird Add-on Store

Purpose
- This document explains permission rationale, data flows, and privacy guarantees for store reviewers.

Permissions
- messagesRead: required to access opened messages for per-message scanning (used only when user interacts or opts in).
- scripting: used to inject non-persistent UI banners into the message view (no remote code execution).
- storage: store per-account and per-sender opt-in flags and user settings.
- optional host permission(s) (e.g., https://hybrid-analysis.com/*): requested at runtime only when the user initiates an upload (per-message Opt‑In or explicit option).

Opt-In model
- Real-time scanning is disabled by default. The user must opt in at either:
  - Extension settings (global per-account enable), or
  - Per-message inline banner (offers one-off scanning and optional persistent opt-in for the sender).
- When the runtime host permission is requested, the prompt clearly indicates the host domain and that data may be uploaded for analysis.

Data sent to external services
- Default behavior: do not send full message bodies or attachments without user consent.
- If configured to upload, we prefer sending hashed representations (SHA-256) of attachments when possible, and only upload the minimal data required by the analysis provider.
- The privacy policy lists exactly which fields may be transmitted (hashes, filenames, metadata) and under which circumstances.

Retention and deletion
- Any data sent to external services is retained according to the provider's policy; the extension does not retain copies of uploaded content unless the user explicitly requests local storage.
- The extension stores only opt-in flags and minimal scan metadata (timestamp, verdict) locally. No PII is stored beyond what Thunderbird already stores for messages.

Security controls
- All external requests use HTTPS/TLS.
- API keys are stored in browser.storage.local (not in repo). Instructions provided for CI secrets and deploy-time configuration.
- Host permissions are optional and requested at runtime.

Contact & placeholders
- Responsible organization: VaZuLeS (placeholder)
- Support: support@yourdomain.example (please replace before publishing)

Notes for reviewers
- Privacy policy URL: docs/privacy_policy.md (include full hosted URL in store listing)
- Reviewer can test runtime permission flow by opening a message with attachments and clicking the inline "Für diese Nachricht scannen" button.

--
Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>