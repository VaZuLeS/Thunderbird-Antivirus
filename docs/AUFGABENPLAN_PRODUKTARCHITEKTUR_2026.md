# Evidenzbasierter Produktarchitektur- & Aufgabenplan „Thundy AV“ (Stand: Oktober 2026)

**Rolle:** Technischer Produktarchitekt & Thunderbird-Extension-Entwickler
**Projekt:** Thundy AV — Email Attachment and Link Scanner for Thunderbird (WebExtension MV3)
**Repository-Basis:** Branch `main` / `jules-*`, Tag `v1.23.0` (df63c76)
**Status-Schranke:** `npm run store-gate` / `npm run goal` (Kriterien C1–C6 PASS, C7 dev-diff)

---

## 1. Kompakte Bestandsaufnahme (Tatsächlicher Stand)

Eine systematische Prüfung von Quellcode (`src/`, Root-Laufzeitdateien, `enterprise/`), Architektur, Aufgabenplänen (`docs/AUFGABENPLAN_*.md`), Dokumentation (`docs/`), Testreihen (`pnpm test`, `tools/thunderbird-live.dev.py`), CI (`docs/ci/`), Releases und GitHub Pages ergibt folgende nachvollziehbare Differenzierung:

### 1.1 Implementiert und nachgewiesen
- **WebExtension MV3 Kernfunktionen (`v1.23.0`):**
  - Dreistufiges Datenschutzmodell (`strict`, `balanced`, `max`) mit Opt-in für Telemetrie/Analyse (`personalCommunications`) und optionaler Datei-Upload-Berechtigung (`sensitiveDataUpload`) (`manifest.json`, `api.js`, `options.js`).
  - Dreistufiger Erstinstallations-Einrichtungsassistent (`onboarding.html`/`js`) vollständig lokalisiert in 6 Sprachen (EN, DE, FR, ES, IT, PL).
  - Linkschutz mit Interzeption, Risiko-Score-Berechnung (`risk.js`), HTML-Entschärfung (`sanitize.js`), nativem Toolbar-Popup (`popup.html`, `message_ui.js`), gebrandetem Linkdialog und lokalem Entscheidungs-Audit-Log (`audit.html`/`js`).
  - Nativer Theme-Adapter (`theme.js`, `theme.css`) mit automatischer Thunderbird-Farberkennung (Hell/Dunkel), benutzerdefinierten Akzentfarben und einstellbarer Informationsdichte.
- **Automatisierte Qualitätssicherung & Testabdeckung:**
  - 953 automatisierte Unit- und Integrationstests (`pnpm test`), 0 Lint-Fehler / 24 kuratierte Thunderbird-False-Positive-Warnungen (`pnpm run lint:filtered`).
  - Repräsentativer Playwright/axe-UI-Testsuite (`tools/browser-ui.dev.cjs`) mit 528 Layout-Varianten über 8 Admin-Seiten und 6 Add-on-Seiten.
- **Reale Thunderbird-140-ESR-Linux-Abnahme (`THUNDERBIRD_LINUX_ABNAHME.md`):**
  - Python-Marionette-Runner (`tools/thunderbird-live.dev.py`) unter Xvfb auf Debian Trixie (Thunderbird 140.17.0 ESR).
  - Nachgewiesen: 13 Profiltests, 12 saubere Neustarts, 12 Prozess-Absturz-Wiederherstellungen (`SIGKILL`), dauerhafte Profil-Upgrades 1.22.0 → 1.23.0 ohne Zustandsverlust.
  - **Präzise Semantik:** `OPENED` bestätigt ausschließlich die von Thunderbird angenommene Öffnungsanforderung (kein Nachweis von OS-Browserstart oder Webseitenbesuch). `PENDING` bleibt nach einem Prozessabbruch währen des offenen Dialogs strikt `PENDING` und wird niemals als künstliche Nutzerentscheidung umgedeutet.
- **Offline Enterprise-Vertragskern & CLI-Suite (`enterprise/`):**
  - 30 spezifizierte und im Node.js-Umfeld lokal getestete Arbeitspakete (N01–N18, E01–F03, A01–A03): Signiertes lokales Speicher-Outbox-Journal, Job-Runner, Incident-Cases, Policy-Simulation, Heartbeats, SIEM-Queue-Export, Kapazitäts-Alarme, Health-Reporting.

