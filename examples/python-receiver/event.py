"""Thundy incident schemas and their plain-text / HTML email representation."""

import calendar
import ipaddress
import json
import re
import unicodedata
from email.message import EmailMessage
from email.utils import formatdate
from html import escape


UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", re.IGNORECASE | re.ASCII)
SHA256 = re.compile(r"[0-9a-f]{64}")
TOKEN = re.compile(r"[A-Za-z0-9._~+/=-]{16,1024}")
JOB = re.compile(r"[A-Za-z0-9_-]{1,128}")
ISO_UTC = re.compile(r"([0-9]{4}|[+-][0-9]{6})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})\.[0-9]{3}Z")
MAX_SAFE_INTEGER = 2 ** 53 - 1

ACTIONS = {"link_open": "Link öffnen", "attachment_open": "Anhang öffnen", "attachment_save": "Anhang speichern"}
FINDINGS = {"suspicious": "Verdachtsfall", "malicious": "Bösartiger Befund", "malware": "Malware", "phishing": "Phishing"}
DECISIONS = {"warn": "Gewarnt", "block": "Blockiert"}
REASONS = {"threshold": "Richtlinienschwelle erreicht", "malicious": "Bösartiger Befund"}
PROVIDERS = {"hybridanalysis": "Hybrid Analysis", "urlscan": "urlscan.io", "virustotal": "VirusTotal"}
VERDICTS = {"malicious": "Bösartig", "suspicious": "Verdächtig", "no_detection": "Keine Erkennung"}
SOURCES = {"live": "Live-Abfrage", "stored": "Gespeicherter Befund", "archive": "Archivbefund"}
DETECTION_KINDS = {"family": "Schadsoftware-Familie", "category": "Kategorie", "brand": "Nachgeahmte Marke", "signature": "Hersteller-Erkennung"}
DETECTION_CATEGORIES = {
    "malware": "Malware", "virus": "Virus", "trojan": "Trojaner", "ransomware": "Ransomware", "worm": "Wurm",
    "spyware": "Spyware", "adware": "Adware", "backdoor": "Backdoor", "downloader": "Downloader", "dropper": "Dropper",
    "infostealer": "Infostealer", "rootkit": "Rootkit", "phishing": "Phishing", "scam": "Betrug",
    "fraudulent_shop": "Betrügerischer Shop", "phishing_shop": "Phishing-Shop",
}
DETECTION_LABEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9 ._+!():/-]{0,79}")


class InvalidEvent(ValueError):
    pass


def require(condition, field):
    if not condition:
        raise InvalidEvent(field)


def fields(value, required, optional=()):
    require(isinstance(value, dict) and set(required) <= value.keys() <= set(required) | set(optional), "fields")


def matches(pattern, value):
    return isinstance(value, str) and pattern.fullmatch(value) is not None


def choice(value, choices):
    return isinstance(value, str) and value in choices


def iso_utc(value):
    match = ISO_UTC.fullmatch(value) if isinstance(value, str) else None
    if not match:
        return False
    year, month, day, hour, minute, second = map(int, match.groups())
    return (1 <= month <= 12 and 1 <= day <= calendar.monthrange(year, month)[1]
            and hour < 24 and minute < 60 and second < 60)


def hostname(value):
    if not isinstance(value, str) or not value or len(value) > 4096:
        return False
    if value.startswith("[") and value.endswith("]"):
        try:
            return "%" not in value and bool(ipaddress.IPv6Address(value[1:-1]))
        except ValueError:
            return False
    # A serialized WHATWG hostname can contain ASCII punctuation beyond DNS labels.
    return all(33 <= ord(char) < 127 and char not in "%#/<>?@[]\\^|:" for char in value)


def scores(value, *keys):
    for key in keys:
        if key in value:
            require(type(value[key]) in (int, float) and 0 <= value[key] <= 100, key)


