# Lokaler Score ohne externe Dienste — Entwicklung 1.25.9

Stand: 17. November 2026. Veröffentlicht bleibt 1.25.8. Diese Korrektur betrifft den unveröffentlichten Kandidaten 1.25.9.

## Befund und Korrektur

Der Score wurde berechnet, blieb jedoch im Linkdialog und in der Nachrichtenübersicht standardmäßig hinter der Fachansicht verborgen. Zusätzlich wartete das Popup zunächst auf `getMessageAnalysis`, bevor es `getLocalRisk` anforderte. Eine ausstehende Quellenantwort verhinderte damit den Start seiner lokalen Bewertung. Die lokalen Gründe standen bereits im Linkaudit, fehlten aber in der Dialogantwort.

Der lokale Score wird nun in der einfachen Ansicht und der Fachansicht angezeigt. Nachrichtenbewertung und Bewertung eines angeklickten Links im Nachrichtenkontext sind entsprechend beschriftet; ihre Werte können aufgrund des unterschiedlichen Umfangs abweichen. Bis zu drei lokale Gründe sind direkt lesbar. Externe Urteile und ihre Gründe bleiben getrennt.

Das Popup legt den lokalen Bereich sofort an und lädt ihn unabhängig von Quellen und gespeicherten Berichten. Eine fehlgeschlagene Aufzeichnung der Quellenmetadaten verwirft keinen bereits berechneten Score. Eine Zeitüberschreitung oder ein ungültiges Ergebnis wird als nicht verfügbar angezeigt. Eine spätere Antwort ersetzt diesen Zustand nicht unbemerkt. Antworten nach dem Schließen des Popups werden nicht mehr dargestellt.

0 Punkte bedeuten keine gefundenen lokalen Auffälligkeiten, keinen Nachweis von Malwarefreiheit. Fehlende oder ungültige Werte werden nicht zu 0 umgerechnet. Bei unvollständigem Nachrichteninhalt wird ein verfügbarer Score mit dem eingeschränkten Prüfstand angezeigt. Nicht konfigurierte externe Dienste machen eine abgeschlossene lokale Prüfung nicht unvollständig.

## Schnittstellen und Daten

`checkLinkState` ergänzt die vorhandene Antwort additiv um `local` mit `state`, `score`, `reasons`, `reasonDetails`, `observedAt` und `scope: "link-in-message"`. Während der Berechnung ist der Zustand `pending`; danach `checked`, `incomplete` oder `failed`. Nicht vorhandene Zahlen bleiben `null`. Das bestehende Feld `score` bleibt kompatibel. `status`, `check` und die bisherigen Anbietergründe behalten ihre Bedeutung.

Bewertungsgewichte, Adminschwellen, Einwilligungen und Hostberechtigungen werden nicht geändert. Der Debugmodus ist für die lokale Bewertung nicht erforderlich. Es gibt keine zusätzlichen Anbieteranfragen, keine Bestandsmigration und keine automatische Löschung. Die bereits gespeicherten Entscheidungsstände einschließlich OPENED/PENDING bleiben erhalten.

## Abnahme

- `test/optimization.test.js`: tatsächliche lokale Bewertungsfunktionen und Dialogrenderer mit simulierten Thunderbird-APIs; 0/40/100 Punkte, lokale Gründe, Sichtbarkeit vor Fachansicht, Lesefehler, Aufzeichnungsfehler und Auditverhalten.
- `test/popup-loading.test.js`: blockierte Quellenabfrage, ungültige Werte, Zeitüberschreitung und verspätete Antworten; keine Anbieteranfragen.
- `test/analysis-sources.test.js`: sichtbare Scorezeile in beiden Ansichten und sechs Sprachen. Versteckte Vorfahren werden berücksichtigt.
- Chromium/axe prüft Layout, tatsächliche Sichtbarkeit, Tastatur und Themes. Diese Prüfungen simulieren Erweiterungs-APIs.
- `tools/thunderbird-live.dev.py` prüft den sichtbaren Score in Linkdialog, Nachrichtenübersicht und nativem Toolbar-Popup nach lokaler Einrichtung. Das Kandidatengate verlangt diese paketgebundenen Nachweise in sechs Sprachen für beide Linux-Clientziele und bewahrt sie im dauerhaften Abnahmebeleg.

Neue native Nachweise gelten erst nach dem erfolgreichen aktuellen Lauf. Frühere grüne Linux-Läufe für `e621af5` bestätigen nicht die geänderten Paketbytes. Windows/macOS, Screenreader und echte Anbieterabnahmen bleiben getrennt.

## Getrennte Folgeaufgaben zur URL-Erkennung

Diese Gegenfälle wurden bei der Untersuchung ebenfalls reproduziert. Sie werden durch die Anzeigeänderung nicht als behoben bezeichnet; eine eigene Korrektur muss Ressourcenbindung und Fehlalarme berücksichtigen.

| ID | Befund | Reproduzierbarer Umfang |
| --- | --- | --- |
| URL-F01 | Großgeschriebene Protokolle fehlen in der Textinventarisierung | HTML mit `href="HTTPS://PAYPA1.COM/"` ergibt keine extrahierte URL und 0 statt der 100 Punkte des kleingeschriebenen Gegenfalls. |
| URL-F02 | HTML-Zeichenreferenzen im Linkziel fehlen in der Inventarisierung | `https:&#x2f;&#x2f;paypa1.com/` wird vom Browser als Linkziel verstanden, vom bisherigen Textregex jedoch nicht erkannt. |
| URL-F03 | Markenähnlichkeit von Linkdomains hängt von vorhandener Absenderdomain ab | Der gleiche Link ergibt bei leerem Absender 0 Punkte; die unabhängige URL-Regel ist damit nicht vollständig unabhängig. |
| URL-F04 | Sichtbarer URL-Text und tatsächliches HTML-Linkziel werden zusammengezählt | Ein sichtbarer legitimer Markenlink kann die bestehende Absender-Domain-Regel erfüllen, obwohl sein tatsächliches Ziel abweicht. |

Alle Gegenfälle wurden ausschließlich mit synthetischen Nachrichtentexten ohne Netzwerkaufruf untersucht. Daraus folgt keine allgemeine Erkennungsrate.
