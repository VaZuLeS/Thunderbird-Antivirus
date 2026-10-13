# Aufgabenplan: Thundy AV optimieren und vollständig lokalisieren

Stand: 13. Oktober 2026 · geprüfte Version: 1.6.2 · Commit: `5560984`

Ziel: Die Extension funktioniert direkt nach der Installation vollständig auf Englisch und Deutsch. Französisch, Spanisch, Italienisch und Polnisch werden gemäß der nachfolgenden Nutzerentscheidung ebenfalls vollständig mitgeliefert. Zuerst werden Abweichungen im Zustimmungsmodell und beim Linkschutz geschlossen, danach Bedienung, Erkennungsqualität und Leistung verbessert.

Die ursprüngliche Analyse war ohne Produktivcodeänderung erstellt worden. Die inzwischen ausgeführten Änderungen stehen im Ausführungsstand unten. Es ergänzt den älteren [Store-Aufgabenplan](AUFGABENPLAN_STORE_READINESS.md); dessen erledigte Aufgaben werden hier nicht erneut als offen übernommen. Vollständige EN/DE-Unterstützung ist gemäß der aktuellen Anforderung eine Freigabevoraussetzung und keine optionale Nacharbeit.

## Geprüfter Stand

| Bereich | Ergebnis |
|---|---|
| Architektur | Thunderbird-WebExtension, Manifest V3, Mindestversion 140.0; Hintergrundlogik, Popup, Einstellungen, IndexedDB und API-Gateway |
| Sprachdateien | `_locales/en/messages.json` und `_locales/de/messages.json`, jeweils 31 Schlüssel; `default_locale: en` |
| Sprache der Oberfläche | Manifest, Teile der Banner, Menüs und Benachrichtigungen lokalisiert; Popup und Einstellungen weitgehend deutsch, einzelne englische Texte dazwischen |
| Erkennungsregeln | Kleine gemischte EN/DE-Signalwortliste; keine gezielte Abdeckung für FR/ES/IT/PL |
| Tests | `npm test`: **429 Tests bestanden**, 72 Suites, keine Fehler oder übersprungenen Tests |
| Vorprüfung | `npm run pre-submit-checks`: bestanden, eine Warnung wegen fehlender echter PNG/JPEG-Screenshots |
| Lint | `npm run lint:filtered`: keine Fehler, 19 als Thunderbird-spezifisch eingeordnete Warnungen |
| Aktive CI | `.github/workflows/ci.yml` führt nur `background.test.js` aus; umfassendere Vorlagen liegen unter `docs/ci/` |
| Live-Verifikation | In diesem Arbeitslauf keine Thunderbird-GUI und keine realen Provider-Aufrufe geprüft; der vorhandene Status dokumentiert offene Live-Tests und Screenshots |

Die vorhandenen Tests sind eine gute Grundlage, belegen aber noch nicht das vollständige Zustimmungsmodell oder einen funktionierenden Time-of-Click-Schutz. Ein Teil der Sicherheitsprüfungen kontrolliert nur Quelltextmuster, etwa die Anzahl von `requireHostPermission()`-Aufrufen.

## Befunde und Konsequenzen

