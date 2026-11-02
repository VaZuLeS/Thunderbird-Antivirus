# Prüfprotokoll zur Produktanalyse am 2. November 2026

Bezug: [Bestandsaufnahme und Aufgabenplan](../PRODUKTANALYSE_AUFGABENPLAN_2026-11-02.md). Untersucht wurde Commit `6046fe0427f53e12377c167e98385e57f533c790`, Branch `work`, nach Fetch identisch mit `origin/main`. Alle Ergebnisse beziehen sich auf diesen Quellstand; hinzugefügt wurden nur Analysedokumente.

## Lokale Umgebung und Befehle

Linux, Node 24.19.0; Bestandsmodule Vite 6.4.4 und tldts 7.4.10. Aktive CI konfiguriert Node 22. Keine erfolgreiche frische Abhängigkeitsinstallation. Kein echter Thunderbird-Lauf in dieser Analyse.

| Befehl | Ergebnis |
| --- | --- |
| `git status --short` vor Dokumenterstellung | leer |
| `git fetch origin main --tags` | erfolgreich |
| `git rev-parse HEAD origin/main` | beide `6046fe0427f53e12377c167e98385e57f533c790` |
| `npm ci` | Exit 1, ERESOLVE: Vite 8.3.5 gegenüber Peerbereich Vite 4–7 von @vitejs/plugin-react 4.7.0 |
| `npm run check` | Exit 1; pre-submit und i18n erfolgreich; check:vendor meldet „Installed tldts does not match the pinned version“; spätere Checks in diesem Lauf nicht ausgeführt |
| `npm test` separat | Exit 0; 953 Tests bestanden, 73 Suiten, 0 fail/cancelled/skipped/todo; 104808 ms |
| `npm run check:design` separat | Exit 0; CSS und Designreferenz entsprechen ihren Quellen |
| `npm run lint:filtered` separat | Exit 0; 0 Fehler, 0 notices, 24 bekannte Thunderbird-Warnungen |
| `npm run package` separat | Exit 0; 44 Dateien, 775058 Bytes entpackt; Paket `build/thundy_av_email_scanner_for_thunderbird-1.23.0.zip`, Inhalt gültig |
| `node scripts/submission-gate.js --no-commands` | Exit 1; C1–C4 SKIP, C5 PASS anhand vorhandener Aufnahmen, C6 PASS anhand 25 OK im vorhandenen 1.23.0-Protokoll; C7 FAIL |
| `npm run check:ui -- --matrix smoke --browser /usr/bin/chromium --out /workspace/scratch/thundy-ui` | Exit 0; 34 bestanden, 0 fehlgeschlagen; Smoke-Modus EN/DE, systemweites Chromium, API-Testdoubles |
| `git diff --check` | erfolgreich; neue Dokumente zusätzlich auf Struktur/Verweise geprüft |

C7 nennt folgende seit Tag v1.23.0 geänderte Paketdateien: `api.js`, `audit.html`, `audit.js`, `background.js`, `enterprise_setup.html`, `onboarding.html`, `options.html`, `risk.js`, `sanitize.js`. Die C7-Implementierung prüft Commitdifferenzen; sie ist kein vollständiger Release-/Arbeitsbaumnachweis.

Vollständige lokale Laufzeitlogs liegen unter `/workspace/scratch/thundy-{install,check,tests,gate,ui}.log`. Chromium-Detailbericht: `/workspace/scratch/thundy-ui/2026-11-02T02-27-00.737Z-3ba83442/report.json`. Scratch-Dateien sind ergänzende Arbeitsartefakte; die wesentlichen Ergebnisse und Einschränkungen sind hier dauerhaft zusammengefasst. Test-/Lint-/Paket-Erfolge mit Bestandsmodulen sind keine Freigabe des deklarierten Dependency-Baums.

## GitHub-Prüfungen

- Repository-Metadaten: öffentlich, Standardbranch main. Offene PRs wurden als Vorschläge behandelt, insbesondere #668 als möglicher Ursprung des veröffentlichten neueren Funktionsstands. Es wurde kein PR verändert oder als eigene Arbeit übernommen.
- [Release latest](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.2): nicht draft, nicht prerelease, veröffentlicht am 17. Oktober 2026 um 08:43:10 UTC. Asset `thundy-av-1.24.2.xpi` und `SHA256SUMS.txt` vorhanden. XPI-API-Digest `sha256:f7376f3c97e89d878eed25bb6737928a3e789829c7cd4b450ae6db49056267a9`; kein eigener neuer Assetdownload oder Signaturtest.
- Lokales `git show v1.24.2:manifest.json` bestätigt 1.24.2; `git log -1 v1.24.2` zeigt Commit `26fb960`. `git diff v1.24.2..HEAD -- api.js background.js providers.js api_gateway.js` belegt die im Plan benannten fehlenden Report-/Authpfade. Eine Absicht oder konkrete aktuelle Providerstörung wurde daraus nicht abgeleitet.
- [CI am main-SHA](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41166499534): completed/failure. Job `test` (ID 124435100663) scheitert bei Install dependencies; heruntergeladener Joblog bestätigt ERESOLVE/Vite 8.3.5 versus React-Plugin-Peerbereich. Alle sechs Browserjobs scheitern ebenfalls bei npm ci; nachgelagerter Linux-Thunderbird-Job skipped. Fehlende Browserartefakte sind Folge des Installationsabbruchs.
- [Pages-Deployment](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41166449443): completed/success, SHA `0599c6a9a77df12d62d516d4431d10accfc02640`, abgeschlossen am 31. Oktober 2026. Aktiver Workflow baut Jekyll aus docs/.
- Direkte Webwerkzeug-Leseversuche für `https://vazules.github.io/Thunderbird-Antivirus/` und `/privacy_policy.html` lieferten „not accessible“. Kein Nachweis eines Websiteausfalls; öffentliche HTTP-/Inhaltsprüfung bleibt offen. Kein Umgehen einer Netzwerkbeschränkung.

## Geltungsbereich historischer Nachweise

`docs/audits/thunderbird-140-repeat.json` nennt passed:true, Linux X11 GUI, synthetische Klartextnachricht, offline, ohne API-Mocks, Thunderbird 140.17.0, Add-on 1.23.0 und konkreten XPI-Hash. Weitere Sprach-/Upgrade-/Crashberichte liegen daneben. Das sind echte damalige Thunderbird-Nachweise; sie wurden in dieser Analyse gelesen, nicht wiederholt. Sie decken Windows/macOS, reale Screenreader, automatischen ATN-Updatekanal oder alle aktuellen main-Änderungen nicht ab.

## Dokumentprüfung

Der Plan enthält 17 stabile neue Aufgaben-IDs mit Hauptzuordnung und Entwicklungstyp, belegtem Befund, Ziel, Umfang, Prioritätsbegründung, Aufwandsklasse, Abhängigkeiten, Akzeptanz und Testumgebung. Historische IDs/Pläne bleiben erhalten. Produktcode, Workflows, Dependencydateien, Tags, Releases und externe Integrationen wurden nicht geändert.
