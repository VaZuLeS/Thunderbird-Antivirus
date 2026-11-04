# Thundy AV — Technischer Produktarchitektur- und Aufgabenplan

**Stand:** November 2026
**Rolle:** Technischer Produktarchitekt und erfahrener Thunderbird-Extension-Entwickler
**Geltungsbereich:** Evidenzbasierte Analyse des Repositorys, Statusunterscheidung, dynamische Themenstruktur, priorisierte Arbeitspakete (AVN-001 bis AVN-016), Roadmap und Handlungsleitfaden.

---

## 1. Tatsächlicher Produktstand und Evidenzregister

### 1.1 Veröffentlichter Stand vs. vorbereitete Entwicklung

| Ebene | Tatsächlicher Stand | Beleg / Evidenz / Grenze |
| :--- | :--- | :--- |
| **GitHub-Release** | **v1.24.3** (veröffentlicht am 02.11.2026 um 10:36:15 UTC). Unsigniertes GitHub-XPI mit Prüfsumme. | `git tag -l` enthält `v1.24.3`. Assets und Metadaten über GitHub-API dokumentiert in `docs/audits/candidate-1_24_3.json`. Keine ATN-Signierung (Add-on Developer Hub). |
| **Entwicklungsstand** | **1.24.4** (unveröffentlicht). Ergänzt transparente Quellenanzeige, Ressourcenisolation und Inhaltsverfügbarkeit. | `manifest.json`, `package.json`, `docs/AKTUELLER_PRODUKTSTAND.md`, `docs/FORTSCHRITT_AVN_001_002_009.md`, `docs/PRUEFUMFANG_NACHRICHTENINHALT.md`. |
| **GitHub Pages** | Verweist auf Version 1.24.3. Jekyll-Build aus `docs/`. | `.github/workflows/pages.yml`, `docs/index.html`, Sprachdateien `index_*.html`. |
| **Store-Gate (C1–C7)** | C1–C3 PASS, C4 FAIL (Paket nicht gebaut), C5 PASS (41 Screenshots), C6/C7 FAIL (noch kein v1.24.4-Release). | Ausführung von `node scripts/submission-gate.js`. Belegt, dass 1.24.4 ein Entwicklungsstand ist. |

---

### 1.2 Architekturkomponenten und Umsetzungsgrad

Zur präzisen Bewertung wird die verbindliche Statusklassifikation verwendet:
- **[N]** = Implementiert und im genannten Umfang nachgewiesen
- **[U]** = Implementiert, aber unzureichend geprüft
- **[T]** = Teilweise umgesetzt
- **[K]** = Konzeptionell vorbereitet
- **[B]** = Offen bzw. durch konkrete Voraussetzungen blockiert

