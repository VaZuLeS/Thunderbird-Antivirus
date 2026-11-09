# Thundy AV — Produktarchitektur, Bestandsaufnahme und dynamischer Aufgabenplan

**Rolle:** Technischer Produktarchitekt und erfahrener Thunderbird-Extension-Entwickler
**Projekt:** Thundy AV — MailExtension für Mozilla Thunderbird (Manifest V3)
**Bezug:** Stand Version **1.25.3** (Commit `92b4bad`, 537 Dateien)
**Datum:** 09. November 2026
**Status:** Verbindliche architektonische Gesamtanalyse und evidenzbasierter Entwicklungsplan

---

## 1. Tatsächlicher Stand (Evidenzbasierte Bestandsaufnahme)

### 1.1 Quellenstand, Arbeitsbaum und Veröffentlichungsebenen

Zur Vermeidung von Fehlannahmen wird strikt zwischen dem lokalen Arbeitsbaum, verifizierten Release-Tags, CI-Abnahmeartefakten und tatsächlich veröffentlichten Binärpaketen unterschieden:

| Ebene | Tatsächlicher Zustand | Beleg / Evidenz / Prüfgrenze |
| :--- | :--- | :--- |
| **Branch / Arbeitsbaum** | `main` (Basis `92b4bad`) | Vollständig synchrone Paketdeklaration (`1.25.3`) in `package.json` und `manifest.json`. |
| **Git-Tag & Releases** | `v1.25.3` (Commit `b006366a...`) | [Release Notes 1.25.3](releases/1.25.3.md), [Veröffentlichungsnachweis](VEROEFFENTLICHUNG_1_25_3.md). Vorgänger `1.25.2`, `1.25.1`, `1.25.0` und `1.24.8` bleiben historisch unverändert erhalten. |
| **Veröffentlichtes XPI-Paket** | GitHub Release **1.25.3** (356.500 Bytes) | SHA-256: `d29233c452b770a9f20801b3c77e3319bff2d42d53caa5505875ffc600377022`. Keine ATN-Signierung (Mozilla Add-ons) oder automatische Updateverteilung. |
| **Laufzeit-Architektur** | 3 getrennte Runtimes | 1. **Thunderbird MailExtension** (`manifest.json`, MV3-Hintergrundskripte, `popup.html`, `options.html`, IndexedDB `hybridanalysis`).<br>2. **Offline-Enterprise-Kern** (`enterprise/*.cjs`, CLI, isoliertes Ledger/Outbox/Storage).<br>3. **Web-Demo** (`src/App.tsx`, `npm run dev`, reine In-Browser-Simulation mit `SIMULATED_OPEN`/`SIMULATED_ABORT`, strikt aus XPI ausgeschlossen). |
| **Automatisierte Testsuite** | **1.226 Tests in 75 Suiten** | Node.js Test-Runner via `npm test`. Hinweis: Nach dem Dependabot-Upgrade auf `jsdom@31.0.0` feuert JSDOM native `DOMContentLoaded`-Events früher, wodurch synthetische Testfixture-Dispatches in `test/onboarding.test.js` doppelt ausgeführt werden. Dies ist ein Testfixture-Artefakt, kein Add-on-Laufzeitfehler. |
| **Linter & Prüfvertrag** | **0 Fehler, 39 kuratierte Warnungen** | `npm run lint:filtered` via `scripts/lint-with-filter.js`. Alle 39 Warnungen sind nachgewiesene Thunderbird-spezifische MailExtension-Berechtigungen (`messagesRead`, `menus`, `theme`, downloads). |
| **Store-Readiness-Gate** | C1 bis C5 PASS, C6/C7 paketgebunden | `node scripts/submission-gate.js`. Paket-Integrität und Dateiausschlussliste werden über `scripts/verify-package.js` (max. 47 erlaubte XPI-Dateien) erzwungen. |
| **Dokumentation & Pages** | Jekyll-Quellen unter `docs/` | `npm run check:docs` validiert alle relativen Links, Permalinks und Versionsreferenzen. |

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
| **Mehrsprachigkeit (6 Sprachen)** | **[N]** | `_locales/*/messages.json`: Vollständige Parität für EN, DE, FR, ES, IT, PL. Dynamischer Fallback in `i18n.js`. Verifiziert über `scripts/generate-i18n-fallback.js --check` und `test/i18n.test.js`. |
| **Theming & Designsystem** | **[N]** | `theme.js`, `theme.css`, `design_system.js`, `design.css`: Erkennung nativer Thunderbird-Farben (Hell/Dunkel), Dichte (`compact`, `normal`, `touch`), Kontraste, Tastaturbedienung. |
| **urlscan-Aktionskontingente (1.25.3)** | **[N]** | `providers.js`, `provider_contracts.js`, `analysis_status.js`: Differenzierte Behandlung von Submission-, Result- und Search-Quotas. Keine doppelten POSTs, Headerauswertung für Resets (`URLSCAN_KONTINGENTE.md`). |
| **Dauerhafte Vorkommensidentität (AVN-009)** | **[N]** | `db.js`: `deriveMessageContentKey` und `resolveMessageStorageKey` lösen Bindungsprobleme bei Ordnerwechseln durch kanonische Inhalts-Hashes. |
| **Lokale Schutzprofile & Diff (AVN-010)** | **[N]** | `options.js`: `LocalProtectionProfile` mit Pflicht-Differenzdialog vor Übernahme (`docs/schemas/local-protection-profile-v1.json`). |
| **Heuristik-Benchmarking (AVN-005)** | **[N]** | `testdata/risk-behavior.json`, `tools/risk-corpus.dev.cjs`: Testkorpus mit 8 verifizierten Grenzfällen. |
| **Offline-Enterprise-Vertragskern** | **[N]** | 30 Module in `enterprise/`: Ledger, Outbox, Storage-Jobs, Policy-Simulation lokal mit 100% Testabdeckung. |
| **Desktop-Browser-Handoff (OS-Integration)** | **[U]** | `windows.openDefaultBrowser` funktioniert im Xvfb/Linux-Test runner. Reale Übergabe an installierte Standardbrowser (Firefox, Chrome, Edge) auf Standard-Desktops ist nicht empirisch abgesichert. |
| **Screenreader & Assistenzsysteme** | **[U]** | Synthetische ARIA-Prüfung via `@axe-core/playwright` (`tools/browser-ui.dev.cjs`). Reale Tests mit NVDA, JAWS, VoiceOver oder Orca stehen aus. |
| **MIME/Unicode-Grenzfälle & Krypto-Mails** | **[U]** | UTF-8/QP-Nachrichten in `UNICODE_NACHRICHTENEINGANG.md` geprüft. S/MIME, PGP-verschlüsselte Mails und defekte Content-Type-Header sind unzureichend untersucht. |
| **Heuristik-Güte gegen Live-Feeds** | **[U]** | `risk.js` basiert auf statischen Pattern. Ein statistisch messbarer Benchmark gegen tagesaktuelle Phishing- und Benign-Feeds (Precision/Recall) fehlt. |
| **Externe Live-Provider-Validierung** | **[T]** | Adapter in `providers.js` laufen in Tests ausschließlich gegen synthetische HTTP-Mocks. Reale Kontingente, Latenzen und Auth-Fehler unter Last sind ungeprüft. |
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
│    └── Externe Analyseprovider & Kontingentsteuerung (providers.js, api_gateway.js)    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ B. Bedienung, Barrierefreiheit & Designsystem                                          │
│    ├── Einheitliches Theming, Kontraste & Dichte (theme.js, theme.css, design.css)     │
│    ├── Status- & Kontingentkarten (analysis_status.js, api.js)                         │
│    ├── Barrierefreiheit & Screenreader-Führung (ARIA-Live, Fokus-Fallen, Rollen)       │
│    └── Mehrsprachigkeit & Fallback-Integrität (6 Sprachen, i18n.js, _locales/)         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ C. Einrichtung, Schutzrichtlinien & Konfiguration                                      │
│    ├── Onboarding-Assistent & Ersteinrichtung (onboarding.js, onboarding.html)         │
│    ├── Schutzprofile mit Differenzvorschau (options.js, enterprise_profiles.js)        │
│    └── Berechtigungs-, Datenschutz- und Opt-in-Modell (scan_policy.js)                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ D. Datenlebenszyklus, Speicher & Identität                                             │
│    ├── Temporärer Kontextcache & TTL-Eviction (background.js, ContextCache)            │
│    ├── Permanenter Audit- & Befundspeicher (db.js, IndexedDB, Begrenzungen)            │
│    └── Dauerhafte Inhalts-/Vorkommensbindung (deriveMessageContentKey)                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ E. Architektur, Testinfrastruktur & Wartbarkeit                                        │
│    ├── Service-Modularisierung (Entflechtung background.js)                            │
│    ├── Test-Harness & DOM-Fixture-Stabilität (jsdom 31 vs. DOMContentLoaded)           │
│    └── Toolchain, Advisories & Linting (scripts/lint-with-filter.js, package.json)     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ F. Plattformkompatibilität, Distribution & Release                                     │
│    ├── OS-Matrix (Linux X11/Wayland, Windows 11, macOS Sequoia)                        │
│    ├── ATN-Signierung & Store-Readiness (submission-gate.js, manifest.json)            │
│    └── Update-Integrität, Rollback-Sicherheit & Paket-Determinisierung                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Priorisierter evidenzbasierter Aufgabenplan

