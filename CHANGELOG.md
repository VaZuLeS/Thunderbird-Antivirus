# Changelog

## 1.23.0 — 2026-10-15

- Redesign settings with section navigation, clearer form groups, modern spacing and a persistent save action.
- Add a shared local theme system: follow Thunderbird, light or dark, and four accent palettes, fully translated in EN/DE/FR/ES/IT/PL.
- Save appearance independently, update open add-on pages, and apply themes to the wizard, scanner, local tools and isolated message security UI.
- Read native Thunderbird popup colors with the theme permission, validate contrast and fall back safely; preserve semantic warning colors and existing scan consent.


## 1.22.0 — 2026-10-14

- Open a dedicated setup wizard on first installation; updates never reopen it automatically.
- Guide users through welcome, link protection/local audit and optional provider configuration in EN/DE/FR/ES/IT/PL.
- Save only the chosen link-protection setting and completion marker; leave API keys, external consent, sender approvals and logs intact.
- Reopen the wizard from settings, postpone without writing, and show retryable save/opening failures.
- Distribute the current source under GPL version 3 only and require the full license text in the XPI.


## 1.21.0 — 2026-10-14

- Add optional hosting, SSO, device-management, SIEM and ticket configuration profiles with editable vendor combinations.
- Provide a six-language offline settings assistant, local selection storage, JSON draft export and a matching Node CLI.
- Keep every integration disabled and omit secret values and user activity; profile selection does not change existing scan consent.
- Reject unknown profile inputs, refuse CLI file overwrites and test all 3,125 combinations plus save/export/reset in six languages.
- Document activation prerequisites and remaining enterprise implementation work; profile selection does not deploy or connect services.

## 1.20.0 — 2026-10-13

- Persist intercepted link decisions with full URL, timestamp, local message/link score, provider verdict and decision-time snapshots. Distinguish successful browser handoff, cancellation, opening failure and pending interactions.
- Add a six-language review page with URL/date/outcome/score filters, pagination, high-risk opened highlighting and complete filtered JSON/CSV exports.
- Serialize local audit writes, apply 30-day/2,000-entry/2-MiB retention and separate audit deletion from cache clearing.
- Add export checksum verification and spreadsheet formula protection; document local audit limits, privacy and enterprise feature priorities.
- Verify 517 automated tests, 0 lint errors and 48 browser layout cases. Real Thunderbird acceptance remains pending.


## 1.19.1 — 2026-10-13

- Fix the message-action popup collapsing to a narrow strip by removing viewport-dependent auto-sizing.
- Open confirmed links through Thunderbird’s `windows.openDefaultBrowser` API, validate the current message and HTTP(S) scheme, and keep failures visible with retry.
- Redesign the link dialog with Thundy AV branding, destination domain, expandable full URL, clear warning/unknown states, dark mode and email-style isolation.
- Preserve native right-click context menus; handle normal, modified and middle clicks, Escape, cancellation and changing link/message contexts.
- Improve the popup hierarchy with a local risk meter, explanatory limits, collapsible technical metadata and persistent consent information. Empty cached results no longer imply that the message contains no attachments or links.
- Translate all new labels into EN/DE/FR/ES/IT/PL and add opening/cancellation regression coverage.


## 1.19.0 — 2026-10-13

