# Problemanalyse – Store-Readiness „Thundy AV“ für den Thunderbird Add-ons Store (ATN)

**Auftrag:** Analyse der Thunderbird-Erweiterung „Thundy AV – Email Scanner for Thunderbird“ auf ihre
Readiness für eine Listung im Mozilla-Thunderbird-Add-ons-Store (`addons.thunderbird.net`, ATN).
**Ergebnis dieser Datei:** die Problemanalyse (Befunde + Nachweise). Der daraus abgeleitete
Aufgabenplan steht in [AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md).

| Feld | Wert |
|---|---|
| Prüfgegenstand | Repository `VaZuLeS/Thunderbird-Antivirus`, Branch-Basis `main`, Commit `ae2a08e` |
| Add-on-Version | 1.6 (Manifest V3, `strict_min_version` 140.0) |
| Zielplattform | ATN – Listung (Signatur-Kanal `listed`) und ggf. `unlisted` |
| Werkzeuge | `npm ci`, `npm test` (Node v24.21.0), `scripts/pre-submit-checks.js`, `web-ext` 10.7.0 (`lint`, `build`, `sign --help`), `scripts/verify-package.js`, statische Codeanalyse, Abgleich mit Primärquellen (Thunderbird-API-Referenz, Mozilla Add-on-Policies, MDN) |
| Datum | Prüflauf im Sandbox-Checkout des Repositories (Version 1.6) |

> Diese Analyse ist eine **Neuaufnahme für Version 1.6**. Die ältere, auf Version 1.5 basierende
> Analyse in [STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md) ist als historische
> Baseline weiterhin gültig, wird hier aber nicht wiederholt: Sie enthält den Fix-Nachweis für die
> damaligen Blocker (MV2→MV3-Portierung, Paketbereinigung, Trademark-Name, Privacy-Policy). Hier
> stehen ausschließlich **neue, am aktuellen Stand reproduzierte Befunde**.

---

## 1. Zielbild „Store-ready“

Ein Add-on gilt hier erst als store-ready, wenn **alle** folgenden Tore erfüllt sind:

| Tor | Kriterium |
|---|---|
| T1 Funktionsnachweis | Die Kernfunktion ist in der Ziel-Thunderbird-Version (140 ESR) **manuell** nachgewiesen, nicht nur mit gemockten APIs. |
| T2 Policy-Konformität | Mozilla Add-on-Policies erfüllt: Beschreibung ≠ Überraschung, Datenweitergabe korrekt deklariert und kontrollierbar, keine Remote-Code-Ausführung, min. Rechte. |
| T3 Technische Validierung | Build, Paketinhalt und Linter fehlerfrei; Manifest vollständig und MV3-konform. |
| T4 Listing-Reife | Titel, Summary, Beschreibung (EN), Screenshots, Kategorie, Support- und Privacy-URL, Releasenotes vorhanden. |
| T5 Reviewer-Bedienbarkeit | Testanleitung, Testdaten und – wenn nötig – Test-Zugangsdaten liegen dem Review bei. |
| T6 Release-Fähigkeit | Signierter Build (`.xpi`) für die Zielversion über den **ATN**-Endpunkt erzeugt und Hochlade-/Signierprozess dokumentiert. |

---

## 2. Verifizierter Ist-Zustand (Nachweise)

Alle Zeilen wurden in diesem Checkout ausgeführt bzw. gemessen.

| Prüfung | Kommando / Quelle | Ergebnis |
|---|---|---|
| Dependency-Installation | `npm ci` | erfolgreich, 0 Vulnerabilities |
| Unit-Tests | `npm test` | **389 Tests, 65 Suites, 0 Fehler**, Exit 0 |
| Pre-Submit-Checks | `npm run pre-submit-checks` | 12× `ok`, **1 Warnung** („no PNG/JPEG screenshots found in docs/“), Exit 0 |
| Linter | `npx web-ext lint --source-dir .` | **0 Fehler, 26 Warnungen, 0 Notices** |
| Paketbau | `npx web-ext build --source-dir . --artifacts-dir ./build` | `thundy_av_email_scanner_for_thunderbird-1.6.zip` |
| Paketinhalt | `node scripts/verify-package.js ./build` | gültig, **17 Dateien, 179.276 Bytes** entpackt |
| Privacy-Policy öffentlich | `curl https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html` | HTTP 200, Inhalt = Version 1.6 |
| Landing-Page öffentlich | `curl https://vazules.github.io/Thunderbird-Antivirus/` | HTTP 200 |
| Lokalisierung Manifest | `_locales/en|de/messages.json` | je 25 Keys, Schlüsselmengen identisch, alle verwendeten Keys vorhanden |
| Remote-Code / `eval` | `grep -rn "innerHTML|eval(|new Function"` in allen Laufzeitdateien | **keine Treffer** |
| MV3-API-Portierung | `background.js:1216-1235, 1731-1737`, `api.js:70-78` | `getDisplayedMessages()` / `onMessagesDisplayed` implementiert, MV2-Aufrufe nur noch als Fallback |
| ATN-API-Kontextmenü | Thunderbird `menus`-Referenz (`ContextType`) | `message_display_action` (TB 89+) und `link` sind **dokumentierte** Kontexte |
| Signierweg | `npx web-ext sign --help`, `node_modules/web-ext/lib/program.js:19` | `--amo-base-url` default = `https://addons.mozilla.org/api/v5/`; **keine Thunderbird-Autoerkennung** |

