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

Der Protokoll-Korrekturstand ändert ausschließlich dieses Dokument und die frühen Konsistenztests. Vor der Synchronisierung gingen auf main zusätzlich parallele Änderungen an Formular-Barrierefreiheit, Autocomplete und Entwicklungsabhängigkeiten ein (Basiscommit c1349c4). Diese Änderungen wurden übernommen. Gegenüber dieser Basis verändert die Protokollkorrektur keine paketierten Quelldateien; der obige Fingerprint und die Prüfsumme dokumentieren den vorherigen Stand 386a4db. Der zusammengeführte Stand erhält eine erneute vollständige Abnahme und eine eigene dokumentierte Paketidentität. Die Mindestanforderungen des Gates bleiben unverändert.

Bei der erneuten Integrationsprüfung wurde der geänderte ESM-Default-Export von canonicalize 5.1.0 erkannt. Acht direkte Importstellen in den separaten lokalen Enterprise-Werkzeugen und ihren Tests wurden angepasst. Die bestehende Bibliotheksversion bleibt erhalten; Signatur-/Hashregeln und die Thunderbird-Laufzeit werden dadurch nicht geändert. Die vorhandenen Vertrags-, Signatur-, Speicher- und Browserprüfungen werden mit der aktualisierten Abhängigkeit erneut ausgeführt.

Erneute lokale Abnahme des zusammengeführten Stands: 1.226 Tests, Quell-/Übersetzungs-/Lint-/Paketprüfung und Webbuild bestanden; 34 Browser-Smoke-Fälle bestanden. Native Automatik- und Administrationsprüfung bestanden mit Version 1.25.3 und SHA-256 `d29233c452b770a9f20801b3c77e3319bff2d42d53caa5505875ffc600377022`. Zugehöriger Quellfingerprint: `988ca6a0cfcb2b4b272dceb4a5922fa676829e630b9cf1adeec4dac948b4db14`. Die Abnahme mit dieser Identität berücksichtigt die parallelen Formularänderungen; die zuvor genannte Identität bleibt als historischer Nachweis erhalten.
