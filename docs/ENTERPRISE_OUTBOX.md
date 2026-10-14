# Dauerhafte Broker-Outbox und lokale Zustellung

Stand: 14. Oktober 2026. Der separat gestartete **Broker-Prototyp im Repository** erweitert den [lokalen Enterprise-Service](ENTERPRISE_LOKALER_SERVICE.md) um eine signierte, persistente Outbox. Er wird nicht von der Thunderbird-Extension aufgerufen, ist kein installierter Native-Messaging-Host und verwendet weiterhin ausschließlich synthetische Testdaten im beschriebenen Schnellstart.

## Funktionsumfang

- Ereignis und fortlaufende Streamsequenz werden gemeinsam in einem signierten Journal gespeichert; Erfolgsrückmeldung erst nach `fsync`.
- Signierte Queue-/Zustellaktionen, exklusive Schreibsperre, private Dateirechte, vollständige Recoveryprüfung. Eine beschädigte oder unvollständige Ablage stoppt den Start.
- Nach Neustart werden dieselben Event-IDs, Signaturen, Payloads und Sequenzen wiederverwendet. Identische erneute Einlieferung mit stabiler Event-ID erzeugt kein zweites Ereignis.
- Strenge Zustandsprüfung über denselben Transition-Kern wie im Service: Browserübergabe erst nach Öffnungswunsch, Abbruch und späte Bewertung bleiben eigenständig.
- Einzelquittungen und Teilerfolge, exponentieller Backoff mit Jitter, `Retry-After`, persistente Versuchs-/Wiederholungszeiten und begrenzte Batches.
- Quittungen werden gegen den separat fest hinterlegten Server-Public-Key und dessen Key-ID geprüft. Organisation, Gerät, Epoche, Event-ID, Sequenz und beide Inhalts-Hashes müssen übereinstimmen.
- **STAGED bestätigt Annahme, niemals Löschung.** Ereignis und Quittung bleiben auch nach Neustarts in der Outbox. `SEALED` wird abgewiesen, bis eine echte Evidenz-/Verankerungsprüfung implementiert ist. Dieser Prototyp besitzt keine Payload-Retirement-Funktion.
- JSON-Status mit wartenden Events, Retry/STAGED/Dead Letters, Kapazitätswarnung, ältester Aufnahme, Versuchen und stabilen Fehlercodes. Status enthält keine vollständigen URLs, Nachrichtentexte oder Secret-Werte.

## Schnellstart: Queue → Service → Admin-Review

Voraussetzungen: Node ≥ 20, `npm ci`, Linux/POSIX mit funktionierendem `fsync`. **Eine neue, leere lokale Testumgebung verwenden**, damit Broker und Server dieselbe noch unbenutzte Stream-Epoche haben.

```sh
npm run enterprise:local -- init --data-dir /tmp/thundy-broker-demo
npm run enterprise:broker -- demo --data-dir /tmp/thundy-broker-demo
npm run enterprise:broker -- status --data-dir /tmp/thundy-broker-demo
npm run enterprise:local -- serve --data-dir /tmp/thundy-broker-demo --port 8766
```

In einem zweiten Terminal:

```sh
npm run enterprise:broker -- deliver --data-dir /tmp/thundy-broker-demo --origin http://127.0.0.1:8766
npm run enterprise:broker -- status --data-dir /tmp/thundy-broker-demo
npm run enterprise:broker -- poll --data-dir /tmp/thundy-broker-demo --origin http://127.0.0.1:8766
```

Die sechs synthetischen Events wechseln nach erfolgreicher Zustellung zu STAGED; `retainedEvents` bleibt **6**. Es werden keine echten Browserlinks geöffnet. Polling läuft frühestens zur vorgesehenen Prüfzeit, normalerweise nach 60 Sekunden. Anschließend den Service im ersten Terminal sauber stoppen und die bestehende sechssprachige Adminansicht erzeugen:

```sh
npm run enterprise:local -- review --data-dir /tmp/thundy-broker-demo --lang de --out /tmp/thundy-broker-review.html
```