---

## 3. Gesamturteil

| Bereich | Bewertung | Kurzbegründung |
|---|---|---|
| Funktionsnachweis in Thunderbird (T1) | 🔴 **Blocker** | keine Verifikation in einer echten Installation; Kern-UI-Pfade unbewiesen |
| Datenschutz/Policy (T2) | 🟠 **hoch** | Consent- und Daten-Deklaration nicht widerspruchsfrei belegt |
| Technische Validierung (T3) | 🟢 **gut** | 0 Fehler in Tests, Checks und Linter; Paket sauber |
| Listing-Reife (T4) | 🔴 **Blocker** | keine echten Screenshots, Listing nicht final, kein Store-Eintrag |
| Reviewer-Bedienbarkeit (T5) | 🟠 **hoch** | keine Testmittel/Testdaten für die externe Analyse |
| Release-Fähigkeit (T6) | 🔴 **Blocker** | kein 1.6-Artefakt; dokumentierter Signierbefehl zielt auf AMO statt ATN |

**Ergebnis: Das Add-on ist noch NICHT store-ready.** Die technische Basis ist in gutem Zustand – der
Store-Readiness-Status hängt derzeit an **Nachweisführung (T1/T2/T5), Listing-Assets (T4) und
Release-Prozess (T6)**, nicht an einem kaputten Build.

**Befundzählung:** 5 Blocker (P0), 6 hohe Risiken (P1), 6 mittlere Punkte (P2), 1 kleiner Punkt (P3).
Die Zuordnung Befund → Aufgabe steht in der Traceability-Matrix des Aufgabenplans.

---

## 4. Befunde – Blocker (P0)

### P0-1 – Kernfunktion ist in Thunderbird 140 ESR nicht nachgewiesen
**Belege**
- `README.md` („Known limitations“): *„the banner injection … has not yet been verified by hand in
  Thunderbird 140 ESR“*.
- `docs/STATUS.md`, Abschnitt „Remaining“: Banner-Injektion, `message_display_action`-Kontextmenü und
  Time-of-Click-Hinweis sind nur durch Unit-Tests mit gemockten Thunderbird-APIs abgedeckt;
  `docs/reviewer_notes.md` §9 listet dasselbe als offen.
- `background.js:113-126` (`injectIntoMessageDisplay`): Schlägt die Injektion fehl, wird **nur**
  `Logger.warn(...)` geschrieben und `null` zurückgegeben – der Nutzer sieht nichts.
- `background.js:117-119`: Der „bevorzugte“ Zweig `browser.scripting.messageDisplay.executeScript`
  existiert in der Thunderbird-API-Referenz **nicht** (`scripting.messageDisplay` hat nur
  `getRegisteredScripts`, `registerScripts`, `unregisterScripts`). Der Zweig ist toter Code.

**Regel/Prüfmaßstab**
- Mozilla Add-on-Policies 3 („Submission Guidelines“): *„Add-ons must function only as described.
  During review, the add-on undergoes basic functional testing.“*
- Thunderbird-Doku zu `scripting.messageDisplay.registerScripts` (TB 128+): *„Registered scripts will
  only be applied to newly opened messages. To apply the script to already open messages, manually
  inject your script by calling `executeScript(injection)` for each of the open messageDisplay tabs.“*

**Einordnung (wichtig für die Priorisierung):** Der offizielle Hinweis belegt, dass der generische
`scripting.executeScript`-Aufruf auf Nachrichtenansichts-Tabs der *vorgesehene* Weg für bereits
geöffnete Nachrichten ist. Der Ansatz in `injectIntoMessageDisplay()` ist damit **nicht** grundsätzlich
falsch – er ist aber **unverifiziert**, und der einzige Fehlerkanal ist ein Logeintrag. Offene
Detailfragen für den Live-Test: Wirkt `executeScript` mit `target.tabId` ohne Host-Berechtigung für den
Nachrichtenansichts-Tab? Greift die Injektion früh genug, damit das Banner sichtbar wird? Funktioniert
`browser.i18n.getMessage()` im injizierten Kontext?

**Auswirkung ohne Klärung:** Ablehnung/Nachbesserungsschleife wegen „nicht wie beschrieben
funktionierend“; im schlechtesten Fall ein freigegebenes Add-on, dessen Opt-in-Banner nie erscheint.

---

### P0-2 – Es existieren keine echten Screenshots
**Belege**
- Pre-Submit-Regel meldet: `warning: no PNG/JPEG screenshots found in docs/`
  (`scripts/pre-submit-checks.js`, Screenshot-Check).
- `docs/screenshots/` enthält ausschließlich `inline_optin_banner.svg`, `options_page.svg`,
  `warning_banner.svg` – keine PNG-/JPEG-Aufnahme.
- `docs/store_assets.md` §2/§6 und `docs/store_listing.md` §7 führen „Real screenshots“ als **offen**.

