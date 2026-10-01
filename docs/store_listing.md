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
  *strict* — only SHA-256 hashes of attachments, and the manual upload / manual URL scan in the popup
  are disabled; *balanced* — additionally the complete file of unknown attachments (automatic scan and
  manual upload); *max* — additionally URLs found in the message (automatic scan and manual URL scan).
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

- SHA-256 hashes of attachments (Hybrid Analysis, VirusTotal — all tiers),
- the complete attachment of unknown files (Hybrid Analysis, tier *balanced*/*max* only; via the
  automatic scan or the manual upload in the popup),
- URLs from the message (Hybrid Analysis in tier *max* — automatic scan or manual URL scan; urlscan.io
  when configured, in all tiers),
- domains from the message (URLhaus when configured),
- IP addresses from Received headers (AbuseIPDB/VirusTotal, only when configured).

In the *strict* tier the manual attachment upload and the manual URL scan in the popup are disabled and
show a notice telling you to switch to *balanced*/*max*. Transmitted links can contain personal
identifiers (e.g. newsletter tracking IDs, campaign or recipient parameters in the URL); they are
transmitted only with consent and a triggered scan.

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
  SHA-256-Hashes von Anhängen, manueller Upload und manueller URL-Scan im Popup sind deaktiviert;
  *balanced* — zusätzlich die vollständige Datei unbekannter Anhänge (automatischer Scan und manueller
  Upload); *max* — zusätzlich URLs aus der Nachricht (automatischer Scan und manueller URL-Scan).
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

- SHA-256-Hashes von Anhängen (Hybrid Analysis, VirusTotal — alle Stufen),
- der vollständige Anhang unbekannter Dateien (Hybrid Analysis, nur Stufe *balanced*/*max*; über den
  automatischen Scan oder den manuellen Upload im Popup),
- URLs aus der Nachricht (Hybrid Analysis in Stufe *max* — automatischer Scan oder manueller URL-Scan;
  urlscan.io sofern konfiguriert, in allen Stufen),
- Domains aus der Nachricht (URLhaus sofern konfiguriert),
- IP-Adressen aus Received-Headern (AbuseIPDB/VirusTotal, nur wenn konfiguriert).

In Stufe *strict* sind der manuelle Anhang-Upload und der manuelle URL-Scan im Popup deaktiviert und
zeigen einen Hinweis, auf *balanced*/*max* umzustellen. Übermittelte Links können personenbezogene
Kennungen enthalten (z. B. Newsletter-Tracking-IDs, Kampagnen- oder Empfänger-Parameter in der URL);
sie werden nur mit Zustimmung und ausgelöstem Scan übermittelt.

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
| Category | **Privacy and Security** (ATN category slug `privacy-and-security`; source: https://addons.thunderbird.net/api/v4/addons/categories/) |
| License | MIT (`LICENSE` in the repository) |
| Support email | bludau.it.services@gmail.com |
| Homepage | https://vazules.github.io/Thunderbird-Antivirus/ |
| Privacy policy URL | https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html |
| Source code | https://github.com/VaZuLeS/Thunderbird-Antivirus |
| Compatibility | Thunderbird 140 ESR and newer (`strict_min_version: "140.0"`) |
| Language of the user interface | Options page and popup: German. Manifest strings and banners: localized (English, German – `_locales/`), `default_locale: en`. |

## 6. Release notes

### 1.6.2 – 2026-10-01 (store-readiness release)

Release notes for the ATN version dialog (Markdown as accepted there):

- **Security/privacy fix:** the message popup no longer queries Hybrid Analysis when
  "Allow external analysis" is switched off; it shows the locally stored result instead.
- **Privacy tier now covers the manual actions:** uploading an attachment requires at least the
  *balanced* tier, submitting a URL requires the *maximum* tier. In *strict* both actions are disabled and
  explained in the UI.
- **Context menus work:** the missing `menus` permission was added, so "Scan link with Thundy AV" and
  "Scan all links of this message" actually appear.
- **Clear error handling:** a missing host permission now produces an explanatory message with a shortcut to
  the options instead of an opaque network error.
- **Data declaration:** the add-on now declares the data transmission as opt-in
  (`required: ["none"]`, `optional: ["personalCommunications"]`) and asks for it via the permissions API.
- **Fixes under the hood:** broken popup report rendering, silently missing banners, IP reputation results
  cached without consent, developer files shipped inside the package.

### 1.6 – 2026-09-28

- Ported the background/code paths to the Manifest V3 APIs (`scripting`,
  `optional_host_permissions`, message APIs) and removed code that relied on MV2-only entries.
- Introduced the consent model: global consent "Externe Analyse erlauben"
  (`externalAnalysisConsent`, default off), per-sender opt-in (`scanningEnabledSenders`) with two
  separate banner buttons ("Nur diese Nachricht scannen" / "Absender dauerhaft scannen") and the
  privacy tier (`privacyTier`, default `strict`).
- **Store-readiness fixes:**
  - Data-collection declaration corrected to `data_collection_permissions: { "required": ["none"],
    "optional": ["personalCommunications"] }`; the optional `sensitiveDataUpload` permission
    (`optional_permissions`) is requested together with the options-page consent and removed again when
    the consent is switched off.
  - The privacy tier now gates **every** transmission path: manual attachment upload only from
    `balanced`, manual URL scan only from `max`; both are disabled in `strict` and show a hint to switch
    the tier in the options.
  - Added the `menus` permission so the context-menu entries (scan a link, scan all links of a message)
    actually work.
  - Fixed the popup so it transmits only with the global consent active (a code path could previously
    bypass the consent check).
  - Provider paths now return a clear error ("Host-Berechtigung fehlt") when the host permission has not
    been granted, instead of a cryptic failure.
  - Packaging/CI hardening: developer scripts moved to `tools/`, `pnpm-lock.yaml` removed (npm is the
    only package manager) and the test run executes only real test files.
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
| Real screenshots (PNG; recommended 1280 × 800 / 1.6:1 — a recommendation, not a store requirement) | **open** — only SVG placeholders exist (`docs/store_assets.md`) |
| Icons in usable resolutions (16/32/48/64/128 px, shield motif) | done — reproducibly generated by `node scripts/generate-icons.js`, dimensions verified by the pre-submit checks |
| Manifest metadata (name, ID, version 1.6.2, `strict_min_version`, MIT, `menus`) | done |
| Data-collection declaration (`required: ["none"]`, optional `personalCommunications`; `optional_permissions: ["sensitiveDataUpload"]`) | done (`manifest.json`) |
| Consent model documented | done (see note below) |
| Privacy policy publicly reachable | done — https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html |
| Privacy policy linked from the landing page | done (`docs/index.html`, `index_en.html`, `index_de.html`) |
| Reviewer notes complete (permissions, data flows, test path) | done (`docs/reviewer_notes.md`) |
| Reviewer test data (`testdata/`, sample `.eml` files) | done — see `docs/reviewer_notes.md` |
| Unit tests (`npm test`) | complete suite as defined in `package.json`; run it for the current commit |
| Pre-submit checks / lint / package verification | done — `npm run check` (pre-submit checks + tests + lint filter + build + package verification) |
| Submission gate | available — `npm run store-gate` (submission gate added by the maintainer) |
| Manual verification of the banner injection in Thunderbird 140 ESR | **open** |
| Signed XPI / submission to the Thunderbird Add-ons Store | **open** — not submitted, no signed release artifact, no store URL |

Note: this table describes documentation, packaging and verification status only. It does not claim that
the manual Thunderbird test has been performed or that the screenshots exist.
