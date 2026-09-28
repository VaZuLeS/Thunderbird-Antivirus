# Thundy AV — Branding und Designsystem

## Markenkern

- **Symbol:** Schild mit Ausrufezeichen (siehe `img/icon-*.png`) — steht für „Schutz mit Hinweis“.
- **Wortmarke:** „Thundy AV“ mit der Zeile *„E-Mail-Anhänge und Links prüfen – lokal zuerst.“*
- **Tonalität:** sachlich, warnend ohne Alarmismus, immer mit Begründung („warum“) und Handlungsoption.

## Farbwelt

| Rolle | Hell | Dunkel | Verwendung |
|---|---|---|---|
| Marke (Primär) | `#0b5fa5` | `#4c9be0` | Kopfzeile, Primärbuttons, Info-Kanten |
| Marke dunkel | `#073d6b` | `#0b5fa5` | Verlauf im Kopf, Überschriften |
| Signal (Akzent) | `#ff8c00` | `#ffab40` | Aufmerksamkeit, Fokusring, Time-of-Click |
| OK | `#1b7f3b` | `#4caf70` | verifizierter Absender, Erfolgsmeldungen |
| Hinweis | `#b26a00` | `#e0a33a` | Opt-in-Banner, Warnungen |
| Fehler | `#b3261e` | `#ef6f68` | Warnbanner, Fehlermeldungen |

Die Farben liegen als CSS-Variablen in `theme.css` (Erweiterungsseiten) und `messageDisplay/banner.css`
(Nachrichtenansicht). Beide Dateien enthalten eine `prefers-color-scheme: dark`-Variante, damit das Add-on in hellen und
dunklen Thunderbird-Themes korrekt aussieht. Wo Thunderbird eigene Variablen bereitstellt (`--toolbar-bgcolor`,
`--text-color`, `--border-color`), werden diese bevorzugt verwendet.

## Komponenten (Auszug)

| Klasse | Zweck |
|---|---|
| `.thundy-brand` + `.thundy-brand__mark` | Kopfzeile mit Logo und Wortmarke (Popup und Einstellungen) |
| `.thundy-section` | Inhaltsabschnitt mit Akzentkante links |
| `.card`, `.card-info`, `.card-warn`, `.card-error` | Statuskarten |
| `.thundy-badge--ok|warn|fail|info` | Zustandsanzeige (z. B. Diagnose) |
| `.thundy-score--low|medium|high` | Risikobewertung farblich gestuft |
| `#thundy-threat-banner`, `#thundy-optin-banner`, `#thundy-scan-status`, `#thundy-auth-badge` | Banner in der Nachrichtenansicht |
| `.thundy-banner-actions` | Aktionsleiste im Banner (Scannen/Hinweise) |

## Barrierefreiheit

- Fokusringe in Signal-Orange (`:focus-visible`) auf allen interaktiven Elementen.
- Statusmeldungen nutzen `role="status"`/`aria-live`, Banner-Icons sind `aria-hidden` mit Textalternative.
- Farbe ist nie das einzige Signal: Zustände tragen zusätzlich Text oder Symbol (✅/⚠️/❌).
- Kontrast: Marke-Blau auf Weiß ≈ 6,3:1, Signal-Orange nur für Rahmen/Fokus, nicht für Fließtext auf Weiß.

## Verwendung

- Neue UI-Elemente sollen die Variablen statt fester Farbwerte nutzen, damit Themes und Dark-Mode automatisch greifen.
- Die Banner in der Nachrichtenansicht dürfen **keine** Inline-Farben setzen; alle Stile kommen aus `banner.css`
  (wird zusammen mit dem Nachrichten-Script registriert).
