# Schutzwirkung und Providerverträge — Untersuchungsabschluss

TAV-006. Der aktuelle lokale Untersuchungsumfang ist abgeschlossen; reale Erkennungsraten und Provider-Verfügbarkeit werden dadurch nicht nachgewiesen.

## Bedrohungsmodell

Angreifer kontrollieren Nachrichtenmarkup, sichtbaren Absender, Links und nicht vertrauenswürdige Header. Die Erweiterung kann Nachrichten lokal lesen/heuristisch bewerten, aktive HTMLbestandteile entfernen, Linkaktionen abfangen und externe Dienste nur nach Freigabe anfragen. Das Betriebssystem-/Thunderbirdprofil und tatsächlich konfigurierte Unternehmensidentitäten sind getrennte Vertrauensgrenzen. SPF/DKIM/DMARC werden nicht in der Erweiterung kryptografisch neu verifiziert: nur Ergebnisse des ausdrücklich konfigurierten empfangenden Authservers werden als Heuristikeingabe übernommen. Diese Konfiguration ersetzt keine belastbare Infrastruktur-Vertrauenskette.

Ein lokaler Score ist kein Providerurteil und kein Malwarefreiheitsbeweis. UNKNOWN, fehlender Schlüssel, fehlende Zustimmung, Timeout und Fehler bleiben unbekannt. Gleichnamige Domains, legitime Weiterleitungen und Newsletter können heuristische Signale enthalten. Die Häufigkeit von Fehlalarmen und übersehenen Angriffen ist aus den vorhandenen Testdaten nicht schätzbar.

## Tatsächlich ausgeführte lokale Prüfungen

- `test/optimization.test.js`: fehlende/erteilte Zustimmung über alle Stufen, Absender-/Einmalfreigabe, manipulierte Absenderangaben, untrusted/trusted Authheader, urlscan-Stufengrenzen, Providerfehler/Cache, Sanitizing und Linkaudit einschließlich neuer Commit-/Kontextrennen.
- `api_gateway.test.js`, `background.test.js`: Provider-Authverdrahtung, Ergebnis-Key, Fristen/Rate-Limits und Rechtepfade mit Testdoubles.
- `test/report-lifecycle.test.js`: Popupschluss, ungültige späte Antwort, anderer Hash/neue Submission mit gleichem Namen, sichtbarer Speicherfehler.
- `tools/risk-corpus.dev.cjs`: neun synthetische Verhaltensfälle für authentifizierungsbezogenen Fehler, legitimen gleichdomänigen Newsletter, Reply-To-Abweichung und dringlichen Erstkontakt in sechs Sprachen; zusätzlich Trennung privater PSL-Tenants. [Ergebnis](audits/risk-corpus-1_24_3.json). Diese Erwartungsfälle wurden anhand des Produktverhaltens beschrieben und sind keine unabhängige repräsentative Feldstichprobe.
- Reale Linux-Nachrichten-/Dialog-/Upgradefälle, dokumentiert im [Kandidatenprotokoll](live_test_1_24_3.md); externe Anfragen waren deaktiviert.

## Provider-Abnahmematrix

| Dienst | Synthetisch geprüfter Vertrag | Noch separat live zu prüfen |
| --- | --- | --- |
| Hybrid Analysis | Hash/Datei-/URLstufen, Key, begrenztes Report-Polling, gespeicherte Protokollidentität | aktueller Testkonto-/Quotenvertrag, realer Abschlussbericht, erneute Anmeldung/Widerruf |
| VirusTotal | Hash-/IP-Keys, fehlende Rechte, Fehlercache | echte Antworten mit erlaubten Testartefakten, Quoten/429 |
| URLhaus | nur Hostname, Auth-Key, fehlende Zustimmung/Rechte, Fehler nicht als clean cachen | realer Dienst-/Keyvertrag und aktuelle Hostantwort |
| urlscan.io | max-Stufe, unlisted-Submission, API-Key beim Resultat, Fristen | echtes unlisted-Ergebnis, Provider-Timeout und Konto-/Quotenanforderung |
| AbuseIPDB | explizite IP-Auswahl, Key-/Widerrufspfad, nur öffentliche IPs | echter Testkontovertrag; Dokumentations-IP ist kein reputationsfähiges Live-Testziel |

## Schlussfolgerung und Folgeentscheidungen

Die konkret belegten Release-/Lifecyclelücken sind behoben. Keine neuen Domain-Aging-/WHOIS-Dienste, keine Score-Neugewichtung und keine Whitelistausweitung ohne belegten Nutzen. Historische Scores bleiben unverändert.

Für einen unabhängigen Qualitätsnachweis braucht es einen freigegebenen, anonymisierten realitätsnahen Korpus mit legitimen Gegenbeispielen und unabhängigen Labels, getrennte Entwicklungs-/Abnahmedaten sowie fachlichen Review. Reale Providerprüfungen benötigen Testkonten, freigegebene Artefakte und passende Netzfreigaben; hier sind keine Provideridentitäten konfiguriert. Sie werden nicht als bestanden markiert. Neue konkrete Abweichungen erhalten stabile Folge-IDs statt pauschaler Prozentziele.
