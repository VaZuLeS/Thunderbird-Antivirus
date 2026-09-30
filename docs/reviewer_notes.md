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
| `storage` | Stores the user's settings (privacy tier, whitelist/blacklist, scan options), the consent flags (`externalAnalysisConsent`, `scanningEnabledSenders`) and the API keys the user enters, in `browser.storage.local`. No remote storage. |
| `scripting` | Registers the message display script that is bundled with the add-on: `scripting.messageDisplay.registerScripts([{ id: 'thundy-ui', js: ['message_display.js'], runAt: 'document_idle' }])` is called at startup, on `onStartup` and on `onInstalled`. The registered script (`message_display.js`, shipped inside the package) renders the per-message opt-in banner with its two scan buttons plus an "Open options" button, the threat/warning banner and the time-of-click protection; it exchanges state with the background script through `browser.runtime.sendMessage` (`getMessageUiState`, `requestScan`, `checkLinkState`, `openVerifiedLink`). No remote code is fetched or evaluated and no remote resources are used; `scripting.executeScript` is no longer used for the message view. |
| `notifications` | Shows short system notifications for actions that are not visible in the message pane, e.g. "scan started", "scan submitted (job ID …)", the context-menu link scan result, and a notification (`notificationUiUnavailable`) if the message display script cannot be registered. This gives feedback when the scan is triggered from an entry point without its own result area. |
| `downloads` | Used for the "disarm HTML attachment" action: when the user asks for it, the add-on saves a sanitized copy of an HTML attachment through `browser.downloads.download()`. The user triggers this explicitly; nothing is downloaded automatically in the background. |
| `menus` | Creates the two context-menu entries: "Scan link with Thundy AV" (`contexts: ["link"]`) and "Scan all links of this message" (`contexts: ["message_display_action"]`, submits up to 20 links per run). Without this permission Thunderbird does not expose `browser.menus` and both functions would silently not exist. |

### 2.2 Optional host permissions

Host access is **not** requested at install time. The add-on declares optional host permissions
(`optional_host_permissions`) for the analysis provider domains. A host permission is requested only
when the user saves an API key for that specific provider in the options dialog, and the request is
made in direct response to that user action.

| Provider | Requested origin(s) | Requested when |
|---|---|---|
| Hybrid Analysis | `https://hybrid-analysis.com/*` | the user saves a Hybrid Analysis API key |
| VirusTotal | `https://www.virustotal.com/*` | the user saves a VirusTotal API key |
| urlscan.io | `https://urlscan.io/*` | the user saves an urlscan.io API key |
| URLhaus (abuse.ch) | `https://urlhaus-api.abuse.ch/*` | the user saves a URLhaus Auth-Key |
| AbuseIPDB | `https://api.abuseipdb.com/*` | the user configures IP reputation with AbuseIPDB |

These are the only five entries in `optional_host_permissions` (no wildcard subdomains, no
`<all_urls>`).

There is no `<all_urls>`, no `webRequest`, no `tabs` and no `cookies` permission.

### 2.3 In-message UI: how it is injected

The UI in the message view is **not** injected with `scripting.executeScript`. Instead the background script
registers a message display script once per session:

```js
browser.scripting.messageDisplay.registerScripts([
  { id: 'thundy-ui', js: ['message_display.js'], runAt: 'document_idle' }
]);
```

The registration is refreshed at startup, on `onStartup` and on `onInstalled` (Thunderbird keeps a registration only
for the session). `message_display.js` is part of the package and is listed in `scripts/verify-package.js`; it
contains no remote code and loads no remote resources. It renders:

- the opt-in banner (buttons *"Scan this message only"*, *"Scan this sender permanently"*, *"Open options"*),
- the warning banner from a risk score of 50 upwards, including the list of reasons,
- a green badge when SPF/DKIM/DMARC passed,
- the link marking and the time-of-click warning.

State flows in both directions through `browser.runtime.sendMessage`:
`getMessageUiState` (the answer carries `pending` while the background evaluation is still running), `requestScan`,
`checkLinkState` and `openVerifiedLink`; the background pushes updates with
`{ type: 'thundy:messageState', tabId, state }`. If the broadcast is missed, the script polls a few times. If
`registerScripts` is not available, the background logs an error and raises the notification
`notificationUiUnavailable` instead of failing silently.

## 3. Consent model

### 3.1 Two-stage consent plus a privacy tier

