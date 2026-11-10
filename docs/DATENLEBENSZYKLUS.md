# Datenlebenszyklus, Migration und Wiederherstellung

Stand: Kandidat 1.24.3, 2. November 2026. Keine automatische Enterpriseübertragung. Technischer Befund, keine Zusage einer unveränderlichen Archivierung.

| Daten | Speicher / Grenze | Bereinigung / Erhalt |
| --- | --- | --- |
| Einstellungen, Einwilligung, Absender-/Authserverlisten, Darstellung | browser.storage.local | explizite Änderungen; Upgrade/Neustart erteilen keine Einwilligung |
| Providerkeys | browser.storage.local, nicht zusätzlich verschlüsselt | bei Nutzeränderung; Betriebssystem-/Profilzugriff schützen |
| Nachrichten-/Analyseergebnisse und gespeicherte fertige Berichte | IndexedDB `thunderbird_av`, Version 3, Store hybridanalysis | beim Datenbanköffnen: 30 Tage, max. 1.000 Nachrichten; neue Berichte nur für passende Hash-/Submissionidentität |
| Linkentscheidungen und Entscheidungssnapshots | browser.storage.local `linkAuditLog`, separate Profilkennung | Audit-Lese-/Schreibzugriff: 30 Tage, 2.000 Datensätze, 2 MiB; explizite bestätigte Löschung separat vom Cache |
| Reputationscaches und Interaktionssessions | Arbeitsspeicher, ExpiringMap | TTL/Größenlimits; Prozessende löscht nur Memoryzustand, nicht die gespeicherte offene Entscheidung |
| JSON/CSV-Export | vom Nutzer gewählte Downloadablage | keine automatische Extensionlöschung; SHA-256 ist Prüfsumme, keine Signatur |
| Profilbackup | explizite Sicherungsablage | enthält ggf. Keys/Nachrichten; geschützt aufbewahren und nach eigener Frist löschen |
| React-Webdemo | eigener Browser-localStorage | nur Simulation; historische Demodaten werden nicht als echte Thunderbirdentscheidungen übernommen |
| Node-Enterprise-Journale/Reviews | explizites lokales Datenverzeichnis, eigener Lebenszyklus | unverändert separate Node-Werkzeuge; STAGED ist keine SEALED-/Löschfreigabe |

## Migration und Grenzen

Die Wiederaufnahme der fertigen Berichte ändert das bestehende IndexedDB-Schema nicht. Zusätzliche Reportfelder sind optional. Bestehende Audit-IDs, Versionen, URLs und scoreAtDecision/verdictAtDecision/providerAtDecision bleiben erhalten. Anzeigen übersetzen Statuscodes, die Exportwerte bleiben maschinenlesbar und unverändert. Nachträgliche Bewertungen dürfen nicht als damalige Entscheidungsgrundlage erscheinen.

Ein vor einem Prozessverlust gespeichertes PENDING bleibt offen. Ein Crash zwischen nativer Öffnungsannahme und erfolgreicher Auditbestätigung lässt sich nicht sicher rückwirkend auflösen. Der Code wiederholt keine Öffnung, nur weil ein Abschluss fehlt. Ein Quoten-/Commitfehler bleibt sichtbar. Bereits bestätigte Daten sind in den realen Linux-Profiltests erhalten geblieben; daraus folgt keine Garantie bei Strom-/Datenträgerausfall.

Zeitgrenzen werden beim jeweiligen Zugriff angewandt. Bei zurückgestellter Systemzeit kann ein in der Zukunft liegender Datensatz länger innerhalb der Altersgrenze erscheinen. Es gibt keine neue automatische Uhrkorrektur oder verschärfte Löschung. Eine regelmäßige Bereinigung wäre eine bewusste Produktentscheidung mit eigener Lösch-/Concurrencyabnahme; sie wird nicht als unbemerkte Migration eingeführt.

## Unterstützter geprüfter Rückweg

Vor einem Paketupgrade Thunderbird sauber beenden und das vollständige eigene Profil in eine geschützte Ablage sichern. Den Pfad über Thunderbirds Profilinformationen bestimmen; keine pauschalen Benutzerpfade voraussetzen. Kein konsistentes Backup aus einem schreibenden Profil versprechen.

Der isolierte Prüflauf installiert 1.24.2 dauerhaft, erzeugt echte Entscheidungen, beendet Thunderbird sauber, sichert sein eigenes Testprofil und aktualisiert auf 1.24.3. Nach Neustart-/Crashprüfungen wird der Testprozess erneut sauber beendet und **nur dieses Testprofil** durch die Sicherung ersetzt. 1.24.2 und die ursprünglichen Storagewerte/Datensätze werden überprüft.

