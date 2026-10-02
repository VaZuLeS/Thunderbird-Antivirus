# Entwicklungsplan 1.7 — Bedrohungsindikator, Inline-Aufklärung und Link-Gate

**Add-on:** Thundy AV – Email Scanner for Thunderbird · Ausgangsstand **1.6.2** · Zielversion **1.7.0**
**Zielplattform:** Thunderbird 140 ESR oder neuer (Manifest V3)
**Perspektive:** IT-Security-Forschung (Detection Engineering, Incident Response, Forensik-Tauglichkeit)
**Status:** Arbeitsplan für den Entwicklungszweig `cline/rea84nxd`

---

## 1. Ausgangslage und Befunde

Der Ausgangsstand 1.6.2 prüft eine Nachricht **beim Anzeigen** (Attachment-Hashes, Link-Domains,
Header-Authentifizierung, BEC-Heuristiken) und injiziert zwei Banner. Drei Lücken sind aus
Sicherheitssicht die wichtigsten:

| ID | Befund | Risiko |
|---|---|---|
| **F-1** | **Links werden ungeprüft extern geöffnet.** `injectTimeOfClickProtection()` setzt lediglich `title` und eine gestrichelte Unterstreichung. Es gibt **keinen** Click-Handler, der `preventDefault()` aufruft; Thunderbird übergibt jeden Klick direkt an den Standardbrowser. Die vorhandene `checkLinkState`-Logik im Hintergrund wird von der Nachrichtenansicht **nie aufgerufen** (es existiert kein Message-Display-Skript, das sie anspricht). | Der Nutzer landet ohne Warnung auf der Phishing-/Malware-Seite. Der „Time-of-Click“-Schutz ist reine Kosmetik — ein klassischer *false sense of security*. |
| **F-2** | **Kein Bedrohungsindikator in der Toolbar.** Das `message_display_action`-Icon ist statisch; Score und Stufe sind nur sichtbar, wenn der Nutzer das Popup öffnet. | Kein visueller Hinweis am Icon, ob die gelesene Nachricht kritisch ist. |
| **F-3** | **Informationsgehalt der Inline-Darstellung ist gering.** Das Warnbanner zeigt Score und eine Reason-Liste, aber keine Link-Verdikte, keine Header-Authentifizierung im Detail, keine Anhangs-Hashes und keinen Bezug zu Erstkontakt/Reply-To. | Keine belastbare Erstbewertung für den Nutzer, kein Übergabe-Artefakt an den Admin/SOC. |

Zusätzlich fehlt der Weg von der Beobachtung zur **Eskalation**: Es gibt keine Möglichkeit, einen
Administrator bzw. ein SOC per vorbereiteter Vorlage zu informieren.

## 2. Ziele (funktional)

1. **F-4 Link-Gate:** Jeder Klick auf einen `http(s)`-Link in der Nachrichtenansicht wird
   **vor** dem Öffnen geprüft. Ohne Freigabe wird der Link **nicht** an den Standardbrowser
   übergeben. Lokale Detektion ist immer verfügbar, externe Anreicherung nur mit Zustimmung,
   Host-Berechtigung und API-Schlüssel.
2. **F-5 Toolbar-Indikator:** Das `message_display_action`-Icon zeigt die Bedrohungsstufe der
   gerade gelesenen Nachricht (Badge, Farbe, Icon, Tooltip) und aktualisiert sich nach jedem Scan.
3. **F-6 Inline-Aufklärung:** Banner/Statusleiste mit Stufe, Score, Aufschlüsselung (Header,
   Absender, Links, Anhänge, Erstkontakt), Link-Tabelle mit Verdikten und Aktionen.
4. **F-7 Administrator-Kontakt & Incident-Report:** In den Einstellungen lassen sich mehrere
   Administrator-Adressen (`;`-getrennt), ein Anzeigename, eine Organisation und eine
   **Telefonnummer** hinterlegen. Ein Klick erzeugt eine **ausführliche Erstbewertung** als
   E-Mail-Vorlage (Compose-Fenster) bzw. eine **Hilfeanforderung** an den Administrator.
5. **F-8 Forensik-Spur:** Entscheidungen des Link-Gates (erlaubt/geplant), begrenzt und ohne
   Fremdübertragung, werden lokal protokolliert (Audit-Log).

