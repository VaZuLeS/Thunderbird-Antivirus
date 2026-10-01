# Datenschutzerklärung — Thundy AV – Email Scanner for Thunderbird

**Add-on:** Thundy AV – Email Scanner for Thunderbird (Kurzname „Thundy AV“), Version 1.6
**Repository:** https://github.com/VaZuLeS/Thunderbird-Antivirus (Lizenz: MIT)
**Stand:** September 2026

Diese Erklärung beschreibt, welche Daten die Thunderbird-Erweiterung „Thundy AV“ verarbeitet,
welche Daten an Dritte übermittelt werden können und unter welchen Bedingungen.

## 1. Verantwortlicher

Jan Bludau (VaZuLeS)
E-Mail: bludau.it.services@gmail.com

Der Verantwortliche betreibt **keine** eigene Serverinfrastruktur für das Add-on. Es gibt keinen
Server des Entwicklers, an den Daten gesendet werden, und keinen Zugriff des Entwicklers auf
Nutzerdaten.

## 2. Kurzfassung

- Das Add-on prüft eine in Thunderbird geöffnete Nachricht auf Sicherheitsrisiken (Anhänge, Links,
  Absenderauffälligkeiten, im Received-Header genannte IP-Adressen). Diese Prüfung läuft lokal in
  Thunderbird.
- Das lokale Lesen der geöffneten Nachricht findet unabhängig von einer Zustimmung statt und
  verlässt den Rechner nicht. Ohne Zustimmung wird **nichts** an Dritte übermittelt.
- Eine Übermittlung an externe Analyse-Dienste findet nur statt, wenn die globale Zustimmung
  „Externe Analyse erlauben“ aktiv ist **und** ein Scan für die betreffende Nachricht bzw. den
  betreffenden Absender ausgelöst wurde.
- Standardmäßig ist die Datenschutz-Stufe „Strikt“ aktiv; dann werden ausschließlich
  SHA-256-Hashes von Anhängen übermittelt.
- Es gibt **keine** Telemetrie, **kein** Analytics, **keine** Nutzungsstatistik, **keine**
  Fehlerberichte an den Entwickler und **keine** Cookies oder Tracker.

## 3. Konsent-Modell

Die Erweiterung verwendet zwei Zustimmungen und eine Datenschutz-Stufe.

### 3.1 Globale Zustimmung „Externe Analyse erlauben“

Diese Zustimmung wird im Optionsdialog der Erweiterung als Checkbox angezeigt und im lokalen
Erweiterungsspeicher (`browser.storage.local`) unter dem Schlüssel `externalAnalysisConsent`
gespeichert. **Standardwert: ausgeschaltet.**

Solange diese Zustimmung nicht erteilt ist, findet **keine** Übermittlung an Dritte statt:

- kein Upload von Anhängen oder Dateiinhalten,
- keine Hash-Abfrage bei Analyse-Diensten,
- keine URL- oder Domain-Abfrage,
- keine Abfrage von IP-Adressen.

Lokale Funktionen (Bewertung des Nachrichtentexts, Auswertung von Kopfzeilen und Anhangsdaten,
Anzeige von Hinweis- und Warnbannern) laufen auch ohne diese Zustimmung.

Die Zustimmung kann jederzeit im Optionsdialog entzogen werden. Durch den Widerruf werden künftige
Übermittlungen gestoppt; bereits übermittelte Daten können dadurch nicht zurückgeholt werden
(Abschnitt 8).

### 3.2 Opt-in je Absender

Unabhängig von der globalen Zustimmung ist für automatisierte Scans ein Opt-in je Absender
erforderlich (Speicherung unter dem Schlüssel `scanningEnabledSenders`). In der Nachrichtenansicht
zeigt die Erweiterung einen Banner mit zwei Schaltflächen:

- **„Nur diese Nachricht scannen“** — einmaliger Scan der geöffneten Nachricht; der Absender wird
  dadurch **nicht** dauerhaft als scanberechtigt gespeichert.
