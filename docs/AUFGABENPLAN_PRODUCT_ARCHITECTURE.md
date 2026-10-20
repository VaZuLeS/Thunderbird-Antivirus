# Technischer Produktarchitektur-Bericht und Priorisierter Aufgabenplan – Thundy AV

**Rolle:** Technischer Produktarchitekt und Senior Thunderbird-Extension-Entwickler
**Projekt:** Thundy AV (Thunderbird-Antivirus WebExtension MV3)
**Datum:** 16. Oktober 2026
**Zielversion / Stand:** Tag/Release `v1.23.0` (Commit `df63c76`) / Vorbereiteter Entwicklungsstand

---

## 1. Kompakte Bestandsaufnahme

Die Analyse beruht auf der direkten Auswertung des Quellcodes, der Manifest-Deklarationen (`manifest.json`), der Testsuiteresultate (`pnpm test`), der CI-Workflows (`docs/ci/`), der Dokumentationsakten (`docs/`) sowie der Release-Artefakte.

### Differenzierung des Umsetzungsstands

#### A. Implementiert und nachgewiesen (Proven)
1. **Kern-Schutzmechanismen & Opt-in Scanner:**
   - Heuristische Risikobewertung (`risk.js`) für Urgency, Discrepancies, BEC und Brand-Similarity.
   - Einpassung in Thunderbird MV3 mit Opt-in-Banner (`message_ui.js`), Einrichtungsassistent (`onboarding.js`) und nativen Popups (`popup.html`).
   - Strenges Konsent- und Privacy-Tier-Management (`scan_policy.js`): `strict` (nur Hashes/Domains), `balanced` (Anhangsupload), `max` (vollständige URLs).
2. **Linkschutz, Score & Audit-Journal (`link_audit.js`):**
   - Interzeption von In-Mail-Links mit Time-of-Click Dialog (`LinkCheckModal` / `message_ui.js`).
   - Lokales, datenschutzfreundliches Audit-Journal (`audit.html`, `audit.js`) mit URL, Score im Nachrichtenkontext, Anbieterurteil, Zeitstempel und JSON/CSV-Export.
   - Vollständige Einhaltung der Semantik: `OPENED` signalisiert ausschließlich die an Thunderbird übergebene Öffnungsanforderung (kein Nachweis eines Browserstarts oder Webseitenbesuchs).
   - Prozessabbruch-Resilienz: Bei Abstürzen oder Prozessverlust bleibt der Status auf `PENDING` stehen und wird niemals fälschlicherweise in eine Entscheidung umgedeutet.
3. **Mehrsprachigkeit & Lokalisierung (`i18n.js`, `_locales/`):**
   - Sechs Sprachen vollständig unterstützt: Englisch (`en`), Deutsch (`de`), Französisch (`fr`), Spanisch (`es`), Italienisch (`it`) und Polnisch (`pl`).
   - Automatischer Fallback auf gebündelte englische Kataloge ohne Remote-Translation-Calls.
4. **Themes, Designsystem & Barrierefreiheit (`design_system.js`, `theme.js`, `theme.css`):**
   - Dynamische Theme-Engine für System-Follow, Hell- und Dunkelmodus sowie Akzentfarben (Ocean, Violet, Forest, Amber).
   - Einstellbare Informationsdichte (Comfortable / Compact).
   - Tastaturbedienung und WCAG 2.4.3 Focus Traps im Link-Dialog.
5. **Autonome Enterprise-Lokaldienste (`enterprise/`):**
   - Signierte Offline-Prüfketten (Ed25519/JCS), Immutable Outbox, Audit-Verifizierung CLI, Incident-Management, Systemprofile-Vorbereitung (`enterprise_setup.js`) und Kapazitätsüberwachung.

#### B. Implementiert, aber unzureichend geprüft (Lacking OS/Field Proof)
1. **OS-spezifische Browserübergabe & Screenreader-Tests:**
   - Die echte Interaktion mit externen Systembrowsern unter Windows und macOS sowie die Screenreader-Ausgabe (NVDA/JAWS/VoiceOver) ist in der aktuellen Linux-Xvfb-Umgebung nicht realitätsnah überprüfbar (`docs/STATUS.md`).