**Prüfmaßstab:** Tor T4. Der Store-Listing-Prozess erwartet Screenshots der realen Oberfläche; ohne sie
ist das Listing unvollständig. (Die Mozilla-Policy verlangt Screenshots nicht technisch, das Projekt und
die Listing-Qualität aber schon.)

**Zusatzabhängigkeit:** Motiv 2 (Opt-in-Banner) und Motiv 3 (Warnbanner) sind überhaupt erst
aufnehmbar, **nachdem** P0-1 bestätigt ist – die Screenshots dokumentieren sonst ein Verhalten, das
niemand gesehen hat.

### P0-3 – Keine Reviewer-Testmittel / Testdaten für die externe Analyse
**Belege**
- `docs/reviewer_notes.md` §9: *„No dedicated reviewer test key is included: the API key required for a
  full end-to-end run is the reviewer's own free provider account.“*
- Ohne Anbieter-Schlüssel überspringt der Code jede externe Analyse; prüfbar bleibt dann nur die lokale
  Bewertung und das Banner.
- Es gibt keinen dokumentierten Testdatensatz (Testnachricht mit Anhang/Link, unkritische
  Absenderadressen) und kein Test-Skript für Reviewer.

**Regel:** Mozilla Add-on-Policies 3: *„the add-on author must provide testing information and, if an
account is needed for any part of the add-on's functionality, testing credentials to allow use of the
add-on.“*

**Auswirkung:** Reviewer kann die Kernfunktion (Hash-Abfrage, Upload, Banner-Flows) nicht end-to-end
testen → Ablehnung oder Rückfrageschleife.

---

### P0-4 – Daten-Deklaration und Consent-Nachweis sind nicht widerspruchsfrei
**Belege**
- `manifest.json:14-17`: `data_collection_permissions` deklariert `"required": ["personalCommunications"]`.
- Tatsächliches Verhalten: Übermittlung nur nach **Opt-in** (`externalAnalysisConsent`, Default aus;
  erzwungen über `mayTransmitExternally()` / `assertExternalAnalysisAllowed()`, `background.js:60-73`),
  Default-Tier `strict` (`background.js:135`).
- Thunderbird-API-Referenz (`permissions`-API, Typ `CommonDataCollectionPermission`): *„Unlike Firefox,
  Thunderbird does not use the built-in onboarding flow that prompts users to opt into data collection.
  In Thunderbird, add-ons must request consent explicitly, for example by adding a checkbox on the
  options page or by showing a popup. The application does not provide an automatic prompt.“*
- MDN zu `browser_specific_settings.gecko.data_collection_permissions`: `required` = Daten, deren
  Erhebung für den Betrieb **zwingend** zu akzeptieren ist (`none` oder eine Liste); `optional` = Daten,
  in die der Nutzer einwilligen **kann** (über `permissions.request({ data_collection: [...] })`).

**Regel/Prüfmaßstab**
- Mozilla Add-on-Policies 6.2.1: *„It must accurately state the data collection practices in the
  extension manifest“* – die Deklaration muss die Praxis **akkurat** abbilden.
- Policies 6.2.2: Für Add-ons ohne eingebautes Consent-System muss die Kontrolle *„immediately after
  installation“*, *„unmissable“* und auf *„a single page“* erfolgen; Popups gelten als abzulehnendes
  Muster („will result in a rejection“).

**Bewertung:** `required` behauptet eine Pflicht-Datenweitergabe, während das Add-on tatsächlich eine
freiwillige, standardmäßig **deaktivierte** Weitergabe implementiert. Da Thunderbird keinen
automatischen Installations-Prompt zeigt, entscheidet allein die eigene Consent-UI über die
Policy-Konformität – und diese liegt derzeit in der Optionsseite („manuell aufsuchen“) statt in einem
unübersehbaren Erstlauf-Dialog.

**Auswirkung:** Risiko einer Ablehnung wegen irreführender Datendeklaration (6.2.1) und/oder fehlender
unmittelbarer Nutzerkontrolle (6.2.2).

---

### P0-5 – Es existiert noch keine Store-Präsenz (Prozessblocker)
**Belege**
- `README.md` / `README.de.md`: *„the add-on is not listed in the Thunderbird Add-ons Store yet, so
  there is no store URL“*.
- `docs/store_listing.md` §7: „Submitted to the Thunderbird Add-ons Store → **open**“.
- Kein Release-Tag/-Artefakt für 1.6 im Repository; der Build dieses Laufs ist ein lokales
  Wegwerf-Artefakt.
- Es gibt kein ATN-Entwicklerkonto mit hinterlegten Listing-Metadaten und keinen
  `ATN_API_KEY`/`ATN_API_SECRET` (die Secrets sind im Repo korrekt **nicht** vorhanden).

**Auswirkung:** Ohne Konto, API-Schlüssel und finales Listing kann die Einreichung nicht gestartet
werden – unabhängig davon, wie gut der Code ist. Dieser Punkt ist rein organisatorisch, blockiert aber
jeden technischen Fortschritt am Ende der Kette.

---

## 5. Befunde – hohe Risiken (P1)

### P1-6 – Der dokumentierte Signierweg zielt auf addons.mozilla.org (AMO), nicht auf ATN
**Belege**
- `npx web-ext sign --help` (web-ext 10.7.0) weist `--amo-base-url` mit **Default
  `https://addons.mozilla.org/api/v5/`** aus.
