# Pipeline-/Paket-Audit (task_0003)

**Repo:** `/workspace` · **Branch:** `cline/k0d34w90` · **Basis-Commit:** `4c4898c` (shallow clone, `git rev-list --count HEAD` = 1)
**Add-on-Version:** manifest `1.6` (`manifest.json:8`), package.json `1.6.0` (`package.json:3`)
**Umgebung:** Node `v24.21.0`, npm `11.19.0`, web-ext `10.7.0` (aus `package-lock.json`), gh `2.101.0` (authentifiziert als `cline-cloud[bot]`)
**Rollen:** unabhängiger Auditor. Es wurden **keine getrackten Dateien geändert**; Artefakte/Logs ausschließlich unter `/tmp/pa-*`, Bericht nur unter `/workspace/.audit/`.

## 0. Reproduzierte Basisfakten (Belege)

| Messung | Ergebnis | Beleg |
|---|---|---|
| `node --test` (alle Dateien) | **389 Tests / 389 pass / 0 fail**, EXIT=0 | `/tmp/pa-test.log`: `ℹ tests 389`, `ℹ pass 389`, `ℹ fail 0` |
| `node scripts/pre-submit-checks.js` | 0 Fehler, 1 Warnung, EXIT=0 | `/tmp/pa-presubmit.log`: `warning: no PNG/JPEG screenshots found in docs/`, `Pre-submit checks passed (1 warning(s), exit code 0).` |
| `npx web-ext lint --output json` | **0 errors / 26 warnings / 0 notices**, EXIT=0 | `/tmp/pa-lint.json`: `"summary":{"errors":0,"notices":0,"warnings":26}` ; `/tmp/pa-lint.exit` = `EXIT=0` |
| `node scripts/filter-lint-warnings.js /tmp/pa-lint.json` | `Lint ok: 26 warning(s), all of them known Thunderbird false positives.`, EXIT=0 | Kommandoausgabe |
| `npx web-ext build` | EXIT=0, Artefakt `thundy_av_email_scanner_for_thunderbird-1.6.zip` | `/tmp/pa-build.log` |
| `node scripts/verify-package.js /tmp/pa-build` | **EXIT=1** (2 Paketfehler) | s. PL-01 |
| Aktiver CI-Workflow für `4c4898c` | success, Lauf `36768937109` | `gh run list` / `gh run view 36768937109` |

XPI-Inhalt (23 Zip-Einträge = 19 Dateien + 4 Verzeichnis-Einträge; 180 856 B entpackt / 46 494 B komprimiert, `unzip -l` + Python-`zipfile`). `manifest.json` ist enthalten.

## Fundliste

### PL-01 — BLOCKER: Ausgeliefertes XPI enthält 2 Entwicklungsdateien, Paket-Gate schlägt fehl

**Beleg**
```
# unzip -l /tmp/pa-build/thundy_av_email_scanner_for_thunderbird-1.6.zip
      454  test_regex_escape.js
      702  test_regex_escape2.js
# node scripts/verify-package.js /tmp/pa-build   →  VERIFY_EXIT=1
PACKAGE CHECK FAILED: unexpected file in package: test_regex_escape.js
PACKAGE CHECK FAILED: unexpected file in package: test_regex_escape2.js
```
Ursache: `web-ext-config.mjs:12-47` (`ignoreFiles`) führt `'**/*.test.js'` und `'**/*_test.js'`, aber nicht die Namen `test_regex_escape.js` / `test_regex_escape2.js` (Endung `_escape.js`). `scripts/verify-package.js:11-22` (`ALLOWED_FILES`) und `:24-35` (`FORBIDDEN`) kennen sie ebenfalls nicht.

**Auswirkung:** Store-Paket enthält Dev-Artefakte; das dokumentierte Paket-Gate (`scripts/verify-package.js`) ist rot, damit ist der Release-Job (PL-02/PL-04) blockiert. Zusätzlich listet der Linter die Dateien in `metadata.unknownMinifiedFiles` (`/tmp/pa-lint.json`), was bei ATN-Review Rückfragen erzeugt. `docs/STATUS.md:33` behauptet „15 Dateien“ – tatsächlich sind es 19.

**Fix-Skizze:** Die beiden Dateien aus dem Repo entfernen (Leftover) **oder** `ignoreFiles` um `'test_*.js'`/`'test_regex_escape*.js'` ergänzen; anschließend Build erneut prüfen.

---

### PL-02 — BLOCKER/hoch: Release-Job ist nicht aktiv und würde gegen AMO statt ATN signieren

