---
title: Thundy AV documentation
permalink: /documentation.html
---

# Thundy AV – Documentation

Landing page for the documentation of **Thundy AV – Email Scanner for Thunderbird**
(short name "Thundy AV"), version 1.22.0. The current source uses GNU GPL v3 (`GPL-3.0-only`); published releases retain their original license. [License information](license.md).

- Language selection page (GitHub Pages root): [index.html](index.html) ·
  [English](index_en.html) · [Deutsch](index_de.html) · [Français](index_fr.html) · [Español](index_es.html) · [Italiano](index_it.html) · [Polski](index_pl.html)
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

## Contact

- Maintainer / support: Jan Bludau (VaZuLeS) — bludau.it.services@gmail.com
- Repository: https://github.com/VaZuLeS/Thunderbird-Antivirus

## Status (honest)

- The add-on is **not** listed in the Thunderbird Add-ons Store yet; there is no store URL.
- **No real screenshots** exist so far — only SVG placeholders (`docs/screenshots/*.svg`).
- Manual verification in Thunderbird 140 ESR is still outstanding; the protocol and the test data are
  ready ([live_test_protocol.md](live_test_protocol.md), [../testdata/](../testdata/)).
- Release 1.20.0: local link decisions, administrator filters, decision snapshots and JSON/CSV exports. [Administrator roadmap](ADMIN_FEATURES.md) · [Release notes](releases/1.20.0.md).
- Release 1.19.1: fixed popup sizing, default-browser link opening and redesigned security UI. [Release notes](releases/1.19.1.md).
- Release 1.19.0: complete EN/DE/FR/ES/IT/PL, 485 passing tests, no lint errors, verified unsigned XPI. [Release notes](releases/1.19.0.md).
- Real-client verification remains open: [live_test_1_20_0.md](live_test_1_20_0.md). GitHub publication is separate from Thunderbird Store signing and submission.

## Enterprise implementation concept

[Complete six-feature implementation concept](ENTERPRISE_UMSETZUNGSKONZEPT.md) · [Draft schemas and examples](enterprise/README.md). These describe planned capabilities, not new functionality in the existing release.

[Versioned incident rules and reproducible offline derivation](ENTERPRISE_INCIDENTREGELN.md) · [Prioritized execution plan](ENTERPRISE_NAECHSTE_SCHRITTE.md). Local backend preparation; persistent cases, enterprise roles and ticket delivery remain open.

[Local operational reports in six languages](ENTERPRISE_BETRIEBSBERICHTE.md) · [Optional SIEM formats and durable offline queue](ENTERPRISE_SIEM_EXPORTQUEUE.md) · [N06 live acceptance requirements](ENTERPRISE_N06_ABNAHME.md). Production integration remains incomplete; evidence readiness does not grant activation.

[Durable local incident cases and public-key review](ENTERPRISE_INCIDENTFAELLE.md). Assignment and lifecycle use explicit revisions; enterprise authorization and a central portal remain open.

[Signed policy comparison and conservative offline simulation](ENTERPRISE_POLICY_SIMULATION.md). Decision-time assessments are evaluated under explicit assumptions; rollout and activation remain unavailable.

[Incident review in six languages](ENTERPRISE_FALLUEBERSICHT.md). Public-key journal verification precedes HTML generation; filters and paginated histories preserve the complete minimized download.

[Durable local alert candidates and explicit acknowledgement](ENTERPRISE_ALARMKANDIDATEN.md). New observations retain candidates across restarts; external delivery and enterprise authorization remain open.

[Signed minimal test-device heartbeats](ENTERPRISE_HEARTBEATS.md). Device and journal signatures, sequence recovery and conservative freshness checks; no production fleet or runtime integration is claimed.