| ID | Priorität | Konkreter Befund | Konsequenz / betroffene Quellen |
|---|---|---|---|
| B01 | P0 | `handleDisplayedMessage()` berechnet `canAutoUpload` einschließlich Absenderfreigabe, ruft Scanpfade aber unabhängig davon auf. Der Wert entscheidet anschließend nur über das Banner. `processAndUploadUrls()` prüft weder Absenderfreigabe noch `alwaysManual`; Anhangpfade prüfen `alwaysManual`, aber keine Absenderfreigabe. | Bei globaler Zustimmung und passender Stufe können Daten bereits beim Öffnen einer Nachricht übertragen werden, obwohl für diesen Absender keine Freigabe vorliegt. `background.js`: Nachrichtenanzeige, Anhänge, URLs, IP-/Domain-Reputation. |
| B02 | P0 | `checkUrlscanIo()` prüft globale Zustimmung und Host-Berechtigung, aber nicht `privacyTier`. | Der Aufruf über `checkLinkState` kann vollständige URLs auch in `strict`/`balanced` übertragen. `background.js`: `handleCheckLinkState()`, `checkUrlscanIo()`. |
| B03 | P0 | `injectTimeOfClickProtection()` setzt nur Tooltip und Linkstil. Im eingefügten Code fehlt ein Klick-Handler, der die Navigation anhält und `checkLinkState` aufruft. | Die Oberfläche suggeriert einen Schutz, den dieser Codepfad nicht durchsetzt. `background.js`: Injektion und Nachrichtenhandler. |
| B04 | P0 | Beim Speichern wird `externalAnalysisConsent: true` vor dem Berechtigungsdialog persistiert. Fallbacks melden Erfolg auch bei verweigerter `sensitiveDataUpload`-Anfrage. | Hintergrundaktionen können vor Abschluss der Zustimmung anlaufen; Ablehnung und nicht unterstützte APIs werden nicht sauber unterschieden. `options.js`: Speichern und Consent-Helfer. |
| B05 | P1 | Popup bricht ohne Hybrid-Analysis-Schlüssel früh ab; Einstellungen verlangen diesen Schlüssel auch zum Speichern anderer Optionen. Hintergrund-Anhangverarbeitung startet ohne ihn nicht. | Lokale Nutzung und Nutzung einzelner anderer Anbieter werden unnötig blockiert. `api.js`, `options.html`, `options.js`, `background.js`. |
| B06 | P1 | Popup/Einstellungen haben `lang="de"`; zahlreiche sichtbare Texte, Fehlermeldungen, ARIA-Texte und Risikobegründungen sind fest codiert. `evaluateLinks()` erkennt bereits vorhandene Gründe anhand deutschen Textes. | EN ist aktuell nicht vollständig nutzbar; bloßes Hinzufügen weiterer Sprachdateien reicht nicht. `popup.html`, `options.html`, `api.js`, `options.js`, `background.js`. |
| B07 | P1 | Reputation-Caches besitzen Größenlimits, aber keine zeitliche Gültigkeit. `checkURLhaus()` liefert bei Netzwerkfehlern `false`, was der Aufrufer als negatives Ergebnis speichert. | Veraltete oder fehlgeschlagene Prüfungen können wie unauffällige Ergebnisse weiterverwendet werden. `background.js`: Cache-Maps, URLhaus-/IP-/VT-Abfragen. |
| B08 | P1 | Einmaliger Banner-Scan arbeitet mit `{ id: request.messageId }`; Absender, Betreff und `headerMessageId` fehlen für nachgelagerte Bewertung und Speicherung. Anhänge mehrerer textbasierter MIME-Typen einschließlich HTML werden übersprungen. | Manuelle und automatische Pfade können unterschiedliche Datenqualität liefern; Abdeckung und Erreichbarkeit der HTML-Entschärfung prüfen. `handleRequestScan()`, `process_single_attachment()`, Popup. |
| B09 | P1 | Authentifizierungsheader werden als zusammengefügter Text auf `spf/dkim/dmarc=pass` geprüft; Hauptdomains werden überwiegend aus den letzten zwei Labels ermittelt. | Vertrauenswürdige Header-Herkunft, mehrteilige öffentliche Suffixe und internationalisierte Domains sind nicht ausreichend modelliert. `evaluateAuthHeaders()`, `getMainDomain()`. |
| B10 | P1 | `unlisted` für urlscan.io ist kein Beleg für private Verarbeitung. Vollständige URLs und Provider-Fehler können in Logs oder Ergebnisdaten landen. | Sichtbarkeit und sensible URL-Bestandteile müssen verständlich behandelt werden; Logs minimieren. `checkUrlscanIo()`, Gateway, Ergebnisdarstellung. |
| B11 | P2 | Anhangverarbeitung sowie IP-/Domain-Abfragen starten mehrere Arbeiten ohne gemeinsame Provider-Queue. HTTP 429 wird nur protokolliert. Das Polling zählt Wartezeiten, aber keine Request-Laufzeit. | Hohe Last, Quotenfehler und längere Laufzeiten als das nominelle 30-Sekunden-Limit. `sent_to_hybrid_by_attachment()`, Reputation, `api_gateway.js`, `pollUrlscanIoResult()`. |
| B12 | P2 | IndexedDB wird zusätzlich im Popup direkt geöffnet; DAO-Schreibmethoden lösen schon bei Request-Erfolg statt Transaktionsabschluss auf. „Cache leeren“ betrifft nur IndexedDB. | Speicherlogik ist verteilt; ein späterer Transaktionsabbruch wird nicht zuverlässig gemeldet, Memory-Caches bleiben erhalten. `db.js`, `api.js`, `options.js`, `background.js`. |

P0 = vor einer Freigabe korrigieren; P1 = für die nächste stabile Version einplanen; P2 = anschließende Optimierung.

