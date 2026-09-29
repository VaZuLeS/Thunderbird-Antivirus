# Status – Thundy AV (Stand: September 2026)

**Add-on:** Thundy AV – Email Scanner for Thunderbird · **Version 1.6** · **ID** `thundy-av@bludau-it-services.de`
**Zielplattform:** Thunderbird 140.0 oder neuer (Manifest V3) · **Lizenz:** MIT

> **Nachprüfung 2026-09-29:** Das unabhängige [Store-Readiness-Audit](STORE_READINESS_AUDIT.md)
> hat den Stand `ae2a08e` erneut geprüft und dabei **5 Blocker, 7 hohe und 12 mittlere Befunde**
> dokumentiert, die in dieser Datei (Stand der 1.6-Umsetzung) noch nicht abgebildet sind. Abweichende
> bzw. zu korrigierende Angaben in dieser Datei:
> - „Blocker behoben“ gilt nur für die 1.5-Befunde (MV3-APIs, Paketbereinigung, Policy, Icons). Es
>   gibt neue Blocker: Consent-Bypass im Popup (`api.js:513-530`), defektes Popup
>   (`api.js:216`/`208`), funktionslose Banner-Buttons (`background.js:1951`), fehlende
>   `menus`-Berechtigung und inhaltlich falsche `data_collection_permissions`.
> - „15 Dateien (≈176 KB)“ (Zeile 33) ist falsch: aktuell **17 Dateien / 179.276 B** entpackt.
> - „Alle Banner-/Link-Funktionen“ sind nicht belegt: die Link-/URL-Prüfung ist wegen
>   `extractTextFromParts(fullMessage.parts || fullMessage)` (`background.js:1048`) wirkungslos.
> Maßgeblich für den Store-Reifegrad ist das Audit, nicht die Abschnitte „Completed in 1.6“.

## Completed in 1.6

Die Store-Readiness-Befunde aus [docs/STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md) wurden in 1.6
abgearbeitet:

- **Blocker B1 (MV3-APIs):** Portierung auf `messageDisplay.onMessagesDisplayed` und
  `getDisplayedMessages()` statt der in MV3 entfernten Varianten (`getFirstDisplayedMessage()`,
  `messageListToArray()`, Legacy-Fallback nur noch als Kompatibilitätspfad). Injektionen in die
  Nachrichtenansicht laufen zentral über `injectIntoMessageDisplay()`: Es nutzt
  `scripting.messageDisplay.executeScript`, sobald Thunderbird das anbietet, und fällt derzeit auf
  `scripting.executeScript({ target: { tabId } })` zurück (Thunderbirds `scripting.messageDisplay` bietet
  aktuell nur `registerScripts`/`unregisterScripts`; deshalb steht der Live-Test in Thunderbird noch aus).
- **Blocker B2/B3 (Datenschutz):** Globale Zustimmung *„Externe Analyse erlauben“* (Default **AUS**) ist
  Voraussetzung für jede Übermittlung und wird im Hintergrundskript zentral erzwungen
  (`mayTransmitExternally()` / `assertExternalAnalysisAllowed()`, Fehlercode `EXTERNAL_ANALYSIS_DISABLED`).
  Datenschutz-Stufe Default jetzt `strict` (nur SHA-256-Hashes); `balanced` (zusätzlich Anhang-Upload unbekannter
  Dateien) und `max` (zusätzlich URL-Upload) nur nach bewusster Auswahl.
- **Blocker B4 (Manifest/Rechte):** Host-Berechtigungen liegen in `optional_host_permissions` (nicht mehr
  `optional_permissions`), Patterns korrigiert und fehlende Origins ergänzt (Hybrid Analysis, VirusTotal,
  urlscan.io, URLhaus, AbuseIPDB); angefragt wird zur Laufzeit nur für den tatsächlich genutzten Anbieter.
- **Banner (b):** Zwei Schaltflächen – *„Nur diese Nachricht scannen“* und *„Absender dauerhaft scannen“*.
- **IP-Reputation (M9/H):** Optionale Prüfung der sendenden Mailserver-IPs über VirusTotal oder AbuseIPDB,
  konfigurierbar in den Einstellungen.
- **Name/ID/Icon (f):** Name „Thundy AV – Email Scanner for Thunderbird“, `short_name` „Thundy AV“, neue ID
  `thundy-av@bludau-it-services.de`, Icons 16/32/64 px, `options_ui.open_in_tab` statt `browser_style`.
