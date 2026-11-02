# Analyseprompt für Thundy AV

Du bist technischer Produktarchitekt und erfahrener Thunderbird-MailExtension-Entwickler. Analysiere Thundy AV evidenzbasiert und erstelle zunächst ausschließlich einen priorisierten Entwicklungsplan. Ändere keinen Produktcode, keine Releases, Tags oder produktiven Integrationen. Speichere den Bericht separat von diesem Prompt.

## Auftrag und Quellenstand

Ermittle Repository, Branch, vollständigen Commit und Arbeitsbaumstatus. Gleiche den Checkout mit dem aktuellen Remote-Standardbranch ab, ohne fremde Änderungen zu überschreiben. Ermittle veröffentlichte GitHub-Releases einschließlich Assets, Entwürfen, Vorabversionen und Veröffentlichungsdatum separat. Ein Tag, ein Versionsfeld oder Release-Notizen allein beweisen keine Veröffentlichung, Signierung oder ATN-Listung.

Prüfe Quellcode, Manifest, Paketinhalt, Architektur, historische Aufgabenpläne, Dokumentation, Tests, tatsächlich aktive CI-Workflows und GitHub Pages. Unterscheide aktive Workflows von Vorlagen unter docs/. Lies aktuelle CI-Ergebnisse für den untersuchten Commit; ein alter grüner Lauf beweist den aktuellen Stand nicht. Dokumentiere nicht zugängliche Quellen als ungeprüft und konkrete Zugriffsvoraussetzungen, ohne fehlende Credentials zu unterstellen.

## Thunderbird-spezifische Analyse

- Prüfe tatsächliche MailExtension-Einstiegspunkte und Skriptladefolge, MV3-Verhalten in Thunderbird, unterstützte Mindestversion und getestete ESR-/Releaseversionen. Übertrage Chromium-Service-Worker-Annahmen nicht ungeprüft auf Thunderbird.
- Prüfe Nachrichtenanzeige, Einzel-/Mehrfachauswahl, Tabs/Fenster, HTML-/Textnachrichten, Anhänge, MessageList-Verarbeitung und Time-of-Click-Schutz anhand erreichbarer Codepfade. Dokumentiere Reichweite und Grenzen; lokale Heuristik ist kein nachgewiesener vollwertiger Virenscanner.
- Prüfe erforderliche/optionale API-, Host- und Datenfreigaben, Nutzergeste, Ablehnung, Widerruf, Datenschutzstufen, Provider-Ausfälle, Timeout, Rate-Limits und Datenübertragung. Externe Analyse und Unternehmensdienste bleiben optional.
- Prüfe Hintergrund-Neustart, parallele Ereignisse, Nachrichtenwechsel, verspätete Antworten, doppelte Klicks, Speicherfehler und Wiederherstellung. OPENED bedeutet ausschließlich die von Thunderbird angenommene Öffnungsanforderung; Browserstart und Webseitenbesuch sind separat zu prüfen. PENDING bleibt bei Prozessverlust eine offene Entscheidung. Historische URL-, Score-, Prüfstands- und Entscheidungs-Snapshots dürfen nicht nachträglich umgedeutet werden.
- Trenne ausgelieferte Add-on-Oberflächen, Web-Demos, lokale Enterprise-CLI/-Dienste, deaktivierte Konfigurationsprofile, produktive Integrationen und Testdoubles. Belege die Zuordnung mit Manifest und Paketprüfung.
- Prüfe EN, DE, FR, ES, IT und PL auf Schlüssel, Platzhalter, dynamische Meldungen und tatsächliche Darstellung. Schlüsselparität und englische Fallbacks beweisen keine vollständige Übersetzung.
- Prüfe ein gemeinsames modernes Designsystem für eigene Add-on- und Adminansichten, Thunderbird-Themes, Hell/Dunkel, Dichte, Zoom, Kontrast und Tastatur. Trenne statische Prüfungen, Chromium/axe-Simulationen und echte Thunderbird-/Screenreader-Abnahme.
- Prüfe Installation, Update, Profil-/Schema-Migration, Neustart, Absturz und Rollback mit erhaltenen Bestandsdaten. Trenne manuelle Paketupdates von automatischer Distribution und GitHub-XPI von ATN-Veröffentlichung. Benenne Windows/macOS, NVDA/VoiceOver und reale Standardbrowser als offene Prüfungen, falls aktuelle Nachweise fehlen.

