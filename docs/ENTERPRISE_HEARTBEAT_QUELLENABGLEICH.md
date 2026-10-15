# Unabhängiger Abgleich von Alarm- und Original-Gerätejournal

Stand: 15. Oktober 2026. N15 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ergänzt einen Public-Key-Abgleich der [Alarmhistorie](ENTERPRISE_HEARTBEAT_ALARME.md) mit dem referenzierten [Original-Heartbeat-Journal](ENTERPRISE_HEARTBEATS.md). Der Leser vertraut nicht allein den Aussagen des Alarmwriters: Er prüft Original-Geräte- und Quellwritersignaturen und vergleicht sämtliche historischen Meldestände zu ihren damaligen Quellenpräfixen und Auswertungszeiten.

Dies ist eine lokale Testgeräte-Evidenzprüfung. Gerätemeldungen bleiben Selbstauskünfte registrierter Schlüssel. Kein physisches Gerät, keine produktive Flotte, SSO-Identität, externe Zustellung oder SEALED-Ablage wird dadurch abgenommen.

## Verwendung mit öffentlichen Schlüsseln

```sh
npm run enterprise:heartbeat-alerts -- verify \
  --config /srv/trust/heartbeat-alert-config.json \
  --journal /srv/local/heartbeat-alerts/actions.jsonl \
  --source-journal /srv/local/heartbeats/actions.jsonl \
  --expected-head UNABHAENGIG_BEKANNTER_ALARM_SHA256 \
  --expected-source-head UNABHAENGIG_BEKANNTER_QUELL_SHA256 \
  --out /srv/review/heartbeat-source-comparison.json

npm run enterprise:heartbeat-alerts -- review \
  --config /srv/trust/heartbeat-alert-config.json \
  --journal /srv/local/heartbeat-alerts/actions.jsonl \
  --source-journal /srv/local/heartbeats/actions.jsonl \
  --expected-head UNABHAENGIG_BEKANNTER_ALARM_SHA256 \
  --expected-source-head UNABHAENGIG_BEKANNTER_QUELL_SHA256 \
  --lang de --out /srv/review/heartbeat-source-comparison-de.html
```

Die öffentliche Alarmkonfiguration aus N13/N14 verweist auf die öffentliche Heartbeat-Konfiguration und Registry. Keine privaten Schlüssel und keine Writer-Locks erforderlich; beide Writer können geöffnet bleiben. Die Prüfung verändert weder Originaljournale noch Locks. Neue Ausgaben erhalten Modus 0600; bestehende Dateien werden nicht überschrieben.

Beide Pins sind optional und durch unabhängig bekannte tatsächliche Hashes zu ersetzen. `--expected-head` bindet das Alarmjournal. `--expected-source-head` bindet das **gesamte mitgelieferte Quelljournal**, einschließlich eventuell späterer Aktionen. Er ist nicht automatisch der historische Quellhash eines einzelnen Kandidaten. Ein Quell-Pin ohne `--source-journal` wird bei `verify`/`review` abgewiesen.

Ohne `--source-journal` bleibt die bisherige reine Alarmjournalprüfung unverändert: Original-Geräteevidenz wird dabei nicht erneut geprüft. Wird eine Quelle angegeben, führen fehlende, beschädigte oder widersprüchliche Daten zum Abbruch; es gibt keinen Rückfall auf eine scheinbar erfolgreiche Prüfung ohne Quelle. JSON-/HTML-Projektionen werden nicht als Originaljournale akzeptiert.

## Was tatsächlich abgeglichen wird