2. **Updateverteilung & Rollback im Thunderbird Add-on Store (ATN):**
   - Das Verhalten automatischer Updates und Rollbacks kann erst nach einer echten Veröffentlichung im Thunderbird-Store nachgewiesen werden.

#### C. Teilweise umgesetzt (Partially Implemented)
1. **Unternehmensprofile & Adminansichten:**
   - Das User Interface zur Auswahl von Profilen (`enterprise_setup.html`) ist sechssprachig implementiert, erstellt jedoch primär inaktive Konfigurationsentwürfe ohne aktive Netzwerkanbindung.

#### D. Konzeptionell vorbereitet (Conceptually Prepared)
1. **Enterprise N01–N18 / EN-01–EN-19 Spezifikationen:**
   - Vollständiges Umsetzungskonzept für zentrale SSO-, SEALED-Storage-, MDM- und SIEM-Anbindungen (`docs/ENTERPRISE_UMSETZUNGSKONZEPT.md`).

#### E. Offen oder durch konkrete Voraussetzungen blockiert (Blocked)
1. **ATN Store-Einreichung & Signierung (Blocker: Maintainer Keys):**
   - Die automatische Signierung und Veröffentlichung setzt offizielle Maintainer-Schlüssel (`AMO_JWT_ISSUER`, `AMO_JWT_SECRET`) voraus (`docs/STATUS.md`).
2. **Echte Enterprise-Cloud-Integration (Blocker: Cloud Credentials / Flotte):**
   - S3/Azure/GCP-Adapter arbeiten mit lokalen Test-Doubles. Echte Cloud-Endpunkte benötigen produktive Credentials und Firmennetzwerk-Zugänge.

---

## 2. Dynamische Themenlandkarte

| Primärer Themenbereich | Zugeordnete Befunde & Schlagworte | Entwicklungstyp |
|---|---|---|
| **Schutzwirkung & Analysequalität** | Lokale Risikobewertung, Brand-Impersonation, SPF/DKIM/DMARC Verification | *Optimierung* |
| **Linkentscheidungen, Score & Audit** | Time-of-Click Dialog, Audit-Journal, `OPENED`-Semantik, Process Crash Recovery (`PENDING`) | *Optimierung / Verbesserung* |
| **Bedienung & Barrierefreiheit** | WCAG Focus Traps, Keyboard Navigation, High-Contrast High-Density Layouts | *Verbesserung* |
| **Mehrsprachigkeit** | Complete 6-Locale Coverage (EN, DE, FR, ES, IT, PL), Dynamic Fallbacks | *Optimierung* |
| **Themes & Designsystem** | System/Dark/Light Modes, Color Schemes, Dynamic UI Spacing | *Verbesserung* |
| **Einrichtung & Richtlinien** | Onboarding Wizard, Privacy Tier Enforcer, Local Allow/Blocklists | *Verbesserung* |
| **Performance & Speicher** | Cache-Retention, In-Memory Expirations, Unclobbered DOM Processing | *Optimierung* |
| **Datenschutz & Data Lifecycle** | Opt-in External Scans, No-Telemetry Core, Local Profile Encapsulation | *Optimierung* |
| **Unternehmensadministration** | System Profile Drafts, Local Node Enterprise CLI, Cryptographic Audit Verification | *Erweiterung* |
| **Architektur & Wartbarkeit** | MV3 WebExtension Hygiene, DOM Clobbering Defense, Zero-Dependency Core | *Optimierung* |
| **Tests & Plattformkompatibilität** | Cross-OS Verification (Windows/macOS), Screenreader Accessibility Proof | *Optimierung / Erweiterung* |
| **Veröffentlichung & Updates** | ATN Store Submission Pipeline, Automated Release Workflow, Extension Rollback | *Erweiterung* |

---

## 3. Priorisierte Aufgabentabelle