**Beleg**
- Aktive Workflows im Remote-Repo: `gh api repos/VaZuLeS/Thunderbird-Antivirus/contents/.github/workflows` → `['.github/workflows/ci.yml']` — **kein** `release.yml`.
- `docs/ci/release.yml` (nur Spiegel, nicht deployt): `npx web-ext sign --source-dir . --artifacts-dir ./build --channel "${{ inputs.channel }}"` (`docs/ci/release.yml:42-44`); `grep -n "amo-base\|approval-timeout\|amo-metadata" docs/ci/release.yml` → **kein Treffer** (GREP_EXIT=1).
- web-ext-Default: `node_modules/web-ext/lib/program.js:19` `export const AMO_BASE_URL = 'https://addons.mozilla.org/api/v5/';` und `:426-431` `'amo-base-url': { ... default: AMO_BASE_URL }`. Bestätigt durch `npx web-ext sign --help`: `[default: "https://addons.mozilla.org/api/v5/"]`.

**Auswirkung:** Mit gesetzten `ATN_API_KEY`/`ATN_API_SECRET` würde `web-ext sign` die Thunderbird-XPI an die **Mozilla-AMO-API** senden (falscher Katalog, Thunderbird-only-Manifest wird dort abgelehnt). Die Env-Var-Mechanik ist korrekt (yargs `envPrefix = 'WEB_EXT'`, `program.js:15,76` → `WEB_EXT_API_KEY`/`WEB_EXT_API_SECRET` gültig), der **Endpunkt fehlt** aber.

**Fix-Skizze:** `--amo-base-url https://addons.thunderbird.net/api/v5/` ergänzen (alternativ `WEB_EXT_AMO_BASE_URL`), Workflow unter `.github/workflows/release.yml` deployen (Token mit `workflows`-Scope).

---

### PL-03 — hoch: `--channel listed` läuft in den 15-Minuten-Approval-Timeout, dann fehlt das signierte XPI

**Beleg**
- `docs/ci/release.yml:42-44` setzt weder `--approval-timeout` noch `--timeout`.
- `node_modules/web-ext/lib/util/submit-addon.js:59` `approvalCheckTimeout = 900000, // 15 minutes.` (Default); `:224-232` `waitRetry(..., this.approvalCheckTimeout, 'Approval', editUrl)` → bei Ablauf `reject(new Error('${context}: timeout exceeded.'))` (`:128-136`).
- Signierter Download nur nach `file.status === 'public'` (`submit-addon.js:224-230`) bzw. entfällt bei `approvalCheckTimeout === 0` (`:215-221`).
- `docs/ci/release.yml:45-51`: `uses: actions/upload-artifact@v4 ... path: build/*.xpi ... if-no-files-found: error`.

**Auswirkung:** Eine „listed“-Freigabe bei ATN erfordert menschliche Review; nach 15 min bricht `web-ext sign` ab, es entsteht **kein** `.xpi` im `--artifacts-dir`, und der Upload-Schritt scheitert zusätzlich (`if-no-files-found: error`). Für „listed“ ist der Job so nicht lauffähig.

**Fix-Skizze:** Für `listed`: `--approval-timeout 0` setzen (nur einreichen, Download später) und Upload auf `if-no-files-found: warn` ändern bzw. entfernen; für `unlisted` Default belassen.

---

### PL-04 — hoch: Aktive CI testet nur 243 von 389 Tests

**Beleg**
- `.github/workflows/ci.yml:22-23` → `run: node --test background.test.js`; keine weiteren Testschritte.
- CI-Log für den auditierten Commit: `gh run view --job=110070075230 --log` → `Run unit tests` / `node --test background.test.js`; Lauf `36768937109` = success.
- Nicht im CI-Lauf: `api.test.js` (92), `api_gateway.test.js` (5), `db.test.js` (16), `options.test.js` (8), `scripts/pre-submit-checks.test.js` (23) — Summen aus `/tmp/pa-tests/*.log` (`ℹ tests N`); `background.test.js` = 243.
- `docs/ci/ci.yml:24-25` enthält `run: npm test` (alle 389), ist aber nicht deployt; `diff -u .github/workflows/ci.yml docs/ci/ci.yml` → `DIFF_EXIT=1`.

**Auswirkung:** 146 Tests (37 %) laufen in keiner aktiven Pipeline. Regressionen in API-/DB-/Options-/Skript-Ebene werden nicht bemerkt. `docs/STORE_READINESS_ANALYSIS.md:161` beschreibt diesen Mangel korrekt als offen; `docs/STATUS.md:39-46` räumt die „Spiegel“-Situation selbst ein.

