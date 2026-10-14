# Optionale Speicherschnittstellen für eine künftig geschützte Protokollablage

Stand: 14. Oktober 2026. Die Node-Entwicklung besitzt jetzt SDK-Adapter für AWS S3 Object Lock, Azure Immutable Blob Storage und Google Cloud Bucket Lock sowie einen lokalen Dateisimulator. Alle Profile sind optional und standardmäßig deaktiviert. Es wurden **keine Cloudzugänge verwendet, keine Cloudobjekte geschrieben und keine Cloud-Retention aktiviert**.

Die Adapter verbinden vorhandene, vom Betreiber initialisierte SDK-Clients mit überprüften Evidenzobjekten. Der Simulator und die Tests laufen ohne Cloud-SDK-Installation. Die Thunderbird-Extension lädt diese Entwicklungsmodule nicht; ihre Scanfreigaben und lokalen Logs bleiben unverändert.

## Speicherstatus verständlich erklärt

**SEALED bedeutet „geschützte Ablage bestätigt“.** Gemeint ist eine bis zu einem festgelegten Datum gegen Änderung und Löschung geschützte Protokollversion, deren Schutz und Inhalt unabhängig geprüft und verbindlich bestätigt wurden. Dieser Status ist noch nicht implementiert. STAGED heißt hier „lokal gespeichert“; CLOUD_OBSERVED heißt „Speicher geprüft“ und bestätigt noch keinen produktiven Ablageschutz. [Alle Status mit einem Adminbeispiel](ENTERPRISE_SPEICHERSTATUS.md).

## Ein Speichernachweis braucht mehr als einen Upload-Erfolg

Vor dem Schreiben wird ein vollständiger, gerätesignierter und durch einen separat gepinnten Witness geschützter Snapshot geprüft. Unbezeugte Nachträge oder fehlende Gerätesignaturprüfung werden abgewiesen. Das Evidenzobjekt enthält Export und Witness-Anchor in kanonisierter JSON-Form; sein SHA-256 bestimmt den Objektschlüssel.

Bei den Cloud-Adaptern müssen zusätzlich Zielidentität, Region, Verschlüsselung, konkreter Versionsbezug, Sperrmodus und ausreichende Schutzfrist stimmen. Die **wirklich zurückgelesenen Bytes** werden gegen den erwarteten SHA-256 und die erwartete Länge geprüft. Ein frei gesetzter Metadata-Hash genügt nicht.

| Profil | Geprüfte Voraussetzungen und Objektbindung |
|---|---|
| `aws-s3` | ExpectedBucketOwner bei allen S3-Aufrufen, Region, aktive Versionierung/Object Lock; `COMPLIANCE`, festes `VersionId`, SSE-KMS-Key-ARN, RetainUntilDate und Readback |
| `azure-blob` | Subscription-/Account-ID über ARM, Region, festes öffentliches Account-Endpoint, version-level WORM; `BlockBlob`, festes `versionId`, `Locked`, Encryption Scope, Policy-Expiry und Readback |
| `gcp-bucket` | Bucket-/Projektidentität und Region, gesperrte Bucket-Retention; feste Generation, KMS-Key-Version, Objektfristen und tatsächlicher Schutz durch `timeCreated + locked retentionPeriod`, Readback und erneute Bucket-Prüfung |
| `local-simulation` | Private lokale Datei, `fsync`, identischer Readback; ausdrücklich **keine** Unveränderlichkeit oder Cloudgarantie |

S3-Governance wird nicht als ausreichend akzeptiert. Die relevante [S3-Object-Lock-Dokumentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html) unterscheidet Retention/Sperrmodus je Objektversion. Conditional Writes verhindern Überschreiben; siehe [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html).

Azure verwendet die dokumentierten SDK-Felder `expiriesOn`, `policyMode` sowie die zurückgelesenen Versionseigenschaften. Siehe [BlobImmutabilityPolicy](https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blobimmutabilitypolicy?view=azure-node-latest) und [BlobGetPropertiesResponse](https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blobgetpropertiesresponse?view=azure-node-latest). SAS-/Custom-/Emulator-Endpoints und Sovereign-Cloud-Endpoints sind in diesem Adapter noch nicht unterstützt.

