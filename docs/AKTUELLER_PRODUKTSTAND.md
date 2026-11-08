# Aktueller Produktstand — 8. November 2026

Korrekturstand **1.25.1**: gemeinsame automatische Hintergrundprüfungen und sichtbare Prüfaktionen. [Konfiguration und Ablauf](AUTOMATISCHE_PRUEFUNGEN.md), [Release-Gate](VEROEFFENTLICHUNG_1_25_1.md). Bestehende Profile behalten ihre Freigabegrenzen bis zur ausdrücklichen Moduswahl.

Die **1.25.0** ergänzt verständliche und technische Ergebnisansichten, ein gemeinsames Anbieterregister sowie optionale lokale Administration mit separater Linkfreigabe. Schutzregeln bleiben nach Upgrade ausgeschaltet. [Release-Umfang und Nachweise](VEROEFFENTLICHUNG_1_25_0.md), [Einrichtung und Datenflüsse](EXTERNE_ANALYSEN_UND_LINKFREIGABE.md), [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.0). Die neue Passwort-/Freigabefunktion ist lokal unter Linux mit Thunderbird 153.5.1 ESR geprüft; Windows/macOS und echte Anbieterzugänge bleiben gesonderte Abnahmen.

Die **1.24.8** ergänzt die [dauerhafte Vorkommensidentität und Speicherschlüsselableitung (AVN-009), konfigurierbare lokale Schutzprofile mit Live-Differenzvorschau (AVN-010) sowie das Heuristik-Benchmarking und die Dokumentationsparität (AVN-005, AVN-016)](VEROEFFENTLICHUNG_1_24_8.md). Tatsächlicher [Veröffentlichungsstatus und Download](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.8); ein vorbereiteter Quellstand allein bestätigt keine Veröffentlichung. 1.24.7 bleibt unverändert erhalten.

Die **1.24.7** ergänzt die [vollständige Überarbeitung der Remote-API-Parser (insb. Hybrid Analysis v2 Quick-Scan-Lebenszyklus), die Offline-Darstellung gespeicherter Berichte ohne aktive Einwilligung sowie die direkte Risiko-Score-Integration verifizierter Anhang- und Link-Befunde](VEROEFFENTLICHUNG_1_24_7.md). Tatsächlicher [Veröffentlichungsstatus und Download](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.7); ein vorbereiteter Quellstand allein bestätigt keine Veröffentlichung. 1.24.6 bleibt unverändert erhalten.

Die **1.24.6** ergänzt den [Fix für unlesbare gespeicherte Quellenlisten und präzisere Antwortzustände](HOTFIX_QUELLENLADEFEHLER_1_24_6.md). Tatsächlicher [Veröffentlichungsstatus und Download](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.6); ein vorbereiteter Quellstand allein bestätigt keine Veröffentlichung. 1.24.5 bleibt unverändert erhalten.

Der [Freigabeumfang 1.24.5](VEROEFFENTLICHUNG_1_24_5.md) ergänzt den Lade-/Darstellungsfix. Tatsächlicher [GitHub-Release-Status und Download](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.5); ein vorbereiteter Quellstand allein bestätigt keine Veröffentlichung. [1.24.4](VEROEFFENTLICHUNG_1_24_4.md) bleibt als vorheriger Release erhalten.

Die **1.24.5** behebt einen [reproduzierten Ladeabbruch bei gespeicherten Analyseprotokollen](HOTFIX_ANALYSEERGEBNISSE_1_24_5.md) und ergänzt sichtbare Ergebnis-/Herkunftskennzeichnungen aller fünf Dienste im Popup und in der Nachricht. Die anschließende [Korrektur der Berichtsschaltflächen](BERICHTSAKTIONEN_1_24_5.md) bindet Aktionen an die konkrete Karte und den passenden Ressourcenpfad, auch bei gleichen Anhanghashes. Der aktuelle Veröffentlichungsstatus ist am obigen Release-Link maßgeblich.

Der Freigabeumfang **1.24.4** ergänzt [sichtbare Analysequellen in Nachricht und Toolbar-Popup](ANALYSEQUELLEN_1_24_4.md). Der [nächste Umsetzungsschritt](FORTSCHRITT_AVN_001_002_009.md) korrigiert Ressourceninventare und Kontextcaches; die dauerhafte Identitäts-/Retentionsarbeit bleibt nach einem nativen Gegenbeweis offen. Die weitere [Umsetzung des Informationsdarstellungsplans](UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md) ergänzt Ressourcenbezug und ausstehende Prüfzustände. GitHub-Downloadverweise und Pages führen nun die Zielversion 1.24.7; tatsächlicher Veröffentlichungsstatus und Paketbytes sind am Release-Link zu prüfen. 1.24.3 bleibt historisch erhalten.

