# Thundy AV – Email Scanner for Thunderbird

**Thundy AV** is an opt-in email security add-on for Mozilla Thunderbird. It inspects the message you are
currently reading for malicious attachments and suspicious links and – only after you have explicitly consented –
submits the minimum data required to external analysis services.

> **Status:** the add-on is **not listed in the Thunderbird Add-ons Store (addons.thunderbird.net) yet**, so there
> is no store URL. Build and load the current source as described below. See [docs/STATUS.md](docs/STATUS.md) for
> what is finished and what is still open.

| Field | Value |
| --- | --- |
| Add-on name | Thundy AV – Email Scanner for Thunderbird |
| Short name | Thundy AV |
| Add-on ID | `thundy-av@bludau-it-services.de` |
| Version | 1.6 – see [CHANGELOG.md](CHANGELOG.md) |
| License | MIT – see [LICENSE](LICENSE) |
| Maintainer | Jan Bludau (VaZuLeS) |
| Support | bludau.it.services@gmail.com |
| Repository | https://github.com/VaZuLeS/Thunderbird-Antivirus |
| Requires | Thunderbird 140.0 or newer (Manifest V3) |
| Strings | Manifest strings and banners are localized (English, German – `_locales/`); the options page and the popup are currently German only |

## What the add-on does

- **Local checks first.** When a message is displayed, Thundy AV hashes its attachments (SHA-256), evaluates
  subject/body heuristics, the sender domain, typosquatting lookalikes, the Reply-To domain, first-contact status,
  authentication headers (SPF/DKIM/DMARC) and your custom black/whitelist, and computes a local risk score (0–100).
- **Banner in the message view.** Above the message you get a banner that states whether the sender is scanned.
  It offers two buttons: **"Scan this message once"** and **"Always scan this sender"**.
- **Threat banner.** If the risk score exceeds the threshold, a warning banner with the reasons is injected into the
  message view.
- **Links.** Links can be checked when the message is opened or at the moment you click them (time-of-click
  protection, with an on-hover notice). A context-menu entry scans a link with Thundy AV.
