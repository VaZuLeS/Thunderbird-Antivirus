# Externe Analysen, Ergebnisansichten und lokale Linkfreigabe

Dieser Entwicklungsstand ergänzt die echte Thunderbird-Erweiterung. Die React-Webdemo und die separaten Enterprise-Werkzeuge werden dadurch nicht zu einer verwalteten Sicherheitslösung. Eine Veröffentlichung oder Signierung ist damit nicht verbunden.

## Was passiert nach Eingabe eines API-Schlüssels?

Eingeben und Speichern eines Schlüssels starten keine Analyse. Ein Verbindungstest ist eine eigene, ausdrücklich bestätigte Aktion mit festen Testdaten. Nachrichten werden dafür nicht verwendet. Der Test kann Hostberechtigungen anfordern und prüft einen begrenzten Lesezugriff. „Anfrage akzeptiert“ bestätigt weder Uploadrechte noch verbleibendes Kontingent. Auch ein akzeptierter Zugriff auf eine nicht gefundene Ressource ist kein Malwareergebnis.

Reguläre Analysen benötigen globale Einwilligung, Hostberechtigung, passenden Schlüssel und zulässige Datenschutzstufe. Automatische Nachrichtenscans benötigen zusätzlich Absenderfreigabe und beachten den manuellen Modus. Alle produktiven Anbieteranfragen und Schlüsseltests durchlaufen `ApiGateway`; die zentralen Anbieterregeln werden vor Versand und Wiederholungen erneut geprüft. Weiterleitungen werden abgewiesen, damit Authentifizierungsheader nicht an andere Ziele gelangen.

| Anbieter | Reguläre Daten | Mindeststufe | Feste Daten des Verbindungstests |
| --- | --- | --- | --- |
| Hybrid Analysis | Dateihash / Berichtskennung; optional Datei oder URL | Strict für Hash/Bericht, Balanced für Datei, Maximum für URL | SHA-256 der leeren Datei |
| VirusTotal | Dateihash oder öffentliche IP aus Kopfzeilen | Strict | IP 8.8.8.8 |
| URLhaus | Domain eines Links | Strict | Domain example.com |
| AbuseIPDB | Öffentliche IP aus Kopfzeilen | Strict; explizit gewählter IP-Anbieter | IP 1.1.1.1 |
| urlscan.io | Vollständige URL und Berichtskennung | Maximum | Suche nach Domain example.com |

„Strict“ ist somit nicht gleichbedeutend mit „keine Übermittlung“. URLs können Zugriffstoken und personenbezogene Daten enthalten. urlscan-Übermittlungen sind unlisted, nicht privat. Bereits übertragene Daten können durch einen lokalen Widerruf nicht zurückgerufen werden. Ohne Einwilligung bleiben die lokalen Prüfungen und vorhandene lokale Berichte nutzbar.

## Darstellung für Büro- und Privatanwender

Die Übersicht ist voreingestellt. Sie zeigt eine verständliche Bewertung, höchstens drei wesentliche Gründe, den lokalen Prüfumfang, die Zahl der Dienste mit Befunden beziehungsweise Ausfällen und die Aktualität verfügbarer Beobachtungen. Im Linkdialog steht die Ziel-Domain im Vordergrund; die vollständige URL lässt sich aufklappen.

- **Keine Auffälligkeit erkannt:** In den tatsächlich ausgeführten Prüfungen wurde kein Hinweis gefunden. Keine Sicherheitsgarantie.
- **Vorsicht:** Auffällige Merkmale oder verdächtige Ergebnisse. Gründe vor dem Öffnen prüfen.
- **Gefährlicher Inhalt gemeldet:** Mindestens ein aktuell zugeordneter Befund meldet eine Gefahr.
- **Prüfung unvollständig:** Inhalte, Antworten oder Teile der Prüfung fehlen. Ein Ausfall wird nicht zu einem unauffälligen Ergebnis.

Beispiel: Ein Link wurde lokal geprüft, ein externer Dienst antwortet nicht. Die Anzeige lautet „Prüfung unvollständig“. Die betreffende Schutzregel bestimmt, ob eine normale Bestätigung genügt oder eine zusätzliche Freigabe nötig ist. Die Ansicht selbst ändert diese Entscheidung nicht.

## Fachansicht für Forschung und Administration

Alle Nutzer dürfen die Fachansicht lesen. Sie zeigt Anbieter und Prüfart je Ressource, verifizierte beziehungsweise historische Zuordnung, Live-/Cache-/Speicherherkunft, Zustände, Beobachtungs- und Anfragezeiten sowie verfügbare HTTP-Klassen, Wiederholungsfristen, Erkennungszahlen und zugelassene Originalbewertungen. Schlüssel vorhanden, Verbindung getestet, Analyse erlaubt und Ergebnis verfügbar sind getrennte Informationen.

Der lokale Score von 0 bis 100 ist eine Regelbewertung, keine statistische Wahrscheinlichkeit. Einzelne Anbieterwerte werden nicht als vergleichbare Prozentzahlen ausgegeben. Widersprechen sich Dienste, bleibt der Warnbefund sichtbar. Ein „nicht gefunden“, eine Einreichung ohne fertigen Bericht oder ein fehlgeschlagener Abruf bestätigt keine Unbedenklichkeit.

Der vorhandene Quellenexport bietet Vorschau und ausdrücklichen lokalen Download. Er enthält einen minimierten Prüfstand, keine vollständigen Provider-Rohantworten. API-Schlüssel, Authentifizierungsheader und Passwörter gehören nicht in Exporte. Vollständige Ressourcenberichte werden weiterhin nur im jeweiligen Ressourcenkontext angezeigt. Profilbackups und exportierte Dateien unterliegen nicht der automatischen Cachebereinigung.

