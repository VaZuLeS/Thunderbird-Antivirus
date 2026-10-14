# Live-Abnahme 1.21.0 — optionale Profile

Status: Chromium mit gemockten Thunderbird-APIs geprüft; echte Thunderbird-Abnahme auf 140 ESR und aktueller Version unter Windows/macOS/Linux noch offen. Screenshots in `screenshots/1.21.0/` stammen aus Chromium, nicht aus Thunderbird.

1. In jeder Sprache EN/DE/FR/ES/IT/PL Einstellungen → Optionale Unternehmensprofile öffnen. Standard: lokale Vorbereitung, externe Bereiche deaktiviert.
2. Microsoft-Kombination auswählen, SIEM deaktivieren und SSO zu Keycloak ändern. Vorschau aktualisiert sich; andere Bereiche bleiben erhalten.
3. Auswahl lokal speichern, Seite schließen und erneut öffnen. Nur Profilkennungen bleiben erhalten. Bestehende externe Scanfreigaben, Schlüssel und Linklog bleiben unverändert.
4. JSON exportieren. Entwurf bleibt `mode: disabled`, alle Integrationen `enabled: false`. Keine Secret-Werte, Nachrichten oder Linklog-URLs enthalten. Download-Abbruch und Speicherfehler verständlich anzeigen.
5. Zurücksetzen. Nur Profilauswahl entfernen, Standard wieder anzeigen.
6. Dark/Light, 360/1200 Pixel, Tastatur und 200-%-Zoom prüfen. Kein horizontaler Seitenüberlauf, JSON-Vorschau scrollbar.
7. In Netzwerküberwachung bestätigen, dass Auswählen/Speichern/Exportieren keine Provider-/Unternehmensverbindung auslöst. Enterprise-Broker/SSO/SIEM/Ticketintegration bleibt aus.
8. Linkdialog und lokales Audit aus 1.20.0 weiter gemäß [vorigem Protokoll](live_test_1_20_0.md) prüfen.

Automatisch: 3.125 Profilkombinationen, sechs Sprachabläufe für Speichern/Export/Reset, beschädigte gespeicherte Auswahl, unbekannte Profile und CLI-Schreibschutz geprüft; 24 Chromium-Layoutfälle (sechs Sprachen × zwei Breiten × Light/Dark) bestanden.
