# Veröffentlichung 1.25.6 — 11. November 2026

[GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.6) mit unveränderlichen Assets. [Release-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/42995168820) vollständig erfolgreich. Tag v1.25.6: `e75aaee6fe49506c4d5efd1062bb47f2350b59fc`. [Maschinenlesbarer Veröffentlichungsnachweis](audits/release-1.25.6.json).

XPI, SHA256SUMS.txt und acceptance-1.25.6.json wurden nach Veröffentlichung unabhängig über HTTPS heruntergeladen. Manifestversion, tatsächliche Bytes, Prüfsumme, GitHub-Digests, Quellfingerprint, Tagcommit und vollständige Pflichtmatrix stimmen überein. XPI-SHA-256: `10b74ef475555ac27bce5d4d042695ac908cb942d3084d9cbe1ee1610b8453f0`.

## Korrigierter Funktionalitätskern

Ein gespeicherter ausstehender Hybrid-URL-Bericht konnte in einer geöffneten Quellenansicht veraltet bleiben, obwohl der lokale Befundpfad bereits einen später gespeicherten fertigen Bericht las. Der Abgleich übernimmt jetzt belegte gespeicherte Aktualisierungen ohne zusätzliche Anfrage oder künstlich erhöhte Antwortzähler. Laufende/live und fehlgeschlagene Prüfungen, ältere Beobachtungsstände sowie historische Entscheidungen behalten ihre Bedeutung. Ein separat gespeichertes Hybrid-URL-Urteil bleibt neben einem unfertigen Rohbericht sichtbar; der Bericht bleibt dabei ausstehend.

Quellenarchivierungsfehler nennen einen festen übersetzten Grund. Eine fehlgeschlagene Speicherung ohne Anbieterzeilen wird als unbestätigter dokumentierter Prüfstand dargestellt. Die Übersicht unterscheidet unvollständige Dokumentation von unvollständiger Analyse. Bereits belegte Anbieterurteile bleiben sichtbar, auch wenn 64 Quellenrevisionen eine weitere Archivierung verhindern. Keine automatische Löschung oder neue Einwilligung. Der Leerlaufhinweis bezieht sich ausdrücklich auf den aktuellen Auftrag dieser Ansicht.

[Releaseumfang](releases/1.25.6.md), [Abnahmeprotokoll](live_test_1_25_6.md), [getrennte Entwicklungsnachweise](HYBRID_QUELLENAKTUALISIERUNG_1_25_6.md). Beide deklarierten Linuxlinien, sechs Browser-/Zoomsprachen, native Quellen-/Popup-/Speichergegenprobe, Upgrade von 1.25.5, Crash und Profilrestore bestehen für die aktuellen Paketbytes. Der Dateidialoghelfer wartet auf das fertig geladene Dokument und den tatsächlich angezeigten nativen Dialog. Fertiger Download und tatsächlicher Inhalt bleiben Pflicht.

Der unveränderliche Tag lässt den nachgelagerten öffentlichen Assetabruf C12 noch offen; dieses aktuelle Protokoll schließt ihn erst nach dem unabhängigen Download. Frühere Releaseassets bleiben unverändert. Die bereinigten Belege sind selbst nicht signiert; eine Prüfsumme ersetzt keine ATN-/Autorsignatur.

## Aussagegrenzen

Der konkrete Nutzerbericht muss weiterhin mit der angefragten bereinigten Originalantwort abgeglichen werden. Die reproduzierten Providerdaten sind synthetisch; keine Live-Kontoabnahme oder neue belegte Kennungsroute wird behauptet. Nachrichtenidentität und Datenmigration bleiben separate Aufgaben. OPENED bleibt Thunderbirds Öffnungsannahme; PENDING bleibt nach Prozessverlust offen. Externe Dienste und Enterprise bleiben optional. Windows/NVDA, macOS/VoiceOver, menschlicher Sprachreview und ATN-/automatische Updates bleiben gesonderte offene Abnahmen. Öffentliche Pages-Inhalte werden getrennt von Deployment und GitHub-Assets geprüft.

Die Werkzeugkette verwendet den regulären node-forge-Updatepfad 1.4.2 → 1.4.3 ohne Override. Das frische Audit und die Quellen-/Lint-/Paketprüfung sind [separat dokumentiert](audits/tooling-audit-2026-11-11.json); node_modules gehört nicht zum XPI.