Zusätzlich zur statischen Prüfung wurden drei Funktionen isoliert mit simulierten Abhängigkeiten ausgeführt, ohne echte Netzverbindung: URL-Autoupload erzeugte bei `alwaysManual=true` einen Request; urlscan.io erzeugte in `strict` einen Request; URLhaus lieferte bei simuliertem Netzwerkfehler `false`. Diese Befunde sind auf Funktionsebene bestätigt. Ein vollständiger Thunderbird-Live-Test steht weiterhin aus.

## Sprachkonzept für die Auslieferung

| Sprache | Ziel für die Auslieferung | Abnahme |
|---|---|---|
| Englisch `en` | Vollständig mitgeliefert, Standardsprache und Rückfall für nicht unterstützte Thunderbird-Sprachen | Alle Bedienelemente, Hilfen, Status- und Fehlertexte sowie Risikobegründungen vollständig englisch |
| Deutsch `de` | Vollständig mitgeliefert, automatisch bei deutscher Thunderbird-Oberfläche | Gleicher Funktionsumfang und gleiche fachliche Bedeutung wie EN |
| Französisch `fr` | Optionaler Ausbau nach EN/DE, Infrastruktur sofort vorbereiten | Vollständiger Katalog und sprachliche Prüfung vor Freigabe |
| Spanisch `es` | Optionaler Ausbau nach EN/DE | Wie FR; zunächst neutral formuliertes Spanisch |
| Italienisch `it` | Optionaler Ausbau nach EN/DE | Wie FR |
| Polnisch `pl` | Optionaler Ausbau nach EN/DE | Wie FR; zusätzlich korrekte Pluralformen prüfen |

Die Sprachdateien liegen im XPI. Es gibt keinen Download von Übersetzungen beim ersten Start. Die Thunderbird-Sprache bestimmt standardmäßig die Oberfläche; regionale Varianten wie `en-GB` und `de-AT` sowie nicht unterstützte Sprachen werden im realen Client geprüft. Eine manuelle Sprachwahl ist zunächst nicht nötig. Sollte sie später gewünscht sein, benötigt sie einen eigenen Katalog-Resolver: `browser.i18n.getMessage()` lässt sich nicht einfach auf eine frei gewählte Sprache umstellen.

**Oberflächensprache und Nachrichtensprache sind getrennt.** Eine englische Oberfläche muss deutsche oder polnische Phishing-Inhalte prüfen können. Die vorhandenen EN/DE-Heuristiken werden als eigene Aufgabe verbessert; eine Übersetzung der Oberfläche erweitert die Erkennung nicht automatisch.

Technische Vorgaben:

- Statische Texte über `data-i18n` und passende Attribute für `title`, `placeholder`, `aria-label` und Seitentitel lokalisieren; dynamische Texte über einen gemeinsamen Helfer auflösen.
- Gründe und Fehler als stabile Codes mit Parametern liefern, beispielsweise `{ code: 'reply_to_mismatch', params: [...] }`; erst bei der Anzeige übersetzen. Keine fachlichen Entscheidungen anhand übersetzter Texte.
- Texte für injizierte Banner möglichst im Extension-Kontext auflösen und als Daten übergeben. Damit hängt die Sprache nicht davon ab, ob `browser.i18n` im Nachrichtenkontext verfügbar ist.
- Zahlen und Datumswerte mit `Intl` formatieren. Für Zähltexte entweder passende Pluralregeln verwenden oder sprachlich neutrale Zählanzeigen einsetzen; besonders Polnisch berücksichtigen.
- Keine unkontrollierte HTML-Injektion aus Übersetzungen; Links und Hervorhebungen als sichere DOM-Elemente aufbauen. Provider-Namen, Datei-/Domainnamen und technische Signaturen müssen nicht übersetzt werden.
- Sicherheits- und Zustimmungstexte fachlich sowie sprachlich prüfen. Zusätzliche Sprachen erst als vollständig unterstützt ausweisen, wenn auch diese Texte abgenommen sind.

## Aufgaben und Abnahmekriterien

Aufwand = grobe Entwicklungsschätzung in Personentagen (PT), einschließlich gezielter Tests. Übersetzungsreview, Provider-Zugang und Live-Test-Kapazität sind zusätzlich einzuplanen. Die Aufgaben sind Vorschläge, noch keine umgesetzten Änderungen.

