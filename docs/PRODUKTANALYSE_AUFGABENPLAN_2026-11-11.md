# Thundy AV — Produktarchitektur, Bestandsaufnahme und dynamischer Aufgabenplan

**Rolle:** Technischer Produktarchitekt und erfahrener Thunderbird-Extension-Entwickler
**Projekt:** Thundy AV — E-Mail-Anhang- und Link-Scanner für Mozilla Thunderbird (WebExtension, MV3)
**Bezug:** Stand Version **1.25.7** (Entwicklungskandidat; veröffentlichter Release: **1.25.6**)
**Datum:** 11. November 2026
**Status:** Verbindliche architektonische Bestandsaufnahme und evidenzbasierter Entwicklungsplan

---

## 1. Tatsächlicher Stand (Evidenzbasierte Bestandsaufnahme)

### 1.1 Quellenstand, Arbeitsbaum und Veröffentlichungsebenen

Zur Vermeidung von Fehlannahmen wird strikt zwischen dem aktuellen Entwicklungsstand, verifizierten Release-Tags, CI-Läufen und tatsächlich veröffentlichten Binärpaketen unterschieden:

| Ebene | Tatsächlicher Zustand | Beleg / Evidenz / Prüfgrenze |
| :--- | :--- | :--- |
| **Arbeitsbaum / Branch** | `main` / Entwicklungskandidat **1.25.7** | Synchrones Versionsfeld `1.25.7` in `package.json` und `manifest.json`. Lokaler Arbeitsbaum ist sauber (`git status`). |
| **Veröffentlichter Release** | GitHub Release **1.25.6** (veröffentlicht am 11.11.2026) | [Veröffentlichungsnachweis 1.25.6](VEROEFFENTLICHUNG_1_25_6.md), Tag `v1.25.6` (`e75aaee6fe49...`), [Release-Notes 1.25.6](releases/1.25.6.md). Unveränderliches XPI mit SHA-256 `10b74ef475555ac27bce5d4d042695ac908cb942d3084d9cbe1ee1610b8453f0`. Frühere Versionen `1.25.5`, `1.25.4` etc. bleiben historisch unverändert erhalten. |
| **Entwicklungskandidat 1.25.7** | Unveröffentlichter Stand mit neuem API-Debugmodus | [Abnahmeprotokoll 1.25.7](live_test_1_25_7.md), [Dokumentation API-Debugmodus](API_DEBUGMODUS_1_25_7.md). Kriterien C01–C11 und C13 bestanden; C12 (unabhängiger Download der Release-Assets) bleibt vor Veröffentlichung definitionsgemäß offen. |
| **Laufzeit-Architektur** | 3 strikt getrennte Runtimes | 1. **Thunderbird MailExtension:** Manifest V3, Hintergrundskripte (`background.js`, `api_diagnostics.js`), HTML-Seiten (`options.html`, `popup.html`, `security.html`), IndexedDB `hybridanalysis` und `browser.storage.local`.<br>2. **Offline-Enterprise-Werkzeuge:** Node-Skripte unter `enterprise/*.cjs`, isoliertes Ledger/Outbox/Storage-System, CLI-Tools; strikt aus dem XPI-Paket ausgeschlossen.<br>3. **Web-Demo:** React-Anwendung (`src/App.tsx`, `npm run dev`), rein browserlokale Simulation mit `SIMULATED_OPEN`/`SIMULATED_ABORT`, strikt aus dem XPI ausgeschlossen. |
| **Automatisierte Testsuite** | **1.298 Tests in 75 Testsuiten** | Ausführung mit `pnpm test` (über Node.js `--test`). 1.298 Tests bestanden, 0 fehlgeschlagen. Single-Lockfile-Regel verifiziert (`package-lock.json` vorhanden, kein `pnpm-lock.yaml` im Commit). |
| **Linter & Prüfvertrag** | **0 Fehler, 39 kuratierte Warnungen** | `npm run lint:filtered` via `scripts/lint-with-filter.js`. Alle 39 Warnungen sind nachgewiesene Thunderbird-spezifische MailExtension-Berechtigungen (`messagesRead`, `menus`, `windows.openDefaultBrowser` etc.). |
| **Store-Readiness-Gate** | C1 bis C5 PASS, C6/C7 paketgebunden | `node scripts/submission-gate.js`. Paket-Integrität und Dateiausschlussliste werden über `scripts/verify-package.js` (57 erlaubte Dateien, deterministischer Paketbau) erzwungen. |
| **Dokumentation & Pages** | Jekyll-Quellen unter `docs/` | `npm run check:docs` validiert alle relativen Links, Permalinks und Versionsreferenzen (418 Links in 104 Dateien fehlerfrei). |