def provider_report(row, schema):
    provider = row.get("provider")
    base = ("provider", "verdict", "source")
    optional = {
        "hybridanalysis": ("score", "reference", "reportUrl", "jobId"),
        "urlscan": ("reference", "reportUrl"),
        "virustotal": ("maliciousCount", "suspiciousCount"),
    }
    require(choice(provider, PROVIDERS), "provider")
    extra = ("detections",) if schema == 2 else ()
    fields(row, base, ("observedAt", *optional[provider], *extra))
    require(choice(row["verdict"], VERDICTS) and choice(row["source"], SOURCES), "provider verdict/source")
    if "observedAt" in row:
        require(iso_utc(row["observedAt"]), "provider observedAt")
    scores(row, "score")
    if "reference" in row:
        reference = row["reference"]
        if provider == "hybridanalysis":
            require(matches(SHA256, reference), "provider reference")
            url = f"https://www.hybrid-analysis.com/sample/{reference}"
        else:
            require(matches(UUID, reference), "provider reference")
            url = f"https://urlscan.io/result/{reference}/"
        require(row.get("reportUrl") == url, "provider reportUrl")
    else:
        require("reportUrl" not in row, "provider reportUrl")
    if "jobId" in row:
        require(matches(JOB, row["jobId"]) and row["jobId"] not in {"MANUAL_CHECK", "PENDING_UPLOAD"}, "provider jobId")
    for key in ("maliciousCount", "suspiciousCount"):
        if key in row:
            require(type(row[key]) is int and 0 <= row[key] <= MAX_SAFE_INTEGER, key)
    if "detections" in row:
        detections = row["detections"]
        require(row["verdict"] != "no_detection" and isinstance(detections, list) and 1 <= len(detections) <= 12, "detections")
        keys = set()
        for detection in detections:
            fields(detection, ("kind", "value"))
            kind, value = detection["kind"], detection["value"]
            require(choice(kind, DETECTION_KINDS), "detection kind")
            if kind == "category":
                require(choice(value, DETECTION_CATEGORIES), "detection category")
            else:
                require(matches(DETECTION_LABEL, value) and value == value.strip() and "://" not in value
                        and not re.search(r"\bwww\.", value, re.I)
                        and value.lower() not in {"unknown", "generic", "malicious", "suspicious", "clean", "undetected", "none", "n/a"},
                        "detection label")
            keys.add((kind, value.casefold()))
        require(len(keys) == len(detections), "duplicate detection")
        if any(kind == "brand" for kind, _ in keys):
            require(provider == "urlscan" and row["verdict"] == "malicious" and
                    any(("category", value) in keys for value in ("phishing", "phishing_shop")), "phishing brand")
    return provider


def unique_object(pairs):
    result = dict(pairs)
    require(len(result) == len(pairs), "duplicate JSON key")
    return result


def parse_event(raw, idempotency_key):
    try:
        event = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
    except (ValueError, RecursionError) as error:
        raise InvalidEvent("JSON") from error
    fields(event, ("schemaVersion", "id", "observedAt", "action", "finding", "decision", "policyRevision"),
           ("hostname", "sha256", "details"))
    schema = event["schemaVersion"]
    require(type(schema) is int and schema in (1, 2), "schemaVersion")
    require(matches(UUID, event["id"]) and event["id"] == idempotency_key, "event ID")
    require(iso_utc(event["observedAt"]), "observedAt")
    require(choice(event["action"], ACTIONS) and choice(event["finding"], FINDINGS)
            and choice(event["decision"], DECISIONS), "action/finding/decision")
    require(type(event["policyRevision"]) is int and 1 <= event["policyRevision"] <= MAX_SAFE_INTEGER, "policyRevision")
    link = event["action"] == "link_open"
    if "hostname" in event:
        require(link and hostname(event["hostname"]), "hostname")
    if "sha256" in event:
        require(not link and matches(SHA256, event["sha256"]), "sha256")
    if "details" in event:
        details = event["details"]
        fields(details, ("reason", "providers"), ("score", "threshold", "attachmentName"))
        require(choice(details["reason"], REASONS), "reason")
        scores(details, "score", "threshold")
        if "attachmentName" in details:
            name = details["attachmentName"]
            require(not link and isinstance(name, str) and 1 <= len(name) <= 180
                    and all(unicodedata.category(char) != "Cs" for char in name), "attachmentName")
        providers = details["providers"]
        require(isinstance(providers, list) and len(providers) <= 3 and all(isinstance(row, dict) for row in providers), "providers")
        require(len({provider_report(row, schema) for row in providers}) == len(providers), "duplicate provider")
    if schema == 2:
        require(any(row.get("detections") for row in event.get("details", {}).get("providers", [])), "missing detections")
    return event


def visible(value):
    return "".join(f"\\u{ord(char):04x}" if unicodedata.category(char) in {"Cc", "Cf", "Cs"} else char
                   for char in str(value))


def timestamp(value):
    return value.replace("T", " ").removesuffix("Z") + " UTC"


def add_fields(rows, record, definitions):
    for key, label, format_value in definitions:
        if key in record:
            rows.append((label, format_value(record[key])))


