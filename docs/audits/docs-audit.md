# Doku-/Policy-Audit — Thundy AV (Store-Readiness, ATN)

- **Repo:** `/workspace` · **Branch:** `cline/k0d34w90` · **Basis-Commit:** `4c4898c` · **Add-on-Version:** 1.6
- **Auditor:** unabhängiger Doku-/Policy-Auditor (task_0002)
- **Stand:** 2026-09-30
- **Methode:** Rein lesend. Aussagen werden gegen den Code (Datei:Zeile) und gegen öffentliche
  Mozilla-/Thunderbird-Dokumente (URL) geprüft. Keine Änderung getrackter Dateien, keine Commits.
- **Basisfakten (selbst nachgemessen in dieser Umgebung):**
  - `npm test` → **389 Tests, 0 Fehler** (Suite-Ausgabe `tests 389 / pass 389 / fail 0`).
  - `node scripts/pre-submit-checks.js` → Exit **0**, **1 Warnung** (`no PNG/JPEG screenshots found in docs/`).
  - `npx web-ext lint --source-dir . --output json` → **0 Fehler, 26 Warnungen, 0 Notices** (`/tmp/lint.json`).

**Schweregrade:** Blocker = Einreichung wird abgelehnt / Policy-Verstoß · hoch = Reviewer-Nachfrage oder
irreführende Datenschutz-Aussage sehr wahrscheinlich · mittel = inkonsistente/unvollständige Doku ·
niedrig = kosmetisch/veraltet.

---

## 1. Datenfluss-Konsistenz: Tier-Tabellen vs. Code

**Quellen der Tabellen:** `docs/privacy_policy.md:75–79` (§3.3), `docs/privacy_policy.md:107–113` (§5),
`docs/store_listing.md:58–64` (EN), `docs/store_listing.md:116–122` (DE), `docs/reviewer_notes.md:85–93` (§4).

**Code-Gegenprobe (Kurz):**

| Aussage der Doku | Code | Ergebnis |
|---|---|---|
| Default-Tier `strict` | `background.js:135` `let privacyTier = "strict";` | ✅ deckt sich |
| Hash an HA in **allen** Stufen | `background.js:1502–1507` (GET `overview/<hash>`, keine Tier-Bedingung) | ✅ |
| Hash an VirusTotal in **allen** Stufen, nur mit VT-Key | `background.js:1482–1487`, `background.js:2257–2265` | ✅ |
| Voll-Upload nur `balanced`/`max`, nur wenn Hash unbekannt | `background.js:1441–1442`, `1509` (200 ⇒ KNOWN, sonst Upload) | ✅ (automatischer Pfad) |
| URL-Upload an HA nur `max` | `background.js:779–798` (`privacyTier === 'max'`) | ✅ (automatischer Pfad) |
| Domains an URLhaus, sofern Key | `background.js:921–923`, `2302–2308` (keine Tier-Bedingung) | ✅ |
| IPs an AbuseIPDB/VT, sofern Anbieter+Key | `background.js:841–866` + Guard in `337–338`/`357–358` | ✅ |
| urlscan.io nur bei URL-/Link-Prüfung, sofern Key | `background.js:1876–1878`, `2326–2328` | ✅ |

### DOC-01 — Manueller Voll-Upload umgeht die Datenschutz-Stufe (hoch)
- **Beleg:** `docs/privacy_policy.md:109–110` („Vollständiger Anhang … nur Stufe `balanced` und `max`“),
  `docs/store_listing.md:61` und `:117` („complete attachment of unknown files … tier *balanced*/'max' only“).
  Code dagegen: `background.js:2206–2219` (`handleManualUpload` → `quick-scan/file`, **keine** Tier-Prüfung,
  nur `assertExternalAnalysisAllowed()` in `:2208`). Erreichbar über `runtime.onMessage`-Fall
  „manualUpload“ (`background.js:1970–1977`) aus dem Popup. `README.md:205–206` räumt den Pfad ein
  („… or start a manual upload from the popup“), Privacy-Policy und Store-Listing tun das **nicht**.
- **Auswirkung:** Die Datenschutz-Zusage „strikt = nur Hash“ ist im manuellen Pfad falsch; ein Reviewer,
  der im Tier `strict` einen manuellen Upload auslöst, sieht den vollständigen Anhang den Rechner verlassen.
  Das ist eine irreführende Datenübermittlungs-Angabe (Policy 6.1/„No Surprises“).
- **Fix-Skizze:** In `privacy_policy.md` §5 und `store_listing.md` eine Zeile ergänzen: „Vollständiger Anhang
  auch bei manuellem Upload aus dem Popup, unabhängig von der Stufe“ — oder `handleManualUpload` an
  `privacyTier` binden.