Bei Google Cloud kann die effektive Objektfrist mehrere Retentionmechanismen umfassen. Deshalb reicht ein langes `retentionExpirationTime` allein nicht: Die gesperrte Bucket-Frist muss die angeforderte Schutzdauer selbst decken. Siehe [Bucket Lock](https://docs.cloud.google.com/storage/docs/bucket-lock) und [Objektmetadaten](https://docs.cloud.google.com/storage/docs/json_api/v1/objects). Der Adapter prüft die vom SDK nach dem Upload erhaltene Generation und liest genau diese zurück; er wechselt nicht stillschweigend zur neuesten Generation.

## Profile als deaktivierte Entwürfe ausgeben

```sh
npm run enterprise:storage -- profile --provider aws-s3
npm run enterprise:storage -- profile --provider azure-blob
npm run enterprise:storage -- profile --provider gcp-bucket
npm run enterprise:storage -- profile --provider local-simulation
```

Optional `--out /tmp/storage-profile.json`; vorhandene Dateien werden niemals überschrieben. Enthalten sind die benötigten Settingnamen und optionalen SDK-Paketnamen, keine Credentials. `enabled`, `allowCloudWrite`, `liveAcceptance` und `sealed` bleiben false. Die CLI besitzt **keinen Cloud-Schreibbefehl**.

Die bereits vorhandenen [Systemprofile](ENTERPRISE_SYSTEMPROFILE.md) bleiben frei kombinierbar. Diese Storage-Entwürfe ergänzen die Backend-Vorbereitung; die Auswahl im Extension-Assistenten aktiviert weder einen SDK-Client noch Cloudspeicher.

## Lokalen Simulator mit vollständiger Evidenz testen

Zunächst Export, Server-Checkpoint und Witness-Anchor gemäß [Evidenz-Schnellstart](ENTERPRISE_EVIDENZPRUEFUNG.md) erzeugen. Den separat bekannten Witness-Hash im folgenden Befehl einsetzen:

```sh
npm run enterprise:storage -- simulate --export /tmp/thundy-events.json --public-key /tmp/thundy-evidence-service/server-public.pem --server-key-id local-server-1 --registry /tmp/thundy-evidence-service/config.json --witness-anchor /tmp/thundy-witness-anchor.json --witness-public-key /tmp/thundy-independent-witness/witness-public.pem --expected-anchor-hash BEKANNTER_WITNESS_HASH --directory /tmp/thundy-object-simulation
```

Erwartung: `simulated: true`, `immutablePropertiesObserved: false`, `liveAcceptance: false`, `sealed: false`. Die Datei heißt `<SHA256>.json`. Wiederholung liest denselben Inhalt zurück; Manipulation führt zum Fehler. Die private Ablage verwendet 0700/0600 und ist unter POSIX getestet. Ein normaler Dateibesitzer kann die Datei weiterhin verändern oder löschen.

## SDK-Anbindung für eine spätere freigegebene Umgebung

`enterprise/immutable_storage.cjs` exportiert `prepareArtifact`, `storeS3`, `storeAzure`, `storeGcp`, `createAwsSdkPort` und `createAzureSdkPort`. Google Cloud kann den initialisierten Storage-Client direkt übergeben. Cloud-SDKs sind bewusst keine Extension-/Root-Runtime-Abhängigkeiten; ihre konkrete Version und Betriebsfreigabe gehören in das spätere Backend-Paket.

```js
const { prepareArtifact, createAwsSdkPort, storeS3 } = require('./enterprise/immutable_storage.cjs');
const artifact = prepareArtifact(exportData, separatelyTrustedKeysAndAnchor);
const port = createAwsSdkPort(initializedS3Client, awsSdk);
const observation = await storeS3(artifact, approvedStorageSettings, port, { allowCloudWrite: true });
```

`allowCloudWrite` ist ein zusätzlicher Aufrufschutz für vertrauenswürdigen Backendcode, **keine** Autorisierung durch eine UI-Angabe. Betreiberfreigabe, Datenregion, zulässige Retention, SDK-Version, Identität/IAM, Endpoints/TLS, Zeitlimits und Betrieb müssen vor einem produktiven Aufruf eingerichtet und abgenommen sein. Die Bibliothek initialisiert keine Credentials und ersetzt keine bestehende Cloudidentität.

Die Zielsettings werden vor asynchronen SDK-Aufrufen kopiert. Quell- und Zielschlüssel stammen nicht aus einer angeklickten URL. Bei bestehenden Objekten führen Conditional-Write-Konflikte zur Prüfung der bestehenden Version statt zum Überschreiben. Fehler nach einem Upload können ein noch nicht bestätigtes Objekt hinterlassen; es wird nicht automatisch entfernt. Wiederholung verwendet denselben inhaltgebundenen Key und prüft erneut.

Es werden keine Buckets/Container erstellt, keine Bucketpolicies permanent gesperrt und keine bestehenden Policies verkürzt. Ein ausdrücklich aktivierter Cloud-Upload fordert allerdings objektbezogene Retention an; dies ist außerhalb der Tests eine produktive Schreibaktion. Bei GCP wird die SDK-Upload-Integritätsprüfung mit automatischem Cleanup nicht verwendet; stattdessen prüft dieser Adapter den vollständigen Readback mit SHA-256. Grundlage des SDK-Verhaltens ist der [offizielle File-Quellcode](https://github.com/googleapis/nodejs-storage/blob/main/src/file.ts).

Cloudfehler werden zu stabilen Fehlercodes ohne rohe SDK-Fehlermeldungen/Tokenwerte normalisiert. Den SDK-Clients müssen begrenzte Request-/Body-Deadlines und kontrollierte Retries vorgegeben werden; dies ist noch keine vollständig betriebene Connector-Outbox. Die fristgebundene Broker-Zustellung aus dem bisherigen lokalen Service bleibt davon getrennt.

## Warum das noch keine SEALED-Quittung ist

Das Ergebnis `thundy-storage-observation` beschreibt die validierten SDK-Antworten und Readback-Bindung. Bei Cloudports steht `simulated: null` und `transportVerified: false`: Eine frei injizierbare Portantwort beweist nicht, dass tatsächlich ein authentifizierter Cloudanbieter kontaktiert wurde. Deshalb bleiben `liveAcceptance` und `sealed` unabhängig vom positiven Metadatencheck false.

Noch erforderlich sind reale Anbieterabnahmen mit freigegebenen Identitäten, negative Lösch-/Überschreib-/Fristverkürzungsversuche, IAM-/KMS-/Key-Vault-Schutz, Restore/Region/Replication sowie der atomare Serverübergang zu einer signierten SEALED-Quittung. Der Storagebericht allein darf weder `intentSealed` setzen noch Brokerdaten löschen. Cloud-Object-Lock schützt zudem nicht automatisch vor Verlust eines Verschlüsselungsschlüssels oder Kontos; dafür braucht es separate Betriebs- und Restore-Nachweise.

21 neue Tests prüfen volle Witness-/Gerätebindung, Aktivierungsschutz, Region/Owner/Endpoint, Versionierung, Locked/Compliance statt Governance, Generation und Verschlüsselung, zu kurze/abgelaufene Retention, GCP-Bucketfristen, Readback-Manipulation/Größenlimits, Conditional Retry, SDK-Mapping, unveränderte Settings während asynchroner Aufrufe, fehlerhafte Append-Blobs, redigierte Fehler sowie den gesamten lokalen CLI-Simulator. Die Cloudfälle verwenden Testdoubles, keine echten Anbieterzugänge.

[Status aller Enterprise-Arbeitspakete](ENTERPRISE_UMSETZUNGSSTAND.md). Der persistente Jobworkflow ist angebunden. Der nächste Schritt ist der unabhängige SEALED-Evidenzcommit mit produktiver Abnahme; produktive Aktivierung bleibt an reale Betriebsfreigaben gebunden.

## Dauerhafte lokale Aufträge

Der [Storage-Jobworkflow](ENTERPRISE_STORAGE_JOBS.md) ergänzt persistente, signierte Aufträge und Wiederaufnahme für den lokalen Simulator sowie S3/Azure/GCP über eine explizite Backend-API. Gesamtzeitlimits und Abbruchsignale begrenzen die Adapter. CLI-Cloudjobs werden ausschließlich vorbereitet; SDK-Clients werden nicht automatisch geladen. Weder Simulationsabschluss noch CLOUD_OBSERVED ist ein SEALED-Nachweis.

Das optionale fünfte Adapterargument `{ timeoutMs: 30000, signal }` begrenzt den gesamten Ablauf einschließlich Readback. AWS/Azure erhalten ein AbortSignal, GCP-Anfragen brauchen ergänzende SDK-Transportgrenzen. Die Bibliothek kann einen möglicherweise bereits erfolgten Remotewrite bei Timeout nicht ausschließen; Aufträge bleiben erhalten und werden mit derselben Ziel-/Versionsprüfung wiederholt. [Betrieb, Status und Recovery](ENTERPRISE_STORAGE_JOBS.md).
