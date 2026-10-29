# Thundy AV — Produktarchitektur, Bestandsaufnahme und Priorisierter Aufgabenplan

**Rolle:** Technischer Produktarchitekt & Thunderbird-Extension-Entwickler
**Projekt:** Thundy AV (Email Scanner & Link Protection for Thunderbird, MV3)
**Datum:** 16. Oktober 2026
**Analysierter Stand:** Release-Tag `v1.23.0` / Quellcode-Stand post-`v1.23.0` (`1.23.0` mit React-/Vite-Entwicklungsdemonstrator)

---

## 1. Kompakte Bestandsaufnahme

Die Bestandsaufnahme basiert auf der direkten Prüfung von Manifest, Hintergrund-Scripte, WebExtensions-APIs, UI-Komponenten, Test-Suiten (`npm test`), Lintern (`web-ext lint`), CI/CD-Pipelines sowie Store-Gate-Skripten (`scripts/submission-gate.js`).

### Implementation & Nachweis-Matrix

| Status-Kategorie | Merkmale & Nachweise im Repository | Betroffene Bausteine / Dateien |
|---|---|---|
| **Implementiert & Nachgewiesen** | Automatisierte Tests passig (953 Tests grün), Store-Gate C1–C6 erfüllt, Linux Thunderbird ESR 140 Live-Tests erfolgreich. | - Lokaler Heuristik- & Score-Core (`risk.js`, `scan_policy.js`) <br>- Linkschutz-Interzeption mit Dialog & Native Opening (`background.js`, `sanitize.js`) <br>- Audit-Protokollierung mit TTL/Bytes (`audit.js`, `db.js`) <br>- Sechssprachigkeit (EN/DE/FR/ES/IT/PL in `_locales/` & `i18n.js`) <br>- Native Light/Dark Themes & Dichte (`theme.js`, `options.js`) <br>- Opt-in Wizard & Konsent-Steuerung (`onboarding.js`, `api.js`) <br>- Enterprise Offline-Vertragskern & CLI-Tools (`enterprise/`) |
| **Implementiert, aber unzureichend geprüft** | Funktionalität im Code vorhanden, jedoch ausschließlich unter Linux Xvfb oder simulated Browser-Mocks geprüft. | - Reale Windows- & macOS-Systemintegration (OS-Browserübergabe) <br>- Reale Screenreader-Interaktion (NVDA, JAWS, VoiceOver) <br>- Reale Updateverteilung & Auto-Rollback über ATN <br>- Echte Flottenmessung unter Last |
| **Teilweise umgesetzt** | Kernlogik im Extension-Code integriert, React/Vite-Demonstrator vorbereitet, aber nicht als primäres WebExtension-Bundle verdrahtet. | - React/Vite Modern UI Refactoring (`src/App.tsx`, `src/components/`) <br>- Enterprise Outbox & SIEM-Export-Queues (deaktiviert ohne Server) <br>- Cloud Storage Adapter (S3/Azure/GCP SDK Stubs & Simulatoren) |
| **Konzeptionell vorbereitet** | Detaillierte Konzepte und Spezifikationen vorhanden, Verträge und CLI-Stubs angelegt, aber keine produktive Anbindung. | - Enterprise N06 Cloud- & SEALED-Evidenzcommits (`docs/AUFGABENPLAN_ENTERPRISE_N06.md`) <br>- SSO/RBAC OAuth2/OIDC Anbindung <br>- Zentrale Policy-Server-Synchronisation |
| **Offen / Blockiert durch Voraussetzungen** | Externe Abhängigkeiten oder physische Maintainer-Zugänge erforderlich. | - ATN Store-Signierung & Veröffentlichung (benötigt Maintainer-API-Keys) <br>- Physische Testgeräte für Windows 11 & macOS Sequoia <br>- Live Cloud-Tenant Zugänge für S3/Azure/GCP |

---

## 2. Dynamische Themenlandkarte

Die Potenziale von Thundy AV wurden dynamisch anhand der Befunde in 6 primäre Themenbereiche mit untergeordneten Entwicklungstypen (*Optimierung*, *Verbesserung*, *Erweiterung*) gegliedert:

```
├── A. Schutzwirkung, Linkentscheidungen & Audit
│   ├── [Optimierung] O1: O(1) Set-Lookup für Bekannte Domain-Allow/Blocklists in risk.js
│   ├── [Verbesserung] V1: PENDING-Prozessverlust-Erkennung im Audit-Journal
│   └── [Erweiterung] E1: Heuristische Zero-Day Phishing-Muster für Mail-Header
├── B. UI, UX, Barrierefreiheit & Themes
│   ├── [Optimierung] O2: Performance-Härtung der React-UI Components (DOM-Virtualisierung)
│   ├── [Verbesserung] V2: WCAG 2.1 AA Screenreader-Abnahme (Aria-Live & Focus Traps)
│   └── [Erweiterung] E2: Konsolidierung der HTML/CSS UI-Seiten auf Vite/React-Build
├── C. Mehrsprachigkeit & Lokalisierung
│   ├── [Optimierung] O3: Performance der i18n-Fallback-Auflösung ohne DOM-Re-parsing
│   └── [Verbesserung] V3: Vollständigkeit der Sprachkataloge (EN, DE, FR, ES, IT, PL) sichern
├── D. enterprise, Policy & Cloud-Integration
│   ├── [Optimierung] O4: Outbox-Deduplizierung & Exponential Backoff in SIEM-Queue
│   ├── [Verbesserung] V4: Klare Trennung zwischen lokalen Profilen und produktiven Endpunkten
│   └── [Erweiterung] E3: SEALED-Evidenzcommit für geschützte Audit-Ablagen
├── E. Architektur, Qualitätssicherung & CI/CD
│   ├── [Optimierung] O5: Release-Prozess Idempotenz & Submission-Gate C7 Automatisierung
│   └── [Verbesserung] V5: Entkopplung von Build-Artefakten und Quelldateien im Verifikations-Gate
└── F. Plattform-Kompatibilität & Distribution
    ├── [Verbesserung] V6: Cross-Platform OS Browser-Opening Verifikation (Windows/macOS)
    └── [Erweiterung] E4: ATN Store-Submission & Automatische Update-Prüfung
```

---

## 3. Priorisierte Aufgabentabelle

### Priorisierungskriterien
Die Priorisierung erfolgt evidenzbasiert nach:
- **Nutzen:** Auswirkung auf Schutzwirkung und Bedienerfreundlichkeit.
- **Zuverlässigkeit:** Vermeidung von Datenverlust oder falschen Sicherheitsaussagen.
- **Reichweite & Aufwand:** Verhältnis von Entwicklungszeit zu Effekt.
- **Evidenz & Blocker:** Vorhandensein lokaler Testbarkeit vs. externe Voraussetzungen.

### Aufgabentabelle

| ID | Bereich & Typ | Befund / Beleg | Gewünschtes Ergebnis & Nutzwert | Umfang | Prio | Aufwand | Abhängigkeiten / Blocker | Akzeptanzkriterien | Testumgebung |
|---|---|---|---|---|---|---|---|---|---|
| **PKG-01** | E. Arch (Opt) | `scripts/submission-gate.js` meldet FAIL C7 nach Dev-Anpassungen an `api.js`, `audit.js`, `background.js`, `sanitize.js`. | Submission Gate meldet GO (C1–C7 PASS) durch konsistenten Tag/Release-Release-Build-Prozess. | Build- & Release-Skripte anpassen (`scripts/submission-gate.js`, `package.json`). | **HOCH (P1)** | Klein (S) | Keine (lokal ausführbar) | `pnpm run store-gate` schließt mit Exit 0 (GO) ab. | Node.js Testsuite |
| **PKG-02** | A. Audit (Verb) | Bei Prozessabbrüchen (z. B. Thunderbird-Crash) verblieb die Interaktion im Status `PENDING`. | `PENDING` wird bei Neustart explizit als unvollständiger Prozess gekennzeichnet und niemals als Nutzerentscheidung umgedeutet. | `audit.js`, `db.js` Recovery-Handler ergänzen. | **HOCH (P1)** | Mittel (M) | Keine | Beim Extension-Start werden alte `PENDING`-Interaktionen als `ABORTED` markiert; Re-Evaluation bleibt möglich. | Unit-Tests (`test/audit.test.js`) & Thunderbird Linux ESR |
| **PKG-03** | B. UI (Verb) | Screenreader-Ablauf auf `audit.html`, `options.html` und Link-Interzeptionsdialog noch nicht auf physischem NVDA/VoiceOver verifiziert. | Barrierefreie Bedienung nach WCAG 2.1 AA (Tastaturfokus, `aria-live`, `role="status"`). | ARIA-Attribute & Focus Traps in `link_audit.js`, `audit.html`, `options.html` prüfen. | **HOCH (P1)** | Mittel (M) | Screenreader-Testumgebung (Windows NVDA / macOS VoiceOver) ✋ | Tastaturnavigation schließt Dialoge nicht versehentlich; Screenreader liest Risikowarnungen korrekt vor. | Windows / macOS Testgeräte |
| **PKG-04** | F. Plat (Verb) | OS Browser-Handover (`OPENED`) unter Windows 11 und macOS Sequoia bisher nur auf Linux Xvfb verifiziert. | Nachgewiesene, fehlertolerante Übergabe an System-Standardbrowser auf Windows & macOS. | `background.js` Browser-Handover Error-Handling prüfen. | **MITTEL (P2)** | Mittel (M) | Windows 11 / macOS Sequoia Testumgebung ✋ | Links öffnen im Standardbrowser; `OPENED` bestätigt Übergabe an OS, nicht Webseitenbesuch. | Windows / macOS Thunderbird |
| **PKG-05** | B. UI (Erw) | Dualität zwischen statischem JS/HTML (`options.html`) und neuem React/Vite Demonstrator (`src/`). | Konsolidierung der UI-Komponenten auf ein einheitliches Designsystem mit Vite-Bundling. | UI-Seiten schrittweise auf React/TSX migrieren oder Design-System entkoppeln. | **MITTEL (P2)** | Groß (L) | PKG-01 | Einheitliche Theme-Styles, barrierefreie React-Komponenten, lückenloser i18n Support. | Vite Preview / Browser-Tests |
| **PKG-06** | D. Ent (Erw) | Enterprise N06 Cloud Storage & SEALED Commit sind als Node Stubs vorbereitet (`enterprise/`). | Produktiver SEALED-Evidenzcommit und Cloud-Storage Anbindung für Enterprise-Audits. | Anbindung an S3/Azure Blob Storage und KMS/Ed25519 Signatur. | **NIEDRIG (P3)** | Sehr Groß (XL) | Betreiber-Zugänge, IdP & Cloud Tenants ✋ | N06 Compliance-Check-Tool meldet PASS. | Enterprise Test-Environment |

