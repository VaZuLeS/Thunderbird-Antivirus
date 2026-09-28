# Store-Readiness-Analyse — „Thundy AV“ (Thunderbird SECurity AntiVirus)

**Prüfgegenstand:** Repository `VaZuLeS/Thunderbird-Antivirus` (Thunderbird-WebExtension, MV3, Manifest-Version 1.5)
**Zielplattform:** Thunderbird Add-ons Store (ATN, addons.thunderbird.net) — Listung + Signierung
**Prüfmethode:** statische Code-Analyse, automatisierte Linter/Tests, XPI-Build-Inspektion, Abgleich mit Mozilla-Add-on-Policies, Thunderbird-Manifest-/MV3-Dokumentation, Prüfung der öffentlichen Projekt-/Rechtsseiten
**Datum:** siehe Git-Historie dieser Datei (Branch `cline/nhfqgaap`)

---

## 1. Gesamturteil

| Bereich | Status |
|---|---|
| Funktionalität unter Thunderbird MV3 (statisch geprüft) | 🔴 **kritisch** — zentrale APIs sind in MV3 entfernt und werden noch so verwendet |
| Manifest/Store-Validierung | 🟠 **hoch** — invalides Match-Pattern, nicht-MV3-konforme Keys, Fehlplatzierung von Host-Berechtigungen |
| Datenschutz-/Policy-Konformität | 🔴 **kritisch** — Datenübermittlung an Dritte ≠ Deklaration / Privacy-Policy / Außendarstellung |
| Listing-/Asset-Reife | 🔴 **kritisch** — keine echten Screenshots, kein vollständiges Listing-Paket, keine Reviewer-Testmittel |
| Paket-/Release-Hygiene | 🟠 **hoch** — 62 Dateien / 605 KB im XPI, davon 369 KB Testcode; Altlast `install.rdf`; wirkungsloses CI-Gate |
| Positiv | 371 Tests grün, keine Remote-Skripte/`eval`, keine Secrets im Repo, HTTPS-only, Opt-in-Ansatz, Doku-Entwürfe vorhanden |

**Ergebnis: Das Add-on ist derzeit NICHT Store-ready.** Eine Einreichung würde nach jetzigem Stand mit hoher Wahrscheinlichkeit mindestens in eine Ablehnung/Nachbesserungsschleife laufen (Datenschutz-Diskrepanz, fehlende Reviewer-Testbarkeit, fehlende Screenshots) — und selbst nach formaler Freigabe in Thunderbird 128+ **nicht wie beworben funktionieren** (entfernte MV3-APIs, siehe B1).

**Gezählte Befunde:** 6 Blocker (B1–B6), 12 hohe Risiken (H1–H12), 12 mittlere/kleine Punkte (M1–M12).

---

## 2. Blocker (vor Einreichung zwingend zu beheben)

### B1 — In MV3 entfernte `messageDisplay`-APIs ⇒ Add-on ist im Zielsystem praktisch funktionsunfähig
**Belege**
- `background.js:1509` → `browser.messageDisplay.onMessageDisplayed.addListener(tab_mail_open_display);`
- `background.js:1533`, `background.js:1562`, `api.js:72` → `browser.messageDisplay.getDisplayedMessage(...)`

**Regel** (Thunderbird MV3-Konvertierungsguide, `webextension-api.thunderbird.net/en/mv3/guides/manifestV3.html`):
> „The `messageDisplay.onMessageDisplayed` event has been removed, use `onMessagesDisplayed` instead.“
> „The `messageDisplay.getDisplayedMessage()` function has been removed, use `getDisplayedMessages([tabId])` instead.“

Die MV3-API-Referenz (Thunderbird 156) listet für `messageDisplay` nur noch `getDisplayedMessages()` und `onMessagesDisplayed`.

**Auswirkung**
1. `background.js:1509` wirft beim Laden des Hintergrundskripts einen `TypeError` → **alle danach folgenden Top-Level-Registrierungen laufen nie**: `menus.create` (1511), `menus.onClicked` (1517) und beide `browser.runtime.onMessage`-Listener (1638, 1668). Damit sind Popup-Aktionen, manueller Upload, Link-Scan, „HTML entschärfen“ und der Ein-Klick-Scan aus dem Banner tot („Receiving end does not exist“).
2. Der eigentliche Scan-Hook (Nachricht angezeigt → Anhänge/Links prüfen) wird nie registriert — die Kernfunktion des Add-ons fehlt vollständig.
3. `api.js` (Popup) bricht beim Aufruf von `getDisplayedMessage` ab.

**Fix:** Portierung auf `onMessagesDisplayed` (Rückgabe `MessageList`) und `getDisplayedMessages([tabId])`, Aufrufer an `MessageList` anpassen; Injektionen in die Nachrichtenansicht statt `scripting.executeScript({target:{tabId}})` über `scripting.messageDisplay.*` (vgl. H12). Zusätzlich: **Test in einer echten Thunderbird-140/ESR-Installation** (steht in `docs/STATUS.md` selbst noch als offener Punkt).


---

### B2 — `data_collection_permissions: { "required": ["none"] }` widerspricht der tatsächlichen Datenübermittlung
**Beleg:** `manifest.json:12–14`

Die Extension überträgt Anhangsinhalte (bis hin zu vollständigen Dateien), URLs und Message-Metadaten an **Drittanbieter**:
- vollständiger Datei-Upload: `background.js:1220–1246` (via `1297`, `1334`, `process_single_attachment` 1308ff)
- URL-Upload: `background.js:649–696` (Tier `max`), `background.js:1857ff`
- Abfragen: VirusTotal `background.js:1954ff`, URLhaus `1998ff`, urlscan.io `2021ff`, AbuseIPDB `214ff`

`"none"` bedeutet im Daten-Konsent-Modell: **es werden keine Daten übertragen.** Das ist hier objektiv falsch.

**Regel:** Firefox-Datenkonsent-Doku (`extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/`) — Taxonomie-Werte, `required` vs. `optional`, Consent über `permissions.request({ data_collection: [...] })`, Feature-Detection via `permissions.getAll()`; Mozilla-Policy 6.1/6.2: Übermittlung auf das für die Funktion Nötige begrenzen, Nutzerkontrolle sicherstellen.

**Empfehlung:** E-Mail-/Anhangsinhalte, die zur Analyse an Dritte gehen, als Datenart deklarieren (z. B. `personalCommunications`, ggf. `technicalAndInteraction`) statt `none`. Da Scannen Opt-in ist, gehören diese Werte in die **optional**-Liste mit Runtime-Consent und Opt-out.

