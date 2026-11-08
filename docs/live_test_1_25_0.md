# Prüfprotokoll 1.25.0 — externe Analysen und lokale Linkfreigabe

Die automatisierten Anbieterprüfungen verwenden synthetische Antworten und Schlüssel. Native Prüfungen verwenden isolierte Linux-Profile; sie sind keine Live-Anbieterabnahme.

| ID | Prüffall | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| T01 | Feste Schlüsseltests aller fünf Anbieter, Berechtigungen, Fehlerklassen, Kontingent und Datenstufen | OK | test/provider-contracts.test.js |
| T02 | Geheimnisfilterung und getrennte Originalwerte ohne Wahrscheinlichkeitsbehauptung | OK | test/provider-contracts.test.js |
| T03 | Passwortverifier, Wiederherstellung, Fehlversuche und administrative Schreibkontrolle | OK | test/security.test.js |
| T04 | Grenzwerte, bösartige Befunde, unvollständige Prüfung und einmalige kontextgebundene Freigaben | OK | test/security.test.js |
| T05 | Vereinfachte und technische Darstellung in sechs Sprachen | OK | test/security.test.js, test/analysis-sources.test.js |
| T06 | Whitelist und verifizierte Zuordnung aktueller Anhang-/Linkbefunde | OK | background.test.js, test/report-lifecycle.test.js |
| T07 | Bestehende Regressionstests, Quell-, Vendor-, Design- und Dokumentationsprüfung | OK | npm run check |
| T08 | Browserlayouts, Tastaturbedienung und Barrierefreiheit | OK | 34 lokale Smoke-Prüfungen mit Chromium |
| T09 | Reale Einstellungssperre, abgewiesener Schreibzugriff, Entsperren und erneutes Sperren | OK | tools/thunderbird-live.dev.py --security-check; Linux, Thunderbird 153.5.1 ESR |
| T10 | Separate Freigabeseite und genau ein genehmigter Öffnungsversuch | OK | derselbe native Prüflauf |

Die Fälle T08–T10 wurden im Entwicklungsstand bestanden. Die native Abnahme T09–T10 wurde anschließend mit den neu aufgebauten 1.25.0-Paketbytes unter Linux mit Thunderbird 153.5.1 ESR erneut bestanden. Lokaler Paket-SHA-256: `ece4ad293d148b2c217b448e910e26246ad66216f2be62132b0fa909c6f96d43` (kein Ersatz für die Prüfsumme der später veröffentlichten CI-Paketbytes). Die verbleibenden Plattform- und Providergrenzen stehen im [Freigabeumfang](VEROEFFENTLICHUNG_1_25_0.md).

**Summe:** 10 OK / 0 FAIL / 0 N/A / 0 OFFEN
