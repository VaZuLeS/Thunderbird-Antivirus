# Thunderbird Antivirus

This repository contains a Thunderbird WebExtension (Thundy AV) that performs opt‑in, real‑time scans of incoming emails using local checks and optional external analysis services.

Badges: [CI] [License] [Releases]

Key features
- Thunderbird WebExtension with per-account and per-message Opt‑In scanning
- Inline per-message banner to trigger one‑off scans and optionally opt a sender in
- Optional runtime host permission requests for external analysis providers (e.g., Hybrid Analysis, VirusTotal, urlscan.io)
- Minimal default permissions; host access requested only when user consents
- Privacy‑first defaults and an editable privacy policy (docs/privacy_policy.md)

Quickstart — extension development
- Install dependencies: npm ci
- Run unit tests: node --test background.test.js
- For manual extension testing in Thunderbird: build XPI or load as temporary add-on via "about:debugging" (or use web-ext with Thunderbird target if configured).

How to add/support another external service
1. Add the service host origin (e.g. "https://www.virustotal.com/*") to `optional_permissions` in manifest.json.
2. Add handling in options.js/background.js to request permission at runtime and to call the provider's API according to its docs.
3. Update docs/reviewer_notes.md and docs/privacy_policy.md with the provider name and exact data sent.

Developer notes
- Tests: background.test.js covers main scanning/permission flows.
- CI: .github/workflows/ci.yml runs unit tests and a non-blocking web-ext lint.

Privacy & Store
- Scanning is disabled by default; users must opt in per account or per message.
- Privacy policy: docs/privacy_policy.md — replace placeholders with responsible org/contact before publishing.

Contributing
- See CONTRIBUTING.md; open issues for feature requests and bugs.

License: MIT

