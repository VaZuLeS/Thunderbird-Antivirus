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
| Version | 1.6.5 – siehe [CHANGELOG.md](CHANGELOG.md) |
| Lizenz | MIT – siehe [LICENSE](LICENSE) |
| Maintainer | Jan Bludau (VaZuLeS) |
| Support | bludau.it.services@gmail.com |
| Repository | https://github.com/VaZuLeS/Thunderbird-Antivirus |
| Release (unsigniertes XPI zum Testen) | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.5 |
| Voraussetzung | Thunderbird 140.0 oder neuer (Manifest V3) |
| Sprachen | Manifest-Strings und Banner lokalisiert (Englisch, Deutsch – `_locales/`); Options- und Popup-Oberfläche derzeit nur auf Deutsch |

## Was das Add-on macht

- **Zuerst lokale Prüfungen.** Beim Anzeigen einer Nachricht werden Anhänge gehasht (SHA-256) und Betreff/Body,
  Absenderdomain, Typosquatting-Ähnlichkeiten, Reply-To-Domain, Erstkontakt, Authentifizierungs-Header
  (SPF/DKIM/DMARC) und Ihre eigene Weiße/Schwarze Liste ausgewertet; daraus entsteht ein lokaler Risiko-Score (0–100).
- **Banner in der Nachrichtenansicht.** Über der Nachricht erscheint ein Banner mit dem Hinweis, ob der Absender
  gescannt wird, und zwei Schaltflächen: **„Nur diese Nachricht scannen“** und **„Absender dauerhaft scannen“**.
- **Warnbanner.** Überschreitet der Risiko-Score die Schwelle, wird ein Warnbanner mit den Gründen in die
  Nachrichtenansicht eingefügt.
- **Links.** Links können beim Öffnen der Nachricht oder erst im Moment des Klickens geprüft werden
  (Time-of-Click-Schutz mit Hinweis beim Überfahren). Ein Kontextmenü-Eintrag scannt einen Link mit Thundy AV.
- **Popup** (Button in der Nachrichtenansicht): Nachrichten-Metadaten, gespeicherte Scan-Ergebnisse, manueller
  Upload eines Anhangs, URL-Scan und **„HTML entschärfen“** (ein HTML-Anhang wird lokal bereinigt und über den
  Download-Manager gespeichert). Die entschärfte Kopie enthält keine aktiven Inhalte **und** keine Remote-Verweise: Bilder, CSS-`url()`/`@import` und Ähnliches werden ersetzt, damit das Öffnen der Datei nicht zum Absender „zurückfunken“ kann.
- **Benachrichtigungen** fassen jeden Scan-Vorgang in **einer** Meldung mit stabiler ID zusammen:
  Sie wird **aktualisiert** (läuft → übermittelt/Job-ID → Ergebnis mit Verdikt und Score), statt neue
  Meldungen zu erzeugen; ein Klick auf die Benachrichtigung öffnet die zugehörige Nachricht, und es
  wird nur der Host genannt (kein vollständiger URL-Text). Fehler werden weiterhin separat gemeldet.
- **IP-Reputation (optional):** Die aus den `Received`-Headern extrahierten Mailserver-IPs können über VirusTotal
  oder AbuseIPDB geprüft werden.

## Für Sicherheitsforscher

Der Button in der Nachrichtenansicht (Popup) bietet neben der normalen Ergebnisanzeige eine
**Forscher-Ansicht** für IT-Sicherheitsanalysten. Sie bündelt, was die lokale Analyse über die
geöffnete Nachricht bereits weiß; die Forscher-Ansicht selbst überträgt nichts nach außen.

- **A1 – Kopfbereich.** Risiko-Score (0–100) als Badge, Verdikt, Zustimmungsstatus, Datenschutz-Stufe,
  Zeitstempel der Erhebung und Datenherkunft („lokal berechnet“ vs. „von Anbieter X geliefert“).
- **A2 – Header-Forensik.** From / Reply-To / Return-Path, Anzeigename vs. Adresse, Message-ID, Datum,
  die SPF/DKIM/DMARC-Ergebnisse aus `Authentication-Results` sowie die `Received`-Kette mit ihren Hops,
  den Zeitdifferenzen zwischen den Hops und den jeweils genannten IP-Adressen.
- **A3 – Anhang-Forensik.** Dateiname, MIME-Typ, Größe, SHA-256 (kopierbar), VirusTotal-/Hybrid-
  Analysis-Status und die bestehende Schaltfläche **„HTML entschärfen“**.
- **A4 – Link-Anatomie.** URL, Schema, Host, registrierbare Domain, TLD, Punycode-/Homoglyph-Verdacht,
  Tracking-Parameter, Kurz-URL-Erkennung und URLhaus-/urlscan.io-Status.
