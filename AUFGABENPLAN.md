# Aufgabenplan – Thunderbird SECurity AntiVirus

Abgeleitet aus den Verbesserungsvorschlägen (Stand: 08.10.2026).
Der aktuelle Projektzustand wurde geprüft; bereits erledigte Punkte sind entsprechend markiert.

**Legende:**
- Priorität: 🔴 hoch / 🟡 mittel / 🟢 niedrig
- Status: ⬜ offen / ✅ erledigt

---

## Phase 1 – Blocker & Sicherheit (🔴)

### Aufgabe 1.1: Manifest korrigieren und Icons bereitstellen
- **Ist-Zustand (geprüft):** `manifest.json` verweist auf `img/icon-16px.jpg`, `img/icon-32px.jpg`, `img/icon-64px.jpg` – das Verzeichnis `img/` existiert nicht. Installation/Paketierung schlägt damit fehl.
- **Teilpunkte:**
  - [ ] Icon-Dateien unter `img/` ergänzen (oder Manifest-Pfade auf vorhandene Assets umstellen).
  - [ ] Manifest-Struktur gegen aktuelle MV3-/Thunderbird-Vorgaben prüfen (`message_display_action`, `browser_specific_settings`).
  - [ ] Versionsnummer bereinigen (`"1.5"` → semantische Version, z. B. `1.5.0`) und mit `install.rdf` abgleichen.
  - [ ] Beschreibung im Manifest korrekt formulieren (Rechtschreibung: „scanns“ → „scannt“).
- **Aufwand:** S · **Abhängigkeiten:** keine

### Aufgabe 1.2: API-Aufrufe durch das bestehende `ApiGateway` routen
- **Ist-Zustand (geprüft):** `api_gateway.js` (Timeouts/Rate-Limits) existiert inkl. Tests, wird aber von `api.js` und `background.js` nirgends referenziert – alle `fetch()`-Aufrufe gehen direkt ans Netz.
- **Teilpunkte:**
  - [ ] Gateway in `manifest.json` (`background.scripts`) bzw. Import-Pfad einbinden.
  - [ ] Alle `fetch()`-Aufrufe in `api.js` und `background.js` (Hybrid Analysis, urlscan.io, VirusTotal) auf `ApiGateway` umstellen.
  - [ ] Rate-Limits pro Anbieter konfigurieren (VirusTotal Free: 4 Anfragen/Minute beachten).
  - [ ] Fehlerpfade testen: Timeout, HTTP-Fehler, Rate-Limit-Erschöpfung.
- **Aufwand:** M · **Abhängigkeiten:** keine · **Referenz:** `api_gateway.test.js` als Vorlage

### Aufgabe 1.3: API-Key-Handling härten
- **Teilpunkte:**
  - [ ] Umgang mit Schlüsseln in `browser.storage.local` dokumentieren (Risiko, Geltungsbereich).
  - [ ] Schlüssel niemals an UI/Logs ausgeben (siehe Aufgabe 2.2).
  - [ ] Validierung & verständliche Fehlermeldung bei ungültigem/fehlendem Key.
  - [ ] Optional: Hinweis auf keyring/Passwort-Manager statt Klartextspeicherung in der Doku.
- **Aufwand:** S–M · **Abhängigkeiten:** 1.2

---

## Phase 2 – Code-Bereinigung (🟡)

### Aufgabe 2.1: Skript-Inseln aufräumen
- **Ist-Zustand (geprüft):** Im Repo-Kern liegen Einmal-Skripte: `fix_safehash.js`, `replace_api_calls.js`, `replace_inner_html.js`, `replace_manual_ui.js`, `req.js`, `vt_test.js`, `test_apis.js`, `benchmark_isFirstComm.js` u. a.
- **Teilpunkte:**
  - [ ] Nicht mehr benötigte Migrationsskripte löschen.
  - [ ] Verbleibende Ad-hoc-Tests nach `tests/` oder `scripts/` verschieben.
  - [ ] `pnpm-lock.yaml` und `package-lock.json` nicht parallel pflegen – ein Paketmanager wählen.
- **Aufwand:** S · **Abhängigkeiten:** keine

### Aufgabe 2.2: Logging im Produktionspfad reduzieren
- **Ist-Zustand (geprüft):** `console.log`: 23× in `background.js`, 5× in `api.js`.
- **Teilpunkte:**
  - [ ] Debug-Ausgaben entfernen oder hinter einem schaltbaren Logger (`DEBUG`-Flag in den Optionen) kapseln.
  - [ ] Sicherstellen, dass keine API-Keys, Hashes von Anhängen oder E-Mail-Inhalte geloggt werden.
- **Aufwand:** S · **Abhängigkeiten:** 1.3

### Aufgabe 2.3: Duplikate zusammenführen
- **Teilpunkte:**
  - [ ] Identische Error-Catcher vereinheitlichen (gemeinsames Modul, z. B. `utils.js`).
  - [ ] `escapeHTML()` – mehrfach vorhanden – einmal zentral definieren und wiederverwenden.
  - [ ] Bekannter Bug aus `plan.md` mitnehmen: undefinierte `resultHtml`-Verwendung in `renderManualUploadUI` (api.js) → DOM-Korrektur (`appendElementHtml(..., card)`), Extraktion von `createUploadButtonUI` / `createCdrButtonUI`.