## 3. Nicht-Ziele

- Keine Sandbox-/Detonations-Ausführung, keine eigene Malware-Analyse-Engine.
- Keine Übertragung personenbezogener Daten ohne globale Zustimmung (`externalAnalysisConsent`).
- Kein Auslesen von Anhangsinhalten in den Admin-Report (nur Metadaten + SHA-256).
- Keine Änderung der Datenschutz-Deklaration in `manifest.json` (`required: ["none"]` bleibt).
## 4. Bedrohungsmodell (Kurzfassung)

| Angreifer-Technik | Erkennung im Link-Gate | Quelle |
|---|---|---|
| Look-alike-Domain (Typosquatting) | Levenshtein/IDN-Vergleich gegen Markenliste | lokal |
| Homograph/IDN (`раypal.com`, `xn--`) | Punycode-Erkennung + Markenvergleich | lokal |
| IP-Literal als Host, ungewöhnlicher Port | Host-/Port-Klassifikation | lokal |
| Credentials im URL-Userinfo (`https://paypal.com@evil.tld`) | Userinfo-Parsing | lokal |
| Klartext-HTTP-Login, verdächtige TLD | Schema-/TLD-Regeln | lokal |
| Kurz-URL/Redirector | Shortener-Liste + Query-Redirect-Parameter | lokal |
| Doppelte Dateiendung / ausführbarer Download | Pfad-/Endungsanalyse | lokal |
| Sichtbarer Text ≠ Ziel-URL | Vergleich `textContent` vs. `href` | lokal |
| Bekannte Malware-URL (Domain) | URLhaus-API | extern |
| Visuelles Phishing (Brand-Imitation) | urlscan.io-Verdikt | extern |
| Bereits eingereichte URL | Hybrid-Analysis-Verdikt aus IndexedDB | extern |

**Entscheidungslogik:** lokal + extern werden zu einer Stufe (`clean` → `critical`) und einer
Aktion (`allow` → `warn` → `block`) zusammengeführt. Die externe Anreicherung kann das Ergebnis
**verschlechtern**, eine fehlende externe Prüfung darf ein lokales „block“ aber **nie** aufheben.

## 5. Architektur und Modulschnitt

```
Nachrichtenansicht (Message-Display-Kontext)
  msg_display.js  ──►  runtime.sendMessage({action:'checkLinkState'})  ──►  background.js
        │                                                                        │
        └── lokale Sofortanalyse (link_gate.js, identische Engine)               ├─ link_gate.js (Verdikt-Policy)
                                                                                ├─ URLhaus / urlscan.io / Hybrid (optional)
                                                                                └─ Audit-Log (storage.local)
```

| Datei | Rolle | Owner |
|---|---|---|
| `link_gate.js` | **Pure** Engine: URL-Statikanalyse, Marken-/Typosquatting, Stufen-/Aktions-Policy, Stil-Mapping | Workstream A |
| `link_gate.test.js` | Unit-Tests der Engine (Angriffsvektoren als Testfälle) | Workstream A |
| `report.js` | **Pure** Engine: Kontaktvalidierung, Incident-Report, Hilfeanforderung | Workstream B |
| `report.test.js` | Unit-Tests der Report-Engine | Workstream B |
| `msg_display.js` | Klick-Gate + Inline-UI im Message-Display-Dokument | Lead |
| `background.js` | Orchestrierung, Toolbar-Indikator, Banner, Compose, Audit-Log | Lead |
| `options.html` / `options.js` | Administrator-Kontakte, Gate-Modus, Vorlagen-Vorschau | Workstream C |
| `popup.html` / `api.js` | Inline-Info im Popup, Report-Button | Workstream D |
| `_locales/{en,de}/messages.json` | Neue UI-Strings | Lead |
| `manifest.json`, `scripts/*`, `package.json` | Verdrahtung, Paket-/Gate-Regeln, Testliste | Lead |

**Regel:** Jede Datei hat genau einen Owner; parallele Änderungen an derselben Datei sind
untersagt. Git-Commits macht ausschließlich der Lead.

## 6. Schnittstellenverträge

