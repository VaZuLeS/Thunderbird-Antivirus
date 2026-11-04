# Prüfprotokoll 1.24.6 — Quellen und Antwortzustände

Die folgenden konkreten Verhaltensfälle sind durch lokale Node-/DOM-Prüfungen der Produktfunktionen geprüft. Native Ergänzungen sind ausdrücklich benannt; Providerantworten bleiben synthetisch. Dieses Protokoll allein ist keine Freigabe oder Live-Anbieterabnahme. [Umfang und paketgebundene Evidenz](HOTFIX_QUELLENLADEFEHLER_1_24_6.md).

| Prüffall | Nachweisumgebung | Ergebnis |
| --- | --- | --- |
| Ungültige gespeicherte Quellenzeilen verdrängen keine gültigen Beobachtungen aller fünf Dienste | Modell-/Historienvertrag, simulierte Speicherung | OK |
| Nicht als Liste gespeicherte Ressourcen und Null-Einträge lassen gültige Popupberichte stehen | vollständiger DOM-Popupstart; native Leseprojektion | OK |
| Übersprungene Linkeinträge ändern keine ursprünglichen Ressourcenreferenzen | Hintergrundkontext-/RPC-Vertrag mit Nachrichtendoubles | OK |
| Historische Warnungen bleiben erhalten und ohne neue aktuelle Ressourcenbindung | Modell-/Hintergrundvertrag, native synthetische Historie | OK |
| Originale Ressourcen-/Legacy-Payloads werden durch Lesen und Anzeigen nicht verändert | JSON-Vorher/Nachher; echter IndexedDB-/Popup-/Nachrichtenlauf | OK |
| Cachebereinigung erhält unlesbare Originale und verarbeitet lesbare abgelaufene/überzählige Daten weiter | Cursor-/Transaktionsvertrag; nativer Bereinigungsaufruf | OK |
| Bloße Antworten ohne Urteil mit Fehlern erscheinen nicht als vorhandene auswertbare Ergebnisse | API-Ereignismodell und beide Renderer, native Nachrichtenansicht | OK |
| Bloße Antworten ohne Fehler und vorhandene Urteile mit Fehlern erhalten unterschiedliche Zustände | Modell/DOM, tatsächliche Produktfunktionen | OK |
| Aktuelle Konfiguration/Freigabe wird ausdrücklich als Bedingung für neue Anfragen angezeigt | sechs Sprachen, direkter und serialisierter Renderer | OK |
| Unlesbare Teildaten erhalten einen sichtbaren Hinweis statt einer Entwarnung | sechs Sprachen, direkter und serialisierter Renderer | OK |
| Abweichende optionale Hybrid-Analysis-Berichtsfelder und fehlende Scores bleiben darstellbar bzw. unbekannt | vollständiger DOM-Popupstart; native Berichtsfixture | OK |
| Doppelte, ersetzte oder geschlossene Berichtsschaltflächen lösen keine fremde/weitere Aktion aus | DOM-Ereignisvertrag mit gezählten Hintergrundnachrichten | OK |

**Summe:** 12 OK / 0 FAIL / 0 N/A / 0 OFFEN

Native Linux-Proben verwenden Thunderbird 140/153, tatsächliche MIME-/Anhangbytes, IndexedDB und beide Ansichten. Erfolgreiche Anbieterübermittlung wird nicht simuliert und als echt ausgegeben. Der zusätzliche CI-Clientbericht ergänzt die bestehenden paketgebundenen Upgrade-/Crash-/Profilrestorefälle. Deren Ergebnisse werden aus dem tatsächlichen CI-Abschluss abgelesen und nicht aus dieser Tabelle abgeleitet.
