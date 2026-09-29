# Reviewer Notes — Thundy AV (Thunderbird Add-on)

**Add-on name:** Thundy AV – Email Scanner for Thunderbird (short name: "Thundy AV")
**Add-on ID:** thundy-av@bludau-it-services.de
**Version:** 1.6.0
**Manifest:** MV3 (`manifest_version: 3`), `strict_min_version: 140.0`
**License:** MIT
**Repository:** https://github.com/VaZuLeS/Thunderbird-Antivirus
**Privacy policy (hosted):** https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
**Support / maintainer contact:** Jan Bludau (VaZuLeS), bludau.it.services@gmail.com

This document explains to reviewers what the add-on does, why each permission is needed, exactly
which data leaves the machine (and when it does not), and how to test the add-on. It describes the
submission state after the independent store-readiness audit
([docs/STORE_READINESS_AUDIT.md](STORE_READINESS_AUDIT.md), 2026-09-29); points that are still open
are marked as such in section 9.

## 1. Purpose

The add-on checks a message opened in Thunderbird for security risks: attachments (malware),
links (phishing, look-alike/login pages), suspicious domains and sender/message anomalies. Local
scoring and heuristics run entirely inside Thunderbird. To answer questions that cannot be answered
locally (e.g. "is this file/hash known to be malicious?", "is this URL a known phishing target?"),
the add-on can optionally query third-party analysis services. Those queries are opt-in and
disabled by default.

