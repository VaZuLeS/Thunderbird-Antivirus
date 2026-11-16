# Fünf Korrekturen nach der Fehleranalyse — 16. November 2026

Entwicklungskandidat 1.25.8. Veröffentlicht bleibt 1.25.7 bis zur gesonderten vollständigen Freigabe. Keine Aussage über die Ursache des noch nicht mit einem echten Debugbericht untersuchten Live-Anbieterfehlers.

## Aktuelles Urteil und frühere Fehler

`ThundyAnalysis.refreshStored` übernimmt jetzt auch nach einem gespeicherten Fehler einen belegten aktuellen Bericht für dieselbe gebundene Ressource. Der aktuelle Befund kann dadurch als `checked`/`complete` angezeigt werden. Fehlerzähler, frühere Fehlerdetails, Antwort-/Cachezähler und historische Datensätze bleiben erhalten. Das Lesen gespeicherter Beobachtungen erzeugt keinen neuen HTTP-Antwortzähler. Laufende Prüfungen und live beobachtete Zeilen werden nicht überschrieben; ältere Beobachtungen verdrängen neuere nicht.

Der Gegenfall startet mit einem gespeicherten Hybrid-Fehler und einem später gespeicherten fertigen Bericht. Vorher blieb die Quellenzeile auf `failed/unknown`, während die Ressourcenbewertung `malicious` erkannte. Danach stimmen Urteil und Quellenanzeige überein. Der gleiche Vertrag gilt für einen späteren sauberen Anbieterbefund: Er bleibt ein Anbieterurteil und ist keine pauschale Sicherheitsgarantie.

## Aufbewahrung und Diagnose

- Alle abgelaufenen Debugeinträge werden unabhängig von ihrer Listenposition entfernt. Abschlussreihenfolge und Startreihenfolge paralleler Anfragen dürfen verschieden sein. Der Ablaufcallback plant nicht erneut wegen eines übersehenen veralteten Eintrags einen 1-ms-Timer.
- Abgelaufene Diagnosetickets können durch verspäteten Abschluss keine neue Aufzeichnung anlegen. Dies verändert weder Scanaufträge noch Nutzerentscheidungen.
- Die feste Liste sicherer Protokollwerte enthält nun auch `INVALID_API_KEY`, `NO SPECIFIC THREAT`, weitere bereits im Anbieteradapter verstandene harmlose Aliase und `MALICIOUS_VISUAL`. Beide Redaktionsstufen erhalten diese Werte. Schlüssel, private URLs und beliebiger Freitext bleiben ausgeblendet.
- `request.body.bytes` zählt UTF-8-Bytes. Der gleiche sichere Zahlenwert bleibt auch bei Popup-Erfassung erhalten. ASCII, Umlaute und Emoji sind geprüft. Bereits exportierte Dateien werden nicht verändert.

Der Debugmodus bleibt standardmäßig aus und bei gesetztem Passwort administrativ geschützt. Die Grenzen für Anzahl, Speicher und Zeit werden nicht erhöht. Externe Dienste bleiben optional; die Korrekturen starten keine zusätzlichen Anbieteranfragen.

## Vendorstand

Der aktuelle main pinnt tldts 7.5.1. Der zuvor unveränderte Vendorbestand verursachte in CI einen tatsächlichen `check:vendor`-Fehler. `vendor/tldts.js` wird mit `node scripts/update-vendor.js --write` aus der gepinnten Abhängigkeit reproduziert; die unveränderte Lizenz wird ebenfalls abgeglichen. Die bestehenden Domain-/PSL-/Paketprüfungen bleiben Pflicht.

## Validierung

Neue deterministische Gegenfälle für gespeicherte Fehler mit späterem Bericht, Schutz aktiver/live Zeilen, erhaltene Fehler-/Antwortzähler, rückwärts abschließende Anfragen, Ablaufgrenzen, verspätete Tickets, sichere Protokollwerte und UTF-8-Längen. Der tatsächliche Renderer wird in Übersicht und Fachansicht für EN/DE/FR/ES/IT/PL geprüft. Diese VM-/DOM-Prüfungen sind von echten Thunderbird-Prüfungen getrennt.

`tools/stored-failure-recovery.dev.py` ergänzt die paketgebundene native Prüfung: echte Nachrichtenansicht, Popup, IndexedDB und Audit bei synthetischen Anbieterantworten. Das Kandidatengate verlangt den Nachweis ab 1.25.8 für beide deklarierten Linuxlinien. Der dauerhafte Beleg projiziert nur feste Nachweisflags, keine Rohantworten oder Profilkopien.

[Abnahmeprotokoll](live_test_1_25_8.md), [Releaseumfang](releases/1.25.8.md). Windows/macOS, Screenreader, Live-Kontoverträge und automatische Updateverteilung bleiben gesonderte offene Nachweise. OPENED bezeichnet Thunderbirds Öffnungsannahme; PENDING bleibt nach Prozessverlust offen. Keine Datenmigration oder zusätzliche Löschpolitik für Analyse-/Auditdaten.

Lokaler Stand: 1.303 Regressionen sowie 86 gezielte Prüfungen erfolgreich. [Maschinenlesbarer Kandidatennachweis](audits/five-fixes-1.25.8.json). Native Prüfungen sind in dieser Umgebung mangels Thunderbird/Xvfb noch nicht ausgeführt; beide Linuxlinien bleiben Pflicht der neuen CI. Frühere Paketnachweise werden nicht auf diese Bytes übertragen.
