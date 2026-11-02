# Optionale Enterprise-Brücke: begrenzte Architekturentscheidung

TAV-016, Stand: 2. November 2026. Bestehende N-/EN-Arbeiten werden weiterverwendet; kein Cloud-/SSO-/Native-Messaging-Produktivbetrieb ist damit freigegeben.

## Entscheidung

Erster konkret nutzbarer Übergang ist ein **manueller lokaler Datei-Review**: Add-on → expliziter JSON-Auditexport → lokal aufgerufener Node-Prüfer. Kein neuer Netzwerkhost, keine Hintergrundübertragung, keine automatische Brokeraktivierung. Der Prüfer ist unter `enterprise/` aus dem XPI ausgeschlossen.

```sh
npm run enterprise:audit-review -- /absolute/path/to/export.json
```

`audit_import.cjs` prüft Exportstruktur, SHA-256, Byte-/Datensatzlimits, eindeutige Ereignis-IDs, Zustände und Score-/Zeitfelder. Der neue Report enthält nur minimierte Domainherkunft, IDs, Versionen, Zustände und historische Entscheidungswerte. URL-Userinfo/Pfad/Query/Fragment, Gründe, Nachrichtenkennung, Profilkennung und beliebige zusätzliche Felder werden nicht übernommen. Das Original wird nicht verändert. PENDING bleibt ohne Entscheidung; spätere Scores ersetzen keine damaligen Snapshots. Simulationen werden abgewiesen.

Eine selbst berechnete SHA-Prüfsumme authentifiziert den Export nicht: `authenticatedSource:false` und `enterpriseActivated:false` sind deshalb feste Reportangaben. Dieses Ergebnis darf nicht als signiertes Geräteevent, SEALED-Evidenz oder Geräte-Enrollment angenommen werden. Für einen produktiven Ingest sind Scope-/Gerätebindung und unabhängige Authentisierung erforderlich.

## Transportvergleich für eine spätere Runtime-Verbindung

| Option | Nutzen | Voraussetzung / Risiko |
| --- | --- | --- |
| Explizite lokale Datei | sofort ohne neue Berechtigungen nutzbar, überprüfbare Datenminimierung | manuell, unautorisierte Quelle möglich; kein zentraler Auditbeweis |
| Native Messaging | OS-gebundener Broker, kein offener Loopback-HTTPdienst | nativeMessaging-Berechtigung, signierte Hostinstallation/Allowlist, OS-Keyschutz und Windows/macOS-Abnahme |
| Loopback-HTTP | vorhandener lokaler Service/Outbox wiederverwendbar | zusätzlich Ursprungsschutz, starke Authentisierung/Replayabwehr, freigegebener Port, neue Hostrechte, Installations-/Lifecyclepfad; nicht bloß fetch im Hintergrund |
| Zentraler HTTPS-Ingest | Flotten-/Mandantenbetrieb möglich | Betreiber-/Datenfreigabe, TLS/Enrollment, Geräteidentitäten, durable Queue, SSO/Rollen, Offline-/Widerrufsstrategie |

Für eine automatische Runtimeverbindung wird Native Messaging als zu untersuchender Favorit dokumentiert, nicht ungeprüft implementiert. Vor einer Berechtigungs-/Installeränderung muss ein konkretes Unternehmensszenario vorliegen. Die lokale Erweiterung bleibt ohne Broker voll funktionsfähig. Policyfehler und fehlender Broker dürfen keinen erfolgreichen Audit-/SEALED-Status vortäuschen.

## Pilotgrenze TAV-017

Startpaket für genau einen Betreiber: Organisation, Ziel-OS/TB-Version, Datenregion, erlaubte Datenklassen, Retention/RPO/RTO, Verantwortliche; danach ein Speicher-/IdP-/SIEMpfad gemäß gewähltem Profil. Laufzeitbeobachtung dieser Umgebung: keine Secrets, Unternehmensidentitäten oder Infrastrukturcapabilities konfiguriert. Echte SSO-/Cloud-/MDMnachweise sind damit nicht ausführbar.

Vor produktivem Pilot die bereits vorhandenen F01–F04/C01–C05/E01–E03/A01–A03 und zugehörigen EN-Pakete anhand der tatsächlichen Auswahl abnehmen. Reale Rollen-/Mandantentrennung, Keyrotation/Widerruf, Unterbrechung/Replay, Object-Lock-Readback, Recovery und unabhängige SEALED-Evidenz bleiben erforderlich. Lokale Retry-/Dead-Letter-/Storagejobs nicht nochmals entwickeln. STAGED erlaubt weiterhin kein Broker-Retirement. Kein Produktivpilot und keine externe Nachricht wird durch dieses Dokument ausgelöst.
