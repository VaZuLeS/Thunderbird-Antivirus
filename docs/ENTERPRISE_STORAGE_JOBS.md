# Dauerhafte Storage-Aufträge: Simulation und optionale Cloudadapter

Stand: 14. Oktober 2026. Ausführbare lokale Ergänzung zu [Storage-Adaptern](ENTERPRISE_STORAGE_ADAPTER.md) und [Evidenz/Witness](ENTERPRISE_EVIDENZPRUEFUNG.md). Node ≥ 20, Linux/POSIX, keine zusätzlichen Abhängigkeiten.

**Der lokale CLI-Worker verarbeitet `local-simulation`; die Bibliotheks-API verarbeitet optional S3/Azure/GCP mit explizit übergebenen SDK-Clients.** Cloudjobs und Beobachtungen sind jetzt dauerhaft angebunden, aber es wurde kein Cloudzugang verwendet oder produktiver Worker installiert. Es gibt weiterhin keinen SEALED-Commit, keine Quittung an den Endpoint-Broker und keine Integration in Thunderbird. Ein vollständig verarbeiteter Simulationsauftrag meldet `SIMULATION_COMPLETE`, `simulated: true`, `sealed: false`. Originale in Broker und Service bleiben erhalten.

## Gespeicherter Ablauf

| Zustand | Bedeutung / nächste Aktion |
|---|---|
| `QUEUED` | Vollständiger, geräteverifizierter und bezeugter Export samt Ziel und Witness-Pin dauerhaft gespeichert |
| `WRITING` | Versuch vor dem Objektzugriff signiert und synchronisiert; ein abgebrochener Versuch wird beim nächsten Lauf erneut bearbeitet |
| `RETRY` | Fehlercode und frühester neuer Versuch dauerhaft gespeichert |
| `CLOUD_OBSERVED` | Adapter hat Anbieter-Metadaten, Version und tatsächlichen Readback geprüft; diese Beobachtung ist dauerhaft gespeichert, ohne authentifizierten Live-Nachweis oder SEALED |
| `SIMULATION_COMPLETE` | Simulator hat dieselben Bytes zurückgelesen; Abschluss danach im Jobjournal synchronisiert |
| `DEAD_LETTER` | Versuchslimit erreicht; Inhalt bleibt erhalten, Betreiberprüfung erforderlich |

`enterprise/storage_jobs.cjs` hält ein Ed25519-signiertes, hashverkettetes Journal. Die Job-ID bindet SHA-256 des kanonischen Evidenzobjekts und das Ziel: absoluter Simulationspfad oder Anbieter plus vollständige Cloudsettings einschließlich Besitzer/Projekt, Region, Verschlüsselung und konkreter Retentionzeit. Derselbe Auftrag ist auch nach Neustart idempotent. Ein anderes Ziel erzeugt eine andere Job-ID. Export und Vertrauenskontext werden vor Annahme kopiert; Änderungen durch den Aufrufer ändern den gespeicherten Auftrag nicht.

Server-Key/-ID, Witness-Public-Key und Geräte-Registry kommen ausdrücklich aus der Betreiberkonfiguration. Deren Fingerprint ist in jeder Journalaktion gebunden. Der erwartete Witness-Hash kommt bei Annahme aus dem separat bekannten Betreiberstand und wird mit dem Auftrag signiert gespeichert. Bei Recovery wird jeder Evidenzsnapshot erneut mit diesen Roots geprüft. Historische Aufträge behalten ihren damaligen, vollständig bezeugten Snapshot; sie behaupten nicht den neuesten globalen Ereignisstand.

## Schnellstart

Zuerst die synthetischen Service-/Witness-Dateien aus dem [Evidenz-Schnellstart](ENTERPRISE_EVIDENZPRUEFUNG.md) erstellen. Der Witness-Hash muss separat bekannt sein. Neue private Testverzeichnisse verwenden.

Einen separaten Job-Signierschlüssel lokal erzeugen; er wird nicht ausgegeben:

```sh
mkdir -m 700 /tmp/thundy-storage-keys
node -e 'const fs=require("node:fs"),c=require("node:crypto");const k=c.generateKeyPairSync("ed25519");fs.writeFileSync("/tmp/thundy-storage-keys/jobs-private.pem",k.privateKey.export({type:"pkcs8",format:"pem"}),{flag:"wx",mode:0o600});'
```

`/tmp/thundy-storage-keys/config.json` mit folgendem Inhalt anlegen. Pfade müssen absolut sein; die Registry-Datei enthält `{ "registrations": [...] }` wie die bestehende Service-Konfiguration. Der private Schlüssel liegt getrennt, ist ausschließlich für seinen Eigentümer lesbar und darf kein Symlink sein.

