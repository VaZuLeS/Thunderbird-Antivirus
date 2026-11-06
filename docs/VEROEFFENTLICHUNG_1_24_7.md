# 1.24.7 — Vollständige Remote-API-Parser, Quick-Scan-Lebenszyklus und vereinheitlichte Befunddarstellung

Stand: 6. November 2026. Tatsächlicher [Veröffentlichungsstatus, XPI und Prüfsumme](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.7). Ein vorbereiteter Quellstand oder dieses Dokument allein bestätigt keine Veröffentlichung. [1.24.6](HOTFIX_QUELLENLADEFEHLER_1_24_6.md) und seine Assets bleiben unverändert erhalten.

## Umfang und abgeschlossene Arbeitspakete

### 1. Hybrid Analysis v2 API-Parser und Quick-Scan-Lebenszyklus
- `remote_parsers.js::normalizeHybridAnalysisReport` wertet v2-Overview-, Summary-, Hash-Search- und Quick-Scan-Payloads vollständig aus (`id` / `submission_id` / `job_id`, `finished`, `scanners` + `scanners_v2` mit Deduplizierung, `whitelisted`, `multiscan_result`, `threat_level`, `vx_family`, `submit_name`, `type_short`, `classification_tags`, `tags`).
- `api.js::fetch_hybrid_report` und `background.js::checkHybridAnalysisResult` fallen bei `HTTP 404` auf `/api/v2/overview/{sha256}` bzw. `/api/v2/report/{id}/summary` automatisch auf `GET /api/v2/quick-scan/{id}` zurück, sodass Quick-Scan-Einreichungen für Dateien und URLs ihren vollständigen Abschlussbericht erreichen.
- Sofortige Quick-Scan-Antworten (`finished: true` oder auswertbare Scannerbefunde direkt beim POST auf `/api/v2/quick-scan/file` bzw. `/api/v2/quick-scan/url`) werden über `background.js::quickScanReport` unmittelbar als fertiger Bericht persistiert, ohne im Status `UPLOADED` hängen zu bleiben.

### 2. Externe Threat-Intel-Parser (AbuseIPDB, URLScan.io, URLhaus, VirusTotal)
- `remote_parsers.js::normalizeAbuseIpdbReport` respektiert `isWhitelisted === true` vor der Schwellenwert-Einstufung (`clean` statt Fehlalarm bei hohen `abuseConfidenceScore`-Werten auf Whitelist-IPs).
- `remote_parsers.js::normalizeUrlscanReport` extrahiert `brands` sowohl aus String-Arrays als auch aus Objekt-Arrays (`{ name, key }`), übernimmt `task.reportURL` bzw. konstruiert `https://urlscan.io/result/{uuid}/` und stellt Screenshot-URLs bereit.
- `remote_parsers.js::normalizeUrlhausHostReport` normalisiert `query_status`, `urls_online`, `blacklists` und Bedrohungs-Tags strukturiert für `background.js::checkDomainReputation`.

### 3. Vereinheitlichte Frontend-Darstellung in Nachrichtenansicht und Popup
- In `api.js` zeigen Anhang- und Link-Karten neben Verdict, Threat-Score (`X/100`), AV-Erkennungsrate und Malware-Familie auch Scanner-Chips (`scanners_v2`), Klassifikations-Tags, Whitelist-Kennzeichnungen sowie anklickbare Berichtslinks (`https://www.hybrid-analysis.com/sample/{sha256}` und `https://urlscan.io/result/{uuid}/`).
- In `popup.js` zeigen gemeinsame Threat-Intel- und URLScan.io-Sektionen gespeicherte und aktuelle Befunde konsistent an.
- In `api.js` werden bereits gespeicherte, abgeschlossene Anhang- und Link-Berichte (`hasFinalStoredReport()`) auch ohne aktive Einwilligung oder API-Key lokal und offline gerendert; es erfolgt dabei keinerlei Netzwerkübertragung.

### 4. End-to-End-Risikobewertung und Persistenzhärtung
- `background.js::collectAttachmentFindings` und `background.js::collectLinkFindings` übergeben verifizierte gespeicherte Anhang- und Link-Befunde an `risk.js::calculateThreatScore` (`evaluateAttachmentFindings`, `evaluateLinkFindings`).
- Nach Abschluss eines manuellen Anhang- oder URL-Scans in `api.js` aktualisiert `refreshThreatBanner` das In-Mail-Bedrohungsbanner sofort; zudem bleiben bestehende Zusatzbefunde (`virustotal_stats`, `urlscan`, `report`) beim erneuten Speichern oder Upload erhalten.

## Validierung

- Kandidaten-Identität: Paket-SHA-256 `b3441e54786a5c3d167e9f41024bbb87b931f572e04d5b98cd363c4a832a7730`, Source-Fingerprint `0b7ab2e109aa84f5b9aed6234348e7b56db5ef98a0687b75de0fce4f1c0aa948` (47 Dateien, 1.073.942 Bytes unkomprimiert).
- `npm run check:source`, `npm run check:web`, `npm test` (**1.109 / 1.109 Tests bestanden**), `python3 tools/test_thunderbird_identity.dev.py -v` (**3 / 3 Tests bestanden**), `npm run lint:filtered` (**0 Fehler / 0 Warnungen**) und `npm run package` erfolgreich geprüft.
- [Versionsgebundenes Prüfprotokoll](live_test_1_24_7.md).
- Der Tag-Workflow (`v1.24.7`) führt die vollständige CI einschließlich Browser-UI-Matrix (6 Sprachen) und nativer Linux-Thunderbird-Prüfung (Upgrade von `1.24.6`, Neustarts, Absturz-Recovery und Profilrestore) vor der Veröffentlichung aus.
