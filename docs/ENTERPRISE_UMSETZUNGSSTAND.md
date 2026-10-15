# Enterprise-Umsetzung: Arbeitsstand und optionale Profile

Stand: 15. Oktober 2026. Bezug: [vollständiges Umsetzungskonzept](ENTERPRISE_UMSETZUNGSKONZEPT.md).

**Entwicklung mit optionalen Systemprofilen fortgesetzt; vollständige Enterprise-Umsetzung noch offen.** Version 1.21.0 liefert einen sechssprachigen Offline-Profilassistenten und JSON-Export. Verbreitete Systeme sind frei kombinierbare Möglichkeiten; eine feste Herstellerwahl ist keine Entwicklungsvoraussetzung. Der Node-Vertragskern bleibt außerhalb des XPI. Ein [lokaler Entwicklungsservice mit signiertem Ingest, STAGED-Quittungen und sechssprachiger Offline-Adminprüfung](ENTERPRISE_LOKALER_SERVICE.md) wurde ergänzt. Produktive Enterprise-Verbindungen sind weiterhin nicht implementiert.

Aktuelles Gesamtgate nach Service-Erweiterung: **813 Tests bestanden**, **0 Lint-Fehler / 24 bekannte Warnungen**. 24 weitere Chromium-Layouts der sechssprachigen Offline-Review bestanden. Der Prozessabbruchtest erhält die bestätigte Quittung nach geprüftem Neustart. Version 1.22.0 ergänzt den sechssprachigen Installationsassistenten; das Paket umfasst 40 Dateien / 693.352 Bytes und GPL-v3-Lizenztext. Die Node-Enterprise-Bausteine bleiben außerhalb des XPI. Die [Broker-Outbox](ENTERPRISE_OUTBOX.md) ergänzt dauerhafte Sequenzen, signierte Queueaktionen, Retry/Dead Letters, geprüfte STAGED-Annahme und lokale Zustellung bis zur bestehenden Admin-Review. Der [separate Witness und vollständige Offline-Evidenzprüfer](ENTERPRISE_EVIDENZPRUEFUNG.md) erkennen zusätzlich Forks und abgeschnittene Enden gegen einen extern gepinnten Checkpoint; STAGED bleibt ohne Payload-Retirement. [Optionale Storage-SDK-Adapter und lokaler Simulator](ENTERPRISE_STORAGE_ADAPTER.md) prüfen jetzt versionsgebundene Inhalte, Ziele/Regionen, Verschlüsselung und Sperrfristen. Es wurden keine Cloudzugänge verwendet; kein SEALED oder Retirement wird dadurch freigegeben. Der [dauerhafte Storage-Jobworkflow](ENTERPRISE_STORAGE_JOBS.md) speichert geprüfte Evidenzaufträge, Versuche, Retry/Dead Letters und Simulationsabschlüsse mit signiertem Recovery-Journal. S3/Azure/GCP sind über eine explizite Bibliotheks-API mit Gesamtzeitlimits, Abbruch und versionsgebundenen CLOUD_OBSERVED-Einträgen angebunden. Reale Cloudabnahme, produktiver Workerbetrieb und SEALED-Commit bleiben offen. Kein vollständiges Enterprise-Arbeitspaket wird allein durch diese lokale Vorarbeit als abgenommen markiert.

Die [sechssprachige Offline-Betriebsübersicht für Speicheraufträge](ENTERPRISE_STORAGE_ADMIN.md) zeigt jetzt Fehler, Wiederholungen, Kapazität, Versionen und Schutzfristen; Export ist eine unsignierte Statuszusammenfassung. Zentrale SSO-/Rollenprüfung und Livebetrieb bleiben offen.

[Unabhängiger Public-Key-Prüfpfad](ENTERPRISE_PUBLIC_KEY_PRUEFUNG.md) und [priorisierte nächste Schritte](ENTERPRISE_NAECHSTE_SCHRITTE.md). Die Jobprüfung benötigt keinen privaten Schlüssel; reale Trustverteilung und SEALED bleiben offen.

