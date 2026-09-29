# CI-Workflows (Spiegel)

Dieses Verzeichnis enthält die **vorgeschlagenen Workflow-Definitionen** für das Repository:

| Datei | Ziel im Repository | Zweck |
|---|---|---|
| `ci.yml` | `.github/workflows/ci.yml` | `npm ci`, Pre-Submit-Checks (Manifest, Rechte/Datenkonsent, Assets), vollständige Unit-Tests, `web-ext lint` mit Filter bekannter Thunderbird-False-Positives, XPI-Build und Paketprüfung |
| `release.yml` | `.github/workflows/release.yml` | manueller Signier-/Release-Job (`web-ext sign --channel listed|unlisted`) über die Secrets `ATN_API_KEY` und `ATN_API_SECRET` |

## Aktueller Stand im Repository

Aktiv ist weiterhin die **reduzierte** CI unter `.github/workflows/ci.yml` (Node 22): `npm ci`,
`node ./scripts/pre-submit-checks.js`, `node --test background.test.js` und `npx web-ext lint`. Sie führt damit
weder die vollständige Testsuite noch den Paket-Build aus.

Die Pre-Submit-Checks, die in beiden Varianten laufen, prüfen inzwischen zusätzlich:

- **benutzter API-Namespace ⇒ deklarierte Berechtigung** (genau der Fall, der die fehlende `menus`-Berechtigung
  unentdeckt ließ),
- die **Deklaration der Datenerhebung** (`data_collection_permissions`: u. a. dass `"none"` die Übermittlung nicht
  verschleiert),
- dass ein **programmatisch registriertes Skript** (`message_display.js`) im Paket liegt,
- dass jeder **lokalisierte UI-String** einen Katalogeintrag hat (derzeit 157).

Die vollständigen Definitionen in diesem Verzeichnis ergänzen das um die komplette `npm test`-Suite, den
Lint-Filter und `web-ext build` + `scripts/verify-package.js`.

## Warum liegen sie hier und nicht direkt unter `.github/workflows/`?

GitHub lehnt Pushes ab, die Workflow-Dateien anlegen oder ändern, wenn das verwendete Token
(App/CI-Token) nicht die Berechtigung **Workflows** besitzt:

```
refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml`
without `workflows` permission
```

Die inhaltliche Arbeit an den Workflows ist abgeschlossen, die Dateien konnten in dieser Umgebung
aber nicht in den Branch geschrieben werden. Alle referenzierten Skripte liegen bereits im
Repository:

- `scripts/pre-submit-checks.js` (echter Exit-Code, testbar)
- `scripts/filter-lint-warnings.js` (nur bekannte Thunderbird-False-Positives werden toleriert)
- `scripts/verify-package.js` (Paketinhalt und -größe)

## Übernehmen

1. Datei an die Zielstelle kopieren:

   ```bash
   cp docs/ci/ci.yml      .github/workflows/ci.yml
   cp docs/ci/release.yml .github/workflows/release.yml
   ```

   Kurzform in einer Zeile:
   `cp docs/ci/ci.yml .github/workflows/ci.yml && cp docs/ci/release.yml .github/workflows/release.yml`

   Das ist nur mit einem Token bzw. durch eine Person möglich, das/die die Berechtigung `workflows` besitzt –
   GitHub lehnt Pushes mit Workflow-Dateien sonst mit der oben zitierten Meldung ab.

2. Mit einem Token committen und pushen, das die Berechtigung `workflows` hat (z. B. ein
   persönliches Zugriffstoken mit `workflow`-Scope oder über die GitHub-Weboberfläche).

3. Für `release.yml` im Repository unter *Settings → Secrets and variables → Actions* die Secrets
   `ATN_API_KEY` und `ATN_API_SECRET` anlegen (API-Schlüssel unter
   https://addons.thunderbird.net/en-US/developers/addon/api/key/).

## Lokale Entsprechung

Alle Schritte lassen sich ohne GitHub Actions nachvollziehen:

```bash
npm ci
npm run pre-submit-checks
npm test
npx web-ext lint --source-dir . --output json > /tmp/lint.json
node scripts/filter-lint-warnings.js /tmp/lint.json
npx web-ext build --source-dir . --artifacts-dir ./build
node scripts/verify-package.js ./build
```
