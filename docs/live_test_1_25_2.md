# Abnahmeprotokoll 1.25.2

Lokale Entwicklungsabnahme der detaillierten Hybrid-Analysis-Fachansicht unter Linux, Thunderbird 153.5.1 ESR und Chromium. Automatisierte und native Prüfungen verwenden synthetische Berichte ohne Produktionsschlüssel oder echte Nachrichten. Die paketgebundene vollständige CI-Abnahme einschließlich bisheriger Schutz-, Installations-, Neustart- und Sprachprüfungen bleibt vor Veröffentlichung verbindlich.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| H01 | Erlaubte API-Felder, Scanner, AV-Einzelerkennungen, Berichtkennungen, MITRE | OK | test/provider-results.test.js |
| H02 | Fehlende Angaben, Nullwerte und explizit leere Listen | OK | derselbe Adaptertest |
| H03 | Fremde Hashes, Ressourcenbindung und reine Textdarstellung | OK | test/provider-results.test.js, test/optimization.test.js, test/analysis-sources.test.js |
| H04 | Größenlimits, unveränderte Rohdaten und Ausschluss vom Quellenexport | OK | test/provider-results.test.js, test/optimization.test.js, test/source-export.test.js |
| H05 | Gemeinsamer Popup-/Nachrichtenrenderer ohne Modulglobals in sechs Sprachen | OK | test/analysis-sources.test.js |
| H06 | Vollständige Regression: 1.199 Tests bestanden | OK | npm run check |
| H07 | Browserlayouts und Tastaturbedienung der neuen MITRE-Details | OK | 34 Smoke-Fälle; tools/browser-ui.dev.cjs |
| H08 | Webbuild, Quell-, Übersetzungs-, Lint- und Paketprüfungen | OK | npm run check:web; npm run check |
| H09 | Native Inline-Details mit Signatur, MITRE-Technik und gemeldeter Null | OK | --automatic-scan-check; Screenshot unten |
| H10 | Native Popup-Details und fortbestehender Linkschutz | OK | derselbe native Lauf; providerResults.hybridExpertDetails=true |

**Summe:** 10 OK / 0 FAIL / 0 N/A / 0 OFFEN

Getestetes lokales ZIP/XPI: Version 1.25.2, SHA-256 `140c287c3e64750ffbd4eb80c04b32d3ab0de81721a900793ed5e32f4c2902ae`. Paket-Fingerprint `63a07944dd6106a10ef315e525563f9ef6921e7b1f7015b9d3bb71a3879fb24c`. Die native Ausgabe bestätigt weiterhin den bösartigen Teilbefund, den unbekannten Abschluss ohne Verlust dieses Befunds, Aktualisierung ohne POST und konsistente Schutzentscheidungen.

[Native Inline-Ansicht mit synthetischen Berichtsdaten](screenshots/1.25.2/hybrid-expert-inline-synthetic.png).

Dieses Entwicklungsprotokoll allein erfüllt kein Release-Gate. Die CI-Nachweise müssen zum endgültigen Paket und Commit gehören. Eine aktuelle API-Unterversion oder echte Anbieterberechtigungen werden durch synthetische Antworten nicht bestätigt; siehe [Umfang und Quellen](HYBRID_FACHANSICHT.md). Keine Windows-/macOS- oder Screenreaderabnahme.
