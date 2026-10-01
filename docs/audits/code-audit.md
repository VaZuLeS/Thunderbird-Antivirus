# Code-Audit (task_0001) — MV3-API-, Consent- und Permission-Korrektheit

**Prüfgegenstand:** `/workspace` (Thundy AV, Thunderbird WebExtension, Manifest V3)
**Branch:** `cline/k0d34w90` · **Basis-Commit:** `4c4898c` · **manifest.json Version:** 1.6
**Datum:** 2026-09-30 · **Rolle:** unabhängiger Code-Auditor (keine Commits, keine Änderung getrackter Dateien)
**Regel für diesen Bericht:** Jede Zeilenangabe wurde per `grep`/`sed -n` direkt am Code nachgeprüft.
Aussagen, die nur in einer echten Thunderbird-Installation entschieden werden können, sind mit
**UNVERIFIZIERT** markiert. Externe Belege stehen mit URL + Zitat in Abschnitt 6.

---

## 0. Kurzfazit

Die drei Basis-Fakten wurden in dieser Sitzung selbst nachvollzogen:

| Kommando | Ergebnis (selbst reproduziert) |
|---|---|
| `npm test` | `tests 389 / pass 389 / fail 0` (exit 0) |
| `node scripts/pre-submit-checks.js` | 0 Fehler, 1 Warnung (`no PNG/JPEG screenshots`), exit 0 |
| `npx web-ext lint --source-dir . --output json` | `{'errors': 0, 'notices': 0, 'warnings': 26}` (exit 0) |

**Urteil:** Die in `docs/STATUS.md` und `docs/STORE_READINESS_ANALYSIS.md` §8 als „behoben“ geführten
Punkte zu **MV3-APIs (B1)** und zum **Consent-Gate im Hintergrundskript (B3)** sind **überwiegend belegt**
— mit **zwei Ausnahmen**, die der Doku widersprechen:

1. Es gibt **einen** Netzwerkpfad ohne Consent-Gate: das Popup (`api.js:532`) → Aussage „ohne Zustimmung
   wird nichts übertragen“ ist **widerlegt** (AUD-02, empirisch belegt).
2. „`hasHostPermissionFor()` vor jedem Provider-Aufruf“ (`STORE_READINESS_ANALYSIS.md:378`) ist
   **widerlegt**: die Funktion steht an 2 von 12 Netzwerk-Aufrufstellen (AUD-04).

Zusätzlich zwei bisher **nicht dokumentierte, reproduzierbare Blocker**:

* Das Popup-Bootstrap ist **funktional defekt** (`syncFragment` und `container` sind undefiniert →
  `ReferenceError` als unbehandelte Promise-Rejection); der Analysebericht im Popup erscheint nie
  (AUD-01, empirisch belegt).
* Die Berechtigung **`menus` fehlt** in `manifest.json` → laut Thunderbird-Doku sind **beide
  Kontextmenüeinträge im Produktivbetrieb tot** (AUD-03, Doku-belegt).

Die 389 grünen Tests decken beide Blocker **nicht** ab, weil `api.test.js` die selbstausführende
Popup-Kapsel vor dem Laden entfernt und die übrigen Tests nur mit gemockten Browser-APIs arbeiten
(Belege in AUD-01).

---

## 1. Prüfmethode

* Statische Analyse mit `grep -n`, `sed -n` und vollständigen Dateilesevorgängen.
* Empirische Gegenproben in einer isolierten `node:vm`-Umgebung im Mock-Stil der Repo-Tests;
  die Hilfsskripte liegen **außerhalb** des Repos (`/tmp/audit-proof/`, Abschnitt 7).
* Unabhängiger `no-undef`-Lauf mit dem bereits in `node_modules` vorhandenen ESLint 9.39.4
  (temporäre Flat-Config `/tmp/audit-proof/eslint.audit.config.mjs`).
* Abgleich mit den offiziellen Thunderbird-API-Dokumenten (`webextension-api.thunderbird.net`, MV3,
  Stand der Doku: Thunderbird 156.0.1) und mit comm-central-Quelltext (hg/searchfox).
* Keine Commits, keine Änderungen an getrackten Dateien. Selbst erzeugt wurde **ausschließlich**
  `/workspace/.audit/code-audit.md` (per `.gitignore:6` ignoriert). Während der Sitzung haben
  **andere** Agenten im selben Arbeitsverzeichnis weitere Dateien angefasst
  (` M docs/PROBLEMANALYSE_STORE_READINESS.md`, `?? docs/AUFGABENPLAN_STORE_READINESS.md`,
  `.audit/docs-audit.md`, `.audit/pipeline-audit.md`) — diese stammen **nicht** aus diesem Audit und
  wurden nicht bewertet.

---

## 2. Prüfung der Behauptungen aus STATUS.md / STORE_READINESS_ANALYSIS.md §8

| # | Behauptung (Quelle) | Urteil | Beleg |
|---|---|---|---|
| 1 | `onMessagesDisplayed`/`getDisplayedMessages` primär, `onMessageDisplayed`/`getDisplayedMessage` nur Fallback (`STATUS.md:11-13`) | **belegt** | `background.js:1223-1233`, `background.js:1736-1741`, `api.js:72-78` |
| 1b | keine weiteren in MV3 entfernten APIs (`content_scripts`, `browser_style`, `messageDisplayScripts`) | **belegt** | `grep -rn 'content_scripts\|browser_style\|messageDisplayScripts' manifest.json *.js` → 0 Treffer |
| 1c | `messageListToArray()`/`getFirstDisplayedMessage()` zentral (`STATUS.md:12`) | **teilweise** | gilt für `background.js:1220-1246`; `api.js:72-78` dupliziert die Normalisierung inline (AUD-15) |
| 2 | Injektion zentral über `injectIntoMessageDisplay()` mit `scripting.messageDisplay.executeScript` als Primärweg | **belegt, aber Primärzweig derzeit toter Code** | `background.js:113-126`; TB-Doku: `scripting.messageDisplay` bietet nur `get/register/unregisterScripts` (Abschnitt 7) |
| 3 | „ohne Zustimmung wird nichts übertragen“ (`STATUS.md:18-20`, §8 B3) | **widerlegt** | `api.js:515-549` + `api.js:680-682` — kein Consent-Gate (AUD-02, empirisch) |
| 4 | „`hasHostPermissionFor()` vor jedem Provider-Aufruf“ (§8, Zeile 378) | **widerlegt** | `grep -n 'hasHostPermissionFor' background.js` → nur `97` (Definition), `240`, `1483`; 12 Aufrufstellen ohne Vorprüfung (AUD-04) |
| 4b | „angefragt wird zur Laufzeit nur für den tatsächlich genutzten Anbieter“ (`STATUS.md:25`) | **belegt** | `options.js:130-142` |
| 5 | `data_collection_permissions.required: ["personalCommunications"]` „passt zur Umsetzung“ (§8 B2) | **belegt (Werte) / begründungsbedürftig (`required` vs. `optional`)** | Werte passen (`background.js:1451`, `2221`, `798`); `required` ist in TB vertretbar, weil TB **keinen** Auto-Prompt hat (Doku-Zitat Abschnitt 7), widerspricht aber `STORE_READINESS_ANALYSIS.md:267` (`"optional"`) → AUD-08 |
| 6 | kein `eval`/Remote-Code, keine unsicheren DOM-Injektionen, restriktive CSP | **belegt** | keine `eval(`/`new Function` in Produktivdateien; `innerHTML` nur in `*.test.js`; `manifest.json:35-37`; `popup.html:7`; nur lokale `<script src>` |
| 7 | `notify()` nutzt `runtime.getURL('img/icon-64px.png')`, Icon-Map vollständig (§8 H8) | **belegt** | `background.js:47-54`, `1770-1774`; `manifest.json:54-60`; Datei vorhanden (`img/icon-64px.png`, 842 Bytes) |
| 7b | „`api_gateway.js` … nie geladen“ (§4 M10, Zeile 210) | **widerlegt (Altbefund)** | `manifest.json:41` lädt sie; 12 Aufrufe (`background.js:340, 360, 798, 1507, 1905, 2169, 2221, 2274, 2308, 2332, 2370`) |
| 7c | „doppelte `runtime.onMessage`-Listener“ (§4 M10) | **widerlegt (bereits behoben)** | genau ein Listener: `background.js:1970` |
| 7d | `contexts: ["link"]` „nicht dokumentiert“ (`STATUS.md:58`) | **widerlegt** | TB-Doku `menus` → `ContextType` listet `link` („Applies when the user context-clicks on a link.“) und `message_display_action` – *[Added in TB 89]* |
| 7e | „Kontextmenü-Erstellung gegen Doppel-IDs abgesichert“ (§8 M1–M12) | **widerlegt** | `background.js:1758-1765` fängt nur synchrone Fehler; TB-Doku: Fehler erst über Creation-Callback/`runtime.lastError` (AUD-14) |
| — | Kontextmenü funktioniert im Betrieb | **widerlegt (neuer Befund)** | `menus` fehlt in `manifest.json:19-25`; TB-Doku: `menus` ist Pflicht für `messenger.menus.*` (AUD-03) |

