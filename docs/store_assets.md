# Store-Assets — Status

**Add-on:** Thundy AV – Email Scanner for Thunderbird (Version 1.23.0)
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
| Echte Aufnahmen | `docs/screenshots/` | **23 PNG** in Unterverzeichnissen; 10 davon mit ≥ 1200 px Breite (geprüft vom Submission-Gate, Kriterium C5) |

Die Icons werden von `scripts/generate-icons.js` reproduzierbar erzeugt (Schild-Motiv mit
Ausrufezeichen, 4-fache Supersampling-Kantenglättung, keine externen Abhängigkeiten). Die
Pre-Submit-Checks prüfen zusätzlich, dass jede in `manifest.json` deklarierte Icon-Größe als PNG
mit exakt dieser Kantenlänge vorliegt.

Die früheren drei SVG-Skizzen (`inline_optin_banner.svg`, `warning_banner.svg`, `options_page.svg`)
wurden am 16. Oktober 2026 entfernt; der einzige Ablageort für Aufnahmen bleibt `docs/screenshots/`.

## 2. Vorhandene echte Aufnahmen (unverändert aus realen Läufen)

| Verzeichnis | Inhalt | Breiten |
|---|---|---|
| `thunderbird-linux/` | Reale Thunderbird-140.17-ESR-GUI: natives Popup, gebrandeter Linkdialog, Auditansicht, Einstellungen (hell/dunkel) | 6 × 1152 px, 2 × 1280 px |
| `1.19.1/` … `1.22.0/` | Popup hell/dunkel, Linkdialog schmal/breit, Admin-Ansichten, Einrichtungsassistent (Wizard) in DE | 1152–1200 px |
| `enterprise-local/` | Lokale Unternehmensansichten (Review, Storage-Jobs, Storage-Status) | 1200 px |

## 3. Listing-Set für die ATN-Einreichung (Kuratierung)

Für das Store-Listing werden je Motiv Aufnahmen aus den vorhandenen realen Läufen verwendet; die
Dateien bleiben an ihrem Ursprungsort (Provenienz), die Zuordnung steht hier:

| Nr. | Motiv (ATN-Reihenfolge) | Datei | Größe | Status |
|---|---|---|---|---|
| 1 | Natives Nachrichten-Popup | `docs/screenshots/thunderbird-linux/native-popup.png` | 1280 × 1000 | **fertig** |
| 2 | Gebrandeter Linkdialog (Time-of-Click-Schutz) | `docs/screenshots/thunderbird-linux/link-dialog.png` | 1152 × 1000 | **fertig** (unterhalb der 1200-px-Empfehlung; Ersatz ✋ offen) |
| 3 | Einstellungen mit Datenschutz-Stufen | `docs/screenshots/thunderbird-linux/options-native-dark.png` | 1152 × 1000 | **fertig** (unterhalb der 1200-px-Empfehlung; Ersatz ✋ offen) |
| 4 | Lokale Auditansicht mit Protokolldaten | `docs/screenshots/thunderbird-linux/audit-de.png` | 1152 × 1000 | **fertig** (unterhalb der 1200-px-Empfehlung; Ersatz ✋ offen) |
| 5 | Einrichtungsassistent (Schritt Linkschutz) | `docs/screenshots/1.22.0/wizard-links-de.png` | 1200 × 900 | **fertig** |
| 6 | Opt-in-Banner mit beiden Buttons in der Nachrichtenansicht | — | — | **offen ✋** (Banner-Aufnahme existiert noch nicht; Motiv nur in echter Thunderbird-GUI aufnehmbar) |
| 7 | Warn-/Bewertungs-Banner in der Nachrichtenansicht | — | — | **offen ✋** (wie Motiv 6) |

Ergänzend nutzbar: `native-popup-de.png` (1280 × 1000) als deutschsprachige Popup-Variante.

## 4. Anforderungen an die Aufnahmen

- Format **PNG**; empfohlen wird eine Breite von 1280 px (1280 × 800); das Submission-Gate (C5)
  verlangt mindestens **eine** Aufnahme mit ≥ 1200 px Breite — erfüllt durch die Motive 1 und 5.
- **Keine echten Nutzerdaten:** die vorhandenen Aufnahmen verwenden ausschließlich synthetische
  `.invalid`-Adressen und lokale Testnachrichten.
- Pro Motiv genau ein Bild; keine Collagen, keine nachträglich eingefügten UI-Elemente — die
  Screenshots müssen die reale Oberfläche zeigen.
- Sprache: die Add-on-Oberfläche ist sechssprachig (EN/DE/FR/ES/IT/PL); für das Listing wird die
  englische Variante empfohlen, da ATN primär englischsprachige Reviewer hat. Motive 1–5 liegen
  derzeit in DE bzw. englischer Oberfläche vor; bei einer Neueaufnahme ✋ je Wunsch umstellen.

## 5. Erstellung

Die Anleitung zur Aufnahme steht in [screenshot_capture.md](screenshot_capture.md). Die
Thunderbird-GUI-Aufnahmen wurden mit `tools/thunderbird-live.dev.py` unter Xvfb erzeugt
([live_test_1_23_0.md](live_test_1_23_0.md), Abschnitt „Wiederholen“).

## 6. Offene Punkte (ehrlich)

- **Motiv 6 und 7 (Banner in der Nachrichtenansicht): offen ✋** — dafür muss eine Aufnahme in der
  echten Thunderbird-GUI erfolgen (Opt-in-Banner ohne gespeicherten Absender, Warn-/Bewertungs-Banner
  nach einem Scan). Beide Motive sind funktional geprüft ([live_test_1_23_0.md](live_test_1_23_0.md),
  Zeilen 4 und 10), aber noch nicht als Store-Bild vorhanden.
- **Breite der Motive 2–4 (1152 px):** unterhalb der 1280-px-Empfehlung; ATN skaliert Listing-Bilder,
  der Motivinhalt bleibt erkennbar. Ersatz-Aufnahmen mit 1280 px Breite sind optional ✋.
- **Promo-/Feature-Grafik:** optional, von ATN nicht zwingend gefordert — nicht vorhanden.
- Icons: **vorhanden** — alle deklarierten Größen liegen als PNG vor und werden vom Pre-Submit-Check
  auf die exakte Kantenlänge geprüft.
- Das Add-on ist noch **nicht** im Store eingereicht; es existiert keine Store-URL.
