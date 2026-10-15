# Historische Auditbefunde und Nachrichten-Dialogprüfung — 15. Oktober 2026

946 Tests im Gesamtgate, 34 Browser-Kurzfälle, 24 Nachrichten-Dialogfälle und 48 Audit-Sprach-/Layoutfälle bestanden. Die lokale Auditansicht lokalisiert Providerbefunde in allen sechs Sprachen und kennzeichnet den Stand bei der Entscheidung. Fehlende damalige Befunde/Provider werden nicht durch spätere Werte ersetzt; spätere Befunde bleiben in den Details, Originalkennungen in den Exporten. Die Browser-CI ist auf 600 Fälle erweitert, einschließlich gefülltem Popup/Audit und der tatsächlich injizierten Linkdialogfunktion. Quellstand 1.23.0 und lokales unsigniertes XPI aktualisiert; reale Thunderbird-/OS-/Screenreader-Abnahme und getaggte Veröffentlichung bleiben offen. [Prüfumfang](UI_BROWSERPRUEFUNG.md) · [Auditbedeutung](ADMIN_FEATURES.md).

---

# Reproduzierbare UI-Prüfung und zugängliche Navigation — 15. Oktober 2026

940 Tests im Gesamtgate und 28/28 korrigierte Browser-Kurzfälle bestanden. Hauptbereiche für die Screenreader-Navigation, sichtbare Linkkennzeichnung, fokussierbare Scrollbereiche und ein benannter Audit-Dialog ergänzt. Versionierter Playwright-/axe-Lauf für 528 Varianten über acht Adminansichten und sechs Add-on-Seiten; CI mit sechs unabhängigen Sprachläufen und Berichts-/Fehlerscreenshot-Artefakten. Quellstand 1.23.0, lokales unsigniertes XPI aktualisiert; getaggte Veröffentlichung und echte Thunderbird-/OS-/Screenreader-Abnahme bleiben separat offen. [Befehle, Prüfumfang und Grenzen](UI_BROWSERPRUEFUNG.md).

---

# Signierte Testgeräte-Heartbeats — 15. Oktober 2026

813 Tests im Gesamtgate. Minimaler lokaler Heartbeatkanal mit Geräte-/Organisations-/Epochenbindung, eigener lückenloser Sequenz, Clock-Skew-Prüfung und dauerhafter Annahme. Exakte Wiederholungen liefern den ursprünglichen Beleg ohne Kontaktauffrischung. Öffentlicher Prüfer validiert Geräte- und Writer-Signaturen; Zustände nie gemeldet/aktuell/verspätet/unbekannt/widerrufen werden konservativ abgeleitet. Keine reale Flottenmessung oder Runtime-/SSO-/SEALED-Integration; Extension 1.22.0 unverändert. [API, CLI und Grenzen](ENTERPRISE_HEARTBEATS.md) · [Fortgeschriebener Plan](ENTERPRISE_NAECHSTE_SCHRITTE.md).

---

# Dauerhaft abrufbare Alarmkandidaten — 15. Oktober 2026

802 Tests im Gesamtgate. Neue Monitorbeobachtungen speichern Alarmkandidaten atomar mit stabiler ID. Pending-Abholen entfernt nichts; ausdrückliches ACK ist nach Neustart idempotent. Kapazitätsüberschreitung verwirft keine alten Kandidaten, gesunde Snapshots bestätigen nichts automatisch. Alte Beobachtungen bleiben lesbar, frühere verlorene Rückgaben sind nicht rekonstruierbar. Keine externe Zustell-/SSO-/SEALED-Freigabe; Extension 1.22.0 unverändert. [Bedienung und Recovery](ENTERPRISE_ALARMKANDIDATEN.md) · [Fortgeschriebener Plan](ENTERPRISE_NAECHSTE_SCHRITTE.md).

---

# Sechssprachige lokale Fallübersicht — 14. Oktober 2026

