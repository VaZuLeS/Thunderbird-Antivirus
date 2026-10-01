# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project uses semantic versioning
for the add-on version in `manifest.json`. Releases are cut from tags in the GitHub repository
(https://github.com/VaZuLeS/Thunderbird-Antivirus).

## [Unreleased]

- Nothing yet.

## [1.6.4] – 2026-10-01

Diagnose-Release: Der Live-Test lässt sich jetzt in der echten Installation in weiten Teilen
automatisiert nachweisen, und die Forscher-Ansicht nutzt bereits gespeicherte Anbieter-Ergebnisse.

### Added

- **Selbsttest / Diagnose in den Einstellungen:** prüft in der laufenden Installation die verfügbaren
  Thunderbird-Schnittstellen, die Sperren für Zustimmung und Datenschutz-Stufe, die Parser
  (`Authentication-Results`, `Received`-Kette, Link-Anatomie, IOC-Extraktion, Anhangsklassifizierung),
  die Risiko-Aufschlüsselung, die MITRE-Zuordnung, eine echte Benachrichtigung sowie die
  **Banner-Injektion in eine geöffnete Nachricht**. Der Bericht erscheint als Tabelle mit
  PASS/HINWEIS/FEHLER, lässt sich kopieren und als Textdatei speichern.
  Alle Prüfungen laufen lokal mit synthetischen Daten; es wird **nichts** übertragen.

### Changed

- **Forscher-Ansicht zeigt gespeicherte Anbieter-Zustände:** Anhänge und Links erhalten ihre bereits
  lokal abgelegten Hybrid-Analysis-/VirusTotal-Ergebnisse mit Kennzeichnung „(gespeichert)" — ohne
  dadurch eine neue Anfrage auszulösen.

### Fixed

- **Anhang-Hashes werden zwischengespeichert** (je Nachricht und Nachrichtenteil): wiederholtes Öffnen
  des Popups hasht große Anhänge nicht erneut.
- Anbieter-Prüfungen im Selbsttest melden fehlende Host-Berechtigungen als Hinweis, wenn zu einem
  Schlüssel noch kein Zugriff erteilt wurde.

## [1.6.3] – 2026-10-01

Forscher-Release: Analysesicht für IT-Sicherheitsforscher, gebündelte Benachrichtigungen und ein
durchgängiges Design-System. Keine neuen Berechtigungen – alles arbeitet lokal über `messagesRead`,
`storage`, `notifications` und `downloads`.

### Added

- **Forscher-Ansicht im Popup** (Message-Display-Action), zusätzlich zur Ergebnisanzeige:
  Kopfbereich mit Risiko-Score, Verdikt, Zustimmungsstatus, Datenschutz-Stufe, Zeitstempel und
  Datenherkunft; Header-Forensik (Absender/Reply-To/Return-Path, SPF/DKIM/DMARC aus
  `Authentication-Results`, `Received`-Kette mit Hops, IPs und Zeitdifferenzen); Anhang-Forensik mit
  kopierbarem SHA-256; Link-Anatomie (Schema, Host, registrierbare Domain, TLD, Punycode-/Homoglyph-
  Verdacht, Tracking-Parameter, Kurz-URL-Erkennung); IOC-Block (URLs, Domains, IPs, Hashes,
  E-Mail-Adressen); Risiko-Aufschlüsselung je Regel; heuristische MITRE-ATT&CK-Zuordnung; Zeitleiste.
- **Exporte:** JSON-Bericht, CSV-Tabelle und minimales STIX-2.1-Bundle über den Download-Manager sowie
  „IOC-Liste kopieren“ – vollständig lokal erzeugt.
- **Risiko-Aufschlüsselung:** Der Score wird jetzt je Regel mit Punkten und Begründung geführt
  (`breakdown`, `rawScore`), statt nur als Summe.
- **Design-System:** Farb-/Abstands-/Typografie-Tokens inkl. Schweregrad-Skala, Chips, Verdikt-Badge,
  Risikobalken, Tabellen, Monospace-Werte mit Kopierknopf, aufklappbare Sektionen, Tabs „Übersicht“ /
  „Forscher“, hell/dunkel und tastaturbedienbar.

### Changed

- **Benachrichtigungen** laufen jetzt über eine stabile ID je Scan-Vorgang und **aktualisieren** die
  bestehende Meldung (läuft → übermittelt/Job-ID → Ergebnis mit Verdikt und Score) statt neue Meldungen
  zu stapeln; ein Klick auf die Benachrichtigung öffnet die Nachricht; Meldungen nennen nur den Host
  der geprüften URL (kein vollständiger URL-Text, keine Betreffzeile in voller Länge).
- **Banner in der Nachrichtenansicht** folgen der Schweregrad-Skala (Farbbalken, Score-Badge, Verdikt)
  und verweisen auf die Forscher-Ansicht; das grüne Authentifizierungs-Badge nutzt dieselbe Skala.

### Fixed

- `Authentication-Results`-Auswertung: DMARC wurde als Liste initialisiert und dadurch mit einem
  führenden Komma angezeigt – jetzt korrekt als Einzelwert.
- Lint-Allow-Liste um die Thunderbird-APIs `messages.get` und `messageDisplay.open` erweitert; die
  i18n-Kataloge deklarieren die Platzhalter der neuen Benachrichtigungstexte.

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