1. Das Alarmjournal wird einschließlich Signaturen, Hashkette, Scope, Regelversion, Dämpfung, Zustandswechseln und Bestätigungen unabhängig wiederholt. Kandidaten werden aus dem geprüften Verlauf rekonstruiert.
2. Jede `HEARTBEATS_OBSERVED`-Aktion liefert die referenzierte Aktionszahl, den historischen Quell-Endhash, den damaligen Auswertungszeitpunkt und die vollständigen damaligen Gerätestände.
3. Das Original-Heartbeat-Journal wird einmal vollständig wiederholt. Jede ursprüngliche Gerätesignatur und jede Quellwritersignatur wird geprüft, einschließlich Organisations-/Geräte-/Policy-/Epochbindung, Sequenzen, Zeitfolge und Clock-Skew.
4. An jeder referenzierten Aktionsposition wird der Gerätestand zum damaligen Auswertungszeitpunkt berechnet und exakt verglichen: Schlüssel-/Gerätekennung, Zustand, Annahme-/Gerätezeit und Sequenz. Wiederholte Beobachtungen desselben Präfixes werden mit ihren jeweiligen Zeiten ausgewertet; eine später verspätete Meldung wird nicht rückwirkend als damals verspätet behandelt.
5. Sämtliche historischen Quellhashes werden mit der geprüften Originalkette verglichen. Ein passender letzter Hash allein reicht nicht aus. Bestätigungen und Kandidatenbezüge folgen aus der geprüften Alarmregel-Rekonstruktion.

Der nächste signierte Quellrecord bindet den Hash seines Vorgängers; für das letzte Präfix wird der vollständig geprüfte Endhash verwendet. So werden Quelle und Signaturen nicht für jede Beobachtung von vorn gelesen. Die Anzahl der Zustandsvergleiche bleibt ausdrücklich begrenzt.

Abgewiesen werden insbesondere fehlende Präfixe, gültig signierte alternative Quellketten, falsche Zwischenhashes trotz passendem Endhash, erfundene historische Zeit-/Sequenzangaben und ungültige Gerätesignaturen trotz neu signiertem Quellwriterjournal. Eine Quellenposition, die noch zukünftige Annahmen relativ zum damaligen Auswertungszeitpunkt enthält, ist ebenfalls ungültig.

## Spätere Quellenaktionen und leere Historien

Das mitgelieferte Quelljournal darf nach der letzten Alarmbeobachtung gewachsen sein. Spätere Aktionen werden vollständig geprüft, ändern aber keine historischen Alarm- oder Gerätestände. Ihr Umfang erscheint als `unreferencedSourceActions`. Auch ein beschädigter, nicht von Alarmen referenzierter Quellanhang bricht die Prüfung ab.

Leere Journale und nie gemeldete Geräte werden nicht zu einem Nachweis tatsächlichen Gerätekontakts:

| Fall | `comparisonComplete` | `sourceDeviceEvidenceReverified` |
|---|---|---|
| Beide Journale leer | `true` nach erfolgreicher Prüfung der leeren Eingaben und Trustkonfiguration | `false` |
| Nur Beobachtungen ohne Original-Gerätemeldung | `true`, Gerätestände `NEVER_SEEN`/`REVOKED` werden abgeglichen | `false` |
| Keine Alarmbeobachtung, aber später vorhandene Quelldaten | `true`, Quelle vollständig geprüft, keine historische Verknüpfung behauptet | `false` |
| Historische Beobachtungen mit referenzierten Original-Gerätemeldungen | `true` nach vollständigem Abgleich | `true` |

`sourceJournalSignaturesVerified` und `sourceDeviceSignaturesVerified` bedeuten, dass alle in der mitgelieferten Quelle enthaltenen Signaturen gültig sind; bei einer leeren Quelle wurden keine Meldungen erfunden. Die zusätzliche Referenzprüfung und der Evidenzindikator unterscheiden diesen Fall ausdrücklich.

## Report und sechssprachige Darstellung

`HeartbeatAlerts.verifyWithSource(alarmContent, sourceContent, publicOptions)` liefert die bisherigen Geräte-/Kandidatenstände und zusätzlich `sourceComparison`:

- `observationCount`: Anzahl aller abgeglichenen Beobachtungen, einschließlich solcher ohne neuen Kandidaten.
- `deviceComparisonCount`: Zustandsvergleiche über alle Beobachtungen; kein Zähler unterschiedlicher Geräte oder Signaturen.
- `referencedSourceActionCount` und `unreferencedSourceActions`: referenzierter Quellenpräfix bzw. vollständig geprüfte zusätzliche Quellaktionen.
- `sourceJournalHead`, `sourceActionCount`, `sourceSignerFingerprint`, `sourceHeadPinned`: geprüfter Stand der gesamten mitgelieferten Quelle und externer Pinstatus.
- `comparisonComplete`, `sourceJournalSignaturesVerified`, `sourceDeviceSignaturesVerified`, `sealed: false`: Umfang und Grenze des erfolgreichen Abgleichs.

Der Bericht setzt `verification.sourceDeviceEvidenceReverified` nur dann auf `true`, wenn mindestens eine Beobachtung und tatsächlich referenzierte Original-Gerätemeldungen vorhanden sind. `externalDeliveryVerified`, `runtimeIntegrated`, `productionFleetVerified` und `sealed` bleiben `false`.

Die [sechssprachige Alarmreview](ENTERPRISE_HEARTBEAT_ALARMREVIEW.md) zeigt den erweiterten Prüfumfang und die Quellenreferenzen in Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch. Reiner Alarmjournalmodus, vollständiger Quellenabgleich und Abgleich ohne referenzierte Gerätemeldungen sind sprachlich getrennt. Der vollständige minimierte Download enthält die Prüfmetadaten; unbekannte Zusatzfelder werden ausgelassen. Filter oder Seiten ändern den Download nicht.

HTML und JSON bleiben unsignierte Projektionen. Ein verändertes HTML prüft sich nicht selbst. Für eine neue unabhängige Prüfung Originaljournale und unabhängig vertrauenswürdige öffentliche Konfiguration verwenden. Selbst gelesene Hashes oder mitgelieferte Schlüssel schaffen keinen unabhängigen Vertrauensanker. Werden beide Journale passend auf einen gültigen gemeinsamen Anfang gekürzt, ist dies ohne unabhängige Pins nicht allgemein erkennbar. SEALED, Retention, Restore und Schlüsselverteilung werden nicht bestätigt.

## Grenzen und API

CLI: höchstens 32 MiB und 10.000 Aktionen je Originaljournal. Der Quellenabgleich unterstützt höchstens 10.000 Beobachtungen, 1.000 Registrygeräte und insgesamt 200.000 Gerätestandsvergleiche. Überschreitungen werden explizit abgewiesen, nicht still gekürzt. Die HTML-Grenze von 10.000 Kandidaten bleibt zusätzlich bestehen.

`Heartbeats.verifyCheckpoints(sourceContent, {...publicSourceOptions, checkpoints})` ist der unterliegende Public-Key-Prüfer. Jeder Checkpoint hat genau `{actionCount, head, evaluatedAt, devices}`; die Geräte enthalten genau `{keyId, deviceId, status, receivedAt, observedAt, sequence}`. Checkpoints sind nach streng steigender Auswertungszeit und nicht abnehmender Quellaktionszahl geordnet. Ohne vorherige Alarmjournalprüfung beweist ein selbst angegebener Checkpoint nicht dessen Herkunft; dafür `HeartbeatAlerts.verifyWithSource` verwenden.

N15 liegt außerhalb des XPI. Extension 1.22.0 bleibt unverändert. Ein [transportables Reviewpaket](ENTERPRISE_REVIEWPAKET.md) mit Originaljournalen und getrennt vertrauenswürdiger Konfiguration ist als N16 lokal implementiert; Unternehmensbetrieb und produktive Freigaben bleiben separat offen.

Validierung: 865 Tests erfolgreich, darunter 18 neue Prüfungen für beide Signaturketten, historische Präfixe, falsche Zwischenhashes/Zeiten, alternative Quellen, ungültige Gerätesignaturen trotz neu signiertem Writer, spätere Quellaktionen, Leerfälle, Ressourcenlimits, sechs Sprachen und CLI. 48 Chromium-Kombinationen einschließlich vollständiger Downloads erfolgreich. Vollständiges `npm run check` erfolgreich; 0 Lintfehler und 24 bestehende Thunderbird-Warnungen. Alle 40 XPI-Dateien sind bytegleich mit v1.22.0.
