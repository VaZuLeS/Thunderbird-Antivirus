# Evidenzprüfung mit separatem Witness-Checkpoint

Stand: 14. Oktober 2026. Dieser Repository-Baustein ergänzt den [lokalen Service](ENTERPRISE_LOKALER_SERVICE.md) und die [Broker-Outbox](ENTERPRISE_OUTBOX.md) um vollständigere Offline-Prüfung, signierte Server-Checkpoints und eine separat gestartete Witness-Ablage.

Ein veränderbares Journal kann intern korrekt sein, obwohl seine letzten gültigen Datensätze entfernt wurden. Die bisherige Signatur-/Hashprüfung erkennt diesen Fall allein nicht. Ein **separat vertrauenswürdig gepinnter Checkpoint** hält dagegen die erwartete Anzahl und den damaligen Kettenkopf fest. So wird ein kürzerer Export oder ein abweichender Verlauf erkennbar.

**Das bleibt STAGED.** Auch ein unabhängig bezeugter Kettenkopf ist kein Object Lock, keine WORM-Ablage, kein SEALED-Commit und keine automatische Freigabe für den Broker. Outbox-Payloads werden weiterhin vollständig behalten. Es werden keine realen Linkereignisse aus Thunderbird übertragen.

## Welche Aussagen geprüft werden

| Prüfung / Reportfeld | Bedeutung |
|---|---|
| `verified` | Alle gelieferten Datensätze haben gültige Serverquittungen, Hashbindungen, IDs, Sequenzen und zulässige Entscheidungsübergänge |
| `deviceSignaturesVerified` | Zusätzlich wurden Gerätesignaturen gegen eine ausdrücklich übergebene Public-Key-Registrierung geprüft |
| `witnessVerified` | Witness-Signatur, gepinnter aktueller Anchor-Hash und eingebetteter Server-Checkpoint passen |
| `anchoredEntryCount` | Anzahl durch den geprüften Witness-Checkpoint abgedeckter Datensätze |
| `unanchoredSuffixCount` | Nachtrag hinter dem bezeugten Präfix; dessen Vollständigkeit ist nicht durch diesen Checkpoint geschützt |
| `completeSnapshotWitnessed` | Exportanzahl und Kettenkopf entsprechen genau dem bezeugten Snapshot; bei einem leeren Snapshot ausdrücklich null Datensätze |
| `sealed` | Immer `false` in diesem Entwicklungsbaustein |

Der Prüfer erwartet den vollständigen Export ab Journalanfang; gefilterte Teilansichten sind keine prüfbaren Gesamtsnapshots. Ohne Witness bleibt ein korrekt signierter verkürzter Präfix grundsätzlich möglich; der Report meldet dann weder `witnessVerified` noch `completeSnapshotWitnessed`. „Signaturen gültig“ ist keine Vollständigkeitsbehauptung.

Bei übergebener Registrierung wird ein fehlender, falscher oder abweichender Geräteschlüssel abgewiesen. Eine ausdrücklich angeforderte, aber beschädigte Registrierung wird nicht stillschweigend ausgelassen. Historisch widerrufene, weiterhin bekannte Schlüssel können alte Signaturen prüfen; daraus folgt keine aktuelle Öffnungs-/Geräteberechtigung. Policy-, Rollen- und Identitätsfreigaben sind weiterhin eigene Unternehmensprüfungen.

## Vertrauensmodell

1. Server-Public-Key und Key-ID stammen aus einem freigegebenen Kanal, nicht aus dem zu prüfenden Export.
2. Der Service signiert einen Checkpoint mit Quell-ID, Anzahl, letztem Receipt-Hash, STAGED-Status und Erstellungszeit.
3. Ein separat gestarteter Witness prüft Export und Server-Checkpoint sowie die Erweiterung seines bisher bezeugten Präfixes.
4. Der Witness besitzt einen eigenen Ed25519-Schlüssel. Sein signierter Anchor enthält den Server-Checkpoint, eine Witness-Sequenz, den vorherigen Anchor-Hash und die Witness-Zeit.
5. Der Betreiber hält den **aktuellen Witness-Hash und Witness-Public-Key separat** fest. Beim nächsten Fortschreiben muss der erwartete vorige Hash passen; beim Offline-Prüfen muss der bekannte aktuelle Hash passen.

Alle Hashangaben für Checkpoints/Anchors sind SHA-256 über die JCS-kanonisierten JSON-Dokumente, **keine** SHA-256-Checksummen der formatierten Datei. Umformatieren verändert diesen Inhaltshash nicht. Signaturen umfassen wie bei Geräte-/Servernachweisen `{keyId, payload}`.