**Risiko ohne Fix:** Ablehnung im Review (irreführende Daten-Deklaration) bzw. Entfernung der Listung.

---

### B3 — Widersprüche zwischen Code, Privacy-Policy und öffentlicher Darstellung (Policy 1 „No Surprises“ / 6.1)
**Belege**
- Öffentliche Website behauptet: *„The extension reads **no** email content, only attachments.“* (`docs/index_en.html`, `docs/index_de.html`, Abschnitt `#privacy`).
- Der Code liest jedoch bei **jeder angezeigten Nachricht** den vollständigen Nachrichtentext: `background.js:1047` `browser.messages.getFull(message.id)` → `extractTextFromParts`/`extractUrls` (1068ff, 1092ff) — unabhängig davon, ob für den Absender ein Opt-in vorliegt.
- Privacy-Policy behauptet: *„standardmäßig werden nur Hashes (z. B. SHA-256) zur Vorabprüfung übertragen“* (`docs/privacy_policy.md:13`). Faktisch ist der Default-Tier `balanced` (`background.js:14`) und `handle_unknown_attachment` lädt bei `balanced` **unbekannte Dateien vollständig hoch** (`background.js:1220–1246`).
- Die Policy nennt Telemetrie/Fehlerprotokolle („optional“, `docs/privacy_policy.md:14,18,29`) — im Code existiert **keine** Telemetrie. Umgekehrt fehlen die tatsächlich genutzten Dienste (VirusTotal, urlscan.io, URLhaus, AbuseIPDB).

**Regel:** Mozilla Add-on-Policies 1 (Listing muss beschreiben, was das Add-on tut und welche Informationen es überträgt), 6.1 (keine „ancillary information“, Begrenzung auf das Notwendige), 6.2 (Kontrolle durch den Nutzer).

**Fix:** (a) Code an die Aussage anpassen **oder** Aussage an den Code; (b) Default-Tier auf `strict` (nur Hashes) setzen, Voll-Upload nur nach ausdrücklicher Zustimmung; (c) Policy vollständig neu schreiben (alle Provider, alle Datenfelder, Upload-Verhalten je Stufe, Retention, Löschung, Kontakt); (d) Website-Text korrigieren.

---

### B4 — Host-Berechtigungen: invalides Pattern, fehlende Origin, keine Runtime-Anfrage ⇒ beworbene Funktionen können nicht arbeiten
**Belege**
- `manifest.json:31` → `"https://*urlhaus.abuse.ch/*"` ist **kein gültiges Match-Pattern** (Wildcard nur als vollständige Host-Komponente bzw. `*.domain`). Linter: `MANIFEST_OPTIONAL_PERMISSIONS: Invalid optional_permissions "https://*urlhaus.abuse.ch/*" at 6`. Aufgerufen wird ohnehin `https://urlhaus-api.abuse.ch/v1/host/` (`background.js:2003`) — der deklarierte Origin passt also auch inhaltlich nicht.
- `https://api.abuseipdb.com/*` fehlt im Manifest komplett, wird aber aufgerufen (`background.js:216`; `checkIPReputation` 715ff/737f).
- `browser.permissions.request()` wird **nur** für `https://hybrid-analysis.com/*` aufgerufen (`options.js:120`, `background.js:1674`). VirusTotal, urlscan.io, URLhaus und AbuseIPDB werden nie zur Laufzeit angefordert → die Fetches laufen ohne Host-Berechtigung und schlagen in MV3 fehl.
- Zusätzlich: `optional_permissions` ist in der Thunderbird-Tabelle „Supported Manifest Keys“ nur für **MV2** dokumentiert; ATN/MDN empfehlen für MV3 `optional_host_permissions` (MDN: „When using Manifest V3 or higher, optional host permissions should be specified using the optional_host_permissions manifest key.“ — die Nutzung in `optional_permissions` wird in Gecko ≥128 noch toleriert).

**Fix:** Hosts nach `optional_host_permissions` verschieben, Patterns korrigieren (`https://urlhaus-api.abuse.ch/*`, `https://api.abuseipdb.com/*`), je Provider einen Runtime-Request-Flow mit Begründung im UI implementieren — oder nicht funktionsfähige Provider/Features aus Code und Beschreibung entfernen.

---

### B5 — Listing-Assets fehlen (Screenshots, Listing-Paket, Reviewer-Testmittel)
**Belege**
- Es existieren nur SVG-Platzhalter: `docs/screenshot-1-inline-optin.svg`, `docs/screenshot-2-warning.svg`, `docs/screenshot-3-options.svg` sowie `docs/screenshots/{inline_optin_banner,options_page,warning_banner}.svg`. Es gibt **kein** PNG/JPG.
- Inkonsistenz: `docs/store_listing.md:22–25` referenziert `docs/screenshot-*.svg`, `docs/store_assets.md:8–10` fordert `docs/screenshots/*.png`, `docs/screenshot_capture.md` beschreibt die manuelle Aufnahme — offenbar nie durchgeführt.
- Kein Listing-Paket in ATN-Form (finale Kurz-/Langbeschreibung, Kategorie, Lizenz, Support-URL, Releasenotes): `docs/store_listing.md:32–37` ist ein Entwurf mit offenen Checkboxen.
- Keine belastbare Testanleitung für Reviewer: Der komplette Scan-Flow setzt einen kostenlosen **Drittanbieter-Account** voraus (Hybrid-Analysis-API-Key als Pflichtfeld, `options.html:45`). `docs/reviewer_notes.md` enthält keinen Testschlüssel und keine Schritt-für-Schritt-Teststrecke mit Beispielmail/-anhang.

**Fix:** echte Screenshots (empfohlen 1280×800+, PNG, ohne echte Nutzerdaten) aufnehmen; Listing-Texte finalisieren (siehe H7/H9); Reviewer-Notes mit Testweg und bereitgestelltem Testschlüssel ergänzen.

---

### B6 — Privacy-Policy als Listing-URL nicht verlinkt, Inhalt nicht review-fähig
- Positiv: Die Policy ist öffentlich erreichbar — `https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html` liefert HTTP 200 (GitHub Pages rendert `docs/privacy_policy.md`); auch `…/reviewer_notes.html` ist erreichbar.
- Negativ: `manifest.json:7` verlinkt nur den Root, dieser zeigt lediglich die Sprachauswahl (`docs/index.html`) und enthält **keinen Link zur Privacy-Policy**; `docs/index_en.html`/`index_de.html` haben einen Abschnitt „Privacy & Security“, aber ebenfalls keinen Policy-Link.
- Die Policy ist zudem inhaltlich nicht review-fähig: Platzhalter-Satz (`docs/privacy_policy.md:44`), Datum in der Zukunft (`:46`), fehlende Provider/Datenfelder (siehe B3/H11).

