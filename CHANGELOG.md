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


## [1.15.0] – 2026-09-28

### Fixed

- **Time-of-Click-Hinweise funktionierten nicht.** Der Nachrichtentext liegt bei Thunderbird in einem eigenen Frame; das
  Hinweis-Script wurde aber nur im oberen Dokument eingefuegt und erreichte die Links daher nie. Der Link-Guard wird jetzt
  mit `allFrames: true` injiziert (Registrierung und Fallback), und die Diagnose zeigt an, in wie vielen Frames das Script
  aktiv ist. Zusaetzlich war der Bestaetigungspfad fehlerhaft (synchroner Aufruf mit `.then()`), was im Blockiermodus eine
  Ausnahme ausgeloest haette.

### Added

- **Link-Guard mit drei Modi** (`linkGuardMode`): `off`, `hint` (Tooltip mit Zusatzinformationen, Klick erlaubt) und
  `confirm` (**Klick wird abgefangen**, Freigabe erst nach Pruefung).
- **Zwei Bestaetigungswege** (`linkGuardTarget`): **inline** (Tooltip direkt am Link, mit „Pruefen“ und „Oeffnen nach
  Pruefung“) oder **im Add-on-Popup** (Klick oeffnet das Popup, geoeffnet wird dort).
- **Tooltip mit echter Zusatzinformation:** Ziel, Host, registrierbare Domain, dekodierter IDN-Host (Punycode),
  Merkmale (Zugangsdaten in der URL, IP-Host, viele Subdomains, Tracking-Parameter) und Pruefstand (bekannt
  unauffaellig / als boesartig bekannt / durch eigene Regel blockiert / unbekannt).
- **Link-Liste im Popup:** alle Links der Nachricht mit Domain, Merkmalen und Pruefstand sowie den Aktionen „Pruefen“
  und „Oeffnen nach Pruefung“ - der Weg, der fuer die Popup-Bestaetigung gebraucht wird.
- **Freigabe-Gedaechtnis:** Nach einer Freigabe laesst der Guard denselben Link durch (kein zweiter Dialog).
- **Verlauf:** Jedes Oeffnen wird als `link-opened` protokolliert (inkl. Verdikt), Blockaden durch eigene Regeln werden
  verweigert (Fehlercode `BLOCKED_BY_RULE`).
- Der Link-Guard ist ueber die Enterprise-Policy erzwingbar (`linkGuardMode`, `linkGuardTarget`) und in der Diagnose
  sichtbar.

## [1.14.0] – 2026-09-28

### Added

- **Lokale IOC-Pivot-Suche:** Zu einem Hash, einer IP, Domain oder URL zeigt Thundy AV, wo dieser Indikator in den
  eigenen Daten schon vorkam - im lokalen Verlauf und in den gespeicherten Scan-Ergebnissen (Anzahl, betroffene
  Nachrichten, Zustaende). Buttons sitzen direkt am jeweiligen Indikator im Forscher-Panel.
- **Regel-/Score-Sandbox in den Einstellungen:** Absender, Betreff, Nachrichtentext und Links eingeben und lokal durch
  die vollstaendige Bewertung schicken - Ergebnis mit Punktbeitraegen je Pruefschritt, Begruendungen, greifenden eigenen
  Regeln und Forensik-Befunden. Es wird dabei **nichts** uebertragen.
- **Bulk-Link-Pruefung (Opt-in):** Im Forscher-Panel koennen alle Links einer Nachricht mit einem Klick eingereicht
  werden - nur mit aktiver Zustimmung und API-Schluessel, mit Ergebnisanzeige (uebermittelt/fehlgeschlagen) und
  Verlaufseintrag `url-scan-batch`. Ohne Zustimmung erscheint der Button nicht.
- **Befund-Export als CSV** (Forensik-Befunde, Anhang- und Archivauffaelligkeiten) im Forscher-Panel.
- **Burst-Erkennung:** Die Statistikansicht meldet Haeufungen - viele Eintraege desselben Absenders innerhalb von
  10 Minuten (inkl. Anzahl der Uebertragungen).

### Fixed

- **Link-Extraktion aus mehrteiligen Nachrichten:** `extractTextFromParts` wurde an fuenf Stellen mit einem Array
  (`fullMessage.parts`) statt mit dem Wurzelteil aufgerufen. Dadurch blieben Text und Links bei mehrteiligen Nachrichten
  (Normalfall im Postfach) leer - die Link-Analyse lief ins Leere. Jetzt wird das Wurzelteil uebergeben; ein
  Regressionstest deckt verschachtelte Parts ab.

## [1.13.0] – 2026-09-28

### Added (Forscher-Sicht, ausschliesslich lokal)

