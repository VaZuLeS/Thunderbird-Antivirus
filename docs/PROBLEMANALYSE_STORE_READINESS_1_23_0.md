# Problemanalyse Store-Readiness 1.23.0 — „Thundy AV“ (Thunderbird SECurity AntiVirus)

**Prüfgegenstand:** Repository `VaZuLeS/Thunderbird-Antivirus`, Quellstand **1.23.0**, Commit `f9f1e95`
(Analyse-Snapshot: Branch `cline/rxk1fthv`)
**Zielplattform:** Thunderbird Add-ons Store (ATN, addons.thunderbird.net) — Listung + Signierung,
`strict_min_version` 140.0, Manifest V3, Lizenz GPL-3.0-only
**Prüfmethode:** Ausführung der Projekt-Gates (`npm ci`, `npm run pre-submit-checks`, `npm test`,
`npm run lint:filtered`, `npm run check:i18n`/`check:vendor`/`check:design`, `npm run package`,
`npm run store-gate -- --no-commands`), statische Inspektion, Tag-/Doku-Abgleich
**Erstellt mit:** [KI_PROMPT_STORE_READINESS.md](KI_PROMPT_STORE_READINESS.md) (Masterprompt, §1)
**Datum:** 2026-10-16

---

## 1. Gesamturteil

| Bereich | Status |
|---|---|
| Automatisierte Qualitätssicherung (`npm run check`) | 🟢 **grün** — 949/949 Tests, 0 Fehler; Lint ok (24 bekannte TB-Fehlalarme); i18n/vendor/design-Checks ok; Paketprüfung „valid“; Pre-Submit-Checks 0 Warnungen |
| Release/Artefakt | 🔴 **rot** — Version 1.23.0 ist nicht getaggt und nicht veröffentlicht (Gate-Kriterium C7 FAIL); höchster Tag auf origin ist v1.22.0 |
| Listing-/Asset-Reife | 🟡 **gelb** — 23 echte PNG-Aufnahmen existieren (`docs/screenshots/*`), aber: keine für ATN aufbereiteten Listing-Screenshots, SVG-Platzhalter noch im Gate-Verzeichnis, Bildbreiten teils unter der dokumentierten 1200-px-Grenze; Gate meldet fälschlich „keine Screenshots“ (C5 FAIL) |
| Live-Test-Nachweis | 🟡 **gelb** — reale Thunderbird-140.17-ESR-Abnahme für 1.23.0 existiert ([THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md)), aber das Gate wertet nur das alte 1.6er-Formular (`live_test_protocol.md`, Summe unausgefüllt) → C6 FAIL; kein `live_test_1_23_0.md` in der Protokollserie |
| Doku-Konsistenz (Listing/Assets) | 🟡 **gelb** — `store_listing.md` (Kopf „Version 1.6“) und `store_assets.md` („1.6.2“, „kein PNG im Repository“ — faktisch falsch) sind überholt |
| Manuelle Restabdeckung | 🟡 **gelb** — Windows/macOS, Screenreader, DPI/Zoom, echte Standardbrowser-Übergabe, automatische Updateverteilung, produktive N06-Nachweise bleiben offen (dokumentiert, nicht blockierend für die Einreichung) |

**Ergebnis:** Der Quellstand 1.23.0 ist **funktional und qualitätsgesichert store-ready-nah**. Die
automatisierten Gates sind vollständig grün; die Einreichung blockiert ausschließlich an
C7 (Release/Tag), C5 (Listing-Screenshots) und C6 (formalisierter Live-Test-Nachweis). Dabei sind
C5 und C6 **teilweise Gate-Blindspots, nicht fehlende Nachweise**: echte Aufnahmen und eine reale
Abnahme existieren — das Gate kann sie nur nicht sehen. Der schnellste Weg zum GO ist deshalb:
Release taggen + Listing-Shots kuratieren + Gate-Artefaktquellen erweitern, danach erneut messen.

**Gezählte Befunde:** 5 Blocker (B1–B5), 2 hohe Punkte (H1–H2), 2 mittlere Punkte (M1–M2).

---

## 2. Blocker (vor Einreichung zu beheben)

### B1 — Version 1.23.0 nicht getaggt und nicht veröffentlicht (C7 FAIL)
**Belege**
- `npm run store-gate -- --no-commands` → `FAIL  C7  release for version 1.23.0 matches the package content — no git tag v1.23.0 yet`
- `git ls-remote --tags origin` → höchster Tag `v1.22.0` (28 Tags); `git tag` lokal leer (Clone)
- [STATUS.md](STATUS.md): „Vorbereitete Extensionversion 1.23.0; keine neue getaggte Veröffentlichung.“
- `CHANGELOG.md` §1.23.0 existiert (2026-10-15) — Release-Notes sind also bereit, es fehlt nur der Release-Schritt.

**Auswirkung:** Kein unveränderliches, auditierbares Artefakt der einzureichenden Version; C7 bleibt FAIL;
ATN-Einreichung ohne Release-Zuordnung.

