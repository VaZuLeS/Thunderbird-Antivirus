# Freigabeumfang Thundy AV 1.25.0

Diese Version enthält die [neuen Ergebnisansichten, gemeinsamen Anbieterregeln und optionale lokale Administration mit Linkfreigabe](EXTERNE_ANALYSEN_UND_LINKFREIGABE.md). Die vollständigen Änderungen stehen in den [Release-Notizen](releases/1.25.0.md).

Der [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.0) liefert ein unsigniertes XPI und SHA256SUMS.txt. Eine Quellcodeversion oder ein Tag allein bestätigt noch keine Veröffentlichung; maßgeblich sind die veröffentlichten Downloadbytes. Bestehende Releases werden nicht überschrieben.

Der lokale Nachweis umfasst die vollständige Node-Testsuite, Quell-/Übersetzungs-/Dokumentationsprüfungen, gefiltertes Thunderbird-Linting, Webdemo-Build, 34 Browserprüfungen und die native Prüfung des Passwort-/Freigabeablaufs unter Linux mit Thunderbird 153.5.1 ESR. Nach Änderung der Versionsnummer wurde das 1.25.0-Paket erneut aufgebaut und die native Passwort-/Freigabeabnahme bestanden. Der GitHub-Workflow prüft zusätzlich seine eigene Browser-/Clientmatrix und bindet den Kandidaten an die exakten Paketbytes.

[Versionsgebundenes Prüfprotokoll](live_test_1_25_0.md). Keine Prüfung mit produktiven API-Schlüsseln, keine Windows-/macOS-Freigabe und keine ATN-Signierung. Die neue lokale Schutzregel ist nach Upgrade ausgeschaltet. Eine zentrale Geräteverwaltung ist nicht enthalten.
