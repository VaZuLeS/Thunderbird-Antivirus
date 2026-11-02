# Ausführung des Plans zur Informationsdarstellung

Unveröffentlichte Weiterentwicklung 1.24.4. Grundlage: [Aufgabenplan](PLAN_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md). Dieser Bericht ergänzt die [erste Quellenanzeige](ANALYSEQUELLEN_1_24_4.md); deren frühere Paketbindung ist kein Nachweis der jetzigen Bytes. Die öffentliche Distribution wird durch diese Arbeit nicht geändert.

## Stand der Arbeitspakete

| ID | Stand | Ergebnis und Beleg |
| --- | --- | --- |
| INFO-01 | Implementiert; gezielt geprüft | `ThundyAnalysis.render` zeigt Anfrage, Übermittlung, unvollständige Prüfung, verwertbare Antworten und Fehler bereits im Kopf. Neue Zustands-/Wiederanlauftests in `test/analysis-sources.test.js`; lokale und externe Prüfungen bleiben getrennt. |
| INFO-02 | Untersuchung und Implementierung abgeschlossen; gezielt geprüft | Bestehende MIME-Part-IDs und stabile Positionen der gespeicherten Linkliste dienen als lokale Referenzen. Zwei gleichnamige Anhänge und zwei Links bleiben getrennt. Altdaten werden übernommen, unbekannte Zuordnung bleibt ausdrücklich unbekannt. Ressourcenübersicht und genaue Regeln siehe unten. |
| INFO-03 | Implementiert; technisch geprüft | Gemeinsame kompakte Übersicht, Dienste und Warnungen sichtbar; Ressourcen und Zeitangaben aufklappbar. Browser prüft Auffindbarkeit, Tastatur und Aktualisierung. Keine durchgeführte menschliche Verständlichkeitsstudie behauptet. |
| INFO-04 | Inventar und Implementierung abgeschlossen; gezielt geprüft | Automatische/manuelle Providerwege, Polling, Berichte, Cache und gespeicherte Antworten nachstehend inventarisiert. Ressourcenkontext wird über bestehende Aufrufe weitergereicht. Keine neue externe Anfrage durch Anzeige oder Details. |
| INFO-05 | Implementiert; gezielt geprüft | Schema 1 wird additiv gelesen; Schema 2 enthält Ressourcenreferenzen. Quellenstatus nach tatsächlicher Nachricht getrennt, auch bei identischen Header-IDs. Frühere ungebundene Statusdaten bleiben als Legacy-Daten erhalten. Cache-Löschung wird auch innerhalb wartender DB-Schreiboperationen beachtet. Alter, Warnungen, PENDING und historische Entscheidungen bleiben erhalten. |
| INFO-06 | Implementiert; Browser-/DOM-Prüfung | Neue Texte in EN/DE/FR/ES/IT/PL, Themefarben und Shadow DOM. Eigener stabiler Livebereich für Statusänderungen; offene Details und Tastaturfokus bleiben bei Aktualisierung erhalten. Native Screenreaderprüfung bleibt INFO-08. |
| INFO-07 | Lokale und vollständige CI-Abnahme abgeschlossen | Eigene Linux-Prüfung mit echtem Thunderbird, synthetischen Nachrichten und ausdrücklich synthetischen externen Beobachtungen. Paketbindung und tatsächlich ausgeführte Umgebungen im separaten Nachweis. Vollständige Distributionsfreigabe und produktive Providerabnahme werden dadurch nicht behauptet. |
| INFO-08 | Vorbereitung abgeschlossen; reale Durchführung blockiert | Konkrete Prüfschritte in [Zusätzliche Abnahmen](ABNAHME_INFORMATIONSDARSTELLUNG_EXTERN.md). Es fehlen weiterhin Windows/macOS, NVDA/VoiceOver sowie freigegebene Provider-Testkonten und kontrollierte Testziele. Keine Zugangsdaten angefordert oder neue Dienste aktiviert. |

## Untersuchung und Referenzvertrag

