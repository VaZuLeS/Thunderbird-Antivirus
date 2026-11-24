---
layout: guide
lang: en
title: Documentation in English
---

# Thundy AV documentation

[Deutsch](guide-de.md) · [Downloads and other languages](index.html)

- [Install](#install)
- [Check messages, links and attachments](#everyday-protection)
- [Analysis providers and privacy](#providers-and-privacy)
- [Company policies and incident reporting](#managed-deployment)
- [Support, development and release evidence](#support-and-development)

## Install

Thundy AV is a MailExtension for Thunderbird **140** or later. Download the approved XPI and `SHA256SUMS.txt` from the same [GitHub release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/latest). Verify the file's SHA-256. In a Thunderbird test profile, open Add-ons Manager and choose **Install Add-on From File**. GitHub builds marked unsigned have no Thunderbird Add-ons signature.

The setup wizard covers language selection, link protection and optional provider analysis. Local checks work without API keys. Appearance preferences include Light, Dark and Follow Thunderbird, information density, and simple or expert results.

## Everyday protection

- The overview shows the finding and an expandable [local score with rule contributions](LOCAL_SCORE.md#english). Open **Inspection details** for coverage and provider findings. The resource view can group detections by family, category, brand or signature.
- The link dialog shows severity, URL scan progress and available threat categories, impersonated brands and malware families. **Expert view** expands the provider evidence and the local score contributions. For attachments, use **Open with Thundy** or **Save with Thundy**.
- In administration settings, you can wait for pending scans, allow direct opening below a score and retain the link audit without a fixed entry count. The audit marks direct handoffs “Opened automatically.” When company reporting is enabled, use the event ID to find the incident.

## Providers and privacy

Configure each provider in Settings. Use the API key instructions next to each provider and pause it without removing its key. Hybrid Analysis and VirusTotal check attachment hashes, URLhaus checks domains, and AbuseIPDB or VirusTotal check public IP reputation. Hybrid Analysis and urlscan.io can also analyze full links.

Starting with **1.26.3**, automatic scans may use hashes, domains and public IPs according to the scan mode, consent and host permission. Full links and files require individual approval in the popup. Previously accepted jobs can be retrieved by reference. If the source archive fills, scans continue and mark the new source view as available for the current session. See the [data-flow and privacy policy](privacy_policy.md#english) for the transfer matrix and local retention.

## Managed deployment

1. [Configure Thunderbird and `policies.json`](enterprise-policy.en.md). IT can set separate link and attachment rules and direct incident reports to an internal HTTPS endpoint.
2. [Install and configure the Python receiver](python-receiver.en.md). The standalone service accepts events into SQLite and sends email through an SMTP relay.
3. [Send a test event and verify email delivery](python-receiver.en.md#testing-and-thunderbird). The event ID connects Thunderbird, receiver status and email. See the [reporting contract](enterprise-policy.en.md#reporting-and-event-fields) for fields and provider references.

## Support and development

- [Support and FAQ](support_faq.md#english) · [Privacy and local data](privacy_policy.md#english)
- [Architecture, build and verification commands](https://github.com/VaZuLeS/Thunderbird-Antivirus#develop-and-verify) · [Development setup in German](quickstart.md)
- [Published status and verification records in German](AKTUELLER_PRODUKTSTAND.md) · [Release history](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases)

The React demo simulates decisions in a browser. The optional Node tools work with local enterprise data. The Python receiver is the standalone HTTPS and SMTP service.
