# Einheitliche Hybrid- und urlscan-Auswertung in 1.25.1

Die reine Komponente `provider_results.js` liefert dieselbe Auswertung für Transport, Hintergrund, Cache, Nachrichtenansicht, Popup und Linkschutz. `assessmentVersion: 1` ergänzt das bestehende Ergebnisformat additiv um `completion`, `signals` und `conflicts`. Der Abschlussstatus (`pending`, `complete`, `failed`, `unknown`) ist unabhängig vom Gefahrenbefund (`unknown`, `none`, `suspicious`, `malicious`). Ein laufender Bericht kann bereits einen bösartigen Teilbefund enthalten. Ein vollständig abgerufener Bericht kann weiterhin ohne eindeutige Bewertung bleiben.

## Bewertungsregeln

Innerhalb einer Ressource hat ein bösartiger Befund Vorrang vor verdächtigen und unauffälligen Angaben. Ein allgemeines „clean“, eine Whitelist-Angabe oder ein weiterer noch laufender Scanner unterdrückt keine vorhandene Gefahrenmeldung. Unterschiedliche Teilbewertungen werden erklärt. Die Originalberichte werden nicht umgeschrieben.

Die bereits bestehenden Interpretationsschwellen bleiben erhalten:

| Datenquelle | Interpretation |
| --- | --- |
| Hybrid-Urteil / Scanner | Explizites malicious/suspicious; positive Scannererkennungen als bösartiger Befund |
| Hybrid threat_score | Ab 70 bösartig, ab 30 verdächtig |
| Hybrid multiscan_result | Ab 50 bösartig, größer 0 verdächtig |
| Hybrid threat_level | 2 bösartig, 1 verdächtig; 0 allein unterdrückt keinen stärkeren Befund |
| urlscan overall.score | Ab 80 bösartig, ab 50 verdächtig |
| urlscan urlscan.score | Ab 50 verdächtig; ein ausdrückliches malicious bleibt bösartig |
| urlscan engines | malicious oder positive maliciousTotal als bösartiger Befund |

Diese Werte sind Anbieterwerte und lokale Interpretationsregeln, keine Schadenswahrscheinlichkeiten. Originalwerte erhalten keine zusätzliche pauschale „Normal“-Bewertung. Markenhinweise allein erhöhen die Gefahrenstufe nicht. Visuelle Markenimitation wird nur bei passendem explizitem urlscan-Befund und Markenhinweis bezeichnet; andere bösartige Ergebnisse heißen nicht pauschal visuelles Phishing. Fehlende Bewertungsfelder sind unbekannt, nicht unauffällig. Fehlende Erkennungszahlen erscheinen nicht als Null.

## Verarbeitung und Herkunft

Einreichung, laufende Verarbeitung, fertiger Bericht ohne Urteil und technischer Abruffehler bleiben unterscheidbar. Der Hintergrund beendet Hybrid-Polling anhand des Abschlussstatus. Eine vorhandene Bewertung ist kein Abschlussnachweis. Aktualisierung fragt bestehende Auftragskennungen erneut ab und verwendet nicht stillschweigend nur den gespeicherten Bericht. Die stärksten Teilbefunde desselben Anbieterauftrags bleiben bei Aktualisierung und Neustart erhalten. Eine ausdrücklich neue Prüfung erhält einen eigenen Prüfstand; vorherige Beobachtungen bleiben in der Historie.

urlscan-Einreichungen sind in der gemeinsamen Transportkomponente auf eine gleichzeitige POST-Anfrage begrenzt, einschließlich anderer Bedienwege. Ergebnis-GETs können unabhängig davon laufen. POSTs werden nicht automatisch wiederholt. Bekannte Kennungen bleiben auch nach verlorenen Ergebnisantworten erhalten. SHA-256- beziehungsweise UUID-Zuordnungen werden, sofern die Antwort sie liefert, vor Übernahme ihrer Befunde geprüft. Abweichende Berichte erzeugen einen technischen Fehler und keine Bewertung der aktuellen Ressource.

Die Fachansicht zeigt Abschlussstatus, Teilbefunde, Originalwerte, Auftragskennung und Herkunft. Der lokale Export übernimmt ausschließlich freigegebene Bewertungsfelder; Schlüssel, Passwörter, beliebige Anbieterfelder und Auftragskennungen werden darin nicht ergänzt. Verarbeitungsschritte aktualisieren die Anzeige, ohne zusätzliche HTTP-Antworten zu erfinden. Neue Prüfstände entwerten Linkfreigaben; unmittelbar vor dem Öffnen wird die Prüfstandskennung erneut geprüft. Die Richtlinie für unvollständige Prüfungen gilt auch bei bereits unauffälliger Antwort eines einzelnen Dienstes.

## Abnahme

Vertragstests prüfen widersprüchliche Befunde, abgeschlossene unbekannte Berichte, alle drei urlscan-Bewertungsbereiche, Markenhinweise, fehlende Felder, 401/403/404/429, ungültiges JSON, Timeout und Ressourcenabweichungen. Weitere Tests prüfen Auftragswiederverwendung, Neustart, globale POST-Begrenzung, unveränderte HTTP-Zähler und die letzte Freigabeprüfung.

Der native Automatiktest verwendet synthetische Antworten mit realen Thunderbird-Anzeigeereignissen und beiden Oberflächen. Er hält einen Hybrid-Bericht nach einem bösartigen Teilbefund offen, überprüft die Sperrentscheidung, liefert einen unbekannten Abschlussbericht und aktualisiert danach beide Anbieter ohne erneutes POST. Keine Produktionsschlüssel oder echten Nachrichten werden verwendet. Das Release-Gate verlangt diesen paketgebundenen Nachweis zusätzlich zur bisherigen Abnahme.

Der vorherige native CI-Lauf wurde kurz vor Abschluss durch die 15-Minuten-Grenze abgebrochen. Die Grenze wird auf 25 Minuten erhöht; Prüfungen werden nicht entfernt. Temporäre Rollback-Profile werden von den Beweisartefakten ausgeschlossen, damit ein Abbruch keine gleichzeitige Archivierung und Bereinigung dieser Profile auslöst.
