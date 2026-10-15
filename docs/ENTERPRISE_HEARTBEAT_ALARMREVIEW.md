# Sechssprachige lokale Review der Testgeräte-Alarmkandidaten

Stand: 15. Oktober 2026. N14 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ergänzt eine nur lesende HTML-Review des [dauerhaften Heartbeat-Alarmjournals](ENTERPRISE_HEARTBEAT_ALARME.md). Alle sechs Sprachen sind vollständig eingebettet: Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch. Keine produktive Flotte, Unternehmensrollen oder externe Zustellung wird dadurch abgenommen.

## Public-Key-Prüfung vor Anzeige

```sh
npm run enterprise:heartbeat-alerts -- review \
  --config /srv/trust/heartbeat-alert-config.json \
  --journal /srv/local/heartbeat-alerts/actions.jsonl \
  --expected-head UNABHAENGIG_BEKANNTER_ALARM_SHA256 \
  --lang de \
  --out /srv/review/heartbeat-alarms-de.html
```

Die öffentliche Konfiguration aus N13 verwenden. `--lang en|de|fr|es|it|pl`, Standard Englisch. Das CLI prüft vor Erzeugung Signaturen, vollständige Hashkette, Konfigurationsbindung und fachliche Alarmübergänge mit `HeartbeatAlerts.verifyJournal`. Kein privater Schlüssel und kein Writer-Lock erforderlich; funktioniert neben aktiven Writern. Alarm-/Quelljournal und Locks bleiben unverändert. Neue Ausgabedateien erhalten 0600, bestehende werden nicht überschrieben.

Der optionale externe Pin bezieht sich auf das **Alarmjournal**. Ohne unabhängig bekannten Endhash ist ein Abschneiden auf einen gültigen Anfang nicht erkennbar. Prüfstatus, Journalhash und Writer-Schlüsselfingerprint stehen im Bericht. Quell-Pinangaben bei einzelnen Kandidaten dokumentieren die damalige Prüfung durch den Alarmworker; sie sind keine erneut durchgeführte Quellenprüfung durch die Ansicht.

**Original-Gerätesignaturen werden beim Lesen des Alarmjournals nicht erneut geprüft.** Der Alarmworker prüft sie bei der Beobachtung; der Reader bestätigt das Alarmwriterjournal. `verification.sourceDeviceEvidenceReverified` bleibt `false`. Das ist oben sichtbar und im JSON ausdrücklich ausgewiesen. Unabhängige Geräteprüfung erfordert zusätzlich das referenzierte Original-Heartbeat-Journal und die passende vertrauenswürdige Konfiguration. N15 des Plans adressiert diesen separaten Abgleich.

Der Renderer `reviewHtml(verifiedReport, language)` ist kein kryptografischer Verifier zugelieferter JSON-Objekte. Das CLI bietet keinen JSON-Report-Import an. HTML und JSON-Download sind unsignierte Momentaufnahmen; nachträgliche Veränderungen daran werden nicht durch die Ansicht erkannt. Für eine erneute Review das Originaljournal erneut prüfen.

## Drei getrennte Aussagen

| Anzeige | Bedeutung | Beispiel |
|---|---|---|
| Übernahmestatus | Kandidat offen oder durch einen lokalen Verbraucher bestätigt | „Übernahme bestätigt“ bedeutet keine Problembehebung und beweist keine externe Zustellung |
| Meldestand bei Kandidatenerzeugung | Historischer Anlass und damaliger Auswertungszeitpunkt | Eine zu alte Meldung erzeugte damals einen Alarm |
| Meldestand bei letzter Workerauswertung | Letzter im geprüften Alarmjournal ausgewerteter Gerätestand | Dasselbe Gerät meldete später wieder aktuell; der alte Alarm kann weiterhin offen sein |

Die letzte Workerauswertung wird mit UTC-Zeit angegeben. Die Zustände altern in der gespeicherten HTML-Datei nicht automatisch. Eine neue HTML-Erzeugung bewertet die Geräte nicht neu; für neue Meldestände muss der autorisierte Worker zuvor `observe` auf dem Original-Heartbeat-Journal ausführen. Der zusätzliche Review-Erstellungszeitpunkt bestätigt ausschließlich die Erzeugung dieser unsignierten Darstellung.

Eine „wieder aktuelle Meldung“ ist keine Funktions- oder Complianceattestation. Nie gemeldete Geräte erhalten keine erfundene Ausfallzeit. Ein leeres Alarmjournal zeigt „nicht ausgewertet“ und erzeugt weder gesunde Gerätezustände noch Empfangsbestätigungen. Fehlende Zeiten und Sequenzen bleiben ausdrücklich nicht gemeldet; sie werden nicht zu 0 umgedeutet.