### B2 — ATN-Signierung und Einreichung nicht erfolgt ✋
**Belege**
- [store_listing.md](store_listing.md) Kopf: „Store status: not submitted … there is no store URL.“
- [STATUS.md](STATUS.md) „Remaining“: Signierkommando mit `--amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed --approval-timeout 0` benennt die Verantwortlichkeit; Ausführung braucht die ATN-API-Schlüssel des Maintainers.

**Auswirkung:** Keine signierte Version, kein Store-Eintrag; kann nur der Maintainer ausführen.

### B3 — Submission-Gate übersieht echte Screenshots (Gate-Blindspot, C5 FAIL fälschlich)
**Belege**
- `scripts/submission-gate.js`, `hasScreenshots()`: `fs.readdirSync(dir)` — **nur Top-Level**, keine Rekursion.
- `docs/screenshots/` Top-Level enthält nur 3 SVG-Platzhalter (`inline_optin_banner.svg`, `warning_banner.svg`, `options_page.svg`) → Gate-Ausgabe: `FAIL C5 … no PNG/JPEG screenshots in docs/screenshots/`.
- Tatsächlich existieren **23 echte PNGs** in Unterverzeichnissen (`1.19.1/`, `1.20.0/`, `1.21.0/`, `1.22.0/`, `thunderbird-linux/`, `enterprise-local/`).
- Derselbe Lauf meldet im Pre-Submit-Check `ok: store screenshots found (23)` — die beiden Gates nutzen unterschiedliche Zählogik und widersprechen sich im selben Ergebnisprotokoll.

**Auswirkung:** Das Go/No-Go-Gate ist an dieser Stelle kein verlässlicher Messpunkt; ein fälschlich
rotes C5 verhindert ein gerechtfertigtes GO und verdunkelt den echten Restaufwand (B4).

### B4 — Listing-Screenshots im ATN-Format fehlen
**Belege**
- `docs/screenshots/thunderbird-linux/`: 6 Aufnahmen 1152×1000, 2 Aufnahmen 1280×1000 —
  [STATUS.md](STATUS.md) „Remaining“ fordert „PNG, ≥ 1200 px breit“, [store_assets.md](store_assets.md)
  empfiehlt 1280×800 → die 1152-px-Aufnahmen unterschreiten die eigene Vorgabe.
- [store_assets.md](store_assets.md) §1/§3 definiert die benötigten Listing-Motive — die realen Aufnahmen
  sind nicht als ATN-Listing-Set kuratiert (Zuordnung Motiv → Datei fehlt).
- Die 3 SVG-Platzhalter liegen weiterhin im Gate-Verzeichnis `docs/screenshots/` (siehe B3).

**Auswirkung:** Ohne kuratiertes PNG-Set ist das ATN-Listing nicht ausfüllbar; Teilnachweis vorhanden,
Fertigstellung fehlt.

### B5 — Gate C6 wertet falsches Artefakt; Protokollserie bricht bei 1.23.0 ab
**Belege**
- `scripts/submission-gate.js`, `liveTestSummary()` liest ausschließlich `docs/live_test_protocol.md`; deren
  Summenzeile ist unausgefüllt (Formular bezieht sich auf `b5734b6`, 1.6-Ära) → `FAIL C6`.
- Reale Abnahme 1.23.0 existiert: [THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md) —
  Thunderbird 140.17.0 ESR unter Xvfb, Wizard in 6 Sprachen, dauerhafte Upgrades 1.22.0 → 1.23.0 mit
  Neustarts, Wiederherstellung nach erzwungenem Prozessabbruch, echte Screenshots.
- Protokollserie `live_test_1_19_0.md` … `live_test_1_22_0.md` endet vor 1.23.0; es gibt kein `live_test_1_23_0.md`.

**Auswirkung:** C6 kann den vorhandenen, realen Nachweis nicht werten → Dauer-FAIL ohne tatsächlichen
Mangel; die Nachweiskette ist formal unvollständig.

---

## 3. Hohe Punkte

### H1 — Doku-Drift in Listing-/Asset-Dokumenten
**Belege**
- [store_listing.md](store_listing.md) Kopf: „**Version:** 1.6“ (Kandidat ist 1.23.0); kein Vorkommen von „1.23“ in der Datei.
- [store_assets.md](store_assets.md): „Version 1.6.2“, „Es existiert **kein** PNG- oder JPG-Screenshot … im Repository“ — faktisch falsch seit 1.19.1 (23 PNGs vorhanden).
- [decisions.md](decisions.md) Kopf: „Entscheidungen des Store-Readiness-Arbeitslaufs (Thundy AV 1.6)“.

**Auswirkung:** Ein Reviewer/Maintainer, der nur die Doku liest, bekommt einen falschen Ist-Stand;
widerspricht dem eigenen Projektgrundsatz „Dokumente behaupten nichts Unwahres“.

