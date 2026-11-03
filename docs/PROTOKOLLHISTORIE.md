# Begrenzte Protokollhistorie — AVN-001/009.d

Stand: 3. November 2026, unveröffentlichte Entwicklung 1.24.4. Ergänzt die [Quellenhistorie](QUELLENHISTORIE_ZUORDNUNG.md); kein unabhängiges Langzeitarchiv.

## Befund und Ergebnis

Die fünf vorhandenen Ersetzungspfade konnten gespeicherte Providerprotokolle verlieren: Anhang-Batch, Link-Batch, manuelle Datei-/URL-Einreichung in `background.js` und `api.js::persistHybridReport`. Ein rein lokaler Wiederholungslauf konnte einen fertigen Anhangbericht ebenfalls durch einen manuellen Prüfplatzhalter ersetzen. Eine historische Quellenzusammenfassung allein erhält diese vollständigen Protokolldaten nicht.

`DatabaseDAO.updateStore` sichert jetzt für diese fünf Pfade mit `{preserveReports:true}` die vorherigen aufgezeichneten Ressourcen **in derselben IndexedDB-Transaktion** wie deren Ersetzung. Der optionale Bereich `analysisReportArchive` im bestehenden Headerdatensatz hat Schema 1 und enthält UUID, Archivierungszeit, Ressourcentyp, bisherigen Slot und eine vollständige JSON-Kopie der gespeicherten Ressource. Darin bleiben Bericht, verschachtelte Providerdaten, VirusTotal-Statistik, Job-/Submissionkennung und ursprüngliches `report_fetched_at` erhalten. Auch `KNOWN`-/`UPLOADED`-Metadaten ohne fertigen Bericht werden erhalten; ein laufender Vorgang wird dadurch nicht abgeschlossen.

Ein tatsächlicher gleicher SHA-256 und ein neuer lokaler/manueller Platzhalter erhalten stattdessen den vorhandenen Anhangbericht, dessen Kennungen und Zeitpunkt direkt. Neue Einreichungen oder abweichende Bytes ersetzen weiterhin den aktuellen Stand, sichern den früheren aber zuerst. Die alleinige Übereinstimmung von Name oder Part ist kein Inhaltsnachweis.

Die Historienprojektion liest die archivierten Beobachtungen als **gespeicherte, unbestätigte Historie ohne aktuellen Ressourcenbezug**. Sie reaktiviert keine alten Bewertungen oder Entscheidungen. Der Quellenbereich zeigt Zusammenfassungen; eine eigene Vollprotokollansicht oder ein neuer Export wurde hier nicht eingeführt.

## Speichervertrag und Grenzen

| Grenze | Verhalten |
| --- | --- |
| 128 Revisionen je Headerdatensatz | Eine weitere notwendige Revision verweigert die gesamte Ersetzung; keine automatische Verdrängung |
| 2 MiB serialisierte UTF-8-Archivdaten | Überschreitung verweigert die gesamte Ersetzung |
| 4 MiB aufgezeichnete aktuelle Ressourcen je geschütztem Schreibzugriff | Überschreitung verweigert die Ersetzung; keine Zusage einer globalen RAM-Obergrenze |
| Unbekanntes/ungültiges Archiv, doppelte Kennungen, UUID-Kollision, fehlgeschlagener Commit | Frühere Daten bleiben erhalten; keine erfolgreiche Speicherung melden |
| Identische aufgezeichnete Ressource im selben Slot | Keine doppelte Archivkopie; nur das oberste Cachefeld `created` bleibt beim Vergleich unberücksichtigt |

Providerzeitfelder innerhalb eines Berichts sind Teil des Vergleichs. Gesichert werden vorhandene JSON-Werte, keine originalen HTTP-Wirebytes oder kryptografisch signierten Belege. Rohantworten, die bisher gar nicht gespeichert wurden, entstehen dadurch nicht nachträglich — insbesondere bleibt die Quellenhistorie anderer Dienste von deren Vollprotokollen zu unterscheiden.

Bei verweigerter Speicherung erscheint sechssprachig in Nachricht und Toolbar-Popup: „Eine Berichtsaktualisierung konnte nicht gespeichert werden. Frühere Protokolle blieben erhalten.“ Die Warnung bezeichnet den fehlgeschlagenen Vorgang. Sie ist eine begrenzte Laufzeitdiagnose, bleibt bis zum Leeren der Arbeitsspeichercaches oder Prozessende sichtbar und behauptet keine dauerhafte Schreibsperre. Ein bereits angenommener externer Upload wird wegen eines Speicherfehlers nicht automatisch erneut gesendet.

