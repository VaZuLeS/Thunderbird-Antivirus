# Aktueller Produktstand

**Version 1.26.2 ist auf GitHub veröffentlicht.** Die XPI-SHA-256 lautet `abe2a8d2f766ab7ab88ccb64f6cf5d7223dea68181fec22fff0d23fb549cc30c`. Die vier Release-Dateien wurden nach dem Download geprüft. [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.26.2) · [Veröffentlichungsnachweis](VEROEFFENTLICHUNG_1_26_2.md) · [Abnahme](live_test_1_26_2.md)

Firmen können Thundys Link- und Anhangschutz zentral einstellen und kontrollierte Öffnungs- und Speicherversuche optional per HTTPS melden. Die Nachrichtenansicht und das Linkprotokoll erklären Anbieterbefunde und Richtliniensperren. Der separate Python-Empfänger übernimmt die Zustellung an ein konfigurierbares Postfach. [Releaseumfang](releases/1.26.2.md) · [Python-Empfänger einrichten](python-receiver.md) · [Documentation in English](guide-en.md)

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
| Firmenrichtlinien und Meldungen | Verwalteter Schutz für Thundys eigene Öffnungswege, optionales HTTPS-Reporting und separater Python-Empfänger mit SQLite und SMTP |
| Enterprise | Deaktivierte Konfigurationsprofile und lokale Node-Werkzeuge mit signierten Journalelementen, Outbox und Offline-Reviews. Produktive SSO/RBAC-/OS-/SEALED-Gesamtintegration weiterhin offen |
| React | Separate gekennzeichnete Websimulation mit eigenem localStorage; nicht im XPI |
| Installation und Rückweg | GitHub-XPI und begrenzte echte Linux-Upgrade-/Crash-/Profilrestore-Nachweise. ATN, automatische Updates und allgemeiner In-place-Downgrade dadurch nicht bestätigt |
| Weitere Plattformen | Fokussierter Windows-Test mit Thunderbird 160 für Öffnungsdialoge und HTTPS/SMTP. Vollständige Plattform- und Screenreader-Abnahmen sind weiterhin separat. |

## Nachweise richtig lesen

Der Veröffentlichungsnachweis verknüpft die geprüften Paketbytes und den Quellfingerprint mit den simulierten Anbieterprüfungen und den echten Thunderbird-Läufen. ATN-Signierung und automatische Updates bleiben offen. Frühere Kandidatenberichte behalten ihre eigenen Paketidentitäten. [Paket und Release-Dateien](audits/release-1.26.2.json) · [Release-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/45195676935)

Nach dem GitHub-Pages-Deployment prüft der Workflow den öffentlichen Spracheinstieg, die aktuelle Dokumentation und die Downloadlinks aller sechs Sprachseiten. Er lädt das verlinkte XPI und die Prüfsummendatei per HTTPS und vergleicht beide mit der veröffentlichten Paketidentität. [Pages-Workflow](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/workflows/pages.yml)

## Historische Entwicklung

Die bisherigen [Aufgabenpläne](PRODUKTANALYSE_AUFGABENPLAN_2026-11-04.md), [Ausführungsprotokolle](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md) und versionsgebundenen Release-/Live-Protokolle bleiben erhalten. Insbesondere sind Inhaltsumfang, begrenzter Unicode-Eingangsfix, Ressourceninventare, Quellenhistorie, Protokollrevisionen, Exportnavigation und reproduzierbarer Paketbau jeweils mit ihrem damaligen Prüfumfang zu lesen. Die neue Bestandsaufnahme ersetzt keine dieser historischen Paketidentitäten.

Die [Fortführung vom 10. November](IDENTITAETSVERTRAG_2026_11_10.md) konkretisiert AVN-009.f ohne Migration. AVN-019.b ergänzt explizite Ressourcenauslassungen und Startfehler. Öffentliche Downloads folgen `distribution.json`, nicht automatisch der Entwicklungsversion.

[1.25.8](VEROEFFENTLICHUNG_1_25_8.md) und [1.25.7](VEROEFFENTLICHUNG_1_25_7.md) dokumentieren die früheren Veröffentlichungen.
