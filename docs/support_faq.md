# Support & FAQ — Thundy AV

**Version:** 1.23.0 · **Stand:** 2026-10-16 · **Sprachen:** EN/DE
**Store-Status:** Einreichung vorbereitet; Store-URL wird nach der Freigabe hier ergänzt
(A-05 in [AUFGABENPLAN_STORE_READINESS_1_23_0.md](AUFGABENPLAN_STORE_READINESS_1_23_0.md)).

## Support-Kanäle

| Kanal | Wofür | Link |
|---|---|---|
| GitHub Issues | Bugs, Fragen, Feature-Wünsche | https://github.com/VaZuLeS/Thunderbird-Antivirus/issues |
| ATN-Reviewsystem | Fragen zu einer Store-Version | Kommentar im Store-Eintrag (Store-URL: nach Freigabe) |
| E-Mail | Support-Anfragen | bludau.it.services@gmail.com |
| Sicherheitsmeldungen | **Nicht öffentlich** — verantwortungsvolle Offenlegung | [SECURITY.md](../SECURITY.md) |
| Quellcode & Releases | Nachvollziehbarkeit, Hashes | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases (XPI + `SHA256SUMS.txt`) |

## FAQ

**Scannt Thundy AV automatisch alle meine E-Mails?**
Nein. Lokale Prüfungen laufen nur für die Nachricht, die du gerade öffnest. Externe Analyse
(Anbieter wie Hybrid Analysis, VirusTotal, urlscan.io, URLhaus, AbuseIPDB) passiert **nur**, wenn du
1. global „Externe Analyse erlauben“ in den Einstellungen aktiviert hast **und**
2. den Absender per Banner freigegeben hast („Nur diese Nachricht scannen“ oder „Absender dauerhaft
   scannen“).

**Welche Daten werden gesendet?**
Abhängig von der Datenschutz-Stufe: SHA-256-Hashes von Anhängen (alle Stufen), vollständige
Anhänge unbekannter Dateien (ab *balanced*), URLs aus der Nachricht (ab *max*). Nachrichteninhalt,
Betreff, Absender-/Empfängeradressen und API-Schlüssel werden **nie** übertragen. Details:
[Datenschutzerklärung](privacy_policy.md).

**Ohne API-Schlüssel — funktioniert das Add-on trotzdem?**
Ja. Die lokalen Prüfungen (Absender-Domain, Erstkontakt, Dringlichkeits-/Zahlungswortwahl,
Anhangstypen, verdächtige Links) und die Banner laufen ohne Schlüssel; erst für die externen
Analysen braucht es eigene Schlüssel der Anbieter.

**Was bedeutet „Öffnung angefordert“ im Protokoll?**
Der Linkschutz hat die Öffnung eines Links angefordert — das ist keine Bestätigung, dass der Browser
die Seite geladen hat (Betriebssysteme können die Übergabe still blockieren). Das Add-on behauptet
also keinen Besuch; der Audit-Eintrag zeigt die Anforderung mit URL und lokalem Score.

**Wie leere ich die lokalen Analysedaten?**
Einstellungen → „Cache leeren“ löscht die lokale Analyse-Datenbank (IndexedDB). Freigaben
(Absender, Zustimmung) und Einstellungen bleiben erhalten.

**Update von einer älteren Version — geht etwas verloren?**
Nein. Persistierte Upgrades 1.22.0 → 1.23.0 wurden in einer realen Thunderbird-Abnahme geprüft:
Einrichtungsstand, Linkschutz, historische Auditdatensätze, Sprache und Darstellungseinstellungen
bleiben erhalten ([live_test_1_23_0.md](live_test_1_23_0.md)).

**Wie prüfe ich die Integrität des Pakets?**
Zu jedem GitHub-Release liegen `SHA256SUMS.txt` und das XPI bei: `sha256sum thundy-av-<version>.xpi`
mit der Summendatei vergleichen. Der Build ist nicht byte-reproduzierbar — der Hash gilt für das
veröffentlichte Artefakt. Das Store-Paket wird von ATN signiert; die Installationsprüfung erfolgt
über Thunderbird.

**Welche Thunderbird-Versionen werden unterstützt?**
Thunderbird 140 ESR und neuer (`strict_min_version: 140.0`, Manifest V3).

**Gibt es das Add-on für Firefox?**
Nein — Thundy AV nutzt Thunderbird-spezifische APIs (`messages.*`, `messageDisplay`, `menus`)
und läuft nur in Thunderbird.

## Grenzen (ehrlich)

- Reale Abnahmen existieren für Linux/X11 (Thunderbird 140.17.0 ESR); Windows/macOS,
  Screenreader/DPI und die Übergabe an echte Standardbrowser sind in Arbeit
  ([AUFGABENPLAN_STORE_READINESS_1_23_0.md](AUFGABENPLAN_STORE_READINESS_1_23_0.md) A-16 – A-19,
  [AUFGABENPLAN_ENTERPRISE_N06.md](AUFGABENPLAN_ENTERPRISE_N06.md)).
- Die Risiko-Bewertung ist lokal und heuristisch — ein Score 0 ist keine Sicherheitsgarantie und
  ein hoher Score kein Beweis für Malware. Externe Analysen liefern die belastbaren Befunde.