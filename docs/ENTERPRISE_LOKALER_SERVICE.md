# Lokaler Enterprise-Aufnahmeservice und Admin-Prüfung

Stand: 14. Oktober 2026. Dies ist ein **ausführbarer Entwicklungsbaustein im Repository**, kein produktiver Enterprise-Dienst und keine neue Thunderbird-Runtime. Er setzt Teile von C03/C04/E01/I02 um und ergänzt die [optionalen Systemprofile](ENTERPRISE_SYSTEMPROFILE.md). Die Extension 1.21.0 überträgt weiterhin keine Linkereignisse an diesen Service.

## Was bereits funktioniert

- Geräteereignisse mit Ed25519-Signaturen über kanonisierte `{keyId, payload}`-Dokumente; Organisation, Gerät, Epoche und Policybindung stammen aus der lokalen Registrierung.
- Ereignisschema v2, Domain-only und separate lokale Scores/Anbieterurteile. Pfad, Query, Fragment und Benutzerinfo werden nicht angenommen.
- Strikte Streamsequenzen und Entscheidungsübergänge: `CLICKED → OPEN_INTENT → OPENED/OPEN_ERROR`, Abbruch/Sperre aus offenen Zuständen, erneuter Versuch nur nach Öffnungsfehler. Spätere Bewertungen verändern keine historischen Entscheidungsereignisse.
- Einzelquittungen, Teilerfolg im Batch und idempotente Wiederholung. Gleiche ID/Inhalt erhält exakt dieselbe Quittung. Veränderte Inhalte derselben ID ergeben `409`.
- Append-only-JSONL-Journal, exklusiver Writer-Lock und `fsync` vor Bestätigung; beim Start Datei-/Verzeichnis-Synchronisation und erneute Signatur-/Scope-/Sequenz-/Kettenprüfung. Keine automatische Kürzung beschädigter Daten.
- Signierte **STAGED**-Quittungen mit Payload-/Envelope-Hash, organisationsgebundener Gerätekennung, Sequenz, Empfangszeit, Eingangs-ID und Verkettung. Clientzeiten mit mehr als fünf Minuten Abweichung erhalten `CLIENT_CLOCK_SKEW`.
- Geschütztes Receipt-Polling mit Gerätesignatur, Zeitfenster und Nonce. Ein Gerät kann keine Nachweise anderer Geräte/Organisationen abrufen.
- Offline-Admin-HTML in EN/DE/FR/ES/IT/PL: Domain-/Entscheidungs-/Scorefilter, Seiten mit höchstens 50 Interaktionen, Score und Anbieterurteil bei Entscheidung getrennt vom aktuellen Score, Client-/Empfangszeit und Nachweisstatus. Hochriskante Öffnungen bleiben sichtbar, auch wenn der spätere Score sinkt.
- JSON-Evidenzexport und unabhängig aufrufbarer Prüfer für Serverquittungs-Signaturen, Hashbindungen und Verkettung mit einem separat vertrauenswürdig bezogenen Public Key.

**STAGED ist kein SEALED.** Die Quittung erlaubt dem späteren Broker weder das Entfernen der Payload aus seiner Outbox noch die Freigabe eines Öffnungswunsches bei `requireSealedIntent`. Es gibt noch keinen Object-Lock-Commit. Erfolgreich gemeldete Browserübergaben sind Angaben des registrierten Geräts, keine serverseitig bewiesenen Webseitenbesuche.

## Schnellstart mit synthetischen Daten

Voraussetzungen: Node ≥ 20, `npm ci`, POSIX-Dateisystem mit funktionierendem `fsync`; getestet in Linux. Der lokale Prototyp unterstützt noch kein Windows-Storage. Kein Docker, Cloudkonto oder Herstellerprofil ist notwendig.

```sh
npm run enterprise:local -- init
npm run enterprise:local -- demo
npm run enterprise:local -- review --lang de --out /tmp/thundy-enterprise-review.html
npm run enterprise:local -- export --out /tmp/thundy-staged-records.json
npm run enterprise:local -- verify --out /tmp/thundy-staged-records.json --public-key enterprise/.local/server-public.pem
npm run enterprise:local -- serve --port 8766
```

