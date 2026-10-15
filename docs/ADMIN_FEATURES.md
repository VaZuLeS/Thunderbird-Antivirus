# Unternehmensadministration — Linkprotokoll und Feature-Roadmap

## Verfügbar ab 1.20.0

In den Einstellungen oder im Nachrichten-Popup **„Linkprotokoll prüfen“** öffnen. Die Ansicht zeigt abgefangene HTTP(S)-Klicks mit Zeitstempel, vollständiger URL, lokaler Bewertung im Nachrichtenkontext, Anbieterurteil und Entscheidung. Filter: URL/Domain, geöffnet/abgebrochen/Öffnungsfehler/offen, Mindest-Score und Zeitraum. Pro Seite werden 50 Einträge angezeigt; Exporte enthalten **alle gefilterten Einträge**.

- **Geöffnet (`OPENED`)**: Thunderbird hat die URL erfolgreich an den Standardbrowser übergeben. Das beweist keinen tatsächlichen Besuch oder das erfolgreiche Laden der Webseite.
- **Abgebrochen (`ABORTED`)**: Abbrechen, Escape, veränderte Zieladresse oder ein gemeldetes Schließen des Nachrichtenkontexts. Der Grund ist separat gespeichert.
- **Öffnungsfehler (`OPEN_ERROR`)**: Die Browserübergabe scheiterte. Ein erneuter Versuch aktualisiert dieselbe Interaktion und erhöht `openAttempts`.
- **Offen (`PENDING`)**: Noch keine bestätigte Entscheidung, beispielsweise bei einem Client-Absturz. Aus offenen Einträgen wird kein Abbruch abgeleitet.
- **`score`**: lokale Heuristik (0–100) für den angeklickten Link zusammen mit Nachrichtenkontext. Kein numerischer Anbieter-Score und keine Sicherheitsgarantie. `null` bedeutet nicht verfügbar, niemals 0.
- **`scoreAtDecision`, `verdictAtDecision`, `providerAtDecision`**: Stand zum Entscheidungszeitpunkt. Später eingetroffene Ergebnisse ergänzen `score`/`verdict`/`checkedAt`, überschreiben aber nicht die Entscheidung. Gründe und maschinenlesbare Heuristikdetails bleiben exportierbar.
- **`id`/Profil-ID/Version**: zufällige Ereignis-ID, lokale pseudonyme Profil-ID und Erweiterungsversion ermöglichen die Zuordnung von Exporten. Die Profil-ID identifiziert weder automatisch ein Gerät noch einen Mitarbeiter.

Die Erfassung hängt vom aktivierten Linkschutz ab. Native „Im Browser öffnen“-Kontextmenüs und Browserbesuche außerhalb der abgefangenen Linkklicks werden nicht erfasst. Abmelden/Schließen/Client-Abstürze können offene Einträge hinterlassen. Rechte auf das Erweiterungsprofil ersetzen keine zentrale Admin-Authentifizierung.

## Darstellung historischer Befunde im Quellstand 1.23.0

Die Oberfläche kennzeichnet den **Befund bei der Entscheidung** ausdrücklich und lokalisiert bekannte Providerurteile in allen sechs Sprachen. Fehlen damaliger Befund oder damaliger Provider, erscheint „nicht verfügbar“; spätere Werte werden dafür nicht ersatzweise verwendet. Ein späterer Prüfbefund steht mit seinem Prüfzeitpunkt in den Details. „Ergebnis unbekannt“ ist kein unauffälliger Befund. JSON-/CSV-Exporte behalten die ursprünglichen technischen Werte. [Automatisierte Browser- und Regressionstests](UI_BROWSERPRUEFUNG.md).

## Export und Prüfung

JSON enthält das vollständige Evidenzschema und eine SHA-256-Prüfsumme über `JSON.stringify(payload)`. Nach dem Export prüfbar:

```sh
node scripts/verify-link-audit-export.js /path/to/thundy-link-audit.json
```

CSV verwendet feste englische Spaltennamen, UTC-Zeitstempel und entschärfte Tabellenzellen. Die Oberfläche bleibt in EN/DE/FR/ES/IT/PL verfügbar. JSON ist der vollständigere Nachweis. Die Prüfsumme erkennt geänderte Übertragungen, **beweist aber keine Echtheit**: Profilnutzer könnten Inhalt und Prüfsumme gemeinsam ändern.

Das Protokoll liegt ausschließlich im Thunderbird-Profil: höchstens 30 Tage, 2.000 Einträge und 2 MiB; ältere Einträge werden beim Erweiterungsstart, Zugriff und bei Änderungen entfernt. Es ist unabhängig vom Scan-Cache. „Cache leeren“ löscht es nicht; „Lokales Protokoll löschen“ erfordert einen eigenen Bestätigungsdialog. API-Schlüssel und vollständige Nachrichten werden nicht in das Linkprotokoll übernommen. Bewertungsgründe können Absender- oder Domainangaben enthalten. Vollständige URLs können trotzdem sensible Daten/Zugriffstoken enthalten. Es erfolgt kein automatischer Upload. Exporte nur an berechtigte Prüfer weitergeben.

