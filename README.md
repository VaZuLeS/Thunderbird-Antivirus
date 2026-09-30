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
| Strings | All visible UI strings (manifest, in-message UI, options page, popup) are resolved via `browser.i18n` and `_locales/` (English, German; the English translation is complete, default locale `en`, fallback texts in the code; further languages are added as additional `_locales/<code>` folders) |

## What the add-on does

- **Local checks first.** When a message is displayed, Thundy AV hashes its attachments (SHA-256), evaluates
  subject/body heuristics, the sender domain, typosquatting lookalikes, the Reply-To domain, first-contact status,
  authentication headers (SPF/DKIM/DMARC) and your custom black/whitelist, and computes a local risk score (0–100).
- **In-message UI.** The user interface in the message view is rendered by a message display script that is
  registered once (`message_display.js`, registered through `scripting.messageDisplay.registerScripts()`); it
  receives its state from the background script via runtime messaging. It shows an opt-in banner with the buttons
  **"Scan this message once"**, **"Always scan this sender"** and **"Open options"**, a warning banner from a risk
  score of **50** upwards (including the list of reasons), and a green badge when SPF/DKIM/DMARC passed.
- **Time-of-click protection.** Links in the message text are marked (dashed underline plus tooltip). When you click
  a link, Thundy AV checks it *before* it opens: a verdict stored in the local database, otherwise – with consent
  and a configured urlscan.io key – a live urlscan.io lookup with a 6-second budget. Malicious and unverifiable
  links (`MALICIOUS`, `MALICIOUS_VISUAL`, `TIMEOUT`, `ERROR`) are blocked and an inline notice shows the reasons and
  the target URL plus a **"Open the link anyway"** button; the release is remembered for the session only
  (in-memory, deliberately not in the DOM). Non-HTTP(S) schemes (e.g. `file:`, `ftp:`, `smb:`) are blocked as well
  (fail closed); `mailto:`, `tel:`, `news:` and `nntp:` are allowed. If the option "Time-of-Click Protection" is
  switched off, links are not intercepted.
- **Auto-scan option.** "Check links in the email immediately when it is opened (auto-scan)" checks up to **20
  links** per message with urlscan.io when consent is given and an urlscan.io key is configured, and stores the
  verdicts locally so a later click does not need a new network request.
- **Context menus.** Two entries exist (permission `menus`): **"Scan link with Thundy AV"** (context `link`) and
  **"Scan all links of this message"** (context `message_display_action`, up to 20 links per run).
