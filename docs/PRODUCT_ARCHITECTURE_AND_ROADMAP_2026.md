# Thundy AV — Technische Produktarchitektur, Bestandsaufnahme und Priorisierter Aufgabenplan (2026)

**Rolle:** Technischer Produktarchitekt und Senior Thunderbird-Extension-Entwickler
**Projekt:** Thundy AV — Opt-in E-Mail-Anhang- und Link-Scanner für Mozilla Thunderbird (WebExtension, MV3)
**Bezugsversion:** Release v1.23.0 (`df63c76e`) / Entwicklungsstand 1.23.0+
**Datum:** 16. Oktober 2026
**Status:** Evidenzbasierte Architekturanalyse & Entwicklungs-Roadmap

---

## Executive Summary & Gesamtbeurteilung

Thundy AV hat mit Release **v1.23.0** und der Implementierung des **Store-Readiness-Gates** (`scripts/submission-gate.js`, Kriterien C1–C7) einen außergewöhnlich hohen Reifegrad für eine Thunderbird-WebExtension erreicht.

Die Kernarchitektur kombiniert **lokalen Link- und Inhalts-Schutz (Privacy-First)** mit **optionalen Cloud-Reputationsanfragen** und einem **autonomen Enterprise-Vertragskern**. Die Erweiterung verfügt über ein vollkommen isoliertes Designsystem, 6 vollständige Sprachkataloge (EN, DE, FR, ES, IT, PL) und ein lückenloses, lokales Audit-Journal.

Trotz des fortgeschrittenen Entwicklungsstands unterscheidet dieser Bericht rigoros zwischen **lokal im Repository nachgewiesenen Funktionen** und **durch fehlende externe Zugänge / Testinfrastrukturen blockierten Schritten** (z. B. ATN-Store-Signierung, native Windows/macOS-Browserübergabe, Screenreader mit echten Assistenzsystemen und automatisiertes ATN-Rollback).

---

## 1. Tatsächlicher Stand (Evidenzbasierte Bestandsaufnahme)

Die Analyse beruht auf direkten Quellcode-Audits, Testläufen (`953 automatisierte Unit-/Szenariotests`), der Ausführung des Submission-Gates (`node scripts/submission-gate.js`) sowie Protokollen (`docs/live_test_1_23_0.md`, `THUNDERBIRD_LINUX_ABNAHME.md`, `docs/STATUS.md`).

```
+-----------------------------------------------------------------------------------+
|                            IMPLEMENTIERUNGSSTAND OVERVIEW                         |
+-----------------------------------------------------------------------------------+
| [1] Implementiert & Nachgewiesen:                                                |
|     - Local Link Protection & Time-of-Click Interception (link_audit.js, api.js)   |
|     - Privacy Tiers (Strict, Balanced, Max) & Opt-in Permission Flow (options.js)  |
|     - Sechssprachigkeit (EN, DE, FR, ES, IT, PL) inkl. Dynamic Fallbacks (i18n.js) |
|     - Thunderbird Theme/Density Support & Unified Design System (design_system.js) |
|     - IndexedDB / SQLite Audit Ledger & Retention Management (db.js)              |
|     - Offline Enterprise Engine (Contracts, Proof Verifier, Heartbeats, Outbox)    |
|                                                                                   |
| [2] Implementiert, aber unzureichend/simuliert geprüft:                           |
|     - Native Linux TB 140 ESR (Python/Xvfb verifiziert); Windows/macOS ausstehend  |
|     - Screenreader / WCAG (axe-core Playwright verifiziert; NVDA/JAWS ausstehend)   |
|     - Standardbrowser-Handoff (API mock & Xvfb nachgewiesen; OS-Default unbelegt)   |
|                                                                                   |
| [3] Teilweise umgesetzt / Optionale Pfade:                                        |
|     - Opt-in Provider Integrations (Hybrid Analysis, VirusTotal, urlscan, URLhaus) |
|     - Enterprise Storage Adapters (S3, Azure, GCP Simulator-gebunden)             |
|                                                                                   |
| [4] Konzeptionell vorbereitet:                                                    |
|     - Enterprise N06 Cloud/SSO/SEALED Deployment (AUFGABENPLAN_ENTERPRISE_N06.md)   |
|     - Policy Simulation & Live-Diff-Analyse (ENTERPRISE_POLICY_SIMULATION.md)     |
|                                                                                   |
| [5] Offen / Blockiert (Benötigt externe Infrastruktur / Schlüssel):               |
|     - ATN Store Signing & Publishing (Maintainer-Schlüssel erforderlich)          |
|     - Automatische Update-Verteilung & Rollback-Verhalten via ATN                 |
|     - Produktive Cloud-/KMS-/IdP-Zugänge für Enterprise N06                        |
+-----------------------------------------------------------------------------------+
```

### Details zur Bestandsaufnahme

