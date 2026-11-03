# Lokaler Quellenbericht — AVN-011

Stand: 3. November 2026, unveröffentlichte Entwicklung 1.24.4.

## Zweck und Bedienung

Das Toolbar-Popup der konkreten Nachricht öffnet über „Quellenbericht als Vorschau öffnen“ eine eigene Add-on-Seite. Dort wird erst nach „Vorschau“ der aufgezeichnete Stand gelesen. „Vorschau verwerfen“ löscht die Vorschau; „Lokal speichern“ öffnet Thunderbirds echten Download-/Speicherdialog. Das Öffnen, Vorbereiten und Speichern startet keine neue lokale Bewertung, Providerabfrage oder Übermittlung. Es erteilt keine Einwilligung oder Berechtigung.

Die Seite verwendet das gemeinsame Theme und vorhandene Layouts, einschließlich heller/dunkler Darstellung, Dichte und fokussierbarer Textvorschau. Hinweise, Aktionen und Statusmeldungen werden in EN/DE/FR/ES/IT/PL mitgeliefert. Der JSON-Inhalt verwendet stabile maschinenlesbare Codes. Die Meldung nach Annahme einer Speicheranforderung behauptet keinen abgeschlossenen Download; dessen Abschluss ist in Thunderbird zu prüfen.

## Datenvertrag

`source_export.js::ThundySourceExport.project` erstellt ausschließlich positiv gelistete Felder. Der Bericht hat `schemaVersion:1`, `kind:thundy-analysis-sources` und `authenticatedSource:false`.

| Bereich | Inhalt |
| --- | --- |
| `createdAt` | Zeitpunkt der Vorschauerstellung in Millisekunden seit Unix-Epoch; keine Verjüngung der Befundzeiten |
| `current.local` | Aufgezeichneter lokaler Zustand, Herkunft, Zeitpunkt und bekannter Grund für unvollständige/nicht verfügbare Inhalte |
| `current.rows` | Dienst, Prüfumfang, Zustand, Ergebnisquelle, Bewertung, begrenzte Zähler und ursprüngliche Anfrage-/Beobachtungs-/Befundzeiten |
| `current.availability` | Bekannte Verfügbarkeitsgründe für alle fünf optionalen Dienste; kein Schlüssel-/Konfigurationsexport |
| `current.diagnostics` | Bekannte Nichtverfügbarkeit und fehlgeschlagene Quellen-/Protokollspeicherung |
| `history` | Gespeicherte Quellenbeobachtungen, ausdrücklich `association:unconfirmed`, ohne aktuellen Ressourcenbezug |
| `truncated` | Bekannte Darstellungs-/Projektionsgrenze erreicht; kein Anspruch auf vollständige Historie |

Aktuelle Ressourcen werden als `message`, `unknown` oder als `attachment`/`link` mit einer **nur innerhalb dieses Berichts** vergebenen laufenden Nummer dargestellt. Gleiche Ressourcenreferenzen erhalten dieselbe Nummer; ursprüngliche Partnummern und Cachepositionen werden nicht ausgegeben. Historische Ressourcen bleiben `unbound` und werden nicht mit aktuellen Ordinalen verbunden.

URLs, Dateinamen, Hashes, IP-Adressen, Schlüssel, Rohprotokolle, Mailtext, Betreff, Absender, Profil-/Nachrichtenkennungen und Kontexttoken sind ausgeschlossen, auch wenn unerwartete Felder in der Eingabe stehen. Unbekannte Codes werden nicht als Freitext kopiert. Ungültige Zeitwerte bleiben `null`; Zähler sind auf 100.000, aktuelle und historische Zeilen jeweils auf 1.200 begrenzt. Laufende/gescheiterte/unvollständige Prüfungen bleiben unterscheidbar. Linkentscheidungen und ihre damaligen Snapshots sind nicht Teil dieses Berichts.

Der Bericht enthält weiterhin **Bewertungen und genaue Zeitpunkte**. Er ist deshalb vor dem Teilen zu prüfen. Er ist keine vollständige Anfragechronik, kein authentifizierter Unternehmensbeleg und kein Export der [vollständigen Protokollrevisionen](PROTOKOLLHISTORIE.md).

## Kontextwechsel, Änderungen und Löschung

Ein Export-Link enthält einen Laufzeit-Locator und das flüchtige UUID-Token des Quellenkontexts. Beide bleiben ausschließlich in der lokalen Seitenadresse; die Datenprojektion exportiert sie nicht. Bei jedem Lesen werden Kennung **und Token** geprüft. Nach Neustart, Kontextablauf oder Cacheverlust verweigert ein alter Link die Vorschau, statt eine wiederverwendete numerische ID als dieselbe Nachricht zu behandeln. Der Nutzer öffnet dann den Bericht erneut aus dem Popup der gewünschten Nachricht.