### DOC-02 — Manueller Link-Scan sendet URLs unabhängig von der Stufe (mittel)
- **Beleg:** `docs/privacy_policy.md:111` und `docs/store_listing.md:62` („URLs … Stufe `max`“);
  `docs/reviewer_notes.md:90` („URLs from the message | tier `max` | Hybrid Analysis“).
  Code: `handleUrlScan` hat **keine** Tier-Prüfung (`background.js:2158–2169`, Guard nur
  `assertExternalAnalysisAllowed()` in `:2160`), aufgerufen aus dem Kontextmenü „Alle Links … scannen“
  (`:1801`), dem Einzel-Link-Kontextmenü (`:1836`) und dem Popup (`:1979`).
- **Auswirkung:** Auch in `strict`/`balanced` gehen beim manuellen Link-Scan URLs an Hybrid Analysis.
  Zusätzlich suggerieren `store_listing.md:62`/`privacy_policy.md:111`, urlscan.io erhalte Nachrichten-URLs
  „beim Scan“, tatsächlich läuft urlscan.io nur bei der Link-Prüfung (`background.js:1876`).
- **Fix-Skizze:** Doku-Spalte „Wann“ um „manueller Link-Scan (Stufe unabhängig)“ ergänzen; urlscan.io-Zeile
  präzisieren („erst beim Klick/Prüfen eines Links, nicht beim Nachrichten-Scan“).

### DOC-03 — „Strict = Hashes und Metadaten“ ist unpräzise (niedrig)
- **Beleg:** `CHANGELOG.md:22` und `README.md:57` („Only SHA-256 hashes and metadata only“).
  Im Tier `strict` werden nur Hashes übertragen; Dateiname/-typ/-größe gehen erst mit dem Upload
  (`balanced`/`max`/manuell) raus (`background.js:1444–1447`). In `strict` gibt es keinen solchen Request.
- **Auswirkung:** Kleine Überzeichnung; beeinflusst die Datenschutz-Wahrnehmung nach oben (unkritisch), ist
  aber keine belegbare Aussage.
- **Fix-Skizze:** „metadata“ streichen oder auf „HTTP-User-Agent/IP (transportbedingt)“ präzisieren.

---

## 2. Provider/Origins: Manifest vs. Code vs. Doku

**Tatsächlich kontaktiertes Set (Grep über `background.js`, `api.js`, `api_gateway.js`, `options.js`):**
`https://hybrid-analysis.com` (10×), `https://www.virustotal.com` (5×), `https://urlscan.io` (4×),
`https://urlhaus-api.abuse.ch` (3×), `https://api.abuseipdb.com` (3×), `https://www.hybrid-analysis.com` (1× —
nur als Host-Vergleich in `api_gateway.js:29`, kein Request).

**Manifest:** `manifest.json:29–37` deklariert 7 Patterns:
`https://hybrid-analysis.com/*`, `https://*.hybrid-analysis.com/*`, `https://*.virustotal.com/*`,
`https://urlscan.io/*`, `https://*.urlscan.io/*`, `https://urlhaus-api.abuse.ch/*`, `https://api.abuseipdb.com/*`.

### DOC-04 — Drei widersprüchliche Origin-Listen (mittel)
- **Beleg:**
  - `docs/reviewer_notes.md:46`: VirusTotal „Requested origin(s): `https://virustotal.com/*`, `https://*.virustotal.com/*`“.
  - `manifest.json:31`: nur `https://*.virustotal.com/*` (kein bare-Pattern).
  - `background.js:79` (`PROVIDER_ORIGINS.virustotal = 'https://www.virustotal.com/*'`) und
    `options.js:132` (angefragt wird genau `https://www.virustotal.com/*`).
  - Hybrid Analysis: `docs/reviewer_notes.md:45` nennt bare **und** Wildcard als angefragt; `manifest.json:29–30`
    deklariert beide, `options.js:131` fragt aber nur `https://hybrid-analysis.com/*` an.
- **Bewertung:** Funktionale Regression entsteht nicht (das deklarierte Wildcard deckt den Anfrage-Host ab),
  aber die Review-Zusage in `reviewer_notes.md` stimmt mit Manifest und Code nicht überein.
- **Fix-Skizze:** In `reviewer_notes.md` §2.2 die real über `options.js:131–135` angefragten Origins exakt
  auflisten, oder Manifest/`options.js` an die Doku angleichen.

