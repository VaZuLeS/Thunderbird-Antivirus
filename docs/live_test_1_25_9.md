# Abnahmeprotokoll 1.25.9

| ID | Verhalten | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Begrenzter Linkcheck; unbekannt bei Standardeinstellungen bestätigbar | OK | test/optimization.test.js, simulierte APIs und Timer |
| C02 | Späte Befunde ändern keine Nutzerentscheidung | OK | Audit-/Sicherheitsintegration, simuliert |
| C03 | Anbieterzustände, Polling und abgebrochene Vorbereitung | OK | test/scan-jobs.test.js, virtuelle Zeit |
| C04 | Ursprünglicher Schreibfehler und atomarer Abbruch | OK | db.test.js; Fehler injiziert |
| D01 | Diagnoseansicht: eigener Adminzugriff, Filter/Pause, Export und Lösch-/Sperrrennen | OK | test/api-debug-view.test.js, test/api-diagnostics.test.js; simulierte APIs/DOM |
| D02 | Neuer Diagnosetab in sechs Sprachen, Themes, Dichten und schmalen Ansichten | OK | [Release-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/44425122989), Browserprüfung |
| D03 | Eigener Diagnosetab in beiden Linux-Thunderbird-Linien | OK | Release-CI, native Prüfung mit synthetischem Transport |
| C05 | Vollständige native Linux- und Browsermatrix des geprüften XPI | OK | Release-CI mit paketgebundenem Freigabegate |
| C06 | Öffentliche Release-Dateien | OK | [Unabhängiger HTTPS-Abruf und Abgleich](audits/release-1.25.9.json) |
| C07 | Direktes Upgrade von 1.25.8, Absturzprüfung und Vor-Upgrade-Profilrestore | OK | Beide Linux-Linien und sechs Sprachen mit dem durch SHA-256 gebundenen veröffentlichten 1.25.8-Paket |
| L01 | Gültige 0 Punkte ohne externe Dienste bleiben sichtbar | OK | test/optimization.test.js, lokale Funktionen und simulierte APIs |
| L02 | 40/100 Punkte und lokale Gründe erreichen den Linkdialog | OK | test/optimization.test.js, synthetische Nachrichten |
| L03 | Score bleibt in einfacher Ansicht und Fachansicht sichtbar | OK | test/optimization.test.js; versteckte Vorfahren geprüft |
| L04 | Blockierte Quellenantwort verhindert lokale Popup-Bewertung nicht | OK | test/popup-loading.test.js, ausstehende Antwort injiziert |
| L05 | Lokaler Lesefehler und fehlender Quellenkontext werden getrennt behandelt | OK | test/optimization.test.js, Fehler injiziert |
| L06 | Ungültige oder fehlende Zahlen werden nicht zu 0 | OK | test/popup-loading.test.js, ungültige Antworten |
| L07 | Zeitüberschreitung und Antworten nach Schließen ändern die Anzeige nicht verspätet | OK | test/popup-loading.test.js, kontrollierte Antwortreihenfolge |
| L09 | Versionierte Scores: ältere Antworten und verspätete Quelle nach Timeout verworfen | OK | test/popup-loading.test.js, kontrollierte Reihenfolge und Runtimewechsel |
| L10 | Vollständige URL-Ziele unabhängig von Anbieterfiltern; exakte Befundzuordnung | OK | test/optimization.test.js, tatsächliche Parser und simulierte Thunderbird-APIs |
| L11 | Anhangabgleich liest nur relevante Teile und prüft tatsächliche Bytes | OK | test/optimization.test.js, Dateiaufrufe gezählt und Bytes geändert |
| L12 | Auditwartezeiten begrenzt, reale Schreibreihenfolge und PENDING erhalten | OK | test/optimization.test.js, virtuelle Zeit und verspätete Commits |
| M01 | Manuelle Anhangprüfung weist falsche Bindungen vor POST ab und schützt spätere Referenzen | OK | test/optimization.test.js; tatsächliche Produktfunktionen mit simulierten API-/Speichergrenzen |
| M02 | Gesendeter, nicht zuordenbarer Upload verhindert direkte Wiederholung in sechs Sprachen | OK | test/popup-loading.test.js; beide echten Popuphandler im simulierten DOM |
| S01 | Unbekannte Antworten und erhaltene gespeicherte Berichte in getrennten Nachrichten | OK | Echte lokale Prüfungen auf Thunderbird 140.12.0 und 153.7.0 ESR; [Vertrag und Grenzen](QUELLENABNAHME_1_25_9.md) |
| L08 | Scorezeile und Fehlerzustand in beiden Ansichten, sechs Sprachen | OK | test/analysis-sources.test.js, simulierter DOM |

**Summe:** 25 OK / 0 FAIL / 0 N/A / 0 OFFEN

API-Antworten sind synthetisch. Der konkrete Speicherfehler im Nutzerprofil ist noch nicht diagnostiziert. Keine Neuinterpretation historischer Entscheidungen und keine automatische Datenlöschung.

Die Release-CI prüfte das veröffentlichte XPI mit SHA‑256 `21c4df27b24211268f7a96873c43da26eba93b28be84b6d7f9f37cebc388c661`. Sie deckt den Thundy-Anhangschutz mit archiviertem Warnbefund, die Linkübergabe und den direkten Upgradepfad ab. Frühere Kandidatenläufe bleiben gesondert nachvollziehbar. [Veröffentlichung](VEROEFFENTLICHUNG_1_25_9.md) · [Kandidatenlauf mit direktem Upgrade](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/44422645695)

Der frühere Lauf 44254960616 scheiterte auf beiden Linuxlinien an einer vermischten Quellenfixture. Die [isolierte Quellenabnahme](QUELLENABNAHME_1_25_9.md) dokumentiert die Korrektur. [Lokale Scores und Folgeaufgaben](LOKALER_SCORE_1_25_9.md)
