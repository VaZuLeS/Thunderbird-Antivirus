# Veröffentlichung 1.25.9 — 19. November 2026

Thundy AV 1.25.9 ist auf GitHub als unsigniertes XPI verfügbar. Der Release-Workflow hat das geprüfte Paket unverändert veröffentlicht. [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.9) · [Release-CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/44425122989)

XPI, Prüfsummendatei und Abnahme-JSON wurden unabhängig per HTTPS heruntergeladen. Manifestversion, SHA-256, GitHub-Asset-Digests, Quellfingerprint, Tag-Commit und Pflichtmatrix stimmen überein. Die XPI-Prüfsumme lautet `21c4df27b24211268f7a96873c43da26eba93b28be84b6d7f9f37cebc388c661`. [Maschinenlesbarer Veröffentlichungsnachweis](audits/release-1.25.9.json)

Die CI prüfte das direkte Upgrade vom veröffentlichten 1.25.8-Paket, Neustarts nach Prozessverlust und die vollständige Wiederherstellung des gesicherten Profils auf beiden Linux-Clientlinien in allen sechs Produktsprachen. Die historischen Entscheidungen und offenen Audit-Einträge blieben erhalten. Sichern Sie neue Daten aus der Zeit nach dem Backup separat, bevor Sie das alte Profil wiederherstellen. [Abnahmeprotokoll](live_test_1_25_9.md)

1.25.9 enthält unter anderem die lokale Scoreanzeige ohne externe Dienste, begrenzte Wartezeiten beim Linkdialog, die Admin-geschützte API-Diagnoseansicht, den Hybrid-Berichtstab und die konfigurierbare Schutzregel für „Mit Thundy speichern“. Die Anbieterprüfungen der CI verwenden synthetische Antworten. Windows, macOS, Screenreader, ATN-Signierung und automatische Updates bleiben offen. [Releaseumfang](releases/1.25.9.md)
