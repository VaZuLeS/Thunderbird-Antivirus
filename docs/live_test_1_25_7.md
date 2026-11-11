# Abnahmeprotokoll 1.25.7

Unveröffentlichter Entwicklungskandidat. Providerantworten sind synthetisch; der ursprüngliche Nutzerfall benötigt weiter seine tatsächlichen Diagnosedaten.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Diagnose standardmäßig aus und ohne zusätzliche Provideranfrage | OK | test/api-diagnostics.test.js |
| C02 | Änderung, Lesen und Leeren durch Hintergrund-Adminprüfung geschützt | OK | test/api-diagnostics.test.js und test/security.test.js |
| C03 | Schlüssel, URLs, Rohdaten und unbekannter Freitext ausgeblendet | OK | negative CANARY-Prüfungen |
| C04 | HTTP, Parserfehler und Transportfehler unterscheidbar | OK | test/api-diagnostics.test.js |
| C05 | Begrenzung, Leeren und verspätete Antworten | OK | test/api-diagnostics.test.js |
| C06 | Unterschiedliche Hybrid-IDs richtig abrufen | OK | test/scan-jobs.test.js; Gegenfall vor Korrektur fehlgeschlagen |
| C07 | Admin-Debugoberfläche in echtem Thunderbird | OK | lokale Linux-140.12.0-Probe, synthetischer Transport |
| C08 | JSON über tatsächlichen nativen Speicherdialog exportieren | OK | tools/api-debug.dev.py; tatsächliche Datei erneut gelesen |
| C09 | Hintergrund- und Popup-Erfassung ohne Berichtsleserecht im Popup | OK | tatsächliche Thunderbird-APIs und Senderprüfung |
| C10 | Sechs Sprachen, Themes, Tastatur und Zoom im Browser | OFFEN | vollständige aktuelle Browsermatrix erforderlich |
| C11 | Vollständige neue Paket-CI für beide Linuxlinien | OFFEN | Kandidatengate einschließlich API-Debugprobe |
| C12 | Öffentliche Releaseassets unabhängig prüfen | OFFEN | erst nach Veröffentlichung |
| C13 | Audit erhalten und Deaktivierung leert Aufzeichnungen | OK | native Speicher- und Exportgegenprobe |

**Summe:** 10 OK / 0 FAIL / 0 N/A / 3 OFFEN
