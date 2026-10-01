# Problemanalyse Store-Readiness — „Thundy AV“ (Thunderbird Add-ons Store / ATN)

**Prüfgegenstand:** Repository `VaZuLeS/Thunderbird-Antivirus`
**Snapshot:** Branch `cline/k0d34w90`, Basis-Commit `4c4898c` (= `origin/main` zum Prüfzeitpunkt)
**Add-on:** Thundy AV – Email Scanner for Thunderbird, `manifest.json` Version **1.6** (MV3, `strict_min_version` 140.0)
**Zielplattform:** addons.thunderbird.net (ATN) — Listung + Signierung (`--channel listed`)
**Prüfmethode:** statische Code-Analyse, Ausführung der Repository-Gates, XPI-Inspektion, Abgleich gegen
Thunderbird-Schemas/API-Doku und Mozilla-Policies; ergänzt durch zwei unabhängige Auditläufe (Code,
Dokumentation) und einen Build-/Pipeline-Audit
**Stand:** 2026-09-30

---

## 0. Kurzfassung

Das Add-on ist auf diesem Stand **noch nicht store-ready**. Die technische Basis ist deutlich besser als bei
der ersten Analyse (MV3-Manifest korrekt, entfernte APIs nur noch als toter Fallback, Tests und
Pre-Submit-Checks laufen, XPI baut) — es bleiben aber **neun harte Blocker** und eine Reihe fehlender
Nachweise. Sieben Blocker sind inhaltlich neu bzw. bisher nicht belegt:

1. **Daten-Deklaration widerspricht dem Verhalten** (`required: ["personalCommunications"]`, obwohl ohne
   Opt-in nichts übertragen wird) — Thunderbird hat laut eigener API-Doku *keinen* automatischen
   Consent-Prompt, deshalb ist die `required`-Deklaration zugleich sachlich falsch und policy-relevant.
2. **Die Datenschutz-Zusage „strikt = nur Hashes“ ist im Code nicht haltbar**, weil die *manuellen* Pfade
   (Popup-Upload, Link-/Kontextmenü-Scan) die Datenschutz-Stufe nicht prüfen und in Stufe `strict` den
   vollständigen Anhang bzw. URLs senden.
3. **Das Popup überträgt ohne globale Zustimmung**: `api.js:515–548` ruft Hybrid Analysis direkt auf; die
   Konsent-Prüfung (`api.js:136`) blendet nur einen Hinweis ein und verhindert nichts.
4. **Die Kontextmenü-Einträge sind tot**: `manifest.json` deklariert die Berechtigung `menus` nicht, die der
   Thunderbird-Namespace `menus` verlangt — beide Einträge werden stillschweigend nie erzeugt.
5. **Das Popup-Skript ist defekt**: `syncFragment` (`api.js:193`, `:210`) und `container` (`api.js:218`) sind
   nicht definiert → `ReferenceError`, der Analysebereich rendert nicht (per `eslint no-undef` belegt).
6. **Das Paket-Gate ist rot**: das gebaute XPI enthält zwei Entwickler-Scratch-Dateien
   (`test_regex_escape.js`, `test_regex_escape2.js`), `scripts/verify-package.js` endet mit Exit-Code 1.
7. **Kernfunktion nicht live belegt**: Banner-Injektion, Kontextmenü und `permissions.request()` aus dem
   Banner sind nur mit gemockten Thunderbird-APIs getestet; in Thunderbird 140 ESR wurde das nie manuell
   geprüft. Dazu: keine echten Screenshots (nur SVG-Platzhalter) und noch keine ATN-Listung.

**Gezählte Befunde:** 9 Blocker (P0-1 … P0-9), 9 hohe (P1-7 … P1-15), 11 mittlere (P2-14 … P2-24),
6 niedrige (P3-20 … P3-25). Die Kennungen sind stabile Labels (Präfix = Schweregrad), keine Sortierung.

**Gesamturteil: NO-GO** (Kriterien in §9). Der zugehörige Arbeitsplan steht in
[AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md).

---

## 0.1 Update 2026-10-01 — Umsetzungsstand nach dem Arbeitslauf

Der Aufgabenplan wurde abgearbeitet (Details und Nachweise: §11 des Aufgabenplans, Entscheidungen in
[decisions.md](decisions.md)). Kurzfassung:

- **behoben:** P0-1, P0-2, P0-6, P0-7, P0-8, P0-9, P1-7 (Spiegel), P1-8, P1-9, P1-10, P1-11, P1-12,
  P1-14 (Spiegel), P1-15 (Spiegel) sowie die meisten P2-/P3-Befunde.
- **entschieden:** P0-5 (Einreichungskandidat = dieser Zweig, Version 1.6).
- **offen und nur manuell zu erledigen:** P0-3 (Live-Test in Thunderbird 140 ESR), P0-4 (echte
  Screenshots) und der Tag-/Artefaktschritt aus P1-13.

Gemessene Gates in diesem Zustand: Pre-Submit-Checks 0 Fehler / 1 Warnung, `npm test` 427 Tests / 0 Fehler,
`npm run lint:filtered` 0 Fehler / 19 kuratierte Warnungen, `npm run package` 17 Dateien / 196.505 Bytes
(„valid“), `npm run store-gate` = **NO-GO** mit C1–C4 PASS und C5/C6/C7 offen.

**Das Gesamturteil bleibt damit NO-GO** — allerdings nicht mehr wegen der Daten-/Consent-/Paket-Blocker,
sondern ausschließlich wegen der drei Nachweise, die eine echte Thunderbird-Installation bzw. ein
ATN-Konto erfordern.

---

## 0.2 Update 2026-10-01 (Runde 2) — Release 1.6.2

Der Auftrag „veröffentliche eine neue Version“ wird mit diesem Abschnitt als eigene, kleine
Analyse-/Planrunde geführt (Aufgaben R-01 … R-08 in §12 des Aufgabenplans). Neue Befunde, die
**das Veröffentlichen** betreffen:

### R-1 — Mehrdeutige Versionslage (Blocker für ein Release)
**Belege:** `manifest.json` stand auf `1.6` (pre-submit-konsistent mit `package.json` `1.6.0`), während im
Repository die Tags `v1.6`, `v1.6.1`, `v1.7.0` … `v1.18.0` existieren — alle mit derselben Add-on-ID
(`thundy-av@bludau-it-services.de`). `v1.6` zeigt auf einen **älteren** Commit (`351001f`), ein Tag
„1.6“ auf dem aktuellen Stand ist also unmöglich, ohne einen bestehenden Tag umzuschreiben.
**ATN-Abfrage (entscheidend):** `api/v4/addons/addon/thundy-av@bludau-it-services.de/` → **HTTP 404**,
d. h. es ist **keine** Version dieses Add-ons veröffentlicht; es gibt keine Monotonie-Vorgabe von ATN.
**Entscheidung (D11):** Version **1.6.2** — nächster Patch auf der Linie, die `main` repräsentiert; Tag
`v1.6.2` ist frei; keine Aussage über die nie veröffentlichte 1.7–1.18-Linie. (Bewusst nicht 1.19.0: das
würde eine Produkthistorie suggerieren, die es nicht gibt.)
**Fix:** `manifest.json` `1.6.2`, `package.json`/`package-lock.json` `1.6.2`, Tag `v1.6.2`, Release.

### R-2 — Kein Release-Artefakt für den Kandidaten (hoch)
**Belege:** Der einzige XPI-Anhang mit dem Fix-Stand existierte als Pre-Release `v1.6`
(`thundy-av-1.6.xpi`, Basis `351001f`); das Store-Gate meldete genau deshalb `FAIL C7` („v1.6 points at
351001f9 but the submitted commit is …“). Ohne Tag + Release ist nicht belegbar, welcher Commit
eingereicht wurde.
**Fix:** Release mit dem aus dem aktuellen Commit gebauten XPI **und** dessen SHA-256.

### R-3 — Release-Hinweise fehlten für den Fix-Stand (mittel)
**Belege:** `CHANGELOG.md` endete bei `[1.6.0] – 2026-09-28`; `[Unreleased]` war leer; die ATN-Release-Notes
im Listing beschrieben nur 1.6. Ein Release ohne sichtbare Änderungsliste ist für Reviewer und Nutzer
unvollständig.
**Fix:** `CHANGELOG.md` 1.6.2 (Fixed/Changed) und ein englischer Release-Notes-Block im Store-Listing.

### R-4 — Versionsdrift in der Dokumentation (mittel)
**Belege:** Nach dem Bump nannten README (EN/DE), `docs/STATUS.md`, `docs/index.md`,
`docs/store_listing.md`, `docs/store_assets.md`, `docs/screenshot_capture.md`, `docs/privacy_policy.md`
(DE/EN-Kopf), `docs/live_test_protocol.md` und `docs/quickstart.md` weiterhin „Version 1.6“ — darunter
Dateien, die Reviewern als Nachweis dienen.
**Fix:** Versionsangaben auf 1.6.2 angeglichen; historische Snapshot-Dokumente (Problemanalyse Runde 1,
`STORE_READINESS_ANALYSIS.md`, `docs/audits/`) bleiben unverändert und sind als Snapshot gekennzeichnet.

### R-5 — Release-Ablauf war nicht dokumentiert (mittel)
**Belege:** Weder Tag noch Build noch Anhängen des XPI waren als Ablauf festgehalten; `docs/ci/release.yml`
beschreibt nur das Signieren bei ATN. Der Build ist zudem **nicht byte-reproduzierbar** (P2-21: wechselnde
Eintragsreihenfolge/Zeitstempel), ein Hash ist deshalb nur für genau dieses Artefakt gültig.
**Fix:** Ablauf + Hash in `docs/decisions.md` (D11) und `docs/STATUS.md` dokumentieren.

### R-6 — „Latest“-Release bleibt das von 2024 (niedrig, Rest aus P1-13)
**Belege:** `gh api repos/…/releases/latest` → `Thunderbird` (2024). GitHub definiert „latest“ als jüngstes
nicht-Pre-Release; ein `make_latest=false` ändert daran nichts (in Runde 1 reproduziert).
**Fix:** Sobald dieses Release regulär (nicht als Pre-Release) veröffentlicht ist, ist es automatisch
„Latest“ — damit ist der Befund ohne destructive Eingriffe gelöst.