Die bisherige Weiterentwicklung (Headerparser, Prüfherkunft, Entscheidungsgründe, Prüfumfang und lokaler Supportexport) ist im [aktuellen Ausführungsprotokoll](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md) abgegrenzt.

Die weitere [Identitätsuntersuchung](IDENTITAET_ANALYSEBEFUNDE.md) zeigt, dass auch unveränderte Nachrichteninhalte bei Statusänderung oder Komprimierung andere Rohdaten-Hashes erhalten können. Inhaltsnachweis, Nachrichtenvorkommen und historische Entscheidung benötigen getrennte Bindungen. Der ergänzte native Prüfrunner ändert weder den produktiven Speicherschlüssel noch vorhandene Daten.

Der [anschließende Inhaltsumfang-Fix](PRUEFUMFANG_NACHRICHTENINHALT.md) verhindert einen lokalen Abschluss für nicht verfügbare Inhalte und zeigt Teilprüfung/Lesefehler in allen sechs Sprachen. Echte Linux-Prüfungen unter 140/153 bestätigen Nachricht und Popup sowie binäre Ressourcen. Erfolgreiche Cryptoabnahmen und die dauerhafte Identitätsmigration bleiben offen.

Die Unicode-Abweichung ist danach [im begrenzten Thundy-AV-Eingangsweg für die belegten UTF-8/QP-Fälle behoben](UNICODE_NACHRICHTENEINGANG.md): Normale Texte bleiben beim bestehenden API-Aufruf; betroffene Textparts werden strikt verifiziert, unbestätigte Eingaben bleiben unvollständig. Die nativen 140/153-Matrizen bestehen mit 13 gültigen und einem bewusst ungültigen Fall. Erfolgreiche Cryptoabnahmen, große Nachrichten, andere Speicherbackends und dauerhafte Identitätsmigration sind weiter offen.

Die [Quellenhistorie](QUELLENHISTORIE_ZUORDNUNG.md) wird jetzt von aktuellen Beobachtungen getrennt und nach einem Prozesswechsel nicht anhand alter Zahlen neu gebunden. Neue Quellenstände verwenden einen additiven UUID-Bereich; alte Quellenfelder bleiben erhalten. Gespeicherte Anhangkarten benötigen einen aktuellen Hashnachweis im aktiven Kontext. Dies ist ein defensiver Teilschritt, keine vollständige Ressourcen-/Vorkommensmigration oder unbegrenzte Archivierung.

Vorheriger Ausführungsstand ist die [detaillierte Aufgabenliste](AUSFUEHRUNG_AUFGABEN_2026-11-02.md). Die [aktuelle Bestandsaufnahme und der Aufgabenplan](PRODUKTANALYSE_AUFGABENPLAN_2026-11-04.md) dokumentieren den aktuellen Entwicklungs- und Release-Stand; alte Statusmeldungen sind zeitgebundene Nachweise und keine aktuelle Freigabe.

Die [begrenzte Protokollhistorie](PROTOKOLLHISTORIE.md) sichert nun die bisherigen gespeicherten Ressourcenprotokolle vor Ersetzung in derselben Transaktion. Lokales Wiederlesen desselben Anhanginhalts erhält den fertigen Bericht; volle Kapazität oder Commitfehler erhalten die alten Daten und werden angezeigt. Die bestehende Cacheaufbewahrung gilt weiterhin; unabhängige Langzeitarchivierung und dauerhafte Vorkommensmigration bleiben offen.

Der [lokale Quellenbericht](QUELLENEXPORT.md) bietet eine datensparsame Vorschau und einen ausdrücklichen Download des aufgezeichneten Prüfstands. Aktuelle Beobachtungen und unbestätigte Historie bleiben getrennt. Ressourceninhalte und interne Kennungen sind ausgeschlossen; Kontextwechsel, Änderungen und Cachelöschung machen ältere Vorschauen ungültig. Es startet keine neue Analyse oder automatische Übermittlung.

Die [Historiennavigation AVN-007.a](GROSSE_QUELLENHISTORIEN.md) macht alle bis zu 1.200 normalisierten historischen Beobachtungen in 30er-Seiten erreichbar. Ein auffälliger historischer Befund bleibt bereits in der Zusammenfassung sichtbar und kann direkt angesprungen werden. Die Zuordnung bleibt unbestätigt; aktuelle Bewertungen und gespeicherte Originaldaten werden dadurch nicht geändert.

Die [großen aktiven Quellenansichten AVN-007.b](AKTIVE_QUELLENANSICHTEN.md) werden anschließend nativ untersucht und gezielt optimiert: Inhalte geschlossener Prüfdetaileinträge entstehen erst beim Öffnen, offene Details/Fokus bleiben bei Aktualisierungen erhalten. Der stärkste aktuelle Warnbefund ist direkt erreichbar; Quellenart und ursprüngliche Zeiten bleiben unverändert. Die Zusammenfassungen werden weiterhin vollständig angezeigt.

