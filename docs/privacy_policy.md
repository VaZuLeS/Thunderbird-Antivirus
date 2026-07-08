Datenschutzerklärung — Thunderbird Extension: Echtzeit‑Email‑Scanning

Kurzprofil
Diese Thunderbird‑Extension ("Thundy AV Checker") prüft eingehende E‑Mails auf sicherheitsrelevante Risiken wie Malware, Phishing‑Indikatoren und gefährliche Anhänge. Die Extension bietet eine optionale Integration zu externen Malware‑Analyse‑Diensten. Echtzeit‑Scanning ist standardmäßig deaktiviert; Nutzer entscheiden per Opt‑In, welche Konten oder Nachrichten analysiert werden.

1) Verantwortlicher
VaZuLeS / Jan Bludau
Kontakt: bludau.it.services@gmail.com

2) Geltungsbereich
Diese Richtlinie beschreibt, welche Daten die Extension erfasst, wie sie verarbeitet und mit welchen Drittanbietern sie geteilt werden können. Sie gilt für Endnutzer, die die Extension installieren und aktivieren.

3) Verarbeitete Daten (Kategorien)
- Nachricht‑Metadaten: Absender, Empfänger, Betreff, Message‑ID, Header‑Felder, Zeitstempel.
- Inhaltliche Daten (nur nach Einwilligung): Teile des Nachrichteninhalts, URLs im Text, Verlinkungen.
- Anhänge (nur nach Einwilligung): Dateinamen, MIME‑Typ, Größe, SHA‑256 Hash. Vollständige Anhänge werden nur bei ausdrücklicher Zustimmung hochgeladen.
- Netz‑/Infrastrukturdaten (bei Bedarf): IP‑Adressen oder Domain‑Informationen extrahiert aus Links/Headers für Reputationsprüfungen.
- Lokale Einstellungen & Opt‑In Flags: Benutzerpräferenzen, Datenschutzstufe, API‑Key‑Werte (im Browser‑Storage), Scan‑Metadaten (Scan‑Zeit, Ergebnis).
- Optional anonymisierte Telemetrie (separates Opt‑In): Laufzeit‑Fehler, Performance‑Metriken.

4) Zwecke der Verarbeitung
- Schutz vor Malware, Phishing und schädlichen Anhängen.
- Anzeige von Scan‑Ergebnissen im UI und Speicherung minimaler Scan‑Metadaten lokal (z. B. Zeit, Ergebnis).
- Optional: Anonymisierte Produktverbesserung per Telemetrie (nur mit Einwilligung).

5) Rechtsgrundlage
- Einwilligung (Art. 6 Abs. 1 lit. a DSGVO): für Uploads von Anhängen, Nachrichtenteilen oder Telemetrie.
- Verarbeitung von Metadaten kann auf berechtigtem Interesse oder zur Vertragserfüllung gestützt werden; konkrete Rechtsgrundlage kann je nach Rechtsordnung variieren.

6) Weitergabe an Drittanbieter
- Externe Analyse‑Dienste: Hybrid‑Analysis, VirusTotal, urlscan.io, urlhaus, AbuseIPDB — nur die minimal nötigen Daten werden übermittelt (z. B. Hashes statt Dateien, sofern möglich).
- Die Privacy‑Policy der Drittanbieter gilt für deren Verarbeitung; Links zu den Drittanbieter‑Richtlinien sollten in den Reviewer‑Notes / Store‑Listing enthalten sein.
- Keine Weitergabe an Dritte für Werbezwecke.

7) Aufbewahrungsdauer
- Kurzfristige Zwischenspeicherung für aktive Verarbeitung (z. B. 24–72 Stunden) — abhängig vom Dienst und der Anfrage.
- Lokale Speicherung: nur Opt‑In Flags und minimaler Scan‑Verlauf; auf Wunsch kann der Nutzer diese Daten löschen (Optionsseite: Cache leeren).

8) Sicherheit und Schutzmaßnahmen
- Transport: alle externen Aufrufe erfolgen über HTTPS/TLS mit aktuellen TLS‑Settings.
- Secrets: API‑Schlüssel werden nur im browser.storage.local gespeichert; niemals ins Repository.
- Minimierung: standardmäßig werden nur Hashes und Metadaten gesendet; Voll‑Uploads erfordern explizite Nutzeraktion.
- CSP: content_security_policy in manifest.json schränkt Scriptquellen ein; keine remote‑scripts oder unsafe‑eval.

9) Internationale Datenübermittlungen
- Drittanbieter können Server in anderen Jurisdiktionen nutzen; Nutzer sollten die Drittanbieter‑Richtlinien prüfen. Die Extension selbst trifft keine zusätzlichen Datenübermittlungen ohne Einwilligung.

10) Nutzerrechte
- Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Widerruf der Einwilligung, Datenübertragbarkeit: Anfragen an bludau.it.services@gmail.com.
- Widerruf: Nutzer können Opt‑In jederzeit in den Optionen widerrufen und ggf. gespeicherte lokale Daten löschen.

11) Änderungen dieser Richtlinie
- Änderungen werden im Changelog und in der Release‑Beschreibung dokumentiert. Wesentliche Änderungen werden aktiv kommuniziert.

12) Kontakt & Beschwerden
- Kontakt: bludau.it.services@gmail.com
- Bei Beschwerden bezüglich Datenschutz hat der Nutzer das Recht, sich an die zuständige Datenschutzaufsichtsbehörde zu wenden.

Annex: Details zur Datenweitergabe (Technischer Anhang)
- File uploads: minimal notwendige Metadaten (SHA‑256, Name, MIME‑type) werden an die ausgewählten Analyse‑Dienste übermittelt. Vollständige Dateien nur nach ausdrücklicher Zustimmung.
- URL scans / IP checks: URLs werden an urlscan.io/urlhaus zur Analyse gesendet; IPs zur AbuseIPDB Abfrage. Nur wenn Auto‑Scan oder manuelle Aktion ausgelöst ist.

Stand: 2026-07-08 — Version: Draft 1

Hinweis: Diese Richtlinie ist ein Entwurf. Vor der Veröffentlichung die Links zu den Drittanbieter‑Privacy‑Policies einfügen und die veröffentlichte GitHub Pages URL in manifest.json setzen.
