# Reale Thunderbird-Linux-Teilabnahme

Am 15. Oktober 2026 wurde der Quellstand 1.23.0 erstmals in dieser Umgebung in einer echten Thunderbird-GUI geprüft. Der wiederholbare Lauf verwendet Thunderbirds tatsächliche WebExtension-, Nachrichten-, Speicher- und Theme-Schnittstellen. Es werden keine Add-on-APIs nachgebildet. Die zusätzliche Chromium-/axe-Prüfung bleibt ein eigener Prüfumfang.

## Beobachteter Stand

| Merkmal | Tatsächlicher Wert |
| --- | --- |
| Client | Thunderbird 140.17.0 ESR, Build `20260929234105`, Linux x86_64 |
| Herkunft | Debian-Paket `1:140.17.0esr-1~deb13u1`, über signierte Debian-APT-Metadaten bezogen |
| Darstellung | Echte X11-GUI unter Xvfb, 1.280 × 1.000 Pixel; `moz:headless: false` |
| Erweiterung | Lokales, unsigniertes XPI 1.23.0; temporär im neuen Testprofil installiert |
| Daten | Eine synthetische HTML-Nachricht in lokalen Ordnern; ausschließlich `.invalid`-Adressen |
| Verbindung | Thunderbird startet offline; keine echten Konten, Schlüssel oder externe Analyseeinwilligung |
| Lauf | 15. Oktober 2026, 16:17:20–16:17:24 UTC; erfolgreich |

[Maschinenlesbarer Bericht](audits/thunderbird-linux-140.json) mit XPI-/Binary-SHA-256, Client-Build, Messwerten und synthetischem Protokolleintrag. Nur temporärer Profilpfad und Prozess-ID wurden aus der veröffentlichten Berichtskopie entfernt. Das lokal geprüfte XPI hat SHA-256 `17349736c60f1f473123ffacd2937e3f4e222f7c15f8f6d721fe2cb2220a29b8`; erneutes Packen kann einen anderen ZIP-Hash ergeben. Die Runtime entspricht dem Quellstand `16c433b6895cc55051a84df1c1622b6839209455`; diese Fortsetzung ergänzt Testwerkzeug, CI und Nachweise.

## Erfolgreich geprüft

| Prüfung | Nachweis |
| --- | --- |
| Erstinstallation | Der echte Installationsvorgang öffnet den Einrichtungsassistenten. |
| Sechs Wizardsprachen | EN, DE, FR, ES, IT und PL tatsächlich gewählt; Titel gegen den jeweils im XPI enthaltenen Sprachkatalog geprüft. |
| Wizardnavigation und Speichern | Beide Schrittwechsel fokussieren die Überschrift; Abschlussmarker und Linkschutz gespeichert; keine externe Einwilligung erteilt. |
| Nachricht | Echte lokale Nachricht importiert und angezeigt; Add-on-Banner und Linkschutz injiziert. |
| Linkdialog | Anklicken des synthetischen HTTPS-Links öffnet den gebrandeten Dialog mit vollständiger URL und lokalem Score; gemessene Kartenbreite 520 px. |
| Abbrechen | Dialog schließt, Link erhält Fokus zurück; kein Öffnungsversuch. |
| Protokoll | Tatsächliche Hintergrund-API liefert genau einen Eintrag: `ABORTED`, gleiche URL, `scoreAtDecision: 0`, `verdictAtDecision: UNKNOWN`, `openAttempts: 0`. Die lokale Auditseite zeigt ihn an. |
| Natives Nachrichten-Popup | X11-Mausklick auf den echten Toolbarbutton; Popupinhalt 600 px, nativer Rahmen 602 px. Nachricht und Absender sichtbar. |
| Darstellung speichern | Dunkel, Violett und Kompakt über echte Einstellungen gewählt, gespeichert und nach Neuladen wiederhergestellt. |
| Thunderbird-Themes | Bei „Thunderbird folgen“ echte integrierte dunkle und helle Thunderbird-Themes aktiviert; Add-on folgt beiden Änderungen. |