1. **Implementiert und nachgewiesen (`PASS`):**
   - **Lokaler Schutz & Interzeption:** Lokale Heuristik (`risk.js`), HTML-Sanitizing (`sanitize.js`), Time-of-Click Interception (`link_audit.js`), Risikoklassifizierung (Grün/Gelb/Rot) ohne erzwungenen Netzwerkzugriff.
   - **Datenschutz & Einwilligungen:** Strikte Trennung von Datenverarbeitung nach Privacy Tiers (`strict`, `balanced`, `max`). Keinerlei externe Anfragen ohne expliziten Opt-in (`options.js`, `api.js`).
   - **Lokalisierung (i18n):** Vollständige Abdeckung für `en`, `de`, `fr`, `es`, `it`, `pl` via `_locales/` und dynamischem Fallback-Generator (`scripts/generate-i18n-fallback.js`).
   - **Design-System & Accessibility-Basics:** Eigenes CSS-Designsystem (`design.css`, `design_components.css`), Unterstützung von Thunderbird-Themes (System, Light, Dark, Native Dynamic) und Informationsdichten (Kompakt, Standard, Groß) sowie Screenreader-Semantic-Markups (`role="status"`, `aria-describedby`, Focus-Traps in Dialogen).
   - **Audit & Historie:** Unveränderbares lokales Audit-Journal (`audit.js`, `db.js`) zur Nachvollziehbarkeit von URL, lokalem Score, Provider-Verdikt, Zeitstempeln und Interaktionen.
   - **Enterprise-Grundlage:** Autonomer Node/JS-Vertragskern mit Ed25519/JCS-Signaturprüfung, Outbox, Ledger, Witness-Checkpoints, Heartbeats und Kapazitätsmonitoren.

2. **Implementiert, aber unzureichend/simuliert geprüft:**
   - **Thunderbird/OS-Abnahme:** Linux ESR 140.17.0 wurde unter Xvfb/Python automatisiert erfolgreich abgenommen (`THUNDERBIRD_LINUX_ABNAHME.md`). Echte native Tests unter **Windows 11** und **macOS (Apple Silicon / Intel)** fehlen.
   - **Screenreader-Verifikation:** Barrierefreiheit wurde synthetisch mit Playwright + `@axe-core/playwright` über 528 UI-Varianten geprüft. Ein Praxistest mit echten Assistenzsystemen (**NVDA**, **JAWS**, **VoiceOver**) steht aus.
   - **Browser-Handoff:** Übergabe an den OS-Standardbrowser ist über `messenger.windows` / `browser.tabs` implementiert, konnte aber im headless Linux-Container nur bis zur API-Übergabe verifiziert werden.

3. **Teilweise umgesetzt:**
   - **Provider-Scanner:** Anbindung an Hybrid Analysis, VirusTotal, urlscan.io, URLhaus und AbuseIPDB ist im Code vorhanden, verlangt jedoch benutzereigene API-Keys und Host-Permissions (`manifest.json`).
   - **Enterprise Storage Adapter:** S3, Azure Blob und GCP Cloud Storage Adapter (`ENTERPRISE_STORAGE_ADAPTER.md`) sind als Abstraktionsschicht implementiert, laufen derzeit jedoch auf lokalen Simulatoren (`CLOUD_OBSERVED`).

4. **Konzeptionell vorbereitet:**
   - **Enterprise-N06 Produktivbetrieb:** 19 Arbeitspakete (`AUFGABENPLAN_ENTERPRISE_N06.md`) für produktive Cloud-Storage-Verankerung, KMS-Schlüsselverwaltung, SEALED-Evidenzcommits, SIEM-Exporte und SSO/RBAC-Rollen.
   - **Policy-Simulation:** Vergleichende Simulation alter/neuer Richtlinien auf vergangenen Audit-Daten (`ENTERPRISE_POLICY_SIMULATION.md`).

5. **Offen oder durch externe Voraussetzungen blockiert (✋):**
   - **ATN-Einreichung & Signierung:** Benötigt die Maintainer-Schlüssel / Zugänge für addons.thunderbird.net (ATN).
   - **Automatische Update-Verteilung & Rollback:** Das Verhalten bei In-App-Updates und fehlerhaften Rollbacks lässt sich erst nach Veröffentlichung einer signierten Version auf ATN verifizieren.
   - **Flottenmessung & SSO/KMS:** Benötigt produktive Enterprise-Mandanten und OAuth2/IdP-Infrastrukturen.

---

## 2. Dynamische Themenlandkarte & Entwicklungstypen

Die Handlungsfelder werden anhand des Repository-Befunds dynamisch strukturiert. Jedem Feld wird ein primärer Typ zugewiesen:
- **Optimierung (OPT):** Bestehendes effizienter, robuster, wartbarer machen.
- **Verbesserung (IMP):** Bestehendes verständlicher, zugänglicher, vollständiger gestalten.
- **Erweiterung (EXT):** Neue Fähigkeiten mit klarem Nutzwert ergänzen.