---

### 1.2 Differenzierte Klassifizierung der Fähigkeiten

Jede Produkteigenschaft wird anhand der tatsächlichen Evidenz in genau eine Kategorie eingeordnet:
- **[N] Implementiert und nachgewiesen:** Funktionsfähig, im Code belegt und durch automatisierte oder native Tests verifiziert.
- **[U] Implementiert, aber unzureichend geprüft:** Code vorhanden, jedoch fehlen empirische Tests, plattformübergreifende Läufe oder realistische Lastszenarien.
- **[T] Teilweise umgesetzt:** Erste Teilaspekte implementiert, Kernmechanismen oder Migrationspfade noch unvollständig.
- **[K] Konzeptionell vorbereitet:** Spezifikationen, Schnittstellen oder Schemas angelegt, aber keine funktionale Produktivintegration.
- **[B / ✋] Offen oder durch Voraussetzungen blockiert:** Erfordert externe Zugänge, Drittsysteme oder Freigaben, die im Repository nicht vorliegen.

| Fähigkeit / Komponente | Status | Befund und Belege im Code |
| :--- | :---: | :--- |
| **Time-of-Click & Klickinterzeption** | **[N]** | `link_audit.js`, `background.js`: Interaktions-IDs, Einmalfreigaben, TOCTOU-Schutz, serielle Abwicklung. Nativ auf Thunderbird Linux 140.12.0 ESR & 153.6.0 ESR abgenommen. |
| **Präzise Semantik (OPENED / PENDING)** | **[N]** | `link_audit.js`: `OPENED` bestätigt strikt nur die Annahme durch `windows.openDefaultBrowser` (kein Webseitenbesuch garantiert). `PENDING` bleibt nach Crash/Absturz unverändert im Audit-Log erhalten (`test/audit.test.js`). |
| **Datenschutz- & Einwilligungsstufen** | **[N]** | `options.js`, `scan_policy.js`: 3 Stufen (`strict`, `balanced`, `max`), Opt-in für `personalCommunications` und `sensitiveDataUpload`. Keine Datenübertragung ohne Nutzerkonsens. |
| **API-Debugmodus & Gateway-Diagnose** | **[N]** | `api_diagnostics.js`, `api_gateway.js`: Opt-in-Diagnose im RAM (max. 100 Einträge/1 MiB), strikte Redaktion (Schlüssel, URLs und Payloads geschützt), geschützt durch Admin-Sitzung (`test/api-diagnostics.test.js`, `tools/api-debug.dev.py`). |
| **Mehrsprachigkeit (6 Sprachen)** | **[N]** | `_locales/*/messages.json`: Vollständige Parität für EN, DE, FR, ES, IT, PL. Dynamischer Fallback in `i18n.js`. Verifiziert über `scripts/generate-i18n-fallback.js --check` und `test/i18n.test.js`. |
| **Theming & Designsystem** | **[N]** | `theme.js`, `theme.css`, `design_system.js`, `design.css`: Erkennung nativer Thunderbird-Farben (Hell/Dunkel), Dichte (`compact`, `normal`, `touch`), Kontraste, Tastaturbedienung (`test/theme.test.js`). |
| **urlscan- & Hybrid-Kontingente** | **[N]** | `providers.js`, `scan_jobs.js`: Differenzierte Quotenabwicklung, Auswertung von Resets, getrennte Quick-Scan-ID-Auflösung via `GET /quick-scan/{id}` nach Übersicht-404 (`docs/API_DEBUGMODUS_1_25_7.md`). |
| **Lokale Schutzprofile & Diff (AVN-010)** | **[N]** | `options.js`: `LocalProtectionProfile` mit Pflicht-Differenzdialog vor Übernahme (`docs/schemas/local-protection-profile-v1.json`). |
| **Diagnose-Export & Provenienz (AVN-011)** | **[N]** | `source_export.js`, `source_export.html`: Bereinigter Export von Quellmetadaten ohne schutzbedürftige E-Mail-Inhalte (`test/source-export.test.js`). |
| **Offline-Enterprise-Vertragskern** | **[N]** | Module in `enterprise/`: Ledger, Outbox, Storage-Jobs, Policy-Simulation lokal mit 100 % Testabdeckung. |
| **MIME/Unicode & Crypto-Hüllen (AVN-003)** | **[T]** | UTF-8/QP in `UNICODE_NACHRICHTENEINGANG.md` gelöst. S/MIME- und PGP-verschlüsselte Hüllen (`application/pkcs7-mime`) werden als unvollständig erkannt; automatische Klartextprüfung nach Client-Entschlüsselung ist unvollständig. |
| **Dauerhafte Identität & Migration (AVN-009)** | **[T]** | `deriveMessageContentKey` und konservativer Vertrag (`docs/IDENTITAETSVERTRAG_2026_11_10.md`) formuliert. Eine vollständige Datenbankmigration bei Ordnerverschiebung ohne `accountsRead`-Rechte bleibt ungelöst. |
| **Desktop-Browser-Handoff (OS-Integration)** | **[U]** | `windows.openDefaultBrowser` im virtuellen Framebuffer (Xvfb/Linux) geprüft. Reale Übergabe an installierte Standardbrowser auf Desktop-Sitzungen (Wayland/X11, Windows, macOS) ist empirisch unvollständig. |
| **Screenreader & Assistenzsysteme (AVN-006)** | **[U]** | Synthetische ARIA-Prüfung via Playwright und `@axe-core/playwright`. Reale Tests mit NVDA, JAWS, VoiceOver oder Orca stehen aus. |
| **Heuristik-Güte gegen Live-Feeds (AVN-005)** | **[U]** | `risk.js` basiert auf statischen Pattern und 9 synthetischen Grenzfällen (`tools/risk-corpus.dev.cjs`). Ein empirischer Benchmark gegen tagesaktuelle Phishing- und Benign-Feeds (Precision/Recall) fehlt. |
| **Externe Live-Provider-Validierung (AVN-004)** | **[U]** | Gateway-Adapter laufen in CI gegen synthetische Mocks. Reale HTTP-429-Antworten und Netzwerk-Timeouts unter Last sind mit echten Konten ungeprüft. |
| **Enterprise SIEM-Export & Cloud-Storage** | **[K]** | Adapter in `enterprise/storage_jobs.cjs` und Queues in `enterprise/outbox.cjs` existieren als Testdoubles ohne echte Cloud-Konnektoren (S3, Azure Blob, Splunk, Elastic). |
| **Reale Windows- & macOS-Verifikation** | **[B / ✋]** | Live-Tests bisher nur unter Linux (`tools/thunderbird-live.dev.py`). Benötigt reale Windows 11- (Win32/MSIX) und macOS-Runner. |
| **ATN-Store-Signierung & Distribution** | **[B / ✋]** | Blockiert durch fehlende AMO/ATN-Maintainer-Credentials. Unsignierte XPIs erfordern manuelles Laden. |
| **Automatische Updateverteilung & Rollback** | **[B / ✋]** | Client-Rollback und automatisierte Updates können erst nach Einbindung in ATN oder einen verifizierten Update-Server getestet werden. |

