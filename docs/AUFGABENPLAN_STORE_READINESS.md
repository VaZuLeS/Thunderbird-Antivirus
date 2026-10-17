# Aufgabenplan Store-Readiness — „Thundy AV“ (Thunderbird Add-ons Store / ATN)

**Bezug:** [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) (Befunde P0-1 … P3-25)
**Snapshot:** Branch `cline/k0d34w90`, Basis `4c4898c`, Add-on-Version 1.6
**Ziel:** Vollständige, überprüfbare Freigabe („GO“) und Einreichung bei addons.thunderbird.net (ATN)
**Stand:** 2026-09-30

---

## 1. Vorgehen und Legende

Der Plan ist in vier Phasen gegliedert und strikt befunde-zu-aufgaben-rückverfolgbar (Matrix in §2).
Er ist so geschnitten, dass nach **jeder** Aufgabe ein reproduzierbarer Nachweis existiert — Zahlen in
Dokumenten werden nicht „geschätzt“, sondern gemessen.

| Kürzel | Bedeutung |
|---|---|
| **P0/P1/P2/P3** | Schweregrad des Bezugs-Befunds (Blocker / hoch / mittel / niedrig) |
| **Aufwand** | grobe Schätzung in Stunden (1 Personentag ≈ 8 h) |
| **DoD** | Definition of Done: der Nachweis, der als erledigt gilt |
| **✋** | Aufgabe benötigt eine Umgebung, die in der Sandbox nicht existiert (Thunderbird-GUI, ATN-Konto) |

**Rollen:** *Entwicklung* (Code/Manifest/Paket), *Doku* (Policy/Listing/Reviewer-Notes), *QS* (Gates,
Live-Test), *Release* (Tag/Signatur/Upload). Bei einer Einzelperson sind das Zeitfenster, keine Personen.

---

## 2. Traceability-Matrix (Befund → Aufgabe)

| Befund | Kurztitel | Aufgaben |
|---|---|---|
| P0-1 | Daten-Deklaration ≠ Verhalten | A-02, A-04 |
| P0-2 | Manuelle Pfade umgehen die Datenschutz-Stufe | A-05 |
| P0-3 | Kernfunktion nicht live belegt | A-03, A-06 |
| P0-4 | Keine echten Screenshots / kein Listing | A-11, A-18 |
| P0-5 | Divergente Versionslinien, kein Artefakt | A-01, A-15 |
| P0-6 | XPI enthält Fremddateien, Paketgate rot | A-07 |
| P0-7 | Popup überträgt ohne globale Zustimmung | A-09 |
| P0-8 | Kontextmenüs tot: `menus`-Berechtigung fehlt | A-10 |
| P0-9 | Popup-Bootstrap defekt (`syncFragment`/`container` undefiniert) | A-09 |
| P1-7 | Aktive CI prüft nur 243 von 389 Tests | A-12 |
| P1-8 | Lint-Filter/Gate wirkungslos bzw. zu grob | A-12 |
| P1-9 | Toter Injektionszweig, stille Fehler | A-06, A-08, A-16 |
| P1-10 | MV2-Altpfade im Code | A-16 |
| P1-11 | Doku-Drift (Listing, Notes, Assets) | A-13 |
| P1-12 | Fehlende Host-Recht-Prüfung, `fetch` am Gateway vorbei | A-08 |
| P1-13 | Release-/Repo-Hygiene (Marke, Alt-Release) | A-15, A-21 |
| P1-14 | Signieraufruf zielt auf AMO statt ATN | A-19 |
| P1-15 | `--channel listed` läuft in den 15-min-Approval-Timeout | A-19 |
| P2-14 | Messwerte veraltet (Dateizahl, Testumfang) | A-07, A-13 |
| P2-15 | Stufen-Semantik nicht erklärt | A-05 |
| P2-16 | Testlauf führt Nicht-Tests aus | A-07 |
| P2-17 | Keine Testmittel für Reviewer | A-03, A-14 |
| P2-18 | UI nur Deutsch | A-13, A-21 |
| P2-19 | `strict_min_version` 140.0 begründen | A-13 |
| P2-20 | Paketprüfung wählt Artefakt lexikografisch | A-12, A-15 |
| P2-21 | Build nicht byte-reproduzierbar | A-15 |
| P2-22 | `sensitiveDataUpload` nicht deklariert | A-04 |
| P2-23 | Permission-Request aus dem Banner ohne Gestenkontext | A-06, A-08 |
| P2-24 | IP-Reputations-Cache friert „ohne Zustimmung“-Ergebnisse ein | A-08 |
| P3-20 | Scratch-Dateien im Root | A-07 |
| P3-21 | Screenshot-Größe als Pflicht dargestellt | A-13 |
| P3-22 | Listing-Metadaten final festlegen | A-18 |
| P3-23 | `.webextignore` wird von `web-ext` nicht gelesen | A-07, A-13 |
| P3-24 | Zwei parallele Lockfiles, nur npm genutzt | A-21 |
| P3-25 | Kleinere Codehärtungen (toter Code, URL in Benachrichtigung, Absenderprüfung) | A-16, A-21 |

---

## 3. Phase 0 — Entscheidungen und Vorbereitung (Ziel: 1 Tag)

| ID | Aufgabe | Bezug | DoD (Nachweis) | Aufwand | Abhängig von |
|---|---|---|---|---|---|
| **A-01** ✋ | **Einreichungskandidat festlegen:** entscheiden, ob Version **1.6 (`main`)** oder die divergierte Linie (bis `v1.18.0`, Branch `cline/573mahd6`) eingereicht wird; danach alle anderen Linien als „nicht zur Einreichung“ markieren, Versionsnummer festziehen (ATN-Versionen sind nicht rücknehmbar) | P0-5 | Entscheidung im Repo dokumentiert (`docs/STATUS.md` + Analyse-Anhang), genau eine Kandidatenlinie, Versionsnummer im Manifest festgelegt | 3 h | — |
| **A-02** | **Consent-/Deklarationsmodell entscheiden:** Option A „`required: ["none"]` + `optional: ["personalCommunications"]` + Runtime-`permissions.request({data_collection})`“ (Empfehlung) vs. Option B „`required` beibehalten und im Review begründen“ | P0-1 | Entscheidungsnotiz mit Begründung, TB-Doku-Zitat und Validator-Gegenprobe | 2 h | — |
| **A-03** ✋ | **Testumgebung aufsetzen:** Thunderbird 140 ESR + separates Testprofil, Testpostfach mit Testnachrichten (harmloser Anhang, HTML-Anhang, Link/Urgency, Absender-Mismatch), Provider-Testkonto | P0-3, P2-17 | Profil + Testdaten vorhanden, Ladeanleitung (`docs/quickstart.md`) verifiziert, Testdaten versioniert | 4 h | A-01 |

**Hinweis A-01:** Die Entscheidung wirkt auf **alle** weiteren Aufgaben (Codebasis, Doku, Screenshots,
Versionsnummer). Sie ist deshalb die erste Aufgabe und blockiert Phase 1.

---

## 4. Phase 1 — Blocker auflösen (Ziel: 3 Tage)

