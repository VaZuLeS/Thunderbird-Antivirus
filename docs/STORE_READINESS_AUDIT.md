# Store-Readiness-Audit — „Thundy AV“ 1.6 (unabhängige Nachprüfung)

**Prüfgegenstand:** Repository `VaZuLeS/Thunderbird-Antivirus`, Branch `main` @ `ae2a08e`, Add-on
„Thundy AV – Email Scanner for Thunderbird“ (`manifest.json`, MV3, `version` `1.6`)
**Zielplattform:** Thunderbird Add-ons Store (ATN, `addons.thunderbird.net`) — Listung + Signierung
**Prüfdatum:** 2026-09-29
**Prüfmethode:** Quellcode-Analyse aller Laufzeitdateien des XPI, eigene Laufzeit-Reproduktionen in
Node/jsdom (gemockte `browser.*`-API, Technik wie `background.test.js`), vollständiger Build-/Lint-/
Test-Durchlauf, Abgleich mit Mozilla Add-on Policies, der Firefox-Datenklassifizierung
(`data_collection_permissions`) und der Thunderbird-MV3-API-Referenz (Stand 156.0.1), Prüfung der
öffentlichen Release- und Policy-Seiten.
**Verhältnis zu `docs/STORE_READINESS_ANALYSIS.md`:** jenes Dokument beschreibt den Stand 1.5 und die
Abarbeitung in 1.6. **Dieses Audit prüft den daraus entstandenen Ist-Stand 1.6 neu und korrigiert
einzelne dortige Aussagen**, die nicht mehr zutreffen (u. a. „Blocker behoben“, Paketkennzahlen,
`menus`, Datenklassifizierung).

---

## 1. Gesamturteil

| Bereich | Status |
|---|---|
| Manifest-/Store-Validierung (`web-ext lint`, Paketinhalt, Version, Icons) | 🟢 **weitgehend bereit** — 0 Lint-Fehler, XPI enthält nur Laufzeitdateien |
| Datenschutz-Zusagen vs. Code | 🔴 **kritisch** — Consent-Bypass im Popup, automatische Übermittlung ohne Scan-Trigger |
| Kernfunktion (Schutz wie beworben) | 🔴 **kritisch** — Links/URLs werden nie geprüft, Banner-Opt-in endet immer in „Scan failed“, Popup bricht zur Laufzeit ab |
| Berechtigungen | 🟠 **hoch** — `menus` fehlt ⇒ beide Kontextmenü-Einträge funktionslos; `data_collection_permissions` falsch modelliert |
| Listing-/Asset-Reife | 🟠 **hoch** — keine echten Screenshots, keine Reviewer-Testmittel |
| Release-/Versionskonsistenz | 🟠 **hoch** — öffentliche Releases bis `v1.18.0` aus einem Entwicklungsbranch, `main` steht auf 1.6 |
| Qualitätssicherung | 🟡 **mittel** — 389 Tests grün, aber die CI führt nur 243 davon aus; die Gates prüfen keine API↔Permission-Konsistenz |
| Positiv | kein `innerHTML`/`eval`/Remote-Code, HTTPS-only-Ziele, 389 Tests grün, 0 Lint-Fehler, minimales XPI (17 Dateien / 179.276 B), Privacy-Policy live erreichbar und deckungsgleich, ausführliche Reviewer-Notes |

**Ergebnis: Das Add-on ist in der vorliegenden Fassung NICHT store-ready.** Neben formalen Lücken
existieren **fünf Blocker**; drei davon betreffen die Kernfunktion bzw. die Datenschutz-Zusage:
Das Popup überträgt SHA-256-Hashes samt API-Schlüssel an hybrid-analysis.com, **obwohl die globale
Zustimmung ausgeschaltet ist** (reproduziert); der zweistufige Opt-in im Nachrichten-Banner
scheitert immer (`TypeError`); die beworbene Link-/Phishing-Prüfung findet wegen eines
Aufrufffehlers nie statt. Eine Einreichung würde damit an Policy §3 („add-ons must function only as
described“) **und** §6.2 (Zustimmung und Kontrolle) scheitern.

**Befundzählung:** 5 Blocker (B1–B5), 7 hohe Risiken (H1–H7), 12 mittlere (M1–M12), 3 niedrige (N1–N3).


## 2. Blocker

### B1 — Consent-Bypass: Das Popup überträgt Hashes + API-Key ohne Zustimmung

**Belege (Code)**
- `api.js:82-83` liest die Zustimmung, verwendet sie aber nur für einen Hinweistext
  (`api.js:136-154`); der Daten-/Netzwerkpfad ab `api.js:156` läuft **bedingungslos**.
- `api.js:187-204`: Für jeden gespeicherten Anhang mit `att.state !== 'UNKNOWN'` wird eine
  Fetch-Aufgabe gebaut — ohne Consent-Prüfung.
- `api.js:513-530` — der Übertragungspunkt:
  ```js
  url: 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha,
  headers: { accept: 'application/json', 'api-key': apikey_hybridanalysis, 'user-agent': 'Falcon' },
  ...
  const response = await fetch(options.url, options);      // api.js:530 – blanker fetch
  ```
- `api.js:183` löscht unmittelbar davor den Consent-Hinweis aus dem DOM — die Warnung ist während
  der Übertragung nicht sichtbar.
- Die Vorbedingung ist mit Standardeinstellungen erfüllt: `background.js:1550-1551` schreibt auch bei
  ausgeschalteter Zustimmung einen Datensatz (`state = 'MANUAL_CHECK_PENDING'`, `background.js:1485-1495`),
  der in `background.js:1584-1636` persistiert wird und `!= 'UNKNOWN'` ist.
- Erreichbarkeit: `manifest.json:45-49` (`message_display_action.default_popup`), `popup.html:45`
  (`<script type="module" src="api.js">`).

**Eigene Reproduktion** (`popup.html` + `api.js` in jsdom, `externalAnalysisConsent = false`,
`fetch`-Spy; Ausgabe wörtlich):

