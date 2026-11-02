# Veröffentlichungsabschluss 1.24.3

Auftrag: offene lokal ausführbare Punkte bearbeiten und die Version veröffentlichen. Ziel ist der **unsignierte GitHub-Release 1.24.3**. Tatsächliche Verfügbarkeit: [Release und XPI](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.3); Freigabeläufe: [GitHub Actions](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions). ATN-Signierung und automatische Updateverteilung gehören nicht zu dieser GitHub-Distribution.

## Neu abgeschlossen

- TAV-027: versionierte lokale Darstellungsprofile mit Datei-/JSONimport, Vorschau, eigener Bestätigung, Abbruch, Prüfung veralteter Ausgangswerte und Fehleranzeige. Übertragen werden ausschließlich Darstellung, Akzent und Dichte. [Vertrag](WEITERENTWICKLUNG_VERTRAEGE.md) und [Schema](schemas/local-settings-profile-v1.json).
- TAV-020: gespeicherte Warnbefunde bleiben auch bei PENDING ohne neuen Beobachtungszeitpunkt in den Auditdetails sichtbar. Historische Entscheidungen werden dadurch nicht ergänzt oder umgedeutet.
- Release-Workflow: der Veröffentlichungsjob installiert die Validierungsabhängigkeiten ohne Paketneubuild; der wiederverwendete CI-Workflow erhält die benötigte Leseberechtigung für PR-Metadaten. Der Veröffentlichungsjob besitzt gesondert Schreibrecht für Releaseassets. Veröffentlicht werden ausschließlich die im selben Workflow real geprüften Paketbytes; vorhandene andere Assets werden nicht überschrieben.
- Dokumentation und sechs öffentliche Sprachseiten führen Version 1.24.3 und trennen GitHub-Download, ATN, automatische Updates und produktive Unternehmenssysteme.

## Verbleibende Punkte mit konkreten Voraussetzungen

| Aufgabe | Aktuell geprüft / Einschränkung | Fehlende Voraussetzung |
| --- | --- | --- |
| TAV-005.03 | lokale Links/Jekyll-Quellen überprüfbar; erneuter direkter Pages-Abruf endet am Netzwerkproxy mit 403, kein Nachweis eines nicht existierenden öffentlichen Eintrags | zugelassene öffentliche Lesemöglichkeit für `vazules.github.io`; erfolgreicher Deploymentjob allein ist keine Browser-Inhaltsabnahme |
| TAV-006.03 | lokale Provider-/Fehlerverträge geprüft | reale Testkonten, freigegebene Testdaten und erlaubter Anbieterzugang |
| TAV-009.03 | echter Linux-Client-/OS-Pfad vorhanden | Windows/macOS mit ihren Standardbrowsern |
| TAV-010.03 | automatisierte Tastatur-/axe-Prüfungen vorhanden | NVDA und VoiceOver mit tatsächlicher Ansagen-/Bedienprüfung |
| TAV-012.03 | CSS-Zoom ergänzt Darstellungstests | native DPI-/High-Contrast-Zielsysteme |
| TAV-013.03 | manuelle Upgrades und sauberer Backuprestore geprüft | zugelassener automatischer Kanal mit zwei geeigneten kanalgebundenen Versionen |
| TAV-014.02/.03 | Einreichungspaket vorbereitet, keine Signingcredentials eingerichtet | ATN-Maintainerzugang, tatsächlicher Eintragsstatus, Signierung und Review |
| TAV-017.03 | lokale Entwürfe und Offlinewerkzeuge bleiben optional | Betreiberfreigabe, konkreter Testmandant/IdP/Storage/MDM und Retention-/Rollenentscheidung |
| TAV-018.03 | erneut 9 mittlere / 1 niedrige Werkzeugmeldung; keine hohe/kritische Meldung im Kandidatenbaum | unterstützte gepatchte Gesamtkette oder validierte Migration; aktuelles deepmerge 4.3.1 weiterhin betroffen |

