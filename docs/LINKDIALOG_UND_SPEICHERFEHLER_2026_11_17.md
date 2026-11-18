# Linkdialog und Speicherfehler — 17. November 2026

Entwicklungskandidat 1.25.9. Veröffentlichte 1.25.8-Pakete bleiben unverändert.

Der Linkdialog wartet höchstens fünf Sekunden auf externe und lokale Prüfergebnisse, nachdem der Nachrichtenkontext validiert wurde. Danach bleibt ein fehlender Befund UNKNOWN. Bei Standardeinstellungen kann der Nutzer den Link ausdrücklich bestätigen. Es wird kein sauberes Anbieterurteil erfunden. Eine aktivierte Adminrichtlinie kann weiterhin eine Freigabe verlangen. Späte Antworten öffnen keinen Link automatisch und verändern keine damaligen Entscheidungssnapshots.

Quellenbeobachtungen liegen in IndexedDB; das Linkprotokoll verwendet einen getrennten Speicherpfad. Ein Ausfall des Analysecaches darf die normale Bestätigung ohne aktive Freigaberichtlinie nicht unbegrenzt warten lassen. Speicherfehler zeigen jetzt ausschließlich feste Fehlernamen wie QuotaExceededError, InvalidStateError oder DataCloneError. Private Pfade, API-Schlüssel und beliebiger Fehlertext werden nicht angezeigt. Synchron fehlgeschlagene Schreibanforderungen werden abgefangen, mit dem ursprünglichen Fehler zurückgewiesen und atomar abgebrochen.

Die Meldung „Schlüssel hinterlegt / valid“ beschreibt nur einen Verbindungstest, keinen Bericht für die aktuelle Nachricht. Ein Speicherausfall kann den Start einer Analyse verhindern, wenn sonst frühere Befunde verdrängt würden. Die konkrete Ursache im Nutzerprofil ist mit der allgemeinen Meldung storage_failed noch nicht nachgewiesen. Es wird weder automatisch gelöscht noch eine Datenbank neu angelegt, um diesen Fehler zu verdecken.

Prüfungen: simuliertes dauerhaft ausstehendes Anbieterergebnis, Bestätigung trotz UNKNOWN bei Standardeinstellungen, eingefrorener Entscheidungsstand nach verspätetem Schadbefund, feste Speicherfehlerkennung und Wiederherstellung sowie synchroner Schreibfehler ohne Ersatz des Altbestands. Native 1.25.9-Abnahme und echte Anbieter-/Profilabnahme sind gesonderte Nachweise. OPENED bezeichnet nur Thunderbirds angenommene Öffnungsanforderung; PENDING bleibt nach Prozessverlust offen.
