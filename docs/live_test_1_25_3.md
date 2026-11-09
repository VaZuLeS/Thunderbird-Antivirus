# Abnahmeprotokoll 1.25.3

Entwicklungsabnahme der aktionsbezogenen urlscan-Kontingente. Ausschließlich synthetische Anbieterantworten, ohne Produktionsschlüssel oder echte Nachrichten.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| Q01 | Getrennte Kontingente: gesperrte Einreichung erlaubt Ergebnisabruf, Suche und Hybrid Analysis | OK | test/provider-contracts.test.js: urlscan submission cooldown leaves result retrieval, search and other services available |
| Q02 | Erfolgreiche Antwort mit Restkontingent null behält ihre Bewertung und sperrt nur ihre API-Aktion | OK | test/provider-contracts.test.js: a successful response with zero remaining quota keeps its assessment and defers only its own operation |
| Q03 | Wartende Einreichungen prüfen neue Sperren vor Versand erneut; kein zweites POST oder erfundene Antwort | OK | test/provider-contracts.test.js: queued submissions recheck newly learned cooldowns without a second POST or invented HTTP response |
| Q04 | Widerruf der Einwilligung hat Vorrang vor einer gespeicherten Kontingentsperre | OK | test/provider-contracts.test.js: revocation wins over a cached provider cooldown |
| Q05 | Headerprüfung: ungültige Werte, längster gültiger Reset, Tagesgrenze und feste Aktionskennungen | OK | test/provider-contracts.test.js: quota parsing rejects malformed values, uses the longer valid reset and caps waits at one day; arbitrary quota action headers cannot become metadata or prototype lookups |
| Q06 | Schlüsselwechsel entfernt Benutzersperren, erhält IP-Sperren; POST wird nicht automatisch wiederholt | OK | test/provider-contracts.test.js: credential replacement clears user-scoped quotas but preserves IP quotas and POSTs never retry |
| Q07 | Gleichzeitig bestehende Benutzer- und IP-Sperren bleiben beim Schlüsselwechsel unabhängig | OK | test/provider-contracts.test.js: overlapping user and IP cooldowns survive credential changes independently |
| Q08 | Lokal zurückgestellter Verbindungstest behauptet keinen neuen HTTP-Antwortstatus | OK | test/provider-contracts.test.js: a locally deferred key test does not claim another provider HTTP response |
| Q09 | Lokale Herkunft, Restkontingent null und erlaubte Exportfelder bleiben erhalten; überholte Fehlerangaben werden ersetzt | OK | test/analysis-sources.test.js: quota metadata preserves zero and local provenance across restart and both six-language views; test/source-export.test.js |
| Q10 | Sechs Sprachen, Browserlayouts, Tastatur und gemeinsame Fachansicht | OK | test/analysis-sources.test.js; tools/browser-ui.dev.cjs: 34 lokale Smoke-Fälle; sechs vollständige Browser-/Zoomjobs in CI 42610066145 |
| Q11 | Native Nachricht-/Popup-Anzeige: HTTP 429, bestehender Bericht abrufbar und kein zweites POST | OK | tools/thunderbird-live.dev.py --automatic-scan-check: providerResults.actionScopedQuota=true; sichtbarer Hinweis in beiden Oberflächen; nativer CI-Job 129136516535 |
| Q12 | Vollständige Regression, Quell-, Übersetzungs-, Lint- und Paketprüfung | OK | npm run check: 1.226 Tests bestanden, 0 Fehler; Quell-, Übersetzungs-, Lint- und Paketprüfung erfolgreich; vorheriger Test-/Paketjob 129135962213 |
| Q13 | Kandidatengate verwirft fehlende oder fremde Kontingentnachweise | OK | scripts/release-integrity.test.js: 1.25.3 requires package-bound synthetic urlscan action quota acceptance |

**Summe:** 13 OK / 0 FAIL / 0 N/A / 0 OFFEN

Die vollständige CI-Abnahme muss zum endgültigen Commit und den exakten Paketbytes gehören. Dieses lokale Protokoll allein erfüllt kein Release-Gate. Keine Aussage über produktive API-Kontingente, Windows/macOS oder Screenreader.

Die 13 Fälle schlüsseln die bereits geprüften Verhaltensweisen einzeln auf. Der vorherige Lauf [42610066145](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/42610066145) bestand sämtliche Funktions-, Browser- und nativen Prüfungen sowie die Bindung der Nachweise an das Paket. Der abschließende Gate-Aufruf scheiterte an der bisherigen Zusammenfassung in nur sieben Protokollzeilen. Die Mindestanforderung von zehn bestandenen Fällen bleibt unverändert. Der frühe Konsistenztest reproduziert diesen Fehler und prüft zusätzlich abweichende Summen und dokumentierte Fehler; ausdrücklich offene Entwicklungsprotokolle bleiben zulässig.

Geprüft unter Linux mit Thunderbird 153.5.1 ESR und Chromium 154.0.8037.57. Paketversion 1.25.3, SHA-256 `c4450bbf7237b2f42266aa0c7302fd714a00ac11059b1c4974c9552c0ee10f8e`, Quellfingerprint `31f5e21a50d33e82de4a256ce4218dfe97386bb0a1c766135e3afc725c8dc4da`. Die 34 Browserfälle beziehen sich auf denselben Fingerprint. Webbuild erfolgreich; Lint: 0 Fehler, 39 bestehende Warnungen.

Synthetische native Aufnahmen: [Kontingentanzeige direkt in der Nachricht](screenshots/1.25.3/urlscan-quota-inline.png) und [im Popup](screenshots/1.25.3/urlscan-quota-popup.png). Die Prüfung kontrolliert die tatsächliche Sichtbarkeit des Hinweises. Bekannte Berichte bleiben bei gesperrter Einreichung abrufbar; weitere Einreichungen erzeugen kein POST.

Der Korrekturstand ändert ausschließlich dieses Protokoll und die frühen Konsistenztests. Nach erneutem Paketbau sind Version, Quellfingerprint und SHA-256 identisch mit dem zuvor nativ und im Browser geprüften Stand. Die korrigierte Protokollprüfung ersetzt nicht die vollständige Kandidatenabnahme des neuen Commits.
