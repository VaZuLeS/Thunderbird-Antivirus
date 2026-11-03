# Fortsetzung: Ressourcenbesitz, Kontextcache und Identitätsprüfung

Stand: **3. November 2026**, unveröffentlichte 1.24.4. Grundlage ist der [nächste Entwicklungsplan](AUFGABENPLAN_NAECHSTE_ENTWICKLUNG_1_24_4.md). Dies ist ein abgegrenzter erster Umsetzungsschritt, keine Behauptung, alle 16 Pakete oder die gesamte dauerhafte Identitätsmigration abgeschlossen zu haben.

| Paket | Ergebnis dieses Schritts | Verbleibende Grenze |
| --- | --- | --- |
| AVN-001 | Reproduzierte fremde Ressourcenbeschriftung korrigiert; Ressourceninventar wird aus den APIs der tatsächlich angefragten Nachricht aufgebaut. Der Popup-Berichtslesepfad erhält eine gefilterte Ansicht. Quellenreferenzen gefilterter Links behalten ihre ursprünglichen Positionen. | Gesamte dauerhafte Datensatzzuordnung, Legacy-Berichte und gleiche Ressourcenmetadaten bei abweichendem Inhalt benötigen weitergehende Prüfung/Migration. Numerische IDs reichen nach dem unten beschriebenen nativen Befund nicht als dauerhafter Besitznachweis. **Paket weiterhin teilweise umgesetzt.** |
| AVN-002 | TTL für alle Lese-/Iterationspfade; optionaler Idle-Timer; höchstens 200 aktive Quellenkontexte. Expiry, Capacity-Eviktion und Cache-Löschung entsorgen Timer und Tabreferenzen; verspätete Observerantworten werden abgewiesen. Gezielt und nativ geprüft. | Die festgelegte Anzahl ist ein technisches Cachelimit, kein garantierter RSS-Grenzwert. Reale Feldlast und lange Nutzungszeiträume werden durch den kontrollierten Lastversuch nicht vollständig repräsentiert. |
| AVN-009 | Native Neustartuntersuchung zeigt tatsächliche ID-Neuvergabe. Die Annahme dauerhaft stabiler numerischer IDs ist widerlegt. Es wurde kein ungeprüfter neuer dauerhafter Schlüssel und keine neue Löschmigration eingeführt. | Verschieben/Kopieren/Komprimieren, durable Bindungen, per-Session-Verläufe, Dauerbetriebsretention und eine datenbewahrende Migration bleiben offen. **Untersuchung teilweise abgeschlossen, Gesamtpaket offen.** |

## Konkrete Änderungen

`background.js::getMessageAnalysisContext` liest Partnamen und Links aus der tatsächlichen Mail, bei vorhandenem Aufruferinventar ohne erneutes Lesen derselben Eingaben. Gespeicherte Namen und URLs eines gemeinsamen Headerdatensatzes sind kein Ersatz dafür. Sind APIs nicht lesbar, wird keine fremde Ressourcenliste als Fallback angezeigt. Durch explizite Scanwege bekannt gewordene Ressourcen bleiben dem jeweiligen Kontext zugeordnet.

`sourceRecord` filtert die Ressourcenansicht gegen dieses Inventar. Linkeinträge erhalten dabei nur für die Rückgabe eine Referenz auf die originale Listenposition. `analysis_status.js::legacy` und der Popup-Linkpfad respektieren diese Referenz; eine gefilterte Liste nummeriert den fremden Link nicht in eine eigene Ressource um. `getMessageAnalysisRecord` liefert diese Ansicht für das Popup. Originaldatensätze und Auditentscheidungen werden dadurch nicht gelöscht oder umgeschrieben. Ungebundene Legacybefunde bleiben gegebenenfalls unbekannte Zusammenfassungen, werden aber nicht mit einem unbestätigten Dateinamen als Popup-Ressource dargestellt.

Das ist kein kryptografischer Nachweis, dass strukturell gleiche Anhänge in unterschiedlichen Nachrichten identischen Inhalt besitzen. Die vorhandenen Header-/ID-basierten Speicherbeziehungen sind damit ausdrücklich nicht insgesamt als dauerhaft sicher freigegeben. Der Rest von AVN-001 und AVN-009 muss vor einer entsprechenden Freigabezusage abgeschlossen werden.

`runtime.js::ExpiringMap` entfernt abgelaufene Einträge auch vor `size`, `keys`, `values`, `entries`, normaler Iteration und `forEach`. Die optionale automatische Bereinigung verwendet einen eigenen Timer je Cache, keinen Timer je Eintrag. Ein Eviktionscallback meldet Ablauf, Capacity, Ersetzung, explizite Löschung und Clear. `touch` verlängert nur ausdrücklich berührte Einträge; Reputationsergebnisse werden durch bloßes Lesen nicht verjüngt.

Nur der Quellenkontextcache aktiviert automatische Bereinigung und das Limit von **200**. Kontextzugriff und gültige Beobachtungen halten ihn aktiv. Disposal stoppt seine Debounce-Timer, löst Tabreferenzen und verhindert spätere Modelländerungen. Gelöschte oder verdrängte Kontexte werden nicht nachträglich wieder in den Cache eingefügt. Gespeicherte Befunde und das getrennte Linkaudit werden bei dieser Memory-Eviktion nicht entfernt. Manuelle URL-Aufträge aus dem Popup übertragen die konkrete Nachrichten-ID; der Hintergrund prüft ihren Headerkontext. Fehlt eine explizite Zuordnung, wird keine Beobachtung einem nur noch zufällig verbleibenden Header-Geschwisterkontext zugewiesen. Ein widersprüchlicher Kontext wird vor der Provideranfrage mit einer lokalisierten Meldung abgelehnt. Eine fehlgeschlagene alte Initialisierung darf einen inzwischen erneuerten Cacheeintrag nicht löschen.

