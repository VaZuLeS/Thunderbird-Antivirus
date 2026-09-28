# Security Policy

This policy applies to the Thunderbird add-on **Thundy AV – Email Scanner for Thunderbird**
(add-on ID `thundy-av@bludau-it-services.de`), developed in
https://github.com/VaZuLeS/Thunderbird-Antivirus.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.6.x | ✅ security fixes |
| older than 1.6 (e.g. 1.5.x and earlier) | ❌ no longer supported – please update |

Only the latest released version line receives security fixes. Fixes are published as a new version in the repository
(and, once the add-on is listed, in the Thunderbird Add-ons Store).

## Reporting a vulnerability

Please report suspected vulnerabilities privately – **do not open a public issue**:

1. **Preferred:** GitHub Security Advisories →
   https://github.com/VaZuLeS/Thunderbird-Antivirus/security/advisories/new
   ("Report a vulnerability"). This keeps the report private until a fix is available.
2. **Alternative:** e-mail to **bludau.it.services@gmail.com** with the subject `[Thundy AV] Security report`.

Helpful information: affected version, Thunderbird version and operating system, a description of the impact, and –
if available – steps to reproduce or a proof of concept.

## What to expect

- **Initial response within 7 days** (acknowledgement that the report has been received and is being looked at).
- After the initial triage you get an assessment: whether the report is accepted as a security issue, whether more
  information is needed, or why it is not treated as a vulnerability.
- Accepted reports are fixed in a new release; the report and the fix are published as a GitHub Security Advisory
  after the fix is available, with credit to the reporter if desired.
- Timelines beyond the initial response depend on severity and complexity; you will be kept informed of the status.

## Scope

Relevant: the add-on code in this repository (`background.js`, `db.js`, `api_gateway.js`, `api.js`, `options.js`,
`options.html`, `popup.html`, `manifest.json`, `_locales/`), its data handling and its permissions.

Out of scope: vulnerabilities in Thunderbird itself (report these to Mozilla), in third-party analysis services
(Hybrid Analysis, VirusTotal, urlscan.io, URLhaus, AbuseIPDB) and issues that require an already compromised
Thunderbird profile or a manipulated local build.

## Security design notes

- No telemetry and no developer-operated server: requests go directly to the providers the user configured.
- Third-party transmission requires the global consent switch ("Externe Analyse erlauben", default off) **and** a user
  action – enforced centrally in `background.js`.
- Host permissions are declared as `optional_host_permissions` and requested at runtime per provider.
- No remote code: the extension packages only bundled scripts and sets the CSP
  `script-src 'self'; object-src 'none';`.
- API keys are stored unencrypted in `browser.storage.local` in the Thunderbird profile; see
  [docs/external_service_hardening.md](docs/external_service_hardening.md) for the limits and recommendations.