### 1.2 Implementiert, aber unzureichend geprüft
- **Windows- & macOS-Plattformkompatibilität:** Der WebExtension-Code ist plattformunabhängig geschrieben, aber die reale GUI-Abnahme unter Thunderbird ESR wurde bislang ausschließlich unter Linux (Debian X11/Xvfb) automatisiert nachgewiesen.
- **Echte OS-Screenreader & Barrierefreiheit:** Semantisches HTML, ARIA-Rollen und Tastatur-Fokustraps sind über `axe-core` geprüft. Reale Tests mit OS-Screenreadern (NVDA, JAWS, VoiceOver) und Windows High-Contrast/DPI-Skalierungen stehen aus.
- **Standardbrowser-Handoffs:** Die Übergabe von HTTPS-URLs wurde bisher über ein synthetisches XDG-Desktop-Empfängerskript auf OS-Ebene verifiziert, nicht mit allen real installierten Standardbrowsern (Firefox, Chrome, Edge).

### 1.3 Teilweise umgesetzt
- **ATN-Store-Readiness & Submission-Gate:** Gate-Kriterien C1–C6 (`npm run store-gate`) sind vollständig PASS. Kriterium C7 meldet aktuell NO-GO, da nach dem Tag `v1.23.0` (Commit `df63c76`) unveröffentlichte Entwicklungsänderungen in `api.js`, `audit.js`, `background.js` und `sanitize.js` im Arbeitsbereich vorliegen.
- **Unternehmensprofile & Extension-Anbindung:** In den Add-on-Einstellungen (`options.html`) existieren sechssprachige Profil-Entwürfe als deaktivierte Vorlagen. Die im Verzeichnis `enterprise/` entwickelten Node.js-CLI-Werkzeuge sind offline funktionsfähig, jedoch bisher nicht als aktive Hintergrunddienste in die WebExtension-Laufzeit integriert.

### 1.4 Konzeptionell vorbereitet
- **Cloud-Storage-Adapter & SIEM-Exporte:** Adapterstrukturen für AWS S3, Azure Blob Storage und GCP Cloud Storage sowie SIEM-Offline-Exporte (N05) existieren als Node.js-Testdoubles (`enterprise/storage_jobs.cjs`), verfügen jedoch über keine produktiven Anbindungen.
- **Policy-State-Verteilung & Key-Rotation:** Schlüsselverwaltung und Richtlinien-Journal (N02/N10) sind als CLI-Prototypen vorhanden.

### 1.5 Offen oder durch konkrete Voraussetzungen blockiert (✋)
- **ATN-Store-Signierung & Veröffentlichung (A-03, A-04, A-05):** Blockiert durch fehlende ATN-API-Maintainer-Schlüssel.
- **Produktive N06-Enterprise-Bereitstellung (EN-01 bis EN-04):** Blockiert durch fehlende echte Cloud-Mandanten, Identity Provider (IdP) und produktive SEALED-Evidenzcommits.
- **Automatische Updateverteilung & Rollback-Test (A-20 / EN-05 / EN-06):** Blockiert durch den noch nicht aktivierten signierten ATN-Distributionskanal.

---

## 2. Dynamische Themenlandkarte

Aus den realen Befunden im Repository ergeben sich 6 primäre Themenbereiche mit spezifischen Entwicklungstypen (*Optimierung*, *Verbesserung*, *Erweiterung*):

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        THUNDY AV - THEMENLANDKARTE                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. Schutzwirkung, Analysequalität & Linkentscheidungen                          │
│    • Optimierung: Heuristik-Performance & Async-Timeout-Handling                 │
│    • Verbesserung: Transparente Darstellung von Score, Provider & Verdict       │
│    • Erweiterung: Lokale Reputations-Feinsteuerung & Whitelist-Regeln            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. Bedienung, Barrierefreiheit, Themes & i18n (UI/UX)                            │
│    • Verbesserung: Tastaturnavigation & ARIA-Live-Status bei Aktionen            │
│    • Verbesserung: Screenreader-Prüfung & OS High-Contrast / DPI                │
│    • Optimierung: Layout-Konsistenz in schmalen Sidebars & Popups                │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. Datenschutz, Audit, Datenlebenszyklus & Stabilität                           │
│    • Verbesserung: Strikte Abgrenzung von OPENED vs. PENDING bei Neustart        │
│    • Optimierung: IndexedDB Retention-Cleanup & Atomare Audit-Writes             │
│    • Erweiterung: Verschlüsselte/Signierte Audit-Journal-Exporte                │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 4. Plattformkompatibilität, OS-Integration, Updates & Rollback                 │
│    • Verbesserung: Windows & macOS reale Thunderbird ESR GUI-Abnahme             │
│    • Verbesserung: Standardbrowser-Handoff-Validierung (Firefox/Chrome/Edge)    │
│    • Erweiterung: Updateverteilungs- & Rollback-Verifikation via ATN             │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 5. Unternehmensadministration, Richtlinien & Offline-Services                  │
│    • Erweiterung: Bridge zwischen WebExtension-Runtime & Enterprise-Profilen    │
│    • Erweiterung: Produktive N06-Cloud/IdP/SEALED-Integrationen (✋)             │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 6. Qualitätssicherung, Testing, CI/CD & Store-Gate                             │
│    • Optimierung: Tag-Synchronisation (v1.23.1) zur Beseitigung von C7-Diff      │
│    • Optimierung: Idempotenter CI/CD Publish-Workflow & Multi-OS CI-Runner       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Verbindliche Produktanforderungen (Audit & Abgleich)