**Fix-Skizze:** In `.github/workflows/ci.yml` `npm test` statt `node --test background.test.js` verwenden.

---

### PL-05 — hoch: Kein Build-/Paket-Gate in der aktiven CI

**Beleg** `grep -rn "build|xpi|artifacts" .github/workflows/ci.yml` → einziger Treffer ist der Kommentar `# Optional: add web-ext build and XPI packing steps in release workflows` (Zeile 27). `docs/ci/ci.yml:29-33` (`web-ext build` + `node scripts/verify-package.js ./build`) ist nicht aktiv.

**Auswirkung:** Der Paketfehler PL-01 ist für CI unsichtbar; die Behauptung „`scripts/verify-package.js` prüft den Paketinhalt in der CI“ (`docs/STATUS.md:33-34`) trifft auf die **aktive** Pipeline nicht zu.

**Fix-Skizze:** Build + `verify-package.js` in `.github/workflows/ci.yml` aufnehmen (analog Spiegel), Artefakt per `actions/upload-artifact`.

---

**Arbeitskopie-Zustand (dynamisch, nicht von mir erzeugt):** Bei Audit-Start: `git status --porcelain` → `M .gitignore`, `?? docs/PROBLEMANALYSE_STORE_READINESS.md`; bei Audit-Ende: `?? docs/AUFGABENPLAN_STORE_READINESS.md`. `git status --porcelain --ignored` → `!! .audit/`, `!! node_modules/`. Andere Teammitglieder arbeiten parallel im selben Workspace; **ich habe keine getrackte Datei geändert** (alle von mir erzeugten Artefakte liegen in `/tmp/pa-*` bzw. in diesem ignorierten Bericht).

---

### PL-06 — mittel: Lint-Gate ist in der aktiven CI wirkungslos; kuratierter Filter läuft nur im Spiegel

**Beleg**
- `web-ext-config.mjs:51-54` → `lint: { warningsAsErrors: false }`; web-ext-Default ebenfalls `false` (`node_modules/web-ext/lib/program.js:630-635`); `npx web-ext dump-config | grep -A2 warningsAsErrors` → `"warningsAsErrors": false`.
- Aktive CI: `.github/workflows/ci.yml:24-25` → `npx web-ext lint` (kein Filter). Das CI-Log zeigt die 26 Warnungen im Klartext, Job-Ende success → Warnungen brechen nichts ab.
- `scripts/filter-lint-warnings.js` wird nur in `docs/ci/ci.yml:26-28` aufgerufen (nicht aktiv). Dort per Shell-Redirect in einer `bash -e`-Kette: bei Lint-Errors beendet `web-ext lint` mit ≠0, der Fehlerzweig von `filter-lint-warnings.js:53-58` wird nie erreicht (nur die Warnungslogik ist relevant).
- Filter ist substring-basiert: `scripts/filter-lint-warnings.js:37` `message.includes(needle)` mit Needle `'messagesRead'`/`'messages.*'` → eine künftig falsch deklarierte Permission `messagesReadFoo` würde von `MANIFEST_PERMISSIONS` (`:23-28`) unterdrückt.

**Auswirkung:** Die 26 Warnungen sind **kein** Gate; die Empfehlung „Lint mit Warnungen als Fehler oder kuratierter Allow-List“ (`docs/STORE_READINESS_ANALYSIS.md:163`) ist nur im Spiegel umgesetzt. Echte **Fehler** werden nicht unterdrückt (Errors bleiben Exit≠0), aber die kuratierte Liste hat in der aktiven Pipeline keine Wirkung; die Substring-Toleranz ist ein (schmaler) Suppression-Pfad.

**Fix-Skizze:** In der aktiven CI `--output json` + `scripts/filter-lint-warnings.js` verdrahten und die Allow-Liste auf exakte Codes/`instancePath` statt Substring umstellen.

---

### PL-07 — mittel: `verify-package.js` wählt das Artefakt lexikografisch – falsches ZIP möglich

**Beleg** `scripts/verify-package.js:50` `fs.readdirSync(artifactsDir).filter(name => name.endsWith('.zip'))` und `:57` `const artifact = path.join(artifactsDir, candidates.sort().pop());`. Kein `rm -rf build` vor dem Build in `docs/ci/ci.yml:29-33` bzw. `docs/ci/release.yml:32-36`; `.gitignore` enthält `build/`.

