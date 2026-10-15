# Einstellungen und Themes

Die Einstellungen sind in Darstellung, Datenschutz, Schutz, Analysedienste, Absenderregeln sowie Daten und Werkzeuge gegliedert. Eine Seitennavigation, klar beschriftete Eingabefelder, ausklappbare Anbieterinformationen und eine dauerhaft erreichbare Speichern-Aktion ersetzen die bisherige fortlaufende Liste. Auf schmalen Ansichten wird die Navigation umgebrochen und das Formular einspaltig dargestellt.

Die übergreifende Produktsprache und die umgesetzte Konsolidierung der Offline-Adminansichten sind im [Designsystem](DESIGNSYSTEM.md) mit [bedienbarer Referenz](UI_DESIGNSYSTEM.html) beschrieben.

## Darstellung auswählen

Unter **Einstellungen → Darstellung** stehen drei Erscheinungsbilder zur Verfügung:

- **Thunderbird folgen**: übernimmt verfügbare, ausreichend kontrastreiche Popup-Farben des aktiven Thunderbird-Themes. Ohne geeignete Farbangaben gilt das vom System gemeldete helle oder dunkle Farbschema.
- **Hell**: bleibt auch bei dunklem Thunderbird-/System-Theme hell.
- **Dunkel**: bleibt auch bei hellem Thunderbird-/System-Theme dunkel.

Die Akzentfarben **Ozean, Violett, Wald und Bernstein** verändern Bedienelemente und Hervorhebungen. Automatisch übernommene native Farben haben für Oberflächen und Lesetext Vorrang. Die wichtigen Warn-, Fehler- und Erfolgsfarben behalten ihre semantische Bedeutung.

Die Darstellung wird sofort lokal gespeichert. Der Speichern-Knopf ist weiterhin für die übrigen Einstellungen nötig. Gespeichert werden ausschließlich `thundyAppearance`, `thundyAccent` und `thundyDensity`; Scanfreigaben, Provider-Schlüssel und Daten bleiben dabei unberührt. Bei Schreibfehlern bleiben die Auswahl und eine Schaltfläche zum erneuten Speichern sichtbar.

Unter **Informationsdichte** stehen „Komfortabel“ und „Kompakt“ zur Verfügung. Die Auswahl steuert Abstände und Kontrollhöhen in Einstellungen und lokalen Adminwerkzeugen, ohne die Textgröße der Datenansichten zu verkleinern.

## Gemeinsame Oberfläche

Das Theme gilt für Einstellungen, Scanner-Popup, Einrichtungsassistent, Linkprotokoll, Unternehmensprofile und lokale Datenschutzhinweise. Bereits geöffnete Add-on-Seiten übernehmen lokale Änderungen direkt. Die Linkprüfung fragt die aktuelle Darstellung beim Öffnen des Dialogs erneut ab. Nachrichteneinblendungen übernehmen die Darstellung bei ihrer Erstellung. Die Farben der eigentlichen E-Mail und Thunderbirds eigenes Theme werden nicht verändert.

Die neue Berechtigung `theme` dient dem Lesen von `browser.theme.getCurrent()` und Theme-Änderungen. Es werden keine Themes installiert, verändert oder aus dem Netz geladen. Nur validierte, deckende Farbwerte werden verwendet; native Text-/Hintergrundpaare benötigen mindestens Kontrast 4,5:1. Bei ungeeigneten Werten oder API-Fehlern werden die eingebauten Farben verwendet.

Alle neuen Texte sind vollständig in Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch enthalten. Die Auswahl ist mit der Tastatur bedienbar. Fokusmarkierungen, reduzierte Bewegung und System-Kontrastmodi werden berücksichtigt. Eigenes CSS und externe Theme-Dateien sind nicht Teil der Auswahl.

## Offline-Adminberichte

Alle sieben Renderer betten denselben generierten Design-Kern mit dem bestehenden CSP-Nonce ein. Unter „Darstellung“ lassen sich Farbschema, Akzent und Dichte ausschließlich mit nativen Radios und CSS auswählen. Die Auswahl gilt nur für das Dokument; es werden keine Einstellungen, Quelldaten oder Exportdaten geschrieben. Statische Betriebs- und Kapazitätsberichte bleiben ohne Skripte nutzbar.

