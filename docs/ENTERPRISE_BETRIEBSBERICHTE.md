# Lokale Betriebsberichte und dauerhafte Alarmdämpfung

Stand: 14. Oktober 2026. N04 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ist lokal implementiert. JSON und eine statische HTML-Ansicht in **Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch** zeigen Queuezustände, Speicherauslastung, fällige Wiederholungen, Aufbewahrungsfristen und zusammengefasste Fehler. Die HTML-Ansicht unterstützt helles/dunkles Design, kleine Fenster und Druck; sie lädt keine externen Ressourcen und enthält keine Skripte.

## Aufnahme und Bericht

```js
const { collectSnapshot, summarize, HealthMonitor } = require('./enterprise/health.cjs');
const snapshot = collectSnapshot({
  sourceId: 'local-service', outbox, storage: storageJobs, connectors: connectorQueue,
});
const report = summarize(snapshot, Date.now());
```

Die Queues stammen aus den bestehenden lokalen Node-Bausteinen. Nicht vorhandene Queues weglassen. `collectSnapshot` liest deren `status()` und erfasst die Zeit; es behauptet keine authentifizierte Flottenmessung. Bei bereits exportierten Statusdaten muss der Aufrufer den tatsächlichen Erfassungszeitpunkt übergeben. Ein neuer Dateiname allein macht alte Daten nicht aktuell.

```sh
npm run enterprise:health -- report \
  --input /srv/local/queue-snapshot.json \
  --format html --lang de --out /srv/review/health.html
```

Standardausgabe ist JSON; `--format html --lang en|de|fr|es|it|pl` erzeugt HTML. Eingabe maximal 4 MiB, reguläre Datei ohne Symlink. Ausgabe wird als neue Datei mit Modus 0600 erzeugt; vorhandene Dateien und unbekannte Sprachen/Formate werden vor einer Beobachtung abgewiesen.

Der Snapshot enthält `sourceId`, `capturedAt` als UTC-ISO-Zeit und mindestens einen der Bereiche `outbox`, `storage`, `connectors`. Berichte kopieren ausschließlich aggregierte Zustände und bekannte Fehlercodes. Link-URLs, Geräte-/Event-/Jobkennungen, Objektversionen, Einstellungen, Credentialwerte und unbekannte Fehlertexte werden nicht übernommen. Unbekannte Codes erscheinen als nicht klassifizierter Fehler. Die konfigurierte lokale Quellenkennung ist kein Geräte-Heartbeat.

## Dauerhafte Dämpfung

```sh
npm run enterprise:health -- observe \
  --input /srv/local/queue-snapshot.json \
  --directory /srv/local/health-state \
  --key-id health-writer --private-key /srv/keys/health-private.pem \
  --out /srv/review/health-observation.json
```

`observe` verwendet einen eigenen Ed25519-Schlüssel mit privater Datei (0600). Ein signiertes, verkettetes Journal speichert die Beobachtung vor Bestätigung. Private, betreibereigene POSIX-Verzeichnisse und exklusiver Writer-Lock sind erforderlich. Reine Reports benötigen keinen privaten Schlüssel. Die Ausgabe bleibt eine **unsignierte Zusammenfassung**; das Journal ist separat signiert.

API: `new HealthMonitor({ directory, signerKeyId, signerPrivateKey, sourceId, clock, cooldownMs, staleAfterMs, deadlineWarningMs, expectedHead })`, danach `observe(snapshot)` und `close()`. Defaults: 15 Minuten Alarmdämpfung, 5 Minuten bis „veraltet“, Warnung 24 Stunden vor Retentionsende. Queues warnen ab 80 Prozent Auslastung. Fristen werden auf den Erfassungszeitpunkt bezogen, das Snapshotalter auf die aktuelle Uhr.

- Der erste aktuelle Befund liefert einen Alarmkandidaten in `notifications`; weitere Beobachtungen desselben Befunds werden während der Dämpfung zusammengezählt.
- Nach der Dämpfung wird ein erneuter Kandidat mit Anzahl unterdrückter Beobachtungen geliefert. Eine aktuelle fehlerfreie Beobachtung beendet den Zustand; ein erneutes Auftreten meldet sich sofort.
- Identische Snapshots erzeugen keine weiteren Kandidaten. Der Übergang derselben Aufnahme von aktuell zu veraltet kann einmal einen Veraltungsalarm erzeugen.
- Veraltete Snapshots autorisieren keine Entwarnung alter Queuefehler und erzeugen ausschließlich Veraltungskandidaten. Die alten Queuezahlen bleiben sichtbar und als veraltet gekennzeichnet.
- Konflikte unter derselben Aufnahmezeit, ältere Aufnahmen, zukünftige Zeitstempel, Uhr-Rücklauf, falsche Journal-Signaturen, Kapazitätsüberschreitung und Schreibfehler werden abgewiesen.

`notifications` sind lokal erzeugte Kandidaten, keine zugestellten E-Mails, Tickets oder SIEM-Alarme. Seit N10 werden neue Kandidaten mit ihrer Beobachtung dauerhaft aufgenommen und bleiben über `pending` bis zum ausdrücklichen `acknowledge` abrufbar. Für ältere Beobachtungsaktionen ist eine verlorene Rückgabe nicht rekonstruierbar. [Abholen, Bestätigung und Migration](ENTERPRISE_ALARMKANDIDATEN.md). Externe Zustellung benötigt weiterhin eine eigene Integration; Dämpfung ist kein Eskalations- oder Bereitschaftsdienst.

## Recovery und Grenzen

Journal: `actions.jsonl`, Standardlimits 32 MiB / 10.000 Aktionen; keine stille Verdrängung. Teilgeschriebene Enden werden nicht automatisch repariert. Nach einem bestätigten Prozessabbruch darf ausschließlich der Betreiber den verwaisten Lock entfernen; gültige vollständige Aktionen werden erneut geprüft und synchronisiert. Ein unabhängig bekannter `expectedHead` erkennt gültiges Abschneiden. Ohne Pin beweist ein lokal beschreibbares Journal keine Vollständigkeit gegen seinen Eigentümer.

`oldestRetainedAgeMs` betrifft auch bereits lokal angenommene Ereignisse und ist ausdrücklich keine Zustell-SLA. Erfolgreiche Simulationen oder beobachtete Cloudablage sind kein SEALED. Reale Geräteidentitäten, Heartbeats, zentrale Flottenabdeckung, Rollen, authentifizierte Statusübertragung, Zustellgarantien und produktive Abnahme bleiben offen.
