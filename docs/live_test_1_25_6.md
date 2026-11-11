# Abnahmeprotokoll 1.25.6

GitHub veröffentlicht und Assets unabhängig geprüft. Die tatsächliche Antwort des Nutzers ist noch nicht als bereinigtes JSON verfügbar. Der reproduzierte Gegenfall verwendet ausdrücklich synthetische Providerdaten, keine behauptete Live-Kontoabnahme.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Gespeicherter ausstehender Bericht wird fertig sichtbar | OK | test/optimization.test.js; vor Korrektur reproduziert fehlgeschlagen |
| C02 | Lokaler Befundpfad und Quellenansicht verwenden dasselbe Urteil | OK | collectLinkFindings und Snapshot-Integration |
| C03 | Wiederholtes Lesen verändert keine Antwortzähler | OK | test/analysis-sources.test.js; nativer Gegenfall |
| C04 | Laufende und fehlgeschlagene Prüfungen erhalten | OK | gezielte Modellregression |
| C05 | Ältere Berichte überschreiben keine neueren | OK | gezielte Modellregression |
| C06 | Feste Speichergründe in allen sechs Sprachen | OK | DOM-/Katalogprüfung; keine rohen Fehlermeldungen |
| C07 | Quellenkapazität erhält bestehende Historie | OK | echte IndexedDB, 64 vorhandene Snapshots unverändert |
| C08 | Nachrichtenansicht und echtes Popup zeigen Hybrid-Befund | OK | Linux-Thunderbird 140.12.0, synthetische Providerdaten |
| C09 | Audit und Kontextidentität erhalten | OK | native Speichervergleiche |
| C10 | Kein neuer Provideraufruf durch Aktualisierung | OK | native Fetchzählung und simulierte Transportprüfung |
| C11 | Vollständige neue Remote-Paketabnahme | OK | Release-CI 42995168820: sechs Sprachen und beide Linuxlinien |
| C12 | Öffentliche Releaseassets unabhängig prüfen | OK | audits/release-1.25.6.json; alle drei Assets erneut validiert |
| C13 | Separates gespeichertes URL-Urteil bleibt neben unfertigem Rohbericht sichtbar | OK | Tatsächlicher persistHybridLinkVerdict-Schreibpfad, Modellregression und native Gegenprobe; Rohbericht bleibt ausstehend; gespeicherter Quellensnapshot stimmt überein |

**Summe:** 13 OK / 0 FAIL / 0 N/A / 0 OFFEN
