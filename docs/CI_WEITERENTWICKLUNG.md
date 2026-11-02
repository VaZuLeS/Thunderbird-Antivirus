# TAV-025 — CI-Ausführung und Grenzen

Die erfolgreichen historischen Läufe 41384961993 (PR) und 41384954564 (Push) enthalten jeweils Testjob, sechs Browserjobs, echten Linux-Client und Kandidatengate. Der erneut gelesene PR-Testjob lief laut Logzeitstempeln von 03:47:24 bis 03:48:26 UTC (rund 63 Sekunden, inklusive Einrichtung); `npm test` begann 03:47:38. Der frühere Kandidatengatejob lief von 03:51:07 bis 03:52:01 UTC (rund 54 Sekunden), darunter ein erneuter Node-Testlauf von rund 34 Sekunden. Das ist keine Messung aller Runnerkosten oder eine garantierte Einsparung.

Der neue `route`-Job entscheidet ausschließlich über die Ausführung, niemals über die Anerkennung fremder Artefakte:

| Ereignis | Verhalten |
| --- | --- |
| Push auf Standardbranch | vollständig prüfen |
| Push auf eigenständigen Branch ohne offenen PR | vollständig prüfen |
| Push mit offenem PR aus demselben Repository | vollständigen PR-Lauf verwenden; Push-Jobs überspringen |
| PR geöffnet/aktualisiert/wieder geöffnet, einschließlich Forks | vollständig im PR-Kontext prüfen |
| Tag / wiederverwendeter Workflow | vollständig prüfen; Tag-Auslösung weiterhin durch den Release-Workflow |
| APIfehler/unerwartete Antwort | vollständig prüfen |

Push und PR haben getrennte Concurrency-Gruppen; neuere Läufe desselben Kontextes ersetzen überholte. Die Jobs beziehen sich weiterhin auf ihren Checkout und paket-/quellgebundene Artefakte. Keine fremden Ergebnisse und keine lediglich behauptete Testfreigabe werden importiert. Der zweite Node-Testlauf im abschließenden Gate bleibt absichtlich erhalten: Für dessen sichere Wiederverwendung fehlt ein eigenständiger vertrauenswürdig gebundener Ergebnisvertrag. `--no-commands` ergibt weiterhin kein GO.

Routing-/Fehler-/Fork-/Branchfälle werden in `test/follow-up.test.js` geprüft. Ein erfolgreicher Remote-Lauf des neuen Workflowstands ist eine gesonderte Abnahme, keine Folge der alten grünen Läufe. Tatsächlich eingesparte Gesamtlaufzeit kann erst nach dieser Ausführung bewertet werden.