- **Header-Forensik** mit Schweregrad und MITRE-Zuordnung: Anzeigename-Markenimitation, Envelope-Abweichungen
  (Return-Path/Reply-To/Message-ID), fehlgeschlagene oder fehlende Authentifizierung, `dmarc=none`, fehlende
  TLS-Angabe in der Zustellkette, ungewoehnliche Hop-Reihenfolge (öffentlich nach intern), lange Hop-Verzoegerungen,
  Massenmailer-Kennungen und Datumsabweichungen. Die Beitraege fliessen **gedeckelt** (max. 35 Punkte) in die
  Bewertung ein, damit schwache Einzelsignale die Warnschwelle nicht allein erreichen.
- **Unicode-Forensik:** Bidi-Steuerzeichen (Right-to-Left-Override), nullbreite Zeichen und gemischte Schriftsysteme
  in Anzeigename, Betreff und URLs; Treffer werden als Befund mit Schwere und Technik ausgewiesen.
- **Punycode-Dekodierung:** `xn--`-Hosts werden in lesbare Zeichen uebersetzt und in der Link-Anatomie angezeigt
  ("liest sich als ...").
- **Archiv-Inspektion ohne Entpacken:** Das ZIP-Inhaltsverzeichnis wird gelesen und auf ausfuehrbare Eintraege,
  doppelte Dateiendungen, verschachtelte Archive und Pfadwechsel geprueft - ohne dass Inhalte entpackt oder
  ausgefuehrt werden.
- **STIX-2.1-Export** der Indikatoren ueber einen Button im Forscher-Panel (Bundle mit Identity + Indicators).
- **Provider-Pivots:** Pro Indikator (Hash, IP, Domain, URL) werden Links zu VirusTotal, Hybrid Analysis, urlscan.io,
  URLhaus und AbuseIPDB angeboten - **nur als Link**, der Aufruf erfolgt durch den Nutzer (Hinweis im Panel).

### Changed

- `getMessageInsights` liefert zusaetzlich Forensik-Befunde, MITRE-Techniken, Archivinhalte, STIX-Bundle, Pivots und
  den dekodierten Punycode-Host; das Forscher-Panel zeigt all das rollenabhaengig (nur `research`/`audit`).
- Bugfix: gemischte Schriftsysteme wurden nicht erkannt, weil lateinische Zeichen nicht als Schriftsystem erfasst
  wurden.

## [1.12.0] – 2026-09-28

### Added

- **Forscher-Analyse im Popup (Rollen `research`/`audit`):**
  - **Indikatoren (IOCs)** aus der Nachricht: URLs, Hosts, registrierbare Domains, IP-Adressen, Adressen,
    SHA-256-Werte, Message-IDs, Mailserver - mit Export als **JSON und CSV**.
  - **Authentifizierungskette:** SPF/DKIM/DMARC-Verdikte inklusive Domain und pruefendem Server.
  - **Received-Hops** in chronologischer Reihenfolge mit Absender-/Empfaengerhost, IP und **Laufzeit je Hop**.
  - **Link-Anatomie:** Schema, Host, registrierbare Domain, Subdomain-Tiefe, IP-/Punycode-Hosts, Zugangsdaten in der
    URL, Tracking-Parameter sowie eine bereinigte URL ohne Tracker.
  - **Anhang-Typanalyse ohne Ausfuehrung:** Magic-Byte-Erkennung, Abgleich mit dem deklarierten MIME-Typ,
    doppelte Dateiendungen, ausfuehrbare Endungen und makrofaehige Dokumente.
  - **Bewertung nach Bestandteilen:** der Score wird jetzt je Pruefschritt (Authentifizierung, URLhaus,
    IP-Reputation, Reply-To, Verhalten, Absender-Domain, Links, eigene Regeln) mit Punktebeitrag ausgewiesen.
- **Praeziere Injektionsdiagnose:** Der Selbsttest unterscheidet nun sauber zwischen dem empfohlenen Weg
  (`scripting.messageDisplay.registerScripts`, ab Thunderbird 128) und dem Fallback, bei dem die Banner je Nachricht in
  die Ansicht injiziert werden. Der Fallback wird als **ok** mit Erklaerung gemeldet (er funktioniert vollstaendig),
  echte Fehler als **fail** samt Ursache; zusaetzlich wird die Injektion verifiziert (leeres Ergebnis = Fehler).

## [1.11.0] – 2026-09-28

### Added

- **Vollstaendige Lokalisierung (Deutsch/Englisch):** 125 Schluessel je Sprache in `_locales/`, ein Helfer
  (`ui_i18n.js`) fuer die Erweiterungsseiten und `data-i18n`-Attribute im Markup. Die Sprache folgt automatisch der
  Thunderbird-Oberflaeche; der deutsche Text im Markup dient als Fallback, die Oberflaeche ist nie leer.
  Neue Pruefung `scripts/check-locales.js` (Katalogparitaet + verwendete Schluessel) laeuft in den
  Pre-Submit-Checks und schlaegt fehl, sobald eine Uebersetzung fehlt.