- **„Absender dauerhaft scannen“** — der Absender wird dauerhaft in die Liste der scanberechtigten
  Absender aufgenommen. Nachrichten dieses Absenders werden danach automatisch geprüft, solange die
  globale Zustimmung (3.1) aktiv ist.

### 3.3 Datenschutz-Stufe (`privacyTier`)

Die Datenschutz-Stufe wird im Optionsdialog gewählt und im lokalen Erweiterungsspeicher unter dem
Schlüssel `privacyTier` gespeichert. **Standardwert: „strict“ (Strikt).**

| Stufe | Was zusätzlich übermittelt werden kann |
|---|---|
| `strict` (Strikt) | ausschließlich SHA-256-Hashes von Anhängen. Der **manuelle** Anhang-Upload und der **manuelle** URL-Scan im Popup sind in dieser Stufe deaktiviert und zeigen einen Hinweis („In Stufe Strikt deaktiviert – in den Einstellungen auf Ausgewogen/Maximal umstellen“). |
| `balanced` (Ausgewogen) | zusätzlich vollständige Anhänge unbekannter Dateien an Hybrid Analysis — beim automatischen Scan **und** über den manuellen Anhang-Upload im Popup. |
| `max` (Maximal) | zusätzlich URLs aus der Nachricht an Hybrid Analysis — automatisch **und** über den manuellen URL-Scan im Popup. |

Die Stufe begrenzt **jeden** Übermittlungspfad, nicht nur den automatischen Scan: Ein vollständiger
Anhang-Upload ist erst ab `balanced` möglich, ein vollständiger URL-Upload an Hybrid Analysis erst ab
`max`. In `strict` sind die manuellen Upload-Pfade im Popup gar nicht verfügbar (siehe Tabelle).

Unabhängig von der Datenschutz-Stufe gilt: Hash-Abfragen (SHA-256) sowie die Prüfung von Domains
über URLhaus, von Links über urlscan.io und die Reputationsprüfung von IP-Adressen bleiben möglich,
sofern für den jeweiligen Dienst ein Schlüssel konfiguriert ist und die globale Zustimmung (3.1)
aktiv ist. Die IP-Reputationsprüfung findet nur statt, wenn dafür ausdrücklich ein Anbieter und ein
Schlüssel hinterlegt wurden; standardmäßig ist sie nicht konfiguriert.

### 3.4 Daten-Deklaration und Berechtigung `sensitiveDataUpload`

Im Manifest (`manifest.json`) ist die Daten-Deklaration wie folgt hinterlegt:

```json
"data_collection_permissions": { "required": ["none"], "optional": ["personalCommunications"] }
```

`required: "none"` bedeutet, dass das Add-on **ohne** die optionale Zustimmung keine der
deklarierten Datenkategorien erhebt oder überträgt. Die Kategorie `personalCommunications` ist
**optional**: Sie wird erst relevant, wenn der Nutzer die externe Analyse freigibt.

Die Zustimmung wird weiterhin über die Optionsseiten-Checkbox **„Externe Analyse erlauben“**
(Standard: aus) eingeholt. Zusätzlich fragt das Add-on in derselben Nutzergeste die optionale
Thunderbird-Berechtigung `sensitiveDataUpload` an; sie ist im Manifest als
`optional_permissions: ["sensitiveDataUpload"]` deklariert und trägt in Thunderbird die Bezeichnung
„sensible Nutzerdaten an einen Remote-Server übertragen“. Die Anfrage erfolgt programmatisch über
`browser.permissions.request({ data_collection: ['personalCommunications'], permissions: ['sensitiveDataUpload'] })`.
Wird die Zustimmung abgeschaltet, entfernt das Add-on die Berechtigung wieder
(`browser.permissions.remove(...)`). Ohne diese optionale Berechtigung findet keine Übermittlung an
Dritte statt.