Das ist ein Backup-Restore, kein allgemein unterstützter In-place-Downgrade und kein Merge neuerer Daten. **Nach der Sicherung entstandene Ereignisse sind außerhalb dieses Snapshots.** Diese bei Bedarf vor dem Rückweg separat exportieren; kein verlustfreies automatisches Zusammenführen behaupten. Normale Anwenderprofile werden vom Runner nicht berührt.

```sh
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin --xvfb /absolute/path/to/Xvfb \
  --xpi build/thundy_av_email_scanner_for_thunderbird-1.24.3.zip \
  --previous-xpi /absolute/path/to/verified-1.24.2.xpi \
  --restart-check --crash-check --restore-check \
  --out /absolute/path/to/new-empty-result-directory
```

Automatische Updateverteilung benötigt zusätzlich einen echten Distributionskanal, dessen angebotene Version und tatsächlich installierte Aktualisierung nachgewiesen werden. Diese Teilprüfung wird nicht aus dem manuellen Paketupgrade abgeleitet.

## Ergänzende Untersuchung für die unveröffentlichte 1.24.4

Der [Identitätsvertrag und native Nachweis](IDENTITAET_ANALYSEBEFUNDE.md) vom 3. November 2026 unterscheiden Laufzeit-Locator, Inhalt, Vorkommen, Befund und Entscheidung. Numerische Nachrichten-IDs sind nicht dauerhaft; ein ungefilterter Rohdaten-Hash ändert sich bereits durch lokale Statusheader. Der experimentelle Vergleich des Prüfrunners ist keine produktive Migration. Bestehende Lebenszyklusregeln werden dadurch nicht verändert, Altbestände nicht neu zugeordnet oder zusätzlich gelöscht.

Der anschließende [Quellenhistorien-Schritt](QUELLENHISTORIE_ZUORDNUNG.md) ergänzt `analysisSourceSnapshots` mit höchstens 64 UUID-Kontextständen und 1 MiB Snapshotdaten je Headercacheeintrag. Alte Quellenfelder bleiben unverändert. Bei Kapazitäts-/Commitfehler wird eine neue Speicherung sichtbar abgewiesen; ältere Stände werden dafür nicht automatisch gelöscht. Der gesamte Headercache unterliegt weiterhin der vorhandenen 30-Tage-/1.000-Einträge-Bereinigung und expliziten Cachelöschung.

Die folgende [Protokollhistorie](PROTOKOLLHISTORIE.md) ergänzt `analysisReportArchive` mit höchstens 128 Ressourcenrevisionen und 2 MiB Archivdaten im selben Headercacheeintrag. Die fünf ersetzenden Produktwriter archivieren vorhandene Protokolle und Submissionmetadaten atomar vor dem Austausch; bei Überschreitung oder Commitfehler bleibt der frühere Stand erhalten. Sie erfassen höchstens 4 MiB aufgezeichnete aktuelle Ressourcen je geschütztem Zugriff. Diese Bereiche können ebenfalls URLs, Hashes und Providerdetails enthalten und bleiben ausdrücklich Teil der bestehenden Cachebereinigung/-löschung und eines vollständigen Profilbackups. Das ist kein unabhängiges unveränderliches Archiv; dauerhafte Vorkommensbindung, allgemeine Retention und Migration bleiben offen.

Der [lokale Quellenbericht AVN-011](QUELLENEXPORT.md) erstellt nur auf ausdrücklichen Wunsch eine minimierte JSON-Datei aus aufgezeichneten Metadaten. Eine Vorschau lebt ausschließlich in der geöffneten Seite und wird bei relevanten Änderungen, Cachelöschung oder Seitenende verworfen. Der Dateidownload wird vor seiner Anforderung erneut abgeglichen. Eine bereits angenommene Downloadanforderung oder gespeicherte Datei wird durch spätere Cachelöschung nicht entfernt. Der Bericht enthält genaue Zeitpunkte und Bewertungen, jedoch keine Ressourceninhalte, Rohprotokolle oder internen Kennungen; separat schützen und löschen.

## Ergänzende native Abnahme am 10. November 2026

Die [Speicherabnahme für Kandidat 1.25.4](SPEICHERABNAHME_2026_11_10.md) ergänzt echte Alters-/Kapazitätsgrenzen, einen nach erfolgreichem Schreibrequest abgebrochenen Commit, Audit-/Cachetrennung und Profilrestore mit separater Sicherung neuerer Ereignisse. Der lokale IMAP-Server bleibt außerhalb des Profilrestores. Keine zusätzliche Löschpolitik und keine allgemeine Identitäts- oder Datenträgergarantie.

Die [Fortführung zum Speicherwiederanlauf](SPEICHERWIEDERANLAUF_2026_11_10.md) ergänzt einen belegten Verbindungsfehlerpfad und native Parallelitätsprüfungen, ohne die Aufbewahrungsregeln zu verändern.