| Komponente / Fähigkeit | Status | Befund und Code-Belege |
| :--- | :---: | :--- |
| **Thunderbird MailExtension** | **[N]** / **[U]** | MV3 WebExtension (`manifest.json`), Mindestversion Thunderbird 140.0 ESR. Hintergrundskripte (`background.js`), `message_display_action`, HTML-Seiten (`options.html`, `audit.html`, `onboarding.html`, `popup.html`). **[N]** für Linux (140.12.0 ESR & 153.6.0 ESR via Marionette-Harness in `tools/thunderbird-live.dev.py`). **[U]** für Windows und macOS (keine CI-Testumgebungen vorhanden). |
| **Lokale Schutzfunktionen & Heuristik** | **[N]** / **[U]** | `risk.js::calculateThreatScore`, `sanitize.js::disarmHTML`, `background.js::localContentCoverage`. Heuristische Erkennung von Dringlichkeit/Rechnungsbetrug, SPF/DKIM-Statusauswertung aus vertrauenswürdigen Headern. **[N]** für definierte synthetische Verhaltensfälle (`testdata/risk-behavior.json`). **[U]** bezüglich realer Erkennungsraten auf Feldkorpora (kein vollwertiger Virenscanner-Ersatz). |
| **Inhaltslesbarkeit & MIME-Umfang** | **[T]** | `background.js::localContentCoverage`, `readFullForAnalysis`. Erkennt unlesbare/nicht entschlüsselte Mails (`decryptionStatus: fail/skipped`) und meldet `incomplete`/`failed` sechssprachig. **Offen:** Bekannte Unicode-/quoted-printable-Abweichung (U+FFFD) unter 140/153 (`AVN-003.2`). |
| **Externe Provider-Integration** | **[N]** / **[B]** | `providers.js`, `api_gateway.js`, `scan_policy.js`. Unterstützt Hybrid Analysis, VirusTotal, URLhaus, AbuseIPDB, urlscan.io. Opt-in-Einwilligung, Host-Berechtigungen und Datenschutzstufen (Strict, Balanced, Full) implementiert. **[N]** für Mock-Verträge in Unit-Tests (`test/analysis-sources.test.js`). **[B]** für produktive Live-API-Schlüssel und Quoten (bleiben optional, keine Live-Zusagen). |
| **Linkschutz & Audit-Protokoll** | **[N]** | `link_audit.js::handleAuditedLinkCheck`, `handleOpenAuditedLink`, `handleCancelAuditedLink`; `audit.js`. Time-of-Click-Interzeption, IndexedDB v3, Transaktionsintegrität. **Verbindliche Invarianten:** `OPENED` bestätigt ausschließlich die Annahme durch Thunderbird, kein Browserbesuch; `PENDING` bleibt nach Prozessverlust offen und wird nie als Entscheidung umgedeutet. |
| **Ressourcenbesitz & Quellenanzeige** | **[T]** | `analysis_status.js`, `background.js::getMessageAnalysisContext`. Filtert fremde Ressourcen bei gleicher Header-Message-ID. **Offen:** Dauerhafte Bindung bei Ordnerwechsel/Kopie und historische Identitätsmigration (`AVN-009`). |
| **Mehrsprachigkeit (i18n)** | **[N]** / **[U]** | Vollständige Schlüsselabdeckung (503 Schlüssel) in EN, DE, FR, ES, IT, PL (`_locales/*/messages.json`, `i18n.js`). **[N]** für Katalogintegrität (`scripts/generate-i18n-fallback.js --check`). **[U]** für muttersprachliche semantische Prüfung bei langen Statusmeldungen. |
| **Designsystem & Barrierefreiheit** | **[N]** / **[U]** | Einheitliches Design (`theme.css`, `design.css`, `design_system.js`), Hell-/Dunkelmodus, Informationsdichte, Kontraste. **[N]** für automatisierte axe-core Playwright-Simulationen. **[U]** für reale Screenreader-Abnahme (NVDA unter Windows, VoiceOver unter macOS). |
| **Hintergrund-Lebenszyklus & Cache** | **[N]** | `runtime.js::ExpiringMap`. TTL-Bereinigung, Begrenzung auf 200 aktive Quellenkontexte, Idle-Disposal. Echte PSS/RSS-Messungen in `docs/FORTSCHRITT_AVN_001_002_009.md`. |
| **Unternehmensfunktionen (Enterprise)** | **[N]** / **[K]** / **[B]** | `enterprise/`, `enterprise_profiles.js`, `enterprise_setup.js`. Lokale Node-Tools, Durable Journal, Policy-Simulation und Outbox sind **[N]** im Testumfang (`enterprise/test/`). Produktive Integration ist **[K]** vorbereitet (`implementation: configuration-profile`, `enabled: false`), aber **[B]** mangels realem Pilotbetreiber und Identity Provider. |
| **Web-Simulation** | **[N]** | `src/App.tsx`, `src/lib/demo.ts`. Vollständig getrennte React-19-Vite-Web-Applikation mit simuliertem LocalStorage. Explizit nicht Bestandteil des ausgelieferten XPI-Pakets. |
| **Installation, Upgrade & Recovery** | **[N]** / **[B]** | Manuelle XPI-Installation, Version-Upgrade (1.24.3 → 1.24.4), Profil-Restore und SIGKILL-Absturzfestigkeit unter Linux sind **[N]**. Automatische Updateverteilung und Rollbackkanal über ATN sind **[B]** (kein gehosteter Update-Server / ATN-Review). |

---

## 2. Dynamische Themenlandkarte

Die erkannten Potenziale und Herausforderungen werden in acht zusammenhängende Hauptthemenbereiche gegliedert. Jedem Bereich sind konkrete Entwicklungstypen (*Optimierung*, *Verbesserung*, *Erweiterung*) zugeordnet.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           DYNAMISCHE THEMENLANDKARTE                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Bereich A] Ressourcenbesitz, Quellenstatus & Diagnose                           │
│   ├─ AVN-001 (Verbesserung): Ressourcenbesitz durchgängig isolieren              │
│   └─ AVN-011 (Erweiterung): Datenschutzarmer Diagnose-Export                     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Bereich B] Hintergrundverarbeitung, Speicher & Datenlebenszyklus                │
│   ├─ AVN-002 (Optimierung): Echte TTL-Freigabe & Begrenzung Kontextcache         │
│   └─ AVN-009 (Optimierung): Dauerhafte Identität & Retention im Dauerbetrieb     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Bereich C] Schutzwirkung, Eingangslesbarkeit & Analysequalität                  │
│   ├─ AVN-003 (Verbesserung): MIME-/Verschlüsselungsabdeckung & Unicode-Encoding  │
│   ├─ AVN-004 (Verbesserung): Reale Providerverträge abnehmen                     │
│   └─ AVN-005 (Optimierung): Unabhängige Schutzqualitätsuntersuchung              │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Bereich D] Bedienung, Mehrsprachigkeit, Design & Barrierefreiheit               │
│   ├─ AVN-006 (Verbesserung): Windows/macOS, Standardbrowser & Screenreader       │
│   └─ AVN-007 (Verbesserung): Große Quellenlisten & semantische Sprachprüfung     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Bereich E] Einrichtung, Konfigurationsprofile & Unternehmensadministration      │
│   ├─ AVN-010 (Erweiterung): Vorschaupflichtige lokale Schutzprofile              │
│   └─ AVN-012 (Erweiterung): Abgegrenzter optionaler Enterprise-Pilot             │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Bereich F] Architektur, Codekopplung & Werkzeugkette                            │
│   ├─ AVN-008 (Optimierung): Bereinigung der Toolchain-Auditbefunde               │
│   └─ AVN-013 (Optimierung): Modulverträge für Quellenkontexte                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Bereich G] Paketverteilung, Updates, Veröffentlichung & Rollback                │
│   ├─ AVN-014 (Verbesserung): Freigabevorbereitung GitHub-Release 1.24.4          │
│   └─ AVN-015 (Erweiterung): Automatischer Update- & Rollbackkanal                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Bereich H] Dokumentation & Öffentliche Auftritte                                │
│   └─ AVN-016 (Verbesserung): Versions- & Evidenzabgleich für Pages/Doku          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Priorisierte Aufgabenmatrix

