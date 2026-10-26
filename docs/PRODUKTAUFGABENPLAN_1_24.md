# Produktaufgabenplan & Architektur-Roadmap — Thundy AV (Stand: Oktober 2026)

---

## 1. Kompakte Bestandsaufnahme

### 1.1 Quellcode & Architektur
Thundy AV ist eine moderne Mail-Sicherheits-Extension für Thunderbird 140+ ESR auf Basis von WebExtensions Manifest V3.
- **Kernkomponenten:**
  - `background.js` / `api_gateway.js` / `providers.js`: Asynchrone Analyse-Pipeline, Caching, Opt-in-Einwilligung und Rate-Limiting für externe Reputationsdienste (Hybrid Analysis, VirusTotal, URLScan, URLhaus, AbuseIPDB).
  - `risk.js` / `scan_policy.js` / `sanitize.js`: Lokale Risikoauswertung (SPF/DKIM/DMARC-Heuristik, Phishing-Signale, Punycode-Analyse), HTML-Sanitizing und Attachment-Disarming.
  - `link_audit.js` / `db.js`: Lokales Audit-Journal für Link-Entscheidungen, SQLite/IndexedDB-Persistenz und Aufbewahrung.
  - `enterprise/`: Vollständiges, signiertes Enterprise-Framework (Node.js/CJS) für Policy-Simulation, Heartbeats, Outbox, SIEM-Exporte und Storage-Jobs.
  - `message_ui.js` / `options.js` / `audit.js` / `enterprise_setup.js`: Benutzeroberflächen mit Barrierefreiheit, Tastaturbedienung und Designsystem.

### 1.2 Implementierungs- & Nachweisstand
| Kategorie | Status | Beschreibung & Evidenz |
|---|---|---|
| **Implementiert & Nachgewiesen** | **Ja** | 953/953 automatisierte Tests grün (`pnpm test`), Gate C1–C6 PASS (`scripts/submission-gate.js`), 6-sprachige Lokalisierung (EN/DE/FR/ES/IT/PL in `_locales/`), MV3-Konformität, barrierefreie UI-Navigation, reale Linux ESR-140 Abnahme unter Xvfb (`docs/live_test_1_23_0.md`). |
| **Implementiert, aber unzureichend geprüft** | **Teilweise** | Multi-Plattform (Windows 11 / macOS) Abnahme (`docs/THUNDERBIRD_LINUX_ABNAHME.md`), reale Screenreader-Aktivität (NVDA/JAWS/VoiceOver; automatisierte Playwright/axe-Checks sind grün, aber manuelle auditiver Check fehlt), direkte OS-Browserübergabe an Default-Browser (z.B. Edge/Chrome unter Win/macOS). |
| **Teilweise umgesetzt** | **Teilweise** | Enterprise-Lokalbetrieb & SIEM-Exportqueue (Node.js-Module lauffähig und getestet, aber keine aktive Anbindung an zentrale Cloud-Endpoints oder SSO/IdP-Infrastruktur im Produktivnetz). |
| **Konzeptionell vorbereitet** | **Ja** | Enterprise-Pakete N01–N18 in `docs/AUFGABENPLAN_ENTERPRISE_N06.md`, automatisierte Updateverteilung und Rollback-Szenarien (`docs/support_faq.md`). |
| **Offen / Blockiert** | **Blockiert ✋** | ATN-Store-Einreichung und AMO-Signierung (`npx web-ext sign`) blockiert durch fehlende Maintainer-API-Schlüssel (`docs/STATUS.md`). Submission-Gate meldet derzeit **NO-GO** für C7 (v1.23.0 Tag-Gleichheit, da nach Tag-Setzung Quellcodeanpassungen stattfanden; Release v1.24.0 erforderlich). |

---

## 2. Dynamische Themenlandkarte

