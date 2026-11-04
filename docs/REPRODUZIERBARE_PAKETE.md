# Reproduzierbarer Paketaufbau — AVN-014.b

Stand: **4. November 2026**, Umsetzung von [GitHub-Aufgabe #736](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/736) im unveröffentlichten Entwicklungsstand 1.24.4.

## Problem und Ergebnis

Die bisherige `web-ext`-Paketierung übernahm unterschiedliche ZIP-Zeitstempel und Eintragsreihenfolgen. Identische Runtime-Dateien ergaben dadurch verschiedene Paketprüfsummen. Das erschwerte die Wiederverwendung exakt getesteter Bytes; es war kein Nachweis geänderter Programminhalte. Außerdem startete der Wrapper über `npx`, wodurch bei fehlendem lokalem Werkzeug ein Fetch-Fallback möglich war.

`npm run package` verwendet jetzt ausschließlich den installierten, über das Lockfile bestimmten `node_modules/web-ext/bin/web-ext.js`, ausgeführt mit `process.execPath`. Fehlt das Werkzeug, schlägt der Build fehl; es gibt keinen Downloadersatz. Die bestehende Dateiauswahl aus `web-ext-config.mjs` bleibt erhalten. Es werden keine Abhängigkeiten oder Lockfiles geändert.

Der Build erstellt das rohe Archiv in einem privaten temporären Verzeichnis, prüft dessen Inhalt und erzeugt daraus ein **neues, unsigniertes** Kandidatenarchiv. Nach erneuter Paketprüfung wird es in das zuvor bereinigte `build/` übernommen und über `packageIdentity` mit dem aktuellen Quellstand verglichen. Ein Prozessfehler oder ein Unterschied zum Quellstand führt zum Fehlschlag und entfernt den unfertigen Kandidaten. Temporäre Builddateien werden im normalen Erfolgs-/Fehlerpfad aufgeräumt. Parallele Builds in dasselbe `build/` sind weiterhin nicht unterstützt; getrennte Checkouts verwenden.

## Verbindlicher Archivvertrag

| Bestandteil | Festlegung |
| --- | --- |
| Dateiauswahl und Nutzdaten | Aus dem frisch geprüften `web-ext`-Build; Dateinamen und alle Dateibytes bleiben unverändert. Nutzdaten werden nach der Kanonisierung erneut verglichen. |
| Reihenfolge | Nach Dateiname sortiert; Verzeichniseinträge entfallen, Dateien erzeugen ihre benötigten Pfade. |
| Zeitpunkt | ZIP-Zeitstempel 1980-01-01 00:00:00, unabhängig von Quell-mtime und Zeitzone; kein `SOURCE_DATE_EPOCH` nötig. |
| Rechte und Plattformmarker | Reguläre Unix-Datei, Modus 0644, `create_system=3`; keine Ausführungsrechte oder Dateisystembesonderheiten. |
| Kommentare und Zusatzfelder | Leer; keine übernommenen Extra-Felder oder ZIP-Kommentare. |
| Kompression | DEFLATE Stufe 9. Python- und zlib-Version gehören zur Buildumgebung. Kein neuer Kompressor als Abhängigkeit. |
| Schutzgrenzen | Höchstens 1.024 Eingabeeinträge und 1.000 KiB Nutzdaten; keine doppelten Namen, unsicheren Pfade, verschlüsselten Einträge, Symlinks oder anderen Spezialdateien. Fehlerhafte CRCs werden beim Lesen erkannt. |
| Signierung und bestehende Artefakte | `META-INF` in beliebiger Groß-/Kleinschreibung wird abgewiesen. Ausgabe ausschließlich in eine neue Datei; keine In-place-Option und kein Überschreiben. |

`scripts/reproducible-package.py` gehört ausschließlich **vor** Kandidatentests und Signierung in den Buildpfad. Es darf nicht auf veröffentlichte Archive angewandt werden. Veröffentlichte 1.24.3-Assets und das frühere nativ geprüfte Entwicklungs-XPI bleiben erhalten. Signierte Pakete werden nicht normalisiert; Signierung und deren externe Metadaten sind ein späterer, eigenständiger Schritt.

## Tatsächlich geprüft und Geltungsbereich

Die Wiederholungsbauten verwenden saubere `build/`-Verzeichnisse und liefern identische Archivbytes unter Node **24.19.0 und 22.23.4**, einschließlich der Zeitzonen UTC, Pacific/Honolulu und Europe/Berlin. Die gemeinsamen Komponenten sind Linux, Python **3.12.14**, zlib **1.3.2** und dieselbe installierte Lockfile-Toolchain. Die Fixtureprüfung variiert zusätzlich Reihenfolge, Zeitstempel, Dateirechte, ZIP-Kommentare und ursprüngliche Kompression. Nutzdatenänderungen ergeben andere Kandidatenbytes; frühere Eingaben und vorhandene Ausgaben bleiben unverändert.

Das belegt Reproduzierbarkeit in der beschriebenen Toolchain, **keine** Bytegleichheit unter beliebigen zukünftigen Python-/zlib-Versionen oder allen Betriebssystemen. Bei einem Kompressor-/Toolchainwechsel muss die Wiederholungsprüfung erneut laufen. Quellstand, Konfiguration, Lockfile und Werkzeugversionen gehören zur Eingabe; Bytegleichheit belegt keine allgemeine Sicherheit oder Signatur.

Der neue Kandidat enthält dieselben **47 Dateien mit 991.421 Nutzdatenbytes** wie der vorherige Stand; neun leere Verzeichniseinträge entfallen. Archivgröße: **269.464 statt 271.936 Byte**. Runtime-Fingerprint bleibt `619d0a65fb8fab903df94691fba08d2f6feffe40ddcd12ea903939fbcfeccea2`; neuer Paket-SHA-256:

```text
44acb38fff48ddff2fc21acd8b2d4e19ed7fb40045c6d05d243728963b24687c
```

Die abweichenden Containerbytes erhalten eigene native Nachweise und übernehmen keine alten Paketfreigaben. [Maschinenlesbarer Build- und Clientbeleg](audits/avn-014b-reproducible-package-2026-11-04.json). Der [Freigabeschritt AVN-014 / #737](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/737) bleibt separat; **1.24.4 ist nicht veröffentlicht**. Windows/macOS, Screenreader, Providerkonten und automatische Updates behalten ihre bisherigen Abnahmevoraussetzungen.

## Wiederholen

```sh
node --test scripts/reproducible-package.test.js scripts/release-integrity.test.js
npm run package
sha256sum build/*.zip
TZ=Pacific/Honolulu npm run package
sha256sum build/*.zip
```

Die Node-Tests prüfen simulierte Archive und kontrollierte Fehlerfälle; sie installieren kein Add-on. Die nativen Linux-Läufe verwenden dagegen genau den neuen Kandidaten mit echten Thunderbird-APIs, GTK-Download und Profilupgrade/-restore. Synthetische Providerbeobachtungen sind keine Live-Providerabnahme. Ein erfolgreicher lokaler Lauf ist kein behaupteter neuer Remote-CI- oder ATN-Nachweis.