```
UNCAUGHT (api.js): container is not defined
externalAnalysisConsent = false
Popup zeigt Hinweis: NEIN
Tatsaechliche Netzwerkaufrufe:
   GET https://hybrid-analysis.com/api/v2/overview/deadbeefcafe | headers: accept,api-key,user-agent
```

**Widerspruch zu eigenen Zusagen** (wortwörtlich)
- `docs/privacy_policy.md:26-28`: Übermittlung nur, wenn globale Zustimmung **und** ein Scan für die
  Nachricht bzw. den Absender ausgelöst wurde.
- `docs/privacy_policy.md:44-49`: „Solange diese Zustimmung nicht erteilt ist, findet **keine**
  Übermittlung an Dritte statt: … keine Hash-Abfrage bei Analyse-Diensten …“
- `options.html:45`: „Ohne diese Zustimmung werden **keine** Hashes, Dateien, Links oder IP-Adressen
  an externe Dienste übertragen.“
- `README.md:44-47`: „**Global consent – required for every transmission** … the background script
  enforces this switch for every code path that talks to a third party“.
- `docs/reviewer_notes.md:198-199` (Reviewer-Widerrufstest): „Re-opening messages must not produce
  any provider request anymore.“
- `docs/external_service_hardening.md` §2: „A key is only sent to the host it belongs to, and only
  after the global consent plus a runtime host permission for that provider.“

**Policy-Bezug:** §1 (No Surprises), §3 (Funktion wie beschrieben), §6.2/§6.2.1 (korrekte Angabe der
Datenpraktiken), §6.2.2.1 (ausdrückliche Zustimmung vor Übermittlung). Datenschutzrechtlich
relevant, weil die Policy die Einwilligung als Rechtsgrundlage nennt (`docs/privacy_policy.md:151-154`).

**Fix:** Consent-Guard **vor** dem Aufbau der Fetch-Aufgaben; Abfrage in den Hintergrund verlagern
(`runtime.sendMessage` → `assertExternalAnalysisAllowed()`, `background.js:68-74`) oder mindestens
über `apiGateway.fetchWithTimeout`; Consent bei `storage.onChanged` neu lesen; Hinweis behalten.
Regressionstest: Popup bei `externalAnalysisConsent = false` erzeugt **keinen** Netzwerkaufruf.
**Aufwand:** S (Guard) / M (Verlagerung in den Hintergrund)

### B2 — Das Popup ist funktional defekt (`ReferenceError: container`/`syncFragment`)

**Belege (Code)**
- `api.js:211-219`: `container.appendChild(taskFragment);` (`api.js:216`) — `container` ist in diesem
  Block **nicht deklariert**; die Deklarationen liegen in anderen Scopes (`api.js:36`, `:86`, `:221`,
  `:236`, `:248`).
- `api.js:191` und `api.js:208` übergeben `syncFragment`, das **nirgends zugewiesen** wird
  (`grep -n 'syncFragment' api.js` → nur Verwendungen 191, 208, 733, 736).

**Eigene Reproduktion** (wörtlich):
```
UNCAUGHT (api.js): container is not defined
```
bzw. bei einem Datensatz mit `state: 'UNKNOWN'`:
```
UNCAUGHT (api.js): syncFragment is not defined
```

**Auswirkung:** Kein Anzeigepfad des Popups funktioniert — keine Ergebnis-/Verdikt-Darstellung, keine
URL-Karten, kein manueller Upload-Button, keine sichtbare Fehlermeldung; der Consent-Bypass aus B1
bleibt dadurch unsichtbar. **Policy:** §3.

**Fix:** `container` am Blockanfang (`api.js:182`) deklarieren, `syncFragment` korrekt erzeugen und
durchreichen, Regressionstests für `UNKNOWN`, `MANUAL_CHECK_PENDING` und `links`.
**Aufwand:** S

### B3 — Beide Buttons des Opt-in-Banners enden immer in „Scan failed“

**Belege (Code)**
- `background.js:1951` legt ein unvollständiges Nachrichtenobjekt an:
  `const messageObj = { id: request.messageId };` — **ohne** `author`.
- Der Handler reicht es weiter (`background.js:1957-1958`) → `evaluateAndInjectThreats`
  (`background.js:1093-1097`) → `calculateThreatScore(message.author /* undefined */, …)`
  (`background.js:1095`) → `extractEmailAddress(undefined)` → `background.js:713`
  `const start = rawAuthor.lastIndexOf('<');` ⇒ `TypeError`.
- Der Fehler wird gefangen (`background.js:1960-1963`) und als `{success:false, error: …}`
  zurückgegeben; der Banner-Button zeigt daraufhin „Scan failed“ (`background.js:1162-1168`).

**Eigene Reproduktion** (`handleRequestScan` mit echten Funktionen, Consent + Host-Permission
vorhanden; Ausgabe wörtlich):
```
requestScan result = {"success":false,"error":"Cannot read properties of undefined (reading 'lastIndexOf')"}
injected calls: []
```

**Auswirkung:** Der beworbene zweistufige Opt-in („Scan this message only“ / „Always scan this
sender“) funktioniert nicht. Der einzige verbleibende Weg zur externen Analyse ist das Popup — das an
B1/B2 leidet. In Summe ist die beworbene externe Analyse über die UI derzeit **nicht benutzbar**
(§1/§3). Nebeneffekt: `addSenderOptIn()` läuft vor dem `try`-Block (`background.js:1946-1948`) und
persistiert den Absender trotz Fehlermeldung.

**Fix:** vollständiges `MessageHeader`-Objekt verwenden (`messageDisplay.getDisplayedMessages()`
liefert Header-Objekte) bzw. `author` defensiv behandeln; Test für den Banner-Pfad ergänzen.
**Aufwand:** S

### B4 — `data_collection_permissions` beschreibt das Add-on falsch („required“ statt „optional“)

