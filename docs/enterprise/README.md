# Enterprise-Datenverträge — Entwurf

Diese Dateien ergänzen das [vollständige Umsetzungskonzept](../ENTERPRISE_UMSETZUNGSKONZEPT.md). Sie sind **Entwurfspayloads**, kein Server, keine freigegebene Implementierung und keine aktiven oder bereits signierten Policies. UUIDs, Gruppen und Zeitwerte sind synthetische Beispiele. `minimumExtensionVersion: 1.20.0` ist nur ein syntaktischer Beispielwert, keine Behauptung, dass 1.20.0 diese Enterprise-Policy unterstützt. Bei Implementierung wird die tatsächliche erste Enterprise-Version eingesetzt und zusätzlich auf Fähigkeiten geprüft.

| Datei | Inhalt |
|---|---|
| [policy.schema.json](policy.schema.json) | Striktes JSON-Schema für Policy-Payload V1 mit Grenzen und Provider-Privacy-Regel |
| [policy.example.json](policy.example.json) | Beispiel: Pilotgruppe, strikte Analysegrenze, Domain-only, bestätigungspflichtiger Öffnungswunsch |
| [event.schema.json](event.schema.json) | JSON-Schema für Domain-only-Ereignisse V2; offene und endgültige Entscheidungen unterscheidbar |
| [event.example.json](event.example.json) | Expliziter Abbruch mit unbekanntem Score/Providerurteil; kein fingierter Score 0 |

Weitere Datenprofile, Heartbeat, Quittungen, Rollen-, Incident- und Exportjobverträge werden in den aufgeführten Implementierungsaufgaben ausgeführt. Der Domain-only-Vertrag darf eine vollständige URL nicht entgegennehmen. Ein späteres Detailprofil benötigt ein separat versioniertes Schema und eigene Freigabe. Event-V2 und Policy-V1 haben unabhängige Versionen und ersetzen nicht das vorhandene lokale Exportformat V1.

## Zusätzlich verpflichtende semantische Prüfung

JSON Schema allein prüft keine Kryptografie, Gerätebindung oder Policyzuständigkeit. Die Implementierung muss zusätzlich prüfen:

1. Signatur über JCS-kanonisierten Payload, registrierter Schlüssel, Vertrauenswurzel und Widerruf; Signatur-Envelope separat vom hier beschriebenen Payload.
2. Organisation/Gerät/Stream aus Authentifizierung; fremde Zuordnung nicht durch beliebige Bodywerte überschreiben. Scope und Gruppe aus geprüften Registrierungen.
3. `issuedAt < expiresAt`, erlaubte Zeitabweichung, tatsächlicher Ablauf, monotone Policy-Version und Clientfähigkeiten.
4. `warnScore < blockScore`; `heartbeatSeconds < lateAfterSeconds < unknownAfterSeconds`; Privacy-Tier begrenzt externe Provideraktionen zusätzlich zu tatsächlicher Zustimmung/Hostberechtigung.
5. Sequenz, Interaktionszustand, Versuchszähler und idempotente `eventId`; gegensätzliche terminale Entscheidungen verhindern. Nach `OPEN_ERROR` Wiederholung erlauben, nach `OPENED`/`ABORTED`/`BLOCKED` nicht ohne neues zulässiges Verfahren.
6. `DECISION/OPENED` nur nach gemeldetem Handoff; `OPEN_INTENT` ist keine Öffnung. Policyblock/Abbruch/Browserverweigerung müssen passenden Grund tragen. Entscheidungs-Snapshot muss der damaligen verfügbaren Bewertung entsprechen.
7. Domainnormalisierung und echte URL-Redaktion, erlaubte Ports, kein Userinfo/Query/Fragment/Pfad; Rohpayload darf keine freien Zusatzfelder oder personenbezogenen Reason-Parameter enthalten. Regex ersetzt keine URL-Verarbeitung.
8. `assessment.observedAt` und Kenntnisstand dürfen keine unbegründete zukünftige Verfügbarkeit behaupten; Unknown bleibt `null`/`UNKNOWN`. Code-/Modellversion muss vom Server unterstützt oder explizit quarantänisiert werden.
9. Limits, Rollen, Retention, Auditpflicht und Consent sind Laufzeitregeln. Schema-`default` würde nur eine Annotation darstellen, keinen gesetzten Wert.

## Prüfbarkeit der Entwürfe

[Prüfbericht mit Fallmatrix und Grenzen](VALIDIERUNG.md).

Die Schemas wurden mit JSON Schema Draft 2020-12 einschließlich Formatprüfung auf Wohlgeformtheit geprüft. Beide Beispiele wurden validiert; negative Varianten mit unerlaubten Zusatzfeldern, falschen Scores/Enums, URL-Userinfo/Query und unzulässiger Voll-URL-Analyse wurden zurückgewiesen. Das ist eine Vertragsprüfung, kein Implementierungs-, SSO-, Signatur- oder Thunderbird-Nachweis.

Mit installiertem Python-Paket `jsonschema[format]` reproduzierbar; die Format-Erweiterungen sind für Datum-/UUID-/URI-Prüfungen erforderlich:

```sh
python - <<'PY'
import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker
root = Path('docs/enterprise')
for name in ('policy', 'event'):
    schema = json.loads((root / f'{name}.schema.json').read_text())
    example = json.loads((root / f'{name}.example.json').read_text())
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(example)
    print(f'{name}: schema and example valid')
PY
```
