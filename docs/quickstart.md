# Quickstart – Thundy AV (Thunderbird WebExtension)

Kurzanleitung zum Bauen, Testen und Laden des Add-ons **Thundy AV – Email Scanner for Thunderbird**
(Vertiefung: [README.de.md](../README.de.md) bzw. [README.md](../README.md)). Das Add-on ist ein
WebExtension-Add-on (Manifest V3) für Thunderbird 140+; es gibt keine Server-Komponente und keinen Build-Schritt
für Quellcode – `web-ext` packt die Dateien des Repositorys direkt.

## 1. Voraussetzungen

- **Thunderbird 140.0 oder neuer** (Manifest V3, `data_collection_permissions`).
- **Node.js ≥ 20** und npm (CI nutzt Node 22); nötig für Tests, Lint und Paketbau.
- Optional: API-Schlüssel der Analysedienste, die du nutzen willst (Hybrid Analysis, VirusTotal, urlscan.io, URLhaus,
  AbuseIPDB).

## 2. Repository holen und Abhängigkeiten installieren

```bash
git clone https://github.com/VaZuLeS/Thunderbird-Antivirus.git
cd Thunderbird-Antivirus
npm ci
```

`npm ci` installiert nur die Dev-Abhängigkeiten (`jsdom` für die Unit-Tests, `web-ext`/`addons-linter` für Lint und
Build). Zum Laden des Add-ons in Thunderbird sind sie nicht erforderlich.

## 3. Unit-Tests ausführen

```bash
npm test
```

`npm test` entspricht dem Skript aus `package.json` (`node --test --test-reporter=spec`) und führt damit **alle**
`node:test`-Dateien des Repositorys aus (`background.test.js`, `api.test.js`, `db.test.js`,
`options.test.js`, `api_gateway.test.js`, `message_display.test.js`, `scripts/pre-submit-checks.test.js`,
`form_test.js`, `vt_test.js`). Die Thunderbird-APIs werden in den Tests gemockt, es ist kein Netzwerkzugriff nötig.
Aktueller Stand: **462 Tests, 0 Fehler**.

## 4. Pre-Submit-Checks

```bash
node ./scripts/pre-submit-checks.js
```

Prüft unter anderem: Manifest V3, Name/Version/Beschreibung/`homepage_url`, Add-on-ID, deklarierte und
**in der richtigen Kantenlänge vorhandene** Icons, `default_locale` samt Katalog und `__MSG_`-Verweise,
`data_collection_permissions` (kein widersprüchliches `"none"`), verbotene Permissions und MV3-inkompatible Keys,
valide Match-Patterns in `optional_host_permissions`, referenzierte Dateien (Hintergrundskripte, Optionsseite,
Popup), Abwesenheit von `install.rdf` sowie Privacy-Policy und Verlinkung auf den Landing-Pages. Zusätzlich prüft
das Skript, dass **jeder verwendete `browser.*`-API-Namespace eine deklarierte Berechtigung hat**, dass die
Datenkonsent-Deklaration zu den Übermittlungspfaden passt und dass ein **programmatisch registriertes Skript**
(`message_display.js`) im Paket liegt. Ausgabe: eine
Liste `ok:`/`warning:`/`FAILED:`; bei Fehlern ist der Exit-Code ≠ 0, sodass die CI zuverlässig fehlschlägt.
Hinweis: Solange echte Screenshots fehlen, erscheint genau eine Warnung (kein Fehler).

## 5. Lint und Paket bauen

```bash
npx web-ext lint
npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
```

- `npx web-ext lint` (addons-linter) muss **0 Fehler** melden. Aktuell bleiben **25 Warnungen**, alle davon bekannte
  Thunderbird-False-Positives (überwiegend `UNSUPPORTED_API`-Hinweise, weil der Linter gegen ein Firefox-Ziel prüft
  und Thunderbird-APIs wie `messages.*` oder `messageDisplay.*` nicht kennt); `scripts/filter-lint-warnings.js`
  kennt diese Liste.
- `npx web-ext build …` erzeugt `./build/thundy_av_email_scanner_for_thunderbird-1.6.zip` (Dateiname aus dem
  Add-on-Namen). Aktueller Inhalt: **18 Dateien / 270.797 Bytes entpackt** (neu: `message_display.js`). Die
  Ausschlüsse für Testdateien, `docs/`, `scripts/`, `examples/`, Lockfiles, `install.rdf` und
  Build-Artefakte stehen in `web-ext-config.mjs` (`ignoreFiles`, ergänzt durch `.webextignore`);
  `node scripts/verify-package.js ./build` prüft anschließend Dateiliste und Größe des Pakets.
- Signieren für eine Verteilung: `npx web-ext sign --channel unlisted` (selbst verteilen) oder
  `npx web-ext sign --channel listed` (Einreichung im Add-ons Store, benötigt API-Zugangsdaten von
  addons.thunderbird.net).

## 6. In Thunderbird laden

