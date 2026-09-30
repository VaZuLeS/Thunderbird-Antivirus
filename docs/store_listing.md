# Store-Listing — Thundy AV (final copy package)

**Add-on:** Thundy AV – Email Scanner for Thunderbird
**Short name:** Thundy AV
**Add-on ID:** thundy-av@bludau-it-services.de
**Version:** 1.6.1 (Manifest V3, `strict_min_version` 140.0)
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
| Version | 1.6.1 |
| Category (proposal) | "Privacy & Security"; if the store's picker does not offer it, "Miscellaneous" |
| License | MIT (`LICENSE` in the repository) |
| Support email | bludau.it.services@gmail.com |
| Homepage | https://vazules.github.io/Thunderbird-Antivirus/ |
| Privacy policy URL | https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html |
| Source code | https://github.com/VaZuLeS/Thunderbird-Antivirus |
| Compatibility | Thunderbird 140 ESR and newer (`strict_min_version: "140.0"`) |
| Language of the user interface | Fully localized in English and German (`_locales/`): manifest strings, message-view banners, options page and popup. The UI follows the Thunderbird UI language; the German markup text is the fallback. |

## 6. Release notes 1.6.1

- **Data collection declaration corrected:** `browser_specific_settings.gecko.data_collection_permissions`
  now declares `personalCommunications` as **optional** (`"required": ["none"]`) instead of required, because
  every check runs locally. Enabling "Allow external analysis" additionally requests the optional data
  collection permission in Thunderbird; declining it keeps the consent off. Rationale and validator evidence:
  `docs/data_collection_decision.md`.
- **Failure visibility:** if the banner cannot be injected into the message view, the add-on no longer fails
  silently — it logs, stores diagnostics and shows a notification once per session; a denied host permission
  is explained in the banner with a link to the options.
- **Manifest V3 clean-up:** removed the MV2-only APIs (`getDisplayedMessage`, `onMessageDisplayed`) and the
  unreachable `scripting.messageDisplay.executeScript` branch; `web-ext lint` reports 18 instead of 26 warnings
  (0 errors).
- **Consistent timeouts:** every provider request now goes through the central `ApiGateway` (`fetchWithTimeout`),
  including the Hybrid Analysis upload and the popup report lookup.
- **Review package:** added `docs/live_test_protocol.md`, `docs/testdata.md` (+ `scripts/make-testdata.js`
  generating four reproducible test messages) and a response catalogue for expected review questions in
  `docs/reviewer_notes.md`.
- **Localisation:** the options page and the popup now use `browser.i18n` with the `_locales/en|de` catalogues
  (`data-i18n*` attributes plus a `t()` helper whose fallback is the German markup text). `test/i18n.test.js`
  verifies that every key used by the UI exists in both catalogues.

## 7. Pre-upload checklist (honest status)

| Item | Status |
|---|---|
| Real screenshots (PNG, ≥ 1280 × 800, three motifs) | **open** — only SVG placeholders exist (`docs/store_assets.md`) |
| Icons in usable resolutions (16/32/48/64/128 px, shield motif) | done — reproducibly generated by `node scripts/generate-icons.js`, dimensions verified by the pre-submit checks |
| Manifest metadata (name, ID, version 1.6.1, `strict_min_version`, MIT) | done |
| Consent model documented | done (see note below) |
| Data collection declaration matches the behaviour | done — `required: ["none"]`, `optional: ["personalCommunications"]`, runtime opt-in (`docs/data_collection_decision.md`) |
| Privacy policy publicly reachable | done — https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html |
| Privacy policy linked from the landing page | done (`docs/index.html`, `index_en.html`, `index_de.html`) |
| Reviewer notes complete (permissions, data flows, test path, response catalogue) | done (`docs/reviewer_notes.md`) |
| Test data for reviewers | done — `scripts/make-testdata.js` → `testdata/`, described in `docs/testdata.md` |
| Manual verification of the banner injection in Thunderbird 140 ESR | **open** — protocol and test data are ready (`docs/live_test_protocol.md`) |
| Unit tests green (`npm test`) | done — 395 tests, 0 failures (verified on 1.6.1) |
| XPI built for 1.6.1 and attached to a release | **partly** — local build `thundy_av_email_scanner_for_thunderbird-1.6.1.zip` exists; signing/tagging requires the ATN API keys |
| Submitted to the Thunderbird Add-ons Store | **open** — not submitted, no store URL |

Note: this table describes documentation and packaging status only. It does not claim that the
manual Thunderbird test has been performed or that the screenshots exist.
