# Store-Readiness-Review 1.6 — „Thundy AV – Email Scanner for Thunderbird“

> **Umsetzungsstand (dieser Branch): alle unten analysierten Befunde sind abgearbeitet.** Der Abschnitt
> [0. Umsetzung](#0-umsetzung) listet für jeden Befund die konkrete Änderung und den Nachweis. Die Analyse-
> kapitel 1–7 beschreiben den **vorgefundenen** Stand (Commit `1a72c45`) und bleiben als Begründung stehen.

---

## 0. Umsetzung

Ausgangspunkt der Analyse war Commit `1a72c45`; die Korrekturen liegen in den darauf folgenden Commits
(`49850f3` Blocker/Hohe Risiken, `8b2fc84` Lokalisierung). Verifikation nach der Umsetzung:

```bash
npm test                       # 442 Tests, 0 Fehler
npm run pre-submit-checks      # 0 Fehler, 1 Warnung (fehlende Screenshots)
npx web-ext lint --source-dir . --output json   # 0 Fehler, 25 bekannte Thunderbird-False-Positives
node scripts/verify-package.js ./build          # 18 Dateien, 240 959 Bytes
```

| Befund | Umsetzung | Nachweis |
|---|---|---|
| **B1** `menus` fehlte | `menus` in `manifest.json` deklariert; Permission-Tabellen und Reviewer-Notizen ergänzt | `manifest.json`, `scripts/pre-submit-checks.js` (neuer Namespace-Check), `background.test.js` |
| **B2** Injektion über `scripting.executeScript` | Neues, einmalig registriertes Message-Display-Skript `message_display.js` (`scripting.messageDisplay.registerScripts`), Zustandsübergabe über `getMessageUiState` + Broadcast `thundy:messageState`; `executeScript`-Pfad entfernt | `background.js` (`registerMessageDisplayScript`, `buildMessageUiState`, `handleGetMessageUiState`), `message_display.js`, `message_display.test.js` (17 Tests) |
| **B3** Time-of-Click nur kosmetisch | Echte Klick-Interception im Message-Display-Skript: Prüfung über `checkLinkState` (lokales Verdikt/urlscan.io), Blockade bei MALICIOUS/TIMEOUT/ERROR, Fail-Closed für nicht prüfbare Schemes, Freigabe durch den Nutzer („Link trotzdem öffnen“), In-Memory-Set statt DOM-Attribut; `handleCheckLinkState` ist damit wieder erreichbar | `message_display.js`, `background.js` (`handleOpenVerifiedLink`), Tests in `message_display.test.js` |
| **B4** Popup fragte ohne Zustimmung ab | Klarer Abbruch im Popup, solange `externalAnalysisConsent` aus ist (kein `fetch`, keine Upload-Buttons) + Tests | `api.js`, `api.test.js` (Describe „popup consent gate“) |
| **H1** Deklarationssemantik | `data_collection_permissions: { required: ["none"], optional: ["personalCommunications"] }`; zusätzlich wird die eingebaute Kategorie-Zustimmung im Optionsdialog angefragt (Feature-Detection) und im Hintergrund in `mayTransmitExternally()` erzwungen | `manifest.json`, `options.js`, `background.js`, `pre-submit-checks.js` |
| **H2/M6** Doku-Drift | README/README.de/STATUS/Listing/Reviewer-Notizen/Datenschutz/CHANGELOG auf den neuen Stand gebracht (Zahlen, Funktionen, offene Punkte) | Doku-Commit |
| **H3** Kein Gate für Permissions/CI | Pre-Submit-Checks prüfen jetzt Namespace ⇔ Permission, Datenkonsent-Deklaration, registriertes Skript und Lokalisierungs-Keys; vollständige CI-Definition in `docs/ci/ci.yml` (Übernahme in `.github/workflows/` scheitert weiter an der fehlenden `workflows`-Berechtigung des Tokens) | `scripts/pre-submit-checks.js`, `scripts/pre-submit-checks.test.js` |
| **M1** Überbreite Host-Patterns | `optional_host_permissions` auf die 5 tatsächlich genutzten Origins reduziert | `manifest.json` |
| **M2** UI nur deutsch | Optionsseite und Popup vollständig über `_locales/{en,de}` + `browser.i18n` lokalisierbar (157 Strings, deutsche Fallbacks im Code, `en` als Standard-Locale); Katalog-Konsistenz wird geprüft | `db.js`, `options.js/html`, `api.js`, `popup.html`, `_locales/*`, `db.test.js` |
| **M3** Popup-Tab-Auflösung | `messageDisplay.getDisplayedMessages()` ohne `tabId` (Fallback Tabs-API) | `api.js` |
| **M7** Produktname | Popup-Titel/-Überschrift = Add-on-Name | `popup.html` |
| **M8** Fehler nur im Log / tote Pfade | Registrierungsfehler erzeugen eine Notification; zusätzlich zwei latente `ReferenceError`s im Popup behoben (`syncFragment`, `container`), die das Anzeigen gespeicherter Ergebnisse verhinderten; Option „Auto-Scan“ funktional umgesetzt (`autoScanLinksOfMessage`) | `background.js`, `api.js`, Tests |

**Weiterhin offen und in dieser Umgebung nicht leistbar** (unverändert Punkte 6.1–6.4): manuelle Live-Verifikation
in Thunderbird 140 ESR, echte Screenshots, Signierung/Einreichung bei addons.thunderbird.net, Übernahme der
vollständigen CI-Workflows mit einem Token, das die `workflows`-Berechtigung besitzt.

---

**Prüfgegenstand:** Repository `VaZuLeS/Thunderbird-Antivirus`, Branch `cline/ktzgfrzf`, Arbeitsstand
`manifest.json` Version **1.6**, Add-on-ID `thundy-av@bludau-it-services.de`
**Zielplattform:** Thunderbird Add-ons Store (ATN, addons.thunderbird.net) — Listung + Signierung
**Prüfmethode:** statische Code-/Manifest-Analyse, Testlauf, Linter, XPI-Build-Inspektion, Abgleich mit
Thunderbird-MV3-/API-Dokumentation (API-Referenz 156, `ext-scripting-tb.js` aus comm-central),
Mozilla Add-on-Policies und Firefox-Datenkonsent-Doku, Prüfung der veröffentlichten Doku und der Live-URLs
**Datum:** laufender Arbeitsstand (siehe Git-Historie dieser Datei)
**Verhältnis zu `STORE_READINESS_ANALYSIS.md`:** jene Datei beschreibt den Ausgangsbefund (Manifest 1.5) und den
Abarbeitungsstand. Dieses Dokument ist der **neu verifizierte Stand 1.6** und ersetzt deren Bewertung der
Blocker. Delta-Übersicht in Anhang B.

---

## 1. Gesamturteil

| Bereich | Status |
|---|---|
| MV3-Portierung der Message-APIs (`onMessagesDisplayed`, `getDisplayedMessages`) | 🟢 behoben und im Code nachvollziehbar |
| Datenschutz-Konsent im Hintergrundskript | 🟢 zentral erzwungen (mit einer Ausnahme, B4) |
| Optionale Host-Berechtigungen | 🟢 korrekt deklariert, valide Patterns, Runtime-Anfrage |
| Paket-/Release-Hygiene, Lint, Tests | 🟢 Tests grün, Lint 0 Fehler, XPI auf Laufzeitdateien reduziert |
| **Context-Menü-Funktionen** | 🔴 **Blocker B1** — Berechtigung `menus` fehlt ⇒ Funktionen existieren nicht |
| **Sichtbare Schutz-UI (Banner, Warnung, Time-of-Click)** | 🔴 **Blocker B2** — Injektionsweg wird von Thunderbird so nicht unterstützt |
| **Time-of-Click-Schutz** | 🔴 **Blocker B3** — nur kosmetisch, zugehöriger Handler ist toter Code, Listing-Aussage falsch |
| **Popup-Übertragung ohne Zustimmung** | 🔴 **Blocker B4** — widerspricht Datenschutzerklärung und Listing |
| Datenschutz-Deklaration (`data_collection_permissions`) | 🟠 Semantikabgleich offen (H1) |
| Doku-/Listing-Konsistenz, Reviewer-Testbarkeit | 🟠 (H2, H4) |
| Listing-Assets / Einreichung | 🔴 offen (Screenshots, Signierung, keine Store-URL) |

**Ergebnis: Das Add-on ist in diesem Stand NICHT Store-ready.** Die formalen Kriterien (Manifest, ID, Lizenz,
Datenschutzerklärung, optionale Host-Rechte, Paketinhalt, Lint) sind erfüllt — die **beworbene Kernfunktion ist es
nicht**: Nach der Codeanalyse erscheint in Thunderbird 140 ESR weder das Opt-in-Banner noch das Warnbanner noch
der Time-of-Click-Hinweis, die beiden Kontextmenü-Einträge werden nie erzeugt, und der Popup-Pfad überträgt auch
bei ausgeschalteter Zustimmung. Eine Einreichung wäre damit inhaltlich (Funktionsumfang ≠ Listing) und formell
(Datenschutz-Darstellung ≠ Code) angreifbar.

**Gezählte Befunde:** 4 Blocker (B1–B4), 4 hohe Risiken (H1–H4), 8 mittlere Punkte (M1–M8).

---

## 2. Verifiziert grün (Stand dieses Commits)

| Nachweis | Kommando / Beleg | Ergebnis |
|---|---|---|
| Unit-Tests | `npm test` | **389 Tests, 65 Suites, 0 Fehler** |
| Pre-Submit-Checks | `npm run pre-submit-checks` | **0 Fehler, 1 Warnung** (fehlende Screenshots), Exit 0 |
| Lint | `npx web-ext lint --source-dir . --output json` + `scripts/filter-lint-warnings.js` | **0 Fehler, 26 Warnungen**, alle bekannte Thunderbird-False-Positives (1× `MANIFEST_PERMISSIONS` „messagesRead“, 1× Android-Min-Version, 24× `UNSUPPORTED_API`) |
| XPI-Paket | `npx web-ext build` + `scripts/verify-package.js` | **17 Dateien, 179 276 Bytes entpackt** (nur Laufzeitdateien + `LICENSE`), 48 092 Bytes ZIP |

---

## 3. Blocker (vor einer Einreichung zwingend)

### B1 — `menus`-Berechtigung fehlt ⇒ beide Kontextmenü-Funktionen existieren nicht

**Belege**
- Verwendung: `background.js:1740-1762` (`browser.menus.create` für `scan-link-thundy` und
  `scan-message-links-thundy`), Aufruf beim Start `background.js:1809`, Klickverarbeitung
  `background.js:1811-1839` (u. a. `info.linkUrl`).
- Deklaration: `manifest.json:19-25` → `["messagesRead", "storage", "notifications", "scripting", "downloads"]`
  — **`menus` fehlt**.
- Regel: Die Thunderbird-API-Doku weist für *alle* `menus`-Funktionen und -Events „**Required permissions**
  `menus`“ aus (u. a. `create`, `onClicked`); MDN: „To use this API you need to have the `menus` permission.“
  Ohne die Berechtigung ist `browser.menus` nicht verfügbar.
- Der Guard `if (!browser.menus || typeof browser.menus.create !== 'function') return;`
  (`background.js:1741`, analog `background.js:1811`) beendet die Funktion **still** — kein Fehler, keine
  Notification, kein Log. Die Fehlfunktion bleibt im Betrieb unsichtbar.
- Warum 389 grüne Tests das nicht finden: `background.test.js:68` definiert `browser.menus` im Mock, die Tests
  laufen also mit einer API, die das Add-on in Thunderbird nie erhält. `scripts/pre-submit-checks.js:145-167`
  prüft nur verbotene Berechtigungen und Host-Patterns, **nicht** „benutzter Namensraum ⇔ deklarierte
  Berechtigung“.
- Gegenprüfung (unabhängig durchgeführt): kein `browser.contextMenus`-Alias und kein Polyfill außerhalb der
  Test-/Dev-Dateien (`background.test.js:68`, `benchmark_compare.js:15`), die nicht in das XPI gelangen.

**Auswirkung:** Die beworbenen Funktionen „Eintrag im Link-Kontextmenü für einen manuellen Link-Scan“
(`docs/store_listing.md:51-52, 106-108`) und „Scan all links of this message“ (`README.md:34`,
`docs/reviewer_notes.md`) sind im Store-Build **nicht vorhanden**. Ein Reviewer kann sie nicht testen, ein
Nutzer sieht sie nie.

**Fix (minimal):** `"menus"` in `manifest.json` → `permissions` ergänzen und in der Permission-Tabelle
(`README.md:159-167`, `docs/reviewer_notes.md` §2.1) begründen („Kontextmenü-Einträge für Link-Scan und
Nachrichten-Link-Scan“). Alternative: beide Einträge **und** die zugehörigen Textstellen entfernen. Eine der
beiden Optionen ist vor der Einreichung zu wählen (ATN bevorzugt minimale Rechte).

---

### B2 — Injektion in die Nachrichtenansicht nutzt einen von Thunderbird nicht angebotenen Weg

**Belege**
- `background.js:113-126` `injectIntoMessageDisplay()`: bevorzugt
  `browser.scripting.messageDisplay.executeScript(...)`, sonst Fallback
  `browser.scripting.executeScript({ target: { tabId }, func, args })`.
- Aufrufer: Opt-in-Banner `background.js:1105`, Threat-/Auth-Banner `background.js:975`, Time-of-Click
  `background.js:826`.
- `scripting.messageDisplay` besitzt in der MV3-API-Referenz (Thunderbird 156) **nur** `getRegisteredScripts`,
  `registerScripts`, `unregisterScripts` — **kein `executeScript`**. Bestätigt durch die Thunderbird-Quelle
  `mail/components/extensions/parent/ext-scripting-tb.js`: dort ist ausschließlich
  `registerScripts`/`unregisterScripts`/`getRegisteredScripts` implementiert; injiziert wird über einen
  `ExtensionSupport.registerWindowListener` auf `chrome://messenger/content/messenger.xhtml` und
  `.../messageWindow.xhtml`, der die registrierten Skripte im **`about:message`-Fenster** der jeweiligen
  Nachricht ausführt. Genau dieser `registerScripts`-Weg ist der dokumentierte Ersatz für das
  MV2-`messageDisplayScripts` (MV3-Guide: „messageDisplayScripts API — Replaced by scripting.messageDisplay API“).
- Der bevorzugte Zweig in `background.js:117-120` kann daher **nie** wahr werden.
- Der Fallback `scripting.executeScript({target:{tabId}})` adressiert das Top-Level-Dokument des Tabs
  (`messenger.xhtml` im 3-Pane-Fall, `messageWindow.xhtml` im Nachrichtenfenster). Das sind privilegierte
  Thunderbird-Dokumente, keine Webinhalte; für `executeScript` ist eine Host-Berechtigung für das Zieldokument
  erforderlich. Deklariert sind ausschließlich Anbieter-API-Origins (`manifest.json:26-34`) — eine
  Host-Berechtigung für die Nachrichtenansicht ist damit nicht erreichbar.
- Der Fehlschlag wird verschluckt: `catch` → `Logger.warn(...)`, Rückgabe `null`
  (`background.js:122-125`). Kein Nutzerhinweis, kein sichtbarer Fehler.
- Gegenprüfung (unabhängig durchgeführt): Im Repository gibt es **keine** Treffer für `registerScripts`,
  `messageDisplayScripts` oder `content_scripts`, keinen `browser.messageDisplayAction`-Aufruf und kein
  gebündeltes Message-Display-Skript. Die gesamte Banner-/Time-of-Click-Logik hängt damit an diesem einen,
  nicht unterstützten Injektionsweg.

**Auswirkung**
1. Das Opt-in-Banner mit seinen beiden Buttons erscheint nicht ⇒ der **Consent-/Scan-Flow über die Oberfläche**
   (Zustimmung per Banner, `permissions.request()` aus dem Bannerpfad `background.js:1938`) ist für Nutzer nicht
   erreichbar.
2. Das Warnbanner erscheint nicht — und **das Ergebnis der lokalen Bewertung wird nirgends sonst sichtbar**:
   `evaluateAndInjectThreats()` (`background.js:1093-1097`) ruft ausschließlich `injectThreatBanner()` auf; kein
   Speichern, keine Notification, kein Popup-Eintrag. Fällt die Injektion aus, sieht der Nutzer bei einer
   verdächtigen Nachricht **nichts**.
3. Der „Time-of-Click-Hinweis“ und der SPF/DKIM/DMARC-Badge entfallen ebenfalls.

**Bewertung:** Der Befund ist statisch belegt (API-Fläche + Injektionsziel); die Wirkung im Zielsystem ist gemäß
Projektstatus selbst noch nicht live geprüft (`docs/STATUS.md:54-58`). Er ist deshalb als Blocker zu behandeln:
**entweder** live in Thunderbird 140 ESR widerlegen (`docs/quickstart.md`) **oder** umsetzen.

**Fix (empfohlene Umsetzung):** Einmalig
`browser.scripting.messageDisplay.registerScripts([{ id: 'thundy-ui', js: ['message_display.js'], runAt: 'document_idle' }])`
registrieren (Skript im XPI, keine Remote-Ressourcen). Das Skript holt seinen Zustand per
`browser.runtime.sendMessage(...)` vom Hintergrundskript; der Hintergrund ermittelt die Nachricht des Absenders
über `messageDisplay.getDisplayedMessages(sender.tab.id)` und antwortet mit Banner-, Warn- und Hover-Daten. Damit
entfällt `executeScript` vollständig und es gibt einen einzigen, testbaren Injektionsweg.

| MV3-APIs | `background.js:1216-1250` (`getDisplayedMessages` + `MessageList`-Normalisierung), `background.js:1731-1738` (`onMessagesDisplayed`, Legacy nur als Feature-Detection) | korrekt portiert |
| Konsent im Hintergrund | `mayTransmitExternally()` / `assertExternalAnalysisAllowed()` (`background.js:64-74`) an allen Provider-Pfaden: `background.js:338,358,775,919,1438,1479,1498,1550,1897,1930,2255,2300,2324` | erzwungen |
| Host-Rechte | `manifest.json:26-34` ↔ `PROVIDER_ORIGINS` (`background.js:77-83`) ↔ `options.js:130-153` | deckungsgleich, Runtime-Anfrage nur für den genutzten Anbieter |
| Kein Remote-Code | kein `eval`, `new Function`, `import()`, `chrome.*`, `innerHTML` im Produktivcode; CSP `script-src 'self'; object-src 'none'`; keine externen Fonts/CDNs | sauber |
| Keine Secrets im Repo | Regex-Suche nach Key-/Token-Literalen in `*.js`/`*.json` | keine Treffer |
| Icons | `img/icon-{16,32,48,64,128}px.png`, PNG mit exakt deklarierter Kantenlänge (durch Pre-Submit-Checks erzwungen) | valide |
| Öffentliche Doku erreichbar | `https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html` → HTTP 200, Stand 1.6, alle fünf Provider genannt; Landingpages verlinken die Policy | aktuell |

---

### B3 — „Time-of-Click Protection“ ist nur kosmetisch; der zugehörige Handler ist toter Code

**Belege**
- `background.js:823-835` `injectTimeOfClickProtection()`: das injizierte Funktionsliteral setzt ausschließlich
  `link.title = "Protected by Thundy Time-of-Click"` und `link.style.borderBottom`. **Kein** `click`-Listener,
  keine Abfrage, keine Warnung, keine Blockade. Repo-weit existieren in `background.js` nur zwei
  `addEventListener('click')` (`1137`, `1194`) — beide für die Buttons des Opt-in-Banners selbst.
- `background.js:1841-1893` `handleCheckLinkState()` (IndexedDB-Lookup + Live-Scan über urlscan.io) ist über
  `case "checkLinkState"` (`background.js:1980`) erreichbar — aber **es gibt im gesamten Repository keine
  Stelle, die `{ action: 'checkLinkState' }` sendet**: `grep -rn "checkLinkState" --include=*.js --include=*.html
  --include=*.md .` liefert ausschließlich `background.js:1980`. Der Pfad ist damit toter Code.
- Die frühere, echte Klick-Interception lag in einer inzwischen entfernten `content_script.js`; die
  Sicherheits-Historie beschreibt genau dieses Verhalten inklusive Fail-Closed-Anforderung für Nicht-HTTP-Schemes
  (`.jules/sentinel.md:11-14, 26-29`). `docs/STATUS.md:34` bestätigt die Entfernung als „toter Code“.

**Auswirkung:** Die beworbene Funktion existiert nicht mehr, wird aber weiter zugesagt:
„Time-of-Click protection. Links in the message can be checked at the moment you click them.“
(`docs/store_listing.md:49, 104`), „at the moment you click them (time-of-click protection, with an on-hover
notice)“ (`README.md:33`), „Wenn deaktiviert, werden Links erst im Moment des Klickens gescannt“
(`options.html:115`). Das ist eine Funktionsaussage, die der Code nicht einlöst (Policy 1 „No Surprises“).

**Fix:** eine der drei Varianten — (a) echte Klick-Interception im registrierten Message-Display-Skript
implementieren (Capture-Phase, Entscheidung per `runtime.sendMessage`, Fail-Closed für unbekannte Schemes),
anschließend ist `handleCheckLinkState` wieder erreichbar; (b) Funktion, Option, Doku- und Listing-Aussagen
streichen und `handleCheckLinkState` samt `case "checkLinkState"` entfernen; (c) ehrlich als rein visuellen
Hinweis umbenennen und beschreiben. Variante (a) passt zur Produktpositionierung, setzt aber den Weg aus B2
voraus.

---

### B4 — Popup überträgt auch ohne Zustimmung an Hybrid Analysis

**Belege**
- `api.js:82-83` liest `externalAnalysisConsent`.
- `api.js:136-154`: bei fehlender Zustimmung wird **nur** eine Hinweiskarte eingefügt („Es werden keine Hashes,
  Dateien oder Links an Analyse-Dienste übertragen“) — **kein `return`, kein Gate**.
- Danach läuft die Auswertung weiter: `api.js:170-219` öffnet die IndexedDB, liest gespeicherte Scans und reiht
  für jeden Anhang/jede URL `fetchTasks` ein; `api.js:678-691` (`get_hybrid_report_by_sha256`) ruft
  `api.js:513-547` (`fetch_hybrid_report`) → `fetch(...)` auf
  `https://hybrid-analysis.com/api/v2/overview/<sha256>` (`api.js:530`) — **ohne** Prüfung von
  `externalAnalysisConsent`, `mayTransmitExternally()` oder einer Host-Berechtigung.
- Testabdeckung: `api.test.js` enthält **keinen** Treffer für `externalAnalysisConsent`; der Popup-Pfad ist
  nicht auf Konsent-Einhaltung getestet. Im Hintergrundskript ist die Prüfung dagegen an allen Provider-Pfaden
  vorhanden (Abschnitt 2).

**Auswirkung:** Ein Nutzer, der die Zustimmung verweigert oder widerrufen hat, löst durch bloßes Öffnen des
Add-on-Popups (message_display_action) eine Übertragung des SHA-256-Hashes an hybrid-analysis.com aus — sofern
die optionale Host-Berechtigung für hybrid-analysis.com noch erteilt ist (typischer Fall: Zustimmung wurde nach
einem vorherigen Scan widerrufen; eine einmal erteilte Host-Berechtigung bleibt bestehen). Das
widerspricht `docs/privacy_policy.md:44-49` („Solange diese Zustimmung nicht erteilt ist, findet **keine**
Übermittlung an Dritte statt: … keine Hash-Abfrage bei Analyse-Diensten“), der Landingpage und dem Listing
(„Transmission happens **only** after you have enabled ‚Allow external analysis‘ *and* a scan has been
triggered“, `docs/store_listing.md:57`). Für ATN ist das ein datenschutzrelevanter Policy-Verstoß (Policy 1,
6.1, 6.2), der im Review leicht nachvollziehbar ist.

**Fix (minimal):** In `api.js` vor dem Aufbau der `fetchTasks` hard abbrechen, wenn
`externalAnalysisConsent !== true`, und die Hinweiskarte als Endzustand belassen. **Fix (robust, empfohlen):**
die Report-Abfrage in das Hintergrundskript verlegen (`runtime.sendMessage({ action: 'getHybridReport', sha256 })`)
und dort `assertExternalAnalysisAllowed()` erzwingen — dann existiert nur ein einziger, zentral gegateter
Übertragungspfad. In beiden Fällen Tests in `api.test.js` ergänzen („kein `fetch` bei Zustimmung aus“).


---

## 4. Hohe Risiken

### H1 — `data_collection_permissions.required = ["personalCommunications"]` passt nicht zum Opt-out-Modell
`manifest.json:14-16` deklariert die Kategorie als **required**. Laut Firefox-Datenkonsent-Doku bedeutet
„required“: „users must accept this data collection to use the extension; **they cannot opt out**“; die Kategorie
erscheint im Installationsprompt und in `about:addons`. Das Add-on überträgt dagegen ausschließlich nach
ausdrücklicher, jederzeit widerrufbarer Zustimmung (Default **aus**: `background.js:64-74, 1930`,
`docs/privacy_policy.md:36-56`). Die eigene Doku begründet die Deklaration auch anders als das Datenmodell
(„data is only transmitted after the global consent and a user action“, `README.md:179-181`) — genau das ist
`optional`. Zusätzlich ist unbelegt, ob Thunderbird 140 den eingebauten Datenkonsent-Prompt überhaupt zeigt;
`docs/reviewer_notes.md:73-75` behauptet das nur.
**Empfehlung:** auf `optional: ["personalCommunications"]` umstellen, den Opt-in im Optionsdialog zusätzlich
dort anmelden, wo die Umgebung es anbietet (`permissions.request({ data_collection: ['personalCommunications'] })`,
Feature-Detection über `permissions.getAll().data_collection`) und die eigene Checkbox als Fallback für
Umgebungen ohne eingebauten Konsent behalten (dafür sieht die Doku ausdrücklich ein „custom data collection
experience“ vor). Alternativ `required` behalten und im Reviewer-Dokument mit Quelle begründen.
**Risiko ohne Abgleich:** Review-Rückfrage bis Ablehnung wegen irreführender Deklaration; schlimmstenfalls ein
Installationshinweis, der der Datenschutzerklärung widerspricht.

### H2 — Veröffentlichte Doku/Listing ist nicht mehr deckungsgleich mit dem Code
Über B1/B3 hinaus:
- `docs/STATUS.md:32-34` nennt „15 Dateien (≈176 KB)“; der tatsächliche Build hat **17 Dateien / 179 276 Bytes**.
- `docs/store_listing.md:150` sagt „Language of the user interface | German (localisation not implemented yet)“,
  obwohl Manifest-Strings und Banner lokalisiert sind (`_locales/{en,de}`, `README.md:22`).
- `docs/STORE_READINESS_ANALYSIS.md:3` trägt weiter „Manifest-Version 1.5“ im Kopf, während die
  Blocker-Abschnitte 1.5er-Zustände beschreiben, die in 1.6 behoben sind.
- `README.md:165` begründet `scripting` u. a. mit „time-of-click hover notice“, was faktisch nur ein
  `title`-Attribut ist (B3).
**Empfehlung:** ein Doku-Durchgang in einem Commit, in dem jede Funktionsaussage gegen den Code geprüft und
nicht belegbare Aussagen gestrichen werden. ATN-Reviewer lesen genau diese Dateien.

### H3 — Kein automatisches Gate für „benutzte API ⇔ deklarierte Berechtigung“
Der `menus`-Fehler (B1) blieb durch 389 grüne Tests, Pre-Submit-Checks und `web-ext lint` **unbemerkt**; Ursache
ist ein Mock, der die API bereitstellt, die im Store-Build fehlt. In `.github/workflows/ci.yml:22-25` läuft nur
`node --test background.test.js` (ohne `api.test.js`, `options.test.js`, `db.test.js` und die Skript-Tests) sowie
`npx web-ext lint` ohne Warnungsfilter und ohne Build/Paketprüfung. Die vollständigen Definitionen liegen fertig
unter `docs/ci/ci.yml`/`docs/ci/release.yml`, sind aber nicht nach `.github/workflows/` übernommen
(Begründung: fehlende `workflows`-Berechtigung, siehe `docs/ci/README.md`).
**Empfehlung:** (a) `docs/ci/ci.yml` übernehmen bzw. `ci.yml` um `npm test`, Lint-Filter, Build und
`verify-package` erweitern; (b) in `scripts/pre-submit-checks.js` eine Zuordnung „verwendeter Namensraum →
erforderliche Berechtigung“ ergänzen (`menus`, `notifications`, `downloads`, `messagesRead`, `storage`,
`scripting`) und fehlende wie ungenutzte Berechtigungen melden; (c) in `background.test.js` die Mock-Umgebung an
die deklarierten Berechtigungen koppeln, damit ein fehlendes Recht Tests rot werden lässt.

### H4 — Reviewer-Testbarkeit der Kernfunktion ist nicht gegeben
`docs/reviewer_notes.md` beschreibt einen sauberen Testweg, der in diesem Stand aber zu einer Oberfläche ohne
Banner (B2) und ohne Kontextmenü (B1) führt. Die Zusage „Schutz vor Malware, Phishing und Betrug“ ist für einen
Reviewer damit nicht reproduzierbar; projektseitig fehlt die Live-Verifikation selbst (`docs/STATUS.md:54-63`).
**Empfehlung:** nach der Korrektur einen Live-Test in Thunderbird 140 ESR protokollieren (Version, Testfälle,
Screenshots), Ergebnis in `docs/STATUS.md` und `docs/reviewer_notes.md` festhalten und einen Testweg anbieten,
der mit Testdatenachrichten (auffälliger Absender, HTML-Anhang, Link) alle sichtbaren Zustände erzeugt.

---

## 5. Mittlere Punkte

| Nr. | Punkt | Beleg | Empfehlung |
|---|---|---|---|
| M1 | Ungenutzte, breitere Host-Patterns deklariert (`https://*.hybrid-analysis.com/*`, `https://*.virustotal.com/*`, `https://*.urlscan.io/*`), während Code und Optionsseite nur die Apex-Origins anfragen | `manifest.json:26-34` ↔ `background.js:77-83`, `options.js:130-135` | auf die tatsächlich genutzten Origins reduzieren (ATN-Doku: „Request permissions only when needed. Unnecessary requests may result in rejection during ATN review.“) |
| M2 | Oberfläche (Optionsseite, Popup) nur deutsch, obwohl die i18n-Infrastruktur vorhanden ist | `options.html`, `popup.html`, `options.js`, `api.js` (hartkodierte deutsche Strings) | Options-/Popup-Strings über `_locales` + `browser.i18n` lokalisieren (mindestens `en`) — ATN erwartet `en-US`-taugliche Oberflächen |
| M3 | Popup ermittelt den Tab über `tabs.query({active:true,currentWindow:true})` statt über die Message-API | `api.js:66-78` | `messageDisplay.getDisplayedMessages()` ohne `tabId` („currently active tab“) verwenden — robuster, kein `tabs`-Recht nötig |
| M4 | Keine echten Screenshots, nur SVG-Platzhalter (Pre-Submit-Check warnt) | `docs/screenshots/*.svg`, `docs/store_assets.md:19,31-34` | 3 PNG ≥ 1280 × 800 mit Testdaten aufnehmen (`docs/screenshot_capture.md`) — sinnvoll erst nach B2 |
| M5 | Signierung/Release nicht vorbereitet: kein signiertes XPI, `release.yml` nicht aktiv, keine ATN-API-Secrets | `docs/ci/release.yml`, `docs/store_listing.md:181` | `web-ext sign --channel listed` über den Release-Workflow, Secrets `ATN_API_KEY`/`ATN_API_SECRET` setzen |
| M6 | Zahlen-/Datums-Drift in der Doku (Dateianzahl, „localisation not implemented“, veralteter Analyse-Kopf) | `docs/STATUS.md:32-34`, `docs/store_listing.md:150`, `docs/STORE_READINESS_ANALYSIS.md:3` | siehe H2 |
| M7 | Produktname inkonsistent: Popup-Titel und H1 lauten „Thunderbird Security Antivirus aka Thundy AV“ | `popup.html:8,27` | auf „Thundy AV – Email Scanner for Thunderbird“ angleichen (ATN-Namenskonvention/Trademark-Hinweis) |
| M8 | Fehlschläge von Injektion und Provider-Anfragen landen nur im Log; kein Nutzerfeedback, keine Diagnose | `background.js:122-125`, zahlreiche `Logger.warn/error` | minimaler Statusbereich in den Optionen oder Notification bei fehlgeschlagener UI-Injektion — hilft auch dem Review |

---

## 6. Nicht automatisierbar — vor der Einreichung zwingend

1. **Live-Test in Thunderbird 140 ESR** (nach B1/B2/B3): Banner-Injektion, Threat-Banner, beide Banner-Buttons,
   `permissions.request()` aus dem Bannerpfad (Nutzer-Geste über `runtime.sendMessage`,
   `background.js:1938`), Kontextmenü-Einträge inkl. `info.linkUrl` bei `contexts: ["link"]` (Doku verlangt
   dafür eine Host-Berechtigung für den Kontext), Popup im 3-Pane und in einem Nachrichtenfenster.
2. **Screenshots** aufnehmen (M4) — erst nach erfolgreicher Verifikation.
3. **Datenschutzerklärung und Listing final abgleichen** (H2, B4-Fix) und die Live-Policy neu deployen.
4. **Signieren und einreichen**: `web-ext sign --channel listed`, Listing aus `docs/store_listing.md`,
   Releasenotes, Privacy-Policy-URL und Support-Kontakt hinterlegen.

---

## 7. Empfohlene Reihenfolge

**Schritt 1 (Funktion, blockiert alles andere):** B2 umsetzen (registriertes Message-Display-Skript +
Runtime-Messaging) und in TB 140 ESR live verifizieren; danach B3 (echte Klick-Interception oder Aussage
streichen) und B1 (`menus` deklarieren oder Funktion entfernen).
**Schritt 2 (Datenschutz):** B4 (Popup-Gate oder Verlagerung in den Hintergrund) inkl. Tests; H1
(Deklarationssemantik) plus Doku-Abgleich.
**Schritt 3 (Prozess):** H3 (vollständige CI, Permission-Konsistenz-Check, Mocks an deklarierte Rechte koppeln);
H2/M6 (Doku-Durchgang); M1 (Host-Patterns straffen).
**Schritt 4 (Release):** M4 Screenshots, M5 Signierung/Release, Einreichung; `docs/STATUS.md` und
`docs/STORE_READINESS_ANALYSIS.md` auf den finalen Stand bringen.

**Grobe Aufwandsschätzung:** Schritt 1 ≈ 1–3 Personentage (Umsetzung + Live-Test), Schritt 2 ≈ 0,5–1 Tag,
Schritt 3 ≈ 0,5 Tag, Schritt 4 ≈ 0,5–1 Tag (Screenshots, Signierung, Einreichung).


---

## Anhang A — Verifikationskommandos (in diesem Stand ausgeführt)

```bash
npm ci
npm run pre-submit-checks                      # 0 Fehler, 1 Warnung (Screenshots), Exit 0
npm test                                       # 389 Tests, 0 Fehler
npx web-ext lint --source-dir . --output json > /tmp/lint.json
node scripts/filter-lint-warnings.js /tmp/lint.json   # 0 Fehler, 26 bekannte TB-False-Positives
npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
node scripts/verify-package.js ./build         # 17 Dateien, 179 276 Bytes
```

Externe Referenzen, gegen die geprüft wurde:
- Thunderbird-MV3-Konvertierungsguide (`webextension-api.thunderbird.net/en/mv3/guides/manifestV3.html`):
  „The messageDisplay.onMessageDisplayed event has been removed, use onMessagesDisplayed instead.“;
  „getDisplayedMessage() … use getDisplayedMessages([tabId]) instead.“;
  „messageDisplayScripts API — Replaced by scripting.messageDisplay API.“
- Thunderbird-API-Referenz 156.0.1 (MV3) für `menus`, `messageDisplay`, `messageDisplayAction`,
  `scripting`/`scripting.messageDisplay`: Funktionsumfang sowie „Required permissions `menus`“ bzw. `messagesRead`.
- comm-central `mail/components/extensions/parent/ext-scripting-tb.js`: Injektionsweg für
  `messageDisplay`-Skripte über `registerScripts` in die `about:message`-Fenster von `messenger.xhtml` /
  `messageWindow.xhtml`.
- Thunderbird-Menü-Doku (`menus` → `ContextType`): `link` („Applies when the user context-clicks on a link“)
  und `message_display_action` (TB 89+) sind gültige, dokumentierte Kontexte.
- Firefox-Datenkonsent-Doku (`extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/`):
  „required … they cannot opt out“; Opt-in über `permissions.request({ data_collection: […] })`;
  Feature-Detection über `permissions.getAll().data_collection`; Fallback „custom data collection experience“.
- MDN `menus`: „To use this API you need to have the `menus` permission.“

## Anhang B — Delta zur bestehenden `STORE_READINESS_ANALYSIS.md`

| Befund dort | Stand 1.6 |
|---|---|
| B1 (MV3-APIs `messageDisplay`) | **behoben** (`onMessagesDisplayed`, `getDisplayedMessages`, `MessageList`-Behandlung) |
| B2/B3 (Datenschutz, Deklaration, Doku) | **überwiegend behoben** (Konsent zentral, Tier-Default `strict`, Policy/Listing neu); **neu offen:** Popup-Pfad ohne Gate (B4), Deklarationssemantik (H1) |
| B4 (Host-Rechte) | **behoben** (`optional_host_permissions`, valide Patterns, Runtime-Anfrage) |
| H10 (CI) | **teilweise behoben**: vollständige Definitionen liegen unter `docs/ci/`, aktiv ist eine reduzierte CI (H3) |
| H12 (Injektion/Kontextmenü) | **nicht behoben, jetzt konkretisiert**: `menus`-Berechtigung fehlt (B1), Injektionsweg wird nicht unterstützt (B2), Time-of-Click nur kosmetisch (B3) |
| M11 (`menus.create` Doppel-ID) | **behoben** (Guard + Logging) |
| — | **neu in diesem Dokument:** B3 (`checkLinkState` toter Code), B4 (Popup ohne Konsent-Gate), H3 (kein Permission-Gate in der CI), M1–M8 |
