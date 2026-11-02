# Thundy AV — Thunderbird MailExtension

Thundy AV provides local message-risk heuristics, HTML attachment disarming and a link-decision log for Thunderbird. External analysis is optional and disabled until the user grants consent and configures the relevant provider. Local heuristics do not replace a full antivirus engine or guarantee that a message or website is safe.

**Version 1.24.3:** [GitHub release status and download](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.3), unsigned distribution. [Release scope and remaining prerequisites](docs/VEROEFFENTLICHUNG_1_24_3.md). An XPI checksum is not a store signature. ATN listing/signing is a separate maintainer step.

## Install and use

Download the published XPI from GitHub, verify its accompanying `SHA256SUMS.txt`, and use Thunderbird's Add-ons Manager → Install Add-on From File in a test profile first. Follow the permission prompts supported by your Thunderbird version. Do not install a development ZIP as though it were the published release.

The manifest requires Thunderbird 140.0+. Real Linux evidence for the prepared candidate covers 140.12.0 ESR and 153.6.0 ESR in the specific cases recorded in the [execution report](docs/AUSFUEHRUNG_AUFGABEN_2026-11-02.md). This is not a claim that every newer version or Windows/macOS is already verified.

- Local checks work without API keys. Supported UI languages: English, German, French, Spanish, Italian and Polish.
- External provider access additionally requires global consent, the relevant optional host/data permissions and the appropriate privacy tier. Automatic message scans need sender authorization; one-off scans do not permanently authorize a sender.
- `OPENED` means Thunderbird accepted an opening request. It proves neither browser startup nor a website visit. `PENDING` remains an incomplete decision after a process loss.
- The local audit stores complete URLs and decision snapshots. It is bounded and separately deletable; profile users can modify it. It is not an authenticated central audit.
- Enterprise profile selection creates disabled configuration drafts. Local Node tools are separate from the extension; no enterprise service, SSO or cloud integration is activated by choosing a profile.

Read the [data-flow matrix and privacy policy](docs/privacy_policy.md), [data lifecycle](docs/DATENLEBENSZYKLUS.md), [current status](docs/AKTUELLER_PRODUKTSTAND.md) and [German quickstart](docs/quickstart.md).

## Three separate runtimes

| Runtime | Entry and storage | Distribution |
| --- | --- | --- |
| Thunderbird extension | `manifest.json`, background scripts, `popup.html`, `options.html`; IndexedDB and `browser.storage.local` | `npm run package` → `build/*.zip` (XPI-compatible archive) |
| Optional local enterprise tools | `enterprise/*.cjs`, explicit CLI input, local journals | Repository tooling, excluded from XPI |
| Web demo | `src/App.tsx`, simulated messages and decisions, browser localStorage | `npm run dev` / `npm run check:web`; **not** a Thunderbird connection and excluded from XPI |

The web demo is visibly labelled. It never issues a real link-opening request. New demo events use `SIMULATED_OPEN` / `SIMULATED_ABORT`, with zero real opening attempts. Old browser-local demo data is retained and remains labelled as simulation. Do not enter real API keys or confidential mail into the demo.

## Develop and verify

Node `^20.19.0 || >=22.12.0` is required by Vite; CI uses Node 22. Install without peer-dependency overrides:

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

[Analysis and roadmap](docs/PRODUKTANALYSE_AUFGABENPLAN_2026-11-02.md) · [Detailed execution checklist](docs/AUSFUEHRUNG_AUFGABEN_2026-11-02.md) · [Support](docs/support_faq.md) · [GitHub Pages](https://vazules.github.io/Thunderbird-Antivirus/)

Current source: GNU GPL v3 (`GPL-3.0-only`). Published releases retain their original license terms. See [LICENSE](LICENSE).