- `node_modules/web-ext/lib/program.js:19`: `export const AMO_BASE_URL = 'https://addons.mozilla.org/api/v5/'`.
- `grep -rin thunderbird node_modules/web-ext/lib/` → **kein Treffer**: web-ext erkennt ein
  Thunderbird-Add-on nicht automatisch und wählt keinen ATN-Endpunkt.
- Betroffene Stellen, die `web-ext sign` **ohne** `--amo-base-url` aufrufen:
  `docs/ci/release.yml:40`, `docs/STATUS.md:45,62`, `docs/quickstart.md:65-66`,
  `docs/ci/README.md:8`.

**Auswirkung:** Ein Ausführen des dokumentierten Befehls lädt die Thunderbird-XPI bei **AMO** hoch –
mit einer API-Key-Kombination, die für ATN gedacht ist. Das Ergebnis ist mindestens ein Fehlschlag
(AMO validiert u. a. das Thunderbird-Permission `messagesRead` und die `messages.*`-APIs als unbekannt),
schlimmstenfalls ein versehentlicher AMO-Upload. Die Signierung für ATN erfordert
`--amo-base-url https://addons.thunderbird.net/api/v5/` (bzw. `WEB_EXT_AMO_BASE_URL`).

**Ergänzend:** `docs/ci/release.yml` ist außerdem **nicht aktiv** (siehe P1-7), sodass dieser Fehler
bisher nicht aufgefallen ist.

---

### P1-7 – Die aktive CI deckt den Qualitätsanspruch des Repositories nicht ab
**Belege**
- `.github/workflows/ci.yml:23` führt `node --test background.test.js` aus – **nur eine von sieben**
  Testdateien (`api.test.js`, `api_gateway.test.js`, `background.test.js`, `db.test.js`,
  `options.test.js`, `form_test.js`, `vt_test.js` sowie `scripts/pre-submit-checks.test.js` bleiben
  ungenutzt).
- `.github/workflows/ci.yml:25` führt `npx web-ext lint` **ohne** den Filter
  `scripts/filter-lint-warnings.js` aus; der Kommentar *„Optional: add web-ext build and XPI packing
  steps in release workflows“* steht noch am Dateiende.
- Die vollständige Fassung liegt als **Spiegel** in `docs/ci/ci.yml` (diff gegen die aktive Datei:
  `npm run pre-submit-checks`, `npm test`, Lint-Filter, `web-ext build` + `verify-package.js`) und
  wird laut `docs/ci/README.md` nicht nach `.github/workflows/` übernommen.
- `docs/ci/release.yml` (Signierjob) ist ebenfalls nur ein Spiegel.

**Auswirkung:** Regressionen in `api.js`, `db.js`, `options.js` oder `api_gateway.js` werden von der
CI nicht erkannt; der Paketinhalt (Bereinigung des XPI, `verify-package.js`) wird bei Pull Requests
nie geprüft. Tor T3 ist damit nur lokal, nicht kontinuierlich abgesichert.

---

### P1-8 – Kein Release-Artefakt und kein Tag für Version 1.6
**Belege**
- `docs/store_listing.md` §7: „XPI built for 1.6 and attached to a release → **open** – the 1.6 artefact
  has not been built yet“.
- `CHANGELOG.md` führt 1.6.0 als released, `manifest.json:8` = `1.6`; ein zugehöriges
  GitHub-Release/Tag existiert im Checkout nicht.
- Der lokale Build erzeugt lediglich
  `build/thundy_av_email_scanner_for_thunderbird-1.6.zip` (nicht versioniert, `.gitignore`).

**Auswirkung:** Der Store verlangt ein reproduzierbares, signiertes Artefakt der eingereichten
Version; ohne Release-Nachweis ist die Version nicht belegbar. Für Nutzer außerhalb des Stores fehlt
der Download-Pfad, auf den `docs/index_*.html` verweist („GitHub releases“).

---

### P1-9 – Oberfläche ist nur deutsch; das Listing ist englisch
**Belege**
- `manifest.json:4` `default_locale: en`; `_locales/en|de` vorhanden und vollständig (je 25 Keys,
  identische Schlüsselmengen – geprüft).
- `options.html:2` `<html lang="de">`, `popup.html:2` `<html lang="de">`; alle Labels sind hart deutsch.
- `docs/store_listing.md` §5 (Listing-Metadaten): *„Language of the user interface | German (localisation
  not implemented yet)“*.
- `README.md`: *„the options page and the popup are currently German only“*.

**Bewertung:** Der Manifest-Name, die Beschreibung und die Bannertexte sind zweisprachig – die Flächen,
die Reviewer und Nutzer im Listing zuerst sehen (Optionsseite, Popup), sind es nicht. Für ein Listing,
dessen Hauptbeschreibung englisch ist, ist das eine Inkonsistenz, die Review-Rückfragen und
Nutzerbeschwerden erzeugt. Die Store-Anforderung „Make it local“ (Listing-/Marktplatzkonvention)
ist damit nur halb erfüllt.

**Auswirkung:** Kein technischer Blocker, aber ein reales Ablehnungs-/Rückfrage- und Supportrisiko;
mindestens muss die Sprachangabe im Listing korrekt sein.