794 Tests im Gesamtgate. EN/DE/FR/ES/IT/PL-Fallkarten verbinden Domain-URL, damaligen Score, Providerbefund, Ergebnis, Policy-/Regelversion und Bearbeitungsverlauf. Public-Key-CLI prüft das Falljournal vor HTML-Erstellung; Filter, 25-Fall-Pagination und lazy/paginierter Verlauf. Vollständiger minimierter JSON-Export unabhängig von Filtern. 24 Chromium-Layouts und echte Browserdownloads geprüft. Keine SSO-/Portal-/SEALED-Freigabe; Extension 1.22.0 unverändert. [Bedienung und Grenzen](ENTERPRISE_FALLUEBERSICHT.md) · [Fortgeschriebener Plan](ENTERPRISE_NAECHSTE_SCHRITTE.md).

---

# Policy-Diff und konservative Simulation — 14. Oktober 2026

783 Tests im Gesamtgate. Public-Key-Vergleich zweier signierter Policies und konservative Öffnungsmodellsimulation auf verifizierten damaligen Entscheidungs-Assessments. Spätere Neubewertungen verändern die Grundlage nicht. Szenarioannahmen, unvergleichbare Gates und ausgelassene Policyversionen werden ausgewiesen. Kein Rollout, keine Policyaktivierung oder SEALED-/Browserfreigabe; Extension 1.22.0 unverändert. [Bedienung und Modellgrenzen](ENTERPRISE_POLICY_SIMULATION.md) · [Fortgeschriebener Plan](ENTERPRISE_NAECHSTE_SCHRITTE.md).

---

# Dauerhafte Incidentfälle — 14. Oktober 2026

774 Tests im Gesamtgate. Verifizierte Entscheidungen lassen sich als dauerhafte Fälle aufnehmen, zuweisen, bestätigen, bearbeiten, abschließen und explizit wieder aufnehmen. Revisionen verhindern Änderungen aus veralteten Bearbeitungsständen. Public-Key-Prüfung funktioniert ohne Writer-Schlüssel und ohne Journal-/Lockänderung. Der Reader bestätigt den Fallwriter und die lokalen Übergänge, nicht erneut die Original-Geräteevidenz. Keine SSO-/Portal-/Ticketaktivierung oder SEALED-Freigabe; Extension 1.22.0 unverändert. [API und Recovery](ENTERPRISE_INCIDENTFAELLE.md) · [Fortgeschriebener Plan](ENTERPRISE_NAECHSTE_SCHRITTE.md).

---

# N03–N06 autonom fortgeführt — 14. Oktober 2026

765 Tests im Gesamtgate und 24 Chromium-Layouts der neuen sechssprachigen Betriebsberichte. N03 erneut geprüft; N04 liefert minimierte Reports und dauerhafte Alarmdämpfung. N05 liefert vier optionale SIEM-Offlineformate mit signierter Exportqueue, Deduplizierung, Retry und Recovery. N06 wurde auf Ausführbarkeit geprüft: keine Unternehmenszugänge/Thunderbird-/Windows-/macOS-Systeme; produktive SEALED-/SSO-/OS-Pfade bleiben unimplementiert. Ein signatur- und artefaktgebundener Nachweisprüfer dokumentiert fehlende Unterlagen, erteilt aber keine Freigabe. Extension 1.22.0 unverändert. [Betriebsberichte](ENTERPRISE_BETRIEBSBERICHTE.md) · [SIEM-Queue](ENTERPRISE_SIEM_EXPORTQUEUE.md) · [N06-Abnahme](ENTERPRISE_N06_ABNAHME.md) · [Plan](ENTERPRISE_NAECHSTE_SCHRITTE.md).

---

# Versionierte Incidentregeln — 14. Oktober 2026

730 Tests im Gesamtgate. Offline-Ableitung aus geprüften Server-/Gerätesignaturen: damaliger Score, Policyversion und Domain-URL bleiben an die Entscheidung gebunden. Stabile regelgebundene IDs erlauben Wiederverarbeitung; unbekannte Scores und spätere Neubewertungen werden ausdrücklich unterschieden. Public-Key-CLI ohne Writer-Lock oder Ticketversand. Persistente Fälle, SSO-Rollen und SEALED bleiben offen. [Regeln und API](ENTERPRISE_INCIDENTREGELN.md) · [Fortgeschriebener Plan](ENTERPRISE_NAECHSTE_SCHRITTE.md).

