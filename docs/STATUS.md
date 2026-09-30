# Status – Thundy AV (Stand: September 2026)

**Add-on:** Thundy AV – Email Scanner for Thunderbird · **Version 1.6** · **ID** `thundy-av@bludau-it-services.de`
**Zielplattform:** Thunderbird 140.0 oder neuer (Manifest V3) · **Lizenz:** MIT
**Dokumentstand:** September 2026 – die Aussagen in dieser Datei wurden am Code geprüft (Commit `49850f3`); es wird
kein Live-Test in Thunderbird behauptet.

## Behoben nach dem Store-Readiness-Review 1.6

Der unabhängig verifizierte Review für Version 1.6 steht in
[docs/STORE_READINESS_REVIEW_1.6.md](STORE_READINESS_REVIEW_1.6.md). Die dort belegten Befunde B1–B4, H1–H3 sowie
M1/M3/M7/M8 sind in dieser Version abgearbeitet (jeweils am Code verifiziert):

- **B1 (fehlende `menus`-Berechtigung):** `menus` ist in `manifest.json` deklariert; beide Kontextmenü-Einträge
  werden erzeugt – „Link mit Thundy AV scannen“ (`contexts: ["link"]`) und „Alle Links dieser Nachricht scannen“
  (`contexts: ["message_display_action"]`, bis zu 20 Links je Aufruf).
- **B2 (Injektionsweg):** Die UI in der Nachrichtenansicht läuft nicht mehr über `scripting.executeScript`, sondern
  über ein einmalig registriertes Message-Display-Skript:
  `scripting.messageDisplay.registerScripts([{ id: 'thundy-ui', js: ['message_display.js'], runAt: 'document_idle' }])`
  – aufgerufen beim Start, bei `onStartup` und bei `onInstalled`. Neue gebündelte Datei: `message_display.js`.
  Das Skript rendert Opt-in-Banner („Nur diese Nachricht scannen“, „Absender dauerhaft scannen“,
  „Einstellungen öffnen“), Warnbanner ab Risiko-Score 50 mit Begründungsliste und den grünen
  SPF/DKIM/DMARC-Badge; den Zustand liefert das Hintergrundskript über `getMessageUiState` (Antwort inkl. `pending`)
  und Broadcasts `{type:'thundy:messageState', tabId, state}`.
- **B3 (Time-of-Click nur kosmetisch):** Beim Klick prüft das Message-Display-Skript den Link vor dem Öffnen über
  `checkLinkState` → `handleCheckLinkState` (der zuvor unerreichbare Handler ist damit der Entscheidungspunkt):
  lokales Verdikt aus der IndexedDB, sonst – mit urlscan-Schlüssel und erteilter Zustimmung – Live-Scan über
  urlscan.io mit 6-Sekunden-Budget. Bösartige **oder** nicht verifizierbare Links (`MALICIOUS`,
  `MALICIOUS_VISUAL`, `TIMEOUT`, `ERROR`) werden blockiert; ein Inline-Hinweis nennt Begründungen und Ziel-URL und
  bietet „Link trotzdem öffnen“ (Freigabe nur für die Sitzung, im Arbeitsspeicher). Nicht-http(s)-Schemes werden
  blockiert (fail closed), `mailto:`/`tel:`/`news:`/`nntp:` sind erlaubt.
- **B4 (Popup ohne Zustimmungs-Gate):** Das Popup (`api.js`) prüft die globale Zustimmung, bevor es Anbieter
  abfragt; ohne Zustimmung erscheint eine Hinweiskarte ohne Upload-/Rescan-Schaltflächen.
- **H1 (`data_collection_permissions`):** jetzt `required: ["none"]` und `optional: ["personalCommunications"]`;
  zusätzlich wertet das Hintergrundskript die eingebaute Datenkonsent-Kategorie aus
  (`browser.permissions.getAll().data_collection`) und erzwingt sie in `mayTransmitExternally()`
  (`background.js`) – ohne erteilte Kategorie wird nicht übermittelt.
