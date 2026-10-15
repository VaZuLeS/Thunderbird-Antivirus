# Dauerhafte Alarmkandidaten mit bestätigtem Abholen

Stand: 15. Oktober 2026. N10 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) schließt die bisherige Verlustlücke im [lokalen Betriebsmonitor](ENTERPRISE_BETRIEBSBERICHTE.md): Neue Alarmkandidaten werden zusammen mit ihrer Beobachtung im signierten Journal gespeichert. Eine verlorene Rückgabe von `observe` entfernt sie nicht. Sie bleiben nach geprüftem Neustart abrufbar, bis ein lokaler Verbraucher ausdrücklich bestätigt.

## Zustände und Bedeutung

- `PENDING`: dauerhaft aufgenommener Kandidat, noch nicht bestätigt.
- `ACKNOWLEDGED`: ein lokaler Verbraucher hat die Übernahme bestätigt. Dies ist **keine Bestätigung einer externen Zustellung**.

Die stabile `notificationId` bindet lokale Quelle, Journalindex der Beobachtung, Snapshothash und Befundcode. Inhalt: bekannter Befundcode, Priorität, Anzahl, Erfassungs-/Erzeugungszeit und Anzahl gedämpfter Beobachtungen. Link-URLs, Geräte-/Event-/Storagejobkennungen, Rohfehler und Credentials werden nicht in die Kandidaten übernommen. Die konfigurierte Quellenkennung und Verbraucherkennung sind lokale Betreiberangaben, keine gemessenen Geräteidentitäten oder bestätigten SSO-Konten.

Die Warteschlange gilt für **einen logischen lokalen Verbraucher**. Mehrere Prozesse können denselben Kandidaten abrufen; sie müssen vor Verarbeitung anhand der ID deduplizieren. Eine Bestätigung beendet die gemeinsame Auslieferung. Unabhängige Empfänger oder Kanäle benötigen eine spätere Fan-out-/Zustellimplementierung.

## API: erst übernehmen, dann bestätigen

```js
const candidates = monitor.pending({ limit: 100 });
for (const candidate of candidates) {
  // Der Verbraucher muss die ID und seine lokale Übernahme selbst dauerhaft speichern.
  await localConsumer.persistOnce(candidate.notificationId, candidate);
  monitor.acknowledge(candidate.notificationId, { consumerId: 'local-collector' });
}
```

`localConsumer.persistOnce` ist ein Beispiel für den bereitzustellenden idempotenten Verbraucherspeicher, kein mitgelieferter Netzwerkclient. Der Betriebsmonitor sendet keine E-Mails, Tickets oder SIEM-Aufrufe. Die vorhandene SIEM-Queue verarbeitet Incidentexports; diese Alarmkandidaten werden ihr nicht automatisch übergeben.

`pending({limit})` liest ohne Journalaktion und ohne Entfernen, Standard 100, erlaubter Bereich 1–1.000. Wiederholte Aufrufe liefern dieselben offenen IDs, bis sie bestätigt werden. Einträge werden in Erzeugungsreihenfolge geliefert. Nach Bestätigung der ersten Einträge werden weitere offene Kandidaten sichtbar.

`acknowledge(id, {consumerId})` synchronisiert eine signierte Journalaktion vor Bestätigung. Dieselbe ID und derselbe Verbraucher sind bei Wiederholung idempotent, auch nach Neustart. Eine andere Verbraucherkennung auf einer bereits bestätigten ID, unbekannte IDs oder ungültige Kennungen werden abgewiesen. Es werden keine öffentlichen HTTP-/Browseraktionen angeboten; der lokale Operator mit Writer-Schlüssel bleibt Vertrauensvoraussetzung.

`notificationStatus()` nennt offene/bestätigte Anzahl, Kapazität, Anzahl alter Beobachtungen ohne Queue, Journalhash und ausdrücklich `externalDeliveryVerified: false` / `sealed: false`. Bestätigte Metadaten bleiben für Recovery und Idempotenz erhalten; kein stilles Löschen oder Kompaktieren.

## CLI

```sh
npm run enterprise:health -- observe \
  --input /srv/local/queue-snapshot.json \
  --directory /srv/local/health-state \
  --key-id health-writer --private-key /srv/keys/health-private.pem \
  --out /srv/review/observation.json

npm run enterprise:health -- pending \
  --directory /srv/local/health-state --source-id local-service \
  --key-id health-writer --private-key /srv/keys/health-private.pem \
  --limit 100 --out /srv/review/pending.json

npm run enterprise:health -- ack \
  --directory /srv/local/health-state --source-id local-service \
  --key-id health-writer --private-key /srv/keys/health-private.pem \
  --notification-id KANDIDAT_SHA256 --consumer-id local-collector
```

`source-id` muss zur ursprünglichen Aufnahmequelle passen. CLI-Befehle verwenden die bisherigen Monitor-Standardwerte: 15 Minuten Dämpfung, 5 Minuten bis Veraltung und 24 Stunden Fristwarnung. Für Journale mit eigenen API-Zeitgrenzen die API mit denselben Werten verwenden. Private Ed25519-Schlüsseldateien müssen betreibereigen und mit Modus 0600 geschützt sein. `pending` verwendet ebenfalls den exklusiven lokalen Writer und synchronisiert bei Recovery; dies ist kein unabhängiger Public-Key-Lesepfad.

