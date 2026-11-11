# API-Debugmodus und Hybrid-Abrufvertrag — 11. November 2026

Entwicklungskandidat **1.25.7**; veröffentlicht bleibt bis zur gesonderten Freigabe 1.25.6. Keine Live-Kontoabnahme aus synthetischen Antworten ableiten.

## Bedienung

1. Einstellungen öffnen. Bei gesetztem Adminpasswort zunächst die Administration entsperren.
2. Unter **API-Debugmodus** die API-Diagnose aktivieren und die Debugeinstellung speichern. Das leert vorherige Diagnoseeinträge.
3. Den fehlgeschlagenen Scan oder Berichtabruf ausdrücklich wiederholen. Der Debugmodus selbst erteilt keine Einwilligung und sendet keine Anfrage an einen externen Dienst.
4. **Debugbericht ansehen** und anschließend **Debugbericht exportieren**. Der Dateiname ist `thundy-api-debug.json`.
5. Diagnose deaktivieren. Dies leert die Aufzeichnung; alternativ **Debugbericht leeren** verwenden. Bereits exportierte Dateien werden dadurch nicht gelöscht.

Auch ohne Adminpasswort bleibt Debugging zunächst ausgeschaltet. Mit gesetztem Passwort prüfen Hintergrundbefehle dieselbe dokumentgebundene, ablaufende Adminsitzung wie andere geschützte Einstellungen. Die Sperre gilt für Status, Änderung, Vorschau/Export und Leeren, nicht nur für deaktivierte HTML-Felder. Ein Popup darf begrenzte Diagnosen hinzufügen, aber den Bericht nicht lesen. Die lokale Adminsperre ist kein Schutz vor direkter Veränderung des Thunderbird-Profils.

Die Einstellung bleibt im Profil erhalten. Aufzeichnungen liegen ausschließlich im Hintergrund-Arbeitsspeicher: höchstens 100 abgeschlossene Einträge / 1 MiB, Aufbewahrung höchstens eine Stunde, bis zu 200 laufende Tickets für höchstens fünf Minuten. Ein Neustart verliert die Aufzeichnungen. Ausschalten oder Leeren invalidiert laufende Tickets; verspätete Antworten können geleerte Daten nicht wiederherstellen. Laufende Tickets bleiben als `unconfirmed` erkennbar und sind kein abgeschlossenes Prüfergebnis oder Nutzerentscheid.

## Bericht und Datenschutz

`api_diagnostics.js` projiziert ausschließlich festgelegte Felder. Erfasst werden Anbieter, HTTP-Methode, Endpunktvorlage, Ressourcen-/Referenztyp, pseudonymisierte Referenzen, Vorhandensein eines Authentifizierungsheaders, Art/Feldnamen des Anfragekörpers, Zeit, Laufzeit, bis zu drei bestehende HTTP-Versuche, HTTP-Status, klassifizierter Inhaltstyp, Parserzustand und feste Fehlerkategorien. Bekannte Status-/Urteilswerte, Zahlen, Boolesche Werte und begrenzte Antwortstrukturen bleiben erhalten. Unbekannte Felder werden gezählt und ausgelassen; Freitext wird ausgeblendet. Antwortreferenzen lassen sich innerhalb desselben Erfassungskontexts mit einer späteren Abrufreferenz vergleichen.

API-Schlüssel, Headerwerte, Cookies, Passwörter, private Ziel-URLs, Nachrichtentexte, Dateiinhalte und rohe HTML-/JSON-Antworten werden nicht exportiert. Kennungen werden durch `ref-N` ersetzt. Die Projektion wird bei Popup-Nachrichten im Hintergrund erneut geprüft. Zurückgegebene Dienstantworten werden durch Debugging nicht fachlich verändert. Diagnosefehler dürfen die Analyse nicht abbrechen. Der Bericht ist kein Rohmitschnitt; ausgeblendete Freitexte lassen sich daraus nicht wiederherstellen.

`success` bezeichnet erfolgreichen HTTP-Transport, **keine** vollständige Analyse oder Sicherheitsfreigabe. `bodyState: invalid_json` neben HTTP 403 unterscheidet beispielsweise eine HTML-Fehlerseite von einer auswertbaren Anbieterantwort. Feste `errorCode`-Werte unterscheiden fehlende Hostberechtigung, fehlende Einwilligung, gesperrte Datenschutzstufe und Ressourcenabweichung. Ein lokaler Quotenabbruch wird getrennt von echten HTTP-Antworten erfasst. Bestehende POST-Anfragen erhalten keine automatische Wiederholung.

Die Aufzeichnung dient allen fünf vorhandenen Gateway-Adaptern: Hybrid Analysis, urlscan, VirusTotal, URLhaus und AbuseIPDB. Echte Kontorechte und Dienstantworten müssen weiterhin mit zulässigen Testressourcen abgenommen werden. Bereits vor Aktivierung gescheiterte Anfragen können nicht nachträglich aufgezeichnet werden.

## Dokumentationsrecherche und begrenzte Hybrid-Korrektur