Der [Lint-Prüfvertrag AVN-008.a](LINT_PRUEFVERTRAG.md) weist unvollständige Berichte, widersprüchliche Prozessresultate und zu breit passende Warnungsausnahmen ab. Der isolierte neuere Linter besteht die abgegrenzte Vergleichsprobe, wird ohne belegten Advisory-/Integrationsvorteil aber nicht erzwungen. Die App-Nutzdaten und das exakt nativ geprüfte Entwicklungspaket bleiben unverändert; dies ist eine Verbesserung der Buildprüfung, keine neue Analysefähigkeit.

Die [native Exportnavigation AVN-011.b](EXPORT_NAVIGATION.md) prüft anschließend die tatsächliche Rückkehr im selben Inhaltstab mit und ohne Cachelöschung während der Abwesenheit. Unter Linux 140/153 wird jeweils ein neues Dokument mit leerer Vorschau geladen; ein gelöschter Kontext bleibt unzugänglich. Die vermutete Wiederherstellung desselben Dokuments wurde nicht beobachtet. Die begrenzte Untersuchung ist abgeschlossen und im bestehenden nativen CI-Schritt abgesichert; Runtime und Paketbytes bleiben unverändert.

Der [reproduzierbare Paketaufbau AVN-014.b](REPRODUZIERBARE_PAKETE.md) erzeugt danach neue Kandidaten mit fester ZIP-Reihenfolge/-Metadatenpolitik und lokal gepinntem CLI-Aufruf. Der Runtime-Fingerprint bleibt unverändert, die neuen Archivbytes (SHA-256 `44acb38fff48ddff2fc21acd8b2d4e19ed7fb40045c6d05d243728963b24687c`) sind erneut unter Linux 140/153 sowie per manuellem Upgrade von 1.24.3 und Profilrestore unter 153 geprüft. Alte Paketnachweise bleiben ihren ursprünglichen Bytes zugeordnet. Reproduzierbarkeit gilt für die dokumentierte Python-/zlib-Toolchain; Signierung, Remote-Kandidatengate und Veröffentlichung bleiben getrennt.

| Ebene | Stand |
| --- | --- |
| GitHub-Distribution | Zielversion 1.25.0, unsigniert; tatsächliche Verfügbarkeit über den Release-Link prüfen. 1.24.7 bleibt historisch erhalten |
| Quellstand | 1.25.0 mit zwei Ergebnisansichten, gemeinsamen Anbieterregeln und optionaler lokaler Administration/Linkfreigabe; ATN-Signierung und automatische Updates bleiben eigenständige Schritte |
| Tatsächliches Add-on | MV3-MailExtension; Hintergrundskripte, eigene HTML-Seiten, IndexedDB und browser.storage.local |
| React | separate gekennzeichnete Websimulation mit eigenem localStorage; nicht im XPI |
| Enterprise | deaktivierte Profile plus lokale Node-Werkzeuge; neuer Offline-Audit-Review aktiviert keinen Dienst |
| Reale lokale Abnahme | isolierte Linux-Profile mit Thunderbird 140.12.0 ESR und 153.6.0 ESR; Sprach-/Upgrade-/Crashberichte im Kandidatennachweis |
| Weiterhin offen | Windows/macOS, NVDA/VoiceOver, native DPI/High Contrast, automatische Updateverteilung, ATN, produktiver Enterprise-Pilot |

Die Dependency-Kollision Vite 8 / React-Plugin 4 wurde durch das passende Plugin 6.1.2 behoben. Der tldts-Pin und das mitgelieferte PSL-Bundle werden zusammen geprüft. Verlorene Releasefähigkeiten (fertige Analyseberichte, begrenztes Polling, Protokollmetadaten und Gateway-/urlscan-Authentifizierung) wurden wieder aufgenommen. Verspätete Berichte werden bei Kontextverlust verworfen und dürfen neuere Einreichungen nicht überschreiben.

Der aktuelle Gate bindet reale Upgrade-/Crashnachweise und sechssprachige Browserberichte an Quellfingerprint und exakte Paketbytes. Ein alter Protokolltext, eine Testzahl oder ein Tag allein reicht nicht. Browser-/axe-Tests bleiben Simulationen; echte Thunderbirdberichte bleiben echte Clienttests mit ausdrücklich begrenztem Umfang.

**Keine Sicherheitsgarantie aus einem niedrigen Score:** unbekannte Providerresultate, fehlende Zustimmung oder eine fehlgeschlagene Analyse sind kein Sicherheitsnachweis. `OPENED` bestätigt nur die von Thunderbird angenommene Öffnungsanforderung; `PENDING` bleibt nach Prozessverlust offen. Backups und spätere Neubewertungen ändern historische Entscheidungssnapshots nicht.