```
+---------------------------------------------------------------------------------------------------+
|                                     THEMENLANDKARTE (MAP)                                         |
+---------------------------------------------------------------------------------------------------+
| 1. Schutzwirkung & Analysequalität [Schutz] ----------------------------- (OPT / IMP / EXT)       |
|    - Heuristik-Performance & Zero-Day Pattern Expansion                                           |
| 2. Linkentscheidungen, Score & Audit [Audit] ---------------------------- (OPT / IMP)             |
|    - Audit-Retention, Crash-Recovery, PENDING/OPENED Transparenz                                  |
| 3. Bedienung, Informationsdarstellung & A11y [UI/UX/A11y] -------------- (IMP)                     |
|    - Screenreader-Prüfung (NVDA/JAWS), Tastaturfokus, Barrierefreie Statusmeldungen              |
| 4. Mehrsprachigkeit & Lokalisierung [i18n] ------------------------------ (IMP)                     |
|    - Vollständige Konsistenz in EN/DE/FR/ES/IT/PL & Dynamic Fallback Safety                       |
| 5. Themes & Gemeinsames Designsystem [Design] --------------------------- (OPT / IMP)             |
|    - Native Thunderbird Theme-Adaption, Kontrastsicherheit & Density Scaling                      |
| 6. Einrichtung, Einstellungen & Richtlinien [Config] -------------------- (IMP / EXT)             |
|    - Onboarding-Wizard Härtung, Profile Management & Enterprise Policy Import                    |
| 7. Performance, Speicher & Background [Perf/DB] ------------------------- (OPT)                     |
|    - IndexedDB Transaction Batching, Memory Limits & Event-Page Idle Safety                       |
| 8. Datenschutz & Datenlebenszyklus [Privacy] ----------------------------- (OPT / IMP)             |
|    - Strict Privacy Guards, Anonymisierung & Opt-in Enforcement                                   |
| 9. Unternehmensadministration & Integrationen [Enterprise] -------------- (EXT)                     |
|    - N06 Cloud/SEALED Commit, SIEM Export Queue, SSO/RBAC Binding                                 |
| 10. Architektur, Sicherheit & Wartbarkeit [Arch] ------------------------ (OPT)                     |
|     - DOM Clobbering Hardening, CSP Enforcements, Static Analysis Cleanliness                      |
| 11. Tests, Plattformkompatibilität & OS [Test] -------------------------- (OPT / IMP)             |
|     - Windows/macOS Native Testing, Real Browser Handoff Verification                            |
| 12. Veröffentlichung, Store, Updates & Rollback [Release] --------------- (IMP / EXT)             |
|     - ATN Signing, Automated Update Distribution & Rollback Safety Check                          |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Verbindliche Produktanforderungen (Compliance-Matrix)

Die Architektur erfüllt und sichert folgende verbindliche Produktkriterien:

| Kriterium | Anforderung | IST-Zustand & Nachweis | Status |
|---|---|---|---|
| **Mehrsprachigkeit** | EN, DE, FR, ES, IT, PL vollständig mitliefern. | `_locales/{en,de,fr,es,it,pl}/messages.json` vorhanden und durch `test/i18n.test.js` verifiziert. Dynamischer Runtime-Fallback auf `en`. | **ERFÜLLT** |
| **Designsystem** | Einheitliche moderne Gestaltung für Add-on- & Adminansichten. | CSS-Module `design.css`, `design_components.css`, `theme.css`. Verifiziert durch 528 Playwright Layout-Tests. | **ERFÜLLT** |
| **TB-Integration** | Themes (Light/Dark/System/Native), Dichte, Tastaturbedienung. | `theme.js` reagiert auf TB-Theme-Events. Focus-Traps in Interceptions-Dialogen. ARIA-Attribute vorhanden. | **ERFÜLLT** |
| **Entkopplung** | Externe Scans & Enterprise bleiben strikt optional. | Standardmäßig 100 % lokaler Modus (`privacyTier: strict`). Keine externen Aufrufe ohne Opt-in. | **ERFÜLLT** |
| **Klarheit** | Lokale Funktionen vs. Enterprise-Profile klar unterscheiden. | Onboarding & Options kennzeichnen Enterprise-Module als inaktive/lokale Entwürfe. | **ERFÜLLT** |
| **Transparenz** | URL, Score, Prüfstand & Nutzerentscheidung nachvollziehbar. | `audit.html` / `audit.js` speichern exakte Snapshot-Zustände bei Interaktion. | **ERFÜLLT** |
| **`OPENED`-Semantik** | Übergabe an Thunderbird; KEIN Bestätigen von Browserstart/Webbesuch. | UI & Berichte verwenden exakt „Öffnung angefordert“. `OPENED` dokumentiert nur den API-Aufruf an das OS. | **ERFÜLLT** |
| **`PENDING`-Semantik** | Nach Prozessverlust DARF PENDING nicht als Entscheidung umgedeutet werden. | Crash-Recovery (`link_audit.js`) lässt offene Vorgänge auf `PENDING`. Keine automatische Schließung oder gefälschte Urteile. | **ERFÜLLT** |
| **Datenerhalt** | Historische Entscheidungen & Daten bleiben bei Updates erhalten. | `db.js` Migrationen & Schema-Upgrades bewahren Audit-Einträge. Nachgewiesen in 6-Sprachen-Upgradetest 1.22 -> 1.23. | **ERFÜLLT** |

---

## 4. Priorisierungsmethodik

Die Priorität jedes Arbeitspakets wird anhand von 6 gewichteten Kriterien bestimmt:
1. **Anwendernutzen & Administration (Gewicht: 25 %)**
2. **Zuverlässigkeit & Schutzwirkung (Gewicht: 25 %)**
3. **Problemhäufigkeit & Reichweite (Gewicht: 20 %)**
4. **Aufwand & Änderungsrisiko (Gewicht: 15 %)**
5. **Voraussetzungen & Blocker (Gewicht: 10 %)**
6. **Evidenzstärke des Befunds (Gewicht: 5 %)**

**Prioritätsklassen:**
- **P0 (Kritisch / Blocker):** Unverzichtbar für Store-Submission, Sicherheit oder Kernfunktionalität.
- **P1 (Hoch):** Hoher Nutzen für Zuverlässigkeit, A11y, Multi-Plattform oder Enterprise.
- **P2 (Mittel):** Wichtige Optimierungen, Wartbarkeit, erweiterte UI/UX.
- **P3 (Niedrig):** Langfristige Erweiterungen, optionale Integrationen.

---

## 5. Konkreter Aufgabenplan (Priorisierter Aufgabenkatalog)

### Übersicht der Arbeitspakete

| Task-ID | Bereich | Typ | Titel / Thema | Prio | Aufwand | Blocker / Depot |
|---|---|---|---|---|---|---|
| **TA-REL-01** | Release | IMP | ATN-Store-Einreichung & Signierung | **P0** | S (2h) | Maintainer-Schlüssel ✋ |
| **TA-TST-01** | Test | IMP | Native OS-Abnahme unter Windows 11 & macOS | **P1** | M (8h) | Win/macOS Test-VMs ✋ |
| **TA-TST-02** | Test/A11y | IMP | Screenreader-Prüfung mit NVDA, JAWS & VoiceOver | **P1** | M (6h) | Assistenzsysteme ✋ |
| **TA-REL-02** | Release | IMP | Automatisierter Update- & Rollback-Test via ATN | **P1** | M (6h) | Nach TA-REL-01 ✋ |
| **TA-PER-01** | Perf/DB | OPT | IndexedDB Transaction-Batching & Async Cache Flush | **P2** | S (4h) | Ausführbar (Lokal) |
| **TA-SEC-01** | Arch | OPT | Restriktives CSP & DOM-Clobbering-Härtung | **P2** | S (3h) | Ausführbar (Lokal) |
| **TA-UI-01** | UI/UX | IMP | Barrierefreie Live-Status-Announcer für Options/Wizard | **P2** | S (3h) | Ausführbar (Lokal) |
| **TA-I18N-01**| i18n | IMP | i18n Coverage Checker Integration in Pre-Commit | **P2** | S (2h) | Ausführbar (Lokal) |
| **TA-ENT-01** | Enterprise| EXT | Enterprise N06 Cloud-Storage & KMS Integration | **P3** | L (24h) | Cloud/IdP-Credentials ✋ |
| **TA-ENT-02** | Enterprise| EXT | SIEM Outbox Pipeline Real-Time Dispatcher | **P3** | M (12h) | Nach TA-ENT-01 ✋ |

---

### Detaillierte Spezifikation der Arbeitspakete

#### Task TA-REL-01: ATN-Store-Einreichung & Signierung
- **Stabile ID:** `TA-REL-01`
- **Themenbereich:** Veröffentlichung, Store, Updates & Rollback (`[Release]`)
- **Entwicklungstyp:** Verbesserung (`IMP`)
- **Befund mit Beleg:** Submission-Gate `scripts/submission-gate.js` meldet Kriterien C1–C6 `PASS`. Kriterium C7 scheitert derzeit, weil seit Tag `v1.23.0` Code-Änderungen auf `main` erfolgt sind (`git diff v1.23.0..HEAD`). ATN API antwortet für die Extension-ID noch mit 404 (`docs/STATUS.md`).
- **Gewünschtes Ergebnis & Nutzwert:** Offizielle Veröffentlichung von Thundy AV auf addons.thunderbird.net (ATN) als signierte WebExtension für Thunderbird 140+.
- **Abgegrenzter Umfang:** Bumping der Version in `manifest.json` / `package.json` auf `1.24.0` (oder `1.23.1`), Tagging, Ausführung von `npx web-ext sign` via CI-Workflow `docs/ci/release.yml`.
- **Priorität & Aufwand:** **P0 (Kritisch)** / Aufwandsklasse **S** (ca. 2 Std.).
- **Abhängigkeiten / Blocker:** ✋ Benötigt Maintainer-API-Keys für ATN (`AMO_JWT_ISSUER`, `AMO_JWT_SECRET`).
- **Akzeptanzkriterien:** `node scripts/submission-gate.js` liefert **GO (Exit 0, C1–C7 PASS)**. Signiertes `.xpi` ist auf ATN verfügbar.
- **Validierung & Testumgebung:** Echte ATN-API & GitHub Actions Secret-Umgebung.

---

#### Task TA-TST-01: Native OS-Abnahme unter Windows 11 & macOS
- **Stabile ID:** `TA-TST-01`
- **Themenbereich:** Tests, Plattformkompatibilität & OS (`[Test]`)
- **Entwicklungstyp:** Verbesserung (`IMP`)
- **Befund mit Beleg:** Abnahme erfolgte bisher nur unter Linux (Xvfb/Thunderbird 140 ESR, `THUNDERBIRD_LINUX_ABNAHME.md`). Das Verhalten der nativen Systembrowser-Übergabe (`messenger.windows.create`, `browser.tabs.create`) und High-DPI-Skalierung unter Windows 11 und macOS ist unbestätigt (`docs/STATUS.md`).
- **Gewünschtes Ergebnis & Nutzwert:** Nachgewiesene Lauffähigkeit, visuelle Integrität und korrekte `OPENED`-Browserübergabe auf Windows 11 und macOS.
- **Abgegrenzter Umfang:** Manuelle & skriptgestützte Tests gemäß `docs/live_test_protocol.md` auf echten Windows 11- und macOS-Maschinen. Screenshots für Store-Listing erstellen.
- **Priorität & Aufwand:** **P1 (Hoch)** / Aufwandsklasse **M** (ca. 8 Std.).
- **Abhängigkeiten / Blocker:** ✋ Benötigt physikalische oder virtuelle Testgeräte mit Windows 11 und macOS.
- **Akzeptanzkriterien:** Dokumentierte Testprotokolle `docs/live_test_win11.md` und `docs/live_test_macos.md` mit 0 FAIL-Einträgen. Screenshots in `docs/screenshots/` ergänzt.
- **Validierung & Testumgebung:** Echte Thunderbird-Installationen (140+ ESR) auf Windows 11 Pro und macOS Sonoma/Sequoia.

---

#### Task TA-TST-02: Screenreader-Prüfung mit NVDA, JAWS & VoiceOver
- **Stabile ID:** `TA-TST-02`
- **Themenbereich:** Bedienung, Informationsdarstellung & A11y (`[UI/UX/A11y]`)
- **Entwicklungstyp:** Verbesserung (`IMP`)
- **Befund mit Beleg:** Die A11y-Spezifikation wurde bisher ausschließlich über automatisierte Linting-Regeln und Playwright `@axe-core/playwright` geprüft (`UI_BROWSERPRUEFUNG.md`). Die tatsächliche Sprachausgabe und Navigation von Fokus-Traps in Interceptions-Dialogen mit echten Screenreadern ist ungeprüft.
- **Gewünschtes Ergebnis & Nutzwert:** Barrierefreie Nutzbarkeit für sehbeeinträchtigte Anwender. Ansagen von Warnstufen, Link-Zielen und Buttons entsprechen WCAG 2.1 AA.
- **Abgegrenzter Umfang:** Test der Dialoge (Link-Interzeption, Audit-Log, Wizard, Options) mit NVDA (Windows), JAWS (Windows) und VoiceOver (macOS).
- **Priorität & Aufwand:** **P1 (Hoch)** / Aufwandsklasse **M** (ca. 6 Std.).
- **Abhängigkeiten / Blocker:** ✋ Benötigt Testsysteme mit installierten Assistenzsystemen (NVDA/JAWS/VoiceOver).
- **Akzeptanzkriterien:** Alle Status-Meldungen (`role="status"`, `aria-live`) werden korrekt vorgelesen. Tastatur-Fokus bleibt im Interaktions-Modal gefangen, bis eine Entscheidung getroffen wurde.
- **Validierung & Testumgebung:** Echte Screenreader-Sitzungen unter Windows/macOS.

---

#### Task TA-REL-02: Automatisierter Update- & Rollback-Test via ATN
- **Stabile ID:** `TA-REL-02`
- **Themenbereich:** Veröffentlichung, Store, Updates & Rollback (`[Release]`)
- **Entwicklungstyp:** Optimierung (`OPT`)
- **Befund mit Beleg:** Zwar wurden lokale Profil-Upgrades von 1.22.0 auf 1.23.0 unter Linux erfolgreich verifiziert (`THUNDERBIRD_LINUX_ABNAHME.md`), das automatische In-App-Updateverhalten sowie das Verhalten bei fehlerhaften/abgebrochenen ATN-Updates ist im Live-Betrieb nicht gemessen.
- **Gewünschtes Ergebnis & Nutzwert:** Nahtloses, unterbrechungsfreies automatisches Update für Anwender ohne Datenverlust oder fälschliche Wizard-Wiederholungen.
- **Abgegrenzter Umfang:** Veröffentlichung einer Folgeversion (z. B. 1.24.0) auf ATN und Beobachten der automatischen Update-Kette in Thunderbird. Simulation eines Rollback-Szenarios.
- **Priorität & Aufwand:** **P1 (Hoch)** / Aufwandsklasse **M** (ca. 6 Std.).
- **Abhängigkeiten / Blocker:** ✋ Setzt die erfolgreiche Ersteinreichung (`TA-REL-01`) voraus.
- **Akzeptanzkriterien:** Thunderbird aktualisiert das Add-on im Hintergrund. Bestehende Einstellungen, Audit-Logs und Einwilligungen bleiben zu 100 % erhalten.
- **Validierung & Testumgebung:** Live-Update-Infrastruktur von Mozilla ATN.

---

#### Task TA-PER-01: IndexedDB Transaction-Batching & Async Cache Flush
- **Stabile ID:** `TA-PER-01`
- **Themenbereich:** Performance, Speicher & Background (`[Perf/DB]`)
- **Entwicklungstyp:** Optimierung (`OPT`)
- **Befund mit Beleg:** In `db.js` führt jedes einzelne Audit-Event bei hoher Klickfrequenz zu einer separaten IndexedDB-Transaktion (`db.js:saveAuditEvent`). Bei Massen-E-Mails mit vielen Links kann dies zu I/O-Spitzen im Hintergrundprozess führen.
- **Gewünschtes Ergebnis & Nutzwert:** Reduzierter I/O-Overhead und geringerer Speicherverbrauch durch Bündelung von Audit-Schreibzugriffen (In-Memory Micro-Buffer mit Debounce).
- **Abgegrenzter Umfang:** Implementierung eines transparenten Write-Buffers in `db.js`, der Einträge sammelt und alle 500ms oder bei Erreichen von 10 Einträgen in einer einzigen Transaktion persistiert. Flush-Garantie bei `runtime.onSuspend`.
- **Priorität & Aufwand:** **P2 (Mittel)** / Aufwandsklasse **S** (ca. 4 Std.).
- **Abhängigkeiten / Blocker:** Keine (lokal sofort ausführbar).
- **Akzeptanzkriterien:** `db.test.js` verifiziert, dass gepufferte Einträge auch bei abruptem Beenden (Flush-Trigger) flusskonform geschrieben werden.
- **Validierung & Testumgebung:** Automatisierte Unit-Tests (`pnpm test`) und Benchmark `benchmark_ip3.js`.

---

#### Task TA-SEC-01: Restriktives CSP & DOM-Clobbering-Härtung
- **Stabile ID:** `TA-SEC-01`
- **Themenbereich:** Architektur, Sicherheit & Wartbarkeit (`[Arch]`)
- **Entwicklungstyp:** Optimierung (`OPT`)
- **Befund mit Beleg:** PR #674 behob bereits ein DOM-Clobbering-Problem bei `outerHTML`. In `sanitize.js` und `message_ui.js` sollten verbleibende Stellen bezüglich dynamischer Element-Erzeugung gehärtet werden.
- **Gewünschtes Ergebnis & Nutzwert:** Maximaler Schutz gegen DOM-Clobbering und Cross-Site-Scripting in E-Mail-HTML-Kontexten.
- **Abgegrenzter Umfang:** Ersetzung verbleibender innerHTML/outerHTML-Zuweisungen durch sichere DOM-Methoden (`document.createElement`, `textContent`, Safe HTML Templates).
- **Priorität & Aufwand:** **P2 (Mittel)** / Aufwandsklasse **S** (ca. 3 Std.).
- **Abhängigkeiten / Blocker:** Keine (lokal sofort ausführbar).
- **Akzeptanzkriterien:** `sanitize.js` und `api.test.js` bestehen mit 100 % Abdeckung für neu eingefügte Injection-Payloads.
- **Validierung & Testumgebung:** Unit-Tests (`pnpm test`).

---

#### Task TA-UI-01: Barrierefreie Live-Status-Announcer für Options & Wizard
- **Stabile ID:** `TA-UI-01`
- **Themenbereich:** Bedienung, Informationsdarstellung & A11y (`[UI/UX/A11y]`)
- **Entwicklungstyp:** Verbesserung (`IMP`)
- **Befund mit Beleg:** Beim Speichern von Einstellungen in `options.js` oder im Wizard `onboarding.js` wird die Erfolgsmeldung dynamisch eingeblendet, verfügt jedoch teilweise nicht über `role="status"` oder `aria-live="polite"`.
- **Gewünschtes Ergebnis & Nutzwert:** Blinde und sehbehinderte Nutzer erhalten sofortige akustische Rückmeldung über gespeicherte Einstellungen.
- **Abgegrenzter Umfang:** Ergänzung aller dynamischen Feedback-Elemente in `options.html` und `onboarding.html` um `role="status"` und Verknüpfung via `aria-describedby` mit den auslösenden Buttons.
- **Priorität & Aufwand:** **P2 (Mittel)** / Aufwandsklasse **S** (ca. 3 Std.).
- **Abhängigkeiten / Blocker:** Keine (lokal sofort ausführbar).
- **Akzeptanzkriterien:** Playwright A11y-Suite bestätigt die Präsenz der ARIA-Attribute.
- **Validierung & Testumgebung:** `pnpm test` und `tools/browser-ui.dev.cjs`.

---

#### Task TA-I18N-01: i18n Coverage Checker Integration in Pre-Commit
- **Stabile ID:** `TA-I18N-01`
- **Themenbereich:** Mehrsprachigkeit & Lokalisierung (`[i18n]`)
- **Entwicklungstyp:** Verbesserung (`IMP`)
- **Befund mit Beleg:** Skript `scripts/generate-i18n-fallback.js --check` prüft die Vollständigkeit der Sprachschlüssel, ist aber im lokalen `git pre-commit` Hook noch nicht zwingend verdrahtet.
- **Gewünschtes Ergebnis & Nutzwert:** Automatische Absicherung, dass kein neuer UI-Text ohne Übersetzungen in allen 6 Sprachen committet werden kann.
- **Abgegrenzter Umfang:** Verankerung der i18n-Check-Prüfung in `scripts/pre-submit-checks.js`.
- **Priorität & Aufwand:** **P2 (Mittel)** / Aufwandsklasse **S** (ca. 2 Std.).
- **Abhängigkeiten / Blocker:** Keine (lokal sofort ausführbar).
- **Akzeptanzkriterien:** `npm run pre-submit-checks` bricht ab, wenn in einer Sprachdatei ein Key fehlt.
- **Validierung & Testumgebung:** Unit-Test `test/i18n.test.js`.

---

#### Task TA-ENT-01: Enterprise N06 Cloud-Storage & KMS Integration
- **Stabile ID:** `TA-ENT-01`
- **Themenbereich:** Unternehmensadministration & Integrationen (`[Enterprise]`)
- **Entwicklungstyp:** Erweiterung (`EXT`)
- **Befund mit Beleg:** Die Pakete N01–N05 sind lokal implementiert (`ENTERPRISE_UMSETZUNGSSTAND.md`), aber die produktive Anbindung an AWS S3, Azure Blob oder GCP Cloud Storage inkl. KMS-Schlüsselrotation (N06) läuft derzeit nur auf Simulatoren (`CLOUD_OBSERVED`).
- **Gewünschtes Ergebnis & Nutzwert:** Revisionssichere, verschlüsselte Auslagerung von Audit-Evidenzen in Enterprise-Cloud-Speicher.
- **Abgegrenzter Umfang:** Anbindung der produktiven Cloud-SDKs (`enterprise/storage_cli.cjs`), Echttest von Retention-Locks, Immutability & KMS-Enforcement.
- **Priorität & Aufwand:** **P3 (Niedrig)** / Aufwandsklasse **L** (ca. 24 Std.).
- **Abhängigkeiten / Blocker:** ✋ Benötigt produktive Enterprise Cloud-Tenant Zugänge (AWS/Azure/GCP).
- **Akzeptanzkriterien:** `enterprise/acceptance_cli.cjs` meldet `N06_PASS` mit echten Cloud-Endpunkten.
- **Validierung & Testumgebung:** Live-Cloud-Infrastruktur des Unternehmens.

---

#### Task TA-ENT-02: SIEM Outbox Pipeline Real-Time Dispatcher
- **Stabile ID:** `TA-ENT-02`
- **Themenbereich:** Unternehmensadministration & Integrationen (`[Enterprise]`)
- **Entwicklungstyp:** Erweiterung (`EXT`)
- **Befund mit Beleg:** Die SIEM-Outbox-Queue (`ENTERPRISE_SIEM_EXPORTQUEUE.md`) speichert Ereignisse lokal ab, der aktive Versand an Splunk/Elastic/Syslog HTTP Collector ist standardmäßig deaktiviert.
- **Gewünschtes Ergebnis & Nutzwert:** Echtzeit-Übertragung von Sicherheitsvorfällen an das zentrale Enterprise SIEM.
- **Abgegrenzter Umfang:** Implementierung des sicheren HTTPS-Dispatchers mit Mutual TLS (mTLS) und Rate-Limiting.
- **Priorität & Aufwand:** **P3 (Niedrig)** / Aufwandsklasse **M** (ca. 12 Std.).
- **Abhängigkeiten / Blocker:** ✋ Benötigt ein freigegebenes SIEM-Test-Endpoint und TA-ENT-01.
- **Akzeptanzkriterien:** Ereignisse werden im SIEM indiziert. Zertifikatsfehler führen zu geordnetem Retry in die Outbox.
- **Validierung & Testumgebung:** Live Enterprise-SIEM Sandbox.

---

## 6. Release-Roadmap & Handlungsempfehlungen

### Phasenbasierte Roadmap

```
+----------------------------------------------------------------------------------------------------+
|                                         RELEASE ROADMAP                                            |
+----------------------------------------------------------------------------------------------------+
| HORIZONT 1: KURZFRISTIG (Jetzt - Store Release & Lokale Perf/A11y)                                 |
| ------------------------------------------------------------------                                 |
| [1] TA-REL-01: ATN Store-Einreichung & Tag-Bump (v1.24.0 / v1.23.1) [P0] ✋                        |
| [2] TA-PER-01: IndexedDB Write Buffer & Performance Tuning [P2] (Lokale Codebase)                  |
| [3] TA-SEC-01: DOM-Clobbering-Härtung & Safe Templates [P2] (Lokale Codebase)                       |
| [4] TA-UI-01:  Barrierefreie Status-Announcer (ARIA live) [P2] (Lokale Codebase)                    |
| [5] TA-I18N-01: i18n Coverage Check in Pre-Commit Pipeline [P2] (Lokale Codebase)                  |
|                                                                                                    |
| HORIZONT 2: MITTELFRISTIG (Post-Store Abnahmen & Quality Assurance)                                 |
| -------------------------------------------------------------------                                 |
| [6] TA-TST-01: Native OS-Abnahme unter Windows 11 & macOS [P1] ✋                                  |
| [7] TA-TST-02: Barrierefreiheits-Prüfung mit NVDA / JAWS / VoiceOver [P1] ✋                        |
| [8] TA-REL-02: Live In-App Update- & Rollback-Verifikation via ATN [P1] ✋                         |
|                                                                                                    |
| HORIZONT 3: SPÄTER (Enterprise N06 & Cloud Deployment)                                            |
| ------------------------------------------------------                                             |
| [9] TA-ENT-01: Enterprise N06 Cloud-Storage & KMS Deployment [P3] ✋                                |
| [10] TA-ENT-02: SIEM Outbox Real-Time HTTPS Dispatcher [P3] ✋                                     |
+----------------------------------------------------------------------------------------------------+
```

---

### Die 3 sinnvollsten nächsten Arbeitspakete (Empfehlung)

1. **`TA-REL-01`: ATN-Store-Einreichung & Signierung (P0 / Maintainer-Voraussetzung)**
   - **Begründung:** Die Extension hat alle technischen Vorbereitungen (C1–C6) mit 953 passing Tests und vollständiger Sechssprachigkeit bestanden. Der Veröffentlichungsschritt ist das einzige verbleibende Nadelöhr zur Bereitstellung an Endanwender.

2. **`TA-PER-01` / `TA-SEC-01`: Lokale Performance- & Sicherheitsoptimierungen (P2 / Sofort umsetzbar)**
   - **Begründung:** Diese Aufgaben können ohne jegliche externe Zugänge oder Schlüssel unmittelbar im Repository umgesetzt, getestet und verifiziert werden. Sie steigern die Effizienz der Hintergrundverarbeitung und härten die Extension gegen Edge-Case-Injektionen.

3. **`TA-TST-01`: Native OS-Abnahme unter Windows 11 & macOS (P1 / Hardware-Voraussetzung)**
   - **Begründung:** Nach der Ersteinreichung ist der Nachweis des echten Systembrowser-Handoffs unter Windows und macOS der kritischste Qualitätsschritt, um Plattform-spezifische Regressionen auszuschließen.

---

### Abgrenzung: Sofort Ausführbar vs. Extern Blockiert

| Status | Arbeitspakete | Benötigte Voraussetzungen / Grund |
|---|---|---|
| **Sofort Ausführbar (Lokal)** | `TA-PER-01`, `TA-SEC-01`, `TA-UI-01`, `TA-I18N-01` | Keine externen Abhängigkeiten. Läuft vollständig in der lokalen Sandbox / CI mit `pnpm test`. |
| **Extern Blockiert (✋)** | `TA-REL-01`, `TA-REL-02` | Benötigt Maintainer-Secrets für addons.thunderbird.net (ATN JWT Key & Secret). |
| **Extern Blockiert (✋)** | `TA-TST-01`, `TA-TST-02` | Benötigt physische/virtuelle Windows 11 / macOS Maschinen und installierte Assistenzsoftware (NVDA, JAWS). |
| **Extern Blockiert (✋)** | `TA-ENT-01`, `TA-ENT-02` | Benötigt enterprise-seitige Cloud-Accounts (AWS/Azure/GCP), KMS-Schlüssel und SIEM-Testumgebungen. |

---
*Ende des Berichts.*
