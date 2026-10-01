# Live-Test-Protokoll — Thundy AV in Thunderbird 140 ESR

**Add-on:** Thundy AV – Email Scanner for Thunderbird · Version **1.6** · ID `thundy-av@bludau-it-services.de`
**Bezug:** Aufgabenplan `docs/AUFGABENPLAN_STORE_READINESS.md` — **A-06** (Live-Test, abhängig von A-03/A-04).
**Testdaten:** `testdata/` (Erwartungen je Datei in `testdata/README.md`).

> Dieses Protokoll ist ein **ausfüllbares** Formular. „Erwartung" ist ein Soll-Wert aus Quellcode,
> Reviewer-Notes und Aufgabenplan; **„Ist" trägt der Tester** auf echter Umgebung ein. Solange keine
> Zeile ein „Ist" und einen Status trägt, ist der Live-Test **nicht** durchgeführt. Es werden **keine**
> Ist-Werte vorbelegt.

---

## 1. Kopfzeile (vom Tester auszufüllen)

| Feld | Wert |
|---|---|
| Thunderbird-Version | |
| Thunderbird-Build (UA/`about:support` → „Application Binary") | |
| Betriebssystem + Version | |
| Datum des Tests | |
| Tester (Name/Kürzel) | |
| Add-on-Version | 1.6.4 |
| Add-on-ID | thundy-av@bludau-it-services.de |
| Bezugs-Commit (Repo) | `7b92d58` / Tag `v1.6.4` |
| Testprofil (Name/Pfad) | |
| Verwendeter API-Schlüssel (Anbieter/Art) | |
| Datenschutz-Stufe(n) im Test | ☐ strict ☐ balanced ☐ max |

## 1.1 Schritt 0 (neu, 5 Minuten): Selbsttest ausführen

Vor der manuellen Prüfung den eingebauten Selbsttest laufen lassen. Er deckt in der echten Installation
ab, was sonst nur mit gemockten APIs geprüft wäre:

1. Add-on laden (Abschnitt 2), Optionen öffnen (☰ → Add-ons und Themes → Thundy AV → Einstellungen).
2. Abschnitt **„Selbsttest & Diagnose“** → **„Selbsttest ausführen“**.
3. Erwartet: Tabelle mit **PASS** je Prüfung; „HINWEIS“ ist zulässig (z. B. keine Nachricht geöffnet,
   fehlende Host-Berechtigung bei hinterlegtem Schlüssel). **FEHLER** ist ein Live-Test-Fehlschlag und
   im Abschnitt „Gefundene Fehler“ zu erfassen.
4. Für die Prüfung `injection.messageDisplay` eine Nachricht öffnen und den Selbsttest erneut ausführen —
   sie muss dann `PASS` melden (Prüfskript wurde injiziert und hat sein Ergebnis zurückgegeben).
5. Bericht mit **„Bericht kopieren“** oder **„Bericht speichern“** sichern und unten unter
   „Selbsttest-Bericht“ einfügen.

Der Selbsttest überträgt nichts (synthetische Daten, keine Anbieter-Anfragen). Er ersetzt **nicht** die
visuelle Prüfung der Banner, der Kontextmenüeinträge und der Berechtigungsdialoge — dafür gelten die
Schritte in Abschnitt 3.

## 2. Zweck und Referenzstand

Geprüft wird, was die Unit-Tests mit **gemockten** Thunderbird-APIs **nicht** abdecken können: die
tatsächliche Sichtbarkeit/Funktion der in die Nachrichtenansicht injizierten UI (Opt-in-Banner,
Threat-Banner, Time-of-Click), die Kontextmenüeinträge, der Popup-Bootstrap und die Laufzeit-
Berechtigungs-/Stufen-Gates. Grundlage ist der Aufgabenplan A-06 („Kernfunktion live belegt") und die
in `docs/reviewer_notes.md` §8 beschriebene Vorgehensweise.

**Referenzstand des Codes:** Basis `b5734b6`. Hinweis für den Tester: A-04/A-05/A-08/A-10 wurden auf
diesem Stand gerade umgesetzt (u. a. `TIER_REQUIRES_MAX`, `TIER_BLOCKS_UPLOAD`, `HOST_PERMISSION_MISSING`,
`menus`-Berechtigung). Weicht der getestete Commit ab, oben eintragen.

## 3. Ladeanleitung

**Variante A — temporäres Add-on (empfohlen für den Live-Test):**

```text
Thunderbird → ☰ → Add-ons und Themes → Zahnrad-Symbol → "Add-ons debuggen"
(öffnet about:debugging#/runtime/this-thunderbird)
→ "Temporäres Add-on laden…" → im Dateidialog manifest.json im Repo-Wurzelverzeichnis auswählen
```

Temporäre Add-ons werden beim Beenden von Thunderbird entfernt und müssen danach neu geladen werden.
Der Inspect-Link des Eintrags öffnet die Konsole des Hintergrundskripts.

**Variante B — Thunderbird über web-ext starten:**

```bash
npx web-ext run --firefox=/pfad/zu/thunderbird
# optional mit eigenem Profil:
npx web-ext run --firefox=/pfad/zu/thunderbird --firefox-profile=/pfad/zum/testprofil
```

`web-ext` kennt **kein** `--target thunderbird`; der Pfad zur Thunderbird-Binärdatei wird über
`--firefox` übergeben (vgl. `docs/quickstart.md` §6). Variante C (gebautes, unsigniertes XPI installieren)
erfordert `xpinstall.signatures.required = false` und ist für den Review-Test **nicht** nötig.

## 4. Testumgebung und Testdaten

1. **Frisches Testprofil** anlegen (keine weiteren Nachrichten), damit „erste Kommunikation" (Score-
   Bestandteil in Datei 03/04/05) reproduzierbar ist.
2. In Thunderbird einen **lokalen Ordner** „Thundy-Testdaten" anlegen und die fünf `.eml`-Dateien aus
   `testdata/` als Nachrichten importieren (Drag & Drop der Dateien in den Ordner; alternativ die
   „Nachricht importieren"-Funktion). Danach die Nachrichten einzeln in einem neuen Fenster öffnen.
3. Die Zuordnung Motiv → Datei → erwarteter Anzeige steht in `testdata/README.md` §3. Jede `.eml` wurde
   dort mit `tools/validate-eml.dev.py` technisch validiert (43 Prüfungen, 0 Fehler).

| Datei | Rolle im Live-Test |
|---|---|
| `testdata/01-harmless-attachment.eml` | Banner-Erscheinen, beide Banner-Buttons, Stufen-Gate |
| `testdata/02-html-attachment.eml` | HTML entschärfen; Anhang ohne Skriptausführung |
| `testdata/03-risky-urgency-link.eml` | Threat-Banner, Time-of-Click, Tracking-Parameter in `max` |
| `testdata/04-sender-mismatch.eml` | Threat-Banner über Reply-To-Diskrepanz + `Received`-IP |
| `testdata/05-spoofed-display-name.eml` | Anzeigename-Spoofing (manuelle Sichtprüfung) |

Alle Testinhalte sind erfunden; Absender nutzen reservierte Beispiel-Domains, IPs liegen in RFC-5737-
Testnetzen (`198.51.100.0/24`, `203.0.113.0/24`). Es besteht kein Personenbezug.

## 5. Erwartete Netzwerkziele (vollständige Liste)

Ohne globale Zustimmung („Externe Analyse erlauben" = AUS) darf **kein** Ziel angesprochen werden.
Nach Zustimmung sind ausschließlich folgende HTTPS-Ziele zulässig (vgl. `docs/reviewer_notes.md` §7):

| Ziel | Methode | Stufe/Bedingung | Löst aus |
|---|---|---|---|
| `https://hybrid-analysis.com/api/v2/overview/<sha256>` | GET | `strict` + | Hash-Lookup (nur bei nicht-text Anhängen) |
| `https://hybrid-analysis.com/api/v2/quick-scan/file` | POST (multipart) | `balanced`/`max` | Upload unbekannter Anhänge (auch manuell) |
| `https://hybrid-analysis.com/api/v2/quick-scan/url` | POST | **nur `max`** | URL-Upload (automatisch + manuell) |
| `https://www.virustotal.com/api/v3/files/<sha256>` | GET | nur mit VT-Schlüssel | Datei-Reputation |
| `https://www.virustotal.com/api/v3/ip_addresses/<ip>` | GET | nur mit VT als IP-Anbieter | IP-Reputation |
| `https://urlscan.io/api/v1/scan/` | POST | nur mit urlscan-Schlüssel | Time-of-Click-Livescan |
| `https://urlscan.io/api/v1/result/<uuid>/` | GET | nur mit urlscan-Schlüssel | Ergebnis zum Livescan |
| `https://urlhaus-api.abuse.ch/v1/host/` | POST | nur mit URLhaus-Schlüssel | Domain-Prüfung (nur Hostname) |
| `https://api.abuseipdb.com/api/v2/check?ipAddress=<ip>` | GET | nur mit AbuseIPDB als IP-Anbieter | IP-Reputation |

Host-Berechtigungen liegen in `optional_host_permissions` und werden erst beim Speichern eines
Anbieter-Schlüssels angefragt. **Ohne erteilte Host-Berechtigung** erfolgt kein Aufruf; es greift
`HOST_PERMISSION_MISSING` (Schritt §9.11).

## 6. Nachweis-Werkzeuge

- **Konsole des Hintergrundskripts:** `about:debugging#/runtime/this-thunderbird` → beim Add-on „Inspect".
- **Konsole des Popups:** Popup öffnen, dann im Fenster „Inspect" das Popup-Dokument wählen.
- **Netzwerk-Mitschnitt:** Entwicklerwerkzeuge des Hintergrund-/Popup-Dokuments → Tab „Netzwerk"; jede
  Anfrage an ein Ziel aus §5 wird dort mit Methode und Ziel dokumentiert. Alternativ ein lokaler
  Proxy/`mitmproxy` (Zertifikat nötig) — für die Abwesenheit von Requests reicht der Netzwerk-Tab.
- **Gespeicherter Zustand:** `about:debugging` → Add-on → „Inspect" → Storage → `browser.storage.local`
  (u. a. `scanningEnabledSenders`, `externalAnalysisConsent`, `privacyTier`) und IndexedDB
  `thunderbird_av` (Objektspeicher `hybridanalysis`).

## 7. Legende und Statusregeln

- **Status:** `OK` = Ist stimmt mit Erwartung überein; `FAIL` = Abweichung (Fehler als Task erfassen);
  `N/A` = nicht ausführbar (Grund in „Ist"), `OFFEN` = noch nicht getestet.
- **Nachweis:** Screenshot-Dateiname (z. B. `docs/screenshots/live-9.1.png`) **oder** kopierte
  Konsolen-/Netzwerkzeile.
- Ein Lauf gilt nur als bestanden, wenn **alle** Zeilen `OK` (oder begründet `N/A`) sind — vgl. DoD A-06.

## 8. Vorbereitung (Checkliste)

- [ ] Testprofil frisch, nur die fünf `testdata/*.eml` importiert.
- [ ] Add-on geladen (Variante A oder B); Konsolen beider Dokumente erreichbar.
- [ ] Ausgangszustand notiert: Zustimmung AUS, kein Schlüssel, Stufe `strict`, `scanningEnabledSenders` leer.
- [ ] Netzwerk-Tab aktiv, bevor die erste Testnachricht geöffnet wird.

---

## 9. Testschritte

Ausgangszustand für alle Schritte, sofern nicht anders angegeben: Zustimmung **AUS**, kein Schlüssel,
Stufe `strict`, `scanningEnabledSenders` leer. „Erwartung" = Soll; „Ist" trägt der Tester ein.

| Schritt | Erwartung | Ist | Status (OK/FAIL) | Nachweis (Screenshot/Konsolenzeile) |
|---|---|---|---|---|
| **9.1** Banner erscheint bei Nachricht mit Anhang | (a) Beim Öffnen von `01-harmless-attachment.eml` erscheint **oberhalb** der Nachricht das Opt-in-Banner `#thundy-optin-banner` (gelb) mit Text „Thundy AV: Echtzeit-Scan ist für diese Nachricht nicht aktiviert." (b) Es zeigt beide Buttons (siehe 9.2/9.4) und den Hinweis, dass ohne Zustimmung nichts übertragen wird. (c) Konsole des Hintergrundskripts enthält **keinen** Injektionsfehler (`Injecting into the message display failed`). (d) Bei mehreren gleichzeitig angezeigten Nachrichten (MessageList) wird der Handler je Nachricht ausgeführt, ohne Fehler. | | | |
| **9.2** Button „Nur diese Nachricht scannen" (einmalig) | (a) Buttontext wechselt zu „Scannen…" und danach zu „Scan abgeschlossen" — **ohne** Zustimmung stattdessen Meldung „Externe Analyse ist in den Einstellungen deaktiviert – es wurden keine Daten übertragen." (b) Es erfolgt **kein** Netzwerk-Request an ein Ziel aus §5. (c) Wird dieselbe/andere Nachricht desselben Absenders erneut geöffnet, erscheint das Opt-in-Banner **erneut** (kein Eintrag in `scanningEnabledSenders`). | | | |
| **9.3** Threat-Banner | (a) Beim Öffnen von `04-sender-mismatch.eml` erscheint `#thundy-threat-banner` (rot) mit „Thundy AV Warnung (Risikobewertung: 60 von 100)" und der Begründung „Diskrepanz erkannt: ‚Reply-To'-Domain (other-mail.example.net) weicht von der Absender-Domain (example.com) ab." (b) `03-risky-urgency-link.eml` und `05-spoofed-display-name.eml` zeigen Score 50 mit Dringlichkeits-Begründung. (c) `01`/`02` zeigen **keinen** Threat-Banner (Score 10). | | | |
| **9.4** Button „Absender dauerhaft scannen" (persistent) | (a) Mit erteilter Zustimmung löst der Button einen Scan aus und danach den Hinweis „Dieser Absender wird jetzt automatisch gescannt." (b) Absender-E-Mail steht in `storage.local.scanningEnabledSenders` (Nachweis in §6). (c) Erneutes Öffnen einer Nachricht dieses Absenders zeigt **kein** Opt-in-Banner mehr, solange Zustimmung + Schlüssel + Host-Berechtigung vorhanden sind. (d) Ohne Zustimmung passiert **nichts** (Meldung aus 9.2(a)) — der Absender wird dann **nicht** gespeichert. | | | |
| **9.5** Time-of-Click-Hinweis | (a) In `03-risky-urgency-link.eml` erhalten alle `http…`-Links im Nachrichtentext eine gestrichelte orange Unterstreichung und den Tooltip „Protected by Thundy Time-of-Click". (b) Steuerung über Option „Time-of-Click Protection optisch im E-Mail-Text anzeigen" (Default an); bei aktivem „Auto-Scan-Links" ist sie deaktiviert. (c) Ohne Links (z. B. `01`) kein Marker. | | | |
| **9.6** Popup lädt Analysebereich, ohne Zustimmung kein Request | (a) Klick auf den `message_display_action`-Button öffnet `popup.html`; der Analysebereich lädt, Betreff/Von/MessageHeaderID werden angezeigt. (b) In der Popup-Konsole erscheint **kein** `ReferenceError` (insbesondere kein `syncFragment`/`container` undefined — Befund P0-9/A-09). (c) Bei Zustimmung AUS erzeugt das Laden/Anzeigen des Popups **keinen** Netzwerk-Request an ein Ziel aus §5. | | | |
| **9.7** Kontextmenüeinträge (Link-Kontext + „Alle Links dieser Nachricht scannen") | (a) Rechtsklick auf einen Link in `03-risky-urgency-link.eml` zeigt „Link mit Thundy AV scannen"; Klick startet den URL-Scan bzw. eine klare Fehlermeldung (Zustimmung/Berechtigung/Stufe). (b) Das Kontextmenü der Nachrichtenansicht (`message_display_action`) enthält „Alle Links dieser Nachricht scannen"; Klick liefert die Benachrichtigung „Scan erfolgreich eingereicht. Job ID: …" bzw. „In dieser Nachricht wurden keine Links gefunden." (c) Voraussetzung ist die `menus`-Berechtigung (Befund P0-8/A-10); fehlt sie, erscheinen die Einträge nicht. | | | |
| **9.8** Permission-Anfrage aus dem Banner | (a) Mit Zustimmung + API-Schlüssel, aber **ohne** erteilte Hybrid-Analysis-Host-Berechtigung: Klick auf einen Banner-Button löst die Thunderbird-Berechtigungsabfrage für `https://hybrid-analysis.com/*` aus (`permissions.request`). (b) Bei „Erlauben" läuft der Scan weiter. (c) Bei „Ablehnen" meldet der Button „Erforderliche Host-Berechtigung wurde verweigert" (`bannerPermissionDenied`). (d) Erscheint **keine** Abfrage (fehlender Gestenkontext, Befund P2-23), ist das ein FAIL und als Task zu erfassen. | | | |
| **9.9** Stufen-Gate (in `strict` sind manueller Upload/URL-Scan deaktiviert) | In Stufe `strict`: (a) Manueller Anhang-Upload im Popup wird **ohne** Netzwerk-Request abgelehnt mit der Meldung „Der Upload von Anhängen ist in der Datenschutz-Stufe ‚Strikt' deaktiviert. …" (`TIER_BLOCKS_UPLOAD`/`errorTierUploadBlocked`). (b) Manueller URL-Scan bzw. „Link scannen" wird abgelehnt mit „Das Übermitteln von URLs ist nur in der Datenschutz-Stufe ‚Maximal' erlaubt. …" (`TIER_REQUIRES_MAX`/`errorTierUrlScanBlocked`). (c) In `balanced`: Upload erlaubt (`POST quick-scan/file`), URL-Scan weiter blockiert. (d) In `max`: beides erlaubt; bei `03` wird die **vollständige** URL inkl. `?uid=123` übertragen (Datenschutz-Restrisiko, dokumentieren). (e) Der automatische Banner-Scan von `01`/`02` überträgt **nichts** (Text-Anhänge werden übersprungen). | | | |
| **9.10** HTML entschärfen | (a) Für den HTML-Anhang aus `02-html-attachment.eml` erzeugt die Aktion „HTML entschärfen" eine entschärfte Kopie (`downloads.download`, Dateiname `disarmed_bericht.html`, Speicher-Dialog „saveAs"). (b) In der Kopie sind `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<meta>` (inkl. `refresh`), `<applet>`, `<link>` sowie alle `on*`-Attribute und `javascript:`/`data:`-URLs entfernt. (c) Beim Anzeigen des Originalanhangs führt Thunderbird dessen Skript **nicht** aus (kein `alert`, kein Redirect) — der Anhang wird nicht als aktiver Inhalt gerendert. | | | |
| **9.11** Entzug der Host-Berechtigung → klare Fehlermeldung | (a) Nach Entzug der Host-Berechtigung (`about:addons` → Add-on → Berechtigungen, oder `permissions.remove`) liefert ein Scan-Aufruf den Code `HOST_PERMISSION_MISSING` mit der Meldung „Die Host-Berechtigung für den Analyse-Dienst fehlt. Bitte in den Einstellungen des Add-ons erteilen." (b) Es erscheint **kein** kryptischer Netzwerkfehler und **kein** stiller Fehlschlag. | | | |
| **9.12** Leeren des Caches | (a) In den Einstellungen „Cache leeren" + Bestätigungsdialog leert den IndexedDB-Objektspeicher `hybridanalysis` (DB `thunderbird_av`, Version 3); es erscheint „Cache erfolgreich geleert." (b) Einstellungen und Zustimmung bleiben erhalten. (c) Zuvor angezeigte Scan-Ergebnisse sind danach nicht mehr vorhanden. | | | |
| **9.13** Mehrere Nachrichten gleichzeitig (MessageList) | (a) Bei einer Nachrichtenliste mit mehreren Nachrichten (z. B. Ordner mit allen fünf Testdateien) wird für jede angezeigte Nachricht genau **ein** Opt-in-/Threat-Banner erzeugt (keine Duplikate, da `#thundy-optin-banner`/`#thundy-threat-banner` vor dem Einfügen auf Existenz geprüft werden). (b) Wechsel zwischen Nachrichten löst **keinen** `TypeError`/`ReferenceError` aus (`getDisplayedMessages` liefert eine MessageList). | | | |

---

## 10. Abschluss

- **Ergebnis:** ☐ alle Schritte OK ☐ Fehlschläge vorhanden (siehe unten)
- **Summe:** __ OK / __ FAIL / __ N/A / __ OFFEN — vom Tester zu zählen.
- **Gefundene Fehler** (je FAIL ein Eintrag; im Anschluss als Task im Aufgabenplan erfassen):

| Nr. | Schritt | Symptom | Schwere | Task-ID |
|---|---|---|---|---|
| | | | | |
| | | | | |

- **Anhänge:** Screenshots und kopierte Konsolen-/Netzwerkzeilen zu den Schritten 9.1–9.13.
- **Hinweis zur Vollständigkeit:** Dieses Protokoll deckt nur die ohne Thunderbird-GUI **nicht**
  prüfbaren Punkte ab. Die reinen Datei-/Parsing-Eigenschaften der Testdaten sind in
  `testdata/README.md` §4 (technische Validierung) nachgewiesen.
- **Version/Commit dieses Protokolls:** Bezug `b5734b6` (siehe §1/§2); bei abweichendem Test-Commit dort aktualisieren.

## 8. Selbsttest-Bericht (aus Schritt 0 einfügen)

```text
(hier den kopierten Bericht einfügen)
```
