# Identität von Nachrichten, Ressourcen und Befunden

Stand: **3. November 2026**, Untersuchung zu AVN-001/009. Dieser Vertrag beschreibt die nächste Speicheränderung; die bisherige produktive Zuordnung wird durch dieses Dokument nicht migriert. Grundlage: [Entwicklungsplan](AUFGABENPLAN_NAECHSTE_ENTWICKLUNG_1_24_4.md), [vorheriger Umsetzungsschritt](FORTSCHRITT_AVN_001_002_009.md).

## Warum die bisherige Zuordnung nicht genügt

`background.js::getMessageAnalysisContext` liest und schreibt Quellenstände über `analysisStatusByMessage[message.id]`, `analysisStatusOwner` und einen gemeinsamen Headerdatensatz. Numerische IDs können nach einem Neustart zu anderen Nachrichten gehören. Header-Message-IDs sind ebenfalls nicht eindeutig. Ein aktuelles Ressourceninventar verhindert fremde Namen, belegt aber bei identischem Dateinamen, MIME-Part und gleicher Größe keinen identischen Inhalt.

Die erweiterte native Untersuchung in `tools/thunderbird-live.dev.py::check_identity_lifecycle` betrachtet deshalb zwei Nachrichten mit identischen sichtbaren Metadaten und unterschiedlichen vier Byte langen ASCII-Anhängen. Kopieren, Verschieben, Lesen/Markieren, Komprimieren, Neustart und vollständiger Profilrestore werden im isolierten lokalen Testprofil beobachtet. Ordneroperationen führt ausschließlich der privilegierte Prüfrunner aus. Das Add-on erhält keine zusätzlichen Rechte.

Ein wesentlicher Gegenbefund: `messages.getRaw(id, {decrypt:false, data_format:'BinaryString'})` enthält lokale `X-Mozilla-Status`-/Status2-/Keys-Header. Schon eine Änderung des Lesestatus/der Markierung kann den vollständigen Rohdaten-Hash verändern. Ein ungefilterter SHA-256 über `getRaw` ist damit kein unveränderlicher Nachrichtenschlüssel. Der Prüfrunner vergleicht zusätzlich einen **experimentellen** Hash ohne diese drei Header einschließlich Fortsetzungszeilen. Er normalisiert weder andere Header noch den MIME-Body. Das ist keine Freigabe einer allgemeinen MIME-Kanonisierung, insbesondere nicht für Signaturen oder verschlüsselte Nachrichten.

Beim Komprimieren wechseln die zuvor eingefügten Statusheader im beobachteten Fall von LF auf CRLF. Der vollständige Rohdatensatz wächst dabei von 592 auf 595 Byte, obwohl der Anhang unverändert bleibt. Der Vergleich muss deshalb die tatsächlichen Headergrenzen berücksichtigen: Ein bloßes Trennen an CRLF könnte zusammen mit einem lokalen Statusheader auch den originalen `From`-Header entfernen. Drei automatisierte Regressionen prüfen diesen Fall, den Erhalt anderer Header/Fortsetzungen und binärer Bodybytes sowie die Ablehnung einer nicht untersuchten Headergrenze.

Die normale WebExtension-Antwort liefert im aktuellen Manifest für diese Probe keinen Ordnerbezug (`folderId: null`). Die Ordnerbeobachtungen im Bericht stammen separat aus dem privilegierten Prüfrunner. Sie sind kein Beleg, dass das Add-on mit seinen bestehenden Rechten einen dauerhaften Ordner-Locator besitzt. Auch ordnerlokale `messageKey`-Werte sind in verschiedenen Ordnern gleich und damit allein ungeeignet.

## Ausführung und Evidenz

Der [maschinenlesbare Nachweis](audits/avn-009-identity-lifecycle-2026-11-03.json) bindet die Linux-Läufe an Prüfrunner, Paketbytes und Thunderbirdversion. Er unterscheidet den ursprünglichen Rohdaten-Hash vom experimentellen Vergleich und bewahrt die Beobachtungen aller sieben Phasen. Das geprüfte Entwicklungspaket ist weiterhin unveröffentlicht; sein Runtimecode wurde für diese Untersuchung nicht geändert.