**Variante A – temporäres Add-on (für die Entwicklung empfohlen):**

```text
Thunderbird → ☰ → Add-ons und Themes → Zahnrad-Symbol → "Add-ons debuggen"
(öffnet about:debugging#/runtime/this-thunderbird)
→ "Temporäres Add-on laden…" → manifest.json im Repository auswählen
```

Temporäre Add-ons werden beim Beenden von Thunderbird entfernt und müssen danach neu geladen werden.

**Variante B – Thunderbird über web-ext starten:**

```bash
npx web-ext run --firefox=/pfad/zu/thunderbird
```

`web-ext` kennt **kein** `--target thunderbird` (gültige Targets: `firefox-desktop`, `firefox-android`, `chromium`).
Der Pfad zur Thunderbird-Binärdatei wird über `--firefox` übergeben, optional mit einem separaten Profil über
`--firefox-profile`.

**Variante C – gebaute XPI installieren:** siehe Abschnitt „Manuelle Installation einer gebauten XPI“ in
[README.md](../README.md). Eine lokal gebaute XPI ist unsigniert; Thunderbird-Release-Builds installieren sie nur mit
deaktivierter Signaturprüfung (`about:config` → `xpinstall.signatures.required = false`).

### Testablauf (Kurzfassung)

Der Live-Test in Thunderbird ist **noch nicht durchgeführt** – die folgenden Schritte beschreiben, wie er
nachvollzogen wird (dieselben Schritte in ausführlicher Form: [reviewer_notes.md](reviewer_notes.md), Abschnitt 8).

1. Add-on temporär laden und die **Einstellungen** öffnen.
2. **Ohne Zustimmung testen:** „Externe Analyse erlauben“ bleibt aus. Ein Scan (Banner, Popup oder Kontextmenü) darf
   nichts an Dritte übertragen; das Banner meldet, dass keine Daten übertragen wurden, und das Popup zeigt nur die
   Hinweiskarte statt Anbieter-Abfragen.
3. **Zustimmung erteilen** und speichern. Beim Aktivieren der globalen Zustimmung fragt die Optionsseite – wo die
   Umgebung es anbietet – zusätzlich die eingebaute Datenkategorie `personalCommunications` an; eine Ablehnung
   deaktiviert die globale Zustimmung wieder. Anschließend die Host-Berechtigung für einen Anbieter anfragen lassen.
   Aus dem Banner heraus löst das Hintergrundskript `permissions.request()` aus; es erscheint der Berechtigungsdialog.
   Danach die Banner-Schaltflächen „Nur diese Nachricht scannen“ und „Absender dauerhaft scannen“ prüfen.
4. **Banner und Warnung prüfen:** eine Nachricht mit Anhang/Link öffnen (Opt-in-Banner mit den Buttons); bei einem
   lokalen Risiko-Score ≥ 50 erscheint das rote Warnbanner mit Begründungsliste, bei bestandener
   SPF-/DKIM-/DMARC-Prüfung der grüne Badge.
5. **Link anklicken (Time-of-Click):** Links im Nachrichtentext sind markiert (gestrichelte Unterstreichung,
   Tooltip). Der Klick löst die Prüfung aus; bösartige oder nicht verifizierbare Links werden mit Begründungen und
   der Schaltfläche „Link trotzdem öffnen“ blockiert.
6. **Popup öffnen** (Button in der Nachrichtenansicht): Kopfzeilendaten und gespeicherte Ergebnisse erscheinen;
   zusätzlich die beiden Kontextmenü-Einträge prüfen („Link mit Thundy AV scannen“ per Rechtsklick auf einen Link,
   „Alle Links dieser Nachricht scannen“ im Kontext der Nachrichtenansicht).
7. **Ohne API-Schlüssel** bleiben externe Abfragen ergebnislos; die lokalen Prüfungen (Hashes, Heuristiken,
   Score) laufen trotzdem.
8. **Konsole mitlesen:** in `about:debugging#/runtime/this-thunderbird` beim Add-on auf „Inspect“ klicken und die
   Ausgabe des Hintergrundskripts beobachten. Lässt sich das Message-Display-Skript nicht registrieren, protokolliert
   der Code den Fehler und erzeugt eine Systembenachrichtigung (`notificationUiUnavailable`).

## 7. Dokumentation im Repository

- [docs/privacy_policy.md](privacy_policy.md) – Datenschutzerklärung (live:
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html)
- [docs/reviewer_notes.md](reviewer_notes.md) – Berechtigungen, Datenflüsse und Testablauf für Store-Reviewer
- [docs/store_listing.md](store_listing.md) – Listing-Entwurf · [docs/STATUS.md](STATUS.md) – offene Punkte
- [docs/external_service_hardening.md](external_service_hardening.md) – Hinweise zu externen Aufrufen und
  API-Schlüsseln
- [CHANGELOG.md](../CHANGELOG.md) – Änderungen je Version