## Tatsächlich ausgeführte Prüfungen

[Maschinenlesbarer Nachweis](audits/avn-001-002-009-2026-11-03.json). Frühere Paketbindungen bleiben historische Belege und werden nicht auf diese Bytes übertragen.

- **1.018 automatisierte Tests erfolgreich**, `npm run check` einschließlich Source-/Katalog-/Vendor-/Design-/Dokumentenprüfung, gefiltertem Lint und verifiziertem Paket.
- Neue risikobasierte Fälle: Ablauf ohne Einzelzugriff, Idle-Disposal mit genau einem Timer, Capacity/Touch/Ersetzung/Clear, Fehler während Cleanup, fremde Inventare nach eigenen Statusschreibvorgängen, originale Linkreferenzen und Kontextverdrängung mit verspäteter Antwort. Cache-Wiederverwendung darf von der Abschlussreihenfolge paralleler Dateihashes unabhängig sein.
- Vier Popup-Smokefälle mit tatsächlichem Renderer und simulierten Extension-/Provider-APIs bestehen; Die neue Kontextfehlermeldung ist in allen sechs Sprachen mitgeliefert; Zustandsmodell und Design bleiben erhalten.
- **Echte Linux-Läufe mit Thunderbird 140.12.0 und 153.6.0**: zwei importierte MIME-Nachrichten mit identischer Message-ID, aber unterschiedlichen Ressourcen. Nachricht B zeigt den eigenen Anhang, keine fremden Namen/URLs; der Popup-Berichtslesepfad liefert keine fremden Ressourcen. Die tatsächliche Nachrichtenansicht wird zusätzlich kontrolliert.
- Separater **153.6.0-Lauf mit Upgrade 1.24.3 → 1.24.4**, zwei normalen und zwei erzwungenen Neustarts. Alte Auditdatensätze bleiben erhalten, PENDING wird nicht als Entscheidung umgedeutet. Die Identitätsuntersuchung ist ein zusätzlicher API-Versuch, kein neues Produktionsrecht.
- Native **205-Nachrichtenprobe**: synthetische lokale Mails, tatsächliche `messages`-/Runtime-APIs, zuerst erzeugter Kontext nach Capacity-Verdrängung disposed, neuester Kontext aktiv. Keine Provideranfragen.

## Speicher- und Zeitmessung: bewusst begrenzte Aussage

Nach Import und Abfrage der 205 Fixtures, vor bzw. nach dem Laden ihrer Quellenkontexte, wurde der eigene Thunderbird-Prozessbaum gemessen:

| Messung | Vorher | Nachher |
| --- | --- | --- |
| Erfasste Prozesse | 3 | 3 |
| Summierte RSS | 765.836 KiB | 780.236 KiB |
| Summierte PSS | 554.966 KiB | 637.743 KiB |

Der API-/Automationsabschnitt dauerte 2.873 ms. Die Werte umfassen Thunderbird, dessen Prozesse, Message-APIs, GC und Dateicaches. Die Differenz beweist **keine** isolierte Speicherersparnis durch den Cachefix und keinen garantierten Feldwert. Die Mengenbegrenzung und Observerentsorgung werden durch separate Verhaltensprüfungen belegt; CSS-/Browserprüfungen werden nicht als echte OS-Messung ausgegeben.

## Native Identitätsbeobachtung

Im isolierten 153.6.0-Profil wurde zuerst die ursprüngliche Mail als ID 1 und eine zweite Mail als ID 2 abgefragt. Vor dem Neustart wurden Nachrichten-Tabs geschlossen. Nach Neustart und umgekehrter Abfragereihenfolge hatte die zweite Mail ID 1 und die ursprüngliche Mail ID 2. Die Header-Message-IDs blieben verschieden und unverändert.

Damit sind numerische Thunderbird-Nachrichten-IDs in diesem nachgewiesenen Fall **sitzungsbezogen, nicht als alleinige persistente Zuordnung geeignet**. Daraus folgt nicht, dass Header-IDs dauerhaft eindeutig wären: genau deren Kollision ist Gegenstand von AVN-001. Der Versuch prüft weder alle Ordner-/Move-/Copy-Szenarien noch eine neue Identitätslösung. Eine ID-basierte neue Speichermigration wäre angesichts dieses Ergebnisses verfrüht.

## Nächster sinnvoller Schritt

AVN-009 fortsetzen: den dauerhaften Ressourcen-/Nachrichtenvertrag festlegen und mit Bewegung, Kopie, Profilrestore und gleichen Metadaten/abweichendem Inhalt prüfen. Dabei alte Snapshots und Originalberichte erhalten, nicht aufgrund wiederverwendeter Zahlen einer neuen Nachricht zuweisen. Erst danach eine neue Schlüssel-/Retentionsstrategie implementieren. Keine automatische destruktive Bereinigung wird aus der Cachekorrektur abgeleitet.

Die neuen nativen Inventar-/Lastprüfungen und die EN-Identitätsprobe sind in der aktiven CI verdrahtet. Neue CI-Artefakte bleiben eigene Paketbindungen. Windows/macOS, NVDA/VoiceOver, echte Providerkonten und automatische Distribution bleiben die bereits benannten zusätzlichen Ressourcenabnahmen. **Keine Veröffentlichung oder Aktivierung optionaler Dienste.**
