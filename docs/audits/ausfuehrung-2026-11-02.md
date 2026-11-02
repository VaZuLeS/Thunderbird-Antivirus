# Abschlussprotokoll zur Ausführung am 2. November 2026

Ausgangscommit `6046fe0427f53e12377c167e98385e57f533c790`; [detaillierte Aufgabenliste](../AUSFUEHRUNG_AUFGABEN_2026-11-02.md). 44 von 53 Unteraufgaben ausgeführt; neun benötigen zusätzliche reale Systeme, Zugänge oder öffentliche Erreichbarkeit. Kein neuer Release/Tag, keine ATN-Signierung und keine Enterpriseaktivierung werden durch diesen Stand behauptet.

## Implementierung und Versionsidentität

Kandidat 1.24.3, veröffentlichter GitHub-Release weiterhin 1.24.2. [Dateiweiser Releaseabgleich](../RELEASE_ABGLEICH_1_24_3.md). Reproduzierbare Abhängigkeiten/PSL, wiederhergestellte Report-/Authfunktionen mit zusätzlichen Lifecyclegrenzen, übersetzte Auditinformationen, klar getrennte Demo, strengere Gate-/Publishkette, aktualisierte Privacy-/Pagesquellen und expliziter lokaler minimierter Auditreview sind umgesetzt.

Die exakten getesteten Paketbytes wurden erhalten, obwohl ein erneuter Build einen anderen ZIP-Container erzeugte. Beide Container bestanden die Inhaltsprüfung; nur der tatsächlich in Thunderbird installierte Container trägt die beigefügten Live-Nachweise. Bereitgestellt als `build/thundy-av-1.24.3.xpi` und ursprüngliches ZIP, SHA-256 `1c3ba1f8f2f24197c82cb3335dce0901b27f1611c6230665229e16e915778e39`.

## Prüfergebnisse

| Prüfung | Tatsächliches Ergebnis / Grenze |
| --- | --- |
| Frische Installation | npm ci ohne Peer-Umgehung unter Node 24.19.0 und isoliert unter Node 22.23.4 erfolgreich |
| TypeScript/Webdemo | check:web erfolgreich; React/Vite ist die separate Simulation, kein Thunderbird-XPI |
| Vollständiger Check | unter Node 24 und 22 erfolgreich, jeweils 976 Tests, 0 Fehler; Quell-/Katalog-/Vendor-/Designprüfungen, Lint und Paket enthalten |
| Lint/Paket | 0 Lintfehler, 24 bekannte Thunderbird-Warnungen; 44 Dateien / gültiger Inhalt |
| Vollständige Browsermatrix | 600 bestanden, 0 Fehler, sechs Sprachen, Hell/Dunkel, schmale/breite Ansichten, gefüllte/leere Reviews; synthetische Extension-APIs |
| 200 % CSS-Zoom | zusätzlich 12 Einstellungs- und 24 Auditfälle bestanden; kein nativer DPI-/OS-Screenreader-Nachweis |
| Webdemo-Verhalten | [separater Browsertest](demo-review-1_24_3.json): SIMULATED_OPEN, 0 echte Öffnungsversuche, keine externen Requests, alte Demodaten erhalten, Providerfelder deaktiviert |
| Echte Linux-Upgrades | [sechs Sprachprofile](candidate-1_24_3.json), 1.24.2→1.24.3, zwölf saubere Neustarts und zwölf SIGKILL-Wiederanläufe; historische Snapshots/PENDING erhalten |
| Profilrestore | [separater 140-ESR-Lauf](backup-restore-1_24_3.json): sauberes Pre-Upgrade-Backup wiederhergestellt, 1.24.2 und drei frühere Auditdatensätze erhalten; kein Merge späterer Daten |
| Echter Browserpfad | [Chromiumstart und kontrollierter lokaler HTTPS-Abruf](real-browser-1_24_3.json) zusätzlich zu nativer Thunderbird-Annahme; keine allgemeine Browser-/OS-Zertifizierung |
| Risiko/Retention | [neun synthetische Risikofälle](risk-corpus-1_24_3.json) und private PSL-Tenants; [Retentiongrenzen](retention-boundaries-1_24_3.json); keine repräsentative Erkennungsrate |
| Performance | [echte Baseline](../PERFORMANCE_BASELINE_2026-11.md) für ca. 1/5 MiB und 2.000 synthetische Auditfixtures; keine Speicher-/Prozentzusage |
| Gate-/Release-Negativprüfungen | 17 gezielte Fälle einschließlich falscher Evidenz/Quellbytes, schmutzigem Tag-HEAD, Assetabweichung und unklarem Remote-Status erfolgreich |
| Workflow-/Dokumentquellen | CI-/Release-/Pages-YAML geparst, aktive CI/Publish-Referenzkopien identisch; aktuelle lokale Links/Permalinks geprüft; kein lokaler Jekyll-Build mangels Ruby/Jekyll |
| Paketgebundene Evidenz | candidate-evidence.js meldet ok:true; Quellfingerprint und exakte ZIP-/XPI-SHA stimmen mit sechs Sprachberichten und vollständiger UI-Matrix überein |
| Vollständiger Kandidatengate | Exit 0, C1–C7 PASS auf Implementierungscommit d84fb2f; keine Kommandos übersprungen, kein Neubuild der getesteten Bytes. GO gilt für den Kandidaten, nicht als Release-/ATN-Freigabe |
| Remote-CI / öffentliche Pages | separater Nachweis nach Übernahme erforderlich; öffentliche Pages-/ATN-Leseversuche hier nicht zugänglich |

