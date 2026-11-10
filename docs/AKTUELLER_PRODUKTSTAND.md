# Aktueller Produktstand — 10. November 2026

**Veröffentlicht: 1.25.4.** [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.4), XPI-SHA-256 `df7220351b039e49975ac2d25e4df777c2f97131a4a022fb5b0272c7e55a253e`. Die drei Releaseassets wurden unabhängig heruntergeladen und geprüft. [Veröffentlichungsnachweis](VEROEFFENTLICHUNG_1_25_4.md), [Abnahmeprotokoll](live_test_1_25_4.md), [Releaseumfang](releases/1.25.4.md).

Die [Weiterentwicklung vom 10. November](ENTWICKLUNG_2026_11_10.md) und [vorherige Arbeitsphase](ENTWICKLUNG_2026_11_09.md) sind datierte historische Stufen vor dieser Veröffentlichung; ihre früheren Paketnachweise werden nicht übertragen. Der [1.25.3-Nachweis](VEROEFFENTLICHUNG_1_25_3.md) bleibt unverändert erhalten. ATN, automatische Versorgung und weitere Plattform-/Liveabnahmen bleiben separat offen.

## Funktionen und nachgewiesene Grenzen

| Bereich | Tatsächlicher Stand |
| --- | --- |
| Add-on | MV3-MailExtension ab Thunderbird 140, Hintergrundskripte, eigene HTML-Seiten, IndexedDB und browser.storage.local |
| Lokale Analyse | Heuristische Bewertung, HTML-Bereinigung, Linkschutz und getrennte Inhaltsverfügbarkeit; kein Malwarefreiheitsbeweis |
| Externe Dienste | Fünf optionale Anbieter, gemeinsame Bewertung und Hintergrundaufträge; aktuelle echte Konto-/Rechte-/Quotenabnahme weiterhin separat offen |
| Darstellung | Übersicht/Fachansicht, detaillierte Hybrid-Berichte, gemeinsame Themes und Dichte; sechs Sprachen EN/DE/FR/ES/IT/PL mitgeliefert |
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

Aktueller Veröffentlichungsnachweis: [Paket und Releaseassets](audits/release-1.25.4.json), [Release-CI 42847499890](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/42847499890). Frühere Kandidatenberichte behalten ihre eigenen Paketidentitäten. Eine automatische Updateversorgung wird daraus nicht abgeleitet. Er trennt getestete Paketbytes, Quellfingerprints, Simulationen und echte Clientprüfungen. Historische Testzahlen, Tags, Dokumenttitel und erfolgreiche Deployments sind keine aktuelle Inhalts- oder Plattformfreigabe.

Historischer Nachweis: Die Pages-Bereitstellung für `90df6607` war erfolgreich. Ein öffentlicher Seiten-/Downloadkettenlauf wurde in dieser Umgebung nicht bestätigt: Der Proxy verweigerte den HTTPS-Zugriff. Daraus folgt weder Websiteausfall noch erfolgreiche öffentliche Inhaltsabnahme. Lokale Version-/Linkprüfungen sind davon getrennt.

## Historische Entwicklung

Die bisherigen [Aufgabenpläne](PRODUKTANALYSE_AUFGABENPLAN_2026-11-04.md), [Ausführungsprotokolle](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md) und versionsgebundenen Release-/Live-Protokolle bleiben erhalten. Insbesondere sind Inhaltsumfang, begrenzter Unicode-Eingangsfix, Ressourceninventare, Quellenhistorie, Protokollrevisionen, Exportnavigation und reproduzierbarer Paketbau jeweils mit ihrem damaligen Prüfumfang zu lesen. Die neue Bestandsaufnahme ersetzt keine dieser historischen Paketidentitäten.

Die [Fortführung vom 10. November](IDENTITAETSVERTRAG_2026_11_10.md) konkretisiert AVN-009.f ohne Migration. AVN-019.b ergänzt explizite Ressourcenauslassungen und Startfehler. Öffentliche Downloads folgen `distribution.json`, nicht automatisch der Entwicklungsversion.

## Vorbereiteter Entwicklungsstand 1.25.5

Der [Schutzprofilexport und Importkonfliktschutz](SCHUTZPROFILE_1_25_5.md) ist lokal implementiert. [Abnahmeprotokoll](live_test_1_25_5.md): gezielte lokale Nachweise vorhanden; vollständige Remote-Matrix und Veröffentlichung stehen aus. Der veröffentlichte Stand bleibt 1.25.4.