Die bestehenden Quellenfelder, Auditentscheidungen und deren damalige Snapshots bleiben unverändert. Das optionale Feld benötigt kein IndexedDB-Versionsupgrade. Der Schutz gilt für die fünf genannten Produktwriter; generische DAO-/Fixturezugriffe sind kein unveränderliches Journal.

**Aufbewahrung:** Das Archiv teilt den [bisherigen Headercache](DATENLEBENSZYKLUS.md): Bereinigung beim Öffnen der geteilten Datenbank nach 30 Tagen bzw. höchstens 1.000 Datensätzen sowie explizite Cachelöschung. Es ist keine zusätzliche Löschmigration, kein unabhängiges dauerhaftes Vorkommensarchiv und kein Ersatz für Profilbackups. Allgemeine Retention, dauerhaft isolierte Inhalts-/Vorkommensschlüssel und Migration bleiben AVN-009; ein datensparsamer Quellenexport bleibt AVN-011.

## Prüfung und nächste Schritte

Der [maschinenlesbare Nachweis](audits/avn-001-009-protocols-2026-11-03.json) bindet die Ergebnisse an Paketbytes und Runner. Gezielte Node-/DOM-Prüfungen verwenden simulierte IndexedDB-/Browser-/Providerverträge und tatsächliche Produktfunktionen. Sie prüfen in-place-Ersetzungen, Originaldaten, Zeitfelder, alle fünf Writer, verspätete Antworten, Platzgrenzen, ungültige Archive, Kollision, späteren Transaktionsabbruch und Wiederholung nach einem Fehler. Die sechssprachige Anzeige und der isoliert serialisierte Nachrichtenrenderer sind eingeschlossen.

Der native Offline-Prüfer `--report-archive-check` verwendet echte MIME-Nachrichten, tatsächliche Anhangbytes, IndexedDB, den geschützten DAO im echten Popup und einen Thunderbird-Neustart. Providerprotokolle und ein gefülltes Archiv werden ausdrücklich synthetisch eingespeist. Er prüft gleicher Inhalt/lokales Wiederlesen, abweichende Bytes, Ersetzung im echten Popup mit einem Fixture-Callback, verweigerte Speicherung bei 128 Revisionen, Warnung in beiden Oberflächen sowie Erhalt und unbestätigte Historie nach Neustart. Er ruft keine echten Provider auf. Die modulprivate Funktion `persistHybridReport` wird separat in der Node-Integration mit tatsächlichem DAO geprüft; der native Fixture-Callback prüft den Datenbankvertrag und die Popup-/Nachrichtenbenachrichtigung.

```sh
node --test test/report-archive.test.js test/analysis-sources.test.js
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.4.xpi \
  --report-archive-check --out /absolute/path/to/new-result-directory
```

Abschluss: **1.044 automatisierte Tests erfolgreich**, Source-/Sprach-/Design-/Lint-/Paketprüfung sowie drei Byte-Regressionen des Prüfrunners erfolgreich. Die Archivprüfung besteht unter **140.12.0 und 153.6.0** auf Linux jeweils einschließlich eines echten Neustarts; [Nachrichtenansicht](screenshots/1.24.4/report-archive-message.png) und [Toolbar-Popup](screenshots/1.24.4/report-archive-popup.png) zeigen die Kapazitätswarnung. Die Quellenhistorienprüfung unter 153 besteht separat. Die kombinierte 153-Regressionsmatrix für Ressourcen, 205 Kontexte, Identität, MIME und Unicode besteht einschließlich zweier normaler Neustarts. Das manuelle Upgrade von veröffentlichter 1.24.3 auf dieselben geprüften Paketbytes besteht mit drei normalen Neustarts einschließlich Profilrestore und zwei SIGKILL-Neustarts. Die anfänglichen, anschließend korrigierten Prüfer-/Dateidialogfehler sind im Nachweis getrennt von erfolgreichen Läufen dokumentiert.

Die CI führt den neuen Fall separat aus; daraus wird kein bereits erfolgreicher Remote-Lauf für einen späteren Commit abgeleitet. Windows/macOS, NVDA/VoiceOver, reale Providerkonten und automatische Verteilung bleiben mangels zusätzlicher Ressourcen offen. **1.24.4 bleibt unveröffentlicht.**