### 6.1 `link_gate.js` (global `ThundyLinkGate`, Node-Export via `module.exports`)

```js
ThundyLinkGate.KNOWN_BRANDS: string[]            // Markenliste (Domains)
ThundyLinkGate.SHORTENERS: string[]              // Kurz-URL-Hosts
ThundyLinkGate.SUSPICIOUS_TLDS: string[]         // auffällige TLDs
ThundyLinkGate.SUSPICIOUS_EXTENSIONS: string[]   // ausführbare/skriptfähige Endungen

// Stufe aus Score: 0-14 clean, 15-39 low, 40-59 medium, 60-79 high, 80-100 critical
ThundyLinkGate.levelFromScore(score) -> 'clean'|'low'|'medium'|'high'|'critical'

// Statische Analyse einer URL (rein lokal, keine Netzwerkzugriffe, wirft nie)
ThundyLinkGate.inspectUrl(url, options) -> {
  url, host, mainDomain, scheme, port, isIpLiteral,
  score: 0..100, level, indicators: [{ code, label, weight }], reasons: string[]
}
// options: { senderDomain, senderMainDomain, displayText, brands, whitelist }
//   whitelist: string[] -> Treffer setzt score = 0, level = 'clean', indicator 'whitelisted'

### 6.2 `report.js` (global `ThundyReport`, Node-Export via `module.exports`)

```js
ThundyReport.parseAdminEmails(raw) -> { emails: string[], invalid: string[] }
// Eingabe "a@b.de; c@d.de" oder ["a@b.de"]; Duplikate werden entfernt, Kleinschreibung erzwungen.
ThundyReport.parseAdminPhone(raw)  -> { phone: string, valid: boolean }
// Erlaubt "+49 30 1234567", "030/123456", "(030) 123-456"; Ausgabe normalisiert.
ThundyReport.severityForScore(score) -> { key, label, recommendation }
// key: 'info'|'low'|'medium'|'high'|'critical'

ThundyReport.buildIncidentReport(input) -> { to: string[], subject: string, body: string,
                                             severity, evidence: {...} }
// input: {
//   message: { headerMessageId, subject, author, recipient, date },
//   threat:  { score, level, reasons, authStatus },
//   links:   [{ url, level, action, score, reasons }],
//   attachments: [{ name, size, contentType, hash, verdict }],
//   ipReputation: { provider, maliciousIps },
//   contacts: { emails, phone, name, organization },
//   reporter: { email, name },
//   meta: { version, generatedAt, privacyTier, consent, gateMode }
// }