---

## 3. Befunde

### AUD-01 — Popup-Bootstrap ist defekt: zwei undefinierte Bezeichner brechen die Berichtsanzeige (Blocker)

* **Schwere:** Blocker (Kernfunktion des Popups unbrauchbar; von keiner Testdatei erfasst)
* **Belege (Zitate):**
  * `api.js:193` — `renderManualUploadUI(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId, syncFragment);`
  * `api.js:210` — `processRecordLinks(record.links, message.headerMessageId, syncFragment, fetchTasks);`
  * `api.js:218` — `container.appendChild(taskFragment);`
  * Gegenprobe: `grep -rn 'syncFragment' *.js` → nur `api.js:193`, `api.js:210` (Nutzung) und `api.js:735/738` (Parameter). `grep -n 'container' api.js` → alle Deklarationen sind block-scoped (`api.js:36, 86, 223, 238, 250, 634, 666, 676, 749, 821`), **keine** im Scope von Zeile 218.
  * Unabhängiger Linter: `npx eslint --no-config-lookup --config /tmp/audit-proof/eslint.audit.config.mjs api.js` →
    `193:131 error 'syncFragment' is not defined`, `210:79 error 'syncFragment' is not defined`, `218:29 error 'container' is not defined`.
  * Empirisch: `/tmp/audit-proof/api-container-referenceerror.js` lädt `api.js` wie ein Modul (self-invoking) mit `externalAnalysisConsent:false` und einem DB-Record mit bekanntem Anhang → `ReferenceError: container is not defined` (unhandled rejection); mit zusätzlich global definiertem `container` wird der Bericht angehängt (`global container children (report target): 1`).
  * Warum die Tests das nicht sehen: `api.test.js:157-159`, `api.test.js:232-235`, `api.test.js:558-561` ersetzen die selbstausführende Kapsel `(async () => { … })();` durch `async function initAPI() { … }` und rufen sie nie auf; der Bootstrap-Pfad `api.js:158-275` läuft in keinem Test.
* **Auswirkung:** Sobald ein DB-Record mit Anhängen/Links existiert (Normalfall nach einem Scan), bricht der Popup-Pfad mit einer **unbehandelten** Promise-Rejection ab — der `try/catch` in `api.js:158/249` greift nicht, weil der Wurf in `getRequest.onsuccess` (`api.js:179`) passiert. Der Nutzer sieht dauerhaft nur „Lade Analyseergebnisse…“; die Netzwerkaufrufe aus AUD-02 sind zu diesem Zeitpunkt schon erfolgt.
* **Fix-Skizze:** Vor der Schleife ein echtes Fragment deklarieren (`const syncFragment = document.createDocumentFragment();`) und `container` im Scope von `api.js:218` definieren (z. B. `const container = document.getElementById('hybrid_analysis_api_content');` bei `api.js:184`).
* **Prüfmethode:** `npx eslint --no-config-lookup --config /tmp/audit-proof/eslint.audit.config.mjs api.js` und `node /tmp/audit-proof/api-container-referenceerror.js` (nach Fix: keine unhandled rejection, Bericht im Container).

### AUD-02 — Consent-Gate fehlt im Popup: authentifizierter GET an Hybrid Analysis ohne Zustimmung (Blocker)

* **Schwere:** Blocker (Datenschutz-/Policy-Verstoß; widerlegt eine zugesicherte Eigenschaft)
* **Belege:**
  * `api.js:532` — `const response = await fetch(options.url, options);` mit `api.js:522` `url: 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha` und `api.js:525` `'api-key': apikey_hybridanalysis`.
  * `api.js:515-549` (`fetch_hybrid_report`) und die Aufrufer `api.js:682`, `api.js:716-719` enthalten **keine** Consent-Prüfung. `grep -n 'externalAnalysisConsent' api.js` → nur `82`, `83`, `136`, `144` (Anzeige des Hinweises in `api.js:136-156`), kein Gate. Das Flag ist zudem lokal in der Kapsel `api.js:31-275`; die Funktionen ab `api.js:276` haben keinen Zugriff darauf.
  * Widerruf entfernt keine Host-Berechtigung: `grep -rn 'permissions.remove' *.js` → 0 Treffer.
  * Empirisch: `node /tmp/audit-proof/api-consent-gap.js` → `number of fetch() calls without consent = 1`; URL `https://hybrid-analysis.com/api/v2/overview/e3b0c44298fc1c149afbf4c8996fb924`; `RESULT: CONSENT GAP CONFIRMED`.
* **Auswirkung:** Nach Deaktivieren/Widerrufen der Zustimmung (bei bereits erteilter Host-Berechtigung) übermittelt das Popup weiterhin SHA-256-Hashes und den API-Key an einen Drittanbieter. Das widerspricht `options.html:45` („Ohne diese Zustimmung werden **keine** Hashes, Dateien, Links oder IP-Adressen an externe Dienste übertragen“) und dem Consent-Modell in `background.js:64-74`. Der Abruf erfolgt unabhängig von Tier/Berechtigung.
* **Fix-Skizze:** Consent zur Laufzeit lesen und die Task-Erzeugung in `api.js:184-221` überspringen, oder den Abruf über `background.js` routen (dort greift `mayTransmitExternally()`), z. B. via neuer `runtime.onMessage`-Aktion `getHybridReport`.
* **Prüfmethode:** `node /tmp/audit-proof/api-consent-gap.js` (nach Fix: „no request sent“); `grep -n 'externalAnalysisConsent' api.js`.

### AUD-03 — `menus`-Berechtigung fehlt: beide Kontextmenüeinträge sind tot (hoch)

