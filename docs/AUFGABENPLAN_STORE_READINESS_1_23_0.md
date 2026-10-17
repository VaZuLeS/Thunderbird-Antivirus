# Aufgabenplan Store-Readiness 1.23.0 — „Thundy AV“ (Thunderbird Add-ons Store / ATN)

**Bezug:** [PROBLEMANALYSE_STORE_READINESS_1_23_0.md](PROBLEMANALYSE_STORE_READINESS_1_23_0.md)
(Befunde B1–B5, H1–H2, M1–M2) · erstellt mit
[KI_PROMPT_STORE_READINESS.md](KI_PROMPT_STORE_READINESS.md)
**Snapshot:** Branch `cline/rxk1fthv`, Basis `f9f1e95`, Add-on-Version 1.23.0
**Ziel:** Vollständige, überprüfbare Freigabe („GO“ im Submission-Gate) und Einreichung bei
addons.thunderbird.net (ATN)
**Stand:** 2026-10-16 (Runde 1 abgeschlossen: Gate-Ergebnis **GO**)

---

## 1. Vorgehen und Legende

Der Plan ist in Gruppen G0–G6 gegliedert (Ausführungsreihenfolge) und strikt
befund-zu-aufgabe-rückverfolgbar (Matrix in §2). Nach jeder Aufgabe existiert ein reproduzierbarer
Nachweis (DoD) — Zustände werden gemessen, nicht behauptet.

| Kürzel | Bedeutung |
|---|---|
| **B/H/M** | Schweregrad des Bezugs-Befunds (Blocker / hoch / mittel) aus der Problemanalyse 1.23.0 |
| **Aufwand** | grobe Schätzung in Stunden (1 Personentag ≈ 8 h) |
| **DoD** | Definition of Done: der Nachweis, der als erledigt gilt |
| **✋** | Aufgabe braucht eine Umgebung, die hier nicht existiert (ATN-Konto, Thunderbird-GUI, Windows/macOS) |

**Rollen:** *Entwicklung* (Code/Gate-Skripte), *Doku* (Policy/Listing/Assets), *QS* (Gates,
Live-Test), *Release* (Tag/Signatur/Upload). Bei einer Einzelperson sind das Zeitfenster, keine Personen.

---

## 2. Traceability-Matrix (Befund → Aufgabe)

| Befund | Kurztitel | Aufgaben |
|---|---|---|
| B1 | 1.23.0 nicht getaggt/veröffentlicht (C7 FAIL) | A-01, A-02, A-11 |
| B2 | ATN-Signierung/Einreichung offen ✋ | A-03, A-04, A-05 |
| B3 | Gate übersieht echte Screenshots (C5 Blindspot) | A-06, A-10 |
| B4 | Listing-Screenshots im ATN-Format fehlen | A-07, A-08, A-09 |
| B5 | Gate C6 wertet falsches Artefakt; kein 1.23-Protokoll | A-11, A-12 |
| H1 | Doku-Drift (Listing, Assets, decisions) | A-13, A-14, A-15 |
| H2 | Manuelle Restabdeckung (Plattformen/Betrieb) ✋ | A-16 – A-21 |
| M1 | `ARTIFACT_RELEVANT` unvollständig | A-10 (Teil), A-22 |
| M2 | Gate-/Check-Konsistenz Screenshots/Maße | A-10, A-23 |

---

## 3. Phase G0 — Entscheidungen & Vorbereitung

| ID | Aufgabe | DoD | Aufwand | Rollen |
|---|---|---|---|---|
| **E-01** | **Release-Scope bestätigen:** 1.23.0 (Stand `f9f1e95`, CHANGELOG-Eintrag vorhanden) als Einreichungskandidat festlegen; keine weiteren Features vor dem Tag | Entscheidung in [decisions.md](decisions.md) notiert (D12) | 0,5 h | Doku/Release |
| **E-02** | **Screenshot-Quelle festlegen:** finale Listing-Shots aus den vorhandenen echten Aufnahmen (≥ 1200 px Breite) ableiten oder neue Aufnahmen in der Thunderbird-GUI machen ✋ (falls neue nötig) | Entscheidung notiert; Motivliste aus [store_assets.md](store_assets.md) §3 zugeordnet | 0,5 h | Doku/QS |
| **E-03** | **Gate-Artefakte festlegen:** welche Dokumente gelten als Live-Test-Nachweis für C6 (Serie `live_test_<version>.md` und/oder [THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md)) | Entscheidung notiert; A-11 implementiert sie | 0,5 h | QS |