| Aufgaben-ID | Themenbereich | Typ | Befund & Beleg | Umfang & Nutzwert | Prio | Aufwand | Blocker / Dep. | Akzeptanzkriterien | Validierung & Testumgebung |
|---|---|---|---|---|---|---|---|---|---|
| **TASK-PUB-01** | Veröffentlichung & Updates | Erweiterung | Store-Gate meldet `GO`, Veröffentlichung steht aus (`docs/STATUS.md`). | Veröffentlichung der signierten Extension im Thunderbird Store (ATN) für Endanwender. | **P0 (Kritisch)** | S (1-2 Tage) | ATN-Maintainer API-Keys (`AMO_JWT_ISSUER` / `SECRET`). | Extension auf ATN gelistet, signiertes XPI abrufbar, Store-URL verlinkbar. | Echte ATN Store API / Release Pipeline (`docs/ci/release.yml`). |
| **TASK-TEST-01** | Tests & Plattform | Optimierung | Reale OS-Prüfung bisher nur unter Linux/Xvfb nachgewiesen (`docs/STATUS.md`). | Validierung des Linkschutzes und der Systembrowser-Übergabe auf Windows 11 & macOS. | **P1 (Hoch)** | M (3-5 Tage) | Testgeräte mit Windows 11 & macOS Monterey/Ventura. | Native Browser-Verknüpfungen öffnen Links sicher ohne Thunderbird-Crash. | Echte Thunderbird 140 ESR Installationen auf Windows/macOS. |
| **TASK-TEST-02** | Bedienung & Barrierefreiheit | Verbesserung | Screenreader-Abnahme bisher nur simuliert via DOM-Tree Check (`UI_BROWSERPRUEFUNG.md`). | Barrierefreie Bedienung aller Add-on-Seiten für seheingeschränkte Nutzer sicherstellen. | **P1 (Hoch)** | M (2-4 Tage) | Screenreader-Testumgebung (NVDA unter Windows, VoiceOver unter macOS). | Vollständige Sprachausgabe aller Dialoge, Live-Regions für Scans und Modals. | NVDA / VoiceOver / JAWS in Kombination mit Thunderbird 140 ESR. |
| **TASK-SEC-01** | Schutzwirkung & Qualität | Optimierung | Brand-Impersonation verwendet vordefinierte Top-Marken (`risk.js`). | Erweiterung der Phishing-Erkennung um dynamische Ähnlichkeitsprüfung (Levenshtein/Jaro-Winkler). | **P2 (Mittel)** | M (3-4 Tage) | Keine. | Zuverlässige Erkennung von Typo-Squatting ohne Falsch-Positive bei Subdomains. | Node.js Unit-Tests (`pnpm test`) & Test-EMLs (`testdata/`). |
| **TASK-ENT-01** | Unternehmensadmin. | Erweiterung | Enterprise Profile UI (`enterprise_setup.html`) speichert nur lokale Entwürfe. | Anbindung der lokalen Profile an den signierten Enterprise-Lokaldienst. | **P2 (Mittel)** | L (1-2 Wochen) | Firmennetzwerk / Test-Server für Enterprise-Service Ingest. | Exportierte Profil-Entwürfe können von `enterprise/service.cjs` verarbeitet werden. | Lokaler Node.js Enterprise Service (`npm run enterprise:local`). |
| **TASK-PERF-01** | Performance & Speicher | Optimierung | Audit-Export konvertiert große Arrays in-memory (`audit.js`). | Chunked Stream-Verarbeitung für Audit-Log CSV/JSON Exporte bei >10.000 Einträgen. | **P3 (Niedrig)** | S (1-2 Tage) | Keine. | UI bleibt während des Log-Exports bei hoher Datenmenge vollständig responsiv (<50ms Lag). | Playwright / Browser Performance Profiler (`check:ui`). |

---

## 4. Roadmap

