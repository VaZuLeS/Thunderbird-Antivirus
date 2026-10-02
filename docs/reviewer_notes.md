# Reviewer Notes — Thundy AV (Thunderbird Add-on)

**Add-on name:** Thundy AV – Email Scanner for Thunderbird (short name: "Thundy AV")
**Add-on ID:** thundy-av@bludau-it-services.de
**Version:** 1.6.3
**Manifest:** MV3 (`manifest_version: 3`), `strict_min_version: 140.0`
**License:** MIT
**Repository:** https://github.com/VaZuLeS/Thunderbird-Antivirus
**Privacy policy (hosted):** https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
**Support / maintainer contact:** Jan Bludau (VaZuLeS), bludau.it.services@gmail.com

This document explains to reviewers what the add-on does, why each permission is needed, exactly
which data leaves the machine (and when it does not), and how to test the add-on.

## 1. Purpose

The add-on checks a message opened in Thunderbird for security risks: attachments (malware),
links (phishing, look-alike/login pages), suspicious domains and sender/message anomalies. Local
scoring and heuristics run entirely inside Thunderbird. To answer questions that cannot be answered
locally (e.g. "is this file/hash known to be malicious?", "is this URL a known phishing target?"),
the add-on can optionally query third-party analysis services. Those queries are opt-in and
disabled by default.

## 2. Permissions and why they are needed

### 2.1 Required permissions

| Permission | Why it is required |
|---|---|
| `messagesRead` | The core function is to inspect the message the user has opened: headers (sender, recipients, subject, date, Received), the text and HTML body, links, and the list of attachments including their content (which is hashed locally). Without this permission the add-on cannot perform any check. |
| `storage` | Stores the user's settings (privacy tier, whitelist/blacklist, scan options), the consent flags (`externalAnalysisConsent`, `scanningEnabledSenders`) and the API keys the user enters, in `browser.storage.local`. No remote storage. |
| `scripting` | Injects the UI banners into the message view: the per-message opt-in banner with its two buttons, the threat/warning banner, and the Time-of-Click marker on links. All injected code is bundled with the add-on (`scripting.executeScript({ func })` / `files`); no remote code is fetched or evaluated. |
| `notifications` | Shows short system notifications for actions that are not visible in the message pane, e.g. "scan started", "scan submitted (job ID …)" and error messages for the context-menu link scan. This gives feedback when the scan is triggered from an entry point without its own result area. |
| `downloads` | Used for the "disarm HTML attachment" action: when the user asks for it, the add-on saves a sanitized copy of an HTML attachment through `browser.downloads.download()`. The user triggers this explicitly; nothing is downloaded automatically in the background. |
| `menus` | Adds the two context-menu entries ("Scan link with Thundy AV" on a link, "Scan all links of this message" in the message display action context). Both entries only trigger the same consent-gated scan paths as the other entry points; the permission is required for `browser.menus.create()` / `onClicked`. |

### 2.2 Optional host permissions

Host access is **not** requested at install time. The add-on declares optional host permissions
(`optional_host_permissions`) for the analysis provider domains. A host permission is requested only
when the user saves an API key for that specific provider in the options dialog, and the request is
made in direct response to that user action.

| Provider | Requested origin(s) | Requested when |
|---|---|---|
| Hybrid Analysis | `https://hybrid-analysis.com/*` | the user saves a Hybrid Analysis API key |
| VirusTotal | `https://www.virustotal.com/*` | the user saves a VirusTotal API key, or selects VirusTotal for IP reputation |
| urlscan.io | `https://urlscan.io/*` | the user saves an urlscan.io API key |
| URLhaus (abuse.ch) | `https://urlhaus-api.abuse.ch/*` | the user saves a URLhaus Auth-Key |
| AbuseIPDB | `https://api.abuseipdb.com/*` | the user configures IP reputation with AbuseIPDB |

