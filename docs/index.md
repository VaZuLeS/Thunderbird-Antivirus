# Thundy AV – Documentation

Landing page for the documentation of **Thundy AV – Email Scanner for Thunderbird**
(short name "Thundy AV"), version 1.6, MIT license.

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