| Anforderung | Ist-Stand im Repository | Status |
|---|---|---|
| **Vollständige i18n (6 Sprachen)** | Kataloge in `_locales/{en,de,fr,es,it,pl}` vollständig gepflegt; Fallback-Generator (`check:i18n`) und Testsuite (`test/i18n.test.js`) sichern 100 % Abdeckung. | **Erfüllt** |
| **Einheitliches modernes Design** | Gemeinsames Designsystem (`design.css`, `design_components.css`, `theme.css`) über alle Add-on- und Admin-Ansichten hinweg. | **Erfüllt** |
| **Thunderbird-Themes & A11y** | Dynamische Theme-Anpassung (Hell/Dunkel), Akzentfarben, Informationsdichte und Tastaturbedienung in HTML/CSS verankert. | **Erfüllt** |
| **Optionale Externe Analyse & Enterprise** | Standardmäßig 100 % lokaler Betrieb. Externe API-Anfragen und Enterprise-Profile erfordern expliziten Nutzer-Opt-in. | **Erfüllt** |
| **Klare Unterscheidung der Modi** | Lokale Funktionen, Konfigurationsprofile und produktive Integrationen sind im UI und in der Doku explizit getrennt. | **Erfüllt** |
| **Transparente Entscheidungsdarstellung** | URL, lokale Score-Berechnung, Prüfstand und Nutzerentscheidungen werden im Audit-Log und Linkdialog lückenlos protokolliert. | **Erfüllt** |
| **`OPENED`-Semantik** | `OPENED` signalisiert ausschließlich, dass Thunderbird die Öffnungsanforderung angenommen hat; kein Nachweis von Browserstart/Webseitenbesuch. | **Erfüllt** |
| **`PENDING`-Semantik bei Prozessverlust** | Nach erzwungenem Absturz (`SIGKILL`) bleibt ein offener Vorgang strikt `PENDING`; keine Umdeutung in eine Nutzerentscheidung. | **Erfüllt** |
| **Daten- & Historien-Erhalt** | Upgrades (1.22.0 → 1.23.0) und Neustarts bewahren historische Audit-Datensätze und Konfigurationen unverändert. | **Erfüllt** |

---

## 4. Priorisierte Aufgabentabelle

In der folgenden Tabelle sind die erkannten Entwicklungspotenziale in konkrete, abgegrenzte Arbeitspakete gegliedert:

| ID | Themenbereich & Typ | Befund & Beleg | Gewünschtes Ergebnis & Nutzwert | Umfang | Prio | Aufwand | Blocker / Abhängigkeiten | Akzeptanzkriterien | Validierung & Testumgebung |
|---|---|---|---|---|---|---|---|---|---|
| **PAK-01** | **6. QS & Gate**<br>*(Optimierung)* | Submission-Gate meldet `FAIL C7`: Entwicklungsdateien (`api.js`, `audit.js`, `background.js`, `sanitize.js`) weichen vom Tag `v1.23.0` ab. | Synchronisierter Tag `v1.23.1` mit sauberem Gate-Ergebnis (`GO`, Exit 0). | Tagging & Release-Notizen für 1.23.1. | **Hoch** | S (2 h) | Keine | `npm run store-gate` liefert C1–C7 PASS. | Node.js Test-Runner & `submission-gate.js`. |
| **PAK-02** | **4. Plattform**<br>*(Verbesserung)* | Reale Thunderbird ESR GUI-Abnahme bisher nur unter Linux X11/Xvfb durchgeführt (`THUNDERBIRD_LINUX_ABNAHME.md`). | Verifizierte Lauffähigkeit von Popup, Linkdialog & Audit unter Windows 11 & macOS. | Erstellung von Testprotokollen & Screenshots auf Windows/macOS. | **Hoch** | M (8 h) | ✋ Windows/macOS Testumgebung | Fehlerfreie Interaktion und visuelle Nachweise auf Windows/macOS. | Manuelle/automatisierte TB ESR GUI-Tests auf Windows/macOS. |
| **PAK-03** | **2. UI/UX & A11y**<br>*(Verbesserung)* | Accessibility ist automatisiert via axe-core geprüft; reale Tests mit OS-Screenreadern fehlen. | Vollständige Screenreader-Bedienbarkeit (NVDA, VoiceOver) und ARIA-Live-Feedback. | Optimierung von ARIA-Labels, Live-Regions (`role="status"`) & Fokusringen. | **Hoch** | M (6 h) | ✋ Screenreader-Software (NVDA/VoiceOver) | Blinde Nutzer können Links, Warnungen & Audit barrierefrei bedienen. | Screenreader-Prüfung in TB 140 ESR. |
| **PAK-04** | **4. Plattform & Release**<br>*(Erweiterung)* | ATN-Signierung & automatische Updates/Rollbacks sind bisher ungestet (A-03, A-20). | Funktionierender automatischer Updatepfad mit Neustart- & Rollback-Schutz via ATN. | Signierung des XPIs, Test der `em:updateURL` & Rollback-Szenarien. | **Mittel** | M (6 h) | ✋ Maintainer ATN API-Keys | ATN signiert das Add-on; Updates werden in TB sauber angewendet. | ATN Staging/Live API & TB Add-on Manager. |
| **PAK-05** | **4. Plattform & OS**<br>*(Verbesserung)* | OS-Browserübergabe bisher nur mit XDG-Desktop-Empfänger isoliert getestet. | Nachgewiesene URL-Übergabe an reale Standardbrowser (Firefox, Chrome, Edge). | Validierung der Systembrowser-Aufrufe inkl. Fehlerbehandlung bei fehlenden Handlern. | **Mittel** | S (4 h) | Real installierte Browser | Links öffnen zuverlässig im System-Standardbrowser ohne Nachrichten-Navigation. | Thunderbird Live-Test mit verschiedenen Default-Browsern. |
| **PAK-06** | **5. Enterprise**<br>*(Erweiterung)* | Enterprise-CLI-Tools (`enterprise/`) sind nicht an die Extension-Laufzeit angebunden. | Optionale Synchronisation lokaler Audit-Events mit dem lokalen Enterprise-Outbox-Service. | Runtime-Bridge in `background.js` für lokalen Enterprise-Ingest. | **Mittel** | L (12 h) | Keine | Opt-in Ingest von Audit-Ereignissen in die lokale Outbox. | Enterprise Contract & Integration Tests (`pnpm test`). |
| **PAK-07** | **1. Schutzwirkung**<br>*(Optimierung)* | Lokale Heuristik-Prüfung in `risk.js` kann bei sehr langen Mail-Bodies verlangsamen. | O(1) Fast-Path Regex & String-Matching für Mail-Header und Domain-Lookups. | Refactoring der Keyword- & Regex-Evaluator in `risk.js`. | **Niedrig**| S (3 h) | Keine | 20 % schnellere Heuristik-Auswertung bei großen Nachrichten. | Benchmark-Tests (`benchmark_links_fast.js`). |
| **PAK-08** | **3. Stabilität**<br>*(Optimierung)* | Audit-Log-Ansicht (`audit.js`) fordert Daten bei Tab-Sichtbarkeit neu an; Optimierung des Renderns bei >1000 Einträgen. | Flüssiges Swiping & Paginierung im Audit-Log ohne UI-Lag. | Einführung von DOM-Fragment-Caching und reduzierten Re-Renders. | **Niedrig**| S (4 h) | Keine | UI bleibt auch bei maximal gefülltem Log (1000 Einträge) absolut flüssig. | Playwright & JSDOM UI-Tests. |
| **PAK-09** | **5. Enterprise N06**<br>*(Erweiterung)* | Cloud-Storage-Adapter (S3/Azure/GCP) laufen nur als Testdoubles (EN-01, EN-02). | Produktive S3/Azure/GCP Cloud-Job-Verarbeitung mit Retention-Lock. | Anbindung echter Cloud-SDKs & Authentifizierung. | **Später** | L (16 h) | ✋ Produktive Enterprise Cloud-Zugänge | Nachweisprüfer meldet Cloudteil PASS mit echten Mandanten. | Live Enterprise Storage Test-Runner. |
| **PAK-10** | **5. Enterprise N06**<br>*(Erweiterung)* | SEALED-Evidenzcommit und IdP/SSO-Rollen sind nicht live angebunden (EN-03, EN-04). | Fälschungssichere SEALED-Evidenzcommits & IdP-Rollenbindung. | Integration von Ed25519-SEALED-Commits mit zentralem IdP. | **Später** | L (16 h) | ✋ IdP & Key-Management-Infrastruktur | SEALED-Verifikation meldet PASS für Produktiv-Events. | Enterprise Evidence Test-Suite. |

