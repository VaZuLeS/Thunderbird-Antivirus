# Hybrid Analysis: Fachansicht für API v2

Die Fachansicht in Nachricht und Popup zeigt dieselbe lokale, erlaubnislistenbasierte Projektion der aktuell zugeordneten Hybrid-Berichte. Das Aufklappen erzeugt keine Anfrage. Die Schaltflächen „Jetzt prüfen“, „Ergebnisse aktualisieren“ und „Erneut prüfen“ behalten ihre bisherigen Funktionen und Datenschutzvoraussetzungen.

## Umfang der sichtbaren Daten

| Bereich | Verwendete API-Felder, soweit geliefert |
| --- | --- |
| Identität | SHA-256, SHA-1, MD5, SHA-512, Imphash, Typ, Größe, Dateiname, URL-Analyse, Zieladresse |
| Originalbewertung | verdict, threat_score, threat_level, multiscan_result, av_detect, whitelisted, vx_family, Tags |
| Verarbeitung | id, job_id, submission_id, state, finished, Analysezeit, Umgebung, error_type, error_origin |
| Scanner | scanners und scanners_v2; Name, Originalstatus, Fortschritt, positives, total, percent, Zeiten |
| Einzelne AV-Erkennungen | anti_virus_results; Produkt, Originalurteil, Version, Aktualisierung |
| Berichtsverweise | reports als Kennungen oder Berichtobjekte mit Umgebung, Originalbewertung und Zustand |
| Verhalten | total_processes, total_network_connections, total_signatures, einzelne signatures |
| MITRE ATT&CK | mitre_attcks; Technikkennung, Taktik, Technik und Beschreibung |
| Netzwerk | Gelieferte Domains, Hosts und kompromittierte Hosts; gegebenenfalls IP, Port, Protokoll, Land und ASN |
| Weitere Artefakte | Prozesse ohne Befehlszeilen; extrahierte Dateien mit Hashes, Typ, Größe und Originalbewertung; Zertifikatsangaben |

Die technischen Feldnamen bleiben absichtlich erhalten. Abschnittstitel, Umfangshinweise und Unbekannt-/Leerzustände sind in allen sechs Sprachen übersetzt. Fehlende Werte werden nicht durch Null ersetzt. Explizit leere Listen werden von nicht gelieferten Bereichen unterschieden. Einzelne fehlende Felder innerhalb eines Bereichs bleiben ausgelassen. Die gemeldeten Gesamtzahlen sind Anbieterzahlen; die sichtbare Liste kann unvollständig sein.

Ein Quick-Scan, eine Hashübersicht und ein referenzierter Sandboxbericht belegen nicht dieselbe Prüftiefe. Ein Berichtsverweis allein bedeutet nicht, dass dessen Detaildaten abgerufen wurden. Die Anzeige behauptet keine Sandboxausführung und startet keine zusätzliche Sandbox, Dateidownloads oder automatischen Abrufe referenzierter Berichte. Sie zeigt die in den bestehenden Berichten empfangenen Daten. Bei begrenzten API-Rechten beziehungsweise Antworten bleiben entsprechende Bereiche ausdrücklich nicht verfügbar. Die gemeinsame Schutzbewertung und ihre Konflikte stehen daneben; diese Anzeigeprojektion verändert weder Score noch Freigaberegeln.

## API-Stand und Quellen

Abgleich am 9. November 2026 mit der [offiziellen API-v2-Dokumentation](https://hybrid-analysis.com/docs/api/v2) und dem [Anbieterclient VxAPI](https://github.com/hybrid-analysis/VxAPI). Die interaktive Dokumentation war in dieser Arbeitsumgebung nicht vollständig lesbar. Eine aktuelle API-Unterversionsnummer oder die Vollständigkeit jedes kontospezifischen Feldes wurde deshalb nicht verifiziert. API v2 bezeichnet die Schnittstellenfamilie, keine behauptete Unterversion.

Der Anbieterclient trennt [Übersichten](https://github.com/hybrid-analysis/VxAPI/tree/master/api/callers/overview), [Berichtszustand und Zusammenfassungen](https://github.com/hybrid-analysis/VxAPI/tree/master/api/callers/report) sowie Quick-Scan-/Sandboxeinreichungen. Die Fachansicht verarbeitet verfügbare Felder defensiv; sie behauptet keine vollständige API-Vertragsabnahme anhand synthetischer Beispiele. Die weitere Endpunkt-/Kennungsprüfung bleibt eigenständige Arbeit.

## Datenschutz und Grenzen

Nur aktuell inhaltlich gebundene Ressourcen gelangen in die Anzeige. Abweichende SHA-256-Angaben werden nicht als Bericht der aktuellen Ressource angezeigt. Die Projektion bleibt außerhalb persistierter Quellenmetadaten und des Quellenexports. Unbekannte Felder, Authentifizierungsheader, Cookies, Prozessumgebungen, Befehlszeilen und rohe JSON-Objekte werden nicht übernommen. URLs enthalten keine Benutzerinformationen, Abfrageparameter oder Fragmente. Anbietertexte werden ausschließlich als Text gerendert; es entstehen keine aktiven Links, Bilder oder Skripte.

Je Bereich sind höchstens 50 Einträge sichtbar, je Bericht höchstens 20 Wurzelobjekte, je Text 512 Zeichen und insgesamt etwa 60.000 Zeichen projizierter Felder. Pro Anzeige gelten zusätzlich 100 Ressourcen und 500.000 Zeichen. Kürzungen werden gekennzeichnet. Diese Anzeigegrenzen ändern nicht die Bewertung des vollständigen eingegangenen Berichts.

## Nachweise

Tests in `test/provider-results.test.js`, `test/analysis-sources.test.js` und `test/source-export.test.js` prüfen unbekannte Daten, explizite Nullwerte und leere Listen, Scanner-/AV-Felder, Berichtskennungen, MITRE-Felder, fremde Hashes, Größenlimits, Exportausschluss und reine Textdarstellung. Der gemeinsame Renderer wird in allen sechs Sprachen sowohl als Popupmodul als auch ohne Modulglobals wie in der Nachricht ausgeführt. Der native Automatiktest prüft mit synthetischen Anbieterantworten die echte Nachricht und das echte Toolbar-Popup auf MITRE- und Signaturdetails. Ergebnisse werden erst nach erfolgreichem Lauf als Abnahme bezeichnet.
