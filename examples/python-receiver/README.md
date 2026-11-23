# Thundy AV – HTTPS-Empfänger mit E-Mail-Weiterleitung

Ein Python-Prozess nimmt Thundy-Ereignisse unter **`POST /thundy/events`** entgegen und verschickt daraus gestaltete HTML-E-Mails mit einer Klartextfassung. Im Beispiel geht die Nachricht an **jan@myville.com**. Der Empfänger quittiert erst nach dem Speichern in SQLite mit HTTP 204. Die Übergabe an das SMTP-Relay läuft separat im selben Prozess.

## 1. Programm und Konfiguration vorbereiten

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

## 2. HTTPS und SMTP einrichten

1. Unter `[http]` die Bindeadresse und den Port einstellen. `0.0.0.0` bindet alle IPv4-Schnittstellen. Für den Pilot kann eine konkrete interne IP sinnvoll sein. Unter `certificate` die PEM-Zertifikatskette und unter `key` den privaten PEM-Schlüssel angeben. Relative Pfade beziehen sich auf den Ordner von `receiver.toml`. Die URL in Thunderbird muss zum Zertifikatsnamen passen und Thunderbird muss dem Aussteller vertrauen. Ein Endpunkt wie `https://soc.example.com:8443/thundy/events` verwendet direkt den Python-Webserver. Nach einer Zertifikatserneuerung den Dienst neu starten.
2. Unter `[smtp]` das Relay und einen dort freigegebenen Absender konfigurieren. In `to` das Zielpostfach eintragen. `tls = "starttls"` passt zum Beispiel zu Port 587 und `tls = "implicit"` zu Port 465, sofern das Relay diese Betriebsart anbietet. `tls = "local"` ist für einen unauthentifizierten Mailrelay auf `127.0.0.1` oder `::1` vorgesehen. Der lokale HTTP-Testmodus erfordert eine Loopback-Bindung und `allow_loopback_http = true`. Thunderbird selbst verwendet den HTTPS-Endpunkt.
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

Nach Anlage des Dienstkontos und der Unit unter `/etc/systemd/system/thundy-receiver.service` den Dienst mit `sudo systemctl enable --now thundy-receiver` starten. `sudo journalctl -u thundy-receiver` zeigt Speicher- und SMTP-Zustellungen anhand der Ereignis-ID.

## 3. Thunderbird verbinden und Testmail auslösen

In `policies.json` unter `thundyPolicy.reporting` die genaue HTTPS-Adresse eintragen. Mit `"mode": "suspicious"` meldet Thundy auch erreichte Schwellenwerte. Mit `"indicators": true` fügt Thundy bei Links den Hostnamen und bei Anhängen den SHA-256 hinzu. Mit `"details": true` kommen unter anderem Dateiname und Anbieterbefunde hinzu. Nach dem Neustart in Thundys Einstellungen Empfänger und Datenumfang bestätigen, Hostfreigabe erteilen und das Geräte-Token hinterlegen. [Unternehmensrichtlinien und Eventfelder](../../docs/UNTERNEHMENSRICHTLINIE.md)

Für einen Pilot ohne externe Scans die verwaltete Linkschwelle vorübergehend auf **0** setzen und eine harmlose Testadresse in Thunderbird anklicken. Ein Beispiel für einen direkten Test desselben Endpunkts ist `event.json` mit folgendem Inhalt. Für einen neuen Test eine neue UUID verwenden und sie im Header mitführen.

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

~~~sh
read -r -s THUNDY_TEST_TOKEN
curl --include --fail-with-body \
  -H "Authorization: Bearer $THUNDY_TEST_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: a1c8080d-5c2e-491e-a163-000000000001' \
  --data-binary @event.json https://soc.example.com:8443/thundy/events
unset THUNDY_TEST_TOKEN
~~~

Der erste POST und eine identische Wiederholung ergeben **204**. Beide beziehen sich auf denselben SQLite-Eintrag. **401** weist auf das Token hin, **409** auf eine Kollision der Ereignis-ID, **422** auf ein ungültiges Event und **503** auf einen vollen oder nicht erreichbaren Speicher. Bei 204 und ausbleibender E-Mail zuerst `receiver.py status` und dann die SMTP-Protokolle prüfen.

## Inhalt und Aufbewahrung der Meldungen

Die E-Mail führt Ereignis-ID, Gerät, Zeit, Auslöser, Aktion, Thundy-Befund und Entscheidung zusammen. Der Entscheidungsscore und die Firmenschwelle stehen getrennt von Anbieterwerten. Je Anbieter erscheinen Urteil und Herkunft, verfügbare Zeit, Score, Referenzen und Erkennungszahlen. Für Hybrid Analysis führt **Bericht ansehen** zur Sample-Übersicht und die Job-ID identifiziert, sofern geliefert, den betreffenden Lauf. urlscan.io liefert seine Scan-Ansicht. Der E-Mail-Empfänger kann die Berichte mit den Berechtigungen seines Anbieterkontos aufrufen. Bei einem lokalen Verdacht ohne Anbieterbefund kennzeichnet die Mail das leere Ergebnis ausdrücklich.

Der Empfänger wartet bei einem SMTP-Fehler und versucht die Zustellung erneut. Nach SMTP-Annahme entfernt er den Meldungsinhalt aus SQLite und behält die Empfangsmarke standardmäßig 30 Tage. Offene Ereignisse bleiben bis zur SMTP-Annahme in der begrenzten Warteschlange. Wenn das Relay die Mail annimmt und der Prozess unmittelbar vor dem SQLite-Update ausfällt, kann eine erneute E-Mail mit derselben Ereignis-ID und `Message-ID` entstehen. SMTP-Annahme bestätigt die Übergabe an das Relay. Die Aufbewahrung im Zielpostfach richtet sich nach dessen Einstellungen.

Im Quellrepository prüft `python -m unittest discover -v -s examples/python-receiver` den Vertrag mit dem JavaScript-Sender, die HTTPS-Annahme und die SMTP-Zustellung. Für die Vertragstests braucht die Testumgebung Node.js und für das lokale HTTPS-Zertifikat OpenSSL. Der laufende Empfänger benötigt beides nicht.
