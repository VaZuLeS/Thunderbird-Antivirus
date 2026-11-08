# Native Abnahme 1.25.1

Der bestehende Linux-Thunderbird-Lauf wird um `--automatic-scan-check` ergänzt. Er verwendet reale Anzeigeereignisse, Nachrichten- und Popupoberflächen, Runtime-Nachrichten und IndexedDB. Nur der Anbietertransport liefert synthetische Antworten; es werden keine Produktionsschlüssel und keine echten Nachrichten übertragen.

Geprüft werden automatische Hybrid- und urlscan-URL-Aufträge ohne Linkklick, unlisted-Einreichung, Ergebnispersistenz, gemeinsame Aktionsleisten, Wiederverwendung bei wiederholter Anzeige und Abschluss einer im Popup gestarteten Wiederholung nach dessen Schließen. Gesonderte Unit-/Vertragstests prüfen unabhängige Dienste und Startvoraussetzungen, Einwilligung, Rechte, Tier, manuelle Bedienung, Auftragskennung, Laufzeitgrenze, Konfigurationswiderruf und Fehlerisolation.

Die übrigen nativen Installations-, Neustart-, Crash-, Profil-, Audit-, Passwort- und Linkschutzprüfungen bleiben Teil des Gates. Maschinelle Berichte und Screenshots sind den GitHub-Actions-Artefakten des jeweiligen Commits zu entnehmen. Ein hinzugefügter Test gilt erst nach erfolgreichem Lauf als bestanden. Windows/macOS und Screenreader bleiben gesonderte Abnahmen.

| ID | Prüffall | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| T01 | Automatik nur Hybrid, nur urlscan und beide ohne Linkklick | OK | test/scan-jobs.test.js |
| T02 | Einwilligung, Rechte, Datenschutzstufen, manueller Modus und Absenderfreigaben | OK | test/scan-jobs.test.js |
| T03 | Annahme, Doppelstarts, 15-Minuten-Cache, Laufzeitgrenze und Abbruch | OK | test/scan-jobs.test.js |
| T04 | Ausstehende Kennungen, Fehlerisolation und Wiederaufnahme ohne erneutes POST | OK | test/scan-jobs.test.js |
| T05 | Aktionsleiste in beiden Ansichten und asynchrone Annahme | OK | test/analysis-sources.test.js |
| T06 | Profilmigration und geschützte Modusänderungen; neue Revision entwertet Freigaben | OK | test/follow-up.test.js, test/security.test.js |
| T07 | Vollständige Regression, Quellen, Übersetzungen, Lint und Paketprüfung | OK | npm run check; 1.176 Tests |
| T08 | Browserlayouts sowie französische Einstellungen bei 200 Prozent | OK | 34 Smoke-Fälle und zwei zusätzliche Zoom-Fälle |
| T09 | Reale automatische Anzeigeereignisse, beide Anbieter und unlisted | OK | --automatic-scan-check, Linux Thunderbird 153.5.1 ESR |
| T10 | Native Popup-Wiederholung läuft nach Schließen weiter; doppelte Anzeige ohne erneute Einreichung | OK | derselbe native Prüflauf |

Diese lokalen Entwicklungsprüfungen ersetzen nicht die Paketbindung des Release-Gates. Nach Integration der zwischenzeitlichen GitHub-Sanitizerkorrekturen wurden Webbuild und 139 betroffene Tests erneut bestanden. Das Gate prüft den endgültigen Commit einschließlich aller sechs Sprachen und der bisherigen nativen Abnahmen erneut.

**Summe:** 10 OK / 0 FAIL / 0 N/A / 0 OFFEN
