## Description
Please include a summary of the change and which issue is fixed. Include relevant motivation and context.

## Type of change
- Bug fix
- New feature
- Documentation update

## How has this been tested?
Describe the tests that you ran to verify your changes.

## Checklist
- [ ] My code follows the repository style
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] I have added necessary documentation (if appropriate)

Implementation checklist (for Thunderbird Extension & AMO reviewers)
- [ ] Manifest: permissions minimized; optional permissions documented with rationale
- [ ] gecko.data_collection_permissions: categories declared and documented in docs/reviewer_notes.md
- [ ] Privacy Policy: drafted, hosted, and privacy URL present in manifest and store listing
- [ ] Opt-In: per-message or per-account opt-in flows implemented and tested
- [ ] Storage: API keys not committed; guidance added for storing secrets
- [ ] CSP: content_security_policy reviewed and no unsafe-inline or eval
- [ ] Localization: default_locale set and _locales present for supported languages
- [ ] Tests: unit tests added for critical flows (opt-in, upload queue, retry/backoff)
- [ ] CI: web-ext lint, unit tests, and AMO validator configured (non-blocking allowed)
- [ ] Assets: high-resolution screenshots (1200×800) and full icon set (16/48/64/128/256)
- [ ] Reviewer Notes: docs/reviewer_notes.md updated to explain data flows and permissions

Security & Compliance
- [ ] No secrets or API keys in commits
- [ ] Dependabot alerts triaged or noted
- [ ] Pre-commit hook for secret scanning configured

Testing instructions
- Describe the steps to reproduce opt-in flow and how to test host permission request. (e.g., set API key in Options, open a message with attachment, click "Für diese Nachricht scannen")

Notes for maintainers:
- CI should run web-ext lint and the manifest.test.js unit test to ensure manifest schema is intact.
- Update the privacy policy URL in manifest.json when GitHub Pages is published.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>