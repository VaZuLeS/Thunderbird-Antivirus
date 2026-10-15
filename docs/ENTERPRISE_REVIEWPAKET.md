# Transportables lokales Reviewpaket

Stand: 15. Oktober 2026. N16 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) bündelt das Original-Alarmjournal, das Original-Heartbeat-Journal und einen öffentlichen Konfigurationssnapshot in einer Datei. Die Empfängerprüfung führt den [unabhängigen Quellenabgleich aus N15](ENTERPRISE_HEARTBEAT_QUELLENABGLEICH.md) erneut durch. Originaldateipfade des Erstellers werden dafür nicht benötigt.

Das Paket ist ein begrenzter, kanonisch codierter JSON-Container, kein ZIP-/Tar-Archiv. Es wird nichts entpackt und kein Pfad aus dem Paket im Dateisystem geöffnet. Private Schlüssel, Zugangsdaten und lokale Konfigurationsdateipfade werden nicht übernommen. Dies ist keine Archivierung, Rotation, Retention- oder SEALED-Freigabe.

## Erstellen und übertragen

```sh
npm run enterprise:review-package -- create \
  --config /srv/trust/heartbeat-alert-config.json \
  --journal /srv/local/heartbeat-alerts/actions.jsonl \
  --source-journal /srv/local/heartbeats/actions.jsonl \
  --expected-head UNABHAENGIG_BEKANNTER_ALARM_SHA256 \
  --expected-source-head UNABHAENGIG_BEKANNTER_QUELL_SHA256 \
  --out /srv/review/testgeraete.thundy-review.json
```

Die öffentliche Konfiguration aus N13–N15 verwenden. Vor Erstellung werden beide Originaljournale, sämtliche Signaturen, historischen Quellenpräfixe und Gerätestände geprüft. Fehler führen zum Abbruch. Das Paket wird nicht aus ungesicherten HTML-/JSON-Reports erzeugt.

Die Originaljournalbytes bleiben einschließlich ihrer Signaturen unverändert. Der Konfigurationssnapshot enthält die öffentlichen Writer-/Geräteschlüssel, Registry und gebundenen Parameter; keine Pfade zu lokalen Dateien und keine privaten Schlüssel. Wiederholte Erstellung mit denselben Originalbytes und derselben öffentlichen Konfiguration ist deterministisch. Es wird kein scheinbarer Beglaubigungszeitpunkt erfunden.

Das Paket enthält Geräte- und Verbraucherkennungen und kann personenbezogen sein. Es wird nicht automatisch versendet. Nur über freigegebene Wege an berechtigte Reviewer übergeben und die genehmigte Aufbewahrung anwenden. Ein optionaler Paket-SHA-256 muss separat über einen vertrauenswürdigen Weg mitgeteilt werden, wenn exakt dieser übergebene Paketinhalt verankert werden soll.

## Unabhängig prüfen und anzeigen

```sh
npm run enterprise:review-package -- verify \
  --config /srv/reviewer-trust/heartbeat-alert-config.json \
  --package /srv/incoming/testgeraete.thundy-review.json \
  --expected-package-hash UNABHAENGIG_BEKANNTER_PAKET_SHA256 \
  --out /srv/review/package-verification.json

npm run enterprise:review-package -- review \
  --config /srv/reviewer-trust/heartbeat-alert-config.json \
  --package /srv/incoming/testgeraete.thundy-review.json \
  --expected-package-hash UNABHAENGIG_BEKANNTER_PAKET_SHA256 \
  --lang de --out /srv/review/package-review-de.html
```

**Eine separat vertrauenswürdige öffentliche Konfiguration ist immer erforderlich – auch bei vorgegebenem Paket-Hash.** `--config` ist die lokale Reviewer-Vorgabe. Ihre Dateipfade dürfen vom Ersteller abweichen; entscheidend sind dieselben öffentlichen Schlüssel, dieselbe Registry und dieselben gebundenen Parameter. Sie wird außerhalb des Pakets durch den Betreiber vertrauenswürdig bereitgestellt. Die eingebettete Konfiguration wird damit vollständig abgeglichen und niemals automatisch zur Vertrauensquelle erklärt.