Die HTML-Datei direkt im Browser öffnen. `demo` schreibt sechs eindeutig **synthetische** Ereignisse: eine risikoreiche Öffnung mit später sinkendem Score und einen Abbruch ohne bekannten Score. Weitere Demoläufe erzeugen neue Interaktionen mit fortgesetzter Sequenz. Es werden keine realen Links geöffnet.

`init` erzeugt eine neue geschützte lokale Ablage und Ed25519-Schlüssel für genau einen Entwicklungsclient und den Service. Vorhandene Verzeichnisse oder Exportdateien werden nicht überschrieben. Standardablage `enterprise/.local/` ist aus Git und XPI ausgeschlossen; `--data-dir` erlaubt ein anderes, neu anzulegendes privates Verzeichnis. Private Dateien haben Modus 0600, das Verzeichnis 0700. Vorhandene Ablagen mit Gruppen-/Weltrechten oder fremdem Eigentümer werden abgewiesen. Für eine Server-/Clienttrennung ist das spätere Enrollment zu implementieren; die Demoinitialisierung ersetzt es nicht.

Review/Export und Demo benötigen denselben exklusiven Writer-Lock. Deshalb den Service vorher mit SIGINT/SIGTERM sauber stoppen. Dies ist keine laufende Mehrbenutzer-Adminoberfläche. Exportdateien enthalten Domain-/Geräteinformationen und gehören nur in freigegebene Ablagen. Der Exportbutton in der HTML-Ansicht exportiert sämtliche enthaltenen Quelldatensätze; Filter betreffen nur die Tabellenansicht.

## Lokale API

`serve` bindet ausschließlich `127.0.0.1`. Hostheader müssen exakt zur Loopback-Adresse und zum Port passen. Browser-Origin-Anfragen sind verboten; es gibt kein CORS und keine Admin-HTTP-Route. Nicht über Reverse Proxy/Tunnel als Unternehmensdienst freigeben.

| Route | Vertrag |
|---|---|
| `POST /v1/device/events:batch` | JSON `{ "events": [signedEnvelope, ...] }`, 1–100 Einträge, höchstens 256 KiB, einzelne Envelope höchstens 32 KiB |
| `GET /v1/device/receipts/{eventId}` | `Authorization: Thundy-Signature <base64url(JSON-envelope)>`, signierter Payload `{ purpose: "receipt-read", eventId, issuedAt, nonce }` |

Die Signatur umfasst JCS-Bytes von `{keyId, payload}`, nicht nur die Event-Payload. Die Signatur ist ungepaddetes base64url. Registrierte, nicht widerrufene Geräteschlüssel müssen zum Payload passen. Gerätedaten dürfen keine Organisation für die Zuordnung erfinden. Schemafelder/Policyversion werden geprüft; dies ist noch keine komplette serverseitige Policy-Auswertung.

Batchantwort: je Eintrag HTTP-artiger `status`, bei Erfolg `duplicate` und `receipt`, sonst stabiler Fehlercode. HTTP 200 bei Gesamterfolg, 207 bei Teilfehlern, 409 bei mindestens einem Konflikt. Auch bei 409 können andere Einträge angenommen worden sein; der Client muss die Einzelergebnisse auswerten. Nach einem Sequenzfehler folgen spätere Streamereignisse erst, wenn das fehlende Ereignis zugestellt ist.

Receipt-Anfragen gelten ±120 Sekunden; Nonces werden für das Zeitfenster im Prozess gespeichert. Nach Neustart ist dieser Lesereplay-Schutz neu; Lesereplay kann keine Ereignisse erzeugen. Exakt wiederholte signierte Ereignisse bleiben bewusst zustellbar. Kein automatischer Enrollment-/Rotation-/Revocation-Endpunkt; Änderungen der lokalen Registrierung werden beim Neustart gelesen. Historische Events bleiben mit einem widerrufenen, weiterhin vorhandenen Public Key prüfbar. Entfernte historische Schlüssel oder nicht unterstützte Policy-/Server-Keyrotation verhindern Recovery und benötigen eine spätere Migrationsimplementierung.