- **Paketbereinigung (g):** `web-ext-config.mjs` (`ignoreFiles`, ergänzt durch `.webextignore`) hält Testdateien,
  `docs/`, `scripts/`, `examples/`, Lockfiles, `install.rdf` und Entwicklungs-Artefakte aus dem Build. Das XPI
  enthält nur noch 15 Dateien (≈176 KB entpackt statt vorher 62 Dateien/605 KB); `scripts/verify-package.js` prüft
  den Paketinhalt in der CI. Toter Code (`content_script.js`) und die Legacy-Dateien sind entfernt.
- **Lokalisierung:** Manifest-Strings und Banner-Texte über `_locales/en` und `_locales/de` inklusive
  englischer Fallbacks im Hintergrundskript.
- **Pre-Submit-Checks (H1):** `scripts/pre-submit-checks.js` prüft Manifest, Datenschutzerklärung und Rechte und
  liefert einen echten Exit-Code; der Schritt läuft in der CI.
- **Tests/CI:** `npm test` führt alle `node:test`-Dateien aus (Consent-, Tier-, Permission- und MV3-Portierungs-Tests
  enthalten) und ist grün (389 Tests, 0 Fehler). Der im Repository aktive Workflow
  (`.github/workflows/ci.yml`, Node 22) läuft `npm ci`, die Pre-Submit-Checks (jetzt mit echtem Exit-Code),
  `node --test background.test.js` und `npx web-ext lint`. Die erweiterten Definitionen — vollständiger
  `npm test`, Lint-Filter für bekannte Thunderbird-False-Positives
  (`scripts/filter-lint-warnings.js`), `web-ext build` mit Paketprüfung (`scripts/verify-package.js`) und ein
  manueller Signier-Job (`web-ext sign --channel`) — liegen einsatzbereit in [`docs/ci/`](ci/README.md).
  Sie konnten in dieser Umgebung nicht unter `.github/workflows/` committed werden, weil das verwendete Token
  keine `workflows`-Berechtigung besitzt (GitHub lehnt solche Pushes ab). Übernahme: `docs/ci/README.md`.
- **Dokumente/Policy:** Datenschutzerklärung (`docs/privacy_policy.md`), Reviewer-Hinweise
  (`docs/reviewer_notes.md`), Listing-Entwurf (`docs/store_listing.md`); Live-Policy unter
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html.

## Remaining

- **Manuelle Verifikation in Thunderbird 140 ESR (Pflicht vor der Einreichung):** Banner-Injektion, der
  `message_display_action`-Kontextmenüeintrag („Alle Links dieser Nachricht scannen“) sowie der
  Time-of-Click-Hinweis sind nur durch Unit-Tests mit gemockten Thunderbird-APIs abgedeckt. Ebenfalls zu prüfen:
  `permissions.request()` aus dem Banner heraus (Nutzer-Geste über `runtime.sendMessage`) sowie der Link-Kontext
  `contexts: ["link"]`, der in Thunderbird nicht dokumentiert ist. Ablauf: [quickstart.md](quickstart.md).
- **Echte Store-Screenshots:** In `docs/screenshots/` liegen nur SVG-Platzhalter; es fehlen Screenshots aus einer
  echten Thunderbird-Instanz.
- **Store-Einreichung:** Noch nicht bei addons.thunderbird.net eingereicht – Listing ausfüllen, Privacy-Policy-URL,
  Screenshots und Releasenotes hochladen, Paket signieren (`npx web-ext sign --channel listed`). Es existiert noch
  keine Store-URL.
- **Optional: Lokalisierung der Oberfläche:** Options- und Popup-Seite sind derzeit nur auf Deutsch; lokalisiert sind
  bisher nur Manifest-Strings und Banner.
- **Nach der Einreichung:** Pflege der Releasenotes, Beantwortung von Reviewer-Rückfragen, Aktualisierung dieser
  Datei.

## Referenzen

- Befunde und Roadmap: [docs/STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md)
- Datenschutzerklärung: [docs/privacy_policy.md](privacy_policy.md) ·
  live: https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Reviewer-Hinweise: [docs/reviewer_notes.md](reviewer_notes.md) · Listing-Entwurf:
  [docs/store_listing.md](store_listing.md)
- Entwickler-Quickstart: [docs/quickstart.md](quickstart.md) · Änderungen: [CHANGELOG.md](../CHANGELOG.md)