Dies ist ein lokal prüfbares Protokoll mit Export, keine manipulationssichere zentrale Unternehmenslösung. Bei Speicherfehlern werden Fehler gemeldet; die Browseröffnung wird dadurch nicht zu einer garantierten Protokollierung. Produktive Auditpflichten benötigen eine administrativ verwaltete, zentrale Lösung mit definierter Ausfallstrategie.

## Vollständig ausgearbeitetes Umsetzungskonzept

Die sechs nächsten Unternehmenspunkte sind im [Enterprise-Umsetzungskonzept](ENTERPRISE_UMSETZUNGSKONZEPT.md) vollständig ausgearbeitet: Architektur, Datenfluss, Geräte-/Adminidentität, Richtlinien, Nachweisgrenzen, Rollen, Incident-Prozess, Datenprofile, 30 Arbeitspakete, Aufwand und Abnahme. [Prüfbare Entwurfsverträge](enterprise/README.md) ergänzen den Plan. Dies ist ein Umsetzungskonzept; die Enterprise-Funktionen sind weiterhin nicht implementiert.

## Priorisierte zusätzliche Features

| Priorität | Feature | Nutzen für Administratoren | Voraussetzung / konkrete Umsetzung |
|---|---|---|---|
| P1 | Zentrale Ereignissammlung und SIEM-Anbindung | Gefährliche Öffnungen über mehrere Profile finden; automatische Alarmierung | Unternehmens-Endpunkt, authentifizierte Geräte, TLS, persistente Warteschlange, Wiederholungen, idempotente Ereignis-IDs und bestätigte Übernahme. JSON/CEF/Syslog-Integration nach SIEM-Bedarf. |
| P1 | Verwaltete, gesperrte Richtlinien | Einheitliche Scan-Stufen, Anbieter, Schutzschwellen und Listen | `storage.managed`/MDM-Verteilung; Adminwerte überschreiben lokale Einstellungen; Versions- und Änderungsnachweise. Speichern von Anbieter-Schlüsseln auf Clients möglichst durch Unternehmens-Gateway ersetzen. |
| P1 | Manipulationsschutz und Aufbewahrungsregeln | Entscheidungen auch nach Client-Löschung nachvollziehen | Server-Empfangszeit, authentifizierte Herkunft, signierte Ereignisse und unveränderbare serverseitige Ablage; definierte Löschfristen. SHA-256 eines lokalen Exports reicht dafür nicht. |
| P1 | Sperren und dokumentierte Ausnahmefreigaben | Risikoreiche Links nicht frei übersteuerbar machen | Admin-Schwellen nach lokalem Score und Anbieterurteil, definierter Umgang mit unbekannten Ergebnissen; Begründung, zeitlich begrenzte Ausnahme und Freigabe durch zuständige Rollen. |
| P2 | SSO, Rollen und getrennte Zuständigkeiten | Nur berechtigte Personen sehen vollständige URLs oder ändern Richtlinien | Unternehmens-SSO, Rollen für Auswertung, Incident Response und Richtlinienverwaltung; Zugriff selbst protokollieren. |
| P2 | Sicherheitsdashboard und Incident-Workflow | Geöffnete Warnlinks priorisieren und nachverfolgen | Öffnungen trotz Warnung, Domain-Häufungen, zeitliche Trends; Ticketanlage und Status, Verantwortliche, Nachprüfung. Kein automatisches Mitarbeiter-Ranking. |
| P2 | Gesundheits- und Versionsübersicht | Defekten Schutz, veraltete Clients und fehlende Prüfungen früh erkennen | Heartbeats, Erweiterungs-/Thunderbird-Version, Richtlinienstand, Anbieter-/Berechtigungsfehler, Queue-/Speicherstatus. Technische Verfügbarkeit vom Risiko-Score trennen. |
| P2 | Datenschutzprofile für Unternehmen | Nur erforderliche Daten an Prüfer übermitteln | Rollenabhängige URL-Maskierung, Token-Redaktion, Datenminimierung, Löschkonzept und Berechtigungen für vollständige Evidenz. Anforderungen mit Datenschutzverantwortlichen und Arbeitnehmervertretung abstimmen. |
| P3 | Freigegebene Domains und zeitlich begrenzte Ausnahmen | Fehlalarme nachvollziehbar reduzieren | Listen zentral verteilen; Ausnahmegrund, Freigeber und Ablaufdatum protokollieren; Anbieterurteil durch Ausnahmen nicht als „sauber“ umdeuten. |
| P3 | Sichere Meldung verdächtiger Nachrichten | Mitarbeiter können Fälle an das Security-Team melden | Explizite Meldung, minimierte Anhang-/URL-Weitergabe, Unternehmens-Tickets und Statusrückmeldung. |

Empfohlene nächste Ausbaustufe: **zentrale Sammlung + gesperrte Richtlinien + Risikowarnungs-Overrides mit Begründung**. Vor Umsetzung sind Endpunkt, Authentifizierung, Datenumfang, Rollen und Aufbewahrung festzulegen. Diese zusätzlichen Features sind Vorschläge, keine bereits implementierten Funktionen.