| ID | Aufgabe | Bezug | DoD (Nachweis) | Aufwand | Abhängig von |
|---|---|---|---|---|---|
| **A-04** | **Daten-Deklaration korrigieren** (Umsetzung von A-02, Option A): Manifest auf `required: ["none"]`, `optional: ["personalCommunications"]`; die zu strenge Hausregel in `scripts/pre-submit-checks.js:127–141` an das Validator-Verhalten angleichen (der offizielle Linter akzeptiert die Kombination, der eigene Check lehnt sie ab); in `options.js` beim Einschalten der Konsent-Checkbox `browser.permissions.request({ data_collection: ['personalCommunications'] })` in der Nutzergeste, beim Abschalten `permissions.remove(...)`; Fallback ohne `data_collection`-Support unverändert lassen; **zusätzlich entscheiden**, ob die Thunderbird-Berechtigung `sensitiveDataUpload` (P2-22) deklariert und angefragt wird | P0-1, P2-22 | `manifest.json` geändert; Unit-Test für den Request-/Remove-Pfad; `web-ext lint` unverändert 0 Fehler; `pre-submit-checks` grün; Reviewer-Notes + Datenschutzerklärung angepasst; Entscheidung zu `sensitiveDataUpload` dokumentiert | 5 h | A-02 |
| **A-05** | **Datenschutz-Stufe auf alle Pfade anwenden:** `handleManualUpload` und `handleUrlScan` prüfen `privacyTier`; in `strict` keine Datei-/URL-Übermittlung, stattdessen klare UI-Meldung; Optionsseiten-Text ergänzen („die Stufe gilt für automatische und manuelle Scans“) | P0-2, P2-15 | Tests für `strict`/`balanced`/`max` in beiden Pfaden (Mock: kein `fetch` in `strict`); Datenschutzerklärung §3.3/§5, Store-Listing und Reviewer-Notes identisch | 5 h | A-01 |
| **A-06** ✋ | **Live-Testprotokoll in Thunderbird 140 ESR:** Nachricht mit Anhang/Banner, beide Banner-Buttons, Threat-Banner, Kontextmenü „Link scannen“ + „Alle Links dieser Nachricht scannen“, Time-of-Click-Hinweis, `permissions.request()` aus dem Banner, Nachricht ohne/vorhandenes Sender-Opt-in, Entzug der Host-Berechtigung, Verhalten bei mehreren angezeigten Nachrichten (`MessageList`) | P0-3, P1-9 | Protokoll `docs/live_test_protocol.md` vollständig ausgefüllt (Erwartung/Ist/Thunderbird-Version/Screenshot), keine offenen Fehlschläge; gefundene Fehler als Tasks erfasst | 8 h | A-03, A-04 |
| **A-07** | **Paket bereinigen und Gate grün machen:** Scratch-Dateien (`test_regex_escape*.js`, `form_test.js`, `vt_test.js`, `benchmark_compare.js`) löschen oder nach `tools/` verschieben; Ignore-/Paketlisten nachziehen; Testskript auf explizite Dateiliste umstellen; STATUS-Zahlen neu messen | P0-6, P2-14, P2-16, P3-20 | `verify-package.js` Exit 0; XPI enthält nur Laufzeitdateien; `npm test` führt keine Nicht-Tests mehr aus; Zahlen in STATUS/Analyse aktualisiert | 3 h | — |
| **A-08** | **Fehler-, Berechtigungs- und Cache-Zustände korrekt machen:** Host-Recht vor jedem Provider-Aufruf prüfen (`HOST_PERMISSION_MISSING` mit UI-Hinweis statt kryptischem Fehler); `background.js:1451` auf `apiGateway.fetchWithTimeout()` umstellen; Injektionsfehler dem Nutzer anzeigen (statt nur `Logger.warn`); IP-Reputations-Cache darf „kein Treffer ohne Zustimmung/ohne Recht“ **nicht** dauerhaft speichern (P2-24); Berechtigungsanfrage aus dem Banner (P2-23) so umbauen, dass sie entweder im Gestenkontext läuft oder den Nutzer sichtbar in die Optionen führt | P1-12, P1-9, P2-23, P2-24 | Tests für „Recht fehlt“, für Cache-Verhalten nach nachträglicher Zustimmung und für den Banner-Permission-Pfad; kein rohes `fetch` mehr im Laufzeitcode; Fehlerpfad im Banner/Popup sichtbar | 5 h | A-06 |
| **A-09** | **Popup reparieren und an den Konsent binden:** (a) Popup-Bootstrap-Fehler beheben — `syncFragment` (`api.js:193`, `:210`) und `container` (`api.js:218`) sind undefiniert und werfen `ReferenceError`, dadurch rendert der Analysebereich nie (empirisch mit `eslint` `no-undef` belegt); (b) `fetch_hybrid_report()` (`api.js:515–548`) hinter dieselbe Prüfung stellen wie den Hintergrund (`externalAnalysisConsent` bzw. `assertExternalAnalysisAllowed`-Äquivalent) — die Notizkarte in `api.js:136` verhindert die Übertragung **nicht** | P0-9, P0-7 | `eslint --rule no-undef` auf `api.js` ohne Fehler; Test, der beweist, dass ohne Zustimmung **kein** `fetch` ausgeführt wird (fetch-Stub zählt Aufrufe); Popup zeigt im Konsent-Neins-Fall nur die Notiz | 4 h | A-01 |
| **A-10** | **`menus`-Berechtigung ergänzen und Kontextmenü verifizieren:** `manifest.json:19–25` enthält `menus` nicht; das Thunderbird-Schema deklariert für den Namespace `menus` die Permission `menus`, daher sind `browser.menus.create` (`background.js:1745`) und `browser.menus.onClicked` (`:1815`) ohne sie nicht verfügbar — beide Einträge sind still tot. Permission ergänzen, Reviewer-Notes-Begründung nachziehen, Funktion im Live-Test prüfen | P0-8 | Kontextmenü erscheint im Live-Test (Screenshot/Notiz), Permission in `manifest.json` + Reviewer-Notes begründet; Regressionstest, der die Permission bei `menus`-Nutzung erzwingt | 3 h | A-03 |


---

## 5. Phase 2 — Review-Festigkeit und Release-Prozess (Ziel: 2 Tage)

| ID | Aufgabe | Bezug | DoD (Nachweis) | Aufwand | Abhängig von |
|---|---|---|---|---|---|
| **A-11** ✋ | **Screenshots aufnehmen** (Optionsseite mit Konsent-Schalter, Opt-in-Banner mit beiden Buttons, Threat-Banner) als PNG ≥ 1200 px breit, mit Testdaten; im Repo ablegen und im Listing verankern | P0-4 | drei PNGs in `docs/screenshots/`; Pre-Submit-Check meldet **keine** Screenshot-Warnung mehr; Motive stimmen mit dem Live-Test überein | 4 h | A-06 |
| **A-12** | **CI-Gate scharf schalten:** `docs/ci/ci.yml` aktivieren (bzw. `.github/workflows/ci.yml` erweitern): `npm test` statt nur `background.test.js` (= 243 von 389 Tests, 37 % fehlen), `web-ext lint --output json` + Filter, `web-ext build` + `verify-package.js`; Filter-Allow-Liste auf exakte Codes/Pfade umstellen und die in MV3 entfernten APIs herausnehmen; Artefaktwahl in `verify-package.js` nach Version/`mtime` statt lexikografisch | P1-7, P1-8, P2-20 | CI-Lauf zeigt alle Testdateien, Lint-Filter, Build + Paketprüfung; absichtlich eingebaute Regression (z. B. `onMessageDisplayed` im Produktivpfad) lässt den Job **rot** werden | 4 h | A-07 |
| **A-13** | **Doku-Drift bereinigen:** Listing-Aussage zur Lokalisierung, Reviewer-Notes-Origins (VirusTotal/Hybrid Analysis), Verweise auf gelöschte `docs/screenshot-*.svg`, widersprüchlicher Icon-Status, `quickstart`-Dateiliste, Icon-Größen in STATUS/CHANGELOG, Messwerte (Dateizahl/Testumfang), Screenshot-Größen als Empfehlung kennzeichnen, `strict_min_version` begründen, `.webextignore` als von `web-ext` **nicht** gelesen kennzeichnen oder entfernen | P1-11, P2-14, P2-18, P2-19, P3-21, P3-23 | `grep`-Gegenprobe: keine Doku-Aussage widerspricht Code/Manifest; Reviewer-Notes nennen exakt die in `options.js` angefragten Origins | 5 h | A-04, A-07 |
| **A-14** ✋ | **Reviewer-Testmittel bereitstellen:** Testdatensatz (`testdata/*.eml`: harmloser Anhang, HTML-Anhang, Link mit Dringlichkeit, Absender-Mismatch) mit dokumentierter Erwartung je Datei; optional Demo-/Fixture-Modus, der Provider-Antworten lokal simuliert (kein Netzwerk) | P2-17 | Testdaten im Repo + Abschnitt in den Reviewer-Notes, der pro Datei das erwartete Ergebnis nennt | 4 h | A-03 |
| **A-15** | **Release-/Repo-Hygiene und Artefakt:** altes „Latest“-Release (2024) entkoppeln, Tag `Thunderbird` umbenennen/entfernen, Altassets als historisch markieren; Kandidatenversion taggen, XPI bauen und anhängen; Build möglichst deterministisch machen (fixierte Reihenfolge/Timestamps) und Hash dokumentieren; Versionskonsistenz manifest/package/CHANGELOG prüfen | P1-13, P0-5, P2-21 | `gh release view <kandidat>` zeigt XPI + Version; `gh release list` zeigt kein 2024-Release mehr als „Latest“; zwei Builds erzeugen denselben Hash (oder Abweichung ist dokumentiert) | 4 h | A-01, A-07 |
| **A-16** | **MV2-Altpfade und Injektionsweg bereinigen (plus Codehärtung):** Legacy-Fallbacks (`onMessageDisplayed`, `getDisplayedMessage` in `background.js` und `api.js`) entfernen; nicht existierenden `scripting.messageDisplay.executeScript`-Zweig streichen; Injektion auf `scripting.messageDisplay.registerScripts` umstellen, falls der Live-Test Probleme zeigt (per-Message-Daten via `runtime.onMessage`); Sammelbefund P3-25 abarbeiten (toter Code, URL in Benachrichtigungen kürzen, Absender-/Parameterprüfung im `onMessage`-Listener) | P1-9, P1-10, P3-25 | Code enthält keine MV3-entfernten APIs mehr; `web-ext lint` ohne diese Warnungen; Banner-Funktion nach Umstellung erneut im Live-Test bestätigt | 6 h | A-06 |

