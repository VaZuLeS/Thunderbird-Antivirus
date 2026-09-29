# Store-Listing — Thundy AV (final copy package)

**Add-on:** Thundy AV – Email Scanner for Thunderbird
**Short name:** Thundy AV
**Add-on ID:** thundy-av@bludau-it-services.de
**Version:** 1.6 (Manifest V3, `strict_min_version` 140.0)
**License:** MIT
**Homepage:** https://vazules.github.io/Thunderbird-Antivirus/
**Privacy policy URL:** https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
**Support:** bludau.it.services@gmail.com
**Repository / Releases:** https://github.com/VaZuLeS/Thunderbird-Antivirus
**Store status:** not submitted to the Thunderbird Add-ons Store yet — there is no store URL.

---

## 1. Title

`Thundy AV – Email Scanner for Thunderbird`

## 2. Short description (EN, max. 250 characters)

> Opt-in email scanning for Thunderbird: local checks for suspicious attachments, links and senders, plus optional analysis via Hybrid Analysis, VirusTotal, urlscan.io, URLhaus or AbuseIPDB — never without your consent.

## 3. Long description (EN)

**Thundy AV checks the emails you open in Thunderbird for attachments, links and senders that show
signs of malware, phishing or fraud — locally first, and with external analysis only if you allow
it.**

### What it does

- **Local analysis of the message you open.** Thundy AV reads the message you are viewing —
  headers (sender, recipients, subject, Received), the text and HTML body, links and attachments —
  and scores it locally: mismatched sender domains, first contact with a sender, urgency or payment
  wording, risky attachment types, suspicious links.
- **Opt-in scanning, in two steps.** Nothing is ever sent anywhere until you enable the global
  checkbox *"Allow external analysis"* in the options. In addition, each sender needs an opt-in: the
  banner above the message offers *"Scan this message only"* for a single scan and *"Scan this
  sender permanently"* if that sender should be checked automatically from now on.
- **Privacy tiers.** You choose how much may leave your computer:
  *strict* — only SHA-256 hashes of attachments; *balanced* — additionally the complete file of
  unknown attachments; *max* — additionally URLs found in the message.
- **External analysis you control.** With your own API keys, Thundy AV can query
  [Hybrid Analysis](https://www.hybrid-analysis.com/) (file, hash and URL analysis in the Falcon
  Sandbox), VirusTotal (hash and IP checks), urlscan.io (link and phishing analysis), URLhaus
  (domain checks against malware URL lists) and AbuseIPDB (IP reputation for addresses found in
  Received headers). Host access to those providers is optional and is only requested when you save
  a key for that provider.
- **Time-of-Click protection.** Links in the message text are marked (dashed underline with a tooltip) and are
  checked *before* they open: a locally stored verdict is used first, otherwise – with your consent and a
  configured urlscan.io key – a live urlscan.io check runs with a 6-second budget. Malicious and unverifiable links
  are blocked with an inline notice (reasons, target URL) and an *"Open the link anyway"* button, so the final
  decision stays with you. Non-HTTP(S) schemes are blocked; `mailto:`, `tel:`, `news:`, `nntp:` are not affected.
