# AVN-017 — Berichtsschaltflächen zuverlässig an Ressourcen binden

Die folgenden Implementierungs- und Prüfstände sind historische Nachweise vor der Freigabe. Aktueller [Freigabeumfang und Veröffentlichungsstatus](VEROEFFENTLICHUNG_1_24_5.md); frühere Paketnachweise bleiben an ihre damaligen Bytes gebunden.

Stand: **4. November 2026**. Primärbereich: Bedienung und Ressourcenzuordnung; Entwicklungstyp: **Optimierung / Verbesserung**. Priorität **P1 vor Freigabe der angekündigten Berichtsaktionen**, Aufwand **M**. Umsetzung im noch offenen [PR #741](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/741), weiterhin unveröffentlichte 1.24.5.

## Auswahl nach Analyse der offenen Arbeiten

Der [Ladefix und die gemeinsamen Dienstkarten](HOTFIX_ANALYSEERGEBNISSE_1_24_5.md) sind bereits umgesetzt. Die weitere Prüfung der nun sichtbaren Berichte zeigt einen konkreten Bedienfehler, der ohne zusätzliche Anbieterzugänge reproduzierbar ist. Er erhält Vorrang vor einer neuen Erweiterung: Ein sichtbares lokales Bereinigungsangebot und eine angekündigte Scanaktion müssen tatsächlich bedienbar sein.

| Arbeitspaket | Befund / nächster sinnvoller Schritt |
| --- | --- |
| **AVN-017 — hier umgesetzt** | Nicht eingefügte Berichtskarten erhalten keine Handler; gleiche Dateihashes erzeugen doppelte Steuerelement-IDs. Unmittelbarer Funktionsausfall, reproduzierter Gegenfall und lokal verfügbare Validierung. |
| AVN-009 / [#725](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/725) | Dauerhafte Vorkommensbindung und Retention bleiben P1-Untersuchung; Vertragsentscheidung und datenbewahrende Migration haben größeren Umfang. Die neuen lokalen DOM-IDs ersetzen diesen Vertrag nicht. |
| AVN-007.c / [#730](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/730) | Normale Suchaufgaben, schmale Ansichten und menschlicher Sprachreview bleiben separat. Funktionsreparatur schließt diese Abnahme nicht pauschal ab. |
| AVN-008.b / [#731](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/731) | Unterstützten Advisoryweg weiterhin untersuchen; keine ungeprüfte Dependencyreparatur als Nebenwirkung dieses Fixes. |

## Reproduzierter Fehler

`api.js` baut gespeicherte Berichte in `DocumentFragment`s auf. `render_hybrid_report_ui` ruft dabei `setupRescanButton` und `setupCdrButton` auf, bevor die Karten in das Dokument eingefügt werden. Deren globale `document.getElementById`-Suche findet die Schaltflächen zu diesem Zeitpunkt nicht. Die Schaltflächen erscheinen später, besitzen aber keine Klickbehandlung. Komponentenprüfungen mit vorab global registrierten Mockelementen deckten diese Einfügefolge nicht ab.

Zusätzlich waren die Steuerungs- und Status-IDs ausschließlich aus dem Dateihash abgeleitet. Zwei bytegleiche Anhänge in verschiedenen MIME-Parts erhalten denselben Hash, brauchen aber getrennte Aktionen und Statusmeldungen. Ein URL-Bericht wurde außerdem wie ein Anhang behandelt; eine URL mit `.html` konnte eine unpassende lokale Anhangbereinigung anbieten.

Der native Gegenversuch verwendet das zuvor geprüfte **1.24.5-Paket mit SHA-256 `34a59923e3ce8d6d8586e9e8514dc7dfe679933d2a049754be30350d93c7381a`**. Zwei gleichartige HTML-Anhänge erscheinen korrekt, aber ein echter DOM-Klick löst keine Hintergrundnachricht aus; die Steuerelement-IDs sind doppelt. Dies ist eine native Reproduktion des vorbereiteten Vorgängerstands, keine neue Live-Providerabnahme.

## Umsetzung und überprüfbare Ergebnisse

- Schaltflächen werden innerhalb ihrer konkreten Berichtskarte gebunden. Der Handler und die Statussuche funktionieren bereits beim Aufbau im Fragment und später im Dokument.
- Jede tatsächliche Berichtskarte erhält eigene lokale Steuerungs-IDs. Diese kurzlebigen Präsentations-IDs werden weder gespeichert noch als Nachrichten-/Ressourcenidentität verwendet. `aria-describedby` verweist auf die Statuszeile derselben Karte.
- Anhang-Rescans verwenden den gebundenen Nachrichten-/MIME-Part-Kontext. URL-Rescans verwenden `scanUrl` mit der tatsächlich gebundenen URL und dem Nachrichtenkontext; URL-Berichte bieten keine lokale Anhangbereinigung an.
- Fehlt eine belastbare Ressourcenbindung, bleibt der Bericht lesbar, seine Scanaktion aber deaktiviert. Das Anzeigen allein startet keine Aktion.
- Doppelte Klicks während einer laufenden Aktion und Klicks auf ersetzte, nicht mehr eingefügte oder geschlossene Berichtskarten lösen keine zweite/fremde Aktion aus.
- Statusmeldungen bleiben bei der richtigen Karte. Die bestehenden Hintergrundprüfungen für Einwilligung, Schlüssel, Datenschutzstufe und Hostberechtigung bleiben für die Anfragen zuständig. Eine abgewiesene Anfrage wird nicht als abgeschlossene Analyse ausgegeben.
- HTML-Bereinigung bleibt lokal und funktioniert auch bei ausgeschalteter externer Analyse. Gespeicherte Berichtspayloads werden durch das Anzeigen, eine abgewiesene Scanaktion und den lokalen Download nicht verändert.

`renderReport`/`renderActionButtons` und die bestehenden separat aufrufbaren Setupfunktionen behalten ihre bisherigen Standardparameter. Die tatsächliche Popupdarstellung übergibt ausdrücklich den lokalen Kartenkontext. Der manuelle Erstprüfungs-/Uploadbereich ist ein eigener Ablauf; die hier nachgewiesenen Aussagen betreffen die dargestellten Berichtskarten.

## Validierung und Testumgebungen

[Maschinenlesbarer Vorher-/Nachher-Beleg](audits/report-controls-2026-11-04.json).

Die DOM-Regression führt den vollständigen Popupstart aus und klickt anschließend die realen DOM-Schaltflächen. Sie prüft richtige Hintergrundnachrichten, gleiche Hashes bei verschiedenen Parts, Statusisolation, gültige ARIA-Verweise, Doppelklicks, Kartenersetzung, Schließen und unbekannte Bindungen. URL-Routing und Hintergrundantworten sind dabei simuliert; es werden keine Anbieter kontaktiert.

Die native Ergänzung `--report-actions-check` verwendet dagegen echtes Thunderbird mit zwei bytegleichen HTML-Anhängen. Ein Beobachter in einer getrennten Add-on-Seite zeichnet die tatsächlich gesendeten Nachrichten auf, ohne sie zu ersetzen oder selbst zu beantworten. Der erste Rescan wird bei ausgeschalteter externer Analyse vor einer Übermittlung abgewiesen. Die zweite Karte löst die lokale HTML-Bereinigung aus; ein echter GTK-Dialog speichert die Datei. Der Prüfer bindet sich an deren neue tatsächliche Download-ID, liest die fertigen Bytes und prüft, dass der Testinhalt erhalten und das Skript entfernt ist. Die ursprünglichen Berichtspayloads bleiben unverändert.

Der HTML-Dateidialog unter 153 behandelte die zunächst gesendete Eingabetaste als Navigation. Die abschließende Probe aktiviert deshalb im englischen Testdialog ausdrücklich „Speichern“. Fehlgeschlagene Dialogversuche werden nicht als fehlgeschlagene Anwendungsklicks oder erfolgreiche Downloads ausgegeben; nur tatsächlich abgeschlossene Downloads zählen. Die normalen JSON-Downloadprüfungen nutzen denselben extrahierten Downloadbeobachter und behalten ihre Inhalteprüfung.

```sh
node --test test/popup-loading.test.js api.test.js test/report-lifecycle.test.js
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.5.xpi \
  --report-actions-check --out /absolute/path/to/new-result-directory
```

Es handelt sich um echte Linux-Client-/Dateidialogprüfungen mit synthetischen Mails und Protokollen. Klicks werden im echten DOM ausgelöst, der Dateidialog wird über X11-Tasten bedient; dies ist keine menschliche Screenreaderabnahme. Erfolgreiche Anbieterübermittlung und Livekonten bleiben separat. Windows/macOS und automatischer Updatekanal behalten ihre bestehenden Voraussetzungen. Alte Paketnachweise bleiben an ihre damaligen Bytes gebunden; der erweiterte Kandidat erhält eigene Nachweise. **1.24.5 ist weiterhin unveröffentlicht.**
