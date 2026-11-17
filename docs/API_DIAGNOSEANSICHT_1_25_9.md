# API-Diagnoseansicht — Entwicklung 1.25.9

Stand: 17. November 2026. Die eigene Ansicht ergänzt den [bestehenden Debugmodus](API_DEBUGMODUS_1_25_7.md). Veröffentlicht bleibt 1.25.8; diese Beschreibung betrifft den Entwicklungskandidaten.

## Bedienung

1. Einstellungen öffnen, bei gesetztem Adminpasswort entsperren und den API-Debugmodus aktivieren. Aktivieren oder erneutes Speichern leert bisherige Aufzeichnungen.
2. **API-Kommunikation öffnen** im Debugbereich wählen. Auch Fehler in der Quellenübersicht bieten diesen Einstieg. Die Ansicht öffnet einen eigenen Thunderbird-Tab.
3. Bei gesetztem Adminpasswort die Ansicht separat entsperren. Die Einstellungs-Sitzung wird nicht über die URL oder zwischen Dokumenten übertragen.
4. Den betroffenen Vorgang ausdrücklich ausführen. Der Betrachter startet selbst keine Analyse, Schlüsselprüfung, neue Einreichung oder Wiederholung.
5. Ablauf auswählen; nach Anbieter, Zustand, Anlass und Zeitraum filtern. Zeitleiste sowie Anfrage-/Antwortdetails aufklappen. **Pausieren** stoppt die Aktualisierung der angezeigten Daten, nicht die Aufzeichnung. Adminablauf und Abschaltung werden weiterhin kontrolliert.
6. Bereinigten Gesamtbericht als `thundy-api-debug-v2.json` exportieren oder Aufzeichnungen leeren. Filter und Pause verkleinern den Export nicht.

Die Ansicht verwendet die gemeinsamen Thundy-Themes, Informationsdichte und sechs Sprachen EN/DE/FR/ES/IT/PL. Auswahl und aufgeklappte Details bleiben bei passiver Aktualisierung bedienbar. Für einen nachvollziehbaren Vergleich lässt sich die Anzeige pausieren.

## Was aufgezeichnet wird

Alle registrierten externen Anbieter verwenden die Gateway-Aufzeichnung, einschließlich Schlüsseltests: Hybrid Analysis, urlscan, VirusTotal, URLhaus und AbuseIPDB. Bei Nachrichtenaufträgen werden verfügbare lokale Voraussetzungen und Speicherereignisse demselben Ablauf zugeordnet. Einzelne Anbieteraufrufe können einen eigenen Ablauf bilden. Eine gemeinsame Nachrichtenidentität wird daraus nicht abgeleitet.

| Phase | Aussage und Grenze |
| --- | --- |
| Voraussetzungen | Beispielsweise fehlende Konfiguration, Einwilligung, Hostberechtigung oder Auftragskapazität. Ein Abbruch vor dem Gateway kann als Ereignis ohne HTTP-Operation erscheinen. |
| Warteschlange/Versuch/Warten | Tatsächlicher Aufrufversuch, Wartezeit, Polling oder zulässiger GET-Retry. Keine zusätzliche Wiederholung durch die Diagnose. |
| HTTP-Antwort | Status, Dauer und Inhaltstyp der erhaltenen Antwort; keine erfundene HTTP-Antwort bei lokalem Backoff oder Richtlinienabbruch. `networkStarted` bezeichnet einen gestarteten Fetch-Versuch, keinen nachgewiesenen Empfang beim Anbieter. |
| JSON | Auswertung oder Parserfehler; ausschließlich erlaubte Strukturfelder und Protokollwerte werden übernommen. HTML und beliebige Meldungstexte fehlen absichtlich. |
| Bewertung | Verfügbare getrennte Abschluss-/Urteilsdaten. HTTP 200 oder `success` bedeutet keinen abgeschlossenen Sicherheitsnachweis. |
| Cache/Speicherung | Verfügbare Cachetreffer und erfolgreiche/fehlgeschlagene lokale Schreibschritte. Ein Anbieterergebnis kann vorliegen, obwohl sein Speichern scheitert. |

Nicht instrumentierte oder vor der Aktivierung liegende Phasen werden ausdrücklich als **nicht erfasst** ausgewiesen. Fehlende Ereignisse beweisen weder einen erfolgreichen Schritt noch, dass früher kein Aufruf erfolgte. Root-Zustände beziehen sich auf Diagnoseläufe, nicht auf Nutzerentscheidungen. Abgebrochene Vorbereitung bleibt ein lokaler Fehler. OPENED und PENDING im historischen Linkaudit werden nicht geändert.

