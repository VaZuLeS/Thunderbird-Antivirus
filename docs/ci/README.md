# CI-Workflows (übernahmefähige Definitionen)

Dieses Verzeichnis enthält die **fertigen Workflow-Definitionen** für das Repository:

| Datei | Ziel im Repository | Zweck |
|---|---|---|
| `ci.yml` | `.github/workflows/ci.yml` | `npm ci`, Pre-Submit-Checks, vollständige Testsuite (`npm test`), `web-ext lint` mit kuratiertem Thunderbird-Filter (`npm run lint:filtered`), XPI-Build + Paketprüfung (`npm run package`), Upload des XPI als Artefakt |
| `release.yml` | `.github/workflows/release.yml` | manueller Signier-/Einreichungsjob für **addons.thunderbird.net** (`web-ext sign --amo-base-url https://addons.thunderbird.net/api/v5/`), Secrets `ATN_API_KEY`/`ATN_API_SECRET`, `approval-timeout` als Eingabe |

## Warum liegen sie hier und nicht direkt unter `.github/workflows/`?

GitHub lehnt Pushes ab, die Workflow-Dateien anlegen oder ändern, wenn das verwendete
Token keine **Workflows**-Berechtigung besitzt. Das ist in dieser Umgebung reproduzierbar:

```
! [remote rejected] cline/k0d34w90 -> cline/k0d34w90
  (refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml`
   without `workflows` permission)
```

Der **aktive** Workflow im Repository ist deshalb weiterhin die reduzierte Variante
(`npm ci`, Pre-Submit-Checks, `node --test background.test.js`, `web-ext lint` ohne Filter,
kein Build/Paketcheck). Genau dieser Umstand ist Befund **P1-7** der Problemanalyse und wird
erst mit der Übernahme behoben.

Alle referenzierten Skripte liegen im Repository und sind getestet:

- `scripts/pre-submit-checks.js` (Manifest, Daten-Deklaration, Rechte, Assets)
- `scripts/lint-with-filter.js` + `scripts/filter-lint-warnings.js` (nur dokumentierte Thunderbird-False-Positives werden toleriert)
- `scripts/build-and-verify-package.js` + `scripts/verify-package.js` (Build, Paketinhalt, Artefaktwahl)
- `scripts/submission-gate.js` (Go/No-Go-Gate, siehe unten)

## Übernehmen

1. Workflow-Dateien kopieren (mit einem Token, das `workflows` darf):

   ```bash
   cp docs/ci/ci.yml .github/workflows/ci.yml
   cp docs/ci/release.yml .github/workflows/release.yml
   git add .github/workflows && git commit -m "ci: activate full store-readiness gates"
   git push
   ```

2. Für `release.yml` die Secrets `ATN_API_KEY` und `ATN_API_SECRET` setzen (ATN →
   Developer Hub → API-Schlüssel; `web-ext sign` liest sie über `WEB_EXT_API_KEY` /
   `WEB_EXT_API_SECRET`).

## Lokale Entsprechung (ohne GitHub Actions)

```bash
npm ci
npm run check          # Pre-Submit-Checks + Tests + Lint mit Filter + Build/Paketprüfung
npm run store-gate     # Go/No-Go-Protokoll mit Nachweis je Kriterium
```

`npm run check` entspricht inhaltlich exakt dem `ci.yml`-Job; `npm run store-gate` ergänzt die
nicht automatisch prüfbaren Kriterien (Live-Test-Protokoll, Screenshots, Release-Tag) und
liefert Exit-Code 0 nur bei vollständigem GO.
