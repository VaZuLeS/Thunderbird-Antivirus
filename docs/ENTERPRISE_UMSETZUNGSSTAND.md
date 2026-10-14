# Enterprise-Umsetzung: Arbeitsstand und optionale Profile

Stand: 14. Oktober 2026. Bezug: [vollständiges Umsetzungskonzept](ENTERPRISE_UMSETZUNGSKONZEPT.md).

**Entwicklung mit optionalen Systemprofilen fortgesetzt; vollständige Enterprise-Umsetzung noch offen.** Version 1.21.0 liefert einen sechssprachigen Offline-Profilassistenten und JSON-Export. Verbreitete Systeme sind frei kombinierbare Möglichkeiten; eine feste Herstellerwahl ist keine Entwicklungsvoraussetzung. Der Node-Vertragskern bleibt außerhalb des XPI. Produktive Enterprise-Verbindungen sind weiterhin nicht implementiert.

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
| C01 | Offen | Echtes Enrollment, geschützte Gerätebindung, Rotation/Widerruf |
| C02 | Offen | Persistente, geschützte Broker-Outbox und Sequenzen |
| C03 | Vorarbeit | Payload-/Scope-Prüfung vorhanden; kein authentifizierter Ingest, Commit oder Deduplizierung |
| C04 | Offen | Echte Quittungen, Polling, Backlog und Dead Letters |
| C05 | Offen | SIEM-Ziel, Connector-Outbox, Wiederholungen und SSRF-/Credential-Tests |
| P01 | Vorarbeit | Signatur-/Scope-/Zeit-/Versionsprüfung vorhanden; kein freigegebener Policykanal oder persistenter Vertrauens-/Rollback-Speicher |
| P02 | Vorarbeit | Entscheidungsmodell vorhanden; keine Runtime-/UI-/Managed-Integration, Legacyroute noch unverändert |
| P03 | Offen | Rollenberechtigter Editor, Diff, Simulation, Freigabe und Rollout |
| P04 | Offen | Antrag, getrennte Freigabe und einmaliger Ticketverbrauch |
| P05 | Vorarbeit | Unknown-/Warn-/Ack-Gates im Modell; echte Broker-/Quittungs-/Ausfallintegration fehlt |
| E01 | Offen | Authentifizierte Geräteevents, signierte Receipts und echte STAGED→SEALED-Ablage |
| E02 | Offen | Checkpoints, unabhängige Verankerung und Offline-Evidenzverifikation |
| E03 | Offen | Object Locks, Rotation, Aufbewahrung und Restore auf gewählter Infrastruktur |
| A01 | Offen | OIDC-BFF, Session-/CSRF-/MFA-/Logouttests mit tatsächlichem IdP |
| A02 | Offen | Rollen-/Organisations-/Objektrechte und negative API-/Exporttests |
| A03 | Offen | Reveal, Identity Resolve, Break Glass und Zugriffsaudit |
| I01 | Offen | Incidentmodell, Regelversionen, Prioritäten und Lebenszyklus |
| I02 | Offen | Sechssprachiges zentrales Portal und authentifizierte Exporte |
| I03 | Offen | Gewählter Ticketadapter und geprüfte Webhooks |
| I04 | Offen | Zustellalarme, SLA, Eskalation und Alarmdämpfung |
| H01 | Offen | Minimierter, authentifizierter Heartbeat und Flottenzustände |
| H02 | Offen | Zentrale Versions-/Policy-/Queue-/Providerzustände |
| D01 | Vorarbeit | Domain-only-Lecktests vorhanden; keine freigegebenen Datenprofile, Rollen- oder Vaultintegration |
| D02 | Offen | Klassenweise Retention-/Hold-/Löschjobs, Backupjournal und Berichte |
| Q01 | Vorarbeit | Bestehende Extension-/neue Kerntests bestehen; E1–E6-Gesamtintegration, Last, Chaos und echte Zielsysteme fehlen |
| Q02 | Offen | Signierte OS-/Extension-Pakete, vollständige Runbooks und genehmigter Pilot |

Nächste Entwicklung: Enrollment/Outbox/Ingest und optionale Adapter mit synthetischen Daten aufbauen. Vor produktivem Pilot F01–F04 anhand der tatsächlich gewählten Profile und realen Nachweise schließen. Die neue Bibliothek kann dabei weiterverwendet werden; sie ist weder Ersatz für diese Voraussetzungen noch Nachweis der gesamten Lösung.
