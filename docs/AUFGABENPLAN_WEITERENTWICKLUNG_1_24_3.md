# Thundy AV — Aufgabenplan für die nächste Weiterentwicklung

Die nachfolgende Analyse ist die Ausgangsaufnahme. Die anschließende Umsetzung und aktuelle Abnahme sind im [Ausführungsprotokoll](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md) dokumentiert.

Stand: 2. November 2026. Grundlage ist der **vorbereitete Kandidat 1.24.3**, nicht die unveränderte Standardbranch-Version. Auftrag dieser Runde: analysieren und planen. Produktcode, Einstellungen, Releases und bestehende Entscheidungsdaten werden in dieser Runde nicht geändert.

## 1. Aktuell verifizierter Stand

| Quelle | Ergebnis dieser Analyse |
| --- | --- |
| Arbeitsbaum | Zu Beginn sauber; Branch `codex/thundy-followup-20261102`, Commit `3024636c84827d18fa80495311160e89c1483bb7` |
| Remote-Standardbranch | Nach erneutem Fetch weiterhin `6046fe0427f53e12377c167e98385e57f533c790`; der Kandidat ist dort noch nicht integriert |
| PR | [#719](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/719) offen, Entwurf, nicht zusammengeführt; Head entspricht dem untersuchten Commit |
| Veröffentlichung | [GitHub 1.24.2](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.2) weiterhin neuester veröffentlichter Release; API-Abfrage bestätigt veröffentlicht, kein Entwurf/Prerelease. 1.24.3 ist vorbereitet |
| Aktuelle CI | [PR-Lauf](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41384961993) und [Push-Lauf](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41384954564) am untersuchten Head erfolgreich |
| Erneut lokal ausgeführt | `npm run check:source` erfolgreich: Pre-submit, sechs Sprachkataloge/Fallback, PSL, Design und aktuelle Dokumentverweise |
| Paketidentität | `node scripts/candidate-evidence.js`: `ok:true`; vorhandenes XPI/ZIP entspricht dem Quellfingerprint und den gespeicherten Live-/Browserberichten |
| Erneutes npm-Audit | 10 Meldungen: 9 mittel, 1 niedrig, keine hohe/kritische Meldung im geprüften npm-Abhängigkeitsbaum; keine Gleichsetzung mit einer vollständigen Sicherheitsprüfung des Add-ons |
| Verfügbare zusätzliche Ressourcen | Nutzer hat ausdrücklich **keine zusätzlichen Ressourcen** bestätigt. Aktuelle Runtime ohne Secrets, Unternehmensidentitäten oder Infrastrukturcapabilities |

Die vorhandene Evidenz umfasst 976 automatisierte Tests, 600 Browserfälle plus 36 CSS-Zoomfälle sowie echte Linux-Abnahmen mit Thunderbird 140.12.0/153.6.0 ESR, sechs Sprachprofilen, Neustart/Prozessverlust und gesondertem Profilrestore. Diese Läufe wurden in der vorigen Umsetzung durchgeführt; sie wurden hier anhand ihrer Berichte, Paketbindung und aktuellen CI überprüft. Diese Analyse wiederholt keine vollständige native Abnahme. Chromium/axe mit API-Testdoubles bleibt eine Simulation; echte Screenreader-/OS-Nutzung ist damit nicht bewiesen.

Bereits umgesetzt bleiben unter anderem Dependency-Reparatur, PSL-Abgleich, Reportpersistenz/Polling, Provider-Authverdrahtung, Popup-Lebenszyklus, lokalisierte Abbruch-/PENDING-Texte, Demoabgrenzung, aktuelle Datenschutzquellen und der lokale Offline-Auditreview. Daraus entstehen keine erneuten „Implementieren“-Aufgaben.

Bezüge: [bisherige Ausführungsliste](AUSFUEHRUNG_AUFGABEN_2026-11-02.md), [Abschlussprotokoll](audits/ausfuehrung-2026-11-02.md), [versionsgebundene Clientabnahme](live_test_1_24_3.md), [Werkzeug-Abhängigkeiten](DEPENDENCY_AUDIT_2026-11.md).

## 2. Neue Befunde und ihre Evidenzstärke

Die aktuellen, nur lesenden Proben sind in [weiterentwicklungsanalyse-1_24_3.json](audits/weiterentwicklungsanalyse-1_24_3.json) gespeichert. Sie führen echte Repository-Funktionen mit synthetischen Eingaben/Testdoubles aus; es erfolgen keine Provideranfragen und keine neuen Thunderbird-Liveprüfungen.

| Befund | Beobachtung | Einordnung |
| --- | --- | --- |
| N01/N02 — Authentifizierungsparser | `risk.js:114`, `evaluateAuthHeaders`: `spf=passage; dkim=passage; dmarc=passage` ergibt `authStatus:pass`. Auch `spf=pass (comment: dkim=pass dmarc=pass)` ergibt pass | Im Parser reproduziert. Ergebniswörter werden als Teilzeichenfolgen und innerhalb eines Kommentars erkannt. Reale Ausnutzbarkeit hängt zusätzlich von Headerherkunft und Trusted-Authserver-Konfiguration ab; keine belegte Mailserverumgehung |
| N03 — fehlende Herkunft eines Fallbacks | `background.js:1294`, `checkHybridAnalysisVerdict`: bei simuliertem Abruffehler wird der übergebene gespeicherte Zustand zurückgegeben. `handleCheckLinkState` liefert keine gesonderte Fehler-/Frischekennzeichnung | Rückfallsemantik reproduziert. Der untersuchte normale URL-Schreibpfad setzt UPLOADED/UNKNOWN; auch UPLOADED wird unverändert zurückgegeben. Ein zusätzlich eingesetzter synthetischer CLEAN-Altdatensatz bleibt CLEAN. Herkunft und reale Verbreitung solcher positiven Cachezustände sind zuerst zu untersuchen |
| N04 — widersprüchliche Prüfnachweise | `scripts/candidate-evidence.js:49`, `validateReports` akzeptiert einen synthetischen Browserbericht mit `passed:1`, `planned:1`, `failed:0`, aber sechs tatsächlich als failed markierten Ergebniszeilen | Reproduzierte Validierungslücke. Die vorhandenen echten Browserberichte haben passende Zähler, passende Ergebnislänge und ausschließlich bestandene Zeilen. Kein Nachweis manipulierter oder fehlgeschlagener bisheriger CI |
| N05 — Schreibzugriffe beim Lesen | `link_audit.js:132/16`: drei unveränderte `readLinkAudit()`-Aufrufe erzeugen in der synthetischen Storageumgebung drei `storage.local.set`-Aufrufe | API-Verhalten reproduziert. Reale Datenträgerzugriffe, Speicherbedarf und wahrnehmbare Verzögerung sind nicht gemessen; daraus folgt zunächst eine Performanceuntersuchung |
| N06 — begrenzte Scanabdeckung | `background.js:516/945/1176`: höchstens 100 Domains pro entsprechender Prüfung, 100 Anhänge pro Verarbeitungslauf und 20 Links im Kontextmenü-Stapelscan | Grenzen direkt im Code belegt. Wie vollständig die Oberfläche das Gesamtergebnis solcher Grenzfälle erklärt, muss mit 101-/21-Elemente-Nachrichten geprüft werden. Keine unbelegte Behauptung, alle anderen Verarbeitungspfade seien gleich begrenzt |
| N07 — Begründungen und Entscheidungszeit | `link_audit.js:100` speichert Entscheidungsscore/-urteil/-anbieter, aber keine eigenen damaligen Begründungsfelder; lokale/Providergründe können später ergänzt werden. `audit.js:72` stellt die Gründe gemeinsam dar | Datenmodell/UI direkt belegt. Die Trennung damaliger und späterer Gründe lässt sich verbessern, ohne vorhandene Snapshots umzuschreiben |
| N08 — mehrfach ausgeführte CI | `.github/workflows/ci.yml:5/7/34/141`: Push und PR laufen für denselben Head; Testjob und Kandidatengate führen jeweils die Node-Suite aus. Zwei erfolgreiche Läufe am gleichen SHA sind extern bestätigt | Belegte Doppelarbeit. Tatsächliche Laufzeit-/Kostenanteile müssen vor einer strukturellen Optimierung ausgewertet werden. Keine Prüfschritte ohne gleichwertige Absicherung entfernen |

## 3. Themenlandkarte und Priorisierungsmaßstab

Die Kategorien folgen den neuen Befunden. Sprachen, Design, Datenschutz und Migration sind verbindliche Querschnittskriterien jeder Aufgabe; sie werden nicht als identische Zusatzaufgaben mehrfach angelegt.

| Primärbereich | Neue Arbeitspakete | Betroffene andere Bereiche |
| --- | --- | --- |
| Analysequalität und Aussagekraft | TAV-019 Authheader; TAV-020 Prüfherkunft; TAV-022 Abdeckung | lokale Heuristik, Provider, Warnungen, Audit |
| Entscheidungen und Datenlebenszyklus | TAV-021 Begründungssnapshots; TAV-024 Audit-I/O | Export, Migration, Speicherfehler |
| Prüfbarkeit und Lieferfähigkeit | TAV-023 Nachweisvalidierung; TAV-025 CI-Aufwand; bestehendes TAV-018 | Release, Testergebnisse, Entwicklungswerkzeuge |
| Lokale Bedien- und Administrationsfunktionen | TAV-026 Supportdiagnose; TAV-027 lokale Einstellungsprofile | Datenschutz, Einrichtung, sechs Sprachen |
| Architektur und Verträge | TAV-028 begrenzter Modul-/Nachrichtenvertrag | Wartbarkeit, frühere Befunde, Runtimegrenzen |
| Native und externe Abnahme | bestehende TAV-005/006/009/010/012/013/014/017 | gesondert ressourcenabhängig; keine neuen Doppel-IDs |

**P1:** vor der nächsten fachlichen Kandidatenfreigabe bearbeiten, weil Korrektheit von Ergebnissen, Entscheidungen oder Nachweisen betroffen ist. **P2:** messungsbasierte Optimierung beziehungsweise klar begrenzter lokaler Zusatznutzen. **P3:** spätere Erweiterung nach Bedarfsentscheidung. Aus den neuen Proben ergibt sich keine belegte akute P0-Sicherheitslage.

Priorisiert wird qualitativ nach Anwender-/Adminnutzen, Schutz-/Zuverlässigkeitswirkung, Reichweite, Evidenz, Aufwand, Risiko und Voraussetzungen. Reale Problemhäufigkeiten sind für die neuen Befunde unbekannt. **S** bedeutet eng begrenzte Arbeit, **M** mehrere Code-/UI-/Teststellen, **L** Eingriff in mehrere Verträge/Systeme; keine Stunden- oder Prozentversprechen.

## 4. Priorisierte Aufgabenübersicht

| ID | Entwicklungstyp | Priorität / Aufwand | Konkretes Ergebnis | Mit vorhandenen Mitteln |
| --- | --- | --- | --- | --- |
| TAV-019 | Verbesserung | P1 / M | Authentifizierungsresultate strukturiert und konservativ auswerten | ja; native lokale Gegenprüfung möglich |
| TAV-020 | Verbesserung | P1 / M | aktuellen Abruf, gespeichertes Urteil und fehlgeschlagene Prüfung unterscheiden | ja; echte Providerabnahme bleibt TAV-006.03 |
| TAV-023 | Optimierung | P1 / M | widersprüchliche oder unvollständige Nachweise zuverlässig ablehnen | ja |
| TAV-021 | Verbesserung | P1 / M | Gründe bei Entscheidung von späteren Gründen trennen | ja; baut auf Herkunftsmodell aus 020 auf |
| TAV-022 | Verbesserung | P1 / M | Teilprüfung/ausgelassene Elemente nachvollziehbar anzeigen | ja; zuerst tatsächliche UI-Abdeckung untersuchen |
| TAV-018.03 | Optimierung, fortgeführt | P2 / M–L | unterstützte Behebung verbleibender Linter-Werkzeugmeldungen | Untersuchung ja; Patch-/Migrationsweg noch offen |
| TAV-024 | Optimierung | P2 / S Untersuchung, ggf. M Umsetzung | unnötige Audit-Schreibzugriffe nach Messung reduzieren | ja |
| TAV-025 | Optimierung | P2 / S–M | CI-Doppelarbeit ohne Verlust von Prüfsicherheit reduzieren | ja; erfolgreicher Remote-Lauf ist Abnahmekriterium |
| TAV-026 | Erweiterung | P2 / M | ausdrücklicher lokaler Diagnose-/Supportexport ohne Rohdaten/Secrets | ja |
| TAV-028 | Optimierung | P2 / M Untersuchung, Umsetzung abhängig vom Befund | begrenzte, überprüfbare interne Verträge | ja; keine komplette Neufassung |
| TAV-027 | Erweiterung | P3 / M–L | portable lokale Einstellungsprofile mit Vorschau und sicherem Import | technischer Prototyp ja; Nutzen/Umfang zuerst festlegen |

## 5. Arbeitspakete

### TAV-019 — Authentifizierungsheader strukturiert auswerten

**Befund/Status:** N01/N02, bestätigte lokale Parserabweichung in `evaluateAuthHeaders`. Die vorhandene Trusted-Authserver-Auswahl in `collectThreatEvaluationOptions` bleibt eine getrennte Vertrauensgrenze. Nutzen: verständlichere und verlässlichere Authentifizierungsangaben für Anwender und Support.

**Umfang:** Methoden-/Ergebnistokens, Kommentare, quoted strings, gefaltete Header und mehrere Resultate konservativ verarbeiten. Ungültige/fehlende Ergebnisse bleiben unbekannt/neutral. Keine neue kryptografische SPF-/DKIM-Verifikation und keine DNS-/WHOIS-Anbindung.

**Priorität/Risiko:** P1, M. Starke Funktionsproben, breite potenzielle Reichweite bei betroffenen Headern, reale Häufigkeit unbekannt. Risiko: gültige Serverformate fälschlich verwerfen; deshalb Formatkorpus vor Parseränderung.

**Abhängigkeiten:** keine externen Systeme; Datenvertrag mit 020/028 abstimmen, ohne eine Großrefaktorierung abzuwarten.

**Akzeptanz/Validierung:** `passage`, Ergebniswörter in Kommentaren/Begründungsstrings und fremde Authserver erzeugen kein pass. Gültige pass/fail/softfail/neutral/none/temperror/permerror-Fälle behalten ihre unterschiedliche Bedeutung. Mehrdeutige Resultate erhalten dokumentierte konservative Behandlung. Node-Negativfälle plus importierte synthetische EMLs im echten lokalen Thunderbird; bestehende sechs UI-Sprachen, historische Scores und Entscheidungen bleiben unverändert.

### TAV-020 — Prüfherkunft, Alter und Fehlschlag explizit darstellen

**Befund/Status:** N03. Die Funktion gibt einen Fallbackzustand ohne Herkunft zurück; `link_audit.js:90` setzt anschließend `checkedAt` auf die aktuelle Zeit. Ob ein positiver gespeicherter Status regulär entsteht, ist nicht nachgewiesen. Nutzen: Anwender sehen, welche Aussage tatsächlich aktuell geprüft wurde; Admins können fehlgeschlagene Prüfungen von historischen Informationen unterscheiden.

**Umfang:** zuerst vollständige Matrix erreichbarer gespeicherter Zustände und ihrer Writer erstellen, inklusive alter Versionen. Anschließend strukturiertes Ergebnis mit Prüfversuch, Herkunft, ursprünglicher Beobachtungszeit, Abrufausgang und ggf. historischem Urteil definieren. Ein Prüfversuch ist keine erfolgreiche Aktualisierung. Keine automatische externe Analyse und keine Änderung der freiwilligen Einwilligung.

**Priorität/Risiko:** P1, M. Rückfallverhalten belegt; Risiko einer irreführenden positiven Aussage abhängig von der Zustandsanalyse. Weder sämtliche Providerfehler automatisch zu Malware erklären noch vorhandene Warnbefunde abschwächen.

**Abhängigkeiten:** Untersuchung sofort möglich; 021 und 026 verwenden den festgelegten Vertrag. Echte Providerkonten werden nur für die spätere Live-Abnahme benötigt.

**Akzeptanz/Validierung:** Writer-/Lesermatrix dokumentiert. Ausfall, fehlendes Hostrecht, widerrufene Zustimmung, Timeout, Cachetreffer und erfolgreiches neues Ergebnis sind unterscheidbar. Ein altes Urteil erhält keinen erfundenen frischen Beobachtungszeitpunkt. URL, lokaler Score, Providerurteil und Nutzerentscheidung bleiben getrennt; alte Datensätze ohne Herkunftsfelder werden als unvollständig gekennzeichnet. Deterministische Gateway-/Zeit-/Storage-Tests, sechs UI-Sprachen und echter lokaler Thunderbird-Dialog. Live-Anbieterfälle unter TAV-006.03 weiterführen.

### TAV-021 — Entscheidungsgründe als historische Snapshots ergänzen

**Befund/Status:** N07. Score/Urteil/Anbieter besitzen Entscheidungssnapshots; Gründe haben derzeit keine gleichwertige Zeittrennung. Nutzen: Entscheidungen lassen sich ohne Vermischung mit späteren Erkenntnissen nachvollziehen.

**Umfang:** optionale damalige Gründe einschließlich strukturierter Codes/Parameter und eigener Herkunft vorsehen; spätere lokale/Providergründe separat anzeigen. Exportschema kontrolliert weiterentwickeln. Historische Freitexte erhalten; Übersetzung nur als zusätzliche Darstellung.

**Priorität/Risiko:** P1, M. Direkter Datenmodellbefund, Datenschutz und Historienintegrität betroffen. Keine rückwirkende Rekonstruktion einer vermeintlichen damaligen Begründung aus heutigen Werten.

**Abhängigkeiten:** Herkunfts-/Zeitbegriffe aus 020; bestehendes Audit-/Node-Importformat auf Kompatibilität prüfen. Keine produktive Enterpriseanbindung nötig.

**Akzeptanz/Validierung:** verspätete Score-/Providerantworten ändern den damaligen Grundsnapshot nicht. Früher Abbruch ohne fertige Bewertung bleibt entsprechend unvollständig. Alte Einträge zeigen „damals nicht aufgezeichnet“; ihre Originalfelder bleiben erhalten. JSON/CSV und Offline-Review unterscheiden alt/neu ausdrücklich. Node-Rennentests, Migrationsfixtures und echter Thunderbird-Upgrade-/Neustarttest mit Originaldaten; PENDING/OPENED-Semantik unverändert.

### TAV-022 — Umfang und Grenzen einer Prüfung sichtbar machen

**Befund/Status:** N06, begrenzte Verarbeitung direkt belegt; vollständige Darstellung der Grenzfälle noch zu untersuchen. Nutzen: Anwender können einen Teilbefund von einer umfassenderen Prüfung unterscheiden; Administratoren erhalten konkrete Ursachen für ausgelassene Elemente.

**Umfang:** 101 Anhänge, 101 unterschiedliche Domains und 21 Kontextmenü-Links durch den tatsächlichen Pfad führen. Erkannte, zulässige, bearbeitete, fehlgeschlagene und ausgelassene Elemente mit Gründen abbilden. Bestehende Mengen-/Größen-/Parallelitätsgrenzen zunächst erhalten. Kein automatisches Hochsetzen der Uploadmenge oder Umgehen von Privatsphärestufen.

**Priorität/Risiko:** P1, M. Begrenzungen wirken zuverlässig, Problemhäufigkeit großer Nachrichten unbekannt. Risiko: irreführende Summen durch Deduplizierung, Filter und asynchrone Teilantworten; diese Semantik zuerst festlegen.

**Abhängigkeiten:** Resultatmodell aus 020 hilfreich; Performancefragen mit 024/025 nur referenzieren, nicht doppelt implementieren.

**Akzeptanz/Validierung:** Summen und Duplikatbehandlung sind nachvollziehbar, Limits/Fehler als Gründe sichtbar, ausgelassene Elemente gelten nicht als sauber. Zähler erzeugen keinen heimlichen Upload. Wiederaufnahme/erneute manuelle Prüfung bleibt kontextgebunden. Grenz-/Fehlerfixtures plus echte lokale MIME-Nachrichten in Thunderbird; Anzeige und Statusansagen in allen sechs Sprachen und gemeinsamen Themes.

### TAV-023 — Semantische Integrität der Prüfnachweise absichern

**Befund/Status:** N04, bestätigte negative Vertragslücke. Die bestehende Paket-/Quellbindung ist implementiert; ihre semantische Plausibilitätsprüfung wird ergänzt. Nutzen: Maintainer erhalten keine technische Freigabe durch widersprüchliche oder unvollständig erzeugte Reportdaten.

**Umfang:** versionierte Reportverträge für Browser und echten Client, abgeleitete statt ungeprüft übernommene Summen, erwartete Sprach-/Fallabdeckung, vollständige Status-/Fehlerprüfung. Reale Neustart-/Crash-/PENDING-/Historienfelder gegen die Runnerausgabe prüfen. Historische Berichte erhalten; fehlende neue Felder erhalten einen expliziten Kompatibilitätsstatus.

**Priorität/Risiko:** P1, M. Reproduzierbare Validierungslücke, hohe Reichweite des Freigabewegs. Bestehende echte Berichte sind konsistent; keine nachträgliche Behauptung eines bisher fehlgeschlagenen Produkttests. Gefahr einer ungerechtfertigten Ablehnung gültiger Altberichte durch zu strenge Migration.

**Abhängigkeiten:** vorhandener CI-/Paketweg und verfügbare Linux-/Chromiumumgebung; keine Windows-/ATN-Zugänge erforderlich.

**Akzeptanz/Validierung:** N04-Fixture wird abgewiesen. Falsche Summen, failed/skipped/abgebrochene Zeilen, fehlende Sprachen/Fälle, falsche Version/Hashes und fehlende kritische Recoveryfelder verweigern die betroffene Freigabe. Vollständige aktuelle Reports bleiben gültig. Negative Node-Vertragsfälle plus neu erzeugte echte Client-/Browserreports und kompletter CI-Lauf. Ein Prüfschema oder Hash wird weiterhin nicht als unabhängige Authentisierung der Quelle ausgegeben.

### TAV-024 — Audit-Lese-/Schreibpfad nach Messung entlasten

**Befund/Status:** N05, drei API-Schreibaufrufe bei drei unveränderten Lesezugriffen. Die physische I/O-/Latenzwirkung ist eine Hypothese. Nutzen: geringere unnötige Hintergrundarbeit und kürzere Warteschlangen bei gefülltem Audit, sofern die Messung einen relevanten Anteil zeigt.

**Umfang:** zunächst API-Aufrufzahl, Serialisierungszeit, Lese-/Renderlatenz und ggf. Prozessspeicher bei 0/50/2.000 Einträgen innerhalb 2 MiB ermitteln. Danach nur bei bestätigtem Nutzen Lesen, tatsächliches Pruning und Profil-ID-Erzeugung differenzieren; serialisierte Änderungen und Aufbewahrungsvertrag erhalten. Keine Erweiterung der Auditkapazität ohne Bedarf.

**Priorität/Risiko:** P2; S Untersuchung, M Umsetzung. Belegtes API-Muster, ungemessene Nutzerwirkung. Hohe Anforderungen an Concurrency und Löschkorrektheit begrenzen schnelle Cacheumbauten.

**Abhängigkeiten:** bestehende TAV-015-Baseline verwenden; keine native Zielplattform außerhalb des vorhandenen Linux erforderlich.

**Akzeptanz/Validierung:** Baseline und Hypothesenentscheidung dokumentiert. Bei Umsetzung schreiben unveränderte Folge-Lesezugriffe nicht unnötig; tatsächliche Retention-/Profil-ID-Änderungen werden zuverlässig persistiert. Parallele Entscheidungen, bestätigte Löschung, Quotenfehler und Prozessverlust bewahren dieselben Zustände. Node-Aufruf-/Rennentests und echte Thunderbird-Messung; keine erfundenen Prozent- oder Datenträgergarantien.

### TAV-025 — CI-Doppelarbeit gezielt reduzieren

**Befund/Status:** N08. Zwei vollständige Workflows pro PR-Head und erneute Node-Suite im Kandidatengate sind belegt. Nutzen: schnellere Rückmeldung und geringerer Runnerverbrauch für Maintainer.

**Umfang:** zuerst Lauf-/Jobzeiten und notwendige Ereignisse auswerten. Push-/PR-/Main-/Tag-/workflow_call-Pfade so festlegen, dass erforderliche Änderungen geprüft bleiben. Wiederverwendung des Node-Ergebnisses nur mit passender Commit-/Quell-/Lockfile-/Paketidentität und kontrollierter CI-Herkunft untersuchen. Paket nach Liveprüfung weiterhin unverändert übernehmen.

**Priorität/Risiko:** P2, S–M. Wiederholungen belegt; Ersparnis erst messen. Risiko: stale Freigaben, fehlende Tests nach PR-Synchronisation, Fork-/Tag-/Mergekontext oder abgebrochene Läufe.

**Abhängigkeiten:** 023 vor Änderung der Nachweisübernahme; erste reine Triggeranalyse unabhängig möglich.

**Akzeptanz/Validierung:** Trigger-/Bedrohungsmatrix für Branch, PR-Update, Main, Tag und wiederverwendeten Workflow; ein Ergebnis falscher Identität oder ein übersprungener/fehlgeschlagener Job gilt nicht als erfolgreich. Gleiche gewünschte Prüfdeckung, keine verlorene Sprach-/Recoveryprüfung, geringere tatsächlich gemessene Doppelarbeit. YAML-/Vertragstests und überprüfbarer Remote-CI-Lauf. Kein GO aus bloßem `--no-commands`.

### TAV-026 — Datensparsamen lokalen Supportexport anbieten

**Befund/Status:** als Erweiterung vorgeschlagen. `audit.js:93` exportiert vollständige Auditdaten; `enterprise/audit_import.cjs` bietet bereits einen minimierten lokalen Review, benötigt dafür Node/CLI. Ein eigener Add-on-Supportexport ist im untersuchten Options-/Auditpfad nicht vorhanden. Nutzen: Anwender können technische Probleme einfacher reproduzierbar melden; Support braucht weniger sensible Rohdaten.

**Umfang:** ausdrücklich gestarteter, lokal gespeicherter Diagnosebericht mit erlaubter Feldliste: Add-on-/TB-Version, verfügbare API-Fähigkeiten, grobe Konfigurationszustände und ausgewählte technische Prüfergebnisse. Optional domain-only Auditübersicht als eigener, klar gekennzeichneter Export. Vorschau/Abwahl vor Speicherung; kein Versanddienst und keine Telemetrie.

**Priorität/Risiko:** P2, M. Greifbarer Nutzwert bei den bereits vorhandenen Support-/Plattformgrenzen; tatsächliche Nachfrage noch nicht gemessen. Höchstes Risiko ist ungewollte Aufnahme von Rohdaten oder Secrets.

**Abhängigkeiten:** Begriffe aus 020; bestehendes Node-Redaktionsmodell wiederverwenden, ohne es als authentifizierten Enterprise-Ingest auszugeben.

**Akzeptanz/Validierung:** keine Keys/Tokens, Userinfo/URLpfade/Queries/Fragmente, Nachrichteninhalte, persönlichen Profilpfade oder ungeprüften Fehlerfreitexte im minimalen Export. Alte vollständige Auditexporte und Originaldaten bleiben verfügbar/unverändert. Canary-/Schema-/Negativtests, Vorschau und Tastaturbedienung in sechs Sprachen, echte lokale Downloads in Thunderbird. Quelle und Grenzen des Reports sind sichtbar; kein Authentizitätsversprechen durch Prüfsumme.

### TAV-027 — Versionierte lokale Einstellungsprofile prüfen und ergänzen

**Befund/Status:** Produktvorschlag, kein bestätigter Defekt. `options.js` speichert einzelne Einstellungen; vorhandene Enterprise-Profile sind deaktivierte Integrationsentwürfe. Ein portabler eigener Nutzer-Einstellungsimport mit Diff-/Validierungspfad ist im untersuchten UI nicht vorhanden. Nutzen: wiederholbare Einrichtung und gezielter Wiederaufbau ohne vollständiges Profilbackup.

**Umfang:** zuerst unterscheiden, welche lokalen Einstellungen Anwender tatsächlich übertragen wollen. Kleines Schema für Darstellung und ausdrücklich gewählte lokale Schutzoptionen; Vorschau, Feldvergleich, Bestätigung und Abbruch. Keine API-Schlüssel im Export; keine stillschweigende Übernahme externer Zustimmung/Hostrechte oder Aktivierung von Unternehmensprofilen. Audit-/Nachrichtenhistorie gehört nicht in dieses Profil.

**Priorität/Risiko:** P3, M–L. Nutzwert plausibel, Nachfrage offen; Import kann Schutz- und Datenschutzentscheidungen verändern. Vor Implementierung Schema-/Bedarfsentscheidung als eigenes überprüfbares Zwischenergebnis.

**Abhängigkeiten:** gegebenenfalls 028; bestehende Onboarding-/Theme-/Consentpfade erhalten. Keine Cloudkonten notwendig.

**Akzeptanz/Validierung:** unbekannte/falsche Versionen und Werte werden erklärbar behandelt; keine Teilübernahme bei Fehler/Abbruch; keine Einwilligungs- oder Berechtigungserteilung durch Import. Bestehende Keys und historische Entscheidungen werden nicht überschrieben. Versionierte Fixtures, echte Thunderbird-Speicherfehler-/Neustartfälle und sechs Sprachen. Bei fehlendem Bedarf bleibt es beim dokumentierten Konzept.

### TAV-028 — Interne Ergebnis- und Nachrichtenverträge begrenzt vereinheitlichen

**Befund/Status:** Optimierungspotenzial aus der Architektur. Manifest lädt globale Skripte in bestimmter Reihenfolge; `background.js`, `link_audit.js` und `api.js` teilen Zustände/Resultatkonventionen. Die React-Demo besitzt eigene Typen und Risikologik. Daraus allein folgt kein Zwang zur Frameworkmigration.

**Umfang:** zuerst Abhängigkeitskarte und Verträge der durch 019–022 veränderten Resultate erstellen. Reine Parser-/Ergebnisfunktionen und validierte Nachrichtenpayloads an einer eng begrenzten Stelle extrahieren, sofern dadurch konkrete Doppelinterpretationen oder Lastreihenfolgeabhängigkeiten entfallen. Add-on, Demo und Node-Dienste bleiben benannte getrennte Runtimes.

**Priorität/Risiko:** P2 Untersuchung, M; Umsetzung abhängig vom Befund. Wartungsnutzen plausibel, weitreichende Refaktorierung mit erhöhtem Regressionsrisiko. Kein allgemeiner TypeScript-/React-/Bundler-Neuaufbau als Nebenauftrag.

**Abhängigkeiten:** die fachlichen Verträge aus 019/020 zuerst festlegen; keine Großarchitektur als Blocker dieser Korrekturen vorziehen.

**Akzeptanz/Validierung:** dokumentierte Vertragsschnittstelle, eindeutige optionale Legacyfelder und abgewiesene ungültige Nachrichten. Dieselben fachlichen Ergebnisse an Popup/Linkdialog/Audit; keine neue Berechtigung oder automatische Übertragung. Bestehende und negative Vertragstests plus tatsächlicher XPI-Inhalt und echte Thunderbird-Regression. Eine Demo-Parität wird nur verlangt, wenn ihre Produktrolle das ausdrücklich erfordert.

## 6. Bestehende offene Aufgaben weiterführen

Die Nutzerangabe „keine zusätzlichen Ressourcen“ bleibt gültig. Diese Arbeitspakete behalten ihre IDs und Prüfanweisungen. Es werden keine bereits vorhandenen Dienste oder Zugänge unterstellt.

| Bestehende Aufgabe | Fehlendes Ergebnis / Voraussetzung | Nächster sinnvoller Schritt |
| --- | --- | --- |
| TAV-005.03 | öffentlicher Pages-/Inhaltsnachweis; vorheriger Leseversuch nicht zugänglich | Quellen lokal prüfen; echte öffentliche Prüfung/Deployment nach verfügbarer Erreichbarkeit |
| TAV-006.03 | reale Providerverträge, Testkonten und freigegebene Testdaten | lokale Verträge mit 019/020 ergänzen; Liveprüfung separat ausführen, sobald eingerichtet |
| TAV-009.03 | echte Windows-/macOS-Systeme und Standardbrowser | vorhandene native Matrix erhalten; keine Linux-/Chromiumsimulation als Ersatz eintragen |
| TAV-010.03 | NVDA/VoiceOver und reale Bedien-/Ansagenprüfung | vorhandenes Protokoll nutzen; ARIA/axe bleibt Teilnachweis |
| TAV-012.03 | native DPI-/High-Contrast-Prüfung | gemeinsam mit 009/010 durchführen; CSS-Zoom nicht als OS-Prüfung behandeln |
| TAV-013.03 | automatischer Updatekanal mit zwei geeigneten Versionen | manuellen Upgrade-/Restorebeleg erhalten; automatische Verteilung später eigenständig nachweisen |
| TAV-014.02/.03 | tatsächlicher ATN-Status/Zugang, Signierung/Review/Installation | Maintainer-/Kanalvoraussetzungen konkret bereitstellen; keine fehlende Listung aus einem Zugriffsausfall folgern |
| TAV-017.03 | Betreiber, Daten-/Retention-/Rollenfreigabe, gewählter Testmandant/IdP/Storage/MDM | genau einen Pilot planen; Offline-Review und STAGED nicht als Produktiv-/SEALED-Abnahme behandeln |
| TAV-018.03 | unterstützte gepatchte Werkzeugkette oder validierte Migration | lokale Upstream-/Kompatibilitätsanalyse fortsetzen; verbleibende 9 mittlere/1 niedrige Meldung transparent halten |

Die Tabelle führt die **zehn offenen Unteraufgaben** der bisherigen Liste fort. Das fachliche Sprachreview ist zusätzlich eine ausgewiesene Qualitätsgrenze; es wird nicht durch Katalogparität oder Testzahlen ersetzt.

## 7. Roadmap und konkrete Reihenfolge

**Kurzfristig:** fachliche Korrekturen 019 und Zustandsuntersuchung 020 beginnen; 023 unabhängig daneben bearbeiten. Danach Ergebnis-/Begründungsverträge in 021 übernehmen und Grenzfälle aus 022 durchlaufen. Den umfangreichen PR #719 als bestehenden Kandidaten prüfen; seine Integration ist Voraussetzung dafür, dass die vorbereiteten Funktionen im Standardbranch vorliegen. Änderungen an dieser neuen Runde sauber gegenüber dem geprüften 1.24.3-Stand abgrenzen. Keine bereits erteilte Freigabe für neue Paketbytes übernehmen.

**Mittelfristig:** TAV-018.03 als unterstützte Werkzeugbehebung fortsetzen. 024 zunächst messen, danach gezielt optimieren; 025 nach robuster Nachweisvalidierung umsetzen. 026 als erste klar begrenzte lokale Erweiterung entwickeln. 028 nur an tatsächlich betroffenen Vertragsgrenzen anwenden. Neue Oberflächen und Exporthinweise in allen sechs Sprachen und im gemeinsamen Designsystem abnehmen.

**Später/abhängig von Bedarf:** 027 nach Schema-/Bedarfsentscheidung. Native/externe Altaufgaben nach tatsächlich verfügbaren Ressourcen; produktive Enterpriseintegration bleibt optional und blockiert lokale Weiterentwicklung nicht. Eine ATN-/Releasefreigabe braucht weiterhin ihre eigenen konkreten Nachweise.

### Die drei sinnvollsten nächsten Arbeitspakete

1. **TAV-019 — Headerparser:** lokal reproduzierter Fehler mit engem Verantwortungsbereich und direktem Einfluss auf die angezeigte Authentifizierungsqualität. Die Gegenbeispiele lassen sich ohne externe Systeme prüfen.
2. **TAV-020 — Prüfherkunft:** verhindert missverständliche Aktualitätsangaben und schafft ein gemeinsames Ergebnisverständnis für Dialog, Audit und spätere Supportberichte. Die Herkunft positiver Cachezustände wird zuerst untersucht.
3. **TAV-023 — Nachweisvalidierung:** die vorhandene Paketbindung ist nützlich, benötigt aber konsistente Einzelresultate und Recoveryverträge. Das stabilisiert die Freigabe jeder späteren Produktänderung.

Für zusätzliche Fähigkeiten ist **TAV-026** der erste Vorschlag: konkrete Unterstützung vorhandener Diagnoseprobleme, lokal ausführbar und ohne neue Unternehmens-/Providerzugänge. TAV-027 folgt erst bei bestätigtem Nutzwert.

## 8. Verbindliche Abnahme für alle neuen Änderungen

- EN/DE/FR/ES/IT/PL vollständig mitliefern; dynamische Fehler-/Status-/Exporthinweise und Platzhalter einbeziehen.
- Gemeinsame eigene Add-on-/Admin-Gestaltung, native Thunderbird-Themes, Hell/Dunkel, Dichte und Tastatur berücksichtigen. Browser- und echte OS-/Screenreaderprüfungen getrennt dokumentieren.
- Lokale Funktionen bleiben ohne externe Analyse nutzbar. Freigabe-, Hostrechts- und Privatsphärestufen nicht durch neue Profile oder Diagnosen umgehen. Unternehmensintegration bleibt optional.
- URL, Score, Prüfstand, Herkunft und Entscheidung nachvollziehbar darstellen. OPENED bleibt Thunderbirds angenommene Öffnungsanforderung; Browserstart/Besuch sind separate Beobachtungen. PENDING bleibt nach Prozessverlust offen.
- Bestehende Daten, Originalgründe, Versionen und Entscheidungssnapshots erhalten. Fehlende historische Felder nicht aus späteren Ergebnissen auffüllen. Export-/Schema-/Migrationstests aus diesen Risiken ableiten.
- Neue Paketbytes erhalten neue passende Prüfevidenz. Tests verifizieren Verhalten und Fehlergrenzen; eine größere Testzahl ist kein eigenständiges Entwicklungsziel.

**Ausführbarkeit:** alle zehn neuen Pakete können zumindest in ihrer definierten lokalen Untersuchungs-/Konzeptphase mit den vorhandenen Mitteln begonnen werden. Die beschriebenen realen Provider-/OS-/Store-/Unternehmensabnahmen benötigen die in Abschnitt 6 konkret benannten zusätzlichen Voraussetzungen. Dieser Plan implementiert keine der vorgeschlagenen Produktänderungen.
