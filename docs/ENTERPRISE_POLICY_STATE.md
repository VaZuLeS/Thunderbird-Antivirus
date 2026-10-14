# Dauerhafter Policy-Versions- und Widerrufsstand

Stand: 14. Oktober 2026. `enterprise/policy_state.cjs` ergänzt den vorbereitenden Node-Vertragskern um einen dauerhaften, signierten Stand. Er bleibt außerhalb des XPI und wird noch nicht von der Thunderbird-Linköffnung verwendet.

## Verhalten

- Eine Policy wird mit der bestehenden JCS/Ed25519-, Scope-, Gruppen-, Zeit-, Clientversions- und Capabilityprüfung validiert.
- Angenommene Policyversionen steigen streng. Dieselbe unveränderte aktuelle Envelope ist idempotent; anderer Inhalt oder anderer Signer bei gleicher Version wird abgewiesen. Niedrigere Versionen werden auch nach Neustart abgewiesen.
- Ein optionaler, vertrauenswürdig vorgegebener `context.highestVersion` bildet bereits im neuen Journal den Mindeststand. Dieser Bootstrapwert ist in der Trustbindung enthalten und muss bei Recovery identisch vorgegeben werden.
- Schlüsselwiderrufe werden dauerhaft signiert protokolliert und wirken ab ihrem gespeicherten Zeitpunkt. Wiederholung ist idempotent; eine Aufhebung ist nicht implementiert.
- Annahme bzw. Widerruf werden erst nach vollständigem Write und `fsync` bestätigt. Bei Schreibfehlern sperrt sich der Prozess für weitere Annahmen und Entscheidungen bis zur geprüften Wiederaufnahme.
- `evaluate` verifiziert die zuletzt angenommene Policy erneut mit dem gespeicherten Mindeststand, aktuellen Widerrufen und der Uhr des Stores. Eine vom Aufrufer im Entscheidungsobjekt angegebene Zeit ersetzt diese Uhr nicht. Zurücklaufende Uhr wird abgewiesen.
- Recovery prüft Policies zu ihrem historischen Annahmezeitpunkt. Eine inzwischen abgelaufene Policy verliert deshalb nicht den gespeicherten Versionsstand; sie darf aber keine aktuelle Entscheidung autorisieren.

## Bibliotheksanbindung

```js
const { PolicyState } = require('./enterprise/policy_state.cjs');
const store = new PolicyState({
  directory: '/private/policy-state',
  signerKeyId: 'policy-state-1',
  signerPrivateKey: protectedStateSigningKey,
  context: authenticatedPolicyContext,
  expectedHead: separatelyKnownPolicyHead
});
try {
  store.accept(signedPolicyEnvelope);
  const decision = store.evaluate(assessment, verifiedBrokerAndReceiptState);
  // This is the existing decision model, not a browser-opening API.
} finally {
  store.close();
}
```

`context` besitzt Organisations-/Policy-ID, Gruppen, Clientversion, Capabilities und eine `trustedKeys`-Map mit öffentlichen Ed25519-Issuerschlüsseln, Organisationsbindung, `notBefore`, `notAfter` und optionalem `revokedAt`. Er stammt aus dem späteren authentifizierten Betreiber-/Brokerkanal. Keine UI-Angabe darf diesen Kontext, den State-Signierschlüssel oder eine angebliche SEALED-Quittung ersetzen.

`revoke(keyId)` ist eine privilegierte Betreiberoperation im vertrauenswürdigen Prozess. Ihre Unternehmensrollenprüfung und Verteilung sind weiterhin offen. Der State-Signierschlüssel ist getrennt von den Policy-Issuerschlüsseln zu verwalten. `status()` zeigt Mindestversion, Kettenkopf, Aktionszahl, Loggröße und aktuell widerrufene Key-IDs, ohne Schlüsselwerte oder Policyinhalte auszugeben.

## Ablage und Recovery

Private POSIX-Verzeichnisse 0700 und Dateien 0600, Eigentümer-/Symlinkprüfung, exklusiver `policy-state.lock`. Standardgrenzen: 4 MiB und 1.000 behaltene Aktionen, ohne automatische Kürzung. Limits sind konfigurierbar innerhalb der Bibliotheksgrenzen. Kapazitätsmangel aktiviert keine neue Policy und erhält den bisherigen Stand.

Ein vollständig geschriebenes, aber nicht bestätigtes Ereignis kann nach einem I/O-Fehler beim Recovery wieder vorhanden sein; vor Wiederaufnahme werden Signaturen und Folge geprüft und die Datei synchronisiert. Teilenden und beschädigte Datensätze werden nicht stillschweigend entfernt. Nach Prozessabbruch den Lock erst nach bestätigtem Ende des bisherigen Writers durch einen zuständigen Betreiber entfernen.

Ein extern bekannter `expectedHead` schützt den bekannten Snapshot gegen gültiges Abschneiden. Ohne ihn erkennt die interne Kette einen entfernten gültigen Suffix nicht selbst. Der lokale Dateibesitzer kann weiterhin Dateien verändern oder entfernen. Es gibt keine WORM-/SEALED-Garantie. Auch eine korrekte lokale Uhr ist noch kein unabhängig attestierter Zeitnachweis.

Änderungen an Roots, Gültigkeitsfenstern, Gruppen, Capabilities, Clientversion oder Bootstrapfloor erfordern eine kontrollierte Migration; sie werden nicht automatisch als legitimer Neustart akzeptiert. Enrollment, Rotation, geschützte OS-Schlüsselablage, produktiver Policykanal und Rollenprüfung bleiben offen.

Zehn neue Tests prüfen Neustart/Versionsfloor, Duplikate und Versionswiederverwendung, Widerruf, historische Ablaufzeiten, Scope/Signatur, fehlgeschlagenes `fsync`, Journalmanipulation, Trustwechsel, Kopfbindung, Kapazität, exklusive Writer und Uhr-Rollback. [Ausführungsplan](ENTERPRISE_NAECHSTE_SCHRITTE.md).