**Beleg:** `manifest.json:14-16`
```json
"data_collection_permissions": { "required": ["personalCommunications"] }
```
Die offizielle Doku (extensionworkshop.com, „Firefox built-in consent for data collection and
transmission“) definiert:
> „When you specify data types in the required list, users must accept this data collection to use
> the extension; **they cannot opt out**.“ … „Optional data collection permissions are specified
> using the optional list. These aren’t presented during installation … and they aren’t granted by
> default. The extension can request that the user opts in … by calling `permissions.request()`.“

Tatsächlich ist jede Übermittlung ausdrücklich optional und standardmäßig **aus**:
`background.js:141` (`externalAnalysisConsent = false`), `options.html:43-45`,
`docs/privacy_policy.md:29,42,73`, `_locales/en/messages.json` („Nothing leaves your computer
without your explicit consent“). Die Deklaration verspricht dem Nutzer also eine **nicht
abschaltbare** Übermittlung von Kommunikationsinhalten, während die Extension mit strengen
Einstellungen vollständig lokal arbeitet. **Policy:** §6.2.1 („It must accurately state the data
collection practices in the extension manifest … in line with the Firefox add-on data classification
taxonomy“).

**Verschärfend:** Das eigene Gate zementiert das falsche Modell —
`scripts/pre-submit-checks.js:133-137` schlägt fehl, wenn `required` leer ist oder `"none"` enthält.
**Zu klären (ohne Live-Test nicht verifizierbar):** Ob Thunderbird 140 `data_collection_permissions`
überhaupt auswertet (die TB-Seite „Supported Manifest Keys“ listet den Key nicht). Wird er nicht
ausgewertet, verlangt Policy §6.2.2 einen **eigenen, unübersehbaren Consent-Schritt direkt nach der
Installation** — ein solches Onboarding existiert nicht; die Zustimmung liegt nur im Optionsdialog.

**Fix (empfohlen):** Übermittlung als optional modellieren (`required: ["none"]` +
`optional: ["personalCommunications"]`) und gegen den ATN-/AMO-Validator verifizieren; falls dieser
das nicht zulässt, alternativ die Zusage „jederzeit abschaltbar“ in Policy, Options- und Listing-Text
korrigieren. Zusätzlich `permissions.request({ data_collection: […] })` in derselben Nutzer-Geste wie
der Consent-Haken (heute nur Host-Origins: `options.js:137-153`) und den Pre-Submit-Check anpassen.
**Aufwand:** M (inkl. Verifikation gegen den Store-Validator)

### B5 — Fehlende `menus`-Berechtigung: beide Kontextmenü-Einträge entstehen nie

**Belege**
- `manifest.json:19-25` deklariert `messagesRead`, `storage`, `notifications`, `scripting`,
  `downloads` — **`menus` fehlt**.
- `background.js:1740-1762` (`createContextMenus()`) erzeugt zwei Einträge: „Scan link with Thundy AV“
  (`contexts: ["link"]`) und „Scan all links of this message“ (`contexts: ["message_display_action"]`),
  dazu `background.js:1811-1839` (`menus.onClicked`).
- Thunderbird-API-Referenz (`webextension-api.thunderbird.net/en/mv3/menus.html`): `menus.create()`
  und `menus.onClicked` sind mit **„Required permissions: menus“** dokumentiert. Ohne die
  Berechtigung ist die API nicht nutzbar; der Code fängt das still ab (`background.js:1741` Guard,
  `1757-1760` try/catch).
- Die Doku verspricht die Funktion dennoch: `docs/STATUS.md:26-28`, `docs/reviewer_notes.md` §2,
  `docs/store_listing.md`.

**Auswirkung:** Zwei beworbene Einstiegspunkte fehlen ohne jeden Hinweis. Die verwendeten Kontexte
sind laut Referenz **gültig** (`ContextType`: `link`, `message_display_action` seit TB 89) — es fehlt
ausschließlich die Berechtigung.
**Fix:** `"menus"` in `manifest.permissions` aufnehmen, Begründung in `docs/reviewer_notes.md`
ergänzen und einen Pre-Submit-Check „verwendete APIs ↔ deklarierte Berechtigungen“ einführen (heute
prüft `scripts/pre-submit-checks.js:14` nur eine Verbotsliste).
**Aufwand:** S

---

## 3. Hohe Risiken

### H1 — Automatische Übermittlung beim bloßen Öffnen einer Nachricht (ohne Nachricht-/Absender-Trigger)

**Belege (Code)**
- `background.js:1252-1279` (`handleDisplayedMessage`) ruft ohne jeden Trigger
  `processAttachments(message)` (`:1270`) und `evaluateAndInjectThreats(...)` (`:1275`) auf.
- Kette Anhänge: `:1039-1044` → `:1570-1586` → `:1528-1560`. Dort werden
  `fetch_virustotal_stats()` (`:1548`, Gate nur `mayTransmitExternally` + Host-Permission,
  `:1478-1481`) und `check_hybrid_analysis_for_attachment()` (`:1554`, Gate nur
  `mayTransmitExternally`, `:1497-1500`) aufgerufen.
- Kette IPs: `:1071-1091` → `checkIPReputation` (`:837-891`) → AbuseIPDB (`:337-356`) bzw.
  VirusTotal-IP (`:357-380`), Gate jeweils nur `mayTransmitExternally`.
- `canAutoUpload` (`:1260-1262`) steuert **nur** Banner und Anhang-Upload, **nicht** die Hash- und
  IP-Abfragen. `alwaysManual` (`:1550`) greift erst **nach** der VirusTotal-Abfrage (`:1548`).

