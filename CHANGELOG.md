# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project uses semantic versioning
for the add-on version in `manifest.json`. Releases are cut from tags in the GitHub repository
(https://github.com/VaZuLeS/Thunderbird-Antivirus).

## [Unreleased]

**Work in progress:** the manual verification in Thunderbird 140 ESR, real store screenshots and the store submission are
still open (see `docs/STATUS.md`). The build artifact `build/thundy-av-1.6.xpi` is unsigned; for a release build of
Thunderbird either load it as a temporary add-on via `about:debugging` or sign it with `web-ext sign`.

### Fixed

- **Message view rendering rewritten for Manifest V3.** The banners are now rendered by a dedicated message display
  script (`messageDisplay/banner.js`), registered through `scripting.messageDisplay.registerScripts`. It only renders the
  state that the background script provides (`getDisplayState` / `updateDisplayState`), so injected code cannot transmit
  data itself. Previously the banners were injected as anonymous functions per message.
- **Consent is now enforced in the popup too.** `api.js` loaded analysis reports directly from the provider and
  transmitted the attachment hash even if the user had revoked consent; report lookups now require the global consent and
  the host permission and are re-checked at call time.
- **Attachment upload uses the shared HTTP gateway** (`apiGateway.fetchWithTimeout`, 60 s) instead of a direct `fetch`
  without a timeout.
- **Host permission flow is deterministic.** `permissions.request()` is no longer called from the background (a user
  gesture does not survive the message hop); scanning without the permission now reports `permission_required` and the
  banner links to the options page, which requests the permission on save.
- **Removed the undocumented link context menu** (`contexts: ["link"]`); the documented `message_display_action` entry
  remains.
- Privacy policy and reviewer notes now list the locally stored message metadata (sender, subject, attachment name/hash)
  and document where the consent checks are enforced.

### Added

- `npm run build` produces the installable `build/thundy-av-<version>.xpi` and verifies the package content, including the
  files referenced by the packaged manifest and the registered message display scripts.
- 10 unit tests for the message display script (banner rendering, both scan actions, consent/permission hints,
  Time-of-Click markers, “never transmits anything itself”).


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
- `data_collection_permissions` declares the required category `personalCommunications`.
- Release packages are cleaned up through `.webextignore`; test files, `docs/`, `scripts/`, `examples/` and lockfiles
  are no longer part of the build.
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
