# Store-Assets — Status

**Add-on:** Thundy AV – Email Scanner for Thunderbird (Version 1.24.0)
**Stand dieses Dokuments:** 16. Oktober 2026
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
| Echte Screenshots (23 PNG) | `docs/screenshots/thunderbird-linux/` (8), `docs/screenshots/1.19.1/` (4), `docs/screenshots/1.20.0/` (2), `docs/screenshots/1.21.0/` (2), `docs/screenshots/1.22.0/` (3), `docs/screenshots/enterprise-local/` (4) | vorhanden — reale Aufnahmen; Herkunft und Prüfweg: [THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md) |
| SVG-Skizzen (nur Entwurfsmotive) | `docs/screenshots/inline_optin_banner.svg`, `docs/screenshots/warning_banner.svg`, `docs/screenshots/options_page.svg` | historische Entwurfsskizzen, **nicht** für die Einreichung bestimmt |

Die Icons werden von `scripts/generate-icons.js` reproduzierbar erzeugt (Schild-Motiv mit
Ausrufezeichen, 4-fache Supersampling-Kantenglättung, keine externen Abhängigkeiten). Die
Pre-Submit-Checks prüfen zusätzlich, dass jede in `manifest.json` deklarierte Icon-Größe als PNG
mit exakt dieser Kantenlänge vorliegt.

Die drei SVG-Dateien in `docs/screenshots/` sind historische Entwurfsskizzen. Die früheren Dubletten
im Wurzelverzeichnis von `docs/` wurden entfernt, damit es genau einen Ablageort (`docs/screenshots/`) gibt.

Seit der Thunderbird-140.17-ESR-Teilabnahme (Oktober 2026) existieren echte PNG-Aufnahmen: 8 Aufnahmen
in `thunderbird-linux/` (Popup, Audit, Linkdialog, Einstellungen, Hell/Dunkel), dazu versionierte
Aufnahmen in `1.19.1/`–`1.22.0/` und vier Enterprise-Ansichten. Gate-Kriterium C5 ist seit dem
16. Oktober 2026 **PASS** (rekursive Screenshot-Suche, Befund FA-4); der Pre-Submit-Check meldet
0 Warnungen und findet alle 23 PNG.

## 2. Was fehlt

- ~~Echte PNG-Screenshots~~ **vorhanden:** 23 PNG in `docs/screenshots/` (siehe §1); Format PNG,
  empfohlene Größe 1280 × 800 px (Seitenverhältnis 1.6:1) — diese Größenangabe ist eine **Empfehlung**,
  keine Store-Pflicht. Pre-Submit-Check: 0 Warnungen; Gate C5: PASS.
- **Promo-/Feature-Grafik** (optional, von ATN nicht zwingend gefordert).
- Optional: Banner-Motive (Opt-in-/Warnbanner) aus der Live-Abnahme ergänzen (Aufgabe N-01/FA-A5,
  Aufgabenplan §15); die Banner sind Bestandteil der Nachrichtenansicht und nur im realen Client
  aufnehmbar.

## 3. Welche Screenshots gebraucht werden

| Nr. | Motiv | Dateiname (Vorschlag) | Inhalt |
|---|---|---|---|
| 1 | Optionsseite mit Konsent-Checkbox | `docs/screenshots/01-options-consent.png` | Checkbox „Externe Analyse erlauben“ (Standard: aus), Auswahl der Datenschutz-Stufe (`strict`/`balanced`/`max`), Felder für die Anbieter-Schlüssel |
| 2 | Banner mit beiden Opt-in-Buttons | `docs/screenshots/02-inline-optin-banner.png` | Opt-in-Banner in der Nachrichtenansicht mit **beiden** Buttons: „Nur diese Nachricht scannen“ und „Absender dauerhaft scannen“ |
| 3 | Threat-Banner | `docs/screenshots/03-threat-banner.png` | Warnbanner in der Nachrichtenansicht nach der Bewertung (Verdikt/Score, Begründungsliste) |

Optional ergänzend: Popup der Nachrichten-Display-Aktion und der Abschnitt „Datenmanagement“
(Cache leeren) der Optionsseite.

## 4. Anforderungen an die Aufnahmen

- Format **PNG**; empfohlen wird eine Breite von 1280 px (Seitenverhältnis 1.6:1, also 1280 × 800 px). Die
  Größe ist eine **Empfehlung**, keine Store-Pflicht — der Motivinhalt muss nur auch im skalierten
  Vorschaubild erkennbar sein.
- **Keine echten Nutzerdaten:** private Absenderadressen, Namen, Betreffzeilen, Dateinamen und
  Anhangsinhalte durch Testdaten ersetzen oder unkenntlich machen.
- Pro Motiv genau ein Bild; keine zusammengesetzten Collagen und keine nachträglich eingefügten
  UI-Elemente — die Screenshots müssen die reale Oberfläche zeigen.
- Sprache der Oberfläche: vollständig lokalisiert in EN/DE/FR/ES/IT/PL (seit 1.19.0); Aufnahmen in
  einer gemeinsamen Sprache wählen und die unterstützten Sprachen im Listing angeben.

## 5. Erstellung

Die Anleitung zur Aufnahme steht in `docs/screenshot_capture.md`. Die dortigen Angaben wurden gegen
den tatsächlichen Build-/Test-Workflow des Repositories korrigiert (`npx web-ext build`,
`about:debugging` → „Temporäres Add-on laden“, alternativ
`web-ext run --firefox=/pfad/zu/thunderbird`).

## 6. Offene Punkte (ehrlich)

- Screenshots: **erledigt** — 23 reale PNG in `docs/screenshots/`; Gate C5 PASS (seit 16. Oktober 2026).
  Optional: Banner-Motive aus der Live-Abnahme ergänzen (N-01/FA-A5).
- Icons: **vorhanden** — alle in der `manifest.json` deklarierten Größen (16/32/48/64/128 px) liegen als
  PNG vor und werden vom Pre-Submit-Check auf die exakte Kantenlänge geprüft. Offen ist allenfalls die
  **subjektive Qualität der kleinen Größen** (32 px/64 px) im Vergleich zur 128-px-Fassung.
- Die Verifikation der Banner-Injektion in Thunderbird 140 ESR ist Teil der offenen Live-Abnahme
  (C6/T18/FA-A5, Aufgabenplan §15, Aufgabe N-01). Optionale Banner-Motive für das Listing sind danach
  aufnehmbar.
- Das Add-on ist noch **nicht** im Store eingereicht; es existiert keine Store-URL.