| Aufgabe | Prio / Bezug | Umsetzung | Abnahmekriterium | Aufwand / Voraussetzung |
|---|---|---|---|---|
| **T01 – Einheitliche Scanfreigabe** | P0 / B01 | Zentrale Entscheidung pro Scanoperation: globale Zustimmung, Einmalaktion oder Absenderfreigabe, manuell/automatisch, Datenschutzstufe und Anbieterberechtigung. Alle Provider-Pfade daran binden, auch Reputation. Autorisierte Nachricht mit vollständigen Metadaten durchreichen. | Ohne globale Zustimmung null Requests. Bei globaler Zustimmung, aber ohne Einmal-/Absenderfreigabe ebenfalls null Requests beim Öffnen. `alwaysManual` unterbindet automatische Uploads. Einmalscan autorisiert ausschließlich diese Nachricht. | 2–3 PT; zuerst |
| **T02 – urlscan.io an Stufe binden** | P0 / B02, B10 | Vollständige URL-Übermittlung ausschließlich in `max`, mit der Freigabe aus T01. In niedrigeren Stufen nur zulässige lokale/Domain-Prüfungen anbieten. Sichtbarkeit des Dienstes erklären. | `strict` und `balanced`: null vollständige URL-Requests an urlscan.io. `max`: nur nach autorisierter Aktion/Freigabe und Host-Recht. | 0,5–1 PT; T01 |
| **T03 – Zustimmung atomar speichern** | P0 / B04 | Consent zunächst verweigert lassen, Dialog in Nutzeraktion durchführen, erst bei erfolgreichem Abschluss freigeben. Unterstützte, verweigerte und nicht unterstützte Berechtigungsmodelle unterscheiden. Beim Widerruf Queue stoppen und laufende Requests möglichst abbrechen. | Bei Dialogablehnung oder Fehler bleibt die Übermittlung gesperrt. Während des Dialogs null Requests; nach Widerruf startet keine weitere Übermittlung. Bereits übertragene Daten sind nicht rückholbar. | 1–2 PT; T01 |
| **T04 – Time-of-Click funktional machen** | P0 / B03 | Klickbehandlung in der Nachrichtenansicht implementieren: Navigation während Prüfung anhalten, Status anzeigen, gefährliche Links warnen; Fehler/Timeout sichtbar behandeln. Auch Tastatur, modifiergestützte und mittlere Mausklicks prüfen. | Harmlose, gefährliche, unbekannte und nicht prüfbare Links zeigen nachvollziehbares Verhalten. Keine Schutzbehauptung ohne aktive Prüfung; nach Nachrichtenwechsel keine veraltete Entscheidung. | 2–4 PT; T01/T02 |
| **T05 – Lokale Nutzung ohne Pflichtschlüssel** | P1 / B05 | Hybrid-Analysis-Schlüssel optional machen. Lokale Ergebnisse und HTML-Entschärfung unabhängig davon verfügbar halten; Anbieter einzeln konfigurierbar machen. Kurzes EN/DE-Onboarding für lokal/extern und Stufen. | Frisches Profil ohne API-Schlüssel: Einstellungen speicherbar, lokale Bewertung sichtbar, keine Requests. Nur VirusTotal konfiguriert: erlaubte Hash-Prüfung nutzbar. | 1–2 PT; T01 |
| **T06 – Gemeinsame i18n-Basis** | P1 / B06 | Vollständiges Textinventar erstellen; Lokalisierungshelfer und DOM-Initialisierung ergänzen; Gründe/Fehler in Codes überführen; `lang` setzen; englischen Fallback vereinheitlichen. Neue Laufzeitdateien in Paket-Whitelist und Pflichtdateien aufnehmen. | Fachlogik enthält keine sprachabhängigen Vergleiche. Fehlende Schlüssel ergeben definierten englischen Text. Neue Dateien und Locale-Kataloge sind im geprüften XPI. | 1–2 PT |
| **T07 – EN/DE vollständig ausliefern** | P1 / B06 | Popup, Einstellungen, Banner, Menüs, Notifications, ARIA, Hilfen und Fehlerpfade übersetzen. Sicherheitsbegriffe und externe Provider-Status vereinheitlichen; Consent-/Datenschutzinformationen zugänglich in EN/DE halten. | Frische Installation in EN und DE zeigt durchgehend die jeweilige Sprache, einschließlich fehlender Schlüssel, verweigerter Rechte, leerer Ergebnisse und Fehlerzustände. Keine deutsche Restoberfläche in EN. | 2–3 PT; T06 |
| **T08 – Lokalisierung als Release-Gate** | P1 / B06 | Katalog-/Placeholder-Prüfung, DOM-Tests pro Sprache, Tests für injizierte Texte, unbekannte Locale und regionale Varianten. Prüfen, dass Pflichtkataloge im Paket enthalten sind. Layout mit längeren Übersetzungen und 200 % Zoom prüfen. | CI schlägt bei fehlenden EN/DE-Schlüsseln, leeren Pflichttexten oder defekten Platzhaltern fehl. EN/DE-Screenshot- und Tastaturprüfung dokumentiert. | 1–2 PT; T06/T07 |
| **T09 – Scanpfade und Anhangabdeckung korrigieren** | P1 / B08 | Banner-Scan lädt vollständige Nachricht statt Minimalobjekt; gültige Speicheridentität prüfen. MIME-Ausschlüsse fachlich neu bewerten, insbesondere HTML/Skripte; lokal entschärfen auch ohne externen Report erreichbar machen. | Banner-/Automatikscan derselben Testmail verwenden dieselben Metadaten und speichern korrekt. HTML-Anhang erscheint mit lokaler Aktion; ausgeschlossene Typen erhalten verständlichen Status. | 1–2 PT; T01/T05 |
| **T10 – Ergebniszustände und Cache-Gültigkeit** | P1 / B07, B10 | `not_checked`, `pending`, `no_detection`, `malicious`, `error` und `timeout` unterscheiden. Provider, Zeitstempel und konfigurierbare Gültigkeit speichern. Fehler nie als unauffällige Reputation cachen; bei Anbieterwechsel invalidieren. Sensible URL-Daten/Logs minimieren. | Fehler und fehlende Daten erscheinen nicht als „sicher“. Nach Ablauf wird neu geprüft; Anbieterwechsel nutzt keine alten Fremdergebnisse. Anzeigen nennen Quelle und Zeitpunkt. | 1,5–3 PT |
| **T11 – Domains und Authentifizierung verbessern** | P1 / B09 | Registrierbare Domains anhand einer lokal mitgelieferten Public-Suffix-Lösung ermitteln; IDN/Punycode berücksichtigen. Vertrauenswürdige `Authentication-Results` anhand Herkunft und Mailserver-Kontext auswerten. Keine absolute Absenderverifikation behaupten. | Tests für `co.uk`, private Suffixe, Subdomains und IDNs; fremde/gefälschte Authentifizierungsheader ergeben keinen verifizierten Status. | 2–4 PT |
| **T12 – Aktive CI vollständig prüfen lassen** | P1 / Testlücke | Tatsächlichen Workflow auf `npm test`, gefilterten Lint und Build/Paketprüfung erweitern. Verhaltensmatrix für Operation × Zustimmung × Aktion/Absender × Stufe × Rechte ergänzen; Request-Ziel und Payload prüfen. | PR-Workflow führt alle Suiten und Paketprüfung aus. Tests schlagen bei den B01–B04-Verletzungen fehl; reine Quelltextzählung ersetzt diese Prüfungen nicht. | 1–2 PT; während T01–T08 |
| **T13 – Last und Quoten steuern** | P2 / B11 | Provider-Queue mit begrenzter Parallelität und Request-Deduplizierung; Größen-/Mengenlimits vor File-Reads; absolute Deadline für Polling einschließlich Requests. 429/`Retry-After` und temporäre Fehler behandeln. Keine blinden Wiederholungen von Uploads, die Doppeljobs erzeugen. | Lasttest mit vielen Links/Anhängen hält konfigurierte Grenzen ein. Nach Deadline/Widerruf keine neuen Requests; UI bleibt bedienbar. Vorher/nachher Laufzeit und Speicherspitzen messen. | 2–3 PT; T01/T10 |
| **T14 – Datenzugriff und Löschen vereinheitlichen** | P2 / B12 | DAO als einzigen Datenzugang verwenden, Schreiboperationen an Transaktionsabschluss binden. Aufbewahrungsfrist/Bestandslimit für Ergebnisdaten, alle Memory-Caches über Hintergrundaktion leeren. | Transaktionsabbruch wird als Fehler gemeldet; „Cache leeren“ entfernt IndexedDB- und Memory-Ergebnisse. Alte Datensätze werden nach definierter Frist entfernt. | 1–2 PT; T10 |
| **T15 – Mehrsprachige Erkennung verbessern** | P2 / Heuristiken | EN/DE-Signalwörter als eigenständige Regelpakete pflegen; Unicode-Wortgrenzen/Normalisierung und kontextbezogene Kombinationen verwenden. Legitime Zahlungs-/Rechnungsmails als Gegenbeispiele einbeziehen. FR/ES/IT/PL-Erkennungsregeln unabhängig von UI-Übersetzungen erweitern. | Dokumentierter EN/DE-Korpus mit harmlosen und verdächtigen Nachrichten; Vergleich von Fehlalarmen und Treffern. Gemischtsprachige Nachricht wird unabhängig von UI-Sprache bewertet. Für weitere Erkennungssprachen jeweils eigener geprüfter Korpus. | 2–4 PT für EN/DE; weitere Sprachen separat |
| **T16 – FR/ES/IT/PL ergänzen** | P2 / optional | Je Sprache vollständigen Katalog, Fach-/Sprachreview und lokale Screenshots erstellen; maschinelle Erstübersetzung nur als Entwurf. Provider-Namen, Platzhalter und URLs erhalten. | Alle T08-Prüfungen pro Sprache grün, Zustimmungstexte freigegeben, keine sichtbaren Fallback-Lücken. Polnische Zähltexte korrekt. Unterstützte Sprachen im Listing aktualisiert. | 0,5–1,5 PT je Sprache für Integration; Übersetzungsreview zusätzlich; T06–T08 |
| **T17 – Struktur und HTML-Bereinigung pflegen** | P2 / Wartbarkeit | Hintergrundlogik nach Policy, Provider, Bewertung und UI aufteilen; Popup-Datenzugriff vereinheitlichen. HTML-Bereinigung auf erlaubte Elemente/Attribute und externe Ressourcen prüfen; bestehende Angriffstests erhalten. Paketgate um neue Module aktualisieren. | Kleine fachliche Module, unveränderte dokumentierte Zustimmungsregeln; Sanitizer-Korpus einschließlich Template/SVG, URI-Schemata und Remote-Ressourcen geprüft. Kein pauschales Sicherheitsversprechen. | 2–4 PT; nach funktionalen Korrekturen |
| **T18 – Freigabe im echten Thunderbird** | P0 für Release | Vorhandenes Live-Protokoll erweitern: EN/DE-Erstinstallation, Stufen, Absenderfreigabe, Widerruf, Banner, Linkklicks, lokale Nutzung, HTML-Aktion und Cache. Thunderbird 140 ESR sowie aktuelle unterstützte Version prüfen; echte Screenshots erstellen. | Alle P0-Aufgaben und EN/DE-Gates bestanden. Testprotokoll enthält Versionen, beobachtete Datenübermittlung und bekannte Grenzen. Keine Freigabe allein auf Basis der Node-Tests. | 1–2 PT; vor Veröffentlichung, nach T01–T12 |

