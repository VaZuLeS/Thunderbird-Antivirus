# AVN-003.2 — Unicode im lokalen Analyseeingang

Stand: **3. November 2026**, unveröffentlichte 1.24.4. Der [vorherige Schritt zur Inhaltsverfügbarkeit](PRUEFUMFANG_NACHRICHTENINHALT.md) machte eine Textveränderung bereits in der Thunderbird-API sichtbar. Diese Untersuchung grenzt den Fehler ein und implementiert einen begrenzten Eingangsweg für die belegten Fälle.

## Befund und Entscheidung

Die native Vergleichsmatrix nutzt echte `messages.getFull`-Aufrufe unter Thunderbird **140.12.0 und 153.6.0**. Sie trennt Standarddekodierung, `decodeHeaders:false`, `decodeContent:false` und den daraus abgeleiteten Thundy-AV-Eingang. Die gültigen Fixtures werden vor dem Import unabhängig mit Pythons MIME-Parser gegen ihre bekannten Unicode-Texte geprüft.

| Fall | Standard-API | Thundy-AV-Eingang |
| --- | --- | --- |
| Einfache UTF-8-Textmail: 8bit, base64, quoted-printable einschließlich Byte-/Zeichen-Trennung | Erwarteter Text | Erwarteter Text; normale Eingaben bleiben im bisherigen Lesepfad |
| Multipart/mixed: UTF-8/quoted-printable, Byte-Trennung in `ż` | Ersatzzeichen im Unicode-URLpfad | Erwarteter Unicode-Text und URLpfad |
| Multipart/alternative: gleiche Byte-Trennung | Ersatzzeichen im URLpfad | Erwarteter Unicode-Text und URLpfad |
| Multipart/mixed mit HTML und gleicher Byte-Trennung | Ersatzzeichen im URLpfad | Erwarteter HTML-Text und URLpfad |
| Base64 in Multipart | Erwarteter Text | Erwarteter Text |
| Tatsächlich beabsichtigtes U+FFFD in einfacher Mail und Multipart | Erwartetes Ersatzzeichen | Dasselbe beabsichtigte Zeichen bleibt erhalten; keine pauschale „Reparatur“ von Ersatzzeichen |
| ISO-8859-1/quoted-printable in einfacher Mail und Multipart | Erwarteter Text | Bestehende API-Dekodierung bleibt maßgeblich; keine Zeichensatzvermutung |
| Absichtlich ungültiges UTF-8/quoted-printable | Ersatzzeichen | Kein erfundener Originaltext; lokaler Prüfumfang bleibt `incomplete` |

Die beiden nativen Abschlussläufe enthalten jeweils **14 Fälle: 13 gültige und einen absichtlich ungültigen**. Bei den drei betroffenen Multipart-Fällen bleibt die native Dekodierung fehlerhaft, während der Produkt-Eingang den Referenztext liefert. `decodeHeaders:false` behebt den Fehler in der Vergleichsprobe nicht. `decodeContent:false` liefert die benötigten transferkodierten Textbytes im Feld **`rawBody`**, nicht in `body`.

Die ausgelieferte `omni.ja` enthält in `modules/jsmime/jsmime.mjs` die Folge `_applyDataConversion` → `_coerceData(..., false)` → `TextDecoder.decode(..., {stream:more})`. Die beobachtete Multipart-Abhängigkeit ist mit einem nicht über Teilpuffer fortgeführten UTF-8-Decoder vereinbar. Der konkrete Systemcode wurde weder gepatcht noch als allgemeiner Beweis für alle Thunderbird-Versionen ausgegeben. Belegt sind die Matrix und die genannten Binärversionen.

## Implementierter Vertrag

`background.js::getAnalysisFull` liest zunächst den normalen Thunderbird-MIME-Baum. Nur Textparts vom Typ `text/plain` oder `text/html` mit eindeutig deklariertem UTF-8/quoted-printable, gültiger Partreferenz und einem Ersatzzeichen sind Kandidaten für eine zusätzliche Verifikation. Anhänge sind von diesem Pfad ausgeschlossen. Die API behält die Verantwortung für MIME-Struktur und Entschlüsselung.

Für Kandidaten wird derselbe Nachrichteninhalt einmal mit `decodeContent:false` gelesen. Der Code verlangt übereinstimmenden Entschlüsselungsstand und Header-Message-ID sowie eindeutige Partreferenzen in beiden Bäumen. Für den betroffenen Part müssen Medientyp, Zeichensatz und Transferkodierung passen. Das sind Prüfungen eines aktuellen API-Lesevorgangs, **kein dauerhafter Nachrichten- oder Vorkommensschlüssel**.

`decodeUtf8QuotedPrintable` verbindet transferkodierte Bytes einschließlich CRLF-Softbreaks, bevor ein strikter `TextDecoder('utf-8', {fatal:true})` sie dekodiert. Ungültige Hexfolgen, ungültiges UTF-8, unzulässige rohe Nicht-ASCII-Zeichen und nicht eindeutig interpretierbare Eingaben liefern keinen geratenen Text. Ein vorhandenes BOM wird nicht still entfernt. Ein tatsächlich kodiertes U+FFFD bleibt unverändert. Der Code ersetzt weder pauschal sichtbare Zeichen noch dekodiert er einen bereits dekodierten Text erneut.

