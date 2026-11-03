# Noch erforderliche reale Abnahmen — Informationsdarstellung

Zu [INFO-08 des Plans](PLAN_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md). **Vorbereitung abgeschlossen, Durchführung mangels Ressourcen offen.** Linux-/Browsernachweise werden nicht als Windows-, macOS-, Screenreader- oder Providerfreigabe ausgegeben. Eine Veröffentlichung ist nicht Teil dieses Auftrags.

## Einheitlicher Ablauf

Vor dem Start exakte Paketbytes/Hash, Thunderbird-Version, OS-Version, Sprache und Hilfstechnologie festhalten. Ein isoliertes Testprofil und synthetische Mail mit zwei gleichnamigen Anhängen und zwei unterschiedlichen Links verwenden. Bestehende Auditdaten separat sichern. Für jeden Fall Nachrichtenansicht und Toolbar-Popup vergleichen; Dienst, Ressource, Prüfumfang, Zustand und Zeitpunkt protokollieren. Das erwartete Ergebnis ist verständliche, richtige Zuordnung, nicht eine bestimmte Erkennungsrate.

| Fall | Aktion | Erwartung |
| --- | --- | --- |
| Lokal | Alle externen Dienste ausgeschaltet lassen, Nachricht öffnen | Lokaler Prüfstand erkennbar; kein externer Prüfnachweis aus Konfiguration, Hash oder entferntem Inhalt abgeleitet |
| Erste Anfrage | Einen zulässigen externen Prüfvorgang ausdrücklich starten | Dienst und ausstehender Zustand bereits vor dem ersten Ergebnis sichtbar |
| Übermittlung | Datei/URL nur bei passender Datenschutzstufe einreichen | Angenommener Auftrag als übermittelt gekennzeichnet; keine fertige Analyse behauptet |
| Ergebnis | Tatsächliche Antwort abwarten | Ressource, Dienst, Prüfumfang und verwertbarer Antwortstatus stimmen mit dem Vorgang überein |
| Gemischt | Unterschiedliche Ressourcen über unterschiedliche Dienste prüfen | Eigene Zuordnung pro Ressource; IP-/Domainprüfung nicht als Datei-/Webseitenvollscan beschriftet |
| Cache/Historie | Popup erneut öffnen, danach externe Dienste deaktivieren | Vorhandene Ergebnisse weiter als Cache/gespeichert sichtbar; Alter unverändert; heutige Konfiguration separat erklärt |
| Fehler | Testnetz zeitweise unterbrechen oder einen freigegebenen Fehlerfall verwenden | Anfragefehler erkennbar; vorhandener Befund und ursprünglicher Zeitpunkt bleiben erhalten |
| Prozessverlust | Während laufender Prüfung Thunderbird im isolierten Profil beenden | Nach Wiederanlauf kein erfundener Abschluss und keine erfundene Nutzerentscheidung |
| Nachrichtenwechsel | Während der Anfrage eine andere Mail öffnen | Keine verspätete Antwort in der falschen Nachricht; ursprüngliche Nachricht behält ihren eigenen Verlauf |

## Windows und NVDA

Benötigt: Windows-Testsystem, unterstütztes Thunderbird, installierte NVDA-Version und isoliertes Profil.

1. Nachricht und Popup mit Tastatur erreichen. Dienste, Ressourcen, Warnungen und Zustand müssen auch ohne Farben verständlich vorgelesen werden.
2. Details mit Tab erreichen und mit Enter/Leertaste öffnen und schließen. Danach zwischen Ressourcen navigieren. Fokus darf nicht verschwinden oder unerwartet springen.
3. Bei geöffnetem Detail eine neue Antwort eintreffen lassen. Detail und Fokus bleiben erhalten; der geänderte Kopfstatus wird sinnvoll und ohne fortlaufende identische Wiederholungen angekündigt.
4. Hell/dunkel, hoher Kontrast, unterschiedliche Dichte und native Skalierung sowie 200 % Vergrößerung prüfen. Keine abgeschnittenen Schaltflächen oder unzugänglichen Details akzeptieren.
5. Deutsch und Englisch sowie mindestens eine längere weitere Übersetzung prüfen; korrekte Sprachausgabe und Dienstnamen protokollieren.

Abnahme erst mit OS-/NVDA-/Thunderbird-Version, konkreten Beobachtungen und etwaigen reproduzierbaren Fehlern abschließen. Eine axe-Prüfung ersetzt diese Schritte nicht.

## macOS und VoiceOver

Benötigt: macOS-Testsystem mit VoiceOver und unterstütztem Thunderbird.

Den Windows-Ablauf entsprechend mit VoiceOver-Navigation und macOS-Tastaturzugriff wiederholen. Insbesondere Popup-Erreichbarkeit, Lesen des Livebereichs, Fokus nach einer Aktualisierung sowie Ein-/Ausklappen prüfen. Native Skalierung und helle/dunkle Darstellung separat protokollieren. Linux-Xvfb und CSS-Zoom sind dafür kein Ersatz.

## Produktive Providerverträge

Benötigt: ausdrücklich freigegebene Testkonten/Schlüssel, passende Quoten und Berechtigungen sowie kontrollierte, zur Übermittlung freigegebene Testdateien/-ziele. Zugangsdaten ausschließlich in der Ausführungsumgebung konfigurieren; sie gehören weder in Berichte noch Screenshots. Dienste bleiben optional und standardmäßig ohne diese Voraussetzungen ungetestet.

| Dienst | Tatsächlich zu prüfen | Besondere Erwartung |
| --- | --- | --- |
| Hybrid Analysis | bekannte/unbekannte Hashabfrage, zulässiger Datei-/URL-Auftrag, ausstehender und fertiger Bericht | Hash, Upload und Bericht getrennt; Auftrag bestätigt keine abgeschlossene Analyse |
| VirusTotal | Hashbericht und IP-Reputation im zulässigen Konto | IP-Befund im Nachrichtenkontext; Cache verjüngt keine ursprüngliche Beobachtung |
| URLhaus | erlaubte Domainanfrage mit tatsächlich unterstützter Authentifizierung | Domainbewertung allen betroffenen Links zugeordnet; keine vollständige URL-Analyse behauptet |
| AbuseIPDB | zulässige Abfrage einer kontrollierten/freigegebenen öffentlichen Test-IP | Score/Reputation als IP-/Transportbefund; keine Dateibewertung daraus ableiten |
| urlscan.io | ausdrückliche URL-Einreichung bei Max-Stufe, danach tatsächliches Polling | UUID ist ein Auftrag; ausstehendes Ergebnis/404 ist kein fertiges Urteil |

Antworttypen und Zustände prüfen; feste numerische Scores oder eine bestimmte Bewertung harmloser Ressourcen sind keine verlässlichen Abnahmekriterien. Fehler- und Quotenfälle nur im erlaubten Umfang ausführen. Die Übersicht und das Aufklappen der Details müssen ohne zusätzliche Provideranfragen funktionieren. Reale E-Mails oder vertrauliche URLs sind für diese Abnahme nicht erforderlich.

Automatische Updateverteilung, ATN-Signierung und Rollback über einen echten Distributionskanal bleiben gesonderte, weiterhin ressourcenabhängige Abnahmen.
