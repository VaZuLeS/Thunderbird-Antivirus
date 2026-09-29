# Reviewer Notes — Thundy AV (Thunderbird Add-on)

**Add-on name:** Thundy AV – Email Scanner for Thunderbird (short name: "Thundy AV")
**Add-on ID:** thundy-av@bludau-it-services.de
**Version:** 1.6
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
| `alarms` | Schedules the periodic check for time-delayed analyses (Hybrid Analysis processes uploaded files asynchronously). One alarm named `thundy-pending-scan-check` runs at most once per minute, only while jobs are pending, and is cleared as soon as the queue is empty (`browser.alarms.clear`). No alarm is created while no analysis is running. |
| `storage` | Stores the user's settings (privacy tier, whitelist/blacklist, scan options), the consent flags (`externalAnalysisConsent`, `scanningEnabledSenders`) and the API keys the user enters, in `browser.storage.local`. No remote storage. |
| `scripting` | Required for the message display script that renders the in-message UI (opt-in banner with its two buttons, threat banner, sender-verified badge, Time-of-Click markers). It is registered once with the documented Manifest V3 API `scripting.messageDisplay.registerScripts` (`messageDisplay/banner.js` + `banner.css`); for already open messages the same bundled files are injected with `scripting.executeScript({ files })`. All code is bundled with the add-on, no remote code is fetched or evaluated. |
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

### 3.2 Why the add-on implements its own consent dialog

Unlike Firefox, Thunderbird does not use the browser's built-in onboarding flow for data-collection
consent; the Thunderbird add-on documentation states that add-ons must request such consent
explicitly themselves. For that reason the consent described above is implemented in the add-on's
own options dialog (checkbox "Allow external analysis") together with the per-sender opt-in in the
message-view banner. No data is transmitted before the user has enabled both the global consent and
triggered a scan.

Enforcement is centralised and can be verified in two places:

- `background.js`: `mayTransmitExternally()` / `assertExternalAnalysisAllowed()` guard every provider
  request (attachment and URL uploads, hash, domain and IP lookups). Calls without consent fail with
  the error code `EXTERNAL_ANALYSIS_DISABLED`.
- `api.js` (popup): `externalAnalysisAllowed()` and `hasHybridHostPermission()` are evaluated at call
  time before a report is requested. This matters for messages whose scan results are already stored
  locally: if the user revokes consent, opening the popup no longer transmits even the stored hash.

