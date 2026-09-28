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
- **Time-of-Click protection.** Links in the message can be checked at the moment you click them.
- **Manual controls.** Whitelist and blacklist for domains and senders, a *"always scan manually"*
  switch that blocks any automatic upload, an entry in the link context menu for a manual link
  scan, a popup with the message header data and a one-click *"Clear cache"* button for the local
  analysis database.

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
- **Time-of-Click-Schutz.** Links in der Nachricht können im Moment des Klickens geprüft werden.
- **Manuelle Kontrolle.** Whitelist und Blacklist für Domains und Absender, ein Schalter „Immer
  manuell scannen", der jeden automatischen Upload verhindert, ein Eintrag im Link-Kontextmenü für
  einen manuellen Link-Scan, ein Popup mit den Kopfzeilendaten der Nachricht und eine
  Schaltfläche „Cache leeren“ für die lokale Analysedatenbank.

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
| Language of the user interface | German (localisation not implemented yet) |

## 5.7 Release notes 1.12.0

- **Researcher panel (roles `research` / `audit`):** IOC extraction (URLs, hosts, registrable domains, IPs, addresses, SHA-256, Message-IDs, mail servers) with JSON/CSV export, the SPF/DKIM/DMARC chain, chronological `Received` hops including per-hop delays, URL anatomy (punycode, user@host, tracking parameters, sanitised URL) and attachment type analysis based on magic bytes (type mismatch, double extensions, macro-capable documents). Everything is computed locally.
- **Score breakdown per evaluation step** (authentication, URLhaus, IP reputation, Reply-To, behaviour, sender domain, links, custom rules) so every rating is traceable.
- **Clearer injection diagnostics:** the self test now distinguishes the recommended registration path from the per-message injection fallback (used by Thunderbird versions without `scripting.messageDisplay.registerScripts`), reports the fallback as working and shows the real cause for failures.

## 5.6 Release notes 1.11.0

- **German and English user interface**, chosen automatically from Thunderbird’s language; missing translations fall
  back to German so no label stays empty. Translation completeness is enforced by an automated check.
- **Brand design system:** consistent colours (shield blue, signal orange, ok/warning/error), brand header, cards,
  badges, graded risk scores, focus rings and a proper dark-mode variant - in the options page, the popup and the
  in-message banners.

## 5.5 Release notes 1.10.0

- **Local rules / IOC lists:** define rules for sender, domain, URL, subject, file name or SHA-256 (whitelist,
  blacklist or score). Rules run locally, can short-circuit the score and prevent uploads for files that are already
  known locally. Profiles can be exported/imported as JSON.
- **Optional SIEM/webhook export:** with explicit consent and an HTTPS endpoint, history events can be forwarded to
  your own SIEM or ticket system (payload contains audit metadata only, never file contents). Off by default.
- **History search:** full-text and date-range filters for the local audit trail.
- **Improved attachment disarming:** external media are blocked, the sanitised file carries an explanatory banner and
  the action is logged.

## 5.4 Release notes 1.9.0

- **Central management for organisations:** administrators can pin consent, privacy tier, view role, history settings
  and whitelists/blacklists through the browser policy mechanism (`storage.managed`). Managed values win over local
  settings and are never transmitted.
- **Self test:** one click in the options dialog verifies consent, API key, host permissions, the delayed-result
  polling, the message display script, the local result store and the history - without sending anything.
- **Statistics and reports:** the local history is aggregated for 1/7/30/90 days, and each message can be exported
  as a Markdown/JSON report listing the findings, attachments, verdicts and transmissions.

## 5.3 Release notes 1.8.0

- **View roles** (`Nur Warnungen`, `Privat`, `Geschäftlich`, `IT-Security-Forscher`, `Nachweis/Compliance`) control how
  much detail the banner and the popup show and how often the add-on interrupts - without changing any scanning
  behaviour.
- **Audit trail:** a local history (filterable, exportable as CSV/JSON, deletable, optional) records every check and
  every transmission with provider, data type, file, hash, job id, verdict and whether the result was real time or
  delayed.

## 5.2 Release notes 1.7.0

- **Status tracking for delayed analyses:** uploaded files are analysed asynchronously by the provider. Each job
  (hash, submission/job id, file, message, start time, attempt counter) is stored locally, polled automatically via
  `browser.alarms` (once per minute, max. 30 attempts / 90 minutes), written into the local cache and reported with
  a notification. Jobs survive a restart of the background script.
- **Clear real-time vs. delayed wording:** banner and popup state explicitly that local checks are finished in real
  time while the external analysis is still running at the provider; both show the job state (queued, running with
  attempt count and elapsed time, finished with the verdict, timeout with the reason).
- Manual "fetch result now" button for open jobs (new `alarms` permission).

## 6. Release notes 1.6.1

- **Fixed a misleading risk score:** three different weak signals each scored exactly 50 and the banner
  threshold was 50 as well, so almost every message (e.g. a newsletter with `spf=softfail` or an ordinary
  invoice containing one urgency word) reported "50 of 100". The weights are now staggered, no single weak
  signal crosses the threshold, and malicious IP addresses from the `Received` headers are taken into account.
- **Fixed the "first contact" detection:** it queried messages addressed *to* the sender instead of messages
  *from* the sender, and the known-sender list lived in memory only (Manifest V3 backgrounds are unloaded),
  so nearly every sender counted as first contact. It now queries `from`, persists known senders locally and
  stays neutral when the information cannot be determined.
- **Scan failures now name the cause** (`NO_API_KEY`, `PERMISSION_REQUIRED`, `EXTERNAL_ANALYSIS_DISABLED`,
  `SCAN_FAILED` with the failing stage) instead of a generic "scan failed".
- **New: manual attachment analysis in the popup.** Every attachment is listed with type and size; the hash
  can be computed locally and a single attachment can be uploaded for analysis, with the result rendered in
  the popup. The popup also explains the local risk score and every reason behind it.

## 5.1 Release notes 1.6

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

## 7. Pre-upload checklist (honest status)

| Item | Status |
|---|---|
| Real screenshots (PNG, ≥ 1280 × 800, three motifs) | **open** — only SVG placeholders exist (`docs/store_assets.md`) |
| Icons in usable resolutions (16/32/48/64/128 px, shield motif) | done — reproducibly generated by `node scripts/generate-icons.js`, dimensions verified by the pre-submit checks |
| Manifest metadata (name, ID, version 1.6, `strict_min_version`, MIT) | done |
| Consent model documented | done (see note below) |
| Privacy policy publicly reachable | done — https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html |
| Privacy policy linked from the landing page | done (`docs/index.html`, `index_en.html`, `index_de.html`) |
| Reviewer notes complete (permissions, data flows, test path) | done (`docs/reviewer_notes.md`) |
| Manual verification of the banner injection in Thunderbird 140 ESR | **open** |
| Unit tests green (`npm test`) | executed in CI; the result for the current commit is authoritative |
| XPI built for 1.6 and attached to a release | **open** — the 1.6 artefact has not been built yet |
| Submitted to the Thunderbird Add-ons Store | **open** — not submitted, no store URL |

Note: this table describes documentation and packaging status only. It does not claim that the
manual Thunderbird test has been performed or that the screenshots exist.
