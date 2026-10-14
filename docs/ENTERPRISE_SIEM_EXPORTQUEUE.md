# Optionale SIEM-Formate und dauerhafte lokale Exportqueue

Stand: 14. Oktober 2026. N05 ist lokal implementiert. Die Queue nimmt ausschließlich Incidentkandidaten aus [vollständig geprüften Entscheidungsdaten](ENTERPRISE_INCIDENTREGELN.md) an. Sie schreibt SIEM-kompatible Dateien und speichert Deduplizierung, Versuche, Backoff und Dead Letters dauerhaft. Es gibt **keinen Netzwerktransport**, keinen HTTP-Client und keine automatisch aktivierte Integration.

## Verbreitete Profile

| Profil | Lokales Format | Spätere Zielkonfiguration |
|---|---|---|
| `none` | Keine Verarbeitung | Standard deaktiviert |
| `splunk` | Splunk-HEC-Event mit `time`, `source`, `sourcetype`, `event` | HEC-Endpunkt, Index, Credentialreferenz |
| `sentinel` | Azure-Monitor-Logs-Array mit `TimeGenerated` | DCR-Stream und Mapping, Ingestion-Endpunkt, Unternehmensidentität |
| `elastic` | Elasticsearch-Bulk-NDJSON mit `create` und stabiler `_id` | Freigegebener Index/Data Stream im späteren Requestpfad |
| `generic-https` | JSON-Ereignisvertrag | Freigegebener HTTPS-Endpunkt und Authentifizierung |

```sh
npm run enterprise:connectors -- profile --profile splunk
```

Profile zeigen Einstellungs- und Secretreferenznamen, keine Credentialwerte. `enabled` und `transportEnabled` bleiben falsch. Zielsysteme müssen später Schema/Index/DCR und Antworten tatsächlich prüfen. Die Dateien sind Vorbereitung für diese Integration, keine getestete Anbieterzustellung. Ticketprofile bleiben Konfigurationsmöglichkeiten ohne Versand.

## Worker-Konfiguration

Separate lokale Datei, keine Extensioneinstellung:

```json
{
  "schemaVersion": 1,
  "mode": "offline-export-only",
  "organizationId": "11111111-1111-4111-8111-111111111111",
  "profileId": "elastic",
  "signerKeyId": "connector-writer",
  "signerPrivateKeyFile": "/srv/keys/connector-private.pem",
  "serverKeyId": "server-1",
  "serverPublicKeyFile": "/srv/trust/server-public.pem",
  "registryFile": "/srv/trust/registry.json",
  "outputDirectory": "/srv/exports"
}
```

Alle Felder sind erforderlich; zusätzliche Endpunkt-/Credential-/Aktivierungsfelder werden abgewiesen. Pfade müssen absolut sein. Der Worker-Schlüssel ist Ed25519, privat und mit Modus 0600 geschützt. Server-/Geräteschlüssel müssen ausschließlich öffentliche PEMs sein. Registry: genau `{"registrations": [...]}`. Organisation, Trustwurzeln, Profil, Ausgabeordner und Wiederholungsgrenzen sind im Journal gebunden; Änderung erfordert eine kontrollierte Migration statt stiller Weiterverwendung.

```sh
npm run enterprise:connectors -- enqueue \
  --directory /srv/local/connector-queue --config /srv/local/connector.json \
  --export /srv/review/events.json --rules /srv/review/rules.json \
  --expected-head EXTERN_BEKANNTER_QUITTUNGSHASH
npm run enterprise:connectors -- run \
  --directory /srv/local/connector-queue --config /srv/local/connector.json
npm run enterprise:connectors -- status \
  --directory /srv/local/connector-queue --config /srv/local/connector.json
```

`run` verarbeitet höchstens einen fälligen Auftrag; wiederholt aufrufen, bis kein Auftrag fällig ist. `retry --job-id HASH` setzt ausschließlich Dead Letters nach Betreiberprüfung zurück. `expected-head` ist optional, aber für Schutz gegen gültiges Abschneiden aus unabhängiger Quelle nötig. Der Workerstatus benötigt den Worker-Schlüssel; er ist kein rollenbasierter Adminzugriff.

