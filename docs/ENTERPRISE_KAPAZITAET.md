# Lokale Kapazitätsprüfung

Stand: 15. Oktober 2026. N17 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ergänzt eine minimierte Kapazitätsaufnahme aus Original-Heartbeat-/Alarmjournalen oder einem [Reviewpaket](ENTERPRISE_REVIEWPAKET.md). Vor der Auswertung werden beide Signaturketten und die historischen Quellenabgleiche erneut geprüft. Die öffentliche Konfiguration muss unabhängig vertrauenswürdig bereitgestellt werden.

## Aufruf

```sh
npm run enterprise:capacity -- journals --config public-context.json --journal alerts.jsonl --source-journal heartbeats.jsonl --out capacity.json
npm run enterprise:capacity -- package --config public-context.json --package review.json --out capacity.html --format html --lang de --warning-percent 80
```

Optional sind `--expected-head` und `--expected-source-head`, bei Paketen zusätzlich `--expected-package-hash`. Diese Pins müssen aus einer vertrauenswürdigen Quelle stammen. Die Konfiguration entspricht dem öffentlichen Kontext der Paketprüfung; private Schlüssel werden nicht benötigt. HTML unterstützt vollständig `en`, `de`, `fr`, `es`, `it`, `pl`; Standardsprache ist Englisch. JSON ist das Standardformat. Die Schwellenvorgabe muss eine ganze Zahl von 1 bis 99 sein; Standard ist 80 Prozent. Unbekannte Optionen, ungültige Eingaben, Signaturen und Pins führen zum Abbruch.

Die Ausgabe wird ausschließlich als neue Datei angelegt, unter POSIX mit Modus 0600. Vorhandene Ausgaben und Ausgabe-Symlinks werden nicht überschrieben. Originaljournale, Locks und Pakete bleiben unverändert. Eine echte Windows-/macOS-Betriebsabnahme steht weiterhin aus.

## Messwerte und Bedeutung der Grenzen

| Messwert | Grenze | Grundlage |
| --- | --- | --- |
| Alarmjournal: Bytes | 32 MiB | Leselimit des Prüfers |
| Alarmjournal: Aktionen | 10.000 | Leselimit des Prüfers |
| Heartbeat-Journal: Bytes | 32 MiB | Leselimit des Prüfers |
| Heartbeat-Journal: Aktionen | 10.000 | Leselimit des Prüfers |
| Offene Alarmkandidaten | `maxPending` | Konfiguration, bei nicht leerem Alarmjournal signiert gebunden |
| Historische Beobachtungen | 10.000 | Leselimit des Prüfers |
| Historische Gerätevergleiche | 200.000 | Leselimit des Prüfers |
| Paket: Bytes | 92 MiB | Paketformat |
| Öffentlicher Kontext: Bytes | 2 MiB | Paketformat |

Byteangaben messen die tatsächlichen Eingabebytes. Aktions-, Beobachtungs-, Vergleichs- und Pending-Zahlen stammen aus der vollständigen Prüfung. Bei einem leeren Alarmjournal ist `maxPending` ausdrücklich als externe Konfigurationsvorgabe gekennzeichnet: Dort liegt noch kein signierter Journalbeleg vor. Bei getrennten Journaldateien bleiben die beiden nicht mitgelieferten Paketgrößen **ungemessen**, statt als null Bytes zu erscheinen.

Die Reader- und Formatgrenzen sind keine ermittelten Writergrenzen. Writer können niedriger konfiguriert sein. Die Ansicht kennzeichnet die Grundlage jeder Grenze; eine niedrige Readerauslastung belegt deshalb keine ausreichende Writerkapazität. Freier Plattenplatz, Gerätezustand und Restlaufzeit werden nicht gemessen oder hochgerechnet.

## Warnungen und minimierte Darstellung

Jeder der neun Messwerte erhält einen Zustand: unter der Warnschwelle, Warnschwelle erreicht, Grenze erreicht oder ungemessen. Genau 80 Prozent ergeben bei Standardschwelle eine Warnung, genau 100 Prozent den Zustand „Grenze erreicht“. Die Prozentanzeige wird auf Hundertstel abgerundet, damit beispielsweise 79,999 Prozent nicht als 80 Prozent erscheinen. ACK-bestätigte Übernahmen reduzieren die Pending-Belegung. Die Summen zählen Messwerte, keine Geräte oder Vorfälle.

Die sechssprachige HTML-Ansicht zeigt Belegung, Grenze, Rest, Prozent, Grenzengrundlage, Aufnahmezeit und separate externe Pinzustände. Helles und dunkles Design sowie mobile Darstellung sind vorhanden. Der Bericht enthält weder URLs noch Gerätekennungen, Schlüssel oder lokale Dateipfade; Journal- und Pakethashes erlauben die Zuordnung zur geprüften Evidenz. HTML verwendet eine restriktive CSP und benötigt keine Skripte oder externen Ressourcen.

Die Berichtsdatei ist eine **unsignierte lokale Momentaufnahme**. Der Erstellungsweg prüft Originale; ein weitergereichtes Berichts-JSON ersetzt diese Prüfung nicht und wird vom CLI nicht als Evidenzeingang akzeptiert. Die Ausgabe behauptet weder externe Zustellung noch SEALED. Automatisches Löschen, Rotation, Benachrichtigungen und eine laufende zentrale Flottenüberwachung bleiben außerhalb dieses Schritts.

## Prüfung und weiterer Betrieb

14 neue Tests prüfen Originalsignaturen, Manipulationen, Pinvorgaben, minimierte Felder, Leerfälle, tatsächliche Pending-Grenzübergänge, ACK-Entlastung und die CLI einschließlich exklusiver Ausgabedateien. Die Browserprüfung umfasst 48 Layouts: sechs Sprachen, zwei Datenlagen, zwei Breiten und beide Farbschemata.

`npm run check` erfolgreich: 897 Tests, keine Lintfehler und 24 bekannte Lintwarnungen; Paketprüfung bestanden. Alle 40 Extension-Dateien (693.352 Bytes) sind bytegleich mit Tag v1.22.0.

Der Baustein liegt außerhalb des XPI; Extension 1.22.0 bleibt unverändert. N18 sieht dauerhafte lokale Kapazitätswarnkandidaten mit Dämpfung, Erholung und bestätigter Übernahme vor. Produktive Archivierung und die [N06-Abnahme](ENTERPRISE_N06_ABNAHME.md) bleiben eigenständige offene Aufgaben.
