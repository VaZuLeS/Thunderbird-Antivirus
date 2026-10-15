# Einstellungen und Themes

Die Einstellungen sind in Darstellung, Datenschutz, Schutz, Analysedienste, Absenderregeln sowie Daten und Werkzeuge gegliedert. Eine Seitennavigation, klar beschriftete Eingabefelder, ausklappbare Anbieterinformationen und eine dauerhaft erreichbare Speichern-Aktion ersetzen die bisherige fortlaufende Liste. Auf schmalen Ansichten wird die Navigation umgebrochen und das Formular einspaltig dargestellt.

Die übergreifende Produktsprache und die noch offene Konsolidierung der Offline-Adminansichten sind im [Designsystem](DESIGNSYSTEM.md) mit [bedienbarer Referenz](UI_DESIGNSYSTEM.html) beschrieben.

## Darstellung auswählen

Unter **Einstellungen → Darstellung** stehen drei Erscheinungsbilder zur Verfügung:

- **Thunderbird folgen**: übernimmt verfügbare, ausreichend kontrastreiche Popup-Farben des aktiven Thunderbird-Themes. Ohne geeignete Farbangaben gilt das vom System gemeldete helle oder dunkle Farbschema.
- **Hell**: bleibt auch bei dunklem Thunderbird-/System-Theme hell.
- **Dunkel**: bleibt auch bei hellem Thunderbird-/System-Theme dunkel.

Die Akzentfarben **Ozean, Violett, Wald und Bernstein** verändern Bedienelemente und Hervorhebungen. Automatisch übernommene native Farben haben für Oberflächen und Lesetext Vorrang. Die wichtigen Warn-, Fehler- und Erfolgsfarben behalten ihre semantische Bedeutung.

Die Darstellung wird sofort lokal gespeichert. Der Speichern-Knopf ist weiterhin für die übrigen Einstellungen nötig. Gespeichert werden ausschließlich `thundyAppearance` und `thundyAccent`; Scanfreigaben, Provider-Schlüssel und Daten bleiben dabei unberührt. Bei Schreibfehlern bleiben die Auswahl und eine Schaltfläche zum erneuten Speichern sichtbar.

## Gemeinsame Oberfläche

Das Theme gilt für Einstellungen, Scanner-Popup, Einrichtungsassistent, Linkprotokoll, Unternehmensprofile und lokale Datenschutzhinweise. Bereits geöffnete Add-on-Seiten übernehmen lokale Änderungen direkt. Die Linkprüfung fragt die aktuelle Darstellung beim Öffnen des Dialogs erneut ab. Nachrichteneinblendungen übernehmen die Darstellung bei ihrer Erstellung. Die Farben der eigentlichen E-Mail und Thunderbirds eigenes Theme werden nicht verändert.

Die neue Berechtigung `theme` dient dem Lesen von `browser.theme.getCurrent()` und Theme-Änderungen. Es werden keine Themes installiert, verändert oder aus dem Netz geladen. Nur validierte, deckende Farbwerte werden verwendet; native Text-/Hintergrundpaare benötigen mindestens Kontrast 4,5:1. Bei ungeeigneten Werten oder API-Fehlern werden die eingebauten Farben verwendet.

Alle neuen Texte sind vollständig in Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch enthalten. Die Auswahl ist mit der Tastatur bedienbar. Fokusmarkierungen, reduzierte Bewegung und System-Kontrastmodi werden berücksichtigt. Eigenes CSS und externe Theme-Dateien sind nicht Teil der Auswahl.

## Automatisierte Prüfung

`npm run check`: 907 Tests bestanden, keine Lintfehler, 24 bekannte Thunderbird-Lintwarnungen. Nach dem letzten Feinschliff wurden die zehn Theme-Tests, Lint und Paketprüfung erneut erfolgreich ausgeführt. Paket: 42 Dateien, 744.873 Bytes unkomprimiert.

Chromium mit Test-APIs: 72 Einstellungsvarianten über sechs Sprachen, drei Erscheinungsbilder, zwei Breiten und beide Systemfarbschemata; zusätzlich 20 Layouts weiterer Add-on-Ansichten, zwei isolierte Linkdialoge und Live-Synchronisierung zwischen fünf Seiten. Die mobile Speicherleiste wird separat auf ausreichende Textbreite und kompakte Höhe geprüft.

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
