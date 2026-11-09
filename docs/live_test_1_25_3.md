# Abnahmeprotokoll 1.25.3

Entwicklungsabnahme der aktionsbezogenen urlscan-Kontingente. Ausschließlich synthetische Anbieterantworten, ohne Produktionsschlüssel oder echte Nachrichten.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| Q01 | Getrennte Kontingente für Einreichung, Ergebnis und Suche | OK | test/provider-contracts.test.js |
| Q02 | Wartende Einreichungen, Headergrenzen und Schlüsselwechsel | OK | derselbe Vertragstest |
| Q03 | Sechs Sprachen, lokale Herkunft und Export-Feldliste | OK | test/analysis-sources.test.js, test/source-export.test.js |
| Q04 | Vollständige Regression, Quell-, Übersetzungs-, Lint- und Paketprüfung | OK | npm run check; 1.220 Tests bestanden |
| Q05 | Browserlayouts, Tastatur und Fachansicht | OK | tools/browser-ui.dev.cjs; 34 Smoke-Fälle in sechs Sprachen |
| Q06 | Native Thunderbird-Prüfung: HTTP 429, bestehender Bericht und kein zweites POST | OK | --automatic-scan-check; providerResults.actionScopedQuota=true; sichtbarer Hinweis in Nachricht und Popup |
| Q07 | Kandidatengate verwirft fehlende oder fremde Kontingentnachweise | OK | scripts/release-integrity.test.js |

**Summe:** 7 OK / 0 FAIL / 0 N/A / 0 OFFEN

Die vollständige CI-Abnahme muss zum endgültigen Commit und den exakten Paketbytes gehören. Dieses lokale Protokoll allein erfüllt kein Release-Gate. Keine Aussage über produktive API-Kontingente, Windows/macOS oder Screenreader.

Geprüft unter Linux mit Thunderbird 153.5.1 ESR und Chromium 154.0.8037.57. Paketversion 1.25.3, SHA-256 `c4450bbf7237b2f42266aa0c7302fd714a00ac11059b1c4974c9552c0ee10f8e`, Quellfingerprint `31f5e21a50d33e82de4a256ce4218dfe97386bb0a1c766135e3afc725c8dc4da`. Die 34 Browserfälle beziehen sich auf denselben Fingerprint. Webbuild erfolgreich; Lint: 0 Fehler, 39 bestehende Warnungen.

Synthetische native Aufnahmen: [Kontingentanzeige direkt in der Nachricht](screenshots/1.25.3/urlscan-quota-inline.png) und [im Popup](screenshots/1.25.3/urlscan-quota-popup.png). Die Prüfung kontrolliert die tatsächliche Sichtbarkeit des Hinweises. Bekannte Berichte bleiben bei gesperrter Einreichung abrufbar; weitere Einreichungen erzeugen kein POST.
