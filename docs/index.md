# Thundy AV – Documentation

Landing page for the documentation of **Thundy AV – Email Scanner for Thunderbird**
(short name "Thundy AV"), version 1.6.0, MIT license.

- Language selection page (GitHub Pages root): [index.html](index.html) ·
  [English](index_en.html) · [Deutsch](index_de.html)
- Privacy policy (German, with an English section): [privacy_policy.md](privacy_policy.md)
  · hosted: https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Reviewer notes (permissions, data flows, test path): [reviewer_notes.md](reviewer_notes.md)
  · sample message: `test/fixtures/reviewer-sample.eml`
- Store listing copy: [store_listing.md](store_listing.md)
- Asset status: [store_assets.md](store_assets.md) · capture guide:
  [screenshot_capture.md](screenshot_capture.md)
- Store-readiness **audit** (current state, findings B1–B5/H1–H7/M1–M12, 2026-09-29):
  [STORE_READINESS_AUDIT.md](STORE_READINESS_AUDIT.md)
- Store-readiness analysis (historical snapshot of the 1.5/1.6 work): [STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md)

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
