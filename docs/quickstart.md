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
`node:test`-Dateien des Repositorys aus (`background.test.js`, `api.test.js`, `db.test.js`, `options.test.js`,
`api_gateway.test.js`, `scripts/pre-submit-checks.test.js`, `form_test.js`, `vt_test.js`). Die Thunderbird-APIs
werden in den Tests gemockt, es ist kein Netzwerkzugriff nötig.

## 4. Pre-Submit-Checks

```bash
node ./scripts/pre-submit-checks.js
```

Prüft unter anderem: Manifest V3, Name/Version/Beschreibung/`homepage_url`, Add-on-ID, deklarierte und
**in der richtigen Kantenlänge vorhandene** Icons, `default_locale` samt Katalog und `__MSG_`-Verweise,
`data_collection_permissions` (kein widersprüchliches `"none"`), verbotene Permissions und MV3-inkompatible Keys,
valide Match-Patterns in `optional_host_permissions`, referenzierte Dateien (Hintergrundskripte, Optionsseite,
Popup), Abwesenheit von `install.rdf` sowie Privacy-Policy und Verlinkung auf den Landing-Pages. Ausgabe: eine
Liste `ok:`/`warning:`/`FAILED:`; bei Fehlern ist der Exit-Code ≠ 0, sodass die CI zuverlässig fehlschlägt.
Hinweis: Solange echte Screenshots fehlen, erscheint genau eine Warnung (kein Fehler).

## 5. Lint und Paket bauen

```bash
npx web-ext lint
npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
```

- `npx web-ext lint` (addons-linter) muss **0 Fehler** melden. Die verbleibenden Warnungen sind überwiegend
  `UNSUPPORTED_API`-Hinweise, weil der Linter gegen ein Firefox-Ziel prüft und Thunderbird-APIs wie `messages.*`
  oder `messageDisplay.*` nicht kennt.
- `npx web-ext build …` erzeugt `./build/thundy_av_email_scanner_for_thunderbird-1.6.1.zip` (Dateiname aus dem
  Add-on-Namen). Die Ausschlüsse für Testdateien, `docs/`, `scripts/`, `examples/`, Lockfiles, `install.rdf` und
  Build-Artefakte stehen ausschließlich in `web-ext-config.mjs` (`ignoreFiles`);
  `node scripts/verify-package.js ./build` prüft anschließend Dateiliste und Größe des Pakets.
- Signieren für eine Verteilung: `web-ext` verwendet standardmäßig den **AMO**-Endpunkt
  (`https://addons.mozilla.org/api/v5/`). Für Thunderbird muss der ATN-Endpunkt explizit gesetzt werden:

  ```bash
  # selbst verteilen (unlisted)
  npx web-ext sign --source-dir . --artifacts-dir ./build \
      --amo-base-url https://addons.thunderbird.net/api/v5/ --channel unlisted

  # Einreichung im Add-ons Store (listed), benötigt API-Zugangsdaten von addons.thunderbird.net
  npx web-ext sign --source-dir . --artifacts-dir ./build \
      --amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed
  ```

## 5a. Vollständiges lokales Gate (Ersatz für die blockierte CI)

Ein Befehl prüft alles, was vor einem Pull Request bzw. einer Einreichung nötig ist:

```bash
npm run check
```

Das führt nacheinander aus: Pre-Submit-Checks, das **Submission-Gate** (Go/No-Go-Checkliste aus §10 der
Problemanalyse), die vollständige Testsuite, den Linter mit Filter der bekannten Thunderbird-False-Positives
und den Paketbau inklusive Inhaltsprüfung. Einzeln:

```bash
npm run pre-submit-checks   # Manifest, Rechte, Daten-Deklaration, Screenshots
npm run gate                # Go/No-Go vor der Store-Einreichung
npm test                    # 421 Tests
npm run lint:filtered       # web-ext lint, nur bekannte False-Positives erlaubt
npm run package:verify      # XPI bauen und Inhalt/Größe prüfen
```

Das Gate meldet `BLOCKER:`-Zeilen mit Exit-Code 1, solange Einreichungsvoraussetzungen fehlen (z. B. echte
Screenshots oder ein abgeschlossenes Live-Test-Protokoll) und ist damit die ausführbare Fassung der
Go/No-Go-Liste.

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

1. Add-on laden und die **Einstellungen** öffnen.
2. **Ohne Zustimmung testen:** „Externe Analyse erlauben“ bleibt aus. Ein Scan (Banner, Popup oder Kontextmenü) darf
   nichts an Dritte übertragen; das Banner meldet, dass keine Daten übertragen wurden.
3. **Zustimmung erteilen** und anschließend die Host-Berechtigung für einen Anbieter anfragen lassen (erscheint beim
   ersten Zugriff). Danach die Banner-Schaltflächen „Nur diese Nachricht scannen“ und „Absender dauerhaft scannen“
   prüfen.
4. **Ohne API-Schlüssel** bleiben externe Abfragen ergebnislos; die lokalen Prüfungen (Hashes, Heuristiken,
   Score) laufen trotzdem.
5. **Konsole mitlesen:** in `about:debugging#/runtime/this-thunderbird` beim Add-on auf „Inspect“ klicken und die
   Ausgabe des Hintergrundskripts beobachten (u. a. Warnhinweis, wenn eine Injektion in die Nachrichtenansicht
   fehlschlägt).

## 7. Dokumentation im Repository

- [docs/privacy_policy.md](privacy_policy.md) – Datenschutzerklärung (live:
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html)
- [docs/reviewer_notes.md](reviewer_notes.md) – Berechtigungen, Datenflüsse und Testablauf für Store-Reviewer
- [docs/store_listing.md](store_listing.md) – Listing-Entwurf · [docs/STATUS.md](STATUS.md) – offene Punkte
- [docs/external_service_hardening.md](external_service_hardening.md) – Hinweise zu externen Aufrufen und
  API-Schlüsseln
- [CHANGELOG.md](../CHANGELOG.md) – Änderungen je Version