Die HTML-Datei zeigt eine bei hohem Score geöffnete Interaktion mit später niedrigerem Score und eine abgebrochene Interaktion mit unbekanntem Score. Auch EN/FR/ES/IT/PL sind verfügbar.

**Nicht `enterprise:local demo` und `enterprise:broker demo` in derselben Epoche mischen.** Der frühere lokale Demo-Befehl schreibt direkt am Broker vorbei ins Serverjournal. Die Outbox besitzt dessen Sequenzstand nicht und würde zurecht mit einem Konflikt stoppen. Neue Testumgebung verwenden; vorhandene Journale nicht zurücksetzen oder kürzen.

## Ereignisse einliefern

```sh
npm run enterprise:broker -- enqueue --data-dir /tmp/thundy-broker-demo --input /tmp/event.json
```

Die Eingabe ist ein einzelnes Schema-v2-Ereignis ohne `sequence`. Der Broker vergibt die Sequenz; Geräte-/Epochen-/Policyfelder und `schemaVersion: 2` können aus der lokalen Registrierung ergänzt werden. Vorhandene abweichende Scope-Angaben werden abgewiesen. `eventId` ist optional, für idempotente wiederholte Einlieferung muss der Aufrufer jedoch eine stabile UUID verwenden. `interactionId` verbindet Klick, Bewertung, Öffnungswunsch und Entscheidung; ein neues tatsächliches Klicken erhält eine neue Interaktion.

Erforderliche fachliche Felder: `interactionId`, `observedAt`, `kind`, `outcome`, `attemptNumber`, `extensionVersion`, `urlMode: "domain_only"`, `urlRedacted`, vollständiges `assessment` und `reason`. Kein vollständiger Link, Pfad, Query, Fragment oder Benutzerinfo. Ein unbekannter Score bleibt `null`.

`enqueue`, `demo` und `status` lösen **keine Zustellung** aus. `deliver` sendet einen zulässigen Batch; weitere Aufrufe bearbeiten den Rest, sobald die Wiederholungszeit erreicht ist. Es ist noch kein automatisch installierter Hintergrunddienst vorhanden.

## Kapazität, Wiederholung und Dead Letters

Standardgrenzen: **10.000 behaltene Events / 100 MiB gesamtes Outboxjournal**, Warnung ab 80 %. Die Bytegrenze enthält auch signierte Zustellaktionen und Quittungen. Es gibt keine automatische Kürzung, Löschung oder Kompaktierung. Auch STAGED-Ereignisse verbrauchen weiterhin Kapazität; bei Vollstand werden neue Aufnahmen explizit abgewiesen.

Pro Zustellung höchstens 100 Events / 256 KiB; pro signiertem Event höchstens 32 KiB. Antworten sind auf 512 KiB begrenzt. Die zehnsekündige Deadline umfasst Header und Antwortbody. Redirects sind verboten. Als Ziel ist ausschließlich `http://127.0.0.1:<Port 1024–65535>` zugelassen; Domains, fremde Hosts, Pfade, Userinfo und Query sind keine zulässigen Service-Origins. Zieladressen stammen nie aus einem angeklickten Link oder Event.

Übertragungsversuche werden **vor dem Senden** persistiert. Verlorene Antwort oder Prozessabbruch führen deshalb zur Wiederholung derselben signierten Daten nach der gespeicherten Wartezeit. Normaler Backoff steigt mit Jitter bis maximal fünf Minuten; ein längeres gültiges `Retry-After` wird berücksichtigt. Nicht vor Ablauf erneut senden. Neue Ereignisse überholen keinen noch ausstehenden, abgewiesenen oder verzögerten Vorgänger.

Nach zehn erfolglosen Versuchen wird der Eintrag als `DEAD_LETTER` mit `RETRY_LIMIT_REACHED` sichtbar. Ebenso bleiben permanente Antwortfehler wie Konflikt/Scope-/Schemaabweichung erhalten. Mehr als sieben Tage unbestätigt wartende Ereignisse werden als `OUTBOX_EVENT_EXPIRED` gesperrt; ihr Inhalt wird **nicht gelöscht**. STAGED-Inhalte werden ebenfalls nicht automatisch altersbedingt entfernt.

