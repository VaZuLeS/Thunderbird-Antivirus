# AVN-004.a — Hybrid-Referenzen: belegte Routen und offene Typbindung

Stand: 9. November 2026. Dokumentationsabgleich, keine echte Kontoabnahme.

Offizieller VxAPI-Client, festgehaltener Commit [`55d852c7e07fb586acf5440204e3950ac43b04da`](https://github.com/hybrid-analysis/VxAPI/tree/55d852c7e07fb586acf5440204e3950ac43b04da):

| Fähigkeit | Offizieller Clientpfad | Route |
| --- | --- | --- |
| Datei einreichen | `api/callers/scan/api_scan_file.py` | POST `/quick-scan/file` |
| URL einreichen | `api/callers/scan/api_scan_url_for_analysis.py` | POST `/quick-scan/url-for-analysis` |
| Quick-Scan abrufen | `api/callers/scan/api_scan_scan.py` | GET `/quick-scan/$id` |
| Sandboxbericht | `api/callers/report/api_report_summary.py` | GET `/report/$id/summary` |
| Sandboxstatus | `api/callers/report/api_report_state.py` | GET `/report/$id/state` |

Der Client bestätigt die Routenfamilien, **nicht**, dass jedes Antwortfeld `submission_id`, `job_id`, `reports[0]` oder `id` beliebig für jede Route verwendbar ist. `scan_jobs.js::hybridReport`, `background.js` und `api.js` enthalten noch mehrere Fallbackkombinationen. Insbesondere ist eine Sandbox-Job-ID nicht allein wegen ihrer syntaktischen Form eine belegte Quick-Scan-ID. Historische Felder dürfen nicht rückwirkend umetikettiert werden.

Der nächste Implementierungsschritt benötigt dokumentationsbelegte Antwortfixtures mit unterschiedlichen IDs für Datei und URL. Additiv typisierte Referenzen müssen Quelle, Kennungstyp und zulässige Route erhalten. SHA, Quick-Scan-ID und Sandbox-ID bleiben getrennt; unbekannte historische Referenzen bleiben unbekannt. Gegenfälle: fehlende/abweichende Referenz, fremder Hash, 404 bei noch laufendem Auftrag, mehrere Sandboxberichte, 401/403/429 und Timeout. Frische Anfragen dürfen keine historischen Entscheidungen ändern und POSTs nicht automatisch wiederholen.

Ohne verifizierten Antwortfeldvertrag wird keine neue Route auf Verdacht aktiviert. Die bereits bestandenen synthetischen Parser-/Transporttests bleiben wertvoll; sie bestätigen keine realen Kontorechte oder aktuellen Providerquoten. Der reale Teil bleibt AVN-004.b.