---

## 1. Zielbild „store-ready“

„Store-ready“ heißt hier: das Add-on erfüllt die ATN-Einreichungsanforderungen und ist in der deklarierten
Zielumgebung nachweislich funktionsfähig. Vor der Einreichung sind zu belegen:

| # | Anforderung | Quelle |
|---|---|---|
| Z1 | Manifest ist valide und MV3-konform; nur Laufzeitdateien im XPI | ATN-Validierung (addons-linter), `web-ext lint` |
| Z2 | Keine in Manifest V3 entfernten APIs im Produktivpfad | Thunderbird-MV3-Konvertierungsguide |
| Z3 | Jede Übermittlung ist zugestimmt, dokumentiert und **in der Doku wahrheitsgemäß beschrieben** | Mozilla Add-on-Policies 1, 6.1, 6.2; Firefox-Datenkonsent-Doku |
| Z4 | Die Daten-Deklaration (`data_collection_permissions`) beschreibt die Praxis korrekt | Firefox-Datenkonsent-Doku; addons-linter-Regeln |
| Z5 | Reviewer prüfen alle Funktionen mit vertretbarem Aufwand (Notes, Testweg, Testdaten) | ATN-Review-Prozess |
| Z6 | Listing-Pflichtfelder vollständig: Name, Summary, Beschreibung, Kategorie, Lizenz, Privacy-Policy-URL, Support, **Screenshots**, Releasenotes | Extension Workshop „Submitting an add-on“ / „Create an appealing listing“ |
| Z7 | Eindeutiges Release-Artefakt, monotone Version, reproduzierbarer Build | ATN-Signierung (`web-ext sign --channel listed`) |
| Z8 | Datenschutzerklärung öffentlich erreichbar, konsistent mit Code und Listing | Policy 6.1 |


---

## 2. Verifizierter Ist-Zustand (Nachweise)

Alle Werte wurden in dieser Umgebung selbst gemessen (Ausgaben gekürzt):

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| Unit-Tests | `npm test` | **389 Tests / 0 Fehler** (65 Suites); enthält zwei Dateien ohne Assertions (s. P2-16) |
| Pre-Submit-Checks | `node scripts/pre-submit-checks.js` | **Exit 0**, 1 Warnung: *„no PNG/JPEG screenshots found in docs/“* |
| Linter | `npx web-ext lint --source-dir . --output json` | **0 Fehler / 26 Warnungen** (addons-linter 10.13.0) |
| Lint-Filter | `node scripts/filter-lint-warnings.js /tmp/lint.json` | Exit 0 — alle 26 Warnungen stehen auf der Allow-Liste (s. P1-8) |
| Build | `npx web-ext build --source-dir . --artifacts-dir /tmp/build` | Exit 0 → `thundy_av_email_scanner_for_thunderbird-1.6.zip` (48.890 Bytes gezippt) |
| Paketinhalt | `unzip -l` + `node scripts/verify-package.js /tmp/build` | **19 Dateien, 180.856 Bytes entpackt; Paketprüfung FAILED (Exit 1)** → `test_regex_escape.js`, `test_regex_escape2.js` (P0-6) |
| Manifest-Schema | Abgleich mit Thunderbird-/Gecko-Schemas | MV3-Keys gültig; `data_collection_permissions` existiert im Gecko-Manifest-Schema |
| Entfernte MV3-APIs | Schema `mail/components/extensions/schemas/messageDisplay.json` | `onMessageDisplayed` / `getDisplayedMessage` sind `max_manifest_version: 2` → in MV3 nicht verfügbar |
| Injektions-API | Schema `scripting-tb.json` | `scripting.messageDisplay` bietet **nur** `getRegisteredScripts` / `registerScripts` / `unregisterScripts` (kein `executeScript`), Permission `messagesRead` |
| Injektionspfad | TB-Browsertest `browser_ext_messageDisplayScripts_mv3.js` | `browser.scripting.executeScript({target:{tabId}})` funktioniert auf `mail`- und `messageDisplay`-Tabs, **benötigt** die Host-Berechtigung aus `messagesRead` (Test ohne sie: *„Missing host permission for the tab“*) |
| Kontextmenü-Kontexte | Schema `menus.json` (`ContextType`) | `"link"` und `"message_display_action"` sind gültige Kontexte |
| Daten-Deklaration | 3 Manifest-Varianten + `web-ext lint` | `required:["none"]` + `optional:["personalCommunications"]` → **0 Fehler**; aktuelles `required:["personalCommunications"]` → 0 Fehler; fehlender Key → Warnung `MISSING_DATA_COLLECTION_PERMISSIONS` |
| ATN-/TB-Doku (Consent) | `webextension-api.thunderbird.net/en/mv3/permissions.html` | *„Unlike Firefox, Thunderbird does not use the built-in onboarding flow that prompts users to opt into data collection. In Thunderbird, add-ons must request consent explicitly …“* |
| CI | `diff docs/ci/ci.yml .github/workflows/ci.yml` | Aktiv ist die **reduzierte** Variante (nur `background.test.js`, Lint ohne Filter, kein Build/Paketcheck) |
| Repo-Zustand | `gh release list`, `gh api …/tags`, `gh api compare/main...v1.18.0` | „Latest“-Release ist von **2024** (Tag `Thunderbird`, Asset eines alten Stands); zusätzlich Tags `v1.6` … `v1.18.0`; `v1.18.0` ist von `main` **divergiert** (17 vor / 18 zurück); 400+ Branches |
| Sicherheit | Grep auf `eval(`, `new Function`, `innerHTML` | Keine Treffer im Laufzeitcode; CSP `script-src 'self'; object-src 'none'`; keine Secrets im Repo |
| Popup-Konsent | `grep -n externalAnalysisConsent api.js` | nur Zeilen 82/83/136 — die Notizkarte verhindert die Übertragung **nicht**; der `fetch` steht in `api.js:532` |
| Popup-Skript | `npx eslint --no-config-lookup --config … --rule no-undef api.js` | 3 echte Fehler (nach Ausschluss des Extension-Globals `browser`): `syncFragment` (`api.js:193`, `:210`) und `container` (`api.js:218`) sind nicht definiert |
| `menus`-Berechtigung | `manifest.json:19–25` vs. Schema `mail/components/extensions/schemas/menus.json` | Schema verlangt `permissions: ["menus"]`; das Manifest listet sie nicht → beide Kontextmenü-Pfade sind ohne Wirkung (`background.js:1745`, `:1815`) |
| CI-Testumfang | `gh run view <run> --log` + Testzählung pro Datei | aktiv läuft nur `background.test.js` = **243 von 389 Tests** (146 Tests / 37 % fehlen) |
| Lint-Gate | `npx web-ext dump-config` | `warningsAsErrors: false`; die 26 Warnungen brechen den Job nicht ab, der kuratierte Filter läuft nur im **nicht** aktiven Spiegel |
| Signieren | `npx web-ext sign --help`, `node_modules/web-ext/lib/program.js:19` | Default-Endpunkt ist `https://addons.mozilla.org/api/v5/` (AMO), Approval-Timeout 900 s |
| Ignore-Konfiguration | `npx web-ext build --no-config-discovery --source-dir .` | 67 Dateien → `.webextignore` wird von `web-ext` **nicht** gelesen; alle Excludes stammen aus `web-ext-config.mjs` |
| Lokalisierung | `_locales/en/messages.json` vs. `de` | 25 Schlüssel, identische Mengen |

**Wichtiger Kontext für die Interpretation:** `main` ist Version **1.6**. Im Repository existieren
gleichzeitig Tags/Releases bis **v1.18.0** auf einer von `main` divergierten Linie (Branch
`cline/573mahd6`, dort Stand `1.6.1` mit i18n, Testdaten und einem „Go/No-Go“-Skript). Diese Analyse bewertet
**ausschließlich den lokalen Snapshot (1.6)**; die divergierte Linie wird als eigener Befund geführt (P0-5),
weil ohne die Entscheidung „welche Linie wird eingereicht“ jede weitere Arbeit am falschen Artefakt landen kann.
---

## 3. Gesamturteil

| Bereich | Bewertung | Begründung (Befund) |
|---|---|---|
| Manifest / MV3-Konformität | 🟡 **ok mit Lücken** | MV3-Keys gültig, keine entfernten APIs im Produktivpfad; aber `menus`-Permission fehlt (P0-8), toter MV2-Fallback (P1-10), zu grober Lint-Filter (P1-8) |
| Daten-Deklaration / Consent | 🔴 **Blocker** | `required: ["personalCommunications"]` widerspricht dem Opt-in-Verhalten (P0-1); das Popup überträgt sogar **ohne** Zustimmung (P0-7) |
| Datenschutz-Doku vs. Code | 🔴 **Blocker** | Manuelle Uploads/URL-Scans umgehen die Datenschutz-Stufe, die Doku behauptet das Gegenteil (P0-2) |
| Popup-Funktion | 🔴 **Blocker** | `ReferenceError` im Popup-Skript; Analysebereich rendert nicht (P0-9) |
| Live-Funktionsnachweis in TB | 🔴 **Blocker** | Banner/Kontextmenü/Permission-Geste nie manuell geprüft (P0-3) |
| Listing-/Asset-Reife | 🔴 **Blocker** | Keine echten Screenshots, keine Testmittel für Reviewer, keine Listung (P0-4, P2-17) |
| Paket-/Release-Hygiene | 🔴 **Blocker** | XPI enthält Fremddateien, Paket-Gate rot und potenziell blind fürs falsche Artefakt, divergente Versionslinie (P0-5, P0-6, P2-20) |
| Signierweg | 🔴 **Blocker (Prozess)** | Signieraufruf zeigt per Default auf AMO; `--channel listed` läuft in den 15-min-Timeout (P1-14, P1-15) |
| CI-/Qualitätsgates | 🟠 **hoch** | Aktive CI prüft 243 von 389 Tests und hat kein Build-/Paketgate; Lint-Filter maskiert entfernte APIs (P1-7, P1-8) |
| Sicherheit | 🟢 **ok** | Kein Remote-Code, keine `innerHTML`-Nutzung, CSP gesetzt, keine Secrets |
| Positiv | — | 389 Tests grün, ein Consent-Zentrum im Hintergrundskript, Host-Rechte optional, Doku-Set vorhanden, Icon-Set vollständig, `_locales` DE/EN vollständig |