## Empfohlene Reihenfolge

1. **Zustimmungsmodell absichern:** T01–T03, dazu die relevanten Regressionstests aus T12. Das verhindert unerwartete Übermittlungen und Stufenverletzungen.
2. **Kernfunktion und Sprachen fertigstellen:** T04–T09 sowie T10–T12. EN/DE vollständig im Paket ausliefern; lokale Nutzung ohne Kontoeinrichtung ermöglichen.
3. **Qualität und Leistung verbessern:** T13–T15 und T17 anhand gemessener Engpässe umsetzen. Weitere Mikrooptimierungen erst nach Messung auf repräsentativen Nachrichten.
4. **Zusätzliche Sprachen freigeben:** T16 nach Verfügbarkeit geeigneter Übersetzungsreviews. FR/ES/IT/PL sind architektonisch gleichberechtigt; die Reihenfolge kann sich nach Nutzerbedarf richten.
5. **Jede Veröffentlichung prüfen:** T18 mit den jeweils als unterstützt ausgewiesenen Sprachen durchführen; Dokumentation und Store-Angaben an den tatsächlichen Umfang anpassen.

**Freigabekriterien für die nächste EN/DE-Version:** vollständige lokale Sprachkataloge; keine externe Anfrage ohne passende Zustimmung und Scanfreigabe; vollständige URLs ausschließlich in `max`; funktionierender und ehrlich dargestellter Linkschutz; alle Suiten in der aktiven CI; nachvollziehbare Ergebniszustände; bestandene Live-Tests und echte Screenshots.

