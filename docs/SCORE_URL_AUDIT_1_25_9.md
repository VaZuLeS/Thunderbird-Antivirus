# Score-Aktualität, URL-Verträge und begrenzte Auditwartezeiten

Stand: 18. November 2026. Unveröffentlichte Fortführung von 1.25.9; veröffentlichte Pakete werden nicht verändert.

## Lokale Bewertungen

`getLocalRisk` und aktuelle Quellen-Snapshots ergänzen die lokale Bewertung additiv um `assessment`: `schemaVersion: 1`, `runtimeId`, `revision`, `messageId`, `observedAt` und optional die validierte `requestId` des Aufrufers. Die Revision wird vor asynchroner Bewertungsarbeit vergeben. Sie ordnet Berechnungen innerhalb einer Hintergrundlaufzeit, nicht historische Nutzerentscheidungen oder unterschiedliche Profile. `observedAt` beschreibt die Berechnung; im Popup wird kein heutiger Zeitpunkt für einen älteren Quellenstand erfunden.

Popup, aktuelle Quellenmetadaten und injizierte Warnbanner verwerfen ältere Revisionen derselben Laufzeit. Nach einem beobachteten Laufzeitwechsel werden Antworten der vorherigen Laufzeit verworfen. Ein nach fünf Sekunden abgelaufener Popup-Aufruf kann auch über ein späteres Quellenereignis mit derselben `requestId` keinen Score nachreichen. Eine neue unabhängige Bewertung darf wieder einen aktuellen Score liefern. Historische gespeicherte lokale Zustände werden nicht als neue Bewertung interpretiert. Ein neuer gültiger niedriger Score entfernt ein überholtes Warnbanner; ein älterer niedriger Score darf das nicht.

## URL-Inventar und Befundbindung

Das lokale Inventar enthält HTTP-/HTTPS-Ziele der verfügbaren Nachrichtentextteile einschließlich bisher vom Anbieterfilter ausgeschlossener Hosts. HTML wird in einem abgetrennten Dokument geparst: tatsächliche `href`-Ziele werden einmal durch den HTML-Parser dekodiert, Ankeranzeigetext ersetzt kein Ziel. Script-/Style-/Kopfinhalte und Anhangkörper sind keine Nachrichten-Linkziele. Großgeschriebene Protokolle werden erkannt. Das Dokument wird nicht eingebunden; es wird kein Link geöffnet.

Anbieterfilter gelten ausschließlich für die Auswahl regulärer Anbieteraufträge. Sie entfernen keine lokale Bewertungsgrundlage und machen vorhandene echte Nachrichtenlinks nicht zu einem geänderten Admin-Kontext. Bisherige ausdrückliche Klickanfragen, Einwilligungen und Berechtigungen behalten ihren Vertrag; die Inventarisierung führt keine Anfrage aus.

Verglichen wird die kanonische `URL.href` für HTTP/HTTPS. Hostschreibweise, Standardports und die leere Root-Pfadschreibweise normalisiert der URL-Parser. Pfad, abschließender Slash außerhalb der Root, Queryreihenfolge und Fragment werden weder entfernt noch als austauschbar angenommen. Die Regeln gelten für aktuelle Ressourcen, gespeicherte Befunde und neue urlscan-/Hybrid-Verknüpfungen. Alte Datensätze werden nicht umgeschrieben oder zusammengelegt.

URL-F01/F02/F04 aus der [Scoreuntersuchung](LOKALER_SCORE_1_25_9.md) sind damit adressiert. URL-F03 und eine unabhängige Schutzqualitätsabnahme bleiben offen. Keine Änderung der Bewertungsgewichte oder behauptete Erkennungsrate.

## Anhangabgleich

