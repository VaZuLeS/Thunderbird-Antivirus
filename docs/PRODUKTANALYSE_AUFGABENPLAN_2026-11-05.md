# Thundy AV — Produktanalyse und priorisierter Aufgabenplan (Stand: 5. November 2026)

**Rolle:** Technischer Produktarchitekt und erfahrener Thunderbird-Extension-Entwickler
**Projekt:** Thundy AV — E-Mail-Anhang- und Link-Scanner für Mozilla Thunderbird (WebExtension, MV3)
**Bezug:** Stand nach Release v1.24.6 und Dependabot Merge PR #717 (Commit `c6b9506d`)
**Datum:** 05. November 2026
**Status:** Verbindliche architektonische Bestandsaufnahme und evidenzbasierter Entwicklungsplan

---

## 1. Tatsächlicher Stand (Evidenzbasierte Bestandsaufnahme)

### 1.1 Quellenstand, Arbeitsbaum und Veröffentlichungsebenen

Zur Vermeidung von Fehlannahmen wird strikt zwischen Arbeitsbaum, lokalem Git-Stand, CI-Läufen, Release-Tags und tatsächlich veröffentlichten Binärpaketen unterschieden:

| Ebene | Tatsächlicher Zustand | Beleg / Evidenz / Prüfgrenze |
| :--- | :--- | :--- |
| **Commit / HEAD** | `c6b9506dae95d235605c38d39170f2f9785445e6` (Merge PR #717) | `git log -n 1 --pretty=fuller`; Arbeitsbaum ist sauber (`git status`). |
| **Branch** | `jules-988992431634699702-cd69adec` | Lokaler Entwicklungszweig. |
| **Deklarierte Version** | `1.24.6` | Identisch in `package.json` und `manifest.json`. |
| **Git-Tag** | `v1.24.6` zeigt auf `c6f5c4cb...` (HEAD liegt 1 Commit vor Tag durch Merge PR #717) | `git tag -l -n9 "v1.24.*"`; `git log --oneline -n 2`. |
| **Veröffentlichter Stand** | GitHub-Release **1.24.6** ist als Tag/Release dokumentiert; `docs/AKTUELLER_PRODUKTSTAND.md`, `docs/HOTFIX_QUELLENLADEFEHLER_1_24_6.md`. | Ein Git-Tag oder eine Dokumentationsdatei ist noch kein Nachweis einer ATN-Listung (Add-on weiterhin unsigniert auf GitHub). |
| **Paket-Fingerprint** | Paketbau über `pnpm run package` erfolgreich (`build-and-verify-package.js`: 47 Dateien, 1.007.091 Bytes entpackt, SHA-256 `7b141d00...`). | Deterministischer Paketbau über `node scripts/build-and-verify-package.js` mit festen Zeitstempeln (1980-01-01) und DEFLATE-9. |
| **Automatisierte Tests** | **1.085 bestanden, 0 fehlgeschlagen** (73 Testsuiten) | `pnpm test` (über Node.js v22 Test-Runner). Hinweis: Erfordert das Nichtvorhandensein von `pnpm-lock.yaml`, da `test/manifest.test.js` das Vorhandensein von Lockfiles streng prüft. |
| **Linter** | **0 Fehler, 27 bekannte Thunderbird-Warnungen** | `pnpm run lint:filtered` via `scripts/lint-with-filter.js` (alle 27 Warnungen sind kuratierte MailExtension-False-Positives wie `messagesRead`, `messages.getAttachmentFile` etc.). |
| **Store-Readiness-Gate** | C1 (Pre-submit checks), C3 (Linter) und C5 (Screenshots) PASS. C2 (npm test) PASS nach `pnpm install`. C4 (`./build` Ordner), C6 (Live-Testprotokoll 1.24.6 in `docs/audits/candidate-1_24_6.json`) und C7 (Release-Match) erfordern gesonderte Artefakt-Ablage. | Ausführung von `node scripts/submission-gate.js` liefert NO-GO im frischen Quellcheckout, da `./build` erst bei Build entsteht und HEAD 1 Commit nach `v1.24.6` liegt. |
| **Dokumentationslinks** | 57 Dateien, 326 Links geprüft, 0 fehlende Links. | `pnpm run check:docs` (`tools/docs-links.dev.cjs`). |
| **GitHub Pages** | Jekyll-Quellen unter `docs/` mit `docs/_config.yml`. | Verfügbar unter `https://vazules.github.io/Thunderbird-Antivirus/`. |

---

### 1.2 Differenzierte Klassifizierung der Fähigkeiten

Gemäß der architektonischen Vorgabe wird für jede Funktion und Eigenschaft genau ein Status nachvollziehbar vergeben:
- **N:** Implementiert und im benannten Umfang nachgewiesen
- **U:** Implementiert, aber unzureichend geprüft
- **T:** Teilweise umgesetzt
- **K:** Konzeptionell vorbereitet
- **B / ✋:** Offen oder durch konkrete Voraussetzungen blockiert

| Fähigkeit / Baustein | Status | Konkreter Befund und Belege im Code |
| :--- | :---: | :--- |
| **MailExtension-Kernlaufzeit & Time-of-Click** | **N** | MV3-Architektur mit Hintergrundskripten (`manifest.json`, `background.js`). `link_audit.js` serialisiert Klickprüfungen, erzeugt kryptografische Interaktions-IDs, verhindert Mehrfachklicks und schützt vor TOCTOU. Nativ auf Thunderbird 140/153 Linux verifiziert. |
| **Präzise Semantik (OPENED / PENDING)** | **N** | `link_audit.js`: `OPENED` bestätigt ausschließlich die von Thunderbird angenommene Öffnungsanforderung via `windows.openDefaultBrowser`. Kein Webseitenbesuch oder OS-Browserstart wird behauptet. `PENDING` verbleibt nach einem Prozessabbruch (`SIGKILL`) im Audit-Log strikt auf `PENDING` und wird nach Neustart niemals als künstliche Nutzerentscheidung umgedeutet (`test/audit.test.js`, `docs/audits/thunderbird-crash-recovery.json`). |
| **Datenschutz & Einwilligungsmodell** | **N** | Dreistufiges Datenschutzmodell (`strict`, `balanced`, `max`) in `options.js` und `scan_policy.js`. Explizite Opt-in-Berechtigungen für `personalCommunications` und `sensitiveDataUpload`. Keine Übertragung ohne Nutzerkonsens. |
| **Mehrsprachigkeit (6 Sprachen)** | **N** | Vollständige Schlüsselabdeckung in EN, DE, FR, ES, IT, PL in `_locales/*/messages.json`. `scripts/generate-i18n-fallback.js --check` und `test/i18n.test.js` verifizieren Parität und Formatierungsplatzhalter. Dynamischer Fallback auf Englisch (`i18n.js`). |
| **Theming & Designsystem** | **N** | Vereinheitlichtes Designsystem (`theme.js`, `theme.css`, `design_system.js`, `design.css`). Automatische Erkennung nativer Thunderbird-Paletten (Hell/Dunkel), Akzentfarben und Dichte-Einstellungen (`compact`, `touch`, `normal`). WCAG-Kontraste und tastaturbedienbare Komponenten nachgewiesen. |
| **Quellenladefehler & Urteilsdifferenzierung** | **N** | Neu in 1.24.6 (`c6f5c4cb`): Reine Leseprojektion in `analysis_status.js` (`ThundyAnalysis.resources`). Unlesbare Daten erzeugen defensive sechssprachige Teilausfallmeldungen, ohne Originaldaten zu verändern. Dienstkarten unterscheiden auswertbare Urteile von bloßen Antworten („Antworten ohne auswertbares Urteil empfangen“). Cachebereinigung überspringt unlesbare Einträge. |
| **Deterministischer Paketbau** | **N** | `scripts/build-and-verify-package.js` und `scripts/reproducible-package.py` kanonisieren Dateiattribute (Rechte, Zeitstempel 1980-01-01, feste Sortierung, DEFLATE-9), wodurch identische SHA-256-Prüfsummen unter Linux/Python 3.12 und zlib erzeugt werden. |
| **Werkzeugprozess-Härtung (AVN-008.b)** | **N** | `scripts/tool-process.js::runTool` begrenzt lokale Werkzeuge (`web-ext lint`, Paketbau) auf 120s Timeout und 8 MiB Buffer mit `SIGKILL`-Terminierung. Verhindert hängende Buildprozesse. Abgesichert in `scripts/lint-gate.test.js` und `scripts/reproducible-package.test.js`. |
| **Hot-Path IP-Parsing Optimierung** | **N** | `background.js::extractPublicIPs`: Umstellung auf `RegExp.prototype.exec` Schleife statt `String.prototype.match` zur Vermeidung von Array-Allokationen; manuelle `charCodeAt`-Berechnung; Loopback-Fast-Path. |
| **Offline-Enterprise-Vertragskern** | **N** | 30 Module in `enterprise/` (u. a. `contracts.cjs`, `ledger.cjs`, `outbox.cjs`, `storage_jobs.cjs`, `policy_simulation.cjs`). Vollständig lokal durch automatisierte Unit-Tests abgedeckt (`enterprise/test/*.test.js`). |
| **Externe Provider-Live-Prüfung** | **U** | Integrationen für VirusTotal, Hybrid Analysis, URLhaus, AbuseIPDB und urlscan.io sind über Testdoubles und statische Antworten verifiziert (`api_gateway.test.js`, `test/follow-up.test.js`). Reale Live-Verifikation mit echten Produktionskontingenten fehlt. |
| **Dauerhafte Nachrichtenidentität** | **T** | Nachgewiesen in `IDENTITAET_ANALYSEBEFUNDE.md`: Flüchtige Thunderbird `messageId` (Zähler) ändert sich bei Ordnerverschiebung, Komprimierung oder Profilwiederherstellung. Hash-basierte Trennung zwischen Inhaltsnachweis, Nachrichteninstanz und Entscheidung ist konzipiert, aber noch nicht in IndexedDB migriert. |
| **Schutzprofil-Verwaltung im UI** | **T** | Schemas für `High-Security`, `Balanced`, `Minimal` existieren in `enterprise_profiles.js` und werden in React-Webansichten (`src/components/SettingsView.tsx`) visualisiert. In der ausgelieferten WebExtension `options.html` fehlt jedoch ein Profil-Import/-Umschalter mit Differenzvorschau. |
| **Lokale Heuristik-Qualitätsmetriken** | **U** | Statische Heuristiken in `risk.js` werden gegen 5 statische EML-Muster (`testdata/*.eml`) und `testdata/risk-behavior.json` geprüft. Ein standardisierter Benchmark mit Recall/Precision-Messung gegen reale Phishing-Korpora fehlt. |
| **Enterprise SIEM & Witness Live-Betrieb** | **K** | Verträge und lokale Dateispeicher-Adapter sind vollständig implementiert. Echte externe SIEM-Konnektoren (Syslog/Splunk/Elastic) und Cloud-Witness-Dienste sind nur als Stubs/Mocks vorhanden. |
| **Plattformprüfung Windows & macOS** | **B / ✋** | Vollständige Thunderbird-Live-Tests (`tools/thunderbird-live.dev.py`) laufen automatisiert auf Linux mit Xvfb. Reale Validierung auf Windows 11 (Win32/MSIX) und macOS (Sequoia/ARM64) ist mangels OS-Runnern blockiert. |
| **Screenreader-Abnahme (NVDA / VoiceOver)** | **B / ✋** | Tastaturnavigation und WAI-ARIA-Attribute sind in Chromium via `@axe-core/playwright` geprüft. Reale akustische Abnahme mit NVDA (Windows) und VoiceOver (macOS) ist mangels nativer Hostsysteme blockiert. |
| **ATN-Listung & automatische Update-Verteilung** | **B / ✋** | Signierungs-Endpunkt ist konfiguriert (`docs/ci/release.yml`), aber der Upload auf `addons.thunderbird.net` (ATN) ist durch fehlende AMO/ATN-API-Credentials blockiert. Distribution erfolgt aktuell als unsigniertes XPI via GitHub Releases. |

---

## 2. Dynamische Themenlandkarte

Aus den realen Befunden im Repository ergeben sich folgende Hauptthemenbereiche und Entwicklungstypen (*Optimierung*, *Verbesserung*, *Erweiterung*):

```
                        ┌────────────────────────────────────────────────────────┐
                        │          THUNDY AV — THEMENLANDKARTE 2026              │
                        └────────────────────────────────────────────────────────┘
                                                    │
         ┌────────────────────────┬─────────────────┴──────────────┬────────────────────────┐
         ▼                        ▼                                ▼                        ▼
┌─────────────────┐      ┌─────────────────┐              ┌─────────────────┐      ┌─────────────────┐
│  A. SCHUTZ-     │      │   B. ENTSCHEI-  │              │   C. BEDIENUNG, │      │   D. PROFILE,   │
│     WIRKUNG &   │      │      DUNGEN,    │              │      A11Y &     │      │      RICHT-     │
│     ANALYSE-    │      │      AUDIT &    │              │      DESIGN-    │      │      LINIEN &   │
│     QUALITÄT    │      │      IDENTITÄT  │              │      SYSTEM     │      │      ADMIN      │
└─────────────────┘      └─────────────────┘              └─────────────────┘      └─────────────────┘
  • Heuristik-             • Flüchtige Msg-IDs              • Screenreader-          • Profil-Diff in
    Benchmarking             vs. Content-Hash                 Abnahme                  options.html
  • Live-Provider-         • Unveränderbarkeit              • Konsistente            • Offline-Audit-
    Validierung              von OPENED / PENDING             Semantik in 6            Export für
  • Quellenergebnis-       • Transaktions-                    Sprachen                 Admins
    Historie                 sicheres Logging               • High-Contrast          • Strikte Consent-
                                                              DPI-Skalierung           Erzwingung
         ┌────────────────────────┼────────────────────────────────┼────────────────────────┐
         ▼                        ▼                                ▼                        ▼
┌─────────────────┐      ┌─────────────────┐              ┌─────────────────┐      ┌─────────────────┐
│  E. PERFORMANCE │      │  F. ARCHITEKTUR │              │   G. PLATTFORM- │      │   H. RELEASE,   │
│     & SPEICHER- │      │     & WARTBAR-  │              │      KOMPATIBI- │      │      ATN-STORE  │
│     HYGIENE     │      │     KEIT        │              │      LITÄT & CI │      │      & ROLLBACK │
└─────────────────┘      └─────────────────┘              └─────────────────┘      └─────────────────┘
  • Hot-Path Regex         • background.js                  • Windows 11             • ATN-Store-
    & Allokationen           Entflechtung                     (MSIX/Win32)             Signierung
  • Cache-TTL &            • Lockfile-Konsistenz            • macOS (Sequoia)        • Rollback-
    Bereinigung              (pnpm-lock.yaml)               • Headless Xvfb-           Szenarien
  • Subprozess-            • Toolchain-                       Runner-Stabilität      • Integritäts-
    Härtung                  Beobachtung                                               Validierung
```

---

## 3. Verbindliche Architektur- und Produktleitlinien

1. **6-Sprachen-Garantie:** Alle UI-Flächen, Warnhinweise, Audit-Meldungen und Fehlerdialoge müssen vollständig und idiomatisch in Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch vorliegen (`_locales/*/messages.json`).
2. **Einheitliches Designsystem:** Eigene Add-on-Oberflächen (`options.html`, `popup.html`, `audit.html`, `onboarding.html`, `enterprise_setup.html`, `source_export.html`) nutzen gemeinsame Tokens aus `design.css` und `theme.css`.
3. **Barrierefreiheit & Systemtheming:** Unterstützung für helle/dunkle Systemfarben, Thunderbird-Dichte (`compact`, `touch`, `normal`), Tastaturfokus und Screenreader-Semantik.
4. **Strikte Opt-in-Politik:** Externe Analysen und Enterprise-Konnektoren bleiben standardmäßig inaktiv und bedürfen expliziter Benutzerzustimmung.
5. **Klare Semantik:**
   - `OPENED` bestätigt lediglich die Weitergabe der Öffnungsanforderung an das Betriebssystem (`windows.openDefaultBrowser`). Kein Webseitenbesuch bestätigt.
   - `PENDING` darf nach einem Thunderbird-Absturz oder Neustart niemals in eine künstliche Zustimmung oder Ablehnung umgedeutet werden.
6. **Bestandsschutz:** Historische Audit- und Prüfentscheidungen bleiben bei Schema-Migrationen oder Bereinigungen unverändert erhalten.

---

## 4. Priorisierter Aufgabenplan (Evidenzbasierte Arbeitspakete)

### Übersichtstabelle

| Aufgaben-ID | Themenbereich | Typ | Status | Priorität | Aufwand | Blocker / Voraussetzung |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **AVN-019** | F. Architektur / Hygiene | Optimierung | N | **P1** | **S** | Sofort lokal ausführbar |
| **AVN-009** | B. Entscheidungen & Identität | Verbesserung | T | **P1** | **M** | Sofort lokal ausführbar |
| **AVN-010** | D. Profile & Administration | Erweiterung | T | **P2** | **M** | Sofort lokal ausführbar |
| **AVN-005** | A. Schutzwirkung & Analyse | Optimierung | U | **P2** | **M** | Sofort lokal ausführbar |
| **AVN-013** | F. Architektur & Wartbarkeit | Optimierung | T | **P2** | **L** | Sofort lokal ausführbar |
| **AVN-004** | A. Schutzwirkung & Analyse | Verbesserung | U | **P2** | **M** | ✋ Reale Provider-API-Keys |
| **AVN-006** | G. Plattformkompatibilität | Verbesserung | B | **P2** | **L** | ✋ Reale Windows- & macOS-Runner |
| **AVN-015** | H. Release & Distribution | Erweiterung | B | **P2** | **M** | ✋ AMO / ATN Maintainer-Keys |
| **AVN-012** | D. Enterprise-Integration | Erweiterung | K | **P3** | **L** | ✋ Reale Cloud-SIEM-Endpunkte |

---

### Detaillierte Arbeitspakete

#### AVN-019: Lockfile-Hygiene & Manifest-Test-Synchronisation
- **Themenbereich:** F. Architektur & Wartbarkeit (Querschnitt: CI & Packaging)
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** Die Installation mit `pnpm install` erzeugt ein unversioniertes `pnpm-lock.yaml`. Der Test `test/manifest.test.js` erzwingt jedoch das Fehlen von `pnpm-lock.yaml`, um Lockfile-Drift zu `package-lock.json` zu verhindern. Dadurch scheitert `pnpm test` direkt nach `pnpm install`, wenn das File nicht manuell gelöscht wird.
- **Ziel & Nutzwert:** Entwickler und CI-Pipelines können `pnpm install && pnpm test` ohne manuelle Datei-Löschungen ausführen.
- **Abgegrenzter Umfang:** Anpassung von `test/manifest.test.js` oder Ergänzung eines pnpm-freundlichen Ignore-Handlings in `scripts/pre-submit-checks.js`.
- **Priorität & Aufwand:** Priorität **P1**, Aufwand **S**.
- **Abhängigkeiten / Blocker:** Keine; rein lokal ausführbar.
- **Akzeptanzkriterien:**
  1. `pnpm install && pnpm test` läuft ohne manuelles `rm pnpm-lock.yaml` fehlerfrei durch.
  2. `pnpm run check:source` und `pnpm run lint:filtered` bleiben grün.
  3. XPI-Paketinhalt bleibt frei von fremden Lockfiles.
- **Validierung:** `pnpm test` nach frischem `pnpm install`.

#### AVN-009: Dauerhafte Vorkommens- und Inhaltsidentität (Phase 1: Spezifikation & Entflechtung)
- **Themenbereich:** B. Entscheidungen, Audit & Identität
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** In `docs/IDENTITAET_ANALYSEBEFUNDE.md` nachgewiesen: Thunderbird-Nachrichten-IDs (`header.id`) sind flüchtige Ordner-Zähler. Beim Verschieben oder Komprimieren ändern sich die IDs. Gespeicherte Berichte und Audit-Einträge drohen ihre Bindung zu verlieren oder fälschlicherweise auf neue Mails zuzugreifen.
- **Ziel & Nutzwert:** Sichere, migrationsfeste Zuordnung von Audit-Entscheidungen und Analyseberichten basierend auf stabilen Content-Hashes (SHA-256 über normalisierte Header und Body-Payloads).
- **Abgegrenzter Umfang:** Entwurf des migrationsfesten IndexedDB-Speichermodells (`db.js`); Trennung von `messageInstanceKey` und `contentDigest`; Rückwärtskompatibilität für bestehende Einträge.
- **Priorität & Aufwand:** Priorität **P1**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Keine; lokal im Test-Harness umsetzbar.
- **Akzeptanzkriterien:**
  1. Audit-Snapshots und Berichte bleiben auffindbar, wenn eine Nachricht im Test in einen anderen Ordner verschoben wird.
  2. Bestehende Legacy-Datensätze werden unter Erhalt ihrer Zeitstempel weiter lesend unterstützt.
  3. Keine Datenverluste bei partiellen Leseabbrüchen.
- **Validierung:** `test/audit.test.js`, `test/report-lifecycle.test.js`, `tools/test_thunderbird_identity.dev.py`.

#### AVN-010: Schutzprofil-Auswahl mit Diff-Vorschau in options.html
- **Themenbereich:** D. Profile, Richtlinien & Administration
- **Entwicklungstyp:** Erweiterung
- **Befund mit Beleg:** In `enterprise_profiles.js` existieren vorkonfigurierte Profile (`High-Security`, `Balanced`, `Minimal`). In der produktiven Einstellungsseite `options.html`/`options.js` fehlt jedoch die Möglichkeit, diese Profile komfortabel anzuwenden und die resultierenden Differenzen vor dem Speichern zu prüfen.
- **Ziel & Nutzwert:** Administratoren und Endanwender können vordefinierte Sicherheitsniveaus mit einem Klick sicher anwenden, ohne versehentlich bestehende Ausnahmelisten zu überschreiben.
- **Abgegrenzter Umfang:** Ergänzung eines Profil-Auswahl-Menüs in `options.html`; Differenzberechnung in `options.js`; modaler Bestätigungsdialog mit Hervorhebung geänderter Einstellungen vor dem Schreiben in `browser.storage.local`.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Keine; reine lokale WebExtension-Erweiterung.
- **Akzeptanzkriterien:**
  1. Profilwechsel öffnet ein Modal mit genauer Gegenüberstellung (Vorher / Nachher).
  2. Benutzerdefinierte Allow-/Blocklists werden nicht ohne ausdrückliche Bestätigung überschrieben.
  3. Vollständige Übersetzung des Dialogs in EN, DE, FR, ES, IT, PL.
  4. Barrierefreier Fokus auf den Abbrechen-Button beim Öffnen des Modals.
- **Validierung:** `options.test.js` und Screenshot-Generierung via `tools/browser-ui.dev.cjs`.

#### AVN-005: Unabhängiges Benchmarking der heuristischen Erkennungsqualität
- **Themenbereich:** A. Schutzwirkung & Analysequalität
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** `risk.js` berechnet lokale Risikowerte (0–100). Die Testabdeckung (`testdata/risk-behavior.json`, `testdata/*.eml`) deckt nur 5 spezifische Einzelfälle ab. Quantitative Aussagen zu False-Positive- und False-Negative-Raten existieren nicht.
- **Ziel & Nutzwert:** Nachweisbare Bewertung der heuristischen Schutzleistung und gezielte Verringerung von Fehlalarmen bei legitimen Geschäfts-E-Mails.
- **Abgegrenzter Umfang:** Erstellung eines Benchmark-Runners (`tools/risk-corpus.dev.cjs`); Integration eines erweiterten, anonymisierten EML-Testkorpus (Phishing, Spoofing, Benign).
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Keine; Datenbasis lokal im Repository erweiterbar.
- **Akzeptanzkriterien:**
  1. Automatisch generierter Benchmark-Report mit Precision-, Recall- und F1-Score.
  2. Keine Verschlechterung der bestehenden Heuristik-Invarianten in `api.test.js`.
- **Validierung:** `node tools/risk-corpus.dev.cjs`.

#### AVN-013: Modulare Dekomposition von background.js
- **Themenbereich:** F. Architektur & Wartbarkeit
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** `background.js` umfasst über 1.200 Zeilen und bündelt Message-Display-Listener, Time-of-Click-Interzeption, Kontextmenüs, Cache-Verwaltung, API-Gateway-Orchestrierung und Theme-Kommunikation in einem einzigen Skript.
- **Ziel & Nutzwert:** Reduzierung der kognitiven Komplexität, verbesserte Testbarkeit einzelner Subsysteme und Isolation von Fehlern.
- **Abgegrenzter Umfang:** Strukturierte Aufteilung in spezialisierte ES-Module (z. B. `background_navigation.js`, `background_menus.js`, `background_storage.js`), eingebunden über `manifest.json`.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **L**.
- **Abhängigkeiten / Blocker:** Keine; erfordert jedoch gründliche Regressionstests der Skriptladefolge im MV3-Kontext.
- **Akzeptanzkriterien:**
  1. `background.js` fungiert primär als schlanker Event-Dispatcher.
  2. Alle bestehenden 1.085 Tests in `pnpm test` bleiben ohne Verhaltensänderung grün.
  3. `scripts/lint-with-filter.js` meldet 0 neue Warnungen oder Fehler.
- **Validierung:** `background.test.js`, `test/optimization.test.js`, Thunderbird-Live-Runner.

#### AVN-004: Echte Live-Provider-Validierung (VirusTotal, Hybrid Analysis etc.)
- **Themenbereich:** A. Schutzwirkung & Analysequalität
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** Provider-Aufrufe (`providers.js`, `api_gateway.js`) sind derzeit nur über Unit-Mocks und statische Fixtures abgesichert. Reale Rate-Limits, JSON-Schema-Änderungen und Netzwerkausfälle externer Endpunkte sind nicht live verifiziert.
- **Ziel & Nutzwert:** Sicherstellung, dass Live-Scans mit aktuellen Provider-APIs auch bei API-Änderungen der Anbieter stabil funktionieren.
- **Abgegrenzter Umfang:** Durchführung kontrollierter End-to-End-Abfragen gegen Live-APIs mit Testkontingenten; Aktualisierung der Provider-Parser.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Gültige Produktions-API-Keys für VirusTotal, Hybrid Analysis, AbuseIPDB und urlscan.io erforderlich.
- **Akzeptanzkriterien:**
  1. Erfolgreiche E2E-Abfrage gegen alle konfigurierten Provider mit echten Test-Hashes/Domains.
  2. Korrekte Einstufung und Darstellung im Popup ohne Schema-Fehler.
- **Validierung:** `tools/vt-probe.dev.js` und manuelle Live-Prüfung.

#### AVN-006: Plattformübergreifende Abnahme (Windows 11 / macOS Sequoia / Screenreader)
- **Themenbereich:** G. Plattformkompatibilität & CI
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** Vollständige Thunderbird-Live-Tests (`tools/thunderbird-live.dev.py`) laufen bisher ausschließlich auf Linux (Xvfb). Windows- (Win32/MSIX) und macOS-spezifische Pfade, DPI-Skalierungen und Screenreader (NVDA, VoiceOver) sind ungetestet.
- **Ziel & Nutzwert:** Garantierte Barrierefreiheit und Stabilität auf den Hauptzielplattformen der Thunderbird-Nutzer.
- **Abgegrenzter Umfang:** Bereitstellung von Testskripten für Windows und macOS; Durchführung standardisierter Tastatur- und Screenreader-Szenarien.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **L**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Zugriff auf reale Windows- und macOS-Maschinen mit installierten Thunderbird- und Screenreader-Umgebungen erforderlich.
- **Akzeptanzkriterien:**
  1. Dokumentierte fehlerfreie Klick- und Dialogabläufe unter Windows 11 und macOS Sequoia.
  2. Bestätigte Vorlesegenauigkeit aller Warnhinweise und Statusmeldungen in NVDA und VoiceOver.
- **Validierung:** Erstellung von `docs/audits/windows-abnahme.json` und `docs/audits/macos-abnahme.json`.

#### AVN-015: ATN-Store-Signierung, automatisierte Updateverteilung & Rollback
- **Themenbereich:** H. Release, ATN-Store & Rollback
- **Entwicklungstyp:** Erweiterung
- **Befund mit Beleg:** Version 1.24.6 ist als unsigniertes GitHub-Release veröffentlicht. Auf `addons.thunderbird.net` (ATN) ist das Add-on nicht gelistet. Automatisierte Updates und definierte Rollback-Mechanismen für Endanwender fehlen.
- **Ziel & Nutzwert:** Offizielle Verfügbarkeit im Mozilla Add-on-Verzeichnis mit automatischer Update-Verteilung und vertrauenswürdiger Signierung für Endanwender.
- **Abgegrenzter Umfang:** Konfiguration der ATN-API-Credentials im CI-Release-Workflow; Bereitstellung eines dokumentierten Rollback-Leitfadens für Administratoren.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Maintainer-API-Keys für `addons.thunderbird.net` (AMO/ATN).
- **Akzeptanzkriterien:**
  1. Gültig signiertes XPI-Paket auf ATN verfügbar.
  2. Automatische Update-Erkennung in Thunderbird ESR 140/153 nachweisbar.
  3. Verifizierter Rollback-Pfad ohne Datenverlust im lokalen Profil.
- **Validierung:** ATN-Validierungsbericht und Live-Test unter Thunderbird.

---

## 5. Roadmap

### Phase 1: Unmittelbare Robustheit & Konsistenz (Kurzfristig / Sofort ausführbar)
*Fokus: Reine Repository-Arbeiten ohne externe Infrastrukturblocker.*
1. **AVN-019:** Lockfile-Hygiene (`test/manifest.test.js`) synchronisieren, damit Entwickler-Workflows mit `pnpm` reibungslos funktionieren.
2. **AVN-009 (Teil 1):** Spezifikation und Entwurf der migrationsfesten Content-Hash-Identität für Nachrichten und Audit-Snapshots.
3. **AVN-005:** Etablierung des Heuristik-Benchmark-Runners mit erweiterten EML-Mustern.

### Phase 2: Funktionale Reife & Code-Gesundheit (Mittelfristig / Lokal ausführbar)
*Fokus: Benutzerfreundlichkeit, Einstellungs-Sicherheit und Architektur.*
1. **AVN-010:** Bereitstellung importierbarer Schutzprofile mit verpflichtender Differenzvorschau in `options.html`.
2. **AVN-013:** Modulare Entflechtung von `background.js` zur Steigerung der Wartbarkeit.
3. **AVN-009 (Teil 2):** Migration des IndexedDB-Speichermodells auf den neuen Content-Digest.

### Phase 3: Externe Validierung & Plattform-Abnahme (Später / Benötigt konkrete Zugänge ✋)
*Fokus: Aufgaben, die dedizierte externe Infrastrukturen und Maintainer-Zugänge erfordern.*
1. **AVN-004:** Live-Validierung externer Provider mit echten Kontingenten und API-Keys.
2. **AVN-006:** Reale Plattform- und Screenreader-Abnahme unter Windows 11 und macOS Sequoia.
3. **AVN-015:** ATN-Store-Signierung, automatisierte Update-Distribution und Rollback-Verifikation.
4. **AVN-012:** Pilotierung des Enterprise-Kerns mit realem SIEM-Export und Identitätsverwaltung.

---

## 6. Die drei sinnvollsten nächsten Arbeitspakete mit Begründung

1. **AVN-019 — Lockfile-Hygiene & Manifest-Test-Synchronisation (Priorität P1, Aufwand S)**
   *Begründung:* Dies beseitigt die unmittelbare Friktion in der lokalen Entwicklung. Nach einem `pnpm install` schlägt `pnpm test` derzeit fehl, da `test/manifest.test.js` das generierte `pnpm-lock.yaml` beanstandet. Eine saubere Abstimmung sichert reproduzierbare Entwickler- und CI-Läufe ab.
2. **AVN-009 (Teil 1) — Spezifikation der dauerhaften Vorkommensidentität (Priorität P1, Aufwand M)**
   *Begründung:* Das flüchtige ID-Verhalten in Thunderbird (`header.id` ändert sich beim Verschieben/Komprimieren) ist das größte verbleibende Integritätsrisiko für den Audit- und Berichtsspeicher. Die konzeptionelle und testgetriebene Absicherung der Entflechtung muss erfolgen, bevor invasive Datenbankänderungen vorgenommen werden.
3. **AVN-010 — Schutzprofil-Verwaltung mit Diff-Vorschau in options.html (Priorität P2, Aufwand M)**
   *Begründung:* Dies liefert einen sofort spürbaren Mehrwert für Anwender und Administratoren. Durch die visuelle Differenzanzeige vor dem Abspeichern werden Fehlkonfigurationen verhindert und bestehende Allow-/Blocklists geschützt.

---

## 7. Zusammenfassende Handlungsempfehlung

- **Sofort mit vorhandenen Mitteln ausführbar:**
  - Synchronisation der Lockfile-Prüfung in den Testsuiten (AVN-019).
  - Spezifikation und Prototyping der Content-Hash-Identität (AVN-009) im lokalen Test-Harness.
  - Implementierung der Schutzprofil-Vorschau in den Einstellungen (AVN-010).
  - Erweiterung des heuristischen Benchmark-Korpus (AVN-005).
  - Modulare Strukturierung von `background.js` (AVN-013).

- **Erfordert konkrete zusätzliche Voraussetzungen (Blockiert ✋):**
  - **ATN-Veröffentlichung:** Maintainer-API-Tokens für Mozilla Add-ons (AMO/ATN).
  - **Windows-/macOS-Freigabe:** Dedizierte Windows- und macOS-Testsysteme mit installierten Browsern und aktiven Screenreadern (NVDA, VoiceOver).
  - **Live-Provider-Abnahme:** Echte Konten und API-Keys bei VirusTotal, Hybrid Analysis etc.
  - **Enterprise-Produktivbetrieb:** Echte Unternehmens-Cloudmandanten und SIEM-Zielsysteme.