## Referenzen

- Code: [Manifest](../manifest.json), [Hintergrund](../background.js), [Popup-Logik](../api.js), [Einstellungen](../options.js), [API-Gateway](../api_gateway.js), [DAO](../db.js).
- Sprache: [EN](../_locales/en/messages.json), [DE](../_locales/de/messages.json), [Options-HTML](../options.html), [Popup-HTML](../popup.html).
- Qualität: [aktive CI](../.github/workflows/ci.yml), [Consent-/Tier-Tests](../test/consent-and-tier.test.js), [Paketprüfung](../scripts/verify-package.js), [Live-Test-Protokoll](live_test_protocol.md).
- Vorheriger Projektstand: [STATUS](STATUS.md), [Store-Aufgabenplan](AUFGABENPLAN_STORE_READINESS.md), [Datenschutzerklärung](privacy_policy.md).


## Ausführungsstand: Entwicklungskandidat 1.19.0

**Präzisierung des Auftrags:** Alle sechs Sprachen EN/DE/FR/ES/IT/PL werden vollständig mitgeliefert. Der optionale Sprachumfang der ursprünglichen Planung ist damit Teil der Umsetzung. Je Sprache liegen **241 Schlüssel** einschließlich Sicherheits-, Fehler- und Datenschutzhinweisen lokal im Paket. Oberflächensprache und Nachrichtensprache sind getrennt.