Quellenänderungen der Nachricht und `memoryCachesCleared` verwerfen eine fertige oder noch laufende Vorschau. Vor dem Speichern wird der aufgezeichnete Stand nochmals ohne neue Analyse gelesen und mit genau der Vorschau verglichen. Ein geänderter, gelöschter oder nicht mehr verfügbarer Stand wird nicht heruntergeladen; eine neue Vorschau ist erforderlich. Abbruch, verspätete Antworten und das Schließen der Seite können keine neue Speicherung auslösen. Fehlertexte werden nicht ungeprüft in den Bericht oder die Seite übernommen.

Eine bereits von Thunderbird angenommene Downloadanforderung und eine gespeicherte Datei gehören anschließend zum Download-/Dateisystemlebenszyklus. Die Extension entfernt diese Datei nicht durch späteres Leeren des Caches oder Verwerfen einer Vorschau. Die bestehenden Cache-/Auditregeln bleiben unverändert; es gibt keine neue automatische Löschung oder Serverübertragung.

## Validierung und Grenzen

Der [maschinenlesbare Nachweis](audits/avn-011-source-export-2026-11-03.json) bindet Ergebnisse an Quellfingerprint und geprüfte Paketbytes. Die gezielten Node-/DOM-Prüfungen verwenden simulierte Browser-/Downloadverträge. Sie prüfen die Positivliste mit vertraulichen Zusatzfeldern, alle fünf Dienste, ursprüngliche Zeiten, abstrakte Ordinale, unbestätigte Historie, Grenzen, alle sechs UI-Sprachen, Fokus, Abbruch, geänderte Kontexte, Cachelöschung, verspätete Antworten und Downloadfehler. Die Hintergrundprüfung zeigt, dass ein neuer Kontext ein anderes Token erhält, ohne externe Anfrage.

Der native Prüfer `--source-export-check` nutzt echte Thunderbird-APIs, den tatsächlichen Popup-Einstieg, die Exportseite und einen GTK-Speicherdialog. Die Quellenbeobachtungen sind synthetisch eingespeist. Er vergleicht die tatsächlich abgeschlossene JSON-Datei mit der Vorschau und prüft Verwerfen, Cachelöschung und Abweisung des alten Links nach Neustart. Keine Live-Providerabnahme und keine native Screenreaderabnahme daraus ableiten.

```sh
node --test test/source-export.test.js test/optimization.test.js
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.4.xpi \
  --source-export-check --out /absolute/path/to/new-result-directory
```

Abschluss: **1.052 automatisierte Tests erfolgreich**, vollständige Source-/Sprach-/Design-/Lint-/Paketprüfung und drei Byte-Regressionen des Prüfrunners erfolgreich. Die nativen Exportläufe unter **Thunderbird 140.12.0 und 153.6.0 auf Linux** bestehen jeweils mit einem echten Neustart. Der [X11-Screenshot der Vorschau](screenshots/1.24.4/source-export-preview.png) zeigt die gemeinsame Oberfläche und sichtbare Speicheraktion; der 153-Lauf prüft zusätzlich ihre tatsächlichen Größen-/Sichtbarkeitseigenschaften. Die anfänglichen Exportproben wurden von einem noch ausstehenden Popup-Update korrekt invalidiert; der Prüfer wartet jetzt auf dessen Abschluss. Die Produktbytes änderten sich zwischen diesen Versuchen nicht.

Die separate 153-Regression für Quellenhistorie und Protokollarchiv besteht auf denselben Paketbytes mit zwei Neustarts. Das manuelle Upgrade von veröffentlichter 1.24.3 besteht mit drei normalen Neustarts einschließlich Profilrestore sowie zwei SIGKILL-Neustarts. Der neue Exportlauf ist separat in CI verdrahtet; daraus wird kein bereits erfolgreicher Remote-CI-Lauf für einen späteren Commit abgeleitet. Kein neuer Chromium-/axe-Erfolg wird behauptet.

AVN-011 ist für diesen begrenzten lokalen Metadatenexport umgesetzt und geprüft. Dauerhafte Inhalts-/Vorkommensmigration, unabhängige Langzeitarchivierung, Windows/macOS-/Screenreaderabnahmen, reale Providerkonten und automatische Updateverteilung bleiben eigenständige Aufgaben. **1.24.4 bleibt unveröffentlicht.**