- **Popup** (message display action): message metadata (subject, sender, date, Message-ID), the **local assessment**
  of the message (risk score with bar, reasons, SPF/DKIM/DMARC result, evaluation time), the stored attachment and link
  verdicts as status chips, a manual upload action and **"download disarmed HTML"** (an HTML attachment is
  sanitized locally before it is saved through the browser's download manager). The local assessment and the stored
  verdicts are read from the local database only, so they are shown **without** any consent; provider data (reports,
  uploads) requires the global consent **and** an API key. The popup determines the displayed message via
  `messageDisplay.getDisplayedMessages()`.
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
5. **Data-collection declaration.** `manifest.json` declares
   `browser_specific_settings.gecko.data_collection_permissions` as `required: ["none"]` plus the **optional**
   category `personalCommunications`. Nothing is required, and message content may only be transmitted after an
   explicit opt-in. Where Thunderbird offers the built-in data-collection consent, the options dialog additionally
   requests that category (`browser.permissions.request({ data_collection: ['personalCommunications'] })`, feature
   detection via `permissions.getAll().data_collection`) when you enable the global consent; if you decline, the
   global consent is switched off again and nothing is transmitted. The background script enforces the granted state
   in `mayTransmitExternally()` (`background.js`): if the environment reports `personalCommunications` as not
   granted, no data is transmitted.

| Privacy tier | Attachments | Links/URLs |
| --- | --- | --- |
| `strict` (default) | Only SHA-256 hashes and metadata | Only hashes/domains to reputation services |
| `balanced` | Additionally uploads attachments that are unknown to all providers | Still no full URLs |
| `max` | Uploads unknown attachments | Additionally uploads URLs for analysis |

## Data & privacy

- No transmission without the global consent **and** a user action (banner button, popup, context menu or an
  explicit per-sender opt-in). This also applies to the popup: without the global consent it queries no provider
  and renders a notice card instead.
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

## Build, lint and test

```bash
npm ci                                                # install dev dependencies (jsdom, web-ext)
npm test                                              # run all node:test files
node ./scripts/pre-submit-checks.js                   # manifest / privacy policy / permission checks
npx web-ext lint                                      # addons-linter
npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
```

- `npm test` uses the script from `package.json` (`node --test`) and therefore executes **all** test files of the
  repository, not just `background.test.js`. Current state: **454 tests, 0 failures** – including
  `message_display.test.js` (in-message UI and time-of-click), the popup consent tests in `api.test.js` and the
  pre-submit-check tests in `scripts/pre-submit-checks.test.js`.
- `scripts/pre-submit-checks.js` additionally verifies that every used `browser.*` API namespace has its permission
  declared, that the `data_collection_permissions` declaration matches the transmission paths, that a
  programmatically registered script (`message_display.js`) is part of the package and that every localized UI string
  has a catalogue entry (currently 173). Current state: 0 errors, 2 warnings (no real screenshots yet, and the
  active `.github/workflows/ci.yml` still runs only `background.test.js` – `docs/ci/ci.yml` contains the full CI).
- `web-ext lint` currently reports **0 errors** and **25 warnings**, all of them known Thunderbird false positives
  (almost exclusively `UNSUPPORTED_API` notices, because the linter validates against a Firefox target and does not
  know Thunderbird-only APIs such as `messages.*` or `messageDisplay.*`). The list is filtered by
  `scripts/filter-lint-warnings.js`.
- The built XPI contains **18 files / 265,425 bytes unpacked** (previously 17 files); `scripts/verify-package.js`
  checks the file list and the size.
- CI (`.github/workflows/ci.yml`) runs on every push and pull request with Node 22: `npm ci`, the pre-submit
  checks (real exit code), `node --test background.test.js` and `npx web-ext lint`.
- Extended workflow definitions (full `npm test`, lint filter for the known Thunderbird false positives,
  XPI build with package verification and a manual signing job) are ready in [docs/ci/](docs/ci/README.md);
  they could not be committed under `.github/workflows/` in this environment because the token lacks the
  required `workflows` permission. See [docs/ci/README.md](docs/ci/README.md) for how to apply them.
- More details: [docs/quickstart.md](docs/quickstart.md).

## Permissions overview

| Permission | Why it is needed |
| --- | --- |
| `messagesRead` | Read the displayed message (subject, sender, body, attachments) so it can be analysed; used only for the message you open and when a scan is triggered. |
| `storage` | Store settings, the consent flag, per-sender opt-in flags, provider API keys and the local scan cache. |
| `notifications` | Report scan start, submission and errors in a system notification (also used when the in-message UI cannot be registered). |
| `scripting` | Register the bundled message display script `message_display.js` (`scripting.messageDisplay.registerScripts()`) that renders the in-message UI: the opt-in banner with its buttons, the threat banner and the time-of-click protection. Only code that ships with the add-on is executed; no remote resources or remote code are used. |
| `downloads` | Save a locally sanitized ("disarmed") HTML attachment through the browser download manager. |
| `menus` | Create the two context-menu entries "Scan link with Thundy AV" (link context) and "Scan all links of this message" (message display action). |

Optional host permissions (`optional_host_permissions` in `manifest.json`) – exactly five origins, each one requested
at runtime, only when the matching provider is used:

| Origin | Provider |
| --- | --- |
| `https://hybrid-analysis.com/*` | Hybrid Analysis |
| `https://www.virustotal.com/*` | VirusTotal |
| `https://urlscan.io/*` | urlscan.io |
| `https://urlhaus-api.abuse.ch/*` | URLhaus (abuse.ch) |
| `https://api.abuseipdb.com/*` | AbuseIPDB |

`manifest.json` declares `browser_specific_settings.gecko.data_collection_permissions` as
`required: ["none"]` and `optional: ["personalCommunications"]`: **nothing is collected as a requirement**, and
message content may only be transmitted after the user has explicitly opted in (global consent plus a scan action).
Where the environment offers the built-in data-collection consent, the options dialog asks for the category when
the global consent is enabled (feature detection via `browser.permissions.getAll().data_collection`) and switches
the consent off again if the request is declined. Independently of that, the background script enforces the granted
state in `mayTransmitExternally()`: if `personalCommunications` is reported as not granted, no data is transmitted.

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

- **Manual verification pending (required before submission).** The in-message UI (opt-in banner, warning banner,
  SPF/DKIM/DMARC badge, link marking), the two context-menu entries, the permission prompt triggered from the banner
  and the blocking of a link are covered by unit tests with mocked Thunderbird APIs only; they have not been verified
  by hand in Thunderbird 140 ESR. Please report unexpected behavior with your Thunderbird version. If the message
  display script cannot be registered, the code logs an error and raises a system notification
  (`notificationUiUnavailable`).
- **Built-in data-collection consent not verified.** The options dialog requests the declared *optional* category
  `personalCommunications` where the environment exposes it, and the background script refuses to transmit while it
  is reported as not granted. Whether and how Thunderbird 140 ESR displays that prompt has not been verified in this
  environment – the code path is covered by unit tests with mocked APIs only.
- **No real store screenshots yet.** `docs/screenshots/` only contains SVG placeholders; real screenshots have to be
  taken for the store listing – and only after the live test in Thunderbird.
- **Not submitted to the Add-ons Store yet** – there is no public listing and no store URL. The published
  privacy policy is live but reflects an older revision of `docs/`; it has to be re-published before the listing.
- With the default tier `strict`, unknown attachments are not uploaded automatically; you have to switch to
  `balanced`/`max` or start a manual upload from the popup. Attachments larger than 100 MB are never uploaded
  automatically (provider limits); they stay in the manual path.
- Internal diagnostic messages (console/`Logger`) are English; a few error strings that could be shown to users
  are still German only.
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