---

### P1-10 – MV2-Altpfade und Linter-Warnungen erschweren das Review
**Belege**
- `background.js:1227-1229` (`getDisplayedMessage`) und `background.js:1734-1737`
  (`onMessageDisplayed`) sind Fallbacks für APIs, die in Thunderbird MV3 **nicht mehr existieren**.
- `background.js:117-119`: `scripting.messageDisplay.executeScript` wird per `typeof` geprüft, existiert
  laut API-Referenz aber nicht → unerreichbarer Zweig (siehe P0-1).
- `api.js:76-78`: derselbe MV2-Fallback.
- `npx web-ext lint`: **26 Warnungen**, darunter `MANIFEST_PERMISSIONS` („Invalid permissions
  `messagesRead`“), 24 `UNSUPPORTED_API`-Hinweise und
  `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`.
- `scripts/filter-lint-warnings.js` toleriert genau diese Codes; die aktive CI nutzt den Filter nicht
  (P1-7).

**Bewertung:** Toter Code, der in einem Review erklärt werden muss, und Linter-Ausgaben, die im
ATN-Validierungsbericht wieder auftauchen. Jede Warnung braucht eine nachvollziehbare Begründung
(der Filter liefert sie bereits, sie ist nur nicht überall verlinkt).

**Auswirkung:** Erhöhter Erklärungsaufwand im Review, Fehlinterpretationsrisiko
(„unsupported API“ ≠ funktionsfähig), erschwerte Regression bei der nächsten TB-Version.

---

### P1-11 – Fehler in den Kern-UI-Pfaden bleiben unsichtbar
**Belege**
- `background.js:122-125`: Injektionsfehler werden verschluckt (`Logger.warn`), Rückgabewert `null`.
- `background.js:1936-1942`: Schlägt `browser.permissions.request()` fehl (u. a. weil eine User-Geste
  über `runtime.sendMessage` nicht garantiert erhalten bleibt), liefert der Handler nur
  `{ success: false, error: 'permission_denied' }`; im Banner wird lediglich der Button-Text ersetzt.
- `options.js:139-147`: `permissions.request()` wird in einer Schleife je Anbieter aufgerufen; Fehler
  werden nur geloggt (`console.error`).

**Bewertung:** Genau die Pfade, die P0-1 verifizieren soll, haben keine sichtbare Fehlerrückmeldung und
keine Testnaht. Ein Reviewer, bei dem das Banner ausbleibt, sieht nur eine stumme Oberfläche.

**Auswirkung:** Nicht diagnostizierbare Fehlermeldungen in Review und Support; erschwert den ohnehin
anstehenden Live-Test.

---

## 6. Befunde – mittlere Punkte (P2)

### P2-12 – Dokumentationsdrift gegenüber dem gemessenen Stand
**Belege**
- `docs/STATUS.md:33` behauptet „15 Dateien (≈176 KB)“; gemessen: **17 Dateien, 179.276 Bytes**
  (`node scripts/verify-package.js ./build`). Ursache ist ein unvollständiger Erwartungswert in der
  Dokumentation, nicht im Paket (die Dateiliste ist korrekt und enthält u. a. `LICENSE`).
- `docs/quickstart.md` §3 nennt `content_script.test.js` als Testdatei – die Datei existiert nicht
  (entfernt laut `CHANGELOG.md` 1.6.0, „Toter Code entfernt“). Real vorhanden: `api.test.js`,
  `api_gateway.test.js`, `background.test.js`, `db.test.js`, `options.test.js`, `form_test.js`,
  `vt_test.js`, `scripts/pre-submit-checks.test.js`.
- `CONTRIBUTING.md:8-9` behauptet *„there is no `npm run lint` script“*, während
  `package.json` `"lint": "web-ext lint --source-dir ."` definiert.
- `docs/ci/ci.yml` kennt den Schritt `npm run pre-submit-checks`, die aktive CI ruft das Skript direkt
  auf (siehe P1-7).

**Auswirkung:** Nachweis-Dokumente widersprechen dem prüfbaren Stand. Genau das untergräbt das in
`CONTRIBUTING.md` formulierte Prinzip „All statements in the documentation should be verifiable against
the code“.

---

### P2-13 – Reviewer-Hinweise nennen einen Origin, den das Manifest nicht deklariert
**Belege**
- `docs/reviewer_notes.md` §2.2: VirusTotal wird mit **`https://virustotal.com/*` und
  `https://*.virustotal.com/*`** als angefragter Origin angegeben.
- `manifest.json:26-34` deklariert nur `https://*.virustotal.com/*`.
- `background.js:79` (`PROVIDER_ORIGINS.virustotal`) und `options.js:132` verwenden
  `https://www.virustotal.com/*`; `api_gateway.js` ruft `https://www.virustotal.com/api/...` auf.

**Bewertung:** Inhaltlich funktioniert der Flow (der angefragte Origin ist von
`https://*.virustotal.com/*` abgedeckt, siehe P1-Kontext MDN: `optional_host_permissions` ist ab
Firefox/Thunderbird 128 der empfohlene Weg), aber die Reviewer-Dokumentation ist **nicht deckungsgleich**
mit dem Manifest. Ein Reviewer prüft genau diese Tabelle gegen `manifest.json`.