## 4. Lokal gelesene Daten

Beim Öffnen einer Nachricht liest die Erweiterung in Thunderbird lokal:

- Kopfzeilen der Nachricht (u. a. Absender, Empfänger, Betreff, Datum, Message-ID,
  Received-Header),
- den Nachrichtentext (Text- und HTML-Teil),
- Links/URLs aus dem Nachrichtentext und dem HTML-Teil,
- Anhänge (Dateiname, Dateityp, Größe und Inhalt; der Inhalt wird lokal gehasht).

Diese Verarbeitung dient ausschließlich den Sicherheitsfunktionen und der Anzeige innerhalb von
Thunderbird. Sie ist lokal; ohne Zustimmung werden keine dieser Daten übermittelt. Frühere
Darstellungen, das Add-on lese „keine E-Mail-Inhalte, nur Anhänge“, waren unzutreffend und sind
korrigiert.

## 5. Übermittlung an Dritte — nur bei aktiver globaler Zustimmung

Die folgende Übersicht nennt jede Datenart, die übermittelt werden kann, den Auslöser und den
Empfänger. Jede Übermittlung setzt die globale Zustimmung nach Abschnitt 3.1 voraus.

| Datenart | Wann | Empfänger |
|---|---|---|
| SHA-256-Hash eines Anhangs | Scan eines Anhangs; alle Stufen (`strict`, `balanced`, `max`) | VirusTotal, Hybrid Analysis |
| Vollständiger Anhang (Dateiinhalt, Dateiname, Dateityp, Größe) | nur Stufe `balanced` und `max`; entweder automatisch (wenn zum Hash kein Treffer vorliegt) oder über den **manuellen Anhang-Upload** im Popup | Hybrid Analysis |
| URLs/Links aus der Nachricht, die zur Prüfung anstehen | Stufe `max`; automatisch oder über den **manuellen URL-Scan** im Popup (Hybrid Analysis). urlscan.io-Abfrage sofern ein urlscan.io-Schlüssel konfiguriert ist (in allen Stufen) | Hybrid Analysis, urlscan.io |
| Domains aus dem Nachrichtentext | sofern ein URLhaus-Schlüssel konfiguriert ist | URLhaus (abuse.ch) |
| IP-Adressen aus den Received-Headern | nur sofern ein Anbieter und ein Schlüssel für die IP-Reputation konfiguriert sind | AbuseIPDB, VirusTotal |

Technisch bedingt übermittelt jede HTTP-Anfrage zusätzlich die IP-Adresse des anfragenden Systems
und einen HTTP-User-Agent-String. Die Abfrage bei VirusTotal setzt einen konfigurierten
VirusTotal-Schlüssel voraus; ohne Schlüssel wird kein Hash an VirusTotal übermittelt.

Übermittelte Links können personenbezogene Kennungen enthalten (z. B. Newsletter-Tracking-IDs,
Kampagnen- oder Empfänger-Parameter in der URL); sie werden nur mit Zustimmung und ausgelöstem Scan
übermittelt.

**Nicht übermittelt werden** (unabhängig von der Stufe): der vollständige Nachrichtentext, die
Betreffzeile, Empfänger- und Absenderadressen, Inhalte von Anhängen, die als Klartexttypen
eingestuft sind (z. B. `text/plain`, `text/html`, `application/json`), sowie Einstellungen,
Zustimmungen und API-Schlüssel.

### 5.1 Adressierte Hosts

| Dienst | Adressierte Hosts | Zweck |
|---|---|---|
| Hybrid Analysis | `hybrid-analysis.com` | Datei-/Hash-/URL-Analyse (Sandbox, Multi-Engine) |
| VirusTotal | `www.virustotal.com` | Hash-Abfrage zu Anhängen, IP-Reputation |
| urlscan.io | `urlscan.io` | Analyse/Reputation von Links |
| URLhaus (abuse.ch) | `urlhaus-api.abuse.ch` | Prüfung von Domains gegen Malware-URL-Listen |
| AbuseIPDB | `api.abuseipdb.com` | Reputationsprüfung von IP-Adressen |

