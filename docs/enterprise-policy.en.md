---
layout: guide
lang: en
title: Managed Thunderbird protection and reporting
---

# Deploy Thundy AV with Thunderbird policies

[Deutsch](UNTERNEHMENSRICHTLINIE.md) · [Documentation](guide-en.md)

- [Pilot deployment](#pilot-deployment)
- [Policy example](#policy-example)
- [Severity, waiting and retention](#severity-waiting-and-retention)
- [Reporting and event fields](#reporting-and-event-fields)
- [Rollout and rollback](#rollout-and-rollback)

## Pilot deployment

1. Choose a supported Thunderbird version (140 or later) and an approved Thundy XPI. Install it in an isolated test profile and verify that the extension loads after restart. Temporary add-ons must be loaded again after restart. A release marked unsigned has no Thunderbird Add-ons signature.
2. Locate `policies.json` for the actual Thunderbird installation. On Windows use `distribution` beside `thunderbird.exe`. On macOS use `Thunderbird.app/Contents/Resources/distribution`. On Linux use `distribution` inside the installation directory or the system-wide `/etc/thunderbird/policies`. Policies apply to the installation, including other profiles using it. Thunderbird also supports Windows Group Policy and macOS configuration profiles. [Official Thunderbird policy templates](https://thunderbird.github.io/policy-templates/policies/esr140/)
3. Back up the existing file. Merge the Thundy entry under `policies` → `3rdparty` → `Extensions`, preserving existing keys for other extensions. Save valid UTF-8 JSON without comments or trailing commas, and restrict write access to administrators.
4. Fully restart Thunderbird. Open `about:policies`, check the active `3rdparty` entry and review errors. In Thundy's administration settings, confirm that the applicable rules show as company-managed and that the revision matches. Managed fields stay locked for local administrators.
5. Verify mail account access and the receiver's certificate trust from the pilot workstation. Mail accounts, provider API credentials and reporting tokens are configured separately.

## Policy example

```json
{
  "policies": {
    "3rdparty": {
      "Extensions": {
        "thundy-av@bludau-it-services.de": {
          "thundyPolicy": {
            "schemaVersion": 1,
            "revision": 1,
            "links": { "threshold": 50, "action": "warn", "unknown": "warn", "waitForResults": true, "autoOpenBelow": 20 },
            "attachments": { "threshold": 70, "action": "warn", "unknown": "warn" },
            "severityColors": { "low": "#24764a", "unknown": "#a15b12", "caution": "#b24c0d", "high": "#bf2c36", "critical": "#a30e29" },
            "linkAudit": { "maxRecords": null, "retentionDays": 90 },
            "reporting": {
              "mode": "malicious",
              "endpoint": "https://soc.example.com:8443/thundy/events",
              "indicators": false,
              "details": false
            }
          }
        }
      }
    }
  }
}
```

- Link and attachment rules use independent inclusive thresholds of `0`–`100`. Both `action` and `unknown` accept `warn` or `block`. An omitted group uses local settings. An empty group applies the built-in defaults. An invalid protection group blocks its controlled path and shows a diagnostic. Increment `revision` when deploying changes and restart Thunderbird.
- A malicious finding tied to the resource blocks a controlled attempt. The attachment's numeric threshold uses the Hybrid Analysis score when available. Applicable Hybrid Analysis and VirusTotal malware findings can block even if there is no numeric score.
- Coverage includes links in the message view and Thundy's own **Open with Thundy** and **Save with Thundy** actions. Endpoint protection handles direct native attachment actions and subsequent access to saved files. A successful handoff records Thunderbird's acceptance of an opening request.

## Severity, waiting and retention

- **Colors for links and attachments.** `severityColors` accepts optional `low`, `unknown`, `caution`, `high` and `critical` keys with `#RRGGBB` values. The score bands are 0–24, 25–49, 50–79 and 80–100. Blocks and confirmed malicious findings use critical. Warnings and approvals are at least caution when the risk can be assessed. Incomplete findings with a low or missing score show unknown. Text labels identify the severity in every theme. IT can deploy a SOC or SIEM palette using Thunderbird policy. Restart to apply changes. The HTTPS receiver accepts events. Policy deployment goes through Thunderbird's managed configuration.
- **Pending URL scans.** `links.waitForResults: true` waits for results from already accepted, matching Hybrid Analysis and urlscan.io jobs for up to 30 seconds. If a result endpoint is rate-limited, Thundy shows the provider status. With `false` (the default), the dialog immediately shows stored verdicts and pending checks. Clicking never submits the full link. Expert view expands provider evidence, including its source, signals and report details. The standard view includes reported threat categories, impersonated brands and malware families.
- **Direct opening.** `links.autoOpenBelow` is exclusive. A value of `20` can allow score 19. Omit it or use `null` to keep confirmation. Warnings, blocks, required approvals and pending or incomplete provider checks take precedence. Managed rules require a completed provider result with no detection. Without a managed link rule, a completed local check can qualify when no provider job exists for the link and the local protection rules allow it. Each successful direct handoff is marked “Opened automatically” in the link audit.
- **Link audit retention.** `linkAudit.maxRecords` and `linkAudit.retentionDays` can be set separately. Set both to `null` to disable automatic removal. The example keeps any number of entries for up to 90 days. Default retention is 2,000 entries and 30 days. Custom retention migrates the remaining entries to a local database. Disk space and explicit clearing still apply. The audit may store full URLs including query strings.

## Reporting and event fields

Reporting defaults to `off`. `malicious` includes malicious findings. `suspicious` also includes threshold-based findings. At least one valid managed protection group is required. Use HTTPS with the exact scheme, hostname, port and path of the receiver. Leave credentials, queries and fragments out of the URL.

1. [Set up the Python receiver](python-receiver.en.md) or an endpoint implementing the same contract. Issue a revocable send token per installation and deliver it through a secure channel.
2. In the administration settings, review the destination and scope, enter the token, approve reporting and grant access to the receiver host. Destination or scope changes require approval again. Withdrawing reporting consent clears Thundy's pending event queue.
3. In a pilot, temporarily set the link threshold to `0`, the action to `block` and reporting to `suspicious`. Click a harmless HTTPS link and match the event ID in the local audit to the receiver's status or email. Restore the pilot thresholds and restart.

The sender uses `POST` with `Content-Type: application/json`, `Authorization: Bearer <token>` and `Idempotency-Key: <event UUID>`. A `2xx` acknowledgement confirms durable intake. The Python receiver returns `204` for the first successful insert and for an identical duplicate from the same installation. Its SMTP status tracks the subsequent relay handoff.

| Configuration | Event data |
| --- | --- |
| Always | Schema version, event ID, UTC timestamp, action (`link_open`, `attachment_open`, `attachment_save`), finding, policy decision and policy revision. |
| `indicators: true` | Link hostname or attachment SHA-256. |
| `details: true` | Reason, available decision score and threshold, attachment filename, and provider findings tied to the resource. |
| `detections: true` with `details: true` | Provider-supplied malware categories, family names, vendor signatures and identified phishing targets. |

Optional provider entries include an identifier, verdict, observation source and time, score, detection counts and a report reference when available. Hybrid Analysis links open a sample overview and an optional job ID identifies an individual run. urlscan.io links open an individual scan. VirusTotal file checks can supply detection counts. The local decision score and provider scores have separate fields. Provider access may require an account, and a local-only event can have an empty provider list. The email's device label comes from the token mapping at the receiver. Message text, complete original URLs, attachments and provider API keys are excluded from the event payload.

Upgrade the receiver before enabling the new `reporting.detections` option and approve the expanded scope in Thunderbird. Only events that include detections use envelope `schemaVersion: 2`. Other events stay on version 1. Each detection has a `kind` (`category`, `family`, `signature` or `brand`) and a `value`. For example, one file can carry category `trojan`, family `Emotet` and signature `Trojan:Win32/Emotet!X`. An established phishing category from urlscan.io can be paired with a brand such as `PayPal` or `Google` when the provider returned both. Labels such as `fraudulent_shop` require an explicit provider classification. The [local score formula](LOCAL_SCORE.md#english) covers the assessment without provider results. [VirusTotal classification fields](https://docs.virustotal.com/reference/file-object-popular-threat-classification) · [urlscan result fields](https://urlscan.io/docs/result/)

Thundy queues up to 100 reports for up to 24 hours. Network errors and retryable HTTP responses use the same event ID. HTTP 401 or 403 pauses delivery until the token is replaced. The opening decision is local. See the [data-flow and privacy policy](privacy_policy.md#english) for provider transfers and local storage.

## Rollout and rollback

For automatic installation, add an `ExtensionSettings` entry for `thundy-av@bludau-it-services.de` under the same `policies` object. Set `installation_mode` to `force_installed` and `install_url` to your approved XPI. Users cannot disable or remove an extension installed this way. Test signing requirements and the install/update path on the managed client before rollout. [Thunderbird ExtensionSettings reference](https://thunderbird.github.io/policy-templates/policies/esr140/#extensionsettings-management-of-extensions)

Run a small pilot, review false positives and delivery status, and adjust link and attachment settings independently. For rollback, redeploy the previous policy or remove just the Thundy-managed entry, then restart Thunderbird and verify the effective rules. Keep endpoint protection active for native attachment actions.