**Auswirkung:** Rückfrage/Begründungsaufwand; im schlechten Fall Zweifel an der Sorgfalt der
Rechte-Deklaration.

---

### P2-14 – Listing-Metadaten sind noch nicht final
**Belege**
- `docs/store_listing.md` ist ein Entwurf; Kategorie ist als Vorschlag („Privacy & Security“, sonst
  „Miscellaneous“) markiert, Keywords/Tags fehlen, Releasenotes für 1.6 sind formulierte Fließtexte ohne
  Zuordnung zu den ATN-Feldern.
- `docs/store_listing.md` §5: „Language of the user interface | German (localisation not implemented yet)“.
- Summary (EN) ist mit 158 Zeichen vorhanden und liegt unter dem 250-Zeichen-Limit des Entwurfs;
  die Manifest-Beschreibung (117 Zeichen, `_locales/en/messages.json`) passt ebenfalls.

**Auswirkung:** Ohne finalisierte Felder (Kategorie, Tags, Support-URL, Lizenzangabe, Releasenotes)
kann das Listing nicht konsistent ausgefüllt werden.

---

### P2-15 – `strict_min_version: 140.0` schließt ältere ESR-Versionen aus
**Beleg:** `manifest.json:13`.
**Bewertung:** Die Festlegung ist plausibel (MV3-APIs und `data_collection_permissions` erfordern
Thunderbird 140+), sie ist aber eine **bewusste Kompatibilitätsentscheidung**, die im Listing
(„Select the right platforms and versions“) und im Antwortkatalog für Reviewer-Rückfragen stehen muss.
**Auswirkung:** Falsche Nutzererwartung an älteren ESR-Versionen, wenn die Angabe im Listing fehlt.

---

### P2-16 – Zwei Netzwerkpfade umgehen das zentrale Timeout/Fehler-Handling
**Belege**
- `background.js:1447`: `await fetch(uploadOptions.url, uploadOptions)` (Datei-Upload zu Hybrid Analysis)
  umgeht `apiGateway.fetchWithTimeout`.
- `api.js:530`: dito im Popup.
- Alle übrigen Aufrufe laufen über `api_gateway.js:45` (`fetchWithTimeout`, 15 s Standard, 60 s Upload).

**Auswirkung:** Ein hängender Upload blockiert den Flow ohne Timeout; Diagnose und Verhalten
unterscheiden sich je Pfad – unschön für ein Add-on, das „keinen Server des Entwicklers“ verspricht und
mit API-Ratenlimits umgehen muss.

---

## 7. Befunde – kleine Punkte (P3)

### P3-17 – Doppelte Ignore-Konfiguration ohne Abgrenzung
`web-ext-config.mjs` (`ignoreFiles`) und `.webextignore` pflegen überlappende, aber nicht identische
Musterlisten; `web-ext` liest `.webextignore` nicht, das Paket wird ausschließlich über
`web-ext-config.mjs` bestimmt (belegt durch den korrekten Paketinhalt aus
`verify-package.js`). Die Datei ist damit ohne Funktion und suggeriert eine zweite Quelle der Wahrheit.
**Auswirkung:** Wartungsrisiko bei künftigen Paketänderungen.

---

## 8. Positivnachweise (bereits store-tauglich)

Diese Punkte sind **verifiziert in Ordnung** und müssen nicht „gefixt“ werden – sie sind die Grundlage
dafür, dass der Rest in kurzer Zeit erledigt werden kann:

- **Technische Validierung (T3) erfüllt:** 389 Tests / 0 Fehler, Pre-Submit-Checks mit echtem Exit-Code,
  `web-ext lint` mit 0 Fehlern, Paketinhalt geprüft (17 Dateien, keine Tests/Doku/Lockfiles im XPI).
- **Kein Remote-Code:** keine `eval`/`new Function`/`innerHTML`-Verwendung in den Laufzeitdateien;
  CSP `script-src 'self'; object-src 'none';` (`manifest.json`). Policies 4 erfüllt.
- **Minimale, begründete Rechte:** 5 API-Permissions, Host-Zugriff ausschließlich **optional**
  (`optional_host_permissions`, der ab TB 128 empfohlene Weg) und erst zur Laufzeit angefragt.
- **Keine Telemetrie, kein Entwicklerserver:** doppelt belegt (Code + `privacy_policy.md` §1/§9).
- **MV3-API-Portierung ist erfolgt:** `getDisplayedMessages()`/`onMessagesDisplayed` statt der in MV3
  entfernten APIs; MV2-Aufrufe nur noch als unerreichbare Fallbacks (P1-10).
- **Kontextmenü-Kontexte sind gültig:** `message_display_action` und `link` sind dokumentierte
  Thunderbird-`ContextType`-Werte (API-Referenz `menus`, TB 89+).
- **Trademark/Name:** „Thundy AV – Email Scanner for Thunderbird“ entspricht dem Muster
  „<Name> for Thunderbird“; `short_name` gepflegt; ID `thundy-av@bludau-it-services.de` gesetzt.
