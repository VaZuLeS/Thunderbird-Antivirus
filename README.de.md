# Thundy AV – E-Mail-Scanner für Thunderbird

**Thundy AV** ist ein Opt-in-Sicherheits-Add-on für Mozilla Thunderbird. Es prüft die Nachricht, die Sie gerade
lesen, auf schädliche Anhänge und verdächtige Links und überträgt – nur nach Ihrer ausdrücklichen Zustimmung – die
minimal notwendigen Daten an externe Analysedienste.

> **Status:** Das Add-on ist **noch nicht im Thunderbird-Add-ons-Store (addons.thunderbird.net) gelistet**, es gibt
> daher keine Store-URL. Bau- und Ladehinweise finden Sie unten. Was fertig ist und was noch offen ist, steht in
> [docs/STATUS.md](docs/STATUS.md).

| Feld | Wert |
| --- | --- |
| Add-on-Name | Thundy AV – Email Scanner for Thunderbird |
| Kurzname | Thundy AV |
| Add-on-ID | `thundy-av@bludau-it-services.de` |
| Version | 1.6 – siehe [CHANGELOG.md](CHANGELOG.md) |
| Lizenz | MIT – siehe [LICENSE](LICENSE) |
| Maintainer | Jan Bludau (VaZuLeS) |
| Support | bludau.it.services@gmail.com |
| Repository | https://github.com/VaZuLeS/Thunderbird-Antivirus |
| Voraussetzung | Thunderbird 140.0 oder neuer (Manifest V3) |
| Sprachen | Alle sichtbaren UI-Strings (Manifest, UI in der Nachrichtenansicht, Optionsseite, Popup) werden über `browser.i18n` und `_locales/` aufgelöst (Englisch, Deutsch; die englische Übersetzung ist vollständig, Standard-Locale `en`, Fallback-Texte im Code; weitere Sprachen über zusätzliche `_locales/<code>`-Ordner) |

## Was das Add-on macht

- **Zuerst lokale Prüfungen.** Beim Anzeigen einer Nachricht werden Anhänge gehasht (SHA-256) und Betreff/Body,
  Absenderdomain, Typosquatting-Ähnlichkeiten, Reply-To-Domain, Erstkontakt, Authentifizierungs-Header
  (SPF/DKIM/DMARC) und Ihre eigene Weiße/Schwarze Liste ausgewertet; daraus entsteht ein lokaler Risiko-Score (0–100).
- **UI in der Nachrichtenansicht.** Die Oberfläche in der Nachrichtenansicht wird von einem einmalig registrierten
  Message-Display-Skript gerendert (`message_display.js`, registriert über
  `scripting.messageDisplay.registerScripts()`); den Zustand liefert das Hintergrundskript über Runtime-Messaging.
  Angezeigt werden ein Opt-in-Banner mit den Schaltflächen **„Nur diese Nachricht scannen“**,
  **„Absender dauerhaft scannen“** und **„Einstellungen öffnen“**, ein Warnbanner ab einem Risiko-Score von **50**
  (mit Begründungsliste) und ein grüner Badge, wenn SPF/DKIM/DMARC bestanden wurden.
- **Time-of-Click-Schutz.** Links im Nachrichtentext werden markiert (gestrichelte Unterstreichung plus Tooltip).
  Beim Klick wird ein Link *vor* dem Öffnen geprüft: über ein lokal gespeichertes Verdikt, sonst – bei erteilter
  Zustimmung und konfiguriertem urlscan.io-Schlüssel – über einen Live-Scan bei urlscan.io mit 6-Sekunden-Budget.
  Bösartige und nicht verifizierbare Links (`MALICIOUS`, `MALICIOUS_VISUAL`, `TIMEOUT`, `ERROR`) werden blockiert;
  ein Inline-Hinweis nennt die Begründungen und die Ziel-URL und bietet **„Link trotzdem öffnen“**. Eine so erteilte
  Freigabe gilt nur für die Sitzung (im Arbeitsspeicher, bewusst nicht im DOM). Nicht-http(s)-Schemes (z. B. `file:`,
  `ftp:`, `smb:`) werden ebenfalls blockiert (fail closed); erlaubt sind `mailto:`, `tel:`, `news:` und `nntp:`.
  Ist die Option „Time-of-Click Protection“ deaktiviert, wird nicht eingegriffen.