- **Branding/Designsystem:** `theme.css` und `messageDisplay/banner.css` in einer gemeinsamen Farbwelt (Schild-Blau,
  Signal-Orange, klare OK/Warnung/Fehler-Toene), mit Markenkopf (Logo + Wortmarke + Tagline), Karten, Badges,
  Score-Stufen, Fokusringen und Dark-Mode-Varianten. Dokumentation: `docs/branding.md`.

### Changed

- Popup und Optionen nutzen den Markenkopf; Banner in der Nachrichtenansicht beziehen ihre Farben aus themebaren
  CSS-Variablen statt fester Werte.
- Skripte: `ui_i18n.js` wird mit ausgeliefert; `scripts/verify-package.js` erlaubt es explizit.

## [1.10.0] – 2026-09-28

### Added

- **Lokale Regel-/IOC-Engine:** eigene Regeln fuer Absender, Domain, URL, Betreff, Dateiname und SHA-256 mit den
  Aktionen `whitelist`, `blacklist` und `score` (plus Vergleich `contains`/`exact`/`regex`). Regeln ergaenzen die
  Bewertung, koennen kurzschliessen und verhindern Uploads, wenn eine Datei lokal bereits bekannt ist
  (`BLACKLISTED_LOCALLY`/`WHITELISTED_LOCALLY`). Verwaltung im Optionsdialog, inklusive **Profil-Export/-Import**
  (Team-Wissen ohne Datenabfluss) und Unterstuetzung in der Enterprise-Policy.
- **SIEM-/Webhook-Export:** optionaler Export der Verlaufsereignisse an einen eigenen HTTPS-Endpunkt (z. B. SIEM oder
  Ticketsystem). Standardmaessig **aus**, verlangt zusaetzlich die globale Zustimmung, optional mit Shared Secret
  (`X-Thundy-Secret`), inklusive Testsendung und zentraler Vorgabe ueber die Enterprise-Policy.
- **Verlaufssuche und Datumsfilter:** Volltextsuche ueber Aktion, Anbieter, Absender, Datei, Domain, IP, Hash,
  Verdikt und Details sowie Zeitraumfilter (von/bis) in der Verlaufsansicht.
- **Attachment-Disarming ausgebaut:** externe Medien (Bilder/Video/Audio/iframe) werden blockiert und die Quelle nur
  als Marker vermerkt, das entschaerfte Dokument erhaelt einen Hinweisbanner mit Zusammenfassung, und die
  Entschaerfung wird im Verlauf protokolliert (Aktion `disarm`).

### Changed

- Neue Hintergrund-Aktionen `getRuleProfile`, `importRuleProfile`, `evaluateRules`, `testWebhook`, `getWebhookStatus`.
- Diagnose meldet zusaetzlich den Zustand des Webhook-Exports.

## [1.9.0] – 2026-09-28

### Added

- **Enterprise-Policy (`browser.storage.managed`):** Administratoren koennen Vorgaben zentral verteilen
  (Zustimmung, Datenschutz-Stufe, Ansichtsrolle, Verlauf an/aus und Limit, Whitelist/Blacklist, Always-Manual,
  Time-of-Click, IP-Reputation). Verwaltete Werte haben Vorrang vor lokalen Einstellungen, greifen ohne Neustart
  (`storage.onChanged` fuer `managed`) und werden nie uebertragen. Anleitung und Vorlage:
  `docs/enterprise/deployment.md` und `docs/enterprise/policy.json`.
- **Diagnose / Selbsttest** in den Einstellungen: prueft Zustimmung, API-Schluessel, alle Host-Berechtigungen,
  die zeitverzoegerte Ergebnisabfrage (`alarms`), die Registrierung des Nachrichten-Scripts, den lokalen
  Ergebnisspeicher, den Verlauf, offene Auftraege und die Enterprise-Policy - mit ok/Hinweis/Fehler je Punkt und
  einem Klick. Es werden dabei keine Daten uebertragen.
- **Statistikansicht:** aggregiert den Verlauf (Uebertragungen, rein lokale Pruefungen, Anbieter, Aktionen,
  Verteilung pro Tag) fuer 1/7/30/90 Tage, inklusive Hinweis auf aktive verwaltete Vorgaben.
- **Berichts-Export je Nachricht:** erzeugt aus lokaler Bewertung, Anhaengen, Verdikten und Uebertragungen einen
  Markdown- und JSON-Bericht ("was wurde geprueft, was wurde uebertragen") zum Ablegen oder Weitergeben.

### Changed

- Neue Hintergrund-Aktionen `getDiagnostics`, `getStatistics`, `getEffectiveSettings` und `getMessageReport`.
- Diagnose und Statistik sind auch Teil der Vorabpruefung fuer den Store: die Diagnose gibt dem Tester eine
  gefuehrte Funktionspruefung, statt sich auf Handbuecher zu verlassen.

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