**Fix:** Policy finalisieren, im ATN-Listing als Privacy-Policy-URL eintragen und von der Landing-Page verlinken.


---

## 3. Hohe Risiken (Review- und Betriebsrisiken)

### H1 — Das Pre-Submit-Gate kann nie fehlschlagen (Exit-Code wird „geschluckt“)
`scripts/pre-submit-checks.js:4–7` setzt `process.exitCode = 2`, am Ende steht jedoch `process.exit(0)` (Zeile 43).
**Nachgewiesen:** Mit absichtlich geleertem `manifest.homepage_url` läuft das Skript mit `EXITCODE=0`, obwohl auf stderr `PRE-SUBMIT CHECK FAILED: manifest.homepage_url is empty` erscheint. Der CI-Step ist damit wirkungslos.
**Fix:** `process.exit(process.exitCode ?? 0)`; Checks erweitern (Match-Pattern-Validierung, Verbotsliste MV3-inkompatibler Keys, Pflichtfelder, Screenshot-/Listing-Check).

### H2 — Paketinhalt (XPI) unprofessionell/zu groß
`npx web-ext build` erzeugt **62 Dateien, 605 KB entpackt** (131 KB gezippt): davon **369 KB Testcode** (`background.test.js`, `api.test.js`, `options.test.js`, `db.test.js`, `content_script.test.js`, …) plus `docs/`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `scripts/pre-submit-checks.js`, `benchmark_compare.js`, `form_test.js`, `vt_test.js`, `test_disarm.html`, `examples/minimal_scan.sh`, `install.rdf`.
`content_script.js` ist toter Code (nur `content_script.test.js:47` liest die Datei); `api_gateway.js` wird nicht in `background.scripts` geladen.
Linter-Warnungen dazu: `INLINE_SCRIPT` (`test_disarm.html`), `FLAGGED_FILE_EXTENSION` (`examples/minimal_scan.sh`).
**Fix:** `.webextignore` bzw. `web-ext-config.mjs` (`ignoreFiles`) einführen, Dev-/Test-Artefakte ausschließen, im CI Paketliste + Maximalgröße prüfen.

### H3 — Legacy `install.rdf` mit abweichender ID und Version
`install.rdf:5–13`: ID `jan@bludau-it-services.de`, Version `1.0`, `maxVersion 5.0.*` (RDF-Manifest, für WebExtensions untauglich). Im Manifest stehen ID `bludau.it.services@gmail.com` und Version `1.5`.
**Fix:** `install.rdf` löschen. **Vor** der ersten Veröffentlichung die Add-on-ID endgültig festlegen — sie ist danach **nicht mehr änderbar**. Empfehlung der Thunderbird-Doku: E-Mail-artige ID auf einer **eigenen Domain** (z. B. `thundy-av@bludau-it-services.de`) statt einer echten Gmail-Adresse.

### H4 — Name beginnt mit „Thunderbird“ (Trademark-Risiko)
`manifest.json:3` Name „Thunderbird SECurity AntiVirus“ (auch in `docs/index_de.html`, Popup-/Options-Titel).
Mozilla Add-on-Policies, Abschnitt 2 (Content): *„Add-ons that make use of Mozilla trademarks must comply with the Mozilla Trademark Guidelines. If the add-on uses ‘Firefox’ in its name, the naming standard … is ‘<Add-on name> for Firefox’.“* Für Thunderbird gilt die analoge Konvention („… for Thunderbird“). Ein Name, der wie ein offizielles Produkt wirkt, ist ein klassischer Ablehnungsgrund.
**Fix:** Umbenennen (z. B. „Thundy AV — Email Attachment Scanner for Thunderbird“) und alle sichtbaren Titel konsistent nachziehen (`manifest.json:3`, `popup.html:8,27`, `options.html:7,23`, `docs/index_*.html`).

### H5 — Ein-Klick-Scan erzeugt dauerhaftes Opt-in (Widerspruch zu Doku und Nutzerkontrolle)
`background.js:1682–1684` (`requestScan` → `addSenderOptIn(...)` ohne Rückfrage). Der Button heißt „Für diese Nachricht scannen“ (`background.js:994`), die Reviewer-Notes versprechen „one-off scanning and **optional** persistent opt-in for the sender“ (`docs/reviewer_notes.md:15`). Faktisch wird ein einmaliger Scan zum **dauerhaften** Absender-Opt-in und damit ggf. zu automatischen Uploads künftiger Nachrichten (Default-Tier `balanced`).
**Fix:** zweiten, expliziten Opt-in-Schalter einführen oder Semantik im Buttonlabel offenlegen.

### H6 — Reviewer-Testbarkeit / Reviewer-Dokumentation lückenhaft
- `docs/reviewer_notes.md` begründet `messagesRead`, `scripting`, `storage` und optionale Host-Rechte, aber **nicht** `notifications` und `downloads` (`manifest.json:20,22`).
- Es fehlt der Hinweis, dass die Kernfunktion ohne Drittanbieter-Key nicht läuft, samt Anleitung, wie Reviewer einen Testschlüssel erhalten.
**Fix:** Permission-Begründungen vervollständigen, Test-Setup dokumentieren, Referenz-Screenshots konsistent halten.


### H7 — Beschreibung/Positionierung inkonsistent, Linter-Warnung zu `messagesRead`
- `manifest.json:6`: nennt nur „Hybrid-Analysis.com“ und enthält Sprachfehler („scanns“); das Store-Listing bewirbt zusätzlich VirusTotal/urlscan.io (`docs/store_listing.md:7`), die (noch) nicht funktionieren.
- `web-ext lint` meldet `MANIFEST_PERMISSIONS: Invalid permissions "messagesRead"` — aus Firefox-Sicht ein False Positive (Thunderbird-Permission), ATN nutzt aber dieselbe Linter-Pipeline; eine Begründung im Listing/Reviewer-Notes ist daher Pflicht.
**Fix:** Beschreibung auf tatsächlich funktionierende Features begrenzen, korrektes Englisch, `short_name` ergänzen.

### H8 — Falsche Icon-Pfade in Notifications, unvollständige Icon-Map
`background.js:1523,1544,1551` referenzieren `img/icon-64px.jpg`; vorhanden sind nur `img/icon-16px.png`, `img/icon-32px.png`, `img/icon-64px.png` → Notifications mit fehlerhaftem Icon.
Zusätzlich deklariert `manifest.json:52–54` nur `icons.64`; Add-on-Manager und Store zeigen 32 px und 64 px.
**Fix:** Pfade korrigieren und `browser.runtime.getURL('img/icon-64px.png')` verwenden; `icons` um 16/32/48/64 ergänzen.