* **Schwere:** hoch (beworbene Funktion nicht verfügbar, Fehler bleibt still)
* **Belege:**
  * `manifest.json:19-25` — `"permissions": ["messagesRead","storage","notifications","scripting","downloads"]` → **kein** `"menus"`.
  * Nutzung: `background.js:1745` `if (!browser.menus || typeof browser.menus.create !== 'function') return;`, `background.js:1760` `browser.menus.create(menu)`, `background.js:1815` `browser.menus.onClicked.addListener(...)`.
  * TB-Doku, `menus`: „Note The permission **menus** is required to use `messenger.menus.*`.“; in der Permissions-Liste der Doku: „`menus` – Grant access to some or all methods of the menus API.“
  * Einstufung als install-zeitige Permission ohne Prompt (Doku `PermissionNoPrompt`: „alarms … **menus** – [Added in TB 77] … storage, theme, unlimitedStorage“) → gehört in `manifest.permissions`.
* **Auswirkung:** `browser.menus` ist ohne die Berechtigung nicht verfügbar; die Guards lassen „Link mit Thundy AV scannen“ und „Alle Links dieser Nachricht scannen“ stillschweigend verschwinden. `npm test` erkennt das nicht, weil `background.test.js` `browser.menus` selbst bereitstellt.
* **Fix-Skizze:** `"menus"` in `manifest.json.permissions` ergänzen (kein Nutzer-Prompt) und den Fix in Reviewer-Notes/STATUS dokumentieren; alternativ die Menüfunktionen entfernen.
* **Prüfmethode:** `node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json')).permissions)"`; Laufzeitnachweis nur live (**UNVERIFIZIERT**).

### AUD-04 — Host-Permission-Vorprüfung nur an 2 von 12 Provider-Aufrufen; Doku-Behauptung falsch (mittel)

* **Schwere:** mittel (Doku falsch; Funktionen schlagen bei verweigerter Berechtigung still fehl)
* **Belege:**
  * `grep -n 'hasHostPermissionFor' background.js` → `97` (Definition), `240` (`hasHybridPermission`), `1483` (VirusTotal-Dateilookup) — sonst nichts.
  * Ohne Vorprüfung: `background.js:340` (AbuseIPDB), `360` (VirusTotal-IP), `798` (Hybrid-URL-Quick-Scan, Tier `max`), `1451` (Datei-Upload), `1507` (Hybrid-Overview), `1905` (Verdict), `2169` (URL-Scan), `2221` (manueller Upload), `2274` (VirusTotal-Datei), `2308` (URLhaus), `2332` + `2370` (urlscan.io).
  * Doku-Behauptung: `docs/STORE_READINESS_ANALYSIS.md:378` „`hasHostPermissionFor()` vor jedem Provider-Aufruf“.
* **Auswirkung:** Wird die Host-Berechtigung im Optionsdialog abgelehnt (oder nie erteilt, weil nie gespeichert wurde), laufen die Aufrufe trotzdem los und scheitern ohne Nutzerfeedback (`catch`-Blöcke loggen nur, z. B. `background.js:809-811`, `1465-1467`, `1566-1569`, `2354-2357`). Die Doku verspricht hier mehr Robustheit, als der Code hat.
* **Fix-Skizze:** `hasHostPermissionFor(url)` direkt vor jedem `apiGateway.fetchWithTimeout` prüfen (oder zentral in `apiGateway`/einem Wrapper) und das Ergebnis im UI/Log sichtbar machen; Doku-Zeile 378 entsprechend korrigieren.
* **Prüfmethode:** `grep -n 'hasHostPermissionFor' background.js` gefolgt von `grep -n 'apiGateway.fetchWithTimeout\|await fetch(' background.js`.

### AUD-05 — `sensitiveDataUpload` weder deklariert noch angefragt, obwohl sensible Daten hochgeladen werden (mittel)

* **Schwere:** mittel (Conformance-/Review-Risiko; keine nachgewiesene Laufzeitblockade)
* **Belege:**
  * Thunderbird stellt die Permission `sensitiveDataUpload` bereit; die TB-eigene Beschreibung lautet: `webext-perms-description-sensitiveDataUpload = Transfer sensitive user data (if access has been granted) to a remote server for further processing` (comm-central `mail/locales/en-US/messenger/extensionPermissions.ftl:30`).
  * Mozillas eigenes Add-on (`mail/extensions/builtin-addons/thundermail/extension/manifest.json:42`) führt sie in `permissions` — sie ist also das offizielle Signal für genau diesen Fall.
  * Dieses Add-on lädt Anhangsinhalte hoch: `background.js:1451` (`fetch(uploadOptions.url, uploadOptions)` mit `FormData`/`File`, `background.js:1444-1447`) und `background.js:2221` (manueller Upload, `background.js:2214-2216`).
  * Gegenprobe: `grep -rn 'sensitiveDataUpload' manifest.json *.js docs/` → 0 Treffer.
* **Wirkung/Ursache:** Die Permission erweitert in den TB-Schemata `OptionalPermission` (`messages.json:20`, `scripting-tb.json:13`), wäre also über `optional_permissions` + `permissions.request` zu erlangen. Eine Durchsetzung im comm-central-Code ist über die Textsuche nicht auffindbar (searchfox: nur Schema-, L10n-, UI- und Fremd-Manifest-Vorkommen) → **UNVERIFIZIERT**, ob ein Fehlen bei ATN/Review oder zur Laufzeit sanktioniert wird. Der Repo-eigene Pre-Submit-Check verbietet `optional_permissions` (`scripts/pre-submit-checks.js:155-157`), sodass die Deklaration derzeit gar nicht möglich wäre.
* **Auswirkung:** Potenzieller ATN-Review-Einwand („überträgt sensible Nutzerdaten, deklariert dafür aber nicht die vorgesehene Berechtigung“).
* **Fix-Skizze:** Entscheidung dokumentieren: entweder `sensitiveDataUpload` sauber über `optional_permissions` + Nutzergeste anfragen (und die Pre-Submit-Regel für diesen Sonderfall öffnen) oder im Listing/Reviewer-Notes begründen, warum es nicht genutzt wird. **Vorher ATN-Vorgabe prüfen.**
* **Prüfmethode:** `grep -rn 'sensitiveDataUpload' manifest.json *.js`; Doku-Abgleich `webextension-api.thunderbird.net/en/mv3/permissions.html` (Abschnitt 7).

### AUD-06 — `permissions.request()` aus dem Banner ohne Nutzergeste im Zielkontext (mittel)

* **Schwere:** mittel (Funktion „Jetzt scannen“ kann trotz Klick scheitern)
* **Belege:**
  * `background.js:1939-1944` — `let granted = await hasHybridPermission();` … `granted = await browser.permissions.request({ origins: [PROVIDER_ORIGINS.hybridanalysis] });`
  * Aufrufweg: `browser.runtime.sendMessage({action:'requestScan', …})` im injizierten Banner (`background.js:1146-1151`) → `browser.runtime.onMessage`-Listener (`background.js:1994-1996`) → `handleRequestScan`. Es gibt damit (a) keinen Klick-Handler im Kontext, der `permissions.request` aufruft, und (b) ein `await` **vor** dem Request.
  * Der Erfolgs-/Fehlerpfad ist abgesichert (`background.js:1155-1171`), sodass der Nutzer „Required host permission was denied“ sieht (`background.js:20`).
  * Gegenbeispiel (korrekt): `options.js:137-142` führt `contains`/`request` innerhalb des Klick-Handlers auf „Speichern“ aus.
