# Status – Thundy AV (Stand: September 2026)

**Add-on:** Thundy AV – Email Scanner for Thunderbird · **Version 1.6.0** · **ID** `thundy-av@bludau-it-services.de`
**Zielplattform:** Thunderbird 140.0 oder neuer (Manifest V3) · **Lizenz:** MIT

> **Nachprüfung 2026-09-29:** Das unabhängige [Store-Readiness-Audit](STORE_READINESS_AUDIT.md) hat den
> Stand `ae2a08e` erneut geprüft und **5 Blocker (B1–B5), 7 hohe (H1–H7) und 12 mittlere Befunde (M1–M12)**
> dokumentiert. Stand dieser Datei: Die Blocker sind im **Arbeitsbaum** adressiert (Consent-Gate im
> Popup, Popup-Rendering, Banner-Buttons, Link-Extraktion, Time-of-Click, `menus`-Berechtigung,
> Datenklassifizierung, Versions-/Paket-Hygiene) — die Änderungen sind **noch uncommitted** und im
> [CHANGELOG](../CHANGELOG.md) unter `[1.6.0] – 2026-09-29` aufgeführt. Zu korrigierende bzw. zu
> präzisierende Angaben in dieser Datei:
> - „15 Dateien (≈176 KB)“ (Zeile 33 der Vorversion) war falsch: der Audit maß am Stand `ae2a08e`
>   **17 Dateien / 179.276 B** entpackt. Nach den Fixes gemessen: **17 Dateien / 216.804 B** entpackt,
>   ZIP **58.997 B** (Abschnitt „Release-/Versionslage“, `docs/store_listing.md` Abschnitt 9).
> - „Alle Banner-/Link-Funktionen“ sind nicht belegt: die Link-/URL-Prüfung war wegen
>   `extractTextFromParts(fullMessage.parts || fullMessage)` (`background.js:1048`) wirkungslos. Das ist
>   behoben; der Live-Test in Thunderbird 140 ESR (H6) steht weiterhin aus.
> - `.webextignore` ist **kein** Verpackungsmechanismus (M6): `web-ext`/`addons-linter` lesen die Datei
>   nicht; sie wurde entfernt, wirksam sind nur die `ignoreFiles`-Regeln in `web-ext-config.mjs`.
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
- **Paketbereinigung (g):** `web-ext-config.mjs` (`ignoreFiles`) hält Testdateien, `docs/`, `scripts/`,
  `examples/`, Lockfiles, `install.rdf` und Entwicklungs-Artefakte aus dem Build. Das XPI enthält nur noch
  **17 Dateien** (gemessen 2026-09-29: 216.804 B entpackt, ZIP 58.997 B; am Stand `ae2a08e` waren es 179.276 B —
  vorher 62 Dateien/605 KB); `scripts/verify-package.js` prüft den Paketinhalt. Toter Code (`content_script.js`)
  und die Legacy-Dateien sind entfernt. Die zwischenzeitlich zusätzlich angelegte `.webextignore` war wirkungslos
  (M6) und ist entfernt.
- **Lokalisierung:** Manifest-Strings und Banner-Texte über `_locales/en` und `_locales/de` inklusive
  englischer Fallbacks im Hintergrundskript; die Options- und Popup-Seite selbst sind weiterhin nur
  deutsch (`<html lang="de">`).
- **Pre-Submit-Checks (H1, B4, B5, M2):** `scripts/pre-submit-checks.js` prüft Manifest, Datenschutzerklärung,
  Rechte und liefert einen echten Exit-Code; zusätzlich validiert er die Datenklassifizierung gegen die Regeln
  des Add-on-Linters, gleicht jede zur Laufzeit genutzte privilegierte API (`browser.menus`, `messages.*`,
  `messageDisplay.*`, `scripting.*`, `notifications.*`, `downloads.*`, `storage.local`) mit
  `manifest.permissions` ab und vergleicht die Versionen von `manifest.json` und `package.json` exakt. Der
  Schritt läuft in der CI.
