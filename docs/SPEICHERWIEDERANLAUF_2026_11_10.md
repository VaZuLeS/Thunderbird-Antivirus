# Speicherwiederanlauf und parallele Writer — 10. November 2026

AVN-009.d / Optimierung. Der [native Bericht](audits/storage-recovery-2026-11-10.json) trennt den bisherigen Kandidaten von den neuen Paketbytes. Frühere grüne CI-Läufe bleiben ihren bisherigen Bytes zugeordnet.

## Befund und Korrektur

`background.js::getSharedDB` setzte nach einem Fehler in der initialen `pruneStore`-Bereinigung die Singleton-Promise zurück, ließ aber die bereits geöffnete Verbindung offen. Wiederholte Fehler konnten weitere unbenutzte Verbindungen hinterlassen. Die Feldhäufigkeit ist unbekannt; die Lücke ist durch einen fehlgeschlagenen Regressionstest und eine native Gegenprobe belegt.

Der Fehlerpfad schließt jetzt diese Verbindung und gibt den ursprünglichen Bereinigungsfehler weiter. Auch ein zusätzlicher Fehler beim Schließen darf ihn nicht überdecken. Gemeinsame Aufrufer erhalten dieselbe Fehler-Promise; ein späterer Aufruf öffnet eine neue Verbindung und führt die Bereinigung erneut aus. Erfolgreiche Verbindungen bleiben geteilt und geöffnet. Datenbankschema, Retention, Einwilligung und historische Entscheidungen bleiben unverändert.

## Native Abnahme

`tools/storage-concurrency.dev.py` liest den tatsächlichen Quelltext von `getSharedDB` aus dem installierten Paket. Er wird unverändert in einer isolierten Closure ausgeführt, deren Fabriken ausschließlich eine private native Testdatenbank verwenden. Ein tatsächlicher Transaktionsabbruch injiziert den Startfehler. Beim anschließenden privaten Schemawechsel meldet das bisherige Paket `onblocked`; die korrigierte Funktion gibt die Verbindung vorher frei. Der Prüfrunner schließt bei der negativen Gegenprobe seine eigenen Verbindungen nach Beobachtung des Blockers, damit kein Hänger zurückbleibt. Das Produkt-Singleton und die Produktdatenbank werden nicht zurückgesetzt oder hochgestuft.

Mit zwei echten IndexedDB-Verbindungen prüfen die installierten Produkt-DAO-Funktionen anschließend gleichzeitig gestartete Berichtsersetzungen: Ausgangsbefund, beide Revisionen und unterschiedliche Archiv-UUIDs bleiben erhalten. Ein nach erfolgreichem put-Request abgebrochener Writer wird vollständig zurückgerollt; der folgende Writer kann committen, ohne die abgebrochene Revision zu erfinden. Eine vor der Bereinigung eingereihte Aktualisierung erhält den aufgefrischten Datensatz. Der anschließende vollständige Speicher-/Audit-/Profilrestorelauf besteht mit drei sauberen Neustarts.

Die vorhandene CI führt diesen Teil über `--storage-lifecycle-check` auf beiden Linux-Clientzielen aus. Die bereinigte Releaseprojektion erhält ausschließlich freigegebene Wahrheitswerte; Fehlerdetails, Datensätze und Pfade werden nicht übernommen. Ein fehlgeschlagener neuer Teilbericht wird vor der Projektion abgewiesen.

## Grenzen und Folgeschritt

Dies prüft den derzeitigen einzelnen Store und zwei Verbindungen im selben Thunderbird-Prozess. Mehrere Stores einer künftigen Migration, mehrere Prozesse, Strom-/Datenträgerausfall, mehrtägiger Betrieb und IMAP-Netz-/UIDVALIDITY-Wechsel sind damit nicht nachgewiesen. Der bestehende Nachrichten-Slot-/Scoregegenfall bleibt offen. Für einen Migrationsauftrag sind zusätzlich Transaktionsumfang über die neuen Stores, Wiederanlaufmarken, idempotente Wiederholung und konservative Behandlung mehrdeutiger Altbestände separat festzulegen; keine Migration wird aus diesen Tests abgeleitet.
