# Abnahmeprotokoll 1.26.3

| ID | Verhalten | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Link- und Anhangschutz nutzen getrennte Firmenregeln und Schweregradfarben | OK | Richtlinien- und Öffnungstests mit synthetischen Befunden |
| C02 | Linkdialog zeigt laufende Aufträge und wartet nur bei entsprechender Einstellung | OK | Tests mit gespeicherten Auftragskennungen und aktivem Abruflimit |
| C03 | Ein Link kann unterhalb der Schwelle direkt öffnen und bleibt nachvollziehbar | OK | Schwellengrenze, spät eingetroffene Befunde und Auditstatus im Integrationstest |
| C04 | Unbegrenzte Linkhistorie übernimmt bestehende Daten | OK | Migration im isolierten Profil mit 2.106 Einträgen und alter Profilkennung |
| C05 | Entscheidung und Fokus bleiben bei erzwungenen Farben erkennbar | OK | Thunderbird 140 ESR und 160 bei 200 Prozent Zoom. [Designprüfung](DESIGN_THEMES.md#prüfung-und-reale-thunderbird-abnahme) |
| C06 | Vollständige URLs und Anhänge erfordern eine Einzelfreigabe | OK | Synthetische Anfragen für automatische Scans, Sammelaktionen, Klicks und Freigaben |
| C07 | Neue Scans bleiben bei vollem Quellenarchiv möglich | OK | Archivgrenze und Speicherausfall getrennt in den Scan- und Archivtests |
| C08 | Firmenmeldungen können zugeordnete Erkennungen und Berichtsreferenzen enthalten | OK | Native Öffnungsdialoge, Vertragstests und lokaler HTTPS-/SMTP-Empfänger |
| C09 | Der Empfänger unterscheidet SMTP-Fehler und erlaubt manuelle Wiederholung | OK | Integrationstests mit SQLite und lokalem SMTP-Relay |
| C10 | Die 24 EU-Sprachkataloge enthalten den vollständigen Schlüsselsatz | OK | Lokale Prüfung der Kataloge und des englischen Fallbacks |
| C11 | Release-CI bindet die Browser- und Thunderbird-Abnahme an das veröffentlichte XPI | OFFEN | Kandidat 1.26.3 wartet auf den GitHub-Workflow und den unabhängigen Downloadabgleich |
| C12 | Nutzung mit einem nativen Windows-Kontrastdesign und Screenreader | OFFEN | Separater Test auf Windows mit aktivierter Bedienungshilfe |

**Summe:** 10 OK / 0 FAIL / 0 N/A / 2 OFFEN

Die Vorabnahme verwendet harmlose Nachrichten, synthetische Anbieterbefunde und einen lokalen Testempfänger. Die Release-CI bindet die plattformbezogenen Installations-, Upgrade- und Rücksicherungstests an das exakte GitHub-Paket.
