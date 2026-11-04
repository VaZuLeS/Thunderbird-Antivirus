# AVN-008.b — Werkzeug-Advisories und begrenzte Prozessausführung

Stand: **4. November 2026**, getrennte Wartungsänderung auf dem veröffentlichten 1.24.4-Quellstand `6616d66`. Primärbereich: Build- und Prüfinfrastruktur; Entwicklungstyp **Optimierung**, Priorität **P2**, Aufwand **M**. Verwandt: [#731](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/731), [Roadmap #740](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/740). Der separate [Darstellungsfix #741](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/741) für die unveröffentlichte 1.24.5 wird hierdurch weder ersetzt noch veröffentlicht.

## Auswahl und tatsächlicher Befund

Die offenen P1-Pakete für echte Anbieter-, Windows/macOS-/Screenreader- und automatische Updateabnahmen benötigen weiterhin zusätzliche Systeme bzw. Konten. #725 bleibt die wichtige größere Vertrags-/Migrationsarbeit. Deren Datenmodell darf nicht durch eine ungeprüfte Nebenmigration ersetzt werden. #731 erlaubt dagegen eine begrenzte, sofort nachprüfbare Untersuchung des tatsächlichen Werkzeugeinsatzes.

`scripts/lint-with-filter.js` und `scripts/build-and-verify-package.js` starteten lokale Unterprozesse ohne eigene Laufzeitgrenze. Das Lint-Gate wies bereits fehlerhafte Ausgaben und Prozessabbrüche ab, konnte einen hängenden Prozess lokal aber nicht selbst beenden. Beim Paketbau wurde die Ausgabe direkt weitergeleitet. Ein CI-Jobtimeout begrenzt den gesamten CI-Job, schützt jedoch keinen unabhängig gestarteten lokalen Befehl. Dies ist ein belegter Robustheitsmangel; ein konkreter Advisory-Exploit ist damit nicht nachgewiesen.

## Aktueller Audit- und Updatebefund

| Prüfbereich | Tatsächlicher Befund | Einordnung |
| --- | --- | --- |
| Ganzer Projektbaum | 9 moderat, 1 niedrig, 0 hoch/kritisch betroffene Pakete | Zwei zugrunde liegende Advisories; Paketanzahl ist nicht Schwachstellenanzahl |
| Ohne Entwicklungsabhängigkeiten | 0 gemeldete betroffene Pakete | Begrenzter npm-Scope, kein Sicherheitsattest des XPI |
| Isolierter Linter 10.14.0 / 10.15.0 | Je 7 moderat und 1 niedrig | Gleichartige Auditbäume; kein belegter Advisoryvorteil |
| Reguläres `web-ext@latest` | 10.8.0, bindet exakt `addons-linter` 10.14.0 | Kein regulär integriertes neueres Linterupdate verfügbar |
| `addons-linter@latest` | 10.15.0, weiterhin `deepmerge` 4.3.1 und ESLint 9.39.4 | Separate Installation allein behebt den Projektbaum nicht |

Die Registry-/Auditantworten wurden neu abgerufen. Die beiden bereits getrennt installierten Linterbäume wurden erneut auditiert; sie werden nicht als neue Installationen ausgegeben. Lockfile und Projektabhängigkeiten bleiben unverändert. Der angebotene `web-ext`-Downgrade auf 3.2.1 und ungeprüfte Major-Overrides sind kein akzeptierter Updateweg.

## Eingabepfade und Erreichbarkeit

| Advisory | Belegte Aufrufkette / Eingabe | Bewertung und Restunsicherheit |
| --- | --- | --- |
| `minimatch`, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), installierte Version 3.1.5 | `web-ext/lib/util/file-filter.js::wantFile` → `multimatch` → `minimatch.match`. Die Muster stammen aus `web-ext-config.mjs::ignoreFiles`, Werkzeugstandards und aufgelösten Verzeichnispfaden. ESLint enthält zusätzliche Dateimusterpfade. | Bibliothek tatsächlich im Build-/Lintpfad; normale Mail- und Providerdaten sind hier keine Globmuster. PR-/Maintaineränderungen an Konfiguration, Quellen und Pfaden bleiben Eingaben der Werkzeugkette. Keine allgemeine Unausnutzbarkeitszusage. |
| `deepmerge`, [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), installierte Version 4.3.1 | `addons-linter/dist/addons-linter.js`, Modul `schema/deepmerge`, `deepPatch` aus `schema/validator`. Die überprüften Aufrufstellen bauen/passen die mitgelieferten Validierungsschemata an; Manifestdaten werden anschließend damit validiert. | Tatsächliche Aufrufe im Linter, kein nachgewiesener Übergang einer fremden Mail/API-Antwort in diese Mergeargumente. Die Beobachtung untersucht nur den kontrollierten Lauf und ersetzt keine vollständige Datenflussanalyse aller Linteroptionen. |

Der optionale Vorladeprüfer `tools/toolchain-observer.dev.cjs` beobachtet CommonJS-Exporte auch bei ESM-Verbrauchern. Ein früherer Beobachter über `Module._load` erfasste den ESM-Dateiauswahlpfad nicht; dessen fehlende Zähler wurden ausdrücklich nicht als Unerreichbarkeit gewertet. Die abschließende Probe erfasst beide Bibliotheken. Sie verändert weder Argumente noch Rückgabewerte und speichert keine Muster-, Manifest- oder Quelltextwerte. Protokolliert werden Zähler, maximale Musterlängen und begrenzte Aufrufstellen. Interne rekursive Aufrufe werden nicht vollständig gezählt.

