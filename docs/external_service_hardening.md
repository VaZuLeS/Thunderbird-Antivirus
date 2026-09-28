External Service Hardening Recommendations

Purpose
This document lists recommended controls for the external analysis providers used by Thundy AV. The add-on itself has
no server component: every request goes directly from the user's Thunderbird to the provider the user configured and
granted access to. The provider-side points below describe what we recommend to (and expect from) those services; the
client-side points describe what is implemented in the extension and what users/maintainers should do to reduce risk
when hashes, URLs or attachments are transmitted. It is aimed at maintainers and store reviewers.

1. Transport Security
- Require HTTPS/TLS (TLS 1.2 minimum; prefer TLS 1.3) for all API endpoints.
- Prefer modern cipher suites; enable HSTS on the analysis host.
- Provide example TLS configuration snippets (Nginx/Apache) in an internal ops doc.
- Consider certificate pinning on clients that have a long-lived trust need (we do NOT pin by default; can be optional setting for advanced users).

2. Authentication & API Keys
- There is no server-side key storage. Users paste their own provider API keys into the extension options; the keys
  are stored in `browser.storage.local` inside the Thunderbird profile and are **not encrypted**. Anyone who can read
  the profile (local user account, backup, synced profile, forensic copy) can read the keys.
- Client-side measures implemented by the extension:
  - No API key is hard-coded in the source or committed to the repository; keys are only entered by the user at
    runtime and are never part of the build artifact.
  - Key fields are masked (`type="password"`), `autocomplete="off"`, `spellcheck="false"` and limited to 255
    characters so keys are not leaked through autofill or spellcheck dictionaries.
  - A key is only sent to the host it belongs to, and only after the global consent plus a runtime host permission
    for that provider.
- Recommendations for users and maintainers:
  - Use dedicated, low-quota keys for the add-on and rotate them regularly; revoke a key immediately if the profile
    may have been copied or compromised.
  - Protect the Thunderbird profile with OS-level encryption (FileVault, BitLocker, LUKS) and a profile/screen lock.
  - Do not put provider API keys into CI secrets: the build does not need them. CI credentials are only relevant for
    signing/publishing (ATN API keys) and should be stored as encrypted repository secrets.
- Recommendations for providers: scope keys to the necessary endpoints, support rotation, and apply rate limiting per
  key and per IP to prevent abuse.

3. Minimal Data Upload
- Default to uploading only hashes (SHA-256) and metadata. Upload full attachments only when explicitly requested by the user.
- Strip headers and PII from uploaded samples unless the user explicitly includes them.

4. Privacy & Retention
- Publish a clear retention policy: how long uploaded samples and analysis results are stored.
- Provide an API/endpoint for deletion requests tied to specific upload IDs.

5. Input Validation & Sanitization
- Validate uploaded filenames, sizes, and types on server-side; reject suspicious or malformed inputs.
- Scan uploaded files in a sandboxed environment; do not execute untrusted content in the analysis host's main process.

6. Rate Limiting & Abuse Protection
- Throttle large uploads and block abusive clients.
- Apply progressive backoff and exponential delays when throttling scans.

7. Observability & Alerting
- Log uploads and analysis results with correlation IDs (avoid logging PII in plain text).
- Alert on unusual spikes in upload volume or error rates.

8. CORS & CSP
- Return strict CORS headers allowing only known origins used by the extension or control plane (not '*').
- Avoid exposing unnecessary headers.

9. Contract & Legal
- Ensure provider's TOS and privacy policies align with extension's privacy policy and user expectations.
- For users in GDPR jurisdictions, provide data processing agreements if required.

10. Example API Pattern
- Upload hash: POST /api/v1/hashes { sha256 }
- Request full upload: POST /api/v1/uploads { uploadMeta } -> returns upload URL for direct PUT
- Analysis callback: POST /api/v1/callbacks with analysis result and correlation ID

Appendix: Example nginx TLS snippet (omitted — include in ops internal doc)