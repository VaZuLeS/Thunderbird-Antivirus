# Verträge der Weiterentwicklung — TAV-020/021/027/028

## Runtimes und Zuständigkeiten

Die Thunderbird-Hintergrundseite lädt `risk.js` für lokale Heuristik, `link_audit.js` für serialisierte lokale Entscheidungen und `background.js` für Nachrichten-/Providerkoordination. `message_ui.js` serialisiert eine isolierte Dialogfunktion samt übersetzten Labels in die Nachrichtenansicht. `api.js` ist der eigenständige Popup-Client; `audit.js` liest/exportiert lokale Ereignisse. Die Node-Werkzeuge in `scripts/` und `enterprise/` sowie die React-Demo gehören nicht zur Thunderbird-Runtime. Es gibt keinen Frameworkwechsel.

`parseAuthenticationResults(headers)` ist ein reiner Parser in `risk.js`. Er liefert pro SPF/DKIM/DMARC die erkannten Ergebnistokens. Kommentare/quoted strings sind keine Ergebnisquellen; fehlerhafte Syntax ist unbekannt, Fail hat Vorrang, widersprüchliche/unvollständige Resultate ergeben kein Pass. Er verifiziert keine kryptografischen Signaturen. Die separate erste-Header-/Trusted-Authserver-Auswahl bleibt in `collectThreatEvaluationOptions`.

## Erreichbare gespeicherte Linkzustände

Untersucht wurden der aktuelle Schreib-/Lesepfad und `v1.24.2:background.js`/`api.js`:

| Writer / Reader | Verhalten |
| --- | --- |
| `processAndUploadUrls` | `UNKNOWN` vor/ohne Upload; `UPLOADED` nach angenommener Einreichung |
| `handleUrlScan` / manuelle Aktualisierung | setzt `UPLOADED` |
| `persistHybridReport` | speichert `report` und `report_fetched_at`, ersetzt `state` nicht durch das Urteil |
| `checkHybridAnalysisVerdict` | kompatibler String-Wrapper; kein persistierender Writer |
| `handleCheckLinkState` | liest Zustand; neuer strukturierter Vertrag ohne rückwirkende Änderung gespeicherter Urteile |
| importierte/manuell veränderte/sonstige historische Zustände | technisch lesbar; kein regulärer CLEAN-Writer in den untersuchten Pfaden gefunden |

Ein positives CLEAN-Cacheproblem im normalen Writer ist damit nicht belegt. Fehlende Aktualitäts-/Fehlerangaben betrafen dennoch reguläre UPLOADED-/UNKNOWN-Fallbacks. `created` einer Einreichung und `report_fetched_at` eines anderen Berichts werden nicht als Beobachtungszeit des Zustands umgedeutet.

## Ergebnis eines Linkchecks

Bestehende Felder `status`, `provider`, optionale `reasons` bleiben kompatibel. Der neue optionale `check`-Block enthält:

- `origin`: `live`, `stored` oder `none`.
- `outcome`: `success`, `failed`, `disabled`, `permission_denied`, `missing_key`, `missing_reference`, `not_requested` oder `no_result`.
- `attemptedAt`: Zeit der ausdrücklich angeforderten Prüfung, sonst `null`. Dies beweist keinen Netzwerkzugriff; eine lokale Voraussetzung kann den Versuch verhindern.
- `observedAt`: Zeit der erfolgreich erhaltenen Anbieterbeobachtung, gespeicherter belegter Originalzeitpunkt oder `null`. Ein Fallback erhält keinen neuen Beobachtungszeitpunkt.

Gespeicherte Warnungen bleiben erhalten. Ein gespeichertes CLEAN wird im Dialog nicht als frisches positives Ergebnis gestaltet. `checkedAt` neuer Auditdatensätze ist nur bei erfolgreicher aktueller Anbieterantwort gesetzt; bestehende historische Felder werden nicht neu interpretiert. Alte Datensätze ohne `check` bleiben lesbar und besitzen keine nachträglich erfundene Herkunft.

## Nachrichten und Entscheidungsgrenzen

`validLinkRequest` prüft HTTP(S), begrenzte URL-Länge, ganzzahlige Nachrichten-/Tab-ID und optional begrenzte Interaktions-ID. Checks benötigen eine boolesche `userAction`; Öffnen/Abbrechen übertragen keine neue externe Zustimmung. Danach folgen weiter die bestehenden aktiven Nachrichten-/URL-/Sessionprüfungen. Ungültige Payloads lösen keine Prüfung/Öffnung aus.

Die Audit-JSON-Hülle bleibt Version 1 mit optionalen additiven Feldern, kompatibel zum bestehenden Offlineimport. CSV ergänzt Spalten und serialisiert strukturierte Werte als JSON. Neue Entscheidungen erhalten `reasonsAtDecision`, `reasonDetailsAtDecision`, `providerReasonsAtDecision`, `checkAtDecision`. Nur vor `decidedAt` verfügbare Befunde werden kopiert. Spätere Resultate ergänzen aktuelle Felder; Originaltexte, Scores und Snapshots bleiben erhalten. Ein Altbestand ohne Snapshot wird nicht aus heutigen Gründen ergänzt. OPENED bestätigt weiterhin ausschließlich die angenommene Öffnungsanforderung; PENDING bleibt nach Prozessverlust offen.

## TAV-027 — Entscheidung und vorgeschlagenes Schema

Es gibt keine belegte Nachfrage oder geeigneten Nutzertest für portable lokale Profile. Der aktuelle Auftrag rechtfertigt die Untersuchung, liefert aber keine konkrete Auswahl übertragbarer Schutz-/Privatsphäreentscheidungen. Deshalb endet die freigegebene Konzeptphase mit einem bewusst kleinen [Schemaentwurf](schemas/local-settings-profile-v1.proposal.json): ausschließlich Darstellung. Er ist weder importierbares Runtimeformat noch aktivierte Integration.

Ein späterer Import muss ein enges Schema, vollständige Vorschau mit Feldvergleich, explizite Bestätigung, atomare Speicherung und Abbruch ohne Teilübernahme umsetzen. Nicht enthalten: Keys, Tokens, Senderlisten, Audit, Nachrichten, Consent, Hostrechte, Datenschutzstufe oder Enterpriseaktivierung. Vor einer Erweiterung um lokale Schutzoptionen sind übertragbare Werte und die Darstellung einer Schutzabschwächung mit Nutzern festzulegen. Die bestehende Theme-Einstellung reicht für die gegenwärtig belegte Aufgabe aus; kein zusätzlicher Importcode ohne diesen Bedarf.
