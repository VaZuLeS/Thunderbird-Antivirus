# Thundy AV — Aufgabenplan für die nächste Weiterentwicklung

Ursprünglicher Planungsstand: 2. November 2026, damals ohne Umsetzung. Der Fortschritt vom 3. November ist unten gesondert dokumentiert. Untersucht wurde `codex/analysis-sources-ui-20261102` auf Commit `2588ff08c172606fbbcd00741220e7e7535e6361`, Runtime-Fingerprint `78fe4735c95044a0dbaace538f5f46dc672941944ca3d00adb97e7aa566c9ab7`. Die anschließend angelegten Planungsdateien ändern diesen Produktstand nicht.

Der [separat gespeicherte Analyseprompt V2](PROMPT_PRODUKTANALYSE_THUNDERBIRD_V2.md) ergänzt den ursprünglichen Auftrag um Ressourcenbesitz, echte TTL-Wirkung, persistierte Identitäten, Lesbarkeit verschlüsselter Nachrichten und genaue Nachweisgrenzen. Der [bisherige Prompt](PROMPT_PRODUKTANALYSE_THUNDERBIRD.md) bleibt erhalten. Diese Ergänzungen sind sinnvoll, weil die jüngste Quellenanzeige neue Datenbeziehungen eingeführt hat, die der ursprüngliche allgemeine Prompt nicht ausdrücklich abprüfte.

## Fortschritt seit der Planung

Am 3. November 2026 wurde [der erste Umsetzungsschritt AVN-001/002/009](FORTSCHRITT_AVN_001_002_009.md) ausgeführt. AVN-001 hat einen geprüften Inventar-/Lesepfad-Fix, bleibt hinsichtlich der gesamten dauerhaften Zuordnung teilweise offen. AVN-002 ist implementiert und gezielt sowie nativ geprüft. AVN-009 hat einen nativen Gegenbeweis zur Stabilität numerischer Nachrichten-IDs; dauerhafte Bindung, Bewegung/Kopie und Retention sind weiter offen. Die nachstehenden Befunde und Prioritäten bleiben als ursprünglicher Planungsstand erhalten.

Die anschließende [Identitätsuntersuchung und der Speichervertrag](IDENTITAET_ANALYSEBEFUNDE.md) erweitern AVN-009 um lokale Copy/Move-/Status-/Compact-/Restart-/Restore-Fälle und gleiche Ressourcenmetadaten bei abweichendem Inhalt. Ungefilterte Rohdaten-Hashes erweisen sich wegen lokaler Statusheader ebenfalls als ungeeignet. Der experimentelle Inhaltsvergleich ist noch kein produktiver Schlüssel; Migration, weitere MIME-/Speicherbackends und Retention bleiben offen.

Der weitere [Schritt AVN-003/009.b zur Inhaltsverfügbarkeit](PRUEFUMFANG_NACHRICHTENINHALT.md) korrigiert einen nativ bestätigten falschen lokalen Abschluss bei `decryptionStatus: fail`. Teilprüfung und Lesefehler sind nun sechssprachig sichtbar; leere Mails und Textanhänge bleiben korrekt abgegrenzt. Binäre Anhänge sind nativ mit bekannten Bytes geprüft. AVN-003 bleibt teilweise offen: Die neue Unteraufgabe **AVN-003.2 (P1, Untersuchung zuerst, M)** grenzt eine unter 140/153 reproduzierte quoted-printable-/Unicode-Abweichung ein. Ihre Akzeptanz ist die belegte Ursache und eine risikogeprüfte Entscheidung über den Eingangsweg, nicht mehr Heuristikregeln auf verändertem Text. Hauptzuordnung C, Verweis aus AVN-009.b; keine zweite Decoderaufgabe dort.

## 1. Bestandsaufnahme und Nachweisgrenzen

### Veröffentlichter Stand und vorbereitete Entwicklung

