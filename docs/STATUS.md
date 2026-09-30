# Status – Thundy AV (Stand: September 2026)

**Add-on:** Thundy AV – Email Scanner for Thunderbird · **Version 1.6.1** · **ID** `thundy-av@bludau-it-services.de`
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
- **Paketbereinigung (g):** `web-ext-config.mjs` (`ignoreFiles`) — die einzige Ignore-Quelle, `.webextignore` wurde
  entfernt — hält Testdateien, `docs/`, `scripts/`, `examples/`, Lockfiles, `install.rdf` und Entwicklungs-Artefakte
  aus dem Build. Das XPI enthält nur noch 17 Dateien (185.470 Bytes entpackt statt vorher 62 Dateien/605 KB);
  `scripts/verify-package.js` prüft den Paketinhalt. Toter Code (`content_script.js`) und die Legacy-Dateien sind
  entfernt.
- **Lokalisierung:** Vollständig über `_locales/en` und `_locales/de` – Manifest-Strings, Banner-Texte, Optionsseite
  und Popup (Mechanik: `data-i18n*`-Attribute plus `t()`-Helfer mit deutschem Markup-Fallback; abgesichert durch
  `test/i18n.test.js`).
- **Pre-Submit-Checks (H1):** `scripts/pre-submit-checks.js` prüft Manifest, Datenschutzerklärung, Daten-Deklaration
  und Rechte und liefert einen echten Exit-Code.
- **Tests/CI:** `npm test` führt alle `node:test`-Dateien aus (Consent-, Tier-, Permission-, Daten-Deklarations- und
  MV3-Portierungs-, Lokalisierungs- und Vertragstests enthalten) und ist grün (**422 Tests, 0 Fehler**);
  `web-ext lint` meldet 0 Fehler und
  **18 Warnungen**, die vollständig als bekannte Thunderbird-False-Positives gefiltert sind
  (`scripts/filter-lint-warnings.js`). Der im Repository aktive Workflow (`.github/workflows/ci.yml`, Node 22)
  läuft `npm ci`, die Pre-Submit-Checks, `node --test background.test.js` und `npx web-ext lint`. Die vollständige
  Fassung — `npm test`, Lint-Filter, `web-ext build` mit Paketprüfung und ein manueller Signier-Job mit
  `--amo-base-url https://addons.thunderbird.net/api/v5/` — liegt einsatzbereit in [`docs/ci/`](ci/README.md).
  Die Übernahme nach `.github/workflows/` scheitert weiterhin an der fehlenden `workflows`-Berechtigung des
  verwendeten Tokens (Fehler erneut reproduziert, siehe Aufgabenplan A-19).
- **Dokumente/Policy:** Datenschutzerklärung (`docs/privacy_policy.md`), Reviewer-Hinweise
  (`docs/reviewer_notes.md`), Listing-Entwurf (`docs/store_listing.md`); Live-Policy unter
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html.

## Completed in 1.6.1 (Store-Readiness-Paket)

Grundlage ist die neue [Problemanalyse](PROBLEMANALYSE_STORE_READINESS.md) mit
[Aufgabenplan](AUFGABENPLAN_STORE_READINESS.md); dort stehen Durchführungsstand (§0), Go/No-Go (§10) und die
blockierten Punkte (§0.1) im Detail.

- **Daten-Deklaration korrigiert (P0-4):** `data_collection_permissions` deklariert `personalCommunications`
  jetzt als **optional** (`"required": ["none"]`); beim Aktivieren von „Externe Analyse erlauben“ fragt
  `options.js` zusätzlich die optionale Datenberechtigung an und gibt sie beim Abschalten zurück. Begründung
  mit Validator-Nachweis: [data_collection_decision.md](data_collection_decision.md).
- **Fehler werden sichtbar (P1-11):** Eine fehlgeschlagene Banner-Injektion wird protokolliert, als Diagnose
  gespeichert und einmal pro Sitzung gemeldet; das Popup zeigt die letzte Diagnose mit „Ausblenden“-Option,
  fehlt die Host-Berechtigung, erklärt das Banner den Weg dorthin und das Popup bietet eine zuverlässige
  Freigabe per Klick (echte Nutzer-Geste).