`observe`, `pending` und `ack` akzeptieren optional `--expected-head SHA256` für den aktuellen unabhängig bekannten **Monitorjournalstand**. Eine Bestätigung verändert den Stand; einen alten Kopf-Pin nicht unverändert für mehrere folgende Schreiboperationen verwenden. Die Prüfung eines selbst gelesenen aktuellen Hashes ersetzt keine unabhängige Verankerung.

`pending` schreibt Status und höchstens `limit` Kandidaten in eine neue private JSON-Datei; bestehende Dateien werden nicht überschrieben. Das bloße Erzeugen oder Herunterladen einer Datei bestätigt nichts. `ack` gibt ID, Duplikatkennzeichen und Journalhash als JSON aus. Der Verbraucher bestätigt erst nach eigener dauerhafter Übernahme. `report` bleibt ohne Schlüssel verwendbar; die vorhandene sechssprachige HTML-Betriebsansicht bleibt unverändert.

## Dämpfung, Kapazität und Wiederaufnahme

`observe().notifications` enthält weiterhin ausschließlich die bei dieser Beobachtung neu erzeugten Kandidaten, jetzt mit stabiler ID und Zustandsmetadaten. Ein identischer wiederholter Snapshot liefert dort eine leere Liste; vorhandene Kandidaten über `pending` abholen. Fehlerbehebung, spätere gesunde Snapshots oder erneute Dämpfungsintervalle bestätigen alte Kandidaten nicht automatisch.

Die Beobachtung und alle daraus entstehenden Kandidaten sind **eine gemeinsame Journalaktion**. Bei Kapazitätsüberschreitung wird die gesamte neue Beobachtung abgewiesen; vorherige Kandidaten und Dämpfungsstände bleiben erhalten. Standard maximal 1.000 gleichzeitig offene Kandidaten. Die API erlaubt `maxPending` von 1 bis 10.000; der Wert wird bei der ersten neuen Queue-Beobachtung gebunden. Änderung erfordert eine kontrollierte Migration, nicht bloß einen anderen Konstruktorwert. Bestätigte Einträge belegen keine offene Kapazität, zählen aber weiterhin zum begrenzten Journalverlauf.

Die bisherigen Grenzen bleiben 32 MiB / 10.000 Aktionen. Eine volle Queue oder ein volles Journal wird nicht still verdrängt. Offene Kandidaten abholen und bestätigen, Speicherzustand überwachen und vor Erreichen der Journalgrenze eine freigegebene Archivierungs-/Migrationslösung vorsehen. Retention und Rotation sind noch nicht produktiv implementiert.

Bei einem Schreib-/Syncfehler bestätigt der Monitor keine Beobachtung oder Übernahme; weitere Status-/Schreibaufrufe des betroffenen Writers werden bis zur geprüften Wiederaufnahme gesperrt. Ein vollständig geschriebenes, aber nicht bestätigtes ACK kann nach Neustart bereits vorliegen. Deshalb dieselbe ID mit derselben Verbraucherkennung erneut prüfen/bestätigen. Ein Verbraucherabbruch zwischen eigener Speicherung und ACK führt zur erneuten Ausgabe derselben ID; dies ist beabsichtigte mindestens einmalige lokale Auslieferung, keine Exactly-once-Garantie.

Teilzeilen werden nicht automatisch repariert. Verwaiste Locks ausschließlich nach bestätigtem Ende des Writers entfernen. Signaturen, Kette, Konfigurationsbindung und Übergänge werden beim Neustart geprüft und vor Benutzung synchronisiert. Ohne unabhängig bekannten Kopf-Pin ist gültiges Abschneiden weiterhin nicht nachweisbar. Der Schutz gegen den Besitzer des Writer-Schlüssels bleibt begrenzt.

## Kompatibilität alter Monitorjournale

Alte `OBSERVED`-Aktionen bleiben lesbar und stellen ihre bisherigen Dämpfungsstände wieder her. Sie werden als `legacyObservations` gezählt. **Daraus werden keine alten Kandidaten oder erfundenen Bestätigungen erzeugt:** Ob ein früherer Rückgabewert tatsächlich verarbeitet wurde, ist nicht protokolliert.

Neue Beobachtungen verwenden `OBSERVED_QUEUED`. Nach der ersten solchen Aktion werden ältere Beobachtungsaktionen im weiteren Verlauf abgewiesen. Alte Software versteht das neue Format nicht und darf einen erweiterten Verlauf nicht weiterführen; ein Downgrade ist keine automatische Rückmigration. Die neue Wiederaufnahmegarantie gilt ausschließlich für die neuen Queue-Beobachtungen.

Offen bleiben externe Zustellung/Antwortprüfung, Rollen, geschützter Schlüsselspeicher, echte Flottenidentitäten, Retention/Archivierung und produktive Abnahme. I04/H02 bleiben insgesamt Vorarbeit; SEALED und Extension-Release 1.22.0 werden nicht verändert.
