# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project uses semantic versioning
for the add-on version in `manifest.json`. Releases are cut from tags in the GitHub repository
(https://github.com/VaZuLeS/Thunderbird-Antivirus).

## [Unreleased]

**Work in progress:** the manual verification in Thunderbird 140 ESR, real store screenshots and the store submission are
still open (see `docs/STATUS.md`). The build artifact `build/thundy-av-1.6.xpi` is unsigned; for a release build of
Thunderbird either load it as a temporary add-on via `about:debugging` or sign it with `web-ext sign`.

### Fixed

- **Message view rendering rewritten for Manifest V3.** The banners are now rendered by a dedicated message display
  script (`messageDisplay/banner.js`), registered through `scripting.messageDisplay.registerScripts`. It only renders the
  state that the background script provides (`getDisplayState` / `updateDisplayState`), so injected code cannot transmit
  data itself. Previously the banners were injected as anonymous functions per message.
- **Consent is now enforced in the popup too.** `api.js` loaded analysis reports directly from the provider and
  transmitted the attachment hash even if the user had revoked consent; report lookups now require the global consent and
  the host permission and are re-checked at call time.
- **Attachment upload uses the shared HTTP gateway** (`apiGateway.fetchWithTimeout`, 60 s) instead of a direct `fetch`
  without a timeout.
- **Host permission flow is deterministic.** `permissions.request()` is no longer called from the background (a user
  gesture does not survive the message hop); scanning without the permission now reports `permission_required` and the
  banner links to the options page, which requests the permission on save.
- **Removed the undocumented link context menu** (`contexts: ["link"]`); the documented `message_display_action` entry
  remains.
- Privacy policy and reviewer notes now list the locally stored message metadata (sender, subject, attachment name/hash)
  and document where the consent checks are enforced.

### Added

- `npm run build` produces the installable `build/thundy-av-<version>.xpi` and verifies the package content, including the
  files referenced by the packaged manifest and the registered message display scripts.
- 10 unit tests for the message display script (banner rendering, both scan actions, consent/permission hints,
  Time-of-Click markers, “never transmits anything itself”).


## [1.8.0] – 2026-09-28

### Added

- **Ansichtsrollen (`viewMode`)** steuern Informationsmenge und Unterbrechungsniveau, ohne Sicherheitsfunktionen zu aendern:
  `quiet` (nur Warnungen), `private` (Standard, keine technischen Kennungen), `business` (Zeitstempel,
  Uebertragungsuebersicht), `research` (Hashes, Job-IDs, Versuche), `audit` (Nachweis-Sicht). Banner und Popup richten
  sich danach; in der Rolle `quiet` erscheint der Opt-in-Hinweis gar nicht mehr.
- **Verlauf (Audit-Trail):** Der Add-on haelt lokal fest, welche Nachrichten geprueft und **welche Daten an welchen
  Anbieter uebertragen** wurden (Zeitpunkt, Aktion, Anbieter, Datentyp, Dateiname, SHA-256, Job-ID, Verdikt, Timing
  Echtzeit/zeitverzoegert). Eintraege entstehen bei lokaler Pruefung, Hash-Abfrage, Anhang-Upload, URL-Scan,
  Domain-/IP-Pruefung und beim Abruf eines verzoegerten Verdikts.
- **Verlauf im Popup** je Nachricht (rollenabhaengig: Zusammenfassung oder volle Details) und **vollstaendiger Verlauf
  in den Einstellungen** mit Filter (alle / nur Uebertragungen), Zusammenfassung, **CSV- und JSON-Export** sowie
  "Verlauf loeschen". Aufzeichnung und maximale Eintragszahl (50-5000) sind konfigurierbar.
- Neue Hintergrund-Aktionen `getHistory` und `clearHistory`; neue Einstellungen `viewMode`, `historyEnabled`,
  `historyLimit`.
- Optionen-Seite in Abschnitte gegliedert (Zustimmung, Anbieter, Datenschutz, Ansicht/Rolle, Verlauf); die rohe
  `MessageHeaderID` wird nur noch in den technischen Rollen angezeigt.

## [1.7.1] – 2026-09-28

Ergebnis einer erneuten Pruefung (Audit) des Auslieferungscodes nach 1.7.0.

### Fixed

- **Wiederholte Benachrichtigungen fuer abgelaufene Auftraege.** Zeitueberlaufene oder fehlgeschlagene Auftraege
  (`timeout`, `failed`) blieben in der Warteschlange und wurden bei jeder Abfrage erneut gemeldet: Nach drei
  Polling-Runden kamen drei Benachrichtigungen, im Betrieb waere das eine Meldung pro Minute gewesen. Terminale
  Zustaende werden jetzt nicht mehr abgefragt und nur einmal gemeldet; der Alarm wird beendet, sobald kein offener
  Auftrag mehr existiert, und abgeschlossene Eintraege werden nach 24 Stunden entfernt.
- **Nicht ersetzte Platzhalter in Fallback-Texten.** Die Benachrichtigung lautete im Fallback (fehlende oder fremde
  Sprache) woertlich „No analysis result received in time for: $NAME$“. Der Platzhalter-Ersetzer kennt jetzt auch
  `$NAME$`, `$VERDICT$`, `$DETAIL$`, `$MIN$` und `$ATTEMPT$` (Hintergrundskript und Banner-Script).
- **Zeitverzoegerte Ergebnisse gingen im Ein-Klick-Scan verloren.** Beim Scan aus dem Banner wurde der Auftrag ohne
  `headerMessageId` gespeichert, sodass das spaeter eintreffende Verdikt keinem Nachrichten-Datensatz zugeordnet
  werden konnte. Die Kennung wird jetzt aufgeloest (Nachrichten-API bzw. zuletzt bekannter Anzeigezustand), und das
  Ergebnis landet wie vorgesehen im lokalen Cache.
- **Score-Anzeige im Popup konnte fehlen.** Der Anzeigezustand wurde ausschliesslich ueber die Tab-ID gesucht; je nach
  Fenster-/Tab-Aufteilung (Nachricht in eigenem Fenster) lief die Suche ins Leere. Die Suche erfolgt jetzt zusaetzlich
  ueber die Nachrichten-ID.
- **Irrefuehrende Statuszeile.** Bei leerer Warteschlange zeigte der Banner „Abgeschlossen – Verdikt: -“; jetzt nennt
  er „Analyse abgeschlossen – Ergebnis im Popup“.
- Aufraeumen: ungenutzte Konstante `SCAN_STATES` entfernt.

## [1.7.0] – 2026-09-28

### Added

- **Statusverfolgung zeitverzoegerter Analysen.** Die Schnellanalyse von Hybrid Analysis ist asynchron. Der Add-on
  merkt sich jeden Auftrag (SHA-256, Submission-/Job-ID, Anhang, Nachricht, Startzeit, Versuchszähler) dauerhaft in
  `browser.storage.local`, fragt das Ergebnis über `browser.alarms` regelmaessig ab (Standard: jede Minute, maximal
  30 Versuche bzw. 90 Minuten) und schreibt das Verdikt anschliessend in den lokalen Nachrichten-Cache. Auftraege
  ueberleben damit einen Neustart des Hintergrundskripts.
- **Klare Kommunikation „Echtzeit“ vs. „zeitverzoegert“.** Banner und Popup benennen jetzt ausdruecklich, dass die
  lokalen Pruefungen (Hash, Heuristik, Kopfzeilen, Links) sofort abgeschlossen sind, waehrend die externe Analyse
  beim Anbieter laeuft und das Ergebnis spaeter eintrifft. Beide zeigen den Auftragsstatus (Warteschlange, laufend
  mit Versuchszahl und Laufzeit, abgeschlossen mit Verdikt, Timeout mit Begruendung).
- **Benachrichtigung bei Fertigstellung** („Analyse abgeschlossen: <Datei> – Verdikt: <...>“) bzw. bei Timeout.
- **Manuelle Abfrage:** Die Schaltflaeche „Ergebnis jetzt abrufen“ im Popup fragt alle offenen Auftraege sofort ab;
  der Banner aktualisiert sich waehrenddessen selbst.
- Neue Hintergrund-Aktionen `scanStatus` und `pollScansNow`; neue Berechtigung `alarms`.

### Fixed

- Aufraeumarbeiten an `handleUrlScan`/`handleManualUpload`: beide registrieren jetzt Auftraege, melden `timing: 'delayed'`
  zurueck und liefern bei fehlendem API-Schluessel den Code `NO_API_KEY` statt einer generischen Fehlermeldung.

## [1.6.1] – 2026-09-28

Bugfix-Release auf Basis der Rückmeldungen aus dem ersten Test in Thunderbird.

### Fixed

- **Falsche, praktisch konstante Risikobewertung ("immer 50 von 100").** Drei verschiedene schwache
  Einzelsignale gaben jeweils exakt 50 Punkte, und die Banner-Schwelle lag ebenfalls bei 50 - dadurch meldete
  praktisch jede Nachricht (z. B. Newsletter mit `spf=softfail` oder eine gewöhnliche Rechnung mit einem
  Dringlichkeitswort) exakt "50 von 100". Die Gewichte sind jetzt abgestuft und zentral in `SCORE_WEIGHTS`
  dokumentiert; kein einzelnes schwaches Signal erreicht allein die Schwelle. Zusätzlich fließen bösartige
  IP-Adressen aus den Received-Headern erstmals in die Bewertung ein (bisher wurden sie berechnet, aber
  ignoriert).
- **Erstkontakt-Erkennung war unbrauchbar.** Es wurde nach Nachrichten *an* den Absender gesucht statt nach
  Nachrichten *von* ihm, und die Liste bekannter Absender lag nur im Arbeitsspeicher (MV3-Hintergrundskripte
  werden entladen) - daher galt fast jeder Absender als "Erstkontakt". Jetzt wird `from` abgefragt, die
  Absender werden dauerhaft in `browser.storage.local` gespeichert, und wenn die Abfrage nicht möglich ist,
  bleibt der Erstkontakt *unbekannt* (keine Punkte statt Raten).
- **"Scan fehlgeschlagen" ohne Begründung.** Der Banner zeigt jetzt die konkrete Ursache an, und der
  Hintergrund meldet strukturierte Codes (`NO_API_KEY`, `PERMISSION_REQUIRED`, `EXTERNAL_ANALYSIS_DISABLED`,
  `SCAN_FAILED` mit Angabe der fehlgeschlagenen Stufe). Der zuvor verschluckte Fall "kein API-Schlüssel
  hinterlegt" ist jetzt sichtbar und verlinkt direkt in die Einstellungen.
- Fehler im Banner-Handler (`[...].trim()` auf einem Array-Literal) und die fehlende
  `console.info`-Unterstützung in älteren Testumgebungen behoben.

### Added

- **Manuelle Anhang-Analyse im Popup:** Alle Anhänge der geöffneten Nachricht werden mit Typ und Größe
  aufgelistet. Pro Anhang gibt es "Hash lokal berechnen" (SHA-256, keine Übertragung) und
  "Hochladen & analysieren" (Übertragung an den konfigurierten Dienst, Ergebnis wird direkt im Popup
  angezeigt). Ohne Zustimmung, API-Schlüssel oder Host-Berechtigung erklärt das Popup, was fehlt, und bietet
  den direkten Weg in die Einstellungen.
- **Transparente Bewertung im Popup:** Die lokale Bewertung inklusive aller Begründungen wird angezeigt, damit
  nachvollziehbar ist, wie der Score zustande kommt ("Warnbanner ab 50 von 100 Punkten").
- Neue Hintergrund-Aktionen `listAttachments` und `attachmentHash` (beide rein lokal).

## [1.6.0] – 2026-09-28

### Added

- **Global consent.** New option *"Externe Analyse erlauben"* (allow external analysis) with the default **off**. The
  background script enforces it for every transmission to a third-party service; without consent nothing is sent and
  the banner reports that no data was transmitted (`EXTERNAL_ANALYSIS_DISABLED`).
- **Banner with two actions.** The message-view banner now offers *"Nur diese Nachricht scannen"* and
  *"Absender dauerhaft scannen"*.
- **Privacy tiers**, now defaulting to `strict` (SHA-256 hashes and metadata only), `balanced` (additionally uploads
  unknown attachments) and `max` (additionally uploads URLs).
- **IP reputation** of sending mail servers (extracted from `Received` headers) via VirusTotal or AbuseIPDB –
  optional and configurable.
- **Localization** of manifest strings and banner texts via `_locales/` (English, German) including English
  fallbacks in `background.js`.
- Pre-submit checks for manifest, privacy policy and permissions (`scripts/pre-submit-checks.js`).
- Additional unit tests covering the consent, privacy-tier and permission flows.

### Changed

- Add-on renamed to **"Thundy AV – Email Scanner for Thunderbird"** (short name *Thundy AV*), new add-on ID
  `thundy-av@bludau-it-services.de`, new icons in 16/32/64 px, `options_ui.open_in_tab` enabled.
- Host permissions moved from `optional_permissions` to **`optional_host_permissions`**, patterns corrected, missing
  origins added (Hybrid Analysis, VirusTotal, urlscan.io, URLhaus, AbuseIPDB). Permissions are requested at runtime
  for the provider that is actually used.
- Ported to the Manifest V3 message display APIs (`messageDisplay.onMessagesDisplayed` /
  `getDisplayedMessages()` instead of the removed `onMessageDisplayed` / `getDisplayedMessage`); injection into the
  message view is centralized in `injectIntoMessageDisplay()`.
- `data_collection_permissions` declares the required category `personalCommunications`.
- Release packages are cleaned up through `.webextignore`; test files, `docs/`, `scripts/`, `examples/` and lockfiles
  are no longer part of the build.
- `api_gateway.js` is now loaded by the background script so the centralized request/timeout handling is used.

### Fixed

- Removed the `.gitignore` gaps and stale development leftovers from the packaged build (XPI contents).
- Pre-submit checks now fail with a non-zero exit code instead of always exiting 0.

## [1.5]

### Added

- Inline per-message banner for opt-in scanning: one-off scan of the current message and permanent opt-in for a single
  sender.
- Runtime permission flow: host access for external analysis providers is requested only when the user starts a scan
  or upload.
- Unit tests for the scanning and permission flows plus a CI workflow (`.github/workflows/ci.yml`) that runs the tests
  and `web-ext lint`.
- Store preparation: privacy policy draft (`docs/privacy_policy.md`), reviewer notes (`docs/reviewer_notes.md`),
  store listing draft (`docs/store_listing.md`) and a screenshot guide.
- Build artifact `build/thunderbird_security_antivirus-1.5.zip` attached to a draft release.

### Changed

- Scanning is disabled by default; the user opts in per message or per sender, and configures providers and API keys
  in the options page.
