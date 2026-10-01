# Status – Thundy AV (Stand: 1. Oktober 2026)

**Add-on:** Thundy AV – Email Scanner for Thunderbird · **Version 1.6.2** · **ID** `thundy-av@bludau-it-services.de`
**Zielplattform:** Thunderbird 140.0 oder neuer (Manifest V3) · **Lizenz:** MIT
**Snapshot:** Branch `cline/k0d34w90` (Einreichungskandidat, Entscheidung D1 in [decisions.md](decisions.md))

## Store-Readiness-Paket: umgesetzt (Arbeitslauf 2026-10-01)

Die Blocker und hohen Befunde aus [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md)
wurden abgearbeitet. Alle Zahlen unten sind in diesem Arbeitslauf **gemessen**:

| Gate | Kommando | Ergebnis |
|---|---|---|
| Pre-Submit-Checks | `npm run pre-submit-checks` | **0 Fehler**, 1 Warnung (Screenshots fehlen) |
| Tests | `npm test` | **427 Tests, 0 Fehler** (vorher 389; neue Suiten: Consent/Tier, Manifest-Invarianten, Gate) |
| Lint | `npm run lint:filtered` | **0 Fehler, 19 Warnungen**, alle als Thunderbird-False-Positive kuratiert |
| Paket | `npm run package` | **17 Dateien, 196.505 Bytes entpackt** (53.275 Bytes ZIP), „Package content is valid.“ |
| Go/No-Go | `npm run store-gate` | **NO-GO**: C1–C4 PASS, C5 (Screenshots), C6 (Live-Test), C7 (Tag auf dem Commit) offen |

### Was in diesem Lauf geändert wurde

- **Daten-Deklaration (P0-1):** `data_collection_permissions` auf `required: ["none"]`,
  `optional: ["personalCommunications"]`; `options.js` fragt die Zustimmung per
  `permissions.request({ data_collection: ['personalCommunications'], permissions: ['sensitiveDataUpload'] })`
  in der Nutzergeste an und entfernt sie beim Abschalten. Die zu strenge Hausregel im Pre-Submit-Check
  wurde an das Validatorverhalten angeglichen.
- **Datenschutz-Stufe (P0-2):** Manueller Anhang-Upload (ab `balanced`) und manueller URL-Scan (nur `max`)
  prüfen jetzt `privacyTier`; in `strict` erscheint ein Hinweis mit Link in die Einstellungen. Policy,
  Listing und Reviewer-Notes beschreiben dieses Verhalten.
- **Popup (P0-7, P0-9):** `fetch_hybrid_report` überträgt nur mit globaler Zustimmung; die defekten
  Bezeichner (`syncFragment`, `container`) sind korrigiert, der Analysebereich rendert wieder und zeigt
  ohne Zustimmung das lokal gespeicherte Ergebnis.
- **Kontextmenüs (P0-8):** Berechtigung `menus` ergänzt; beide Einträge sind damit nutzbar.
- **Paket-Gate (P0-6):** Scratch-Dateien entfernt, Entwickler-Skripte nach `tools/*.dev.js` verschoben,
  `.webextignore` gelöscht (wird von `web-ext` nicht gelesen); die Paketprüfung wählt das Artefakt nach
  Version/Zeit statt lexikografisch.
- **Fehler-/Rechtepfade (P1-12, P2-23, P2-24):** `requireHostPermission()` vor jedem Provider-Aufruf,
  automatischer Upload über `apiGateway.fetchWithTimeout`, Banner führt bei verweigerter Berechtigung
  in die Einstellungen, IP-Reputations-Cache speichert keine „ohne Zustimmung“-Ergebnisse mehr.
- **MV3-Hygiene (P1-9, P1-10):** MV2-Fallbacks und den nicht existierenden
  `scripting.messageDisplay.executeScript`-Zweig entfernt; Injektionsfehler werden dem Nutzer gemeldet.
- **Gates (P1-7, P1-8):** Die Lint-Allow-Liste enthält die in MV3 entfernten APIs nicht mehr.
  Pre-Submit-Checks erzwingen zusätzlich die `menus`-Berechtigung, die Daten-Deklaration samt
  Laufzeit-Anfrage und verbieten MV3-entfernte APIs in Laufzeitdateien. Der volle CI-Gate liegt in
  [docs/ci/](ci/README.md) (Push unter `.github/workflows/` scheitert am Token ohne `workflows`-Scope,
  reproduziert); lokal: `npm run check`.
- **Doku (P1-11 und folgende):** Privacy-Policy (DE/EN), Store-Listing, Reviewer-Notes, READMEs,
  Quickstart, Store-Assets, Screenshot-Guide und Doku-Index auf den geprüften Stand gebracht;
  Kategorie „Privacy and Security“ (ATN-Slug), Origins exakt wie in `options.js` angefragt.