- **Auto-Scan-Option.** „Links in der E-Mail sofort beim Öffnen prüfen (Auto-Scan)“ prüft bei erteilter Zustimmung
  und konfiguriertem urlscan.io-Schlüssel bis zu **20 Links** je Nachricht über urlscan.io und speichert die
  Verdikte lokal, sodass ein späterer Klick keine neue Netzwerkanfrage benötigt.
- **Kontextmenüs.** Zwei Einträge existieren (Berechtigung `menus`): **„Link mit Thundy AV scannen“** (Kontext
  `link`) und **„Alle Links dieser Nachricht scannen“** (Kontext `message_display_action`, bis zu 20 Links je
  Aufruf).
- **Popup** (Button in der Nachrichtenansicht): Nachrichten-Metadaten, gespeicherte Scan-Ergebnisse, manueller
  Upload eines Anhangs, URL-Scan und **„HTML entschärfen“** (ein HTML-Anhang wird lokal bereinigt und über den
  Download-Manager gespeichert). Das Popup ermittelt die angezeigte Nachricht über
  `messageDisplay.getDisplayedMessages()`; **ohne globale Zustimmung fragt es keinen Anbieter ab** und zeigt nur eine
  Hinweiskarte mit Verweis auf die Einstellungen.
- **Benachrichtigungen** melden Scan-Start, Einreichung und Fehler.
- **IP-Reputation (optional):** Die aus den `Received`-Headern extrahierten Mailserver-IPs können über VirusTotal
  oder AbuseIPDB geprüft werden.

## Zustimmungsmodell (neu in 1.6)

1. **Globale Zustimmung – Voraussetzung für jede Übermittlung.** In den Einstellungen muss
   *„Externe Analyse erlauben“* aktiviert werden; Standard ist **aus**. Das Hintergrundskript erzwingt den Schalter
   für jeden Codepfad, der mit Dritten kommuniziert: ohne Zustimmung wird nichts übertragen, das Banner weist darauf
   hin.
2. **Datenschutz-Stufe – wie viel übertragen werden darf.** Standard ist `strict`.
3. **Host-Berechtigungen sind optional.** Alle Anbieter-Origins stehen in `optional_host_permissions` in der
   `manifest.json` und werden zur Laufzeit über `browser.permissions.request()` nur für den tatsächlich genutzten
   Anbieter angefragt. Vorab wird nichts gewährt.
4. **Pro Nachricht oder pro Absender.** Ein Scan ist entweder eine einmalige Aktion (Banner, Popup, Kontextmenü)
   oder eine dauerhafte Zustimmung für einen einzelnen Absender.
5. **Datenkonsent-Deklaration.** Die `manifest.json` deklariert
   `browser_specific_settings.gecko.data_collection_permissions` als `required: ["none"]` plus die **optionale**
   Kategorie `personalCommunications`. Es wird also nichts zwingend erhoben; Nachrichteninhalte dürfen nur nach
   ausdrücklichem Opt-in übermittelt werden. Wo Thunderbird die eingebaute Datenkonsent anbietet, fragt der
   Optionsdialog diese Kategorie zusätzlich an
   (`browser.permissions.request({ data_collection: ['personalCommunications'] })`, Feature-Erkennung über
   `permissions.getAll().data_collection`), sobald die globale Zustimmung aktiviert wird; wird sie abgelehnt, wird
   die globale Zustimmung wieder deaktiviert und nichts übermittelt. Das Hintergrundskript erzwingt den erteilten
   Zustand in `mayTransmitExternally()`: Meldet die Umgebung `personalCommunications` als nicht erteilt, wird nicht
   übermittelt.

