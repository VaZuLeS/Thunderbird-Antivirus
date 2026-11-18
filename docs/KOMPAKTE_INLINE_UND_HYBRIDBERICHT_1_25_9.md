# Kompakte Inline-Ansicht und Hybrid-Analysis-Bericht — 1.25.9

Stand: 18. November 2026. Unveröffentlichter Entwicklungskandidat; keine zusätzliche Berechtigung oder Datenmigration. Die Veröffentlichung 1.25.8 bleibt unverändert.

## Darstellung und Datenvertrag

Die Nachrichtenansicht verwendet eine gemeinsame Leiste für lokalen Score, Scanstatus, Aktionen und Ansichtswechsel. Innenabstände folgen der vorhandenen bequemen/kompakten Informationsdichte. Wichtige Warnungen bleiben sichtbar. Allgemeine Erläuterungen und technische Anbieter-/Verbindungsangaben sind aufklappbar. Das Popup behält seinen bisherigen Aufbau.

Der eigene Berichtstab zeigt ausschließlich bereits empfangene Hybrid-Analysis-Daten. Öffnen, Filtern, Berichtsauswahl und Seitennavigation starten weder Anbieteranfragen noch Uploads. Anzeige ist keine neue Analyse. Die normalisierte Projektion hat Schema 2; bestehende Schema-1-Darstellung, gespeicherte Berichte, Archive und Auditdaten werden nicht migriert oder umgedeutet.

| Bereich | Freigegebene Angaben aus der vorhandenen Projektion |
| --- | --- |
| Identität | Name, Dateityp, Größe, SHA-256, SHA-1, MD5, SHA-512, Importhash; tatsächlich gebundene Ziel-URL einschließlich Query/Fragment separat von gegebenenfalls verkürzter Anbieter-URL |
| Bewertung | Originalurteil, Bedrohungsscore/-stufe, Abschluss, AV-/Multiscanwerte ohne erfundene Einheit, Whitelist, Malwarefamilie und Klassifikation |
| Herkunft | Getrennte Sandboxläufe, Umgebung, Job-ID, explizite Submission-ID, gespeicherte Quick-Scan-ID; generische Antwort-ID bleibt untypisiert; Analysebeginn, Abruf- und Snapshotzeit |
| Scanner | Produkt, Status, Fortschritt, positive/Gesamtzahlen, Originalurteile, Version, Aktualisierung und Prüfzeit, soweit geliefert |
| Verhalten | Signaturname, Typ, Kategorie und Schweregrad; MITRE-ID, Taktik, Technik und Beschreibung aus der Anbieterantwort |
| Netzwerk | Gelieferte Domains, Hosts, kompromittierte Hosts sowie vorhandene IP-/Port-/Protokoll-/Länder-/ASN-Angaben |
| Prozesse und Dateien | Prozess-UID/PID, Eltern-UID, Name, Pfad und Hash; extrahierte Dateien mit Typ, Größe, Hashes und Bewertung |
| Zertifikate | Inhaber, Aussteller, Gültigkeit und Seriennummer; kein pauschaler Vertrauensnachweis |

Lokaler Score, aggregierter Anbieterbefund und ursprüngliches Anbieterurteil bleiben unterscheidbar. Widersprüche werden angezeigt. Mehrere Analysewurzeln behalten eigene Ergebnisse und Umgebungen; unbekannte ID-Typen und Elternbeziehungen werden nicht geraten. Fehlende Felder, ausdrücklich leere Listen, `0`, `false`, ausstehende Ergebnisse und Kürzungen bleiben unterscheidbar. Fehlende Daten belegen keine fehlende Kontoberechtigung und keinen negativen Befund.