**Eigene Reproduktion** (`probe_autoscan`, Consent **an**, Absender **nicht** opt-in, Tier `strict`):
```
OPT-IN LIST (scanningEnabledSenders): [] (kein Opt-in fuer bad@evil.example.com)
--- Netzwerkaufrufe beim blossen Oeffnen der Mail ---
GET https://www.virustotal.com/api/v3/files/66840dda… | header-keys: x-apikey,accept
GET https://hybrid-analysis.com/api/v2/overview/66840dda… | header-keys: accept,api-key,user-agent
GET https://api.abuseipdb.com/api/v2/check?ipAddress=203.0.113.7&maxAgeInDays=90 | header-keys: Key,Accept
```
Parallel zeigt der Code den Banner „real-time scanning is not enabled for this message“
(`background.js:1129`, Text aus `_locales/en/messages.json`).

**Widerspruch:** `docs/privacy_policy.md:26-28` („nur … wenn … ein Scan ausgelöst wurde“),
`docs/reviewer_notes.md:76-83` („No data is transmitted before the user has enabled both the global
consent and triggered a scan“), `options.html:107-109` („Kein Auto-Upload“). **Policy:** §1, §6.2.2.1.

**Fix:** Scan-Trigger explizit modellieren (z. B. `scanTriggered`-Flagge aus Opt-in/`requestScan`);
Hash- und IP-Abfragen hinter denselben Trigger legen wie den Anhang-Upload; Banner-Text an das
tatsächliche Verhalten koppeln.
**Aufwand:** M

### H2 — Die Link-/URL-Prüfung ist faktisch abgeschaltet (`extractTextFromParts` erhält ein Array)

**Belege**
- Aufrufstellen: `background.js:1048`
  (`let messageText = extractTextFromParts(fullMessage.parts || fullMessage);`) und
  `background.js:1788` (Kontextmenü „Scan all links“) — identische, fehlerhafte Form.
- Implementierung `background.js:1287-1306` arbeitet mit `part.contentType`/`part.parts`; ein **Array**
  hat beides nicht ⇒ Rückgabe `""`.
- Folgekette: `extractUrls("")` → `[]` (`:1309-1317`) → `filterUrls([])` → `[]` (`:1381-1403`) ⇒
  `processAndUploadUrls` ohne Wirkung (`:1052-1054`), `injectTimeOfClickProtection` ohne Wirkung
  (`:824`), `checkURLhausDomains` (`:919`, verlangt `filteredUrls.length > 0`) und urlscan werden nie
  erreicht; `evaluateLinks` erhält `urls = []` (`:762-769`).

**Eigene Reproduktion** (wörtlich):
```
with .parts (real call site): ""
with fullMessage object   : "Bitte Zahlung pruefen: http://evil.example.com/pay "
```
**Die Unit-Tests decken den Fehler nicht ab**, weil sie die Funktion korrekt mit einem Part-Objekt
aufrufen (`background.test.js:2010-2045`).

**Auswirkung:** Ein beworbenes Kernfeature (Phishing-/Link-Prüfung, `README.md:26`,
`docs/store_listing.md:34-35`) existiert nicht; „Alle Links dieser Nachricht scannen“ meldet immer
„keine Links gefunden“ (`notificationNoLinks`). Nebeneffekt: derzeit unterbleiben deshalb alle
URL-/Domain-Übermittlungen (URLhaus/urlscan/HA-URL-Upload).
**Fix:** `extractTextFromParts(fullMessage)` übergeben bzw. über `fullMessage.parts` iterieren;
Integrationstest mit echten `getFull`-Fixtures (mehrteilig, HTML-only, Plain-only).
**Aufwand:** S (Fix) / M (Tests + Fixtures)

### H3 — „Time-of-Click“/`autoScanLinks`/`checkLinkState`: beworbene Funktionen ohne Implementierung

**Belege**
- `background.js:823-835` ist die einzige „Schutz“-Handlung und rein kosmetisch
  (`link.title = "Protected by Thundy Time-of-Click"; link.style.borderBottom = …`); ein Klick-Hook
  existiert nicht.
- Der Live-Scan-Handler `handleCheckLinkState` (`background.js:1841-1894`, ruft `checkUrlscanIo`)
  hat **keinen Absender**: `grep -rn 'checkLinkState'` findet nur den `case` selbst
  (`background.js:1980`) — kein Aufrufer, kein Content-Script.
- `autoScanLinks` wird geladen/gespeichert (`background.js:137,220-221`) und in den Optionen als
  „irrelevant“ markiert (`options.js:44-52`, `options.html:113-116`), steuert aber keinen Code-Pfad.
- `options.html:120-121` verspricht, beim Überfahren von Links einen Echtzeit-Hinweis anzuzeigen.

**Auswirkung:** Falsches Sicherheitsgefühl (Tooltip behauptet aktiven Schutz); Nutzer entscheiden auf
Basis einer nicht existenten Funktion. **Policy:** §1, §3.
**Fix:** echten Klick-Hook im injizierten Code implementieren (mit Consent-Gate) **oder** Option,
Tooltip und Listing-Text entfernen.
**Aufwand:** S (Rückbau) / M (Umsetzung)

### H4 — Keine echten Screenshots; die SVG-Platzhalter dürfen nicht hochgeladen werden

**Belege**
- `docs/screenshots/` enthält ausschließlich drei SVGs (`inline_optin_banner.svg` 706 B,
  `options_page.svg` 1007 B, `warning_banner.svg` 499 B); im Repository existiert kein PNG/JPEG als
  Aufnahme einer echten Oberfläche.
- `node scripts/pre-submit-checks.js` warnt entsprechend („no PNG/JPEG screenshots found in docs/“).
- Die Platzhalter zeigen Zustände, die es nicht gibt (`options_page.svg:6` „Echtzeit-Scanning
  aktivieren (Opt-In)“, `:4` „Account: user@example.com“) → als Listung irreführend.
- Empfehlung des Stores: Bilder in 1280 × 800 px (extensionworkshop.com → „Create an appealing
  listing“).

**Fix:** drei PNGs ≥ 1280 × 800 aus Thunderbird 140 ESR aufnehmen (Anleitung liegt vor:
`docs/screenshot_capture.md`), danach `docs/store_assets.md` und `docs/store_listing.md` aktualisieren.
**Aufwand:** M — nur mit echter Thunderbird-Installation möglich

