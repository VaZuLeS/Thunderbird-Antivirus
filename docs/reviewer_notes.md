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
- Responsible organization: VaZuLeS (Jan Bludau)
- Support: bludau.it.services@gmail.com

Notes for reviewers
- Privacy policy URL: docs/privacy_policy.md (include full hosted URL in store listing)
- Reviewer can test runtime permission flow by opening a message with attachments and clicking the inline "Für diese Nachricht scannen" button.

gecko.data_collection_permissions (manifest explanation)
- required: ["none"] — the extension does not require automatic data collection permissions by default.
- optional: the extension declares two optional data collection categories to help reviewers map features to data flows:
  1) file_uploads
    - description: Uploads user-consented attachment hashes or files to third‑party malware analysis providers (Hybrid‑Analysis, VirusTotal).
    - data_practices:
      - data_types: ["file_hashes", "filenames", "attachment_metadata", "message_headers", "message_metadata", "email_addresses", "timestamps"]
      - purpose: Malware analysis of attachments to protect the user's mailbox
      - retention: Provider‑defined; the extension does not retain uploaded file contents unless explicitly requested by the user
      - destinations: ["https://hybrid-analysis.com", "https://virustotal.com"]
    - user_controls: Uploads only occur after explicit per‑message or per‑account opt‑in. Host permission is requested at runtime when an upload is initiated. Users can revoke opt‑in in the options UI.
    - examples: ["SHA-256 hash of attachment and filename", "attachment MIME type and size"]

  2) url_and_ip_scans
    - description: Scans URLs and domains (urlscan.io, urlhaus) and checks IP reputation (abuseipdb) from user‑visible message content or links for threat intelligence.
    - data_practices:
      - data_types: ["urls", "domains", "ip_addresses", "message_metadata", "timestamps"]
      - purpose: Detect malicious URLs, phishing infrastructure and IP reputation checks to protect the user
      - retention: Provider‑defined; only minimal metadata (scan id, verdict) stored locally by the extension
      - destinations: ["https://urlscan.io", "https://urlhaus.abuse.ch", "https://api.abuseipdb.com"]
    - user_controls: URL/IP scans are performed only when configured in settings (autoScanLinks) or when the user triggers a manual scan. Host permission is requested at runtime.
    - examples: ["URL extracted from message body", "Domain of a link", "IP address observed in headers or links"]
- policy_url: https://vazules.github.io/Thunderbird-Antivirus/docs/privacy_policy.html — points to the published privacy policy (replace with the final hosted URL before publishing).

Notes for the reviewer: the default behavior is to never upload files automatically. Reviewers can validate the opt‑in behavior by setting an API key in the options page and using the per‑message "Für diese Nachricht scannen" action; the extension will request host access at that moment.

--
Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>