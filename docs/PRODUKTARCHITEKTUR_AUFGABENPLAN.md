# Thundy AV – Produktarchitektur, Bestandsaufnahme und Priorisierter Aufgabenplan

## 1. Kompakte Bestandsaufnahme des tatsächlichen Stands

Diese Bestandsaufnahme wurde durch direkte Prüfung des Quellcodes (`manifest.json`, `background.js`, `api.js`, `link_audit.js`, `db.js`, `enterprise/` usw.), der Testsuiten (`949 passing tests`), der Linters (`0 errors`, 24 bekannte Thunderbird-False-Positives), der Dokumentation (`docs/STATUS.md`, `THUNDERBIRD_LINUX_ABNAHME.md`, `ENTERPRISE_UMSETZUNGSSTAND.md`) sowie der CI-Pipelines und Releases ermittelt.

### Unterscheidung der Implementierungsstände:

1. **Implementiert und nachgewiesen (Produktiv/Extension-Runtime v1.23.0-dev / v1.22.0 Tag):**
   - **Lokaler Scan-Engine & Risikobewertung:** SHA-256 Anhangs-Hashing, Betreff/Body-Heuristiken, Reply-To & First-Contact-Erkennung, SPF/DKIM/DMARC Authentifizierungsprüfungen, Whitelist/Blacklist, lokaler Score (0–100) (`risk.js`, `scan_policy.js`).
   - **Opt-in & Datenschutz-Stufen:** Strikte Durchsetzung des globalen Consent-Schalters vor jedem Netzwerktransfer, 3 Privacy Tiers (`strict`, `balanced`, `max`), dynamische Host-Permissions per runtime `browser.permissions.request()` (`providers.js`, `api_gateway.js`).
   - **Link-Schutz (Time-of-Click) & Audit:** Abfangen von Klicks, gebrandeter Warn/Bestätigungsdialog, lokales Audit-Log (`link_audit.js`, `audit.html`) mit Aufzeichnung von URL, Kontext-Score, Provider-Urteil und Nutzerentscheidung (`ABORTED`, `OPENED`, `OPEN_ERROR`, `PENDING`).
   - **Lokales Theme- & Designsystem:** Dynamische Farbanpassung an Thunderbird, native Hell-/Dunkel-Themes, Akzentfarben, Dichte-Steuerung (kompakt/komfortabel) (`theme.js`, `design_system.js`, `design.css`).
   - **Sechssprachigkeit (i18n):** Vollständige UI-Übersetzungen in EN, DE, FR, ES, IT, PL für alle Extension-Seiten und den 3-stufigen Einrichtungsassistenten (`_locales/`, `i18n.js`).
   - **Linux-GUI-Abnahme unter Thunderbird 140 ESR:** Reproduzierbarer automated Runner (`tools/thunderbird-live.dev.py`) mit 13 Profilen, sauberen Neustarts, crash-recovery (`SIGKILL`) und echten X11/Xvfb-Screenshots (`docs/THUNDERBIRD_LINUX_ABNAHME.md`).

2. **Implementiert, aber unzureichend/partiell geprüft (Fehlende OS-/Plattformumgebungen):**
   - **Windows & macOS Plattformabnahme:** Erweiterungsanzeige und Dialoge laufen zwar auf MV3-Standards, aber native Interaktionen (Default Browser Handoff, High-DPI/Zoom, Windows/macOS OS-Betrieb) sind mangels Testgeräten in CI unbelegt.
   - **Screenreader & Barrierefreiheit:** Barrierefreie ARIA-Attribute und Focus-Traps in Dialogen sind im JSDom/Playwright-Testsuite eingebunden, eine echte Prüfung mit NVDA, JAWS oder VoiceOver steht aus.
   - **Native Error/Retry bei Browser-Öffnung:** OS-Fehler beim Aufruf des Standardbrowsers (z. B. fehlender Handler) fallen teilweise auf `OPENED` statt `OPEN_ERROR` zurück, wenn Thunderbird keinen Fehler zurückmeldet.

