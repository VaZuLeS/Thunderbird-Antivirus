# Speicheraufträge ohne privaten Schlüssel prüfen

Stand: 14. Oktober 2026. Der neue Prüfpfad benötigt nur öffentliche Schlüssel, eine vertrauenswürdig bezogene Registry und das signierte Jobjournal. Er legt keinen Writer-Lock an, erzeugt keine Signaturen und verändert das Journal nicht. Eine optionale HTML-Ausgabe verwendet die bestehende sechssprachige Adminansicht.

**Signaturprüfung ist keine SEALED-Bestätigung.** Sie prüft die vorliegenden Journalaktionen und die darin enthaltenen Evidenzsnapshots. Ohne einen separat bekannten aktuellen Job-Kettenkopf kann ein gültig abgeschnittenes Journalende unbemerkt bleiben. Auch bei passendem Kopf ist keine geschützte Cloudablage bestätigt. HTML/JSON bleiben unsignierte Prüfzusammenfassungen.

## Öffentliche Prüfkonfiguration

Die Schlüssel und Registry aus einem freigegebenen Betreiberkanal beziehen; niemals aus einem zu prüfenden Bericht übernehmen. Der Job-Public-Key gehört zum bisherigen Job-Signierschlüssel. Die privaten Writer-/Server-/Witness-Schlüssel werden nicht an den Reviewer weitergegeben.

```json
{
  "schemaVersion": 1,
  "signerKeyId": "local-storage-jobs-1",
  "signerPublicKeyFile": "/tmp/thundy-review/jobs-public.pem",
  "serverKeyId": "local-server-1",
  "serverPublicKeyFile": "/tmp/thundy-review/server-public.pem",
  "witnessPublicKeyFile": "/tmp/thundy-review/witness-public.pem",
  "registryFile": "/tmp/thundy-review/registry.json"
}
```

Pfade sind absolut. Schlüsseldateien müssen Ed25519-SPKI-Public-Key-PEMs sein. Private-Key-Dateien und zusätzliche Konfigurationsfelder werden abgewiesen. Die Registry besitzt die bestehende Form `{ "registrations": [...] }`. Historische Schlüssel-/Policybindungen müssen zu den gespeicherten Aufträgen passen; eine Migration wird nicht automatisch erfunden.

Der Betreiber stellt einen konsistenten Journalstand bereit, beispielsweise eine OS-geschützte Kopie nach Writer-Stopp, und übergibt den erwarteten Kopf unabhängig davon. Der Verifier kann bei vorhandenem Writer-Lock lesen. Ändert sich die Datei während des Einlesens, bricht er ab; daraus folgt keine Freigabe zum Eingriff in den Lock oder in einen laufenden Writer.

## Verifizieren und Adminansicht erzeugen

```sh
npm run enterprise:storage-verify -- verify --journal /tmp/thundy-review/storage-jobs.jsonl --config /tmp/thundy-review/public-config.json --expected-head BEKANNTER_JOB_HEAD
npm run enterprise:storage-verify -- review --journal /tmp/thundy-review/storage-jobs.jsonl --config /tmp/thundy-review/public-config.json --expected-head BEKANNTER_JOB_HEAD --lang de --out /tmp/thundy-review/jobs.html
```

Ohne `--expected-head` bleibt Signaturprüfung möglich; `verification.headPinned` ist dann ausdrücklich `false`. Eine externe Kopfbindung ersetzt weder den separaten Witness-Pin noch produktive IAM-/Retention-Abnahme. Der vertrauenswürdige Job-Signer bindet bei Einreihung den damaligen Witness-Pin an den Auftrag; der Verifier prüft die historischen Snapshots gegen die separat vorgegebenen Public-Key-Roots. Er behauptet keinen neuesten globalen Witness-Stand.

`verify` liefert den minimierten Jobstatus und `verification` mit Signaturprüfung, Kopfbindung, Anzahl der Journalaktionen, Signer-Key-ID und SHA-256-Fingerprint des öffentlichen Signierschlüssels (SPKI-DER). Keine Signierschlüssel, Quellereignis-URLs oder Zielsettings werden ausgegeben. Bei leerem Journal ist `actionCount: 0`; es liegen dann keine signierten Aktionen vor.

`review` unterstützt `en`, `de`, `fr`, `es`, `it`, `pl`, standardmäßig Englisch. Nur die ausdrücklich angegebene neue Reportdatei wird geschrieben, unter POSIX mit 0600. Vorhandene Ausgaben werden nicht überschrieben. HTML und Browser-JSON-Export sind weiterhin unsignierte Zusammenfassungen; der Browserexport ersetzt nicht das signierte Journal oder die extern bezogenen Trustwerte.

## Prüfungen und Grenzen

Writer und Verifier verwenden dieselbe Replay- und Zustandsprüfung: Journal-/Geräte-/Server-/Witness-Signaturen, Trust-Fingerprint, fortlaufende Aktionen, vorheriger Kettenkopf, Job-/Ziel-/Inhaltsbindung sowie erlaubte Übergänge. Ungültige Signaturen, andere Roots, Teilenden, falscher Kopf und unzulässige SEALED-Aktionen werden abgewiesen.

CLI-Grenzen entsprechen den Standard-Writerwerten: 128 MiB, 1.000 Jobs, fünf Versuche pro Retryzyklus. Wurde der Writer mit anderen Grenzen betrieben, die Bibliotheks-API `StorageJobs.verifyJournal(content, { signerKeyId, signerPublicKey, trust, expectedHead, maxBytes, maxJobs, maxAttempts })` mit den passenden freigegebenen Werten verwenden. Limits sind kein unabhängig signierter Policy-Nachweis. Keine automatische Kürzung, Reparatur, Rotation oder Umregistrierung.

Sechs zusätzliche Tests prüfen Public-Key-Replay gegen den Writer, unveränderte Dateien/Locks, falsche Roots/Signaturen, Tail-Truncation mit Pin, gültig signierte unzulässige Übergänge, tatsächliche CLI-Berichte ohne vorhandene private Schlüsseldatei sowie private Konfigurationsfelder, Symlinks, Größenlimits und Überschreibschutz.

OS-Zugriff auf Journal/Registry bleibt notwendig. Zentrale SSO-Rollen und produktive unabhängige Schlüssel-/Journalverteilung fehlen weiterhin. Der Verifier führt keine Cloudanfrage aus. [Adminübersicht](ENTERPRISE_STORAGE_ADMIN.md) · [Arbeitsplan](ENTERPRISE_NAECHSTE_SCHRITTE.md).
