# Prüfprotokoll 1.24.7 — Remote-API-Parser, Quick-Scan-Lebenszyklus und Befundintegration

Die folgenden konkreten Verhaltensfälle sind durch lokale Node-/DOM-Prüfungen der Produktfunktionen geprüft. Native Ergänzungen erfolgen im CI-Kandidatenlauf; Providerantworten in automatisierten Läufen bleiben synthetisch. Dieses Protokoll allein ist keine Live-Anbieterabnahme. [Umfang und paketgebundene Evidenz](VEROEFFENTLICHUNG_1_24_7.md).

| ID | Prüffall | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| T01 | Hybrid Analysis v2 Overview-, Summary- und Quick-Scan-Normalisierung (`scanners`, `scanners_v2`, `whitelisted`, `multiscan_result`) | OK | `test/report-lifecycle.test.js` |
| T02 | Automatischer `GET /api/v2/quick-scan/{id}`-Fallback bei `HTTP 404` in `api.js` und `background.js` | OK | `test/report-lifecycle.test.js` |
| T03 | Sofortige Persistierung fertiger Quick-Scan-Antworten für Datei- und URL-Scans ohne Hängenbleiben in `UPLOADED` | OK | `test/report-lifecycle.test.js` |
| T04 | AbuseIPDB `isWhitelisted`-Vorrang, URLScan.io Objekt-/String-`brands` & `reportUrl` sowie URLhaus-Normalisierung | OK | `test/report-lifecycle.test.js` |
| T05 | Anklickbare Hybrid-Analysis- und URLScan.io-Berichtslinks sowie Scanner-Chips in `api.js` | OK | `test/report-lifecycle.test.js`, `test/popup-loading.test.js` |
| T06 | Vereinheitlichte Threat-Intel- und URLScan.io-Karten im Toolbar-Popup (`popup.js`) | OK | `test/popup-loading.test.js` |
| T07 | Lokale Offline-Darstellung gespeicherter fertiger Anhang- und Link-Berichte ohne Einwilligung oder API-Key | OK | `test/report-lifecycle.test.js` |
| T08 | Integration verifizierter Anhang- und Link-Befunde in `calculateThreatScore()` und `refreshThreatBanner` | OK | `test/report-lifecycle.test.js` |
| T09 | Erhalt von `virustotal_stats` und `urlscan` über manuelle Nachabfragen und erneutes Link-Speichern hinweg | OK | `test/report-lifecycle.test.js` |
| T10 | Reine Leseprojektion für beschädigte Ressourcen-/Quellenlisten ohne Überschreiben der Originale | OK | `test/analysis-sources.test.js`, `test/optimization.test.js` |
| T11 | Unterscheidung zwischen Antworten ohne auswertbares Urteil und echten Befunden in allen fünf Diensten | OK | `test/analysis-sources.test.js`, `test/popup-loading.test.js` |
| T12 | Sechssprachige Lokalisierung (DE, EN, ES, FR, IT, PL) und Fallback-Synchronität (`i18n.js`) | OK | `npm run check:i18n`, `test/i18n.test.js` |
| T13 | Reproduzierbares XPI-Paket und Allowlist-Verifikation (`verify-package.js`) | OK | `npm run package` |
| T14 | Vorbereitete statische Quell-, Design-, Vendor- und Dokumentationsprüfungen | OK | `npm run check:source`, `npm run check:web` |

**Summe:** 14 OK / 0 FAIL / 0 N/A / 0 OFFEN