---

## 5. Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   ROADMAP                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│ KURZFRISTIG (Runde 1 - Sofort umsetzbar)                                        │
│ ├─ PAK-01: Tag-Synchronisation & Release v1.23.1 (Behebung Store-Gate C7)     │
│ ├─ PAK-07: Heuristik-Fast-Path & Regex-Optimierung in risk.js                   │
│ └─ PAK-08: Audit-Log Performance- & Render-Optimierung                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│ MITTELFRISTIG (Runde 2 - Benötigt erweiterte Testumgebungen)                    │
│ ├─ PAK-02: Reale Windows 11 & macOS Thunderbird ESR GUI-Abnahme                 │
│ ├─ PAK-03: Barrierefreiheits-Abnahme mit OS-Screenreadern (NVDA/VoiceOver)       │
│ ├─ PAK-05: System-Standardbrowser Handoff-Test (Firefox, Chrome, Edge)          │
│ └─ PAK-06: WebExtension Runtime Bridge zu Enterprise Outbox Service           │
├─────────────────────────────────────────────────────────────────────────────────┤
│ SPÄTER / BLOCKIERT (Runde 3 - Benötigt Maintainer-Keys & Enterprise-Cloud)      │
│ ├─ PAK-04: ATN Signierung, Store-Listung & Auto-Update-Verifikation (✋)         │
│ ├─ PAK-09: Produktive Enterprise Cloud-Storage Adapter (S3/Azure/GCP) (✋)        │
│ └─ PAK-10: Produktives IdP/SSO & SEALED Evidenz-Commit (✋)                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Die drei nächsten Arbeitspakete (Empfehlung & Begründung)

### 1. PAK-01: Development-State Release-Tag Synchronisation (`v1.23.1`)
- **Begründung:** Derzeit scheitert das Submission-Gate (`npm run store-gate`) am Kriterium C7, weil neuere Code-Anpassungen im Arbeitsbereich seit `df63c76` vorliegen. Die Erstellung des Tags `v1.23.1` stellt den formalen Release-Zustand wieder her und bringt das automatisierte Gate auf **GO**.
- **Mittel:** Mit den vorhandenen lokalen Werkzeugen sofort ausführbar.

### 2. PAK-02: Reale Windows 11 & macOS Thunderbird ESR GUI-Abnahme
- **Begründung:** Die Multi-Plattform-Fähigkeit ist ein zentrales Versprechen der Add-on-Architektur. Während die Linux-Abnahme hervorragend dokumentiert ist, schließt eine strukturierte Abnahme auf Windows und macOS die verbleibende Plattform-Lücke.
- **Mittel:** Erfordert Windows/macOS-Testgeräte mit Thunderbird ESR.

### 3. PAK-03: Tastatur- & Screenreader-Barrierefreiheitsprüfung (WCAG 2.1 AA)
- **Begründung:** Barrierefreiheit ist eine verbindliche Produktanforderung. Die Überprüfung mit echten OS-Screenreadern (NVDA/VoiceOver) stellt sicher, dass blinde und sehbehinderte Nutzer Risikowarnungen und Linkentscheidungen im E-Mail-Worklow sicher wahrnehmen und steuern können.
- **Mittel:** Erfordert Testumgebung mit installierten Screenreadern.

---

## 7. Abschließende Empfehlungen & Abgrenzung

1. **Sofort mit vorhandenen Mitteln ausführbar:**
   - Erstellung des Tags `v1.23.1` und Ausführung von `npm run store-gate` zur Sicherstellung von 100 % PASS über alle Kriterien C1–C7.
   - Code-Optimierungen der Heuristik-Auswertung (`risk.js`) und Audit-Log-Render-Performance.
   - Laufzeit-Bridge für den lokalen Enterprise-Outbox-Ingest.

2. **Benötigen konkrete externe Voraussetzungen (✋):**
   - **ATN-Signierung & Veröffentlichung:** Benötigt die Maintainer-API-Schlüssel für `addons.thunderbird.net`.
   - **Windows-/macOS- & Screenreader-Abnahme:** Benötigt entsprechende Betriebssystem-Testumgebungen.
   - **Enterprise N06-Produktivbetrieb:** Benötigt reale Mandanten-Zugänge für Cloud-Storage (S3/Azure/GCP) und Identity Provider (IdP/SSO).