### H9 — MV3-inkonforme Manifest-Details
- `options_ui.browser_style: true` (`manifest.json:50`) → Linter: `MANIFEST_FIELD_UNSUPPORTED: "/options_ui/browser_style" is not supported in manifest versions > 2.` → entfernen (Styling kommt aus `theme.css`).
- `content_security_policy` ist in der Thunderbird-Tabelle nur für MV2 gelistet (vermutlich Doku-Ungenauigkeit, da Firefox MV3 `extension_pages` unterstützt). Die CSP selbst ist korrekt restriktiv — in Thunderbird verifizieren.
- `options_ui.open_in_tab: false` bei sehr umfangreicher Optionsseite → `open_in_tab: true` ist robuster.

### H10 — CI prüft nur einen Bruchteil und liefert kein Release-Artefakt
`.github/workflows/ci.yml` führt Tests nur als `node --test background.test.js` aus (371 Tests existieren über viele Dateien), `npx web-ext lint` ohne `--warnings-as-errors`, kein `web-ext build`-Gate, keine Paket-/Manifest-Validierung, kein Signier-/Submit-Schritt.
Positiv: Die Läufe sind auf GitHub grün (`gh run list`); `actions/checkout@v7`/`setup-node@v7` existieren in dieser Umgebung.
**Fix:** `npm test` (voller Lauf), Lint mit Warnungen als Fehler oder kuratierter Allow-List, Build+Paketliste als Gate, `web-ext sign` bzw. Veröffentlichungs-Workflow mit Release-Asset.

### H11 — Privacy-Policy unvollständig und in Teilen falsch
`docs/privacy_policy.md`: nennt nur „externe Analyse-Dienste“ ohne Namen; erwähnt nicht existente Telemetrie (Z. 14/18/29); behauptet Hash-only-Default (Z. 13); widersprüchliche API-Key-Aussage („Keine Speicherung von API‑Schlüsseln im Client‑Repo. Server‑seitige Speicherung …“, Z. 25 — faktisch liegen alle Schlüssel unverschlüsselt in `storage.local`, siehe `options.js:6–14`, `background.js:72ff`); Datum in der Zukunft (Z. 46); Rest-Platzhalterformulierung (Z. 44).
**Fix:** vollständige Policy (Datenarten je Feature, Provider inkl. Zweck/Land/Retention, Rechtsgrundlage, Opt-out/Löschung, unverschlüsselte lokale Schlüsselablage transparent nennen, Kontakt, Datum).

### H12 — Injektion/Kontextmenü: wahrscheinlich funktionslose UI-Pfade
- Banner-Injektionen via `browser.scripting.executeScript({target:{tabId}})` in Nachrichtenansichts-Tabs: `background.js:700, 853, 973`. Der Thunderbird-MV3-Guide nennt `messageDisplayScripts` als **ersetzt durch `scripting.messageDisplay`** — der vorgesehene Weg für Nachrichteninhalte. Ob `scripting.executeScript` auf `messageDisplay`-Tabs wirkt, muss in Thunderbird verifiziert werden; andernfalls greifen Opt-in-Banner, Threat-Banner und Time-of-Click nicht.
- Kontextmenü `contexts: ["link"]` (`background.js:1511–1515`): Thunderbird dokumentiert u. a. `message_list`, `message_display_action`, `message_display_action_menu`, `message_attachments`; ein Link-Kontextmenü im Nachrichtentext ist nicht dokumentiert → Feature „Link mit Thundy scannen“ vermutlich nie auslösbar.
- `browser.permissions.request()` aus dem Hintergrund nach `runtime.sendMessage` (Banner-Button, `background.js:1674`) erfordert in Gecko eine Nutzer-Geste; ob diese den Messaging-Weg übersteht, muss in Thunderbird getestet werden — sonst funktioniert der gesamte Opt-in-/Permission-Flow nicht.


---

## 4. Mittlere und kleine Punkte

### M1 — Versions-/Metadaten-Inkonsistenzen
`manifest.json` 1.5, `install.rdf` 1.0, `package.json` ohne `name`/`version`/`license`; Release „Thundy AV v1.5“ ist noch **Draft**, während ein alter Release („Thunderbird Email Anitivirus by Hybrid Analysis“, Tippfehler im Titel) als „Latest“ geführt wird. Kein `CHANGELOG`.
**Fix:** Single Source of Truth für die Version, `package.json` vervollständigen, Releasenotes je Version im Listing pflegen.

### M2 — Keine Lokalisierung
Kein `_locales`/`default_locale`; alle UI-Strings sind hart deutsch (`options.html`, `popup.html`, `background.js:990–1026`), Manifest-Name/-Beschreibung englisch. ATN-Listings erwarten mindestens `en-US`-taugliche Metadaten.
**Fix:** `_locales/{en,de}` mit `__MSG_*__` im Manifest und `browser.i18n` im UI.

### M3 — Dev-Dokumentation passt nicht zum Projekt
`docs/quickstart.md` beschreibt ein anderes Produkt (`make build`, `cargo build --release`, `./thunderbird-antivirus --scan .`). `SECURITY.md` ist das Mozilla-Template mit Platzhalter-Versionen („5.1.x, 4.0.x“) und ohne echten Meldekanal. `docs/STATUS.md` nennt „170 Tests“ und ein Datum 2026-07-08; dort stehen zentrale Punkte wie „external-service-hardening“, „manual compatibility testing“ und „screenshots“ weiterhin als offen.
**Fix:** Quickstart auf WebExtension-Workflow umschreiben (`npm ci`, `npm test`, `npx web-ext build`, Test über „Load Temporary Add-on“ in `about:debugging` bzw. `web-ext run --firefox=/pfad/zu/thunderbird` — ein `--target thunderbird` existiert in web-ext **nicht**, siehe auch die fehlerhafte Anweisung in `docs/screenshot_capture.md:24`), SECURITY.md auf reale Versionen/Support-Kanal, STATUS.md aktualisieren.

### M4 — Meta-/Prozessreste in veröffentlichten Dateien
`docs/reviewer_notes.md:41`, `docs/store_listing.md:40`, `docs/STATUS.md:23`, `docs/screenshot_capture.md:36` enthalten `Co-authored-by: Copilot App …` bzw. an den Autor gerichtete Floskeln („If you want, I can generate quick SVG placeholders…“, `docs/store_assets.md:12`). Das wirkt im Reviewer-Dokument unprofessionell.