Bibliotheks-API: `new ConnectorQueue({ directory, outputDirectory, signerKeyId, signerPrivateKey, trust, organizationId, profileId, clock, maxJobs, maxAttempts, retryBaseMs, expectedHead })`, dann `enqueue(export, rules, { expectedHead })`, `exportOne()`, `status()`, `retry(jobId)`, `close()`. Der Konstruktor-Pin bindet das Queuejournal, der `enqueue`-Pin das Ereignisjournal. `exportFormats(export, rules, trust, profileId)` prüft die gleichen Quelldaten ohne Queue.

## Inhalt, Deduplizierung und Recovery

Die Artefakte enthalten Domain-URL, damaligen Score/Providerbefund, Scoremodell und Assessmentzeit, Policy-/Regelversionen und überprüfbare Event-/Quittungshashes. Nachrichtentext, URL-Pfade, Queryparameter, Credentials sowie direkt auflösbare Geräte-/Interaktionskennungen werden nicht exportiert. Ereignis-/Incident-IDs und Domains können weiterhin personenbezogen sein; F02 und die spätere Ziel-Retention bleiben erforderlich. Minimisierter Workerstatus enthält nur Queueinformationen und Artefakthashes, keine URLs oder Zielkonfiguration.

- Auftrag-ID bindet Profil und reproduzierbare Incident-ID. Gleiche Inputs, Wiederholung nach Neustart und spätere Assessmentupdates erzeugen keine zweiten Aufträge. Andere Regelversionen sind eigene Ableitungen.
- Signierte Journalaktionen werden vor Bestätigung synchronisiert. Neue Dateien erhalten stabile Namen aus der Auftrag-ID und Modus 0600; Ausgabeordner und Journal sind private POSIX-Verzeichnisse.
- Zustände: `QUEUED` → `WRITING` → `EXPORTED`; Fehler → `RETRY` mit Backoff → gegebenenfalls `DEAD_LETTER`. Standard: fünf Versuche, Backoff ab einer Sekunde bis höchstens einer Stunde. Reset setzt die aktuelle Versuchsreihe zurück, erhält aber die Gesamtanzahl.
- Eine vollständige, exakt passende Datei kann nach unterbrochener Journalbestätigung übernommen werden. Andere Inhalte, Symlinks oder unsichere Dateirechte werden nicht überschrieben. Eine nach Abbruch unvollständige Datei benötigt Betreiberprüfung; automatisches Ersetzen ist nicht implementiert.
- Dateiinhalte und Verzeichnisse werden vor `EXPORTED` synchronisiert. Dieser Status bedeutet ausschließlich **lokal exportiert**. Remotezustellung, Providerantworten und SEALED bleiben unbestätigt.

Limits: 1.000 Aufträge, 32 MiB / 10.000 Journalaktionen; maximal 16 MiB Ereignisexport, 64 KiB Regeln und 1 MiB Registry im CLI. Keine Verdrängung. Batchkapazität wird vor Einreihen geprüft; ein Prozess-/IO-Abbruch kann einen bestätigten Präfix hinterlassen. Wiederholung ergänzt nur fehlende Aufträge. Verwaiste Locks, Teilzeilen und externe Kopfbindung entsprechen dem [Recoverymodell der Betriebsberichte](ENTERPRISE_BETRIEBSBERICHTE.md).

## Noch ausstehend

Konkrete freigegebene Zielsysteme, Domain-/SSRF-Policy, Redirect-/DNS-/TLS-Prüfung im tatsächlichen Transport, OS-/Vault-Schlüsselschutz, SSO-Rechte, Credentialrotation, Anbieterannahme und verbindliche Remote-Deduplizierung. Im vorhandenen Offlinepfad werden Endpunkte/Credentials als Eingaben abgewiesen; daraus wird keine Abnahme eines zukünftigen Netzwerkclients abgeleitet. N05 ist damit lokal umgesetzt; C05/D01 bleiben insgesamt Vorarbeit.
