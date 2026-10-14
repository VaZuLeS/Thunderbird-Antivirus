# Enterprise-Vertragsprüfung — vorbereitende Implementierung

Dieser Node-only-Entwicklungsbereich setzt einen unabhängig prüfbaren Teil des [Enterprise-Konzepts](../docs/ENTERPRISE_UMSETZUNGSKONZEPT.md) um. Sie ist **nicht in die Thunderbird-Extension eingebunden**, nicht im XPI enthalten. Neben dem Vertragskern gibt es jetzt einen separat gestarteten lokalen Entwicklungsservice, weiterhin keinen Endpoint-Broker.

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

Die Bibliothek nimmt den bereits authentifizierten Kontext von einem zukünftigen vertrauenswürdigen Broker/Backend entgegen. Eine beliebige vom UI gelieferte Schlüsselregistry oder `intentSealed: true` ist **keine** gültige Unternehmensauthentifizierung bzw. Empfangsquittung. Lokale Quittungsprüfung, Event-State-Machine und persistente Sequenzen sind inzwischen als separate Entwicklungsbausteine implementiert. Enrollment und geschützter Unternehmens-Schlüssel-/Versionsspeicher bleiben offen.

Eine lokale Outbox, Loopback-Zustellung und optionale Storage-Prüfadapter sind inzwischen implementiert. Geräteverteilung, produktive Netzwerkübermittlung, SSO, Rollenprüfung, produktive Object Locks, produktiver Incidentlebenszyklus, Vault, Server-Retention und OS-/Thunderbird-Abnahme bleiben offen. Die Policy-ID-/Gruppen-/Schlüsselzuordnung muss aus dem späteren Unternehmenskanal stammen. `allow_intent` erlaubt nur einen geprüften Öffnungswunsch im Modell; es erzeugt kein `OPENED`-Ereignis und öffnet keinen Browser.

**Kein Arbeitspaket gilt durch diese Vorbereitung insgesamt als abgeschlossen.** Vollständige Umsetzung/Abnahme bleibt an die Unternehmensentscheidungen und Freigaben aus F01–F04 gebunden. Der [Umsetzungsstand mit Blockern](../docs/ENTERPRISE_UMSETZUNGSSTAND.md) führt alle 30 Pakete auf.

## Optionale Systemprofile

Der separate [Profilassistent](../docs/ENTERPRISE_SYSTEMPROFILE.md) ist ab 1.21.0 in der Extension enthalten. Die gemeinsam verwendete `enterprise_profiles.js` erzeugt ausschließlich deaktivierte Konfigurationsentwürfe. Die Node-CLI `npm run enterprise:profile -- --hosting azure --sso entra-id` arbeitet ohne Netzwerk; ihre Implementierung bleibt außerhalb des XPI. Auswahl und Export implementieren noch keine der externen Integrationen.

## Lokaler Aufnahme-Service und Offline-Adminansicht

`npm run enterprise:local -- init`, dann `demo`, `review --lang de --out /tmp/review.html` oder `serve --port 8766`. Details zu signierten Gerätenachweisen, dauerhafter Aufnahme, STAGED-Quittungen, Grenzen und Recovery im [Service-Handbuch](../docs/ENTERPRISE_LOKALER_SERVICE.md). Der Service bindet ausschließlich Loopback. Er implementiert weder SEALED/Object Lock noch SSO/Unternehmensrollen oder die Extension-Anbindung. Die sechs Sprachansichten sind Offline-Exports mit OS-basierter Zugriffskontrolle.

## Dauerhafte Broker-Outbox

`npm run enterprise:broker -- demo`, `status`, `deliver`, `poll`, `enqueue --input /tmp/event.json` und `retry --event-id UUID`. Der [Outbox-Leitfaden](../docs/ENTERPRISE_OUTBOX.md) beschreibt die separate Queue bis zur Admin-Review. Ereignisse/Sequenzen, Signaturen und Retryzustände überstehen Neustarts; STAGED-Inhalte bleiben erhalten. Dies ist ein lokaler POSIX-Prototyp, kein installierter Native-Messaging-Broker. SEALED-Verifikation und Payload-Retirement fehlen weiterhin.

## Evidenzprüfung und separater Witness

`enterprise:local checkpoint`, `enterprise:witness init/append` und `enterprise:local verify` mit explizitem Witness-Pin prüfen jetzt vollständige Snapshots und erkennen ein gültig abgeschnittenes Ende. [Schnellstart, Vertrauensmodell und Recovery](../docs/ENTERPRISE_EVIDENZPRUEFUNG.md). Dies bleibt STAGED; der Witness ist in der Demo separat gestartet, aber nicht unter unabhängigen OS-Unternehmensrollen. SEALED/Object Lock und Broker-Payload-Retirement bleiben unimplementiert.

## Optionale Storage-Adapter

SDK-Adapter für AWS S3 Compliance Object Lock, Azure version-level Immutable Block Blobs und GCP Bucket Lock prüfen Versionsbindung, Identität/Region, Schlüssel, Retention und vollständigen Readback. `npm run enterprise:storage -- profile --provider aws-s3` liefert einen deaktivierten Entwurf; `simulate` prüft lokal ein vollständig bezeugtes Evidenzobjekt. [Schnellstart und Grenzen](../docs/ENTERPRISE_STORAGE_ADAPTER.md). Keine Cloudzugänge wurden verwendet; positive SDK-Metadaten allein erzeugen kein SEALED und kein Outbox-Retirement.

## Dauerhafte lokale Storage-Aufträge

