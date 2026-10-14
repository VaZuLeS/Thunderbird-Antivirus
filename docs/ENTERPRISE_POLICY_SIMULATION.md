# Signierter Policy-Diff und konservative Offline-Simulation

Stand: 14. Oktober 2026. N08 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ist lokal implementiert. Administratoren können zwei signierte Policies vergleichen und ihre modellierten Öffnungsregeln auf verifizierte damalige Assessment-Snapshots anwenden. Es gibt keine Policyaktivierung, keinen Rollout, keine Browseröffnung und keine SEALED-Freigabe.

## Was der Bericht beantwortet

Eine Entscheidung wurde mit lokalem Score 60 protokolliert. In der Baseline ist eine Warnung mit Begründung vorgesehen; eine neue Policy senkt die Blockschwelle auf 55. Der Report zeigt für dieselbe damalige Bewertung „Begründung erforderlich“ gegenüber „Blockieren“. Eine spätere Bewertung mit Score 1 überschreibt diese Grundlage nicht.

Der Diff umfasst alle Policyfelder, einschließlich Datenschutz, Retention, Gruppen und Mindestversion. Die **Auswirkungssimulation umfasst ausschließlich das bestehende Öffnungsentscheidungsmodell**. Änderungen an Providerzugriffen, Retention, Queuegrenzen, Heartbeats oder Rollout werden als Diff angezeigt, ihre tatsächliche Wirkung aber nicht simuliert. Policies mit semantisch ungültigen Werten werden vor dem Vergleich abgewiesen.

Der JSON-Report enthält Policysignatur-Envelopehashes, einzelne Feldänderungen, Quellfingerprint/Quittungskopf, Szenarioannahmen, aggregierte Veränderungen und Einzelentscheidungen mit Domain-URL, damaligem Assessment, Quittungs-/Eventhash und protokolliertem Ergebnis. Er ist eine **unsignierte Ableitung** aus geprüften signierten Quelldaten. Zur unabhängigen Wiederholung die beiden Envelopes, Ereignisexport und Trustkonfiguration erhalten.

## Prüfungen und Szenarien

Vor Ableitung werden geprüft:

- Beide Ed25519-Policysignaturen, Organisation/Policy-ID/Gruppen, Zeitfenster, Schlüsselgültigkeit/Widerruf, vertrauenswürdiger Versionsboden, Clientversion und Capabilities.
- Die Kandidatenversion muss höher als die Baselineversion sein. Der Versionsboden wird weder gesenkt noch fortgeschrieben. Ein bereits überholter Baselinestand wird nicht stillschweigend wieder zugelassen.
- Server- und Gerätesignaturen, vollständige Quittungskette, Sequenzen und Zustandsübergänge des Ereignisexports; optional ein unabhängig bekannter Quittungskopf.
- Die Organisation aller Datensätze muss zur Policy gehören. Ausgewertet werden ausschließlich `DECISION`-Ereignisse mit Baseline-Policy-ID und Baselineversion. Andere Versionen werden als `skippedDecisions` gezählt; Assessments ohne Entscheidung werden nicht ausgewertet.

Die Policies werden zur angegebenen **Simulationszeit** geprüft (CLI: aktuelle Zeit). Die Bewertungen stammen dagegen aus den damaligen Entscheidungen. Dies ist keine historische Rekonstruktion von Gruppenmitgliedschaft, Infrastrukturzustand oder tatsächlicher Policydurchsetzung. Die Gerätegruppen sind nicht im Ereignisvertrag enthalten; `modeledScope` nennt den vom Betreiber bereitgestellten Gruppenkontext und die Clientversion. Ein erfolgreich protokolliertes `OPENED` beweist nicht, dass diese Modellregeln damals durchgesetzt wurden.

| Szenario | Modellannahme |
|---|---|
| `healthy_unacknowledged` (Standard) | Broker und dauerhafte Outbox hypothetisch verfügbar; kein bestätigter SEALED-Intent, keine Begründung und keine zusätzliche lokale Blocklist |
| `audit_unavailable` | Broker/Outbox nicht verfügbar; das Entscheidungsmodell blockiert wegen fehlender Auditvoraussetzung |

Diese Annahmen sind keine gemessenen Betriebszustände. Ein niedriger Score setzt einen bösartigen Providerbefund nicht außer Kraft; unbekannte Scores bleiben unbekannt. Eine Policy mit `requireSealedIntent` kann ohne Begründungs-/Freigabegate auf `wait_for_receipt` kommen, aber nie durch ein erfundenes SEALED-Signal freigeschaltet werden. `queueAllowed` kann `allow_intent` modellieren; auch das autorisiert keine echte Öffnung.