---

# Dauerhafter Policystand — 14. Oktober 2026

721 Tests im Gesamtgate. Policyversionen und Schlüsselwiderrufe werden vor Bestätigung in einem signierten Journal synchronisiert und nach Neustart wieder geprüft. Rollback, gleiche Version mit anderem Inhalt, Uhr-Rücklauf und Schreibfehler autorisieren keine neue Entscheidung. Node-only; produktiver Policykanal, OS-/Rollenintegration und SEALED bleiben offen. [Verhalten und Recovery](ENTERPRISE_POLICY_STATE.md) · [Fortgeschriebener Plan](ENTERPRISE_NAECHSTE_SCHRITTE.md).

---

# Public-Key-Prüfung und priorisierte Fortsetzung — 14. Oktober 2026

711 Tests im Gesamtgate. Speicherauftragsjournal und sechssprachiger Report sind nun mit öffentlichen Schlüsseln prüfbar, ohne Writer-Lock oder Journaländerung. Sechs neue negative/CLI-Prüfungen; kein SEALED-Nachweis. Extension-Release 1.22.0 bleibt unverändert. [Prüfung](ENTERPRISE_PUBLIC_KEY_PRUEFUNG.md) · [Ausführungsplan](ENTERPRISE_NAECHSTE_SCHRITTE.md).

---

# Einrichtungsassistent — 1.22.0

705 Tests und 96 Chromium-Zustände bestanden; 0 Lint-Fehler / 24 bekannte Thunderbird-Warnungen. Dreistufiger, sechssprachiger Assistent nach Erstinstallation, keine automatische Öffnung bei Updates. Speichert nur Linkschutz und Abschlussmarker, keine Einwilligung oder API-Schlüssel. Paket: 40 Dateien / 693.352 Bytes entpackt, GPL-v3-Text enthalten. [Bedienung](EINRICHTUNGSASSISTENT.md) · [Release-Hinweise](releases/1.22.0.md) · [Offene Thunderbird-Live-Abnahme](live_test_1_22_0.md).

---

# GNU GPL v3 für den aktuellen Projektquelltext — 14. Oktober 2026

Lizenztext, Paketmetadaten, README-Dateien, aktuelle Store-Unterlagen und alle sechs Sprachseiten auf `GPL-3.0-only` umgestellt. Drittanbieterlizenzen bleiben erhalten. Neue Pakete enthalten verpflichtend den vollständigen GPL-v3-Lizenztext; zuvor veröffentlichte Releases wurden nicht ersetzt. [Lizenz und Geltungsbereich](license.md).

---

# Offline-Adminübersicht für Speicheraufträge — 14. Oktober 2026

690 Tests und 24 Chromium-Layouts bestanden; vollständiger Browserdownload trotz aktivem Filter geprüft. Sechssprachige Betriebsübersicht mit Status-/Anbieter-/Prüfbedarfsfiltern, Pagination, Kapazitätswarnung, Fehler-/Retry-Erklärungen und Versions-/Schutzfristen ergänzt. HTML und JSON sind unsignierte Momentaufnahmen ohne Schreibaktionen; SEALED und zentrale SSO-Rollen bleiben offen. [Bedienung und Grenzen](ENTERPRISE_STORAGE_ADMIN.md).

---

# Verständliche Speicherstatus — 14. Oktober 2026

679 Tests bestanden; 24 neue Chromium-Layouts für sechs Sprachen, zwei Breiten und helles/dunkles Design geprüft. Adminprüfung und Dokumentation erläutern jetzt „Lokal gespeichert“, „Speicher geprüft“ und „Geschützte Ablage bestätigt“ statt vorausgesetzter Fachkürzel. Die aufklappbare Adminhilfe ist vollständig sechssprachig. SEALED bleibt als noch nicht implementiert gekennzeichnet; Quellprotokolle, Signaturen und Extension-Runtime bleiben unverändert. [Erklärung mit Beispiel](ENTERPRISE_SPEICHERSTATUS.md).

---

# Cloudjobs und begrenzte Storage-Aufrufe — 14. Oktober 2026