* **Auswirkung:** Wenn Thunderbird die Anfrage ablehnt, kann der Nutzer die Berechtigung nur noch über die Optionsseite erteilen — der beworbene Ein-Klick-Scan funktioniert nicht. **UNVERIFIZIERT:** das tatsächliche Verhalten der User-Gesture-Prüfung in Thunderbird (Code-Pfad ist belegt, Laufzeitverhalten nicht).
* **Fix-Skizze:** Berechtigung im Banner-Klick primär aus dem injizierten Kontext anfordern (dort ist die Geste unmittelbar) oder den Hinweis „Bitte in den Einstellungen freigeben“ erzwingen, statt auf `permissions.request` zu bauen; Dokumentation in `docs/reviewer_notes.md` ergänzen.
* **Prüfmethode:** `sed -n '1929,1948p' background.js`; live: Klick auf „Nur diese Nachricht scannen“ bei fehlender Host-Berechtigung.

### AUD-07 — IP-Reputation-Cache friert „false“-Ergebnisse aus der Zeit ohne Zustimmung ein (mittel)

* **Schwere:** mittel (Funktionsfehler, still)
* **Belege:**
  * `background.js:338` `if (!mayTransmitExternally()) return false;` (AbuseIPDB) und `background.js:358` (VirusTotal-IP) → ohne Zustimmung liefert die Prüffunktion `false`.
  * `background.js:875` `ipReputationCache.set(ip, promise);` und `background.js:877-880` `ipChecks.push(promise.then(isMalicious => { ipReputationCache.set(ip, isMalicious); … }))` → das `false` wird als **fertiges Ergebnis** abgelegt.
  * Bei erneutem Aufruf greift `background.js:850-857` (`cached instanceof Promise` → sonst `if (cached) …`) und es findet **keine** Neuabfrage statt.
* **Auswirkung:** Wer die Zustimmung erst nach dem ersten Nachrichtenaufruf erteilt (typischer Ablauf: Optionen öffnen, Häkchen setzen), bekommt für bereits gecachte IPs desselben Adressraums dauerhaft keine IP-Reputation. Nur ein Neustart/`clearCache` hilft.
* **Fix-Skizze:** `false`-Ergebnisse nicht cachen, wenn `mayTransmitExternally()` false war oder die Host-Berechtigung fehlte (z. B. `undefined`/Sentinel cachen und bei Consent-Wechsel Cache leeren — `browser.storage.onChanged` in `background.js:256` ist dafür bereits vorhanden).
* **Prüfmethode:** `sed -n '848,882p' background.js`; Unit-Test analog zu den bestehenden Consent-Tests in `background.test.js` (Suche `ipReputationCache`).

### AUD-08 — `data_collection_permissions: required` passt zu Thunderbird, widerspricht aber der eigenen Analyse (mittel)

* **Schwere:** mittel (Begründungs-/Konsistenzrisiko im Review, kein Funktionsfehler)
* **Belege:**
  * Ist-Zustand: `manifest.json:14-16` → `"data_collection_permissions": { "required": ["personalCommunications"] }`.
  * Eigene Empfehlung dagegen: `docs/STORE_READINESS_ANALYSIS.md:267` → `"data_collection_permissions": { "optional": ["personalCommunications"] }`.
  * Gate erzwingt die „required“-Variante: `scripts/pre-submit-checks.js:133` `if (requiredTypes.length === 0) fail('data_collection_permissions.required must list at least one data type');` — eine reine `optional`-Deklaration würde also **fehlschlagen**.
  * Thunderbird-Doku (`permissions`, Typ `CommonDataCollectionPermission`, Abschnitt 7): „Unlike Firefox, Thunderbird does not use the built-in onboarding flow that prompts users to opt into data collection. In Thunderbird, add-ons must request consent explicitly, for example by adding a checkbox on the options page or by showing a popup. The application does not provide an automatic prompt.“
  * Der Code holt den Consent über genau diesen Weg ein (`options.js:104`, `options.js:118`, `options.html:43-45`) und erzwingt ihn bei jeder Übermittlung — außer AUD-02.
  * Ein `permissions.request({data_collection: …})` gibt es nirgends: `grep -rn 'data_collection' *.js` → 0 Treffer.
* **Auswirkung:** Die Deklaration ist für Thunderbird vertretbar (dort ist der manuelle Consent der vorgesehene Weg), behauptet aber gegenüber Firefox „diese Daten werden immer übertragen“, während sie faktisch opt-in sind. Ein Reviewer kann das als Über-/Unterdeklaration lesen; eine Umstellung auf `optional` wäre **nicht** ohne Codeänderung möglich (dann fehlt der Runtime-Request).
* **Fix-Skizze:** Beibehalten und im Listing/Reviewer-Notes ausdrücklich begründen („opt-in, Consent über Optionsseite, `required` nur als Deklaration der Kategorie“), ODER auf `optional` + `permissions.request({data_collection:['personalCommunications']})` umstellen, Pre-Submit-Check (`:133`) und Tests anpassen. Zusätzlich `docs/STORE_READINESS_ANALYSIS.md:267` mit der Umsetzung in Einklang bringen.
* **Prüfmethode:** `node -e "const m=JSON.parse(require('fs').readFileSync('manifest.json'));console.log(m.browser_specific_settings.gecko.data_collection_permissions)"`; Installationsverhalten in TB 140: **UNVERIFIZIERT** (Abschnitt 5).

### AUD-09 — Injektionsfehler sind unsichtbar; Rückgabewert wird nirgends geprüft (mittel)

* **Schwere:** mittel (Fehlerbild „Add-on tut nichts“ ohne jede Rückmeldung)
* **Belege:**
  * `background.js:113-126` — `injectIntoMessageDisplay()` fängt alle Fehler und gibt `null` zurück: `background.js:122-125` `catch (e) { Logger.warn('Injecting into the message display failed …', e); return null; }`
  * Aufrufer ignorieren den Rückgabewert: `background.js:830` (`injectTimeOfClickProtection`), `background.js:979` (`injectThreatBanner`), `background.js:1109` (`injectOptInBanner`) — jeweils `await injectIntoMessageDisplay(...)` ohne Auswertung.
  * Produktivpfad ist derzeit der generische Aufruf `background.js:121` `return await browser.scripting.executeScript(injection);`, weil `scripting.messageDisplay` in Thunderbird nur `getRegisteredScripts`/`registerScripts`/`unregisterScripts` bietet (Doku, Abschnitt 7) — d. h. die Bedingung `background.js:117-118` ist in TB 128–156 nie wahr (toter Zweig, dokumentiert in `STATUS.md:15-17`).
  * Die TB-Doku empfiehlt für bereits geöffnete Nachrichten ausdrücklich `executeScript(injection)` je offenem messageDisplay-Tab, der Ansatz ist also plausibel; ob die Injektion tatsächlich im Nachrichtendokument landet, ist **live zu prüfen**.