## 6. Empfänger und Weiterverarbeitung bei den Anbietern

Empfänger sind ausschließlich die in Abschnitt 5.1 genannten Betreiber der Analyse-Dienste. Sie
verarbeiten die übermittelten Daten als eigenständige Verantwortliche nach ihren eigenen
Datenschutzbestimmungen; diese sind über die jeweiligen Anbieter-Webseiten abrufbar. Die
Verarbeitung kann außerhalb der Europäischen Union bzw. des EWR (insbesondere in den USA)
stattfinden.

Der Verantwortliche des Add-ons:

- hat keinen Zugriff auf die an die Anbieter übermittelten Daten,
- betreibt keine eigene Kopie oder Auswertung dieser Daten,
- erhält von den Anbietern keine personenbezogenen Daten zurück, die über das für die Anzeige des
  Prüfergebnisses nötige Maß hinausgehen (Verdikt, Status, Kennungen, Statistiken).

## 7. Rechtsgrundlage

- **Übermittlung an externe Analyse-Dienste:** Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Die
  Einwilligung wird über den Optionsdialog erteilt (globale Zustimmung, Abschnitt 3.1), zusätzlich
  wird der Scan je Absender bzw. je Nachricht ausgelöst (Abschnitt 3.2). Sie kann jederzeit
  widerrufen werden (Art. 7 Abs. 3 DSGVO).
- **Lokale Sicherheitsfunktionen** (Lesen der geöffneten Nachricht, lokale Bewertung, Anzeige von
  Hinweis- und Warnbannern, Speicherung von Zustimmungen und Einstellungen): berechtigtes Interesse
  an der Abwehr von Malware, Phishing und betrügerischen Nachrichten nach Art. 6 Abs. 1 lit. f DSGVO.

## 8. Speicherung und Löschung

**Lokal in Thunderbird (`browser.storage.local`):**

- Einstellungen (u. a. Datenschutz-Stufe, Whitelist/Blacklist, Scan-Optionen),
- Zustimmungen (`externalAnalysisConsent`, `scanningEnabledSenders`),
- API-Schlüssel der konfigurierten Dienste.

Diese Werte werden **unverschlüsselt** im lokalen Erweiterungsspeicher abgelegt. Sie sind nicht
durch eine zusätzliche Verschlüsselung seitens der Erweiterung geschützt, sondern nur durch die
Zugriffsrechte des Betriebssystem-Benutzerkontos und die Zugriffskontrolle des Thunderbird-Profils.

**Lokal in der IndexedDB-Datenbank `thunderbird_av`** (Version 3, Objektspeicher `hybridanalysis`):

- Scan-Ergebnisse je Nachricht (Verdikt, Status, Kennungen der Analyse, Zeitstempel),
- Link-Metadaten (geprüfte URLs und deren Status),
- Zuordnungen zu Nachrichten über die Message-ID bzw. Header-ID.

Anhangsinhalte werden nicht dauerhaft in dieser Datenbank gespeichert.

**Löschung:**

- Die Schaltfläche **„Cache leeren“** im Optionsdialog leert den Objektspeicher `hybridanalysis`
  vollständig.
- Mit dem Entfernen bzw. Deinstallieren des Add-ons entfernt Thunderbird die zugehörigen
  Erweiterungsdaten (Einstellungen, Zustimmungen, Erweiterungsspeicher).
- Daten, die bereits an einen Anbieter übermittelt wurden, unterliegen den Aufbewahrungsregeln
  dieses Anbieters. Der Verantwortliche des Add-ons kann diese Daten weder einsehen noch löschen;
  Löschansprüche sind an den jeweiligen Anbieter zu richten.

