# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project uses semantic versioning
for the add-on version in `manifest.json`. Releases are cut from tags in the GitHub repository
(https://github.com/VaZuLeS/Thunderbird-Antivirus).

## [Unreleased]

### Added

- **Problemanalyse und Aufgabenplan für die Store-Readiness (Version 1.6):**
  [`docs/PROBLEMANALYSE_STORE_READINESS.md`](docs/PROBLEMANALYSE_STORE_READINESS.md) dokumentiert mit
  reproduzierten Nachweisen 5 Blocker, 6 hohe Risiken, 6 mittlere und 1 kleinen Befund für eine Listung
  im Thunderbird Add-ons Store (ATN). Der daraus abgeleitete
  [`docs/AUFGABENPLAN_STORE_READINESS.md`](docs/AUFGABENPLAN_STORE_READINESS.md) ordnet die Aufgaben in
  vier Phasen, inklusive Traceability-Matrix Befund → Aufgabe, Schätzungen, Abnahmekriterien und
  Risiko-Register.

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
