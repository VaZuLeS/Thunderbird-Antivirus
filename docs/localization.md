# Lokalisierung

Thundy AV ist zweisprachig angelegt (Deutsch und Englisch). Thunderbird wählt die Sprache automatisch anhand der
Anwendungssprache; `default_locale` ist Englisch.

## Aufbau

| Datei | Inhalt |
|---|---|
| `_locales/en/messages.json` | Englische Strings (Standardsprache) |
| `_locales/de/messages.json` | Deutsche Strings |
| `ui_i18n.js` | Helfer für die Erweiterungsseiten: `thundyT()`, `thundyApplyTranslations()`, `thundyUiLanguage()` |
| `scripts/check-locales.js` | Prüft Katalogparität und ob alle verwendeten Schlüssel existieren |

## Wie es funktioniert

1. **Markup:** Elemente tragen `data-i18n="key"` (Text), `data-i18n-placeholder`, `data-i18n-aria`, `data-i18n-title`.
   Der deutsche Text steht **als Inhalt im Element** und dient gleichzeitig als Fallback.
2. **Laufzeit:** `thundyApplyTranslations()` ersetzt die Texte durch `browser.i18n.getMessage(key)` — falls ein Schlüssel
   fehlt, bleibt der deutsche Text stehen. Die Oberfläche ist dadurch nie leer.
3. **Hintergrund und Banner:** nutzen `msg()` bzw. `thundyText()` mit denselben Katalogen; auch dort existieren
   deutsche Fallbacks.

## Neue Sprache hinzufügen

```bash
mkdir -p _locales/fr
cp _locales/en/messages.json _locales/fr/messages.json
# Strings übersetzen, dann prüfen:
node scripts/check-locales.js
```

Der Prüfer ist Teil der Pre-Submit-Checks (`npm run pre-submit-checks`) und schlägt fehl, sobald ein Schlüssel in einer
Sprache fehlt oder in Markup/Code verwendet wird, ohne im Katalog zu stehen. Damit kann keine Übersetzung
„vergessen“ werden.

## Umfang

- Manifest (Name, Beschreibung, Action-Titel), Banner, Benachrichtigungen und die Optionen-/Popup-Oberfläche sind
  vollständig über Schlüssel abgedeckt (aktuell 125 Einträge je Sprache).
- Nicht übersetzt sind technische Ausgaben wie Diagnose-Details, Verlaufszeilen und Berichte — sie erscheinen in der
  deutschsprachigen Fachsprache. Diese Texte lassen sich schrittweise ebenfalls über Schlüssel führen; die Struktur ist
  dafür vorbereitet (`thundyT()` mit Fallback).