1. **Global consent "Allow external analysis"** — a checkbox in the options dialog, stored under the
   key `externalAnalysisConsent`. **Default: off.** While it is off, the add-on transmits **nothing**
   to third parties: no attachment or file upload, no hash lookup, no URL/domain lookup, no IP
   lookup. Local checks and banners keep working.
2. **Per-sender opt-in** — for automatic scans of messages from a sender, that sender must be added
   to `scanningEnabledSenders`. The banner in the message view offers two separate buttons:
   - "Scan this message only" → one-off scan, the sender is not stored permanently;
   - "Scan this sender permanently" → the sender is added to the persistent list. Future messages from
     that sender are then scanned automatically **while the global consent is enabled, a Hybrid Analysis key is
     configured and the host permission is granted** (`handleDisplayedMessage`, `canAutoUpload`); otherwise the
     banner offers the one-off scan again.
3. **Privacy tier (`privacyTier`)** — selectable in the options dialog, **default `strict`**:
   - `strict` (the default): no automatic uploads; hash lookups (Hybrid Analysis, VirusTotal) and — for the
     providers the user configured — reputation lookups for URLs/domains/IP addresses are transmitted;
   - `balanced`: additionally full attachments of *unknown* files are uploaded to Hybrid Analysis;
   - `max`: additionally URLs from the message are submitted to Hybrid Analysis.

### 3.2 Data-collection declaration and the built-in consent category

`manifest.json` declares

```json
"browser_specific_settings": { "gecko": { "data_collection_permissions": {
  "required": ["none"], "optional": ["personalCommunications"] } } }
```

so **nothing is collected as a requirement**, and message content (category `personalCommunications`) may only be
transmitted after an explicit opt-in. Two code paths implement this:

1. **Options dialog.** When the user enables the global consent and saves, the options page asks for the declared
   optional category where the environment exposes that API (`requestDataCollectionConsent()` in `options.js`:
   feature detection via `browser.permissions.getAll().data_collection`, then
   `browser.permissions.request({ data_collection: ['personalCommunications'] })` in response to the click on
   "Save"). If the request is declined, the add-on switches the global consent off again
   (`externalAnalysisConsent = false`) and informs the user.
2. **Background enforcement.** The background script evaluates the granted categories and enforces the result
   centrally in `mayTransmitExternally()` (`background.js`): as long as the environment reports
   `personalCommunications` as not granted, the function returns `false` and every provider path is refused. The
   state is refreshed at startup and on `permissions.onAdded` / `permissions.onRemoved`. On Thunderbird
   environments that do not report `data_collection` at all, the add-on's own consent checkbox in the options
   dialog is authoritative.

Not verified in the development environment (and therefore documented as open): how Thunderbird 140 ESR presents
that request for the optional category. The code path is covered by unit tests with mocked APIs only.

## 4. Data flows per provider and tier

All transmissions below require the global consent (section 3.1). A scan also has to be triggered,
either automatically (sender opted in) or manually ("Scan this message only" / context action).

| Data | Trigger / tier | Provider | Purpose |
|---|---|---|---|
| SHA-256 hash of an attachment | attachment scan, all tiers (`strict`, `balanced`, `max`); only if a VirusTotal key is configured | VirusTotal (`virustotal.com`) | check whether the file is already known |
| SHA-256 hash of an attachment | attachment scan, all tiers | Hybrid Analysis (`hybrid-analysis.com`) | check whether the file is already analysed (hash overview) |
| Complete attachment (file content, file name, MIME type, size) | tier `balanced` and `max`, only when the hash lookup returned no match | Hybrid Analysis (`hybrid-analysis.com`, `api.hybrid-analysis.com`) | static and dynamic analysis in the Falcon Sandbox |
| URLs from the message | tier `max` | Hybrid Analysis (`hybrid-analysis.com/api/v2/quick-scan/url`) | URL analysis |
| URLs the user clicks (time-of-click protection) and links checked by the auto-scan option | only with the global consent **and** a configured urlscan.io key; the auto-scan option checks at most 20 links per message | urlscan.io (`urlscan.io`) | link/phishing analysis (screenshot-based) |
| Domains extracted from the message body | whenever a URLhaus key is configured | URLhaus (`urlhaus-api.abuse.ch`) | check the domain against malware URL lists |
| IP addresses found in the `Received` headers | only when a provider + key for IP reputation are configured | AbuseIPDB (`api.abuseipdb.com`) or VirusTotal (`virustotal.com`) | IP reputation |

