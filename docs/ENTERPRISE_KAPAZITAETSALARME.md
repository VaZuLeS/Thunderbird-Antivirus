# Dauerhafte lokale Kapazitätswarnungen

Stand: 15. Oktober 2026. N18 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ergänzt die [Kapazitätsprüfung N17](ENTERPRISE_KAPAZITAET.md) um ein eigenes signiertes POSIX-Journal. Warnkandidaten bleiben bis zur ausdrücklichen Übernahmebestätigung abrufbar. Eine sechssprachige Offline-Adminansicht zeigt den Verlauf im gemeinsamen Designsystem.

## Verhalten und Grenzen

| Situation | Ergebnis |
| --- | --- |
| Messwert erreicht die Warnschwelle, standardmäßig 80 % | Neuer Kandidat `RAISED` |
| Aktive Warnung erreicht 100 % | Sofortiger Kandidat `ESCALATED`, auch innerhalb der Dämpfungszeit |
| Warnung bleibt aktiv | Dämpfung; nach standardmäßig 900.000 ms Kandidat `REMINDER` mit Zahl der unterdrückten Beobachtungen |
| Belegung fällt auf oder unter die Erholungsschwelle, standardmäßig 70 % | Kandidat `RECOVERED`; spätere Warnüberschreitung kann erneut auslösen |
| Belegung liegt zwischen Erholungs- und Warnschwelle | Bestehende Warnung bleibt aktiv; keine vorschnelle Erholung |
| Paketgrößen wurden nicht mitgeliefert | Ungemessen; weder Erholung noch Erinnerung für diese beiden Metriken |
| Admin/Abnehmer bestätigt die Übernahme | Nur dieser Kandidat erhält `ACKNOWLEDGED`; aktive Warnung und andere Kandidaten bleiben bestehen |
| Warnqueue voll | Gesamte neue Beobachtung wird vor dem Schreiben abgewiesen; kein Kandidat und kein Dämpfungsstand geht verloren |

Schwellen werden mit ganzzahligen Verhältnissen verglichen. Warnschwelle: 1–99 %, Erholungsschwelle: 0 bis unter die Warnschwelle; Dämpfung: 1–86.400.000 ms; offene Kapazitätskandidaten: 1–10.000. Diese Queue hat ein **eigenes** `maxPending`; die N17-Metrik „Offene Kandidaten“ misst weiterhin das ursprüngliche Heartbeat-Alarmjournal mit dessen separat gebundener Grenze.

Erholung und Übernahme sind unabhängig: Ein historischer Warnkandidat bleibt bis zum ACK offen, auch wenn später ein Erholungskandidat entsteht. Alle erzeugten Kandidaten einschließlich Erholung beanspruchen Queueplatz. ACK löscht keine Historie. Eine Erinnerung im Hysteresebereich kann einen aktuell unter der Warnschwelle liegenden Messwert haben; die Warnung bleibt bis zur Erholungsschwelle aktiv.

Die neun Grenzengrundlagen von N17 gelten unverändert: Reader-/Formatlimits sind keine gemessenen Writer-/Festplattenlimits. Keine Vorhersage der Restlaufzeit, automatische Rotation oder Löschung. Die Überwachung wird durch explizite CLI-/API-Aufrufe ausgeführt; kein Hintergrunddienst oder externer Alarmtransport wird gestartet.

## Vertrauenskonfiguration und Schlüssel

Die Kapazitätsqueue erhält ein eigenes Ed25519-Schlüsselpaar. Private Schlüsseldateien müssen dem ausführenden POSIX-Benutzer gehören, regulär und ohne Gruppen-/Fremdrechte zugänglich sein (0600). Der CLI vergleicht den privaten Schlüssel vor Schreibzugriff mit dem unabhängig konfigurierten öffentlichen Schlüssel. Beispiel für `capacity-config.json`:

```json
{
  "schemaVersion": 1,
  "signerKeyId": "capacity-writer",
  "signerPublicKeyFile": "/srv/thundy/trust/capacity-public.pem",
  "heartbeatAlertsConfigFile": "/srv/thundy/trust/alerts-public-config.json",
  "warningPercent": 80,
  "recoveryPercent": 70,
  "cooldownMs": 900000,
  "maxPending": 1000
}
```

