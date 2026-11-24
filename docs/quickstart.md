---
layout: guide
lang: de
title: Entwicklungsumgebung für Thundy AV
---

# Thundy AV lokal entwickeln und prüfen

[Installation des veröffentlichten XPI](guide-de.md#installieren) · [English build commands](https://github.com/VaZuLeS/Thunderbird-Antivirus#develop-and-verify)

## Voraussetzungen und Installation

Verwenden Sie Node.js 24 oder neuer, npm und Python 3 für die Paketwerkzeuge. Für einen echten Clienttest ist Thunderbird 140 oder neuer erforderlich. Ein eigenes Testprofil hält Prüfdaten von Ihrer regulären Mailumgebung getrennt.

```sh
git clone https://github.com/VaZuLeS/Thunderbird-Antivirus.git
cd Thunderbird-Antivirus
npm ci
```

## Prüfungen und Paket

```sh
npm run check:docs
npm run check
npm run check:ui -- --browser /absoluter/pfad/zu/chromium
```

`npm run check` prüft Quellen, Tests, Lint und Paketinhalt. `npm run package` baut nur das verifizierte Erweiterungspaket unter `build/`. Die UI-Matrix nutzt simulierte Erweiterungs-APIs. [Prüfung mit echtem Thunderbird](THUNDERBIRD_LINUX_ABNAHME.md)

## Im Testprofil laden

1. In Thunderbird **Add-ons und Themes** öffnen.
2. Im Zahnradmenü **Add-ons debuggen** wählen.
3. **Temporäres Add-on laden** wählen und `manifest.json` im Repository öffnen.
4. Nach einem Thunderbird-Neustart das temporäre Add-on erneut laden.

Ein erster Test läuft mit einer synthetischen Mail ohne API-Schlüssel. Öffnen Sie eine Nachricht mit harmlosem Link und Anhang und prüfen Sie die Nachrichtenübersicht, den Linkdialog und **Mit Thundy speichern**. Für externe Anbieter, verwaltete Richtlinien und HTTPS-Meldungen gelten die jeweiligen Freigaben. [Datenschutz und Einstellungen](guide-de.md#anbieter-und-datenschutz) · [Python-Empfänger separat testen](python-receiver.md#test-und-thunderbird)

`npm run dev` startet die separate React-Webdemo. Das Thunderbird-XPI entsteht über `npm run package`.
