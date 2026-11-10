# Inline „Jetzt prüfen“ nach verlorenem Anzeigekontext

Unveröffentlichte Korrektur auf Basis 1.25.3. [Maschinenlesbarer Nachweis](audits/inline-scan-context.json).

## Ursache und Reproduktion

Der E-Mail-Renderer bleibt länger sichtbar als sein Hintergrundkontext. Nach Cachelöschung oder Ablauf/Verdrängung dieses Kontexts enthält der Klickhandler weiterhin die alte `contextToken`-Kennung. `ThundyScans.request` liest den aktuell angezeigten Nachrichtenkontext und weist die veraltete Kennung mit `MESSAGE_CONTEXT_CHANGED` ab. Der Renderer stellt diesen Fehler als „Prüfung fehlgeschlagen; erneut versuchen“ dar; ein erneuter Klick verwendete wieder dieselbe alte Kennung.

Der native Gegenversuch mit dem veröffentlichten XPI 1.25.3 reproduziert die englische Entsprechung „Check failed; try again“ am tatsächlichen Inline-Button. Ein isoliertes Testprofil steht im manuellen Modus, anschließend wird der Cache über den autorisierten Optionsseiten-Aufruf geleert. Das alte Nachrichten-Dokument bleibt geöffnet. Es werden weder produktive Konten noch reale Nachrichten oder externe Provider verwendet.

## Korrektur

`analysis_status.js::render` erneuert beim ausdrücklichen Klick zunächst den lokalen, nur lesenden Prüfstand über `getMessageAnalysis`. Nur wenn Antwort, Nachrichten-ID und Kontextkennung gültig sind, wird einmal `requestScan` mit dieser aktuellen Kennung gesendet. Der gewählte Bedienweg „Prüfen“ beziehungsweise „Ergebnisse aktualisieren“ bleibt erhalten. Ein fehlgeschlagener Leseaufruf gibt den Button für einen erneuten ausdrücklichen Versuch frei und startet keine Analyse.

Die serverseitige Kontrolle bleibt unverändert: Eine inzwischen andere Nachricht, ein erneut veralteter Kontext oder fehlende externe Einwilligung verhindert den Start. Es gibt keinen automatischen POST-Retry und keine automatische Übermittlung allein durch eine Anzeigeaktualisierung. Bestehende Einwilligungen, gespeicherte Befunde und historische Linkentscheidungen werden nicht verändert.

## Prüfungen

- Regression für ursprünglichen und isoliert serialisierten Nachrichtenrenderer: Die alte Kennung wird durch den frischen Prüfstand ersetzt und genau ein Auftrag angefordert.
- Negative Fälle: nicht verfügbare Antwort, andere Nachricht, fehlende Kennung; kein Start und bedienbarer Retry.
- Hintergrundintegration: veraltete Kennung, Nachrichtenwechsel und widerrufene Einwilligung bleiben gesperrt, ohne Provideraufruf.
- Echter Thunderbird 140.12.0 auf Linux: veröffentlichte Vorversion reproduziert den Fehler; korrigierte Paketbytes zeigen den sichtbaren Abschluss, genau eine synthetische Einreichung und unveränderte historische Auditdaten.

Die native Probe ist als `--inline-scan-check` im Linux-CI-Lauf für beide Clientziele verdrahtet. Das Kandidatengate verlangt den passenden Paketnachweis einschließlich sichtbarem Abschluss; die redigierten dauerhaften Releasebelege erhalten dieselben Prüffelder. Ein fremder Pakethash oder doppelte Einreichungen erfüllen das Gate nicht. Die neue Remote-CI und eine Veröffentlichung sind getrennte, hier nicht behauptete Schritte.

Die früheren [Entwicklungsnachweise](audits/development-2026-11-09.json) bleiben ihrem damaligen Fingerprint zugeordnet. Für diese spätere Korrektur gilt ausschließlich der separate Nachweis oben.

## Zusätzliche Pipelineprüfung ohne Kontextverlust

Die anschließende Untersuchung verfolgt den manuellen Start unabhängig von Cachelöschung und Nachrichtenwechsel. Ein reproduzierter Gegenfall mit fünf URLhaus-Domänen zeigt: Nach einem fehlgeschlagenen ersten Ergebnis setzt der Start einer späteren Ressource den gemeinsamen Anbieterstatus wieder auf `running`; erfolgreiche Antworten können ihn anschließend auf `checked` setzen. Der Auftrag bleibt wegen seines Fehlerzählers zwar unvollständig, die Anbieterfehleranzeige verschwindet jedoch. `scan_jobs.js` erhält den Fehlerstatus jetzt bis zum Ende dieses Auftrags. Ein neuer ausdrücklicher Auftrag beginnt weiterhin mit neuen Anbieterzuständen. Bestehende Berichte und Auditdaten werden nicht umgedeutet.

Der Regressionstest prüft fünf tatsächlich abgearbeitete Ressourcen, den unvollständigen Gesamtstatus und den gespeicherten Anbieterfehler. Die native Variante `--inline-fresh-scan-check` prüft zusätzlich den tatsächlichen Inline-Button in einem frischen Linux-Thunderbird-Profil: kein Nachrichtenwechsel, keine Cacheinvalidierung, sichtbarer Abschluss, genau ein synthetischer urlscan-POST und unveränderte Auditdaten. Beide nativen Varianten sind getrennt in der CI verdrahtet. Der frische Lauf ersetzt weder reale Providerverträge noch die separate Kontextverlustprüfung.

Die neuen Paketbytes und Prüfgrenzen sind im [separaten Pipeline-Nachweis](audits/inline-scan-pipeline.json) dokumentiert. Der vorherige Nachweis bleibt historisch seinem Paket zugeordnet.