Time-of-click path in detail: the message display script intercepts the click on a link in the message
text, sends the URL to the background (`checkLinkState`) and the background answers with a verdict.
It first looks for a verdict that is already stored in the local IndexedDB record for that message
(`handleCheckLinkState`) and only contacts urlscan.io if no verdict is known – and then only while the
global consent is active (`checkUrlscanIo` is guarded by `mayTransmitExternally()`). The script waits at most
6 seconds; the click is released only for the verdicts `CLEAN` and `UNKNOWN`. `MALICIOUS`, `MALICIOUS_VISUAL`,
`TIMEOUT` and `ERROR` keep the link blocked and show the reasons plus an "Open the link anyway" button; a release is
remembered in memory for the session only (never in the DOM, so message content cannot tamper with it). Links with
non-HTTP(S) schemes (`file:`, `ftp:`, `smb:`, …) are blocked as well; `mailto:`, `tel:`, `news:` and `nntp:` are
opened without a check. If the option "Time-of-Click Protection" is off, no click is intercepted.

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
| IndexedDB `thunderbird_av`, version 3, object store `hybridanalysis` | scan results per message (verdict, status, analysis IDs, timestamps), the **local assessment** per message (risk score, reasons, SPF/DKIM/DMARC result, evaluation time — this is what the popup shows), link metadata, mapping via Message-ID/header ID | no attachment contents |

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

A ready-made test message that triggers the local detections without any API key or consent is included in the
repository: [`docs/test_messages/suspicious_message.eml`](test_messages/README.md) — suspicious lookalike sender,
urgent wording, mismatching `Reply-To`, `spf=fail`/`dmarc=fail`, a `Received` header with a public IP, an HTTP
typosquatting link and a disarmable HTML attachment. Drag it into a folder in Thunderbird to import it and use it for
the steps below (it also serves as the motif for the popup screenshot).

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
9. Click **Save**. When you enable the global consent, the options page first requests the declared optional
   data-collection category where the environment offers it (step 3.2); declining that request switches the global
   consent off again. Because a key is now stored, Thunderbird also asks for the optional host permission
   for `hybrid-analysis.com` — grant it. Without this grant no request is made and the add-on
   reports that the permission is missing.
10. Optional negative test: leave the consent checkbox off, save, open a message with an attachment
    and confirm that **no** network request to a provider occurs (Thunderbird Developer Tools →
    Network, or a local proxy).

### 8.4 Test the in-message UI (banner, warning, badge)

11. Open a message that contains an attachment and (for tier `max`) an HTTP link. Use test data
    only; do not use real customer mail.
12. If the sender has no opt-in yet, the banner appears above the message with **three** buttons:
    **"Scan this message only"**, **"Scan this sender permanently"** and **"Open options"**.
13. Click **"Scan this message only"**: a one-off scan starts, the action is confirmed in the banner
    and the result/warning banner appears according to the verdict. Re-open a different message from
    the same sender — the opt-in banner should appear again, because the sender was not persisted.
    If no host permission is granted yet, the banner reports "Required host permission was denied"
    after the background requested it (`permissions.request()` in response to the click).
14. Click **"Scan this sender permanently"**: the sender is added to the persistent opt-in list, so
    messages from this sender are scanned automatically from then on and the opt-in banner no longer
    appears for that sender. The stored list can be inspected in `about:debugging` → the extension →
    storage (`scanningEnabledSenders`). To compare the behaviour of a one-off scan, repeat step 13
    with a sender that has no persistent opt-in.
15. Expected network traffic for tier `strict`: `GET https://hybrid-analysis.com/api/v2/overview/<sha256>`
    (hash lookup) and only if a VirusTotal key is configured `GET https://www.virustotal.com/api/v3/files/<sha256>`;
    tier `strict` never uploads file content. Independently of the tier, a configured urlscan.io key causes
    `POST https://urlscan.io/api/v1/scan/` for clicked/newly seen URLs and a configured URLhaus key causes
    `POST https://urlhaus-api.abuse.ch/v1/host/` for domains (each only with the global consent).
    For tier `balanced`/`max`, additionally `POST https://hybrid-analysis.com/api/v2/quick-scan/file`
    when the hash is unknown; for tier `max` additionally
    `POST https://hybrid-analysis.com/api/v2/quick-scan/url`.
