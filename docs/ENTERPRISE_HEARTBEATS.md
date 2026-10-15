# Signaturgeprüfte minimale Testgeräte-Heartbeats

Stand: 15. Oktober 2026. N11 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) implementiert einen lokalen Node-Kern zur Annahme signierter Heartbeats aus einer ausdrücklich vorgegebenen Testregistry. Er erzeugt keine Meldungen automatisch und ist nicht in Thunderbird, MDM oder einen OS-Broker eingebunden. **Es wurde keine reale Unternehmensflotte gemessen.**

## Meldung und Datenumfang

Ein Gerät signiert den folgenden Payload als Ed25519-Envelope `{keyId,payload,signature}`. Signiert wird wie beim bestehenden Ledger JCS `{keyId,payload}`; Policy-Payloadsignaturen haben einen anderen Vertrag und sind hier nicht verwendbar.

```json
{
  "schemaVersion": 1,
  "kind": "thundy-device-heartbeat",
  "organizationId": "11111111-1111-4111-8111-111111111111",
  "deviceId": "22222222-2222-4222-8222-222222222222",
  "streamEpoch": "33333333-3333-4333-8333-333333333333",
  "sequence": 1,
  "observedAt": "2026-10-15T10:00:00.000Z",
  "extensionVersion": "1.22.0",
  "policyId": "44444444-4444-4444-8444-444444444444",
  "policyVersion": 3,
  "queue": {"pending": 0, "retry": 0, "deadLetter": 0, "bytes": 0},
  "brokerReady": true
}
```

Alle Felder sind erforderlich; Zusatzfelder werden abgewiesen. Keine Links, Nachrichten, Sender, Benutzernamen, Pfade, Providerresultate oder Credentialfelder. Geräte-/Organisations-/Policy-/Epochkennungen sind UUIDs und können weiterhin personenbezogen sein. Queuezähler sind nichtnegative sichere Ganzzahlen, höchstens eine Million pro Status und ein TiB Bytes. Extensionversionen sind dreiteilige Semver-Werte ohne Präfix. UTC-Zeitangaben sind kanonisch mit Millisekunden.

`brokerReady`, Versionen und Queuezähler sind **signierte Selbstauskünfte des registrierten Schlüssels**. Die Signatur beweist keine tatsächlich installierte Binärdatei, angewandte Policy, MDM-Zugehörigkeit oder TPM-/OS-Gerätebindung. Das spätere geschützte Enrollment bleibt Voraussetzung für einen Unternehmensbetrieb.

Heartbeat-Sequenzen sind ein eigener Kanal und verbrauchen keine Sequenz des Link-Ereignisjournals. Neue Sequenzen beginnen bei 1 und müssen lückenlos aufeinander folgen. Der Payloadtyp verhindert eine Verwechslung mit bestehenden Geräteevents.

## Zustände und Zeitbehandlung

| Code | Bedeutung |
|---|---|
| `NEVER_SEEN` | Registrierter Schlüssel, aber keine angenommene Meldung; keine Kontaktzeit erfunden |
| `CURRENT` | Angenommener Meldungsstand innerhalb der lokalen Frist |
| `LATE` | Alter mindestens `lateAfterMs` |
| `UNKNOWN` | Alter mindestens `unknownAfterMs`; dies beweist keinen Ausfall |
| `REVOKED` | Schlüssel in der vorgegebenen Registry deaktiviert; neue Annahme abgewiesen |

Standard: verspätet nach zehn Minuten, unbekannt nach zwanzig Minuten. Altersbasis ist das Maximum aus **serverseitigem Annahmealter** und Gerätezeit-Alter, mindestens 0. Ein akzeptierter leicht vorausgehender Client-Zeitstempel verlängert daher die Frische nicht über die Serverfrist hinaus. Neue Meldungen dürfen standardmäßig höchstens zwei Minuten von der Annahmezeit abweichen; größere Vor-/Rücksprünge werden abgewiesen. Gerätezeit darf bei neuen Sequenzen nicht rückwärts laufen. Server-Uhrrücklauf sperrt den Writer; auch ein öffentlicher Snapshot darf nicht vor einer darin enthaltenen Annahmezeit ausgewertet werden.

