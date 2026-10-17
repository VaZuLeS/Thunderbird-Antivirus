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
| Version | 1.24.2 – GitHub release (unsigned) – see [CHANGELOG.md](CHANGELOG.md) |
| License | GNU GPL v3 (`GPL-3.0-only`, current source) – see [LICENSE](LICENSE) |
| Maintainer | Jan Bludau (VaZuLeS) |
| Support | bludau.it.services@gmail.com |
| Repository | https://github.com/VaZuLeS/Thunderbird-Antivirus |
| Release (unsigned XPI for testing) | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.2 |
| Requires | Thunderbird 140.0 or newer (Manifest V3) |
| Languages | English, German, French, Spanish, Italian and Polish; complete bundled UI catalogs with English fallback |

## Setup after installation

Version 1.24.0 opens a [three-step setup wizard](docs/EINRICHTUNGSASSISTENT.md) on first installation. Updates preserve existing preferences and do not reopen it. The wizard configures link protection; optional provider setup opens settings and requires separate consent there. Available in all six bundled languages; reopen it from settings or postpone without saving.

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
| `strict` (default) | Only SHA-256 hashes and metadata; the manual attachment upload in the popup is disabled | Only hashes/domains to reputation services; the manual URL scan in the popup is disabled |
| `balanced` | Additionally uploads attachments unknown to all providers (automatic scan and manual upload) | Still no full URLs |
| `max` | Uploads unknown attachments | Additionally uploads URLs for analysis (automatic scan and manual URL scan) |

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
`web-ext-config.mjs`, so that test files, `tools/`, `testdata/`, `docs/`, `scripts/`, `examples/` and lock files are
not shipped.

## Build, lint and test

```bash
npm ci                                                # install dev dependencies (jsdom, web-ext)
npm test                                              # run all node:test files
node ./scripts/pre-submit-checks.js                   # manifest / privacy policy / permission checks
npx web-ext lint                                      # addons-linter
npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
node ./scripts/verify-package.js ./build              # verify the packaged runtime files and size
npm run store-gate                                    # submission readiness gate (added by the maintainer)
```

- `npm test` uses the script from `package.json` (`node --test`) and therefore executes **all** test files defined
  there (the full suite), not just `background.test.js`.
- `npm run check` chains the pre-submit checks, the tests, the lint filter, the build and the package verification.
- `web-ext lint` currently reports **0 errors**. The remaining warnings are almost exclusively `UNSUPPORTED_API`
  notices, because the linter validates against a Firefox target and does not know Thunderbird-only APIs such as
  `messages.*` or `messageDisplay.*`. Review the list before releasing.
- `web-ext build` produces the XPI from the runtime files only; the `ignoreFiles` rules in `web-ext-config.mjs`
  keep tests, `tools/`, `testdata/`, `docs/`, `scripts/`, `examples/` and lock files out of the package, and
  `scripts/verify-package.js` checks the result. (`web-ext` does not read a `.webextignore` file, so
  `web-ext-config.mjs` is the single source of truth.)
- CI (`.github/workflows/ci.yml`) runs the pre-submit checks, bundled fallback/vendor checks, full `npm test`, filtered lint and the build/package gate on every push and pull request with Node 22.
- The manual live test in Thunderbird 140 ESR is described in [docs/live_test_protocol.md](docs/live_test_protocol.md).
- More details: [docs/quickstart.md](docs/quickstart.md).

## Enterprise implementation concept

The six proposed enterprise capabilities are fully specified in [the implementation concept](docs/ENTERPRISE_UMSETZUNGSKONZEPT.md), including device/server trust, policies, OIDC roles, incidents, privacy, operational recovery, work packages and acceptance criteria. [Draft data contracts](docs/enterprise/README.md) include validated policy/event examples. A [preparatory Node-only contract core](enterprise/README.md) now validates signed policies, event semantics and URL redaction; it is excluded from the XPI. The [implementation status](docs/ENTERPRISE_UMSETZUNGSSTAND.md) identifies the missing organization decisions, credentials and real-client acceptance. Version 1.22.0 adds [optional system profiles](docs/ENTERPRISE_SYSTEMPROFILE.md): choose combinations in settings, save locally and export a disabled configuration draft. Azure/AWS/Google Cloud, Entra ID/Keycloak/Okta, Intune/Jamf/Ansible, Sentinel/Splunk/Elastic and Jira/ServiceNow/GitLab are available as preparation profiles. Enterprise deployment and integrations remain unimplemented.