ThundyReport.buildHelpRequest(input) -> { to, subject, body }
// Vorlage "Hilfeanforderung": Administrator-Kontakt, Telefonnummer, Zweck, Checkliste,
// was der Melder liefern soll, Datenschutzhinweis.
```

Beide Report-Funktionen sind **reine Textfunktionen**: kein `browser.*`, kein `fetch`, keine
Seiteneffekte — damit sind sie im Node-Test vollständig prüfbar und im Message-Display-Kontext
wiederverwendbar.

### 6.3 Nachrichtenprotokoll (background ↔ Message-Display)

| `action` | Payload | Antwort |
|---|---|---|
| `linkGateConfig` | – | `{ mode, style: {level → levelStyle}, i18n: {...} }` |
| `checkLinkState` | `{ url, displayText, messageHeaderId? }` | `{ status, action, level, score, reasons, sources }` |
| `linkGateDecision` | `{ url, action, level, override }` | `{ logged: true }` (Audit-Log) |
| `requestAdminReport` | `{ messageId, threat, urls }` | `{ success, recipients, reason? }` |
| `requestHelpTemplate` | `{}` | `{ success, recipients, reason? }` |

`status` bleibt aus Kompatibilitätsgründen erhalten (`CLEAN|SUSPICIOUS|MALICIOUS|UNKNOWN|ERROR`).

### 6.4 Einstellungsschlüssel (`browser.storage.local`)

| Schlüssel | Typ | Default | Bedeutung |
|---|---|---|---|
| `linkGateMode` | `'strict'|'balanced'|'off'` | `'strict'` | Policy des Klick-Gates |
| `linkGateEnabled` | `boolean` | `true` | Klick-Gate aktiv |
| `adminEmails` | `string[]` | `[]` | Administrator-Adressen (validiert) |
| `adminPhone` | `string` | `''` | Telefonnummer für die Vorlage |
| `adminContactName` | `string` | `''` | Anzeigename des Ansprechpartners |
| `adminOrganization` | `string` | `''` | Organisation/SOC |
| `reportIncludeUrls` | `boolean` | `true` | Vollständige URLs in den Report |
| `threatAuditLog` | `object[]` | `[]` | Ringpuffer (max. 100) der Gate-Entscheidungen |

### 6.5 Neue i18n-Schlüssel (Auszug, verbindlich)

`bannerLevelClean|Low|Medium|High|Critical`, `bannerLevelTitle`, `bannerLevelScore`,
`bannerLinkTable`, `bannerLinkCount`, `bannerAttachmentsTitle`, `bannerAuthTitle`,
`bannerAuthNone`, `bannerFirstContact`, `bannerReplyToMismatch`, `bannerReportAdmin`,
`bannerOpenOptions`, `bannerDetailsToggle`, `gateChecking`, `gateBlocked`, `gateWarning`,
`gateAllowed`, `gateOpenAnyway`, `gateOpenAnywayConfirm`, `gateCancel`, `gateTrustHost`,
`gateReasonTitle`, `gateLocalOnly`, `gateBlockedNote`, `notificationReportStarted`,
`notificationReportNoContact`, `notificationGateBlocked`, `optionsAdminSection`,
`optionsAdminEmails`, `optionsAdminEmailsHelp`, `optionsAdminPhone`, `optionsAdminPhoneHelp`,
`optionsAdminName`, `optionsAdminOrganization`, `optionsLinkGateMode`, `optionsLinkGateHelp`,
`optionsReportIncludeUrls`, `optionsReportPreview`, `optionsRequestHelpTemplate`,
`optionsCopyTemplate`, `optionsTemplateCopied`, `optionsAdminInvalidEmails`,
`actionTitleLevel` (mit `$LEVEL$`).

Englisch und Deutsch müssen denselben Schlüsselsatz haben (Test `test/manifest.test.js`).
// Verdikt zusammenführen
ThundyLinkGate.decide(input) -> {
  action: 'allow'|'warn'|'block', level, score, reasons: string[], sources: {
    local, urlhaus: true|false|null, urlscan, hybrid, unknown: boolean
  }
}
// input: { local, urlhaus, urlscan, hybrid, mode: 'strict'|'balanced'|'off' }

// UI-Stil (Banner, Indikator, Popup, Optionen)
ThundyLinkGate.levelStyle(level) -> { color, background, border, icon, labelKey, labelFallback }
```

## 7. Teststrategie

| Ebene | Werkzeug | Abdeckung |
|---|---|---|
| Pure Engines | `node --test link_gate.test.js report.test.js` | Angriffsvektoren (IDN, Userinfo, Typosquatting, Kurz-URL, Endungen), Policy-Matrix, Kontaktvalidierung, Report-Vollständigkeit |
| Hintergrund | `node --test background.test.js` | Toolbar-Indikator (Feature-Detection), Gate-Verdrahtung, Audit-Log, Compose-Aufruf, Report-Erzeugung, Rückwärtskompatibilität von `checkLinkState` |
| Optionen | `node --test options.test.js` | Persistenz der neuen Felder, Validierung, Vorlagen-Vorschau, Compose-Aufruf |
| Popup | `node --test api.test.js` | Stufenanzeige, Link-Tabelle, Report-Button |
| Repo-Invarianten | `node --test test/manifest.test.js` | neue Runtime-Dateien im Manifest, Paketliste, Locale-Parität, verbotene APIs | 
| Gates | `npm run pre-submit-checks`, `npm run lint:filtered`, `npm run package` | Store-Tauglichkeit |

**Grundsatz:** Jede sicherheitsrelevante Regel bekommt einen Test, der **fehlschlägt**, wenn die
Regel entfernt wird (z. B. „`decide()` gibt bei URLhaus-Treffer niemals `allow`“).

## 8. Arbeitspakete

