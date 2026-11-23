# Veröffentlichung 1.26.2

Thundy AV 1.26.2 ist als unsigniertes XPI auf GitHub verfügbar. Der Python-Empfänger liegt als separater Download bei. [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.26.2) · [Python-ZIP](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/download/v1.26.2/thundy-python-receiver-1.26.2.zip)

Der unabhängige Downloadabgleich hat Manifest, Paketdateien, Tag-Commit, Paketprüfsumme und die Hashes aller vier Release-Dateien bestätigt. Die XPI-SHA-256 lautet `abe2a8d2f766ab7ab88ccb64f6cf5d7223dea68181fec22fff0d23fb549cc30c`. [Maschinenlesbarer Nachweis](audits/release-1.26.2.json)

Die Release-CI prüfte das Upgrade von 1.25.9 und den Profilrückweg in 12 Fällen. Die Linux-Thunderbird-Clients waren 153.7.0 (current), 140.12.0 (minimum). Die Browserprüfung deckte alle sechs Sprachen ab. [Release-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/45195676935) · [Abnahmeprotokoll](live_test_1_26_2.md)

Der separate Tag-Lauf stoppte bei einer zeitabhängigen Prüfung der Nachrichtenansicht. Das veröffentlichte XPI und der Abnahmenachweis stammen aus dem vollständigen erfolgreichen CI-Lauf desselben Commits auf `main`. In der Folge wartet der native Test auf die sichtbare Aktualisierung der Quellenansicht. [Tag-Lauf](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/45198513589)
