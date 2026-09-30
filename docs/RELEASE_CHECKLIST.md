# Release-Checkliste — Thundy AV 1.6 (Thunderbird Add-ons Store)

Diese Liste ist die **Übergabe-Checkliste** für die Einreichung. Alles, was automatisierbar ist, ist bereits grün
(siehe unten); die vier Schritte in Abschnitt 2 erfordern eine echte Thunderbird-Installation bzw. Store-Zugang und
konnten in der Entwicklungsumgebung nicht ausgeführt werden.

Stand: Commit `4ad0e4d` (Branch `cline/ktzgfrzf`).

## 1. Bereits erledigt (in jeder Umgebung reproduzierbar)

```bash
npm ci
npm test                                        # 469 Tests, 0 Fehler
npm run pre-submit-checks                       # 0 Fehler, 2 Warnungen (siehe 2.1/2.4)
npx web-ext lint --source-dir . --output json > /tmp/lint.json
node scripts/filter-lint-warnings.js /tmp/lint.json   # 0 Fehler, 28 bekannte TB-False-Positives
npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
node scripts/verify-package.js ./build          # 18 Dateien, 279 353 Bytes, Paketinhalt gültig
```

Zusätzlich geprüft: Manifest/Rechte-Konsistenz, Datenkonsent-Deklaration, Locale-Parität (208 Keys je Sprache),
Markup-Vertrag von `popup.html`/`options.html`, Datenschutzerklärung ohne Widersprüche zum Code,
Integrationstest „Nachricht angezeigt → Bewertung gespeichert → Popup zeigt sie“.

## 2. Vor der Einreichung zwingend (nicht automatisierbar)

### 2.1 Live-Test in Thunderbird 140 ESR
1. `npm ci && npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest`
2. Thunderbird → ☰ → **Add-ons und Themes** → Zahnrad → **Debug-Add-ons** → **Temporäres Add-on laden** →
   `manifest.json` (oder das ZIP aus `./build`).
3. Testnachricht einspielen: `docs/test_messages/suspicious_message.eml` in einen Ordner ziehen
   (Details: [docs/test_messages/README.md](test_messages/README.md)).
4. Die Schritte aus [docs/reviewer_notes.md](reviewer_notes.md) Abschnitt 8 durchgehen: Banner mit beiden Buttons,
   Warnbanner ab Score 50, Auth-Badge, Popup (lokale Bewertung + Chips + Scan-Aktion), beide Kontextmenü-Einträge,
   Time-of-Click (Blockade, „Link trotzdem öffnen“, Mittelklick), „HTML entschärfen“, „Cache leeren“,
   Berechtigungsdialog aus dem Banner.
5. Ergebnis in [docs/STATUS.md](STATUS.md) eintragen (Version, Datum, Abweichungen). Schlägt etwas fehl, zuerst
   prüfen, ob die UI registriert ist: Einstellungen → „Status der Erweiterung“.

### 2.2 Screenshots (4 Motive, PNG ≥ 1280 × 800, Testdaten)
`docs/screenshots/01-options-consent.png`, `02-inline-optin-banner.png`, `03-threat-banner.png`,
`04-popup-assessment.png` — Motive und Anforderungen in [docs/store_assets.md](store_assets.md),
Aufnahmeanleitung in [docs/screenshot_capture.md](screenshot_capture.md).

### 2.3 Datenschutzerklärung neu veröffentlichen
Die Live-URL antwortet (HTTP 200), liefert aber eine **ältere Revision** als `docs/`: die Abschnitte zur
Datenkonsent-Deklaration, zum Time-of-Click-Pfad und zur lokal gespeicherten Bewertung fehlen dort.
Aktuellen `docs/`-Stand in den Pages-Branch übernehmen und danach stichprobenartig gegen
[docs/privacy_policy.md](privacy_policy.md) prüfen.

### 2.4 Signieren und einreichen
```bash
WEB_EXT_API_KEY=<ATN-Key> WEB_EXT_API_SECRET=<ATN-Secret> \
  npx web-ext sign --source-dir . --artifacts-dir ./build --channel listed
```
Danach das Listing aus [docs/store_listing.md](store_listing.md) befüllen (Titel, Summary ≤ 250 Zeichen,
Beschreibung EN/DE, Kategorie „Privacy & Security“, Lizenz MIT, Support-Kontakt, Privacy-Policy-URL, Releasenotes 1.6)
und die Screenshots hochladen.

## 3. Empfohlen (senkt Review-Risiko)

- **CI vervollständigen:** `cp docs/ci/ci.yml .github/workflows/ci.yml` und
  `cp docs/ci/release.yml .github/workflows/release.yml` — erfordert ein Token/Person mit
  `workflows`-Berechtigung. Die Pre-Submit-Checks warnen, solange die aktive CI nur `background.test.js` ausführt.
- **Release-Artefakt** zur Version 1.6 bauen und am GitHub-Release anhängen.
- **Nach der Freigabe:** Releasenotes pflegen, Reviewer-Rückfragen beantworten, `docs/STATUS.md` aktualisieren.

## 4. Nachkontrolle nach der Einreichung

- Store-URL in README/STATUS eintragen (aktuell: keine).
- Signatur-/Versionsstand im Repo taggen.
- Prüfen, dass die veröffentlichte Datenschutzerklärung weiterhin dem Code entspricht (Datenschutz-Stufen,
  Provider-Liste, lokale Speicherung).
