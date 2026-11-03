# Lesbarkeit und Umfang der lokalen Nachrichtenprüfung

Stand: **3. November 2026**, unveröffentlichte 1.24.4. Abgegrenzte Umsetzung aus AVN-003 und zusätzliche Inhaltsbeobachtungen für AVN-009.b. Keine neue Scanengine, kein neuer Provider und keine Identitätsmigration.

## Nachgewiesener Ausgangsfehler

Der echte Linux-Thunderbird-Lauf mit dem vorherigen Paket liefert für eine absichtlich nicht entschlüsselbare MIME-Nachricht `decryptionStatus: fail`, keine Textparts und einen Fehler beim Lesen der Anhänge. Trotzdem setzt `getLocalRisk` den lokalen Quellenstatus auf `checked`. Dasselbe geschieht in `evaluateAndInjectThreats` nach einer Berechnung anhand der verfügbaren Metadaten. Ein Score aus diesen Daten ist kein Nachweis einer vollständigen Inhaltsprüfung.

Eine zweite native Beobachtung verhindert eine falsche Reparatur: Bei einer legitimen leeren Textmail fehlt `body` ebenfalls. Außerdem liefert `getFull` Textanhänge häufig ohne Body. Die Abwesenheit eines Bodyfeldes allein ist daher kein ausreichender Fehlernachweis.

## Implementiertes Verhalten

| Eingabe | Lokaler Quellenstatus | Anzeige und Abgrenzung |
| --- | --- | --- |
| Verfügbare Nachrichtentexte, einschließlich leerer Textmail | `checked` nach ausgeführter lokaler Bewertung | Bestehende lokale Anzeige; keine Zusage eines Antivirusurteils |
| `decryptionStatus: fail` oder `skipped`; nicht entschlüsselter `multipart/encrypted`-Container | `incomplete` | Ein Teil des Nachrichteninhalts ist nicht verfügbar; ein historischer `checked`-Status darf das nicht überdecken |
| Positiv große Textparts des Nachrichtentexts ohne lesbaren Body | `incomplete` | Verfügbare Daten können bewertet werden, der Inhaltsumfang bleibt eingeschränkt |
| `getFull` wirft einen Lesefehler | `failed` | Nachricht konnte nicht gelesen werden; keine erfolgreiche lokale Bewertung erfinden |
| Erneuter erfolgreicher Lese-/Prüfversuch | Aktuell neu bestimmter Status | Ein voriger Fehler bleibt nicht als unveränderlicher Zustand im Arbeitsspeicher stehen |
| Text-/Binäranhänge | Separater Anhangpfad | Fehlender Body eines Anhangs allein macht die Textprüfung nicht unvollständig; Anhangabdeckung bleibt separat |

`background.js::localContentCoverage` bewertet diese begrenzten API-Signale. `recordLocalCoverage` und `readFullForAnalysis` verwenden denselben Vertrag in automatischer Nachrichtenbewertung, manueller Prüfung und `getLocalRisk`. Ein fehlgeschlagener Read wird beim Anlegen seines Fehlerkontexts nicht sofort nochmals angefordert. Die vorhandenen GetFull-/Inventarantworten werden soweit vorhanden wiederverwendet.

`getMessageAnalysisContext` stellt bereits beim Lesen fest, wenn der aktuelle Inhalt nicht verfügbar ist. Es übernimmt dann keinen alten positiven lokalen Prüfstatus. Die gespeicherten Originalobjekte werden dafür nicht beim Lesen umgeschrieben. Das löst nicht die weiterhin offene vollständige Bindung alter externer Befunde an Nachrichten mit kollidierenden IDs.

`analysis_status.js::create` erhält die neuen negativen lokalen Zustände und ihre ursprünglichen Zeitpunkte beim Laden. Der gemeinsame Renderer zeigt sie in E-Mail und Toolbar-Popup; Zustandsänderungen werden über die bestehende höfliche Liveansage mitgeteilt. Die Risikokarte im Popup weist zusätzlich auf den eingeschränkten Umfang hin. Beide neuen Meldungen werden auf Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch mitgeliefert.