Die Priorisierung erfolgt evidenzbasiert nach Nutzwert, Auswirkung auf Zuverlässigkeit und Schutz, Aufwand/Risiko sowie Verfügbarkeit der Voraussetzungen:
- **P1 (Hoch/Kritisch):** Unmittelbare Zuordnungs-, Datenverlust- oder Freigabeblocker.
- **P2 (Mittel):** Wartbarkeit, UX-Verbesserung bei großen Datenmengen, lokale Funktionserweiterung.
- **P3 (Niedrig/Optional):** Enterprise-Pilot und externe Integrationen mit externer Betreiberabhängigkeit.

Aufwandsklassen: **K** (Klein, 1–3 Tage), **M** (Mittel, 1–2 Wochen), **G** (Groß, >2 Wochen).

| ID | Bereich | Entwicklungstyp | Status | Priorität | Aufwand | Ausführbarkeit / Blocker |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **AVN-001** | A — Ressourcenbesitz | Verbesserung | **[T]** | **P1** | **M–G** | Lokal ausführbar; Schemaänderung nach AVN-009 |
| **AVN-002** | B — Speicher/Lebenszyklus | Optimierung | **[N]** | **P1** | **M** | Vollständig umgesetzt & verifiziert |
| **AVN-003** | C — Lesbarkeit/Schutz | Verbesserung | **[T]** | **P1** | **M** | Lokal ausführbar (Teilprüfung aktiv; U+FFFD-Untersuchung) |
| **AVN-004** | C — Providerverträge | Verbesserung | **[B]** | **P1** | **M** | Blockiert durch fehlende Live-API-Konten/Quoten |
| **AVN-005** | C — Schutzqualität | Optimierung | **[U]** | **P2** | **G** | Synthetisch lokal; realer Korpus benötigt externe Daten |
| **AVN-006** | D — OS & A11y | Verbesserung | **[B]** | **P1** | **M** | Blockiert durch fehlende Windows/macOS/SR-Testsysteme |
| **AVN-007** | D — UX & Sprache | Verbesserung | **[U]** | **P2** | **M** | Lokal mit synthetischen Listen; nativer Sprachreview |
| **AVN-008** | F — Werkzeugkette | Optimierung | **[N]** | **P2** | **M** | Lokal ausführbar (npm audit dev-Abhängigkeiten) |
| **AVN-009** | B — Dauerhafte Identität | Optimierung | **[T]** | **P1** | **M–G** | Untersuchung abgeschlossen; Schema-Migration lokal planbar |
| **AVN-010** | E — Konfiguration | Erweiterung | **[K]** | **P2** | **M** | Lokal ausführbar (aufbauend auf Options-Profil-Logik) |
| **AVN-011** | A — Diagnose-Export | Erweiterung | **[K]** | **P2** | **M** | Lokal ausführbar (datenschutzkonforme Projektion) |
| **AVN-012** | E — Enterprise-Pilot | Erweiterung | **[B]** | **P3** | **G** | Blockiert durch fehlenden Pilotkunden/Ziel-IdP |
| **AVN-013** | F — Architektur | Optimierung | **[T]** | **P2** | **M–G** | Lokal ausführbar (Entkopplung von `background.js`) |
| **AVN-014** | G — Releasevorbereitung | Verbesserung | **[K]** | **P1** | **K–M** | Lokal ausführbar nach Abschluss der P1-Korrekturen |
| **AVN-015** | G — Update/Rollback | Erweiterung | **[B]** | **P1** | **G** | Blockiert durch fehlende ATN-/Update-Server-Infrastruktur |
| **AVN-016** | H — Dokumentation | Verbesserung | **[N]** | **P2** | **K–M** | Weitgehend lokal; öffentlicher HTTPS-Test erfordert Netz |

---

## 4. Detaillierte Arbeitspakete

