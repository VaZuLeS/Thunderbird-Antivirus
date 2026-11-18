# Abnahmeprotokoll 1.25.9 — Entwicklung

| ID | Verhalten | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Begrenzter Linkcheck; unbekannt bei Standardeinstellungen bestätigbar | OK | test/optimization.test.js, simulierte APIs und Timer |
| C02 | Späte Befunde ändern keine Nutzerentscheidung | OK | Audit-/Sicherheitsintegration, simuliert |
| C03 | Anbieterzustände, Polling und abgebrochene Vorbereitung | OK | test/scan-jobs.test.js, virtuelle Zeit |
| C04 | Ursprünglicher Schreibfehler und atomarer Abbruch | OK | db.test.js; Fehler injiziert |
| D01 | Diagnoseansicht: eigener Adminzugriff, Filter/Pause, Export und Lösch-/Sperrrennen | OK | test/api-debug-view.test.js, test/api-diagnostics.test.js; simulierte APIs/DOM |
| D02 | Neuer Diagnosetab in sechs Sprachen, Themes, Dichten und schmalen Ansichten | OFFEN | aktuelle paketgebundene Browsermatrix erforderlich |
| D03 | Eigener Diagnosetab: native Thunderbird-Abnahme beider Linuxlinien | OFFEN | tools/api-debug.dev.py und Kandidatengate vorbereitet |
| C05 | Aktuelle vollständige native Linux-/Browsermatrix | OFFEN | neue paketgebundene CI erforderlich |
| C06 | Öffentliche Releaseassets | OFFEN | Entwicklungskandidat, nicht veröffentlicht |
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
| L08 | Scorezeile und Fehlerzustand in beiden Ansichten, sechs Sprachen | OK | test/analysis-sources.test.js, simulierter DOM |

**Summe:** 17 OK / 0 FAIL / 0 N/A / 4 OFFEN

API-Antworten sind synthetisch. Der konkrete Speicherfehler im Nutzerprofil ist noch nicht diagnostiziert. Keine Neuinterpretation historischer Entscheidungen und keine automatische Datenlöschung.

[Lokaler Score: Befund, Vertrag und getrennte Folgeaufgaben](LOKALER_SCORE_1_25_9.md). Die native Abnahme von e621af5 war erfolgreich, dessen Kandidatengate scheiterte am zu kurzen Protokoll. Aktuelle native Fälle bleiben bis zum neuen paketgebundenen Nachweis offen; das Gate bleibt unverändert.