- **Aufwand:** M · **Abhängigkeiten:** 2.2

### Aufgabe 2.4: Lintings einführen
- **Teilpunkte:**
  - [ ] `'use strict';` in allen Skripten aktivieren.
  - [ ] ESLint konfigurieren (Empfehlung: `eslint:recommended` + WebExtensions-Globals via `webextensions`-Env).
  - [ ] `npm run lint` als Skript in `package.json` ergänzen; Referenzfehler (wie undefinierte Variablen) automatisch finden lassen.
- **Aufwand:** S–M · **Abhängigkeiten:** 2.1, 2.3

---

## Phase 3 – Barrierefreiheit & UX (🟡)

### Aufgabe 3.1: HTML-Attribute & Screen-Reader-Support
- **Ist-Zustand (geprüft):** `lang="de"` ist in `popup.html` und `options.html` bereits gesetzt ✅ – Restpunkte bleiben offen.
- **Teilpunkte:**
  - [ ] `role="alert"` / `aria-live="polite"` für Fehler- und Statusmeldungen in Popup und Optionen.
  - [ ] Formularfelder in `options.html` mit expliziten `<label for>`-Verknüpfungen prüfen.
  - [ ] Kontrastprüfung anhand `theme.css` (docs/.jules/palette.md als Referenz).
- **Aufwand:** S · **Abhängigkeiten:** keine

### Aufgabe 3.2: Ladezustände bei langen Polling-Prozessen
- **Teilpunkte:**
  - [ ] `aria-busy="true"` + sichtbarer Statustext während urlscan.io-/Hybrid-Analysis-Polling.
  - [ ] Abbruch-/Retry-Möglichkeit bei Zeitüberschreitung anbieten.
- **Aufwand:** M · **Abhängigkeiten:** 1.2 (Gateway liefert saubere Timeout-Signale)

---

## Phase 4 – Projektstruktur & Dokumentation (🟢)

### Aufgabe 4.1: `.gitignore` anpassen
- **Ist-Zustand (geprüft):** `node_modules/` ist bereits enthalten ✅.
- **Teilpunkte:**
  - [ ] Ergänzen: `*.log`, `.DS_Store`, Paketbau-Artefakte (`*.xpi`, `dist/`), lokale Test-Outputs.
- **Aufwand:** XS · **Abhängigkeiten:** keine

### Aufgabe 4.2: Tests standardisieren
- **Ist-Zustand (geprüft):** Eigener Harness `run_custom_test.js`; `package.json` enthält kein `test`-Skript; jsdom ist einzige Dependency.
- **Teilpunkte:**
  - [ ] Einheitlicher Runner (Jest oder Node `node:test`) einführen.
  - [ ] `npm test`-Skript in `package.json` definieren.
  - [ ] Vorhandene `*.test.js` migrieren; die Ad-hoc-`test_*.js` aus Phase 2.1 eingliedern.
  - [ ] CI-Workflow (GitHub Actions): Lint + Tests bei jedem Push/PR.
- **Aufwand:** M · **Abhängigkeiten:** 2.1, 2.4

### Aufgabe 4.3: Dokumentation aktualisieren
- **Teilpunkte:**
  - [ ] `README.de.md` / `README.md`: korrekte Projektbeschreibung, Setup, Build & Test-Anleitung.
  - [ ] Sicherheitsabschnitt: API-Key-Aufbewahrung, Datenfluss zu externen Anbietern.
  - [ ] Veraltete Plan-Dateien (`plan.md`, `plan_draft.md`) ins `docs/`-Archiv verschieben oder löschen.
- **Aufwand:** S · **Abhängigkeiten:** 4.2 (verweist auf neuen Test-Workflow)

---

## Empfohlene Reihenfolge

```
1.1 ─┐
1.2 ─┼─► 1.3 ─► 2.2 ─► 2.3 ─► 2.4 ─► 4.2 ─► 4.3
2.1 ─┘                          3.1 ─► 3.2 (parallel)
4.1 (jederzeit)
```

1. **Zuerst 1.1**, da ohne Icons keine installationfähige Extension gebaut werden kann.
2. **Dann 1.2/1.3**, bevor weitere API-Provider (Vgl. `plan_draft.md`: VirusTotal) angebunden werden – das Gateway ist Voraussetzung für sicheres Multi-Provider-Rate-Limiting.
3. **Phase 2** schafft die Basis für automatisierte Prüfungen (Linting fängt Fehler wie den `resultHtml`-Bug künftig automatisch).
4. **Phase 3/4** können begleitend und in Teilen parallel (3.1, 4.1) erfolgen.

**Gesamtaufwand (grob):** ~8–12 Personentage; Phase 1 ≈ 40 %, Phase 2 ≈ 30 %, Phase 3/4 ≈ 30 %.