Die zweite Lesung findet nur im betroffenen UTF-8/QP-Fall statt. Ein positiver Größenhinweis über **1 MiB** verhindert sie; der zusätzliche Baum wird auf höchstens **2.000 Parts** und insgesamt **1 MiB rawBody-Zeichen** begrenzt. Das sind konservative Grenzen für diese Ergänzung, keine allgemeine Speicher-/Latenzgarantie für Thunderbird. Große Nachrichten und weitere Speicherbackends bleiben eigene Aufgaben. Es wird kein neuer Körpertextcache angelegt.

Bei API-Fehler, Widerspruch, Mehrdeutigkeit, ungültiger Kodierung oder überschrittener Grenze im zusätzlichen Verifikationsschritt bleibt der verfügbare native Text erhalten und der abgeleitete Eingang erhält den temporären Status `thundyInputStatus: incomplete`. `localContentCoverage` zeigt dafür die bereits sechssprachig mitgelieferte Unvollständigkeitsmeldung. Erfolgreich korrigierte und unverändert verifizierte Fälle erhalten nur im abgeleiteten Objekt die Diagnosewerte `recovered` bzw. `verified`.

Der zurückgegebene Baum ist abgeleitet; ursprüngliche API-Objekte, MIME-Bytes und gespeicherte Berichte werden nicht umgeschrieben. Dies gilt auch bei teilweise nicht überprüfbaren Texten. Weder Einwilligung noch Providerberechtigungen werden durch eine Wiederherstellung erteilt.

## Verwendung im Produkt

Der Eingang wird von Quelleninventar, automatischer Nachrichtenbewertung, `getLocalRisk`, manueller Prüfung, manueller Linkliste und der aktuellen lokalen Bewertung einer Linkinteraktion verwendet. Dadurch laufen lokale Text-/URLprüfung und zukünftige Entscheidungssnapshots nicht absichtlich über unterschiedliche Unicode-Eingangswege. Ein korrigierter URLpfad ist im lokalen Test bis zum tatsächlichen Aufruf der Risikoberechnung nachgewiesen.

Vorhandene Auditentscheidungen werden dabei nicht neu berechnet. Scoregewichte, OPENED-/PENDING-Semantik, Aufbewahrungsfristen und externe Dienstverträge bleiben bestehen. Insbesondere werden alte Quellenstände nicht aufgrund dieser Textkorrektur einer neuen Nachricht zugeordnet. Die [dauerhafte Inhalts-/Vorkommensbindung](IDENTITAET_ANALYSEBEFUNDE.md) und Migration bleiben offen.

## Validierung und Reproduktion

[Maschinenlesbarer Nachweis](audits/avn-003-2-unicode-2026-11-03.json). Er trennt die Untersuchung am vorherigen Paket von den Abschlussläufen und bindet neue Ergebnisse an Paket, Runtime-Fingerprint und Prüfrunner.

```sh
node --test test/optimization.test.js test/analysis-sources.test.js
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.4.xpi \
  --unicode-input-check --out /absolute/path/to/new-result-directory
```

Minimale Gegenbeispiele aus dem geprüften Lauf: [Multipart mit Byte-Trennung](audits/fixtures/unicode-qp-multipart.eml) und [einfache Textmail mit derselben Trennung](audits/fixtures/unicode-qp-simple.eml). Beide enthalten ausschließlich synthetische Daten und reservierte `.invalid`-Ziele. Die Extension kontaktiert für die Probe keinen Analyseprovider.

**1.026 automatisierte Tests erfolgreich**, vollständige Source-/Sprach-/Design-/Lint-/Paketprüfung erfolgreich. Neue Verhaltensfälle prüfen strikte Byte-Dekodierung, vier Byte lange Zeichen, BOM, ungültige Eingaben, echten Ersatzzeicheninhalt, unveränderte API-Bäume, Übernahme des richtigen URLpfads in die Risikoberechnung, API-/Bindungsfehler, doppelte Parts und die Mengen-/Größengrenzen. Drei vorhandene Byte-Regressionen des nativen Prüfrunners bestehen zusätzlich. Simulationen messen weder reale OS-Zugänglichkeit noch Feldhäufigkeit.

Echte Linux-Läufe unter 140/153 prüfen die 14 Kodierungsfälle und den ursprünglichen Unicode-/Binär-MIME-Fall. Nachricht und Toolbar-Popup kennzeichnen nicht verfügbare verschlüsselte Inhalte weiterhin korrekt. Der kombinierte 153-Lauf prüft zusätzlich Ressourceninventar, 205-Kontextbegrenzung und die bestehende Identitätsmatrix einschließlich Neustart/Restore. Ein separater Upgrade-/SIGKILL-/Restore-Lauf prüft dieselben Paketbytes gegen veröffentlichte 1.24.3. Die CI nimmt die neue Matrix im EN-Ablauf auf.

Ein neuer lokaler Chromium-/axe-Erfolg wird nicht behauptet: Das Browserbinary fehlt weiterhin; der zuvor dokumentierte offizielle Download ist durch die Netzrichtlinie blockiert. Native Thunderbird- und simulierte DOM-Nachweise bleiben getrennt.

## Restumfang

AVN-003.2 ist für den belegten UTF-8/QP-Fall implementiert und geprüft. Nicht abgeschlossen sind allgemeine MIME-/Zeichensatzabdeckung, erfolgreiche OpenPGP-/S/MIME-Abnahme, große oder nachgeladene Nachrichten, alternative Speicherbackends und die dauerhafte Identitätsmigration. Andere Fehlkodierungen werden nicht geraten. Keine Erkennungsquote wird aus den synthetischen Fällen abgeleitet. Windows/macOS, native Screenreader, reale Providerverträge und automatische Distribution behalten ihre gesonderten Voraussetzungen. **1.24.4 bleibt unveröffentlicht.**