```
+-----------------------------------------------------------------------------------+
| KURZFRISTIG (Phase 1: Store-Launch & Plattform-Abnahme)                           |
+-----------------------------------------------------------------------------------+
| 1. TASK-PUB-01: ATN Store submission & signing setup with maintainer credentials.  |
| 2. TASK-TEST-01: Real Windows 11 & macOS execution validation for browser handoff.|
| 3. TASK-TEST-02: Screenreader accessibility verification (NVDA / VoiceOver).      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| MITTELFRISTIG (Phase 2: Erweiterte Phishing-Erkennung & Enterprise-Infrastruktur) |
+-----------------------------------------------------------------------------------+
| 1. TASK-SEC-01: Enhanced Brand-Impersonation & Typo-Squatting heuristics.          |
| 2. TASK-ENT-01: Integration of enterprise profile UI with local broker backend.   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| SPÄTER (Phase 3: Skalierung & Multi-Tenant Enterprise Features)                    |
+-----------------------------------------------------------------------------------+
| 1. TASK-PERF-01: Streaming memory optimization for massive enterprise logs.       |
| 2. Real-time multi-tenant SIEM queue integration with hardware-bound keys.        |
+-----------------------------------------------------------------------------------+
```

---

## 5. Die drei wichtigsten nächsten Arbeitspakete

### 1. Arbeitspaket: `TASK-PUB-01` – Signierung & Veröffentlichung im Thunderbird Store (ATN)
- **Begründung:** Der lokale Entwicklungsstand hat das Submission-Gate mit `GO` bestanden (`npm run store-gate`), 953 Tests laufen fehlerfrei, und alle Store-Assets/Anforderungen sind erfüllt. Der größte Nutzwert entsteht durch die Bereitstellung für Endanwender.
- **Voraussetzung:** Vergabe/Bereitstellung der AMO/ATN API-Keys (`AMO_JWT_ISSUER`, `AMO_JWT_SECRET`) durch die Maintainer.

### 2. Arbeitspaket: `TASK-TEST-01` – Windows 11 & macOS Plattform-Validierung
- **Begründung:** Thundy AV greift bei der Linköffnung auf native Thunderbird- und OS-Schnittstellen zu. Die bisherigen Abnahmen wurden unter Linux Xvfb durchgeführt. Eine Verifizierung auf Windows und macOS garantiert, dass keine OS-spezifischen Regressionen bei der Browserübergabe auftreten.
- **Voraussetzung:** Testumgebung mit Windows 11 und macOS Monterey/Ventura samt Thunderbird 140 ESR.

### 3. Arbeitspaket: `TASK-TEST-02` – Echte Screenreader-Barrierefreiheitsprüfung
- **Begründung:** Barrierefreiheit ist ein zentrales Produktversprechen von Thundy AV. Die Implementierung nutzt bereits ARIA-Attribute und Focus Traps (`message_ui.js`), jedoch fehlt die finale Bestätigung mit echten Screenreadern (NVDA, VoiceOver) zur Vermeidung von Usability-Hürden.
- **Voraussetzung:** Testarbeitsplatz mit NVDA (Windows) und VoiceOver (macOS).

---

## 6. Abschließende Empfehlungen & Voraussetzungen

1. **Ausführbarkeit mit vorhandenen Mitteln:**
   - Alle Code-Optimierungen, Heuristik-Erweiterungen (`TASK-SEC-01`), Local Enterprise-Skripte (`TASK-ENT-01`) sowie Performance-Refactorings (`TASK-PERF-01`) sind mit der bestehenden Entwicklungs- und Testumgebung (`pnpm test`, `pnpm run lint:filtered`) sofort umsetzbar.
2. **Erforderliche externe Voraussetzungen:**
   - **ATN Store Signierung (`TASK-PUB-01`):** Erfordert die Hinterlegung der Maintainer-Schlüssel in GitHub Secrets (`AMO_JWT_ISSUER`, `AMO_JWT_SECRET`).
   - **Plattform- & Barrierefreiheitsnachweis (`TASK-TEST-01`, `TASK-TEST-02`):** Erfordert physikalische oder virtuelle Windows/macOS-Maschinen mit Screenreader-Software.