---

## 2. Dynamische Themenlandkarte

Die Handlungsfelder werden aus den tatsächlichen Modulen, Schnittstellen und Risikobereichen des Repositories gebildet:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              THUNDY AV - THEMENLANDKARTE                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ A. Schutzwirkung, Analysequalität & Linkentscheidungen                                 │
│    ├── Lokale Heuristik & Inhaltsentschärfung (risk.js, sanitize.js)                   │
│    ├── Time-of-Click, Interzeption & Semantik (link_audit.js, background.js)           │
│    ├── Externe Provider-Kontingente & API-Gateway (providers.js, api_gateway.js)       │
│    └── API-Debugmodus & Gateway-Diagnostik (api_diagnostics.js)                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ B. Datenlebenszyklus, Speicher & Identität                                             │
│    ├── Temporärer Kontextcache & TTL-Eviction (background.js, runtime.js)              │
│    ├── Permanenter Audit- & Befundspeicher (db.js, IndexedDB hybridanalysis)           │
│    └── Dauerhafte Inhalts-/Vorkommensbindung & Retention (IDENTITAETSVERTRAG)         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ C. Bedienung, Barrierefreiheit & Designsystem                                          │
│    ├── Einheitliches Theming, Kontraste & Dichte (theme.js, theme.css, design.css)     │
│    ├── Status- & Kontingentkarten (analysis_status.js, api.js)                         │
│    ├── Barrierefreiheit & Screenreader-Führung (ARIA-Live, Fokus-Fallen, Rollen)       │
│    └── Mehrsprachigkeit & Fallback-Integrität (6 Sprachen, i18n.js, _locales/)         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ D. Einrichtung, Schutzrichtlinien & Administration                                     │
│    ├── Onboarding-Assistent & Ersteinrichtung (onboarding.js, onboarding.html)         │
│    ├── Lokale Schutz- und Darstellungsprofile (options.js, enterprise_profiles.js)     │
│    ├── Lokale Admin-Sperre & Sitzungssicherheit (security.js, security_client.js)      │
│    └── Berechtigungs-, Datenschutz- und Opt-in-Modell (scan_policy.js)                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ E. Architektur, Testinfrastruktur & Wartbarkeit                                        │
│    ├── Modulare Entflechtung von background.js (Service-Aufteilung)                    │
│    ├── Test-Harness & DOM-Fixture-Stabilität (jsdom 31 vs. Lifecycle)                  │
│    └── Toolchain, Advisories & Linting (scripts/lint-with-filter.js, package.json)     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ F. Plattformkompatibilität, Distribution & Release                                     │
│    ├── OS-Matrix (Linux X11/Wayland, Windows 11, macOS Sequoia)                        │
│    ├── ATN-Signierung & Store-Readiness (submission-gate.js, manifest.json)            │
│    └── Update-Integrität, Rollback-Sicherheit & deterministischer Paketbau             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Priorisierter evidenzbasierter Aufgabenplan

