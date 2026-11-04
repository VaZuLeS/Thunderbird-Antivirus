# Große aktive Quellenansichten — AVN-007.b

Stand: 4. November 2026, unveröffentlichte Entwicklung 1.24.4. Ausgangscommit `0aaa1ef`; ergänzt die [Historiennavigation](GROSSE_QUELLENHISTORIEN.md).

## Neuer Befund und Auswahl der Änderung

Der native Ausgangslauf unter Thunderbird 153.6.0 verwendet eine tatsächlich importierte Nachricht mit 500 unterschiedlichen URLs und 1.200 ausdrücklich synthetisch eingespeisten aktuellen Quellenbeobachtungen. Der Quellenbereich erzeugt dabei **7.533 Elemente**, einschließlich der vollständigen Inhalte aller 1.200 noch zugeklappten Prüfdetaileinträge. Die drei gemessenen Aktualisierungsvorgänge dauern 424, 460 und 452 ms. Erfasst werden **Speicherung, Snapshotaufbau, Runtime-Einblendung und DOM-Commit gemeinsam**, nicht ausschließlich Rendering oder sichtbare Eingabeverzögerung. Das ist kein Feldhäufigkeits- oder allgemeiner Performancebeleg.

`analysis_status.js::render` erzeugte Bewertung und Datumszeilen sofort für jeden Detailknoten. Zusätzlich durchsuchte die Inventarliste für jede Ressource erneut sämtliche Quellenzeilen. Ein globaler Warnhinweis war bereits sichtbar, ein direkter Weg zu einem weit unten stehenden aktuellen Warnbefund fehlte. Diese konkreten Befunde rechtfertigen einen begrenzten Eingriff vor einer weiteren Filter-/Paginationentscheidung.

## Umsetzung und unveränderte Datenbedeutung

Die Zusammenfassungen **aller** aktuellen Prüfzeilen bleiben im DOM und enthalten weiterhin Ressource, Dienst/Prüfumfang, Zustand, Ergebnisquelle und gegebenenfalls Warnbewertung. Der Detailinhalt entsteht beim ersten Öffnen genau einmal. Schließen und erneutes Öffnen duplizieren ihn nicht. Bereits offene Einträge erhalten beim nächsten Snapshot ihre aktualisierten Inhalte unmittelbar; offener Zustand und Fokus bleiben erhalten.

Ein gemeinsamer Capture-Listener verarbeitet das nicht aufsteigende `toggle`-Ereignis sämtlicher aktuellen Details. Ein flüchtiger `WeakMap`-Bereich hält die noch nicht dargestellten Snapshotwerte; nach dem Aufbau wird der betreffende Eintrag entfernt. Es werden keine 1.200 einzelnen Detailhandler oder dauerhaften neuen Datensätze benötigt. Die erste Zwischenfassung mit Einzelhandlern hatte zwar weniger DOM-Elemente, aber uneinheitliche native Gesamtlaufzeiten. Sie ist deshalb kein Beleg einer allgemeinen Beschleunigung; die endgültige Fassung wurde zusätzlich seriell geprüft.

Die Detailfunktion übernimmt die skalaren Werte des jeweiligen Darstellungssnapshots. Ein späteres Öffnen verjüngt keine Zeit und liest keine inzwischen veränderte Datenquelle als ursprünglichen Befund. Eine neue Bewertung oder Zeit erscheint erst mit einem neuen Snapshot. Öffnen, Schließen und Warnungssprung starten keine Analyse, Provideranfrage oder Speicherung. Datenbank-/Audit-/Retentionsverträge und Schwellenwerte ändern sich nicht.

„Stärksten aktuellen Warnbefund zeigen“ öffnet und fokussiert einen Eintrag mit dem stärksten **im aktuellen Quellenkontext aufgezeichneten** Ergebnis: schädlich vor verdächtig. Auch ein Cache-/gespeicherter Befund behält dabei seine Herkunft und ursprüngliche Zeit; „aktuell“ bedeutet keine neue Providerabfrage. Die unbestätigte Historie wird nicht durchsucht oder in eine aktuelle Bewertung umgedeutet. Die gesonderte historische Navigation bleibt erhalten. Die neue Aktion wird in EN/DE/FR/ES/IT/PL mitgeliefert.