## Daten- und Zugriffsvertrag

- Standardmäßig ausgeschaltet; nur Opt-in wird dauerhaft als Einstellung gespeichert. Diagnoseinhalte bleiben im Hintergrund-RAM, ohne IndexedDB-/Audit-/Profilspeicherung. Neustart entfernt sie.
- Höchstens 100 abgeschlossene Operationen, 200 laufende Tickets, 300 Abläufe und 128 Ereignisse je Ablauf. Das gemeinsame serialisierte Datenbudget beträgt 1 MiB mit Reserve für die Exporthülle. Verdrängung und Kürzung werden angezeigt; das ist keine allgemeine RAM-Obergrenze.
- Höchstens eine Stunde Aufbewahrung. Nach fünf Minuten unbestätigte Tickets/Läufe werden als unbestätigt markiert; verspätete Ticketabschlüsse erfinden keinen Abschluss.
- Keine API-Schlüssel, Auth-/Cookie-Header, vollständigen Ziel-URLs, Mailtexte, Anhänge oder ungefilterten Servermeldungen. Referenzen werden pseudonymisiert. Die Ansicht bietet keinen unbereinigten Modus.
- Ausschalten und Leeren invalidieren laufende Aufzeichnungen. Offene Ansichten erhalten eine Löschbenachrichtigung; verspätete Antworten dürfen die Ansicht nicht wieder befüllen. Exportierte Dateien sind separate Kopien und müssen separat gelöscht werden.
- Der Diagnosetab kann lesen, exportieren und leeren, aber keine Sicherheitsrichtlinie ändern oder die Diagnose aktivieren. Wenn ein Adminpasswort gesetzt ist, benötigt er eine eigene dokumentgebundene Sitzung. Passive Abfragen verlängern die fünfminütige Inaktivitätsfrist nicht.
- Einwilligung, Datenschutzstufe und Hostberechtigungen bleiben wirksam; externe Analyse bleibt optional. Es gibt keine automatischen POST-Retries oder erneuten Einreichungen durch die Ansicht.

Das JSON-Format verwendet `schemaVersion: 2`. Bestehende `entries`, `pending`, `limits` und `kind` bleiben erhalten; `runs`, `runId`, `events`, `providers`, `networkStarted` und `epoch` ergänzen die Korrelation. Keine Bestandsmigration und keine Umdeutung gespeicherter Befunde oder damaliger Entscheidungen.

## Validierung

- `test/api-diagnostics.test.js`: echte Gateway-Instrumentierung mit synthetischem Transport; Redaktion, Budget, TTL, fehlendes HTTP, Prozessgrenzen und dokumentgebundener Adminzugriff.
- `test/api-debug-view.test.js`: reale Seitenskripte im simulierten DOM; Filtern, Pause, Gesamtexport, Sperren, Löschen in anderem Tab, Ausschalten und verspätete Antworten; Fokus und offene Details bei Aktualisierung.
- `tools/browser-ui.dev.cjs --matrix full --view api_debug.html`: Chromium/axe, sechs Sprachen, Hell/Dunkel, 320/1280 Pixel, beide Dichten, ausgeschaltete und gefüllte Ansicht. Simulierte Erweiterungs-APIs, kein Screenreadernachweis. 200 % Zoom ist separat auszuführen.
- `tools/api-debug.dev.py`: vorbereitete echte Thunderbird-Abnahme für eigenen Tab, eigene Sitzung, verweigerte Einstellungsänderung, Filter/Pause, nativen Dateiexport und Leeren beim Sperren; synthetischer Transport. Das Kandidatengate verlangt diese Flags für beide Linux-Clientziele und erhält sie im dauerhaften Releasebeleg.

Die vollständige aktuelle Remote-/Thunderbird-Abnahme ist bis zum tatsächlichen erfolgreichen Lauf offen. Windows/macOS, NVDA/VoiceOver und echte Anbieter-Kontenverträge bleiben gesonderte Abnahmen. Der konkrete lokale Speicherfehler im Nutzerprofil wird durch diese Implementierung nicht nachträglich erklärt; er kann nun gezielt untersucht werden, ohne Bestandsdaten zu löschen.
