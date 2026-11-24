---
layout: guide
lang: de
title: Dokumentation auf Deutsch
---

# Thundy AV — Dokumentation

[English](guide-en.md) · [Downloads und weitere Sprachen](index.html)

- [Installieren](#installieren)
- [Nachrichten, Links und Anhänge prüfen](#schutz-im-mailalltag)
- [Analyseanbieter und Datenschutz](#anbieter-und-datenschutz)
- [Firmenrichtlinien und Sicherheitsmeldungen](#unternehmen)
- [Support, Entwicklung und Versionsnachweise](#support-und-entwicklung)

## Installieren

Thundy AV ist eine Erweiterung für Thunderbird ab **140**. Laden Sie das freigegebene XPI und `SHA256SUMS.txt` vom selben [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/latest). Prüfen Sie den SHA-256-Wert der Datei. Öffnen Sie in einem Testprofil den Add-ons-Manager und wählen Sie **Add-on aus Datei installieren**. Eine als unsigniert gekennzeichnete GitHub-Version hat keine Signatur von Thunderbird Add-ons.

Der Einrichtungsassistent führt durch die Sprache, den Linkschutz und die optionale Anbieteranalyse. Die lokale Prüfung funktioniert ohne Schlüssel. Für Darstellung und Informationsdichte gibt es Einstellungen für Hell, Dunkel, Thunderbird-Theme und die einfache oder erweiterte Ansicht.

## Schutz im Mailalltag

- Die Nachrichtenübersicht zeigt den Befund und den aufklappbaren [lokalen Score mit Einzelpunkten](LOCAL_SCORE.md#deutsch). Unter **Prüfdetails** stehen Prüfumfang und Anbieterbefunde. In der Ressourcenansicht lassen sich Erkennungen nach Familie, Kategorie, Marke oder Signatur gruppieren.
- Der Linkdialog zeigt den Schweregrad, den Stand der URL-Scans und vorliegende Bedrohungskategorien, Marken und Malware-Familien. Unter **Fachansicht** lassen sich die verfügbaren Anbieterbelege und die Einzelpunkte der lokalen Bewertung aufklappen. Für Anhänge verwenden Sie **Mit Thundy öffnen** oder **Mit Thundy speichern**.
- Unter **Administration und Schutz** können Sie auf laufende Scans warten lassen, direkte Öffnungen unterhalb einer Schwelle erlauben und das Linkprotokoll auch ohne feste Höchstzahl aufbewahren. Direkte Browserübergaben bleiben als „Automatisch geöffnet“ nachvollziehbar. Bei aktivierten Firmenmeldungen verbindet die Ereignis-ID das lokale Protokoll mit dem Vorfall.

## Anbieter und Datenschutz

Anbieter werden einzeln in den Einstellungen eingerichtet und können mit gespeichertem Schlüssel pausiert werden. Die dort verlinkten Anleitungen erklären die Schlüsselvergabe. Hybrid Analysis und VirusTotal prüfen Dateihashes, URLhaus bewertet Domains und AbuseIPDB oder VirusTotal prüfen öffentliche IP-Adressen. Hybrid Analysis und urlscan.io können zusätzlich vollständige Links untersuchen.

Im **Entwicklungsstand** können automatische Prüfungen abhängig vom Modus, von der Einwilligung und von der Hostfreigabe Hashes, Domains und öffentliche IPs abfragen. Vollständige Links und Dateien benötigen eine Einzelfreigabe im Popup. Bereits angenommene Anbieteraufträge lassen sich anhand ihrer Kennung weiter abfragen. Die [Datenmatrix](privacy_policy.md#deutsch) beschreibt die übertragenen Daten und die lokale Aufbewahrung. Die [Scanmodi im Detail](AUTOMATISCHE_PRUEFUNGEN.md) erklären außerdem, was bei vollem Quellenarchiv angezeigt wird.

## Unternehmen

1. [Thunderbird und `policies.json` einrichten](UNTERNEHMENSRICHTLINIE.md). Die IT kann Links und Anhänge getrennt steuern und Sicherheitsmeldungen für einen internen HTTPS-Endpunkt freigeben.
2. [Python-Empfänger installieren und konfigurieren](python-receiver.md). Der eigenständige Server speichert Meldungen in SQLite und verschickt sie per SMTP an ein konfigurierbares Postfach.
3. [Testereignis und E-Mail-Zustellung prüfen](python-receiver.md#test-und-thunderbird). Dieselbe Ereignis-ID verbindet Thunderbird, Empfängerstatus und E-Mail. Feldumfang und Berichtsreferenzen stehen im [Meldevertrag](UNTERNEHMENSRICHTLINIE.md#https-empfänger-und-einrichtung).

## Support und Entwicklung

- [Support und häufige Fragen](support_faq.md) · [Aufbewahrung, Löschung und Migration](DATENLEBENSZYKLUS.md)
- [Entwicklungsumgebung](quickstart.md) · [Architektur und Prüfkommandos im Repository](https://github.com/VaZuLeS/Thunderbird-Antivirus#develop-and-verify)
- [Veröffentlichter Stand und Prüfnachweise](AKTUELLER_PRODUKTSTAND.md) · [Release-Historie](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases)

Die React-Demo simuliert Entscheidungen im Browser. Die optionalen Node-Werkzeuge bearbeiten lokale Enterprise-Daten. Der Python-Empfänger ist der eigenständige Dienst für HTTPS-Meldungen und SMTP-Zustellung.
