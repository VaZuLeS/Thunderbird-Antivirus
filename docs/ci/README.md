# CI-Workflows (Spiegel)

Dieses Verzeichnis enthält die **vorgeschlagenen Workflow-Definitionen** für das Repository:

| Datei | Ziel im Repository | Zweck |
|---|---|---|
| `ci.yml` | `.github/workflows/ci.yml` | `npm ci`, Pre-Submit-Checks, vollständige Unit-Tests, `web-ext lint` mit Filter bekannter Thunderbird-False-Positives, XPI-Build und Paketprüfung |
| `release.yml` | `.github/workflows/release.yml` | manueller Signier-/Release-Job (`web-ext sign --channel listed|unlisted`) über die Secrets `ATN_API_KEY` und `ATN_API_SECRET` |

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

**Erneut verifiziert am 2026-09-29 (Audit-Befund M1):** Ein Push, der eine Workflow-Datei anlegt
oder ändert, wird weiterhin mit genau dieser Meldung abgelehnt. Die Übernahme von `docs/ci/ci.yml`
und `docs/ci/release.yml` nach `.github/workflows/` ist und bleibt damit ein **manueller** Schritt.

**Was die aktive CI derzeit ausführt** (`.github/workflows/ci.yml`, unverändert): `npm ci`, die
Pre-Submit-Checks (`node ./scripts/pre-submit-checks.js`), **nur** `node --test background.test.js`
als Testschritt und `npx web-ext lint`. Die übrigen Testdateien (`api.test.js`, `db.test.js`,
`options.test.js`, `api_gateway.test.js`, `scripts/pre-submit-checks.test.js`) laufen dort nicht —
genau das ändert `docs/ci/ci.yml` (vollständiger `npm test`, Lint-Filter, XPI-Build mit
Paketprüfung).

## Übernehmen

1. Datei an die Zielstelle kopieren:

   ```bash
   cp docs/ci/ci.yml      .github/workflows/ci.yml
   cp docs/ci/release.yml .github/workflows/release.yml
   ```

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