### AVN-001 — Ressourcenbesitz durchgängig isolieren
- **Themenbereich / Typ:** A — Ressourcenbesitz und nachvollziehbare Befunde / Verbesserung
- **Befund & Beleg:** Werden Nachrichten mit identischer Header-Message-ID oder neu vergebenen numerischen IDs geöffnet, konnte `resourceLabels` fremde Anhangnamen oder URLs enthalten (`background.js::getMessageAnalysisContext`, `analysis_status.js`). Ein erster Lesepfad-Fix filtert die Rückgabe nun gegen die tatsächliche Nachrichtenstruktur (`docs/FORTSCHRITT_AVN_001_002_009.md`). Die persistierte Datenspeicherung trennt Identitäten jedoch noch nicht vollständig.
- **Ergebnis & Nutzwert:** E-Mails und Popup zeigen ausschließlich Befunde und Ressourcen, die nachweislich zur angezeigten Nachricht gehören. Vermeidung von Fehlalarmen und Informationslecks.
- **Umfang:** Isolierung im Speicher- und Darstellungsmodell; strikte Zuordnung von Anhangs-Parts und URLs an die konkrete Nachrichteninstanz.
- **Priorität / Aufwand:** P1 (vor finaler Freigabe) / M–G.
- **Abhängigkeiten:** Untersuchungsergebnisse zur Identitätsbindung aus AVN-009.
- **Akzeptanzkriterien:** Zwei verschiedene E-Mails mit identischer `Message-ID` im Header und unterschiedlichen Anhängen zeigen unter keinen Umständen fremde Dateinamen oder Links im Popup oder E-Mail-Header.
- **Validierung:** Unit-Tests in `test/analysis-sources.test.js` und nativer Thunderbird-Linux-Test mit manipulierten EML-Fixtures (`tools/thunderbird-live.dev.py`).

### AVN-002 — Echte TTL-Freigabe und Begrenzung des Kontextcaches
- **Themenbereich / Typ:** B — Hintergrund, Speicher und Datenlebenszyklus / Optimierung
- **Befund & Beleg:** `ExpiringMap` bereinigte abgelaufene Schlüssel früher erst beim expliziten `get()`/`has()`; `size` und Iteratoren gaben abgelaufene Objekte zurück. Dies wurde mit einem periodischen Cache-Timer und einem harten Limit von 200 Kontexten in `runtime.js` behoben (`docs/FORTSCHRITT_AVN_001_002_009.md`).
- **Ergebnis & Nutzwert:** Garantierte Obergrenze des Arbeitsspeichers im Hintergrundprozess bei langen Sitzungen und tausenden geöffneten E-Mails.
- **Umfang:** Laufzeitüberwachung und Eviktionsvertrag.
- **Priorität / Aufwand:** P1 / M (bereits erfolgreich implementiert und verifiziert).
- **Abhängigkeiten:** Keine.
- **Akzeptanzkriterien:** Nach Überschreiten der TTL liefern alle Iteratoren leere Mengen; bei mehr als 200 Nachrichtenkontexten werden älteste Einträge sauber eviktiert und Observer abgemeldet.
- **Validierung:** `test/optimization.test.js` und native PSS/RSS-Speichermessung in Thunderbird.

### AVN-003 — Inhaltslesbarkeit, MIME- und Verschlüsselungsabdeckung
- **Themenbereich / Typ:** C — Schutzwirkung und Analysequalität / Verbesserung
- **Befund & Beleg:** Echte Thunderbird-Läufe zeigten, dass unlesbare oder nicht entschlüsselte Mails (`decryptionStatus: fail`) fälschlich als lokal geprüft (`checked`) eingestuft wurden. Dies wurde in `background.js::localContentCoverage` behoben (`incomplete`/`failed`). Offener Restbefund **AVN-003.2:** Bei UTF-8/quoted-printable-Nachrichten liefert die Thunderbird-API unter 140/153 teilweise U+FFFD (Ersatzzeichen) im Nachrichtentext (`docs/PRUEFUMFANG_NACHRICHTENINHALT.md`).
- **Ergebnis & Nutzwert:** Klare, ehrliche Statusdarstellung in allen sechs Sprachen: Anwender wissen exakt, ob der Mailinhalt vollständig, nur teilweise oder gar nicht geprüft werden konnte.
- **Umfang:** Ursachenanalyse der U+FFFD-Abweichung; risikogeprüfte Behandlung von Encodingfehlern; Einbindung isolierter Testzertifikate für S/MIME und OpenPGP.
- **Priorität / Aufwand:** P1 (Untersuchung zuerst) / M.
- **Abhängigkeiten:** Thunderbird-Krypto-Komponenten im Profil.
- **Akzeptanzkriterien:** Unlesbare oder fehlerhaft kodierte Inhalte werden transparent als `incomplete` ausgewiesen; kein Score 0 suggeriert Sicherheit bei unlesbarem Body.
- **Validierung:** `test/report-lifecycle.test.js`, synthetische EML-Tests (`tools/validate-eml.dev.py`) und native Linux-Läufe mit `--mime-content-check`.