Beide Dateipfade müssen absolut sein. `heartbeatAlertsConfigFile` verwendet die bestehende [öffentliche Alarmkonfiguration](ENTERPRISE_HEARTBEAT_ALARMREVIEW.md), einschließlich der separat konfigurierten Quellregistry und beider öffentlicher Originaljournal-Schlüssel. Öffentliche Schlüssel und Konfigurationen müssen außerhalb der zu prüfenden Daten vertrauenswürdig verteilt werden. Eingebettete Paketschlüssel werden nicht automatisch vertraut.

Konfiguration, Originalquellkontext und Warnregeln sind durch den signierten Scope gebunden. Änderungen benötigen eine bewusst eingerichtete neue Queue; es gibt keine stille Migration oder Rücksetzung des bestehenden Verlaufs. Vorhandene Journale bleiben erhalten. Produktiver Schlüsselschutz, Rotation und reale OS-Abnahme bleiben offen.

## CLI

```sh
# Originaljournale prüfen und Kapazitätsbeobachtung dauerhaft speichern
npm run enterprise:capacity-alerts -- observe --config capacity-config.json --directory ./capacity-queue --private-key capacity-private.pem --journal alerts.jsonl --source-journal heartbeats.jsonl --out observed.json

# Alternativ: vollständiges N16-Reviewpaket prüfen und beobachten
npm run enterprise:capacity-alerts -- observe-package --config capacity-config.json --directory ./capacity-queue --private-key capacity-private.pem --package review.json --out package-observed.json

# Offene Kandidaten nach Neustart erneut abholen (Standard 100, maximal 1000)
npm run enterprise:capacity-alerts -- pending --config capacity-config.json --directory ./capacity-queue --private-key capacity-private.pem --limit 100 --out pending.json

# Einen konkreten Kandidaten ausdrücklich übernehmen
npm run enterprise:capacity-alerts -- ack --config capacity-config.json --directory ./capacity-queue --private-key capacity-private.pem --notification-id <64-stellige-ID> --consumer-id local-admin

# Ausschließlich mit öffentlichen Schlüsseln prüfen und anzeigen
npm run enterprise:capacity-alerts -- verify --config capacity-config.json --journal ./capacity-queue/actions.jsonl --out verified.json
npm run enterprise:capacity-alerts -- review --config capacity-config.json --journal ./capacity-queue/actions.jsonl --lang de --out capacity-admin.html
```

`--expected-head` pinnt bei allen Befehlen den **Kapazitätsjournal-Endhash**. Bei den beiden Beobachtungsbefehlen pinnen `--expected-alarm-head` und `--expected-source-head` die Originaljournale; `observe-package` unterstützt zusätzlich `--expected-package-hash`. CLI-Pins sind 64-stellige kleingeschriebene SHA-256-Hexwerte. Sie müssen unabhängig vertrauenswürdig bekannt sein. Ohne Pins bleibt ein passend signierter, aber abgeschnittener Kapazitätsjournal-Endstand grundsätzlich unentdeckt; diese Einschränkung wird in der Ansicht sichtbar.

JSON verwendet stabile technische Kennungen; `review` unterstützt vollständig `en`, `de`, `fr`, `es`, `it`, `pl`, Standard Englisch. Die Ansicht zeigt aktuelle Messungen, unabhängig davon aktive Warnungen, Übernahmestatus, Kandidatenzeit, Dämpfung und Abnehmer. Evidenzhashes und separate Original-Pinzustände sind aufklappbar. Theme, Akzent und Dichte funktionieren offline ohne Skripte, Netzwerk, lokale Speicherung oder Änderung der Evidenz.

Ausgaben werden atomar als neue 0600-Dateien angelegt; bestehende Dateien und auch hängende Ausgabe-Symlinks führen vor einer Queueänderung zum Abbruch. Schlägt die Ausgabe erst nach der dauerhaften Beobachtung fehl, bleiben Kandidaten über `pending` abrufbar. Ein gleiches ACK vom gleichen Abnehmer ist idempotent; eine abweichende nachträgliche Abnehmerkennung wird abgewiesen. Teilabrufe begrenzen ausschließlich die Ausgabe und bestätigen nichts automatisch. Vollständiger historischer JSON-Bericht über `verify`.

## Evidenz, Wiederaufnahme und Datenschutz