679 Tests bestanden. S3/Azure/GCP an die persistente Job-API angebunden, Ziele/Schlüssel/Retention in Jobidentität gebunden. Gesamtzeitlimits, Abbruch, verlorene Antworten, Version-Readback und Cloudprozess-Recovery geprüft. Erfolgreiche SDK-Prüfungen bleiben CLOUD_OBSERVED mit SEALED=false; keine Cloudzugänge verwendet. [Bedienung, Grenzen und nächste Integration](ENTERPRISE_STORAGE_JOBS.md).

---

# Dauerhafte lokale Storage-Aufträge — 14. Oktober 2026

659 Tests bestanden. Signierter Jobworkflow mit stabiler Evidenz-/Zielbindung, Wiederaufnahme nach Prozessabbruch, Retry/Dead Letters und prüfbarem CLI-Status ergänzt. Der Worker verarbeitet ausschließlich lokale Simulationen; Cloudadapter sind noch nicht dauerhaft angebunden. Kein SEALED oder Broker-Retirement. [Betrieb und Recovery](ENTERPRISE_STORAGE_JOBS.md).

---

# Optionale Storage-Adapter — 14. Oktober 2026

639 Tests bestanden. S3-, Azure- und GCP-SDK-Adapter sowie lokaler Simulator implementiert. Profile bleiben deaktiviert; geprüft werden Identität/Region, Version, Schlüssel, Sperrfristen und tatsächlicher Readback. Cloudtests nutzen Testdoubles. Keine Cloudaktivierung, kein SEALED und kein Löschen von Brokerdaten. [Profile, Simulator und Abnahmegrenzen](ENTERPRISE_STORAGE_ADAPTER.md).

---

# Evidenzprüfung und Witness-Checkpoints — 14. Oktober 2026

618 Tests bestanden. Vollständige Ereignis-/Quittungsprüfung, signierte STAGED-Checkpoints und separater Witness implementiert. Ein extern gepinnter Witness-Hash schützt den bekannten Snapshot gegen gültiges Abschneiden und Forks. Snapshot und nur bezeugter Präfix werden ausdrücklich unterschieden. Kein SEALED und kein Löschen von Broker-Payloads. [Schnellstart und Vertrauensmodell](ENTERPRISE_EVIDENZPRUEFUNG.md).

---

# Dauerhafte Broker-Outbox — 14. Oktober 2026

598 Tests bestanden. Signierte Ereignisse und Sequenzen werden vor Zustellung dauerhaft gespeichert. Neustarts, verlorene Antworten, Rate-Limits, Dead Letters und Betreiber-Retry sind geprüft. STAGED-Quittungen löschen keine Daten; SEALED-Verifikation bleibt offen. [Schnellstart bis zur Admin-Review](ENTERPRISE_OUTBOX.md) · [Umsetzungsstand](ENTERPRISE_UMSETZUNGSSTAND.md).

---

# Lokaler Enterprise-Service und Admin-Prüfung — 14. Oktober 2026

576 Tests bestanden, keine Lint-Fehler, 24 neue Chromium-Reviewlayouts geprüft. Signierter Geräte-Ingest, dauerhaftes Journal, Teilergebnisse/Deduplizierung, verkettete STAGED-Quittungen, geschütztes Polling und sechssprachige Offline-Review/Exports implementiert. Score bei Entscheidung bleibt von späteren Bewertungen getrennt. Ausführbarer Repository-Baustein, kein aktivierter Unternehmensdienst und keine neue Extension-Runtime. [Start, Prüfung und Recovery](ENTERPRISE_LOKALER_SERVICE.md) · [Status aller Pakete](ENTERPRISE_UMSETZUNGSSTAND.md).

---

# Optionale Unternehmensprofile — 1.21.0

552 Tests bestanden, 0 Lint-Fehler / 24 bekannte Warnungen, 37 Runtime-Dateien / 616.949 Bytes entpackt und 24 Chromium-Layouts geprüft. Sechssprachiger Offline-Assistent unter Einstellungen, frei kombinierbare Hosting-/SSO-/MDM-/SIEM-/Ticketprofile, lokale Speicherung und JSON-Export sowie Node-CLI implementiert. Standard: lokale Vorbereitung ohne externe Verbindungen. Alle Profile sind deaktivierte Entwürfe, keine bereits funktionierenden Integrationen. [Profile und Bedienung](ENTERPRISE_SYSTEMPROFILE.md).