Die Dienstüberschrift kann bei einem weit unten liegenden Sprungziel außerhalb des sichtbaren Bereichs stehen. Deshalb enthält der geöffnete Detailinhalt selbst den Dienstnamen; der zugängliche Name seiner Zusammenfassung erhält denselben Präfix. Diese bei der Bildschirmprüfung erkannte Lücke wird damit geschlossen, ohne sämtliche geschlossenen Zusammenfassungen zu verlängern. Eine native Screenreaderabnahme wird daraus nicht abgeleitet.

Ein einmaliger Index ordnet Ressourcen ihre bereits aufgezeichneten Dienste zu. Die Inventaranzeige verwendet ihn statt wiederholter vollständiger Zeilensuchen. Reihenfolge, Mehrfachunterdrückung, Ressourcenbindung und die Aussage „kein externer Befund aufgezeichnet“ bleiben erhalten. Es entsteht kein neuer persistierter Ressourcenschlüssel.

## Prüfung und Nachweisgrenzen

Die simulierten Prüfungen verwenden echte DOM-`toggle`-Ereignisse und prüfen erstmals geöffnete Details, wiederholtes Schließen/Öffnen, Snapshotwerte trotz nachträglich veränderter Eingabe, ursprüngliche Zeiten, Fokus-/Offenwiederherstellung, den Warnungssprung des isoliert serialisierten Renderers, Abgrenzung zur Historie und identische Inventarzuordnung. Vor dem Öffnen werden keine aktuellen Detaildaten formatiert. Alle sechs Sprachen sind enthalten; ein menschlicher Sprachreview wird dadurch nicht ersetzt.

Der native Prüfer `--active-sources-check` verwendet dieselbe echte MIME-Nachricht, aktuelle Ressourcenbeschriftungen, tatsächliche Nachricht und Popup sowie X11-Tastatureingaben. Die Quellenbefunde sind synthetisch, keine Live-Providerantworten. Er prüft 1.200 Zusammenfassungen, ursprüngliche Zeiten, Details/Fokus nach Refresh und den direkten Warnungssprung. Der Ausgangsmodus `--active-sources-baseline` ist ausschließlich zur kontrollierten Prüfung des vorherigen Pakets vorgesehen; die CI erwartet den neuen, bedarfsgerechten Aufbau.

```sh
node --test test/analysis-sources.test.js test/optimization.test.js
node tools/source-history-performance.dev.cjs /path/to/baseline-analysis_status.js /path/to/before.json
node tools/source-history-performance.dev.cjs analysis_status.js /path/to/after.json
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.4.xpi \
  --active-sources-check --out /absolute/path/to/new-result-directory
```

Der ergänzende JSDOM-Vergleich mit 1.200 aktuellen Zeilen, 500 Inventareinträgen und 1.200 historischen Beobachtungen reduziert den anfänglichen Mischbestand in allen sechs Sprachen von **7.627 auf 4.028 Elemente**. Die Historie bleibt dabei auf 30 sichtbare Zeilen paginiert. Diese Messung ist kein Browserlayout-/RSS-Nachweis. Zeiten einzelner Läufe sind keine Zusage eines gleichbleibenden Beschleunigungsfaktors.

Der [maschinenlesbare Nachweis](audits/avn-007-active-sources-2026-11-04.json) enthält die Paket-/Runnerkennungen, Ausgangs-, Zwischen- und Endläufe. Die abschließenden Referenz- und Folgeläufe wurden ohne parallele eigene GUI-/Node-Prüfläufe ausgeführt; sonstige Systemlast blieb unkontrolliert. Referenz und Endfassung stehen dabei nicht für eine statistisch abgesicherte Feldmessung.

| Native Beobachtung | Vorher | Endfassung |
| --- | --- | --- |
| Elemente im aktuellen Quellenbereich, Nachricht und Popup | 7.533 | 3.934 |
| Geschlossene Detailknoten mit vorab aufgebautem Inhalt | 1.200 | 0 |
| Erreichbare aktuelle Zusammenfassungen | 1.200 | 1.200 |
| Aktualisierungsvorgänge unter Thunderbird 153.6.0 | 447 / 503 / 499 ms | 383 / 419 / 352 ms |
| Aktualisierungsvorgänge unter Thunderbird 140.12.0 | 481 / 530 / 484 ms | 402 / 394 / 394 ms |

Die Zeiten beziehen sich weiterhin auf die gekoppelte Operation einschließlich Persistenz und Einblendung. Eine allgemeine Beschleunigungsquote oder geringerer Prozessspeicher wird nicht behauptet. Der zusätzliche Popup-Messwert umfasst zudem Öffnung, Runtimeabfragen und Automatisierung und wird im JSON getrennt geführt.