16. Warning banner: open a message whose local risk score is 50 or more (for example with a blacklisted sender).
    The banner appears in red with the score and the list of reasons. For a message whose SPF/DKIM/DMARC check
    passed and whose score stays below the threshold, the green badge replaces it.
17. Withdrawal test: disable "Allow external analysis" and save. Re-opening messages must not produce
    any provider request anymore, and the banner reports that nothing was transmitted.

### 8.5 Test the time-of-click protection

18. Make sure the option "Links in the message text marked and checked on click (Time-of-Click Protection)" is on
    (default) and no auto-scan is enabled. Open a message with a link and confirm that the link is marked
    (dashed underline, tooltip "Protected by Thundy AV time-of-click protection").
19. Click the link with consent granted and an urlscan.io key stored: an inline notice appears briefly
    ("Thundy AV is checking this link before it is opened…"), then either the link opens (verdict `CLEAN`/`UNKNOWN`)
    or the warning "Thundy AV blocked this link" is shown with the reasons, the target URL, **"Open the link anyway"**
    and **"Dismiss"**. Repeat the click after using "Open the link anyway" — no further check happens for that URL in
    this session.
20. Negative test: without a valid urlscan.io key the check cannot verify anything; a link that is neither stored as
    `CLEAN` nor reachable stays blocked with "The link could not be verified." A `file:`/`ftp:` link is blocked with
    the "scheme" message; a `mailto:` link opens normally.
21. Network view: with an urlscan.io key configured, clicking an unverified link produces
    `POST https://urlscan.io/api/v1/scan/` followed by `GET https://urlscan.io/api/v1/result/<uuid>/`. Without the
    global consent no request may appear.

### 8.6 Test the popup and the context menus

22. Open the message display action popup. It always shows the message metadata (subject, sender, date, Message-ID)
    and — when the message was displayed before — the **local assessment** card (risk score with bar, reasons,
    SPF/DKIM/DMARC result) plus the stored attachment/link verdicts as status chips. These come from the local
    IndexedDB only, so they appear without any consent. **Without** the global consent the popup must produce **no**
    provider request (it shows the consent notice instead); with consent and a key it additionally loads/starts
    provider reports. If it shows "no result for this message yet", open the message once in the 3-pane view or
    start a scan from the banner.
23. With consent granted, right-click a link in the message text and choose **"Scan link with Thundy AV"**; a
    notification reports the outcome. Right-click inside the message area and choose **"Scan all links of this
    message"** (message display action) — up to 20 links are submitted and the result is reported in a notification.

### 8.7 Disarm an HTML attachment

24. Open a message that carries an `.html` attachment and click **"Disarm & download (local CDR)"** in the popup.
    The add-on sanitizes the HTML locally (scripts, event handlers, `javascript:` URIs, `iframe`/`object`/`embed`
    and `meta refresh` are removed) and saves the result through the download manager; the button reports
    "Bereinigt". Nothing is uploaded for this action — it works without any consent.

### 8.8 Clear local data

25. In the options dialog, click **"Clear cache"** and confirm. The IndexedDB object store
    `hybridanalysis` (database `thunderbird_av`, version 3) is emptied; the confirmation
    "Cache erfolgreich geleert." is shown. The stored consent and settings are not affected.

## 9. Known open items

These points are deliberately documented as not yet complete and are **not** claims of finished work:

- Manual verification in Thunderbird 140 ESR is still outstanding (all of section 8 has been prepared but not
  executed in a real Thunderbird). Until it is done, the in-message UI (opt-in banner, threat banner, badge,
  link marking and the link blocking) and the two context-menu entries are the parts of the add-on that are least
  verified outside the unit tests with mocked APIs.
- The built-in data-collection consent could not be verified live: the options dialog requests the optional category
  where the environment exposes it and the background refuses to transmit while `personalCommunications` is reported
  as not granted (section 3.2), but how Thunderbird 140 ESR presents that request is untested.
- There are **no real screenshots** yet; the repository only contains SVG placeholders in
  `docs/screenshots/` (the earlier `docs/screenshot-*.svg` duplicates were removed). See `docs/store_assets.md`.
- The add-on has **not** been submitted to the Thunderbird Add-ons Store; there is no store URL and
  no store download button, and no signed XPI has been built.
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