- **H2 (Doku/Listing nicht deckungsgleich):** README (en/de), STATUS, Listing, Reviewer-Hinweise und
  Datenschutzerklärung wurden auf den verifizierten Code-Stand gezogen; Live-Test-Zusagen werden nirgends
  behauptet.
- **H3 (kein Gate „benutzte API ⇔ deklarierte Berechtigung“):** `scripts/pre-submit-checks.js` prüft jetzt
  zusätzlich (a) verwendeter `browser.*`-Namespace ⇒ deklarierte Berechtigung (genau der Fall, der die
  `menus`-Lücke unentdeckt ließ), (b) die Datenkonsent-Deklaration (u. a. dass „none“ nicht die Übermittlung
  verschleiert) und (c) dass das programmatisch registrierte Skript (`message_display.js`) im Paket liegt.
- **M1 (breitere Host-Patterns):** `optional_host_permissions` enthält nur noch die fünf tatsächlich genutzten
  Origins (`https://hybrid-analysis.com/*`, `https://www.virustotal.com/*`, `https://urlscan.io/*`,
  `https://urlhaus-api.abuse.ch/*`, `https://api.abuseipdb.com/*`); Wildcard-Subdomains sind entfernt.
- **M3 (Popup-Tabermittlung):** Das Popup nutzt `messageDisplay.getDisplayedMessages()` (Fallback:
  `tabs.query` + `tabId`). Zusätzlich wurden zwei latente `ReferenceError`s (`syncFragment`, `container`) behoben,
  durch die gespeicherte Links und unbekannte Anhänge nicht gerendert wurden.
- **M7 (Produktname):** Popup-Titel und Überschrift lauten „Thundy AV – Email Scanner for Thunderbird“.
- **M8 (kein Nutzerfeedback bei fehlgeschlagener UI):** Lässt sich das Message-Display-Skript nicht registrieren,
  protokolliert der Hintergrund den Fehler und erzeugt eine Systembenachrichtigung (`notificationUiUnavailable`).

Nicht abgearbeitet und weiterhin offen: **H4** (Reviewer-Testbarkeit der Kernfunktion) und **M4** (echte
Screenshots) – siehe „Weiterhin offen“.

## Completed in 1.6

Die Store-Readiness-Befunde aus [docs/STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md) wurden in 1.6
abgearbeitet:

- **Blocker B1 (MV3-APIs):** Portierung auf `messageDisplay.onMessagesDisplayed` und
  `getDisplayedMessages()` statt der in MV3 entfernten Varianten (`getFirstDisplayedMessage()`,
  `messageListToArray()`, Legacy-Fallback nur noch als Kompatibilitätspfad). Die UI in der Nachrichtenansicht
  läuft über das einmalig registrierte Message-Display-Skript `message_display.js`
  (`scripting.messageDisplay.registerScripts()`, `runAt: 'document_idle'`), das seinen Zustand per Runtime-Messaging
  vom Hintergrundskript erhält; ein `scripting.executeScript`-Weg existiert nicht mehr. Neue Kontextmenüs
  (Berechtigung `menus`): „Link mit Thundy AV scannen“ (Kontext `link`) und „Alle Links dieser Nachricht scannen“
  (Kontext `message_display_action`).
- **Blocker B2/B3 (Datenschutz):** Globale Zustimmung *„Externe Analyse erlauben“* (Default **AUS**) ist
  Voraussetzung für jede Übermittlung und wird im Hintergrundskript zentral erzwungen
  (`mayTransmitExternally()` / `assertExternalAnalysisAllowed()`, Fehlercode `EXTERNAL_ANALYSIS_DISABLED`).
  Datenschutz-Stufe Default jetzt `strict` (nur SHA-256-Hashes); `balanced` (zusätzlich Anhang-Upload unbekannter
  Dateien) und `max` (zusätzlich URL-Upload) nur nach bewusster Auswahl.