Die Untersuchung der bestehenden Speicherwege ergab:

- `partName` identifiziert einen MIME-Part innerhalb der Nachricht. Dateinamen sind nicht eindeutig. `indexedDB_save_batch_hybrid_data_to_db` gleicht neue Anhänge daher nach Part-ID ab. Ein eindeutig benannter alter Datensatz ohne Part-ID kann weiterhin zugeordnet werden; mehrdeutige historische Datensätze werden erhalten.
- `indexedDB_save_links_to_db` hängt neue URLs an die Liste an. Ergebnisaktualisierungen in `indexedDB_save_links_objects_to_db` erhalten jetzt jede vorhandene Position, einschließlich historischer doppelter URLs. Dadurch verschiebt eine Aktualisierung keine bestehenden Referenzen.
- Neue Ressourcenreferenzen haben die Form `attachment:1.2`, `link:0` oder `message`. Sie duplizieren weder Roh-URLs noch Dateihashes oder IPs. Jede künftige Migration, die Listenpositionen ändert, muss die Referenzen mit migrieren.
- Domainprüfungen werden allen betroffenen Links zugeordnet. Eine Domainbewertung wird als solche beschriftet und ist keine vollständige URL- oder Webseitenanalyse. IP-Reputation bleibt dem Nachrichten-/Transportkontext zugeordnet.
- Namen und URL-Anzeigetexte entstehen nur beim Lesen aus vorhandenen Datensätzen. URL-Anzeigen lassen Zugangsdaten, Query und Fragment weg; Linknummern unterscheiden auch ähnlich dargestellte Ziele. Diese Anzeigetexte werden nicht zusätzlich im Status gespeichert.
- Fehlende oder ungültige historische Referenzen bleiben unbekannt. Ein vorhandener Schlüssel, lokaler Hash oder externes Bild ist kein Beleg für eine externe Prüfung. Die Ressourcenübersicht kennzeichnet Anhänge in der Nachricht und verknüpfte Ziele gesondert.

`analysisStatus` verwendet Schema 2; Schema 1 bleibt lesbar. Aktuelle Snapshots werden zusätzlich in `analysisStatusByMessage` nach der tatsächlichen Thunderbird-Nachricht geführt. Der letzte Snapshot bleibt für bestehende Leser erhalten; ein fremder Besitzer wird nicht als Quellenstatus einer anderen Nachricht übernommen. Eine vorherige ungebundene Statusfassung wird bei Bedarf in `analysisStatusLegacy` erhalten. Diese Daten unterliegen derselben Löschung/Aufbewahrung wie der zugehörige bestehende Analyse-Datensatz. Bestehende Mail- und Auditdaten werden nicht in ein neues Schema umgeschrieben.

Pro Snapshot werden höchstens 1.200 Quellenzeilen geführt. Eine erreichte Grenze wird sichtbar angezeigt. Die Ressourcenübersicht begrenzt ihre Detailauflistung auf 500 Einträge und weist weitere Einträge aus. Das erhöht keine bestehenden Übermittlungs- oder Scanlimits. Es gibt keine neue Berechtigung, externe Integration oder automatische Prüfung.

## Inventar der Providerwege

