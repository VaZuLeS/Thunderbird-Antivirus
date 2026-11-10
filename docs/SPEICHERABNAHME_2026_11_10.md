# Native Speicherabnahme vom 10. November 2026

AVN-009.d erhält einen abgegrenzten nativen Nachweis für den unveröffentlichten Kandidaten 1.25.4. [Maschinenlesbarer Bericht](audits/storage-lifecycle-2026-11-10.json) nennt Paket, Client, Prüfumfang und Grenzen. Die Produktdateien, Datenbankschemata und Aufbewahrungsregeln wurden dafür nicht verändert.

## Tatsächlich geprüft

- Echte Thunderbird-140.12.0-APIs, IndexedDB und browser.storage.local in einem isolierten Linux-Profil; synthetische Datensätze, keine Provideranfragen.
- Die bestehende offene Verbindung behält einen nachträglich gealterten Eintrag. Erst das kalte Datenbanköffnen nach echtem Neustart entfernt ihn; frische und zukünftige Einträge bleiben erhalten. Keine regelmäßige Hintergrundbereinigung wird behauptet.
- Kontrollierte Cleanup-Zeitpunkte vor und nach der 30-Tage-Grenze, 1.002 gültige Cacheeinträge und ein beschädigter Ressourcenbereich: Die ältesten gültigen Überhänge werden entfernt, der unlesbare Bereich bleibt erhalten.
- Der produktive DAO führt echte get/put-Operationen aus. Nach erfolgreichem put-Request injiziert der Prüfrunner einen tatsächlichen Transaktionsabbruch: Die Promise schlägt fehl und der ursprüngliche Befund bleibt unverändert. Es wird kein Datenträgerfehler simuliert.
- Die vorhandene 2-MiB-Berichtsarchivgrenze verweigert den Austausch; das vorherige aktuelle Protokoll und dessen Archiv bleiben unverändert.
- Audit-Zugriff begrenzt 2.004 Datensätze auf 2.000, erhält die ursprünglichen Entscheidungen und lässt die verbleibenden PENDING-Ereignisse unverändert offen. Autorisierte Cachelöschung verändert das Audit nicht.
- Drei saubere Neustarts einschließlich vollständigem Profilbackup und Restore: vorherige Analyse und Audit-Snapshots exakt wiederhergestellt. Nach dem Backup entstandenes PENDING separat gesichert; kein automatischer Merge. Ein später auf dem echten Loopback-Dovecot eingetroffenes Mailobjekt bleibt auf dem Server erhalten.

## Wiederholen und Grenzen

```sh
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin --xvfb /absolute/path/to/Xvfb \
  --xpi build/thundy_av_email_scanner_for_thunderbird-1.25.4.zip \
  --storage-lifecycle-check --out /absolute/path/to/new-results
```

Für die getrennte IMAP-Ergänzung zuerst `tools/imap-fixture.dev.py --out /absolute/path/to/new-server` starten und `--imap-fixture /absolute/path/to/new-server/server.json` ergänzen. Danach den eigenen Dienst mit `tools/imap-fixture.dev.py --out /absolute/path/to/new-server --stop` beenden. Der Dienst bindet ausschließlich Loopback und verwendet synthetische Zugangsdaten.

Die CI führt den Speicher-/Restoreteil ohne IMAP auf beiden Linux-Clientzielen aus und übernimmt nur freigegebene Metadaten in den bereinigten Nachweis. Lokales IMAP und CI bleiben getrennt. Mehrtägiger Dauerbetrieb, alle IMAP-Lifecycleoperationen, parallele Writer, Strom-/Plattenausfall, andere Betriebssysteme und automatische Updateverteilung sind hier nicht nachgewiesen. Die unsichere alte Nachrichtenslotbindung bleibt unverändert; diese Speicherabnahme gibt keine Identitätsmigration frei.