- **Öffentlich erreichbare Nachweise:** `https://vazules.github.io/Thunderbird-Antivirus/` und
  `.../privacy_policy.html` liefern HTTP 200 und inhaltlich Version 1.6.
- **Transparente Ist-Dokumentation:** README/STATUS/`store_assets.md` behaupten an keiner Stelle mehr
  fertige Screenshots oder eine Store-URL; die „Known limitations“ sind ehrlich.

---

## 9. In dieser Umgebung nicht prüfbar (Restrisiko)

| Frage | Warum offen | Wie klären |
|---|---|---|
| Erscheint das Opt-in-Banner in TB 140 ESR tatsächlich? | benötigt echte Thunderbird-Installation mit Nutzerinteraktion | Live-Test, s. Aufgabenplan A-11 |
| Bleibt die User-Geste für `permissions.request()` über `runtime.sendMessage` erhalten? | Laufzeitverhalten von Gecko, nicht statisch entscheidbar | Live-Test A-12 |
| Löst `contexts: ["link"]` im Nachrichtentext aus? | Kontext ist dokumentiert, die Anwendbarkeit auf Nachrichteninhalte nicht | Live-Test A-13 |
| Akzeptiert der ATN-Validator `messagesRead` und die `messages.*`-APIs als gültig? | `web-ext lint` prüft gegen ein **Firefox**-Ziel (26 Warnungen sind genau das) | Validator-Lauf mit ATN-Zugang (A-21) |
| Wie bewertet das ATN-Review die Daten-Deklaration (`required` vs. `optional`)? | Review-Ermessen, Policy-Auslegung | Rückfrage an das ATN-Reviewteam + Entscheidung A-14 |
| Ist `.xpi`-Signierung über `--amo-base-url` mit ATN-Zugangsdaten funktionsfähig? | benötigt echte ATN-API-Schlüssel | Release-Test A-22 |

---

## 10. Go/No-Go-Kriterien für die Einreichung

Die Einreichung darf erst gestartet werden, wenn **alle** Kriterien erfüllt sind
(Prüfschritte und Verantwortlichkeiten im Aufgabenplan):

1. Live-Test-Protokoll in Thunderbird 140 ESR liegt vor; Banner, Warnbanner, Kontextmenü,
   Time-of-Click und der Opt-in/Permission-Flow sind darin bestätigt **oder** die betroffenen Features
   sind aus dem Listing-Text entfernt. *(P0-1, P0-2)*
2. Review-Paket vollständig: `reviewer_notes.md` inkl. Testdaten, Testanleitung und
   Test-API-Zugang. *(P0-3)*
3. Daten-Deklaration in `manifest.json` und die Consent-Beschreibung in `privacy_policy.md`/
   `store_listing.md` widersprechen sich nicht; die Entscheidung `required`/`optional` ist begründet
   dokumentiert. *(P0-4)*
4. Drei echte Screenshots (PNG, ≥ 1200 px breit) in `docs/screenshots/`; Pre-Submit-Checks ohne
   Screenshot-Warnung. *(P0-2)*
5. Signierter, über `addons.thunderbird.net/api/v5/` erzeugter Build der eingereichten Version;
   Tag + Release im Repository. *(P1-6, P1-8)*
6. Aktive CI läuft `npm test`, Lint-Filter und Paketprüfung für jeden PR. *(P1-7)*
7. Listing-Felder vollständig und konsistent (Titel, Summary, Beschreibung EN, Kategorie, Tags,
   Privacy-URL, Support, Lizenz, Kompatibilität „Thunderbird 140+“, Releasenotes 1.6). *(P0-5, P2-14)*

---

## 11. Quellen

| Quelle | Verwendung |
|---|---|
| `npx web-ext sign --help` und `node_modules/web-ext/lib/program.js` (web-ext 10.7.0) | Default-Endpunkt der Signierung (P1-6) |
| Thunderbird WebExtension-API-Referenz `.../en/mv3/scripting.messageDisplay.html` (TB 128+) | `registerScripts`/`unregisterScripts`, Hinweis zu `executeScript` für offene messageDisplay-Tabs (P0-1, P1-10) |
| Thunderbird API-Referenz `.../en/mv3/permissions.html` | Warnung „Thunderbird does not use the built-in onboarding flow … must request consent explicitly“ (P0-4) |
| Thunderbird API-Referenz `.../en/mv3/menus.html` (`ContextType`) | Gültigkeit von `message_display_action` und `link` (Positivnachweis) |
| Thunderbird MV3-Migrationsguide `.../en/mv3/guides/manifestV3.html` | `getDisplayedMessage`/`onMessageDisplayed` entfernt; `messageDisplayScripts` → `scripting.messageDisplay`; `tabs.executeScript` entfernt |
| Mozilla Add-on-Policies (extensionworkshop.com/documentation/publish/add-on-policies/) | Kapitel 1 „No Surprises“, 3 „Submission Guidelines“, 4 „Development Practices“, 6 „Data Collection and Transmission“ |
| extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ | Pflicht zu `data_collection_permissions` für neue Einreichungen (ab 03.11.2025), Taxonomie, `required`/`optional` |
| MDN `manifest.json/browser_specific_settings` | Schema und Semantik von `data_collection_permissions` (P0-4) |
| MDN `manifest.json/optional_host_permissions` und `optional_permissions` | `optional_host_permissions` ab Firefox/Thunderbird 128, empfohlen für MV3 (Positivnachweis) |
| Repo-Dateien (Manifest, Skripte, Docs, CI) | alle weiteren Belege, jeweils mit Datei/Zeile zitiert |