Es findet keine Speicherung von Nutzerdaten auf Systemen des Verantwortlichen statt.

## 9. Keine Telemetrie, kein Analytics

Die Erweiterung enthält:

- keine Telemetrie und keine Nutzungsstatistik,
- keine Analyse- oder Werbe-Dienste (kein Analytics, keine Werbe-IDs),
- keine Fehler- oder Absturzberichte an den Entwickler,
- keine Server des Entwicklers,
- keine Cookies, kein Tracking, kein Fingerprinting.

## 10. Host-Berechtigungen

Der Zugriff auf die Domains der Analyse-Dienste ist **optional**. Die Erweiterung deklariert diese
Zugriffe als optionale Host-Berechtigungen; sie werden nicht mit der Installation erteilt, sondern
erst dann bei Thunderbird angefragt, wenn im Optionsdialog ein Schlüssel für den jeweiligen Dienst
gespeichert wird. Ohne erteilte Host-Berechtigung unterbleibt die Übermittlung an diesen Dienst.

Host-Berechtigungen können jederzeit in den Add-on-Einstellungen von Thunderbird entzogen werden.

## 11. Sicherheit

- Alle Anfragen an externe Dienste erfolgen ausschließlich über HTTPS.
- Die Erweiterung führt keinen Remote-Code aus: keine `eval`-Aufrufe, keine eingebetteten Skripte
  aus dem Netz, Content-Security-Policy `script-src 'self'; object-src 'none'`.
- API-Schlüssel liegen ausschließlich lokal (Abschnitt 8) und werden nur an den zugehörigen Dienst
  übermittelt, nicht an den Entwickler oder andere Dritte.
- Für die Übertragung gilt der Transportweg über TLS; darüber hinausgehende Maßnahmen (z. B. Ende-
  zu-Ende-Verschlüsselung, Löschfristen) liegen im Verantwortungsbereich der jeweiligen Anbieter.

## 12. Rechte der betroffenen Personen

Sie haben nach der DSGVO folgende Rechte:

- **Auskunft** über die verarbeiteten Daten (Art. 15),
- **Berichtigung** unrichtiger Daten (Art. 16),
- **Löschung** (Art. 17),
- **Einschränkung der Verarbeitung** (Art. 18),
- **Datenübertragbarkeit** (Art. 20),
- **Widerspruch** gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21),
- **Widerruf der Einwilligung** mit Wirkung für die Zukunft (Art. 7 Abs. 3).

Für Rechte, die die Erweiterung selbst betreffen (Entzug der Zustimmung, Löschen der lokalen Daten,
Entfernen der Erweiterung), genügen der Optionsdialog bzw. die Add-on-Verwaltung von Thunderbird.
Für alle darüber hinausgehenden Anfragen gilt die Kontaktadresse in Abschnitt 14. Für Daten, die
bereits an einen Analyse-Dienst übermittelt wurden, ist der jeweilige Anbieter Ansprechpartner.

Unabhängig davon besteht das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.

## 13. Änderungen dieser Erklärung

Diese Erklärung wird mit der Version des Add-ons fortgeschrieben. Wesentliche Änderungen (z. B. neue
Empfänger, neue Datenarten, geänderte Standardwerte) werden vor der Veröffentlichung der
betreffenden Add-on-Version in dieser Datei und in den Release-Hinweisen dokumentiert. Die jeweils
aktuelle Fassung ist über die Projektseite des Repositories abrufbar.

## 14. Kontakt

Jan Bludau (VaZuLeS)
E-Mail: bludau.it.services@gmail.com
Repository und Issue-Tracker: https://github.com/VaZuLeS/Thunderbird-Antivirus

---

## Privacy Policy (English)

**Add-on:** Thundy AV – Email Scanner for Thunderbird (short name "Thundy AV"), version 1.6
**Repository:** https://github.com/VaZuLeS/Thunderbird-Antivirus (MIT License)
**Last updated:** September 2026

