---
layout: guide
lang: de
title: Support und FAQ / Support and FAQ
---

# Support und FAQ — Thundy AV

[English](#english) · [Dokumentation](guide-de.md) · [Aktueller Veröffentlichungsstand](AKTUELLER_PRODUKTSTAND.md)

## Kontakt

Bugs und Fragen: [GitHub Issues](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues). Sicherheitslücken bitte über den in der [Sicherheitsrichtlinie](https://github.com/VaZuLeS/Thunderbird-Antivirus/security/policy) beschriebenen privaten Weg melden. API-Schlüssel, Nachrichten, private URLs und Profilbackups gehören in geschützte Kanäle.

## Lokaler Supportbericht

In den Einstellungen lässt sich ein minimaler Bericht anzeigen und anschließend ausdrücklich lokal speichern. Er enthält Versionen und API-Fähigkeiten; grobe Einstellungen sind abwählbar und standardmäßig nicht enthalten. Schlüssel, Absenderlisten, Nachrichten, URLs, Profilkennungen und Fehlerfreitexte werden nicht aufgenommen. Es gibt keinen automatischen Versand. Vor einer Weitergabe die Vorschau prüfen; gespeicherte Dateien selbst schützen und löschen. Der vollständige Auditexport bleibt eine getrennte Funktion mit sensiblen Originaldaten.

## Lokale Darstellungsprofile

In den Einstellungen können Darstellung, Akzent und Dichte als JSON exportiert und per Datei oder eingefügtem JSON importiert werden. Erst die Vorschau prüfen, dann die angezeigten Änderungen bestätigen. Geänderte Ausgangswerte verlangen eine neue Vorschau. Importiert werden keine Schlüssel, Zustimmungen, Schutzregeln oder historischen Daten; Enterprise-Profile bleiben getrennte Entwürfe.

## Häufige Fragen

**Ist die React-Webanwendung mein Thunderbird-Add-on?** Nein. Sie ist eine separate Simulation, nicht im XPI enthalten und nicht mit Thunderbird verbunden. Keine echten Schlüssel oder vertrauliche Post eingeben.

**Funktioniert die Erweiterung ohne Schlüssel?** Ja, lokale Heuristik, HTML-Entschärfung und Linkaudit funktionieren ohne externe Analyse. Das ist kein vollständiger Virenscanner und ein niedriger Score keine Sicherheitsgarantie.

**Was wird extern übertragen?** Der Scanmodus steuert die Anbieterabfragen mit Einwilligung. Im Entwicklungsstand verlangen vollständige Dateien und URLs eine Einzelfreigabe im Popup. Die [Datenmatrix](privacy_policy.md#deutsch) nennt die Bedingungen und den Unterschied zur veröffentlichten 1.26.2.

**Wo ist der Python-Empfänger und warum fehlt eine E-Mail?** Der Download liegt als eigenes ZIP im GitHub-Release. Die [Empfängeranleitung](python-receiver.md) erklärt SMTP, das Testereignis und die Statusabfrage. HTTP 204 bestätigt die Aufnahme in SQLite. Bei einer fehlenden E-Mail `status`, das Relay-Protokoll und den Posteingang prüfen.

**Was bedeutet OPENED?** Thunderbird hat die Öffnungsanforderung angenommen. Weder Browserstart noch Webseitenbesuch sind bestätigt. Ein Betriebssystem kann eine angenommene Anfrage still blockieren. PENDING bleibt nach einem Prozessverlust eine offene Entscheidung.

**Was löscht „Cache leeren“?** Gespeicherte Analyseergebnisse und Reputationscaches. Linkprotokoll, Einstellungen und Absenderfreigaben sind getrennt. Das Audit besitzt eine eigene bestätigte Löschaktion. Downloads und Backups separat verwalten; siehe [Datenlebenszyklus](DATENLEBENSZYKLUS.md).

**Wie sichere ich Daten vor einem Update?** Thunderbird vollständig beenden und das Profil sichern. Der Wiederherstellungsweg und die geprüften Versionswechsel stehen im [Produktstand](AKTUELLER_PRODUKTSTAND.md) und [Datenlebenszyklus](DATENLEBENSZYKLUS.md).

**Sind SHA256SUMS eine Signatur?** Nein. Sie vergleichen die heruntergeladenen Bytes mit der referenzierten Prüfsumme. Sie beweisen keine unabhängige Herausgeberidentität und ersetzen keine ATN-Signatur. Veröffentlichung/ATN/Automatik sind getrennte Nachweise.

**Aktiviert ein Enterprise-Profil eine Integration?** Nein. Profile sind deaktivierte Entwürfe. Node-Werkzeuge werden explizit lokal gestartet. Der neue Offline-Auditreview sendet nichts und authentifiziert den Export nicht als Unternehmensgerät. Produktive Cloud-/SSO-/MDM-Anbindung benötigt echte Systeme und gesonderte Abnahme.

## English

[Documentation and contents](guide-en.md) · [Public issue tracker](https://github.com/VaZuLeS/Thunderbird-Antivirus/issues) · [Private security reporting](https://github.com/VaZuLeS/Thunderbird-Antivirus/security/policy)

**Does Thundy work without API keys?** Local checks, HTML disarming and the audit work without external analysis. For optional provider transfers see the [data-flow matrix](privacy_policy.md#english).

**Where is the Python receiver?** Download its ZIP from GitHub release assets. The [receiver guide](python-receiver.en.md) covers configuration, credentials and a test event. An HTTP 204 confirms SQLite intake. If there is no email, check `status` and the SMTP relay logs.

**What does `OPENED` mean?** Thunderbird accepted an opening request. `PENDING` still represents an incomplete decision after process loss. The local audit reflects the decision at the time of the attempt.

**What does Clear cache remove?** Stored analysis and reputation data. The link audit has its own deletion command. Settings, sender authorizations, exported files and profile backups have separate controls.

**Does a checksum prove who published the XPI?** The checksum verifies the file bytes against a reference. Thunderbird Add-ons signing is a separate verification.