- **A5 – IOC-Block.** Automatisch extrahierte URLs, Domains, IP-Adressen, Hashes und E-Mail-Adressen —
  kopierbar.
- **A6 – Risiko-Aufschlüsselung.** Je Regel der Beitrag zum Score und die Begründung.
- **A7 – MITRE-ATT&CK-Zuordnung (heuristisch).** Technik-ID, Name, Taktik und Belegindikator, zusammen
  mit dem ausdrücklichen Hinweis *„heuristische Zuordnung lokaler Indikatoren, kein Nachweis eines
  Angriffs“*.
- **A8 – Zeitleiste.** Nachrichtendatum, die Scan-Zeitpunkte sowie Job-Einreichung/-Abruf.
- **A9 – Export.** JSON, CSV und ein minimales STIX-2.1-Bundle, lokal erzeugt und über den
  Download-Manager des Browsers gespeichert.

Die **MITRE-ATT&CK-Zuordnung ist heuristisch**: Sie verknüpft lokal beobachtete Indikatoren mit
Techniken und ist ein Hinweis für die manuelle Triage – kein Nachweis eines Angriffs.

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

| Datenschutz-Stufe | Anhänge | Links/URLs |
| --- | --- | --- |
| `strict` (Standard) | Nur SHA-256-Hashes und Metadaten; manueller Anhang-Upload im Popup deaktiviert | Nur Hashes/Domains an Reputationsdienste; manueller URL-Scan im Popup deaktiviert |
| `balanced` | Zusätzlich Upload von Anhängen, die keinem Anbieter bekannt sind (automatischer Scan und manueller Upload) | Weiterhin keine vollständigen URLs |
| `max` | Upload unbekannter Anhänge | Zusätzlich Upload von URLs zur Analyse (automatischer Scan und manueller URL-Scan) |

## Daten und Datenschutz

- Keine Übertragung ohne **globale Zustimmung** und eine Nutzeraktion (Banner-Button, Popup, Kontextmenü oder eine
  ausdrückliche Absender-Zustimmung).
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
`ignoreFiles`-Regeln aus `web-ext-config.mjs` bereinigt, sodass Testdateien, `tools/`, `testdata/`, `docs/`,
`scripts/`, `examples/` und Lockfiles nicht mitgeliefert werden.

## Bauen, Lint und Tests

```bash
npm ci                                                # Dev-Abhängigkeiten installieren (jsdom, web-ext)
npm test                                              # alle node:test-Dateien ausführen
node ./scripts/pre-submit-checks.js                   # Manifest-, Datenschutz- und Rechte-Checks
npx web-ext lint                                      # addons-linter
npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
node ./scripts/verify-package.js ./build              # Inhalt und Größe des Pakets prüfen
npm run store-gate                                    # Submission-Gate (vom Maintainer ergänzt)
```

- `npm test` nutzt das Skript aus der `package.json` (`node --test`) und führt damit **alle** dort definierten
  Testdateien aus (die vollständige Suite), nicht nur `background.test.js`.
- `npm run check` verkettet Pre-Submit-Checks, Tests, Lint-Filter, Build und Paketprüfung.
- `web-ext lint` meldet derzeit **0 Fehler**. Die verbleibenden Warnungen sind fast ausschließlich
  `UNSUPPORTED_API`-Hinweise, weil der Linter gegen ein Firefox-Ziel prüft und Thunderbird-spezifische APIs wie
  `messages.*` oder `messageDisplay.*` nicht kennt. Vor einem Release die Liste durchsehen.
- `web-ext build` erzeugt das XPI nur aus den Laufzeitdateien; die `ignoreFiles`-Regeln in `web-ext-config.mjs`
  halten Tests, `tools/`, `testdata/`, `docs/`, `scripts/`, `examples/` und Lockfiles aus dem Paket, und
  `scripts/verify-package.js` prüft das Ergebnis. (`web-ext` liest keine `.webextignore`-Datei; `web-ext-config.mjs`
  ist die einzige Quelle.)
- Die CI (`.github/workflows/ci.yml`) läuft bei jedem Push und Pull Request mit Node 22: `npm ci`,
  `node ./scripts/pre-submit-checks.js`, `node --test background.test.js` und `npx web-ext lint`. Ausführlichere
  Workflow-Definitionen (vollständiges `npm test`, Lint-Filter für die bekannten Thunderbird-Fehlerpositive,
  XPI-Build mit Paketprüfung und ein manueller Signier-Job) liegen in [docs/ci/](docs/ci/README.md); sie konnten in
  dieser Umgebung nicht unter `.github/workflows/` eingereicht werden, weil dem Token die nötige
  `workflows`-Berechtigung fehlt.