**Summe G0:** 1,5 h — reine Festlegungen, Vorbedingung für G1–G3.

---

## 4. Phase G1 — Blocker & Release

| ID | Aufgabe | DoD | Aufwand | Abhängig | Rolle |
|---|---|---|---|---|---|
| **A-01** | **Tag & GitHub-Release 1.23.0:** Tag `v1.23.0` auf den freigegebenen Commit; GitHub-Release (kein Pre-Release) mit unsigniertem XPI als Asset und den 1.23.0-Release-Notes aus [CHANGELOG.md](CHANGELOG.md) | `gh release view v1.23.0` zeigt Tag, Asset, Notes; `releases/latest` → `v1.23.0` | 1 h | E-01, A-22* | Release |
| **A-02** | **Gates erneut messen:** `npm run check` und `npm run store-gate` ausführen; C7 muss PASS melden | Gate-Protokoll: C7 PASS; XPI-SHA-256 dokumentiert | 0,5 h | A-01 | QS |
| **A-03** | **ATN-Signierung** ✋: `npx web-ext sign --amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed --approval-timeout 0` mit den ATN-API-Schlüsseln des Maintainers (Kommando steht in [STATUS.md](STATUS.md) „Remaining“ und `release.yml`) | Signiertes XPI vorliegend; Signier-Log dokumentiert | 1 h ✋ | A-02 | Release |
| **A-04** | **ATN-Einreichung** ✋: Listing-Felder aus [store_listing.md](store_listing.md) ausfüllen, signiertes XPI hochreichen, Version zur Prüfung einreichen | ATN-Status „in review“; Einreichungs-Screenshot dokumentiert | 1 h ✋ | A-03, G2 | Release |
| **A-05** | **Store-URL zurückführen** ✋: ATN-URL in README (EN/DE), [store_listing.md](store_listing.md), Landing-Page, [STATUS.md](STATUS.md) ergänzen | Kein „not submitted“ mehr; Gate-Doku erwähnt Store-URL | 1 h ✋ | A-04 | Doku |

**Summe G1:** 4,5 h (davon 2 h ✋ manuell) — kritischer Pfad: E-01 → A-01 → A-02 → A-03 → A-04 → A-05.
\* A-22 (Gate-Härtung M1) sollte **vor** dem Tag landen, damit C7 ab dem ersten Release korrekt wertet.

---

## 5. Phase G2 — Store-Assets & Listing

| ID | Aufgabe | DoD | Aufwand | Abhängig | Rolle |
|---|---|---|---|---|---|
| **A-06** | **SVG-Platzhalter entfernen:** `inline_optin_banner.svg`, `warning_banner.svg`, `options_page.svg` aus `docs/screenshots/` Top-Level entfernen (ehemalige Skizzen, seit 1.19.1 überholt) | Kein `*.svg` mehr in `docs/screenshots/` Top-Level; Gate-Verzeichnis enthält nur echte Aufnahmen | 0,25 h | E-02 | Doku |
| **A-07** | **Listing-Screenshot-Set kuratieren** ✋: pro Motiv aus [store_assets.md](store_assets.md) §3 genau ein PNG ablegen (`docs/screenshots/` Top-Level), Aufnahmen ≥ 1200 px Breite (Empfehlung 1280×800); falls keine Aufnahme ein Motiv abdeckt: neue Aufnahme in TB 140 ESR ✋ | `docs/screenshots/*.png` deckt jede Motiv-Zeile ab; Pre-Submit 0 Warnungen | 2 h ✋ | A-06 | QS/Doku |
| **A-08** | **store_listing.md auf 1.23.0:** Kopf (Version, Lizenz GPL-3.0-only), Update-Hinweis, Release-Notes-Block 1.23.0 (EN) fürs ATN-Dialogfeld | Dateikopf nennt 1.23.0; §6 enthält 1.23.0-Block | 1 h | E-01 | Doku |
| **A-09** | **store_assets.md auf Ist-Stand:** „Version 1.6.2“ → 1.23.0; Tabelle „Was existiert“ um die 23 echten PNGs erweitern; Abschnitt „Was fehlt“ neu schreiben | Dokument behauptet nichts Falsches mehr (Abgleich mit `find docs/screenshots`) | 1 h | A-07 | Doku |

**Summe G2:** 4,25 h (davon 2 h ✋) — kritischer Pfad für C5: A-06 → A-07 → `store-gate` C5 PASS.

