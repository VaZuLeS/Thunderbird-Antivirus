# Screenshot-Aufnahmeanleitung — Thundy AV (Thunderbird-WebExtension)

**Add-on:** Thundy AV – Email Scanner for Thunderbird, Version 1.6
**Status:** Es existieren noch **keine** echten Screenshots; im Repository liegen nur
SVG-Platzhalter (`docs/screenshots/*.svg`). Dieses Dokument beschreibt,
wie die realen Aufnahmen erstellt werden.

## 1. Voraussetzungen

- Thunderbird mit einer Version ≥ `strict_min_version` (140.0), geprüft auf 140 ESR.
- Node.js + npm (für `web-ext`; das Repository führt `web-ext` nicht als Abhängigkeit, das Paket
  wird über `npx` bezogen).
- Ein Testpostfach mit mindestens einer Nachricht, die einen Anhang und einen Link enthält.
  Absender, Betreff und Dateinamen müssen frei erfundene Testdaten sein.
- Für die Anzeige von Analyseergebnissen: ein kostenloser Hybrid-Analysis-API-Schlüssel
  (siehe Schritt 5).

## 2. Erweiterung bauen und laden

1. Abhängigkeiten installieren und Tests laufen lassen (optional, aber empfohlen):

   ```bash
   npm ci
   node --test --test-reporter=spec
   ```

2. Paket bauen:

   ```bash
   npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
   ```

3. In Thunderbird laden (empfohlener Weg):

   - Menü ☰ → **Add-ons und Themes** → Zahnrad-Symbol → **Debug-Add-ons**
     (`about:debugging#/runtime/this-firefox`)
   - **Temporäres Add-on laden …** → im Dateidialog `manifest.json` aus dem Repository auswählen
     (alternativ die in `./build` erzeugte ZIP-Datei).

4. Alternative mit `web-ext run`:

   ```bash
   npx web-ext run --firefox=/pfad/zu/thunderbird
   ```

   In `web-ext` existiert **kein** `--target thunderbird` (und auch kein `--target firefox`);
   `--firefox` erwartet den Pfad zur Thunderbird-Binärdatei, unter Windows z. B.
   `C:\Program Files\Mozilla Thunderbird\thunderbird.exe`.

5. Konfiguration vor der Aufnahme:

   - Optionsseite des Add-ons öffnen und den Hybrid-Analysis-API-Schlüssel eintragen (kostenlose
     Registrierung unter `https://www.hybrid-analysis.com/signup`) und speichern.
   - Checkbox „Externe Analyse erlauben“ aktivieren (Standard: aus). Beim Speichern fragt die Seite – wo die
     Umgebung es anbietet – zusätzlich die eingebaute Datenkategorie `personalCommunications` an; diese bestätigen,
     damit die Datenübermittlung im Optionsdialog konsistent bleibt. Danach die Host-Berechtigung für den Anbieter
     erteilen.
   - Datenschutz-Stufe bewusst wählen (`strict` = nur SHA-256-Hashes, `balanced` = zusätzlich
     vollständige Anhänge unbekannter Dateien, `max` = zusätzlich URLs).

## 3. Die drei aufzunehmenden Zustände

| Nr. | Zustand | Vorgehen | Zieldatei |
|---|---|---|---|
| 1 | Optionsseite mit Konsent-Checkbox | Optionsseite des Add-ons öffnen; Checkbox „Externe Analyse erlauben“ und die Datenschutz-Stufe müssen sichtbar sein | `docs/screenshots/01-options-consent.png` |
| 2 | Opt-in-Banner mit den Buttons | Nachricht eines Absenders öffnen, für den kein Opt-in gespeichert ist; der Banner erscheint oberhalb der Nachricht mit den Buttons „Nur diese Nachricht scannen“ und „Absender dauerhaft scannen“ (zusätzlich „Einstellungen öffnen“) | `docs/screenshots/02-inline-optin-banner.png` |
| 3 | Threat-Banner | Zustimmung erteilen und einen Scan auslösen bzw. eine Nachricht mit auffälligem Inhalt öffnen (Risiko-Score ≥ 50); der Bewertungs-Banner zeigt Verdikt/Score und die Begründungsliste | `docs/screenshots/03-threat-banner.png` |

Für Motiv 2 und Motiv 3 gilt: Die In-Message-UI (gerendert von `message_display.js`, registriert über
`scripting.messageDisplay.registerScripts()`) ist in Thunderbird 140 ESR
**noch nicht manuell verifiziert**. Vor der Aufnahme ist dieser Test durchzuführen; erscheinen die
Banner im Testfall nicht, dürfen die Motive nicht als Screenshot eingereicht werden. Dasselbe gilt für
die optionalen Motive (Popup, Time-of-Click-Hinweis, Datenmanagement-Abschnitt).

## 4. Aufnahme

1. Fenster auf mindestens 1280 px Breite ziehen (der Screenshot soll mindestens 1200 px breit sein).
2. Betriebssystem-Werkzeug verwenden: Windows `Win+Shift+S` (Snipping Tool), macOS `Cmd+Shift+4`,
   Linux `gnome-screenshot -f datei.png` oder `flameshot`.
3. Nur den relevanten Ausschnitt aufnehmen (Optionsseite bzw. Nachrichtenansicht), ohne Taskleiste
   und ohne Tabs mit privaten Inhalten.
4. Datei als PNG in `docs/screenshots/` ablegen (Dateinamen siehe Tabelle in Abschnitt 3).

## 5. Anforderungen und Prüfung

- PNG, mindestens 1200 px breit, empfohlen 1280 × 800 px oder größer — der Motivinhalt muss auch im
  skalierten Vorschaubild erkennbar sein.
- Keine echten Nutzerdaten: private E-Mail-Adressen, Namen, Telefonnummern, Betreffzeilen und
  Anhänge durch Testdaten ersetzen; im Zweifel unkenntlich machen.
- Keine retuschierten UI-Zustände: was im Screenshot zu sehen ist, muss im Testlauf genauso
  aufgetreten sein.
- Nach der Aufnahme: Sichtprüfung der PNG-Dateien (Abmessungen z. B. über `file` oder `identify`) und
  Abgleich mit der Bedarfsliste in `docs/store_assets.md`.

## 6. Offene Punkte

- Es existieren **keine** echten Screenshots; `docs/store_assets.md` führt sie als „offen“.
- Das Add-on ist noch nicht im Store eingereicht; es gibt keine Store-URL und keinen
  Store-Download-Button.