Einordnung: `block` gilt als restriktiver als `approval_required`, anschließend die beiden nicht untereinander geordneten Gates `justification_required`/`wait_for_receipt`, zuletzt `allow_intent`. Wechsel zwischen gleichrangigen Gates oder anderen Begründungen zählt als `different_gate`; identische Aktion und Begründung als `unchanged`. Dies ist eine vereinfachte Modellordnung, keine allgemeine Sicherheitsbewertung der gesamten Policy.

## Public-Key-Konfiguration

```json
{
  "schemaVersion": 1,
  "organizationId": "00000000-0000-4000-8000-000000000001",
  "policyId": "00000000-0000-4000-8000-000000000002",
  "groupIds": ["pilot"],
  "capabilities": ["event-v2", "policy-v1", "broker-v1", "sealed-receipts"],
  "clientVersion": "1.22.0",
  "highestVersion": 3,
  "policyKeys": [
    {
      "keyId": "issuer-1",
      "publicKeyFile": "/srv/trust/policy-public.pem",
      "notBefore": "2026-10-14T00:00:00.000Z",
      "notAfter": "2026-10-15T00:00:00.000Z",
      "revokedAt": null
    }
  ],
  "serverKeyId": "server-1",
  "serverPublicKeyFile": "/srv/trust/server-public.pem",
  "registryFile": "/srv/trust/registry.json"
}
```

Die Beispiele enthalten Platzhalterwerte und ein begrenztes Zeitfenster; tatsächliche Trustwerte bereitstellen. Alle Felder erforderlich, keine Zusatzfelder. Öffentliche PEMs und absolute Pfade; Registry genau `{"registrations": [...]}`. Zeitangaben in der Schlüsselkonfiguration sind kanonische UTC-ISO-Werte mit Millisekunden. Höchstens 1.000 Policykeys. Private Schlüssel-/Credentialfelder werden abgewiesen. Die CLI signiert keine Kandidaten: Entwürfe müssen über einen gesonderten vertrauenswürdigen Prozess signiert werden.

## Aufruf und API

```sh
npm run enterprise:policy-simulate -- \
  --baseline /srv/review/baseline-envelope.json \
  --candidate /srv/review/candidate-envelope.json \
  --export /srv/review/events.json \
  --config /srv/trust/simulation.json \
  --expected-head EXTERN_BEKANNTER_QUITTUNGSHASH \
  --scenario healthy_unacknowledged \
  --out /srv/review/policy-impact.json
```

Ohne Kopf-Pin bleibt `headPinned: false`; gültiges Abschneiden des Exports ist dann nicht erkennbar. Dateien werden begrenzt und ohne Symlinks gelesen: Policies/Config jeweils 64 KiB, Registry 1 MiB, Ereignisexport 16 MiB. Ausgabe als neue private Datei mit 0600, keine Überschreibung. Kein Netzwerkzugriff, keine Writer-Locks und keine Veränderung der Quelldateien. Zeitfenster-/Signatur-/Scopefehler brechen den gesamten Aufruf ab.

```js
const { simulate } = require('./enterprise/policy_simulation.cjs');
const report = simulate({
  baseline, candidate, data: eventExport, policyContext, eventTrust,
  now: Date.now(), scenario: 'healthy_unacknowledged',
});
```

`policyContext` entspricht dem bestehenden Policyverifier mit `trustedKeys: Map` aus öffentlichen Ed25519-KeyObjects. `eventTrust` enthält öffentliche Server-/Geräteschlüssel, Registrierungen, Server-ID und optional `expectedHead`. Kontext und Inputs werden nicht fortgeschrieben. Der API-Aufrufer muss Dateilesen/Requests ebenfalls begrenzen. Eine explizit historische API-Simulationszeit wird im Report ausgewiesen und ist keine Möglichkeit, eine abgelaufene Policy zu aktivieren.

## Datenschutz und offene Integration

Reports enthalten Domains, Eventreferenzen, Assessmentprovenienz und Gruppenkontext; sie können personenbezogen sein und benötigen berechtigte Leser sowie freigegebene Aufbewahrung. Die Daten werden nicht an Provider oder Ticketsysteme übertragen. Es entsteht keine neue Benutzeroberfläche; der JSON-Vertrag nutzt Codes. Ein späterer Policyeditor muss die sechs Sprachen unterstützen.

Noch offen: rollenberechtigter Editor, fachliche Freigabe, signierter Policykanal, produktive Simulation von Infrastruktur-/Provider-/Retentionfolgen, reale Gruppen-/Gerätezuordnung, Rollout/Abbruch und Unternehmensabnahme. P03/P01 bleiben insgesamt Vorarbeit. N06-Blocker und Extension-Release 1.22.0 bleiben unverändert.