### AVN-004 — Reale Providerverträge und Quotenverhalten abnehmen
- **Themenbereich / Typ:** C — Schutzwirkung und Analysequalität / Verbesserung
- **Befund & Beleg:** Provider-Adapter (`providers.js`, `api_gateway.js`) sind gegen Unit-Mocks und JSON-Schemas getestet. Produktive Quoten (HTTP 429), Verbindungsabbrüche und Rückmeldungen realer Endpunkte sind nicht verifiziert (`docs/SCHUTZWIRKUNG_VALIDIERUNG_2026-11.md`).
- **Ergebnis & Nutzwert:** Stabile Fehlerbehandlung und korrekte Statusanzeigen bei Ausfällen oder Kontenerschöpfung externer Dienste (Hybrid Analysis, VirusTotal, urlscan etc.).
- **Umfang:** Kontrollierte Live-Proben mit Test-API-Keys und unkritischen Artefakten; Prüfung von Retry-After-Headern.
- **Priorität / Aufwand:** P1 (vor Live-Zusagen) / M.
- **Blocker:** Freigegebene API-Schlüssel, Testbudgets und Netzwerkfreigaben in der Testumgebung.
- **Akzeptanzkriterien:** HTTP 429 oder Netzwerkfehler führen zu verlässlichem `failed`- oder `retry`-Zustand; es werden niemals unvollständige Scans als "sauber" gecacht.
- **Validierung:** Echte HTTP-Aufrufe mit isolierten Test-Tokens im Staging-Umfeld.

### AVN-005 — Unabhängige Schutzqualitätsuntersuchung
- **Themenbereich / Typ:** C — Schutzwirkung und Analysequalität / Optimierung
- **Befund & Beleg:** Die Heuristikprüfung basiert auf 9 synthetischen Mustern (`testdata/risk-behavior.json`). Ein realer Benchmark gegen aktuelle Phishing- und Malspam-Korpora existiert nicht.
- **Ergebnis & Nutzwert:** Quantifizierte Erkennungsgenauigkeit und Minimierung von False Positives bei legitimen Geschäfts- und Rechnungs-Mails.
- **Umfang:** Aufbau eines getrennten Evaluierungskorpus aus echten harmlosen und bösartigen EML-Nachrichten.
- **Priorität / Aufwand:** P2 (Untersuchung) / G.
- **Blocker:** Bereitstellung datenschutzkonformer, unabhängig gelabelter Mailkorpora.
- **Akzeptanzkriterien:** Transparente Dokumentation der Erkennungsrate und Falsch-Positiv-Rate ohne Manipulation bestehender Audit-Snapshots.
- **Validierung:** Offline-Evaluationsskript gegen `risk.js`.

### AVN-006 — Windows/macOS, Standardbrowser und native Barrierefreiheit
- **Themenbereich / Typ:** D — Bedienung und Barrierefreiheit / Verbesserung
- **Befund & Beleg:** Bisherige native End-to-End-Abnahmen laufen ausschließlich unter Linux (Xvfb). Windows 11 und macOS sowie Screenreader (NVDA, VoiceOver) sind bisher rein simuliert (`docs/NATIVE_ABNAHME_2026-11.md`).
- **Ergebnis & Nutzwert:** Verifizierte Funktionsfähigkeit, native Standardbrowser-Übergabe und barrierefreie Bedienbarkeit für alle unterstützten Betriebssysteme.
- **Umfang:** Testläufe unter Windows und macOS; Prüfung von Farbkontrasten, OS-Skalierung (High-DPI) und Tastaturfokus mit NVDA/VoiceOver.
- **Priorität / Aufwand:** P1 (vor breiter Plattformfreigabe) / M.
- **Blocker:** Verfügbarkeit von Windows- und macOS-Testmaschinen mit installierten Screenreadern.
- **Akzeptanzkriterien:** E-Mail-Warnungen und Popup sind vollständig per Tastatur bedienbar; Live-Regionen kündigen Statusänderungen korrekt an; Links öffnen den nativen Systembrowser.
- **Validierung:** Manuelle und automatisierte Testprotokolle auf realen OS-Instanzen.

### AVN-007 — Große Quellenansichten und semantische Sprachprüfung
- **Themenbereich / Typ:** D — Mehrsprachigkeit und Designsystem / Verbesserung
- **Befund & Beleg:** `analysis_status.js` unterstützt bis zu 1.200 Quellenzeilen. Das Rendering und die Übersichtlichkeit bei extrem vielen Links/Anhängen in schmalen Fenstern (360px) oder bei 200% Zoom wurden bisher nur synthetisch geprüft.
- **Ergebnis & Nutzwert:** Übersichtliche Navigation und schnelle Erfassbarkeit von Bedrohungen auch bei komplexen Nachrichten mit dutzenden Anhängen.
- **Umfang:** Stufenweises Rendering (Virtualisierung), Filter nach Bedrohungsgrad, muttersprachliche Überprüfung der deutschen, französischen, spanischen, italienischen und polnischen Texte.
- **Priorität / Aufwand:** P2 / M.
- **Abhängigkeiten:** Keine.
- **Akzeptanzkriterien:** Kein UI-Einfrieren bei >100 Links; alle Warnungen sind auf 360px ohne horizontalen Scrollbalken lesbar; Übersetzungen wirken natürlich und terminologisch präzise.
- **Validierung:** Playwright-Zoom- und Dichtetests (`tools/browser-ui.dev.cjs`), nativer Thunderbird-Rendering-Test.