| # | Paket | Inhalt | Owner |
|---|---|---|---|
| A-1 | Link-Gate-Engine | `link_gate.js`, `link_gate.test.js` | Workstream A |
| A-2 | Report-Engine | `report.js`, `report.test.js` | Workstream B |
| A-3 | Options-UI | Administrator-Kontakte, Gate-Modus, Vorlagen-Vorschau/-Versand | Workstream C |
| A-4 | Popup-UI | Stufenanzeige, Link-Tabelle, Report-Button | Workstream D |
| A-5 | Message-Display | `msg_display.js`: Klick-Gate, Dialog, Inline-Banner, Link-Markierung | Lead |
| A-6 | Hintergrund | Toolbar-Indikator, Gate-Handler, Audit-Log, Compose, Banner | Lead |
| A-7 | Verdrahtung | Manifest, Paketliste, Testliste, Icons, Locale | Lead |
| A-8 | Doku | Plan, CHANGELOG, README, Live-Test-Protokoll, Privacy-Policy, Reviewer-Notes | Lead + Doku-Review |

## 9. Abnahmekriterien

1. `npm test` grün (alle Suiten, inkl. der neuen Dateien in `package.json`).
2. `npm run pre-submit-checks` ohne Fehler; `npm run lint:filtered` ohne Fehler.
3. `npm run package` erfolgreich; neue Runtime-Dateien sind im Paket, Tests/Doku nicht.
4. Klick-Gate: ohne vorherige Prüfung wird kein `http(s)`-Link an den Standardbrowser übergeben
   (Nachweis: Test + Live-Test-Schritt im Protokoll).
5. Toolbar-Indikator: Badge/Farbe/Tooltip folgen Score und Stufe; `null`-Fall (keine Nachricht)
   setzt den Indikator auf den neutralen Zustand zurück.
6. Administrator-Vorlage: `;`-getrennte Adressen, Telefonnummer, ausführliche Erstbewertung mit
   Score, Gründen, Auth-Ergebnis, Link-Tabelle, Anhangs-Hashes und Quellenangabe.
7. Kein neuer Netzwerkpfad ohne Zustimmung; die Datenschutz-Deklaration bleibt `none`/optional.

## 10. Risiken und Gegenmaßnahmen

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| `runtime.sendMessage` fehlt im Message-Display-Kontext | Gate kann nicht extern nachfragen | Lokale Engine läuft direkt im Skript; Ergebnis ist trotzdem ein Verdikt, nur ohne externe Quelle |
| Thunderbird re-rendert den Nachrichtenkörper nach der Injektion | Gate/Handler verschwindet | `MutationObserver` im Gate hält die Links gespeichert (Href entzogen) und neu eingefügte Links werden nachgezogen |
| Programmatischer Re-Click öffnet nicht | Nutzer kommt nicht zum Ziel | Nach Freigabe bleibt das `href` für diese Ansicht gesetzt; ein manueller Klick öffnet dann ohne Gate |
| Badge-API in `messageDisplayAction` fehlt | Indikator unsichtbar | Feature-Detection: Badge fällt weg, Icon und Tooltip bleiben (Icon-Sets für 5 Stufen) |
| Falsch-Positive durch lokale Heuristik | Nutzerärgernis | Whitelist, „Trotzdem öffnen“ mit Bestätigung, Modus `balanced` |
| Report enthält zu viele Daten | Datenschutz | Standard: nur Metadaten + Hashes, keine Anhangsinhalte, keine vollständigen Header; Schalter `reportIncludeUrls` |
**Policy (verbindlich):**

| Lage | `strict` (Default) | `balanced` | `off` |
|---|---|---|---|
| externes Verdikt bösartig (URLhaus/urlscan/Hybrid) | `block` | `block` | `allow` |
| lokale Stufe `critical` oder `high` | `block` | `warn` | `allow` |
| lokale Stufe `medium` | `warn` | `warn` | `allow` |
| lokal `low`/`clean`, extern geprüft und sauber | `allow` | `allow` | `allow` |
| lokal `clean`, **keine** externe Prüfung möglich (`unknown`) | `warn` | `allow` | `allow` |

`block` und `warn` sind **keine** Endzustände: Der Nutzer kann nach expliziter Bestätigung öffnen.
Diese Entscheidung wird mit `override: true` im Audit-Log vermerkt (Nachvollziehbarkeit).