---

## 12. Status der Befunde nach dem Arbeitslauf (Version 1.6.1)

Nachweiszeile je Befund gemäß der Definition of Done des Aufgabenplans. „Behoben“ heißt: die Ursache ist im
Code bzw. in der Dokumentation beseitigt und durch Tests/Checks belegt; „offen“ heißt: es fehlt eine Ressource,
die in dieser Umgebung nicht verfügbar ist.

| Befund | Status | Nachweis |
|---|---|---|
| P0-1 Kernfunktion nicht nachgewiesen | 🟨 teilweise behoben | toter `scripting.messageDisplay.executeScript`-Zweig entfernt, Injektionsfehler werden sichtbar gemeldet (Test in `background.test.js`); Live-Test in TB 140 ESR steht aus (Protokoll + Testdaten liegen bereit) |
| P0-2 keine echten Screenshots | ⛔ offen | nur SVG-Platzhalter; Pre-Submit-Checks melden weiterhin genau diese Warnung |
| P0-3 keine Reviewer-Testmittel | 🟨 teilweise behoben | `scripts/make-testdata.js` + `docs/testdata.md` (was ohne Schlüssel prüfbar ist); ein Test-API-Schlüssel kann nicht bereitgestellt werden |
| P0-4 Datendeklaration/Consent | ✅ behoben in 1.6.1 | `required:["none"]` + `optional:["personalCommunications"]`, Runtime-Opt-in in `options.js`, Entscheidung belegt in `docs/data_collection_decision.md`, `privacy_policy.md` §3.1 angepasst, 3 neue Tests |
| P0-5 keine Store-Präsenz | ⛔ offen | erfordert ATN-Konto (A-01/A-32) |
| P1-6 Signierweg zielt auf AMO | ✅ behoben in 1.6.1 | `docs/ci/release.yml`, `docs/ci/README.md`, `docs/quickstart.md`, `docs/STATUS.md` setzen `--amo-base-url https://addons.thunderbird.net/api/v5/` |
| P1-7 aktive CI zu schwach | 🟨 teilweise behoben | vollständige Fassung liegt in `docs/ci/ci.yml`; Push nach `.github/workflows/` wird von der Token-Berechtigung abgelehnt (Fehler reproduziert) |
| P1-8 kein Release-Artefakt | 🟨 teilweise behoben | Version 1.6.1 + CHANGELOG + lokaler Build; Tag/Release und Signatur erfordern ATN-Schlüssel |
| P1-9 UI nur deutsch | ✅ behoben in 1.6.1 | Optionsseite und Popup vollständig über `browser.i18n`/`_locales` lokalisiert (138 Schlüssel je Sprache; `data-i18n*` + `t()`-Fallback), Sprachaussage in README/Status/Listing präzisiert, abgesichert durch `test/i18n.test.js` |
| P1-10 MV2-Altpfade/Linter-Rauschen | ✅ behoben in 1.6.1 | `getDisplayedMessage`/`onMessageDisplayed`/`scripting.messageDisplay.executeScript` entfernt; Lint 26 → 18 Warnungen, Tests angepasst |
| P1-11 Fehler bleiben unsichtbar | ✅ behoben in 1.6.1 | `reportMessageDisplayInjectionFailure` (Log + Diagnose in `storage.local` + Benachrichtigung einmal pro Sitzung), Banner erklärt verweigerte Host-Berechtigung, 2 Tests |
| P2-12 Dokumentationsdrift | ✅ behoben in 1.6.1 | Paketkennzahlen, Testdateiliste, `npm run lint`-Hinweis korrigiert |
| P2-13 Reviewer-Origins ≠ Manifest | ✅ behoben in 1.6.1 | `docs/reviewer_notes.md` §2.2 nennt jetzt `https://*.virustotal.com/*` (manifest.json) und den Laufzeit-Origin `https://www.virustotal.com/*` |
| P2-14 Listing-Metadaten offen | 🟨 teilweise behoben | Version/Sprachangabe/Kompatibilität aktualisiert; Screenshots und Store-URL fehlen noch |
| P2-15 Kompatibilitätsaussage | ✅ behoben in 1.6.1 | „Thunderbird 140+“ in Listing, README und Antwortkatalog (Reviewer-Notes §10 Nr. 7) begründet |
| P2-16 Umgehung des ApiGateway | ✅ behoben in 1.6.1 | Upload (`background.js`) und Popup-Abruf (`api.js`) nutzen `apiGateway.fetchWithTimeout`; `popup.html` lädt `api_gateway.js` |
| P3-17 doppelte Ignore-Konfiguration | ✅ behoben in 1.6.1 | `.webextignore` entfernt, einzige Quelle ist `web-ext-config.mjs` (dort zusätzlich `testdata` ausgeschlossen) |

**Weiter:** Aufgabenplan mit Durchführungsstand, Go/No-Go-Protokoll und den nächsten Schritten →
[AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md)