### AVN-008 — Unterstützte Bereinigung der Toolchain-Auditbefunde
- **Themenbereich / Typ:** F — Architektur und Werkzeugkette / Optimierung
- **Befund & Beleg:** `npm audit` meldet moderate Befunde in Entwicklungsabhängigkeiten (`web-ext`, `addons-linter`, `eslint`). Produktive Laufzeitabhängigkeiten (`--omit=dev`) sind sauber (0 Befunde) (`docs/audits/next-development-1_24_4.json`).
- **Ergebnis & Nutzwert:** Saubere, zukunftssichere CI/CD-Pipeline ohne ungeprüfte Sicherheitswarnungen im Buildprozess.
- **Umfang:** Gezieltes Update von Dev-Dependencies ohne Bruch der MV3-Kompatibilität von `web-ext`.
- **Priorität / Aufwand:** P2 / M.
- **Abhängigkeiten:** Upstream-Releases von `web-ext`.
- **Akzeptanzkriterien:** `pnpm audit` meldet 0 Befunde oder verbleibende Warnungen sind explizit als Build-only dokumentiert; `pnpm test` und `pnpm run lint:filtered` bleiben grün.
- **Validierung:** Reproduzierbare Installation mit `pnpm install --frozen-lockfile` und vollständiger Testsuite-Lauf.

### AVN-009 — Dauerhafte Identität und Retention im Dauerbetrieb
- **Themenbereich / Typ:** B — Hintergrundverarbeitung und Speicher / Optimierung
- **Befund & Beleg:** Native Untersuchungen (`docs/IDENTITAET_ANALYSEBEFUNDE.md`) bewiesen: Numerische Nachrichten-IDs sind sitzungsabhängig und ändern sich nach Neustart/Re-Indexing. Rohdaten-Hashes (`getRaw`) ändern sich beim Lesen/Markieren durch lokale Status-Header (`X-Mozilla-Status`).
- **Ergebnis & Nutzwert:** Dauerhaft verlässliche Zuordnung historischer Prüfstände ohne Datenverlust oder falsche Übernahme bei Ordnerverschiebungen oder E-Mail-Kopien.
- **Umfang:** Trennung von flüchtiger Laufzeit-ID, versioniertem Inhaltsnachweis (Hash ohne volatile Header), Ressourcenbindung und historischer Nutzerentscheidung; Migrationsstrategie für bestehende IndexedDB-Daten.
- **Priorität / Aufwand:** P1 / M–G.
- **Abhängigkeiten:** Auswertung aus `docs/IDENTITAET_ANALYSEBEFUNDE.md`.
- **Akzeptanzkriterien:** Kopierte oder verschobene E-Mails erben niemals unbesehen frühere Nutzerentscheidungen; nach Re-Indexing oder Neustart bleiben Audit-Einträge konsistent zugeordnet.
- **Validierung:** Automatisierte Lebenszyklustests in `tools/test_thunderbird_identity.dev.py` und IndexedDB-Migrationstests.

### AVN-010 — Vorschaupflichtige lokale Schutzprofile
- **Themenbereich / Typ:** E — Einrichtung und Richtlinien / Erweiterung
- **Befund & Beleg:** `LocalSettingsProfile` (`options.js`) unterstützt derzeit nur den Export/Import von Darstellung, Akzentfarben und Informationsdichte. Schutzrichtlinien (Heuristik-Schwellenwerte, Allowlists) können noch nicht als lokales Profil verwaltet werden.
- **Ergebnis & Nutzwert:** Administratoren und Power-User können vordefinierte Schutzprofile sicher exportieren und importieren, inklusive transparenter Vorabansicht der Änderungen.
- **Umfang:** Schemaerweiterung für Schutzprofile mit strikter Validierung; Ausschluss sensibler API-Tokens; Bestätigungsdialog.
- **Priorität / Aufwand:** P2 / M.
- **Abhängigkeiten:** Keine.
- **Akzeptanzkriterien:** API-Keys und Passwörter werden niemals in Profile exportiert; Importe zeigen vor dem Speichern eine diff-artige Vorschau; ungültige Profile werden abgewiesen.
- **Validierung:** `options.test.js` mit Ajv-Schemavalidierung (`docs/schemas/local-settings-profile-v1.json`).

### AVN-011 — Datenschutzarmer Diagnose-Export
- **Themenbereich / Typ:** A — Ressourcenbesitz und Support / Erweiterung
- **Befund & Beleg:** Für Fehlersuche und Support müssen Anwender oft Screenshots anfertigen, die vertrauliche Absender, Betreffzeilen oder Datei- und Linknamen offenlegen können.
- **Ergebnis & Nutzwert:** Schnelle Fehlerdiagnose durch den Support ohne Offenlegung personenbezogener Daten.
- **Umfang:** Exportfunktion für den aktuellen Analyse- und Providerzustand mit automatischer Pseudonymisierung (keine Klartext-URLs, keine Betreffzeilen, keine Mailadressen).
- **Priorität / Aufwand:** P2 / M.
- **Abhängigkeiten:** AVN-001 / AVN-009.
- **Akzeptanzkriterien:** Exportierte JSON-Dateien enthalten ausschließlich technische Statuscodes, Prüfzeiten und anonymisierte Ressourcen-IDs; keine personenbezogenen Daten.
- **Validierung:** Automatisierter Datenschutz-Audit-Test mit Regex-Scanning auf E-Mails und URLs.

