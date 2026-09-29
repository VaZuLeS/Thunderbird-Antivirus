# Store-Listing — Thundy AV (final copy package)

**Add-on:** Thundy AV – Email Scanner for Thunderbird
**Short name:** Thundy AV
**Add-on ID:** thundy-av@bludau-it-services.de
**Version:** 1.6.0 (Manifest V3, `strict_min_version` 140.0)
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

**What it is not:** Thundy AV contains no virus signature engine of its own. It evaluates a message
locally (heuristics and scoring) and, only with your consent, asks the third-party services named
below — for example whether a file hash or a URL is already known to be malicious. Without an API key
of your own, the external analysis is inactive.

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
| Version | 1.6.0 |
| Category (proposal) | "Privacy & Security"; if the store's picker does not offer it, "Miscellaneous" |
| License | MIT (`LICENSE` in the repository) |
| Support email | bludau.it.services@gmail.com |
| Homepage | https://vazules.github.io/Thunderbird-Antivirus/ |
| Privacy policy URL | https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html |
| Source code | https://github.com/VaZuLeS/Thunderbird-Antivirus |
| Compatibility | Thunderbird 140 ESR and newer (`strict_min_version: "140.0"`) |
| Language of the user interface | German — the options page and the popup are German only (`<html lang="de">`; UI localisation is not implemented yet). The manifest strings (name, description, action title) and the banner texts are localised in English and German via `_locales/` (default locale `en`). |

## 6. Release notes 1.6.0 (EN)

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

Fixes of the independent store-readiness audit (2026-09-29, `docs/STORE_READINESS_AUDIT.md`), part of
the submitted 1.6.0:

- The popup no longer transmits anything without the global consent; it shows the consent notice
  instead, and the background script rejects such a request with `EXTERNAL_ANALYSIS_DISABLED`.
- The popup rendering and the two buttons of the message banner work again ("Scan this message only",
  "Scan this sender permanently").
- Links and domains from the message body are actually extracted and evaluated again.
- Time-of-Click protection checks a link **locally** before it is opened (verdict fetched on
  hover/focus, enforced on click): URL structure, displayed link text vs. target, own black/whitelist,
  known malicious domains — nothing is transmitted; a suspicious target is intercepted with a warning.
- The `menus` permission is declared again, so both context menu entries ("scan this link", "scan all
  links of this message") are created.
- Data classification: `required: ["none"]`, `optional: ["personalCommunications"]`; the optional data
  type is requested together with the host permission when the consent is enabled.
- Version `1.6.0` in `manifest.json` and `package.json`; packaging rules live in `web-ext-config.mjs`
  only (the ineffective `.webextignore` was removed).

## 7. Releasenotes 1.6.0 (DE)

- Portierung der Hintergrund-/Codepfade auf die Manifest-V3-APIs (`scripting`,
  `optional_host_permissions`, Nachrichten-APIs); MV2-only-Code wurde entfernt.
- Zustimmungsmodell: globale Zustimmung „Externe Analyse erlauben“ (`externalAnalysisConsent`,
  Standard **aus**), Opt-in je Absender (`scanningEnabledSenders`) mit zwei Buttons im Banner
  („Nur diese Nachricht scannen“ / „Absender dauerhaft scannen“) und Datenschutz-Stufe
  (`privacyTier`, Standard `strict`).
- Host-Berechtigungen der Anbieter liegen in `optional_host_permissions` und werden erst angefragt,
  wenn im Optionsdialog ein Schlüssel gespeichert wird.
- Paketbereinigung: Test- und Entwicklungsartefakte, Lockfiles, `docs/`, `install.rdf` und
  Beispielskripte bleiben aus der XPI heraus; Paketinhalt und -größe werden geprüft.
- Umbenennung in „Thundy AV – Email Scanner for Thunderbird“ (Kurzname „Thundy AV“), Entfernung des
  Markennamens „Thunderbird“ aus dem Produktnamen, konsolidierte Icons.
- Behoben (Befunde des Store-Readiness-Audits vom 2026-09-29): Popup überträgt ohne Zustimmung keine
  Daten mehr und zeigt stattdessen den Zustimmungshinweis; die Darstellung des Popups und die beiden
  Banner-Buttons funktionieren wieder; Links aus dem Nachrichtenkörper werden wieder extrahiert und
  bewertet; der Time-of-Click-Schutz prüft Links beim Klick **lokal** (ohne Übermittlung); die
  Berechtigung `menus` ist deklariert (beide Kontextmenüeinträge); Datenklassifizierung
  `required: ["none"]`, `optional: ["personalCommunications"]`; Version `1.6.0` einheitlich in
  `manifest.json` und `package.json`.

## 8. Pre-upload checklist (honest status)

| Item | Status |
|---|---|
| Real screenshots (PNG, ≥ 1280 × 800, three motifs) | **open** — only three SVG sketches exist (`docs/screenshots/*.svg`, see `docs/store_assets.md`) |
| Icons in usable resolutions (16/32/48/64/128 px, shield motif) | done for format and size — reproducibly generated by `node scripts/generate-icons.js`, every declared size verified as PNG with exactly that edge length by the pre-submit checks (`scripts/pre-submit-checks.js`). The **artwork** is a generated placeholder, not designed artwork; replacing it is recommended but not required by ATN. |
| Manifest metadata (name, ID, version 1.6.0, `strict_min_version`, MIT) | done |
| Consent model documented | done (sections 1, 3.2, 3.3 and 4) |
| Data classification (`data_collection_permissions`) | done — `required: ["none"]`, `optional: ["personalCommunications"]` (`manifest.json`), requested in the options dialog via `permissions.request({ data_collection: […] })` |
| Privacy policy publicly reachable | done — https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html |
| Privacy policy linked from the landing page | done (`docs/index.html`, `index_en.html`, `index_de.html`) |
| Reviewer notes complete (permissions incl. `menus`, data flows, test path, sample message) | done (`docs/reviewer_notes.md`, sections 2, 3.2, 4.1, 8.6) |
| Manual verification of the banner injection in Thunderbird 140 ESR | **open** |
| Unit tests green (`npm test`) | not re-run as part of this document — the CI result for the current commit is authoritative; `node --test scripts/pre-submit-checks.test.js` passes locally |
| XPI built for 1.6.0 and attached to a release | **open** — the artefact builds reproducibly (see section 9), but it is not signed and not attached to a release |
| Submitted to the Thunderbird Add-ons Store | **open** — not submitted, no store URL |

Note: this table describes documentation and packaging status only. It does not claim that the
manual Thunderbird test has been performed or that the screenshots exist.

## 9. Package facts (measured)

Measured on 2026-09-29 in this repository with

```bash
npx web-ext build --source-dir . --artifacts-dir /tmp/build-docs
node scripts/verify-package.js /tmp/build-docs
```

- Artifact: `thundy_av_email_scanner_for_thunderbird-1.6.0.zip`
- Content: **17 files**, **218.834 bytes** uncompressed, ZIP archive **59.551 bytes**
- The package contains runtime files only (`manifest.json`, `background.js`, `db.js`, `api.js`,
  `api_gateway.js`, `options.html`, `options.js`, `popup.html`, `theme.css`, `LICENSE`,
  `img/*.png`, `_locales/*/messages.json`); `scripts/verify-package.js` reports
  "Package content is valid."

The values are a snapshot: they change with every code change. Earlier measurements
(179.276 bytes uncompressed, 48.092 bytes ZIP) referred to commit `ae2a08e` of `main` and are
superseded.
