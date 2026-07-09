Store listing draft — Thundy AV (Thunderbird extension)

Short description (80 chars):
Opt‑in real‑time email scanning for Thunderbird — per‑message scans & privacy‑first.

Long description (detailed):
Thundy AV (Thunderbird SECurity AntiVirus) helps protect users from malware and phishing by performing opt‑in, real‑time analysis of email attachments and links. Scanning is off by default; users can enable scanning per account in Options or trigger a one‑off scan from an inline per‑message banner. External analysis services (Hybrid Analysis, VirusTotal, urlscan.io) are used only with explicit user consent; host permissions are requested at runtime.

Key features:
- Per-account and per-message Opt‑In scanning
- One‑click per‑message scanning via inline banner
- Sends minimal data by default (hashes/metadatas) unless full upload is explicitly allowed
- Optional runtime host permission requests for external analyzers
- Local scoring & heuristics to detect likely threats before uploading

Permissions rationale (for store reviewers):
- messagesRead: required to obtain the currently opened message to analyze attachments/links when the user requests a scan.
- scripting: used to inject temporary UI banners into the message view (no remote code execution; scripts loaded from extension bundle only).
- storage: to store user preferences and per‑sender opt‑in flags.
- optional host permissions: listed in manifest.json and requested at runtime; only requested when user triggers an upload.

Screenshots (placeholders):
- docs/screenshot-1-inline-optin.svg — Inline opt‑in banner over a message with attachment (shows button "Für diese Nachricht scannen")
- docs/screenshot-2-warning.svg — Warning banner injected when a threat score >= threshold (shows verdict labels)
- docs/screenshot-3-options.svg — Options page showing per-account scanning toggle and provider choices

What's new / Release notes:
- Prepare store assets & privacy policy
- Added per‑message Opt‑In UX and runtime permission flow
- Tests & CI: unit tests and web‑ext lint in CI

Publishing checklist for PR / Release:
- [ ] Confirm public privacy policy URL (GitHub Pages enabled for docs/)
- [ ] Confirm contact email and responsible organization (done)
- [ ] Verify screenshots and update images in docs/screenshots/
- [ ] Build XPI (done) and attach to release assets
- [ ] Fill store listing metadata in AMO/Thunderbird Add‑ons dashboard

--
Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>