Abschluss: **1.057 automatisierte Tests erfolgreich**, vollständige Source-/Sprach-/Design-/Lint-/Paketprüfung und drei Byte-Regressionen des Prüfrunners erfolgreich. Beide nativen Endläufe prüfen die echten Darstellungen unter Linux 140/153 einschließlich X11-Enter, ursprünglicher Zeiten, offener Details/Fokus nach Refresh sowie des aktuellen Warnungssprungs mit sichtbarem und zugänglich benanntem Dienst. Die [Bildschirmaufnahme](screenshots/1.24.4/active-sources-popup.png) zeigt das erreichte Detail. Die native Prüfung ist separat in CI verdrahtet; lokale Ergebnisse sind kein behaupteter neuer Remote-CI-Erfolg.

Das manuelle Upgrade von veröffentlichter 1.24.3 auf dieselben endgültigen Paketbytes besteht mit drei normalen Neustarts einschließlich sauberem Profilrestore sowie zwei SIGKILL-Neustarts. Das ist kein automatischer Updatekanal oder allgemeiner In-place-Downgrade. Keine neue Chromium-/axe-, Windows/macOS-, Zoom- oder Screenreaderabnahme daraus ableiten.

## Weitere priorisierte Aufgaben

| ID / primärer Bereich und Typ | Priorität / Aufwand | Konkreter nächster Schritt und Abnahme | Voraussetzungen / Grenze |
| --- | --- | --- | --- |
| AVN-007.c / Bedienung, Verbesserung | P2 / M | Suchaufgaben für normale Ressourcen und 200-%-/schmale Ansichten nativ prüfen. Erst bei bestätigtem Bedarf Gruppenfilter oder weitere Pagination wählen; jede Zusammenfassung und Warnung muss erreichbar, Quellenalter/Fokus müssen erhalten bleiben | Lokal weitgehend möglich; aktuelle Zusammenfassungen bleiben bewusst vollständig im DOM. Menschlicher Aufgaben-/Sprachreview und Screenreader sind separate Abnahmen |
| AVN-008 / Werkzeugkette, Optimierung | P2 / M, Untersuchung | Unterstützten Updateweg und tatsächliche Erreichbarkeit der Auditbefunde prüfen. Neu erhoben: neun moderate/ein niedriger Entwicklungsbefund, ohne Dev-Abhängigkeiten null. Registry: `web-ext` 10.8.0, `addons-linter` 10.15.0; die installierte `web-ext`-Fassung bindet jedoch exakt Linter 10.14.0. Zuerst den neueren Linter und seine Kompatibilität isoliert untersuchen | Npm schlägt weiterhin den inkompatiblen Downgrade auf `web-ext` 3.2.1 vor. Kein `audit fix --force` oder ungeprüftes Override. Runtimebefunde nicht aus der Anzahl von Toolmeldungen ableiten; Lockfile/Paket-/MV3-Prüfung bei einem späteren Update |
| AVN-009 / Datenlebenszyklus, Optimierung | P1 vor dauerhaften Zusagen / G | Inhalts-/Vorkommensbindung, allgemeine Retention und wiederholbare Migration weiterentwickeln; frühere Daten und Entscheidungen erhalten. Die Anzeigemessung ersetzt diesen Vertrag nicht | Lokal konzeptionell ausführbar; keine automatische Löschung oder Neubindung alter numerischer IDs. Unabhängige Protokollarchivierung bleibt offen |
| AVN-011.b / Exportbedienung, Untersuchung | P2 / K–M | Wiederkehr aus Navigation/Seiten-Cache nativ untersuchen. `source_export.js::mount` entsorgt bei `pagehide`, initialisiert derzeit über `DOMContentLoaded`; ob Thunderbird diese Seite aus einem Seitencache wiederherstellt, ist eine **Hypothese** | Zuerst reproduzieren. Falls betroffen: kohärente Vorschau-/Buttonzustände und erneute Kontextprüfung verlangen; keine alte Vorschau oder wiederverwendete ID reaktivieren |

Die bestehenden Plattform-/Screenreader-, Crypto-, Live-Provider- und Distributionsblocker bleiben unverändert. Diese Arbeit erstellt keine neue Zustimmung und keine Unternehmensintegration. **1.24.4 bleibt unveröffentlicht.**