- **Testmittel (P2-17):** `testdata/` mit fünf Testnachrichten samt Erwartungen je Datenschutz-Stufe,
  Live-Test-Protokoll [live_test_protocol.md](live_test_protocol.md).

### Befund-Status

| Befund | Status | Nachweis |
|---|---|---|
| P0-1 Daten-Deklaration | **behoben** | `manifest.json`, `options.js`, Pre-Submit-Check, Tests |
| P0-2 Manuelle Pfade vs. Stufe | **behoben** | `background.js` (Tier-Gates), Tests, Doku |
| P0-3 Live-Test in TB 140 ESR | **offen (manuell)** | Protokoll bereit: `docs/live_test_protocol.md` |
| P0-4 Screenshots/Listing | **offen (manuell)** | Gate-Kriterium C5 |
| P0-5 Divergente Linien | **entschieden** | D1 in `docs/decisions.md`; Tag-Umgang offen (A-15) |
| P0-6 Paket-Gate rot | **behoben** | `npm run package` → valid, 17 Dateien |
| P0-7 Popup ohne Konsent | **behoben** | `api.js`, Regressionstests |
| P0-8 `menus`-Berechtigung | **behoben** | `manifest.json`, Pre-Submit-Check; Live-Test offen |
| P0-9 Popup-`ReferenceError` | **behoben** | `api.js`, ESLint-Prüfung im Gate |
| P1-7 CI-Testumfang | **behoben (Spiegel)** | `docs/ci/ci.yml`; Aktivierung braucht `workflows`-Berechtigung |
| P1-8 Lint-Filter | **behoben** | `scripts/filter-lint-warnings.js`, Pre-Submit-Check |
| P1-9 Toter Injektionszweig | **behoben** | `background.js`, Tests |
| P1-10 MV2-Altpfade | **behoben** | Code + Pre-Submit-Check |
| P1-11 Doku-Drift | **behoben** | Doku-Update in diesem Lauf |
| P1-12 Host-Recht/`fetch` | **behoben** | `requireHostPermission`, Gateway, Tests |
| P1-13 Release-/Repo-Hygiene | **teilweise** | `pnpm-lock.yaml` entfernt, Scratch-Dateien/Dev-Skripte aufgeräumt; Release-Metadaten und Tag bewusst offen (D10) |
| P1-14 Signier-Endpunkt | **behoben (Spiegel)** | `docs/ci/release.yml` (`--amo-base-url`) |
| P1-15 Approval-Timeout | **behoben (Spiegel)** | `docs/ci/release.yml` (`--approval-timeout 0`) |
| P2-14 … P2-24 | **überwiegend behoben** | Einzelbelege in der Problemanalyse, `git log` |
| P3-20 … P3-25 | **überwiegend behoben** | Einzelbelege in der Problemanalyse, `git log` |

## Remaining (manuell, nicht in dieser Umgebung möglich)

- **Live-Test in Thunderbird 140 ESR (Pflicht vor der Einreichung):** Protokoll in
  [live_test_protocol.md](live_test_protocol.md) abarbeiten (Banner, Kontextmenü, Time-of-Click,
  Permission-Geste, Stufen-Gate, Popup, HTML-Entschärfen, Cache leeren) — Testdaten liegen in
  `testdata/`.
- **Echte Screenshots** (PNG, ≥ 1200 px breit) gemäß [screenshot_capture.md](screenshot_capture.md);
  danach meldet der Pre-Submit-Check 0 Warnungen und Kriterium C5 wird grün.
- **Release-Tag auf dem eingereichten Commit** (Kriterium C7): entweder `v1.6` bewusst neu setzen oder
  die Version erhöhen — Entscheidung dokumentieren.
- **ATN-Listung, Signierung, Store-URL:** Listing-Felder aus [store_listing.md](store_listing.md);
  signieren mit `npx web-ext sign --amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed
  --approval-timeout 0`; danach Store-URL in README/Listing/Landing-Page ergänzen.
- **Optional:** Lokalisierung der Options-/Popup-Oberfläche (derzeit deutsch; Manifest-Strings und Banner
  sind en/de lokalisiert).

## Referenzen

- Befunde: [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) · Aufgabenplan:
  [AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md) · Entscheidungen:
  [decisions.md](decisions.md) · Rohbelege: [audits/](audits/)
- Datenschutzerklärung: [privacy_policy.md](privacy_policy.md) · live:
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Reviewer-Hinweise: [reviewer_notes.md](reviewer_notes.md) · Listing-Entwurf:
  [store_listing.md](store_listing.md) · Testdaten: [../testdata/](../testdata/)