### M5 — `.gitignore` unvollständig
Nur `node_modules/`. `build/` (XPI-Artefakte), `web-ext-artifacts/`, Logs (`test_output.log` liegt im Repo) fehlen → Gefahr, Artefakte erneut in den nächsten Build/Commit zu ziehen.

### M6 — Keine Build-/Paketkonfiguration
Weder `.webextignore` noch `web-ext-config.mjs`; im README wird `npx web-ext build --source-dir . --artifacts-dir ./build` beschrieben, das ohne Ignore-Regeln alles einpackt (siehe H2).

### M7 — UI-/Styling-Abhängigkeiten ohne Framework
`options.html` nutzt Bootstrap-Klassen (`btn-primary`, `mb-3`, `text-danger`, `ml-2`), die nur teilweise in `theme.css` nachgebaut sind (`theme.css:115–127` deckt `btn-primary`/`mb-3` ab, `text-success`, `card`, `alert-error`, `grid-header` teilweise nicht). Optik ist also inkonsistent — visuell im Review sichtbar.

### M8 — `strict_min_version: 140.0`
Für MV3 ausreichend (TB 128 ESR wäre möglich) und für `data_collection_permissions` nötig. Bewusste Entscheidung, aber sie schließt TB 128/older ESR aus — im Listing dokumentieren und Kompatibilitätstests auf 140 ESR + aktuelle Release-Version fahren.

### M9 — Feature „IP-Reputation“ ist ohne UI nicht erreichbar
`ipReputationProvider`/`ipReputationApiKey` werden in `background.js:101–106, 737f` gelesen, existieren aber in `options.html`/`options.js` **nicht** → toter Konfigurationspfad (und ohne Host-Permission ohnehin funktionslos, siehe B4). Entweder UI+Permission nachliefern oder Code entfernen.

### M10 — Doppelte `runtime.onMessage`-Listener und inaktives Gateway
`background.js:1638` und `1668` registrieren zwei getrennte `onMessage`-Listener (funktioniert, ist aber unsauber); `api_gateway.js` inkl. Timeout-/Rate-Limit-Handling ist implementiert, aber nie geladen und wird von `background.js` nicht genutzt (Fetch-Timeouts fehlen dadurch im Produktivpfad).

### M11 — `menus.create` beim Start ohne Guard auf Reduktion
`background.js:1511` erzeugt das Kontextmenü bei jedem Hintergrundstart; bei MV3-Eventpages kann das je nach Startreihenfolge zu „duplicate ID“-Fehlern führen, wenn nicht vorher `menus.removeAll()` läuft (im Code nicht vorhanden).

### M12 — `author`/Support-/Listing-Metadaten noch offen
`manifest.json:4` `author: "Jan Bludau"`; Listing braucht Support-E-Mail (in `docs` vorhanden: `bludau.it.services@gmail.com`), Kategorie, Lizenz-Verweis (MIT, `LICENSE` vorhanden) und Releasenotes. Derzeit nur als Entwurf vorhanden.

---

## 5. Was bereits gut ist (nicht „kaputt reparieren“)

- **Keine Remote-Code-Ausführung:** kein `eval`, kein `new Function`, keine geskripteten Remote-Imports; CSP `script-src 'self'; object-src 'none'` gesetzt (`manifest.json:33–35`).
- **Keine Secrets im Repo** (Grep auf Hex-/Token-Muster ohne Treffer); API-Keys werden ausschließlich lokal gehalten.
- **Host-Rechte als Opt-in** statt `<all_urls>` — genau die Richtung, die ATN-Reviewer sehen wollen; `webRequest` wird nicht verwendet.
- **Konservative Defaults für Scans**: `alwaysManual`-Option, Whitelist/Blacklist, Privacy-Tiers.
- **371 Unit-Tests grün** (`node --test`, 0 Fehler) inkl. Fokus auf DOM-Sicherheit („Sichere DOM-Manipulation ohne innerHTML“) und Security-Attribute der Key-Felder.
- **Dokumentationsbasis vorhanden**: Privacy-/Reviewer-/Store-Entwürfe, Screenshot-Guide, Pre-Submit-Check-Skript, GitHub-Pages-Seite live.
- **MIT-Lizenz** und Community-Dateien (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CODEOWNERS) vorhanden.


---

## 6. Maßnahmenplan (priorisiert)

### Phase 0 — „Überhaupt lauffähig“ (ohne das ist alles Weitere sinnlos)
1. **B1**: `messageDisplay.onMessageDisplayed` → `onMessagesDisplayed`, `getDisplayedMessage` → `getDisplayedMessages` (Code + `api.js` + Tests/Mocks), Injektionen auf `scripting.messageDisplay` umstellen.
2. Manueller Test in Thunderbird 140 ESR: Nachricht mit Anhang öffnen (Banner + Konsole), Popup öffnen, Kontextmenü prüfen (H12).

### Phase 1 — Formale Store-Blocker
3. **B4**: `optional_host_permissions` einführen, Patterns korrigieren, fehlende Origin ergänzen, Runtime-Request je Provider (oder Feature streichen).
4. **H1**: `scripts/pre-submit-checks.js` Exit-Code reparieren und Checks erweitern; CI-Step muss rot werden können.
5. **H9/H3/H8**: `browser_style` entfernen, `icons` 16/32/48/64, `install.rdf` löschen, Icon-Pfade korrigieren, ID vorher endgültig festlegen.
6. **H2**: `.webextignore` + `web-ext-config.mjs`; Paket auf ~15 Dateien/< 150 KB reduzieren.

### Phase 2 — Datenschutz/Policy (wahrscheinlichster Ablehnungsgrund)
7. **B2/B3/H11**: Datenkonsent-Deklaration korrigieren; Default-Tier `strict`; `addSenderOptIn` nur nach expliziter Bestätigung (H5); Privacy-Policy neu schreiben (Drittanbieter, Datenfelder je Stufe, Retention, unverschlüsselte Key-Ablage); Website-Aussagen korrigieren.
8. **B6**: Policy-URL im Listing eintragen und von der Landing-Page verlinken.

### Phase 3 — Listing/Review
9. **B5**: echte Screenshots aufnehmen; `docs/store_assets.md`/`store_listing.md`/`screenshot_capture.md` konsistent machen.
10. **H4**: Add-on umbenennen (Trademark) und Titel überall angleichen.
11. **H6**: Reviewer-Notes vervollständigen (alle Permissions begründen, Testablauf, Testschlüssel, erwartete Netzwerkziele).
12. **H7/M2/M12**: Beschreibung/Kategorie/Lizenz/Releasenotes + Lokalisierung (`_locales`) fertigstellen.