Die [offizielle Hybrid-API-Seite](https://hybrid-analysis.com/docs/api/v2) lieferte beim Webabruf keinen auslesbaren Inhalt. Der [offizielle VxAPI-Client](https://github.com/hybrid-analysis/VxAPI/tree/55d852c7e07fb586acf5440204e3950ac43b04da) belegt die getrennten Routen:

- [Quick-Scan-Abruf](https://github.com/hybrid-analysis/VxAPI/blob/55d852c7e07fb586acf5440204e3950ac43b04da/api/callers/scan/api_scan_scan.py): `GET /quick-scan/{id}`; die zugehörige CLI benennt ausdrücklich die ID des Scans.
- [SHA-Übersicht](https://github.com/hybrid-analysis/VxAPI/blob/55d852c7e07fb586acf5440204e3950ac43b04da/api/callers/overview/api_overview.py): `GET /overview/{sha256}`.
- [URL-Einreichung](https://github.com/hybrid-analysis/VxAPI/blob/55d852c7e07fb586acf5440204e3950ac43b04da/api/callers/scan/api_scan_url_for_analysis.py): `POST /quick-scan/url-for-analysis`.

Die [Dokumentation der ThreatQ-eigenen Hybrid-Integration](https://helpcenter.threatq.com/Integration_Documentation/operation/Hybrid_Analysis.htm) zeigt ergänzend Quick-Scan-Antworten und benennt deren Feld `id` als Quick-Scan-ID. Dies ist ein historischer Integrationsbeleg, kein aktueller Live-Vertrag des Anbieterzugangs.

Ein kontrollierter Gegenfall mit verschiedenen `id`, `submission_id` und `job_id` scheiterte vor der Korrektur: Nach Übersicht-404 wurde die Submission-ID auf der Quick-Scan-Route verwendet, der Auftrag blieb unvollständig. Neue Quick-Scan-Antworten speichern `hybrid_quick_scan_id` additiv. Koordinator, Time-of-Click und manuelle Popup-Abrufe bevorzugen diese Kennung. Submission-/Sandboxfelder und historische Entscheidungen bleiben erhalten. Die bestehenden Legacy-Fallbacks sind weiter lesbar; dies schließt deren vollständige Typbindung oder sichere Wiederzuordnung unbekannter Altbestände nicht ab. Keine Bestandsmigration, keine neue Einreichung und kein geratenes Sandbox-Berichtsformat.

Die [offizielle urlscan-Schnellstartanleitung](https://docs.urlscan.io/guides/quickstart) trennt Einreichung und späteren Ergebnisabruf; ein noch nicht fertiger Ergebnisabruf kann HTTP 404 liefern, gelöschte Ergebnisse HTTP 410. Diese Zustände sind von ungültiger Authentifizierung, Quoten und fertigen Urteilen getrennt zu lesen. Das bestehende Ergebnis-Polling wird durch den Debugmodus nicht erweitert.

## Nachweise und Grenzen

- `test/api-diagnostics.test.js`: Opt-in, echte Gateway-Instrumentierung mit synthetischem Transport, keine zusätzlichen Anfragen, Adminsitzung, Senderbindung, Ausblenden von Geheimnissen, Parser-/HTTP-/Netzfehler, Löschung, verspätete Antworten und Begrenzung.
- `test/scan-jobs.test.js`: Gegenfall mit verschiedenen Hybrid-Kennungen, vorher unvollständig, nachher richtiger Quick-Scan-Abruf.
- `test/security.test.js`: tatsächlicher Einstellungsclient mit Hintergrundautorisierung; gesperrte Debugsteuerung und Leeren der Vorschau beim Sperren.
- `tools/api-debug.dev.py`: echter Linux-Thunderbird, tatsächliche Adminoberfläche, Hintergrund- und Popup-Erfassung, HTML-403, urlscan-Antwort, nativer Dateiexport, keine Testgeheimnisse im Bericht, unverändertes Audit und leere Aufzeichnung nach Deaktivierung. Ausschließlich synthetischer Providertransport.
- Kandidatengate verlangt diese native Debugprobe für beide deklarierten Linuxlinien; der dauerhafte Releasebeleg enthält nur ihre festen Nachweisflags, keine Debugberichte.

Windows/macOS, NVDA/VoiceOver, tatsächliche Kontoverträge und automatische Updates bleiben separate Abnahmen. Der ursprüngliche Nutzerfall ist ohne bereinigte tatsächliche Antwort beziehungsweise neuen Debugbericht weiterhin nicht endgültig diagnostiziert. OPENED bleibt Thunderbirds Öffnungsannahme; PENDING bleibt nach Prozessverlust offen.

[Maschinenlesbarer lokaler Kandidatennachweis](audits/api-debug-1.25.7.json): 1.297 Regressionen ohne Fehler oder übersprungene Prüfungen; nach Integration der unabhängig übernommenen Rendereroptimierung zusätzlich 60 gezielte Prüfungen und eine neue native Linux-140.12.0-Probe für die endgültigen Paketbytes. Zwölf Einstellungsfälle bei 200 % Zoom in sechs Sprachen gehören zum vorherigen Stand; frühere Browserstände bleiben ausdrücklich getrennt. Vollständige Remote-Paketabnahme und Veröffentlichung sind noch offen.