Die nachfolgenden Befunde sind dynamisch nach Themenbereich und Entwicklungstyp (*Optimierung*, *Verbesserung*, *Erweiterung*) geordnet:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THUNDY AV THEMENLANDKARTE                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
  ├── [SEC] Schutzwirkung & Analysequalität
  │     ├── (Optimierung) Reduzierung von False-Positives bei internen Umlenkungen
  │     └── (Erweiterung)  Heuristische Domain-Aging & WHOIS-Risikoauswertung (lokal)
  ├── [AUD] Linkentscheidungen, Score & Audit
  │     ├── (Verbesserung) Explizite Statusanzeige bei PENDING/OPENED nach Prozessabbruch
  │     └── (Optimierung)  Hochperformante Audit-Suchindizes bei >10.000 Einträgen
  ├── [UX]  Bedienung, Informationsdarstellung & Barrierefreiheit
  │     ├── (Verbesserung) Tastatur-Fokusfalle & ARIA-Live-Feedback bei Dialogabbruch
  │     └── (Verbesserung) Screenreader-Audiofeedback für Sehbehinderte unter Windows/macOS
  ├── [I18N] Mehrsprachigkeit & Themes
  │     ├── (Verbesserung) Vervollständigung dynamischer Fallback-Strings in allen 6 Sprachen
  │     └── (Optimierung)  Automatische Anpassung der Kontrastdichte bei System-Darkmode
  ├── [ENT] Unternehmensadministration & Enterprise-Integration
  │     ├── (Erweiterung)  Live-Sync von Enterprise-Policy-Journalen
  │     └── (Optimierung)  SIEM Export-Queue Dead-Letter-Recovery
  └── [REL] Relese-Gate, Installation, Updates & Veröffentlichung
        ├── (Optimierung)  Kriterium C7 Release-Match automatisieren für v1.24.0 Release
        └── (Erweiterung)  Windows & macOS Live-Abnahme-Protokollierung
