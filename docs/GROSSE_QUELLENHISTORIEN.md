# Große Quellenhistorien — AVN-007.a

Stand: 3. November 2026, unveröffentlichte Entwicklung 1.24.4. Ausgangspunkt `e75667d`; keine vollständige Erledigung von AVN-007.

## Analyse und abgegrenzte Umsetzung

`ThundyAnalysis.history` normalisiert bis zu 1.200 historische Beobachtungen. Der bisherige `render`-Pfad zeigte davon nur `slice(0,120)` und einen Kürzungshinweis. Es gab keinen Weg zu späteren Zeilen in Nachricht oder Toolbar-Popup. Die Ausgangsprobe mit 1.200 Beobachtungen und einem einzigen schädlichen Befund an letzter Stelle bestätigt das in allen sechs Sprachen. Die darunterliegenden Daten und der Quellenexport waren weiterhin vollständig im jeweils dokumentierten Umfang vorhanden; betroffen war die Anzeige.

Die Historie verwendet jetzt **30 Zeilen je Seite**. Vorherige/nächste Seite, der sichtbare Bereich und die Gesamtzahl erlauben den Zugriff auf alle vorhandenen normalisierten Zeilen. Die Projektion selbst bleibt auf 1.200 Zeilen begrenzt. Ein echter Projektions-/Speichergrenzhinweis ist weiterhin von einer bloßen Aufteilung in Seiten zu unterscheiden.

Ein auffälliger historischer Befund wird bereits in der eingeklappten Historienzusammenfassung genannt. „Ersten auffälligen historischen Befund zeigen“ führt zur betreffenden Seite und fokussiert die Zeile. Der Hinweis sagt ausdrücklich **historisch und Zuordnung unbestätigt**. Er ändert weder den aktuellen Nachrichtenmodus noch dessen Rahmenfarbe oder aktuelle Bewertungen. Die Ressourcen bleiben ungebunden, ursprüngliche Zeiten unverändert. Es findet keine neue Analyse statt.

Die Seite bleibt bei laufenden Quellenupdates erhalten; bei weniger Einträgen wird sie auf einen gültigen Bereich begrenzt. Offene Historie und Fokus auf Navigation/Zeile werden beim erneuten Rendern wiederhergestellt, bei weggefallenem Ziel auf die Historienzusammenfassung. Seitenwechsel aktualisieren ausschließlich die historische Liste und ihre Bedienelemente; der aktuelle Quellenbereich wird dabei nicht neu aufgebaut. Tastaturfokus, textlicher Warnhinweis und höfliche Statusansage verwenden das vorhandene Theme. EN/DE/FR/ES/IT/PL sind mitgeliefert.

## Messung und Nachweisgrenzen

`tools/source-history-performance.dev.cjs` misst denselben synthetischen Bestand vor/nach Änderung unter JSDOM. Das ist eine Messung des DOM-Aufbaus einschließlich Datumsformatierung, **keine Browserlayout-, RSS-, Feldlatenz- oder Screenreaderabnahme**. Laufzeitwerte sind Einzelmessungen mit Aufwärm-/Reihenfolgeeffekten; sie rechtfertigen keine allgemeine Beschleunigungsquote.

| Beobachtung in allen sechs Sprachen | Vorher | Danach |
| --- | --- | --- |
| Historienzeilen gleichzeitig im DOM | 120 | 30 |
| Elemente der reinen Quellen-/Historienansicht | 391 | 125 |
| Befund an Position 1.200 erreichbar | Nein | Ja, direkt und über 40 Seiten |
| Auffällige Historie in der Zusammenfassung erkennbar | Nein | Ja, ausdrücklich unbestätigt |

Die gemischte Probe mit zusätzlich 1.200 **aktuellen** Quellenzeilen und 500 Inventareinträgen bleibt groß: 7.893 Elemente vorher, 7.627 danach. Daraus wird keine Lösung des gesamten aktiven Listenproblems abgeleitet. AVN-007.b benötigt eine gesonderte native Untersuchung vor einem weiteren Umbau.

```sh
node tools/source-history-performance.dev.cjs /path/to/baseline-analysis_status.js /path/to/baseline.json
node tools/source-history-performance.dev.cjs analysis_status.js /path/to/after.json
node --test test/analysis-sources.test.js test/optimization.test.js
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.4.xpi \
  --history-pages-check --out /absolute/path/to/new-result-directory
```

Der [maschinenlesbare Nachweis](audits/avn-007-history-pages-2026-11-03.json) bindet Ausgangs-/Folgemessungen, Prüfläufe und Screenshots an die jeweiligen Quell-/Paketbytes. Die gezielten simulierten Prüfungen navigieren alle 40 Seiten, prüfen eindeutige Erreichbarkeit, Abgrenzung zur aktuellen Bewertung, Zeiten, Fokus, Schrumpfen des Bestands und unveränderte Eingabedaten. Der isoliert serialisierte Nachrichtenrenderer wird einschließlich seiner Navigationsfunktionen geprüft; er benötigt keine Modulglobals. Die native Probe verwendet einen echten gespeicherten synthetischen Bestand, tatsächliche Nachricht und Popup sowie X11-Tastatureingaben. Die Quellenbeobachtungen ersetzen keine Live-Providerverträge.

