# Store-Readiness-Review – Thundy AV 1.6 (Nachprüfung)

**Prüfgegenstand:** Thunderbird-WebExtension „Thundy AV – Email Scanner for Thunderbird“ (Manifest V3)
**Version:** `manifest.json` 1.6 · `package.json` 1.6.0 · Add-on-ID `thundy-av@bludau-it-services.de`
**Geprüfter Stand:** Branch `cline/e697zjgr` auf Basis `ae2a08e` (Merge PR #636)
**Zielplattform:** Thunderbird Add-ons Store (ATN, addons.thunderbird.net) · Thunderbird ≥ 140.0 ESR
**Datum:** 29.09.2026
**Methode:** statische Analyse aller Laufzeitdateien, Ausführung von Test-Suite, Linter, Pre-Submit-Checks, XPI-Build und
Paketprüfung, Abgleich Dokumente ↔ Code ↔ Manifest ↔ öffentliche Projektseiten/Releases, Reproduktion der Befunde mit
eigenen Wegwerf-Harnessen. Alle Aussagen sind mit `Datei:Zeile` bzw. Kommandoausgabe belegt.

Dieses Dokument ist die **Nachprüfung** der früheren Analyse
[`docs/STORE_READINESS_ANALYSIS.md`](STORE_READINESS_ANALYSIS.md) (Stand 1.5) für den Stand 1.6. Es ersetzt deren
Befundliste nicht, sondern prüft, was von den dortigen Findings tatsächlich behoben ist und was offen blieb.

---

## 1. Gesamturteil

| Bereich | Status |
|---|---|
| Manifest / MV3-Konformität | 🟢 **ok** — `web-ext lint`: 0 Fehler, 26 bekannte Thunderbird-False-Positives |
| Paketinhalt / Release-Hygiene | 🟢 **ok** — XPI mit 17 Laufzeitdateien (179.276 Bytes), keine Tests/Docs/Lockfiles/`install.rdf` |
| Tests | 🟢 **ok** — `npm test`: 394 Tests, 0 Fehler (nach den Fixes in diesem Branch) |
| Datenschutz-Konsistenz Code ↔ Policy | 🟠 **hoch** — ein Leak in diesem Branch behoben, eine Stufen-Umgehung und überdeklarierte Empfänger bleiben |
| Werbeaussagen ↔ implementierte Funktionen | 🔴 **hoch** — Time-of-Click und urlscan.io sind im Code nicht erreichbar, werden aber beworben |
| Listing-/Asset-Reife | 🔴 **hoch** — keine echten Screenshots; Statusangaben teils unzutreffend (XPI 1.6 existiert) |
| Live-Verifikation in Thunderbird | 🔴 **offen** — Banner-Injektion, Kontextmenü, `permissions.request()` nur gemockt getestet |
| Versions-/Release-Konsistenz | 🟠 **hoch** — öffentliche Releases bis **1.18.0** vs. eingereichte Version 1.6 |

**Ergebnis: Das Add-on ist nach diesem Stand noch NICHT store-ready.** Ein technischer Blocker (Consent-Leak im Popup)
wurde in diesem Branch behoben. Für eine Einreichung müssen die sechs Hoch-Befunde H1–H6 abgearbeitet werden — H2
(beworbene, nicht vorhandene Funktion) und H3 (Version/Policy-Diskrepanz) sind die aussichtsreichsten
Ablehnungs-/Nachfragegründe. Die Befunde M und N sind Dokument-, Tooling- und Konsistenzkorrekturen, die vor dem
Upload mit erledigt werden sollten, weil Reviewer genau an diesen Stellen nachfragen.

**Befundzählung:** 0 Blocker (1 behoben) · 6 Hoch · 7 Mittel · 6 Niedrig. Zusätzlich in diesem Branch behoben: der
Altname im Popup samt neuem Namens-Check sowie zwei falsche Angaben in Listing und Reviewer-Hinweisen (Abschnitt 2).

---

## 2. In diesem Branch behobene Befunde

### ✅ (ehemals Blocker) Popup übertrug SHA-256-Hashes ohne globale Zustimmung

**Befund vor dem Fix**
- Das Popup (`popup.html:45` lädt `api.js`) las die gespeicherten Analyse-Records einer Nachricht und lud für jeden
  bekannten Hash einen Report nach: `api.js` (alt) im Init-Block der IndexedDB-Abfrage
  (`get_hybrid_report_by_sha256({ hybrid_sha: hash256, ... })`) sowie über `processRecordLinks()` für Links.
- Der Aufruf landete in `fetch_hybrid_report()` mit
  `url: 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha` und den Kopfzeilen
  `api-key: <Nutzer-Schlüssel>` / `user-agent: Falcon` und wurde per `fetch()` abgesetzt.
- Die eingelesene Zustimmung `externalAnalysisConsent` wurde **nur** für einen Hinweis-Card verwendet
  (`if (!externalAnalysisConsent && apiContainer) { … }`), aber nie als Gate. Das Hintergrund-Gate
  `mayTransmitExternally()` (`background.js:64-72`) greift für Popup-eigenes `fetch()` nicht.
- Damit wurde ein SHA-256-Hash eines Anhangs an einen Dritten übertragen, obwohl die Option
  *„Externe Analyse erlauben“* aus war — im Widerspruch zur Datenschutzerklärung §3.1
  (`docs/privacy_policy.md`), zum Listing (`docs/store_listing.md`) und zur Popup-eigenen Meldung
  („Es werden keine Hashes, Dateien oder Links an Analyse-Dienste übertragen.“).

**Reproduktion (vor dem Fix, Wegwerf-Harness mit `vm`, gemockte `browser`-API und `fetch`-Spion):**

```
consent=false -> fetch calls: 1 [ 'https://hybrid-analysis.com/api/v2/overview/deadbeef' ]
consent=true  -> fetch calls: 1 [ 'https://hybrid-analysis.com/api/v2/overview/deadbeef' ]
```

**Fix in diesem Branch (`api.js`)**
- `externalAnalysisConsent` liegt jetzt im Modul-Scope (`api.js:36`) und wird beim Laden des Popups gesetzt
  (`api.js:95-96`).
- Neues zentrales Gate `mayFetchExternalReports()` (`api.js:40-42`) analog zu `mayTransmitExternally()`.
- `fetch_hybrid_report()` bricht ohne Zustimmung hart ab (`api.js:529-535`, Fehlercode
  `EXTERNAL_ANALYSIS_DISABLED`) — der Netzwerkpfad ist damit auch bei künftigen Aufrufern dicht.
- `get_hybrid_report_by_sha256()` rendert stattdessen einen Hinweis mit Button „Einstellungen öffnen“
  (`api.js:701-726`).
- Der Popup-Init plant ohne Zustimmung keine Report-Fetches mehr (`api.js:205`, `api.js:222`).
- 3 Regressionstests in `api.test.js` (Consent aus ⇒ kein `fetch` + Hinweis; Consent an ⇒ genau ein
  Request an die erwartete URL; `fetch_hybrid_report()` wirft `EXTERNAL_ANALYSIS_DISABLED`).

**Verifikation nach dem Fix:**

```
$ NODE_PATH=node_modules node --test api.test.js
✔ Consent-Gate für externe Report-Abfragen
  ✔ sendet ohne globale Zustimmung keinen Hash an Hybrid Analysis
  ✔ lädt den Report mit globaler Zustimmung
  ✔ fetch_hybrid_report wirft EXTERNAL_ANALYSIS_DISABLED ohne Zustimmung
ℹ tests 95 / pass 95 / fail 0

$ NODE_PATH=node_modules node /tmp/repro.js
consent=false -> fetch calls: 0 []
consent=true  -> fetch calls: 1 [ 'https://hybrid-analysis.com/api/v2/overview/deadbeef' ]
```


### ✅ (ehemals Mittel) Produktname im Popup + fehlender Namens-Check

`popup.html` trug noch den Namen aus 1.5 („Thunderbird Security Antivirus aka Thundy AV“) in `<title>` und `<h1>` —
inkonsistent zu Name/`short_name` in `_locales/*` und mit „Thunderbird“ als Namenspräfix (Mozilla-Namenskonvention
„<Name> for Thunderbird“). Behoben:

- `popup.html:8`, `popup.html:27` → „Thundy AV – E-Mail-Scanner“.
- `scripts/pre-submit-checks.js` prüft jetzt zusätzlich `<title>`/`<h1>` in `popup.html` und `options.html` auf das
  Thunderbird-Präfix (zuvor wurde nur `manifest.name` geprüft) — mit zwei neuen Tests in
  `scripts/pre-submit-checks.test.js`.

### ✅ (ehemals Mittel/Niedrig) Falsche Angaben in Listing und Reviewer-Hinweisen

- `docs/store_listing.md:181` behauptete, das 1.6-XPI existiere noch nicht — tatsächlich liegt `thundy-av-1.6.xpi`
  als Release-Asset vor (siehe H3). Zeile korrigiert.
- `docs/reviewer_notes.md:46` nannte für VirusTotal `https://virustotal.com/*`, was nicht in
  `manifest.json:29` steht (dort `https://*.virustotal.com/*`). Auf die deklarierte Origin korrigiert.

---

## 3. Offene Befunde

### 3.1 Hoch

#### H1 — Die Datenschutz-Stufe wird in den manuellen Pfaden nicht durchgesetzt (Policy ↔ Code)

**Belege**
- Stufenprüfungen existieren nur in den automatischen Pfaden: `background.js:775`
  (`privacyTier === 'max'` in `processAndUploadUrls`) und `background.js:1438`
  (`privacyTier === 'balanced' || 'max'` in `handle_unknown_attachment`).
- Die manuellen Pfade prüfen **nur** die Zustimmung, nicht die Stufe: `background.js:2202-2204`
  (`handleManualUpload()` → `assertExternalAnalysisAllowed()` → anschließend
  `POST https://hybrid-analysis.com/api/v2/quick-scan/file` mit dem vollständigen Anhang,
  `background.js:2215`), ebenso `background.js:2154-2165` (`handleUrlScan()` → `POST …/quick-scan/url`).
  Ausgelöst werden sie durch die Popup-Buttons (`api.js`: `renderManualUploadUI`/`renderManualUrlScanUI`,
  Gegenstelle `background.js:1966-1988`).
- Gegenaussage in der Dokumentation: `docs/privacy_policy.md:110`
  („Vollständiger Anhang (Dateiinhalt, Dateiname, Dateityp, Größe) | **nur Stufe `balanced` und `max`**“;
  die Policy erwähnt **keine** manuelle Ausnahme — `grep -i 'manuell|manual' docs/privacy_policy.md` → 0 Treffer),
  `docs/store_listing.md:41-42` („*strict* — only SHA-256 hashes of attachments“),
  `docs/reviewer_notes.md:66-69`.

**Auswirkung:** Mit der Standardstufe `strict` überträgt ein Klick im Popup den kompletten Dateiinhalt bzw. eine URL.
Ein Reviewer, der die Policy-Tabelle gegen das Verhalten prüft, findet einen direkten Widerspruch.

**Fix (Entscheidung des Maintainers nötig):** entweder Stufenprüfung in `handleManualUpload()`/`handleUrlScan()`
ergänzen **oder** den manuellen Pfad als ausdrückliche, in Policy, Listing und Reviewer-Hinweisen dokumentierte
Ausnahme (bewusste Nutzeraktion per Klick) ausweisen. `README.md` beschreibt die manuelle Upload-Möglichkeit bereits
als Known Limitation — die Datenschutzerklärung tut es nicht.

#### H2 — Beworbene Funktionen sind im Code nicht erreichbar („Time-of-Click“, urlscan.io, „Auto-Scan“)

**Belege**
- `injectTimeOfClickProtection()` (`background.js:823-833`) setzt ausschließlich `link.title` und
  `link.style.borderBottom`. Es gibt **keinen** Klick-Listener: `grep -n 'addEventListener' background.js` → nur
  `background.js:1137` und `:1194` (Buttons im injizierten Opt-in-Banner).
- Der urlscan.io-Pfad hängt an der Nachricht `checkLinkState` (`background.js:1980`). Absender im gesamten Repo:
  keiner — `grep -rn 'checkLinkState' *.js *.html` → nur der `case`-Zweig in `background.js`. Damit sind
  `checkUrlscanIo()` (`background.js:2322`) und der zugehörige `optional_host_permissions`-Eintrag
  (`manifest.json:30-31`) zur Laufzeit tot.
- Die Option „Auto-Scan“ ist wirkungslos: `autoScanLinks` wird deklariert und synchronisiert
  (`background.js:137`, `:194`, `:220-221`, `:275-276`), aber **nie ausgewertet**.
- Beworben wird all das dennoch: `docs/store_listing.md:49` („**Time-of-Click protection.** Links in the message can
  be checked at the moment you click them.“), `README.md:33-37`, `docs/index_en.html`/`docs/index_de.html`,
  Datenschutzerklärung (`docs/privacy_policy.md:111`, `:130` — urlscan.io als Empfänger) und Reviewer-Hinweise
  (`docs/reviewer_notes.md:91`, `:133-134`), UI-Versprechen in `options.html:113-115`.

**Auswirkung:** Zwei Funktionen werden beworben, die nicht auslösbar sind („misleading listing“-Risiko), und ein
Empfänger wird deklariert, der nie kontaktiert wird. Zusätzlich suggeriert der Optionsschalter Steuerbarkeit, die
nicht existiert.

**Fix:** Entweder Klick-Handler im injizierten Kontext implementieren (`addEventListener('click', …)` +
`runtime.sendMessage({action:'checkLinkState'})`) und `autoScanLinks` tatsächlich auswerten — oder die Aussagen und
die urlscan.io-Origin aus Listing, Landing-Pages, Policy, Reviewer-Notes und `manifest.json` entfernen.

#### H3 — Öffentliche Releases bis 1.18.0 vs. eingereichte Version 1.6

**Belege**
- `gh api repos/VaZuLeS/Thunderbird-Antivirus/releases` → 18 Releases, alle **nicht** als Draft markiert, mit
  XPI-Assets: `v1.6` (`thundy-av-1.6.xpi`, 2026-09-28), `v1.6.1`, `v1.7.0`, `v1.7.1`, `v1.8.0` … `v1.17.0`, `v1.18.0`
  (`thundy-av-1.18.0.xpi`, 2026-09-29).
- Der geprüfte Stand (`main`, `ae2a08e`) hat `manifest.json:8` `"version": "1.6"`.
- `docs/store_listing.md:181` behauptet: „XPI built for 1.6 and attached to a release | **open** — the 1.6 artefact has
  not been built yet“ — nachweislich unzutreffend.
- `docs/index_en.html:77-78` / `docs/index_de.html:76-80` verweisen aktiv auf die Releases;
  `manifest.json:9` (`homepage_url`) zeigt auf diese Landing-Page.

**Auswirkung:** Wer der Homepage folgt, lädt ein 1.18.0-XPI, das von der eingereichten 1.6-Policy, den
Reviewer-Hinweisen und dem Listing nicht abgedeckt ist (die Release-Titel nennen zusätzliche, datenrelevante
Funktionen). Das ist ein Reputations- und Policy-Risiko unabhängig von der Store-Einreichung.

**Fix:** Releases/Tags oberhalb der eingereichten Version als Draft/experimentell markieren, die Angabe in
`docs/store_listing.md:181` korrigieren und in der Datenschutzerklärung die Version benennen, für die sie gilt.


#### H4 — Keine echten Store-Screenshots

**Belege:** `git ls-files docs/screenshots` → nur `inline_optin_banner.svg`, `options_page.svg`, `warning_banner.svg`;
`node scripts/pre-submit-checks.js` → `warning: no PNG/JPEG screenshots found in docs/`;
`docs/store_assets.md` §2 und §6 führen Screenshots als offen.

**Auswirkung:** Das ATN-Listing kann nicht vollständig befüllt werden; die Pre-Submit-Prüfung bleibt rot markiert.

**Fix:** Motive 1–3 laut `docs/screenshot_capture.md` in einer echten Thunderbird-Instanz aufnehmen (PNG, ≥ 1200 px
breit, ohne echte Nutzerdaten) und in `docs/screenshots/` ablegen. Motiv 2/3 setzen die unter H5 offene
Banner-Injektion voraus.

#### H5 — Live-Verifikation in Thunderbird 140 ESR steht aus

**Belege:** `docs/STATUS.md:54-58` und `docs/reviewer_notes.md:211-213` führen es selbst als Pflicht vor der
Einreichung. Betroffene Pfade: `injectIntoMessageDisplay()` (`background.js:113-126`, Fallback auf
`scripting.executeScript`) für Opt-in-Banner, Threat-Banner und Hover-Hinweis; Kontextmenü mit
`contexts: ["link"]` (`background.js:1741-1757`, in Thunderbird nicht dokumentiert); `permissions.request()` aus dem
Banner-Button heraus (`background.js:1936-1940`).

**Auswirkung:** Die Kernfunktionen sind nur mit gemockten APIs getestet. Schlagen sie in Thunderbird fehl, ist das
Add-on für den Reviewer nicht prüfbar (und die Screenshots nicht erstellbar).

**Fix:** Smoke-Test gegen TB 140 ESR (`npx web-ext run --firefox=/pfad/zu/thunderbird` bzw. `about:debugging`),
Testfälle aus `docs/reviewer_notes.md` durchspielen, Ergebnis in `docs/STATUS.md` dokumentieren.

#### H6 — `default_locale: en`, aber die Oberfläche ist hart deutsch (inkl. Sicherheitshinweis)

**Belege:** `manifest.json:6` `default_locale: "en"` mit englischen Manifest-Strings (`_locales/en/messages.json:2-3`);
beide Seiten fest deutsch (`popup.html:2`, `options.html:2`, `<html lang="de">`); deutsche Literale in der
Popup-Logik (`api.js`, u. a. der Consent-Hinweis); `browser.i18n.getMessage()` ausschließlich im Hintergrundskript
(`background.js:36-45`, `:978`, `:1108`), **0 Treffer** in `api.js`/`options.js`
(`grep -rn 'i18n' --include='*.js' --include='*.html' . --exclude='*.test.js'`).

**Auswirkung:** Nutzer mit englischer Spracheinstellung erhalten bei englischem Store-Namen und `default_locale: en`
eine deutsche Oberfläche — inklusive der sicherheitsrelevanten Zustimmungs- und Datenschutztexte im Popup. Das
`de`/`en`-Katalogpaar suggeriert fälschlich vollständige Zweisprachigkeit.

**Fix:** UI-Strings über `browser.i18n.getMessage()` auflösen (Muster `t()` existiert in `background.js:34-45`), oder
`default_locale: "de"` setzen und „German-only UI“ im Listing dokumentieren.



### 3.2 Mittel

#### M1 — Der aktive CI-Workflow deckt die Zusagen des Listings nicht

**Belege:** `.github/workflows/ci.yml:19-25` führt `npm ci`, `node ./scripts/pre-submit-checks.js`,
`node --test background.test.js` und `npx web-ext lint` aus — also **eine** von fünf Testdateien und kein
Build-/Paket-Gate. Vollständig vorbereitet ist der Lauf in `docs/ci/ci.yml` (npm test, Lint-Filter, `web-ext build` +
`verify-package.js`), konnte laut `docs/ci/README.md:10-26` aber nicht übernommen werden (Token ohne
`workflows`-Berechtigung). Das Listing behauptet dagegen: „Unit tests green (`npm test`) | executed in CI“
(`docs/store_listing.md:180`).

**Fix:** Workflow mit `workflows`-Berechtigung übernehmen (`cp docs/ci/ci.yml .github/workflows/ci.yml`) oder die
Listing-Aussage auf den tatsächlichen CI-Umfang präzisieren.

#### M2 — Die Paketprüfung prüft nur „nicht zu viel“, nicht „nicht zu wenig“

**Belege:** `scripts/verify-package.js` kennt `ALLOWED_FILES` (`:11-22`), `ALLOWED_PREFIXES` (`:23`), `FORBIDDEN`
(`:24-36`) und eine Größengrenze (`:37`, `:73-76`) — aber **keine** Assertion, dass Pflichtdateien im ZIP liegen.
Der Pre-Submit-Check prüft referenzierte Dateien nur auf der **Festplatte**, nicht im Artefakt. Zusätzlich
wirkungsloses Muster `'LICENSE/**'` in `web-ext-config.mjs:30` (matcht die Datei `LICENSE` nicht; sie ist im Paket,
was gewünscht ist — das Muster ist dennoch irreführend).

**Fix:** `REQUIRED`-Liste in `verify-package.js` (manifest.json, background.js, api.js, api_gateway.js, db.js,
options.html, options.js, popup.html, theme.css, `_locales/en|de/messages.json`, alle deklarierten Icons) und
fehlende Einträge als Fehler melden; Muster `'LICENSE/**'` entfernen.

#### M3 — Optional Host Permissions werden nicht in allen Netzwerkpfaden geprüft

**Belege:** `hasHostPermissionFor()` (`background.js:97-106`) wird nur an zwei Stellen benutzt:
`background.js:240` (`hasHybridPermission()` für den Banner-/Scan-Flow) und `background.js:1479` (VirusTotal-Datei).
Die übrigen Pfade prüfen ausschließlich `mayTransmitExternally()` bzw. `assertExternalAnalysisAllowed()`:
AbuseIPDB (`background.js:337-347`), VirusTotal-IP (`:357-370`), URLhaus (`:2298`), urlscan.io (`:2322`),
Hash-Overview (`:1497-1502`), Auto-Upload (`:1447`), `handleUrlScan()` (`:2163`), `handleManualUpload()` (`:2215`).

**Auswirkung:** Verweigert der Nutzer die (optionale) Origin-Berechtigung, laufen diese Aufrufe in einen Netzwerk-/
CORS-Fehler und werden nur geloggt, statt eine klare Meldung („Berechtigung fehlt“) zu zeigen. Ein Reviewer, der die
Berechtigung ablehnt, sieht dadurch schwer nachvollziehbares Verhalten.

**Fix:** Ein gemeinsamer Helper (`ensureProviderAccess(url)`), der Consent **und** Origin prüft, die Berechtigung per
`browser.permissions.request()` nachholt bzw. `permission_denied` zurückgibt, und diesen in allen Providerpfaden
verwenden.

#### M4 — `data_collection_permissions` ist `required`, obwohl das Modell Opt-in ist

**Belege:** `manifest.json:14-16` (`"required": ["personalCommunications"]`), Opt-in mit Default aus
(`background.js:64-72`, `:141`), `grep -rn 'data_collection' docs/reviewer_notes.md` → **0 Treffer**; die eigene
Voranalyse empfahl die `optional`-Liste (`docs/STORE_READINESS_ANALYSIS.md:62`, `:267`). Der Linter meldet zusätzlich
`KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` („`strict_min_version` requires Firefox for Android 140, which was
released before version 142 introduced support for
`browser_specific_settings.gecko.data_collection_permissions`“) — für ein reines Thunderbird-Add-on unkritisch, aber
im Review-Log sichtbar.

**Fix:** Kategorisierung begründen (die Verarbeitung betrifft Nachrichteninhalte und ist ohne Zustimmung deaktiviert)
und einen Absatz „Data collection declaration“ in `docs/reviewer_notes.md` ergänzen; `optional: []` explizit setzen.

#### M5 — Reviewer-Testanleitung verlangt ein Drittanbieter-Konto und deckt mehrere Permissions nicht ab

**Belege:** `docs/reviewer_notes.md:158-163` verlangt eine kostenlose Hybrid-Analysis-Registrierung, `:218-220`
schließt einen mitgelieferten Testschlüssel ausdrücklich aus. Die Testschritte `:165-205` decken weder den
Disarm-Download (`downloads`) noch die Benachrichtigungen (`notifications`) ab; `grep -n -i 'disarm|notification'
docs/reviewer_notes.md` findet Treffer nur in der Berechtigungstabelle.

**Auswirkung:** Zwei der fünf Pflicht-Permissions kann der Reviewer nicht selbst nachvollziehen — genau die Situation,
in der ATN nachfragt.

**Fix:** Abschnitt „Test without a provider account“ ergänzen (lokale Heuristiken, Banner-Opt-in, Cache leeren,
HTML-Disarm-Download, Benachrichtigung, Consent-Gate) und die Erwartung an einen Testschlüssel explizit formulieren.

#### M6 — Statusangaben in Listing und Asset-Dokument widersprechen sich

**Belege:** `docs/store_listing.md:173` („Icons … | done“) vs. `docs/store_assets.md:66` („Icon-Auflösungen:
**offen** — 32 px und 64 px nur in minimaler Qualität vorhanden“); `docs/store_listing.md:150` („Language of the user
interface | German (localisation not implemented yet)“) vs. `manifest.json:5-6` (`default_locale: en` mit
`_locales/en`/`_locales/de` und lokalisierten Manifest-Strings). Ist-Zustand: Icon-Dateien existieren in
16/32/48/64/128 px (PNG, Größen im Pre-Submit-Check verifiziert), Qualität „skizzenhaft“.

**Fix:** Eine Statusquelle wählen (Empfehlung: `docs/store_assets.md`), Listing-Zeilen darauf verweisen lassen und die
Sprachangabe auf „UI German only, manifest strings localized (en/de)“ korrigieren.

#### M7 — Datenschutzerklärung nennt nie kontaktierte Hosts

**Belege:** `docs/privacy_policy.md:128` („`hybrid-analysis.com`, `api.hybrid-analysis.com`“) und `:130`
(„`urlscan.io`, `www.urlscan.io`“). Das Host-Inventar der Laufzeitdateien ergibt für Hybrid Analysis real nur
`hybrid-analysis.com` (plus `www.hybrid-analysis.com` ausschließlich als Popup-**Link**) und für urlscan.io nur
`urlscan.io`. `api.hybrid-analysis.com` und `www.urlscan.io` werden nie adressiert.

**Fix:** Tabelle auf die tatsächlich kontaktierten Hosts reduzieren (oder nicht genutzte Hosts als „reserviert“
kennzeichnen).


### 3.3 Niedrig

- **N1 — `strict_min_version: "140.0"` zu verifizieren.** `manifest.json:13` schließt Thunderbird 128 ESR aus; ob die
  genutzten APIs (und `data_collection_permissions`) das erfordern, ist aus dem Repo nicht belegbar. Entscheidung
  samt Begründung in `docs/reviewer_notes.md` festhalten.
- **N2 — Versionsschreibweise.** `manifest.json:8` `1.6` vs. `package.json:3`/`CHANGELOG.md` `1.6.0`; der
  Pre-Submit-Check vergleicht tolerant. Eine Schreibweise wählen.
- **N3 — Toter Code.** `background.js:1392` (`return filtered;`) steht hinter dem `return urls.filter(...)` der
  Funktion `filterUrls()` und referenziert eine nicht existierende Variable — unerreichbar, aber irreführend.
- **N4 — Redundante Meta-CSP.** `popup.html:6` setzt `script-src 'self'` zusätzlich zur Manifest-CSP
  (`manifest.json:35-37`) und ohne `object-src 'none'`. Nicht schädlich, aber unsynchron.
- **N5 — Repo-Hygiene.** Versionierte Arbeitsnotizen `.jules/` und `.Jules/` (5 Dateien) liegen im Git;
  `web-ext-config.mjs:34-35` ignoriert nur `.jules` (nicht `.jules/**`). Das Paket ist empirisch sauber (17 Dateien),
  die Muster sollten es aber explizit bleiben.
- **N6 — Paketprüfung findet nur ZIP.** `scripts/verify-package.js:50` sucht `*.zip`; ein reines `.xpi`-Artefakt nach
  `web-ext sign` würde „No XPI/ZIP artifact found“ melden. Im vorbereiteten `docs/ci/release.yml` ist der Aufruf vor
  dem Signieren vorgesehen — bei Umsortierung anpassen.


---

## 4. Was bereits store-konform ist (mit Belegen)

- **Manifest MV3-konform und linter-sauber.** `npx web-ext lint --source-dir . --output json` → `errors 0`,
  `notices 0`, `warnings 26` (Exit 0, web-ext 10.7.0). Alle 26 Warnungen sind bekannte Thunderbird-False-Positives:
  24× `UNSUPPORTED_API` (nur TB-APIs), 1× `MANIFEST_PERMISSIONS` „Invalid permissions `messagesRead`“ (der
  Linter-Bundle enthält den String nicht, vgl. `scripts/filter-lint-warnings.js`), 1×
  `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` (kein Thunderbird-Android).
- **CSP restriktiv, kein Inline-Code, keine Remote-Ressourcen.** `manifest.json:35-37`
  (`script-src 'self'; object-src 'none'`); keine Inline-`<script>`, keine `onclick=`-Attribute, kein
  `eval`/`new Function`, kein `innerHTML` mit dynamischen Daten (einziger Treffer ist ein Kommentar,
  `background.js:984`); `theme.css` ohne `url()`/`@import`/`@font-face`.
- **Paketinhalt sauber.** `npx web-ext build` + `node scripts/verify-package.js` → 17 Laufzeitdateien, 179.276 Bytes,
  `Package content is valid.`; keine Tests, Docs, Lockfiles, `install.rdf`, `.jules`. Alle im Manifest referenzierten
  Dateien sind enthalten; Icon-PNGs haben exakt die deklarierten Kantenlängen (Pre-Submit-Check).
- **Kontrollierte Datenübermittlung im Hintergrundskript.** Jede Netzwerkfunktion ist über `mayTransmitExternally()`
  bzw. `assertExternalAnalysisAllowed()` (`background.js:64-72`) abgesichert; Auto-Upload verlangt zusätzlich
  Berechtigung, Sender-Opt-in, API-Key und Consent (`background.js:1260-1263`); die Privacy-Tiers greifen in den
  automatischen Pfaden (`background.js:775`, `:1438`).
- **Lokalisierungskataloge vollständig und schlüsselgleich.** `_locales/en` und `_locales/de` haben je 25 Keys,
  keine einseitigen Keys; alle `__MSG_*__`-Platzhalter und alle 16 `i18n`-Keys des Hintergrundskripts sind abgedeckt.
- **Zugänglichkeit der Optionsseite.** Alle 13 Formular-Controls haben `<label for=…>` plus `aria-describedby`,
  Statusmeldungen nutzen `role="status"`/`aria-live`, externe Links `rel="noopener noreferrer"` mit erklärendem
  `aria-label`, Fokusringe in `theme.css:102-109`.
- **Datenschutzerklärung öffentlich erreichbar.** `curl -o /dev/null -w '%{http_code}'` → `200` für
  `https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html` (identisch mit dem Link in
  `options.html:45`) und für die Landing-Pages; der Pre-Submit-Check meldet „privacy policy is linked from 3 landing
  page(s)“.
- **Keine Secrets, keine Telemetrie, keine Fremdhosts im Paket.** Das Host-Inventar der Laufzeitdateien enthält
  ausschließlich die fünf deklarierten Analyse-Provider plus Doku-/Popup-Links; keine Analytics- oder CDN-Aufrufe.
- **Testlage und Tooling.** `npm test` → 394 Tests, 0 Fehler; Pre-Submit-Checks mit echtem Exit-Code; CI-Pins
  (`actions/checkout@v7`, `actions/setup-node@v7`) existieren.

---

## 5. Vor der Einreichung manuell zu erledigen (Checkliste)

| # | Aufgabe | Bezug |
|---|---|---|
| 1 | Popup-Consent-Gate live gegentesten (Consent aus ⇒ Popup auf einer zuvor gescannten Nachricht zeigt nur den Hinweis, kein Netzwerkaufruf) | Abschnitt 2 |
| 2 | H1 entscheiden und umsetzen (Tier-Prüfung im manuellen Pfad **oder** dokumentierte Ausnahme in Policy/Listing/Reviewer-Notes) | H1 |
| 3 | H2 umsetzen (Klick-Handler implementieren und `autoScanLinks` auswerten **oder** Claims und urlscan.io-Origin entfernen) | H2 |
| 4 | H3: Releases oberhalb 1.6 als Draft/experimentell markieren, Policy auf die eingereichte Version beziehen | H3 |
| 5 | H5: Smoke-Test in Thunderbird 140 ESR (Banner-Injektion, `message_display_action`-Menü, `contexts: ["link"]`, `permissions.request()` aus dem Banner) und Ergebnis in `docs/STATUS.md` dokumentieren | H5 |
| 6 | H4: Screenshots in einer echten Instanz aufnehmen (PNG, ≥ 1200 px) und in `docs/screenshots/` ablegen — danach verschwindet die Pre-Submit-Warnung | H4 |
| 7 | Signieren und hochladen: `npx web-ext sign --channel listed` (Secrets `ATN_API_KEY`/`ATN_API_SECRET`), Listing aus `docs/store_listing.md` füllen, Privacy-Policy-URL angeben | – |

**Nicht aus dieser Umgebung prüfbar:** das Verhalten in Thunderbird selbst (kein TB-Binary vorhanden), eine eventuell
bestehende ATN-Listung (`addons.thunderbird.net` antwortet mit Cloudflare 403) sowie die Thunderbird-eigene
Manifest-Dokumentation zu `data_collection_permissions` (`webextension-api.thunderbird.net` → 404).

---

## 6. Reproduzierbare Kommandos (Stand dieses Reviews)

```bash
npm ci
node scripts/pre-submit-checks.js                                    # Exit 0, 1 Warnung (fehlende Screenshots)
npm test                                                             # 394 Tests, 0 Fehler
npx web-ext lint --source-dir . --output json > /tmp/lint.json       # 0 Fehler / 26 Warnungen
node scripts/filter-lint-warnings.js /tmp/lint.json                  # "all of them known Thunderbird false positives"
npx web-ext build --source-dir . --artifacts-dir /tmp/atnbuild
node scripts/verify-package.js /tmp/atnbuild                          # 17 Dateien, 179276 Bytes, "Package content is valid."
gh api repos/VaZuLeS/Thunderbird-Antivirus/releases --jq '.[] | "\(.tag_name) draft=\(.draft)"'
```

Consent-Reproduktion (Wegwerf-Harness, lädt `api.js` in einer `vm`-Umgebung mit gemockter `browser`-API und einem
`fetch`-Spion):

```
consent=false -> fetch calls: 0 []      # nach dem Fix; vorher: 1 Aufruf auf /api/v2/overview/deadbeef
consent=true  -> fetch calls: 1 [ 'https://hybrid-analysis.com/api/v2/overview/deadbeef' ]
```

---

## 7. Änderungen in diesem Branch

| Datei | Änderung |
|---|---|
| `api.js` | Consent-Gate für alle externen Report-Abfragen (Modul-Scope `externalAnalysisConsent`, `mayFetchExternalReports()`, Abbruch mit `EXTERNAL_ANALYSIS_DISABLED`, Hinweis-Card, kein Scheduling ohne Zustimmung) |
| `api.test.js` | 3 Regressionstests für das Consent-Gate; Zustimmung in bestehenden Report-Tests explizit gesetzt |
| `popup.html` | Fenstertitel und Überschrift auf „Thundy AV – E-Mail-Scanner“ (Altname aus 1.5 entfernt) |
| `scripts/pre-submit-checks.js` | Neuer Check: sichtbare Produktnamen (`<title>`/`<h1>`) dürfen nicht mit „Thunderbird“ beginnen |
| `scripts/pre-submit-checks.test.js` | 2 neue Tests für den UI-Namens-Check |
| `docs/store_listing.md` | Unzutreffende XPI-Statuszeile korrigiert |
| `docs/reviewer_notes.md` | VirusTotal-Origin an `manifest.json` angeglichen |
| `docs/STATUS.md`, `CHANGELOG.md` | Status/Testzahlen aktualisiert, Verweis auf dieses Dokument |
| `docs/STORE_READINESS_REVIEW.md` | Dieses Dokument |

**Urteil für die Einreichung:** Nach dem Fahrplan in Abschnitt 5 ist das Add-on einreichungsreif. Ohne die Punkte
1–6 ist mit Nachfragen bzw. Ablehnung zu rechnen — H2 (beworbene Funktionen ohne Implementierung) und H3
(Version/Policy-Diskrepanz) sind die kritischsten verbleibenden Punkte, H1 ist eine Entscheidung des Maintainers.