Die Ereignisreview zeigt fünf Kernspalten mit sortierbarem Zeitpunkt. Vollständige bereitgestellte URL, damaliger/letzter Score und technische Angaben sind in den Details enthalten; der Export bleibt vollständig. Die Fallübersicht hält wichtige Warnungen sichtbar und klappt technische Prüfdaten erst auf Wunsch auf.

Die tatsächlichen Admin-Einstellungen für optionale Profile zeigen einen Änderungsvergleich, einen inaktiven Entwurfsstatus, Verwerfen und erneutes Laden. Ladefehler sperren Speichern, Zurücksetzen und Export; fehlgeschlagene Schreibvorgänge erhalten die Auswahl. Eine lokale Speicherung aktiviert keine Integration.

## Automatisierte Prüfung

`npm run check`: 919 Tests bestanden, keine Lintfehler und 24 bekannte Thunderbird-Lintwarnungen. Paket: 44 Dateien, 770.358 Bytes unkomprimiert; die letzte Paketprüfung vergleicht alle enthaltenen Dateien mit dem Arbeitsstand. Generator und CSS-Quelldatei werden nicht mitgeliefert. Das geprüfte Paketbudget beträgt 775 KiB.

Chromium mit Test-APIs: 72 Einstellungsvarianten in sechs Sprachen sowie 252 Varianten der sieben Offline-Adminrenderer (gefüllte/leere bzw. nie gemeldete Zustände, zwei Breiten und beide Systemfarbschemata). Vollständige Exporte nach Theme-/Filterwechseln und Live-Synchronisierung zwischen fünf Add-on-Seiten geprüft. Nach der Asset-Optimierung wurden 48 CSS-Zustände einschließlich Tastaturwechsel und Druckmodus sowie zwölf Add-on-Layouts erneut geprüft.

## Prüfung und reale Thunderbird-Abnahme

Die automatisierten Prüfungen verwenden gemockte Thunderbird-APIs. Für die reale Freigabe auf Thunderbird 140 ESR und aktueller Version unter Windows, macOS und Linux prüfen:

1. Helles, dunkles und individuell gefärbtes Thunderbird-Theme wählen; automatische Darstellung und Wechsel bei geöffneten Add-on-Seiten prüfen.
2. Hell/Dunkel erzwingen und alle vier Akzente wählen. Text, Eingabefelder, Links, Fokus und Warnungen müssen erkennbar bleiben.
3. Einstellungen mit 360 Pixeln Breite und bei 200 Prozent Zoom prüfen. Alle Felder, Seitennavigation und Speichern müssen erreichbar bleiben.
4. Änderungen mit Tab, Umschalt+Tab, Pfeiltasten und Leertaste bedienen. Auswahlstatus und Fehlerrückmeldungen mit Screenreader prüfen.
5. Theme ändern, ohne andere Einstellungen zu speichern: API-Schlüssel, Einwilligung und Absenderfreigaben bleiben erhalten. Schreibfehler auslösen und erneut speichern.
6. Scanner über das Nachrichten-/Kontextmenü öffnen; feste Popup-Breite und ausführliche Ergebnisse prüfen. Links aus einer bereits geöffneten Nachricht prüfen, abbrechen und mit Browserübergabe öffnen; Protokollierung und semantische Warnfarben prüfen.
7. Einrichtungsassistent, Protokoll, Datenschutzhinweise und Unternehmensprofile mitlesen. Updates öffnen den Assistenten weiterhin nicht erneut.

Die Ausführung dieser realen Abnahme bleibt offen; Browser-Screenshots belegen die gerenderte Oberfläche mit Test-APIs.

Der [versionierte UX05-Browser-/axe-Prüflauf](UI_BROWSERPRUEFUNG.md) ergänzt `npm run check:ui` und unabhängige Sprachprüfungen in der CI. Gefundene Hauptbereichs-, Link- und Tabellenfokusprobleme wurden korrigiert. Reale Thunderbird-/OS-/Screenreader-Abnahme bleibt offen.