### AVN-019: Test-Harness-Stabilisierung für JSDOM 31.0.0
- **Themenbereich:** E. Architektur, Testinfrastruktur & Wartbarkeit
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** In `test/onboarding.test.js` (Zeilen 78–82) wird nach JSDOM-Initialisierung manuell `dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"))` ausgelöst. Seit dem Upgrade auf `jsdom@31.0.0` (PR #758, Commit `92b4bad`) feuert JSDOM dieses Event während des Parsens selbstständig, wodurch der Listener in `onboarding.js` doppelt ausgeführt wird und Schreibzähler (`writes.length`) 2 statt 1 ergeben.
- **Gewünschtes Ergebnis & Nutzwert:** Saubere Trennung der Lebenszyklus-Events im Testfixture. `npm test` schließt wieder zu 100% (1.226/1.226 Tests) erfolgreich ab, wodurch die CI-Regression uneingeschränkt verlässlich bleibt.
- **Abgegrenzter Umfang:** Bereinigung des Event-Dispatchings in `test/onboarding.test.js`; Prüfung weiterer UI-Tests auf identische Event-Verhaltensweisen. Keine Änderung an produktiver Add-on-Laufzeit.
- **Priorität & Aufwand:** Priorität **P1**, Aufwand **S**.
- **Abhängigkeiten / Blocker:** Keine; rein lokal im Testcode ausführbar.
- **Akzeptanzkriterien:**
  1. `npm test test/onboarding.test.js` besteht mit 0 Fehlern in allen 6 Sprachen.
  2. Die gesamte Testsuite `npm test` läuft mit 0 Fehlern durch.
- **Validierung:** Lokale Ausführung von `npm test test/onboarding.test.js` und `npm test`.

### AVN-020: Entflechtung und Modularisierung von background.js
- **Themenbereich:** E. Architektur, Testinfrastruktur & Wartbarkeit
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** `background.js` umfasst über 1.200 Zeilen und bündelt Time-of-Click-Interzeption, Tab-Management, Menü-Handler, Speichereviction, Scan-Scheduling und IPC-Nachrichten-Routing in einem monolithischen Skript. Dies erhöht das Risiko von Nebeneffekten bei Funktionsänderungen.
- **Gewünschtes Ergebnis & Nutzwert:** Klare Service-Architektur mit separaten Modulen (`link_interceptor.js`, `context_manager.js`, `menu_controller.js`), die in `manifest.json` deklarativ geladen werden. Erleichtert isolierte Unit-Tests und reduziert Wartungskosten.
- **Abgegrenzter Umfang:** Refactoring von `background.js` in 3 fokussierte Submodule; Anpassung der Skriptliste in `manifest.json` und `scripts/verify-package.js`.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Vorheriger Abschluss von AVN-019 zur Regressionssicherung.
- **Akzeptanzkriterien:**
  1. `manifest.json` lädt die neuen Submodule ohne zirkuläre Abhängigkeiten.
  2. Alle 1.226 Tests und `npm run check:source` bestehen unverändert.
  3. `scripts/verify-package.js` erlaubt die neuen Dateinamen im Build.
- **Validierung:** `npm run check` und native Linux-Prüfung `tools/thunderbird-live.dev.py`.

### AVN-021: Absicherung von S/MIME, PGP und komplexen MIME-Grenzfällen
- **Themenbereich:** A. Schutzwirkung, Analysequalität & Linkentscheidungen
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** `message_ui.js` und `runtime.js` extrahieren Nachrichtentexte und Anhänge. Für S/MIME- und PGP-verschlüsselte Nachrichten liefert die Thunderbird-API unvollständige MIME-Teile, wenn die Entschlüsselung im Client noch nicht erfolgt ist (`UNICODE_NACHRICHTENEINGANG.md`). Aktuell wird dies als regulärer Lesefehler interpretiert.
- **Gewünschtes Ergebnis & Nutzwert:** Erkennung verschlüsselter MIME-Hüllen (`multipart/encrypted`, `application/pkcs7-mime`). Differenzierte Statusanzeige („Verschlüsselte Nachricht – lokale Heuristik erst nach Entschlüsselung möglich“) in allen 6 Sprachen statt irreführender Analyse- oder Lesefehler.
- **Abgegrenzter Umfang:** MIME-Typerkennung in `risk.js`/`message_ui.js`; Lokalisierungs-Keys in `_locales/*/messages.json`.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** Lokale Bereitstellung synthetischer EML-Testfälle (`testdata/encrypted-mime.eml`).
- **Akzeptanzkriterien:**
  1. EML mit `multipart/encrypted` erzeugt expliziten Hinweistext im Message-Header.
  2. Kein falscher Malware- oder Phishing-Verdacht aufgrund fehlender Textteile.
  3. Vollständige Übersetzung in EN, DE, FR, ES, IT, PL.
- **Validierung:** `test/analysis-sources.test.js` und `tools/validate-eml.dev.py`.

### AVN-022: Live-Validierung externer Provider-Kontingente und Failover
- **Themenbereich:** A. Schutzwirkung, Analysequalität & Linkentscheidungen
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** Die Kontingent- und Fehlerbehandlung (`URLSCAN_KONTINGENTE.md`, `providers.js`) wurde ausschließlich mit synthetischen Mocks verifiziert (`test/provider-contracts.test.js`). Echte HTTP-429-Antworten und Netzwerk-Timeouts unter Last verhalten sich bei realen Anbietern oft abweichend.
- **Gewünschtes Ergebnis & Nutzwert:** Nachweis der Resilienz gegen echte API-Antworten; kein Einfrieren der UI bei langsamen Providern; verlässliche Einbeziehung lokaler Fallbacks.
- **Abgegrenzter Umfang:** Erweiterung von `tools/vt-probe.dev.js` um konfigurierbare Test-Endpunkte für Hybrid Analysis, VirusTotal, AbuseIPDB und urlscan.io mit echten (Test-)Schlüsseln.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Bereitstellung von Entwickler-API-Keys und Kontingenten für die externen Dienste.
- **Akzeptanzkriterien:**
  1. Bei Kontingenterschöpfung schaltet die UI unmittelbar auf lokale Heuristik um.
  2. Keine unkontrollierten Retry-Schleifen bei 429/503.
- **Validierung:** Manuelle Probe mit Test-Credentials über `tools/vt-probe.dev.js`.

### AVN-023: Desktop-Handoff- und Standardbrowser-Validierung
- **Themenbereich:** F. Plattformkompatibilität, Distribution & Release
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** `link_audit.js` verwendet `windows.openDefaultBrowser`. Dies ist im virtuellen Framebuffer (Xvfb) getestet, jedoch fehlt der Nachweis des tatsächlichen Prozessstarts auf Desktop-Umgebungen mit Standardbrowsern (Firefox ESR, Google Chrome, Microsoft Edge).
- **Gewünschtes Ergebnis & Nutzwert:** Nachweis, dass `OPENED` verlässlich den Start des Systembrowsers triggert und keine Popup-Blocker oder Sandboxing-Einschränkungen der OS-Shell die Übergabe verhindern.
- **Abgegrenzter Umfang:** Erstellung eines Testleitfadens für manuelle Desktop-Prüfungen unter Linux (GNOME/KDE), Windows und macOS.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **S**.
- **Abhängigkeiten / Blocker:** Physische oder virtualisierte Testarbeitsplätze mit Desktop-Sitzungen.
- **Akzeptanzkriterien:**
  1. Verifizierter Start des registrierten Standardbrowsers unter Linux X11 und Wayland.
  2. Dokumentierte Bestätigung in `docs/audits/desktop-handoff-abnahme.json`.
- **Validierung:** Manuelle Abnahme gemäß standardisiertem Klick-Protokoll.

### AVN-024: Screenreader- und Tastaturabnahme (NVDA / VoiceOver / Orca)
- **Themenbereich:** B. Bedienung, Barrierefreiheit & Designsystem
- **Entwicklungstyp:** Verbesserung
- **Befund mit Beleg:** Die Barrierefreiheit wird derzeit synthetisch via Playwright und `axe-core` geprüft. Reale Screenreader-Nutzer sind auf korrekte Ansage von ARIA-Live-Regionen bei dynamischen Sicherheitswarnungen angewiesen (`onboarding.html`, `options.html`, `popup.html`).
- **Gewünschtes Ergebnis & Nutzwert:** Lückenlose Bedienbarkeit für sehbehinderte Anwender. Verlässliche akustische Ausgabe von Risiko-Scores, Blockierungsentscheidungen und Bestätigungsdialogen.
- **Abgegrenzter Umfang:** Prüfung und Optimierung aller interaktiven Elemente auf Fokus-Management, Tastatur-Traps und Screenreader-Ansagen.
- **Priorität & Aufwand:** Priorität **P2**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Testumgebungen mit installierten Screenreadern (NVDA unter Windows, VoiceOver unter macOS, Orca unter Linux).
- **Akzeptanzkriterien:**
  1. Warnhinweise in `message_ui.js` werden von Screenreadern sofort unterbrechungsfrei vorgelesen.
  2. Vollständige Tastaturbedienbarkeit ohne Maus in allen Dialogen.
- **Validierung:** Strukturierter Testbericht unter `docs/audits/screenreader-abnahme.md`.

### AVN-025: Native Plattformabnahme für Windows 11 und macOS
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

### AVN-026: ATN-Store-Signierung, Update-Verteilung & Rollback-Schutz
- **Themenbereich:** F. Plattformkompatibilität, Distribution & Release
- **Entwicklungstyp:** Erweiterung
- **Befund mit Beleg:** Bisherige Releases (inkl. 1.25.3) sind unsigned GitHub-Distributionen. Endanwender müssen Entwickleroptionen nutzen oder Warnungen bei manueller XPI-Installation bestätigen. Ein automatisierter Updatetest mit anschließendem Rollback existiert nicht.
- **Gewünschtes Ergebnis & Nutzwert:** Offizielle Listung auf addons.thunderbird.net (ATN) mit automatischer Updateversorgung. Nachweis, dass Upgrades bestehende Einstellungen und historische Audit-Daten migrieren und bei inkompatiblen Schemaversionen sicher degradieren.
- **Abgegrenzter Umfang:** Einrichtung der ATN-API-Verbindung in GitHub Actions (`.github/workflows/release.yml`); Rollback- und Migrationsprüfung für IndexedDB.
- **Priorität & Aufwand:** Priorität **P3**, Aufwand **M**.
- **Abhängigkeiten / Blocker:** **✋ Blocker:** Bereitstellung von Mozilla AMO/ATN-API-Credentials durch den Maintainer.
- **Akzeptanzkriterien:**
  1. Automatisierte Signierung über `web-ext sign`.
  2. Migrationssicherheit alter Datenbankstände (`hybridanalysis`) ohne Datenverlust verifiziert.
- **Validierung:** `scripts/submission-gate.js` mit aktivem Kriterium C7.

### AVN-027: Enterprise SIEM-Export & Cloud-Speicheranbindung
- **Themenbereich:** D. Einrichtung, Schutzrichtlinien & Konfiguration
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

### AVN-028: Heuristik-Qualitätsbenchmark gegen Live-Feeds
- **Themenbereich:** A. Schutzwirkung, Analysequalität & Linkentscheidungen
- **Entwicklungstyp:** Optimierung
- **Befund mit Beleg:** Die Regeln in `risk.js` werden aktuell gegen 8 statische Fälle in `testdata/risk-behavior.json` getestet. Ein empirischer Nachweis der Erkennungsrate gegen reale, frische Phishing-Kampagnen fehlt.
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
| **AVN-019** | E. Architektur & Testinfrastruktur | Optimierung | **P1** | **S** | Keine (sofort lokal ausführbar) |
| **AVN-020** | E. Architektur & Testinfrastruktur | Optimierung | **P2** | **M** | AVN-019 abgeschlossen |
| **AVN-021** | A. Schutzwirkung & Analysequalität | Optimierung | **P2** | **M** | Keine (synthetische EML-Fixtures) |
| **AVN-023** | F. Plattformkompatibilität & OS | Verbesserung | **P2** | **S** | Physische/VM-Desktop-Sitzungen |
| **AVN-024** | B. Barrierefreiheit & Designsystem | Verbesserung | **P2** | **M** | ✋ Screenreader-Testplätze |
| **AVN-022** | A. Schutzwirkung & Provider | Optimierung | **P2** | **M** | ✋ Reale Provider-API-Keys |
| **AVN-025** | F. Plattformkompatibilität & OS | Verbesserung | **P2** | **L** | ✋ Reale Windows-/macOS-Runner |
| **AVN-026** | F. Distribution, Signierung & Rollback | Erweiterung | **P3** | **M** | ✋ AMO/ATN-Maintainer-Credentials |
| **AVN-028** | A. Schutzwirkung & Heuristik | Optimierung | **P3** | **M** | Phishing-/Benign-Korpora |
| **AVN-027** | D. Enterprise-Verwaltung & SIEM | Erweiterung | **P3** | **L** | ✋ Enterprise-Cloud/SIEM-Zielsysteme |

---

## 5. Entwicklungs-Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ENTWICKLUNGS-ROADMAP                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Unmittelbare Stabilität & Testfixture-Bereinigung (Sofort lokal ausführbar)   │
│   • AVN-019: Bereinigung des DOMContentLoaded-Dispatchings in test/onboarding.test.js   │
│   • Wiederherstellung von 100% grünen Tests (1.226/1.226) nach jsdom 31 Upgrade        │
│   • Verifikation aller Dokumentations- und Release-Links via check:docs                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Code-Wartbarkeit & Heuristik-Vertiefung (Mittelfristig / Größtenteils lokal) │
│   • AVN-020: Modulare Entflechtung von background.js in Service-Komponenten            │
│   • AVN-021: Differenzierte Erkennung und Anzeige verschlüsselter S/MIME & PGP-Mails   │
│   • AVN-023: Standardbrowser-Handoff auf Desktop-Sitzungen validieren                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Externe Validierung, Barrierefreiheit & Plattformreife (Später / Abhängig)   │
│   • AVN-024: Reale Screenreader-Validierung (NVDA, VoiceOver, Orca) ✋                 │
│   • AVN-022: Live-Validierung externer Provider unter Last mit echten Kontingenten ✋   │
│   • AVN-025: Native Thunderbird-Testrunner für Windows 11 und macOS Sequoia ✋         │
│   • AVN-026: ATN-Store-Einreichung, automatisierte Signierung & Rollback-Audit ✋      │
│   • AVN-028: Heuristik-Benchmarking gegen tagesaktuelle Phishing-Feeds                 │
│   • AVN-027: Enterprise Cloud- und SIEM-Konnektoren für Großorganisationen ✋          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Die drei sinnvollsten nächsten Arbeitspakete mit Begründung

### 1. AVN-019 — Test-Harness-Stabilisierung für JSDOM 31.0.0 (Priorität P1, Aufwand S)
**Begründung:**
Die Aktualisierung von `jsdom` auf Version 31.0.0 (PR #758) führte zu einer Verhaltensänderung beim Parsen von HTML-Dokumenten im Node-Testrunner: `DOMContentLoaded` wird nun automatisch intern ausgelöst. Die synthetischen Dispatches in `test/onboarding.test.js` führen zu doppelten Event-Ausführungen und 7 fehlgeschlagenen Assertions. Ohne Behebung dieser Testdiskrepanz ist die automatisierte Regressionserkennung für Onboarding- und UI-Flows kompromittiert. Diese Korrektur ist mit vorhandenen Mitteln sofort lokal umsetzbar, verändert keinen Produktionscode und stellt die vollständige Test-Grünphase wieder her.

### 2. AVN-020 — Modulare Entflechtung von `background.js` (Priorität P2, Aufwand M)
**Begründung:**
`background.js` ist das zentrale Nervenzentrum der Thunderbird MailExtension, vereint derzeit jedoch zu viele getrennte Verantwortlichkeiten (Klickinterzeption, Speichereviction, Menüsteuerung, Nachrichtenprüfung). Eine saubere Zerlegung in spezialisierte Submodule (z. B. Interceptor, CacheManager, UIController) minimiert das Risiko von Regressionen bei zukünftigen Features, erleichtert die Code-Review-Prüfung und erhöht die architektonische Wartbarkeit erheblich.

### 3. AVN-021 — Differenzierte Erkennung von S/MIME- und PGP-Nachrichten (Priorität P2, Aufwand M)
**Begründung:**
Endanwender in sicherheitskritischen Umgebungen nutzen zunehmend signierte oder verschlüsselte E-Mails. Wenn Thundy AV bei noch nicht entschlüsselten Inhalten generische Lesefehler anzeigt, führt dies zu Verunsicherung und Vertrauensverlust. Eine gezielte Erkennung kryptografischer MIME-Hüllen mit transparenter Statusmeldung in allen 6 Sprachen stellt einen unmittelbaren UX- und Informationsgewinn für Anwender dar und kann vollständig mit lokalen Test-EMLs realisiert werden.

---

## 7. Zusammenfassende Handlungsempfehlung

### Sofort mit vorhandenen Mitteln ausführbar (Lokal)
1. **AVN-019 (Test-Harness):** Anpassen der Fixture in `test/onboarding.test.js` an das neue JSDOM-31-Verhalten.
2. **AVN-020 (Modularisierung):** Strukturierte Aufteilung von `background.js` in eigenständige Module mit Registrierung in `manifest.json`.
3. **AVN-021 (MIME-Grenzfälle):** Integration der S/MIME- und PGP-Statusanzeigen mit Test-Fixtures.
4. **AVN-023 (Desktop-Handoff):** Durchführung manueller Browser-Öffnungstests in realen Desktop-Sitzungen.

### Erfordert konkrete zusätzliche Voraussetzungen (Blockiert ✋)
1. **ATN-Store-Signierung & Rollback (AVN-026):** Benötigt offizielle API-Keys für addons.thunderbird.net zur automatisierten Signierung.
2. **Reale Plattform-Runner (AVN-025):** Benötigt Zugriff auf Windows-11- und macOS-Maschinen mit installierten Thunderbird-Releases.
3. **Screenreader-Zertifizierung (AVN-024):** Benötigt Testplätze mit NVDA, VoiceOver und geschulten Testern.
4. **Live-Provider-Abnahme (AVN-022):** Benötigt aktive API-Abonnements bei VirusTotal, Hybrid Analysis und urlscan.io.
5. **Enterprise-Cloudanbindung (AVN-027):** Benötigt Mandanten-Zugänge zu Cloud-Infrastrukturen (AWS, Azure, SIEM).