### AVN-012 — Abgegrenzter optionaler Enterprise-Pilot
- **Themenbereich / Typ:** E — Unternehmensadministration / Erweiterung
- **Befund & Beleg:** Die Module in `enterprise/` (Broker, Durable Journal, Policy-Engine) sind als lokale Node-Werkzeuge lauffähig, aber nicht an ein produktives SIEM oder zentrales Flottenmanagement angebunden (`docs/enterprise/n06-runtime-observation.json`).
- **Ergebnis & Nutzwert:** Ein klar definierter, auditierbarer Integrationspfad für Enterprise-Kunden, ohne das Community-Add-on zu überfrachten.
- **Umfang:** Definition eines standardisierten Syslog-/Webhook-Konnektors mit Outbox-Muster für genau einen Pilotbetreiber.
- **Priorität / Aufwand:** P3 / G.
- **Blocker:** Konkreter Pilotkunde mit Testinfrastruktur und Sicherheitsfreigabe.
- **Akzeptanzkriterien:** Enterprise-Funktionen bleiben standardmäßig vollständig inaktiv (`enabled: false`); Aktivierung erfordert explizite Richtlinienkonfiguration.
- **Validierung:** `enterprise/test/acceptance.test.js` und Ende-zu-Ende-Test gegen Mock-SIEM.

### AVN-013 — Modulverträge für Quellenkontexte und Entkopplung
- **Themenbereich / Typ:** F — Architektur und Wartbarkeit / Optimierung
- **Befund & Beleg:** `background.js` vereint Speicher, Event-Handling, Provider-Abfragen, Timeouts und DOM-Kommunikation in monolithischen Funktionen (`getMessageAnalysisContext`).
- **Ergebnis & Nutzwert:** Hohe Wartbarkeit, leichtere Testbarkeit einzelner Komponenten und Eliminierung von Race-Conditions.
- **Umfang:** Aufteilung in klare Submodule (Storage-Repository, State-Machine, UI-Bridge), ohne das globale Manifest oder die Skriptladefolge zu brechen.
- **Priorität / Aufwand:** P2 / M–G.
- **Abhängigkeiten:** AVN-001, AVN-002, AVN-009.
- **Akzeptanzkriterien:** Klare Trennung zwischen Zustandsspeicherung und UI-Präsentation; keine zirkulären Abhängigkeiten.
- **Validierung:** Regressionstests der gesamten Testsuite (`pnpm test`).

### AVN-014 — Freigabevorbereitung für GitHub-Release 1.24.4
- **Themenbereich / Typ:** G — Veröffentlichung und Paketierung / Verbesserung
- **Befund & Beleg:** Version 1.24.4 enthält wesentliche Korrekturen (Ressourcenisolation, Inhaltsverfügbarkeit), ist aber noch nicht als offizielles GitHub-Release veröffentlicht (`docs/AKTUELLER_PRODUKTSTAND.md`).
- **Ergebnis & Nutzwert:** Bereitstellung eines stabilen, verifizierten XPI-Installationspakets für Endanwender.
- **Umfang:** Erstellung des Release-Pakets, Aktualisierung der Prüfsummen (`scripts/build-and-verify-package.js`), Erfüllung des Submission-Gates (`scripts/submission-gate.js`).
- **Priorität / Aufwand:** P1 (nach Abschluss der P1-Korrekturen) / K–M.
- **Abhängigkeiten:** AVN-001, AVN-003, AVN-009.
- **Akzeptanzkriterien:** C1 bis C7 des Submission-Gates sind erfolgreich bestanden; Release-Notizen dokumentieren Funktionsumfang und Grenzen exakt.
- **Validierung:** `pnpm run store-gate` und manuelle Upgrade-Prüfung.

### AVN-015 — Automatischer Update- und Rollbackkanal auf echtem Kanal
- **Themenbereich / Typ:** G — Paketverteilung und Rollback / Erweiterung
- **Befund & Beleg:** Die Erweiterung nutzt kein `update_url` im Manifest; Updates erfolgen manuell via Dateiinstallation. Ein automatischer Kanal mit sicherem Rollback existiert nicht (`docs/VEROEFFENTLICHUNG_1_24_3.md`).
- **Ergebnis & Nutzwert:** Nahtlose Sicherheitsupdates für Endanwender; definierter Rollback-Pfad bei Fehlern.
- **Umfang:** Konzeption und Erprobung des offiziellen ATN-Update-Kanals (Thunderbird Add-ons) inklusive Signierung.
- **Priorität / Aufwand:** P1 (vor Zusagen automatischer Versorgung) / G.
- **Blocker:** ATN-Maintainer-Zugang, Review-Freigabe durch Mozilla/Thunderbird.
- **Akzeptanzkriterien:** Update wird von Thunderbird automatisch erkannt und ohne Einstellungs- oder Datenverlust eingespielt; `PENDING`-Zustände werden nicht verändert.
- **Validierung:** Test-Channel-Installation unter realen Thunderbird-Profilen.

