# Entwicklungsprüfung 1.24.5 — Analyseergebnisse

Die [Umsetzung](HOTFIX_ANALYSEERGEBNISSE_1_24_5.md) und der [maschinenlesbare Beleg](audits/hybrid-popup-fix-2026-11-04.json) trennen simulierte Providerantworten von echten Thunderbirdprüfungen. Keine Veröffentlichung oder ATN-Freigabe.

| Prüffall | Umgebung | Ergebnis |
| --- | --- | --- |
| Popupstart mit Tags als Text und zweitem gültigem gespeicherten Bericht; alter allgemeiner Ladeabbruch entfällt | DOM-Verträge und echte Linux-Thunderbird-140/153-Profile | OK |
| Leere Scannerzeilen und abweichende AV-Listen lassen verwertbare Berichtsteile mit Teilhinweis stehen | DOM-Verträge und native Popup-Fixture | OK |
| Ein insgesamt unlesbarer Einzelbericht verdrängt den benachbarten gültigen Bericht nicht | DOM-Fehlerisolationsvertrag mit gespeicherten Testdaten | OK |
| Fehlende/ungültige Scores, Urteile und Scannerangaben bleiben unbekannt; fehlendes Berichtshashfeld nutzt die belegte Ressourcenbindung, null Byte bleibt null | DOM-Verträge, ergänzend native Berichtsanzeige | OK |
| Aus den Antwortformen aller fünf Dienste klassifizierte Ergebnisse und ihre Herkunft sind ohne Öffnen der Prüfdetails sichtbar | echte Modellklassifizierung mit API-Fixtures und native synthetische Beobachtungen in Popup/Nachricht | OK |
| Leere Antworten und HTTP 401/429/500 werden nicht als positives Ergebnis dargestellt | simulierte Providerantworten für alle fünf Dienste | OK |
| Neue Hinweise und dieselbe Ergebnisdarstellung funktionieren in sechs Sprachen einschließlich serialisiertem Inline-Renderer | DOM-/Katalogverträge; sechs erfolgreiche Browser-Sprachjobs im ersten PR-Lauf | OK |
| Reines Anzeigen startet keine neue externe Anfrage; gespeicherte Berichte bleiben bei deaktivierter externer Analyse darstellbar | DOM mit gezählten Requests; native Popup-Fixture mit deaktivierter Einwilligung | OK |
| Vorhandene Ressourcenprotokolle bleiben beim Öffnen der beiden Ansichten byteinhaltlich unverändert | native Vorher-/Nachher-Abfrage der gespeicherten Berichtspayloads unter 140/153 | OK |
| Manuelles Upgrade von 1.24.4 und drei normale Neustarts erhalten Einstellungen und historische Entscheidungen | echte Linux-Thunderbird-153-Installation; zusätzlich sechssprachiger CI-Clientlauf | OK |
| SIGKILL nach bestätigter und nach noch offener Entscheidung erzeugt weder einen erfundenen Abschluss noch zusätzliche Öffnungsanforderungen | zwei native SIGKILL-Wiederanläufe pro geprüfter Sprachinstallation | OK |
| Sauberer Profilbackup-Restore stellt den gesicherten Vorgängerstand wieder her und vereinigt keine späteren Ereignisse | echte Linux-Thunderbird-153-Installation; sechssprachiger CI-Restorelauf | OK |

**Summe:** 12 OK / 0 FAIL / 0 N/A / 0 OFFEN

Die Summe zählt diese konkret beschriebenen Verhaltensverträge, nicht neue oder zusätzlich ausgeführte Tests. Die ursprünglichen drei Sammelzeilen wurden nach dem C6-Dokumentationsbefund im [ersten PR-Lauf](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41796432817) anhand der bereits vorhandenen Nachweise aufgeschlüsselt. Jener Lauf besteht alle 1.072 Tests, sechs Browserjobs und den vollständigen nativen Clientjob; sein Kandidatengate scheitert ausschließlich an der zu kurzen Protokollsumme. Simulierte und native Umgebungen bleiben oben ausdrücklich getrennt. Vollständige paketgebundene sechssprachige Browser-/Upgrade-/Crashberichte müssen die CI und der Kandidatengate zusätzlich selbst erzeugen. Native Linux-Teilabnahmen ersetzen keine Live-Provider-, Windows/macOS-, Screenreader- oder automatische Updateabnahme.