Exakte Wiederholungen bereits angenommener Sequenzen liefern den ursprünglichen signierten Annahmebeleg. Sie verändern weder Journal noch letzte Kontaktzeit und sind auch bei inzwischen alter Meldung idempotent. Wiederverwendung einer Sequenz mit anderem Inhalt, Lücken, fremde Organisation/Gerät/Epoche/Policy-ID, falsche Signaturen und deaktivierte Keys werden abgewiesen.

Gemeldete Policyversionen werden als `behind`, `matches` oder `ahead` relativ zur Registry klassifiziert. Gemeldete Extensionversionen werden als `below_minimum` oder `meets_minimum` eingeordnet. Diese Vergleiche sind Statusinformationen, keine Policyaktivierung oder Konformitätsbescheinigung.

## Registry und öffentliche Konfiguration

Die Registry enthält genau `{"registrations": [...]}`. Jede Registrierung hat genau diese Felder:

```json
{
  "keyId": "test-device-1",
  "organizationId": "11111111-1111-4111-8111-111111111111",
  "deviceId": "22222222-2222-4222-8222-222222222222",
  "streamEpoch": "33333333-3333-4333-8333-333333333333",
  "policyId": "44444444-4444-4444-8444-444444444444",
  "policyVersion": 3,
  "revoked": false,
  "publicKey": "-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----\n"
}
```

Der Platzhalter ist durch den tatsächlichen öffentlichen Geräteschlüssel zu ersetzen. Maximal 1.000 Registrierungen derselben Organisation; Geräte-ID und öffentlicher Schlüsselfingerprint müssen eindeutig sein. Ein Schlüssel darf nicht mehrere scheinbar unabhängige Geräte darstellen. Private Schlüssel und Zusatzfelder in der Registry werden abgewiesen. Dies ersetzt nicht die Prüfung, ob mehrere reale Geräteidentitäten zum selben physischen Gerät gehören.

Öffentliche CLI-Konfiguration:

```json
{
  "schemaVersion": 1,
  "organizationId": "11111111-1111-4111-8111-111111111111",
  "signerKeyId": "heartbeat-writer",
  "signerPublicKeyFile": "/srv/trust/heartbeat-writer-public.pem",
  "registryFile": "/srv/trust/heartbeat-registry.json",
  "minimumExtensionVersion": "1.22.0",
  "lateAfterMs": 600000,
  "unknownAfterMs": 1200000,
  "maxClockSkewMs": 120000
}
```

Alle Felder erforderlich, absolute Dateipfade und öffentliche Ed25519-PEMs. Schlüssel-/Registry-/Schwellenwerte werden in den signierten Journalkontext gebunden. Nachträgliche Änderung erfordert kontrollierte Migration; eine aktualisierte Registry lässt sich nicht still über einen alten Verlauf legen. Insbesondere produktive Rotation, dynamischer Widerruf, neue Epochen und Enrollment sind noch nicht implementiert.

## Annahme und unabhängige Prüfung

```sh
npm run enterprise:heartbeats -- accept \
  --directory /srv/local/heartbeats --config /srv/trust/heartbeats.json \
  --private-key /srv/keys/heartbeat-writer-private.pem \
  --input /srv/test-input/signed-heartbeat.json

npm run enterprise:heartbeats -- verify \
  --journal /srv/local/heartbeats/actions.jsonl \
  --config /srv/trust/heartbeats.json \
  --expected-head EXTERN_BEKANNTER_JOURNAL_HASH \
  --out /srv/review/device-status.json
```

`accept` benötigt den privaten **Writer-Schlüssel**, nicht den privaten Geräteschlüssel. Der Writer-Schlüssel muss zum gepinnten öffentlichen Writer passen und als betreibereigene reguläre Datei mit 0600 vorliegen. `verify` benötigt ausschließlich öffentliche Trustwerte und kann auch bei aktivem Writer arbeiten, ohne Journal/Lock zu verändern.