Ein Export kann keine Public Keys oder Trustwerte für sich selbst deklarieren. Den erwarteten Witness-Hash nachträglich aus einer gerade angegriffenen Export-/Anchor-Datei zu berechnen würde den Vollständigkeitsschutz aufheben. Ein alter gültiger Anchor schützt nur seinen damaligen Stand; für den neuesten bekannten Snapshot ist der separat bekannte aktuelle Hash notwendig.

Die Quell-ID ist in dieser Version der Fingerprint des Server-Public-Keys. Ein Server-Key gehört zu genau einer Journalidentität; Wiederverwendung in anderen Journalen und Schlüsselrotation/Migration sind noch nicht unterstützt.

## Schnellstart mit synthetischen Daten

Voraussetzungen: Node ≥ 20, `npm ci`, Linux/POSIX mit `fsync`. Service und Witness müssen für ihre jeweiligen CLI-Ablagen gestoppt bzw. exklusiv geöffnet sein. Neue private Testverzeichnisse verwenden.

```sh
npm run enterprise:local -- init --data-dir /tmp/thundy-evidence-service
npm run enterprise:local -- demo --data-dir /tmp/thundy-evidence-service
npm run enterprise:local -- export --data-dir /tmp/thundy-evidence-service --out /tmp/thundy-events.json
npm run enterprise:local -- checkpoint --data-dir /tmp/thundy-evidence-service --out /tmp/thundy-checkpoint.json
```

Einen separat gestarteten Witness initialisieren. Er erhält nur den Server-Public-Key, nicht den Server-Private-Key:

```sh
npm run enterprise:witness -- init --directory /tmp/thundy-independent-witness --server-public-key /tmp/thundy-evidence-service/server-public.pem --server-key-id local-server-1
npm run enterprise:witness -- append --directory /tmp/thundy-independent-witness --export /tmp/thundy-events.json --checkpoint /tmp/thundy-checkpoint.json --expected-head genesis --registry /tmp/thundy-evidence-service/config.json --out /tmp/thundy-witness-anchor.json
```

Der letzte Befehl gibt `anchorHash`, `anchorIndex`, `entryCount` und einen Duplikatmarker zurück. Den Hash zusammen mit dem Witness-Public-Key durch den vorgesehenen unabhängigen Betreiberkanal festhalten. Im folgenden Befehl `BEKANNTER_WITNESS_HASH` durch genau diesen separat bekannten Hexwert ersetzen:

```sh
npm run enterprise:local -- verify --out /tmp/thundy-events.json --public-key /tmp/thundy-evidence-service/server-public.pem --server-key-id local-server-1 --registry /tmp/thundy-evidence-service/config.json --witness-anchor /tmp/thundy-witness-anchor.json --witness-public-key /tmp/thundy-independent-witness/witness-public.pem --expected-anchor-hash BEKANNTER_WITNESS_HASH
```

Erwartung: `entryCount: 6`, `anchoredEntryCount: 6`, `completeSnapshotWitnessed: true`, `sealed: false`. Entfernen eines gültigen letzten Datensatzes führt mit diesem Anchor zu einem Fehler, obwohl der verkürzte Präfix für sich weiterhin gültige Signaturen hätte.

Für weitere Ereignisse einen neuen Export und Checkpoint in neue Dateien schreiben. `append` verlangt dann `--expected-head` mit dem zuletzt separat festgehaltenen Hash. Es prüft den alten bezeugten Präfix gegen den neuen Export, bevor der Witness-Kopf weitergeht. Keine vorhandenen Dateien oder Identitätsverzeichnisse überschreiben.

## Snapshot und Präfix bewusst unterscheiden

Standard ist die strikte Snapshot-Prüfung: Ein Export muss genau zur Anzahl und zum Kettenkopf des gepinnten Anchors passen. Ein neuerer Export mit noch nicht bezeugtem Nachtrag ergibt `EVIDENCE_SNAPSHOT_COUNT_MISMATCH`.

Nur wenn ausdrücklich ein alter bezeugter Präfix innerhalb eines neueren Exports geprüft werden soll, zusätzlich `--coverage prefix` verwenden. Alle gelieferten Datensätze werden weiterhin auf Signaturen und Semantik geprüft; der Report weist den noch nicht bezeugten Nachtrag gesondert aus und meldet `completeSnapshotWitnessed: false`. Präfixmodus ohne kompletten Witness-Vertrauenskontext ist verboten.

