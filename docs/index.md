# Thundy AV – Documentation

Landing page for the documentation of **Thundy AV – Email Scanner for Thunderbird**
(short name "Thundy AV"), version 1.6.3, MIT license.

- Language selection page (GitHub Pages root): [index.html](index.html) ·
  [English](index_en.html) · [Deutsch](index_de.html)
- Privacy policy (German, with an English section): [privacy_policy.md](privacy_policy.md)
  · hosted: https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Reviewer notes (permissions, data flows, test path): [reviewer_notes.md](reviewer_notes.md)
- Store listing copy: [store_listing.md](store_listing.md)
- Asset status: [store_assets.md](store_assets.md) · capture guide:
  [screenshot_capture.md](screenshot_capture.md)
- Store-readiness analysis (findings B1–B6, H1–H12, M1–M12):
  [STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md) — *historic, pre-1.6 snapshot*
- **Store-readiness problem analysis (current snapshot, findings P0-1 … P3-25):**
  [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md)
- **Task plan derived from it (phases, traceability, DoD):**
  [AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md)
- Raw audit reports of that analysis: [audits/](audits/) (code, documentation/policy, build/pipeline)
- Live test protocol (manual test in Thunderbird 140 ESR): [live_test_protocol.md](live_test_protocol.md)
- Decisions log (binding decisions for the current submission candidate): [decisions.md](decisions.md)
- Reviewer test data (sample `.eml` messages): [../testdata/](../testdata/)

## Data processing in one sentence

The add-on reads the message you open in Thunderbird (headers, text, links, attachments) locally;
nothing is transmitted to third parties unless you enable "Externe Analyse erlauben" in the options
**and** trigger a scan for a message or a sender. External analysis services that may then be
contacted are Hybrid Analysis, VirusTotal, urlscan.io, URLhaus (abuse.ch) and AbuseIPDB — never
without consent. There is no telemetry, no analytics and no developer-operated server.

## For security researchers

The message popup has a **Researcher** tab that lays out the locally collected evidence: header
forensics (From/Reply-To/Return-Path, SPF/DKIM/DMARC from `Authentication-Results`, the `Received`
chain with hops, time differences and IPs), attachment forensics (name, MIME type, size, SHA-256,
provider status), link anatomy (scheme, host, registrable domain, TLD, punycode/homoglyph suspicion,
tracking parameters, short-URL detection), an extracted IOC block, a per-rule risk breakdown, a
timeline and a heuristic MITRE ATT&CK mapping. It can be exported locally as JSON, CSV or a minimal
STIX 2.1 bundle through the download manager. The tab runs entirely locally and needs no additional
permission; the MITRE ATT&CK mapping is a heuristic hint, not proof of an attack. Details:
[README.md](../README.md#for-security-researchers).

## Contact

- Maintainer / support: Jan Bludau (VaZuLeS) — bludau.it.services@gmail.com
- Repository: https://github.com/VaZuLeS/Thunderbird-Antivirus

## Status (honest)

- The add-on is **not** listed in the Thunderbird Add-ons Store yet; there is no store URL.
- **No real screenshots** exist so far — only SVG placeholders (`docs/screenshots/*.svg`).
- Manual verification in Thunderbird 140 ESR is still outstanding; the protocol and the test data are
  ready ([live_test_protocol.md](live_test_protocol.md), [../testdata/](../testdata/)).
- The store-readiness gates of this snapshot: pre-submit checks 0 errors / 1 warning (screenshots),
  `npm test` 427 tests / 0 failures, `npm run lint:filtered` 0 errors, `npm run package` valid
  (17 files, 196,505 bytes). `npm run store-gate` still reports **NO-GO** because the manual criteria
  (C5 screenshots, C6 live test, C7 release tag) are open — see [STATUS.md](STATUS.md).