[Storage status explained](docs/ENTERPRISE_SPEICHERSTATUS.md) distinguishes locally stored records (STAGED), a storage check (CLOUD_OBSERVED), and planned independently confirmed protection against changes and deletion (SEALED). The offline administrator view explains these states in all six supported languages. SEALED is not implemented.

## Enterprise development service

A [local ingestion service and six-language offline administrator review](docs/ENTERPRISE_LOKALER_SERVICE.md) are now available in the repository. Run `npm run enterprise:local -- init`, then `demo`, `review --lang en --out /tmp/review.html` or `serve --port 8766`. Signed device events receive durable local STAGED receipts, with replay/conflict checks and independent export verification. This development service is excluded from the XPI; corporate enrollment, SEALED storage, SSO roles and extension integration remain pending.

The [persistent broker outbox](docs/ENTERPRISE_OUTBOX.md) now queues signed events and sequence numbers before delivery, resumes retries after restart, verifies pinned server receipts and retains all STAGED payloads. Use `npm run enterprise:broker -- status` or follow the isolated synthetic queue-to-review walkthrough.

A [separate witness and offline evidence verifier](docs/ENTERPRISE_EVIDENZPRUEFUNG.md) now attest and check complete STAGED snapshots against an externally pinned witness hash. This detects valid tail truncation and forks beyond ordinary signature verification. It does not establish immutable SEALED storage or retire broker payloads.

[Optional immutable-storage adapters](docs/ENTERPRISE_STORAGE_ADAPTER.md) now prepare S3, Azure Blob and GCP Bucket Lock storage with identity, version, retention and actual-byte readback checks. The local simulator requires no cloud account; all profiles default to disabled and no SEALED receipt is issued.

## Version 1.20.0 — Link decisions and review

**Review link log** in settings or the message popup shows intercepted HTTP(S) clicks, full URLs, local context scores, provider verdicts and opened/aborted/error/pending decisions. Filters and JSON/CSV exports support administrator review; the decision-time assessment stays separate from late check results. High-risk openings are highlighted. Logs remain local, bounded to 30 days / 2,000 events / 2 MiB, and can be deleted independently of caches.

This is not a central or tamper-proof enterprise audit service. Browser handoff does not prove a website visit, and native context-menu openings are not recorded. Full URLs and reasons may contain sensitive data. [Administrator capabilities and roadmap](docs/ADMIN_FEATURES.md) · [Release notes](docs/releases/1.20.0.md) · [Manual acceptance](docs/live_test_1_20_0.md).

## Version 1.19.1

Fixes the collapsed message-action popup and confirmed links that failed to open. Confirmed HTTP(S) links now use Thunderbird’s default-browser API, with visible failure and retry handling. The branded link dialog isolates its styles from the email and shows the destination domain, full address and scan uncertainty. The popup separates local risk, message metadata, consent and stored scan results; technical details are collapsible. All six languages are included.

[Release notes](docs/releases/1.19.1.md) · [Regression and live-test checklist](docs/live_test_1_19_1.md).

## Version 1.19.0

The optimization work is documented in [the task plan](docs/AUFGABENPLAN_OPTIMIERUNG_I18N.md). External scans require both global consent and a message action or sender authorization. Local checks work without API keys; complete URL submissions require the Maximum tier. Sender authorizations can be edited in settings. Reputation caches expire after 15 minutes; persistent results are limited to 1,000 messages and cleaned against a 30-day retention period on database startup.

The [GitHub release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.2) contains an unsigned XPI. Real acceptance screenshots exist ([thunderbird-linux](docs/screenshots/thunderbird-linux/), gate C5 PASS); the manual live test in Thunderbird 140 ESR remains required ([live test protocol](docs/live_test_protocol.md)).

## Unified product design

The [shared design system](docs/DESIGNSYSTEM.md) defines consistent user and admin patterns, with an [interactive offline reference](docs/UI_DESIGNSYSTEM.html) containing synthetic examples only. All seven offline enterprise renderers now share the generated design core, including document-local theme/density controls; the reference does not provide SSO, RBAC or active integrations. Regenerate it with `npm run design:reference`; `npm run check:design` verifies that it matches the implemented theme.

## Appearance and themes

