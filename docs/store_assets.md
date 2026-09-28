# Store-Assets — Status

**Add-on:** Thundy AV – Email Scanner for Thunderbird (Version 1.6)
**Stand dieses Dokuments:** September 2026
**Ziel:** Thunderbird Add-ons Store (ATN) — Listung mit Screenshots und Icon

Dieses Dokument beschreibt den **tatsächlichen** Stand der Listing-Assets. Es werden keine Assets
als vorhanden bezeichnet, die es nicht gibt.

## 1. Was existiert

| Asset | Pfad | Status |
|---|---|---|
| Icon 16 px | `img/icon-16px.png` | vorhanden — generiert mit `node scripts/generate-icons.js` (PNG, 16 × 16 px) |
| Icon 32 px | `img/icon-32px.png` | vorhanden — generiert (PNG, 32 × 32 px) |
| Icon 48 px | `img/icon-48px.png` | vorhanden — generiert (PNG, 48 × 48 px) |
| Icon 64 px | `img/icon-64px.png` | vorhanden — generiert (PNG, 64 × 64 px) |
| Icon 128 px | `img/icon-128px.png` | vorhanden — generiert (PNG, 128 × 128 px), für Listing/Promo nutzbar |
| Screenshot-Platzhalter | `docs/screenshot-1-inline-optin.svg`, `docs/screenshot-2-warning.svg`, `docs/screenshot-3-options.svg` | SVG-Platzhalter, keine echten Aufnahmen |
| Screenshot-Platzhalter | `docs/screenshots/inline_optin_banner.svg`, `docs/screenshots/warning_banner.svg`, `docs/screenshots/options_page.svg` | SVG-Platzhalter, keine echten Aufnahmen |

Die Icons werden von `scripts/generate-icons.js` reproduzierbar erzeugt (Schild-Motiv mit
Ausrufezeichen, 4-fache Supersampling-Kantenglättung, keine externen Abhängigkeiten). Die
Pre-Submit-Checks prüfen zusätzlich, dass jede in `manifest.json` deklarierte Icon-Größe als PNG
mit exakt dieser Kantenlänge vorliegt.

Die drei SVG-Dateien in `docs/` und die drei SVG-Dateien in `docs/screenshots/` zeigen dieselben
drei Motive in zwei Ablageorten (Dublette). Vor der Einreichung ist ein Satz zu löschen.

## 2. Was fehlt

- **Echte PNG-Screenshots** (mindestens 1280 × 800 px, mindestens 1200 px breit) — es existiert
  **kein** PNG- oder JPG-Screenshot der Oberfläche im Repository. Die Pre-Submit-Checks geben dafür
  eine Warnung aus, bis die Aufnahmen vorliegen.
- **Promo-/Feature-Grafik** (optional, von ATN nicht zwingend gefordert).

## 3. Welche Screenshots gebraucht werden

| Nr. | Motiv | Dateiname (Vorschlag) | Inhalt |
|---|---|---|---|
| 1 | Optionsseite mit Konsent-Checkbox | `docs/screenshots/01-options-consent.png` | Checkbox „Externe Analyse erlauben“ (Standard: aus), Auswahl der Datenschutz-Stufe (`strict`/`balanced`/`max`), Felder für die Anbieter-Schlüssel |
| 2 | Banner mit beiden Opt-in-Buttons | `docs/screenshots/02-inline-optin-banner.png` | Opt-in-Banner in der Nachrichtenansicht mit **beiden** Buttons: „Nur diese Nachricht scannen“ und „Absender dauerhaft scannen“ |
| 3 | Threat-Banner | `docs/screenshots/03-threat-banner.png` | Warnbanner in der Nachrichtenansicht nach der Bewertung (Verdikt/Score, Begründungsliste) |

Optional ergänzend: Popup der Nachrichten-Display-Aktion und der Abschnitt „Datenmanagement“
(Cache leeren) der Optionsseite.

## 4. Anforderungen an die Aufnahmen

- Format **PNG**, mindestens 1200 px breit (empfohlen: 1280 × 800 px oder größer).
- **Keine echten Nutzerdaten:** private Absenderadressen, Namen, Betreffzeilen, Dateinamen und
  Anhangsinhalte durch Testdaten ersetzen oder unkenntlich machen.
- Pro Motiv genau ein Bild; keine zusammengesetzten Collagen und keine nachträglich eingefügten
  UI-Elemente — die Screenshots müssen die reale Oberfläche zeigen.
- Sprache der Oberfläche: Deutsch (die Oberfläche ist derzeit nur deutsch lokalisiert).

## 5. Erstellung

Die Anleitung zur Aufnahme steht in `docs/screenshot_capture.md`. Die dortigen Angaben wurden gegen
den tatsächlichen Build-/Test-Workflow des Repositories korrigiert (`npx web-ext build`,
`about:debugging` → „Temporäres Add-on laden“, alternativ
`web-ext run --firefox=/pfad/zu/thunderbird`).

## 6. Offene Punkte (ehrlich)

- Screenshots: **offen** — es existieren nur SVG-Platzhalter.
- Icon-Auflösungen: **offen** — 32 px und 64 px nur in minimaler Qualität vorhanden.
- Die Verifikation der Banner-Injektion in Thunderbird 140 ESR steht aus. Ohne diese Verifikation
  ist nicht belegt, dass Motiv 2 und Motiv 3 in der beschriebenen Form überhaupt auftreten; die
  Aufnahmen sind daher erst nach dieser Prüfung möglich.
- Das Add-on ist noch **nicht** im Store eingereicht; es existiert keine Store-URL.