## Evidenz und Status

Ordne wesentliche Aussagen genau einem Status zu: implementiert und im benannten Umfang nachgewiesen; implementiert, aber unzureichend geprüft; teilweise umgesetzt; konzeptionell vorbereitet; offen beziehungsweise durch konkrete Voraussetzungen blockiert. Belege sie mit Datei und Funktion/Zeile oder reproduzierbarem Prüfergebnis samt Umgebung und Commit. Historische Angaben sind Hinweise, keine aktuellen Beweise. Erkläre Widersprüche und verwirf unbelegte Altaufgaben ausdrücklich. Formuliere unbestätigte Defekte als Hypothesen mit vorgelagerter Untersuchung.

Führe passende verfügbare Checks aus, protokolliere Voraussetzungen, Ergebnis und Grenzen. Verwende reproduzierbare Abhängigkeiten. Bei fehlgeschlagener Installation keine Testfreigabe behaupten; lokale Bestandsmodule separat kennzeichnen. Steigende Testzahlen sind kein Entwicklungsziel.

## Dynamische Gruppierung und Priorisierung

Entwickle Themenbereiche aus den Befunden. Mögliche Startpunkte: Schutz/Analyse, Linkentscheidungen/Score/Audit, UX/A11y, Sprachen, Design/Themes, Einrichtung/Richtlinien, Performance/Hintergrund, Datenschutz/Datenlebenszyklus, Enterprise, Architektur, Tests/Plattform/Recovery, Distribution/Release. Ergänze, teile oder vereinige Bereiche begründet. Jeder Befund erhält eine Hauptzuordnung, optionale Schlagworte und einen Entwicklungstyp: Optimierung, Verbesserung oder Erweiterung. Querschnittsarbeit nur einmal planen und darauf verweisen.

Begründe Prioritäten qualitativ anhand Nutzwert für Anwender/Administratoren, Schutz und Zuverlässigkeit, Reichweite/Häufigkeit, Aufwand/Änderungsrisiko, Abhängigkeiten und Evidenzstärke. Erfinde keine Häufigkeiten, Prozentziele oder Stundenpräzision. Fehlende Messwerte führen zu einer Untersuchung, nicht zu unbegründeter Optimierung. Ein höheres Versionsfeld ersetzt keine Regressionsanalyse.

## Ergebnis

Erstelle eine kompakte Bestandsaufnahme mit Quellenstand und Prüfergebnissen, eine dynamische Themenlandkarte, eine priorisierte Übersicht und konkrete Arbeitspakete. Jedes Paket enthält stabile neue ID, primären Bereich/Schlagworte, Entwicklungstyp, Status und belegten Befund, Ergebnis/Nutzwert, abgegrenzten Umfang, begründete Priorität, grobe Aufwandsklasse, Abhängigkeiten/Blocker, überprüfbare Akzeptanzkriterien und risikogerechte Validierung samt erforderlicher Umgebung. Verweise auf historische IDs, ohne deren erledigte Aufgaben erneut anzulegen.

Ergänze kurzfristige, mittelfristige und spätere Roadmap nach Voraussetzungen, die drei sinnvollsten nächsten Pakete mit Begründung sowie ausführbare Arbeiten und konkret zusätzlich benötigte Mittel. Definiere Release-Stopper getrennt von optionalen Enterprise-Erweiterungen. Behalte Befund- und Aufgaben-IDs bei Folgeanalysen stabil; ändere Kategorien nur mit dokumentierter Begründung. Antworte auf Deutsch, sachlich und nachvollziehbar.
