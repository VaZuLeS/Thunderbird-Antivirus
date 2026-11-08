# Native Abnahme 1.25.1

Der bestehende Linux-Thunderbird-Lauf wird um `--automatic-scan-check` ergänzt. Er verwendet reale Anzeigeereignisse, Nachrichten- und Popupoberflächen, Runtime-Nachrichten und IndexedDB. Nur der Anbietertransport liefert synthetische Antworten; es werden keine Produktionsschlüssel und keine echten Nachrichten übertragen.

Geprüft werden automatische Hybrid- und urlscan-URL-Aufträge ohne Linkklick, unlisted-Einreichung, Ergebnispersistenz, gemeinsame Aktionsleisten, Wiederverwendung bei wiederholter Anzeige und Abschluss einer im Popup gestarteten Wiederholung nach dessen Schließen. Gesonderte Unit-/Vertragstests prüfen unabhängige Dienste und Startvoraussetzungen, Einwilligung, Rechte, Tier, manuelle Bedienung, Auftragskennung, Laufzeitgrenze, Konfigurationswiderruf und Fehlerisolation.

Die übrigen nativen Installations-, Neustart-, Crash-, Profil-, Audit-, Passwort- und Linkschutzprüfungen bleiben Teil des Gates. Maschinelle Berichte und Screenshots sind den GitHub-Actions-Artefakten des jeweiligen Commits zu entnehmen. Ein hinzugefügter Test gilt erst nach erfolgreichem Lauf als bestanden. Windows/macOS und Screenreader bleiben gesonderte Abnahmen.
