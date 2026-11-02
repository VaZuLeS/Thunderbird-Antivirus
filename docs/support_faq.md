# Support und FAQ — Thundy AV

Stand: 2. November 2026. Veröffentlicht: GitHub 1.24.2 (unsigniert); vorbereitet: 1.24.3. [Aktueller Stand](AKTUELLER_PRODUKTSTAND.md).

## Kontakt

Bugs und Fragen: [GitHub Issues](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues). Sicherheitsmeldungen nicht öffentlich melden, siehe [SECURITY.md](../SECURITY.md). Ansprechpartner: bludau.it.services@gmail.com. Keine API-Schlüssel, vertraulichen Nachrichten, vollständigen privaten URLs oder Profilbackups in öffentliche Tickets hochladen.

## Lokaler Supportbericht im Kandidaten

In den Einstellungen lässt sich ein minimaler Bericht anzeigen und anschließend ausdrücklich lokal speichern. Er enthält Versionen und API-Fähigkeiten; grobe Einstellungen sind abwählbar und standardmäßig nicht enthalten. Schlüssel, Absenderlisten, Nachrichten, URLs, Profilkennungen und Fehlerfreitexte werden nicht aufgenommen. Es gibt keinen automatischen Versand. Vor einer Weitergabe die Vorschau prüfen; gespeicherte Dateien selbst schützen und löschen. Der vollständige Auditexport bleibt eine getrennte Funktion mit sensiblen Originaldaten.

## Häufige Fragen

**Ist die React-Webanwendung mein Thunderbird-Add-on?** Nein. Sie ist eine separate Simulation, nicht im XPI enthalten und nicht mit Thunderbird verbunden. Keine echten Schlüssel oder vertrauliche Post eingeben.

**Funktioniert die Erweiterung ohne Schlüssel?** Ja, lokale Heuristik, HTML-Entschärfung und Linkaudit funktionieren ohne externe Analyse. Das ist kein vollständiger Virenscanner und ein niedriger Score keine Sicherheitsgarantie.

**Was wird extern übertragen?** Nur nach globaler Zustimmung und passenden Rechten/Aktionen. In strict sind Hash-, Domain- und ausdrücklich konfigurierte öffentliche IP-Reputation möglich, ab balanced vollständige Dateien, nur in max vollständige URLs. Inhalte einer hochgeladenen Datei oder URL können vertrauliche Daten enthalten. Anbieterkeys werden zur Authentisierung an den jeweiligen Anbieter gesendet, nicht in Audit-/Profilentwürfe exportiert. Die vollständige [Datenmatrix](privacy_policy.md) beschreibt automatische und manuelle Pfade.

**Was bedeutet OPENED?** Thunderbird hat die Öffnungsanforderung angenommen. Weder Browserstart noch Webseitenbesuch sind bestätigt. Ein Betriebssystem kann eine angenommene Anfrage still blockieren. PENDING bleibt nach einem Prozessverlust eine offene Entscheidung.

**Was löscht „Cache leeren“?** Gespeicherte Analyseergebnisse und Reputationscaches. Linkprotokoll, Einstellungen und Absenderfreigaben sind getrennt. Das Audit besitzt eine eigene bestätigte Löschaktion. Downloads und Backups separat verwalten; siehe [Datenlebenszyklus](DATENLEBENSZYKLUS.md).

**Überleben Daten ein Update?** Echte Linux-Upgrades von 1.24.2 auf Kandidat 1.24.3 mit Neustart und Prozessverlust erhalten bestehende Storagewerte und historische Entscheidungen im geprüften Umfang. Das ist kein Nachweis für jedes OS, Stromausfall oder einen beliebigen Downgrade. Der geprüfte Rückweg ist ein sauber angelegtes vollständiges Profilbackup; nach der Sicherung entstandene Daten liegen außerhalb dieses Snapshots.

**Sind SHA256SUMS eine Signatur?** Nein. Sie vergleichen die heruntergeladenen Bytes mit der referenzierten Prüfsumme. Sie beweisen keine unabhängige Herausgeberidentität und ersetzen keine ATN-Signatur. Veröffentlichung/ATN/Automatik sind getrennte Nachweise.

**Aktiviert ein Enterprise-Profil eine Integration?** Nein. Profile sind deaktivierte Entwürfe. Node-Werkzeuge werden explizit lokal gestartet. Der neue Offline-Auditreview sendet nichts und authentifiziert den Export nicht als Unternehmensgerät. Produktive Cloud-/SSO-/MDM-Anbindung benötigt echte Systeme und gesonderte Abnahme.

## English

Published GitHub release: 1.24.2, unsigned; source candidate: 1.24.3. The React web application is a separate labelled simulation, not the extension. Local checks work without external keys. External analysis requires opt-in, relevant permissions and privacy-tier checks; strict may include hashes, domains and configured public IPs, balanced also files, max also full URLs. OPENED confirms only Thunderbird's accepted opening request; PENDING stays incomplete after process loss. An export checksum is not a signature. Contact [GitHub Issues](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues) or follow SECURITY.md for private security reports.
