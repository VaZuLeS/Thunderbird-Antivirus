# Weiterentwicklung vom 10. November 2026 — Kandidat 1.25.4

Veröffentlicht bleibt 1.25.3. Die Entwicklung hat eine eigene Version 1.25.4; [Umfang](releases/1.25.4.md) und [Abnahmeprotokoll](live_test_1_25_4.md) behaupten keine Veröffentlichung. Frühere [Belege](audits/development-2026-11-09.json) behalten ihre alten Paketidentitäten.

## AVN-019.b — implementiert und abgegrenzt nachgewiesen

`scanJob.coverage` ist ein additives, versioniertes Metadatenobjekt: gezählte Anhänge insgesamt/ausgewählt/vorbereitet/unlesbar/zu groß/ausgelassen, URLs insgesamt/ausgewählt/ausgelassen und die Verfügbarkeit des Anhanginventars. Es enthält keine Dateinamen, URLs, Schlüssel oder Fehlermeldungsdetails. Die bisherigen Grenzen von 100 Ressourcen und 25 MiB bleiben unverändert; auch die tatsächliche Dateigröße wird geprüft. Ein fehlgeschlagener Hash ist kein vorbereiteter Anhang. Die Fingerprintversion wurde erhöht, damit ältere abgeschlossene Jobs diese Metadaten nicht umgehen.

Erfolgreiche Teilprüfungen bleiben erhalten, bei relevanten Auslassungen endet der Auftrag unvollständig. Übersicht und Fachansicht zeigen die gleichen Umfangswarnungen in EN/DE/FR/ES/IT/PL. Die Schutzentscheidung erhält weiterhin `assessmentIncomplete`; ausgelassene Ressourcen werden nicht als sauber gewertet. Ein blockierter Auftrag ohne zugelassene Anbieter bleibt vom tatsächlich ausgeführten Auftrag getrennt.

Startfehler erhalten ausschließlich feste Gründe: `source_capacity`, `cancelled`, `timeout`, `scan_failed`. `SOURCE_CAPACITY` startet keine Anbieterarbeit und löscht keine alten Daten. Der aktive Quellensnapshot bleibt wie bisher aktualisierbar; abgeschlossene Historienstände werden beim Abbruch erhalten. Keine automatische Cachelöschung und keine automatischen POST-Retries.

Die native Gegenprobe mit dem bisherigen Entwicklungspaket 1.25.3 zeigte nach injiziertem Anhang-Lesefehler tatsächlich `completed`/`assessmentIncomplete:false` in der Nachrichtenansicht. Der korrigierte 1.25.4-Lauf weist `incomplete`, einen unlesbaren Anhang und die Warnung in Nachricht und echtem Toolbar-Popup aus. Auch die volle Quellenhistorie wird nativ ohne neue Transportanfrage und ohne Änderung abgeschlossener Revisionen abgewiesen. Inventarfehler und Providertransport sind ausdrücklich synthetisch injiziert; das ist keine Live-Anbieterabnahme.

## AVN-009.f — konkretisiert, Migration bleibt gesperrt

Der [Identitätsvertrag](IDENTITAETSVERTRAG_2026_11_10.md) beschreibt getrennte Objekte, Wiederbindungsgrenzen, additive Persistenz, Transaktionen, Wiederanlauf und Restore. Ein ausführbarer Forschungshelfer und Schema prüfen exakte Rohbytes ohne vermeintliche MIME-Kanonisierung. Das installierte Thunderbird-Schema belegt die zusätzliche `accountsRead`-Anforderung für Verschiebe-/Kopier-/Löschereignisse; dieses Recht fehlt im Produkt. Der Vertrag setzt deshalb keine unbeobachtbaren Ereignisse voraus und führt keine automatische Wiederbindung nach Neustart ein.

Der bestehende Slot-/Scoregegenfall ist noch nicht produktiv behoben. AVN-003, weitere IMAP-/Lifecycleabnahme und ein gegebenenfalls separat begründeter Berechtigungsauftrag bleiben Voraussetzungen für einen vollständigen Migrationsauftrag. Keine neue IndexedDB-Version, keine Retentionänderung, keine Umdeutung historischer Entscheidungen.