3. **Teilweise umgesetzt / Vorarbeit im Repository (Enterprise-Komponenten):**
   - **Enterprise Node-Kern (`enterprise/`):** Lokaler Ingestion-Service, signierter Outbox-Broker, Ed25519-Policy-Validation, Witness-Checkpoints, Incident-Cases, Health-Checks, Heartbeat-Monitore, Capacity-Alerts und Storage-Jobs für Cloud-Simulatoren (S3/Azure/GCP).
   - **Enterprise Profile-Assistent:** In den Einstellungen integrierter Entwurf mit Vorbereitungsprofilen (Azure/AWS/GCP, Entra ID/Keycloak, Intune/Ansible, SIEM).

4. **Offen oder durch konkrete Voraussetzungen blockiert:**
   - **Store-Veröffentlichung & Signierung:** Addon ist noch nicht im Thunderbird Add-ons Store (addons.thunderbird.net) gelistet/signiert (v1.22.0 XPI auf GitHub ist unsigniert). Real-Screenshots für den Store fehlen noch.
   - **Produktive Enterprise-Anbindungen & Cloud Object Lock (SEALED):** Echte Cloud-Anbindungen, OIDC-BFF-SSO, zentrales Portal, Zertifikats-Enrollment und herstellergebundene Integrationen sind mangels freigegebener Infrastruktur, Secrets und Mandantenentscheidungen blockiert.
   - **Automatische Update-Verteilung & Rollback-Mechanismen:** Kein zentraler Update-Server/Manifest für automatische Enterprise-Updates definiert.

---

## 2. Dynamische Themenlandkarte

Die Potenziale von Thundy AV sind nach primären Themenbereichen, Schlagworten und Entwicklungstypen (*Optimierung*, *Verbesserung*, *Erweiterung*) gegliedert:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           THUNDY AV THEMENLANDKARTE                             │
└─────────────────────────────────────────────────────────────────────────────────┘

 1. Schutzwirkung & Analysequalität [SCHUTZ]
    ├── [Erweiterung] YARA/Phishing-Pattern Matching für Heuristik-Corpus
    └── [Optimierung] Asynchrone DNS/Punycode-Validierung & TLD-Lookups

 2. Linkentscheidungen, Score & Audit [LINK-AUDIT]
    ├── [Improvement] Echte Unterscheidung zwischen OS-Handoff (`OPENED`) und OS-Error (`OPEN_ERROR`)
    └── [Erweiterung] Manipulationssichere Signierung lokaler Audit-Logs

 3. Bedienung, Informationsdarstellung & Barrierefreiheit [UX-A11Y]
    ├── [Improvement] Native Screenreader-Verifizierung (NVDA/JAWS/VoiceOver)
    └── [Improvement] Echte Store-Listing High-Res Screenshots & Landingpage-Assets

 4. Mehrsprachigkeit & Themes [I18N-THEME]
    ├── [Optimierung] Eliminierung redundanter CSS-Variablen & Inline-Styles
    └── [Improvement] Dynamischer Sprachwechsel ohne Seiten-Reload in Admin-Ansichten

 5. Performance, Speicher & Hintergrundverarbeitung [PERF-CORE]
    ├── [Optimierung] Zero-Allocation Loop Parsing bei Header- & Link-Analysen
    └── [Optimierung] IndexedDB Batch-Injections & In-Memory Pre-Caching

 6. Plattformkompatibilität, OS & Updates [PLATFORM-CI]
    ├── [Improvement] Windows & macOS native Test-Runner im CI-Prozess
    └── [Erweiterung] Automatisierte Update-Manifest-Verwaltung & Unsigned/Signed Rollback-Pfade

 7. Unternehmensadministration & Enterprise Integration [ENTERPRISE]
    ├── [Erweiterung] OIDC / PKCE Single Sign-On Integration
    └── [Erweiterung] Real Cloud Storage Adapter Binding (S3/Azure/GCP Object Lock)
