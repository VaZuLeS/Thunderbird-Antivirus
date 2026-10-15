# Dauerhafte Alarmkandidaten aus geprüften Testgeräte-Meldungen

Stand: 15. Oktober 2026. N13 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ergänzt einen getrennten lokalen Alarmworker. Jede Beobachtung verarbeitet das **Originaljournal** der [Testgeräte-Heartbeats](ENTERPRISE_HEARTBEATS.md), prüft Geräte- und Writersignaturen erneut und speichert Beobachtung und neue Kandidaten gemeinsam in einem signierten, synchronisierten Journal. Es gibt keinen Import ungeprüfter HTML-/JSON-Snapshots.

Keine reale Unternehmensflotte wurde gemessen. Kein Enrollment, Hintergrunddienst, externer Versand, SSO oder SEALED wird aktiviert. Die vorhandene sechssprachige Geräteübersicht bleibt unabhängig nutzbar.

## Regeln und Aussagekraft

Regelversion 1 ist im Journal und jedem Kandidaten gebunden. Fristen stammen aus der öffentlichen Heartbeat-Konfiguration, standardmäßig zehn Minuten bis `LATE` und zwanzig Minuten bis `UNKNOWN`.

| Code | Priorität | Bedeutung |
|---|---|---|
| `HEARTBEAT_NEVER_SEEN` | Information | Für eine registrierte Identität wurde noch keine Meldung angenommen; einmaliger Hinweis, keine behauptete Ausfallzeit |
| `HEARTBEAT_LATE` | Mittel | Meldungsalter hat die Verspätungsgrenze erreicht |
| `HEARTBEAT_UNKNOWN` | Hoch | Meldung hat die zweite Altersgrenze erreicht; ein Geräteausfall ist damit nicht bewiesen |
| `HEARTBEAT_RECOVERED` | Information | Nach zuvor verspäteter/zu alter Meldung liegt wieder eine aktuelle signierte Meldung vor; keine Attestation eines funktionsfähigen Geräts |

Widerrufene Registrierungen erzeugen keine Meldungslücken-Alarme. Die erste Meldung eines zuvor nie gemeldeten Geräts wird nicht als „Erholung“ ausgegeben. Ein Zustandswechsel erzeugt sofort einen Kandidaten, auch innerhalb der Dämpfungsfrist; unveränderte `LATE`-/`UNKNOWN`-Befunde werden standardmäßig höchstens alle 15 Minuten erneut gemeldet. Ein `NEVER_SEEN`-Hinweis wird nicht regelmäßig wiederholt.

`firstDetectedAt` bezeichnet den **ersten tatsächlich ausgewerteten verspäteten/zu alten Stand** des laufenden Vorfalls, nicht einen errechneten Beginn einer Geräteausfallzeit. Der Wert bleibt bei Eskalation und Erholung erhalten; bei nie gemeldeten Geräten ist er `null`. Jeder Kandidat referenziert Geräte-/Schlüsselkennung, letzte Annahme- und Gerätezeit, Sequenz, Auswertungs-/Erzeugungszeit und Quelljournalhash/-aktionszahl. Das schützt nicht gegen falsche Selbstauskünfte eines autorisierten Geräteschlüssels.

## Replay, Alterung und Recovery

Die API `HeartbeatAlerts.observe(originalJournal, {evaluatedAt?, expectedSourceHead?})` prüft das Original mit `Heartbeats.verifyJournal`. Ohne Zeitargument wird zum jetzigen Workerzeitpunkt ausgewertet. Das erneute Prüfen eines alten Meldungsjournals zum jetzigen Zeitpunkt ist erlaubt und kann dessen Meldungen korrekt als verspätet/zu alt einstufen. Ein alter zugelieferter **Auswertungszeitpunkt** wird dagegen abgewiesen, sobald er mehr als `maxSnapshotAgeMs` zurückliegt; zukünftige Auswertungszeiten werden ebenfalls abgewiesen. Ein abgewiesener Stand erzeugt weder Erholung noch neue Gerätekandidaten.