```

---

## 3. Verbindliche Produktanforderungen (Soll-Bestimmungen)

1. **Sprachen:** Vollständige Unterstützung von EN, DE, FR, ES, IT, PL in allen UI-Komponenten, Benachrichtigungen und Audit-Exporten.
2. **Design & Themes:** Einheitliches Designsystem (`design.css`, `theme.css`), Unterstützung von Hell-/Dunkelmodus, Informationsdichte-Anpassung und voller Tastatur-Zugänglichkeit (WCAG 2.1 AA).
3. **Enterprise-Integration:** Externe Analysen und Enterprise-Anbindungen bleiben strikt optional und opt-in. Lokale Funktionen und Enterprise-Profile sind klar getrennt.
4. **Semantik von OPENED & PENDING:**
   - `OPENED`: Zeigt nur an, dass Thunderbird den Übergabebefehl angenommen hat. Es bestätigt **keinen** erfolgten Webseitenbesuch oder Browserstart.
   - `PENDING`: Darf nach einem Prozessabbruch oder Absturz niemals fälschlicherweise als abgeschlossene Nutzerentscheidung oder "Erlaubt" umgedeutet werden.
5. **Datenintegrität:** Historische Entscheidungsprotokolle und Audit-Logs müssen bei Updates und Re-Evaluationen unverfälscht erhalten bleiben.

---

## 4. Priorisierte Aufgabentabelle

Prioritäten werden anhand von Nutzen, Auswirkung auf Schutzwirkung, Häufigkeit, Aufwand/Risiko, Abhängigkeiten und Evidenz bestimmt:
- **P0 (Kritisch / Blocker):** Veröffentlichungs- / Store-Gate-Blocker oder Sicherheits- / Datenintegritätsrisiko.
- **P1 (Hoch):** Wesentliche UX-, Schutz- oder Plattform-Verbesserung.
- **P2 (Mittel):** Wartbarkeit, Enterprise-Erweiterungen, Performance-Optimierung.
- **P3 (Niedrig / Später):** Optionale Erweiterungen und Plattform-Spezifika mit externer Abhängigkeit.

| ID | Themenbereich | Typ | Befund / Beleg | Nutzwert / Ziel | Prio | Aufwand | Abhängigkeiten / Blocker |
|---|---|---|---|---|---|---|---|
| **PKG-01** | [REL] Release | Optimierung | Gate C7 meldet NO-GO, da `api.js` etc. nach v1.23.0 Tag geändert wurden (`scripts/submission-gate.js`). | Konsistenter Release v1.24.0 mit PASS auf allen C1–C7 Kriterien. | **P0** | S (1–2h) | Keine |
| **PKG-02** | [AUD] Audit | Verbesserung | Bei Prozessabbruch während `PENDING` fehlt im Audit-UI ein visueller Hinweis auf den abgebrochenen Status (`link_audit.js`). | Eindeutige Kennzeichnung abgebrochener Prüfungen; verhindert Fehlinterpretation. | **P0** | S (2–4h) | PKG-01 |
| **PKG-03** | [UX] Barrierefreiheit | Verbesserung | Screenreader-Verifikation fehlt für Windows (NVDA) und macOS (VoiceOver) (`docs/THUNDERBIRD_LINUX_ABNAHME.md`). | Nachweis der vollständigen Barrierefreiheit (WCAG 2.1 AA) auf allen OS. | **P1** | M (1–2 Tage) | ✋ Reale Win/macOS-Testgeräte |
| **PKG-04** | [REL] Plattform | Verbesserung | Echte Standardbrowser-Übergabe (Time-of-Click) unter Windows 11 / macOS unzureichend dokumentiert. | Reale Verifikation der URL-Übergabe an Systembrowser ohne Message-Context-Loss. | **P1** | M (1 Tag) | ✋ Reale Win/macOS-Testgeräte |
| **PKG-05** | [REL] Store | Erweiterung | Signierung und ATN-Store-Einreichung offen (`docs/STATUS.md`). | Veröffentlichung im offiziellen Thunderbird Add-ons Directory. | **P1** | S (2h) | ✋ Maintainer-AMO-Key |
| **PKG-06** | [SEC] Schutz | Optimierung | Reputations-Cache und Heuristik-Bewertung bei sehr langen HTML-Nachrichten speicherintensiv (`risk.js`). | Reduzierung des Memory-Footprints bei Groß-E-Mails (>10 MB) um ~30%. | **P2** | M (2–3 Tage) | Keine |
| **PKG-07** | [I18N] Sprachabdeckung| Verbesserung | Einzelne dynamische System-Statusmeldungen nutzen in Randfällen englische Fallbacks (`i18n.js`). | 100% lückenlose Muttersprachlichkeit in DE, FR, ES, IT, PL. | **P2** | S (1 Tag) | Keine |
| **PKG-08** | [ENT] Enterprise | Erweiterung | SIEM Exportqueue benötigt automatisches Retry-Backoff bei Netzwerkunterbrechung (`enterprise/outbox.cjs`). | Garantiert verlustfreie Übertragung von Enterprise-Sicherheitsereignissen. | **P2** | M (2 Tage) | Keine |
| **PKG-09** | [UX] Themes | Optimierung | Hohe Informationsdichte in der Audit-Tabelle auf 13"-Bildschirmen etwas gedrängt (`design.css`). | Optimierte Layout-Adaptivität und responsive Tabellenskalierung. | **P2** | S (1 Tag) | Keine |
| **PKG-10** | [REL] Updates | Erweiterung | Automatische Updateverteilung und Rollback-Szenarios unter Realbedingungen ungetestet. | Zuverlässiges Verhalten bei XPI-Updates ohne Datenverlust im Profil. | **P3** | M (2 Tage) | ✋ ATN Release |
| **PKG-11** | [ENT] Enterprise | Erweiterung | Local Storage Adapter Backup & Pruning Job Automation (`enterprise/storage_jobs.cjs`). | Automatische Bereinigung alter Log-Daten nach Einhaltung der DSGVO-Retention-Period. | **P3** | M (2 Tage) | Keine |
| **PKG-12** | [SEC] Schutz | Erweiterung | Unterstützung lokaler YARA-ähnlicher Header-Muster im Scan-Policy-Engine (`scan_policy.js`). | Erweiterte Indikator-Erkennung für Enterprise-Sicherheitsanalysten. | **P3** | L (3–5 Tage) | PKG-08 |

---

## 5. Detaillierte Ausarbeitung der Top-3-Arbeitspakete

### PKG-01: Release v1.24.0 & Submission-Gate Konsolidierung
- **ID & Typ:** `PKG-01` | **Typ:** Optimierung (Release-Hygiene)
- **Befund:** `node scripts/submission-gate.js` schlägt fehl bei Kriterium C7 (Mismatch zwischen Release-Tag v1.23.0 und geänderten Quellcodedateien `api.js`, `audit.js`, `background.js`, `sanitize.js`).
- **Ergebnis & Nutzwert:** Sauberes Release `v1.24.0` mit 100% grünen Gate-Kriterien C1–C7. Unabdingbar für Store-Submission.
- **Umfang:** Anpassen der Versionsnummer in `manifest.json` und `package.json` auf `1.24.0`, Erstellen der Release-Dokumentation `docs/releases/1.24.0.md` und Ausführen von `node scripts/submission-gate.js`.
- **Priorität & Aufwand:** **P0** | **Aufwand:** S (~1–2 Stunden)
- **Abhängigkeiten:** Keine.
- **Akzeptanzkriterien:** `node scripts/submission-gate.js` liefert Exit-Code 0 (`Result: GO`). All 953 Tests passing.
- **Validierung:** Ausführen von `pnpm test && node scripts/submission-gate.js`.

### PKG-02: PENDING & OPENED Status-Transparenz bei Prozessabbruch
- **ID & Typ:** `PKG-02` | **Typ:** Verbesserung (Datensicherheit & UX)
- **Befund:** Wenn Thunderbird während eines ausstehenden Link-Scans abgebrochen wird, bleibt der Status im Audit-Log unklar oder könnte fälschlicherweise als erfolgreich geöffnet gewertet werden.
- **Ergebnis & Nutzwert:** Eindeutiges Kennzeichnen von `PENDING`-Aktionen als `ABORTED_OR_EXPIRED` nach Anwendungsneustart. Absolute Korrektheit der Audit-Historie.
- **Umfang:** Anpassung in `link_audit.js` und `background.js`: Beim Start von Thundy AV werden unvollständige `PENDING`-Einträge der vorherigen Sitzung automatisch als unterbrochen markiert.
- **Priorität & Aufwand:** **P0** | **Aufwand:** S (~2–4 Stunden)
- **Abhängigkeiten:** PKG-01.
- **Akzeptanzkriterien:** Ein unterbrochener Link-Scan wird nach Neustart im Audit-Log explizit als "Unterbrochen / Nicht bestätigt" angezeigt. Kein automatisches Umwandeln in "Erlaubt".
- **Validierung:** Unit-Test in `test/audit.test.js` für Session-Abbruch-Recovery.

### PKG-03: Barrierefreiheits- & Screenreader-Abnahme (Windows/macOS)
- **ID & Typ:** `PKG-03` | **Typ:** Verbesserung (Accessibility)
- **Befund:** Zwar sind alle ARIA-Attribute (`role="status"`, `aria-describedby`, Fokus-Fallen) im Code integriert und per Playwright/axe getestet, die reale auditive Nutzbarkeit unter NVDA (Windows) und VoiceOver (macOS) ist jedoch noch nicht formell dokumentiert.
- **Ergebnis & Nutzwert:** Vollständige Barrierefreiheit für sehbehinderte Thunderbird-Nutzer auf allen unterstützen Betriebssystemen.
- **Umfang:** Durchführung manueller Screenreader-Tests auf Windows 11 (NVDA) und macOS (VoiceOver) für den Einrichtungswizard, den Linkschutz-Dialog und die Audit-Ansicht. Dokumentation im Prüfprotokoll.
- **Priorität & Aufwand:** **P1** | **Aufwand:** M (~1–2 Tage)
- **Abhängigkeiten:** ✋ Benötigt reale Windows/macOS Testumgebungen.
- **Akzeptanzkriterien:** Alle Dialoge, Warnungen und Risiko-Scores werden von NVDA und VoiceOver verständlich vorgelesen. Tastatur-Fokus wird in Modals korrekt gefangen und freigegeben.
- **Validierung:** Dokumentiertes Prüfprotokoll in `docs/UI_SCREENREADER_ABNAHME.md`.

---

## 6. Roadmap

```
  KURZFRISTIG (Meilenstein 1: Release & Gate-Cleanliness)
  ├── PKG-01: Release v1.24.0 Vorbereitung & Gate-Konsolidierung (C1-C7 GO)
  └── PKG-02: PENDING/OPENED Semantik-Absicherung bei Prozessabbruch

  MITTELFRISTIG (Meilenstein 2: Multi-Plattform & Store-Publishing)
  ├── PKG-05: ATN-Signierung & Store-Submission (sobald AMO-Keys vorliegen) ✋
  ├── PKG-03: Screenreader-Abnahme unter Windows (NVDA) & macOS (VoiceOver) ✋
  ├── PKG-04: Reale OS-Standardbrowser-Übergabe auf Win11/macOS verifizieren ✋
  ├── PKG-06: Speicher- & Performance-Optimierung für Groß-E-Mails
  └── PKG-07: Lückenlose Muttersprachlichkeit (DE/EN/FR/ES/IT/PL) verifizieren

  SPÄTER (Meilenstein 3: Enterprise & Advanced Security)
  ├── PKG-08: SIEM Export-Queue Recovery & Resilience
  ├── PKG-09: Responsive UI & Theme-Density Feinschliff
  ├── PKG-10: Automatische Update- & Rollback-Verifikation
  ├── PKG-11: DS-GVO Log-Retention & Pruning Automation
  └── PKG-12: Erweiterte Header-Pattern Scan Engine
```

---

## 7. Handlungsempfehlungen & Resümee

1. **Sofort mit vorhandenen Mitteln ausführbar:**
   - **PKG-01 & PKG-02** können ohne externe Abhängigkeiten sofort im vorliegenden Sandbox-Environment umgesetzt und getestet werden. Damit wird die Codebase zu 100% store-ready und das Submission-Gate auf `GO` gesetzt.

2. **Mit konkreten externen Voraussetzungen blockiert / ausstehend:**
   - **PKG-03 & PKG-04 (Windows/macOS Abnahme):** Benötigen physikalische oder virtuelle Testsysteme mit Windows 11 / macOS und installierten Screenreadern (NVDA/VoiceOver).
   - **PKG-05 (ATN Store Release):** Benötigt die API-Zugangsschlüssel des Maintainers für addons.thunderbird.net (`AMO_JWT_ISSUER`, `AMO_JWT_SECRET`).
