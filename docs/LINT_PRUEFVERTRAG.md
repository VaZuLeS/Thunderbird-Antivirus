# Lint-Prüfvertrag und isolierter Werkzeugvergleich — AVN-008.a

Stand: 4. November 2026, unveröffentlichte Entwicklung 1.24.4. Ausgangscommit `de20eda`. Primärbereich Werkzeugkette/Wartbarkeit, Optimierung; Querverweis auf Veröffentlichung und Prüfgates.

## Befunde und Priorität

Die Untersuchung des neu verfügbaren `addons-linter` 10.15.0 hat zwei konkrete Gatefehler bestätigt:

- `filter-lint-warnings.js` akzeptierte `{}` als „Lint ok: 0 warnings“. Fehlende Ergebnislisten wurden durch leere Listen ersetzt, statt einen unvollständigen Bericht zurückzuweisen.
- Die Teilzeichenketten-Ausnahmen akzeptierten tatsächlich ausgegebene Warnungen zu ähnlich benannten, ungültigen Berechtigungen. Der kontrollierte Prüffall `messagesReadExtra` wurde vom vorherigen Filter angenommen, vom korrigierten Filter abgewiesen.

Zusätzlich ignorierte der Aufrufer den Prozessstatus, sobald JSON parsebar war, und übergab Berichte über einen festen gemeinsamen Temporärpfad. Daraus folgt kein Nachweis fehlerhafter früherer Freigaben: Die vorhandenen echten Berichte sind vollständig und enthalten 27 nachvollziehbare Thunderbird-Ausnahmen. Es sind nachgewiesene Schwächen bei fehlerhaften/abweichenden Werkzeugausgaben, keine neue XPI-Runtime-Lücke.

Die Integrität dieses Prüfgates erhält **P1 vor einer darauf gestützten Freigabe**, Aufwand M. Die weiterhin offenen npm-Entwicklungsadvisories aus AVN-008 bleiben ein gesondertes P2-Paket; sie werden durch die Gatekorrektur nicht als behoben ausgegeben.

## Umsetzung und Akzeptanz

`assessReport` verlangt einen vollständigen Bericht mit Objekt-Metadaten, drei Ergebnislisten und konsistenten sicheren Ganzzahlzählern. `count` und `summary` müssen zu Fehlern, Warnungen und Hinweisen passen. Diagnosen brauchen gültige Codes/Nachrichten; ein gegebenenfalls vorhandener Typ muss zur Liste passen. Fehler werden niemals als bekannte Warnung ausgenommen. Informative Hinweise behalten ihre bisherige Bedeutung.

`assessLintRun` prüft zusätzlich den tatsächlichen Prozessabschluss. Startfehler, Signale, fehlender Status, unerwartete Exitcodes und Nicht-JSON-Ausgaben scheitern. Exitcode 1 wird nur als normaler „Lintfehler gefunden“-Ausgang mit tatsächlich gemeldeten Fehlern verarbeitet und bleibt damit ein fehlgeschlagener Check. Ein Nichtnullstatus mit einem ansonsten erfolgreich aussehenden Bericht wird nicht übergangen.

Die bekannten Thunderbird-Ausnahmen werden auf exakt bekannte API-Diagnosen und die tatsächlich beobachteten Berechtigungsformate eingegrenzt. `messagesReadExtra`, `sensitiveDataUploadExtra`, ähnlich benannte APIs, entfernte MV3-APIs und unbekannte Warncodes werden nicht durch einen Namenspräfix freigestellt. Die Firefox-Android-Mindestversionsmeldung bleibt für das reine Thunderbird-Produkt ausdrücklich irrelevant. Neue Diagnoseformulierungen benötigen eine Prüfung und werden nicht automatisch akzeptiert.

Der Aufrufer startet den installierten lokalen `web-ext`-Einstieg über denselben Node-Interpreter. Es gibt keinen `npx`-Nachladepfad und keine gemeinsam beschreibbare Berichtsdatei. Der Bericht wird direkt im Speicher bewertet; der eigenständig nutzbare Report-CLI prüft dieselben Regeln. Fehler bei Einlesen oder Validierung ergeben keinen Erfolgsstatus und geben keine beliebigen unvollständigen Ausgaben als Erfolg aus.

## Isolierter Vergleich 10.14.0 / 10.15.0

10.15.0 wurde ausschließlich in einem getrennten Verzeichnis mit deaktivierten Installationsskripten installiert. Projektabhängigkeiten und Lockfile wurden nicht umgestellt. Die öffentlichen Linter-CLIs prüfen das exakte bestehende Entwicklungspaket und sechs kontrollierte Fixtures. Beide Versionen liefern im untersuchten Umfang bytegleiche Berichte:

| Fall | Erwartetes Ergebnis des Gates | Ergebnis beider Versionen |
| --- | --- | --- |
| Bestehendes Thundy-XPI | Annehmen | 0 Fehler, 27 bekannte Thunderbird-Warnungen |
| Minimales korrektes Manifest | Annehmen | Nur bekannte Android-Mindestversionsmeldung |
| Leere deklarierte Hintergrunddatei | Annehmen | Kein Lintfehler; kein Funktionsnachweis für eine reale Extension |
| Ähnlich benannte ungültige Berechtigung | Abweisen | `MANIFEST_PERMISSIONS` |
| Unzulässige Manifestversion | Abweisen | `JSON_INVALID`, Exitcode 1 |
| Dynamische Auswertung | Abweisen | `DANGEROUS_EVAL` |
| Inline-Skript | Abweisen | `INLINE_SCRIPT` |