---

## 6. Phase 3 — Freigabe und Einreichung (Ziel: 1 Tag)

| ID | Aufgabe | Bezug | DoD (Nachweis) | Aufwand | Abhängig von |
|---|---|---|---|---|---|
| **A-17** | **Go/No-Go-Gate ausführen:** die zehn Kriterien aus §9 der Problemanalyse als Skript/Befehlsfolge abarbeiten und Ergebnis protokollieren (ersetzt „gefühltes“ Freigeben) | P0-1 … P3-24 | Protokoll mit Kriterium → Nachweis → Status; jedes „GO“ ist mit Kommandoausgabe belegt | 2 h | alle Blocker |
| **A-18** ✋ | **ATN-Listung anlegen und ausfüllen:** Entwicklerkonto, Listing (Titel „Thundy AV – Email Scanner for Thunderbird“, Summary ≤ 250 Zeichen, Beschreibung EN/DE), Kategorie final wählen, Lizenz GNU GPL v3 (`GPL-3.0-only`), Support-Mail, Homepage, **Privacy-Policy-URL**, Screenshots, Releasenotes 1.6/1.6.x | P0-4, P3-22 | Listung im ATN-Entwurf vollständig; alle Pflichtfelder gefüllt; Kategorie dokumentiert | 4 h | A-11, A-13 |
| **A-19** | **Signieren mit korrektem Endpoint:** `web-ext sign` gegen **`--amo-base-url https://addons.thunderbird.net/api/v5/`** (Default ist die AMO-API — eine Thunderbird-only-Extension würde dort abgelehnt), für `--channel listed` zusätzlich `--approval-timeout 0` (Default 15 min < Review-Dauer ⇒ sonst kein XPI-Artefakt); Release-Workflow unter `.github/workflows/release.yml` aktivieren, Artefakt-Upload auf `if-no-files-found: warn`, Secrets für ATN-API-Key/-Secret | P1-14, P1-15 | `gh workflow run release.yml` erzeugt einen Signatur-/Einreichungslauf gegen ATN; Ergebnis (Version, Status „awaiting review“) ist dokumentiert | 3 h | A-17, A-18 |

---

## 7. Phase 4 — Nach der Einreichung (laufend)

| ID | Aufgabe | Bezug | DoD (Nachweis) | Aufwand | Abhängig von |
|---|---|---|---|---|---|
| **A-20** | **Review-Betreuung und Statuspflege:** Reviewer-Rückfragen beantworten (Antwortvorlagen in den Notes vorbereiten), `docs/STATUS.md` auf den echten Stand bringen, Store-URL nach Freigabe überall ergänzen (README, Listing, Landing-Page) | alle | Store-URL in README/Listing/Landing-Page; STATUS nennt Listungsdatum und Version | fortlaufend (2 h/Woche) | A-19 |
| **A-21** | **Prozesspflege:** verbleibende Hygiene — `pnpm-lock.yaml` entfernen oder pnpm als alleinigen Paketmanager etablieren, abgeschlossene Bot-Branches/PRs aufräumen, i18n der Optionsseite/Popup einplanen, Release-Workflow für Folgeversionen automatisieren | P2-18, P1-13, P3-24 | genau ein Lockfile und ein dokumentierter Paketmanager; offene PRs < 10; i18n als Issue mit Aufwand erfasst | 4 h | A-19 |


---

## 8. Risikoregister

| Nr. | Risiko | Wkt. | Wirkung | Gegenmaßnahme / Trigger |
|---|---|---|---|---|
| R1 | Einreichung wird wegen irreführender Daten-/Consent-Angaben abgelehnt | mittel | hoch | P0-1/P0-2 vorher beheben; Deklaration + Policy + Listing identisch halten (A-04, A-05, A-13) |
| R2 | Kernfunktion (Banner) funktioniert in TB 140 ESR nicht, obwohl der Review sie freigibt | mittel | hoch | Live-Test **vor** der Einreichung (A-06); Fallback auf `registerScripts` vorbereitet (A-16) |
| R3 | Reviewer findet die stille Popup-/Kontextmenü-Defekte | hoch (wenn ungefixt) | hoch | A-09, A-10 beheben; beides im Testprotokoll nachweisen |
| R4 | Falsche Versionslinie wird eingereicht; ATN-Version ist irreversibel | mittel | hoch | A-01 (Entscheidung dokumentieren), A-15 (Tag/Artefakt) |
| R5 | Review-Zeit > 15 min ⇒ Signier-Job liefert kein XPI | hoch | mittel | `--approval-timeout 0` + Upload tolerant (A-19) |
| R6 | Freigabe „listed“ verzögert sich (Rückfragen) | mittel | mittel | vollständige Notes/Testmittel (A-14), Antwortvorlagen (A-20) |
| R7 | Regression nach der Freigabe durch fehlende Gates | mittel | mittel | CI-Gate scharf schalten (A-12), Filter ohne Suppression |
| R8 | Sandbox/GUI fehlt für A-03, A-06, A-11, A-14, A-18 | sicher in dieser Umgebung | mittel | als ✋-Aufgaben ausgewiesen, Nachweise ausschließlich auf echter Umgebung |

---

## 9. Arbeitsweise und Definition of Done

**Arbeitsweise**
1. Jede Aufgabe endet mit einem Repo-Nachweis (Kommando-Ausgabe, Test, Protokoll, Screenshot) statt mit einer
   Aussage. Zahlen in Dokumenten werden gemessen, nicht geschätzt.
2. Analyse-Dokumente werden **nicht** rückwirkend „als behoben“ markiert; behobene Befunde werden mit Datum
   und Nachweis ergänzt (denn genau diese Praxis hat in der Vergangenheit zu Doku-Drift geführt, P1-11).
3. Manifest-, Consent- und Policy-Änderungen werden immer gemeinsam mit Datenschutzerklärung,
   Store-Listing und Reviewer-Notes angepasst (vier Dateien = ein Commit).
4. Vor jedem Release: Go/No-Go-Gate (A-17) ausführen.

**Definition of Done (allgemein)**
- Änderung ist implementiert, getestet (`npm test`), lintfrei (`web-ext lint`) und im Paket korrekt
  (`verify-package.js`).
- Zu jeder Änderung existiert der Nachweis in einem Dokument oder Test, der im Review überprüfbar ist.
- Doku (README/STATUS/Listing/Policy/Reviewer-Notes) ist widerspruchsfrei aktualisiert.
- Befund-ID aus der Problemanalyse ist im Commit/PR referenziert.

---

## 10. Zeitplan (Summen)

| Phase | Inhalt | Aufwand | Kalender (1 Person) |
|---|---|---|---|
| 0 | Entscheidungen, Testumgebung | 9 h | Tag 1 |
| 1 | Blocker auflösen | 33 h | Tage 2–6 |
| 2 | Review-Festigkeit, Release | 27 h | Tage 7–9 |
| 3 | Freigabe, Einreichung | 9 h | Tag 10 |
| 4 | laufend | fortlaufend | ab Freigabe |
| **Summe** | | **≈ 78 h** | **≈ 10 Personentage** |

Parallelisierbar: A-07/A-08 (Code) neben A-04/A-05 (Consent/Policy) und A-12 (CI). Nicht parallelisierbar:
A-06 (Live-Test) blockiert A-11 (Screenshots) und A-16 (Injektionsumbau).