---

## 6. Phase G3 — Gate-/Tooling-Härtung

| ID | Aufgabe | DoD | Aufwand | Abhängig | Rolle |
|---|---|---|---|---|---|
| **A-10** | **C5-Screenshotprüfung reparieren (B3/M2):** `hasScreenshots()` in `scripts/submission-gate.js` rekursiv machen; Mindestbreite (1200 px, PNG-Header-Lesen ohne neue Abhängigkeit) prüfen; dieselbe Logik im Pre-Submit-Check verwenden | `submission-gate.test.js` erweitert; Gate meldet die 23 vorhandenen PNGs; C5 FAIL nur noch bei fehlender Kuratierung (A-07) | 2 h | E-02 | Entwicklung |
| **A-11** | **C6-Artefakte erweitern (B5/B1):** `liveTestSummary()` akzeptiert konfigurierbare Nachweisquellen: `live_test_<version>.md` (Summenzeile) und/oder Abnahme-Dokument mit Versionstoken `1.23.0` | Gate wertet [THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md) als 1.23.0-Nachweis → C6 PASS, sobald E-03 fixiert ist | 2 h | E-03 | Entwicklung |
| **A-12** | **`ARTIFACT_RELEVANT` dynamisch machen (M1):** Muster aus `manifest.json` ableiten (`background.scripts`, `message_display_action.default_popup`, `options_ui.page`, alle im XPI liegenden CSS/HTML) statt handgepflegter Regex | `submission-gate.test.js` deckt `audit.js`/`design_system.js`/`message_ui.js` als artefaktrelevant ab | 1 h | — | Entwicklung |
| **A-13** | **Gate-Kriterien-Doku aktualisieren:** [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) §9 / Gate-Kopftext an neue C5/C6-Quellen anpassen | Gate-Kopf beschreibt die tatsächlichen Kriterien | 0,5 h | A-10, A-11 | Doku |

**Summe G3:** 5,5 h — kritischer Pfad für ein ehrliches GO: A-10 + A-11 + A-12 **vor** dem Tag (A-01).

---

## 7. Phase G4 — QS & Live-Test

| ID | Aufgabe | DoD | Aufwand | Abhängig | Rolle |
|---|---|---|---|---|---|
| **A-14** | **Live-Test-Nachweis 1.23.0 formalisieren (B5):** `docs/live_test_1_23_0.md` anlegen (Serie fortsetzen) mit Summenzeile aus der realen Abnahme, oder — je nach E-03 — Abnahme-Dokument als Quelle konfigurieren | `store-gate` → C6 PASS mit benannter Quelle | 2 h | E-03, A-11 | QS |
| **A-15** | **Regressionstest nach Gate-Härtung:** kompletter Lauf `npm run check` + `npm run store-gate` | Alle C1–C4 grün; C5/C6/C7-Status entspricht dem realen Stand | 0,5 h | A-10 – A-12 | QS |
| **A-16** | **Windows-Abnahme** ✋: Installation, Wizard, Banner, Popup, Audit in TB 140 ESR auf Windows | Abnahme-Abschnitt + Screenshots wie Linux-Dokument | 4 h ✋ | A-02 | QS |
| **A-17** | **macOS-Abnahme** ✋: wie A-16 auf macOS | Abnahme-Abschnitt + Screenshots | 4 h ✋ | A-02 | QS |
| **A-18** | **Screenreader/DPI/Zoom** ✋: Navigation mit OS-Screenreader, DPI/Zoom-Matrix (dokumentierte Grenze aus [THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md)) | Berichtsabschnitt; offene Grenzen benannt | 4 h ✋ | A-16 | QS |
| **A-19** | **Standardbrowser-Übergabe real** ✋: Time-of-Click-Übergabe mit Firefox/Chrome/Edge als Default (bislang nur OS-Empfänger-Isolation) | Berichtsabschnitt pro Browser | 3 h ✋ | A-16 | QS |
| **A-20** | **Automatische Updateverteilung** ✋: Update-Pfad über ATN/em:updates mit Neustart, Rollback-Fall | Berichtsabschnitt | 3 h ✋ | A-03 | QS |
| **A-21** | **Produktive N06-Nachweise** ✋: Kernfunktionen unter Produktivbedingungen (nicht nur Xvfb-Isolation) je [ENTERPRISE_NAECHSTE_SCHRITTE.md](ENTERPRISE_NAECHSTE_SCHRITTE.md) | Nachweispaket in `docs/enterprise/` | 8 h ✋ | A-16 | QS |