- **Blocker B4 (Manifest/Rechte):** Host-Berechtigungen liegen in `optional_host_permissions` (nicht mehr
  `optional_permissions`), Patterns korrigiert und fehlende Origins ergänzt (Hybrid Analysis, VirusTotal,
  urlscan.io, URLhaus, AbuseIPDB); angefragt wird zur Laufzeit nur für den tatsächlich genutzten Anbieter.
- **Banner (b):** Drei Schaltflächen im Opt-in-Banner – *„Nur diese Nachricht scannen“*, *„Absender dauerhaft
  scannen“* und *„Einstellungen öffnen“* – plus Warnbanner ab Risiko-Score 50 (mit Begründungsliste) und grüner
  SPF/DKIM/DMARC-Badge.
- **Time-of-Click-Schutz (B3):** Links werden im Nachrichtentext markiert (gestrichelte Unterstreichung plus
  Tooltip); beim Klick prüft das Hintergrundskript über `checkLinkState` zuerst ein lokal gespeichertes Verdikt
  (IndexedDB) und sonst – mit urlscan-Schlüssel und Zustimmung – live über urlscan.io (6-Sekunden-Budget).
  Bösartige oder nicht verifizierbare Links werden mit Inline-Hinweis, Begründungen und Ziel-URL blockiert und
  können über „Link trotzdem öffnen“ bewusst freigegeben werden (Freigabe nur für die Sitzung). Ist die Option
  deaktiviert, wird nicht eingegriffen.
- **Auto-Scan-Option:** „Links in der E-Mail sofort beim Öffnen prüfen (Auto-Scan)“ prüft bei Zustimmung und
  konfiguriertem urlscan-Schlüssel bis zu 20 Links je Nachricht (`autoScanLinksOfMessage`) und speichert die
  Verdikte in der IndexedDB ab; Optionstext und Hilfetext in `options.html` wurden präzisiert.
- **Popup-Zustimmungs-Gate (B4):** Das Popup fragt ohne globale Zustimmung keinen Anbieter ab, sondern zeigt eine
  Hinweiskarte; Titel und Überschrift lauten „Thundy AV – Email Scanner for Thunderbird“.
- **IP-Reputation (M9/H):** Optionale Prüfung der sendenden Mailserver-IPs über VirusTotal oder AbuseIPDB,
  konfigurierbar in den Einstellungen.
- **Name/ID/Icon (f):** Name „Thundy AV – Email Scanner for Thunderbird“, `short_name` „Thundy AV“, neue ID
  `thundy-av@bludau-it-services.de`, Icons 16/32/64 px, `options_ui.open_in_tab` statt `browser_style`.
- **Paketbereinigung (g):** `web-ext-config.mjs` (`ignoreFiles`, ergänzt durch `.webextignore`) hält Testdateien,
  `docs/`, `scripts/`, `examples/`, Lockfiles, `install.rdf` und Entwicklungs-Artefakte aus dem Build. Das XPI
  enthält **18 Dateien (265.425 Bytes entpackt)** – neu enthalten ist `message_display.js`; `scripts/verify-package.js`
  erlaubt und prüft diese Datei. Toter Code (`content_script.js`) und die Legacy-Dateien sind entfernt.
- **Lokalisierung (M2):** Alle sichtbaren UI-Strings werden über `browser.i18n` und `_locales/en`/`_locales/de`
  aufgelöst: Manifest-Strings (`__MSG_`), die UI in der Nachrichtenansicht und die Options-/Popup-Oberfläche
  (`data-i18n`-Attribute plus `applyUiTranslations()` in `db.js`, `uiText()` in `options.js`/`api.js`). Die Kataloge
  enthalten je **186 Keys**, davon 173 lokalisierte UI-Strings; im Code stehen Fallback-Texte (deutsch in den
  Options-/Popup-Skripten, englisch in Hintergrund- und Message-Display-Skript), Standard-Locale ist `en`. Weitere
  Sprachen können über zusätzliche `_locales/<code>`-Ordner ergänzt werden. Neue Keys: `tocLinkMarked`,
  `tocWarningTitle`, `tocChecking`, `tocBlocked`, `tocOpenAnyway`, `tocClose`, `tocBlockedScheme`,
  `notificationUiUnavailable` sowie die Options-/Popup-Keys.
