# Veröffentlichung 1.25.7 — 11. November 2026

[GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.7) mit unveränderlichen Assets. [Release-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/43064322166) vollständig erfolgreich. Tag v1.25.7: `6f31dc2bba149f106362df8dfd6d0fc68ee79322`. [Maschinenlesbarer Veröffentlichungsnachweis](audits/release-1.25.7.json).

XPI, SHA256SUMS.txt und acceptance-1.25.7.json wurden nach Veröffentlichung unabhängig über HTTPS heruntergeladen. Manifestversion, tatsächliche Bytes, Prüfsumme, GitHub-Digests, Quellfingerprint, Tagcommit und vollständige Pflichtmatrix stimmen überein. XPI-SHA-256: `4d397e08bf3d27e038221ea0222b90b0d135ef46d5572152dcf014fb16be55c7`.

## API-Diagnose und Hybrid-Abruf

Der standardmäßig ausgeschaltete API-Debugmodus zeichnet neue Versuche nach ausdrücklicher Aktivierung lokal auf. In den Einstellungen stehen Vorschau, JSON-Export und Leeren zur Verfügung. Bei gesetztem Adminpasswort prüfen Hintergrundbefehle dieselbe dokumentgebundene, ablaufende Adminsitzung für Änderung und Berichtzugriff. Ein Popup darf begrenzte Diagnosen hinzufügen, den Bericht aber nicht lesen. Schlüssel, private URLs, Nachrichtentexte, Rohantworten und freier Fehlertext werden ausgelassen; Kennungen werden innerhalb getrennter Kontexte pseudonymisiert. Die Aufzeichnung ist zeitlich und mengenmäßig begrenzt, bleibt im Arbeitsspeicher und wird beim Ausschalten geleert. Laufende Tickets können geleerte Daten nicht wiederherstellen.

Ein reproduzierter Hybrid-Gegenfall mit verschiedenen Quick-Scan-, Submission- und Sandboxkennungen wurde korrigiert. Neue Antworten erhalten zusätzlich die Quick-Scan-ID; automatische, manuelle und Time-of-Click-Abrufe bevorzugen sie auf der passenden Route. Der offizielle Anbieterclient belegt getrennte Quick-Scan-/SHA-Routen. Legacydaten werden nicht migriert oder als nachträglich verifiziert ausgegeben. Kein neuer Upload oder automatischer POST-Retry.

[Bedienung, Internetquellen und Grenzen](API_DEBUGMODUS_1_25_7.md), [Releaseumfang](releases/1.25.7.md), [Abnahme](live_test_1_25_7.md). Beide deklarierten Linuxlinien bestehen die native Admin-, Hintergrund-, Popup- und Dateiexportprobe mit synthetischem Transport. Die sechs Browser-Sprachjobs prüfen die neuen Bedienelemente einschließlich Tastatur und Zoom. Upgrade von den gepinnten öffentlichen 1.25.6-Bytes, Crash, Profilrestore und die übrigen Pflichtfälle gehören zum aktuellen Paket.

Der unveränderliche Tag lässt den öffentlichen Assetabruf C12 noch offen; das aktuelle Protokoll schließt ihn erst nach dem unabhängigen Download. Frühere Releaseassets bleiben unverändert. Bereinigte Abnahmebelege sind selbst nicht signiert; Prüfsummen ersetzen keine ATN-/Autorsignatur.

## Aussagegrenzen

Der konkrete ursprüngliche Hybrid-Fall benötigt weiterhin seine tatsächliche Antwort beziehungsweise einen neuen Debugbericht. Kein tatsächlicher Anbieterzugang wurde mit synthetischem Transport abgenommen. HTTP-Erfolg ist kein abgeschlossenes Sicherheitsurteil. Nachrichtenidentität und Datenmigration bleiben separate Aufgaben. OPENED bezeichnet Thunderbirds Öffnungsannahme; PENDING bleibt nach Prozessverlust offen. Externe Dienste und Enterprise bleiben optional. Windows/NVDA, macOS/VoiceOver, menschlicher Sprachreview und ATN-/automatische Updates bleiben eigenständige offene Abnahmen. Öffentliche Pages-Inhalte werden getrennt von Deployment und GitHub-Assets geprüft.