### DOC-05 — „Adressierte Hosts“ überzeichnen die real kontaktierten Ziele (niedrig)
- **Beleg:** `docs/privacy_policy.md:128–130` und `docs/reviewer_notes.md:89` nennen `api.hybrid-analysis.com`,
  bare `virustotal.com` und `www.urlscan.io` als Ziele. Der Code kontaktiert keinen dieser drei Hosts
  (Grep oben; Requests laufen über `hybrid-analysis.com`, `www.virustotal.com`, `urlscan.io`).
  `docs/reviewer_notes.md:125–137` (§7 „complete list“) listet dagegen das korrekte Set → §4 und §7 derselben
  Datei widersprechen sich.
- **Bewertung:** Über-Deklaration ist datenschutzfreundlich, aber die Behauptung „complete list“ (`:125`) ist
  damit ungenau; außerdem nennt `docs/reviewer_notes.md:89` einen nicht erreichbaren Host als Empfänger
  vollständiger Anhänge.
- **Fix-Skizze:** §5.1/§4 auf die real kontaktierten Hosts kürzen; Wildcards nur dort nennen, wo sie im
  Manifest stehen.

---

## 3. Behauptete Nicht-Übermittlung — Haltbarkeit im Code

**Behauptung:** `docs/privacy_policy.md:119–122`, `docs/store_listing.md:66`, `docs/reviewer_notes.md:98–105`:
nicht übermittelt werden vollständiger Nachrichtentext, Betreff, Empfänger-/Absenderadressen,
Klartext-Anhänge und API-Schlüssel.

### DOC-06 — Aussage ist für die Add-on-eigenen Requests haltbar, mit einer Einschränkung (niedrig)
- **Beleg (Aussage hält):** Kein Fetch-Body/keine URL enthält `author`/`subject`/Empfänger. Grep über
  `fetch`/`FormBody`/`JSON.stringify` in `background.js` liefert nur `url`, `host` (Domain) und Dateiinhalte
  (`background.js:2307` `body.append('host', domain)`, `:2338` `JSON.stringify({url, visibility:'unlisted'})`).
  `messages.query({to: senderEmail})` (`background.js:904`) ist lokal. Klartext-Anhänge werden vor dem
  Upload gefiltert (`background.js:1535–1544`), in Übereinstimmung mit `privacy_policy.md:120–121`.
- **Einschränkung:** Übermittelte URLs können Empfänger-/Personenbezug **enthalten** (z. B. Tracking-Links
  mit Subscriber-ID). Die Doku trennt „Adressen“ von „Links“, sagt aber nicht, dass Links solche Kennungen
  transportieren können.
- **Fix-Skizze:** Einen Satz ergänzen: „Links können personenbezogene Kennungen enthalten (z. B.
  Newsletter-Tracking); sie werden nur bei Zustimmung und ausgelöstem Scan übermittelt.“

---

## 4. `data_collection_permissions` und Listing-Pflichtfelder (ATN)

**Online geprüft:** `https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/`
(abgerufen 2026-09-30, HTTP 200):
- „From November 3, 2025, all new extensions must adopt the Firefox built-in data collection consent system.“
- `required`: „users must accept this data collection to use the extension; **they cannot opt out** … If the
  user doesn’t agree to data collection, they can cancel the extension installation.“
- `optional`: „aren’t presented during installation … aren’t granted by default. The extension can request
  that the user opts in … by calling `permissions.request()` in a user-activated event handler“.

**Thunderbird-Besonderheit (online geprüft):**
`https://webextension-api.thunderbird.net/en/mv3/permissions.html` (HTTP 200): „Unlike Firefox, Thunderbird
does not use the built-in onboarding flow that prompts users to opt into data collection. In Thunderbird,
add-ons must request consent explicitly … The application does not provide an automatic prompt.“
→ Damit ist die Aussage in `docs/reviewer_notes.md:73–78` **belegt** (kein Doku-Fehler).

### DOC-07 — `required: [personalCommunications]` widerspricht dem dokumentierten Opt-in-Modell (hoch)
- **Beleg:**
  - `manifest.json:14–16`: `data_collection_permissions: { required: ["personalCommunications"] }`.
  - `docs/STORE_READINESS_ANALYSIS.md:62` (Empfehlung): „Da Scannen Opt-in ist, gehören diese Werte in die
    **optional**-Liste mit Runtime-Consent und Opt-out.“ Und `:267` (Ziel-Manifest): `"optional": ["personalCommunications"]`.
  - Dieselbe Datei erklärt B2 in `:376` mit `required` für „**behoben**“.
  - `docs/reviewer_notes.md:57–69` und `docs/privacy_policy.md:38–49`: Übermittlung nur nach globaler
    Zustimmung (Default aus) — das ist per Firefox-Definition eine **optionale**, nicht „required“-Datenart.
  - `scripts/pre-submit-checks.js:133` erzwingt `required.length >= 1` und kann die empfohlene
    `optional`-only-Lösung gar nicht abbilden (Widerspruch zwischen Tool und eigener Empfehlung).
  - `README.md:179–181` stellt `required` als bewusst dar („documents that the add-on can process message
    content“), ohne den „cannot opt out“-Effekt zu erwähnen.