| Aufgabe | Ausführungsstand | Konkreter Nachweis |
|---|---|---|
| T01 | Implementiert und automatisch geprüft | `scan_policy.js`; Öffnen nicht freigegebener Absender bleibt in allen Stufen ohne Requests; manuelle und dauerhafte Freigaben nutzen tatsächliche Nachrichtenmetadaten |
| T02 | Implementiert und automatisch geprüft | `providers.js`; urlscan.io verweigert vollständige URLs in Strict/Balanced; Gateway und Host-Rechte bleiben erforderlich |
| T03 | Implementiert und automatisch geprüft | `options.js`; kombinierte Consent-/Host-Anfrage beginnt in der Save-Aktion, Persistenz bleibt bis zur Zustimmung false; Tests für offenen/abgelehnten Dialog und Abbruch laufender/wartender Requests |
| T04 | Implementiert und im DOM geprüft; Client-Abnahme offen | `message_ui.js`; Klick/auxclick werden angehalten, Prüfergebnis und Öffnen/Abbrechen angezeigt; Escape/Fokusführung; Bindung an Nachricht und unveränderten Link |
| T05 | Implementiert und automatisch geprüft | Keine Pflicht-API-Schlüssel; Popup-Bootstrap zeigt lokalen Risiko-Score und HTML-Aktion ohne Netzaktivität; lokale Hilfe und bearbeitbare Absenderfreigaben |
| T06 | Implementiert | `i18n.js`, `data-i18n` und Attributlokalisierung; stabile Codes/Parameter für Bewertungsgründe, sicherer DOM-Aufbau, englischer Fallback und Locale-Formatierung |
| T07 | Implementiert | Vollständige EN/DE-Oberfläche einschließlich ARIA, Fehlern und lokalem `privacy.html`; bekannte Provider-Urteile lokalisiert |
| T08 | Automatisches Sprach-/Paketgate implementiert; visuelle Client-Abnahme offen | `test/i18n.test.js`: sechs Kataloge, Platzhalter, regionale Varianten, nicht unterstützte Sprache, injizierbare Texte, lokaler Popup-Start; responsive CSS. Zoom/Dark Mode und echte Screenshots gehören zu T18 |
| T09 | Implementiert und automatisch geprüft | Vollständige Metadaten im Banner-Scan; Text-/HTML-Anhänge bleiben verfügbar; MIME-Teilarrays werden korrekt gelesen; Größenlimit als eigener Status |
| T10 | Implementiert und automatisch geprüft | 15-Minuten-Reputation-Caches, Quellen/Ergebniszeitpunkte in Datensätzen, Invalidierung bei Anbieter-/Schlüsselwechsel. URLhaus-/IP-Fehler bleiben unbekannt und werden erneut geprüft; „kein Fund“ ist keine Sicherheitsgarantie |
| T11 | Implementiert und automatisch geprüft; Mailserver-Kontext im Client prüfen | Lokal mitgeliefertes `tldts` 7.4.10 mit Public Suffix List und privaten Suffixen; IDN-Normalisierung; nur explizit konfigurierte Authentifizierungsserver werden berücksichtigt |
| T12 | Aktiver Workflow geändert; lokal geprüft | `.github/workflows/ci.yml`: Vorprüfung, Fallback/Vendor, vollständiges `npm test`, gefilterter Lint, Build/Paketprüfung. Provider-Rechte und Payload-/Stufenregeln werden im Verhalten geprüft |
| T13 | Implementiert und synthetisch gemessen | Zwei Provider-Anfragen pro Host, zwei Anhangarbeiten, Mengen-/Größenlimits, GET-`Retry-After`, keine automatischen POST-Wiederholungen. Deadline und Widerruf gelten bis einschließlich JSON-Body |
| T14 | Implementiert und automatisch geprüft | Popup nutzt DAO; Schreiboperationen warten auf Transaktionsabschluss. Spätes Abort wird gemeldet; Cachebereinigung beim Datenbankstart auf 30 Tage/1.000 Nachrichten; Memory- und Popup-Caches werden beim Löschen berücksichtigt |
| T15 | Implementiert und mit kleinem Korpus geprüft | `risk.js`, `testdata/heuristics.json`: Unicode-Wortgrenzen, normalisierte Signalwörter, reine Rechnungs-/Zahlungsbegriffe lösen keine BEC-Warnung aus; gemischte Nachrichten und FR/ES/IT/PL-Signale. Der synthetische Korpus ist kein Nachweis einer realen Erkennungsquote |
| T16 | Vollständige Kataloge implementiert und technisch geprüft | FR/ES/IT/PL jeweils mit identischer Schlüssel-/Platzhalterstruktur, vollständigen Zustimmungs- und Datenschutztexten. Polnische Zähltexte neutral formuliert; endgültiges sprachliches Gegenlesen und Screenshots im Live-Protokoll |
| T17 | Implementiert und Regressionen geprüft | Module `scan_policy.js`, `providers.js`, `risk.js`, `message_ui.js`, `sanitize.js`, `runtime.js`; Sanitizer entfernt aktive Elemente und Remote-Ressourcen. Paketgate enthält alle Module und Lizenzen |
| T18 | **Blockiert: echte Client-Abnahme ausstehend** | Kein Thunderbird-Client/Testpostfach/Provider-Testzugang im Arbeitsbereich. Ausfüllbares Protokoll: [live_test_1_19_0.md](live_test_1_19_0.md). Keine Ist-Werte oder echten Screenshots wurden erfunden |

