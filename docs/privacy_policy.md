Datenschutzerklärung — Thunderbird Extension: Echtzeit‑Email‑Scanning

Kurzprofil
Diese Thunderbird‑Extension prüft eingehende E‑Mails in Echtzeit auf sicherheitsrelevante Probleme (Malware‑Indikatoren, Phishing‑Anzeichen, gefährliche Anhänge) und nutzt dafür optional externe Analyse‑Dienste. Scanning ist standardmäßig deaktiviert; Nutzer muss ausdrücklich zustimmen (Opt‑In). Nur die vom Nutzer freigegebenen Konten werden gescannt.

1. Verantwortlicher
Name/Organisation: [EINTRAGEN]
Kontakt: [E‑Mail/Support‑URL eintragen]

2. Welche Daten werden verarbeitet?
- Metadaten der Nachricht: Absender, Empfänger, Betreff, Zeitstempel (zur Zuordnung und Anzeige). 
- Inhalte: Nur nach expliziter Zustimmung können Teile des Nachrichtentexts oder Anhänge an externe Analyse‑Dienste gesendet werden.
- Dateianhänge: Werden nur bei aktivierter Analyse und nach Nutzerfreigabe gesendet; standardmäßig werden nur Hashes (z. B. SHA‑256) zur Vorabprüfung übertragen.
- Gerätedaten/Fehlerprotokolle: Optional, wenn Nutzer Telemetrie aktiviert (separates Opt‑In).

3. Zweck der Verarbeitung
- Schutz vor Malware, Phishing und anderen sicherheitsrelevanten Risiken.
- Verbesserung der Erkennungsregeln (anonymisierte Telemetrie, nur wenn aktiviert).

4. Rechtsgrundlage
- Verarbeitung erfolgt auf Grundlage der Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) für Inhalte/Anhänge; Metadaten zur Funktionsdurchführung ggf. zur Vertragserfüllung bzw. berechtigtem Interesse, je nach Land. Nutzer kann Einwilligung jederzeit widerrufen.

5. Datenweitergabe / Drittanbieter
- Externe Analyse‑Dienste: Nur Dienste, die in den Einstellungen genannt werden. Es werden nur die minimal notwendigen Daten übermittelt (z. B. Hashes statt Volltext, sofern möglich).
- Keine Speicherung von API‑Schlüsseln im Client‑Repo. Server‑seitige Speicherung unter Nutzung sicherer Geheimnisspeicher.

6. Aufbewahrungsdauer
- Kurzfristige Zwischenspeicherung für Verarbeitung (z. B. 24–72 Stunden), danach Löschung, sofern nicht anders vom Nutzer genehmigt.
- Telemetriedaten werden anonymisiert und aggregiert gespeichert (sofern aktiviert).

7. Sicherheit
- Alle externen Verbindungen über HTTPS/TLS; TLS‑Härtung und zeitlich begrenzte Zertifikatprüfung empfohlen.
- Keine Secrets im Quellcode; CI‑Secrets für Build/Server konfigurieren.
- Content‑Security‑Policy und WebExtension‑Sicherheitsbest Practices befolgt.

8. Nutzerrechte
- Zugriff, Berichtigung, Löschung, Widerspruch, Datenübertragbarkeit — Kontakt siehe oben.
- Opt‑Out/Deinstallationshinweis: Nutzer kann Scanning deaktivieren oder Extension entfernen; Datenlöschung beantragen.

9. Änderungen an der Richtlinie
- Wesentliche Änderungen werden in der Extension per Update‑Hinweis angezeigt; Minor‑Änderungen im Changelog dokumentiert.

10. Hosting / Veröffentlichung
- Dieser Entwurf wurde in docs/privacy_policy.md eingefügt. Für eine öffentlich zugängliche URL kann GitHub Pages benutzt werden (homepage_url bereits gesetzt). Bitte ergänze Verantwortlichenname und Kontakt.

Stand: [Datum eintragen]

Feedback/Anpassungen bitte hier angeben.