```json
{
  "schemaVersion": 1,
  "signerKeyId": "local-storage-jobs-1",
  "signerPrivateKeyFile": "/tmp/thundy-storage-keys/jobs-private.pem",
  "serverKeyId": "local-server-1",
  "serverPublicKeyFile": "/tmp/thundy-evidence-service/server-public.pem",
  "registryFile": "/tmp/thundy-evidence-service/config.json",
  "witnessPublicKeyFile": "/tmp/thundy-independent-witness/witness-public.pem"
}
```

Einreihen schreibt noch kein Objekt und kontaktiert kein Netzwerk:

```sh
npm run enterprise:storage-jobs -- enqueue --queue /tmp/thundy-storage-queue --config /tmp/thundy-storage-keys/config.json --export /tmp/thundy-events.json --witness-anchor /tmp/thundy-witness-anchor.json --expected-anchor-hash BEKANNTER_WITNESS_HASH --directory /tmp/thundy-object-simulation
npm run enterprise:storage-jobs -- status --queue /tmp/thundy-storage-queue --config /tmp/thundy-storage-keys/config.json
npm run enterprise:storage-jobs -- run --queue /tmp/thundy-storage-queue --config /tmp/thundy-storage-keys/config.json
```

`run` bearbeitet höchstens einen fälligen **Simulationsauftrag** und beendet sich. Weitere Aufträge brauchen weitere Aufrufe. Der Status zeigt Job-ID, Quell-ID, Inhaltshash, Anzahl, Zustände, aktuelle und gesamte Versuche, Anlage-/Änderungs-/Readbackzeit, Cloudversion sowie angeforderte/beobachtete Retentionzeit, Retryzeit, Fehlercode, Journalgröße und Kettenkopf. Er gibt weder Ereignis-URLs noch Zielpfade oder Schlüssel aus. Die JSON-CLI ist eine technische Betreiberansicht; eine zentrale SSO-/Rollen-Adminoberfläche ist weiterhin offen.

Den vom Status ausgegebenen `head` unabhängig festhalten. Alle Befehle unterstützen optional `--expected-head BEKANNTER_JOB_HEAD`; ein abweichender Kopf wird vor der Aktion abgewiesen. Der Parameter bezieht sich auf den Stand **vor** dem Befehl. Ohne diesen extern bekannten Pin kann auch dieses lokale Journal einen gültig abgeschnittenen Präfix nicht selbst erkennen. Der Job-Pin ersetzt nicht den separat bekannten Witness-Pin.

## Optionale Cloudaufträge vorbereiten

`enqueue-cloud` speichert einen geprüften Auftrag, führt aber keinen Netzwerkzugriff durch. Die Zieldatei enthält genau `provider` und `settings`. Settings bestehen ausschließlich aus den erforderlichen Profilfeldern als Strings; Credentials, Tokens, frei angegebene Endpoints und zusätzliche Felder werden nicht gespeichert oder akzeptiert. Beispiel `/tmp/thundy-cloud-destination.json` mit synthetischen Werten; Region, Eigentümer, Schlüssel und eine zukünftige ISO-Retentionzeit durch die freigegebenen tatsächlichen Werte ersetzen:

```json
{
  "provider": "aws-s3",
  "settings": {
    "bucket": "example-audit-evidence",
    "ownerAccountId": "123456789012",
    "region": "eu-central-1",
    "kmsKeyArn": "arn:aws:kms:eu-central-1:123456789012:key/example-key",
    "retainUntil": "2027-10-14T00:00:00.000Z"
  }
}
```

Azure/GCP benötigen die [jeweiligen Profilfelder](ENTERPRISE_STORAGE_ADAPTER.md). Frei kombinierbare Systemprofile bleiben deaktivierte Konfigurationsentwürfe. Eine Zieldatei einzureihen aktiviert weder dieses Profil noch eine Unternehmensverbindung.

```sh
npm run enterprise:storage-jobs -- enqueue-cloud --queue /tmp/thundy-storage-queue --config /tmp/thundy-storage-keys/config.json --export /tmp/thundy-events.json --witness-anchor /tmp/thundy-witness-anchor.json --expected-anchor-hash BEKANNTER_WITNESS_HASH --destination /tmp/thundy-cloud-destination.json
npm run enterprise:storage-jobs -- status --queue /tmp/thundy-storage-queue --config /tmp/thundy-storage-keys/config.json
```

Die CLI lädt keine Cloud-SDKs oder Credentials und hat keinen Cloud-Schreibbefehl. `run` überspringt Cloudjobs. Ein späterer, ausdrücklich freigegebener Backendprozess verwendet die Bibliothek mit bereits initialisierten SDK-Clients:

```js
const { StorageJobs } = require('./enterprise/storage_jobs.cjs');
const { createAwsSdkPort } = require('./enterprise/immutable_storage.cjs');
const jobs = new StorageJobs(trustedJobConfiguration);
try {
  const observation = await jobs.runCloudOne({
    ports: { 'aws-s3': createAwsSdkPort(initializedS3Client, awsSdk) },
    authorization: { allowCloudWrite: true },
    timeoutMs: 30000,
    signal: shutdownController.signal
  });
  // observation.status can be CLOUD_OBSERVED, RETRY or DEAD_LETTER.
  // observation.sealed and observation.transportVerified remain false.
} finally {
  jobs.close();
}
```

Für Azure `createAzureSdkPort(initializedBlobServiceClient, initializedManagementClient)` und für GCP den initialisierten Storage-Client unter `gcp-bucket` übergeben. `runCloudOne` bearbeitet höchstens einen fälligen Cloudjob in Einreihungsfolge. Für dessen Anbieter muss ein Client vorliegen; ein fehlender Client wird vor einem neuen Versuch abgewiesen. Das Autorisierungsflag wird vor dem Versuch geprüft und darf nur aus vertrauenswürdigem Betreiber-/Backendcode kommen. Es ersetzt keine IAM-, Datenschutz- oder Betriebsfreigabe.

Während eines asynchronen Cloudversuchs sind weitere Workeraufrufe, Einreihung, Betreiber-Retry und `close` derselben Instanz gesperrt. Der Status bleibt lesbar. Shutdown muss den Worker abbrechen und dessen Rückkehr abwarten, bevor er den Journal-Lock freigibt.

## Zeitlimits und unklare Schreibausgänge

Alle drei Adapter verwenden ein **gemeinsames Gesamtzeitlimit** für Vorprüfung, Upload, Metadaten und vollständigen Readback. Standard 30 Sekunden; Bibliotheksparameter `timeoutMs` zwischen 10 ms und fünf Minuten. Das optionale fünfte Argument von `storeS3/storeAzure/storeGcp` ist `{ timeoutMs, signal }`. Timeouts und Betreiberabbruch erzeugen `STORAGE_TIMEOUT` bzw. `STORAGE_ABORTED`, niemals eine erfolgreiche Beobachtung. Retryzustand und Fälligkeit werden anschließend synchronisiert.

AWS-SDK-Send und Azure-Anfragen erhalten `abortSignal`; offene Readbackstreams werden geschlossen, auch wenn ein Stream erst nach Ablauf zurückkommt. Nach einem abgelaufenen Vorprüfungsschritt startet der Adapter keinen Upload. GCP-Metadaten-/Uploadaufrufe unterstützen in dieser Portanbindung keinen gemeinsamen AbortSignal: die Bibliothek begrenzt das Warten und verhindert weitere Adapterschritte, kann aber einen laufenden Remoteaufruf nicht nachweislich beenden. Deshalb müssen SDK-Clients zusätzlich begrenzte Requesttimeouts und Retrybudgets erhalten. Bei allen Anbietern beweist ein Abbruch nicht, dass remote nichts geschrieben wurde.

Ein möglicherweise geschriebenes Objekt bleibt erhalten. Wiederholung verwendet dasselbe Ziel und denselben inhaltgebundenen Key mit Conditional Write und prüft bei Konflikt die bestehende feste Version. Sie bestätigt weder anhand der Fehlermeldung noch anhand eines einzelnen Upload-Erfolgs. Aufbewahrungsfristen werden als konkrete Zeitpunkte gespeichert und bei Retry nicht automatisch verlängert. Ist die angeforderte Frist inzwischen abgelaufen, wird der Versuch abgewiesen; eine neue freigegebene Frist erzeugt einen eigenen Auftrag.

`CLOUD_OBSERVED` speichert Version, Zielbindung, Retention und Hashprüfung als damalige SDK-Beobachtung. `transportVerified`, `liveAcceptance` und `sealed` bleiben ausdrücklich `false`; `simulated` bleibt bei Cloudports `null`, weil die Bibliothek einen frei injizierten Testdouble nicht von einem authentifizierten Liveclient unterscheiden kann. Die Tests verwenden ausschließlich Testdoubles. Ein vollständiger SEALED-Nachweis braucht zusätzliche unabhängige produktive Prüfung und Evidenzcommit.

## Retry, Kapazität und Recovery