- **Audit-Fixes 2026-09-29 (B1–B5, H2, H3, M6, M7):** Consent-Gate und Rendering im Popup, vollständiger
  `MessageHeader` für die Banner-Buttons, `extractTextFromParts(fullMessage)`, lokale Time-of-Click-Prüfung,
  `menus`-Berechtigung, Datenklassifizierung `required: ["none"]` / `optional: ["personalCommunications"]`,
  Versionsschreibweise `1.6.0`, Paket-/Dependency-Hygiene. Details: [CHANGELOG](../CHANGELOG.md),
  `[1.6.0] – 2026-09-29`. Diese Punkte sind im Arbeitsbaum umgesetzt, aber noch nicht committed.
- **Pre-Submit-Checks (H1, B4, B5, M2):** `scripts/pre-submit-checks.js` prüft Manifest, Datenschutzerklärung,
  Rechte und liefert einen echten Exit-Code; zusätzlich validiert er die Datenklassifizierung gegen die Regeln
  des Add-on-Linters, gleicht jede zur Laufzeit genutzte privilegierte API (`browser.menus`, `messages.*`,
  `messageDisplay.*`, `scripting.*`, `notifications.*`, `downloads.*`, `storage.local`) mit
  `manifest.permissions` ab und vergleicht die Versionen von `manifest.json` und `package.json` exakt. Der
  Schritt läuft in der CI.
- **Lokalisierung:** Manifest-Strings und Banner-Texte über `_locales/en` und `_locales/de` inklusive
  englischer Fallbacks im Hintergrundskript; die Options- und Popup-Seite selbst sind weiterhin nur
  deutsch (`<html lang="de">`).
- **Tests/CI:** `npm test` führt alle `node:test`-Dateien aus (Consent-, Tier-, Permission- und MV3-Portierungs-Tests
  enthalten). Der Audit nennt für den Stand `ae2a08e` 389 Tests (0 Fehler); diese Zahl wurde hier **nicht**
  erneut gemessen (siehe Remaining). Der im Repository aktive Workflow
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

- **Manuelle Verifikation in Thunderbird 140 ESR (Pflicht vor der Einreichung, H6):** Banner-Injektion, beide
  Kontextmenüeinträge (`contexts: ["link"]` — seit Thunderbird 89 unterstützt — und `message_display_action`),
  der lokale Time-of-Click-Hinweis sowie `permissions.request()` aus dem Banner heraus (Nutzer-Geste über
  `runtime.sendMessage`) sind nur durch Unit-Tests mit gemockten Thunderbird-APIs abgedeckt. Ablauf:
  [quickstart.md](quickstart.md).
- **Echte Store-Screenshots (H4):** In `docs/screenshots/` liegen nur drei SVG-Skizzen; es fehlen Screenshots
  aus einer echten Thunderbird-Instanz (≥ 1280 × 800). Die Icons sind dagegen format- und größenkonform,
  aber generiertes Platzhalter-Artwork (`docs/store_assets.md`).
- **Reviewer-Testmittel (H7):** Eine harmlose Testnachricht liegt jetzt bei
  (`test/fixtures/reviewer-sample.eml`, Import und Prüfschritte in `docs/reviewer_notes.md`, Abschnitt 8.6).
  Ein dedizierter, widerrufbarer Provider-Testkey fehlt weiterhin; ohne ihn kann die externe Analyse von
  einem Reviewer nicht vollständig nachvollzogen werden.
- **Release-/Versionslage (H5):** Ist-Stand und offene Entscheidungen im gleichnamigen Abschnitt unten.
- **CI (M1):** Die Übernahme von `docs/ci/ci.yml` nach `.github/workflows/` bleibt ein manueller Schritt
  (das verwendete Token hat kein `workflows`-Recht). Die aktive CI führt weiterhin nur
  `node --test background.test.js` aus, nicht die übrigen Testdateien; `npm test` wurde für diesen Stand
  nicht neu ausgeführt (die Zahl „389 Tests“ beschreibt den Auditstand `ae2a08e`).