**Urteil: NO-GO für die Einreichung.** Nach Behebung der neun Blocker und der Nachweise aus Phase 1–3 ist
eine Einreichung realistisch. Aufwandsschätzung im Aufgabenplan: **≈ 78 h ≈ 10 Personentage**, davon ~1 Tag
live in Thunderbird.

---

## 4. Blocker (vor Einreichung zwingend zu beheben)

### P0-1 — `data_collection_permissions` deklariert eine Pflicht-Datenerhebung, die es nicht gibt
**Belege**
- `manifest.json:14–16`: `data_collection_permissions: { "required": ["personalCommunications"] }`
- Verhalten: `background.js:64–74` (`mayTransmitExternally()` / `assertExternalAnalysisAllowed()`), Zustimmung
  Default „aus“ (Optionsseite, Persistenz über `browser.storage.local`).
- Thunderbird-API-Doku (`webextension-api.thunderbird.net/en/mv3/permissions.html`, Typ
  `CommonDataCollectionPermission`): *„Unlike Firefox, Thunderbird does not use the built-in onboarding flow
  that prompts users to opt into data collection. In Thunderbird, add-ons must request consent explicitly, for
  example by adding a checkbox on the options page or by showing a popup. The application does not provide an
  automatic prompt.“*
- Firefox-Datenkonsent-Doku: Werte in `required` muss der Nutzer akzeptieren, „they cannot opt out“;
  `optional`-Werte werden zur Laufzeit über `browser.permissions.request({ data_collection: [...] })` erteilt.
- Extension Workshop, „Firefox built-in consent for data collection and transmission“: *„From November 3,
  2025, all new extensions must adopt the Firefox built-in data collection consent system. Extensions must
  state if and what data they collect or transmit.“*
- Extension Workshop, „Best practices for collecting user data consents“: *„Incorrect classification of data
  on the data collection consent will result in a review rejection.“* — Das ist der entscheidende Satz für
  die Einstufung als Blocker.
- Gegenprobe mit dem Validator (addons-linter 10.13.0): Variante `required:["none"]` +
  `optional:["personalCommunications"]` → **0 Fehler / 26 Warnungen** (identisch zum aktuellen Stand), also
  die vom offiziellen Validator **akzeptierte** korrekte Deklaration. **Der repo-eigene Pre-Submit-Check
  verbietet sie dagegen**: `scripts/pre-submit-checks.js:127–141` bricht mit
  *„data_collection_permissions is contradictory: "none" cannot be combined with optional data types“* ab
  (selbst nachgestellt: `runChecks()` auf der Variantenkopie → 1 Fehler). Der Widerspruch ist also **kein**
  Lint-Fehler, sondern eine Policy-/Review-Frage **plus** eine eigene, zu strenge Hausregel.
- Ergänzend: der gleiche Check verlangt eine **nicht leere** `required`-Liste (`:133`), eine reine
  `optional`-Deklaration ist damit ebenfalls nicht möglich.
### P0-2 — Manuelle Upload-/Scan-Pfade ignorieren die Datenschutz-Stufe; die Doku behauptet das Gegenteil
**Belege**
- `background.js:2205–2207` (`handleManualUpload`): nur API-Key- und
  `assertExternalAnalysisAllowed()`-Check, **keine** `privacyTier`-Prüfung → in Stufe `strict` geht der
  vollständige Anhang an Hybrid Analysis (`quick-scan/file`, `background.js:2219`).
- `background.js:2157–2159` (`handleUrlScan`): gleiches Muster → in Stufe `strict`/`balanced` gehen URLs an
  Hybrid Analysis (`quick-scan/url`, `background.js:2169`). Erreichbar über Popup, Kontextmenü
  (`background.js:1815–1842`) und „Alle Links dieser Nachricht scannen“ (`background.js:1801`).
- Dagegen `docs/privacy_policy.md:109–111`, `docs/store_listing.md:61–62` und `:117`,
  `docs/reviewer_notes.md:90`: Voll-Upload und URL-Upload „nur Stufe `balanced`/`max`“.
- Die Stufenprüfung existiert nur in den automatischen Pfaden (`background.js:780`, `:1441–1442`).

**Auswirkung:** Die zentrale Datenschutz-Aussage („strikt = nur Hashes“) ist im Code falsch. Ein Reviewer,
der in `strict` den Popup-Upload testet, sieht vollständige Dateien das Gerät verlassen — genau die Klasse
„irreführende Datenübertragung“, die Policy 6.1/„No Surprises“ adressiert und im Review zu Nachfragen oder
Ablehnung führt.

**Fix-Skizze (empfohlen):** Manuellen Upload/URL-Scan an die Stufe binden: in `strict` keine Datei-/URL-
Übermittlung, sondern Hash-Abfrage plus klare UI-Meldung („in Stufe *Strikt* deaktiviert“). Alternativ, falls
das Produktverhalten bewusst so bleiben soll: Policy, Listing und Reviewer-Notes um die Ausnahme „manueller
Einzelakt aus dem Popup, unabhängig von der Stufe“ ergänzen — dann konsistent in **allen** Dokumenten und mit
Hinweis im UI.

### P0-3 — Kernfunktion (Banner-Injektion) ist in Thunderbird 140 ESR nicht belegt
**Belege**
- `docs/STATUS.md:54–58`, `docs/reviewer_notes.md:211–213`, `docs/store_assets.md:67–69` führen den Live-Test
  selbst als offenen Punkt.
- Statisch plausibel: `injectIntoMessageDisplay()` (`background.js:113–126`) nutzt
  `browser.scripting.executeScript({target:{tabId}, func, args})`; Thunderbirds eigener Browsertest
  (`browser_ext_messageDisplayScripts_mv3.js`) belegt, dass dieser Aufruf auf `mail`-Tabs funktioniert und die
  Host-Berechtigung aus `messagesRead` voraussetzt — beides ist erfüllt (`manifest.json:20–25`).
- **Nicht belegt** ist: Sichtbarkeit/Optik der Banner, Verhalten bei mehreren angezeigten Nachrichten
  (`onMessagesDisplayed` liefert eine `MessageList`), Fehlschlagverhalten (nur `Logger.warn`, danach `null`;
  `background.js:122–125`) und ob `browser.permissions.request()` aus dem Banner heraus
  (`background.js:1940–1945`, ausgelöst per `runtime.sendMessage` nach Klick) als Nutzergeste zählt.

**Auswirkung:** Das Add-on kann in der Zielumgebung „still“ seine Kernfunktion nicht anzeigen, während die
Store-Beschreibung sie bewirbt. Ohne diesen Test sind auch die Screenshots (P0-4) nicht erstellbar.

**Fix-Skizze:** Live-Testprotokoll mit Thunderbird 140 ESR, Testprofil und Testnachrichten abarbeiten
(Aufgabe A-06), Ergebnis in `docs/live_test_protocol.md` festhalten; Fehlschläge beheben — naheliegend ist die
Umstellung der Injektion auf `scripting.messageDisplay.registerScripts` (P1-9).



**Auswirkung:** Die Deklaration sagt „persönliche Kommunikation wird erhoben, Nutzer können nicht ablehnen“.
Tatsächlich findet ohne Zustimmung keine Übermittlung statt und alle lokalen Funktionen bleiben nutzbar.
Das verstößt gegen die Anforderung einer *akkuraten* Deklaration (Mozilla Add-on-Policies 6.1/6.2.1) und
widerspricht der eigenen Außendarstellung („never without your consent“, `docs/store_listing.md:22`).
Zusätzlich fehlt die Laufzeit-Anforderung (`permissions.request({data_collection})`) vollständig — der
optionale Pfad ist gar nicht deklariert.

**Fix-Skizze:** `required: ["none"]` + `optional: ["personalCommunications"]`; in `options.js` beim
Aktivieren der Konsent-Checkbox `browser.permissions.request({ data_collection: ['personalCommunications'] })`
in der Nutzergeste aufrufen (und beim Abschalten `permissions.remove(...)`); Reviewer-Notes und
Datenschutzerklärung entsprechend anpassen. **Falls** das ATN-Review `required` verlangt, ist das eine Zeile
im Manifest — die Entscheidung gehört dokumentiert (Aufgabe A-01/A-04).



### P0-4 — Keine echten Screenshots und kein vollständiges Listing-Paket
**Belege**
- `docs/screenshots/` enthält nur drei SVGs (`inline_optin_banner.svg`, `options_page.svg`,
  `warning_banner.svg`); Pre-Submit-Check meldet die Warnung *„no PNG/JPEG screenshots found in docs/“*.
- `docs/store_assets.md:31–34` und `docs/screenshot_capture.md:82–83` beschreiben den Bedarf (PNG, ≥ 1200 px
  breit, empfohlen 1280 × 800) — die offizielle Empfehlung lautet „1280x800px … 1.6:1 ratio“ und ist **kein**
  Store-Minimum (Formulierung entsprechend anpassen, P3-21).
- `docs/store_listing.md:12` und `docs/STATUS.md:61–63`: keine ATN-Listung, keine Store-URL, keine
  Releasenotes-Veröffentlichung.

**Auswirkung:** Ohne Screenshots ist das Listing unvollständig; ATN-Reviewer und Nutzer bekommen kein Bild
der Funktionen. Die Motive 2 und 3 (Banner) hängen zudem an P0-3.

**Fix-Skizze:** Nach dem Live-Test (P0-3) drei PNG-Screenshots gemäß `docs/screenshot_capture.md` aufnehmen
(Testdaten, keine echten Absender), im Repo ablegen und im Listing hochladen; Screenshot-Warnung im
Pre-Submit-Check dadurch auf „ok“ bringen.

### P0-5 — Divergente Versionslinien und fehlendes Einreichungsartefakt (Prozessblocker)
**Belege**
- `main` = `manifest.json` 1.6 / `package.json` 1.6.0; gleichzeitig existieren Tags `v1.6`, `v1.6.1`,
  `v1.7.0` … `v1.18.0` und Pre-Releases bis `v1.18.0` (`gh release list`, `gh api …/tags`).
- `gh api compare/main...v1.18.0` → `diverged`, **17 vor / 18 zurück**: die 1.18-Linie ist nicht in `main`
  enthalten; umgekehrt fehlen ihr 18 Commits aus `main`.