Die Aufgaben-IDs werden streng konsistent fortgeführt (AVN-001 bis AVN-020+), ohne historische Bedeutungen umzudeuten oder abgeschlossene Teilaspekte fälschlich neu zu implementieren.

### AVN-003: Absicherung von S/MIME-, PGP- und komplexen MIME-Grenzfällen
- **Themenbereich:** A. Schutzwirkung, Analysequalität & Linkentscheidungen
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** `message_ui.js` und `runtime.js` extrahieren Nachrichtentexte. Für S/MIME- und PGP-verschlüsselte Nachrichten liefert die Thunderbird-WebExtension-API unvollständige MIME-Teile (`application/pkcs7-mime`), wenn die Entschlüsselung im Client noch nicht erfolgt ist (`UNICODE_NACHRICHTENEINGANG.md`, `ENTWICKLUNG_2026_11_10.md`). Der Scanstatus wird defensiv auf `assessmentIncomplete` gesetzt; eine automatische Nachprüfung nach Anwender-Entschlüsselung fehlt.
- **Gewünschtes Ergebnis & Nutzwert:** Saubere Erkennung entschlüsselter Ansichten; differenzierte Statusanzeige („Verschlüsselte Nachricht – lokale Heuristik nach Entschlüsselung verfügbar“) in allen 6 Sprachen statt generischer Warnungen.
- **Abgegrenzter Umfang:** MIME-Typerkennung in `message_ui.js` und `risk.js`; Lokalisierungs-Keys in `_locales/*/messages.json`; keine eigene Krypto-Implementierung.
- **Priorität & Aufwand:** Priorität **P1**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Lokale Bereitstellung synthetischer verschlüsselter EML-Fixtures (`tools/crypto-fixtures.dev.py`).
- **Akzeptanzkriterien:**
  1. `application/pkcs7-mime` erzeugt transparente Statusmeldung in EN, DE, FR, ES, IT, PL.
  2. Kein falscher Malware-Verdacht durch unlesbare Chiffre-Texte.
  3. Vollständige Testabdeckung in `test/analysis-sources.test.js`.
- **Validierung:** Lokale Ausführung von `pnpm test` und `tools/crypto-fixtures.dev.py`.

### AVN-009: Dauerhafte Identität und Speichermigration im Dauerbetrieb
- **Themenbereich:** B. Datenlebenszyklus, Speicher & Identität
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** `db.js::deriveMessageContentKey` nutzt Header- und Inhalts-Hashes. Bei IMAP-Ordnerverschiebungen oder Komprimierung ändern sich numerische Thunderbird-Header-IDs. Das WebExtension-Recht `accountsRead` fehlt im Add-on, wodurch Move-/Copy-Events nicht beobachtet werden können (`docs/IDENTITAETSVERTRAG_2026_11_10.md`).
- **Gewünschtes Ergebnis & Nutzwert:** Robuste Inhaltsbindung von Analyse- und Audit-Ergebnissen ohne Datenverlust oder Zuordnungsvertauschung bei Ordnerwechseln.
- **Abgegrenzter Umfang:** Konservative Schlüsselauflösung in `db.js`; Beibehaltung historischer Audit-Snapshots (`PENDING`/`OPENED`); keine unüberlegte Schema-Löschung.
- **Priorität & Aufwand:** Priorität **P1**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Lokale Dovecot-IMAP-Testfixtures (`tools/imap-lifecycle.dev.py`).
- **Akzeptanzkriterien:**
  1. Audit-Einträge bleiben auch nach IMAP-Kopiervorgängen dem Inhalts-Hash eindeutig zugeordnet.
  2. Bestehende historische Datenbankbestände werden migrationsfrei weiter unterstützt.
- **Validierung:** `pnpm test test/audit.test.js` und `python3 tools/imap-lifecycle.dev.py`.

