# Aktueller Produktstand — 10. November 2026

**Veröffentlicht: 1.25.3.** [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.3), XPI-SHA-256 `d29233c452b770a9f20801b3c77e3319bff2d42d53caa5505875ffc600377022`. Paketversion und Downloadprüfsumme wurden unabhängig gelesen. Release-CI einschließlich sechs Browser-Sprachjobs, echtem Linux-Thunderbird-Lauf und Kandidatengate bestand. [Veröffentlichungsnachweis](VEROEFFENTLICHUNG_1_25_3.md).

**Aktuelle unveröffentlichte Stufe:** [Weiterentwicklung vom 10. November](ENTWICKLUNG_2026_11_10.md).

**Frühere unveröffentlichte Weiterentwicklung auf dieser Basis:** [Umsetzung und priorisierte offene Pakete](ENTWICKLUNG_2026_11_09.md). Der Quellstand verwendet nun die Kandidatenversion **1.25.4**, ist nicht bytegleich mit dem veröffentlichten XPI und nicht als neuer Release freigegeben. [Kandidatenumfang](releases/1.25.4.md), [Abnahmeprotokoll](live_test_1_25_4.md). Ein neuer Kandidat benötigt eigene paketgebundene Abnahme und eine neue Releaseidentität.

Die anschließende [Inline-Korrektur für „Jetzt prüfen“](INLINE_SCAN_KONTEXT.md) erneuert einen verlorenen Anzeigekontext beim ausdrücklichen Klick. Sie ist unveröffentlicht und besitzt eigene Paket-/Clientnachweise.

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

Aktuelle lokale Ausführung: [maschinenlesbarer Bericht](audits/development-2026-11-10.json). Vollständige Remote-Kandidatenabnahme für `c1c2878`: [CI 42736341784](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/42736341784) erfolgreich; keine Veröffentlichung oder automatische Updateversorgung daraus abgeleitet. Er trennt getestete Paketbytes, Quellfingerprints, Simulationen und echte Clientprüfungen. Historische Testzahlen, Tags, Dokumenttitel und erfolgreiche Deployments sind keine aktuelle Inhalts- oder Plattformfreigabe.

Die Pages-Bereitstellung für `90df6607` war erfolgreich. Ein öffentlicher Seiten-/Downloadkettenlauf wurde in dieser Umgebung nicht bestätigt: Der Proxy verweigerte den HTTPS-Zugriff. Daraus folgt weder Websiteausfall noch erfolgreiche öffentliche Inhaltsabnahme. Lokale Version-/Linkprüfungen sind davon getrennt.

## Historische Entwicklung

Die bisherigen [Aufgabenpläne](PRODUKTANALYSE_AUFGABENPLAN_2026-11-04.md), [Ausführungsprotokolle](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md) und versionsgebundenen Release-/Live-Protokolle bleiben erhalten. Insbesondere sind Inhaltsumfang, begrenzter Unicode-Eingangsfix, Ressourceninventare, Quellenhistorie, Protokollrevisionen, Exportnavigation und reproduzierbarer Paketbau jeweils mit ihrem damaligen Prüfumfang zu lesen. Die neue Bestandsaufnahme ersetzt keine dieser historischen Paketidentitäten.

Die [Fortführung vom 10. November](IDENTITAETSVERTRAG_2026_11_10.md) konkretisiert AVN-009.f ohne Migration. AVN-019.b ergänzt explizite Ressourcenauslassungen und Startfehler. Öffentliche Downloads folgen `distribution.json`, nicht automatisch der Entwicklungsversion.