### 1. Controller

Jan Bludau (VaZuLeS) — email: bludau.it.services@gmail.com

The controller operates no server infrastructure for the add-on. There is no developer-operated
server that receives user data, and the developer has no access to user data.

### 2. Summary

- The add-on checks a message opened in Thunderbird for security risks (attachments, links, sender
  anomalies, IP addresses found in Received headers). This check runs locally in Thunderbird.
- Reading the opened message locally happens regardless of any consent and stays on the device.
  Without consent, **nothing** is transmitted to third parties.
- Data is transmitted to external analysis services only if the global consent "Allow external
  analysis" is enabled **and** a scan has been triggered for that message or sender.
- The default privacy tier is `strict`; in that tier only SHA-256 hashes of attachments are
  transmitted.
- There is **no** telemetry, **no** analytics, **no** usage statistics, **no** crash or error
  reporting to the developer, and **no** cookies or trackers.

### 3. Consent model

#### 3.1 Global consent "Allow external analysis"

This consent is shown as a checkbox in the add-on's options dialog and is stored in the local
extension storage (`browser.storage.local`) under the key `externalAnalysisConsent`.
**Default: off.**

While this consent is not granted, **no** data is transmitted to third parties:

- no upload of attachments or file contents,
- no hash lookup with analysis services,
- no URL or domain lookup,
- no IP address lookup.

Local features (scoring of the message text, evaluation of headers and attachment data, display of
notice and warning banners) keep working without this consent.

Consent can be withdrawn at any time in the options dialog. Withdrawal stops future transmissions;
data already transmitted cannot be recalled (section 8).

#### 3.2 Per-sender opt-in

In addition to the global consent, automated scans require a per-sender opt-in (stored under the key
`scanningEnabledSenders`). In the message view the add-on shows a banner with two buttons:

- **"Scan this message only"** — a one-off scan of the open message; the sender is **not** stored
  permanently as a scanning-enabled sender.
- **"Scan this sender permanently"** — the sender is added permanently to the list of
  scanning-enabled senders. Messages from that sender are then checked automatically as long as the
  global consent (3.1) is enabled.

#### 3.3 Privacy tier (`privacyTier`)

The privacy tier is selected in the options dialog and stored in local extension storage under the
key `privacyTier`. **Default: `strict`.**