- Bundle English, German, French, Spanish, Italian and Polish for options, popup, warnings, errors and local privacy information.
- Require message/sender authorization for automatic external scans, enforce the URL privacy tier, and store consent only after the combined permission request succeeds.
- Intercept link navigation with an accessible result dialog, including middle-click and keyboard handling.
- Enable local checks without Hybrid Analysis credentials and process text/HTML attachments and MIME part arrays.
- Add expiring reputation caches, bounded provider/attachment concurrency, safe GET retries, transaction-aware persistence and result retention.
- Bundle a pinned Public Suffix List, require configured trusted authentication servers, separate risk/sanitizer modules and expand CI to every test and package check.
- Pending: real Thunderbird 140 ESR/current-client verification and screenshots before release.

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project uses semantic versioning
for the add-on version in `manifest.json`. Releases are cut from tags in the GitHub repository
(https://github.com/VaZuLeS/Thunderbird-Antivirus).

## [Unreleased]

- Nothing yet.

## [1.6.2] – 2026-10-01

Store-readiness release: behebt die Blocker der Problemanalyse (siehe
[docs/PROBLEMANALYSE_STORE_READINESS.md](docs/PROBLEMANALYSE_STORE_READINESS.md) und
[docs/decisions.md](docs/decisions.md)). Keine übertragene Version dieses Add-ons existiert bisher bei
addons.thunderbird.net (`api/v4/.../thundy-av@bludau-it-services.de` → 404), deshalb ist 1.6.2 die erste
veröffentlichte Version dieses Zweigs.

### Fixed

- **Datenübermittlung ohne Zustimmung im Popup:** `api.js` fragte Hybrid Analysis direkt ab, obwohl die
  globale Zustimmung ausgeschaltet war. Das Popup prüft jetzt vor jedem Netzwerkzugriff die Zustimmung und
  zeigt sonst ausschließlich das **lokal** gespeicherte Ergebnis.
- **Popup-Berichtsanzeige:** zwei undefinierte Bezeichner (`syncFragment`, `container`) warfen einen
  `ReferenceError`, sodass der Analysebereich nie gerendert wurde.
- **Kontextmenüs ohne Wirkung:** die Berechtigung `menus` fehlte im Manifest; beide Einträge
  („Link scannen“, „Alle Links dieser Nachricht scannen“) wurden stillschweigend nie erzeugt.
- **Datenschutz-Stufe umgangen:** der manuelle Anhang-Upload und der manuelle URL-Scan übergingen die
  Stufe. Jetzt gilt: Anhang-Upload ab `balanced`, URL-Upload nur `max`; in `strict` erscheint ein Hinweis
  mit Link in die Einstellungen.
- **Fehlende Host-Berechtigung** führte zu undurchsichtigen Netzwerkfehlern. Jeder Provider-Aufruf prüft
  jetzt vorab (`HOST_PERMISSION_MISSING` mit klarem Text und Weg in die Einstellungen); der automatische
  Anhang-Upload läuft zusätzlich über das zentrale Gateway mit Timeout.
- **IP-Reputations-Cache** speicherte „nicht auffällig“-Ergebnisse aus der Zeit **ohne** Zustimmung und
  verhinderte so spätere echte Abfragen.
- **Injektionsfehler** in der Nachrichtenansicht wurden nur ins Log geschrieben; sie werden jetzt einmal
  pro Sitzung als Benachrichtigung gemeldet.
- **Paket enthielt Entwicklerdateien** (`test_regex_escape*.js`), die Paketprüfung schlug fehl.
- **Manifest V3:** die MV2-Fallbacks (`onMessageDisplayed`, `getDisplayedMessage`) und der nicht
  existierende Zweig `scripting.messageDisplay.executeScript` sind entfernt.

### Changed

- **Daten-Deklaration:** `data_collection_permissions` jetzt
  `{ "required": ["none"], "optional": ["personalCommunications"] }`; die Zustimmung wird zusätzlich über
  `browser.permissions.request({ data_collection: ['personalCommunications'], permissions: ['sensitiveDataUpload'] })`
  in der Nutzergeste eingeholt und beim Abschalten zurückgegeben. Neue optionale Berechtigung
  `sensitiveDataUpload` (Thunderbird-Signal für das Hochladen sensibler Nutzerdaten), Berechtigung `menus`
  ergänzt.
- **Repository-Hygiene:** `pnpm-lock.yaml` entfernt (npm ist der alleinige Paketmanager),
  Entwickler-Skripte liegen unter `tools/*.dev.js`, `.webextignore` entfernt (wird von `web-ext` nicht
  gelesen), Testlauf arbeitet mit expliziter Dateiliste statt Discovery.
- **Gates:** Pre-Submit-Checks erzwingen Daten-Deklaration samt Laufzeit-Anfrage, `menus`-Berechtigung und
  verbieten MV3-entfernte APIs in Laufzeitdateien; der Lint-Filter verbirgt entfernte APIs nicht mehr.
  Neu: `npm run check` (voller Gate) und `npm run store-gate` (Go/No-Go mit Nachweis je Kriterium).
- **Dokumentation:** Datenschutzerklärung, Store-Listing, Reviewer-Notes, READMEs, Quickstart und
  Screenshot-Anleitung auf den geprüften Stand gebracht; Testdaten (`testdata/`) und Live-Test-Protokoll
  (`docs/live_test_protocol.md`) ergänzt.

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