- **Auswirkung:** Wenn ATN/Firefox-140+-Consent greift, müssten Nutzer die Sammlung von
  `personalCommunications` beim Install akzeptieren, obwohl das Add-on ohne Zustimmung **nichts** sendet —
  die Deklaration widerspricht damit der eigenen Privacy-Policy/Reviewer-Doku und der Empfehlung im eigenen
  Analyse-Dokument. Reviewer werten inkonsistente Daten-Deklarationen als Ablehnungsgrund (Policy 6/„No
  Surprises“; `https://extensionworkshop.com/documentation/develop/best-practices-for-collecting-user-data-consents/`:
  „Incorrect classification of data on the data collection consent will result in a review rejection.“).
- **Offene Frage:** Ob ATN die `data_collection_permissions`-Deklaration zum Einreichungszeitpunkt überhaupt
  erzwingt/auswertet, war online nicht belegbar (Thunderbird-„Supported Manifest Keys“,
  `https://developer.thunderbird.net/add-ons/mailextensions/supported-manifest-keys`, listet den Key **nicht**;
  Abruf HTTP 200). Als „nicht online geprüft“ markiert.
- **Fix-Skizze:** `optional: ["personalCommunications"]` verwenden, `pre-submit-checks.js:131–133` entsprechend
  anpassen, und in `reviewer_notes.md` §3 einen Absatz zur Deklaration ergänzen.

### DOC-08 — Listing-Feld „Category“ weicht vom ATN-Kategorienamen ab (niedrig)
- **Beleg:** `docs/store_listing.md:143` schlägt „Privacy & Security“ vor. ATN (Thunderbird, type=extension)
  kennt laut `https://addons.thunderbird.net/api/v4/addons/categories/` (HTTP 200) exakt
  **„Privacy and Security“** (und „Miscellaneous“).
- **Auswirkung:** Kosmetisch; die manuelle Auswahl im Picker bleibt möglich, der Vorschlag ist aber nicht
  1:1 übernehmbar.
- **Fix-Skizze:** Kategorie auf „Privacy and Security“ ändern.

### DOC-09 — Pflichtfeld-Längen: Summary ok, 45-Zeichen-Namensgrenze nicht belegt (niedrig)
- **Beleg:** `docs/store_listing.md:20–22` Short description; gemessen 217 Zeichen ≤ 250 (offiziell:
  `https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/`: „The summary description
  … is limited to 250 characters“). Title `docs/store_listing.md:18` = 41 Zeichen; eine 45-Zeichen-Grenze ließ
  sich in der offiziellen Listing-Doku **nicht** finden (nur Summary-250; Screenshots 1280×800 empfohlen,
  Icons 32×32/64×64). `short_name` „Thundy AV“ (9 Zeichen) erfüllt die Thunderbird-Empfehlung ≤ 12 Zeichen
  (`developer.thunderbird.net/.../supported-manifest-keys`).
- **Auswirkung:** Kein Verstoß erkennbar; die interne 45er-Annahme ist unbelegt.
- **Fix-Skizze:** Keine Änderung nötig; ggf. Grenze im Dokument als „ungeprüfte Annahme“ kennzeichnen.

---

## 5. Trademark-Regeln (Name, Manifest, Icons)

- **Namenskonvention:** `manifest.json:3` `__MSG_extensionName__` → `_locales/en/messages.json` bzw.
  `_locales/de/messages.json`: „Thundy AV – Email Scanner for Thunderbird“. Mozilla-Policy (online geprüft,
  `https://extensionworkshop.com/documentation/publish/add-on-policies/`): „Add-ons that make use of Mozilla
  trademarks must comply with the Mozilla Trademark Guidelines. If the add-on uses ‘Firefox’ in its name, the
  naming standard … is ‘<Add-on name> for Firefox’.“ Die analoge „… for Thunderbird“-Konvention ist eingehalten;
  der Name beginnt **nicht** mit „Thunderbird“. Belegt/konform.
- **Icons:** `img/icon-16/32/48/64/128px.png` existieren (`ls img`); `scripts/generate-icons.js:20–25`
  zeichnet ein **Schild mit Ausrufezeichen** (Polylinie + Mark), kein Thunderbird-Logo. Die Beschreibung in
  `docs/store_assets.md:21–22` deckt sich mit dem Generator. Belegt/konform.

