# Reviewer-Testmittel — Thundy AV (Testdaten)

**Bezug:** Aufgabenplan `docs/AUFGABENPLAN_STORE_READINESS.md` — **A-14** (Reviewer-Testmittel),
**A-03** (Testumgebung), **A-06** (Live-Test).
**Add-on:** Thundy AV – Email Scanner for Thunderbird, Version 1.6 (Thunderbird 140 ESR, MV3).
**Protokoll:** `docs/live_test_protocol.md` (dort werden die hier dokumentierten Erwartungen geprüft).

> **Wichtig — Erwartung, kein Messwert:** Alle Angaben zu „was das Add-on zeigt" sind **Erwartungen**
> (Soll-Verhalten), die aus dem Quellcode, den Reviewer-Notes und dem Aufgabenplan abgeleitet wurden.
> Es ist **noch kein** Thunderbird-Live-Test (A-06) gelaufen; es gibt **keine** gemessenen Ist-Werte.
> Die Ist-Spalte wird ausschließlich im Protokoll `docs/live_test_protocol.md` auf echter Umgebung gefüllt.

---

## 1. Inhalt dieses Verzeichnisses

| Datei | Zweck |
|---|---|
| `01-harmless-attachment.eml` | harmloser Klartext-Anhang, normaler Absender |
| `02-html-attachment.eml` | Text + HTML-Anhang mit aktivem Markup/Skript (Test „HTML entschärfen") |
| `03-risky-urgency-link.eml` | Dringlichkeits-/Zahlungswortlaut und mehrere http(s)-Links inkl. Tracking-Parameter |
| `04-sender-mismatch.eml` | From-Domain A ≠ Reply-To-Domain B, `Received` mit öffentlicher Test-IP |
| `05-spoofed-display-name.eml` | bekannter Anzeigename mit fremder Adresse und Homoglyph-Zeichen |
| `tools/validate-eml.dev.py` | reproduzierbare technische Validierung (Python `email`, `policy=default`) |

Alle Absender, Domains, IP-Adressen und Namen sind **frei erfunden**. Es werden ausschließlich
reservierte Beispiel-Domains (`example.com`, `example.org`, `example.net` und deren Subdomains) und
Dokumentationsnetze (RFC 5737: `198.51.100.0/24`, `203.0.113.0/24`) verwendet. Empfänger ist immer
`test@example.com`. Es besteht **kein Personenbezug**.

## 2. Gemeinsame Annahmen für die Erwartungen

1. Thunderbird **140 ESR** mit **frischem Testprofil**; sonst keine weiteren Nachrichten (relevant für
   „erste Kommunikation", siehe Datei 03/04/05).
2. Standardzustand des Add-ons: **„Externe Analyse erlauben" = AUS**, kein API-Schlüssel, keine
   Host-Berechtigung, keine dauerhafte Absender-Freigabe (`scanningEnabledSenders` leer),
   Datenschutz-Stufe `strict`.
3. „Stufe" meint die Option **Datenschutz-Stufe** (`strict` / `balanced` / `max`), die zusätzlich zur
   globalen Zustimmung gilt (siehe `docs/privacy_policy.md` §3.3/§5, `options.html`).
4. Ein **Text-Anhang** (`text/plain`, `text/html`, `text/css`, `text/csv`, `text/javascript`,
   `application/json`, `application/xml`, `application/xhtml+xml`) wird vom Add-on **nie automatisch**
   an einen Anbieter übermittelt (`process_single_attachment` bricht für diese Typen ab). Die
   Stufen-/Upload-Logik greift für automatische Scans daher nur bei **anderen** Anhangstypen und bei
   **URLs**; der manuelle Pfad (Popup/Kontextmenü) ist separat geregelt (siehe Datensatz 01/02).
5. Bei Zustimmung + API-Schlüssel fragt das Add-on die **Host-Berechtigung** für den genutzten Anbieter
   an; ohne sie schlägt der Aufruf mit dem Typfehler `HOST_PERMISSION_MISSING` fehl (klare Meldung).

---

## 3. Datensätze: Motiv → Datei → Anzeige → Erwartung je Stufe → Protokollschritt

Kurzlegende: **S** = `strict`, **B** = `balanced`, **M** = `max`. Die Spalte „Anzeige" nennt die vom
Add-on erwarteten UI-Elemente im Nachrichtenfenster (`#thundy-optin-banner`, `#thundy-threat-banner`,
Time-of-Click-Markierung) bzw. im Popup. Die Stufen-Erwartungen gelten **nur** bei erteilter Zustimmung
+ API-Schlüssel + erteilter Host-Berechtigung; ohne Zustimmung erfolgt in **allen** Stufen kein Netzwerk-Request.

| Motiv | Datei | Was das Add-on damit zeigt (Erwartung) | Erwartung S | Erwartung B | Erwartung M | Live-Test-Schritt |
|---|---|---|---|---|---|---|
| Harmloser Anhang, normaler Absender, kurzer Text | `01-harmless-attachment.eml` | Opt-in-Banner (1 Klartext-Anhang); **kein** Threat-Banner (Score 10/100); **kein** Time-of-Click (keine Links) | keine autom. Übermittlung (Text-Anhang übersprungen); manueller Upload blockiert (`TIER_BLOCKS_UPLOAD`) | wie S; manueller Upload im Popup erlaubt (`POST quick-scan/file`) | wie B (keine Links → kein URL-Upload) | §9.1, §9.4, §9.9 |
| Text + HTML-Anhang mit aktivem Markup/Skript | `02-html-attachment.eml` | Opt-in-Banner (1 Anhang); HTML wird beim Anzeigen **nicht** ausgeführt; Aktion „HTML entschärfen" verfügbar; **kein** Threat-Banner (Score 10/100) | keine autom. Übermittlung (`text/html` übersprungen); manueller Upload blockiert (`TIER_BLOCKS_UPLOAD`) | wie S; manueller Upload der `.html` erlaubt | wie B (keine Body-Links → kein URL-Upload) | §9.10, §9.1, §9.9 |
| Dringlichkeits-/Zahlungstext, mehrere http(s)-Links inkl. `?uid=123` | `03-risky-urgency-link.eml` | Opt-in-Banner; **Threat-Banner** (Score 50/100, Dringlichkeits-Signalwörter); Time-of-Click-Markierung an allen http(s)-Links | kein URL-Upload; nur bei vorhandenem URLhaus-Schlüssel: Domain-Prüfung (sendet nur die Domain); manueller URL-Scan blockiert (`TIER_REQUIRES_MAX`) | wie S (Links werden automatisch erst ab M übermittelt) | autom. `POST quick-scan/url` je Link — **inkl. `?uid=123`** (Datenschutz-Restrisiko, §5) | §9.5, §9.7, §9.9 |
| From-Domain A ≠ Reply-To-Domain B, `Received` mit öffentlicher IP | `04-sender-mismatch.eml` | **Threat-Banner** (Score 60/100: Reply-To-Diskrepanz + Erskontakt); **kein** Opt-in-Banner (keine Anhänge/Links); Popup zeigt From/Reply-To/MessageHeaderID | kein autom. Transfer (keine Anhänge/Links) | wie S | wie S (keine Links) | §9.3, §9.6 |
| Bekannter Anzeigename mit fremder Adresse + Homoglyph | `05-spoofed-display-name.eml` | Opt-in-Banner (1 Link); **Threat-Banner** (Score 50/100: Dringlichkeit „Konto" + Erskontakt); Homoglyph wird **nicht** automatisch erkannt (manuelle Sichtprüfung, §5) | kein URL-Upload; manueller URL-Scan blockiert | wie S | autom. `POST quick-scan/url` des Login-Links (inkl. `?uid=123`) | §9.3, §9.6, §9.9 |

**Zusatzhinweise zu den Stufen (aus dem Quellcode abgeleitet):**

- `strict` < `balanced` < `max` (`TIER_ORDER`); die Stufe gilt für automatische **und** manuelle Scans.
- Manueller Anhang-Upload (`handleManualUpload`) verlangt `balanced` oder höher → in `strict`
  Fehlercode `TIER_BLOCKS_UPLOAD` mit der Meldung aus `errorTierUploadBlocked`.
- Manueller/automatischer URL-Upload (`handleUrlScan`) verlangt `max` → sonst
  Fehlercode `TIER_REQUIRES_MAX` (`errorTierUrlScanBlocked`).
- Ohne Host-Berechtigung: `HOST_PERMISSION_MISSING` (`errorHostPermissionMissing`).
- Ohne globale Zustimmung: `EXTERNAL_ANALYSIS_DISABLED` (`bannerConsentMissing`) — es wird nichts übertragen.

---

## 4. Technische Validierung (gemessen, reproduzierbar)

Da kein Thunderbird-Live-Test gelaufen ist, ist die **einzige gemessene** Aussage dieses Dokuments die
technische Validierung der Rohdateien: dass jede `.eml` gültiges MIME ist und die beworbene Eigenschaft
tatsächlich trägt. Beweis mit der Python-Standardbibliothek (`email`, `policy=default`), **ohne**
Netzwerkzugriff und **ohne** Codeausführung aus den Nachrichten.

```bash
python3 tools/validate-eml.dev.py
```

Ergebnis (Auszug = vollständiger Lauf, Stand der Dateien in diesem Commit):

```text
Datei Ergebnis Pruefung
------------------------------------------------------------------------------
01    OK       parst ohne Defekte
01    OK       MIME-Version: 1.0 gesetzt
01    OK       Empfaenger = test@example.com
01    OK       Absenderadresse = anna.beispiel@example.org
01    OK       genau 1 Anhang
01    OK       Anhang heisst notizen.txt
01    OK       Anhang ist text/plain
01    OK       Anhang enthaelt Klartext, kein Markup
01    OK       Textrumpf enthaelt keinen Link
02    OK       parst ohne Defekte
02    OK       genau 1 Anhang
02    OK       Anhang heisst bericht.html
02    OK       Anhang ist text/html
02    OK       HTML enthaelt <script>
02    OK       HTML enthaelt onclick-Handler
02    OK       HTML enthaelt javascript:-URL
02    OK       HTML enthaelt meta-refresh
02    OK       HTML enthaelt <iframe>
02    OK       HTML enthaelt <object>/<embed>/<base>
02    OK       Textrumpf (text/plain) vorhanden
02    OK       HTML-Anhang wird nicht ausgefuehrt (nur statisch geparst)
03    OK       parst ohne Defekte
03    OK       genau 0 Anhaenge
03    OK       mindestens 3 verschiedene http(s)-Links
03    OK       mindestens ein Link mit Tracking-Parameter ?uid=123
03    OK       enthaelt Dringlichkeits-/Zahlungsworte (>=4)
03    OK       Betreff beginnt mit Dringend:
03    OK       enthaelt mindestens einen http:-Link
04    OK       parst ohne Defekte
04    OK       From-Domain A = example.com
04    OK       Reply-To-Domain B = other-mail.example.net
04    OK       From- und Reply-To-Domain weichen ab
04    OK       Received-Header vorhanden
04    OK       Received enthaelt oeffentliche IP 203.0.113.7
04    OK       Testnetz-Hinweis: 203.0.113.0/24 ist TEST-NET-3 (RFC 5737)
04    OK       genau 0 Anhaenge
05    OK       parst ohne Defekte
05    OK       Anzeigename enthaelt Markenbestandteile 'rosoft' + '365'
05    OK       Anzeigename enthaelt Homoglyph (kyrillisches Zeichen)
05    OK       Adresse ist NICHT microsoft.com
05    OK       Adresse = no-reply@secure-microsoft365.example
05    OK       Anzeigename weicht von echter Adresse ab (Spoofing)
05    OK       Textrumpf enthaelt einen Link mit ?uid=123
------------------------------------------------------------------------------
43 Pruefungen, 0 fehlgeschlagen.
```

Der Anzeigename in Datei 05 wurde beim Parsen zu `Мiсrosoft 365 (Sicherheitsteam)` dekodiert; die
„M" (U+041C) und „c" (U+0441) sind **kyrillische** Homoglyphen der lateinischen Buchstaben. Die
Prüfroutine weist das über `[\u0400-\u04FF]` nach.

## 5. Datenschutz- und Restrisiko-Hinweise (bewusst offengelegt)

- **Test-IP `203.0.113.7` (Datei 04):** `203.0.113.0/24` ist laut RFC 5737 **TEST-NET-3**, ein
  ausschließlich für Dokumentation reserviertes Netz. Ein echter Reputationsabruf bei einem Anbieter
  (AbuseIPDB/VirusTotal) ist damit **nicht sinnvoll** und liefert keine verwertbare Aussage. Die Datei
  dient nur dem Nachweis, dass das Add-on eine öffentliche Absender-IP aus `Received` erkennt und – bei
  konfiguriertem Anbieter – eine Anfrage auslösen *würde*. Gleiches gilt für `198.51.100.0/24` (TEST-NET-2)
  in den Dateien 01–03.
- **Tracking-Parameter `?uid=123` (Dateien 03 und 05):** In Stufe `max` wird die **komplette URL**
  (inklusive `?uid=123`) an den Analyse-Anbieter übermittelt; das ist ein bewusstes Datenschutz-Restrisiko,
  das im Protokoll sichtbar geprüft wird (Datei 03, Schritt §9.9).
- **URLhaus-Domain-Prüfung stufenunabhängig:** Ist ein URLhaus-Schlüssel konfiguriert, prüft das Add-on
  die *Domain* von Links (`POST https://urlhaus-api.abuse.ch/v1/host/`) auch in `strict`/`balanced` –
  übermittelt wird nur der Hostname, nicht die vollständige URL oder der Pfad.
- **Homoglyph-Anzeigename (Datei 05):** Das Add-on besitzt derzeit **keine** dedizierte Prüfung
  „Anzeigename vs. Adresse". Der Look-alike ist eine **manuelle** Reviewer-Beobachtung; automatisch
  gezeigt wird nur das, was sich aus dem Score ergibt (siehe §3).

## 6. Bezug zu den Live-Test-Schritten

Die Schrittnummern der letzten Spalte in §3 (`§9.x`) verweisen auf `docs/live_test_protocol.md`.
Dort werden die hier dokumentierten **Erwartungen** falsifizierbar gemacht: „Erwartung" steht in der
Tabelle, „Ist" wird vom Tester auf echter Umgebung eingetragen.