Auswertungszeiten müssen nach der ersten Beobachtung streng steigen. Innerhalb des zulässigen Alters ist ein identisches Wiederholen desselben Zeitpunkts, Inhalts und Quell-Pinstatus idempotent und liefert keine neuen Kandidaten. Vorhandene Kandidaten bleiben über `pending()` verfügbar. Anderer Inhalt zum gleichen Zeitpunkt, rückläufige Sequenzen oder Zeiten werden abgewiesen. Worker-Uhrrücklauf sperrt weitere Operationen.

Nach der ersten Verarbeitung muss jedes weitere geprüfte Quelljournal den bereits gespeicherten Quell-Endhash an derselben Aktionsposition enthalten. Damit werden auch gültig signierte Präfixe und alternative Verläufe hinter einem verarbeiteten Stand abgewiesen. Beim ersten Lauf ist ohne unabhängig bekannten Quell-Endhash kein gültiges Abschneiden erkennbar. Registry, Quellenwriter, Fristen, Dämpfung und Kapazität sind im Alarmjournal-Kontext gebunden; Änderung erfordert kontrollierte Migration.

Beobachtung und sämtliche neuen Kandidaten sind eine atomare Journalaktion. `fsync` erfolgt vor Bestätigung. Ein Synchronisierungsfehler bestätigt keinen Erfolg und sperrt den laufenden Writer; eine vollständig geschriebene Aktion kann beim Neustart wiederhergestellt werden. Offene Kandidaten verschwinden weder durch Neustart noch durch eine spätere Erholung.

## Konfiguration und CLI

Die bestehende öffentliche Heartbeat-Konfiguration und Registry aus N11 wiederverwenden. Der Alarmworker verwendet einen **eigenen** Ed25519-Writerschlüssel. Öffentliche Alarmkonfiguration:

```json
{
  "schemaVersion": 1,
  "signerKeyId": "heartbeat-alert-writer",
  "signerPublicKeyFile": "/srv/trust/heartbeat-alert-public.pem",
  "heartbeatConfigFile": "/srv/trust/heartbeat-config.json",
  "cooldownMs": 900000,
  "maxSnapshotAgeMs": 300000,
  "maxPending": 1000
}
```

Alle Felder erforderlich. Referenzen sind absolute Dateipfade; private Schlüssel gehören nicht in Konfigurationen. Workerbefehle prüfen, ob der private Schlüssel zum öffentlichen Alarmwriter passt; die private Schlüsseldatei muss betreibereigen, regulär und mit 0600 geschützt sein. Der Worker benötigt keinen privaten Geräte- oder Heartbeat-Writerschlüssel.

```sh
npm run enterprise:heartbeat-alerts -- observe \
  --directory /srv/local/heartbeat-alerts \
  --config /srv/trust/heartbeat-alert-config.json \
  --private-key /srv/keys/heartbeat-alert-private.pem \
  --journal /srv/local/heartbeats/actions.jsonl \
  --expected-source-head UNABHAENGIG_BEKANNTER_QUELL_SHA256 \
  --out /srv/review/heartbeat-observation.json

npm run enterprise:heartbeat-alerts -- pending \
  --directory /srv/local/heartbeat-alerts \
  --config /srv/trust/heartbeat-alert-config.json \
  --private-key /srv/keys/heartbeat-alert-private.pem \
  --limit 100 --out /srv/review/heartbeat-pending.json

npm run enterprise:heartbeat-alerts -- ack \
  --directory /srv/local/heartbeat-alerts \
  --config /srv/trust/heartbeat-alert-config.json \
  --private-key /srv/keys/heartbeat-alert-private.pem \
  --notification-id KANDIDAT_SHA256 --consumer-id local-collector

npm run enterprise:heartbeat-alerts -- verify \
  --config /srv/trust/heartbeat-alert-config.json \
  --journal /srv/local/heartbeat-alerts/actions.jsonl \
  --expected-head UNABHAENGIG_BEKANNTER_ALARM_SHA256 \
  --out /srv/review/heartbeat-alert-review.json
```

Pins sind optional und durch tatsächliche, unabhängig bekannte SHA-256-Werte zu ersetzen. `--expected-source-head` ist der **Heartbeat-Endhash** und nur bei `observe` zulässig. `--expected-head` ist der **Alarmjournal-Endhash** und bei allen vier Befehlen möglich; eine erfolgreiche Schreibaktion verändert diesen Stand. Ein selbst aus derselben Datei abgelesener Hash schafft keine unabhängige Verankerung.