- Der manuelle Live-Test in Thunderbird 140 ESR ist in [docs/live_test_protocol.md](docs/live_test_protocol.md)
  beschrieben.
- Ausführlicher: [docs/quickstart.md](docs/quickstart.md).

## Berechtigungen im Überblick

| Berechtigung | Wofür sie benötigt wird |
| --- | --- |
| `messagesRead` | Angezeigte Nachricht (Betreff, Absender, Text, Anhänge) lesen, damit sie analysiert werden kann; nur für geöffnete Nachrichten und wenn ein Scan ausgelöst wird. |
| `storage` | Einstellungen, Zustimmungs-Flag, Absender-Opt-ins, Anbieter-API-Schlüssel und der lokale Scan-Cache. |
| `notifications` | Systembenachrichtigungen zu Scan-Start, Einreichung und Fehlern. |
| `scripting` | Banner, Warnhinweis und Time-of-Click-Hinweis in die Nachrichtenansicht einfügen (nur mitgelieferter Code, kein Remote-Code). |
| `downloads` | Einen lokal bereinigten („entschärften“) HTML-Anhang über den Download-Manager speichern. |
| `menus` | Die beiden Kontextmenü-Einträge („diesen Link scannen“, „alle Links dieser Nachricht scannen“) anlegen. Sie lösen nur die ohnehin zustimmungsgebundenen Scan-Pfade aus. |

Optionale, zur Laufzeit und nur als Reaktion auf eine Nutzeraktion angefragte Berechtigung:

| Berechtigung | Wann / warum |
| --- | --- |
| `sensitiveDataUpload` (`optional_permissions` in der `manifest.json`) | Wird zusammen mit der globalen Zustimmung angefragt, damit Nachrichtendaten an einen Remote-Server übertragen werden dürfen; beim Abschalten der Zustimmung wieder entfernt. Thunderbird-Bezeichnung: „sensible Nutzerdaten an einen Remote-Server übertragen“. |

Optionale Host-Berechtigungen (`optional_host_permissions` in der `manifest.json`) – jede wird erst zur Laufzeit
angefragt, wenn der passende Anbieter genutzt wird:

| Origin | Anbieter |
| --- | --- |
| `https://hybrid-analysis.com/*`, `https://*.hybrid-analysis.com/*` | Hybrid Analysis |
| `https://*.virustotal.com/*` | VirusTotal |
| `https://urlscan.io/*`, `https://*.urlscan.io/*` | urlscan.io |
| `https://urlhaus-api.abuse.ch/*` | URLhaus (abuse.ch) |
| `https://api.abuseipdb.com/*` | AbuseIPDB |

Zusätzlich deklariert die `manifest.json` unter `browser_specific_settings.gecko.data_collection_permissions`
`{ "required": ["none"], "optional": ["personalCommunications"] }`: Ohne die optionale Zustimmung werden keine der
deklarierten Datenkategorien erhoben oder übertragen, und die optionale Kategorie `personalCommunications` wird erst
relevant, wenn die externe Analyse aktiviert ist. Übertragen wird nur nach globaler Zustimmung und einer Nutzeraktion
und nur an Anbieter, denen Sie den Zugriff gewährt haben.

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

- **Manuelle Verifikation steht aus.** Die Banner-Injektion in die Thunderbird-Nachrichtenansicht ist durch
  Unit-Tests (mit gemockten Thunderbird-APIs) abgedeckt, aber noch nicht manuell in Thunderbird 140 ESR geprüft.
  Bitte melden Sie unerwartetes Verhalten mit Ihrer Thunderbird-Version; schlägt eine Injektion fehl, protokolliert
  der Code einen Hinweis über `Logger.warn`.
- **Noch keine echten Store-Screenshots.** In `docs/screenshots/` liegen nur SVG-Platzhalter; für das Store-Listing
  müssen echte Screenshots erstellt werden.
- **Noch nicht im Add-ons-Store eingereicht** – es gibt kein öffentliches Listing und keine Store-URL.
- Options- und Popup-Oberfläche gibt es derzeit nur auf Deutsch; Manifest-Strings und Banner sind lokalisiert.
- In der Standard-Stufe `strict` werden unbekannte Anhänge gar nicht hochgeladen – weder automatisch noch im Popup
  (dort sind manueller Upload und manueller URL-Scan deaktiviert und zeigen einen Hinweis). Dafür in den Einstellungen
  auf `balanced` (Anhänge) oder `max` (Anhänge und URLs) umstellen.
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