| Datenschutz-Stufe | Anhänge | Links/URLs |
| --- | --- | --- |
| `strict` (Standard) | Nur SHA-256-Hashes und Metadaten | Nur Hashes/Domains an Reputationsdienste |
| `balanced` | Zusätzlich Upload von Anhängen, die keinem Anbieter bekannt sind | Weiterhin keine vollständigen URLs |
| `max` | Upload unbekannter Anhänge | Zusätzlich Upload von URLs zur Analyse |

## Daten und Datenschutz

- Keine Übertragung ohne **globale Zustimmung** und eine Nutzeraktion (Banner-Button, Popup, Kontextmenü oder eine
  ausdrückliche Absender-Zustimmung). Das gilt auch für das Popup: Ohne globale Zustimmung fragt es keinen Anbieter
  ab und zeigt stattdessen eine Hinweiskarte.
- **Keine Telemetrie und kein Entwickler-Server.** Alle Anfragen gehen direkt von Ihrem Thunderbird an den
  Anbieter, den Sie konfiguriert und freigegeben haben.
- Lokal gespeichert werden: Einstellungen, Zustimmungs-Flags, API-Schlüssel und ein Scan-Metadaten-Cache
  (IndexedDB, `db.js`). Der Cache lässt sich in den Einstellungen über „Cache leeren“ entfernen.
- API-Schlüssel liegen **unverschlüsselt** in `browser.storage.local` im Thunderbird-Profil – Grenzen und
  Empfehlungen dazu: [docs/external_service_hardening.md](docs/external_service_hardening.md).
- Datenschutzerklärung (live): https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Quellen im Repository: [docs/privacy_policy.md](docs/privacy_policy.md) (Erklärung),
  [docs/reviewer_notes.md](docs/reviewer_notes.md) (Reviewer-Hinweise),
  [docs/store_listing.md](docs/store_listing.md) (Listing-Entwurf).

## Externe Analysedienste

Die Host-Origins stehen in der `manifest.json` (`optional_host_permissions`) und werden zur Laufzeit angefragt –
nur für den Anbieter, der gerade verwendet wird.