* **Auswirkung:** Selbst bei erfolgreicher Vorprüfung (Test `background.test.js:3241-3256` mockt den Aufruf) ist die tatsächliche Wirkung im Zielsystem unbekannt; schlägt sie fehl, ist die Folge „Banner fehlt“ **ohne** sichtbaren Hinweis (nur eine Konsolen-Warnung im Hintergrundskript).
* **Fix-Skizze:** Rückgabe auswerten, bei `null` einen sichtbaren Fallback nutzen (z. B. `browser.notifications`-Hinweis oder Statuszeile im Popup) und das Verhalten in `docs/reviewer_notes.md` dokumentieren.
* **Prüfmethode:** `sed -n '113,126p' background.js`; live: Banner in einer echten Nachrichtenansicht prüfen.

### AUD-10 — Unerreichbarer Code nach `return` in `filterUrls()` (niedrig)

* **Schwere:** niedrig (toter Code; harmlos, weil unerreichbar)
* **Beleg:** `background.js:1385-1397` — `function filterUrls(urls, parsedUrlCache = null) { return urls.filter(…); return filtered; }`; die ESLint-Gegenprobe meldet `1396:12 error 'filtered' is not defined`.
* **Auswirkung:** keine zur Laufzeit; ein späteres Refactoring (z. B. Entfernen des ersten `return`) würde sofort einen `ReferenceError` erzeugen.
* **Fix-Skizze:** Zeile 1396 entfernen.
* **Prüfmethode:** `npx eslint --no-config-lookup --config /tmp/audit-proof/eslint.audit.config.mjs background.js` (Filter auf `1396`).

### AUD-11 — `api_gateway.js`: Key-Injektion ist toter Code und weicht von der Origin-Logik ab (niedrig)

* **Schwere:** niedrig (keine Auswirkung auf den Produktivpfad, aber Fehlerquelle bei Änderungen)
* **Belege:**
  * `api_gateway.js:6-8` `setApikey(service, key)` — `grep -rn 'setApikey' *.js` → nur die Definition; Aufruf nirgends. Damit ist `this.apikeys` immer leer und `_injectAuthHeaders` (`api_gateway.js:10-43`) macht nie etwas.
  * Abweichende Host-Allowlist: `api_gateway.js:25` erlaubt bare `virustotal.com` zusätzlich zu `www.virustotal.com`, `api_gateway.js:31` bare `urlscan.io` — `PROVIDER_ORIGINS` (`background.js:77-83`) und `originForUrl()` (`background.js:85-95`) prüfen nur `https://www.virustotal.com/*` bzw. `https://urlscan.io/*`.
  * Kein Redirect-/Permission-Check im Gateway: `api_gateway.js:45-71` prüft nur Timeout und 429.
  * Positive Abweichung: `api_gateway.js:16-18` injiziert Keys nur über HTTPS (`parsedUrl.protocol !== 'https:'`).
* **Auswirkung:** Die tatsächlich verwendeten Keys werden von den Aufrufern selbst als Header gesetzt (z. B. `background.js:340-345`, `360-365`, `166-173`) — das Gateway ist nur ein Timeout-Wrapper. Die doppelte Zuständigkeit führt bei künftigen Änderungen leicht zu widersprüchlichen Erwartungen (u. a. zur Doku-Behauptung `STORE_READINESS_ANALYSIS.md:210`, das Gateway sei „nie geladen“).
* **Fix-Skizze:** `setApikey`/`_injectAuthHeaders` entfernen oder konsequent nutzen (Keys zentral über `originForUrl()`-kompatible Hostnamen setzen) und die Doku-Zeile 210 korrigieren.
* **Prüfmethode:** `grep -rn 'setApikey\|_injectAuthHeaders' *.js`.

### AUD-12 — Benachrichtigungen enthalten die vollständige gescannte URL (niedrig)

* **Schwere:** niedrig (sichtbarer Datenabfluss auf den Desktop; kein Netzwerkverlust)
* **Belege:** `background.js:1828` `notify('notificationTitle', 'notificationScanStarted', [url]);` mit `background.js:1768-1779` (`browser.notifications.create({… message: msg(messageKey, subs)})`). Ebenso `background.js:1838` (Job-ID) und `background.js:1840` (Fehlermeldung des Providers).
* **Auswirkung:** Die URL (kann Token/PII enthalten) erscheint in der Systembenachrichtigung; bei Screensharing/Präsenz einsehbar. Bewertung: niedrig, aber dokumentationswürdig.
* **Fix-Skizze:** Nur den Host anzeigen (z. B. `new URL(url).hostname`) oder die Benachrichtigung ohne URL-Text gestalten.
* **Prüfmethode:** `grep -n 'notify(' background.js`.

### AUD-13 — `runtime.onMessage`-Listener ohne Absender-/Parameterprüfung (niedrig)

* **Schwere:** niedrig (nur eigene Erweiterungsseiten können senden; keine Content-Scripts im Paket)
* **Belege:** `background.js:1970-2001`. `uploadAttachment` übernimmt `messageId`/`partName`/`attachmentName`/`hash` ungeprüft (`background.js:1972-1975` → `background.js:2206-2210`), `scanUrl` eine beliebige URL (`background.js:1978-1982` → `background.js:2158-2167`).
* **Auswirkung:** Heute kein Ausnutzungspfad nachweisbar (kein `content_scripts`, `grep -rn 'content_scripts' manifest.json` → 0 Treffer; Popup/Options sind vertrauenswürdig). Sobald künftig Content-Scripts oder `externally_connectable`/-Message-Partner hinzukommen, würde der Listener zum offenen Kanal für Datei-/URL-Uploads.
* **Fix-Skizze:** `sender.id`/`sender.url` prüfen und Parameter gegen die aktuell angezeigte Nachricht validieren (`getFirstDisplayedMessage`) bevor hochgeladen wird.
* **Prüfmethode:** `sed -n '1970,2001p' background.js`.

### AUD-14 — `menus.create` ohne Fehlerbehandlung; try/catch greift nicht (niedrig)

* **Schwere:** niedrig (nur Diagnosefähigkeit betroffen; Hauptproblem siehe AUD-03)
* **Belege:** `background.js:1758-1765` — `try { browser.menus.create(menu); } catch (e) { Logger.warn('Could not create context menu entry', menu.id, e); }`.
  TB-Doku (`menus.create`): „Note that if an error occurs during creation, you may not find out until the creation callback fires (the details will be in `runtime.lastError`).“
* **Auswirkung:** Berechtigungs-, Pattern- oder ID-Fehler beim Anlegen der Menüs bleiben unbemerkt (kein Callback, kein `runtime.lastError`-Check). Der Kommentar in `background.js:1762` („Duplicate ids can occur …“) beschreibt einen Fall, den dieser Code nicht abfängt.
* **Fix-Skizze:** `browser.menus.create(menu, () => { if (browser.runtime.lastError) Logger.warn(…) })` bzw. vorab `browser.menus.removeAll()`.
* **Prüfmethode:** `sed -n '1744,1766p' background.js`; WebExt-Doku `menus.create`.

### AUD-15 — Doppelte MessageList-Normalisierung in `api.js` (niedrig)

