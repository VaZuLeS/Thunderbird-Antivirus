# Sichtbare Analysequellen — Entwicklung 1.24.4

Die anschließende [Ausführung des Darstellungsplans](UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md) ergänzt Ressourcenzuordnung, kompakte Details und einen bereits während der Anfrage sichtbaren Status. Die nachstehende Beschreibung dokumentiert die erste Quellenanzeige.

Unveröffentlichter Entwicklungsstand; veröffentlicht bleibt [1.24.3](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.3). Die Anzeige ergänzt Nachricht und Toolbar-Popup. Sie verändert weder Einwilligung noch Berechtigungen oder die Entscheidung zum Öffnen eines Links.

## Befund und Umsetzung

Bisher erschien das Nachrichtenbanner nur bei einem hohen lokalen Score oder positivem Authentifizierungsstatus (`injectThreatBanner`, `message_ui.js`). Das Popup zeigte lokale Risiken und einzelne Hybrid-Analysis-Berichte. Eine erfolgreiche externe Prüfung ohne Erkennung war deshalb häufig nicht erkennbar.

`analysis_status.js` stellt jetzt dieselbe Übersicht **Analysequellen** in beiden Oberflächen dar. Sie nennt Hybrid Analysis, VirusTotal, URLhaus, AbuseIPDB und urlscan.io. Dienste ohne dokumentierte Prüfung stehen unter einer per Tastatur bedienbaren Aufklappansicht. Fehlende Konfiguration, Einwilligung, Berechtigungen und Richtlinien werden getrennt erklärt; gespeicherte Befunde bleiben auch bei inzwischen abgeschalteter Integration sichtbar.

Die Übersicht unterscheidet:

- lokale Nachrichten-/Linkheuristik und dokumentierte externe Ergebnisse sowie deren Kombination;
- tatsächlich empfangene Antworten, Cache und gespeicherte Berichte;
- Hash, Dateiübermittlung, URL, Domain, IP und Berichtsabruf;
- laufende Anfrage, angenommene Übermittlung, ausgewertete Antwort, fehlenden Treffer, unvollständige Prüfung und Fehler;
- ursprünglichen Beobachtungszeitpunkt, Zeitpunkt des verfügbaren Befunds und letzten Prüfversuch.

Ein Upload oder eine Auftrags-ID bestätigt keine fertige Analyse. Ein fehlender Treffer bestätigt keine Sicherheit. Fehlgeschlagene Aktualisierungen verjüngen ältere Ergebnisse nicht; verfügbare Warnungen bleiben bei gemischten Ergebnissen erhalten. Nach Prozessverlust wird ein laufender Status als unvollständig geladen. Linkentscheidungen und historische Audit-Snapshots werden nicht umgedeutet; OPENED bleibt die von Thunderbird angenommene Öffnungsanforderung.

## Technische Grenzen

`ApiGateway.fetchWithTimeout` beobachtet vorhandene Anfragen. `providers.js` und die manuellen Wege in `background.js` reichen explizite Nachrichtenkontexte weiter. Es entstehen keine zusätzlichen Provider-Anfragen durch das Anzeigen der Übersicht. `api.js` übermittelt eigene Hybrid-Analysis-Berichtsereignisse über eine auf die Popup-Seite begrenzte Schnittstelle.

Neue `analysisStatus`-Metadaten ergänzen bestehende IndexedDB-Datensätze. Sie enthalten Dienst, Prüfumfang, Zustand, Quellenart und Zeitpunkte, keine zusätzlichen URLs, Hashes, IPs, Schlüssel oder Nachrichtentexte. Bestehende Daten und Auditentscheidungen bleiben erhalten. Alte Berichte werden nur aus tatsächlich vorhandenen Reports, Übermittlungszuständen oder numerischen VirusTotal-Ergebnissen abgeleitet; eine Konfiguration oder ein lokaler Hash ist kein Prüfnachweis. Nicht historisch erfasste Dienste lassen sich rückwirkend nicht verlässlich rekonstruieren.

Die Übersicht fasst verfügbare Befunde je Dienst und Prüfumfang zusammen, ohne vollständige Prüfung sämtlicher Anhänge oder Links zu behaupten. Die bisherige Prüfumfangsanzeige erklärt weiterhin Limits. Ein schwererer verfügbarer Befund bleibt in dieser Zusammenfassung erhalten, auch wenn eine andere Ressource keinen Treffer liefert.

Die gemeinsame Darstellung berücksichtigt Themefarben, helle/dunkle Darstellung und Dichte. Im Nachrichtenfenster schützt Shadow DOM vor E-Mail-CSS. Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch werden mitgeliefert.

## Validierung

[Prüfprotokoll und Grenzen](live_test_1_24_4.md). Browserprüfungen verwenden simulierte Extension-APIs und synthetische Providerantworten. Echte Thunderbird-Prüfungen verwenden isolierte Linux-Profile; historische externe Antworten werden ausdrücklich als Testdaten eingefügt. Produktive Providerabnahmen, Windows/macOS und native Screenreader benötigen weiterhin die bereits benannten zusätzlichen Ressourcen.
