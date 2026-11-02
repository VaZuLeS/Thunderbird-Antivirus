# Performanceuntersuchung — reale Baseline, keine Optimierungszusage

TAV-015, Kandidat 1.24.3. Linux X11/Xvfb, Thunderbird 153.6.0 ESR, keine externen Provider. Gemessen wurde die tatsächliche lokale Analyse per `browser.runtime.sendMessage(getLocalRisk)` einschließlich IPC und Nachrichtenlesen, nicht eine isolierte Regex. Sechs aufeinanderfolgende Messungen je neuem Profil; erster Abruf separat, keine Statistik über reale Nutzerlast.

| Synthetische HTML-Nachricht | Erster Abruf | Fünf weitere Abrufe |
| --- | --- | --- |
| 1.064.133 Bytes | 208 ms | 104, 191, 197, 113, 288 ms |
| 5.319.223 Bytes | 752 ms | 857, 621, 479, 362, 506 ms |

Die größere Nachricht enthielt wiederholten legitimen Newslettertext. Beide Bewertungen lagen bei Score 0. Das ist eine gezielte Last-/Funktionsprüfung, kein Nachweis repräsentativer Schutzqualität oder einer garantierten maximalen Latenz. Kalte/warme Werte unterliegen Scheduling-/Dateisystem-/GCeinfluss; Prozessspeicher oder Gesamt-RSS wurden nicht gemessen.

Im selben echten Thunderbird wurden 2.000 ausdrücklich synthetische PENDING-Storagefixtures eingesetzt. Die Auditseite zeigte 50 Zeilen auf der ersten Seite. Navigation, Rendern und Automationsbereitschaft zusammen dauerten 476 ms. Dieser Messwert enthält Automationskosten; er beweist weder 60 FPS noch komplette Screenreader-Bedienbarkeit. Die Fixtures waren in einem temporären Testprofil und keine echten Nutzerentscheidungen.

## Prüfharness-Befunde

Ein erster 5-MiB-Versuch traf einen Dokumentwechsel (`document.documentElement` noch null). Nur lesende Bereitschaftsabfragen werden dafür jetzt gezielt erneut geprüft. Ein zweiter Versuch zeigte einen zu frühen Radioklick vor der Themelistener-Initialisierung. Der Runner wartet jetzt auf den tatsächlichen `themeReady`-Status; Schreib-/Klickaktionen werden nicht blind wiederholt. Der anschließende vollständige Lauf bestand. Fehlgeschlagene Ausgangsläufe sind im Scratch-Prüfbestand erhalten und werden nicht zu Produkt-PASS umgedeutet.

## Ergebnis

Die Messung begründet aktuell keinen festen 20-/30-Prozentauftrag und keinen Auditindex für 10.000 Datensätze. Beibehalten werden begrenzte Parallelität/Caches und 50-Zeilen-Pagination. Falls konkrete Anwenderlatenz, UI-Blockierung oder Speicherlast gemeldet wird, gezielt MIME-/Anhang-/Linkverteilung und Haupt-/Contentprozesse profilieren und ein überprüfbares Nutzerziel festlegen. Ein weiterer Performanceumbau ohne solchen Befund wird nicht eingeführt.

Reproduktion: direkten `thunderbird-live.dev.py`-Lauf mit `--performance-check --message-kib 1024` beziehungsweise `5120` ergänzen. Der Modus erzeugt nur synthetische Nachrichten/Storagefixtures in seinem eigenen temporären Profil; nicht mit `--restart-check` kombinieren.