`enterprise:storage-jobs enqueue/enqueue-cloud/run/status/retry` speichert geprüfte Evidenzaufträge und signierte Bearbeitungszustände. Der CLI-Worker verarbeitet lokale Simulationen. Die explizite Bibliotheks-API `runCloudOne` bindet optional S3/Azure/GCP an die Queue, mit Ziel-/Retentionsbindung, Gesamtzeitlimit, Abbruch, Wiederaufnahme, Readback, Retry und Dead Letters. [Schnellstart, Grenzen und Recovery](../docs/ENTERPRISE_STORAGE_JOBS.md). Produktiver Cloudworkerbetrieb, unabhängiger SEALED-Commit und Broker-Retirement bleiben offen.

## Speicherstatus verständlich erklärt

Die sechssprachige Adminansicht zeigt lokale Ablagebezeichnungen mit aufklappbarer Statuserklärung. [STAGED, CLOUD_OBSERVED und SEALED mit Adminbeispiel](../docs/ENTERPRISE_SPEICHERSTATUS.md). SEALED ist weiterhin nicht implementiert; die UI-Hilfe verändert keine Quittungen oder Signaturen.

## Offline-Adminübersicht der Speicheraufträge

`enterprise:storage-jobs review --queue ... --config ... --lang de --out ...` erzeugt eine sechssprachige Ansicht mit Filtern, Kapazität, Fehlern, Wiederholungen, Versionen und Fristen. [Bedienung und Zugriffsgrenzen](../docs/ENTERPRISE_STORAGE_ADMIN.md). Die Ansicht enthält keine Schreibaktionen; HTML/JSON bleiben unsignierte Statuszusammenfassungen.

## Öffentliche Schlüssel für unabhängige Jobprüfung

`enterprise:storage-verify verify/review --journal ... --config ...` prüft ein Journal und erzeugt die bestehende sechssprachige Adminansicht ohne privaten Writer-Schlüssel. [Trustwerte, Kopfbindung und Grenzen](../docs/ENTERPRISE_PUBLIC_KEY_PRUEFUNG.md). [Priorisierte nächste Schritte](../docs/ENTERPRISE_NAECHSTE_SCHRITTE.md).

## Dauerhafter Policystand

`PolicyState` speichert angenommene Versionsstände und Schlüsselwiderrufe mit signierter Wiederaufnahme. Entscheidungen prüfen den aktuellen gespeicherten Stand; kein Extension-Hook aktiviert. [API, Trustwerte und Recovery](../docs/ENTERPRISE_POLICY_STATE.md). N01–N05 des Ausführungsplans sind lokal implementiert; N06 bleibt wegen fehlender realer Systeme und produktiver Kernpfade blockiert.

## Versionierte Incidentregeln

`enterprise:incidents --export ... --rules ... --server-public-key ... --server-key-id ... --registry ... --out ...` leitet Incidentkandidaten aus vollständig geprüften signierten Entscheidungen ab. Damalige Scores, Policyversionen und Domain-URLs bleiben verbunden; wiederholte Verarbeitung erzeugt dieselben IDs. [Regelformat, Public-Key-CLI und Grenzen](../docs/ENTERPRISE_INCIDENTREGELN.md). Persistente Fälle, SSO-Rollen, Portal und Tickettransport bleiben offen.

## Betriebsberichte, optionale SIEM-Queue und N06-Nachweise

`enterprise:health report/observe` erzeugt minimierte JSON-/sechssprachige HTML-Berichte und speichert lokale Alarmdämpfung dauerhaft. [API und Recovery](../docs/ENTERPRISE_BETRIEBSBERICHTE.md).

`enterprise:connectors profile/enqueue/run/status/retry` erzeugt optionale SIEM-Dateien aus verifizierten Entscheidungen mit dauerhafter Deduplizierung/Backoff/Dead Letters. [Formate und Worker-Konfiguration](../docs/ENTERPRISE_SIEM_EXPORTQUEUE.md). Externe Zustellung bleibt deaktiviert.

`enterprise:acceptance probe/draft/check` prüft lokale Verfügbarkeit und signierte, artefaktgebundene Abnahmeunterlagen. [Acht erforderliche Live-Nachweise und tatsächliche Blocker](../docs/ENTERPRISE_N06_ABNAHME.md). Auch vollständige Unterlagen autorisieren keine SEALED-Transition oder Produktivaktivierung.

## Dauerhafte lokale Incidentfälle

`enterprise:cases ingest/assign/ack/start/resolve/reopen` speichert Falllebenszyklus und Verlauf mit Revisionsprüfung. `verify` prüft das signierte Falljournal ausschließlich mit öffentlichen Schlüsseln, ohne Writer-Lock oder Journaländerung. [Bedienung, Provenienz und Grenzen](../docs/ENTERPRISE_INCIDENTFAELLE.md). Lokale Akteurskennungen sind keine bestätigten SSO-Identitäten; Original-Geräteevidenz wird beim Einlesen, nicht erneut beim Falljournal-Reader geprüft.

## Policy-Diff und Offline-Simulation

`enterprise:policy-simulate --baseline ... --candidate ... --export ... --config ... --out ...` vergleicht signierte Policies und modelliert Öffnungsregeln auf geprüften damaligen Assessments. Öffentliche Trustwerte genügen; kein Rollout oder SEALED-Signal. [Konfiguration, Szenarien und Grenzen](../docs/ENTERPRISE_POLICY_SIMULATION.md).

## Sechssprachige lokale Fallübersicht

`enterprise:cases review --journal ... --config ... --lang de --out ...` prüft das Falljournal mit öffentlichen Schlüsseln und erzeugt eine schreibgeschützte Ansicht mit Filtern, vollständigem minimiertem Download und paginiertem Verlauf. [Bedienung und Prüfgrenzen](../docs/ENTERPRISE_FALLUEBERSICHT.md). Keine SSO- oder SEALED-Abnahme; HTML/JSON bleiben unsignierte Momentaufnahmen.
