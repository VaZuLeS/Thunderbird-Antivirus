# Veröffentlichung 1.25.4 — 10. November 2026

[GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.4), reguläre unveränderte GitHub-Distribution ohne ATN-Signatur. [Freigabepipeline](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/42847499890) erfolgreich. Tag `v1.25.4` zeigt auf `2fe23aa95f23938dfa3dad923db1b6927512d16a`. Der [maschinenlesbare Veröffentlichungsnachweis](audits/release-1.25.4.json) trennt Paketidentität, Umgebung und Grenzen.

## Unabhängig gelesene Assets

XPI, `SHA256SUMS.txt` und `acceptance-1.25.4.json` wurden nach Veröffentlichung erneut über HTTPS heruntergeladen. XPI-Manifestversion, tatsächlicher Pakethash, Prüfsummeninhalt, Nachweiscommit und paketgebundene vollständige Pflichtmatrix stimmen überein.

XPI-SHA-256: `df7220351b039e49975ac2d25e4df777c2f97131a4a022fb5b0272c7e55a253e`

[Download XPI](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/download/v1.25.4/thundy-av-1.25.4.xpi) · [Prüfsumme](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/download/v1.25.4/SHA256SUMS.txt) · [Dauerhafter Abnahmebeleg](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/download/v1.25.4/acceptance-1.25.4.json)

Das Protokoll im unveränderlichen Tag dokumentiert den Stand vor der Asseterstellung und lässt C11 deshalb noch offen. Das aktuelle [Abnahmeprotokoll](live_test_1_25_4.md) schließt diesen Punkt erst nach dem unabhängigen Download.

Der Beleg ist zusätzlich zum XPI ein dauerhaftes Releaseasset und bleibt nach Ablauf der temporären CI-Artefakte abrufbar. Er ist bereinigt und selbst nicht signiert. Eine Prüfsumme ersetzt keine Store-/Autorsignatur. Die bisherigen 1.25.3-Assets wurden nicht verändert.

## Ergebnis und tatsächlicher Prüfumfang

- Explizite Ressourcenabdeckung, begrenzte Auftragsannahme und konkrete Startfehler erhalten erfolgreiche Teilbefunde und bestehende Historie. Unvollständige Prüfungen werden nicht vollständig dargestellt.
- Beide Inlinevarianten, Sicherheitsfreigabe, Quellenexport, positive OpenPGP-/S/MIME-Signaturfälle und konservative Behandlung opaker S/MIME-Hüllen gehören zur aktuellen Pflichtmatrix.
- Vollständige Node-/Source-/Lint-/Paketprüfung, sechs Browser-/Zoomsprachen und die beiden deklarierten Linux-Clientziele bestehen. Native Anbieterantworten in diesen Prüfungen sind synthetisch.
- Echte IndexedDB-Abbrüche, parallele aktuelle Writer, Startfehlerfreigabe und vollständiger Profilrestore sind im dokumentierten Umfang geprüft. Der Exportbutton hat direkt nach erneutem Aktivieren volle Deckkraft; der vorherige Kontrastübergang ist deterministisch abgesichert.
- Ergänzende lokale native Läufe mit genau denselben Paketbytes: [IMAP-Lifecycle](audits/final-1.25.4-imap.json) und [Browser-/HTTPS-Übergang](audits/final-1.25.4-browser.json). Der Browsernachweis betrifft einen isolierten Chromium-Prozess und eine kontrollierte lokale HTTPS-Seite.

## Verbleibende Grenzen

OPENED bleibt ausschließlich Thunderbirds angenommene Öffnungsanforderung; die zusätzlichen Browserbeobachtungen ändern die Auditdefinition nicht. PENDING bleibt nach Prozessverlust offen. Der Rückweg ist ein vollständiger Profilrestore, kein verlustfreier In-place-Downgrade; nach dem Backup entstandene Daten sind separat zu sichern.

Die bestehende Nachrichten-Slot-/Scorelücke und sichere Vorkommensmigration bleiben offen. Gleichlautende Header oder nach Neustart wiederverwendete numerische IDs erlauben keine automatische Wiederbindung. Zusätzliche Rechte, neue Löschpolitik und Produktdatenmigration wurden nicht eingeführt.

Live-Anbieterkonten und verifizierte Hybrid-Referenzen, Windows/macOS mit NVDA/VoiceOver, unabhängiger Sprachreview und Qualitätskorpus, ATN/automatische Versorgung sowie ein produktiver Enterprise-Pilot sind nicht durch diesen Release bestätigt. Lokale Profile und Offlinewerkzeuge bleiben von produktiven Integrationen getrennt.

Die sechs Downloadseiten werden erst nach diesem Assetnachweis aktualisiert. Ein öffentlicher Pages-Inhaltslauf bleibt durch die aktuelle Netzrichtlinie blockiert; lokaler Linkabgleich und tatsächlicher Jekyll-Deploymentlauf sind davon getrennt.
