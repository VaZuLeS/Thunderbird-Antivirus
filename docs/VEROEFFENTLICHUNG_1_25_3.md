# Veröffentlichung 1.25.3

Veröffentlichte Korrektur der [urlscan-Kontingentverarbeitung und ihrer Fachanzeige](URLSCAN_KONTINGENTE.md). [Release Notes](releases/1.25.3.md). Der für 1.25.2 getaggte Stand bleibt unverändert.

Das bestehende GitHub-Release-Gate bleibt verbindlich: vollständige Regression, Quell-, Übersetzungs-, Lint-, Paket-, sechs Sprach-/Browserprüfungen und native Thunderbird-Abnahme. Zusätzlich verlangt das Gate einen zum Paket gehörenden synthetischen Nachweis, dass eine Einreichungssperre den Abruf bestehender Berichte erlaubt und eine weitere Einreichung ohne neue POST-Anfrage zurückstellt. Nachweise anderer Paketbytes werden abgelehnt.

Das Tag wird erst nach erfolgreicher Kandidatenabnahme gesetzt. Der Release-Workflow prüft den getaggten Stand erneut. [GitHub-Veröffentlichungsstatus](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.3). Ein vorbereiteter Quellstand bestätigt keine Veröffentlichung. Keine ATN-Signierung oder automatische Updateverteilung.

## Veröffentlichungsnachweis

Am 9. November 2026 nach vollständiger Abnahme veröffentlicht. Kandidatenlauf [42621374529](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/42621374529) und Release-Lauf [42623624091](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/42623624091) sind erfolgreich, einschließlich 1.226 Tests, sechs Sprach-/Browserprüfungen, nativer Thunderbird-Abnahme und paketgebundenem Gate. Tag `v1.25.3` verweist auf Commit `b006366a17243def6f2b4605103c59a8c2895ab2`.

Der anschließend heruntergeladene [XPI](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/download/v1.25.3/thundy-av-1.25.3.xpi) enthält Version 1.25.3 und umfasst 356.500 Bytes. SHA-256: `d29233c452b770a9f20801b3c77e3319bff2d42d53caa5505875ffc600377022`. Sie stimmt mit [SHA256SUMS.txt](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/download/v1.25.3/SHA256SUMS.txt) und den abgenommenen Paketbytes überein. Quellfingerprint: `988ca6a0cfcb2b4b272dceb4a5922fa676829e630b9cf1adeec4dac948b4db14`. Das ZIP wurde erfolgreich auf Integrität geprüft.

Die parallel eingegangenen Formularänderungen und aktualisierten Entwicklungsabhängigkeiten wurden vor der Abnahme integriert. Der Default-Export von canonicalize 5.1.0 wurde in den separaten lokalen Werkzeugen korrekt eingebunden; keine neuen externen API-Funktionen wurden ergänzt. Einzelheiten stehen im [Abnahmeprotokoll](live_test_1_25_3.md). Diese Dokumentation ändert weder den getaggten Stand noch die veröffentlichten Dateien.
