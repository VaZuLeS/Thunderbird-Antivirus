# Freigabeumfang 1.24.5 — Analyseergebnisse

Ziel ist die **unsignierte GitHub-Distribution 1.24.5** mit dem Fix für den wiederholt gemeldeten Ladefehler. Tatsächlicher [Veröffentlichungsstatus, XPI und Prüfsumme](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.5). Ein PR, vorbereiteter Tag oder dieses Dokument allein bestätigt keine Veröffentlichung. [1.24.4](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.4) und seine Assets bleiben unverändert erhalten.

## Behobener Fehler und Darstellung

- [Robustes Laden gespeicherter Hybrid-Analysis-Protokolle](HOTFIX_ANALYSEERGEBNISSE_1_24_5.md): abweichende optionale Tags-/Scanner-/AV-Felder führen nicht mehr zum Abbruch des gesamten Ergebnisbereichs. Ein unlesbarer Einzelbericht verdrängt seine Nachbarn nicht. Fehlende Werte bleiben unbekannt; ursprüngliche Protokolle und Entscheidungen werden nicht umgeschrieben.
- Gemeinsame sichtbare Dienstkarten für **Hybrid Analysis, VirusTotal, URLhaus, AbuseIPDB und urlscan.io** im Toolbar-Popup und direkt in der Nachricht. Die aus Antworten klassifizierten Ergebnisse, Anfragezustände und Herkunft sind getrennt sichtbar; Details erhalten Ressource und ursprüngliche Zeit. Ein übermittelter Auftrag ist kein fertiges Ergebnis; Fehler und leere Antworten sind keine Entwarnung.
- [Ressourcengebundene Berichtsschaltflächen](BERICHTSAKTIONEN_1_24_5.md): getrennte IDs/Statuszeilen bei gleichen Anhanghashes, tatsächliche Bindung im Dokumentfragment, passender Anhang-/URL-Rescan und lokale HTML-Bereinigung. Unbekannte Bindungen bleiben ohne aktive Scanaktion.
- Neue Hinweise in EN/DE/FR/ES/IT/PL; gemeinsame Themefarben, helle/dunkle Darstellung, responsive Karten und bestehende Tastatur-/Fokuslogik. Die Darstellung aktiviert keinen Anbieter und löst selbst keine zusätzliche Anfrage aus.

Die allgemeine Meldung bezeichnete einen App-Ladefehler, nicht zwingend einen Fehler des Hybrid-Analysis-Servers. Der konkrete Nutzerbericht wurde nicht eingesehen; derselbe Fehlerpfad wurde mit dem öffentlichen 1.24.4-XPI und kontrollierten gespeicherten Protokollen in echtem Thunderbird reproduziert. Dieser Fix ist keine Garantie gegen alle zukünftigen Lade-, Speicher- und API-Fehler.

## Paketgebundene Prüfung und Auslieferung

Der endgültige Kandidat besitzt SHA-256 **`283ad4dd941b31058dee8762ccd3ed945527e323b57f7b9552e593bd9d249035`** und Source-Fingerprint **`14a665e62f2610a87768b0431976f69a938545cca6546e14cddbbc1ab99e231e`**. Die lokalen [Folgenachweise](audits/report-controls-2026-11-04.json) dokumentieren die endgültigen Bytes und getrennte Vorher-/Nachher-Proben. Der [erste Fixnachweis](audits/hybrid-popup-fix-2026-11-04.json) bleibt ausdrücklich an seinen früheren Kandidaten gebunden.

[PR #741](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/741), [geprüfte Implementierungs-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41856333140): **1.076 Tests**, sechs Browser-Sprachjobs, 18 native Linux-Clientberichte und Kandidatengate erfolgreich. Native lokale Endproben unter Thunderbird **140.12.0 und 153.6.0** prüfen Berichte in Popup/Nachricht, getrennte Aktionen, echte lokale HTML-Dateispeicherung und unveränderte Berichtspayloads. Upgrade von 1.24.4, drei normale und zwei SIGKILL-Neustarts sowie sauberer Profilrestore unter 153 sind gesondert geprüft.

Die Freigabedokumentation ändert keine Paketnutzdaten. Der aktive Tagworkflow `.github/workflows/release.yml` führt trotzdem die vollständige CI auf dem getaggten Stand erneut aus. Erst nach erfolgreichem Paketgate übernimmt er das exakte Artefakt `validated-release-candidate` und veröffentlicht `thundy-av-1.24.5.xpi` mit `SHA256SUMS.txt`. Historische oder abweichende Assets werden nicht überschrieben. Der tatsächliche Abschluss ist am Release und dessen heruntergeladenen Bytes zu prüfen.

## Installation, Daten und verbleibende Grenzen

Das XPI aus dem Release herunterladen, die zugehörige Prüfsumme prüfen und über Thunderbirds Add-on-Verwaltung aus Datei installieren; vor einem Upgrade Thunderbird sauber beenden und das vollständige eigene Profil sichern. Ein Profilrestore stellt den gesicherten Stand wieder her, führt aber später entstandene Ereignisse nicht automatisch zusammen. Keine neue Datenmigration, Einwilligung oder Hostberechtigung wird eingeführt. OPENED bestätigt weiterhin nur Thunderbirds angenommene Öffnungsanforderung; PENDING wird nach Prozessverlust nicht als abgeschlossene Entscheidung ausgegeben.

API-Antworten und Quellenbeobachtungen der automatisierten Prüfungen sind **synthetisch**. Thunderbird-APIs, MIME-Daten, beide Ansichten, Dateidialog und Neustarts sind **echt**. Produktive Anbieterzugänge, Windows/macOS, NVDA/VoiceOver und automatische Updates sind nicht neu abgenommen; dafür fehlen weiterhin die in [Roadmap #740](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/740) genannten zusätzlichen Ressourcen. Externe Analyse und Enterprise bleiben optional. Diese GitHub-Distribution ist keine ATN-Signierung oder automatische Updatezusage.

Der separate Werkzeug-PR [#742](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/742) und die zwei verbleibenden Entwicklungsabhängigkeits-Advisories sind nicht Bestandteil dieses Runtimefixes. Die allgemeinen Arbeiten zu Identität/Retention, Crypto/Backends und menschlichem Sprach-/Bedienreview bleiben offen.