### AVN-016 — Dokumentation und öffentliche Pages nach Releaseebenen abnehmen
- **Themenbereich / Typ:** H — Dokumentation und Pages / Verbesserung
- **Befund & Beleg:** Die GitHub Pages und `README.md` verweisen auf Version 1.24.3, während die Entwicklungsdokumentation bereits 1.24.4 beschreibt.
- **Ergebnis & Nutzwert:** Widerspruchsfreie Dokumentation für Anwender, Entwickler und Auditoren.
- **Umfang:** Bereinigung der Dokumentationslinks, klare Kennzeichnung von Entwicklungs- vs. Release-Ständen in allen sechs Sprachen.
- **Priorität / Aufwand:** P2 / K–M.
- **Abhängigkeiten:** AVN-014.
- **Akzeptanzkriterien:** Alle sechs Landing-Pages (`docs/index_*.html`) verweisen auf die tatsächliche Releaseversion; interne Links sind valide (`pnpm run check:docs`).
- **Validierung:** `pnpm run check:docs` und lokaler Jekyll-Build.

---

## 5. Roadmap

### 5.1 Kurzfristig (Sofort ausführbar mit vorhandenen Ressourcen)
1. **AVN-003.2 — Untersuchung der Unicode-/quoted-printable-Abweichung:** Klärung des U+FFFD-Verhaltens in der Thunderbird-API unter Linux 140/153.
2. **AVN-009 — Datenvertrag & Identitätsarchitektur:** Festlegung des neuen Hash- und Speichervertrags zur Trennung von Inhaltsnachweis, Vorkommen und Audit-Snapshot.
3. **AVN-001 — Vollständige Ressourcenisolation im Speicher:** Integration des Identitätsvertrags in `background.js` und `analysis_status.js`.
4. **AVN-014 — Vorbereitung von Release 1.24.4:** Nach Abschluss der Kernkorrekturen Bereitstellung des aktualisierten GitHub-Releases.

### 5.2 Mittelfristig (Nach Schaffung stabiler Verträge)
- **AVN-007:** Performance-Optimierung und Virtualisierung bei sehr großen Quellenlisten (>100 Elemente).
- **AVN-010 & AVN-011:** Ergänzung vorschaupflichtiger lokaler Schutzprofile und datenschutzarmer Diagnose-Exporte.
- **AVN-013:** Modulare Entkopplung von `background.js` zur Erhöhung der langfristigen Wartbarkeit.
- **AVN-016:** Endabnahme der Dokumentation und Synchronisation der GitHub-Pages.

### 5.3 Später / Blockiert durch externe Voraussetzungen
- **AVN-004:** Live-Provider-Validierung (erfordert API-Budget und Zugangsdaten).
- **AVN-006:** Native Abnahme unter Windows 11, macOS, NVDA und VoiceOver (erfordert entsprechende Test-Hardware).
- **AVN-005:** Evaluierung gegen reale Phishing-Korpora (erfordert externe Datenfreigaben).
- **AVN-012:** Produktiver Enterprise-Pilot (erfordert Betreiber und Zielinfrastruktur).
- **AVN-015:** Automatischer Distributionskanal über ATN (erfordert Mozilla/ATN-Freigabeprozess).

---

## 6. Die drei sinnvollsten nächsten Arbeitspakete

1. **AVN-009 — Dauerhafte Identitäts- und Speichertrennung (P1, Optimierung):**
   *Begründung:* Numerische Thunderbird-IDs sind nachgewiesen flüchtig; Roh-Hashes ändern sich durch Status-Flags. Bevor weitere Features oder Migrationen implementiert werden, muss das Fundament der Datenzuordnung mathematisch und vertraglich stabil sein, um Regressionsrisiken und Fehlzuordnungen auszuschließen.
2. **AVN-003.2 — Klärung der Unicode-/Encoding-Eingangsqualität (P1, Verbesserung):**
   *Begründung:* Die reproduzierte U+FFFD-Abweichung bei quoted-printable-Inhalten betrifft die reale Schutzwirkung der Heuristik. Eine verlässliche Gefahrenerkennung erfordert saubere, unbeschädigte Nachrichtentexte am Eingang der Analyse-Pipeline.
3. **AVN-001 — Durchgängige Isolation des Ressourcenbesitzes (P1, Verbesserung):**
   *Begründung:* Die korrekte Darstellung von Ressourcen (Dateinamen, URLs) verhindert Verwirrung beim Anwender und schließt potenzielle Spoofing- oder Clobbering-Effekte bei gleichen Nachrichten-Headern endgültig aus.