### H5 — Öffentliche Release-Historie widerspricht Repository und Doku (bis `v1.18.0` vs. `1.6`)

**Belege** (`gh api repos/VaZuLeS/Thunderbird-Antivirus/releases`, 2026-09-29):
- Veröffentlichte Releases `v1.6`, `v1.6.1`, `v1.7.0`, `v1.7.1`, `v1.8.0` … `v1.18.0`, jeweils mit
  XPI-Asset, `target_commitish: cline/nhfqgaap` (Entwicklungsbranch), publiziert am 2026-09-28/29;
  zusätzlich die Tags `v1.6`…`v1.18.0` und ein alter Draft `v1.5`.
- `manifest.json:8` (und `main`) stehen auf `"version": "1.6"`; `docs/store_listing.md:181` behauptet
  „the 1.6 artefact has not been built yet“.

**Auswirkung:** Objektiv falsche Doku-Aussage; bei der Einreichung erklärt werden muss, warum der
Store-Eintrag mit `1.6` startet, während öffentlich bis `1.18.0` verteilt wurde. Aus
Entwicklungsbranches gebaute XPIs sind zudem nicht durch eine Store-Signatur gedeckt und werden von
Nutzern trotzdem installierbar angeboten.
**Fix:** Release-/Tag-Lage bereinigen **oder** dokumentieren; die für die Store-Einreichung
vorgesehene Versionsnummer festlegen und überall angleichen.
**Aufwand:** S

### H6 — Banner-Injektion und `permissions.request()` aus dem Banner sind nicht live verifiziert

**Sachstand (belegt, aber offen)**
- Die Thunderbird-Referenz 156.0.1 kennt für `scripting.messageDisplay` **nur**
  `getRegisteredScripts`, `registerScripts`, `unregisterScripts` (jeweils „Added in TB 128“) — ein
  `scripting.messageDisplay.executeScript` existiert **nicht**; der entsprechende Zweig in
  `background.js:117-119` ist toter Code.
- **Entlastend:** Thunderbird dokumentiert für `registerScripts` ausdrücklich: „Registered scripts
  will only be applied to newly opened messages. To apply the script to already open messages,
  manually inject your script by calling `scripting.executeScript` for each of the open
  `messageDisplay` tabs.“ Der Fallback `background.js:121` ist damit der **dokumentierte** Weg.
- **Risiko:** Der Fehlerfall wird still geschluckt (`background.js:122-125`, nur `Logger.warn`). Wenn
  die Injektion in TB 140 scheitert, fehlen Opt-in-Banner, Warn-Banner und Auth-Hinweis — also der
  zweite Consent-Schritt und praktisch die gesamte In-App-Kommunikation.
- Ebenfalls ungeprüft: `permissions.request()` aus dem injizierten Banner heraus
  (`background.js:1938`, ausgelöst über `runtime.sendMessage`, `background.js:1990-1992`), und ob der
  injizierte Code `browser.i18n`/`browser.runtime.sendMessage` zur Verfügung hat (wird in
  `background.js:1106-1147` vorausgesetzt).

**Fix:** Live-Test in Thunderbird 140 ESR; für saubere Zukunftssicherheit auf
`scripting.messageDisplay.registerScripts()` umstellen (nur Dateien, kein `func`) und
Injektionsfehler sichtbar machen (z. B. Notification statt `Logger.warn`).
**Aufwand:** M — nur mit echter Thunderbird-Installation möglich

### H7 — Keine Reviewer-Testmittel (kein Test-Key, keine Testnachricht)

**Beleg:** `docs/reviewer_notes.md:218-220`: „No dedicated reviewer test key is included: the API key
required for a full end-to-end run is the reviewer's own free provider account.“
**Policy:** §3: „To facilitate the functional testing, the add-on author must provide testing
information and, **if an account is needed for any part of the add-on's functionality, testing
credentials** to allow use of the add-on.“ Die externe Analyse ist ein beworbenes Kernfeature.
**Fix:** dedizierten, widerrufbaren Provider-Key und eine Testnachricht/Fixture bereitstellen und im
ATN-Feld „Notes for Reviewers“ hinterlegen.
**Aufwand:** S

---

## 4. Mittlere und niedrige Befunde