- „Latest“-Release im Repository ist ein Stand von **2024** (Tag `Thunderbird`,
  `Thunderbird Email Anitivirus by Hybrid Analysis`, Asset eines alten Add-ons); Version 1.6 liegt nur als
  **Pre-Release** mit `thundy-av-1.6.xpi` vor.
- Auf einem Parallel-Branch existiert bereits eine ausgearbeitete Store-Readiness-Doku-Linie
  (`docs/PROBLEMANALYSE_STORE_READINESS.md`, `docs/AUFGABENPLAN_STORE_READINESS.md`, `1.6.1`, i18n,
  Testdaten, `scripts/submission-gate.js`) — ebenfalls nicht in `main`.

**Auswirkung:** Solange nicht entschieden ist, welche Linie eingereicht wird, arbeitet das Team potenziell an
verschiedenen Artefakten; Versionen sind bei ATN nicht rücknehmbar (monotone Versionsnummer je Add-on-ID).
Ein „Latest“-Release mit 2024-Stand und Trademark-Tag `Thunderbird` ist zudem ein Marken-/Vertrauensproblem
(Policy 6 / Namenskonvention) und verwirrt Reviewer, die das verlinkte Repository prüfen.

**Fix-Skizze:** Entscheidung dokumentieren (Aufgabe A-01): Einreichungskandidat = `main` oder die 1.6.1-Linie;
alle weiteren Linien/Tags als „nicht zur Einreichung“ markieren; das alte 2024-Release entkoppeln
(`gh release edit … --latest=false`, Tag `Thunderbird` entfernen/umbenennen, Altassets als „historisch“
kennzeichnen); einen Tag + Release für den Kandidaten anlegen und das XPI dort anhängen.

### P0-6 — Das Paket-Gate ist rot: XPI enthält Entwicklerdateien
**Belege**
- `npx web-ext build --source-dir . --artifacts-dir /tmp/build` → XPI mit **19 Dateien, 180.856 Bytes**
  entpackt, darunter `test_regex_escape.js` und `test_regex_escape2.js` (Scratch-Skripte, die Regex-Escaping
  ausprobieren).
- `node scripts/verify-package.js /tmp/build` → **Exit-Code 1**, 2 ×
  *„PACKAGE CHECK FAILED: unexpected file in package“*.
- `web-ext-config.mjs:12–49` ignoriert `*.test.js`, `*_test.js`, `form_test.js`, `vt_test.js`,
  `benchmark_compare.js` — die beiden `test_regex_escape*.js` stehen nicht auf der Liste (Muster greift nur
  bei `*.test.js`/`*_test.js`).
- `docs/STATUS.md:31–34` und `docs/STORE_READINESS_ANALYSIS.md:413` behaupten dagegen „15 Dateien, ≈176 KB“
  und eine Paketprüfung in der CI.

**Auswirkung:** Das einzureichende Artefakt enthält Fremdcode (kosmetisch harmlos, aber Review- und
Vertrauensrisiko: nicht deklarierte Skripte im Paket), und das dokumentierte Gate ist faktisch rot. Ein
Reviewer, der die Quelle gegen das Paket legt, sieht Dateien ohne Laufzeitfunktion.

**Fix-Skizze:** Scratch-Dateien löschen oder nach `scripts/dev/` verschieben; Ignore-Liste um ein Muster für
Root-Skripte ergänzen (`form_test.js`, `vt_test.js`, `test_regex_escape*.js`, `benchmark_compare.js` →
sauberer: alle Entwicklungsdateien in `tools/` bündeln); Paketprüfung in die aktive CI aufnehmen; STATUS-Zahlen
auf die gemessenen Werte korrigieren.
### P0-7 — Das Popup überträgt Daten ohne die globale Zustimmung
**Belege**
- `api.js:515–548` (`fetch_hybrid_report`): direktes `fetch` auf
  `https://hybrid-analysis.com/api/v2/overview/<sha256>` mit dem API-Key des Nutzers; aufgerufen über
  `get_hybrid_report_by_sha256` (`api.js:680–682`) aus dem Popup-Rendering (`api.js:196`, `:716`, `:740`,
  `:823`).
- `externalAnalysisConsent` wird im Popup nur an drei Stellen berührt (`api.js:82`, `:83`, `:136`): Zeile 136
  hängt lediglich eine **Hinweiskarte** („Externe Analyse ist nicht aktiviert …“) in die Oberfläche, ohne den
  Codefluss zu beenden. Es gibt **kein** Guard vor dem `fetch`.
- Damit gilt die zentrale Zusage „Ohne Zustimmung wird **nichts** an Dritte übermittelt“
  (`docs/privacy_policy.md:44–49`, `README.md:44–47`) für das Popup nicht.

**Auswirkung:** Ein Nutzer ohne Zustimmung, der das Popup öffnet (bzw. eine Nachricht mit gespeichertem
Datensatz ansieht), löst eine Übermittlung von Anhang-Hashes an Hybrid Analysis aus. Das ist der klassische
Policy-Verstoß (Add-on-Policies 6.2: Übermittlung personenbezogener Daten nur mit ausdrücklicher Zustimmung)
und wäre bei einem Reviewer-Test sofort reproduzierbar. Der zentrale Code-Kommentar
(`background.js:56–61`) beschreibt dagegen korrekt, dass die Erzwingung im Hintergrundskript liegt — das
Popup ist schlicht nicht angeschlossen.

**Fix-Skizze:** Im Popup vor jedem Netzwerkzugriff dieselbe Bedingung prüfen (`externalAnalysisConsent === true`,
sonst nur Hinweiskarte + Button „Einstellungen öffnen“); API-Key-Lookup ebenfalls nur mit Zustimmung;
Test mit `fetch`-Stub, der beweist, dass im ausgeschalteten Zustand **null** Aufrufe erfolgen (Aufgabe A-09).

### P0-8 — Kontextmenü-Einträge sind ohne die Berechtigung `menus` wirkungslos
**Belege**
- `manifest.json:19–25`: `permissions: ["messagesRead", "storage", "notifications", "scripting", "downloads"]`
  — **`menus` fehlt**.
- Thunderbird-Schema `mail/components/extensions/schemas/menus.json`: `"namespace": "menus",
  "permissions": ["menus"]` (ebenso `menus_child.json`). Ohne diese Berechtigung ist `browser.menus` nicht
  verfügbar.
- Der Code bricht daher still ab: `background.js:1745`
  (`if (!browser.menus || typeof browser.menus.create !== 'function') return;`) und `background.js:1815`
  (`if (browser.menus && browser.menus.onClicked) …`).
- Betroffene, öffentlich beworbene Funktionen: „A context-menu entry scans a link with Thundy AV“
  (`README.md:34`), Prüfschritte 8.4 in `docs/reviewer_notes.md`.

**Auswirkung:** Zwei beworbene Einstiegspunkte (Link-Kontextmenü, „Alle Links dieser Nachricht scannen“)
existieren nicht. Das ist ein Funktions- und Erwartungsbruch (Listing vs. Realität) und fällt im Review
sofort auf, weil die Reviewer-Notes einen Testschritt dafür enthalten.

**Fix-Skizze:** `"menus"` in `permissions` aufnehmen, Reviewer-Notes-Begründung ergänzen, Funktion im
Live-Test belegen (A-10). Zusätzlich einen Test, der die Permission erzwingt, sobald `browser.menus` genutzt
wird (Guard gegen Rückfälle).

### P0-9 — Das Popup-Skript bricht mit `ReferenceError` ab; der Analysebereich rendert nie
**Belege**
- `npx eslint --no-config-lookup --config /tmp/eslint.audit.config.mjs --rule no-undef api.js` →
  `'syncFragment' is not defined` (`api.js:193`, `api.js:210`), `'container' is not defined` (`api.js:218`).
- `syncFragment` wird nur als Parameter weitergegeben (`api.js:735`, `:738`), nie definiert; `container` ist
  im `if (hasAttachments || hasLinks)`-Zweig nicht deklariert (die `let container`-Deklarationen liegen in
  anderen Blöcken/Funktionen, z. B. `api.js:223`).
- Die Fehler entstehen in asynchronen Handlern (`getRequest.onsuccess`) → unbehandelte Promise-Rejection; die
  Oberfläche bleibt bei „Lade Analyseergebnisse…“ stehen.
- `api.test.js` deckt das nicht ab, weil die selbstausführende Popup-Kapsel vor dem Laden entfernt wird.

**Auswirkung:** Das Popup ist der zentrale Einstieg für „manueller Upload“, „URL-Scan“, „HTML entschärfen“ und
die Ergebnisanzeige. Es funktioniert nur teilweise (Stammdaten/Buttons), der Ergebnisbereich nicht — bei
390 grünen Tests. Für ein Store-Review ist das ein sichtbarer Funktionsmangel.

**Fix-Skizze:** Fragment-/Container-Handling korrigieren (gemeinsames `container`-Element deklarieren,
`syncFragment` als echte Funktion bereitstellen oder Parameter entfernen), Regressionstest ergänzen, der
`api.js` **ohne** Entfernen der Kapsel in einer JSDOM-Umgebung ausführt (mindestens Smoke-Test).



---

## 5. Hohe Risiken (stark wahrscheinliche Reviewer-Nachfragen)

### P1-7 — Die aktive CI prüft nur einen Bruchteil dessen, was sie prüfen soll
**Belege:** `diff docs/ci/ci.yml .github/workflows/ci.yml` → aktiv laufen `npm ci`,
`node ./scripts/pre-submit-checks.js`, **`node --test background.test.js`** und `npx web-ext lint` (ohne
Filter). Die gepflegte Vollvariante (`npm test`, Lint-Filter, `web-ext build` + `verify-package.js`) liegt
ungenutzt unter `docs/ci/ci.yml`. `docs/STATUS.md:41–47` erklärt, die Vollvariante sei nur wegen fehlender
`workflows`-Berechtigung nicht committet — der aktive Workflow ist aber committet und **reduziert**.
**Auswirkung:** `api.test.js`, `db.test.js`, `options.test.js`, `api_gateway.test.js` und
`scripts/pre-submit-checks.test.js` laufen in CI nicht. Genau das Paket-Gate (P0-6) hätte die
Scratch-Dateien im XPI gefunden. Reviewer sehen in der Doku „Tests grün“, in CI ist nur ein Teil ausgeführt.
**Fix:** `docs/ci/ci.yml` nach `.github/workflows/ci.yml` übernehmen (oder aktiv erweitern) und die
Doku-Aussage korrigieren.