[Speicherstatus ohne Fachkürzel erklärt](ENTERPRISE_SPEICHERSTATUS.md). Die sechssprachige Offline-Adminansicht zeigt verständliche Ablagebezeichnungen und eine aufklappbare Statuserklärung; technische Exportkennungen bleiben erhalten.

[Verfügbare Profile, Export und CLI](ENTERPRISE_SYSTEMPROFILE.md). Standard: lokale Vorbereitung, externe Bereiche deaktiviert. Auswahl, Speicherung und Export aktivieren keine Datenübertragung.

## Konkret implementierte Vorarbeit

[Vertragskern und Tests](https://github.com/VaZuLeS/Thunderbird-Antivirus/blob/main/enterprise/README.md): Policy-/Event-Schemaprüfung mit Formaten, semantische Beziehungen, JCS/Ed25519-Policyprüfung, Scope und Widerruf, aktuelle Version-/Gruppensperren, risikoorientiertes Entscheidungsmodell sowie Domain-only-Redaktion. Geprüfte Payloads werden kopiert und tief eingefroren; NaN/Infinity können nicht unbemerkt zu unbekannten Scores werden.

14 Vertragskerntests inklusive echter kryptografischer Signaturen, Manipulation, falscher Identität, abgelaufener/widerrufener Schlüssel, Rollback, fehlender Capabilities, riskanter Unknown-Kombinationen, Broker-Ausfall und URL-Leckfällen bestanden. Gesamtgate 1.21.0: **552 Tests bestanden**, **0 Lint-Fehler / 24 dokumentierte Thunderbird-Warnungen**, gültiges Paket mit **37 Runtime-Dateien / 616.949 Bytes entpackt**. Profiltests prüfen alle 3.125 Kombinationen, Speicherung/Export/Reset in sechs Sprachen und CLI-Schreibschutz; 24 Chromium-Layoutfälle bestanden. Der gesamte `enterprise/`-Entwicklungsbereich ist aus dem XPI ausgeschlossen und in der Paketprüfung verboten.

Das Entscheidungsmodell vertraut einem späteren authentifizierten Broker-Kontext. Es implementiert noch keine echte Enrollment- oder Quittungsprüfung und wird nicht vom Nachrichten-Linkdialog aufgerufen. Das Testsignal `intentSealed` ersetzt keine signierte Serverquittung. Erfolgreiche Unit-Tests sind keine Enterprise-Abnahme.

## Voraussetzungen für produktive Aktivierung und reale Abnahme

Im ausgewählten Cloud-Umfeld wurden aktuelle, leere Bindungen für Unternehmensidentitäten, Secrets und Infrastruktur-Capabilities beobachtet. Es gibt keine festgelegten Unternehmens-Endpunkte/Identitäten. Hier ist nur Linux vorhanden und kein Thunderbird-Binary; echte Windows-/macOS-/Thunderbird-Abnahmen sind nicht möglich.

Auf Wunsch werden verbreitete Systeme optional angeboten. Entwicklung und synthetische Tests benötigen keine feste Herstellerentscheidung. Für produktive Aktivierung und die realen Nachweise aus F01–F03 werden dagegen konkrete Parameter und Freigaben benötigt:

| Voraussetzung | Konkrete Eingabe / Bereitstellung |
|---|---|
| Hosting | Betreiber, Organisation, Datenregion, freigegebene Umgebung, DNS/TLS, Datenbank, Object-Lock- und Schlüsselverwaltung |
| SSO | IdP/Issuer, Clientregistrierung, Gruppen-/MFA-Zuordnung, Rollenverantwortliche und verfügbare Testidentitäten |
| Geräteverwaltung | MDM/Verteilverfahren, Ziel-OS und echte Testsysteme für Thunderbird 140 ESR / aktuelle Version; Brokerinstallation und Signing-Verfahren |
| SIEM / Tickets | Nur für aktivierte optionale Adapter: API-/Auth-Verfahren, Test-Endpunkte und verantwortliche Ansprechpartner |
| Datenfreigabe | Bestätigte Datenklassen, Domain-only/Detailprofil, Fristen/Backups, Identitätsauflösung und zuständige Freigeber |
| Öffnungsregeln | Verbindliche Schwellen, Unknown-/Offlineverhalten, Auditpflicht, Ausnahmerollen und Freigabeprozess |
| Betriebsfreigabe | Verantwortliche für Security/Datenschutz/Betrieb, SLO/RPO/RTO und zulässiger Pilot |

Konfigurations- und Testzugänge über die ausführende Umgebung bereitstellen; im Repository werden keine echten Secrets als Platzhalter hinterlegt. Ohne diese Angaben wird kein Unternehmens-Endpunkt erfunden, keine echte Benutzeraktivität übertragen und keine fehlende Freigabe als erledigt markiert.

## Status aller Arbeitspakete

„Vorarbeit“ bezeichnet lokal getestete Bausteine; die im Konzept verlangte vollständige Abnahme ist weiterhin offen. „Offen“ bedeutet nicht implementiert; externe Integrationen sind zusätzlich von den genannten Voraussetzungen abhängig.

| Paket | Status | Fehlender Nachweis / nächster Schritt |
|---|---|---|
| F01 | Vorarbeit | Optionale Profile/Assistent/CLI implementiert; produktive Region, Endpunkte und Betreiber noch offen |
| F02 | Aktivierungsfreigabe offen | Autorisierte Daten-/Retention-/Rechtematrix und Ausfallmodus |
| F03 | Reale Abnahme offen | Reale OS-/Thunderbird-/MDM-/Native-Messaging-Spikes |
| F04 | Vorarbeit | Semantische Vertrags-/Signaturtests vorhanden; freigegebenes Bedrohungsmodell, Recovery und Unternehmensreview fehlen |
| C01 | Vorarbeit | Lokale Testregistrierung/Signaturprüfung vorhanden; geschütztes Enrollment, Gerätebindung und Rotation fehlen |
| C02 | Vorarbeit | Persistente signierte POSIX-Outbox, atomare Sequenzen, Kapazität/Recovery und Retry implementiert; geschützter OS-Broker, Rotation, echte Offline-/OS-Abnahme fehlen |
| C03 | Vorarbeit | Signierter lokaler Ingest, dauerhafte Annahme, Deduplizierung und Teilergebnisse implementiert; Unternehmens-DB/Transport, Quarantäne und Betriebsabnahme fehlen |
| C04 | Vorarbeit | Lokale Brokerzustellung, geprüfte STAGED-Quittungen, Polling, Status/Dead Letters und protokollierter Retry vorhanden; SEALED, laufende Adminansicht und OS-/Enterprise-Integration fehlen |
| C05 | Vorarbeit | Vier optionale SIEM-Offlineformate, signierte dauerhafte Exportqueue, Deduplizierung/Backoff/Recovery und Eingabe-/Credential-Lecktests vorhanden; Netzwerktransport/Anbieterabnahme offen |
| P01 | Vorarbeit | Signatur-/Scope-/Zeit-/Versionsprüfung und persistenter signierter Versions-/Widerrufsstand vorhanden; produktiver Policykanal, OS-Schlüsselschutz und Migration fehlen |
| P02 | Vorarbeit | Entscheidungsmodell vorhanden; keine Runtime-/UI-/Managed-Integration, Legacyroute noch unverändert |
| P03 | Vorarbeit | Public-Key-Policy-Diff und konservative Offline-Simulation auf geprüften Entscheidungs-Snapshots vorhanden; Rolleneditor, Freigabe und Rollout offen |
| P04 | Offen | Antrag, getrennte Freigabe und einmaliger Ticketverbrauch |
| P05 | Vorarbeit | Unknown-/Warn-/Ack-Gates im Modell; echte Broker-/Quittungs-/Ausfallintegration fehlt |
| E01 | Vorarbeit | Signierte Geräteevents und verkettete STAGED-Receipts vorhanden; echte STAGED→SEALED/Object-Lock-Ablage fehlt |
| E02 | Vorarbeit | Vollständiger Offline-Prüfer, Public-Key-Jobverifier ohne Writer-Schlüssel, Server-Checkpoints, separater Witness, Pin-/Präfix-/Tail-/Fork-Prüfung vorhanden; produktive unabhängige Verankerung, Rotation und Betriebsabnahme fehlen |
| E03 | Vorarbeit | Optionale SDK-Adapter für S3/Azure/GCP mit Lock-/Retention-/Version-/Readback-Prüfung und Simulator sowie signierter Job-Queue/Recovery mit optionaler Cloud-API, Gesamtzeitlimits, CLOUD_OBSERVED und sechssprachiger Offline-Jobübersicht vorhanden; produktiver Worker und reale Anbieter-, IAM/KMS-, Restore-, Rotation- und Aufbewahrungsabnahme fehlen |
| A01 | Offen | OIDC-BFF, Session-/CSRF-/MFA-/Logouttests mit tatsächlichem IdP |
| A02 | Offen | Rollen-/Organisations-/Objektrechte und negative API-/Exporttests |
| A03 | Offen | Reveal, Identity Resolve, Break Glass und Zugriffsaudit |
| I01 | Vorarbeit | Versionierte Incidentregeln, Schweregrade, reproduzierbare IDs und geprüfte Entscheidungs-Snapshots vorhanden; dauerhafte lokale Fälle/Zuweisung/Lebenszyklus vorhanden; Unternehmensrollen, Portal und produktive Abnahme offen |
| I02 | Vorarbeit | Sechssprachige Offline-Review/Exports mit Filtern, Pagination und Entscheidungs-Snapshot vorhanden; Public-Key-Fallübersicht mit Filtern, Pagination und Verlauf vorhanden; laufendes Portal und Unternehmensrollen fehlen |
| I03 | Offen | Gewählter Ticketadapter und geprüfte Webhooks |
| I04 | Vorarbeit | Dauerhafte lokale Queue- und Heartbeat-Alarmkandidaten mit Pending-/ACK-CLI, Veraltungskennzeichnung, Dämpfung und Erholung vorhanden; externe Zustellung, SLA und Eskalation offen |
| H01 | Vorarbeit | Minimaler signierter Testgeräte-Heartbeat mit Scope/Sequenzen/Clock-Skew, Recovery und Public-Key-Prüfung vorhanden; reales Enrollment, Broker-/Runtimekanal und Flottenabnahme fehlen |
| H02 | Vorarbeit | Minimierte sechssprachige lokale Berichte für Ereignis-, Storage- und Connectorqueues vorhanden; geprüfte Testgeräte-Meldungen und dauerhafte lokale Frist-/Erholungskandidaten ergänzt; authentifizierte zentrale Flottenmessung offen |
| D01 | Vorarbeit | Domain-only-Incident-/SIEM-Exporte und minimierte Betriebsberichte geprüft; freigegebene Datenprofile, Ziel-Retention, Rollen und Vaultintegration fehlen |
| D02 | Offen | Klassenweise Retention-/Hold-/Löschjobs, Backupjournal und Berichte |
| Q01 | Vorarbeit | Bestehende Extension-/neue Kerntests bestehen; E1–E6-Gesamtintegration, Last, Chaos und echte Zielsysteme fehlen |
| Q02 | Offen | Signierte OS-/Extension-Pakete, vollständige Runbooks und genehmigter Pilot |

Nächste Entwicklung gemäß [priorisiertem Ausführungsplan](ENTERPRISE_NAECHSTE_SCHRITTE.md): Public-Key-Prüfung, dauerhafter Policy-Versions-/Widerrufsstand und [versionierte Incidentregeln](ENTERPRISE_INCIDENTREGELN.md) sowie Betriebsberichte und SIEM-Offlinequeue sind lokal implementiert; [N06-Nachweisprüfung](ENTERPRISE_N06_ABNAHME.md) ergänzt. Produktive N06-Abnahme bleibt wegen fehlender realer Systeme und unimplementierter SEALED-/SSO-/OS-Kernpfade blockiert. Vor produktivem Pilot F01–F04 anhand der tatsächlich gewählten Profile und realen Nachweise schließen. Die neue Bibliothek kann dabei weiterverwendet werden; sie ist weder Ersatz für diese Voraussetzungen noch Nachweis der gesamten Lösung.

Neue lokale Bausteine: [Betriebsberichte und Dämpfung](ENTERPRISE_BETRIEBSBERICHTE.md), [SIEM-Offlinequeue](ENTERPRISE_SIEM_EXPORTQUEUE.md), [N06-Nachweise und konkrete Blocker](ENTERPRISE_N06_ABNAHME.md). 24 Chromium-Layouts der neuen sechssprachigen Betriebsansicht geprüft. Unterlagenbereitschaft ist weder eine SEALED-Quittung noch eine Produktionsfreigabe.

[Dauerhafte lokale Incidentfälle](ENTERPRISE_INCIDENTFAELLE.md) ergänzen revisionsgebundene Bearbeitung, Reopening, Fallverlauf und Public-Key-Journalprüfung ohne Writer-Schlüssel. N07 lokal implementiert; N08 (Policy-Diff/Simulation) ist ebenfalls lokal umgesetzt; N09 (sechssprachige lokale Fallübersicht) ist ebenfalls lokal umgesetzt; N10 (dauerhafte Alarmkandidaten mit bestätigtem Abholen) ist ebenfalls lokal umgesetzt; N11 (signaturgeprüfte minimale Testgeräte-Heartbeats) und N12 (sechssprachige Testgeräte-Übersicht) sind ebenfalls lokal implementiert.

[Signierter Policy-Diff und Simulation](ENTERPRISE_POLICY_SIMULATION.md) vergleichen damalige Assessments im expliziten Modellkontext. Provider-/Retention-/Infrastrukturfolgen und historische Gruppenmitgliedschaft werden nicht als simuliert behauptet.

[Sechssprachige lokale Fallübersicht](ENTERPRISE_FALLUEBERSICHT.md): Public-Key-Prüfung vor HTML-Erstellung, Filter, minimierter vollständiger JSON-Download und lazy/paginierter Verlauf. 24 Chromium-Layouts und vollständige Downloads bei aktiven Filtern geprüft; keine zentrale SSO-/Portalabnahme.

[Dauerhafte Alarmkandidaten](ENTERPRISE_ALARMKANDIDATEN.md) bleiben bis zum ausdrücklichen lokalen ACK abrufbar. Verlorene Rückgaben neuer Beobachtungen, Backpressure, idempotente Bestätigung und Legacy-Kompatibilität geprüft; keine externe Zustellung oder nachträgliche Rekonstruktion alter Kandidaten behauptet.

[Signierte Testgeräte-Heartbeats](ENTERPRISE_HEARTBEATS.md) sind lokal implementiert (N11); nie gemeldete Geräte erhalten keine erfundene Kontaktzeit. Status beruht auf expliziter Testregistry und signierten Selbstauskünften. Die [sechssprachige lokale Übersicht](ENTERPRISE_HEARTBEAT_UEBERSICHT.md) (N12) ergänzt Public-Key-Prüfung vor Anzeige, Prüfkriterien, Status-/Problemfilter und vollständigen minimierten Download. N13 ergänzt [dauerhafte lokale Heartbeat-Alarmkandidaten](ENTERPRISE_HEARTBEAT_ALARME.md) mit Originaljournalprüfung, Fristen/Dämpfung, Erholung und bestätigter Übernahme. Als nächstes folgt N14 (sechssprachige lokale Alarmreview).
