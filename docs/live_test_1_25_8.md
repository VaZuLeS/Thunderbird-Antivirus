# Abnahmeprotokoll 1.25.8

Veröffentlichte GitHub-Distribution; öffentliche Assets unabhängig geprüft. Synthetische Anbieterantworten und echte Thunderbird-/OS-Prüfungen werden getrennt ausgewiesen.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Gespeicherter Fehler wird durch neueren Schadbefund ergänzt | OK | test/analysis-sources.test.js |
| C02 | Sauberes neues Urteil und frühere Fehler bleiben getrennt | OK | test/analysis-sources.test.js |
| C03 | Antwort-/Fehlerzähler und historische Eingaben unverändert | OK | deterministische Modellprüfung |
| C04 | Aktive/live Zeilen und ältere Berichte geschützt | OK | test/analysis-sources.test.js |
| C05 | Altersgrenze bei paralleler umgekehrter Abschlussreihenfolge | OK | virtueller Timer-Gegenfall |
| C06 | Verspätete abgelaufene Tickets bleiben ohne Abschlussaufzeichnung | OK | test/api-diagnostics.test.js |
| C07 | Bekannte Protokollwerte erhalten, Geheimnisse ausgeblendet | OK | beide Redaktionsstufen und Negativprüfung |
| C08 | UTF-8-Größe korrekt, auch im Popup-Vertrag | OK | ASCII-/Umlaut-/Emoji-Gegenfälle |
| C09 | Gepinnter Vendorstand und Lizenz bytegleich | OK | check:vendor nach reproduzierbarer Generierung |
| C10 | Sechs Sprachen in Übersicht und Fachansicht | OK | tatsächlicher Renderer mit simuliertem DOM |
| C11 | Beide Linuxlinien einschließlich neuer nativer Fehler-Recovery | OK | Release-CI 43842985011; tatsächliche Nachrichtenansicht, Popup, IndexedDB und Audit |
| C12 | Vollständige Browser-Sprach-/Theme-/Tastatur-/Zoommatrix | OK | Release-CI 43842985011; sechs Sprachen |
| C13 | Öffentliche Releaseassets unabhängig prüfen | OK | audits/release-1.25.8.json; alle drei Assets heruntergeladen und validiert |

**Summe:** 13 OK / 0 FAIL / 0 N/A / 0 OFFEN
