# Aktueller Produktstand — 4. November 2026

Der [Veröffentlichungsabschluss 1.24.3](VEROEFFENTLICHUNG_1_24_3.md) führt den jüngsten Freigabeumfang, Darstellungsprofile und offene Ressourcenabnahmen. Tatsächlicher [GitHub-Release-Status](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.3).

Der unveröffentlichte Entwicklungsstand **1.24.4** ergänzt [sichtbare Analysequellen in Nachricht und Toolbar-Popup](ANALYSEQUELLEN_1_24_4.md). Der [nächste Umsetzungsschritt](FORTSCHRITT_AVN_001_002_009.md) korrigiert Ressourceninventare und Kontextcaches; die dauerhafte Identitäts-/Retentionsarbeit bleibt nach einem nativen Gegenbeweis offen. Die weitere [Umsetzung des Informationsdarstellungsplans](UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md) ergänzt Ressourcenbezug und ausstehende Prüfzustände. GitHub-Downloads und Pages verweisen weiterhin auf die veröffentlichte Version 1.24.3.

Die bisherige Weiterentwicklung (Headerparser, Prüfherkunft, Entscheidungsgründe, Prüfumfang und lokaler Supportexport) ist im [aktuellen Ausführungsprotokoll](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md) abgegrenzt.

Die weitere [Identitätsuntersuchung](IDENTITAET_ANALYSEBEFUNDE.md) zeigt, dass auch unveränderte Nachrichteninhalte bei Statusänderung oder Komprimierung andere Rohdaten-Hashes erhalten können. Inhaltsnachweis, Nachrichtenvorkommen und historische Entscheidung benötigen getrennte Bindungen. Der ergänzte native Prüfrunner ändert weder den produktiven Speicherschlüssel noch vorhandene Daten.

Der [anschließende Inhaltsumfang-Fix](PRUEFUMFANG_NACHRICHTENINHALT.md) verhindert einen lokalen Abschluss für nicht verfügbare Inhalte und zeigt Teilprüfung/Lesefehler in allen sechs Sprachen. Echte Linux-Prüfungen unter 140/153 bestätigen Nachricht und Popup sowie binäre Ressourcen. Erfolgreiche Cryptoabnahmen und die dauerhafte Identitätsmigration bleiben offen.

Die Unicode-Abweichung ist danach [im begrenzten Thundy-AV-Eingangsweg für die belegten UTF-8/QP-Fälle behoben](UNICODE_NACHRICHTENEINGANG.md): Normale Texte bleiben beim bestehenden API-Aufruf; betroffene Textparts werden strikt verifiziert, unbestätigte Eingaben bleiben unvollständig. Die nativen 140/153-Matrizen bestehen mit 13 gültigen und einem bewusst ungültigen Fall. Erfolgreiche Cryptoabnahmen, große Nachrichten, andere Speicherbackends und dauerhafte Identitätsmigration sind weiter offen.

Die [Quellenhistorie](QUELLENHISTORIE_ZUORDNUNG.md) wird jetzt von aktuellen Beobachtungen getrennt und nach einem Prozesswechsel nicht anhand alter Zahlen neu gebunden. Neue Quellenstände verwenden einen additiven UUID-Bereich; alte Quellenfelder bleiben erhalten. Gespeicherte Anhangkarten benötigen einen aktuellen Hashnachweis im aktiven Kontext. Dies ist ein defensiver Teilschritt, keine vollständige Ressourcen-/Vorkommensmigration oder unbegrenzte Archivierung.

Vorheriger Ausführungsstand ist die [detaillierte Aufgabenliste](AUSFUEHRUNG_AUFGABEN_2026-11-02.md). Die [Bestandsaufnahme](PRODUKTANALYSE_AUFGABENPLAN_2026-11-02.md) beschreibt den Ausgangscommit `6046fe0`; alte Statusmeldungen sind zeitgebundene Nachweise und keine aktuelle Freigabe.

Die [begrenzte Protokollhistorie](PROTOKOLLHISTORIE.md) sichert nun die bisherigen gespeicherten Ressourcenprotokolle vor Ersetzung in derselben Transaktion. Lokales Wiederlesen desselben Anhanginhalts erhält den fertigen Bericht; volle Kapazität oder Commitfehler erhalten die alten Daten und werden angezeigt. Die bestehende Cacheaufbewahrung gilt weiterhin; unabhängige Langzeitarchivierung und dauerhafte Vorkommensmigration bleiben offen.

Der [lokale Quellenbericht](QUELLENEXPORT.md) bietet eine datensparsame Vorschau und einen ausdrücklichen Download des aufgezeichneten Prüfstands. Aktuelle Beobachtungen und unbestätigte Historie bleiben getrennt. Ressourceninhalte und interne Kennungen sind ausgeschlossen; Kontextwechsel, Änderungen und Cachelöschung machen ältere Vorschauen ungültig. Es startet keine neue Analyse oder automatische Übermittlung.

Die [Historiennavigation AVN-007.a](GROSSE_QUELLENHISTORIEN.md) macht alle bis zu 1.200 normalisierten historischen Beobachtungen in 30er-Seiten erreichbar. Ein auffälliger historischer Befund bleibt bereits in der Zusammenfassung sichtbar und kann direkt angesprungen werden. Die Zuordnung bleibt unbestätigt; aktuelle Bewertungen und gespeicherte Originaldaten werden dadurch nicht geändert.

Die [großen aktiven Quellenansichten AVN-007.b](AKTIVE_QUELLENANSICHTEN.md) werden anschließend nativ untersucht und gezielt optimiert: Inhalte geschlossener Prüfdetaileinträge entstehen erst beim Öffnen, offene Details/Fokus bleiben bei Aktualisierungen erhalten. Der stärkste aktuelle Warnbefund ist direkt erreichbar; Quellenart und ursprüngliche Zeiten bleiben unverändert. Die Zusammenfassungen werden weiterhin vollständig angezeigt.

Der [Lint-Prüfvertrag AVN-008.a](LINT_PRUEFVERTRAG.md) weist unvollständige Berichte, widersprüchliche Prozessresultate und zu breit passende Warnungsausnahmen ab. Der isolierte neuere Linter besteht die abgegrenzte Vergleichsprobe, wird ohne belegten Advisory-/Integrationsvorteil aber nicht erzwungen. Die App-Nutzdaten und das exakt nativ geprüfte Entwicklungspaket bleiben unverändert; dies ist eine Verbesserung der Buildprüfung, keine neue Analysefähigkeit.

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
