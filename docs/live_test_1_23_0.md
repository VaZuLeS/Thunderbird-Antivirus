# Live-Abnahme 1.23.0 — reale Thunderbird-GUI (Linux-Teilabnahme)

**Kandidat:** Thundy AV 1.23.0 (unsigniertes XPI, temporär im frischen Testprofil installiert)
**Client:** Thunderbird 140.17.0 ESR (Build `20260929234105`), Linux x86_64, echte X11-GUI unter Xvfb (1280 × 1000), offline
**Datum der Läufe:** 15. Oktober 2026 (16:17–16:17 UTC Erstlauf; 16:32–16:33 UTC Fortsetzung; Upgrade- und Wiederherstellungsläufe im selben Arbeitsgang)
**Rohbelege:** [THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md) ·
[audits/thunderbird-linux-140.json](audits/thunderbird-linux-140.json) ·
[audits/thunderbird-six-languages.json](audits/thunderbird-six-languages.json) ·
[audits/thunderbird-crash-recovery.json](audits/thunderbird-crash-recovery.json)
**Zweck:** Versionsspezifisches C6-Artefakt des Submission-Gates (Entscheidung D13,
[AUFGABENPLAN_STORE_READINESS_1_23_0.md](AUFGABENPLAN_STORE_READINESS_1_23_0.md)). Diese Datei
fasst die in den Rohbelegen dokumentierten Prüfpunkte in Gate-Zählform zusammen; sie erfindet keine
neuen Ergebnisse.

## Geprüfte Punkte

| Nr. | Prüfung | Quelle (Abschnitt in THUNDERBIRD_LINUX_ABNAHME.md) | Status |
|---|---|---|---|
| 1 | Erstinstallation öffnet den Einrichtungsassistenten | „Erfolgreich geprüft“ | OK |
| 2 | Sechs Wizardsprachen (EN/DE/FR/ES/IT/PL) gegen den XPI-Sprachkatalog | „Erfolgreich geprüft“ | OK |
| 3 | Wizardnavigation, Fokus, Abschlussmarker, Linkschutz gespeichert, keine externe Einwilligung | „Erfolgreich geprüft“ | OK |
| 4 | Echte lokale Nachricht angezeigt; Add-on-Banner und Linkschutz injiziert | „Erfolgreich geprüft“ | OK |
| 5 | Linkdialog: gebrandeter Dialog mit vollständiger URL und lokalem Score (520 px Karte) | „Erfolgreich geprüft“ | OK |
| 6 | Abbrechen schließt den Dialog, Fokus zurück zum Link, kein Öffnungsversuch | „Erfolgreich geprüft“ | OK |
| 7 | Protokoll: genau ein Eintrag `ABORTED` (gleiche URL, Score 0, `UNKNOWN`, 0 Öffnungsversuche) | „Erfolgreich geprüft“ | OK |
| 8 | Natives Nachrichten-Popup per X11-Klick (600 px Inhalt, nativer Rahmen 602 px) | „Erfolgreich geprüft“ | OK |
| 9 | Darstellung (dunkel/violett/kompakt) speichern und nach Neuladen wiederherstellen | „Erfolgreich geprüft“ | OK |
| 10 | Add-on folgt echten integrierten hellen/dunklen Thunderbird-Themes | „Erfolgreich geprüft“ | OK |
| 11 | Echte UI-Sprache EN im Profilprüfungslauf | „Fortsetzung: Sprachen, Upgrade und OS-Übergabe“ | OK |
| 12 | Echte UI-Sprache DE im Profilprüfungslauf | „Fortsetzung: Sprachen, Upgrade und OS-Übergabe“ | OK |
| 13 | Echte UI-Sprache FR im Profilprüfungslauf | „Fortsetzung: Sprachen, Upgrade und OS-Übergabe“ | OK |
| 14 | Echte UI-Sprache ES im Profilprüfungslauf | „Fortsetzung: Sprachen, Upgrade und OS-Übergabe“ | OK |
| 15 | Echte UI-Sprache IT im Profilprüfungslauf | „Fortsetzung: Sprachen, Upgrade und OS-Übergabe“ | OK |
| 16 | Echte UI-Sprache PL im Profilprüfungslauf | „Fortsetzung: Sprachen, Upgrade und OS-Übergabe“ | OK |
| 17 | Dauerhafte Installation von 1.22.0 → 1.23.0 im Profil (Beispielfall DE) | „Dauerhafte Installation und saubere Neustarts“ | OK |
| 18 | Storage-Zustand (Einrichtung, Linkschutz, Auditdatensätze, Darstellung) nach erstem sauberen Neustart unverändert | „Dauerhafte Installation und saubere Neustarts“ | OK |
| 19 | Storage-Zustand nach zweitem sauberen Neustart unverändert; neue Auditdatensätze tragen Version 1.23.0 | „Dauerhafte Installation und saubere Neustarts“ | OK |
| 20 | Erneut benutzen: Linkschutz injiziert sich, erzeugt neuen Datensatz, historische Datensätze bleiben unverändert | „Dauerhafte Installation und saubere Neustarts“ | OK |
| 21 | Wiederherstellung nach `SIGKILL`: bestätigte Audit- und Storage-Daten bleiben erhalten | „Wiederherstellung nach erzwungenem Prozessabbruch“ | OK |
| 22 | Offener Dialog bleibt nach Abbruch/Neustart `PENDING` mit unveränderter URL und Bewertung | „Wiederherstellung nach erzwungenem Prozessabbruch“ | OK |
| 23 | Keine erfundene Entscheidung für den offenen Vorgang | „Wiederherstellung nach erzwungenem Prozessabbruch“ | OK |
| 24 | Keine erneute OS-Zustellung beim Wiederanlauf; vorhandene Quittung unverändert | „Wiederherstellung nach erzwungenem Prozessabbruch“ | OK |
| 25 | Weiterarbeiten: Sprache und Darstellung erhalten; neuer Vorgang nach dem Wiederanlauf funktioniert | „Wiederherstellung nach erzwungenem Prozessabbruch“ | OK |