### DOC-10 — Thunderbird-eigene Trademark-Seite nicht online prüfbar (offen)
- `https://www.thunderbird.net/en-US/trademark/` lieferte **HTTP 404**. Die Konvention stützt sich daher auf
  die Mozilla-Add-on-Policy (Firefox-Analogie) — als „Thunderbird-spezifische Trademark-Seite nicht online
  geprüft“ markiert. Kein Doku-Fehler nachweisbar.

---

## 6. Sprach-/Lokalisierungszustand

- **Fakten:** `manifest.json:5` `default_locale: "en"`; `_locales/en/messages.json` und `_locales/de/messages.json`
  vorhanden (Manifest-Strings + Banner). Options-/Popup-Markup ist deutsch (z. B. `options.html`, `popup.html`).
- **Doku-Aussagen:** `docs/STATUS.md:35–36` und `:64–65`, `README.md:200–201`, `CHANGELOG.md:26` beschreiben
  korrekt „Manifest-Strings/Banner lokalisiert, Options/Popup nur Deutsch“.

### DOC-11 — `store_listing.md` behauptet „localisation not implemented yet“ (mittel)
- **Beleg:** `docs/store_listing.md:150` „Language of the user interface | German (**localisation not
  implemented yet**)“ widerspricht `docs/STATUS.md:35–36`, `README.md:200–201`, `CHANGELOG.md:26` und dem
  Dateibestand `_locales/en` + `_locales/de`.
- **Auswirkung:** Falsche Angabe im Listing-Entwurf; ATN-Reviewer prüfen lokalisierte `_locales` und können die
  Aussage als Widerspruch zur Einreichung werten. Zusätzlich ist „German“ als UI-Sprache korrekt für die
  Optionsseite, aber der Default-Locale ist `en`.
- **Fix-Skizze:** „UI currently German (options/popup); manifest strings and banners localized (en/de),
  `default_locale: en`“ eintragen.

---

## 7. Screenshots/Assets

- **Bestand:** `docs/screenshots/{inline_optin_banner,options_page,warning_banner}.svg` (SVG-Platzhalter),
  **kein** PNG/JPG (bestätigt durch Pre-Submit-Warnung und `docs/store_assets.md:19`).

### DOC-12 — Vermeintliche Mindestgröße für Screenshots ist nicht offizielle Vorgabe (niedrig)
- **Beleg:** `docs/store_assets.md:31` „mindestens 1280 × 800 px, mindestens 1200 px breit“ und
  `docs/screenshot_capture.md:73`, `:82`. Offiziell (`create-an-appealing-listing`, online):
  „We recommended that you capture images that are 1280x800px (the maximum image display size). For other image
  sizes, we recommend using the 1.6:1 ratio.“ → **Empfehlung**, keine harte Mindestgröße.
- **Auswirkung:** Kein Blocker; interne Anforderung wird fälschlich als Store-Vorgabe dargestellt.
- **Fix-Skizze:** Als „Empfehlung (nicht Store-Minimum)“ formulieren.

### DOC-13 — Verweise auf gelöschte `docs/screenshot-*.svg` (mittel)
- **Beleg:** `docs/screenshot_capture.md:5` und `docs/reviewer_notes.md:215` nennen existierende
  `docs/screenshot-*.svg`; `ls docs/screenshot-*.svg` → „No such file or directory“. `docs/store_assets.md:26–27`
  sagt selbst, diese Dubletten seien entfernt; `docs/STORE_READINESS_ANALYSIS.md:94–95` listet sie noch als
  vorhanden.
- **Auswirkung:** Reviewer-Testanleitung zeigt auf nicht existierende Dateien; widersprüchlicher Asset-Status.
- **Fix-Skizze:** Verweise auf `docs/screenshots/*.svg` korrigieren bzw. Passagen in STORE_READINESS als
  historischen Stand kennzeichnen.

### DOC-14 — Widersprüchlicher Icon-Status „offen“ vs. „vorhanden“ (mittel)
- **Beleg:** `docs/store_assets.md:66` „Icon-Auflösungen: **offen** — 32 px und 64 px nur in minimaler Qualität“
  widerspricht `docs/store_assets.md:14–18` („vorhanden“), `docs/store_listing.md:173` („done — reproducibly
  generated … dimensions verified“) und dem grünen Pre-Submit-Check („ok: … icons“).
- **Auswirkung:** Ein Reviewer könnte Fehlendes vermuten, obwohl das Manifest-Icon-Set vollständig ist.
- **Fix-Skizze:** Den „offen“-Punkt in `store_assets.md` §6 streichen oder auf „Qualität der kleinen Größen
  subjektiv“ umformulieren.