Eine erste Gesamtprüfung traf einen bestehenden 20-ms-Testdeadlinefall vor dem eigentlich zu prüfenden AWS-Readback. Der Test verwendet nun ein realistisches Zeitbudget und verlangt ausdrücklich, dass der Readback erreicht wurde; der vollständige Node-22-/24-Check danach bestand. Eine lokal erzeugte Python-Cacheablage wurde vor der Paket-/Testprüfung entfernt. Fehlgeschlagene Harnessläufe bei der großen Nachricht und dem neuen echten Browserpfad sind nicht als PASS gewertet; Ursachen und erfolgreiche vollständige Wiederholung sind in den jeweiligen Untersuchungsdokumenten beschrieben.

## Noch benötigte Voraussetzungen

- Windows-/macOS-Testumgebung und weitere Standardbrowser, native DPI/High Contrast; echte NVDA-/VoiceOver-Prüfung samt tatsächlichen Ansagen.
- Fach-/Muttersprachreview zusätzlich zur kompletten automatisierten Sechssprachprüfung.
- Erreichbare öffentliche Pages-/ATN-Ressourcen, Maintainer-ATN-Zugang und geeigneter automatischer Distributionskanal mit zwei Versionen. Aktuelle Umgebung meldet keine dafür eingerichteten Secrets/Identitäten; kein globales Fehlen beim Maintainer behauptet.
- Echte Provider-Testkonten, erlaubte Artefakte und Netzfreigaben für Liveverträge.
- Für genau einen Enterprisepilot: Betreiber, Daten-/Retention-/Rollenfreigaben, ausgewählte Testmandanten/IdP/Storage/MDM-Ziele und entsprechende Identitäten. Keine Produktivparameter erfunden.

Die ausführbare lokale Arbeit ist nicht durch diese Voraussetzungen blockiert geblieben. Die verbleibenden neun Teilaufgaben sind in der Aufgabenliste offen und mit konkreten Gründen versehen.

Lokale Detailprotokolle und fehlgeschlagene Ausgangsläufe liegen unter `/workspace/scratch/thundy-*`; die wesentlichen positiven Ergebnisse und Grenzen sind in diesem Repository dauerhaft referenziert. Personenbezogene Profile/Prozesskennungen wurden aus den dauerhaft gespeicherten Clientberichten entfernt.
