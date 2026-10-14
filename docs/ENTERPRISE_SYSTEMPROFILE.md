# Optionale Unternehmensprofile — 1.21.0

Unter **Einstellungen → Optionale Unternehmensprofile** lassen sich verbreitete Systeme auswählen, kombinieren, lokal speichern und als JSON-Entwurf exportieren. Alle sechs Oberflächensprachen sind enthalten. Ein fest gewählter Hersteller ist damit keine Voraussetzung für die weitere Entwicklung.

Die Auswahl bereitet eine Integration vor. **Kein Backend, Broker, SSO-Login, SIEM-Adapter oder Ticketsystem wird dadurch gestartet oder verbunden.** Alle Integrationen bleiben `enabled: false`, der Entwurf `mode: disabled`; die Extension verwendet weiter das vorhandene lokale Linkprotokoll. „Lokale Vorbereitung“ installiert ebenfalls keinen Server.

| Bereich | Verfügbare Profile |
|---|---|
| Hosting | Lokale Vorbereitung, Eigenbetrieb, Microsoft Azure, AWS, Google Cloud |
| SSO | Deaktiviert, Microsoft Entra ID, Keycloak, Okta, allgemeines OpenID Connect |
| Geräteverwaltung | Deaktiviert, Microsoft Intune, Jamf Pro, Ansible, allgemeine MDM/Paketverteilung |
| SIEM | Deaktiviert, Splunk HEC, Microsoft Sentinel/Logs Ingestion, Elastic/Elasticsearch, HTTPS JSON |
| Tickets | Deaktiviert, Jira Cloud, Jira Data Center, ServiceNow, GitLab Issues |

Die vorgeschlagenen Kombinationen „Microsoft“, „Open Source“ und „AWS / Okta / Splunk / Jira“ sind editierbare Ausgangspunkte. Hosting, SSO, Geräteverwaltung, SIEM und Tickets bleiben unabhängig kombinierbar. Externe Bereiche können einzeln abgewählt werden. Der Standard ist lokale Vorbereitung ohne externe Systeme.

## Export und lokale Speicherung

Gespeichert werden nur die fünf Profilkennungen unter `enterpriseProfileSelection`. Scanfreigaben, API-Konfiguration und Linkprotokoll werden dabei nicht verändert. Zurücksetzen entfernt nur diese Auswahl.

Der JSON-Export enthält Profilkennungen, vorgesehenes Protokoll, Komponenten, benötigte Einstellungsnamen und Namen später benötigter Secret-Referenzen. Er enthält **keine Secret-Werte, angeklickten URLs, Nachrichten oder Benutzeridentitäten**. Die vorgesehenen zentralen Datenschutzwerte sind Domain-only, keine Identitätsauflösung und keine automatische Übertragung. Dies verändert die bestehende lokale Voll-URL-Protokollierung nicht.

Der Entwurf ist weder ausführbare Infrastrukturdefinition noch Import für eine vorhandene Enterprise-Runtime. Angezeigte Secret-Referenzen werden später im Backend über Secret-Management aufgelöst; im Thunderbird-Profil sollen keine Integrationszugänge liegen. Workload-Identitäten können beim tatsächlichen Adapter einen statischen Client-Secret ersetzen. Benötigte Parameter sind noch nicht eingetragen, Abnahmen stehen auf `pending`.

## CLI für reproduzierbare Vorbereitung

```sh
npm run enterprise:profile -- --hosting azure --sso entra-id --devices intune --siem sentinel --tickets servicenow --out enterprise-profile.json
npm run enterprise:profile -- --hosting self-hosted --sso keycloak --siem none --tickets gitlab
```

Ohne `--out` wird der Entwurf auf stdout geschrieben. Ohne weitere Optionen wird lokale Vorbereitung erzeugt. Dateien werden neu angelegt, auf POSIX mit Modus 0600, und vorhandene Dateien niemals überschrieben. Profile können etwa Azure mit Keycloak oder Eigenbetrieb mit Entra ID kombinieren. Geheimnisse sind keine CLI-Argumente.

## Schnittstellen und nächste Implementierung

| System | Geplante Schnittstelle / besondere Anforderungen |
|---|---|
| Entra ID | Organisationsgebundenes OIDC, Authorization Code + PKCE, Client-/Redirectregistrierung, explizite Gruppen- und MFA-Zuordnung |
| Keycloak / Okta / OIDC | Issuer-/Discovery-Validierung, Clientregistrierung, PKCE, Rollen- und MFA-Mapping; kein ungeprüftes Trust für UI-Angaben |
| Splunk | HTTPS HEC, Token aus Secret-Manager, Index/Sourcetype, kontrollierte Wiederholungen und Deduplizierung |
| Sentinel | Azure Monitor **Logs Ingestion API**, DCR/Stream und Ingestion-Endpunkt; kein veralteter Data-Collector-API-Entwurf |
| Elastic | Bulk-API/NDJSON, minimiertes Eventmapping, Index/Data Stream, Fehler je Eintrag auswerten |
| Jira Cloud / Data Center | Cloud REST v3/OAuth bzw. Data Center REST v2/PAT, Projekt-/Issue-Typ-Zuordnung, Retry-Deduplizierung |
| ServiceNow | Table API für Incident-/Ticketmapping, OAuth, Rollen und zulässige Felder |
| GitLab | REST v4 Issues, Projektzuordnung, Token mit minimalen Rechten, Idempotenz über eigene Zuordnung |
| Intune / Jamf / Ansible / MDM | Je Betriebssystem signiertes Broker-/Installerpaket, geschützte Native-Messaging-Registrierung, Update-/Rollbacknachweis; das Profil verteilt noch kein Paket |

Produktive Aktivierung braucht erst dann konkrete Endpunkte, Region, Identitäten, Daten-/Retention- und Rollenfreigaben sowie erfolgreiche Adapter-/OS-/Thunderbird-Abnahme. Entwicklungs- und Vertragstests können unabhängig davon mit synthetischen Daten weiterlaufen. Die 30 Enterprise-Arbeitspakete bleiben im [Umsetzungsstand](ENTERPRISE_UMSETZUNGSSTAND.md) nachvollziehbar.

Primärquellen für die spätere Adapterimplementierung:

- [Entra OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)
- [Keycloak OIDC](https://www.keycloak.org/securing-apps/oidc-layers)
- [Splunk HEC](https://help.splunk.com/en/splunk-enterprise/get-data-in/collect-http-event-data/http-event-collector-examples)
- [Azure Monitor Logs Ingestion](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/logs-ingestion-api-overview)
- [Elasticsearch Bulk](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-bulk)
- [Jira Cloud REST v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [ServiceNow Table API](https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html)
- [GitLab Issues API](https://docs.gitlab.com/api/issues/)

Diese Quellen beschreiben die Zielprotokolle; sie ersetzen weder eine implementierte Integration noch deren Abnahme.