- **Manual controls.** Whitelist and blacklist for domains and senders, a *"always scan manually"*
  switch that blocks any automatic upload, **two context-menu entries** ("Scan link with Thundy AV" and "Scan all
  links of this message", up to 20 links per run), a popup with the message header data and a one-click *"Clear
  cache"* button for the local analysis database. Without the global consent the popup does not query any provider
  at all: it only shows a notice card that links to the options.

### What is transmitted, and when

Transmission happens **only** after you have enabled "Allow external analysis" *and* a scan has been
triggered. Depending on your privacy tier, the following can be sent to the providers named above:

- SHA-256 hashes of attachments (Hybrid Analysis, VirusTotal),
- the complete attachment of unknown files (Hybrid Analysis, tier *balanced*/"max" only),
- URLs from the message (Hybrid Analysis in tier *max*, urlscan.io when configured),
- domains from the message (URLhaus when configured),
- IP addresses from Received headers (AbuseIPDB/VirusTotal, only when configured).

The message body, the subject line, sender and recipient addresses and your API keys are **never**
transmitted. There is no telemetry, no analytics and no server operated by the developer; the
developer has no access to your data. Settings, consent flags and API keys are stored locally in
Thunderbird (`browser.storage.local`, unencrypted); scan results are stored in a local IndexedDB
database that you can empty at any time with *"Clear cache"*. Full details:
[Privacy Policy](https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html).

### Requirements

A free API key is needed for external analysis (e.g. a free account at hybrid-analysis.com). Without
a key the add-on still performs its local checks and shows the banners.

## 4. Langbeschreibung (Deutsch)

**Thundy AV prüft die in Thunderbird geöffneten E-Mails auf Anhänge, Links und Absender, die auf
Malware, Phishing oder Betrug hindeuten — zuerst lokal, und mit externer Analyse nur, wenn Sie es
erlauben.**

### Funktionen

- **Lokale Analyse der geöffneten Nachricht.** Thundy AV liest die Nachricht, die Sie gerade
  ansehen — Kopfzeilen (Absender, Empfänger, Betreff, Received), Text- und HTML-Teil, Links und
  Anhänge — und bewertet sie lokal: abweichende Absender-Domains, Erstkontakt mit einem Absender,
  Dringlichkeits- und Zahlungswortwahl, riskante Anhangstypen, verdächtige Links.
- **Opt-in-Scannen in zwei Stufen.** Es wird nichts gesendet, bevor Sie im Optionsdialog die
  globale Checkbox „Externe Analyse erlauben“ aktiviert haben. Zusätzlich braucht jeder Absender
  ein Opt-in: Der Banner oberhalb der Nachricht bietet „Nur diese Nachricht scannen“ für einen
  einmaligen Scan und „Absender dauerhaft scannen“, wenn dieser Absender künftig automatisch
  geprüft werden soll.
- **Datenschutz-Stufen.** Sie entscheiden, wie viel Ihren Rechner verlassen darf: *strict* — nur
  SHA-256-Hashes von Anhängen; *balanced* — zusätzlich die vollständige Datei unbekannter Anhänge;
  *max* — zusätzlich URLs aus der Nachricht.
- **Externe Analyse unter Ihrer Kontrolle.** Mit eigenen API-Schlüsseln kann Thundy AV
  [Hybrid Analysis](https://www.hybrid-analysis.com/) (Datei-, Hash- und URL-Analyse in der Falcon
  Sandbox), VirusTotal (Hash- und IP-Prüfungen), urlscan.io (Link- und Phishing-Analyse), URLhaus
  (Domain-Prüfung gegen Malware-URL-Listen) und AbuseIPDB (Reputation von IP-Adressen aus
  Received-Headern) abfragen. Der Host-Zugriff auf diese Anbieter ist optional und wird erst
  angefragt, wenn Sie einen Schlüssel für den jeweiligen Anbieter speichern.
- **Time-of-Click-Schutz.** Links im Nachrichtentext werden markiert (gestrichelte Unterstreichung mit Tooltip) und
  *vor* dem Öffnen geprüft: zuerst über ein lokal gespeichertes Verdikt, sonst – bei erteilter Zustimmung und
  konfiguriertem urlscan.io-Schlüssel – über einen Live-Scan bei urlscan.io mit 6-Sekunden-Budget. Bösartige und
  nicht verifizierbare Links werden blockiert; ein Inline-Hinweis nennt Begründungen und Ziel-URL und bietet
  „Link trotzdem öffnen“, sodass die letzte Entscheidung beim Nutzer bleibt. Nicht-http(s)-Schemes werden
  blockiert; `mailto:`, `tel:`, `news:`, `nntp:` sind nicht betroffen.
- **Manuelle Kontrolle.** Whitelist und Blacklist für Domains und Absender, ein Schalter „Immer
  manuell scannen", der jeden automatischen Upload verhindert, **zwei Kontextmenü-Einträge** („Link mit Thundy AV
  scannen“ und „Alle Links dieser Nachricht scannen“, bis zu 20 Links je Aufruf), ein Popup mit den Kopfzeilendaten
  der Nachricht und eine Schaltfläche „Cache leeren“ für die lokale Analysedatenbank. Ohne globale Zustimmung fragt
  das Popup keinen Anbieter ab: es zeigt nur eine Hinweiskarte mit Verweis auf die Einstellungen.

