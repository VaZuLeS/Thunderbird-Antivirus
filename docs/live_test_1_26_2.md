# Abnahmeprotokoll 1.26.2

| ID | Verhalten | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Firmenregeln haben Vorrang vor lokalen Einstellungen | OK | Native Thunderbird-Prüfung mit verwaltetem Pilotprofil und synthetischer Richtlinie |
| C02 | HTTPS-Meldungen erfordern Freigabe und Installationstoken | OK | Native Einrichtung und Vertragstests für Freigaben und Token |
| C03 | Eine blockierte Linkaktion meldet genau einen Versuch | OK | Nativer Linkdialog mit lokalem HTTPS-Empfänger |
| C04 | Das Öffnen des Link-Kontextmenüs meldet keinen Versuch | OK | Nativer Kontextmenütest vor der ersten Aktion |
| C05 | Linkdialog und Nachrichtenansicht übernehmen Hell, Dunkel und System | OK | Native Theme-Wechsel in geöffneten Oberflächen |
| C06 | Link- und Anhangdialoge bleiben bei 200 Prozent mit der Tastatur bedienbar | OK | Native Prüfung mit Fokuswechsel und Abbruch per Tastatur |
| C07 | Die Firmenregel sperrt einen unbekannten Anhang vor der Thunderbird-Übergabe | OK | Nativer Anhangdialog mit verwalteter Regel für unvollständige Befunde |
| C08 | Ein bösartiger Anhangsbefund bleibt an die geprüften Bytes gebunden | OK | Native Prüfung mit synthetischem Hybrid-Analysis-Befund und Anhang-SHA-256 |
| C09 | Der Python-Empfänger übernimmt Link- und Anhangsmeldungen und erzeugt MIME-E-Mails | OK | Thunderbird-POST über HTTPS an den Python-Dienst und lokale SMTP-Annahme |
| C10 | Mehrfache Anlieferung wird zusammengeführt, vorübergehende SMTP-Fehler werden wiederholt | OK | Python-Integrationstests mit SQLite-Neustart und lokalem SMTP-Testrelay |
| C11 | Die verpflichtende Browser- und Thunderbird-Matrix deckt das exakte Release-XPI ab | OK | [Release-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/45195676935) und [unabhängiger Paketabgleich](audits/release-1.26.2.json) |

**Summe:** 11 OK / 0 FAIL / 0 N/A / 0 OFFEN

Die vorbereitenden Prüfungen verwenden harmlose Nachrichten, synthetische Anbieterbefunde und lokale Testempfänger. Die endgültigen Clientversionen, Upgradeprüfungen und Paketidentitäten stehen im veröffentlichten Abnahmenachweis.