**Auswirkung:** Bei mehreren ZIPs im Zielverzeichnis (z. B. `…-1.6.zip` und `…-1.10.zip`) gewinnt lexikografisch `…-1.6.zip`; das Gate prüft dann ein **altes** Paket und meldet fälschlich „valid“.

**Fix-Skizze:** Vor dem Build `rm -rf ./build` oder Artefakt nach höchster Version/`mtime` wählen.

---

### PL-08 — mittel: Build ist nicht byte-reproduzierbar

**Beleg** Zwei aufeinanderfolgende `npx web-ext build`:
```
48890  /tmp/pa-build/thundy_av_email_scanner_for_thunderbird-1.6.zip   8e315d592991e039...
48890  /tmp/pa-build2/thundy_av_email_scanner_for_thunderbird-1.6.zip  1299734e773e4366...
```
`zipfile`-Vergleich: alle Einträge identische `CRC`/`size`/`compress_size`, aber die **Reihenfolge** wechselt (`background.js`/`api_gateway.js`, `test_regex_escape*`/`popup.html`, `img/*`) und jeder Eintrag trägt die Build-Uhrzeit (`date_time=(2026,9,30,20,1,14)` vs. `(…,20,1,58)`).

**Auswirkung:** Kein stabiler Artefakt-Hash für Release-Checksummen/Attestierungen. Zusätzlich nutzt `web-ext sign` einen CRC-basierten Upload-Cache (`.amo-upload-uuid`, `submit-addon.js:325-336`) – dieser wird durch wechselnde Reihenfolge/Timestamps wirkungslos, jeder Sign-Lauf lädt neu hoch.

**Fix-Skizze:** Deterministisches Archivieren erzwingen (Reihenfolge/Timestamps fixieren, z. B. `SOURCE_DATE_EPOCH`) und Hash im Release dokumentieren; alternativ Nicht-Reproduzierbarkeit explizit als Restrisiko führen.

---

### PL-09 — niedrig/mittel: `.webextignore` ist tote Fehlkonfiguration

**Beleg**
- `grep -rq 'webextignore' node_modules/web-ext/lib` → **NOT FOUND**: web-ext liest `.webextignore` nicht (nur `--ignore-files`/`ignoreFiles`, `node_modules/web-ext/lib/cmd/build.js:165,173`).
- Gegenprobe: `npx web-ext build --no-config-discovery --source-dir . --artifacts-dir /tmp/pa-noconf` → **67 Dateien**, darunter `docs/**`, `*.test.js`, `package.json`, `pnpm-lock.yaml`, `web-ext-config.mjs`, `examples/minimal_scan.sh`. Alle Excludes stammen also aus `web-ext-config.mjs` (bestätigt per `npx web-ext dump-config`: `ignoreFiles` = Liste aus `web-ext-config.mjs:12-47`).
- `.webextignore:1-2` behauptet selbst, nur „zusätzlich“ zu gelten; `docs/STATUS.md:31` formuliert „`ignoreFiles`, **ergänzt durch** `.webextignore`“ → irreführend.
- `.webextignore:3-16` fehlen u. a. `.github`, `node_modules`, `web-ext-config.mjs`, `.gitignore`, `.webextignore`, `CODEOWNERS`, `LICENSE/**`, `Dockerfile`, `.editorconfig`, `.jules`/`.Jules` sowie `test_regex_escape*.js`.

**Auswirkung:** Zwei divergierende Ignore-Quellen suggerieren eine Sicherung, die real nicht existiert; das begünstigt PL-01 und erschwert Reviews. Kein direkter Laufzeiteinfluss.

**Fix-Skizze:** `.webextignore` entfernen (oder als „von web-ext nicht gelesen“ kennzeichnen) und ausschließlich `web-ext-config.mjs` pflegen; `docs/STATUS.md:31` korrigieren.

---

### PL-10 — niedrig: Zwei parallele Lockfiles, nur npm wird genutzt

**Beleg** `package-lock.json`: `lockfileVersion 3`, Root-Deps `jsdom ^30.1.1` / `web-ext ^10.7.0`, aufgelöst exakt `node_modules/web-ext 10.7.0`, `node_modules/jsdom 30.1.1`. `pnpm-lock.yaml`: `lockfileVersion: '9.0'`, Importer `.` mit denselben Specifern/Versions (10.7.0 / 30.1.1). Kein Workflow/Script verwendet `pnpm`; `pnpm-lock.yaml` steht nur in den Ignore-Listen. `npm ci --dry-run --ignore-scripts` → `up to date in 444ms` (Lock konsistent). `package.json:25-30` nutzt Caret-Ranges → Reproduzierbarkeit hängt am Lockfile.

