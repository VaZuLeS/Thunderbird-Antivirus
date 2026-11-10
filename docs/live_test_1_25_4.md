# Kandidatenprotokoll 1.25.4

Unveröffentlicht. Lokale Teilprüfungen sind keine vollständige Remote-Releaseabnahme. Keine echten Providerkonten oder privaten Nachrichten. Historische Paketnachweise bleiben ihren ursprünglichen Bytes zugeordnet.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| C01 | Unlesbare/hashfehlerhafte Anhänge neben erfolgreicher Linkprüfung | OK | test/scan-jobs.test.js; native Linux-Probe mit ausdrücklich injiziertem API-Fehler |
| C02 | Größenlimit, tatsächliche Dateigröße und 100-Ressourcen-Grenzen | OK | test/scan-jobs.test.js; simulierte API-/Speichergrenzen |
| C03 | Volle Quellenhistorie: keine Provideranfrage, abgeschlossene Revisionen erhalten | OK | test/scan-jobs.test.js; native Nachricht-/Popup-Probe |
| C04 | Sechs Sprachen, getrennte Anbieter- und Umfangsangaben | OK | test/analysis-sources.test.js; test/i18n.test.js |
| C05 | Beide Inlinevarianten und Umfangsprobe je Clientziel im Gate | OK | scripts/release-integrity.test.js; negative Gatefälle, keine Remote-Ausführung daraus abgeleitet |
| C06 | Öffentliche Downloadversion unabhängig vom Kandidaten | OK | scripts/pre-submit-checks.test.js; docs/distribution.json |
| C07 | Konservativer Inhaltsvertrag, keine Migration | OK | test/cache-lifecycle.test.js; IDENTITAETSVERTRAG_2026_11_10.md |
| C08 | Vollständige aktuelle Node-/Lint-/Paketregression | OK | 1.278 Node-Tests; Lint 0 Fehler/39 kuratierte Warnungen; verifiziertes Paket |
| C09 | Vollständige Browsermatrix und 200-%-Zoom für sechs Sprachen | OK | Alle sechs Browser-/Zoomjobs im vollständig erfolgreichen Kandidatenlauf [42736341784](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/42736341784) |
| C10 | Mindest-/aktuelle Linuxlinie, sechs Sprach-Upgrades und Crashprüfungen | OK | Beide nativen Ziele und paketgebundenes Kandidatengate im vollständigen Lauf 42736341784 erfolgreich |
| C11 | Dauerhafte Releaseassets einschließlich acceptance-1.25.4.json | OFFEN | Erst nach vollständigem Kandidatengate; keine Veröffentlichung behauptet |
| C12 | OpenPGP-Entschlüsselung, S/MIME-Signatur und konservativer S/MIME-API-Umfang | OK | audits/development-2026-11-10.json; echte Schlüssel im isolierten Linux-Profil, kein vollständiger S/MIME-API-Klartextzugriff |
| C13 | Kontrollierter IMAP-Eingang mit echter Quellenspeicherung | OK | audits/development-2026-11-10.json; echter Loopback-Dovecot, keine allgemeine Retention-/Restorezusage |

**Summe:** 12 OK / 0 FAIL / 0 N/A / 1 OFFEN

Echte Anbieter, Windows/NVDA, macOS/VoiceOver, unabhängiger Sprachreview, öffentlicher Pages-Abruf und ATN-Updates bleiben eigenständige Abnahmen. OPENED bestätigt nur Thunderbirds Öffnungsannahme; PENDING bleibt nach Prozessverlust offen.