- Standard: maximal 1.000 behaltene Aufträge, 128 MiB gesamtes Journal, fünf Versuche pro Retryzyklus. Über die Bibliothek konfigurierbar; keine automatische Kürzung, kein Retirement. Ab 80 % der Byte- oder Auftragsgrenze zeigt der Status eine Kapazitätswarnung. Auch abgeschlossene Aufträge zählen weiter.
- Retryabstand: eine Sekunde, danach exponentiell bis fünf Minuten. Die absolute Fälligkeit übersteht Neustarts. Ein Abbruch nach `ATTEMPT` zählt als verbrauchter Versuch. Ein unterbrochener letzter Versuch führt beim nächsten Lauf zu `DEAD_LETTER`.
- `retry --job-id JOB_ID --queue ... --config ...` setzt nur einen Dead Letter wieder auf `QUEUED`. Gesamtversuche und signierte Historie bleiben erhalten. Vorher die Ursache prüfen; beschädigte Objekte werden nicht automatisch überschrieben oder gelöscht.
- `storage-jobs.lock` verhindert parallele Writer. Nach Prozessabbruch darf der Betreiber den Lock erst entfernen, wenn der alte Prozess nachweislich beendet ist. Das Programm löscht keinen fremden Lock automatisch.
- Journal und Verzeichnis sind 0600/0700, Eigentümerprüfung und Symlinkschutz aktiv. Append wird vollständig geschrieben und mit `fsync` synchronisiert; Neuanlage synchronisiert auch Verzeichnisse. Bei I/O-Fehlern sperrt sich der Writer bis zur geprüften Wiederaufnahme.
- Unvollständige Journalenden, falsche Signaturen, unzulässige Übergänge, andere Trustroots und falsche externe Heads werden abgewiesen. Kein automatisches Abschneiden oder Ignorieren beschädigter Datensätze. Vor Reparatur gesicherte Kopie und unabhängige Betreiberprüfung verwenden.
- Bei erfolgreichem Schreiben, aber verlorenem Abschluss, prüft der nächste Versuch dieselbe Datei erneut. Es entsteht kein zweites Objekt. Bei Fehlern während des Dateischreibens kann eine unvollständige Datei zurückbleiben; deren Readback schlägt fehl. Dies verlangt Betreiberklärung statt stiller Ersetzung.
- Bei Kapazitätsmangel wird keine Annahme oder Bestätigung vorgespiegelt. Ein schon geschriebenes Objekt kann unbestätigt bleiben. Kapazität überwachen und nötigenfalls über die Bibliothek erhöhen. Limits/Trustroots/Signierschlüssel bei Recovery nicht unkontrolliert ändern; insbesondere kleinere Versuchslimits können den bisherigen Verlauf ungültig machen. Rotation und Migration sind noch offen.

Ein Abschluss und dessen Readbackzeit belegen die damalige Prüfung; der Status liest abgeschlossene Objekte nicht erneut ein. Die lokale Dateiablage ist weiterhin veränderbar. Zwei POSIX-Dateien bilden keine Datenbanktransaktion; der Ablauf arbeitet mit wiederholbaren Aufträgen und idempotenter Prüfung. Kein abgeschlossener Job autorisiert eine Linköffnung oder das Löschen von Brokerdaten.

## Prüfung und nächste Integration

Die Storage-Suites umfassen nun 61 Tests, darunter 20 zusätzliche Cloud-/Deadline-Prüfungen. Sie prüfen unter anderem tatsächlichen Prozessabbruch nach Readback, Wiederaufnahme, verlorene Abschlussbestätigung, fehlgeschlagenes `fsync`, Teilwrites, externe Head-Pins, Trustwechsel, Deduplizierung, Zielbindung, Kapazitätsgrenzen, Retry/Dead Letters und separate CLI-Prozesse. Zusätzlich geprüft: alle drei Cloudports, Ziel-/Retentionsbindung, Tokensperre in Settings, totaler Timeout, Betreiberabbruch, offene/verspätete Streams, spätes Preflight-Ergebnis, verlorene Upload-Antwort, Cloudprozessabbruch, persistente Beobachtung und gescheitertes Abschluss-`fsync`. `npm run check` schließt diese Tests ein.

Der nächste Backend-Schritt ist die unabhängige Evidenzbestätigung und produktive Abnahme mit echten Betreiberidentitäten, konfigurierten SDK-Transportgrenzen sowie IAM/KMS/Retention/Restore-Prüfung. Erst danach kann ein eigener, dauerhaft bestätigter SEALED-Evidenzcommit entstehen. Signierschlüsselverwaltung, unabhängige OS-Rollen, zentrale Datenbank und Scheduling benötigen ebenfalls produktive Implementierung und Abnahme.