Das sind **14 tatsächliche CLI-Scans** unter Node 24.19.0. Die synthetischen Fälle werden nur analysiert, nicht als Add-on installiert oder ausgeführt. Die erfolgreiche Stichprobe ist keine allgemeine Versions-/Node-20-/Node-22-/OS-Kompatibilitätszusage und kein Sicherheitsattest.

Der faire isolierte npm-Auditvergleich ergibt für **beide** Linterinstallationen sieben moderate und einen niedrigen Befund. Der gesamte Projektbaum bleibt bei neun moderaten/einem niedrigen Befund; ohne Dev-Abhängigkeiten werden null gemeldet. Npm zählt hier betroffene Pakete, nicht acht bzw. zehn unterschiedliche Schwachstellen. Die zwei zugrunde liegenden Advisories zu `minimatch` und `deepmerge` sind in beiden isolierten Bäumen identisch. Diese unterschiedlichen Scopes dürfen nicht als Advisoryreduktion durch das Update verglichen werden. Das npm-Ergebnis ist keine vollständige Sicherheitsbewertung des XPI.

`web-ext` 10.8.0 bindet weiterhin exakt Linter 10.14.0. Ein ungeprüftes Override, der angebotene Downgrade auf `web-ext` 3.2.1 oder ein zusätzlicher obligatorischer Scanner bringen für die untersuchte Stichprobe keinen belegten Nutzen. Der Standard bleibt deshalb unverändert. Ein späterer regulär integrierter Updateweg oder eine gezielte Abhängigkeits-/Erreichbarkeitsuntersuchung bleibt AVN-008.b.

```sh
node tools/linter-compatibility.dev.cjs \
  /path/to/old/node_modules/addons-linter/bin/addons-linter \
  /path/to/isolated/node_modules/addons-linter/bin/addons-linter \
  /path/to/verified-candidate.xpi /path/to/new-result-directory
node --test scripts/lint-gate.test.js scripts/pre-submit-checks.test.js
npm run lint:filtered
```

Der Prüfrunner installiert selbst nichts und verlangt ein neues Ausgabeverzeichnis. Alte Ergebnisse werden nicht als neue Prüfung übernommen. Scannerberichte, Fixtureklassifikationen und deren Prüfsummen bleiben getrennt von den App-Nachweisen.

Der [maschinenlesbare Nachweis](audits/avn-008-lint-gate-2026-11-04.json) enthält die tatsächlichen Vorher-/Nachher-Ausgänge für den leeren Bericht und die ungültige ähnliche Berechtigung, alle 14 Scannerläufe, Auditvergleich und Skript-/Paketprüfsummen. Abschluss: **1.062 automatisierte Tests erfolgreich**, vollständige Source-/Sprach-/Design-/Lint-/Paketprüfung erfolgreich. Die 36 gezielten Gate-/Pre-submit-Tests und der tatsächliche lokale Lint-Aufruf wurden nach dem kurzen Neustart der Arbeitsumgebung nochmals erfolgreich geprüft. Neue Runtime-/OS-/Screenreaderabnahmen werden dafür nicht erfunden.

## Paketbytes und weitere Schritte

Alle Änderungen betreffen Entwicklungs-/Prüfdateien. Runtime, Manifest, Übersetzungen und Paketnutzdaten bleiben unverändert. Der normale Neubau erzeugt dennoch andere ZIP-Zeitstempel und eine andere Eintragsreihenfolge. Nach Prüfung identischer Namen und Nutzdaten sowie des Quellfingerprints wird deshalb das **exakte zuvor nativ geprüfte XPI** wiederverwendet und erneut mit `verify-package` und `packageIdentity` abgeglichen. Es wird kein signiertes oder veröffentlichtes Archiv umgeschrieben. Vorhandene native Nachweise werden nicht einem lediglich ähnlich gebauten Archiv zugeschrieben.

| Nächster Schritt | Priorität / Aufwand | Abnahme / Voraussetzung |
| --- | --- | --- |
| AVN-008.b — unterstützten Advisory-Updateweg untersuchen | P2 / M | Gleichartige Auditbäume vergleichen, konkrete Advisory-Erreichbarkeit und Consumer-Kompatibilität prüfen. Erst dann Lockfile ändern; MV3-/Paketprüfung erhalten. Kein blindes Override |
| AVN-014.b — reproduzierbaren Archivaufbau untersuchen | P2 / M | Gleiche Nutzdaten sollen bei wiederholtem Bau dieselben Archivbytes ergeben. Zeit-/Reihenfolgepolitik vor Tests und Signierung definieren; veröffentlichte oder signierte Artefakte niemals nachträglich normalisieren. Befund: aktueller Wiederholungsbau verändert nur Container, nicht Nutzdaten |
| AVN-011.b — Exportseite bei Navigation/Rückkehr untersuchen | P2 / K–M | Bestehende Hypothese nativ reproduzieren, bevor Seitenlebenszyklus oder Kontextbindung geändert werden; veraltete Vorschauen nicht reaktivieren |

Windows/macOS, Screenreader, Live-Provider, erfolgreiche Cryptoabnahmen und automatische Verteilung behalten ihre bestehenden Voraussetzungen. **1.24.4 bleibt unveröffentlicht.**

## Nachfolgende Untersuchung AVN-008.b

Die obigen Paket-/Freigabeangaben dokumentieren den damaligen Stand. 1.24.4 wurde inzwischen veröffentlicht. Die [anschließende Advisory- und Eingabepfadprüfung](WERKZEUG_ADVISORIES.md) ergänzt feste Prozessbudgets für lokale Lint-/Paketaufrufe; die Advisories werden dadurch nicht als behoben ausgegeben. Alte Messungen bleiben an ihre damaligen Werkzeuge und Paketbytes gebunden.