---

## 8. Widersprüche / überholte Aussagen (STATUS, STORE_READINESS, README, CHANGELOG, index*)

### DOC-15 — `STORE_READINESS_ANALYSIS.md` beschreibt überholte Website-Aussage (mittel)
- **Beleg:** `:70` zitiert „The extension reads **no** email content, only attachments.“ aus
  `docs/index_en.html`/`index_de.html`. Aktuell steht dort das Gegenteil: `docs/index_en.html:62`
  („reads the message you open … headers, text, links and attachments“) und `docs/index_de.html:62`
  (identisch). Die Korrektur ist auch in `docs/privacy_policy.md:98–99` dokumentiert. Ein Hinweis, dass `:70`
  den Analyse-Stand (nicht den Ist-Stand) beschreibt, fehlt; §8 (`:377`) markiert B3 gleichzeitig als
  „behoben“.
- **Auswirkung:** Wer das Analyse-Dokument als Doku-Quelle nutzt, hält die Website für weiterhin falsch.
- **Fix-Skizze:** In §3/B3 einen „Stand vor 1.6“-Hinweis ergänzen oder die Zeile aktualisieren.

### DOC-16 — `STORE_READINESS_ANALYSIS.md:122`: `api_gateway.js` nicht geladen (niedrig)
- **Beleg:** `:122` „api_gateway.js wird nicht in `background.scripts` geladen“ — dagegen `manifest.json:41–45`
  (`background.scripts` enthält `api_gateway.js`) und `CHANGELOG.md:44` („now loaded by the background script“).
- **Auswirkung:** Veraltete Aussage innerhalb desselben Dokuments, das B/H-Befunde als behoben führt.
- **Fix-Skizze:** Zeile als „behoben in 1.6“ kennzeichnen.

### DOC-17 — `STORE_READINESS_ANALYSIS.md:378`: „hasHostPermissionFor() vor jedem Provider-Aufruf“ ist falsch (mittel)
- **Beleg:** `hasHostPermissionFor`/`hasHybridPermission` werden nur an zwei Stellen genutzt:
  `background.js:240` und `:1483`. Die übrigen Provider-Aufrufe prüfen **kein** Host-Recht vorab:
  `checkAbuseIPDB` (`:337`), `checkVirusTotalIP` (`:357`), URL-Upload (`:779`), `check_hybrid_analysis_for_attachment`
  (`:1501`), `handleUrlScan` (`:2158`), `handleManualUpload` (`:2206`), `checkURLhaus` (`:2302`),
  `checkUrlscanIo` (`:2326`). Diese Pfade verlassen sich auf die in `options.js:131–135` erbetenen Rechte.
- **Auswirkung:** Die Doku überzeichnet die Verteidigungstiefe; deckt sich mit der offenen Code-Audit-Frage
  (task_0001, Punkt 4) zu `hasHostPermissionFor()`-Abdeckung.
- **Fix-Skizze:** Aussage abschwächen („Host-Rechte werden beim Speichern eines Keys pro Anbieter erbeten;
  die Requests setzen das erteilte Recht voraus“) oder `hasHostPermissionFor()` an allen Fetch-Pfaden ergänzen.

### DOC-18 — `quickstart.md` listet gelöschte Testdatei (niedrig)
- **Beleg:** `docs/quickstart.md:33–34` nennt `content_script.test.js` als Teil von `npm test`;
  `ls content_script.test.js` → „No such file or directory“. `docs/STATUS.md:34` sagt, der tote Code
  (`content_script.js`) sei entfernt.
- **Auswirkung:** Falsche Dateiliste für Reviewer/Entwickler.
- **Fix-Skizze:** `content_script.test.js` aus der Aufzählung entfernen.

### DOC-19 — Icon-Größen-Angaben uneinheitlich (niedrig)
- **Beleg:** `docs/STATUS.md:30` („Icons 16/32/64 px“) und `CHANGELOG.md:34` („new icons in 16/32/64 px“)
  vs. `manifest.json:56–62` und `docs/store_assets.md:14–18` (16/32/48/64/128) sowie `docs/store_listing.md:173`
  (16/32/48/64/128).
- **Auswirkung:** Kosmetisch, aber inkonsistent.
- **Fix-Skizze:** STATUS/CHANGELOG auf 16/32/48/64/128 korrigieren.