## AVN-014.c / AVN-016 — Gate geschlossen, Remote-Abnahme offen

Für Kandidaten ab 1.25.4 verlangt das Gate beide Inlinevarianten sowie den Unvollständigkeits-/Kapazitätsnachweis **je** `minimum`/`current`-Clientziel. Fehlender Popupnachweis, falscher Umfang, zusätzliche Einreichungen, falscher Pakethash oder fehlender Erhalt werden abgewiesen. Die dauerhafte Projektion erhält ausschließlich die dafür notwendigen Felder; beliebige Zusatzdaten werden verworfen. Die CI führt die neue Umfangsprobe aus.

`docs/distribution.json` trennt die veröffentlichte Downloadversion und deren XPI-Prüfsumme von der Entwicklungsversion. Dokument- und Einreichungsprüfungen akzeptieren den neuen Kandidaten, verlangen öffentlich aber weiterhin das tatsächlich veröffentlichte 1.25.3. Reviewer-/Storeunterlagen nennen 1.25.4 als Kandidaten. Öffentliche Links werden erst nach einer tatsächlichen Veröffentlichung umgestellt.

Die CLI-GitHub-Anmeldung ist in dieser Sitzung ungültig; der Git-Transport konnte die isolierte Arbeitsbranch dennoch veröffentlichen. Der [Reviewentwurf #765](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/765) enthält die vorbereiteten Korrekturen. Die vollständige Remote-Abnahme läuft getrennt von den lokalen Nachweisen. Kein Tag, kein Überschreiben alter Releaseassets, keine ATN-/Updatebehauptung.

## Weiterführende Pakete und konkrete Grenzen

| ID | Tatsächlicher Stand dieser Stufe |
| --- | --- |
| AVN-003 | Generator für isolierte OpenPGP-/S/MIME-Fixtures ergänzt. GPG entschlüsselt und prüft Signatur; OpenSSL entschlüsselt und prüft S/MIME-Signatur gegen unabhängige MIME-Bytes. Schlüssel ausschließlich außerhalb des Repositorys. Native Clientabnahme separat protokollieren. |
| AVN-009.d | Wiederverwendbarer, nur über Loopback erreichbarer Dovecot-Testdienst. Reale APPEND/FETCH-Bytes, Kopie und Statusänderung geprüft. Das ist noch keine native Thunderbird-Lifecycle-/Retention-/Restoreabnahme. |
| AVN-004.a | Belegte Routenfamilien und offene Feldverträge bleiben im [Hybrid-Vertrag](HYBRID_REFERENZEN_2026_11_09.md). Ohne verifizierte Antwortfixtures keine neue Route und kein Umetikettieren historischer IDs. |
| AVN-004.b | Keine Provider-Testkonten oder Produktionsfreigaben vorhanden; Live-Abnahme weiter offen. |
| AVN-006 | Windows/NVDA und macOS/VoiceOver fehlen; Chromium/axe und Linux ersetzen diese Nachweise nicht. |
| AVN-007.c | Menschliche Verständlichkeitsprüfung benötigt unabhängige sprachkundige Prüfer. Automatisierte sechs Sprachkataloge sind kein Sprachqualitätsbeweis. |
| AVN-008.b | Drei niedrige Werkzeugmeldungen aus dem letzten frischen Audit; kein Force-Downgrade/Override. Unterstützte Upstreambehebung bleibt offen. |
| AVN-005 | Unabhängige Daten und Labels fehlen. Keine neuen Scoregewichte und keine behauptete Erkennungsrate. |
| AVN-013 | Größere Entkopplung bleibt hinter Fachvertrag und Migrationsvorbedingungen; keine Refaktorierung nur zur Senkung der Zeilenzahl. |
| AVN-012 | Kein Pilotbetreiber/Zielservice; lokale Profile und Offline-Werkzeuge bleiben von produktiver Integration getrennt. |
| AVN-015 | Kein ATN-/Updatekanalzugang mit zwei angebotenen Versionen; manueller Upgrade-/Profilrestore ersetzt automatische Versorgung nicht. |

Die Bedeutungen der bestehenden AVN-019/020 bleiben erhalten. Ein unübernommener Analysevorschlag mit konkurrierenden Nummern ist kein neues Aufgabenregister. AVN-010 wird nicht erneut implementiert: Schutzprofile mit v1/v2-Kompatibilität existieren bereits. Offene Issues erhalten durch ihren Zustand allein keinen höheren Evidenzrang als der Code.

## Aktueller lokaler Nachweis

[Maschinenlesbarer Bericht](audits/development-2026-11-10.json): 1.278 Node-Tests, Quellprüfungen, Lint (0 Fehler/39 kuratierte Warnungen), Web-Build und Paketprüfung bestanden. Ein gemeinsamer nativer Lauf gehört exakt zum dort genannten 1.25.4-Paket. Er bestätigt Umfang/Fokus in Nachricht und Popup, Kapazitätsverweigerung mit Historienerhalt, frischen Inline-Start sowie die tatsächliche Ereignisberechtigungsgrenze.

AVN-003 ist weitergehend untersucht: OpenPGP liefert nach realem Schlüsselimport den erwarteten Unicode-Text und binär identische Anhangbytes; lesbare S/MIME-Signaturen ebenfalls. Der native Thunderbird-Viewer entschlüsselt die gültige S/MIME-Fixture, während die Erweiterungs-API nur die verschlüsselte Hülle liefert. Die bisher fälschlich vollständige lokale Eingangsdeckung wurde für unexpandierte `application/pkcs7-mime`/`application/x-pkcs7-mime`-Hüllen konservativ korrigiert. Ein lesbarer signierter MIME-Baum bleibt vollständig. Die tatsächliche Nachricht zeigt nun die unvollständige Add-on-Prüfung trotz im Client sichtbarem Klartext; keine erfolgreiche API-Entschlüsselung wird erfunden.

AVN-009.d: Ein echter, nur über Loopback veröffentlichter Dovecot 2.3.19.1 liefert die synthetische Nachricht an den echten Thunderbird-Client; Text, lokale Deckung und Quellenspeicherung sind geprüft. Der Hilfsrunner verwendet für Thunderbird 140 den tatsächlich gültigen `selectFolder(folder, listener, msgWindow)`-Aufruf. Das ist weiterhin kein allgemeiner IMAP-Lifecycle-, Langzeitretention- oder Restorebeweis. Der temporäre Testcontainer wurde anschließend gestoppt.

AVN-016: Jekyll mit den beiden konfigurierten Plugins wurde in einem isolierten Debian-Container tatsächlich ausgeführt; alle sieben HTML-Einstiege wurden erzeugt. Der öffentliche Pages-Aufruf bleibt durch die Netzrichtlinie blockiert. Lokaler Build und öffentliche Abnahme bleiben getrennt.

Die erste Remote-Ausführung für `10545d6` scheiterte im Quellenexport-Prüfrunner: Er forderte die administrative Cachelöschung aus der Exportseite an und erhielt korrekt `ADMIN_LOCKED`. Der Runner prüft nun diese Ablehnung ausdrücklich und führt die berechtigte Löschung aus einer vorhandenen Optionsseite aus. Der echte lokale Export-/GTK-/Neustartlauf besteht mit den aktuellen Paketbytes. Die Produktberechtigungen wurden dafür nicht gelockert; der vollständige Remote-Lauf wird mit dem korrigierten Runner wiederholt.

Die neue Linux-Upgrade-/Crash-/Restorematrix verwendet das veröffentlichte 1.25.3-XPI als ausdrücklich gepinnte Vorgängerversion, einschließlich dessen geprüfter SHA-256. Der bisherige 1.25.0-Pin wird für diesen Kandidaten nicht als unmittelbarer Vorgängernachweis ausgegeben.
