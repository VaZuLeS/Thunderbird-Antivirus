# Live-Abnahme 1.22.0 — Einrichtungsassistent

Status: Automatisierte Tests und Chromium mit gemockten Thunderbird-APIs; reale Thunderbird-Abnahme auf 140 ESR/aktueller Version unter Windows/macOS/Linux noch offen. Keine ATN-Listung oder Store-Signierung.

- Frisches Testprofil: XPI installieren; Einrichtung öffnet genau einen eigenen Tab. Alle drei Schritte und EN/DE/FR/ES/IT/PL prüfen.
- Ohne Einwilligung: weder Providerzugriff noch Berechtigungsdialog durch den Assistenten. Linkschutz speichern und Nachricht lokal prüfen.
- „Externe Analyse einrichten“: Einstellungen öffnen; Einwilligung/Berechtigungen erst beim dortigen expliziten Speichern. Ablehnung verhindert externe Übermittlung.
- „Nicht jetzt“: keine Einstellungsänderung; über Einstellungen erneut öffnen.
- Update von 1.21.0: kein automatischer Einrichtungstab. Keys, Consent, Senderfreigaben, Datenschutzstufe und Logs erhalten.
- Assistent bei aktivierter externer Analyse erneut öffnen: vorhandene Einwilligung anzeigen und erhalten; Linkschutz-Auswahl respektieren.
- Tab schließen ohne Abschluss: keine Speicherung. Lese-/Schreib-/Taböffnungsfehler sichtbar behandeln; Retry und Fokus prüfen.
- Hell/dunkel, schmale/breite Fenster, Tastatur, Screenreader und lokale Sprache. Sprachauswahl ändert ausschließlich den Assistenten.
- GPL-v3-Projektlizenz und separate Drittanbieterlizenz im Paket vorhanden.

Zusätzlich [bestehende Live-Prüfungen](live_test_1_21_0.md) für Profile, Linkschutz, Protokoll und Popup durchführen.