* **Schwere:** niedrig (Wartbarkeit/Konsistenz)
* **Belege:** `api.js:72-78` normalisiert `getDisplayedMessages()` inline (`Array.isArray(messageList) ? … : (messageList && messageList.messages) || []`), obwohl `background.js:1241-1246` `messageListToArray()` für exakt diese Aufgabe besitzt (verwendet in `background.js:1251`). `api.js` ist ein Modul und kann die Hintergrundfunktion nicht direkt nutzen; die Doku `STATUS.md:12` liest sich aber so, als sei die Portierung zentral erfolgt.
* **Auswirkung:** Zwei Codepfade für dieselbe MV3-Eigenheit von `MessageList` (Array-ähnlich mit `.messages`); Änderungen müssen doppelt gepflegt werden.
* **Fix-Skizze:** Gemeinsame Hilfsfunktion in `db.js`/einer neuen Utility-Datei ablegen und in beiden Kontexten laden (beide HTML-Seiten laden `db.js` bereits: `popup.html:44`, `options.html:140`).
* **Prüfmethode:** `grep -n 'messageListToArray\|getDisplayedMessages' api.js background.js`.

### AUD-16 — Lint-Allow-List markiert APIs als „False Positive“, die verifiziert existieren – aber das Gate kann echte Entfernungen nicht erkennen (niedrig)

* **Schwere:** niedrig (Gate-Wirksamkeit)
* **Belege:**
  * `scripts/filter-lint-warnings.js:10-21` listet u. a. `messages.query` und `scripting.messageDisplay` als bekannte Thunderbird-False-Positives; `scripts/filter-lint-warnings.js:23-29` erlaubt pauschal die Codes `MANIFEST_PERMISSIONS` und `UNSUPPORTED_API`.
  * Die Klassifizierung ist für die geprüften Fälle **korrekt**: `messages.query([queryInfo])` – *[Added in TB 69]* und `scripting.messageDisplay` – *[Added in TB 128]* existieren in Thunderbird (Abschnitt 7) – die 26 Warnungen aus `npx web-ext lint` (u. a. `messages.getFull`, `messageDisplay.getDisplayedMessages`) sind daher tatsächlich Firefox-bedingte False Positives.
  * `web-ext-config.mjs:50-54` setzt `lint: { … warningsAsErrors: false }` (Feld in Zeile 53) — `npx web-ext lint` allein ist damit **kein** Gate; die Wirkung entsteht nur über `scripts/filter-lint-warnings.js`, das alle nicht gelisteten Warnungen als Fehler wertet (exit 1, `filter-lint-warnings.js:59-63`).
* **Auswirkung:** `UNSUPPORTED_API` wird für die gesamte `messages.*`-Fläche pauschal akzeptiert; würde Thunderbird künftig eine Funktion entfernen, bliebe die Warnung „known false positive“ und das CI-Gate grün.
* **Fix-Skizze:** Allow-List auf konkrete API-Pfade eingrenzen (z. B. `messages.getFull`, `messages.listAttachments`, `messages.getAttachmentFile`, `messages.query`) statt des ganzen Codes, und die TB-Mindestversion in der Liste dokumentieren.
* **Prüfmethode:** `npx web-ext lint --source-dir . --output json > /tmp/lint.json && node scripts/filter-lint-warnings.js /tmp/lint.json` (aktuell: „all of them known Thunderbird false positives“, exit 0).

---

## 4. Vollständige Aufstellung der Netzwerkpfade und Berechtigungen

`grep -n 'fetch(\|XMLHttpRequest\|fetchWithTimeout\|fetchJson' background.js api.js options.js db.js popup.html options.html` → **13 Stellen** (12 in `background.js`, 1 in `api.js`); `XMLHttpRequest` kommt im Repository **nicht** vor.

| # | Stelle | Ziel/Verzweck | Consent-Guard | Host-Permission-Vorprüfung |
|---|---|---|---|---|
| 1 | `background.js:340` | AbuseIPDB `GET /api/v2/check` (IP-Reputation) | `background.js:338` `if (!mayTransmitExternally()) return false;` | **nein** |
| 2 | `background.js:360` | VirusTotal `GET /api/v3/ip_addresses/<ip>` | `background.js:358` | **nein** |
| 3 | `background.js:798` | Hybrid `POST /api/v2/quick-scan/url` (Tier `max`) | `background.js:780` (`privacyTier === 'max' && mayTransmitExternally()`) | **nein** |
| 4 | `background.js:1451` | Hybrid `POST /api/v2/quick-scan/file` (Anhang-Upload, Tier `balanced`/`max`) | `background.js:1442` | **nein** |
| 5 | `background.js:1507` | Hybrid `GET /api/v2/overview/<sha>` | `background.js:1502` + `1554` | **nein** |
| 6 | `background.js:1905` | Hybrid `GET /api/v2/overview/<sha>` (Verdict) | `background.js:1901` | **nein** |
| 7 | `background.js:2169` | Hybrid `POST /api/v2/quick-scan/url` (Kontextmenü „Link scannen“) | `background.js:2160` `assertExternalAnalysisAllowed()` | **nein** |
| 8 | `background.js:2221` | Hybrid `POST /api/v2/quick-scan/file` (Popup-Upload) | `background.js:2208` `assertExternalAnalysisAllowed()` | **nein** |
| 9 | `background.js:2274` | VirusTotal `GET /api/v3/files/<sha>` | `background.js:2259` | `background.js:1483` (nur dieser Pfad) |
| 10 | `background.js:2308` | URLhaus `POST /v1/host/` | `background.js:2304` | **nein** |
| 11 | `background.js:2332` | urlscan.io `POST /api/v1/scan/` | `background.js:2328` | **nein** |
| 12 | `background.js:2370` | urlscan.io `GET /api/v1/result/<uuid>/` | nur indirekt: einziger Aufrufer ist `background.js:2353` innerhalb des geschützten `checkUrlscanIo` | **nein** |
| 13 | `api.js:532` | Hybrid `GET /api/v2/overview/<sha>` (**Popup**) | **kein Guard** → AUD-02 | **nein** |

Zusätzliche Antworten auf die Unterfragen in der Aufgabe:

* **Link-Scan (Kontextmenü):** geschützt (`background.js:1790` `assertExternalAnalysisAllowed()` für „alle Links dieser Nachricht“, `background.js:1836` → `handleUrlScan` → `background.js:2160`).
* **IP-Reputation:** geschützt (Guard in `background.js:338`/`358`, Aufruf über `background.js:1080` → `checkIPReputation`).
* **Banner-Scan:** geschützt (`background.js:1934`) und zusätzlich permission-geprüft (`background.js:1939-1948`).
* **Popup-Upload/Rescan:** geschützt (Popup `api.js:562-568` → `background.js:1972` → `background.js:2208`).
* **Popup-Berichtsanzeige (GET):** **ungeschützt** (AUD-02) — damit ist die Antwort auf die Frage „Gibt es Pfade, die ohne Consent senden?“ **ja, genau einer**.
* **Provider-Origins vor dem Request geprüft?** Ja: `options.js:141` `browser.permissions.contains({origins:[origin]})` vor `options.js:142` `browser.permissions.request(...)`; angefordert wird nur für konfigurierte Dienste (`options.js:130-135`).
* **Deckt `hasHostPermissionFor()` alle Fetch-Ziele?** Alle real verwendeten Ziele sind durch `optional_host_permissions` (`manifest.json:26-34`) abgedeckt: `api.abuseipdb.com` ✓, `www.virustotal.com` (über `https://*.virustotal.com/*`) ✓, `hybrid-analysis.com` ✓, `urlhaus-api.abuse.ch` ✓, `urlscan.io` ✓. **Lücke (theoretisch):** `originForUrl()` bildet bare `virustotal.com` auf `https://www.virustotal.com/*` ab (`background.js:89`), bare `urlscan.io` auf das Wildcard-freie Pattern (`background.js:90`); ein Redirect von `hybrid-analysis.com` auf `www.hybrid-analysis.com` würde anfragen, für die `options.js:131` **keine** Laufzeitberechtigung angefordert hat (deklariert ist sie in `manifest.json:28`). Bewertung: niedrig, weil alle Aufrufe ohne Redirect funktionieren — **UNVERIFIZIERT** (Redirect-Verhalten der Provider nicht geprüft).

