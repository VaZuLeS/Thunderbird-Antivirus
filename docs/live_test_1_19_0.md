# Live-Abnahme für Thundy AV 1.19.0

Dieses Protokoll ist vorbereitet, aber **nicht ausgeführt**. Der Arbeitsbereich enthält keinen Thunderbird-Client, kein Testpostfach und keine Provider-Testschlüssel. Node-/DOM-Tests ersetzen diese Abnahme nicht. Die Felder „Ist“ und „Status“ bleiben bis zur tatsächlichen Durchführung leer.

## Testumgebung

| Feld | Wert |
|---|---|
| Kandidat | 1.19.0, öffentliches unsigniertes GitHub-Release |
| Thunderbird 140 ESR: genaue Version | |
| Aktuelle unterstützte Thunderbird-Version | |
| Betriebssystem und Skalierung | |
| Testprofil / Testpostfach | |
| Testdatum / Tester | |
| Getestetes XPI: SHA-256 | |
| Anbieter-Testkonten | |

Keine produktiven E-Mails oder Schlüssel für die Abnahme verwenden. Harmloses Testmaterial liegt unter `testdata/`; die synthetischen Erkennungsfälle stehen in `testdata/heuristics.json`.

## Funktion und Datenübermittlung

| Fall | Erwartung | Ist | Status |
|---|---|---|---|
| Frisches Profil, keine API-Schlüssel | Einstellungen speicherbar, lokale Risikobewertung sichtbar, keine externe Anfrage | | |
| Globale Zustimmung aus, alle Stufen | Keine Hash-/Datei-/URL-/IP-Anfrage; lokale Anzeige funktioniert | | |
| Globale Zustimmung an, Absender nicht freigegeben | Öffnen der Nachricht überträgt nichts | | |
| Einmaliger Nachrichtenscan | Nur diese Nachricht freigegeben; vollständige Metadaten, kein dauerhafter Absender-Opt-in | | |
| Absender dauerhaft freigeben | Nur die tatsächliche Absenderadresse gespeichert; Folgemails beachten Stufe und manuellen Modus | | |
| Absenderfreigabe in Einstellungen entfernen | Künftige Nachrichten dieses Absenders bleiben lokal | | |
| Berechtigungsdialog offen oder abgelehnt | Zustimmung bleibt gesperrt; keine Anfrage während des Dialogs | | |
| Nur konfigurierte Anbieter | Kombinierte Berechtigungsanfrage enthält nur deren benötigte Origins | | |
| Strict / Balanced, Link anklicken | Keine vollständige URL an urlscan.io oder Hybrid Analysis | | |
| Maximum, autorisierter Link | URL-Übermittlung nur mit Zustimmung und Host-Recht; Sichtbarkeit des Dienstes wird erklärt | | |
| Immer manuell | Keine automatische externe Analyse; ausdrückliche manuelle Aktionen bleiben stufengebunden | | |
| Zustimmung während einer Prüfung widerrufen | Laufende/wartende Anfragen werden abgebrochen; keine weiteren Provider-Anfragen starten | | |
| Fehlendes Host-Recht / Offline / HTTP 429 | Keine unauffällige Bewertung aus einem Fehler; nachvollziehbarer Status | | |
| Link normal / Strg / Cmd / mittlere Taste / Enter | Navigation wartet auf Prüfung und eine ausdrückliche Öffnen-Aktion; keine doppelte Navigation | | |
| Linkdialog: Escape, Tab, Shift+Tab | Abbrechen und Fokusführung funktionieren; Warten ist abbrechbar | | |
| Während Linkprüfung Nachricht wechseln | Keine Entscheidung für die vorherige Nachricht öffnet einen Link | | |
| HTML-Anhang ohne API-Schlüssel | Lokale Bereinigungsaktion sichtbar; Download enthält keine aktiven Elemente oder Remote-Ressourcen | | |
| Anhang über 25 MiB | Als Größenlimit gekennzeichnet, nicht automatisch gelesen/hochgeladen | | |
| Viele Anhänge/Links | UI bleibt bedienbar; höchstens zwei gleichzeitige Provider-Anfragen pro Host und zwei lokale Anhangarbeiten | | |
| Cache leeren, Popup noch offen | Gespeicherte Ergebnisse und Memory-Caches verschwinden | | |
| Authentifizierung ohne vertrauenswürdigen Server | Kein verifizierter Absenderstatus aus fremden Headern | | |
| Public Suffix / IDN | `shop.co.uk`, getrennte `github.io`-Mandanten und Punycode werden korrekt zugeordnet | | |

Die tatsächlichen Provider-Ziele und Payload-Arten beobachten, ohne vollständige URLs, Mailinhalte oder Schlüssel in das Protokoll zu kopieren. Provider-Reaktionen können von den gemockten Tests abweichen.

## Sprach- und Layout-Abnahme

Für jede Sprache jeweils Thunderbird 140 ESR und die aktuelle unterstützte Version prüfen. Ein frisches Profil mit der jeweiligen Thunderbird-Sprache verwenden; keine Übersetzung nachladen.

| Sprache | Popup / lokale Ergebnisse | Einstellungen / Datenschutz | Banner / Menüs / Fehler | Tastatur / 200 % Zoom / Dark Mode | Ist / Status |
|---|---|---|---|---|---|
| Englisch | | | | | |
| Deutsch | | | | | |
| Französisch | | | | | |
| Spanisch | | | | | |
| Italienisch | | | | | |
| Polnisch | | | | | |

Zusätzlich `en-GB`, `de-AT`, `fr-CA`, `es-MX` sowie eine nicht unterstützte Sprache prüfen. Regionale Varianten sollen ihren Grundkatalog verwenden; nicht unterstützte Sprachen sollen vollständig auf Englisch erscheinen. Dateinamen, Domains und rohe unbekannte Provider-Kennungen sind keine zu übersetzenden Oberflächentexte.

Polnische Zählanzeigen verwenden neutrale Beschriftungen, etwa „Rozmiar: … B“ und „Liczba zgłoszonych analiz: …“, damit keine falschen Pluralformen entstehen. Sicherheits- und Zustimmungstexte zusätzlich sprachlich gegenlesen.

## Screenshots und Freigabe

Echte Screenshots des Clients unter `docs/screenshots/` ablegen: Einstellungen, lokales Popup, Consent-/Opt-in-Banner, Warnbanner und Linkdialog; mindestens EN/DE und die weiteren vier Sprachen für die Sprachabnahme. Keine DOM-Mockups oder SVG-Platzhalter als bestandene Live-Abnahme verwenden.

Gesamtergebnis: **offen**. Datum, Befunde und Freigabeentscheidung erst nach Durchführung eintragen. Version 1.19.0 wurde als unsignierter GitHub-Release getaggt und veröffentlicht. Die Store-Signierung und diese Live-Abnahme stehen weiter aus.