Die CI führt dieselben Prüfungen regelmäßig aus (13 Profilberichte, zwölf saubere Neustarts, zwölf
Wiederanläufe nach `SIGKILL`); die Tabellenzeilen 17–25 fassen die dokumentierten Einzelfälle zusammen.

## Wiederholungslauf in einer zweiten Umgebung (16. Oktober 2026)

Unabhängig von der CI wurde dieselbe Prüfung in einer weiteren Umgebung wiederholt: Debian 12
(bookworm) statt Trixie, Mozilla-Thunderbird-Binary **140.17.0esr** (`Build 20260929234105` —
identische Build-ID zum Erstlauf), Mozilla-Tarball statt Debian-Paket, Xvfb 1280 × 1000.
Ergebnis: **`passed: true`** — Wizard in sechs Sprachen gegen die XPI-Kataloge, Wizard gespeichert
(`timeOfClickProtection: true`), Linkdialog (vollständiger Text, URL, lokaler Score 0/100, 520 px),
natives Popup (602 px Inhalt), OS-Übergabe mit Beleg. Zusätzlich wurde erstmals der
**Opt-in-Banner programmatisch verifiziert und als X11-Aufnahme gefangen** (`optin-banner.png`,
1280 × 1000; Text „Thundy AV: real-time scanning is not enabled for this message" mit den zwei
Scan-Buttons und „Open options"). Bericht:
[audits/thunderbird-140-repeat.json](audits/thunderbird-140-repeat.json); XPI-SHA-256
`0922e08947d4ef1d1a8f54f6f0dd91ffafb0d57531c14100dd3b20ad6bb897b1` (frischer Build des
Quellstands, nicht das Release-Artefakt). Der Runner wurde dafür um das optionale Flag
`--banner-root-shot` erweitert (Standard: aus; CI-Verhalten unverändert), siehe
[THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md).

## Offene Punkte (bewusst nicht geprüft)

- Windows und macOS, unterschiedliche DPI/Zoomwerte, Betriebssystem-Barrierefreiheit und echte Screenreader.
- Übrige Oberflächen in allen sechs Thunderbird-Sprachen (der Sprachwechsel des Laufs betrifft den Wizard; Popup-/Dialogsprache je Profil ist geprüft).
- Reale externe Browserübergabe einschließlich Fehler/Retry und `OPENED`, automatische Updateverteilung, produktive Nachrichtenkonten.
- Verschlüsselte/signierte Nachrichten und GPU-Pfade (Laufzeit ohne RNP/OpenPGP und `libpci`).
- Produktive SSO-/RBAC-, Cloud-/SEALED-, MDM- und unabhängige Prüfernachweise nach [N06](ENTERPRISE_N06_ABNAHME.md).

## Grenzen

Dies ist eine Linux-Teilabnahme mit echten Thunderbird-Schnittstellen, keine vollständige
Betriebsabnahme und keine Signatur-/Store-Freigabe. Alle Aufnahmen stammen unverändert aus dem
realen Testlauf ([screenshots/thunderbird-linux/](screenshots/thunderbird-linux/)).

**Summe:** 25 OK / 0 FAIL / 0 N/A / 5 OFFEN
