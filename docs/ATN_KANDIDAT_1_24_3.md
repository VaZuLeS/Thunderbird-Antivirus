# ATN-Einreichungspaket 1.24.3 — Vorbereitung, keine Einreichung

## Konkret vorbereitet

- XPI-kompatibles Archiv `build/thundy_av_email_scanner_for_thunderbird-1.24.3.zip` mit 44 geprüften Runtime-/Lizenzdateien. SHA-256 und Testevidenz: [Kandidatenprotokoll](live_test_1_24_3.md).
- Aktuelle [Datenmatrix](privacy_policy.md), sechs lokalisierte öffentliche Sprachseiten, [Support](support_faq.md), [Release-Notizen](releases/1.24.3.md), [native Abnahmegrenzen](NATIVE_ABNAHME_2026-11.md).
- Aktive GitHub-Veröffentlichung prüft denselben getesteten Kandidaten und überschreibt keine bestehenden Assets. Eine Prüfsumme ist keine Signierung.
- Optionale Host-/Datenberechtigungen im Manifest, Freigabe/Widerruf/Stufen und externe Providerfehler sind lokal geprüft. Runtime- und Enterprise-/Demoscope sind abgegrenzt.

## Aktuelle echte Linux-Aufnahmen

Vorbereitet unter `docs/screenshots/1.24.3/`: `native-popup.png`, `audit.png`, `options-dark.png`, `link-dialog.png` soweit im direkten Lauf erzeugt. Sie stammen vom tatsächlich geprüften Kandidaten unter Thunderbird 153 ESR, nicht von der React-Demo. Finale Store-Motive/Sprachwahl und native Zielsysteme bleiben bei der tatsächlichen Einreichung zu kuratieren.

## Konkrete Voraussetzung vor dem Versand

1. Maintainer liest den tatsächlichen ATN-Eintrags-/Versionsstatus über seinen zugelassenen Zugang. Öffentlicher Leseversuch über das hier verfügbare Webwerkzeug war nicht zugänglich; daraus folgt kein belegtes 404 oder globales Fehlen eines Eintrags.
2. Bereitgestellter Maintainerzugang und zulässiger Distributionskanal; für Automation passende ATN-API-Credentials. Hier sind keine solchen Secrets/Identitäten eingerichtet. Keine Secrets im Repository speichern.
3. Freigegebenes unveränderliches Kandidatenpaket, Reviewerinformationen und kuratiertes aktuelles Screenshotset; native Prüflücken offen benennen. Historische Store-Listingfelder nicht ungeprüft kopieren.
4. Tatsächliche externe Providerabnahme nur mit passenden Testkonten und erlaubten Testdaten. Fehlende Providerprüfung nicht als bestanden beschreiben.
5. Erst dann signieren/einreichen und den tatsächlichen Reviewstatus sowie die Store-URL dokumentieren. Den unterstützten automatischen Updatekanal mit zwei geeigneten Versionen separat testen.

**Status:** Vorbereitung vorhanden; Signierung, Einreichung, Listung und automatische Verteilung nicht ausgeführt. Ein lokales GO des Kandidatengates ist keine ATN-Freigabe. Externe Reviewzeit bleibt unbestimmt.
