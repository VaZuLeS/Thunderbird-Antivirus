# Analyseergebnisse: Ladeabbruch und gemeinsame Dienstkarten — 1.24.5

Stand: **4. November 2026**, unveröffentlichter Bugfix nach dem GitHub-Release 1.24.4. Auftrag: „Unerwarteter Fehler beim Laden der Analyseergebnisse“ beheben und die Ergebnisse aller externen Dienste im Popup und direkt in der Nachricht verständlich darstellen.

Der folgende Text und sein maschinenlesbarer Beleg dokumentieren den ersten Lade-/Darstellungsfix. Die anschließende [Umsetzung AVN-017 zu Berichtsschaltflächen](BERICHTSAKTIONEN_1_24_5.md) erweitert denselben PR um funktionierende, getrennte Aktionen und besitzt eigene Paket-/Clientnachweise. Frühere Paketbytes und Testsummen werden nicht auf diesen Folgeumfang umetikettiert.

## Reproduzierter Fehler und Korrektur

Die gemeldete Zeichenfolge gehört zum allgemeinen Ladefehler in `api.js`, nicht zu einer konkreten HTTP-Antwort von Hybrid Analysis. Beim Öffnen kann ein gespeicherter Bericht den Renderer abbrechen: `tags.join()` setzt eine Liste voraus, Scannerzeilen können leer sein und `anti_virus_results` muss nicht die erwartete Liste enthalten. Ein solcher Fehler in einem Einzelbericht verwarf bisher über `Promise.all` den gesamten Ergebnisbereich. Der reale Nutzerbericht wurde nicht exportiert oder eingesehen; die Untersuchung reproduziert denselben Fehlerpfad mit kontrollierten Testdaten.

Der native Gegenlauf mit dem **veröffentlichten 1.24.4-XPI** bestätigt die Meldung unter Thunderbird 153.6.0: Ein synthetischer gespeicherter Bericht mit `tags` als Text und abweichenden Scannerfeldern verhindert auch die Anzeige eines zweiten gültigen Berichts. Externe Analyse bleibt dabei ausgeschaltet; ein Providerkonto oder tatsächlicher Netzfehler ist für diesen Absturz nicht erforderlich.

Die Korrektur in `api.js`:

- akzeptiert Tags als Text oder Liste und prüft optionale Scanner-/AV-Listen vor der Verarbeitung;
- macht nicht unterstützte Teilfelder in allen sechs Sprachen sichtbar, erhält aber die darstellbaren Ergebnisse;
- isoliert einen unerwartet unlesbaren Einzelbericht, sodass andere Berichte verfügbar bleiben;
- zeigt fehlende/ungültige Scores und Urteile neutral als unbekannt statt als positives Ergebnis an;
- entfernt die doppelte Taganzeige; schreibt gespeicherte Protokolle und historische Entscheidungen nicht um.

Fehlende Scannerangaben erscheinen als unbekannt. Fehlt dem Bericht das Hashfeld, zeigt die Detailansicht den bereits gebundenen Ressourcenhash; ohne beides bleibt der Wert unbekannt. Eine Dateigröße von null Byte bleibt null und wird nicht als fehlend angezeigt.

Die allgemeine Fehlermeldung bleibt für echte Lade-/Speicherfehler erhalten. Die neue Diagnose protokolliert lediglich eine feste Fehlerkategorie, keine Rohantworten, URLs, Schlüssel oder Mailinhalte. Dies ist kein Nachweis, dass jede denkbare Ursache derselben allgemeinen Meldung beseitigt ist.

## Gemeinsame GUI für alle fünf Dienste

`analysis_status.js::render` erzeugt dieselben themenfähigen Dienstkarten für Popup und Inline-Nachrichtenansicht. Hybrid Analysis, VirusTotal, URLhaus, AbuseIPDB und urlscan.io zeigen ihre **aus den jeweiligen Antworten klassifizierten Ergebnisse bereits vor dem Aufklappen**. Unterschiedliche vorhandene Urteile bleiben nebeneinander sichtbar; ein unbekannter Teilbefund verschwindet nicht hinter einem anderen Ergebnis ohne Erkennung.

