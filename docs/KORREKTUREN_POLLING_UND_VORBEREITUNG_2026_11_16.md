# Polling, Vorbereitung und Anbieterzustände — 16. November 2026

Unveröffentlichte Weiterentwicklung auf Basis von 1.25.8. Die veröffentlichten 1.25.8-Assets und ihre damaligen Nachweise bleiben unverändert. Dieser Entwicklungsstand benötigt vor einer Veröffentlichung eine eigene freie Version und neue paketgebundene Abnahme.

## Behobene Befunde aus der Folgeanalyse

| Analyse-ID | Korrektur | Maßgebliche Prüfung |
| --- | --- | --- |
| NEXT-04 | Neue urlscan-Einreichungen warten vor dem ersten Ergebnis-GET 30 Sekunden. Das begrenzte Pollingfenster beträgt 90 Sekunden einschließlich der Wartezeiten. Aktualisierungen bestehender UUIDs beginnen früher. Die globale Auftragsfrist und Ressourcenlimits bleiben unverändert. | Virtuelle Zeit: Ergebnis erst nach 45 Sekunden, erste Abfrage nach 30 Sekunden, genau ein POST und passende UUID bei allen GETs |
| NEXT-03 | Jede Vorbereitung besitzt eine eigene Gültigkeitsprüfung. Timeout und Invalidierung weisen den Start zurück; verspätete Datei-, Byte- und Hashantworten dürfen keine Ressourcen mehr binden. Bereits laufende Thunderbird-Aufrufe müssen dazu nicht technisch abbrechbar sein. | Langsame Datei/Hashantwort → Timeout → erfolgreicher neuer Versuch → alte Antwort; die neue Bindung bleibt unverändert. Invalidierung weist den wartenden Start unmittelbar zurück. |
| NEXT-05 | HTTP 410 wird als terminales `result_gone` mit lokalisierter Erklärung gespeichert. UUID und frühere Signale bleiben erhalten. Aktualisierung und automatisches Anzeigen lösen keine neue Einreichung für dieses gelöschte Ergebnis aus. Eine ausdrücklich neu gestartete manuelle Prüfung darf neu einreichen. | 410 nach Annahme und nach Teilbefund; Refresh/Anzeige ohne neue Anfrage; neuer ausdrücklicher Scan mit genau einem neuen POST |
| NEXT-01 | Scanner in `scanners_v2` werden als Liste und als Objekt identisch bewertet. Bösartige Signale und Konflikte bleiben gegenüber sauberen übergeordneten Urteilen erhalten. | Identische Assessment-Ergebnisse für beide Formen, auch laufende und fehlerhafte Einträge. Native Probe verwendet nun eine Scannerliste. |
| NEXT-02 | Ein ausdrücklich noch laufendes HTTP-200-Ergebnis bleibt ausstehend. Polling sammelt die Signale bis zum Abschluss oder zur Deadline; ein vorläufiger Befund ist kein Abschluss. Status und Wiederaufnahme verwenden denselben Bewertungsvertrag. | Vorläufig bösartig → endgültig ohne Urteil; dauernd ausstehend → Timeout mit erhaltener UUID und Befund; Wiederaufnahme ohne POST |

Die [offizielle urlscan-Anleitung](https://docs.urlscan.io/guides/quickstart) beschreibt mindestens 30 Sekunden bis zur ersten Ergebnisabfrage, HTTP 404 während der Verarbeitung und HTTP 410 bei gelöschten Ergebnissen. Die Scannerlisten-Inkonsistenz und widersprüchliche HTTP-200-Antwort sind interne Vertrags-/Robustheitskorrekturen; ihre Häufigkeit bei echten Anbietern ist weiterhin nicht belegt. Es wird kein zusätzlicher Live-Anbieternachweis behauptet.

## Erhalt von Daten und Schutzverhalten

Teilergebnisse werden innerhalb eines Pollinglaufs zusammengeführt. Auch nach anschließendem HTTP 410, HTTP 429 oder Transportfehler bleibt ein zuvor beobachtetes bösartiges Signal im gespeicherten Assessment erhalten. Ein solches Ergebnis ist trotzdem fehlgeschlagen beziehungsweise unvollständig. Cachewiederverwendung darf eine bekannte noch ausstehende Ressource nicht als abgeschlossenen Auftrag übernehmen.

Keine Datenmigration, Änderung historischer Nutzerentscheidungen, zusätzliche automatische POST-Wiederholung oder neue Einwilligung. Externe Dienste bleiben optional. OPENED bestätigt ausschließlich Thunderbirds angenommene Öffnungsanforderung; PENDING bleibt nach Prozessverlust offen. Der API-Debugmodus und seine Adminprüfung bleiben erhalten.

## Validierungsumfang

Die Node-/VM-Gegenfälle verwenden synthetische Antworten und virtuelle Zeit. Die bestehende Quellen-/Transportintegration überprüft weiterhin, dass eine angenommene Einreichung vor ihrem Ergebnis sichtbar ist; die neue 30-Sekunden-Wartephase wird dort ausdrücklich freigegeben. Die bisherigen Test-Deadlines werden dadurch nicht als Anbieterfrist verwendet.

Die native Linux-Probe verwendet für den Vergleich gemischter Befunde bereits angenommene synthetische UUIDs. Die tatsächliche frische Wartephase verbleibt in den gesonderten Inline-/Automatikprüfungen. Deren Testzeitbudgets berücksichtigen 30 Sekunden pro neuer Einreichung, einschließlich serialisierter Ressourcen. Die native Anbieterprobe ergänzt die tatsächliche Darstellung eines gelöschten Ergebnisses in Nachrichtenansicht und Popup und prüft den unveränderten POST-Zähler.

Lokale Thunderbird-/Xvfb-Binaries sind in dieser Ausführungsumgebung nicht vorhanden. Native Prüfungen müssen daher separat in der vorhandenen CI ausgeführt werden. Bestehende Releasebelege werden nicht auf diese neuen Paketbytes übertragen. Windows/macOS, Screenreader, Live-Anbieterkonten und automatische Updatekanäle bleiben eigenständige Abnahmen.

Lokale Abnahme: 1.315 Tests ohne Fehler, abgebrochene oder übersprungene Fälle. 403 Integrationsprüfungen und zuletzt 55 gezielte Anbieter-/Koordinatorprüfungen bestanden. Source-/Sprach-/Vendor-/Design-/Dokumentprüfung, Lint und Paketbau bestanden. [Maschinenlesbarer lokaler Nachweis](audits/polling-preparation-2026-11-16.json).