| Dienst und Weg | Ressource / Prüfumfang | Erfassung und Prüfung |
| --- | --- | --- |
| Hybrid Analysis: automatische Hashabfrage und Dateiübermittlung | MIME-Part / Hash bzw. Datei | `process_single_attachment`, `check_hybrid_analysis_for_attachment`, `handle_unknown_attachment`; gezielte Adapter-/Modellprüfungen |
| Hybrid Analysis: manueller Datei-Upload/Rescan | MIME-Part / Datei | `handleManualUpload`; Kontext wird vor dem Gateway-Aufruf an den Part gebunden |
| Hybrid Analysis: automatische URL-Übermittlung | Link / URL | `processAndUploadUrls`; lokale Liste steht vor parallelen Anfragen fest |
| Hybrid Analysis: Kontextmenü, Stapel und manuelle URL-Übermittlung | Link / URL | `handleUrlScan`; zuvor ungespeicherte URLs erhalten vor der Übermittlung einen stabilen lokalen Platz; eigene Regressionprüfung |
| Hybrid Analysis: Linkentscheidung | Link / URL-Bewertung | `handleCheckLinkState`, `checkHybridAnalysisResult`; vorhandene Einwilligungs-/Berechtigungsprüfung bleibt wirksam |
| Hybrid Analysis: Popup-Bericht, Cache, Polling und gespeicherter Bericht | MIME-Part oder Link / Bericht | `fetch_hybrid_report`, Popup-Ereignisbrücke, `ThundyAnalysis.legacy`; ursprüngliche Cache-Zeit stammt aus der Gateway-Antwort |
| VirusTotal: Dateihash einschließlich geteilter Cache-Treffer | MIME-Part / Hash | `checkVirusTotal`; gleicher Inhalt kann getrennte Ressourcenreferenzen haben, ohne erneut angefragt zu werden |
| VirusTotal: IP-Reputation einschließlich Cache | Nachrichtenkontext / IP | `checkVirusTotalIP`, `checkIPReputation`; keine Dateibewertung daraus abgeleitet |
| URLhaus: Domainbewertung einschließlich gemeinsamem Cache | alle betroffenen Links / Domain | `checkURLhausDomains`, `checkURLhaus`; bestehende Anfrageanzahl bleibt erhalten |
| AbuseIPDB: Reputation einschließlich Cache | Nachrichtenkontext / IP | `checkAbuseIPDB`, `checkIPReputation` |
| urlscan.io: explizite Linkaktion, Übermittlung und Ergebnis-Polling | Link / URL | `checkUrlscanIo`, `pollUrlscanIoResult`; Auftrags-ID und 404/Polling sind keine abgeschlossene Analyse |

Die letzten beiden Spalten beschreiben implementierte Erfassung und technische Prüfungen, keine produktive Verbindung mit Providerkonten. Die vorhandenen Opt-in-, Senderfreigabe-, Privacy-Tier- und Hostberechtigungsregeln bleiben maßgeblich.

## Prüfungen und ihre Grenzen

Die vollständige automatisierte Prüfung wird durch gezielte neue Fälle ergänzt: erste Anfrage ohne Antwort; getrennte Ressourcenhistorien; Schema-1-Übernahme; Begrenzung; Fokus und offene Details bei Aktualisierung; zwei gleichnamige Anhänge und zwei Links; Cache/Neustart; historische URL-Dubletten; Cache-Löschung während eines wartenden Schreibvorgangs; zuvor unbekannter manueller Link und persistierte Isolation gleicher Header-IDs.

Browserprüfungen verwenden die echte gemeinsame Darstellung mit simulierten Extension-APIs. Die Interaktionen prüfen Enter, Leertaste und Tab sowie den Fokus nach einem Statuswechsel. Das beweist keine native Screenreader-Kompatibilität. Die Aufgaben für eine spätere Verständlichkeitsprüfung lauten: verwendete externe Dienste finden, betroffene Ressource nennen, Auftrag von Ergebnis unterscheiden und Alter eines gespeicherten Befunds bei fehlgeschlagener Aktualisierung erklären. Ohne Testpersonen wird daraus keine Nutzbarkeitsstudie abgeleitet.

Native Linux-Läufe verwenden tatsächliche Thunderbird-APIs, echte importierte MIME-Nachrichten, die reale Toolbar und die echte Popup-Ereignisschnittstelle. Externe Beobachtungen werden ausdrücklich als Testdaten übergeben; keine Provider-HTTP-Anfragen werden als erfolgreich behauptet. Die Nachricht enthält zwei gleichnamige Anhänge und zwei Links; der vorhandene 101/100/1-Grenzfall bleibt zusätzlich enthalten. Upgrade-/Neustartprüfungen bewahren historische Entscheidungen und erfinden für PENDING keine Entscheidung.