### P1-8 — Der Lint-Filter kann Regressionen der früheren Blockerklasse maskieren
**Belege:** `scripts/filter-lint-warnings.js:11–25` führt `KNOWN_THUNDERBIRD_FALSE_POSITIVES` als
**Substring**-Allow-Liste, darunter `'messageDisplay.getDisplayedMessage'`,
`'messageDisplay.onMessageDisplayed'` und `'messages.query'`. Die aktuelle Lint-Ausgabe enthält genau diese
26 Warnungen (u. a. 2 × `messageDisplay.getDisplayedMessage is not supported`, 2 ×
`messageDisplay.onMessageDisplayed is not supported`, 3 × `scripting.messageDisplay is not supported`).
**Auswirkung:** `messageDisplay.onMessageDisplayed`/`getDisplayedMessage` **sind** in MV3 entfernt (Schema:
`max_manifest_version: 2`). Wird so ein Aufruf versehentlich in den Produktivpfad zurückgeholt, bleibt das
Gate grün. Der Filter ist an der sensibelsten Stelle zu grob.
**Fix:** Entfernte APIs aus der Allow-Liste streichen und stattdessen per eigenem Test absichern, dass sie nur
im dokumentierten Fallback auftreten; Warnungen exakt (Code + API-Pfad) zuordnen statt per Substring;
MV2-Fallbacks entfernen (P1-10).

### P1-9 — Toter „bevorzugter“ Injektionszweig; Injektionsfehler bleiben unsichtbar
**Belege:** `background.js:117–121` bevorzugt `browser.scripting.messageDisplay.executeScript(...)`.
Thunderbirds Schema (`mail/components/extensions/schemas/scripting-tb.json`, Namespace
`scripting.messageDisplay`) enthält **nur** `getRegisteredScripts`, `registerScripts`, `unregisterScripts` —
`executeScript` existiert nicht, der Zweig ist unerreichbar. Der reale Pfad ist
`browser.scripting.executeScript` (durch TB-Tests belegt, s. §2). Wirft er, wird nur `Logger.warn` geschrieben
und `null` zurückgegeben (`background.js:122–125`).
**Auswirkung:** (a) irreführende Implementierung, die eine nicht existierende API „bevorzugt“;
(b) der dokumentierte MV3-Weg für Code in der Nachrichtenansicht ist `scripting.messageDisplay.registerScripts`
(inkl. automatischer Injektion in **neu** geöffnete Nachrichten) — der aktuelle Ansatz injiziert je Nachricht
manuell und ist damit anfälliger für Ereignis-Reihenfolgen; (c) schlägt die Injektion fehl, sieht der Nutzer
nichts.
**Fix:** Injektionen auf `scripting.messageDisplay.registerScripts` umstellen (per-Message-Daten über
`runtime.onMessage`) **oder** Fallback beibehalten und zusätzlich im Banner/Popup einen sichtbaren
Fehlerzustand anzeigen; den nicht existierenden `executeScript`-Zweig entfernen.


### P1-10 — MV2-Altpfade im Code (toter Code, der Fehler verdeckt)
**Belege:** `background.js:1736–1741` (`onMessagesDisplayed` → Fallback `onMessageDisplayed`),
`background.js:1230–1233` (`getDisplayedMessages` → Fallback `getDisplayedMessage`), `api.js:72–78` (gleiche
Konstruktion). Beide Alt-APIs existieren in MV3 nicht (Schema `messageDisplay.json`,
`max_manifest_version: 2`).
**Auswirkung:** Die Fallbacks sind in der Zielumgebung unerreichbar, suggerieren aber Kompatibilität mit MV2 /
Thunderbird < 121, obwohl `strict_min_version: 140.0` gilt. Wichtiger: `getFirstDisplayedMessage()` gibt im
Fehlerfall still `null` zurück — Aufrufer wie der Kontextmenü-Scan melden dann nur „No displayed message
found“ (`background.js:1789–1791`), statt die Ursache zu zeigen.
**Fix:** Legacy-Zweige entfernen, sobald der Live-Test (P0-3) die MV3-Pfade bestätigt hat; Fehlerpfade mit
klaren Meldungen versehen.

### P1-11 — Doku-Drift: mehrere Dokumente widersprechen Code/Manifest
**Belege (Auswahl; vollständig im Doku-Audit, Anhang §9):**
- `docs/store_listing.md:150` „localisation **not implemented yet**“ vs. `_locales/en|de` (Manifest-Strings
  und Banner sind lokalisiert, `manifest.json:6` `default_locale: en`).
- `docs/reviewer_notes.md:46` nennt als angefragte Origins `https://virustotal.com/*` **und**
  `https://*.virustotal.com/*`; `manifest.json:31` deklariert nur das Wildcard, `options.js:132` fragt exakt
  `https://www.virustotal.com/*` an. Bei Hybrid Analysis deklariert `manifest.json:29–30` bare + Wildcard,
  `options.js:131` fragt nur bare an.
- `docs/reviewer_notes.md:215` und `docs/screenshot_capture.md:5` verweisen auf `docs/screenshot-*.svg`
  (existieren nicht; `docs/store_assets.md:26–27` sagt selbst, dass sie entfernt wurden).
- `docs/store_assets.md:66` führt „Icon-Auflösungen: offen“, während dieselbe Datei die Icons als vorhanden
  listet und der Pre-Submit-Check PNG mit korrekten Kantenlängen bestätigt.
- `docs/quickstart.md:33–34` nennt eine gelöschte `content_script.test.js`.
- `docs/STATUS.md:30` / `CHANGELOG.md:34` „Icons 16/32/64“ vs. `manifest.json:54–60` (16/32/48/64/128).
**Auswirkung:** Reviewer prüfen Doku gegen Verhalten; Widersprüche kosten Vertrauen und Review-Zeit und können
als unvollständige Angaben gewertet werden.
**Fix:** Doku-Drift in einem Durchgang bereinigen (Aufgabe A-11); historische Analyse-Dokumente datieren und
als „Stand vor 1.6“ markieren.

### P1-12 — Provider-Pfade ohne Host-Recht-Vorprüfung und ein `fetch` am Gateway vorbei
**Belege:** `hasHostPermissionFor()`/`hasHybridPermission()` werden nur an zwei Stellen genutzt (Definition
`background.js:97–106`, Aufrufe `:240` und `:1483`). Die übrigen Provider-Pfade verlassen sich darauf, dass
der Nutzer das Recht beim Speichern erteilt hat: `checkAbuseIPDB` (`:337–340`), `checkVirusTotalIP`
(`:357–360`), URL-Upload (`:779–798`), `check_hybrid_analysis_for_attachment` (`:1501–1507`),
`handleUrlScan` (`:2157–2169`), `handleManualUpload` (`:2205–2219`), `checkURLhaus` (`:2302–2308`),
`checkUrlscanIo` (`:2326–2370`). Zusätzlich umgeht der Anhang-Upload in `background.js:1451`
(`await fetch(uploadOptions.url, uploadOptions)`) das zentrale `apiGateway.fetchWithTimeout()`
(`api_gateway.js:45–55`) und damit Timeout/Rate-Limit.
**Auswirkung:** Verweigert der Nutzer das Host-Recht (oder entzieht es in `about:addons`), schlagen die Pfade
mit schwer deutbaren Fehlern fehl; ohne Timeout kann ein Upload hängen bleiben. Typische Reviewer-Frage
(„was passiert ohne Berechtigung?“).
**Fix:** Host-Recht vor jedem Provider-Aufruf prüfen und in einen klaren Fehlerzustand
(`HOST_PERMISSION_MISSING`, mit UI-Hinweis) übersetzen; `fetch` durch `apiGateway.fetchWithTimeout()` ersetzen.

### P1-13 — Release-/Repo-Hygiene (Marke, Alt-Release, Branch-/PR-Lärm)
**Belege:** „Latest“-Release ist ein 2024-Stand mit Tag `Thunderbird` und Asset eines alten Add-ons
(`gh release list`; Tag-Commit `34d16a4`, 2024-06-16, Release-Name „Thunderbird Email Anitivirus by Hybrid
Analysis“). Version 1.6 existiert nur als **Pre-Release** mit `thundy-av-1.6.xpi`. Zusätzlich ~20 offene
Pull-Requests (Bot-Läufe „Bolt/Palette/Sentinel“) und 400+ Branches.
**Auswirkung:** Die Store-Listung verlinkt das Repository; ein 2024-„Latest“-Release mit Trademark-Tag
`Thunderbird` und ein XPI älteren Datums sind irreführend und ein Marken-Risiko (Namenskonvention
„… for Thunderbird“, Policy 6). Der PR-/Branch-Lärm erschwert die Reviewer-Navigation.
**Fix:** Altes Release entkoppeln (`--latest=false`), Tag `Thunderbird` umbenennen/entfernen, Asset als
historisch markieren; Kandidatenversion taggen und XPI anhängen; überholte Bot-Branches/PRs aufräumen.


