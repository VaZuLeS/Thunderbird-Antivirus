# Freigabeabschluss 1.24.4

Auftrag vom **4. November 2026**: [PR #723](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/723) abschließen und einen neuen Release veröffentlichen. Ziel ist die **unsignierte GitHub-Distribution 1.24.4**. Tatsächlicher Status, XPI und Prüfsummen: [Release 1.24.4](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.4). Ein vorbereiteter Tag oder dieses Dokument allein bestätigt keine Veröffentlichung. Der Vorgänger [1.24.3](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.3) und seine Assets bleiben erhalten.

## Umfang

- [Analysequellen](UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md) in Nachricht und Popup für lokale Prüfung und alle fünf optionalen externen Dienste; Ressourcenbezug, tatsächlicher Anfragezustand, Herkunft und Alter in sechs Sprachen.
- Defensive Ressourcenisolierung, begrenzte Laufzeitkontexte und sichtbarer [Inhaltsprüfumfang](PRUEFUMFANG_NACHRICHTENINHALT.md); [begrenzter verifizierter Unicode-Eingang](UNICODE_NACHRICHTENEINGANG.md).
- [Konservative Quellenhistorie](QUELLENHISTORIE_ZUORDNUNG.md), additive UUID-Snapshots und [begrenzte atomare Protokollhistorie](PROTOKOLLHISTORIE.md); keine neue unbegrenzte Archivierungszusage.
- [Lokaler Quellenexport](QUELLENEXPORT.md) mit Positivliste, Vorschau, Abbruch und erneuter Kontextprüfung. [Native Navigationsuntersuchung](EXPORT_NAVIGATION.md) schließt die beobachteten Rückkehr-/Löschfälle ab; Wiederherstellung desselben Dokuments aus dem Seitencache wurde nicht beobachtet.
- [Historiennavigation](GROSSE_QUELLENHISTORIEN.md) und [bedarfsgerechte aktive Details](AKTIVE_QUELLENANSICHTEN.md) mit erreichbaren Warnungen und erhaltenem Fokus.
- [Strikter Lint-Prüfvertrag](LINT_PRUEFVERTRAG.md) und [reproduzierbare neue unsignierte Kandidaten](REPRODUZIERBARE_PAKETE.md). Keine erzwungene Dependencyreparatur oder Neusignierung historischer Assets.

## Paketgebundene Freigabe

Der aktive Tagworkflow `.github/workflows/release.yml` führt die vollständige CI erneut aus. Er übernimmt anschließend das Artefakt `validated-release-candidate`, verifiziert dessen Source-/Paketbindung sowie Tag/Version und veröffentlicht genau diese Bytes als `thundy-av-1.24.4.xpi` mit `SHA256SUMS.txt`. Vorhandene abweichende Assets werden nicht überschrieben. Release-Assetdigest und heruntergeladene Bytes sind für die veröffentlichte Fassung maßgeblich.

Die vorbereitenden lokalen Nachweise enthalten **1.067 bestandene automatisierte Tests**, identische Wiederholungsbauten unter Node 22/24 und native Linux-140/153-Export-/Navigationsprüfungen sowie ein manuelles Upgrade von 1.24.3 mit Profilrestore unter 153. Diese Befunde sind im [Buildbeleg](audits/avn-014b-reproducible-package-2026-11-04.json) an SHA-256 `44acb38fff48ddff2fc21acd8b2d4e19ed7fb40045c6d05d243728963b24687c` und Source-Fingerprint `619d0a65fb8fab903df94691fba08d2f6feffe40ddcd12ea903939fbcfeccea2` gebunden. Sie ersetzen die vollständigen sechssprachigen Browser-/Upgrade-/Crashberichte des Tagworkflows nicht. Eine andere Python-/zlib-Toolchain kann andere Containerbytes liefern; dann sind deren eigene paketgebundene Nachweise erforderlich.

Historische Testsummen und Paketbytes in älteren Entwicklungsdokumenten bleiben historische Belege. Keine alten SIGKILL-/Browser-/Performanceberichte werden nachträglich neuen Archivbytes zugeordnet. Die Reviewbereinigung präzisiert lediglich einen Anzeigetext-Test und entfernt eine ungenutzte Rückgabevariable im nativen Runner; Runtime-Dateien ändern sich dadurch nicht.

## Offene Voraussetzungen und Grenzen

Die [Roadmap #740](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/740) bleibt für die nicht erledigten Arbeiten maßgeblich:

| Arbeit | Freigabegrenze / Voraussetzung |
| --- | --- |
| Dauerhafte Vorkommensbindung und allgemeine Retention (#725) | Konservative Legacyanzeige ist implementiert; vollständiger datenbewahrender Speicher-/Migrationsvertrag bleibt offen. |
| Weitere MIME-/Crypto-/Backendabnahmen (#726) | Erfolgreiche Cryptoabnahme benötigt funktionierende Komponenten und isolierte Schlüssel/Zertifikate; keine pauschale Vollabdeckung. |
| Live-Provider (#727) | Testkonten, Quoten, erlaubte Ziele und Host-/Datenfreigaben fehlen. Synthetische API-Verträge sind keine produktive Anbieterabnahme. |
| Windows/macOS, NVDA/VoiceOver, native DPI/High Contrast (#729) | Tatsächliche Zielsysteme und Screenreader fehlen; Linux-/Browsernachweise ersetzen sie nicht. |
| Sprach-/Nutzerreview und Schutzqualität (#730/#728) | Menschlicher Review und unabhängige gelabelte Daten fehlen. Kataloggleichheit ist keine muttersprachliche Abnahme. |
| Toolchain-Advisories (#731) | Unterstützten Patch-/Updateweg und Erreichbarkeit untersuchen; keine Runtime-Lücke oder Behebung aus bloßen Paketanzahlen ableiten. |
| Automatische Updates / ATN (#738) | Zulässiger Kanal, Maintainerzugang und gegebenenfalls Signierung fehlen. GitHub-XPI und manuelles Backuprestore sind kein automatischer Rollbackkanal. |
| Produktiver Enterprisepilot (#734) | Betreiber, Zielsystem und Identitäten fehlen. Lokale Werkzeuge und deaktivierte Konfigurationsprofile bleiben davon getrennt. |
| Öffentliche Pages-Inhaltsabnahme (#739) | Quelllinks sind lokal prüfbar; tatsächliche öffentliche Inhalte und Downloadkette gesondert prüfen. |

Der Nutzer hat keine zusätzlichen Ressourcen bereitgestellt. Diese Grenzen werden nicht durch den GitHub-Release als bestanden erklärt. Externe Analyse und Enterprise bleiben optional. `OPENED` bedeutet nur Thunderbirds Annahme der Öffnungsanforderung; `PENDING` wird nach Prozessverlust nicht als abgeschlossene Entscheidung umgedeutet. Bestehende Daten, damalige Scores und historische Entscheidungsstände bleiben erhalten.
