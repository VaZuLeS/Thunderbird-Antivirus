# Aktive CI, Kandidatengate und Veröffentlichung

Stand: 4. November 2026. Aktiv sind die Dateien unter `.github/workflows/`. `docs/ci/ci.yml` und `docs/ci/release-publish.yml` sind inhaltsgleiche Referenzkopien. `docs/ci/release.yml` bleibt eine **separate, nicht aktivierte ATN-Signiervorlage**. Alte Angaben über einen nur reduzierten aktiven Testworkflow oder ungeprüftes `upload --clobber` gelten nicht für diesen Quellstand.

1. `ci.yml` prüft frisches `npm ci`, Webdemo, Quellen, Tests, gefiltertes Lint und Paketinhalt. Sechs Browserjobs prüfen synthetische UI-APIs. Der echte Linux-Thunderbird-Job installiert das gehashte GitHub-XPI 1.24.3 und den Kandidaten in isolierten Sprachprofilen und prüft Neustart, Prozessverlust und Profilbackup-Restore.
2. Der nachgelagerte Kandidatenjob lädt **dieselben Paketbytes** und alle Reports. `candidate-evidence.js` verlangt in sechs Sprachen echte Upgrade-/Crashberichte mit passendem Pakethash sowie vollständige Browserberichte mit passendem Quellfingerprint. `npm run goal -- --candidate` prüft zusätzlich Quellen/Tests/Lint/Paket und einen sauberen paketwirksamen Arbeitsbaum. Er baut das Paket nicht nochmals.
3. `release.yml` wird durch einen neuen `v*`-Tag gestartet und ruft denselben CI-Workflow auf. Erst nach dessen Erfolg werden Kandidat und Evidenz geladen, Tag/Version geprüft und die getesteten Bytes als XPI bereitgestellt. Es gibt keinen nachträglichen Neubuild.
4. `publish-release.js` legt einen fehlenden Release an. Existiert er, werden Metadaten und beide Assets heruntergeladen und byteweise über SHA-256 verglichen. Gleiche Dateien bleiben unverändert, Abweichungen oder unklarer Zugriffsstatus brechen ab. Veröffentlichte Assets werden nicht überschrieben.

Die CI-Konfiguration kann lokal auf Syntax und die Gate-/Publikationslogik mit Testdoubles geprüft werden. Ein erfolgreicher GitHub-Lauf muss nach Übernahme der Änderungen separat nachgewiesen werden. Aktuelle lokale Berichte ersetzen diesen Remote-Lauf nicht.

## Lokal

```sh
npm ci
npm run check:web
npm run check
npm run check:ui -- --browser /absolute/path/to/chromium
# Echte Clientberichte separat erzeugen, siehe NATIVE_ABNAHME_2026-11.md.
node scripts/candidate-evidence.js --write /path/to/live /path/to/ui
npm run goal -- --candidate
```

Ohne `--candidate` wird zusätzlich ein passender Release-Tag verlangt. `--no-commands` zeigt C1–C4 ausdrücklich als übersprungen und kann keine vollständige GO-Freigabe erzeugen. Die lokale Kandidatenevidenz liegt unter `docs/audits/candidate-<version>.json`; jede paketwirksame Änderung macht sie ungültig. Ein neuer ZIP-Container mit anderen Bytes braucht neue pakethashgebundene Liveberichte.

## ATN und automatische Updates

GitHub-Veröffentlichung ist weder Signierung noch Store-Listung. Echte ATN-Schritte benötigen Maintainerzugang, einen zulässigen Kanal und bei Automation passende API-Credentials. Diese Umgebung meldet keine dafür eingerichteten Secrets. Der automatische Updatekanal ist gesondert abzunehmen; lokale XPI-Upgrades und ein Profilrestore benötigen keine ATN-Schlüssel.

Keine Signaturprüfung durch eine SHA256SUMS-Datei behaupten. Die Datei schützt den Vergleich mit den referenzierten Bytes, nicht die unabhängige Authentizität des Herausgebers.
