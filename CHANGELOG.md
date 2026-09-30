# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project uses semantic versioning
for the add-on version in `manifest.json`. Releases are cut from tags in the GitHub repository
(https://github.com/VaZuLeS/Thunderbird-Antivirus).

## [Unreleased]

Changes that resolve the store-readiness review for 1.6
([docs/STORE_READINESS_REVIEW_1.6.md](docs/STORE_READINESS_REVIEW_1.6.md)).

### Added

- **Self-check on the options page** ("Status der Erweiterung"): reports whether the in-message script is
  registered, the consent state, the number of stored API keys and the privacy tier (reviewer/QA aid, nothing is
  transmitted).
- **Integration test** (`integration.test.js`) that runs the background script and the popup script against one
  shared in-memory IndexedDB and proves the contract *message displayed → assessment stored under the Message-ID
  header → popup renders it*, including a banner-triggered scan. This is the regression guard for the
  "results are not shown" bug.
- **Scan action in the popup**: *"Scan this message now"* starts the scan for the displayed message and refreshes
  the view afterwards; without consent/API key it stays disabled and explains why.
- **Locale parity check** in the pre-submit checks (every key of the default locale must exist in `de`) and
  three new tests for it.
- **Test message fixture** [`docs/test_messages/suspicious_message.eml`](docs/test_messages/README.md) that
  triggers the local detections (lookalike sender, urgent wording, `spf=fail`, typosquatting link, HTML attachment)
  without any API key or consent — used for the pending manual test and recommended as the fourth screenshot motif.
- **New bundled message display script `message_display.js`**: it renders the opt-in banner (the two scan buttons plus
  "Open options"), the warning banner from a risk score of 50 upwards (with the list of reasons) and the green
  SPF/DKIM/DMARC badge in the message view, and it implements the time-of-click protection.
- **Two context-menu entries**: "Scan link with Thundy AV" (link context) and "Scan all links of this message"
  (message display action, up to 20 links), backed by the newly declared `menus` permission.
- **Functional auto-scan option**: "Check links in the email immediately when it is opened" checks up to 20 links per
  message via urlscan.io (consent and key required) and stores the verdicts locally so a later click needs no new
  request; the option text and its help text were clarified.
- New localization keys `tocLinkMarked`, `tocWarningTitle`, `tocChecking`, `tocBlocked`, `tocOpenAnyway`, `tocClose`,
  `tocBlockedScheme` and `notificationUiUnavailable` in `_locales/en` and `_locales/de`.
- **Localization of the options page and the popup**: all visible UI strings are now resolved through
  `browser.i18n` and the catalogues (static markup via `data-i18n*` attributes and `applyUiTranslations()` in
  `db.js`, dynamic strings via `uiText()` in `options.js`/`api.js`). The catalogues contain 186 keys per language
  (181 localized UI strings), the English translation is complete, German fallbacks remain in the code, and further
  languages only need an additional `_locales/<code>` folder.
- Tests: `message_display.test.js` (19 tests), four popup consent tests in `api.test.js`, tests for the
  localization helpers in `db.test.js`, tests for the built-in data consent in `background.test.js`/`options.test.js`
  and twelve new pre-submit-check tests – **465 tests in total, 0 failures**.

### Changed

- **The in-message UI is no longer injected with `scripting.executeScript`.** The background script registers
  `message_display.js` once through `scripting.messageDisplay.registerScripts()` (id `thundy-ui`,
  `runAt: 'document_idle'`, also on `onStartup` and `onInstalled`) and exchanges state through runtime messaging
  (`getMessageUiState`, `requestScan`, `checkLinkState`, `openVerifiedLink`; broadcast `thundy:messageState`).
- **`data_collection_permissions`** is now `required: ["none"]` plus `optional: ["personalCommunications"]`. Where
  the environment offers the built-in data-collection consent, the options dialog requests that category when the
  global consent is enabled (feature detection via `browser.permissions.getAll().data_collection`) and switches the
  global consent off again if the request is declined. Independently of that, the background script enforces the
  granted category in `mayTransmitExternally()`: without the granted category nothing is transmitted.
- **`optional_host_permissions`** reduced to the five origins actually used (wildcard subdomains removed).
- **Popup**: the displayed message is determined via `messageDisplay.getDisplayedMessages()` (fallback: `tabs.query` +
  `tabId`), and without the global consent no provider is queried at all – the popup then shows a notice card.
- Localization/UI: all visible UI strings – manifest, in-message UI (banners, warnings, badges), options page and
  popup – are resolved through the catalogues with the default locale `en` and fallback texts in the code.
- The pre-submit checks additionally verify the API namespace against the declared permission, the data-collection
  declaration and the presence of the programmatically registered script in the package.
- The built package contains **18 files / 279,353 bytes unpacked**.
- The pre-submit checks verify that all localized UI strings (currently 181) have a catalogue entry.
- **Upload cap:** attachments larger than 100 MB are never uploaded automatically (provider limits); they stay in
  the manual path.
- **Reviewer notes:** the tier descriptions state precisely which transmissions happen independently of the tier,
  the test path now covers the local CDR/"disarm" action, and the maintainer note about provider hosts was added.

### Fixed

- **Scan results without a Message-ID are reported instead of being lost.** A banner/popup scan now falls back to
  the header of the displayed message if `messages.get()` yields no `headerMessageId`, and the response carries
  `stored: false` when the result could not be assigned, which the banner and the popup surface in plain text.
- The URL-scan path keeps the `headerMessageId`, so a later rescan updates the stored record (it sent `undefined`
  before and the database update was silently skipped).
- Removed dead code/markup: unused `#status_message` element, unused helper, four unused catalogue keys.
- **User visible error messages are localized** (missing API key, upload/URL scan/urlscan.io failures) — they were
  the last German-only strings a user could see.
- **Scan results were not shown in the popup.** Two causes: scans triggered from the in-message banner worked
  with `{ id }` only, so every IndexedDB write was skipped (they require `message.headerMessageId`), and the popup
  returned early when no Hybrid Analysis key was stored. The scan now resolves the real `MessageHeader`, and the
  popup always renders the local assessment (risk score, score bar, reasons, SPF/DKIM/DMARC result, evaluation time)
  plus the stored attachment/link verdicts as status chips. Provider data stays gated by consent **and** API key.
- **Robustness:** the state and link handlers fall back to the active message display when Thunderbird does not
  report `sender.tab` for the message display script; the popup applies the same consent rule as the background
  (own consent **and** the granted built-in data category) before it queries providers.
- **Review B1** – `menus` was missing from `manifest.json`, so both context-menu entries were never created.
- **Review B2** – the message-view UI was injected through a code path Thunderbird does not offer.
- **Review B3** – time-of-click protection was cosmetic only and `handleCheckLinkState` was dead code. Links are now
  checked before they open: stored verdict first, otherwise a live urlscan.io lookup (consent + key, 6-second budget).
  `MALICIOUS`, `MALICIOUS_VISUAL`, `TIMEOUT` and `ERROR` block the link; the user can release it explicitly with
  "Open the link anyway" (session only), and non-HTTP(S) schemes are blocked.
- **Review B4** – the popup queried Hybrid Analysis without checking the global consent.
- **Review M3** – two latent `ReferenceError`s in the popup (`syncFragment`, `container`) prevented stored links and
  unknown attachments from being rendered.
- **Review M7** – popup title and heading now read "Thundy AV – Email Scanner for Thunderbird".
- **Review M8** – a failed message display script registration is now reported to the user through a system
  notification (`notificationUiUnavailable`) instead of only being logged.
- **Review H1/H2/H3** – the data-collection semantics, the documentation/store-listing drift and the missing
  permission-consistency gate were addressed (details: [docs/STATUS.md](docs/STATUS.md)); **M1** (host patterns) is
  covered by the reduction to five origins.

### Known open items

- Live verification in Thunderbird 140 ESR has not been carried out yet, there are no real screenshots (SVG
  placeholders only) and the add-on has not been signed or submitted to addons.thunderbird.net.

## [1.6.0] – 2026-09-28

> This version was never published to addons.thunderbird.net. The description below documents the state at that
> point in time; the entries under *Unreleased* above supersede the parts that changed during the store readiness
> review.

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
  message view was centralized in a helper (replaced by the registered message display script, see *Unreleased*).
- `data_collection_permissions` declared the category `personalCommunications` as required (changed to
  `required: ["none"]` plus the optional category during the store readiness review, see *Unreleased*).
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