**Sofort startbar (erste drei Schritte):**
1. A-01 — Einreichungskandidat festlegen (entscheidet über die Codebasis aller weiteren Aufgaben).
2. A-02 + A-04 — Consent-/Deklarationsmodell entscheiden und umsetzen (kleinster Aufwand mit größter
   Review-Wirkung).
3. A-03 → A-06 — Testumgebung aufsetzen und Live-Test durchführen (liefert die Basis für Screenshots und
   die Antwort auf die Kernfrage „funktioniert es in Thunderbird?“).



---

## 11. Ausführungsstand (Arbeitslauf 2026-10-01)

Der Plan wurde in diesem Arbeitslauf abgearbeitet, soweit es diese Umgebung zulässt. Jede
Statusangabe nennt den Nachweis; „✋ offen“ bedeutet: Aufgabe ist vorbereitet, benötigt aber
Thunderbird-GUI, Screenshots oder ein ATN-Konto.

| ID | Aufgabe | Status | Nachweis |
|---|---|---|---|
| A-01 | Einreichungskandidat festlegen | **erledigt** | D1 in [decisions.md](decisions.md); dieser Branch, Version 1.6 |
| A-02 | Consent-/Deklarationsmodell entscheiden | **erledigt** | D2 in [decisions.md](decisions.md) mit Quellenzitaten und Validator-Gegenprobe |
| A-03 | Testumgebung/Testdaten aufsetzen | **teilweise ✋** | `testdata/` mit 5 validierten `.eml` + Erwartungen; TB-140-ESR-Installation fehlt hier |
| A-04 | Daten-Deklaration korrigieren | **erledigt** | `manifest.json`, `options.js` (`permissions.request({data_collection})`), Pre-Submit-Check, Tests |
| A-05 | Datenschutz-Stufe auf alle Pfade | **erledigt** | Tier-Gates in `background.js`, Policy/Listing/Notes, Tests |
| A-06 | Live-Test TB 140 ESR | **✋ offen (manuell)** | Protokoll vollständig vorbereitet: `docs/live_test_protocol.md` |
| A-07 | Paket bereinigen, Gate grün | **erledigt** | `npm run package` → 17 Dateien, 196.505 B, „valid“; `tools/*.dev.js` |
| A-08 | Fehler-/Rechtepfade sichtbar | **erledigt** | `requireHostPermission`, Banner-Hinweis + Options-Button, Cache-Fix, Tests |
| A-09 | Popup reparieren + Konsent binden | **erledigt** | `api.js`, `test/consent-and-tier.test.js`, `api.test.js` (P0-7/P0-9-Regressionstests) |
| A-10 | `menus`-Permission + Kontextmenü | **erledigt (Live-Test offen)** | `manifest.json`, Pre-Submit-Check, Invariantentest |
| A-11 | Screenshots aufnehmen | **✋ offen (manuell)** | Gate-Kriterium C5 → `NO-GO` |
| A-12 | CI-Gate scharf schalten | **erledigt (Spiegel)** | `docs/ci/ci.yml`; Push unter `.github/workflows/` vom Token abgelehnt (reproduziert) |
| A-13 | Doku-Drift bereinigen | **erledigt** | Privacy-Policy, Listing, Reviewer-Notes, READMEs, Quickstart, Assets, Index |
| A-14 | Reviewer-Testmittel | **erledigt** | `testdata/*.eml` + `testdata/README.md` mit Erwartung je Stufe |
| A-15 | Release-/Repo-Hygiene, Artefakt | **teilweise** | 2024-Release nicht mehr „Latest“; XPI gebaut; Tag auf dem Commit offen (C7) |
| A-16 | MV2-Altpfade/Injektion bereinigen | **erledigt** | Code bereinigt, Fehler sichtbar, Pre-Submit-Check als Rückfallschutz |
| A-17 | Go/No-Go-Gate | **erledigt** | `npm run store-gate` (C1–C7 mit Nachweis, Exit-Code) + `scripts/submission-gate.test.js` |
| A-18 | ATN-Listung anlegen | **✋ offen (manuell)** | Listing-Felder final in `docs/store_listing.md` inkl. Kategorie „Privacy and Security“ |
| A-19 | Signieren mit korrektem Endpunkt | **erledigt (Spiegel)** | `docs/ci/release.yml` mit `--amo-base-url` + `--approval-timeout` |
| A-20 | Review-Betreuung/Statuspflege | **laufend** | `docs/STATUS.md` auf dem aktuellen Stand; Antwortvorlagen in den Reviewer-Notes |
| A-21 | Prozesspflege | **teilweise** | `pnpm-lock.yaml` entfernt, Dev-Skripte unter `tools/`, i18n der Oberfläche: offen |

**Verifikation dieses Laufs**

```bash
npm run pre-submit-checks   # 0 Fehler, 1 Warnung (Screenshots)      -> Exit 0
npm test                    # 427 Tests, 0 Fehler                     -> Exit 0
npm run lint:filtered       # 0 Fehler, 19 kuratierte Warnungen       -> Exit 0
npm run package            # 17 Dateien, 196.505 B, „valid“          -> Exit 0
npm run store-gate         # NO-GO: C1–C4 PASS, C5/C6/C7 offen        -> Exit 1
```

**Nächste drei Schritte** (nach wie vor offen): Screenshots (A-11), Live-Test in Thunderbird 140 ESR
(A-06), Release-Tag auf dem eingereichten Commit (A-15) — danach `npm run store-gate` erneut ausführen
und bei `GO` signieren und einreichen (A-18/A-19).


---

## 12. Runde 2 — Veröffentlichung der Version 1.6.2

Neue Befunde **R-1 … R-6** und die zugehörigen Aufgaben (Bezug: §0.2 der Problemanalyse). Ziel dieser
Runde: eine neue, eindeutig einem Commit zuordenbare Version veröffentlichen und die Store-Reife-Kriterien
so weit bringen, wie es ohne echte Thunderbird-Instanz geht.

| ID | Aufgabe | Bezug | DoD (Nachweis) | Aufwand | Abhängig von |
|---|---|---|---|---|---|
| **R-01** | **Versionsentscheidung und Bump:** ATN auf bestehende Versionen prüfen (404 → keine), Version 1.6.2 festlegen, `manifest.json`, `package.json` und `package-lock.json` angleichen | R-1 | Pre-Submit-Check meldet „package.json and manifest.json versions match (1.6.2)“ | 1 h | — |
| **R-02** | **Release-Hinweise:** `CHANGELOG.md`-Eintrag 1.6.2 (Fixed/Changed) und englischer Release-Notes-Block im Store-Listing | R-3 | CHANGELOG enthält 1.6.2 mit Datum; Listing §6 hat einen 1.6.2-Block fürs ATN-Dialogfeld | 1 h | R-01 |
| **R-03** | **Versionskonsistenz der Doku:** README (EN/DE), STATUS, index, store_listing, store_assets, screenshot_capture, privacy_policy (DE/EN-Kopf), live_test_protocol, quickstart auf 1.6.2; Snapshot-Dokumente bleiben unverändert | R-4 | `grep` findet keine Versionsangabe „1.6“ mehr außerhalb der gekennzeichneten Snapshots | 1 h | R-01 |
| **R-04** | **Gates und Artefakt:** `npm run check` (Pre-Submit, 427 Tests, Lint, Build+Paketprüfung) und SHA-256 des XPI ermitteln | R-2, R-5 | `check` → Exit 0; XPI `thundy_av_email_scanner_for_thunderbird-1.6.2.zip` mit Hash dokumentiert | 2 h | R-01 |
| **R-05** | **Release veröffentlichen:** Tag `v1.6.2` auf den Commit, GitHub-Release (kein Pre-Release) mit XPI als Asset und den Release-Notes als Text | R-2, R-6 | `gh release view v1.6.2` zeigt Tag, Asset und Notes; `releases/latest` ist dieses Release | 1 h | R-04 |
| **R-06** | **Nachverifikation und Doku:** Download des Assets prüfen (Hash), Release-URL + Hash in STATUS/decisions (D11) eintragen, Aufgabenstand aktualisieren | R-5, R-6 | Hash des heruntergeladenen Assets == lokaler Hash; STATUS/decisions nennen Version, Tag, Release-URL | 1 h | R-05 |
| **R-07** | **Store-Gate erneut ausführen:** `npm run store-gate` — C7 muss nun PASS sein, offen bleiben nur C5 (Screenshots) und C6 (Live-Test) | R-2 | Gate-Protokoll zeigt C1–C4 + C7 PASS, C5/C6 FAIL (bewusst, manuell) | 0,5 h | R-05 |
| **R-08** | **ATN-Signierung dokumentieren (nicht ausführbar):** Kommandozeile mit `--amo-base-url`/`--approval-timeout` in STATUS/decisions verlinken; Hinweis, dass der Upload die ATN-API-Schlüssel des Maintainers braucht | R-2 | Befehl steht in STATUS „Remaining“; Gate-Kriterienliste nennt die Verantwortlichkeit | 0,5 h | R-05 |