JSON-Ausgaben sind neue private Dateien (0600); vorhandene Ausgaben werden nicht überschrieben. Ein Ausgabefehler nach erfolgreichem Journalcommit bestätigt oder löscht keine Kandidaten: anschließend `pending` verwenden. Es gibt keine automatische Bestätigung durch Lesen oder Dateidownload.

## Bestätigte Übernahme und Grenzen

`pending({limit})` liefert höchstens 1–1.000 offene Kandidaten in Erzeugungsreihenfolge, Standard 100. Der Empfänger muss mit `notificationId` idempotent übernehmen und **erst nach eigener dauerhafter Speicherung** `acknowledge(id, {consumerId})` aufrufen. Dieselbe ID und derselbe Verbraucher sind auch nach Neustart idempotent; eine andere Verbraucherkennung auf einer bestätigten ID wird abgewiesen. Verbraucherkennungen sind lokale Betreiberangaben, keine SSO-Identitäten. Eine Bestätigung beweist keine Netzwerkzustellung.

`status()` nennt offene/bestätigte Anzahl, registrierte und noch nicht ausgewertete Geräte, Zustandszahlen, Auswertungszeit und Journalreferenzen. Vor erster Beobachtung bleibt die Auswertungszeit `null`; noch nicht ausgewertete Geräte werden nicht als gesund oder nie gemeldet behauptet. `externalDeliveryVerified`, `runtimeIntegrated`, `productionFleetVerified` und `sealed` bleiben `false`.

Standardgrenzen: 1.000 offene Kandidaten, 10.000 Journalaktionen und 32 MiB; keine stille Verdrängung oder automatische Kompaktierung. Die API erlaubt 1–10.000 offene Kandidaten. Bei Kapazitätsüberschreitung wird die gesamte neue Beobachtung abgewiesen. Eine Registry mit 1.000 nie gemeldeten Geräten kann schon beim ersten Lauf 1.000 Hinweise erzeugen; vor weiteren Alarmen ist dann bestätigte Übernahme erforderlich. Auch gesunde Auswertungen belegen Journalaktionen, weshalb Pollingfrequenz, Kapazitätsüberwachung und freigegebene Archivierung einzuplanen sind.

Die API `HeartbeatAlerts.verifyJournal(content, publicOptions)` und CLI `verify` benötigen nur öffentliche Schlüssel. Sie prüfen **das Alarmwriterjournal und dessen fachliche Übergänge**, ohne Writer-Lock und auch neben einem aktiven Writer. Die Original-Gerätesignaturen werden beim Lesen des Alarmjournals nicht erneut geprüft: `verification.sourceDeviceEvidenceReverified` ist ausdrücklich `false`. Die Quelle wurde bei `observe` geprüft; unabhängige Originalprüfung erfordert zusätzlich das referenzierte Heartbeat-Journal mit passendem historischen Präfix und der vertrauenswürdigen Konfiguration. JSON-Ausgaben sind unsignierte Projektionen und kein SEALED-Beleg.

Es werden keine URLs, Nachrichten, Zugangsdaten oder vollständigen Heartbeat-Envelopes ins Alarmjournal übernommen. Gerätekennungen und Verbrauchernamen können personenbezogen sein. Unternehmensrollen, Daten-/Aufbewahrungsfreigaben, produktive Rotation/Archivierung, tatsächliche Zustellung und reale Flottenabnahme bleiben offen. Der neue Node-Baustein liegt außerhalb des XPI; Extension 1.22.0 bleibt unverändert.

Validierung: 836 Tests erfolgreich, darunter 13 neue Prüfungen für Fristgrenzen, Dämpfung/Eskalation/Erholung, Replay/Quellforks, Mehrgeräte-Atomizität, Kapazität, Uhrfehler, fsync-Recovery, Bestätigung und CLI/Public-Key-Reader. Vollständiges `npm run check` erfolgreich; 0 Lintfehler und 24 bestehende Thunderbird-Warnungen. Die 40 XPI-Dateien sind bytegleich mit v1.22.0.
