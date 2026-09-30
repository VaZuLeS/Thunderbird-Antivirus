# CI-Workflows (Spiegel)

Dieses Verzeichnis enthält die **fertigen Workflow-Definitionen**, die nach `.github/workflows/`
übernommen werden müssen:

| Datei | Ziel im Repository | Zweck |
|---|---|---|
| `ci.yml` | `.github/workflows/ci.yml` | `npm ci`, Pre-Submit-Checks, vollständige Unit-Tests, `web-ext lint` mit Filter bekannter Thunderbird-False-Positives, XPI-Build und Paketprüfung |
| `release.yml` | `.github/workflows/release.yml` | manueller Signier-/Release-Job (`web-ext sign --amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed\|unlisted`) über die Secrets `ATN_API_KEY` und `ATN_API_SECRET` |

## Warum liegen sie hier und nicht direkt unter `.github/workflows/`?

GitHub lehnt Pushes ab, die Workflow-Dateien anlegen oder ändern, wenn das verwendete Token
(App/CI-Token) nicht die Berechtigung **Workflows** besitzt:

```
refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml`
without `workflows` permission
```

Dieser Fehler trat beim Push des Branch `cline/573mahd6` erneut auf (Nachweis: Aufgabenplan A-19).
Die inhaltliche Arbeit an den Workflows ist abgeschlossen, die Dateien können in dieser Umgebung
aber nicht in den Branch geschrieben werden. Alle referenzierten Skripte liegen bereits im
Repository:

- `scripts/pre-submit-checks.js` (echter Exit-Code, testbar)
- `scripts/filter-lint-warnings.js` (nur bekannte Thunderbird-False-Positives werden toleriert)
- `scripts/verify-package.js` (Paketinhalt und -größe)

> **Stand:** Die **aktuell aktive** Datei `.github/workflows/ci.yml` ist weiterhin die alte Fassung
> (nur `node --test background.test.js` und `npx web-ext lint`). Bis die Übernahme gelingt, ist die
> vollständige Prüfung ausschließlich lokal über die Kommandos unter „Lokale Entsprechung“ belegt.


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

> **Wichtig – Signierziel:** `web-ext sign` verwendet ohne explizite Angabe
> `https://addons.mozilla.org/api/v5/` als Endpunkt (siehe `node_modules/web-ext/lib/program.js`,
> `AMO_BASE_URL`). Ein Thunderbird-Add-on muss über ATN signiert werden. `release.yml` setzt deshalb
> `--amo-base-url https://addons.thunderbird.net/api/v5/` (über die Umgebungsvariable
> `ATN_API_BASE_URL`). Manuell lautet der Befehl:
>
> ```bash
> npx web-ext sign \
>   --source-dir . \
>   --artifacts-dir ./build \
>   --amo-base-url https://addons.thunderbird.net/api/v5/ \
>   --channel listed
> ```

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
