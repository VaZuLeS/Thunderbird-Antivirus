# Sechssprachige lokale Fallübersicht

Stand: 14. Oktober 2026. N09 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ist implementiert. Die lokale HTML-Ansicht ergänzt die [dauerhaften Incidentfälle](ENTERPRISE_INCIDENTFAELLE.md) um lesbare Entscheidungssnapshots, Filter, Pagination und Bearbeitungsverlauf. Alle Beschriftungen und Statuswerte sind in **Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch** enthalten.

## Erstellen aus dem geprüften Falljournal

```sh
npm run enterprise:cases -- review \
  --journal /srv/local/cases/actions.jsonl \
  --config /srv/trust/cases.json --lang de \
  --expected-head EXTERN_BEKANNTER_FALLJOURNAL_HASH \
  --out /srv/review/cases.html
```

Dieselbe ausschließlich öffentliche Trustkonfiguration wie für `verify` verwenden. `--lang en|de|fr|es|it|pl`, Standard Englisch. Vor Erstellung prüft das CLI Signaturen, vollständige lokale Hashkette, Organisations-/Trustbindung und fachliche Fallübergänge. Es benötigt keinen privaten Schlüssel und öffnet keinen Writer. Journal und Lock bleiben unverändert; bestehende Ausgabe wird nicht überschrieben. Neue HTML-Dateien erhalten Modus 0600.

Der optionale Kopf-Pin muss aus einer unabhängig bekannten Quelle stammen. Die UI zeigt den geprüften Referenzabgleich bzw. den fehlenden Pin, Journalhash und Fingerabdruck des Fallwriter-Schlüssels. Ohne Pin ist gültiges Abschneiden des Journals nicht erkennbar. Original-Geräteevidenz wird nicht erneut geprüft; hierfür den ursprünglichen signierten Export mit den sichtbaren Event-/Quittungsreferenzen separat prüfen.

Der Renderer akzeptiert intern das Ergebnis des Public-Key-Fallverifiers. Er ist **kein eigenständiger Verifier für zugelieferte JSON-Reports**. Das CLI besitzt keinen Importpfad für ungeprüfte Reports. HTML und heruntergeladenes JSON sind unsignierte Momentaufnahmen; Veränderungen an diesen Dateien werden nicht durch die Ansicht selbst erkannt. Für eine erneute Prüfung immer Journal und vertrauenswürdige Konfiguration verwenden.

## Anzeige und Filter

Jede Fallkarte verbindet Domain-URL, Fallstatus, Priorität, protokolliertes Öffnungsergebnis, Score bei Entscheidung, Providerbefund, Scoremodell, Entscheidungszeit, Policy-/Regelversion, Bearbeiter und aktuelle Revision. Ein fehlender Score erscheint ausdrücklich als „Unbekannt“, niemals als 0. Die Domain ist Text und öffnet beim Anklicken keinen Link.

- Suche nach Domain, Regel-ID oder Bearbeiterkennung.
- Filter nach Fallstatus, Priorität und protokolliertem Ergebnis.
- Optional Mindestscore (0–100) oder ausschließlich unbekannte Scores. Filter werden gemeinsam angewandt; ein gesetzter Mindestscore schließt unbekannte Scores aus.
- 25 Fälle pro Seite. Filterwechsel setzt die Fallseite zurück; die Anzeige nennt Trefferzahl und Seitennummer.
- Aufklappbarer Fallverlauf mit lokalen Akteurskennungen, Zeit, Aktion, Status, Revision, Zuweisung und Abschluss. Darstellung erst beim Aufklappen, 50 Einträge pro Verlaufsseite; keine stille Kürzung.
- Aufklappbare Herkunftsnachweise mit Fall-/Event-IDs, Event-/Quittungs- und Regelsethashes.

Zustands- und Abschlussbezeichnungen sind übersetzt. „Risiko akzeptiert“ bleibt eine Fallklassifizierung und genehmigt keine Linköffnung oder Policy-Ausnahme. Lokale Akteurskennungen sind Betreiberangaben, keine durch SSO bestätigten Identitäten.

## Vollständiger Download und Datenschutz

„Alle Fälle herunterladen (JSON)“ enthält den vollständigen minimierten Snapshot einschließlich aller Verlaufsdaten; aktive Filter und Fall-/Verlaufsseiten ändern den Download nicht. Unerwartete Zusatzfelder, Geräte-/Streamepochkennungen, Einstellungen und Credentialfelder werden nicht aus dem Verifierreport übernommen. Domain-URLs, Eventreferenzen und Bearbeiterkennungen können weiterhin personenbezogen sein; nur an berechtigte Reviewer weitergeben und freigegebene Aufbewahrung beachten.

Der Snapshot enthält Erstellungszeit, Journalhash und Prüfmetadaten. Er ist keine zentrale Echtzeitansicht, kein Geräte-Heartbeat und kein unveränderlicher SEALED-Beleg. Kein Polling, Tracking oder externer Provider-/Ticketzugriff. Ein lokaler Blob-Download ist die einzige Dateiaktion in der Ansicht; Fallbearbeitung erfolgt weiterhin über den getrennten, autorisierten lokalen Worker.

## Bedienung, Sicherheit und Grenzen

Die Seite funktioniert offline mit eingebetteten Ressourcen. Nonce-CSP, Textknoten und sichere JSON-Einbettung verhindern, dass Falltexte als HTML/Skripte ausgeführt werden. Sie enthält keine Schreibformulare oder Remote-Inhalte. Filter, Buttons und Details sind mit Tastatur bedienbar; Trefferänderungen werden über eine Live-Region angekündigt. Helles/dunkles Design und schmale Fallkarten wurden in 24 Chromium-Kombinationen geprüft, ebenso der vollständige Download bei aktivem Filter. Das ist keine Abnahme in Thunderbird oder ein manueller Screenreader-Test.

Anzeigegrenzen: maximal 10.000 Fälle und insgesamt 10.000 Verlaufseinträge; Überschreitung wird abgewiesen. Standard-Falljournalgrenzen bleiben 1.000 Fälle / 10.000 Aktionen / 32 MiB. Unter API-Sonderlimits kann ein Journal größer als die Ansichtsgrenze sein; es wird nicht stillschweigend beschnitten.

API: `reviewHtml(verifiedReport, language)` und `project(verifiedReport)` aus `enterprise/cases_review.cjs`. Aufrufer müssen zuvor `IncidentCases.verifyJournal` verwenden; selbst angegebene Prüfbooleans in einem untrusted Objekt sind keine kryptografische Bestätigung. Es werden keine Zugriffsrechte aus dem HTML oder Akteursnamen abgeleitet.

Offen bleiben zentrale Unternehmensrollen, authentifiziertes Portal, produktive Fallbearbeitung, Datenschutzfreigaben, Tickettransport, SEALED und reale Unternehmensabnahme. Die Ansicht liegt außerhalb des XPI; Extension-Release 1.22.0 bleibt unverändert.