---

## 4. Roadmap

```
                                  ROADMAP THUNDY AV
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Kurzfristig (Sofort ausführbar / Lokale Umgebung)                                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. PKG-01: Submission-Gate C7 Sync & Release-Build Idempotenz herstellen             │
│ 2. PKG-02: PENDING Status-Recovery nach Prozessverlust härten                          │
│ 3. I18n & Accessibility Audit auf bestehenden HTML-Seiten abschließen                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Mittelfristig (Benötigt physische Testgeräte / OS-Umgebungen ✋)                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. PKG-03: WCAG 2.1 AA Barrierefreiheits-Abnahme mit Screenreadern (NVDA/VoiceOver)     │
│ 5. PKG-04: Cross-Platform OS Browser-Handover Tests (Windows 11 / macOS Sequoia)       │
│ 6. PKG-05: Konsolidierung des React/Vite Designsystems für Extension-Popups          │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Später (Benötigt Maintainer-Keys & Enterprise-Infrastruktur ✋)                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 7. ATN Store-Einreichung, Signierung & Automatische Update-Verteilung                  │
│ 8. PKG-06: Enterprise N06 Cloud Storage & SEALED Evidenz-Commits                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Die drei nächsten Arbeitspakete (Empfehlung)

1. **PKG-01: Herbeiführen des Store-Gate GO (C7 Sync & Version-Bump)**
   - *Begründung:* Die automatische Gate-Prüfung `node scripts/submission-gate.js` scheitert aktuell an Kriterium C7, da Quelldateien seit dem letzten `v1.23.0`-Tag verändert wurden. Dies ist die zwingende Voraussetzung für jede Veröffentlichung.
   - *Ausführbarkeit:* Sofort mit vorhandenen Mitteln im Repository ausführbar.

2. **PKG-02: Erweiterte Wiederherstellungslogik für unbeendete Interaktionen (`PENDING`)**
   - *Begründung:* Verbindliche Anforderung: `PENDING` darf nach einem Prozessverlust (z. B. Thunderbird-Absturz während der Entscheidung) niemals als abgeschlossene Nutzerentscheidung umgedeutet werden.
   - *Ausführbarkeit:* Vollständig über Unittests und Linux-Thunderbird-Tests abdeckbar.

3. **PKG-03: Barrierefreiheits- & Fokus-Audit der Interzeptions-Dialoge**
   - *Begründung:* Gewährleistung der Barrierefreiheit und Vermeidung versehentlicher Klicks/Aktionen durch unklare Fokusführung beim Öffnen von Sicherheitsdialogen.
   - *Ausführbarkeit:* Code-Anpassungen lokal ausführbar; physische Testung erfordert Screenreader-Setup.

---

## 6. Empfehlungen & Externe Blockaden

### Sofort umsetzbar (Lokale Mittel)
- Ausführen aller Unittests (`pnpm test`) und Linters (`pnpm run lint:filtered`).
- Pflege der Dokumentation und Synchronisation der Versionen in `package.json` und `manifest.json`.
- Härtung der Heuristiken in `risk.js` und `sanitize.js`.

### Externe Blockaden (Benötigen Voraussetzungen ✋)
1. **ATN Store Submission (A-03 / A-04):** Benötigt private Maintainer-Schlüssel zur AMO/ATN Signierung.
2. **Windows 11 & macOS Sequoia OS-Handover (A-16 / A-17):** Benötigt physische Testgeräte mit den jeweiligen Betriebssystemen.
3. **Screenreader-Verifikation (A-18):** Benötigt Testumgebungen mit installierten NVDA/JAWS/VoiceOver Screenreadern.
4. **Enterprise Cloud Integrations (EN-01 bis EN-04):** Benötigt echte Cloud-Tenants (AWS S3, Azure Blob, GCP) sowie IdP-Zugänge.