### H2 — Manuelle Restabdeckung der Plattform-/Betriebsprüfung ✋
**Belege** ([THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md), Zeilen 67, 105, 142, 176):
offen sind Windows/macOS, Screenreader/Betriebssystem-Barrierefreiheit, DPI/Zoom, echte Übergabe an
unterschiedliche Standardbrowser, automatische Updateverteilung/Rollback und produktive N06-Kernnachweise.

**Auswirkung:** Kein ATN-Blocker, aber relevant für Produktivfreigabe und Support-Scope; muss im Plan
gehalten werden, damit es nach dem GO nicht verloren geht.

---

## 4. Mittlere Punkte

### M1 — `ARTIFACT_RELEVANT` des Submission-Gates ist unvollständig
**Belege**
- `scripts/submission-gate.js:63`: Muster erkennt nur `manifest.json`, `background.js`, `db.js`, `api.js`,
  `api_gateway.js`, `options.(html|js)`, `popup.html`, `theme.css`, `img/`, `_locales/`, `LICENSE`.
- Tatsächlicher Diff `v1.22.0..HEAD` enthält artefaktrelevante, **nicht erfasste** Dateien:
  `audit.js`, `audit.html`, `design_system.js`, `i18n.js`, `theme.js`, `message_ui.js`, `privacy.html`,
  `onboarding.html`, `options.css`, `design.css`, `design_components.css` — alles Dateien, die im XPI landen
  (vgl. `manifest.json` `background.scripts`, `message_display_action`, `options_ui`).
- Konsequenz: Nach dem Taggen von 1.23.0 würde ein Folge-Commit, der z. B. `audit.js` ändert, C7 fälschlich
  als PASS werten — das Gate wäre „grün“ mit einem veralteten Release-Artefakt.

**Auswirkung:** Verlässlichkeitslücke im Freigabemechanismus (falsch-positiv nach dem Release).

### M2 — Gate-/Check-Konsistenz: zwei Wahrheiten für denselben Sachverhalt
**Belege**
- Pre-Submit-Check zählt Screenshots rekursiv (`ok: store screenshots found (23)`), das Gate nur Top-Level
  (`no PNG/JPEG screenshots`) — gleicher Lauf, widersprüchliches Ergebnis (siehe B3).
- Mindestbreite: Pre-Submit/Gate prüfen keine Bildmaße; die 1200-px-Vorgabe lebt nur in [STATUS.md](STATUS.md)
  bzw. als Empfehlung in [store_assets.md](store_assets.md).

**Auswirkung:** Kleiner, aber derselbe Ursprungskomplex wie B3 — die Bildprüfung sollte an genau einer
Stelle mit klarer Regel implementiert sein.

---

## 5. Positivliste (nachweisbar store-ready)

- **949/949 Tests** bestehen (`npm test`, 0 Fehler, Dauer ≈ 26 s); Lint: 24 Warnungen, alle kuratierte
  Thunderbird-Fehlalarme; Paketprüfung „Package content is valid“; Pre-Submit-Checks 0 Warnungen.
- **Manifest/Datenschutz:** MV3, ID gesetzt, `data_collection_permissions` opt-in (`required: ["none"]`,
  optional `personalCommunications`), `sensitiveDataUpload` optional, optionale Host-Rechte nur für
  Analyse-Provider, `menus` abgedeckt, CSP hart (`script-src 'self'; object-src 'none'`).
- **Reale Thunderbird-Abnahme 1.23.0** in 140.17.0 ESR (Linux/Xvfb): Wizard 6 Sprachen, dauerhafte
  Upgrades mit sauberen Neustarts, Wiederherstellung nach erzwungenem Prozessabbruch, natives Popup,
  Audit, Linkdialog, natives Hell/Dunkel — mit echten Screenshots im Repository.
- **GPL-3.0-only** Lizenzumstellung im Kandidaten vollzogen (CHANGELOG 1.22.0), Reviewer-Testdaten und
  Reviewer-Notes vorhanden, Privacy-Policy öffentlich verlinkt.
- CI-/Release-Workflows aktiv (`.github/workflows/ci.yml`, `release.yml`, `pages.yml`).

## 6. Verifikationskommandos

```bash
npm ci
npm run pre-submit-checks            # 0 Warnungen
npm test                             # 949 Tests, 0 Fehler
npm run lint:filtered                # ok, 24 bekannte TB-Fehlalarme
npm run check:i18n && npm run check:vendor && npm run check:design
npm run package                      # „Package content is valid“
npm run store-gate -- --no-commands  # NO-GO: C5, C6, C7
git ls-remote --tags origin | tail -5            # höchster Tag v1.22.0 (kein v1.23.0)
git diff --name-only v1.22.0..HEAD | grep -Ev '^(docs|test|tools|enterprise)/'   # M1-Beleg
find docs/screenshots -name '*.png' | wc -l      # 23 (Gate sieht 0)
```

## 7. Weiterleitung

Der daraus abgeleitete, gruppierte Aufgabenplan:
[AUFGABENPLAN_STORE_READINESS_1_23_0.md](AUFGABENPLAN_STORE_READINESS_1_23_0.md)