```

---

## 3. Priorisierte Aufgabentabelle

| ID | Themenbereich | Typ | Befund & Beleg | Gewünschtes Ergebnis & Nutzwert | Prio | Aufwand | Blocker / Abhängigkeiten | Akzeptanzkriterien | Validierung / Umgebung |
|---|---|---|---|---|---|---|---|---|---|
| **UX-01** | UX & Barrierefreiheit | Improvement | `docs/STATUS.md`, placeholders in `docs/screenshots/` | Echte, hochauflösende Screenshots (≥1200px) von Popup, Audit, Setup & Einstellungen unter TB 140. | **P1** | Klein | Benötigt OS mit TB 140 ESR GUI | Screenshots decken alle 6 Sprachen ab, keine SVG-Platzhalter mehr. | Manuelle Screenshot-Prüfung & Store-Gate Check |
| **SYS-01** | Plattformkompatibilität | Improvement | `THUNDERBIRD_LINUX_ABNAHME.md`: Nur Linux X11/Xvfb im CI. | CI-Pipelines für Windows (Win11) und macOS (macOS 14/15) Runner. | **P1** | Mittel | Benötigt GitHub-Actions Windows/macOS Runner | Native Link-Interception & Dialoge laufen fehlerfrei auf Win/macOS. | Automated CI Test Execution (`npm run check`) |
| **AUD-01** | Linkentscheidungen & Audit | Improvement | `THUNDERBIRD_LINUX_ABNAHME.md`: Stille OS-Fehler werden als `OPENED` protokolliert. | Exakte Unterscheidung: `OPENED` nur bei bestätigter OS-Zustellung, sonst `OPEN_ERROR`. | **P1** | Klein | Keine | Kein Stiller Fehler täuscht erfolgreiches Öffnen vor. | `api.test.js` & `background.test.js` |
| **A11Y-01**| UX & Barrierefreiheit | Improvement | `UI_BROWSERPRUEFUNG.md`: Playwright/axe bestanden, aber kein echter Screenreader. | Barrierefreie Bedienbarkeit aller Add-on-Dialoge mit NVDA & VoiceOver nachgewiesen. | **P2** | Mittel | Screenreader Testumgebung | Blinde/sehbehinderte Nutzer können Warnungen auditieren und Links sicher bedienen. | Manuelle Accessibility-Abnahme |
| **UPD-01** | Updates & Release | Erweiterung | `README.md`: Keine automatisierte Update-Verteilung / Store Listing. | Strukturierte Release-Pipeline mit Update-Manifest (updates.json) für Self-Hosted / Enterprise Rollouts. | **P2** | Mittel | Signing Keys / Release Server | Thunderbird erkennt neue XPI-Releases automatisch und bietet sicheres Update/Rollback. | Web-ext sign & Update-Server Test |
| **SEC-01** | Schutzwirkung | Optimierung | `risk.js`: Heuristiken basieren auf RegEx-Corpus. | Einführung einer hochperformanten, Trie-basierten Keyword/Punycode-Prüfung für Phishing-Domains. | **P2** | Mittel | Keine | O(1) Domain- & Typosquatting-Lookups ohne Regex-Overhead auf Hot-Paths. | `npm test` & Performance-Benchmark |
| **ENT-01** | Enterprise Integration | Erweiterung | `ENTERPRISE_UMSETZUNGSSTAND.md`: Cloud-Adapter sind Simulatoren. | Produktive S3/Azure Blob Object Lock Anbindung mit echten Credentials für Immutable Audit (SEALED). | **P3** | Groß | Blockiert durch fehlende Enterprise Cloud Credentials | Signierte Audit-Logs werden im Cloud-Object-Lock als `SEALED` bestätigt. | Integrationstest mit Live Cloud Sandbox |
| **ENT-02** | Enterprise Administration| Erweiterung | `ENTERPRISE_UMSETZUNGSKONZEPT.md`: OIDC/SSO ist vorbereitendes Modell. | OIDC PKCE Auth Flow für Enterprise Portal Admin-Rollen. | **P3** | Groß | Blockiert durch fehlenden Identity Provider (Entra ID/Keycloak) | Admin-Authentifizierung erfolgt sicher über Firmen-IdP. | OIDC Mock / Live IdP Test |

---

## 4. Roadmap für kurzfristige, mittelfristige und spätere Schritte

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                THUNDY AV ROADMAP                                 │
└──────────────────────────────────────────────────────────────────────────────────┘

 Phase 1: Kurzfristig (Store Readiness & Verlässlichkeit)
 ├── UX-01: Erstellung echter Store-Screenshots für alle 6 Sprachen
 ├── AUD-01: Korrektur der OPENED / OPEN_ERROR Unterscheidung bei stillen OS-Fehlern
 └── SYS-01: Erhöhung der Testabdeckung auf Windows- & macOS-Runnern in CI

 Phase 2: Mittelfristig (Plattformkompatibilität & Barrierefreiheit)
 ├── A11Y-01: Native Screenreader-Validierung (NVDA, VoiceOver, JAWS)
 ├── UPD-01: Etablierung automatisierter Enterprise Update-Manifeste & Signierung
 └── SEC-01: Performance-Optimierung der Link- & Domain-Risikoanalyse

 Phase 3: Spätere Schritte (Produktive Enterprise-Aktivierung)
 ├── ENT-01: Anbindung echter Cloud-Bucket-Lock-Speicher für SEALED Evidence
 └── ENT-02: OIDC Single Sign-On & Governance Integration im Admin-Portal
```