- **Store-Einreichung:** Noch nicht bei addons.thunderbird.net eingereicht – Listing ausfüllen,
  Privacy-Policy-URL, Screenshots und Releasenotes (EN/DE, `docs/store_listing.md` Abschnitte 6/7) hochladen,
  Paket signieren (`npx web-ext sign --channel listed`). Es existiert noch keine Store-URL.
- **Optional: Lokalisierung der Oberfläche:** Options- und Popup-Seite sind derzeit nur auf Deutsch; lokalisiert
  sind bisher nur Manifest-Strings und Banner.
- **Nach der Einreichung:** Pflege der Releasenotes, Beantwortung von Reviewer-Rückfragen, Aktualisierung dieser
  Datei.

## Release-/Versionslage

**Entscheidung:** Die Store-Einreichung erfolgt mit **1.6.0** aus `main`; `manifest.json` und `package.json`
sind auf `1.6.0` angeglichen (`scripts/pre-submit-checks.js` vergleicht beide exakt).

**Ist-Stand der öffentlichen Releases/Tags** (selbst abgefragt am 2026-09-29):

```bash
gh api 'repos/VaZuLeS/Thunderbird-Antivirus/releases?per_page=100' \
  --jq '.[] | select(.tag_name != "") | {tag: .tag_name, prerelease: .prerelease, draft: .draft,
        target: .target_commitish, assets: [.assets[].name]}'
gh api 'repos/VaZuLeS/Thunderbird-Antivirus/tags?per_page=100' --jq '.[].name'
```

Ergebnis (gekürzt):

| Release | `target_commitish` | Draft | Pre-Release | Asset |
|---|---|---|---|---|
| `v1.6`, `v1.6.1`, `v1.7.0`, `v1.7.1`, `v1.8.0` … `v1.18.0` | `cline/nhfqgaap` | false | **true** | jeweils `thundy-av-<version>.xpi` |
| `v1.5` | `main` | **true** | false | `thunderbird_security_antivirus-1.5.zip` |
| `Thunderbird` (2024) | `main` | false | false | `thunderbird_email_antivirus.xpi` |

Zusätzlich existieren die Tags `v1.6` … `v1.18.0` sowie `Thunderbird`.

- Die Releases mit Versionen bis `v1.18.0` stammen aus dem Entwicklungsbranch `cline/nhfqgaap`, sind
  **keine Store-Releases** und **nicht store-signiert**: die XPI-Assets enthalten keinen `META-INF/`-Ordner.
  Geprüft mit `gh release download v1.6 --repo VaZuLeS/Thunderbird-Antivirus --pattern '*.xpi'` →
  `thundy-av-1.6.xpi` (51.662 B, 24 Einträge, kein `META-INF`, `"version": "1.6"`); ebenso
  `v1.18.0` (27 Einträge, kein `META-INF`).
- Positiv: Die Code-Releases sind bereits als **Pre-Release** gekennzeichnet (`prerelease: true`); die
  H5-Empfehlung ist für sie damit umgesetzt.
- Offen/empfohlen: Der alte Draft `v1.5`, das Release `Thunderbird` (2024, keine Pre-Release-Kennzeichnung)
  und die Tag-Historie bis `v1.18.0` sollten gelöscht oder eindeutig als historisch markiert werden.
  Ebenso ist zu entscheiden, ob die Store-Version bei `1.6.0` bleibt: ATN vergleicht Versionen nur innerhalb
  derselben Add-on-ID, die öffentliche Repo-Historie reicht aber bis `1.18.0`.

## Referenzen

- Aktueller Befundstand: [docs/STORE_READINESS_AUDIT.md](STORE_READINESS_AUDIT.md) (Stand 2026-09-29)
- Historische Analyse (1.5/1.6-Umsetzung): [docs/STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md)
- Datenschutzerklärung: [docs/privacy_policy.md](privacy_policy.md) ·
  live: https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Reviewer-Hinweise: [docs/reviewer_notes.md](reviewer_notes.md) · Listing-Entwurf:
  [docs/store_listing.md](store_listing.md)
- Entwickler-Quickstart: [docs/quickstart.md](quickstart.md) · Änderungen: [CHANGELOG.md](../CHANGELOG.md)