Both checks are covered by unit tests (see `npm test`, suites "Manifest V3 port (B1) and consent
enforcement (B2)" and "get_hybrid_report_by_sha256").

The injected message display script (`messageDisplay/banner.js`) contains **no** network code at all: it asks the
background script for the display state (`getDisplayState`), receives updates (`updateDisplayState`) and sends the two
scan actions (`requestScan` with `persist: false|true`). Host permissions are requested in the options dialog only,
where the user's click is a real user gesture.

### 3.3 Manual attachment analysis (popup)

The popup lists the attachments of the displayed message (`listAttachments`) and can compute their SHA-256
hash locally (`attachmentHash`). Both actions are purely local - they transmit nothing. The explicit
"Upload & analyse" button forwards the single attachment through the background script (`uploadAttachment`),
which enforces the global consent, the host permission and the API key and answers with a structured error
code (`NO_API_KEY`, `PERMISSION_REQUIRED`, `EXTERNAL_ANALYSIS_DISABLED`, `SCAN_FAILED` plus stage) that the
popup translates into a user-visible explanation.

### 3.4 Real-time vs. delayed checks

- **Real time (local):** message headers, body text, links, attachment hashes and the heuristics run instantly and never leave the device.
- **Delayed (provider):** `POST /api/v2/quick-scan/file` and `/quick-scan/url` only **enqueue** an analysis at Hybrid Analysis. The verdict is fetched later via `GET /api/v2/overview/{sha256}`. Every job is stored locally (`pendingScans` in `browser.storage.local`, containing SHA-256, submission/job id, attachment name, message id, start time and attempt counter) and polled by the `alarms` handler until the verdict arrives, the attempt limit (30) or the age limit (90 minutes) is reached. Finished verdicts are written into the local IndexedDB cache and reported with a notification.
- VirusTotal hash lookups and URLhaus/AbuseIPDB checks are synchronous (result within the same request) and are therefore labelled as real time in the UI.

### 3.5 View roles and audit trail

The option `viewMode` controls **presentation only** (`quiet`, `private`, `business`, `research`, `audit`); it never
changes what is transmitted and adds no permissions. `quiet` suppresses the opt-in banner entirely.

The add-on keeps a local audit trail (`scanHistory` in `browser.storage.local`, capped at 50-5000 entries,
configurable, can be disabled): one entry per local check, hash lookup, attachment upload, URL scan, domain/IP
lookup and for each delayed verdict that is fetched. Each entry names the action, the provider, the data type
(sha256/attachment/url/domain/ip), the timing (real time vs. delayed), the file name, the job id and the verdict -
so a reviewer can replay exactly what left the device and when. The trail is never transmitted; the options page can
export it as CSV/JSON and delete it (`getHistory`, `clearHistory`).

### 3.6 Enterprise policy (managed storage) and self test

The add-on reads `browser.storage.managed` (no additional permission; part of `storage`). Administrators can pin
consent, privacy tier, view role, history on/off and limit, whitelist/blacklist, always-manual, Time-of-Click and
the IP reputation provider. Managed values override local settings and take effect immediately; they are control
data from the device policy, are never transmitted and never appear in the history. Template and deployment paths:
`docs/enterprise/`.

The options page offers a **self test** (`getDiagnostics`) that reports ok/warning/error for consent, API key, host
permissions, the `alarms`-based delayed-result polling, the registered message display script, the local IndexedDB
store, the history and any managed policy - useful to verify the add-on on a test machine without network traffic.
A per-message **report export** (`getMessageReport`) writes a Markdown/JSON summary of local findings, attachments
and transmissions; it is generated locally and downloaded by the user.

### 3.7 Local rules, SIEM export, history search, CDR

- **Local rule engine:** user-defined rules (sender/domain/URL/subject/file name/SHA-256, actions whitelist/blacklist/
  score) are stored locally and applied locally. A matching whitelist/blacklist rule short-circuits the score;
  file-name/hash rules prevent an upload altogether, which *reduces* data transmission. Profiles can be exported and
  imported as JSON (`getRuleProfile`, `importRuleProfile`) - no network involved.
- **SIEM/webhook export (opt-in):** with `webhookEnabled` + an `https://` URL + global consent, history events are
  POSTed to that endpoint (`thundy-av-webhook/1` payload: event, action, provider, data type, file name, SHA-256,
  job id, verdict, timestamp). Default off; only HTTPS; failures are logged and never block scanning; a test button
  exists in the options. Administrators can pin it through managed policy.
- **History search:** full-text and date-range filters are evaluated locally against the local history.
- **Attachment disarming (CDR):** active tags, event handlers and dangerous URIs are removed (as before); in addition
  external media sources are dropped and documented as `data-thundy-blocked-remote`, the disarmed document gets an
  explanatory banner, and the action is written to the local history.

### 3.8 Researcher features (research/audit roles)

The popup offers a researcher panel in the `research` and `audit` roles. Everything in it is derived locally from the opened message: IOC extraction (URLs, hosts, registrable domains, IPs, email addresses, SHA-256 values, Message-IDs, mail servers) with JSON/CSV export, the SPF/DKIM/DMARC chain, the chronological `Received` hops including per-hop delays, URL anatomy (punycode, user@host, tracking parameters, sanitised URL) and attachment type analysis based on magic bytes (type mismatch, double extensions, macro-capable documents). No network request is made for any of these; the attachment bytes are read locally through `messages.getAttachmentFile()` and never transmitted.

### 3.9 Forensic analysis (local only)

The researcher panel adds locally computed forensics:

- **Header forensics:** display-name brand impersonation, envelope mismatches (Return-Path/Reply-To/Message-ID),
  authentication failures or missing Authentication-Results, `dmarc=none`, missing TLS markers in the `Received`
  chain, unusual hop order, long hop delays, bulk-mailer hints and date divergences. Findings carry a severity and
  a MITRE ATT&CK mapping; their contribution to the score is **capped at 35 points** so single weak signals cannot
  cross the banner threshold.
- **Unicode forensics:** bidirectional overrides, zero-width characters and mixed-script strings in display names,
  subjects and URLs.
- **Punycode decoding:** `xn--` hosts are decoded for display (RFC 3492 implementation, cross-checked against Node
  in the unit tests).
- **Archive inspection without extraction:** only the ZIP central directory (names, sizes, compression method) is
  read from the local attachment buffer; entries are flagged for risky extensions, double extensions, nested
  archives and path traversal. Nothing is decompressed or executed.
- **STIX 2.1 export** of the indicators, generated locally.
- **Provider pivots:** VirusTotal/Hybrid Analysis/urlscan.io/URLhaus/AbuseIPDB links are rendered as plain links.
  Nothing is transmitted automatically; the panel states explicitly that clicking a link sends that single
  indicator to the chosen provider (a normal user-initiated navigation).

### 3.10 Pivot, sandbox, bulk scan, bursts

- **Local IOC pivot** (`pivotIndicator`): searches the local history and the local IndexedDB cache only; no network.
- **Rule/score sandbox** (`evaluateSample`): runs the local scoring pipeline on user-provided sample text and returns
  the breakdown; it performs no network request at all (asserted by a unit test).
- **Bulk link check** (`scanAllLinks`): requires the global consent *and* an API key; it submits up to 20 links of the
  opened message to Hybrid Analysis and is only reachable through an explicit button that is hidden without consent.
  Each submission is logged in the local history (including a batch summary).
- **Burst detection** is computed from the local history when the statistics are opened.

### 3.11 Link guard (time-of-click)

A dedicated script (`messageDisplay/link-guard.js`) is injected into **all frames** of the message display (the message
body lives in its own frame). Modes (`linkGuardMode`):

- `off` - no decoration, clicks behave normally.
- `hint` - hovering a link shows a tooltip with target/host/registrable domain, decoded punycode host, anomalies
  (credentials in the URL, IP host, many subdomains, tracking parameters) and the check status; clicks stay allowed.
- `confirm` - the click is intercepted (`preventDefault`) and the link is only opened after the user explicitly
  confirms, either **inline** in the tooltip or in the **add-on popup** (`linkGuardTarget`).

Data handling: the tooltip is filled by `evaluateLink`, which only reads local data (`analyzeUrl`, custom rules, the
local IndexedDB link records). Opening is done via `openLinkAfterCheck`, which re-checks the link, refuses anything
blocked by a custom rule (`BLOCKED_BY_RULE`) and then opens a Thunderbird content tab - it never contacts a provider.
Every opening is logged in the local history (`link-opened`). Both settings can be pinned by administrators and are
reported by the self test.

### 3.12 Result cache and delayed results

Hybrid Analysis processes uploads asynchronously, so verdicts arrive late. The add-on keeps a local cache
(`scanResults` in `browser.storage.local`, capped at 2000 entries) where every check has an entry with `state`
(`pending`, `done`, `failed`), verdict, timestamps, attempt counter and source. It is written when a scan is
submitted, when a verdict is fetched by the `alarms` poller, when hash/URL/domain/IP checks finish and on timeout;
on startup it is rebuilt from the local history. The user interface (link tooltip, link list, result panel in the
popup) reads the cache first, so it shows "checked at ..." with the verdict instead of "unknown", and open checks
appear as "check running (delayed) - N attempts". When a result arrives while the popup is open, the background
sends `resultsUpdated` and the popup refreshes. Nothing in the cache leaves the device; it can be cleared with the
history/cache buttons.

The link guard now always renders an overlay inside the message body in confirm mode (showing the real target URL)
and falls back to it if the add-on popup cannot be opened programmatically. Clicks are intercepted in the capture
phase, including middle-click and Ctrl/Cmd-click.

### 3.13 Diagnostics, error log and demo mode

- **Self test** (`getDiagnostics`): 13 local checks (consent, API key, host permissions, alarms, injection mode,
  link guard mode, IndexedDB, history, open jobs, managed policy, error log). No network traffic.
- **Error log** (`diagnosticLog` in `browser.storage.local`, ring buffer of 100 entries): every internal warning and
  error is captured with timestamp and level so silent failures become visible in the options dialog (filter/export/
  delete). It contains no message contents - only technical messages. Writes are serialised so cascades do not lose
  entries.
- **Demo mode** (`?sample=1` on `popup.html`/`options.html`): renders sample data for store screenshots, marked with a
  DEMO badge. It performs no storage writes, reads no real messages and never contacts a provider (asserted by a unit
  test).

## 4. Data flows per provider and tier

All transmissions below require the global consent (section 3.1). A scan also has to be triggered,
either automatically (sender opted in) or manually ("Scan this message only" / context action).

| Data | Trigger / tier | Provider | Purpose |
|---|---|---|---|
| SHA-256 hash of an attachment | attachment scan, all tiers (`strict`, `balanced`, `max`); only if a VirusTotal key is configured | VirusTotal (`virustotal.com`) | check whether the file is already known |
| SHA-256 hash of an attachment | attachment scan, all tiers | Hybrid Analysis (`hybrid-analysis.com`) | check whether the file is already analysed (hash overview) |
| Complete attachment (file content, file name, MIME type, size) | tier `balanced` and `max`, only when the hash lookup returned no match | Hybrid Analysis (`hybrid-analysis.com`, `api.hybrid-analysis.com`) | static and dynamic analysis in the Falcon Sandbox |
| URLs from the message | tier `max` | Hybrid Analysis (`hybrid-analysis.com/api/v2/quick-scan/url`) | URL analysis |
| URLs when the user clicks/checks a link, and links marked for review | whenever an urlscan.io key is configured | urlscan.io (`urlscan.io`) | link/phishing analysis (screenshot-based) |
| Domains extracted from the message body | whenever a URLhaus key is configured | URLhaus (`urlhaus-api.abuse.ch`) | check the domain against malware URL lists |
| IP addresses found in the `Received` headers | only when a provider + key for IP reputation are configured | AbuseIPDB (`api.abuseipdb.com`) or VirusTotal (`virustotal.com`) | IP reputation |

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
| IndexedDB `thunderbird_av`, version 3, object store `hybridanalysis` | scan results per message (verdict, status, analysis IDs, timestamps), link metadata, mapping via Message-ID/header ID, plus sender address/subject/file name/hash for the popup view | no attachment contents, nothing transmitted |

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
   reports that the permission is missing.
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

## 9. Known open items

These points are deliberately documented as not yet complete and are **not** claims of finished work:

- Manual verification of the banner injection in Thunderbird 140 ESR is still outstanding. Until it
  is done, the in-message banners (opt-in banner, threat banner, Time-of-Click marker) are the parts
  of the add-on that are least verified in a real Thunderbird installation.
- There are **no real screenshots** yet; the repository only contains SVG placeholders
  (`docs/screenshot-*.svg`, `docs/screenshots/*.svg`). See `docs/store_assets.md`.
- The add-on has **not** been submitted to the Thunderbird Add-ons Store; there is no store URL and
  no store download button.
- No dedicated reviewer test key is included: the API key required for a full end-to-end run is the
  reviewer's own free provider account (step 8.2). Without a key, the local checks still work, but
  no external analysis can be triggered.

## 10. Documents and contact

- Privacy policy: `docs/privacy_policy.md`, hosted at
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Store listing texts: `docs/store_listing.md`
- Asset status: `docs/store_assets.md`, capture guide: `docs/screenshot_capture.md`
- Maintainer and support: Jan Bludau (VaZuLeS), bludau.it.services@gmail.com
- Repository and issue tracker: https://github.com/VaZuLeS/Thunderbird-Antivirus