**Summe G4:** 28,5 h (davon 26 h ✋ manuell) — A-14/A-15 blockieren das GO; A-16 – A-21 sind
Produktiv-/Plattformqualität nach der Einreichung.

---

## 8. Phase G5 — Doku-Konsistenz

| ID | Aufgabe | DoD | Aufwand | Abhängig | Rolle |
|---|---|---|---|---|---|
| **A-22** | **decisions.md fortführen:** D12 (Release-Scope 1.23.0, E-01), D13 (Gate-Artefakte E-03), D14 (Screenshot-Regel E-02) eintragen; Kopf „Thundy AV 1.6“ → laufende Version | [decisions.md](decisions.md) Kopf und Einträge stimmen | 0,5 h | G0 | Doku |
| **A-23** | **Versionskonsistenz-Grep:** README (EN/DE), STATUS, store_listing, store_assets, decisions, quickstart auf 1.23.0 prüfen; Snapshots (`*_1_19_*`, historische Analysen) bleiben unverändert | `grep -rn "Version.*1\\.6\\b" docs/store_*.md` leer; alle Aktuals-Dokumente nennen 1.23.0 | 0,5 h | A-08, A-09 | Doku |

**Summe G5:** 1 h — überwiegend Abgleich, kein Produktivcode.

---

## 9. Phase G6 — Erweiterungen & Ergänzungen (nach dem GO, nicht blockierend)

| ID | Aufgabe | Beziehung | DoD |
|---|---|---|---|
| **A-24** | **ATN-Review-Rücklauf einrichten:** Prozess für Reviewer-Kommentare (Issue-Vorlage, Fristen, Nachbesserungs-Runde im Aufgabenplan fortgeschrieben) | H2/B2-Folge | Reviewer-Kommentare landen als neue Befunde im Plan |
| **A-25** | **Enterprise-/N06-Fahrplan anbinden:** offene Enterprise-Punkte aus [ENTERPRISE_NAECHSTE_SCHRITTE.md](ENTERPRISE_NAECHSTE_SCHRITTE.md) in eine eigene Planrunde überführen | H2 | Eigener Aufgabenplan mit gleicher Struktur (G0–G6) |
| **A-26** | **Update-/Support-Kanal:** FAQ/Support-Sektion für Store-Nutzer aus den Support-Kanälen speisen; Store-URL + Signaturprüfung in Doku | A-05 | Support-Abschnitt im Listing verlinkt |

**Summe G6:** nach GO zu planen; bewusst von G1–G5 entkoppelt, damit der Freigabepfad kurz bleibt.

---

## 10. Gesamtbild und kritischer Pfad

| Gruppe | Summe | davon ✋ |
|---|---|---|
| G0 Entscheidungen | 1,5 h | — |
| G1 Blocker & Release | 4,5 h | 2 h |
| G2 Store-Assets & Listing | 4,25 h | 2 h |
| G3 Gate-/Tooling-Härtung | 5,5 h | — |
| G4 QS & Live-Test | 28,5 h | 26 h |
| G5 Doku-Konsistenz | 1 h | — |
| **GO-Pfad (G0–G3 + A-14, A-15, A-23)** | **≈ 16 h** | **≈ 2 h** |

**Kritischer Pfad zum GO:** E-01 → A-12 → A-10 → A-11 → A-01 (Tag) → A-02 → A-06 → A-07 →
A-14 → A-15 → Gate GO → A-03 → A-04 (Einreichung) → A-05.
Der GO-Pfad ist fast vollständig automatisierbar; die einzigen ✋-Schritte auf dem Pfad sind die
Listing-Screenshot-Kuratierung (A-07) und die ATN-Signierung/Einreichung (A-03/A-04) mit den
Maintainer-Schlüsseln.

---

## 11. Runde 1 — Ausführungsstand (abgeschlossen, 2026-10-16)

**Ergebnis: `npm run store-gate` → GO, alle Kriterien C1–C7 PASS, Exit 0.**
Release https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.23.0 („Latest“).