### AVN-020: Modulare Entflechtung von background.js
- **Themenbereich:** E. Architektur, Testinfrastruktur & Wartbarkeit
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** `background.js` umfasst über 1.200 Zeilen und bündelt Time-of-Click-Interzeption, Tab-Management, Menü-Handler, Speichereviction, Scan-Scheduling und IPC-Nachrichten-Routing. Dies erschwert gezielte Reviews und isolierte Modultests.
- **Gewünschtes Ergebnis & Nutzwert:** Klare Service-Architektur mit modularer Trennung (`link_interceptor.js`, `context_manager.js`, `menu_controller.js`), die in `manifest.json` deklarativ geladen werden.
- **Abgegrenzter Umfang:** Refactoring von `background.js` in fokussierte Submodule; Anpassung der Skriptliste in `manifest.json` und `scripts/verify-package.js`.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Vorheriger Abschluss von AVN-003 und AVN-009 zur Vermeidung von Merge-Konflikten.
- **Akzeptanzkriterien:**
  1. `manifest.json` lädt die neuen Submodule ohne zirkuläre Abhängigkeiten.
  2. Alle 1.298 Tests und `npm run check:source` bestehen unverändert.
  3. `scripts/verify-package.js` validiert die neuen Dateinamen im Build.
- **Validierung:** `npm run check` und native Linux-Prüfung `tools/thunderbird-live.dev.py`.

### AVN-021: Desktop-Handoff- und Standardbrowser-Validierung
- **Themenbereich:** F. Plattformkompatibilität, Distribution & Release
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** `link_audit.js` verwendet `windows.openDefaultBrowser`. Dies ist im virtuellen Framebuffer (Xvfb) getestet, jedoch fehlt der empirische Nachweis des tatsächlichen Browserprozessstarts auf Desktop-Umgebungen (Wayland/X11, Firefox ESR, Google Chrome, Microsoft Edge).
- **Gewünschtes Ergebnis & Nutzwert:** Verifizierter Nachweis, dass `OPENED` verlässlich den Start des Standardbrowsers bewirkt und keine Sandboxing-Restriktionen den Aufruf blockieren.
- **Abgegrenzter Umfang:** Erstellung eines Prüfleitfadens und standardisierten Testberichts für manuelle Desktop-Prüfungen unter Linux, Windows und macOS.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **S**.
- **Abhängigkeiten / Blocker:** Physische oder virtualisierte Testarbeitsplätze mit Desktop-Sitzungen.
- **Akzeptanzkriterien:**
  1. Verifizierter Start des registrierten Standardbrowsers unter Linux X11 und Wayland.
  2. Dokumentierte Bestätigung in `docs/audits/desktop-handoff-abnahme.json`.
- **Validierung:** Manuelle Abnahme gemäß standardisiertem Klick-Protokoll.

### AVN-006: Reale Screenreader- und Tastaturabnahme (NVDA / VoiceOver / Orca)
- **Themenbereich:** C. Bedienung, Barrierefreiheit & Designsystem
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** Die Barrierefreiheit wird derzeit synthetisch via Playwright und `axe-core` geprüft. Reale Screenreader-Nutzer sind auf korrekte Ansage von ARIA-Live-Regionen bei dynamischen Sicherheitswarnungen angewiesen (`onboarding.html`, `options.html`, `popup.html`, `security.html`).
- **Gewünschtes Ergebnis & Nutzwert:** Lückenlose Zugänglichkeit für sehbehinderte Anwender. Verlässliche akustische Ausgabe von Risiko-Scores, Blockierungsentscheidungen und Bestätigungsdialogen.
- **Abgegrenzter Umfang:** Prüfung und Optimierung aller interaktiven Elemente auf Fokus-Management, Tastatur-Traps und Screenreader-Ansagen.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Testumgebungen mit installierten Screenreadern (NVDA unter Windows, VoiceOver unter macOS, Orca unter Linux).
- **Akzeptanzkriterien:**
  1. Warnhinweise in `message_ui.js` und `popup.html` werden von Screenreadern sofort vorgelesen.
  2. Vollständige Tastaturbedienbarkeit ohne Maus in allen Dialogen und Tabellen.
- **Validierung:** Strukturierter Testbericht unter `docs/audits/screenreader-abnahme.md`.

