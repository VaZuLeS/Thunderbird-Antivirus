#!/usr/bin/env python3
"""Technische Validierung der Reviewer-Testdaten (testdata/*.eml).

Beweist mit der Python-Standardbibliothek ``email`` (``policy=default``), dass
jede Testnachricht gueltiges MIME ist und genau die Eigenschaft traegt, die sie
laut testdata/README.md dokumentiert (Absender, Anhaenge, Links, Header).

Aufruf:  python3 tools/validate-eml.dev.py   (aus dem Repository-Wurzelverzeichnis)
Exit-Code: 0 = alle Pruefungen bestanden, 1 = mindestens eine Pruefung fehlgeschlagen.
Es findet kein Netzwerkzugriff und keine Codeausfuehrung (kein eval/exec) statt.
"""
from __future__ import annotations

import pathlib
import re
import sys
from email import policy
from email.parser import BytesParser

BASE = pathlib.Path(__file__).resolve().parent.parent / "testdata"
URL_RE = re.compile(r"https?://[^\s<>\"')]+")
CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")

results: list[tuple[str, str, bool]] = []


def check(fid: str, desc: str, cond: bool) -> None:
    """Protokolliert eine einzelne Pruefung (Datei, Beschreibung, Ergebnis)."""
    results.append((fid, desc, bool(cond)))


def parse(name: str):
    """Parst eine .eml-Datei als Bytes mit policy=default (RFC-konform, Unicode)."""
    with open(BASE / name, "rb") as handle:
        return BytesParser(policy=policy.default).parse(handle)


def all_body_text(msg) -> str:
    """Sammelt den dekodierten Text aller text/plain- und text/html-Teile."""
    chunks = []
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        if part.get_content_type() in ("text/plain", "text/html"):
            chunks.append(part.get_content())
    return "\n".join(chunks)


def attachments(msg):
    """Liefert (Dateiname, Content-Type, Inhalt) aller Anhaenge."""
    found = []
    for part in msg.walk():
        if part.get_content_disposition() == "attachment":
            found.append((part.get_filename(), part.get_content_type(), part.get_content()))
    return found


def body_plain(msg) -> str:
    """Nur die text/plain-Teile (ohne Anhaenge)."""
    chunks = []
    for part in msg.walk():
        if part.get_content_disposition() == "attachment":
            continue
        if part.get_content_type() == "text/plain":
            chunks.append(part.get_content())
    return "\n".join(chunks)


def from_addr(msg):
    """Erste From-Adresse als Address-Objekt (policy=default dekodiert den Anzeigenamen)."""
    return msg["From"].addresses[0]


# --------------------------------------------------------------------------
# 01-harmless-attachment.eml
# --------------------------------------------------------------------------
m = parse("01-harmless-attachment.eml")
fa = from_addr(m)
check("01", "parst ohne Defekte", not m.defects)
check("01", "MIME-Version: 1.0 gesetzt", m.get("MIME-Version") == "1.0")
check("01", "Empfaenger = test@example.com", str(m["To"]) == "test@example.com")
check("01", "Absenderadresse = anna.beispiel@example.org", fa.addr_spec == "anna.beispiel@example.org")
check("01", "genau 1 Anhang", len(attachments(m)) == 1)
att = attachments(m)
check("01", "Anhang heisst notizen.txt", bool(att) and att[0][0] == "notizen.txt")
check("01", "Anhang ist text/plain", bool(att) and att[0][1] == "text/plain")
check("01", "Anhang enthaelt Klartext, kein Markup",
      bool(att) and "<" not in att[0][2] and "script" not in att[0][2].lower())
check("01", "Textrumpf enthaelt keinen Link", URL_RE.search(all_body_text(m)) is None)

# --------------------------------------------------------------------------
# 02-html-attachment.eml
# --------------------------------------------------------------------------
m = parse("02-html-attachment.eml")
check("02", "parst ohne Defekte", not m.defects)
check("02", "genau 1 Anhang", len(attachments(m)) == 1)
att = attachments(m)
check("02", "Anhang heisst bericht.html", bool(att) and att[0][0] == "bericht.html")
check("02", "Anhang ist text/html", bool(att) and att[0][1] == "text/html")
html = att[0][2] if att else ""
check("02", "HTML enthaelt <script>", "<script>" in html)
check("02", "HTML enthaelt onclick-Handler", "onclick=" in html)
check("02", "HTML enthaelt javascript:-URL", "javascript:" in html)
check("02", "HTML enthaelt meta-refresh", 'http-equiv="refresh"' in html)
check("02", "HTML enthaelt <iframe>", "<iframe" in html)
check("02", "HTML enthaelt <object>/<embed>/<base>",
      all(t in html for t in ("<object", "<embed", "<base")))