**Auswirkung:** Divergenzrisiko bei künftigen Dependency-Updates; `npm ci` bleibt korrekt. Kein Store-Blocker.

**Fix-Skizze:** `pnpm-lock.yaml` löschen oder pnpm als einzigen Paketmanager etablieren (mit passendem CI-Schritt).

---

### PL-11 — mittel: Versions-/Tag-Konsistenz mehrdeutig (1.6 vs. Tags bis v1.18.0)

**Beleg**
- Prüfbar konsistent: `manifest.json:8` `"version": "1.6"` = `git show v1.6:manifest.json` (`"version": "1.6"`, Tag `v1.6` → `351001f`, 2026-09-28); `package.json:3` `1.6.0`; `CHANGELOG.md:13` `## [1.6.0] – 2026-09-28`. `pre-submit-checks` meldet `ok: package.json and manifest.json versions match` und `ok: manifest.version format is valid (1.6)`.
- Divergenz: `git for-each-ref refs/tags` → `v1.6, v1.6.1, v1.7.0, v1.7.1, v1.8.0 … v1.18.0` (Manifest-Version je Tag: `1.6`, `1.6.1`, `1.7.0`, `1.18.0`); `gh release list --limit 10` → Releases bis „Thundy AV 1.18.0“ (alle **Pre-release**, `v1.18.0` vom 2026-09-29).
- Ancestry **lokal nicht entscheidbar**: `git merge-base --is-ancestor v1.6 HEAD` → Exit 1, aber `.git/shallow` enthält `4c4898c…` (`git rev-list --count HEAD` = 1) → Prüfung wegen Shallow-Clone unzuverlässig (als „nicht verifizierbar“ markiert).
- Public-Status: `curl -sL https://addons.thunderbird.net/api/v5/addons/addon/thundy-av@bludau-it-services.de/` → **HTTP 404** (Redirect auf `/en-US/thunderbird/api/v5/...`), Body kein JSON. Ein unlisted Add-on ist öffentlich ebenfalls nicht sichtbar → „nie veröffentlicht“ und „unlisted“ sind offline nicht unterscheidbar.

**Auswirkung:** Für ATN muss die Version monoton zur bereits veröffentlichten Version sein. Existieren die Tags/Releases v1.6.1…v1.18.0 als reale Veröffentlichungen, würde eine Einreichung von `1.6` als Duplikat/ältere Version abgelehnt. Solange das ungeklärt ist, ist die Release-Fähigkeit der Version 1.6 unbestimmt (kein Blocker, aber Go/No-Go-relevant).

**Fix-Skizze:** Veröffentlichungsstand im ATN-Entwicklerkonto prüfen und Zielversion eindeutig festlegen (Monotonie + CHANGELOG/Tag/Manifest synchron); nicht veröffentlichte Tags als solche dokumentieren.

---

### PL-12 — niedrig: Listing-/Metadaten-Übergabe fehlt im Release-Pfad

**Beleg** `docs/ci/release.yml:42-44` übergibt kein `--amo-metadata` (`grep` ohne Treffer); `pre-submit-checks`-Lauf: `warning: no PNG/JPEG screenshots found in docs/`; `ls docs/screenshots` → nur `options_page.svg`, `inline_optin_banner.svg`, `warning_banner.svg` (keine PNG/JPEG).

**Auswirkung:** Ein „listed“-Release kann per Workflow allein nicht vollständig eingereicht werden (Summary, Beschreibung, Kategorie, Lizenz, Privacy-Policy-URL, Screenshots fehlen); manuelle ATN-Eingriffe bleiben Pflicht.

**Fix-Skizze:** ATN-Listing manuell vorbereiten (oder `--amo-metadata` mit Metadaten-JSON ergänzen) und echte Screenshots beilegen.

---

### PL-13 — INFO: Paket ist inhaltlich vollständig (keine fehlende Laufzeitdatei)