These are exactly the origins requested at runtime (`options.js`, in response to the **Save** button).
The manifest's `optional_host_permissions` additionally declares the sub-domain wildcards
`https://*.hybrid-analysis.com/*`, `https://*.virustotal.com/*` and `https://*.urlscan.io/*`, but the
runtime request uses the concrete origin listed above.

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
3. **Privacy tier (`privacyTier`)** — selectable in the options dialog, **default `strict`**. The tier
   limits **every** transmission path, not only the automatic scan:
   - `strict`: only SHA-256 hashes of attachments are transmitted; the manual attachment upload and the
     manual URL scan in the popup are disabled and show a notice to switch to `balanced`/`max` in the
     options;
   - `balanced`: additionally full attachments of *unknown* files are uploaded to Hybrid Analysis
     (automatic scan and manual upload);
   - `max`: additionally URLs from the message are submitted to Hybrid Analysis (automatic scan and
     manual URL scan).

   Hash lookups (SHA-256), URLhaus/urlscan.io checks and IP reputation lookups remain possible in all
   tiers as long as a key is configured and the global consent is enabled.

### 3.2 Why the add-on implements its own consent dialog

Unlike Firefox, Thunderbird does not use the browser's built-in onboarding flow for data-collection
consent; the Thunderbird add-on documentation states that add-ons must request such consent
explicitly themselves. For that reason the consent described above is implemented in the add-on's
own options dialog (checkbox "Allow external analysis") together with the per-sender opt-in in the
message-view banner. No data is transmitted before the user has enabled both the global consent and
triggered a scan.

### 3.3 Data-collection declaration and `sensitiveDataUpload`

`manifest.json` declares the data-collection permission as:

```json
"data_collection_permissions": { "required": ["none"], "optional": ["personalCommunications"] }
```

`required: "none"` means that the add-on collects and transmits none of the declared categories unless
the user grants the optional consent. `personalCommunications` is **optional** and only becomes
relevant once the user enables external analysis.

The consent itself is still the options-page checkbox "Allow external analysis" (default off). In the
same user gesture the add-on additionally requests Thunderbird's optional permission
`sensitiveDataUpload`, declared in the manifest as `optional_permissions: ["sensitiveDataUpload"]`
(Thunderbird labels it "transfer sensitive user data to a remote server"), via
`browser.permissions.request({ data_collection: ['personalCommunications'], permissions: ['sensitiveDataUpload'] })`.
When the consent is switched off, the permission is removed again via
`browser.permissions.remove(...)`. Without this optional permission nothing is transmitted to third
parties.

## 4. Data flows per provider and tier

All transmissions below require the global consent (section 3.1). A scan also has to be triggered,
either automatically (sender opted in) or manually ("Scan this message only" / context action).

| Data | Trigger / tier | Provider | Purpose |
|---|---|---|---|
| SHA-256 hash of an attachment | attachment scan, all tiers (`strict`, `balanced`, `max`); only if a VirusTotal key is configured | VirusTotal (`www.virustotal.com`) | check whether the file is already known |
| SHA-256 hash of an attachment | attachment scan, all tiers | Hybrid Analysis (`hybrid-analysis.com`) | check whether the file is already analysed (hash overview) |
| Complete attachment (file content, file name, MIME type, size) | tier `balanced` and `max`; automatic scan (hash lookup returned no match) or manual attachment upload in the popup | Hybrid Analysis (`hybrid-analysis.com`) | static and dynamic analysis in the Falcon Sandbox |
| URLs from the message | tier `max`; automatic scan or manual URL scan in the popup | Hybrid Analysis (`hybrid-analysis.com/api/v2/quick-scan/url`) | URL analysis |
| URLs when the user clicks/checks a link, and links marked for review | whenever an urlscan.io key is configured (in all tiers) | urlscan.io (`urlscan.io`) | link/phishing analysis (screenshot-based) |
| Domains extracted from the message body | whenever a URLhaus key is configured | URLhaus (`urlhaus-api.abuse.ch`) | check the domain against malware URL lists |
| IP addresses found in the `Received` headers | only when a provider + key for IP reputation are configured | AbuseIPDB (`api.abuseipdb.com`) or VirusTotal (`www.virustotal.com`) | IP reputation |

In the `strict` tier the manual attachment upload and the manual URL scan in the popup are disabled
(they require `balanced`/`max` respectively); only the hash lookups and the reputation lookups above
remain available.

Inherent to HTTP, each request also reveals the requesting IP address and a user-agent string to the
respective provider.

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

