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
| **A-18** ✋ | **ATN-Listung anlegen und ausfüllen:** Entwicklerkonto, Listing (Titel „Thundy AV – Email Scanner for Thunderbird“, Summary ≤ 250 Zeichen, Beschreibung EN/DE), Kategorie final wählen, Lizenz MIT, Support-Mail, Homepage, **Privacy-Policy-URL**, Screenshots, Releasenotes 1.6/1.6.x | P0-4, P3-22 | Listung im ATN-Entwurf vollständig; alle Pflichtfelder gefüllt; Kategorie dokumentiert | 4 h | A-11, A-13 |
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



---

## 13. Runde 3 — Forscher-Ansicht, Benachrichtigungen, Design (Version 1.6.3)

Neue Befunde **S-1 … S-8** (Bezug: §0.3 der Problemanalyse) und die zugehörigen Aufgaben. Ziel: die
Sicht des Toolbar-Buttons für IT-Sicherheitsforscher nutzbar machen, Benachrichtigungen zu einem
Statuskanal je Scan bündeln und die Oberfläche auf ein Design-System stellen — ohne neue Berechtigungen.

| ID | Aufgabe | Bezug | DoD (Nachweis) | Aufwand | Abhängig von |
|---|---|---|---|---|---|
| **S-01** | **Dossier-Engine im Hintergrund:** `buildResearchDossier(messageId)` mit Nachricht, Provenienz, Authentifizierung, Received-Kette, Absender, Anhängen (SHA-256), Links, IOCs, Risiko, MITRE und Zeitleiste; neue Message-Action `getResearchDossier` | S-1, S-7 | Test: Dossier aus gemockten Headern enthält alle Abschnitte; Pre-Submit-Check unverändert grün | 4 h | — |
| **S-02** | **Header-/Auth-Parser:** `parseAuthenticationResults()` (SPF/DKIM/DMARC + `Received-SPF`) und `parseReceivedChain()` (Hop, IP, Protokoll, Zeitdifferenz, auffällige Verzögerung) | S-1 | Tests für Pass/Fail-Kombinationen, Mehrfach-DKIM und Verzögerungen (2 h/1 h) | 2 h | — |
| **S-03** | **IOC-Extraktion und MITRE-Zuordnung:** `extractIocs()` (dedupliziert, begrenzt) und `mapMitreTechniques()` mit `confidence: 'heuristic'` + Belegindikator | S-2, S-4 | Tests: IOC-Buckets korrekt, Techniken für Anhang/Link/Spoofing/Auth-Fail, leere Liste bei harmloser Nachricht | 3 h | S-01 |
| **S-04** | **Score-Ledger:** `calculateThreatScore()` liefert `breakdown` je Regel und `rawScore` | S-3 | Test: Summe der Regelpunkte = Rohsumme, `score` = min(Rohsumme, 100) | 2 h | — |
| **S-05** | **Benachrichtigungs-Engine:** stabile ID je Scan-Vorgang, Aktualisierung statt Stapelung, Klick öffnet die Nachricht (`messageDisplay.open`), Host-only-Texte, Betreffkürzung | S-5 | Tests: gleiche ID für Statusfolge, Kontext-Map, Klick öffnet Nachricht, Kürzung; bestehende `notify()`-Tests bleiben grün | 3 h | — |
| **S-06** | **Design-System:** Tokens (Farb-/Abstands-/Typografie-Skala, Schweregrade), Chips, Verdikt-Badge, Risikobalken, Tabellen, Monospace+Kopierknopf, aufklappbare Sektionen, Tabs, hell/dunkel, Fokusring, Druckstile | S-6 | `theme.css` enthält die Klassen; `web-ext lint` 0 Fehler; bestehende Klassen unverändert nutzbar | 3 h | — |
| **S-07** | **Popup-Forscheransicht + Exporte:** Rendern aller Dossier-Abschnitte, IOC-Kopierknopf, Export als JSON/CSV/STIX-2.1 über `saveResearchExport`, Tab-Umschaltung Übersicht/Forscher | S-2, S-8 | Tests in `test/researcher-view.test.js`: Sektionen im DOM, CSV/STIX-Inhalte, Buttons verdrahtet, Fehlerhinweis statt Silent-Fail | 5 h | S-01, S-06 |
| **S-08** | **Doku, Gates, Release:** README (EN/DE), Reviewer-Notes, Listing, Privacy-Policy, STATUS; Version 1.6.3, CHANGELOG, Tag und Release mit Asset + Hash | alle | `npm run check` → Exit 0; Store-Gate C1–C4 + C7 PASS; Release mit byte-identischem Asset | 3 h | S-01 … S-07 |

**Summe:** ≈ 25 h (3 Personentage). Nicht Teil der Runde: Screenshots (C5) und Live-Test (C6) — beide
bleiben manuelle Schritte.

### Ausführungsstand Runde 3 (2026-10-01)

| ID | Status | Nachweis |
|---|---|---|
| S-01 | **erledigt** | `buildResearchDossier()` + Message-Action `getResearchDossier`; Dossier-Test in `background.test.js` |
| S-02 | **erledigt** | `parseAuthenticationResults()`, `parseReceivedChain()` + 3 Tests |
| S-03 | **erledigt** | `extractIocs()`, `mapMitreTechniques()` + 2 Tests |
| S-04 | **erledigt** | `breakdown`/`rawScore` + Summen-Test |
| S-05 | **erledigt** | `notifyScanStatus()`, `clearNotification()`, Klick-Handler + 4 Tests |
| S-06 | **erledigt** | `theme.css` (101 `thundy-*`-Klassen, hell/dunkel), Banner-Palette gespiegelt; Lint 0 Fehler |
| S-07 | **erledigt** | `test/researcher-view.test.js` (8 Tests), Exporte JSON/CSV/STIX + IOC-Kopie |
| S-08 | **erledigt** | Version 1.6.3, Changelog, Tag `v1.6.3`, Release mit `thundy-av-1.6.3.xpi` (SHA-256 `d2a57233…`), D12 |