`CapacityAlerts.observeJournals` und `.observePackage` akzeptieren Originale und führen vor jeder Beobachtung den vollständigen N17-Prüfpfad aus: beide Signaturketten, historische Zustände und externen Konfigurationsabgleich. Ein weitergereichtes N17-Berichts-JSON ist kein zulässiger Evidenzeingang. Vorher beobachtete Originalbytes müssen als unverändertes Präfix erhalten bleiben; Kürzung, Umformatierung oder ein alternativer gültig signierter Zweig werden abgewiesen. Gleiche Aufnahmezeit mit abweichender Beobachtung ist ein Konflikt. Eine identische Wiederholung hängt keinen weiteren Record an.

Das neue Journal speichert nur minimierte N17-Messwerte, Prüfreferenzen, Eingabehashes, Zeit und Regelnachweise; keine URLs, Gerätekennungen, Schlüssel, Registries oder lokalen Dateipfade. Kandidaten-IDs binden Scope, Beobachtungsinhalt und Journalposition/-vorgänger. `consumerId` ist eine lokale technische Abnehmerkennung, keine bestätigte Unternehmensidentität.

`verify` und `review` prüfen Signaturen, Verkettung, Scope und die deterministische Kapazitätswarnlogik des **Kapazitätsjournals**. Sie benötigen keinen privaten Schlüssel, öffnen keinen Writer-Lock und verändern kein Journal. Sie prüfen die ursprünglichen N17-Eingaben **nicht erneut**; `originalEvidenceReverified: false` und der sichtbare Hinweis unterscheiden diese Prüfung von der Originalprüfung beim Beobachten. Die gespeicherten N17-Prüffelder sind Aussagen des signierenden Beobachters. Für unabhängige Originalprüfung müssen die Originaljournale bzw. Pakete aufbewahrt und erneut mit N17 geprüft werden. HTML und JSON sind unsignierte Projektionen des signierten Journals.

Die Queue erbt Einzelwriter-Lock, 0700-Verzeichnis, 0600-Journal, Signaturen, fsync und Abbruch bei unvollständigem Tail aus `DurableJournal`. Standard: höchstens 10.000 Aktionen / 32 MiB für das eigene Journal, einschließlich Beobachtungen und ACKs. Reader verwenden dieselben Standardgrenzen. Historische ACKs bleiben erhalten und zählen weiter zu diesen Grenzen. Bei Journalvollstand können auch ACKs abgewiesen werden; Betrieb muss vorab Kapazität und geordnete Archivierung planen. Keine automatische Tail-Reparatur oder Entsperrung nach Prozessabbruch. Ein Schreibfehler sperrt weitere Nutzung der laufenden Instanz; eine unvollständige Datei darf nicht als erfolgreiche Beobachtung weiterlaufen.

`externalDeliveryVerified` und `sealed` bleiben immer `false`. Keine SSO-/RBAC-Prüfung, kein SIEM-Versand und keine produktive Enterprise-Abnahme.

## Prüfung

21 neue Tests prüfen echte Warn-/100-%-/Erholungsgrenzen, Hysterese, fehlende Paketmessungen bei aktiver Warnung, Wiederholungen, Neustart, ACK-Konflikte, Backpressure, Quellpräfixschutz, Manipulationen, Konfigurationsbindung, öffentliche Reader, Schreibfehler, unvollständige Tails, sechs Sprachen und geschützte CLI-Ausgaben. Zusätzlich bestanden 72 Chromium-Layouts: sechs Sprachen, drei Datenlagen, zwei Breiten und beide Systemfarbschemata, einschließlich Themewechsel und aufgeklappter Evidenzdetails.

Der gesamte Baustein bleibt außerhalb des XPI. Extension-Quellstand 1.23.0 wird dadurch nicht verändert. Reale Thunderbird-/OS-/Screenreader-Prüfung und die [produktive N06-Abnahme](ENTERPRISE_N06_ABNAHME.md) bleiben offen.

Gesamtgate `npm run check` erfolgreich: **940 Tests bestanden**, 0 Fehler und 24 bekannte Thunderbird-Lintwarnungen. Paketprüfung bestanden; alle 44 Runtime-Dateien / 770.358 Bytes sind bytegleich mit dem Ausgangscommit `725d263` (Quellstand 1.23.0).