Sample messages for the test steps are in `testdata/` (a harmless attachment, an HTML attachment, a
sender-domain mismatch, a spoofed display name and an urgency link). Import those `.eml` files into
a test account instead of using real mail.

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
   reports that the permission is missing ("host permission missing"). If you enabled the global
   consent, Thunderbird also asks for the optional `sensitiveDataUpload` permission in the same
   step — grant it as well (section 3.3).
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

### 8.6 Test the tier gate, the popup and the context menu

18. **Tier `strict` — manual paths disabled.** Keep the privacy tier at `strict` and open the popup
    (the Thundy AV button in the message display action). The manual attachment upload and the manual
    URL scan are disabled and show a notice telling you to switch to *balanced*/*max* in the options.
19. **Tier `balanced` — manual attachment upload.** Switch the tier to `balanced`, save and re-open the
    popup; the manual attachment upload becomes available. With the global consent on it sends
    `POST https://hybrid-analysis.com/api/v2/quick-scan/file`.
20. **Tier `max` — manual URL scan.** Switch the tier to `max` and use the manual URL scan in the popup;
    it sends `POST https://hybrid-analysis.com/api/v2/quick-scan/url`.
21. **Popup consent.** With the global consent switched off, the popup shows a notice and transmits
    nothing, regardless of the tier; no manual upload or URL scan is possible from the popup.
22. **Context menu.** Right-click a link in the message → **"Scan link with Thundy AV"**, and use
    **"Scan all links of this message"** from the message display action context menu. Both entries
    must be present (they require the `menus` permission) and must only transmit with the global
    consent active.

The full end-to-end protocol for the live test is described in `docs/live_test_protocol.md`.

### 8.7d Risk indicator in the toolbar and link checking before opening (since 1.6.8)

- **Toolbar indicator.** The message display action carries a badge with the risk score and a colour per
  severity (critical/high/medium/low), plus a tooltip naming score, verdict and subject. A "clean" mail
  with score 0 leaves the badge empty on purpose (no permanent alarm). Implemented with
  `messageDisplayAction.setBadgeText/setBadgeBackgroundColor/setTitle`.
- **Inline status strip.** Above the message a strip shows score, severity, verdict, the authentication
  state (SPF/DKIM/DMARC) and the top reasons - **always**, independent of the warning threshold. The
  warning banner still appears for score >= 50.
- **Link checking before opening.** The first click on a link is intercepted (`preventDefault`), the
  address is checked (locally stored state; additionally urlscan.io if a key is configured and the global
  consent is on) and the result is shown in a banner with "Open now" / "Cancel". Only the confirmation
  (or a second click) hands the URL to the default browser via the `openLink` message action
  (`tabs.create`). Without a urlscan key/consent the result is reported as "not checked" - nothing is
  presented as verified that was not verified.
- **Per-link status.** Each link gets a tooltip with host and state plus a coloured dashed underline
  (look-alike domains, shorteners, URLhaus matches are flagged).
- **No new permissions**, no code strings in injections (function + arguments only).

Reviewer test: open a test message from `testdata/` with links; check the badge and the inline strip; click
a link and confirm that the banner appears first and that navigation only happens after "Open now".

### 8.7c Bulk scan, case notes, ZIP inspection and evidence hash (since 1.6.7)

- **Bulk scan.** Context menu entry "Scan selected messages with Thundy AV" in the message list
  (`menus` context `message_list`) and a button in the options page. It evaluates up to 100 messages per
  run, keeps the user informed through a single notification and lists the results sorted by score. The
  same consent and privacy-tier gates apply as for a single scan; without consent the run still produces
  the local assessment and feeds the local indicator index.
- **Case notes.** Each message can carry a local note (max 4000 characters) stored in the local database
  and removed by "Clear cache".
- **ZIP inspection.** For archive attachments the options/popup can list the ZIP central directory
  (entry names, sizes, compression method, encrypted flag, risky extensions) **without extracting or
  executing anything**. Limits: 32 MB and 200 entries.
- **Evidence hash.** Every dossier carries a SHA-256 over its canonical fields (message, sender, auth
  results, Received chain, attachment hashes, links, IOCs, score breakdown, MITRE IDs). The hash is
  stable for the same content and independent of volatile fields such as the collection timestamp, so a
  report can be re-verified. It can be copied from the popup.

Reviewer test: select two messages in the message list, use the context menu bulk scan, then open the
options page and look for those messages in "Verlauf & Pivot". Afterwards add a case note to one of them,
reload the popup and confirm the note persists; clear the cache and confirm both the index and the note
are gone.

### 8.7b Local indicator index, pivot and history search (since 1.6.6)

For every message it scans, the add-on writes the indicators it found (URLs, domains, IP addresses,
SHA-256 hashes, e-mail addresses) plus subject, date, verdict and score into a **local** IndexedDB store
(`thunderbird_av` -> `iocs`, database version 4). Message bodies are never stored, and the index is
limited to 300 entries per message.

- **Pivot:** each IOC in the popup has a "Pivot" button that lists the other recorded messages
  containing that indicator (newest first); "Open" uses `messageDisplay.open({ headerMessageId })`.
- **History search:** options page section "Verlauf & Pivot" with text, kind and verdict filters.
- **Data basis:** only messages this add-on has scanned itself - nothing is fetched from the network.
- **Deletion:** the "Clear cache" button empties both stores (`hybridanalysis` and `iocs`).
- **No new permissions:** everything uses `messagesRead` and `storage`.

Reviewer test: open two messages from `testdata/` that share a domain, scan both, then pivot on that
domain in the popup or search for it in the options - both must be listed. Afterwards clear the cache and
repeat: the history must be empty.

### 8.7a What "disarm HTML" does (and does not do)

The button sanitises an HTML attachment **locally** and saves the result through the download manager:

- active content is removed: `<script>`, `<object>`, `<embed>`, `<iframe>`, `<base>`, `<meta>`, `<link>`,
  `<svg>`, `<math>`, `<noscript>`, `on*` event handlers, and `javascript:`/`data:`/`vbscript:` URLs
  (including control-character obfuscation and mXSS via `<template>`);
- **remote references are neutralised** so that opening the saved file cannot contact the sender:
  `src`/`srcset`/`poster`/`background`/`data`/`ping`/… are removed, `url(...)` in inline styles and
  `@import` in `<style>` blocks are replaced by an inert placeholder. The blocked target stays readable
  in the attribute `data-thundy-blocked-*` for analysis purposes.
- `<a href>` targets are **kept** (analytical value) — the file is inert, not interaction-free. Do not
  click links in a disarmed file unless you intend to visit the target.

Details and the full threat model: `docs/threat_model.md`.

### 8.7 Built-in self-test (fastest way to verify a review machine)

The options page contains a **"Selbsttest & Diagnose"** section. One click runs a local diagnostic and
prints a PASS / NOTICE / ERROR table:

- availability of every Thunderbird API the add-on uses (`messageDisplay.onMessagesDisplayed`,
  `getDisplayedMessages`, `open`, `scripting.executeScript`, `notifications`, `permissions`, `downloads`,
  `menus`, `messages.get`, IndexedDB);
- the consent gate (without consent every transmission path must abort with `EXTERNAL_ANALYSIS_DISABLED`);
- the privacy-tier gates (strict blocks upload/URL scan, balanced allows upload, max allows both);
- the analysis parsers (`Authentication-Results`, `Received` chain with hop delays, link anatomy,
  IOC extraction, attachment classification, risk-score ledger, MITRE mapping);
- a real **banner injection probe** into the currently open message (open a message first - otherwise the
  check reports a notice instead of a failure);
- a notification round-trip (created and removed again);
- for every configured provider key: whether the matching host permission is granted.

All checks use synthetic data and run locally; nothing is transmitted. The report can be copied or saved
as a text file (step 0 in `docs/live_test_protocol.md`). It does **not** replace the visual inspection of
the banners and the permission dialogs, which stay manual.

## 9. Researcher view and notifications

The popup button in the message display action has a second tab, the **researcher view**, aimed at
IT security analysts. It is a **purely local** presentation layer: it reads and displays data the
add-on already has, and it introduces **no new permission and no new transmission path**.

### 9.1 Data that is read locally

Everything shown in the researcher view is derived from the currently opened message and from the
local scan state:

- **Headers:** From, Reply-To and Return-Path, the display name vs. the address, Message-ID, the date,
  the `Authentication-Results` header (SPF/DKIM/DMARC verdicts) and the full `Received` chain (hops,
  the time differences between the hops, and the IP addresses each hop names).
- **Attachments:** file name, MIME type, size and the locally computed SHA-256 hash; the provider
  status (VirusTotal/Hybrid Analysis) comes from the stored scan result, not from a new request.
- **Links:** the URL and its parts (scheme, host, registrable domain, TLD, punycode/homoglyph
  suspicion, tracking parameters, short-URL detection) plus the stored URLhaus/urlscan.io status.
- **Derived, local views:** the IOC list (URLs, domains, IPs, hashes, e-mail addresses), the per-rule
  risk breakdown, the timeline (message date, scan timestamps, job submission/retrieval) and the
  MITRE ATT&CK mapping.

### 9.2 No new permissions

The researcher view needs **no additional permissions**. It uses exactly the permissions the add-on
already declares and that are documented in section 2:

| Permission | Role in the researcher view |
|---|---|
| `messagesRead` | Read the headers, the `Received` chain, the links and the attachment metadata of the opened message. |
| `storage` | Read the local scan results, the consent flags, the tier and the analysis identifiers. |
| `notifications` | Show and update the per-scan notification (section 9.4). |
| `downloads` | Save the exports (JSON/CSV/STIX 2.1) that the user requests (section 9.3). |

No optional host permission is requested for the researcher view; it performs no provider request of
its own.

### 9.3 Local exports

The export actions (JSON, CSV and a minimal STIX 2.1 bundle) are generated **locally** and written to
disk through `browser.downloads.download()`. No export is uploaded and no server is contacted. The
file is created only in response to the user's explicit click.

### 9.4 One notification per scan, updated in place

Each scan uses a **single, stable notification ID**. Instead of posting a new notification per stage,
the add-on **updates** the same notification: *running* → *submitted / job ID* → *result with verdict
and score*. Clicking the notification opens the related message. The notification text names only the
**host** of the scanned entity — never the complete URL. Error messages are still delivered as
separate notifications.

### 9.5 Reviewer check steps

- **Export:** open an analyzed message, switch to the researcher tab, choose an export (JSON, CSV or
  STIX 2.1) and confirm that Thunderbird's download manager saves the file locally. Open the file and
  check that it contains the locally derived data (headers, attachments, links, IOCs, timeline).
- **Notification:** trigger a scan (banner button, popup or context menu) and watch the system
  notification. It must stay the **same** notification while it goes from *running* to
  *submitted/job ID* to *result*, and a click must open the scanned message. Confirm that the
  notification shows only the host and not the full URL.
- **No new permission prompt:** while using the researcher view and the exports, Thunderbird must not
  ask for any additional permission.

## 10. Known open items

These points are deliberately documented as not yet complete and are **not** claims of finished work:

- Manual verification of the banner injection in Thunderbird 140 ESR is still outstanding. Until it
  is done, the in-message banners (opt-in banner, threat banner, Time-of-Click marker) are the parts
  of the add-on that are least verified in a real Thunderbird installation.
- There are **no real screenshots** yet; the repository only contains SVG placeholders
  (`docs/screenshots/*.svg`). See `docs/store_assets.md`.
- The add-on has **not** been submitted to the Thunderbird Add-ons Store; there is no store URL and
  no store download button.
- No dedicated reviewer test key is included: the API key required for a full end-to-end run is the
  reviewer's own free provider account (step 8.2). Without a key, the local checks still work, but
  no external analysis can be triggered.

## 11. Documents and contact

- Privacy policy: `docs/privacy_policy.md`, hosted at
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Store listing texts: `docs/store_listing.md`
- Asset status: `docs/store_assets.md`, capture guide: `docs/screenshot_capture.md`
- Reviewer test data: `testdata/` (sample `.eml` messages for the test steps in section 8)
- Live test protocol: `docs/live_test_protocol.md`
- Maintainer and support: Jan Bludau (VaZuLeS), bludau.it.services@gmail.com
- Repository and issue tracker: https://github.com/VaZuLeS/Thunderbird-Antivirus