### P1-14 — Der dokumentierte Signierweg würde gegen die AMO-API senden, nicht gegen ATN
**Belege**
- `docs/ci/release.yml:42–44`: `npx web-ext sign --source-dir . --artifacts-dir ./build --channel "${{ inputs.channel }}"`.
- `node_modules/web-ext/lib/program.js:19`: `export const AMO_BASE_URL = 'https://addons.mozilla.org/api/v5/'`;
  `:426–431` setzt diesen Wert als Default für `--amo-base-url` (bestätigt durch `npx web-ext sign --help`:
  *„[default: https://addons.mozilla.org/api/v5/]“*).
- Im Workflow fehlt `--amo-base-url` bzw. `WEB_EXT_AMO_BASE_URL` (`grep` auf `amo-base` in
  `docs/ci/release.yml` → kein Treffer). Ein Release-Workflow ist zudem **nicht** aktiv: im Repository
  existiert nur `.github/workflows/ci.yml`.
- Die Umgebungsvariablen `WEB_EXT_API_KEY`/`WEB_EXT_API_SECRET` sind korrekt vorgesehen; der Endpunkt ist das
  Problem.

**Auswirkung:** Ein Signierlauf mit den ATN-Schlüsseln würde die Thunderbird-Extension an die
**Mozilla-AMO-API** schicken — falscher Katalog, Ablehnung (Thunderbird-only-Manifest/ID) oder zumindest
irreführende Fehlermeldungen. Ohne aktiven Workflow wird ohnehin manuell signiert; die Anleitung muss dann
stimmen.

**Fix-Skizze:** `--amo-base-url https://addons.thunderbird.net/api/v5/` ergänzen, Workflow aktivieren,
Signierkommando in `docs/quickstart.md`/`docs/store_listing.md` dokumentieren (Aufgabe A-19).

### P1-15 — `--channel listed` läuft in den 15-Minuten-Approval-Timeout und erzeugt kein XPI
**Belege**
- `node_modules/web-ext/lib/util/submit-addon.js:59`: `approvalCheckTimeout = 900000, // 15 minutes.`
  (Default); `:224–232` bricht bei Ablauf ab (*„Approval: timeout exceeded.“*).
- Das signierte XPI wird nur bei `status === 'public'` heruntergeladen (`:215–230`).
- `docs/ci/release.yml:45–51` lädt `build/*.xpi` mit `if-no-files-found: error` hoch.

**Auswirkung:** Bei einer **listed**-Einreichung prüft ATN manuell; ein Review dauert fast immer länger als
15 Minuten. Der Signierlauf endet folglich ohne XPI, und der Upload-Schritt scheitert zusätzlich hart. Die
Einreichung selbst kann trotzdem erfolgreich gewesen sein (Version liegt im Review) — der Workflow würde das
aber als Fehler melden und das Artefakt fehlt für die Nachweisführung.

**Fix-Skizze:** Für `listed` `--approval-timeout 0` setzen (nur einreichen), Artefakt-Upload auf
`if-no-files-found: warn` stellen und den Review-Status separat verfolgen (Aufgabe A-19).


---

## 6. Mittlere und kleine Punkte

### P2-14 — Messwerte in der Doku sind veraltet (Paketgröße/-inhalt)
**Belege:** `docs/STATUS.md:31–34` und `docs/STORE_READINESS_ANALYSIS.md:413` nennen „15 Dateien, ≈176 KB“;
gemessen sind es **19 Dateien / 180.856 Bytes** (inkl. der zwei Fremddateien), bei grüner Paketprüfung wären
es 17 Dateien. `docs/status` behauptet außerdem, die Paketprüfung laufe in der CI (sie läuft dort nicht,
P1-7).
**Auswirkung:** Review-Doku wirkt ungeprüft; Zahlen dienen als Nachweis und sollten exakt sein.
**Fix:** Nach der Paketbereinigung (P0-6) Zahlen neu messen und in STATUS/Anhang aktualisieren (Aufgabe A-07).

### P2-15 — Datenschutz-Stufe gilt nur für automatische Pfade — nirgends erklärt
**Belege:** Stufenprüfung nur in `background.js:780` und `:1441–1442`; manuelle Pfade (P0-2) prüfen nicht.
`docs/privacy_policy.md:75–85` beschreibt die Stufen ohne diesen Zusatz; die Optionsseite erklärt die
Reichweite der Stufe ebenfalls nicht.
**Auswirkung:** Nutzer erwarten, dass „Strikt“ jede Übermittlung begrenzt. Nach dem Fix von P0-2 entweder
gegenstandslos (Stufe wirkt überall) oder als bewusste Ausnahme zu dokumentieren.
**Fix:** Mit P0-2 zusammen lösen; UI-Text der Optionsseite ergänzen („gilt für automatische und manuelle
Scans“).

### P2-16 — Testhygiene: der Testlauf führt Nicht-Testdateien aus
**Belege:** `npm test` entdeckt per Node-Discovery auch `form_test.js` (JSDOM-Demo mit
`runScripts: "dangerously"`, keine Assertion) und `vt_test.js` (Funktions-Skelett, keine Assertion);
beide erscheinen in der Suite-Ausgabe (`✔ form_test.js`, `✔ vt_test.js`). Die beiden
`test_regex_escape*.js` werden dagegen nicht entdeckt (sie matchen kein Testmuster), landen aber im XPI
(P0-6). `package.json:19` nutzt bewusst Discovery statt expliziter Dateiliste.
**Auswirkung:** Die Zahl „389 Tests“ ist korrekt, wird aber aus 7 Dateien gespeist, von denen zwei keine
Tests sind; Reviewer, die `npm test` laufen lassen, sehen Demo-Ausgaben.
**Fix:** Scratch-Dateien entfernen oder nach `tools/` verschieben; Test-Skript auf explizite Liste
(`node --test api.test.js api_gateway.test.js background.test.js db.test.js options.test.js scripts/pre-submit-checks.test.js`)
umstellen, damit Discovery nichts Fremdes einsammelt.

### P2-17 — Keine Testmittel für Reviewer (End-to-End-Prüfung der externen Analyse)
**Belege:** `docs/reviewer_notes.md:218–220`: kein Reviewer-Testschlüssel; der Reviewer braucht ein eigenes
kostenloses Provider-Konto. Es existieren keine Testnachrichten im Repo (`test/fixtures` enthält nur
`disarm-test.html`); die Prüfschritte 8.2/8.4 beschreiben das Vorgehen, nicht die Testdaten.
**Auswirkung:** Reviewer können den Kernnutzen (externe Analyse) nur mit eigenem Account prüfen; das erhöht
die Rückfragewahrscheinlichkeit deutlich. Zulässig, aber „reviewer-freundlich“ ist anders.
**Fix:** Testdatensatz (`testdata/*.eml` mit Anhang, Link, Absender-Mismatch, HTML-Anhang) plus dokumentierte
Erwartungen ergänzen; optional einen Demo-/Fixture-Modus, der die Provider-Antworten lokal simuliert, ohne
Netzwerkzugriff (Aufgabe A-08).

### P2-18 — Oberfläche nur Deutsch, Listing Englisch, `default_locale: en`
**Belege:** `_locales/en|de` haben identische 25 Schlüssel (Manifest-Strings + Banner); `options.html`,
`popup.html`, `theme.css`-nahe Texte sind deutsch; `docs/store_listing.md:150` behauptet fälschlich
„localisation not implemented yet“.
**Auswirkung:** Englischsprachige Reviewer/Nutzer sehen eine deutsche Optionsseite; kein Blocker, aber
Reibung. Die Aussage im Listing ist zusätzlich falsch (P1-11).
**Fix:** Listing-Text korrigieren; mittelfristig i18n der Optionsseite/Popup (`_locales` + `data-i18n`)
einplanen (Aufgabe A-12).

### P2-19 — `strict_min_version: 140.0` schließt ältere ESR-Nutzer aus
**Belege:** `manifest.json:13`; MV3 ist ab Thunderbird 128 möglich, die Daten-Deklaration wird ab
Thunderbird 140 ausgewertet (Gecko-Manifest-Schema `data_collection_permissions`, Firefox-Einführung 140).
**Auswirkung:** Bewusste Entscheidung mit Reichweitenverlust; muss im Listing begründet stehen, sonst wirkt
es wie ein Fehler.
**Fix:** Im Listing „Requires Thunderbird 140+“ begründen (MV3 + Daten-Konsent) und prüfen, ob 128 ESR
bewusst nicht unterstützt wird (Aufgabe A-13).

### P2-20 — Die Paketprüfung kann ein veraltetes ZIP prüfen und „valid“ melden
**Belege:** `scripts/verify-package.js:50–57` liest alle `*.zip` aus dem Artefaktverzeichnis und wählt
`candidates.sort().pop()` — also lexikografisch, nicht nach Version. Weder `docs/ci/ci.yml:29–33` noch
`docs/ci/release.yml:32–36` leeren `./build` vorher.
**Auswirkung:** Liegen mehrere ZIPs im Verzeichnis (z. B. `…-1.6.zip` und `…-1.10.zip`), gewinnt
lexikografisch `…-1.6.zip`; das Gate meldet dann für das **alte** Paket „Package content is valid“. Ein
falsches „grün“ direkt vor der Einreichung ist die worst-case-Variante für ein Release.
**Fix:** Artefakt nach höchster Version bzw. `mtime` wählen und/oder `build/` vor dem Build leeren
(Aufgabe A-12).

### P2-21 — Der Build ist nicht byte-reproduzierbar
**Belege:** Zwei aufeinanderfolgende `npx web-ext build` erzeugen ZIPs mit identischer Größe (48.890 Bytes)
und identischen CRC-Werten pro Eintrag, aber **wechselnder Eintragsreihenfolge** und jeweils aktueller
Zeitstempel in den Einträgen (Hash 1 ≠ Hash 2).
**Auswirkung:** Kein stabiler Artefakt-Hash für Release-Checksummen/Attestierungen; zusätzlich nutzt
`web-ext sign` einen CRC-basierten Upload-Cache (`.amo-upload-uuid`), der durch wechselnde Reihenfolge
wirkungslos wird — jeder Signierlauf lädt erneut hoch.
**Fix:** Deterministisches Archivieren (Reihenfolge/Zeitstempel fixieren, z. B. `SOURCE_DATE_EPOCH`) oder
Nicht-Reproduzierbarkeit als Restrisiko dokumentieren (Aufgabe A-15).

### P2-22 — Die Thunderbird-Berechtigung `sensitiveDataUpload` ist nicht deklariert
**Belege:** Thunderbird stellt `sensitiveDataUpload` als (optionale) Berechtigung bereit; die
TB-Beschreibung lautet *„Transfer sensitive user data (if access has been granted) to a remote server for
further processing“* (`mail/locales/en-US/messenger/extensionPermissions.ftl`). Thunderbirds eigenes
Zusatz-Add-on deklariert sie in `permissions` (`mail/extensions/builtin-addons/thundermail/extension/manifest.json`).
Das Add-on lädt Anhangsinhalte hoch (`background.js:1451`, `:2221`); `grep -rn 'sensitiveDataUpload' manifest.json *.js`
→ 0 Treffer. Eine Durchsetzung im comm-central-Code ist nicht auffindbar → **unverifiziert**, ob ATN das
Fehlen beanstandet.
**Auswirkung:** Potenzieller Review-Einwand „lädt sensible Nutzerdaten hoch, deklariert aber nicht die dafür
vorgesehene Berechtigung“. Gleichzeitig verbietet der repo-eigene Pre-Submit-Check `optional_permissions`
(`scripts/pre-submit-checks.js`), sodass die Deklaration derzeit gar nicht möglich wäre.
**Fix:** Entscheidung dokumentieren und mit ATN klären (A-04); je nach Antwort `optional_permissions` +
`permissions.request({permissions:['sensitiveDataUpload']})` nutzen und die Hausregel für diesen
Sonderfall öffnen.

### P2-23 — `permissions.request()` aus dem Banner läuft ohne Nutzergeste im Zielkontext
**Belege:** `background.js:1939–1944` (`handleRequestScan`) ruft `browser.permissions.request(...)` auf.
Aufgerufen wird es über `runtime.sendMessage` aus dem injizierten Banner (Klick) →
`onMessage`-Listener (`background.js:1994–1996`). Zwischen Klick und Request liegt damit ein
Messaging-Sprung **und** ein `await` (`hasHybridPermission()`), also kein unmittelbarer Gestenkontext.
Vergleich: `options.js:137–142` fordert die Rechte im Klick-Handler auf „Speichern“ korrekt an.
**Auswirkung:** Lehnt Thunderbird die Anfrage ab, funktioniert der beworbene Ein-Klick-Scan nicht; der
Nutzer muss die Rechte in den Optionen erteilen (Fehlerpfad ist immerhin sichtbar, `background.js:1155–1171`).
**Fix:** Berechtigung im Banner-Kontext anfordern oder den Nutzer explizit in die Optionen führen; im
Live-Test verifizieren (A-06/A-08).

### P2-24 — IP-Reputations-Cache friert „kein Treffer“-Ergebnisse aus der Zeit ohne Zustimmung ein
**Belege:** `checkAbuseIPDB`/`checkVirusTotalIP` geben ohne Zustimmung `false` zurück (`background.js:338`,
`:358`); `checkIPReputation` legt dieses `false` als endgültiges Ergebnis im Cache ab
(`background.js:875–880`), und der Cache wird bei erneutem Aufruf nur noch gelesen (`:850–857`).
**Auswirkung:** Wer die Zustimmung erst nach dem ersten Öffnen von Nachrichten erteilt, erhält für die
bereits gecachten IPs dauerhaft „nicht auffällig“ — ein stiller Falsch-Negativ-Effekt genau in der Funktion,
die der Nutzer gerade aktiviert hat.
**Fix:** `false` nicht cachen, wenn keine Zustimmung/kein Host-Recht vorlag (Sentinel oder Cache-Leerung bei
Konsent-Wechsel; `browser.storage.onChanged` ist bereits verdrahtet, `background.js:256`), Test ergänzen
(A-08).

### P3-20 — Entwickler-Scratch-Dateien im Repository-Root
**Belege:** `test_regex_escape.js`, `test_regex_escape2.js`, `form_test.js`, `vt_test.js`,
`benchmark_compare.js` liegen neben Laufzeitcode; nur drei davon stehen in der Ignore-Liste.
**Auswirkung:** Verwechslungsgefahr (Produktivcode vs. Skript), XPI-Verunreinigung (P0-6), unruhiges Repo.
**Fix:** nach `tools/` verschieben (oder löschen) und Ignore-Muster auf `tools/` umstellen.

### P3-21 — Screenshot-Größen sind Empfehlung, nicht Store-Pflicht
**Belege:** `docs/store_assets.md:31`, `docs/screenshot_capture.md:73`, `:82` formulieren „mindestens
1280 × 800 px“. Offizielle Empfehlung (Extension Workshop, „Create an appealing listing“):
*„We recommended that you capture images that are 1280x800px (the maximum image display size). For other image
sizes, we recommend using the 1.6:1 ratio.“*
**Auswirkung:** Interne Anforderung wird als externe Vorgabe dargestellt; im Zweifel werden Screenshots
unnötig neu erzeugt.
**Fix:** Als Empfehlung kennzeichnen.

### P3-22 — Listing-Metadaten (Kategorie, Autor, Support) final festlegen
**Belege:** `manifest.json:7` `author: "Jan Bludau"`; `docs/store_listing.md:143` schlägt die Kategorie
„Privacy & Security“ vor. Die ATN-Kategorien-API (`https://addons.thunderbird.net/api/v4/addons/categories/`,
abgerufen 2026-09-30) führt für `app=thunderbird&type=extension` die Kategorie **„Privacy and Security“**
(Slug `privacy-and-security`) — „Privacy & Security“ ist die Firefox-Variante. Weitere sinnvolle ATN-Optionen
wären „Miscellaneous“ oder „Message and News Reading“.
**Auswirkung:** Klein, aber die Kategorie erscheint im Listing und im Verzeichnis-Browse; ein falscher Name
führt zu Nacharbeit beim Anlegen.
**Fix:** Beim Anlegen der Listung exakt „Privacy and Security“ (oder begründet „Miscellaneous“) wählen und hier
dokumentieren (Aufgabe A-18).


---
### P3-23 — `.webextignore` ist tote Konfiguration und suggeriert eine Sicherung, die es nicht gibt
**Belege:** `grep -rq webextignore node_modules/web-ext/lib` → kein Treffer; `web-ext` liest ausschließlich
`--ignore-files` bzw. `ignoreFiles` aus der Config. Gegenprobe:
`npx web-ext build --no-config-discovery --source-dir .` erzeugt **67 Dateien** (u. a. `docs/**`,
`*.test.js`, `package.json`, Lockfiles) — alle Excludes stammen aus `web-ext-config.mjs`.
`docs/STATUS.md:31–32` formuliert dagegen „`ignoreFiles`, **ergänzt durch** `.webextignore“.
**Auswirkung:** Zwei divergierende Ignore-Quellen; die vermeintliche zweite Sicherung existiert nicht und hat
den Paketfehler P0-6 begünstigt.
**Fix:** `.webextignore` entfernen oder als „von `web-ext` nicht gelesen“ kennzeichnen und ausschließlich
`web-ext-config.mjs` pflegen (A-07/A-13).

### P3-24 — Zwei parallele Lockfiles, nur npm wird genutzt
**Belege:** `package-lock.json` (lockfileVersion 3) und `pnpm-lock.yaml` (9.0) existieren parallel mit
denselben Specifern; kein Workflow/Skript nutzt `pnpm`. `npm ci` ist konsistent (Exit 0).
**Auswirkung:** Divergenzrisiko bei Dependency-Updates (Dependabot-PRs betreffen nur eine Datei);
`pnpm-lock.yaml` wird derzeit nur aus dem Paket ausgeschlossen.
**Fix:** Datei löschen oder pnpm als alleinigen Paketmanager etablieren (A-21).



### P3-25 — Sammelbefund: kleinere Codehärtungen
**Belege (jeweils mit Zeile im Code-Audit belegt):** unerreichbarer Code nach `return` in `filterUrls()`;
tote Key-Injektion in `api_gateway.js`; Benachrichtigungen enthalten die vollständige gescannte URL
(Datenschutz-Kleinigkeit); `runtime.onMessage`-Listener ohne Absender-/Parameterprüfung; `menus.create` mit
`try/catch`, das Fehler nicht abfängt (asynchron); doppelte `MessageList`-Normalisierung in `api.js`.
**Auswirkung:** Kein Blocker, aber Review- und Wartbarkeitsrauschen; einzelne Punkte (URL in
Benachrichtigung, fehlende Absenderprüfung) berühren Datenschutz/Härtung.
**Fix:** im Rahmen von A-16 (Codebereinigung) abarbeiten, Benachrichtigungstexte ohne vollständige URL.


## 7. Positivnachweise (bereits store-tauglich — nicht „kaputt reparieren“)

1. **Manifest/MV3:** `manifest_version: 3`, gültige Keys (`message_display_action`, `options_ui.open_in_tab`,
   `background.scripts`, `icons` 16/32/48/64/128), `browser_specific_settings.gecko` mit ID und
   `strict_min_version`. `web-ext lint` liefert **0 Fehler**.
2. **Keine entfernten APIs im Produktivpfad:** `onMessagesDisplayed`/`getDisplayedMessages` sind primär
   (`background.js:1736–1737`, `:1223–1228`, `api.js:72–75`); die Altaufrufe sind reine Fallbacks (P1-10).
3. **Berechtigungsmodell:** Host-Zugriff ausschließlich über `optional_host_permissions` (7 valide Patterns,
   Pre-Submit-Check bestätigt sie); Anfrage zur Laufzeit nur für konfigurierte Anbieter in einer Nutzergeste
   (`options.js:128–146`); kein `webRequest`, kein `<all_urls>`, kein `management`.
4. **Consent-Zentrum im Hintergrundskript:** `mayTransmitExternally()` /
   `assertExternalAnalysisAllowed()` (`background.js:62–74`) ist allen **Hintergrund**-Netzwerkpfaden
   vorgeschaltet; der Fehlercode `EXTERNAL_ANALYSIS_DISABLED` wird bis in die UI transportiert. **Nicht**
   abgedeckt: das Popup-Skript (`api.js`, P0-7) — die Aussage „ohne Zustimmung wird nichts übertragen“ gilt
   daher nur für den Hintergrund, nicht für das Add-on als Ganzes.
5. **Sicherheit:** kein `eval`, kein `new Function`, keine Remote-Skripte, kein `innerHTML` im Laufzeitcode
   (DOM über `createElement`/`textContent`, vgl. `background.js:988`), strikte CSP, keine Secrets im Repo,
   HTTPS-only-Ziele, API-Keys nur in `browser.storage.local` (unverschlüsselte Ablage ist in der
   Datenschutzerklärung benannt).
6. **Qualitätssicherung vorhanden:** 389 Tests grün; `scripts/pre-submit-checks.js` mit echtem Exit-Code
   (Versionen, Icons als PNG mit Maßprüfung, Match-Patterns, Privacy-Verlinkung); `scripts/verify-package.js`
   als Paketgate (aktuell rot, P0-6); Screenshot-Guide; Quickstart.
7. **Dokumentationsbasis:** Datenschutzerklärung (mit Provider-/Datenarten-Matrix), Reviewer-Notes mit
   Permission-Begründungen und Testweg, Listing-Entwurf (EN/DE), Landing-Page mit Link zur
   Datenschutzerklärung (Pre-Submit-Check bestätigt die Verlinkung).
8. **Community-/Rechtsrahmen:** MIT-Lizenz, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CODEOWNERS vorhanden.

---

## 8. Restrisiko — in dieser Umgebung nicht prüfbar

| Punkt | Warum nicht prüfbar | Ersatzprüfung (geplant) |
|---|---|---|
| Sichtbarkeit/Funktion von Bannern, Kontextmenü, Time-of-Click in TB 140 ESR | keine Thunderbird-Installation/GUI verfügbar | manuelles Testprotokoll (A-06) |
| `permissions.request()` aus dem Banner heraus als Nutzergeste | nur im echten Klickpfad beobachtbar | Testschritt im Protokoll |
| Tatsächliche Netzwerkziele zur Laufzeit | kein Mailkonto/Provider-Key in dieser Umgebung | Netzwerk-Mitschnitt (DevTools) laut Reviewer-Notes |
| Optik der Optionsseite und des Popups | GUI nötig | Screenshot-Aufnahme (A-09) |
| ATN-Listing-Formular und finale Kategorienauswahl | ATN-HTML-Seiten liefern HTTP 403 / sind JS-gerendert (API-Endpunkte sind erreichbar und wurden für die Kategorien geprüft) | beim Anlegen der Listung manuell prüfen (A-18) |
| Ergebnis des ATN-Reviews | nicht vorhersagbar | Go/No-Go-Kriterien + vollständige Reviewer-Notes |


---

## 9. Go/No-Go-Kriterien für die Einreichung

**GO nur, wenn alle Punkte mit reproduzierbarem Nachweis erfüllt sind:**

1. `npm run pre-submit-checks` → 0 Fehler, **0 Warnungen** (Screenshot-Warnung entfällt).
2. `npm test` → 0 Fehler, und der Lauf enthält keine Nicht-Testdateien mehr (P2-16); zusätzlich ist das
   Popup-Skript durch einen Smoke-Test abgedeckt, der die Kapsel **nicht** entfernt (P0-9).
3. `npx eslint --rule no-undef` auf dem Popup-Skript (`api.js`) → 0 Fehler (Config mit Extension-Globals
   `browser`/`chrome`; die `syncFragment`/`container`-Klasse, P0-9). Für `background.js`/`options.js`/`db.js`
   muss die Prüfung die bewusst geteilten Globals der Geschwisterdateien kennen (z. B. gemeinsamer
   Projektlauf), sonst entstehen falsche Positive (`apiGateway`, `openDB`).
4. `npx web-ext lint` → 0 Fehler; der Filter nutzt eine Allow-Liste **ohne** in MV3 entfernte APIs (P1-8).
5. `npx web-ext build` + `scripts/verify-package.js` → Exit 0, nur Laufzeitdateien im Paket (P0-6), mit
   versionbasierter Artefaktwahl (P2-20); diese Kette läuft in der **aktiven** CI (P1-7).
6. `manifest.json` deklariert `data_collection_permissions` wahrheitsgemäß; Laufzeit-Consent implementiert
   (P0-1).
7. **Kein Pfad überträgt ohne Zustimmung** — nachgewiesen mit einem `fetch`-Zähler in Tests, der für
   Hintergrund **und** Popup im ausgeschalteten Zustand 0 Aufrufe zeigt (P0-7).
8. Die Datenschutz-Stufe wirkt nachweislich auf **alle** Übermittlungspfade — oder die Ausnahme ist in
   Datenschutzerklärung, Listing und Reviewer-Notes identisch beschrieben (P0-2, P2-15).
9. Live-Testprotokoll in Thunderbird 140 ESR vollständig, ohne offene Fehlschläge, **inklusive**
   Kontextmenü-Einträgen (P0-3, P0-8).
10. Drei echte PNG-Screenshots liegen im Repo und sind im Listing verankert (P0-4).
11. Einreichungskandidat festgelegt, getaggt, als XPI gebaut; Datenschutzerklärung öffentlich erreichbar und
    konsistent (P0-5, P1-13).
12. Signierweg geprüft: `--amo-base-url https://addons.thunderbird.net/api/v5/`, bei `listed`
    `--approval-timeout 0` (P1-14, P1-15).
13. Doku-Drift bereinigt: keine Aussage in README/Listing/Reviewer-Notes/Policy widerspricht dem Code (P1-11).

### 9.1 Ausführbares Gate (Kriterien C1 … C7)

`npm run store-gate` (`scripts/submission-gate.js`) prüft die Kriterien maschinell und liefert Exit-Code 0
nur bei vollständigem GO:

| ID | Kriterium | Automatisiert |
|---|---|---|
| C1 | Pre-Submit-Checks (Manifest, Daten-Deklaration, Rechte, Assets) | ja |
| C2 | vollständige Testsuite (`npm test`) | ja |
| C3 | `web-ext lint` mit kuratierter Thunderbird-Allow-Liste | ja |
| C4 | Build + Paketinhalt (`scripts/build-and-verify-package.js`) | ja |
| C5 | echte PNG-Screenshots vorhanden | ja (Artefaktprüfung) |
| C6 | Live-Test-Protokoll ausgefüllt („Summe“-Zeile, kein FAIL, ≥ 10 OK) | ja (Artefaktprüfung) |
| C7 | Release für die Version passt zum Paketinhalt: Tag existiert **und** seit dem Tag hat sich **keine paketrelevante** Datei geändert (Doku-Commits sind unschädlich) | ja (Git-Prüfung) |

Stand 2026-10-01 (Version 1.6.2): C1–C4 und C7 **PASS**, C5 und C6 **FAIL** — beides sind manuelle
Nachweise, die eine echte Thunderbird-Installation bzw. Bildschirmaufnahmen erfordern.

---

## 10. Quellen und Reproduktion

**Fremdquellen (in dieser Umgebung abgerufen):**
- Thunderbird-MV3-Konvertierungsguide: `webextension-api.thunderbird.net/en/mv3/guides/manifestV3.html`
  (entfernte APIs; `messageDisplayScripts` → `scripting.messageDisplay`; keine JS-Strings in MV3)
- Thunderbird-API-Doku `permissions` (MV3): Warnung zum fehlenden automatischen Consent-Prompt
- Thunderbird-Schemas (comm-central): `mail/components/extensions/schemas/{messageDisplay,scripting-tb,menus}.json`
- Thunderbird-Browsertest: `mail/components/extensions/test/browser/browser_ext_messageDisplayScripts_mv3.js`
  (belegt `scripting.executeScript` auf Nachrichten-Tabs und die Pflicht von `messagesRead`)
- Firefox-Extension-Workshop: „Firefox built-in consent for data collection and transmission“,
  „Best practices for collecting user data consents“, „Submitting an add-on“, „Create an appealing listing“,
  „Add-on Policies“ (Abschnitte 1, 6.1, 6.2)
- ATN-Kategorien: `https://addons.thunderbird.net/api/v4/addons/categories/` (abgerufen 2026-09-30)
- Thunderbird-Entwicklerdoku: „A Guide to Extensions“, „Supported Manifest Keys“, „What's new: Manifest V3“
- Toolchain: `web-ext` 10.7.0, `addons-linter` 10.13.0

**Reproduktion (Kurzform):**
```bash
npm ci
npm test                                  # 389 Tests / 0 Fehler
node scripts/pre-submit-checks.js          # Exit 0, 1 Warnung (Screenshots)
npx web-ext lint --source-dir . --output json > /tmp/lint.json
node scripts/filter-lint-warnings.js /tmp/lint.json
npx web-ext build --source-dir . --artifacts-dir /tmp/build
node scripts/verify-package.js /tmp/build  # -> Exit 1 (test_regex_escape*.js)

# Popup-Blocker P0-9 (no-undef mit Extension-Globals):
cat > /tmp/eslint.audit.config.mjs <<MJSCONF
import globals from '$PWD/node_modules/globals/index.js';
export default [{ files: ['**/*.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'module',
    globals: { ...globals.browser, browser: 'readonly', chrome: 'readonly' } },
  rules: { 'no-undef': 'error' } }];
MJSCONF
npx eslint --no-config-lookup --config /tmp/eslint.audit.config.mjs api.js
# -> 'syncFragment' is not defined (2x), 'container' is not defined (1x)

# Daten-Deklaration gegenprüfen:
git archive HEAD | tar -x -C /tmp/dc_v1
# /tmp/dc_v1/manifest.json -> data_collection_permissions:
#   { "required": ["none"], "optional": ["personalCommunications"] }
npx web-ext lint --source-dir /tmp/dc_v1   # 0 Fehler / 26 Warnungen
```

---

## 11. Anhang — unabhängige Auditberichte dieser Prüfung

| Bericht | Inhalt | Hauptbezug |
|---|---|---|
| `docs/audits/code-audit.md` | Code-Audit: MV3-APIs, Consent-Erzwingung, Permission-Flüsse, Sicherheit, toter Code | P0-7, P0-8, P0-9, P1-8, P1-9, P1-10, P1-12 |
| `docs/audits/docs-audit.md` | Doku-/Policy-Audit: Datenfluss-Tabellen gegen Code, Provider-/Origin-Abgleich, Listing-Anforderungen, Doku-Widersprüche | P0-2, P1-11, P1-12, P2-14, P2-18 |
| `docs/audits/pipeline-audit.md` | Build-/Paket-/CI-/Release-Audit: XPI-Inhalt, Gates, Signierfähigkeit, Versionskonsistenz | P0-5, P0-6, P1-7, P1-13, P1-14, P1-15, P2-20, P2-21, P3-23, P3-24 |

Die Berichte sind Rohbelege der drei unabhängigen Auditläufe (jeweils mit eigenen Kommando- und
Datei:Zeile-Nachweisen). Maßgeblich für die Befundliste sind die in §4–§6 zitierten Stellen; sie wurden beim
Zusammenführen **einzeln gegen die Messwerte aus §2 nachgeprüft** (u. a. `eslint no-undef`, XPI-Inhalt,
Manifest-/Schema-Abgleich, `web-ext`-Defaults).