### Was wann übertragen wird

Eine Übertragung erfolgt **nur**, wenn Sie „Externe Analyse erlauben“ aktiviert **und** einen Scan
ausgelöst haben. Abhängig von der Datenschutz-Stufe können an die oben genannten Anbieter gesendet
werden:

- SHA-256-Hashes von Anhängen (Hybrid Analysis, VirusTotal),
- der vollständige Anhang unbekannter Dateien (Hybrid Analysis, nur Stufe *balanced*/*max*),
- URLs aus der Nachricht (Hybrid Analysis in Stufe *max*, urlscan.io sofern konfiguriert),
- Domains aus der Nachricht (URLhaus sofern konfiguriert),
- IP-Adressen aus Received-Headern (AbuseIPDB/VirusTotal, nur wenn konfiguriert).

Nachrichtentext, Betreffzeile, Absender- und Empfängeradressen sowie Ihre API-Schlüssel werden
**nie** übertragen. Es gibt keine Telemetrie, kein Analytics und keinen Server des Entwicklers; der
Entwickler hat keinen Zugriff auf Ihre Daten. Einstellungen, Zustimmungen und API-Schlüssel liegen
lokal in Thunderbird (`browser.storage.local`, unverschlüsselt); Scan-Ergebnisse liegen in einer
lokalen IndexedDB-Datenbank, die Sie jederzeit über „Cache leeren“ entleeren können. Vollständige
Angaben: [Datenschutzerklärung](https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html).

### Voraussetzungen

Für die externe Analyse ist ein kostenloser API-Schlüssel erforderlich (z. B. ein kostenloses Konto
bei hybrid-analysis.com). Ohne Schlüssel führt das Add-on weiterhin seine lokalen Prüfungen aus und
zeigt die Banner an.

## 5. Listing-Metadaten

| Feld | Wert |
|---|---|
| Title | Thundy AV – Email Scanner for Thunderbird |
| Short name | Thundy AV |
| Add-on ID | thundy-av@bludau-it-services.de |
| Version | 1.6 |
| Category (proposal) | "Privacy & Security"; if the store's picker does not offer it, "Miscellaneous" |
| License | MIT (`LICENSE` in the repository) |
| Support email | bludau.it.services@gmail.com |
| Homepage | https://vazules.github.io/Thunderbird-Antivirus/ |
| Privacy policy URL | https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html |
| Source code | https://github.com/VaZuLeS/Thunderbird-Antivirus |
| Compatibility | Thunderbird 140 ESR and newer (`strict_min_version: "140.0"`) |
| Language of the user interface | All visible UI strings (manifest, in-message UI, options page, popup) in English and German via `_locales/` and `browser.i18n` (default locale `en`, English translation complete, German fallbacks in the code; further languages can be added as additional `_locales/<code>` folders) |

### Permissions declared in the manifest

Required: `messagesRead`, `storage`, `notifications`, `scripting`, `downloads`, `menus` (`menus` creates the two
context-menu entries; `scripting` registers the bundled message display script `message_display.js` – no remote
code, no remote resources).

Optional host permissions – exactly these five origins, requested at runtime only when the matching provider is
used:

| Origin | Provider |
|---|---|
| `https://hybrid-analysis.com/*` | Hybrid Analysis |
| `https://www.virustotal.com/*` | VirusTotal |
| `https://urlscan.io/*` | urlscan.io |
| `https://urlhaus-api.abuse.ch/*` | URLhaus (abuse.ch) |
| `https://api.abuseipdb.com/*` | AbuseIPDB |

Data collection declaration: `required: ["none"]`, `optional: ["personalCommunications"]` – nothing is collected as
a requirement; message content may only be transmitted after an explicit opt-in. Where the environment offers the
built-in data-collection consent, the options dialog asks for that category when the global consent is enabled.

## 6. Release notes 1.6

- Ported the background/code paths to the Manifest V3 APIs (`scripting`,
  `optional_host_permissions`, message APIs) and removed code that relied on MV2-only entries.
- Introduced the consent model: global consent "Externe Analyse erlauben"
  (`externalAnalysisConsent`, default off), per-sender opt-in (`scanningEnabledSenders`) with two
  separate banner buttons ("Nur diese Nachricht scannen" / "Absender dauerhaft scannen") and the
  privacy tier (`privacyTier`, default `strict`).
- Moved provider host access to `optional_host_permissions`; host permissions are requested only
  when a provider key is saved in the options dialog. Corrected invalid host patterns and added the
  missing provider origins.
- Cleaned up the build: development and test artefacts (unit tests, lock files, docs, legacy
  `install.rdf`, sample scripts) are excluded from the XPI; the package list and size are checked.
- Renamed the add-on to "Thundy AV – Email Scanner for Thunderbird" (short name "Thundy AV"),
  removed the "Thunderbird" trademark from the product name and consolidated the icons.
- The in-message UI is now rendered by a message display script that is registered once
  (`message_display.js`), and time-of-click protection really blocks malicious or unverifiable links until the user
  explicitly opens them.
- Declared the `menus` permission so both context-menu entries exist, and declared the data collection permissions as
  `required: ["none"]` with the optional category `personalCommunications`.
- Localized the complete user interface: the options page and the popup are now resolved through `_locales/` and
  `browser.i18n` as well (English/German, default locale English, German fallback texts in the code).

## 7. Pre-upload checklist (honest status)

| Item | Status |
|---|---|
| Real screenshots (PNG, ≥ 1280 × 800, three motifs) | **open** — only SVG placeholders exist (`docs/store_assets.md`); the motifs may only be captured after the live test in Thunderbird |
| Icons in usable resolutions (16/32/48/64/128 px, shield motif) | done — reproducibly generated by `node scripts/generate-icons.js`, dimensions verified by the pre-submit checks |
| Manifest metadata (name, ID, version 1.6, `strict_min_version`, MIT) | done |
| Consent model documented | done (see note below) |
| Privacy policy publicly reachable | done — https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html |
| Privacy policy linked from the landing page | done (`docs/index.html`, `index_en.html`, `index_de.html`) |
| Reviewer notes complete (permissions, data flows, test path) | done (`docs/reviewer_notes.md`) |
| Manual verification in Thunderbird 140 ESR (banners, warning, badge, both context-menu entries, permission prompt from the banner, blocked link) | **open** — covered by unit tests with mocked APIs only; no live test has been performed |
| Unit tests green (`npm test`) | done in this environment — **437 tests, 0 failures**; the CI run for the final commit is authoritative |
| `npx web-ext lint` | 0 errors, 25 warnings — all known Thunderbird false positives (`scripts/filter-lint-warnings.js`) |
| XPI package contents | 18 files / 238,851 bytes unpacked, verified by `scripts/verify-package.js` |
| XPI built for 1.6 and attached to a release | **open** — the artefact has not been built and attached to a release yet |
| Signed for distribution | **open** — `npx web-ext sign --channel listed` has not been run |
| Submitted to the Thunderbird Add-ons Store | **open** — not submitted, no store URL |

Note: this table describes documentation and packaging status only. It does not claim that the
manual Thunderbird test has been performed or that the screenshots exist.
