# Releaseabgleich: veröffentlichte 1.24.2 und Kandidat 1.24.3

TAV-002. Ausgangs-main `6046fe0`, veröffentlichter Tag `v1.24.2` (`26fb960`). Kein bestehender Tag oder Release wurde verändert. Die anfängliche Versionsnummer 1.23.0 in main war kein vollständiger Nachweis seines Funktionsumfangs.

## Jede aktuell abweichende Paketdatei

| Datei | Entscheidung und Prüfung |
| --- | --- |
| `_locales/de/messages.json` | Veröffentlichte Reporttexte wiederaufgenommen, zusätzliche Abbruch-/PENDING-/Speichertexte in dieser Sprache; Katalog-/Platzhalter-/DOM- und Sprachmatrix geprüft. |
| `_locales/en/messages.json` | Veröffentlichte Reporttexte wiederaufgenommen, zusätzliche Abbruch-/PENDING-/Speichertexte in dieser Sprache; Katalog-/Platzhalter-/DOM- und Sprachmatrix geprüft. |
| `_locales/es/messages.json` | Veröffentlichte Reporttexte wiederaufgenommen, zusätzliche Abbruch-/PENDING-/Speichertexte in dieser Sprache; Katalog-/Platzhalter-/DOM- und Sprachmatrix geprüft. |
| `_locales/fr/messages.json` | Veröffentlichte Reporttexte wiederaufgenommen, zusätzliche Abbruch-/PENDING-/Speichertexte in dieser Sprache; Katalog-/Platzhalter-/DOM- und Sprachmatrix geprüft. |
| `_locales/it/messages.json` | Veröffentlichte Reporttexte wiederaufgenommen, zusätzliche Abbruch-/PENDING-/Speichertexte in dieser Sprache; Katalog-/Platzhalter-/DOM- und Sprachmatrix geprüft. |
| `_locales/pl/messages.json` | Veröffentlichte Reporttexte wiederaufgenommen, zusätzliche Abbruch-/PENDING-/Speichertexte in dieser Sprache; Katalog-/Platzhalter-/DOM- und Sprachmatrix geprüft. |
| `api.js` | Veröffentlichte Berichte/Polling/Protokollmetadaten wiederhergestellt; zusätzlich Lebenszyklus- und Hash-/Submissionbindung. Hauptvergleich und gezielte neue Negativtests. |
| `api_gateway.js` | Veröffentlichte Authentisierungsinjektion wiederhergestellt; Header jetzt ohne Mutation und unabhängig von Groß-/Kleinschreibung geschützt. |
| `audit.html` | Vorhandene main-ARIA-Beschreibungen gegenüber 1.24.2 beibehalten; 600 Browserfälle und echte Auditansicht geprüft. |
| `audit.js` | Vorhandene kleine Allokationsoptimierung beibehalten; neue Abbruchlabels und PENDING-Erklärung, Originalexportwerte erhalten. |
| `background.js` | Key-Verdrahtung sowie Reportinvalidierung bei neuer Einreichung wiederhergestellt; vorhandene Link-Schemaoptimierung erhalten. |
| `enterprise_setup.html` | Vorhandene ARIA-Statusbezüge beibehalten; Profil-/Browserprüfungen erfolgreich. |
| `i18n.js` | Aus allen sechs Katalogen reproduziert; zusätzliche Statuslabels und wiederaufgenommene Reporttexte. |
| `manifest.json` | Neue vorbereitete Version 1.24.3, keine neue Runtime-/Netzwerkberechtigung und kein Retagging. |
| `onboarding.html` | Vorhandene ARIA-Statusbeschreibung beibehalten; Wizard-/UI-Prüfungen erfolgreich. |
| `options.html` | Vorhandene Retry-Statusbeschreibung beibehalten; echte Themeprüfung und CSS-Zoomtests erfolgreich. |
| `risk.js` | Vorhandene vorkompilierte Regexkonstanten aus main beibehalten; keine neue Scoregewichtung; Verhaltenskorpus/Regressionstests geprüft. |
| `sanitize.js` | Vorhandene äquivalente Attributvergleiche aus main beibehalten; Sanitizer-/Browsertests erfolgreich. |
| `vendor/tldts.js` | Bewusst auf deklarierten Pin 7.4.19 reproduziert; Bytevergleich und Trennung privater Suffix-Tenants erfolgreich. |

`providers.js` entspricht nach gezielter Wiederaufnahme wieder dem veröffentlichten Stand: urlscan-Ergebnis-Key und bereinigte Hybrid-Analysis-Header sind erhalten. Unveränderte Paketdateien wurden nicht durch ein pauschales Tag-Checkout ersetzt. React und Node-Werkzeuge bleiben aus dem XPI ausgeschlossen.

Die versionierten Release-Notizen 1.24.0–1.24.2 und die zuvor aus main entfernten 1.24.x-Changelogabschnitte wurden aus dem unveränderten Tag wieder aufgenommen. 1.24.3 ist ausdrücklich als unveröffentlichter Kandidat gekennzeichnet.

## Daten und Nachweise

Keine IndexedDB-Schemaänderung, keine automatische Einwilligung und keine Umdeutung alter Entscheidungen. Nach der Wiederaufnahme erzeugte oder verspätete Berichte benötigen dieselbe Inhalts-/Submissionidentität. Echte dauerhafte 1.24.2→1.24.3-Upgrades in sechs Sprachprofilen bewahren Originalwerte; der gesonderte vollständige Profilrestore stellt den früheren Snapshot wieder her.

Ein neuer ZIP-Container ist nicht zwingend byteidentisch zum vorherigen Build. Alle ausgelieferten Dateiinhalte werden kanonisch gehasht. Für Live-/Releaseabnahme werden zusätzlich genau die bereits installierten ZIP-/XPI-Bytes erhalten; der Releaseworkflow baut danach nicht neu.

Belege: [Versionsprotokoll](live_test_1_24_3.md), [Kandidatenevidenz](audits/candidate-1_24_3.json), `api.test.js`, `api_gateway.test.js`, `background.test.js`, `test/report-lifecycle.test.js`, `test/optimization.test.js`, [synthetischer Risikokorpus](audits/risk-corpus-1_24_3.json). Reale Providerverfügbarkeit ist separat offen, kein Grund zum stillen Zurücknehmen veröffentlichter Clientfähigkeiten.