**Summe:** ≈ 8 h (1 Personentag) — überwiegend Dokumentation und Verifikation, kein Produktivcode.

**Nicht in dieser Runde möglich:** ATN-Upload (keine API-Schlüssel), echte Screenshots (C5), Live-Test in
Thunderbird 140 ESR (C6). Beide bleiben als manuelle Schritte dokumentiert.

### Ausführungsstand Runde 2 (2026-10-01)

| ID | Status | Nachweis |
|---|---|---|
| R-01 | **erledigt** | `manifest.json`/`package.json`/`package-lock.json` = 1.6.2; Pre-Submit: „package.json and manifest.json versions match“ |
| R-02 | **erledigt** | `CHANGELOG.md` §1.6.2 (Fixed/Changed); `docs/store_listing.md` §6 mit englischem 1.6.2-Block |
| R-03 | **erledigt** | README (EN/DE), STATUS, index, listing, assets, screenshot-guide, policy (DE/EN), protocol, quickstart auf 1.6.2 |
| R-04 | **erledigt** | `npm run check` → Exit 0; XPI 53.277 Bytes, SHA-256 `12cd335b…cdee`, 17 Dateien / 196.507 B entpackt |
| R-05 | **erledigt** | Tag `v1.6.2` auf `a94c9ec`; Release https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.2 mit Asset `thundy-av-1.6.2.xpi`, kein Pre-Release |
| R-06 | **erledigt** | Asset heruntergeladen, `cmp` gegen den geprüften Build → identisch; Hash/URL in `docs/STATUS.md` und `docs/decisions.md` (D11) |
| R-07 | **erledigt** | `npm run store-gate`: C1–C4 **und C7** PASS, offen nur C5 (Screenshots) und C6 (Live-Test) |
| R-08 | **erledigt (dokumentiert)** | Signierkommando mit `--amo-base-url`/`--approval-timeout` in STATUS „Remaining“ und Release-Notes; Ausführung benötigt die ATN-Schlüssel des Maintainers |

**Nebeneffekt:** Mit dem regulären Release ist der 2024er-Eintrag nicht mehr „Latest“
(`gh api repos/…/releases/latest` → `v1.6.2`), damit ist Befund R-6 ohne destruktive Eingriffe gelöst.



## 13. Runde 3 — Funktionsanalyse Hybrid-Analysis-Strang und Analyse-Protokoll (2026-10-16)

**Anlass:** Nutzermeldung „Der Hybrid-Analyse-Strang scheint kein Analyse-Protokoll zurückzuliefern“.
**Bezug:** Quellstand 1.23.0; ergänzt Phasen 1–4 um den Themenbereich *Analyse-Funktionalität* und
*Analyse-Protokoll*. Alle Befunde sind statisch am Quelltext und über Testsuite-Läufe belegt.

### Befunde

| ID | Schwere | Befund | Beleg |
|---|---|---|---|
| FA-1 | **P1** | Ein im Hintergrund hochgeladenes Element (`state UPLOADED`) wird im Popup genau **einmal** via `overview/{sha256}` abgefragt. Liefert die API `state IN_PROGRESS`, bleibt es bei „Bitte versuchen Sie es später erneut“ — es gibt **kein Polling**: das fertige Analyse-Protokoll wird dem Nutzer nie zugestellt, solange das Popup offen ist; nach dem Schließen ist der Zustand verloren. | `api.js` `renderInProgressStatus()`/`renderReport()` (IN_PROGRESS-Zweig); kein `setInterval`/Polling im gesamten `api.js` (vor dem Fix) |
| FA-2 | **P2** | `hybrid_submission_id` und `hybrid_job_id` werden beim Upload gespeichert, aber **nirgends gelesen oder angezeigt** — das Analyse-Protokoll ist ohne Job-/Submission-ID nicht nachvollziehbar (keine Traceability zum Provider-Vorgang). | `background.js:946–947`, `background.js:1504–1505`, `background.js:1562–1563` (nur Schreibzugriffe); kein Lesezugriff in `api.js` |
| FA-3 | **P1** | Das abgerufene Protokoll (`json_data`) wird **nicht persistiert**. Nach dem Schließen des Popups enthält der IndexedDB-Datensatz nur Upload-Status (`UPLOADED`/`UNKNOWN`), nicht das fertige Ergebnis — ein erneutes Öffnen fragt erneut nach (und nach 15-minütigem `ExpiringMap`-Cache-Verfall erneut die API) statt das fertige Protokoll offline zu zeigen. | `api.js` `get_hybrid_report_by_sha256()`/`render_hybrid_report_ui()` (vor dem Fix kein Schreibzugriff auf den Store); `db.js` Store `hybridanalysis` |
| FA-4 | **P2** | Gate-Kriterium C5 durchsuchte `docs/screenshots/` **nicht rekursiv**; die echten Abnahme-Screenshots aus den Thunderbird-140.17-ESR-Läufen liegen aber in Unterverzeichnissen (`docs/screenshots/thunderbird-linux/`, `1.19.1` … `1.22.0`) und wurden deshalb fälschlich als fehlend gemeldet. | `scripts/submission-gate.js` `hasScreenshots()` (vor dem Fix: nur Top-Level-`readdirSync`); existierende PNGs: 8 Dateien in `docs/screenshots/thunderbird-linux/` u. a. |

### Aufgaben

