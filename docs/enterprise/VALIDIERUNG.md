# Konzept- und Vertragsprüfung

Stand: 14. Oktober 2026. Geprüft wurden die Entwürfe, nicht ein Enterprise-Server oder eine neue Extension-Implementierung.

## Ergebnis

- JSON Schema Draft 2020-12: beide Schemas formal gültig.
- 31 Datenfälle: 6 gültige Fälle angenommen, 25 ungültige Varianten zurückgewiesen.
- 30 eindeutig benannte Arbeitspakete; referenzierte Aufgaben vorhanden; explizite und gruppierte Abhängigkeiten ohne Zyklen.
- 61 relative Markdown-Verweise in Konzept, Vertragsübersicht, Admin-Roadmap, README und Dokumentationsindex auf vorhandene Dateien geprüft.
- `git diff --check`: keine Formatfehler.

Die Python-Prüfung verwendete `jsonschema[format]` und `FormatChecker`, damit Datums-/UUID-/URI-Formate tatsächlich geprüft werden. Ohne installierte Format-Erweiterungen genügt das bloße Angeben von `format` nicht für die entsprechenden Negativprüfungen.

## Geprüfte Datenfälle

| Kategorie | Fälle | Erwartung |
|---|---:|---|
| Unverändertes Policy- und Ereignisbeispiel | 2 | Gültig |
| `CLICKED`, `ASSESSMENT`, `OPEN_INTENT`, `ASSESSMENT_UPDATED` mit `outcome: null` | 4 | Gültig |
| Lokaler Score −1, 101 oder String statt Zahl | 3 | Ungültig |
| Nicht unterstütztes Anbieterurteil | 1 | Ungültig |
| Sequenz 0 oder über dem sicheren Integer-Maximum | 2 | Ungültig |
| Query, Userinfo, JavaScript-Schema, Pfad oder Fragment im Domain-only-URL-Feld | 5 | Ungültig |
| Ungültiges Datum oder Ereignis-UUID | 2 | Ungültig |
| `DECISION` ohne Ergebnis / `CLICKED` mit endgültigem Ergebnis | 2 | Ungültig |
| Unerlaubtes zusätzliches Roh-URL-Feld | 1 | Ungültig |
| Policy erlaubt Abschalten des verpflichtenden Linkschutzes | 1 | Ungültig |
| Vollständige URL-Analyse bei strikter Provider-Privacy-Grenze | 1 | Ungültig |
| Wiederverwendbare Ausnahme / erlaubendes Malwareurteil | 2 | Ungültig |
| Offline-Queue-Alter über Entwurfsgrenze | 1 | Ungültig |
| Zusätzlicher Provider-Secret-Schlüssel | 1 | Ungültig |
| Fehlende erforderliche Capabilities / leere Gerätegruppe / Policy-Version 0 | 3 | Ungültig |
| **Gesamt** | **31** | **6 gültig, 25 ungültig** |

Positive Beispielprüfung ist in der [Vertragsübersicht](README.md) reproduzierbar dokumentiert. Die obigen Negativfälle lassen sich durch einzelne entsprechende Änderungen an Kopien der Beispielpayloads mit demselben Validator prüfen.

## Bewusst nicht durch diese Prüfung belegt

Signaturprüfung, OIDC-Anmeldung, Rollen-/Organisationsdurchsetzung, Zustellung, Object Locks, Backup-Löschung, Endpoint-Broker, API-Endpunkte, native Thunderbird-Funktionen, semantische Zeit-/Schwellenvergleiche und reale Betriebsziele werden erst in den jeweiligen Implementierungsaufgaben nachgewiesen. Ein formal gültiger Payload ist kein authentifizierter Nachweis. Die vorhandene Version 1.20.0 erhält durch diese Dokumente keine Enterprise-Fähigkeiten.