### AVN-004: Live-Validierung externer Provider-Kontingente und Failover
- **Themenbereich:** A. Schutzwirkung, Analysequalität & Linkentscheidungen
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** Kontingent- und Fehlerbehandlung (`providers.js`, `api_gateway.js`, `api_diagnostics.js`) wurden ausschließlich mit synthetischen Mocks verifiziert (`test/provider-contracts.test.js`, `test/api-diagnostics.test.js`).
- **Gewünschtes Ergebnis & Nutzwert:** Nachweis der Resilienz gegen echte HTTP-429-Antworten und Netzwerk-Timeouts unter Last; kein Einfrieren der Benutzeroberfläche; verlässliche Einbeziehung lokaler Fallbacks.
- **Abgegrenzter Umfang:** Erweiterung von `tools/vt-probe.dev.js` um konfigurierbare Test-Endpunkte für Hybrid Analysis, VirusTotal, AbuseIPDB und urlscan.io mit echten (Test-)Schlüsseln.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Bereitstellung von Entwickler-API-Keys und Kontingenten für die externen Dienste.
- **Akzeptanzkriterien:**
  1. Bei Kontingenterschöpfung schaltet die UI unmittelbar auf lokale Heuristik um.
  2. Keine unkontrollierten Retry-Schleifen bei 429/503.
- **Validierung:** Manuelle Probe mit Test-Credentials über `tools/vt-probe.dev.js` und `api_diagnostics.js`.

### AVN-022: Native Plattformabnahme für Windows 11 und macOS
- **Themenbereich:** F. Plattformkompatibilität, Distribution & Release
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** Die native Thunderbird-Automatisierung (`tools/thunderbird-live.dev.py`) läuft gegen Linux-Binaries. Windows (Win32/MSIX) und macOS verwenden abweichende Profilpfade, Dateisystemberechtigungen und Prozessarchitekturen.
- **Gewünschtes Ergebnis & Nutzwert:** Belegte Kompatibilität auf den beiden meisteingesetzten Thunderbird-Betriebssystemen. Ausschluss plattformspezifischer Abstürze oder Pfadkonflikte.
- **Abgegrenzter Umfang:** Portierung von `tools/thunderbird-live.dev.py` auf Windows (PowerShell/Batch-Integration) und macOS; Ausführung der Basistests.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **L**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Dedizierte Windows- und macOS-CI-Runner oder Testgeräte.
- **Akzeptanzkriterien:**
  1. Erfolgreiche Installation des XPI in Thunderbird unter Windows 11 und macOS Sequoia.
  2. Fehlerfreie Klickprüfung und Audit-Speicherung.
- **Validierung:** Erstellung von `docs/audits/windows-abnahme.json` und `docs/audits/macos-abnahme.json`.

### AVN-015: ATN-Store-Signierung, Update-Verteilung & Rollback-Schutz
- **Themenbereich:** F. Plattformkompatibilität, Distribution & Release
- **Entwicklungstyp:** Erweiterung
- **Befund mit Beleg:** Bisherige Releases (inkl. 1.25.6) sind unsigned GitHub-Distributionen. Endanwender müssen Entwickleroptionen nutzen oder Warnungen bei manueller XPI-Installation bestätigen. Ein automatisierter Updatetest mit anschließendem Rollback existiert nicht.
- **Gewünschtes Ergebnis & Nutzwert:** Offizielle Listung auf addons.thunderbird.net (ATN) mit automatischer Updateversorgung. Nachweis, dass Upgrades bestehende Einstellungen und historische Audit-Daten migrieren und bei inkompatiblen Schemaversionen sicher degradieren.
- **Abgegrenzter Umfang:** Einrichtung der ATN-API-Verbindung in GitHub Actions (`.github/workflows/release.yml`); Rollback- und Migrationsprüfung für IndexedDB.
- **Priorität & Aufwand:** Priorität **P3**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Bereitstellung von Mozilla AMO/ATN-API-Credentials durch den Maintainer.
- **Akzeptanzkriterien:**
  1. Automatisierte Signierung über `web-ext sign`.
  2. Migrationssicherheit alter Datenbankstände (`hybridanalysis`) ohne Datenverlust verifiziert.
- **Validierung:** `scripts/submission-gate.js` mit aktivem Kriterium C7.

### AVN-012: Enterprise SIEM-Export & Cloud-Speicheranbindung
- **Themenbereich:** D. Einrichtung, Schutzrichtlinien & Administration
- **Entwicklungstyp:** Erweiterung
- **Befund mit Beleg:** Die Module in `enterprise/` bilden ein vollständiges kryptografisches Ledger und Outbox-System ab, senden Daten jedoch nur an lokale JSON-Dateien. Für den Unternehmenseinsatz fehlen direkte Schnittstellen zu SIEM-Systemen (Splunk HEC, Elasticsearch) oder Objektspeichern (S3, Azure Blob).
- **Gewünschtes Ergebnis & Nutzwert:** Optionaler, manipulationssicherer Audit-Export für zentrale SOC-Teams ohne Beeinträchtigung der lokalen Arbeitsplatz-Performance.
- **Abgegrenzter Umfang:** Implementierung produktiver Exporter in `enterprise/connectors.cjs` mit striktem Opt-in und TLS-Absicherung.
- **Priorität & Aufwand:** Priorität **P3**, Aufwand **L**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Testzugänge zu Unternehmens-SIEM- oder Cloud-Speichersystemen.
- **Akzeptanzkriterien:**
  1. Export erfolgt strikt asynchron ohne Blockierung der Thunderbird-Laufzeit.
  2. Keine Übertragung sensibler Kommunikationsdaten (strikte Minimierung auf Interaktions-ID, URL-Hash, Score).