The message display action (the add-on's button in the message header area) opens a popup with the
header data of the displayed message and the results stored for it. The popup performs no provider
request while the global consent is off — it shows the consent notice instead; the background script
additionally rejects such a request with `EXTERNAL_ANALYSIS_DISABLED` and the popup does not retry.

## 2. Permissions and why they are needed

### 2.1 Required permissions

| Permission | Why it is required |
|---|---|
| `messagesRead` | The core function is to inspect the message the user has opened: headers (sender, recipients, subject, date, Received), the text and HTML body, links, and the list of attachments including their content (which is hashed locally). Without this permission the add-on cannot perform any check. |
| `menus` | Adds the two context menu entries that start a link scan: **"Scan this link with Thundy AV"** in the `link` context (right-click on a link) and **"Scan all links of this message"** in the `message_display_action` context (the add-on's button in the message header area). Thunderbird documents `menus.create()`/`menus.onClicked` as "Required permissions: menus", and both contexts used here (`link`, `message_display_action`) are valid since Thunderbird 89. Without the permission the code would silently skip the menu creation and the entries would never appear. |
| `storage` | Stores the user's settings (privacy tier, whitelist/blacklist, scan options), the consent flags (`externalAnalysisConsent`, `scanningEnabledSenders`) and the API keys the user enters, in `browser.storage.local`. No remote storage. |
| `scripting` | Injects the UI banners into the message view: the per-message opt-in banner with its two buttons, the threat/warning banner, and the Time-of-Click marker on links. All injected code is bundled with the add-on (`scripting.executeScript({ func })` / `files`); no remote code is fetched or evaluated. |
| `notifications` | Shows short system notifications for actions that are not visible in the message pane, e.g. "scan started", "scan submitted (job ID …)" and error messages for the context-menu link scan. This gives feedback when the scan is triggered from an entry point without its own result area. |
| `downloads` | Used for the "disarm HTML attachment" action: when the user asks for it, the add-on saves a sanitized copy of an HTML attachment through `browser.downloads.download()`. The user triggers this explicitly; nothing is downloaded automatically in the background. |

### 2.2 Optional host permissions

Host access is **not** requested at install time. The add-on declares optional host permissions
(`optional_host_permissions`) for the analysis provider domains. A host permission is requested only
when the user saves an API key for that specific provider in the options dialog, and the request is
made in direct response to that user action.

| Provider | Requested origin(s) | Requested when |
|---|---|---|
| Hybrid Analysis | `https://hybrid-analysis.com/*`, `https://*.hybrid-analysis.com/*` | the user saves a Hybrid Analysis API key |
| VirusTotal | `https://virustotal.com/*`, `https://*.virustotal.com/*` | the user saves a VirusTotal API key |
| urlscan.io | `https://urlscan.io/*`, `https://*.urlscan.io/*` | the user saves an urlscan.io API key |
| URLhaus (abuse.ch) | `https://urlhaus-api.abuse.ch/*` | the user saves a URLhaus Auth-Key |
| AbuseIPDB | `https://api.abuseipdb.com/*` | the user configures IP reputation with AbuseIPDB |

There is no `<all_urls>`, no `webRequest`, no `tabs` and no `cookies` permission.

## 3. Consent model

### 3.1 Two-stage consent plus a privacy tier

1. **Global consent "Allow external analysis"** — a checkbox in the options dialog, stored under the
   key `externalAnalysisConsent`. **Default: off.** While it is off, the add-on transmits **nothing**
   to third parties: no attachment or file upload, no hash lookup, no URL/domain lookup, no IP
   lookup. Local checks and banners keep working.
2. **Per-sender opt-in** — for automatic scans of messages from a sender, that sender must be added
   to `scanningEnabledSenders`. The banner in the message view offers two separate buttons:
   - "Scan this message only" → one-off scan, the sender is not stored permanently;
   - "Scan this sender permanently" → the sender is added to the persistent list and future messages
     from that sender are scanned automatically (while the global consent is enabled).
3. **Privacy tier (`privacyTier`)** — selectable in the options dialog, **default `strict`**:
   - `strict`: only SHA-256 hashes of attachments are transmitted;
   - `balanced`: additionally full attachments of *unknown* files are uploaded to Hybrid Analysis;
   - `max`: additionally URLs from the message are submitted to Hybrid Analysis.

### 3.2 Data collection declaration (`data_collection_permissions`)

`manifest.json` declares the data collection as follows:

```json
"browser_specific_settings": {
  "gecko": {
    "data_collection_permissions": {
      "required": ["none"],
      "optional": ["personalCommunications"]
    }
  }
}
```

- `required: ["none"]` states what the code does by default: the add-on collects and transmits
  nothing. No data leaves the computer until the user has explicitly enabled the global consent
  (section 3.1) **and** triggered a scan.
- The transmission of message content (SHA-256 hashes, complete attachments, URLs, domains, IP
  addresses) is declared as an **optional** data type, `personalCommunications`, because it can be
  switched on and off by the user at any time.
- The optional data type is requested in the same user action that enables the consent checkbox in
  the options dialog ("Allow external analysis" → *Save*), together with the host permission of the
  provider whose key was entered:

  ```js
  await browser.permissions.request({ data_collection: ['personalCommunications'] });
  ```

  Switching the consent off calls
  `permissions.remove({ data_collection: ['personalCommunications'] })`. Thunderbird supports
  `data_collection` in `permissions.request()` (schema `permissions.json`, MV3); versions that do not
  know the field are detected via `permissions.getAll()` and skip this step without failing.

### 3.3 Why the add-on implements its own consent dialog

Unlike Firefox, Thunderbird does not use the browser's built-in onboarding flow for data-collection
consent; the Thunderbird add-on documentation states that add-ons must request such consent
explicitly themselves. For that reason the consent described above is implemented in the add-on's
own options dialog (checkbox "Allow external analysis") together with the per-sender opt-in in the
message-view banner. No data is transmitted before the user has enabled both the global consent and
triggered a scan.

## 4. Data flows per provider and tier

All transmissions below require the global consent (section 3.1). A scan also has to be triggered,
either automatically (sender opted in) or manually ("Scan this message only" / context action).

| Data | Trigger / tier | Provider | Purpose |
|---|---|---|---|
| SHA-256 hash of an attachment | attachment scan, all tiers (`strict`, `balanced`, `max`); only if a VirusTotal key is configured | VirusTotal (`virustotal.com`) | check whether the file is already known |
| SHA-256 hash of an attachment | attachment scan, all tiers | Hybrid Analysis (`hybrid-analysis.com`) | check whether the file is already analysed (hash overview) |
| Complete attachment (file content, file name, MIME type, size) | tier `balanced` and `max`, only when the hash lookup returned no match | Hybrid Analysis (`hybrid-analysis.com`, `api.hybrid-analysis.com`) | static and dynamic analysis in the Falcon Sandbox |
| URLs from the message | tier `max` | Hybrid Analysis (`hybrid-analysis.com/api/v2/quick-scan/url`) | URL analysis |
| URLs of the message, only for the **automatic** link scan | only when "automatic link scan" is enabled **and** an urlscan.io key is configured | urlscan.io (`urlscan.io`) | link/phishing analysis (screenshot-based); a maximum of 5 URLs per message |
| Domains extracted from the message body | whenever a URLhaus key is configured | URLhaus (`urlhaus-api.abuse.ch`) | check the domain against malware URL lists |
| IP addresses found in the `Received` headers | only when a provider + key for IP reputation are configured | AbuseIPDB (`api.abuseipdb.com`) or VirusTotal (`virustotal.com`) | IP reputation |

Inherent to HTTP, each request also reveals the requesting IP address and a user-agent string to the
respective provider.

### 4.1 Link checks: local (on click) vs. external (on request)

- **Time-of-Click check — purely local, no transmission.** Links in the message view are marked, and
  when the user points at (hover/focus) or clicks one the add-on evaluates the target inside
  Thunderbird only: URL structure
  (scheme, embedded credentials, raw IP addresses, punycode), the displayed link text compared with
  the actual target, the user's own blacklist and the domains that earlier scans reported as
  malicious. A suspicious target is intercepted with a warning that names the reasons and lets the
  user decide ("Open anyway" / "Cancel"). **Nothing is transmitted for this check** — it also works
  without consent, without API keys and offline.
- **External link scan — only on request.** The two context menu entries ("Scan this link with
  Thundy AV", "Scan all links of this message") submit the link(s) the user selected to Hybrid
  Analysis (`quick-scan/url`; up to 20 links for "all links of this message"). This requires the
  global consent and the host permission for `hybrid-analysis.com`. Independent of the context menu,
  the *automatic* link scan submits up to 5 URLs of a message to urlscan.io — only when "automatic
  link scan" is enabled, an urlscan.io key is configured and the host permission has been granted.

What is **not** transmitted, regardless of tier:

- the full message body and the subject line,
- sender and recipient addresses,
- attachment contents of plain-text types (`text/plain`, `text/html`, `text/css`, `text/csv`,
  `text/javascript`, `application/json`, `application/xml`, `application/xhtml+xml`),
- settings, consent flags, whitelist/blacklist entries and API keys,
- any data at all while the global consent is off.

## 5. Local storage and deletion

| Location | Content | Notes |
|---|---|---|
| `browser.storage.local` | settings, consent flags (`externalAnalysisConsent`, `scanningEnabledSenders`), API keys | stored unencrypted (plain local storage of Thunderbird); no remote copy |
| IndexedDB `thunderbird_av`, version 3, object store `hybridanalysis` | scan results per message (verdict, status, analysis IDs, timestamps), link metadata, mapping via Message-ID/header ID | no attachment contents |

Deletion during review: the **"Clear cache"** button in the options dialog empties the object store
`hybridanalysis`. Removing the add-on removes all local extension data. The add-on operates no
server, so there is no server-side copy of anything.

## 6. No telemetry

The add-on contains no telemetry, no analytics or crash reporting, and no developer-operated
backend. The only outbound traffic is the provider requests listed in section 4, and only after
consent. The source code contains no `eval`, no remote script loading and no obfuscation; the
manifest sets `content_security_policy.extension_pages` to `script-src 'self'; object-src 'none'`.

## 7. Network destinations (complete list)

```
https://hybrid-analysis.com/api/v2/overview/<sha256|id>
https://hybrid-analysis.com/api/v2/quick-scan/file          (POST, multipart)
https://hybrid-analysis.com/api/v2/quick-scan/url           (POST)
https://www.virustotal.com/api/v3/files/<sha256>
https://www.virustotal.com/api/v3/ip_addresses/<ip>
https://urlscan.io/api/v1/scan/                             (POST)
https://urlscan.io/api/v1/result/<uuid>/
https://urlhaus-api.abuse.ch/v1/host/                       (POST)
https://api.abuseipdb.com/api/v2/check?ipAddress=<ip>
```

No other hosts are contacted. All requests are HTTPS.

## 8. Step-by-step test instructions

### 8.1 Load the add-on

1. Get the source and build the package:

   ```bash
   npm ci
   npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
   ```

2. In Thunderbird (140 ESR or newer): menu ☰ → **Add-ons and Themes** → gear icon →
   **Debug Add-ons** (`about:debugging#/runtime/this-firefox`) → **Load Temporary Add-on…** and
   select `manifest.json` from the repository (or the ZIP from `./build`).
3. Alternative: `npx web-ext run --firefox=/path/to/thunderbird` (web-ext has no `--target
   thunderbird`; `--firefox` takes the Thunderbird binary path).

### 8.2 Obtain a free API key

4. Register for free at https://www.hybrid-analysis.com/signup, log in, open the profile menu
   ("Nickname" → "Profile") and copy the API key from the API settings. Optional additional keys
   (VirusTotal, urlscan.io, URLhaus, AbuseIPDB) can be added the same way; they are not required for
   the basic test.

### 8.3 Configure consent and permissions

5. Open the add-on options (Add-ons Manager → the add-on → "Preferences"/"Options").
6. Paste the Hybrid Analysis API key into the "API key" field.
7. Enable the checkbox **"Allow external analysis"** (global consent; default is off).
8. Select the privacy tier: keep `strict` for the first run (only hashes are sent), then switch to
   `balanced` or `max` for a second run if you want to verify uploads.
9. Click **Save**. Because a key is now stored, Thunderbird asks for the optional host permission
   for `hybrid-analysis.com` — grant it. Without this grant no request is made and the add-on
   reports that the permission is missing. Thunderbird also asks for the optional data type
   `personalCommunications` (section 3.2) in the same user action; on versions that do not know that
   field the step is skipped silently.
10. Optional negative test: leave the consent checkbox off, save, open a message with an attachment
    and confirm that **no** network request to a provider occurs (Thunderbird Developer Tools →
    Network, or a local proxy).

### 8.4 Test the banners in the message view

11. Open a message that contains an attachment and (for tier `max`) an HTTP link. Use test data
    only; do not use real customer mail.
12. If the sender has no opt-in yet, the per-message banner appears above the message with two
    buttons: **"Scan this message only"** and **"Scan this sender permanently"**.
13. Click **"Scan this message only"**: a one-off scan starts, the action is confirmed in the banner
    and the result/warning banner appears according to the verdict. Re-open a different message from
    the same sender — the opt-in banner should appear again, because the sender was not persisted.
14. Click **"Scan this sender permanently"**: the sender is added to the persistent opt-in list, so
    messages from this sender are scanned automatically from then on and the opt-in banner no longer
    appears for that sender. The stored list can be inspected in `about:debugging` → the extension →
    storage (`scanningEnabledSenders`). To compare the behaviour of a one-off scan, repeat step 13
    with a sender that has no persistent opt-in.
15. Expected network traffic for tier `strict`: `GET https://hybrid-analysis.com/api/v2/overview/<sha256>`
    (hash lookup) and only if a VirusTotal key is configured `GET https://www.virustotal.com/api/v3/files/<sha256>`.
    For tier `balanced`/`max`, additionally `POST https://hybrid-analysis.com/api/v2/quick-scan/file`
    when the hash is unknown; for tier `max` additionally
    `POST https://hybrid-analysis.com/api/v2/quick-scan/url`.
16. Withdrawal test: disable "Allow external analysis" and save. Re-opening messages must not produce
    any provider request anymore.

### 8.5 Clear local data

17. In the options dialog, click **"Clear cache"** and confirm. The IndexedDB object store
    `hybridanalysis` (database `thunderbird_av`, version 3) is emptied; the confirmation
    "Cache erfolgreich geleert." is shown. The stored consent and settings are not affected.

### 8.6 Reviewer quick test with the sample message („Reviewer-Schnelltest mit Beispieldaten“)

18. Import the sample message `test/fixtures/reviewer-sample.eml`: in Thunderbird right-click a local
    folder → **"Import Message(s)…"** (in newer versions **☰ → Tools → Import → "Import mail from a
    file"**), or drag and drop the file onto the folder. The file is a harmless RFC 822/MIME message
    with a `text/plain` + `text/html` alternative part and a small PDF attachment (600 bytes, Base64
    body); all addresses and links use the reserved documentation domains `example.com` and
    `example.org`, so no real personal data is imported.
19. What the sample lets you check **without an API key and without consent** (all of it local):
    - the local link extraction: the two links of the HTML body are found and evaluated,
    - the Time-of-Click marker on both links and the local check when one is clicked (section 4.1),
    - the mismatch reason: the second link displays `https://www.example.com/konto-hilfe` but points to
      `https://login.example.org/verify?account=reviewer`, so the warning names "Displayed link text
      differs from the target" and offers *Open anyway* / *Cancel*; the first link matches its own
      text and must **not** produce that reason,
    - the attachment list, which shows `thundy-av-testdokument.pdf`,
    - the negative check: with the consent switched off, no request may appear in Thunderbird's
      developer tools (Network tab) while the message is opened or a link is clicked.
20. With consent and an API key (section 8.2) the same message additionally exercises the external
    hash lookup of the attachment (Hybrid Analysis and, if configured, VirusTotal) and — in tier
    `max` — the URL upload.

## 9. Known open items

These points are deliberately documented as not yet complete and are **not** claims of finished work:

- Manual verification of the banner injection in Thunderbird 140 ESR is still outstanding. Until it
  is done, the in-message banners (opt-in banner, threat banner, Time-of-Click marker) are the parts
  of the add-on that are least verified in a real Thunderbird installation.
- There are **no real screenshots** yet; the repository only contains three SVG placeholders in
  `docs/screenshots/` (`inline_optin_banner.svg`, `options_page.svg`, `warning_banner.svg`), which are
  sketches and not UI captures. See `docs/store_assets.md` and `docs/store_listing.md`.
- The add-on has **not** been submitted to the Thunderbird Add-ons Store; there is no store URL and no
  store download button, and the XPI for the submission has not been signed yet.
- No dedicated reviewer test key is included: the API key required for a full end-to-end run is the
  reviewer's own free provider account (step 8.2). Without a key, the local checks still work, but no
  external analysis can be triggered. A harmless sample message *is* included
  (`test/fixtures/reviewer-sample.eml`, section 8.6).
- The public releases and tags up to `v1.18.0` in the repository come from the development branch
  `cline/nhfqgaap` and are neither store releases nor store-signed; the store submission uses version
  `1.6.0` from `main`. See `docs/STATUS.md`, section "Release-/Versionslage".

## 10. Documents and contact

- Privacy policy: `docs/privacy_policy.md`, hosted at
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Store listing texts: `docs/store_listing.md`
- Change history and fixed findings: `CHANGELOG.md`, `docs/STORE_READINESS_AUDIT.md`
- Sample message for reviewers: `test/fixtures/reviewer-sample.eml` (section 8.6)
- Asset status: `docs/store_assets.md`, capture guide: `docs/screenshot_capture.md`
- Maintainer and support: Jan Bludau (VaZuLeS), bludau.it.services@gmail.com
- Repository and issue tracker: https://github.com/VaZuLeS/Thunderbird-Antivirus
