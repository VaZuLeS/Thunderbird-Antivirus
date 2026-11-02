# Native Abnahme — Ausführung und offene Zielumgebungen

Dieses Protokoll trennt bereits ausgeführte Linuxfälle von noch auszuführenden nativen Prüfungen. Maßgebliche Paketidentität und Ergebnisse: [Aufgabenliste](AUSFUEHRUNG_AUFGABEN_2026-11-02.md) und `audits/candidate-1_24_3.json` nach Erzeugung der endgültigen Evidenz. Alle Nachrichten/URLs sind synthetisch; keine Nutzerprofile bearbeiten.

## Reproduzierbarer Linuxlauf

```sh
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin --xvfb /absolute/path/to/Xvfb \
  --xpi build/thundy_av_email_scanner_for_thunderbird-1.24.3.zip \
  --previous-xpi /absolute/path/to/verified-1.24.2.xpi \
  --restart-check --crash-check --restore-check \
  --locale de --langpack /absolute/path/to/matching-german-langpack.xpi \
  --out /absolute/path/to/new-result-directory
```

EN braucht kein Sprachpaket. Für ES heißt das passende Mozilla-Sprachpaket es-ES. Client und Sprachpaket müssen zueinander passen. Das Ergebnis nennt Clientversion, Add-onversion und XPI-Hash. Xvfb, Marionette und ein isolierter XDG-Desktopempfänger sind echte Linux-/Thunderbird-Integration, aber kein echter Standardbrowser. Aktionen/Schreibvorgänge werden nicht blind wiederholt; nur lesende Bereitschaftsproben dürfen einen Dokumentwechsel erneut prüfen.

## Zusätzlicher echter Linux-Browserpfad — ausgeführt

Der direkte Lauf mit `--real-browser /usr/bin/chromium` hat bestanden. Ein nur für dieses Profil registrierter XDG-Handler startete einen isolierten echten Chromium-Prozess, der eine kontrollierte lokale HTTPS-Testseite abrief. Die temporäre lokale Testzertifikatsausnahme betrifft ausschließlich localhost. Nachweis: [Browserbericht](audits/real-browser-1_24_3.json). API-Annahme, Browserstart und lokaler Abruf sind getrennte Felder; daraus wird kein Besuch einer externen Website und keine allgemeine OS-/Browsermatrix abgeleitet. Der erste Harnessausschnitt wurde an den abweichenden lokalen Linkscore und bereits beendete Browserprozesse angepasst; der vollständige Wiederholungslauf bestand.

Zusätzlich bestanden 12 Einstellungs- und 24 Auditfälle mit 200 % **CSS-Zoom** in Chromium über alle sechs Sprachen, Hell/Dunkel und Auditfüllstände. Das ist eine Layoutsimulation, kein nativer Thunderbird-DPI- oder Screenreadernachweis.

## Windows/macOS — noch nicht ausgeführt

Voraussetzungen: konkretes OS/Version/Architektur, installierter Thunderbird, eigener Testprofilpfad, Hash des Kandidaten und der Vorversion, mindestens ein tatsächlich installierter Standardbrowser. Keine passende Windows-/macOS-Runtime ist an diese Linuxumgebung angebunden.

| Fall | Handlung | Überprüfbare Erwartung / Nachweis |
| --- | --- | --- |
| Installation | XPI im frischen Testprofil installieren, Berechtigungsdialog bedienen | Add-on aktiv, kein stilles Opt-in, Wizard/Popup/Tastatur bedienbar |
| Nachrichtenkontext | Text-/HTML-Mail, zwei Nachrichten und getrennte Fenster/Tabs durchgehen | ein Dialog pro Klick; gewechselter Kontext kann keine alte Zieladresse autorisieren |
| Öffnen | kontrollierten Link bestätigen | API-Annahme, beobachteter Browserstart und kontrollierter Seitenabruf getrennt protokollieren; OPENED bleibt nur API-Annahme |
| Fehler | nicht vorhandenen/abweisenden Protokollhandler verwenden | reale Fehler nicht als bestätigten Webseitenbesuch darstellen; Retry ohne Duplikate |
| Audit | öffnen, abbrechen, Dialog offen lassen, Prozess kontrolliert beenden | URL/Score/Prüfstand/Snapshots vollständig; PENDING bleibt offen; kein automatisches Wiederöffnen |
| Upgrade/Restore | echte Vorversion, sauberes Backup, Update, Neustart, Rückweg | Historie/Keys/Zustimmung erhalten; Restore exakt zum Snapshot, neue Daten separat sichern |
| Darstellung | Hell/Dunkel, TB-Theme, kompakt/bequem, 200 % Zoom, mehrere DPI/High Contrast | Aktionen, Fokus und Warnungen bleiben erkennbar, keine abgeschnittenen Bedienelemente |

Jeder Ergebnisdatensatz braucht OS/TB/Browser/Extensionversion, Pakethash, Testfall, tatsächliches Ergebnis, Screenshot/Log und Prüfer. „Nicht ausgeführt“ darf nicht mit PASS befüllt werden.

## Reale Screenreader — noch nicht ausgeführt

NVDA auf Windows und VoiceOver auf macOS mit Thunderbird prüfen. JAWS nur zusätzlich, wenn als unterstützte Konfiguration zugesagt oder verfügbar. Browser-axe ist eine ergänzende Simulation, keine Screenreader-Abnahme oder WCAG-Zertifizierung.

1. Ohne Maus Wizard und Einstellungen erreichen, Gruppen/Labels und Fokusreihenfolge verstehen.
2. Einen Link abfangen: Dialogtitel, vollständige URL, Score, Anbieterstatus, unbekannte Werte und Öffnen/Abbrechen werden in sinnvoller Reihenfolge angesagt.
3. Fokus bleibt während der Interaktion im Dialog; Escape und Abbruch führen nachvollziehbar zurück. Späte Antworten dürfen keinen zweiten Dialog entsperren.
4. Speicher-/Öffnungsfehler und Retry per Sprache erkennen; keine ausschließlich farbliche Warnung.
5. Auditfilter, Details, Pagination und Export bedienen. OPENED als angenommene Anforderung verstehen; PENDING einschließlich fehlender Abschlussentscheidung wahrnehmen.
6. Helle/dunkle Darstellung und 200 % Zoom kombinieren; wichtigste Pfade in allen sechs Sprachen kontrollieren.

Pro Fall tatsächliche Ansage und Bedienfolge aufzeichnen. Ein Semantik- oder ARIA-Defekt wird erst nach beobachteter Fehlfunktion gezielt korrigiert; keine pauschale Zertifizierung aus Rollen/Labels.

## Automatische Distribution und echte Provider — getrennt offen

ATN-Maintainerzugang, ein zulässiger Kanal und mindestens zwei angebotene Versionen sind nötig, um die automatische Updateinstallation samt Neustart zu belegen. In dieser Umgebung sind keine solchen Secrets eingerichtet. Öffentlicher ATN-/Pages-Leseversuch war über das Webwerkzeug nicht zugänglich; das beweist weder Store-Abwesenheit noch Websiteausfall.

Echte Hybrid Analysis/VirusTotal/urlscan/URLhaus/AbuseIPDB-Prüfungen erfordern passende Testkonten, Dienstbedingungen, freigegebene Artefakte und Netzfreigaben. Die verwaltete Umgebung erlaubt Paketmanager/GitHub, aber keine eingerichteten Provideridentitäten. Testdoubles prüfen die Clientverträge; sie bestätigen keine aktuelle Dienstverfügbarkeit.
