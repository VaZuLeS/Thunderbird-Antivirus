# Reproduzierbare Browser- und Zugänglichkeitsprüfung

Stand: 15. Oktober 2026. Dieser ausführbare Teil von [UX05](DESIGNSYSTEM.md) überführt die bisherigen lokalen Browsernachweise in einen versionierten Prüflauf und einen eigenen CI-Job. Er prüft echte HTML-/CSS-/JavaScript-Dateien und signaturgeprüfte Offline-Adminrenderer mit synthetischen Daten. Thunderbird-APIs werden im Browser simuliert.

## Lokal ausführen

```sh
npm ci
npx playwright install --with-deps chromium
npm run check:ui

# Kleiner Entwicklungslauf: 34 Fälle, EN/DE, schmale dunkle Ansichten
npm run check:ui -- --matrix smoke

# Eine Sprache: 100 Fälle, dieselben Regeln wie im vollständigen Lauf
npm run check:ui -- --lang pl

# Einen Nutzerweg gezielt prüfen; unbekannte Ansichten werden abgewiesen
npm run check:ui -- --view message

# Bereits vorhandenes Chromium verwenden; Version wird im Bericht erfasst
npm run check:ui -- --matrix smoke --browser /usr/bin/chromium
```

`playwright` und `@axe-core/playwright` sind exakt gepinnte Entwicklungsabhängigkeiten. Der Playwright-Browserdownload findet nur bei der Einrichtung statt. Für den Prüflauf selbst werden die Seiten ausschließlich auf einer zufällig vergebenen Loopback-Adresse bereitgestellt. Unbekannte Argumente, Sprachen und Ansichten führen zum Abbruch. `--view` akzeptiert eine vorhandene Ansicht, beispielsweise `message`, `audit.html` oder `popup.html`; auch dann muss mindestens ein Prüffall ausgeführt werden. `--out <Verzeichnis>` bestimmt den Ausgabeordner; jeder Lauf erhält darin ein eigenes Unterverzeichnis.

`npm run check` bleibt das Browser-unabhängige Gesamtgate. Die CI führt daneben `check:ui` mit dem zum gepinnten Playwright gehörenden Chromium aus, getrennt für EN, DE, FR, ES, IT und PL. Ein Fehler in einer Sprache bricht die anderen Sprachprüfungen nicht ab. Generiertes Design-CSS und Referenz werden ebenfalls ausdrücklich in der CI geprüft.

## Umfang

| Bereich | Prüffälle im vollständigen Lauf |
| --- | --- |
| Acht Offline-Adminansichten | Ereignisse, Storage, Fälle, Betriebszustand, Geräte, Heartbeat-Alarme, Kapazität und Kapazitätswarnungen; sechs Sprachen, gefüllte/leere bzw. nie gemeldete Zustände, 320/1280 CSS-Pixel und helles/dunkles Systemfarbschema: 384 Fälle |
| Sechs Add-on-Seiten | Einstellungen, Einrichtung, optionale Unternehmensprofile, lokales Linkprotokoll, Datenschutz und Popup; sechs Sprachen, zwei Breiten und beide Systemfarbschemata sowie zusätzliche gefüllte Popup-/Auditansichten: 192 Fälle |
| Nachrichten-Linkdialog | Tatsächlich serialisiertes Nachrichtenskript, sechs Sprachen, 320/1280 CSS-Pixel und beide Systemfarbschemata: 24 Fälle |
| Gesamt | 600 Fälle; je Sprache 100 |

Das Popup behält seinen bewusst festen Mindestplatz von 600 CSS-Pixeln. Seine schmale Prüfgröße ist daher 600 statt 320 Pixel; die tatsächliche Größe wird in jedem Ergebnis angegeben. Ein Browserdokument prüft diesen Größenvertrag, aber nicht die native Thunderbird-Popupvermessung. Das verhindert, dass ein generischer Responsive-Test die frühere Streifenregression durch Entfernen der Mindestbreite erneut einführt.

Jeder Fall prüft initiales Systemtheme, Dokumentensprache, horizontalen Seitenüberlauf, Seitenfehler und unerwartete externe Seitenanfragen. Externe Anfragen werden vor der Zustellung blockiert und als Fehler behandelt. Die vollständigen Laufzeitdateien werden von einer festen Allowlist bereitgestellt; Testschlüssel, Journale und beliebige Repositorydateien sind keine Serverressourcen.

Zusätzlich werden auf passenden Seiten ausgeführt:

- Offline-Themeauswahl mit Enter/Leertaste/Pfeiltasten, Akzent und Informationsdichte; Prüfung der angewendeten Darstellung und des anschließenden Layouts.
- Vollständiger Admin-JSON-Download vor und nach einem Filterwechsel; gefilterte Anzeige verändert den Exportvertrag nicht.
- Alle vier Einstellungsakzente, kompakte Dichte und Nachweis, dass Darstellungsänderungen weder Zustimmung ändern noch Berechtigungsdialoge auslösen.
- Profilentwurf ändern, verwerfen und bei simuliertem Speicherfehler erhalten.
- Einrichtungsnavigation mit Fokus auf die jeweilige Schrittüberschrift.
- Löschdialog des lokalen Linkprotokolls mit automatischem Zugänglichkeitscheck, Escape und Fokusrückkehr, ohne Daten zu löschen.

Popup und Linkprotokoll werden sowohl leer als auch mit synthetischen Daten geprüft. Das gefüllte Popup erhält eine ausgewählte Testnachricht und einen lokalen Score ohne externe Zustimmung. Die Auditansicht verbindet URL, damaligen Score und Entscheidung, filtert abgebrochene Einträge und exportiert diese mit unverändertem JSON-Schema und überprüfter Prüfsumme.

