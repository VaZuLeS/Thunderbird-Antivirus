# Thundy AV – Documentation

Landing page for the documentation of **Thundy AV – Email Scanner for Thunderbird**
(short name "Thundy AV"), version 1.6.1, MIT license.

- Language selection page (GitHub Pages root): [index.html](index.html) ·
  [English](index_en.html) · [Deutsch](index_de.html)
- Privacy policy (German, with an English section): [privacy_policy.md](privacy_policy.md)
  · hosted: https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Reviewer notes (permissions, data flows, test path, response catalogue):
  [reviewer_notes.md](reviewer_notes.md)
- Store listing copy: [store_listing.md](store_listing.md)
- Asset status: [store_assets.md](store_assets.md) · capture guide:
  [screenshot_capture.md](screenshot_capture.md)
- **Store-readiness problem analysis (current, iteration 2, state 1.6.1):**
  [PROBLEMANALYSE_STORE_READINESS_1.6.1.md](PROBLEMANALYSE_STORE_READINESS_1.6.1.md) and the derived
  **task plan** [AUFGABENPLAN_STORE_READINESS_1.6.1.md](AUFGABENPLAN_STORE_READINESS_1.6.1.md).
  The analysis of iteration 1 (state 1.6) plus its execution record:
  [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md),
  [AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md)
- Live test protocol for Thunderbird 140 ESR: [live_test_protocol.md](live_test_protocol.md) ·
  test data: [testdata.md](testdata.md)
- Data collection decision record: [data_collection_decision.md](data_collection_decision.md)
- Store-readiness analysis of version 1.5 (historical baseline, findings B1–B6, H1–H12, M1–M12):
  [STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md)

## Data processing in one sentence

The add-on reads the message you open in Thunderbird (headers, text, links, attachments) locally;
nothing is transmitted to third parties unless you enable "Externe Analyse erlauben" in the options
**and** trigger a scan for a message or a sender. External analysis services that may then be
contacted are Hybrid Analysis, VirusTotal, urlscan.io, URLhaus (abuse.ch) and AbuseIPDB — never
without consent. There is no telemetry, no analytics and no developer-operated server.

## Contact

- Maintainer / support: Jan Bludau (VaZuLeS) — bludau.it.services@gmail.com
- Repository: https://github.com/VaZuLeS/Thunderbird-Antivirus

## Status (honest)

- The add-on is **not** listed in the Thunderbird Add-ons Store yet; there is no store URL.
- **No real screenshots** exist so far — only SVG placeholders.
- Manual verification of the in-message banners in Thunderbird 140 ESR is still outstanding.
