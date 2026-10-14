# Versionierte Incidentregeln auf geprüften Entscheidungen

Stand: 14. Oktober 2026. N03 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ist als lokaler Node-Baustein implementiert. Er leitet prüfbare Incidentkandidaten aus einem vollständigen signierten STAGED-Ereignisexport ab. Er eröffnet keine Tickets und aktiviert keinen Unternehmensdienst oder Extension-Hook.

## Für Administratoren

Ein Link wurde mit Score 80 geöffnet und später mit Score 1 neu bewertet: Der Incident bleibt mit **Score 80 bei der Entscheidung** verbunden. Eine spätere Bewertung erzeugt keinen rückwirkenden Öffnungsfall. Abbruch, Richtlinienblockierung und Browserfehler sind eigene Entscheidungsarten; ein fehlender Score wird ausdrücklich als unbekannt behandelt, niemals als 0.

Jeder Kandidat enthält Organisation, Gerät, Interaktion, Versuch, Entscheidungszeit, Domain-URL, Policyversion, vollständigen damaligen Assessment-Snapshot sowie Event-/Quittungshashes. Der Report nennt Regelsetversion und Inhaltshash, geprüften Quittungskopf und Public-Key-Fingerprint. Damit kann ein Admin das Ergebnis gegen den ursprünglichen Export und dieselben Regeln neu berechnen. Der erzeugte JSON-Report selbst ist **nicht signiert**; Signaturprüfung erfolgt auf den Quelldaten.

## Offline-Aufruf ohne privaten Schlüssel

Voraussetzung: exportierte Ereignisse aus `enterprise:local export`, öffentliches Server-PEM, Registry mit ausschließlich öffentlichen Geräteschlüsseln und ein vom Betreiber bereitgestelltes Regelset. Die Registry-Datei enthält genau `{"registrations": [...]}`. Private PEMs werden abgewiesen.

```sh
npm run enterprise:incidents -- \
  --export /srv/review/events.json \
  --rules /srv/review/rules.json \
  --server-public-key /srv/trust/server-public.pem \
  --server-key-id server-1 \
  --registry /srv/trust/registry.json \
  --expected-head EXTERN_BEKANNTER_64STELLIGER_SHA256 \
  --out /srv/review/incidents.json
```

`--expected-head` ist optional, muss aber für Schutz gegen gültiges Abschneiden aus einer unabhängig bekannten Quelle kommen. Ohne Pin wird `headPinned: false` ausgewiesen; Signaturen allein beweisen nicht die Vollständigkeit des Exports. Es handelt sich nicht um eine unabhängige Witness-/SEALED-Abnahme. Der CLI liest begrenzte reguläre Dateien ohne Symlinks und prüft Änderungen während des Lesens. Er verändert weder Journal noch Writer-Lock. Neue Ausgabe wird mit Modus 0600 erstellt; bestehende Dateien werden nicht überschrieben. Kein Netzwerkzugriff; stdout meldet nur den Abschluss, Fehler enthalten nur Codes.

## Regelset und Bedeutung

```json
{
  "schemaVersion": 1,
  "organizationId": "11111111-1111-4111-8111-111111111111",
  "ruleSetId": "enterprise-risk",
  "version": 1,
  "rules": [
    {
      "id": "high-score-opened",
      "outcomes": ["OPENED"],
      "minScore": 70,
      "matchUnknownScore": false,
      "providerVerdicts": [],
      "severity": "high"
    }
  ]
}
```

Alle Felder sind erforderlich, zusätzliche Felder werden abgewiesen. Maximal 100 Regeln mit eindeutigen IDs. Outcomes: `OPENED`, `ABORTED`, `BLOCKED`, `OPEN_ERROR`. Schweregrade: `low`, `medium`, `high`, `critical`.

Eine Regel trifft, wenn **alle** Bedingungen erfüllt sind:

- Die Entscheidungsart ist in `outcomes` enthalten.
- Ein bekannter Score ist mindestens `minScore` (0–100, einschließlich Grenze); ein unbekannter Score trifft ausschließlich bei `matchUnknownScore: true`.
- `providerVerdicts` ist leer oder enthält den damaligen Providerbefund. Erlaubt sind die Befunde des bestehenden Ereignisschemas.

Die Schweregrade steuern nur die Einordnung im Report, keine Benachrichtigung. Regeln sind Betreiberkonfiguration, keine signierten Policies. Verwaltung, Freigabe und Rollbackschutz der Regelsetversionen über SSO bleiben offen. Der Betreiber muss eine Version an einen unveränderlichen Inhaltshash binden; veränderter Inhalt unter derselben Version bleibt durch einen anderen Hash sichtbar und erzeugt andere IDs.

## Wiederverarbeitung und API

```js
const { deriveIncidents } = require('./enterprise/incidents.cjs');
const report = deriveIncidents(eventExport, ruleSet, {
  serverPublicKey,        // Ed25519 Public KeyObject oder öffentliches PEM
  serverKeyId: 'server-1',
  registrations,         // öffentliche Gerätezulassungen
  expectedHead,          // optional, unabhängig bekannter Quittungshash
});
```

Vor Ableitung werden Server- und Gerätesignaturen, Organisationsbindung, Sequenzen, Zustandsübergänge und die vollständige Quittungskette geprüft. Ein unzulässiger Datensatz verwirft den gesamten Aufruf; kein Teilreport wird zurückgegeben. Historische, gültig signierte Daten bleiben auch nach Gerätewiderruf überprüfbar; dies autorisiert keine neue Aufnahme oder Öffnung.

Die Incident-ID bindet Serverfingerprint, Organisation, Entscheidungsereignis, signierten Eventinhalt, Regelsethash und Regel-ID. Wiederholung mit denselben Eingaben liefert dieselben IDs; spätere Assessment-Updates verändern diese IDs nicht. Die Reihenfolge von Regeln/Befundlisten ändert ihren Inhaltshash nicht. Neue Versionen oder geänderte Regeln erzeugen eigene Ableitungen. Wiederholte Öffnungsversuche werden einzeln ausgewertet. Ein künftiger Speicher muss die IDs als eindeutige Schlüssel verwenden; die Bibliothek selbst führt keine persistente Incidentdatenbank.

Grenzen: 16 MiB Ereignisexport, 64 KiB CLI-Regelset, 1 MiB CLI-Registry, 100 Regeln und 10.000 Treffer je Aufruf. Kapazitätsüberschreitung bricht ab; keine stille Kürzung. Die API arbeitet auf bereits eingelesenen Daten, daher muss ihr Aufrufer auch Dateilesen/Requestgröße begrenzen.

## Sprachen, Datenschutz und verbleibende Arbeit

Der JSON-Vertrag enthält sprachneutrale Codes und Herkunftsdaten. Für eine künftige Oberfläche müssen diese in Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch dargestellt werden; hier entsteht keine neue einsprachige Benutzeroberfläche. Die bestehende sechssprachige Admin-Review bleibt erhalten. URLs sind ausschließlich kanonische Domain-URLs; Nachrichtentext, Pfade, Queryparameter und Zugangsdaten sind nicht Bestandteil der Ereignisverträge.

Offen bleiben Incidentlebenszyklus (Zuweisung, Bestätigung, Abschluss), Rollen, persistente Fälle, sechs Sprachen im künftigen Incidentportal, Flottenkorrelation, Tickettransport und produktive Abnahme. STAGED bleibt lokal gespeichert; der Report behauptet keine gegen Änderung und Löschung geschützte SEALED-Ablage.