## Karten, Filter und Prüfreferenzen

Jede Karte zeigt den übersetzten Kandidatentyp, Priorität, Übernahmestatus, Geräte-/Schlüsselkennung, historischen und letzten Meldestand, Auswertungszeit, erste tatsächlich erkannte verspätete/alte Meldung sowie Bestätigungszeit und Verbraucherkennung. Aufklappbare Referenzen enthalten Kandidaten-ID, Regelversion, maschinenlesbaren Code, Erzeugungs-/Annahme-/Gerätezeit, Sequenz, Quellhash/-aktionszahl, damaligen Quell-Pinstatus und Alarm-Beobachtungsindex.

- Suche nach Kandidaten-, Geräte-, Schlüssel- oder Verbraucherkennung.
- Kombinierbare Filter für Übernahmestatus, Kandidatentyp, Priorität und letzten Meldestand. Historisch zu alte Meldungen bleiben unter ihrem ursprünglichen Typ auffindbar, auch wenn der letzte Meldestand wieder aktuell ist.
- Neueste Alarmbeobachtungen zuerst, stabile Reihenfolge innerhalb derselben Beobachtung. 25 Kandidaten je Seite; Filterwechsel setzt die Seite zurück. Sichtbare, passende und gesamte Kandidatenzahl sowie Seitennummer bleiben sichtbar.
- Kopfzahlen nennen den vollständigen Snapshot und ändern sich nicht durch Filter. Gerätezahlen zählen Geräte, Kandidatenzahlen zählen Kandidaten; mehrere Kandidaten können dasselbe Gerät betreffen.
- Details lassen sich per Tastatur öffnen. Trefferänderungen werden über eine Live-Region angekündigt. Keine Bestätigungs- oder Schreibaktion in der Ansicht.

Die Grenze liegt bei 10.000 Kandidaten und 1.000 Geräteständen. Größere Ansichten werden ausdrücklich abgewiesen; keine stille Kürzung. Für eine darüber hinausgehende fachliche JSON-Prüfung bleibt `verify` verfügbar, soweit das Journal innerhalb seiner eigenen Grenzen liegt.

## Vollständiger minimierter Export und Darstellung

„Alle Kandidaten und Gerätestände exportieren (JSON)“ lädt den vollständigen minimierten Snapshot herunter – unabhängig von Filtern, Seite oder geöffneten Details. Er enthält Regelversion, Zeitangaben, Zustandszahlen, Geräte-/Kandidatenreferenzen und Prüfgrenzen. Unerwartete Zusatzfelder, Streamepochen, URLs, Envelopes oder Credentials werden nicht übernommen. Root-Zähler werden aus den übernommenen Daten berechnet. Ausdrucke betreffen die jeweils sichtbare Seite; für alle Daten den JSON-Export verwenden.

Geräte- und Verbraucherkennungen können personenbezogen sein. Datei und Export nur im freigegebenen Reviewerkreis aufbewahren; die Ansicht implementiert keine SSO-Rollen oder Aufbewahrungsdurchsetzung. Lokale Verbraucherkennungen sind Betreiberangaben, keine bestätigten Unternehmensidentitäten.

Die Seite arbeitet offline ohne externe Ressourcen, Tracking oder Netzwerkanfragen. Nonce-CSP, Textknoten und sichere JSON-Einbettung verhindern die Ausführung eingeschleuster Kennungen als Markup. Helles/dunkles Design, 360/1200 Pixel und alle sechs Sprachen wurden in 24 Chromium-Kombinationen geprüft, einschließlich Tastaturöffnung der Details und vollständigem Download bei aktiven Filtern. Das ist keine manuelle Screenreader- oder Thunderbird-Abnahme.

Die Ansicht liegt außerhalb des XPI; Extension 1.22.0 bleibt unverändert. Produktive Flottenintegration, SSO, Alarmtransport und SEALED bleiben offen.

Validierung: 847 Tests erfolgreich, darunter 11 neue Prüfungen für alle sechs Sprachen, historische/letzte Meldestände, Filter/Pagination, Datenminimierung, leere Journale, Signatur-/Pinfehler und CLI-Schutz. 24 Chromium-Layouts einschließlich Tastaturdetails und vollständiger Downloads geprüft. Vollständiges `npm run check` erfolgreich; 0 Lintfehler und 24 bestehende Thunderbird-Warnungen. Alle 40 XPI-Dateien sind bytegleich mit v1.22.0.
