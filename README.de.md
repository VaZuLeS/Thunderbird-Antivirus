# Thundy AV — Thunderbird-Erweiterung

Lokale Risikoheuristik für Nachrichten, HTML-Entschärfung und Link-Entscheidungsprotokoll. Externe Analysen bleiben freiwillig; ohne ausdrückliche Zustimmung werden keine Provider angefragt. Lokale Heuristik ersetzt keinen vollständigen Virenscanner.

**Version 1.26.2:** [GitHub-Veröffentlichungsstatus und Download](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.26.2), unsignierte Distribution. [Freigabeumfang und verbleibende Voraussetzungen](docs/VEROEFFENTLICHUNG_1_26_2.md). Eine ATN-Signierung oder automatische Verteilung wird damit nicht zugesagt. Mindestversion laut Manifest: Thunderbird 140.0; die tatsächlich geprüften Linux-Versionen und verbleibenden Grenzen stehen im [aktuellen Produktstand](docs/AKTUELLER_PRODUKTSTAND.md).

[Dokumentation und Inhaltsverzeichnis](docs/guide-de.md) · [English](docs/guide-en.md) · [Firmenrichtlinie einrichten](docs/UNTERNEHMENSRICHTLINIE.md) · [Python-Empfänger einrichten](docs/python-receiver.md)

Die React-Webdemo ist eine separate Simulation und nicht im Thunderbird-XPI enthalten. Ihre neuen Entscheidungen heißen `SIMULATED_OPEN`/`SIMULATED_ABORT`; sie bestätigen keine echte Öffnung. Keine echten API-Schlüssel oder vertraulichen Nachrichten in die Demo eingeben. Enterprise-Profile bleiben deaktivierte Entwürfe; Node-Werkzeuge sind separate lokale Bausteine.

Für die tatsächliche Erweiterung bedeutet `OPENED` nur, dass Thunderbird die Öffnungsanforderung angenommen hat. Browserstart und Webseitenbesuch sind nicht bestätigt. Nach Prozessverlust bleibt `PENDING` eine offene Entscheidung. Bestehende Entscheidungen und damalige Scores werden beim Upgrade nicht neu interpretiert.

- [Installation und Bedienung](docs/guide-de.md#installieren)
- [Datenschutz und Datenflüsse](docs/privacy_policy.md)
- [Aufbewahrung, Löschung und Migration](docs/DATENLEBENSZYKLUS.md)
- [Detaillierte Aufgabenliste und Ausführung](docs/AUSFUEHRUNG_AUFGABEN_2026-11-02.md)
- [Entwicklungsumgebung](docs/quickstart.md) · [Architektur und Prüfkommandos](README.md)

Die veröffentlichte 1.26.2 enthält sechs Sprachen. Im Entwicklungsstand liegen 24 EU-Sprachkataloge vor. Die Oberflächen unterstützen Hell, Dunkel, Thunderbird-Theme, Akzent und Informationsdichte.

GNU GPL v3 für den aktuellen Quellstand. Historische Releases behalten ihre jeweiligen Lizenzbedingungen.
