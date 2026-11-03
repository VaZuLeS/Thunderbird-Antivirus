# Aktueller Produktstand — 3. November 2026

Der [Veröffentlichungsabschluss 1.24.3](VEROEFFENTLICHUNG_1_24_3.md) führt den jüngsten Freigabeumfang, Darstellungsprofile und offene Ressourcenabnahmen. Tatsächlicher [GitHub-Release-Status](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.3).

Der unveröffentlichte Entwicklungsstand **1.24.4** ergänzt [sichtbare Analysequellen in Nachricht und Toolbar-Popup](ANALYSEQUELLEN_1_24_4.md). Der [nächste Umsetzungsschritt](FORTSCHRITT_AVN_001_002_009.md) korrigiert Ressourceninventare und Kontextcaches; die dauerhafte Identitäts-/Retentionsarbeit bleibt nach einem nativen Gegenbeweis offen. Die weitere [Umsetzung des Informationsdarstellungsplans](UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md) ergänzt Ressourcenbezug und ausstehende Prüfzustände. GitHub-Downloads und Pages verweisen weiterhin auf die veröffentlichte Version 1.24.3.

Die bisherige Weiterentwicklung (Headerparser, Prüfherkunft, Entscheidungsgründe, Prüfumfang und lokaler Supportexport) ist im [aktuellen Ausführungsprotokoll](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md) abgegrenzt.

Vorheriger Ausführungsstand ist die [detaillierte Aufgabenliste](AUSFUEHRUNG_AUFGABEN_2026-11-02.md). Die [Bestandsaufnahme](PRODUKTANALYSE_AUFGABENPLAN_2026-11-02.md) beschreibt den Ausgangscommit `6046fe0`; alte Statusmeldungen sind zeitgebundene Nachweise und keine aktuelle Freigabe.

| Ebene | Stand |
| --- | --- |
| GitHub-Distribution | Zielversion 1.24.3, unsigniert; tatsächliche Verfügbarkeit über den Release-Link prüfen. 1.24.2 bleibt historisch erhalten |
| Quellstand | Unveröffentlichte 1.24.4 mit gemeinsamer Anzeige der Analysequellen; ATN-Signierung und automatische Updates bleiben eigenständige Schritte |
| Tatsächliches Add-on | MV3-MailExtension; Hintergrundskripte, eigene HTML-Seiten, IndexedDB und browser.storage.local |
| React | separate gekennzeichnete Websimulation mit eigenem localStorage; nicht im XPI |
| Enterprise | deaktivierte Profile plus lokale Node-Werkzeuge; neuer Offline-Audit-Review aktiviert keinen Dienst |
| Reale lokale Abnahme | isolierte Linux-Profile mit Thunderbird 140.12.0 ESR und 153.6.0 ESR; Sprach-/Upgrade-/Crashberichte im Kandidatennachweis |
| Weiterhin offen | Windows/macOS, NVDA/VoiceOver, native DPI/High Contrast, automatische Updateverteilung, ATN, produktiver Enterprise-Pilot |

Die Dependency-Kollision Vite 8 / React-Plugin 4 wurde durch das passende Plugin 6.1.2 behoben. Der tldts-Pin und das mitgelieferte PSL-Bundle werden zusammen geprüft. Verlorene Releasefähigkeiten (fertige Analyseberichte, begrenztes Polling, Protokollmetadaten und Gateway-/urlscan-Authentifizierung) wurden wieder aufgenommen. Verspätete Berichte werden bei Kontextverlust verworfen und dürfen neuere Einreichungen nicht überschreiben.

Der aktuelle Gate bindet reale Upgrade-/Crashnachweise und sechssprachige Browserberichte an Quellfingerprint und exakte Paketbytes. Ein alter Protokolltext, eine Testzahl oder ein Tag allein reicht nicht. Browser-/axe-Tests bleiben Simulationen; echte Thunderbirdberichte bleiben echte Clienttests mit ausdrücklich begrenztem Umfang.

**Keine Sicherheitsgarantie aus einem niedrigen Score:** unbekannte Providerresultate, fehlende Zustimmung oder eine fehlgeschlagene Analyse sind kein Sicherheitsnachweis. `OPENED` bestätigt nur die von Thunderbird angenommene Öffnungsanforderung; `PENDING` bleibt nach Prozessverlust offen. Backups und spätere Neubewertungen ändern historische Entscheidungssnapshots nicht.