| ID | Status | Nachweis |
|---|---|---|
| E-01 | **erledigt** | D12 in [decisions.md](decisions.md) |
| E-02 | **erledigt** | D14 in [decisions.md](decisions.md); Motiv-Zuordnung in [store_assets.md](store_assets.md) §3 |
| E-03 | **erledigt** | D13 in [decisions.md](decisions.md) |
| A-01 | **erledigt** | Tag `v1.23.0` auf `df63c76`; Release mit Asset `thundy-av-1.23.0.xpi` (218.405 Bytes, SHA-256 `00ab882d…e6234`), kein Pre-Release, „Latest“ |
| A-02 | **erledigt** | `npm run store-gate` Exit 0 → C1–C7 PASS; heruntergeladenes Asset byte-identisch (SHA-256 gleich) |
| A-03 | **offen ✋** | ATN-Signierung braucht die API-Schlüssel des Maintainers; Kommando in [STATUS.md](STATUS.md) „Remaining“ |
| A-04 | **offen ✋** | ATN-Einreichung nach A-03 |
| A-05 | **offen ✋** | Store-URL nach der Einreichung |
| A-06 | **erledigt** | `git rm` der drei SVG-Platzhalter; `docs/screenshots/` enthält nur echte Aufnahmen |
| A-07 | **erledigt** | Listing-Set je Motiv kuratiert ([store_assets.md](store_assets.md) §3); Motiv 6 (Opt-in-Banner) mit **realer Aufnahme** (`optin-banner.png`, 1280 × 1000, Banner programmatisch verifiziert) geschlossen; nur Motiv 7 (Threat-Banner) bleibt offen ✋ — dokumentiert, blockiert C5 nicht |
| A-07-Nachtrag (Runde 2) | **erledigt** | Unabhängiger Wiederholungslauf der Live-Abnahme in einer zweiten Umgebung (Debian 12, Mozilla-Binary 140.17.0esr, identische Build-ID): `passed: true` mit OS-Übergabe-Beleg ([audits/thunderbird-140-repeat.json](audits/thunderbird-140-repeat.json)); Runner um optionales `--banner-root-shot` erweitert (CI-Verhalten unverändert), siehe [live_test_1_23_0.md](live_test_1_23_0.md) „Wiederholungslauf" |
| A-08 | **erledigt** | [store_listing.md](store_listing.md): Kopf, Metadaten, Release-Notes-Block 1.23.0, Checkliste auf Ist-Stand |
| A-09 | **erledigt** | [store_assets.md](store_assets.md): 23 echte Aufnahmen dokumentiert, „Was fehlt“ neu geschrieben |
| A-10 | **erledigt** | `scripts/screenshot-inventory.js` (rekursiv, PNG/JPEG-Breitenlogik), geteilt mit Pre-Submit-Check; 11 Gate-Tests grün |
| A-11 | **erledigt** | `liveTestSummary(rootDir, version)` liest `live_test_<version>.md` (Punkte → Unterstriche) vor dem Legacy-Protokoll |
| A-12 | **erledigt** | `isArtifactRelevant` aus `verify-package.js` (`ALLOWED_FILES`/`ALLOWED_PREFIXES`) abgeleitet; Test deckt `audit.js`, `design_system.js`, `message_ui.js` … ab |
| A-13 | **erledigt** | Gate-Kopf dokumentiert die C5/C6/C7-Artefaktquellen; [screenshot_capture.md](screenshot_capture.md) aktualisiert |
| A-14 | **erledigt** | [live_test_1_23_0.md](live_test_1_23_0.md) mit Summe 25 OK / 0 FAIL / 0 N/A / 5 OFFEN, zeilenweise aus der Abnahme zitiert; Gate: C6 PASS |
| A-15 | **erledigt** | `npm run check` Exit 0 (953 Tests, 0 Fehler, Lint ok, Paket valid); anschließend voller `store-gate` → GO |
| A-16 – A-21 | **offen ✋** | Windows, macOS, Screenreader/DPI, Browserübergabe, Updateverteilung, produktive N06 — brauchen reale Umgebungen |
| A-22 | **erledigt** | D12–D14 in [decisions.md](decisions.md), Kopf auf „Thundy AV“ ohne Alt-Version |
| A-23 | **erledigt** | Versions-Grep: `store_listing.md`/`store_assets.md` nennen 1.23.0; verbleibende 1.6.x-Referenzen nur in als historisch markierten Snapshots (STATUS §„Stand: 1. Oktober 2026“) |
| A-24 | **erledigt** | Review-Rücklauf-Prozess: [atn_review_process.md](atn_review_process.md) (SOP, Fristen, Eskalation) + Issue-Vorlage `.github/ISSUE_TEMPLATE/atn_review_feedback.md` mit Label `atn-review` |
| A-25 | **erledigt** | Enterprise-Fahrplan: [AUFGABENPLAN_ENTERPRISE_N06.md](AUFGABENPLAN_ENTERPRISE_N06.md) (G0–G6, Traceability zu N01–N18, 19 EN-Tasks, ≈ 150 h davon ≈ 146 h ✋) |
| A-26 | **erledigt** | Support-Kanal: [support_faq.md](support_faq.md) (Kanäle inkl. Signaturprüfung über `SHA256SUMS.txt`, FAQ, Grenzen); verlinkt aus [store_listing.md](store_listing.md) |