Anfragezustand und Ergebnis bleiben getrennt. Ein übermittelter Auftrag ist kein Analyseabschluss, eine unbekannte/fehlerhafte Antwort keine Entwarnung. Herkunftsangaben unterscheiden externe Antwort, Cache, gespeicherten Befund und Anfrageversuch. Ressourcenbezug und ursprüngliche Zeiten bleiben in den vorhandenen Details erhalten. Darstellung und Warnungen verwenden gemeinsame Themefarben, responsive Karten, Textkennzeichnungen und die bestehende Tastatur-/Fokuslogik. Das Rendern startet keine zusätzliche Anfrage.

Es werden weder neue Provider aktiviert noch deren APIs, Scoreschwellen, Freigaben oder Datenschemata geändert. Die GUI verwendet den vorhandenen `ThundyAnalysis.response`-/Ereignisvertrag; sie zeigt keine erfundenen Vollprotokolle oder Messwerte anderer Dienste.

**Native Bildschirmaufnahmen mit synthetischen Testdaten:** [Dienstkarten im Popup](screenshots/1.24.5/provider-cards-synthetic.png) · [Inline-Nachrichtenansicht](screenshots/1.24.5/inline-provider-cards-synthetic.png) · [Darstellbarer Hybrid-Analysis-Bericht mit Teilhinweis](screenshots/1.24.5/hybrid-report-synthetic.png). Gezeigte Erkennungen und Providerbeobachtungen sind keine tatsächlichen Livebefunde.

## Nachweise und Grenzen

[Maschinenlesbarer Vorher-/Nachher-Beleg](audits/hybrid-popup-fix-2026-11-04.json). Der vollständige lokale Lauf besteht mit **1.072 automatisierten Tests**. Je **125 gezielte Prüfungen** unter Node 22 und 24 sowie drei Python-Byte-Regressionen bestehen ebenfalls. Die neuen Regressionen prüfen den vollständigen Popupstart mit gespeicherten Protokollen, Fehlerisolierung, unveränderte Daten und sechs Sprachen. Weitere Modell-/Renderprüfungen verwenden die echten Providerklassifizierungen, einschließlich leerer Antworten und HTTP 401/429/500 für alle fünf Dienste, sowie den serialisierten Inline-Renderer.

Die native Ergänzung `tools/thunderbird-live.dev.py --hybrid-popup-check` importiert eine echte synthetische MIME-Mail mit zwei Anhängen, berechnet deren tatsächliche Hashes und legt kontrollierte Protokolle ab. Sie öffnet das echte Toolbar-Popup und vergleicht Berichtsanzeige, fünf Dienstkarten in beiden Ansichten und unveränderte gespeicherte Protokolle. Der Baseline-Schalter erwartet den alten Fehler ausdrücklich und ist nur für den Gegenversuch vorgesehen. Der endgültige Bereitschaftstest wartet auf Betreff und fertig aufgebaute Ergebnisfläche; eine frühe 140-Probe las vor dem Modulstart und ist kein Produktfehlernachweis.

Native Endläufe unter Linux **140.12.0 und 153.6.0** bestehen. Das manuelle Upgrade von 1.24.4 unter 153 besteht mit drei normalen und zwei SIGKILL-Neustarts sowie Profilrestore. Die CI erhält den neuen nativen Fall; ihr gehashter Vorgänger ist nun das veröffentlichte 1.24.4-XPI. Ein neuer Remote-CI-Erfolg wird aus lokalen Ergebnissen nicht abgeleitet.

Die Providerantworten sind **simuliert**, die Thunderbird-APIs, MIME-Daten, Popup-/Nachrichtenansichten und Wiederanläufe **echt**. Reale Anbieterzugänge und der konkrete Nutzerbericht standen nicht zur Verfügung. Windows/macOS, native Screenreader, Livequoten und automatische Updates sind damit nicht abgenommen. Die allgemeine [Roadmap](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/740) behält diese Grenzen.

```sh
node --test test/popup-loading.test.js test/analysis-sources.test.js api.test.js test/report-lifecycle.test.js
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.5.xpi \
  --hybrid-popup-check --out /absolute/path/to/new-result-directory
```

**1.24.5 ist noch nicht veröffentlicht.** 1.24.4 und dessen Assets bleiben unverändert. OPENED bestätigt weiterhin nur Thunderbirds Annahme; PENDING wird nach Prozessverlust nicht in eine Entscheidung umgedeutet.