Numerische Scores, Gewichtungen, Einwilligung und Providerverträge bleiben unverändert. Der aktuelle Score beschreibt weiterhin verfügbare lokale Indikatoren. Historische Entscheidungssnapshots und OPENED/PENDING werden nicht neu berechnet oder umgedeutet. Die Ergänzung ändert keine Aufbewahrungsfrist und löscht keine Originalbefunde.

## Neue Inhaltsbeobachtungen

`tools/thunderbird-live.dev.py::check_mime_content` importiert zwei base64-kodierte Binäranhänge mit allen 256 Bytewerten bzw. genau einem abweichenden Byte, gleichem Dateinamen und gleicher Größe. Ein `FileReader` liest die tatsächlichen `getAttachmentFile`-Bytes als BinaryString; der Prüfrunner vergleicht ihre SHA-256-Werte mit den bekannten Eingaben. Damit ist die neue Probe unabhängig von der früheren ASCII-/`File.text()`-Einschränkung der separaten Identitätsmatrix. Daraus folgt noch kein dauerhafter Speicherschlüssel.

Die Dateien besitzen einen Unicode-Namen und einen UTF-8-/quoted-printable-Nachrichtentext. Die Fixture wird unabhängig mit Pythons MIME-Parser dekodiert; ihr Body wird zusätzlich gegen `getRaw(..., {decrypt:false})` verglichen. Die Probe protokolliert separat, ob `getFull` den erwarteten Unicode-Text liefert. Eine Abweichung bleibt ein offener Befund, statt durch eine abgeschwächte Erwartung als korrekter Roundtrip ausgegeben zu werden.

Der Ausgangslauf unter Thunderbird 153 liefert für die gültige quoted-printable-Fixture Ersatzzeichen anstelle von `ż`, während der Dateiname und die Binäranhänge korrekt ankommen. Der Abschlusslauf kontrolliert deshalb auch das Vorhandensein von U+FFFD bereits innerhalb der Thunderbird-API-Antwort. Eine Erweiterung der Extraktions- oder Risikoregeln ist ohne Klärung dieser Eingangsabweichung nicht begründet. Es wird kein eigener allgemeiner MIME-Decoder eingeführt und nicht behauptet, dass diese Korrektur die Unicode-Abweichung behebt.

## Nachweise und Wiederholung

Der [maschinenlesbare Nachweis](audits/avn-003-009-content-2026-11-03.json) trennt Ausgangslauf, aktuellen Produktstand, automatisierte Simulationen und echte Thunderbird-Läufe. Er bindet neue Ergebnisse an die tatsächlich geprüften Paketbytes; alte Identitätsberichte bleiben historische Belege ihres damaligen Pakets.

```sh
node --test test/analysis-sources.test.js test/optimization.test.js
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.4.xpi \
  --mime-content-check --out /absolute/path/to/new-result-directory
```

Die neuen automatisierten Fälle prüfen negative Statusübernahme, API-Fehler ohne Initialisierungsretry, Wiederherstellung, legitime leere Mail, Textanhänge, fehlenden nichtleeren Nachrichtentext, übersprungene Entschlüsselung und sechssprachige Anzeige/Liveansage. Diese Tests simulieren Browser-APIs bzw. DOM und gelten nicht als native Screenreaderabnahme.

Der native Prüfrunner kontrolliert die tatsächliche E-Mail-Ansicht und das über die Toolbar geöffnete Popup für den unlesbaren Inhalt. Ein absichtlich ungültiger verschlüsselter MIME-Container ist ein Test nicht verfügbaren Inhalts, keine erfolgreiche OpenPGP-/S/MIME-Abnahme. Die CI ergänzt diese Probe im direkten EN-Lauf. Windows/macOS und NVDA/VoiceOver bleiben gesondert offen.