### DOC-21 — XPI-Aussagen („15 Dateien“) und Ausschluss-Zusage stimmen nicht mit dem Build (hoch)
- **Beleg (selbst gemessen):** `npx web-ext build --source-dir . --artifacts-dir /tmp/auditbuild`
  → `thundy_av_email_scanner_for_thunderbird-1.6.zip`, **19 Dateien / 180 856 Bytes**; darin
  `test_regex_escape.js` und `test_regex_escape2.js`. `node scripts/verify-package.js /tmp/auditbuild`
  endet mit **EXIT=1** und `PACKAGE CHECK FAILED: unexpected file in package: test_regex_escape*.js`.
  Dagegen: `docs/STATUS.md:33` („Das XPI enthält nur noch **15 Dateien** (≈176 KB …)“),
  `docs/STORE_READINESS_ANALYSIS.md:413` („`verify-package.js ./build` # 15 Dateien, ≈176 KB“) und
  `docs/store_listing.md:163–164` („development and test artefacts (unit tests … sample scripts) are
  **excluded** from the XPI“).
- **Ursache (belegt):** Die Ignore-Muster `**/*.test.js`/`**/*_test.js` in `web-ext-config.mjs:14–15` und
  `.webextignore:3–4` erfassen `test_regex_escape.js`/`test_regex_escape2.js` nicht.
- **Auswirkung:** Die Doku behauptet einen grünen Paket-Check und eine saubere XPI, die es nicht gibt;
  Testcode liegt im Store-Paket. Gehört inhaltlich auch zu task_0003, betrifft aber die Aussagen in
  `STATUS.md`/`STORE_READINESS_ANALYSIS.md`/`store_listing.md` direkt.
- **Fix-Skizze:** `test_regex_escape*.js` (bzw. `test_*.js`) in beide Ignore-Listen aufnehmen, Paket neu bauen,
  Dateizahl in STATUS/STORE_READINESS/Store-Listing auf den dann gemessenen Wert aktualisieren.

### DOC-20 — Versions-/Test-Aussagen: teils bestätigt, XPI-Zahl widerlegt (bestätigt/widerlegt)
- `docs/STATUS.md:40` („389 Tests, 0 Fehler“) == nachgemessen (389/0). ✅
- `docs/STORE_READINESS_ANALYSIS.md:408` (Pre-Submit „0 Fehler, 1 Warnung“) == nachgemessen (Exit 0, 1 Warnung). ✅
- `docs/STORE_READINESS_ANALYSIS.md:411` („26 bekannte TB-Warnungen“) == nachgemessen (0 Fehler, 26 Warnungen). ✅
- XPI „15 Dateien“ == **widerlegt**, siehe DOC-21 (real 19 Dateien, Paket-Check schlägt fehl). ❌
- `CHANGELOG.md:13` (1.6.0 / 2026-09-28), `manifest.json:8` (`"1.6"`), `package.json` (`1.6.0`) — konsistent. ✅


---

## 9. Befundübersicht

| ID | Schwere | Kurzbeschreibung | Primärbeleg |
|---|---|---|---|
| DOC-01 | hoch | Manueller Voll-Upload umgeht Privacy-Tier | `privacy_policy.md:109–110` vs `background.js:2206–2219` |
| DOC-02 | mittel | Manueller Link-Scan sendet URLs in allen Tiers | `privacy_policy.md:111` vs `background.js:2158–2169` |
| DOC-03 | niedrig | „strict = hashes and metadata“ unpräzise | `CHANGELOG.md:22`, `README.md:57` |
| DOC-04 | mittel | VirusTotal/HA-Origin-Listen widersprüchlich | `reviewer_notes.md:45–46` vs `manifest.json:29–31`, `options.js:131–132` |
| DOC-05 | niedrig | §5.1/§4 nennen nicht kontaktierte Hosts; §4≠§7 | `privacy_policy.md:128–130`, `reviewer_notes.md:89` vs `:127–137` |
| DOC-06 | niedrig | „Adressen nicht übermittelt“ hält (URLs mit Kennungen möglich) | `background.js:2307`, `:2338` |
| DOC-07 | hoch | `required: [personalCommunications]` widerspricht Opt-in | `manifest.json:14–16` vs `STORE_READINESS_ANALYSIS.md:62,267,376` |
| DOC-08 | niedrig | Kategorie „Privacy & Security“ ≠ ATN „Privacy and Security“ | `store_listing.md:143` vs ATN-API v4 |
| DOC-09 | niedrig | 45-Zeichen-Namensgrenze nicht belegt (Summary 217≤250 ok) | `store_listing.md:18,20–22` |
| DOC-10 | offen | Thunderbird-Trademark-Seite 404 | `thunderbird.net/en-US/trademark/` |
| DOC-11 | mittel | „localisation not implemented yet“ falsch | `store_listing.md:150` vs `STATUS.md:35–36`, `_locales/` |
| DOC-12 | niedrig | Screenshot-Mindestgröße als Store-Vorgabe dargestellt | `store_assets.md:31`, `screenshot_capture.md:73,82` |
| DOC-13 | mittel | Verweise auf gelöschte `docs/screenshot-*.svg` | `screenshot_capture.md:5`, `reviewer_notes.md:215` |
| DOC-14 | mittel | Icon-Status „offen“ vs „vorhanden“ | `store_assets.md:66` vs `:14–18`, `store_listing.md:173` |
| DOC-15 | mittel | STORE_READINESS zitiert überholte Website-Aussage | `STORE_READINESS_ANALYSIS.md:70` vs `index_en.html:62` |
| DOC-16 | niedrig | „api_gateway.js nicht geladen“ veraltet | `STORE_READINESS_ANALYSIS.md:122` vs `manifest.json:41–45` |
| DOC-17 | mittel | „hasHostPermissionFor vor jedem Aufruf“ falsch | `STORE_READINESS_ANALYSIS.md:378` vs `background.js` (`:240`,`:1483`) |
| DOC-18 | niedrig | quickstart listet gelöschte Testdatei | `quickstart.md:33–34` |
| DOC-19 | niedrig | Icon-Größen uneinheitlich (16/32/64 vs 16/32/48/64/128) | `STATUS.md:30`, `CHANGELOG.md:34` vs `manifest.json:56–62` |
| DOC-21 | hoch | XPI enthält Testskripte; „15 Dateien“ + Paket-Check-Zusage falsch | `STATUS.md:33`, `STORE_READINESS_ANALYSIS.md:413` vs Build/`verify-package.js` (EXIT 1) |

**Store-Readiness-Fazit (Doku/Policy):** Kein reiner Formfehler blockiert die Einreichung; die hoch
bewerteten Punkte DOC-01 (Datenfluss), DOC-07 (Daten-Deklaration) und DOC-21 (XPI/Paket-Check-Aussage)
sind inhaltliche Zusagen, die vor einer Einreichung korrigiert werden sollten. Fehlende echte Screenshots
bleiben der formale Blocker (bestätigt durch die Pre-Submit-Warnung), sind aber überall korrekt als offen
dokumentiert.

---

## 10. Nicht geprüft / nicht verifizierbar

- **Thunderbird-Verhalten von `data_collection_permissions`** (ob ATN den Key auswertet/erzwingt):
  online nicht belegbar; die Thunderbird-Doku listet ihn nicht. **Nicht online geprüft.**
- **Thunderbird-spezifische Trademark-Richtlinie:** `https://www.thunderbird.net/en-US/trademark/` → HTTP 404.
  **Nicht online geprüft**; Bewertung stützt sich auf die Mozilla-Add-on-Policy.
- **AMO/ATN-Namensgrenze (45 vs. 50 Zeichen):** in der offiziellen Listing-Doku nicht gefunden; nicht belegt.
- **XPI-Gesamtinhalt jenseits der Doku-Zusage:** Für DOC-21 wurde der Build exemplarisch nachgebaut
  (19 Dateien, Paket-Check EXIT 1). Eine vollständige Pipeline-/Reproduzierbarkeitsprüfung bleibt task_0003.
- **Laufzeitverhalten** (Banner-Injektion, `permissions.request` aus Banner, `contexts:["link"]`,
  tatsächliche Netzwerkziele): nur in echtem Thunderbird 140 ESR prüfbar; hier rein statisch.

---

## 11. Reproduktion der Belege

```bash
# Basisfakten
node scripts/pre-submit-checks.js; echo EXIT=$?
npm test
npx web-ext lint --source-dir . --output json > /tmp/lint.json
node -e "const l=require('/tmp/lint.json');console.log('errors',l.errors.length,'warnings',l.warnings.length)"

# Datenfluss/Origins
grep -rhoE "https://[a-zA-Z0-9.-]+" background.js api.js api_gateway.js options.js | sort | uniq -c
grep -n "mayTransmitExternally\|hasHostPermissionFor\|permissions.request" background.js options.js
ls docs/screenshot-*.svg            # -> No such file or directory
ls _locales/en _locales/de
ls content_script.test.js           # -> No such file or directory

# Paketinhalt (DOC-21)
npx web-ext build --source-dir . --artifacts-dir /tmp/auditbuild --overwrite-dest
unzip -l /tmp/auditbuild/thundy_av_email_scanner_for_thunderbird-1.6.zip
node scripts/verify-package.js /tmp/auditbuild; echo EXIT=$?   # -> EXIT=1 (test_regex_escape*.js)
```

**Getrackte Dateien wurden nicht verändert; dieser Bericht liegt ausschließlich unter `.audit/`.**






