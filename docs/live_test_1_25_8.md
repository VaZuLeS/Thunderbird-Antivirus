# Abnahmeprotokoll 1.25.8

Unveröffentlichter Kandidat. Synthetische Anbieterantworten und echte Thunderbird-/OS-Prüfungen werden getrennt ausgewiesen.

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
| C11 | Beide Linuxlinien einschließlich neuer nativer Fehler-Recovery | OFFEN | vollständige neue paketgebundene CI erforderlich |
| C12 | Vollständige Browser-Sprach-/Theme-/Tastatur-/Zoommatrix | OFFEN | vollständige neue CI erforderlich |
| C13 | Öffentliche Releaseassets unabhängig prüfen | OFFEN | erst nach Veröffentlichung |

**Summe:** 10 OK / 0 FAIL / 0 N/A / 3 OFFEN
