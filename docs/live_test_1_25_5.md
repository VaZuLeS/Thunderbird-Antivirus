# Abnahmeprotokoll 1.25.5

Unveröffentlichter Kandidat. [Umfang und Grenzen](SCHUTZPROFILE_1_25_5.md). Lokale Teilnachweise ersetzen keinen vollständigen Remote-Lauf.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Gespeicherter v2-Export mit Positivliste | OK | test/follow-up.test.js; nativer Download |
| C02 | Schlüssel, Zustimmung und Historie ausgeschlossen | OK | Browser-Canary und nativer Speichervergleich |
| C03 | Effektive Legacy-Standardwerte | OK | test/follow-up.test.js |
| C04 | Expliziter Import mit Bestätigung | OK | native protectionProfile |
| C05 | Vorschau und Abbruch ohne Schreiben | OK | native protectionProfile |
| C06 | Veraltete URL-Wahl in beiden Richtungen erkannt | OK | simulierter Storagegegenfall und Regression |
| C07 | Fehlgeschlagenes Speichern erhält Bestand | OK | simulierter Browserfehler |
| C08 | v1/v2-Kompatibilität und tatsächliche Vorschau | OK | Node und native protectionProfile |
| C09 | Erscheinungsprofil bleibt kompatibel | OK | nativer followup/protectionProfile |
| C10 | Sechs vollständige Sprachkataloge | OK | 730 Schlüssel je Sprache |
| C11 | Gezielte EN/PL-Tastatur-/Zoomprüfung | OK | Chromium mit simulierten Erweiterungs-APIs |
| C12 | Echtes 1.25.4-Upgrade, Crash und Restore | OK | Linux-Thunderbird 140.12.0, isoliertes Profil |
| C13 | Vollständige Remote-Matrix beider Linuxlinien | OK | CI 42863563644: sechs Sprachen, beide Clientlinien, Schutzprofil/Upgrade/Crash/Restore und Kandidatengate |
| C14 | Öffentliche drei Releaseassets unabhängig prüfen | OFFEN | Erst nach Veröffentlichung möglich |

**Summe:** 13 OK / 0 FAIL / 0 N/A / 1 OFFEN
