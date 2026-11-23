# Verwalteter Öffnungsschutz und Sicherheitsmeldungen

Thunderbird liest die Richtlinie beim Start. Die Einstellungen zeigen die wirksamen Werte und ihre Quelle. Das lokale Administratorpasswort gilt für die lokalen Einstellungen. Zur Verteilung auf verwalteten Geräten kann die IT Thunderbirds Unternehmensrichtlinie zum Installieren und Sperren von Erweiterungen verwenden.

## Thunderbird Schritt für Schritt einrichten

1. **Pilot vorbereiten.** Thunderbird ab Version 140 und das aktuelle Thundy-Testpaket zunächst in einem eigenen Profil verwenden. Für die Verteilung eine freigegebene Thunderbird-Version und ein freigegebenes XPI mit festem Downloadpfad festlegen. Beim Testpaket mit Anbieterbefunden handelt es sich um einen neuen Entwicklungsbuild von 1.25.9. In einem Testprofil über **Add-ons debuggen → Temporäres Add-on laden** installieren und nach einem Neustart erneut laden.
2. **Richtliniendatei finden.** Auf Windows liegt sie unter **distribution/policies.json** neben der tatsächlich gestarteten thunderbird.exe, häufig unter **C:\Program Files\Mozilla Thunderbird**. Auf macOS liegt sie unter **Thunderbird.app/Contents/Resources/distribution**. Unter Linux kommen **distribution** im Installationsverzeichnis und systemweit **/etc/thunderbird/policies** infrage. Richtlinien gelten für die Installation. Ein anderes Profil derselben Installation übernimmt sie ebenfalls. [Offizielle Pfade und Verteilwege](https://thunderbird.github.io/policy-templates/policies/esr140/)
3. **Datei anlegen oder zusammenführen.** Auf einem Windows-Pilotgerät mit einer administrativen PowerShell bei Bedarf das Verzeichnis anlegen. Vorhandene policies.json sichern. Bei Windows-Gruppenrichtlinien oder macOS-Konfigurationsprofilen die IT-Vorlage prüfen und die Quelle in **about:policies** verifizieren. Genau einen Wurzelschlüssel **policies** verwenden und bestehende Einträge unter **3rdparty** und **Extensions** erhalten. JSON als UTF-8 speichern. Kommentare und abschließende Kommas entfernen. Die Datei mit Administratorrechten schreiben und Verzeichnis sowie Datei vor Änderungen durch Standardbenutzer schützen.
4. **JSON und Richtlinie prüfen.** Unter PowerShell eignet sich **Get-Content -LiteralPath 'C:\Program Files\Mozilla Thunderbird\distribution\policies.json' -Raw | ConvertFrom-Json**. Thunderbird vollständig beenden und neu starten. In **about:policies → Aktiv** nach **3rdparty** suchen und **Fehler** kontrollieren. In Thundy unter **Administration** müssen „Vom Unternehmen verwaltet“ und die bereitgestellte Revision erscheinen. Die Add-on-ID lautet **thundy-av@bludau-it-services.de**.
5. **Konten und Schutz getrennt einrichten.** Testpostfach in Thunderbird hinzufügen und Senden und Empfangen prüfen. Vor dem breiten Rollout auch Zertifikatsvertrauen, System-Proxy, Endpunktschutz und erforderliche Anbieterrechte auf einem typischen Firmengerät prüfen. Die Thundy-Richtlinie verwaltet die Schutz- und Meldefelder. Die Einrichtung von Mailkonten und Analyseanbieter-Schlüsseln erfolgt separat.
6. **Meldungen ausprobieren.** Den internen HTTPS-Empfänger bereitstellen, unter **Sicherheitsmeldungen an das Unternehmen** Datenumfang und Ziel bestätigen, das Geräte-Token eingeben und die Hostfreigabe erteilen. Ohne aktive Anbieteranalyse sind lokale Verdachtsereignisse möglich. Für einen kontrollierten Test im Pilotprofil **suspicious** und eine Linkschwelle von **0** wählen. Eine harmlose HTTPS-Adresse aus einer Testmail anklicken und den Eingang anhand der Ereignis-ID prüfen. Danach Testschwelle zurücksetzen und Thunderbird neu starten.
7. **Verteilen und zurückrollen.** Die überprüfte Datei über Softwareverteilung, MDM oder die offiziellen Thunderbird-Vorlagen auf Pilotgeräte bringen. Für die automatische Installation kann **ExtensionSettings** für diese Add-on-ID **installation_mode: force_installed** und **install_url** auf das freigegebene XPI setzen. Diese Einstellung verhindert Deaktivieren und Entfernen durch Benutzer. Zuerst Installations- und Updatepfad im Pilot prüfen. Für den Rückweg die vorige Richtlinie wieder ausrollen oder nur den eigenen Thundy-Eintrag entfernen und die Clients neu starten. [Thunderbird ExtensionSettings](https://thunderbird.github.io/policy-templates/policies/esr140/#extensionsettings-management-of-extensions)

## Beispiel für policies.json

~~~powershell
$distribution = 'C:\Program Files\Mozilla Thunderbird\distribution'
New-Item -ItemType Directory -Path $distribution -Force
~~~

Den Installationspfad gegebenenfalls anpassen. Das folgende JSON in **policies.json** speichern oder in die gesicherte bestehende Datei einarbeiten.

~~~json
{
  "policies": {
    "3rdparty": {
      "Extensions": {
        "thundy-av@bludau-it-services.de": {
          "thundyPolicy": {
            "schemaVersion": 1,
            "revision": 1,
            "links": { "threshold": 50, "action": "warn", "unknown": "warn" },
            "attachments": { "threshold": 70, "action": "warn", "unknown": "warn" },
            "reporting": {
              "mode": "malicious",
              "endpoint": "https://soc.example.com/thundy/events",
              "indicators": false,
              "details": false
            }
          }
        }
      }
    }
  }
}
~~~

Optional kann bei der zentralen Verteilung im gleichen Objekt **policies** zusätzlich der folgende Abschnitt stehen. Vorhandene **ExtensionSettings** anderer Erweiterungen beim Zusammenführen erhalten.

~~~json
"ExtensionSettings": {
  "thundy-av@bludau-it-services.de": {
    "installation_mode": "force_installed",
    "install_url": "https://software.example.com/thundy/thundy-approved.xpi"
  }
}
~~~

- Jede Schutzgruppe ist optional. Eine leere Gruppe aktiviert die gezeigten Schutzvorgaben. Bei einer ausgelassenen Gruppe gelten die lokalen Einstellungen. Die Schwellen sind ganze Zahlen von 0 bis 100 und gelten einschließlich des angegebenen Werts. Für Aktion und Umgang mit unbekannten Befunden stehen warn und block zur Verfügung.
- Eindeutige Treffer am konkreten Link und aktuelle, zur Datei passende Malwarebefunde werden gesperrt. Beim Anhang basiert der numerische Schwellenwert auf dem Hybrid-Analysis-Befund. Eindeutige Hybrid- und VirusTotal-Erkennungen werden auch ohne numerischen Hybrid-Score berücksichtigt. Link- und Anhangschutz behandeln fehlende oder unvollständige Befunde nach der jeweiligen Einstellung für unbekannte Ergebnisse.
- Thundy prüft Linkaktionen aus der Nachrichtenansicht und seine eigenen Aktionen „Mit Thundy öffnen“ und „Mit Thundy speichern“. Die Wahl im nativen Anhangsmenü sowie der Umgang mit bereits gespeicherten Dateien gehören zum Betriebssystem- und Endpoint-Schutz. Die Annahme durch Thunderbird bestätigt die Übergabeanforderung.
- Bei fehlerhaften Schutzgruppen zeigt Thundy die betroffene Regel als ungültig an und sperrt den betroffenen Öffnungsweg. Nach Korrekturen Thunderbird neu starten. Bei Änderungen an der Firmenrichtlinie die Revision in der Verteilung erhöhen.

## HTTPS-Empfänger und Einrichtung

Für einen eigenen Server gibt es einen eigenständigen Python-Empfänger mit integriertem HTTPS-Server, SQLite-Warteschlange und HTML- sowie Klartext-E-Mails per SMTP. Die Anleitung enthält die Einrichtung, einen Testvorfall und die SMTP-Diagnose. [Python-Empfänger einrichten](../examples/python-receiver/README.md)

reporting.mode ist off als Standard, malicious für bösartige Befunde oder suspicious für bösartige Befunde und erreichte Schwellen. Mindestens eine gültige Firmen-Schutzgruppe ist erforderlich. Thundy meldet die erfassten Versuche für die verwalteten Gruppen. Das Ziel muss HTTPS verwenden und darf weder Zugangsdaten noch Query oder Fragment in der URL enthalten.

1. Im Firmen-Endpunkt pro Installation ein widerrufbares Token mit reiner Schreibberechtigung ausgeben. Über den geschützten Firmenkanal aushändigen. Der Token wird bei der Einrichtung im jeweiligen Thunderbird-Profil hinterlegt.
2. Im Thundy-Adminbereich den angezeigten Empfänger und Datenumfang bestätigen, das Token eingeben und Thunderbird die Hostfreigabe erteilen. Beim Wechsel von Empfänger, Meldemodus oder Datenumfang ist eine neue Zustimmung erforderlich. Der Widerruf im Adminbereich löscht lokale ausstehende Meldungen.
3. Der Empfänger akzeptiert POST mit Content-Type application/json, Authorization Bearer und Idempotency-Key. Er speichert nach erfolgreicher Authentifizierung atomar nach Ereignis-ID und antwortet erst danach mit 2xx. Auch bereits empfangene identische Ereignisse werden mit 2xx quittiert. Die IT legt die Aufbewahrung und Weiterleitung im Firmensystem fest.

~~~json
{
  "schemaVersion": 1,
  "id": "a1c8080d-5c2e-491e-a163-000000000001",
  "observedAt": "2026-11-23T09:00:00.000Z",
  "action": "link_open",
  "finding": "phishing",
  "decision": "block",
  "policyRevision": 1
}
~~~

Weitere Aktionen sind attachment_open und attachment_save. Befunde sind malicious, phishing, malware oder suspicious. Die Entscheidung beschreibt die Wirkung der Regel beim erfassten Versuch.

| Einstellung | Inhalt |
| --- | --- |
| Standard | Ereignis-ID, Zeit in UTC, Aktion, Thundy-Befund, Regelentscheidung und Richtlinienrevision |
| indicators | Zusätzlich Hostname des betroffenen Links oder SHA-256 des Dateianhangs |
| details | Zusätzlich Auslöser, verfügbarer Entscheidungsscore, Schwelle, Dateiname bei einem Anhang und vorliegende Anbieterbefunde zum betroffenen Objekt |

Die beiden Zusatzoptionen sind standardmäßig aus. Beim Ändern ist eine erneute Zustimmung im Profil nötig. Ereignisse enthalten keine Mailtexte, Anhänge, ursprünglichen vollständigen URLs oder Anbieter-API-Schlüssel. Für einen Link lässt sich die Ereignis-ID im lokalen Thundy-Linkprotokoll zum konkreten Ziel zurückverfolgen. Bei einem Anhang helfen Dateiname und Datei-SHA-256. Die Gerätebezeichnung in der E-Mail stammt aus der Token-Zuordnung am Server.

Mit **details: true** enthält **details.providers** Einträge wie im folgenden Anhangsbeispiel. Der Entscheidungsscore steht separat unter **details.score**. Anbieterfelder erscheinen, soweit sie aus einem zugeordneten Befund vorliegen. Bei einem rein lokalen Schwellenereignis ist die Liste leer.

~~~json
{
  "reason": "malicious",
  "score": 91,
  "threshold": 70,
  "attachmentName": "test-attachment.bin",
  "providers": [
    {
      "provider": "hybridanalysis",
      "verdict": "malicious",
      "source": "stored",
      "observedAt": "2026-11-23T08:58:00.000Z",
      "score": 91,
      "reference": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "jobId": "example-job-42",
      "reportUrl": "https://www.hybrid-analysis.com/sample/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    {
      "provider": "virustotal",
      "verdict": "malicious",
      "source": "stored",
      "maliciousCount": 3,
      "suspiciousCount": 1
    }
  ]
}
~~~

- **Hybrid Analysis:** Bei vorhandenem SHA-256 verweist der Anbieterlink zur Sample-Übersicht für die analysierte URL oder Datei. Die optionale Job-ID hilft bei der Zuordnung. Die Hash-Übersicht kann mehrere Läufe enthalten. Reine Schnellscans können ohne SHA-256 vorliegen, und private Berichte können Anmeldung oder passende Kontorechte erfordern. [Offizieller Hybrid-Analysis-Client](https://github.com/hybrid-analysis/VxAPI)
- **urlscan.io:** Ein verfügbarer Scan-UUID verweist auf die konkrete Ergebnisseite. Die Sichtbarkeit richtet sich nach dem Scan. Historische Befunde erscheinen gegebenenfalls ohne Link, wenn die frühere Scan-ID fehlt. [urlscan-Ergebnisdokumentation](https://urlscan.io/docs/result/)
- **VirusTotal:** Für Anhänge meldet Thundy die vorliegenden Trefferzahlen aus dem Datei-Hash-Lookup. Die Anbieterbewertung und der lokale Auslöser bleiben getrennt.

Thundy puffert bis zu 100 Ereignisse für längstens 24 Stunden. Netzwerkfehler, HTTP 408, 429 und Serverfehler werden mit Backoff und derselben Ereignis-ID erneut versucht. HTTP 401 und 403 pausieren die Zustellung bis zum Austausch des Tokens. Abgelaufene oder endgültig abgelehnte Meldungen erscheinen als Status in den Einstellungen. Entscheidungen über Öffnen und Speichern werden lokal getroffen.

Für den Pilot die obigen Warnschwellen verwenden, die Erfassung mit einem internen Testempfänger prüfen und anschließend Fehlalarme und Rückstau auswerten. Bei Bedarf jeweils für Links und Anhänge getrennt auf block umstellen.

[Thunderbird-Unternehmensrichtlinien](https://thunderbird.github.io/policy-templates/policies/esr140/)
