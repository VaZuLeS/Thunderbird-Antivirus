# Thundy AV — Thunderbird MailExtension

Thundy AV provides local message-risk heuristics, HTML attachment disarming and a link-decision log for Thunderbird. External analysis is optional and disabled until the user grants consent and configures the relevant provider. Local heuristics do not replace a full antivirus engine or guarantee that a message or website is safe.

**Version 1.26.2:** [GitHub release status and download](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.26.2), unsigned distribution. [Release scope and remaining prerequisites](docs/VEROEFFENTLICHUNG_1_26_2.md). An XPI checksum is not a store signature. ATN listing/signing is a separate maintainer step.

[Documentation and contents](docs/guide-en.md) · [Deutsch](docs/guide-de.md) · [Managed Thunderbird setup](docs/enterprise-policy.en.md) · [Python receiver setup](docs/python-receiver.en.md)

## Install and use

Download the published XPI from GitHub, verify its accompanying `SHA256SUMS.txt`, and use Thunderbird's Add-ons Manager → Install Add-on From File in a test profile first. Follow the permission prompts supported by your Thunderbird version. Do not install a development ZIP as though it were the published release.

The manifest requires Thunderbird 140.0 or later. The published acceptance covers Thunderbird 140.12.0 and 153.7.0 on Linux, including upgrade and profile recovery. [Release verification](docs/VEROEFFENTLICHUNG_1_26_2.md)

- Local checks work without API keys. The published 1.26.2 package includes six languages. The development tree includes 24 EU language catalogs.
- External analysis requires global consent, a configured and enabled provider, the relevant optional permissions and a suitable privacy tier. The scan mode controls which opened messages are checked. In the development tree, full links and files also require individual approval. [Privacy and transfer matrix](docs/privacy_policy.md#english)
- `OPENED` means Thunderbird accepted an opening request. It proves neither browser startup nor a website visit. `PENDING` remains an incomplete decision after a process loss.
- The local audit stores complete URLs and decision snapshots. It is bounded and separately deletable; profile users can modify it. It is not an authenticated central audit.
- Enterprise profile selection creates disabled configuration drafts. Local Node tools are separate from the extension; no enterprise service, SSO or cloud integration is activated by choosing a profile.

Read the [documentation overview](docs/guide-en.md) for installation, day-to-day use, company reporting and troubleshooting.

## Project components

| Runtime | Entry and storage | Distribution |
| --- | --- | --- |
| Thunderbird extension | `manifest.json`, background scripts, `popup.html`, `options.html`; IndexedDB and `browser.storage.local` | `npm run package` → `build/*.zip` (XPI-compatible archive) |
| Python receiver | `examples/python-receiver/receiver.py`; durable SQLite intake and SMTP delivery | Separate ZIP in GitHub release assets, with TOML, setup and testing instructions |
| Optional local enterprise tools | `enterprise/*.cjs`, explicit CLI input, local journals | Repository tooling, excluded from XPI |
| Web demo | `src/App.tsx`, simulated messages and decisions, browser localStorage | `npm run dev` / `npm run check:web`; **not** a Thunderbird connection and excluded from XPI |

The web demo is visibly labelled. It never issues a real link-opening request. New demo events use `SIMULATED_OPEN` / `SIMULATED_ABORT`, with zero real opening attempts. Old browser-local demo data is retained and remains labelled as simulation. Do not enter real API keys or confidential mail into the demo.

## Develop and verify

Use Node.js 24 or later for the repository toolchain and Python 3 for the package tools. Install the locked dependencies:

```sh
npm ci
npm run check:web
npm run check
npm run check:ui -- --browser /absolute/path/to/chromium
```

`npm run check` checks extension sources, tests, lint and package contents. Browser UI checks use synthetic extension APIs; real Thunderbird checks use `tools/thunderbird-live.dev.py` and isolated temporary profiles. See [native acceptance](docs/NATIVE_ABNAHME_2026-11.md).

For a prepared package with current six-language browser and real-client upgrade/crash reports:

```sh
node scripts/candidate-evidence.js --write /path/to/live-reports /path/to/ui-reports
npm run goal -- --candidate
```

The candidate gate requires a clean packaged source tree and matching package/evidence. It does not claim a tag, publication or ATN approval. The release gate additionally requires the matching immutable tag. The release workflow reuses exactly the tested package; it does not rebuild it after live tests and refuses to replace different published assets. [Active CI and distribution](docs/ci/README.md).

## Project records

[Analysis and roadmap](docs/PRODUKTANALYSE_AUFGABENPLAN_2026-11-04.md) · [Detailed execution checklist](docs/AUSFUEHRUNG_AUFGABEN_2026-11-02.md) · [Support](docs/support_faq.md) · [GitHub Pages](https://vazules.github.io/Thunderbird-Antivirus/)

Current source: GNU GPL v3 (`GPL-3.0-only`). Published releases retain their original license terms. See [LICENSE](LICENSE).
