External Service Hardening Recommendations

Purpose
This document lists recommended server-side and integration controls for external analysis providers used by Thundy AV. The goal is to minimize risk when uploading hashes/attachments and to provide guidance for store reviewers and maintainers.

1. Transport Security
- Require HTTPS/TLS (TLS 1.2 minimum; prefer TLS 1.3) for all API endpoints.
- Prefer modern cipher suites; enable HSTS on the analysis host.
- Provide example TLS configuration snippets (Nginx/Apache) in an internal ops doc.
- Consider certificate pinning on clients that have a long-lived trust need (we do NOT pin by default; can be optional setting for advanced users).

2. Authentication & API Keys
- Use API keys scoped to specific actions and rotate keys periodically.
- Do not embed API keys in client code or public repos. Store keys in secure secrets stores (e.g., GitHub Actions secrets, Vault).
- Implement server-side rate limiting per API key and per IP to prevent abuse.

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

--
Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>