Im abschließenden Lintlauf wurden 5.049 `minimatch.match`-Einstiege (maximal 50 Zeichen / 7 Pfadteile) und 273 `deepmerge`-Einstiege beobachtet. Der Buildlauf erfasste 4.802 Dateimusteraufrufe (maximal 49 Zeichen / 7 Pfadteile). Diese Größen sind arbeitsverzeichnis-/dateibestandsabhängige Messungen, keine neuen Eingabelimits oder Sicherheitsgrenzen. Der vollständige instrumentierte Lintbericht ist zum normalen Bericht identisch. Nicht beobachtete gefährliche Schlüssel beweisen keine generische Sicherheit verschachtelter Daten.

## Umgesetzte Härtung und Akzeptanz

`scripts/tool-process.js::runTool` begrenzt jeden aufgerufenen Prozess auf **120 Sekunden** und die erfasste Ausgabe auf **8 MiB** mit Nodes `maxBuffer`. Bei Zeitüberschreitung wird der direkte Werkzeugprozess mit `SIGKILL` beendet, damit ignoriertes `SIGTERM` oder synchrone Arbeit den lokalen Aufrufer nicht unbeschränkt blockieren. Das ist keine Sandbox, keine feste Gesamt-RAM-Grenze und keine allgemeine Terminierung beliebiger Enkelprozesse. Die Grenzen gelten für die erfassten Streams, nicht für alle Allokationen des Werkzeugs.

- `runLint` verwendet weiterhin denselben lokalen, installierten `web-ext`-Einstieg und denselben Node-Interpreter. Fehlermeldung, Signal oder fehlender/unerwarteter Prozessstatus scheitern vor der Annahme eines JSON-Berichts. Gültiges JSON vor einem anschließenden Hängen ist kein Erfolg.
- Der Paketbau verwendet denselben begrenzten Aufrufer für Build, Inhaltsprüfung, Kanonisierung und erneute Inhaltsprüfung. Die erfasste normale Ausgabe wird anschließend weitergegeben. Bei Fehler werden Teilkandidat und temporäres Staging entfernt; es bleibt kein alter bzw. unvollständiger Kandidat im eigenen Buildverzeichnis zurück.
- Auch der vorhandene isolierte Lintervergleich verwendet die Grenzen. Kein `npx`-Nachladen, Shell-Ersatzpfad, Dependency-Override oder Abschwächen von Diagnoseausnahmen wird eingeführt.
- Tests können ausdrücklich kürzere Budgets übergeben; die normalen CLI-Einstiege verwenden feste Standardwerte, keine aus Repositorykonfiguration übernommenen Zeitlimits.
- Runtime, sechs Sprachpakete, Einstellungen, Protokolle und Entscheidungen sind unverändert. Paketprüfung und SHA-Vergleich bestätigen dieselben XPI-Bytes wie die öffentliche 1.24.4: `44acb38fff48ddff2fc21acd8b2d4e19ed7fb40045c6d05d243728963b24687c`.

## Validierung und überprüfbare Grenzen

[Maschinenlesbare Evidenz](audits/avn-008b-toolchain-2026-11-04.json) mit Skript-, Log- und Paketprüfsummen. Vollständiger lokaler Check: **1.072 Prüfungen, 0 Fehler** auf diesem separaten 1.24.4-Wartungszweig. Diese Zahl gehört nicht zum 1.24.5-Darstellungszweig. Je 15 gezielte Tests unter Node 22 und 24 prüfen tatsächliche, kontrollierte Unterprozesse: Timeout trotz gültigem JSON, ignoriertes SIGTERM, übermäßige Ausgabe, normale Erfolgs-/Fehlerberichte sowie Erhaltungs-/Bereinigungsverhalten beim Paketbau. Die Fehlerfälle sind harmlose Fixtures, kein Advisory-Exploit.

14 tatsächliche öffentliche Linter-CLI-Scans vergleichen 10.14/10.15 erneut auf dem exakten Paket und sechs vorhandenen positiven/negativen Fixtures. Das vollständige MV3-Paket bleibt akzeptiert; dynamische Auswertung, Inline-Skript, ungültige Manifestversion und ähnliche ungültige Berechtigung bleiben abgewiesen. Es werden keine synthetischen Add-ons installiert oder ausgeführt.

```sh
node --test scripts/lint-gate.test.js scripts/reproducible-package.test.js
npm run check
THUNDY_TOOLCHAIN_PROBE_OUT=/absolute/path/to/new-observation.json \
  node -r ./tools/toolchain-observer.dev.cjs \
  ./node_modules/web-ext/bin/web-ext.js lint --source-dir . --output json
```

Keine neue Thunderbird-/OS-/Screenreader- oder Providerabnahme wird aus Node-Unterprozessen abgeleitet. Die native Abnahme der veröffentlichten unveränderten Paketbytes bleibt historisch an diese Bytes gebunden. **#731 bleibt offen:** Erreichbarkeitsuntersuchung und lokale Härtung sind umgesetzt; die zwei Advisories benötigen weiterhin einen kompatiblen Upstreamfix und regulär unterstützten Consumer-Updateweg. Ein neuer Major-Override braucht eine eigene begründete Kompatibilitätsuntersuchung. Veröffentlichung und vorhandene Add-on-Daten werden nicht verändert.