| ID | Aufgabe | Befund | DoD (Nachweis) | Aufwand | Status |
|---|---|---|---|---|---|
| FA-A1 | **Automatisches Polling für laufende Analysen:** `get_hybrid_report_by_sha256()` plant bei `state IN_PROGRESS` begrenzte Wiederholungen (`HYBRID_REPORT_POLL_MAX_ATTEMPTS = 3`, 5 s Abstand), löscht vor jedem Poll den SHA-Cache und ersetzt die `IN_PROGRESS`-Karte durch das fertige Protokoll; UI-Hinweis nennt das automatische Nachfragen (Schlüssel `ui_173`, alle sechs Sprachen). | FA-1 | Unit-Tests: Poll wird geplant, Cache vor Wiederholung gelöscht, Abbruch nach Versuchslimit; Kataloge EN/DE/FR/ES/IT/PL konsistent | 0,5 d | **erledigt** |
| FA-A2 | **Analyse-Protokoll-Metadaten rendern:** neuer Block „Analyse-Protokoll“ in jeder Ergebniskarte mit Job-ID, Submission-ID, SHA-256 und Abrufzeitpunkt (Schlüssel `ui_169`–`ui_172`, alle sechs Sprachen); Job-/Submission-IDs werden aus dem gespeicherten Datensatz an die Renderkette durchgereicht. | FA-2 | Unit-Test rendert Job-/Submission-ID; i18n-Gate prüft Kataloge | 0,25 d | **erledigt** |
| FA-A3 | **Protokoll persistieren und offline rendern:** nach erfolgreichem Abruf wird `json_data` mit `report_fetched_at` in den Nachrichtendatensatz geschrieben (`persistHybridReport()`, nur lokal — keine Zustimmungsrelevanz, da die Daten bereits auf dem Gerät sind); beim nächsten Popup-Öffnen wird ein **fertiges** gespeichertes Protokoll ohne Provideranfrage gerendert (`hasFinalStoredReport()`, `buildStoredAttachmentReportTask()`/`buildStoredLinkReportTask()`); neue Uploads (Rescan, URL-Scan, Autoupload) invalidieren das alte Protokoll (`report = null`). | FA-3 | Unit-Tests: Persistierung schreibt Report in Attachments und Links; Offline-Render ohne Netzaufruf; `npm run check` Exit 0 | 0,5 d | **erledigt** |
| FA-A4 | **Dokumentation:** Datenschutzerklärung §8 um die lokal gespeicherten Analyse-Protokolle ergänzt; STATUS-Eintrag mit Nachweisen. | FA-3 | Änderung in `docs/privacy_policy.md` §8; STATUS-Eintrag 2026-10-16 | 0,25 d | **erledigt** |
| FA-A5 | ✋ **Live-Verifikation des Analyse-Protokolls in Thunderbird 140 ESR** (benötigt Hybrid-Analysis-API-Key und GUI): echter Anhang-Upload → `IN_PROGRESS`-Karte mit Polling-Hinweis → fertiges Protokoll erscheint ohne Nutzeraktion; Popup schließen und erneut öffnen → Protokoll wird **offline** angezeigt; Rescan leert das alte Protokoll und startet neu; URL-Scan entsprechend. Ergebnis in `docs/live_test_protocol.md` festhalten. | FA-1, FA-3 | Protokollabschnitt mit gemessenen Zeiten (Upload → fertiges Protokoll) und Screenshots | 0,5 d | **offen (manuell)** |
| FA-A6 | **Funktionsanalyse der Analysepfade automatisiert absichern:** Browser-Kurzfälle (`npm run check:ui`) um die neuen Zustände erweitern — Offline-Protokollkarte mit Protokollblock (ohne Zustimmung, ohne Netzaufrufe), Polling-Übergang `IN_PROGRESS` → fertiges Protokoll mit synthetischer Provider-Route, Anzahl der Overview-Anfragen genau 2. | FA-1, FA-3 | Matrix enthält `hybrid-stored-*` und `hybrid-poll-*` (EN/DE); Lauf `npm run check:ui` in CI (Umgebung ohne Chromium-Systembibliotheken dort nicht ausführbar) | 0,5–1 d | **implementiert; Lauf in CI** |
| FA-A7 | **Review-Notes ergänzen:** `docs/reviewer_notes.md` §4.1 um den Datenfluss „Submission → Overview-Abruf → lokale Protokollspeicherung → Offline-Anzeige → Invalidierung“ erweitern (erleichtert die ATN-Review-Begutachtung des Zustimmungsmodells). | FA-2, FA-3 | Reviewer-Notes enthalten §4.1 mit Funktions-/Dateiverweisen | 0,25 d | **erledigt** || FA-A8 | **Gate-Fix C5:** `hasScreenshots()` in `scripts/submission-gate.js` durchsucht `docs/screenshots/` rekursiv (Unterverzeichnisse einbezogen); Gate-Unit-Tests bleiben grün. | FA-4 | `scripts/submission-gate.test.js`: 7/7 bestanden; `npm run store-gate` meldet C5 **PASS** mit den gefundenen PNG-Pfaden | 0,25 d | **erledigt** |


### Ausführungsstand Runde 3 (2026-10-16)

| ID | Status | Nachweis |
|---|---|---|
| FA-A1 | **erledigt** | `api.js`: `HYBRID_REPORT_POLL_MAX_ATTEMPTS`/`HYBRID_REPORT_POLL_DELAY_MS`, `scheduleHybridReportPoll()`; Tests „polls an IN_PROGRESS analysis automatically…“ und „stops polling after the attempt limit“ bestehen |
| FA-A2 | **erledigt** | `api.js`: `renderProtocolMeta()` in `renderReport()`; Test „renders analysis protocol metadata (job and submission id)“ besteht; `ui_169`–`ui_173` in allen sechs `_locales` identisch strukturiert |
| FA-A3 | **erledigt** | `api.js`: `persistHybridReport()`, `hasFinalStoredReport()`, Task-Builder, IIFE-Verzweigungen; `background.js`: Protokoll-Invalidierung bei neuen Uploads (3 Stellen); Tests „persists the finished protocol…“ und „renders a stored protocol offline…“ bestehen |
| FA-A4 | **erledigt** | `docs/privacy_policy.md` §8 ergänzt; STATUS-Eintrag 2026-10-16 |
| FA-A6 | **implementiert** | `tools/browser-ui.dev.cjs`: Fälle `hybrid-stored-*`/`hybrid-poll-*` (EN/DE), `seedHybridStore()`/`HYBRID_RECORD`, synthetische `hybrid-analysis.com`-Route (1× `IN_PROGRESS`, 1× fertig), Interaktionsprüfungen auf Protokollblock und Anfragezahl 2; `tools/ui-fixtures.dev.cjs`: `hybrid`-Modus (Consent/API-Key/Host-Berechtigung). Matrix-Verifikation lokal bestanden (4 Fälle); Browser-Lauf in dieser Umgebung nicht möglich (fehlende Chromium-Systembibliotheken, kein Root) — verifiziert über den CI-Job `browser-ui` |
| FA-A7 | **erledigt** | `docs/reviewer_notes.md` §4.1 „Analysis-protocol lifecycle“ (5 Schritte + Löschverhalten) |
| FA-A8 | **erledigt** | `scripts/submission-gate.js` `hasScreenshots()` rekursiv; `submission-gate.test.js` 7/7; Store-Gate C5 nun **PASS** |
| Gesamt | — | `npm run check` → **Exit 0**, **954 Tests bestanden**, 0 Lint-Fehler, Paketprüfung gültig; `npm run store-gate` → C1–C5 PASS, offen C6/C7 |

**Korrektur (16.10., zweiter Lauf):** Der veröffentlichte Tag `v1.23.0` zeigt auf den Vorbereitungsstand
`df63c76` — die Analyse-Protokoll-Fixes liegen **nicht** im 1.23.0-Release. Gate C7 meldet zurecht
„publish a new version“ (geänderte Artefaktdateien: `api.js`, `background.js`, `_locales/*`).
Die Fixes werden daher als **Version 1.24.0** veröffentlicht (Runde 4, §14); C7 wird durch den Tag
`v1.24.0` am Release-Commit erfüllt. Hinweis: Der Workflow „Publish GitHub release“ schlug beim
Tag-Push fehl, weil das Release bereits manuell (vor dem Workflow) erstellt war — harmlos, Assets
verifiziert; künftig Release-Erstellung dem Workflow überlassen oder umgekehrt.

---

## 14. Runde 4 — Release 1.24.0 (Analyse-Protokoll ausliefern)

| ID | Aufgabe | DoD | Status |
|---|---|---|---|
| V-01 | Versionsbump: `manifest.json`, `package.json`, `package-lock.json` auf 1.24.0 | Pre-Submit meldet „package.json and manifest.json versions match (1.24.0)“ | **erledigt** |
| V-02 | CHANGELOG-Eintrag 1.24.0 (Analyse-Protokoll, Browser-Fälle, Gate-Fix) | `CHANGELOG.md` §1.24.0 vorhanden; 1.23.0 unverändert ohne Protokoll-Fixes | **erledigt** |
| V-03 | Release-Notes `docs/releases/1.24.0.md` (EN + DE-Kurzfassung) | Datei vorhanden, referenziert aus STATUS | **erledigt** |
| V-04 | Doku-Versionen: `docs/index.md` auf 1.24.0 (Drift 1.22.0 → 1.24.0 geschlossen) | `grep 1.22.0 docs/index.md` leer | **erledigt** |
| V-05 | Gates grün vor Tag: `npm test` 954, Lint 0 Fehler, Paketprüfung gültig | Exit 0 | **erledigt** |
| V-06 | Tag `v1.24.0` am Release-Commit, push, GitHub-Release mit `thundy-av-1.24.0.xpi` + `SHA256SUMS.txt` | Release https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.0 mit beiden Assets; Asset heruntergeladen und gegen lokalen Build verglichen — byte-identisch, SHA-256 `c6dc5631…3145d`; Hash in STATUS dokumentiert | **erledigt** |
| V-07 | Store-Gate final: C1–C5 + C7 PASS, offen nur C6 | Gate-Protokoll: C1–C5 **PASS**, C6 FAIL (manuell), C7 **PASS** | **erledigt** |
| V-08 | ✋ ATN-Signierung/Einreichung (ATN-Schlüssel) + Live-Test C6/FA-A5 | Store-URL in README/Listing | **offen (manuell)** |


## 15. Runde 5 — Nächste Aufgaben: Einreichungsfokus (Plan vom 16. Oktober 2026)

