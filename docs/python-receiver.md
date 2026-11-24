---
layout: guide
lang: de
title: Python-Empfänger für Sicherheitsmeldungen
---

# Thundy AV – HTTPS-Empfänger mit E-Mail-Weiterleitung

Ein Python-Prozess nimmt Thundy-Ereignisse unter **`POST /thundy/events`** entgegen und verschickt daraus gestaltete HTML-E-Mails mit einer Klartextfassung. Im Beispiel geht die Nachricht an **jan@myville.com**. Der Empfänger quittiert erst nach dem Speichern in SQLite mit HTTP 204. Die Übergabe an das SMTP-Relay läuft separat im selben Prozess.

[English](python-receiver.en.md) · [Dokumentation](guide-de.md)

- [Installation](#installation)
- [HTTPS, SMTP und SQLite](#konfiguration)
- [Test und Thunderbird](#test-und-thunderbird)
- [Betrieb, Aufbewahrung und Wiederholung](#betrieb-und-meldungsinhalt)

**Download** Öffnen Sie unter [GitHub Releases](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/latest) die Assets und laden Sie `thundy-python-receiver-<Version>.zip` herunter. Das entpackte ZIP enthält `receiver.py`, `requirements.txt` und `receiver.example.toml`. Die [TOML-Vorlage im Repository](https://github.com/VaZuLeS/Thunderbird-Antivirus/blob/main/examples/python-receiver/receiver.example.toml) zeigt alle Einstellungsgruppen.

Das Python-Paket ab 1.26.3 enthält die manuelle Wiederholung und den getrennten Speicher für endgültige Zustellfehler. Die Grundinstallation und der HTTPS-Vertrag gelten auch für die vorige Version.

## Installation

Python 3.11 oder neuer verwenden. Das Paket braucht `aiohttp` für den integrierten HTTPS-Server und verwendet die Python-Standardbibliothek für SQLite, TLS und SMTP. [aiohttp-Server](https://docs.aiohttp.org/en/stable/web_reference.html), [Python SMTP und TLS](https://docs.python.org/3/library/smtplib.html)

Unter Linux im Programmordner ausführen.

~~~sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp receiver.example.toml receiver.toml
.venv/bin/python receiver.py token
~~~

Unter Windows `py -m venv .venv` und anschließend `.\.venv\Scripts\python.exe` für die Python-Aufrufe verwenden. `Copy-Item receiver.example.toml receiver.toml` erstellt die Arbeitskonfiguration.

Der Befehl `token` erzeugt ein zufälliges Sendetoken und zeigt dessen SHA-256 an. In Thunderbird das **Token** eingeben. Unter `[clients]` in `receiver.toml` den **Hash** mit einem Gerätenamen eintragen. Für jedes Pilotgerät einen eigenen Eintrag erstellen. Zum Widerruf den betreffenden Hash entfernen und den Prozess neu starten. Beim Tokenwechsel für dasselbe Gerät die Gerätebezeichnung beibehalten.

~~~toml
[clients]
"<hier den ausgegebenen 64-stelligen SHA-256 einsetzen>" = "pilot-pc-01"
~~~

## Konfiguration

1. Unter `[http]` die Bindeadresse und den Port einstellen. `0.0.0.0` bindet alle IPv4-Schnittstellen. Für den Pilot kann eine konkrete interne IP sinnvoll sein. Unter `certificate` die PEM-Zertifikatskette und unter `key` den privaten PEM-Schlüssel angeben. Relative Pfade beziehen sich auf den Ordner von `receiver.toml`. Die URL in Thunderbird muss zum Zertifikatsnamen passen und Thunderbird muss dem Aussteller vertrauen. Ein Endpunkt wie `https://soc.example.com:8443/thundy/events` verwendet direkt den Python-Webserver. Nach einer Zertifikatserneuerung den Dienst neu starten.
2. Unter `[smtp]` das Relay und einen dort freigegebenen Absender konfigurieren. In `from` und `to` jeweils genau eine vollständige ASCII-Mailadresse eintragen. `tls = "starttls"` passt zum Beispiel zu Port 587 und `tls = "implicit"` zu Port 465, sofern das Relay diese Betriebsart anbietet. `tls = "local"` ist für ein unauthentifiziertes Mailrelay auf `127.0.0.1` oder `::1` vorgesehen. Der lokale HTTP-Testmodus erfordert eine Loopback-Bindung und `allow_loopback_http = true`. Thunderbird selbst verwendet den HTTPS-Endpunkt.
3. Bei konfiguriertem SMTP-Benutzernamen das Passwort als Umgebungsvariable des Dienstes setzen. Standardname ist `THUNDY_SMTP_PASSWORD`. Unter `[storage]` den Pfad zur SQLite-Datei so wählen, dass der Dienst dort schreiben kann. Zugang zum Konfigurationsordner, privaten Schlüssel und SQLite-Verzeichnis auf das Dienstkonto und die Administratoren begrenzen.
4. Empfänger mit `.venv/bin/python receiver.py serve --config receiver.toml` starten. Änderungen an der Serverkonfiguration werden beim Prozessneustart eingelesen. `.venv/bin/python receiver.py status --config receiver.toml` zeigt Rückstau, offene Zustellfehler und die letzte SMTP-Annahme.

### Beispiel für Dauerbetrieb mit systemd

Die Runtime-Dateien und die virtuelle Python-Umgebung liegen hier unter `/opt/thundy-receiver`. `receiver.toml` liegt unter `/etc/thundy` und `[storage].database` verwendet `/var/lib/thundy-receiver/events.sqlite3`. Die Konfiguration und Zertifikatsdateien für das Dienstkonto `thundy` lesbar machen. Eine SMTP-Umgebungsdatei nur für Root lesbar ablegen, beispielsweise mit einem Eintrag `THUNDY_SMTP_PASSWORD=…`.

~~~ini
[Unit]
Description=Thundy AV HTTPS receiver and SMTP outbox
After=network-online.target
Wants=network-online.target

[Service]
User=thundy
Group=thundy
StateDirectory=thundy-receiver
UMask=0077
EnvironmentFile=-/etc/thundy/smtp.env
ExecStart=/opt/thundy-receiver/.venv/bin/python /opt/thundy-receiver/receiver.py serve --config /etc/thundy/receiver.toml
Restart=on-failure
TimeoutStopSec=90
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
~~~

Die Unit unter `/etc/systemd/system/thundy-receiver.service` speichern. Nach Anlage des Dienstkontos `sudo systemctl daemon-reload` und `sudo systemctl enable --now thundy-receiver` ausführen. `sudo journalctl -u thundy-receiver` zeigt Aufnahme und SMTP-Zustellung anhand der Ereignis-ID.

## Test und Thunderbird

In `policies.json` unter `thundyPolicy.reporting` die genaue HTTPS-Adresse eintragen. Mit `"mode": "suspicious"` meldet Thundy auch erreichte Schwellenwerte. Mit `"indicators": true` fügt Thundy bei Links den Hostnamen und bei Anhängen den SHA-256 hinzu. Mit `"details": true` kommen unter anderem Dateiname und Anbieterbefunde hinzu. Nach dem Neustart in Thundys Einstellungen Empfänger und Datenumfang bestätigen, Hostfreigabe erteilen und das Geräte-Token hinterlegen. [Unternehmensrichtlinien und Eventfelder](UNTERNEHMENSRICHTLINIE.md)

Für einen Pilot ohne externe Scans die Linkschwelle vorübergehend auf **0**, die Aktion auf **block** und die Melderegel auf **suspicious** setzen. Eine harmlose HTTPS-Adresse aus einer Testmail anklicken, die Ereignis-ID im lokalen Linkprotokoll und in der E-Mail vergleichen und die Pilotwerte anschließend zurücksetzen. Nach jeder Richtlinienänderung Thunderbird neu starten.

Für einen direkten Test desselben Endpunkts `event.json` mit folgendem Inhalt speichern. Für ein neues Ereignis eine neue UUID im JSON und im Header `Idempotency-Key` einsetzen.

~~~json
{
  "schemaVersion": 1,
  "id": "a1c8080d-5c2e-491e-a163-000000000001",
  "observedAt": "2026-11-23T09:00:00.000Z",
  "action": "link_open",
  "finding": "suspicious",
  "decision": "warn",
  "policyRevision": 1,
  "hostname": "example.org",
  "details": {
    "reason": "threshold",
    "score": 50,
    "threshold": 50,
    "providers": []
  }
}
~~~

~~~bash
read -r -s THUNDY_TEST_TOKEN
curl --include --fail-with-body \
  -H "Authorization: Bearer $THUNDY_TEST_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: a1c8080d-5c2e-491e-a163-000000000001' \
  --data-binary @event.json https://soc.example.com:8443/thundy/events
unset THUNDY_TEST_TOKEN
~~~

| Antwort | Prüfung |
| --- | --- |
| `204` | SQLite hat die Meldung aufgenommen oder kennt eine identische Meldung vom selben Gerät. Bei ausbleibender E-Mail den Empfängerstatus und die SMTP-Protokolle prüfen. |
| `401` | Token, zugehörigen Hash unter `[clients]` und letzten Empfängerneustart prüfen. |
| `409` | Die Ereignis-ID gehört zu anderen Daten oder einem anderen Gerät. Für einen neuen Test eine neue UUID verwenden. |
| `422` | Pflichtfelder, Typen und Berichtsreferenzen prüfen. |
| `503` | Aktive Warteschlange und Zugriff auf SQLite prüfen. |

## Betrieb und Meldungsinhalt

Die E-Mail führt Ereignis-ID, Gerät, Zeit, Auslöser, Aktion, Thundy-Befund und Entscheidung zusammen. Der Entscheidungsscore und die Firmenschwelle stehen getrennt von Anbieterwerten. Je Anbieter erscheinen Urteil und Herkunft, verfügbare Zeit, Score, Referenzen und Erkennungszahlen. Für Hybrid Analysis führt **Bericht ansehen** zur Sample-Übersicht und die Job-ID identifiziert, sofern geliefert, den betreffenden Lauf. urlscan.io liefert seine Scan-Ansicht. Der E-Mail-Empfänger kann die Berichte mit den Berechtigungen seines Anbieterkontos aufrufen. Bei einem lokalen Verdacht ohne Anbieterbefund kennzeichnet die Mail das leere Ergebnis ausdrücklich.

Der aktuelle Empfänger akzeptiert zusätzlich Events der Version 2. Damit kann eine Meldung etwa **Trojaner · Emotet** oder **Phishing · PayPal** ausweisen. Ältere Versionen einer Installation sehen weiterhin dieselben Version-1-Ereignisse, solange `reporting.detections` ausgeschaltet ist. Aktivieren Sie das Feld erst nach dem Empfänger-Update und der erneuten Zustimmung in Thunderbird. Die Gruppierung zählt ein Ereignis je Erkennung einmal, auch wenn mehrere Dienste dieselbe Bezeichnung liefern. Buchstabenvarianten werden zusammengefasst, verschiedene Anbieternamen bleiben eigenständig.

~~~sh
.venv/bin/python receiver.py status --config receiver.toml
.venv/bin/python receiver.py retry --event-id a1c8080d-5c2e-491e-a163-000000000001 --config receiver.toml
.venv/bin/python receiver.py groups --by family --config receiver.toml
.venv/bin/python receiver.py groups --by brand --config receiver.toml
~~~

`groups` unterstützt `family`, `category`, `brand` und `signature`. Die Ausgabe nennt die Bezeichnung, Ereignisanzahl und den letzten Empfang. Mit `--limit` lässt sie sich auf 1 bis 500 Gruppen begrenzen. Die Gruppierungsdaten bleiben zusammen mit den Ereignismetadaten erhalten und werden mit ihnen aus SQLite entfernt.

Vorübergehende Fehler führen zu gestaffelten Wiederholungen. Fehler bei der Verbindung zum Relay, bei der SMTP-Anmeldung oder in der Relay-Konfiguration bremsen den Versand für alle Meldungen und erscheinen mit dem Zeitpunkt des nächsten Versuchs in `status`. Meldungen, die sieben Tage seit HTTP-Empfang ausstehen, geben ihren Platz in der aktiven Warteschlange frei und verlieren ihren Inhalt.

Endgültig abgelehnte Meldungen verlassen die aktive Warteschlange sofort. Der Empfänger hält ihren Inhalt bis zu sieben Tage in einem separaten Bestand mit höchstens `queue_limit` Einträgen. Bei ausgeschöpfter Kapazität entfernt er den ältesten wiederholbaren Inhalt zuerst. `status` listet die wiederholbaren Ereignisse mit ID, Fehler und Ablaufzeitpunkt auf. Nach Behebung der Ursache lässt sich eine Meldung mit `receiver.py retry --event-id <UUID> --config receiver.toml` erneut einreihen. Die Ereignis-ID und die `Message-ID` der E-Mail bleiben gleich. Bei voller aktiver Warteschlange meldet der Befehl einen Fehler und der Inhalt bleibt bis zum ursprünglichen Ablaufzeitpunkt erhalten.

Nach SMTP-Annahme entfernt der Empfänger den Inhalt aus SQLite. Empfangs- und Zustellmetadaten bleiben standardmäßig 30 Tage erhalten. HTTP 204 quittiert die Aufnahme in SQLite, SMTP-Annahme quittiert die Übergabe an das Relay. Fällt der Prozess nach SMTP-Annahme unmittelbar vor dem SQLite-Update aus, kann eine erneute E-Mail mit derselben Ereignis-ID und `Message-ID` entstehen.

Im Quellrepository prüft `python -m unittest discover -v -s examples/python-receiver` den Vertrag mit dem JavaScript-Sender, die HTTPS-Annahme und die SMTP-Zustellung. Für die Vertragstests braucht die Testumgebung Node.js und für das lokale HTTPS-Zertifikat OpenSSL. Der laufende Empfänger benötigt beides nicht.