Ohne Anchor funktioniert die bisherige Prüfung weiter:

```sh
npm run enterprise:local -- verify --out /tmp/thundy-events.json --public-key /tmp/thundy-evidence-service/server-public.pem
```

Sie gibt jetzt einen strukturierten JSON-Report statt der früheren einzeiligen Signaturmeldung aus. `--registry` ergänzt die Gerätesignaturprüfung. Ohne Registrierung bezeugt der Server lediglich die Hashbindung der gelieferten Geräte-Envelopes; deren Gerätesignaturen werden nicht als unabhängig geprüft ausgewiesen.

## Dauerhaftigkeit und Recovery

Witness-Verzeichnis 0700, private Dateien 0600, exklusiver `witness.lock`. Signed Anchors werden in `anchors.jsonl` erst nach vollständigem Write und `fsync` bestätigt. Dateianlage und Verzeichnisse werden ebenfalls synchronisiert. Grenzen: 10.000 Anchors / 16 MiB Log; keine automatische Kürzung oder Ersetzung.

Beim Start werden Signaturen, Quellenbindung, Witness-Sequenzen, vorherige Hashes und Zeitfolge erneut geprüft. Ein unvollständiges Ende oder beschädigter Datensatz stoppt Recovery. Ein abgeschnittenes, ansonsten gültiges Witness-Log wird spätestens gegen den separat vorgegebenen erwarteten aktuellen Kopf abgewiesen; intern gültige Signaturen allein erkennen auch beim Witness kein entferntes Kettenende.

Nach abruptem Prozessende alle Witness-Prozesse stoppen, Zustand prüfen, Ablage sichern und erst dann einen nachweislich verwaisten Lock entfernen. Keine aktive Schreibsperre entfernen, kein Journal automatisch kürzen. Schlüssel, öffentliche Trustwerte und externe Kopf-Pins erhalten.

Bei verlorener Antwort oder Fehler beim Schreiben der Anchor-Ausgabedatei kann der letzte Append bereits dauerhaft erfolgt sein. Exakt denselben Checkpoint und Export mit demselben erwarteten Vorgänger sowie einem neuen Ausgabedateinamen erneut übergeben. Der Witness gibt den bereits erzeugten Anchor unverändert als Duplikat zurück. Ein veränderter Checkpoint oder ein beliebig alter Kopf erhält dadurch keine Fortschreibungsberechtigung.

## Grenzen und Prüfbelege

Die Demo verwendet unterschiedliche Schlüssel und Verzeichnisse, aber denselben lokalen OS-Betreiber. Zwei Ordner allein schaffen keine unabhängige Vertrauensgrenze. Unternehmensbetrieb benötigt getrennte Betreiber-/Zugriffsrechte bzw. Host-/Dienstgrenzen und einen freigegebenen externen Pin-Kanal. Sind Witness-Key **und** externer aktueller Pin kompromittiert, ist dieses Vertrauensmodell nicht ausreichend.

Die lokale Witness-Zeit ist keine qualifizierte Zeitstempelstelle. Es gibt keine öffentliche Verankerung, Cloud-Object-Lock-Verifikation, Keyrotation, Retention-/Legal-Hold-Integration oder SEALED-Freigabe. Unternehmensrollen/SSO und die tatsächliche Thunderbird-/OS-Anbindung bleiben offen. Native Kontextmenüöffnungen werden durch diesen Baustein ebenfalls nicht nachträglich erfasst.

20 neue Tests prüfen vollständige Server-/Gerätenachweise, gültiges Abschneiden, Veränderungen/Auslassungen/Reihenfolge, signierte semantische Fehler, Forks, alte Anchor-Rollbacks, Snapshot-/Präfixabgrenzung, falsche oder unvollständige Trustwerte, Witness-Log-Rollback, verlorene Antworten, Syncfehler, kurze Writes, echten Prozessabbruch, Kapazität, private Rechte, Zeitfolge und den gesamten CLI-Ablauf sowie die Abweisung nicht unterstützter Prüfoptionen. Die Broker-Outbox verwirft auch danach keine STAGED-Payloads.

[Status aller Enterprise-Arbeitspakete](ENTERPRISE_UMSETZUNGSSTAND.md). Nächste Stufe: produktive Speicheradapter und prüfbarer SEALED-Commit; anschließend kontrollierte Broker-Freigabe sowie geschütztes Enrollment/Native Messaging.