**Vorgehen:** Deltalanalyse über alle Pläne (Store-Gate, Analyse-Protokoll-Runde §13/§14,
[AUFGABENPLAN_OPTIMIERUNG_I18N.md](AUFGABENPLAN_OPTIMIERUNG_I18N.md) T01–T18,
[ENTERPRISE_NAECHSTE_SCHRITTE.md](ENTERPRISE_NAECHSTE_SCHRITTE.md)). Ergebnis der Delta-Analyse:
die Qualitätsaufgaben T01–T17 sind implementiert; die manuellen Freigabenachweise konvergieren in
**einen** Live-Test (C6 = T18 = FA-A5). Der kritische Pfad zur Einreichung ist daher:
Doku-Konsistenz → Live-Test → Store-Gate GO → ATN-Signierung/Einreichung.

### Befunde (Doku-Drift vor der Einreichung)

| ID | Schwere | Befund | Beleg |
|---|---|---|---|
| SL-1 | **P1** | Das Store-Listing ist auf dem Stand 1.6/1.19.0: Header-Version „1.6“, Einleitungstext nennt Kandidat 1.19.0, Checklist §7 verweist auf „version 1.6.2“/„MIT at that release“ und meldet Screenshots als offen — alles überholt (aktuell 1.24.0, GPL v3, 23 echte PNGs, Gate C5 PASS). | `docs/store_listing.md` Kopf, Einleitung, §7 |
| SL-2 | **P2** | `store_assets.md` meldet Screenshots als „offen — nur SVG-Platzhalter“ und „nur deutsch lokalisiert“; beide Aussagen sind überholt (23 reale PNGs, Gate C5 PASS; sechs Sprachen seit 1.19.0). | `docs/store_assets.md` §1/§2/§4/§6 (vor dem Fix) |
| SL-3 | **P2** | `reviewer_notes.md` Kopf nennt „**Version:** 1.6“ statt 1.24.0. | `docs/reviewer_notes.md` Kopf (vor dem Fix) |

### Aufgaben

| ID | Aufgabe | Befund | DoD | Aufwand | Status |
|---|---|---|---|---|---|
| N-01 | ✋ **Live-Test in Thunderbird 140 ESR ausführen** (deckt C6, T18 und FA-A5 ab): Protokoll `docs/live_test_protocol.md` in der Fassung 1.24.0 abarbeiten — inkl. neuem Schritt **9.14** (Analyse-Protokoll live: Upload → `IN_PROGRESS`-Polling → fertiges Protokoll; Popup schließen/öffnen → Offline-Anzeige ohne Netzrequest; Rescan-Invalidierung; Cache-Verhalten). Der CI-belegte Umfang ist in [live_test_1_24_0.md](live_test_1_24_0.md) dokumentiert und muss nicht wiederholt werden. Der Runner deckt inzwischen 9.2 (Banner-Buttons/Consent-Gate), 9.3 (offline Absender-Persistenz), 9.12 (Cache leeren) und 9.13 (Banner-Dedup) automatisiert ab — der manuelle Rest schrumpft auf die Provider-Schritte mit konfiguriertem Schlüssel (9.6, 9.8–9.11, 9.14) plus 9.10 als Sichtprüfung. Provider- und interaktive Schritte ohne Schlüssel werden ehrlich als `N/A` mit Begründung geführt (das Gate zählt nur OK/FAIL; ≥ 10 OK nötig — erreichbar über 9.1–9.5, 9.7, 9.10, 9.12, 9.13, 9.14-dokumentiert). Summe-Zeile füllen, optionale Banner-Motive aufnehmen. | C6, FA-A5, T18 | Gate C6 **PASS** (≥ 10 OK, 0 FAIL) → `npm run store-gate` → **GO** | 0,5–1 d | **offen (manuell)** |
| N-02 | **Store-Listing auf 1.24.0 aktualisieren:** Header-Version, Einleitung (Kandidat 1.24.0 inkl. Analyse-Protokoll), Release-Notes-Block 1.24.0 in §6, Checklist §7 (Manifest 1.24.0/GPL v3, Screenshots done). | SL-1 | `grep` findet keine 1.6/1.19.0-Aktivbehauptungen mehr; §7 ehrlich (Live-Test weiter offen bis N-01) | 0,25 d | **erledigt** |
| N-03 | **`store_assets.md` aktualisieren:** reale PNG-Inventare (23, fünf Gruppen), SVGs als Entwurfsskizzen gekennzeichnet, „Was fehlt“/„Offene Punkte“ korrigiert, Sprachangabe sechssprachig. | SL-2 | Dokument stimmt mit `find docs/screenshots -iname '*.png'` (23) und Gate C5 PASS überein | 0,25 d | **erledigt** |
| N-04 | **`reviewer_notes.md` Kopf auf 1.24.0** setzen. | SL-3 | Kopf nennt 1.24.0 | 0,1 d | **erledigt** |
| N-05 | **Einreichungspaket & Signier-Dry-Run vorbereiten:** finale Checkliste (Store-Gate GO nach N-01), Signierkommando (STATUS „Remaining“) gegenprüfen, ATN-Konto-Voraussetzungen listen, Reviewer-Notes/Listing/Testdata als Review-Paket verlinken, Doku-Drift-Check (`grep 1.23.0/1.6` in Aktivdokumenten). | SL-1–SL-3, V-08 | Checkliste im STATUS „Remaining“ ergänzt; alle Aktivdokumente nennen 1.24.0 | 0,25 d | **offen** |
| N-06 | **CI-Verifikation FA-A6:** `browser-ui`-Job auf dem Release-Commit prüfen; `hybrid-stored-*`/`hybrid-poll-*` müssen grün sein, sonst Fix nachziehen. Drei Testläufer-Fixes dafür nötig: (1) Hybrid-Fälle benötigen `populated: true` (sonst keine angezeigte Nachricht, Leerkarte statt Record-Auflösung); (2) `ready()`/Kartenzählung tolerant gegen die verschachtelte Scanner-Info-Karte (`.first()` bzw. Top-Level-Zählung `> .card`); (3) Poll-Case wartet auf das Bedrohungsscore-Feld der fertigen Karte (die IN_PROGRESS-Karte enthält die Protokoll-Metadaten bereits sofort). Außern Live-Runner gegen transienten Dokument-Teardown gehärtet (`documentElement is null` → Navigation-in-Progress-Retry). | FA-A6 | CI-Lauf [38982642985](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/38982642985) auf `d6bd400`: **alle Jobs success** (test, Browser UI × 6, Thunderbird Linux GUI) | 0,1 d | **erledigt** |
| N-07 | **Post-Listung: Review-Monitoring** (nach Einreichung): ATN-Review-Status verfolgen, Feedback-Triage (Issues mit FA-/T-Labels), schnelle Punkt-Releases für Review-Fixes (Versionspolitik wie Runde 4). | V-08 | Prozessabschnitt in STATUS/decisions | 0,25 d | **offen (nach Einreichung)** |
| N-08 | **Erweiterung (kein Freigabe-Blocker):** Enterprise-Track (SEALED/SSO/N06, produktive Policy-Kanäle) gemäß [ENTERPRISE_NAECHSTE_SCHRITTE.md](ENTERPRISE_NAECHSTE_SCHRITTE.md) separat planen und priorisieren. | — | Eigener Aufgabenplan-Status im Enterprise-Dok | — | **offen (Erweiterung)** |
| N-09 | **Erweiterung (kein Freigabe-Blocker):** Erkennungsqualität — reale Korpora für FR/ES/IT/PL-Heuristiken und sprachübergreifende Gemischttext-Fälle (Fortsetzung T15/T16 aus dem i18n-Plan). **Teil 1 erledigt:** Korpus `testdata/heuristics.json` von 12 auf 21 Samples erweitert — erstmals **benigne Gegenstücke** für FR/ES/IT/PL (Fehlalarm-Schutz: gewöhnliche Rechnungs-/Terminmails dürfen nicht riskant bewertet werden), ein gemischt- en/PL-benigner Fall und je Sprache eine Riskio-Variante mit anderem Signalwort-Muster (fr „Compte bloqué“, es „Contraseña“, it “Account bloccato”, pl „Ważna aktualizacja“). Der Bestandstest (`heuristic corpus distinguishes urgency from ordinary invoices across message languages`) besteht mit allen 21 Samples. **Teil 2 offen:** reale (nicht synthetische) Nachrichtenkorpora und Feinjustierung der Schwellen auf Basis von Fehlalarm-Statistik. | — | Korpus-Test mit 21 Samples grün; Teil 2 dokumentiert | 0,5 PT (Teil 1) | **teilweise erledigt (Erweiterung)** |