- **Validierung:** `enterprise/test/connectors.test.js` gegen reale oder lokale Test-Server (LocalStack).

### AVN-005: Heuristik-Qualitätsbenchmark gegen Live-Feeds
- **Themenbereich:** A. Schutzwirkung, Analysequalität & Linkentscheidungen
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** Die Regeln in `risk.js` werden aktuell gegen 9 statische Fälle in `testdata/risk-behavior.json` getestet. Ein empirischer Nachweis der Erkennungsrate gegen reale, frische Phishing-Kampagnen fehlt.
- **Gewünschtes Ergebnis & Nutzwert:** Valide Kennzahlen (Precision, Recall, False-Positive-Rate) zur kontinuierlichen Schärfung der Heuristik-Schwellenwerte ohne Überreaktion auf reguläre E-Mails.
- **Abgegrenzter Umfang:** Aufbau eines automatisierten Evaluierungsskripts (`tools/risk-benchmark.dev.js`), das anonymisierte Testdaten gegen definierte Ground-Truth-Korpora auswertet.
- **Priorität & Aufwand:** Priorität **P3**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Bereitstellung kuratierter Phishing- und Benign-Feeds.
- **Akzeptanzkriterien:**
  1. Automatisierter Report über Erkennungsgenauigkeit.
  2. Keine Zunahme von Fehlalarmen bei legitimen Transaktions-E-Mails.
- **Validierung:** `node tools/risk-benchmark.dev.js`.

---

## 4. Übersicht der priorisierten Arbeitspakete

| ID | Themenbereich | Typ | Priorität | Aufwand | Blocker / Voraussetzung |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **AVN-003** | A. Schutzwirkung & MIME-Grenzfälle | Optimierung | **P1** | **M** | Keine (lokale EML-Fixtures vorhanden) |
| **AVN-009** | B. Datenlebenszyklus & Identität | Optimierung | **P1** | **M** | Keine (lokale Dovecot-Fixtures) |
| **AVN-020** | E. Architektur & Modularisierung | Optimierung | **P2** | **M** | AVN-003/009 abgeschlossen |
| **AVN-021** | F. Plattformkompatibilität & OS | Verbesserung | **P2** | **S** | Physische/VM-Desktop-Sitzungen |
| **AVN-006** | C. Barrierefreiheit & Screenreader | Verbesserung | **P2** | **M** | ✋ Reale Screenreader-Testplätze |
| **AVN-004** | A. Schutzwirkung & Provider | Optimierung | **P2** | **M** | ✋ Reale Provider-API-Keys |
| **AVN-022** | F. Plattformkompatibilität & OS | Verbesserung | **P2** | **L** | ✋ Reale Windows-/macOS-Runner |
| **AVN-015** | F. Distribution, Signierung & Rollback | Erweiterung | **P3** | **M** | ✋ AMO/ATN-Maintainer-Credentials |
| **AVN-005** | A. Schutzwirkung & Heuristik | Optimierung | **P3** | **M** | Phishing-/Benign-Korpora |
| **AVN-012** | D. Enterprise-Verwaltung & SIEM | Erweiterung | **P3** | **L** | ✋ Enterprise-Cloud/SIEM-Zielsysteme |

---