Vor dem Lesen einer Datei werden gespeicherte Befunde ausgewählt, die tatsächlich zum lokalen Score beitragen können: bösartige/verdächtige Hybrid-Befunde oder positive VirusTotal-Zähler, jeweils mit Teilreferenz und SHA-256. Ohne Kandidaten wird weder das Dateiinventar noch eine Datei abgefragt. Aktuelle Teile werden pro Bewertung indiziert; ein relevanter Teil wird höchstens einmal gelesen und gehasht. Unbeteiligte Dateien werden nicht gelesen. Die vorhandenen Größen-/Anzahlgrenzen bleiben bestehen.

Dateiname, Größe und Teilreferenz ersetzen keinen Bytevergleich. Abweichende, unlesbare oder zu große aktuelle Dateien übernehmen keinen gespeicherten Befund. Hashes werden nicht über Bewertungen hinweg anhand von Metadaten wiederverwendet. Dies optimiert den lokalen Befundabgleich, nicht die notwendige Vorbereitung eines ausdrücklich angeforderten vollständigen externen Scans.

## Auditwartezeiten und Entscheidungen

Auditoperationen erhalten eine Frist von fünf Sekunden. Beim Linkcheck teilen Initialisierung, lokale/Anbieterprüfung und Auditabschluss die bereits vorhandene Gesamtfrist. Lokale Ergebnisse bleiben auch bei ausgefallenem Audit nutzbar. `auditSaved: false` meldet fehlenden Speichernachweis; die bestehende übersetzte Auditwarnung bleibt sichtbar. Adminregeln bleiben wirksam; eine nicht lesbare Richtlinie erteilt keine Freigabe.

Die Warteschlange bleibt an den tatsächlich laufenden Speicherzugriff gebunden. Ein abgelaufener, noch nicht gestarteter Auftrag führt später keine Änderung aus. Nach einem verspäteten Leseabschluss beginnt keine abgelaufene Schreiboperation. Bereits an Thunderbird übergebene Schreibvorgänge können nicht zurückgerufen werden und dürfen noch abschließen; sie werden weder parallel überholt noch automatisch wiederholt. Änderungen und Entscheidungssnapshots werden vor dem Warten kopiert.

Abbrechen und Abschluss nach einer tatsächlichen Öffnungsannahme warten jeweils höchstens fünf Sekunden auf das Audit. Eine angenommene Öffnung wird bei fehlendem Auditabschluss nicht nochmals ausgelöst. Ein verspäteter initialer Schreibvorgang enthält weiterhin ausschließlich PENDING. Ein verspäteter Entscheidungscommit enthält nur die tatsächlich zuvor erfolgte Aktion. Prozessverlust ohne bestätigten Entscheidungscommit erlaubt keine Rekonstruktion als OPENED oder ABORTED. OPENED bezeichnet ausschließlich Thunderbirds angenommene Öffnungsanforderung; Browserstart und Seitenabruf bleiben unbestätigt.

## Validierung und Grenzen

- Verhaltensregression mit echten Parser-/Bewertungsfunktionen und simulierten Thunderbird-/Speicher-APIs: Quellenänderung ohne Anbieterereignis, vertauschte Erfolgs-/Fehlerantworten, Laufzeitwechsel, verspätete Quelle nach Timeout, exakte URL-Bindung, ausgeschlossene Anbieterhosts und Bytegegenfälle.
- Speicherfehler mit virtueller Zeit: initiales Lesen/Schreiben, voller Abschluss nach Öffnen/Abbruch, überfällige Warteschlangeneinträge und Wiederanlauf ohne erfundene Entscheidungen. Keine erhöhte Retention, automatische Löschung oder Bestandsmigration.
- Vollständige lokale Regression, Source-/Lint-/Paketprüfung und Browserabnahme werden für den aktuellen Quellstand ausgeführt. Neue native Linux-Nachweise gelten erst nach dem aktuellen paketgebundenen CI-Lauf. Der grüne Lauf für `9e55511` ist ein separater früherer Nachweis.
- Windows/macOS, Screenreader, Live-Anbieter und automatischer Updatekanal bleiben gesondert offen. Keine neuen Bedientexte; die bestehenden sechs Sprachkataloge und das gemeinsame Design werden weiterverwendet.
