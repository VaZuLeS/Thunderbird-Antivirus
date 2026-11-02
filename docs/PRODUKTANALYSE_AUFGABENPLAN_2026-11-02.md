# Thundy AV: Bestandsaufnahme und priorisierter Entwicklungsplan

Stand: 2. November 2026. Dieser Bericht plant Arbeiten; er ändert keine Produktfunktion und erteilt keine Releasefreigabe.

## 1. Quellenstand und Vorgehen

Untersuchtes Repository: [VaZuLeS/Thunderbird-Antivirus](https://github.com/VaZuLeS/Thunderbird-Antivirus). Checkout-Branch `work`, Commit `6046fe0427f53e12377c167e98385e57f533c790`; nach `git fetch origin main --tags` identisch mit `origin/main`. Der Arbeitsbaum war zu Beginn sauber. Offene Pull Requests sind Vorschläge und zählen nicht als implementierter Stand von main.

Die separate Datei [PROMPT_PRODUKTANALYSE_THUNDERBIRD.md](PROMPT_PRODUKTANALYSE_THUNDERBIRD.md) schärft den Ausgangsprompt für MailExtensions: API-/Manifest-Reichweite, Hintergrund-Lebenszyklus, echte Nachrichtenansichten, Freigaben und Widerruf, Paketgrenzen, Quellenprovenienz und reale Distribution. Sie verhindert insbesondere die Gleichsetzung von Webdemo und Add-on sowie von altem Testbericht und aktueller Abnahme.

Evidenzstufen: **aktuell reproduziert**, **direkt im Code belegt**, **historisch im Repository dokumentiert**, **Hypothese/untersuchen**, **nicht zugänglich**. Ein historischer erfolgreicher Lauf wird nur für sein damaliges Paket und seine Umgebung gewertet.

### Aktuelle Prüfungen und Grenzen

Umgebung: Linux, Node.js `24.19.0`; aktive CI nutzt Node 22. Vorhandene node_modules sind älter als die deklarierten Abhängigkeiten: installiertes Vite `6.4.4`, tldts `7.4.10`; package.json verlangt Vite `^8.3.5` und tldts `7.4.19`.

| Prüfung | Ergebnis und Aussagegrenze |
| --- | --- |
| Remote-Abgleich und Release-API | main-SHA bestätigt; neuester veröffentlichter GitHub-Release **1.24.2**, 17. Oktober 2026. Checkout deklariert **1.23.0**. |
| `npm ci` | **Fehler ERESOLVE**: `@vitejs/plugin-react@4.7.0` unterstützt Vite 4–7, aufgelöst wird Vite 8.3.5. Keine erfolgreiche reproduzierbare Neuinstallation. Kein Umgehen mit `--force`/`--legacy-peer-deps`. |
| `npm run check` | Pre-submit und i18n-Fallback erfolgreich; Abbruch bei `check:vendor`, weil installiertes tldts nicht dem Pin entspricht. Nachfolgende Schritte dadurch nicht ausgeführt. |
| `npm run check:design` separat | Erfolgreich: generierte CSS-Dateien und Designreferenz entsprechen ihren Quellen. Keine visuelle oder Screenreader-Abnahme. |
| `npm run lint:filtered` separat | 0 Fehler, 24 kuratierte Thunderbird-Warnungen. Ausführung mit Bestandsmodulen; keine allgemeine Thunderbird-Kompatibilitätsgarantie. |
| `npm run package` separat | Paketinhalt gültig, 44 Dateien, 775.058 Bytes entpackt. Version 1.23.0; React und Node-Enterprise nicht enthalten. Kein Releasekandidat bei roter reproduzierbarer Gesamtprüfung. |
| `node scripts/submission-gate.js --no-commands` | C1–C4 **übersprungen**, C5/C6 PASS anhand vorhandener Dateien, C7 **FAIL**. Das ist kein vollständiger Gate-Lauf. |
| `npm test` mit Bestandsmodulen | **953 bestanden, 0 fehlgeschlagen**, 73 Suiten, 104,8 Sekunden. Auch dieser erfolgreiche Lauf ersetzt `npm ci` nicht. |
| Browser-UI-Smoke | **34 bestanden, 0 fehlgeschlagen**, EN/DE mit System-Chromium und API-Testdoubles. Kein Thunderbird-/OS-Test und keine vollständige Sprach-/Layoutmatrix. |
| Aktuelle reale Thunderbird-Abnahme | In dieser Analyse nicht ausgeführt; kein Thunderbird-/Xvfb-Binary im PATH. Repository-Nachweise werden unten mit ihren Grenzen bewertet. |

Das [Prüfprotokoll](audits/produktanalyse-2026-11-02.md) hält Befehle, Ergebnisse und Grenzen fest.

Der [CI-Lauf für den untersuchten main-Commit](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41166499534) ist fehlgeschlagen: Testjob und alle sechs Browserjobs scheitern an der Abhängigkeitsinstallation; Thunderbird-Linux-Job wird übersprungen. Der heruntergeladene Log des Testjobs bestätigt denselben Vite-Peer-Konflikt. Grüne ältere Läufe gelten daher nicht als aktuelle Freigabe.

### Veröffentlichung, Entwicklung und Website

- [Release 1.24.2](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.2) ist laut GitHub-API veröffentlicht, kein Entwurf/Prerelease. Asset `thundy-av-1.24.2.xpi`; API-Digest `sha256:f7376f3c97e89d878eed25bb6737928a3e789829c7cd4b450ae6db49056267a9`. Der Digest ist hier Metadatenbefund, keine neu durchgeführte binäre Download-/Signaturprüfung. Zwei alte Entwürfe sind keine veröffentlichten Releases.
- Release-Tag `v1.24.2` zeigt auf `26fb960`; `git diff v1.24.2..HEAD` belegt funktionale Unterschiede. In main fehlen unter anderem gespeicherte fertige Hybrid-Analysis-Berichte, begrenztes Report-Polling, Protokollmetadaten, Gateway-Key-Verdrahtung und der API-Key beim urlscan-Ergebnisabruf. **Das Fehlen ist bewiesen; konkrete Auswirkungen in Thunderbird/bei den aktuellen Providern müssen validiert werden.** Eine Absicht hinter diesen Unterschieden ist nicht belegt.
- Das aktuelle Paket ist damit weder identisch mit 1.23.0 noch mit 1.24.2 und darf nicht nur durch erneutes Setzen eines alten Tags legitimiert werden.
- Aktive Workflows stehen unter `.github/workflows/`. `docs/ci/` enthält abweichende Vorlagen: Der aktive Releaseworkflow veröffentlicht unsignierte GitHub-XPIs, signiert nicht bei ATN und nutzt `gh release create`. Die dort dokumentierte Idempotenz und das vorgeschaltete `goal` sind im aktiven Workflow nicht vorhanden.
- GitHub Pages baut Jekyll aus `docs/`, nicht die React-Anwendung aus `src/`. Der [letzte hier verifizierte Pages-Lauf](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41166449443) war erfolgreich, Commit `0599c6a9a77df12d62d516d4431d10accfc02640`. Das belegt Deployment, keine korrekten Aussagen oder funktionierenden Links.
- Direkter Leseversuch von [Website](https://vazules.github.io/Thunderbird-Antivirus/) und [Privacy-Seite](https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html) über das Webwerkzeug scheiterte mit „not accessible“. HTTP-Erreichbarkeit und ausgelieferter Inhalt bleiben hier **ungeprüft**. Lokale Pages-Quellen enthalten nachweislich veraltete Angaben: `docs/index.md` spricht von 1.22.0, fehlenden echten Screenshots und ausstehender Thunderbird-Abnahme; vorhandene PNGs und JSON-Berichte widerlegen die pauschalen Aussagen.
- Ein aktueller ATN-Eintrag oder Signierungsstatus wurde nicht unabhängig über ATN verifiziert. Die Release-Notizen nennen die ATN-Einreichung als separaten Maintainer-Schritt. Fehlende persönliche Maintainer-Schlüssel werden aus dieser Umgebung nicht als globale Tatsache abgeleitet.

## 2. Kompakte Bestandsaufnahme

| Produktteil | Status | Beleg und belastbare Einordnung |
| --- | --- | --- |
| MailExtension-Laufzeit | Implementiert, aktuell unzureichend geprüft | MV3, Mindestversion 140.0, Hintergrundskripte in `manifest.json`; `messageDisplay.onMessagesDisplayed`, Nachrichteninjektion und `windows.openDefaultBrowser` in `background.js`. Thunderbird verwendet hier Hintergrundskripte; ein Chromium-Service-Worker-Modell ist keine bewiesene Architektur. |
| Lokale Analyse und HTML-Entschärfung | Implementiert, synthetisch geprüft; Schutzqualität unzureichend empirisch geprüft | `risk.js`, `sanitize.js`, `calculateThreatScore`, `extractTextFromParts`; Header-/Domain-/Textsignale und Anhänge. Kein Nachweis einer vollständigen lokalen Malwareerkennung oder einer repräsentativen Erkennungs-/Fehlalarmrate. |
| Freigaben und externe Anbieter | Implementiert, Live-Prüfung unvollständig | `scan_policy.js`: `authorizeMessageScan`, `requireHostPermission`, Stufengrenzen; `background.js`: Widerruf/`abortAll`; `providers.js`, `api_gateway.js`: externe Anfragen und Fristen. Mehrere Auth-/Berichtsfunktionen unterscheiden sich vom neueren Release. |
| Lokales Linkaudit | Implementiert und begrenzt nachgewiesen | `link_audit.js`: serialisierte Storage-Schreibvorgänge, PENDING, getrennte Entscheidungs-Snapshots, OPENED nach erfolgreicher API-Antwort. `audit.js`: Filter, 50 Zeilen/Seite, CSV-Schutz gegen Formel-Injektion, JSON mit SHA-256. SHA-256 allein ist keine authentifizierte Manipulationssicherheit. |
| Prozessverlust und historische Entscheidungen | Historisch auf echtem Linux-Thunderbird nachgewiesen | `docs/audits/thunderbird-crash-recovery.json`, `thunderbird-permanent-upgrades.json`, `THUNDERBIRD_LINUX_ABNAHME.md`: sechs Sprachprofile, zwölf saubere Neustarts und zwölf SIGKILL-Wiederanläufe. PENDING bleibt offen; keine erneute OS-Zustellung. Kein Stromausfall-/Datenträgerdefekt-Nachweis, keine aktuelle Vollabnahme von HEAD. |
| Sprachen | Implementiert und im automatisierten Teil nachgewiesen; vollständige Sprachqualität nicht freigegeben | Sechs `_locales/*/messages.json`, `test/i18n.test.js`: Schlüssel-/Platzhalterparität und DOM-Rendering. Englischer Fallback vorhanden. `audit.js` zeigt `cancelReason` als technischen Rohwert; React enthält englische feste Texte. Das rechtfertigt gezielte Vollständigkeitsprüfung statt pauschalem „100 % erfüllt“. |
| Design und Themes | Implementiert und statisch/simuliert geprüft | `design_system.js`, `design_components.css`, generiertes `design.css`, `theme.js` lesen native Themefarben, Hell/Dunkel, Akzent und Dichte. Enterprise nutzt `enterprise/design_system.cjs`. React hat separates `src/index.css`. Native High Contrast, Zoom/DPI und reale Screenreader bleiben unzureichend nachgewiesen. |
| Speicher und Grenzen | Implementiert, reale Belastung unzureichend geprüft | `db.js`: IndexedDB, Transaktionsabschluss vor Bestätigung, Pruning beim Datenbankstart; **kein SQLite im untersuchten Laufzeitcode**. Audit separat in `browser.storage.local`, 30 Tage, 2.000 Einträge, 2 MiB; kein Bedarf für unbeschränkte 10.000-Einträge-Indizes belegt. |
| React-Webanwendung | Implementiert als separate Weboberfläche, keine Thunderbird-Integration nachgewiesen | `src/App.tsx`, `src/lib/auditStorage.ts`, `src/components/LinkCheckModal.tsx`: localStorage, Demoaudit, eigener Risikopfad; `handleProceed` setzt OPENED ohne Thunderbird-Aufruf. `web-ext-config.mjs` schließt `src/` und `index.html` aus dem XPI aus. README beschreibt dennoch einen React-Neuaufbau als Produkt. |
| Lokale Enterprise-Bausteine | Implementiert und in Node-/lokalen Szenarien geprüft | `enterprise/service.cjs`, `outbox.cjs`, `delivery.cjs`, `policy_state.cjs`, Storage-/Review-/Heartbeatmodule mit eigenen Tests. Retry, Backoff, Dead Letters und Storage-Jobs existieren bereits. Keine mitgelieferte Enterprise-Runtime im XPI. |
| Profile und produktive Integrationen | Profile implementiert; Produktivbetrieb offen/teilweise vorbereitet | `enterprise_profiles.js`/`enterprise_setup.js`: deaktivierte Konfigurationsentwürfe. Cloud-SDK-Adapter existieren laut Code/Dokumentation; reale Mandanten, dauerhafte Worker, SSO/Rollen und SEALED-/Retirement-Abnahme sind dadurch nicht bewiesen. `docs/enterprise/n06-runtime-observation.json` kennzeichnet `productionAccepted:false`, `sealed:false`; historische Umgebungsbeobachtung. |
| Windows/macOS, Screenreader, automatische Updates, Rollback | Offen im nachgewiesenen Umfang | Linux-Berichte und Runner sind vorhanden. Keine gleichwertigen aktuellen Nachweise für diese Umgebungen gefunden. Manuelles Paketupgrade ersetzt keinen automatischen Updatekanal und keinen Downgrade-/Rollbacktest. |

### Unverhandelbare Semantik

`OPENED` bestätigt ausschließlich die von Thunderbird angenommene Öffnungsanforderung. Ein erfolgreicher API-Aufruf beweist weder Browserstart noch Webseitenbesuch; der Linux-Desktopempfänger ist zusätzlich ein OS-Dispatch-Nachweis, kein echter Browser.

`PENDING` bezeichnet eine offene Entscheidung. Nach Prozessverlust darf weder OPENED noch ABORTED erfunden werden. Bei Untersuchungen von Abstürzen zwischen API-Annahme und Storage-Bestätigung ist ein fehlender Abschluss ausdrücklich unsicher, nicht rückwirkend rekonstruierbar.

Historische Scores, Prüfergebnisse, Versionen und Entscheidungen bleiben erhalten. Aufbewahrungsfristen und ausdrücklich bestätigte Löschung sind separat dokumentierte Löschvorgänge; ein Upgrade darf keine Historienbereinigung als Migration tarnen.

## 3. Dynamische Themenlandkarte

Die Befunde rechtfertigen neun Hauptbereiche. Architektur und Produktwahrheit sind hier eigenständig, weil zwei unterschiedliche Oberflächen als ein Produkt beschrieben werden. Design und Übersetzung werden getrennt geführt, da sie unterschiedliche Abnahmen benötigen. Plattform und Distribution bleiben getrennt, um lokale Updateprüfungen nicht unnötig an ATN zu blockieren.

| Primärbereich | Befunde und Arbeitspakete | Querverweise |
| --- | --- | --- |
| Lieferfähigkeit und Releaseprovenienz | TAV-001 Abhängigkeiten; TAV-002 Releaseabgleich; TAV-003 Gates | alle nachfolgenden Freigaben |
| Produktarchitektur und Außendarstellung | TAV-004 Runtime/Webdemo; TAV-005 Dokumentations-/Pages-Wahrheit | Sprachen, Enterprise |
| Schutzwirkung und Analyseverträge | TAV-006 Risikokorpus und Providerpfade | Releaseabgleich, Datenschutz |
| Linkentscheidungen und Datenlebenszyklus | TAV-007 Auditfehler/Crashgrenzen; TAV-008 Retention | Distribution, Enterprise |
| Plattform und native Zugänglichkeit | TAV-009 Windows/macOS/Browser; TAV-010 Screenreader | Themes, Linkaudit |
| Mehrsprachigkeit | TAV-011 dynamische Texte und Sprachabnahme | alle Oberflächen |
| Gemeinsames Design und Bedienung | TAV-012 native Themes/Kontrast/Dichte | Screenreader, React-Entscheidung |
| Installation und Distribution | TAV-013 Update/Rollback; TAV-014 ATN | Release, Datenlebenszyklus |
| Leistung und optionale Unternehmensanbindung | TAV-015 Messung; TAV-016 Brückenkonzept; TAV-017 Pilot | Schutzwirkung, Profile, Rechte |

Diese IDs sind neu und stabil. Kategorien dürfen bei späteren Befunden wechseln; ID und Erledigungsbeleg bleiben erhalten. Neue Querschnittsarbeit wird nur bei der Hauptaufgabe angelegt.

## 4. Priorisierte Aufgabentabelle

**P0:** verhindert aktuell reproduzierbare und verantwortbare Veröffentlichung. **P1:** wesentliche Korrektheit, Verständlichkeit, Datenintegrität oder verbindliche Produktabnahme. **P2:** gezielte Qualitätsarbeit nach Messung beziehungsweise sinnvoller Vorbereitung. **P3:** optionale Erweiterung mit externen Voraussetzungen. Es gibt keinen belegten aktiven Exploit, der allein eine Notfallfreigabe rechtfertigt.

Aufwand: **S** eng begrenzte Änderung/Untersuchung; **M** mehrere Komponenten oder eine Testumgebung; **L** mehrere Systeme, Plattformen oder Migrationspfade. Keine Zusage in Stunden; Befunde aus Untersuchungen können neue Pakete begründen.

| ID | Hauptbereich / Typ | Gewünschtes Ergebnis | Priorität / Aufwand | Voraussetzung |
| --- | --- | --- | --- | --- |
| TAV-001 | Lieferfähigkeit / Optimierung | Reproduzierbarer Abhängigkeitsbaum und passende Vendor-Dateien | P0 / S–M | vorhandene Tools/Registry |
| TAV-002 | Releaseprovenienz / Verbesserung | Bewusst festgelegter Funktionsstand gegenüber 1.24.2, keine stille Rücknahme | P0 / M | Analyse sofort; Endprüfung nach 001 |
| TAV-003 | Gates / Optimierung | Aktive CI und Publish prüfen denselben Kandidaten und seine Evidenz | P1 / M | 001/002; Schreibrechte auf Workflows bei Umsetzung |
| TAV-004 | Architektur / Verbesserung | Demo und echte Thunderbird-Funktionen eindeutig unterscheiden | P1 / M | keine externen Mittel |
| TAV-005 | Produktdokumentation / Verbesserung | Konsistente Release-, Datenschutz- und Pages-Aussagen | P1 / M | 002/004 für endgültige Aussagen |
| TAV-006 | Schutzwirkung / Verbesserung | Risikokorpus und überprüfbare Provider-Verhaltensverträge | P1 / M | 001/002; Live-Provider separat |
| TAV-007 | Linkaudit / Optimierung | Nachweis für Fehler-/Rennbedingungen ohne erfundene Entscheidungen | P1 / M | 001/002; echtes TB für Abnahme |
| TAV-008 | Datenlebenszyklus / Verbesserung | Tatsächliche Aufbewahrungssemantik und Migration transparent machen | P2 / M | 007; langlebiges Testprofil |
| TAV-009 | Plattform / Verbesserung | Windows/macOS und reale Browserübergabe nachgewiesen | P1 / L | Windows/macOS-Geräte/VMs, TB, Browser |
| TAV-010 | Zugänglichkeit / Verbesserung | Reale Nutzung mit NVDA und VoiceOver absichern | P1 / M–L | Windows/macOS, Screenreader, Testkompetenz |
| TAV-011 | Sprachen / Verbesserung | EN/DE/FR/ES/IT/PL in produktiven Pfaden vollständig | P1 / M | 001; Sprachreview für finale Qualität |
| TAV-012 | Design / Verbesserung | Einheitliche eigene Oberflächen unter nativen Darstellungsbedingungen | P2 / M | 004; 009/010 für OS-Abnahme |
| TAV-013 | Update/Recovery / Verbesserung | Manueller Update-/Rollbackpfad und automatische Verteilung getrennt geprüft | P1 / L | Kandidaten/Alt-XPIs; automatischer Kanal separat |
| TAV-014 | ATN / Erweiterung | Prüffähige Einreichung und nachvollziehbare Store-Distribution | P1 / M plus externe Reviewzeit | Maintainer-ATN-Zugriff; 001–003, Produktabnahme |
| TAV-015 | Leistung / Optimierung | Erst reale Engpässe messen, dann begründet optimieren | P2 / M Untersuchung | reproduzierbarer Build, echtes TB |
| TAV-016 | Enterprise-Architektur / Erweiterung | Begrenzten optionalen Client-/Brokerpfad konkret entwerfen | P2 / M Untersuchung | kein Cloudzugang für Entwurf erforderlich |
| TAV-017 | Enterprise-Pilot / Erweiterung | Einen produktiven Integrationspfad belastbar abnehmen | P3 / L | 016, Betreiber, Testmandant, IdP/Storage nach Pilotwahl |

## 5. Arbeitspakete mit Abnahme

### TAV-001 — Abhängigkeiten und gebündelte Daten reproduzierbar machen

- **Befund/Status:** aktuell reproduzierter Installationsfehler; `package.json`, `package-lock.json`, CI-Joblog. `scripts/update-vendor.js` erzwingt exakte tldts-Version und Bytegleichheit mit `vendor/tldts.js`.
- **Ergebnis/Nutzen/Umfang:** kompatible Vite-/React-Plugin-Kombination wählen, Lockfile konsistent erzeugen und PSL-Bundle gezielt abgleichen. Kein allgemeines Dependency-Upgrade und keine Produktneufassung.
- **Priorität:** P0: jeder frische CI-Runner ist betroffen; klare Evidenz, überschaubare Reparatur, derzeit Voraussetzung für alle Freigaben. Änderungsrisiko vor allem Webbuild und Domainklassifikation.
- **Akzeptanz:** frisches `npm ci` ohne Peer-Umgehung unter CI-Node 22 erfolgreich; `check:vendor` einschließlich gebündelter Lizenz erfolgreich; `npm run check` vollständig erfolgreich. Falls Webbuild unterstützt bleibt: `npm run build` und TypeScriptprüfung zusätzlich erfolgreich. Änderungen an PSL-Domainauswertung anhand repräsentativer privater/öffentlicher Suffixe prüfen.
- **Validierung/Umgebung:** sauberes Linux-/CI-Arbeitsverzeichnis mit Registryzugang; Node-Checks sind keine echte Thunderbird-Abnahme.

### TAV-002 — Release 1.24.2 mit main funktional abgleichen

- **Befund/Status:** direkt belegte Abweichungen in `api.js` (`persistHybridReport`, `hasFinalStoredReport`, Report-Polling im Tag), `background.js` (`loadSettings`/Keyänderungen), `providers.js` (urlscan-Result-GET); manifest/package 1.23.0 gegenüber veröffentlichtem 1.24.2.
- **Ergebnis/Nutzen/Umfang:** jede ausgelieferte Fähigkeit als erhalten, bewusst abgelöst oder versehentlich fehlend einstufen. Gewollte neue Optimierungen von Rücknahmen unterscheiden. Danach fehlende Funktionen gezielt portieren und erst dann eine neue, höhere Kandidatenversion festlegen. Keine bestehenden Release-Tags umschreiben.
- **Priorität:** P0 wegen möglicher Funktionsverluste für Bestandsnutzer; statischer Befund stark, Providerfolgen noch ungeprüft. Nicht als aktiver Sicherheitsbruch einstufen. Aufwand M, Risiko hoch genug für verhaltensbasierte Abnahme.
- **Akzeptanz:** Vergleichsmatrix für alle paketwirksamen Differenzen; fertiger Bericht bleibt nach Popupschließen/Neustart lesbar, sofern diese veröffentlichte Fähigkeit beibehalten wird; begrenztes Polling endet bei Abschluss/Fehler/Schließen und respektiert Widerruf; Keys bei Start/Änderung/Wegnahme korrekt; urlscan-Ergebnisabruf mit erforderlicher Authentifizierung. Historische IDB-/Auditdaten unverändert. Jede gewollte Funktionsänderung mit Migration und verständlichen Release-Notizen.
- **Abhängigkeit/Validierung:** Analyse sofort möglich; reproduzierbare Regressionstests nach 001. Node-/DOM-Tests mit Testdoubles plus echter Thunderbird-Popup-/Neustarttest; reale Providerprüfung nur mit Testkonto und freigegebenen Testdaten. PR #668 ist mögliche Quelle, kein ungeprüft zu übernehmender Stand.

### TAV-003 — Releasegates und aktive Workflows vereinheitlichen

- **Befund/Status:** `.github/workflows/release.yml` nutzt `npm run check`, aber kein `goal`; `docs/ci/release-publish.yml` verspricht zusätzliche Gates/Idempotenz. `releaseTagState` prüft Tag→HEAD, nicht uncommittete Paketänderungen; C6 akzeptiert alte Protokollzusammenfassungen ohne Bindung an den neuen Pakethash.
- **Ergebnis/Umfang:** aktive CI, Kandidatentest und Publish mit gemeinsamer überprüfbarer Paketidentität versehen; Vorlagen synchronisieren oder als historische Vorlagen markieren. Releasewiederholung explizit gestalten; bereits veröffentlichte Assets nicht still per `--clobber` ersetzen.
- **Priorität:** P1, breite Wirkung auf Nutzer und Maintainer; konkrete Lücken, M, Veröffentlichungspfad mit erhöhtem Änderungsrisiko. 001/002 erforderlich.
- **Akzeptanz:** schmutziger paketwirksamer Arbeitsbaum, falsche Version, fehlende/abweichende aktuelle Prüfevidenz verhindern Freigabe; negativer Test belegt das. Ein grüner Lauf referenziert Commit und SHA-256 des Kandidaten. Wiederholung akzeptiert identische Assets oder bricht bei Abweichung erklärbar ab. Kein Publizieren ohne erfolgreiche erforderliche Jobs. Tagabhängiges C7 korrekt in die Reihenfolge Kandidat→Tests→Tag→Publish integrieren, ohne Zirkelschluss.
- **Validierung:** lokale Gate-Fixtures, CI-Dry-Run/isolierter Testtag ohne Produktveröffentlichung; spätere Workflowübernahme benötigt passende GitHub-Berechtigung. Diese wurde hier nicht als fehlend nachgewiesen.

### TAV-004 — Webdemo und Thunderbird-Produkt verbindlich abgrenzen

- **Befund/Status:** `README.md` nennt eine React-Neufassung; Manifest und Paket nutzen klassische Skripte. `src/components/LinkCheckModal.tsx::handleProceed` schreibt OPENED ohne Öffnungsanforderung, `auditStorage.ts` erzeugt Demoaudit. Implementierung vorhanden, Produktintegration offen.
- **Ergebnis/Umfang:** dokumentierte Entscheidung über Rolle der React-App: ausdrücklich gekennzeichnete Demo oder separat geplante echte Integration. Keine automatische Migration der Erweiterung zu React. Demoereignisse dürfen nicht als echte Nutzerentscheidungen oder echte Schutzwirkung erscheinen; keine API-Schlüssel in einer bloßen Demo verlangen.
- **Priorität:** P1, unmittelbar irreführende Produktdarstellung und unterschiedliche Auditsemantik; keine bewiesene Regression im XPI. M, überwiegend lokal umsetzbar.
- **Akzeptanz:** README, Einstieg, Buildbefehle und Demoansichten benennen ihre Runtime korrekt; Demo hat sichtbare synthetische Datenkennzeichnung und verwendet keinen echten OPENED-Abschluss ohne Thunderbird-Annahme. XPI enthält weiterhin nur bewusst vorgesehene Dateien. Bei Integrationsentscheidung werden API-, Storage-, Datenschutz- und Migrationsentwurf als Folgeaufgabe spezifiziert.
- **Validierung:** Paketinhalt und Manifest prüfen; Webdemo im Browser, Add-on separat in Thunderbird; keine Browserdemo als Add-on-Abnahme zählen.

### TAV-005 — Datenschutz, Statusdokumentation und Pages korrigieren

- **Befund/Status:** `docs/privacy_policy.md` bezeichnet strict teils als „ausschließlich Hashes“, erlaubt später Domain-/IP-Abfragen und beschreibt urlscan widersprüchlich zu `background.js::handleCheckLinkState` mit `tierAtLeast('max')`. `docs/index.md`, `STATUS.md`, `docs/ci/README.md` und ältere Pläne enthalten widersprüchliche Ist-Aussagen.
- **Ergebnis/Umfang:** eine aktuelle Quellenübersicht und Datenflussmatrix je Aktion/Anbieter/Stufe/Freigabe; historische Berichte datiert erhalten. Pages-Verweise und Statusangaben konsolidieren, Release 1.24.2 vom Kandidaten unterscheiden. Keine Rechtskonformitätsgarantie aus technischen Checks ableiten.
- **Priorität:** P1: Einwilligungsverständnis und Adminentscheidungen hängen daran, konkrete Widersprüche, M. Abschließende Produktbeschreibung abhängig von 002/004, Quelleninventur sofort möglich.
- **Akzeptanz:** lokale Analyse, Hash, Domain, IP, volle URL und Datei werden präzise getrennt; globale Zustimmung, Nachricht/Absender, Hostrecht und Stufe pro Pfad ersichtlich. OPENED/PENDING korrekt erklärt; keine falschen Aussagen über fehlende Screenshots oder aktive CI. Aktuelle Einstiegsseite verweist auf einen maßgeblichen Plan; alte Pläne ausdrücklich historisch. Öffentliche Root-, Sprach-, Privacy- und Downloadseiten mit HTTP- und Inhaltsprüfung nachweisbar korrekt.
- **Validierung:** Code-Datenfluss-Review, statischer Link-/Jekyll-Buildcheck; Live-HTTP-Prüfung benötigt Zugriff auf `vazules.github.io`, der hier nicht erfolgreich war. Sprachliche Produkttexte mit 011 abstimmen.

### TAV-006 — Schutzqualität und Providerverhalten risikobasiert untersuchen

- **Befund/Status:** `risk.js::calculateThreatScore`, Authheader-Regex/Trusted-Authserver-Pfade, `testdata/heuristics.json` und fünf EMLs bilden Heuristiken ab, keine repräsentative Schutzwirkung. Releaseabgleich zeigt verlorene Provider-/Reportpfade. False-Positive-Häufigkeiten sind unbekannt.
- **Ergebnis/Umfang:** zuerst Bedrohungsmodell und erwartetes Verhalten für manipulierte Header, interne Weiterleitungen, legitime Newsletter, Lookalikes/IDN, SPF/DKIM/DMARC und unvollständige Nachrichtentexte bestimmen. Fehlende Qualität erst nach Korpusbefund gezielt ändern. Neue externe WHOIS-/Domain-Aging-Dienste sind kein Bestandteil.
- **Priorität:** P1: zentrale Schutzwirkung für alle Nutzer, aber kein Beleg für konkrete Fehlalarmquote. M Untersuchung; Änderungen an Scores benötigen separate begründete Abnahme und erhalten historische Scores.
- **Akzeptanz:** dokumentierter datenschutzgerechter Korpus mit positiven/negativen Erwartungen, unabhängiger Herkunft/Review und Grenzen; unbekannt/Timeout/fehlende Berechtigung werden nicht „sicher“. Freigabe-/Widerrufs- und Schlüsselpfade aller fünf Anbieter inklusive 429/503 und verspäteter Antworten geprüft. Abgeleitete Defekte mit reproduzierbarer EML und neuer Aufgaben-ID dokumentiert; keine bloße Optimierung auf bestehende Fixtures.
- **Validierung:** deterministische Tests und synthetische HTTPantworten; echter TB-Nachrichtenimport für HTML/Text, Einzel-/Mehrfachanzeige und Fensterwechsel. Reale Providerverträge separat mit Testkonten, erlaubten Testartefakten und Netzfreigabe; keine Nutzerpost übertragen.

### TAV-007 — Audit an Fehler- und Prozessgrenzen absichern

- **Befund/Status:** `link_audit.js::handleAuditedLinkCheck`, `handleCancelAuditedLink`, `handleOpenAuditedLink`; API-Aufruf vor terminalem Auditwrite. Bereits vorhandene Speicherung von PENDING und Snapshots ist zu erhalten. Historische Linux-Crashnachweise erfassen gespeicherte Vorgänge, nicht jede unbestätigte Schreib-/Öffnungsgrenze.
- **Ergebnis/Umfang:** zusätzliche Falluntersuchung für gleichzeitige Klicks, Tab-/Nachrichtenwechsel, verspätete Antworten, Storageablehnung und Absturz zwischen Öffnungsannahme und Auditbestätigung. UI muss verbleibende Unsicherheit erklären. Kein automatisches Wiederöffnen und keine erfundene ABORTED-Entscheidung.
- **Priorität:** P1 wegen Auditverlässlichkeit; konkrete Ablaufgrenze im Code, tatsächliche Datenverlusthäufigkeit unbekannt. M, Regressionen am Entscheidungspfad vermeiden.
- **Akzeptanz:** doppelte Aktionen erzeugen keinen mehrfachen Öffnungsaufruf; Ziel-/Nachrichtenwechsel verweigert fremde Übergaben; späte Bewertung verändert keine Entscheidungssnapshots. Fehler beim Auditwrite sichtbar, ohne eine bestätigte Webseitenöffnung zu behaupten. PENDING bleibt nach Verlust offen; UI benennt fehlenden Abschluss, ohne historischen Zustand zu überschreiben. JSON/CSV bewahren Originalfelder und Versionen.
- **Validierung:** gezielte Reihenfolge-/Fehlerinjektion im Node-Test; danach echter isolierter Thunderbird-Profiltest auf dem neuen Paket. SIGKILL nur eigener Testprozesse; OS-Dispatch separat protokollieren. 001/002 vor abschließender Abnahme.

### TAV-008 — Aufbewahrung und Migration nachvollziehbar definieren

- **Befund/Status:** `db.js::pruneStore` wird in `getSharedDB` beim Öffnen aufgerufen; `readLinkAudit` pruned beim Lesen/Schreiben. 30 Tage sind damit zunächst eine auslösergebundene Bereinigung, kein nachgewiesener minutengenauer Löschtermin im Dauerbetrieb. Retention ist implementiert, Dauerbetrieb unzureichend geprüft.
- **Ergebnis/Umfang:** Dateninventar für IDB, Audit, Einstellungen, Profile und Exporte; Aufbewahrungsauslöser erklären und nur bei Anforderungslücke begrenzte periodische Bereinigung ergänzen. Keine ungefragte permanente Speicherung sämtlicher Historie; keine ungefragte Verschärfung bestehender Löschfristen.
- **Priorität:** P2: Privatsphäre und Adminverständnis, konkrete Semantik, keine nachgewiesene Überfüllung. M, Löschrisiko hoch, abhängig von 007.
- **Akzeptanz:** Ablaufgrenzen Alter/Anzahl/Bytes, Rückwärtszeit, alte Datensätze ohne neue Felder und Quotenfehler geprüft. Migration erhält unveränderte nicht abgelaufene Daten und PENDING; Export-/Löschaktionen klar voneinander getrennt. Bei periodischer Bereinigung keine konkurrierenden Schreibverluste; bei Beibehaltung des Verhaltens präzise dokumentierte Trigger.
- **Validierung:** kontrollierte Uhr und Storage-Fixtures plus langlebiges echtes TB-Testprofil/Neustart; Exporte außerhalb der Extension können nicht automatisch als gelöscht gelten.

### TAV-009 — Windows/macOS und reale Standardbrowser prüfen

- **Befund/Status:** `tools/thunderbird-live.dev.py` und Linuxberichte belegen X11/Marionette, nicht Windows/macOS. `handleOpenCheckedLink` ist auf die native Browserübergabe angewiesen.
- **Ergebnis/Umfang:** je mindestens ein konkret benanntes unterstütztes Windows- und macOS-System mit Thunderbird, aktuellem Kandidaten und echtem Standardbrowser; Linux zusätzlich mit echtem Browser. Frische Installation, Nachrichten-/Fensterwechsel, Dialog, Export, Neustart und Upgrade prüfen. Weitere Versionen erst nach Unterstützungsentscheidung, kein pauschales Versprechen „140+ getestet“.
- **Priorität:** P1, gesamte Nutzergruppen ohne reale Abnahme; M–L Setup-/Matrixaufwand, technische Fehler noch nicht bewiesen.
- **Akzeptanz:** Bericht nennt OS/TB/Add-on/Browser/Hash; URL-API-Annahme, OS-Übergabe und beobachteter Browserstart getrennt. Besuch nur mit kontrollierter lokaler Testseite und eigener Beobachtung bestätigen. Fehlender/abweisender Handler führt nicht zu erfundener Erfolgszusage; bestehende Auditsemantik bleibt korrekt.
- **Validierung/Voraussetzung:** Windows/macOS-Geräte oder geeignete VMs, TB-Testprofile, installierte Browser; manueller nativer Test zählt, Chromium-Simulation nicht. Kandidat aus 001/002; 010 kann dieselben Umgebungen verwenden.

### TAV-010 — Native Screenreader- und Tastaturabnahme

- **Befund/Status:** `tools/browser-ui.dev.cjs` nutzt Chromium/axe und API-Testdoubles; reale NVDA-/VoiceOver-Nutzung ist nicht nachgewiesen. Semantische Rollen allein beweisen Verständlichkeit nicht.
- **Ergebnis/Umfang:** Popup, Linkdialog, Einstellungen/Wizard, Audit und relevante Adminansichten mit NVDA unter Windows und VoiceOver unter macOS durchgehen. JAWS ergänzen, wenn als Zielplattform zugesagt/verfügbar. Tastatur, Fokus, Rückkehr, Statusansagen und vergrößerte Darstellung gemeinsam prüfen.
- **Priorität:** P1, verbindliche Bedienbarkeit und sicherheitsrelevante Warnungen; M–L, Untersuchung vor pauschaler ARIA-Änderung. Benötigt 009-Umgebungen und Prüferfahrung.
- **Akzeptanz:** ohne Maus URL, Score, Prüfstand, Öffnen/Abbruch und Auditdetails verständlich erreichbar; Fokus bleibt im Dialog und kehrt sinnvoll zurück. PENDING/OPENED werden eindeutig angesagt; Fehler/Retry nicht nur durch Farbe. Prüfprotokoll mit tatsächlicher Ansage/Interaktion, Versionen und reproduzierbaren Defekten; kein WCAG-Gesamtkonformitätsanspruch allein aus axe.
- **Validierung:** reale Screenreader in Thunderbird und Node-Adminseiten im passenden Browser; Regressionen danach zielgerichtet automatisieren.

### TAV-011 — Sechs Sprachen in dynamischen Pfaden vervollständigen

- **Befund/Status:** `_locales/{en,de,fr,es,it,pl}`, `i18n.js`, `test/i18n.test.js` liefern starke Strukturprüfungen. `audit.js::render` zeigt `cancelReason` direkt (`destination_changed` etc.); React-App hat feste englische Gründe und Footer. Historische Auditbegründungen sind Daten, keine zu überschreibenden UItexte.
- **Ergebnis/Umfang:** Laufzeittexte und eigene Adminansichten inventarisieren, technische Statuscodes über Labels übersetzen, fehlende dynamische Strings schließen. Originalcode/-text im Export bewahren; bei historischen Daten Übersetzungslabel zusätzlich anzeigen, nicht Snapshot umschreiben. Demo nach 004 getrennt behandeln.
- **Priorität:** P1 wegen verbindlicher sechs Sprachen; konkrete Rohwerte, M. Gleiche Schlüssel beweisen keine muttersprachliche Qualität.
- **Akzeptanz:** keine unbeabsichtigten Fallbacks/Schlüssel/Rohcodes in produktiven Warn-, Fehler-, Abbruch- und Einrichtungsabläufen aller sechs Sprachen; Platzhalter, Plural-/Datumsdarstellung und lange polnische/französische Texte passen. Export behält maschinenlesbare Zustände; historische Entscheidungsdaten unverändert. Fach-/Muttersprachreview kennzeichnet verbleibende Unsicherheiten.
- **Validierung:** Katalog-/DOM-/Browserprüfungen, gezielte echte TB-Abläufe in sechs Sprachprofilen; Sprachreview zusätzlich erforderlich. Keine externen APIs für die lokale Übersetzungsarbeit nötig.

### TAV-012 — Designsystem unter nativen Bedingungen abnehmen

- **Befund/Status:** gemeinsames System für echte Add-on-/Node-Adminansichten existiert; `theme.js::readNative`, `snapshot`, `initialize`. Separate React-CSS-Quelle und native High-Contrast-/DPI-Grenzen nicht gleichwertig geprüft.
- **Ergebnis/Umfang:** reale Theme-/Akzent-/Dichte-/Kontrast- und Zoommatrix; erforderliche Korrekturen in gemeinsamen Tokens/Komponenten durchführen. Kein komplettes Redesign ohne beobachtetes Problem. React nur gemäß 004 einbeziehen.
- **Priorität:** P2 für Erweiterung der bestehenden Abnahme; gefährlich unlesbare Warnungen als neu belegten P1-Defekt eskalieren. M, mit 009/010 koordinieren.
- **Akzeptanz:** eigene Oberflächen und generierte Adminansichten nutzen dieselben semantischen Tokens; Hell/Dunkel, System-/TB-Themewechsel, kompakte/bequeme Dichte, schmale Ansicht, 200 % Zoom und OS-Kontrastmodus ohne abgeschnittene Aktionen; Fokus und Warnstufen sichtbar, keine Farbe als einzige Information.
- **Validierung:** Generatorchecks und Browserlayouts plus native TB-/OS-Aufnahmen; gemeinsame Umgebung mit 009/010, keine doppelte Plattformaufgabe.

### TAV-013 — Updates und Rollback mit Bestandsdaten nachweisen

- **Befund/Status:** historische dauerhafte 1.22.0→1.23.0-Upgrades existieren; automatische Distribution und Rollback fehlen als gleichwertiger Nachweis. Aktuelle main-Versionsnummer liegt unter bereits veröffentlichtem 1.24.2.
- **Ergebnis/Umfang:** drei getrennte Pfade: manuelles XPI-Upgrade, bewusst unterstützter Rückweg, automatische Kanalaktualisierung. Rollback kann bei inkompatibler Downgrade-Semantik ein dokumentierter Profilbackup-Restore sein; keinen unbekannten Downgrade erzwingen.
- **Priorität:** P1: Schutz bestehender Nutzer und Historien; M–L, hohes Datenrisiko, nach 002/007/008 und später 014 für ATN-Kanal.
- **Akzeptanz:** echte Profile mit alter Konfiguration, Audit/Score-Snapshots/PENDING und fertigen Berichten erzeugen; Upgrade von 1.24.2 und einer relevanten älteren Version erhält Daten und verleiht keine neue Einwilligung. Neustart und kontrollierter Prozessverlust geprüft. Unterstützter Rückweg stellt dieselben Daten wieder her; inkompatibler Weg wird klar abgefangen/erklärt. Automatik separat belegt mit Server-/Kanalangebot, tatsächlicher Installation und Neustart.
- **Validierung/Voraussetzung:** vorhandene unsignierte GitHub-XPIs und Linux-TB genügen für ersten manuellen Update-/Backup-Restore-Test; keine ATN-Schlüssel dafür nötig. Echte automatische ATN-Verteilung benötigt Maintainerkonto, zugelassenen Test-/Releasekanal und zwei geeignete Versionen. Native Matrix über 009 ergänzen.

### TAV-014 — ATN-Einreichung und Distribution abschließen

- **Befund/Status:** `docs/reviewer_notes.md`, `docs/store_listing.md`, `docs/ci/release.yml` bereiten Einreichung vor. Aktiver Workflow veröffentlicht GitHub-XPI; aktuelle ATN-Signierung/Listung hier nicht verifiziert.
- **Ergebnis/Umfang:** erst Konto-/Eintragsstatus lesen, dann konkretes Kandidatenpaket, Berechtigungsbegründung, sechs Sprachbeschreibungen, aktuelle Screenshots und Reviewpfad vorbereiten. Einreichung ist ein eigener späterer Umsetzungsschritt, kein Teil dieses Plans.
- **Priorität:** P1 für verlässliche Endnutzerinstallation, aber abhängig von P0 und Produktabnahme; keine kosmetische Gate-Umgehung. M zuzüglich nicht schätzbarer externer Reviewzeit.
- **Akzeptanz:** Maintainer bestätigt tatsächlichen ATN-Zugang/Kanal; Einreichung referenziert unveränderliches Paket und geprüften Quellstand. Signierung, Listung, Reviewantwort und Store-URL als eigene Fakten dokumentiert; Download und Installation im echten TB erfolgreich. Prüfsumme ausdrücklich nicht als Signatur ausgeben. Automatische Updates über 013 abnehmen.
- **Validierung/Voraussetzung:** lesender Statuscheck, dann autorisierter Maintainer-ATN-Zugriff und bei Automation gültige passende API-Credentials/Workflowrechte. Keine Aussage, dass diese global fehlen; aktuell stehen sie dieser Analyse nicht zur Verfügung.

### TAV-015 — Reale Performanceengpässe messen

- **Befund/Status:** `runtime.js::mapWithLimit`, `background.js` begrenzen Arbeit/Caches; `scripts/benchmark-scan-limits.js` bezeichnet sich ausdrücklich als synthetisch. `tools/benchmark-compare.dev.js` nutzt ältere APIannahmen und einen abweichenden Hintergrund-Ladepfad. Weder 20 % noch 30 % Verbesserung sind hergeleitet.
- **Ergebnis/Umfang:** reproduzierbare Messreihe in Thunderbird für große MIME-Mails, viele Anhänge/Links und gefülltes Audit innerhalb 2.000 Einträgen/2 MiB. Erst Baseline für Laufzeit, UI-Reaktion und Spitzenverbrauch, danach priorisierte konkrete Optimierung.
- **Priorität:** P2 Untersuchung: Nutzen plausibel, Häufigkeit/Schwere unbekannt. M; keine blinden Regex-/Index-/Caching-Umbauten.
- **Akzeptanz:** identische Pakete/Profile/Datensätze, kalte/warme Läufe, Versionen und Messstreuung dokumentiert; verwendete Messung und ihre Grenzen erklärt. Limits und nicht analysierte Elemente sichtbar/verständlich. Optimierungsauftrag nur mit reproduzierbarem Engpass und verhaltensbezogenem Erfolgsmaß; kein Ziel „mehr Tests“.
- **Validierung:** synthetische Helfer nur für lokale Mikrofragen; echte TB-Messung für Produkturteil, keine Netz-/Nutzerpost nötig. Nach 001/002.

### TAV-016 — Optionale Enterprise-Brücke entwerfen

- **Befund/Status:** lokale Node-Dienste/CLI vorhanden, aber aus XPI ausgeschlossen; Profile sind Entwürfe. `enterprise/delivery.cjs::localOrigin` begrenzt Zustellung auf Loopback, Broker-/Outbox-Verträge sind keine aktivierte Thunderbird-Anbindung.
- **Ergebnis/Umfang:** einen nutzbaren ersten Pfad auswählen, etwa explizit eingerichteten Auditexport an lokalen Broker. Transportoptionen einschließlich Native Messaging versus HTTPS/Loopback, Rechte, Ursprungsschutz, Geräteauthentisierung, Widerruf, Offlinequeue und Aktualisierung vergleichen. Noch keine ungeregelte fetch-Brücke in background.js einbauen.
- **Priorität:** P2, erkennbarer Adminnutzen, optional; M Entwurf, deutlich höheres Integrationsrisiko als Altpläne mit „keine Voraussetzungen“ behaupten.
- **Akzeptanz:** Architekturentscheidung, Datenminimierung, Bedrohungsmodell und begrenzter End-to-End-Prototypplan; lokale Nutzung ohne Dienst vollständig funktionsfähig; keine Providerkeys im Profil-/Auditexport. Ereignisidentität, historische Snapshots und PENDING korrekt; Entwurf/Verbindung/produktive Aktivierung im UI unterscheidbar. Migrations-/Installationsvoraussetzungen konkret.
- **Validierung:** Vertrags-/Simulatorprüfungen lokal möglich; echter Thunderbird-Transport erst nach gewähltem sicheren Protokoll und Testbroker. Cloud-/IdP-Zugang ist kein Blocker für diesen Entwurf.

### TAV-017 — Einen echten Unternehmenspilot abnehmen

- **Befund/Status:** `enterprise/immutable_storage.cjs`, Storagejobs, Witness, Policies und Reviewpakete existieren; `ENTERPRISE_UMSETZUNGSSTAND.md`/`AUFGABENPLAN_ENTERPRISE_N06.md` und Laufzeitbeobachtung benennen fehlende produktive Evidenz. Testdoubles sind keine Cloud-/IdP-Abnahme.
- **Ergebnis/Umfang:** genau einen Betreiber, Speicher-/Identitypfad und Anwendungsfall wählen. Ausführbaren lokalen Kern weiterverwenden; keine parallele Produktionsanbindung an AWS, Azure, GCP und alle SIEMs als Voraussetzung für das Add-on.
- **Priorität:** P3, zusätzlicher Adminnutzen bei konkreter Nachfrage, hoher Aufwand/Risiko; blockiert lokale Add-on-Veröffentlichung nicht. Nach 016; Zuordnung zu vorhandenen EN-/N-IDs im Pilotauftrag präzisieren, statt diese nochmals anzulegen.
- **Akzeptanz:** echte minimale Rechte, Rollen-/Mandantentrennung, Keyrotation/Widerruf, Netzunterbrechung/Replay, Retention-/Lock-Readback und Wiederherstellung belegt. STAGED bleibt STAGED; SEALED/Retirement nur nach zugehöriger echter Evidenz. Keine Nutzerdaten vor Abnahme; Betriebsverantwortung und Abschaltung dokumentiert.
- **Validierung/Voraussetzung:** freigegebener Testmandant, Betreiber, benötigter IdP/Schlüsselspeicher und ausgewähltes Cloud-/SIEM-Ziel, Netzfreigaben sowie ggf. verwaltete Testgeräte. Node-Vertragstests bleiben nur ein Teilnachweis.

## 6. Nicht ungeprüft übernommene Altaufgaben

| Historische Behauptung | Aktuelle Einordnung |
| --- | --- |
| Neuer Tag 1.23.1 oder 1.24.0 reicht für GO | Bereits 1.24.2 veröffentlicht; main enthält funktionale Rücknahmen und CI-Konflikt. Erst 001/002, dann Kandidat/Releaseplanung. |
| PENDING-Erhaltung fehlt grundsätzlich | `link_audit.js` und echte historische Crashberichte belegen sie. 007 ergänzt konkret unbewiesene Fehlergrenzen und verständliche Darstellung. |
| Enterprise-Retry/Dead Letters oder Storagejobs neu bauen | `delivery.cjs::retryDelay`, `outbox.cjs::retry`, Storagejobs und Tests vorhanden; keine Doppelaufgabe. Produktionsbetrieb bleibt separat offen. |
| Lokaler WHOIS-/Domain-Aging-Score | Im untersuchten Produkt kein belegter Bedarf; Domainalter benötigt normalerweise zusätzliche Datenquelle. Erst Bedrohungs-/Nutzenuntersuchung in 006, keine ungeprüfte Erweiterung. |
| 20/30 % Performancegewinn oder Auditindizes >10.000 | Keine reale Baseline; Audit ist begrenzt. 015 misst vor Änderung. |
| Vollständiges SQLite-/Enterprise-/React-Produkt | Tatsächliches Paket nutzt IDB und storage.local; Node und React sind ausgeschlossen. 004 korrigiert Produktzuordnung. |
| Alle Updates benötigen zuerst ATN-Schlüssel | Falsch für manuelles XPI-Upgrade und Profilrestore. 013 trennt diese Arbeit von automatischer Distribution. |
| Design-/Sprach-/A11y-Anforderungen pauschal erfüllt | Generator-/Katalog-/axe-Erfolg hat begrenzten Geltungsbereich; 010–012 schließen gezielt die verbleibenden Nachweise. |

## 7. Roadmap nach verfügbaren Voraussetzungen

**Kurzfristig — belastbare Grundlage wiederherstellen:** TAV-001 zuerst ausführen; TAV-002 parallel inhaltlich untersuchen und danach validieren. TAV-004/005 schaffen klare Produkt- und Datenschutzaussagen. TAV-003 bindet aktive Gates an Kandidat und Nachweise. TAV-006/007/011 liefern gezielte lokale Regressions-/Sprachprüfungen; der neue Kandidat erhält danach eine echte Linux-Abnahme. Noch kein neuer Tag nur für eine grüne Anzeige.

**Mittelfristig — Nutzerpfade und Bestandsdaten abnehmen:** TAV-009/010 mit Windows/macOS-Testressourcen ausführen; TAV-012 in denselben Sitzungen prüfen. TAV-008 Aufbewahrungsverhalten klären; TAV-013 zunächst manuelles Update ab 1.24.2 und unterstützten Rückweg testen. TAV-014 mit Maintainerzugang abschließen und automatischen Kanalteil von 013 nachziehen. Die Korrektur der Datenschutzaussagen wartet nicht auf einen Cloudpiloten.

**Später beziehungsweise nach Messung/Bedarf:** aus 015 belegte Engpässe optimieren; 016 nur mit bestätigtem Enterprise-Anwendungsfall zur Implementierung führen; 017 als einzelnen freigegebenen Pilot ausführen. Neue Anbieter, Domainalter, größere Auditkapazität oder Architekturwechsel erst mit Nutzwert-/Risikonachweis priorisieren.

### Die drei sinnvollsten nächsten Arbeitspakete

1. **TAV-001:** entfernt den aktuell reproduzierten CI-/Installationsblocker. Ohne diesen Schritt ist keine Änderung auf einem frischen System verlässlich prüfbar.
2. **TAV-002:** verhindert, dass Nutzer mit einem neuen Release bereits veröffentlichte Analyse-/Berichtsfunktionen verlieren. Der Versionsrückstand ist nur ein Symptom; Funktionsvergleich und Datenverträglichkeit sind der Kern.
3. **TAV-004:** schafft ein gemeinsames belastbares Produktbild. Die als React-Neufassung beschriebene Weboberfläche ist nicht das gepackte Add-on; ihre Demoentscheidungen dürfen kein Beleg echter Thunderbird-Schutzwirkung sein. Diese Klärung steuert README, Sprachen, Design und spätere Architekturarbeiten.

TAV-005 ist unmittelbar anschließend beziehungsweise unabhängig für belegte Datenschutzwidersprüche zu beginnen. Plattform- und Screenreaderressourcen können schon während 001/002 organisiert werden.

## 8. Ausführbarkeit und konkrete zusätzliche Voraussetzungen

**Mit den vorhandenen Mitteln ausführbar:** Abhängigkeitsreparatur, Release-/Quellvergleich, Produktabgrenzung, Dokumentationskorrektur, Gateentwurf, Katalog-/DOM-Prüfungen, synthetische Fehlerfälle, Dateninventar und Enterprise-Brückenentwurf. Dafür sind keine ATN-, Cloud- oder IdP-Zugänge nötig. Dieser Auftrag endet beim Plan; die aufgeführten Reparaturen sind noch nicht umgesetzt.

**Zusätzlich nötig:** echter Thunderbird plus X11/Xvfb für neue Linux-Abnahme und Performance-/Recovery-Messungen; Windows-/macOS-Geräte oder geeignete VMs samt Browsern für native Plattformprüfung; NVDA/VoiceOver und erfahrene Prüfung für A11y; fachliches Sprachreview für belastbare Übersetzungsfreigabe; erreichbare Pages-Domain für öffentliche Inhaltsprüfung. ATN-Maintainerzugang und passender Kanal sind nur für echte Store-/automatische Distributionsschritte erforderlich. Workflowänderungen benötigen entsprechende Schreibrechte. Ein Enterprisepilot braucht ausschließlich die tatsächlich gewählten Systeme und Betreiberfreigaben.

**Freigabeempfehlung:** aktuellen main nicht als unverändert weiterentwickelte 1.23.0 oder nachgewiesenen Nachfolger von 1.24.2 veröffentlichen. P0-Befunde, Produkt-/Datenschutzwahrheit und entscheidungsrelevante P1-Defekte schließen; verbleibende native Abnahmegrenzen explizit dokumentieren. Optionale Enterpriseproduktion ist kein Releaseblocker für die lokal nutzbare Erweiterung.