```sh
python3 tools/test_thunderbird_identity.dev.py -v
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.4.xpi \
  --identity-lifecycle-check --out /absolute/path/to/new-result-directory
```

Die CI kombiniert die neue Probe im direkten EN-Lauf mit der Inventar- und 205-Kontextprüfung. Die bestehende Upgrade-/SIGKILL-Abnahme bleibt ein eigener Ablauf. Diese Untersuchung darf nicht als neuer Test automatischer Updates oder als Abnahme aller Speicherbackends ausgegeben werden.

## Verbindliche Grenzen für die nächste Implementierung

| Ebene | Zweck und Nachweis | Darf daraus nicht abgeleitet werden |
| --- | --- | --- |
| Laufzeit-Locator | Numerische ID zusammen mit einer zufälligen Kennung der Hintergrundlaufzeit; nur innerhalb dieser Laufzeit verwenden | Dauerhafter Besitzer eines alten Snapshots |
| Inhaltsbindung | Versionierter, lokal berechneter Inhaltsnachweis; algorithmische Eingaben und Lesbarkeit explizit dokumentieren | Eindeutiges Vorkommen: eine bytegleiche Kopie hat denselben Inhalt |
| Ressource | Anhanginhalt über tatsächliche Bytes prüfen; Part-ID, Name und Größe sind zusätzliche Beschreibungen. Links gegen die tatsächlich analysierte URL binden | Gleiche Part-ID oder ein identischer Dateiname als Inhaltsbeweis; Gleichsetzen unterschiedlicher URLs durch Darstellungskürzung |
| Befund | Eigene Kennung, Ressourcenbindung, Provider, Prüfumfang, ursprünglicher Zeitpunkt und Herkunft erhalten | Gespeicherter Befund als neue externe Übermittlung oder neue lokale Prüfung |
| Vorkommen/Interaktion | Aktuelle Nachricht bzw. konkrete Interaktion unabhängig vom wiederverwendbaren Inhaltsbefund behandeln | Bytegleiche Kopie als Beweis, dass dort dieselbe Nutzerentscheidung oder Übermittlung stattfand |
| Historische Entscheidung | Existierenden Auditdatensatz und damaligen Snapshot unverändert lesen | Neuberechnung der damaligen Werte, Ableiten eines Abschlusses aus PENDING oder eines Browserbesuchs aus OPENED |

Die nächste Implementierung muss alle sechs Ebenen auseinanderhalten. Insbesondere ist „Hash gleich“ kein ausreichender Grund, eine alte Interaktionshistorie an eine neue Nachricht zu hängen. Ein Move-Event darf eine Bindung nur mit geprüftem Vertrag übertragen; ohne eindeutigen Nachweis bleibt der Bezug unbekannt. Ein Profilrestore stellt den gesicherten Stand wieder her und vereinigt keine späteren Ereignisse automatisch.

Fehlende Inhaltslesbarkeit, API-Fehler oder eine überschrittene Ressourcenbegrenzung erzeugen keine Ersatzidentität aus schwächeren Metadaten. Der aktuelle Prüfauftrag kann weiter als laufender Vorgang angezeigt werden; historische Zuordnung bleibt ausdrücklich unbestätigt. Die Oberflächen müssen dann „unbekannt“ bzw. „gespeichert, Zuordnung nicht bestätigt“ ausdrücken, statt einen sauberen oder vollständigen Prüfstand zu behaupten. Diese zusätzliche Oberfläche ist noch umzusetzen und in allen sechs Sprachen zu validieren.

## Datenbewahrender Übergang