Ein lediglich zusammen mit dem Paket mitgelieferter Schlüssel oder ein daraus selbst abgelesener Hash schafft keinen unabhängigen Vertrauensanker. Den eingebetteten Snapshot nicht ungeprüft als neue Reviewer-Vorgabe übernehmen. Auch ein korrektes Manifest mit Dateihashes ersetzt keine Journal-/Gerätesignaturprüfung.

`--expected-package-hash`, `--expected-head` und `--expected-source-head` sind optional. Alle CLI-Pins sind tatsächliche SHA-256-Werte. Journalpins beziehen sich auf die mitgelieferten vollständigen Alarm-/Quelljournale. Ein Paket-Pin bindet den gesamten Container; er wird getrennt von den direkten Journalpins ausgewiesen. Ohne Paket- oder Journalpins kann ein neu erzeugtes Paket aus passend gekürzten, weiterhin gültig signierten Journalanfängen nicht allgemein als veraltet erkannt werden. Die externe Konfiguration allein bestätigt keinen neuesten Stand.

Die Prüfbefehle benötigen keine privaten Schlüssel. Sie funktionieren auch dann, wenn die Originaljournale inzwischen an anderen Orten liegen oder die Originalwriter geöffnet sind. Angegebene Paket-, Konfigurations- und Journaleingaben dürfen keine Symlinks sein. Bestehende Ausgaben und auch dangling Ausgabesymlinks werden nicht überschrieben.

## Format und Prüfungen

Genau drei Einträge in fester Reihenfolge:

| Paketpfad | Inhalt | Grenze |
|---|---|---|
| `alarms/actions.jsonl` | Original-Alarmjournal | 32 MiB |
| `heartbeats/actions.jsonl` | Original-Heartbeat-Journal | 32 MiB |
| `trust/public-context.json` | Öffentlicher Konfigurationssnapshot | 2 MiB |

Jeder Eintrag hat Bytezahl und SHA-256 im Manifest; Dateiinhalte werden kanonisch als Base64 gespeichert. Andere Pfade, Aliase, doppelte/zusätzliche Einträge, absolute Pfade, Traversalpfade, andere Encodings, ungültiges Base64, falsche Längen oder Hashes werden abgewiesen. Es gibt keine Kompression und damit keinen Dekompressionspfad.

Der äußere Container ist JCS-codiertes JSON mit genau einem abschließenden Zeilenumbruch. Mehrdeutige alternative Serialisierungen und doppelte JSON-Schlüssel werden nicht akzeptiert. Vor kanonischer Verarbeitung werden die erlaubten skalaren Felder geprüft, sodass verschachtelte Fremdstrukturen keine rekursive Verarbeitung erzwingen. Der öffentliche Snapshot hat denselben kanonischen Vertrag. Die API normalisiert öffentliche Writer-PEMs und Registryreihenfolge; alle fachlichen Parameter müssen zur ursprünglichen Konfiguration passen.

Prüfreihenfolge: externe Konfiguration validieren, optionalen Paket-Pin vergleichen, Format/Einträge/Hashes prüfen, eingebettete öffentliche Konfiguration mit der externen Vorgabe abgleichen, beide Originaljournale und historische Quellenbezüge erneut prüfen und zuletzt Manifest-Endhashes mit dem tatsächlichen Prüfergebnis vergleichen. Neu berechnete Dateihashes erlauben deshalb weder einen fremden Schlüssel noch eine ungültige Gerätesignatur.

Leere Journale sind zulässig. Ein verifiziertes Paket mit leeren bzw. nicht referenzierten Gerätemeldungen wird weiterhin ausdrücklich ohne tatsächlichen Geräteevidenznachweis angezeigt. `sourceDeviceEvidenceReverified` wird nicht durch ein gültiges Manifest oder einen Paket-Pin auf `true` gesetzt.

## Sechs Sprachen, Export und Ausgabesicherheit