### 4.1 Genutzte Berechtigungen vs. deklarierte (Kreuzprobe)

`grep -o 'browser\.[a-zA-Z]*\.' background.js api.js options.js db.js` → `runtime`, `messageDisplay`, `messages`, `storage`, `scripting`, `permissions`, `menus`, `tabs`, `notifications`, `downloads`.

| API-Namespace | Deklarierte Permission | Bewertung |
|---|---|---|
| `messages.*`, `messageDisplay.*` | `messagesRead` (`manifest.json:20`) | korrekt (TB-Doku: „required to use messenger.messages.*“ / „messenger.messageDisplay.*“) |
| `storage` | `storage` | korrekt |
| `notifications` | `notifications` | korrekt |
| `scripting` | `scripting` | korrekt (TB-Doku: „required to use messenger.scripting.*“) |
| `downloads` | `downloads` | korrekt |
| **`menus.*`** | **fehlt** | **Fehler → AUD-03** |
| `runtime`, `permissions`, `i18n` | keine nötig | korrekt |
| `tabs.query` (Popup) | keine nötig (nur ohne `url`/`title`-Felder) | korrekt (`api.js:66` fragt nur `{active, currentWindow}`) |
| externe Uploads sensibler Daten | `sensitiveDataUpload` fehlt | Befund AUD-05 |

---

## 5. Nicht statisch verifizierbar (in dieser Umgebung nicht entscheidbar)

1. **`data_collection_permissions` beim Install in Thunderbird 140.** Die Doku-Aussage „kein automatischer Prompt, Add-ons müssen Consent selbst einholen“ (Abschnitt 7) ist belegt, aber was ATN beim Einreichen/Install mit `required` konkret validiert (Dialog, Listing-Badge, Review-Rückfrage) ist nicht statisch prüfbar. Empfohlen: Testinstallation mit einem unsignierten XPI in TB 140 ESR.
2. **Ob `scripting.executeScript({target:{tabId}, func, args})` in Thunderbird tatsächlich in das Nachrichtenansichts-Dokument injiziert.** Der Code-Pfad (`background.js:113-126`) und die Doku-Empfehlung (Abschnitt 7) sind belegt; die Wirkung nicht. Offen: funktionieren die Banner-Buttons, erreicht `browser.runtime.sendMessage` aus der Injektion das Hintergrundskript, ist `browser.i18n.getMessage` dort verfügbar (verwendet in `background.js:982`, `1112`), ist `browser.runtime.openOptionsPage()` (`background.js:1194`) aus dem injizierten Kontext überhaupt verfügbar? Alle vier Punkte nur live prüfbar.
3. **User-Gesture-Prüfung für `permissions.request()`** (`background.js:1942`, AUD-06) und das Verhalten von `mouseup`-Ketten über `runtime.sendMessage`.
4. **`contexts: ["link"]`** ist laut TB-Doku gültig (Abschnitt 7); erscheint der Eintrag in der Praxis im richtigen Kontext, bleibt live zu prüfen (Thunderbird zeigt Link-Kontexte je nach Version unterschiedlich).
5. **`sensitiveDataUpload`** — ob ATN/Review die fehlende Deklaration moniert oder ob Thunderbird die Permission derzeit überhaupt durchsetzt (Textsuche in comm-central ergab keine Durchsetzungsstelle), ist nicht statisch entscheidbar.
6. **Redirect-/CNAME-Verhalten der Provider-APIs** und damit die Frage, ob die deklarierten Match-Patterns alle tatsächlich kontaktierten Hosts abdecken.
7. **Store-/Listing-spezifische Vorgaben** (Screenshot-Mindestgröße, Pflichtfelder, Namensregeln) — Gegenstand von task_0002/task_0003, hier nicht dupliziert.
8. **`strict_min_version: 140.0` vs. Doku-Stand 156.0.1.** Alle hier zitierten API-Fakten stammen aus der Doku-Fassung für Thunderbird 156.0.1; für einzelne Funktionen wurde die „Added in TB …“-Angabe mitgeprüft (alle ≤ 128 und damit < 140), für `data_collection_permissions` in TB 140 gibt es aber keinen Nachweis (siehe Punkt 1).

---

## 6. Fremd-Belege (online geprüft am 2026-09-30)

Alle Zitate wurden mit `curl` abgerufen und lokal per Text-Extraktion geprüft (Ablage unter `/tmp/tb_*.html`).

1. **Thunderbird MV3 API-Doku**, `https://webextension-api.thunderbird.net/en/mv3/menus.html`
   * „menus API is similar to the Firefox menus API, but has been adapted to better suit Thunderbird’s specific needs.“
   * „The permission **menus** is required to use `messenger.menus.*`.“
   * ContextType: „`link` … Applies when the user context-clicks on a link.“ · „`message_display_action` – [Added in TB 89] Applies when the user context-clicks a messageDisplayAction button.“
   * „`create(createProperties, [callback])` – [Added in TB 66] … Note that if an error occurs during creation, you may not find out until the creation callback fires (the details will be in `runtime.lastError`).“
2. **Thunderbird MV3 API-Doku**, `.../en/mv3/scripting.html` und `.../en/mv3/scripting.messageDisplay.html`
   * `scripting.executeScript(injection)` – [Added in TB 102]; „The permission **scripting** is required to use `messenger.scripting.*`.“
   * `scripting.messageDisplay` – Funktionen **nur** `getRegisteredScripts([filter])`, `registerScripts(scripts)`, `unregisterScripts([filter])` (jeweils [Added in TB 128]); **kein** `executeScript`.
   * „Registered scripts will only be applied to newly opened messages. To apply the script to already open messages, manually inject your script by calling `executeScript(injection)` for each of the open messageDisplay tabs.“
   * Benötigte Permissions für `scripting.messageDisplay.*`: „messagesRead scripting“ (kein `messagesModify`).
3. **Thunderbird MV3 API-Doku**, `.../en/mv3/messageDisplay.html`
   * `messagesRead` „is required to use `messenger.messageDisplay.*`.“ Funktionen: `getDisplayedMessages([tabId])` – [Added in TB 81], `open(openProperties)`; Event `onMessagesDisplayed`. **Kein** `getDisplayedMessage`/`onMessageDisplayed` → die B1-Portierung ist sachlich richtig.
4. **Thunderbird MV3 API-Doku**, `.../en/mv3/messages.html`
   * `query([queryInfo])` – **[Added in TB 69]** „Gets all messages that have the specified properties…“ → `background.js:904` ist zulässig; die Lint-Warnung ist ein False Positive. Ebenso vorhanden: `list`, `getFull`, `getAttachmentFile`, `listAttachments`.