Abschluss: **1.054 automatisierte Tests erfolgreich**, vollständige Source-/Sprach-/Design-/Lint-/Paketprüfung und drei Byte-Regressionen des Prüfrunners erfolgreich. Die nativen Historienläufe unter **Thunderbird 140.12.0 und 153.6.0 auf Linux** bestehen. Enter, Leertaste und Tab steuern das tatsächliche Popup; die E-Mail-Ansicht ist ebenfalls mit echter X11-Tastatur geprüft. Seite/Fokus bleiben bei einem Quellenrefresh erhalten. Die gespeicherte Legacyhistorie bleibt identisch. [Nachrichtenansicht](screenshots/1.24.4/history-pages-message.png), [Toolbar-Popup](screenshots/1.24.4/history-pages-popup.png).

Die anfänglichen Prüferkorrekturen sind im Nachweis separat dokumentiert: Erweiterungs-APIs werden aus einer vorhandenen Optionsseite statt aus dem E-Mail-Dokument aufgerufen. Für X11-Tasten wird der native Remote-Browser des Popups ausdrücklich fokussiert; DOM-Fokus allein genügte im Runner nicht. Mehrere fehlgeschlagene Koordinaten-/Eingabeversuche werden nicht als erfolgreiche Popupabnahme gezählt. Die Produktbytes änderten sich dabei nicht. Die abschließende Bildschirmaufnahme wartet zusätzlich auf zwei Darstellungsframes, um keinen älteren Compositorstand als aktuellen Beleg zu speichern.

Der separate native Quellenexport unter 153 besteht auf denselben Paketbytes mit echtem Dateidownload, Cachelöschung und einem Neustart. Das manuelle Upgrade von veröffentlichter 1.24.3 besteht mit drei normalen Neustarts einschließlich Profilrestore und zwei SIGKILL-Neustarts. Die neue Historienprüfung ist separat in CI verdrahtet; lokale Erfolge werden nicht als bereits erfolgreiche Remote-CI des späteren Commits ausgegeben. Keine neue Chromium-/axe-, Screenreader-, 200-%-Zoom- oder schmale OS-Popupabnahme daraus ableiten.

## Weitere sinnvolle Arbeitspakete aus diesem Befund

| ID / Hauptbereich | Priorität und Aufwand | Ergebnis / nächster prüfbarer Schritt | Voraussetzungen und Grenze |
| --- | --- | --- | --- |
| AVN-007.a / Darstellung, Verbesserung | P1 für vollständigen Zugang zur vorhandenen Historie; M | Diese Umsetzung: alle vorhandenen normalisierten Zeilen erreichbar, auffällige Historie getrennt sichtbar, Daten/Fokus erhalten | Lokal ausführbar; native und simulierte Prüfungen getrennt |
| AVN-007.b / Darstellung und Hintergrund, Untersuchung vor Optimierung | P2; M | Große **aktive** Quellen-/Inventaransichten nativ messen, Such-/Warnaufgaben definieren; erst danach stufenweisen Aufbau oder Gruppenpagination auswählen | Linux vorhanden; Chromium fehlt derzeit. Menschlicher Sprach-/Aufgabenreview und Screenreader benötigen zusätzliche Ressourcen |
| AVN-009 / Datenlebenszyklus, Optimierung | P1 für dauerhafte Zusagen; G | Unabhängige Inhalts-/Vorkommensbindung und expliziten Retentions-/Migrationsvertrag entwickeln; Altbestände und Entscheidungen erhalten | Bestehende Identitätsuntersuchung und Speicherverträge verwenden; keine unbemerkte neue Löschung zur Platzgewinnung |
| AVN-010 / Einrichtung, Erweiterung | P2; M | Versioniertes lokales Schutzprofil mit Positivliste und Anwendungsvorschau ergänzen; Abbruch/Änderungskonflikt erhalten alte Einstellungen | Lokal ausführbar. Keine Schlüssel, Einwilligungen oder Vertrauensfreigaben importieren; lokale Profile bleiben von produktiven Integrationen getrennt |
| AVN-006/015 / Plattform und Verteilung, Verbesserung/Erweiterung | P1 vor entsprechenden Zusagen; Systeme/Kanal nötig | Reale OS-/Screenreaderabnahme und automatische Installation zweier angebotener Versionen samt geprüftem Rückweg | Weiterhin Windows/NVDA, macOS/VoiceOver und zulässiger ATN-/Update-Testkanal erforderlich; derzeit nicht verfügbar |

Die Hauptaufgaben stehen im [Entwicklungsplan](AUFGABENPLAN_NAECHSTE_ENTWICKLUNG_1_24_4.md); diese Unterteilung erzeugt keine zweite parallele Retentions-, Screenreader- oder Releaseaufgabe. **1.24.4 bleibt unveröffentlicht.**