- **Popup** (message display action): message metadata, stored scan results, manual upload of an attachment, a URL
  scan and **"download disarmed HTML"** (an HTML attachment is sanitized locally before it is saved via the
  browser's download manager).
- **Notifications** report scan progress and results.
- **IP reputation (optional):** the sending mail servers extracted from `Received` headers can be checked against
  VirusTotal or AbuseIPDB.

## Consent model (new in 1.6)

1. **Global consent – required for every transmission.** In the options page you must switch on
   *"Externe Analyse erlauben"* (external analysis). The default is **off**. The background script enforces this
   switch for every code path that talks to a third party: without consent nothing is sent, and the banner reports
   that no data has been transmitted.
2. **Privacy tier – how much may be transmitted.** Default is `strict`.
3. **Host permissions are optional.** All provider origins live in `optional_host_permissions` in `manifest.json`
   and are requested at runtime via `browser.permissions.request()` for the provider that is actually used. Nothing
   is granted up front.
4. **Per-message or per-sender.** A scan is either a one-off action from the banner/popup/context menu or a
   permanent opt-in for a single sender.

| Privacy tier | Attachments | Links/URLs |
| --- | --- | --- |
| `strict` (default) | Only SHA-256 hashes and metadata | Only hashes/domains to reputation services |
| `balanced` | Additionally uploads attachments that are unknown to all providers | Still no full URLs |
| `max` | Uploads unknown attachments | Additionally uploads URLs for analysis |

## Data & privacy

- No transmission without the global consent **and** a user action (banner button, popup, context menu or an
  explicit per-sender opt-in).
- **No telemetry and no developer-operated server.** All requests go directly from your Thunderbird to the provider
  you configured and granted permission for.
- Locally stored: settings, opt-in flags, API keys and a scan-metadata cache (IndexedDB, `db.js`). The cache can be
  cleared in the options page ("Cache leeren").
- API keys are kept in `browser.storage.local` in your Thunderbird profile **unencrypted** – see
  [docs/external_service_hardening.md](docs/external_service_hardening.md) for the limits and recommendations.
- Privacy policy (live): https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Sources in this repository: [docs/privacy_policy.md](docs/privacy_policy.md) (policy),
  [docs/reviewer_notes.md](docs/reviewer_notes.md) (reviewer notes), [docs/store_listing.md](docs/store_listing.md)
  (store listing draft).

## External analysis services

Host origins are declared in `manifest.json` (`optional_host_permissions`) and requested at runtime – only for the
provider that is about to be used.

| Provider | Used for | Own API key |
| --- | --- | --- |
| [Hybrid Analysis](https://www.hybrid-analysis.com/) | File/attachment upload and verdicts | required |
| [VirusTotal](https://www.virustotal.com/) | Lookup of attachment hashes; optional IP reputation | required |
| [urlscan.io](https://urlscan.io/) | Live scan of URLs (time-of-click) | optional (free key available) |
| [URLhaus / abuse.ch](https://urlhaus.abuse.ch/) | Lookup of URLs/domains in a malware URL database | optional |
| [AbuseIPDB](https://www.abuseipdb.com/) | Optional IP reputation of sending mail servers | required (for this feature) |

Check the terms of use and the data protection notes of the providers you enable; they process the submitted data on
their own infrastructure.

## Requirements

- **Thunderbird 140.0 or newer** (the add-on uses Manifest V3 and `data_collection_permissions`).
- For development only: **Node.js ≥ 20** (CI uses Node 22) and npm.
- API keys for the providers you want to use (see the table above). URLs entered in the options page point to the
  registration pages.

## Installation

### Load the source as a temporary add-on (development)

```text
Thunderbird → ☰ → Add-ons and Themes → gear icon → "Debug Add-ons"
(opens about:debugging#/runtime/this-thunderbird)
→ "Load Temporary Add-on…" → select /path/to/Thunderbird-Antivirus/manifest.json
```

Alternatively start Thunderbird via web-ext:

```bash
npx web-ext run --firefox=/path/to/thunderbird
```

`web-ext` has **no** `--target thunderbird` option (its targets are `firefox-desktop`, `firefox-android` and
`chromium`). Use `--firefox` with the path to your Thunderbird binary, or pass an alias like `--firefox nightly`.

Temporary add-ons are removed as soon as Thunderbird exits – good for testing, not for daily use.

### Manual installation of a built XPI

1. Build the package (see below): `npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest`
2. In Thunderbird open **Add-ons and Themes** (`Ctrl+Shift+A`), click the gear icon and choose
   **"Install Add-on From File…"**, then select the ZIP/XPI from `./build`.
3. Confirm the installation and, if Thunderbird asks, restart.
4. Host permissions are not granted at install time; the add-on asks for them later, when you actually use a provider.

Note: a locally built XPI is unsigned. Release builds of Thunderbird refuse unsigned add-ons unless signature
enforcement is disabled (`about:config` → `xpinstall.signatures.required = false`, not available in all builds); for
distribution use `npx web-ext sign --channel listed` / `--channel unlisted` or the Add-ons Store signing. Release
packages are produced with `web-ext build --source-dir .` and cleaned up by the `ignoreFiles` rules in
`web-ext-config.mjs` (supplemented by `.webextignore`), so that test
files, `docs/`, `scripts/`, `examples/` and lockfiles are not shipped.

### Manual attachment analysis (popup)

The popup lists every attachment of the displayed message with type and size:

- **Hash locally** computes the SHA-256 hash without transmitting anything.
- **Upload & analyse** submits that single attachment to the configured provider and renders the report in the
  popup. Without consent, API key or host permission the popup explains what is missing and links to the
  options page.

### Researcher features (roles `research` / `audit`)

- **IOC extraction** (URLs, hosts, registrable domains, IPs, addresses, SHA-256, Message-IDs, mail servers) with
  JSON/CSV export.
- **Authentication chain** (SPF/DKIM/DMARC incl. domain and verifying server) and **Received hops** in chronological
  order with per-hop delay.
- **URL anatomy:** scheme, host, registrable domain, subdomain depth, IP/punycode hosts, credentials in the URL,
  tracking parameters and a tracker-free variant.
- **Attachment type analysis** via magic bytes (declared vs. detected type, double extensions, macro-capable
  documents) and **score breakdown** per evaluation step.

All of it is computed locally; nothing is transmitted.

#### Header forensics, Unicode, archives and STIX

- **Header forensics** with severity and MITRE ATT&CK mapping: display-name brand impersonation, envelope
  mismatches, authentication failures, missing TLS markers, unusual hop order, bulk-mailer hints, date divergences.
  The score contribution is capped at 35 points.
- **Unicode forensics:** bidirectional overrides, zero-width characters, mixed scripts; **punycode hosts are
  decoded** so the real IDN is visible.
- **Archive inspection without extraction:** ZIP entry names/sizes are read from the local buffer and checked for
  risky/double extensions, nested archives and path traversal.
- **STIX 2.1 export** and **provider pivots** (VirusTotal, Hybrid Analysis, urlscan.io, URLhaus, AbuseIPDB) as plain
  user-clicked links.

#### Pivot, sandbox, bulk scan and bursts

- **Local IOC pivot:** check whether a hash/IP/domain/URL already appeared in your own history and stored results.
- **Rule/score sandbox** (options): run a sample through the full local evaluation - ideal for tuning custom rules.
- **Bulk link check** (opt-in, require consent + API key; hidden otherwise) and **findings CSV export**.
- **Burst detection:** many entries for the same sender within ten minutes are flagged in the statistics.

### Link guard (time-of-click)

- Three modes: `off`, `hint` (hover tooltip with target, domain, decoded punycode host, anomalies, check status) and
  `confirm`, which intercepts the click and only opens the link after an explicit check.
- Confirmation either **inline** (tooltip next to the link) or in the **add-on popup**; the popup lists every link of
  the message with its status and an "Open after check" button.
- Links blocked by a custom rule are never opened; every opening is recorded in the local history.

#### Delayed results and the result cache

- Hybrid Analysis returns verdicts late; every check therefore has an entry in a local cache (`scanResults`) with
  state (pending/done/failed), verdict, timestamp, attempts and source.
- The popup shows a **result panel** for the current message (open / finished / without result, with timestamps and
  an "Fetch result now" button) and refreshes automatically when a delayed verdict arrives.
- Link tooltips, link list and result panel read the cache first, so reopening the popup shows the previous verdict
  ("checked at ...") instead of "unknown".

#### Link guard

- In confirm mode an **overlay inside the message body** shows the real target URL (host, registrable domain, decoded
  punycode host, anomalies, check status) with Check / Open / Cancel. Clicks are intercepted in the capture phase
  (including middle-click and Ctrl/Cmd-click).

#### Diagnostics, error log and demo mode

- **Self test** in the options dialog: 13 local checks (consent, key, host permissions, alarms, injection mode, link
  guard, IndexedDB, history, open jobs, managed policy, error log) - nothing is transmitted.
- **Error log:** every internal warning/error is stored locally (ring buffer, 100 entries) and can be filtered,
  exported and cleared in the options dialog - this makes silent failures visible (see [docs/diagnostics.md](docs/diagnostics.md)).
- **Demo mode `?sample=1`** fills popup and options with sample data for store screenshots; it stores nothing, reads no
  real messages and transmits nothing.

### Localization and branding

- **Localization:** the add-on ships German and English (125 keys each) in `_locales/`. Thunderbird picks the
  language automatically; the German markup text acts as fallback so the UI is never empty.
  `scripts/check-locales.js` (part of the pre-submit checks) fails as soon as a key is missing - see
  [docs/localization.md](docs/localization.md).
- **Branding:** a small design system (shield blue, signal orange, clear ok/warning/error colours, brand header,
  cards, badges, score levels, focus rings, dark mode) lives in `theme.css` and `messageDisplay/banner.css`; see
  [docs/branding.md](docs/branding.md).

### Local rules, SIEM export, search and CDR

- **Local rule engine:** rules for sender/domain/URL/subject/file name/SHA-256 with whitelist, blacklist or score
  actions. They are evaluated locally, can short-circuit the rating and prevent uploads of files that are already
  known locally. Profiles can be exported and imported as JSON (team knowledge without any data flow).
- **SIEM/webhook export (opt-in):** forwards history events to your own HTTPS endpoint (payload: audit metadata
  only). Off by default, requires global consent, supports a shared secret header, and can be pinned by
  administrators.
- **History search:** full-text search plus from/to date filters in the options page.
- **Attachment disarming:** active content, event handlers, dangerous URIs *and* external media sources are removed;
  the sanitised document explains what was blocked and the action is logged locally.

### Enterprise, self test, statistics and reports

- **Managed policy:** administrators can pin consent, privacy tier, view role, history behaviour and
  whitelists/blacklists via `browser.storage.managed`; managed values override local settings and take effect
  immediately. See [docs/enterprise/deployment.md](docs/enterprise/deployment.md).
- **Self test (options → Diagnose):** verifies consent, API key, each host permission, the `alarms`-based
  delayed-result polling, the message display script, the IndexedDB store, the history and any managed policy -
  without transmitting anything.
- **Statistics (options → Statistik):** aggregates the history for 1/7/30/90 days (transmissions per provider,
  actions, per-day counts).
- **Report export (popup):** writes a Markdown/JSON report per message with the local score, reasons, attachments,
  verdicts and transmissions.

### View roles and audit trail

Five view roles (`viewMode`) tailor the amount of information and the interruption level: `quiet` (warnings only),
`private` (default, no technical ids), `business` (timestamps and transmission summary), `research` (hashes, job ids,
attempts, network targets) and `audit` (evidence-first). Roles change presentation only.

A local audit trail (`scanHistory`) records what was checked and what was transmitted: time, action, provider, data
type, file name, SHA-256, submission/job id, verdict and whether the result was real time or delayed. It is shown per
message in the popup, in full in the options page (filter: all / transmissions only), can be exported as CSV/JSON,
limited (50-5000 entries) or switched off - and it never leaves the device.

### Scan status: real time vs. delayed

Local checks (attachment hashes, heuristics, header and link analysis) finish immediately - the UI labels them as
*real time*. Uploads to Hybrid Analysis are processed asynchronously, so the verdict arrives later: the add-on
stores every job locally (`pendingScans`), polls it through `browser.alarms` (once per minute, up to 30 attempts or
90 minutes), writes the verdict into the local cache and raises a notification. Both the banner and the popup show
the state of every job (queued, running with attempt count and elapsed time, finished with the verdict, timeout) and
offer a manual "fetch result now" action. Jobs survive a restart of the background script.

The popup also shows the local risk score together with every reason behind it, so the rating is
understandable. The threat banner appears from 50 of 100 points; the weights are defined in `SCORE_WEIGHTS`
in `background.js` and are deliberately staggered, so no single weak signal (for example `spf=softfail` on a
newsletter) reaches the threshold on its own.

## Build, lint and test

```bash
npm ci                                                # install dev dependencies (jsdom, web-ext)
npm test                                              # run all node:test files
node ./scripts/pre-submit-checks.js                   # manifest / privacy policy / permission checks
npx web-ext lint                                      # addons-linter
npm run build                                         # -> build/thundy-av-<version>.xpi (verified)
```

- `npm test` uses the script from `package.json` (`node --test`) and therefore executes **all** test files of the
  repository, not just `background.test.js`.
- `web-ext lint` currently reports **0 errors**. The remaining warnings are almost exclusively `UNSUPPORTED_API`
  notices, because the linter validates against a Firefox target and does not know Thunderbird-only APIs such as
  `messages.*` or `messageDisplay.*`. Review the list before releasing.
- CI (`.github/workflows/ci.yml`) runs on every push and pull request with Node 22: `npm ci`, the pre-submit
  checks (real exit code), `node --test background.test.js` and `npx web-ext lint`.
- Extended workflow definitions (full `npm test`, lint filter for the known Thunderbird false positives,
  XPI build with package verification and a manual signing job) are ready in [docs/ci/](docs/ci/README.md);
  they could not be committed under `.github/workflows/` in this environment because the token lacks the
  required `workflows` permission. See [docs/ci/README.md](docs/ci/README.md) for how to apply them.
- `npm run build` produces the installable `build/thundy-av-<version>.xpi` and immediately verifies it: the file
  list must contain runtime files only, every file referenced by the packaged `manifest.json` must exist inside the
  archive, and the message display script registered in `background.js` must be present (functional smoke test).
  The artifact is unsigned - load it via *Add-ons and Themes -> gear icon -> Debug Add-ons -> Load Temporary
  Add-on*, or sign it with `web-ext sign` before distributing it.
- Prebuilt packages (prereleases, unsigned) are attached to the
  [GitHub releases](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases); each release notes block lists the
  SHA-256 checksum of the XPI.
- More details: [docs/quickstart.md](docs/quickstart.md).

## Permissions overview

| Permission | Why it is needed |
| --- | --- |
| `messagesRead` | Read the displayed message (subject, sender, body, attachments) so it can be analysed; used only for the message you open and when a scan is triggered. |
| `storage` | Store settings, the consent flag, per-sender opt-in flags, provider API keys and the local scan cache. |
| `notifications` | Report scan start, submission and errors in a system notification. |
| `scripting` | Inject the banner, the threat warning and the time-of-click hover notice into the message view (extension-bundled code only, no remote code). |
| `downloads` | Save a locally sanitized ("disarmed") HTML attachment through the browser download manager. |

Optional host permissions (`optional_host_permissions` in `manifest.json`) – each one is requested at runtime, only
when the matching provider is used:

| Origin | Provider |
| --- | --- |
| `https://hybrid-analysis.com/*`, `https://*.hybrid-analysis.com/*` | Hybrid Analysis |
| `https://*.virustotal.com/*` | VirusTotal |
| `https://urlscan.io/*`, `https://*.urlscan.io/*` | urlscan.io |
| `https://urlhaus-api.abuse.ch/*` | URLhaus (abuse.ch) |
| `https://api.abuseipdb.com/*` | AbuseIPDB |

`manifest.json` also declares `browser_specific_settings.gecko.data_collection_permissions` with the **required**
category `personalCommunications`. It documents that the add-on can process message content; data is only transmitted
after the global consent and a user action, and only to providers you have granted access to.

## Adding another analysis service

1. Add the provider's origin(s) to `optional_host_permissions` in `manifest.json`.
2. Add the host to `PROVIDER_ORIGINS` in `background.js` and request the permission at runtime via
   `browser.permissions.request()` right before the first request to that provider.
3. Guard every new network call with `mayTransmitExternally()` / `assertExternalAnalysisAllowed()` so the global
   consent applies.
4. Add unit tests for the new path and update [docs/privacy_policy.md](docs/privacy_policy.md),
   [docs/reviewer_notes.md](docs/reviewer_notes.md) and the store listing text with the provider name and the exact
   data that is sent.

## Known limitations

- **Manual verification pending.** The banner injection into the Thunderbird message view is covered by unit tests
  (with mocked Thunderbird APIs), but it has not yet been verified by hand in Thunderbird 140 ESR. Please report
  unexpected behavior with your Thunderbird version; the code logs a hint through `Logger.warn` if an injection fails.
- **No real store screenshots yet.** `docs/screenshots/` only contains SVG placeholders; real screenshots have to be
  taken for the store listing.
- **Not submitted to the Add-ons Store yet** – there is no public listing and no store URL.
- The options page and the popup are currently available in German only; the manifest strings and the banners are
  localized (English/German).
- With the default tier `strict`, unknown attachments are not uploaded automatically; you have to switch to
  `balanced`/`max` or start a manual upload from the popup.
- Detection quality and rate limits depend on the configured providers and on your own API keys.
- API keys are stored unencrypted in the Thunderbird profile (`browser.storage.local`) – anyone with access to your
  profile can read them.

## Support

- E-mail: [bludau.it.services@gmail.com](mailto:bludau.it.services@gmail.com)
- Issues and feature requests: https://github.com/VaZuLeS/Thunderbird-Antivirus/issues
- Security reports: see [SECURITY.md](SECURITY.md) (please do not open a public issue for vulnerabilities).

## Contributing

Suggestions and pull requests are welcome – see [CONTRIBUTING.md](CONTRIBUTING.md),
[COMMUNITY.md](COMMUNITY.md) and [FIRST_TIMERS.md](FIRST_TIMERS.md). All statements in the documentation should be
verifiable against the code; please run `npm test` and `npx web-ext lint` before opening a pull request.

## License

MIT – see [LICENSE](LICENSE).

