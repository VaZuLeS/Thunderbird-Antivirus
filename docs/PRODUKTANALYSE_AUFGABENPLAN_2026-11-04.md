# Thundy AV — Produktanalyse und priorisierter Aufgabenplan (Stand: 4. November 2026)

**Rolle:** Technischer Produktarchitekt und erfahrener Thunderbird-Extension-Entwickler
**Projekt:** Thundy AV — E-Mail-Anhang- und Link-Scanner für Mozilla Thunderbird (WebExtension, MV3)
**Bezug:** Stand nach Merge PR #741 (Commit `b7dadd71`), Vorbereitung Version 1.24.5
**Datum:** 04. November 2026
**Status:** Verbindliche architektonische Bestandsaufnahme und evidenzbasierter Entwicklungsplan

---

## 1. Tatsächlicher Stand (Evidenzbasierte Bestandsaufnahme)

### 1.1 Quellenstand, Arbeitsbaum und Veröffentlichungsebenen

Zur Vermeidung von Fehlannahmen wird strikt zwischen Arbeitsbaum, lokalem Git-Stand, CI-Läufen, Release-Tags und tatsächlich veröffentlichten Binärpaketen unterschieden:

| Ebene | Tatsächlicher Zustand | Beleg / Evidenz / Prüfgrenze |
| :--- | :--- | :--- |
| **Commit / HEAD** | `b7dadd71bd53a7ee956226cc7f56de95bfbf6471` (Merge PR #741) | `git log -n 1 --pretty=fuller`; Arbeitsbaum ist sauber (`git status`). |
| **Branch** | `jules-10917209575449674190-cf691228` | Lokaler Entwicklungszweig. |
| **Deklarierte Version** | `1.24.5` | Identisch in `package.json` und `manifest.json`. |
| **Git-Tag** | `v1.24.5` zeigt direkt auf `b7dadd71` | `git show v1.24.5`. |
| **Veröffentlichter Stand** | GitHub-Release **1.24.4** ist das letzte vorliegende Release; Vorbereitung **1.24.5** dokumentiert in `docs/VEROEFFENTLICHUNG_1_24_5.md` | `docs/releases/1.24.4.md`, `docs/VEROEFFENTLICHUNG_1_24_5.md`. Ein Git-Tag oder eine Dokumentationsdatei ist noch kein Nachweis eines aktiven GitHub-Releases oder einer ATN-Listung. |
| **Paket-Fingerprint** | SHA-256: `283ad4dd941b31058dee8762ccd3ed945527e323b57f7b9552e593bd9d249035`, Source-Fingerprint: `14a665e6...` | Deterministischer Paketbau über `node scripts/build-and-verify-package.js` (47 Dateien, 999.471 Bytes entpackt). |
| **Automatisierte Tests** | **1.076 bestanden, 0 fehlgeschlagen** (73 Testsuiten) | `pnpm test` (über Node.js v22 Test-Runner). Hinweis: Erfordert das Nichtvorhandensein von `pnpm-lock.yaml`, da `test/manifest.test.js` das Vorhandensein von Lockfiles streng prüft. |
| **Linter** | **0 Fehler, 27 bekannte Thunderbird-Warnungen** | `pnpm run lint:filtered` via `scripts/lint-with-filter.js` (alle 27 Warnungen sind kuratierte MailExtension-False-Positives wie `messagesRead`, `messages.getAttachmentFile` etc.). |
| **Store-Readiness-Gate** | C1 (Pre-submit), C3 (Linter), C5 (Screenshots) und C7 (Release-Match) PASS. C2 (npm test) PASS nach Bereinigung. C4 (Build-Ordner) und C6 (Live-Testprotokoll 1.24.5) FAIL im reinen Quellcheckout. | Ausführung von `node scripts/submission-gate.js` liefert NO-GO, da `./build` nicht vorliegt und `docs/audits/candidate-1_24_5.json` nicht als Datei existiert (existiert als `docs/audits/report-controls-2026-11-04.json`). |
| **GitHub Pages** | Jekyll-Quellen unter `docs/` mit `docs/_config.yml` | `pnpm run check:docs` bestätigt 54 Dateien und 318 Links ohne Fehler. |

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
| **Präzise Semantik (OPENED / PENDING)** | **N** | `link_audit.js`, Zeilen 55–120: `OPENED` bestätigt ausschließlich die von Thunderbird angenommene Öffnungsanforderung via `windows.openDefaultBrowser`. Kein Webseitenbesuch oder OS-Browserstart wird behauptet. `PENDING` verbleibt nach einem Prozessabbruch (`SIGKILL`) im Audit-Log strikt auf `PENDING` und wird nach Neustart niemals als künstliche Nutzerentscheidung umgedeutet (`test/audit.test.js`, `docs/audits/thunderbird-crash-recovery.json`). |
| **Datenschutz & Einwilligungsmodell** | **N** | Dreistufiges Datenschutzmodell (`strict`, `balanced`, `max`) in `options.js` und `scan_policy.js`. Explizite Opt-in-Berechtigungen für `personalCommunications` und `sensitiveDataUpload`. Keine Übertragung ohne Nutzerkonsens. |
| **Mehrsprachigkeit (6 Sprachen)** | **N** | Vollständige Schlüsselabdeckung in EN, DE, FR, ES, IT, PL in `_locales/*/messages.json`. `scripts/generate-i18n-fallback.js --check` und `test/i18n.test.js` verifizieren Parität und Formatierungsplatzhalter. Dynamischer Fallback auf Englisch (`i18n.js`). |
| **Theming & Designsystem** | **N** | Vereinheitlichtes Designsystem (`theme.js`, `theme.css`, `design_system.js`, `design.css`). Automatische Erkennung nativer Thunderbird-Paletten (Hell/Dunkel), Akzentfarben und Dichte-Einstellungen (`compact`, `touch`, `normal`). WCAG-Kontraste und tastaturbedienbare Komponenten nachgewiesen. |
| **Gespeicherte Berichte & Multi-Provider-Karten** | **N** | Neu in 1.24.5 (`b7dadd71`): Robuste Darstellung gespeicherter Hybrid-Analysis-Protokolle mit abweichenden Feldern in `api.js`. Einheitliche Statuskarten für 5 Dienste (Hybrid Analysis, VirusTotal, URLhaus, AbuseIPDB, urlscan.io) in `analysis_status.js`. Getrennte, ressourcengebundene DOM-Aktionen für Re-Scan und HTML-Entschärfung (`BERICHTSAKTIONEN_1_24_5.md`). |
| **Deterministischer Paketbau** | **N** | `scripts/build-and-verify-package.js` und `scripts/reproducible-package.py` kanonisieren Dateiattribute (Rechte, Zeitstempel 1980-01-01, feste Sortierung, DEFLATE-9), wodurch identische SHA-256-Prüfsummen unter Linux/Python 3.12 und zlib erzeugt werden. |
| **Offline-Enterprise-Vertragskern** | **N** | 30 Module in `enterprise/` (u. a. `contracts.cjs`, `ledger.cjs`, `outbox.cjs`, `storage_jobs.cjs`, `policy_simulation.cjs`). Vollständig lokal durch automatisierte Unit-Tests abgedeckt (`enterprise/test/*.test.js`). |
| **Standardbrowser-Handoff (OS-Desktop)** | **U** | `windows.openDefaultBrowser` funktioniert im Testrunner und unter Debian XDG/Xvfb. Eine Abnahme mit real installierten Anwenderbrowsern (Firefox, Chrome, Edge) auf Standard-Desktops steht aus. |
| **Barrierefreiheit & Assistenzsysteme** | **U** | Synthetische Barrierefreiheitsprüfung via `@axe-core/playwright` (`tools/browser-ui.dev.cjs`) verifiziert ARIA-Rollen und Farbkontraste. Echte Screenreader-Tests mit NVDA, JAWS, VoiceOver oder Orca auf realen Desktops fehlen. |
| **Unicode-/MIME-Eingangsverarbeitung** | **U** | Strukturierte Multipart-UTF-8/QP-Nachrichten wurden in `UNICODE_NACHRICHTENEINGANG.md` gezielt getestet. Komplexe S/MIME-, PGP- oder fehlerhaft deklarierte Zeichensätze sind noch unzureichend empirisch geprüft. |
| **Lokale Heuristik-Schutzwirkung** | **U** | `risk.js` berechnet lokale Scores anhand von Schlüsselwörtern, Absender-Mismatch und Linkzielen (`testdata/risk-behavior.json`). Ein statistisch belastbarer Benchmark gegen aktuelle Phishing-/Malware-Feeds und False-Positive-Analysen existiert nicht. |
| **Permanente Vorkommensidentität (AVN-009)** | **T** | Header-basierte Entkopplung isoliert Nachrichten bei identischer Message-ID im Speicher (`QUELLENHISTORIE_ZUORDNUNG.md`), aber permanente Vorkommensbindung über Ordner-Verschiebungen, IMAP-Kompaktierung und Archivierung hinweg ist offen (`docs/IDENTITAET_ANALYSEBEFUNDE.md`). |
| **Externe Live-Provider-Validierung** | **T** | HTTP-Adapter und Gateways sind in `providers.js` und `api_gateway.js` implementiert. CI und Unit-Tests laufen ausschließlich mit synthetischen Mocks; keine echten Live-Quoten-, Rate-Limit- oder Failover-Tests unter Last. |
| **Schutzprofile & Import-Vorschau (AVN-010)** | **K** | Profilstrukturen in `enterprise_profiles.js` angelegt; UI-Import mit verbindlicher Differenzvorschau vor Übernahme ist konzeptionell vorbereitet, aber noch nicht in `options.html` integriert. |
| **Enterprise Cloud-Storage & SIEM-Export** | **K** | Adapter für S3, Azure Blob, GCP in `enterprise/storage_jobs.cjs` und SIEM-Queues in `enterprise/outbox.cjs` sind als Testdoubles implementiert, aber ohne produktive Cloud-Anbindung. |
| **ATN-Store-Signierung & Distribution** | **B / ✋** | Einreichung und Signierung bei addons.thunderbird.net (ATN) ist blockiert durch fehlende Maintainer-API-Schlüssel (AMO/ATN credentials). |
| **Automatische Update-Verteilung & Rollback** | **B / ✋** | Automatische Updatekanäle und echtes Client-Rollback können erst über einen aktiven Store- oder Distributionsserver verifiziert werden. |
| **Native Windows- & macOS-Verifikation** | **B / ✋** | Reale Testläufe unter Windows (Win32/MSIX) und macOS (Apple Silicon/Intel) erfordern dedizierte OS-Runner mit grafischem Subsystem. |
| **Produktive Enterprise-Mandanten (N06)** | **B / ✋** | Produktiver Betrieb von `enterprise/local.cjs` erfordert reale Unternehmens-IdPs, KMS und Cloud-Speicher. |

---

## 2. Dynamische Themenlandkarte

Die Themenbereiche wurden anhand der aktuellen Quellcodebefunde, Modulgrenzen und Risikoprofile strukturiert:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              THUNDY AV - THEMENLANDKARTE                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ A. Schutzwirkung, Analysequalität & Linkentscheidungen                                 │
│    ├── Lokale Heuristik & Inhaltsentschärfung (risk.js, sanitize.js)                   │
│    ├── Time-of-Click & Klickinterzeption (link_audit.js, background.js)                │
│    └── Externe Analyseprovider & Live-Verträge (providers.js, api_gateway.js)         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ B. Datenlebenszyklus, Speicher & Identität                                             │
│    ├── Flüchtiger Speicher & Eviction (background.js, ExpiringMap)                     │
│    ├── Permanenter Speicher & Retention (db.js, IndexedDB)                             │
│    └── Dauerhafte Nachrichten- und Ressourcenidentität (AVN-009)                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ C. Bedienung, Barrierefreiheit & Designsystem                                          │
│    ├── Einheitliches Theming & Kontraste (theme.js, design.css, design_system.js)      │
│    ├── Multi-Provider-Karten & Berichtsschaltflächen (analysis_status.js, api.js)      │
│    ├── Barrierefreiheit & Screenreader-Kompatibilität (WCAG, ARIA, Focus-Traps)        │
│    └── Mehrsprachigkeit & Lokalisierungsqualität (6 Sprachen, i18n.js)                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ D. Einrichtung, Richtlinien & Enterprise-Verwaltung                                    │
│    ├── Datenschutz-Stufen & Opt-in-Flows (options.js, onboarding.js)                   │
│    ├── Schutzprofile mit Vorschaupflicht (enterprise_profiles.js, AVN-010)             │
│    └── Offline Enterprise-Vertragskern & SIEM/Storage (enterprise/)                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ E. Architektur, Wartbarkeit & Tooling                                                  │
│    ├── Modulverträge & Entkopplung (background.js / api.js Schnittstellen)             │
│    ├── Linter- und Dependency-Sicherheit (scripts/lint-with-filter.js, npm audit)      │
│    └── Deterministische Build-Pipeline (scripts/build-and-verify-package.js)           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ F. Plattformkompatibilität, Distribution & Rollback                                    │
│    ├── OS-Kompatibilität (Linux X11/Wayland, Windows, macOS)                           │
│    ├── ATN-Store-Readiness & Signierung (scripts/submission-gate.js)                   │
│    └── Automatische Updateverteilung & Notfall-Rollback                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Priorisierte Aufgabentabelle

Die Einordnung erfolgt nach den Entwicklungstypen:
- **Optimierung:** Bestehende Funktionen effizienter, robuster oder wartbarer machen.
- **Verbesserung:** Vorhandene Funktionen verständlicher, zugänglicher oder vollständiger gestalten.
- **Erweiterung:** Zusätzliche Fähigkeiten mit erkennbarem Nutzwert ergänzen.

| ID | Primärer Bereich / Schlagworte | Typ | Befund / Evidenz | Nutzwert / Ziel | Priorität | Aufwand | Abhängigkeiten / Blocker |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **AVN-009** | B: Speicher & Identität | Optimierung | Numerische Thunderbird-IDs und Header-IDs sind nach Ordner-Verschieben, IMAP-Kompaktierung oder Archivierung nicht stabil (`IDENTITAET_ANALYSEBEFUNDE.md`). | Robuste, datenbewahrende Bindung von Prüfständen und Audit-Logs an tatsächlichen Nachrichteninhalt (Hash-basierte Vorkommensidentität). | **P1** | M (Untersuchung) / L (Umsetzung) | Keine; lokal entwickelbar. Basis für Migration. |
| **AVN-008b**| E: Architektur & Tooling | Optimierung | `npm audit` meldet 9 transitive Sicherheitsbefunde in Dev-Dependencies (web-ext / addons-linter). `check:vendor` erfordert strikte Pins. | Bereinigte, audit-konforme Entwicklungsumgebung ohne inkompatible Downgrades oder Broken-Build-Risiken. | **P1** | S | Keine; rein lokale Tooling-Bereinigung. |
| **AVN-018** | C: Barrierefreiheit / Doku | Verbesserung | Audit-Logs und Berichtsstatus enthalten vereinzelt unübersetzte technische Rohwerte (z. B. `cancelReason`, `quota`). C6 Gate-Prüfung referenziert historisches Dateinamensschema. | Lückenlose 6-sprachige Benutzerführung bei Abbruch- und Quota-Ereignissen; Aktualisierung des Gate-Prüfpfads für 1.24.5. | **P1** | S | Keine; direkt umsetzbar in `_locales/*/messages.json` und `submission-gate.js`. |
| **AVN-010** | D: Einrichtung & Richtlinien| Erweiterung | Schutzprofile existieren als Mock-Strukturen in `enterprise_profiles.js`, fehlen aber als konfigurierbare Profile im Optionen-UI. | Importierbare Schutzprofile für Administratoren mit zwingender Differenzvorschau vor Aktivierung. | **P2** | M | Baut auf `enterprise_profiles.js` und `options.js` auf. |
| **AVN-005** | A: Schutzwirkung & Analyse | Optimierung | Heuristischer Score in `risk.js` basiert auf statischen Pattern. Es fehlt ein standardisierter Benchmark gegen reale Test-Sets. | Validierte Erkennungsrate gegen Phishing-/Malware-Beispieldaten mit messbarer False-Positive-Quote. | **P2** | M | Lokale Testkorpora vorhanden (`testdata/`); Ausbau erforderlich. |
| **AVN-013** | E: Architektur & Tooling | Optimierung | `background.js` vereint Klick-Interzeption, Tab-Management, Provider-Kommunikation und Caches in einer monolithischen Datei (>1.200 Zeilen). | Saubere Modulgrenzen und getrennte Controller für Tab-Events, Analyse-Dispatching und Cache-Retention. | **P2** | M | Erfordert umfassende Regressionstests (`background.test.js`). |
| **AVN-004** | A: Schutzwirkung & Analyse | Verbesserung | Provider-Integrationen (VirusTotal, urlscan, Hybrid Analysis) wurden nur synthetisch verifiziert. | Echte Live-Vertragstests mit Quoten-Management, Fehlerkaskaden und Timeout-Absicherung. | **P2** | M | **✋ Blocker:** Produktive API-Schlüssel für externe Dienste erforderlich. |
| **AVN-006** | F: Plattform & Zugänglichkeit| Verbesserung | Reale Thunderbird-Abnahme bisher nur unter Linux X11/Xvfb nachgewiesen. Windows, macOS und Screenreader fehlen. | Nachgewiesene Lauffähigkeit unter Windows 11, macOS Sequoia und mit Screenreadern (NVDA, VoiceOver). | **P2** | L | **✋ Blocker:** Physische/virtuelle Windows- und macOS-Testumgebungen erforderlich. |
| **AVN-015** | F: Release & Distribution | Erweiterung | Bisher nur manuelle XPI-Installation oder GitHub-Releases getestet; kein automatischer Update- und Rollback-Mechanismus. | Belastbarer Nachweis von Auto-Updates via ATN und kontrollierter Downgrade-Szenarien ohne Datenverlust. | **P3** | M | **✋ Blocker:** ATN-Freigabe und gehostetes Update-Manifest erforderlich. |
| **AVN-012** | D: Enterprise-Bereitstellung| Erweiterung | Enterprise-Module in `enterprise/` sind offline und CLI-gebunden. Ein produktiver Integrationspilot fehlt. | Anbindung an ein Pilot-SIEM über signierten JSON-Export oder Webhook-Bridge. | **P3** | L | **✋ Blocker:** Unternehmens-Infrastruktur / SIEM-Endpunkt erforderlich. |

---

## 4. Detaillierte Ausarbeitung der Arbeitspakete

### AVN-009: Dauerhafte Vorkommensidentität und sichere Retention
- **Themenbereich:** Datenlebenszyklus, Speicher & Identität (B)
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** In `IDENTITAET_ANALYSEBEFUNDE.md` und `link_audit.js` zeigt sich, dass Thunderbird-interne Nachrichten-IDs (`message.id`) flüchtig sind. Beim Verschieben in andere Ordner, Archivieren oder IMAP-Kompaktieren vergibt Thunderbird neue IDs. Bisherige Prüfstände und Audit-Einträge verlieren ihre Bindung oder referenzieren falsche Nachrichten.
- **Ziel & Nutzwert:** Etablierung eines zweistufigen Identitätsvertrags: Schnelle lokale Bindung via flüchtiger Header-ID plus robuster kryptografischer Inhaltsidentifikator (gehashter Normalisierungs-Payload aus Absender, Datum, Message-ID und Part-Hashes). Verhindert Datenverlust und Falschzuordnungen im Dauerbetrieb.
- **Abgegrenzter Umfang:** Definition und Implementierung des Identitätsgenerators; Isolation bestehender Audit-Snapshots; Vorbereitung einer datenbewahrenden Migration in `db.js`. Keine automatische Löschung historischer Einträge.
- **Priorität & Aufwand:** Priorität **P1**, Aufwand **M** (Untersuchungskonzept) bis **L** (Umsetzung).
- **Abhängigkeiten / Blocker:** Keine externen Abhängigkeiten; rein lokal im Repository umsetzbar.
- **Akzeptanzkriterien:**
  1. Eine verschobene oder archivierte Nachricht behält ihren dokumentierten Prüfstand und ihr Audit-Protokoll.
  2. Zwei Mails mit identischer `Message-ID` (z. B. Mailinglisten-Kopien) erhalten getrennte Vorkommensidentitäten.
  3. Migration bestehender IndexedDB-Datenbanken erfolgt verlustfrei ohne Schema-Reset.
- **Validierung:** Erweiterung von `test/audit.test.js` und `db.test.js`; Hinzufügen von IMAP-Ordnerwechsel-Simulationen.

### AVN-008b: Bereinigung der Entwicklungsabhängigkeiten und Tooling-Härtung
- **Themenbereich:** Architektur, Wartbarkeit & Tooling (E)
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** `package.json` und `pnpm audit` weisen transitive Sicherheitsbefunde in Test-/Linter-Werkzeugen auf. Ein unbedachtes `npm audit fix` führt zu inkompatiblen Downgrades von `web-ext` oder Konflikten mit Vite 8 (`PRODUKTANALYSE_AUFGABENPLAN_2026-11-02.md`).
- **Ziel & Nutzwert:** Gezielte Auflösung der bekannten Advisories durch präzise Versionsanpassungen oder isolierte Linter-Subpakete, ohne die MailExtension-Kompatibilität zu gefährden.
- **Abgegrenzter Umfang:** Aktualisierung der `devDependencies` in `package.json`; Verifikation von `scripts/lint-with-filter.js` und `scripts/verify-package.js`. Keine Änderung am produktiven Add-on-Code.
- **Priorität & Aufwand:** Priorität **P1**, Aufwand **S**.
- **Abhängigkeiten / Blocker:** Keine; rein lokal ausführbar.
- **Akzeptanzkriterien:**
  1. `pnpm audit --omit=dev` bleibt bei 0 Schwachstellen.
  2. `pnpm run lint:filtered` läuft weiterhin fehlerfrei mit 0 Fehlern durch.
  3. `pnpm run check:source` und `pnpm test` bestehen vollständig.
- **Validierung:** Lokale Ausführung aller Prüfskripte und Abgleich der generierten Paketbytes.

### AVN-018: Vollständigkeit der Lokalisierung & Submission-Gate-Aktualisierung
- **Themenbereich:** Bedienung, Barrierefreiheit & Designsystem (C) / Architektur (E)
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** In `audit.js` und `api.js` werden technische Schlüssel (z. B. `cancelReason`, interne Fehlertypen) teilweise direkt im UI ausgegeben. `scripts/submission-gate.js` sucht für Kriterium C6 nach `docs/audits/candidate-1_24_5.json`, während das aktuelle Protokoll unter `docs/audits/report-controls-2026-11-04.json` liegt.
- **Ziel & Nutzwert:** Vollständig lokalisierte Benutzerführung in allen 6 Sprachen ohne technische Rohstrings; konsistentes Submission-Gate, das Release-Artefakte für 1.24.5 zuverlässig prüft.
- **Abgegrenzter Umfang:** Ergänzung fehlender Übersetzungs-Strings in `_locales/*/messages.json`; Anpassung des Pfadresolvers in `scripts/candidate-evidence.js` bzw. `submission-gate.js`.
- **Priorität & Aufwand:** Priorität **P1**, Aufwand **S**.
- **Abhängigkeiten / Blocker:** Keine; sofort lokal umsetzbar.
- **Akzeptanzkriterien:**
  1. Keine technischen Rohbegriffe im Audit-Log und in den Dienstkarten.
  2. `node scripts/submission-gate.js --candidate` erkennt die vorhandene Evidenz korrekt an.
  3. `pnpm run check:i18n` besteht mit Exit-Code 0.
- **Validierung:** `test/i18n.test.js`, `scripts/submission-gate.test.js`.

### AVN-010: Lokale Schutzprofile mit verpflichtender Differenzvorschau
- **Themenbereich:** Einrichtung, Richtlinien & Enterprise-Verwaltung (D)
- **Entwicklungstyp:** Erweiterung
- **Befund mit Beleg:** Administratoren benötigen vorgefertigte Richtlinienprofile (z. B. `High-Security`, `Balanced`, `Minimal`). In `enterprise_profiles.js` existieren Profil-Schemas, es fehlt jedoch eine UI-Integration in `options.html` mit Vorschau auf geänderte Schutzstufen vor dem Speichern.
- **Ziel & Nutzwert:** Ermöglicht Administratoren und versierten Anwendern das Laden geprüfter Profilkonfigurationen mit transparenter Diff-Vorschau zur Vermeidung von Fehlkonfigurationen.
- **Abgegrenzter Umfang:** UI-Komponente in `options.html`/`options.js`; Diff-Berechnung gegen aktuelle `browser.storage.local`-Werte; Modal-Dialog zur Bestätigung.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Keine; lokale Erweiterung.
- **Akzeptanzkriterien:**
  1. Profilwechsel verändert keine Einstellungen ohne explizite Bestätigung im Diff-Dialog.
  2. Bestehende benutzerdefinierte Ausnahmelisten werden beim Profilimport nicht stillschweigend gelöscht.
  3. Vollständige Übersetzung in EN, DE, FR, ES, IT, PL.
- **Validierung:** Erweiterung von `options.test.js` und visuelle Prüfung via `tools/browser-ui.dev.cjs`.

### AVN-005: Unabhängiges Benchmarking der heuristischen Schutzqualität
- **Themenbereich:** Schutzwirkung, Analysequalität & Linkentscheidungen (A)
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** Die Schutzbewertung in `risk.js` basiert auf statischen Heuristiken. Aktuelle Tests (`testdata/risk-behavior.json`) prüfen nur synthetische Regelfälle. Es fehlt ein standardisiertes Bewertungsverfahren mit realitätsnahen Phishing- und Gutartig-Datensätzen.
- **Ziel & Nutzwert:** Messbare Aussagen über Erkennungsgenauigkeit (Precision/Recall) und False-Positive-Raten zur fundierten Weiterentwicklung der Heuristik.
- **Abgegrenzter Umfang:** Erstellung eines Test-Harness-Skripts (`tools/risk-benchmark.dev.js`); Erweiterung der Testdaten um kuratierte, anonymisierte E-Mail-Muster.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Keine; Datenbasis lokal erweiterbar.
- **Akzeptanzkriterien:**
  1. Reproduzierbarer Benchmark-Report mit Falsch-Positiv- und Falsch-Negativ-Raten.
  2. Keine Verschlechterung der bestehenden Regressionsergebnisse in `api.test.js`.
- **Validierung:** `node tools/risk-benchmark.dev.js`.

### AVN-006: Plattformübergreifende Abnahme (Windows / macOS / Screenreader)
- **Themenbereich:** Plattformkompatibilität, Distribution & Rollback (F)
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** Vollständige Thunderbird-Live-Tests wurden bisher ausschließlich unter Linux mit Xvfb durchgeführt (`THUNDERBIRD_LINUX_ABNAHME.md`). Windows- (Win32/MSIX) und macOS-spezifische Pfade, DPI-Skalierungen und Screenreader (NVDA, VoiceOver) sind ungetestet.
- **Ziel & Nutzwert:** Zertifizierte Barrierefreiheit und Stabilität auf den Hauptzielplattformen der Thunderbird-Anwender.
- **Abgegrenzter Umfang:** Bereitstellung von Testskripten für Windows und macOS; Durchführung standardisierter Tastatur- und Screenreader-Szenarien.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **L**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Zugriff auf reale Windows- und macOS-Maschinen mit installierten Thunderbird- und Screenreader-Umgebungen erforderlich.
- **Akzeptanzkriterien:**
  1. Dokumentierte fehlerfreie Klick- und Dialogabläufe unter Windows 11 und macOS Sequoia.
  2. Bestätigte Vorlesegenauigkeit aller Warnhinweise und Statusmeldungen in NVDA und VoiceOver.
- **Validierung:** Erstellung von `docs/audits/windows-abnahme.json` und `docs/audits/macos-abnahme.json`.

---

## 5. Roadmap

### Phase 1: Unmittelbare Robustheit & Release-Vorbereitung (Kurzfristig / Sofort ausführbar)
*Fokus: Reine Repository-Arbeiten ohne externe Infrastrukturblocker.*
1. **AVN-018:** Lokalisierung technischer Rohstrings vervollständigen und Submission-Gate-Kriterien für v1.24.5 synchronisieren.
2. **AVN-008b:** Bereinigung transitiver Entwicklungsabhängigkeiten zur Stabilisierung der CI.
3. **AVN-009 (Teil 1 - Untersuchung):** Formalisierung des Inhalts- und Vorkommensidentitätsvertrags zur Verhinderung von Datenverlust bei Ordnerwechseln.

### Phase 2: Funktionale Reife & Qualitäts-Benchmarking (Mittelfristig / Größtenteils lokal)
*Fokus: UX-Erweiterungen und Absicherung der Erkennungsqualität.*
1. **AVN-010:** Bereitstellung importierbarer Schutzprofile mit verpflichtender Diff-Vorschau in den Einstellungen.
2. **AVN-005:** Heuristik-Benchmarking gegen erweiterte synthetische Phishing-/Benign-Korpora.
3. **AVN-013:** Modulare Entflechtung von `background.js` in fokussierte Service-Module (Event-Router, Storage-Manager, Scanner-Bridge).
4. **AVN-009 (Teil 2 - Umsetzung):** Implementierung der Hash-basierten Identitätsmigration in IndexedDB.

### Phase 3: Externe Validierung & Enterprise-Piloten (Später / Benötigt konkrete Zugänge)
*Fokus: Aufgaben, die dedizierte externe Infrastrukturen und Maintainer-Zugänge erfordern (✋).*
1. **AVN-004:** Live-Validierung externer Provider mit echten Kontingenten und API-Keys.
2. **AVN-006:** Reale Plattform- und Screenreader-Abnahme unter Windows 11 und macOS.
3. **AVN-015:** ATN-Store-Signierung, automatisierte Update-Distribution und Rollback-Verifikation.
4. **AVN-012:** Pilotierung des Enterprise-Kerns mit realem SIEM-Export und Identitätsverwaltung.

---

## 6. Die drei sinnvollsten nächsten Arbeitspakete mit Begründung

1. **AVN-018 — Lokalisierungs-Vollständigkeit & Submission-Gate-Synchronisation (Priorität P1, Aufwand S)**
   *Begründung:* Dies ist die unmittelbarste Maßnahme zur Herstellung eines sauberen Release-Zustands für Version 1.24.5. Die Beseitigung unübersetzter technischer Rohstrings gewährleistet die geforderte lückenlose 6-Sprachigkeit für Endanwender. Gleichzeitig stellt die Anpassung der Gate-Pfade sicher, dass automatisierte Prüfungen reproduzierbar auf dem aktuellen Commit aufsetzen.

2. **AVN-009 (Teil 1) — Untersuchungsphase zur dauerhaften Vorkommensidentität (Priorität P1, Aufwand M)**
   *Begründung:* Die flüchtigen Thunderbird-Nachrichten-IDs stellen im langfristigen Produktbetrieb das größte Integritätsrisiko für den Audit- und Schutzdatenbestand dar. Da eine fehlerhafte Migration zu Datenverlust führen könnte, muss zunächst die Spezifikation des Hash-basierten Identitätsmodells erfolgen. Dies schützt bestehende Daten vor zukünftigen Strukturänderungen.

3. **AVN-008b — Bereinigung der Entwicklungs-Toolchain (Priorität P1, Aufwand S)**
   *Begründung:* Eine saubere Dependency-Basis schützt die Build-Pipeline vor unerwarteten Linter- und Vite-Konflikten. Das Beheben der gemeldeten Dev-Advisories ohne inkompatible Downgrades sichert die langfristige Wartbarkeit und Reproduzierbarkeit der Builds.

---

## 7. Zusammenfassende Handlungsempfehlung

- **Sofort mit vorhandenen Mitteln ausführbar:**
  - Vervollständigung der Lokalisierungsdateien (`_locales/`) und Bereinigung technischer Meldungen.
  - Spezifikation und Prototyping der Inhalts-Identität (AVN-009) im lokalen Test-Harness.
  - Implementierung der Schutzprofil-Vorschau in den Einstellungen (AVN-010).
  - Code-Modularisierung und Entflechtung komplexer Hintergrundskripte (AVN-013).
  - Pflege und Erweiterung des lokalen Heuristik-Testkorpus (AVN-005).

- **Erfordert konkrete zusätzliche Voraussetzungen (Blockiert ✋):**
  - **ATN-Veröffentlichung:** Maintainer-API-Tokens für Mozilla Add-ons (AMO/ATN).
  - **Windows-/macOS-Freigabe:** Dedizierte Windows- und macOS-Testsysteme mit installierten Browsern und aktiven Screenreadern.
  - **Live-Provider-Abnahme:** Echte Konten und API-Keys bei VirusTotal, Hybrid Analysis etc.
  - **Enterprise-Produktivbetrieb:** Echte Unternehmens-Cloudmandanten (AWS/Azure) und SIEM-Zielsysteme.
