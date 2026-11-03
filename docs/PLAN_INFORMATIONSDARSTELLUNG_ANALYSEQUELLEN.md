# Aufgabenplan: Analysen in E-Mail und Toolbar-Popup nachvollziehbar darstellen

## Abschlussstatus

Die mit den vorhandenen Mitteln ausführbaren Arbeitspakete sind abgeschlossen. Implementierungsstand: `96e8b0323b03bc7d270e48222a733852d1fe877b`. Die [vollständige GitHub-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41468666892) ist erfolgreich, einschließlich aller sechs Browser-Sprachjobs, echter Linux-Thunderbird-Prüfungen und des paketgebundenen Kandidatengates. [Nachweis](audits/information-display-ci-96e8b03.json).

- [x] INFO-01: Status bereits während der ersten externen Anfrage sichtbar.
- [x] INFO-02: Zuordnung zu Anhängen, Links und Nachrichtenkontext; Altdaten erhalten.
- [x] INFO-03: Kompakte Übersicht und aufklappbare Details.
- [x] INFO-04: Alle fünf Provider und bestehenden Prüfwege erfasst.
- [x] INFO-05: Nachrichtenbindung, Cache-Löschung, Alter und Historie abgesichert.
- [x] INFO-06: Sechs Sprachen, Themes, Tastatur und Fokus geprüft; native Screenreader bleiben INFO-08.
- [x] INFO-07: Lokale sowie vollständige CI-Abnahme mit eigenen Nachweisen abgeschlossen.
- [ ] INFO-08: Reale zusätzliche Abnahmen blockiert. Die [Prüfabläufe](ABNAHME_INFORMATIONSDARSTELLUNG_EXTERN.md) sind vorbereitet; Windows/macOS, NVDA/VoiceOver und freigegebene Providerkonten/Testziele fehlen weiterhin.