### Sofort anwendbare Patch-Vorschläge

**`manifest.json` (Struktur-Skizze)**
```json
{
  "manifest_version": 3,
  "name": "Thundy AV – Email Attachment Scanner for Thunderbird",
  "version": "1.6",
  "browser_specific_settings": {
    "gecko": {
      "id": "thundy-av@bludau-it-services.de",
      "strict_min_version": "140.0",
      "data_collection_permissions": { "optional": ["personalCommunications"] }
    }
  },
  "permissions": ["messagesRead", "storage", "notifications", "scripting", "downloads"],
  "optional_host_permissions": [
    "https://hybrid-analysis.com/*",
    "https://*.hybrid-analysis.com/*",
    "https://*.virustotal.com/*",
    "https://urlscan.io/*",
    "https://*.urlscan.io/*",
    "https://urlhaus-api.abuse.ch/*",
    "https://api.abuseipdb.com/*"
  ],
  "options_ui": { "page": "options.html", "open_in_tab": true },
  "icons": { "16": "img/icon-16px.png", "32": "img/icon-32px.png", "64": "img/icon-64px.png" }
}
```
> Hinweis: Die Datenkonsent-Werte müssen exakt zur Umsetzung passen (siehe B2) — kein Platzhalter in die Einreichung.

**`.webextignore` (neu)**
```
*.test.js
*_test.js
benchmark_compare.js
form_test.js
vt_test.js
test_disarm.html
content_script.js
scripts/
docs/
examples/
.github/
install.rdf
package-lock.json
pnpm-lock.yaml
test_output.log
build/
```
> `README.md`, `LICENSE`, `manifest.json`, `background.js`, `db.js`, `options.*`, `popup.html`, `theme.css`, `img/` bleiben im Paket.

**`scripts/pre-submit-checks.js` (Kern-Fix)**
```js
} catch (e) {
  fail('exception during checks: ' + e.message);
  console.error(e);
}
process.exit(process.exitCode || 0);   // statt hartem process.exit(0)
```

**`.github/workflows/ci.yml` (Erweiterung)**
- `npm test` (alle Testdateien) statt nur `background.test.js`
- `npx web-ext lint` mit Fehlerbehandlung für Warnungen (oder kuratierte Allow-List der bekannten TB-False-Positives)
- `npx web-ext build --overwrite-dest` + Schritt, der Dateiliste und Größe prüft
- Signier-/Release-Job (`web-ext sign --channel listed`) mit ATN-API-Secret


---

## 7. Anhang — Nachweise, Reproduktion, Quellen

### Reproduktion der Befunde
```bash
npm ci
node --test --test-reporter=spec                # 371 Tests, 0 Fehler
node ./scripts/pre-submit-checks.js; echo $?     # -> 0 (Gate wirkungslos, siehe H1)
npx web-ext lint --source-dir .                  # 0 Fehler / 19 Warnungen
npx web-ext build --source-dir . --artifacts-dir /tmp/build --overwrite-dest
unzip -l /tmp/build/thunderbird_security_antivirus-1.5.zip   # 62 Dateien
```

### `web-ext lint` (addons-linter 10.13.0) — 0 Fehler / 19 Warnungen
| Code | Anzahl | Bewertung |
|---|---|---|
| `UNSUPPORTED_API` (`messages.*`, `messageDisplay.*`) | 13 | überwiegend False Positive (Linter läuft mit Firefox-Zielsetzung) — **außer** `messageDisplay`: in Thunderbird-MV3 real entfernt (B1) |
| `MANIFEST_PERMISSIONS` (`messagesRead`) | 1 | Thunderbird-Permission, für ATN-Review zu begründen (H7) |
| `MANIFEST_OPTIONAL_PERMISSIONS` (`https://*urlhaus.abuse.ch/*`) | 1 | **echter Fehler** (B4) |
| `MANIFEST_FIELD_UNSUPPORTED` (`options_ui.browser_style`) | 1 | echter MV3-Verstoß (H9) |
| `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` | 1 | für ATN irrelevant |
| `INLINE_SCRIPT` (`test_disarm.html`) | 1 | Dev-Artefakt im Paket (H2) |
| `FLAGGED_FILE_EXTENSION` (`examples/minimal_scan.sh`) | 1 | Dev-Artefakt im Paket (H2) |

### XPI-Inhalt (Ist-Zustand)
62 Dateien, 605 KB entpackt, 131 KB gezippt; davon 369 KB Unit-Testcode und 27 KB `docs/`. Enthalten sind u. a. `install.rdf`, `test_disarm.html`, `examples/minimal_scan.sh`, `scripts/pre-submit-checks.js`, `package.json`, beide Lockfiles, sämtliche `.test.js` und das komplette `docs/`-Verzeichnis (siehe H2).

### Geprüfte fremde Quellen
- Thunderbird MV3-Konvertierungsguide: `webextension-api.thunderbird.net/en/mv3/guides/manifestV3.html` (entfernte APIs, `scripting.messageDisplay` als Ersatz für `messageDisplayScripts`, „keine JS-Strings mehr in MV3“)
- Thunderbird „Supported Manifest Keys“: `developer.thunderbird.net/add-ons/mailextensions/supported-manifest-keys` (`optional_permissions`, `content_scripts`, `content_security_policy` dort nur MV2)
- Thunderbird „Using Content Scripts“ (`messageDisplayScripts` benötigt `messagesModify`, MV2) und MV3-Referenz der `scripting`-API
- MDN: `optional_permissions` / `optional_host_permissions` (MV3-Empfehlung, Gecko ≥128)
- Firefox Extension Workshop: „Manifest V3 migration guide“, „Firefox built-in consent for data collection and transmission“, „Add-on Policies“ (Abschnitte 1, 2, 6/6.1/6.2), „Submitting an add-on“
- Projektzustand: `gh run list` (CI grün), `gh release list` (Draft „Thundy AV v1.5“), öffentliche Seiten `https://vazules.github.io/Thunderbird-Antivirus/{,privacy_policy.html,index_en.html}` (HTTP 200)

### Nicht statisch prüfbar (nur in echtem Thunderbird)
Live-Verhalten der Injektionen, `permissions.request` aus einer Nutzer-Geste über Messaging, Kontextmenü-Kontexte, tatsächliche Netzwerkziele zur Laufzeit, Optik der Optionsseite. `docs/STATUS.md` führt „manual compatibility testing across Thunderbird versions“ selbst noch als offenen Punkt — dieser Test ist vor jeder Einreichung Pflicht, da er mindestens B1 und H12 aufdecken würde.