**Verbleibende Blocker bis zur Store-Listung:** ausschließlich A-03/A-04 (Signierung + Einreichung,
✋ Maintainer-Schlüssel) und danach A-05 (Store-URL). Alle automatisierbaren Kriterien sind PASS.

---

## 12. Die GO-Funktion einsetzen (Betrieb)

Die „Goal-Funktion" des Plans ist das ausführbare Go/No-Go-Kriterium: `scripts/submission-gate.js`
misst C1–C7 statt Meinungen. Sie ist an drei Stellen dauerhaft verdrahtet:

### 12.1 Aufruf

| Kommando | Bedeutung | Exit-Code |
|---|---|---|
| `npm run goal` (Alias: `npm run store-gate`) | Vollständige Messung: C1–C4 als echte Kommandos (Pre-Submit, 953 Tests, Lint, Build+Paketprüfung) und C5–C7 als Artefakte | **0 = GO**, 1 = NO-GO |
| `npm run goal -- --no-commands` | Schneller Artefaktstand; C1–C4 werden SKIP gezählt und zählen bewusst **nicht** als PASS → Ergebnis ist dort immer NO-GO | 1 |
| `npm run goal > gate.log; echo $?` | Maschinelle Auswertung (CI/Skripte): Exit-Code ist die GO-Entscheidung | 0/1 |

Interpretation: Ein Kriterium FAIL nennt in der Ausgabe den fehlenden Nachweis und die zugehörige
Aufgaben-ID; der fehlgeschlagene Gate-Lauf ist also direkt die Arbeitliste der nächsten Runde.

### 12.2 Verdrahtung (seit Runde 1)

Die GO-Funktion ist als `npm run goal` in den **übernahmefähigen Workflow-Definitionen**
(`docs/ci/`, siehe [ci/README.md](ci/README.md)) dauerhaft verdrahtet; die Aktivierung im
Repository braucht einen Token mit `workflows`-Berechtigung (deshalb der Spiegel-Mechanismus):

- **CI (`docs/ci/ci.yml`):** nach Build+Paketprüfung läuft `npm run goal` — das GO wird bei jedem
  Push neu gemessen. Ändert jemand eine paketierte Datei nach dem Release-Tag, fällt C7 aus und
  der Lauf rotiert (M1-Schutz).
- **ATN-Signierung (`docs/ci/release.yml`, `workflow_dispatch`):** `npm run goal` steht **vor**
  `web-ext sign` — ein NO-GO bricht ab, bevor ein einziger ATN-API-Aufruf passiert; A-03/A-04
  sind damit strukturell an das GO gebunden.
- **GitHub-Release (`docs/ci/release-publish.yml`, Tag-Push `v*`):** publishes nur bei GO; der
  Veröffentlichungsschritt ist idempotent (create → upload --clobber), damit ein manuell vorab
  erzeugtes Release den Lauf nicht scheitern lässt (Runde-1-Erfahrung am Tag `v1.23.0`).
- **Lokal** ist die Funktion sofort scharf: `npm run goal` (Exit 0 = GO) ohne jeden GitHub-Bezug.

**Übernahme** (Token mit `workflows`-Berechtigung):
`cp docs/ci/ci.yml .github/workflows/ci.yml && cp docs/ci/release-publish.yml .github/workflows/release.yml`

### 12.3 Zyklus für Runde 2 (nach der Einreichung)

1. ATN-Signierung/Einreichung (A-03/A-04) ausführen; danach `npm run goal` erneut — die Kriterien
   bleiben unverändert, neue Erkenntnisse werden als neue Befunde in die Problemanalyse geschrieben.
2. Reviewer-Rücklauf (A-24) landet als Befunde B6/H3/M3 … im Plan; jede Nachbesserung ändert
   paketierte Dateien → Version bump → neuer Tag → GO neu messen (C7 erzwingt das).
3. Die Runde-Tabelle in §11 wird fortgeschrieben (Status + Nachweis je ID), der Plan bleibt damit
   das Ausführungsprotokoll.