## Abgeschlossener lokaler Nachweis

[Maschinenlesbarer Nachweis](audits/information-display-1_24_4.json): **1.007 Tests erfolgreich**, anschließend 386 gezielte Prüfungen am finalen Quellstand. 48 Popup- und 24 Nachrichtenfälle in sechs Sprachen bestehen; zusätzlich vier Zoomfälle und vier abschließende Popup-/Tastaturfälle. Die vollständige Browsermatrix entstand vor der letzten rein sprachlichen Korrektur des Einwilligungshinweises. Die finalen Sprachkataloge, gezielten Tests und nativen Läufe prüfen diese Korrektur gesondert; die Quellkennungen werden nicht gleichgesetzt.

Das finale Paket besteht die tatsächlichen Linux-/EN-Läufe mit **Thunderbird 140.12.0 und 153.6.0**. Beide prüfen die erste laufende Anfrage, Cache, fehlgeschlagene Aktualisierung, erhaltene Warnung/Alter, gleiche Anhangnamen, zwei getrennte Links und die aktuelle Nachrichten-/Popup-Anzeige. Ein separater 153-Lauf prüft das Upgrade **1.24.3 → 1.24.4**, zwei normale und zwei erzwungene Neustarts, unveränderte Original-Auditdatensätze sowie PENDING ohne erfundene Entscheidung oder erneute OS-Zustellung. Ein vorheriger 140-Versuch lief beim nativen Support-Dateidialog in einen Timeout; derselbe Paketstand besteht den Wiederholungslauf ohne Codeänderung.

Paket-SHA-256: `eaf959e203749c19a1446eca0c3039f88792e689b89c2469398faa8eea0b47d8`.
Quellfingerprint: `78fe4735c95044a0dbaace538f5f46dc672941944ca3d00adb97e7aa566c9ab7`.

[Native Nachrichtenansicht mit synthetischen Befunden](screenshots/1.24.4/information-display-message-linux-en.png) · [Natives Toolbar-Popup](screenshots/1.24.4/information-display-popup-linux-en.png).

Die Quellen-/Paketbindung gilt für diese getesteten Bytes. Die bestehende CI muss für eine spätere Freigabe weiterhin eigene vollständige sechs Sprach-/Upgrade-/Crash- und Browsernachweise erzeugen. INFO-08 bleibt hinsichtlich seiner tatsächlichen zusätzlichen Umgebungen offen; die vorbereiteten Abläufe sind vollständig dokumentiert. Eine Veröffentlichung oder Aktivierung optionaler Dienste wurde nicht vorgenommen.

## Vollständiger CI-Abschluss

Für Implementierungscommit `96e8b0323b03bc7d270e48222a733852d1fe877b` ist [CI-Lauf 41468666892](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41468666892) vollständig erfolgreich. Alle sechs Sprachjobs der Browsermatrix, der Job „Thunderbird Linux GUI“ mit Installations-/Sprach-/Upgrade-/Crash-/Restoreprüfungen sowie das „Package-bound candidate gate“ sind grün. Das Gate bindet seine tatsächlich geprüften Paketbytes an eigene sechs Sprachberichte. Damit ist die zuvor ausstehende vollständige CI-Prüfung für diesen Quellstand abgeschlossen.

[Abgefragte CI- und Artefaktmetadaten](audits/information-display-ci-96e8b03.json) halten Commit, Lauf, erfolgreiche Schritte und das von GitHub gemeldete Kandidatenartefakt fest. Dessen Archivinhalt wurde nicht in die lokale Arbeitsumgebung übernommen; die lokalen ZIP-Bytes werden nicht mit dem CI-Artefakt gleichgesetzt. Der vorige lokale Nachweis bleibt eigenständig erhalten. INFO-08 ist durch Linux-/Browser-CI weiterhin nicht erledigt; die konkret fehlenden Ressourcen und Abnahmeschritte bleiben dokumentiert. Der Code ist zur Durchsicht vorbereitet; eine Veröffentlichung wird nicht behauptet.