1. Neue Bindungen und Befunde in einem separat versionierten Speicherbereich ergänzen. Bestehende Originalberichte, Quellensnapshots und Auditdatensätze nicht beim Lesen umschreiben.
2. Legacydaten ohne Inhaltsnachweis als ungebundene Historie erhalten. Numerische IDs und Headergleichheit reichen nicht zur automatischen Übernahme. Eine geprüfte neue Bindung darf einen Verweis auf den Originaldatensatz ergänzen; sie ersetzt dessen damalige Aussage nicht.
3. Neue Snapshotkennungen dürfen ältere Stände nicht unter einer wiederverwendeten Zahl überschreiben. Wiederholte Migration, Parallelzugriff, Quotenfehler und Prozessverlust müssen ohne erfundene Abschlusszustände funktionieren.
4. Cachelöschung, Quellenhistorie und Entscheidungsjournal brauchen getrennte Regeln. Das bestehende [Lebenszyklusdokument](DATENLEBENSZYKLUS.md) beschreibt bereits vorhandene Grenzen. „Erhalten“ bedeutet in dieser Änderung: keine zusätzliche Löschung oder Verkürzung durch eine neue Identitätsmigration; keine Zusage unbegrenzter Archivierung.
5. Erst nach erfolgreicher Migration und explizitem Retentionsvertrag eine zusätzliche dauerhafte Bereinigung implementieren. Ein Mengenlimit für flüchtige Kontexte ist keine Löschfreigabe für persistierte Historie.

## Nächste Umsetzung und erforderliche Voraussetzungen

| Schritt | Akzeptanz | Ausführbarkeit |
| --- | --- | --- |
| AVN-009.a — native Identitätsmatrix | Gleiche Metadaten/abweichender Inhalt sowie Copy/Move/Flags/Compact/Restart/Restore beobachtet; Paketbytes, Thunderbirdversion und Prüfrunner gebunden | Lokal unter Linux; Ergebnisse und Grenzen separat protokollieren |
| AVN-009.b — Inhaltsvertrag vervollständigen | Statusheaderabweichungen erklärt; Unicode/Binärdaten, große Nachrichten, nicht lesbare Inhalte, OpenPGP/S/MIME und MIME-Transformationen untersucht; kein ungemessener Vollscan bei jedem Popupzugriff | Synthetische Linux-Fälle lokal; Kryptokomponenten/-fixtures gesondert nachweisen |
| AVN-001/009.c — separater Speicher und konservative Legacyanzeige | Fremde alte Zahlenstände erscheinen nach Neustart nicht als eigene Befunde; bytegleiche Kopien erben keine Entscheidungen; Originalstände bleiben lesbar; Migration ist wiederholbar und absturzfest | Mit vorhandenen Mitteln implementierbar, nach dem präzisierten Inhaltsvertrag |
| AVN-009.d — Backend- und Retentionsabnahme | Verhalten unter anderem Ordnerspeicher/IMAP und langen Sitzungen geprüft; Mengen-/Zeitgrenzen dokumentiert, Datenverluste und Rückweg überprüft | Lokaler Testserver bzw. weiterer Speicherbackend nötig; Windows/macOS weiterhin zusätzliche Zielsysteme |

Die SHA-Berechnung im Prüfrunner findet außerhalb der Automation-Xray-Grenze statt. `getRaw` liefert echte BinaryString-Bytes; die Attachment-Fixtures sind absichtlich ASCII und werden mit `File.text()` gelesen. Daraus folgt keine generische Binär-/Encodingabnahme. Der Prüfrunner exportiert Prüfsummen und Metadaten der synthetischen Fixtures, keine fremden Mailinhalte. Kein realer Provider wird kontaktiert.

Die Untersuchung allein schließt AVN-001/009 nicht ab und gibt 1.24.4 nicht zur Veröffentlichung frei.

## Ergänzung: binäre Eingaben und begrenzte Inhaltsverfügbarkeit

Der [anschließende Umsetzungsschritt AVN-003/009.b](PRUEFUMFANG_NACHRICHTENINHALT.md) prüft echte 256-Byte-Binäranhänge mit Unicode-Dateinamen und schließt den belegten falschen lokalen Abschluss bei nicht verfügbaren Inhalten. Diese separate Probe nutzt `FileReader`/BinaryString statt `File.text()`; die oben beschriebene historische Identitätsmatrix bleibt in ihrem damaligen ASCII-Umfang erhalten. Die neue Probe ersetzt keinen dauerhaften Vorkommensvertrag. Eine Unicode-/quoted-printable-Abweichung der dekodierten API-Antwort ist nun unter 140 und 153 reproduziert und vor weiteren Eingangs-/Identitätszusagen zu klären.