| Anbieter | Verwendung | Eigener API-Schlüssel |
| --- | --- | --- |
| [Hybrid Analysis](https://www.hybrid-analysis.com/) | Upload und Bewertung von Dateien/Anhängen | erforderlich |
| [VirusTotal](https://www.virustotal.com/) | Abgleich von Anhang-Hashes; optional IP-Reputation | erforderlich |
| [urlscan.io](https://urlscan.io/) | Live-Scan von URLs (Time-of-Click) | optional (kostenloser Schlüssel möglich) |
| [URLhaus / abuse.ch](https://urlhaus.abuse.ch/) | Abgleich von URLs/Domains gegen eine Malware-URL-Datenbank | optional |
| [AbuseIPDB](https://www.abuseipdb.com/) | Optional: IP-Reputation der sendenden Mailserver | erforderlich (für dieses Feature) |

Beachten Sie die Nutzungsbedingungen und Datenschutzhinweise der Anbieter, die Sie aktivieren; sie verarbeiten die
übermittelten Daten auf ihrer eigenen Infrastruktur.

## Voraussetzungen

- **Thunderbird 140.0 oder neuer** (das Add-on nutzt Manifest V3 und `data_collection_permissions`).
- Nur für die Entwicklung: **Node.js ≥ 20** (CI nutzt Node 22) und npm.
- API-Schlüssel der Anbieter, die Sie verwenden möchten (siehe Tabelle oben).

## Installation

### Quellcode als temporäres Add-on laden (Entwicklung)

```text
Thunderbird → ☰ → Add-ons und Themes → Zahnrad-Symbol → "Add-ons debuggen"
(öffnet about:debugging#/runtime/this-thunderbird)
→ "Temporäres Add-on laden…" → /pfad/zu/Thunderbird-Antivirus/manifest.json auswählen
```

Alternativ Thunderbird über web-ext starten:

```bash
npx web-ext run --firefox=/pfad/zu/thunderbird
```

`web-ext` hat **keine** Option `--target thunderbird` (gültige Targets: `firefox-desktop`, `firefox-android`,
`chromium`). Verwenden Sie `--firefox` mit dem Pfad zur Thunderbird-Binärdatei, alternativ einen Alias wie
`--firefox nightly`.

Temporäre Add-ons werden beim Beenden von Thunderbird entfernt – gut zum Testen, nicht für den Dauerbetrieb.

### Manuelle Installation einer gebauten XPI

1. Paket bauen (siehe unten): `npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest`
2. In Thunderbird **Add-ons und Themes** öffnen (`Strg+Shift+A`), auf das Zahnrad-Symbol klicken und
   **„Add-on aus Datei installieren…“** wählen, dann die ZIP/XPI aus `./build` auswählen.
3. Installation bestätigen und – falls Thunderbird danach fragt – neu starten.
4. Host-Berechtigungen werden bei der Installation nicht erteilt; das Add-on fragt sie später an, wenn Sie einen
   Anbieter tatsächlich nutzen.

Hinweis: Eine lokal gebaute XPI ist unsigniert. Release-Versionen von Thunderbird lehnen unsignierte Add-ons ab,
sofern die Signaturprüfung nicht deaktiviert ist (`about:config` → `xpinstall.signatures.required = false`, nicht in
allen Builds verfügbar); für die Verteilung `npx web-ext sign --channel listed`/`--channel unlisted` oder die
Store-Signierung nutzen. Release-Pakete entstehen mit `web-ext build --source-dir .` und werden über die
`ignoreFiles`-Regeln aus `web-ext-config.mjs` (ergänzt durch `.webextignore`) bereinigt, sodass Testdateien,
`docs/`, `scripts/`, `examples/` und Lockfiles nicht
mitgeliefert werden.

## Bauen, Lint und Tests

```bash
npm ci                                                # Dev-Abhängigkeiten installieren (jsdom, web-ext)
npm test                                              # alle node:test-Dateien ausführen
node ./scripts/pre-submit-checks.js                   # Manifest-, Datenschutz- und Rechte-Checks
npx web-ext lint                                      # addons-linter
npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
```

- `npm test` nutzt das Skript aus der `package.json` (`node --test`) und führt damit **alle** Testdateien des
  Repositorys aus, nicht nur `background.test.js`. Aktueller Stand: **437 Tests, 0 Fehler** – u. a.
  `message_display.test.js` (UI in der Nachrichtenansicht und Time-of-Click), die Popup-Consent-Tests in
  `api.test.js` und die Pre-Submit-Check-Tests in `scripts/pre-submit-checks.test.js`.
- `scripts/pre-submit-checks.js` prüft zusätzlich, dass jeder verwendete `browser.*`-API-Namespace eine deklarierte
  Berechtigung hat, dass die `data_collection_permissions`-Deklaration zu den Übermittlungspfaden passt, dass ein
  programmatisch registriertes Skript (`message_display.js`) im Paket liegt und dass jeder lokalisierte UI-String
  einen Katalogeintrag hat (derzeit 157). Aktueller Stand: 0 Fehler, 2 Warnungen (noch keine echten Screenshots, und
  die aktive `.github/workflows/ci.yml` führt weiterhin nur `background.test.js` aus – die vollständige CI steht in
  `docs/ci/ci.yml`).
- `web-ext lint` meldet derzeit **0 Fehler** und **25 Warnungen**, alle davon bekannte Thunderbird-False-Positives
  (fast ausschließlich `UNSUPPORTED_API`-Hinweise, weil der Linter gegen ein Firefox-Ziel prüft und
  Thunderbird-spezifische APIs wie `messages.*` oder `messageDisplay.*` nicht kennt). Die Liste wird über
  `scripts/filter-lint-warnings.js` gefiltert.
- Das gebaute XPI enthält **18 Dateien / 238.851 Bytes entpackt** (zuvor 17 Dateien); `scripts/verify-package.js`
  prüft Dateiliste und Größe.
- Die CI (`.github/workflows/ci.yml`) läuft bei jedem Push und Pull Request mit Node 22: `npm ci`,
  `node ./scripts/pre-submit-checks.js`, `node --test background.test.js` und `npx web-ext lint`.
- Ausführlicher: [docs/quickstart.md](docs/quickstart.md).

## Berechtigungen im Überblick

| Berechtigung | Wofür sie benötigt wird |
| --- | --- |
| `messagesRead` | Angezeigte Nachricht (Betreff, Absender, Text, Anhänge) lesen, damit sie analysiert werden kann; nur für geöffnete Nachrichten und wenn ein Scan ausgelöst wird. |
| `storage` | Einstellungen, Zustimmungs-Flag, Absender-Opt-ins, Anbieter-API-Schlüssel und der lokale Scan-Cache. |
| `notifications` | Systembenachrichtigungen zu Scan-Start, Einreichung und Fehlern (auch wenn die UI in der Nachrichtenansicht nicht registriert werden kann). |
| `scripting` | Das mitgelieferte Message-Display-Skript `message_display.js` registrieren (`scripting.messageDisplay.registerScripts()`), das die UI in der Nachrichtenansicht rendert: Opt-in-Banner mit seinen Schaltflächen, Warnbanner und Time-of-Click-Schutz. Ausgeführt wird ausschließlich mitgelieferter Code; es werden keine Remote-Ressourcen und kein Remote-Code geladen. |
| `downloads` | Einen lokal bereinigten („entschärften“) HTML-Anhang über den Download-Manager speichern. |
| `menus` | Die beiden Kontextmenü-Einträge „Link mit Thundy AV scannen“ (Link-Kontext) und „Alle Links dieser Nachricht scannen“ (Kontext der Nachrichtenanzeige-Aktion) anlegen. |

Optionale Host-Berechtigungen (`optional_host_permissions` in der `manifest.json`) – genau fünf Origins, jede wird
erst zur Laufzeit angefragt, wenn der passende Anbieter genutzt wird:

| Origin | Anbieter |
| --- | --- |
| `https://hybrid-analysis.com/*` | Hybrid Analysis |
| `https://www.virustotal.com/*` | VirusTotal |
| `https://urlscan.io/*` | urlscan.io |
| `https://urlhaus-api.abuse.ch/*` | URLhaus (abuse.ch) |
| `https://api.abuseipdb.com/*` | AbuseIPDB |

Die `manifest.json` deklariert unter `browser_specific_settings.gecko.data_collection_permissions`
`required: ["none"]` und `optional: ["personalCommunications"]`: Es wird **nichts zwingend erhoben**, und
Nachrichteninhalte dürfen nur nach ausdrücklichem Opt-in (globale Zustimmung plus ausgelöster Scan) übermittelt
werden. Zusätzlich fragt der Optionsdialog dort, wo die Umgebung die eingebaute Datenkonsent anbietet, die
Kategorie an, sobald die globale Zustimmung aktiviert wird (Feature-Erkennung über
`browser.permissions.getAll().data_collection`), und deaktiviert die Zustimmung wieder, wenn die Anfrage
abgelehnt wird. Unabhängig davon erzwingt das Hintergrundskript den erteilten Zustand in
`mayTransmitExternally()`: Wird `personalCommunications` als nicht erteilt gemeldet, findet keine Übermittlung
statt.

## Einen weiteren Analysedienst ergänzen

1. Die Origin(s) des Anbieters in `optional_host_permissions` der `manifest.json` eintragen.
2. Den Host in `PROVIDER_ORIGINS` in `background.js` ergänzen und die Berechtigung zur Laufzeit über
   `browser.permissions.request()` unmittelbar vor der ersten Anfrage anfragen.
3. Jeden neuen Netzwerkaufruf über `mayTransmitExternally()` / `assertExternalAnalysisAllowed()` absichern, damit die
   globale Zustimmung greift.
4. Unit-Tests für den neuen Pfad ergänzen und [docs/privacy_policy.md](docs/privacy_policy.md),
   [docs/reviewer_notes.md](docs/reviewer_notes.md) sowie den Listing-Text um Anbietername und die exakt
   übertragenen Daten erweitern.

## Bekannte Einschränkungen

- **Manuelle Verifikation steht aus (Pflicht vor der Einreichung).** Die UI in der Nachrichtenansicht (Opt-in-Banner,
  Warnbanner, SPF/DKIM/DMARC-Badge, Link-Markierung), die beiden Kontextmenü-Einträge, der aus dem Banner
  ausgelöste Berechtigungsdialog und die Blockade eines Links sind nur durch Unit-Tests mit gemockten
  Thunderbird-APIs abgedeckt; sie wurden noch nicht manuell in Thunderbird 140 ESR geprüft. Bitte melden Sie
  unerwartetes Verhalten mit Ihrer Thunderbird-Version. Lässt sich das Message-Display-Skript nicht registrieren,
  protokolliert der Code einen Fehler und erzeugt eine Systembenachrichtigung (`notificationUiUnavailable`).
- **Eingebaute Datenkonsent nicht verifiziert.** Der Optionsdialog fragt die deklarierte **optionale** Kategorie
  `personalCommunications` dort an, wo die Umgebung sie anbietet; das Hintergrundskript übermittelt nicht, solange
  sie als nicht erteilt gemeldet wird. Ob und wie Thunderbird 140 ESR diesen Dialog anzeigt, wurde in dieser
  Umgebung nicht verifiziert – der Codepfad ist nur durch Unit-Tests mit gemockten APIs abgedeckt.
- **Noch keine echten Store-Screenshots.** In `docs/screenshots/` liegen nur SVG-Platzhalter; für das Store-Listing
  müssen echte Screenshots erstellt werden – erst nach dem Live-Test in Thunderbird.
- **Noch nicht im Add-ons-Store eingereicht** – es gibt kein öffentliches Listing und keine Store-URL.
- In der Standard-Stufe `strict` werden unbekannte Anhänge nicht automatisch hochgeladen; dafür auf `balanced`/`max`
  umstellen oder einen manuellen Upload im Popup starten.
- Erkennungsqualität und Ratenlimits hängen von den konfigurierten Anbietern und Ihren eigenen API-Schlüsseln ab.
- API-Schlüssel liegen unverschlüsselt im Thunderbird-Profil (`browser.storage.local`) – wer Zugriff auf das Profil
  hat, kann sie lesen.

## Support

- E-Mail: [bludau.it.services@gmail.com](mailto:bludau.it.services@gmail.com)
- Issues und Feature-Wünsche: https://github.com/VaZuLeS/Thunderbird-Antivirus/issues
- Sicherheitsmeldungen: siehe [SECURITY.md](SECURITY.md) (bitte keine öffentlichen Issues für Schwachstellen).

## Mitwirken

Hinweise und Pull Requests sind willkommen – siehe [CONTRIBUTING.md](CONTRIBUTING.md),
[COMMUNITY.md](COMMUNITY.md) und [FIRST_TIMERS.md](FIRST_TIMERS.md). Alle Aussagen in der Dokumentation sollen am
Code überprüfbar sein; bitte vor einem Pull Request `npm test` und `npx web-ext lint` ausführen.

## Lizenz

MIT – siehe [LICENSE](LICENSE).
