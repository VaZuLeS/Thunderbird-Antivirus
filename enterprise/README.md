# Enterprise-Vertragsprüfung — vorbereitende Implementierung

Diese Node-only-Bibliothek setzt einen unabhängig prüfbaren Teil des [Enterprise-Konzepts](../docs/ENTERPRISE_UMSETZUNGSKONZEPT.md) um. Sie ist **nicht in die Thunderbird-Extension eingebunden**, nicht im XPI enthalten und kein Server oder Endpoint-Broker.

Implementiert:

- JSON-Schema-Draft-2020-12 mit Datums-/URI-/UUID-Formaten und semantischen Zeit-, Schwellen- und Provenienzprüfungen.
- JCS-Kanonisierung mit einer Bibliothek und echte Ed25519-Prüfung signierter Policy-Payloads.
- Organisations-/Policy-/Gruppenscope, vertrauenswürdige Schlüssel, Widerruf, Laufzeit, Versionsrückschritt und benötigte Clientfähigkeiten.
- Unveränderliche geprüfte Payloads; aktuelle Sperr-/Scope-/Versionsänderungen werden bei erneuter Entscheidung berücksichtigt.
- Öffnungsentscheidung mit konservativer Risiko-Priorität, Unknown-Regel, Begründung und bestätigungspflichtigem Öffnungswunsch.
- Domain-only-URL-Redaktion ohne Userinfo, Pfad, Query oder Fragment; IDN-/Portnormalisierung durch den URL-Parser.
- Ereignisstruktur/-scope, korrekte Gründe und Versuchszähler, unbekannte Scores und fehlende Anbieterprovenienz.

Prüfen: `npm ci` und `node --test enterprise/test/contracts.test.js`; die Suite läuft auch in `npm test`/CI. Abhängigkeiten sind deklarierte Entwicklungsabhängigkeiten. `canonicalize` 2.1.0 wurde für die bestehende Node-20-Kompatibilität des Repositories gewählt; die aktuelle Hauptversion 5 benötigt Node ≥ 22. Die spätere Enterprise-Service-Abhängigkeitsfreigabe ist Teil von F04.

## Grenzen und noch fehlende Integration

Die Bibliothek nimmt den bereits authentifizierten Kontext von einem zukünftigen vertrauenswürdigen Broker/Backend entgegen. Eine beliebige vom UI gelieferte Schlüsselregistry oder `intentSealed: true` ist **keine** gültige Unternehmensauthentifizierung bzw. Empfangsquittung. Enrollment, geschützter Schlüssel-/Versionsspeicher, serverseitige Quittungsprüfung, Event-State-Machine und persistente Sequenzen sind noch zu implementieren.

Es gibt noch keine Geräteverteilung, Outbox, Netzwerkübermittlung, SSO, Rollenprüfung, Object Locks, Incidents, Vault, Server-Retention oder OS-/Thunderbird-Abnahme. Die Policy-ID-/Gruppen-/Schlüsselzuordnung muss aus dem späteren Unternehmenskanal stammen. `allow_intent` erlaubt nur einen geprüften Öffnungswunsch im Modell; es erzeugt kein `OPENED`-Ereignis und öffnet keinen Browser.

**Kein Arbeitspaket gilt durch diese Vorbereitung insgesamt als abgeschlossen.** Vollständige Umsetzung/Abnahme bleibt an die Unternehmensentscheidungen und Freigaben aus F01–F04 gebunden. Der [Umsetzungsstand mit Blockern](../docs/ENTERPRISE_UMSETZUNGSSTAND.md) führt alle 30 Pakete auf.