`review --lang en|de|fr|es|it|pl`, Standard Englisch. Die bestehende [Alarmreview](ENTERPRISE_HEARTBEAT_ALARMREVIEW.md) zeigt zusätzlich Paket-/Manifesthash, externen Paket-Pinstatus, drei geprüfte Einträge und den Abgleich mit einer separaten Vertrauensvorgabe. Direkte Journalpins und Paket-Pin bleiben unterscheidbar.

Der vollständige minimierte JSON-Download enthält Prüfmetadaten, Geräte- und Kandidatenstände. Er enthält keine Originaldateien, Base64-Einträge oder öffentlichen Schlüsselkopien. Filter und Seiten ändern den Download nicht. HTML und JSON-Report sind unsignierte Darstellungen; für eine erneute Prüfung das Originalpaket mit der separat vertrauenswürdigen Konfiguration verwenden.

Die CLI schreibt neue Ausgaben zunächst in eine private temporäre Datei im Zielverzeichnis, synchronisiert sie und veröffentlicht sie über einen exklusiven Hardlink ohne Überschreiben. Normale Fehler räumen temporäre Dateien auf. Bei Fehlern nach Veröffentlichung kann eine vollständige Datei bereits vorhanden sein; ein Fehler bestätigt keinen dauerhaften Erfolg. Dieses lokale POSIX-Verfahren wurde nicht auf realem Windows/macOS abgenommen und ist keine geschützte Langzeitablage.

## API und Grenzen

- `createPackage(alarmContent, sourceContent, {trustedContext, expectedHead?, expectedSourceHead?})` aus `enterprise/review_package.cjs` liefert einen Buffer.
- `verifyPackage(packageContent, {trustedContext, expectedPackageHash?, expectedHead?, expectedSourceHead?})` liefert den erneut geprüften Alarm-/Quellenreport mit `packageVerification`.
- `trustedContext` enthält genau `source`, `signerKeyId`, `signerPublicKey`, `cooldownMs`, `maxSnapshotAgeMs`, `maxPending`. `source` entspricht der öffentlichen N15-Quellkonfiguration. Private Schlüssel und Zusatzfelder werden abgewiesen.

`packageVerification` enthält Paket-/Manifesthash, externen Paket-Pinstatus, `externalConfigurationMatched: true`, `entryHashesVerified: true`, `entryCount: 3`, `embeddedKeysTrustedAutomatically: false`, `extracted: false` und `sealed: false`. Ein unbekanntes Zusatzfeld wird nicht in die HTML-/JSON-Review übernommen.

Gesamtpaket höchstens 92 MiB. Die Journalgrenzen aus N15 bleiben bestehen: 10.000 Aktionen je Journal, 10.000 Beobachtungen, 1.000 Geräte und insgesamt 200.000 Gerätestandsvergleiche. Die HTML-Grenze von 10.000 Kandidaten gilt zusätzlich. Überschreitung wird ausdrücklich abgewiesen; keine stille Kürzung.

Der neue Baustein liegt außerhalb des XPI; Extension 1.22.0 bleibt unverändert. Unternehmensrollen, Live-Flottenmessung, Datentransfer-/Retentionfreigaben und SEALED bleiben offen. N17 ergänzt die [lokale Kapazitätsprüfung](ENTERPRISE_KAPAZITAET.md) vor den Reader-/Paketgrenzen und der konfigurierten Pending-Grenze.

Validierung: 883 Tests erfolgreich, darunter 18 neue Prüfungen für deterministische Originalbytes, verpflichtenden externen Trust-Abgleich, private/fremde Schlüssel, Traversal-/Duplikatpfade, kanonisches JSON/Base64, Dateihashes/Signaturen, Rollback-Pins, Limits, sechs Sprachen und CLI-Ausgabeschutz. 48 Chromium-Kombinationen einschließlich vollständiger minimierter Downloads erfolgreich. Vollständiges `npm run check` erfolgreich; 0 Lintfehler und 24 bestehende Thunderbird-Warnungen. Alle 40 XPI-Dateien sind bytegleich mit v1.22.0.