Diese Punkte werden nicht als bestanden geschlossen. Der Nutzer hat keine zusätzlichen Ressourcen bereitgestellt. GitHub-Veröffentlichung, ATN, Produktivintegration und plattformübergreifende Abnahme bleiben getrennte Zustände.

## Paket und Abnahme

Der neue Veröffentlichungsumfang erhält eigene paketgebundene Browser-/Nativeberichte unter [candidate-1_24_3.json](audits/candidate-1_24_3.json). Die vorherige Weiterentwicklungsfassung ist im Git-Stand `809afa5` erhalten. Frühere Hashes/Tests werden nicht auf neue Paketbytes übertragen. Die native Profilprüfung verwendet bestätigte UI-Importe und echte Speicher-/Download-APIs; Neustarts prüfen die persistierten Werte und unveränderte andere Daten. Quotenfehler werden zusätzlich deterministisch simuliert; ein physischer Datenträgerfehler wird damit nicht nachgewiesen.

Die Tagveröffentlichung durchläuft erneut den vollständigen CI-/Kandidatengate. Das Release-XPI wird ohne Neubuild aus dem dort geprüften Archiv übernommen. Die tatsächliche Release-Seite und ihr Assetdigest sind für die veröffentlichten Bytes maßgeblich; lokale Kandidatenarchive können wegen ZIP-Metadaten einen anderen Archivhash bei gleichem Quellfingerprint besitzen.

## Lokale Freigabenachweise des finalen Quellumfangs

- Quellfingerprint: `be7358de5846985db3d7ff809295e9d98b9b456e62214f5ffd43c90e456ba209`. Lokales Testarchiv: SHA-256 `66c9246ebb7ae393bc9f21c7319fc288b54e060900f3b3b5be234d394dd2580f`. Der GitHub-Release verwendet sein eigenes im Tagworkflow geprüftes Archiv.
- Node 24: vollständiger Lauf mit 988 bestandenen Tests. Beim Node-22-Lauf erreichte ein 20-ms-Test unter Last das Zeitlimit vor Beginn seines angenommenen Readbacks. Der Test synchronisiert diesen Ablauf nun mit einem expliziten Startsignal und kontrollierter Uhr; die gesamte betroffene Suite besteht unter Node 22/24 mit je 27 Tests. Der vollständige Node-22-Lauf erfolgt zusätzlich in PR- und Tag-CI.
- 600 vollständige Browser-/axe-Fälle und 36 CSS-Zoomfälle, keine Fehler; Importdatei, Vorschau ohne Schreibzugriff, Fehler, Bestätigung, veraltete Vorschau und Tastaturfokus sind enthalten.
- Zwölf echte Upgrade-/Neustartberichte für EN/DE/FR/ES/IT/PL; EN-Upgrade unter 140 ESR, andere Sprachen und Neustarts unter 153 ESR. Profilimport-/export und unveränderte andere Daten sind nachgewiesen; je zwei SIGKILL-Wiederanläufe und ein zusätzlicher sauberer Backuprestore. Native Downloads werden anhand ihrer tatsächlichen neuen Downloadkennung und des fertigen Dateiinhalts geprüft, nicht anhand angenommener GTK-Dateiendungen.
- Source-/Paketprüfung ohne Fehler; gefiltertes Lint mit 0 Fehlern und 24 bekannten Thunderbird-Warnungen. Historische Berichte bleiben im Git-Verlauf erhalten.

[Native Profilansicht EN](screenshots/1.24.3/release/checked-upgrade-en-appearance-profile.png) · [DE](screenshots/1.24.3/release/upgrade-de-appearance-profile.png) · [Prüfumfang](screenshots/1.24.3/release/checked-upgrade-en-coverage-popup.png). API-Testdoubles, CSS-Zoom und kontrollierte Uhren sind entsprechend begrenzte Nachweise. Keiner dieser Prüffälle bestätigt NVDA/VoiceOver, Windows/macOS, ATN oder einen produktiven Integrationsdienst.
