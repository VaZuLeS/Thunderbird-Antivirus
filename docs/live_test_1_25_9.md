# Abnahmeprotokoll 1.25.9 — Entwicklung

| ID | Verhalten | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Begrenzter Linkcheck; unbekannt bei Standardeinstellungen bestätigbar | OK | test/optimization.test.js, simulierte APIs und Timer |
| C02 | Späte Befunde ändern keine Nutzerentscheidung | OK | Audit-/Sicherheitsintegration, simuliert |
| C03 | Anbieterzustände, Polling und abgebrochene Vorbereitung | OK | test/scan-jobs.test.js, virtuelle Zeit |
| C04 | Ursprünglicher Schreibfehler und atomarer Abbruch | OK | db.test.js; Fehler injiziert |
| C05 | Aktuelle vollständige native Linux-/Browsermatrix | OFFEN | neue paketgebundene CI erforderlich |
| C06 | Öffentliche Releaseassets | OFFEN | Entwicklungskandidat, nicht veröffentlicht |

**Summe:** 4 OK / 0 FAIL / 0 N/A / 2 OFFEN

API-Antworten sind synthetisch. Der konkrete Speicherfehler im Nutzerprofil ist noch nicht diagnostiziert. Keine Neuinterpretation historischer Entscheidungen und keine automatische Datenlöschung.
