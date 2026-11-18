# AVN-009.g — Gebundene manuelle Anhangprüfung

Stand: 18. November 2026. Fortführung des unveröffentlichten Kandidaten 1.25.9. Keine Bestandsmigration und keine zusätzlichen produktiven Berechtigungen.

## Reproduzierter Fehler

Der bisherige manuelle Upload übernahm `headerMessageId`, Dateiname und Hash aus der Popupanfrage, ohne Schlüssel und Hash mit der tatsächlich gelesenen Nachricht und Datei abzugleichen. Ein isolierter Gegenfall überträgt die Datei der Nachricht `mail-7`, obwohl der Aufrufer `unrelated-record` und einen abweichenden Hash nennt. Eine erfolgreiche synthetische Anbieterantwort mit einem dritten Hash wird diesem fremden Datensatz zugeordnet. Die vorhandenen Einwilligungs-, Datenschutzstufen- und Hostberechtigungsprüfungen verhindern diese falsche Ressourcenbindung nicht.

Auch eine verspätete Antwort konnte einen inzwischen ausgetauschten Partslot oder eine neuere Auftragsreferenz überschreiben. Der Nachweis verwendet tatsächliche Produktfunktionen mit simulierten API-/Speichergrenzen. Es wurde keine echte Datei an einen Anbieter übertragen.

## Verbindlicher Laufzeitvertrag

1. Nachricht und Speicherschlüssel werden über Thunderbirds Nachrichten-API ermittelt. Der angeforderte Schlüssel muss genau dazu passen. Der angegebene SHA-256 muss gültig sein; genau ein gespeicherter Part muss denselben Hash besitzen. Fehlende oder mehrdeutige Zuordnungen werden vor dem POST abgewiesen.
2. Die tatsächlichen Anhangbytes werden gelesen und gehasht. Ein geänderter Inhalt wird nicht übertragen. Die vorhandene Grenze von 25 MiB gilt auch für diesen manuellen Dateipfad. Übertragen werden genau die geprüften Bytes unter Thunderbirds tatsächlichem Dateinamen.
3. Vor dem POST werden Einwilligung, Datenschutzstufe, Berechtigung und gespeicherte Ressourcenreferenz erneut geprüft. Richtlinie und aktuelle Authentifizierungsdaten werden nach der abschließenden Speicherwartezeit gelesen. Eine während des Lesens entzogene Einwilligung startet keine Übertragung.
4. Ein in der Anbieterantwort vorhandener Hash muss zu den übertragenen Bytes passen. Ein fehlender optionaler Hash wird durch den tatsächlich verifizierten Hash ergänzt; eine fremde Referenz wird nicht übernommen.
5. Innerhalb der geschützten IndexedDB-Transaktion müssen Part, Hash und ursprüngliche Quick-Scan-/Submission-/Jobreferenz noch übereinstimmen. Ein ausgetauschter Part, eine inzwischen neuere Referenz, ein verlorener Kontext oder ein entfernter Datensatz erhält diese Antwort nicht. Bestehende Berichte und Archive bleiben erhalten.

`MESSAGE_CONTEXT_CHANGED` bezeichnet eine fehlende Bindung vor der Übertragung. `RESOURCE_MISMATCH` bezeichnet eine nicht zuordenbare Antwort. Nach einem bereits gesendeten Upload ergänzt die Fehlerrückgabe `uploadSent: true`. Das bestätigt den Versand und keinen fertigen Analysebericht. Beide Popupaktionen zeigen den übersetzten Hinweis und bleiben bis zum erneuten Öffnen gesperrt; es folgt weder eine automatische Neueinreichung noch ein Abruf unter einem fremden Antwort-Hash. Ein gesendeter Upload kann nicht zurückgerufen werden.

Allgemeine Speicherfehler und Archivkapazitätsgrenzen behalten ihre bisherigen Erhaltungsregeln. Eine erfolgreiche HTTP-Antwort ist weiterhin kein Nachweis einer abgeschlossenen oder dauerhaft gespeicherten Analyse. Es wird keine neue Auslieferungsgarantie für Auftragsreferenzen eingeführt.

## Validierung

- Deterministische Gegenfälle: fremder Schlüssel, falscher Hash, abweichende aktuelle Bytes, fehlende/mehrdeutige Slots, fremder Anbieterhash, verspätete Antworten, neue Referenzen, gelöschter Datensatz und Einwilligungsentzug während des Hashens sowie Schlüssel-/Richtlinienwechsel während der abschließenden Speicherwartezeit.
- Tatsächliche Dateibytes und Dateiname im FormData-Upload; fehlende und großgeschriebene Antwort-Hashes bleiben kompatibel. Gegenfälle verändern vorhandene Berichte nicht und erzeugen keine zusätzlichen POSTs.
- Beide realen Popupaktionen mit EN/DE/FR/ES/IT/PL: gesendeter, nicht zugeordneter Upload bleibt erkennbar; direkte Wiederholung und nachgelagerter Abruf werden verhindert.
- `tools/manual-upload-binding.dev.py` prüft Nachrichten-/Datei-APIs und IndexedDB im echten Thunderbird mit synthetischem Hybrid-Transport. Falsche Bindungen starten keinen POST; eine fremde Antwort lässt Ressourcen und historische Auditdaten unverändert; der positive Fall speichert die passende Referenz. Der Kandidatenlauf verlangt diese Nachweise ab 1.25.9 für beide Linuxlinien. Der dauerhafte Releasebeleg übernimmt nur feste Statusflags.

## Verbleibende Identitätsarbeit

Diese Korrektur bindet eine ausdrückliche manuelle Dateiprüfung an ihre tatsächliche Ressource innerhalb der aktuellen Laufzeit. Der [grundsätzliche Slot-/Scoregegenfall](IDENTITAET_FOLGEVERTRAG_2026_11_09.md) bleibt im automatischen gemeinsamen Message-ID-Speicher reproduzierbar. Ein Rohbytehash oder gleicher Anhang beweist kein gemeinsames Nachrichtenvorkommen.

Der [Identitätsvertrag AVN-009.f](IDENTITAETSVERTRAG_2026_11_10.md), die fehlenden Vorkommensereignisse ohne `accountsRead` und die Bedingungen für eine additive Migration gelten weiter. Alte Schlüssel, Archive, Einwilligungen und historische Entscheidungen werden nicht umgedeutet. OPENED bleibt Thunderbirds angenommene Öffnungsanforderung; PENDING bleibt nach Prozessverlust offen. Live-Anbieterkonten, Windows/macOS, Screenreader und automatische Updateverteilung benötigen eigene Nachweise.
