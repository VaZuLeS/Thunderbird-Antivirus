# Diagnose, Fehlerprotokoll und Support-Informationen

## Wofür das gedacht ist

Wenn im Live-Betrieb etwas nicht funktioniert, soll die Ursache **im Produkt sichtbar** sein — nicht nur in einer
Konsole, die niemand liest. Genau dort lag das „Unknown“-Problem: ein Fehler wurde vom `catch` verschluckt.

## 1. Selbsttest (Optionen → *Diagnose / Selbsttest*)

Ein Klick prüft 13 Voraussetzungen und zeigt ✅ / ⚠ / ❌ je Punkt:

| Punkt | Was geprüft wird |
|---|---|
| Zustimmung | ob „Externe Analyse erlauben“ aktiv ist |
| API-Schlüssel | ob ein Hybrid-Analysis-Schlüssel hinterlegt ist |
| Host-Berechtigungen | für alle fünf Anbieter (Hybrid Analysis, VirusTotal, urlscan.io, URLhaus, AbuseIPDB) |
| Zeitverzögerte Ergebnisabfrage | ob `alarms` verfügbar und ein Alarm geplant ist |
| Banner in der Nachrichtenansicht | Injektionsweg (registriertes Nachrichten-Script **oder** Injektion je Nachricht) + Grund |
| Link-Schutz (Time-of-Click) | Modus (`off`/`hint`/`confirm`), Bestätigungsziel und in wie vielen Frames das Guard-Script läuft |
| Ergebnisspeicher | IndexedDB erreichbar |
| Verlauf | aktiv/inaktiv und Anzahl Einträge |
| Offene Aufträge | wie viele zeitverzögerte Analysen laufen |
| Enterprise-Policy | aktive verwaltete Schlüssel |
| **Fehlerprotokoll** | Anzahl Fehler und Warnungen |

Es werden dabei **keine** Daten übertragen.

## 2. Fehlerprotokoll (Optionen → *Fehlerprotokoll*)

- Jeder `Logger`-Aufruf (error/warn/info) schreibt zusätzlich in `diagnosticLog` in `storage.local`
  (Ringpuffer, max. 100 Einträge, je Eintrag Zeitstempel/Level/Nachricht).
- Im Optionsdialog: Filter **alle / nur Fehler / nur Warnungen**, **Protokoll exportieren** (Textdatei) und
  **Protokoll löschen**.
- Schreibvorgänge werden serialisiert, damit bei Fehlerkaskaden keine Einträge verloren gehen.
- Bei Problemen bitte exportieren und an den Maintainer schicken — das ersetzt das Rätselraten.

## 3. Demo-/Screenshot-Modus (`?sample=1`)

Für Store-Screenshots ohne echte Nachrichtendaten:

```
<<Erweiterungs-ID-URL>>/popup.html?sample=1
<<Erweiterungs-ID-URL>>/options.html?sample=1
```

Die Erweiterungs-URL erhält man in `about:debugging#/runtime/this-thunderbird` beim Add-on unter *Manifest-URL* bzw.
indem man das Add-on-Popup öffnet und die URL aus der Adresszeile kopiert.

Der Modus füllt die Oberfläche mit Beispieldaten (Bewertung 87/100, Forensik-Befunde inkl. MITRE-Tags, Link-Liste mit
dekodiertem Punycode, Ergebnis-Panel mit offenen/fertigen Prüfungen, Forscher-Panel, Bericht-Export sowie ausgefüllte
Einstellungen), kennzeichnet die Ansicht mit einem **DEMO-Band** und:

- liest **keine** echten Nachrichten,
- speichert **nichts** (kein Feld wird persistiert),
- überträgt **nichts** an Anbieter.
