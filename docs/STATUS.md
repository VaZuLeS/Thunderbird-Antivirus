# Status – Thundy AV (Stand: September 2026)

**Add-on:** Thundy AV – Email Scanner for Thunderbird · **Version 1.6** · **ID** `thundy-av@bludau-it-services.de`
**Zielplattform:** Thunderbird 140.0 oder neuer (Manifest V3) · **Lizenz:** MIT

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
  enthalten) und ist grün (514 Tests, 0 Fehler). Der im Repository aktive Workflow
  (`.github/workflows/ci.yml`, Node 22) läuft `npm ci`, die Pre-Submit-Checks (jetzt mit echtem Exit-Code),
  `node --test background.test.js` und `npx web-ext lint`. Die erweiterten Definitionen — vollständiger
  `npm test`, Lint-Filter für bekannte Thunderbird-False-Positives
  (`scripts/filter-lint-warnings.js`), `web-ext build` mit Paketprüfung (`scripts/verify-package.js`) und ein
  manueller Signier-Job (`web-ext sign --channel`) — liegen einsatzbereit in [`docs/ci/`](ci/README.md).
  Sie konnten in dieser Umgebung nicht unter `.github/workflows/` committed werden, weil das verwendete Token
  keine `workflows`-Berechtigung besitzt (GitHub lehnt solche Pushes ab). Übernahme: `docs/ci/README.md`.
- **Nachaudit (nach der Umsetzung):** Ein zweiter Durchgang über den Auslieferungscode hat zwei Lücken gefunden und behoben -
  (1) `api.js` (Popup) hat den Analysebericht ohne Zustimmungs-/Berechtigungsprüfung direkt geladen und damit den Hash
  übertragen (jetzt über `externalAnalysisAllowed()` + `hasHybridHostPermission()` gekapselt, mit Tests),
  (2) der Datei-Upload in `background.js` lief am `ApiGateway` vorbei (kein Zeitlimit) und nutzt jetzt ebenfalls
  `apiGateway.fetchWithTimeout(..., 60000)`. Die Nachaudit-Befunde stehen in
  [docs/STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md), Abschnitt 9.
- **Banner-Injektion (H12, behoben):** Die In-Message-UI liegt jetzt in einem eigenen, beim Start registrierten
  Nachrichten-Script (`messageDisplay/banner.js` + `banner.css`), registriert über den dokumentierten MV3-Weg
  `scripting.messageDisplay.registerScripts` (Fallback: Datei-Injektion in bereits geöffnete Tabs). Das Script
  rendert ausschließlich und fragt den Zustand im Hintergrundskript ab (`getDisplayState`),
  per `updateDisplayState`-Push bei Statusänderungen. Dadurch kann der injizierte Code selbst keine Daten übertragen.
- **Kontextmenü (H12, behoben):** Der nicht dokumentierte Kontext `contexts: ["link"]` wurde entfernt; es bleibt der
  dokumentierte `message_display_action`-Eintrag („Alle Links dieser Nachricht scannen“).
- **Permission-Geste (H12, behoben):** `handleRequestScan` ruft kein `permissions.request()` mehr aus dem Hintergrund
  auf (Nutzer-Geste geht über Messaging verloren), sondern meldet `permission_required`; das Banner verweist auf die
  Optionsseite, die die Host-Berechtigung im Klick-Kontext anfragt.
- **Rückmeldungen aus dem ersten Thunderbird-Test (1.6.1):** Score-Konstante 50 behoben (abgestufte Gewichte in
  `SCORE_WEIGHTS`, bösartige IPs fließen jetzt in die Bewertung ein), Erstkontakt-Erkennung korrigiert
  (Abfrage nach `from`, dauerhafte Speicherung der Absender) und die Fehlermeldung „Scan fehlgeschlagen“
  nennt nun die Ursache (`NO_API_KEY`, `PERMISSION_REQUIRED`, `SCAN_FAILED` mit Stufe). Neu ist die manuelle
  Anhang-Analyse im Popup (Anhänge auflisten, Hash lokal berechnen, Upload mit Ergebnisanzeige) inklusive
  transparenter Score-Begründung.
- **Statusverfolgung (1.7.0):** Zeitverzögerte Anbieter-Analysen werden als Aufträge dauerhaft gespeichert und per
  `browser.alarms` (max. 1×/Minute, 30 Versuche, 90 Minuten) nachgefragt; das Verdikt landet im lokalen Cache und
  wird per Benachrichtigung gemeldet. Banner und Popup unterscheiden ausdrücklich „Echtzeit“ (lokale Prüfung) und
  „zeitverzögert“ (externe Analyse) und zeigen den Auftragsstatus inklusive Versuchszahl und Laufzeit.
- **Audit-Runde zu 1.7.0 (Ergebnis in 1.7.1):** Fuenf Befunde im neuen Code gefunden und behoben - wiederholte
  Timeout-Benachrichtigungen bzw. endloser Alarm, nicht ersetzte Platzhalter in Fallback-Texten, fehlende
  `headerMessageId` im Ein-Klick-Scan (verhinderte das Zuordnen des spaeten Ergebnisses), Score-Suche nur ueber die
  Tab-ID sowie eine irrefuehrende Statuszeile. Details in `docs/STORE_READINESS_ANALYSIS.md`, Abschnitt 11.
- **Rollen & Verlauf (1.8.0):** Fuenf Ansichtsrollen (`quiet`/`private`/`business`/`research`/`audit`) steuern
  Detailtiefe und Unterbrechungsniveau in Banner und Popup; ein lokaler Audit-Trail protokolliert jede Uebertragung
  (Anbieter, Datentyp, Datei, Hash, Job-ID, Verdikt, Echtzeit/zeitverzoegert) mit Filter, CSV/JSON-Export und
  Loeschfunktion. Details in `docs/STORE_READINESS_ANALYSIS.md`, Abschnitt 12.
- **XPI-Artefakt:** `npm run build` erzeugt `build/thundy-av-1.6.xpi` und prüft das Paket inklusive Manifest-
  Referenzen und registrierten Nachrichten-Skripten (`scripts/build-xpi.js`, `scripts/verify-package.js`).
- **Tests (aktuell):** 404 Tests, 0 Fehler (u. a. 10 Tests für das Banner-Script in jsdom).
- **Dokumente/Policy:** Datenschutzerklärung (`docs/privacy_policy.md`), Reviewer-Hinweise
  (`docs/reviewer_notes.md`), Listing-Entwurf (`docs/store_listing.md`); Live-Policy unter
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html.

## Artefakt

- **Lokaler Build:** `npm run build` -> `build/thundy-av-1.6.xpi` (unsigniert, 19 Laufzeitdateien) inklusive
  automatischer Paketprüfung (Dateiliste, Manifest-Referenzen, registrierte Nachrichten-Skripte).
- **Veröffentlichte Vorabversion:** https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6
  (Asset `thundy-av-1.6.xpi`, SHA-256 siehe Releasenotes).
- **Installation:** *Add-ons und Themes -> Zahnrad -> Debug Add-ons -> Temporäres Add-on laden* und die `.xpi` auswählen;
  für eine reguläre Installation ist eine Signatur nötig (`web-ext sign --channel listed`, Vorlage `docs/ci/release.yml`).

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