| Tier | What may additionally be transmitted |
|---|---|
| `strict` | SHA-256 hashes of attachments only. Manual attachment upload and manual URL scan in the popup are disabled in this tier and show a notice ("In Stufe Strikt deaktiviert – in den Einstellungen auf Ausgewogen/Maximal umstellen" / disabled in the *strict* tier — switch to *balanced*/*max* in the options). |
| `balanced` | additionally complete attachments of unknown files to Hybrid Analysis — for the automatic scan **and** via the manual attachment upload in the popup. |
| `max` | additionally URLs from the message to Hybrid Analysis — automatically **and** via the manual URL scan in the popup. |

The tier limits **every** transmission path, not just the automatic scan: a complete attachment upload
is only possible from `balanced` upwards, a complete URL upload to Hybrid Analysis only from `max`. In
`strict` the manual upload paths in the popup are not available at all.

Regardless of the tier: hash lookups (SHA-256) as well as domain checks via URLhaus, link checks via
urlscan.io and IP reputation checks remain possible if a key for the respective service is configured
and the global consent (3.1) is enabled. IP reputation checks run only if a provider and a key have
explicitly been configured for them; by default they are not configured.

#### 3.4 Data declaration and the `sensitiveDataUpload` permission

The manifest (`manifest.json`) declares the following data-collection permission:

```json
"data_collection_permissions": { "required": ["none"], "optional": ["personalCommunications"] }
```

`required: "none"` means that without the optional consent the add-on does not collect or transmit any
of the declared data categories. The category `personalCommunications` is **optional**: it only
becomes relevant once the user enables external analysis.

Consent is still obtained through the options-page checkbox **"Allow external analysis"** (default:
off). In the same user gesture the add-on additionally requests the optional Thunderbird permission
`sensitiveDataUpload`; it is declared as `optional_permissions: ["sensitiveDataUpload"]` in the
manifest (Thunderbird labels it "transfer sensitive user data to a remote server"). The request is
made programmatically via
`browser.permissions.request({ data_collection: ['personalCommunications'], permissions: ['sensitiveDataUpload'] })`.
When consent is switched off, the add-on removes the permission again
(`browser.permissions.remove(...)`). Without this optional permission, no data is transmitted to third
parties.

### 4. Data read locally

When a message is opened, the add-on reads the following data locally inside Thunderbird:

- message headers (including sender, recipients, subject, date, Message-ID, Received headers),
- the message body (plain-text and HTML part),
- links/URLs from the message body and the HTML part,
- attachments (file name, content type, size and content; the content is hashed locally).

This processing serves the security features and the in-Thunderbird display only. It is local; no
such data is transmitted without consent. Earlier statements that the add-on reads "no email
content, only attachments" were incorrect and have been corrected.

### 5. Transmission to third parties — only with the global consent enabled

The table below lists every category of data that may be transmitted, the trigger, and the
recipient. Every transmission requires the global consent described in section 3.1.

| Data category | When | Recipient |
|---|---|---|
| SHA-256 hash of an attachment | when an attachment is scanned; all tiers (`strict`, `balanced`, `max`) | VirusTotal, Hybrid Analysis |
| Complete attachment (file content, file name, content type, size) | tier `balanced` and `max` only; either automatically (when the hash lookup returned no match) or via the **manual attachment upload** in the popup | Hybrid Analysis |
| URLs/links from the message that are queued for checking | tier `max`; automatically or via the **manual URL scan** in the popup (Hybrid Analysis). urlscan.io lookup if an urlscan.io key is configured (in all tiers) | Hybrid Analysis, urlscan.io |
| Domains extracted from the message body | if a URLhaus key is configured | URLhaus (abuse.ch) |
| IP addresses found in the Received headers | only if a provider and a key for IP reputation are configured | AbuseIPDB, VirusTotal |

As an inherent property of HTTP, every request also transmits the IP address of the requesting
system and an HTTP user-agent string. VirusTotal lookups require a configured VirusTotal key; without
a key no hash is transmitted to VirusTotal.

Links that are transmitted can contain personal identifiers (e.g. newsletter tracking IDs, campaign or
recipient parameters in the URL); they are transmitted only with consent and a triggered scan.

**Never transmitted** (regardless of tier): the full message body, the subject line, sender and
recipient addresses, the content of attachments typed as plain-text formats (e.g. `text/plain`,
`text/html`, `application/json`), and settings, consent flags and API keys.

#### 5.1 Hosts contacted

| Service | Hosts contacted | Purpose |
|---|---|---|
| Hybrid Analysis | `hybrid-analysis.com` | file/hash/URL analysis (sandbox, multi-engine) |
| VirusTotal | `www.virustotal.com` | hash lookup for attachments, IP reputation |
| urlscan.io | `urlscan.io` | analysis/reputation of links |
| URLhaus (abuse.ch) | `urlhaus-api.abuse.ch` | checks domains against malware URL lists |
| AbuseIPDB | `api.abuseipdb.com` | IP address reputation |

### 6. Recipients and further processing at the providers

The recipients are exclusively the operators of the analysis services listed in section 5.1. They
process the transmitted data as independent controllers under their own privacy policies, which are
available on the respective provider websites. Processing may take place outside the European Union
or the EEA (in particular in the United States).

The controller of the add-on:

- has no access to the data transmitted to the providers,
- keeps no own copy or evaluation of that data,
- receives no personal data back from the providers beyond what is needed to display the check
  result (verdict, status, identifiers, statistics).

### 7. Legal basis

- **Transmission to external analysis services:** consent pursuant to Art. 6(1)(a) GDPR. Consent is
  given in the options dialog (global consent, section 3.1) and the scan is additionally triggered
  per sender or per message (section 3.2). It can be withdrawn at any time (Art. 7(3) GDPR).
- **Local security features** (reading the open message, local scoring, displaying notice and
  warning banners, storing consent flags and settings): legitimate interest in defending against
  malware, phishing and fraudulent messages pursuant to Art. 6(1)(f) GDPR.

### 8. Storage and deletion

**Locally in Thunderbird (`browser.storage.local`):**

- settings (privacy tier, whitelist/blacklist, scan options),
- consent flags (`externalAnalysisConsent`, `scanningEnabledSenders`),
- API keys of the configured services.

These values are stored **unencrypted** in the local extension storage. They are not protected by any
additional encryption applied by the add-on, only by the access rights of the operating system user
account and by the Thunderbird profile's access control.

**Locally in the IndexedDB database `thunderbird_av`** (version 3, object store `hybridanalysis`):

- scan results per message (verdict, status, analysis identifiers, timestamps),
- link metadata (checked URLs and their status),
- mappings to messages via Message-ID or header ID.

Attachment contents are not stored permanently in this database.

**Deletion:**

- The **"Clear cache"** button in the options dialog empties the `hybridanalysis` object store.
- Removing/uninstalling the add-on makes Thunderbird delete the associated extension data (settings,
  consent flags, extension storage).
- Data already transmitted to a provider is subject to that provider's retention rules. The
  controller of the add-on can neither view nor delete it; deletion requests must be addressed to
  the respective provider.

No user data is stored on systems operated by the controller.

### 9. No telemetry, no analytics

The add-on contains no telemetry and no usage statistics, no analytics or advertising services (no
advertising IDs), no crash or error reporting to the developer, no developer-operated servers, and no
cookies, tracking or fingerprinting.

### 10. Host permissions

Access to the analysis provider domains is **optional**. These accesses are declared as optional host
permissions; they are not granted at install time but requested from Thunderbird only when a key for
the respective service is saved in the options dialog. Without a granted host permission, no data is
transmitted to that service. Host permissions can be revoked at any time in Thunderbird's add-on
settings.

### 11. Security

- All requests to external services use HTTPS exclusively.
- The add-on executes no remote code: no `eval` calls, no scripts embedded from the network, Content
  Security Policy `script-src 'self'; object-src 'none'`.
- API keys are stored locally only (section 8) and are transmitted solely to the service they belong
  to, not to the developer or any other third party.
- Transmission to the analysis services is protected by TLS; measures beyond that (e.g. end-to-end
  encryption, retention periods) are the responsibility of the respective providers.

### 12. Rights of data subjects

Under the GDPR you have the right to access the processed data (Art. 15), to rectification of
inaccurate data (Art. 16), to erasure (Art. 17), to restriction of processing (Art. 18), to data
portability (Art. 20), to object to processing based on legitimate interests (Art. 21), and to
withdraw consent with effect for the future (Art. 7(3)).

For rights concerning the add-on itself (withdrawing consent, clearing local data, removing the
add-on), the options dialog and Thunderbird's add-on manager are sufficient. For all other requests,
use the contact address in section 14. For data already transmitted to an analysis service, the
respective provider is the contact point.

You also have the right to lodge a complaint with a data protection supervisory authority.

### 13. Changes to this policy

This policy is updated together with the add-on version. Material changes (e.g. new recipients, new
data categories, changed defaults) are documented in this file and in the release notes before the
relevant add-on version is published. The current version is available on the project website of the
repository.

### 14. Contact

Jan Bludau (VaZuLeS)
Email: bludau.it.services@gmail.com
Repository and issue tracker: https://github.com/VaZuLeS/Thunderbird-Antivirus
