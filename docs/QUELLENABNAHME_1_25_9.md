# Isolierte native Quellenabnahme — AVN-014.c

Stand: 18. November 2026. Entwicklung 1.25.9, weiterhin unveröffentlicht.

## Befund

[CI 44254960616](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/44254960616) besteht den Testjob und alle sechs Browser-Sprachjobs. Beide nativen Linuxlinien scheitern jedoch in `check_stored_sources` an der erwarteten Phase „Antworten ohne auswertbares Urteil; einige Anfragen fehlgeschlagen“. Das Kandidatengate wird deshalb übersprungen. Ein vollständig grüner aktueller Kandidat war damit noch nicht nachgewiesen.

Der Gegenfall wurde lokal in einem isolierten Debian-Trixie-Container mit echtem Thunderbird 153.7.0 ESR, Xvfb, Nachrichtenansicht, Toolbar-Popup und IndexedDB reproduziert. Die Diagnose zeigt fünf empfangene unbekannte Antworten mit je einem vorangegangenen Fehler **und zusätzlich zwei korrekt an tatsächliche Anhangbytes gebundene Hybrid-Berichte**. Einer enthält einen bösartigen Befund; der lokale Score beträgt 80. Die Phase „Externe Ergebnisse vorhanden; einige Anfragen fehlgeschlagen“ ist dafür korrekt.

Die bisherige Testvorbereitung verwendete dieselbe Nachricht für die reine Antwortzählung und für gespeicherte Berichte. Nach dem Cacheleeren darf die normale Nachrichtenverarbeitung die echten aktuellen Anhänge wieder verifizieren und die Berichte wieder zuordnen. Das macht die erwartete Abwesenheit aller Urteile unzulässig. Ein längerer Timeout oder das Unterdrücken eines gültigen gespeicherten Befunds würde den Gegenfall nicht korrekt lösen.

## Korrektur und Akzeptanz

- Eine eigene Nachricht ohne Anhänge oder Linkressourcen prüft ausschließlich Antwortzählung und unbekanntes Urteil. Alle fünf Anbieter müssen vorhanden sein, jeweils mit genau einer Antwort, einem früheren Fehler, unverändertem Beobachtungszeitpunkt und `unknown` als Urteil.
- Die ursprüngliche Nachricht prüft weiterhin die Wiederherstellung neben unlesbaren Nachbareinträgen, echte Anhanghashes, Nachrichtenansicht und Popup. Ihre gespeicherten Berichte und historischen Daten werden vor und nach der Anzeige verglichen. Die fünf Anbieter bleiben in diesem Szenario ausdrücklich als synthetische Quellen vertreten.
- Beide Nachrichten haben eigene Identitäten und Registerkarten. Der Test schließt nur die zusätzliche Antwort-Registerkarte. Keine Anbieteranfrage, Datenmigration oder zusätzliche Löschung.
- Ab 1.25.9 verlangt das Kandidatengate für **beide** deklarierten Linuxlinien die isolierte Quellenprüfung. Fehlende Nachweise, gemeinsam verwendete Nachrichten, nicht erhaltene Berichte oder aktivierte externe Einwilligung werden abgewiesen. Der dauerhafte Releasebeleg erhält ausschließlich feste Statusflags.

## Nachweise und Grenzen

Die korrigierte native Quellenprüfung besteht lokal sowohl auf Thunderbird 153.7.0 ESR als auch auf der Mindestlinie 140.12.0 ESR. Beide Läufe verwenden eigene frische Profile. Die Ausgabe enthält weiterhin auch die vorhandenen Prüfungen zur Hybrid-Berichtsaktualisierung und zur Erholung von gespeicherten Fehlern. Die vollständige CI mit sechs Sprachen, Upgrade, Crash und Wiederherstellung muss auf dem abschließenden Commit bestehen.

Die Runtime-Dateien und XPI-Bytes ändern sich durch diese Test- und Gatekorrektur nicht. Paket-SHA-256:

`c7e415cccdbe3f1900be5042e096c082a3764f940397cb2bef5932430b15bb57`

Quellfingerprint der paketierten Dateien:

`e3eb0eba9e134aef496419a08d6ae9caadb4b58e0189163c194067877ed69b31`

Die Prüfrunner besitzen eigene Prüfsummen; ein identisches XPI macht einen früheren fehlgeschlagenen Prüflauf nicht erfolgreich. Neue Abnahmen bleiben mit ihrem tatsächlichen Runner und Client verbunden. Windows/macOS, Screenreader, echte Anbieterkonten und automatische Updates sind weiterhin gesondert offen.

## Zusätzliche Prüfpfade

Der automatische Anbieterprüflauf konnte im Popup zu früh versuchen, noch nicht geladene Detailbereiche zu öffnen. Der lokale Bereich und der Ansichtsschalter werden absichtlich vor der asynchronen Anbieterantwort bereitgestellt. Der Prüflauf wartet nun auf die tatsächlichen urlscan-Detailsteuerelemente, bevor er sie einmalig öffnet. Die Anforderungen an sichtbare Fehlergründe, erhaltene Befunde und unveränderte POST-Zähler bleiben bestehen. Der vollständige automatische Anbieterprüflauf besteht damit lokal auf 140.12.0 und 153.7.0 ESR, jeweils mit synthetischem Transport.

Der optionale Performance-Helfer wechselte vor seinem API-Aufruf nicht zuverlässig aus der Nachrichtenansicht in eine eigene Add-on-Seite. Er öffnet dafür nun ausdrücklich die vorhandenen Einstellungen. Die Messung verändert keine Produktionsberechtigungen.

Eine lokale Stichprobe mit 266.343 Nachrichtenbytes und sechs `getLocalRisk`-Rundwegen ergibt 74–100 ms auf Thunderbird 153.7.0 ESR und 58–115 ms auf 140.12.0 ESR, jeweils Score 0. Das Rendern von 50 sichtbaren Zeilen aus 2.000 synthetischen Auditdatensätzen dauerte einschließlich Navigation und Automation 427 beziehungsweise 268 ms. Das sind Einzelprofil-Messungen auf dieser Linux-Testmaschine; keine Aussage über reale Verbreitung, RAM-Obergrenzen oder generelle Plattformleistung. Das historische Feld `coldMs` bezeichnet nur den ersten gemessenen Aufruf, keinen Kaltstart des Prozesses.

## Reihenfolge der Fortführung

1. Diese konkrete Abnahme schließen und den bestehenden PR anhand der vollständigen aktuellen CI bewerten.
2. Weitere URL-Zuordnungsfälle und den bestehenden Identitätsvertrag untersuchen; nur reproduzierte fachliche Fehler als Folgekorrektur abgrenzen.
3. Eine Veröffentlichung erst mit vollständigen paketgebundenen Belegen vorbereiten. Unabhängige Schutzqualität, Live-Konten, Zielplattformen und Distributionskanal benötigen jeweils ihre tatsächlichen Voraussetzungen.