- **Datenkonsent-Deklaration (H1):** `data_collection_permissions` jetzt `required: ["none"]` +
  `optional: ["personalCommunications"]`; der Optionsdialog fragt die Kategorie dort an, wo die Umgebung sie
  anbietet (`permissions.request({ data_collection: [...] })`, Feature-Erkennung über
  `permissions.getAll().data_collection`) und deaktiviert die globale Zustimmung bei Ablehnung. Das
  Hintergrundskript erzwingt den erteilten Zustand in `mayTransmitExternally()`.
- **Pre-Submit-Checks (H1/H3/M2):** `scripts/pre-submit-checks.js` prüft Manifest, Datenschutzerklärung, Rechte,
  die Deklaration der Datenkonsent, Namespace ⇔ Berechtigung, die Anwesenheit des registrierten Skripts und seit der
  UI-Lokalisierung zusätzlich, dass jeder lokalisierte UI-String einen Katalogeintrag hat (derzeit 173), und liefert
  einen echten Exit-Code; der Schritt läuft in der CI. Ergebnis: 0 Fehler, 2 Warnungen (fehlende Screenshots; die
  aktive CI führt nur `background.test.js` aus – die vollständige Variante liegt in `docs/ci/ci.yml`).
- **Tests/CI:** `npm test` führt alle `node:test`-Dateien aus (Consent-, Tier-, Permission-, MV3-Portierungs- und
  Message-Display-Tests enthalten) und ist grün (**454 Tests, 0 Fehler**; neu: `message_display.test.js` mit
  17 Tests, 4 Popup-Consent-Tests in `api.test.js`, 9 neue Pre-Submit-Check-Tests). `npx web-ext lint` meldet
  **0 Fehler und 25 Warnungen**, alle davon bekannte Thunderbird-False-Positives
  (`scripts/filter-lint-warnings.js`). Der im Repository aktive Workflow
  (`.github/workflows/ci.yml`, Node 22) läuft `npm ci`, die Pre-Submit-Checks (jetzt mit echtem Exit-Code),
  `node --test background.test.js` und `npx web-ext lint`. Die erweiterten Definitionen — vollständiger
  `npm test`, Lint-Filter für bekannte Thunderbird-False-Positives
  (`scripts/filter-lint-warnings.js`), `web-ext build` mit Paketprüfung (`scripts/verify-package.js`) und ein
  manueller Signier-Job (`web-ext sign --channel`) — liegen einsatzbereit in [`docs/ci/`](ci/README.md).
  Sie konnten in dieser Umgebung nicht unter `.github/workflows/` committed werden, weil das verwendete Token
  keine `workflows`-Berechtigung besitzt (GitHub lehnt solche Pushes ab). Übernahme: `docs/ci/README.md`.
- **Dokumente/Policy:** Datenschutzerklärung (`docs/privacy_policy.md`), Reviewer-Hinweise
  (`docs/reviewer_notes.md`), Listing-Entwurf (`docs/store_listing.md`); die Live-Policy unter
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html.

## Popup (Nachrichtenansicht)

Das Popup wurde mit dem Store-Readiness-Follow-up überarbeitet: Es zeigt jetzt **immer** die lokale Bewertung der
geöffneten Nachricht (Risiko-Score mit Balken, Begründungen, SPF/DKIM/DMARC-Ergebnis, Bewertungszeit, gespeichert
über `indexedDB_save_assessment`) und die gespeicherten Anhang-/Link-Verdikte als Status-Chips. Zuvor blieben die
Ergebnisse unsichtbar, weil (a) der Scan aus dem Banner ohne `headerMessageId` arbeitete und damit alle
Datenbank-Schreibvorgänge übersprungen wurden und (b) das Popup ohne Hybrid-Analysis-Schlüssel früh abbrach.
Nachrichten-Metadaten (Betreff, Absender, Datum, Message-ID) und das Design (hell/dunkel, Karten, Chips,
Fokus-Zustände) wurden ebenfalls modernisiert; ohne Zustimmung/API-Schlüssel werden weiterhin **keine** Anbieter
abgefragt.