### Verifikation und Grenzen

- Vollständiger lokaler Gate: `npm run check` (Vorprüfung, Fallback/Vendor, alle Tests, Lint, Build und Paketprüfung). **485 Tests bestanden**, 73 Suites, 0 Fehler/übersprungene Tests; Lint: **0 Fehler**, 22 bekannte Thunderbird-Warnungen. Paket: **31 Dateien / 519.476 Bytes entpackt**, alle sechs Kataloge enthalten.
- Synthetischer Lastvergleich (`node scripts/benchmark-scan-limits.js`): 40 simulierte Anhänge à 2 MiB. Begrenzte Verarbeitung: **2 gleichzeitig / 4 MiB Eingabepuffer**, 44 ms; vorheriges unbeschränktes Muster: **40 gleichzeitig / 80 MiB**, 43 ms. Das misst die geplante Eingabepufferlast in Node, nicht Thunderbird-RSS oder reale Scanlatenz.
- Public-Suffix-Abhängigkeit ist als Entwicklungsabhängigkeit exakt auf `7.4.10` gepinnt. `scripts/update-vendor.js` prüft Bytegleichheit und Lizenz; keine Remote-Laufzeitbibliothek.
- Das Paketbudget wurde begründet auf 600 KiB entpackt angehoben: sechs vollständige Sprachkataloge und lokale Public-Suffix-Daten. Benchmarks werden nun ausdrücklich aus dem Paket ausgeschlossen; alle sechs Kataloge sind Pflichtdateien.
- Versionsstand von Manifest, npm-Metadaten und Lockfile ist **1.19.0**. Kandidat **nicht signiert oder veröffentlicht**. Historische Release-Angaben zu 1.6.2 bleiben als solche erhalten.
- Die aktive CI-Datei ist lokal geändert; ein tatsächlicher GitHub-Workflow-Lauf ist ohne Push nicht belegt.
- Freigabe bleibt von T18 abhängig. Reale Berechtigungsdialoge, Nachrichtennavigation, Provider-Sichtbarkeit, Sprache/Layout bei 200 % Zoom und Dark Mode müssen im Client bestätigt werden.

### Testartefakt

Unsigniertes lokales Testpaket: `build/thundy-av-1.19.0.xpi` (149748 Bytes). SHA-256: `ac81fa6d7c53cc910edb0fcc7d30cef45c88afbb135ec6e51af1717793317d99`. Es ist bytegleich mit dem geprüften ZIP. Das Release-Workflow baut den Tag erneut und liefert die Prüfsumme seines veröffentlichten Assets in `SHA256SUMS.txt`.

### Veröffentlichung beauftragt (13. Oktober 2026)

Der Nutzer hat Commit, Push, GitHub-Release und Aktualisierung der GitHub Pages ausdrücklich beauftragt. Version **1.19.0** vermeidet die bereits vorhandenen Tags bis v1.18.0. `.github/workflows/release.yml` veröffentlicht nach erfolgreichem Gate das unsignierte XPI samt Prüfsumme; `.github/workflows/pages.yml` baut die Dokumentation unter `docs/`. Die offene T18-Abnahme wird in Release-Hinweisen und Pages ausgewiesen.