check("02", "Textrumpf (text/plain) vorhanden", bool(body_plain(m).strip()))
check("02", "HTML-Anhang wird nicht ausgefuehrt (nur statisch geparst)",
      "javascript:" not in body_plain(m).lower())

# --------------------------------------------------------------------------
# 03-risky-urgency-link.eml
# --------------------------------------------------------------------------
m = parse("03-risky-urgency-link.eml")
check("03", "parst ohne Defekte", not m.defects)
body = all_body_text(m)
links = sorted(set(URL_RE.findall(body)))
check("03", "genau 0 Anhaenge", len(attachments(m)) == 0)
check("03", "mindestens 3 verschiedene http(s)-Links", len(links) >= 3)
check("03", "mindestens ein Link mit Tracking-Parameter ?uid=123",
      any("uid=123" in u for u in links))
plain_lower = body_plain(m).lower()
urgency = [w for w in ("rechnung", "sofort", "fällig", "überweisung", "dringend") if w in plain_lower]
check("03", "enthaelt Dringlichkeits-/Zahlungsworte (>=4)", len(urgency) >= 4)
check("03", "Betreff beginnt mit Dringend:", str(m["Subject"]).startswith("Dringend:"))
check("03", "enthaelt mindestens einen http:-Link", any(u.startswith("http://") for u in links))


# --------------------------------------------------------------------------
# 04-sender-mismatch.eml
# --------------------------------------------------------------------------
m = parse("04-sender-mismatch.eml")
fa = from_addr(m)
reply = m["Reply-To"].addresses[0]
received = "\n".join(m.get_all("Received") or [])
check("04", "parst ohne Defekte", not m.defects)
check("04", "From-Domain A = example.com", fa.domain == "example.com")
check("04", "Reply-To-Domain B = other-mail.example.net", reply.domain == "other-mail.example.net")
check("04", "From- und Reply-To-Domain weichen ab", fa.domain != reply.domain)
check("04", "Received-Header vorhanden", len(m.get_all("Received") or []) >= 1)
check("04", "Received enthaelt oeffentliche IP 203.0.113.7", "203.0.113.7" in received)
check("04", "Testnetz-Hinweis: 203.0.113.0/24 ist TEST-NET-3 (RFC 5737)",
      "203.0.113." in received)
check("04", "genau 0 Anhaenge", len(attachments(m)) == 0)

# --------------------------------------------------------------------------
# 05-spoofed-display-name.eml
# --------------------------------------------------------------------------
m = parse("05-spoofed-display-name.eml")
fa = from_addr(m)
check("05", "parst ohne Defekte", not m.defects)
check("05", "Anzeigename enthaelt Markenbestandteile 'rosoft' + '365'",
      "rosoft" in fa.display_name and "365" in fa.display_name)
check("05", "Anzeigename enthaelt Homoglyph (kyrillisches Zeichen)",
      bool(CYRILLIC_RE.search(fa.display_name)))
check("05", "Adresse ist NICHT microsoft.com", fa.domain != "microsoft.com")
check("05", "Adresse = no-reply@secure-microsoft365.example",
      fa.addr_spec == "no-reply@secure-microsoft365.example")
check("05", "Anzeigename weicht von echter Adresse ab (Spoofing)",
      fa.display_name.lower().strip() not in fa.addr_spec)
check("05", "Textrumpf enthaelt einen Link mit ?uid=123",
      any("uid=123" in u for u in URL_RE.findall(all_body_text(m))))

# --------------------------------------------------------------------------
# Ausgabe
# --------------------------------------------------------------------------
print(f"{'Datei':<5} {'Ergebnis':<8} Pruefung")
print("-" * 78)
failed = 0
for fid, desc, ok in results:
    if not ok:
        failed += 1
    print(f"{fid:<5} {'OK' if ok else 'FAIL':<8} {desc}")
print("-" * 78)
print(f"{len(results)} Pruefungen, {failed} fehlgeschlagen.")
sys.exit(1 if failed else 0)