## Weiterhin offen

- **Manuelle Verifikation in Thunderbird 140 ESR (Pflicht vor der Einreichung):** zu prüfen sind das Erscheinen von
  Opt-in-Banner, Warnbanner und SPF/DKIM/DMARC-Badge, beide Kontextmenü-Einträge („Link mit Thundy AV scannen“,
  „Alle Links dieser Nachricht scannen“), der aus dem Banner heraus ausgelöste Berechtigungsdialog
  (`permissions.request()` im Hintergrundpfad nach Nutzer-Geste) und das Blockieren eines Links samt „Link trotzdem
  öffnen“. Diese Pfade sind bisher nur durch Unit-Tests mit gemockten Thunderbird-APIs abgedeckt
  (Review-Befund **H4** – Reviewer-Testbarkeit). Ablauf: [quickstart.md](quickstart.md).
- **Eingebaute Datenkonsent (Live-Test):** Der Optionsdialog fragt die **optionale** Kategorie
  `personalCommunications` dort an, wo die Umgebung sie anbietet, und deaktiviert die globale Zustimmung, wenn die
  Anfrage abgelehnt wird; das Hintergrundskript blockiert die Übermittlung, solange die Kategorie als nicht erteilt
  gemeldet wird. Ob und wie Thunderbird 140 ESR diesen Dialog anzeigt, ist in dieser Umgebung nicht verifizierbar;
  der Codepfad ist nur durch Unit-Tests mit gemockten APIs abgedeckt.
- **Echte Store-Screenshots (Review-Befund M4):** In `docs/screenshots/` liegen nur SVG-Platzhalter; echte
  Aufnahmen dürfen erst nach dem erfolgreichen Live-Test erstellt werden. Siehe
  [store_assets.md](store_assets.md) und [screenshot_capture.md](screenshot_capture.md).
- **Signierung und Store-Einreichung:** Noch nicht bei addons.thunderbird.net eingereicht – Listing ausfüllen,
  Privacy-Policy-URL, Screenshots und Releasenotes hochladen, Paket signieren
  (`npx web-ext sign --channel listed`). Es existiert noch keine Store-URL.
- **CI-Übernahme (Review-Befund H3):** Aktiv ist weiterhin die reduzierte CI (`.github/workflows/ci.yml`:
  `npm ci`, Pre-Submit-Checks, `node --test background.test.js`, `npx web-ext lint`). Die vollständigen
  Definitionen liegen in [docs/ci/](ci/README.md); die Übernahme in `.github/workflows/` erfordert ein Token bzw.
  eine Person mit `workflows`-Berechtigung:
  `cp docs/ci/ci.yml .github/workflows/ci.yml && cp docs/ci/release.yml .github/workflows/release.yml`.
  Die Checks prüfen inzwischen auch Namespace ⇔ Berechtigung und die Datenkonsent-Deklaration.
- **Nach der Einreichung:** Pflege der Releasenotes, Beantwortung von Reviewer-Rückfragen, Aktualisierung dieser
  Datei.

## Referenzen

- Befunde und Roadmap: [docs/STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md) ·
  verifizierter Review 1.6: [docs/STORE_READINESS_REVIEW_1.6.md](STORE_READINESS_REVIEW_1.6.md)
- Datenschutzerklärung: [docs/privacy_policy.md](privacy_policy.md) ·
  live: https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Reviewer-Hinweise: [docs/reviewer_notes.md](reviewer_notes.md) · Listing-Entwurf:
  [docs/store_listing.md](store_listing.md)
- Entwickler-Quickstart: [docs/quickstart.md](quickstart.md) · Änderungen: [CHANGELOG.md](../CHANGELOG.md)
