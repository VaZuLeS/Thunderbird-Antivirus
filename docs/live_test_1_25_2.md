# Abnahmeprotokoll 1.25.2

Lokale Entwicklungsabnahme der detaillierten Hybrid-Analysis-Fachansicht unter Linux, Thunderbird 153.5.1 ESR und Chromium. Automatisierte und native Prüfungen verwenden synthetische Berichte ohne Produktionsschlüssel oder echte Nachrichten. Die paketgebundene vollständige CI-Abnahme einschließlich bisheriger Schutz-, Installations-, Neustart- und Sprachprüfungen bleibt vor Veröffentlichung verbindlich.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| H01 | Erlaubte API-Felder, Scanner, AV-Einzelerkennungen, Berichtkennungen, MITRE | OK | test/provider-results.test.js |
| H02 | Fehlende Angaben, Nullwerte und explizit leere Listen | OK | derselbe Adaptertest |
| H03 | Fremde Hashes, Ressourcenbindung und reine Textdarstellung | OK | test/provider-results.test.js, test/optimization.test.js, test/analysis-sources.test.js |
| H04 | Größenlimits, unveränderte Rohdaten und Ausschluss vom Quellenexport | OK | test/provider-results.test.js, test/optimization.test.js, test/source-export.test.js |
| H05 | Gemeinsamer Popup-/Nachrichtenrenderer ohne Modulglobals in sechs Sprachen | OK | test/analysis-sources.test.js |
| H06 | Vollständige Regression: 1.205 Tests bestanden | OK | npm run check |
| H07 | Browserlayouts und Tastaturbedienung der neuen MITRE-Details | OK | 34 Smoke-Fälle; tools/browser-ui.dev.cjs |
| H08 | Webbuild, Quell-, Übersetzungs-, Lint- und Paketprüfungen | OK | npm run check:web; npm run check |
| H09 | Native Inline-Details mit Signatur, MITRE-Technik und gemeldeter Null | OK | --automatic-scan-check; Screenshot unten |
| H10 | Native Popup-Details und fortbestehender Linkschutz | OK | derselbe native Lauf; providerResults.hybridExpertDetails=true |
| H11 | Passwortbestätigung, Wiederherstellung und lokaler API-Verbindungsstatus ohne Schlüsselanzeige | OK | test/security.test.js |
| H12 | Geschützte Anzeigeoptionen, Entsperren und einmalige Linkfreigabe nativ | OK | --security-check; administration.protectedDisplaySettings=true |
| H13 | Korrigierter Hybrid-URL-Pfad und gemeinsame urlscan-400-Fehlerklassen | OK | native Automatik, test/optimization.test.js, test/provider-contracts.test.js |
| H14 | Anzeigevorgaben, manuelle Umschaltung und unveränderte Gefahrenbefunde | OK | test/analysis-sources.test.js, test/optimization.test.js |
| H15 | Eigene Speicherzustände für Admin-/Anzeigeformulare; zwölf Zoomfälle in sechs Sprachen | OK | options.test.js; Browserprüfung options.html bei 200 Prozent, hell/dunkel |

**Summe:** 15 OK / 0 FAIL / 0 N/A / 0 OFFEN

Getestetes lokales ZIP/XPI: Version 1.25.2, SHA-256 `20645a62b523e52ee69ee4e22f338cffe1a33867f8cd7f118b2ca2c662afe31b`. Paket-Fingerprint `9235df33d0b4d77153922aa99b0af9e13ca28e69d7c3547b5cc984e97ac2516f`. Die native Ausgabe bestätigt weiterhin den bösartigen Teilbefund, den unbekannten Abschluss ohne Verlust dieses Befunds, Aktualisierung ohne POST und konsistente Schutzentscheidungen.

Die folgende Aufnahme dokumentiert die vorherige Fachansicht vor Ergänzung der Admin-/Anzeigeoptionen.

[Native Inline-Ansicht mit synthetischen Berichtsdaten](screenshots/1.25.2/hybrid-expert-inline-synthetic.png).

Dieses Entwicklungsprotokoll allein erfüllt kein Release-Gate. Die CI-Nachweise müssen zum endgültigen Paket und Commit gehören. Eine aktuelle API-Unterversion oder echte Anbieterberechtigungen werden durch synthetische Antworten nicht bestätigt; siehe [Umfang und Quellen](HYBRID_FACHANSICHT.md). Keine Windows-/macOS- oder Screenreaderabnahme.