---

## 5. Die drei sinnvollsten nächsten Arbeitspakete (Begründung)

1. **Arbeitspaket AUD-01: Präzisierung der Link-Öffnungszustände (`OPENED` vs. `OPEN_ERROR`)**
   - *Begründung:* Ein Kernversprechen von Thundy AV ist die nachvollziehbare und unverfälschte Protokollierung von Nutzerentscheidungen. Wenn das Betriebssystem die Browser-Prozessübergabe lautlos verweigert, darf dies im Audit nicht als erfolgreiches `OPENED` gewertet werden. Die Behebung erhöht direkt die Integrität der Audit-Logs ohne externe Blockaden.

2. **Arbeitspaket UX-01: Erstellung echter Store-Screenshots & Veröffentlichungs-Assets**
   - *Begründung:* Das Add-on ist technisch auf Stand v1.23.0-dev vorbereitet, leidet jedoch bei der Store-Einreichung (addons.thunderbird.net) unter fehlenden realen Screenshots (aktuell nur SVG-Platzhalter). Die Erstellung dieser Assets schließt eine verbleibende Lücke zur offiziellen Store-Listung.

3. **Arbeitspaket SYS-01: Implementierung von Windows & macOS Cross-Platform CI-Tests**
   - *Begründung:* Obwohl die Linux-X11/Xvfb-Tests hervorragend abgedeckt sind, läuft Thunderbird bei den meisten Anwendern unter Windows und macOS. Die Absicherung der nativen WebExtension APIs (`windows.openDefaultBrowser`, Dialog-Injektion) auf Windows- und macOS-Runnern stellt die Plattformstabilität sicher.

---

## 6. Empfehlungen & Voraussetzungen

### Sofort mit vorhandenen Mitteln ausführbar:
- Behebung der `OPENED`/`OPEN_ERROR`-Logik bei Betriebssystem-Handoffs (**AUD-01**).
- Erstellung der hochauflösenden Screenshots via lokalem Runner bzw. manueller TB 140 ESR Umgebung (**UX-01**).
- Einbindung von GitHub Actions `windows-latest` und `macos-latest` Runner-Jobs im Repository (**SYS-01**).
- Optimierung der Risikobewertungs-Engine und Regex-Sparsamkeit (**SEC-01**).

### Benötigen konkrete externe Voraussetzungen:
- **Enterprise Cloud Storage SEALED (ENT-01):** Benötigt AWS/Azure/GCP Account-Zugänge mit aktivierter S3 Object Lock / Azure Immutable Storage Policy.
- **Enterprise OIDC SSO (ENT-02):** Benötigt freigegebenen Identity Provider (Keycloak, Entra ID, Okta) mit registrierter Client-ID & Redirect-URIs.
- **Add-on Store Listing:** Benötigt Account-Freigabe und API-Keys auf `addons.thunderbird.net` für automatisierte `web-ext sign` Läufe.