def build_mail(event, device, sender, recipient):
    finding = FINDINGS[event["finding"]]
    decision = DECISIONS[event["decision"]]
    details = event.get("details")
    overall = [
        ("Aktion", ACTIONS[event["action"]]), ("Thundy-Befund", finding), ("Regelentscheidung", decision),
        ("Gerät", visible(device)), ("Ereigniszeit", timestamp(event["observedAt"])),
        ("Ereignis-ID", event["id"]), ("Richtlinienrevision", event["policyRevision"]),
        ("Event-Schemaversion", event["schemaVersion"]),
    ]
    def score(value):
        return f"{value} / 100"
    add_fields(overall, event, (("hostname", "Link-Hostname", visible), ("sha256", "Datei-SHA-256", visible)))
    if details is not None:
        add_fields(overall, details, (("attachmentName", "Dateiname", visible), ("reason", "Auslöser", REASONS.get),
                                       ("score", "Entscheidungsscore", score), ("threshold", "Firmenschwelle", score)))
    parts = []
    for row in details["providers"] if details else ():
        rows = [("Urteil", VERDICTS[row["verdict"]]), ("Herkunft", SOURCES[row["source"]])]
        add_fields(rows, row, (("observedAt", "Beobachtungszeit", timestamp), ("score", "Anbieter-Score", score),
                              ("reference", "Anbieterreferenz", visible), ("jobId", "Job-ID", visible),
                              ("maliciousCount", "Bösartige Erkennungen", int),
                              ("suspiciousCount", "Verdächtige Erkennungen", int)))
        for kind, label in DETECTION_KINDS.items():
            values = [DETECTION_CATEGORIES.get(detection["value"], detection["value"]) if kind == "category" else detection["value"]
                      for detection in row.get("detections", ()) if detection["kind"] == kind]
            if values:
                rows.append((label, " · ".join(values)))
        parts.append((PROVIDERS[row["provider"]], rows, row.get("reportUrl")))
    no_providers = ("Thundy hat zu diesem Ereignis keine Anbieterbefunde übermittelt." if details is not None else
                    "Thundy hat eine Basismeldung ohne den optionalen Detailblock übermittelt.")
    text = [f"Thundy AV | {finding} · {decision}", "", *(f"{key}: {value}" for key, value in overall),
            "", "Anbieterbefunde"]
    for title, rows, url in parts:
        text.extend(("", title, *(f"{key}: {value}" for key, value in rows)))
        if url:
            text.append(f"Bericht ansehen: {url}")
    if not parts:
        text.append(no_providers)

    def table(rows):
        return '<table width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;border-collapse:collapse">' + "".join(
            '<tr><th scope="row" width="35%" style="text-align:left;font-weight:600;color:#42556b;padding:9px 10px;border-bottom:1px solid #dbe4ef;vertical-align:top">'
            f'{escape(key)}</th><td style="padding:9px 10px;border-bottom:1px solid #dbe4ef;overflow-wrap:anywhere;word-break:break-word">{escape(str(value))}</td></tr>'
            for key, value in rows) + '</table>'

    cards = []
    for title, rows, url in parts:
        button = (f'<p><a href="{escape(url, quote=True)}" style="display:inline-block;color:#fff;background:#1755a6;'
                  'padding:10px 16px;border-radius:6px;font-weight:bold">Bericht ansehen</a></p>') if url else ""
        cards.append(f'<h3 style="color:#183b61;margin:20px 0 3px">{escape(title)}</h3>{table(rows)}{button}')
    provider_html = "".join(cards) if cards else f"<p>{escape(no_providers)}</p>"
    tone = "#92233b" if event["decision"] == "block" else "#6e430b"
    html = f'''<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#edf2f8;color:#142941;font:15px/1.5 Arial,sans-serif">
<div style="max-width:680px;margin:0 auto;padding:16px">
<div style="background:#162f4c;color:#fff;padding:20px 22px;border-radius:10px 10px 0 0">
<p style="margin:0;color:#d5e4f5;font-weight:bold">Thundy AV · Sicherheitsmeldung</p>
<h1 style="margin:6px 0 0;font-size:26px">{escape(finding)}</h1></div>
<div style="padding:20px 22px;background:#fff;border-radius:0 0 10px 10px">
<p style="margin:0 0 12px;font-weight:bold;color:{tone}">{escape(decision)} · {escape(ACTIONS[event["action"]])}</p>
{table(overall)}<h2 style="font-size:20px;margin:24px 0 0">Anbieterbefunde</h2>{provider_html}</div></div></body></html>'''

    message = EmailMessage()
    message["Subject"] = f"[Thundy AV] {finding} · {decision}"
    message["From"] = sender
    message["To"] = recipient
    message["Date"] = formatdate(usegmt=True)
    message["Message-ID"] = f'<thundy-{event["id"]}@{sender.domain}>'
    message.set_content("\n".join(text))
    message.add_alternative(html, subtype="html")
    return message