Der Providername im Protokoll bezeichnet die konfigurierte Zuordnung. `UNKNOWN` bei deaktivierter externer Analyse behauptet keine erfolgte Providerprüfung. Der lokale Score 0 garantiert keine Sicherheit.

![Echtes natives Popup mit 600 Pixeln Inhalt](screenshots/thunderbird-linux/native-popup.png)

![Gebrandeter Linkdialog in der echten Nachricht](screenshots/thunderbird-linux/link-dialog.png)

![Einstellungen folgen dem nativen dunklen Thunderbird-Theme](screenshots/thunderbird-linux/options-native-dark.png)

Die Bilder stammen unverändert aus dem realen Testlauf. Weitere Ansichten, Logs und Bericht werden bei jedem Lauf lokal erzeugt und in der CI als zeitlich begrenztes Artefakt aufbewahrt.

## Wiederholen

Benötigt werden Linux/X11, Python 3, Thunderbird 140+, Xvfb, `libX11`, `libXtst` sowie ImageMagicks `import` für das native Popupbild. Ein vollständiges Betriebssystempaket ist vorzuziehen. Der hier verwendete Lauf extrahiert authentifizierte Debian-Pakete nur in ein ignoriertes Arbeitsverzeichnis; die Systeminstallation wird nicht verändert.

```sh
npm ci
npm run package
cp build/thundy_av_email_scanner_for_thunderbird-1.23.0.zip build/thundy-av-1.23.0.xpi
python3 tools/thunderbird-live.dev.py \
  --thunderbird /usr/lib/thunderbird/thunderbird-bin \
  --xvfb /usr/bin/Xvfb \
  --xpi build/thundy-av-1.23.0.xpi \
  --out .audit/thunderbird-live
```

Der Ausgabeordner muss neu sein. Der Runner erstellt ausschließlich ein frisches temporäres Profil, startet seinen eigenen Xvfb ohne TCP-Listener und beendet seine Prozesse auch bei Prüffehlern. Vorhandene Benutzerprofile werden nicht geöffnet. Marionette mit Systemzugriff wird nur für dieses wegwerfbare Testprofil aktiviert; der Runner gehört nicht zum XPI. Thunderbird läuft offline; dies ist keine zusätzliche Betriebssystem-Netzwerkisolation.

Die CI führt denselben Runner nach erfolgreichem Paketgate als **Thunderbird Linux GUI** mit dem echten Thunderbird aus Debian Trixie aus. Paket und Bericht enthalten die jeweils tatsächlich geprüfte Version bzw. Hashes; die Paketquelle kann zukünftig einen neueren ESR liefern. `thunderbird-linux-live` enthält JSON, Screenshots und Logs. Der Lauf schlägt bei fehlenden Voraussetzungen oder nicht erfüllten Assertions fehl und ersetzt keinen negativen Befund durch einen simulierten Erfolg.

## Offene Abnahme

Dies ist eine begrenzte Linux-Teilabnahme von 1.23.0, keine vollständige Freigabe und kein neuer Release. Weiterhin offen sind:

- Windows und macOS, unterschiedliche DPI/Zoomwerte, Betriebssystem-Barrierefreiheit und echte Screenreader.
- Alle übrigen Oberflächen in allen sechs tatsächlich eingestellten Thunderbird-Sprachen; der Sprachwechsel dieses Laufs betrifft den Wizard, die übrigen Ansichten liefen englisch.
- Reale externe Browserübergabe einschließlich Fehler/Retry und `OPENED`, Updateinstallation und produktive Nachrichtenkonten.
- Verschlüsselte/signierte Nachrichten und GPU-Pfade. Die lokal extrahierte Laufzeit meldete fehlendes RNP/OpenPGP und `libpci`; diese Teilprüfung verwendet ausschließlich unverschlüsselten Text und beansprucht dafür keine Abdeckung.
- Produktive SSO-/RBAC-, Cloud-/SEALED-, MDM- und unabhängige Prüfernachweise nach [N06](ENTERPRISE_N06_ABNAHME.md).

[Designplan UX05/UX06](DESIGNSYSTEM.md) · [Browserprüfung](UI_BROWSERPRUEFUNG.md) · [Nächste Aufgaben](ENTERPRISE_NAECHSTE_SCHRITTE.md)
