# Enterprise-Umsetzung: Arbeitsstand und Blocker

Stand: 14. Oktober 2026. Bezug: [vollständiges Umsetzungskonzept](ENTERPRISE_UMSETZUNGSKONZEPT.md).

**Gesamtziel blockiert, nicht abgeschlossen.** Die vorhandene Extension 1.20.0 behält ihre lokalen Funktionen. Neue Vorarbeit ist ausschließlich ein Node-only-Vertragskern außerhalb des ausgelieferten XPI. Kein produktiver Unternehmensbetrieb und keine neue externe Datensammlung wurden eingerichtet.

## Konkret implementierte Vorarbeit

[Vertragskern und Tests](https://github.com/VaZuLeS/Thunderbird-Antivirus/blob/main/enterprise/README.md): Policy-/Event-Schemaprüfung mit Formaten, semantische Beziehungen, JCS/Ed25519-Policyprüfung, Scope und Widerruf, aktuelle Version-/Gruppensperren, risikoorientiertes Entscheidungsmodell sowie Domain-only-Redaktion. Geprüfte Payloads werden kopiert und tief eingefroren; NaN/Infinity können nicht unbemerkt zu unbekannten Scores werden.

14 zusätzliche Tests inklusive echter kryptografischer Signaturen, Manipulation, falscher Identität, abgelaufener/widerrufener Schlüssel, Rollback, fehlender Capabilities, riskanter Unknown-Kombinationen, Broker-Ausfall und URL-Leckfällen bestanden. Gesamtgate: **531 Tests bestanden**, **0 Lint-Fehler / 24 dokumentierte Thunderbird-Warnungen**, gültiges Paket mit **34 Runtime-Dateien / 586.716 Bytes entpackt**. Der gesamte `enterprise/`-Entwicklungsbereich ist aus dem XPI ausgeschlossen und in der Paketprüfung verboten.

Das Entscheidungsmodell vertraut einem späteren authentifizierten Broker-Kontext. Es implementiert noch keine echte Enrollment- oder Quittungsprüfung und wird nicht vom Nachrichten-Linkdialog aufgerufen. Das Testsignal `intentSealed` ersetzt keine signierte Serverquittung. Erfolgreiche Unit-Tests sind keine Enterprise-Abnahme.

## Was die vollständige Fortsetzung blockiert

Im ausgewählten Cloud-Umfeld wurden aktuelle, leere Bindungen für Unternehmensidentitäten, Secrets und Infrastruktur-Capabilities beobachtet. Es gibt keine festgelegten Unternehmens-Endpunkte/Identitäten. Hier ist nur Linux vorhanden und kein Thunderbird-Binary; echte Windows-/macOS-/Thunderbird-Abnahmen sind nicht möglich.

F01–F03 fordern ausdrücklich Unternehmensentscheidungen und reale Nachweise. Konzeptwerte sind Vorschläge, keine Freigaben. Benötigt werden:

| Voraussetzung | Konkrete Eingabe / Bereitstellung |
|---|---|
| Hosting | Betreiber, Organisation, Datenregion, freigegebene Umgebung, DNS/TLS, Datenbank, Object-Lock- und Schlüsselverwaltung |
| SSO | IdP/Issuer, Clientregistrierung, Gruppen-/MFA-Zuordnung, Rollenverantwortliche und verfügbare Testidentitäten |
| Geräteverwaltung | MDM/Verteilverfahren, Ziel-OS und echte Testsysteme für Thunderbird 140 ESR / aktuelle Version; Brokerinstallation und Signing-Verfahren |
| SIEM / Tickets | Je ein gewähltes MVP-System, API-/Auth-Verfahren, Test-Endpunkte und verantwortliche Ansprechpartner |
| Datenfreigabe | Bestätigte Datenklassen, Domain-only/Detailprofil, Fristen/Backups, Identitätsauflösung und zuständige Freigeber |
| Öffnungsregeln | Verbindliche Schwellen, Unknown-/Offlineverhalten, Auditpflicht, Ausnahmerollen und Freigabeprozess |
| Betriebsfreigabe | Verantwortliche für Security/Datenschutz/Betrieb, SLO/RPO/RTO und zulässiger Pilot |

Konfigurations- und Testzugänge über die ausführende Umgebung bereitstellen; im Repository werden keine echten Secrets als Platzhalter hinterlegt. Ohne diese Angaben wird kein Unternehmens-Endpunkt erfunden, keine echte Benutzeraktivität übertragen und keine fehlende Freigabe als erledigt markiert.

## Status aller Arbeitspakete

„Vorarbeit“ bezeichnet lokal getestete Bausteine; die im Konzept verlangte vollständige Abnahme ist weiterhin offen. „Offen“ bedeutet nicht implementiert; externe Integrationen sind zusätzlich von den genannten Voraussetzungen abhängig.

| Paket | Status | Fehlender Nachweis / nächster Schritt |
|---|---|---|
| F01 | Blockiert | Hosting, Region, IdP, SIEM/Ticket und Betreiberentscheidung |
| F02 | Blockiert | Autorisierte Daten-/Retention-/Rechtematrix und Ausfallmodus |
| F03 | Blockiert | Reale OS-/Thunderbird-/MDM-/Native-Messaging-Spikes |
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

Nach Bereitstellung: zunächst F01–F04 verbindlich schließen, dann Enrollment/Outbox/Ingest und SSO-Rechte aufbauen. Die neue Bibliothek kann dabei weiterverwendet werden; sie ist weder Ersatz für diese Voraussetzungen noch Nachweis der gesamten Lösung.