- **MV3-Bereinigung (P1-10):** Die in MV3 entfernten APIs und der unerreichbare
  `scripting.messageDisplay.executeScript`-Zweig sind entfernt; `web-ext lint` meldet 18 statt 26 Warnungen.
- **Vollständige Lokalisierung (P1-9):** Optionsseite und Popup nutzen `browser.i18n`/`_locales` (151 Schlüssel
  je Sprache, deutscher Markup-Text als Fallback), abgesichert durch `test/i18n.test.js`.
- **Zentrale Netzwerkbehandlung (P2-16):** Alle Anbieter-Anfragen (inkl. Datei-Upload und Popup-Abruf) laufen
  über `apiGateway.fetchWithTimeout`.
- **Signierweg korrigiert (P1-6):** Dokumentation und `docs/ci/release.yml` signieren über
  `--amo-base-url https://addons.thunderbird.net/api/v5/` statt (web-ext-Default) über AMO.
- **Reviewer-Paket (A-15/A-33):** [live_test_protocol.md](live_test_protocol.md),
  [testdata.md](testdata.md) mit reproduzierbaren Testnachrichten (`node scripts/make-testdata.js`) und
  Antwortkatalog für erwartete Review-Fragen in den Reviewer-Hinweisen.
- **Ausführbares Go/No-Go:** `npm run gate` (`scripts/submission-gate.js`) prüft die Einreichungsvoraussetzungen
  (Versionen, Screenshots, abgeschlossener Live-Test, Lokalisierung, Reviewer-Paket, Signierziel) und meldet
  offene Punkte als `BLOCKER:` mit Exit-Code 1; `npm run check` bündelt Pre-Submit-Checks, Gate, Tests, Lint
  und Paketprüfung als lokalen Ersatz für die (blockierte) CI.
- **Regressionsschutz:** `test/store_readiness.test.js` verankert die Review-relevanten Entscheidungen,
  `test/i18n.test.js` die Vollständigkeit der Sprachkataloge (zusammen 410 Tests, 0 Fehler).

## Remaining

- **Manuelle Verifikation in Thunderbird 140 ESR (Pflicht vor der Einreichung):** Banner-Injektion, der
  `message_display_action`-Kontextmenüeintrag („Alle Links dieser Nachricht scannen“) sowie der
  Time-of-Click-Hinweis sind nur durch Unit-Tests mit gemockten Thunderbird-APIs abgedeckt. Ebenfalls zu prüfen:
  `permissions.request()` aus dem Banner heraus (Nutzer-Geste über `runtime.sendMessage`) sowie der Link-Kontext
  `contexts: ["link"]`, der in Thunderbird nicht dokumentiert ist. Ablauf: [quickstart.md](quickstart.md).
- **Echte Store-Screenshots:** In `docs/screenshots/` liegen nur SVG-Platzhalter; es fehlen Screenshots aus einer
  echten Thunderbird-Instanz.
- **Store-Einreichung:** Noch nicht bei addons.thunderbird.net eingereicht – Listing ausfüllen, Privacy-Policy-URL,
  Screenshots und Releasenotes hochladen, Paket über ATN signieren
  (`npx web-ext sign --amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed`); die von `web-ext`
  sonst verwendete AMO-Adresse ist für dieses Add-on falsch. Es existiert noch keine Store-URL.
- **Nach der Einreichung:** Pflege der Releasenotes, Beantwortung von Reviewer-Rückfragen, Aktualisierung dieser
  Datei.

## Referenzen

- **Aktuelle Problemanalyse (Version 1.6):** [docs/PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) ·
  **Aufgabenplan:** [docs/AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md)
- Befunde und Roadmap der Version 1.5 (Baseline): [docs/STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md)
- Datenschutzerklärung: [docs/privacy_policy.md](privacy_policy.md) ·
  live: https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Reviewer-Hinweise: [docs/reviewer_notes.md](reviewer_notes.md) · Listing-Entwurf:
  [docs/store_listing.md](store_listing.md)
- Entwickler-Quickstart: [docs/quickstart.md](quickstart.md) · Änderungen: [CHANGELOG.md](../CHANGELOG.md)
