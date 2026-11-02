# TAV-018 — neu erkannte Werkzeug-Abhängigkeiten

Primärbereich: Lieferfähigkeit und Releaseprovenienz, Schlagwort Lieferkette. Typ: Optimierung. Priorität P1 für kompatibel behebbare hohe Befunde, P2 für die verbleibende Entwicklungswerkzeugkette. Aufwand S für die ausgeführten Patches, M/L für eine ggf. benötigte unterstützte Lintermigration. Befund neu aus der Ausführung, nicht nachträglich als ursprünglicher Planbefund ausgegeben.

## Tatsächliche Evidenz und Änderung

Nach dem Push wies GitHub auf Abhängigkeitsmeldungen im Standardbranch hin. Ein eigener `npm audit --json` für den Kandidaten ergab zunächst 12 Meldungen: 1 hoch, 10 mittel, 1 niedrig. Die betroffene hohe Meldungsgruppe liegt bei node-forge; fast-uri hatte behebbare mittlere URI-Verarbeitungsbefunde. Diese Pakete sind Teil der Repository-/Entwicklungswerkzeuge und werden nicht als solche im 44-Dateien-XPI mitgeliefert. Das ist eine Scopeaussage, keine allgemeine Nichtexploitierbarkeitszusage.

`npm audit fix` wurde **ohne --force** ausgeführt. Das Lockfile aktualisiert kompatibel `node-forge` auf 1.4.2 und `fast-uri` auf 3.1.9; die direkten Produkt-/Toolversionen und das XPI bleiben unverändert. Frisches npm ci und vollständige Prüfungen wurden danach erneut unter Node 22.23.4 und Node 24.19.0 erfolgreich ausgeführt: jeweils 976 Tests, Lint 0 Fehler/24 bekannte Warnungen, gültiges Paket. [Maschinenlesbare aktuelle Meldungen](audits/dependency-audit-1_24_3.json).

## Verbleibender Befund

Aktuell 10 Meldungen: 9 mittel, 1 niedrig, keine hohe/kritische Meldung im geprüften npm-Baum. Betroffen ist die web-ext/addons-linter/ESLint-Kette mit minimatch sowie deepmerge. Der npm-Automatismus schlägt als Gesamtbehebung unter anderem eine inkompatible Rückstufung von web-ext auf 3.2.1 vor; das ist keine validierte Lösung für diese MV3-/Thunderbird-Paketierung. Die sichere kompatible Standardbehebung hat diese Meldungen nicht geschlossen.

Offen bleibt eine unterstützte gepatchte Toolchain oder eine eigenständig geprüfte Migration. Vor einem Override müssen Modul-/APIkompatibilität, kuratierte Thunderbird-Warnungen, Paket-/Signierpfad und negative Lintertests nachgewiesen sein. Keine pauschalen SemVer-Overrides oder Änderungen im installierten node_modules als vermeintliche dauerhafte Behebung. Bis dahin Meldungen transparent weiterführen; CI überprüft den eigenen Repository-Quellstand, verwendet keine Produktions-/ATN-Secrets für PR-Tests und aktiviert keinen Signierdienst.

## Akzeptanz und Validierung

Kompatible Patches: frische Installation, Node-22-/24-Gesamtprüfung und unveränderte paketgebundene Runtimeevidenz. Verbleibende Werkzeugmeldungen: upstream-/migrationstaugliche Fixversion bestimmen, alle relevanten API-/Lint-/Package-/Signierfälle prüfen und dann audit mit tatsächlichem Ergebnis fortschreiben. Testzahlen allein oder ein mit --force erzeugtes Lockfile gelten nicht als Abnahme. Die Aufgabe ist teilweise umgesetzt; verbleibende Befunde werden nicht als behoben markiert.

## Untersuchung in der Weiterentwicklung

`web-ext` 10.8.0 ist verfügbar und nun explizit gepinnt; frische Registry-/Auditprüfung ergibt weiterhin 9 mittlere und 1 niedrige Meldung. Lint besteht mit 0 Fehlern und 24 kuratierten Thunderbird-Warnungen. Die neue Mindest-/Pinangabe ist keine Sicherheitsbehebung: Das vorherige Lockfile enthielt bereits 10.8.0. Der angebotene npm-Downgrade auf 3.2.1 wird weiter nicht übernommen. TAV-018.03 bleibt offen, bis eine unterstützte gepatchte Linter-/ESLint-Kette oder eine validierte Migration verfügbar ist.

## Erneute Prüfung vor Veröffentlichung

Die Registry liefert weiterhin web-ext 10.8.0, addons-linter 10.15.0 und deepmerge 4.3.1 als aktuelle Versionen. Deepmerge 4.3.1 ist selbst betroffen; eine unterstützte gepatchte Version ist damit nicht verfügbar. Minimatch 11.0.4 ist gepatcht, die betroffene Werkzeugkette verwendet jedoch mehrere ältere Major-Versionen. Ein pauschaler Major-Override aller Verbraucher wäre keine unterstützte Standardbehebung. Erneutes npm audit: weiterhin 9 mittel / 1 niedrig, keine hohe/kritische Meldung im Kandidatenbaum. Die Befunde werden im GitHub-Release offen benannt; die Meldungen des alten Standardbranchs sind davon zu unterscheiden.
