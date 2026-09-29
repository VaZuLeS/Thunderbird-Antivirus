# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project uses semantic versioning
for the add-on version in `manifest.json`. Releases are cut from tags in the GitHub repository
(https://github.com/VaZuLeS/Thunderbird-Antivirus).

## [Unreleased]

- Nothing yet.

## [1.6.0] – 2026-09-29

Submission state after the independent store-readiness audit of 2026-09-29
([docs/STORE_READINESS_AUDIT.md](docs/STORE_READINESS_AUDIT.md)). The sections below this one document
the 1.6 rework that preceded the audit; this section lists the findings that were fixed afterwards.

### Fixed

- **Consent bypass in the popup (audit B1).** The popup reads the global consent
  (`externalAnalysisConsent`) before it builds a request and performs no provider query while the
  consent is off — it shows the consent notice instead. The background script remains the deciding
  instance: a request during a withdrawn consent is answered with `EXTERNAL_ANALYSIS_DISABLED`, the
  popup then shows the notice and does not retry.
- **Popup rendering (audit B2).** The popup uses a container/sink abstraction again
  (`getPopupContainer()`, `syncFragment()`), so the consent notice, the status cards and the results
  render instead of aborting with a `TypeError`.
- **Banner buttons (audit B3).** "Scan this message only" and "Scan this sender permanently" work with
  a complete message object (`browser.messages.get()` with a fallback to the displayed message
  header) instead of an object that only carried the id, so the sender rating no longer fails and the
  buttons report a result instead of "Scan failed".
- **Link extraction (audit H2).** `extractTextFromParts()` is called with the full message
  (`messages.getFull()` result) again, so URLs and domains from the message body are actually
  analysed and appear in the link evaluation.
- **Time-of-Click protection (audit H3).** Links are marked in the message view and checked
  **locally** when they are clicked: URL structure, displayed link text compared with the target, the
  user's own blacklist and domains that previous scans reported as malicious. A suspicious target is
  intercepted with a warning that leaves the decision to the user. No data is transmitted for this
  check.
- **`menus` permission (audit B5).** `"menus"` is declared in `manifest.permissions`, so the two
  context menu entries — "scan this link" (`contexts: ["link"]`) and "scan all links of this message"
  (`contexts: ["message_display_action"]`) — are created again instead of being silently skipped.

### Changed

- **Data classification (audit B4).** `browser_specific_settings.gecko.data_collection_permissions` is
  now `{ "required": ["none"], "optional": ["personalCommunications"] }`: nothing is collected by
  default, and the transmission to analysis providers is an optional data type that requires the
  user's consent. The opt-in in the options dialog requests the optional data type together with the
  host permission (`browser.permissions.request({ data_collection: ["personalCommunications"] })`)
  and removes it again when the consent is switched off.
- **Version.** `manifest.json` and `package.json` both use `1.6.0` (previously `1.6` in the manifest).
- **Build hygiene (audit M6).** The ineffective `.webextignore` file was removed — `web-ext` and
  `addons-linter` never read it, the packaging rules live in `web-ext-config.mjs` only. The `*.md`
  pattern was replaced by the explicit list of repository documents, so new files (for example a
  future `VENDOR.md`) are no longer silently excluded; the invalid `LICENSE/**` pattern was dropped.
- **Pre-submit checks.** `scripts/pre-submit-checks.js` validates the data classification against the
  rules of the add-on linter (`required` mandatory and not empty, `"none"` allowed together with
  `optional`), fails when a privileged API used at runtime has no matching entry in
  `manifest.permissions` (for example `browser.menus` without `menus`) and compares the versions of
  `manifest.json` and `package.json` exactly instead of normalising them.
- `jsdom` moved from `dependencies` to `devDependencies` (test-only dependency, audit M7).

## [1.6.0] – 2026-09-28

### Added

- **Global consent.** New option *"Externe Analyse erlauben"* (allow external analysis) with the default **off**. The
  background script enforces it for every transmission to a third-party service; without consent nothing is sent and
  the banner reports that no data was transmitted (`EXTERNAL_ANALYSIS_DISABLED`).
- **Banner with two actions.** The message-view banner now offers *"Nur diese Nachricht scannen"* and
  *"Absender dauerhaft scannen"*.
- **Privacy tiers**, now defaulting to `strict` (SHA-256 hashes and metadata only), `balanced` (additionally uploads
  unknown attachments) and `max` (additionally uploads URLs).
- **IP reputation** of sending mail servers (extracted from `Received` headers) via VirusTotal or AbuseIPDB –
  optional and configurable.
- **Localization** of manifest strings and banner texts via `_locales/` (English, German) including English
  fallbacks in `background.js`.
- Pre-submit checks for manifest, privacy policy and permissions (`scripts/pre-submit-checks.js`).
- Additional unit tests covering the consent, privacy-tier and permission flows.

### Changed

- Add-on renamed to **"Thundy AV – Email Scanner for Thunderbird"** (short name *Thundy AV*), new add-on ID
  `thundy-av@bludau-it-services.de`, new icons in 16/32/64 px, `options_ui.open_in_tab` enabled.
- Host permissions moved from `optional_permissions` to **`optional_host_permissions`**, patterns corrected, missing
  origins added (Hybrid Analysis, VirusTotal, urlscan.io, URLhaus, AbuseIPDB). Permissions are requested at runtime
  for the provider that is actually used.
- Ported to the Manifest V3 message display APIs (`messageDisplay.onMessagesDisplayed` /
  `getDisplayedMessages()` instead of the removed `onMessageDisplayed` / `getDisplayedMessage`); injection into the
  message view is centralized in `injectIntoMessageDisplay()`.
- `data_collection_permissions` declares the required category `personalCommunications` (superseded by the
  optional data classification of 2026-09-29 above).
- Release packages are cleaned up through the `ignoreFiles` rules in `web-ext-config.mjs`; test files, `docs/`,
  `scripts/`, `examples/` and lockfiles are no longer part of the build.
- `api_gateway.js` is now loaded by the background script so the centralized request/timeout handling is used.

### Fixed

- Removed the `.gitignore` gaps and stale development leftovers from the packaged build (XPI contents).
- Pre-submit checks now fail with a non-zero exit code instead of always exiting 0.

## [1.5]

### Added

- Inline per-message banner for opt-in scanning: one-off scan of the current message and permanent opt-in for a single
  sender.
- Runtime permission flow: host access for external analysis providers is requested only when the user starts a scan
  or upload.
- Unit tests for the scanning and permission flows plus a CI workflow (`.github/workflows/ci.yml`) that runs the tests
  and `web-ext lint`.
- Store preparation: privacy policy draft (`docs/privacy_policy.md`), reviewer notes (`docs/reviewer_notes.md`),
  store listing draft (`docs/store_listing.md`) and a screenshot guide.
- Build artifact `build/thunderbird_security_antivirus-1.5.zip` attached to a draft release.

### Changed

- Scanning is disabled by default; the user opts in per message or per sender, and configures providers and API keys
  in the options page.