Der Nachrichtenfall verwendet die tatsächlich von `message_ui.js` an `scripting.executeScript` übergebene Funktion; die Dialogoberfläche wird nicht im Test nachgebaut. Er prüft echte Klick-/Auxclick-/Tastaturereignisse, Shadow-DOM-Isolation gegen aggressive Nachrichten-CSS, Fokusführung, Abbrechen während der Prüfung, Escape, Öffnungsfehler, Wiederholen mit derselben Interaktions-ID und Verweigerung eines nachträglich geänderten Linkziels. `CLEAN`, `UNKNOWN` und `MALICIOUS` behalten getrennte Darstellungen. Hintergrundantworten und Browserübergabe bleiben simuliert; kein externes Ziel wird geöffnet und keine reale Audit-Persistenz damit bewiesen.

Tatsächliche Nachrichten, Providerantworten, native Berechtigungsdialoge und Betriebssystemintegration gehören weiterhin zu den bestehenden Funktions- und Live-Prüfungen. Dieser Lauf ist keine vollständige End-to-End-Abnahme aller Nachrichtenaktionen.

## Automatische Zugänglichkeitsregeln und Grenzen

axe prüft die sichtbare Ausgangsansicht jeder Add-on-/Adminansicht und den geöffneten Nachrichten-Linkdialog mit `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` und `best-practice`. Keine gefundene Verletzung wird durch eine projektspezifische Regel-Ausnahme ausgeblendet. Im Nachrichtenfall ist der axe-Kontext auf den eigenen Linkdialog begrenzt: Die absichtlich aggressive CSS-Testnachricht ist fremder Inhalt und kein Produktbestandteil. Der Durchlauf meldet unter anderem fehlende Namen/Labels, bestimmte Kontrastfehler, Landmark-Probleme und fehlende Tastaturzugänglichkeit von Scrollbereichen. Manuell zu beurteilende axe-Ergebnisse bleiben als `incomplete` im JSON erhalten.

Die Prüfung nach Darstellungswechseln kontrolliert Funktion und Layout. Der anfängliche automatische axe-Scan ist kein Scan sämtlicher kombinierbarer Akzent-/Dichte-/Themezustände; die Token-Kontraste werden zusätzlich durch die bestehenden Design-Unit-Tests geprüft. Das ist keine WCAG-Zertifizierung und kein Nachweis einer realen Screenreader-Nutzung.

Reale Thunderbird-/OS- und Screenreader-Abnahme, 200-%-Zoom im Client, native High-Contrast-/Theme-Änderungen, Nachrichten-Linkdialoge in echtem Thunderbird sowie produktives SSO/RBAC bleiben offen. [UX05/UX06 und die produktiven Voraussetzungen](ENTERPRISE_NAECHSTE_SCHRITTE.md) werden dadurch nicht als abgeschlossen markiert.

## Nachweise und Fehler

Unter `.audit/ui/<Lauf-ID>/report.json` stehen Commit, ungespeicherter Quellstand, Browser-/Werkzeugversionen, Matrix, Beginn/Ende, jeder einzelne Fall, automatische Regelprüfungen und verbleibende manuelle axe-Befunde. Ein abgebrochener Lauf oder eine unvollständige Matrix führt ebenfalls zu einem Fehler. Fehlgeschlagene Fälle erhalten einen Screenshot; die CI bewahrt Berichte und Fehlerscreenshots für 14 Tage als Sprach-Artefakte auf. Die Nachweise bestehen ausschließlich aus synthetischen Testdaten.

Der erste Kurzlauf fand fehlende Hauptbereiche in zwei Offline-Renderern und vier Add-on-Seiten, einen nur farblich gekennzeichneten Datenschutzlink sowie eine nicht per Tastatur fokussierbare Audit-Tabelle. Diese Befunde wurden durch echte Hauptbereiche, sichtbare Linkunterstreichung, fokussierbare Scrollbereiche und einen benannten Löschdialog korrigiert. Bestehende Daten-, Export- und Signaturverträge bleiben erhalten; die Popup-Mindestbreite bleibt bestehen.

## Verifizierter Entwicklungsstand

`npm run check`: 946 Tests bestanden, 0 Lintfehler und 24 bekannte Thunderbird-Warnungen; Paketprüfung mit 44 Runtime-Dateien / 772.118 Bytes bestanden. Korrigierter Kurzlauf: 34/34 Fälle, zusätzlich alle 24 Nachrichten-Dialogfälle und 48 Audit-Sprach-/Layoutfälle bestanden mit Chromium 154.0.8037.57. Manuell zu beurteilende axe-Ergebnisse (`color-contrast`, `th-has-data-cells`) bleiben im Bericht erhalten. Der vollständige Matrixumfang beträgt inzwischen 600 Fälle; Ergebnisse und jeweilige Werkzeugversionen werden durch lokale Berichte und die sechs CI-Artefakte nachgewiesen.

## Historische Befunde im lokalen Linkprotokoll

Die gefüllten Browserfälle haben die Darstellung zum Entscheidungszeitpunkt zusätzlich überprüfbar gemacht. Die Auditansicht zeigt jetzt ausdrücklich den damaligen, sechssprachig lokalisierten Befund. Fehlt `verdictAtDecision` oder `providerAtDecision`, wird der spätere aktuelle Wert nicht als damaliger Wert eingesetzt. „Nicht verfügbar“ bleibt von „Ergebnis unbekannt“ und „Kein Fund“ getrennt. Der spätere Befund erscheint weiterhin mit seinem Prüfzeitpunkt in den Details. Exporte behalten ihre ursprünglichen technischen Kennungen und Werte. Sechs zusätzliche Regressionstests prüfen diese Trennung in EN/DE/FR/ES/IT/PL.
