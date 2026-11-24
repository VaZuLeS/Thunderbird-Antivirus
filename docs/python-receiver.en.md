---
layout: guide
lang: en
title: Python receiver for security reports
---

# Python HTTPS receiver and email delivery

[Deutsch](python-receiver.md) · [Documentation](guide-en.md)

- [Installation](#installation)
- [HTTPS, SMTP and SQLite](#configuration)
- [Testing and Thunderbird setup](#testing-and-thunderbird)
- [Email contents, retention and retries](#operations-and-email-contents)

The standalone receiver accepts `POST /thundy/events`, stores each event in SQLite and sends a multipart HTML and plain-text email through an SMTP relay. The example recipient is `jan@myville.com`. HTTP 204 confirms storage. SMTP acceptance is tracked separately.

**Download** Open the assets under [GitHub Releases](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/latest) and download `thundy-python-receiver-<version>.zip`. Extract `receiver.py`, `requirements.txt` and `receiver.example.toml` into the same directory. The [TOML template in the repository](https://github.com/VaZuLeS/Thunderbird-Antivirus/blob/main/examples/python-receiver/receiver.example.toml) lists each configuration group.

Manual retry and the separate store for failed deliveries are available in the development receiver after the original 1.26.2 ZIP. The installation steps and HTTPS contract apply to both builds.

## Installation

Use Python 3.11 or later. On Linux, run the following commands from the extracted directory.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp receiver.example.toml receiver.toml
.venv/bin/python receiver.py token
```

On Windows, use `py -m venv .venv`, run `.\.venv\Scripts\python.exe` in place of `.venv/bin/python`, and copy the template with `Copy-Item receiver.example.toml receiver.toml`.

`token` prints a bearer token for Thunderbird and its SHA-256 digest for the server. Under `[clients]` add one digest and a device label per installation in this format.

```toml
[clients]
"<replace with the 64-character SHA-256 from token>" = "pilot-pc-01"
```

Deliver the bearer token to the Thunderbird user through a secure channel. To revoke it, remove its digest and restart the receiver. When rotating a token for the same device, keep its label for duplicate detection.

## Configuration

| Group | Set these values |
| --- | --- |
| `[http]` | Listen address and `port`, plus a PEM certificate chain (`certificate`) and private key (`key`). Use a hostname that matches the certificate and is trusted by Thunderbird. With the example port, the URL is `https://soc.example.com:8443/thundy/events`. |
| `[storage]` | SQLite `database` in a writable directory, `queue_limit` and `retention_days`. Relative paths resolve from the directory containing `receiver.toml`. |
| `[smtp]` | Relay `host` and `port`, TLS mode, approved `from` address and destination `to`, with one complete ASCII address per field. Use `starttls` for a relay offering STARTTLS, commonly on port 587, or `implicit` for TLS at connection time, commonly on port 465. Set `username` and the password environment variable for authenticated SMTP. The template uses `THUNDY_SMTP_PASSWORD`. |
| `[clients]` | Token digests and device labels. Keep plaintext bearer tokens in the relevant Thunderbird profiles. |

`tls = "local"` allows unauthenticated SMTP on a loopback address. `allow_loopback_http = true` allows an HTTP test with an explicit loopback bind. Use a trusted HTTPS URL when connecting Thunderbird. Restrict the config, database directory, TLS key and SMTP credentials to the service account and administrators. Restart the receiver after changing configuration or the certificate.

```sh
.venv/bin/python receiver.py serve --config receiver.toml
```

### Run as a systemd service

This example uses a service account called `thundy`, the application under `/opt/thundy-receiver`, and `/etc/thundy/receiver.toml`. Set `database = "/var/lib/thundy-receiver/events.sqlite3"`. Keep `/etc/thundy/smtp.env` readable only by root and set `THUNDY_SMTP_PASSWORD` there if needed. Grant the service account read access to the TOML and TLS files.

```ini
[Unit]
Description=Thundy AV HTTPS receiver and SMTP outbox
After=network-online.target
Wants=network-online.target

[Service]
User=thundy
Group=thundy
StateDirectory=thundy-receiver
UMask=0077
EnvironmentFile=-/etc/thundy/smtp.env
ExecStart=/opt/thundy-receiver/.venv/bin/python /opt/thundy-receiver/receiver.py serve --config /etc/thundy/receiver.toml
Restart=on-failure
TimeoutStopSec=90
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Save this as `/etc/systemd/system/thundy-receiver.service`, then run `sudo systemctl daemon-reload` and `sudo systemctl enable --now thundy-receiver`. Use `sudo journalctl -u thundy-receiver` to follow receipt and SMTP entries by event ID.

## Testing and Thunderbird

1. Set `thundyPolicy.reporting.endpoint` to the receiver's complete HTTPS URL in `policies.json`. Enable `malicious` or `suspicious` reporting and configure the relevant protection group. Restart Thunderbird. [Managed Thunderbird setup and event fields](enterprise-policy.en.md)
2. In Thundy's administration settings, review the destination and data scope, enter this installation's bearer token and grant access to the endpoint. External analysis providers can remain disabled for a threshold test.
3. In the pilot, temporarily set the link threshold to `0`, the link action to `block` and reporting mode to `suspicious`. Click a harmless HTTPS link in a test message, then check the event ID in the local audit and in the email. Restore the production threshold and action, then restart Thunderbird.

To test the receiver independently, save the following payload as `event.json`. For each new test, generate a new UUID and use it both in the JSON and in `Idempotency-Key`.

```json
{
  "schemaVersion": 1,
  "id": "a1c8080d-5c2e-491e-a163-000000000001",
  "observedAt": "2026-11-23T09:00:00.000Z",
  "action": "link_open",
  "finding": "suspicious",
  "decision": "warn",
  "policyRevision": 1,
  "hostname": "example.org",
  "details": { "reason": "threshold", "score": 50, "threshold": 50, "providers": [] }
}
```

```bash
read -r -s THUNDY_TEST_TOKEN
curl --include --fail-with-body \
  -H "Authorization: Bearer $THUNDY_TEST_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: a1c8080d-5c2e-491e-a163-000000000001' \
  --data-binary @event.json https://soc.example.com:8443/thundy/events
unset THUNDY_TEST_TOKEN
```

| Result | What to check |
| --- | --- |
| `204` | SQLite accepted the event or already holds an identical one. For a missing email, check SMTP status and relay logs. |
| `401` | Verify the bearer token, its digest in `[clients]` and the last receiver restart. |
| `409` | The event ID is already associated with different content or another device. Use a new UUID for a new test. |
| `422` | Check event fields, types and provider references. |
| `503` | Check the active queue and database access. |

## Operations and email contents

The email identifies the device, event, time, action and policy decision. With `indicators` enabled it can include a link hostname or attachment SHA-256. With `details` enabled it can include the reason, score, threshold, attachment filename and linked provider findings. Each provider entry may include its verdict, observation source and time, provider score, counts and report reference. A Hybrid Analysis sample link opens the report overview and an optional job ID identifies the run. A urlscan.io link opens the matching result. Access depends on the provider and scan visibility. Local findings can have an empty provider list.

The current receiver also accepts schema version 2, with detections such as **Trojan · Emotet** or **Phishing · PayPal**. Upgrade the receiver before enabling `reporting.detections`, then approve the expanded scope in Thunderbird. The grouping command counts an event once per distinct label, even when two providers share it. It folds case variants and keeps different vendor names separate.

```sh
.venv/bin/python receiver.py status --config receiver.toml
.venv/bin/python receiver.py retry --event-id a1c8080d-5c2e-491e-a163-000000000001 --config receiver.toml
.venv/bin/python receiver.py groups --by family --config receiver.toml
.venv/bin/python receiver.py groups --by brand --config receiver.toml
```

The grouping choices are `family`, `category`, `brand` and `signature`. The output lists the label, event count and latest receipt. `--limit` accepts 1–500 groups. Grouping data follows the event metadata retention period and is removed with the associated event rows.

Temporary SMTP errors are retried with backoff. Connection, authentication and relay configuration failures pause delivery across the queue and appear in `status`. A pending event frees its slot after seven days from receipt. Permanently refused events leave the active queue immediately. Their payloads remain recoverable for up to seven days in a separate store capped by `queue_limit`. The oldest recoverable payload is evicted first when the store fills. `status` lists recoverable IDs, the error and expiry. `retry` requeues an available payload with the same event ID and email `Message-ID`.

After SMTP acceptance, the receiver removes the payload from SQLite and retains receipt and delivery metadata for 30 days by default. A process failure between SMTP acceptance and the database update can lead to another email with the same `Message-ID`. The configured relay and destination mailbox apply their own retention rules.
