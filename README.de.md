# Thundy AV — Thunderbird-Erweiterung

Lokale Risikoheuristik für Nachrichten, HTML-Entschärfung und Link-Entscheidungsprotokoll. Externe Analysen bleiben freiwillig; ohne ausdrückliche Zustimmung werden keine Provider angefragt. Lokale Heuristik ersetzt keinen vollständigen Virenscanner.

**Version 1.24.8:** [GitHub-Veröffentlichungsstatus und Download](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.8), unsignierte Distribution. [Freigabeumfang und verbleibende Voraussetzungen](docs/VEROEFFENTLICHUNG_1_24_8.md). Eine ATN-Signierung oder automatische Verteilung wird damit nicht zugesagt. Mindestversion laut Manifest: Thunderbird 140.0; die tatsächlich geprüften Linux-Versionen und verbleibenden Grenzen stehen im [aktuellen Produktstand](docs/AKTUELLER_PRODUKTSTAND.md).

Die React-Webdemo ist eine separate Simulation und nicht im Thunderbird-XPI enthalten. Ihre neuen Entscheidungen heißen `SIMULATED_OPEN`/`SIMULATED_ABORT`; sie bestätigen keine echte Öffnung. Keine echten API-Schlüssel oder vertraulichen Nachrichten in die Demo eingeben. Enterprise-Profile bleiben deaktivierte Entwürfe; Node-Werkzeuge sind separate lokale Bausteine.

Für die tatsächliche Erweiterung bedeutet `OPENED` nur, dass Thunderbird die Öffnungsanforderung angenommen hat. Browserstart und Webseitenbesuch sind nicht bestätigt. Nach Prozessverlust bleibt `PENDING` eine offene Entscheidung. Bestehende Entscheidungen und damalige Scores werden beim Upgrade nicht neu interpretiert.

- [Installation und Bedienung](docs/quickstart.md)
- [Datenschutz und Datenflüsse](docs/privacy_policy.md)
- [Aufbewahrung, Löschung und Migration](docs/DATENLEBENSZYKLUS.md)
- [Detaillierte Aufgabenliste und Ausführung](docs/AUSFUEHRUNG_AUFGABEN_2026-11-02.md)
- [Entwicklungsbefehle und Architektur](README.md)

Sechs mitgelieferte Sprachen: EN, DE, FR, ES, IT und PL. Einheitliche eigene Add-on-/Admin-Oberflächen unterstützen Hell/Dunkel, Thunderbird-Themes, Akzent und Dichte. Native Screenreader-/Windows-/macOS-Abnahme ist gesondert nachzuweisen.

GNU GPL v3 für den aktuellen Quellstand. Historische Releases behalten ihre jeweiligen Lizenzbedingungen.