---

# Enterprise-Umsetzung — 14. Oktober 2026

Ein vorbereitender Node-only-Vertragskern mit Policy-/Eventvalidierung, JCS/Ed25519-Prüfung, Scope-/Versions-/Widerrufsprüfung, Entscheidungsmodell und Domain-only-Redaktion wurde implementiert. 14 neue Tests; Gesamtgate 531 Tests, keine Lint-Fehler, geprüftes XPI ohne diese Entwicklungsbausteine.

**Enterprise-Entwicklung mit optionalen Profilen fortgesetzt:** Eine feste Herstellerwahl ist keine Voraussetzung für Entwicklung und synthetische Tests. Produktive Parameter/Freigaben und reale Zielsysteme für F03/Abnahme bleiben offen. Kein produktiver Unternehmensbetrieb und keine Integration in die Extension aktiviert. [Status aller 30 Arbeitspakete und benötigte Voraussetzungen](ENTERPRISE_UMSETZUNGSSTAND.md).

---

# Enterprise-Umsetzungskonzept — 14. Oktober 2026

Die sechs gewünschten Unternehmenspunkte sind im [vollständigen Umsetzungskonzept](ENTERPRISE_UMSETZUNGSKONZEPT.md) ausgearbeitet. Enthalten sind Zielarchitektur, Geräte-/Serververtrauen, Richtlinien und Ausnahmen, SSO-/Rechtematrix, Incidents, Flottenzustand, Datenschutz-/Retentionregeln, 30 Arbeitspakete und Abnahmekriterien. [Entwurfsverträge](enterprise/README.md) ergänzen die Spezifikation.

Vertragsprüfung: 31 positive/negative Schemafälle bestanden; 30 eindeutig identifizierte Arbeitspakete und ihre Abhängigkeiten ohne Zyklen geprüft. Das sind Konzept-/Vertragsprüfungen, keine Implementierungs- oder Thunderbird-Abnahme. Version 1.21.0 ergänzt optionale Profilentwürfe; zentrale Enterprise-Dienste sind noch nicht implementiert.

---

# Linkprotokoll und Admin-Prüfung — 1.20.0

Version 1.20.0 ergänzt ein lokales Link-Entscheidungsprotokoll mit vollständiger URL, Score im Nachrichtenkontext, Anbieterurteil, Zeitstempeln und Entscheidungs-Snapshots. Filter, Seitenansicht, JSON-/CSV-Exporte und Hervorhebung risikoreicher Öffnungen sind in sechs Sprachen verfügbar. Das Protokoll ist separat vom Scan-Cache begrenzt und löschbar; es gibt keinen automatischen Upload oder manipulationssicheres zentrales Audit.

Prüfung: 517 Tests, 0 Lint-Fehler/24 dokumentierte Thunderbird-Warnungen, gültiges Paket mit 34 Runtime-Dateien. 48 Chromium-Layoutfälle prüfen Admin-Ansicht, Popup und Linkdialog. Echte Thunderbird-Abnahme steht aus.

[Release 1.20.0](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.20.0) · [Admin-Features und Roadmap](ADMIN_FEATURES.md) · [Live-Protokoll](live_test_1_20_0.md)

---

# Korrekturrelease 1.19.1 — 13. Oktober 2026

Die gemeldeten Regressionen aus 1.19.0 sind korrigiert: stabile Popup-Breite, Linköffnung über Thunderbirds Standardbrowser-Schnittstelle, gebrandeter und gegen E-Mail-CSS isolierter Dialog sowie strukturierte Risiko-, Nachrichten- und Zustimmungsinformationen. Alle sechs Sprachkataloge wurden ergänzt.

Prüfung: 493 automatisierte Tests, 0 Lint-Fehler/23 dokumentierte Thunderbird-Warnungen und gültiges Paket. 30 Chromium-Layoutfälle prüfen sechs Sprachen, helle/dunkle Darstellung, schmale Ansichten und 200 % Zoom. Browser-Vorschauen sind im [Regressionstest-Protokoll](live_test_1_19_1.md) ausdrücklich als simulierte Darstellung gekennzeichnet; echte Thunderbird-Abnahme bleibt offen.