[Umsetzung und lokale Prüfergebnisse](UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md) · [Pull Request #721](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/721). Eine Veröffentlichung oder Aktivierung externer Dienste gehört nicht zu diesem Planabschluss.

Die nachstehenden Befunde und die Reihenfolge dokumentieren den ursprünglichen Planungsstand vor der Umsetzung. Sie sind keine weiterhin offene Aufgabenliste.

## Ziel und geprüfter Ausgangspunkt

Für die ausgewählte E-Mail muss sofort erkennbar sein, ob lokale Prüfungen, externe Anfragen oder eine Kombination dokumentiert sind, welche Ressourcen betroffen sind und ob verwertbare Ergebnisse vorliegen. Das gilt für Hybrid Analysis, VirusTotal, URLhaus, AbuseIPDB und urlscan.io, auch ohne Erkennung einer Bedrohung.

Eine lokal gespeicherte Datei kann extern geprüft worden sein. Ein externer Link oder ein entferntes Bild ist dagegen kein Beleg für eine Analyse durch einen Dienst. Ressourcenart, Prüfquelle und Ergebnisquelle werden deshalb getrennt dargestellt. Die Anzeige lädt keine entfernten Mailinhalte nach und startet selbst keine externe Prüfung.

Im geprüften Entwicklungsstand 1.24.4 existiert bereits eine gemeinsame Quellenansicht in `analysis_status.js`, eingebunden in Nachricht und Popup über `background.js` und `api.js`. Die Providerwege erfassen Beobachtungen über `api_gateway.js` und `providers.js`. Cache, historische Berichte, Fehler und Übermittlungen sind grundsätzlich berücksichtigt. Der Renderer fasst derzeit je Dienst und Prüfumfang zusammen; eine eindeutige Zuordnung jedes Befunds zu einem einzelnen Anhang oder Link ist damit noch nicht gegeben.

Das vorhandene [Prüfprotokoll](live_test_1_24_4.md) dokumentiert automatisierte Tests, Browserprüfungen mit simulierten APIs und echte Linux-Thunderbird-Läufe mit synthetischen externen Berichten. Dieser Plan behauptet keine erneute Testausführung und keine neue Veröffentlichung. Die vorhandene Übersicht wird weiterentwickelt, nicht nochmals als offene Neuimplementierung eingeplant.

## Geplante Darstellung

Oben stehen eine kurze Zusammenfassung und die verwendeten Dienste. Beispiele:

- **Lokal geprüft · keine externen Ergebnisse dokumentiert**
- **Lokal geprüft · Hybrid Analysis angefragt · Ergebnis ausstehend**
- **Lokale und externe Ergebnisse · Hybrid Analysis und URLhaus**
- **Gespeicherter externer Bericht · erneute Anfrage fehlgeschlagen**

Darunter folgen aufklappbare Details pro Dienst und Ressource: Prüfgegenstand, Prüfumfang, Zustand, Befund, Ergebnisquelle und ursprünglicher Zeitpunkt. Ein angefragter oder mit einem Auftrag versehener Dienst zählt nicht automatisch als abgeschlossene Analyse. Fehlende Aufzeichnungen werden ausdrücklich als unbekannte Historie behandelt.

## Priorisierte Arbeitspakete

Aufwand: K = klein, M = mittel, G = groß. Priorität „zuerst“ schützt vor falschen Aussagen oder fehlender Zuordnung; „anschließend“ verbessert Erfassbarkeit und Bedienung. Untersuchungen sind keine bestätigten Fehlerberichte.

| ID | Bereich / Typ | Befund und Beleg | Ergebnis und abgegrenzter Umfang | Priorität / Aufwand | Abhängigkeiten | Akzeptanz und Validierung |
| --- | --- | --- | --- | --- | --- | --- |
| INFO-01 | Statussemantik / Verbesserung | `ThundyAnalysis.render` leitet den Kopfstatus aus vorhandenen Antworten/Cachetreffern ab. Eine laufende erste externe Anfrage kann deshalb weiterhin unter der lokalen Zusammenfassung stehen. | Kopfstatus unterscheidet keine dokumentierte externe Prüfung, angefragt/laufend, übermittelt, Ergebnis vorhanden, teilweise fehlgeschlagen und unbekannten Status. Aktuelle Konfiguration bleibt von vergangenen Prüfungen getrennt. | Zuerst / M | Vorhandenes Zustandsmodell | Laufende Anfrage wird im Kopf sichtbar; Upload ist kein fertiger Scan; deaktivierter Dienst verdeckt keinen alten Bericht. Zustandsmatrix für alle fünf Dienste, einschließlich 404, Fehler und Prozessverlust, zunächst simuliert prüfen. |
| INFO-02 | Ressourcenzuordnung / Erweiterung | Die aktuelle Zusammenfassung aggregiert nach Dienst und Scope; `analysisStatus` enthält absichtlich keine zusätzlichen URLs, Hashes oder IPs. | Zuerst bestehende Daten und stabile Ressourcenreferenzen untersuchen. Danach Befunde über geeignete lokale Referenzen einem Anhang, Link oder dem Nachrichtenkontext zuordnen. IP-/Authentifizierungsbefunde nicht als Datei-Scan darstellen. Keine zusätzlichen Roh-URLs oder personenbezogenen Daten allein für die Anzeige speichern. | Zuerst untersuchen, dann umsetzen / G | Referenz- und Aufbewahrungskonzept; INFO-01 | Bei zwei Anhängen und zwei Links ist erkennbar, welcher Befund welche Ressource betrifft. Nicht zuordenbare Altbefunde bleiben als Nachrichtenbefund mit unbekannter Ressourcenzuordnung erhalten. Gleichnamige Anhänge, Dubletten und alte Datensätze testen. |
| INFO-03 | Informationshierarchie / Verbesserung | Der gemeinsame Renderer listet bereits mehrere Zustände und drei Zeitangaben je Prüfumfang vollständig auf. Ob Nutzer die Quelle damit schnell erkennen, ist noch nicht durch einen Verständlichkeitstest belegt. | Kompakte Übersicht mit Textkennzeichnungen für lokal/extern/gemischt, Dienstnamen, ausstehenden Ergebnissen und relevanten Warnungen; ausführliche Zeiten und technische Prüfumfänge aufklappbar. Warnungen bleiben in der Übersicht sichtbar. | Anschließend / M | INFO-01; Ressourcendetails nach INFO-02 | E-Mail und Popup beantworten ohne Aufklappen: externe Anfrage erfolgt, welcher Dienst, Ergebnis vorhanden oder ausstehend. Bei 200 % Zoom keine abgeschnittenen Inhalte. Kurze Aufgabenprüfung mit synthetischen Beispielen; fehlende Nutzerstudie als Grenze dokumentieren. |
| INFO-04 | Vollständigkeit der Providerwege / Optimierung | `providers.js`, `background.js` und der Popup-Berichtsabruf in `api.js` erfassen verschiedene automatische und manuelle Wege. Vorhandene Tests ersetzen keine produktive Providerabnahme. | Vorhandene Abdeckung inventarisieren und gezielt fehlende Kombinationen ergänzen: automatische/manuelle Prüfung, Hashabfrage, Datei-/URL-Einreichung, Bericht/Polling, Cache und gespeicherte Ergebnisse. Keine zusätzlichen Funktionen oder Anfragen einführen. | Zuerst / M | INFO-01; vorhandene Testadapter | Jede vorhandene Provideroperation ist einer nachvollziehbaren Anzeige zugeordnet. Fehlende Zustimmung/Berechtigung darf keine durchgeführte Prüfung erzeugen. Anfragen zählen; Anzeigen/Öffnen der Details verursacht keine neuen Übermittlungen. Simulierte Vertragsprüfungen, echte Provider separat unter INFO-08. |
| INFO-05 | Aktualisierung und Datenlebenszyklus / Optimierung | Nachrichtenbindung, Cache-Löschung und ursprüngliche Zeitpunkte sind bereits implementiert und getestet; neue Ressourcenreferenzen erhöhen die Anforderungen. | Vorhandene Garantien bei INFO-01 bis INFO-04 erhalten: keine falsche Nachrichtenzuordnung, keine Verjüngung alter Befunde, kein Wiederherstellen gelöschter Statusdaten durch verspätete Antworten. Neue Metadaten additiv und migrationsfähig halten. | Bestandteil jeder Änderung / M | INFO-02 bei neuem Schema | Nachrichtenwechsel während einer Anfrage, parallele Nachrichten, gleiche Header-IDs, Neustart, Cache-Löschung und fehlgeschlagene Aktualisierung prüfen. PENDING und historische Entscheidungsstände bleiben unverändert; OPENED bestätigt ausschließlich die angenommene Öffnungsanforderung. Simuliert sowie gezielt in echtem Thunderbird testen. |
| INFO-06 | Design, Sprache und Zugänglichkeit / Verbesserung | Gemeinsamer Renderer, Themefarben, Shadow DOM und sechs Sprachkataloge sind vorhanden. Native Screenreaderprüfungen fehlen weiterhin. | Neue Zusammenfassung und Ressourcendetails in EN/DE/FR/ES/IT/PL, mit Themefarben, geeigneter Dichte und vollständiger Tastaturbedienung. Statusänderungen verständlich ankündigen, ohne bei jeder Aktualisierung Fokus zu verlieren. | Anschließend / M | INFO-03 | Hell/dunkel, lange Übersetzungen, schmale Ansichten, 200 % Zoom, Tab/Enter/Leertaste und Fokus bei Aktualisierung prüfen. Bedeutung nicht allein durch Farbe. Browser-/axe-Prüfungen bleiben ausdrücklich von NVDA-/VoiceOver-Abnahme getrennt. |
| INFO-07 | Thunderbird-Integration und Abnahme / Optimierung | Linux-Läufe für 140/153 sind dokumentiert; der nächste UI-/Datenstand benötigt eigene Nachweise. | Nach Umsetzung einen vollständigen lokalen Ablauf mit synthetischer Mail und mehreren Ressourcen prüfen: lokal, extern ohne Treffer, Warnung, gemischte Befunde, Cache, fehlgeschlagene Auffrischung und nachträgliche Popup-Aktualisierung. Eigene Paketbindung und Screenshots erzeugen. | Abschluss vor Freigabe / M | INFO-01 bis INFO-06 | Nachricht und Popup zeigen zur selben Mail konsistente Quellen und Zustände. Echte Thunderbird-APIs und simulierte externe Antworten im Bericht separat benennen. Geeignete unterstützte Mindest-/aktuelle Thunderbird-Versionen verwenden; vorhandene Freigabegates bleiben verbindlich. |
| INFO-08 | Zusätzliche Umgebungen / Validierung | Windows/macOS, NVDA/VoiceOver und produktive Providerkonten stehen laut bisheriger Ressourcenklärung nicht zur Verfügung. | Fehlende reale Prüfungen mit genauem Ablauf und Ergebniserwartung vorbereiten, bei Verfügbarkeit ausführen. Keine simulierte Prüfung als native oder produktive Abnahme deklarieren. | Vor entsprechender Freigabe / M plus Zugang | Windows mit NVDA; macOS mit VoiceOver; ausdrücklich konfigurierte Testkonten/Schlüssel und Einwilligung für jeweilige Dienste, ggf. nutzbare Kontingente | Native Tastatur-/Screenreader-Bedienung und tatsächlich unterstützte Providerantworten nachvollziehbar dokumentieren. Bis dahin konkrete Abnahme offen lassen. Keine Freigabe allein aus Testzahlen ableiten. |

## Ursprüngliche Reihenfolge — abgearbeitet

1. **INFO-01:** Statussemantik schärfen. Der Nutzer muss eine externe Anfrage bereits vor dem ersten Ergebnis erkennen können. Das hat unmittelbaren Nutzen und baut auf dem vorhandenen Modell auf.
2. **INFO-04:** Alle bestehenden Providerwege gegen diese Semantik prüfen. Damit wird die Verbesserung für alle fünf Dienste vollständig und nicht nur für Hybrid Analysis sichtbar.
3. **INFO-02, Untersuchung:** Ressourcenreferenzen und Altdaten prüfen, anschließend den konkreten Daten-/Darstellungsvertrag festlegen. Erst damit ist eine zuverlässige Aussage pro Anhang oder Link möglich.

INFO-02-Umsetzung, INFO-03 und INFO-06 sind inzwischen abgeschlossen. INFO-05 wurde begleitend geprüft; INFO-07 ist lokal und in der CI abgeschlossen. INFO-08 bleibt bis zur Verfügbarkeit der konkret benannten Ressourcen blockiert.

## Mit vorhandenen Mitteln ausführbar

Code-/Datenanalyse, Statusmodell, Provider-Vertragsprüfungen, Ressourcenreferenz-Untersuchung, gemeinsame Oberflächen, sechs Sprachfassungen, automatisierte Browserprüfungen und echte Linux-Thunderbird-Prüfungen sind lokal ausführbar. Für reale externe Übermittlungen sind Providerzugänge nötig; Windows/macOS und native Screenreader benötigen die genannten Systeme. Automatische Updateverteilung und Rollback bleiben eigenständige Distributionsabnahmen und sind nicht Bestandteil dieser Darstellungsänderung.

Der ursprüngliche Schritt erstellte ausschließlich diesen Plan. Die anschließende Ausführung ist im [Umsetzungsprotokoll](UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md) dokumentiert; offene zusätzliche Abnahmen stehen im [Abnahmeablauf](ABNAHME_INFORMATIONSDARSTELLUNG_EXTERN.md).