Abschluss: **1.022 automatisierte Tests erfolgreich**, Source-/Sprach-/Design-/Lint-/Paketprüfungen erfolgreich; zusätzlich drei Byte-Regressionen des Identitätsprüfrunners. Echte Linux-Läufe unter **140.12.0 und 153.6.0** bestätigen die binären Anhangbytes, die legitime leere Textmail und den unvollständigen Status bei `decryptionStatus: fail`. Die E-Mail-Ansicht und das native Popup wurden in beiden Versionen geprüft. [Nachrichtenansicht](screenshots/1.24.4/mime-unavailable-message.png), [Toolbar-Popup](screenshots/1.24.4/mime-unavailable-popup.png).

Unter 153 besteht zusätzlich der kombinierte Inventar-/205-Kontext-/Identitäts-/MIME-Ablauf mit zwei normalen Neustarts. Ein separater Lauf aktualisiert das veröffentlichte Paket 1.24.3 auf diese Paketbytes und prüft drei normale Neustarts einschließlich Restore sowie zwei SIGKILL-Neustarts; der ursprüngliche Audit-/Einstellungsstand bleibt erhalten. Daraus folgt keine automatische Distributionsfreigabe.

Die Unicode-Abweichung ist **unter beiden Thunderbirdversionen** sichtbar: Die API-Antwort enthält bereits U+FFFD, die Rohbodies stimmen mit den Fixtures überein und der unabhängige MIME-Parser dekodiert den erwarteten Text. Der neue lokale Verfügbarkeitsstatus erkennt eine solche stille Textveränderung nicht allgemein. Dieser Teil bleibt eine eigene Eingangsqualitätsuntersuchung.

Der zusätzliche lokale Playwright-Smoke konnte nicht ausgeführt werden: Das Browserbinary fehlt und sein offizieller Download wurde durch die Netzrichtlinie mit HTTP 403 abgewiesen. Die nativen GUI-Prüfungen und die sechssprachigen simulierten DOM-Prüfungen werden deshalb ausdrücklich separat ausgewiesen. Für diesen Stand liegt noch kein neuer lokaler Chromium-/axe-Erfolg vor.

## Verbleibende Arbeit

1. Den beobachteten Unicode-/quoted-printable-Fall mit weiteren gültigen Kodierungen und direkten API-Varianten eingrenzen; einen Fix erst nach nachgewiesener Ursache und Prüfung legitimer Gegenbeispiele wählen.
2. Erfolgreiche und teilweise OpenPGP-/S/MIME-Entschlüsselung mit isolierten Testschlüsseln/-zertifikaten prüfen. Fehlende Inhalte und Anhänge weiterhin separat kennzeichnen.
3. Große Nachrichten, weitere MIME-Transformationen und andere Speicherbackends vermessen, bevor ein Inhaltsnachweis bei jedem Popupzugriff eingeführt wird.
4. Danach den [getrennten Inhalts-/Vorkommens-/Befundspeicher](IDENTITAET_ANALYSEBEFUNDE.md) und eine datenbewahrende Migration implementieren. Ein Metadatenvergleich oder eine bytegleiche Kopie darf weiterhin keine alte Nutzerentscheidung übernehmen.

AVN-003 und AVN-009.b sind damit teilweise umgesetzt; weder allgemeine MIME-/Cryptoabdeckung noch dauerhafte Identitätsmigration werden als abgeschlossen erklärt. 1.24.4 bleibt unveröffentlicht.

## Folgeschritt AVN-003.2

Die oben dokumentierte Unicode-Abweichung ist anschließend [für die belegten Multipart-UTF-8/QP-Fälle eingegrenzt und im Produkt-Eingang behoben](UNICODE_NACHRICHTENEINGANG.md). Der native API-Pfad liefert dort weiterhin Ersatzzeichen; Thundy AV rekonstruiert ausschließlich überprüfbare, begrenzte Textparts über `decodeContent:false` und strikte Byte-Dekodierung. Die neue Evidenz ist an neue Paketbytes gebunden. Die vorherigen Ergebnisse bleiben historische Beobachtungen ihres Pakets; allgemeine MIME-/Crypto-/Größenabdeckung und Migration bleiben offen.