## 5. Entwicklungs-Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ENTWICKLUNGS-ROADMAP                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Kernstabilität, Krypto-MIME & Speicheridentität (Sofort lokal ausführbar)     │
│   • AVN-003: Absicherung unvollständiger S/MIME- & PGP-Hüllen mit transparenter UI     │
│   • AVN-009: Konservative Vorkommensidentität bei Ordnerwechseln & IMAP-Lifecycle       │
│   • Verifikation des API-Debugmodus 1.25.7 vor offizieller Release-Erstellung          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Code-Wartbarkeit & Desktop-Handoff (Mittelfristig / Größtenteils lokal)       │
│   • AVN-020: Modulare Entflechtung von background.js in spezialisierte Services        │
│   • AVN-021: Standardbrowser-Handoff auf Desktop-Sitzungen (Wayland/X11) validieren    │
│   • Pflege des internen Linter- und Pre-Submit-Prüfvertrags                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Externe Validierung, Barrierefreiheit & Plattformreife (Später / Abhängig)   │
│   • AVN-006: Reale Screenreader-Validierung (NVDA, VoiceOver, Orca) ✋                 │
│   • AVN-004: Live-Validierung externer Provider unter Last mit echten Kontingenten ✋   │
│   • AVN-022: Native Thunderbird-Testrunner für Windows 11 und macOS Sequoia ✋         │
│   • AVN-015: ATN-Store-Einreichung, automatisierte Signierung & Rollback-Audit ✋      │
│   • AVN-005: Heuristik-Benchmarking gegen tagesaktuelle Phishing-Feeds                 │
│   • AVN-012: Enterprise Cloud- und SIEM-Konnektoren für Großorganisationen ✋          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Die drei sinnvollsten nächsten Arbeitspakete mit Begründung

### 1. AVN-003 — Absicherung von S/MIME- und PGP-Nachrichten (Priorität P1, Aufwand M)
**Begründung:**
Endanwender in sicherheitskritischen Umgebungen nutzen zunehmend signierte oder verschlüsselte E-Mails. Wenn Thundy AV bei noch nicht entschlüsselten Inhalten generische Lesefehler anzeigt oder eine Prüfung als vollständig vorgaukelt, führt dies zu Verunsicherung und Vertrauensverlust. Eine gezielte Erkennung kryptografischer MIME-Hüllen (`application/pkcs7-mime`) mit transparenter Statusmeldung in allen 6 Sprachen stellt einen unmittelbaren Schutz- und Informationsgewinn für Anwender dar und kann vollständig mit lokalen Test-Fixtures umgesetzt werden.

### 2. AVN-009 — Konservative Speicheridentität und IMAP-Lebenszyklus (Priorität P1, Aufwand M)
**Begründung:**
Die Zuordnung von Analysebefunden und Audit-Einträgen darf bei Ordnerverschiebungen, Archivierungen oder Mailbox-Komprimierungen nicht verloren gehen oder fremden Nachrichten zugeordnet werden. Da das MailExtension-Recht `accountsRead` im Produkt fehlt, muss die in `IDENTITAETSVERTRAG_2026_11_10.md` beschriebene konservative Bindung implementiert werden, um Verwechslungen im Audit-Log zuverlässig auszuschließen.

### 3. AVN-020 — Modulare Entflechtung von `background.js` (Priorität P2, Aufwand M)
**Begründung:**
`background.js` ist das zentrale Nervenzentrum der Thunderbird MailExtension, bündelt derzeit jedoch über 1.200 Zeilen getrennte Verantwortlichkeiten (Klickinterzeption, Speichereviction, Menüsteuerung, Nachrichtenprüfung). Eine saubere Zerlegung in spezialisierte Submodule minimiert das Risiko von Regressionen bei zukünftigen Erweiterungen, erleichtert die Code-Review-Prüfung und erhöht die architektonische Wartbarkeit erheblich.

---

## 7. Zusammenfassende Handlungsempfehlung

### Sofort mit vorhandenen Mitteln ausführbar (Lokal)
1. **AVN-003 (Krypto-MIME):** Differenzierte Statusanzeige für verschlüsselte EMLs mit lokalen Fixtures.
2. **AVN-009 (Identität/Lifecycle):** Konservative Vorkommensbindung in `db.js` auf Basis des Inhalts-Hashs.
3. **AVN-020 (Modularisierung):** Strukturierte Aufteilung von `background.js` in eigenständige Module mit Registrierung in `manifest.json`.
4. **AVN-021 (Desktop-Handoff):** Durchführung manueller Browser-Öffnungstests in realen Desktop-Sitzungen.

### Erfordert konkrete zusätzliche Voraussetzungen (Blockiert ✋)
1. **ATN-Store-Signierung & Rollback (AVN-015):** Benötigt offizielle API-Keys für addons.thunderbird.net zur automatisierten Signierung.
2. **Reale Plattform-Runner (AVN-022):** Benötigt Zugriff auf Windows-11- und macOS-Maschinen mit installierten Thunderbird-Releases.
3. **Screenreader-Zertifizierung (AVN-006):** Benötigt Testplätze mit NVDA, VoiceOver und geschulten Testern.
4. **Live-Provider-Abnahme (AVN-004):** Benötigt aktive API-Abonnements bei VirusTotal, Hybrid Analysis und urlscan.io.
5. **Enterprise-Cloudanbindung (AVN-012):** Benötigt Mandanten-Zugänge zu Cloud-Infrastrukturen (AWS, Azure, SIEM).
