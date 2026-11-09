# Administration, Anzeigeoptionen und API-Anbindung

Die unveröffentlichte Version 1.25.2 ergänzt die vorhandene lokale Adminverwaltung um eine verständlichere Einrichtung, Bestätigung neuer Passwörter und separate Anzeigeoptionen. Der Schutz bleibt optional und gilt je Thunderbird-Profil. Ein Upgrade richtet kein Passwort ein und erweitert keine Übertragungsfreigabe.

## Einstellungen und Passwörter

Unter „Administration und Linkschutz“ können Administrator- und Linkfreigabepasswort getrennt eingerichtet oder ersetzt werden. Beide benötigen mindestens zwölf Zeichen und müssen verschieden sein. Neue Passwörter werden zur Bestätigung erneut eingegeben; leere neue Passwortfelder behalten vorhandene Passwörter bei. Das aktuelle Administratorpasswort dient auf der gesperrten Seite nur zum Entsperren. Die Oberfläche zeigt, ob ein Linkfreigabepasswort eingerichtet ist, aber niemals dessen Inhalt. Ohne eingerichtetes Freigabepasswort bleiben freigabepflichtige Links blockiert.

Die Wiederherstellung hat einen eigenen aufklappbaren Bereich mit verdeckter Codeeingabe, neuem Administratorpasswort und Bestätigung. Ein erfolgreicher Vorgang ersetzt das Adminpasswort, widerruft Sitzungen und liefert einen neuen einmaligen Wiederherstellungscode. Die bestehende gesalzene PBKDF2-SHA-256-Verifikation mit 600.000 Iterationen, die Wartezeiten und die fünfminütige Sitzung bleiben erhalten. Sicherheitsänderungen werden weiterhin im Hintergrund autorisiert. Externe Übertragungen lassen sich auch ohne Entsperren stoppen.

## Anzeigeoptionen

Der neue Bereich nach den Darstellungseinstellungen besitzt eine eigene Speicherschaltfläche:

| Option | Standard | Wirkung |
| --- | --- | --- |
| Standardansicht für Nachricht und Popup | Übersicht | Wählt die anfängliche Übersicht oder Fachansicht für beide Oberflächen. Ein manueller Ansichtswechsel bleibt möglich. |
| Zusätzliche Hybrid-API-Berichtsbereiche | Eingeschaltet | Zeigt die ausführlichen, aufklappbaren Hybrid-Berichtsbereiche. Beim Ausschalten entfallen diese Zusatzbereiche und ihre Anzeigeprojektion. |

Die interne Speicherung verwendet `analysisDefaultView` (`simple` oder `expert`) und `analysisShowHybridDetails` (Boolean). Vorhandene Profile behalten die bisherigen Standardwerte, ohne neue Werte beim Start zu schreiben. Bei aktivem Adminschutz sind diese Änderungen nur in einer entsperrten Sitzung erlaubt. Anzeigeoptionen starten keine Prüfung, fordern keine Hostberechtigung an und verändern weder Einwilligung, Risikobewertung noch Linksperre. Aktuelle Warnungen bleiben in beiden Ansichten sichtbar. Bestehende Darstellungs- und Schutzprofile sowie Quellenexporte werden um diese Felder nicht stillschweigend erweitert.

Die allgemeine Änderungserkennung berücksichtigt nur die dazugehörigen Einstellungen. Administrator-, Wiederherstellungs- und Anzeigeformular besitzen eigene Speichervorgänge. Dadurch erzeugen ihre Eingaben keinen zusätzlichen allgemeinen Speicherhinweis, der bei vergrößerter Darstellung Bedienelemente verdecken kann.

Eine manuelle Auswahl während des anfänglichen Ladens bleibt beim Eintreffen der gespeicherten Ansichtsvorgabe erhalten. Eine später tatsächlich geänderte Standardansicht wird weiterhin übernommen. Die Wahl gilt für die aktuelle Oberfläche und verändert keine Schutzentscheidung.

Die Anbieterübersicht in den Einstellungen aktualisiert den lokal dokumentierten Schlüssel-/Verbindungsteststatus nach Änderungen. Sie zeigt übersetzte, erlaubte Testzustände statt beliebiger gespeicherter Texte. Diese Aktualisierung liest ausschließlich lokalen Speicher; sie testet keinen Schlüssel automatisch. Ein akzeptierter Verbindungstest bestätigt weiterhin keine Uploadberechtigung oder verfügbares Kontingent.

## API-Korrekturen

Die Hybrid-URL-Einreichung verwendet `/api/v2/quick-scan/url-for-analysis`, entsprechend dem [offiziellen Anbieterclient](https://github.com/hybrid-analysis/VxAPI/blob/master/api/callers/scan/api_scan_url_for_analysis.py). Automatische und bisherige manuelle Aufrufwege sowie synthetische Vertrags-/Native-Prüfungen verwenden denselben korrigierten Pfad. Die bisherigen Datenschutzstufen, Freigaben und das Verbot automatischer POST-Wiederholungen bleiben wirksam. Es wird dadurch keine vollständige Sandboxeinreichung hinzugefügt.

Für urlscan.io unterscheidet eine gemeinsame reine Auswertung bei HTTP 400 zwischen ausdrücklich gemeldetem DNS-Fehler, dokumentiertem Validierungsfehler und sonstiger Ablehnung. Übersicht und Bedienweg verwenden dieselben Fehlerkennungen. Eine unspezifische Ablehnung wird nicht mehr als DNS-Ausfall ausgegeben. Die [offizielle Fehlerbeschreibung](https://docs.urlscan.io/pages/error-codes) nennt mehrere Ursachen für HTTP 400. Ungefilterte Fehlerantworten werden in diesen Meldungen und Protokolleinträgen nicht übernommen.

Die API-Unterversion und kontospezifische Rechte werden durch synthetische Antworten nicht verifiziert. Die vollständige Trennung aller Hybrid-Auftragskennungen, ergänzende Sandbox-Berichtsabrufe und aktionsbezogene urlscan-Quoten sind weitergehende API-Arbeiten; sie werden durch diese Korrektur nicht als abgeschlossen bezeichnet.

## Abnahme

Tests prüfen Passwortbestätigung und Wiederherstellung, geschützte und atomare Anzeigeänderungen, beide Renderer, unveränderte Warnungen, lokale Statusaktualisierung ohne Schlüsselanzeige sowie die drei urlscan-Fehlerklassen. Die native Adminprüfung speichert Anzeigeoptionen nach Entsperren und weist unautorisierte Änderungen zurück. Das Release-Gate verlangt ab 1.25.2 diesen paketgebundenen Nachweis zusätzlich zur bestehenden Hybrid-Detailprüfung.

Die explizite Grenze für entpackte Laufzeitdateien wird wegen zusätzlicher Bedienlogik und sechs Sprachkatalogen von 1.300 auf 1.400 KiB angepasst. Paketprüfung, kanonischer Paketbau und Grenzwerttest verwenden dieselbe Grenze; Tests, Dokumentation und Entwicklungswerkzeuge bleiben aus dem XPI ausgeschlossen. Tatsächliche Abnahmeergebnisse stehen im [versionsgebundenen Protokoll](live_test_1_25_2.md).