Der öffentliche Prüfer wiederholt **Geräte- und Writer-Signaturprüfung** für alle Journalaktionen sowie Bindung, Sequenzen, Zeitbeziehungen und Zustandsbildung. Anders als beim minimierten Falljournal enthält dieser Verlauf den vollständigen minimalen signierten Heartbeat. Ohne extern bekannten Kopf-Pin bleibt gültiges Abschneiden unerkennbar (`headPinned: false`). Ein gültig signierter Eintrag allein beweist bei einem aktiven Writer noch keine erfolgreiche fsync-Bestätigung.

Statusreports tragen `coverage: explicit-test-registry-only`, `runtimeIntegrated: false`, `productionFleetVerified: false` und `sealed: false`. Ausgezählt werden ausschließlich registrierte Testidentitäten; keine Schätzung der Unternehmensflotte und kein automatisches Enrollment. Der Status ist eine unsignierte Ableitung; für neue Auswertung Journal und vertrauenswürdige Konfiguration erneut prüfen. Keine Benutzeroberfläche oder automatische Übertragung wird aktiviert.

## API, Kapazität und Recovery

```js
const { Heartbeats } = require('./enterprise/heartbeats.cjs');
const store = new Heartbeats({
  directory, organizationId, registrations, signerKeyId, signerPrivateKey,
});
const acceptance = store.accept(signedHeartbeat);
const snapshot = store.status();
store.close();
```

`Heartbeats.verifyJournal(content, {organizationId, registrations, signerKeyId, signerPublicKey, now, expectedHead, ...thresholds})` erzeugt den öffentlichen Report. Annahme und Wiederaufnahme verwenden private POSIX-Verzeichnisse, exklusiven Lock und Synchronisierung vor Bestätigung. Standard: 32 MiB / 10.000 Aktionen. Keine automatische Löschung oder Verdrängung; exakte Duplikate benötigen keine weitere Journalaktion.

CLI-Lesegrenzen: Konfiguration 64 KiB, Registry 1 MiB, signierte Meldung 16 KiB, Journal 32 MiB. Reguläre Dateien ohne Symlinks; neue Reportdatei mit 0600, keine Überschreibung. Fehlerausgabe enthält Codes statt Payloads oder Credentialwerte. Keine Netzwerkverbindungen.

Schreib-/Syncfehler bestätigen keine Annahme und sperren weitere Writeraktionen bis zur geprüften Wiederaufnahme. Vollständig geschriebene Aktionen können nach Neustart bereits vorliegen; Wiederholung liefert ihren ursprünglichen Beleg. Teilzeilen werden nicht automatisch repariert. Verwaiste Locks erst nach bestätigtem Ende des Writers entfernen. Vor Erreichen der Grenzen sind freigegebene Archivierung und Rotation erforderlich; diese sind weiterhin offen.

Die Entwicklung verwendet synthetische Registrierungen und echte kryptografische Signaturen. Thunderbird-/OS-Brokeranbindung, Unternehmensidentitäten, zentraler Transport, SSO-/Objektrechte, Retention, N06-Live-Nachweise und produktive Flottenabnahme bleiben offen. H01/H02 sind deshalb Vorarbeit; Extension 1.22.0 bleibt unverändert.

## Lokale sechssprachige Übersicht

`review` erstellt nach derselben Public-Key-Prüfung eine [sechssprachige HTML-Übersicht](ENTERPRISE_HEARTBEAT_UEBERSICHT.md) mit Status-/Problemfiltern und vollständigem minimiertem JSON-Download (N12). Öffentliche Reports enthalten zusätzlich `criteria` mit `minimumExtensionVersion`, `lateAfterMs` und `unknownAfterMs`, damit die gebundenen Bewertungskriterien nachvollziehbar bleiben.