| Ebene | Tatsächlich ermittelter Stand | Evidenz / Grenze |
| --- | --- | --- |
| GitHub-Release | **1.24.3**, veröffentlicht am 02.11.2026 um 10:36:15 UTC; kein Entwurf und keine Vorabversion | Frischer GET auf `releases/latest`; [Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.3). Assets: XPI und Prüfsummendatei. GitHub meldet für das XPI SHA-256 `f45050748b8464cc602ca914e586000d78b08225bbc18db41f4d1c065b1bc402`. In dieser Analyse nicht erneut heruntergeladen; Metadatenprüfung ist keine eigene Byteprüfung oder ATN-Signatur. |
| Remote-main | `8d61cd4064f44cbb872674e26f3cd071a5f2f3d7`, Releasezweigstand 1.24.3 | Frisch per GitHub-API abgeglichen; lokale Weiterentwicklung nicht mit main gleichgesetzt. |
| Entwicklungsstand | **1.24.4**, [PR #721](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/721), noch nicht veröffentlicht | `manifest.json`, `package.json`, aktueller Checkout. Kein neuer Release aus Versionsfeld oder Release-Notizen abgeleitet. |
| CI des untersuchten Commits | Vollständig erfolgreich | [Lauf 41473941206](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41473941206): Tests, sechs Browser-Sprachjobs, echte Linux-Thunderbird-Prüfungen und paketgebundenes Kandidatengate. Ein grüner Lauf ersetzt die nachfolgend reproduzierten Detailbefunde nicht. |
| GitHub Pages | main-Quellen verlinken weiterhin 1.24.3; Deployment für denselben main-Commit erfolgreich | [Deploy GitHub Pages](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41429009701) und [pages build and deployment](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41429008773). `.github/workflows/pages.yml` baut `docs/` nur bei main-Push bzw. manueller Auslösung. Direkter HTTPS-Abruf hier mit Transportfehler gescheitert: gerenderte öffentliche Inhalte, Weiterleitungen und Downloads deshalb nicht erneut abgenommen. Kein Websiteausfall daraus abgeleitet. |

### Architektur und tatsächlich vorhandene Fähigkeiten

Status: **N** = implementiert und im genannten Umfang nachgewiesen; **U** = implementiert, aber unzureichend geprüft; **T** = teilweise umgesetzt; **K** = konzeptionell vorbereitet; **B** = offen bzw. konkret blockiert. Der Status bezieht sich auf eine Fähigkeit und deren ausdrücklich benannten Umfang, nicht pauschal auf das ganze Produkt.

| Fähigkeit | Status | Befund und Beleg |
| --- | --- | --- |
| Thunderbird-MailExtension | N, plattformübergreifend U | MV3, Mindestversion 140.0, Hintergrundskripte und `message_display_action`; `manifest.json`. Keine Chromium-Service-Worker-Architektur unterstellt. Reale Linux-Nachweise für 140.12.0 und 153.6.0; keine allgemeine Freigabe jeder neueren Version. |
| Lokale Schutzfunktionen | N für Verhaltensfälle; U für reale Schutzqualität | `risk.js::calculateThreatScore`, `sanitize.js::disarmHTML`, `background.js::process_single_attachment`. Heuristik, HTML-Entschärfung und Hashbildung sind vorhanden, kein nachgewiesener vollwertiger AV-Scanner. Vertrauenswürdige Authserver-Header werden ausgewertet, SPF/DKIM nicht selbst kryptografisch geprüft. |
| Externe Provider | N für simulierte Verträge; B für produktive Abnahme | `scan_policy.js`, `providers.js`, `api_gateway.js`: Hybrid Analysis, VirusTotal, URLhaus, AbuseIPDB, urlscan.io. Einwilligung, Hostrechte, Datenschutzstufen und Sender-/Einmalfreigabe vorhanden. Konto-, Quoten- und aktuelle Live-Verträge bleiben unbewiesen. |
| Quellen- und Ressourcendarstellung | T | `analysis_status.js`, `background.js::getMessageAnalysisContext`, `api.js`: Dienst, Anfragezustand, Ergebnisquelle, ursprüngliche Zeit und Ressourcenbezug vorhanden. **Neuer reproduzierter Restbefund:** fremde Ressourcenbeschriftungen bei gleicher Header-ID; AVN-001. Die eigentliche Implementierung von INFO-01 bis INFO-07 wird nicht erneut geplant. |
| Linkentscheidungen, Score und Audit | N im getesteten Umfang | `link_audit.js::handleAuditedLinkCheck`, `handleOpenAuditedLink`, `handleCancelAuditedLink`; `audit.js`. URL, aktueller Prüfstand und damalige Entscheidungssnapshots getrennt. `OPENED` bestätigt nur die von Thunderbird angenommene Öffnungsanforderung. `PENDING` bleibt bei Prozessverlust unvollständig. Kein authentifiziertes zentrales Audit. |
| Sprachen, Design und Tastatur | N für Katalog-/Browser-/Linuxfälle; U für sprachlichen und nativen A11y-Nachweis | Je 503 Katalogschlüssel in EN/DE/FR/ES/IT/PL; `i18n.js`, `design_system.js`, `theme.js`, Shadow DOM und Quellen-Renderer. Gleiche Schlüssel beweisen keine menschlich geprüfte Übersetzungsqualität. axe/CSS-Zoom beweisen keine NVDA-/VoiceOver-/OS-DPI-Abnahme. |
| Einstellungen und lokale Profile | N | `options.js::LocalSettingsProfile`, lokaler Supportexport und `enterprise_setup.js`. Import/Export überträgt derzeit ausschließlich Darstellung/Akzent/Dichte mit Vorschau und Bestätigung. Kein allgemeines Schutzprofil oder Schlüsseltransfer. |
| Speicher und Lebenszyklus | T | IndexedDB v3, Transaktionsabschluss, Cache-Löschung und Auditlimits vorhanden; `db.js`, `link_audit.js`. `ExpiringMap` entfernt abgelaufene Schlüssel nur beim Zugriff; `messageAnalyses` ohne eigenes Mengenlimit. DB-Pruning erfolgt beim ersten Öffnen der geteilten Verbindung; laufende Begrenzung und verschachtelte Quellenkarten brauchen AVN-002/009. |
| Unternehmensfunktionen | Lokale Werkzeuge N; produktive Gesamtlösung K/B | `enterprise_profiles.js::buildDraft` erzeugt `implementation: configuration-profile`, `enabled:false`. Lokale Node-Journale, Broker-/Policy-/Review-/Outboxbausteine sind separat vorhanden. `enterprise/acceptance.cjs` weist weiterhin `productionAccepted:false` und fehlenden SEALED-Commit aus. Kein Nachweis von produktivem SSO, OS-Schlüsselschutz, Flottenrollout oder revisionssicherer Cloudablage. |
| Webanwendung | N als getrennte Simulation | `src/App.tsx`, `src/lib/demo.ts`; nicht im XPI. Simulation und browserlokale Daten sind keine Thunderbird-Verbindung oder produktive Enterpriseintegration. |
| Installation und Recovery | N für manuelles Linux-Verfahren; automatische Distribution B | `.github/workflows/release.yml`, `scripts/candidate-evidence.js`, `scripts/publish-release.js`, `tools/thunderbird-live.dev.py`. Geprüfte Paketbytes werden wiederverwendet; manuelles Upgrade, Neustart/SIGKILL und Profilbackup-Restore vorhanden. Kein allgemeiner In-place-Downgrade, kein verlustfreies Zusammenführen späterer Daten und kein echter automatischer Updatekanal daraus ableitbar. |

### In dieser Analyse tatsächlich geprüft

[Maschinenlesbarer Analysebeleg](audits/next-development-1_24_4.json), [reproduzierbare Diagnosen](audits/next-development-1_24_4-reproduce.cjs) und die lokal aufbewahrten Logs unterscheiden neue Prüfungen von vorhandenen Nachweisen:

- `npm run check:source`: erfolgreich; Manifest, Fallback, Vendor/PSL, Design und bisherige Dokumentationslinks geprüft.
- `node --test test/analysis-sources.test.js test/optimization.test.js test/i18n.test.js test/manifest.test.js`: **133 erfolgreich**. Simulierte Browser-/Provider-APIs, keine Live-Konten.
- `node tools/risk-corpus.dev.cjs`: neun synthetische Verhaltensfälle plus private PSL-Trennung erfolgreich, aktuell am untersuchten Runtime-Fingerprint. Keine Erkennungs-/Fehlalarmrate ableitbar.
- `node scripts/verify-package.js ./build`: vorhandenes lokales Entwicklungspaket geprüft; `packageIdentity` gleicht dessen Inhalte mit dem Quellstand ab. Keine neue Veröffentlichung.
- `npm audit --json`: neun moderate und ein niedriger Befund in der Entwicklungstoolkette, keine hohen/kritischen. `npm audit --omit=dev --json`: keine gemeldeten Befunde. Betroffen sind insbesondere transitive web-ext/addons-linter-Abhängigkeiten; sie werden nicht als XPI-Runtimebefund ausgegeben. Die angebotene automatische Reparatur enthält einen inkompatiblen web-ext-Downgrade; AVN-008 untersucht einen unterstützten Weg.
- **Neue Diagnose A:** VM mit Fake-Uhr: 100 `ExpiringMap`-Einträge, Ablauf überschritten; `size` und `values()` liefern weiterhin 100, nach `has()` für genau einen Schlüssel bleiben 99. Verhaltensnachweis für AVN-002; reale RSS-Auswirkung nicht gemessen.
- **Neue Diagnose B:** vorhandene simulierte Hintergrundumgebung; Datensatzbesitzer 7, angefragte Nachricht 8 mit gleicher Header-ID. Quellenzeilen bleiben korrekt leer, `resourceLabels` enthält trotzdem `from-message-A.txt` und `https://message-a.invalid/private`. Nachweis für AVN-001; kein Beweis falscher Öffnungsentscheidung oder Live-Exfiltration.
- Vorhandene Linux-/Upgrade-/Crashnachweise und aktuelle CI-Ergebnisse wurden geprüft, hier nicht nochmals als neu ausgeführte native Versuche gezählt. Aktuelle vollständige CI ist quellstandspezifisch grün; spätere Implementierungen benötigen neue Nachweise.

## 2. Dynamische Themenlandkarte

Die ursprünglichen Ausgangsbereiche werden für diesen Stand zu acht Hauptbereichen verdichtet. Neue Datenbeziehungen rechtfertigen einen eigenen Bereich für Ressourcenbesitz. Sprache/Design/A11y werden gemeinsam bewertet, weil sie dieselben Oberflächen und Abnahmen betreffen. Performance und Datenschutz teilen die Speicherarchitektur; ihre Arbeitspakete bleiben nach flüchtigen und dauerhaften Daten getrennt.

| Primärbereich | Zugeordnete Aufgaben | Warum diese Gruppierung? / Querverweise |
| --- | --- | --- |
| A — Ressourcenbesitz und nachvollziehbare Befunde | AVN-001, 011 | Neue Quellenreferenzen betreffen Status **und** Beschriftung. Diagnoseexport nutzt denselben Vertrag, ohne ihn neu zu definieren. |
| B — Hintergrund, Speicher und Datenlebenszyklus | AVN-002, 009 | Flüchtige TTL/Mengenlimits und persistierte Identität/Retention sind verschiedene Eingriffe. Bezüge zu A, F und G. |
| C — Lesbarkeit, Schutzwirkung und externe Analysequalität | AVN-003, 004, 005 | Lesbare Eingabe, Heuristikqualität und Providervertrag benötigen unterschiedliche Evidenz und Umgebungen. |
| D — Bedienbarkeit, Sprachen und gemeinsame Gestaltung | AVN-006, 007 | Bestehendes Design wird gezielt abgenommen bzw. bei großer Last verbessert, nicht nochmals neu gebaut. Native OS-/SR-Nachweise werden hier einmal geführt. |
| E — Einrichtung und optionale Administration | AVN-010, 012 | Sichere lokale Profile sind eine lokale Erweiterung. Produktive Enterpriseintegration bleibt ein gesonderter, optionaler Pilot. |
| F — Architektur und unterstützte Werkzeugkette | AVN-008, 013 | Unterstützte Abhängigkeiten und klarere Modulverträge erhalten reproduzierbare Builds und den Datenvertrag aus A/B. |
| G — Paketverteilung, Updates und Rückweg | AVN-014, 015 | Vorbereitung einer konkreten GitHub-Fassung ist von automatischer Verteilung, Signierung und OS-Rollback getrennt. |
| H — Dokumentation und öffentliche Pages | AVN-016 | Quellenlinks, Build und tatsächlicher öffentlicher Inhalt sind verschiedene Nachweise. Releaseinformationen kommen aus G. |

Jede Aufgabe steht nur einmal. Beispielsweise plant AVN-006 die Windows-/VoiceOver-Abnahme; AVN-007 verweist darauf und eröffnet keine zweite Screenreaderaufgabe. AVN-004 und AVN-006 übernehmen die passenden Teile von INFO-08 und TAV-006.03/009.03/010.03/012.03. AVN-015 übernimmt die noch offene automatische Distribution; vorhandene manuelle Upgrades werden nicht nochmals als Neuentwicklung verlangt.

## 3. Priorisierung

**P1 — zuerst bzw. vor einer betroffenen Freigabe:** belegte Zuordnungs-/Lebenszyklusprobleme und fehlende Nachweise, die eine konkrete Produktzusage tragen müssen. Ein blockiertes P1-Paket hält verfügbare unabhängige Arbeit nicht auf.

**P2 — anschließend:** nachgewiesener zusätzlicher Nutzwert, Wartbarkeit oder eine gezielte Untersuchung ohne bisher gemessenen akuten Schaden.

**P3 — später/optional:** zusätzliche Fähigkeiten, deren Zielsystem oder Nutzen erst mit einem konkreten Piloten festgelegt wird.

Aufwand **K/M/G** bezeichnet kleine, mittlere oder größere Arbeit einschließlich risikogerechter Validierung, keine Stundenzusage. Häufigkeit und Feldreichweite sind unbekannt, sofern keine Messung genannt wird. Kritische Risiken werden nicht durch vermeintlich genaue Punktescores verrechnet.

| ID | Primärbereich / Typ | Status des Potenzials | Priorität | Aufwand | Ausführbarkeit / wichtigste Abhängigkeit |
| --- | --- | --- | --- | --- | --- |
| AVN-001 | A / Verbesserung | Restdefekt reproduziert | P1, vor Freigabe der Ressourcenzuordnung | M–G | Lokal; dauerhafte Identitätsentscheidung aus AVN-009 für weitergehende Schemaänderung |
| AVN-002 | B / Optimierung | TTL-/Iteratorbefund reproduziert | P1 | M | Lokal; keine realen Provider nötig |
| AVN-003 | C / Verbesserung | Nachweislücke; Defektvermutung untersuchen | P1, Untersuchung zuerst | M | Lokale MIME-Fixtures; funktionierende Crypto-Runtime für echte verschlüsselte Fälle |
| AVN-004 | C / Verbesserung | Live-Verträge weiterhin blockiert | P1 vor Live-Providerzusage | M + Zugang | Freigegebene Konten, Quoten, Netz- und Testziele |
| AVN-005 | C / Optimierung | Unabhängige Qualitätsbasis fehlt | P2, Untersuchung zuerst | G | Synthetischer Ausbau lokal; unabhängiger Korpus benötigt Datenfreigabe/Review |
| AVN-006 | D / Verbesserung | Native OS-/SR-Abnahme blockiert | P1 vor entsprechender Plattformzusage | M + Systeme | Windows/NVDA, macOS/VoiceOver, echte Standardbrowser/DPI |
| AVN-007 | D / Verbesserung | Große Quellenlisten noch nicht abgenommen | P2, Untersuchung zuerst | M | Lokal; sprachlicher/menschlicher Review zusätzlich nötig |
| AVN-008 | F / Optimierung | Tool-Auditbefunde nachgewiesen | P2 | M | Lokal; unterstützte Upstream-Version, kein Force-Downgrade |
| AVN-009 | B / Optimierung | Dauerbetrieb-/Identitätsgarantien unvollständig | P1, Untersuchung zuerst | M–G | Lokal; keine automatische destruktive Bereinigung vor Vertrag |
| AVN-010 | E / Erweiterung | Schutzprofile noch nicht vorhanden | P2 | M | Bestehender Import-/Vorschauvertrag; Einwilligung bleibt separat |
| AVN-011 | A / Erweiterung | Quellen-Diagnoseexport noch nicht vorhanden | P2 | M | AVN-001/009, Datenschutzprojektion; kein Server nötig |
| AVN-012 | E / Erweiterung | Produktiver Enterprisepilot vorbereitet, blockiert | P3 | G + Zielsysteme | Konkreter Betreiber, ein gewählter Integrationsvertrag, Testsystem/Identitäten |
| AVN-013 | F / Optimierung | Global gekoppelte Kontextlogik vorhanden | P2 | M–G | AVN-001/002/009; reine Modulgrenzen, kein Totalumbau |
| AVN-014 | G / Verbesserung | GitHub-Veröffentlichung 1.24.4 noch offen | P1 nach Korrekturen | K–M | Regressionsfreier finaler Stand, frisches Gate, ausdrücklicher Veröffentlichungsauftrag |
| AVN-015 | G / Erweiterung | Automatische Distribution/Rollbackkanal fehlen | P1 vor automatischer Updatezusage | G + Kanal | ATN/Maintainer- bzw. zulässiger Update-Testkanal, zwei angebotene Versionen, Zielsysteme |
| AVN-016 | H / Verbesserung | Pages-Build belegt, öffentliche Inhaltsprüfung offen | P2 | K–M | Lokal weitgehend möglich; öffentlicher HTTPS-/Browserzugriff erforderlich |

## 4. Konkrete Arbeitspakete

### AVN-001 — Ressourcenbesitz durchgängig isolieren

**Befund:** `background.js::getMessageAnalysisContext` schützt Quellenzeilen in `sourceRecord`, liest für `snapshot().resourceLabels` aber erneut den gemeinsamen Header-Datensatz ohne denselben Eigentumsfilter. Diagnose B zeigt fremde Namen/Links. Die gemeinsame IndexedDB-Basis bleibt `messageHeader`; getrennte Statuskarten allein lösen die Zuordnung nicht vollständig.

**Ergebnis/Nutzen:** E-Mail und Popup zeigen ausschließlich korrekt zuordenbare Ressourcen. Anwender treffen Entscheidungen anhand der richtigen Nachricht; Administratoren erhalten verlässliche Befunde statt vermischter Beschriftungen.

**Umfang:** Quellenzeilen, Beschriftungen, Ressourceninventar und alte Berichte gemeinsam prüfen. Gleiche Header-ID mit verschiedenem Inhalt, MIME-Part-IDs und Links berücksichtigen. Bestehende Daten und unzuordenbare Historie erhalten; bis zur belegten Zuordnung ausdrücklich unbekannt anzeigen. Kein neuer Provider und keine Score-Neugewichtung.

**Priorität/Aufwand:** P1, M–G. Belegter Korrektheitsfehler in der gerade erweiterten Anzeige; reproduzierbarer Grenzfall, Feldhäufigkeit unbekannt. Änderungen an gemeinsamen Schlüsseln haben höheres Migrationsrisiko als ein bloßer Label-Fix.

**Abhängigkeit:** Diagnose lokal vorhanden. Eine dauerhafte Speicher-Neuzuordnung erst nach der Identitätsuntersuchung AVN-009; ein defensiver Anzeige-Fix kann davor erfolgen.

**Akzeptanz:** Nachricht B zeigt weder Namen noch URLs aus A. Das gilt vor/nach Antworten, bei wechselndem letzten Besitzer, nach Neustart und nach Cache-Löschung. Gleiche Namen/Parts verschiedener Nachrichten verschmelzen nicht. Alte Entscheidungen und ungebundene Originaldaten bleiben erhalten.

**Validierung:** Erweiterte simulierte Regression aus Diagnose B; zwei echte Linux-MIME-Nachrichten mit gleicher Message-ID und verschiedenen Ressourcen. Nachricht und Popup parallel vergleichen; neue Paketbindung. Keine Live-Konten nötig.

### AVN-002 — TTL tatsächlich freigeben und Quellenkontexte begrenzen

**Befund:** `runtime.js::ExpiringMap` prüft Ablauf nur in `has/get`; `values/size` sind geerbte Map-Verfahren. `background.js::messageAnalyses` hat kein eigenes Mengenlimit, `analysisByHeader` iteriert über `values`. Diagnose A beweist weiter vorhandene abgelaufene Einträge. Reale Speicher-/Latenzfolgen sind noch nicht gemessen.

**Ergebnis/Nutzen:** Lange Thunderbird-Sitzungen halten keine unbegrenzt wachsende Menge geschlossener Nachrichtenkontexte. Abgelaufene Kontexte werden nicht weiter als aktuelle Kandidaten verwendet.

**Umfang:** Ablauf-/Iterationsvertrag und Mengenlimit festlegen, gezielte Bereinigung sowie Disposal von Timern/Tabs/Observern integrieren. Laufende Anfragen dürfen nach Eviktion keinen fremden Kontext bedienen oder gelöschte Daten rekonstruieren. Keine Löschung dauerhafter Befunde; diese gehört AVN-009.

**Priorität/Aufwand:** P1, M. Deterministisch belegte fehlende Speicherfreigabe; die konkrete Häufigkeit hängt von offenen Nachrichten und Sitzungsdauer ab. Änderungen am gemeinsam benutzten Cache haben Regressionsrisiko für Reputation und Auditsessions.

**Abhängigkeit:** Alle `ExpiringMap`-Nutzer inventarisieren; bestehende Endzustands-/Cache-Löschgarantien beibehalten.

**Akzeptanz:** Ablauf ist auch über Iteration und Größenangabe wirksam; eine festgelegte Kontextobergrenze gilt unabhängig von Schlüsseln. Eviktion stoppt eigene Timer/Referenzen. Verspätete Antworten ändern weder andere Nachrichten noch historische Entscheidungen. Profil-RSS und Reaktionszeit werden gemessen, ohne eine unbegründete Prozentvorgabe.

**Validierung:** Fake-Uhr, viele eindeutige Nachrichten, wartende Anfragen und Audit-PENDING; anschließend lange isolierte Linux-Sitzung mit synthetischer Post. Simulation misst Cachevertrag, nativer Lauf tatsächlichen Ressourcenverbrauch.

### AVN-003 — Lesbarkeit und MIME-/Verschlüsselungsabdeckung klären

**Befund:** `handleDisplayedMessage` liest `getFull`, `extractTextFromParts` sammelt Text/HTML; `evaluateAndInjectThreats` markiert die lokale Prüfung als abgeschlossen. Eine explizite `decryptionStatus`-Auswertung oder Abnahmematrix für OpenPGP/S/MIME ist in den untersuchten Pfaden nicht vorhanden. Die vorhandenen nativen Fälle nutzen synthetischen Klartext. **Hypothese:** leere/nicht verfügbare Inhalte könnten zu einem zu vollständig wirkenden lokalen Prüfstatus führen; kein bestätigter konkreter Entschlüsselungsfehler.

**Ergebnis/Nutzen:** Nutzer erkennen, welche Inhalte wirklich gelesen wurden und wann nur eine begrenzte Prüfung möglich war.

**Umfang:** Zuerst tatsächliche Thunderbird-Antworten für Text, HTML, verschachtelte MIME, signierte, verschlüsselte und nicht entschlüsselbare Nachrichten erheben. Danach nur belegte Lücken in Prüfstatus/Prüfumfang und Fehlermeldung schließen. Keine eigene Kryptographie oder neue Scanengine.

**Priorität/Aufwand:** P1-Untersuchung, M. Schutzrelevante Aussage; Eingangsabdeckung ist wichtiger als mehr Heuristikregeln. Änderungen erst nach API-Befund, damit legitime leere Nachrichten nicht pauschal fehlerhaft erscheinen.

**Abhängigkeit:** Funktionierende OpenPGP-/S/MIME-Komponenten und isolierte Testschlüssel/-zertifikate für die entsprechende native Teilabnahme; fehlende Runtime-Komponente als konkreten Blocker melden.

**Akzeptanz:** Jede untersuchte Nachrichtenform hat einen belegten Lesbarkeits-/Abdeckungsstatus. Nicht verfügbare Inhalte werden nicht allein aufgrund Score 0 als vollständig geprüft behandelt. Anhänge/Teilprüfungen bleiben nachvollziehbar. Historische Entscheidungssnapshots werden nicht rückwirkend ergänzt.

**Validierung:** Synthetische MIME-API-Antworten plus echte Linux-Thunderbird-Nachrichten, einschließlich gezieltem Entschlüsselungsfehler. Native Plattformerweiterung über AVN-006.

### AVN-004 — Reale Providerverträge abnehmen

**Befund:** Adapter-/Fehlerverträge sind simuliert geprüft, reale Provideridentitäten und kontrollierte Live-Ziele fehlen. Belege: `providers.js`, `api_gateway.js`, [Provider-Abnahmematrix](SCHUTZWIRKUNG_VALIDIERUNG_2026-11.md) und [vorbereitete Abläufe](ABNAHME_INFORMATIONSDARSTELLUNG_EXTERN.md).

**Ergebnis/Nutzen:** Tatsächliche Authentifizierung, Antwortformate, Quoten und Abschlusszustände aller fünf optionalen Dienste sind bekannt. Die jetzige Implementierung wird nicht nochmals entwickelt.

**Umfang:** Erlaubte Hash-/Datei-/URL-/Domain-/IP-Wege pro Dienst, 429/Fehler und Widerruf mit harmlosen freigegebenen Artefakten. Kein Massenversand, keine vertraulichen E-Mails und keine Quotenanhebung. Teil von INFO-08/TAV-006.03, hier einziges Arbeitspaket dafür.

**Priorität/Aufwand:** P1 vor produktiven Providerzusagen, M plus Zugang. Hoher Schutz-/Verlässlichkeitsnutzen, aber aktuelle API-Abweichungen sind nicht belegt.

**Blocker:** Testkonten, erlaubte Quoten, Host-/Datenfreigaben, Netzfreigaben und kontrollierte Artefakte. Der Nutzer hat keine zusätzlichen Ressourcen bereitgestellt.

**Akzeptanz:** Echte Antworttypen und Anzeige stimmen überein. Auftrag bleibt Auftrag, unbekannt bleibt unbekannt, Fehler wird nicht sauber gecacht. Keine Anfrage ohne notwendige Freigabe; Detailsansicht erzeugt keine zusätzliche Übermittlung. Keine festen Erwartungsscores für veränderliche öffentliche Reputation.

**Validierung:** Echte Thunderbird-API und tatsächliche Provider-HTTP-Antworten separat protokollieren; Konto-/Keywerte nie im Bericht. Fehlende Dienste bleiben offen, statt simuliert freigegeben zu werden.

### AVN-005 — Schutzqualität unabhängig untersuchen

**Befund:** Der frische Risikokorpus besteht, umfasst aber nur neun synthetische Verhaltensfälle. `risk.js` enthält transparente, regelbasierte Gewichtungen. [Schutzwirkungsbericht](SCHUTZWIRKUNG_VALIDIERUNG_2026-11.md) benennt fehlende Feldlabels.

**Ergebnis/Nutzen:** Begrenzungen und Fehlalarmarten werden belastbar erkannt, bevor Regeln/Whitelist/Schwellen verändert werden.

**Umfang:** Repräsentativere legitime Gegenbeispiele, Sprach-/PSL-/Weiterleitungsfälle und unabhängig gelabelte verdächtige Beispiele; Entwicklungs- und Abnahmedaten trennen. Keine Erkennungsquote aus selbst konstruierten Fällen ableiten und keine rückwirkende Scoreänderung im Audit.

**Priorität/Aufwand:** P2, G. Hoher potenzieller Nutzen, aber ohne unabhängige Stichprobe keine belastbare Priorität einzelner neuer Signale. Synthetischer Ausbau ist lokal möglich.

**Blocker/Abhängigkeit:** Datenfreigabe, unabhängige Labels und fachlicher Review für reale Qualitätsaussagen; AVN-003 für tatsächliche Eingangsabdeckung.

**Akzeptanz:** Pro vorgeschlagener Regel legitime Gegenbeispiele und begründeter Nutzwert; klar getrennte Trainings-/Abnahmefälle. Reale Metriken nur bei geeigneter Stichprobe mit erläuterten Grenzen. Damalige Scores/Entscheidungen bleiben unverändert.

**Validierung:** Echter Extension-Riskcode statt React-Simulationsengine; synthetische Verträge und separat freigegebene Korpusprüfung. Reale Providerqualität bleibt AVN-004.

### AVN-006 — Windows/macOS, Standardbrowser und native Zugänglichkeit

**Befund:** Echte Linux-UI und OS-Zustellung sind belegt; Windows/macOS, NVDA/VoiceOver, native DPI/High Contrast fehlen weiterhin. Browser-/axe-Erfolg ist kein Ersatz. Übernimmt die entsprechenden Teile von INFO-08 und TAV-009.03/010.03/012.03.

**Ergebnis/Nutzen:** Plattformbezogene Installation, Tastatur-/Screenreaderbedienung und Öffnungsanforderungen sind tatsächlich abgenommen.

**Umfang:** Je Zielsystem Installation/Upgrade, E-Mail-/Popupdarstellung, Fokus/Liveansage bei später Antwort, Kontrast/Skalierung, native Downloadablage und Standardbrowser. OPENED bleibt auch bei erfolgreicher OS-Probe ausschließlich Thunderbirds Annahme; ein kontrollierter tatsächlicher Browserbesuch wird separat beobachtet.

**Priorität/Aufwand:** P1 vor entsprechender Plattform-/A11y-Zusage, M plus Systeme. Reichweite potenziell groß, konkrete aktuelle OS-Fehler bisher unbekannt.

**Blocker:** Windows mit NVDA und macOS mit VoiceOver samt tatsächlichem Standardbrowser; keine zusätzlich verfügbaren Ressourcen.

**Akzeptanz:** Lesbare Quellen-/Ressourcen-/Entscheidungsdarstellung in beiden Ansichten; Enter/Leertaste/Tab, stabile Details/Fokus und sinnvolle Ansagen. Keine Farbaussage als einzige Warnung. Unterbrechung und Öffnungsfehler erfinden keinen Abschluss oder Besuch.

**Validierung:** Reale Zielsysteme mit Paket-/OS-/Thunderbird-/SR-Versionen; kontrollierte synthetische Mail und Website. Fehler- und Erfolgsbelege getrennt. [Vorbereitete Abnahme](ABNAHME_INFORMATIONSDARSTELLUNG_EXTERN.md) wiederverwenden.

### AVN-007 — Große Quellenansichten und sprachliche Verständlichkeit prüfen

**Befund:** `analysis_status.js::render` kann bis zu 1.200 Quellenzeilen und 500 Inventareinträge aufbauen. Browserfixtures und native Ressourcenfälle decken wenige externe Befunde ab. Die vorhandenen 101 Anhänge beweisen keine Bedienbarkeit von Hunderten externen Quellenzeilen. **Hypothese:** Leselast und Rendering könnten groß werden; keine gemessene Latenz oder nachgewiesene Verständlichkeitsrate.

**Ergebnis/Nutzen:** Anwender finden relevante Ressource und Warnung auch bei großen Mails, ohne Details oder Quellenalter zu verlieren.

**Umfang:** Zuerst lange synthetische Listen in sechs Sprachen messen und Suchaufgaben definieren. Nur bei bestätigtem Bedarf Gruppenfilter, stufenweises Rendern oder Pagination ergänzen. Keine erneute pauschale Neugestaltung des vorhandenen Designsystems. Sprachreview auf Statusbegriffe und neue Fehlermeldungen begrenzen.

**Priorität/Aufwand:** P2, M. Zusätzlicher Nutzwert bei großen Nachrichten; reale Häufigkeit unbekannt. Reorganisation birgt Fokus-/Warnsichtbarkeitsrisiken.

**Abhängigkeit:** AVN-001; gemeinsame Tokens/Fokusverträge beibehalten. Muttersprachlicher und menschlicher Aufgabenreview sind zusätzliche Nachweise, automatisiert nicht ersetzbar. Native SR-Prüfung ausschließlich AVN-006.

**Akzeptanz:** Relevante Warnungen bleiben ohne vollständiges Aufklappen erkennbar; Filter/Details verlieren keine Ressource, Zeit oder Quellenart. Keine abgeschnittenen Inhalte bei schmalem Popup/200 %; Labels in EN/DE/FR/ES/IT/PL semantisch geprüft. Vorher-/Nachher-Messung begründet einen tatsächlichen Umbau.

**Validierung:** Chromium/axe mit großen Listen, echten Tastaturaktionen und Hell/Dunkel/Dichte; gezielter Linux-Thunderbird-Lauf und separat dokumentierter Sprach-/Nutzerreview.

### AVN-008 — Unterstützten Weg aus den Tool-Auditbefunden finden

**Befund:** Frisches npm-Audit: neun moderate/ein niedriger Befund; ohne Dev-Abhängigkeiten null. Unter anderem minimatch und deepmerge liegen im web-ext/addons-linter-Baum. Automatisch angebotener web-ext-Downgrade auf 3.2.1 ist kein geprüfter MV3-Reparaturweg.

**Ergebnis/Nutzen:** Reproduzierbare, unterstützte Build-/Lintwerkzeuge ohne unbewertete Erreichbarkeit bekannter Probleme.

**Umfang:** Erreichbarkeit und Upstream-Versionen untersuchen, dann gezielter unterstützter Updateversuch. Kein `audit fix --force`, kein blindes Override, keine Behauptung einer XPI-Runtime-Lücke allein aus Auditanzahl.

**Priorität/Aufwand:** P2, M. Konkrete Befunde, aber begrenzte direkte Produktreichweite; keine hohen/kritischen Befunde. Priorität steigt bei belegter ausnutzbarer Eingabe im CI-/Maintainerworkflow.

**Abhängigkeit:** Unterstützte Upstreamlösung; bei fehlendem Fix explizite Restbewertung statt falschem „behoben“.

**Akzeptanz:** Lockfile, reproduzierbare Installation, MV3-Lint, Browser-/native Prüfharness und Paketinhalt bleiben kompatibel. Restbefunde nach Einsatzbereich/Erreichbarkeit dokumentieren. Unveränderte Runtimebytes sind nicht automatisch durch ein neues Toolaudit kompromittiert.

**Validierung:** Saubere Node-22/unterstützte Node-Installation, Audit vor/nach Änderung, Build/Lint und relevante Release-/Pakettests. Kein erneutes vollständiges natives Feldprogramm nur wegen einer Text-/Toolbewertung, sofern Paketbytes und Verhalten unverändert bleiben.

### AVN-009 — Dauerhafte Identität und Retention im Dauerbetrieb absichern

**Befund:** `getSharedDB` cached die Verbindung und führt `pruneStore` nur beim ersten Öffnen aus. `pruneStore` begrenzt dann 30 Tage/1.000 Headerdatensätze. Fortlaufende Schreibvorgänge garantieren diesen Grenzwert nicht. `analysisStatusByMessage` wächst per Objektspread, ohne eigene Mengen-/Altersgrenze; numerische Nachrichten-IDs und Wiederherstellung wurden für diese Quellenkarten noch nicht nativ über alle Lebenszyklen geprüft. `updatedAt` wird auch durch Quellenanzeige erneuert. Kein gemessener tatsächlicher Quotenfehler behauptet.

**Ergebnis/Nutzen:** Anwender und Administratoren können Aufbewahrung und Datenbesitz auch in langen Sitzungen verstehen; Statushistorien verursachen keine unkontrollierte Vervielfachung.

**Umfang:** Zuerst Lebenszyklus von IDs bei Verschieben/Kopieren/Löschen/Komprimieren/Neustart/Restore erheben und Speichergröße messen. Festlegen, ob Altersgrenzen seit Befund oder seit Aktivität gelten. Danach begrenzte, nebenläufigkeitssichere Bereinigung/Migration der Analysedaten implementieren. Auditretention separat erhalten; keine stillschweigende neue Löschpolitik.

**Priorität/Aufwand:** P1-Untersuchung, M–G. Direkte Verbindung zu Datenschutz, Quoten und AVN-001; neue Metadaten erhöhen die Relevanz. Reale Häufigkeit/Größe bisher unbekannt; destruktive Migration hat erhöhtes Risiko.

**Abhängigkeit:** Entscheidung über Identität und Aufbewahrungsvertrag vor Änderung. Nutzerhistorien und unbekannte Legacydaten erhalten; neues Schema nur bei Bedarf.

**Akzeptanz:** Vereinbarte Dauerbetriebsgrenzen gelten nach fortlaufenden Inserts und Aufrufen, nicht nur nach Neustart. Persistierte Ressourcen bleiben nach den untersuchten Operationen korrekt oder ausdrücklich unzuordenbar. Löschung ist atomar/fehlersichtbar; `PENDING`, damalige Versionen, URL-/Score-/Providerentscheidungen bleiben unverändert. Alte Befundzeit wird durch Betrachten nicht verjüngt.

**Validierung:** Fake-Uhr-/Quota-/Transaktionsprüfungen; echte Linux-Profile mit kontrollierter Nachrichtenbewegung und Wiederherstellung. OS-Abweichungen über AVN-006. Backup vor jeder migrationsrelevanten nativen Probe.

### AVN-010 — Vorschaupflichtige lokale Schutzprofile ergänzen

**Befund:** `options.js::LocalSettingsProfile` und `docs/schemas/local-settings-profile-v1.json` übertragen nur Darstellung, Akzent und Dichte. Wiederverwendbare Schutzkonfiguration ist eine zusätzliche Fähigkeit, nicht bereits produktiv vorhanden.

**Ergebnis/Nutzen:** Wiederholte Einrichtung für Nutzer/Administratoren wird nachvollziehbar, ohne API-Schlüssel und Einwilligungen zu verteilen.

**Umfang:** Separates versioniertes Schutzprofilschema mit erlaubter Positivliste, Vorschau/Diff, ausdrücklicher Anwendung, Abbruch und Konflikterkennung. Zunächst lokale Schutzoptionen/manuellen Modus; keine Schlüssel, globale Einwilligung, Host-/Datenrechte oder unbemerkte Sender-/Authserververtrauensfreigaben importieren. Erscheinungsprofile bleiben kompatibel.

**Priorität/Aufwand:** P2, M. Erkennbarer Einrichtungsnutzen, kein belegter Schutzdefekt. Profilanwendung kann Schutzverhalten ändern und benötigt deshalb klare Vorschau.

**Abhängigkeit:** Bestehenden Vorschau-/Bestätigungsvertrag wiederverwenden; Datenklassifikation und erlaubte Felder vor Implementierung festlegen.

**Akzeptanz:** Nicht erlaubte/aktive/fehlgeformte Daten werden abgelehnt, statt teilweise angewandt zu werden. Ein Import startet keine externe Anfrage und erteilt keine Berechtigung. Abbruch und Fehler lassen alte Werte erhalten. Sechs Sprachen erklären tatsächliche Auswirkungen.

**Validierung:** Schema-/Storagefehler und veraltete Entwürfe simuliert; echter Linux-Import/-Export und Upgrade mit bestehenden Erscheinungsprofilen. Keine Unternehmensintegration durch Profilimport behaupten.

### AVN-011 — Datenschutzarmen Export des Quellenprüfstands ergänzen

**Befund:** Minimaler allgemeiner Supportexport vorhanden (`options.js`); ein nachvollziehbarer Export des konkreten Nachrichten-Quellenstatus fehlt. Wiederkehrender Nutzerbedarf ist die Frage, ob und wie ein externer Dienst beteiligt war.

**Ergebnis/Nutzen:** Nutzer/Support können Zustand, Quelle und Alter nachvollziehen, ohne Screenshots mit vertraulichen URLs oder Dateinamen teilen zu müssen.

**Umfang:** Separater ausdrücklich ausgelöster lokaler Export mit Vorschau; standardmäßig nur Dienst, Scope, Zustand, Ergebnisquelle und benötigte Zeiten sowie abstrahierte Ressourcenordinale. Keine Roh-URLs, Keys, Hashes, IPs, Mailtexte, Betreff/Absender oder internen Profil-/Nachrichten-IDs. Keine automatische Serverübertragung. Kein authentifizierter Enterprisebeleg daraus machen.

**Priorität/Aufwand:** P2, M. Konkreter Support-/Administrationsnutzen, aber zusätzliche Datenfreigabefläche.

**Abhängigkeit:** AVN-001 und Identitäts-/Aufbewahrungsvertrag aus AVN-009. Exportiert dokumentierte Befunde, keine erfundene vollständige Historie.

**Akzeptanz:** Klar lesbare Vorschau und Abbruch; strikte Datenprojektion auch bei unerwarteten Feldern. Nach Cache-Löschung kein Export gelöschter Daten. Zeitpunkte und unbekannte Herkunft unverändert; keine neue Prüfung ausgelöst.

**Validierung:** Datenschutz-Negativfälle und Dateidownload simuliert, tatsächlicher Thunderbird-Downloads-Export unter Linux; weitere OS-Dialoge AVN-006.

### AVN-012 — Einen begrenzten optionalen Enterprisepilot definieren

**Befund:** Deaktivierte Profile sowie umfangreiche lokale Node-Verträge/Reviews sind vorhanden; `enterprise/acceptance.cjs` weist fehlende Produktionskernpfade aus. Ein produktiver Policy-/SSO-/SEALED-/Rolloutnachweis fehlt. Weitere Profilnamen würden das nicht schließen.

**Ergebnis/Nutzen:** Unternehmensadministratoren erhalten einen prüfbaren, betreibbaren begrenzten Integrationspfad statt einer breiten, unbewiesenen Plattformzusage.

**Umfang:** Zuerst Betreiber und genau einen Zielvertrag auswählen, Datenfluss/Identitäten/Betrieb/Support/Retention/Abnahmeschritte festlegen. Vorhandene Outbox-/Broker-/Public-Key-Werkzeuge wiederverwenden. Keine gleichzeitige Implementierung aller Clouds, IdPs und Ticketdienste; Communitybetrieb ohne Integration bleibt vollständig möglich.

**Priorität/Aufwand:** P3, G plus Systeme. Hoher möglicher Adminnutzen, aber Zielauswahl und Betriebsvoraussetzungen fehlen; erhöhtes Betriebs-/Änderungsrisiko. Kein Releaseblocker für die lokale Communityfunktion.

**Blocker:** Konkreter Unternehmensbetreiber, freigegebene Zielsysteme/Identitäten und Entscheidungen über Policy-/Storage-/SSO-Pfad. Lokale Unterlagen/Vertragsarbeit kann davor erfolgen; produktive Abnahme nicht.

**Akzeptanz:** „Konfigurationsprofil“, „lokales Werkzeug“ und „produktive Integration“ bleiben im UI/Runbook unterscheidbar. Kein enabled/productionAccepted/SEALED allein durch Auswahl oder simulierte Quittung. Produktive Freigabe nur mit passenden tatsächlichen Nachweisen und definiertem Rückweg.

**Validierung:** Zunächst vorhandene lokale Vertrags-/Negativtests, danach genau gewähltes reales Zielsystem und Betriebsausfälle. Keine ungefragte Kommunikation an externe Administratoren oder Aktivierung aus diesem Plan.

### AVN-013 — Quellenkontexte hinter klaren Modulverträgen bündeln

**Befund:** `background.js::getMessageAnalysisContext` verbindet Datenspeicherung, Modell, Providerverfügbarkeit, Ressourcenlabels, Timer, Injection und Popup-Broadcast in einer Factory. `analysis_status.js` enthält Modell und serialisierbaren Renderer. Hohe Kopplung ist sichtbar; ein pauschaler Totalumbau ist nicht begründet.

**Ergebnis/Nutzen:** Zuordnungs-/Lebenszyklusregeln lassen sich gezielt prüfen und verändern, ohne Hintergrund- und UI-Rennen neu einzuführen.

**Umfang:** Nach den konkreten Korrekturen kleine Grenzen für Identität/Store, Beobachtung und Anzeige festlegen; endliche Zustände, Referenzen und Versionsschemata dokumentieren/typisieren. Bestehende öffentliche Funktionen und Paketladefolge erhalten. Kein erzwungener Bundler-/TypeScript-/Frameworkwechsel.

**Priorität/Aufwand:** P2, M–G. Wartungsnutzen und geringeres Folgerisiko; kein Selbstzweck und keine neue Funktion. Ein Umbau vor der fachlichen Identitätsentscheidung würde nur Fehlannahmen verfestigen.

**Abhängigkeit:** AVN-001/002/009 und deren Verhaltenstests.

**Akzeptanz:** Ein definierter Vertrag für Quellenzustand und Ressourcenbesitz; Renderer startet keine Netz-/DB-Operation. Keine doppelte Implementierung derselben Zustandslogik im Popup und Nachrichtenfenster. Historische Schemata bleiben lesbar.

**Validierung:** Bestehende risikobasierte Vertrags-/Race-/Migrationsprüfungen und Paketladefolge; ein gezielter nativer Nachrichten-/Popupablauf nach der Extraktion. Keine Testvermehrung für reine interne Aufrufdetails.

### AVN-014 — Konkrete korrigierte GitHub-Fassung zur Freigabe vorbereiten

**Befund:** 1.24.4 ist vorbereitet und CI-grün, aber nicht veröffentlicht; AVN-001/002/009 liefern neue Gründe für Korrekturen vor der entsprechenden Produktzusage. 1.24.3 bleibt veröffentlichter Rückbezug. `.github/workflows/release.yml` übernimmt genau geprüfte Bytes; `scripts/publish-release.js` verweigert abweichende bestehende Assets.

**Ergebnis/Nutzen:** Ein eindeutig installierbarer, prüfbarer Nachfolger mit zutreffendem Funktions-/Grenzenbericht.

**Umfang:** Nach den priorisierten Korrekturen Versions-/Releaseumfang festlegen, neue Paketbindung und zielgenaue Regression durchführen, Notizen/Downloadverweise konsistent vorbereiten. Kein Wiederverwenden alter Prüfsummen für neue Builds, kein Überschreiben von 1.24.3.

**Priorität/Aufwand:** P1 im Freigabeschritt, K–M. Unmittelbarer Nutzwert für Installation; vorherige Fachkorrekturen und ausreichende Evidenz sind Voraussetzung.

**Abhängigkeit:** AVN-001/002; AVN-009-Vertragsentscheidung und neu bewertete AVN-003-Ergebnisse. Blockierte Zusagen aus AVN-004/006/015 entweder tatsächlich abnehmen oder explizit aus Freigabeumfang ausnehmen. Veröffentlichung bedarf eines konkreten Veröffentlichungsauftrags; der jetzige Auftrag verlangt nur den Plan.

**Akzeptanz:** Source, Version, Tag, getestete Bytes und Assets passen zusammen. Historische Daten/Entscheidungen bleiben im Upgrade erhalten. Releasebeschreibung unterscheidet Linux-Teilabnahme, andere Plattformen, optionale Dienste und ATN. Ein Quellcommit ist keine Signatur des XPI.

**Validierung:** Frische vollständige CI mit Browser-/Clientnachweisen und Candidate-Gate; tatsächliche Veröffentlichung später separat prüfen, XPI-Hash mit veröffentlichten Bytes vergleichen.

### AVN-015 — Automatische Updates und Rückweg auf echtem Kanal prüfen

**Befund:** Manifest ohne eigenen `update_url`, veröffentlichte GitHub-XPI ausdrücklich unsigniert; kein nachgewiesener automatischer Distributionskanal. Manuelle Linux-Upgrades und vollständiger Profilbackup-Restore sind implementiert/nachgewiesen. Sie beweisen weder automatische Installation noch verlustfreien In-place-Downgrade.

**Ergebnis/Nutzen:** Updates erreichen Anwender zuverlässig; Administratoren kennen Abbruch-/Rückkehrpfad und mögliche Snapshotgrenzen.

**Umfang:** Zulässigen Kanal wählen, zwei angebotene Versionen und tatsächlich installierten automatischen Übergang prüfen, inklusive abgebrochenem Download, Neustart und erneuter Zustellung. Getrennt Rückweg per kontrolliertem Backup bzw. ausdrücklich unterstütztem Verfahren dokumentieren. Nach Backup entstandene Daten nicht stillschweigend verlieren oder als zusammengeführt ausgeben.

**Priorität/Aufwand:** P1 vor automatischer Updatezusage, G plus Kanal. Reichweite aller automatisch versorgten Installationen; Konten/Kanal fehlen. Hohe Daten-/Distributionsrisiken erfordern echte Prüfung.

**Blocker:** ATN-/Maintainerzugang oder zulässiger eigener Testkanal, gegebenenfalls Signierung, gehostete Metadaten und Zielsysteme. Vorhandene Linux-Harness kann vorbereitet werden; Produktivkanal nicht simuliert freigeben. Windows/macOS-Prüfung aus AVN-006 wiederverwenden.

**Akzeptanz:** Angebotene und installierte Version sowie Paketbytes sind belegt. Unterbrechung korrumpiert Profil/Extension nicht; Einwilligung und Audit bleiben erhalten. Kein automatisches erneutes Öffnen von PENDING. Wiederherstellung benennt Snapshotzeitpunkt und nicht enthaltene spätere Daten.

**Validierung:** Echter Updatekanal und tatsächliche Thunderbird-Installation; getrennte OS-/Datei-/Netzfehler. Backup-Restore weiter eigenständig nachweisen, nicht in automatische Rollbackgarantie umbenennen.

### AVN-016 — Dokumentation und öffentliche Pages nach Releaseebenen abnehmen

**Befund:** README/Pagesquellen führen 1.24.3; aktuelle Entwicklungsdokumente enthalten 1.24.4. Zwei Pages-Deploymentjobs für main sind erfolgreich, direkter öffentlicher Abruf ist hier nicht möglich. Historische Protokolle benennen teilweise andere Paketbytes und dürfen nicht als aktueller Nachweis erscheinen.

**Ergebnis/Nutzen:** Nutzer installieren die richtige veröffentlichte Fassung und können Fähigkeiten, Grenzen und Prüfnachweise ohne widersprüchliche Versionsaussage finden.

**Umfang:** Veröffentlichte Downloads, vorbereitete Entwicklung, lokale Werkzeuge und Websimulation konsistent kennzeichnen. Quellen-/Jekyll-/Sprachlinks lokal prüfen; danach gerenderten öffentlichen Inhalt und Downloadkette tatsächlich abnehmen. Keine unnötige Neugestaltung der Website.

**Priorität/Aufwand:** P2, K–M. Direkter Installations-/Vertrauensnutzen; aktuell kein belegter öffentlicher Defekt. Zugriffslücke ist kein 404-Nachweis.

**Abhängigkeit:** Releaseumfang AVN-014 für neue Downloads; erlaubter HTTP-/Browserzugriff auf `vazules.github.io` für öffentliche Teilabnahme.

**Akzeptanz:** Sechs Seiten führen dieselbe tatsächlich veröffentlichte Version; Entwicklungsstand ist separat bezeichnet. Links auf Assets, Datenschutz und Prüfprotokolle funktionieren im gerenderten Auftritt. Alte Prüfbytes bleiben als historische Daten markiert; grüne Deployments werden nicht als Inhaltsabnahme ausgegeben.

**Validierung:** Lokale Link-/Jekyllprüfung und getrennt tatsächlicher öffentlicher HTTPS-/Browserlauf. Keine Veränderung veröffentlichter Inhalte allein durch diesen Plan.

## 5. Roadmap und Freigabeentscheidungen

### Kurzfristig — mit vorhandenen Mitteln

1. **AVN-001:** den reproduzierten fremden Ressourcenbezug abstellen; dauerhafte Identitätsentscheidung aus AVN-009 einplanen.
2. **AVN-002:** Ablauf und Menge flüchtiger Kontexte begrenzen; bestehende Race-/Löschverträge erhalten.
3. **AVN-009, Untersuchung:** dauerhafte IDs, Dauerbetrieb und Retention klären, bevor weitere Datenkarten oder Exporte wachsen.
4. **AVN-003, Untersuchung:** Lesbarkeit/MIME mit lokalen Fixtures erheben; keinen unbelegten Scanabschluss suggerieren.
5. Tool-Erreichbarkeit AVN-008 bewerten und neue Befunde in die Freigabeentscheidung aufnehmen. Verfügbare Arbeit bleibt unabhängig von fehlenden Windows-/Providerressourcen ausführbar.

### Mittelfristig — nach belastbaren Verträgen

- Aus AVN-003/009 nur bestätigte Korrekturen umsetzen; Altbestände und Entscheidungssnapshots schützen.
- AVN-007 an großen Listen untersuchen, AVN-013 nach den fachlichen Korrekturen begrenzt extrahieren.
- AVN-010/011 als lokale, vorschaupflichtige Erweiterungen anbieten, sofern Einrichtungs-/Supportnutzen die zusätzliche Oberfläche rechtfertigt.
- AVN-004/006 ausführen, sobald konkrete Ressourcen vorhanden sind. AVN-014 als neue freigabefähige Fassung vorbereiten; AVN-016 versionsgenau abnehmen.

### Später bzw. abhängig von zusätzlichen Mitteln

- AVN-005 mit unabhängigem Korpus belastbar bewerten; keine erfundenen Erkennungsraten oder pauschalen Scoreänderungen.
- AVN-015 erst mit echtem Kanal/Signierung und unterstützten Zielsystemen als automatische Versorgung freigeben.
- AVN-012 nur mit begrenztem Zielvertrag und tatsächlichem Betreiber als produktive Integration voranbringen. Diese Arbeit blockiert die lokale Communityfunktion nicht.

### Die drei sinnvollsten nächsten Pakete

**1. AVN-001 — Ressourcenbesitz:** unmittelbar reproduzierbarer Widerspruch zur versprochenen richtigen Mail-/Ressourcenzuordnung. Die Anzeige beeinflusst das Verständnis von Prüfständen; ein eigener, adversarieller Gegenfall ist vorhanden. Lokal ohne neue Konten ausführbar.

**2. AVN-002 — echte TTL und Begrenzung:** ebenfalls reproduziert. Die Zahl eindeutiger geöffneter Nachrichten kann wachsen, obwohl das Cacheobjekt zeitlich begrenzt aussieht. Ein kleiner, klarer Lebenszyklusvertrag verhindert Folgerisiken und schafft eine belastbare Basis für weitere Quellenfunktionen.

**3. AVN-009 — dauerhafte Identität/Retention untersuchen:** neue Quellenkarten verwenden numerische Nachrichten-IDs und eine gemeinsame Headerbasis. Ihre Lebensdauer und Bereinigung müssen vor einer aufwendigeren Migration oder Erweiterung geklärt sein. Eine Untersuchung ist hier sinnvoller als ungeprüft neue Indizes, Exportfelder oder Löschmechanismen einzubauen.

## 6. Ausführbarkeit und zusätzlich benötigte Voraussetzungen

**Jetzt ausführbar:** AVN-001/002; Untersuchungen und lokale Anteile von AVN-003/005/007/009; AVN-008; darauf aufbauend AVN-010/011/013; konkrete Paket-/Doku-Vorbereitung AVN-014/016. Linux-Thunderbird, synthetische Testdaten, vorhandene Werkzeuge und GitHub-Lesefunktionen sind verfügbar. Produktcode und veröffentlichte Assets bleiben in diesem Planungsauftrag unverändert.

**Zusätzliche Mittel:** freigegebene Providerkonten und Testziele für AVN-004; Windows/NVDA und macOS/VoiceOver für AVN-006; unabhängige Daten/Labels für reale Qualitätsmetriken AVN-005; menschliche Sprach-/Verständlichkeitsprüfung für AVN-007; konkreter Enterprisebetreiber und echte Zielidentitäten für AVN-012; zulässiger automatischer Distributions-/Signierkanal für AVN-015; erlaubter öffentlicher Pages-Zugriff für den letzten Teil von AVN-016. Fehlende Crypto-Runtime bei AVN-003 ist vor einem verschlüsselten nativen Test konkret festzustellen, nicht durch einen Klartexttest zu überdecken.

**Verbindliche Invarianten:** EN/DE/FR/ES/IT/PL bleiben mitgeliefert; gemeinsame Themes/Dichte/Tastaturverträge bleiben erhalten. Externe Analyse und Enterprise bleiben optional. Lokale Scoreheuristik, Providerbefund, Ressourcenart, Prüfzeit und Nutzerentscheidung bleiben getrennt. OPENED bestätigt ausschließlich Thunderbirds Annahme; PENDING wird nach Prozessverlust nicht als Entscheidung umgeschrieben. Bestehende Daten und historische Entscheidungsstände werden bei jeder Korrektur und Migration erhalten.
