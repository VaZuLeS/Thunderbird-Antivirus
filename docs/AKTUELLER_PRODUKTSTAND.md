# Aktueller Produktstand — 19. November 2026

**Version 1.25.9 ist auf GitHub veröffentlicht.** XPI-SHA-256 `21c4df27b24211268f7a96873c43da26eba93b28be84b6d7f9f37cebc388c661`. Alle drei öffentlichen Release-Dateien sind unabhängig geprüft. [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.9) · [Veröffentlichungsnachweis](VEROEFFENTLICHUNG_1_25_9.md) · [Abnahme](live_test_1_25_9.md)

1.25.9 zeigt den lokalen Score auch ohne externe Dienste an und begrenzt die Wartezeit bei Link- und Auditvorgängen. Dazu kommen eine Admin-geschützte API-Diagnoseansicht, kompaktere Inline-Ansichten, ein eigener Hybrid-Analysis-Berichtstab und ein konfigurierbarer Schutz für Anhangaktionen. Die Abnahme bestätigt das direkte Upgrade von 1.25.8, die Wiederherstellung nach Prozessverlust und die Rückkehr zum gesicherten Thunderbird-Profil auf beiden Linux-Clientlinien. [Releaseumfang](releases/1.25.9.md) · [Lokaler Score](LOKALER_SCORE_1_25_9.md) · [API-Diagnose](API_DIAGNOSEANSICHT_1_25_9.md) · [Manuelle Anhangprüfung](MANUELLE_ANHANGBINDUNG_1_25_9.md)

## Funktionen und nachgewiesene Grenzen

| Bereich | Tatsächlicher Stand |
| --- | --- |
| Add-on | MV3-MailExtension ab Thunderbird 140, Hintergrundskripte, eigene HTML-Seiten, IndexedDB und browser.storage.local |
| Lokale Analyse | Heuristische Bewertung, HTML-Bereinigung, Linkschutz und getrennte Inhaltsverfügbarkeit; kein Malwarefreiheitsbeweis |
| Externe Dienste | Fünf optionale Anbieter, gemeinsame Bewertung und Hintergrundaufträge; aktuelle echte Konto-/Rechte-/Quotenabnahme weiterhin separat offen |
| Darstellung | Übersicht/Fachansicht, detaillierte Hybrid-Berichte, gemeinsame Themes und Dichte; sechs Sprachen EN/DE/FR/ES/IT/PL mitgeliefert |
| API-Diagnose | Optionaler Admin-geschützter Debugmodus, lokale Vorschau/Export, begrenzte bereinigte Transportdaten; kein Rohmitschnitt oder Live-Anbieternachweis |
| Linkprotokoll | URL, Score, Prüfherkunft und historische Entscheidungssnapshots; OPENED bezeichnet nur Thunderbirds angenommene Öffnungsanforderung. PENDING bleibt nach Prozessverlust offen |
| Identität | Metadatenfallback und aktuelle Ressourcenhashprüfungen sind implementiert. Dauerhafte Vorkommensidentität und sichere Gesamtmigration sind **nicht abgeschlossen**; [erneuter Gegenfall und Folgeentwurf](IDENTITAET_FOLGEVERTRAG_2026_11_09.md) |
| Historie und Datenschutz | Additive Quellen-/Berichtsarchive im begrenzten Analysecache; separate Auditretention. Kein unbegrenztes oder unveränderliches Langzeitarchiv |
| Einrichtung | Lokale Darstellungsprofile und Schutzprofile mit Vorschau/Bestätigung und v1/v2-Kompatibilität vorhanden; keine importierte Einwilligung oder versteckte Integrationsaktivierung |
| Lokale Administration | Optionale profilbezogene Adminsperre, getrenntes Freigabepasswort und Wiederherstellung; kein zentraler SSO-/MDM-Dienst und kein Schutz vor Änderungen am Benutzerprofil |
| Enterprise | Deaktivierte Konfigurationsprofile und lokale Node-Werkzeuge mit signierten Journalelementen, Outbox und Offline-Reviews. Produktive SSO/RBAC-/OS-/SEALED-Gesamtintegration weiterhin offen |
| React | Separate gekennzeichnete Websimulation mit eigenem localStorage; nicht im XPI |
| Installation und Rückweg | GitHub-XPI und begrenzte echte Linux-Upgrade-/Crash-/Profilrestore-Nachweise. ATN, automatische Updates und allgemeiner In-place-Downgrade dadurch nicht bestätigt |
| Weitere Plattformen | Windows/macOS, NVDA/VoiceOver, native DPI/High Contrast weiterhin eigenständige offene Abnahmen |

## Nachweise richtig lesen

Der Veröffentlichungsnachweis verknüpft die geprüften Paketbytes und den Quellfingerprint mit den simulierten Anbieterprüfungen und den echten Thunderbird-Läufen. ATN-Signierung und automatische Updates bleiben offen. Frühere Kandidatenberichte behalten ihre eigenen Paketidentitäten. [Paket und Release-Dateien](audits/release-1.25.9.json) · [Release-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/44425122989)

Nach dem GitHub-Pages-Deployment prüft der Workflow den öffentlichen Spracheinstieg, die aktuelle Dokumentation und die Downloadlinks aller sechs Sprachseiten. Er lädt das verlinkte XPI und die Prüfsummendatei per HTTPS und vergleicht beide mit der veröffentlichten Paketidentität. [Pages-Workflow](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/workflows/pages.yml)

## Historische Entwicklung

Die bisherigen [Aufgabenpläne](PRODUKTANALYSE_AUFGABENPLAN_2026-11-04.md), [Ausführungsprotokolle](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md) und versionsgebundenen Release-/Live-Protokolle bleiben erhalten. Insbesondere sind Inhaltsumfang, begrenzter Unicode-Eingangsfix, Ressourceninventare, Quellenhistorie, Protokollrevisionen, Exportnavigation und reproduzierbarer Paketbau jeweils mit ihrem damaligen Prüfumfang zu lesen. Die neue Bestandsaufnahme ersetzt keine dieser historischen Paketidentitäten.

Die [Fortführung vom 10. November](IDENTITAETSVERTRAG_2026_11_10.md) konkretisiert AVN-009.f ohne Migration. AVN-019.b ergänzt explizite Ressourcenauslassungen und Startfehler. Öffentliche Downloads folgen `distribution.json`, nicht automatisch der Entwicklungsversion.

[1.25.8](VEROEFFENTLICHUNG_1_25_8.md) und [1.25.7](VEROEFFENTLICHUNG_1_25_7.md) dokumentieren die früheren Veröffentlichungen.