**Beleg** `unzip -l` (23 Einträge) enthält `manifest.json`, `background.js`, `db.js`, `api.js`, `api_gateway.js`, `popup.html`, `options.html`, `options.js`, `theme.css`, `LICENSE`, `img/icon-{16,32,48,64,128}px.png`, `_locales/{de,en}/messages.json` inkl. `_locales/`- und `img/`-Verzeichniseinträgen. Abgleich mit `manifest.json`: `background.scripts` = `db.js`, `api_gateway.js`, `background.js`; `message_display_action.default_popup` = `popup.html`; `options_ui.page` = `options.html`; `icons.*` = `img/*`; `default_locale: en` → `_locales/`. `api.js` wird von `popup.html:45` als Modul geladen; `theme.css` von `popup.html:9` und `options.html:8`. Größe 180 856 B ≪ `MAX_UNCOMPRESSED_BYTES` (409 600 B, `scripts/verify-package.js:37`).

**Auswirkung:** Positivbefund – PL-01 ist der einzige Paketinhalt-Defekt; nichts zur Laufzeit Benötigtes fehlt.

---

## Übersicht

| ID | Schwere | Kurzfassung |
|---|---|---|
| PL-01 | Blocker | XPI enthält `test_regex_escape*.js`; `verify-package.js` EXIT=1 |
| PL-02 | Blocker/hoch | Kein aktiver Release-Workflow; Signierziel wäre AMO statt ATN |
| PL-03 | hoch | `--channel listed` scheitert am 15-min-Approval-Timeout → kein XPI-Upload |
| PL-04 | hoch | CI testet nur `background.test.js` (243/389) |
| PL-05 | hoch | Kein Build-/Paket-Gate in der aktiven CI |
| PL-06 | mittel | Lint-Warnungen ohne Gate; Filter nur im Spiegel; Substring-Allow-List |
| PL-07 | mittel | `verify-package.js` wählt ZIP lexikografisch (Alt-Artefakt möglich) |
| PL-08 | mittel | Build nicht byte-reproduzierbar (Reihenfolge + Zeitstempel) |
| PL-09 | niedrig/mittel | `.webextignore` wird von web-ext nicht gelesen (tote Config) |
| PL-10 | niedrig | `package-lock.json` + `pnpm-lock.yaml` parallel, nur npm genutzt |
| PL-11 | mittel | Version 1.6 vs. Tags/Releases bis v1.18.0; ATN-Status mehrdeutig |
| PL-12 | niedrig | Keine Listing-Metadaten/Screenshots im Release-Pfad |
| PL-13 | Info | Paketinhalt sonst vollständig (alle Laufzeitdateien vorhanden) |

## Nicht statisch verifizierbar
1. Ob ATN eine Einreichung der Version `1.6` akzeptiert (Duplikat-/Monotonie-Prüfung) – ATN-API lieferte 404; ob v1.6.1…v1.18.0 dort veröffentlicht wurden, ist offline nicht prüfbar.
2. Ob die Tags `v1.6…v1.18.0` Vorfahren von `4c4898c` sind – Shallow-Clone (`.git/shallow`), `merge-base --is-ancestor` unzuverlässig.
3. Echtes Signieren/Installieren der XPI in Thunderbird sowie ATN-Reviewverhalten.
4. Ob die GitHub-Secrets `ATN_API_KEY`/`ATN_API_SECRET` existieren und gültig sind (in dieser Umgebung nicht vorhanden/abfragbar).
5. Ob `actions/checkout@v7`/`actions/setup-node@v7` dauerhaft verfügbar bleiben (Lauf `36768937109` war erfolgreich → aktuell existent).
6. Ob künftige Pushes des Branches dieselben Workflow-Inhalte fahren (nur Remote-Stand zum Messzeitpunkt geprüft).

## Reproduktion (Kommandos)
```bash
cd /workspace
npx web-ext build --source-dir . --artifacts-dir /tmp/pa-build --overwrite-dest
unzip -l /tmp/pa-build/*.zip
node scripts/verify-package.js /tmp/pa-build                                  # EXIT=1 (PL-01)
npx web-ext lint --source-dir . --output json > /tmp/pa-lint.json             # 0 errors / 26 warnings
node scripts/filter-lint-warnings.js /tmp/pa-lint.json
node --test --test-reporter=spec                                              # 389 Tests / 0 fail
node ./scripts/pre-submit-checks.js                                           # 0 Fehler / 1 Warnung
npx web-ext dump-config | grep -A2 warningsAsErrors                           # false
npx web-ext build --no-config-discovery --source-dir . --artifacts-dir /tmp/pa-noconf  # 67 Dateien
gh api repos/VaZuLeS/Thunderbird-Antivirus/contents/.github/workflows         # nur ci.yml
diff -u .github/workflows/ci.yml docs/ci/ci.yml                               # DIFF_EXIT=1
```