5. **Thunderbird MV3 API-Doku**, `.../en/mv3/permissions.html`
   * Typ `CommonDataCollectionPermission` (Warnung): „Unlike Firefox, Thunderbird does not use the built-in onboarding flow that prompts users to opt into data collection. In Thunderbird, add-ons must request consent explicitly, for example by adding a checkbox on the options page or by showing a popup. The application does not provide an automatic prompt.“
   * `AnyPermissions.data_collection` („array of OptionalDataCollectionPermission“) → Datenkonsent ist in TB über `permissions.request` erreichbar; `technicalAndInteraction` ist die einzige `optional`-only-Kategorie.
   * `PermissionNoPrompt`: „alarms, contextualIdentities, declarativeNetRequestWithHostAccess, dns, identity, **menus – [Added in TB 77]**, storage, theme, unlimitedStorage“.
   * `OptionalPermission`-Liste enthält `sensitiveDataUpload – [Added in TB 115]`.
6. **comm-central**, `mail/locales/en-US/messenger/extensionPermissions.ftl:30`
   * `webext-perms-description-sensitiveDataUpload = Transfer sensitive user data (if access has been granted) to a remote server for further processing`
7. **comm-central**, `mail/extensions/builtin-addons/thundermail/extension/manifest.json:42` — Mozillas eigenes Add-on führt `sensitiveDataUpload` in `permissions`.
8. **comm-central**, Schemata: `mail/components/extensions/schemas/messages.json:20` und `scripting-tb.json:13` erweitern `OptionalPermission` um `sensitiveDataUpload`.
9. **Firefox-Datenkonsent-Doku**, `https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/`
   * „You specify the data types your extension transmits in the `browser_specific_settings.gecko.data_collection_permissions` key … Personal data permissions can be required or optional, except for `technicalAndInteraction` that cannot be required.“
   * (Firefox-Kontext; für Thunderbird gilt die Warnung aus Punkt 5 — dort ist der manuelle Consent der vorgesehene Weg.)
10. **`web-ext`/`addons-linter`-Schema in `node_modules`** — `"permissions":["menus"]` für den `menus`-Namensraum (Gegenprobe zur Manifest-Deklaration).

---

## 7. Reproduktion / Rohdaten

Die Audit-Hilfsskripte liegen **außerhalb** des Repos (keine Änderung getrackter Dateien):

* `/tmp/audit-proof/api-consent-gap.js` — Nachweis AUD-02
* `/tmp/audit-proof/api-container-referenceerror.js` — Nachweis AUD-01
* `/tmp/audit-proof/eslint.audit.config.mjs` — Flat-Config für den unabhängigen `no-undef`-Lauf

```bash
# Basis (selbst reproduziert)
npm test                                                # tests 389, pass 389, fail 0
node scripts/pre-submit-checks.js                       # 0 Fehler, 1 Warnung, exit 0
npx web-ext lint --source-dir . --output json           # errors 0 / warnings 26
node scripts/filter-lint-warnings.js /tmp/lint.json     # alle 26 als bekannte TB-False-Positives

# Befunde
node /tmp/audit-proof/api-consent-gap.js                # CONSENT GAP CONFIRMED
node /tmp/audit-proof/api-container-referenceerror.js   # ReferenceError: container is not defined
npx eslint --no-config-lookup --config /tmp/audit-proof/eslint.audit.config.mjs api.js background.js options.js db.js
grep -n 'hasHostPermissionFor' background.js            # 97, 240, 1483
grep -n 'externalAnalysisConsent' api.js                # 82, 83, 136, 144
grep -rn 'sensitiveDataUpload' manifest.json *.js       # 0 Treffer
grep -rn 'permissions.remove' *.js                      # 0 Treffer
```

ESLint-Ergebnis (Auszug aus 24 Meldungen; 20 davon sind erwartete Cross-File-Globals aus
`db.js`/`api_gateway.js`, die `manifest.json:39-43` in denselben Global-Scope lädt):

```
/workspace/api.js
  193:131  error  'syncFragment' is not defined  no-undef      <- AUD-01
  210:79   error  'syncFragment' is not defined  no-undef      <- AUD-01
  218:29   error  'container' is not defined     no-undef      <- AUD-01
/workspace/background.js
  1396:12  error  'filtered' is not defined      no-undef      <- AUD-10 (unerreichbar)
  …        (apiGateway/openDB/updateStore/getFromStore = erwartete Cross-File-Globals)
/workspace/options.js
  189:26   error  'openDB' is not defined        no-undef      <- erwartet (db.js)
  190:31   error  'clearStore' is not defined    no-undef      <- erwartet (db.js)
```

`web-ext lint`-Warnungen (26): 1× `MANIFEST_PERMISSIONS` (`messagesRead`), 1×
`KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`, 24× `UNSUPPORTED_API` (`messageDisplay.*`,
`messages.*`, `scripting.messageDisplay`) — laut Abschnitt 6 tatsächlich Firefox-bedingte
False Positives.

### 7.1 Beweiskraft der beiden Hauptnachweise

* **AUD-02:** `api-consent-gap.js` lädt `db.js` und `api.js` in einen `node:vm`-Kontext, in dem
  `browser.storage.local.get()` für `externalAnalysisConsent` **nichts** liefert (also „aus“) und
  protokolliert jeden `fetch`-Aufruf. Ergebnis: `number of fetch() calls without consent = 1`
  (URL: `https://hybrid-analysis.com/api/v2/overview/e3b0…`). Der Aufruf erfolgt also **vor** jeder
  Anzeige-/Consent-Logik.
* **AUD-01:** `api-container-referenceerror.js` lädt `api.js` unverändert (die Kapsel läuft wie im
  Popup) mit einem DB-Record (ein Anhang, `state: 'KNOWN'`). Variante A (kein globales `container`)
  → `ReferenceError: container is not defined` als unbehandelte Rejection, kein Bericht im Container.
  Variante B (globales `container` definiert) → Bericht landet im Container
  (`global container children (report target): 1`), keine Rejection. Damit ist bewiesen, dass der
  fehlende Bezeichner (und nicht ein Mock-Artefakt) die Ursache ist.

---

## 8. Empfohlene Reihenfolge der Behebung

1. **AUD-01** (Popup-Bootstrap) und **AUD-02** (Consent-Gate im Popup) — beide im gleichen Modul, ein
   Patch; danach Tests ergänzen, die den Bootstrap-Pfad wirklich ausführen (die bisherige
   IIFE-Transformation in `api.test.js:157-159` schaltet genau diesen Pfad ab).
2. **AUD-03** (`menus`-Permission) — Ein-Zeilen-Fix im Manifest, danach Live-Test beider Menüeinträge.
3. **AUD-04** (Host-Permission-Vorprüfung) und **AUD-06** (User-Gesture) — Fehlerbilder sichtbar machen.
4. **AUD-05/AUD-08** — Deklarations-/Review-Themen: vor Einreichung mit den ATN-Vorgaben abgleichen und
   `docs/reviewer_notes.md`/`docs/STORE_READINESS_ANALYSIS.md` konsistent nachziehen.
5. **AUD-07, AUD-09–AUD-16** — Aufräumen/Härtung, keine Einreichungsblocker.

**Beweiskraft-Hinweis:** Alle „belegt/widerlegt“-Urteile beruhen auf Datei:Zeile-Belegen und den in
Abschnitt 7 gelisteten Kommandos. Wo ein Urteil von Laufzeitverhalten abhängt, steht ausdrücklich
**UNVERIFIZIERT** (Abschnitt 5) statt einer Behauptung.