### Empfohlene Einreichungsreihenfolge
`Phase 0` → `Phase 1` → (manueller TB-Test) → `Phase 2` → `Phase 3` → XPI bauen, `npx web-ext sign --channel listed`, Listing ausfüllen, Privacy-Policy-URL + Screenshots hochladen, Releasenotes schreiben.


---

## 8. Umsetzungsstatus (Version 1.6)

Alle Blocker und die Phase-1/2-Maßnahmen wurden umgesetzt; die verbleibenden Punkte sind bewusst
als manuelle Schritte dokumentiert (siehe `docs/STATUS.md`).

| Befund | Status in 1.6 | Umsetzung |
|---|---|---|
| B1 entfernte `messageDisplay`-APIs | **behoben** | `onMessagesDisplayed` + `getDisplayedMessages()` über `messageListToArray()`/`getFirstDisplayedMessage()`; Injektionen zentral über `injectIntoMessageDisplay()`; 12 neue Unit-Tests |
| B2 falsche Daten-Deklaration | **behoben** | `data_collection_permissions.required: ["personalCommunications"]` (kein `"none"` mehr); Pre-Submit-Check erzwingt Konsistenz |
| B3 Widersprüche Code/Policy/Website | **behoben** | Globale Zustimmung `externalAnalysisConsent` (Default AUS) erzwingt "keine Übermittlung ohne Zustimmung" (`mayTransmitExternally()`/`assertExternalAnalysisAllowed()`); Default-Tier `strict`; Website-Texte korrigiert; Policy neu geschrieben |
| B4 Host-Berechtigungen | **behoben** | `optional_host_permissions` mit 7 validen Patterns inkl. `urlhaus-api.abuse.ch` und `api.abuseipdb.com`; Runtime-Anfrage nur für konfigurierte Anbieter (`options.js`); `hasHostPermissionFor()` vor jedem Provider-Aufruf |
| B5 Listing-Assets | **teilweise** | Icons 16/32/48/64/128 generiert und in `manifest.json` verdrahtet (dimensionsgeprüft); Listing-Texte, Kategorien, Checkliste und Screenshot-Anleitung vollständig; **echte PNG-Screenshots fehlen weiterhin** (erfordert eine Thunderbird-Instanz) |
| B6 Privacy-Policy-URL | **behoben** | Policy live unter `https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html`, aus `index.html`/`index_en.html`/`index_de.html` verlinkt, Pre-Submit-Check prüft die Verlinkung |
| H1 wirkungsloses CI-Gate | **behoben** | `scripts/pre-submit-checks.js` als testbares Modul mit echtem `process.exitCode` (21 Unit-Tests inkl. Nachweis, dass Fehler fehlschlagen) |
| H2 Paketinhalt | **behoben** | `web-ext-config.mjs`/`.webextignore`; XPI: 15 Dateien, ≈176 KB entpackt statt 62 Dateien/605 KB; `scripts/verify-package.js` als CI-Gate |
| H3 `install.rdf` | **behoben** | Datei entfernt, neue ID `thundy-av@bludau-it-services.de` |
| H4 Trademark-Name | **behoben** | „Thundy AV – Email Scanner for Thunderbird“ (+ `short_name`), Pre-Submit-Check lehnt `Thunderbird*` als Namenspräfix ab |
| H5 stilles Dauer-Opt-in | **behoben** | Banner mit zwei Buttons („Nur diese Nachricht scannen“ / „Absender dauerhaft scannen“); `requestScan` persistiert nur mit `persist: true` (durch Tests abgedeckt) |
| H6 Reviewer-Testbarkeit | **behoben** | `docs/reviewer_notes.md` mit Permission-Begründungen (inkl. `notifications`, `downloads`), Datenfluss-Matrix, Netzwerkzielen und Schritt-für-Schritt-Testweg |
| H7 Beschreibung/Positionierung | **behoben** | Manifest-Beschreibung lokalisiert (`_locales/en|de`), Feature-Umfang an die tatsächlich funktionierenden Funktionen angepasst |
| H8 Icon-Pfade | **behoben** | `notify()` nutzt `runtime.getURL('img/icon-64px.png')`; Icons 16/32/48/64/128 deklariert und vorhanden |
| H9 MV3-inkonforme Keys | **behoben** | `browser_style` entfernt, `open_in_tab: true`, `optional_permissions`/`content_scripts` werden vom Pre-Submit-Check verboten |
| H10 CI | **behoben (Spiegel)** | Workflow: `npm ci` → Pre-Submit-Checks → `npm test` (alle Testdateien) → Lint mit Filter unerwarteter Warnungen → Build + Paketprüfung, zusätzlich Signier-Job (`web-ext sign --channel`). Die Definitionen liegen unter `docs/ci/` (Push nach `.github/workflows/` scheitert an der fehlenden `workflows`-Berechtigung des Tokens, siehe `docs/ci/README.md`); alle referenzierten Skripte sind aktiv im Repository |
| H11 Privacy-Policy | **behoben** | Vollständige, zweisprachige Policy (Provider namentlich, Datenarten je Stufe, Retention, unverschlüsselte Schlüsselablage, Rechte, Kontakt) |
| H12 Injektion/Kontextmenü | **teilweise** | Injektion über Helper mit Logging bei Fehlschlag; zusätzlicher, dokumentierter Kontext `message_display_action` („Alle Links dieser Nachricht scannen“); der `contexts: ["link"]`-Eintrag bleibt bestehen, ist aber weiterhin nur im Live-Test verifizierbar |
| M1–M12 | **überwiegend behoben** | Versions-/Metadaten-Konsistenz (1.6), `_locales`, README/Quickstart/SECURITY/CHANGELOG/STATUS neu, `.gitignore` erweitert, Toter Code (`content_script.js`) entfernt, doppelte `onMessage`-Listener zusammengeführt, IP-Reputation hat jetzt UI-Felder, Kontextmenü-Erstellung gegen Doppel-IDs abgesichert |

### Vor der Einreichung noch zu tun (nicht automatisierbar)

1. **Live-Test in Thunderbird 140 ESR** (Pflicht): Banner-Injektion, `message_display_action`-Kontextmenü,
   Time-of-Click-Hinweis, `permissions.request()` aus dem Banner heraus und das Verhalten des
   `contexts: ["link"]`-Eintrags.
2. **Echte Screenshots** (PNG, ≥ 1280 × 800) gemäß `docs/screenshot_capture.md` aufnehmen und im Listing hinterlegen.
3. **Signieren und einreichen**: `web-ext sign --channel listed` (bzw. `release.yml`) und Listing in ATN ausfüllen
   (`docs/store_listing.md`).