### Reihenfolge und GO-Pfad

1. **N-02…N-04** (erledigt) — Doku-Konsistenz vor der Einreichung hergestellt.
2. **N-05** — Einreichungspaket und Signier-Dry-Run (ohne ATN-Schlüssel dokumentierbar).
3. **N-01** ✋ — manueller Live-Test (kritischer Pfad); danach `npm run store-gate` → **GO**
   (C1–C7 PASS). Alle anderen Kriterien sind seit Runde 4 grün.
4. **V-08** — ATN-Signierung (`--amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed
   --approval-timeout 0`) und Einreichung; danach **N-06/N-07**.
5. **N-08/N-09** — Erweiterungen nach der Listung, klar getrennt von Freigabe-Arbeit.


## 16. Runde 6 — Provider-Anbindungs-Audit („Sind alle externen Dienste korrekt angebunden?“)

**Anlass:** Explizite Nutzerfrage. **Umfang:** Alle fünf externen Dienste — Hybrid Analysis,
VirusTotal, urlscan.io, URLhaus (abuse.ch), AbuseIPDB — gegen ihre APIs geprüft: Endpunkte, Methoden,
Auth-Header, Form-/JSON-Bodies, Host-Berechtigungen (Manifest ↔ options.js ↔ runtime
`requireHostPermission`), Gateway (Timeout, Host-Queue, Retry-After, Abort bei Consent-Entzug) und
Caching/Invalidierung (T10/T13).

### Befunde

| ID | Schwere | Befund | Beleg |
|---|---|---|---|
| PA-1 | **verifiziert korrekt** | Endpunkte/Methoden/Auth-Header aller fünf Dienste stimmen mit den Provider-APIs überein: HA `GET /api/v2/overview/{sha}` + `POST quick-scan/file` (multipart, `scan_type` im Form-Body) + `POST quick-scan/url` (form-urlencoded `url`+`scan_type`) mit `api-key`-Header; VT `GET /api/v3/files/{sha}` und `/ip_addresses/{ip}` mit `x-apikey`; urlscan `POST /scan/` JSON `{url, visibility: 'unlisted'}` mit `API-Key` + Ergebnis-Polling `GET /result/{uuid}/` mit Backoff; URLhaus `POST /v1/host/` form `host=…` mit `Auth-Key`, `query_status`-Auswertung; AbuseIPDB `GET /api/v2/check?ipAddress=…&maxAgeInDays=90` mit `Key`-Header | `providers.js`, `background.js:316–355`, `api.js` `fetch_hybrid_report` |
| PA-2 | **verifiziert korrekt** | Gateway injiziert Auth-Header hostname-basiert und konsistent mit den Adaptern; alle Provider-Aufrufe laufen über `apiGateway.fetchWithTimeout` (Timeout, Host-Queue 2/Host für HA, Retry-After nur für GET, keine POST-Wiederholungen, Abort bei Consent-Entzug) | `api_gateway.js:17–45`, `providers.js`, T13-Nachweise |
| PA-3 | **P3 (behoben)** | `user-agent: Falcon` ist ein verbotener Header-Name für `fetch` — der Header wurde **nie gesendet**; toter Code in `providers.js` und `api.js` (Popup-Overview). Entfernt. | `providers.js` (vor Fix), `api.js:622` (vor Fix) |
| PA-4 | **P3 (behoben)** | `scan_type: 'all'` wurde zusätzlich als **Header** gesetzt, obwohl der multipart-/form-Body den Parameter bereits trägt — redundant. Entfernt. | `providers.js` (vor Fix) |
| PA-5 | **P3 (behoben)** | VirusTotal-Origin war nur über die Wildcard `https://*.virustotal.com/*` gedeckt, während Code (`PROVIDER_ORIGINS`) und options.js den expliziten Pattern `https://www.virustotal.com/*` verwenden. Firefox deckt schmalere Pattern über breitere deklarierte Pattern ab, aber der explizite Eintrag macht den Grant deterministisch. Ergänzt. | `manifest.json` optional_host_permissions (vor/nach Fix), `scan_policy.js:57`, `options.js:188` |
| PA-6 | **verifiziert korrekt** | options.js fordert Origins nur für konfigurierte Dienste an (`hybrid` bei Schlüssel, VT bei Schlüssel/IP-Provider, urlscan nur bei Stufe `max`, URLhaus/AbuseIPDB bei Provider+Schlüssel); Stufenwechsel erfordern immer „Speichern“, das die Origins neu anfragt — keine Lücke. Runtime-Gates (`tierAtLeast`, `mayTransmitExternally`) bleiben unabhängig von Berechtigungen. | `options.js:186–193` |
| PA-7 | **verifiziert korrekt** | Schlüsselwechsel invalidieren Caches (VT-Cache, Hybrid-Report-Cache, Reputation), API-Schlüssel liegen — dokumentiert — unverschlüsselt lokal, werden im XPI nicht ausgeliefert, kein Telemetrie-Pfad | `background.js` storage.onChanged, `db.js`, reviewer_notes |
| PA-8 | **P2 (behoben in 1.24.2)** | urlscan-Ergebnis-Polling fragte `/result/{uuid}/` **ohne** `API-Key`-Header — für `unlisted`-Scans per UUID-Zugriff zulässig, aber anfällig gegen urlscan-Politikänderungen. Behoben: der Ergebnis-Abruf sendet jetzt den `API-Key`; außerdem ist der Gateway-Auth-Injektions-Layer verdrahtet (`setApikey` bei Start und bei jeder Schlüsseländerung, defense-in-depth — bestehende Adapter-Header werden nie überschrieben). Restverifikation mit echtem Schlüssel im Live-Test (N-01). | `providers.js` `pollUrlscanIoResult`, `background.js` `syncGatewayApikeys`, `api_gateway.js` `_injectAuthHeaders` |

**Gesamturteil:** Alle fünf externen Dienste sind korrekt angebunden; keine Endpunkt-, Auth- oder
Berechtigungsfehler. Drei Hygiene-/Robustheits-Findings (PA-3…PA-5) wurden in Version **1.24.1** behoben.

### Release 1.24.1

| ID | Aufgabe | DoD | Status |
|---|---|---|---|
| PA-R1 | Version 1.24.1 (manifest/package/lock), CHANGELOG, Release-Notes `docs/releases/1.24.1.md`, docs/index + README (EN/DE) auf 1.24.1 | Pre-Submit: Versionen stimmen überein | **erledigt** |
| PA-R2 | Tests mit aktualisierten Header-Erwartungen (`getHybridAnalysisOptions`, `fetch_hybrid_report`) | `npm test` → 954 bestanden | **erledigt** |
| PA-R3 | Tag `v1.24.1` + GitHub-Release mit `thundy-av-1.24.1.xpi` + `SHA256SUMS.txt`; Asset-Hash gegen lokalen Build verifiziert | Release [v1.24.1](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.1) vom Workflow erstellt; entpackter Inhalt byte-identisch mit dem Build vom Tag-Commit (44 Dateien), Asset-SHA-256 `a172c322…9b5f`; Store-Gate C7 **PASS** | **erledigt** |
| PA-R4 | CI grün auf Release-Commit (test, Browser UI × 6, Thunderbird Linux GUI) | [CI 39015367240](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/39015367240) — alle Jobs success | **erledigt** |
| PA-R5 | ✋ Provider-Live-Checks mit echten Schlüsseln (N-01): HA-Upload inkl. 9.14, VT-Hash/IP, urlscan Time-of-Click inkl. PA-8-Restverifikation, URLhaus, AbuseIPDB | Protokoll Ist-Werte → C6 → GO | **offen (manuell)** |
| PA-R6 | Version 1.24.2: Gateway-Verdrahtung (`syncGatewayApikeys` bei Start/onChanged, nur Ergänzung ohne Override), urlscan-Ergebnisabruf mit `API-Key`, Tests (Gateway-Injektion, Verdrahtung, Header-Assertion) | `npm test` → 956 bestanden (2 neue Tests) | **erledigt** |
| PA-R7 | Tag `v1.24.2` + GitHub-Release (Workflow) mit Assets; Asset-Inhalt gegen Tag-Build verifiziert; Store-Gate C7 **PASS**; CI grün | Run-/Release-Links in STATUS | **erledigt** |
