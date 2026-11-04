# 1.24.6 — Quellenladefehler und Antworten ohne Urteil

Stand: 4. November 2026. [**AVN-018 / #743**](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/743), primär Ergebnisaufbereitung und verständlicher Prüfstatus, Optimierung/Verbesserung, P1 / Aufwand M. Tatsächlicher [Veröffentlichungsstatus, XPI und Prüfsumme](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.6). Ein Entwicklungsstand oder dieses Dokument allein bestätigt keine Veröffentlichung. 1.24.5 und seine Assets bleiben erhalten.

## Befunde aus dem Nutzerbeispiel und Gegenproben

Der Nutzer sieht „Externe Ergebnisse vorhanden · einzelne Anfragen fehlgeschlagen“, bei Hybrid Analysis aber nur „Antwort empfangen · Urteil nicht verfügbar“. `analysis_status.js::render` wertete den Antwortzähler als ausreichenden Beleg für verfügbare Ergebnisse. Ein tatsächlich empfangener, nicht klassifizierbarer Body ist jedoch kein auswertbares Urteil. Außerdem stand der aktuelle Hinweis zu fehlender automatischer Freigabe direkt neben einer früheren externen Beobachtung, ohne seine zeitliche Bedeutung zu benennen.

Unabhängig davon sind weitere Abbrüche im veröffentlichten **1.24.5-XPI** reproduziert: `create` liest `old.provider` ohne Prüfung auf einen Null-Eintrag; `legacy`/`history` und `background.js::getMessageAnalysisContext` nehmen gültige Ressourcenlisten an. Ein nicht als Liste gespeichertes Feld oder ein Null-Eintrag kann den Quellen-/Ressourcen-RPC scheitern lassen. Das Popup zeigt anschließend wieder die allgemeine Lademeldung. Die bisherige Reparatur einzelner Hybrid-Analysis-Berichtsfelder erfasst diese vorgelagerte Datenaufbereitung nicht.

Die DOM-Gegenprobe scheitert im Vorgänger bei einem Null-Eintrag vor einem gültigen Bericht. Der native Linux-153-Gegenlauf verwendet das tatsächlich veröffentlichte 1.24.5-Paket mit SHA-256 `283ad4dd941b31058dee8762ccd3ed945527e323b57f7b9552e593bd9d249035` und bestätigt den fehlgeschlagenen echten Ressourcen-RPC sowie die allgemeine Popupmeldung. Derselbe Lauf bestätigt die alte irreführende Ergebnisüberschrift bei Antworten ohne Urteil. Der konkrete gespeicherte Datensatz des Nutzers wurde nicht eingesehen; die Gegenprobe belegt einen weiteren Fehlerpfad, keine Diagnose seiner gesamten Installation.

## Umsetzung und Akzeptanz

- `ThundyAnalysis.resources` bildet eine **reine Leseprojektion**: gültige Ressourcen bleiben nutzbar, unlesbare Einträge werden ausgelassen und als Teilausfall gekennzeichnet. Originaldaten werden dabei nicht repariert, umgeschrieben oder gelöscht.
- Linkslots werden vor dem Filtern vergeben. Ein gültiger Link nach einem Null-Eintrag behält `link:1`; er wird nicht unter der Identität `link:0` angezeigt. Der Hintergrund bindet Linkreferenzen weiterhin selbst an die ursprünglichen Slots und aktuelle Nachrichtenressourcen. Anhangberichte bleiben von tatsächlich verifizierten Bytes abhängig.
- Modell- und Historienaufbereitung erhalten alle gültigen Providerbeobachtungen neben unlesbaren Einträgen. Historische Warnungen bleiben ungebunden und werden nicht als aktuelle Prüfung bzw. damalige Nutzerentscheidung neu interpretiert.
- Das Popup nutzt dieselbe defensive Projektion. Der eigenständig serialisierte Nachrichtenrenderer toleriert unlesbare Zeilen ebenfalls. Beide zeigen den sechssprachigen Hinweis: „Einige gespeicherte Analysedaten konnten nicht gelesen werden. Andere Ergebnisse bleiben verfügbar.“
- Die Cachebereinigung überspringt Datensätze mit unlesbaren Ressourcenlisten/-einträgen. Sie setzt die normale Alters-/Mengengrenze für lesbare Datensätze fort. Die Ausnahme erhält die unlesbaren Originale und bedeutet, dass sie nicht in die normale 1.000-Datensatz-Auswahl eingehen. Eine allgemeine Wiederherstellungs-/Retentionslösung bleibt #725; unbekannte Daten werden nicht anhand vermuteter Zeitstempel gelöscht.
- Für **alle fünf Dienste** unterscheiden Hauptzeile und Dienstkarten auswertbare Befunde von bloßen Antworten. Ohne Urteil lautet der Status „Antworten ohne auswertbares Urteil empfangen · einzelne Anfragen fehlgeschlagen“. Bei einem vorhandenen bekannten Urteil und weiteren Fehlern bleibt der Hinweis auf verfügbare Teilbefunde bestehen. Erkennbare Warnungen werden nicht versteckt.
- Hinweise wie manueller Modus, fehlende Konfiguration oder Freigabe stehen ausdrücklich unter **„Für neue Anfragen“**. Sie widerrufen keinen früheren Kontakt und belegen keine damalige Freigabe.

Die API-Klassifizierer und vorhandenen Schwellen werden nicht erweitert. Aus dem Nutzertext allein lassen sich weder ein konkreter HTTP-Fehler noch ein tatsächlich vorhandenes Providerurteil ableiten. Es werden keine Rohantworten, Fehlertexte, Schlüssel oder Mailinhalte zusätzlich protokolliert. Darstellung löst keine zusätzliche Übermittlung aus; externe Dienste und Enterprise bleiben optional. OPENED bestätigt nur die angenommene Öffnungsanforderung; PENDING bleibt nach Prozessverlust unvollständig.

## Validierung

Endgültiger Kandidat SHA-256: `4ad8d9895d7705cdc7bf804384c14c27ce3f72798e27626f45aef3154e1cd36a`; Source-Fingerprint `d57dd4edde105cacc90583fbe9c1dcc95aa582c22aff2397d1013e036c596449`. Vollständiger lokaler Check: **1.080 Prüfungen / 0 Fehler**; je **103 gezielte Prüfungen** unter Node 22/24 und drei Runner-Byteprüfungen erfolgreich. Finale native Linux-140/153-Läufe bestehen; Upgrade von öffentlicher 1.24.5 unter 153 mit drei normalen und zwei SIGKILL-Neustarts sowie sauberem Profilrestore erfolgreich.

Echte native Bildschirmaufnahmen mit synthetischen Beobachtungen: [Antworten ohne Urteil](screenshots/1.24.6/responses-without-verdict-synthetic.png), [Popup und Nachricht nach dem Leseprojektionsfix](screenshots/1.24.6/stored-source-recovery-synthetic.png). Keine dargestellte Providerbeobachtung ist ein Livebefund.

[Maschinenlesbare Evidenz](audits/avn-018-stored-sources-2026-11-04.json), [Prüffälle](live_test_1_24_6.md). Gezielte Node-/DOM-Prüfungen verwenden die echten Modell-, RPC- und Renderfunktionen mit simulierten Browser-/Speicherverträgen. Die Anzeige wird für Hybrid Analysis, VirusTotal, URLhaus, AbuseIPDB und urlscan.io in allen sechs Sprachen sowohl direkt als auch isoliert serialisiert geprüft. Echte kontrollierte Fehlerfälle erhalten JSON-Originale, Slotzuordnung und historische Warnungen.

`--stored-source-check` verwendet echtes Linux-Thunderbird mit synthetischer Mail, tatsächlichen MIME-/Anhangbytes, IndexedDB, Ressourcen-RPC, Popup und Nachrichtenansicht. Zuerst wird die Antwort-ohne-Urteil-Situation für alle Dienste erzeugt. Danach folgen unlesbare Listen/Einträge, Cachebereinigung und die echte Lese-/Renderfolge. Anhanghashes werden aus tatsächlich erneut gelesenen Bytes berechnet. Nachher werden die ursprünglichen Ressourcen und Legacyquellen erneut unverändert gelesen. Providerereignisse und historische Protokolle sind ausdrücklich synthetisch; Einwilligung bleibt ausgeschaltet. Baseline und korrigierte Proben sind getrennt an ihre jeweiligen Paketbytes gebunden.

```sh
node --test test/analysis-sources.test.js test/popup-loading.test.js test/optimization.test.js
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb --xpi /absolute/path/to/verified-candidate.xpi \
  --stored-source-check --out /absolute/path/to/new-directory
```

Dies ist keine neue Abnahme produktiver Anbieterzugänge, Windows/macOS, Screenreader oder automatischer Updates. Die verbleibenden Voraussetzungen stehen in [Roadmap #740](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/740). Der Tagworkflow führt die vollständige CI mit paketgebundenen Browser-/Clientberichten vor der Veröffentlichung erneut aus; der tatsächliche Abschluss ist am Release und den heruntergeladenen Bytes maßgeblich. Die GitHub-Distribution ist unsigniert; keine ATN-Signierung oder automatische Installation wird zugesagt.