## Ablage, Fehler und Recovery

Standardgrenzen: 10.000 Events oder 16 MiB Journal. Vollstand meldet `JOURNAL_CAPACITY`, löscht keine Evidenz und erlaubt Wiederholung bereits gespeicherter Events. Es gibt noch keine produktive Retention, Archivierung, Dead-Letter-Ablage oder Backlogverwaltung.

Schreib-/Syncfehler liefern **keine Erfolgsquittung** und sperren den Writer bis zum Neustart. Ein vollständiger, aber noch nicht bestätigter Datensatz kann nach Recovery bereits vorliegen; Wiederholung erhält dann die rekonstruierte ursprüngliche Quittung. Ein unvollständiger Journalschwanz, manipulierte Signatur oder ungültige Zustandsfolge sperrt den Start.

Nach abruptem Prozessabbruch bleibt `writer.lock` absichtlich erhalten. Recovery: alle Serviceprozesse stoppen, Prozessstatus und Lockinhalt als Betreiber prüfen, Ablage vollständig sichern und erst danach den verwaisten Lock entfernen. Danach normal starten; der Start prüft das ganze Journal. Niemals automatisch `events.jsonl` kürzen oder einen Lock eines aktiven Writers entfernen. Beschädigte Ablagen zunächst separat analysieren; dieses Werkzeug bietet noch keine automatische Reparatur.

Die Synchronisation wurde mit kurzen Writes, Syncfehlern und echtem Prozessabbruch getestet. Hardware-/Dateisystemgarantien, Stromausfall und replizierte Unternehmensablage sind damit nicht abgenommen. Ein [separater Witness mit extern gepinntem Kopf](ENTERPRISE_EVIDENZPRUEFUNG.md) ergänzt jetzt die Offline-Prüfung gegen abgeschnittene Enden. Die Datei bleibt für ihren OS-Eigentümer veränderbar. Signaturen erkennen veränderte Datensätze; ohne unabhängigen externen Checkpoint erkennen sie nicht das Entfernen eines gültigen Kettenendes. Ein Angreifer mit Server-Private-Key kann neue Serverquittungen signieren. Exportprüfung beweist die signierte Serveraussage und Hashbindung, keine unabhängige Wahrheit eines kompromittierten Clients.

## Prüfungen und nächste Schritte

24 neue Tests: 10.000 Duplikatzustellungen, Scope/Revocation, Konflikte, Sequenzlücken, voreiliges `OPENED`, Retry nach Öffnungsfehler, späte Bewertung, Abbruch, Writer-Lock, volle Ablage, kurze Writes, Syncfehler, beschädigte Journale, echter Prozessabbruch, fremde Geräte/Organisationen, private Dateirechte, Byte-/Batchgrenzen, Pagination, Receipt-Polling, reale Loopback-HTTP-Batches, sechssprachige Adminansicht und CLI-Evidenzprüfung. Ergänzend 24 Chromium-Layoutfälle über einen Loopback-Preview bei 360/1200 Pixeln und Light/Dark, mit echter Offline-CSP und synthetischen Daten.

Ergänzung: Eine [persistente lokale Broker-Outbox mit Zustellung bis zur Admin-Review](ENTERPRISE_OUTBOX.md) ist jetzt implementiert.

Nächste Schritte: geschützter OS-Endpoint-Broker/Enrollment und SEALED-Verifikation; transaktionaler Unternehmens-Ingest; signiertes SEALED nach tatsächlichem Object Lock; OIDC-/Rollenprüfung und laufendes Portal; optionale SIEM-/Ticketadapter. Die Herstellerprofile bleiben freie Optionen. [Status aller Arbeitspakete](ENTERPRISE_UMSETZUNGSSTAND.md).