The redesigned settings organize appearance, privacy, protection, providers, sender rules and local tools into six sections. Choose automatic Thunderbird appearance, explicit light or dark, and Ocean, Violet, Forest or Amber accents. Appearance saves immediately and updates open add-on pages; other settings still use Save. Comfortable/compact density updates local admin tools as well. Theme preferences never enable scans or change consent. Local enterprise profile settings show unsaved changes, a comparison with the saved selection, discard and retryable loading/saving; saving never activates an integration. See [theme behavior and manual acceptance](docs/DESIGN_THEMES.md).

## Permissions overview

| Permission | Why it is needed |
| --- | --- |
| `messagesRead` | Read the displayed message (subject, sender, body, attachments) so it can be analysed; used only for the message you open and when a scan is triggered. |
| `theme` | Read Thunderbird theme colors and react to theme changes in automatic mode; never change Thunderbird’s theme. |
| `storage` | Store settings, the consent flag, per-sender opt-in flags, provider API keys and the local scan cache. |
| `notifications` | Report scan start, submission and errors in a system notification. |
| `scripting` | Inject the banner, the threat warning and the time-of-click hover notice into the message view (extension-bundled code only, no remote code). |
| `downloads` | Save a locally sanitized ("disarmed") HTML attachment through the browser download manager. |
| `menus` | Add the two context-menu entries ("scan this link", "scan all links of this message"). They only feed the same consent-gated scan paths. |

Optional permissions requested at runtime, only in response to a user action:

| Permission | When / why |
| --- | --- |
| `sensitiveDataUpload` (`optional_permissions` in `manifest.json`) | Requested together with the global consent so message data may be sent to a remote server; removed again when the consent is switched off. Thunderbird labels it "transfer sensitive user data to a remote server". |

Optional host permissions (`optional_host_permissions` in `manifest.json`) – each one is requested at runtime, only
when the matching provider is used:

| Origin | Provider |
| --- | --- |
| `https://hybrid-analysis.com/*`, `https://*.hybrid-analysis.com/*` | Hybrid Analysis |
| `https://*.virustotal.com/*` | VirusTotal |
| `https://urlscan.io/*`, `https://*.urlscan.io/*` | urlscan.io |
| `https://urlhaus-api.abuse.ch/*` | URLhaus (abuse.ch) |
| `https://api.abuseipdb.com/*` | AbuseIPDB |

`manifest.json` also declares `browser_specific_settings.gecko.data_collection_permissions` as
`{ "required": ["none"], "optional": ["personalCommunications"] }`: nothing is collected or transmitted unless the
user grants the optional consent, and the optional category `personalCommunications` only becomes relevant once
external analysis is enabled. Data is transmitted only after the global consent and a user action, and only to
providers you have granted access to.

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
- With the default tier `strict`, unknown attachments are not uploaded at all — neither automatically nor via the
  popup (the manual upload and the manual URL scan are disabled there and show a hint). Switch to `balanced`
  (attachments) or `max` (attachments and URLs) in the options to enable those paths.
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

GNU General Public License, version 3 only (`GPL-3.0-only`) – see [LICENSE](LICENSE).

Copyright © 2025–2026 Jan Bludau. This license applies to the current project source. Previously published releases retain their original terms. The bundled `tldts` library retains its MIT license; see [vendor/tldts.LICENSE](vendor/tldts.LICENSE). [Website license information](docs/license.md).


The [persistent local storage job workflow](docs/ENTERPRISE_STORAGE_JOBS.md) records verified evidence jobs, retries and simulation completion before acknowledging progress. `npm run enterprise:storage-jobs -- status` requires an explicit queue and trusted key configuration. The CLI worker runs local simulations; the explicit `runCloudOne` library API now processes optional S3/Azure/GCP jobs with total deadlines, cancellation and durable version-bound observations. Tests use SDK doubles; production cloud acceptance and SEALED commits remain pending.

A [six-language offline storage job review](docs/ENTERPRISE_STORAGE_ADMIN.md) now shows processing states, retries, errors, capacity, object versions and retention dates. Generate it with `enterprise:storage-jobs review --queue ... --config ... --lang en --out ...`. It is a read-only, unsigned snapshot; it does not activate cloud storage, retry jobs or establish SEALED evidence.

The [public-key storage verifier](docs/ENTERPRISE_PUBLIC_KEY_PRUEFUNG.md) now checks signed job journals and generates the six-language review without the private writer key or a writer lock. [Prioritized execution plan](docs/ENTERPRISE_NAECHSTE_SCHRITTE.md) identifies the next locally executable tasks and the remaining production prerequisites.