Kommandozeilen, Registry-/Dateioperationen, Mutexnamen, PE-Details und Strings sind nicht zusätzlich freigeschaltet. Enhanced Summary und zusätzliche Berichtabrufe benötigen einen eigenen belegten Antwort-/Rechtevertrag. Offizielle Referenzen: [Summary](https://github.com/hybrid-analysis/VxAPI/blob/master/api/callers/report/api_report_summary.py), [Enhanced Summary](https://github.com/hybrid-analysis/VxAPI/blob/master/api/callers/report/api_report_enhanced_summary.py). Live-Kontorechte werden aus synthetischen Fixtures nicht abgeleitet.

## Zugriff, Grenzen und Datenschutz

Der Hintergrund überprüft Nachricht, aktuellen Kontexttoken, eindeutige aktuelle Ressource und die vorhandene Detailfreigabe. Keine beliebigen Datenbankschlüssel aus dem Berichtstab. Der Snapshot bleibt höchstens fünf Minuten zum erneuten Laden verfügbar, ist an den tatsächlich geöffneten Erweiterungstab gebunden und wird bei Cacheleerung beziehungsweise Tababschluss entfernt. Höchstens 20 solche Snapshots werden gehalten. Eine bereits geladene Seite bleibt als datierter Snapshot lesbar; Cacheleerung entfernt auch ihre Anzeige. Nach Prozessverlust oder Ablauf wird kein Ersatzdatensatz geraten.

Je Snapshot werden höchstens 20 Analysewurzeln und rund 450.000 Zeichen projiziert, zusätzlich zu den vorhandenen engeren Abschnitts-/Feldgrenzen. Die Darstellung paginiert 50 verfügbare Zeilen. Suche und Trefferzahl gelten für die verfügbaren Daten; Kürzung bleibt sichtbar. Anbietertexte werden ausschließlich als Text ausgegeben. Es gibt keine automatisch aktiven IOC-Links, DNS-Anfragen, externen Bilder oder Artefaktdownloads. Kopieren erfolgt nur ausdrücklich als Text. Die administrativ geschützte API-Diagnose bleibt getrennt; der Berichtstab enthält keine API-Schlüssel oder Rohprotokolle.

Alle neuen Bezeichnungen werden in EN/DE/FR/ES/IT/PL mitgeliefert. Theme, Dichte, schmale Ansicht und Zoom folgen dem bestehenden Design. Die drei neuen Laufzeitdateien und Sprachkataloge erfordern eine begrenzte Anhebung des Paketbudgets von 1.480 auf 1.560 KiB; Negativprüfungen gegen übergroße Pakete bleiben aktiv.

## Validierung

Risikoabgeleitete Regressionen prüfen Fremdzugriff, Kontextwechsel, mehrere Analysewurzeln, Hashabweichungen, leere/fehlende Felder, Nullwerte, begrenzte Listen, Textinjektionen, Cacheleerung auch während eines laufenden Abrufs, Fokus und sechs Sprachen. Die Browsermatrix enthält den tatsächlichen Berichtstab in verfügbarem und nicht verfügbarem Zustand, mit Hell/Dunkel, beiden Dichten, schmaler Ansicht und Zoom.

Der lokale Höhenvergleich gegen den Stand `6fce94c` misst 48 Referenzfälle bei 900 px: sechs Sprachen × zwei Dichten × zwei Ansichten × lokale/zwei Anbieter. Die Mindestverringerung beträgt 31,9 %. Das ist ein Layoutnachweis für diese Fixtures, keine allgemeine Aussage für beliebige Nachrichten.

`tools/hybrid-report-view.dev.py` prüft die reale Inline-Navigation und den Berichtstab mit echten Thunderbird-/Speicher-APIs und synthetischen gespeicherten Daten. Beide Linuxlinien müssen den paketgebundenen Nachweis für getrennte Berichte, Suche, Textdarstellung, unveränderte Ressourcen/Auditdaten und ausbleibende Anbieteranfragen liefern. Das Kandidatengate fordert diese Flags; dauerhafte Belege enthalten ausschließlich Statusangaben. Tatsächliche aktuelle Laufergebnisse gehören zur jeweiligen Paketidentität, nicht pauschal zu jeder 1.25.9-Datei.

Windows/macOS, reale Screenreader, Live-Anbieterrechte und automatische Updates bleiben eigene Abnahmen. Die gemeinsame Message-ID-Speicherung und dauerhafte Vorkommensidentität bleiben offen. OPENED bezeichnet Thunderbirds angenommene Öffnungsanforderung; PENDING bleibt nach Prozessverlust offen.