## Administratorpasswort nachträglich einrichten

In den Einstellungen befindet sich „Administration und Linkschutz“. Ohne eingerichtetes Administratorpasswort bleibt die lokale Bedienung frei. Für einen administrierten Arbeitsplatz:

1. Ein Administratorpasswort mit mindestens zwölf Zeichen eintragen.
2. Ein davon verschiedenes Freigabepasswort mit mindestens zwölf Zeichen eintragen. Leere Felder behalten bereits eingerichtete Passwörter bei.
3. Verbindlichen Linkschutz aktivieren, Grenzwert und Umgang mit unvollständigen Prüfungen wählen, speichern.
4. Den einmalig angezeigten Wiederherstellungscode außerhalb des Profils sicher aufbewahren. Er wird nicht erneut angezeigt.

Die Einstellungen sperren nach fünf Minuten ohne Aktivität, beim Verlassen der Seite und nach Neustart. Der Hintergrund prüft die Sitzung für geschützte Änderungen einschließlich Importen und administrativen Löschaktionen. Der lokale Nutzer kann externe Übertragungen weiterhin stoppen. Erneutes Aktivieren benötigt eine administrative Freigabe. Erscheinungsbild und die Lesbarkeit von Analyseberichten sind keine eigenständige Zugriffsberechtigung auf Sicherheitsregeln.

Passwörter und Wiederherstellungscode werden nur als unabhängige gesalzene PBKDF2-HMAC-SHA-256-Prüfwerte mit 600.000 Iterationen gespeichert. Falsche Versuche verursachen zunehmende Wartezeiten während der laufenden Hintergrundsitzung. Die Wiederherstellung ersetzt das Administratorpasswort und den Code, widerruft Sitzungen und erhält die Schutzregel. Das Freigabepasswort kann anschließend ersetzt werden; es wird niemals wieder angezeigt.

## Was löst eine Linkfreigabe aus?

Die Regel bleibt nach Installation und Upgrade ausgeschaltet. Beim Aktivieren ist der vorgeschlagene Grenzwert 50; zulässig sind ganze Zahlen von 0 bis 100. Der Grenzwert zählt mit: Bei 50 verlangen Score 50 und 51 eine Freigabe, Score 49 allein nicht. Ein aktuell zugeordneter bösartiger Befund verlangt unabhängig vom Score eine Freigabe. Der Administrator kann für unvollständige Prüfungen ebenfalls eine Passwortfreigabe verlangen; voreingestellt ist eine deutliche Warnung mit normaler Bestätigung.

Bei aktiver Regel bleibt die Linkabfangfunktion eingeschaltet. Im Nachrichtendokument werden Linksklick, Mittelklick und das native Link-Kontextmenü abgefangen. Das Hintergrundmodul prüft die Öffnungsanforderung erneut; ältere Öffnungsaufrufe ohne passende Prüfinteraktion können die Regel nicht umgehen.

Eine Freigabe verlangt das getrennte Passwort auf einer eigenen Erweiterungsseite und die ausdrückliche Bestätigung „Ich möchte diesen möglicherweise gefährlichen Inhalt trotzdem öffnen“. Ohne eingerichtetes Freigabepasswort bleibt ein freigabepflichtiger Link gesperrt. Ein Freigabeversuch gilt höchstens 60 Sekunden für exakt URL, Nachricht, Interaktion, Prüfstand und Richtlinienversion. Kontextänderung, geänderte Bewertung, geänderte Richtlinie, Ablauf oder Neustart machen ihn ungültig. Eine erfolgreiche Freigabe führt genau einen Öffnungsversuch aus.

Das lokale Audit ergänzt Sperrgrund, Richtlinienversion und Freigabeentscheidung ohne Geheimnisse. `OPENED` bedeutet weiterhin nur, dass Thunderbird die Öffnungsanforderung angenommen hat; Browserstart und Webseitenbesuch sind damit nicht nachgewiesen. Vorhandene historische Entscheidungen werden nicht neu interpretiert.

## Grenzen und neue Anbieter

Die Konfiguration gilt pro Thunderbird-Profil, nicht automatisch für alle Profile eines PCs. API-Schlüssel liegen weiterhin im Profil ohne zusätzliche Verschlüsselung. Der Passwortschutz verhindert unterstützte Änderungen innerhalb der Erweiterung; er ersetzt weder Betriebssystemrechte noch zentral verwaltete Thunderbird-Richtlinien. Profilmanipulation, Deinstallation und das Öffnen kopierter URLs außerhalb der Erweiterung bleiben außerhalb dieser Durchsetzung.

Neue Anbieter ergänzen das zentrale Register mit Kennung, HTTPS-Zielen, Authentifizierungsheader, Konfigurationsschlüssel, Fähigkeiten, Datenschutzstufen und festem Verbindungstest. Hinzu kommen der Ergebnisadapter, die optionalen Manifestberechtigungen und Vertragstests. Normalisierung und beide Ansichten verwenden dieselben Anbieterkennungen. Die zentrale Transportprüfung sowie die Linkschutz-Entscheidung dürfen nicht durch einen neuen Adapter umgangen werden.

Automatisierte Prüfungen verwenden synthetische Nachrichten und Schlüssel. Native Nachweise werden in isolierten Linux-Profilen erstellt; sie belegen keine Windows-/macOS-Abnahme und keinen produktiven Test der Anbieter mit Kundenkontingenten.
