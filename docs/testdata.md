# Testdaten für den manuellen Thunderbird-Test

**Bezug:** Store-Readiness A-02/A-11–A-13 und A-15 (Reviewer-Testmittel)
**Erzeugung:** `node scripts/make-testdata.js` (schreibt `testdata/*.eml`, keine externen Abhängigkeiten)

Alle Fixtures liegen in `testdata/` und sind **nicht** Bestandteil des XPI
(`web-ext-config.mjs` → `ignoreFiles`, geprüft durch `scripts/verify-package.js`).

## 1. Inhalt

| Datei | Zweck | Erwartetes Verhalten im Add-on |
|---|---|---|
| `01-harmless-attachment.eml` | Nachricht mit harmlosem Text-Anhang | Opt-in-Banner mit beiden Schaltflächen erscheint; kein Warnbanner; Hash-Abfrage erst nach Zustimmung |
| `02-html-attachment.eml` | HTML-Anhang mit `<script>` | Popup bietet „HTML entschärfen“ an; die gespeicherte Kopie enthält kein Skript mehr |
| `03-risky-urgency-link.eml` | Dringlichkeits-/Zahlungswortlaut + zwei Links | Risiko-Score steigt; Warnbanner mit Begründungsliste; Time-of-Click-Hinweis an den Links |
| `04-sender-mismatch.eml` | Absender-Domain ≠ Reply-To-Domain, Lookalike-Domain | Bewertung meldet Absender-/Reply-To-Abweichung (BEC-Heuristik) |

Eigenschaften aller Fixtures: ausschließlich reservierte Domains (`example.com`, `example.org`,
`example.test`, `.example`), kein echter Personenbezug, kleine Textinhalte, keine ausführbaren Dateien.
Die `Authentication-Results`-Kopfzeile ist **erfunden** (SPF/DKIM/DMARC = pass) und dient nur dazu, den
Authentifizierungszweig deterministisch zu testen.

## 2. Import in ein Thunderbird-Testprofil

1. **Separates Profil anlegen** (nicht das Alltagsprofil verwenden):
   `thunderbird -ProfileManager` → neues Profil „Thundy AV Test“ → als Standard nur für diesen Test nutzen.
2. **Testkonto einrichten** (lokales Konto, kein Versand nötig): *Konten-Einstellungen → Konten-Aktionen →
   „Anderes Konto hinzufügen“* → Typ „Unix Mailspool“ oder „Maildir“, Pfad z. B. `~/thundy-test/Mail`.
3. **Fixtures importieren** — eine der beiden Varianten:
   - **Drag & Drop:** die `.eml`-Dateien aus `testdata/` per Drag & Drop in einen Ordner des Testkontos
     ziehen (Thunderbird importiert `.eml` als Nachricht); oder
   - **Maildir:** die `.eml`-Dateien in `<Maildir>/cur/` kopieren und Thunderbird neu starten.
4. **Add-on laden:** `about:debugging#/runtime/this-firefox` → *Temporäres Add-on laden* → `manifest.json`
   aus dem Repository wählen (alternativ `web-ext run --firefox=/pfad/zu/thunderbird`).
5. Prüfschritte und Protokoll: [live_test_protocol.md](live_test_protocol.md).

## 3. Hinweise für Reviewer (A-15)

- Für den vollen end-to-end-Lauf wird ein **eigener kostenloser API-Schlüssel** benötigt (Hybrid Analysis,
  optional VirusTotal/urlscan.io/URLhaus/AbuseIPDB); ein mitgelieferter Testschlüssel existiert nicht.
- **Ohne Schlüssel prüfbar:** lokale Heuristiken (Score, Absender/Reply-To, Erstkontakt, Black-/Whitelist),
  Banner-Anzeige, Opt-in-Schalter, Widerruf der Zustimmung, „Cache leeren“, HTML-Entschärfung,
  Netzwerkstille bei ausgeschalteter Zustimmung (Thunderbird-Entwicklerwerkzeuge → Netzwerk).
- **Mit Schlüssel prüfbar:** Hash-Abfrage, Upload (Stufe `balanced`/`max`), URL-/Domain-/IP-Abfragen,
  Host-Permission-Abfrage beim Speichern, Fehlerverhalten bei ungültigem Schlüssel (HTTP 401/403).
