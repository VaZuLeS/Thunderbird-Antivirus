# Sechssprachige lokale Testgeräte-Übersicht

Stand: 15. Oktober 2026. N12 des [Ausführungsplans](ENTERPRISE_NAECHSTE_SCHRITTE.md) ergänzt eine lokale, nur lesende HTML-Ansicht für [signierte Testgeräte-Heartbeats](ENTERPRISE_HEARTBEATS.md). Keine reale Unternehmensflotte, kein Enrollment, kein SSO und keine Thunderbird-/Brokerintegration werden dadurch abgenommen.

## Erstellen und erneut prüfen

```sh
npm run enterprise:heartbeats -- review \
  --journal /srv/local/heartbeats/actions.jsonl \
  --config /srv/trust/heartbeat-config.json \
  --expected-head <unabhaengig-bekannter-journal-endhash> \
  --lang de \
  --out /srv/review/heartbeats-de.html
```

Den tatsächlichen Journalpfad des Writers und dieselbe öffentliche Konfiguration wie bei `verify` verwenden. Sprachwahl: `en`, `de`, `fr`, `es`, `it`, `pl`; Standard Englisch. Alle sechs Übersetzungen sind eingebettet. Vor Erzeugung prüft das CLI das Originaljournal einschließlich Geräte- und Writersignaturen, Scope, Sequenzen, Schwellenwertbindung und Hashkette. Es benötigt keinen privaten Schlüssel, verändert weder Journal noch Writer-Lock und kann neben dem aktiven Writer laufen. Ausgabedateien werden mit 0600 erstellt; vorhandene Dateien werden nicht überschrieben.

Der optionale externe Endhash muss unabhängig bekannt sein. Ohne ihn bleibt ein Abschneiden auf einen gültigen Journal-Anfang unerkennbar. Die Ansicht zeigt diesen Unterschied, den geprüften Journalhash und den Fingerabdruck des Writer-Schlüssels.

HTML und JSON-Download sind **unsignierte Momentaufnahmen**. Die Ansicht erkennt nachträgliche Änderungen an sich selbst nicht. Für eine erneute Prüfung immer das Originaljournal und die vertrauenswürdige Konfiguration verwenden. Der Renderer `reviewHtml(report, language)` ist kein kryptografischer Verifier zugelieferter JSON-Daten; das CLI bietet deshalb keinen JSON-Report-Import an.

## Darstellung und Bedienung

- Fünf klar getrennte Zustände: nie gemeldet, aktuelle Meldung, verspätete Meldung, Meldung zu alt, Registrierung widerrufen. „Aktuelle Meldung“ belegt keinen Onlinestatus.
- Auswertungszeit in UTC, Mindestversion und Fristen im Kopf. Status und Meldungsalter gelten für diesen Zeitpunkt; kein automatisches Altern oder Polling der gespeicherten Ansicht.
- Geräte-/Schlüsselkennung, Annahme- und Gerätezeit, konservatives Meldungsalter, gemeldete Extension-/Policyversion, erwartete Policyversion, Brokerbereitschaft und Queuezähler je Karte.
- Nicht gemeldete Zeiten, Queuewerte und Versionen bleiben ausdrücklich unbekannt bzw. nicht gemeldet, niemals als 0 oder Erfolg dargestellt.
- Suche nach Geräte- oder Schlüsselkennung und kombinierbarer Statusfilter. „Nur gemeldete Probleme“ findet gemeldetes `brokerReady:false`, Retries, Interventionsfälle, zu alte Extensionversionen und abweichende Policyversionen. Dieser Filter bewertet Selbstauskünfte; fehlende Meldungen lassen sich separat über den Status auswählen.
- 25 Geräte je Seite; Filterwechsel beginnt auf der ersten Seite. Anzeige nennt sichtbare, passende und insgesamt registrierte Geräte.
- Vollständiger minimierter JSON-Download unabhängig von Filtern und Seiten. Kein stilles Abschneiden; die Registrygrenze bleibt 1.000 Geräte.

Alle Versionen, Queuewerte und Brokerangaben sind signierte Selbstauskünfte, keine Installations-, Compliance- oder Funktionsattestation. Auch eine vorausliegende Policyversion ist eine Abweichung, keine Freigabe.

## Datenumfang und Grenzen

Der Download enthält nur explizit ausgewählte Gerätefelder, Auswertungszeit, Prüfkriterien und Quellreferenzen. Unerwartete Zusatzfelder und Streamepochen werden ausgelassen. Gerätekennungen können personenbezogen sein. HTML und Downloads gehören ausschließlich in den freigegebenen Reviewerkreis und unter die genehmigte Aufbewahrung; die lokale Ansicht implementiert keine Unternehmensrollen.

Die Seite funktioniert offline mit Nonce-CSP, sicheren Textknoten und ohne externe Ressourcen oder Tracking. Tastaturbedienbare Filter/Buttons und eine Live-Region melden Trefferänderungen. Helles/dunkles Design, 360/1200 Pixel, alle sechs Sprachen und vollständige Downloads bei aktivem Filter wurden in 24 Chromium-Kombinationen geprüft. Das ersetzt keinen manuellen Screenreader-Test oder eine echte Thunderbird-Abnahme.

Die Ansicht liegt außerhalb des XPI. Extension 1.22.0 bleibt unverändert. Produktive Flottenmessung, SSO, Enrollment und SEALED sind weiterhin offen.

Validierung: 823 Tests erfolgreich; vollständiges `npm run check` einschließlich Übersetzungs-, Vendor-, Lint- und Paketprüfung erfolgreich. Die 40 XPI-Dateien sind bytegleich mit v1.22.0.