Ein Dead Letter blockiert die nachfolgenden Events desselben Geräte-Streams. `deliveryBlocked` und die `errors`-Liste machen das sichtbar. Bezeichnungen beziehen sich auf die Transportzustellung, nicht auf den Browser-Öffnungsversuch im Eventfeld `attemptNumber`.

Nach behobener Störung kann der lokale Betreiber **nur ausgeschöpfte Transport-Retries** gezielt erneut freigeben:

```sh
npm run enterprise:broker -- retry --data-dir /tmp/thundy-broker-demo --event-id EVENT_UUID
```

Diese Freigabe ist selbst signiert und dauerhaft protokolliert. Der neue Retry-Zyklus startet bei null; `totalAttempts` zählt weiter. Event-ID, Browser-Versuch, Payload und Sequenz bleiben unverändert. Abgelaufene Events und Inhalts-/Scope-Konflikte können dadurch nicht umgangen werden. Es gibt noch keinen Rollen-/Vier-Augen-Freigabeprozess oder Konflikt-Reparaturkanal.

## Quittungsprüfung und Grenzen

Stimmt ein STAGED-Nachweis nicht mit dem erwarteten Event überein, wird er nicht übernommen und kein Inhalt entfernt. Receipt-Polling verwendet eine frische signierte Geräteanfrage; geänderte Quittungen, fremde Signaturen und nicht unterstütztes SEALED erscheinen in `pollErrors`. Eine bereits gültige Quittung wird dabei nicht überschrieben. Poll-Timer sind pro Prozess; gespeicherte Ereignisse, Erstquittungen, Sendeversuche und Transport-Retry-Zeiten sind dauerhaft. Erneutes Prüfen nach Neustart ist zulässig.

Die lokale Initialisierung erzeugt Geräte-/Server-Testschlüssel im selben privaten Entwicklungsverzeichnis. Der Broker lädt ausschließlich seinen Geräte-Private-Key und den Server-Public-Key. Das ist noch keine geschützte Betriebssystemregistrierung, Hardwarebindung, Unternehmensidentität oder unabhängige Vertrauensverteilung.

Ein abgebrochener Writer hinterlässt `outbox.lock`. Alle zugehörigen Prozesse stoppen, Zustand prüfen, komplette Ablage sichern und erst dann einen nachweislich verwaisten Lock als Betreiber entfernen. Beschädigte Journale nicht automatisch kürzen. Private Keys, Policy-/Epochenzuordnung und Prüfparameter müssen für Recovery erhalten bleiben; Rotation und Journalmigration sind noch nicht implementiert. Ein signiertes Journal allein erkennt ohne externen Checkpoint keine Entfernung eines gültigen Kettenendes.

22 neue Tests prüfen atomare Sequenzaufnahme/Recovery, 24 Stunden simulierte Offlinezeit, echten Prozessabbruch, fehlende Erfolgsbestätigungen, verlorene Antworten, Teilerfolge, Retry-After, Fristen/Versuchsgrenzen, Betreiber-Retry, Kapazität, Signaturen/Scope/Hash/SEALED, Origin-/Redirect-Sperren, Antwortgrenzen, konkurrierende Zustellung, Polling, private Dateirechte und die vollständige CLI-Zustellung an einen getrennten Service bis zur Admin-Review. Sie ersetzen keine reale 24-Stunden-Dauerabnahme oder Windows-/macOS-/Thunderbird-Prüfung.

Ergänzung: [Server-Checkpoints und separater Witness mit extern gepinntem Kopf](ENTERPRISE_EVIDENZPRUEFUNG.md) sind jetzt verfügbar. Dies bleibt STAGED ohne Retirement.

Nächste Stufe: echte SEALED-/Object-Lock-Prüfung und sichere Payload-Freigabe, geschütztes Enrollment/Native Messaging sowie echte Unternehmens-Adapter und Rollen. [Status aller Arbeitspakete](ENTERPRISE_UMSETZUNGSSTAND.md).