[Release 1.19.1](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.19.1) · [Release-Hinweise](releases/1.19.1.md) · [GitHub Pages](https://vazules.github.io/Thunderbird-Antivirus/)

---

# Veröffentlichter GitHub-Release: 1.19.0 (13. Oktober 2026)

Die Umsetzung des [Optimierungsplans](AUFGABENPLAN_OPTIMIERUNG_I18N.md) enthält sechs vollständig mitgelieferte Sprachkataloge und Korrekturen an Zustimmung, Scanfreigabe, Linkschutz, Caches, Datenzugriff und CI. Version 1.19.0 ist als [unsignierter GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.19.0) veröffentlicht. Commit/Tag: `ea2b9a745531018c69d75f66617f5502f415ebbb` / `v1.19.0`. [CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/38472152400), [Release-Workflow](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/38472222591) und [GitHub-Pages-Deployment](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/38472152582) waren erfolgreich. Eine Store-Signierung ist nicht erfolgt. Reale Thunderbird-Abnahme und Screenshots stehen aus: [Live-Protokoll 1.19.0](live_test_1_19_0.md).

Veröffentlichtes XPI: `thundy-av-1.19.0.xpi`, 149.748 Bytes; SHA-256: `f0ca2ebf9b27be1a15b7efb5b106e96ddef4130a5089c482db9edbf4f6573371`. Das heruntergeladene Asset stimmt mit der veröffentlichten Prüfsumme und allen Inhalten des lokal geprüften Pakets überein.

Die nachfolgenden Release-Angaben und Messwerte dokumentieren den historischen Stand von 1.6.2. Aktueller lokaler Gate: 485 Tests bestanden, 0 Lint-Fehler/22 bekannte Thunderbird-Warnungen; gültiges Paket mit 31 Dateien und 519.476 Bytes entpackt. Details stehen im Ausführungsstand des Optimierungsplans.

---

# Status – Thundy AV (Stand: 1. Oktober 2026)

**Add-on:** Thundy AV – Email Scanner for Thunderbird · **Version 1.6.2** · **ID** `thundy-av@bludau-it-services.de`
**Zielplattform:** Thunderbird 140.0 oder neuer (Manifest V3) · **Lizenz zum damaligen Release:** MIT; aktueller Quelltext: GNU GPL v3 (`GPL-3.0-only`, siehe [Lizenzinformationen](license.md))
**Snapshot:** Branch `cline/k0d34w90` (Einreichungskandidat, Entscheidung D1 in [decisions.md](decisions.md))

## Veröffentlichte Version 1.6.2

| Feld | Wert |
|---|---|
| Release | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.2 (kein Pre-Release → „Latest“) |
| Commit / Tag | `a94c9ec` / `v1.6.2` |
| Asset | `thundy-av-1.6.2.xpi`, 53.277 Bytes (byte-identisch mit dem geprüften web-ext-Build) |
| SHA-256 | `12cd335b140cb745c158dacb69db2105c253716f7d4d4f0a5bb242b89689cdee` |
| Release-Notes | im Release + [CHANGELOG.md](../CHANGELOG.md) + [store_listing.md](store_listing.md) §6 |
| Pull Request | https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/641 (Zusammenführen nach `main` empfohlen) |

Ablauf und Begründung: D11 in [decisions.md](decisions.md). ATN kennt weiterhin keine Version dieses
Add-ons (API-Abfrage → 404); die Einreichung dort ist noch offen (siehe „Remaining“).

## Store-Readiness-Paket: umgesetzt (Arbeitslauf 2026-10-01)

Die Blocker und hohen Befunde aus [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md)
wurden abgearbeitet. Alle Zahlen unten sind in diesem Arbeitslauf **gemessen**:

| Gate | Kommando | Ergebnis |
|---|---|---|
| Pre-Submit-Checks | `npm run pre-submit-checks` | **0 Fehler**, 1 Warnung (Screenshots fehlen) |
| Tests | `npm test` | **427 Tests, 0 Fehler** (vorher 389; neue Suiten: Consent/Tier, Manifest-Invarianten, Gate) |
| Lint | `npm run lint:filtered` | **0 Fehler, 19 Warnungen**, alle als Thunderbird-False-Positive kuratiert |
| Paket | `npm run package` | **17 Dateien, 196.507 Bytes entpackt** (53.277 Bytes ZIP), „Package content is valid.“ |
| Go/No-Go | `npm run store-gate` | **NO-GO**: C1–C4 + C7 PASS, offen sind C5 (Screenshots) und C6 (Live-Test) |

### Was in diesem Lauf geändert wurde

- **Daten-Deklaration (P0-1):** `data_collection_permissions` auf `required: ["none"]`,
  `optional: ["personalCommunications"]`; `options.js` fragt die Zustimmung per
  `permissions.request({ data_collection: ['personalCommunications'], permissions: ['sensitiveDataUpload'] })`
  in der Nutzergeste an und entfernt sie beim Abschalten. Die zu strenge Hausregel im Pre-Submit-Check
  wurde an das Validatorverhalten angeglichen.
- **Datenschutz-Stufe (P0-2):** Manueller Anhang-Upload (ab `balanced`) und manueller URL-Scan (nur `max`)
  prüfen jetzt `privacyTier`; in `strict` erscheint ein Hinweis mit Link in die Einstellungen. Policy,
  Listing und Reviewer-Notes beschreiben dieses Verhalten.
- **Popup (P0-7, P0-9):** `fetch_hybrid_report` überträgt nur mit globaler Zustimmung; die defekten
  Bezeichner (`syncFragment`, `container`) sind korrigiert, der Analysebereich rendert wieder und zeigt
  ohne Zustimmung das lokal gespeicherte Ergebnis.
- **Kontextmenüs (P0-8):** Berechtigung `menus` ergänzt; beide Einträge sind damit nutzbar.
- **Paket-Gate (P0-6):** Scratch-Dateien entfernt, Entwickler-Skripte nach `tools/*.dev.js` verschoben,
  `.webextignore` gelöscht (wird von `web-ext` nicht gelesen); die Paketprüfung wählt das Artefakt nach
  Version/Zeit statt lexikografisch.
- **Fehler-/Rechtepfade (P1-12, P2-23, P2-24):** `requireHostPermission()` vor jedem Provider-Aufruf,
  automatischer Upload über `apiGateway.fetchWithTimeout`, Banner führt bei verweigerter Berechtigung
  in die Einstellungen, IP-Reputations-Cache speichert keine „ohne Zustimmung“-Ergebnisse mehr.
- **MV3-Hygiene (P1-9, P1-10):** MV2-Fallbacks und den nicht existierenden
  `scripting.messageDisplay.executeScript`-Zweig entfernt; Injektionsfehler werden dem Nutzer gemeldet.
- **Gates (P1-7, P1-8):** Die Lint-Allow-Liste enthält die in MV3 entfernten APIs nicht mehr.
  Pre-Submit-Checks erzwingen zusätzlich die `menus`-Berechtigung, die Daten-Deklaration samt
  Laufzeit-Anfrage und verbieten MV3-entfernte APIs in Laufzeitdateien. Der volle CI-Gate liegt in
  [docs/ci/](ci/README.md) (Push unter `.github/workflows/` scheitert am Token ohne `workflows`-Scope,
  reproduziert); lokal: `npm run check`.
- **Doku (P1-11 und folgende):** Privacy-Policy (DE/EN), Store-Listing, Reviewer-Notes, READMEs,
  Quickstart, Store-Assets, Screenshot-Guide und Doku-Index auf den geprüften Stand gebracht;
  Kategorie „Privacy and Security“ (ATN-Slug), Origins exakt wie in `options.js` angefragt.
- **Testmittel (P2-17):** `testdata/` mit fünf Testnachrichten samt Erwartungen je Datenschutz-Stufe,
  Live-Test-Protokoll [live_test_protocol.md](live_test_protocol.md).

### Befund-Status

| Befund | Status | Nachweis |
|---|---|---|
| P0-1 Daten-Deklaration | **behoben** | `manifest.json`, `options.js`, Pre-Submit-Check, Tests |
| P0-2 Manuelle Pfade vs. Stufe | **behoben** | `background.js` (Tier-Gates), Tests, Doku |
| P0-3 Live-Test in TB 140 ESR | **offen (manuell)** | Protokoll bereit: `docs/live_test_protocol.md` |
| P0-4 Screenshots/Listing | **offen (manuell)** | Gate-Kriterium C5 |
| P0-5 Divergente Linien | **erledigt** | D1/D11 in `docs/decisions.md`; Version 1.6.2 mit Tag `v1.6.2` veröffentlicht |
| P0-6 Paket-Gate rot | **behoben** | `npm run package` → valid, 17 Dateien |
| P0-7 Popup ohne Konsent | **behoben** | `api.js`, Regressionstests |
| P0-8 `menus`-Berechtigung | **behoben** | `manifest.json`, Pre-Submit-Check; Live-Test offen |
| P0-9 Popup-`ReferenceError` | **behoben** | `api.js`, ESLint-Prüfung im Gate |
| P1-7 CI-Testumfang | **behoben (Spiegel)** | `docs/ci/ci.yml`; Aktivierung braucht `workflows`-Berechtigung |
| P1-8 Lint-Filter | **behoben** | `scripts/filter-lint-warnings.js`, Pre-Submit-Check |
| P1-9 Toter Injektionszweig | **behoben** | `background.js`, Tests |
| P1-10 MV2-Altpfade | **behoben** | Code + Pre-Submit-Check |
| P1-11 Doku-Drift | **behoben** | Doku-Update in diesem Lauf |
| P1-12 Host-Recht/`fetch` | **behoben** | `requireHostPermission`, Gateway, Tests |
| P1-13 Release-/Repo-Hygiene | **behoben** | `pnpm-lock.yaml` entfernt, Dev-Skripte unter `tools/`; Release 1.6.2 veröffentlicht → 2024er-Release ist nicht mehr „Latest“ |
| P1-14 Signier-Endpunkt | **behoben (Spiegel)** | `docs/ci/release.yml` (`--amo-base-url`) |
| P1-15 Approval-Timeout | **behoben (Spiegel)** | `docs/ci/release.yml` (`--approval-timeout 0`) |
| P2-14 … P2-24 | **überwiegend behoben** | Einzelbelege in der Problemanalyse, `git log` |
| P3-20 … P3-25 | **überwiegend behoben** | Einzelbelege in der Problemanalyse, `git log` |

## Remaining (manuell, nicht in dieser Umgebung möglich)

- **Live-Test in Thunderbird 140 ESR (Pflicht vor der Einreichung):** Protokoll in
  [live_test_protocol.md](live_test_protocol.md) abarbeiten (Banner, Kontextmenü, Time-of-Click,
  Permission-Geste, Stufen-Gate, Popup, HTML-Entschärfen, Cache leeren) — Testdaten liegen in
  `testdata/`.
- **Echte Screenshots** (PNG, ≥ 1200 px breit) gemäß [screenshot_capture.md](screenshot_capture.md);
  danach meldet der Pre-Submit-Check 0 Warnungen und Kriterium C5 wird grün.
- **ATN-Listung, Signierung, Store-URL:** Listing-Felder aus [store_listing.md](store_listing.md);
  signieren mit `npx web-ext sign --amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed
  --approval-timeout 0`; danach Store-URL in README/Listing/Landing-Page ergänzen.
- **Optional:** Lokalisierung der Options-/Popup-Oberfläche (derzeit deutsch; Manifest-Strings und Banner
  sind en/de lokalisiert).

## Referenzen

- Befunde: [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) · Aufgabenplan:
  [AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md) · Entscheidungen:
  [decisions.md](decisions.md) · Rohbelege: [audits/](audits/)
- Datenschutzerklärung: [privacy_policy.md](privacy_policy.md) · live:
  https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html
- Reviewer-Hinweise: [reviewer_notes.md](reviewer_notes.md) · Listing-Entwurf:
  [store_listing.md](store_listing.md) · Testdaten: [../testdata/](../testdata/)