| # | Befund | Beleg | Auswirkung / Fix | Aufwand |
|---|---|---|---|---|
| M1 | Die aktive CI prüft nur 243 von 389 Tests | `.github/workflows/ci.yml:22-23` (`node --test background.test.js`); die vollständige Definition liegt ungenutzt in `docs/ci/ci.yml` (Diff: `npm test`, Lint-Filter, Build+Paketprüfung). Erneut geprüft am 2026-09-29: ein Push mit dieser Workflow-Änderung wird weiterhin abgelehnt („refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml` without `workflows` permission“) — die Übernahme von `docs/ci/ci.yml` bleibt ein manueller Schritt | Regressionen in `api.test.js`, `db.test.js`, `options.test.js`, `api_gateway.test.js`, `pre-submit-checks.test.js` fallen nicht auf. Fix: `docs/ci/ci.yml` nach `.github/workflows/` übernehmen | S |
| M2 | Versionsangaben inkonsistent, vom eigenen Check verdeckt | `manifest.json:8` `1.6` vs. `package.json:3` `1.6.0`; `scripts/pre-submit-checks.js:215-225` normalisiert Nullen → „ok“, obwohl der Store `1.6 == 1.6.0` vergleicht | Ein späteres `1.6.0` wäre dieselbe Version. Fix: eine Schreibweise (`1.6.0`), Check auf String-Gleichheit | S |
| M3 | Popup-Branding nutzt „Thunderbird“ als Namenspräfix und „Antivirus“ | `popup.html:8,27` „Thunderbird Security Antivirus aka Thundy AV“; widerspricht `CHANGELOG.md` (Trademark-Entfernung) und `_locales/*` (`extensionName`) | Trademark-/No-Surprise-Risiko. Fix: Popup-Titel/H1 auf „Thundy AV“ | S |
| M4 | Sprache inkonsistent: `default_locale` = en, UI nur deutsch | `manifest.json:6`; `options.html:2`/`popup.html:2` `lang="de"`; `docs/store_listing.md:150` („Language: German“) vs. `docs/STATUS.md:35-36`/`README.md:22` („strings localized EN/DE“); Releasenotes nur DE | Englische Installationen sehen deutsche Options-/Popup-Texte. Fix: EN-Releasenotes + präzise Listing-Angabe (oder UI lokalisieren) | S–M |
| M5 | Paketkennzahlen in der Doku falsch | `docs/STATUS.md:33` („15 Dateien, ≈176 KB“) vs. gemessen **17 Dateien, 179.276 B** entpackt (48.092 B ZIP) | Irreführende Angabe; Fix: Zahlen korrigieren | S |
| M6 | `.webextignore` ist wirkungslos | `web-ext`/`addons-linter` lesen die Datei nicht (`grep -ril webextignore node_modules/web-ext node_modules/addons-linter` → kein Treffer); wirksam ist nur `web-ext-config.mjs`; `'LICENSE/**'` (Zeile 30) ist ein ungültiges Muster | Falsche Sicherheit, irreführende `CHANGELOG.md`-Aussage; Fix: Datei entfernen/als unwirksam kennzeichnen | S |
| M7 | `jsdom` steht unter `dependencies` | `package.json:25-30`; genutzt nur in Tests | Die ATN-Vendoring-Doku liest `dependencies` als gebündelte Laufzeitbibliothek (exakte Versionen gefordert); Fix: nach `devDependencies` | S |
| M8 | Konsolen-Logs enthalten vollständige URLs | `api_gateway.js:59,80` (`console.warn/error` mit `${url}`); zusätzlich fester `user-agent: Falcon` | URLs aus Mails können personenbezogene Parameter enthalten; Fix: Logs auf Host/Status reduzieren | S |
| M9 | Keine Redirect-Kontrolle in den `fetch`-Aufrufen | `grep -n redirect background.js api.js api_gateway.js` → keine Treffer; Keys laufen in Custom-Headern (`x-apikey`, `api-key`, `Auth-Key`, `Key`) | Theoretisches Key-Leak bei Cross-Origin-Redirect (nicht live verifiziert); Fix: `redirect: 'error'` bzw. Host-Prüfung | S |
| M10 | `apiGateway.setApikey()` wird nie aufgerufen ⇒ Gateway-Schutz ist toter Code | `api_gateway.js:6` (Definition), kein Aufruf; Keys werden an jeder Aufrufstelle manuell gesetzt; zwei Roh-`fetch` umgehen Gateway und Timeout (`background.js:1447`, `api.js:530`) | Die in `docs/external_service_hardening.md` §2 behauptete zentrale Key-Bindung wird nicht erzwungen; Fix: Gateway befüllen und überall nutzen | M |
| M11 | `menus.create()` ohne `menus.removeAll()`/Reset beim Start | `background.js:1740-1762`; Duplikat-IDs werden still gefangen (`:1757-1760`) | Menüeinträge können nach Neustarts fehlen; Fix: `removeAll()` vor dem Anlegen | S |
| M12 | Veraltete Doku-Pfade, widersprüchliche Asset-Aussagen | `docs/reviewer_notes.md:215` nennt `docs/screenshot-*.svg` (entfernt); `docs/store_assets.md:66` („Icon-Auflösungen offen“) vs. `docs/store_listing.md:173` („Icons … done“) | Widersprüchliches Review-Paket; Fix: angleichen | S |
| N1 | Keine Größen-/Parallelitätsgrenzen für Anhänge und Uploads | `background.js:1528-1586` (alle Anhänge parallel), `:2202-2217` (Upload ganzer Dateien, 60 s Timeout) | Speicher-/Bandbreitenlast bei großen Mails; Fix: Limit pro Nachricht/Größe | S |
| N2 | Kontextmenü-Titel werden nur einmal ermittelt | `background.js:1745,1750` (`msg()` beim Anlegen) | Sprachwechsel wirkt erst nach Neustart; kosmetisch | S |
| N3 | Selbstbezeichnung „Antivirus“/„Scanner“ ohne lokale Viren-Engine | `package.json:2`, Repo-Name, `docs/store_listing.md`; geprüft wird über Hashes/externe Dienste | Kein Policy-Verstoß, aber Erwartungsmanagement: im Listing klarstellen, dass keine Signatur-Engine enthalten ist | S |

---

## 5. Was bereits store-tauglich ist (Positiv-Bilanz)

1. **Paket:** `npx web-ext build` erzeugt ein XPI mit 17 Dateien (nur Laufzeitcode, Icons, `_locales`,
   `LICENSE`); `scripts/verify-package.js` prüft Inhalt und Größe; Tests, Docs, Lockfiles und
   `install.rdf` bleiben draußen.
2. **Lint:** `web-ext lint` → 0 Fehler, 26 Warnungen, alle Thunderbird-False-Positives
   (`messagesRead`, `messageDisplay.*`, `scripting.messageDisplay`, `messages.*`); sie sind in
   `scripts/filter-lint-warnings.js` einzeln aufgeführt (kein Blanko-Whitelist).
3. **Tests:** `npm test` → 389 Tests / 65 Suites / 0 Fehler.
4. **Kein Remote-Code, keine XSS-Senke:** kein `eval`, kein `new Function`, kein `innerHTML` im
   Laufzeitcode (nur ein Kommentar in `background.js:984`); Banner und Karten werden mit
   `createElement` + `textContent` gebaut; CSP `script-src 'self'; object-src 'none'`
   (`manifest.json:35-37`) plus Meta-CSP in `popup.html:6`.
5. **Netzwerkdisziplin:** alle Ziele fest verdrahtet und ausschließlich HTTPS
   (`hybrid-analysis.com`, `www.virustotal.com`, `urlscan.io`, `urlhaus-api.abuse.ch`,
   `api.abuseipdb.com`); keine Telemetrie, keine Analytics, keine Cookies.
6. **Berechtigungsmodell:** Host-Zugriffe liegen in `optional_host_permissions` (nicht
   `optional_permissions`), werden erst beim Speichern eines Anbieter-Keys zur Laufzeit angefragt
   (`options.js:137-153`) und im Hintergrund mit `hasHostPermissionFor` geprüft (`background.js:97-105`).
7. **Datenschutz-Dokumente:** zweisprachige Policy mit Empfängern, Drittlandtransfer, Aufbewahrung,
   Rechten und Kontakt; die gehostete Fassung ist erreichbar und inhaltlich deckungsgleich
   (Stichproben); Reviewer-Notes mit Datenfluss-Matrix und Testweg; `LICENSE` (MIT) vorhanden.
8. **Keine Drittanbieter-Laufzeitbibliotheken** in den ausgelieferten Dateien ⇒ derzeit weder
   Vendoring-Deklaration noch Source-Code-Einreichung erforderlich.

---

## 6. Verifikationsprotokoll (reproduzierbar)

```bash
npm ci
npm test                       # 389 Tests, 65 Suites, 0 Fehler (11,4 s)
node ./scripts/pre-submit-checks.js   # 0 Fehler, 1 Warnung (fehlende Screenshots), Exit 0
npx web-ext lint --source-dir . --output json > /tmp/lint.json
node scripts/filter-lint-warnings.js /tmp/lint.json   # 0 Fehler, 26 bekannte TB-Warnungen
npx web-ext build --source-dir . --artifacts-dir ./build
node scripts/verify-package.js ./build                # 17 Dateien, 179.276 B, "Package content is valid."
node /tmp/probe_popup.js        # Popup ohne Consent -> GET hybrid-analysis.com (B1)
node /tmp/probe_requestscan.js  # Banner-Button -> {"success":false,…lastIndexOf…} (B3)
node /tmp/probe_autoscan.js     # Öffnen ohne Opt-in -> VT/HA/AbuseIPDB-Abfragen (H1), Textextraktion "" (H2)
gh api 'repos/VaZuLeS/Thunderbird-Antivirus/releases?per_page=100'   # v1.6 … v1.18.0 (H5)
curl -sI https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html   # HTTP 200
```

Verwendete Quellen (alle am 2026-09-29 abgerufen):
- Thunderbird MV3-API-Referenz 156.0.1: `scripting.html`, `scripting.messageDisplay.html`,
  `messageDisplay.html`, `menus.html`, `guides/manifestV3.html`, `guides/vendoring.html`,
  `guides/sourceCodeSubmission.html`, `developer.thunderbird.net/add-ons/mailextensions/supported-manifest-keys`
- Annotierte Schemas: `thunderbird/webext-annotated-schemas` @ `release-mv3`
  (`schema-files/manifest.json`, `schema-files/scripting-tb.json`) — u. a. Beleg für
  `data_collection_permissions`, `PermissionNoPrompt` und den Hinweis, dass `scripting.executeScript`
  für bereits geöffnete `messageDisplay`-Tabs der dokumentierte Injektionsweg ist
- Mozilla/ATN: Add-on Policies (`extensionworkshop.com/documentation/publish/add-on-policies/`),
  „Firefox built-in consent for data collection and transmission“, „Submitting an add-on“,
  „Create an appealing listing“, „Source code submission“, „Third Party Library Usage“

---

## 7. Übertragungswege-Matrix (Ist-Zustand des Codes)

| # | Pfad (Beleg) | Voraussetzungen im Code | Gesendete Daten | Consent-Gate |
|---|---|---|---|---|
| 1 | HA-Hash-Abfrage beim Öffnen einer Nachricht (`background.js:1497-1503`, aufgerufen aus `:1554`) | HA-Key + `externalAnalysisConsent` | SHA-256, `api-key`, `user-agent: Falcon` | nur globale Zustimmung — **kein** Scan-Trigger (H1) |
| 2 | HA-Datei-Upload „quick-scan/file“ (`:1437-1447`) | Tier `balanced`/`max` + Zustimmung + HA-Key + unbekannter Hash | vollständiger Dateiinhalt, Dateiname, `api-key` | Zustimmung + Tier, aber ohne Trigger |
| 3 | HA-URL-Upload „quick-scan/url“ (`:2154-2175`) | Tier `max` + Zustimmung + HA-Key | URLs aus der Nachricht | ja (Zustimmung + Tier) |
| 4 | HA-URL-Upload aus dem Popup (`api.js:700` → `runtime.sendMessage` → `:2204 assertExternalAnalysisAllowed`) | Zustimmung + Trigger | URL | ja |
| 5 | Manueller Anhang-Upload (`:2202-2217`) | Zustimmung + Trigger | vollständige Datei, `api-key` | ja |
| 6 | VirusTotal-Hash-Abfrage (`:1478-1481`, `:1548`) | VT-Key + Zustimmung + Host-Permission | SHA-256, `x-apikey` | nur Zustimmung, **nicht** `alwaysManual` (H1) |
| 7 | VirusTotal-Hash-Abfrage (Fallback im HA-Umfeld, `:1901`) | Zustimmung + Key | SHA-256 | ja |
| 8 | VirusTotal-IP-Abfrage (`:357-380`, aufgerufen `:1076`) | Provider `virustotal` + Key + Zustimmung | IP aus `Received`-Headern | nur Zustimmung (automatisch) |
| 9 | AbuseIPDB-IP-Abfrage (`:337-356`, aufgerufen `:1076`) | Provider `abuseipdb` + Key + Zustimmung | IP | nur Zustimmung (automatisch) |
| 10 | URLhaus-Host-Abfrage (`:2298-2320`, aufgerufen `:919`) | URLhaus-Key + Zustimmung + `filteredUrls.length > 0` | Domain | ja — Pfad derzeit unerreichbar (H2) |
| 11 | urlscan.io Scan (`:2322-2349`) | urlscan-Key + Zustimmung + Aufrufer `checkLinkState` | URL (`visibility: unlisted`) | ja — Handler ohne Aufrufer (H3) |
| 12 | **Popup-Hash-Abfrage** (`api.js:513-530`) | HA-Key (**keine** Zustimmung nötig) | SHA-256, `api-key`, `user-agent: Falcon` | **fehlt — B1** |
| 13 | Lokale Entschärfung/Download (`:2008-2042`) | Nutzer-Trigger | keine Netzwerkdaten (Blob-URL + `browser.downloads`) | n/a |

Querschnittlich: Ziel-IP und User-Agent des Nutzers gehen an den jeweiligen Anbieter; TLS ist
verpflichtend (alle Ziele HTTPS). **Nicht** übertragen werden Betreff, Absender/Empfänger und
Nachrichtentext — konsistent mit `docs/privacy_policy.md`. Lokal gespeichert werden sie jedoch
(IndexedDB `thunderbird_av`, `browser.storage.local`), was die Policy ebenfalls offenlegt.

---

## 8. Restweg bis zur einreichbaren Listung

### 8.1 Zwingend (Blocker)

| # | Aufgabe | Aufwand | extern nötig |
|---|---|---|---|
| 1 | B1: Consent-Guard im Popup (oder Verlagerung in den Hintergrund) + Regressionstest | S–M | – |
| 2 | B2: `container`/`syncFragment` im Popup reparieren + Tests für alle Popup-Zustände | S | – |
| 3 | B3: `requestScan` mit vollständigem `MessageHeader` arbeiten lassen + Banner-Test | S | – |
| 4 | B4: `data_collection_permissions` korrekt modellieren (und Pre-Submit-Check anpassen); Consent-Geste um `permissions.request({data_collection: […]})` erweitern | M | Verifikation gegen ATN-Validator |
| 5 | B5: `menus` in `manifest.permissions` aufnehmen + Reviewer-Doku ergänzen | S | – |
| 6 | H1: Scan-Trigger explizit modellieren (Hashes/IPs nur nach Opt-in/Trigger) | M | – |
| 7 | H2: `extractTextFromParts(fullMessage)` korrigieren + Integrationstests | S–M | – |
| 8 | H3: Time-of-Click/Klick-Hook umsetzen **oder** Option + Tooltip + Listing-Text entfernen | S–M | – |
| 9 | H5: Release-/Tag-Lage klären und die Versionsnummer für die Einreichung festlegen | S | – |
| 10 | H4: drei echte PNGs (≥ 1280 × 800) aufnehmen und im Listing hinterlegen | M | **Thunderbird 140 ESR** |
| 11 | H6: Live-Test (Banner-Injektion, `message_display_action`-Menü, `permissions.request()` aus dem Banner, ggf. `contexts: ["link"]`) und Ergebnis dokumentieren | M | **Thunderbird 140 ESR** |
| 12 | H7: Reviewer-Testkey + Testnachricht bereitstellen | S | Provider-Konto |
| 13 | Listing ausfüllen, XPI signieren (`npx web-ext sign --channel listed`), Releasenotes (EN) hochladen | S–M | **ATN-Konto/API-Keys** |

### 8.2 Empfohlen (Hygiene, Review-Robustheit)

`npm test` in die aktive CI übernehmen (M1) · Versionsschreibweise vereinheitlichen und
Pre-Submit-Check verschärfen (M2) · Popup-Branding korrigieren (M3) · EN-Releasenotes und
Sprachangabe im Listing (M4) · Paketkennzahlen korrigieren (M5) · `.webextignore` entfernen (M6) ·
`jsdom` nach `devDependencies` (M7) · Logging ohne URLs (M8) · `redirect: 'error'` (M9) · Gateway
tatsächlich nutzen (M10) · `menus.removeAll()` (M11) · veraltete Doku-Pfade (M12) · Größenlimits (N1) ·
Erwartungsmanagement „keine Signatur-Engine“ (N3).

---

## 9. Grenzen dieser Prüfung

1. **Kein echter Thunderbird-Lauf.** Alle Laufzeitbeweise stammen aus Node/jsdom mit gemockter
   `browser.*`-API. Nicht live geprüft werden konnten: die Banner-Injektion in der Nachrichtenansicht
   (H6), `permissions.request()` aus dem Banner, ob Thunderbird 140 `data_collection_permissions`
   auswertet (B4), ob der Store SVG-Platzhalter akzeptiert (H4) und die ATN-seitigen
   Validator-/Reviewmeldungen (B4, H7, Listing).
2. **Kein Penetrationstest der Provider-APIs.** Es wurden keine Daten an Dritte übertragen; alle
   Nachweise nutzen `fetch`-Spies.
3. **`disarmHTML()`** (`background.js:2053-2152`) wurde nicht mit einem Bypass-Korpus getestet
   (Namespaces, `srcdoc`, CSS-`url()`, verschachtelte `<template>`). Die Umsetzung wirkt solide
   (Entfernen aktiver Tags, `on*`, `javascript:`/`data:`/`vbscript:` inkl. Kontrollzeichen), ist aber
   nicht als bewiesen anzusehen.
4. **Kein Versionsvergleich** mit älteren Ständen; geprüft wurde `ae2a08e` (= `origin/main`).
5. **Policy-Bewertung** beruht auf den am 2026-09-29 abgerufenen Live-Quellen; ATN kann eigene
   Review-Regeln anwenden.

---

## 10. Empfehlung in einem Satz

**Nicht einreichen, bevor B1–B5 behoben sind** — danach sind H1–H3 (Kernfunktion/Datentransparenz)
sowie H4–H7 (Screenshots, Live-Test, Reviewer-Testmittel, Release-Konsistenz) abzuarbeiten; die
mittleren Punkte sind überwiegend Einzeiler und sollten im selben Zug mitlaufen.