### Verifikationskommandos (Stand 1.6)

```bash
npm ci
npm run pre-submit-checks      # 0 Fehler, 1 Warnung (fehlende Screenshots)
npm test                       # 389 Tests, 0 Fehler (inkl. Tests der Check- und Build-Skripte)
npx web-ext lint --source-dir . --output json > /tmp/lint.json
node scripts/filter-lint-warnings.js /tmp/lint.json   # 0 Fehler, 26 bekannte TB-Warnungen
npx web-ext build --source-dir . --artifacts-dir ./build
node scripts/verify-package.js ./build                # 15 Dateien, ≈176 KB

# Workflow-Definitionen (Spiegel) nach .github/workflows/ übernehmen:
cp docs/ci/ci.yml .github/workflows/ci.yml
cp docs/ci/release.yml .github/workflows/release.yml

```

---

## 9. Nachaudit (zweiter Durchgang nach der Umsetzung)

Nach Abschluss der Phasen 0–3 wurde der Auslieferungscode erneut vollständig geprüft — diesmal mit Fokus
auf die *neu hinzugekommenen* Pfade (Consent-Gate, i18n, Build-/Paket-Gates) und auf die Frage, ob die
Dokumentation exakt zum Verhalten passt. Ergebnis: **zwei neue Befunde, beide behoben.**

### NA-1 (Blocker, behoben) — Consent-Bypass im Popup (`api.js`)

`fetch_hybrid_report()` hat den Bericht für einen Anhang **direkt** von `https://hybrid-analysis.com` geladen
(`api.js:525ff`, `fetch` ohne Zeitlimit), ohne die globale Zustimmung oder die Host-Berechtigung zu prüfen.
Die Zustimmung wurde nur für den Hinweistext ausgelesen. Damit wurden nach einem Widerruf der Zustimmung
weiterhin Hashes übertragen, sobald das Popup für eine Nachricht mit lokal gespeicherten Scan-Ergebnissen
geöffnet wurde — im Widerspruch zu Policy §3.1/§4 („ohne Zustimmung werden keine Daten übermittelt“).

**Fix:** `externalAnalysisAllowed()` (liest die Zustimmung bei **jedem** Aufruf neu aus dem Speicher) und
`hasHybridHostPermission()` als Top-Level-Funktionen in `api.js`; der Cache-Eintrag wird weiterhin synchron
angelegt, damit parallele Aufrufe denselben Request teilen. Fehlende Zustimmung/Berechtigung führt zu den
Fehlercodes `EXTERNAL_ANALYSIS_DISABLED` / `PERMISSION_DENIED`, ohne zusätzlichen Fehlerbanner (der
Hinweis-Banner im Popup erklärt die Situation).

**Nebenbefund aus dem Fix:** Die Helfer lagen zunächst *innerhalb* der Init-IIFE von `api.js` und waren für
`fetch_hybrid_report()` (Top-Level) nicht sichtbar — im echten Popup hätte das einen `ReferenceError` ausgelöst.
Die Unit-Tests haben das aufgedeckt; die Funktionen liegen jetzt auf Top-Level.

**Tests:** drei neue Tests im Suite „get_hybrid_report_by_sha256“ (keine Übertragung bei widerrufener
Zustimmung, keine Übertragung ohne Host-Berechtigung, Prüfung erfolgt zum Aufrufzeitpunkt statt nur beim
Popup-Start).

### NA-2 (niedrig, behoben) — Datei-Upload ohne Zeitlimit

`handle_unknown_attachment()` hat den Anhang mit direktem `fetch()` hochgeladen und damit als einziger
Provider-Aufruf das `ApiGateway` umgangen (kein Timeout/Abort, abweichende Header-Logik).
**Fix:** `apiGateway.fetchWithTimeout(url, options, 60000)` — konsistent zu `handleManualUpload`.

### NA-3 (Dokumentationslücke, behoben) — lokal gespeicherte Nachrichten-Metadaten

Die IndexedDB-Einträge enthalten neben Scan-Ergebnissen und Link-Metadaten auch **Absenderadresse,
Betreff, Dateiname und SHA-256-Hash** der geprüften Anhänge (`background.js:1630–1716`). Die
Datenschutzerklärung nannte diese Felder nicht.
**Fix:** Abschnitt 8 der Datenschutzerklärung (DE und EN) listet sie jetzt ausdrücklich auf und stellt klar,
dass sie ausschließlich lokal bleiben; die Reviewer Notes wurden entsprechend präzisiert.

### Was der Nachaudit bestätigt hat

- **Vollständigkeit der Gates:** Alle 13 Provider-Aufrufe im Auslieferungscode sind entweder durch das globale
  Consent-Gate (`assertExternalAnalysisAllowed()`/`mayTransmitExternally()`) oder durch eine übergeordnete
  Prüfung abgedeckt; kein `fetch` in `options.js`, `db.js` oder den HTML-Seiten.
- **Konsistenz Doku ↔ Code:** Die Aussage „Unabhängig von der Datenschutz-Stufe … urlscan.io/URLhaus/IP-Reputation
  nur mit Schlüssel und Zustimmung“ (Policy §3.3) entspricht dem Code (`handleCheckLinkState`, `checkURLhausDomains`,
  `checkIPReputation`). Die Tier-Tabelle meint ausschließlich die Hybrid-Analysis-Uploads.
- **Keine Secrets, kein Remote-Code:** kein `eval`, kein `new Function`, keine Remote-Skripte, keine
  Zugangsdaten im Repository; API-Schlüssel ausschließlich lokal und nur in HTTPS-Headern an den jeweiligen Anbieter.
- **Keine Protokollierung sensibler Werte** (Suche nach API-Key-/Text-/Hash-Ausgaben in `Logger`/`console`).

### Verifikation nach dem Nachaudit

```bash
npm run pre-submit-checks   # 0 Fehler, 1 Warnung (fehlende echte Screenshots)
npm test                    # 392 Tests, 0 Fehler
web-ext lint + Filter       # 0 Fehler, 26 bekannte TB-False-Positives
web-ext build + verify      # 17 Dateien, ~179 KB, Inhalt valide
```

### Unverändert offen (nur manuell möglich)

1. Live-Test in Thunderbird 140 ESR (Banner-Injektion, `message_display_action`-Kontextmenü, Time-of-Click,
   `permissions.request()` aus dem Banner, `contexts: ["link"]`).
2. Echte PNG-Screenshots für das Listing.
3. Signierung und Einreichung bei addons.thunderbird.net.
