# Exportnavigation — native Untersuchung AVN-011.b

Stand: **4. November 2026**. Ergebnis zu [GitHub-Aufgabe #733](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/733): Die untersuchte Rückkehr zur Exportseite funktioniert unter Linux mit Thunderbird **140.12.0 und 153.6.0**. Eine Runtimeänderung ist für die beobachteten Fälle nicht begründet. Der [Quellenexport](QUELLENEXPORT.md) und dessen Datenschutz-/Kontextvertrag bleiben unverändert.

## Ausgangshypothese und Abgrenzung

`source_export.js::mount` entsorgt die Seite bei `pagehide`; die Initialisierung läuft über `DOMContentLoaded`. Bei einer Wiederherstellung **desselben Dokuments** aus dem Back/Forward-Cache könnte diese Kombination problematisch sein. Ob Thunderbird eine solche Wiederherstellung tatsächlich vornimmt, war jedoch unbewiesen. Eine künstlich ausgelöste `pageshow`-Nachricht wäre dafür kein nativer Nachweis und kein ausreichender Grund, alte Vorschauen wieder zu aktivieren.

Der Prüfer `tools/thunderbird-live.dev.py::probe_source_export_navigation` nutzt deshalb echte Navigation im selben Thunderbird-Inhaltstab: Exportseite mit fertiger Vorschau → Einstellungsseite → `history.back()`. Ein nur im ursprünglichen Fenster gesetzter Marker sowie aufgezeichnetes `pagehide.persisted` unterscheiden Dokumentwiederverwendung von einem neuen Ladevorgang. Sessionstorage erhält ausschließlich synthetische Ereignismetadaten; Export-URL und Kontexttoken werden nicht in den neuen Navigationsbeleg übernommen.

## Beobachtetes Verhalten

| Fall, jeweils unter 140 und 153 | Ergebnis |
| --- | --- |
| Rückkehr ohne zwischenzeitliche Änderung | Neues Dokument; `pagehide.persisted: false`, Navigationstyp `back_forward`. Alte Vorschau leer, Speichern deaktiviert. Erst der ausdrückliche Vorschauaufruf liest den weiterhin gültigen Kontext und erzeugt eine neue Vorschau. |
| Cachelöschung während der Einstellungsseite, danach Rückkehr | Ebenfalls neues Dokument und leere Vorschau. Der ausdrückliche Vorschauaufruf meldet den nicht mehr verfügbaren Kontext; Speichern bleibt deaktiviert. Der alte Link wird nicht neu gebunden. |
| Bestehender Exportablauf im selben Lauf | Echter Popup-Einstieg, Vorschau/Abbruch, abgeschlossener GTK-Download mit exakt passendem JSON, Cachelöschung und Ablehnung des alten Links nach echtem Neustart bestehen weiterhin. |

Der [maschinenlesbare Beleg](audits/avn-011b-export-navigation-2026-11-04.json) enthält beide Endläufe mit Zeitpunkten, Client-/Runner-/Paket-Hashes und den beobachteten Ereignissen. Zwei vorläufige Einzelfallläufe bestätigten zuvor bereits das neue Dokument bei unverändertem Kontext; die endgültigen Nachweise decken zusätzlich die Löschung während der Abwesenheit ab.

**Entscheidung:** AVN-011.b ist als begrenzte Untersuchung abgeschlossen. Es gibt hier keinen belegten Lifecycledefekt, den eine vorsorgliche Runtimeänderung beheben würde. Insbesondere wird keine Wiederanmeldung alter Vorschauen oder Aufweichung der Tokenbindung eingeführt. Die neue native Regression verlangt leere/gesperrte Ausgangszustände und korrektes Verhalten nach ausdrücklichem Vorschauaufruf; sie schreibt nicht vor, ob Thunderbird künftig ein neues Dokument lädt oder eines wiederverwendet.

## Wiederholbare Validierung

```sh
node --test test/source-export.test.js
python3 tools/test_thunderbird_identity.dev.py -v
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.4.xpi \
  --source-export-check --out /absolute/path/to/new-result-directory
```

Die sieben Export-Vertragstests sind **simuliert**, die drei Python-Regressionen prüfen vorhandene Byteverträge des Prüfrunners. Die beiden Linux-Endläufe verwenden **echte Thunderbird-APIs, Dokumentnavigation und Downloads**, jedoch synthetisch eingespeiste Providerbeobachtungen und keine Livekonten. Der bestehende CI-Schritt `--source-export-check` führt die beiden neuen Navigationsfälle künftig mit aus. Ein neuer erfolgreicher Remote-CI-Lauf wird daraus nicht behauptet.

Runtime-Fingerprint bleibt `619d0a65fb8fab903df94691fba08d2f6feffe40ddcd12ea903939fbcfeccea2`; das exakt wiederverwendete und erneut nativ geprüfte Paket hat SHA-256 `6bd778b040afdff8891c753a46e0707e8c8826849b6266e6568092e1603b515e`. Es gab keinen Neubau und keine Änderung veröffentlichter oder signierter Archive. Version **1.24.4 bleibt unveröffentlicht**.

## Grenzen und weitere Prioritäten

Eine tatsächliche Wiederherstellung desselben Dokuments aus dem Back/Forward-Cache wurde **nicht beobachtet**. Der Gegenbefund gilt für die beschriebenen Inhaltstabs und Versionen, nicht für alle Thunderbirdversionen, Profilkonfigurationen, Betriebssysteme oder Navigationsarten. Sollte ein konkreter Wiederherstellungsfall auftreten, ist er mit Paket-/Clientbindung zu reproduzieren und gegebenenfalls #733 wieder zu öffnen. Windows/macOS und Screenreader bleiben [#729](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/729).

Als nächstes lokal ausführbares Paket bietet sich [AVN-014.b / #736](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/736) an: reproduzierbaren Archivaufbau vor Kandidatentest und Signierung herstellen. Bei der Vorbereitung fällt zusätzlich auf, dass `scripts/build-and-verify-package.js` noch über `npx web-ext` startet; die Untersuchung soll deshalb auch den ausdrücklich lokal gepinnten Werkzeugaufruf berücksichtigen, wie ihn das Lintgate bereits nutzt. Das ist Teil desselben Buildvertrags und keine neue Doppelaufgabe. Inhalt-/Vorkommensbindung und Retention bleiben [AVN-009 / #725](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/725), erfolgreiche Cryptoabnahmen [AVN-003 / #726](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues/726).
